import { z } from 'zod';
import { CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER } from '@wejammin/contracts';

import type {
  ContentSchemaRegistryAccess,
  ContentSchemaRegistryDetailState,
  ContentSchemaRegistryListState,
  ContentSchemaRegistryPage,
} from '../components/content-schema-registry/content-schema-registry-types';
import { CONTENT_SCHEMA_REGISTRY_CONTRACT_FIELDS } from '../components/content-schema-registry/content-schema-registry-types';
import {
  ContentSchemaRegistryDetailSchema,
  ContentSchemaRegistryListPageSchema,
  ContentSchemaRegistryListQuerySchema,
  contentSchemaRegistryListUrl,
  serializeContentSchemaRegistryQuery,
} from './content-schema-registry-contracts';
import type {
  ContentSchemaRegistryAuthority,
  ContentSchemaRegistryPorts,
  ContentSchemaRegistrySession,
} from './content-schema-registry-context-types';
import { contentSchemaRegistryStepUpStateFor } from './content-schema-registry-acting-context';

export type ContentSchemaRegistryResult =
  | { readonly kind: 'authorized'; readonly page: ContentSchemaRegistryPage }
  | {
      readonly kind: 'degraded';
      readonly page: ContentSchemaRegistryPage;
      readonly status: 502 | 503 | 504;
    }
  | {
      readonly kind: 'error';
      readonly page: ContentSchemaRegistryPage;
      readonly status: 400 | 422 | 429 | 500;
    }
  | {
      readonly kind: 'unauthenticated';
      readonly reason: 'missing_session' | 'expired_session';
    }
  | {
      readonly kind: 'invalid_query';
      readonly issues: readonly string[];
    }
  | { readonly kind: 'invalid_record' }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'not_found' };

export interface ResolveInput {
  readonly request: Request;
  readonly route: 'list' | 'detail';
  readonly ports: ContentSchemaRegistryPorts | null;
  readonly requestId: string;
  readonly contentTypeId?: string | undefined;
  readonly versionId?: string | undefined;
  /** Trusted server clock used for the step-up disclosure window. */
  readonly now?: (() => number) | undefined;
}

export const safeAccess = (input: {
  readonly state: 'ready' | 'degraded';
  readonly authority?: ContentSchemaRegistryAuthority;
}): ContentSchemaRegistryAccess => {
  if (input.state === 'degraded' && input.authority === undefined)
    return 'disabled';
  if (input.authority?.presentationVariant === 'forbiddenHidden')
    return 'not-rendered';
  if (input.authority?.presentationVariant === 'disabledPrerequisite')
    return 'disabled';
  return input.authority?.capabilities.includes('cms.schema_designer') === true
    ? 'full'
    : 'read-only';
};

export const listState = (
  data: z.infer<typeof ContentSchemaRegistryListPageSchema>,
): ContentSchemaRegistryListState =>
  data.items.length === 0
    ? { status: 'empty', reason: 'no-records' }
    : {
        status: 'success',
        data,
        version: data.items[0]?.version ?? '1',
        stale: false,
      };

export const detailState = (
  data: z.infer<typeof ContentSchemaRegistryDetailSchema>,
): ContentSchemaRegistryDetailState => ({
  status: 'success',
  data,
  version: data.resource.version,
  stale: false,
});

export const degradedListState = (
  requestId: string,
  code:
    | 'DEPENDENCY_INVALID_RESPONSE'
    | 'DEPENDENCY_UNAVAILABLE'
    | 'DEPENDENCY_DEADLINE_EXCEEDED' = 'DEPENDENCY_UNAVAILABLE',
  options: Readonly<{
    readonly retryable?: boolean;
    readonly httpStatus?: number;
    readonly retryAfterSeconds?: number | null;
    readonly etag?: string | null;
  }> = {},
): ContentSchemaRegistryListState => ({
  status: 'degraded',
  data: null,
  code,
  requestId,
  lastVerifiedAt: null,
  retryable: options.retryable ?? false,
  ...options,
});

export const degradedDetailState = (
  requestId: string,
  code:
    | 'DEPENDENCY_INVALID_RESPONSE'
    | 'DEPENDENCY_UNAVAILABLE'
    | 'DEPENDENCY_DEADLINE_EXCEEDED' = 'DEPENDENCY_UNAVAILABLE',
  options: Readonly<{
    readonly retryable?: boolean;
    readonly httpStatus?: number;
    readonly retryAfterSeconds?: number | null;
    readonly etag?: string | null;
  }> = {},
): ContentSchemaRegistryDetailState => ({
  status: 'degraded',
  data: null,
  code,
  requestId,
  lastVerifiedAt: null,
  retryable: options.retryable ?? false,
  ...options,
});

/** Project trusted read recovery metadata onto the browser-facing HTML. */
export const applyContentSchemaRegistryRecoveryHeaders = (
  headers: Headers,
  page: ContentSchemaRegistryPage,
): void => {
  const failure =
    page.initialList.status === 'error' ||
    page.initialList.status === 'degraded'
      ? page.initialList
      : page.initialDetail?.status === 'error' ||
          page.initialDetail?.status === 'degraded'
        ? page.initialDetail
        : null;
  if (failure === null) return;
  headers.set(
    CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER,
    String(failure.retryable === true),
  );
  if (
    failure.retryAfterSeconds !== undefined &&
    failure.retryAfterSeconds !== null
  )
    headers.set('retry-after', String(failure.retryAfterSeconds));
};

export const pageFor = (input: {
  readonly request: Request;
  readonly requestId: string;
  readonly session?: ContentSchemaRegistrySession;
  readonly authority?: ContentSchemaRegistryAuthority;
  readonly query: z.infer<typeof ContentSchemaRegistryListQuerySchema>;
  readonly list: ContentSchemaRegistryListState;
  readonly detail: ContentSchemaRegistryDetailState | null;
  readonly contentTypeId: string | null;
  readonly versionId: string | null;
  readonly state: 'ready' | 'degraded';
  /** Server-resolved disclosure values; never raw identifiers. */
  readonly actingContextLabel?: string | undefined;
  /** Trusted clock for the step-up disclosure window. */
  readonly now?: number | undefined;
}): ContentSchemaRegistryPage => {
  const access = safeAccess(input);
  const actorId =
    input.session !== undefined && 'userId' in input.session
      ? input.session.userId
      : null;
  const actingPartyId =
    input.authority !== undefined && 'actingPartyId' in input.authority
      ? input.authority.actingPartyId
      : null;
  const variant =
    input.state === 'degraded'
      ? 'degradedPage'
      : (input.authority?.presentationVariant ??
        (access === 'full' ? 'ownerFull' : 'entitledRead'));
  const stepUpFreshUntil = input.authority?.stepUpFreshUntil;
  const disclosureNow = input.now ?? Date.now();
  return {
    state: input.state,
    variant,
    access,
    actorId,
    actingPartyId,
    query: input.query,
    contentTypeId: input.contentTypeId,
    versionId: input.versionId,
    cursor: input.query.cursor ?? null,
    expectedVersion:
      input.detail?.status === 'success' ? input.detail.version : null,
    requestId: input.requestId,
    canonicalUrl: '/app/cms-content-modeling',
    listUrl: contentSchemaRegistryListUrl(input.query),
    retryUrl: (() => {
      const requestUrl = new URL(input.request.url);
      const query = serializeContentSchemaRegistryQuery(input.query);
      return `${requestUrl.pathname}${query.length > 0 ? `?${query}` : ''}`;
    })(),
    csrfToken: (() => {
      const cookie = input.request.headers.get('cookie');
      if (cookie === null) return '';
      const token = cookie
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('wj_csrf='));
      return token === undefined ? '' : token.slice('wj_csrf='.length);
    })(),
    initialList: input.list,
    initialDetail: input.detail,
    contractFields: CONTENT_SCHEMA_REGISTRY_CONTRACT_FIELDS,
    ...(input.actingContextLabel === undefined
      ? {}
      : { actingContextLabel: input.actingContextLabel }),
    stepUpState: contentSchemaRegistryStepUpStateFor(
      stepUpFreshUntil,
      disclosureNow,
    ),
    ...(stepUpFreshUntil === undefined || !Number.isFinite(disclosureNow)
      ? {}
      : { stepUpFreshUntil }),
  };
};
