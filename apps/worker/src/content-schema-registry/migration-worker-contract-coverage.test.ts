import { describe, expect, it } from 'vitest';

import {
  failure,
  hasExactKeys,
  isCounter,
  isHash,
  isInstant,
  isRecord,
  isSafeToken,
  isUuid,
  isVersion,
  MigrationPlanRecordSchema,
  schema,
  SchemaMigrationBatchResultSchema,
  SchemaMigrationJobPayloadSchema,
  SchemaMigrationQueueEnvelopeSchema,
  validateNullableUuid,
  withinJsonBudget,
} from './migration-worker';
import { parseSchemaActivationEvidence } from './migration-worker-activation-evidence';
import { basePlan, event, job, PLAN_ID } from './migration-worker-test-support';

describe('migration worker contracts and defensive helpers', () => {
  it('covers strict schema primitives and bounded values', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord({})).toBe(true);
    expect(hasExactKeys({ a: 1 }, ['a'])).toBe(true);
    expect(hasExactKeys({ a: 1 }, ['b'])).toBe(false);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(event.eventId)).toBe(true);
    expect(isVersion('0')).toBe(false);
    expect(isVersion('7')).toBe(true);
    expect(isCounter('')).toBe(false);
    expect(isCounter('0')).toBe(true);
    expect(isCounter('01')).toBe(false);
    expect(isCounter('9'.repeat(19))).toBe(true);
    expect(isCounter('9'.repeat(20))).toBe(false);
    expect(isHash('a'.repeat(64))).toBe(true);
    expect(isHash('a'.repeat(63))).toBe(false);
    expect(isInstant(event.occurredAt)).toBe(true);
    expect(isInstant('not-an-instant')).toBe(false);
    expect(isSafeToken('cms.schema:v1')).toBe(true);
    expect(isSafeToken('')).toBe(false);
    expect(isSafeToken('1starts-with-a-digit')).toBe(false);
    expect(isSafeToken('a'.repeat(129))).toBe(false);
    expect(validateNullableUuid(null)).toBe(true);
    expect(validateNullableUuid('bad')).toBe(false);
    expect(withinJsonBudget({ ok: true })).toBe(true);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(withinJsonBudget(circular)).toBe(false);

    const wrapped = schema<string>((value: unknown) =>
      typeof value === 'string'
        ? { success: true, data: value }
        : failure([], 'string required'),
    );
    expect(wrapped.parse('ok')).toBe('ok');
    expect(() => wrapped.parse(1)).toThrow('string required');
  });

  it('rejects malformed job and event payloads at every strict boundary', () => {
    expect(SchemaMigrationJobPayloadSchema.safeParse(job).success).toBe(true);
    for (const [key, value] of [
      ['schemaVersionId', 'bad'],
      ['migrationPlanId', 'bad'],
      ['expectedVersion', '0'],
      ['correlationId', 'bad'],
      ['causationId', 'bad'],
    ] as const) {
      expect(
        SchemaMigrationJobPayloadSchema.safeParse({ ...job, [key]: value })
          .success,
      ).toBe(false);
    }
    expect(
      SchemaMigrationJobPayloadSchema.safeParse({ ...job, causationId: null })
        .success,
    ).toBe(true);
    expect(SchemaMigrationJobPayloadSchema.safeParse(null).success).toBe(false);
    expect(
      SchemaMigrationJobPayloadSchema.safeParse({
        ...job,
        expectedVersion: 'x'.repeat(20_000),
      }).success,
    ).toBe(false);
    expect(
      SchemaMigrationJobPayloadSchema.safeParse({ ...job, extra: true })
        .success,
    ).toBe(false);

    expect(SchemaMigrationQueueEnvelopeSchema.safeParse(event).success).toBe(
      true,
    );
    for (const [key, value] of [
      ['eventId', 'bad'],
      ['eventType', 'bad'],
      ['schemaVersion', 2],
      ['occurredAt', 'bad'],
      ['producer', 'bad token'],
      ['correlationId', 'bad'],
      ['causationId', 'bad'],
      ['aggregateType', 'bad token'],
      ['aggregateId', 'bad'],
      ['aggregateVersion', '0'],
      ['payload', null],
    ] as const) {
      expect(
        SchemaMigrationQueueEnvelopeSchema.safeParse({ ...event, [key]: value })
          .success,
      ).toBe(false);
    }
    expect(
      SchemaMigrationQueueEnvelopeSchema.safeParse({
        ...event,
        producer: 'x'.repeat(20_000),
      }).success,
    ).toBe(false);
    expect(
      SchemaMigrationQueueEnvelopeSchema.safeParse({ ...event, extra: true })
        .success,
    ).toBe(false);
    expect(
      SchemaMigrationQueueEnvelopeSchema.safeParse({
        ...event,
        payload: {
          ...event.payload,
          activationEvidence: {
            ...event.payload.activationEvidence,
            extra: true,
          },
        },
      }).success,
    ).toBe(false);
    expect(
      SchemaMigrationQueueEnvelopeSchema.safeParse({
        ...event,
        payload: { ...event.payload, extra: true },
      }).success,
    ).toBe(false);

    const payloadFields = [
      ['contentTypeId', 'bad'],
      ['schemaVersionId', 'bad'],
      ['migrationPlanId', 'bad'],
      ['localeConfigHash', 'bad'],
      ['localeConfigHash', 'A'.repeat(64)],
      ['localeConfigHash', null],
      ['activationEvidence', null],
    ] as const;
    for (const [key, value] of payloadFields) {
      expect(
        SchemaMigrationQueueEnvelopeSchema.safeParse({
          ...event,
          payload: { ...event.payload, [key]: value },
        }).success,
      ).toBe(false);
    }
    const evidenceFields = [
      ['key', 'bad token'],
      ['version', '0'],
      ['policyHash', 'bad'],
      ['riskClass', 'unknown'],
      ['requiredDecisionCount', 0],
      ['requiredCapabilities', ['bad token']],
      ['approvalEvidenceHash', 'bad'],
    ] as const;
    for (const [key, value] of evidenceFields) {
      expect(
        SchemaMigrationQueueEnvelopeSchema.safeParse({
          ...event,
          payload: {
            ...event.payload,
            activationEvidence: {
              ...event.payload.activationEvidence,
              [key]: value,
            },
          },
        }).success,
      ).toBe(false);
    }
    expect(
      SchemaMigrationQueueEnvelopeSchema.safeParse({
        ...event,
        payload: {
          ...event.payload,
          activationEvidence: {
            ...event.payload.activationEvidence,
            riskClass: 'protected',
          },
        },
      }).success,
    ).toBe(false);
    expect(
      SchemaMigrationQueueEnvelopeSchema.safeParse({
        ...event,
        causationId: null,
        payload: { ...event.payload, migrationPlanId: PLAN_ID },
      }).success,
    ).toBe(true);
  });

  it('requires localeConfigHash exactly as the DB emits it in cms.schema.activated.v1', () => {
    expect(event.payload.localeConfigHash).toMatch(/^[a-f0-9]{64}$/u);
    const parsed = SchemaMigrationQueueEnvelopeSchema.safeParse(event);
    expect(parsed).toMatchObject({
      success: true,
      data: { payload: { localeConfigHash: event.payload.localeConfigHash } },
    });
    const withoutHash = Object.fromEntries(
      Object.entries(event.payload).filter(
        ([key]) => key !== 'localeConfigHash',
      ),
    );
    expect(
      SchemaMigrationQueueEnvelopeSchema.safeParse({
        ...event,
        payload: withoutHash,
      }).success,
    ).toBe(false);
  });

  it('evaluates activation evidence capability and risk-class branches', () => {
    const ordinary = event.payload.activationEvidence;
    expect(parseSchemaActivationEvidence(ordinary)).toMatchObject({
      success: true,
      data: { riskClass: 'ordinary' },
    });
    expect(
      parseSchemaActivationEvidence({
        ...ordinary,
        requiredCapabilities: ['cms.schema_designer', 'bad token'],
      }).success,
    ).toBe(false);
    expect(
      parseSchemaActivationEvidence({
        ...ordinary,
        riskClass: 'protected',
        requiredDecisionCount: 2,
        requiredCapabilities: ['cms.schema_designer'],
      }),
    ).toMatchObject({ success: true, data: { riskClass: 'protected' } });
  });

  it('rejects malformed plans and batch responses without coercion', () => {
    const plan = basePlan();
    expect(MigrationPlanRecordSchema.safeParse(plan).success).toBe(true);
    expect(MigrationPlanRecordSchema.safeParse(null).success).toBe(false);
    expect(
      MigrationPlanRecordSchema.safeParse({ ...plan, extra: true }).success,
    ).toBe(false);
    const invalidPlans: Array<Record<string, unknown>> = [
      { ...plan, fromVersionId: plan.toVersionId },
      { ...plan, activeVersionId: 'bad' },
      { ...plan, state: 'unknown' },
      { ...plan, version: '0' },
      { ...plan, cursor: '-1' },
      { ...plan, sourceCount: '01' },
      { ...plan, progress: Number.NaN },
      { ...plan, progress: 2 },
      { ...plan, classification: 'unknown' },
      { ...plan, classification: 'additive', transformKey: 'x' },
      { ...plan, transformKey: 'bad token' },
      { ...plan, transformVersion: '0' },
      { ...plan, compilerHash: 'bad' },
      { ...plan, leaseOwner: 'bad token' },
      { ...plan, leaseToken: 'bad token' },
      { ...plan, leaseExpiresAt: 'bad' },
    ];
    for (const invalid of invalidPlans)
      expect(MigrationPlanRecordSchema.safeParse(invalid).success).toBe(false);
    expect(
      MigrationPlanRecordSchema.safeParse({
        ...plan,
        classification: 'additive',
        transformKey: null,
        transformVersion: null,
      }).success,
    ).toBe(true);
    const batch = {
      done: false,
      cursor: '1',
      progress: 0.5,
      sourceCount: '2',
      targetCount: '2',
      rowErrorCount: '0',
      migratedCount: '2',
      failedCount: '0',
    };
    expect(SchemaMigrationBatchResultSchema.safeParse(batch).success).toBe(
      true,
    );
    expect(SchemaMigrationBatchResultSchema.safeParse(null).success).toBe(
      false,
    );
    expect(
      SchemaMigrationBatchResultSchema.safeParse({ ...batch, done: 1 }).success,
    ).toBe(false);
    expect(
      SchemaMigrationBatchResultSchema.safeParse({ ...batch, cursor: '-1' })
        .success,
    ).toBe(false);
    expect(
      SchemaMigrationBatchResultSchema.safeParse({ ...batch, progress: 2 })
        .success,
    ).toBe(false);
    expect(
      SchemaMigrationBatchResultSchema.safeParse({
        ...batch,
        targetCount: '01',
      }).success,
    ).toBe(false);
    expect(
      SchemaMigrationBatchResultSchema.safeParse({ ...batch, extra: true })
        .success,
    ).toBe(false);
  });
});
