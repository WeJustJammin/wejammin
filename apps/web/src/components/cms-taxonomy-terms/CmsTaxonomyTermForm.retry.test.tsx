// @vitest-environment jsdom
import './term-action-preload.test-support';
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
import CmsTaxonomyTermForm from './CmsTaxonomyTermForm';
import {
  doneResult,
  formProps,
  readTermsStub,
  readVersionsStub,
  submitStub,
  termsLoaded,
} from './term-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/** [P2-S12-AC-048] FE03 CMS-14 "reconcile unknown mutation before retry". */
describe('CmsTaxonomyTermForm: retrying after an unknown outcome', () => {
  it('reconciles the list first, then retries the same request under the same Idempotency-Key', async () => {
    const submit = submitStub({ kind: 'uncertain' }, doneResult());
    const readTerms = readTermsStub(termsLoaded());
    const { container } = mountElement(
      <CmsTaxonomyTermForm
        {...formProps({
          submit,
          readTerms,
          readVersions: readVersionsStub(),
        })}
      />,
    );
    await click(buttonNamed(container, 'Create a term'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
    await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Cello');
    await click(buttonNamed(container, 'Create term'));
    await flush();
    expect(container.querySelector('.cms-term-status h3')?.textContent).toBe(
      'The result is unknown',
    );
    // The authoritative reads ran before anything else was offered.
    expect(readTerms).toHaveBeenCalled();
    expect(submit).toHaveBeenCalledTimes(1);
    // The draft survives the unknown outcome.
    expect(byLabel<HTMLInputElement>(container, 'Term key').value).toBe(
      'cello',
    );

    await click(buttonNamed(container, 'Create term'));
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
    const [first, second] = submit.mock.calls as unknown as [
      [unknown, string, string],
      [unknown, string, string],
    ];
    expect(second[2]).toBe(first[2]);
    expect(first[2]).toMatch(/^[0-9a-f-]{36}$/u);
    expect(second[0]).toEqual(first[0]);
  });

  it('uses a fresh key once the request changed after an unknown outcome', async () => {
    const submit = submitStub({ kind: 'uncertain' }, doneResult());
    const { container } = mountElement(
      <CmsTaxonomyTermForm
        {...formProps({
          submit,
          readTerms: readTermsStub(termsLoaded()),
          readVersions: readVersionsStub(),
        })}
      />,
    );
    await click(buttonNamed(container, 'Create a term'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
    await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Cello');
    await click(buttonNamed(container, 'Create term'));
    await flush();
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'viola');
    await click(buttonNamed(container, 'Create term'));
    await flush();
    const keys = submit.mock.calls.map(
      (call) => (call as unknown as [unknown, string, string])[2],
    );
    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
  });
});
