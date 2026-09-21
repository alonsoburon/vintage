import type { RawObservation, SourceAdapter, FetchOptions } from "./types";
import type { SeriesDefinition } from "../series";

export const BCCH_ENDPOINT =
  "https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx";

export function parseBcchDate(value: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

export function buildBcchUrl(
  definition: SeriesDefinition,
  options: FetchOptions = {},
): string {
  const code = definition.metadata.bcch;
  if (!code) {
    throw new Error(`Series ${definition.id} has no BCCh code configured`);
  }

  const { token, user, pass } = options.credentials ?? {};
  const params = new URLSearchParams();
  params.set("function", "GetSeries");
  params.set("timeseries", code);
  if (options.from) params.set("firstdate", options.from);
  if (options.to) params.set("lastdate", options.to);

  if (token) {
    params.set("token", token);
  } else if (user && pass) {
    params.set("user", user);
    params.set("pass", pass);
  } else {
    throw new Error(
      "BCCh requires BCCH_TOKEN or BCCH_USER + BCCH_PASS environment variables",
    );
  }

  return `${BCCH_ENDPOINT}?${params.toString()}`;
}

interface BcchResponse {
  Codigo?: number;
  Descripcion?: string;
  Series?: {
    Obs?: Array<{
      indexDateString?: string;
      value?: string | number;
      statusCode?: string;
    }>;
  } | null;
}

/**
 * Authoritative source: the Banco Central de Chile statistical database (BDE)
 * REST API. Requires a personal token (or user/password). See
 * https://si3.bcentral.cl/estadisticas/Principal1/Web_Services/documentacion_en.html
 */
export const bcchSource: SourceAdapter = {
  name: "bcch",

  async fetchSeries(
    definition: SeriesDefinition,
    options: FetchOptions = {},
  ): Promise<RawObservation[]> {
    const url = buildBcchUrl(definition, options);
    const doFetch = options.fetchImpl ?? fetch;
    const response = await doFetch(url, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`BCCh responded with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as BcchResponse;
    if (typeof payload.Codigo === "number" && payload.Codigo !== 0) {
      throw new Error(
        `BCCh error ${payload.Codigo}: ${payload.Descripcion ?? "unknown error"}`,
      );
    }

    const raw = payload.Series?.Obs ?? [];
    const observations: RawObservation[] = [];
    for (const point of raw) {
      if (point.statusCode && point.statusCode !== "OK") continue;
      const obsDate = parseBcchDate(String(point.indexDateString ?? ""));
      const value = Number(point.value);
      if (!obsDate || !Number.isFinite(value)) continue;
      if (options.from && obsDate < options.from) continue;
      if (options.to && obsDate > options.to) continue;
      // Never persist the credentialed request URL: it contains the API token.
      observations.push({ obsDate, value, sourceUrl: definition.sourceUrl });
    }

    return observations;
  },
};
