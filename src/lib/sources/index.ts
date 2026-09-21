import { hasBcchCredentials } from "../config";
import type { SeriesDefinition } from "../series";
import { bcchSource } from "./bcch";
import { ineSource } from "./ine";
import { mindicadorSource } from "./mindicador";
import type { FetchOptions, RawObservation, SourceAdapter } from "./types";

export * from "./types";
export { bcchSource, ineSource, mindicadorSource };

export type SourceName = "bcch" | "mindicador" | "ine";

export function selectAdapter(
  definition: SeriesDefinition,
  options: FetchOptions & { prefer?: SourceName } = {},
): SourceAdapter | null {
  const prefer = options.prefer;
  if (prefer) {
    if (prefer === "bcch" && definition.metadata.bcch) return bcchSource;
    if (prefer === "mindicador" && definition.metadata.mindicador) {
      return mindicadorSource;
    }
    if (prefer === "ine" && definition.metadata.ine) return ineSource;
  }

  if (definition.metadata.bcch && hasBcchCredentials(options.credentials)) {
    return bcchSource;
  }
  if (definition.metadata.mindicador) return mindicadorSource;
  if (definition.metadata.ine) return ineSource;
  if (definition.metadata.bcch) return bcchSource;
  return null;
}

export async function fetchSeriesRaw(
  definition: SeriesDefinition,
  options: FetchOptions & { prefer?: SourceName } = {},
): Promise<{ adapter: string; observations: RawObservation[] }> {
  const adapter = selectAdapter(definition, options);
  if (!adapter) {
    throw new Error(`No source adapter is configured for series "${definition.id}"`);
  }
  const observations = await adapter.fetchSeries(definition, options);
  return { adapter: adapter.name, observations };
}
