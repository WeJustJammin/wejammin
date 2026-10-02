import {
  apiPathForReview,
  hasSessionCookie,
  isBinding,
  requestUpstream,
  SESSION_TTL_MS,
} from './content-schema-registry-platform-shared';
import type { ContentSchemaRegistryPresentationVariant } from './content-schema-registry-platform-shared';
import { CONTENT_SCHEMA_REGISTRY_ACTING_CONTEXTS_PATH } from './content-schema-registry-acting-context';

/** One CMS-03A-13 read with the private context projection that came with it. */
export interface ContentSchemaReviewRead {
  readonly data: unknown;
  readonly capabilities: readonly string[];
  readonly presentationVariant: ContentSchemaRegistryPresentationVariant | null;
  readonly actingPartyId: string | null;
  readonly stepUpFreshUntil: string | null;
}

export interface ContentSchemaReviewPorts {
  /** Local, side-effect-free: only a session cookie proves a candidate session. */
  readonly verifySession: (request: Request) => Promise<unknown>;
  readonly now: () => number;
  /** Throws a `ContentSchemaRegistryPlatformError` on every non-2xx outcome. */
  readonly loadReview: (input: {
    readonly request: Request;
    readonly reviewId: string;
  }) => Promise<ContentSchemaReviewRead>;
  /** Presentation-only label read; failure degrades the label, never the page. */
  readonly loadActingContexts: (input: {
    readonly request: Request;
  }) => Promise<Response>;
}

/**
 * Build the review route's read ports over the private `PLATFORM_API`
 * binding. The upstream 2xx is the only capability proof: the browser never
 * supplies an actor, party, capability or review authority.
 */
export const createContentSchemaReviewPlatformPorts = (
  binding: unknown,
): ContentSchemaReviewPorts => {
  if (!isBinding(binding))
    throw new TypeError('PLATFORM_API service binding is not configured');
  return {
    verifySession: async (request) =>
      hasSessionCookie(request)
        ? { serverVerified: true, expiresAt: Date.now() + SESSION_TTL_MS }
        : null,
    now: () => Date.now(),
    loadReview: async ({ request, reviewId }) => {
      const result = await requestUpstream(
        binding,
        request,
        apiPathForReview(reviewId),
      );
      if (result.kind !== 'ok') throw result.error;
      return {
        data: result.data,
        capabilities: result.capabilities,
        presentationVariant: result.presentationVariant,
        actingPartyId: result.actingPartyId,
        stepUpFreshUntil: result.stepUpFreshUntil,
      };
    },
    loadActingContexts: async ({ request }) => {
      const result = await requestUpstream(
        binding,
        request,
        CONTENT_SCHEMA_REGISTRY_ACTING_CONTEXTS_PATH,
      );
      return result.kind === 'ok'
        ? Response.json(result.data)
        : new Response(null, { status: 502 });
    },
  };
};
