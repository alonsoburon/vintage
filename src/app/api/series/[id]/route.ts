import { getDb } from "@/lib/db";
import {
  guard,
  json,
  notFound,
  optionsResponse,
  serverError,
} from "@/lib/http";
import { getObservations, getSeries } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sql = getDb();
    const limited = await guard(request, sql, "series");
    if (limited) return limited;

    const { id } = await context.params;
    const series = await getSeries(sql, id);
    if (!series) return notFound(`Unknown series: ${id}`);
    const observations = await getObservations(sql, {
      seriesId: id,
      limit: 5_000,
    });
    return json({ series, observations });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : String(error));
  }
}

export { optionsResponse as OPTIONS } from "@/lib/http";
