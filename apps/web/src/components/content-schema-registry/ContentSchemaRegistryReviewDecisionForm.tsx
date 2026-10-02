import * as React from 'react';

import ContentSchemaRegistryCommandForm from './ContentSchemaRegistryCommandForm';
import ContentSchemaRegistryStepUpDisclosure from './ContentSchemaRegistryStepUpDisclosure';
import type { ContentSchemaRegistryStepUpState } from './ContentSchemaRegistryConfirmationStep';

export interface ContentSchemaRegistryReviewDecisionFormProps {
  readonly action: string;
  readonly reviewId: string;
  readonly expectedVersion: string;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  readonly stepUpState: ContentSchemaRegistryStepUpState;
  readonly stepUpFreshUntil?: string | undefined;
  readonly actingContextLabel?: string | undefined;
}

const StepUp = ({
  state,
  freshUntil,
}: {
  readonly state: ContentSchemaRegistryStepUpState;
  readonly freshUntil: string | undefined;
}): React.ReactElement =>
  state === 'pending' ? (
    <span>Verification pending</span>
  ) : state === 'verified' ? (
    <ContentSchemaRegistryStepUpDisclosure freshUntil={freshUntil} />
  ) : (
    <span>Step-up required before commit</span>
  );

/**
 * CMS-03A-12: native approve/reject radios with no default. The reviewer, the
 * capability and the evidence are server-derived; the form carries only the
 * decision and the review version it was read at.
 */
export default function ContentSchemaRegistryReviewDecisionForm({
  action,
  reviewId,
  expectedVersion,
  csrfToken,
  idempotencyKey,
  stepUpState,
  stepUpFreshUntil,
  actingContextLabel,
}: ContentSchemaRegistryReviewDecisionFormProps): React.ReactElement {
  return (
    <ContentSchemaRegistryCommandForm
      action={action}
      csrfToken={csrfToken}
      idempotencyKey={idempotencyKey}
      ifMatch={`"${expectedVersion}"`}
      expectedVersion={expectedVersion}
      operationId="CMS-03A-12"
      formId="content-schema-registry-review-decision-form"
      consequence="Records your approve or reject decision on the frozen evidence; a decision cannot be changed."
    >
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      <legend>Record your decision</legend>
      <label htmlFor="content-schema-registry-decision-approve">
        <input
          id="content-schema-registry-decision-approve"
          type="radio"
          name="decision"
          value="approve"
          required
        />{' '}
        Approve the frozen evidence
      </label>
      <label htmlFor="content-schema-registry-decision-reject">
        <input
          id="content-schema-registry-decision-reject"
          type="radio"
          name="decision"
          value="reject"
          required
        />{' '}
        Reject and return the candidate to a draft
      </label>
      <dl>
        <dt>Acting context</dt>
        <dd>
          {actingContextLabel === undefined || actingContextLabel.length === 0
            ? 'Server-verified acting context unavailable'
            : actingContextLabel}
        </dd>
        <dt>Step-up</dt>
        <dd>
          <StepUp state={stepUpState} freshUntil={stepUpFreshUntil} />
        </dd>
      </dl>
    </ContentSchemaRegistryCommandForm>
  );
}
