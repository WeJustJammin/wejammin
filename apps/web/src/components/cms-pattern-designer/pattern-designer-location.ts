/** The address of a saved pattern: where its designer is reached once the key exists. */
export const savedPatternAddress = (patternKey: string): string =>
  `/app/cms-content-modeling/patterns/${encodeURIComponent(patternKey)}`;

/**
 * FE03 form contract, Completion (:1223): once a first version exists the address names the
 * saved pattern instead of `/patterns/new`, so a reload or a shared link reaches it. It replaces
 * the current history entry (no extra Back step) and touches nothing when the page already is that
 * address or there is no window (server rendering).
 */
export const showSavedPatternAddress = (patternKey: string): void => {
  if (typeof window === 'undefined') return;
  const address = savedPatternAddress(patternKey);
  if (window.location.pathname === address) return;
  window.history.replaceState(window.history.state, '', address);
};
