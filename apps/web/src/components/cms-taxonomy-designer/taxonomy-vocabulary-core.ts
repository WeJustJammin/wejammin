/**
 * The two vocabulary facts the entry editor's taxonomy field needs at hydration: the key grammar
 * and the closed shapes. They live apart from the rest of `taxonomy-vocabulary.ts` (reasons,
 * canonical domains, copy) so a page that only reads a vocabulary does not load that table
 * (P2-S11-AC-106). `taxonomy-vocabulary.ts` re-exports both.
 */
export const TAXONOMY_KEY_REGEX = /^[a-z][a-z0-9-]{1,63}$/u;

export const TAXONOMY_SHAPES = ['flat', 'hierarchical'] as const;
export type TaxonomyShape = (typeof TAXONOMY_SHAPES)[number];
