import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import type {
  AsyncExecutionContext,
  AsyncWorkerBindings,
  PlatformJobsMessage,
} from './async-entrypoint';
import {
  IDS,
  jobBody,
  REF,
  sourceBody,
} from './cms-editorial/review-recheck/review-recheck.test-support';
import { createProductionAsyncEntrypoint } from './production-async-entrypoint';

const send = vi.fn();
const bindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'local',
  PLATFORM_JOBS: { send },
  SUPABASE_SECRET_KEY: 'sb_secret_0123456789abcdef',
  SUPABASE_URL: 'https://staging.example.supabase.co',
} as unknown as AsyncWorkerBindings;
const executionContext = { waitUntil: vi.fn() } satisfies AsyncExecutionContext;

const message = (body: unknown, attempts = 1): PlatformJobsMessage => ({
  ack: vi.fn(),
  attempts,
  body,
  id: 'm',
  retry: vi.fn(),
});

describe('[P2-S11-AC-113] production async entrypoint review recheck wiring', () => {
  it('relays a source event and then its job through the real consumers, reusing one composition per environment', async () => {
    send.mockReset();
    const operations: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      const operation = url.split('/rest/v1/rpc/')[1] ?? '';
      operations.push(operation);
      return Response.json(
        operation === 'cms_governed_recheck_resolve_event'
          ? { found: true, kind: 'content_type', refId: REF }
          : operation === 'cms_dependency_recheck_resolve_event'
            ? { found: true, kind: 'schema', refId: REF }
            : { examined: 2, invalidated: 2, nextCursor: null },
      );
    });
    const entrypoint = createProductionAsyncEntrypoint(
      fetchImpl as unknown as typeof fetch,
    );
    const first = message(sourceBody('cms.schema.activated.v1'));
    const second = message(sourceBody('cms.schema.activated.v1'));
    const job = message(jobBody());
    await entrypoint.queue(
      { messages: [first, second, job], queue: 'platform-jobs-staging' },
      bindings,
      executionContext,
    );
    for (const queued of [first, second, job]) {
      expect(queued.ack).toHaveBeenCalledOnce();
      expect(queued.retry).not.toHaveBeenCalled();
    }
    // Slice 12 (P2-S12-AC-202): a schema event is also consumed by the governed recheck producer, which rereads the
    // event through its own resolver (cms_governed_recheck_resolve_event) before the editorial consumer does, and
    // enqueues its own job, so each message resolves twice and sends twice.
    expect(operations).toEqual([
      'cms_governed_recheck_resolve_event',
      'cms_dependency_recheck_resolve_event',
      'cms_governed_recheck_resolve_event',
      'cms_dependency_recheck_resolve_event',
      'cms_dependency_recheck_run',
    ]);
    expect(send).toHaveBeenCalledTimes(4);
    expect(send).toHaveBeenCalledWith({
      jobType: 'cms.governed_review.recheck',
      schemaVersion: 1,
      payload: { eventId: IDS.event, kind: 'content_type', refId: REF },
      cursor: null,
      correlationId: IDS.correlation,
    });
    expect(send).toHaveBeenCalledWith({
      jobType: 'cms.review.dependency_recheck',
      schemaVersion: 1,
      payload: { eventId: IDS.event, kind: 'schema', refId: REF },
      cursor: null,
      correlationId: IDS.correlation,
    });
  });

  it('retries a message whose RPC dependency is down so the platform queue can redeliver it', async () => {
    send.mockReset();
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 503 }));
    const logs: string[] = [];
    const entrypoint = createProductionAsyncEntrypoint(
      fetchImpl as unknown as typeof fetch,
      undefined,
      undefined,
      {
        logger: createLogger(
          { environment: 'staging', release: 'local', service: 'test' },
          { sink: (line) => logs.push(line) },
        ),
      },
    );
    const queued = message(jobBody(), 2);
    await entrypoint.queue(
      { messages: [queued], queue: 'platform-jobs-staging' },
      bindings,
      executionContext,
    );
    expect(queued.ack).not.toHaveBeenCalled();
    expect(queued.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
    expect(send).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0] ?? '{}')).toMatchObject({
      eventName: 'cms.review_dependency_recheck',
      errorCode: 'RECHECK_RUN_FAILED',
      outcome: 'retry',
      service: 'test',
    });
  });
});
