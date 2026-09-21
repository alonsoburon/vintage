import { json, optionsResponse } from "@/lib/http";
import { LIMITS } from "@/lib/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({
    name: "vintage",
    description:
      "Point-in-time (vintage) macroeconomic data for Chile. Open, no authentication required.",
    docs: "https://github.com/alonsoburon/vintage#api",
    mcp: "/api/mcp",
    limits: {
      burst_per_minute: LIMITS.burstPerMinute,
      daily_requests_per_ip: LIMITS.dailyPerIp,
      daily_requests_global: LIMITS.dailyGlobal,
      max_limit: 20_000,
      exceeded_status: 429,
    },
    endpoints: [
      {
        method: "GET",
        path: "/api/health",
        description: "Service and database health.",
      },
      {
        method: "GET",
        path: "/api/series",
        description: "List series. Use ?q= to search by id, name or source.",
      },
      {
        method: "GET",
        path: "/api/series/{id}",
        description: "Series metadata plus its latest observations.",
      },
      {
        method: "GET",
        path: "/api/series/{id}/observations",
        description:
          "Observations. Query params: from, to, as_of, history, limit, offset, format (json|csv).",
      },
      {
        method: "GET",
        path: "/api/series/{id}/vintages",
        description: "Every publication date (vintage) archived for the series.",
      },
    ],
  });
}

export { optionsResponse as OPTIONS } from "@/lib/http";
