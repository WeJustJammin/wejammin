// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import CmsTemplateDesigner from './CmsTemplateDesigner';
import {
  context,
  mount,
  refusal,
  submit,
  surfaces,
  unmount,
} from './cms-template-designer.test-support';

/**
 * Review V19 m1: React.StrictMode remounts every effect in development. The create designer's read of the key must
 * still land (a dropped answer left "Checking latest version…" for good and the commit control disabled).
 */
beforeAll(async () => {
  await loadCmsValidators();
});
afterEach(async () => {
  await unmount();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('CmsTemplateDesigner under React.StrictMode (CMS-03C-01 create)', () => {
  it('settles an unknown outcome on the read of the key: nothing saved, the commit control enabled again', async () => {
    let lost = false;
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
      if (init?.method === 'GET')
        return Promise.resolve(refusal(404, 'TEMPLATE_NOT_FOUND'));
      if (!lost) {
        lost = true;
        return Promise.reject(new Error('response lost after send'));
      }
      return Promise.resolve(surfaces[0]!.success());
    });
    vi.stubGlobal('fetch', fetcher);
    const container = await mount(
      <React.StrictMode>
        <CmsTemplateDesigner context={context} csrfToken="csrf-token" />
      </React.StrictMode>,
    );
    await surfaces[0]!.dirty(container);
    await submit(container);
    expect(container.textContent).toContain('nothing was saved');
    expect(container.textContent).not.toContain('Checking latest version…');
    expect(
      container.querySelector<HTMLButtonElement>('form button[type="submit"]')!
        .disabled,
    ).toBe(false);
  });
});
