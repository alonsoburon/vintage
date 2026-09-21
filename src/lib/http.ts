import type { Sql } from "./db";
import { enforceLimits, LIMITS } from "./limits";
import { checkRateLimit, clientKey } from "./ratelimit";

export const MAX_LIMIT = 20_000;
export const DEFAULT_LIMIT = 1_000;

export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, mcp-protocol-version",
  "access-control-max-age": "86400",
};

export const JSON_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...CORS_HEADERS,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

export function badRequest(message: string): Response {
  return json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found"): Response {
  return json({ error: message }, { status: 404 });
}

export function serverError(message = "Internal server error"): Response {
  return json({ error: message }, { status: 500 });
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function tooManyRequests(
  retryAfter: number,
  limit: number,
  reason = "rate_limit",
): Response {
  return json(
    {
      error: "Límite de uso excedido. Intenta de nuevo más tarde.",
      reason,
      limit,
      retry_after: retryAfter,
    },
    {
      status: 429,
      headers: {
        "retry-after": String(retryAfter),
        "x-ratelimit-limit": String(limit),
        "x-ratelimit-remaining": "0",
      },
    },
  );
}

/**
 * Enforces the public API policy for a request: an in-memory burst limit plus
 * hard, cross-instance daily quotas stored in Postgres. Returns a 429 response
 * when the caller is over budget, or `null` when it may proceed.
 */
export async function guard(
  request: Request,
  sql: Sql | null,
  scope: string,
  overrides: Partial<typeof LIMITS> = {},
): Promise<Response | null> {
  const decision = await enforceLimits(request, sql, scope, overrides);
  if (decision.allowed) return null;
  return tooManyRequests(decision.retryAfter, decision.limit, decision.reason);
}

// Re-exported for callers that only need the cheap in-memory burst check.
export { checkRateLimit, clientKey };

export function parseLimit(
  value: string | null,
  fallback = DEFAULT_LIMIT,
  max = MAX_LIMIT,
): { ok: true; value: number } | { ok: false; error: string } {
  if (value === null || value === "") return { ok: true, value: fallback };
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return { ok: false, error: "limit must be a positive integer" };
  }
  return { ok: true, value: Math.min(parsed, max) };
}

export function parseOffset(
  value: string | null,
): { ok: true; value: number } | { ok: false; error: string } {
  if (value === null || value === "") return { ok: true, value: 0 };
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { ok: false, error: "offset must be a non-negative integer" };
  }
  return { ok: true, value: parsed };
}

export function parseDateParam(
  value: string | null,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null || value === "") return { ok: true, value: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: true, value };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: `Invalid date: ${value}` };
  }
  return { ok: true, value };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: ReadonlyArray<object>, columns: string[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    const record = row as Record<string, unknown>;
    lines.push(columns.map((column) => csvCell(record[column])).join(","));
  }
  return lines.join("\n");
}

export function csvResponse(body: string): Response {
  return new Response(`${body}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": "no-store",
      ...CORS_HEADERS,
    },
  });
}
