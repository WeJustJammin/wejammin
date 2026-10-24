/**
 * A dynamic `import()` that can be retried in a real browser.
 *
 * A browser keeps a FAILED module fetch in its module map: importing the same URL again rejects
 * at once, without a request, even after the connection is back (verified in Chrome; jsdom and
 * Vitest never model it). So a retry that repeats `import('./chunk')` can never succeed. The
 * browser's error names the URL that failed ("Failed to fetch dynamically imported module: <url>",
 * Firefox: "error loading dynamically imported module: <url>"); the retry imports that URL with a
 * retry marker, which the map has not seen, and so reaches the network. The marker is stable per
 * attempt (`wj_retry=1`, then `2` if that fails too), so two callers that retry the same chunk
 * share one module instance. A chunk that failed never ran, so no state is duplicated; the
 * modules it imports statically keep their plain URLs and their single instance. A failure that
 * names no URL (Safari) is retried with the same specifier: nothing better exists, and the
 * caller's own "nothing was sent" state stands.
 *
 * Each `retryable` has its own state and remembers the module once it loaded: after a retry
 * succeeded, the plain specifier would still fail from the map. It is kept small on purpose: the
 * entry editor route is charged for it.
 */
export const retryableImportSeam = {
  /** The seam a test replaces: a dynamic import of a computed URL. */
  importUrl: (url: string): Promise<unknown> =>
    import(/* @vite-ignore */ url) as Promise<unknown>,
};

const FAILED = /module: (\S+)$/u;

export const retryable = <T>(load: () => Promise<T>): (() => Promise<T>) => {
  let loaded: T | undefined;
  let pending: Promise<T> | undefined;
  let url = '';
  let attempt = 0;
  const run = async (): Promise<T> => {
    try {
      loaded = (await (attempt === 0
        ? load()
        : retryableImportSeam.importUrl(
            `${url}${url.includes('?') ? '&' : '?'}wj_retry=${String(attempt)}`,
          ))) as T;
      return loaded;
    } catch (error) {
      const named = FAILED.exec(String((error as Error).message))?.[1];
      if (attempt > 0) attempt += 1;
      else if (named !== undefined) {
        url = named;
        attempt = 1;
      }
      throw error;
    } finally {
      pending = undefined;
    }
  };
  return async () => loaded ?? (pending ??= run());
};
