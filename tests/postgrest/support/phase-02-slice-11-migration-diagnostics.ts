/** Failure-only diagnostics: closed projections, never worker operands or bodies. */
import {
  MIGRATION_STATES,
  SCHEMA_MIGRATION_RPC,
} from '../../../apps/worker/src/content-schema-registry/migration-worker-constants';
import type { MigrationWorkerResult } from '../../../apps/worker/src/content-schema-registry/migration-worker-types';

const RPC_NAMES: readonly string[] = Object.values(SCHEMA_MIGRATION_RPC);
const OUTCOMES = [
  'completed',
  'progress',
  'retry',
  'duplicate',
  'stale',
  'blocked',
  'failed_retryable',
  'failed_terminal',
  'dead_letter',
] as const;
const REASON_CODES = [
  'DEPENDENCY_INVALID_RESPONSE',
  'DEPENDENCY_UNAVAILABLE',
  'DEPENDENCY_DEADLINE_EXCEEDED',
  'PLAN_TARGET_MISMATCH',
  'PLAN_VERSION_MISMATCH',
  'MIGRATION_TERMINAL',
  'MIGRATION_BLOCKED',
  'NO_MIGRATION_REQUIRED',
] as const;

const classified = (value: unknown, allowed: readonly string[]): string =>
  typeof value === 'string' && allowed.includes(value) ? value : 'unclassified';

const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

type PlanFlags = Readonly<{
  fromVersionIdIsNull: boolean | null;
  activeVersionIdIsNull: boolean | null;
  sourceHashIsZero: boolean | null;
}>;
type RpcObservation = {
  rpc: string;
  status: number;
  readPlan?: PlanFlags | null;
};

const readPlanFlags = async (response: Response): Promise<PlanFlags | null> => {
  try {
    const body: unknown = await response.clone().json();
    const envelope = record(body);
    const plan = record(envelope && 'plan' in envelope ? envelope.plan : body);
    if (plan === undefined) return null;
    return {
      fromVersionIdIsNull:
        'fromVersionId' in plan ? plan.fromVersionId === null : null,
      activeVersionIdIsNull:
        'activeVersionId' in plan ? plan.activeVersionId === null : null,
      sourceHashIsZero:
        'sourceHash' in plan ? plan.sourceHash === '0'.repeat(64) : null,
    };
  } catch {
    // Only this diagnostic clone failed. The untouched response still reaches
    // production parsing; never substitute a response or expose the exception.
    return null;
  }
};

export const createS11MigrationDiagnostics = () => {
  const observations: RpcObservation[] = [];
  return {
    observe: async (
      rpc: string | undefined,
      response: Response,
    ): Promise<void> => {
      if (observations.length >= 32) return;
      const observation: RpcObservation = {
        rpc: classified(rpc, RPC_NAMES),
        status: response.status,
      };
      observations.push(observation);
      if (rpc === SCHEMA_MIGRATION_RPC.readPlan)
        observation.readPlan = await readPlanFlags(response);
    },
    describe: (result: MigrationWorkerResult): string =>
      JSON.stringify({
        rpcTrace: observations,
        result: {
          outcome: classified(result.outcome, OUTCOMES),
          state:
            result.state === null
              ? null
              : classified(result.state, MIGRATION_STATES),
          reasonCode:
            result.reasonCode === null
              ? null
              : classified(result.reasonCode, REASON_CODES),
          activationSwitched:
            typeof result.activationSwitched === 'boolean'
              ? result.activationSwitched
              : 'unclassified',
        },
      }),
  };
};
