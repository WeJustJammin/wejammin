// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CmsTemplateEditDesigner from './CmsTemplateEditDesigner';

const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const TEMPLATE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const HASH = 'a'.repeat(64);
const context = {
  contentTypes: [
    {
      id: TYPE_ID,
      typeKey: 'release_note',
      activeVersionId: VERSION_ID,
      activeVersion: 2,
      sourceLocale: 'en-US',
    },
  ],
  registeredBlocks: [],
};
const detail = {
  id: TEMPLATE_ID,
  version: '2',
  templateVersion: 2,
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T13:00:00.000Z',
  state: 'draft' as const,
  templateKey: 'release-note',
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: HASH,
  slots: [],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
};
const resource = {
  id: detail.id,
  version: detail.version,
  templateVersion: detail.templateVersion,
  contentHash: detail.contentHash,
  createdAt: detail.createdAt,
  updatedAt: detail.updatedAt,
  state: detail.state,
  templateKey: detail.templateKey,
  compatibleTypeIds: detail.compatibleTypeIds,
  reservedRegions: detail.reservedRegions,
  blockRegistryDigest: detail.blockRegistryDigest,
};

const setInput = (input: HTMLInputElement, value: string): void => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('CMS-11 successor edit and reconciliation', () => {
  it('keeps unsent values through conflict and requires an explicit latest-version rebase', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {
            code: 'TEMPLATE_VERSION_CONFLICT',
            message: 'The template version changed.',
            requestId: '50000000-0000-4000-8000-000000000005',
            details: {},
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          { ...detail, version: '3', templateVersion: 3, audience: 'newer' },
          { status: 200, headers: { etag: '"3"' } },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          { ...resource, version: '4', templateVersion: 4 },
          { status: 201, headers: { etag: '"4"' } },
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('edit-attempt-001')
        .mockReturnValueOnce('edit-attempt-002'),
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <CmsTemplateEditDesigner
          context={context}
          detail={detail}
          csrfToken="csrf-token"
        />,
      );
    });
    expect(
      container.querySelector<HTMLInputElement>('#cms-template-key')?.value,
    ).toBe('release-note');
    expect(
      container.querySelector<HTMLInputElement>('#cms-template-key')?.readOnly,
    ).toBe(true);
    await act(async () => {
      setInput(container.querySelector('#cms-template-audience')!, 'changed');
      container
        .querySelector('form')!
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
    });
    expect(container.textContent).toContain('conflict');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      new Headers(fetcher.mock.calls[0]![1]?.headers).get('if-match'),
    ).toBe('"2"');
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Check latest version')
        ?.click();
    });
    expect(container.textContent).toContain('Latest version 3');
    expect(container.textContent).toContain('newer');
    expect(
      container.querySelector<HTMLInputElement>('#cms-template-audience')
        ?.value,
    ).toBe('changed');
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) =>
          button.textContent?.includes('Use version 3 as parent'),
        )
        ?.click();
    });
    await act(async () => {
      container
        .querySelector('form')!
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(
      new Headers(fetcher.mock.calls[2]![1]?.headers).get('if-match'),
    ).toBe('"3"');
    expect(
      fetcher.mock.calls
        .filter(([, init]) => init?.method === 'POST')
        .map(([, init]) => new Headers(init?.headers).get('idempotency-key')),
    ).toEqual(['edit-attempt-001', 'edit-attempt-002']);
    expect(container.textContent).toContain('Draft version saved');
    await act(async () => {
      root.unmount();
    });
  });

  it('rotates the key after a confirmed same-version conflict reconciliation', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {
            code: 'TEMPLATE_VERSION_CONFLICT',
            message: 'The template version changed.',
            requestId: '50000000-0000-4000-8000-000000000005',
            details: {},
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(detail, { status: 200, headers: { etag: '"2"' } }),
      )
      .mockResolvedValueOnce(
        Response.json(
          { ...resource, version: '3', templateVersion: 3 },
          { status: 201, headers: { etag: '"3"' } },
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('conflict-attempt-1')
        .mockReturnValueOnce('conflict-attempt-2'),
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <CmsTemplateEditDesigner
          context={context}
          detail={detail}
          csrfToken="csrf-token"
        />,
      );
    });
    const form = container.querySelector('form')!;
    await act(async () => {
      setInput(container.querySelector('#cms-template-audience')!, 'changed');
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Check latest version')
        ?.click();
    });
    expect(container.textContent).toContain('Latest version 2');
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(false);
    await act(async () => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });
    expect(
      fetcher.mock.calls
        .filter(([, init]) => init?.method === 'POST')
        .map(([, init]) => new Headers(init?.headers).get('idempotency-key')),
    ).toEqual(['conflict-attempt-1', 'conflict-attempt-2']);
    expect(
      new Headers(fetcher.mock.calls[2]![1]?.headers).get('if-match'),
    ).toBe('"2"');
    expect(container.textContent).toContain('Draft version saved');
    await act(async () => root.unmount());
  });

  it('retains the key after an uncertain same-version reconciliation read', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce(
        Response.json(detail, { status: 200, headers: { etag: '"2"' } }),
      )
      .mockResolvedValueOnce(
        Response.json(
          { ...resource, version: '3', templateVersion: 3 },
          { status: 201, headers: { etag: '"3"' } },
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'same-attempt') });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <CmsTemplateEditDesigner
          context={context}
          detail={detail}
          csrfToken="csrf-token"
        />,
      );
    });
    const form = container.querySelector('form')!;
    await act(async () => {
      setInput(container.querySelector('#cms-template-audience')!, 'changed');
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Check latest version')
        ?.click();
    });
    await act(async () => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });
    expect(
      fetcher.mock.calls
        .filter(([, init]) => init?.method === 'POST')
        .map(([, init]) => new Headers(init?.headers).get('idempotency-key')),
    ).toEqual(['same-attempt', 'same-attempt']);
    await act(async () => root.unmount());
  });

  it('blocks a successor retry until the verified Retry-After elapses', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('crypto', { randomUUID: () => 'edit-attempt-rate' });
    try {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          Response.json(
            {
              code: 'RATE_LIMITED',
              message: 'Rate limit reached.',
              requestId: '50000000-0000-4000-8000-000000000005',
              details: { retryAfterSeconds: 2 },
            },
            { status: 429, headers: { 'retry-after': '2' } },
          ),
        )
        .mockResolvedValueOnce(
          Response.json(
            { ...resource, version: '3', templateVersion: 3 },
            { status: 201, headers: { etag: '"3"' } },
          ),
        );
      vi.stubGlobal('fetch', fetcher);
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(
          <CmsTemplateEditDesigner
            context={context}
            detail={detail}
            csrfToken="csrf-token"
          />,
        );
      });
      await act(async () => {
        setInput(container.querySelector('#cms-template-audience')!, 'members');
      });
      const form = container.querySelector('form')!;
      const submit = container.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      )!;
      await act(async () => {
        form.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      });
      expect(container.textContent).toContain('Wait at least 2 seconds');
      expect(submit.disabled).toBe(true);
      await act(async () => {
        form.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      await act(async () => {
        vi.advanceTimersByTime(2_000);
      });
      expect(submit.disabled).toBe(false);
      await act(async () => {
        form.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(container.textContent).toContain('Draft version saved.');
      await act(async () => {
        root.unmount();
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
