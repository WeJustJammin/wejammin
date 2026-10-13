import { describe, expect, it } from 'vitest';

import { ApiErrorSchema } from '../api-error';
import { CmsStepUpRequiredDetailsSchema } from '../content-schema-registry/step-up-required';
import {
  CMS_SLICE_11_CONFLICT_REASONS,
  CMS_SLICE_11_EXECUTOR_ONLY_REASONS,
  CMS_SLICE_11_FORBIDDEN_REASONS,
  CMS_SLICE_11_OPERATION_REASONS,
  CMS_SLICE_11_VALIDATION_REASONS,
  CmsEditorialRefusalDetailsSchema,
  CmsPreflightUnavailableDetailsSchema,
  CmsSlice11ReasonCodeSchema,
  CmsStaleVersionDetailsSchema,
  cmsSlice11ReasonStatus,
} from './index';
import { hash, hash2 } from './workflow-fixtures.test-support';

/**
 * BE03b "Contract and error matrix" and the closed catalog under it, per browser
 * operation, in catalog order: 403 tokens first, then 409, then 422.
 */
const EXPECTED_OPERATION_REASONS = {
  'CMS-03B-05': [
    'capability_missing',
    'separation_of_duties',
    'revision_not_submittable',
    'dependency_changed',
    'preflight_failed',
    'dependency_manifest_too_large',
    'preflight_evidence_stale',
  ],
  'CMS-03B-06': [
    'capability_missing',
    'separation_of_duties',
    'review_not_open',
    'duplicate_decision',
    'specialist_slot_unsatisfiable',
    'dependency_changed',
  ],
  'CMS-03B-07': [
    'capability_missing',
    'separation_of_duties',
    'version_set_stale',
    'dependency_changed',
    'preflight_failed',
    'preflight_evidence_stale',
    'unknown_timezone',
    'tzdb_version_mismatch',
    'nonexistent_local_time',
    'ambiguous_local_time',
    'disambiguation_not_applicable',
    'resolved_utc_mismatch',
    'schedule_out_of_horizon',
    'authority_ends_before_schedule',
  ],
  'CMS-03B-08': ['capability_missing', 'version_set_stale', 'preview_expired'],
  'CMS-03B-09': [
    'capability_missing',
    'separation_of_duties',
    'version_set_stale',
    'dependency_changed',
    'publication_conflict',
    'preflight_failed',
    'preflight_evidence_stale',
  ],
  'CMS-03B-15': ['capability_missing'],
  'CMS-03B-16': ['capability_missing'],
  'CMS-03B-17': [],
  'CMS-03B-18': [
    'capability_missing',
    'reviewer_not_eligible',
    'assignment_exists',
    'assignment_limit',
    'review_not_open',
    'expiry_out_of_bounds',
  ],
} as const;

/** True when `catalog` has exactly the expected operations, each with exactly its ordered tokens. */
const catalogMatches = (
  catalog: Readonly<Record<string, readonly string[]>>,
): boolean =>
  JSON.stringify(Object.entries(catalog)) ===
  JSON.stringify(Object.entries(EXPECTED_OPERATION_REASONS));

type Parser = { safeParse: (value: unknown) => { success: boolean } };
const refused = (schema: Parser, value: unknown): boolean =>
  !schema.safeParse(value).success;

describe('[P2-S11-AC-009][P2-S11-AC-021][P2-S11-AC-027][P2-S11-AC-033] closed Slice 11 reason catalog', () => {
  it('pins the three status groups to the exact BE03b tokens', () => {
    expect([...CMS_SLICE_11_FORBIDDEN_REASONS]).toEqual([
      'capability_missing',
      'separation_of_duties',
    ]);
    expect([...CMS_SLICE_11_CONFLICT_REASONS]).toEqual([
      'revision_not_submittable',
      'dependency_changed',
      'version_set_stale',
      'review_not_open',
      'duplicate_decision',
      'specialist_slot_unsatisfiable',
      'reviewer_not_eligible',
      'assignment_exists',
      'assignment_limit',
      'publication_conflict',
      'publication_not_active',
      'preview_expired',
      'preflight_evidence_stale',
    ]);
    expect([...CMS_SLICE_11_VALIDATION_REASONS]).toEqual([
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
    ]);
    expect(CmsSlice11ReasonCodeSchema.options).toHaveLength(26);
    expect(new Set(CmsSlice11ReasonCodeSchema.options).size).toBe(26);
  });

  it('maps each token to its single HTTP status', () => {
    for (const token of CMS_SLICE_11_FORBIDDEN_REASONS)
      expect(cmsSlice11ReasonStatus(token)).toBe(403);
    for (const token of CMS_SLICE_11_CONFLICT_REASONS)
      expect(cmsSlice11ReasonStatus(token)).toBe(409);
    for (const token of CMS_SLICE_11_VALIDATION_REASONS)
      expect(cmsSlice11ReasonStatus(token)).toBe(422);
  });

  it('names for each browser operation exactly the ordered tokens its matrix row allows', () => {
    // Exact and ordered: a subset or membership assertion would pass an extra,
    // an executor-only or a reordered token.
    expect(CMS_SLICE_11_OPERATION_REASONS).toEqual(EXPECTED_OPERATION_REASONS);
    expect(Object.keys(CMS_SLICE_11_OPERATION_REASONS)).toEqual(
      Object.keys(EXPECTED_OPERATION_REASONS),
    );
    for (const [operationId, tokens] of Object.entries(
      CMS_SLICE_11_OPERATION_REASONS,
    )) {
      expect(new Set(tokens).size, operationId).toBe(tokens.length);
      for (const token of tokens)
        expect(
          CmsSlice11ReasonCodeSchema.safeParse(token).success,
          `${operationId} ${token}`,
        ).toBe(true);
    }
  });

  it('keeps the executor-only tokens out of every browser operation', () => {
    for (const [operationId, tokens] of Object.entries(
      CMS_SLICE_11_OPERATION_REASONS,
    ))
      for (const executorOnly of CMS_SLICE_11_EXECUTOR_ONLY_REASONS)
        expect(tokens, `${operationId} ${executorOnly}`).not.toContain(
          executorOnly,
        );
    for (const executorOnly of CMS_SLICE_11_EXECUTOR_ONLY_REASONS)
      expect(
        Object.values(CMS_SLICE_11_OPERATION_REASONS).flat(),
        executorOnly,
      ).not.toContain(executorOnly);
  });

  it('gives a safe read only the read-scope token and the queue none', () => {
    for (const operationId of ['CMS-03B-15', 'CMS-03B-16'] as const)
      expect([...CMS_SLICE_11_OPERATION_REASONS[operationId]]).toEqual([
        'capability_missing',
      ]);
    expect([...CMS_SLICE_11_OPERATION_REASONS['CMS-03B-17']]).toEqual([]);
  });

  it('detects an extra, executor-only, missing, reordered or misplaced token in a catalog', () => {
    const base = EXPECTED_OPERATION_REASONS;
    const mutate = (
      operationId: keyof typeof base,
      tokens: readonly string[],
    ): Record<string, readonly string[]> => ({
      ...base,
      [operationId]: tokens,
    });
    expect(catalogMatches(base)).toBe(true);
    const mutants: Record<string, readonly string[]>[] = [
      mutate('CMS-03B-07', [...base['CMS-03B-07'], 'publication_not_active']),
      mutate('CMS-03B-09', [...base['CMS-03B-09'], 'preview_expired']),
      mutate('CMS-03B-15', ['capability_missing', 'separation_of_duties']),
      mutate('CMS-03B-17', ['capability_missing']),
      mutate('CMS-03B-06', base['CMS-03B-06'].slice(1)),
      mutate('CMS-03B-06', [...base['CMS-03B-06']].reverse()),
      mutate('CMS-03B-18', [
        'reviewer_not_eligible',
        'capability_missing',
        ...base['CMS-03B-18'].slice(2),
      ]),
      mutate('CMS-03B-08', []),
      Object.fromEntries(Object.entries(base).slice(1)),
      { ...base, 'CMS-03B-19': ['capability_missing'] },
    ];
    for (const [index, mutant] of mutants.entries())
      expect(catalogMatches(mutant), `mutant ${String(index)}`).toBe(false);
  });

  it('leaves no token unowned: every token is a browser reason or an executor-only schedule reason', () => {
    const browser = new Set(
      Object.values(CMS_SLICE_11_OPERATION_REASONS).flat(),
    );
    for (const token of CmsSlice11ReasonCodeSchema.options)
      expect(
        browser.has(token) ||
          (CMS_SLICE_11_EXECUTOR_ONLY_REASONS as readonly string[]).includes(
            token,
          ),
        token,
      ).toBe(true);
    expect([...CMS_SLICE_11_EXECUTOR_ONLY_REASONS]).toEqual([
      'publication_not_active',
    ]);
  });
});

describe('[P2-S11-AC-021] refusal details per reason token', () => {
  const asApiError = (details: unknown, code = 'VALIDATION_FAILED') =>
    ApiErrorSchema.safeParse({
      code,
      message: 'Refused.',
      requestId: '123e4567-e89b-42d3-a456-426614174000',
      details,
    }).success;

  it('carries preflight_failed with at most seventeen category/outcome/reason entries and no counts', () => {
    const entry = {
      category: 'security',
      outcome: 'failed',
      reasonCode: 'unsafe_content',
    };
    const details = { reasonCode: 'preflight_failed', preflight: [entry] };
    expect(CmsEditorialRefusalDetailsSchema.safeParse(details).success).toBe(
      true,
    );
    expect(asApiError(details)).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        reasonCode: 'preflight_failed',
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        ...details,
        preflight: Array.from({ length: 18 }, () => entry),
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        ...details,
        preflight: [{ ...entry, blockingCount: 2 }],
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, { ...details, findings: [] }),
    ).toBe(true);
  });

  it('carries dependency_changed with only the current dependency hash', () => {
    expect(
      CmsEditorialRefusalDetailsSchema.safeParse({
        reasonCode: 'dependency_changed',
        dependencyHash: hash,
      }).success,
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        reasonCode: 'dependency_changed',
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        reasonCode: 'dependency_changed',
        dependencyHash: 'x',
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        reasonCode: 'dependency_changed',
        dependencyHash: hash,
        manifest: {},
      }),
    ).toBe(true);
  });

  it('carries the time-authority members: pinnedVersion, expectedUtc, horizon bounds and alternatives', () => {
    expect(
      CmsEditorialRefusalDetailsSchema.safeParse({
        reasonCode: 'tzdb_version_mismatch',
        pinnedVersion: '2026e',
      }).success,
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        reasonCode: 'tzdb_version_mismatch',
        pinnedVersion: 'not valid',
      }),
    ).toBe(true);
    expect(
      CmsEditorialRefusalDetailsSchema.safeParse({
        reasonCode: 'resolved_utc_mismatch',
        expectedUtc: '2026-11-01T14:30:00Z',
      }).success,
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        reasonCode: 'resolved_utc_mismatch',
      }),
    ).toBe(true);
    expect(
      CmsEditorialRefusalDetailsSchema.safeParse({
        reasonCode: 'schedule_out_of_horizon',
        minUtc: '2026-10-08T12:01:00Z',
        maxUtc: '2027-10-09T12:00:00Z',
      }).success,
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        reasonCode: 'schedule_out_of_horizon',
        minUtc: '2026-10-08T12:01:00Z',
      }),
    ).toBe(true);
    const gap = {
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
    };
    expect(CmsEditorialRefusalDetailsSchema.safeParse(gap).success).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        ...gap,
        alternatives: [gap.alternatives[0]],
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        ...gap,
        alternatives: [...gap.alternatives, gap.alternatives[0]],
      }),
    ).toBe(true);
    const fold = {
      reasonCode: 'ambiguous_local_time',
      alternatives: [
        { disambiguation: 'earlier', resolvedUtc: '2026-11-01T05:30:00Z' },
        { disambiguation: 'later', resolvedUtc: '2026-11-01T06:30:00Z' },
      ],
    };
    expect(CmsEditorialRefusalDetailsSchema.safeParse(fold).success).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        ...fold,
        alternatives: [
          { disambiguation: 'none', resolvedUtc: '2026-11-01T05:30:00Z' },
          fold.alternatives[1],
        ],
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        ...fold,
        alternatives: [fold.alternatives[1], fold.alternatives[0]],
      }),
    ).toBe(true);
  });

  it('accepts every other token with its reason and bounded RFC 6901 violations only', () => {
    const plain = [
      'capability_missing',
      'separation_of_duties',
      'revision_not_submittable',
      'version_set_stale',
      'review_not_open',
      'duplicate_decision',
      'specialist_slot_unsatisfiable',
      'reviewer_not_eligible',
      'assignment_exists',
      'assignment_limit',
      'publication_conflict',
      'publication_not_active',
      'preview_expired',
      'preflight_evidence_stale',
      'dependency_manifest_too_large',
      'unknown_timezone',
      'disambiguation_not_applicable',
      'authority_ends_before_schedule',
      'expiry_out_of_bounds',
    ];
    for (const reasonCode of plain)
      expect(
        CmsEditorialRefusalDetailsSchema.safeParse({ reasonCode }).success,
        reasonCode,
      ).toBe(true);
    const violation = {
      path: '/timezone',
      code: 'unknown_timezone',
      message: 'The value is invalid.',
    };
    expect(
      CmsEditorialRefusalDetailsSchema.safeParse({
        reasonCode: 'unknown_timezone',
        violations: [violation],
      }).success,
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        reasonCode: 'unknown_timezone',
        violations: Array.from({ length: 51 }, () => violation),
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        reasonCode: 'unknown_timezone',
        violations: [{ ...violation, path: 'timezone' }],
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        reasonCode: 'unknown_timezone',
        violations: [{ ...violation, value: 'Mars/Base' }],
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, { reasonCode: 'made_up' }),
    ).toBe(true);
    expect(
      refused(CmsEditorialRefusalDetailsSchema, {
        reasonCode: 'review_not_open',
        ownerId: 'x',
      }),
    ).toBe(true);
    expect(refused(CmsEditorialRefusalDetailsSchema, {})).toBe(true);
  });

  it('types the 503 preflight dependency refusal, the stale CAS conflict and the step-up 401', () => {
    expect(
      CmsPreflightUnavailableDetailsSchema.safeParse({
        dependencyClass: 'preflight',
        retryable: true,
      }).success,
    ).toBe(true);
    expect(
      CmsPreflightUnavailableDetailsSchema.safeParse({
        dependencyClass: 'preflight',
        retryable: true,
        retryAfterSeconds: 5,
      }).success,
    ).toBe(true);
    expect(
      refused(CmsPreflightUnavailableDetailsSchema, {
        dependencyClass: 'preflight',
        retryable: false,
      }),
    ).toBe(true);
    expect(
      refused(CmsPreflightUnavailableDetailsSchema, {
        dependencyClass: 'cms_editorial',
        retryable: true,
      }),
    ).toBe(true);
    expect(
      refused(CmsPreflightUnavailableDetailsSchema, {
        dependencyClass: 'preflight',
        retryable: true,
        preflight: [],
      }),
    ).toBe(true);
    expect(
      CmsStaleVersionDetailsSchema.safeParse({
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'refresh',
        expectedVersion: '3',
        currentVersion: '4',
      }).success,
    ).toBe(true);
    expect(
      CmsStaleVersionDetailsSchema.safeParse({
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'refresh',
      }).success,
    ).toBe(true);
    expect(
      refused(CmsStaleVersionDetailsSchema, {
        conflict: 'INVALID_TRANSITION',
        recoveryAction: 'refresh',
      }),
    ).toBe(true);
    expect(
      refused(CmsStaleVersionDetailsSchema, {
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'refresh',
        currentVersion: '0',
      }),
    ).toBe(true);
    expect(
      CmsStepUpRequiredDetailsSchema.safeParse({
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      }).success,
    ).toBe(true);
    expect(
      CmsStepUpRequiredDetailsSchema.safeParse({
        recoveryAction: 'step_up',
        allowedMethods: [],
      }).success,
    ).toBe(true);
    expect(
      refused(CmsStepUpRequiredDetailsSchema, {
        recoveryAction: 'reauthenticate',
        allowedMethods: [],
      }),
    ).toBe(true);
    expect(hash2).not.toBe(hash);
  });
});
