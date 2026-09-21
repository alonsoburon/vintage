export const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS series (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    source      TEXT NOT NULL,
    unit        TEXT NOT NULL,
    frequency   TEXT NOT NULL,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,

  `CREATE TABLE IF NOT EXISTS observations (
    series_id    TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    obs_date     DATE NOT NULL,
    value        DOUBLE PRECISION NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    source_url   TEXT,
    PRIMARY KEY (series_id, obs_date, published_at)
  );`,

  `CREATE INDEX IF NOT EXISTS observations_asof_idx
    ON observations (series_id, obs_date, published_at DESC);`,

  `CREATE INDEX IF NOT EXISTS observations_published_idx
    ON observations (series_id, published_at);`,

  `CREATE TABLE IF NOT EXISTS api_usage (
    bucket     TEXT PRIMARY KEY,
    count      INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,

  `CREATE INDEX IF NOT EXISTS api_usage_created_idx
    ON api_usage (created_at);`,
];
