import {
  CmsCapabilityGrantListPageSchema,
  CmsCapabilityGrantListQuerySchema,
} from '@wejammin/contracts';

import { CONTENT_SCHEMA_REGISTRY_ACTING_CONTEXTS_PATH } from './content-schema-registry-acting-context';
import {
  CMS_CAPABILITY_GRANTS_API_PATH,
  type CmsCapabilityGrantPageQuery,
} from './cms-capability-grant-contracts';
import {
  hasSessionCookie,
  isBinding,
  requestUpstream,
  SESSION_TTL_MS,
} from './content-schema-registry-platform-shared';
import type { ContentSchemaRegistryPresentationVariant } from './content-schema-registry-platform-shared';

/** One CMS-03A-18 read with the private context projection that came with it. */
export interface CmsCapabilityGrantRead {
  readonly data: unknown;
  readonly capabilities: readonly string[];
  readonly presentationVariant: ContentSchemaRegistryPresentationVariant | null;
  readonly actingPartyId: string | null;
  readonly stepUpFreshUntil: string | null;
}

export interface CmsCapabilityGrantPorts {
  /** Local, side-effect-free: only a session cookie proves a candidate session. */
  readonly verifySession: (request: Request) => Promise<unknown>;
  readonly now: () => number;
  /** Throws a `ContentSchemaRegistryPlatformError` on every non-2xx outcome. */
  readonly loadGrants: (input: {
    readonly request: Request;
    readonly query: CmsCapabilityGrantPageQuery;
  }) => Promise<CmsCapabilityGrantRead>;
  /** Presentation-only label read; failure degrades the label, never the page. */
  readonly loadActingContexts: (input: {
    readonly request: Request;
  }) => Promise<Response>;
}

/** Serialize validated list-query state into the private CMS-03A-18 path. */
export const cmsCapabilityGrantListPath = (query: {
  readonly [
    K in
      | 'subjectPersonId'
      | 'capability'
      | 'state'
      | 'limit'
      | 'cursor'
      | 'sort'
      | 'direction'
  ]?: string | number | undefined;
}): string => {
  const params = new URLSearchParams();
  for (const key of [
    'subjectPersonId',
    'capability',
    'state',
    'limit',
    'cursor',
    'sort',
    'direction',
  ] as const) {
    const value = query[key];
    if (value !== undefined) params.set(key, String(value));
  }
  return `${CMS_CAPABILITY_GRANTS_API_PATH}?${params.toString()}`;
};

/**
 * Build the console's read ports over the private `PLATFORM_API` binding. The
 * upstream 2xx is the only owner proof: the browser never supplies an actor,
 * party, owner flag or capability.
 */
export const createCmsCapabilityGrantPlatformPorts = (
  binding: unknown,
): CmsCapabilityGrantPorts => {
  if (!isBinding(binding))
    throw new TypeError('PLATFORM_API service binding is not configured');
  return {
    verifySession: async (request) =>
      hasSessionCookie(request)
        ? { serverVerified: true, expiresAt: Date.now() + SESSION_TTL_MS }
        : null,
    now: () => Date.now(),
    loadGrants: async ({ request, query }) => {
      const result = await requestUpstream(
        binding,
        request,
        cmsCapabilityGrantListPath(query),
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

/**
 * Same-origin GET proxy for the island's list refetch (CMS-03A-18). The
 * island-local person filter may be carried here (a fetch, never the page
 * URL); every value is validated by the generated query schema first.
 */
export const forwardCmsCapabilityGrantListRead = async (
  request: Request,
  binding: unknown,
): Promise<Response> => {
  const refuse = (status: number): Response =>
    new Response(null, {
      status,
      headers: { 'cache-control': 'no-store' },
    });
  if (!isBinding(binding) || request.method !== 'GET') return refuse(503);
  const url = new URL(request.url);
  const input: Record<string, string> = {};
  for (const key of [
    'subjectPersonId',
    'capability',
    'state',
    'limit',
    'cursor',
    'sort',
    'direction',
  ]) {
    const value = url.searchParams.get(key);
    if (value !== null) input[key] = value;
  }
  const parsed = CmsCapabilityGrantListQuerySchema.safeParse(input);
  if (!parsed.success) return refuse(400);
  const result = await requestUpstream(
    binding,
    request,
    cmsCapabilityGrantListPath(parsed.data),
  );
  if (result.kind !== 'ok') {
    const status = result.error.status ?? 503;
    return new Response(
      result.error.apiError === null
        ? null
        : JSON.stringify(result.error.apiError),
      {
        status,
        headers: {
          'cache-control': 'no-store',
          ...(result.error.apiError === null
            ? {}
            : { 'content-type': 'application/json' }),
          ...(result.error.retryAfterSeconds === null
            ? {}
            : { 'retry-after': String(result.error.retryAfterSeconds) }),
        },
      },
    );
  }
  return new Response(JSON.stringify(result.data), {
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    },
  });
};

/**
 * Navigation-only owner probe: a one-row CMS-03A-18 read. Only an upstream 2xx
 * carrying a valid grant page proves the caller is the receipt-derived owner;
 * every other outcome hides the entry and never fails the calling page.
 */
export const probeCmsCapabilityGrantOwner = async (
  request: Request,
  binding: unknown,
): Promise<boolean> => {
  if (!isBinding(binding) || !hasSessionCookie(request)) return false;
  try {
    const result = await requestUpstream(
      binding,
      request,
      `${CMS_CAPABILITY_GRANTS_API_PATH}?limit=1`,
    );
    return (
      result.kind === 'ok' &&
      CmsCapabilityGrantListPageSchema.safeParse(result.data).success
    );
  } catch {
    return false;
  }
};

/** The row id a native grant form carries; the facade validates it as a UUID. */
export const cmsCapabilityGrantIdFromRequest = async (
  request: Request,
): Promise<string | undefined> => {
  try {
    const value = (await request.clone().formData()).get('grantId');
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
};
