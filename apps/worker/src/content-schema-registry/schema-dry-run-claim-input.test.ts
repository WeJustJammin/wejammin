import type { JobEffectInput } from '@wejammin/application';
import { CmsUuidSchema, CmsVersionSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { buildCmsSchemaDryRunClaimRequest } from './schema-dry-run-claim-input';
import { CmsSchemaDryRunClaimRequestSchema } from './schema-dry-run-claim-request';
import {
  addInvisibleOwn,
  CAUSATION_ID,
  inheritRequired,
  JOB_ID,
  LEASE_TOKEN,
  MAX_VERSION,
  OTHER_ID,
  requestFixture,
  REQUEST_LEVELS,
} from './schema-dry-run-claim-request-test-support';

const PRECLAIM_VERSION = '9007199254740993';

// Controlled unit receipts only: no persisted claim, clock or SQL authority.
const fixture = (state: JobEffectInput['job']['state'] = 'queued') =>
  ({
    job: {
      id: JOB_ID,
      type: 'cms.schema.dry_run',
      state,
      version: PRECLAIM_VERSION,
      leaseUntilMs: null,
    },
    envelope: requestFixture(CAUSATION_ID, MAX_VERSION, '7').requestedEvent,
    leaseToken: LEASE_TOKEN,
    claimedLease: {
      jobId: JOB_ID,
      leaseToken: LEASE_TOKEN,
      expectedVersion: PRECLAIM_VERSION,
      version: MAX_VERSION,
      leaseUntilMs: 1_000,
    },
  }) satisfies JobEffectInput;

// Deliberate runtime scalar corruption without pretending a cast validates it.
const replace = (target: object, key: string, value: unknown): void => {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
};
const snapshot = (input: JobEffectInput) =>
  [input, input.job, input.envelope, input.claimedLease].map((value) => {
    if (typeof value !== 'object' || value === null) return value;
    const prototype: unknown = Object.getPrototypeOf(value);
    return {
      descriptors: Object.getOwnPropertyDescriptors(value),
      prototype,
      frozen: Object.isFrozen(value),
      extensible: Object.isExtensible(value),
    };
  });
const reject = (input: JobEffectInput): void => {
  const before = snapshot(input);
  expect(buildCmsSchemaDryRunClaimRequest(input)).toBeNull();
  expect(snapshot(input)).toStrictEqual(before);
};
const expected = (input: ReturnType<typeof fixture>) => ({
  claimedJob: {
    jobId: input.claimedLease.jobId,
    version: input.claimedLease.version,
    leaseToken: input.claimedLease.leaseToken,
  },
  requestedEvent: input.envelope,
});
const accept = (input: ReturnType<typeof fixture>): void => {
  const before = snapshot(input);
  const complete = expected(input);
  expect(CmsSchemaDryRunClaimRequestSchema.safeParse(complete).success).toBe(
    true,
  );
  const output = buildCmsSchemaDryRunClaimRequest(input);
  expect(output).toStrictEqual(complete);
  if (output === null) throw new Error('Controlled valid claim input rejected');
  for (const { level, keys } of REQUEST_LEVELS) {
    const object = level === 'outer' ? output : output[level];
    expect(Object.isFrozen(object)).toBe(true);
    expect(Reflect.ownKeys(object).sort()).toStrictEqual([...keys].sort());
    expect(keys.every((key) => Object.hasOwn(object, key))).toBe(true);
  }
  expect(output.requestedEvent).not.toBe(input.envelope);
  expect(snapshot(input)).toStrictEqual(before);
};

const INVALID_VERSIONS = [
  { label: 'numeric scalar', value: 7 },
  { label: 'null', value: null },
  { label: 'undefined', value: undefined },
  { label: 'boolean', value: true },
  { label: 'array', value: [] },
  { label: 'object', value: {} },
  { label: 'empty string', value: '' },
  { label: 'zero', value: '0' },
  { label: 'leading zero', value: '07' },
  { label: 'plus sign', value: '+7' },
  { label: 'negative', value: '-7' },
  { label: 'fraction', value: '7.5' },
  { label: 'exponent', value: '7e2' },
  { label: 'leading whitespace', value: ' 7' },
  { label: 'trailing whitespace', value: '7 ' },
  { label: 'signed bigint overflow', value: '9223372036854775808' },
  { label: 'twenty digits', value: '10000000000000000000' },
] as const;
const VERSION_CASES = (['acquired', 'matching preclaim'] as const).flatMap(
  (location) => INVALID_VERSIONS.map((entry) => ({ location, ...entry })),
);

describe('controlled claimed dry-run input binding', () => {
  it('preserves a nonadjacent full nineteen-digit receipt and separate original and preclaim versions', () => {
    const input = fixture();
    expect(input.claimedLease.version).toBe('9223372036854775807');
    expect(input.job.version).toBe('9007199254740993');
    expect(input.envelope.aggregateVersion).toBe('7');
    expect(input.claimedLease.version).not.toBe(
      (BigInt(input.job.version) + 1n).toString(),
    );
    accept(input);
  });

  it.each(['running', 'queued'] as const)(
    'preserves the old original event for a controlled %s continuation without state narrowing',
    (state) => accept(fixture(state)),
  );

  it('preserves explicit null causation in the unchanged original event', () => {
    const input = fixture();
    replace(input.envelope, 'causationId', null);
    accept(input);
  });

  it('accepts fully frozen caller objects without rewriting or thawing them', () => {
    const input = fixture();
    for (const object of [input.job, input.envelope, input.claimedLease, input])
      Object.freeze(object);
    accept(input);
  });

  it('does not invent closedness for extra private input or receipt metadata', () => {
    const input = fixture();
    replace(input, 'internalTrace', 'controlled');
    replace(input.job, 'internalTrace', 'controlled');
    replace(input.claimedLease, 'internalTrace', 'controlled');
    accept(input);
  });

  it.each([
    '00000000-0000-0000-0000-000000000000',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '01926e18-7f00-7abc-8def-123456789abc',
  ])(
    'preserves valid UUID-domain lease token %s without lease authority claims',
    (token) => {
      const input = fixture();
      expect(CmsUuidSchema.safeParse(token).success).toBe(true);
      input.leaseToken = token;
      input.claimedLease.leaseToken = token;
      accept(input);
    },
  );

  it.each([0, 0.5, Number.MAX_VALUE])(
    'accepts finite nonnegative receipt leaseUntilMs %s without checking the current clock',
    (value) => {
      const input = fixture();
      input.claimedLease.leaseUntilMs = value;
      accept(input);
    },
  );

  it('rejects a missing receipt instead of fabricating an acquired version', () => {
    const input = fixture();
    Reflect.deleteProperty(input, 'claimedLease');
    reject(input);
  });

  it.each([null, undefined, 'receipt', 1, true, []])(
    'rejects malformed receipt container %j',
    (value) => {
      const input = fixture();
      replace(input, 'claimedLease', value);
      reject(input);
    },
  );

  it.each([
    'jobId',
    'leaseToken',
    'expectedVersion',
    'version',
    'leaseUntilMs',
  ])('rejects a receipt missing %s', (key) => {
    const input = fixture();
    Reflect.deleteProperty(input.claimedLease, key);
    reject(input);
  });

  it.each([
    'canonical job',
    'receipt job',
    'event aggregate',
    'outer token',
    'expected preclaim',
  ])('rejects mismatched %s subject binding', (location) => {
    const input = fixture();
    if (location === 'canonical job') input.job.id = OTHER_ID;
    if (location === 'receipt job') input.claimedLease.jobId = OTHER_ID;
    if (location === 'event aggregate')
      replace(input.envelope, 'aggregateId', OTHER_ID);
    if (location === 'outer token') input.leaseToken = OTHER_ID;
    if (location === 'expected preclaim')
      input.claimedLease.expectedVersion = '9';
    expect(CmsUuidSchema.safeParse(OTHER_ID).success).toBe(true);
    expect(CmsVersionSchema.safeParse('9').success).toBe(true);
    expect(
      CmsSchemaDryRunClaimRequestSchema.safeParse(expected(input)).success,
    ).toBe(location !== 'receipt job' && location !== 'event aggregate');
    reject(input);
  });

  it.each([
    'object.verify',
    'platform.object.verify',
    'cms.schema.activate',
    'CMS.schema.dry_run',
    'cms.schema.dry_run ',
  ])('rejects nonexact job type %s', (type) => {
    const input = fixture();
    input.job.type = type;
    expect(
      CmsSchemaDryRunClaimRequestSchema.safeParse(expected(input)).success,
    ).toBe(true);
    reject(input);
  });

  it.each(VERSION_CASES)(
    'rejects $label in $location versions without coercion',
    ({ location, value }) => {
      const input = fixture();
      expect(CmsVersionSchema.safeParse(value).success).toBe(false);
      if (location === 'acquired')
        replace(input.claimedLease, 'version', value);
      else {
        replace(input.job, 'version', value);
        replace(input.claimedLease, 'expectedVersion', value);
      }
      expect(
        CmsSchemaDryRunClaimRequestSchema.safeParse(expected(input)).success,
      ).toBe(location === 'matching preclaim');
      reject(input);
    },
  );

  it.each([null, undefined, '', 'opaque_lease', 1, true, {}, []])(
    'rejects matching malformed outer and receipt token %j',
    (value) => {
      const input = fixture();
      expect(CmsUuidSchema.safeParse(value).success).toBe(false);
      replace(input, 'leaseToken', value);
      replace(input.claimedLease, 'leaseToken', value);
      reject(input);
    },
  );

  it.each([
    { label: 'negative', value: -1 },
    { label: 'NaN', value: NaN },
    { label: 'positive infinity', value: Infinity },
    { label: 'negative infinity', value: -Infinity },
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'numeric string', value: '1000' },
    { label: 'boolean', value: true },
    { label: 'object', value: {} },
    { label: 'array', value: [] },
  ])('rejects malformed receipt leaseUntilMs $label', ({ value }) => {
    const input = fixture();
    replace(input.claimedLease, 'leaseUntilMs', value);
    expect(
      CmsSchemaDryRunClaimRequestSchema.safeParse(expected(input)).success,
    ).toBe(true);
    reject(input);
  });

  it.each([
    { key: 'eventType', value: 'object.uploaded' },
    { key: 'schemaVersion', value: '1' },
    { key: 'aggregateType', value: 'object' },
    { key: 'eventId', value: 'not-a-uuid' },
    { key: 'correlationId', value: null },
    { key: 'causationId', value: 'not-a-uuid' },
    { key: 'aggregateVersion', value: '9223372036854775808' },
    { key: 'aggregateVersion', value: '1e3' },
  ])(
    'rejects original envelope grammar at $key=$value without repair',
    ({ key, value }) => {
      const input = fixture();
      replace(input.envelope, key, value);
      expect(
        CmsSchemaDryRunClaimRequestSchema.safeParse(expected(input)).success,
      ).toBe(false);
      reject(input);
    },
  );

  it.each([
    'extra',
    'missing',
    'inherited',
    'symbol',
    'non-enumerable',
    'inherited with symbol replacement',
  ] as const)(
    'rejects original envelope own shape %s instead of projecting it away',
    (kind) => {
      const input = fixture();
      const envelope: Record<string, unknown> = { ...input.envelope };
      if (kind === 'extra') envelope.extra = true;
      if (kind === 'missing') delete envelope.eventId;
      if (kind === 'inherited' || kind === 'inherited with symbol replacement')
        inheritRequired(envelope, 'eventId');
      if (kind === 'symbol' || kind === 'non-enumerable')
        addInvisibleOwn(envelope, kind);
      if (kind === 'inherited with symbol replacement') {
        addInvisibleOwn(envelope, 'symbol');
        expect(Reflect.ownKeys(envelope)).toHaveLength(8);
        expect(Object.hasOwn(envelope, 'eventId')).toBe(false);
      }
      replace(input, 'envelope', envelope);
      expect(
        CmsSchemaDryRunClaimRequestSchema.safeParse(expected(input)).success,
      ).toBe(false);
      reject(input);
    },
  );
});
