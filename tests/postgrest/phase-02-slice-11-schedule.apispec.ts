/**
 * Slice 11 real composition, scheduling (lane S11-4R): CMS-03B-07 through the production
 * Worker route and adapter, and the CMS-03B-20 sweep (claim -> Worker accessibility checker
 * -> execute) through the production sweep module and the real internal RPCs.
 *
 * The browser half proves the Worker time authority (E8) and the database re-checks
 * (horizon, publisher authority) agree end to end. The sweep half schedules real approved
 * reviews ~75 s ahead (the database minimum is 60 s), lets them fall due, and runs the
 * production tick: the Worker's checker evidence must be accepted by the database
 * (completed publication), a missing proof must be failed_retryable (never a pass), and a
 * lapsed publisher grant must block with publisher_authority_ended.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PublicationScheduleResourceSchema } from '@wejammin/contracts';

import type { AsyncWorkerBindings } from '../../apps/worker/src/async-entrypoint';
import { runProductionCmsPublicationScheduleSweep } from '../../apps/worker/src/cms-publication-schedule-sweep';
import {
  expectEvidenceNull,
  expectEvidencePresent,
  expectSafeError,
  expectSameInstant,
  expectStatus,
  expectUnchanged,
  resourceDigest,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  type ReviewedDraft,
  approvedDraft,
} from './support/phase-02-slice-11-flow';
import {
  SCHEDULES,
  postSchedule,
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
  reservationCount,
  workflowEffects,
} from './support/phase-02-slice-11-world';
import { API_URL, psql, workerServiceCredential } from './support/stack';

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

const sweepEnvironment = {
  SUPABASE_URL: API_URL,
  SUPABASE_SECRET_KEY: workerServiceCredential(),
  APP_ENVIRONMENT: 'development',
  APP_RELEASE: 'slice-11-api',
} as unknown as AsyncWorkerBindings;

/** One CMS-03B-20 execute command observed at the composition boundary. */
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

/** One production sweep tick; `failLoadFor` makes the load RPC of those schedules a transport 503. */
const tick = async (failLoadFor: readonly string[] = []): Promise<void> => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input instanceof Request ? input.url : input);
    const body = String(init?.body ?? '');
    if (url.endsWith('/rpc/cms_execute_publication_schedule')) {
      const request = (
        JSON.parse(body) as { p_request?: Record<string, unknown> }
      ).p_request as Record<string, unknown>;
      sweepExecutes.push({
        scheduleId: String(request.scheduleId),
        expectedVersion: String(request.expectedVersion),
        leaseId: String(request.leaseId),
        evidencePresent:
          typeof request.evidence === 'object' && request.evidence !== null,
        evidenceNull: 'evidence' in request && request.evidence === null,
      });
    }
    if (
      url.endsWith('/rpc/cms_load_quality_gate_input') &&
      failLoadFor.some((id) => body.includes(id))
    )
      return new Response('{"message":"upstream unavailable"}', {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    return original(input, init);
  }) as typeof fetch;
  try {
    await runProductionCmsPublicationScheduleSweep(sweepEnvironment);
  } finally {
    globalThis.fetch = original;
  }
};

const sleepUntil = async (iso: string): Promise<void> => {
  const wait = Date.parse(iso) - Date.now() + 1_500;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
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
  // The three sweep subjects are scheduled FIRST so their ~75 s fuse burns while the
  // browser tests below run.
  dueOk = await scheduleDue(world.publisher, 'Sweep completes');
  dueRetry = await scheduleDue(world.publisher, 'Sweep retries');
  dueLapsed = await scheduleDue(world.publisher2, 'Sweep lapses');
}, 120_000);

afterEach(() => {
  stack.breakRpc(null);
});

describe('CMS-03B-07 schedule through the real stack', () => {
  it('[CMS-03B-07] accepts a future UTC schedule (202 scheduled, never published; Location; strong ETag) and a replay adds nothing', async () => {
    const draft = await approvedDraft(stack, world, 'Schedule subject');
    stack.as(world.publisher, 'fresh');
    const body = utcBody(draft, 2 * 86_400_000);
    const key = `schedule-${draft.entryId}`;
    const before = reservationCount();
    stack.clearRpcs();
    const response = await schedule(draft, body, { key });
    expectStatus(response, 202);
    const resource = PublicationScheduleResourceSchema.parse(response.body);
    expect(resource.state).toBe('pending');
    expect(resource.localDateTime).toBe(body.localDateTime);
    expect(resource.resolvedUtc.slice(0, 19)).toBe(body.localDateTime);
    expect(response.headers.get('location')).toBe(
      `${SCHEDULES}/${resource.id}`,
    );
    expect(response.headers.get('etag')).toBe(`"${resource.version}"`);
    expect(workflowEffects(draft.entryId)).toMatchObject({
      schedules: 1,
      publications: 0,
    });
    const sent = stack
      .rpcs()
      .find((rpc) => rpc.rpc === 'cms_schedule_publication');
    expect(sent?.request.tzdbVersion).toBe(tzdb);
    expectEvidencePresent(sent?.request ?? {});
    expect(reservationCount()).toBe(before + 1);

    stack.clearRpcs();
    const replay = await schedule(draft, body, { key });
    expectStatus(replay, 202);
    expect(resourceDigest(replay.body)).toBe(resourceDigest(response.body));
    expect(
      stack.rpcs().find((rpc) => rpc.rpc === 'cms_schedule_publication')
        ?.replayHeader,
    ).toBe('true');
    expect(workflowEffects(draft.entryId).schedules).toBe(1);
  });

  it('[CMS-03B-07] a non-UTC zone and the earlier instant of a fold round-trip through the Worker time authority and the database sanity bounds', async () => {
    const berlin = await approvedDraft(stack, world, 'Berlin subject');
    const fold = await approvedDraft(stack, world, 'Fold subject');
    stack.as(world.publisher, 'fresh');
    const ordinary = await schedule(berlin, {
      ...utcBody(berlin, 0),
      localDateTime: '2026-12-01T09:00:00',
      timezone: 'Europe/Berlin',
      resolvedUtc: '2026-12-01T08:00:00Z',
    });
    expectStatus(ordinary, 202);
    const ordinaryResource = PublicationScheduleResourceSchema.parse(
      ordinary.body,
    );
    expect(ordinaryResource.timezone).toBe('Europe/Berlin');
    // The selected UTC instant is what the time authority resolved: 09:00 Berlin on
    // 2026-12-01 is 08:00Z. Compare by instant value, not by ISO string spelling (the
    // strict schema permits a second- or millisecond-precision offset instant).
    expectSameInstant(
      ordinaryResource.resolvedUtc,
      '2026-12-01T08:00:00Z',
      'Europe/Berlin 09:00 resolves to 08:00Z',
    );
    expect(ordinaryResource.localDateTime).toBe('2026-12-01T09:00:00');
    const earlier = await schedule(fold, {
      ...utcBody(fold, 0),
      localDateTime: '2026-11-01T01:30:00',
      timezone: 'America/New_York',
      resolvedUtc: '2026-11-01T05:30:00Z',
      disambiguation: 'earlier',
    });
    expectStatus(earlier, 202);
  });

  it('[CMS-03B-07] a nonexistent local time is the Worker 422 with its two alternatives and reaches no RPC', async () => {
    const draft = await approvedDraft(stack, world, 'Gap subject');
    stack.as(world.publisher, 'fresh');
    stack.clearRpcs();
    const response = await schedule(draft, {
      ...utcBody(draft, 0),
      localDateTime: '2027-03-14T02:30:00',
      timezone: 'America/New_York',
      resolvedUtc: '2027-03-14T07:30:00Z',
    });
    expectStatus(response, 422);
    expect(response.body.details).toMatchObject({
      reasonCode: 'nonexistent_local_time',
      alternatives: [{ localDateTime: expect.any(String) }, expect.any(Object)],
    });
    expect(
      stack.rpcs().filter((rpc) => rpc.rpc === 'cms_schedule_publication'),
    ).toEqual([]);
  });

  it('[CMS-03B-07] a missing, stale or future-dated step-up is 401 before any RPC and reserves nothing', async () => {
    const draft = await approvedDraft(stack, world, 'Schedule step-up');
    for (const proof of ['none', 'stale', 'future'] as const) {
      stack.as(world.publisher, proof);
      stack.clearRpcs();
      const before = reservationCount();
      const response = await schedule(draft, utcBody(draft, 2 * 86_400_000));
      expectStatus(response, 401, proof);
      expect(response.body.code).toBe('STEP_UP_REQUIRED');
      expect(stack.rpcs()).toEqual([]);
      expect(reservationCount()).toBe(before);
    }
  });

  it('[CMS-03B-07] the database horizon is 422 schedule_out_of_horizon with minUtc and maxUtc', async () => {
    const draft = await approvedDraft(stack, world, 'Horizon subject');
    stack.as(world.publisher, 'fresh');
    const soon = await schedule(draft, utcBody(draft, 20_000));
    expectStatus(soon, 422);
    expect(soon.body.details).toMatchObject({
      reasonCode: 'schedule_out_of_horizon',
      minUtc: expect.stringMatching(/Z$/u),
      maxUtc: expect.stringMatching(/Z$/u),
    });
    expect(workflowEffects(draft.entryId).schedules).toBe(0);
  });

  it('[CMS-03B-07] a publisher whose grant ends before the schedule is 422 authority_ends_before_schedule', async () => {
    const draft = await approvedDraft(stack, world, 'Authority subject');
    stack.as(world.shortPublisher, 'fresh');
    const response = await schedule(draft, utcBody(draft, 4 * 86_400_000));
    expectStatus(response, 422);
    expect(response.body.details).toMatchObject({
      reasonCode: 'authority_ends_before_schedule',
    });
    expect(workflowEffects(draft.entryId).schedules).toBe(0);
  });

  it('[CMS-03B-07] an unavailable accessibility proof is 503 with Retry-After and no schedule', async () => {
    const draft = await approvedDraft(stack, world, 'Schedule proof');
    stack.as(world.publisher, 'fresh');
    stack.breakRpc('cms_load_quality_gate_input');
    stack.clearRpcs();
    const beforeSnapshot = snapshotDigest();
    const response = await schedule(draft, utcBody(draft, 2 * 86_400_000));
    // Strict safe ApiError: exact status/code/closed details, no-store and MIME
    // boundary, with only booleans/digests in any failure diagnostic.
    expectSafeError(response, {
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      details: { dependencyClass: 'preflight', retryable: true },
      retryAfter: true,
    });
    // Full 14-group effect snapshot is unchanged (no schedule committed).
    expectUnchanged(
      beforeSnapshot,
      snapshotDigest(),
      'the CMS-03B-07 outage commits no durable effect',
    );
    // The genuine schedule RPC was issued with its OWN evidence member exactly
    // null (an unavailable checker proof, not an absent member).
    const wire = stack
      .rpcs()
      .find((rpc) => rpc.rpc === 'cms_schedule_publication');
    expect(wire).toBeDefined();
    expectEvidenceNull(wire?.request ?? {});
  });
});

describe('CMS-03B-20 sweep through the real RPCs', () => {
  it('[CMS-03B-20] the tick executes due schedules: real checker evidence completes one publication, a missing proof is failed_retryable (never a pass) and a lapsed publisher grant blocks', async () => {
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
