/** Real CMS20 claim/load/execute composition and all four lineage actions. */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PublicationResourceSchema,
  PublicationScheduleResourceSchema,
} from '@wejammin/contracts';
import {
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
  replayExecution,
  sleepUntil,
} from './support/phase-02-slice-11-schedule-support';
import {
  createS11Stack,
  type S11Stack,
} from './support/phase-02-slice-11-stack';
import {
  claimsOf,
  executionOf,
  expectOperandChain,
  tick,
  type SweepTrace,
} from './support/phase-02-slice-11-sweep-support';
import {
  prepareS11World,
  type S11World,
} from './support/phase-02-slice-11-world';
import { psql } from './support/stack';
import { appendEntryBody } from './support/cms-editorial-world';
import {
  captureScheduleRecoveryProof,
  assertScheduleRecoveryProof,
} from './support/phase-02-slice-11-schedule-recovery-proof';

type Subject = Readonly<{
  draft: ReviewedDraft;
  id: string;
  resolvedUtc: string;
  action: 'publish' | 'unpublish' | 'expire' | 'archive';
  headId: string | null;
}>;
let world: S11World;
let stack: S11Stack;
const subjects: Subject[] = [];
let trace: SweepTrace;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  const tzdb = psql('select platform_private.cms_tzdb_version()');
  for (const action of ['publish', 'unpublish', 'expire', 'archive'] as const) {
    const draft = await approvedDraft(stack, world, `Sweep lineage ${action}`);
    stack.as(world.publisher, 'fresh');
    let headId: string | null = null;
    if (action !== 'publish') {
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
      headId = PublicationResourceSchema.parse(
        published.body,
      ).publicationVersionId;
    }
    const response = await postSchedule(
      stack,
      draft,
      utcScheduleBody(draft, 75_000, tzdb, { action }),
    );
    expectStatus(response, 202);
    const accepted = PublicationScheduleResourceSchema.parse(response.body);
    subjects.push({
      draft,
      id: accepted.id,
      resolvedUtc: accepted.resolvedUtc,
      action,
      headId,
    });
  }
}, 120_000);

describe('CMS-03B-20 real lineage and replay', () => {
  it('[CMS-03B-20] actual ordered claim load execute operands bind all actions and late canonical lineage effects plus independently proved global expired-lease recovery', async () => {
    await sleepUntil(
      subjects
        .map((item) => item.resolvedUtc)
        .sort()
        .at(-1) as string,
    );
    const before = snapshotDigest();
    const recoveryBefore = captureScheduleRecoveryProof();
    trace = await tick();
    const recoveredCount = assertScheduleRecoveryProof(recoveryBefore);
    expectOperandChain(trace);
    const claims = claimsOf(trace);
    expectSafeEqual(
      claims.map((claim) => claim.scheduleId).sort(),
      subjects.map((subject) => subject.id).sort(),
      'exact due schedule set',
    );
    for (const subject of subjects) {
      const claim = claims.find((item) => item.scheduleId === subject.id);
      expectSafeEqual(
        {
          revisionId: claim?.revisionId,
          expectedVersion: claim?.expectedVersion,
          scheduleVersion: claim?.scheduleVersion,
        },
        {
          revisionId: subject.draft.revisionId,
          expectedVersion: subject.draft.reviewVersion,
          scheduleVersion: '2',
        },
        'claim binds accepted revision and both versions',
      );
      const { result } = executionOf(trace, subject.id);
      if (claim === undefined) throw new Error('actual subject claim missing');
      expect(
        psql(`select count(*) from platform_private.cms_publication_schedules
        where id = '${subject.id}' and dependency_hash = '${claim.dependencyHash}'
          and activation_evidence_hash = '${claim.activationEvidenceHash}'`),
      ).toBe('1');
      expect(result.outcome).toBe('completed');
      expect(result.reasonCode).toBeNull();
      expect(result.deviationSeconds).toBeGreaterThanOrEqual(1);
      expectStoredEvidence(trace, subject.id);
      const row = psql(`select jsonb_build_object(
        'state', s.state, 'version', s.version::text, 'attemptCount', s.attempt_count,
        'leaseClear', s.lease_id is null and s.lease_until is null,
        'actualMatches', platform_private.auth_iso_time(s.actual_at_utc) = '${result.actualUtc}',
        'deviation', s.deviation_seconds,
        'roundedDeviation', round(extract(epoch from s.actual_at_utc - s.resolved_at_utc)),
        'publicationState', p.state, 'action', p.action,
        'revisionMatches', p.revision_id = '${subject.draft.revisionId}'::uuid,
        'publicationVersion', p.version::text)
        from platform_private.cms_publication_schedules s
        join platform_private.cms_publication_versions p on p.schedule_id = s.id
        where s.id = '${subject.id}' and p.id = '${result.publicationVersionId}'`);
      expectSafeEqual(
        JSON.parse(row),
        {
          state: 'completed',
          version: '3',
          attemptCount: 0,
          leaseClear: true,
          actualMatches: true,
          deviation: result.deviationSeconds,
          roundedDeviation: result.deviationSeconds,
          publicationState: subject.action === 'publish' ? 'active' : 'revoked',
          action: subject.action,
          revisionMatches: true,
          publicationVersion: subject.headId === null ? '1' : '2',
        },
        'actual row state and lineage action',
      );
      if (subject.headId !== null) {
        expect(
          psql(`select count(*) from platform_private.cms_publication_versions successor
          join platform_private.cms_publication_versions prior on prior.id = successor.supersedes_id
          where successor.id = '${result.publicationVersionId}' and prior.id = '${subject.headId}'
            and prior.state = 'active' and prior.version = 1
            and successor.publication_id = prior.publication_id
            and successor.revision_id = prior.revision_id
            and successor.dependency_hash = prior.dependency_hash
            and successor.activation_evidence_hash = prior.activation_evidence_hash
            and successor.version_set = prior.version_set
            and successor.schema_artifact_id = prior.schema_artifact_id
            and successor.schema_artifact_hash = prior.schema_artifact_hash
            and successor.settings_version = prior.settings_version`),
        ).toBe('1');
      }
    }
    expectScheduleEffects(before, snapshotDigest(), {
      'platform_private.cms_publication_schedules': 0,
      'platform_private.cms_publication_versions': 4,
      'platform_private.cms_command_accessibility_evidence': 4,
      'platform_private.outbox_events': 4,
      'audit_private.audit_events': 4 + recoveredCount,
    });
  }, 150_000);

  it('[CMS-03B-20] every completed execution replays all typed fields and has zero full-row effects', async () => {
    for (const subject of subjects) {
      const { call, result } = executionOf(trace, subject.id);
      const before = snapshotDigest();
      const replay = await replayExecution(call.request);
      expectSafeEqual(
        replay,
        { ...result, outcome: 'already_completed' },
        'complete internal replay identity',
      );
      expectUnchanged(
        before,
        snapshotDigest(),
        'already-completed replay preserves all fourteen groups',
      );
    }
  });

  it('[CMS-03B-20] public revision append after actual claim blocks changed approval with exact effects', async () => {
    const draft = await approvedDraft(stack, world, 'Changed claimed approval');
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
    await sleepUntil(schedule.resolvedUtc);
    let beforeExecute: ReturnType<typeof snapshotDigest> | undefined;
    const trace = await tick([], async (request) => {
      if (request.scheduleId !== schedule.id) return;
      // Read actual CAS values; invoke the public append, which invalidates the
      // approved review. No review/schedule row or guarded field is edited here.
      const [version, revisionNumber] =
        psql(`select e.version, r.revision_number
        from platform_private.cms_content_entries e
        join platform_private.cms_entry_revisions r on r.id = '${draft.revisionId}'
        where e.id = '${draft.entryId}'`).split('|');
      if (version === undefined || revisionNumber === undefined)
        throw new Error('canonical revision append operands missing');
      stack.as(world.owner);
      const appended = await stack.post(
        `/api/v1/cms/entries/${draft.entryId}/revisions`,
        {
          body: appendEntryBody(
            world.editorial,
            draft.entryId,
            'New canonical revision',
            revisionNumber,
            version,
          ),
          ifMatch: version,
        },
      );
      expectStatus(appended, 201);
      beforeExecute = snapshotDigest();
    });
    expectOperandChain(trace);
    expectSafeEqual(
      executionOf(trace, schedule.id).result,
      {
        scheduleId: schedule.id,
        outcome: 'blocked',
        reasonCode: 'approval_invalidated',
        publicationVersionId: null,
        actualUtc: null,
        deviationSeconds: null,
      },
      'changed approval typed result',
    );
    if (beforeExecute === undefined)
      throw new Error('actual execution barrier was not reached');
    expectScheduleEffects(beforeExecute, snapshotDigest(), {
      'platform_private.cms_publication_schedules': 0,
      'audit_private.audit_events': 1,
    });
    expect(
      psql(`select state || '/' || version || '/' || coalesce(reason_code, '-')
      from platform_private.cms_publication_schedules where id = '${schedule.id}'`),
    ).toBe('blocked/3/approval_invalidated');
  }, 150_000);
});
