import { CONSUMER_DEADLINE_MS } from './types';

/**
 * Runs one consumer step under the BE00 protected-command deadline. The
 * signal aborts at the deadline so a hung dependency cannot hold a queue
 * message open; the timer never outlives the step.
 */
export const runWithDeadline = async <T>(
  run: (signal: AbortSignal) => Promise<T>,
  deadlineMs: number = CONSUMER_DEADLINE_MS,
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};
