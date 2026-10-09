/** CMS-03B-07 through the production Worker and real PostgREST. */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PublicationScheduleResourceSchema } from '@wejammin/contracts';
import {
  expectEvidenceNull,
  expectEvidencePresent,
  expectSafeError,
  expectSafeEqual,
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
  utcScheduleBody,
  expectScheduleEffects,
} from './support/phase-02-slice-11-schedule-support';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';
import {
  type S11World,
  prepareS11World,
  reservationCount,
  workflowEffects,
} from './support/phase-02-slice-11-world';
import { psql } from './support/stack';

let world: S11World;
let stack: S11Stack;
let tzdb = '';
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

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  tzdb = psql('select platform_private.cms_tzdb_version()');
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
    const beforeEffects = snapshotDigest();
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
    const acceptedEffects = snapshotDigest();
    expectScheduleEffects(beforeEffects, acceptedEffects);

    stack.clearRpcs();
    const replay = await schedule(draft, body, { key });
    expectStatus(replay, 202);
    expect(resourceDigest(replay.body)).toBe(resourceDigest(response.body));
    expect(
      stack.rpcs().find((rpc) => rpc.rpc === 'cms_schedule_publication')
        ?.replayHeader,
    ).toBe('true');
    expect(workflowEffects(draft.entryId).schedules).toBe(1);
    expectUnchanged(
      acceptedEffects,
      snapshotDigest(),
      'exact replay preserves all fourteen groups',
    );
  });

  it('[CMS-03B-07] a missing, stale or future-dated step-up is 401 before any RPC and reserves nothing', async () => {
    const draft = await approvedDraft(stack, world, 'Schedule step-up');
    for (const proof of ['none', 'stale', 'future'] as const) {
      stack.as(world.publisher, proof);
      stack.clearRpcs();
      const before = reservationCount();
      const beforeEffects = snapshotDigest();
      const response = await schedule(draft, utcBody(draft, 2 * 86_400_000));
      expectStatus(response, 401, proof);
      expect(response.body.code).toBe('STEP_UP_REQUIRED');
      expect(stack.rpcs()).toEqual([]);
      expect(reservationCount()).toBe(before);
      expectSafeError(response, {
        status: 401,
        code: 'STEP_UP_REQUIRED',
        detailsKeys: ['recoveryAction', 'allowedMethods'],
      });
      expect(
        (response.body.details as Record<string, unknown>).recoveryAction,
      ).toBe('step_up');
      expectUnchanged(
        beforeEffects,
        snapshotDigest(),
        'step-up refuses before all durable effects',
      );
    }
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

  it('[CMS-03B-07] readable nonpublisher is exactly 403 and hidden and absent revisions are identical safe 404s', async () => {
    const draft = await approvedDraft(stack, world, 'Schedule visibility');
    const body = utcBody(draft, 172_800_000);
    stack.as({ ...world.owner, capabilities: ['cms.publisher'] }, 'fresh');
    const before = snapshotDigest();
    const denied = await schedule(draft, body);
    expectSafeError(denied, {
      status: 403,
      code: 'FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });
    expectUnchanged(
      before,
      snapshotDigest(),
      'visible publisher refusal has no effects',
    );
    stack.as(world.stranger, 'fresh');
    const hidden = await stack.post(SCHEDULES, {
      body,
      ifMatch: draft.reviewVersion,
      headers: {
        'x-request-id': '71337133-7133-4133-8133-713371337133',
        'x-correlation-id': '72337233-7233-4233-8233-723372337233',
      },
    });
    const absent = await stack.post(SCHEDULES, {
      body: { ...body, revisionId: '73337333-7333-4333-8333-733373337333' },
      ifMatch: draft.reviewVersion,
      headers: { 'x-request-id': '74337433-7433-4433-8433-743374337433' },
    });
    expectSafeError(hidden, {
      status: 404,
      code: 'NOT_FOUND',
      details: {},
      requestId: '71337133-7133-4133-8133-713371337133',
    });
    expectSafeError(absent, {
      status: 404,
      code: 'NOT_FOUND',
      details: {},
      requestId: '74337433-7433-4433-8433-743374337433',
    });
    expectSafeEqual(
      {
        code: hidden.body.code,
        message: hidden.body.message,
        details: hidden.body.details,
      },
      {
        code: absent.body.code,
        message: absent.body.message,
        details: absent.body.details,
      },
      'hidden and absent disclosure is identical',
    );
    const wire = stack
      .rpcs()
      .find(
        (call) =>
          call.rpc === 'cms_schedule_publication' &&
          (call.request.context as Record<string, unknown> | undefined)
            ?.requestId === '71337133-7133-4133-8133-713371337133',
      );
    expect(wire !== undefined).toBe(true);
    expectSafeEqual(
      (wire?.request.context as Record<string, unknown> | undefined)
        ?.correlationId,
      '72337233-7233-4233-8233-723372337233',
      'real RPC correlation identity',
    );
    expectUnchanged(
      before,
      snapshotDigest(),
      'concealed refusals have no effects',
    );
  });

  it('[CMS-03B-07] stale approved-review CAS is exact VERSION_MISMATCH with no effects', async () => {
    const draft = await approvedDraft(stack, world, 'Schedule stale CAS');
    stack.as(world.publisher, 'fresh');
    const stale = String(BigInt(draft.reviewVersion) + 1n);
    const before = snapshotDigest();
    const response = await schedule(
      draft,
      utcBody(draft, 172_800_000, { expectedVersion: stale }),
      { ifMatch: stale },
    );
    expectSafeError(response, {
      status: 409,
      code: 'CONFLICT',
      details: {
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
        expectedVersion: stale,
        currentVersion: draft.reviewVersion,
      },
    });
    expectUnchanged(before, snapshotDigest(), 'stale CAS has no effects');
  });

  it('[CMS-03B-07] changed same-key schedule body is exact idempotency mismatch and preserves all effects', async () => {
    const draft = await approvedDraft(stack, world, 'Schedule replay identity');
    stack.as(world.publisher, 'fresh');
    const body = utcBody(draft, 172_800_000);
    const key = `identity-${draft.entryId}`;
    expectStatus(await schedule(draft, body, { key }), 202);
    const before = snapshotDigest();
    const response = await schedule(
      draft,
      { ...body, audience: 'members' },
      { key },
    );
    expectSafeError(response, {
      status: 409,
      code: 'CONFLICT',
      details: {
        conflict: 'IDEMPOTENCY_MISMATCH',
        recoveryAction: 'use_new_idempotency_key',
      },
    });
    expectUnchanged(
      before,
      snapshotDigest(),
      'same-key changed body creates no second schedule',
    );
  });
});
