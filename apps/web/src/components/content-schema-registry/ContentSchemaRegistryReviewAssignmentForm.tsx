import * as React from 'react';

import ContentSchemaRegistryCommandForm from './ContentSchemaRegistryCommandForm';
import {
  ASSIGNMENT_HELPER,
  expiryError,
  reviewerError,
  validateAssignment,
  type AssignmentFields,
} from './content-schema-registry-assignment-validation';

export interface ContentSchemaRegistryReviewAssignmentFormProps {
  readonly action: string;
  readonly reviewId: string;
  readonly expectedVersion: string;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
}

const REVIEWER_ID = 'content-schema-registry-reviewer-person-id';
const EXPIRY_ID = 'content-schema-registry-assignment-expires-at';
const REASON_ID = 'content-schema-registry-assignment-reason';

const FieldError = ({
  id,
  message,
}: {
  readonly id: string;
  readonly message: string | null;
}): React.ReactElement | null =>
  message === null ? null : (
    <p id={id} className="content-schema-registry-field-error" role="alert">
      {message}
    </p>
  );

/**
 * CMS-03A-14 create: one native text input for the reviewer's person ID (no
 * protected lookup exists), a bounded expiry and an optional reason. The
 * entered person ID is never echoed, stored or announced after submit.
 */
export default function ContentSchemaRegistryReviewAssignmentForm({
  action,
  reviewId,
  expectedVersion,
  csrfToken,
  idempotencyKey,
}: ContentSchemaRegistryReviewAssignmentFormProps): React.ReactElement {
  const [values, setValues] = React.useState({
    reviewerPersonId: '',
    expiresAt: '',
    reason: '',
  });
  const [errors, setErrors] = React.useState<{
    reviewerPersonId: string | null;
    expiresAt: string | null;
  }>({ reviewerPersonId: null, expiresAt: null });
  const fields = (next = values): AssignmentFields => ({
    expectedVersion,
    ...next,
  });
  const describedBy = (
    error: string | null,
    helper: string,
    errorId: string,
  ) => (error === null ? helper : `${helper} ${errorId}`);
  const onSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    const found = validateAssignment(fields(), Date.now());
    setErrors(found);
    if (found.reviewerPersonId !== null || found.expiresAt !== null)
      event.preventDefault();
  };
  return (
    <ContentSchemaRegistryCommandForm
      action={action}
      csrfToken={csrfToken}
      idempotencyKey={idempotencyKey}
      ifMatch={`"${expectedVersion}"`}
      expectedVersion={expectedVersion}
      operationId="CMS-03A-14"
      formId="content-schema-registry-review-assignment-form"
      consequence="Gives one existing person read and decide access to this review for at most seven days."
      onSubmit={onSubmit}
    >
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      <input type="hidden" name="action" value="create" />
      <legend>Assign a reviewer</legend>
      <div className="content-schema-registry-field">
        <label htmlFor={REVIEWER_ID}>Reviewer person ID</label>
        <input
          id={REVIEWER_ID}
          name="reviewerPersonId"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          pattern="[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}"
          value={values.reviewerPersonId}
          aria-invalid={errors.reviewerPersonId === null ? undefined : 'true'}
          aria-describedby={describedBy(
            errors.reviewerPersonId,
            `${REVIEWER_ID}-help`,
            `${REVIEWER_ID}-error`,
          )}
          onChange={(event) => {
            const next = { ...values, reviewerPersonId: event.target.value };
            setValues(next);
            if (errors.reviewerPersonId !== null)
              setErrors({
                ...errors,
                reviewerPersonId: reviewerError(fields(next)),
              });
          }}
          onBlur={() =>
            setErrors({
              ...errors,
              reviewerPersonId: reviewerError(fields()),
            })
          }
        />
        <p id={`${REVIEWER_ID}-help`} className="content-schema-registry-help">
          {ASSIGNMENT_HELPER}
        </p>
        <FieldError
          id={`${REVIEWER_ID}-error`}
          message={errors.reviewerPersonId}
        />
      </div>
      <div className="content-schema-registry-field">
        <label htmlFor={EXPIRY_ID}>Expires at (UTC)</label>
        <input
          id={EXPIRY_ID}
          name="expiresAt"
          type="text"
          required
          autoComplete="off"
          inputMode="text"
          value={values.expiresAt}
          aria-invalid={errors.expiresAt === null ? undefined : 'true'}
          aria-describedby={describedBy(
            errors.expiresAt,
            `${EXPIRY_ID}-help`,
            `${EXPIRY_ID}-error`,
          )}
          onChange={(event) => {
            const next = { ...values, expiresAt: event.target.value };
            setValues(next);
            if (errors.expiresAt !== null)
              setErrors({
                ...errors,
                expiresAt: expiryError(fields(next), Date.now()),
              });
          }}
        />
        <p id={`${EXPIRY_ID}-help`} className="content-schema-registry-help">
          A UTC instant such as 2026-10-05T12:00:00.000Z, no more than seven
          days from now.
        </p>
        <FieldError id={`${EXPIRY_ID}-error`} message={errors.expiresAt} />
      </div>
      <div className="content-schema-registry-field">
        <label htmlFor={REASON_ID}>Reason (optional)</label>
        <input
          id={REASON_ID}
          name="reason"
          type="text"
          maxLength={256}
          autoComplete="off"
          value={values.reason}
          onChange={(event) =>
            setValues({ ...values, reason: event.target.value })
          }
        />
      </div>
    </ContentSchemaRegistryCommandForm>
  );
}
