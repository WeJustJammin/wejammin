import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

import { useCmsEditorialLeaveGuard } from '../cms-editorial/use-cms-editorial-leave-guard';

import { NO_PANEL, type Panel } from './composition-panel';
import type {
  CompositionEntryFacts,
  InstanceRow,
  SelectorPage,
} from './composition-types';
import { useCompositionBulk } from './use-composition-bulk';
import { useCompositionInsert } from './use-composition-insert';
import { useCompositionSession } from './use-composition-session';
import { useCompositionUpdates } from './use-composition-updates';

export interface CompositionPageOptions {
  readonly entry: CompositionEntryFacts;
  readonly selector: SelectorPage;
  readonly instances: readonly InstanceRow[];
  readonly csrfToken: string;
  /** Test seam; production uses the global `fetch`. */
  readonly fetcher?: typeof fetch | undefined;
  /** Test seam for the leave to a destination the author confirmed; production assigns the location. */
  readonly navigate?: ((href: string) => void) | undefined;
}

const defaultNavigate = (href: string): void => {
  if (typeof window !== 'undefined') window.location.assign(href);
};

/** Everything the composition island shows and does; the components only render. */
export const useCompositionPage = (options: CompositionPageOptions) => {
  const session = useCompositionSession(options);
  const [panel, setPanel] = useState<Panel>(NO_PANEL);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const panelState = { panel, setPanel };
  const selection = { selected, setSelected };
  const insert = useCompositionInsert(session, options.selector);
  const updates = useCompositionUpdates(session, panelState, selection);
  const bulk = useCompositionBulk(session, panelState, selection, updates.send);

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  // FE03 927 "Unsaved changes": the draft stays while the author decides, an inline confirmation guards links, and
  // `beforeunload` is armed only while the insert form holds unsent input. There is no autosave and no stored draft
  // (nothing reaches the URL, history or storage), so the only exits are keeping the draft or the explicit discard.
  const guard = useCmsEditorialLeaveGuard({
    active: insert.dirty,
    save: async () => undefined,
    stillUnsent: () => true,
    navigate: options.navigate ?? defaultNavigate,
  });
  // The island holds no link of its own: the page's navigation lies outside it, so the capture listens on the document.
  const capture = useRef(guard.onClickCapture);
  capture.current = guard.onClickCapture;
  useEffect(() => {
    const listen = (event: MouseEvent): void =>
      capture.current(event as unknown as ReactMouseEvent<HTMLElement>);
    document.addEventListener('click', listen, true);
    return () => document.removeEventListener('click', listen, true);
  }, []);

  const disabled = !session.entry.editable || options.csrfToken.length === 0;
  const busy =
    session.busy ||
    session.rateWaiting ||
    insert.reconciling ||
    panel.kind === 'loading';
  return {
    session,
    insert,
    updates,
    bulk,
    panel,
    setPanel,
    selected,
    toggle,
    disabled,
    busy,
    guard,
    close: () => setPanel(NO_PANEL),
  };
};
