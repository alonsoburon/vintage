import type { Frequency } from "./types";

export function isFrequency(value: string): value is Frequency {
  return ["daily", "weekly", "monthly", "quarterly", "annual"].includes(value);
}

export function endOfPeriod(date: string, frequency: Frequency): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();

  switch (frequency) {
    case "daily":
      return date;
    case "weekly": {
      const day = d.getUTCDay();
      const daysToSunday = (7 - day) % 7;
      d.setUTCDate(d.getUTCDate() + daysToSunday);
      break;
    }
    case "monthly":
      d.setUTCDate(new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
      break;
    case "quarterly": {
      const quarterEndMonth = Math.floor(month / 3) * 3 + 2;
      d.setUTCMonth(quarterEndMonth);
      d.setUTCDate(new Date(Date.UTC(year, quarterEndMonth + 1, 0)).getUTCDate());
      break;
    }
    case "annual":
      d.setUTCMonth(11);
      d.setUTCDate(31);
      break;
  }

  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Reconstructs an approximate publication timestamp for an observation whose
 * source does not expose a release date. The date is the end of the reference
 * period plus a per-series publication lag, clamped to "now" so a vintage can
 * never appear to come from the future.
 */
export function reconstructPublishedAt(
  obsDate: string,
  frequency: Frequency,
  lagDays: number,
  now: Date = new Date(),
): string {
  const release = addDays(endOfPeriod(obsDate, frequency), lagDays);
  const releaseMs = Date.parse(`${release}T00:00:00.000Z`);
  if (Number.isNaN(releaseMs) || releaseMs > now.getTime()) {
    return now.toISOString();
  }
  return new Date(releaseMs).toISOString();
}

/**
 * Normalises an `as_of` input into an inclusive upper bound timestamp.
 * A date-only value (`2024-02-05`) is interpreted as the end of that day so
 * date-level queries are inclusive; a full timestamp is used as-is.
 */
export function normalizeAsOf(asOf: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    return `${asOf}T23:59:59.999Z`;
  }
  const parsed = new Date(asOf);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid as_of value: ${asOf}`);
  }
  return parsed.toISOString();
}
