export type Expect = readonly [
  status: number,
  code: string,
  details: Record<string, unknown>,
];
export const FORBIDDEN = 'GOVERNED_REVIEW_FORBIDDEN';
export const CONFLICT = 'GOVERNED_REVIEW_VERSION_CONFLICT';
export const INVALID = 'GOVERNED_REVIEW_VALIDATION_FAILED';
export const reason = (code: string): Record<string, unknown> => ({
  reasonCode: code,
});
export const violation = (path: string) => ({
  violations: [{ path, code: 'invalid', message: 'The value is invalid.' }],
});
export const raise = (token: string, detail?: string) => ({
  status: 400,
  body: {
    code: 'P0001',
    message: token,
    details: detail ?? 'private provider',
  },
});
/**
 * Every promoted producer raises a stale CAS operand as `P0001` `VERSION_MISMATCH` with the JSON
 * DETAIL `{"expectedVersion","currentVersion"}` (`20261002202000:34`); PostgREST answers that 400.
 */
const mismatch = raise(
  'VERSION_MISMATCH',
  '{"expectedVersion":"3","currentVersion":"99"}',
);
/** The engine CAS form (`40001` whose whole message is the token) the Worker also recognizes. */
const casMismatch = {
  status: 409,
  body: {
    code: '40001',
    message: 'VERSION_MISMATCH',
    details: '{"expectedVersion":"3","currentVersion":"99"}',
  },
};
export const internal = [500, 'INTERNAL_ERROR', {}] as const satisfies Expect;

/** The token tables of 20261014010100..010400 against the BE03c 1250-1305 matrix. */
export const TABLES: Readonly<
  Record<
    string,
    readonly (readonly [string, { status: number; body: unknown }, Expect])[]
  >
> = {
  'CMS-03C-07': [
    ['NOT_FOUND', raise('NOT_FOUND'), [404, 'GOVERNED_REVIEW_NOT_FOUND', {}]],
    [
      'capability_missing',
      raise('capability_missing'),
      [403, FORBIDDEN, reason('capability_missing')],
    ],
    [
      'separation_of_duties',
      raise('separation_of_duties'),
      [403, FORBIDDEN, reason('separation_of_duties')],
    ],
    [
      'review_not_open',
      raise('review_not_open'),
      [409, CONFLICT, reason('review_not_open')],
    ],
    [
      'duplicate_decision',
      raise('duplicate_decision'),
      [409, CONFLICT, reason('duplicate_decision')],
    ],
    [
      'specialist_slot_unsatisfiable',
      raise('specialist_slot_unsatisfiable'),
      [409, CONFLICT, reason('specialist_slot_unsatisfiable')],
    ],
    [
      'dependency_changed (raised)',
      raise('dependency_changed'),
      [409, CONFLICT, reason('dependency_changed')],
    ],
    [
      'VERSION_MISMATCH (P0001 + JSON DETAIL) keeps no version',
      mismatch,
      [409, CONFLICT, {}],
    ],
    [
      'VERSION_MISMATCH (40001 CAS) keeps no version',
      casMismatch,
      [409, CONFLICT, {}],
    ],
    [
      'IDEMPOTENCY_MISMATCH',
      raise('IDEMPOTENCY_MISMATCH'),
      [409, CONFLICT, {}],
    ],
    ['CONFLICT', raise('CONFLICT'), [409, CONFLICT, {}]],
    [
      'VALIDATION_FAILED /decision',
      raise('VALIDATION_FAILED', '["/decision"]'),
      [422, INVALID, violation('/decision')],
    ],
    [
      'VALIDATION_FAILED /reason',
      raise('VALIDATION_FAILED', '["/reason"]'),
      [422, INVALID, violation('/reason')],
    ],
    [
      'VALIDATION_FAILED /expectedVersion',
      raise('VALIDATION_FAILED', '["/expectedVersion"]'),
      [422, INVALID, violation('/expectedVersion')],
    ],
    [
      'VALIDATION_FAILED pointer outside the request',
      raise('VALIDATION_FAILED', '["/private"]'),
      [422, INVALID, violation('/')],
    ],
    ['INVALID_REQUEST', raise('INVALID_REQUEST'), [400, 'INVALID_REQUEST', {}]],
    [
      'DEPENDENCY_UNAVAILABLE',
      raise('DEPENDENCY_UNAVAILABLE'),
      [
        503,
        'DEPENDENCY_UNAVAILABLE',
        { dependencyClass: 'cms_composition', retryable: true },
      ],
    ],
    [
      'reviewer_not_eligible (08 token)',
      raise('reviewer_not_eligible'),
      internal,
    ],
    [
      'expiry_out_of_bounds (08 token)',
      raise('expiry_out_of_bounds', '["/expiresAt"]'),
      internal,
    ],
    [
      'subject_not_submittable (06 token)',
      raise('subject_not_submittable'),
      internal,
    ],
  ],
  'CMS-03C-08': [
    ['NOT_FOUND', raise('NOT_FOUND'), [404, 'GOVERNED_REVIEW_NOT_FOUND', {}]],
    [
      'capability_missing',
      raise('capability_missing'),
      [403, FORBIDDEN, reason('capability_missing')],
    ],
    [
      'reviewer_not_eligible',
      raise('reviewer_not_eligible'),
      [409, CONFLICT, reason('reviewer_not_eligible')],
    ],
    [
      'assignment_exists',
      raise('assignment_exists'),
      [409, CONFLICT, reason('assignment_exists')],
    ],
    [
      'assignment_limit',
      raise('assignment_limit'),
      [409, CONFLICT, reason('assignment_limit')],
    ],
    [
      'review_not_open',
      raise('review_not_open'),
      [409, CONFLICT, reason('review_not_open')],
    ],
    [
      'expiry_out_of_bounds at /expiresAt',
      raise('expiry_out_of_bounds', '["/expiresAt"]'),
      [
        422,
        INVALID,
        { ...reason('expiry_out_of_bounds'), ...violation('/expiresAt') },
      ],
    ],
    [
      'expiry_out_of_bounds without a pointer',
      raise('expiry_out_of_bounds'),
      [422, INVALID, reason('expiry_out_of_bounds')],
    ],
    [
      're-revoke: bare CONFLICT has no closed reason (F-3 gap)',
      raise('CONFLICT'),
      [409, CONFLICT, {}],
    ],
    [
      'VERSION_MISMATCH (P0001 + JSON DETAIL) keeps no version',
      mismatch,
      [409, CONFLICT, {}],
    ],
    [
      'VERSION_MISMATCH (40001 CAS) keeps no version',
      casMismatch,
      [409, CONFLICT, {}],
    ],
    [
      'IDEMPOTENCY_MISMATCH',
      raise('IDEMPOTENCY_MISMATCH'),
      [409, CONFLICT, {}],
    ],
    [
      'VALIDATION_FAILED /reviewerPersonId',
      raise('VALIDATION_FAILED', '["/reviewerPersonId"]'),
      [422, INVALID, violation('/reviewerPersonId')],
    ],
    [
      'VALIDATION_FAILED /expiresAt',
      raise('VALIDATION_FAILED', '["/expiresAt"]'),
      [422, INVALID, violation('/expiresAt')],
    ],
    [
      'VALIDATION_FAILED /assignmentId',
      raise('VALIDATION_FAILED', '["/assignmentId"]'),
      [422, INVALID, violation('/assignmentId')],
    ],
    [
      'VALIDATION_FAILED /reason',
      raise('VALIDATION_FAILED', '["/reason"]'),
      [422, INVALID, violation('/reason')],
    ],
    [
      'INVALID_REQUEST (SQL unknown key)',
      raise('INVALID_REQUEST'),
      [400, 'INVALID_REQUEST', {}],
    ],
    ['duplicate_decision (07 token)', raise('duplicate_decision'), internal],
    [
      'separation_of_duties (07 token)',
      raise('separation_of_duties'),
      internal,
    ],
  ],
  'CMS-03C-10': [
    ['NOT_FOUND', raise('NOT_FOUND'), [404, 'GOVERNED_REVIEW_NOT_FOUND', {}]],
    [
      'capability_missing (no read scope)',
      raise('capability_missing'),
      [403, FORBIDDEN, reason('capability_missing')],
    ],
    ['INVALID_REQUEST', raise('INVALID_REQUEST'), [400, 'INVALID_REQUEST', {}]],
    ['CONFLICT is not declared', raise('CONFLICT'), internal],
    [
      'VALIDATION_FAILED is not declared',
      raise('VALIDATION_FAILED', '["/reviewId"]'),
      internal,
    ],
    ['STEP_UP_REQUIRED is not declared', raise('STEP_UP_REQUIRED'), internal],
    ['review_not_open is not declared', raise('review_not_open'), internal],
  ],
  'CMS-03C-11': [
    [
      'INVALID_REQUEST (malformed cursor)',
      raise('INVALID_REQUEST'),
      [400, 'INVALID_REQUEST', {}],
    ],
    [
      'CONFLICT (expired, tampered or foreign cursor)',
      raise('CONFLICT'),
      [409, CONFLICT, {}],
    ],
    [
      'VALIDATION_FAILED /limit',
      raise('VALIDATION_FAILED', '["/limit"]'),
      [422, INVALID, violation('/limit')],
    ],
    [
      'VALIDATION_FAILED /scope',
      raise('VALIDATION_FAILED', '["/scope"]'),
      [422, INVALID, violation('/scope')],
    ],
    [
      'VALIDATION_FAILED /state',
      raise('VALIDATION_FAILED', '["/state"]'),
      [422, INVALID, violation('/state')],
    ],
    [
      'VALIDATION_FAILED /subjectKind',
      raise('VALIDATION_FAILED', '["/subjectKind"]'),
      [422, INVALID, violation('/subjectKind')],
    ],
    [
      'DEPENDENCY_UNAVAILABLE (cursor key missing)',
      raise('DEPENDENCY_UNAVAILABLE'),
      [
        503,
        'DEPENDENCY_UNAVAILABLE',
        { dependencyClass: 'cms_composition', retryable: true },
      ],
    ],
    ['NOT_FOUND is not declared', raise('NOT_FOUND'), internal],
    [
      'capability_missing is not declared',
      raise('capability_missing'),
      internal,
    ],
  ],
};
