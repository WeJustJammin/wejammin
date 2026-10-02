import { SchemaReviewResourceSchema } from '@wejammin/contracts';

import type { ContentSchemaRegistryReviewState } from '../components/content-schema-registry/content-schema-registry-review-types';
import {
  platformOutcome,
  type PlatformOutcome,
} from './content-schema-registry-context-outcomes';
import type {
  ContentSchemaRegistryAuthority,
  ContentSchemaRegistryPorts,
  ContentSchemaRegistrySession,
} from './content-schema-registry-context-types';
import {
  isContentSchemaRegistryPlatformError,
  isSafeUuid,
} from './content-schema-registry-platform-shared';

/**
 * FE03 `reviewState` (CMS-03A-13). The review is a separate read keyed by the
 * detail's `activationPreparation.reviewRef`; a failure here degrades only the
 * review panel and never the version page. The review id is a protected
 * path identifier the server holds and validates before any upstream call.
 */

const degraded = (
  requestId: string,
  outcome: Extract<PlatformOutcome, { readonly kind: 'degraded' }> | null,
): ContentSchemaRegistryReviewState => ({
  status: 'degraded',
  data: null,
  requestId,
  lastVerifiedAt: null,
  retryable: outcome?.retryable ?? false,
  httpStatus: outcome?.status ?? 503,
  ...(outcome?.retryAfterSeconds === undefined ||
  outcome.retryAfterSeconds === null
    ? {}
    : { retryAfterSeconds: outcome.retryAfterSeconds }),
});

const stateForFailure = (
  error: unknown,
  requestId: string,
): ContentSchemaRegistryReviewState => {
  if (
    isContentSchemaRegistryPlatformError(error) &&
    (error.kind === 'not_found' || error.kind === 'forbidden')
  )
    return { status: 'empty', reason: 'not-disclosed' };
  const outcome = platformOutcome(error, requestId);
  if (outcome === null) return degraded(requestId, null);
  if (outcome.kind === 'degraded') return degraded(requestId, outcome);
  return {
    status: 'error',
    error: outcome.error,
    retryable: outcome.retryable,
    httpStatus: outcome.status,
    retryAfterSeconds: outcome.retryAfterSeconds,
  };
};

export const readContentSchemaRegistryReview = async (input: {
  readonly ports: ContentSchemaRegistryPorts;
  readonly request: Request;
  readonly session: ContentSchemaRegistrySession;
  readonly authority: ContentSchemaRegistryAuthority;
  readonly reviewId: string | null;
  readonly requestId: string;
}): Promise<ContentSchemaRegistryReviewState | null> => {
  const { ports, reviewId } = input;
  if (reviewId === null || ports.loadReview === undefined) return null;
  if (!isSafeUuid(reviewId))
    return { status: 'empty', reason: 'not-disclosed' };
  try {
    const parsed = SchemaReviewResourceSchema.safeParse(
      await ports.loadReview({
        request: input.request,
        session: input.session,
        authority: input.authority,
        reviewId,
      }),
    );
    if (!parsed.success) return degraded(input.requestId, null);
    if (parsed.data.id !== reviewId)
      return { status: 'empty', reason: 'not-disclosed' };
    return {
      status: 'success',
      data: parsed.data,
      version: parsed.data.version,
      stale: false,
    };
  } catch (error) {
    return stateForFailure(error, input.requestId);
  }
};
