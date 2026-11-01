/**
 * The vocabulary facts the entry editor's taxonomy field and the versions reads need at hydration: the key grammar,
 * and the closed shapes. They live apart from the rest of `taxonomy-vocabulary.ts` (reasons,
 * canonical domains, copy) so a page that only reads a vocabulary does not load that table
 * (P2-S11-AC-106). `taxonomy-vocabulary.ts` re-exports the grammar and the shapes.
 */
export const TAXONOMY_KEY_REGEX = /^[a-z][a-z0-9-]{1,63}$/u;

/** `cmsTaxonomyVersionsRead` holds at most the newest 50 versions (BE03c 406). */
export const TAXONOMY_VERSIONS_PAGE_MAX = 50;

export const TAXONOMY_SHAPES = ['flat', 'hierarchical'] as const;
export type TaxonomyShape = (typeof TAXONOMY_SHAPES)[number];
