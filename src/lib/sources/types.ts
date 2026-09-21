import type { SeriesDefinition } from "../series";

export interface RawObservation {
  /** Reference period start, `YYYY-MM-DD`. */
  obsDate: string;
  value: number;
  /** ISO timestamp, only when the source exposes a real release date. */
  publishedAt?: string;
  sourceUrl: string;
}

export interface SourceCredentials {
  user?: string;
  pass?: string;
  token?: string;
}

export interface FetchOptions {
  from?: string;
  to?: string;
  credentials?: SourceCredentials;
  fetchImpl?: typeof fetch;
}

export interface SourceAdapter {
  readonly name: string;
  fetchSeries(
    definition: SeriesDefinition,
    options?: FetchOptions,
  ): Promise<RawObservation[]>;
}
