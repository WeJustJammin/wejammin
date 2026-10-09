import type { CmsEditorialRefusalDetails } from '@wejammin/contracts';

import type { CmsWorkflowCommandOperationId } from './cms-workflow-command-specs';
import type { WorkflowRefusal } from './cms-workflow-command-transport';

/**
 * What a definite refusal means to the form that sent the command (FE03 Slice 11
 * states, `commandState` error column). The copy is written here, never taken
 * from the response; only the verified reason token, its structured members and
 * the request's own field pointers select it.
 */
export type RefusalKind =
  /** 403: the capability gate copy, never a step-up route. */
  | 'gate'
  /** 404: one non-disclosing line. */
  | 'not-available'
  /** The canonical state moved: fixed copy, then a refetch. */
  | 'refetch'
  /** A value the person can correct: fixed copy at the field. */
  | 'field'
  /** 422 `preflight_failed`: the per-category list. */
  | 'preflight'
  /** Retryable 503 from an unavailable preflight provider. */
  | 'preflight-unavailable'
  | 'rate-limited'
  | 'invalid';

type PreflightEntry = Extract<
  CmsEditorialRefusalDetails,
  { reasonCode: 'preflight_failed' }
>['preflight'][number];
type GapAlternatives = Extract<
  CmsEditorialRefusalDetails,
  { reasonCode: 'nonexistent_local_time' }
>['alternatives'];
type FoldAlternatives = Extract<
  CmsEditorialRefusalDetails,
  { reasonCode: 'ambiguous_local_time' }
>['alternatives'];

export interface ClassifiedRefusal {
  readonly kind: RefusalKind;
  readonly message: string;
  /** A definite refusal rotates the key; a rate limit or unavailable check keeps it. */
  readonly rotateKey: boolean;
  /** Re-read the canonical workflow or review before the person acts again. */
  readonly refetch: boolean;
  /** The form controls the refusal is about (for `aria-invalid` and the summary links). */
  readonly fields: readonly string[];
  readonly preflight: readonly PreflightEntry[] | null;
  readonly alternatives: GapAlternatives | null;
  readonly foldAlternatives: FoldAlternatives | null;
  readonly window: { readonly minUtc: string; readonly maxUtc: string } | null;
  readonly requestId: string | null;
}

const PUBLISHER_RULE =
  'A second person with the publisher capability must publish this revision.';

const SEPARATION: Readonly<Record<CmsWorkflowCommandOperationId, string>> = {
  'CMS-03B-05': 'A different person must do this step.',
  'CMS-03B-06':
    'You cannot record a decision on your own work or on a review you submitted.',
  'CMS-03B-07': PUBLISHER_RULE,
  'CMS-03B-08': 'A different person must do this step.',
  'CMS-03B-09': PUBLISHER_RULE,
  'CMS-03B-18': 'A different person must do this step.',
};

const CANDIDATE_CHANGED =
  'The approved candidate changed. Review the updated checks.';
const CHECKS_CHANGED = 'The checks changed. Review the updated results.';

/** 409 reasons that mean the canonical state moved: copy, per operation where it differs. */
const REFETCH_COPY: Readonly<
  Record<string, (operationId: CmsWorkflowCommandOperationId) => string>
> = {
  revision_not_submittable: () => CHECKS_CHANGED,
  dependency_changed: (operationId) =>
    operationId === 'CMS-03B-05'
      ? CHECKS_CHANGED
      : operationId === 'CMS-03B-06'
        ? 'The review was invalidated because its dependencies changed.'
        : CANDIDATE_CHANGED,
  version_set_stale: (operationId) =>
    operationId === 'CMS-03B-08'
      ? 'The candidate changed. Review the updated candidate.'
      : CANDIDATE_CHANGED,
  review_not_open: () => 'This review is no longer open.',
  duplicate_decision: () => 'You already recorded a decision on this review.',
  specialist_slot_unsatisfiable: () =>
    'Your account cannot fill a required specialist slot on this review.',
  assignment_exists: () =>
    'That reviewer already has an active assignment on this review.',
  assignment_limit: () =>
    'This review already has the maximum of 16 active assignments.',
  publication_conflict: () =>
    'Another publication was recorded for this audience and locale. Review the updated history.',
  preview_expired: () => 'This preview has expired. Create a new preview.',
  preflight_evidence_stale: () =>
    'The accessibility check is out of date. Try again.',
};

/** 422 reasons the person can correct, with the control each one is about. */
const FIELD_COPY: Readonly<
  Record<string, { message: string; fields: readonly string[] }>
> = {
  dependency_manifest_too_large: {
    message: 'The dependency manifest is too large to submit.',
    fields: [],
  },
  unknown_timezone: {
    message: 'That time zone is not recognised.',
    fields: ['timezone'],
  },
  tzdb_version_mismatch: {
    message:
      'The time zone data changed. Reload the form and choose the time again.',
    fields: ['timezone'],
  },
  nonexistent_local_time: {
    message: 'That local time does not exist in this time zone.',
    fields: ['localDateTime'],
  },
  ambiguous_local_time: {
    message: 'That local time happens twice. Choose the earlier or later one.',
    fields: ['disambiguation'],
  },
  disambiguation_not_applicable: {
    message:
      'Earlier or later applies only to a local time that happens twice.',
    fields: ['disambiguation'],
  },
  resolved_utc_mismatch: {
    message: 'The resolved time did not match. Choose the time again.',
    fields: ['localDateTime'],
  },
  schedule_out_of_horizon: {
    message: 'Choose a time between one minute and 366 days from now.',
    fields: ['localDateTime'],
  },
  authority_ends_before_schedule: {
    message:
      'Your publisher access ends before this time. Choose an earlier time.',
    fields: ['localDateTime'],
  },
  expiry_out_of_bounds: {
    message:
      'Choose an expiry within seven days that ends before the reviewer access ends.',
    fields: ['expiresAt'],
  },
};

/** The form control a request-body pointer names. */
const POINTER_FIELD: Readonly<Record<string, string>> = {
  '/reason': 'reason',
  '/decision': 'decision',
  '/audience': 'audience',
  '/route': 'route',
  '/locale': 'locale',
  '/expiresAt': 'expiresAt',
  '/reviewerPersonId': 'reviewerPersonId',
  '/localDateTime': 'localDateTime',
  '/resolvedUtc': 'localDateTime',
  '/timezone': 'timezone',
  '/disambiguation': 'disambiguation',
  '/action': 'action',
};

const base = (
  kind: RefusalKind,
  message: string,
  refusal: WorkflowRefusal,
  overrides: Partial<ClassifiedRefusal> = {},
): ClassifiedRefusal => ({
  kind,
  message,
  rotateKey: true,
  refetch: false,
  fields: [],
  preflight: null,
  alternatives: null,
  foldAlternatives: null,
  window: null,
  requestId: refusal.requestId,
  ...overrides,
});

const detailsOf = <Reason extends CmsEditorialRefusalDetails['reasonCode']>(
  refusal: WorkflowRefusal,
  reason: Reason,
): Extract<CmsEditorialRefusalDetails, { reasonCode: Reason }> | null =>
  refusal.details?.reasonCode === reason
    ? (refusal.details as Extract<
        CmsEditorialRefusalDetails,
        { reasonCode: Reason }
      >)
    : null;

const classify403 = (
  operationId: CmsWorkflowCommandOperationId,
  refusal: WorkflowRefusal,
): ClassifiedRefusal =>
  base(
    'gate',
    refusal.reason === 'capability_missing'
      ? 'Your account does not have the capability for this action.'
      : refusal.reason === 'separation_of_duties'
        ? SEPARATION[operationId]
        : 'This account cannot do this.',
    refusal,
  );

const classify409 = (
  operationId: CmsWorkflowCommandOperationId,
  refusal: WorkflowRefusal,
): ClassifiedRefusal => {
  if (refusal.reason === 'reviewer_not_eligible')
    return base(
      'field',
      'That person cannot be assigned to this review.',
      refusal,
      {
        fields: ['reviewerPersonId'],
      },
    );
  const copy =
    refusal.reason === null ? undefined : REFETCH_COPY[refusal.reason];
  if (copy !== undefined)
    return base('refetch', copy(operationId), refusal, { refetch: true });
  if (refusal.conflict === 'IDEMPOTENCY_MISMATCH')
    return base(
      'invalid',
      'This request was already used with different content. Review it and submit again.',
      refusal,
    );
  return base(
    'refetch',
    'This record changed. Review the current version.',
    refusal,
    {
      refetch: true,
    },
  );
};

const classify422 = (refusal: WorkflowRefusal): ClassifiedRefusal => {
  if (refusal.reason === 'preflight_failed') {
    const entries = detailsOf(refusal, 'preflight_failed')?.preflight ?? [];
    return base(
      'preflight',
      'Some checks did not pass. Nothing was submitted.',
      refusal,
      {
        refetch: true,
        preflight: entries.filter((entry) => entry.outcome !== 'passed'),
      },
    );
  }
  const copy = refusal.reason === null ? undefined : FIELD_COPY[refusal.reason];
  if (copy !== undefined) {
    const horizon = detailsOf(refusal, 'schedule_out_of_horizon');
    return base('field', copy.message, refusal, {
      fields: copy.fields,
      alternatives:
        detailsOf(refusal, 'nonexistent_local_time')?.alternatives ?? null,
      foldAlternatives:
        detailsOf(refusal, 'ambiguous_local_time')?.alternatives ?? null,
      window:
        horizon === null
          ? null
          : { minUtc: horizon.minUtc, maxUtc: horizon.maxUtc },
    });
  }
  const fields = refusal.violations.flatMap((violation) => {
    const field = POINTER_FIELD[violation.path];
    return field === undefined ? [] : [field];
  });
  return base('field', 'Check the highlighted fields.', refusal, {
    fields: [...new Set(fields)],
  });
};

export const classifyWorkflowRefusal = (
  operationId: CmsWorkflowCommandOperationId,
  refusal: WorkflowRefusal,
): ClassifiedRefusal => {
  if (refusal.preflightUnavailable)
    return base(
      'preflight-unavailable',
      `A required check is unavailable right now. Nothing was submitted; try again ${
        refusal.retryAfterSeconds === null
          ? 'shortly'
          : `in ${refusal.retryAfterSeconds} seconds`
      }.`,
      refusal,
      { rotateKey: false, refetch: true },
    );
  switch (refusal.status) {
    case 403:
      return classify403(operationId, refusal);
    case 404:
      return base('not-available', 'This record is not available.', refusal);
    case 409:
      return classify409(operationId, refusal);
    case 422:
      return classify422(refusal);
    case 429:
      return base(
        'rate-limited',
        `Too many attempts. Try again ${
          refusal.retryAfterSeconds === null
            ? 'shortly'
            : `in ${refusal.retryAfterSeconds} seconds`
        }.`,
        refusal,
        { rotateKey: false },
      );
    default:
      return base(
        'invalid',
        'This request could not be sent. Reload the page and try again.',
        refusal,
      );
  }
};
