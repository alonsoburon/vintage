import type { SourceCredentials } from "./sources/types";

export function getSourceCredentials(): SourceCredentials {
  return {
    token: process.env.BCCH_TOKEN || undefined,
    user: process.env.BCCH_USER || undefined,
    pass: process.env.BCCH_PASS || undefined,
  };
}

export function hasBcchCredentials(
  credentials: SourceCredentials = getSourceCredentials(),
): boolean {
  return Boolean(
    credentials.token || (credentials.user && credentials.pass),
  );
}

export const SERIES_BACKFILL_START = "1996-01-01";
export const TRIMMED_MAX_OBS = 5_000;
