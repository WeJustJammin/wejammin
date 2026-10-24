import { useEffect } from 'react';

import type { TaxonomyShape } from '../cms-taxonomy-designer/taxonomy-vocabulary';
import type { TermFacts, readTaxonomyTerms } from './taxonomy-terms-read';
import {
  eligibleTerms,
  useTermChoices,
  type TermChoices,
} from './use-term-choices';
import { termName, type HeldChoice } from './term-names';
import type { TermFormState } from './use-term-form';

export interface TermActionChoicesOptions {
  readonly form: TermFormState;
  readonly shape: TaxonomyShape;
  readonly taxonomyId: string;
  /** The terms of the loaded page: where the parent and survivor choices start. */
  readonly terms: readonly TermFacts[];
  /** True when that page is the whole vocabulary, so no further read is needed. */
  readonly pageComplete: boolean;
  readonly readTerms?: typeof readTaxonomyTerms | undefined;
  readonly onChange: (change: Partial<TermFormState>) => void;
}

export interface TermActionChoices {
  /** Whether the action has a parent field (a hierarchical vocabulary). */
  readonly hasParent: boolean;
  readonly loader: TermChoices;
  /** The terms a parent or survivor may be chosen from. */
  readonly choices: readonly TermFacts[];
  /** The chosen merge survivor, or null when none is chosen or it is not offered. */
  readonly survivor: TermFacts | null;
  /**
   * The form's own parent when no offered choice lists it, so the select shows and sends that
   * value (WCAG 4.1.2). It is the current parent under its own copy only when the form still holds
   * the term's stored parent; a parent chosen since is held as the chosen parent instead.
   */
  readonly heldParent: HeldChoice | null;
  /**
   * The term's stored current parent when it is distinct from the form's parent and no offered
   * choice lists it, so a choice made since can still be undone by choosing it again.
   */
  readonly undoParent: HeldChoice | null;
}

/** Shown for a current parent that no page read so far lists (BE03c 407 has no read by id). */
export const HELD_PARENT_LABEL =
  'Current parent (not among the terms loaded yet)';

/** Shown for a parent chosen since, which a later read no longer offers (it reports the term merged). */
export const CHOSEN_PARENT_UNAVAILABLE_LABEL =
  'Chosen parent (no longer available)';

/**
 * The parent and merge-survivor choices of one term action. A survivor that is no longer offered
 * (a refresh found it merged away) is cleared and the person is told, so the sentence reviewed
 * before a merge is always the value that is sent (FE03 :887). A parent that is no longer offered
 * is held instead of cleared: the form still sends it, so the select must show it too. Its copy
 * names it as the current parent only while the form holds the term's stored parent; a parent the
 * person chose is named as the chosen parent, because the term's own current parent is no longer
 * what the form holds.
 */
export const useTermActionChoices = ({
  form,
  shape,
  taxonomyId,
  terms,
  pageComplete,
  readTerms,
  onChange,
}: TermActionChoicesOptions): TermActionChoices => {
  const { action, target } = form;
  const hasParent =
    (action === 'create' || action === 'rename') && shape === 'hierarchical';
  const chosenIds = [form.parentId, form.survivorId];
  const loader = useTermChoices({
    taxonomyId,
    enabled: hasParent || action === 'merge',
    pageTerms: terms,
    pageComplete,
    chosenIds,
    readTerms,
  });
  const choices = eligibleTerms(
    loader.terms,
    terms,
    target?.termId ?? null,
    chosenIds,
  );
  const survivor =
    choices.find((term) => term.termId === form.survivorId) ?? null;
  const lost =
    action === 'merge' && form.survivorId !== '' && survivor === null;
  useEffect(() => {
    if (!lost) return;
    onChange({ survivorId: '', survivorLost: true, step: 'edit' });
  }, [lost, onChange]);
  // Only a rename has a target with a parent (a new term has no target), so this is a rename's.
  const currentParent = target?.parentId ?? null;
  const parentId = form.parentId;
  const known = [...loader.terms, ...terms].find(
    (term) => term.termId === parentId,
  );
  const offers = (termId: string | null): boolean =>
    termId !== null && choices.some((term) => term.termId === termId);
  const heldParent: HeldChoice | null =
    hasParent && parentId !== '' && !offers(parentId)
      ? {
          termId: parentId,
          label:
            parentId === currentParent
              ? known === undefined
                ? HELD_PARENT_LABEL
                : `${termName(known)} (current parent, ${known.lifecycle})`
              : CHOSEN_PARENT_UNAVAILABLE_LABEL,
        }
      : null;
  const undoKnown = [...loader.terms, ...terms].find(
    (term) => term.termId === currentParent,
  );
  const undoParent: HeldChoice | null =
    hasParent &&
    currentParent !== null &&
    currentParent !== parentId &&
    !offers(currentParent)
      ? {
          termId: currentParent,
          label:
            undoKnown === undefined
              ? HELD_PARENT_LABEL
              : `${termName(undoKnown)} (current parent, ${undoKnown.lifecycle})`,
        }
      : null;
  return { hasParent, loader, choices, survivor, heldParent, undoParent };
};
