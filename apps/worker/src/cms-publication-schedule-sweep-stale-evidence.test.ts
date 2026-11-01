import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { cleanInput } from './cms-editorial/a11y-structural/a11y-structural.test-support';
import { runProductionCmsPublicationScheduleSweep } from './cms-publication-schedule-sweep';

/*
 * P2-S11-AC-097 / review finding B-02 (DEC-169, BE03b "Accessibility provider" DEC-158(c)): a stale or mis-bound
 * accessibility proof is the typed conflict `preflight_evidence_stale`. The database rolls the execution back, so the
 * schedule, its lease, its version and its attempt count stay exactly as the claim left them. The sweep therefore
 * does not wait out the five-minute lease (which would spend a retry through the claim's expired-lease step): inside
 * the same 15,000 ms job it recomputes fresh checker evidence for the same claim and executes again under the same,
 * still valid lease. The re-execution is bounded, never fires once the job deadline has passed, and any other
 * failure keeps the old rule (the outcome is unknown, the lease and the database ladder decide).
 */

const secret = 'sb_secret_schedule_sweep_stale_test_only';
const bindings = {
  APP_ENVIRONMENT: 'production',
  APP_RELEASE: 'test-release',
  SUPABASE_SECRET_KEY: secret,
  SUPABASE_URL: 'https://schedule-sweep.example.supabase.co/',
} as unknown as AsyncWorkerBindings;

const gate = cleanInput();
const claimFor = (index: number) => ({
  scheduleId: `123e4567-e89b-42d3-a456-42661417400${index}`,
  revisionId: gate.revisionId,
  scheduleVersion: String(index + 1),
  expectedVersion: '2',
  leaseId: `223e4567-e89b-42d3-a456-42661417400${index}`,
  dependencyHash: gate.dependencyHash,
  activationEvidenceHash: 'b'.repeat(64),
  correlationId: `323e4567-e89b-42d3-a456-42661417400${index}`,
});
const completed = (scheduleId: string) => ({
  scheduleId,
  outcome: 'completed',
  reasonCode: null,
  publicationVersionId: '423e4567-e89b-42d3-a456-426614174000',
  actualUtc: '2026-11-01T14:30:03Z',
  deviationSeconds: 3,
});
const refusal = (message: string, status = 400) =>
  new Response(
    JSON.stringify({ code: 'P0001', details: null, hint: null, message }),
    { status, headers: { 'content-type': 'application/json' } },
  );
const stale = () => refusal('preflight_evidence_stale');

type Call = Readonly<{ name: string; body: Record<string, unknown> }>;
type Handler = (
  body: Record<string, unknown>,
  calls: readonly Call[],
) => Response | Promise<Response>;

const stubEdge = (handlers: Readonly<Record<string, Handler>>) => {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const name = String(input).split('/rpc/')[1] as string;
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ name, body });
      const handler = handlers[name];
      if (handler === undefined) throw new Error(`unexpected ${name}`);
      return handler(body, calls);
    }),
  );
  return calls;
};

const logs = () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return () => JSON.stringify([...info.mock.calls, ...error.mock.calls]);
};

const names = (calls: readonly Call[]) => calls.map((call) => call.name);
const executes = (calls: readonly Call[]) =>
  calls
    .filter((call) => call.name === 'cms_execute_publication_schedule')
    .map((call) => call.body.p_request as Record<string, unknown>);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('a stale accessibility proof at execution', () => {
  it('recomputes fresh checker evidence and executes the same claim again under the same lease', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T14:30:00.000Z'));
    const claim = claimFor(1);
    let attempt = 0;
    const calls = stubEdge({
      cms_claim_due_publication_schedules: () => Response.json([claim]),
      cms_load_quality_gate_input: () => Response.json(gate),
      cms_execute_publication_schedule: () => {
        attempt += 1;
        if (attempt === 1) {
          // The database refused the first proof; a second later the checker proves the same claim again.
          vi.setSystemTime(new Date('2026-11-01T14:30:01.000Z'));
          return stale();
        }
        return Response.json(completed(claim.scheduleId));
      },
    });
    const logged = logs();

    await expect(
      runProductionCmsPublicationScheduleSweep(bindings),
    ).resolves.toBeUndefined();

    expect(names(calls)).toEqual([
      'cms_claim_due_publication_schedules',
      'cms_load_quality_gate_input',
      'cms_execute_publication_schedule',
      'cms_load_quality_gate_input',
      'cms_execute_publication_schedule',
    ]);
    const [first, second] = executes(calls);
    for (const request of [first, second])
      expect(request).toMatchObject({
        scheduleId: claim.scheduleId,
        expectedVersion: '2',
        leaseId: claim.leaseId,
      });
    const evidence = (request: Record<string, unknown> | undefined) =>
      request?.evidence as { evaluatedAt: string; bindingHash: string };
    expect(evidence(second).bindingHash).toBe(evidence(first).bindingHash);
    expect(Date.parse(evidence(second).evaluatedAt)).toBeGreaterThan(
      Date.parse(evidence(first).evaluatedAt),
    );
    const text = logged();
    expect(text).toContain('cms_publication_schedule_sweep.evidence_stale');
    expect(text).toContain('"attempt":1');
    expect(text).toContain(
      '"cms_schedule_attempt_total{outcome=\\"completed\\"}":1',
    );
    expect(text).not.toContain('cms_publication_schedule_sweep.execute_failed');
    for (const hidden of [secret, claim.scheduleId, claim.leaseId])
      expect(text).not.toContain(hidden);
  });

  it('re-executes at most twice more, then leaves the schedule to its lease and carries on with the batch', async () => {
    const [first, second] = [claimFor(1), claimFor(2)];
    const calls = stubEdge({
      cms_claim_due_publication_schedules: () => Response.json([first, second]),
      cms_load_quality_gate_input: () => Response.json(gate),
      cms_execute_publication_schedule: (body) =>
        (body.p_request as { scheduleId: string }).scheduleId ===
        first.scheduleId
          ? stale()
          : Response.json(completed(second.scheduleId)),
    });
    const logged = logs();

    await expect(
      runProductionCmsPublicationScheduleSweep(bindings),
    ).resolves.toBeUndefined();

    expect(names(calls)).toEqual([
      'cms_claim_due_publication_schedules',
      // first schedule: the proof, then two recomputations
      'cms_load_quality_gate_input',
      'cms_execute_publication_schedule',
      'cms_load_quality_gate_input',
      'cms_execute_publication_schedule',
      'cms_load_quality_gate_input',
      'cms_execute_publication_schedule',
      // second schedule: untouched by the first one's failure
      'cms_load_quality_gate_input',
      'cms_execute_publication_schedule',
    ]);
    expect(executes(calls).map((request) => request.scheduleId)).toEqual([
      first.scheduleId,
      first.scheduleId,
      first.scheduleId,
      second.scheduleId,
    ]);
    const text = logged();
    expect(
      text.match(/cms_publication_schedule_sweep\.evidence_stale/gu),
    ).toHaveLength(2);
    expect(text).toContain('cms_publication_schedule_sweep.execute_failed');
    expect(text).toContain('preflight_evidence_stale');
    expect(text).toContain('"retryable":true');
    expect(text).toContain(
      '"cms_schedule_attempt_total{outcome=\\"completed\\"}":1',
    );
    expect(text).not.toContain(first.scheduleId);
    expect(text).not.toContain(secret);
  });

  it('sends no proof on the re-execution when the checker cannot produce one, so the database ladder takes the unavailable outcome', async () => {
    const claim = claimFor(1);
    let loads = 0;
    let attempt = 0;
    const calls = stubEdge({
      cms_claim_due_publication_schedules: () => Response.json([claim]),
      cms_load_quality_gate_input: () => {
        loads += 1;
        return loads === 1
          ? Response.json(gate)
          : new Response('{}', {
              status: 404,
              headers: { 'content-type': 'application/json' },
            });
      },
      cms_execute_publication_schedule: () => {
        attempt += 1;
        return attempt === 1
          ? stale()
          : Response.json({
              scheduleId: claim.scheduleId,
              outcome: 'failed_retryable',
              reasonCode: null,
              publicationVersionId: null,
              actualUtc: null,
              deviationSeconds: null,
            });
      },
    });
    logs();

    await runProductionCmsPublicationScheduleSweep(bindings);

    const [first, second] = executes(calls);
    expect(first?.evidence).not.toBeNull();
    expect(second).toMatchObject({ leaseId: claim.leaseId, evidence: null });
  });

  it.each([
    ['another typed conflict', () => refusal('CONFLICT')],
    ['a lease conflict reason', () => refusal('version_set_stale')],
    ['an unavailable database', () => new Response('x', { status: 503 })],
    [
      'a stale token on a server error',
      () => refusal('preflight_evidence_stale', 500),
    ],
  ])(
    'does not re-execute after %s: the outcome is unknown and the lease decides',
    async (_name, respond) => {
      const claim = claimFor(1);
      const calls = stubEdge({
        cms_claim_due_publication_schedules: () => Response.json([claim]),
        cms_load_quality_gate_input: () => Response.json(gate),
        cms_execute_publication_schedule: respond,
      });
      const logged = logs();
      await runProductionCmsPublicationScheduleSweep(bindings);
      expect(executes(calls)).toHaveLength(1);
      expect(
        names(calls).filter((name) => name === 'cms_load_quality_gate_input'),
      ).toHaveLength(1);
      expect(logged()).toContain(
        'cms_publication_schedule_sweep.execute_failed',
      );
    },
  );

  it('never recomputes past the 15,000 ms job deadline: a proof still being loaded when it passes ends the claim without another execution', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const claim = claimFor(1);
    const reached = (): { promise: Promise<void>; done: () => void } => {
      let done: () => void = () => undefined;
      const promise = new Promise<void>((resolve) => {
        done = resolve;
      });
      return { promise, done };
    };
    const executeStarted = reached();
    const secondLoadStarted = reached();
    let loads = 0;
    const calls = stubEdge({
      cms_claim_due_publication_schedules: () => Response.json([claim]),
      cms_load_quality_gate_input: () => {
        loads += 1;
        if (loads === 1) return Response.json(gate);
        // The second proof's input load never answers.
        secondLoadStarted.done();
        return new Promise<Response>(() => undefined) as unknown as Response;
      },
      cms_execute_publication_schedule: () => {
        executeStarted.done();
        // The database refuses the proof 14,900 ms into the job.
        return new Promise<Response>((resolve) => {
          setTimeout(() => resolve(stale()), 14_900);
        }) as unknown as Response;
      },
    });
    const logged = logs();
    const sweep = runProductionCmsPublicationScheduleSweep(bindings);

    await executeStarted.promise;
    await vi.advanceTimersByTimeAsync(14_900);
    await secondLoadStarted.promise;
    expect(names(calls)).toEqual([
      'cms_claim_due_publication_schedules',
      'cms_load_quality_gate_input',
      'cms_execute_publication_schedule',
      'cms_load_quality_gate_input',
    ]);
    await vi.advanceTimersByTimeAsync(100);
    await sweep;

    expect(executes(calls)).toHaveLength(1);
    const text = logged();
    expect(text).toContain('cms_publication_schedule_sweep.evidence_stale');
    expect(text).toContain('cms_publication_schedule_sweep.execute_failed');
    expect(text).toContain('preflight_evidence_stale');
    expect(text).toContain('cms_publication_schedule_sweep.completed');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never reuses the stale evidence object: each execution carries its own proof', async () => {
    const claim = claimFor(1);
    let attempt = 0;
    const calls = stubEdge({
      cms_claim_due_publication_schedules: () => Response.json([claim]),
      cms_load_quality_gate_input: () => Response.json(gate),
      cms_execute_publication_schedule: () => {
        attempt += 1;
        return attempt === 1
          ? stale()
          : Response.json(completed(claim.scheduleId));
      },
    });
    logs();
    await runProductionCmsPublicationScheduleSweep(bindings);
    const [first, second] = executes(calls);
    expect(first?.evidence).not.toBe(second?.evidence);
    expect(second?.evidence).toMatchObject({
      category: 'accessibility',
      outcome: 'healthy',
    });
  });
});
