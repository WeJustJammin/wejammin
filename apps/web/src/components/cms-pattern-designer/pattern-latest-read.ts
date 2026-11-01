import type {
  CmsDefinitionVersionState,
  PatternNode,
} from '@wejammin/contracts';

import { retryable } from '../../lib/retryable-import';

/**
 * The verified facts of the owner's latest version of a pattern key
 * (`cmsPatternLatestRead`). The same-origin proxy has already parsed the strict
 * `PatternVersionDetail`; the browser repeats the identity binding and the tree
 * rules structurally (zod-free, FE03 AC261).
 */
export interface PatternLatestDetail {
  readonly id: string;
  readonly version: string;
  readonly contentHash: string;
  readonly state: CmsDefinitionVersionState;
  readonly patternKey: string;
  readonly patternVersion: number;
  readonly compatibleTypeIds: readonly string[];
  readonly nodeCount: number;
  /** The server-computed registry digest of this version. */
  readonly blockRegistryDigest: string;
  readonly blockTree: PatternNode[];
}

export type PatternLatestResult =
  | { readonly kind: 'loaded'; readonly detail: PatternLatestDetail }
  | {
      readonly kind: 'rejected';
      readonly status: 401 | 403 | 404 | 429;
      /** A 429's stated wait in whole seconds (FE03 :1172); absent when none was stated. */
      readonly retryAfterSeconds?: number;
    }
  | { readonly kind: 'unavailable' };

/** The seam a test replaces: the dynamic import of the reader (`pattern-latest-fetch.ts`, an on-demand chunk). */
export const patternLatestImporters = {
  read: retryable(() => import('./pattern-latest-fetch')),
};

/**
 * Recheck the authoritative latest version without carrying mutation authority. It is a re-read after a command, a lost
 * answer or a 409, never part of the first paint, so the reader loads when the island asks (P2-S11-AC-106, the initial
 * route budget). A chunk that cannot be fetched is the unavailable read the island already shows, with its control to
 * repeat it.
 */
export const readLatestPatternVersion = async (
  patternKey: string,
  fetcher?: typeof fetch,
  controls?: { readonly signal?: AbortSignal },
): Promise<PatternLatestResult> => {
  try {
    return await (
      await patternLatestImporters.read()
    ).readLatestPatternVersion(patternKey, fetcher, controls);
  } catch {
    return { kind: 'unavailable' };
  }
};
