import * as React from 'react';

import { markRouteHeadingForFocus } from '../../lib/route-heading-focus';
import {
  createCmsEditorialConflictController,
  type CmsEditorialConflictController,
} from './cms-editorial-conflict-controller';
import type {
  CmsEditorialConflictResolveInit,
  CmsEditorialConflictState,
} from './cms-editorial-conflict-state';

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface CmsEditorialConflictResolveProps {
  readonly init: CmsEditorialConflictResolveInit;
  /** Test seams; the page passes only `init`. */
  readonly fetcher?: Fetcher | undefined;
  readonly navigate?: ((path: string) => void) | undefined;
}

const sessionStorageOrNull = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * Binds one conflict-resolution controller to React. A verified resolution
 * leaves the one-shot heading-focus mark (FE03 "Completion: Focus result
 * heading") and navigates to the entry's APP route, never an API URL.
 */
export const useCmsEditorialConflict = (
  props: CmsEditorialConflictResolveProps,
): {
  readonly controller: CmsEditorialConflictController;
  readonly state: CmsEditorialConflictState;
} => {
  const [controller] = React.useState(() =>
    createCmsEditorialConflictController({
      init: props.init,
      ...(props.fetcher === undefined ? {} : { fetcher: props.fetcher }),
      onResolved: (path, result) => {
        const leave = (): void => {
          markRouteHeadingForFocus(sessionStorageOrNull());
          (props.navigate ?? ((target) => window.location.assign(target)))(
            path,
          );
        };
        if (result === null) {
          leave();
          return;
        }
        // The handoff (and the step-up draft store behind it) loads when a command commits,
        // not with the page (AC-106); the page still opens when it cannot be fetched.
        void import('./cms-editorial-result-save')
          .then(({ saveCmsEditorialResult }) => {
            saveCmsEditorialResult(sessionStorageOrNull(), result);
          })
          .catch(() => undefined)
          .then(leave);
      },
    }),
  );
  const state = React.useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
  return { controller, state };
};
