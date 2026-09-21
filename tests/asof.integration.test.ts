import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, type Sql } from "@/lib/db";
import { ingestSeries } from "@/lib/ingest";
import { runMigrations } from "@/lib/migrate";
import { getObservations, insertObservations, upsertSeries } from "@/lib/queries";

const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb("point-in-time (as_of) semantics", () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = createDb(url as string);
    await runMigrations(sql);
  });

  beforeEach(async () => {
    await sql`TRUNCATE observations, series CASCADE`;
  });

  afterAll(async () => {
    await sql?.end();
  });

  it("returns the value known at as_of when two vintages exist", async () => {
    await upsertSeries(sql, {
      id: "test_ipc",
      name: "Test IPC",
      source: "test",
      unit: "%",
      frequency: "monthly",
      metadata: {},
    });

    await insertObservations(sql, [
      {
        series_id: "test_ipc",
        obs_date: "2024-01-01",
        value: 0.2,
        published_at: "2024-02-05T12:00:00.000Z",
        source_url: null,
      },
      {
        series_id: "test_ipc",
        obs_date: "2024-01-01",
        value: 0.5,
        published_at: "2024-03-08T12:00:00.000Z",
        source_url: null,
      },
    ]);

    const beforeRevision = await getObservations(sql, {
      seriesId: "test_ipc",
      asOf: "2024-02-20",
    });
    expect(beforeRevision).toHaveLength(1);
    expect(beforeRevision[0].value).toBeCloseTo(0.2);
    expect(beforeRevision[0].published_at).toBe("2024-02-05T12:00:00.000Z");

    const afterRevision = await getObservations(sql, {
      seriesId: "test_ipc",
      asOf: "2024-03-20",
    });
    expect(afterRevision).toHaveLength(1);
    expect(afterRevision[0].value).toBeCloseTo(0.5);

    const latest = await getObservations(sql, { seriesId: "test_ipc" });
    expect(latest[0].value).toBeCloseTo(0.5);
  });

  it("treats a date-only as_of as inclusive end of day", async () => {
    await upsertSeries(sql, {
      id: "test_daily",
      name: "Test daily",
      source: "test",
      unit: "x",
      frequency: "daily",
      metadata: {},
    });
    await insertObservations(sql, [
      {
        series_id: "test_daily",
        obs_date: "2024-01-01",
        value: 10,
        published_at: "2024-01-01T15:00:00.000Z",
        source_url: null,
      },
    ]);

    const sameDay = await getObservations(sql, {
      seriesId: "test_daily",
      asOf: "2024-01-01",
    });
    expect(sameDay).toHaveLength(1);

    const dayBefore = await getObservations(sql, {
      seriesId: "test_daily",
      asOf: "2023-12-31",
    });
    expect(dayBefore).toHaveLength(0);
  });

  it("is idempotent when the same rows are inserted twice", async () => {
    await upsertSeries(sql, {
      id: "test_idem",
      name: "Idempotency",
      source: "test",
      unit: "x",
      frequency: "daily",
      metadata: {},
    });
    const row = {
      series_id: "test_idem",
      obs_date: "2024-01-01",
      value: 1,
      published_at: "2024-01-02T00:00:00.000Z",
      source_url: null,
    };
    await insertObservations(sql, [row]);
    await insertObservations(sql, [row]);
    const [count] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM observations WHERE series_id = 'test_idem'
    `;
    expect(count.n).toBe(1);
  });
});

describeDb("ingestion", () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = createDb(url as string);
    await runMigrations(sql);
  });

  beforeEach(async () => {
    await sql`TRUNCATE observations, series CASCADE`;
  });

  afterAll(async () => {
    await sql?.end();
  });

  it("loads new periods once and records revisions as new vintages", async () => {
    const now = new Date("2024-03-01T00:00:00.000Z");
    const makeFetch = (value: number) =>
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          serie: [{ fecha: "2024-01-01T03:00:00.000Z", valor: value }],
        }),
      })) as unknown as typeof fetch;

    const first = await ingestSeries(sql, {
      seriesId: "ipc",
      prefer: "mindicador",
      fetchImpl: makeFetch(0.2),
      now,
    });
    expect(first.inserted).toBe(1);
    expect(first.revisions).toBe(0);

    const second = await ingestSeries(sql, {
      seriesId: "ipc",
      prefer: "mindicador",
      fetchImpl: makeFetch(0.2),
      now,
    });
    expect(second.inserted).toBe(0);
    expect(second.unchanged).toBe(1);

    const revisedNow = new Date("2024-03-15T00:00:00.000Z");
    const third = await ingestSeries(sql, {
      seriesId: "ipc",
      prefer: "mindicador",
      fetchImpl: makeFetch(0.4),
      now: revisedNow,
    });
    expect(third.inserted).toBe(1);
    expect(third.revisions).toBe(1);

    const before = await getObservations(sql, {
      seriesId: "ipc",
      asOf: "2024-02-10",
    });
    expect(before[0].value).toBeCloseTo(0.2);

    const after = await getObservations(sql, {
      seriesId: "ipc",
      asOf: "2024-03-20",
    });
    expect(after[0].value).toBeCloseTo(0.4);
  });
});
