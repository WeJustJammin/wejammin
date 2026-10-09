import { describe, expect, it } from 'vitest';

import {
  CMS_EDITORIAL_INTERNAL_OPERATIONS,
  CMS_EDITORIAL_OPERATION_IDS,
  CMS_PREVIEW_TOKEN_DOMAIN,
  CMS_PREVIEW_TOKEN_TTL_SECONDS,
  CMS_PREVIEW_VERIFIER_CIRCUIT_OPEN_SECONDS,
  CMS_PREVIEW_VERIFIER_RETRY_DELAYS_MS,
  CMS_PREVIEW_VERIFIER_TIMEOUT_MS,
  CMS_SCHEDULE_CLAIM_BATCH_DEFAULT,
  CMS_SCHEDULE_CLAIM_BATCH_MAX,
  CMS_SCHEDULE_DEADLINE_MS,
  CMS_SCHEDULE_LEASE_SECONDS,
  CMS_SCHEDULE_MAX_RETRY_ATTEMPTS,
  CMS_SCHEDULE_RETRY_DELAYS_SECONDS,
  CMS_SCHEDULE_SWEEP_INTERVAL_SECONDS,
  ClaimDueSchedulesRequestSchema,
  ClaimDueSchedulesResultSchema,
  ClaimedScheduleSchema,
  ExecuteScheduleRequestSchema,
  PreviewVerificationRequestSchema,
  PreviewVerificationResultSchema,
  ScheduleExecutionResultSchema,
  cmsEditorialRoutePolicies,
  cmsScheduleRetryDelaySeconds,
  previewVerificationDenial,
} from './index';
import {
  hash,
  uid,
  uuid,
  validClaimedSchedule,
  validExecuteRequest,
  validExecutionCompleted,
  validVerificationDenied,
  validVerificationRequest,
  validVerificationValid,
  validVersionSet,
  without,
} from './workflow-fixtures.test-support';

type Parser = { safeParse: (value: unknown) => { success: boolean } };
const refused = (schema: Parser, value: unknown): boolean =>
  !schema.safeParse(value).success;

describe('[P2-S11-AC-073] CMS-03B-19 PreviewVerificationRequest and PreviewVerificationResult', () => {
  it('takes a lowercase SHA-256 token hash and never a plaintext token', () => {
    expect(
      PreviewVerificationRequestSchema.parse(validVerificationRequest),
    ).toEqual(validVerificationRequest);
    expect(
      refused(PreviewVerificationRequestSchema, {
        ...validVerificationRequest,
        tokenHash: hash.toUpperCase(),
      }),
    ).toBe(true);
    expect(
      refused(PreviewVerificationRequestSchema, {
        ...validVerificationRequest,
        tokenHash: 'A'.repeat(43),
      }),
    ).toBe(true);
    expect(
      refused(PreviewVerificationRequestSchema, {
        ...validVerificationRequest,
        token: 'A'.repeat(43),
      }),
    ).toBe(true);
    const withoutHash = without(validVerificationRequest, 'tokenHash');
    expect(refused(PreviewVerificationRequestSchema, withoutHash)).toBe(true);
  });

  it('binds the actor person, the 64-hex acting-context version, route, locale and audience', () => {
    expect(
      refused(PreviewVerificationRequestSchema, {
        ...validVerificationRequest,
        actorPersonId: 'x',
      }),
    ).toBe(true);
    expect(
      refused(PreviewVerificationRequestSchema, {
        ...validVerificationRequest,
        actingContextVersion: 'short',
      }),
    ).toBe(true);
    expect(
      refused(PreviewVerificationRequestSchema, {
        ...validVerificationRequest,
        locale: 'x',
      }),
    ).toBe(true);
    expect(
      refused(PreviewVerificationRequestSchema, {
        ...validVerificationRequest,
        audience: 'Members',
      }),
    ).toBe(true);
    expect(
      refused(PreviewVerificationRequestSchema, {
        ...validVerificationRequest,
        audience: 'a'.repeat(49),
      }),
    ).toBe(true);
    expect(
      PreviewVerificationRequestSchema.safeParse({
        ...validVerificationRequest,
        route: '/'.padEnd(4096, 'a'),
      }).success,
    ).toBe(true);
    expect(
      refused(PreviewVerificationRequestSchema, {
        ...validVerificationRequest,
        route: '/'.padEnd(4097, 'a'),
      }),
    ).toBe(true);
    expect(
      refused(PreviewVerificationRequestSchema, {
        ...validVerificationRequest,
        userId: uuid,
      }),
    ).toBe(true);
  });

  it('returns a discriminated result: valid carries the binding, denied carries only nulls', () => {
    expect(
      PreviewVerificationResultSchema.parse(validVerificationValid),
    ).toEqual(validVerificationValid);
    expect(
      PreviewVerificationResultSchema.parse(validVerificationDenied),
    ).toEqual(validVerificationDenied);
    expect(
      PreviewVerificationResultSchema.safeParse({
        ...validVerificationDenied,
        revoked: true,
      }).success,
    ).toBe(true);
    for (const key of [
      'userId',
      'entryId',
      'revisionId',
      'exactVersionSet',
      'expiresAt',
    ] as const)
      expect(
        refused(PreviewVerificationResultSchema, {
          ...validVerificationDenied,
          [key]: validVerificationValid[key],
        }),
        key,
      ).toBe(true);
    for (const key of [
      'userId',
      'entryId',
      'revisionId',
      'exactVersionSet',
      'expiresAt',
    ] as const)
      expect(
        refused(PreviewVerificationResultSchema, {
          ...validVerificationValid,
          [key]: null,
        }),
        key,
      ).toBe(true);
  });

  it('never marks a valid result revoked and refuses an unknown or missing discriminant', () => {
    expect(
      refused(PreviewVerificationResultSchema, {
        ...validVerificationValid,
        revoked: true,
      }),
    ).toBe(true);
    expect(
      refused(PreviewVerificationResultSchema, {
        ...validVerificationDenied,
        revoked: 'false',
      }),
    ).toBe(true);
    expect(
      refused(PreviewVerificationResultSchema, {
        ...validVerificationValid,
        valid: 'true',
      }),
    ).toBe(true);
    const withoutDiscriminant = without(validVerificationValid, 'valid');
    expect(refused(PreviewVerificationResultSchema, withoutDiscriminant)).toBe(
      true,
    );
    expect(
      refused(PreviewVerificationResultSchema, {
        ...validVerificationValid,
        token: 'x',
      }),
    ).toBe(true);
    expect(
      refused(PreviewVerificationResultSchema, {
        ...validVerificationValid,
        route: '/x',
      }),
    ).toBe(true);
    expect(
      refused(PreviewVerificationResultSchema, {
        ...validVerificationValid,
        exactVersionSet: { ...validVersionSet, settingsVersion: 'x' },
      }),
    ).toBe(true);
    expect(
      refused(PreviewVerificationResultSchema, {
        ...validVerificationValid,
        expiresAt: '2026-10-08T12:15:00',
      }),
    ).toBe(true);
  });

  it('makes every denial byte-identical except the bound owner revoked flag', () => {
    expect(previewVerificationDenial()).toEqual(validVerificationDenied);
    expect(JSON.stringify(previewVerificationDenial())).toBe(
      JSON.stringify(previewVerificationDenial(false)),
    );
    expect(previewVerificationDenial(true)).toEqual({
      ...validVerificationDenied,
      revoked: true,
    });
    expect(
      PreviewVerificationResultSchema.safeParse(previewVerificationDenial(true))
        .success,
    ).toBe(true);
    // A transport failure, timeout or unknown result is the caller's denial: revoked is never guessed.
    expect(JSON.stringify(previewVerificationDenial())).toBe(
      '{"valid":false,"userId":null,"entryId":null,"revisionId":null,"exactVersionSet":null,"expiresAt":null,"revoked":false}',
    );
  });

  it('fixes the verifier deadline, retries, circuit and the derived token lifetime', () => {
    expect(CMS_PREVIEW_VERIFIER_TIMEOUT_MS).toBe(500);
    expect([...CMS_PREVIEW_VERIFIER_RETRY_DELAYS_MS]).toEqual([75, 150]);
    expect(CMS_PREVIEW_VERIFIER_CIRCUIT_OPEN_SECONDS).toBe(30);
    expect(CMS_PREVIEW_TOKEN_TTL_SECONDS).toBe(900);
    expect(CMS_PREVIEW_TOKEN_DOMAIN).toBe('cms.preview.token.v1');
  });
});

describe('[P2-S11-AC-079] CMS-03B-20 claim and execute contracts', () => {
  it('claims a batch of 1-100 integers', () => {
    expect(ClaimDueSchedulesRequestSchema.parse({ batch: 25 })).toEqual({
      batch: 25,
    });
    expect(ClaimDueSchedulesRequestSchema.safeParse({ batch: 1 }).success).toBe(
      true,
    );
    expect(
      ClaimDueSchedulesRequestSchema.safeParse({ batch: 100 }).success,
    ).toBe(true);
    for (const bad of [0, 101, -1, 1.5, '25', null, undefined])
      expect(
        refused(ClaimDueSchedulesRequestSchema, { batch: bad }),
        String(bad),
      ).toBe(true);
    expect(
      refused(ClaimDueSchedulesRequestSchema, { batch: 25, extra: 1 }),
    ).toBe(true);
    expect(CMS_SCHEDULE_CLAIM_BATCH_DEFAULT).toBe(25);
    expect(CMS_SCHEDULE_CLAIM_BATCH_MAX).toBe(100);
  });

  it('returns identifiers, versions, hashes and correlation data only', () => {
    expect(ClaimedScheduleSchema.parse(validClaimedSchedule)).toEqual(
      validClaimedSchedule,
    );
    for (const key of [
      'content',
      'values',
      'comment',
      'token',
      'ownerId',
      'publisherPersonId',
    ])
      expect(
        refused(ClaimedScheduleSchema, { ...validClaimedSchedule, [key]: 'x' }),
        key,
      ).toBe(true);
    for (const key of Object.keys(validClaimedSchedule)) {
      const rest = without(
        validClaimedSchedule,
        key as keyof typeof validClaimedSchedule,
      );
      expect(refused(ClaimedScheduleSchema, rest), key).toBe(true);
    }
    expect(
      refused(ClaimedScheduleSchema, {
        ...validClaimedSchedule,
        scheduleVersion: '0',
      }),
    ).toBe(true);
    expect(
      refused(ClaimedScheduleSchema, { ...validClaimedSchedule, leaseId: 'x' }),
    ).toBe(true);
    expect(
      refused(ClaimedScheduleSchema, {
        ...validClaimedSchedule,
        dependencyHash: 'x',
      }),
    ).toBe(true);
  });

  it('bounds the claim result at 100 distinct schedules', () => {
    const claims = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...validClaimedSchedule,
        scheduleId: uid(500 + index),
      }));
    expect(ClaimDueSchedulesResultSchema.safeParse(claims(100)).success).toBe(
      true,
    );
    expect(ClaimDueSchedulesResultSchema.safeParse([]).success).toBe(true);
    expect(refused(ClaimDueSchedulesResultSchema, claims(101))).toBe(true);
    expect(
      refused(ClaimDueSchedulesResultSchema, [
        validClaimedSchedule,
        validClaimedSchedule,
      ]),
    ).toBe(true);
  });

  it('executes a claimed schedule by its CAS version, lease and verified evidence', () => {
    expect(ExecuteScheduleRequestSchema.parse(validExecuteRequest)).toEqual(
      validExecuteRequest,
    );
    for (const key of Object.keys(validExecuteRequest)) {
      const rest = without(
        validExecuteRequest,
        key as keyof typeof validExecuteRequest,
      );
      expect(refused(ExecuteScheduleRequestSchema, rest), key).toBe(true);
    }
    expect(
      refused(ExecuteScheduleRequestSchema, {
        ...validExecuteRequest,
        evidence: { ...validExecuteRequest.evidence, outcome: 'passed' },
      }),
    ).toBe(true);
    expect(
      refused(ExecuteScheduleRequestSchema, {
        ...validExecuteRequest,
        evidence: { ...validExecuteRequest.evidence, category: 'security' },
      }),
    ).toBe(true);
    expect(
      refused(ExecuteScheduleRequestSchema, {
        ...validExecuteRequest,
        expectedVersion: '0',
      }),
    ).toBe(true);
    expect(
      refused(ExecuteScheduleRequestSchema, {
        ...validExecuteRequest,
        publisherPersonId: uuid,
      }),
    ).toBe(true);
    expect(
      refused(ExecuteScheduleRequestSchema, {
        ...validExecuteRequest,
        mfaAt: '2026-10-08T12:00:00Z',
      }),
    ).toBe(true);
  });

  it('accepts null evidence when the Worker checker produced no proof (DEC-150, DEC-159)', () => {
    const noProof = { ...validExecuteRequest, evidence: null };
    expect(ExecuteScheduleRequestSchema.parse(noProof)).toEqual(noProof);
    expect(
      refused(ExecuteScheduleRequestSchema, {
        ...validExecuteRequest,
        evidence: undefined,
      }),
    ).toBe(true);
  });

  it('types the execution result with the closed outcome and reason coupling', () => {
    expect(
      ScheduleExecutionResultSchema.parse(validExecutionCompleted),
    ).toEqual(validExecutionCompleted);
    const base = {
      scheduleId: uid(1),
      publicationVersionId: null,
      actualUtc: null,
      deviationSeconds: null,
    };
    expect(
      ScheduleExecutionResultSchema.safeParse({
        ...base,
        outcome: 'already_completed',
        reasonCode: null,
      }).success,
    ).toBe(true);
    expect(
      ScheduleExecutionResultSchema.safeParse({
        ...base,
        outcome: 'failed_retryable',
        reasonCode: null,
      }).success,
    ).toBe(true);
    for (const reasonCode of [
      'approval_invalidated',
      'preflight_failed',
      'publisher_authority_ended',
      'publication_not_active',
      'retries_exhausted',
    ])
      expect(
        ScheduleExecutionResultSchema.safeParse({
          ...base,
          outcome: 'blocked',
          reasonCode,
        }).success,
        reasonCode,
      ).toBe(true);
    // DEC-158: cancellation happens only inside the review-invalidation transaction,
    // so the executor's result has exactly the four BE03b outcomes and no `cancelled`.
    for (const outcome of [
      'completed',
      'blocked',
      'failed_retryable',
      'already_completed',
    ])
      expect(
        ScheduleExecutionResultSchema.safeParse({
          ...validExecutionCompleted,
          outcome,
          reasonCode: outcome === 'blocked' ? 'approval_invalidated' : null,
          ...(outcome === 'completed' || outcome === 'already_completed'
            ? {}
            : {
                publicationVersionId: null,
                actualUtc: null,
                deviationSeconds: null,
              }),
        }).success,
        outcome,
      ).toBe(true);
    expect(
      refused(ScheduleExecutionResultSchema, {
        ...base,
        outcome: 'cancelled',
        reasonCode: 'entry_unavailable',
      }),
    ).toBe(true);
    expect(
      refused(ScheduleExecutionResultSchema, {
        ...base,
        outcome: 'blocked',
        reasonCode: null,
      }),
    ).toBe(true);
    expect(
      refused(ScheduleExecutionResultSchema, {
        ...base,
        outcome: 'blocked',
        reasonCode: 'made_up',
      }),
    ).toBe(true);
    expect(
      refused(ScheduleExecutionResultSchema, {
        ...base,
        outcome: 'failed_retryable',
        reasonCode: 'preflight_failed',
      }),
    ).toBe(true);
    expect(
      refused(ScheduleExecutionResultSchema, {
        ...validExecutionCompleted,
        reasonCode: 'preflight_failed',
      }),
    ).toBe(true);
    expect(
      refused(ScheduleExecutionResultSchema, {
        ...base,
        outcome: 'queued',
        reasonCode: null,
      }),
    ).toBe(true);
  });

  it('completes only with a publication row, the actual instant and the deviation, and nothing else does', () => {
    expect(
      refused(ScheduleExecutionResultSchema, {
        ...validExecutionCompleted,
        publicationVersionId: null,
      }),
    ).toBe(true);
    expect(
      refused(ScheduleExecutionResultSchema, {
        ...validExecutionCompleted,
        actualUtc: null,
      }),
    ).toBe(true);
    expect(
      refused(ScheduleExecutionResultSchema, {
        ...validExecutionCompleted,
        deviationSeconds: null,
      }),
    ).toBe(true);
    expect(
      refused(ScheduleExecutionResultSchema, {
        ...validExecutionCompleted,
        deviationSeconds: 1.5,
      }),
    ).toBe(true);
    expect(
      ScheduleExecutionResultSchema.safeParse({
        ...validExecutionCompleted,
        deviationSeconds: -3,
      }).success,
    ).toBe(true);
    for (const outcome of ['blocked', 'failed_retryable'] as const)
      expect(
        refused(ScheduleExecutionResultSchema, {
          ...validExecutionCompleted,
          outcome,
          reasonCode:
            outcome === 'failed_retryable' ? null : 'entry_unavailable',
        }),
        outcome,
      ).toBe(true);
    expect(
      refused(ScheduleExecutionResultSchema, {
        ...validExecutionCompleted,
        token: 'x',
      }),
    ).toBe(true);
  });

  it('fixes the sweep cadence, lease, deadline and the 15/60/300 second retry ladder', () => {
    expect(CMS_SCHEDULE_SWEEP_INTERVAL_SECONDS).toBe(60);
    expect(CMS_SCHEDULE_LEASE_SECONDS).toBe(300);
    expect(CMS_SCHEDULE_DEADLINE_MS).toBe(15_000);
    expect([...CMS_SCHEDULE_RETRY_DELAYS_SECONDS]).toEqual([15, 60, 300]);
    expect(CMS_SCHEDULE_MAX_RETRY_ATTEMPTS).toBe(3);
    expect(cmsScheduleRetryDelaySeconds(1)).toBe(15);
    expect(cmsScheduleRetryDelaySeconds(2)).toBe(60);
    expect(cmsScheduleRetryDelaySeconds(3)).toBe(300);
    // The fourth consecutive retryable failure blocks the schedule: retries_exhausted.
    expect(cmsScheduleRetryDelaySeconds(4)).toBeNull();
    expect(cmsScheduleRetryDelaySeconds(0)).toBeNull();
    expect(cmsScheduleRetryDelaySeconds(1.5)).toBeNull();
  });
});

describe('[P2-S11-AC-073][P2-S11-AC-079] internal operations are never browser routes', () => {
  it('declares exactly the two internal operations with their RPCs and registered principals', () => {
    expect(Object.keys(CMS_EDITORIAL_INTERNAL_OPERATIONS)).toEqual([
      'CMS-03B-19',
      'CMS-03B-20',
    ]);
    expect(CMS_EDITORIAL_INTERNAL_OPERATIONS['CMS-03B-19']).toMatchObject({
      rpcs: ['platform_api.cms_verify_preview_token'],
      principal: 'shard04_delivery',
      readSafe: true,
    });
    expect(CMS_EDITORIAL_INTERNAL_OPERATIONS['CMS-03B-20']).toMatchObject({
      rpcs: [
        'platform_private.cms_claim_due_publication_schedules',
        'platform_private.cms_execute_publication_schedule',
      ],
      principal: 'worker_scheduled_sweep',
      readSafe: false,
    });
  });

  it('keeps both out of the browser operation ids and route registry', () => {
    for (const operationId of Object.keys(CMS_EDITORIAL_INTERNAL_OPERATIONS)) {
      expect(
        (CMS_EDITORIAL_OPERATION_IDS as readonly string[]).includes(
          operationId,
        ),
      ).toBe(false);
      expect(
        cmsEditorialRoutePolicies.some(
          (route) => route.operationId === operationId,
        ),
      ).toBe(false);
    }
  });
});
