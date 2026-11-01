import type { JobEffectInput } from '@wejammin/application';
import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { createTaxonomyMergeConvergeEffect } from './cms-taxonomy-merge-converge-effect';

/**
 * BE03c Observability (1595-1597): scrubbed structured logs keyed by operation, correlation id, attempt, outcome,
 * error code and duration, and the metric `cms_taxonomy_merge_total`. Labels come from a closed set; no secret, lease
 * token or claim version is ever logged.
 */
const JOB_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NEXT_JOB = '22222222-2222-4222-8222-222222222222';
const env = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'local',
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
} as unknown as AsyncWorkerBindings;
const input: JobEffectInput = {
  job: {
    id: JOB_ID,
    type: 'cms.taxonomy.merge_converge',
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
};
const context = (deliveryAttempt = 2) => ({
  env,
  signal: new AbortController().signal,
  deliveryAttempt,
});

const run = async (reply: () => Promise<Response>, deliveryAttempt = 2) => {
  const lines: string[] = [];
  const effect = createTaxonomyMergeConvergeEffect(vi.fn<typeof fetch>(reply), {
    sleep: async () => undefined,
    logger: createLogger(
      { environment: 'staging', release: 'local', service: 'test' },
      { sink: (line) => lines.push(line) },
    ),
  });
  const result = await effect(input, context(deliveryAttempt));
  return {
    result,
    events: lines.map((line) => JSON.parse(line) as Record<string, unknown>),
    lines,
  };
};

describe('merge-converge telemetry', () => {
  it('a continued merge logs one success event with counts and the continued metric', async () => {
    const { events } = await run(async () =>
      Response.json({
        converged: 5000,
        remaining: 40,
        continuationJobId: NEXT_JOB,
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      severity: 'INFO',
      eventName: 'cms_taxonomy_merge_converge.settled',
      operation: 'cms_taxonomy_merge_converge',
      outcome: 'success',
      jobId: JOB_ID,
      correlationId: '33333333-3333-4333-8333-333333333333',
      attempt: 2,
      attributes: { converged: 5000, remaining: 40, continued: true },
      metrics: { 'cms_taxonomy_merge_total{outcome="continued"}': 1 },
    });
    expect(events[0]).not.toHaveProperty('errorCode');
  });

  it('a drained tail counts as converged', async () => {
    const { events } = await run(async () =>
      Response.json({ converged: 3, remaining: 0, continuationJobId: null }),
    );
    expect(events[0]).toMatchObject({
      attributes: { converged: 3, remaining: 0, continued: false },
      metrics: { 'cms_taxonomy_merge_total{outcome="converged"}': 1 },
    });
  });

  it('a failed job logs an error event with the job error code and the failed metric', async () => {
    const { events } = await run(async () =>
      Response.json(
        { code: 'P0001', message: 'capability_missing' },
        { status: 400 },
      ),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      severity: 'ERROR',
      outcome: 'failure',
      errorCode: 'CAPABILITY_MISSING',
      retryable: false,
      metrics: { 'cms_taxonomy_merge_total{outcome="failed"}': 1 },
    });
  });

  it('never logs the lease token, the claim version, the credential or the continuation id', async () => {
    const { lines } = await run(async () =>
      Response.json({
        converged: 1,
        remaining: 1,
        continuationJobId: NEXT_JOB,
      }),
    );
    for (const line of lines) {
      expect(line).not.toContain(TOKEN);
      expect(line).not.toContain('sb_secret');
      expect(line).not.toContain(NEXT_JOB);
    }
  });

  it('a logger that throws never changes the disposition', async () => {
    const effect = createTaxonomyMergeConvergeEffect(
      vi.fn<typeof fetch>(async () =>
        Response.json({ converged: 1, remaining: 0, continuationJobId: null }),
      ),
      {
        logger: {
          debug: () => 'written',
          info: () => {
            throw new Error('sink down');
          },
          warn: () => 'written',
          error: () => {
            throw new Error('sink down');
          },
          fatal: () => 'written',
        } as never,
      },
    );
    expect((await effect(input, context())).state).toBe('succeeded');
  });

  it('an environment the logger cannot be built for still disposes the job', async () => {
    const effect = createTaxonomyMergeConvergeEffect(
      vi.fn<typeof fetch>(async () =>
        Response.json({ converged: 1, remaining: 0, continuationJobId: null }),
      ),
    );
    const result = await effect(input, {
      ...context(),
      env: { ...env, APP_RELEASE: undefined } as unknown as AsyncWorkerBindings,
    });
    expect(result.state).toBe('succeeded');
  });

  it('a refused claim receipt logs one failed event and calls nothing', async () => {
    const lines: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>();
    const effect = createTaxonomyMergeConvergeEffect(fetchImpl, {
      logger: createLogger(
        { environment: 'staging', release: 'local', service: 'test' },
        { sink: (line) => lines.push(line) },
      ),
    });
    const unclaimed: JobEffectInput = {
      job: input.job,
      envelope: input.envelope,
      leaseToken: input.leaseToken,
    };
    const result = await effect(unclaimed, context(3));
    expect(result).toMatchObject({
      state: 'failed',
      errorCode: 'MERGE_CONVERGE_CLAIM_INVALID',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    const events = lines.map((line) => JSON.parse(line) as unknown);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      severity: 'ERROR',
      outcome: 'failure',
      errorCode: 'MERGE_CONVERGE_CLAIM_INVALID',
      jobId: JOB_ID,
      attempt: 3,
      metrics: { 'cms_taxonomy_merge_total{outcome="failed"}': 1 },
    });
  });

  it('a delivery without the Worker context logs one failed event through the injected logger', async () => {
    const lines: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>();
    const effect = createTaxonomyMergeConvergeEffect(fetchImpl, {
      logger: createLogger(
        { environment: 'staging', release: 'local', service: 'test' },
        { sink: (line) => lines.push(line) },
      ),
    });
    expect(await effect(input, undefined)).toMatchObject({
      state: 'failed',
      errorCode: 'DEPENDENCY_UNAVAILABLE',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      outcome: 'failure',
      errorCode: 'DEPENDENCY_UNAVAILABLE',
      attempt: 1,
    });
  });

  it('a delivery without the context and without an injected logger still disposes the job', async () => {
    const effect = createTaxonomyMergeConvergeEffect(vi.fn<typeof fetch>());
    expect(await effect(input, undefined)).toMatchObject({
      state: 'failed',
      errorCode: 'DEPENDENCY_UNAVAILABLE',
    });
  });
});
