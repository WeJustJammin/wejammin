// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
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
import { rateLimitMessage } from '../../lib/safe-read-retry';
import CmsTemplateEditDesigner from './CmsTemplateEditDesigner';

/**
 * FE03 "Network and retry contract" (:1172): the latest-version read after a conflict answered
 * 429. The wait is announced politely, the unsent values stay in the form, and the check cannot
 * be repeated before the stated wait has elapsed.
 */
const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const HASH = 'a'.repeat(64);
const context = {
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
const detail = {
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
  version: '2',
  templateVersion: 2,
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T13:00:00.000Z',
  state: 'draft' as const,
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
const ID = '50000000-0000-4000-8000-000000000005';
const conflict = (): Response =>
  Response.json(
    {
      code: 'TEMPLATE_VERSION_CONFLICT',
      message: 'm',
      requestId: ID,
      details: {},
    },
    { status: 409 },
  );
const limited = (seconds?: number): Response =>
  Response.json(
    {
      code: 'RATE_LIMITED',
      message: 'Rate limit reached.',
      requestId: ID,
      details: seconds === undefined ? {} : { retryAfterSeconds: seconds },
    },
    {
      status: 429,
      headers: seconds === undefined ? {} : { 'retry-after': String(seconds) },
    },
  );
const current = (): Response =>
  Response.json(detail, { status: 200, headers: { etag: '"2"' } });

const setInput = (input: HTMLInputElement, value: string): void => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

beforeAll(async () => {
  await loadCmsValidators();
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('crypto', { randomUUID: () => 'edit-attempt' });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const settle = async (ms = 0): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const mountConflicted = async (...reads: Response[]) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(conflict());
  for (const read of reads) fetcher.mockResolvedValueOnce(read);
  vi.stubGlobal('fetch', fetcher);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <CmsTemplateEditDesigner
        context={context}
        detail={detail}
        csrfToken="csrf"
      />,
    );
  });
  await act(async () => {
    setInput(container.querySelector('#cms-template-audience')!, 'changed');
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await settle();
  return { container, fetcher, root };
};

const check = (container: HTMLElement): HTMLButtonElement =>
  Array.from(container.querySelectorAll('button')).find((button) =>
    /^Check(ing)? latest version/u.test(button.textContent ?? ''),
  ) as HTMLButtonElement;
const press = async (container: HTMLElement): Promise<void> => {
  await act(async () => {
    check(container).click();
  });
  await settle();
};
const alertTexts = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('[role="alert"]')).map(
    (alert) => alert.textContent ?? '',
  );
const notice = (container: HTMLElement): Element | null =>
  container.querySelector('[data-cms-template-rate-limit]');

describe('the template latest-version check after a 429', () => {
  it('announces the stated wait politely, keeps the values and re-enables the check once it elapsed', async () => {
    const { container, fetcher } = await mountConflicted(limited(5), current());
    const initialNotice = notice(container);
    expect(initialNotice).not.toBeNull();
    expect(initialNotice?.textContent).toBe('');
    expect(initialNotice?.getAttribute('role')).toBe('status');
    expect(initialNotice?.getAttribute('aria-live')).toBe('polite');
    await press(container);
    expect(notice(container)?.getAttribute('role')).toBe('status');
    expect(notice(container)?.textContent).toBe(rateLimitMessage(5));
    expect(alertTexts(container).join(' ')).not.toContain('Too many requests');
    expect(check(container).disabled).toBe(true);
    expect(
      container.querySelector<HTMLInputElement>('#cms-template-audience')
        ?.value,
    ).toBe('changed');
    await settle(1_000);
    expect(notice(container)?.textContent).toBe(rateLimitMessage(4));
    expect(check(container).disabled).toBe(true);
    await settle(3_999);
    expect(check(container).disabled).toBe(true);
    await settle(1);
    expect(check(container).disabled).toBe(false);
    expect(notice(container)?.textContent).not.toMatch(/\d+\s+seconds?/u);
    await press(container);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(notice(container)).toBe(initialNotice);
    expect(initialNotice?.textContent).toBe('');
    expect(container.textContent).toContain('Latest version 2');
  });

  it('asks for a moment, and leaves the check available, when no wait was stated', async () => {
    const { container } = await mountConflicted(limited());
    await press(container);
    expect(notice(container)?.textContent).toBe(rateLimitMessage(null));
    expect(check(container).disabled).toBe(false);
  });

  it('keeps the alert for a read refused for another reason', async () => {
    const { container } = await mountConflicted(
      Response.json({ private: 'error' }, { status: 403 }),
    );
    const initialNotice = notice(container);
    expect(initialNotice).not.toBeNull();
    expect(initialNotice?.textContent).toBe('');
    expect(initialNotice?.getAttribute('role')).toBe('status');
    expect(initialNotice?.getAttribute('aria-live')).toBe('polite');
    await press(container);
    expect(alertTexts(container)).toContain(
      'Template designer access is required for this acting context.',
    );
    expect(notice(container)).toBe(initialNotice);
    expect(initialNotice?.textContent).toBe('');
    expect(check(container).disabled).toBe(false);
  });

  it('B-RATE-OFFSET-001 clears wait copy and resources at the absolute deadline when effects start 100ms later', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(conflict())
      .mockResolvedValueOnce(limited(5));
    vi.stubGlobal('fetch', fetcher);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const addWindow = vi.spyOn(window, 'addEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const addDocument = vi.spyOn(document, 'addEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    let shifted = false;
    const onRender: React.ProfilerOnRenderCallback = () => {
      const button = check(container);
      // Profiler runs in commit, before passive timer effects. Ignore the
      // in-flight "Checking..." commit and shift only the terminal 429 commit.
      if (
        !shifted &&
        button?.textContent === 'Check latest version' &&
        button.disabled
      ) {
        shifted = true;
        vi.setSystemTime(Date.now() + 100);
      }
    };
    try {
      await act(async () =>
        root.render(
          <React.Profiler id="late-read-effects" onRender={onRender}>
            <CmsTemplateEditDesigner
              context={context}
              detail={detail}
              csrfToken="csrf"
            />
          </React.Profiler>,
        ),
      );
      await act(async () => {
        setInput(container.querySelector('#cms-template-audience')!, 'changed');
        container.querySelector('form')!.dispatchEvent(
          new Event('submit', {
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      await settle();
      expect(check(container).disabled).toBe(false);
      const initialNotice = notice(container);
      const readStartedAt = Date.now();
      await press(container);
      expect(shifted, 'terminal commit must delay passive effect startup').toBe(
        true,
      );
      expect(Date.now() - readStartedAt).toBe(100);
      expect(check(container).disabled).toBe(true);
      expect(notice(container)?.textContent).toBe(rateLimitMessage(5));
      await settle(4_899);
      expect(Date.now() - readStartedAt).toBe(4_999);
      expect(check(container).disabled).toBe(true);
      await settle(1);
      expect(Date.now() - readStartedAt).toBe(5_000);
      expect(check(container).disabled).toBe(false);
      expect(notice(container)).toBe(initialNotice);
      expect(initialNotice?.textContent).not.toMatch(/\d+\s+seconds?/u);
      expect(initialNotice?.textContent).toBe('');
      expect(
        container.querySelector<HTMLInputElement>('#cms-template-audience')
          ?.value,
      ).toBe('changed');
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(
        vi.getTimerCount(),
        'deadline must remove the phase-offset interval while mounted',
      ).toBe(0);
      const focusListeners = addWindow.mock.calls
        .filter(([event]) => String(event) === 'focus')
        .map(([, listener]) => listener);
      const visibilityListeners = addDocument.mock.calls
        .filter(([event]) => event === 'visibilitychange')
        .map(([, listener]) => listener);
      expect(focusListeners).not.toHaveLength(0);
      expect(visibilityListeners).not.toHaveLength(0);
      for (const listener of focusListeners)
        expect(removeWindow).toHaveBeenCalledWith('focus', listener);
      for (const listener of visibilityListeners)
        expect(removeDocument).toHaveBeenCalledWith(
          'visibilitychange',
          listener,
        );
    } finally {
      await act(async () => root.unmount());
      addWindow.mockRestore();
      removeWindow.mockRestore();
      addDocument.mockRestore();
      removeDocument.mockRestore();
    }
  });
});
