/**
 * Slice 11 real composition, review finding B-02 (DEC-169, BE03b "Accessibility provider" DEC-158(c)): a stale
 * accessibility proof at the real CMS-03B-20 execute RPC.
 *
 * The database refuses an old (older than 60 s either way), other-provider or mis-bound proof as the typed 409-class
 * conflict `preflight_evidence_stale` (PostgREST: 400 / P0001) and rolls the execution back, so the schedule, its
 * lease, its version and its attempt count stay exactly as the claim left them. The production sweep must therefore
 * not wait out the five-minute lease (the claim's expired-lease step would spend a retry): inside the same tick it
 * recomputes fresh checker evidence for the same claim and executes again under the same lease.
 *
 * The staleness is produced by the one honest cause the 60 s window exists for, a Worker clock that disagrees with
 * the database clock: the Worker's `Date.now` reads two minutes behind until the first execute leaves for the real
 * PostgREST stack. Nothing else is replaced: the claim, the checker input load, both executes and the verdicts are
 * the real RPCs of the production sweep module.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  PublicationScheduleResourceSchema,
  ScheduleExecutionResultSchema,
} from '@wejammin/contracts';

import {
  expectSafeEqual,
  expectStatus,
} from './support/phase-02-slice-11-assert';
import {
  approvedDraft,
  type ReviewedDraft,
} from './support/phase-02-slice-11-flow';
import {
  expectStoredEvidence,
  postSchedule,
  scheduleRow,
  sleepUntil,
  utcScheduleBody,
} from './support/phase-02-slice-11-schedule-support';
import {
  createS11Stack,
  type S11Stack,
} from './support/phase-02-slice-11-stack';
import {
  claimsOf,
  strictValue,
  tick,
  type SweepTrace,
} from './support/phase-02-slice-11-sweep-support';
import {
  prepareS11World,
  workflowEffects,
  type S11World,
} from './support/phase-02-slice-11-world';
import { psql } from './support/stack';

const LOAD = 'cms_load_quality_gate_input';
const EXECUTE = 'cms_execute_publication_schedule';
/** Two minutes: beyond the database's 60 second window in either direction. */
const WORKER_CLOCK_BEHIND_MS = 120_000;

type Subject = Readonly<{
  draft: ReviewedDraft;
  id: string;
  resolvedUtc: string;
}>;
let world: S11World;
let stack: S11Stack;
let control: Subject;
let stale: Subject;
let controlCorrelationId = '';

const schedule = async (
  title: string,
  leadMs: number,
  tzdb: string,
): Promise<Subject> => {
  const draft = await approvedDraft(stack, world, title);
  stack.as(world.publisher, 'fresh');
  const response = await postSchedule(
    stack,
    draft,
    utcScheduleBody(draft, leadMs, tzdb),
  );
  expectStatus(response, 202);
  const accepted = PublicationScheduleResourceSchema.parse(response.body);
  return { draft, id: accepted.id, resolvedUtc: accepted.resolvedUtc };
};

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  const tzdb = psql('select platform_private.cms_tzdb_version()');
  // The control falls due first and is swept alone; the stale subject falls due well after that tick has ended.
  control = await schedule('Stale proof control', 75_000, tzdb);
  stale = await schedule('Stale proof recovered', 160_000, tzdb);
}, 150_000);

/** The audit trail of one execution, by its claim's correlation id: action, decision and reason, counted. */
const auditTrail = (correlationId: string): string =>
  psql(`select coalesce(string_agg(action || '/' || decision || '/' || reason_code || ':' || n,
                        ',' order by action, decision, reason_code), '')
          from (select action, decision, reason_code, count(*) n
                  from audit_private.audit_events
                 where correlation_id = '${correlationId}'
                 group by action, decision, reason_code) trail`);

const exchanges = (trace: SweepTrace, rpc: string, scheduleId: string) =>
  trace.filter(
    (item) => item.rpc === rpc && item.request.scheduleId === scheduleId,
  );

describe('CMS-03B-20 stale accessibility proof through the real RPCs', () => {
  it('[CMS-03B-20] a clean tick completes the control publication with one proof and one execution', async () => {
    await sleepUntil(control.resolvedUtc);
    const trace = await tick();
    const claim = claimsOf(trace).find(
      (item) => item.scheduleId === control.id,
    );
    if (claim === undefined) throw new Error('control claim missing');
    controlCorrelationId = claim.correlationId;
    expect(exchanges(trace, LOAD, control.id)).toHaveLength(1);
    const [only] = exchanges(trace, EXECUTE, control.id);
    expect(only?.status).toBe(200);
    expect(
      strictValue(ScheduleExecutionResultSchema, only?.response).outcome,
    ).toBe('completed');
    expectStoredEvidence(trace, control.id);
    expect(scheduleRow(control.id)).toMatch(/^completed\/[0-9]+\/0\/-$/u);
    expect(workflowEffects(control.draft.entryId).publications).toBe(1);
  }, 150_000);

  it('[CMS-03B-20] a proof the database refuses as stale is recomputed and the same claim completes under the same lease with the attempt count unchanged', async () => {
    await sleepUntil(stale.resolvedUtc);
    const realNow = Date.now.bind(Date);
    const clock = vi
      .spyOn(Date, 'now')
      .mockImplementation(() => realNow() - WORKER_CLOCK_BEHIND_MS);
    const between: string[] = [];
    let claimedVersion = '';
    let claimedLease = '';
    let executions = 0;
    let trace: SweepTrace;
    try {
      trace = await tick([], async (request) => {
        if (request.scheduleId !== stale.id) return;
        executions += 1;
        if (executions === 1) {
          // The first proof was computed on the skewed clock; from here the Worker agrees with the database.
          clock.mockRestore();
          claimedVersion = String(request.expectedVersion);
          claimedLease = String(request.leaseId);
          return;
        }
        // Between the refused execute and the second: the refusal rolled back, so the claim's row and lease stand.
        between.push(
          scheduleRow(stale.id),
          psql(`select (lease_id = '${claimedLease}' and lease_until > clock_timestamp())::text
                  from platform_private.cms_publication_schedules where id = '${stale.id}'`),
        );
      });
    } finally {
      clock.mockRestore();
    }

    const claim = claimsOf(trace).find((item) => item.scheduleId === stale.id);
    if (claim === undefined) throw new Error('stale subject claim missing');
    expect(executions).toBe(2);
    expectSafeEqual(
      between,
      [`executing/${claim.scheduleVersion}/0/-`, 'true'],
      'the refused execution left the claimed row, its attempt count and its lease untouched',
    );

    // Wire shape: proof, execute (refused), proof, execute (accepted); same claim operands each time.
    const loads = exchanges(trace, LOAD, stale.id);
    const executes = exchanges(trace, EXECUTE, stale.id);
    expect(loads).toHaveLength(2);
    expect(executes).toHaveLength(2);
    const [load1, load2] = loads;
    const [refused, accepted] = executes;
    if (!load1 || !load2 || !refused || !accepted)
      throw new Error('stale exchanges missing');
    expect(load1.finished).toBeLessThan(refused.started);
    expect(refused.finished).toBeLessThan(load2.started);
    expect(load2.finished).toBeLessThan(accepted.started);
    for (const load of loads)
      expectSafeEqual(
        load.request,
        {
          phase: 'execute',
          scheduleId: claim.scheduleId,
          revisionId: claim.revisionId,
          dependencyHash: claim.dependencyHash,
        },
        'every proof is computed for the actual claim operands',
      );
    for (const execute of executes)
      expectSafeEqual(
        {
          scheduleId: execute.request.scheduleId,
          expectedVersion: execute.request.expectedVersion,
          leaseId: execute.request.leaseId,
        },
        {
          scheduleId: claim.scheduleId,
          expectedVersion: claim.scheduleVersion,
          leaseId: claim.leaseId,
        },
        'both executions use the claim CAS and lease',
      );
    expect(claimedVersion).toBe(claim.scheduleVersion);
    expect(claimedLease).toBe(claim.leaseId);

    // The refusal is the database's typed conflict, as PostgREST answers a P0001 raise.
    expect(refused.status).toBe(400);
    expect(refused.response).toMatchObject({
      code: 'P0001',
      message: 'preflight_evidence_stale',
    });
    expect(accepted.status).toBe(200);
    const result = strictValue(
      ScheduleExecutionResultSchema,
      accepted.response,
    );
    expect(result.outcome).toBe('completed');
    expect(result.scheduleId).toBe(stale.id);

    // The recomputed proof is a fresh object of the same checker for the same bytes.
    const proof = (execute: typeof refused) =>
      execute.request.evidence as {
        providerKey: string;
        evaluatedAt: string;
        bindingHash: string;
        inputHash: string;
        outcome: string;
      };
    expect(proof(accepted).outcome).toBe('healthy');
    expect(proof(accepted).bindingHash).toBe(proof(refused).bindingHash);
    expect(proof(accepted).inputHash).toBe(proof(refused).inputHash);
    expect(
      Date.parse(proof(accepted).evaluatedAt) -
        Date.parse(proof(refused).evaluatedAt),
    ).toBeGreaterThan(WORKER_CLOCK_BEHIND_MS - 30_000);
    expect(
      Math.abs(Date.parse(proof(accepted).evaluatedAt) - Date.now()),
    ).toBeLessThan(60_000);
    // The stored audit summary is the ACCEPTED proof's, once: the refused execution wrote nothing.
    expect(
      psql(`select count(*) from platform_private.cms_command_accessibility_evidence
             where subject_id = '${stale.id}' and operation_id = 'CMS-03B-20'
               and revision_id = '${claim.revisionId}' and correlation_id = '${claim.correlationId}'
               and checker_key = '${proof(accepted).providerKey}'
               and outcome = 'healthy' and input_hash = '${proof(accepted).inputHash}'`),
    ).toBe('1');

    // Durable state: one completion, attempt_count still 0, and exactly the effects of the clean control tick.
    expect(scheduleRow(stale.id)).toMatch(/^completed\/[0-9]+\/0\/-$/u);
    expect(workflowEffects(stale.draft.entryId)).toEqual(
      workflowEffects(control.draft.entryId),
    );
    expect(workflowEffects(stale.draft.entryId).publications).toBe(1);
    expect(
      psql(`select count(*) from platform_private.cms_command_accessibility_evidence
             where subject_id = '${stale.id}' and operation_id = 'CMS-03B-20'`),
    ).toBe('1');
    const staleTrail = auditTrail(claim.correlationId);
    expect(staleTrail).not.toBe('');
    expect(staleTrail).toBe(auditTrail(controlCorrelationId));
  }, 300_000);
});
