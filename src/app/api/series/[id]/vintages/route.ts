import { getDb } from "@/lib/db";
import {
  guard,
  json,
  notFound,
  optionsResponse,
  serverError,
} from "@/lib/http";
import { getSeries, getVintages } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sql = getDb();
    const limited = await guard(request, sql, "vintages");
    if (limited) return limited;

    const { id } = await context.params;
    const series = await getSeries(sql, id);
    if (!series) return notFound(`Unknown series: ${id}`);
    const vintages = await getVintages(sql, id);
    return json({ series, count: vintages.length, vintages });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : String(error));
  }
}

export { optionsResponse as OPTIONS } from "@/lib/http";
