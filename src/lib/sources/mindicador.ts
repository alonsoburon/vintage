import type { RawObservation, SourceAdapter, FetchOptions } from "./types";
import type { SeriesDefinition } from "../series";

const ENDPOINT = "https://mindicador.cl/api";

/**
 * Keyless reference source for Chilean indicators. It republishes the latest
 * values (and a short history) for a curated set of series. It does not expose
 * release dates, so `published_at` is reconstructed by the ingestion layer.
 *
 * API docs: https://mindicador.cl/api
 */
export const mindicadorSource: SourceAdapter = {
  name: "mindicador",

  async fetchSeries(
    definition: SeriesDefinition,
    options: FetchOptions = {},
  ): Promise<RawObservation[]> {
    const code = definition.metadata.mindicador;
    if (!code) return [];

    const url = `${ENDPOINT}/${code}`;
    const doFetch = options.fetchImpl ?? fetch;
    const response = await doFetch(url, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`mindicador: ${code} responded with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      serie?: Array<{ fecha?: string; valor?: number | string }>;
    };
    const serie = Array.isArray(payload.serie) ? payload.serie : [];

    const observations: RawObservation[] = [];
    for (const point of serie) {
      const obsDate = String(point.fecha ?? "").slice(0, 10);
      const value = Number(point.valor);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(obsDate) || !Number.isFinite(value)) {
        continue;
      }
      if (options.from && obsDate < options.from) continue;
      if (options.to && obsDate > options.to) continue;
      observations.push({ obsDate, value, sourceUrl: url });
    }

    return observations;
  },
};
