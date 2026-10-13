import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from '../../async-entrypoint';
import { createProductionReviewRecheckProcessor } from './production';
import {
  CURSOR,
  IDS,
  jobBody,
  REF,
  sourceBody,
} from './review-recheck.test-support';

const send = vi.fn();
const env = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'local',
  PLATFORM_JOBS: { send },
  SUPABASE_SECRET_KEY: 'sb_secret_0123456789abcdef',
  SUPABASE_URL: 'https://staging.example.supabase.co',
} as unknown as AsyncWorkerBindings;

type Call = Readonly<{ operation: string; body: unknown }>;

const harness = (routes: Readonly<Record<string, unknown>>) => {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
    const operation = url.split('/rest/v1/rpc/')[1] ?? '';
    calls.push({ operation, body: JSON.parse(String(init.body)) });
    return Response.json(routes[operation]);
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
};

describe('[P2-S11-AC-113] the production review recheck composition', () => {
  it('rereads a source event through the real RPC transport and enqueues the job on the platform queue', async () => {
    send.mockReset();
    const { calls, fetchImpl } = harness({
      cms_dependency_recheck_resolve_event: {
        found: true,
        kind: 'schema',
        refId: REF,
      },
    });
    const processor = createProductionReviewRecheckProcessor(env, fetchImpl);
    await expect(
      processor.process({
        body: sourceBody('cms.schema.activated.v1'),
        attempts: 1,
      }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(calls).toEqual([
      {
        operation: 'cms_dependency_recheck_resolve_event',
        body: { p_event_id: IDS.event },
      },
    ]);
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({
      jobType: 'cms.review.dependency_recheck',
      schemaVersion: 1,
      payload: { eventId: IDS.event, kind: 'schema', refId: REF },
      cursor: null,
      correlationId: IDS.correlation,
    });
  });

  it('runs a job message through the real RPC transport and enqueues its continuation', async () => {
    send.mockReset();
    const { calls, fetchImpl } = harness({
      cms_dependency_recheck_run: {
        examined: 500,
        invalidated: 4,
        nextCursor: CURSOR,
      },
    });
    const processor = createProductionReviewRecheckProcessor(env, fetchImpl);
    await expect(
      processor.process({ body: jobBody(), attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(calls).toEqual([
      {
        operation: 'cms_dependency_recheck_run',
        body: {
          p_request: {
            eventId: IDS.event,
            kind: 'schema',
            refId: REF,
            cursor: null,
          },
        },
      },
    ]);
    expect(send).toHaveBeenCalledWith({ ...jobBody(), cursor: CURSOR });
  });

  it('dead-letters an unresolvable event through the consumer dead-letter RPC', async () => {
    send.mockReset();
    const { calls, fetchImpl } = harness({
      cms_dependency_recheck_resolve_event: { found: false },
      consumer_dead_letter_event: { accepted: true },
    });
    const processor = createProductionReviewRecheckProcessor(env, fetchImpl);
    await expect(
      processor.process({
        body: sourceBody('cms.block.lifecycle.changed.v1'),
        attempts: 1,
      }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(calls.map((call) => call.operation)).toEqual([
      'cms_dependency_recheck_resolve_event',
      'consumer_dead_letter_event',
    ]);
    expect(send).not.toHaveBeenCalled();
  });

  it('writes to the logger it is given, and builds its own when none is given', async () => {
    send.mockReset();
    const lines: string[] = [];
    const logger = createLogger(
      { environment: 'staging', release: 'local', service: 'recheck-test' },
      { sink: (line) => lines.push(line) },
    );
    const { fetchImpl } = harness({
      cms_dependency_recheck_run: {
        examined: 1,
        invalidated: 0,
        nextCursor: null,
      },
    });
    await createProductionReviewRecheckProcessor(env, fetchImpl, {
      logger,
    }).process({ body: jobBody(), attempts: 1 });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      eventName: 'cms.review_dependency_recheck',
      severity: 'INFO',
      service: 'recheck-test',
    });
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await expect(
      createProductionReviewRecheckProcessor(env, fetchImpl).process({
        body: jobBody(),
        attempts: 1,
      }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(info).toHaveBeenCalledOnce();
    expect(info.mock.calls[0]?.[0]).toMatchObject({
      service: 'wejammin-cms-review-recheck',
      environment: 'staging',
      release: 'local',
    });
    info.mockRestore();
  });

  it('uses the global fetch when none is injected', () => {
    expect(() => createProductionReviewRecheckProcessor(env)).not.toThrow();
  });
});
