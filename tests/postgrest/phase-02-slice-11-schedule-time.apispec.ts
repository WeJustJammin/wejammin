/** CMS-03B-07 through the production Worker and real PostgREST. */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PublicationScheduleResourceSchema } from '@wejammin/contracts';
import {
  expectSafeError,
  expectSafeEqual,
  expectSameInstant,
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  type ReviewedDraft,
  approvedDraft,
} from './support/phase-02-slice-11-flow';
import {
  postSchedule,
  utcScheduleBody,
} from './support/phase-02-slice-11-schedule-support';
import {
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

describe('CMS-03B-07 pinned time authority through the real stack', () => {
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

  it.each([
    [
      'unknown zone',
      { timezone: 'Unknown/Nowhere' },
      'unknown_timezone',
      '/timezone',
      {},
    ],
    [
      'pinned tzdb mismatch',
      { tzdbVersion: '1900a' },
      'tzdb_version_mismatch',
      '/tzdbVersion',
      null,
    ],
    [
      'ordinary earlier choice',
      { disambiguation: 'earlier' },
      'disambiguation_not_applicable',
      '/disambiguation',
      {},
    ],
    [
      'ordinary later choice',
      { disambiguation: 'later' },
      'disambiguation_not_applicable',
      '/disambiguation',
      {},
    ],
  ] as const)(
    '[CMS-03B-07] %s returns exact safe time details and no effects',
    async (_label, overrides, reasonCode, path, details) => {
      const draft = await approvedDraft(stack, world, 'Time refusal subject');
      stack.as(world.publisher, 'fresh');
      stack.clearRpcs();
      const before = snapshotDigest();
      const response = await schedule(
        draft,
        utcBody(draft, 172_800_000, overrides),
      );
      expectSafeError(response, {
        status: 422,
        code: 'VALIDATION_FAILED',
        details: {
          reasonCode,
          ...(details ?? { pinnedVersion: tzdb }),
          violations: [
            { path, code: reasonCode, message: 'The value is invalid.' },
          ],
        },
      });
      expect(stack.rpcs().length).toBe(0);
      expectUnchanged(
        before,
        snapshotDigest(),
        'time refusal has zero durable effects',
      );
    },
  );

  it('[CMS-03B-07] spring gap and unresolved fold expose exactly both pinned alternatives', async () => {
    const draft = await approvedDraft(stack, world, 'DST alternatives');
    stack.as(world.publisher, 'fresh');
    const cases = [
      {
        localDateTime: '2027-03-14T02:30:00',
        resolvedUtc: '2027-03-14T07:30:00Z',
        reasonCode: 'nonexistent_local_time',
        path: '/localDateTime',
        alternatives: [
          {
            localDateTime: '2027-03-14T01:30:00',
            resolvedUtc: '2027-03-14T06:30:00Z',
          },
          {
            localDateTime: '2027-03-14T03:30:00',
            resolvedUtc: '2027-03-14T07:30:00Z',
          },
        ],
      },
      {
        localDateTime: '2026-11-01T01:30:00',
        resolvedUtc: '2026-11-01T05:30:00Z',
        reasonCode: 'ambiguous_local_time',
        path: '/disambiguation',
        alternatives: [
          { disambiguation: 'earlier', resolvedUtc: '2026-11-01T05:30:00Z' },
          { disambiguation: 'later', resolvedUtc: '2026-11-01T06:30:00Z' },
        ],
      },
    ];
    for (const item of cases) {
      stack.clearRpcs();
      const before = snapshotDigest();
      const response = await schedule(
        draft,
        utcBody(draft, 0, {
          localDateTime: item.localDateTime,
          resolvedUtc: item.resolvedUtc,
          timezone: 'America/New_York',
        }),
      );
      expectSafeError(response, {
        status: 422,
        code: 'VALIDATION_FAILED',
        details: {
          reasonCode: item.reasonCode,
          alternatives: item.alternatives,
          violations: [
            {
              path: item.path,
              code: item.reasonCode,
              message: 'The value is invalid.',
            },
          ],
        },
      });
      expect(stack.rpcs().length).toBe(0);
      expectUnchanged(before, snapshotDigest(), 'DST refusal has zero effects');
    }
  });

  it.each([
    [
      'later fold',
      '2026-11-01T01:30:00',
      'America/New_York',
      '2026-11-01T06:30:00Z',
      'later',
    ],
    [
      'three-segment zone',
      '2026-12-01T09:00:00',
      'America/Argentina/Buenos_Aires',
      '2026-12-01T12:00:00Z',
      'none',
    ],
    [
      'negative twelve-hour edge',
      '2026-12-01T09:00:00',
      'Etc/GMT+12',
      '2026-12-01T21:00:00Z',
      'none',
    ],
    [
      'positive fourteen-hour edge',
      '2026-12-01T09:00:00',
      'Pacific/Kiritimati',
      '2026-11-30T19:00:00Z',
      'none',
    ],
  ] as const)(
    '[CMS-03B-07] %s persists the verified instant',
    async (_label, localDateTime, timezone, resolvedUtc, disambiguation) => {
      const draft = await approvedDraft(stack, world, 'Pinned-zone success');
      stack.as(world.publisher, 'fresh');
      const response = await schedule(
        draft,
        utcBody(draft, 0, {
          localDateTime,
          timezone,
          resolvedUtc,
          disambiguation,
        }),
      );
      expectStatus(response, 202);
      const resource = PublicationScheduleResourceSchema.parse(response.body);
      expectSafeEqual(
        {
          localDateTime: resource.localDateTime,
          timezone: resource.timezone,
          disambiguation: resource.disambiguation,
          tzdbVersion: resource.tzdbVersion,
        },
        { localDateTime, timezone, disambiguation, tzdbVersion: tzdb },
        'time authority echo',
      );
      expectSameInstant(
        resource.resolvedUtc,
        resolvedUtc,
        'exact chosen instant',
      );
    },
  );

  it('[CMS-03B-07] one nanosecond UTC mismatch is refused before any RPC', async () => {
    const draft = await approvedDraft(stack, world, 'Nanosecond mismatch');
    stack.as(world.publisher, 'fresh');
    stack.clearRpcs();
    const local = String(utcBody(draft, 172_800_000).localDateTime);
    const before = snapshotDigest();
    const response = await schedule(
      draft,
      utcBody(draft, 0, {
        localDateTime: `${local}.123456789`,
        resolvedUtc: `${local}.123456788Z`,
      }),
    );
    expectSafeError(response, {
      status: 422,
      code: 'VALIDATION_FAILED',
      details: {
        reasonCode: 'resolved_utc_mismatch',
        expectedUtc: `${local}.123456789Z`,
        violations: [
          {
            path: '/resolvedUtc',
            code: 'resolved_utc_mismatch',
            message: 'The value is invalid.',
          },
        ],
      },
    });
    expect(stack.rpcs().length).toBe(0);
    expectUnchanged(
      before,
      snapshotDigest(),
      'nanosecond mismatch is effect-free',
    );
  });

  it.each([
    ['below minimum', 59_000],
    ['above maximum', 366 * 86_400_000 + 60_000],
  ] as const)(
    '[CMS-03B-07] %s reports exact 60-second and 366-day live-clock bounds',
    async (_label, lead) => {
      const draft = await approvedDraft(stack, world, 'Horizon boundary');
      stack.as(world.publisher, 'fresh');
      const before = snapshotDigest();
      const started = Date.now();
      const response = await schedule(draft, utcBody(draft, lead));
      const finished = Date.now();
      expectSafeError(response, {
        status: 422,
        code: 'VALIDATION_FAILED',
        detailsKeys: ['reasonCode', 'minUtc', 'maxUtc', 'violations'],
      });
      const details = response.body.details as Record<string, unknown>;
      expect(details.reasonCode).toBe('schedule_out_of_horizon');
      expectSafeEqual(
        details.violations,
        [
          {
            path: '/resolvedUtc',
            code: 'schedule_out_of_horizon',
            message: 'The value is invalid.',
          },
        ],
        'horizon pointer',
      );
      const minimum = Date.parse(String(details.minUtc));
      const maximum = Date.parse(String(details.maxUtc));
      expect(minimum).toBeGreaterThanOrEqual(started + 60_000);
      expect(minimum).toBeLessThanOrEqual(finished + 60_000);
      expect(maximum - minimum).toBe(366 * 86_400_000 - 60_000);
      expectUnchanged(
        before,
        snapshotDigest(),
        'horizon refusal is effect-free',
      );
    },
  );
});
