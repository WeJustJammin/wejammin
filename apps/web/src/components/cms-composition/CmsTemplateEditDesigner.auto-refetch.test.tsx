// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import CmsTemplateEditDesigner from './CmsTemplateEditDesigner';
import {
  buttonNamed,
  context,
  created,
  detail,
  mount,
  refusal,
  setInput,
  submit,
  unmount,
} from './cms-template-designer.test-support';

/**
 * FE03 1048 `commandState` (CMS-03C-01, successor designer) with DEC-242 item 3: a 409 "refetches" and an unknown
 * outcome "reconciles by refetching ... before any retry" BY ITSELF; the explicit "Check latest version" only
 * repeats a read that failed. The person's unsent values are never touched by the read.
 */
beforeAll(async () => {
  await loadCmsValidators();
});
afterEach(async () => {
  await unmount();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const latest = (version: string, audience = 'public') =>
  Response.json(
    { ...detail, version, templateVersion: Number(version), audience },
    { status: 200, headers: { etag: `"${version}"` } },
  );
const gets = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetcher.mock.calls.filter(([, init]) => init?.method === 'GET');
const posts = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
const audience = (container: HTMLElement): string =>
  container.querySelector<HTMLInputElement>('#cms-template-audience')!.value;
const commit = (container: HTMLElement): HTMLButtonElement =>
  container.querySelector<HTMLButtonElement>('.cms-template-successor-commit')!;
const edited = async (container: HTMLElement): Promise<void> => {
  await act(async () => {
    setInput(container.querySelector('#cms-template-audience')!, 'changed');
  });
};
const stubFetch = (
  onPost: () => Promise<Response>,
  ...reads: Array<Response | Promise<Response>>
) => {
  const queue = [...reads];
  const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
    if (init?.method === 'POST') return onPost();
    return Promise.resolve(
      queue.shift() ?? refusal(503, 'DEPENDENCY_UNAVAILABLE'),
    );
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
};
const element = (
  <CmsTemplateEditDesigner
    context={context}
    detail={detail}
    csrfToken="csrf-token"
  />
);

describe('CmsTemplateEditDesigner automatic refetch (CMS-03C-01 successor)', () => {
  it('[P2-S12-AC-271] commandState error: a 409 refetches the latest version by itself and compares it with the unsent values, which are kept', async () => {
    const fetcher = stubFetch(
      () => Promise.resolve(refusal(409, 'TEMPLATE_VERSION_CONFLICT')),
      latest('3', 'newer'),
    );
    const container = await mount(element);
    await edited(container);
    await submit(container);
    expect(gets(fetcher)).toHaveLength(1);
    expect(container.textContent).toContain('Latest version 3');
    expect(container.textContent).toContain('newer');
    expect(audience(container)).toBe('changed');
    expect(commit(container).disabled).toBe(true);
  });

  it('[P2-S12-AC-271] commandState degraded: an unknown outcome is reconciled by a read by itself, and only a verified not-saved lets the same request be retried with its key', async () => {
    let lost = false;
    const fetcher = stubFetch(() => {
      if (!lost) {
        lost = true;
        return Promise.reject(new Error('response lost after send'));
      }
      return Promise.resolve(
        Response.json(created('3'), {
          status: 201,
          headers: { etag: '"3"' },
        }),
      );
    }, latest('2'));
    const container = await mount(element);
    await edited(container);
    await submit(container);
    expect(container.textContent).toContain('The result is unknown.');
    // No press: the read ran, found the parent unchanged, and lifts the hold.
    expect(gets(fetcher)).toHaveLength(1);
    expect(commit(container).disabled).toBe(false);
    await submit(container);
    expect(posts(fetcher)).toHaveLength(2);
    const [first, second] = posts(fetcher).map(([, init]) =>
      new Headers(init?.headers).get('idempotency-key'),
    );
    expect(second).toBe(first);
    expect(container.textContent).toContain('Draft version saved');
  });

  it('[P2-S12-AC-271] commandState degraded: while the automatic read has not verified, no retry is possible, and the control repeats a failed read', async () => {
    const fetcher = stubFetch(
      () => Promise.reject(new Error('response lost after send')),
      refusal(503, 'DEPENDENCY_UNAVAILABLE'),
      latest('2'),
    );
    const container = await mount(element);
    await edited(container);
    await submit(container);
    expect(gets(fetcher)).toHaveLength(1);
    expect(container.textContent).toContain(
      'The latest version is unavailable',
    );
    expect(commit(container).disabled).toBe(true);
    await submit(container);
    expect(posts(fetcher)).toHaveLength(1);
    await act(async () => {
      buttonNamed(container, 'Check latest version').click();
    });
    expect(gets(fetcher)).toHaveLength(2);
    expect(commit(container).disabled).toBe(false);
    expect(audience(container)).toBe('changed');
  });
});
