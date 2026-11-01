import type { TermFacts } from './taxonomy-terms-read';

/** The key a person knows a term by, with its first label when it has one. */
export const termName = (
  term: Pick<TermFacts, 'termKey' | 'labels'>,
): string => {
  const first = term.labels[0];
  return first === undefined
    ? term.termKey
    : `${term.termKey} (${first.label})`;
};

/**
 * A choice the select holds although no loaded page lists it: the value stays visible, selected
 * and operable instead of falling to the first option (WCAG 4.1.2).
 */
export interface HeldChoice {
  readonly termId: string;
  readonly label: string;
}

/** Where a merged term redirects, in words; the survivor may be on another page. */
export const redirectText = (
  term: Pick<TermFacts, 'successorId'>,
  terms: readonly TermFacts[],
): string => {
  const survivor = terms.find((entry) => entry.termId === term.successorId);
  return survivor === undefined
    ? 'Redirects permanently to another term that is not on this page.'
    : `Redirects permanently to ${survivor.termKey}.`;
};
