import type { RawObservation, SourceAdapter, FetchOptions } from "./types";
import type { SeriesDefinition } from "../series";

export interface IneCsvConfig {
  url: string;
  dateColumn: string;
  valueColumn: string;
  delimiter?: string;
}

export function parseDelimiter(line: string, fallback = ","): string {
  const candidates = [";", ",", "\t"];
  let best = fallback;
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = line.split(candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function parseNumeric(value: string): number | null {
  const cleaned = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseIneDate(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const my = /^(\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (my) {
    const [, m, y] = my;
    return `${y}-${m.padStart(2, "0")}-01`;
  }
  return null;
}

export function parseIneCsv(
  text: string,
  config: Pick<IneCsvConfig, "dateColumn" | "valueColumn" | "delimiter">,
  sourceUrl: string,
): RawObservation[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return [];

  const delimiter = config.delimiter ?? parseDelimiter(lines[0]);
  const header = lines[0].split(delimiter).map((cell) => cell.trim().toLowerCase());
  const dateIndex = header.indexOf(config.dateColumn.toLowerCase());
  const valueIndex = header.indexOf(config.valueColumn.toLowerCase());
  if (dateIndex === -1 || valueIndex === -1) {
    throw new Error(
      `INE CSV is missing columns "${config.dateColumn}"/"${config.valueColumn}"`,
    );
  }

  const observations: RawObservation[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(delimiter);
    const obsDate = parseIneDate(cells[dateIndex] ?? "");
    const value = parseNumeric(cells[valueIndex] ?? "");
    if (!obsDate || value === null) continue;
    observations.push({ obsDate, value, sourceUrl });
  }
  return observations;
}

/**
 * Adapter for the Chilean national statistics office (INE) open-data CSV
 * exports. INE does not offer a single stable JSON API for every indicator, so
 * each series declares the CSV URL and the columns to read in its manifest.
 */
export const ineSource: SourceAdapter = {
  name: "ine",

  async fetchSeries(
    definition: SeriesDefinition,
    options: FetchOptions = {},
  ): Promise<RawObservation[]> {
    const config = definition.metadata.ine;
    if (!config) return [];

    const doFetch = options.fetchImpl ?? fetch;
    const response = await doFetch(config.url, {
      headers: { accept: "text/csv,*/*" },
    });
    if (!response.ok) {
      throw new Error(`INE CSV responded with HTTP ${response.status}`);
    }

    const text = await response.text();
    const observations = parseIneCsv(text, config, config.url);
    return observations.filter((obs) => {
      if (options.from && obs.obsDate < options.from) return false;
      if (options.to && obs.obsDate > options.to) return false;
      return true;
    });
  },
};
