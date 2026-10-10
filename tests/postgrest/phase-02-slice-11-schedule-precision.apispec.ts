/** Exact schedule precision through genuine commands, stored rows and workflow reads. */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  EntryWorkflowResourceSchema,
  PublicationScheduleResourceSchema,
  type PublicationScheduleResource,
} from '@wejammin/contracts';
import {
  expectEvidencePresent,
  expectSafeEqual,
  expectSafeError,
  expectSameInstant,
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  approvedDraft,
  type ReviewedDraft,
  workflowPath,
} from './support/phase-02-slice-11-flow';
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

let SECOND: string;
let world: S11World;
let stack: S11Stack;
let tzdb: string;
beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  tzdb = psql('select platform_private.cms_tzdb_version()');
  // Sample once after setup; Date is only the whole-second fixture source.
  SECOND = new Date(Date.now() + 300_000).toISOString().slice(0, 19);
}, 120_000);

const bodyOf = (draft: ReviewedDraft, fraction: string, offset = 'Z') =>
  utcScheduleBody(draft, 0, tzdb, {
    localDateTime: `${SECOND}.${fraction}`,
    resolvedUtc: `${SECOND}.${fraction}${offset}`,
  });

// Only a strict public UUID enters SQL. Missing pre-producer columns yield JSON
// null, making the intended RED a value mismatch rather than undefined-column SQL.
const storedPair = (resource: PublicationScheduleResource): unknown =>
  JSON.parse(
    psql(`select coalesce(jsonb_agg(jsonb_build_object(
    'localFloor', to_char(s.local_datetime, 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    'resolvedFloor', to_char(s.resolved_at_utc at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'localRemainder', to_jsonb(s)->'local_datetime_submicro_ns',
    'resolvedRemainder', to_jsonb(s)->'resolved_utc_submicro_ns'
  )), '[]'::jsonb)::text from platform_private.cms_publication_schedules s
  where s.id = '${resource.id}'`),
  ) as unknown;

const expectPair = (resource: PublicationScheduleResource, remainder: number) =>
  expectSafeEqual(
    storedPair(resource),
    [
      {
        localFloor: `${SECOND}.123456`,
        resolvedFloor: `${SECOND}.123456Z`,
        localRemainder: remainder,
        resolvedRemainder: remainder,
      },
    ],
    'actual timestamp floors and private nanosecond remainders',
  );

const accept = async (draft: ReviewedDraft, fraction: string, key: string) => {
  stack.as(world.publisher, 'fresh');
  const body = bodyOf(draft, fraction);
  const before = snapshotDigest();
  stack.clearRpcs();
  const response = await postSchedule(stack, draft, body, { key });
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
      localDateTime: body.localDateTime,
      resolvedUtc: body.resolvedUtc,
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
    'closed pending resource preserves every original time member',
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
  const request = commands[0]!.request;
  expectSafeEqual(
    {
      localDateTime: request.localDateTime,
      resolvedUtc: request.resolvedUtc,
      timezone: request.timezone,
      tzdbVersion: request.tzdbVersion,
      disambiguation: request.disambiguation,
    },
    {
      localDateTime: body.localDateTime,
      resolvedUtc: body.resolvedUtc,
      timezone: 'UTC',
      tzdbVersion: tzdb,
      disambiguation: 'none',
    },
    'Worker forwards exact verified time strings to the actual command',
  );
  expectEvidencePresent(request);
  expectScheduleEffects(before, snapshotDigest());
  return { response, resource, body };
};

const expectWorkflow = async (
  draft: ReviewedDraft,
  expected: readonly PublicationScheduleResource[],
) => {
  stack.as(world.owner);
  const before = snapshotDigest();
  const response = await stack.get(workflowPath(draft.entryId));
  expectStatus(response, 200);
  const workflow = EntryWorkflowResourceSchema.parse(response.body);
  expectSafeEqual(workflow.entry.id, draft.entryId, 'workflow entry identity');
  expectSafeEqual(
    workflow.revision.id,
    draft.revisionId,
    'workflow revision identity',
  );
  expectSafeEqual(
    workflow.schedules.map((s) => s.id).sort(),
    expected.map((s) => s.id).sort(),
    'exact workflow schedule membership',
  );
  for (const resource of expected) {
    const schedule = workflow.schedules.find((s) => s.id === resource.id)!;
    expectSameInstant(
      schedule.resolvedUtc,
      resource.resolvedUtc,
      'workflow preserves all nanoseconds',
    );
    expectSafeEqual(
      { ...schedule, resolvedUtc: resource.resolvedUtc },
      {
        id: resource.id,
        version: '1',
        state: 'pending',
        action: 'publish',
        audience: 'public',
        resolvedUtc: resource.resolvedUtc,
        reasonCode: null,
      },
      'complete workflow schedule summary',
    );
  }
  expectSafeEqual(workflow.publications, [], 'scheduling never publishes');
  expectUnchanged(
    before,
    snapshotDigest(),
    'workflow read preserves all fourteen complete groups',
  );
};

describe('CMS schedule exact nanosecond storage and identity', () => {
  it('[CMS-03B-07] nine-digit acceptance stores exact floor/remainder pairs and completed202; private pairs are immutable and exact replay preserves all fourteen groups', async () => {
    const draft = await approvedDraft(stack, world, 'Exact stored nanoseconds');
    const key = `precision-storage-${draft.entryId}`;
    const { response, resource, body } = await accept(draft, '123456789', key);
    expectPair(resource, 789);
    for (const column of [
      'local_datetime_submicro_ns',
      'resolved_utc_submicro_ns',
    ] as const) {
      const beforeMutation = snapshotDigest();
      let refusal: string | null = null;
      try {
        psql(`begin;
          select set_config('app.cms_rpc', 'true', true);
          update platform_private.cms_publication_schedules
            set ${column} = 788 where id = '${resource.id}';
          rollback;`);
      } catch (error) {
        const stderr = String((error as { stderr?: unknown }).stderr ?? '');
        refusal = /ERROR:\s+([^\n]+)/u.exec(stderr)?.[1]?.trim() ?? null;
      }
      expectSafeEqual(
        refusal,
        'IMMUTABLE_RECORD',
        `${column} mutation is refused by the immutable guard`,
      );
      expectUnchanged(
        beforeMutation,
        snapshotDigest(),
        `${column} mutation preserves all fourteen complete groups`,
      );
    }
    const receipts: unknown = JSON.parse(
      psql(`select coalesce(jsonb_agg(
      jsonb_build_object('state', state, 'responseRef', response_ref)), '[]'::jsonb)::text
      from platform_private.idempotency_records where operation = 'CMS-03B-07'
        and response_ref->>'resourceRef' = '${resource.id}'`),
    );
    expectSafeEqual(
      receipts,
      [
        {
          state: 'completed',
          responseRef: {
            status: 202,
            resourceRef: resource.id,
            safeHeaders: { response: resource },
          },
        },
      ],
      'actual exact completed202 receipt',
    );
    const before = snapshotDigest();
    stack.clearRpcs();
    const replay = await postSchedule(stack, draft, body, { key });
    expectStatus(replay, 202);
    expectSafeEqual(
      PublicationScheduleResourceSchema.parse(replay.body),
      resource,
      'exact replay resource',
    );
    expectSafeEqual(replay.body, response.body, 'unchanged whole replay body');
    expectSafeEqual(
      replay.headers.get('location'),
      response.headers.get('location'),
      'replay Location',
    );
    expectSafeEqual(
      replay.headers.get('etag'),
      response.headers.get('etag'),
      'replay strong ETag',
    );
    const commands = stack
      .rpcs()
      .filter((rpc) => rpc.rpc === 'cms_schedule_publication');
    expect(commands.length).toBe(1);
    expect(commands[0]!.replayHeader).toBe('true');
    expectUnchanged(
      before,
      snapshotDigest(),
      'exact replay preserves all fourteen complete groups',
    );
  });

  it('[CMS-03B-15] genuine workflow read retains the accepted nine-digit instant without any durable effects', async () => {
    const draft = await approvedDraft(
      stack,
      world,
      'Exact workflow nanoseconds',
    );
    const { resource } = await accept(
      draft,
      '123456789',
      `precision-workflow-${draft.entryId}`,
    );
    await expectWorkflow(draft, [resource]);
  });

  it('[CMS-03B-07] fresh-key equivalent fractional and UTC-offset spellings conflict against their own accepted .123456780 identity without effects', async () => {
    const draft = await approvedDraft(
      stack,
      world,
      'Equivalent nanosecond identity',
    );
    const { resource } = await accept(
      draft,
      '123456780',
      `precision-equivalent-base-${draft.entryId}`,
    );
    expectPair(resource, 780);
    for (const [fraction, offset] of [
      ['12345678', 'Z'],
      ['123456780', '+00:00'],
      ['12345678', '+00:00'],
    ] as const) {
      const before = snapshotDigest();
      const response = await postSchedule(
        stack,
        draft,
        bodyOf(draft, fraction, offset),
        {
          key: `precision-equivalent-${fraction}-${offset === 'Z' ? 'z' : 'offset'}-${draft.entryId}`,
        },
      );
      expectSafeError(response, {
        status: 409,
        code: 'CONFLICT',
        details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
      });
      expectUnchanged(
        before,
        snapshotDigest(),
        'equivalent fresh-key identity refuses without any effects',
      );
    }
  });

  it('[CMS-03B-07][CMS-03B-15] identities one nanosecond apart coexist as two exact stored pairs and two exact workflow instants', async () => {
    const draft = await approvedDraft(
      stack,
      world,
      'Adjacent nanosecond identities',
    );
    const first = await accept(
      draft,
      '123456788',
      `precision-adjacent-first-${draft.entryId}`,
    );
    const second = await accept(
      draft,
      '123456789',
      `precision-adjacent-second-${draft.entryId}`,
    );
    expect(first.resource.id === second.resource.id).toBe(false);
    expectPair(first.resource, 788);
    expectPair(second.resource, 789);
    expect(
      psql(`select count(*) from platform_private.cms_publication_schedules
      where entry_id = '${first.resource.entryId}'`),
    ).toBe('2');
    await expectWorkflow(draft, [first.resource, second.resource]);
  });
});
