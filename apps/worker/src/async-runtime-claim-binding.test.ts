import { describe, expect, it, vi } from 'vitest';

import {
  executeJobDispatch,
  type JobEffectPort,
  type JobLeaseClaimRequest,
} from '@wejammin/application';
import { QueueEnvelopeSchema } from '@wejammin/contracts';

import type { AsyncWorkerBindings } from './async-entrypoint';
import {
  createJobPersistence,
  createSupabaseRpc,
  parseLease,
} from './async-runtime-support';

const JOB_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FOREIGN_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TOKEN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const FOREIGN_TOKEN = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const REQUESTED = '9007199254740993';
const CLAIMED = '9007199254740994';
const EXPIRY = '2026-10-09T12:05:00.000Z';
const request = (): JobLeaseClaimRequest => ({
  jobId: JOB_ID,
  leaseToken: TOKEN,
  expectedVersion: REQUESTED,
  leaseSeconds: 300,
  nowMs: Date.parse('2026-10-09T12:00:00.000Z'),
});
const camel = {
  jobId: JOB_ID,
  leaseToken: TOKEN,
  expectedVersion: REQUESTED,
  version: CLAIMED,
  leaseUntilMs: Date.parse(EXPIRY),
};
const snake = {
  job_id: JOB_ID,
  lease_token: TOKEN,
  expected_version: REQUESTED,
  version: CLAIMED,
  lease_until: EXPIRY,
};
const both = { ...camel, ...snake };
// Actual SQL response shape: token/requested version are deliberately absent.
const sqlRow = {
  job_id: JOB_ID,
  version: CLAIMED,
  state: 'running',
  lease_until: EXPIRY,
  attempt_count: 1,
};
const claimBody = {
  p_job_id: JOB_ID,
  p_expected_version: REQUESTED,
  p_lease_token: TOKEN,
  p_lease_seconds: 300,
};
const env: AsyncWorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'claim-binding-test',
  PLATFORM_JOBS: {
    send: vi.fn(async () => ({
      metadata: { metrics: { backlogBytes: 0, backlogCount: 0 } },
    })),
  },
  SUPABASE_URL: 'https://claim-binding.invalid',
  SUPABASE_SECRET_KEY: 'sb_secret_controlled_test',
};
const rpcCall = (operation: string, body: Record<string, unknown>) => [
  `${env.SUPABASE_URL}/rest/v1/rpc/${operation}`,
  {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Profile': 'platform_api',
      apikey: env.SUPABASE_SECRET_KEY,
      'Content-Profile': 'platform_api',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: expect.any(AbortSignal),
  },
];

// Only the HTTP dependency is controlled; transport, parsing and persistence run.
const fixture = (claim: unknown, type = 'cms.schema.dry_run') => {
  const fetcher = vi.fn<typeof fetch>(async (url) => {
    if (typeof url !== 'string') throw new Error('Unexpected RPC URL');
    const operation = new URL(url).pathname.split('/').at(-1);
    if (operation === 'claim_job') return Response.json(claim);
    if (operation === 'read_canonical_job') {
      return Response.json({
        id: JOB_ID,
        type,
        state: 'queued',
        version: REQUESTED,
        lease_until: null,
      });
    }
    if (operation === 'read_restore_fence') {
      return Response.json({
        expected_epoch: '1',
        consumer_epoch: '1',
        integrity_verified: true,
        reconciliation_complete: true,
      });
    }
    if (operation === 'apply_job_outcome') return Response.json(true);
    if (operation === 'record_processed_event')
      return Response.json('recorded');
    throw new Error(`Unexpected RPC: ${operation}`);
  });
  const persistence = createJobPersistence(env, createSupabaseRpc(fetcher));
  return { fetcher, persistence };
};

const foreignRows = [
  { label: 'camel jobId', row: { ...camel, jobId: FOREIGN_ID } },
  { label: 'snake job_id', row: { ...snake, job_id: FOREIGN_ID } },
  { label: 'camel leaseToken', row: { ...camel, leaseToken: FOREIGN_TOKEN } },
  { label: 'snake lease_token', row: { ...snake, lease_token: FOREIGN_TOKEN } },
  {
    label: 'camel expectedVersion',
    row: { ...camel, expectedVersion: CLAIMED },
  },
  {
    label: 'snake expected_version',
    row: { ...snake, expected_version: CLAIMED },
  },
  { label: 'hidden conflicting job_id', row: { ...both, job_id: FOREIGN_ID } },
  {
    label: 'hidden conflicting lease_token',
    row: { ...both, lease_token: FOREIGN_TOKEN },
  },
  {
    label: 'hidden conflicting expected_version',
    row: { ...both, expected_version: CLAIMED },
  },
];
const aliases = [
  { field: 'jobId', row: camel },
  { field: 'job_id', row: snake },
  { field: 'leaseToken', row: camel },
  { field: 'lease_token', row: snake },
  { field: 'expectedVersion', row: camel },
  { field: 'expected_version', row: snake },
];

describe('claim response binding at the protected persistence adapter', () => {
  describe.each([
    { shape: 'row', wrap: (row: unknown) => row },
    { shape: 'singleton array', wrap: (row: unknown) => [row] },
  ])('$shape', ({ wrap }) => {
    it.each([
      {
        label: 'SQL omissions use submitted token and requested version',
        row: sqlRow,
      },
      { label: 'explicit camel aliases', row: camel },
      { label: 'explicit snake aliases', row: snake },
      { label: 'equal dual aliases', row: both },
    ])('preserves lossless receipt: $label', async ({ row }) => {
      const input = request();
      const before = { ...input };
      const value = wrap(row);
      const f = fixture(value);
      expect(parseLease(value, input)).toEqual(camel);
      await expect(f.persistence.claimJobLease(input)).resolves.toEqual(camel);
      expect(input).toEqual(before);
      expect(f.fetcher.mock.calls).toEqual([rpcCall('claim_job', claimBody)]);
    });
  });

  it.each(foreignRows)(
    'rejects valid-shape foreign binding: $label',
    async ({ row }) => {
      const input = request();
      const before = { ...input };
      const f = fixture(row);
      await expect(f.persistence.claimJobLease(input)).rejects.toThrow(
        'Invalid job lease',
      );
      expect(() => parseLease(row, input)).toThrow('Invalid job lease');
      expect(input).toEqual(before);
      expect(f.fetcher.mock.calls).toEqual([rpcCall('claim_job', claimBody)]);
    },
  );

  describe.each(aliases)('$field', ({ field, row }) => {
    it.each([null, 'malformed'])(
      'rejects explicit invalid alias %s instead of omission fallback',
      async (invalid) => {
        const value = { ...row, [field]: invalid };
        const input = request();
        const before = { ...input };
        const f = fixture(value);
        await expect(f.persistence.claimJobLease(input)).rejects.toThrow(
          'Invalid job lease',
        );
        expect(() => parseLease(value, input)).toThrow('Invalid job lease');
        expect(input).toEqual(before);
        expect(f.fetcher.mock.calls).toEqual([rpcCall('claim_job', claimBody)]);
      },
    );

    it('rejects explicit null even when the other alias is valid', async () => {
      const value = { ...both, [field]: null };
      const input = request();
      const before = { ...input };
      const f = fixture(value);
      await expect(f.persistence.claimJobLease(input)).rejects.toThrow(
        'Invalid job lease',
      );
      expect(() => parseLease(value, input)).toThrow('Invalid job lease');
      expect(input).toEqual(before);
      expect(f.fetcher.mock.calls).toEqual([rpcCall('claim_job', claimBody)]);
    });
  });

  it.each([
    {
      label: 'overflow claimed version',
      row: { ...camel, version: '9223372036854775808' },
    },
    {
      label: 'unsafe numeric claimed version',
      row: { ...camel, version: 9007199254740992 },
    },
    { label: 'null expiry', row: { ...camel, leaseUntilMs: null } },
    { label: 'malformed expiry', row: { ...camel, leaseUntilMs: 'invalid' } },
  ])('preserves malformed response refusal: $label', async ({ row }) => {
    const input = request();
    const f = fixture(row);
    await expect(f.persistence.claimJobLease(input)).rejects.toThrow(
      'Invalid job lease',
    );
    expect(() => parseLease(row, input)).toThrow('Invalid job lease');
    expect(input).toEqual(request());
    expect(f.fetcher.mock.calls).toEqual([rpcCall('claim_job', claimBody)]);
  });

  it.each([
    { label: 'null', value: null },
    { label: 'empty array', value: [] },
  ])('preserves unavailable claim $label', async ({ value }) => {
    const input = request();
    const f = fixture(value);
    await expect(f.persistence.claimJobLease(input)).resolves.toBeNull();
    expect(input).toEqual(request());
    expect(f.fetcher.mock.calls).toEqual([rpcCall('claim_job', claimBody)]);
  });

  it.each(['cms.schema.dry_run', 'object.verify', 'objects.verify'])(
    'blocks %s effects and terminal writes after an adapter binding rejection',
    async (type) => {
      const f = fixture({ ...sqlRow, job_id: FOREIGN_ID }, type);
      const effect = vi.fn<JobEffectPort['execute']>(async () => ({
        state: 'succeeded',
        resultRef: { controlled: true },
        errorCode: null,
      }));
      const outcome = vi.spyOn(f.persistence, 'applyJobOutcome');
      const processed = vi.spyOn(f.persistence, 'recordProcessedEvent');
      const envelope = QueueEnvelopeSchema.parse({
        aggregateId: JOB_ID,
        aggregateType: 'job',
        aggregateVersion: REQUESTED,
        causationId: null,
        correlationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        eventId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        eventType: 'job.requested',
        schemaVersion: 1,
      });
      const before = { ...envelope };
      await expect(
        executeJobDispatch({
          persistence: f.persistence,
          effect: { execute: effect },
          envelope,
          leaseToken: TOKEN,
          leaseSeconds: 300,
          nowMs: request().nowMs,
          processedEventIds: [],
        }),
      ).rejects.toThrow('Invalid job lease');
      expect(effect).not.toHaveBeenCalled();
      expect(outcome).not.toHaveBeenCalled();
      expect(processed).not.toHaveBeenCalled();
      expect(envelope).toEqual(before);
      expect(f.fetcher.mock.calls).toEqual([
        rpcCall('read_canonical_job', { p_job_id: JOB_ID }),
        rpcCall('read_restore_fence', {}),
        rpcCall('read_restore_fence', {}),
        rpcCall('claim_job', claimBody),
      ]);
    },
  );
});
