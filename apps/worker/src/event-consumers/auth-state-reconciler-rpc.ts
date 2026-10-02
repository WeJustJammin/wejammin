import type {
  FactorSettlement,
  MfaFactorState,
  ReconcilableFactor,
  ReconcilerFactorPort,
} from './auth-state-reconciler';
import { EVENT_CONSUMER_RPC } from './rpc-names';
import type { EventConsumerRpc } from './types';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const VERSION = /^[1-9][0-9]{0,18}$/u;
const STATES: ReadonlySet<string> = new Set<MfaFactorState>([
  'pending',
  'verified',
  'reconciling',
  'removed',
  'expired',
]);
const SETTLED: ReadonlySet<string> = new Set<FactorSettlement | 'expired'>([
  'verified',
  'pending',
  'removed',
  'expired',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseView = (value: unknown): ReconcilableFactor | null => {
  if (!isRecord(value) || typeof value.found !== 'boolean')
    throw new Error('Malformed factor reconciliation response');
  if (!value.found) {
    if (Object.keys(value).length !== 1)
      throw new Error('Malformed factor reconciliation response');
    return null;
  }
  const keys = Object.keys(value).sort().join(',');
  if (
    keys !== 'authUserId,found,providerFactorId,state,version' ||
    typeof value.state !== 'string' ||
    !STATES.has(value.state) ||
    typeof value.authUserId !== 'string' ||
    !UUID.test(value.authUserId) ||
    typeof value.providerFactorId !== 'string' ||
    !UUID.test(value.providerFactorId) ||
    typeof value.version !== 'string' ||
    !VERSION.test(value.version)
  )
    throw new Error('Malformed factor reconciliation response');
  return {
    state: value.state as MfaFactorState,
    authUserId: value.authUserId,
    providerFactorId: value.providerFactorId,
    version: value.version,
  };
};

/**
 * Backs the reconciler with the protected identity RPCs. The read RPC is the
 * only place a provider factor reference leaves PostgreSQL, and only into
 * Worker memory; the settle RPC is the existing BE01a reconcile function,
 * which locks the binding, compare-and-sets `reconciling`, bumps
 * `mfa_version` and writes the security event and outbox row.
 */
export const createRpcReconcilerFactorPort = (
  rpc: EventConsumerRpc,
): ReconcilerFactorPort => ({
  read: async (factorId, signal) =>
    parseView(
      await rpc<unknown>(
        EVENT_CONSUMER_RPC.readFactorForReconciliation,
        { p_factor_id: factorId },
        signal,
      ),
    ),
  settle: async (input, signal) => {
    const settled = await rpc<unknown>(
      EVENT_CONSUMER_RPC.reconcileFactor,
      {
        p_auth_user_id: input.authUserId,
        p_factor_id: input.factorId,
        p_outcome: input.outcome,
        p_request_id: input.requestId,
        p_correlation_id: input.correlationId,
      },
      signal,
    );
    if (
      !isRecord(settled) ||
      typeof settled.state !== 'string' ||
      !SETTLED.has(settled.state)
    )
      throw new Error('Malformed factor settlement response');
  },
});
