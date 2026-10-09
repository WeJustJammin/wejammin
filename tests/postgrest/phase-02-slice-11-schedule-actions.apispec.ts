/** API07 action, audience uniqueness and request admission through the real Worker. */
import { beforeAll, describe, expect, it } from 'vitest';
import { PublicationScheduleResourceSchema } from '@wejammin/contracts';
import {
  expectSafeEqual,
  expectSafeError,
  expectSameInstant,
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import { approvedDraft } from './support/phase-02-slice-11-flow';
import {
  SCHEDULES,
  expectScheduleEffects,
  postSchedule,
  utcScheduleBody,
} from './support/phase-02-slice-11-schedule-support';
import {
  createS11Stack,
  type S11Stack,
} from './support/phase-02-slice-11-stack';
import {
  prepareS11World,
  type S11World,
} from './support/phase-02-slice-11-world';
import { psql } from './support/stack';

let world: S11World;
let stack: S11Stack;
let tzdb: string;
beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  tzdb = psql('select platform_private.cms_tzdb_version()');
}, 120_000);

describe('CMS-03B-07 exact action and audience schedule identity', () => {
  it('[CMS-03B-07] nine-digit fractional schedule accepted by Worker remains accepted by SQL', async () => {
    // BE03b:266 permits nine digits; migration 17710:119/135 currently permits only six.
    const draft = await approvedDraft(stack, world, 'Nanosecond acceptance');
    stack.as(world.publisher, 'fresh');
    const local = `${String(utcScheduleBody(draft, 172_800_000, tzdb).localDateTime)}.123456789`;
    const response = await postSchedule(
      stack,
      draft,
      utcScheduleBody(draft, 0, tzdb, {
        localDateTime: local,
        resolvedUtc: `${local}Z`,
      }),
    );
    expectStatus(response, 202);
    const resource = PublicationScheduleResourceSchema.parse(response.body);
    expectSameInstant(
      resource.resolvedUtc,
      `${local}Z`,
      'nanosecond response remains exact',
    );
  });

  it.each(['publish', 'unpublish', 'expire', 'archive'] as const)(
    '[CMS-03B-07] %s acceptance changes only schedule, reservation, audit and accessibility groups',
    async (action) => {
      const draft = await approvedDraft(stack, world, `Schedule ${action}`);
      stack.as(world.publisher, 'fresh');
      const body = utcScheduleBody(draft, 172_800_000, tzdb, { action });
      const before = snapshotDigest();
      const response = await postSchedule(stack, draft, body);
      expectStatus(response, 202);
      const resource = PublicationScheduleResourceSchema.parse(response.body);
      expectSafeEqual(
        {
          action: resource.action,
          audience: resource.audience,
          state: resource.state,
          version: resource.version,
          actualUtc: resource.actualUtc,
          deviationSeconds: resource.deviationSeconds,
          reasonCode: resource.reasonCode,
          attemptCount: resource.attemptCount,
          jobId: resource.jobId,
        },
        {
          action,
          audience: 'public',
          state: 'pending',
          version: '1',
          actualUtc: null,
          deviationSeconds: null,
          reasonCode: null,
          attemptCount: 0,
          jobId: null,
        },
        'accepted action remains pending',
      );
      expectScheduleEffects(before, snapshotDigest());
      const accepted = snapshotDigest();
      const collision = await postSchedule(stack, draft, body);
      expectSafeError(collision, {
        status: 409,
        code: 'CONFLICT',
        details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
      });
      expectUnchanged(
        accepted,
        snapshotDigest(),
        'same exact schedule identity collides without effects',
      );
      const otherAudience = await postSchedule(stack, draft, {
        ...body,
        audience: 'members',
      });
      expectStatus(otherAudience, 202);
      const second = PublicationScheduleResourceSchema.parse(
        otherAudience.body,
      );
      expect(second.audience).toBe('members');
      expect(second.id === resource.id).toBe(false);
      expectScheduleEffects(accepted, snapshotDigest());
    },
  );

  it('[CMS-03B-07] header/body CAS disagreement is 400 before any RPC or reservation', async () => {
    const draft = await approvedDraft(stack, world, 'Header body agreement');
    stack.as(world.publisher, 'fresh');
    stack.clearRpcs();
    const before = snapshotDigest();
    const response = await postSchedule(
      stack,
      draft,
      utcScheduleBody(draft, 172_800_000, tzdb),
      {
        ifMatch: String(BigInt(draft.reviewVersion) + 1n),
      },
    );
    expectSafeError(response, {
      status: 400,
      code: 'INVALID_REQUEST',
      details: {},
    });
    expect(stack.rpcs().length).toBe(0);
    expectUnchanged(
      before,
      snapshotDigest(),
      'mismatched transport CAS has no effects',
    );
  });

  it('[CMS-03B-07] non-JSON body is exact 415 before RPC and changes nothing', async () => {
    const draft = await approvedDraft(stack, world, 'Schedule MIME');
    stack.as(world.publisher, 'fresh');
    stack.clearRpcs();
    const before = snapshotDigest();
    const response = await stack.post(SCHEDULES, {
      body: utcScheduleBody(draft, 172_800_000, tzdb),
      ifMatch: draft.reviewVersion,
      headers: { 'content-type': 'text/plain' },
    });
    expectSafeError(response, {
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      details: {},
    });
    expect(stack.rpcs().length).toBe(0);
    expectUnchanged(
      before,
      snapshotDigest(),
      'non-JSON request has no effects',
    );
  });

  it('[CMS-03B-07] anonymous schedule is exact 401 reauthentication with no effects', async () => {
    const draft = await approvedDraft(stack, world, 'Anonymous schedule');
    stack.as(null);
    stack.clearRpcs();
    const before = snapshotDigest();
    const response = await postSchedule(
      stack,
      draft,
      utcScheduleBody(draft, 172_800_000, tzdb),
    );
    expectSafeError(response, {
      status: 401,
      code: 'UNAUTHENTICATED',
      details: { recoveryAction: 'reauthenticate' },
    });
    expect(stack.rpcs().length).toBe(0);
    expectUnchanged(
      before,
      snapshotDigest(),
      'anonymous request has no effects',
    );
  });
});
