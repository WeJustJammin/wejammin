import {
  CONFLICT,
  FORBIDDEN,
  INVALID,
  internal,
  raise,
  reason,
  violation,
  type Expect,
} from './governed-review-ops-tokens.test-support';

/*
 * The SQL refusals of `platform_api.cms_activate_governed_subject` (20261014070300/070400, governed-b
 * `## RPC boundary`) against the BE03c 1250-1305 matrix. A row is the provider answer and the
 * status, code and details the Worker publishes.
 */

const invalidAnswer = [
  502,
  'DEPENDENCY_UNAVAILABLE',
  { dependencyClass: 'cms_composition', retryable: true },
] as const satisfies Expect;

type Row = readonly [string, { status: number; body: unknown }, Expect];

const TIME: readonly Row[] = [
  [
    'tzdb_version_mismatch {pinnedVersion}',
    raise('tzdb_version_mismatch', '{"pinnedVersion":"2026f"}'),
    [
      422,
      INVALID,
      { ...reason('tzdb_version_mismatch'), pinnedVersion: '2026f' },
    ],
  ],
  [
    'tzdb_version_mismatch without its member is an invalid answer',
    raise('tzdb_version_mismatch'),
    invalidAnswer,
  ],
  [
    'resolved_utc_mismatch {expectedUtc}',
    raise('resolved_utc_mismatch', '{"expectedUtc":"2026-11-01T14:30:00Z"}'),
    [
      422,
      INVALID,
      {
        ...reason('resolved_utc_mismatch'),
        expectedUtc: '2026-11-01T14:30:00Z',
      },
    ],
  ],
  [
    'resolved_utc_mismatch as the producer raises it (millisecond expectedUtc DETAIL)',
    raise(
      'resolved_utc_mismatch',
      '{"expectedUtc":"2031-03-04T06:30:00.250Z"}',
    ),
    [
      422,
      INVALID,
      {
        ...reason('resolved_utc_mismatch'),
        expectedUtc: '2031-03-04T06:30:00.250Z',
      },
    ],
  ],
  [
    'resolved_utc_mismatch without its mandatory DETAIL is an invalid answer',
    raise('resolved_utc_mismatch'),
    invalidAnswer,
  ],
  [
    'schedule_out_of_horizon {minUtc, maxUtc}',
    raise(
      'schedule_out_of_horizon',
      '{"minUtc":"2026-10-14T00:01:01Z","maxUtc":"2027-10-15T00:00:01Z"}',
    ),
    [
      422,
      INVALID,
      {
        ...reason('schedule_out_of_horizon'),
        minUtc: '2026-10-14T00:01:01Z',
        maxUtc: '2027-10-15T00:00:01Z',
      },
    ],
  ],
  [
    'schedule_out_of_horizon with an unrecognised extra member keeps only the contract members',
    raise(
      'schedule_out_of_horizon',
      '{"minUtc":"2026-10-14T00:01:01Z","maxUtc":"2027-10-15T00:00:01Z","note":"private"}',
    ),
    [
      422,
      INVALID,
      {
        ...reason('schedule_out_of_horizon'),
        minUtc: '2026-10-14T00:01:01Z',
        maxUtc: '2027-10-15T00:00:01Z',
      },
    ],
  ],
  [
    'authority_ends_before_schedule',
    raise('authority_ends_before_schedule'),
    [422, INVALID, reason('authority_ends_before_schedule')],
  ],
  [
    'unknown_timezone (a Worker-side token, listed by the contract)',
    raise('unknown_timezone'),
    [422, INVALID, reason('unknown_timezone')],
  ],
  [
    'nonexistent_local_time without its alternatives is an invalid answer',
    raise('nonexistent_local_time'),
    invalidAnswer,
  ],
];

export const ACTIVATION_TABLE: readonly Row[] = [
  ['NOT_FOUND', raise('NOT_FOUND'), [404, 'GOVERNED_REVIEW_NOT_FOUND', {}]],
  [
    'capability_missing',
    raise('capability_missing'),
    [403, FORBIDDEN, reason('capability_missing')],
  ],
  [
    'subject_not_activatable',
    raise('subject_not_activatable'),
    [409, CONFLICT, reason('subject_not_activatable')],
  ],
  [
    'subject_not_retirable (contract token)',
    raise('subject_not_retirable'),
    [409, CONFLICT, reason('subject_not_retirable')],
  ],
  [
    'schedule_exists',
    raise('schedule_exists'),
    [409, CONFLICT, reason('schedule_exists')],
  ],
  [
    'activation_conflict (a lost race on the lineage)',
    raise('activation_conflict'),
    [409, CONFLICT, reason('activation_conflict')],
  ],
  [
    'dependency_changed (raised)',
    raise('dependency_changed'),
    [409, CONFLICT, reason('dependency_changed')],
  ],
  [
    'VERSION_MISMATCH (P0001 + JSON DETAIL) keeps no version',
    raise('VERSION_MISMATCH', '{"expectedVersion":"3","currentVersion":"99"}'),
    [409, CONFLICT, {}],
  ],
  ['IDEMPOTENCY_MISMATCH', raise('IDEMPOTENCY_MISMATCH'), [409, CONFLICT, {}]],
  [
    'canonical_source_unavailable {domain}',
    raise('canonical_source_unavailable', '{"domain":"role"}'),
    [
      422,
      INVALID,
      { ...reason('canonical_source_unavailable'), domain: 'role' },
    ],
  ],
  [
    'canonical_source_unavailable without a domain is an invalid answer',
    raise('canonical_source_unavailable'),
    invalidAnswer,
  ],
  ...TIME,
  [
    'VALIDATION_FAILED /action (also the held retire)',
    raise('VALIDATION_FAILED', '["/action"]'),
    [422, INVALID, violation('/action')],
  ],
  [
    'VALIDATION_FAILED /expectedVersion',
    raise('VALIDATION_FAILED', '["/expectedVersion"]'),
    [422, INVALID, violation('/expectedVersion')],
  ],
  [
    'VALIDATION_FAILED /activateAt',
    raise('VALIDATION_FAILED', '["/activateAt"]'),
    [422, INVALID, violation('/activateAt')],
  ],
  [
    'VALIDATION_FAILED /activateAt/<member>, in the producer order',
    raise(
      'VALIDATION_FAILED',
      '["/activateAt/localDateTime","/activateAt/tzdbVersion"]',
    ),
    [
      422,
      INVALID,
      {
        violations: [
          {
            path: '/activateAt/localDateTime',
            code: 'invalid',
            message: 'The value is invalid.',
          },
          {
            path: '/activateAt/tzdbVersion',
            code: 'invalid',
            message: 'The value is invalid.',
          },
        ],
      },
    ],
  ],
  [
    'VALIDATION_FAILED pointer outside the request (/ifMatch is a header, never a member)',
    raise('VALIDATION_FAILED', '["/ifMatch"]'),
    [422, INVALID, violation('/')],
  ],
  ['INVALID_REQUEST', raise('INVALID_REQUEST'), [400, 'INVALID_REQUEST', {}]],
  [
    'DEPENDENCY_UNAVAILABLE (NULL policy evidence)',
    raise('DEPENDENCY_UNAVAILABLE'),
    [
      503,
      'DEPENDENCY_UNAVAILABLE',
      { dependencyClass: 'cms_composition', retryable: true },
    ],
  ],
  ['CONFLICT', raise('CONFLICT'), [409, CONFLICT, {}]],
  [
    'review_not_open raised (not a CMS-03C-09 token: BE03c 1262)',
    raise('review_not_open'),
    internal,
  ],
  [
    'reviewer_not_eligible (08 token)',
    raise('reviewer_not_eligible'),
    internal,
  ],
  [
    'separation_of_duties (06/07 token)',
    raise('separation_of_duties'),
    internal,
  ],
  [
    'subject_not_submittable (06 token)',
    raise('subject_not_submittable'),
    internal,
  ],
];
