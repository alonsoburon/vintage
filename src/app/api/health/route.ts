import { getDb } from "@/lib/db";
import { json, optionsResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql<{ ok: number }[]>`SELECT 1 AS ok`;
    return json({
      status: "ok",
      database: rows[0]?.ok === 1 ? "up" : "unknown",
      time: new Date().toISOString(),
    });
  } catch (error) {
    return json(
      {
        status: "degraded",
        database: "down",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}

export { optionsResponse as OPTIONS } from "@/lib/http";
