import * as React from 'react';

/**
 * The detail, review and editor views of the registry workbench are loaded on
 * demand in the browser, so a hydrating route keeps their server HTML in place
 * until their chunk arrives. Anything that edits that HTML before React has
 * hydrated it (restoring a step-up draft, announcing a status, wiring the
 * command enhancement) would make the markup differ from what React expects and
 * React would discard the edit by client-rendering the boundary.
 *
 * The fence counts the lazy boundaries a workbench renders and the ones that
 * have hydrated; `whenReady` runs its callback once every expected boundary is
 * hydrated (at once for a route with none, such as the list route).
 */
export interface HydrationFence {
  /** The workbench states how many lazy boundaries it renders. */
  readonly expect: (count: number) => void;
  /** A lazy boundary reports that it has hydrated. */
  readonly ready: () => void;
  /** Run once every expected boundary is ready; returns a cancel function. */
  readonly whenReady: (callback: () => void) => () => void;
}

export const createHydrationFence = (): HydrationFence => {
  let expected = 0;
  let hydrated = 0;
  const waiting = new Set<() => void>();
  const flush = (): void => {
    if (hydrated < expected) return;
    for (const callback of [...waiting]) {
      waiting.delete(callback);
      callback();
    }
  };
  return {
    expect: (count) => {
      expected = count;
      flush();
    },
    ready: () => {
      hydrated += 1;
      flush();
    },
    whenReady: (callback) => {
      if (hydrated >= expected) {
        callback();
        return () => undefined;
      }
      waiting.add(callback);
      return () => {
        waiting.delete(callback);
      };
    },
  };
};

/** Provided by the island; absent where a workbench renders without one. */
export const HydrationFenceContext = React.createContext<HydrationFence | null>(
  null,
);

/** Tell the surrounding fence how many lazy boundaries this render has. */
export const useExpectedLazyBoundaries = (count: number): void => {
  const fence = React.useContext(HydrationFenceContext);
  React.useEffect(() => {
    fence?.expect(count);
  }, [fence, count]);
};
