import type {
  ContentSchemaRegistryAuthority,
  ContentSchemaRegistryPorts,
  ContentSchemaRegistrySession,
} from './content-schema-registry-context-types';
import {
  apiPathForDetail,
  apiPathForReview,
  apiPathForRequest,
  DETAIL_PATH,
  hasSessionCookie,
  isBinding,
  requestUpstream,
  SESSION_TTL_MS,
  type UpstreamResult,
} from './content-schema-registry-platform-shared';
import type { ContentSchemaRegistryRefetchReason } from './content-schema-registry-platform-shared';
import { CONTENT_SCHEMA_REGISTRY_ACTING_CONTEXTS_PATH } from './content-schema-registry-acting-context';

/**
 * Build the production read ports. The upstream 2xx response is the trusted
 * capability proof; no browser-provided actor or capability header is used.
 */
export const createContentSchemaRegistryPlatformPorts = (
  binding: unknown,
): ContentSchemaRegistryPorts => {
  if (!isBinding(binding)) {
    throw new TypeError('PLATFORM_API service binding is not configured');
  }

  const cache = new WeakMap<Request, Map<string, Promise<UpstreamResult>>>();
  const requestOnce = (
    request: Request,
    path: string,
  ): Promise<UpstreamResult> => {
    let byPath = cache.get(request);
    if (byPath === undefined) {
      byPath = new Map();
      cache.set(request, byPath);
    }
    const cached = byPath.get(path);
    if (cached !== undefined) return cached;
    const pending = requestUpstream(binding, request, path);
    byPath.set(path, pending);
    return pending;
  };

  const requireUpstream = async (
    request: Request,
    path: string,
  ): Promise<unknown> => {
    const result = await requestOnce(request, path);
    if (result.kind !== 'ok') throw result.error;
    return result.data;
  };

  return {
    verifySession: async (
      request: Request,
    ): Promise<ContentSchemaRegistrySession | null> => {
      if (!hasSessionCookie(request)) return null;
      const result = await requestOnce(request, apiPathForRequest(request));
      if (result.kind === 'unauthenticated') return null;
      if (result.kind !== 'ok') throw result.error;
      return {
        serverVerified: true,
        ...(result.actorId === null ? {} : { userId: result.actorId }),
        expiresAt: Date.now() + SESSION_TTL_MS,
      };
    },
    now: () => Date.now(),
    resolveAuthority: async ({
      request,
    }): Promise<ContentSchemaRegistryAuthority> => {
      const result = await requestOnce(request, apiPathForRequest(request));
      if (result.kind !== 'ok') throw result.error;
      return {
        ...(result.actingPartyId === null
          ? { serverVerified: true as const }
          : { actingPartyId: result.actingPartyId }),
        capabilities: [...result.capabilities],
        ...(result.presentationVariant === null
          ? {}
          : { presentationVariant: result.presentationVariant }),
        ...(result.stepUpFreshUntil === null
          ? {}
          : { stepUpFreshUntil: result.stepUpFreshUntil }),
      };
    },
    loadList: async ({ request }): Promise<unknown> =>
      requireUpstream(request, apiPathForRequest(request)),
    loadDetail: async ({
      request,
      contentTypeId,
      versionId,
    }): Promise<unknown> =>
      requireUpstream(request, apiPathForDetail(contentTypeId, versionId)),
    loadReview: async ({ request, reviewId }): Promise<unknown> =>
      requireUpstream(request, apiPathForReview(reviewId)),
    // Presentation-only label read: the authorized list is fetched through
    // the same private binding, and a failure degrades the disclosure rather
    // than the protected read.
    loadActingContexts: async ({ request }): Promise<Response> => {
      const result = await requestOnce(
        request,
        CONTENT_SCHEMA_REGISTRY_ACTING_CONTEXTS_PATH,
      );
      if (result.kind !== 'ok') return new Response(null, { status: 502 });
      return Response.json(result.data);
    },
  };
};

/**
 * Server-only bounded refresh used by the SSR workbench's retry contract.
 * It re-reads the current A06/A07 resource and never invokes a mutation.
 */
export const createContentSchemaRegistryRefetch = (
  request: Request,
  binding: unknown,
): ((reason: ContentSchemaRegistryRefetchReason) => Promise<void>) => {
  if (!isBinding(binding)) {
    return async () => {
      throw new TypeError('PLATFORM_API service binding is not configured');
    };
  }
  return async () => {
    const result = await requestUpstream(
      binding,
      request,
      apiPathForRequest(request),
    );
    if (result.kind !== 'ok') throw result.error;
  };
};

export const contentSchemaRegistryDetailPath = (
  path: string,
): { readonly contentTypeId: string; readonly versionId: string } | null => {
  const match = DETAIL_PATH.exec(path);
  return match?.[1] !== undefined && match[2] !== undefined
    ? { contentTypeId: match[1], versionId: match[2] }
    : null;
};
