import { getDb } from "@/lib/db";
import { guard, json, optionsResponse, serverError } from "@/lib/http";
import { listSeries, searchSeries } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const sql = getDb();
    const limited = await guard(request, sql, "series");
    if (limited) return limited;

    const query = new URL(request.url).searchParams.get("q")?.trim();
    const series = query
      ? await searchSeries(sql, query)
      : await listSeries(sql);
    return json({ count: series.length, series });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : String(error));
  }
}

export { optionsResponse as OPTIONS } from "@/lib/http";
