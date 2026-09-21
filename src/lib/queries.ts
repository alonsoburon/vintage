import { normalizeAsOf } from "./dates";
import type { Sql } from "./db";
import type {
  ObservationQuery,
  ObservationRecord,
  SeriesRecord,
  SeriesSummary,
  VintageRecord,
} from "./types";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function upsertSeries(sql: Sql, series: SeriesRecord): Promise<void> {
  await sql`
    INSERT INTO series (id, name, source, unit, frequency, metadata)
    VALUES (
      ${series.id},
      ${series.name},
      ${series.source},
      ${series.unit},
      ${series.frequency},
      ${sql.json(series.metadata as never)}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      source = EXCLUDED.source,
      unit = EXCLUDED.unit,
      frequency = EXCLUDED.frequency,
      metadata = EXCLUDED.metadata
  `;
}

export async function listSeries(sql: Sql): Promise<SeriesSummary[]> {
  return sql<SeriesSummary[]>`
    SELECT
      s.id,
      s.name,
      s.source,
      s.unit,
      s.frequency,
      s.metadata,
      count(o.series_id)::int AS observations,
      count(DISTINCT o.published_at)::int AS vintages,
      min(o.obs_date)::text AS first_obs,
      max(o.obs_date)::text AS last_obs,
      max(o.published_at)::text AS last_published_at
    FROM series s
    LEFT JOIN observations o ON o.series_id = s.id
    GROUP BY s.id
    ORDER BY s.id
  `;
}

export async function getSeries(
  sql: Sql,
  id: string,
): Promise<SeriesSummary | null> {
  const rows = await sql<SeriesSummary[]>`
    SELECT
      s.id,
      s.name,
      s.source,
      s.unit,
      s.frequency,
      s.metadata,
      count(o.series_id)::int AS observations,
      count(DISTINCT o.published_at)::int AS vintages,
      min(o.obs_date)::text AS first_obs,
      max(o.obs_date)::text AS last_obs,
      max(o.published_at)::text AS last_published_at
    FROM series s
    LEFT JOIN observations o ON o.series_id = s.id
    WHERE s.id = ${id}
    GROUP BY s.id
  `;
  return rows[0] ?? null;
}

export async function searchSeries(
  sql: Sql,
  query: string,
): Promise<SeriesSummary[]> {
  const pattern = `%${query.replace(/[%_]/g, (match) => `\\${match}`)}%`;
  return sql<SeriesSummary[]>`
    SELECT
      s.id,
      s.name,
      s.source,
      s.unit,
      s.frequency,
      s.metadata,
      count(o.series_id)::int AS observations,
      count(DISTINCT o.published_at)::int AS vintages,
      min(o.obs_date)::text AS first_obs,
      max(o.obs_date)::text AS last_obs,
      max(o.published_at)::text AS last_published_at
    FROM series s
    LEFT JOIN observations o ON o.series_id = s.id
    WHERE s.id ILIKE ${pattern}
       OR s.name ILIKE ${pattern}
       OR s.source ILIKE ${pattern}
    GROUP BY s.id
    ORDER BY s.id
  `;
}

interface ObservationRow {
  series_id: string;
  obs_date: string;
  value: number;
  published_at: Date | string;
  source_url: string | null;
}

export async function getObservations(
  sql: Sql,
  query: ObservationQuery,
): Promise<ObservationRecord[]> {
  const asOf = query.asOf ? normalizeAsOf(query.asOf) : null;
  const from = query.from ?? null;
  const to = query.to ?? null;
  const limit = query.limit ?? 1_000;
  const offset = query.offset ?? 0;

  const rows = await sql<ObservationRow[]>`
    SELECT DISTINCT ON (obs_date)
      series_id,
      obs_date::text AS obs_date,
      value,
      published_at,
      source_url
    FROM observations
    WHERE series_id = ${query.seriesId}
      ${asOf ? sql`AND published_at <= ${asOf}` : sql``}
      ${from ? sql`AND obs_date >= ${from}::date` : sql``}
      ${to ? sql`AND obs_date <= ${to}::date` : sql``}
    ORDER BY obs_date ASC, published_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return rows.map((row) => ({
    series_id: row.series_id,
    obs_date: row.obs_date,
    value: Number(row.value),
    published_at: toIso(row.published_at),
    source_url: row.source_url,
  }));
}

/** Every archived row (all vintages) for a window, ordered by period. */
export async function getObservationHistory(
  sql: Sql,
  query: {
    seriesId: string;
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
  },
): Promise<ObservationRecord[]> {
  const from = query.from ?? null;
  const to = query.to ?? null;
  const limit = query.limit ?? 5_000;
  const offset = query.offset ?? 0;
  const rows = await sql<ObservationRow[]>`
    SELECT series_id, obs_date::text AS obs_date, value, published_at, source_url
    FROM observations
    WHERE series_id = ${query.seriesId}
      ${from ? sql`AND obs_date >= ${from}::date` : sql``}
      ${to ? sql`AND obs_date <= ${to}::date` : sql``}
    ORDER BY obs_date ASC, published_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map((row) => ({
    series_id: row.series_id,
    obs_date: row.obs_date,
    value: Number(row.value),
    published_at: toIso(row.published_at),
    source_url: row.source_url,
  }));
}

export async function getVintages(
  sql: Sql,
  seriesId: string,
): Promise<VintageRecord[]> {
  const rows = await sql<{ published_at: Date | string; observations: number }[]>`
    SELECT published_at, count(*)::int AS observations
    FROM observations
    WHERE series_id = ${seriesId}
    GROUP BY published_at
    ORDER BY published_at ASC
  `;
  return rows.map((row) => ({
    published_at: toIso(row.published_at),
    observations: Number(row.observations),
  }));
}

/** Latest known value for each reference period (i.e. the "today" vintage). */
export async function getLatestValues(
  sql: Sql,
  seriesId: string,
): Promise<Map<string, number>> {
  const rows = await sql<{ obs_date: string; value: number }[]>`
    SELECT DISTINCT ON (obs_date) obs_date::text AS obs_date, value
    FROM observations
    WHERE series_id = ${seriesId}
    ORDER BY obs_date ASC, published_at DESC
  `;
  return new Map(rows.map((row) => [row.obs_date, Number(row.value)]));
}

export async function insertObservations(
  sql: Sql,
  rows: ObservationRecord[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const inserted = await sql`
    INSERT INTO observations ${sql(
      rows,
      "series_id",
      "obs_date",
      "value",
      "published_at",
      "source_url",
    )}
    ON CONFLICT (series_id, obs_date, published_at)
    DO UPDATE SET
      value = EXCLUDED.value,
      source_url = EXCLUDED.source_url
    RETURNING series_id
  `;
  return inserted.length;
}
