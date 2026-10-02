import * as React from 'react';

import ContentSchemaRegistryCommandForm from './ContentSchemaRegistryCommandForm';
import type { SchemaReviewResource } from './content-schema-registry-types';

type AssignmentSummary = SchemaReviewResource['assignments'][number];

export interface ContentSchemaRegistryReviewAssignmentsProps {
  readonly action: string;
  readonly reviewId: string;
  readonly expectedVersion: string;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  readonly assignments: readonly AssignmentSummary[];
}

const STATE_COPY: Readonly<Record<AssignmentSummary['state'], string>> = {
  active: 'Active',
  revoked: 'Revoked',
};

const RevokeForm = ({
  assignment,
  index,
  ...shared
}: Omit<ContentSchemaRegistryReviewAssignmentsProps, 'assignments'> & {
  readonly assignment: AssignmentSummary;
  readonly index: number;
}): React.ReactElement => {
  const formId = `content-schema-registry-review-assignment-revoke-${index}`;
  const reasonId = `${formId}-reason`;
  return (
    <ContentSchemaRegistryCommandForm
      action={shared.action}
      csrfToken={shared.csrfToken}
      idempotencyKey={`${shared.idempotencyKey}-revoke-${assignment.assignmentId}`}
      ifMatch={`"${shared.expectedVersion}"`}
      expectedVersion={shared.expectedVersion}
      operationId="CMS-03A-14"
      formId={formId}
      instanceKey={`revoke-${index}`}
      consequence={`Revoke ${assignment.reviewerLabel}'s access to this review now. A decision already recorded stays; the reviewer can no longer read or decide.`}
    >
      <input type="hidden" name="reviewId" value={shared.reviewId} />
      <input
        type="hidden"
        name="expectedVersion"
        value={shared.expectedVersion}
      />
      <input type="hidden" name="action" value="revoke" />
      <input
        type="hidden"
        name="assignmentId"
        value={assignment.assignmentId}
      />
      <legend>Revoke {assignment.reviewerLabel}</legend>
      <div className="content-schema-registry-field">
        <label htmlFor={reasonId}>Reason (optional)</label>
        <input
          id={reasonId}
          name="reason"
          type="text"
          maxLength={256}
          autoComplete="off"
        />
      </div>
    </ContentSchemaRegistryCommandForm>
  );
};

/**
 * Owner-only list of the reviewer assignments on one open review (the safe
 * `assignments[]` summary: display label and window, never a person
 * identifier) with a revoke form per active assignment (CMS-03A-14 revoke).
 */
export default function ContentSchemaRegistryReviewAssignments({
  assignments,
  ...shared
}: ContentSchemaRegistryReviewAssignmentsProps): React.ReactElement {
  return (
    <section
      className="content-schema-registry-review-assignments"
      aria-label="Reviewer assignments"
    >
      <h3>Reviewer assignments</h3>
      {assignments.length === 0 ? (
        <p>No reviewer is assigned to this review yet.</p>
      ) : (
        <ul>
          {assignments.map((assignment, index) => (
            <li key={assignment.assignmentId}>
              <p>
                <strong>{assignment.reviewerLabel}</strong>{' '}
                <span>{STATE_COPY[assignment.state]}</span>
              </p>
              <p className="content-schema-registry-help">
                From{' '}
                <time dateTime={assignment.startsAt}>
                  {assignment.startsAt}
                </time>{' '}
                until{' '}
                <time dateTime={assignment.endsAt}>{assignment.endsAt}</time>{' '}
                (UTC).
              </p>
              {assignment.state === 'active' ? (
                <RevokeForm {...shared} assignment={assignment} index={index} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
