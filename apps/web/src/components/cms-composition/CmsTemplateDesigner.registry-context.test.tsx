// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import CmsTemplateDesigner from './CmsTemplateDesigner';
import CmsTemplateEditDesigner from './CmsTemplateEditDesigner';
import {
  buttonNamed,
  context,
  detail,
  mount,
  refusal,
  setInput,
  submit,
  unmount,
} from './cms-template-designer.test-support';

/**
 * FE03 1048 `commandState` error, 409 `block_registry_digest_mismatch` (CMS-03C-01; review V19 M2): the island reads
 * the designer context again by itself (`cmsTemplateContextRead`, `GET /api/v1/cms/templates/context`), keeps the
 * person's unsent values, replaces the block choices and states which block selectors changed.
 */
beforeAll(async () => {
  await import('./cms-registry-read');
  await loadCmsValidators();
});
afterEach(async () => {
  await unmount();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const OLD = [
  { blockKey: 'profile.header', blockVersion: 1 },
  { blockKey: 'profile.text', blockVersion: 2 },
];
const NEW = [
  { blockKey: 'profile.header', blockVersion: 1 },
  { blockKey: 'profile.text', blockVersion: 3 },
];
const startContext = { ...context, registeredBlocks: OLD };
const digest409 = () =>
  Response.json(
    {
      code: 'TEMPLATE_VERSION_CONFLICT',
      message: 'refused',
      requestId: '50000000-0000-4000-8000-000000000005',
      details: { reasonCode: 'block_registry_digest_mismatch' },
    },
    { status: 409 },
  );
const contextBody = (blocks = NEW) =>
  Response.json(
    { ...context, registeredBlocks: blocks },
    { status: 200, headers: { 'cache-control': 'no-store' } },
  );
const parent = () =>
  Response.json(
    { ...detail },
    { status: 200, headers: { etag: `"${detail.version}"` } },
  );
const stub = (...reads: Array<Response | Promise<Response>>) => {
  const queue = [...reads];
  const fetcher = vi.fn<typeof fetch>().mockImplementation((url, init) => {
    if (init?.method === 'POST') return Promise.resolve(digest409());
    if (String(url) === '/api/v1/cms/templates/context')
      return Promise.resolve(
        queue.shift() ?? refusal(503, 'DEPENDENCY_UNAVAILABLE'),
      );
    // The successor's own read of its parent verifies (V20 m2): a failed parent read would keep the send off by
    // itself and hide whether the registry hold does.
    return Promise.resolve(parent());
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
};
const contextReads = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetcher.mock.calls.filter(
    ([url]) => String(url) === '/api/v1/cms/templates/context',
  );
const commit = (container: HTMLElement): HTMLButtonElement =>
  container.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
const audience = (container: HTMLElement): string =>
  container.querySelector<HTMLInputElement>('#cms-template-audience')!.value;

const SURFACES = [
  {
    name: 'create designer',
    element: <CmsTemplateDesigner context={startContext} csrfToken="csrf" />,
    prepare: async (container: HTMLElement) => {
      await act(async () => {
        setInput(container.querySelector('#cms-template-key')!, 'release-note');
        setInput(container.querySelector('#cms-template-audience')!, 'public');
        container
          .querySelector<HTMLInputElement>('input[type="checkbox"]')!
          .click();
      });
    },
    expected: 'public',
  },
  {
    name: 'successor designer',
    element: (
      <CmsTemplateEditDesigner
        context={startContext}
        detail={detail}
        csrfToken="csrf"
      />
    ),
    prepare: async (container: HTMLElement) => {
      await act(async () => {
        setInput(container.querySelector('#cms-template-audience')!, 'changed');
      });
    },
    expected: 'changed',
  },
];

describe.each(SURFACES)(
  'template $name: 409 block_registry_digest_mismatch',
  (surface) => {
    it('[P2-S12-AC-271] commandState error: reads the designer context by itself, keeps the unsent values, replaces the block choices and names the selectors that changed', async () => {
      const fetcher = stub(contextBody());
      const container = await mount(surface.element);
      await surface.prepare(container);
      expect(container.textContent).toContain(
        'profile.header@1, profile.text@2.',
      );
      await submit(container);
      expect(contextReads(fetcher)).toHaveLength(1);
      expect(contextReads(fetcher)[0]![1]).toMatchObject({
        method: 'GET',
        cache: 'no-store',
      });
      expect(container.textContent).toContain(
        'profile.header@1, profile.text@3.',
      );
      expect(container.textContent).toContain('Added: profile.text@3');
      expect(container.textContent).toContain('Removed: profile.text@2');
      expect(audience(container)).toBe(surface.expected);
    });

    it('[P2-S12-AC-271] commandState error: an unchanged registry is said to be unchanged', async () => {
      const fetcher = stub(contextBody(OLD));
      const container = await mount(surface.element);
      await surface.prepare(container);
      await submit(container);
      expect(contextReads(fetcher)).toHaveLength(1);
      expect(container.textContent).toContain(
        'The block choices are unchanged.',
      );
      expect(container.textContent).not.toContain('Added:');
      expect(audience(container)).toBe(surface.expected);
    });

    it('[P2-S12-AC-271] commandState error: while the read runs or after it failed no new send is possible, and the control repeats the read', async () => {
      let release: (response: Response) => void = () => undefined;
      const held = new Promise<Response>((resolve) => {
        release = resolve;
      });
      const fetcher = stub(held, contextBody());
      const container = await mount(surface.element);
      await surface.prepare(container);
      await submit(container);
      expect(commit(container).disabled).toBe(true);
      await submit(container);
      expect(
        fetcher.mock.calls.filter(([, init]) => init?.method === 'POST'),
      ).toHaveLength(1);
      await act(async () => {
        release(refusal(503, 'DEPENDENCY_UNAVAILABLE'));
      });
      expect(container.textContent).toContain(
        'The block choices could not be read.',
      );
      expect(commit(container).disabled).toBe(true);
      await act(async () => {
        buttonNamed(container, 'Read the block choices again').click();
      });
      expect(contextReads(fetcher)).toHaveLength(2);
      expect(container.textContent).toContain('Added: profile.text@3');
      expect(audience(container)).toBe(surface.expected);
    });
  },
);
