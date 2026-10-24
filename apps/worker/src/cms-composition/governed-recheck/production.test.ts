import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import {
  createAsyncEntrypoint,
  type AsyncExecutionContext,
  type AsyncWorkerBindings,
  type PlatformJobsMessage,
} from '../../async-entrypoint';
import { createProductionAsyncEntrypoint } from '../../production-async-entrypoint';
import { jobBody } from '../../cms-editorial/review-recheck/review-recheck.test-support';
import {
  governedJobBody,
  IDS,
  REF,
  sourceBody,
} from './governed-recheck.test-support';

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
const batch = (messages: readonly PlatformJobsMessage[]) => ({
  messages,
  queue: 'platform-jobs-staging',
});

describe('[P2-S12-AC-202] async entrypoint routing of the governed recheck job', () => {
  it('hands a governed job message to the review recheck seam and acknowledges', async () => {
    const queued = message(governedJobBody());
    const processReviewRecheck = vi.fn(async () => ({
      outcome: 'ack' as const,
    }));
    const processEventConsumer = vi.fn();
    await createAsyncEntrypoint({
      processReviewRecheck,
      processEventConsumer,
    }).queue(batch([queued]), bindings, executionContext);
    expect(processReviewRecheck).toHaveBeenCalledOnce();
    expect(queued.ack).toHaveBeenCalledOnce();
    expect(processEventConsumer).not.toHaveBeenCalled();
  });

  it('retries a governed job message when no seam is wired, so the queue can dead-letter it', async () => {
    const queued = message(governedJobBody());
    await createAsyncEntrypoint({}).queue(
      batch([queued]),
      bindings,
      executionContext,
    );
    expect(queued.ack).not.toHaveBeenCalled();
    expect(queued.retry).toHaveBeenCalledOnce();
  });
});

describe('[P2-S12-AC-202] production wiring of the governed recheck', () => {
  it('relays a schema event to both rechecks, then runs the governed job through the database RPC', async () => {
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
            : {
                examined: 2,
                invalidated: 2,
                dependencyChanged: 2,
                reviewerAuthorityChanged: 0,
                unavailable: 0,
                nextCursor: null,
              },
      );
    });
    const entrypoint = createProductionAsyncEntrypoint(
      fetchImpl as unknown as typeof fetch,
    );
    const source = message(sourceBody('cms.schema.activated.v1'));
    const job = message(governedJobBody());
    await entrypoint.queue(batch([source, job]), bindings, executionContext);
    expect(source.ack).toHaveBeenCalledOnce();
    expect(job.ack).toHaveBeenCalledOnce();
    expect(job.retry).not.toHaveBeenCalled();
    expect(operations).toEqual([
      'cms_governed_recheck_resolve_event',
      'cms_dependency_recheck_resolve_event',
      'cms_recheck_governed_reviews',
    ]);
    expect(
      send.mock.calls.map(([sent]) => (sent as { jobType: string }).jobType),
    ).toEqual(['cms.governed_review.recheck', 'cms.review.dependency_recheck']);
    expect(send).toHaveBeenCalledWith({
      jobType: 'cms.governed_review.recheck',
      schemaVersion: 1,
      payload: { eventId: IDS.event, kind: 'content_type', refId: REF },
      cursor: null,
      correlationId: IDS.correlation,
    });
  });

  it('still runs an editorial recheck job through the same composition', async () => {
    send.mockReset();
    const operations: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      operations.push(url.split('/rest/v1/rpc/')[1] ?? '');
      return Response.json({ examined: 0, invalidated: 0, nextCursor: null });
    });
    const entrypoint = createProductionAsyncEntrypoint(
      fetchImpl as unknown as typeof fetch,
    );
    const queued = message(jobBody());
    await entrypoint.queue(batch([queued]), bindings, executionContext);
    expect(queued.ack).toHaveBeenCalledOnce();
    expect(operations).toEqual(['cms_dependency_recheck_run']);
  });

  it('retries a governed job whose RPC dependency is down so the platform queue can redeliver it', async () => {
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
    const queued = message(governedJobBody(), 2);
    await entrypoint.queue(batch([queued]), bindings, executionContext);
    expect(queued.ack).not.toHaveBeenCalled();
    expect(queued.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
    expect(send).not.toHaveBeenCalled();
    expect(JSON.parse(logs[0] ?? '{}')).toMatchObject({
      eventName: 'cms.governed_review_recheck',
      errorCode: 'RECHECK_RUN_FAILED',
      outcome: 'retry',
      service: 'test',
    });
  });
});
