import { getSourceCredentials } from "@/lib/config";
import { getDb } from "@/lib/db";
import { json, serverError } from "@/lib/http";
import { ingestAll } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getDb();
    const results = await ingestAll(sql, {
      credentials: getSourceCredentials(),
    });
    const inserted = results.reduce((total, result) => total + result.inserted, 0);
    const failed = results.filter((result) => result.error);
    return json({
      ran_at: new Date().toISOString(),
      inserted,
      failed: failed.length,
      results,
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : String(error));
  }
}
