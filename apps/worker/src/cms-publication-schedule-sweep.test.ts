import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { AsyncRpcManualReviewError } from './async-runtime-support';
import { accessibilityBindingHash } from './cms-editorial/a11y-structural';
import {
  blockingInput,
  cleanInput,
} from './cms-editorial/a11y-structural/a11y-structural.test-support';
import { runProductionCmsPublicationScheduleSweep } from './cms-publication-schedule-sweep';

/*
 * CMS-03B-20, the scheduled sweep: claim at most 25, then for each claim run
 * the accessibility checker, bind its proof to the claimed revision and frozen
 * dependency hash, and execute with the schedule version and lease. A failure
 * of one execution never stops the batch and nothing sensitive is logged.
 */

const secret = 'sb_secret_schedule_sweep_test_only';
const bindings = {
  APP_ENVIRONMENT: 'production',
  APP_RELEASE: 'test-release',
  SUPABASE_SECRET_KEY: secret,
  SUPABASE_URL: 'https://schedule-sweep.example.supabase.co/',
} as unknown as AsyncWorkerBindings;

const gate = cleanInput();
const claimFor = (index: number, patch: Record<string, unknown> = {}) => ({
  scheduleId: `123e4567-e89b-42d3-a456-42661417400${index}`,
  revisionId: gate.revisionId,
  scheduleVersion: String(index + 1),
  expectedVersion: '2',
  leaseId: `223e4567-e89b-42d3-a456-42661417400${index}`,
  dependencyHash: gate.dependencyHash,
  activationEvidenceHash: 'b'.repeat(64),
  correlationId: `323e4567-e89b-42d3-a456-42661417400${index}`,
  ...patch,
});
const completed = (claim: { scheduleId: string }) => ({
  scheduleId: claim.scheduleId,
  outcome: 'completed',
  reasonCode: null,
  publicationVersionId: '423e4567-e89b-42d3-a456-426614174000',
  actualUtc: '2026-11-01T14:30:03Z',
  deviationSeconds: 3,
});

type Handler = (body: Record<string, unknown>) => Response | Promise<Response>;

const stubEdge = (handlers: Readonly<Record<string, Handler>>) => {
  const calls: {
    name: string;
    body: Record<string, unknown>;
    headers: Record<string, string>;
  }[] = [];
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockImplementation(async (input, init) => {
      const name = String(input).split('/rpc/')[1] as string;
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({
        name,
        body,
        headers: init?.headers as Record<string, string>,
      });
      const handler = handlers[name];
      if (handler === undefined) throw new Error(`unexpected ${name}`);
      return handler(body);
    });
  vi.stubGlobal('fetch', fetchImpl);
  return { calls, fetchImpl };
};

const logs = () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return () => JSON.stringify([...info.mock.calls, ...error.mock.calls]);
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('a quiet tick', () => {
  it('claims the bounded batch once and logs only the count', async () => {
    const edge = stubEdge({
      cms_claim_due_publication_schedules: () => Response.json([]),
    });
    const logged = logs();
    await runProductionCmsPublicationScheduleSweep(bindings);
    expect(edge.calls).toHaveLength(1);
    expect(edge.calls[0]).toMatchObject({
      name: 'cms_claim_due_publication_schedules',
      body: { p_request: { batch: 25 } },
      headers: {
        'Accept-Profile': 'platform_api',
        'Content-Profile': 'platform_api',
        apikey: secret,
      },
    });
    expect(logged()).toContain('cms_publication_schedule_sweep.completed');
    expect(logged()).toContain('"cms_schedule_claim_batch_size":0');
    expect(logged()).not.toContain(secret);
  });
});

describe('executing claims', () => {
  it('runs the checker then executes each claim in order with the bound proof', async () => {
    const [first, second] = [claimFor(1), claimFor(2)];
    const edge = stubEdge({
      cms_claim_due_publication_schedules: () => Response.json([first, second]),
      cms_load_quality_gate_input: () => Response.json(gate),
      cms_execute_publication_schedule: (body) =>
        Response.json(completed(body.p_request as { scheduleId: string })),
    });
    const logged = logs();
    await runProductionCmsPublicationScheduleSweep(bindings);
    expect(edge.calls.map((call) => call.name)).toEqual([
      'cms_claim_due_publication_schedules',
      'cms_load_quality_gate_input',
      'cms_execute_publication_schedule',
      'cms_load_quality_gate_input',
      'cms_execute_publication_schedule',
    ]);
    expect(edge.calls[1]!.body).toEqual({
      p_request: {
        phase: 'execute',
        scheduleId: first.scheduleId,
        revisionId: first.revisionId,
        dependencyHash: first.dependencyHash,
      },
    });
    expect(edge.calls[1]!.headers['X-Operation-Id']).toBe('CMS-03B-20');
    const execute = edge.calls[2]!.body.p_request as Record<string, unknown>;
    expect(execute).toMatchObject({
      scheduleId: first.scheduleId,
      expectedVersion: '2',
      leaseId: first.leaseId,
      evidence: {
        category: 'accessibility',
        outcome: 'healthy',
        bindingHash: await accessibilityBindingHash({
          revisionId: first.revisionId,
          revisionContentHash: gate.revisionContentHash,
          dependencyHash: first.dependencyHash,
        }),
      },
    });
    expect(
      (edge.calls[4]!.body.p_request as { expectedVersion: string })
        .expectedVersion,
    ).toBe('3');
    const text = logged();
    expect(text).toContain(
      '"cms_schedule_attempt_total{outcome=\\"completed\\"}":1',
    );
    expect(text).toContain('"cms_schedule_claim_batch_size":2');
    for (const hidden of [
      secret,
      first.scheduleId,
      first.leaseId,
      first.dependencyHash,
      gate.revisionContentHash,
    ])
      expect(text).not.toContain(hidden);
    expect(text).toContain('sha256:');
  });

  it('sends blocked evidence for a revision the checker blocks', async () => {
    const blocked = blockingInput();
    const claim = claimFor(1, {
      revisionId: blocked.revisionId,
      dependencyHash: blocked.dependencyHash,
    });
    const edge = stubEdge({
      cms_claim_due_publication_schedules: () => Response.json([claim]),
      cms_load_quality_gate_input: () => Response.json(blocked),
      cms_execute_publication_schedule: () =>
        Response.json({
          scheduleId: claim.scheduleId,
          outcome: 'blocked',
          reasonCode: 'preflight_failed',
          publicationVersionId: null,
          actualUtc: null,
          deviationSeconds: null,
        }),
    });
    const logged = logs();
    await runProductionCmsPublicationScheduleSweep(bindings);
    expect(
      (edge.calls[2]!.body.p_request as { evidence: { outcome: string } })
        .evidence.outcome,
    ).toBe('blocked');
    expect(logged()).toContain(
      'cms_schedule_blocked_total{reason=\\"preflight_failed\\"}',
    );
  });

  it('sends no proof when the revision cannot be loaded or is not the claimed one', async () => {
    const claim = claimFor(1);
    for (const load of [
      () =>
        new Response('{}', {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      () => Response.json({ ...gate, dependencyHash: 'c'.repeat(64) }),
      () =>
        Response.json({
          ...gate,
          revisionId: '523e4567-e89b-42d3-a456-426614174000',
        }),
      () => Response.json({ not: 'a checker input' }),
    ]) {
      const edge = stubEdge({
        cms_claim_due_publication_schedules: () => Response.json([claim]),
        cms_load_quality_gate_input: load,
        cms_execute_publication_schedule: () =>
          Response.json({
            scheduleId: claim.scheduleId,
            outcome: 'failed_retryable',
            reasonCode: null,
            publicationVersionId: null,
            actualUtc: null,
            deviationSeconds: null,
          }),
      });
      logs();
      await runProductionCmsPublicationScheduleSweep(bindings);
      expect(
        (edge.calls.at(-1)!.body.p_request as { evidence: unknown }).evidence,
      ).toBeNull();
      vi.restoreAllMocks();
    }
  });

  it('keeps going after one execution fails and logs it without ids', async () => {
    const [first, second] = [claimFor(1), claimFor(2)];
    let executions = 0;
    const edge = stubEdge({
      cms_claim_due_publication_schedules: () => Response.json([first, second]),
      cms_load_quality_gate_input: () => Response.json(gate),
      cms_execute_publication_schedule: (body) => {
        executions += 1;
        return executions === 1
          ? new Response(`postgres-error:${secret}`, { status: 503 })
          : Response.json(completed(body.p_request as { scheduleId: string }));
      },
    });
    const logged = logs();
    await expect(
      runProductionCmsPublicationScheduleSweep(bindings),
    ).resolves.toBeUndefined();
    expect(
      edge.calls.filter(
        (call) => call.name === 'cms_execute_publication_schedule',
      ),
    ).toHaveLength(2);
    const text = logged();
    expect(text).toContain('cms_publication_schedule_sweep.execute_failed');
    expect(text).toContain('DEPENDENCY_UNAVAILABLE');
    expect(text).toContain(
      '"cms_schedule_attempt_total{outcome=\\"error\\"}":1',
    );
    expect(text).not.toContain('postgres-error');
    expect(text).not.toContain(secret);
  });

  it.each([
    [
      'a malformed JSON reply',
      () => new Response('not json', { status: 200 }),
      'MANUAL_REVIEW',
    ],
    [
      'a result for another schedule',
      () => Response.json({ ...completed(claimFor(9)) }),
      'DEPENDENCY_INVALID_RESPONSE',
    ],
  ])(
    'logs %s as a contract fault and does not retry the execution',
    async (_name, respond, code) => {
      const claim = claimFor(1);
      const edge = stubEdge({
        cms_claim_due_publication_schedules: () => Response.json([claim]),
        cms_load_quality_gate_input: () => Response.json(gate),
        cms_execute_publication_schedule: respond,
      });
      const logged = logs();
      await runProductionCmsPublicationScheduleSweep(bindings);
      expect(
        edge.calls.filter(
          (call) => call.name === 'cms_execute_publication_schedule',
        ),
      ).toHaveLength(1);
      expect(logged()).toContain(code);
    },
  );
});

describe('claim failures', () => {
  it('requests a retry without leaking the upstream body when the claim RPC is unavailable', async () => {
    stubEdge({
      cms_claim_due_publication_schedules: () =>
        new Response(`postgres-error:${secret}`, { status: 503 }),
    });
    const logged = logs();
    await expect(
      runProductionCmsPublicationScheduleSweep(bindings),
    ).rejects.toThrow('CMS publication schedule sweep requested retry');
    expect(logged()).toContain('cms_publication_schedule_sweep.failed');
    expect(logged()).toContain('DEPENDENCY_UNAVAILABLE');
    expect(logged()).not.toContain('postgres-error');
  });

  it.each([
    ['a non-list', { rows: [] }],
    ['an unknown member', [{ ...claimFor(1), content: 'x' }]],
    [
      'more than the batch',
      Array.from({ length: 26 }, (_v, index) => claimFor(index % 10)),
    ],
  ])('requests a retry on %s', async (_name, reply) => {
    stubEdge({
      cms_claim_due_publication_schedules: () => Response.json(reply),
    });
    const logged = logs();
    await expect(
      runProductionCmsPublicationScheduleSweep(bindings),
    ).rejects.toThrow('CMS publication schedule sweep requested retry');
    expect(logged()).toContain('DEPENDENCY_INVALID_RESPONSE');
  });

  it('records a manual-review failure and rethrows it for a non-JSON body', async () => {
    stubEdge({
      cms_claim_due_publication_schedules: () =>
        new Response('not json', { status: 200 }),
    });
    const logged = logs();
    await expect(
      runProductionCmsPublicationScheduleSweep(bindings),
    ).rejects.toBeInstanceOf(AsyncRpcManualReviewError);
    expect(logged()).toContain(
      'cms_publication_schedule_sweep.manual_review_required',
    );
  });
});
