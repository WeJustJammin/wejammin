/** Actual grant dates, genuine schedule command/preflight; no fabricated cutoff. */
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PublicationScheduleResourceSchema } from '@wejammin/contracts';
import {
  expectEvidencePresent,
  expectSafeEqual,
  expectSafeError,
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

const grantDays = () => {
  const organizationId = z.uuid().parse(world.shortPublisher.organizationId);
  const personId = z.uuid().parse(world.shortPublisher.personId);
  const raw: unknown = JSON.parse(
    psql(`select jsonb_build_object(
    'count', count(*), 'validThrough', min(valid_through)::text,
    'nextDay', (min(valid_through) + 1)::text)::text
    from identity_private.organization_actor_grant
    where organization_id = '${organizationId}' and person_id = '${personId}'
      and capability_code = 'cms.publisher' and active
      and valid_from <= platform_private.cms_grant_today()
      and valid_through >= platform_private.cms_grant_today()`),
  );
  const result = z
    .strictObject({
      count: z.literal(1),
      validThrough: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
      nextDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    })
    .safeParse(raw);
  if (!result.success)
    throw new Error('expected one actual finite active publisher grant');
  return result.data;
};

describe('CMS schedule nanoseconds at actual publisher grant UTC-day boundary', () => {
  // Composite command/preflight integration, not independent preflight-branch mutation proof.
  it('[CMS-03B-07] actual shortPublisher grant covers its final UTC nanosecond through command and preflight with exact stored precision', async () => {
    const draft = await approvedDraft(
      stack,
      world,
      'Last covered UTC nanosecond',
    );
    const { validThrough } = grantDays();
    const localDateTime = `${validThrough}T23:59:59.999999999`;
    const resolvedUtc = `${localDateTime}Z`;
    const body = utcScheduleBody(draft, 0, tzdb, {
      localDateTime,
      resolvedUtc,
    });
    stack.as(world.shortPublisher, 'fresh');
    stack.clearRpcs();
    const before = snapshotDigest();
    const response = await postSchedule(stack, draft, body, {
      key: `precision-covered-${draft.entryId}`,
    });
    expectStatus(response, 202);
    const resource = PublicationScheduleResourceSchema.parse(response.body);
    expectSafeEqual(
      {
        entryId: resource.entryId,
        revisionId: resource.revisionId,
        action: resource.action,
        audience: resource.audience,
        localDateTime: resource.localDateTime,
        resolvedUtc: resource.resolvedUtc,
        timezone: resource.timezone,
        tzdbVersion: resource.tzdbVersion,
        disambiguation: resource.disambiguation,
        state: resource.state,
        version: resource.version,
        actualUtc: resource.actualUtc,
        deviationSeconds: resource.deviationSeconds,
        reasonCode: resource.reasonCode,
        attemptCount: resource.attemptCount,
        jobId: resource.jobId,
      },
      {
        entryId: draft.entryId,
        revisionId: draft.revisionId,
        action: 'publish',
        audience: 'public',
        localDateTime,
        resolvedUtc,
        timezone: 'UTC',
        tzdbVersion: tzdb,
        disambiguation: 'none',
        state: 'pending',
        version: '1',
        actualUtc: null,
        deviationSeconds: null,
        reasonCode: null,
        attemptCount: 0,
        jobId: null,
      },
      'exact accepted final-day resource, not midnight rounding',
    );
    expectSafeEqual(
      response.headers.get('location'),
      `${SCHEDULES}/${resource.id}`,
      'Location',
    );
    expectSafeEqual(response.headers.get('etag'), '"1"', 'strong initial ETag');
    const commands = stack
      .rpcs()
      .filter((rpc) => rpc.rpc === 'cms_schedule_publication');
    expect(commands.length).toBe(1);
    expectSafeEqual(
      {
        localDateTime: commands[0]!.request.localDateTime,
        resolvedUtc: commands[0]!.request.resolvedUtc,
        timezone: commands[0]!.request.timezone,
        tzdbVersion: commands[0]!.request.tzdbVersion,
        disambiguation: commands[0]!.request.disambiguation,
      },
      {
        localDateTime,
        resolvedUtc,
        timezone: 'UTC',
        tzdbVersion: tzdb,
        disambiguation: 'none',
      },
      'actual command receives exact final-day time',
    );
    expectEvidencePresent(commands[0]!.request);
    expectScheduleEffects(before, snapshotDigest());
    const stored: unknown = JSON.parse(
      psql(`select coalesce(jsonb_agg(jsonb_build_object(
      'localFloor', to_char(s.local_datetime, 'YYYY-MM-DD"T"HH24:MI:SS.US'),
      'resolvedFloor', to_char(s.resolved_at_utc at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'localRemainder', to_jsonb(s)->'local_datetime_submicro_ns',
      'resolvedRemainder', to_jsonb(s)->'resolved_utc_submicro_ns'
    )), '[]'::jsonb)::text from platform_private.cms_publication_schedules s
    where s.id = '${resource.id}'`),
    );
    expectSafeEqual(
      stored,
      [
        {
          localFloor: `${validThrough}T23:59:59.999999`,
          resolvedFloor: `${validThrough}T23:59:59.999999Z`,
          localRemainder: 999,
          resolvedRemainder: 999,
        },
      ],
      'stored pair remains inside actual inclusive grant day',
    );
  });

  it('[CMS-03B-07] midnight after actual shortPublisher valid_through is exact authority_ends_before_schedule with all fourteen groups unchanged', async () => {
    const draft = await approvedDraft(
      stack,
      world,
      'First uncovered UTC midnight',
    );
    const { nextDay } = grantDays();
    const localDateTime = `${nextDay}T00:00:00`;
    const resolvedUtc = `${localDateTime}Z`;
    stack.as(world.shortPublisher, 'fresh');
    stack.clearRpcs();
    const before = snapshotDigest();
    const response = await postSchedule(
      stack,
      draft,
      utcScheduleBody(draft, 0, tzdb, { localDateTime, resolvedUtc }),
      {
        key: `precision-uncovered-${draft.entryId}`,
      },
    );
    expectSafeError(response, {
      status: 422,
      code: 'VALIDATION_FAILED',
      details: { reasonCode: 'authority_ends_before_schedule' },
    });
    const commands = stack
      .rpcs()
      .filter((rpc) => rpc.rpc === 'cms_schedule_publication');
    expect(commands.length).toBe(1);
    expectSafeEqual(
      {
        localDateTime: commands[0]!.request.localDateTime,
        resolvedUtc: commands[0]!.request.resolvedUtc,
        expectedVersion: commands[0]!.request.expectedVersion,
      },
      { localDateTime, resolvedUtc, expectedVersion: draft.reviewVersion },
      'actual command keeps approved review CAS and next-day time',
    );
    expectUnchanged(
      before,
      snapshotDigest(),
      'authority refusal preserves all fourteen complete groups',
    );
  });
});
