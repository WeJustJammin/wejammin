/** Genuine origin identity reads; no execution, current-attempt, or ACK authority. */
import { createHash, randomUUID } from 'node:crypto';

import type { QueueEnvelope } from '@wejammin/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import { parseCanonicalJob } from '../../apps/worker/src/async-runtime-parsing';
import { ClaimRequestedEventSchema } from '../../apps/worker/src/content-schema-registry/schema-dry-run-claim-shape';
import { expectSafeEqual } from './support/phase-02-slice-11-assert';
import {
  claimAttempt,
  legacyRequest,
  observeRead,
  originalEvent,
  prepareClaimAttempt,
  record,
  selectJson,
  selectText,
  type ClaimAttempt,
} from './support/phase-02-slice-11-claimed-dry-run-fixture';
import { storedProjection } from './support/phase-02-slice-11-claimed-dry-run-oracles';
import { callRpc, tokenFor, userToken } from './support/stack';

let first: ClaimAttempt;
let second: ClaimAttempt;
beforeAll(async () => {
  first = await prepareClaimAttempt();
  second = await prepareClaimAttempt(first.owner);
});
const equal = (actual: unknown, expected: unknown) =>
  expectSafeEqual(actual, expected, 'origin admission invariant');
const storedOrigin = (jobId: string) =>
  selectJson(`select jsonb_build_object('job', to_jsonb(j), 'event', to_jsonb(e))::text
    from platform_private.jobs j join platform_private.outbox_events e
      on e.id = j.originating_event_id where j.id = '${jobId}'`);
const canonical = async (jobId: string) => {
  const response = await observeRead(() =>
    callRpc('read_canonical_job', tokenFor('service_role'), {
      p_job_id: jobId,
    }),
  );
  expect(response.status).toBe(200);
  const job = parseCanonicalJob(response.body);
  if (job === null) throw new Error('Actual canonical job is invalid');
  return job;
};
const readOrigin = async (
  request: unknown,
  jobs: string[] = [first.report.jobId, second.report.jobId],
  token: string | null = tokenFor('service_role'),
  attempts: ClaimAttempt[] = [],
) => {
  const projection = () => [
    storedProjection(first),
    storedProjection(second),
    ...attempts.map(storedProjection),
    ...jobs.map(storedOrigin),
  ];
  const before = projection();
  try {
    return await observeRead(() =>
      callRpc('cms_get_schema_migration_plan', token, { p_request: request }),
    );
  } finally {
    equal(projection(), before);
  }
};
const accepts = async (
  event: QueueEnvelope,
  expected: boolean,
  jobs?: string[],
  attempts?: ClaimAttempt[],
) => {
  expect(ClaimRequestedEventSchema.safeParse(event).success).toBe(true);
  const response = await readOrigin(
    { originEvent: event },
    jobs,
    undefined,
    attempts,
  );
  equal([response.status, response.body], [200, expected]);
};
const grammarFailure = async (request: unknown) => {
  const response = await readOrigin(request);
  equal(
    [response.status, response.code, response.message],
    [400, 'P0001', 'INVALID_REQUEST'],
  );
};
const eventKeys = [
  'eventId',
  'eventType',
  'schemaVersion',
  'aggregateType',
  'aggregateId',
  'aggregateVersion',
  'correlationId',
  'causationId',
] as const;
const invalidFields: ReadonlyArray<readonly [string, unknown]> = [
  ['eventType', 'job.completed'],
  ['schemaVersion', 2],
  ['aggregateType', 'content'],
  ['eventType', null],
  ['schemaVersion', '1'],
  ['aggregateType', []],
  ['eventId', 'invalid'],
  ['aggregateId', null],
  ['correlationId', false],
  ['causationId', 1],
  ['eventId', 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'],
  ['eventId', '00000000-0000-0000-0000-000000000000'],
  ['aggregateId', '00000000-0000-0000-0000-000000000000'],
  ['correlationId', '00000000-0000-0000-0000-000000000000'],
  ['causationId', '00000000-0000-0000-0000-000000000000'],
  ...[
    '0',
    '01',
    '+1',
    '-1',
    '1.2',
    '1e3',
    ' 1',
    '1 ',
    '',
    '9223372036854775808',
    '10000000000000000000',
    1,
    null,
    true,
    [],
    {},
  ].map((value): readonly [string, unknown] => ['aggregateVersion', value]),
];

describe('S11 genuine CMS dry-run origin admission', () => {
  it('retains the whole original origin across actual claim heartbeat and queued outcome', async () => {
    const attempt = await prepareClaimAttempt(first.owner);
    const event = originalEvent(attempt.report.jobId);
    const jobs = [attempt.report.jobId];
    const queued = await canonical(attempt.report.jobId);
    equal(
      [queued.state, queued.version, queued.leaseUntilMs],
      ['queued', attempt.preclaimVersion, null],
    );
    await accepts(event, true, jobs, [attempt]);
    const claim = await claimAttempt(attempt, 600);
    const held = await canonical(attempt.report.jobId);
    equal([held.state, held.version], ['running', claim.claimedJob.version]);
    expect(held.version !== queued.version && held.leaseUntilMs !== null).toBe(
      true,
    );
    equal(originalEvent(attempt.report.jobId), event);
    await accepts(event, true, jobs, [attempt]);
    const heartbeat = await callRpc(
      'heartbeat_job_lease',
      tokenFor('service_role'),
      {
        p_job_id: held.id,
        p_expected_version: held.version,
        p_lease_token: claim.claimedJob.leaseToken,
        p_lease_seconds: 840,
      },
    );
    equal([heartbeat.status, heartbeat.body], [200, true]);
    const renewed = await canonical(held.id);
    equal(
      [renewed.id, renewed.type, renewed.state],
      [held.id, held.type, 'running'],
    );
    expect(
      renewed.version !== held.version &&
        renewed.leaseUntilMs !== null &&
        held.leaseUntilMs !== null &&
        renewed.leaseUntilMs > held.leaseUntilMs,
    ).toBe(true);
    equal(
      record(storedOrigin(held.id).job).lease_token,
      claim.claimedJob.leaseToken,
    );
    equal(originalEvent(held.id), event);
    await accepts(event, true, jobs, [attempt]);
    const outcome = await callRpc(
      'apply_job_outcome',
      tokenFor('service_role'),
      {
        p_job_id: renewed.id,
        p_expected_version: renewed.version,
        p_lease_token: claim.claimedJob.leaseToken,
        p_next_state: 'queued',
        p_result_ref: null,
        p_error_code: 'DEPENDENCY_UNAVAILABLE',
        p_retryable: true,
      },
    );
    equal([outcome.status, outcome.body], [200, true]);
    const retried = await canonical(renewed.id);
    equal(
      [retried.id, retried.type, retried.state, retried.leaseUntilMs],
      [renewed.id, renewed.type, 'queued', null],
    );
    expect(retried.version !== renewed.version).toBe(true);
    equal(record(storedOrigin(renewed.id).job).lease_token, null);
    equal(originalEvent(renewed.id), event);
    await accepts(event, true, jobs, [attempt]);
  }, 120_000);

  it('accepts both whole genuine CMS origins but refuses their crossed provenance', async () => {
    expect(
      first.report.jobId !== second.report.jobId &&
        first.event.eventId !== second.event.eventId,
    ).toBe(true);
    await accepts(first.event, true);
    await accepts(second.event, true);
    await accepts({ ...first.event, eventId: second.event.eventId }, false);
    await accepts({ ...second.event, eventId: first.event.eventId }, false);
  });

  it.each([
    'eventId',
    'aggregateId',
    'aggregateVersion',
    'correlationId',
    'causationId',
  ] as const)(
    'refuses an independently mismatched grammar-valid original %s',
    async (key) => {
      const value =
        key === 'aggregateVersion' ? '9223372036854775807' : randomUUID();
      expect(value !== first.event[key]).toBe(true);
      await accepts({ ...first.event, [key]: value }, false);
    },
  );

  it('returns false for a correct whole genuine registered non-CMS origin', async () => {
    const jobId = randomUUID();
    const eventId = randomUUID();
    const correlationId = randomUUID();
    const hash = () =>
      `\\x${createHash('sha256').update(randomUUID()).digest('hex')}`;
    const response = await callRpc(
      'accept_job_with_outbox',
      tokenFor('service_role'),
      {
        p_actor_id: first.owner.personId,
        p_acting_party_id: first.owner.organizationId,
        p_job_type: 'platform.job.execute',
        p_correlation_id: correlationId,
        p_idempotency_key_hash: hash(),
        p_request_hash: hash(),
        p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        p_job_id: jobId,
        p_event_id: eventId,
      },
    );
    expect(response.status).toBe(200);
    if (!Array.isArray(response.body) || response.body.length !== 1)
      throw new Error('Actual non-CMS acceptance must return one row');
    const accepted = record(response.body[0]);
    equal(
      [accepted.job_id, accepted.event_id, accepted.replayed],
      [jobId, eventId, false],
    );
    const job = await canonical(jobId);
    equal(
      [job.id, job.type, job.state],
      [jobId, 'platform.job.execute', 'queued'],
    );
    const event = originalEvent(jobId);
    equal(
      [event.eventId, event.aggregateId, event.correlationId],
      [eventId, jobId, correlationId],
    );
    equal(record(storedOrigin(jobId).event).payload, {
      jobId,
      jobType: 'platform.job.execute',
    });
    expect(
      selectText(`select exists(select 1 from platform_private.job_type_registry
      where job_type = 'platform.job.execute')`) === 't',
    ).toBe(true);
    await accepts(event, false, [jobId]);
  });

  // The remaining three tuple members are fixed grammar, not semantic false cases.
  it.each(invalidFields)(
    'rejects malformed event %s=%j',
    async (key, value) => {
      const event = { ...first.event, [key]: value };
      expect(ClaimRequestedEventSchema.safeParse(event).success).toBe(false);
      await grammarFailure({ originEvent: event });
    },
  );
  it.each(eventKeys)('rejects the event missing %s', async (key) => {
    const event = Object.fromEntries(
      Object.entries(first.event).filter(([k]) => k !== key),
    );
    await grammarFailure({ originEvent: event });
  });
  it.each([[null], [[]], ['event'], [1], [false]])(
    'rejects non-object originEvent %j',
    async (event) => {
      await grammarFailure({ originEvent: event });
    },
  );
  it('rejects missing extra ninth and wrong root keys before lookup', async () => {
    for (const request of [
      null,
      [],
      'request',
      {},
      { originEvent: first.event, extra: true },
      { originEvent: { ...first.event, ninth: true } },
      { event: first.event },
      { originEvent: first.event, claimedJob: {} },
    ])
      await grammarFailure(request);
  });
  it('rejects the old claimed key and mixed origin request shapes', async () => {
    await grammarFailure({ requestedEvent: first.event });
    const claim = await claimAttempt(second);
    await grammarFailure({ ...claim, originEvent: second.event });
    await grammarFailure({ ...legacyRequest(first), originEvent: first.event });
  });
  it.each(['authenticated', 'anon', 'missing'] as const)(
    'preserves the existing service-only ACL for %s',
    async (role) => {
      const token =
        role === 'authenticated'
          ? userToken(first.owner.authUserId)
          : role === 'anon'
            ? tokenFor('anon')
            : null;
      const response = await readOrigin(
        { originEvent: first.event },
        undefined,
        token,
      );
      equal(
        [response.status, response.code],
        [role === 'authenticated' ? 403 : 401, '42501'],
      );
    },
  );
});
