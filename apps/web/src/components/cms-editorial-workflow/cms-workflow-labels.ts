import type {
  EditorialReviewState,
  EntryRevisionState,
  PreflightCategory,
  PublicationAction,
  PublicationProjectionState,
  PublicationScheduleState,
  PublicationState,
  ReviewInvalidatedReason,
  ReviewNextAction,
  ScheduleReasonCode,
  WorkflowNextAction,
} from '@wejammin/contracts';

/**
 * Fixed copy for every closed Slice 11 vocabulary. The browser renders nothing
 * the server wrote: a state, a reason token or an action selects one of these
 * sentences, and an unregistered token falls back to a generic sentence that
 * never echoes it. State is always words, never colour alone.
 */
export type PreflightOutcome = 'passed' | 'failed' | 'unavailable';

export const PREFLIGHT_CATEGORY_LABEL: Readonly<
  Record<PreflightCategory, string>
> = {
  contract: 'Content contract',
  schema: 'Content type',
  template: 'Template',
  block: 'Blocks',
  pattern: 'Patterns',
  taxonomy: 'Taxonomy',
  settings: 'Publication settings',
  relation: 'Related content',
  privacy: 'Privacy',
  security: 'Content safety',
  accessibility: 'Accessibility',
  media: 'Media',
  route: 'Routes',
  locale: 'Locales',
  migration: 'Schema migration',
  domain_binding: 'Domain binding',
  revocation: 'Authority and availability',
};

export const PREFLIGHT_OUTCOME_LABEL: Readonly<
  Record<PreflightOutcome, string>
> = { passed: 'Passed', failed: 'Failed', unavailable: 'Unavailable' };

const FAILED_REASON_COPY: Readonly<Record<string, string>> = {
  value_invalid: 'A field value is invalid.',
  validators_changed: 'The validators changed since this draft was saved.',
  schema_not_active: 'The content type version is not active.',
  schema_evidence_changed:
    'The content type changed since this draft was saved.',
  template_not_active: 'The template version is not active.',
  template_incompatible: 'The template is not compatible with this content.',
  template_changed: 'The template changed since this draft was saved.',
  block_withdrawn: 'A block used here was withdrawn.',
  block_digest_changed: 'A block used here changed since this draft was saved.',
  settings_changed:
    'The publication settings changed since this draft was saved.',
  relation_target_unavailable: 'A related entry is not available.',
  relation_version_changed:
    'A related entry changed since this draft was saved.',
  unsafe_content: 'The content contains something that is not safe to publish.',
  blocking_finding: 'The accessibility check found a blocking problem.',
  checker_failed: 'The accessibility check could not run.',
  migration_in_progress: 'A schema migration is in progress for this content.',
  binding_not_allowlisted: 'A domain binding is not on the allowed list.',
  entry_unavailable: 'The entry is no longer available.',
  reviewer_authority_changed: 'A reviewer’s authority changed.',
  publisher_authority_ended: 'The publisher’s authority has ended.',
  provider_unbuilt_reference:
    'Checks for this reference type are not available yet.',
};

const GENERIC_FAILED = 'This check did not pass.';
const GENERIC_UNAVAILABLE =
  'This check could not run. It is a degraded check, not an error.';

/** The fixed sentence for one result; an unregistered token is never echoed. */
export const preflightReasonCopy = (
  outcome: PreflightOutcome,
  reasonCode: string | null,
): string => {
  if (outcome === 'passed') return 'This check passed.';
  if (outcome === 'unavailable') return GENERIC_UNAVAILABLE;
  return reasonCode !== null && Object.hasOwn(FAILED_REASON_COPY, reasonCode)
    ? (FAILED_REASON_COPY[reasonCode] as string)
    : GENERIC_FAILED;
};

export const REVISION_STATE_LABEL: Readonly<
  Record<EntryRevisionState, string>
> = {
  draft: 'Draft',
  submitted: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
  scheduled: 'Scheduled',
  published: 'Published',
};

export const REVIEW_STATE_LABEL: Readonly<
  Record<EditorialReviewState, string>
> = {
  open: 'Open',
  approved: 'Approved',
  rejected: 'Rejected',
  invalidated: 'Invalidated',
};

export const INVALIDATED_REASON_COPY: Readonly<
  Record<ReviewInvalidatedReason, string>
> = {
  revision_superseded: 'A newer revision replaced the one under review.',
  dependency_changed: 'A dependency changed after the review was submitted.',
  reviewer_authority_changed: 'A reviewer’s authority changed.',
  entry_unavailable: 'The entry is no longer available.',
};

export const SCHEDULE_STATE_COPY: Readonly<
  Record<PublicationScheduleState, string>
> = {
  pending: 'Scheduled, not published',
  executing: 'Running now, not yet published',
  completed: 'Completed',
  failed_retryable: 'Failed, will retry',
  blocked: 'Blocked, nothing was published',
  cancelled: 'Cancelled, nothing was published',
};

export const SCHEDULE_REASON_COPY: Readonly<
  Record<ScheduleReasonCode, string>
> = {
  approval_invalidated: 'The approval was invalidated.',
  preflight_failed: 'A check failed when the schedule ran.',
  publisher_authority_ended:
    'The publisher’s authority ended before the schedule ran.',
  publication_not_active: 'There was no active publication to change.',
  retries_exhausted: 'The schedule failed after all retries.',
  entry_unavailable: 'The entry was no longer available.',
};

export const PUBLICATION_STATE_LABEL: Readonly<
  Record<PublicationState, string>
> = {
  active: 'Current publication',
  superseded: 'Replaced by a newer publication',
  revoked: 'Withdrawn',
};

export const PUBLICATION_ACTION_LABEL: Readonly<
  Record<PublicationAction, string>
> = {
  publish: 'Publish',
  unpublish: 'Unpublish',
  expire: 'Expire',
  archive: 'Archive',
};

/** Delivery convergence of a recorded publication; `pending` is never visibility. */
export const PROJECTION_COPY: Readonly<
  Record<PublicationProjectionState, string>
> = {
  pending:
    'Recorded. Public delivery has not reported yet, so this is not confirmed visible to readers.',
  converged: 'Delivery reported this version live.',
  degraded: 'Delivery is degraded; readers may still see the previous version.',
};

export const ACTION_LABEL: Readonly<
  Record<WorkflowNextAction | ReviewNextAction, string>
> = {
  submit_review: 'Submit for review',
  assign_reviewer: 'Assign a reviewer',
  record_decision: 'Record a decision',
  revoke_assignment: 'Revoke an assignment',
  schedule: 'Schedule publication',
  preview: 'Create a preview',
  publish: 'Publish now',
};

const DISABLED_ACTION_COPY: Readonly<
  Record<WorkflowNextAction | ReviewNextAction, string>
> = {
  submit_review:
    'This revision cannot be submitted for review by your account right now.',
  assign_reviewer: 'Only the owner can assign a reviewer to this review.',
  record_decision:
    'You have no active assignment to decide this review, or you have already decided it.',
  revoke_assignment: 'Only the owner can revoke an assignment on this review.',
  schedule:
    'Scheduling needs an approved revision and the publisher capability.',
  preview:
    'A preview needs an approved or in-review revision you are allowed to read.',
  publish:
    'A second person with the publisher capability must publish this revision.',
};

/**
 * Beside the schedule form's Action control when `publish` is not offered
 * (BE03b:268-270: the revision author may schedule every action but `publish`).
 */
export const SCHEDULE_PUBLISH_WITHHELD_COPY =
  'Publish is not offered here: a second person with the publisher capability must publish this revision. You can still schedule the other actions.';

/** Why a form is withheld when its action is not in `permittedNextActions`. */
export const disabledActionCopy = (
  action: WorkflowNextAction | ReviewNextAction,
): string => DISABLED_ACTION_COPY[action];
