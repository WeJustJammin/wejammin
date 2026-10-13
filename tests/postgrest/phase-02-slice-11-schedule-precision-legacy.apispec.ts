/** Real legacy input persistence; this case does not prove migration retention. */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  EntryWorkflowResourceSchema,
  PublicationScheduleResourceSchema,
} from '@wejammin/contracts';
import {
  expectEvidencePresent,
  expectSafeEqual,
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import { approvedDraft, workflowPath } from './support/phase-02-slice-11-flow';
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

describe('CMS schedule legacy precision compatibility', () => {
  it('[CMS-03B-07][CMS-03B-15] real six-digit legacy persistence stores zero remainders and completed202 receipt; exact replay and padded workflow preserve all fourteen groups', async () => {
    const draft = await approvedDraft(
      stack,
      world,
      'Legacy six-digit schedule',
    );
    // Date supplies only a real future whole second, never fractional arithmetic.
    const second = new Date(Date.now() + 300_000).toISOString().slice(0, 19);
    const body = utcScheduleBody(draft, 0, tzdb, {
      localDateTime: `${second}.123456`,
      resolvedUtc: `${second}.123456Z`,
    });
    const key = `precision-legacy-${draft.entryId}`;
    stack.as(world.publisher, 'fresh');
    const before = snapshotDigest();
    stack.clearRpcs();
    const response = await postSchedule(stack, draft, body, { key });
    expectStatus(response, 202);
    const resource = PublicationScheduleResourceSchema.parse(response.body);
    expectSafeEqual(
      resource,
      {
        id: resource.id,
        version: '1',
        createdAt: resource.createdAt,
        updatedAt: resource.createdAt,
        state: 'pending',
        entryId: draft.entryId,
        revisionId: draft.revisionId,
        action: 'publish',
        localDateTime: `${second}.123456`,
        timezone: 'UTC',
        resolvedUtc: `${second}.123456Z`,
        tzdbVersion: tzdb,
        disambiguation: 'none',
        audience: 'public',
        jobId: null,
        actualUtc: null,
        deviationSeconds: null,
        reasonCode: null,
        attemptCount: 0,
      },
      'complete accepted resource retains original six-digit echo',
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
    expectEvidencePresent(commands[0]!.request);
    expectScheduleEffects(before, snapshotDigest());

    // Strict public UUID only; absent pre-DDL columns produce explicit JSON null.
    const pairs: unknown = JSON.parse(
      psql(`select coalesce(jsonb_agg(jsonb_build_object(
        'localFloor', to_char(s.local_datetime, 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        'resolvedFloor', to_char(s.resolved_at_utc at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'localRemainder', to_jsonb(s)->'local_datetime_submicro_ns',
        'resolvedRemainder', to_jsonb(s)->'resolved_utc_submicro_ns'
      )), '[]'::jsonb)::text from platform_private.cms_publication_schedules s
      where s.id = '${resource.id}'`),
    );
    expectSafeEqual(
      pairs,
      [
        {
          localFloor: `${second}.123456`,
          resolvedFloor: `${second}.123456Z`,
          localRemainder: 0,
          resolvedRemainder: 0,
        },
      ],
      'legacy six-digit timestamps persist with both private remainders zero',
    );
    const receipts: unknown = JSON.parse(
      psql(`select coalesce(jsonb_agg(jsonb_build_object(
        'state', state, 'responseRef', response_ref)), '[]'::jsonb)::text
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
      'exact actual completed202 receipt retains six-digit response',
    );

    const beforeReplay = snapshotDigest();
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
    const replays = stack
      .rpcs()
      .filter((rpc) => rpc.rpc === 'cms_schedule_publication');
    expect(replays.length).toBe(1);
    expect(replays[0]!.replayHeader).toBe('true');
    expectUnchanged(
      beforeReplay,
      snapshotDigest(),
      'exact replay preserves all fourteen complete groups',
    );

    stack.as(world.owner);
    const beforeRead = snapshotDigest();
    const read = await stack.get(workflowPath(draft.entryId));
    expectStatus(read, 200);
    const workflow = EntryWorkflowResourceSchema.parse(read.body);
    expectSafeEqual(
      workflow.entry.id,
      draft.entryId,
      'workflow entry identity',
    );
    expectSafeEqual(
      workflow.revision.id,
      draft.revisionId,
      'workflow revision identity',
    );
    expectSafeEqual(
      workflow.schedules,
      [
        {
          id: resource.id,
          version: '1',
          state: 'pending',
          action: 'publish',
          audience: 'public',
          resolvedUtc: `${second}.123456000Z`,
          reasonCode: null,
        },
      ],
      'complete workflow schedule uses exact nine-digit canonical padding',
    );
    expectSafeEqual(workflow.publications, [], 'scheduling never publishes');
    expectUnchanged(
      beforeRead,
      snapshotDigest(),
      'workflow read preserves all fourteen complete groups',
    );
  });
});
