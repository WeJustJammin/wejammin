import { retryable } from '../../lib/retryable-import';
import { importModule } from '../../lib/module-unavailable';
import type { readTaxonomyVersions } from './taxonomy-versions-read';

/** The seam a test replaces: the dynamic import of the versions read. */
export const taxonomyVersionsImporters = {
  read: retryable(() => import('./taxonomy-versions-read')),
};

/**
 * The default versions read of the vocabulary islands. Every use of it is a re-read after a command or a lost answer
 * (FE03 1048 to 1050), never part of the first paint, so its module loads then and not with the route (P2-S11-AC-106,
 * the initial-route budget). A chunk that cannot be fetched is the `unavailable` answer the callers already handle.
 */
export const readTaxonomyVersionsOnDemand: typeof readTaxonomyVersions = async (
  ...input
) => {
  try {
    const module = await importModule(() => taxonomyVersionsImporters.read());
    return await module.readTaxonomyVersions(...input);
  } catch {
    return { kind: 'unavailable' };
  }
};
