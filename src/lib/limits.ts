import { createHash } from "node:crypto";
import type { Sql } from "./db";
import { checkRateLimit, clientKey } from "./ratelimit";

function intFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/**
 * Public, no-auth API policies. The burst limit is enforced in memory per
 * instance; the daily quotas are enforced atomically in Postgres so they hold
 * across every serverless instance.
 */
export const LIMITS = {
  burstPerMinute: intFromEnv("RATE_LIMIT_PER_MINUTE", 5),
  dailyPerIp: intFromEnv("RATE_LIMIT_PER_DAY_IP", 100),
  dailyGlobal: intFromEnv("RATE_LIMIT_PER_DAY_GLOBAL", 20_000),
};

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function hashIp(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? "vintage";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function secondsUntilUtcMidnight(now = new Date()): number {
  const tomorrow = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((tomorrow - now.getTime()) / 1000));
}

interface QuotaRow {
  ip_count: number;
  global_count: number;
}

/**
 * Consumes one unit of the per-IP and global daily quotas in a single atomic
 * round trip. Returns the resulting counters.
 */
async function consumeDailyQuota(sql: Sql, ip: string): Promise<QuotaRow> {
  const day = utcDay();
  const ipBucket = `ip:${hashIp(ip)}:${day}`;
  const globalBucket = `global:${day}`;

  const rows = await sql<QuotaRow[]>`
    WITH ip AS (
      INSERT INTO api_usage (bucket, count)
      VALUES (${ipBucket}, 1)
      ON CONFLICT (bucket) DO UPDATE SET count = api_usage.count + 1
      RETURNING count
    ), global AS (
      INSERT INTO api_usage (bucket, count)
      VALUES (${globalBucket}, 1)
      ON CONFLICT (bucket) DO UPDATE SET count = api_usage.count + 1
      RETURNING count
    )
    SELECT
      (SELECT count FROM ip)::int AS ip_count,
      (SELECT count FROM global)::int AS global_count
  `;

  return rows[0] ?? { ip_count: 1, global_count: 1 };
}

export interface LimitDecision {
  allowed: boolean;
  scope: string;
  reason?: "burst" | "daily_ip" | "daily_global";
  retryAfter: number;
  limit: number;
  ipCount: number;
  globalCount: number;
}

export async function enforceLimits(
  request: Request,
  sql: Sql | null,
  scope: string,
  overrides: Partial<typeof LIMITS> = {},
): Promise<LimitDecision> {
  const policy = { ...LIMITS, ...overrides };

  const burst = checkRateLimit(
    clientKey(request, scope),
    policy.burstPerMinute,
    60_000,
  );
  if (!burst.ok) {
    return {
      allowed: false,
      scope,
      reason: "burst",
      retryAfter: burst.retryAfter,
      limit: burst.limit,
      ipCount: 0,
      globalCount: 0,
    };
  }

  if (sql) {
    try {
      const counts = await consumeDailyQuota(sql, clientIp(request));
      if (counts.global_count > policy.dailyGlobal) {
        return {
          allowed: false,
          scope,
          reason: "daily_global",
          retryAfter: secondsUntilUtcMidnight(),
          limit: policy.dailyGlobal,
          ipCount: counts.ip_count,
          globalCount: counts.global_count,
        };
      }
      if (counts.ip_count > policy.dailyPerIp) {
        return {
          allowed: false,
          scope,
          reason: "daily_ip",
          retryAfter: secondsUntilUtcMidnight(),
          limit: policy.dailyPerIp,
          ipCount: counts.ip_count,
          globalCount: counts.global_count,
        };
      }
      return {
        allowed: true,
        scope,
        retryAfter: 0,
        limit: policy.dailyPerIp,
        ipCount: counts.ip_count,
        globalCount: counts.global_count,
      };
    } catch {
      // Fail open: a quota-table hiccup must not take the API down.
    }
  }

  return {
    allowed: true,
    scope,
    retryAfter: 0,
    limit: policy.burstPerMinute,
    ipCount: 0,
    globalCount: 0,
  };
}
