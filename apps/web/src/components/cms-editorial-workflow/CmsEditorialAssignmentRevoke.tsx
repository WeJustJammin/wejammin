import type { EditorialReviewDetailResource } from '@wejammin/contracts';
import * as React from 'react';

import CmsWorkflowCommandFrame from './CmsWorkflowCommandFrame';
import { REVIEW_DETAIL_HEADING_IDS } from './CmsEditorialReviewDetail';
import { WORKFLOW_COMMAND_SPECS } from './cms-workflow-command-specs';
import { isCommitBlocked } from './cms-workflow-form-state';
import {
  useWorkflowCommand,
  type WorkflowCommandEnvironment,
} from './use-cms-workflow-command';

export interface CmsEditorialAssignmentRevokeProps {
  readonly review: EditorialReviewDetailResource;
  readonly disabledReason: string | null;
  readonly refetch: () => Promise<boolean>;
  readonly onDone: (headingId: string) => void;
  readonly environment?: WorkflowCommandEnvironment;
}

/**
 * CMS-03B-18 revoke. Each active assignment is named by its server
 * `reviewerLabel` (never a person identifier) and one button revokes it. A
 * step-up shortfall stores only the assignment record id; on return the same
 * button asks for an explicit confirmation under the original key.
 */
export default function CmsEditorialAssignmentRevoke({
  review,
  disabledReason,
  refetch,
  onDone,
  environment,
}: CmsEditorialAssignmentRevokeProps): React.ReactElement {
  const { controller, state } = useWorkflowCommand({
    spec: WORKFLOW_COMMAND_SPECS['CMS-03B-18'],
    draftKey: 'CMS-03B-18-revoke',
    ids: { reviewId: review.id },
    refetch,
    onCommitted: () => {
      void refetch().then(() => onDone(REVIEW_DETAIL_HEADING_IDS.assignments));
    },
    ...(environment === undefined ? {} : { environment }),
  });
  const { version } = review;
  React.useEffect(() => {
    controller.restore(version);
  }, [controller, version]);
  const restored = state.restoredValues?.assignmentId ?? null;

  const blocked = isCommitBlocked(state, disabledReason);
  const active = review.assignments.filter(
    (assignment) => assignment.state === 'active',
  );
  return (
    <CmsWorkflowCommandFrame
      headingId="assignment-revoke-title"
      title="Revoke an assignment"
      state={state}
      controller={controller}
      pendingLabel="Revoking assignment…"
      committedLabel={() => 'Assignment revoked.'}
      fieldIds={{}}
      disabledReason={disabledReason}
    >
      <ul>
        {active.map((assignment) => (
          <li key={assignment.assignmentId}>
            {assignment.reviewerLabel}, ends{' '}
            <time dateTime={assignment.endsAt}>{assignment.endsAt}</time>{' '}
            <button
              type="button"
              aria-disabled={blocked ? 'true' : 'false'}
              onClick={() => {
                if (blocked) return;
                void controller.submit({
                  body: {
                    action: 'revoke',
                    expectedVersion: version,
                    assignmentId: assignment.assignmentId,
                  },
                  ifMatch: `"${version}"`,
                  draft: { assignmentId: assignment.assignmentId },
                });
              }}
            >
              {restored === assignment.assignmentId
                ? `Confirm revoke ${assignment.reviewerLabel}`
                : `Revoke ${assignment.reviewerLabel}`}
            </button>
          </li>
        ))}
      </ul>
    </CmsWorkflowCommandFrame>
  );
}
