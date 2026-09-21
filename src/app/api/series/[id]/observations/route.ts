import { getDb } from "@/lib/db";
import {
  badRequest,
  csvResponse,
  guard,
  json,
  notFound,
  optionsResponse,
  parseLimit,
  parseOffset,
  serverError,
  toCsv,
} from "@/lib/http";
import {
  getObservationHistory,
  getObservations,
  getSeries,
} from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CSV_COLUMNS = [
  "series_id",
  "obs_date",
  "value",
  "published_at",
  "source_url",
];

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sql = getDb();
    const limited = await guard(request, sql, "observations");
    if (limited) return limited;

    const { id } = await context.params;
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const asOf = url.searchParams.get("as_of");
    const history = url.searchParams.get("history") === "true";
    const format = (url.searchParams.get("format") ?? "json").toLowerCase();

    if (format !== "json" && format !== "csv") {
      return badRequest("format must be 'json' or 'csv'");
    }

    for (const [name, value] of [
      ["from", from],
      ["to", to],
    ] as const) {
      if (value && !DATE_RE.test(value)) {
        return badRequest(`${name} must be formatted as YYYY-MM-DD`);
      }
    }

    const limit = parseLimit(
      url.searchParams.get("limit"),
      history ? 5_000 : 1_000,
    );
    if (!limit.ok) return badRequest(limit.error);
    const offset = parseOffset(url.searchParams.get("offset"));
    if (!offset.ok) return badRequest(offset.error);

    const series = await getSeries(sql, id);
    if (!series) return notFound(`Unknown series: ${id}`);

    const observations = history
      ? await getObservationHistory(sql, {
          seriesId: id,
          from,
          to,
          limit: limit.value,
          offset: offset.value,
        })
      : await getObservations(sql, {
          seriesId: id,
          from,
          to,
          asOf,
          limit: limit.value,
          offset: offset.value,
        });

    if (format === "csv") {
      return csvResponse(toCsv(observations, CSV_COLUMNS));
    }

    return json({
      series,
      as_of: asOf ?? null,
      from: from ?? null,
      to: to ?? null,
      history,
      limit: limit.value,
      offset: offset.value,
      count: observations.length,
      observations,
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : String(error));
  }
}

export { optionsResponse as OPTIONS } from "@/lib/http";
