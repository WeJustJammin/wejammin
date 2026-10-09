/**
 * Slice 11 real composition, scheduling (lane S11-4R): CMS-03B-07 through the production
 * Worker route and adapter, and the CMS-03B-20 sweep (claim -> Worker accessibility checker
 * -> execute) through the production sweep module and the real internal RPCs.
 *
 * The browser time cases live in schedule-time. This suite schedules real approved
 * reviews ~75 s ahead (the database minimum is 60 s), lets them fall due, and runs the
 * production tick: the Worker's checker evidence must be accepted by the database
 * (completed publication), a missing proof must be failed_retryable (never a pass), and a
 * lapsed publisher grant must block with publisher_authority_ended.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PublicationScheduleResourceSchema } from '@wejammin/contracts';

import {
  claimsOf,
  executionOf,
  expectOperandChain,
  tick as observedTick,
  type SweepTrace,
} from './support/phase-02-slice-11-sweep-support';
import {
  expectEvidenceNull,
  expectStatus,
} from './support/phase-02-slice-11-assert';
import {
  type ReviewedDraft,
  approvedDraft,
} from './support/phase-02-slice-11-flow';
import {
  postSchedule,
  expectStoredEvidence,
  sleepUntil,
  scheduleRow,
  utcScheduleBody,
} from './support/phase-02-slice-11-schedule-support';
import {
  type S11Actor,
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';
import {
  type S11World,
  prepareS11World,
  workflowEffects,
} from './support/phase-02-slice-11-world';
import { psql } from './support/stack';

let world: S11World;
let stack: S11Stack;
let tzdb = '';

/** A UTC schedule request `leadMs` from now, pinned to this run's tzdb version. */
const utcBody = (
  draft: ReviewedDraft,
  leadMs: number,
  over: Record<string, unknown> = {},
) => utcScheduleBody(draft, leadMs, tzdb, over);

const schedule = (
  draft: ReviewedDraft,
  body: Record<string, unknown>,
  options: { key?: string; ifMatch?: string } = {},
) => postSchedule(stack, draft, body, options);

let lastTrace: SweepTrace = [];
type SweepExecute = Readonly<{
  scheduleId: string;
  expectedVersion: string;
  leaseId: string;
  evidencePresent: boolean;
  evidenceNull: boolean;
}>;
const sweepExecutes: SweepExecute[] = [];
const firstExecute = (scheduleId: string): SweepExecute | undefined =>
  sweepExecutes.find((execute) => execute.scheduleId === scheduleId);
const tick = async (failLoadFor: readonly string[] = []): Promise<void> => {
  lastTrace = await observedTick(failLoadFor);
  expectOperandChain(lastTrace);
  for (const claim of claimsOf(lastTrace)) {
    const { request } = executionOf(lastTrace, claim.scheduleId);
    sweepExecutes.push({
      scheduleId: request.scheduleId,
      expectedVersion: request.expectedVersion,
      leaseId: request.leaseId,
      evidencePresent: request.evidence !== null,
      evidenceNull:
        Object.hasOwn(request, 'evidence') && request.evidence === null,
    });
  }
};

type Due = Readonly<{ draft: ReviewedDraft; id: string; resolvedUtc: string }>;
let dueOk: Due;
let dueRetry: Due;
let dueLapsed: Due;

const scheduleDue = async (actor: S11Actor, title: string): Promise<Due> => {
  const draft = await approvedDraft(stack, world, title);
  stack.as(actor, 'fresh');
  const response = await schedule(draft, utcBody(draft, 75_000));
  expectStatus(response, 202);
  const resource = PublicationScheduleResourceSchema.parse(response.body);
  return { draft, id: resource.id, resolvedUtc: resource.resolvedUtc };
};

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  tzdb = psql('select platform_private.cms_tzdb_version()');
  // Preserve the original three sweep subjects and assertions after the feature split.
  dueOk = await scheduleDue(world.publisher, 'Sweep completes');
  dueRetry = await scheduleDue(world.publisher, 'Sweep retries');
  dueLapsed = await scheduleDue(world.publisher2, 'Sweep lapses');
}, 120_000);

afterEach(() => {
  stack.breakRpc(null);
});

describe('CMS-03B-20 sweep through the real RPCs', () => {
  it('[CMS-03B-20] the tick executes due schedules: real checker evidence completes one publication, a missing proof is failed_retryable (never a pass) and a lapsed publisher grant blocks', async () => {
    // Inherited synthetic grant projection fixture. This branch is not public
    // grant/revoke acceptance: the shared world has no bound CMS-03A owner MFA.
    psql(
      `update identity_private.organization_actor_grant set active = false
        where person_id = '${world.publisher2.personId}' and capability_code = 'cms.publisher'`,
    );
    await sleepUntil(
      [dueOk, dueRetry, dueLapsed]
        .map((due) => due.resolvedUtc)
        .sort()
        .at(-1) as string,
    );
    await tick([dueRetry.id]);

    expectStoredEvidence(lastTrace, dueOk.id);
    for (const [due, outcome, reasonCode] of [
      [dueOk, 'completed', null],
      [dueRetry, 'failed_retryable', null],
      [dueLapsed, 'blocked', 'publisher_authority_ended'],
    ] as const) {
      const { result } = executionOf(lastTrace, due.id);
      expect(result.outcome).toBe(outcome);
      expect(result.reasonCode).toBe(reasonCode);
      if (outcome !== 'completed') {
        expect(result.publicationVersionId).toBeNull();
        expect(result.actualUtc).toBeNull();
        expect(result.deviationSeconds).toBeNull();
      }
    }
    expect(scheduleRow(dueOk.id)).toMatch(/^completed\/[0-9]+\/0\/-$/u);
    expect(workflowEffects(dueOk.draft.entryId).publications).toBe(1);
    expect(
      psql(
        `select outcome from platform_private.cms_command_accessibility_evidence
          where subject_id = '${dueOk.id}' and operation_id = 'CMS-03B-20'`,
      ),
    ).toBe('healthy');

    expect(scheduleRow(dueRetry.id)).toMatch(/^failed_retryable\/[0-9]+\/1\//u);
    expect(workflowEffects(dueRetry.draft.entryId).publications).toBe(0);

    expect(scheduleRow(dueLapsed.id)).toMatch(
      /^blocked\/[0-9]+\/[0-9]+\/publisher_authority_ended$/u,
    );
    expect(workflowEffects(dueLapsed.draft.entryId).publications).toBe(0);

    // Command-wire trace (composition boundary): the healthy schedule's execute carries a
    // PRESENT Worker evidence object, the outage schedule's carries an EXACT null (never
    // undefined), and each execute is fenced by the claim's version and lease id.
    const okExecute = firstExecute(dueOk.id);
    expect(okExecute).toBeDefined();
    expect(okExecute?.evidencePresent).toBe(true);
    expect(okExecute?.expectedVersion).toMatch(/^[0-9]+$/u);
    expect(okExecute?.leaseId).toMatch(/^[0-9a-f-]{36}$/u);
    const retryExecute = firstExecute(dueRetry.id);
    expect(retryExecute).toBeDefined();
    expectEvidenceNull({
      evidence: retryExecute?.evidenceNull === true ? null : undefined,
    });
  }, 150_000);

  it('[CMS-03B-20] a second tick inside the 15 s retry delay claims nothing; after it the retried schedule completes with real evidence', async () => {
    const [, versionBefore] = scheduleRow(dueRetry.id).split('/');
    await tick();
    expect(scheduleRow(dueRetry.id)).toMatch(/^failed_retryable\//u);
    expect(scheduleRow(dueRetry.id).split('/')[1]).toBe(versionBefore);

    await new Promise((resolve) => setTimeout(resolve, 16_000));
    await tick();
    expect(scheduleRow(dueRetry.id)).toMatch(/^completed\/[0-9]+\/1\//u);
    expect(workflowEffects(dueRetry.draft.entryId).publications).toBe(1);
  }, 60_000);

  it('[CMS-03B-15] the workflow read of a swept entry lists the completed schedule and its publication', async () => {
    stack.as(world.owner);
    const read = await stack.get(
      `/api/v1/cms/entries/${dueOk.draft.entryId}/workflow`,
    );
    expectStatus(read, 200);
    expect(read.body.schedules).toMatchObject([
      { id: dueOk.id, state: 'completed' },
    ]);
    expect((read.body.publications as unknown[]).length).toBe(1);
  });
});
