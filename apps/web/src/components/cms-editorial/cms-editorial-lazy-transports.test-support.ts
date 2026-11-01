/**
 * The write and read transports the editor, create and conflict islands import
 * lazily (FE03 "Performance budgets and loading strategy", AC-106). A test that
 * drives a save, a create or a resolve loads them first, so the step under test
 * is not racing the first load of a module (which the island's `act`-bounded
 * waits do not cover). Production never preloads: a cold route fetches none of
 * them.
 */
export const preloadCmsEditorialTransports = async (): Promise<void> => {
  await Promise.all([
    // The save flow loads with the first save (cms-editorial-entry-editor-controller.ts).
    import('./cms-editorial-entry-editor-save'),
    import('./cms-editorial-runtime'),
    import('./cms-editorial-entry-draft-detail-transport'),
    import('./cms-editorial-entry-create-submit'),
    import('./cms-editorial-conflict-resolve'),
    import('./cms-editorial-conflict-detail-transport'),
    import('../../lib/cms-editorial-page-actions-restore'),
    import('./cms-editorial-result-save'),
  ]);
};
