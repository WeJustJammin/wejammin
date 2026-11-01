import type { GovernedReviewDetailResource } from '@wejammin/contracts';
import * as React from 'react';

import CmsWorkflowCommandFrame from '../cms-editorial-workflow/CmsWorkflowCommandFrame';
import { isCommitBlocked } from '../cms-editorial-workflow/cms-workflow-form-state';
import type { WorkflowCommandEnvironment } from '../cms-editorial-workflow/use-cms-workflow-command';
import { GOVERNED_DETAIL_HEADING_IDS } from './CmsGovernedReviewDetail';
import { GOVERNED_COMMAND_SPECS } from './governed-review-command-specs';
import { governedFrameVisible } from './governed-review-form-visibility';
import { useGovernedCommand } from './use-governed-review-command';

export interface CmsGovernedAssignmentRevokeProps {
  readonly review: GovernedReviewDetailResource;
  /** The server permits `revoke_assignment` and an active assignment exists. */
  readonly permitted: boolean;
  readonly disabledReason: string | null;
  readonly refetch: () => Promise<boolean>;
  readonly onDone: (headingId: string) => void;
  readonly environment?: WorkflowCommandEnvironment;
}

/**
 * CMS-03C-08 revoke. Each active assignment is named by its server
 * `reviewerLabel` (never a person identifier) and one button revokes it. A
 * step-up shortfall stores only the assignment record id; on return the same
 * button asks for an explicit confirmation under the original key.
 */
export default function CmsGovernedAssignmentRevoke({
  review,
  permitted,
  disabledReason,
  refetch,
  onDone,
  environment,
}: CmsGovernedAssignmentRevokeProps): React.ReactElement {
  const { controller, state } = useGovernedCommand({
    spec: GOVERNED_COMMAND_SPECS['CMS-03C-08'],
    draftKey: 'CMS-03C-08-revoke',
    ids: { reviewId: review.id },
    refetch,
    onCommitted: () => {
      void refetch().then(() =>
        onDone(GOVERNED_DETAIL_HEADING_IDS.assignments),
      );
    },
    ...(environment === undefined ? {} : { environment }),
  });
  const { version } = review;
  React.useEffect(() => {
    if (permitted) controller.restore(version);
  }, [controller, permitted, version]);
  const restored = state.restoredValues?.assignmentId ?? null;
  const blocked = isCommitBlocked(state, disabledReason);
  const active = review.assignments.filter(
    (assignment) => assignment.state === 'active',
  );
  if (!governedFrameVisible(permitted, state.phase)) return <></>;
  return (
    <CmsWorkflowCommandFrame
      lazyRegion="governed-assignment"
      headingId="governed-assignment-revoke-title"
      title="Revoke an assignment"
      state={state}
      controller={controller}
      pendingLabel="Revoking assignment…"
      committedLabel={() => 'Assignment revoked.'}
      fieldIds={{}}
      disabledReason={disabledReason}
    >
      {/* An action is shown only while the server permits it (FE03 :2678): a refusal keeps the frame for its sentence, not the controls. */}
      {permitted ? (
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
      ) : null}
    </CmsWorkflowCommandFrame>
  );
}
