/** CMS20 typed failures and real-clock retry ladder; no schedule/lease/time row edits. */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ExecuteScheduleRequestSchema,
  PublicationResourceSchema,
  PublicationScheduleResourceSchema,
} from '@wejammin/contracts';
import {
  expectEvidenceNull,
  expectSafeEqual,
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  approvedDraft,
  type ReviewedDraft,
} from './support/phase-02-slice-11-flow';
import {
  expectScheduleEffects,
  postSchedule,
  utcScheduleBody,
  expectStoredEvidence,
  resendExecution,
  sleepUntil,
  waitForLeaseExpiry,
} from './support/phase-02-slice-11-schedule-support';
import {
  createS11Stack,
  type S11Stack,
} from './support/phase-02-slice-11-stack';
import {
  claimsOf,
  executionOf,
  expectOperandChain,
  strictValue,
  tick,
} from './support/phase-02-slice-11-sweep-support';
import {
  prepareS11World,
  type S11World,
} from './support/phase-02-slice-11-world';
import { psql } from './support/stack';

type Subject = Readonly<{
  draft: ReviewedDraft;
  id: string;
  resolvedUtc: string;
}>;
let retry: Subject;
let noHead: Subject;
let priorPublicationId: string;
let world: S11World;
let stack: S11Stack;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  const tzdb = psql('select platform_private.cms_tzdb_version()');
  const draft = await approvedDraft(
    stack,
    world,
    'Retained publication during retry',
  );
  stack.as(world.publisher, 'fresh');
  const published = await stack.post('/api/v1/cms/publications', {
    body: {
      entryId: draft.entryId,
      revisionId: draft.revisionId,
      frozenHash: draft.frozenHash,
      expectedVersionSet: draft.versionSet,
      audience: 'public',
      expectedVersion: draft.reviewVersion,
    },
    ifMatch: draft.reviewVersion,
  });
  expectStatus(published, 202);
  priorPublicationId = PublicationResourceSchema.parse(
    published.body,
  ).publicationVersionId;
  const response = await postSchedule(
    stack,
    draft,
    utcScheduleBody(draft, 75_000, tzdb),
  );
  expectStatus(response, 202);
  const accepted = PublicationScheduleResourceSchema.parse(response.body);
  retry = { draft, id: accepted.id, resolvedUtc: accepted.resolvedUtc };

  const absent = await approvedDraft(stack, world, 'Absent publication head');
  stack.as(world.publisher, 'fresh');
  const stopped = await postSchedule(
    stack,
    absent,
    utcScheduleBody(absent, 75_000, tzdb, { action: 'unpublish' }),
  );
  expectStatus(stopped, 202);
  const resource = PublicationScheduleResourceSchema.parse(stopped.body);
  noHead = {
    draft: absent,
    id: resource.id,
    resolvedUtc: resource.resolvedUtc,
  };
}, 120_000);

/** Only safe closed tokens, numeric values and booleans leave the database. */
const retryState = () =>
  JSON.parse(
    psql(`select jsonb_build_object(
  'state', state, 'version', version::text, 'attemptCount', attempt_count,
  'reasonCode', reason_code, 'delay', extract(epoch from next_attempt_at - updated_at),
  'leaseClear', lease_id is null and lease_until is null,
  'nextAttemptAt', platform_private.auth_iso_time(next_attempt_at))
  from platform_private.cms_publication_schedules where id = '${retry.id}'`),
  ) as {
    state: string;
    version: string;
    attemptCount: number;
    reasonCode: string | null;
    delay: number | null;
    leaseClear: boolean;
    nextAttemptAt: string | null;
  };

describe('CMS-03B-20 retryable and blocked outcomes', () => {
  it('[CMS-03B-20] unavailable load retries at 15 seconds while absent active head blocks with complete typed null fields', async () => {
    await sleepUntil(
      [retry.resolvedUtc, noHead.resolvedUtc].sort().at(-1) as string,
    );
    const before = snapshotDigest();
    const trace = await tick([retry.id]);
    expectOperandChain(trace);
    expectSafeEqual(
      claimsOf(trace)
        .map((claim) => claim.scheduleId)
        .sort(),
      [retry.id, noHead.id].sort(),
      'exact due retry and absent-head subjects',
    );
    expectSafeEqual(
      executionOf(trace, retry.id).result,
      {
        scheduleId: retry.id,
        outcome: 'failed_retryable',
        reasonCode: null,
        publicationVersionId: null,
        actualUtc: null,
        deviationSeconds: null,
      },
      'complete retry result',
    );
    expectEvidenceNull(executionOf(trace, retry.id).call.request);
    expectSafeEqual(
      executionOf(trace, noHead.id).result,
      {
        scheduleId: noHead.id,
        outcome: 'blocked',
        reasonCode: 'publication_not_active',
        publicationVersionId: null,
        actualUtc: null,
        deviationSeconds: null,
      },
      'complete absent-head result',
    );
    const { nextAttemptAt, ...state } = retryState();
    expectSafeEqual(
      state,
      {
        state: 'failed_retryable',
        version: '3',
        attemptCount: 1,
        reasonCode: null,
        delay: 15,
        leaseClear: true,
      },
      'first failure exact CAS and delay',
    );
    expect(typeof nextAttemptAt === 'string').toBe(true);
    expectScheduleEffects(before, snapshotDigest(), {
      'platform_private.cms_publication_schedules': 0,
      'platform_private.cms_command_accessibility_evidence': 1,
      'audit_private.audit_events': 2,
    });
    const after = snapshotDigest();
    expect(claimsOf(await tick([retry.id])).length).toBe(0);
    expectUnchanged(
      after,
      snapshotDigest(),
      'tick before first retry deadline is effect-free',
    );
  }, 150_000);

  it('[CMS-03B-20] real 60-second and 300-second retries end at fourth failure with prior publication intact', async () => {
    for (const [attemptCount, delay, version] of [
      [2, 60, '5'],
      [3, 300, '7'],
      [3, null, '9'],
    ] as const) {
      const next = retryState().nextAttemptAt;
      if (next === null)
        throw new Error('retry deadline missing before exhaustion');
      await sleepUntil(next);
      const before = snapshotDigest();
      const trace = await tick([retry.id]);
      expectOperandChain(trace);
      expectSafeEqual(
        claimsOf(trace).map((claim) => claim.scheduleId),
        [retry.id],
        'one real due retry',
      );
      const exhausted = delay === null;
      expectSafeEqual(
        executionOf(trace, retry.id).result,
        {
          scheduleId: retry.id,
          outcome: exhausted ? 'blocked' : 'failed_retryable',
          reasonCode: exhausted ? 'retries_exhausted' : null,
          publicationVersionId: null,
          actualUtc: null,
          deviationSeconds: null,
        },
        'closed retry ladder result',
      );
      const { nextAttemptAt, ...state } = retryState();
      expectSafeEqual(
        state,
        {
          state: exhausted ? 'blocked' : 'failed_retryable',
          version,
          attemptCount,
          reasonCode: exhausted ? 'retries_exhausted' : null,
          delay,
          leaseClear: true,
        },
        'retry ladder exact row transition',
      );
      expect(nextAttemptAt === null).toBe(exhausted);
      expectScheduleEffects(before, snapshotDigest(), {
        'platform_private.cms_publication_schedules': 0,
        'audit_private.audit_events': 1,
      });
      expect(
        psql(`select count(*) from platform_private.cms_publication_versions
        where id = '${priorPublicationId}' and state = 'active'`),
      ).toBe('1');
      const unchanged = snapshotDigest();
      expect(claimsOf(await tick([retry.id])).length).toBe(0);
      expectUnchanged(
        unchanged,
        snapshotDigest(),
        'not-due or exhausted schedules never reclaim',
      );
    }
  }, 450_000);

  it('[CMS-03B-20] an expired matching real lease refuses unchanged operands before stale-evidence handling', async () => {
    const subjects: Subject[] = [];
    for (const title of [
      'Real expired lease',
      'Fresh lease positive control',
    ]) {
      const draft = await approvedDraft(stack, world, title);
      stack.as(world.publisher, 'fresh');
      const response = await postSchedule(
        stack,
        draft,
        utcScheduleBody(
          draft,
          75_000,
          psql('select platform_private.cms_tzdb_version()'),
        ),
      );
      expectStatus(response, 202);
      const schedule = PublicationScheduleResourceSchema.parse(response.body);
      subjects.push({
        draft,
        id: schedule.id,
        resolvedUtc: schedule.resolvedUtc,
      });
    }
    const [expired, fresh] = subjects;
    if (expired === undefined || fresh === undefined)
      throw new Error('lease subjects missing');
    await sleepUntil(
      subjects
        .map((item) => item.resolvedUtc)
        .sort()
        .at(-1) as string,
    );
    // Execute-only transport failure leaves the actual claimed row and lease intact.
    const trace = await tick([], undefined, [expired.id]);
    const claims = claimsOf(trace);
    expectSafeEqual(
      claims.map((claim) => claim.scheduleId).sort(),
      subjects.map((item) => item.id).sort(),
      'exact lease witness claim set',
    );
    const claim = claims.find((item) => item.scheduleId === expired.id);
    const attempts = trace.filter(
      (item) =>
        item.rpc === 'cms_execute_publication_schedule' &&
        item.request.scheduleId === expired.id,
    );
    const captured = attempts[0];
    if (claim === undefined || captured === undefined)
      throw new Error('actual lease command missing');
    expect(attempts.every((item) => item.fault && item.status === 503)).toBe(
      true,
    );
    for (const attempt of attempts)
      expectSafeEqual(
        attempt.request,
        captured.request,
        'transport retry retains actual operands',
      );
    const command = strictValue(ExecuteScheduleRequestSchema, captured.request);
    expectSafeEqual(
      {
        id: command.scheduleId,
        version: command.expectedVersion,
        lease: command.leaseId,
      },
      {
        id: claim.scheduleId,
        version: claim.scheduleVersion,
        lease: claim.leaseId,
      },
      'actual lease CAS',
    );
    expect(command.evidence !== null).toBe(true);
    expect(executionOf(trace, fresh.id).result.outcome).toBe('completed');
    expectStoredEvidence(trace, fresh.id);
    expect(
      psql(`select state || '/' || version from platform_private.cms_publication_schedules
      where id = '${expired.id}'`),
    ).toBe('executing/2');
    await waitForLeaseExpiry(expired.id);
    const before = snapshotDigest();
    const response = await resendExecution(captured.request);
    // BE03b execute lease fence; 20261005017740:143-170 checks identity/version
    // but currently omits lease_until. Source-based RED expectation, not a runtime claim.
    expectSafeEqual(
      {
        status: response.status,
        code: response.code,
        message: response.message,
      },
      { status: 400, code: 'P0001', message: 'CONFLICT' },
      'expired lease closes before aging proof',
    );
    expectUnchanged(
      before,
      snapshotDigest(),
      'expired actual lease cannot alter any effect group',
    );
  }, 450_000);
});
