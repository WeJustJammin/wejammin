import { retryable } from '../../lib/retryable-import';
import type { BlockSelector } from './cms-registry-changes';
import type { RegistryReadOutcome } from './registry-read-types';

/** The seam a test replaces: the dynamic import of the registry read. */
export const registryReadImporters = {
  read: retryable(() => import('./cms-registry-read')),
};

/**
 * The read of the designer context after a registry-digest 409. It is a re-read after a refusal (FE03 1048), never
 * part of the first paint, so its module loads then and not with the route (P2-S11-AC-106, the initial-route budget).
 * A chunk that cannot be fetched is the failed read the island already shows, with the control that repeats it.
 */
export const readRegistryOnDemand = async (
  before: readonly BlockSelector[],
): Promise<RegistryReadOutcome> => {
  try {
    return await (await registryReadImporters.read()).readRegistry(before);
  } catch {
    return {
      state: {
        kind: 'failed',
        message: 'The block choices could not be read.',
        rateLimited: false,
      },
      context: null,
    };
  }
};
