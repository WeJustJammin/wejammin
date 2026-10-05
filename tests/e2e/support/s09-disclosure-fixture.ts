import type { ActingContextListResource } from '@wejammin/contracts';

import type {
  AuthenticationResult,
  AuthenticationSession,
} from '../../../apps/worker/src/authentication/types';
import type { ContentSchemaRegistrySession } from '../../../apps/worker/src/content-schema-registry/types';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const PARTY_ID = '20000000-0000-4000-8000-000000000002';
const FUTURE_INSTANT = '2099-01-01T00:00:00.000Z';
const AUTHORITY_WINDOW_MS = 60 * 60 * 1000;
const FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

export const S09_DISCLOSURE_LABEL = 'Northwind Collective';
export const S09_DISCLOSURE_PARTY_ID = PARTY_ID;

/**
 * Fixed test-owned AC250 session profiles. Only these three local session ids
 * change disclosure behavior; every other valid local session keeps the
 * previous unknown-session behavior (no label, no freshness).
 */
export const S09_DISCLOSURE_PROFILE_IDS = Object.freeze({
  verified: '80000000-0000-4000-8000-000000000010',
  required: '80000000-0000-4000-8000-000000000011',
  unavailable: '80000000-0000-4000-8000-000000000012',
});

export type S09DisclosureProfile =
  'verified' | 'required' | 'unavailable' | 'unknown';

const isKnownProfileId = (value: unknown): value is string =>
  value === S09_DISCLOSURE_PROFILE_IDS.verified ||
  value === S09_DISCLOSURE_PROFILE_IDS.required ||
  value === S09_DISCLOSURE_PROFILE_IDS.unavailable;

const unavailable = (): AuthenticationResult<ActingContextListResource> => ({
  ok: false,
  status: 503,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'Identity context is temporarily unavailable.',
});

const CMS_CAPABILITIES = ['cms.schema_registry.read', 'cms.schema_designer'];

/**
 * Test-only AC250 disclosure fixture. The freshness anchor is claimed on the
 * first authenticated read of a profile session and never renewed, so a stale
 * window cannot silently revive across reads. No state is module-global and
 * no private identifier is emitted.
 */
export const createS09DisclosureFixture = () => {
  const profileBySessionId = new Map<string, S09DisclosureProfile>();
  const freshUntilBySessionId = new Map<string, string>();
  let mintedSessions = 0;

  const profileFor = (sessionId: unknown): S09DisclosureProfile => {
    if (!isKnownProfileId(sessionId)) return 'unknown';
    return sessionId === S09_DISCLOSURE_PROFILE_IDS.verified
      ? 'verified'
      : sessionId === S09_DISCLOSURE_PROFILE_IDS.required
        ? 'required'
        : 'unavailable';
  };

  const stepUpFreshUntilFor = (sessionId: unknown): string | null => {
    if (typeof sessionId !== 'string' || profileFor(sessionId) !== 'verified')
      return null;
    const existing = freshUntilBySessionId.get(sessionId);
    if (existing !== undefined) return existing;
    const anchored = new Date(Date.now() + FRESHNESS_WINDOW_MS).toISOString();
    freshUntilBySessionId.set(sessionId, anchored);
    return anchored;
  };

  const mintIdentitySession = (
    claimSessionId: unknown,
  ): AuthenticationSession => {
    mintedSessions += 1;
    const sessionId = `s09-identity-${String(mintedSessions)}`;
    profileBySessionId.set(sessionId, profileFor(claimSessionId));
    return {
      authUserId: USER_ID,
      sessionId,
      accountState: 'active',
      personId: null,
      actingPartyId: PARTY_ID,
      expiresAt: FUTURE_INSTANT,
      stepUpAt: null,
    };
  };

  const readActingContexts = (input: {
    readonly session: AuthenticationSession;
  }): AuthenticationResult<ActingContextListResource> => {
    const profile =
      profileBySessionId.get(input.session.sessionId) ?? 'unknown';
    if (profile !== 'verified' && profile !== 'required') return unavailable();
    return {
      ok: true,
      value: {
        projectionVersion: '1',
        items: [
          {
            contextId: PARTY_ID,
            partyId: PARTY_ID,
            kind: 'organization',
            label: S09_DISCLOSURE_LABEL,
            avatarRef: null,
            selectable: true,
            authorityFreshUntil: new Date(
              Date.now() + AUTHORITY_WINDOW_MS,
            ).toISOString(),
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
    };
  };

  return {
    profileFor,
    stepUpFreshUntilFor,
    mintIdentitySession,
    readActingContexts,
  };
};

/**
 * Compose the identity/auth ports the real Worker acting-context handler
 * resolves before it calls the read port. Every guard stays in the shared
 * verifier; this only maps a verified claim onto the fixed disclosure
 * profiles. Activation ports are untouched and stay unavailable.
 */
export const createS09DisclosurePorts = (input: {
  readonly verifyClaim: (
    request: Request,
  ) => Promise<Readonly<{ sessionId: string }> | null>;
}): Readonly<{
  disclosure: ReturnType<typeof createS09DisclosureFixture>;
  auth: Readonly<{
    resolveSession: (request: Request) => Promise<
      | Readonly<{
          ok: true;
          value: AuthenticationSession;
        }>
      | Readonly<{
          ok: false;
          status: 401;
          code: string;
          message: string;
        }>
    >;
    rateLimit: () => Promise<
      Readonly<{
        ok: true;
        value: Readonly<{
          allowed: boolean;
          limit: number;
          remaining: number;
          resetAt: number;
        }>;
      }>
    >;
  }>;
  identityAuthority: Readonly<{
    readActingContexts: (
      input: Readonly<{ session: AuthenticationSession }>,
    ) => AuthenticationResult<ActingContextListResource>;
  }>;
  registrySessionForClaim: (
    sessionId: string,
  ) => Readonly<
    Pick<
      ContentSchemaRegistrySession,
      'userId' | 'actingPartyId' | 'capabilities' | 'mfaFresh'
    > &
      Partial<Pick<ContentSchemaRegistrySession, 'stepUpFreshUntil'>>
  >;
}> => {
  const disclosure = createS09DisclosureFixture();
  return {
    disclosure,
    auth: {
      resolveSession: async (request: Request) => {
        const claim = await input.verifyClaim(request);
        if (claim === null)
          return {
            ok: false as const,
            status: 401 as const,
            code: 'UNAUTHENTICATED',
            message: 'The authentication session is invalid.',
          };
        return {
          ok: true as const,
          value: disclosure.mintIdentitySession(claim.sessionId),
        };
      },
      rateLimit: async () => ({
        ok: true as const,
        value: {
          allowed: true,
          limit: 30,
          remaining: 29,
          resetAt: 2_000_000_000,
        },
      }),
    },
    identityAuthority: {
      readActingContexts: (request) =>
        disclosure.readActingContexts({ session: request.session }),
    },
    registrySessionForClaim: (sessionId: string) => {
      const stepUpFreshUntil = disclosure.stepUpFreshUntilFor(sessionId);
      return {
        userId: '10000000-0000-4000-8000-000000000001',
        actingPartyId: S09_DISCLOSURE_PARTY_ID,
        capabilities: CMS_CAPABILITIES,
        mfaFresh: true,
        ...(stepUpFreshUntil === null ? {} : { stepUpFreshUntil }),
      };
    },
  };
};
