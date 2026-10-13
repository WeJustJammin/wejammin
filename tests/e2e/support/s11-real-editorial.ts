import type { ServerEnvironment } from '@wejammin/config/environment';

import type { AuthenticationResult } from '../../../apps/worker/src/authentication/result-types';
import type {
  CmsEditorialDependencies,
  CmsEditorialPorts,
} from '../../../apps/worker/src/cms-editorial/types';
import { createProductionCmsEditorialDependencies } from '../../../apps/worker/src/cms-editorial-production';
import { verifyLocalSessionPayload } from './s09-session-authority';
import {
  createS10RealCmsEditorial,
  type S10RealBindings,
} from './s10-real-editorial';
import { S10_CAPABILITIES_CLAIM, S10_PARTY_CLAIM } from './s10-session-claims';
import { S11_PERSON_CLAIM, S11_STEP_UP_CLAIM } from './s11-session-claims';

/**
 * The Slice 11 editorial dependency of the real-route API Worker.
 *
 * Slice 11 step-up is read from the AUTHENTICATION SESSION projection
 * (`stepUpAt`), never from the request: the production RPC context only
 * carries `stepUpAt` when the session came through the `auth` seam. The
 * Slice 10 dependency supplies the session through the direct `resolveSession`
 * seam (no step-up), so this module composes a SECOND production dependency
 * over the same stack that resolves the session through `auth`, and sends a
 * request to it only when its signed session cookie carries the step-up claim.
 * Every other request, and so every Slice 10 suite, takes the unchanged Slice
 * 10 path.
 *
 * The browser-side MFA ceremony is proven by the Slice 09 suites; here the
 * signed cookie states the instant the ceremony completed, which is exactly
 * what the authentication projection states for a real session. A stale
 * instant is refused by the database (STEP_UP_REQUIRED), not by this module.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const INSTANT =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?Z$/u;

type SteppedUpClaims = Readonly<{
  userId: string;
  sessionId: string;
  party: string;
  person: string;
  capabilities: readonly string[];
  stepUpAt: string;
}>;

const steppedUpClaims = async (
  request: Request,
  revokedSessionIds: ReadonlySet<string>,
): Promise<SteppedUpClaims | null> => {
  const verified = await verifyLocalSessionPayload(revokedSessionIds, request);
  if (verified === null || !UUID.test(verified.userId)) return null;
  const party = verified.claims[S10_PARTY_CLAIM];
  const person = verified.claims[S11_PERSON_CLAIM];
  const capabilities = verified.claims[S10_CAPABILITIES_CLAIM];
  const stepUpAt = verified.claims[S11_STEP_UP_CLAIM];
  if (
    typeof party !== 'string' ||
    !UUID.test(party) ||
    typeof person !== 'string' ||
    !UUID.test(person) ||
    !Array.isArray(capabilities) ||
    !capabilities.every((entry) => typeof entry === 'string') ||
    typeof stepUpAt !== 'string' ||
    !INSTANT.test(stepUpAt)
  )
    return null;
  return {
    userId: verified.userId,
    sessionId: verified.sessionId,
    party,
    person,
    capabilities: capabilities as readonly string[],
    stepUpAt,
  };
};

const PORT_NAMES: readonly (keyof CmsEditorialPorts)[] = [
  'appendRevision',
  'resolveConflict',
  'createEntry',
  'getEntryDraft',
  'listRevisions',
  'restoreRevision',
  'getConflictDetail',
  'listEntries',
  'getAuthoringContext',
  'submitReview',
  'recordDecision',
  'schedulePublication',
  'mintPreview',
  'publishRevision',
  'getEntryWorkflow',
  'getEditorialReview',
  'listEditorialReviews',
  'assignEditorialReviewer',
];

export const createS11RealCmsEditorial = (
  bindings: S10RealBindings,
  revokedSessionIds: ReadonlySet<string>,
): CmsEditorialDependencies => {
  const legacy = createS10RealCmsEditorial(bindings, revokedSessionIds);
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret } = bindings;
  if (url === undefined || secret === undefined)
    throw new Error(
      'The S11 real-route API Worker needs SUPABASE_URL and SUPABASE_SECRET_KEY.',
    );
  const stepped = createProductionCmsEditorialDependencies({
    environment: {
      SUPABASE_URL: url,
      SUPABASE_SECRET_KEY: secret,
      APP_ENVIRONMENT: bindings.APP_ENVIRONMENT ?? 'development',
      APP_RELEASE: bindings.APP_RELEASE ?? 's11-real-route',
    } as unknown as ServerEnvironment,
    humanOrigins: (bindings.S10_HUMAN_ORIGINS ?? '')
      .split(',')
      .filter((origin) => origin !== ''),
    // workerd rejects a detached fetch ("Illegal invocation").
    fetchImpl: (input, init) => fetch(input, init),
    auth: {
      resolveSession: async (request) => {
        const claims = await steppedUpClaims(request, revokedSessionIds);
        if (claims === null)
          return {
            ok: false,
            status: 401,
            code: 'UNAUTHENTICATED',
            message: 'The authentication session is invalid.',
          } as AuthenticationResult<never>;
        return {
          ok: true,
          value: {
            authUserId: claims.userId,
            sessionId: claims.sessionId,
            accountState: 'active',
            personId: claims.person,
            actingPartyId: claims.party,
            expiresAt: '2099-01-01T00:00:00.000Z',
            stepUpAt: claims.stepUpAt,
            primaryAuthAt: new Date(Date.now() - 60_000).toISOString(),
          },
        } as AuthenticationResult<never>;
      },
    },
    resolveCapabilities: async (_session, request) =>
      (await steppedUpClaims(request, revokedSessionIds))?.capabilities ?? [],
    rateLimit: async (input) => ({
      ok: true as const,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: Math.floor(Date.now() / 1_000) + 60,
      },
    }),
  }) as unknown as CmsEditorialDependencies;

  // A request is sent to the stepped-up composition only once its session has
  // resolved through it, so the port that follows finds its context there.
  const steppedRequests = new WeakSet<Request>();
  const ports = Object.fromEntries(
    PORT_NAMES.map((name) => [
      name,
      (input: { request: Request }, signal: AbortSignal) => {
        const side = steppedRequests.has(input.request) ? stepped : legacy;
        const port = side.ports[name] as unknown as (
          input: unknown,
          signal: AbortSignal,
        ) => Promise<unknown>;
        return port(input, signal);
      },
    ]),
  ) as unknown as CmsEditorialPorts;

  return {
    ...legacy,
    ports,
    resolveSession: async (request, signal) => {
      const claims = await steppedUpClaims(request, revokedSessionIds);
      if (claims === null) return legacy.resolveSession(request, signal);
      steppedRequests.add(request);
      return stepped.resolveSession(request, signal);
    },
    qualityGate: async (input, signal) => {
      const side = steppedRequests.has(input.request) ? stepped : legacy;
      return side.qualityGate === undefined
        ? null
        : side.qualityGate(input, signal);
    },
  };
};
