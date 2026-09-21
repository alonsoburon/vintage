import { describe, expect, it } from "vitest";
import {
  addDays,
  endOfPeriod,
  normalizeAsOf,
  reconstructPublishedAt,
} from "@/lib/dates";

describe("endOfPeriod", () => {
  it("returns the same day for daily series", () => {
    expect(endOfPeriod("2024-02-05", "daily")).toBe("2024-02-05");
  });

  it("returns the last day of the month", () => {
    expect(endOfPeriod("2024-02-10", "monthly")).toBe("2024-02-29");
    expect(endOfPeriod("2023-02-10", "monthly")).toBe("2023-02-28");
    expect(endOfPeriod("2024-11-01", "monthly")).toBe("2024-11-30");
  });

  it("returns the last day of the quarter", () => {
    expect(endOfPeriod("2024-01-01", "quarterly")).toBe("2024-03-31");
    expect(endOfPeriod("2024-04-01", "quarterly")).toBe("2024-06-30");
    expect(endOfPeriod("2024-10-01", "quarterly")).toBe("2024-12-31");
  });
});

describe("reconstructPublishedAt", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("adds the release lag to the end of the reference period", () => {
    expect(reconstructPublishedAt("2024-01-01", "monthly", 5, now)).toBe(
      "2024-02-05T00:00:00.000Z",
    );
  });

  it("clamps to now when the reconstructed date is in the future", () => {
    expect(reconstructPublishedAt("2099-01-01", "daily", 1, now)).toBe(
      now.toISOString(),
    );
  });
});

describe("normalizeAsOf", () => {
  it("treats a date-only value as the end of that day", () => {
    expect(normalizeAsOf("2024-02-05")).toBe("2024-02-05T23:59:59.999Z");
  });

  it("passes through timestamps", () => {
    expect(normalizeAsOf("2024-02-05T12:00:00.000Z")).toBe(
      "2024-02-05T12:00:00.000Z",
    );
  });

  it("throws on invalid input", () => {
    expect(() => normalizeAsOf("not-a-date")).toThrow();
  });
});

describe("addDays", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2024-02-28", 2)).toBe("2024-03-01");
    expect(addDays("2024-01-01", -1)).toBe("2023-12-31");
  });
});
