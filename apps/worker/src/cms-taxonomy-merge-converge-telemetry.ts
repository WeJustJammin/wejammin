import type { JobEffectInput } from '@wejammin/application';
import { createLogger, type Logger } from '@wejammin/observability/logging';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { metricKey } from './content-schema-registry/route-metric-key';
import type { MergeConvergeAnswer } from './cms-taxonomy-merge-converge-rpc';

/**
 * BE03c Observability (1595-1597): one scrubbed structured event per delivery keyed by operation, job, correlation id,
 * delivery number, outcome, error code and duration, and the metric `cms_taxonomy_merge_total{outcome}` with the closed
 * label set `converged | continued | failed`. Counts are safe attributes; the lease token, the claim version, the
 * continuation id and the credential are never logged. Telemetry loss never changes the disposition.
 */
export type MergeSettlement =
  | Readonly<{ kind: 'converged'; answer: MergeConvergeAnswer }>
  | Readonly<{ kind: 'failed'; errorCode: string }>;

const OPERATION = 'cms_taxonomy_merge_converge';
const loggers = new WeakMap<object, Logger | null>();

/**
 * The injected logger, else one per Worker environment object; null when the environment cannot carry one or the
 * delivery had no context (and so no environment).
 */
export const mergeLoggerFor = (
  env: AsyncWorkerBindings | undefined,
  injected: Logger | undefined,
): Logger | null => {
  if (injected !== undefined) return injected;
  if (env === undefined) return null;
  const known = loggers.get(env);
  if (known !== undefined) return known;
  let logger: Logger | null;
  try {
    logger = createLogger({
      environment: env.APP_ENVIRONMENT,
      release: env.APP_RELEASE,
      service: 'wejammin-cms-taxonomy-merge',
    });
  } catch {
    logger = null;
  }
  loggers.set(env, logger);
  return logger;
};

export const logMergeSettled = (
  logger: Logger | null,
  input: JobEffectInput,
  deliveryAttempt: number,
  durationMs: number,
  settled: MergeSettlement,
): void => {
  if (logger === null) return;
  try {
    const base = {
      attempt: Math.max(1, deliveryAttempt),
      correlationId: input.envelope.correlationId,
      durationMs: Math.max(0, durationMs),
      eventName: `${OPERATION}.settled`,
      jobId: input.job.id,
      operation: OPERATION,
    };
    if (settled.kind === 'converged') {
      const { answer } = settled;
      logger.info({
        ...base,
        attributes: {
          converged: answer.converged,
          remaining: answer.remaining,
          continued: answer.continuationJobId !== null,
        },
        metrics: {
          [metricKey('cms_taxonomy_merge_total', {
            outcome:
              answer.continuationJobId === null ? 'converged' : 'continued',
          })]: 1,
        },
        outcome: 'success',
      });
      return;
    }
    logger.error({
      ...base,
      errorCode: settled.errorCode,
      metrics: {
        [metricKey('cms_taxonomy_merge_total', { outcome: 'failed' })]: 1,
      },
      outcome: 'failure',
      retryable: false,
    });
  } catch {
    // Telemetry cannot change the disposition.
  }
};
