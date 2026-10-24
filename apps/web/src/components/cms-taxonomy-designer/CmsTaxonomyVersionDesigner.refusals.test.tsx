// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { fillValid, mount, text } from './taxonomy-designer-form.test-support';
import { submitStub } from './taxonomy-designer.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

describe('CmsTaxonomyVersionDesigner: refusals', () => {
  it.each([
    [
      { kind: 'refused', status: 403, reason: 'capability_missing' } as const,
      'Taxonomy curator access is required',
    ],
    [
      { kind: 'rejected', status: 403 } as const,
      'Taxonomy curator access is required',
    ],
    [
      { kind: 'rejected', status: 404 } as const,
      'This vocabulary is unavailable',
    ],
    [
      { kind: 'rejected', status: 422 } as const,
      'The server rejected the vocabulary',
    ],
    [
      { kind: 'rejected', status: 503 } as const,
      'The vocabulary service is unavailable',
    ],
    [
      { kind: 'rejected', status: 429, retryAfterSeconds: 30 } as const,
      'Wait at least 30 seconds',
    ],
  ])('shows fixed copy for %j and keeps every entry', async (result, copy) => {
    const submit = submitStub(result);
    const { container } = mount({ submit });
    await fillValid(container);
    await click(buttonNamed(container, 'Create draft'));
    await flush();
    expect(text(container)).toContain(copy);
    expect(byLabel<HTMLInputElement>(container, 'Vocabulary key').value).toBe(
      'instruments',
    );
    expect(
      container.querySelectorAll('ul[aria-label="Added content type keys"] li'),
    ).toHaveLength(2);
    expect(document.activeElement?.id).toBe('cms-taxonomy-result-heading');
  });

  it('offers sign-in with a return path on 401 and holds the button during a rate-limit wait', async () => {
    const submit = submitStub(
      { kind: 'rejected', status: 401 },
      { kind: 'rejected', status: 429, retryAfterSeconds: 30 },
    );
    const { container } = mount({ submit });
    await fillValid(container);
    await click(buttonNamed(container, 'Create draft'));
    await flush();
    const signIn = container.querySelector('a[href^="/auth/sign-in"]');
    expect(signIn?.getAttribute('href')).toBe(
      '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling%2Ftaxonomies%2Fnew',
    );
    await click(buttonNamed(container, 'Create draft'));
    await flush();
    expect(buttonNamed(container, 'Create draft').matches(':disabled')).toBe(
      true,
    );
  });

  it('refuses to submit without a protected form session', () => {
    const { container } = mount({ csrfToken: '' });
    expect(text(container)).toContain(
      'Reload to restore the protected form session.',
    );
    expect(buttonNamed(container, 'Create draft').disabled).toBe(true);
  });
});
