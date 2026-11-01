import { describe, expect, it } from 'vitest';

import { CMS_SLICE_11_OPERATION_REASONS } from '@wejammin/contracts';

import {
  classifyWorkflowRefusal,
  type ClassifiedRefusal,
} from './cms-workflow-refusal';
import type { WorkflowRefusal } from './cms-workflow-command-transport';

const refusal = (
  overrides: Partial<WorkflowRefusal> = {},
): WorkflowRefusal => ({
  status: 409,
  code: 'CONFLICT',
  reason: null,
  details: null,
  conflict: null,
  violations: [],
  retryAfterSeconds: null,
  preflightUnavailable: false,
  requestId: '0195b6f0-0000-7000-8000-000000000001',
  ...overrides,
});

const classify = (
  operationId: Parameters<typeof classifyWorkflowRefusal>[0],
  overrides: Partial<WorkflowRefusal>,
): ClassifiedRefusal =>
  classifyWorkflowRefusal(operationId, refusal(overrides));

describe('403 gates', () => {
  it('renders the capability gate and never a step-up route', () => {
    const gate = classify('CMS-03B-06', {
      status: 403,
      code: 'FORBIDDEN',
      reason: 'capability_missing',
    });
    expect(gate).toMatchObject({
      kind: 'gate',
      rotateKey: true,
      refetch: false,
    });
    expect(gate.message).toBe(
      'Your account does not have the capability for this action.',
    );
  });

  it('names the second-person rule per operation', () => {
    expect(
      classify('CMS-03B-09', { status: 403, reason: 'separation_of_duties' })
        .message,
    ).toBe(
      'A second person with the publisher capability must publish this revision.',
    );
    expect(
      classify('CMS-03B-07', { status: 403, reason: 'separation_of_duties' })
        .message,
    ).toBe(
      'A second person with the publisher capability must publish this revision.',
    );
    expect(
      classify('CMS-03B-06', { status: 403, reason: 'separation_of_duties' })
        .message,
    ).toBe(
      'You cannot record a decision on your own work or on a review you submitted.',
    );
    expect(
      classify('CMS-03B-05', { status: 403, reason: 'separation_of_duties' })
        .message,
    ).toBe('A different person must do this step.');
  });

  it('falls back to the generic gate copy for a 403 without a token', () => {
    expect(classify('CMS-03B-18', { status: 403, reason: null }).message).toBe(
      'This account cannot do this.',
    );
  });
});

describe('404 and 409', () => {
  it('shows one non-disclosing line for a concealed record', () => {
    expect(classify('CMS-03B-06', { status: 404 })).toMatchObject({
      kind: 'not-available',
      message: 'This record is not available.',
      refetch: false,
    });
  });

  it.each([
    [
      'CMS-03B-05',
      'dependency_changed',
      'The checks changed. Review the updated results.',
    ],
    [
      'CMS-03B-05',
      'revision_not_submittable',
      'The checks changed. Review the updated results.',
    ],
    [
      'CMS-03B-07',
      'dependency_changed',
      'The approved candidate changed. Review the updated checks.',
    ],
    [
      'CMS-03B-09',
      'version_set_stale',
      'The approved candidate changed. Review the updated checks.',
    ],
    [
      'CMS-03B-08',
      'version_set_stale',
      'The candidate changed. Review the updated candidate.',
    ],
    [
      'CMS-03B-06',
      'dependency_changed',
      'The review was invalidated because its dependencies changed.',
    ],
    ['CMS-03B-06', 'review_not_open', 'This review is no longer open.'],
    [
      'CMS-03B-06',
      'duplicate_decision',
      'You already recorded a decision on this review.',
    ],
    [
      'CMS-03B-06',
      'specialist_slot_unsatisfiable',
      'Your account cannot fill a required specialist slot on this review.',
    ],
    [
      'CMS-03B-18',
      'assignment_exists',
      'That reviewer already has an active assignment on this review.',
    ],
    [
      'CMS-03B-18',
      'assignment_limit',
      'This review already has the maximum of 16 active assignments.',
    ],
    ['CMS-03B-18', 'review_not_open', 'This review is no longer open.'],
    [
      'CMS-03B-09',
      'publication_conflict',
      'Another publication was recorded for this audience and locale. Review the updated history.',
    ],
    [
      'CMS-03B-08',
      'preview_expired',
      'This preview has expired. Create a new preview.',
    ],
    [
      'CMS-03B-07',
      'preflight_evidence_stale',
      'The accessibility check is out of date. Try again.',
    ],
  ] as const)(
    '%s %s refetches with fixed copy',
    (operationId, reason, message) => {
      expect(classify(operationId, { reason })).toMatchObject({
        kind: 'refetch',
        message,
        refetch: true,
        rotateKey: true,
      });
    },
  );

  it('shows one uniform line for every ineligible reviewer without refetching', () => {
    expect(
      classify('CMS-03B-18', { reason: 'reviewer_not_eligible' }),
    ).toMatchObject({
      kind: 'field',
      message: 'That person cannot be assigned to this review.',
      refetch: false,
      fields: ['reviewerPersonId'],
    });
  });

  it('refetches on a stale version and rotates the key on an idempotency mismatch', () => {
    expect(
      classify('CMS-03B-06', { conflict: 'VERSION_MISMATCH' }),
    ).toMatchObject({
      kind: 'refetch',
      message: 'This record changed. Review the current version.',
      refetch: true,
    });
    expect(
      classify('CMS-03B-06', { conflict: 'INVALID_TRANSITION' }),
    ).toMatchObject({
      kind: 'refetch',
      refetch: true,
    });
    expect(
      classify('CMS-03B-06', { conflict: 'IDEMPOTENCY_MISMATCH' }),
    ).toMatchObject({
      kind: 'invalid',
      refetch: false,
      rotateKey: true,
    });
    expect(classify('CMS-03B-06', {})).toMatchObject({
      kind: 'refetch',
      message: 'This record changed. Review the current version.',
    });
  });
});

describe('422 refusals', () => {
  it('lists the failed and unavailable categories of a preflight refusal', () => {
    const result = classify('CMS-03B-05', {
      status: 422,
      reason: 'preflight_failed',
      details: {
        reasonCode: 'preflight_failed',
        preflight: [
          {
            category: 'contract',
            outcome: 'failed',
            reasonCode: 'value_invalid',
          },
          {
            category: 'accessibility',
            outcome: 'unavailable',
            reasonCode: 'checker_failed',
          },
          { category: 'schema', outcome: 'passed', reasonCode: null },
        ],
      },
    });
    expect(result).toMatchObject({
      kind: 'preflight',
      message: 'Some checks did not pass. Nothing was submitted.',
      refetch: true,
    });
    expect(result.preflight).toEqual([
      { category: 'contract', outcome: 'failed', reasonCode: 'value_invalid' },
      {
        category: 'accessibility',
        outcome: 'unavailable',
        reasonCode: 'checker_failed',
      },
    ]);
  });

  it('maps each time-authority token to its field and fixed copy', () => {
    const cases: readonly [string, string, string[]][] = [
      ['unknown_timezone', 'That time zone is not recognised.', ['timezone']],
      [
        'tzdb_version_mismatch',
        'The time zone data changed. Reload the form and choose the time again.',
        ['timezone'],
      ],
      [
        'nonexistent_local_time',
        'That local time does not exist in this time zone.',
        ['localDateTime'],
      ],
      [
        'ambiguous_local_time',
        'That local time happens twice. Choose the earlier or later one.',
        ['disambiguation'],
      ],
      [
        'disambiguation_not_applicable',
        'Earlier or later applies only to a local time that happens twice.',
        ['disambiguation'],
      ],
      [
        'resolved_utc_mismatch',
        'The resolved time did not match. Choose the time again.',
        ['localDateTime'],
      ],
      [
        'schedule_out_of_horizon',
        'Choose a time between one minute and 366 days from now.',
        ['localDateTime'],
      ],
      [
        'authority_ends_before_schedule',
        'Your publisher access ends before this time. Choose an earlier time.',
        ['localDateTime'],
      ],
      [
        'expiry_out_of_bounds',
        'Choose an expiry within seven days that ends before the reviewer access ends.',
        ['expiresAt'],
      ],
      [
        'dependency_manifest_too_large',
        'The dependency manifest is too large to submit.',
        [],
      ],
    ];
    for (const [reason, message, fields] of cases)
      expect(
        classify('CMS-03B-07', { status: 422, reason: reason as never }),
      ).toMatchObject({
        kind: 'field',
        message,
        fields,
        refetch: false,
        rotateKey: true,
      });
  });

  it('keeps the stated alternatives of a nonexistent or ambiguous local time', () => {
    const gap = classify('CMS-03B-07', {
      status: 422,
      reason: 'nonexistent_local_time',
      details: {
        reasonCode: 'nonexistent_local_time',
        alternatives: [
          {
            localDateTime: '2026-03-08T01:30:00',
            resolvedUtc: '2026-03-08T06:30:00Z',
          },
          {
            localDateTime: '2026-03-08T03:30:00',
            resolvedUtc: '2026-03-08T07:30:00Z',
          },
        ],
      },
    });
    expect(gap.alternatives).toEqual([
      {
        localDateTime: '2026-03-08T01:30:00',
        resolvedUtc: '2026-03-08T06:30:00Z',
      },
      {
        localDateTime: '2026-03-08T03:30:00',
        resolvedUtc: '2026-03-08T07:30:00Z',
      },
    ]);
    const fold = classify('CMS-03B-07', {
      status: 422,
      reason: 'ambiguous_local_time',
      details: {
        reasonCode: 'ambiguous_local_time',
        alternatives: [
          { disambiguation: 'earlier', resolvedUtc: '2026-11-01T05:30:00Z' },
          { disambiguation: 'later', resolvedUtc: '2026-11-01T06:30:00Z' },
        ],
      },
    });
    expect(fold.alternatives).toBeNull();
    expect(fold.foldAlternatives).toEqual([
      { disambiguation: 'earlier', resolvedUtc: '2026-11-01T05:30:00Z' },
      { disambiguation: 'later', resolvedUtc: '2026-11-01T06:30:00Z' },
    ]);
  });

  it('states the accepted window of an out-of-horizon refusal from its members', () => {
    const result = classify('CMS-03B-07', {
      status: 422,
      reason: 'schedule_out_of_horizon',
      details: {
        reasonCode: 'schedule_out_of_horizon',
        minUtc: '2026-10-08T12:01:00Z',
        maxUtc: '2027-10-09T12:00:00Z',
      },
    });
    expect(result.window).toEqual({
      minUtc: '2026-10-08T12:01:00Z',
      maxUtc: '2027-10-09T12:00:00Z',
    });
  });

  it('links each field violation to its control and keeps an unmapped pointer in the summary', () => {
    const result = classify('CMS-03B-06', {
      status: 422,
      violations: [
        { path: '/reason', code: 'reason_too_long' },
        { path: '/decision', code: 'invalid_value' },
        { path: '/somethingElse', code: 'invalid_value' },
      ],
    });
    expect(result).toMatchObject({
      kind: 'field',
      message: 'Check the highlighted fields.',
      fields: ['reason', 'decision'],
    });
  });

  it('states a plain 422 without violations as a generic field refusal', () => {
    expect(classify('CMS-03B-06', { status: 422 })).toMatchObject({
      kind: 'field',
      fields: [],
    });
  });
});

describe('rate limits, dependencies and generic refusals', () => {
  it('keeps the key and the input on a 429 and states the wait', () => {
    expect(
      classify('CMS-03B-06', { status: 429, retryAfterSeconds: 12 }),
    ).toMatchObject({
      kind: 'rate-limited',
      message: 'Too many attempts. Try again in 12 seconds.',
      rotateKey: false,
      refetch: false,
    });
    expect(classify('CMS-03B-06', { status: 429 }).message).toBe(
      'Too many attempts. Try again shortly.',
    );
  });

  it('presents a retryable preflight 503 as degraded and keeps the key', () => {
    expect(
      classify('CMS-03B-05', {
        status: 503,
        preflightUnavailable: true,
        retryAfterSeconds: 30,
      }),
    ).toMatchObject({
      kind: 'preflight-unavailable',
      message:
        'A required check is unavailable right now. Nothing was submitted; try again in 30 seconds.',
      rotateKey: false,
      refetch: true,
    });
    expect(
      classify('CMS-03B-05', { status: 503, preflightUnavailable: true })
        .message,
    ).toBe(
      'A required check is unavailable right now. Nothing was submitted; try again shortly.',
    );
  });

  it.each([400, 415, 405])('treats a %s as an invalid request', (status) => {
    expect(classify('CMS-03B-06', { status })).toMatchObject({
      kind: 'invalid',
      message: 'This request could not be sent. Reload the page and try again.',
      rotateKey: true,
      refetch: false,
    });
  });
});

describe('closed vocabulary', () => {
  it('has fixed copy for every token any operation can publish', () => {
    const tokens = new Set(
      Object.values(CMS_SLICE_11_OPERATION_REASONS).flat(),
    );
    for (const [operationId, reasons] of Object.entries(
      CMS_SLICE_11_OPERATION_REASONS,
    ))
      for (const reason of reasons) {
        const status = ['capability_missing', 'separation_of_duties'].includes(
          reason,
        )
          ? 403
          : [
                'preflight_failed',
                'dependency_manifest_too_large',
                'unknown_timezone',
                'tzdb_version_mismatch',
                'nonexistent_local_time',
                'ambiguous_local_time',
                'disambiguation_not_applicable',
                'resolved_utc_mismatch',
                'schedule_out_of_horizon',
                'authority_ends_before_schedule',
                'expiry_out_of_bounds',
              ].includes(reason)
            ? 422
            : 409;
        const result = classifyWorkflowRefusal(
          operationId as never,
          refusal({ status, reason: reason as never }),
        );
        expect(
          result.message.length,
          `${operationId} ${reason}`,
        ).toBeGreaterThan(8);
        expect(result.message).not.toMatch(/undefined|\{|\}/u);
      }
    expect(tokens.size).toBeGreaterThan(20);
  });
});
