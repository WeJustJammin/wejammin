/**
 * The closed reason vocabulary of the governed commands (BE03c "Slice 12 typed
 * refusals"), written out so the browser reads a refusal without loading zod.
 * `governed-review-reasons.test.ts` proves each list and status equals the
 * generated contract.
 */
export type GovernedCommandOperation =
  'CMS-03C-06' | 'CMS-03C-07' | 'CMS-03C-08' | 'CMS-03C-09';

export const GOVERNED_REASONS: Readonly<
  Record<GovernedCommandOperation, readonly string[]>
> = {
  'CMS-03C-06': [
    'capability_missing',
    'separation_of_duties',
    'subject_not_submittable',
    'canonical_source_unavailable',
  ],
  'CMS-03C-07': [
    'capability_missing',
    'separation_of_duties',
    'review_not_open',
    'duplicate_decision',
    'specialist_slot_unsatisfiable',
    'dependency_changed',
  ],
  'CMS-03C-08': [
    'capability_missing',
    'reviewer_not_eligible',
    'assignment_exists',
    'assignment_limit',
    'review_not_open',
    'expiry_out_of_bounds',
  ],
  'CMS-03C-09': [
    'capability_missing',
    'subject_not_activatable',
    'subject_not_retirable',
    'dependency_changed',
    'activation_conflict',
    'schedule_exists',
    'canonical_source_unavailable',
    'unknown_timezone',
    'tzdb_version_mismatch',
    'nonexistent_local_time',
    'ambiguous_local_time',
    'disambiguation_not_applicable',
    'resolved_utc_mismatch',
    'schedule_out_of_horizon',
    'authority_ends_before_schedule',
  ],
};

const STATUS_BY_REASON: Readonly<Record<string, 403 | 409 | 422>> = {
  capability_missing: 403,
  separation_of_duties: 403,
  subject_not_submittable: 409,
  review_not_open: 409,
  duplicate_decision: 409,
  specialist_slot_unsatisfiable: 409,
  dependency_changed: 409,
  reviewer_not_eligible: 409,
  assignment_exists: 409,
  assignment_limit: 409,
  subject_not_activatable: 409,
  subject_not_retirable: 409,
  activation_conflict: 409,
  schedule_exists: 409,
  canonical_source_unavailable: 422,
  expiry_out_of_bounds: 422,
  unknown_timezone: 422,
  tzdb_version_mismatch: 422,
  nonexistent_local_time: 422,
  ambiguous_local_time: 422,
  disambiguation_not_applicable: 422,
  resolved_utc_mismatch: 422,
  schedule_out_of_horizon: 422,
  authority_ends_before_schedule: 422,
};

/** The one HTTP status of a governed reason token, or null for any other string. */
export const governedReasonStatus = (reason: string): 403 | 409 | 422 | null =>
  STATUS_BY_REASON[reason] ?? null;

/** The closed canonical domains a vocabulary may declare (DEC-135). */
export const GOVERNED_CANONICAL_DOMAINS: readonly string[] = [
  'role',
  'instrument',
  'gear',
  'place',
  'rights',
  'jurisdiction',
];
