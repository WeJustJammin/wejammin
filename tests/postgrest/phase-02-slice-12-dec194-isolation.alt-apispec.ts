/** DEC-194 local real-HTTP isolation proof; fixture setup is not producer evidence. */
import { createHash } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  openDec194AltStack,
  sql,
  type Dec194AltStack,
  type IsolationWorld,
} from './support/phase-02-slice-12-dec194-alt-stack';
import {
  createDec194IsolationWorker,
  type Producer,
} from './support/phase-02-slice-12-dec194-isolation-worker';
import { finishDec194IsolationRun } from './support/phase-02-slice-12-dec194-lifecycle';

type Row = Record<string, unknown> & { id: string };
type Snapshot = {
  jobs: Row[];
  events: Row[];
  audit: Row[];
  receipts: Row[];
  associations: {
    failed_job_id: string;
    recovery_job_id: string;
    requested_at: string;
  }[];
  rollbackDigest: string;
};
type Observation = {
  producer: Producer;
  nonce: string;
  job_id: string;
  isolation: string;
  backend_pid: number;
  transaction_id: string;
  service_claim: boolean;
  service_role: boolean;
  cms_rpc: boolean;
  public_caller: boolean;
  private_caller: boolean;
  acceptance_caller: boolean;
};
type Facts = {
  work: number;
  sourceAssignments: number;
  survivorAssignments: number;
  sourceState: string;
  sourceSurvivor: string | null;
  live: number;
};
const clockSql = 'select to_jsonb(pg_catalog.clock_timestamp());';
const hash = (value: string): string =>
  `\\x${createHash('sha256').update(value).digest('hex')}`;
let stack: Dec194AltStack | undefined;
let world: IsolationWorld;
let worker: ReturnType<typeof createDec194IsolationWorker>;

const current = (): Dec194AltStack => {
  if (stack === undefined) throw new Error('explicit ALT setup missing');
  return stack;
};
const snapshot = (): Snapshot =>
  current().json(`select ${current().schema}.snapshot();`);
const facts = (): Facts =>
  current().json(`select ${current().schema}.facts();`);
const observations = (): Observation[] =>
  current().json(`
  select coalesce(jsonb_agg(to_jsonb(o) order by producer), '[]'::jsonb)
    from ${current().schema}.observations o;`);

const observed = (producer: Producer, jobId: string): Observation => {
  const rows = observations().filter((row) => row.producer === producer);
  expect(
    rows,
    `${producer}: exactly one nonce-scoped real insertion`,
  ).toHaveLength(1);
  const row = rows[0]!;
  expect(row).toMatchObject({
    producer,
    nonce: current().nonce,
    job_id: jobId,
    isolation: 'read committed',
    service_claim: true,
    service_role: true,
    cms_rpc: true,
    public_caller: true,
    private_caller: true,
    acceptance_caller: true,
  });
  expect(row.backend_pid).toBeGreaterThan(0);
  expect(row.transaction_id).toMatch(/^[1-9][0-9]*$/u);
  const trace = worker.traces.filter((entry) => entry.producer === producer);
  expect(
    trace,
    `${producer}: actual production transport request`,
  ).toHaveLength(1);
  expect(trace[0]).toMatchObject({
    status: 200,
    opaqueApikeyOnly: true,
    platformProfile: true,
    abortable: true,
  });
  return row;
};

const accepted = (
  before: Snapshot,
  after: Snapshot,
  key: string,
  requestKey: string,
): Row => {
  for (const store of ['jobs', 'events', 'audit', 'receipts'] as const) {
    expect(
      after[store].length - before[store].length,
      `one ${store} acceptance effect`,
    ).toBe(1);
    for (const row of before[store])
      expect(after[store].find((candidate) => candidate.id === row.id)).toEqual(
        row,
      );
  }
  const added = after.jobs.filter(
    (job) => !before.jobs.some((old) => old.id === job.id),
  );
  expect(added).toHaveLength(1);
  const job = added[0]!;
  expect(job).toMatchObject({
    job_type: worker.type,
    actor_id: world.authUserId,
    acting_party_id: world.partyId,
    state: 'queued',
    version: 1,
  });
  const events = after.events.filter((event) => event.aggregate_id === job.id);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    id: job.originating_event_id,
    event_type: 'job.requested',
    aggregate_type: 'job',
    aggregate_version: 1,
    schema_version: 1,
    correlation_id: job.correlation_id,
    payload: { jobId: job.id, jobType: worker.type },
  });
  const audits = after.audit.filter((audit) => audit.target_id === job.id);
  expect(audits).toHaveLength(1);
  expect(audits[0]).toMatchObject({
    action: 'job.accepted',
    actor_id: world.authUserId,
    acting_party_id: world.partyId,
    target_type: 'job',
    correlation_id: job.correlation_id,
    decision: 'allowed',
    reason_code: 'JOB_ACCEPTED',
  });
  const receipts = after.receipts.filter(
    (receipt) =>
      receipt.key_hash === hash(key) && receipt.actor_id === world.authUserId,
  );
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatchObject({
    operation: worker.type,
    state: 'completed',
    request_hash: hash(requestKey),
    response_ref: {
      status: 202,
      jobRef: job.id,
      resourceRef: `/api/v1/jobs/${job.id}`,
    },
  });
  return job;
};

describe('DEC-194 unchanged Worker RPC transaction isolation (explicit local ALT only)', () => {
  beforeAll(async () => {
    stack = openDec194AltStack();
    world = stack.prepareFixture();
    worker = createDec194IsolationWorker(stack, world);
    // Must precede probe activation and all three tested mutations. A unique,
    // freshly committed fixture identity detects mismatched API/SQL databases.
    await worker.checkCanonicalUpstream();
    stack.activateProbe();
    expect(observations()).toEqual([]);
  }, 150_000);

  afterAll(() => finishDec194IsolationRun({ stack, worker }));

  it('DEC194-RPC-001/002/003 actual isolation (or explicitly selected test-probe sensitivity)', async () => {
    expect(facts()).toMatchObject({
      work: 0,
      sourceAssignments: 10001,
      survivorAssignments: 0,
      sourceSurvivor: null,
      live: 0,
    });
    const beforeOrdinary = snapshot();
    const response = await worker.ordinary();
    if (current().nonRcExpected !== undefined) {
      // Deliberate probe exception proves instrumentation, NOT a production guard.
      // An ignored role override emits another token and MUST fail this case.
      expect(response.status).toBeGreaterThanOrEqual(400);
      const trace = worker.traces.filter(
        (entry) => entry.producer === 'ordinary',
      );
      expect(trace).toHaveLength(1);
      expect(trace[0]!.response).toMatchObject({
        code: 'P0001',
        message: `DEC194_PROBE_NON_RC_${current().nonRcExpected!.toUpperCase().replaceAll(' ', '_')}`,
      });
      expect(snapshot()).toEqual(beforeOrdinary);
      expect(observations()).toEqual([]);
      expect(facts()).toMatchObject({
        work: 0,
        sourceAssignments: 10001,
        survivorAssignments: 0,
        sourceSurvivor: null,
        live: 0,
      });
      return;
    }
    expect(response.status, 'DEC194-RPC-001 real Hono merge succeeds').toBe(
      200,
    );
    const term = (await response.json()) as { id: string };
    expect(term.id).toBe(world.sourceId);
    const ordinary = accepted(
      beforeOrdinary,
      snapshot(),
      `${worker.type}:${world.sourceId}`,
      `${worker.type}:${world.partyId}:${world.sourceId}`,
    );
    const first = observed('ordinary', ordinary.id);
    expect(
      worker.traces.find((entry) => entry.producer === 'ordinary'),
    ).toMatchObject({
      operation: 'cms_act_taxonomy_term',
      request: {
        p_request: {
          action: 'merge',
          taxonomyId: world.taxonomyId,
          termKey: world.sourceKey,
          expectedVersion: world.expectedVersion,
          ifMatch: world.expectedVersion,
          context: {
            authUserId: world.authUserId,
            actorPersonId: world.personId,
            actingPartyId: world.partyId,
          },
        },
      },
    });
    expect(facts()).toMatchObject({
      work: 5001,
      sourceAssignments: 5001,
      survivorAssignments: 5000,
      sourceState: 'merged',
      sourceSurvivor: world.survivorId,
      live: 1,
    });

    const claimed = await worker.claim(ordinary.id); // FIXTURE setup via real BE00 HTTP.
    const beforeContinuation = snapshot();
    const result = await worker.continuation(claimed);
    expect(result.state, 'DEC194-RPC-002 actual Worker effect succeeds').toBe(
      'succeeded',
    );
    const continuation = accepted(
      beforeContinuation,
      snapshot(),
      `${worker.type}.continuation:${ordinary.id}`,
      `${worker.type}.continuation:${world.partyId}:${ordinary.id}`,
    );
    expect(continuation.correlation_id).toBe(ordinary.correlation_id);
    expect(result).toEqual({
      state: 'succeeded',
      errorCode: null,
      resultRef: { type: worker.type, id: continuation.id },
    });
    const second = observed('continuation', continuation.id);
    expect(
      worker.traces.find((entry) => entry.producer === 'continuation'),
    ).toMatchObject({
      operation: 'cms_run_taxonomy_merge_converge',
      request: {
        p_request: {
          claimedJob: {
            jobId: ordinary.id,
            version: claimed.claimedLease!.version,
            leaseToken: claimed.leaseToken,
          },
        },
      },
      response: {
        converged: 5000,
        remaining: 1,
        continuationJobId: continuation.id,
      },
    });
    const sent = worker.traces.find(
      (entry) => entry.producer === 'continuation',
    )!.request;
    expect(sent).toEqual({
      p_request: {
        claimedJob: {
          jobId: ordinary.id,
          version: claimed.claimedLease!.version,
          leaseToken: claimed.leaseToken,
        },
      },
    });
    expect(facts()).toMatchObject({
      work: 1,
      sourceAssignments: 1,
      survivorAssignments: 10000,
      live: 2,
    });

    // Labelled prior-delivery fixture: use real BE00 outcomes, then shift ONLY
    // timestamps together. No canonical state/token/version/result is forged.
    await worker.settle(claimed, 'succeeded', result.resultRef);
    const failed = await worker.claim(continuation.id);
    await worker.settle(failed, 'failed', null);
    current().psql(`update platform_private.jobs
      set created_at = created_at - interval '20 minutes', updated_at = updated_at - interval '20 minutes'
      where id in (${sql(world.upstreamJobId)}::uuid, ${sql(ordinary.id)}::uuid, ${sql(continuation.id)}::uuid);`);
    expect(facts()).toMatchObject({ work: 1, live: 0 });
    const beforeRecovery = snapshot();
    const recoveryStarted = current().json<string>(clockSql);
    await worker.recovery();
    const recoveryCompleted = current().json<string>(clockSql);
    const final = snapshot();
    const recovery = accepted(
      beforeRecovery,
      final,
      `${worker.type}.reconcile:${continuation.id}`,
      `${worker.type}.reconcile:${world.partyId}:${continuation.id}`,
    );
    expect(recovery.correlation_id).toBe(continuation.correlation_id);
    const third = observed('recovery', recovery.id);
    expect(
      worker.traces.find((entry) => entry.producer === 'recovery'),
    ).toMatchObject({
      operation: 'cms_reconcile_taxonomy_merge_converge',
      request: {},
      response: { requested: 1 },
    });
    const association = final.associations.find(
      (row) => row.failed_job_id === continuation.id,
    );
    expect(association?.requested_at).toEqual(expect.any(String));
    expect(Number.isFinite(Date.parse(association!.requested_at))).toBe(true);
    expect(
      current().json<boolean>(`select to_jsonb(
      ${sql(association!.requested_at)}::timestamptz >= ${sql(recoveryStarted)}::timestamptz
      and ${sql(association!.requested_at)}::timestamptz <= ${sql(recoveryCompleted)}::timestamptz);`),
    ).toBe(true);
    expect(final.associations).toEqual([
      ...beforeRecovery.associations,
      {
        failed_job_id: continuation.id,
        recovery_job_id: recovery.id,
        requested_at: association!.requested_at,
      },
    ]);
    expect(facts()).toEqual({
      work: 1,
      sourceAssignments: 1,
      survivorAssignments: 10000,
      sourceState: 'merged',
      sourceSurvivor: world.survivorId,
      live: 1,
    });
    expect(observations()).toHaveLength(3);
    expect(
      new Set([
        first.transaction_id,
        second.transaction_id,
        third.transaction_id,
      ]).size,
    ).toBe(3);
    console.info(
      'DEC194_RPC_ISOLATION_SAFE_OBSERVATIONS',
      JSON.stringify(observations()),
    );
    for (const job of [ordinary, continuation, recovery]) {
      const api = await worker.readCanonical(job.id);
      const persisted = final.jobs.find((row) => row.id === job.id)!;
      expect(api).toMatchObject({
        id: persisted.id,
        type: persisted.job_type,
        state: persisted.state,
        version: String(persisted.version),
      });
    }
  }, 60_000);
});
