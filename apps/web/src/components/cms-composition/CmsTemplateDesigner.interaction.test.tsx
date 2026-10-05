// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CmsTemplateDesigner from './CmsTemplateDesigner';

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

const setInput = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('CMS-11 template designer interaction', () => {
  it('keeps the draft values and idempotency key across an uncertain retry', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce(
        Response.json(
          {
            id: TEMPLATE_ID,
            version: '1',
            contentHash: HASH,
            createdAt: '2026-09-27T12:00:00.000Z',
            updatedAt: '2026-09-27T12:00:00.000Z',
            state: 'draft',
            templateKey: 'release-note',
            templateVersion: 1,
            compatibleTypeIds: [TYPE_ID],
            reservedRegions: [
              'header',
              'now',
              'record',
              'detail',
              'provenance',
            ],
            blockRegistryDigest: HASH,
          },
          { status: 201, headers: { etag: '"1"' } },
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('crypto', { randomUUID: () => 'draft-attempt-001' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <CmsTemplateDesigner context={context} csrfToken="csrf-token" />,
      );
    });
    await act(async () => {
      setInput(container.querySelector('#cms-template-key')!, 'release-note');
      setInput(container.querySelector('#cms-template-audience')!, 'public');
      container
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .click();
    });
    const form = container.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });
    expect(container.textContent).toContain('The result is unknown');
    expect(
      container.querySelector<HTMLInputElement>('#cms-template-key')?.value,
    ).toBe('release-note');
    await act(async () => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const keys = fetcher.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get('idempotency-key'),
    );
    expect(keys).toEqual(['draft-attempt-001', 'draft-attempt-001']);
    expect(container.textContent).toContain(`Template ID ${TEMPLATE_ID}`);
    root.unmount();
  });

  it('keeps a rate-limited draft disabled until the verified Retry-After elapses', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('crypto', { randomUUID: () => 'draft-attempt-rate' });
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
            {
              id: TEMPLATE_ID,
              version: '1',
              contentHash: HASH,
              createdAt: '2026-09-27T12:00:00.000Z',
              updatedAt: '2026-09-27T12:00:00.000Z',
              state: 'draft',
              templateKey: 'release-note',
              templateVersion: 1,
              compatibleTypeIds: [TYPE_ID],
              reservedRegions: [
                'header',
                'now',
                'record',
                'detail',
                'provenance',
              ],
              blockRegistryDigest: HASH,
            },
            { status: 201, headers: { etag: '"1"' } },
          ),
        );
      vi.stubGlobal('fetch', fetcher);
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(
          <CmsTemplateDesigner context={context} csrfToken="csrf-token" />,
        );
      });
      await act(async () => {
        setInput(container.querySelector('#cms-template-key')!, 'release-note');
        setInput(container.querySelector('#cms-template-audience')!, 'public');
        container
          .querySelector<HTMLInputElement>('input[type="checkbox"]')!
          .click();
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
        vi.advanceTimersByTime(1_999);
      });
      expect(submit.disabled).toBe(true);
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(submit.disabled).toBe(false);
      await act(async () => {
        form.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(container.textContent).toContain('Draft created.');
      await act(async () => {
        root.unmount();
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
