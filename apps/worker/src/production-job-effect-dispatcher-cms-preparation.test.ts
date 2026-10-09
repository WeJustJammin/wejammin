import { describe, expect, it, vi } from 'vitest';

import type { JobEffectInput, JobEffectResult } from '@wejammin/application';
import {
  JobStatusSchema,
  PositiveBigintDecimalSchema,
  QueueEnvelopeSchema,
} from '@wejammin/contracts';

import {
  createProductionJobEffectDispatcher,
  type ProductionVerificationDependencies,
} from './production-job-effect-dispatcher';

const CMS_TYPE = 'cms.schema.dry_run';
const JOB_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333';
const LEASE_TOKEN = '44444444-4444-4444-8444-444444444444';
const RESULT_ID = '55555555-5555-4555-8555-555555555555';
const approvedTypes = [CMS_TYPE, 'object.verify', 'platform.object.verify'];
type Effect = (input: JobEffectInput) => Promise<JobEffectResult>;
type PreparationDependencies = ProductionVerificationDependencies &
  Readonly<{ prepareSchemaDryRun: Effect }>;

// Canonical job fields are projected from the strict public job contract.
// Version remains the pre-claim version; this boundary does not resolve plans,
// acquire leases, enroll providers or prove persisted preparation/SQL authority.
const inputFor = (type: string): JobEffectInput => {
  const status = JobStatusSchema.parse({
    id: JOB_ID,
    type,
    state: 'queued',
    progress: null,
    resultRef: null,
    error: null,
    createdAt: '2026-10-09T12:00:00.000Z',
    updatedAt: '2026-10-09T12:00:00.000Z',
  });
  const version = PositiveBigintDecimalSchema.parse('1');
  return {
    job: {
      id: status.id,
      type: status.type,
      state: status.state,
      version,
      leaseUntilMs: null,
    },
    envelope: QueueEnvelopeSchema.parse({
      aggregateId: JOB_ID,
      aggregateType: 'job',
      aggregateVersion: version,
      causationId: null,
      correlationId: CORRELATION_ID,
      eventId: EVENT_ID,
      eventType: 'job.requested',
      schemaVersion: 1,
    }),
    leaseToken: LEASE_TOKEN,
  };
};
const prepared: JobEffectResult = {
  state: 'succeeded',
  errorCode: null,
  resultRef: { id: RESULT_ID, type: 'cms_schema_migration' },
};
const verified: JobEffectResult = {
  state: 'succeeded',
  errorCode: null,
  resultRef: { id: RESULT_ID, type: 'object' },
};
const unavailable: JobEffectResult = {
  state: 'pending_manual_review',
  errorCode: 'DEPENDENCY_UNAVAILABLE',
  resultRef: null,
};
const fixture = () => {
  const verifyObject = vi.fn<Effect>(async () => verified);
  const prepareSchemaDryRun = vi.fn<Effect>(async () => prepared);
  // Variable assignment keeps the real dispatcher callable before the private
  // dependency is added to its producer type; no new wire property or cast.
  const dependencies: PreparationDependencies = {
    verifyObject,
    prepareSchemaDryRun,
  };
  return {
    dependencies,
    verifyObject,
    prepareSchemaDryRun,
    dispatch: createProductionJobEffectDispatcher(dependencies),
  };
};
const malformedResults: Array<{ label: string; value: unknown }> = [
  { label: 'null outcome', value: null },
  { label: 'running state', value: { ...prepared, state: 'running' } },
  { label: 'unsafe error code', value: { ...prepared, errorCode: 'bad-code' } },
  { label: 'missing reference', value: { ...prepared, resultRef: undefined } },
  { label: 'array reference', value: { ...prepared, resultRef: [] } },
  {
    label: 'extra reference key',
    value: {
      ...prepared,
      resultRef: { id: RESULT_ID, type: 'object', extra: true },
    },
  },
  {
    label: 'empty reference id',
    value: { ...prepared, resultRef: { id: '', type: 'object' } },
  },
  {
    label: 'oversized reference id',
    value: { ...prepared, resultRef: { id: 'a'.repeat(129), type: 'object' } },
  },
  {
    label: 'unsafe reference type',
    value: { ...prepared, resultRef: { id: RESULT_ID, type: 'Object' } },
  },
];

describe('production exact CMS preparation job family dispatch', () => {
  it.each(approvedTypes)(
    '%s delegates the original input only to its exact family effect',
    async (type) => {
      const f = fixture();
      const input = inputFor(type);
      const selected =
        type === CMS_TYPE ? f.prepareSchemaDryRun : f.verifyObject;
      const other = type === CMS_TYPE ? f.verifyObject : f.prepareSchemaDryRun;

      const result = await f.dispatch(input);

      expect(result).toBe(type === CMS_TYPE ? prepared : verified);
      expect(selected.mock.calls).toEqual([[input]]);
      expect(selected.mock.contexts).toEqual([f.dependencies]);
      expect(selected.mock.calls[0]?.[0]).toBe(input);
      expect(other.mock.calls).toEqual([]);
      expect(input.job.version).toBe('1');
      expect(input.envelope.aggregateVersion).toBe('1');
    },
  );

  it.each([
    { state: 'queued', resultRef: null, errorCode: null },
    { state: 'succeeded', resultRef: null, errorCode: null },
    { state: 'failed', resultRef: null, errorCode: 'PREPARATION_FAILED' },
    { state: 'cancelled', resultRef: null, errorCode: null },
    {
      state: 'pending_manual_review',
      resultRef: null,
      errorCode: 'REVIEW_REQUIRED',
    },
  ] satisfies JobEffectResult[])(
    'CMS preserves the validated $state result without claiming extra success',
    async (expected) => {
      const f = fixture();
      const input = inputFor(CMS_TYPE);
      f.prepareSchemaDryRun.mockResolvedValue(expected);

      expect(await f.dispatch(input)).toBe(expected);
      expect(f.prepareSchemaDryRun.mock.calls).toEqual([[input]]);
      expect(f.prepareSchemaDryRun.mock.calls[0]?.[0]).toBe(input);
      expect(f.verifyObject.mock.calls).toEqual([]);
    },
  );

  it.each([
    'unknown.job',
    'provider.send',
    'provider.operation.requested',
    'cms.schema.activate',
    'cms.schema.dry-run',
    'cms.schema.dryrun',
    'cms.schema.dry_runx',
    'cms.schema.dry_run.v1',
    'platform.cms.schema.dry_run',
    'cms.schema.dry_run.extra',
  ])('%s remains unsupported without invoking either effect', async (type) => {
    const f = fixture();

    expect(await f.dispatch(inputFor(type))).toEqual({
      state: 'pending_manual_review',
      errorCode: 'UNSUPPORTED_JOB_TYPE',
      resultRef: null,
    });
    expect(f.prepareSchemaDryRun.mock.calls).toEqual([]);
    expect(f.verifyObject.mock.calls).toEqual([]);
  });

  it.each(approvedTypes)(
    '%s reports an absent dependency container as unavailable',
    async (type) => {
      const dispatch = createProductionJobEffectDispatcher();
      expect(await dispatch(inputFor(type))).toEqual(unavailable);
    },
  );

  it('CMS with only object verification configured is unavailable without invoking it', async () => {
    const verifyObject = vi.fn<Effect>(async () => verified);
    const dispatch = createProductionJobEffectDispatcher({ verifyObject });

    expect(await dispatch(inputFor(CMS_TYPE))).toEqual(unavailable);
    expect(verifyObject.mock.calls).toEqual([]);
  });

  it.each([
    { label: 'undefined', value: undefined },
    { label: 'null', value: null },
    { label: 'object', value: {} },
  ])(
    'CMS rejects a non-callable $label preparation dependency',
    async ({ value }) => {
      const f = fixture();
      Object.defineProperty(f.dependencies, 'prepareSchemaDryRun', { value });

      expect(await f.dispatch(inputFor(CMS_TYPE))).toEqual(unavailable);
      expect(f.verifyObject.mock.calls).toEqual([]);
      expect(f.prepareSchemaDryRun.mock.calls).toEqual([]);
    },
  );

  it.each(approvedTypes)(
    '%s retains fail-closed thrown-dependency handling',
    async (type) => {
      const f = fixture();
      const input = inputFor(type);
      const selected =
        type === CMS_TYPE ? f.prepareSchemaDryRun : f.verifyObject;
      const other = type === CMS_TYPE ? f.verifyObject : f.prepareSchemaDryRun;
      selected.mockRejectedValue(new Error('controlled dependency failure'));

      expect(await f.dispatch(input)).toEqual(unavailable);
      expect(selected.mock.calls).toEqual([[input]]);
      expect(selected.mock.calls[0]?.[0]).toBe(input);
      expect(other.mock.calls).toEqual([]);
    },
  );

  it.each(
    approvedTypes.flatMap((type) =>
      malformedResults.map(({ label, value }) => ({ type, label, value })),
    ),
  )(
    '$type rejects $label through the existing result validation boundary',
    async ({ type, value }) => {
      const f = fixture();
      const input = inputFor(type);
      const malformed = vi.fn<(input: JobEffectInput) => Promise<unknown>>(
        async () => value,
      );
      // Deliberately violate only the dependency's runtime result contract.
      Object.defineProperty(
        f.dependencies,
        type === CMS_TYPE ? 'prepareSchemaDryRun' : 'verifyObject',
        { value: malformed },
      );

      expect(await f.dispatch(input)).toEqual(unavailable);
      expect(malformed.mock.calls).toEqual([[input]]);
      expect(malformed.mock.calls[0]?.[0]).toBe(input);
      expect(f.prepareSchemaDryRun.mock.calls).toEqual([]);
      expect(f.verifyObject.mock.calls).toEqual([]);
    },
  );
});
