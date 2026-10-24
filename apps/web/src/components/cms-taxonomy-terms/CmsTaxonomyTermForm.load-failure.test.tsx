// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ModuleUnavailableError } from '../../lib/module-unavailable';
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
  termsLoaded,
} from './term-form.test-support';
import { termSubmitImporters } from './use-term-form';

/*
 * The term write loads when the person acts (P2-S11-AC-106). If its chunk cannot be fetched nothing
 * was sent: the status says so, the form is not left "Saving the term…", and the next press sends.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const text = (container: HTMLElement): string => container.textContent ?? '';

describe('the term write chunk fails to load', () => {
  it('reports that nothing was sent, is not left pending, and the next press sends', async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new ModuleUnavailableError('offline'))
      .mockResolvedValueOnce(doneResult({ version: '3' }));
    const { container } = mountElement(
      <CmsTaxonomyTermForm
        {...formProps({
          readTerms: readTermsStub(termsLoaded()),
          readVersions: readVersionsStub(),
          submit,
        })}
      />,
    );
    await click(buttonNamed(container, 'Rename term guitar'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Electric');

    await click(buttonNamed(container, 'Rename term'));
    await flush();
    expect(text(container)).toContain('nothing was sent');
    expect(text(container)).not.toContain('Saving the term');

    await click(buttonNamed(container, 'Rename term'));
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(text(container)).not.toContain('nothing was sent');
  });

  it('the default write imports its module on demand and does not remember a failure', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(() => ({
        submitTermAction: async () => ({ kind: 'uncertain' }),
      }));
    termSubmitImporters.submit = load as never;
    const { submitOnDemand } = await import('./use-term-form');
    await expect(submitOnDemand({} as never, 't', 'k')).rejects.toBeInstanceOf(
      ModuleUnavailableError,
    );
    await expect(submitOnDemand({} as never, 't', 'k')).resolves.toEqual({
      kind: 'uncertain',
    });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
