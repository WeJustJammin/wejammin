// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import {
  context,
  detail,
  mount,
  refusal,
  submit,
  surfaces,
  unmount,
} from './cms-template-designer.test-support';

/**
 * The closing words of the FE03 state table, for the template designers (CMS-03C-01 create and successor), P2-S12-AC-271:
 * "server-authoritative, no-store and never optimistic". Every request the island makes (the save, the read of the key
 * or of the latest version after an unknown outcome, the read of the designer context) is a same-origin `no-store`
 * request, and nothing on the page claims a result before the server has answered it.
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

const PARENT = Response.json(
  { ...detail },
  { status: 200, headers: { etag: `"${detail.version}"` } },
);
const parentRead = () => PARENT.clone();
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
const asked = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetcher.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: init?.method,
    cache: init?.cache,
    credentials: init?.credentials,
  }));

describe.each(surfaces)(
  'template $name: no-store and never optimistic',
  (surface) => {
    it('[P2-S12-AC-271] commandState closing words: the save, the read after an unknown outcome and the context read are all same-origin no-store requests', async () => {
      let post = 0;
      const fetcher = vi.fn<typeof fetch>().mockImplementation((url, init) => {
        if (init?.method === 'POST') {
          post += 1;
          return post === 1
            ? Promise.reject(new Error('response lost after send'))
            : Promise.resolve(digest409());
        }
        if (String(url) === '/api/v1/cms/templates/context')
          return Promise.resolve(Response.json(context));
        // The create designer reads the template of its key (404: nothing saved); the successor reads its parent.
        return Promise.resolve(
          surface.name === 'create designer'
            ? refusal(404, 'TEMPLATE_NOT_FOUND')
            : parentRead(),
        );
      });
      vi.stubGlobal('fetch', fetcher);
      const container = await mount(surface.render(() => undefined));
      await surface.dirty(container);
      await submit(container);
      // Verified not saved: the same request may be sent again, and the registry refuses it.
      await submit(container);
      const requests = asked(fetcher);
      expect(requests.map((request) => request.method)).toContain('POST');
      expect(requests.some((request) => request.method === 'GET')).toBe(true);
      expect(
        requests.some(
          (request) => request.url === '/api/v1/cms/templates/context',
        ),
      ).toBe(true);
      for (const request of requests) {
        expect(request.cache).toBe('no-store');
        expect(request.credentials).toBe('same-origin');
      }
    });

    it('[P2-S12-AC-271] commandState closing words: nothing on the page claims a result, navigates or clears the values before the server answers the save', async () => {
      let answer: (response: Response) => void = () => undefined;
      const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) =>
        init?.method === 'POST'
          ? new Promise<Response>((resolve) => {
              answer = resolve;
            })
          : Promise.resolve(parentRead()),
      );
      vi.stubGlobal('fetch', fetcher);
      const navigate = vi.fn();
      const container = await mount(surface.render(navigate));
      await surface.dirty(container);
      const before = surface.audience(container);
      await submit(container);
      expect(asked(fetcher).filter((r) => r.method === 'POST')).toHaveLength(1);
      // In flight: the pending sentence only; no heading of a result, no link to the saved template.
      expect(
        container.querySelector('.cms-template-designer-status h3'),
      ).toBeNull();
      expect(container.textContent).not.toMatch(
        /Draft (version saved|created)\./u,
      );
      expect(
        container.querySelector('a[href*="/templates/release-note"]'),
      ).toBeNull();
      expect(surface.audience(container)).toBe(before);
      expect(navigate).not.toHaveBeenCalled();
      await act(async () => {
        answer(surface.success());
      });
      expect(container.textContent).toMatch(/Draft (version saved|created)\./u);
    });
  },
);
