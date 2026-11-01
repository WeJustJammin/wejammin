import type {
  PlatformJobsMessage,
  QueueMessageOutcome,
} from './async-entrypoint';

/**
 * A Job message outcome. `{ outcome: 'retry', delaySeconds }` is the BE00 paced redelivery (15, 60 and 300
 * seconds) that the CMS schema preparation Job path applies to retry-type dispositions (DEC-184).
 */
export type JobQueueMessageOutcome =
  QueueMessageOutcome | Readonly<{ outcome: 'retry'; delaySeconds: number }>;

/**
 * Settles one Job message: `ack`, a paced `retry({ delaySeconds })` for a positive whole number of seconds,
 * and the bare `retry()` for everything else (a malformed delay never acknowledges and never invents one).
 */
export const settleJobMessage = (
  message: Pick<PlatformJobsMessage, 'ack' | 'retry'>,
  outcome: JobQueueMessageOutcome,
): void => {
  if (outcome === 'ack') message.ack();
  else if (
    typeof outcome === 'object' &&
    outcome !== null &&
    Number.isSafeInteger(outcome.delaySeconds) &&
    outcome.delaySeconds > 0
  )
    message.retry({ delaySeconds: outcome.delaySeconds });
  else message.retry();
};
