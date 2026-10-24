import type { JobEffectInput, JobEffectResult } from '@wejammin/application';

import type { AsyncWorkerBindings } from './async-entrypoint';
import type { JobEffectDeliveryContext } from './async-runtime-job-context';
import { createTaxonomyMergeConvergeEffect } from './cms-taxonomy-merge-converge-effect';

/** Fixtures of the `cms.taxonomy.merge_converge` effect suites. */
export const JOB_ID = '11111111-1111-4111-8111-111111111111';
export const TOKEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const NEXT_JOB = '22222222-2222-4222-8222-222222222222';
export const TYPE = 'cms.taxonomy.merge_converge';
export const env = {
  APP_ENVIRONMENT: 'staging',
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
} as unknown as AsyncWorkerBindings;

export const input = (
  overrides: Partial<JobEffectInput> = {},
): JobEffectInput => ({
  job: {
    id: JOB_ID,
    type: TYPE,
    state: 'queued',
    version: '1',
    leaseUntilMs: null,
  },
  envelope: {
    aggregateId: JOB_ID,
    aggregateType: 'job',
    aggregateVersion: '1',
    causationId: null,
    correlationId: '33333333-3333-4333-8333-333333333333',
    eventId: '44444444-4444-4444-8444-444444444444',
    eventType: 'job.requested',
    schemaVersion: 1,
  },
  leaseToken: TOKEN,
  claimedLease: {
    jobId: JOB_ID,
    leaseToken: TOKEN,
    expectedVersion: '1',
    version: '2',
    leaseUntilMs: 400_000,
  },
  ...overrides,
});
export const context = (
  overrides: Partial<JobEffectDeliveryContext> = {},
): JobEffectDeliveryContext => ({
  env,
  signal: new AbortController().signal,
  deliveryAttempt: 1,
  ...overrides,
});

export const answer = (
  converged: number,
  remaining: number,
  continuationJobId: string | null,
): Response => Response.json({ converged, remaining, continuationJobId });
export const raised = (message: string, status = 400): Response =>
  Response.json({ code: 'P0001', message }, { status });

export const build = (
  fetchImpl: typeof fetch,
  extra: Parameters<typeof createTaxonomyMergeConvergeEffect>[1] = {},
) =>
  createTaxonomyMergeConvergeEffect(fetchImpl, {
    sleep: async () => undefined,
    ...extra,
  });

export const failed = (errorCode: string): JobEffectResult => ({
  state: 'failed',
  errorCode,
  resultRef: null,
});
