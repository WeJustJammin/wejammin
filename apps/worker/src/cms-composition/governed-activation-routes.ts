import {
  GovernedActivationHeadersSchema,
  GovernedActivationRequestSchema,
  governedActivationSuccessStatus,
  type GovernedActivationRequest,
  type GovernedActivationResource,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { timeAuthorityOf } from '../cms-editorial/workflow-time-authority';
import {
  registerGovernedCommand,
  type CommandSpec,
} from './governed-review-command-routes';
import {
  failure,
  type CmsGovernedReviewDependencies,
  type GovernedActivationInput,
  type GovernedError,
} from './governed-review-ports';
import { validGovernedActivation } from './governed-review-validate';

type ActivationSpec = CommandSpec<
  GovernedActivationRequest,
  GovernedActivationResource,
  GovernedActivationInput
>;

const SCHEDULE_POINTER = '/activateAt';

/**
 * The Worker half of the time rules of a scheduled activation (BE03b E8, BE03c 1326 step 6): the zone,
 * the pinned tzdb version, a gap or fold, the resolved instant and the 60 s to 366 d horizon are
 * verified over the pinned snapshot before the RPC, which re-checks only what needs no tz rules.
 * `activate` and `retire` carry no instant and never consult the authority. No authority (a corrupted
 * or swapped snapshot) is 503, never a guess.
 */
const verifySchedule: NonNullable<ActivationSpec['prepare']> = async ({
  dependencies,
  body,
  nowMs,
}): Promise<GovernedError | null> => {
  if (body.action !== 'schedule') return null;
  try {
    const authority = await timeAuthorityOf(dependencies);
    if (authority === null) return failure(503, {}, 15);
    const resolution = authority.resolveSchedule(body.activateAt, nowMs);
    if (resolution.ok) return null;
    return failure(422, {
      ...resolution.details,
      violations: [
        {
          path: `${SCHEDULE_POINTER}${resolution.pointer}`,
          code: resolution.details.reasonCode,
          message: 'The value is invalid.',
        },
      ],
    });
  } catch {
    return failure(503, {}, 15);
  }
};

/**
 * CMS-03C-09 `POST /api/v1/cms/governed-reviews/{reviewId}/activation` (BE03c row 171): `activate`
 * 200, `schedule` 202 (no event), `retire` 200 (DEC-190: an active subject only, no fresh approval,
 * the review `version` advances by one, like an activation, and is the 200's ETag). The strong
 * If-Match is the review `version`. The Worker forwards every action unchanged and maps whatever
 * the database answers, with no per-action special case; `subject_not_retirable` is the closed 409
 * token of an inactive subject.
 */
export const registerGovernedActivationRoute = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsGovernedReviewDependencies,
): void => {
  registerGovernedCommand<
    E,
    GovernedActivationRequest,
    GovernedActivationResource,
    GovernedActivationInput
  >(app, dependencies, {
    operation: 'CMS-03C-09',
    bodySchema: GovernedActivationRequestSchema,
    headersSchema: GovernedActivationHeadersSchema,
    agree: () => true,
    prepare: verifySchedule,
    activation: (body, resource) => ({
      action: body.action,
      subjectKind: resource?.subjectKind ?? 'unknown',
    }),
    port: (deps) => deps.activateReview,
    build: (base, reviewId, body, headers) => ({
      ...base,
      operationId: 'CMS-03C-09',
      reviewId,
      body,
      idempotencyKey: headers.idempotencyKey,
      ifMatch: headers.ifMatchOperand,
    }),
    accept: (resource, reviewId, body) =>
      validGovernedActivation(resource, reviewId, body)
        ? {
            resource,
            status: governedActivationSuccessStatus(body.action),
            etag: resource.reviewVersion,
            location: `/api/v1/cms/governed-reviews/${reviewId}`,
          }
        : null,
  });
};
