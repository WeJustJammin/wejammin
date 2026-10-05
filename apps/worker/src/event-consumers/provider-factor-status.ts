import { mfaProviderBreakerFor } from '../authentication/mfa-provider-breaker';
import {
  MAX_RESPONSE_BYTES,
  type AuthProductionConfiguration,
} from '../authentication/production-configuration';
import { supabaseRpcHeaders } from '../supabase-rpc-headers';
import type {
  ProviderFactorStatus,
  ProviderFactorStatusPort,
} from './auth-state-reconciler';

const TIMEOUT_MS = 5_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type Listing = Readonly<{
  state: 'listed';
  status: Exclude<ProviderFactorStatus, 'unavailable'>;
}>;

const classify = (value: unknown, providerFactorId: string): Listing | null => {
  if (!Array.isArray(value)) return null;
  let status: Listing['status'] = 'absent';
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== 'string') return null;
    if (entry.id !== providerFactorId) continue;
    if (entry.status !== 'verified' && entry.status !== 'unverified')
      return null;
    status = entry.status;
  }
  return { state: 'listed', status };
};

/**
 * Operator-only Supabase Auth admin read (BE01a seam table, MFA adapter row):
 * the status poll the auth-state-reconciler uses after a post-send ambiguity.
 * It is a single credentialed `GET` of the user's factor list with the
 * service credential, never a caller token, and it can neither create nor
 * remove a provider factor. It shares the MFA provider breaker (five failures
 * in 60 seconds open for 60 seconds), so an unhealthy provider is refused by
 * every MFA adapter alike. A 404 is a definite answer, not a failure.
 */
export const createProviderFactorStatusPort = (
  config: AuthProductionConfiguration,
): ProviderFactorStatusPort => {
  const breaker = mfaProviderBreakerFor(config.fetchImpl);
  const headers = {
    accept: 'application/json',
    ...supabaseRpcHeaders(config.secret),
  };
  return {
    readStatus: async (input, signal): Promise<ProviderFactorStatus> => {
      if (breaker.isOpen(config.now())) return 'unavailable';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const relay = (): void => controller.abort();
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', relay, { once: true });
      try {
        const response = await config.fetchImpl(
          `${config.baseUrl}/auth/v1/admin/users/${input.authUserId}/factors`,
          { method: 'GET', headers, signal: controller.signal },
        );
        // An answer that raced an abort or the deadline is not a definite one.
        if (controller.signal.aborted) return 'unavailable';
        if (response.status === 404) return 'absent';
        if (response.status < 200 || response.status >= 300) {
          breaker.recordFailure(config.now());
          return 'unavailable';
        }
        const text = await response.text();
        if (text.length > MAX_RESPONSE_BYTES) {
          breaker.recordFailure(config.now());
          return 'unavailable';
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          breaker.recordFailure(config.now());
          return 'unavailable';
        }
        const listing = classify(parsed, input.providerFactorId);
        if (listing === null) {
          breaker.recordFailure(config.now());
          return 'unavailable';
        }
        return listing.status;
      } catch {
        if (!signal.aborted) breaker.recordFailure(config.now());
        return 'unavailable';
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', relay);
      }
    },
  };
};
