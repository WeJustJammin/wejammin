import { afterEach, describe, expect, it, vi } from 'vitest';

import { AsyncRpcManualReviewError } from './async-runtime-support';
import { runProductionCmsGovernedActivationSweep } from './cms-governed-activation-sweep';
import {
  bindings,
  CLAIM_RPC,
  claimFor,
  completed,
  EXECUTE_RPC,
  logs,
  SECRET,
  stubEdge,
} from './cms-governed-activation-sweep.test-support';

/*
 * CMS-03C-19, the scheduled governed-activation sweep (BE03c row 188, job type
 * `cms.governed_activation.execute`): claim at most 25 due schedules, then execute each with the schedule id,
 * the IMMUTABLE REVIEW version the claim carries and the lease. A failure of one execution never stops the
 * batch and nothing sensitive is logged. The sweep runs no accessibility checker and loads no evidence.
 */

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('a quiet tick', () => {
  it('claims the bounded batch once and logs only the count', async () => {
    const edge = stubEdge({ [CLAIM_RPC]: () => Response.json([]) });
    const logged = logs();
    await runProductionCmsGovernedActivationSweep(bindings);
    expect(edge.calls).toHaveLength(1);
    expect(edge.calls[0]).toMatchObject({
      name: CLAIM_RPC,
      body: { p_request: { batch: 25 } },
      headers: {
        'Accept-Profile': 'platform_api',
        'Content-Profile': 'platform_api',
        apikey: SECRET,
      },
    });
    const text = logged();
    expect(text).toContain('cms_governed_activation_sweep.completed');
    expect(text).toContain('"cms_governed_activation_claim_batch_size":0');
    expect(text).not.toContain(SECRET);
  });
});

describe('executing claims', () => {
  it('executes each claim in order with the review version and the lease, calling nothing else', async () => {
    const [first, second] = [claimFor(1), claimFor(2)];
    const edge = stubEdge({
      [CLAIM_RPC]: () => Response.json([first, second]),
      [EXECUTE_RPC]: (body) =>
        Response.json(completed(body.p_request as { scheduleId: string })),
    });
    const logged = logs();
    await runProductionCmsGovernedActivationSweep(bindings);
    expect(edge.calls.map((call) => call.name)).toEqual([
      CLAIM_RPC,
      EXECUTE_RPC,
      EXECUTE_RPC,
    ]);
    // The immutable review version of the claim, never the advancing schedule version.
    expect(edge.calls[1]!.body).toEqual({
      p_request: {
        scheduleId: first.scheduleId,
        expectedVersion: '3',
        leaseId: first.leaseId,
      },
    });
    expect(edge.calls[2]!.body).toEqual({
      p_request: {
        scheduleId: second.scheduleId,
        expectedVersion: '3',
        leaseId: second.leaseId,
      },
    });
    const text = logged();
    expect(text).toContain(
      '"cms_governed_activation_total{action=\\"activate\\",outcome=\\"completed\\",subject_kind=\\"template_version\\"}":1',
    );
    expect(text).toContain('"cms_governed_activation_claim_batch_size":2');
    expect(text).toContain('"cms_governed_activation_deviation_seconds":3');
    for (const hidden of [
      SECRET,
      first.scheduleId,
      first.leaseId,
      first.reviewId,
      first.subjectId,
    ])
      expect(text).not.toContain(hidden);
    expect(text).toContain('sha256:');
    expect(text).toContain(first.correlationId);
  });

  it('counts a blocked schedule with its closed reason and only then', async () => {
    const claim = claimFor(1, { subjectKind: 'taxonomy_version' });
    stubEdge({
      [CLAIM_RPC]: () => Response.json([claim]),
      [EXECUTE_RPC]: () =>
        Response.json({
          scheduleId: claim.scheduleId,
          outcome: 'blocked',
          reasonCode: 'canonical_source_unavailable',
          actualUtc: null,
          deviationSeconds: null,
        }),
    });
    const logged = logs();
    await runProductionCmsGovernedActivationSweep(bindings);
    const text = logged();
    expect(text).toContain(
      'cms_governed_schedule_blocked_total{reason=\\"canonical_source_unavailable\\"}',
    );
    expect(text).toContain(
      'cms_governed_activation_total{action=\\"activate\\",outcome=\\"blocked\\",subject_kind=\\"taxonomy_version\\"}',
    );
    expect(text).not.toContain('deviation_seconds');
  });

  it.each(['failed_retryable', 'already_completed'] as const)(
    'logs %s as an attempt outcome and never as blocked',
    async (outcome) => {
      const claim = claimFor(1);
      stubEdge({
        [CLAIM_RPC]: () => Response.json([claim]),
        [EXECUTE_RPC]: () =>
          Response.json({
            scheduleId: claim.scheduleId,
            outcome,
            reasonCode: null,
            actualUtc: null,
            deviationSeconds: null,
          }),
      });
      const logged = logs();
      await runProductionCmsGovernedActivationSweep(bindings);
      const text = logged();
      expect(text).toContain(`outcome=\\"${outcome}\\"`);
      expect(text).not.toContain('cms_governed_schedule_blocked_total');
      expect(text).not.toContain('execute_failed');
    },
  );

  it('keeps going after one execution fails and logs it without ids', async () => {
    const [first, second] = [claimFor(1), claimFor(2)];
    let executions = 0;
    const edge = stubEdge({
      [CLAIM_RPC]: () => Response.json([first, second]),
      [EXECUTE_RPC]: (body) => {
        executions += 1;
        return executions === 1
          ? new Response(`postgres-error:${SECRET}`, { status: 503 })
          : Response.json(completed(body.p_request as { scheduleId: string }));
      },
    });
    const logged = logs();
    await expect(
      runProductionCmsGovernedActivationSweep(bindings),
    ).resolves.toBeUndefined();
    expect(edge.calls.filter((call) => call.name === EXECUTE_RPC)).toHaveLength(
      2,
    );
    const text = logged();
    expect(text).toContain('cms_governed_activation_sweep.execute_failed');
    expect(text).toContain('DEPENDENCY_UNAVAILABLE');
    expect(text).toContain(
      '"cms_governed_activation_total{action=\\"activate\\",outcome=\\"error\\",subject_kind=\\"template_version\\"}":1',
    );
    expect(text).not.toContain('postgres-error');
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(first.scheduleId);
  });

  it('never retries an execution whose outcome is unknown (the lease and the database ladder decide)', async () => {
    const claim = claimFor(1);
    const edge = stubEdge({
      [CLAIM_RPC]: () => Response.json([claim]),
      [EXECUTE_RPC]: () => new Response('boom', { status: 500 }),
    });
    logs();
    await runProductionCmsGovernedActivationSweep(bindings);
    expect(edge.calls.filter((call) => call.name === EXECUTE_RPC)).toHaveLength(
      1,
    );
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
    [
      'a blocked result with a reason outside the closed set',
      () =>
        Response.json({
          ...completed(claimFor(1)),
          outcome: 'blocked',
          reasonCode: 'preflight_failed',
        }),
      'DEPENDENCY_INVALID_RESPONSE',
    ],
  ])(
    'logs %s as a contract fault and does not retry the execution',
    async (_name, respond, code) => {
      const edge = stubEdge({
        [CLAIM_RPC]: () => Response.json([claimFor(1)]),
        [EXECUTE_RPC]: respond,
      });
      const logged = logs();
      await runProductionCmsGovernedActivationSweep(bindings);
      expect(
        edge.calls.filter((call) => call.name === EXECUTE_RPC),
      ).toHaveLength(1);
      expect(logged()).toContain(code);
    },
  );
});

describe('claim failures', () => {
  it('requests a retry without leaking the upstream body when the claim RPC is unavailable', async () => {
    stubEdge({
      [CLAIM_RPC]: () =>
        new Response(`postgres-error:${SECRET}`, { status: 503 }),
    });
    const logged = logs();
    await expect(
      runProductionCmsGovernedActivationSweep(bindings),
    ).rejects.toThrow('CMS governed activation sweep requested retry');
    const text = logged();
    expect(text).toContain('cms_governed_activation_sweep.failed');
    expect(text).toContain('DEPENDENCY_UNAVAILABLE');
    expect(text).not.toContain('postgres-error');
  });

  it.each([
    ['a non-list', { rows: [] }],
    ['an unknown member', [{ ...claimFor(1), content: 'x' }]],
    [
      'more than the batch',
      Array.from({ length: 26 }, (_v, index) => claimFor(index % 10)),
    ],
  ])('requests a retry on %s', async (_name, reply) => {
    stubEdge({ [CLAIM_RPC]: () => Response.json(reply) });
    const logged = logs();
    await expect(
      runProductionCmsGovernedActivationSweep(bindings),
    ).rejects.toThrow('CMS governed activation sweep requested retry');
    expect(logged()).toContain('DEPENDENCY_INVALID_RESPONSE');
  });

  it('records a manual-review failure and rethrows it for a non-JSON body', async () => {
    stubEdge({
      [CLAIM_RPC]: () => new Response('not json', { status: 200 }),
    });
    const logged = logs();
    await expect(
      runProductionCmsGovernedActivationSweep(bindings),
    ).rejects.toBeInstanceOf(AsyncRpcManualReviewError);
    expect(logged()).toContain(
      'cms_governed_activation_sweep.manual_review_required',
    );
  });
});
