import { SchemaReviewResourceSchema } from '@wejammin/contracts';
import type { SchemaReviewResource } from '@wejammin/contracts';

import type { ContentSchemaRegistryReviewState } from '../components/content-schema-registry/content-schema-registry-review-types';
import { resolveContentSchemaRegistryActingContextLabel } from './content-schema-registry-acting-context';
import { ContentSchemaRegistryListQuerySchema } from './content-schema-registry-contracts';
import {
  platformFailure,
  platformOutcome,
} from './content-schema-registry-context-outcomes';
import {
  pageFor,
  type ContentSchemaRegistryResult,
} from './content-schema-registry-context-presentation';
import { SessionSchema } from './content-schema-registry-context-types';
import type { ContentSchemaRegistryAuthority } from './content-schema-registry-context-types';
import { isSafeUuid } from './content-schema-registry-platform-shared';
import type { ContentSchemaRegistryPresentationVariant } from './content-schema-registry-platform-shared';
import type { ContentSchemaReviewPorts } from './content-schema-review-platform-api';

export interface ResolveReviewInput {
  readonly request: Request;
  readonly reviewId: string | undefined;
  readonly ports: ContentSchemaReviewPorts | null;
  readonly requestId: string;
  readonly now?: (() => number) | undefined;
}

const DESIGNER = 'cms.schema_designer';
const REVIEWER = 'cms.schema_review';
/** BE03a CMS-03A-13: submitter/designer scope or assigned review-only scope. */
const hasReviewScope = (capabilities: readonly string[]): boolean =>
  capabilities.includes(DESIGNER) || capabilities.includes(REVIEWER);

const reviewPath = (reviewId: string): string =>
  `/app/cms-content-modeling/schema-reviews/${encodeURIComponent(reviewId)}`;

const emptyQuery = ContentSchemaRegistryListQuerySchema.parse({});

const failurePage = (
  input: ResolveReviewInput,
  reviewId: string,
  review: ContentSchemaRegistryReviewState,
  now: number,
) =>
  pageFor({
    request: input.request,
    requestId: input.requestId,
    query: emptyQuery,
    list: { status: 'empty', reason: 'no-records' },
    detail: null,
    review,
    reviewId,
    canonicalUrl: reviewPath(reviewId),
    retryUrl: reviewPath(reviewId),
    contentTypeId: null,
    versionId: null,
    state: 'degraded',
    now,
  });

const failureResult = (
  input: ResolveReviewInput,
  reviewId: string,
  error: unknown,
  now: number,
): ContentSchemaRegistryResult => {
  const concealed = platformFailure(error);
  if (concealed !== null) return concealed;
  const outcome = platformOutcome(error, input.requestId);
  if (outcome?.kind === 'error') {
    const page = failurePage(
      input,
      reviewId,
      {
        status: 'error',
        error: outcome.error,
        retryable: outcome.retryable,
        httpStatus: outcome.status,
        retryAfterSeconds: outcome.retryAfterSeconds,
      },
      now,
    );
    return { kind: 'error', page, status: outcome.status };
  }
  const status = outcome?.status ?? 503;
  const page = failurePage(
    input,
    reviewId,
    {
      status: 'degraded',
      data: null,
      requestId: input.requestId,
      lastVerifiedAt: null,
      retryable: outcome?.retryable ?? false,
      httpStatus: status,
      ...(outcome?.retryAfterSeconds == null
        ? {}
        : { retryAfterSeconds: outcome.retryAfterSeconds }),
    },
    now,
  );
  return { kind: 'degraded', page, status };
};

/**
 * FE03 `/app/cms-content-modeling/schema-reviews/:reviewId` resolver. The
 * server verifies the session and the review scope before any HTML; a
 * malformed id is 400, a concealed or mismatched review 404, a visible review
 * without scope 403. The page carries safe display context only.
 */
export const resolveContentSchemaReviewPage = async (
  input: ResolveReviewInput,
): Promise<ContentSchemaRegistryResult> => {
  const { ports } = input;
  if (input.request.method !== 'GET') return { kind: 'invalid_record' };
  if (ports === null) {
    return { kind: 'unauthenticated', reason: 'missing_session' };
  }
  const now = (input.now ?? ports.now)();
  const session = SessionSchema.safeParse(
    await ports.verifySession(input.request),
  );
  if (!session.success || session.data.expiresAt <= ports.now())
    return { kind: 'unauthenticated', reason: 'missing_session' };
  const { reviewId } = input;
  if (reviewId === undefined || !isSafeUuid(reviewId))
    return { kind: 'invalid_record' };

  let read;
  try {
    read = await ports.loadReview({ request: input.request, reviewId });
  } catch (error) {
    return failureResult(input, reviewId, error, now);
  }
  const parsed = SchemaReviewResourceSchema.safeParse(read.data);
  if (!parsed.success) {
    const page = failurePage(
      input,
      reviewId,
      {
        status: 'degraded',
        data: null,
        requestId: input.requestId,
        lastVerifiedAt: null,
        retryable: false,
        httpStatus: 502,
      },
      now,
    );
    return { kind: 'degraded', page, status: 502 };
  }
  if (parsed.data.id !== reviewId) return { kind: 'not_found' };
  if (!hasReviewScope(read.capabilities)) return { kind: 'forbidden' };
  // The assignment summary is an owner-only projection: keep it only where the
  // server lets this caller assign; an upstream slip never reaches the island.
  const review: SchemaReviewResource =
    parsed.data.permittedNextActions.includes('assign_reviewer')
      ? parsed.data
      : { ...parsed.data, assignments: [] };

  const designer = read.capabilities.includes(DESIGNER);
  const variant: ContentSchemaRegistryPresentationVariant =
    read.presentationVariant ??
    (designer ? 'ownerFull' : 'schemaReviewAssigned');
  const authority: ContentSchemaRegistryAuthority = {
    serverVerified: true,
    capabilities: [...read.capabilities],
    presentationVariant: variant,
    ...(read.stepUpFreshUntil === null
      ? {}
      : { stepUpFreshUntil: read.stepUpFreshUntil }),
  };
  const label = await resolveContentSchemaRegistryActingContextLabel({
    actingPartyId: read.actingPartyId,
    now,
    fetchActingContexts: () =>
      Promise.resolve(ports.loadActingContexts({ request: input.request })),
  });
  return {
    kind: 'authorized',
    page: pageFor({
      request: input.request,
      requestId: input.requestId,
      authority,
      query: emptyQuery,
      list: { status: 'empty', reason: 'no-records' },
      detail: null,
      review: {
        status: 'success',
        data: review,
        version: review.version,
        stale: false,
      },
      reviewId,
      canonicalUrl: reviewPath(reviewId),
      retryUrl: reviewPath(reviewId),
      contentTypeId: null,
      versionId: null,
      state: 'ready',
      now,
      ...(label === null ? {} : { actingContextLabel: label }),
    }),
  };
};
