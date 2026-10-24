import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import {
  createAsyncEntrypoint,
  type AsyncExecutionContext,
  type AsyncWorkerBindings,
  type PlatformJobsMessage,
} from '../../async-entrypoint';
import { createProductionAsyncEntrypoint } from '../../production-async-entrypoint';
import { governedJobBody } from '../governed-recheck/governed-recheck.test-support';
import {
  IDS,
  NEXT_CURSOR,
  PATTERN,
  scanJobBody,
  sourceBody,
  VERSION,
} from './linked-scan.test-support';

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
const operationOf = (url: string): string =>
  url.split('/rest/v1/rpc/')[1] ?? '';

describe('[P2-S12-AC-212] async entrypoint routing of the linked-update scan job', () => {
  it('hands a scan job message to the review recheck seam and acknowledges', async () => {
    const queued = message(scanJobBody());
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

  it('retries a scan job message when no seam is wired, so the queue can dead-letter it', async () => {
    const queued = message(scanJobBody());
    await createAsyncEntrypoint({}).queue(
      batch([queued]),
      bindings,
      executionContext,
    );
    expect(queued.ack).not.toHaveBeenCalled();
    expect(queued.retry).toHaveBeenCalledOnce();
  });
});

describe('[P2-S12-AC-212] production wiring of the linked-update scan', () => {
  it('relays a pattern activation to the scan, the governed recheck and the editorial recheck, in that order', async () => {
    send.mockReset();
    const operations: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      const operation = operationOf(url);
      operations.push(operation);
      return Response.json(
        operation === 'cms_linked_scan_resolve_event'
          ? { found: true, patternId: PATTERN, patternVersionId: VERSION }
          : operation === 'cms_governed_recheck_resolve_event'
            ? { found: true, kind: 'pattern', refId: VERSION }
            : { found: true, kind: 'pattern', refId: VERSION },
      );
    });
    const entrypoint = createProductionAsyncEntrypoint(
      fetchImpl as unknown as typeof fetch,
    );
    const source = message(sourceBody('cms.pattern.activated.v1'));
    await entrypoint.queue(batch([source]), bindings, executionContext);
    expect(source.ack).toHaveBeenCalledOnce();
    expect(source.retry).not.toHaveBeenCalled();
    expect(operations).toEqual([
      'cms_linked_scan_resolve_event',
      'cms_governed_recheck_resolve_event',
      'cms_dependency_recheck_resolve_event',
    ]);
    expect(
      send.mock.calls.map(([sent]) => (sent as { jobType: string }).jobType),
    ).toEqual([
      'cms.pattern.linked_update_scan',
      'cms.governed_review.recheck',
      'cms.review.dependency_recheck',
    ]);
    expect(send).toHaveBeenCalledWith({
      jobType: 'cms.pattern.linked_update_scan',
      schemaVersion: 1,
      payload: { patternId: PATTERN, patternVersionId: VERSION },
      cursor: null,
      correlationId: IDS.correlation,
    });
  });

  it('runs the scan job through the database RPC, enqueues its continuation and acknowledges', async () => {
    send.mockReset();
    const requests: unknown[] = [];
    const operations: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      operations.push(operationOf(url));
      requests.push(JSON.parse(String(init?.body ?? '{}')));
      return Response.json({
        examined: 500,
        appended: 120,
        nextCursor: NEXT_CURSOR,
      });
    });
    const entrypoint = createProductionAsyncEntrypoint(
      fetchImpl as unknown as typeof fetch,
    );
    const job = message(scanJobBody());
    await entrypoint.queue(batch([job]), bindings, executionContext);
    expect(job.ack).toHaveBeenCalledOnce();
    expect(job.retry).not.toHaveBeenCalled();
    expect(operations).toEqual(['cms_scan_linked_pattern_updates']);
    expect(requests).toEqual([
      {
        p_request: {
          patternId: PATTERN,
          patternVersionId: VERSION,
          cursor: null,
          correlationId: IDS.correlation,
        },
      },
    ]);
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({
      ...scanJobBody(),
      cursor: NEXT_CURSOR,
    });
  });

  it('still runs a governed recheck job through the same composition', async () => {
    send.mockReset();
    const operations: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      operations.push(operationOf(url));
      return Response.json({
        examined: 0,
        invalidated: 0,
        dependencyChanged: 0,
        reviewerAuthorityChanged: 0,
        unavailable: 0,
        nextCursor: null,
      });
    });
    const entrypoint = createProductionAsyncEntrypoint(
      fetchImpl as unknown as typeof fetch,
    );
    const queued = message(governedJobBody());
    await entrypoint.queue(batch([queued]), bindings, executionContext);
    expect(queued.ack).toHaveBeenCalledOnce();
    expect(operations).toEqual(['cms_recheck_governed_reviews']);
  });

  it('retries a scan job whose RPC dependency is down on the jittered ladder so the platform queue can redeliver it', async () => {
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
    const queued = message(scanJobBody(), 2);
    await entrypoint.queue(batch([queued]), bindings, executionContext);
    expect(queued.ack).not.toHaveBeenCalled();
    const [call] = (queued.retry as ReturnType<typeof vi.fn>).mock.calls;
    const delay = (call?.[0] as { delaySeconds: number }).delaySeconds;
    expect(delay).toBeGreaterThanOrEqual(60);
    expect(delay).toBeLessThanOrEqual(66);
    expect(send).not.toHaveBeenCalled();
    expect(JSON.parse(logs[0] ?? '{}')).toMatchObject({
      eventName: 'cms.linked_update_scan',
      errorCode: 'LINKED_SCAN_RUN_FAILED',
      outcome: 'retry',
      service: 'test',
    });
  });
});
