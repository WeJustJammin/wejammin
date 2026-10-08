import { createCorrelationId, createRequestId } from '@wejammin/contracts';
import { createLogger } from '@wejammin/observability/logging';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { createSupabaseRpc } from './async-runtime';
import { AsyncRpcTransportError } from './async-runtime-support';

/**
 * `platform_api.cms_expire_edit_presence_leases` accepts 1..5000. Every
 * autosaving editor leaves one lapsing lease per entry, which is far denser than
 * the rare reviewer-authority lapse, so the per-tick bound is larger than that
 * sweep's while a full batch still leaves the remainder for the next tick.
 */
export const CMS_EDIT_PRESENCE_SWEEP_LIMIT = 500;

const OPERATION = 'cms_edit_presence_sweep';

const retrySweep = (
  logger: ReturnType<typeof createLogger>,
  correlationId: string,
  errorCode: 'DEPENDENCY_INVALID_RESPONSE' | 'DEPENDENCY_UNAVAILABLE',
): Error => {
  logger.error({
    correlationId,
    errorCode,
    eventName: `${OPERATION}.failed`,
    operation: OPERATION,
    outcome: 'retry',
    retryable: true,
  });
  return new Error('CMS edit-presence sweep requested retry');
};

const recordManualReview = (
  logger: ReturnType<typeof createLogger>,
  correlationId: string,
  reason: AsyncRpcTransportError['reason'],
): void => {
  logger.error({
    attributes: { reason },
    correlationId,
    errorCode: 'MANUAL_REVIEW',
    eventName: `${OPERATION}.manual_review_required`,
    operation: OPERATION,
    outcome: 'failure',
    retryable: false,
  });
};

/** Sanity ceiling for the active-lease gauge (one lease per editor per entry). */
const MAX_ACTIVE_LEASES = 10_000_000;

type SweepResult = Readonly<{ expiredLeases: number; activeLeases?: number }>;

/**
 * The RPC answers `{ expiredLeases: n }` with 0 <= n <= limit and may add
 * `activeLeases`, the count of leases still active after the sweep, which is
 * the BE03b `cms_presence_active` gauge. Any other key or shape is invalid.
 */
const parseSweepResult = (value: unknown): SweepResult | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return undefined;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const count = record['expiredLeases'];
  const active = record['activeLeases'];
  if (
    keys.some((key) => key !== 'expiredLeases' && key !== 'activeLeases') ||
    typeof count !== 'number' ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > CMS_EDIT_PRESENCE_SWEEP_LIMIT
  )
    return undefined;
  if (!('activeLeases' in record)) return { expiredLeases: count };
  if (
    typeof active !== 'number' ||
    !Number.isInteger(active) ||
    active < 0 ||
    active > MAX_ACTIVE_LEASES
  )
    return undefined;
  return { expiredLeases: count, activeLeases: active };
};

/**
 * BE03b EditPresence: the advisory lease is two minutes wide, is renewed by each
 * authorized autosave inside the write transaction, and "expires without
 * blocking another editor". FE03 keeps EditPresence physical-only, so no
 * browser or HTTP command records its lapse; each scheduled tick runs one
 * bounded service-role sweep that marks lapsed active leases `expired` (never
 * `revoked`: expiry records lapse, not loss of authority). A full batch leaves
 * the remainder for the next tick, and the sweep never reads or logs a person,
 * entry, owner or field identifier.
 */
export const runProductionCmsEditPresenceSweep = async (
  env: AsyncWorkerBindings,
): Promise<void> => {
  const correlationId = createCorrelationId(
    undefined,
    createRequestId(undefined),
  );
  const logger = createLogger({
    environment: env.APP_ENVIRONMENT,
    release: env.APP_RELEASE,
    service: 'wejammin-worker',
  });

  let result: unknown;
  try {
    result = await createSupabaseRpc()(env, 'cms_expire_edit_presence_leases', {
      p_batch: CMS_EDIT_PRESENCE_SWEEP_LIMIT,
    });
  } catch (error) {
    if (
      error instanceof AsyncRpcTransportError &&
      error.disposition === 'manual_review' &&
      error.retryable === false
    ) {
      recordManualReview(logger, correlationId, error.reason);
      throw error;
    }
    throw retrySweep(logger, correlationId, 'DEPENDENCY_UNAVAILABLE');
  }

  const sweep = parseSweepResult(result);
  if (sweep === undefined)
    throw retrySweep(logger, correlationId, 'DEPENDENCY_INVALID_RESPONSE');

  logger.info({
    attributes: { limit: CMS_EDIT_PRESENCE_SWEEP_LIMIT },
    correlationId,
    eventName: `${OPERATION}.completed`,
    metrics: {
      expiredLeases: sweep.expiredLeases,
      ...(sweep.activeLeases === undefined
        ? {}
        : { cms_presence_active: sweep.activeLeases }),
    },
    operation: OPERATION,
    outcome: 'success',
  });
};
