import { useCallback, useState } from 'react';

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
}

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

  const disabled = !session.entry.editable || options.csrfToken.length === 0;
  const busy = session.busy || session.rateWaiting || panel.kind === 'loading';
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
    close: () => setPanel(NO_PANEL),
  };
};
