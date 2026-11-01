/**
 * A behavioural model of the schema-migration plan as the worker RPCs see it (BE03a "Migration scan
 * protocol"): CAS on plan version and cursor, the plan lease, the state transitions of
 * `MIGRATION_STATE_TRANSITIONS`, 128-row pages and the rollback rules of `cms_rollback_schema_migration`
 * (a `dry_running` plan blocks and fails its report; `running`, `verifying` and `failed_retryable` plans
 * fail; every other state conflicts). Controlled replies only: it proves worker behaviour against the
 * documented RPC contract, not SQL authority (the apispec files do that).
 */
import type { JobEffectInput } from '@wejammin/application';

import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';
import type { MigrationPlanRecord } from './migration-worker-plan-schemas';
import { MigrationPlanRecordSchema } from './migration-worker-plan-schemas';
import type { MigrationWorkerPort } from './migration-worker-types';
import {
  IDS,
  responseFixture,
} from './schema-dry-run-claim-response-test-support';

export const SIM_WORKER = 'sim-worker';
export const ROW_HASH = '1'.repeat(64);
export const PRECLAIM = '9007199254740995';
export const ACQUIRED = '9007199254740997';
export const BE00_TOKEN = 'cccccccc-0000-4000-8000-000000000013';

const rowId = (index: number): string =>
  `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
const refusal = (code: string): Error =>
  // The production transport reports every refusal as a retryable DEPENDENCY_UNAVAILABLE; keep the code visible.
  Object.assign(new Error(code), { code, retryable: true });

export type SimulatorOptions = Readonly<{
  /** Source rows of the type; 0 is the DEC-162 first-empty shape. */
  rows: number;
  now?: () => number;
  leaseMs?: number;
  /** The state the plan starts in. */
  state?: MigrationPlanRecord['state'];
  /** Start with a lease held by the worker, expiring `leaseMs` after `now()`. */
  holdLease?: boolean;
  /** The cursor and counters a plan in a later state starts with. */
  cursor?: number;
}>;

export type PlanFault = Readonly<{
  /** Throws on the n-th call (1-based) of the RPC, then behaves normally. */
  rpc: string;
  nth?: number;
  error?: Error;
}>;

export const createPlanSimulator = (options: SimulatorOptions) => {
  const rows = options.rows;
  const now = options.now ?? (() => 1_000_000);
  const leaseMs = options.leaseMs ?? 30_000;
  const first = rows === 0;
  const plan: {
    -readonly [K in keyof MigrationPlanRecord]: MigrationPlanRecord[K];
  } = { ...responseFixture().plan };
  Object.assign(plan, {
    state: options.state ?? 'draft',
    version: '5',
    cursor: '0',
    progress: 0,
    sourceCount: String(rows),
    targetCount: '0',
    rowErrorCount: '0',
    migratedCount: '0',
    failedCount: '0',
    classification: 'additive',
    transformKey: null,
    transformVersion: null,
    fromVersionId: first ? null : IDS.source,
    activeVersionId: first ? null : IDS.source,
    sourceHash: first ? '0'.repeat(64) : 'b'.repeat(64),
    leaseOwner: null,
    leaseToken: null,
    leaseExpiresAt: null,
  });
  let reportState = 'queued';
  let tokenCounter = 0;
  if (options.cursor !== undefined)
    Object.assign(plan, {
      cursor: String(options.cursor),
      progress: rows === 0 ? 1 : options.cursor / rows,
      targetCount: String(options.cursor),
      migratedCount:
        options.state === 'running' || options.state === 'verifying'
          ? String(options.cursor)
          : '0',
    });
  if (options.holdLease === true)
    Object.assign(plan, {
      leaseOwner: SIM_WORKER,
      leaseToken: 'dddddddd-0000-4000-8000-00000000ffff',
      leaseExpiresAt: new Date(now() + leaseMs).toISOString(),
    });
  const calls: Array<
    Readonly<{ rpc: string; request: Record<string, unknown> }>
  > = [];
  const faults: PlanFault[] = [];
  const counts = new Map<string, number>();
  const record = (): MigrationPlanRecord =>
    MigrationPlanRecordSchema.parse({ ...plan });
  const bump = (): void => {
    plan.version = String(BigInt(plan.version) + 1n);
  };
  const leaseLive = (token: unknown): boolean =>
    plan.leaseToken !== null &&
    plan.leaseToken === token &&
    plan.leaseExpiresAt !== null &&
    Date.parse(plan.leaseExpiresAt) > now();
  const ensure = (ok: boolean, code: string): void => {
    if (!ok) throw refusal(code);
  };
  const atPosition = (r: Record<string, unknown>): void =>
    ensure(
      r.expectedVersion === plan.version && r.cursor === plan.cursor,
      'CONFLICT',
    );
  const progressOf = (cursor: number): number =>
    rows === 0 ? 1 : Math.min(1, cursor / rows);
  const clearLease = (): void => {
    plan.leaseOwner = null;
    plan.leaseToken = null;
    plan.leaseExpiresAt = new Date(now()).toISOString();
  };

  const handlers: Record<string, (r: Record<string, unknown>) => unknown> = {
    [RPC.readPlan]: () => ({
      ...responseFixture(),
      job: { ...responseFixture().job, version: ACQUIRED },
      requestedEvent: {
        ...responseFixture().requestedEvent,
        aggregateVersion: PRECLAIM,
      },
      report: {
        ...responseFixture().report,
        sourceVersionId: first ? null : IDS.source,
      },
      candidate: {
        ...responseFixture().candidate,
        supersedesId: first ? null : IDS.source,
      },
      plan: record(),
    }),
    [RPC.claimLease]: (r) => {
      atPosition(r);
      if (
        plan.leaseExpiresAt !== null &&
        Date.parse(plan.leaseExpiresAt) > now() &&
        plan.leaseOwner !== r.workerId
      )
        return {
          acquired: false,
          leaseToken: null,
          plan: null,
          reasonCode: 'LEASE_UNAVAILABLE',
        };
      if (
        ![
          'draft',
          'dry_running',
          'ready',
          'running',
          'failed_retryable',
        ].includes(plan.state)
      )
        return {
          acquired: false,
          leaseToken: null,
          plan: null,
          reasonCode: 'MIGRATION_STATE_UNAVAILABLE',
        };
      if (plan.state === 'ready')
        Object.assign(plan, { cursor: '0', progress: 0 });
      plan.state =
        (
          {
            draft: 'dry_running',
            ready: 'running',
            failed_retryable: 'running',
          } as Record<string, MigrationPlanRecord['state']>
        )[plan.state] ?? plan.state;
      bump();
      tokenCounter += 1;
      plan.leaseOwner = String(r.workerId);
      plan.leaseToken = `dddddddd-0000-4000-8000-${tokenCounter.toString(16).padStart(12, '0')}`;
      plan.leaseExpiresAt = new Date(
        now() + Number(r.leaseDurationMs),
      ).toISOString();
      if (reportState === 'queued') reportState = 'running';
      return { acquired: true, leaseToken: plan.leaseToken, plan: record() };
    },
    [RPC.heartbeatLease]: (r) => {
      atPosition(r);
      ensure(leaseLive(r.leaseToken), 'LEASE_EXPIRED');
      plan.leaseExpiresAt = new Date(now() + leaseMs).toISOString();
      return { renewed: true };
    },
    [RPC.readSourceRows]: (r) => {
      atPosition(r);
      const from = Number(plan.cursor);
      const to = Math.min(rows, from + Number(r.limit));
      return {
        rows: Array.from({ length: to - from }, (_, i) => ({
          sourceTable: 'cms_entry_revisions',
          sourceRowId: rowId(from + i),
          sourceHash: ROW_HASH,
          document: {},
        })),
        nextCursor: String(to),
        done: to >= rows,
        targetFields: [],
        retiredFields: [],
      };
    },
    [RPC.processDryRunBatch]: (r) => batch(r, 'dry_running'),
    [RPC.processBatch]: (r) => batch(r, 'running'),
    [RPC.finalizeDryRun]: (r) => {
      ensure(plan.state === 'dry_running', 'CONFLICT');
      atPosition(r);
      plan.state = 'ready';
      plan.progress = 1;
      bump();
      clearLease();
      reportState = 'completed';
      return record();
    },
    [RPC.beginVerification]: (r) => {
      ensure(plan.state === 'running', 'CONFLICT');
      atPosition(r);
      plan.state = 'verifying';
      bump();
      return record();
    },
    [RPC.verify]: (r) => {
      ensure(plan.state === 'verifying', 'CONFLICT');
      atPosition(r);
      ensure(leaseLive(r.leaseToken), 'LEASE_EXPIRED');
      return { valid: true, reasonCode: null };
    },
    [RPC.complete]: (r) => {
      ensure(
        plan.state === 'verifying' && r.expectedVersion === plan.version,
        'CONFLICT',
      );
      ensure(leaseLive(r.leaseToken), 'LEASE_EXPIRED');
      plan.state = 'completed';
      bump();
      clearLease();
      return record();
    },
    [RPC.rollback]: (r) => {
      atPosition(r);
      ensure(
        ['dry_running', 'running', 'verifying', 'failed_retryable'].includes(
          plan.state,
        ),
        'CONFLICT',
      );
      const scan = plan.state === 'dry_running';
      ensure(!scan || r.retryable === false, 'CONFLICT');
      ensure(leaseLive(r.leaseToken), 'LEASE_EXPIRED');
      plan.state = scan
        ? 'blocked'
        : r.retryable === true
          ? 'failed_retryable'
          : 'failed_terminal';
      if (scan) reportState = 'failed';
      bump();
      return { plan: record() };
    },
  };

  const batch = (r: Record<string, unknown>, state: string): unknown => {
    ensure(plan.state === state, 'CONFLICT');
    atPosition(r);
    ensure(leaseLive(r.leaseToken), 'LEASE_EXPIRED');
    const from = Number(plan.cursor);
    const to = Math.min(rows, from + Number(r.limit));
    ensure(
      Array.isArray(r.rowEvidence) && r.rowEvidence.length === to - from,
      'VALIDATION_FAILED',
    );
    plan.cursor = String(to);
    plan.progress = progressOf(to);
    if (state === 'dry_running')
      Object.assign(plan, { sourceCount: String(to), targetCount: String(to) });
    else plan.migratedCount = String(to);
    return {
      done: to >= rows,
      cursor: plan.cursor,
      progress: plan.progress,
      sourceCount: plan.sourceCount,
      targetCount: plan.targetCount,
      rowErrorCount: plan.rowErrorCount,
      migratedCount: plan.migratedCount,
      failedCount: plan.failedCount,
    };
  };

  const port: MigrationWorkerPort = {
    call: async (rpc, request) => {
      const body = request as Record<string, unknown>;
      calls.push({ rpc, request: body });
      const n = (counts.get(rpc) ?? 0) + 1;
      counts.set(rpc, n);
      const fault = faults.find((f) => f.rpc === rpc && (f.nth ?? 1) === n);
      if (fault !== undefined)
        throw fault.error ?? refusal('DEPENDENCY_UNAVAILABLE');
      const handler = handlers[rpc];
      if (handler === undefined) throw new Error(`Unmodelled RPC ${rpc}`);
      return handler(body);
    },
  };

  const input = (leaseUntilMs = 2_000_000): JobEffectInput => {
    const response = handlers[RPC.readPlan]!({}) as ReturnType<
      typeof responseFixture
    >;
    return {
      job: {
        id: IDS.job,
        type: 'cms.schema.dry_run',
        state: 'running',
        version: PRECLAIM,
        leaseUntilMs: null,
      },
      envelope: response.requestedEvent,
      leaseToken: BE00_TOKEN,
      claimedLease: {
        jobId: IDS.job,
        leaseToken: BE00_TOKEN,
        expectedVersion: PRECLAIM,
        version: ACQUIRED,
        leaseUntilMs,
      },
    };
  };

  return {
    port,
    calls,
    input,
    plan: record,
    reportState: () => reportState,
    fail: (fault: PlanFault): void => void faults.push(fault),
    rpcNames: (): string[] => calls.map(({ rpc }) => rpc),
  };
};
export type PlanSimulator = ReturnType<typeof createPlanSimulator>;
