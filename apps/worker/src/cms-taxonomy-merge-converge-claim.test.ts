import type { JobEffectInput } from '@wejammin/application';
import { describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';
import {
  build,
  context,
  env,
  failed,
  input,
  JOB_ID,
  NEXT_JOB,
  TOKEN,
} from './cms-taxonomy-merge-converge.test-support';

describe('merge-converge effect: the claim is the authority', () => {
  it.each([
    ['no claim receipt', { claimedLease: undefined }],
    [
      'a receipt for another job',
      {
        claimedLease: {
          jobId: NEXT_JOB,
          leaseToken: TOKEN,
          expectedVersion: '1',
          version: '2',
          leaseUntilMs: 1,
        },
      },
    ],
    [
      'a receipt with another lease token',
      {
        claimedLease: {
          jobId: JOB_ID,
          leaseToken: NEXT_JOB,
          expectedVersion: '1',
          version: '2',
          leaseUntilMs: 1,
        },
      },
    ],
    [
      'a receipt whose version does not advance the canonical one',
      {
        claimedLease: {
          jobId: JOB_ID,
          leaseToken: TOKEN,
          expectedVersion: '1',
          version: '1',
          leaseUntilMs: 1,
        },
      },
    ],
    [
      'a non-decimal version',
      {
        claimedLease: {
          jobId: JOB_ID,
          leaseToken: TOKEN,
          expectedVersion: '1',
          version: '2e3',
          leaseUntilMs: 1,
        },
      },
    ],
    [
      'another job type',
      {
        job: {
          id: JOB_ID,
          type: 'cms.schema.dry_run',
          state: 'queued' as const,
          version: '1',
          leaseUntilMs: null,
        },
      },
    ],
  ])(
    '%s fails the job MERGE_CONVERGE_CLAIM_INVALID with no network',
    async (_name, overrides) => {
      const fetchImpl = vi.fn<typeof fetch>();
      const result = await build(fetchImpl)(
        input(overrides as Partial<JobEffectInput>),
        context(),
      );
      expect(result).toEqual(failed('MERGE_CONVERGE_CLAIM_INVALID'));
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('without the Worker delivery context the job fails DEPENDENCY_UNAVAILABLE with no network', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await build(fetchImpl)(input(), undefined)).toEqual(
      failed('DEPENDENCY_UNAVAILABLE'),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('an environment without the service credential fails the job and never reaches the network', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await build(fetchImpl)(
      input(),
      context({
        env: { ...env, SUPABASE_SECRET_KEY: ' ' } as AsyncWorkerBindings,
      }),
    );
    expect(result).toEqual(failed('DEPENDENCY_UNAVAILABLE'));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
