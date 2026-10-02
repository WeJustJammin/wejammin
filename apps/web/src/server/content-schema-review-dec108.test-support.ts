import { vi } from 'vitest';
import {
  CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
  CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER,
} from '@wejammin/contracts';

import {
  ACTOR_ID,
  PARTY_ID,
  REQUEST_ID,
  REVIEW_ID,
  REVIEW_PATH,
  reviewResource,
} from '../components/content-schema-registry/content-schema-review-dec108.test-support';

/**
 * Support for the DEC-108 protected review route server RED tests. The route's
 * server modules do not exist yet; tests reach them only through `loadModule`
 * so a missing module is reported as an explicit RED failure rather than an
 * opaque import error, and the expected contract is typed here.
 */

export const REVIEW_ORIGIN = 'https://app.example.test';
export const REVIEW_URL = `${REVIEW_ORIGIN}${REVIEW_PATH}`;
export const NOW = Date.parse('2026-10-02T12:00:00.000Z');
export const STEP_UP_FRESH_UNTIL = new Date(NOW + 5 * 60 * 1000).toISOString();
export const LABEL = 'Northwind Collective';

/** Page projection of the review route (props spread into the island). */
export interface ReviewPage {
  readonly state: 'ready' | 'degraded';
  readonly variant: string;
  readonly access: string;
  readonly reviewId: string | null;
  readonly initialReview: {
    readonly status: string;
    readonly data?: { readonly id: string; readonly state: string } | null;
    readonly httpStatus?: number;
  };
  readonly csrfToken: string;
  readonly requestId: string;
  readonly canonicalUrl: string;
  readonly retryUrl: string;
  readonly actingContextLabel?: string;
  readonly stepUpState?: string;
  readonly stepUpFreshUntil?: string;
  readonly [key: string]: unknown;
}

export type ReviewResult =
  | { readonly kind: 'authorized'; readonly page: ReviewPage }
  | {
      readonly kind: 'degraded' | 'error';
      readonly page: ReviewPage;
      readonly status: number;
    }
  | { readonly kind: 'unauthenticated'; readonly reason: string }
  | { readonly kind: 'invalid_record' }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'not_found' };

export type ResolveReviewPage = (input: {
  readonly request: Request;
  readonly reviewId: string | undefined;
  readonly ports: unknown;
  readonly requestId: string;
  readonly now?: () => number;
}) => Promise<ReviewResult>;

export type CreateReviewPorts = (binding: unknown) => unknown;

export const loadModule = async <T>(relative: string): Promise<T> => {
  const target = new URL(relative, import.meta.url).pathname;
  try {
    return (await import(/* @vite-ignore */ target)) as T;
  } catch (error) {
    throw new Error(
      `RED: expected production module ${relative} (FE03 DEC-108 review route)`,
      { cause: error },
    );
  }
};

export const loadReviewRoute = async (): Promise<{
  resolve: ResolveReviewPage;
  createPorts: CreateReviewPorts;
}> => {
  const context = await loadModule<{
    resolveContentSchemaReviewPage: ResolveReviewPage;
  }>('./content-schema-review-context.ts');
  const api = await loadModule<{
    createContentSchemaReviewPlatformPorts: CreateReviewPorts;
  }>('./content-schema-review-platform-api.ts');
  return {
    resolve: context.resolveContentSchemaReviewPage,
    createPorts: api.createContentSchemaReviewPlatformPorts,
  };
};

export interface ReviewBindingOptions {
  readonly capability?: string | null;
  readonly variant?: string | null;
  readonly status?: number;
  readonly errorCode?: string;
  readonly body?: unknown;
  readonly throws?: boolean;
  readonly omitStepUp?: boolean;
}

/** A scripted PLATFORM_API binding for the CMS-03A-13 read plus acting contexts. */
export const reviewBinding = (options: ReviewBindingOptions = {}) => {
  const requests: Request[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const request = input instanceof Request ? input : new Request(input);
    requests.push(request);
    if (options.throws === true) throw new TypeError('binding unavailable');
    if (request.url.includes('/api/v1/me/acting-contexts'))
      return Response.json({
        projectionVersion: '1',
        items: [
          {
            contextId: PARTY_ID,
            partyId: PARTY_ID,
            kind: 'organization',
            label: LABEL,
            avatarRef: null,
            selectable: true,
            authorityFreshUntil: new Date(NOW + 60 * 60 * 1000).toISOString(),
          },
        ],
        nextCursor: null,
        hasMore: false,
      });
    const status = options.status ?? 200;
    if (status !== 200)
      return Response.json(
        {
          code: options.errorCode ?? 'FORBIDDEN',
          details: {},
          message: 'Refused.',
          requestId: ACTOR_ID,
        },
        { status },
      );
    const headers = new Headers({ 'content-type': 'application/json' });
    if (options.capability !== null)
      headers.set(
        CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
        options.capability ?? 'cms.schema_designer',
      );
    if (options.variant !== null)
      headers.set(
        CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
        options.variant ?? 'ownerFull',
      );
    headers.set(CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER, ACTOR_ID);
    headers.set(CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER, PARTY_ID);
    if (options.omitStepUp !== true)
      headers.set(
        CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER,
        STEP_UP_FRESH_UNTIL,
      );
    return new Response(JSON.stringify(options.body ?? reviewResource()), {
      status: 200,
      headers,
    });
  });
  return { binding: { fetch }, fetch, requests };
};

export const reviewRequest = (
  init: { readonly cookie?: string | null; readonly search?: string } = {},
): Request =>
  new Request(`${REVIEW_URL}${init.search ?? ''}`, {
    headers:
      init.cookie === null
        ? {}
        : { cookie: init.cookie ?? 'wj_access=opaque; wj_csrf=csrf-cookie' },
  });

export const resolveReview = async (
  options: ReviewBindingOptions = {},
  input: {
    readonly reviewId?: string | undefined;
    readonly request?: Request;
  } = {},
) => {
  const route = await loadReviewRoute();
  const bound = reviewBinding(options);
  const result = await route.resolve({
    request: input.request ?? reviewRequest(),
    reviewId: 'reviewId' in input ? input.reviewId : REVIEW_ID,
    ports: route.createPorts(bound.binding),
    requestId: REQUEST_ID,
    now: () => NOW,
  });
  return { result, bound };
};
