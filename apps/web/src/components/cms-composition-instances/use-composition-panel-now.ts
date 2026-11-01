import { useCallback, useEffect, useRef } from 'react';

import type { Panel } from './composition-panel';
import type { ChoiceMap, UpdateDiff } from './composition-types';

/**
 * The panel as it is NOW, for the completion of a command: it works on what the author sees, not on what the command
 * was issued from (an answer flipped while the request was in flight is the one kept), and falls back to the choices it
 * was issued from only when no diff of that instance is open any more.
 */
export const usePanelNow = (panel: Panel) => {
  const panelRef = useRef(panel);
  useEffect(() => {
    panelRef.current = panel;
  });
  const choicesNow = useCallback(
    (kept: { diff: UpdateDiff; choices: ChoiceMap }): ChoiceMap => {
      const current = panelRef.current;
      return current.kind === 'diff' &&
        current.diff.instance.id === kept.diff.instance.id
        ? current.choices
        : kept.choices;
    },
    [],
  );
  return { panelRef, choicesNow };
};
