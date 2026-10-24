// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ModuleUnavailableError } from '../../lib/module-unavailable';
import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { fillValid, mount, text } from './taxonomy-designer-form.test-support';
import { createdFacts } from './taxonomy-designer.test-support';
import { taxonomySubmitImporters } from './use-taxonomy-designer';

/*
 * The vocabulary write loads when the person saves (P2-S11-AC-106). If its chunk cannot be fetched
 * nothing was sent: the status says so, the form keeps its values and is not left "Saving…", and
 * the next Create draft imports again.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

describe('the vocabulary write chunk fails to load', () => {
  it('reports that nothing was sent, is not left pending, and the next press sends', async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new ModuleUnavailableError('offline'))
      .mockResolvedValueOnce({ kind: 'created', resource: createdFacts() });
    const { container } = mount({ submit });
    await fillValid(container);

    await click(buttonNamed(container, 'Create draft'));
    await flush();
    expect(text(container)).toContain('nothing was sent');
    expect(text(container)).not.toContain('Saving the vocabulary draft');
    expect(buttonNamed(container, 'Create draft').disabled).toBe(false);

    await click(buttonNamed(container, 'Create draft'));
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(text(container)).not.toContain('nothing was sent');
  });

  it('the default write imports its module on demand and does not remember a failure', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(() => ({
        submitTaxonomyVersion: async () => ({ kind: 'uncertain' }),
      }));
    taxonomySubmitImporters.submit = load as never;
    const { submitOnDemand } = await import('./use-taxonomy-designer');
    await expect(submitOnDemand({} as never, 't', 'k')).rejects.toBeInstanceOf(
      ModuleUnavailableError,
    );
    await expect(submitOnDemand({} as never, 't', 'k')).resolves.toEqual({
      kind: 'uncertain',
    });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
