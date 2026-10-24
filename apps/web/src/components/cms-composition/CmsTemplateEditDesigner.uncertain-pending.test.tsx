// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  TemplateDesignerContext,
  TemplateVersionDetail,
} from '@wejammin/contracts';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import CmsTemplateEditDesigner from './CmsTemplateEditDesigner';

const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const HASH = 'a'.repeat(64);
const context: TemplateDesignerContext = {
  contentTypes: [
    {
      id: TYPE_ID,
      typeKey: 'release_note',
      activeVersionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
      activeVersion: 2,
      sourceLocale: 'en-US',
    },
  ],
  registeredBlocks: [],
};
const detail: TemplateVersionDetail = {
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf132dc',
  version: '2',
  templateVersion: 2,
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T13:00:00.000Z',
  state: 'draft',
  templateId: '90000000-0000-4000-8000-000000000009',
  templateKey: 'release-note',
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: HASH,
  slots: [],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
};
const current = (value = detail): Response =>
  Response.json(value, {
    status: 200,
    headers: { etag: `"${value.version}"` },
  });
const created = (templateVersion = 3): Response => {
  const resource = {
    id: detail.id,
    version: String(templateVersion),
    templateVersion,
    contentHash: detail.contentHash,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    state: detail.state,
    templateId: detail.templateId,
    templateKey: detail.templateKey,
    compatibleTypeIds: detail.compatibleTypeIds,
    reservedRegions: detail.reservedRegions,
    blockRegistryDigest: detail.blockRegistryDigest,
  };
  return Response.json(resource, {
    status: 201,
    headers: { etag: `"${templateVersion}"` },
  });
};
const limited = (): Response =>
  Response.json(
    {
      code: 'RATE_LIMITED',
      message: 'Rate limit reached.',
      requestId: '50000000-0000-4000-8000-000000000005',
      details: { retryAfterSeconds: 5 },
    },
    { status: 429, headers: { 'retry-after': '5' } },
  );
const deferredRead = () => {
  let complete: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    complete = resolve;
  });
  return { promise, resolve: (response: Response): void => complete(response) };
};
const roots: ReturnType<typeof createRoot>[] = [];

beforeAll(async () => {
  await loadCmsValidators();
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('crypto', {
    randomUUID: vi
      .fn()
      .mockReturnValueOnce('original-attempt')
      .mockReturnValue('later-attempt'),
  });
});
afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const mount = async (fetcher: typeof fetch): Promise<HTMLDivElement> => {
  vi.stubGlobal('fetch', fetcher);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () =>
    root.render(
      <CmsTemplateEditDesigner
        context={context}
        detail={detail}
        csrfToken="csrf"
      />,
    ),
  );
  return container;
};
const audience = (container: HTMLElement): HTMLInputElement =>
  container.querySelector<HTMLInputElement>('#cms-template-audience')!;
const commit = (container: HTMLElement): HTMLButtonElement =>
  container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const editAudience = async (
  container: HTMLElement,
  value: string,
): Promise<void> => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set?.call(audience(container), value);
    audience(container).dispatchEvent(new Event('input', { bubbles: true }));
  });
};
// Deliberately bypass disabled-button activation: the form handler must enforce admission.
const nativeSubmit = async (container: HTMLElement): Promise<void> => {
  await act(async () => {
    container.querySelector('form')!.dispatchEvent(
      new Event('submit', {
        bubbles: true,
        cancelable: true,
      }),
    );
  });
};
const checkLatest = async (container: HTMLElement): Promise<void> => {
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Check latest version')!
      .click();
  });
};
const postCalls = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
const uncertain = async (read: Promise<Response>, successorVersion = 3) => {
  let sent = false;
  const fetcher = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
    if (init?.method === 'GET') return read;
    if (sent) return Promise.resolve(created(successorVersion));
    sent = true;
    return Promise.reject(new Error('response lost after send'));
  });
  const container = await mount(fetcher);
  await editAudience(container, 'original');
  await nativeSubmit(container);
  expect(container.textContent).toContain('The result is unknown.');
  expect(postCalls(fetcher)).toHaveLength(1);
  return { container, fetcher };
};

describe('CMS-11 uncertain attempt admission and pending controls', () => {
  it('B-TPL-001 disables only commit while a POST is held and preserves later editing', async () => {
    const post = deferredRead();
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(post.promise);
    const container = await mount(fetcher);
    await editAudience(container, 'original');
    await nativeSubmit(container);
    expect(postCalls(fetcher)).toHaveLength(1);
    expect(commit(container).disabled).toBe(true);
    for (const control of container.querySelectorAll(
      'input, select, textarea',
    )) {
      expect(
        control.matches(':disabled'),
        'pending must leave draft fields operable',
      ).toBe(false);
    }
    await editAudience(container, 'during-flight');
    await nativeSubmit(container);
    expect(postCalls(fetcher)).toHaveLength(1);
    expect(JSON.parse(String(postCalls(fetcher)[0]![1]?.body))).toMatchObject({
      audience: 'original',
    });
    await act(async () => post.resolve(new Response(null, { status: 200 })));
    expect(audience(container).value).toBe('during-flight');
  });

  it('B-TPL-002 exposes pending text on the held commit action', async () => {
    const post = deferredRead();
    const container = await mount(
      vi.fn<typeof fetch>().mockReturnValue(post.promise),
    );
    await nativeSubmit(container);
    expect(commit(container).disabled).toBe(true);
    expect(commit(container).textContent).toMatch(/Saving successor draft/u);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'Saving successor draft',
    );
  });

  it.each(['original', 'changed'])(
    'B-TPL-003 blocks native resubmit before reconciliation with %s values',
    async (value) => {
      const read = deferredRead();
      const { container, fetcher } = await uncertain(read.promise);
      await editAudience(container, value);
      await nativeSubmit(container);
      expect(
        postCalls(fetcher),
        'unknown original attempt still owns admission',
      ).toHaveLength(1);
      expect(
        fetcher.mock.calls.filter(([, init]) => init?.method === 'GET'),
      ).toHaveLength(0);
      expect(audience(container).value).toBe(value);
    },
  );

  it('B-TPL-004 blocks a changed native submit while the manual canonical GET is held', async () => {
    const read = deferredRead();
    const { container, fetcher } = await uncertain(read.promise);
    await editAudience(container, 'changed');
    await checkLatest(container);
    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === 'GET'),
    ).toHaveLength(1);
    await nativeSubmit(container);
    expect(
      postCalls(fetcher),
      'reading must not replace the original attempt',
    ).toHaveLength(1);
    expect(audience(container).value).toBe('changed');
  });

  it.each([
    ['unavailable', () => new Response(null, { status: 500 })],
    [
      'unverified body',
      () =>
        Response.json(
          { unknown: true },
          { status: 200, headers: { etag: '"2"' } },
        ),
    ],
    [
      'unverified identity',
      () => current({ ...detail, contentHash: 'b'.repeat(64) }),
    ],
    [
      'invalid JSON',
      () =>
        new Response('{', {
          status: 200,
          headers: { 'content-type': 'application/json', etag: '"2"' },
        }),
    ],
    ['429', limited],
  ] as const)(
    'B-TPL-005 keeps changed native submits blocked after a %s canonical GET',
    async (_name, response) => {
      const read = deferredRead();
      const { container, fetcher } = await uncertain(read.promise);
      await editAudience(container, 'changed');
      await checkLatest(container);
      await act(async () => read.resolve(response()));
      await nativeSubmit(container);
      expect(
        postCalls(fetcher),
        'a failed read cannot establish not-saved',
      ).toHaveLength(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      await nativeSubmit(container);
      expect(
        postCalls(fetcher),
        'elapsed wait cannot establish not-saved',
      ).toHaveLength(1);
      expect(audience(container).value).toBe('changed');
    },
  );

  it('B-TPL-006 reuses the original key and body after a manual verified not-saved read', async () => {
    const read = deferredRead();
    const { container, fetcher } = await uncertain(read.promise);
    const first = postCalls(fetcher)[0]![1]!;
    await editAudience(container, 'changed');
    await checkLatest(container);
    await act(async () => read.resolve(current()));
    expect(audience(container).value).toBe('changed');
    await editAudience(container, 'original');
    await nativeSubmit(container);
    const retry = postCalls(fetcher)[1]![1]!;
    expect(new Headers(first.headers).get('idempotency-key')).toBe(
      'original-attempt',
    );
    expect(new Headers(retry.headers).get('idempotency-key')).toBe(
      'original-attempt',
    );
    expect(retry.body).toBe(first.body);
    expect(new Headers(retry.headers).get('if-match')).toBe('"2"');
    expect(container.textContent).toContain('Draft version saved.');
  });

  it('B-TPL-007 keeps a verified newer parent blocked until explicit rebase', async () => {
    const read = deferredRead();
    const { container, fetcher } = await uncertain(read.promise, 4);
    await editAudience(container, 'changed');
    await checkLatest(container);
    await act(async () =>
      read.resolve(
        current({
          ...detail,
          version: '3',
          templateVersion: 3,
          audience: 'server',
        }),
      ),
    );
    expect(container.textContent).toContain('Latest version 3');
    await nativeSubmit(container);
    expect(
      postCalls(fetcher),
      'reading a newer parent is not an explicit rebase',
    ).toHaveLength(1);
    expect(audience(container).value).toBe('changed');
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) =>
          button.textContent?.startsWith('Use version 3 as parent'),
        )!
        .click();
    });
    await nativeSubmit(container);
    expect(postCalls(fetcher)).toHaveLength(2);
    const rebased = postCalls(fetcher)[1]![1]!;
    expect(new Headers(rebased.headers).get('idempotency-key')).toBe(
      'later-attempt',
    );
    expect(new Headers(rebased.headers).get('if-match')).toBe('"3"');
    expect(JSON.parse(String(rebased.body))).toMatchObject({
      expectedVersion: '3',
      audience: 'changed',
    });
  });
});
