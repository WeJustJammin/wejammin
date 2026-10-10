import { describe, expect, it } from 'vitest';

import {
  CmsSchemaDryRunClaimRequestSchema,
  type CmsSchemaDryRunClaimRequest,
} from './schema-dry-run-claim-request';
import {
  addInvisibleOwn,
  CAUSATION_ID,
  CORRELATION_ID,
  EVENT_ID,
  expectRejected,
  HIGH_VERSION,
  inheritRequired,
  JOB_ID,
  LEASE_TOKEN,
  MAX_VERSION,
  OTHER_ID,
  requestAtLevel,
  requestFixture,
  REQUEST_LEVELS,
  snapshotRequest,
} from './schema-dry-run-claim-request-test-support';

const POSITIVE_CASES = [
  {
    label: 'null causation and high claim',
    cause: null,
    claim: HIGH_VERSION,
    event: '7',
  },
  {
    label: 'UUID causation and maximum claim',
    cause: CAUSATION_ID,
    claim: MAX_VERSION,
    event: '3',
  },
  {
    label: 'two lossless non-adjacent high versions',
    cause: null,
    claim: MAX_VERSION,
    event: HIGH_VERSION,
  },
  {
    label: 'ordinary adjacent versions without arithmetic',
    cause: CAUSATION_ID,
    claim: '8',
    event: '7',
  },
] as const;
const MISSING_KEYS = REQUEST_LEVELS.flatMap(({ level, keys }) =>
  keys.map((key) => ({ level, key })),
);
const FORBIDDEN_KEYS = [
  'extra',
  'migrationPlanId',
  'schemaVersionId',
  'expectedVersion',
  'job_id',
  'lease_token',
  'leaseUntilMs',
  'now',
  'executionPurpose',
  'dryRunId',
  'reportId',
  'planId',
] as const;
const EXTRA_KEYS = REQUEST_LEVELS.flatMap(({ level }) =>
  FORBIDDEN_KEYS.map((key) => ({ level, key })),
);
const WRONG_OBJECTS = [
  { label: 'null', value: null },
  { label: 'undefined', value: undefined },
  { label: 'array', value: [] },
  { label: 'string', value: 'claim' },
  { label: 'number', value: 1 },
  { label: 'boolean', value: true },
] as const;
const OBJECT_CASES = REQUEST_LEVELS.flatMap(({ level }) =>
  WRONG_OBJECTS.map(({ label, value }) => ({ level, label, value })),
);
const UUID_FIELDS = [
  { level: 'claimedJob', key: 'jobId' },
  { level: 'claimedJob', key: 'leaseToken' },
  { level: 'requestedEvent', key: 'eventId' },
  { level: 'requestedEvent', key: 'aggregateId' },
  { level: 'requestedEvent', key: 'correlationId' },
  { level: 'requestedEvent', key: 'causationId' },
] as const;
const INVALID_UUIDS = [
  { label: 'undefined', value: undefined },
  { label: 'number', value: 1 },
  { label: 'boolean', value: false },
  { label: 'object', value: {} },
  { label: 'array', value: [] },
  { label: 'empty string', value: '' },
  { label: 'opaque token', value: 'Lease_1.part:resume-1' },
  {
    label: 'invalid UUID variant',
    value: '12345678-1234-4abc-7def-123456789abc',
  },
] as const;
const UUID_CASES = UUID_FIELDS.flatMap(({ level, key }) =>
  INVALID_UUIDS.map(({ label, value }) => ({ level, key, label, value })),
);
const VERSION_FIELDS = [
  { level: 'claimedJob', key: 'version' },
  { level: 'requestedEvent', key: 'aggregateVersion' },
] as const;
const INVALID_VERSIONS = [
  { label: 'numeric scalar', value: 7 },
  { label: 'zero', value: '0' },
  { label: 'leading zero', value: '07' },
  { label: 'negative', value: '-1' },
  { label: 'fraction', value: '1.5' },
  { label: 'scientific notation', value: '1e3' },
  { label: 'leading whitespace', value: ' 7' },
  { label: 'trailing whitespace', value: '7 ' },
  { label: 'above bigint maximum', value: '9223372036854775808' },
  { label: 'twenty digits', value: '99999999999999999999' },
  { label: 'undefined', value: undefined },
  { label: 'null', value: null },
  { label: 'boolean', value: true },
  { label: 'array', value: [] },
  { label: 'object', value: {} },
] as const;
const VERSION_CASES = VERSION_FIELDS.flatMap(({ level, key }) =>
  INVALID_VERSIONS.map(({ label, value }) => ({ level, key, label, value })),
);
const INVISIBLE_CASES = REQUEST_LEVELS.flatMap(({ level, keys }) =>
  (['symbol', 'non-enumerable'] as const).map((kind) => ({
    level,
    keys,
    kind,
  })),
);

describe('private claimed dry-run request contract', () => {
  it('preserves a valid UUIDv7 claim lease token and the complete typed request', () => {
    const fixture = requestFixture();
    const leaseToken = '01926e18-7f00-7abc-8def-123456789abc';
    const input = {
      ...fixture,
      claimedJob: { ...fixture.claimedJob, leaseToken },
    };
    const before = snapshotRequest(input);
    const parsed = CmsSchemaDryRunClaimRequestSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (!parsed.success)
      throw new Error('Valid UUIDv7 claim lease token was rejected');
    const output: CmsSchemaDryRunClaimRequest = parsed.data;
    expect(output).toStrictEqual(input);
    expect(output.claimedJob.leaseToken).toBe(leaseToken);
    expect(snapshotRequest(input)).toStrictEqual(before);
  });

  it.each(POSITIVE_CASES)(
    'preserves exact typed request with $label',
    ({ cause, claim, event }) => {
      const input = requestFixture(cause, claim, event);
      const before = snapshotRequest(input);
      const parsed = CmsSchemaDryRunClaimRequestSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (!parsed.success)
        throw new Error('Valid controlled request was rejected');
      const output: CmsSchemaDryRunClaimRequest = parsed.data;
      expect(output).toStrictEqual({
        claimedJob: { jobId: JOB_ID, version: claim, leaseToken: LEASE_TOKEN },
        requestedEvent: {
          eventId: EVENT_ID,
          eventType: 'job.requested',
          schemaVersion: 1,
          aggregateType: 'job',
          aggregateId: JOB_ID,
          aggregateVersion: event,
          correlationId: CORRELATION_ID,
          causationId: cause,
        },
      });
      for (const { level, keys } of REQUEST_LEVELS) {
        const object = level === 'outer' ? output : output[level];
        expect(Reflect.ownKeys(object).sort()).toStrictEqual([...keys].sort());
        expect(keys.every((key) => Object.hasOwn(object, key))).toBe(true);
      }
      expect(output.claimedJob.version).not.toBe(
        output.requestedEvent.aggregateVersion,
      );
      expect(snapshotRequest(input)).toStrictEqual(before);
    },
  );

  it.each(MISSING_KEYS)('rejects missing own $level.$key', ({ level, key }) => {
    const { input } = requestAtLevel(level, (target) => {
      delete target[key];
    });
    expectRejected(input);
  });

  it.each(EXTRA_KEYS)(
    'rejects extra or caller-selected $level.$key',
    ({ level, key }) => {
      const { input } = requestAtLevel(level, (target) => {
        target[key] = OTHER_ID;
      });
      expectRejected(input);
    },
  );

  it('rejects a mixed legacy plan/schema/expectedVersion request', () => {
    expectRejected({
      ...requestFixture(),
      migrationPlanId: OTHER_ID,
      schemaVersionId: OTHER_ID,
      expectedVersion: '7',
    });
  });

  it.each(OBJECT_CASES)(
    'rejects $label object shape at $level',
    ({ level, value }) => {
      const input =
        level === 'outer' ? value : { ...requestFixture(), [level]: value };
      expectRejected(input);
    },
  );

  it.each(UUID_CASES)(
    'rejects $label at UUID $level.$key without coercion',
    ({ level, key, value }) => {
      const { input } = requestAtLevel(level, (target) => {
        target[key] = value;
      });
      expectRejected(input);
    },
  );

  it.each(UUID_FIELDS.filter(({ key }) => key !== 'causationId'))(
    'rejects null at required UUID $level.$key',
    ({ level, key }) => {
      const { input } = requestAtLevel(level, (target) => {
        target[key] = null;
      });
      expectRejected(input);
    },
  );

  it.each(VERSION_CASES)(
    'rejects $label at decimal $level.$key without coercion',
    ({ level, key, value }) => {
      const { input } = requestAtLevel(level, (target) => {
        target[key] = value;
      });
      expectRejected(input);
    },
  );

  it.each([
    { key: 'eventType', value: 'object.uploaded' },
    { key: 'schemaVersion', value: 2 },
    { key: 'schemaVersion', value: '1' },
    { key: 'aggregateType', value: 'object' },
  ])('rejects event narrowing mismatch $key=$value', ({ key, value }) => {
    const { input } = requestAtLevel('requestedEvent', (target) => {
      target[key] = value;
    });
    expectRejected(input);
  });

  it('rejects an otherwise-valid foreign event aggregate identity', () => {
    const { input } = requestAtLevel('requestedEvent', (target) => {
      target.aggregateId = OTHER_ID;
    });
    expectRejected(input);
  });

  it.each(REQUEST_LEVELS)(
    'rejects inherited required value at $level',
    ({ level, keys }) => {
      const { input, target } = requestAtLevel(level, (object) => {
        inheritRequired(object, keys[0]);
      });
      expect(Reflect.ownKeys(target)).toHaveLength(keys.length - 1);
      expectRejected(input);
    },
  );

  it.each(INVISIBLE_CASES)(
    'rejects $kind own extra at $level despite unchanged enumerable keys',
    ({ level, keys, kind }) => {
      const { input, target } = requestAtLevel(level, (object) => {
        addInvisibleOwn(object, kind);
      });
      expect(Reflect.ownKeys(target)).toHaveLength(keys.length + 1);
      expect(Object.keys(target).sort()).toStrictEqual([...keys].sort());
      expect(keys.every((key) => Object.hasOwn(target, key))).toBe(true);
      expectRejected(input);
    },
  );

  it.each(INVISIBLE_CASES)(
    'rejects inherited required value plus $kind replacement at $level with exact own count',
    ({ level, keys, kind }) => {
      const { input, target } = requestAtLevel(level, (object) => {
        inheritRequired(object, keys[0]);
        addInvisibleOwn(object, kind);
      });
      expect(Reflect.ownKeys(target)).toHaveLength(keys.length);
      expect(Object.hasOwn(target, keys[0])).toBe(false);
      expect(target[keys[0]]).toStrictEqual(
        level === 'outer'
          ? requestFixture().claimedJob
          : level === 'claimedJob'
            ? JOB_ID
            : EVENT_ID,
      );
      expectRejected(input);
    },
  );
});
