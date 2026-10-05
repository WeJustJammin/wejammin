import { CmsCapabilityGrantListPageSchema } from '@wejammin/contracts';

import type {
  CmsCapabilityGrantListState,
  CmsCapabilityGrantPage,
  CmsCapabilityGrantQueryState,
} from '../components/cms-capability-grants/cms-capability-grant-types';
import { CMS_CAPABILITY_GRANT_CONTRACT_FIELDS } from '../components/cms-capability-grants/cms-capability-grant-types';
import {
  cmsCapabilityGrantConsoleUrl,
  grantTermWindow,
  parseCmsCapabilityGrantPageQuery,
} from './cms-capability-grant-contracts';
import type { CmsCapabilityGrantPorts } from './cms-capability-grant-platform-api';
import {
  contentSchemaRegistryStepUpStateFor,
  resolveContentSchemaRegistryActingContextLabel,
} from './content-schema-registry-acting-context';
import {
  platformFailure,
  platformOutcome,
} from './content-schema-registry-context-outcomes';
import { SessionSchema } from './content-schema-registry-context-types';

export type CmsCapabilityGrantResult =
  | { readonly kind: 'authorized'; readonly page: CmsCapabilityGrantPage }
  | {
      readonly kind: 'degraded';
      readonly page: CmsCapabilityGrantPage;
      readonly status: 502 | 503 | 504;
    }
  | {
      readonly kind: 'error';
      readonly page: CmsCapabilityGrantPage;
      readonly status: 400 | 422 | 429 | 500;
    }
  | {
      readonly kind: 'unauthenticated';
      readonly reason: 'missing_session' | 'expired_session';
    }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'not_found' };

export interface ResolveCmsCapabilityGrantInput {
  readonly request: Request;
  readonly ports: CmsCapabilityGrantPorts | null;
  readonly requestId: string;
  readonly now?: (() => number) | undefined;
}

const csrfTokenFrom = (request: Request): string => {
  const cookie = request.headers.get('cookie');
  if (cookie === null) return '';
  const token = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('wj_csrf='));
  return token === undefined ? '' : token.slice('wj_csrf='.length);
};

const hasFilter = (query: CmsCapabilityGrantQueryState): boolean =>
  query.capability !== undefined || query.state !== undefined;

const pageFor = (input: {
  readonly request: Request;
  readonly requestId: string;
  readonly query: CmsCapabilityGrantQueryState;
  readonly list: CmsCapabilityGrantListState;
  readonly state: 'ready' | 'degraded';
  readonly now: number;
  readonly label?: string | null;
  readonly stepUpFreshUntil?: string | null;
}): CmsCapabilityGrantPage => {
  const canonicalUrl = cmsCapabilityGrantConsoleUrl(input.query);
  const fresh = input.stepUpFreshUntil ?? undefined;
  const stepUpState = contentSchemaRegistryStepUpStateFor(fresh, input.now);
  return {
    state: input.state,
    variant: input.state === 'ready' ? 'ownerFull' : 'disabledPrerequisite',
    access: input.state === 'ready' ? 'full' : 'disabled',
    initialList: input.list,
    query: input.query,
    cursor: input.query.cursor ?? null,
    termWindow: grantTermWindow(input.now),
    requestId: input.requestId,
    canonicalUrl,
    retryUrl: canonicalUrl,
    csrfToken: csrfTokenFrom(input.request),
    contractFields: CMS_CAPABILITY_GRANT_CONTRACT_FIELDS,
    ...(input.label == null ? {} : { actingContextLabel: input.label }),
    stepUpState,
    ...(fresh === undefined || stepUpState !== 'verified'
      ? {}
      : { stepUpFreshUntil: fresh }),
  };
};

const failureResult = (
  input: ResolveCmsCapabilityGrantInput,
  query: CmsCapabilityGrantQueryState,
  error: unknown,
  now: number,
): CmsCapabilityGrantResult => {
  const concealed = platformFailure(error);
  if (
    concealed?.kind === 'unauthenticated' ||
    concealed?.kind === 'forbidden' ||
    concealed?.kind === 'not_found'
  )
    return concealed;
  const outcome = platformOutcome(error, input.requestId);
  const build = (list: CmsCapabilityGrantListState) =>
    pageFor({
      request: input.request,
      requestId: input.requestId,
      query,
      list,
      state: 'degraded',
      now,
    });
  if (outcome?.kind === 'error')
    return {
      kind: 'error',
      status: outcome.status,
      page: build({
        status: 'error',
        error: outcome.error,
        retryable: outcome.retryable,
        httpStatus: outcome.status,
        retryAfterSeconds: outcome.retryAfterSeconds,
      }),
    };
  const status = outcome?.status ?? 503;
  return {
    kind: 'degraded',
    status,
    page: build({
      status: 'degraded',
      data: null,
      requestId: input.requestId,
      lastVerifiedAt: null,
      retryable: outcome?.retryable ?? false,
      httpStatus: status,
      retryAfterSeconds: outcome?.retryAfterSeconds ?? null,
    }),
  };
};

/**
 * FE03 `/app/cms-content-modeling/capability-grants` resolver. The upstream
 * CMS-03A-18 2xx is the only proof the caller is the receipt-derived owner;
 * an authenticated non-owner is 403 and a missing session redirects. The page
 * carries safe display context only: no actor, party, grantor or binding
 * identifier, and the person filter never enters the URL or page state.
 */
export const resolveCmsCapabilityGrantPage = async (
  input: ResolveCmsCapabilityGrantInput,
): Promise<CmsCapabilityGrantResult> => {
  const { ports } = input;
  if (ports === null)
    return { kind: 'unauthenticated', reason: 'missing_session' };
  const now = (input.now ?? ports.now)();
  const session = SessionSchema.safeParse(
    await ports.verifySession(input.request),
  );
  if (!session.success || session.data.expiresAt <= ports.now())
    return { kind: 'unauthenticated', reason: 'missing_session' };
  const query = parseCmsCapabilityGrantPageQuery(new URL(input.request.url));

  let read;
  try {
    read = await ports.loadGrants({ request: input.request, query });
  } catch (error) {
    return failureResult(input, query, error, now);
  }
  const parsed = CmsCapabilityGrantListPageSchema.safeParse(read.data);
  if (!parsed.success)
    return {
      kind: 'degraded',
      status: 502,
      page: pageFor({
        request: input.request,
        requestId: input.requestId,
        query,
        state: 'degraded',
        now,
        list: {
          status: 'degraded',
          data: null,
          requestId: input.requestId,
          lastVerifiedAt: null,
          retryable: false,
          httpStatus: 502,
        },
      }),
    };
  const label = await resolveContentSchemaRegistryActingContextLabel({
    actingPartyId: read.actingPartyId,
    now,
    fetchActingContexts: () =>
      Promise.resolve(ports.loadActingContexts({ request: input.request })),
  });
  const list: CmsCapabilityGrantListState =
    parsed.data.items.length === 0
      ? {
          status: 'empty',
          reason: hasFilter(query) ? 'filter-miss' : 'no-records',
        }
      : {
          status: 'success',
          data: parsed.data,
          version: parsed.data.items[0]?.version ?? '1',
          stale: false,
        };
  return {
    kind: 'authorized',
    page: pageFor({
      request: input.request,
      requestId: input.requestId,
      query,
      list,
      state: 'ready',
      now,
      label,
      stepUpFreshUntil: read.stepUpFreshUntil,
    }),
  };
};
