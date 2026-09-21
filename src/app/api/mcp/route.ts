import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { guard, optionsResponse } from "@/lib/http";
import {
  getObservations,
  getSeries,
  listSeries,
  searchSeries,
} from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function text(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_series",
      {
        title: "List series",
        description:
          "List every macroeconomic series archived in vintage, with coverage and vintage counts.",
        inputSchema: z.object({}),
      },
      async () => {
        const series = await listSeries(getDb());
        return text({ count: series.length, series });
      },
    );

    server.registerTool(
      "search_series",
      {
        title: "Search series",
        description: "Search series by id, name or source (case-insensitive).",
        inputSchema: z.object({
          query: z.string().min(1).describe("Free-text search term, e.g. 'ipc'"),
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .optional()
            .describe("Maximum number of matches (default 10)"),
        }),
      },
      async ({ query, limit }) => {
        const matches = await searchSeries(getDb(), query);
        const max = limit ?? 10;
        return text({ count: Math.min(matches.length, max), series: matches.slice(0, max) });
      },
    );

    server.registerTool(
      "get_series",
      {
        title: "Get series",
        description: "Metadata, coverage and vintage count for a single series.",
        inputSchema: z.object({
          series_id: z.string().describe("Series id, e.g. 'ipc'"),
        }),
      },
      async ({ series_id }) => {
        const series = await getSeries(getDb(), series_id);
        if (!series) {
          return {
            content: [{ type: "text" as const, text: `Unknown series: ${series_id}` }],
            isError: true,
          };
        }
        return text(series);
      },
    );

    server.registerTool(
      "get_observations",
      {
        title: "Get observations",
        description:
          "Point-in-time observations for a series. With as_of, each reference period returns the value known on that date (the row with the greatest published_at <= as_of), i.e. the vintage as published.",
        inputSchema: z.object({
          series_id: z.string().describe("Series id, e.g. 'ipc'"),
          as_of: z
            .string()
            .optional()
            .describe("ISO date or timestamp; only data published on or before it is used"),
          from: z.string().optional().describe("YYYY-MM-DD lower bound on the reference period"),
          to: z.string().optional().describe("YYYY-MM-DD upper bound on the reference period"),
          limit: z
            .number()
            .int()
            .min(1)
            .max(5000)
            .optional()
            .describe("Maximum number of observations to return (default 500)"),
        }),
      },
      async ({ series_id, as_of, from, to, limit }) => {
        const sql = getDb();
        const series = await getSeries(sql, series_id);
        if (!series) {
          return {
            content: [{ type: "text" as const, text: `Unknown series: ${series_id}` }],
            isError: true,
          };
        }
        const max = limit ?? 500;
        const observations = await getObservations(sql, {
          seriesId: series_id,
          asOf: as_of ?? null,
          from: from ?? null,
          to: to ?? null,
          limit: max,
        });
        return text({
          series_id,
          as_of: as_of ?? null,
          count: observations.length,
          observations,
        });
      },
    );
  },
  {
    serverInfo: { name: "vintage", version: "0.1.0" },
    instructions:
      "Point-in-time (vintage) macroeconomic data for Chile, from the Banco Central de Chile and INE. Use get_observations with as_of to retrieve a series exactly as it was known on a given date, which avoids look-ahead bias in backtests.",
  },
);

async function guarded(request: Request): Promise<Response> {
  try {
    const limited = await guard(request, getDb(), "mcp", {
      burstPerMinute: 300,
    });
    if (limited) return limited;
  } catch {
    // If the database is unreachable, still serve the MCP handshake.
  }
  return handler(request);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
export { optionsResponse as OPTIONS } from "@/lib/http";
