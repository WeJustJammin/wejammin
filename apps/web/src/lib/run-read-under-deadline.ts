import { startReadDeadline } from './read-deadline';
import { withinDeadline } from './read-within-deadline';

/**
 * Runs a browser read under the shared deadline (`BROWSER_READ_DEADLINE_MS`, DEC-246 ruling 1). `run` gets the signal to
 * pass to its fetch. The answer is whatever `run` answers, or `onEnd` when the deadline passes, the caller aborts or
 * `run` throws, even if the fetch ignores its signal or the body never arrives: a read that cannot end would hold the
 * send for ever. The timer and the listener on the caller's signal are always released.
 */
export const runReadUnderDeadline = async <T>(
  run: (signal: AbortSignal) => Promise<T>,
  onEnd: T,
  parent?: AbortSignal,
): Promise<T> => {
  const deadline = startReadDeadline(parent);
  try {
    return await withinDeadline(deadline, run(deadline.signal));
  } catch {
    return onEnd;
  } finally {
    deadline.clear();
  }
};
