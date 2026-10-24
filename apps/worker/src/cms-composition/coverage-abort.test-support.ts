/**
 * A quota seam that lets every quota through and aborts the caller one microtask hop AFTER the
 * quota helper's own final `signal.aborted` check, so the route's own post-admission abort check
 * is the one that has to answer 504 (the abort arrives as a promise continuation, as an upstream
 * fetch rejection handler would deliver it).
 */
export const abortAfterQuota =
  (controller: AbortController) =>
  async (input: {
    limit: number;
    rateScope: 'user' | 'party';
  }): Promise<{
    ok: true;
    value: {
      allowed: true;
      limit: number;
      remaining: number;
      resetAt: number;
    };
  }> => {
    const answer = {
      ok: true as const,
      value: {
        allowed: true as const,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: 61,
      },
    };
    if (input.rateScope === 'party')
      void Promise.resolve()
        .then(() => undefined)
        .then(() => controller.abort());
    return answer;
  };
