import type {
  GovernedActivationScheduleSummary,
  GovernedInvalidatedReason,
  GovernedReviewResource,
  GovernedSubjectKind,
} from '@wejammin/contracts';

/**
 * Fixed copy for the definition-review surfaces (FE03 Slice 12 states). The copy
 * is written here, never taken from a response; every table is keyed by a closed
 * contract vocabulary and `governed-review-labels.test.ts` proves it is complete.
 * Type-only contract imports keep this module zod-free (FE03 AC261).
 */

export const GOVERNED_RISK_CLASS_LABEL: Readonly<
  Record<GovernedReviewResource['riskClass'], string>
> = {
  ordinary: 'Ordinary',
  protected: 'Protected',
};

/** A recorded decision, in the past tense a reader expects in a list of outcomes. */
export const GOVERNED_DECISION_LABEL: Readonly<
  Record<'approve' | 'reject', string>
> = {
  approve: 'Approved',
  reject: 'Rejected',
};

/** The viewer's own decision on a queue row; `none` is "None yet", never the token. */
export const GOVERNED_MY_DECISION_LABEL: Readonly<
  Record<'none' | 'approve' | 'reject', string>
> = {
  none: 'None yet',
  ...GOVERNED_DECISION_LABEL,
};

export const GOVERNED_SUBJECT_KIND_LABEL: Readonly<
  Record<GovernedSubjectKind, string>
> = {
  template_version: 'Template',
  pattern_version: 'Pattern',
  taxonomy_version: 'Vocabulary',
};

export const GOVERNED_INVALIDATED_COPY: Readonly<
  Record<GovernedInvalidatedReason, string>
> = {
  dependency_changed:
    'This review was invalidated because a dependency changed after it was submitted. The version is back to draft.',
  reviewer_authority_changed:
    'This review was invalidated because a reviewer’s authority changed. The version is back to draft.',
};

const DISABLED_ACTION_COPY = {
  record_decision:
    'You can record a decision only with an effective assignment as a reviewer.',
  assign_reviewer:
    'Only the owner of this version can assign a reviewer while the review is open.',
  activate: 'Only the owner of this version can activate or schedule it.',
  retire: 'Only the owner of this version can retire it.',
} as const;

/** Why a form is withheld when its action is not in `permittedNextActions`. */
export const governedDisabledActionCopy = (
  action: keyof typeof DISABLED_ACTION_COPY,
): string => DISABLED_ACTION_COPY[action];

/** The most recent scheduled activation of a review (DEC-191), by its state. */
export const GOVERNED_ACTIVATION_SCHEDULE_STATE_COPY: Readonly<
  Record<GovernedActivationScheduleSummary['state'], string>
> = {
  pending: 'Scheduled activation: pending.',
  executing: 'Scheduled activation: running now.',
  completed: 'Scheduled activation: completed.',
  failed_retryable:
    'Scheduled activation: an attempt failed and will be retried.',
  blocked: 'Scheduled activation: blocked.',
  cancelled: 'Scheduled activation: cancelled.',
};

/** The closed reason of a blocked or cancelled scheduled activation (FE03 :1118). */
export const GOVERNED_ACTIVATION_SCHEDULE_REASON_COPY: Readonly<
  Record<NonNullable<GovernedActivationScheduleSummary['reasonCode']>, string>
> = {
  approval_invalidated: 'The review approval no longer applies.',
  dependency_changed: 'A dependency changed after the review approved it.',
  activation_authority_ended: 'The authority to activate it ended.',
  canonical_source_unavailable:
    'A canonical source it depends on was unavailable.',
  retries_exhausted: 'It stopped after its retries ran out.',
};

/** The state in words and, for a blocked or cancelled schedule, its closed reason. */
export const governedActivationScheduleSentence = (
  schedule: GovernedActivationScheduleSummary,
): string =>
  schedule.reasonCode === null
    ? GOVERNED_ACTIVATION_SCHEDULE_STATE_COPY[schedule.state]
    : `${GOVERNED_ACTIVATION_SCHEDULE_STATE_COPY[schedule.state]} ${GOVERNED_ACTIVATION_SCHEDULE_REASON_COPY[schedule.reasonCode]}`;

/** The result line's sentence about the replaced version (DEC-191); a first activation has none. */
export const governedSupersededSentence = (version: number | null): string =>
  version === null ? '' : ` Version ${version} is now superseded.`;
