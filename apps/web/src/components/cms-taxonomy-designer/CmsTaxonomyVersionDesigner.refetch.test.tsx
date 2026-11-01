// @vitest-environment jsdom
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
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyVersionDesigner from './CmsTaxonomyVersionDesigner';
import { summaryOf } from './CmsTaxonomyVersionList';
import {
  CSRF_TOKEN,
  createdFacts,
  loadedVersions,
  readStub,
  submitStub,
  versionFacts,
} from './taxonomy-designer.test-support';
import { fillValid } from './taxonomy-designer-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const base = versionFacts({ version: '2', taxonomyVersion: 2 });
const newer = versionFacts({
  id: '40000000-0000-4000-8000-000000000044',
  version: '4',
  taxonomyVersion: 4,
  state: 'draft',
});
const text = (container: HTMLElement): string => container.textContent ?? '';
const rows = (container: HTMLElement): string[] =>
  Array.from(
    container.querySelectorAll('table.cms-taxonomy-versions tbody th'),
    (cell) => cell.textContent ?? '',
  );

describe('CmsTaxonomyVersionDesigner commandState error (CMS-03C-16), FE03 1048 and 1266', () => {
  it('[P2-S12-AC-271] commandState error: a 409 refetches the versions by itself and shows the newer one beside the unsent draft, which is kept', async () => {
    const submit = submitStub({ kind: 'conflict', currentVersion: '4' });
    const readVersions = readStub(loadedVersions([newer, base]));
    const { container } = mountElement(
      <CmsTaxonomyVersionDesigner
        latest={base}
        csrfToken={CSRF_TOKEN}
        submit={submit}
        readVersions={readVersions}
      />,
    );
    await click(byLabel(container, 'Place'));
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    // No press: the read ran on its own, once, and the unsent domain stays ticked.
    expect(readVersions).toHaveBeenCalledTimes(1);
    expect(text(container)).toContain('Latest saved version: 4, draft.');
    expect(text(container)).toContain('Your unsent draft: Role, Place');
    expect(byLabel<HTMLInputElement>(container, 'Place').checked).toBe(true);
  });

  it('[P2-S12-AC-271] commandState error: the save is held off while the automatic read runs and after it failed, and the read can be repeated', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const submit = submitStub({ kind: 'conflict', currentVersion: '4' });
    const readVersions = (async () => {
      await held;
      return { kind: 'unavailable' } as const;
    }) as never;
    const { container } = mountElement(
      <CmsTaxonomyVersionDesigner
        latest={base}
        csrfToken={CSRF_TOKEN}
        submit={submit}
        readVersions={readVersions}
      />,
    );
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(buttonNamed(container, 'Checking latest version…').disabled).toBe(
      true,
    );
    expect(buttonNamed(container, 'Save successor draft').disabled).toBe(true);
    release();
    await flush();
    expect(text(container)).toContain('The latest version is unavailable.');
    expect(buttonNamed(container, 'Save successor draft').disabled).toBe(true);
    expect(buttonNamed(container, 'Check latest version').disabled).toBe(false);
  });
});

describe('CmsTaxonomyVersionDesigner commandState success (CMS-03C-16), FE03 1048', () => {
  it('[P2-S12-AC-271] commandState success: a verified save refetches the versions table, which then lists the new draft', async () => {
    const created = versionFacts({
      id: '40000000-0000-4000-8000-000000000045',
      version: '3',
      taxonomyVersion: 3,
      state: 'draft',
    });
    const submit = submitStub({
      kind: 'created',
      resource: createdFacts({ taxonomyVersion: 3, version: '3' }),
    });
    const readVersions = readStub(loadedVersions([created, base]));
    const { container } = mountElement(
      <CmsTaxonomyVersionDesigner
        latest={base}
        versions={[summaryOf(base)]}
        csrfToken={CSRF_TOKEN}
        submit={submit}
        readVersions={readVersions}
      />,
    );
    expect(rows(container)).toEqual(['2']);
    await click(byLabel(container, 'Place'));
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(text(container)).toContain('Vocabulary draft saved');
    expect(readVersions).toHaveBeenCalledTimes(1);
    expect(readVersions).toHaveBeenCalledWith(base.taxonomyId);
    expect(rows(container)).toEqual(['3', '2']);
  });

  it('[P2-S12-AC-271] commandState success: a new vocabulary has no table until the save, then lists its first version', async () => {
    const first = versionFacts({
      version: '1',
      taxonomyVersion: 1,
      state: 'draft',
    });
    const submit = submitStub({
      kind: 'created',
      resource: createdFacts({ taxonomyVersion: 1, version: '1' }),
    });
    const readVersions = readStub(loadedVersions([first]));
    const { container } = mountElement(
      <CmsTaxonomyVersionDesigner
        latest={null}
        csrfToken={CSRF_TOKEN}
        submit={submit}
        readVersions={readVersions}
      />,
    );
    await fillValid(container);
    await click(buttonNamed(container, 'Create draft'));
    await flush();
    expect(readVersions).toHaveBeenCalledWith(createdFacts().taxonomyId);
    expect(rows(container)).toEqual(['1']);
  });

  it('[P2-S12-AC-271] commandState success: a refetch that fails keeps the table it had and says it could not be refreshed', async () => {
    const submit = submitStub({
      kind: 'created',
      resource: createdFacts({ taxonomyVersion: 3, version: '3' }),
    });
    const readVersions = readStub({ kind: 'unavailable' });
    const { container } = mountElement(
      <CmsTaxonomyVersionDesigner
        latest={base}
        versions={[summaryOf(base)]}
        csrfToken={CSRF_TOKEN}
        submit={submit}
        readVersions={readVersions}
      />,
    );
    await click(byLabel(container, 'Place'));
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(text(container)).toContain('Vocabulary draft saved');
    expect(rows(container)).toEqual(['2']);
    expect(text(container)).toContain(
      'The version list could not be refreshed. Reload to see the new version.',
    );
  });
});
