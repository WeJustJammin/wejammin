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
 * An unknown attempt whose check later verifies it as committed: an edit made while that check runs is flagged as
 * not part of the saved draft. FE03 1046 holds the submit control off while the check reads, so a second attempt
 * cannot be sent in that window; "the snapshot is the confirmed save's, not the latest attempt's" is therefore no
 * longer distinguishable here (the earlier two-attempt scenario is unreachable) and this row proves only the flag.
 */
describe('CmsTaxonomyVersionDesigner: an edit typed while an unknown attempt is checked', () => {
  it('[P2-S12-AC-271] flags the edit made while the unknown attempt was checked as not part of the saved draft once the check verifies it', async () => {
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
    const submit = submitStub({ kind: 'uncertain' });
    const { container } = mount({ latest: base, submit, readVersions });
    // Attempt 1 is unknown and its check is still reading.
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(readVersions).toHaveBeenCalledTimes(1);
    // An edit while that check runs; FE03 1048 holds the submit control off until the read answers, so no second attempt is sent.
    await click(byLabel(container, 'Place'));
    expect(buttonNamed(container, 'Save successor draft').disabled).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    // The check now verifies attempt 1 as committed.
    verify(loadedVersions([mine, base]));
    await flush();
    expect(text(container)).toContain('Vocabulary draft saved');
    expect(text(container)).toContain('while this was saving');
    expect(text(container)).toContain('not part of the saved draft');
  });
});
