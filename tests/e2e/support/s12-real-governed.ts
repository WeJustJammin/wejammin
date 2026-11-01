import type { ServerEnvironment } from '@wejammin/config/environment';

import type { ContentSchemaRegistryDependencies } from '../../../apps/worker/src/content-schema-registry/types';
import { createProductionContentSchemaRegistryDependencies } from '../../../apps/worker/src/content-schema-registry/production';
import type { AuthenticationResult } from '../../../apps/worker/src/authentication/result-types';
import type { CmsGovernedReviewDependencies } from '../../../apps/worker/src/cms-composition/governed-review-ports';
import type { CmsTaxonomyDependencies } from '../../../apps/worker/src/cms-composition/taxonomy-contracts';
import type { CmsTaxonomyDefinitionDependencies } from '../../../apps/worker/src/cms-composition/taxonomy-definition-shared';
import { createProductionCmsGovernedReviewDependencies } from '../../../apps/worker/src/cms-composition-production-governed-review';
import { createProductionCmsTaxonomyDependencies } from '../../../apps/worker/src/cms-composition-production-taxonomy';
import { createProductionCmsPatternInstanceDependencies } from '../../../apps/worker/src/cms-composition-production-pattern';
import { createProductionCmsPatternDefinitionDependencies } from '../../../apps/worker/src/cms-composition-production-pattern-definition';
import { createProductionCmsPatternUpdateDependencies } from '../../../apps/worker/src/cms-composition-production-pattern-update';
import { createProductionCmsRelatedContentDependencies } from '../../../apps/worker/src/cms-composition-production-related';
import type { CmsPatternInstanceDependencies } from '../../../apps/worker/src/cms-composition/pattern-instance-routes';
import type { CmsPatternDefinitionDependencies } from '../../../apps/worker/src/cms-composition/pattern-definition-ports';
import type { CmsPatternUpdateDependencies } from '../../../apps/worker/src/cms-composition/pattern-update-ports';
import type { CmsRelatedContentDependencies } from '../../../apps/worker/src/cms-composition/related-content-routes';
import { createProductionCmsTaxonomyDefinitionDependencies } from '../../../apps/worker/src/cms-composition-production-taxonomy-definition';
import type { CmsEditorialProductionOptions } from '../../../apps/worker/src/cms-editorial-production-types';
import { verifyLocalSessionPayload } from './s09-session-authority';
import type { S10RealBindings } from './s10-real-editorial';
import { S10_CAPABILITIES_CLAIM, S10_PARTY_CLAIM } from './s10-session-claims';
import {
  S11_PERSON_CLAIM,
  S11_STEP_UP_CLAIM,
  S12_ACTING_CONTEXT_CLAIM,
} from './s11-session-claims';

/**
 * The Slice 12 governed-review dependencies of the real-route API Worker: the PRODUCTION
 * composition (production RPC adapter -> Kong -> PostgREST -> the newest SQL) for the governed
 * review commands and reads (CMS-03C-06..11), for the vocabulary definition (CMS-03C-16, the
 * subject the governed spec reviews), the term actions (CMS-03C-03), pattern placement (CMS-03C-02),
 * related content (CMS-03C-05), pattern definition (CMS-03C-12) and pattern update (CMS-03C-15).
 * A boundary left out is an unregistered route: the Worker answers 404 and the web relays a 502
 * ([T7] failed that way for CMS-03C-03), so `s12-real-governed.test.ts` pins that every
 * production composition boundary is served. Each uses exactly the seams the Slice 11 editorial dependency
 * supplies: the session, read from the signed local cookie (its step-up instant is the MFA
 * ceremony's completion, as the authentication projection states it), and an always-allow rate
 * limiter. No port is replaced and nothing the database says is rewritten.
 *
 * The template and locale routes keep their test-owned fixtures (`cms-template-fixture.ts`,
 * `cms-locale-fixture.ts`) for lane and legacy fixture sessions; a session carrying the Slice
 * 11/12 claims reaches the PRODUCTION composition through `s12-real-template-locale.ts`.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const INSTANT =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?Z$/u;

type Claims = Readonly<{
  userId: string;
  sessionId: string;
  party: string;
  person: string;
  capabilities: readonly string[];
  stepUpAt: string | null;
  actingContextId: string | null;
}>;

export const claimsOf = async (
  request: Request,
  revokedSessionIds: ReadonlySet<string>,
): Promise<Claims | null> => {
  const verified = await verifyLocalSessionPayload(revokedSessionIds, request);
  if (verified === null || !UUID.test(verified.userId)) return null;
  const party = verified.claims[S10_PARTY_CLAIM];
  const person = verified.claims[S11_PERSON_CLAIM];
  const capabilities = verified.claims[S10_CAPABILITIES_CLAIM];
  const stepUpAt = verified.claims[S11_STEP_UP_CLAIM];
  const actingContextId = verified.claims[S12_ACTING_CONTEXT_CLAIM];
  if (
    typeof party !== 'string' ||
    !UUID.test(party) ||
    typeof person !== 'string' ||
    !UUID.test(person) ||
    !Array.isArray(capabilities) ||
    !capabilities.every((entry) => typeof entry === 'string') ||
    (stepUpAt !== undefined &&
      (typeof stepUpAt !== 'string' || !INSTANT.test(stepUpAt))) ||
    (actingContextId !== undefined &&
      (typeof actingContextId !== 'string' || !UUID.test(actingContextId)))
  )
    return null;
  return {
    userId: verified.userId,
    sessionId: verified.sessionId,
    party,
    person,
    capabilities: capabilities as readonly string[],
    stepUpAt: stepUpAt ?? null,
    actingContextId: actingContextId ?? null,
  };
};

export const options = (
  bindings: S10RealBindings,
  revokedSessionIds: ReadonlySet<string>,
): CmsEditorialProductionOptions => {
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret } = bindings;
  if (url === undefined || secret === undefined)
    throw new Error(
      'The S12 real-route API Worker needs SUPABASE_URL and SUPABASE_SECRET_KEY.',
    );
  return {
    environment: {
      SUPABASE_URL: url,
      SUPABASE_SECRET_KEY: secret,
      APP_ENVIRONMENT: bindings.APP_ENVIRONMENT ?? 'development',
      APP_RELEASE: bindings.APP_RELEASE ?? 's12-real-route',
    } as unknown as ServerEnvironment,
    humanOrigins: (bindings.S10_HUMAN_ORIGINS ?? '')
      .split(',')
      .filter((origin) => origin !== ''),
    // workerd rejects a detached fetch ("Illegal invocation").
    fetchImpl: (input, init) => fetch(input, init),
    auth: {
      resolveSession: async (request) => {
        const claims = await claimsOf(request, revokedSessionIds);
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
            ...(claims.stepUpAt === null ? {} : { stepUpAt: claims.stepUpAt }),
            ...(claims.actingContextId === null
              ? {}
              : { actingContextId: claims.actingContextId }),
            primaryAuthAt: new Date(Date.now() - 60_000).toISOString(),
          },
        } as AuthenticationResult<never>;
      },
    },
    resolveCapabilities: async (_session, request) =>
      (await claimsOf(request, revokedSessionIds))?.capabilities ?? [],
    rateLimit: async (input) => ({
      ok: true as const,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: Math.floor(Date.now() / 1_000) + 60,
      },
    }),
  } as unknown as CmsEditorialProductionOptions;
};

export type S12RealGoverned = Readonly<{
  cmsGovernedReview: CmsGovernedReviewDependencies;
  cmsPatternDefinition: CmsPatternDefinitionDependencies;
  cmsPatternInstance: CmsPatternInstanceDependencies;
  cmsPatternUpdate: CmsPatternUpdateDependencies;
  cmsRelatedContent: CmsRelatedContentDependencies;
  cmsTaxonomy: CmsTaxonomyDependencies;
  cmsTaxonomyDefinition: CmsTaxonomyDefinitionDependencies;
}>;

export const createS12RealGoverned = (
  bindings: S10RealBindings,
  revokedSessionIds: ReadonlySet<string>,
): S12RealGoverned => ({
  cmsGovernedReview: createProductionCmsGovernedReviewDependencies(
    options(bindings, revokedSessionIds),
  ),
  cmsPatternDefinition: createProductionCmsPatternDefinitionDependencies(
    options(bindings, revokedSessionIds),
  ),
  cmsPatternInstance: createProductionCmsPatternInstanceDependencies(
    options(bindings, revokedSessionIds),
  ),
  cmsPatternUpdate: createProductionCmsPatternUpdateDependencies(
    options(bindings, revokedSessionIds),
  ),
  cmsRelatedContent: createProductionCmsRelatedContentDependencies(
    options(bindings, revokedSessionIds),
  ),
  cmsTaxonomy: createProductionCmsTaxonomyDependencies(
    options(bindings, revokedSessionIds),
  ),
  cmsTaxonomyDefinition: createProductionCmsTaxonomyDefinitionDependencies(
    options(bindings, revokedSessionIds),
  ),
});

/**
 * The capability-grant console (CMS-03A-15 to -18) the assignment forms read their reviewer options from.
 * The launcher serves the registry routes from test-owned in-memory ports; for a request that is
 * not a lane session its grant list answers "persistence temporarily unavailable" (503), so an
 * owner on the governed page saw "Reviewer choices could not be loaded". For a session that
 * carries the Slice 11/12 claims (party, person, capabilities) the list now goes through the
 * PRODUCTION registry composition over the local stack, exactly as the Worker serves it; every
 * other request, lane sessions included, keeps its previous port byte for byte.
 */
export const createS12RealRegistry = (
  base: ContentSchemaRegistryDependencies,
  bindings: S10RealBindings,
  revokedSessionIds: ReadonlySet<string>,
): ContentSchemaRegistryDependencies => {
  const shared = options(bindings, revokedSessionIds);
  const production = createProductionContentSchemaRegistryDependencies({
    environment: shared.environment,
    ...(shared.fetchImpl === undefined ? {} : { fetchImpl: shared.fetchImpl }),
    ...(shared.auth === undefined ? {} : { auth: shared.auth }),
    ...(shared.resolveCapabilities === undefined
      ? {}
      : { resolveCapabilities: shared.resolveCapabilities }),
    ...(shared.humanOrigins === undefined
      ? {}
      : { humanOrigins: shared.humanOrigins }),
    rateLimit:
      shared.rateLimit as ContentSchemaRegistryDependencies['rateLimit'],
  } as never);
  const routed = new WeakSet<Request>();
  return {
    ...base,
    resolveSession: async (request, signal) => {
      if ((await claimsOf(request, revokedSessionIds)) === null)
        return base.resolveSession(request, signal);
      routed.add(request);
      return production.resolveSession(request, signal);
    },
    // The owner's whole grant console (list, grant, renew, revoke) is the production adapter for
    // a session that carries the claims; any other request keeps its previous port.
    ports: {
      ...base.ports,
      ...Object.fromEntries(
        (
          [
            'listCapabilityGrants',
            'grantCapability',
            'renewCapabilityGrant',
            'revokeCapabilityGrant',
          ] as const
        ).map((name) => [
          name,
          (
            input: Parameters<typeof base.ports.listCapabilityGrants>[0],
            signal: AbortSignal,
          ) =>
            (routed.has(input.request) ? production.ports : base.ports)[name](
              input as never,
              signal,
            ),
        ]),
      ),
    },
  };
};
