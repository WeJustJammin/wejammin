import * as React from 'react';

import { withCmsValidators } from '../../lib/cms-contract-validators';
import CmsWorkflowCommandFrame, {
  type WorkflowLocalError,
} from '../cms-editorial-workflow/CmsWorkflowCommandFrame';
import { parseAssignmentExpiry } from '../cms-editorial-workflow/cms-workflow-expiry';
import {
  isCommitBlocked,
  validatorsUnavailableError,
} from '../cms-editorial-workflow/cms-workflow-form-state';
import { validateAssignmentReason } from '../cms-editorial-workflow/cms-workflow-reason';
import type { ReviewerOptionsResult } from '../cms-editorial-workflow/cms-workflow-reviewer-options';
import type { WorkflowCommandEnvironment } from '../cms-editorial-workflow/use-cms-workflow-command';
import { useReviewerOptions } from '../cms-editorial-workflow/use-reviewer-options';
import { useDraftFields } from '../cms-editorial-workflow/use-cms-workflow-draft-fields';
import CmsGovernedAssignmentFields, {
  ASSIGNMENT_EXPIRES,
  ASSIGNMENT_REASON,
  ASSIGNMENT_REVIEWER,
} from './CmsGovernedAssignmentFields';
import { GOVERNED_DETAIL_HEADING_IDS } from './CmsGovernedReviewDetail';
import { GOVERNED_COMMAND_SPECS } from './governed-review-command-specs';
import { governedFrameVisible } from './governed-review-form-visibility';
import { useGovernedCommand } from './use-governed-review-command';
import { useClearSentOnCommit, useSentDraft } from './use-governed-sent-draft';

export interface CmsGovernedAssignmentCreateProps {
  readonly reviewId: string;
  /** The server permits `assign_reviewer`; the form stays mounted to say why a refusal happened. */
  readonly permitted: boolean;
  readonly version: string;
  readonly disabledReason: string | null;
  readonly refetch: () => Promise<boolean>;
  readonly onDone: (headingId: string) => void;
  readonly environment?: WorkflowCommandEnvironment;
  readonly now: () => number;
  readonly loadOptions: () => Promise<ReviewerOptionsResult>;
}

/**
 * CMS-03C-08 create. The reviewer choice comes from the owner-only grant list and
 * the chosen person id exists only in this component's state: it is never in a
 * URL, a prop, storage or a log, and it is discarded on a step-up navigation (only
 * the expiry and the reason are stored, and the person is asked for again on
 * return). The expiry is bounded client-side to seven days; the server stays
 * authoritative (422 `expiry_out_of_bounds`).
 */
export default function CmsGovernedAssignmentCreate({
  reviewId,
  permitted,
  version,
  disabledReason,
  refetch,
  onDone,
  environment,
  now,
  loadOptions,
}: CmsGovernedAssignmentCreateProps): React.ReactElement {
  const { reviewers, retry } = useReviewerOptions(
    loadOptions,
    permitted,
    'governed-assignment',
  );
  const [personId, setPersonId] = React.useState('');
  const [localErrors, setLocalErrors] = React.useState<
    readonly WorkflowLocalError[]
  >([]);
  const sentDraft = useSentDraft();
  const { controller, state } = useGovernedCommand({
    spec: GOVERNED_COMMAND_SPECS['CMS-03C-08'],
    draftKey: 'CMS-03C-08-create',
    ids: { reviewId },
    refetch,
    onCommitted: () => {
      // FE03 1048: a verified success clears the form's draft, the chosen reviewer included.
      sentDraft.commit();
      void refetch().then(() =>
        onDone(GOVERNED_DETAIL_HEADING_IDS.assignments),
      );
    },
    ...(environment === undefined ? {} : { environment }),
  });
  React.useEffect(() => {
    if (permitted) controller.restore(version);
  }, [controller, permitted, version]);
  const fields = useDraftFields(state.restoredValues);
  // The chosen reviewer is cleared too, unless it was changed after dispatch.
  const person = React.useMemo(
    () => ({ key: 'personId', set: setPersonId }),
    [],
  );
  useClearSentOnCommit(sentDraft, fields.clearSent, person);
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

  const submit = (event: React.SyntheticEvent): void => {
    event.preventDefault();
    if (blocked) return;
    withCmsValidators(
      (validators) => {
        const found: WorkflowLocalError[] = [];
        if (chosen === null)
          found.push({ ...ASSIGNMENT_REVIEWER, message: 'Choose a reviewer.' });
        const expiry = parseAssignmentExpiry(
          expires,
          now(),
          chosen?.endsAt ?? null,
        );
        if (!expiry.ok)
          found.push({ ...ASSIGNMENT_EXPIRES, message: expiry.message });
        const reasonError = validateAssignmentReason(validators, reason);
        if (reasonError !== null)
          found.push({ ...ASSIGNMENT_REASON, message: reasonError });
        setLocalErrors(found);
        if (chosen === null || !expiry.ok || found.length > 0) return;
        sentDraft.remember({ ...fields.typedValues, personId });
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
      },
      () => setLocalErrors([validatorsUnavailableError(ASSIGNMENT_REASON)]),
    );
  };
  const startAnother = (): void => {
    controller.startOver();
    setPersonId('');
    fields.reset();
  };
  if (!governedFrameVisible(permitted, state.phase)) return <></>;
  return (
    <CmsWorkflowCommandFrame
      lazyRegion="governed-assignment"
      headingId="governed-assignment-create-title"
      title="Assign a reviewer"
      state={state}
      controller={controller}
      pendingLabel="Assigning reviewer…"
      committedLabel={(resource) =>
        `Reviewer assigned until ${resource.expiresAt}.`
      }
      fieldIds={{
        reviewerPersonId: ASSIGNMENT_REVIEWER,
        expiresAt: ASSIGNMENT_EXPIRES,
        reason: ASSIGNMENT_REASON,
      }}
      localErrors={localErrors}
      disabledReason={disabledReason}
    >
      {permitted ? (
        <form onSubmit={submit}>
          <CmsGovernedAssignmentFields
            reviewers={reviewers}
            retry={retry}
            askAgain={state.restoredValues !== null}
            personId={personId}
            expires={expires}
            reason={reason}
            errorOf={errorOf}
            named={named}
            onPerson={setPersonId}
            onExpires={(value) => fields.set('expiresAt', value)}
            onReason={(value) => fields.set('reason', value)}
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
      ) : null}
    </CmsWorkflowCommandFrame>
  );
}
