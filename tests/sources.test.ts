import { describe, expect, it, vi } from "vitest";
import { bcchSource, buildBcchUrl, parseBcchDate } from "@/lib/sources/bcch";
import { parseIneCsv, parseNumeric } from "@/lib/sources/ine";
import { mindicadorSource } from "@/lib/sources/mindicador";
import { requireSeriesDefinition } from "@/lib/series";

describe("parseBcchDate", () => {
  it("converts dd-mm-yyyy to ISO", () => {
    expect(parseBcchDate("12-10-2021")).toBe("2021-10-12");
  });

  it("rejects malformed dates", () => {
    expect(parseBcchDate("2021-10-12")).toBeNull();
    expect(parseBcchDate("")).toBeNull();
  });
});

describe("buildBcchUrl", () => {
  const definition = requireSeriesDefinition("tpm");

  it("uses a token when present", () => {
    const url = buildBcchUrl(definition, {
      from: "2024-01-01",
      to: "2024-01-31",
      credentials: { token: "abc" },
    });
    expect(url).toContain("token=abc");
    expect(url).toContain("timeseries=F022.TPM.TIN.D001.NO.Z.D");
    expect(url).toContain("firstdate=2024-01-01");
  });

  it("falls back to user/password", () => {
    const url = buildBcchUrl(definition, {
      credentials: { user: "a@b.cl", pass: "secret" },
    });
    expect(url).toContain("user=a%40b.cl");
    expect(url).toContain("pass=secret");
  });

  it("throws without credentials", () => {
    expect(() => buildBcchUrl(definition, {})).toThrow(/BCCH_TOKEN/);
  });
});

describe("bcchSource", () => {
  it("never leaks credentials into source_url", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        Codigo: 0,
        Series: {
          Obs: [
            { indexDateString: "12-10-2021", value: "1.5", statusCode: "OK" },
            { indexDateString: "13-10-2021", value: "NaN", statusCode: "ND" },
          ],
        },
      }),
    })) as unknown as typeof fetch;

    const rows = await bcchSource.fetchSeries(requireSeriesDefinition("tpm"), {
      credentials: { token: "super-secret-token" },
      fetchImpl,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].sourceUrl).not.toContain("super-secret-token");
    expect(rows[0].sourceUrl).not.toContain("token=");
  });
});

describe("parseNumeric", () => {
  it("parses Latin American and US number formats", () => {
    expect(parseNumeric("1.234,5")).toBeCloseTo(1234.5);
    expect(parseNumeric("1234.5")).toBeCloseTo(1234.5);
    expect(parseNumeric("8,44")).toBeCloseTo(8.44);
    expect(parseNumeric("-")).toBeNull();
  });
});

describe("parseIneCsv", () => {
  it("parses a semicolon separated CSV", () => {
    const csv = [
      "Mes;Tasa;Otro",
      "01/03/2024;8,4;x",
      "01/04/2024;8,7;y",
    ].join("\n");
    const rows = parseIneCsv(
      csv,
      { dateColumn: "Mes", valueColumn: "Tasa" },
      "https://example.test/ine.csv",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      obsDate: "2024-03-01",
      value: 8.4,
      sourceUrl: "https://example.test/ine.csv",
    });
  });
});

describe("mindicadorSource", () => {
  it("normalises the serie payload and filters by date", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        serie: [
          { fecha: "2024-02-01T03:00:00.000Z", valor: 1 },
          { fecha: "2024-03-01T03:00:00.000Z", valor: 2 },
          { fecha: "2024-04-01T03:00:00.000Z", valor: "3" },
        ],
      }),
    })) as unknown as typeof fetch;

    const rows = await mindicadorSource.fetchSeries(
      requireSeriesDefinition("ipc"),
      { from: "2024-02-15", fetchImpl },
    );

    expect(rows).toEqual([
      {
        obsDate: "2024-03-01",
        value: 2,
        sourceUrl: "https://mindicador.cl/api/ipc",
      },
      {
        obsDate: "2024-04-01",
        value: 3,
        sourceUrl: "https://mindicador.cl/api/ipc",
      },
    ]);
  });
});
