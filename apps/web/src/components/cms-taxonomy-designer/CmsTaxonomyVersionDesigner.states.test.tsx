// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TAXONOMY_ID } from '../../server/cms-taxonomy-platform.test-support';
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
import CmsTaxonomyVersionDesigner from './CmsTaxonomyVersionDesigner';
import { fillValid, mount, text } from './taxonomy-designer-form.test-support';
import {
  CSRF_TOKEN,
  createdFacts,
  loadedVersions,
  readStub,
  submitStub,
  versionFacts,
} from './taxonomy-designer.test-support';
import type { TaxonomySubmitResult } from './taxonomy-designer-submit';

beforeAll(enableReactAct);
// The unknown-outcome check loads after an uncertain write (P2-S11-AC-106).
beforeAll(async () => {
  await import('./taxonomy-outcome-reconcile');
});
afterAll(disableReactAct);

/**
 * Slice 12 definition governance states, `commandState` column (FE03 1043-1049), for the vocabulary
 * version designer (CMS-03C-16; the brief calls it CMS-03C-03, the spec and the transport use
 * CMS-03C-16 for the version and CMS-03C-03 for the term action). `loading` is proven in
 * CmsTaxonomyVersionDesigner.pending.test.tsx; `empty` is "Not applicable" in the spec (no test).
 */
const base = versionFacts({
  version: '2',
  taxonomyVersion: 2,
  state: 'active',
});
const mountEdit = (
  props: Partial<React.ComponentProps<typeof CmsTaxonomyVersionDesigner>> = {},
) =>
  mountElement(
    <CmsTaxonomyVersionDesigner
      latest={base}
      csrfToken={CSRF_TOKEN}
      {...props}
    />,
  );
const resultHeading = (container: HTMLElement): string =>
  container.querySelector('#cms-taxonomy-result-heading')?.textContent ?? '';
const save = async (container: HTMLElement, label: string): Promise<void> => {
  await click(buttonNamed(container, label));
  await flush();
};
const refusedWith = async (result: TaxonomySubmitResult) => {
  const submit = submitStub(result);
  const view = mount({ submit });
  await fillValid(view.container);
  await save(view.container, 'Create draft');
  return view;
};

describe('CmsTaxonomyVersionDesigner (CMS-03C-16) commandState', () => {
  it('[P2-S12-AC-271] commandState idle: no result region is shown, the unsent scoped draft is kept and nothing is sent (CMS-03C-16)', async () => {
    const submit = submitStub();
    const { container } = mount({ submit });
    expect(resultHeading(container)).toBe('');
    expect(container.querySelector('.cms-taxonomy-status')?.textContent).toBe(
      '',
    );
    expect(buttonNamed(container, 'Create draft').disabled).toBe(false);
    await fillValid(container);
    await typeInto(byLabel(container, 'Vocabulary key'), 'instruments-draft');
    expect(byLabel<HTMLInputElement>(container, 'Vocabulary key').value).toBe(
      'instruments-draft',
    );
    expect(resultHeading(container)).toBe('');
    expect(buttonNamed(container, 'Create draft').disabled).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-271] commandState success (kept half): names the saved draft, locks the form and links its page; the versions list is NOT refetched (D4) (CMS-03C-16)', async () => {
    const readVersions = readStub(loadedVersions([base]));
    const submit = submitStub({
      kind: 'created',
      resource: createdFacts({ taxonomyVersion: 3, version: '3' }),
    });
    const { container } = mountEdit({ submit, readVersions });
    await save(container, 'Save successor draft');
    expect(resultHeading(container)).toBe('Vocabulary draft saved');
    const region = container.querySelector(
      '.cms-taxonomy-status',
    ) as HTMLElement;
    expect(region.getAttribute('role')).toBe('status');
    expect(region.textContent).toContain('instruments');
    expect(region.textContent).toContain('3');
    expect(region.textContent).toContain('Draft');
    expect(region.querySelector('a')?.getAttribute('href')).toBe(
      `/app/cms-content-modeling/taxonomies/${TAXONOMY_ID}`,
    );
    // The draft is closed: nothing unsent remains to submit and a second save cannot be sent.
    expect(
      container.querySelector<HTMLFieldSetElement>('form fieldset')?.disabled,
    ).toBe(true);
    expect(buttonNamed(container, 'Save successor draft').disabled).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  describe('commandState error', () => {
    it('[P2-S12-AC-271] commandState error: a 401 offers sign-in returning to the vocabulary page and never a step-up route (CMS-03C-16 lists no STEP_UP_REQUIRED row)', async () => {
      const { container } = await refusedWith({
        kind: 'rejected',
        status: 401,
      });
      expect(resultHeading(container)).toBe('The vocabulary was not saved');
      const link = container.querySelector('a[href^="/auth/sign-in"]');
      expect(link?.getAttribute('href')).toBe(
        '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling%2Ftaxonomies%2Fnew',
      );
      expect(container.querySelector('a[href*="step-up"]')).toBeNull();
      expect(text(container)).toContain('Your session expired.');
    });

    it.each([
      [{ kind: 'refused', status: 403, reason: 'capability_missing' } as const],
      [{ kind: 'rejected', status: 403 } as const],
    ])(
      '[P2-S12-AC-271] commandState error: a 403 %j renders the CapabilityGate with the fixed capability copy as an alert, no step-up route (CMS-03C-16)',
      async (result) => {
        const { container } = await refusedWith(result);
        const region = container.querySelector('.cms-taxonomy-status');
        expect(region?.getAttribute('role')).toBe('alert');
        expect(region?.textContent).toContain(
          'Taxonomy curator access is required for this acting context. Nothing was saved.',
        );
        expect(
          region?.querySelector('[data-cms-editorial-capability-gate]'),
        ).not.toBeNull();
        // FE03 "focus summary/field": the gate's heading is the focused named result.
        expect(document.activeElement).toBe(
          document.querySelector('[data-cms-editorial-capability-gate] h2'),
        );
        expect(container.querySelector('a[href*="step-up"]')).toBeNull();
        expect(
          byLabel<HTMLInputElement>(container, 'Vocabulary key').value,
        ).toBe('instruments');
      },
    );

    it('[P2-S12-AC-271] commandState error (kept half): a 409 renders the fixed conflict copy, keeps the draft, and offers the explicit latest-version check; it is NOT refetched automatically (D2) (CMS-03C-16)', async () => {
      const readVersions = readStub(loadedVersions([base]));
      const submit = submitStub({ kind: 'conflict', currentVersion: '4' });
      const { container } = mountEdit({ submit, readVersions });
      await click(byLabel(container, 'Place'));
      await save(container, 'Save successor draft');
      expect(resultHeading(container)).toBe('Another version was saved');
      expect(text(container)).toContain(
        'Another version of this vocabulary was saved after the one you started from. Nothing was overwritten.',
      );
      expect(
        container.querySelector('.cms-taxonomy-status')?.getAttribute('role'),
      ).toBe('alert');
      expect(buttonNamed(container, 'Check latest version').disabled).toBe(
        false,
      );
      expect(byLabel<HTMLInputElement>(container, 'Place').checked).toBe(true);
    });

    it('[P2-S12-AC-271] commandState error (kept half): a 422 renders the fixed rejected copy in the result region and keeps every entry; CMS-03C-16 has no typed 422 reason token (CMS-03C-16)', async () => {
      const { container } = await refusedWith({
        kind: 'rejected',
        status: 422,
      });
      expect(
        container.querySelector('.cms-taxonomy-status')?.getAttribute('role'),
      ).toBe('alert');
      expect(text(container)).toContain(
        'The server rejected the vocabulary. Review the form and try again. Nothing was saved.',
      );
      expect(document.activeElement?.id).toBe('cms-taxonomy-result-heading');
      expect(
        container.querySelectorAll(
          'ul[aria-label="Added content type keys"] li',
        ),
      ).toHaveLength(2);
    });
  });

  describe('commandState degraded', () => {
    it('[P2-S12-AC-271] commandState degraded: an unknown outcome claims no success, refetches the versions before any retry, and settles on the server answer (CMS-03C-16)', async () => {
      const own = versionFacts({
        id: '40000000-0000-4000-8000-000000000044',
        version: '3',
        taxonomyVersion: 3,
        state: 'draft',
      });
      const readVersions = readStub(loadedVersions([own, base]));
      const submit = submitStub({ kind: 'uncertain' });
      const { container } = mountEdit({ submit, readVersions });
      await save(container, 'Save successor draft');
      // Reconciled against the server before any second send: exactly one write, one read.
      expect(submit).toHaveBeenCalledTimes(1);
      expect(readVersions).toHaveBeenCalledTimes(1);
      expect(resultHeading(container)).toBe('Vocabulary draft saved');
      expect(text(container)).toContain('3');
    });

    it('[P2-S12-AC-271] commandState degraded: when the refetch shows nothing committed the draft is kept and a retry replays the same Idempotency-Key; a failed refetch stays unknown (CMS-03C-16)', async () => {
      const submit = submitStub({ kind: 'uncertain' }, { kind: 'uncertain' });
      const readVersions = readStub(loadedVersions([base]), {
        kind: 'unavailable',
      });
      const { container } = mountEdit({ submit, readVersions });
      await save(container, 'Save successor draft');
      expect(readVersions).toHaveBeenCalledTimes(1);
      expect(resultHeading(container)).toBe('Nothing was saved');
      expect(text(container)).not.toContain('Vocabulary draft saved');
      await save(container, 'Save successor draft');
      expect(readVersions).toHaveBeenCalledTimes(2);
      // The unavailable refetch is not a verdict: still unknown, still no success claimed.
      expect(resultHeading(container)).toBe('The result is unknown');
      expect(text(container)).not.toContain('Vocabulary draft saved');
      const calls = submit.mock.calls as unknown as [unknown, string, string][];
      expect(calls[1]?.[2]).toBe(calls[0]?.[2]);
    });
  });

  describe('commandState disabled', () => {
    it('[P2-S12-AC-271] commandState disabled: without a protected form session the reason is stated and the commit control is off; the island takes no permittedNextActions (CMS-03C-16)', async () => {
      const submit = submitStub();
      const { container } = mount({ csrfToken: '', submit });
      await fillValid(container);
      expect(text(container)).toContain(
        'Reload to restore the protected form session.',
      );
      expect(buttonNamed(container, 'Create draft').disabled).toBe(true);
      await click(buttonNamed(container, 'Create draft'));
      expect(submit).not.toHaveBeenCalled();
    });

    it('[P2-S12-AC-271] commandState disabled: after a 429 the commit control stays off for the stated wait and the copy states it (CMS-03C-16)', async () => {
      const { container } = await refusedWith({
        kind: 'rejected',
        status: 429,
        retryAfterSeconds: 30,
      });
      expect(text(container)).toContain('Wait at least 30 seconds');
      expect(buttonNamed(container, 'Create draft').disabled).toBe(true);
    });
  });
});
