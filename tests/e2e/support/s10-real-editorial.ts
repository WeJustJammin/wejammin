import type { ServerEnvironment } from '@wejammin/config/environment';

import type { CmsEditorialDependencies } from '../../../apps/worker/src/cms-editorial/types';
import { createProductionCmsEditorialDependencies } from '../../../apps/worker/src/cms-editorial-production';
import { verifyLocalSessionPayload } from './s09-session-authority';
import { S10_CAPABILITIES_CLAIM, S10_PARTY_CLAIM } from './s10-session-claims';

/**
 * The Slice 10 editorial dependency for the real-route browser suite: the
 * PRODUCTION composition (production RPC adapter -> Kong -> PostgREST -> the
 * newest SQL) with exactly two seams supplied, as the real-API gate suites do.
 *
 *   - the verified session: cookie authentication is not under test, so the
 *     signed local session cookie names the actor and acting party (the claims
 *     the production authentication resolver would read from the database);
 *   - the rate limiter: always allowed (it never produces an RPC outcome).
 *
 * Nothing the database says is rewritten, and no editorial port is replaced:
 * the previous test-owned history port (a stub that answered a fixed page for a
 * fixed entry) is gone, because a stub that emits more than the real Worker
 * does is what let S07/S08 pass while production was read-only.
 */

/** The wrangler vars the launcher passes to the API Worker. */
export type S10RealBindings = Readonly<{
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  APP_ENVIRONMENT?: string;
  APP_RELEASE?: string;
  /** Comma-separated browser origins plus the private binding origin. */
  S10_HUMAN_ORIGINS?: string;
}>;

const unauthenticated = () => ({
  ok: false as const,
  status: 401 as const,
  code: 'UNAUTHENTICATED',
  message: 'The authentication session is invalid.',
  details: { recoveryAction: 'reauthenticate' },
});

/**
 * workerd rejects a detached `fetch` ("Illegal invocation"), so the adapter gets
 * an explicit wrapper (the production entry does the same). Every non-2xx RPC
 * answer is logged with its operation name and PostgREST message so a refusal
 * the browser only sees as a mapped status can be traced to the database's own
 * word (no body, token or value is logged).
 */
const observedFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const rpc =
      /\/rpc\/([a-z0-9_]+)$/u.exec(
        String(input instanceof Request ? input.url : input),
      )?.[1] ?? 'unknown';
    let message = '';
    try {
      const body = (await response.clone().json()) as { message?: unknown };
      if (typeof body.message === 'string') message = body.message;
    } catch {
      // a non-JSON error carries no message
    }
    console.error(`[s10-rpc] ${rpc} ${String(response.status)} ${message}`);
  }
  return response;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export const createS10RealCmsEditorial = (
  bindings: S10RealBindings,
  revokedSessionIds: ReadonlySet<string>,
): CmsEditorialDependencies => {
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret } = bindings;
  if (url === undefined || secret === undefined)
    throw new Error(
      'The S10 real-route API Worker needs SUPABASE_URL and SUPABASE_SECRET_KEY; the launcher reads them from the local Supabase stack.',
    );
  const humanOrigins = (bindings.S10_HUMAN_ORIGINS ?? '')
    .split(',')
    .filter((origin) => origin !== '');
  const production = createProductionCmsEditorialDependencies({
    environment: {
      SUPABASE_URL: url,
      SUPABASE_SECRET_KEY: secret,
      APP_ENVIRONMENT: bindings.APP_ENVIRONMENT ?? 'development',
      APP_RELEASE: bindings.APP_RELEASE ?? 's10-real-route',
    } as unknown as ServerEnvironment,
    humanOrigins,
    fetchImpl: observedFetch,
    resolveSession: async (request) => {
      const verified = await verifyLocalSessionPayload(
        revokedSessionIds,
        request,
      );
      if (verified === null || !UUID.test(verified.userId))
        return unauthenticated();
      const party = verified.claims[S10_PARTY_CLAIM];
      const capabilities = verified.claims[S10_CAPABILITIES_CLAIM];
      if (
        typeof party !== 'string' ||
        !UUID.test(party) ||
        !Array.isArray(capabilities) ||
        !capabilities.every((entry) => typeof entry === 'string')
      )
        return unauthenticated();
      return {
        ok: true as const,
        value: {
          userId: verified.userId,
          actingPartyId: party,
          capabilities: capabilities as readonly string[],
          mfaFresh: false,
        },
      };
    },
    rateLimit: async (input) => ({
      ok: true as const,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: Math.floor(Date.now() / 1_000) + 60,
      },
    }),
  });
  return production as unknown as CmsEditorialDependencies;
};
