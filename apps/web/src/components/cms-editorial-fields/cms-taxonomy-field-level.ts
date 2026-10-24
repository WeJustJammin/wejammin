import type {
  TaxonomySelectorPage,
  TaxonomySelectorTerm,
} from '@wejammin/contracts';

/**
 * The level text of one taxonomy selector term, derived from the page alone.
 *
 * A `TaxonomySelectorTerm` carries `parentId` but no depth, and a page is
 * bounded at 100 items, so a level is stated only when the whole ancestry is
 * present on the page and belongs to the same vocabulary identity as the term.
 * Identity is the triple `taxonomyId` + `taxonomyVersionId` + `taxonomyKey`:
 * the same key under another lineage or version is not the same vocabulary, so
 * an ancestor from it is not an ancestor. Anything else — a term the page does
 * not carry, a chain that leaves the page, a cycle, or a `termId` the page
 * carries twice in disagreeing rows — states "Level unavailable" rather than an
 * invented depth. A flat vocabulary states no level at all.
 *
 * This is a presentation limit of the paged contract, not a contract change:
 * the selector carries no depth, so the page is the only evidence here.
 */
export type CmsTaxonomyTermLevel =
  | { readonly kind: 'none' }
  | { readonly kind: 'level'; readonly level: number }
  | { readonly kind: 'unavailable' };

/** The exact text of a term whose level cannot be derived from the page. */
export const CMS_TAXONOMY_LEVEL_UNAVAILABLE = 'Level unavailable';

/** The same vocabulary: lineage id, version id and key all agree. */
const sameVocabulary = (
  left: TaxonomySelectorTerm,
  right: TaxonomySelectorTerm,
): boolean =>
  left.taxonomyId === right.taxonomyId &&
  left.taxonomyVersionId === right.taxonomyVersionId &&
  left.taxonomyKey === right.taxonomyKey;

/** The text of a level, or undefined when the term states no level at all. */
export const cmsTaxonomyTermLevelText = (
  level: CmsTaxonomyTermLevel,
): string | undefined =>
  level.kind === 'level'
    ? `Level ${level.level}`
    : level.kind === 'unavailable'
      ? CMS_TAXONOMY_LEVEL_UNAVAILABLE
      : undefined;

/**
 * Reads the level of any term of one page. The page is indexed once, so the
 * returned reader is cheap enough to call for every row of the group.
 */
export const cmsTaxonomyLevelReader = (
  page: TaxonomySelectorPage,
): ((term: TaxonomySelectorTerm) => CmsTaxonomyTermLevel) => {
  const byTermId = new Map<string, readonly TaxonomySelectorTerm[]>();
  for (const term of page.items) {
    if (term.shape !== 'hierarchical') continue;
    const found = byTermId.get(term.termId);
    byTermId.set(term.termId, found === undefined ? [term] : [...found, term]);
  }
  // One term per id, or nothing: rows that disagree about the same id are not
  // evidence of an ancestor.
  const parentOf = (termId: string): TaxonomySelectorTerm | null => {
    const found = byTermId.get(termId);
    if (found === undefined) return null;
    const first = found[0];
    if (first === undefined) return null;
    const agrees = found.every(
      (other) =>
        other.parentId === first.parentId && sameVocabulary(other, first),
    );
    return agrees ? first : null;
  };
  return (term) => {
    if (term.shape !== 'hierarchical') return { kind: 'none' };
    const seen = new Set<string>([term.termId]);
    let level = 1;
    let current = term;
    while (current.parentId !== null) {
      const parentId = current.parentId;
      if (seen.has(parentId)) return { kind: 'unavailable' };
      seen.add(parentId);
      const parent = parentOf(parentId);
      if (parent === null || !sameVocabulary(parent, term))
        return { kind: 'unavailable' };
      level += 1;
      current = parent;
    }
    return { kind: 'level', level };
  };
};
