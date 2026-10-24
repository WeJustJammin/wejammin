import { expect, it, vi } from 'vitest';

import { expectPlanEqual } from './phase-02-slice-11-delivery-receiving-upgrade-plan-assertions';
import type {
  Api,
  Document,
  Execution,
  Invocation,
  Obj,
  Plan,
} from './phase-02-slice-11-delivery-receiving-upgrade-types';
export type {
  Api,
  Document,
  Execution,
  Invocation,
  Mode,
  Obj,
  Plan,
  PlanInput,
  PrefixEntry,
  Source,
} from './phase-02-slice-11-delivery-receiving-upgrade-types';
export {
  database,
  digest,
  input,
  promoted,
  repository,
  target,
  witness,
} from './phase-02-slice-11-delivery-receiving-upgrade-source-fixtures';

import {
  envelope,
  expectedInvocation,
  identity,
  marker,
  reset,
  runnerResetFixtures,
  session,
  type Attestation,
  type Envelope,
  type Reset,
  type Restoration,
} from './phase-02-slice-11-delivery-receiving-upgrade-target-fixtures';

vi.mock('node:child_process', () => {
  const blocked = () => {
    throw new Error('DEC197_UNIT_PROCESS_FORBIDDEN');
  };
  const methods = {
    spawn: blocked,
    spawnSync: blocked,
    exec: blocked,
    execSync: blocked,
    execFile: blocked,
    execFileSync: blocked,
    fork: blocked,
  };
  return { ...methods, default: methods };
});

// Unit data/IO only. Nothing here creates a DB, replays SQL or proves isolation.

let loaded: Api | undefined;
let attempted = false;
export let availabilityError = '';
export async function loadApi(): Promise<Api | undefined> {
  if (attempted) return loaded;
  attempted = true;
  try {
    const planUrl = new URL(
      '../../infra/database-upgrades/delivery-receiving-upgrade-plan.mjs',
      import.meta.url,
    ).href;
    const runnerUrl = new URL(
      '../../infra/run-delivery-receiving-upgrade.mjs',
      import.meta.url,
    ).href;
    const planModule = await import(planUrl);
    const runnerModule = await import(runnerUrl);
    const exports: Record<string, unknown> = {
      ...planModule,
      runReceivingUpgrade: runnerModule.runReceivingUpgrade,
    };
    for (const name of [
      'resolveMigrationSource',
      'buildUpgradePlan',
      'buildPsqlInvocation',
      'classifyMigrationOutcome',
      'compareRollback',
      'assertCommittedReceivingCatalog',
      'runReceivingUpgrade',
    ]) {
      if (typeof exports[name] !== 'function')
        throw new Error(`missing export ${name}`);
    }
    loaded = exports as Api;
  } catch (error) {
    availabilityError = String(error);
  }
  return loaded;
}

// One explicit availability RED; behavioral cases skip until exports exist.
export function apiCase(name: string, body: (api: Api) => unknown): void {
  it(name, async (context) => {
    const api = await loadApi();
    if (!api)
      return context.skip(`implementation unavailable: ${availabilityError}`);
    await body(api);
  });
}

export const directFk = 'projection_consumer_state_projection_fk';
export const compositeFk =
  'projection_consumer_state_publication_projection_fk';
export const refusal = (
  applicationName = 'dec197_upgrade_unit_negative',
): Execution => ({
  status: 0,
  stdout:
    marker(session(applicationName)) +
    'BEGIN\nCREATE TABLE\nALTER TABLE\nROLLBACK\n',
  stderr: `ERROR:  23503: insert or update on table "projection_consumer_state" violates foreign key constraint "${directFk}"\nCONSTRAINT NAME: ${directFk}\nERROR:  25P02: current transaction is aborted, commands ignored until end of transaction block\n`,
});
export const committed = (
  applicationName = 'dec197_upgrade_unit_positive',
): Execution => ({
  status: 0,
  stdout:
    marker(session(applicationName)) +
    'BEGIN\nCREATE TABLE\nALTER TABLE\nCOMMIT\n',
  stderr: '',
});
export const clone = <T>(value: T): T => structuredClone(value);
export function change(
  doc: Document,
  section: string,
  key: string,
  value: unknown,
): void {
  const row = doc.snapshot.catalog[section]?.[0];
  if (!row) throw new Error(`missing fixture section ${section}`);
  row[key] = value;
}

const consumerA = 'a0000000-0000-4000-8000-000000000001';
const consumerB = 'a0000000-0000-4000-8000-000000000002';
export const labels = ['a', 'b'].map((label, i) => ({
  label,
  publicationVersionId: `b0000000-0000-4000-8000-00000000000${i + 1}`,
  publicationHash: String(i + 1).repeat(64),
  consumerId: i === 0 ? consumerA : consumerB,
  orphanProjectionId: `c0000000-0000-4000-8000-00000000000${i + 1}`,
}));

export function world(
  plan: Plan,
  snapshots: { before: Document; after: Document },
  observedContainerId = identity(plan.target).containerId,
) {
  const events: string[] = [];
  const errors = new Map<string, Error>();
  const receipts: Obj[] = [];
  const renewal = runnerResetFixtures(plan, observedContainerId);
  let failedPrefix = false;
  const outputs: {
    prefix: Attestation;
    reset: Reset;
    setup: Obj & Envelope;
    before: Document;
    after: Document;
    beforeEnvelope: Envelope;
    afterEnvelope: Envelope;
    execution: Execution & Envelope;
    restored: Restoration;
  } = {
    prefix: renewal.prefix,
    reset: renewal.reset,
    setup: {
      ...envelope(reset(plan.target, plan.prefixSha256, plan.mode)),
      committed: true,
      tapPassed: true,
      database: plan.target.database,
      backendPid: 101,
      consumerCount: plan.mode === 'negative' ? '2' : '0',
      publications: plan.mode === 'negative' ? labels : [],
    },
    before: snapshots.before,
    after: snapshots.after,
    beforeEnvelope: envelope(reset(plan.target, plan.prefixSha256, plan.mode)),
    afterEnvelope: envelope(reset(plan.target, plan.prefixSha256, plan.mode)),
    execution: {
      ...envelope(reset(plan.target, plan.prefixSha256, plan.mode)),
      ...(plan.mode === 'negative'
        ? refusal(plan.applicationName)
        : committed(plan.applicationName)),
    },
    restored: renewal.restored,
  };
  for (const output of [
    outputs.prefix,
    outputs.reset,
    outputs.setup,
    outputs.beforeEnvelope,
    outputs.afterEnvelope,
    outputs.execution,
    outputs.restored,
  ]) {
    output.containerId = observedContainerId;
  }
  const step = <T>(
    name: string,
    result: T,
    validate?: () => void,
  ): Promise<T> => {
    events.push(name);
    const error = errors.get(name);
    if (error) throw error;
    validate?.();
    return Promise.resolve(result);
  };
  const samePlan = (received: Plan): void => {
    expectPlanEqual(received, plan);
  };
  const sameReset = (p: Plan, received: Reset): void => {
    samePlan(p);
    expect(received).toEqual(outputs.reset);
  };
  const io: Record<string, unknown> = {
    preparePrefix: (p: Plan) => {
      return step('preparePrefix', outputs.prefix, () => samePlan(p));
    },
    resetBefore: async (p: Plan, received: Attestation) => {
      try {
        return await step('resetBefore', outputs.reset, () => {
          samePlan(p);
          expect(received).toEqual(outputs.prefix);
        });
      } catch (error) {
        failedPrefix = true;
        throw error;
      }
    },
    setupWorld: (p: Plan, received: Reset) => {
      return step('setupWorld', outputs.setup, () => sameReset(p, received));
    },
    observe: (phase: 'before' | 'after', p: Plan, received: Reset) => {
      const binding =
        phase === 'before' ? outputs.beforeEnvelope : outputs.afterEnvelope;
      return step(
        `observe:${phase}`,
        { ...binding, document: outputs[phase] },
        () => sameReset(p, received),
      );
    },
    executeMigration: (invocation: Invocation, p: Plan, received: Reset) => {
      return step('executeMigration', outputs.execution, () => {
        sameReset(p, received);
        expect(invocation).toEqual(expectedInvocation(plan));
      });
    },
    restoreBaseline: (p: Plan, received: Attestation) => {
      return step(
        'restoreBaseline',
        failedPrefix
          ? { ...outputs.restored, ...renewal.recovery }
          : outputs.restored,
        () => {
          samePlan(p);
          expect(received).toEqual(outputs.prefix);
        },
      );
    },
    writeReceipt: (receipt: Obj) => {
      return step('writeReceipt', undefined, () => {
        receipts.push(receipt);
      });
    },
  };
  return { io, events, errors, outputs, receipts };
}
