// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PARENT_ID } from '../../server/cms-taxonomy-platform.test-support';
import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { organ, pageFacts, strings, termFacts } from './term-form.test-support';
import type { TermFacts } from './taxonomy-terms-read';
import {
  HELD_PARENT_LABEL,
  useTermActionChoices,
  type TermActionChoices,
} from './use-term-action-choices';
import type { TermFormState } from './use-term-form';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const UNOFFERED_ID = '50000000-0000-4000-8000-0000000000ff';
const TUBA_ID = '50000000-0000-4000-8000-0000000000a1';
/**
 * The copy for a chosen parent a later read reports merged. Root owns the final wording; this
 * matches the root's example ("Chosen parent (no longer available)") and the component test's
 * `/no longer available/i` assertion, and the hook does not export it yet.
 */
const CHOSEN_PARENT_UNAVAILABLE_LABEL = 'Chosen parent (no longer available)';
const underStrings = termFacts({ parentId: PARENT_ID });
const tuba = termFacts({
  termId: TUBA_ID,
  termKey: 'tuba',
  labels: [{ locale: 'en', label: 'Tuba' }],
  aliases: [],
});
/** `tuba` as a later read reports it: merged away into `strings`. */
const mergedTuba = termFacts({
  ...tuba,
  lifecycle: 'merged',
  successorId: PARENT_ID,
});
const mergedStrings = termFacts({ ...strings, lifecycle: 'merged' });

const form = (patch: Partial<TermFormState>): TermFormState => ({
  action: 'rename',
  target: underStrings,
  termKey: '',
  parentId: PARENT_ID,
  survivorId: '',
  survivorLost: false,
  labels: [],
  aliases: [],
  step: 'edit',
  ...patch,
});

/** Mounts the hook on a complete page (no read) and returns what it produced. */
const choicesOf = (
  state: TermFormState,
  shape: 'hierarchical' | 'flat' = 'hierarchical',
  onChange: (change: Partial<TermFormState>) => void = vi.fn(),
  pageTerms: readonly TermFacts[] = pageFacts([underStrings, organ]).items,
): TermActionChoices => {
  let seen: TermActionChoices | null = null;
  const Probe = (): null => {
    seen = useTermActionChoices({
      form: state,
      shape,
      taxonomyId: '40000000-0000-4000-8000-000000000001',
      terms: pageTerms,
      pageComplete: true,
      onChange,
    });
    return null;
  };
  mountElement(<Probe />);
  if (seen === null) throw new Error('the hook did not run');
  return seen;
};

describe('useTermActionChoices: a rename holds a current parent no page lists (FE03 :28)', () => {
  it('holds it under the "not loaded yet" label when no read lists it', () => {
    expect(choicesOf(form({})).heldParent).toEqual({
      termId: PARENT_ID,
      label: HELD_PARENT_LABEL,
    });
  });

  it.each(['merge', 'deprecate', 'alias'] as const)(
    'holds no parent for %s: there is no parent field',
    (action) => {
      expect(choicesOf(form({ action })).heldParent).toBeNull();
    },
  );

  it('holds no parent in a flat vocabulary', () => {
    expect(choicesOf(form({}), 'flat').heldParent).toBeNull();
  });

  it('holds no parent for a term at the top level', () => {
    expect(
      choicesOf(form({ target: termFacts(), parentId: '' })).heldParent,
    ).toBeNull();
  });
});

describe('useTermActionChoices: a merge survivor that is no longer offered is cleared (FE03 :887)', () => {
  it('clears it, announces it and returns to the edit step', () => {
    const onChange = vi.fn();
    choicesOf(
      form({ action: 'merge', parentId: '', survivorId: UNOFFERED_ID }),
      'hierarchical',
      onChange,
    );
    expect(onChange).toHaveBeenCalledWith({
      survivorId: '',
      survivorLost: true,
      step: 'edit',
    });
  });

  it('keeps a survivor that is offered', () => {
    const onChange = vi.fn();
    const result = choicesOf(
      form({ action: 'merge', parentId: '', survivorId: organ.termId }),
      'hierarchical',
      onChange,
    );
    expect(result.survivor).toEqual(organ);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not treat the survivor field of another action as a lost survivor', () => {
    const onChange = vi.fn();
    choicesOf(form({ survivorId: UNOFFERED_ID }), 'hierarchical', onChange);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("useTermActionChoices: the held option is the form's actual parent, never an unrelated current parent (FE03 :887)", () => {
  it('holds it labelled as no longer available, not as the current parent', () => {
    const result = choicesOf(
      form({ parentId: TUBA_ID }),
      'hierarchical',
      vi.fn(),
      pageFacts([underStrings, organ, mergedTuba]).items,
    );
    expect(result.heldParent).toEqual({
      termId: TUBA_ID,
      label: CHOSEN_PARENT_UNAVAILABLE_LABEL,
    });
    expect(result.heldParent?.label).not.toContain('current parent');
  });

  it('holds an unlisted chosen parent as the chosen parent, under the no-longer-available copy', () => {
    const result = choicesOf(
      form({ parentId: TUBA_ID }),
      'hierarchical',
      vi.fn(),
      pageFacts([underStrings, organ]).items,
    );
    expect(result.heldParent).toEqual({
      termId: TUBA_ID,
      label: CHOSEN_PARENT_UNAVAILABLE_LABEL,
    });
  });

  it('holds no option once a read offers the chosen parent again', () => {
    const result = choicesOf(
      form({ parentId: TUBA_ID }),
      'hierarchical',
      vi.fn(),
      pageFacts([underStrings, organ, tuba]).items,
    );
    expect(result.heldParent).toBeNull();
  });

  it('still holds a current parent the page lists as merged under its own name', () => {
    const result = choicesOf(
      form({}),
      'hierarchical',
      vi.fn(),
      pageFacts([underStrings, organ, mergedStrings]).items,
    );
    expect(result.heldParent).toEqual({
      termId: PARENT_ID,
      label: 'strings (Strings) (current parent, merged)',
    });
  });
});
