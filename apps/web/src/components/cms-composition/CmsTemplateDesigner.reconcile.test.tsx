// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import CmsTemplateDesigner from './CmsTemplateDesigner';
import {
  buttonNamed,
  context,
  detail,
  mount,
  refusal,
  submit,
  unmount,
} from './cms-template-designer.test-support';
import { surfaces } from './cms-template-designer.test-support';

/**
 * FE03 1048 `commandState` (CMS-03C-01, create designer) with DEC-242 item 3: a 409 "refetches" and an unknown
 * outcome "reconciles by refetching ... before any retry", by itself. A create has no parent version, so the read is
 * the template read of the KEY the attempt used (`cmsTemplateLatestRead`): 404 is nothing saved, version 1 of the
 * attempted definition is a committed create, anything else is an existing template that is shown, never guessed.
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

const createSurface = surfaces[0]!;
const first = (overrides: Record<string, unknown> = {}) =>
  Response.json(
    { ...detail, version: '1', templateVersion: 1, ...overrides },
    { status: 200, headers: { etag: '"1"' } },
  );
const lostThenCreated = () => {
  let lost = false;
  return () => {
    if (!lost) {
      lost = true;
      return Promise.reject(new Error('response lost after send'));
    }
    return Promise.resolve(createSurface.success());
  };
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
const gets = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetcher.mock.calls.filter(([, init]) => init?.method === 'GET');
const posts = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
const commit = (container: HTMLElement): HTMLButtonElement =>
  container.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
const element = (
  <CmsTemplateDesigner context={context} csrfToken="csrf-token" />
);
const unsent = async (container: HTMLElement): Promise<void> => {
  await createSurface.dirty(container);
};

describe('CmsTemplateDesigner automatic refetch (CMS-03C-01 create)', () => {
  it('[P2-S12-AC-271] commandState error: a 409 reads the key by itself and shows the existing template beside the unsent values, which are kept', async () => {
    const fetcher = stubFetch(
      () => Promise.resolve(refusal(409, 'TEMPLATE_VERSION_CONFLICT')),
      first({ audience: 'members' }),
    );
    const container = await mount(element);
    await unsent(container);
    await submit(container);
    expect(gets(fetcher)).toHaveLength(1);
    expect(gets(fetcher)[0]![0]).toBe('/api/v1/cms/templates/release-note');
    expect(container.textContent).toContain('Latest version 1');
    expect(container.textContent).toContain('"audience": "members"');
    expect(container.textContent).toContain('Your unsent values');
    expect(
      container.querySelector(
        'a[href="/app/cms-content-modeling/templates/release-note"]',
      )?.textContent,
    ).toContain('Open');
    expect(createSurface.audience(container)).toBe('public');
  });

  it('[P2-S12-AC-271] commandState error: the closed registry-digest 409 reads the designer context, not a template (there is none to compare), and keeps its fixed copy', async () => {
    const fetcher = stubFetch(() =>
      Promise.resolve(
        Response.json(
          {
            code: 'TEMPLATE_VERSION_CONFLICT',
            message: 'refused',
            requestId: '50000000-0000-4000-8000-000000000005',
            details: { reasonCode: 'block_registry_digest_mismatch' },
          },
          { status: 409 },
        ),
      ),
    );
    const container = await mount(element);
    await unsent(container);
    await submit(container);
    const urls = gets(fetcher).map(([url]) => String(url));
    expect(urls).toEqual(['/api/v1/cms/templates/context']);
    expect(container.textContent).toContain('block registry');
  });

  it('[P2-S12-AC-271] commandState degraded: an unknown outcome is read by itself, and a 404 for the key lets the same request be replayed with its key', async () => {
    const fetcher = stubFetch(
      lostThenCreated(),
      refusal(404, 'TEMPLATE_NOT_FOUND'),
    );
    const container = await mount(element);
    await unsent(container);
    await submit(container);
    expect(container.textContent).toContain('The result is unknown.');
    expect(gets(fetcher)).toHaveLength(1);
    expect(container.textContent).toContain('nothing was saved');
    expect(commit(container).disabled).toBe(false);
    await submit(container);
    expect(posts(fetcher)).toHaveLength(2);
    const [one, two] = posts(fetcher).map(([, init]) =>
      new Headers(init?.headers).get('idempotency-key'),
    );
    expect(two).toBe(one);
    expect(container.textContent).toContain('Draft created.');
  });

  it('[P2-S12-AC-271] commandState degraded: version 1 of the attempted definition is a committed create and is announced as created without a second write', async () => {
    const fetcher = stubFetch(() => Promise.reject(new Error('lost')), first());
    const container = await mount(element);
    await unsent(container);
    await submit(container);
    expect(gets(fetcher)).toHaveLength(1);
    expect(container.textContent).toContain('Draft created.');
    expect(posts(fetcher)).toHaveLength(1);
  });

  it('[P2-S12-AC-271] commandState degraded: another definition under the key is shown, never claimed as the attempt, and the success is not announced', async () => {
    const fetcher = stubFetch(
      () => Promise.reject(new Error('lost')),
      first({ audience: 'members' }),
    );
    const container = await mount(element);
    await unsent(container);
    await submit(container);
    expect(gets(fetcher)).toHaveLength(1);
    expect(container.textContent).toContain('Latest version 1');
    expect(container.textContent).not.toContain('Draft created.');
    expect(container.textContent).toContain('The result is unknown.');
  });

  it('[P2-S12-AC-271] commandState degraded: until a read verifies, no retry is possible, and the control repeats a failed read', async () => {
    const fetcher = stubFetch(
      lostThenCreated(),
      refusal(503, 'DEPENDENCY_UNAVAILABLE'),
      refusal(404, 'TEMPLATE_NOT_FOUND'),
    );
    const container = await mount(element);
    await unsent(container);
    await submit(container);
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
    expect(createSurface.audience(container)).toBe('public');
  });

  it('an incomplete draft sends nothing and the read of the key never starts', async () => {
    const fetcher = stubFetch(() => Promise.resolve(createSurface.success()));
    const container = await mount(element);
    await submit(container);
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      container.querySelector('.cms-template-designer-status')?.textContent,
    ).not.toBe('');
  });

  it('[P2-S12-AC-271] commandState degraded: a 429 on the read of the key is announced politely with its stated wait and holds the retry', async () => {
    const limited = (seconds?: number) =>
      Response.json(
        {
          code: 'RATE_LIMITED',
          message: 'refused',
          requestId: '50000000-0000-4000-8000-000000000005',
          details: seconds === undefined ? {} : { retryAfterSeconds: seconds },
        },
        {
          status: 429,
          headers:
            seconds === undefined ? {} : { 'retry-after': String(seconds) },
        },
      );
    const fetcher = stubFetch(lostThenCreated(), limited(5));
    const container = await mount(element);
    await unsent(container);
    await submit(container);
    expect(gets(fetcher)).toHaveLength(1);
    const notice = container.querySelector('[data-cms-template-rate-limit]');
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.textContent).toContain('5 seconds');
    expect(
      (buttonNamed(container, 'Check latest version') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(commit(container).disabled).toBe(true);
    await submit(container);
    expect(posts(fetcher)).toHaveLength(1);
  });

  it('[P2-S12-AC-271] commandState degraded: a 429 without a stated wait asks for a moment and leaves the read available', async () => {
    const fetcher = stubFetch(
      lostThenCreated(),
      Response.json(
        {
          code: 'RATE_LIMITED',
          message: 'refused',
          requestId: '50000000-0000-4000-8000-000000000005',
          details: {},
        },
        { status: 429 },
      ),
    );
    const container = await mount(element);
    await unsent(container);
    await submit(container);
    expect(gets(fetcher)).toHaveLength(1);
    expect(
      container.querySelector('[data-cms-template-rate-limit]')?.textContent,
    ).not.toBe('');
    expect(
      (buttonNamed(container, 'Check latest version') as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it.each([
    [401, 'TEMPLATE_UNAUTHENTICATED', 'Your session expired. Sign in again.'],
    [
      404,
      'TEMPLATE_NOT_FOUND',
      'This template is unavailable to the current acting context.',
    ],
    [
      403,
      'TEMPLATE_FORBIDDEN',
      'Template designer access is required for this acting context.',
    ],
  ])(
    '[P2-S12-AC-271] commandState error: a 409 whose read answers %i renders its fixed alert copy and keeps the values',
    async (status, code, copy) => {
      stubFetch(
        () => Promise.resolve(refusal(409, 'TEMPLATE_VERSION_CONFLICT')),
        refusal(status, code),
      );
      const container = await mount(element);
      await unsent(container);
      await submit(container);
      expect(container.textContent).toContain(copy);
      expect(createSurface.audience(container)).toBe('public');
      expect(commit(container).disabled).toBe(false);
    },
  );

  it('[P2-S12-AC-271] commandState error: after a failed read of the key after a 409 the control repeats it and the existing template appears', async () => {
    const fetcher = stubFetch(
      () => Promise.resolve(refusal(409, 'TEMPLATE_VERSION_CONFLICT')),
      refusal(503, 'DEPENDENCY_UNAVAILABLE'),
      first({ audience: 'members' }),
    );
    const container = await mount(element);
    await unsent(container);
    await submit(container);
    expect(container.textContent).toContain(
      'The latest version is unavailable',
    );
    await act(async () => {
      buttonNamed(container, 'Check latest version').click();
    });
    expect(gets(fetcher)).toHaveLength(2);
    expect(container.textContent).toContain('Latest version 1');
  });

  it('[P2-S12-AC-271] commandState degraded: an answer that arrives after the island was left changes nothing and announces nothing', async () => {
    let release: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetcher = stubFetch(() => Promise.reject(new Error('lost')), held);
    const container = await mount(element);
    await unsent(container);
    await submit(container);
    expect(gets(fetcher)).toHaveLength(1);
    await unmount();
    await act(async () => {
      release(first());
    });
    expect(container.textContent).not.toContain('Draft created.');
  });

  it('a read of the key that a later send superseded changes nothing when it finally answers (review V19 m5)', async () => {
    let release: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      release = resolve;
    });
    let posts = 0;
    const fetcher = stubFetch(() => {
      posts += 1;
      return Promise.resolve(
        posts === 1
          ? refusal(409, 'TEMPLATE_VERSION_CONFLICT')
          : createSurface.success(),
      );
    }, held);
    const container = await mount(element);
    await unsent(container);
    await submit(container);
    expect(gets(fetcher)).toHaveLength(1);
    // A plain 409 does not hold the form, so the person sends again while the first read is still out.
    await submit(container);
    expect(container.textContent).toContain('Draft created.');
    await act(async () => {
      release(first({ audience: 'members' }));
    });
    expect(container.textContent).toContain('Draft created.');
    expect(container.textContent).not.toContain('Latest version 1');
  });
});
