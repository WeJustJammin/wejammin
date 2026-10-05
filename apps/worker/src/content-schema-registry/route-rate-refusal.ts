import type { ContentSchemaRegistryError, RateLimitDecision } from './types';

/** Largest epoch second a JavaScript Date can render (8.64e15 ms). */
export const MAX_RATE_RESET_EPOCH_SECONDS = 8_640_000_000_000;

/**
 * BE00 RATE_LIMITED. `resetAt` is the limiter's real window end rendered as an
 * RFC 3339 UTC instant, and `retryAfterSeconds` (also the `Retry-After`
 * header) is the whole seconds from now until that same reset, never less than
 * one. Both derive from `decision.resetAt`; nothing is hard coded.
 */
export const rateLimitedError = (
  decision: RateLimitDecision,
  nowMs: number,
): ContentSchemaRegistryError => {
  const retryAfterSeconds = Math.max(
    1,
    decision.resetAt - Math.floor(nowMs / 1000),
  );
  return {
    ok: false,
    status: 429,
    code: 'RATE_LIMITED',
    message: 'Too many requests.',
    details: {
      retryAfterSeconds,
      limit: decision.limit,
      resetAt: new Date(decision.resetAt * 1000).toISOString(),
    },
    retryAfterSeconds,
  };
};
