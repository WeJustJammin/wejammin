import * as React from 'react';

import {
  createCmsEditorialEntryEditorController,
  type CmsEditorialEntryEditorController,
} from './cms-editorial-entry-editor-controller';
import type { CmsEditorialAutosaveClock } from './cms-editorial-autosave';
import type {
  CmsEditorialEditorState,
  CmsEditorialEntryEditorInit,
} from './cms-editorial-entry-editor-state';

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface CmsEditorialEntryEditorProps {
  readonly init: CmsEditorialEntryEditorInit;
  /** Test seams; the page passes only `init`. */
  readonly fetcher?: Fetcher | undefined;
  readonly clock?: CmsEditorialAutosaveClock | undefined;
  /** Where a confirmed leave goes; defaults to `window.location.assign`. */
  readonly navigate?: ((href: string) => void) | undefined;
}

/**
 * Binds one editor controller to React: created once per mounted editor,
 * observed through `useSyncExternalStore` (the controller replaces its state
 * object on every change), and disposed on unmount so no timer outlives it.
 */
export const useCmsEditorialEntryEditor = (
  props: CmsEditorialEntryEditorProps,
): {
  readonly controller: CmsEditorialEntryEditorController;
  readonly state: CmsEditorialEditorState;
} => {
  const [controller] = React.useState(() =>
    createCmsEditorialEntryEditorController({
      init: props.init,
      ...(props.fetcher === undefined ? {} : { fetcher: props.fetcher }),
      ...(props.clock === undefined ? {} : { clock: props.clock }),
    }),
  );
  const state = React.useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
  React.useEffect(() => () => controller.dispose(), [controller]);
  return { controller, state };
};
