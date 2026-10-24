import type {
  GovernedActivationRequest,
  GovernedDecisionRequest,
  GovernedReviewAssignmentRequest,
  GovernedReviewQueueQuery,
  GovernedReviewSubmissionRequest,
} from '@wejammin/contracts';
import type { CmsEditorialSession } from '../cms-editorial/types';

/**
 * The input each governed port receives (BE03c rows 168-173). Kept apart from the ports so the
 * dependency type and the production adapters share one definition without a cycle.
 */

export type GovernedPortContext = Readonly<{
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
}>;
export type GovernedSubmitInput = GovernedPortContext &
  Readonly<{
    operationId: 'CMS-03C-06';
    body: GovernedReviewSubmissionRequest;
    idempotencyKey: string;
  }>;
/** `ifMatch` is the decimal operand of the strong `If-Match`, equal to `body.expectedVersion`. */
export type GovernedDecisionInput = GovernedPortContext &
  Readonly<{
    operationId: 'CMS-03C-07';
    reviewId: string;
    body: GovernedDecisionRequest;
    idempotencyKey: string;
    ifMatch: string;
  }>;
export type GovernedAssignmentInput = GovernedPortContext &
  Readonly<{
    operationId: 'CMS-03C-08';
    reviewId: string;
    body: GovernedReviewAssignmentRequest;
    idempotencyKey: string;
    ifMatch: string;
  }>;
/**
 * CMS-03C-09: `body` is the strict request (the Time authority has already verified a scheduled
 * `activateAt`), `ifMatch` the decimal operand of the strong `If-Match` equal to `body.expectedVersion`.
 */
export type GovernedActivationInput = GovernedPortContext &
  Readonly<{
    operationId: 'CMS-03C-09';
    reviewId: string;
    body: GovernedActivationRequest;
    idempotencyKey: string;
    ifMatch: string;
  }>;
export type GovernedDetailInput = GovernedPortContext &
  Readonly<{ operationId: 'CMS-03C-10'; reviewId: string }>;
export type GovernedQueueInput = GovernedPortContext &
  Readonly<{ operationId: 'CMS-03C-11'; query: GovernedReviewQueueQuery }>;
export type GovernedPortInput =
  | GovernedSubmitInput
  | GovernedDecisionInput
  | GovernedAssignmentInput
  | GovernedActivationInput
  | GovernedDetailInput
  | GovernedQueueInput;
