export type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "annual";

export interface SeriesRecord {
  id: string;
  name: string;
  source: string;
  unit: string;
  frequency: Frequency;
  metadata: Record<string, unknown>;
}

export interface SeriesSummary extends SeriesRecord {
  observations: number;
  vintages: number;
  first_obs: string | null;
  last_obs: string | null;
  last_published_at: string | null;
}

export interface ObservationRecord {
  series_id: string;
  obs_date: string;
  value: number;
  published_at: string;
  source_url: string | null;
}

export interface VintageRecord {
  published_at: string;
  observations: number;
}

export interface ObservationQuery {
  seriesId: string;
  from?: string | null;
  to?: string | null;
  asOf?: string | null;
  limit?: number;
  offset?: number;
}
