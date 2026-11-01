// @vitest-environment jsdom
import type { TaxonomyVersionRequest } from '@wejammin/contracts';
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
import {
  CSRF_TOKEN,
  createdFacts,
  loadedVersions,
  readStub,
  submitStub,
  versionFacts,
} from './taxonomy-designer.test-support';

beforeAll(enableReactAct);
// The unknown-outcome check loads after an uncertain write (P2-S11-AC-106); load it first so the
// step under test does not race the first load of a module.
beforeAll(async () => {
  await import('./taxonomy-outcome-reconcile');
});
afterAll(disableReactAct);

const base = versionFacts({
  version: '2',
  taxonomyVersion: 2,
  state: 'active',
});
const newer = versionFacts({
  id: '40000000-0000-4000-8000-000000000044',
  version: '4',
  taxonomyVersion: 4,
  state: 'draft',
  shape: 'flat',
  allowedTypeKeys: ['article', 'release'],
  canonicalOverlapDomains: [],
});
const mount = (
  props: Partial<React.ComponentProps<typeof CmsTaxonomyVersionDesigner>> = {},
) =>
  mountElement(
    <CmsTaxonomyVersionDesigner
      latest={base}
      csrfToken={CSRF_TOKEN}
      {...props}
    />,
  );
const text = (container: HTMLElement): string => container.textContent ?? '';
const sentOf = (
  submit: ReturnType<typeof submitStub>,
  call = 0,
): TaxonomyVersionRequest =>
  (submit.mock.calls[call] as unknown as [TaxonomyVersionRequest])[0];

describe('CmsTaxonomyVersionDesigner: a compare-and-set conflict', () => {
  it('compares the newer version beside the unsent draft and rebases only on request', async () => {
    const submit = submitStub(
      { kind: 'conflict', currentVersion: '4' },
      {
        kind: 'created',
        resource: createdFacts({ taxonomyVersion: 5, version: '5' }),
      },
    );
    const readVersions = readStub(loadedVersions([newer, base]));
    const { container } = mount({ submit, readVersions });
    await click(byLabel(container, 'Place'));
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(document.activeElement?.textContent).toBe(
      'Another version was saved',
    );
    expect(text(container)).toContain('Nothing was overwritten.');
    expect(readVersions).not.toHaveBeenCalled();
    await click(buttonNamed(container, 'Check latest version'));
    await flush();
    expect(text(container)).toContain('Latest saved version: 4, draft.');
    expect(text(container)).toContain('Your unsent draft: Role, Place');
    expect(text(container)).toContain('Version 4: Flat');
    expect(text(container)).toContain(
      'Only in your draft: profile. Only in the latest version: release.',
    );
    expect(text(container)).toContain('Only in your draft: Role, Place.');
    await click(
      buttonNamed(container, 'Keep my edits and base them on version 4'),
    );
    expect(text(container)).toContain('Editing from version 4.');
    expect(byLabel<HTMLInputElement>(container, /^Hierarchical/u).checked).toBe(
      true,
    );
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(sentOf(submit, 1)).toMatchObject({
      expectedVersion: '4',
      shape: 'hierarchical',
      allowedTypeKeys: ['article', 'profile'],
    });
    expect(text(container)).toContain('Vocabulary draft saved');
  });

  it('discards the unsent draft for the newer version only when asked', async () => {
    const submit = submitStub({ kind: 'conflict', currentVersion: '4' });
    const readVersions = readStub(loadedVersions([newer, base]));
    const { container } = mount({ submit, readVersions });
    await click(byLabel(container, 'Place'));
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    await click(buttonNamed(container, 'Check latest version'));
    await flush();
    await click(buttonNamed(container, 'Discard my edits and load version 4'));
    expect(byLabel<HTMLInputElement>(container, /^Flat/u).checked).toBe(true);
    expect(byLabel<HTMLInputElement>(container, 'Place').checked).toBe(false);
    expect(byLabel<HTMLInputElement>(container, 'Role').checked).toBe(false);
    expect(text(container)).toContain('Editing from version 4.');
    expect(container.querySelector('.cms-taxonomy-conflict')).toBeNull();
  });

  it.each([
    [
      'an older version of the same number',
      loadedVersions([{ ...base, contentHash: 'b'.repeat(64) }]),
    ],
    [
      'a foreign row',
      loadedVersions([{ ...base, id: '40000000-0000-4000-8000-000000000099' }]),
    ],
    ['an empty page', loadedVersions([])],
  ])('refuses to compare with %s', async (_name, loaded) => {
    const { container } = mount({
      submit: submitStub({ kind: 'conflict', currentVersion: null }),
      readVersions: readStub(loaded),
    });
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    await click(buttonNamed(container, 'Check latest version'));
    await flush();
    expect(
      container.querySelector('.cms-taxonomy-conflict [role="alert"]')
        ?.textContent,
    ).toBe('The latest version could not be verified. Reload.');
    expect(container.querySelector('.cms-taxonomy-review')).toBeNull();
  });

  it('says so when the version the draft started from is still the latest', async () => {
    const { container } = mount({
      submit: submitStub({ kind: 'conflict', currentVersion: null }),
      readVersions: readStub(loadedVersions([base])),
    });
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    await click(buttonNamed(container, 'Check latest version'));
    await flush();
    expect(text(container)).toContain(
      'The version you started from is still the latest.',
    );
    expect(container.querySelector('button[type="button"]')).not.toBeNull();
    expect(() => buttonNamed(container, /^Keep my edits/u)).toThrow();
  });

  it.each([
    [
      { kind: 'rejected', status: 403 } as const,
      'Taxonomy curator access is required',
    ],
    [
      { kind: 'rejected', status: 404 } as const,
      'unavailable to the current acting context',
    ],
    [{ kind: 'rejected', status: 429 } as const, 'rate limiting'],
    [{ kind: 'unavailable' } as const, 'latest version is unavailable'],
  ])('shows fixed copy for a latest read answering %j', async (read, copy) => {
    const { container } = mount({
      submit: submitStub({ kind: 'conflict', currentVersion: null }),
      readVersions: readStub(read),
    });
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    await click(buttonNamed(container, 'Check latest version'));
    await flush();
    expect(
      container.querySelector('.cms-taxonomy-conflict [role="alert"]')
        ?.textContent,
    ).toContain(copy);
  });
});

describe('CmsTaxonomyVersionDesigner: an unknown outcome', () => {
  it('reads the server first and reports a commit that happened as saved, never as newer', async () => {
    const mine = versionFacts({
      id: '40000000-0000-4000-8000-000000000033',
      version: '3',
      taxonomyVersion: 3,
      state: 'draft',
    });
    const submit = submitStub({ kind: 'uncertain' });
    const { container } = mount({
      submit,
      readVersions: readStub(loadedVersions([mine, base])),
    });
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(text(container)).toContain('Vocabulary draft saved');
    expect(container.querySelector('.cms-taxonomy-conflict')).toBeNull();
    expect(buttonNamed(container, 'Save successor draft').disabled).toBe(true);
  });

  it('reports nothing saved when the latest is still the base, and reuses the key on the retry', async () => {
    const submit = submitStub(
      { kind: 'uncertain' },
      { kind: 'created', resource: createdFacts() },
    );
    const { container } = mount({
      submit,
      readVersions: readStub(loadedVersions([base])),
    });
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(document.activeElement?.textContent).toBe('Nothing was saved');
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    const keys = submit.mock.calls.map(
      (call) => (call as unknown as [unknown, string, string])[2],
    );
    expect(keys[0]).toBe(keys[1]);
  });

  it('keeps the unknown outcome and offers the comparison when the read cannot settle it', async () => {
    const { container } = mount({
      submit: submitStub({ kind: 'uncertain' }),
      readVersions: readStub(loadedVersions([newer, base])),
    });
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(document.activeElement?.textContent).toBe('The result is unknown');
    expect(text(container)).toContain(
      'Check the latest version before changing anything',
    );
    expect(text(container)).toContain('Latest saved version: 4, draft.');
  });

  it('uses a fresh key for a changed body', async () => {
    const submit = submitStub(
      { kind: 'uncertain' },
      { kind: 'created', resource: createdFacts() },
    );
    const { container } = mount({
      submit,
      readVersions: readStub({ kind: 'unavailable' }),
    });
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    await click(byLabel(container, 'Place'));
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    const keys = submit.mock.calls.map(
      (call) => (call as unknown as [unknown, string, string])[2],
    );
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('cannot read a first version back, so it only explains the same-key retry', async () => {
    const readVersions = readStub();
    const submit = submitStub({ kind: 'uncertain' });
    const { container } = mount({ latest: null, submit, readVersions });
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Vocabulary key'),
      'moods',
    );
    await click(byLabel(container, /^Flat/u));
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Content type keys'),
      'article',
    );
    await click(buttonNamed(container, 'Add content type key'));
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Field keys'),
      'topics',
    );
    await click(buttonNamed(container, 'Add field key'));
    await click(buttonNamed(container, 'Create draft'));
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(readVersions).not.toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe('The result is unknown');
    expect(container.querySelector('.cms-taxonomy-conflict')).toBeNull();
    expect(text(container)).toContain('reuses the same idempotency key');
  });
});
