import type { ReadDeadline } from './read-deadline';

/**
 * Races `work` against the abort of `deadline.signal`. Passing the signal to `fetch` is not enough on its own: a
 * fetcher or a body read that ignores it would keep the read open past the deadline, and the island's send held with
 * it (review V20 m1/m10, DEC-246(1)). Rejects with `read deadline` on an expiry and on a caller abort; the caller
 * tells them apart with `deadline.expired()`.
 */
export const withinDeadline = <T>(
  deadline: ReadDeadline,
  work: Promise<T>,
): Promise<T> =>
  Promise.race([
    work,
    new Promise<never>((_, reject) => {
      const fail = (): void => reject(new Error('read deadline'));
      if (deadline.signal.aborted) fail();
      else deadline.signal.addEventListener('abort', fail, { once: true });
    }),
  ]);
