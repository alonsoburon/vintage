interface Bucket {
  count: number;
  reset: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
}

/**
 * Best-effort, in-memory fixed-window rate limiter.
 *
 * On serverless platforms each instance keeps its own counters, so this is a
 * polite abuse guard rather than a strict global quota. For hard guarantees,
 * put a dedicated limiter (e.g. Upstash Redis) in front of the API.
 */
export function checkRateLimit(
  key: string,
  limit = 120,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();

  if (buckets.size > 5_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.reset <= now) buckets.delete(bucketKey);
    }
  }

  const existing = buckets.get(key);
  if (!existing || existing.reset <= now) {
    const reset = now + windowMs;
    buckets.set(key, { count: 1, reset });
    return { ok: true, limit, remaining: limit - 1, reset, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      ok: false,
      limit,
      remaining: 0,
      reset: existing.reset,
      retryAfter: Math.max(1, Math.ceil((existing.reset - now) / 1000)),
    };
  }

  return {
    ok: true,
    limit,
    remaining: limit - existing.count,
    reset: existing.reset,
    retryAfter: 0,
  };
}

export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}
