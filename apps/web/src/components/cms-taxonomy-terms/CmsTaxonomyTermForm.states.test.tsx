// @vitest-environment jsdom
import './term-action-preload.test-support';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SURVIVOR_ID } from '../../server/cms-taxonomy-platform.test-support';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyTermForm from './CmsTaxonomyTermForm';
import type { TermActionResult } from './term-action-submit';
import {
  REVIEW_HREF,
  doneResult,
  formProps,
  readTermsStub,
  readVersionsStub,
  submitStub,
  termsLoaded,
} from './term-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/**
 * Slice 12 definition governance states, `commandState` column (FE03 1043-1049), for the taxonomy term
 * action form (CMS-03C-03; the brief calls it CMS-03C-16, the spec and the transport use CMS-03C-03 for the
 * term action). `loading` is proven in CmsTaxonomyTermForm.pending.test.tsx; `empty` is "Not applicable"
 * in the spec (no test).
 */
const BASE = formProps().basePath;

const mount = (
  props: Partial<React.ComponentProps<typeof CmsTaxonomyTermForm>> = {},
) => {
  const readTerms = readTermsStub(termsLoaded());
  const readVersions = readVersionsStub();
  const view = mountElement(
    <CmsTaxonomyTermForm
      {...formProps({ readTerms, readVersions, ...props })}
    />,
  );
  return { ...view, readTerms, readVersions };
};
const openCreate = async (container: HTMLElement): Promise<void> => {
  await click(buttonNamed(container, 'Create a term'));
  await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
  await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Cello');
};
const createWith = async (
  ...results: TermActionResult[]
): Promise<
  ReturnType<typeof mount> & { submit: ReturnType<typeof submitStub> }
> => {
  const submit = submitStub(...results);
  const view = mount({ submit });
  await openCreate(view.container);
  await click(buttonNamed(view.container, 'Create term'));
  await flush();
  return { ...view, submit };
};
const region = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>('.cms-term-status');
const heading = (container: HTMLElement): string =>
  region(container)?.querySelector('h3')?.textContent ?? '';
const typed = (container: HTMLElement): string[] => [
  byLabel<HTMLInputElement>(container, 'Term key').value,
  byLabel<HTMLInputElement>(container, 'Label 1').value,
];

describe('CmsTaxonomyTermForm (CMS-03C-03) commandState', () => {
  it('[P2-S12-AC-271] commandState idle: no form is open until a term action is chosen, then the unsent scoped draft is kept with no result shown and nothing sent (CMS-03C-03)', async () => {
    const submit = submitStub();
    const { container } = mount({ submit });
    expect(container.querySelector('.cms-term-action')).toBeNull();
    expect(region(container)).toBeNull();
    await openCreate(container);
    expect(container.querySelector('.cms-term-action')).not.toBeNull();
    expect(typed(container)).toEqual(['cello', 'Cello']);
    expect(region(container)).toBeNull();
    expect(buttonNamed(container, 'Create term').disabled).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-271] commandState success: names the created term, clears the draft by closing the form, and refetches the term list and the active version (CMS-03C-03)', async () => {
    const view = await createWith(doneResult());
    expect(heading(view.container)).toBe('Term guitar created');
    expect(region(view.container)?.getAttribute('role')).toBe('status');
    expect(region(view.container)?.textContent).toContain(
      'guitar is active and available to authors.',
    );
    expect(view.container.querySelector('.cms-term-action')).toBeNull();
    expect(view.readTerms).toHaveBeenCalled();
    expect(view.readVersions).toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('cms-term-result-heading');
    // Reopening starts from an empty draft, not the cleared one.
    await click(buttonNamed(view.container, 'Create a term'));
    expect(byLabel<HTMLInputElement>(view.container, 'Term key').value).toBe(
      '',
    );
  });

  describe('commandState error', () => {
    it('[P2-S12-AC-271] commandState error: a 401 offers sign-in returning to the vocabulary page and never a step-up route (CMS-03C-03 lists no STEP_UP_REQUIRED row)', async () => {
      const { container } = await createWith({ kind: 'rejected', status: 401 });
      expect(region(container)?.getAttribute('role')).toBe('alert');
      expect(region(container)?.querySelector('a')?.getAttribute('href')).toBe(
        `/auth/sign-in?returnTo=${encodeURIComponent(BASE)}`,
      );
      expect(container.querySelector('a[href*="step-up"]')).toBeNull();
      expect(typed(container)).toEqual(['cello', 'Cello']);
    });

    it('[P2-S12-AC-271] commandState error (kept half): a 403 capability_missing renders the fixed curator-access copy as an alert, no step-up route; no CapabilityGate element (D1) (CMS-03C-03)', async () => {
      const { container } = await createWith({
        kind: 'refused',
        status: 403,
        reason: 'capability_missing',
      });
      expect(region(container)?.getAttribute('role')).toBe('alert');
      expect(region(container)?.textContent).toContain(
        'Taxonomy curator access is required for this acting context. Nothing was saved.',
      );
      expect(container.querySelector('a[href*="step-up"]')).toBeNull();
      expect(typed(container)).toEqual(['cello', 'Cello']);
    });

    it.each([
      [
        { kind: 'conflict', currentVersion: '3' } as const,
        'The vocabulary changed',
        'The list and the active version were refreshed',
      ],
      [
        {
          kind: 'refused',
          status: 409,
          reason: 'taxonomy_not_active',
        } as const,
        'The term was not saved',
        'This vocabulary has no active version, so its terms cannot change. Nothing was saved.',
      ],
    ])(
      '[P2-S12-AC-271] commandState error: a 409 %j renders fixed copy and refetches the list and the active version, keeping the draft (CMS-03C-03)',
      async (result, expectedHeading, copy) => {
        const view = await createWith(result);
        expect(heading(view.container)).toBe(expectedHeading);
        expect(region(view.container)?.getAttribute('role')).toBe('alert');
        expect(region(view.container)?.textContent).toContain(copy);
        expect(view.readTerms).toHaveBeenCalled();
        expect(view.readVersions).toHaveBeenCalled();
        expect(typed(view.container)).toEqual(['cello', 'Cello']);
      },
    );

    it.each([
      [
        {
          kind: 'refused',
          status: 422,
          reason: 'canonical_overlap',
          domain: 'instrument',
          canonicalId: SURVIVOR_ID,
        } as const,
        'This matches a canonical record',
        'This matches a canonical instrument record. Reference the canonical record instead. Nothing was saved.',
      ],
      [
        {
          kind: 'refused',
          status: 422,
          reason: 'canonical_source_unavailable',
          domain: 'rights',
        } as const,
        'The term was not saved',
        'Checks against rights records are not available yet',
      ],
    ])(
      '[P2-S12-AC-271] commandState error (kept half): a 422 %j renders its fixed copy in the result region with the draft kept; the copy is NOT rendered at the field (D6) (CMS-03C-03)',
      async (result, expectedHeading, copy) => {
        const { container } = await createWith(result);
        expect(heading(container)).toBe(expectedHeading);
        expect(region(container)?.getAttribute('role')).toBe('alert');
        expect(region(container)?.textContent).toContain(copy);
        expect(document.activeElement?.id).toBe('cms-term-result-heading');
        expect(typed(container)).toEqual(['cello', 'Cello']);
      },
    );
  });

  it('[P2-S12-AC-271] commandState degraded: an unknown outcome claims no success, refetches the list and the active version before any retry, then replays the same Idempotency-Key (CMS-03C-03)', async () => {
    const view = await createWith({ kind: 'uncertain' }, doneResult());
    expect(heading(view.container)).toBe('The result is unknown');
    expect(region(view.container)?.textContent).not.toMatch(/created/u);
    // Reconciled before anything else is offered: the one write has been sent once, the reads have run.
    expect(view.submit).toHaveBeenCalledTimes(1);
    expect(view.readTerms).toHaveBeenCalled();
    expect(view.readVersions).toHaveBeenCalled();
    expect(typed(view.container)).toEqual(['cello', 'Cello']);
    await click(buttonNamed(view.container, 'Create term'));
    await flush();
    expect(view.submit).toHaveBeenCalledTimes(2);
    const calls = view.submit.mock.calls as unknown as [
      unknown,
      string,
      string,
    ][];
    expect(calls[1]?.[2]).toBe(calls[0]?.[2]);
    expect(calls[1]?.[0]).toEqual(calls[0]?.[0]);
    expect(heading(view.container)).toBe('Term guitar created');
  });

  describe('commandState disabled', () => {
    it('[P2-S12-AC-271] commandState disabled: with no active version the reason is stated, the review is linked and no term action is offered; the island takes no permittedNextActions (CMS-03C-03)', () => {
      const { container } = mount({
        vocabulary: { ...formProps().vocabulary, active: null },
      });
      expect(container.textContent).toContain(
        'This vocabulary has no active version, so its terms cannot change. They are listed read-only.',
      );
      expect(
        container.querySelector(`a[href="${REVIEW_HREF}"]`)?.textContent,
      ).toBe("Open the vocabulary's governed review");
      expect(() => buttonNamed(container, 'Create a term')).toThrow();
      expect(container.querySelector('.cms-term-action')).toBeNull();
    });

    it('[P2-S12-AC-271] commandState disabled (kept half): without a security token the commit control is off and nothing is sent; no reason is stated (D7) (CMS-03C-03)', async () => {
      const submit = submitStub();
      const { container } = mount({ csrfToken: '', submit });
      await openCreate(container);
      expect(buttonNamed(container, 'Create term').disabled).toBe(true);
      await click(buttonNamed(container, 'Create term'));
      expect(submit).not.toHaveBeenCalled();
    });

    it('[P2-S12-AC-271] commandState disabled: after a 429 the commit control stays off for the stated wait and the copy states it (CMS-03C-03)', async () => {
      const { container } = await createWith({
        kind: 'rejected',
        status: 429,
        retryAfterSeconds: 12,
      });
      expect(region(container)?.textContent).toContain(
        'Wait at least 12 seconds before retrying.',
      );
      expect(buttonNamed(container, 'Create term').disabled).toBe(true);
    });
  });
});
