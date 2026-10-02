import { authError } from '../authentication/boundary';
import type { AuthProductionConfiguration } from '../authentication/production-configuration';
import type { AuthenticationResult } from '../authentication/types';

export type FactorRemovalOutcome = Readonly<{
  providerFactorId: string;
  outcome: 'absent' | 'failed' | 'removed';
}>;

const TIMEOUT_MS = 5_000;
const BREAKER_THRESHOLD = 5;
const BREAKER_WINDOW_MS = 60_000;

/**
 * Operator-only Supabase Auth admin adapter (BE01a seam table). It is
 * reachable only from the CFG-05B-06 port, authenticates with the service
 * credential and never with a caller token, makes one attempt per factor with
 * no retry after send, and shares a 5-failures-in-60-seconds breaker.
 */
export const createOperatorFactorRemover = (
  config: AuthProductionConfiguration,
  credentials: Readonly<{ headers: Readonly<Record<string, string>> }>,
) => {
  let failures: number[] = [];
  let openUntil = 0;

  const recordFailure = (): void => {
    const now = config.now();
    failures = [...failures, now].filter((at) => now - at < BREAKER_WINDOW_MS);
    if (failures.length >= BREAKER_THRESHOLD) {
      openUntil = now + BREAKER_WINDOW_MS;
      failures = [];
    }
  };

  const removeOne = async (
    authUserId: string,
    providerFactorId: string,
    signal: AbortSignal,
  ): Promise<FactorRemovalOutcome['outcome']> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const relay = (): void => controller.abort();
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', relay, { once: true });
    try {
      const response = await config.fetchImpl(
        `${config.baseUrl}/auth/v1/admin/users/${authUserId}/factors/${providerFactorId}`,
        {
          method: 'DELETE',
          signal: controller.signal,
          headers: { accept: 'application/json', ...credentials.headers },
        },
      );
      if (response.status >= 200 && response.status < 300) return 'removed';
      if (response.status === 404) return 'absent';
      recordFailure();
      return 'failed';
    } catch {
      recordFailure();
      return 'failed';
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', relay);
    }
  };

  const removeAll = async (
    authUserId: string,
    providerFactorIds: readonly string[],
    signal: AbortSignal,
  ): Promise<AuthenticationResult<readonly FactorRemovalOutcome[]>> => {
    if (config.now() < openUntil)
      return authError(
        503,
        'IDENTITY_UNAVAILABLE',
        'The identity service is temporarily unavailable.',
      );
    const outcomes: FactorRemovalOutcome[] = [];
    for (const providerFactorId of providerFactorIds) {
      outcomes.push({
        providerFactorId,
        outcome:
          config.now() < openUntil
            ? 'failed'
            : await removeOne(authUserId, providerFactorId, signal),
      });
    }
    return { ok: true, value: outcomes };
  };

  return { removeAll };
};
