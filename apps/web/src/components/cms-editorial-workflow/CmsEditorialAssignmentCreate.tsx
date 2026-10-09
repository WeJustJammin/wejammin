import * as React from 'react';

import CmsWorkflowCommandFrame, {
  type WorkflowLocalError,
} from './CmsWorkflowCommandFrame';
import {
  WorkflowSelect,
  WorkflowTextArea,
  WorkflowTextField,
} from './CmsWorkflowFields';
import { REVIEW_DETAIL_HEADING_IDS } from './CmsEditorialReviewDetail';
import { WORKFLOW_COMMAND_SPECS } from './cms-workflow-command-specs';
import { parseAssignmentExpiry } from './cms-workflow-expiry';
import { isCommitBlocked } from './cms-workflow-form-state';
import {
  ASSIGNMENT_REASON_MAX,
  countCharacters,
  validateAssignmentReason,
} from './cms-workflow-reason';
import type { ReviewerOptionsResult } from './cms-workflow-reviewer-options';
import { useDraftFields } from './use-cms-workflow-draft-fields';
import {
  useWorkflowCommand,
  type WorkflowCommandEnvironment,
} from './use-cms-workflow-command';

export interface CmsEditorialAssignmentCreateProps {
  readonly reviewId: string;
  readonly version: string;
  readonly disabledReason: string | null;
  readonly refetch: () => Promise<boolean>;
  readonly onDone: (headingId: string) => void;
  readonly environment?: WorkflowCommandEnvironment;
  readonly now: () => number;
  readonly loadOptions: () => Promise<ReviewerOptionsResult>;
}

/**
 * CMS-03B-18 create. The reviewer choice comes from the owner-only grant list
 * and the chosen person id exists only in this component's state: it is never
 * in a URL, a prop, storage or a log, and it is discarded on a step-up
 * navigation (only the expiry and the reason are stored, and the person is
 * asked for again on return).
 */
export default function CmsEditorialAssignmentCreate({
  reviewId,
  version,
  disabledReason,
  refetch,
  onDone,
  environment,
  now,
  loadOptions,
}: CmsEditorialAssignmentCreateProps): React.ReactElement {
  const [reviewers, setReviewers] =
    React.useState<ReviewerOptionsResult | null>(null);
  const [personId, setPersonId] = React.useState('');
  const [localErrors, setLocalErrors] = React.useState<
    readonly WorkflowLocalError[]
  >([]);
  const { controller, state } = useWorkflowCommand({
    spec: WORKFLOW_COMMAND_SPECS['CMS-03B-18'],
    draftKey: 'CMS-03B-18-create',
    ids: { reviewId },
    refetch,
    onCommitted: () => {
      void refetch().then(() => onDone(REVIEW_DETAIL_HEADING_IDS.assignments));
    },
    ...(environment === undefined ? {} : { environment }),
  });
  React.useEffect(() => {
    let current = true;
    void loadOptions().then((result) => {
      if (current) setReviewers(result);
    });
    return () => {
      current = false;
    };
  }, [loadOptions]);
  React.useEffect(() => {
    controller.restore(version);
  }, [controller, version]);
  const fields = useDraftFields(state.restoredValues);
  const expires = fields.value('expiresAt');
  const reason = fields.value('reason');

  const blocked = isCommitBlocked(state, disabledReason);
  const chosen =
    reviewers?.kind === 'ok'
      ? (reviewers.options.find((option) => option.personId === personId) ??
        null)
      : null;
  const errorOf = (id: string): string | null =>
    localErrors.find((error) => error.id === id)?.message ?? null;
  const named = state.refusal?.fields ?? [];
  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (blocked) return;
    const found: WorkflowLocalError[] = [];
    if (chosen === null)
      found.push({
        id: 'assignment-reviewer',
        label: 'Reviewer',
        message: 'Choose a reviewer.',
      });
    const expiry = parseAssignmentExpiry(
      expires,
      now(),
      chosen?.endsAt ?? null,
    );
    if (!expiry.ok)
      found.push({
        id: 'assignment-expires',
        label: 'Assignment ends',
        message: expiry.message,
      });
    const reasonError = validateAssignmentReason(reason);
    if (reasonError !== null)
      found.push({
        id: 'assignment-reason',
        label: 'Reason (optional)',
        message: reasonError,
      });
    setLocalErrors(found);
    if (chosen === null || !expiry.ok || found.length > 0) return;
    void controller.submit({
      body: {
        action: 'create',
        expectedVersion: version,
        reviewerPersonId: chosen.personId,
        expiresAt: expiry.instant,
        ...(reason === '' ? {} : { reason }),
      },
      ifMatch: `"${version}"`,
      // The reviewer is deliberately absent: a person id is never stored.
      draft: { expiresAt: expires, reason },
    });
  };
  const startAnother = (): void => {
    controller.startOver();
    setPersonId('');
    fields.reset();
  };
  return (
    <CmsWorkflowCommandFrame
      headingId="assignment-create-title"
      title="Assign a reviewer"
      state={state}
      controller={controller}
      pendingLabel="Assigning reviewer…"
      committedLabel={(resource) =>
        `Reviewer assigned until ${resource.expiresAt}.`
      }
      fieldIds={{
        reviewerPersonId: { id: 'assignment-reviewer', label: 'Reviewer' },
        expiresAt: { id: 'assignment-expires', label: 'Assignment ends' },
        reason: { id: 'assignment-reason', label: 'Reason (optional)' },
      }}
      localErrors={localErrors}
      disabledReason={disabledReason}
    >
      {reviewers === null ? <p>Loading reviewers…</p> : null}
      {reviewers?.kind === 'unavailable' ? (
        <p>Reviewer choices could not be loaded. Reload the page.</p>
      ) : null}
      {reviewers?.kind === 'ok' && reviewers.options.length === 0 ? (
        <p>
          No reviewer has an active cms.reviewer grant.{' '}
          <a href="/app/cms-content-modeling/capability-grants">Grant access</a>
        </p>
      ) : null}
      {state.restoredValues !== null && personId === '' ? (
        <p>Choose the reviewer again.</p>
      ) : null}
      <form onSubmit={submit}>
        <WorkflowSelect
          id="assignment-reviewer"
          label="Reviewer"
          value={personId}
          error={errorOf('assignment-reviewer')}
          invalid={named.includes('reviewerPersonId')}
          options={[
            { value: '', label: 'Choose a reviewer' },
            ...(reviewers?.kind === 'ok' ? reviewers.options : []).map(
              (option) => ({
                value: option.personId,
                label: `${option.personId} (access ends ${option.endsAt})`,
              }),
            ),
          ]}
          onChange={setPersonId}
        />
        <WorkflowTextField
          id="assignment-expires"
          label="Assignment ends"
          type="datetime-local"
          value={expires}
          hint="Up to seven days from now, and not after the reviewer’s access ends."
          error={errorOf('assignment-expires')}
          invalid={named.includes('expiresAt')}
          onChange={(value) => fields.set('expiresAt', value)}
        />
        <WorkflowTextArea
          id="assignment-reason"
          label="Reason (optional)"
          value={reason}
          counter={{
            used: countCharacters(reason),
            max: ASSIGNMENT_REASON_MAX,
          }}
          error={errorOf('assignment-reason')}
          onChange={(value) => fields.set('reason', value)}
        />
        <button
          type="submit"
          aria-disabled={blocked ? 'true' : 'false'}
          aria-busy={state.phase === 'pending' ? 'true' : 'false'}
        >
          Assign reviewer
        </button>{' '}
        {state.phase === 'committed' ? (
          <button type="button" onClick={startAnother}>
            Assign another reviewer
          </button>
        ) : null}
      </form>
    </CmsWorkflowCommandFrame>
  );
}
