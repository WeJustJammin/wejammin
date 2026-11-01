/** One run owns admission, producer promises and even deadline-detached fetches. */
export const createDec194IsolationOwner = () => {
  const controller = new AbortController();
  const producers = new Set<Promise<unknown>>();
  const requests = new Set<Promise<unknown>>();
  let closed = false;
  let closing: Promise<void> | undefined;
  const admit = (): void => {
    if (closed) throw new Error('DEC194 isolation run is closed.');
  };
  const track = <T>(
    set: Set<Promise<unknown>>,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const promise = Promise.resolve().then(operation);
    set.add(promise);
    void promise.then(
      () => set.delete(promise),
      () => set.delete(promise),
    );
    return promise;
  };
  const run = <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      admit();
    } catch (error) {
      return Promise.reject(error);
    }
    return track(producers, async () => {
      admit();
      return operation();
    });
  };
  const request = <T>(
    signal: AbortSignal | null | undefined,
    operation: (ownedSignal: AbortSignal) => Promise<T>,
  ): Promise<T> => {
    try {
      admit();
    } catch (error) {
      return Promise.reject(error);
    }
    const combined = new AbortController();
    const abort = () => combined.abort();
    signal?.addEventListener('abort', abort, { once: true });
    controller.signal.addEventListener('abort', abort, { once: true });
    if (signal?.aborted || controller.signal.aborted) abort();
    return track(requests, async () => {
      try {
        admit();
        return await operation(combined.signal);
      } finally {
        signal?.removeEventListener('abort', abort);
        controller.signal.removeEventListener('abort', abort);
      }
    });
  };
  const close = (): Promise<void> => {
    if (closing !== undefined) return closing;
    closed = true;
    controller.abort();
    closing = (async () => {
      // A producer may already have timed out while its forwarding fetch still
      // awaits cancellation acknowledgment. Neither set substitutes for the other.
      while (producers.size > 0 || requests.size > 0)
        await Promise.allSettled([...producers, ...requests]);
    })();
    return closing;
  };
  return { admit, run, request, close, signal: controller.signal };
};

export const finishDec194IsolationRun = async (
  run: Readonly<{
    stack?: Readonly<{ cleanupProbe: () => void }>;
    worker?: Readonly<{ close: () => Promise<void> }>;
  }>,
): Promise<void> => {
  await run.worker?.close();
  run.stack?.cleanupProbe();
};
