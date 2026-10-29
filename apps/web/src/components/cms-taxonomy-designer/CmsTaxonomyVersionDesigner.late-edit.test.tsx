// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { fillValid, mount, text } from './taxonomy-designer-form.test-support';
import {
  createdFacts,
  loadedVersions,
  submitStub,
  versionFacts,
} from './taxonomy-designer.test-support';
import type { TaxonomyVersionsResult } from './taxonomy-versions-read';
import type { TaxonomySubmitResult } from './taxonomy-designer-submit';

beforeAll(enableReactAct);
// The unknown-outcome check loads after an uncertain write; load it first so no step races its first load.
beforeAll(async () => {
  await import('./taxonomy-outcome-reconcile');
});
afterAll(disableReactAct);

const heldSubmit = () => {
  let answer: (result: TaxonomySubmitResult) => void = () => undefined;
  const submit = vi.fn(
    () =>
      new Promise<TaxonomySubmitResult>((resolve) => {
        answer = resolve;
      }),
  );
  return { submit, answer: (result: TaxonomySubmitResult) => answer(result) };
};

/**
 * [P2-S12-AC-271] FE03 1048 keeps the vocabulary fields editable while the CMS-03C-16 save is pending, so a
 * value typed meanwhile is neither sent nor saved: the success banner must not present it as part of the
 * saved draft, and the value stays in the form.
 */
describe('CmsTaxonomyVersionDesigner: an edit typed while the save is pending', () => {
  it('[P2-S12-AC-271] is kept and flagged as not part of the saved draft after the verified success', async () => {
    const held = heldSubmit();
    const { container } = mount({ submit: held.submit });
    await fillValid(container);
    await click(buttonNamed(container, 'Create draft'));
    const key = byLabel<HTMLInputElement>(container, 'Vocabulary key');
    await typeInto(key, 'late-vocabulary-key');
    held.answer({ kind: 'created', resource: createdFacts() });
    await flush();
    expect(text(container)).toContain('Vocabulary draft saved');
    expect(text(container)).toContain('while this was saving');
    expect(text(container)).toContain('not part of the saved draft');
    expect(key.value).toBe('late-vocabulary-key');
  });

  it('[P2-S12-AC-271] carries no late-edit notice when nothing was typed during the save', async () => {
    const held = heldSubmit();
    const { container } = mount({ submit: held.submit });
    await fillValid(container);
    await click(buttonNamed(container, 'Create draft'));
    held.answer({ kind: 'created', resource: createdFacts() });
    await flush();
    expect(text(container)).toContain('Vocabulary draft saved');
    expect(text(container)).not.toContain('while this was saving');
  });
});

/**
 * The snapshot is the CONFIRMED save's, not the latest attempt's: an earlier unknown attempt can be verified
 * as committed while a later, edited attempt (refused here) was the last one sent.
 */
describe('CmsTaxonomyVersionDesigner: a verified earlier attempt beside a later edited one', () => {
  it('[P2-S12-AC-271] flags the edit made after the verified attempt as not part of the saved draft', async () => {
    const base = versionFacts({
      version: '2',
      taxonomyVersion: 2,
      state: 'active',
    });
    const mine = versionFacts({
      id: '40000000-0000-4000-8000-000000000033',
      version: '3',
      taxonomyVersion: 3,
      state: 'draft',
    });
    let verify: (result: TaxonomyVersionsResult) => void = () => undefined;
    const readVersions = vi.fn(
      () =>
        new Promise<TaxonomyVersionsResult>((resolve) => {
          verify = resolve;
        }),
    );
    const submit = submitStub(
      { kind: 'uncertain' },
      { kind: 'rejected', status: 503 },
    );
    const { container } = mount({ latest: base, submit, readVersions });
    // Attempt 1 is unknown and its check is still reading.
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(readVersions).toHaveBeenCalledTimes(1);
    // An edit, then attempt 2 (refused) while that check runs.
    await click(byLabel(container, 'Place'));
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
    // The check now verifies attempt 1 as committed.
    verify(loadedVersions([mine, base]));
    await flush();
    expect(text(container)).toContain('Vocabulary draft saved');
    expect(text(container)).toContain('while this was saving');
    expect(text(container)).toContain('not part of the saved draft');
  });
});
