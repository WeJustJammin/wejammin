// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ModuleUnavailableError } from '../../lib/module-unavailable';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { mount, savedResult, text } from './locale-variant-form.test-support';
import { localeSubmitImporters } from './use-locale-variant-form';

/*
 * The translation save loads when the person saves (P2-S11-AC-106). If its chunk cannot be fetched
 * nothing was sent: the status says so, the form is not left "Saving translation…", the person's
 * text is kept, and the next press sends.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

describe('the translation save chunk fails to load', () => {
  it('reports that nothing was sent, is not left pending, and the next press sends', async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new ModuleUnavailableError('offline'))
      .mockResolvedValueOnce(savedResult());
    const { container } = mount({ submit });
    await typeInto(byLabel(container, 'Title'), 'Un titre');

    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(text(container)).toContain('nothing was sent');
    expect(text(container)).not.toContain('Saving translation');
    expect((byLabel(container, 'Title') as HTMLInputElement).value).toBe(
      'Un titre',
    );

    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(text(container)).not.toContain('nothing was sent');
  });

  it('the default save imports its module on demand and does not remember a failure', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(() => ({
        submitLocaleVariant: async () => ({ kind: 'uncertain' }),
      }));
    localeSubmitImporters.submit = load as never;
    const { submitOnDemand } = await import('./use-locale-variant-form');
    await expect(submitOnDemand({} as never, 't', 'k')).rejects.toBeInstanceOf(
      ModuleUnavailableError,
    );
    await expect(submitOnDemand({} as never, 't', 'k')).resolves.toEqual({
      kind: 'uncertain',
    });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
