import { reconstructPublishedAt } from "./dates";
import type { Sql } from "./db";
import { getLatestValues, insertObservations, upsertSeries } from "./queries";
import { SERIES, requireSeriesDefinition, type SeriesDefinition } from "./series";
import { fetchSeriesRaw, type FetchOptions, type SourceName } from "./sources";
import type { ObservationRecord, SeriesRecord } from "./types";

export interface IngestOptions {
  seriesId: string;
  from?: string;
  to?: string;
  credentials?: FetchOptions["credentials"];
  fetchImpl?: typeof fetch;
  prefer?: SourceName;
  now?: Date;
}

export interface IngestResult {
  seriesId: string;
  source: string | null;
  fetched: number;
  inserted: number;
  revisions: number;
  unchanged: number;
  error?: string;
}

export function seriesToRecord(definition: SeriesDefinition): SeriesRecord {
  return {
    id: definition.id,
    name: definition.name,
    source: definition.source,
    unit: definition.unit,
    frequency: definition.frequency,
    metadata: {
      description: definition.description,
      country: definition.metadata.country,
      institution: definition.metadata.institution,
      ...(definition.metadata.notes ? { notes: definition.metadata.notes } : {}),
      sourceUrl: definition.sourceUrl,
      releaseLagDays: definition.releaseLagDays,
      codes: {
        bcch: definition.metadata.bcch ?? null,
        mindicador: definition.metadata.mindicador ?? null,
        ine: definition.metadata.ine ? true : null,
      },
    },
  };
}

function nearlyEqual(a: number, b: number): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= 1e-9 * scale;
}

/**
 * Fetches the current state of a series, compares it with what is archived and
 * inserts only new periods or revisions. New periods get a reconstructed
 * `published_at` when the source does not expose one; revisions are stamped
 * with the ingestion time, so each revision becomes a new vintage.
 *
 * The `(series_id, obs_date, published_at)` primary key plus
 * `ON CONFLICT DO UPDATE` make repeated runs idempotent.
 */
export async function ingestSeries(
  sql: Sql,
  options: IngestOptions,
): Promise<IngestResult> {
  const definition = requireSeriesDefinition(options.seriesId);
  await upsertSeries(sql, seriesToRecord(definition));

  const now = options.now ?? new Date();
  const { adapter, observations } = await fetchSeriesRaw(definition, {
    from: options.from,
    to: options.to,
    credentials: options.credentials,
    fetchImpl: options.fetchImpl,
    prefer: options.prefer,
  });

  const existing = await getLatestValues(sql, definition.id);
  const rows: ObservationRecord[] = [];
  let revisions = 0;
  let unchanged = 0;

  for (const observation of observations) {
    const previous = existing.get(observation.obsDate);
    const sourceUrl = observation.sourceUrl || definition.sourceUrl;

    if (previous === undefined) {
      rows.push({
        series_id: definition.id,
        obs_date: observation.obsDate,
        value: observation.value,
        published_at:
          observation.publishedAt ??
          reconstructPublishedAt(
            observation.obsDate,
            definition.frequency,
            definition.releaseLagDays,
            now,
          ),
        source_url: sourceUrl,
      });
      continue;
    }

    if (nearlyEqual(previous, observation.value)) {
      unchanged += 1;
      continue;
    }

    revisions += 1;
    rows.push({
      series_id: definition.id,
      obs_date: observation.obsDate,
      value: observation.value,
      published_at: observation.publishedAt ?? now.toISOString(),
      source_url: sourceUrl,
    });
  }

  const inserted = await insertObservations(sql, rows);

  return {
    seriesId: definition.id,
    source: adapter,
    fetched: observations.length,
    inserted,
    revisions,
    unchanged,
  };
}

export interface IngestAllOptions {
  from?: string;
  to?: string;
  credentials?: FetchOptions["credentials"];
  fetchImpl?: typeof fetch;
  prefer?: SourceName;
  now?: Date;
}

export async function ingestAll(
  sql: Sql,
  options: IngestAllOptions = {},
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  for (const definition of SERIES) {
    try {
      results.push(await ingestSeries(sql, { seriesId: definition.id, ...options }));
    } catch (error) {
      results.push({
        seriesId: definition.id,
        source: null,
        fetched: 0,
        inserted: 0,
        revisions: 0,
        unchanged: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
