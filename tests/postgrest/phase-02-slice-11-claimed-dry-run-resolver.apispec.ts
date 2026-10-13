/** Genuine proposed resolver branch: no worker, sealing, approval or activation. */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import { MigrationPlanRecordSchema } from '../../apps/worker/src/content-schema-registry/migration-worker-plan-record-schema';
import type { CmsSchemaDryRunClaimRequest } from '../../apps/worker/src/content-schema-registry/schema-dry-run-claim-request';
import {
  expectSafeEqual,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  claimJobLeaseProjectionRowText,
  claimJobLeaseTextLength,
  snapshotClaimResolver,
} from './support/phase-02-slice-11-claim-resolver-snapshot';
import {
  claimAttempt,
  legacyRequest,
  prepareClaimAttempt,
  record,
  resolveClaim,
  selectText,
  supersedeAttempt,
  type ClaimAttempt,
} from './support/phase-02-slice-11-claimed-dry-run-fixture';
import {
  accepted,
  assertSupersession,
  attemptState,
  refusal,
  storedProjection,
} from './support/phase-02-slice-11-claimed-dry-run-oracles';
import { tokenFor, userToken } from './support/stack';

let first: ClaimAttempt;
let second: ClaimAttempt;
let request: CmsSchemaDryRunClaimRequest;
let other: CmsSchemaDryRunClaimRequest;

beforeAll(async () => {
  first = await prepareClaimAttempt();
  second = await prepareClaimAttempt(first.owner);
  request = await claimAttempt(first);
  other = await claimAttempt(second);
});

const malformed = (
  level: 'outer' | 'claimedJob' | 'requestedEvent',
  key: string,
  remove: boolean,
) => {
  const target: Record<string, unknown> =
    level === 'outer' ? { ...request } : { ...request[level] };
  if (remove) delete target[key];
  else target[key] = true;
  return level === 'outer' ? target : { ...request, [level]: target };
};
const LEVELS = [
  { level: 'outer', keys: ['claimedJob', 'requestedEvent'] },
  { level: 'claimedJob', keys: ['jobId', 'version', 'leaseToken'] },
  {
    level: 'requestedEvent',
    keys: [
      'eventId',
      'eventType',
      'schemaVersion',
      'aggregateType',
      'aggregateId',
      'aggregateVersion',
      'correlationId',
      'causationId',
    ],
  },
] as const;
const MISSING = LEVELS.flatMap(({ level, keys }) =>
  keys.map((key) => ({ level, key })),
);

describe('genuine claimed dry-run resolver API', () => {
  it('returns the coherent live claim projection and repeats without effects', async () => {
    const initial = await accepted(first, request);
    expectSafeEqual(
      await accepted(first, request),
      initial,
      'repeated projection',
    );
  });
  it('accepts a fully coherent second real job rather than blanket foreign-job refusal', async () => {
    await accepted(second, other);
  });
  it.each(MISSING)(
    'rejects missing $level.$key at the SQL request boundary',
    async ({ level, key }) => {
      refusal(
        await resolveClaim(malformed(level, key, true)),
        'INVALID_REQUEST',
      );
    },
  );
  it.each(LEVELS)(
    'rejects an extra $level key at the SQL request boundary',
    async ({ level }) => {
      refusal(
        await resolveClaim(malformed(level, 'extra', false)),
        'INVALID_REQUEST',
      );
    },
  );
  it('rejects mixed legacy and claimed request shapes', async () => {
    refusal(
      await resolveClaim({ ...request, ...legacyRequest(first) }),
      'INVALID_REQUEST',
    );
  });
  it.each([null, []])(
    'rejects nonobject claim %j at the SQL request boundary',
    async (claimedJob) => {
      refusal(
        await resolveClaim({ ...request, claimedJob }),
        'INVALID_REQUEST',
      );
    },
  );
  it.each([
    ['claimedJob', 'version', 2],
    ['claimedJob', 'leaseToken', 'not-a-uuid'],
    ['requestedEvent', 'aggregateVersion', 1],
    ['requestedEvent', 'eventType', 'object.uploaded'],
    ['requestedEvent', 'schemaVersion', 2],
    ['requestedEvent', 'aggregateType', 'object'],
  ] as const)(
    'rejects malformed %s.%s at the SQL request boundary',
    async (level, key, value) => {
      refusal(
        await resolveClaim({
          ...request,
          [level]: { ...request[level], [key]: value },
        }),
        'INVALID_REQUEST',
      );
    },
  );
  it('refuses a syntactically valid absent job', async () => {
    const missing = randomUUID();
    expect(
      selectText(
        `select count(*) from platform_private.jobs where id = '${missing}'`,
      ) === '0',
      'absent job precondition',
    ).toBe(true);
    refusal(
      await resolveClaim({
        claimedJob: { ...request.claimedJob, jobId: missing },
        requestedEvent: { ...request.requestedEvent, aggregateId: missing },
      }),
      'NOT_FOUND',
    );
  });
  it('refuses an actual queued job before any BE00 claim', async () => {
    const queued = await prepareClaimAttempt(first.owner);
    refusal(
      await resolveClaim({
        claimedJob: {
          jobId: queued.report.jobId,
          version: queued.preclaimVersion,
          leaseToken: randomUUID(),
        },
        requestedEvent: queued.event,
      }),
      'CONFLICT',
    );
  });
  it('refuses the stale actual preclaim version with the current claim token', async () => {
    expect(
      request.claimedJob.version !== first.preclaimVersion,
      'claim advanced actual version',
    ).toBe(true);
    refusal(
      await resolveClaim({
        ...request,
        claimedJob: { ...request.claimedJob, version: first.preclaimVersion },
      }),
      'CONFLICT',
    );
  });
  it('refuses a wrong valid UUID token for the live claim', async () => {
    refusal(
      await resolveClaim({
        ...request,
        claimedJob: { ...request.claimedJob, leaseToken: randomUUID() },
      }),
      'CONFLICT',
    );
  });
  it('refuses an actually expired one-second BE00 claim without injected time', async () => {
    const expiring = await prepareClaimAttempt(first.owner);
    const expired = await claimAttempt(expiring, 1);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(
      selectText(`select lease_until <= clock_timestamp() from platform_private.jobs
      where id = '${expiring.report.jobId}'`) === 't',
      'real lease expired',
    ).toBe(true);
    refusal(await resolveClaim(expired), 'CONFLICT');
  });
  it.each([
    'eventId',
    'aggregateVersion',
    'correlationId',
    'causationId',
  ] as const)(
    'refuses otherwise-valid changed original event %s',
    async (key) => {
      const replacement =
        key === 'aggregateVersion'
          ? request.requestedEvent.aggregateVersion === '9'
            ? '10'
            : '9'
          : randomUUID();
      refusal(
        await resolveClaim({
          ...request,
          requestedEvent: { ...request.requestedEvent, [key]: replacement },
        }),
        'CONFLICT',
      );
    },
  );
  it('refuses a transplanted second original event with first-job aggregate syntax aligned', async () => {
    refusal(
      await resolveClaim({
        ...request,
        requestedEvent: {
          ...other.requestedEvent,
          aggregateId: request.claimedJob.jobId,
        },
      }),
      'CONFLICT',
    );
  });
  it('refuses second-job claim bindings combined with first-job original event', async () => {
    refusal(
      await resolveClaim({
        ...other,
        requestedEvent: {
          ...request.requestedEvent,
          aggregateId: other.claimedJob.jobId,
        },
      }),
      'CONFLICT',
    );
  });
  it.each(['authenticated', 'anon', 'missing'] as const)(
    'denies the %s non-service caller',
    async (role) => {
      const token =
        role === 'authenticated'
          ? userToken(first.owner.authUserId)
          : role === 'anon'
            ? tokenFor('anon')
            : null;
      const response = await resolveClaim(request, token);
      expectSafeEqual(
        [response.status, response.code],
        [role === 'authenticated' ? 403 : 401, '42501'],
        'protected reader role denial',
      );
    },
  );
  it('preserves the legacy first-null three-key reader and exact existing plan projection', async () => {
    const response = await resolveClaim(legacyRequest(first));
    expect(response.status, 'legacy reader status').toBe(200);
    const parsed = MigrationPlanRecordSchema.safeParse(response.body);
    expect(parsed.success, 'legacy strict 23-key plan').toBe(true);
    if (!parsed.success) throw new Error('Legacy plan response is invalid');
    expect(Object.keys(parsed.data)).toHaveLength(23);
    expectSafeEqual(
      parsed.data,
      storedProjection(first).plan,
      'legacy stored plan projection',
    );
  });
  it('preserves legacy wrong-target conflict', async () => {
    refusal(
      await resolveClaim({
        ...legacyRequest(first),
        schemaVersionId: second.versionId,
      }),
      'CONFLICT',
    );
  });
  it('preserves legacy stale actual plan-version conflict after legal supersession', async () => {
    const old = await prepareClaimAttempt(first.owner);
    const stale = legacyRequest(old);
    await supersedeAttempt(old);
    expect(
      legacyRequest(old).expectedVersion !== stale.expectedVersion,
      'stored plan version advanced',
    ).toBe(true);
    refusal(await resolveClaim(stale), 'CONFLICT');
  });
  it('refuses the superseded old live claim and accepts the genuinely claimed replacement attempt', async () => {
    const old = await prepareClaimAttempt(first.owner);
    const oldRequest = await claimAttempt(old);
    const before = attemptState(old);
    const newer = await supersedeAttempt(old);
    const after = attemptState(old);
    const fresh = attemptState(newer);
    assertSupersession({ old, oldRequest, before, newer, after, fresh });
    const newRequest = await claimAttempt(newer);
    refusal(await resolveClaim(oldRequest), 'CONFLICT');
    await accepted(newer, newRequest);
  });
  it('detects same-length lease-token projection changes with the actual whole-table observer', () => {
    const jobs = 'platform_private.jobs';
    const old = snapshotDigest();
    const baseline = snapshotClaimResolver();
    const length = claimJobLeaseTextLength();
    expect(length > 0, 'actual claimed token text exists').toBe(true);
    const projectedLength = Number(
      selectText(`select coalesce(sum(length(
      (${claimJobLeaseProjectionRowText})::jsonb->>'lease_token')), 0)
      from platform_private.jobs t`),
    );
    expect(projectedLength).toBe(length);
    const projected = snapshotClaimResolver({
      [jobs]: claimJobLeaseProjectionRowText,
    });
    expect(projected[jobs].split(':')[0]).toBe(baseline[jobs].split(':')[0]);
    expect(
      projected[jobs] !== baseline[jobs],
      'full-row digest sees changed token',
    ).toBe(true);
    for (const key of Object.keys(baseline))
      if (key !== jobs)
        expectSafeEqual(
          record(projected)[key],
          record(baseline)[key],
          'other group unchanged',
        );
    expectSafeEqual(
      snapshotClaimResolver({}, { valueBlind: true }),
      snapshotClaimResolver(
        { [jobs]: claimJobLeaseProjectionRowText },
        { valueBlind: true },
      ),
      'count-only observer cannot distinguish projected value',
    );
    expect(claimJobLeaseTextLength()).toBe(length);
    expectSafeEqual(
      snapshotClaimResolver(),
      baseline,
      'projection never changes stored rows',
    );
    expectSafeEqual(
      snapshotDigest(),
      old,
      'projection preserves old fourteen tables',
    );
  });
});
