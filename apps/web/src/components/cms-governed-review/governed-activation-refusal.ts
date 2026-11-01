import type { ClassifiedRefusal } from '../cms-editorial-workflow/cms-workflow-refusal';
import type { GovernedRefusal } from './governed-review-command-transport';

/**
 * The fixed copy of the CMS-03C-09 refusals the shared Slice 11 table cannot
 * speak (BE03c 1326, FE03 :1118 and :1798): why an activation, a schedule or a
 * retirement did not happen, and which control a time token is about. The copy
 * is written here, never taken from the response; only the registered reason
 * token and the closed canonical domain select it. A null answer defers to the
 * shared table (the 403 capability gate, a bare version conflict, a rate limit).
 */
const refusalOf = (
  kind: ClassifiedRefusal['kind'],
  message: string,
  refusal: GovernedRefusal,
  extra: Partial<ClassifiedRefusal> = {},
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
  ...extra,
});

/** 409 reasons that mean the canonical state moved: copy, then a re-read of the review. */
const MOVED: Readonly<Record<string, string>> = {
  subject_not_activatable:
    'This version can no longer be activated or scheduled. Its state changed; review it before acting again.',
  subject_not_retirable:
    'Only an active version can be retired, and this version is not active now.',
  activation_conflict:
    'Another version of this lineage was activated first. Nothing changed. Review the current state before acting again.',
  schedule_exists: 'This version already has a scheduled activation.',
  dependency_changed:
    'A dependency of this version changed, so its review was invalidated and the version is back to draft. Nothing was activated or scheduled.',
};

/** 422 time tokens of a schedule, with the control each one is about. */
const TIME: Readonly<Record<string, { message: string; field: string }>> = {
  unknown_timezone: {
    message: 'That time zone is not recognised.',
    field: 'timezone',
  },
  tzdb_version_mismatch: {
    message:
      'The time zone data changed. Reload the page and choose the time again.',
    field: 'timezone',
  },
  nonexistent_local_time: {
    message: 'That local time does not exist in this time zone.',
    field: 'localDateTime',
  },
  ambiguous_local_time: {
    message: 'That local time happens twice. Choose the earlier or later one.',
    field: 'disambiguation',
  },
  disambiguation_not_applicable: {
    message:
      'Earlier or later applies only to a local time that happens twice.',
    field: 'disambiguation',
  },
  resolved_utc_mismatch: {
    message: 'The resolved time did not match. Choose the time again.',
    field: 'localDateTime',
  },
  schedule_out_of_horizon: {
    message: 'Choose a time between one minute and 366 days from now.',
    field: 'localDateTime',
  },
  authority_ends_before_schedule: {
    message: 'Your owner access ends before this time. Choose an earlier time.',
    field: 'localDateTime',
  },
};

export const classifyGovernedActivationRefusal = (
  refusal: GovernedRefusal,
): ClassifiedRefusal | null => {
  const reason = refusal.governed.reason;
  if (reason === null) return null;
  const moved = MOVED[reason];
  if (moved !== undefined)
    return refusalOf('refetch', moved, refusal, { refetch: true });
  const time = TIME[reason];
  if (time !== undefined)
    return refusalOf('field', time.message, refusal, { fields: [time.field] });
  if (reason === 'canonical_source_unavailable')
    return refusalOf(
      'field',
      refusal.governed.domain === null
        ? 'A reference list this vocabulary declares is not available yet, so it cannot be activated or scheduled.'
        : `The ${refusal.governed.domain} reference list is not available yet, so this vocabulary cannot be activated or scheduled.`,
      refusal,
    );
  return null;
};
