import {
  GovernedActivationApiRequestSchema,
  GovernedDecisionApiRequestSchema,
  GovernedReviewAssignmentApiRequestSchema,
  GovernedReviewSubmissionApiRequestSchema,
} from '@wejammin/contracts';
import {
  callGovernedRpc,
  type GovernedTransport,
} from './cms-composition-production-governed-review-rpc';
import {
  failure,
  type CmsGovernedReviewDependencies,
} from './cms-composition/governed-review-ports';
import {
  validGovernedActivation,
  validGovernedAssignment,
  validGovernedDecision,
  validGovernedDetail,
  validGovernedPage,
  validGovernedSubmission,
} from './cms-composition/governed-review-validate';

type Ports = Pick<
  CmsGovernedReviewDependencies,
  | 'submitReview'
  | 'recordDecision'
  | 'assignReviewer'
  | 'activateReview'
  | 'readReview'
  | 'listReviews'
>;

/** The transport view the registry row publishes: key and the exact strong If-Match. */
const commandHeaders = (idempotencyKey: string, ifMatch: string) => ({
  contentType: 'application/json',
  idempotencyKey,
  ifMatch: `"${ifMatch}"`,
});

/**
 * The six governed ports over the `platform_api` RPCs. Each re-parses its input against
 * the frozen transport schema, sends exactly the `p_request` members the SQL producer
 * accepts (its exact-key check refuses anything else) and binds the answer to the request.
 * A write is never retried, and a read answers nothing it was not asked.
 */
export const createGovernedPorts = (transport: GovernedTransport): Ports => ({
  submitReview: async (input, signal) => {
    const parsed = GovernedReviewSubmissionApiRequestSchema.safeParse({
      body: input.body,
      headers: {
        contentType: 'application/json',
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (!parsed.success) return failure(400);
    const result = await callGovernedRpc(
      transport,
      input,
      {
        ...parsed.data.body,
        idempotencyKey: parsed.data.headers.idempotencyKey,
      },
      signal,
      parsed.data.headers.idempotencyKey,
    );
    if (!result.ok) return result;
    return validGovernedSubmission(result.value, parsed.data.body)
      ? { ok: true, value: result.value }
      : failure(502);
  },
  recordDecision: async (input, signal) => {
    const parsed = GovernedDecisionApiRequestSchema.safeParse({
      reviewId: input.reviewId,
      headers: commandHeaders(input.idempotencyKey, input.ifMatch),
      body: input.body,
    });
    if (!parsed.success) return failure(400);
    const result = await callGovernedRpc(
      transport,
      input,
      {
        ...parsed.data.body,
        ifMatch: input.ifMatch,
        idempotencyKey: input.idempotencyKey,
      },
      signal,
      input.idempotencyKey,
    );
    if (!result.ok) return result;
    return validGovernedDecision(result.value, input.reviewId, parsed.data.body)
      ? { ok: true, value: result.value }
      : failure(502);
  },
  assignReviewer: async (input, signal) => {
    const parsed = GovernedReviewAssignmentApiRequestSchema.safeParse({
      reviewId: input.reviewId,
      headers: commandHeaders(input.idempotencyKey, input.ifMatch),
      body: input.body,
    });
    if (!parsed.success) return failure(400);
    const result = await callGovernedRpc(
      transport,
      input,
      {
        reviewId: input.reviewId,
        ...parsed.data.body,
        ifMatch: input.ifMatch,
        idempotencyKey: input.idempotencyKey,
      },
      signal,
      input.idempotencyKey,
    );
    if (!result.ok) return result;
    return validGovernedAssignment(
      result.value,
      input.reviewId,
      parsed.data.body,
    )
      ? { ok: true, value: result.value }
      : failure(502);
  },
  activateReview: async (input, signal) => {
    const parsed = GovernedActivationApiRequestSchema.safeParse({
      reviewId: input.reviewId,
      headers: commandHeaders(input.idempotencyKey, input.ifMatch),
      body: input.body,
    });
    if (!parsed.success) return failure(400);
    const result = await callGovernedRpc(
      transport,
      input,
      {
        reviewId: input.reviewId,
        ...parsed.data.body,
        ifMatch: input.ifMatch,
        idempotencyKey: input.idempotencyKey,
      },
      signal,
      input.idempotencyKey,
    );
    if (!result.ok) return result;
    return validGovernedActivation(
      result.value,
      input.reviewId,
      parsed.data.body,
    )
      ? { ok: true, value: result.value }
      : failure(502);
  },
  readReview: async (input, signal) => {
    const result = await callGovernedRpc(
      transport,
      input,
      { reviewId: input.reviewId },
      signal,
      null,
    );
    if (!result.ok) return result;
    return validGovernedDetail(result.value, input.reviewId)
      ? { ok: true, value: result.value }
      : failure(502);
  },
  listReviews: async (input, signal) => {
    const { cursor, ...rest } = input.query;
    const result = await callGovernedRpc(
      transport,
      input,
      {
        ...rest,
        ...(cursor === null || cursor === undefined ? {} : { cursor }),
      },
      signal,
      null,
    );
    if (!result.ok) return result;
    return validGovernedPage(result.value, input.query)
      ? { ok: true, value: result.value }
      : failure(502);
  },
});
