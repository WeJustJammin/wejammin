// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import {
  afterAll,
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
import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTemplateEditDesigner from './CmsTemplateEditDesigner';

/*
 * [P2-S12-AC-271] `latestReadState` of `cmsTemplateLatestRead` (FE03 "Slice 12 definition governance states"): the
 * successor designer CmsTemplateEditDesigner over its real latest check, panel and reconcile state. The read is the
 * explicit "Check latest version" offered after a 409 or an unknown outcome; the page itself is server HTML.
 */
const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const HASH = 'a'.repeat(64);
const ID = '50000000-0000-4000-8000-000000000005';
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
const newer = (): Response =>
  Response.json(
    { ...detail, version: '3', templateVersion: 3, audience: 'newer' },
    { status: 200, headers: { etag: '"3"' } },
  );
const refusal = (status: number): Response =>
  Response.json(
    { code: 'X', message: 'owner other-owner-key', requestId: ID, details: {} },
    { status },
  );

beforeAll(async () => {
  enableReactAct();
  await loadCmsValidators();
});
afterAll(disableReactAct);
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('crypto', { randomUUID: () => 'edit-attempt' });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const settle = async (ms = 0): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const setInput = (input: HTMLInputElement, value: string): void => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const button = (container: HTMLElement, name: RegExp): HTMLButtonElement =>
  Array.from(container.querySelectorAll('button')).find((entry) =>
    name.test(entry.textContent ?? ''),
  ) as HTMLButtonElement;
const check = (container: HTMLElement): HTMLButtonElement =>
  button(container, /^Check(ing)? latest version/u);
const save = (container: HTMLElement): HTMLButtonElement =>
  button(container, /^Sav(e|ing) successor draft/u);
const audience = (container: HTMLElement): HTMLInputElement =>
  container.querySelector<HTMLInputElement>('#cms-template-audience')!;
const skeleton = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('.cms-loading-region');
const alerts = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('[role="alert"]')).map(
    (entry) => entry.textContent ?? '',
  );
const submitForm = async (container: HTMLElement): Promise<void> => {
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await settle();
};
const press = async (container: HTMLElement): Promise<void> => {
  await act(async () => {
    check(container).click();
  });
  await settle();
};
const element = (csrfToken = 'csrf', types = context) => (
  <CmsTemplateEditDesigner
    context={types}
    detail={detail}
    csrfToken={csrfToken}
  />
);
/** Mounts the successor form, edits the audience and submits: the 409 offers the check. */
const mountConflicted = async (
  ...reads: Array<Response | Promise<Response>>
) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(conflict());
  for (const read of reads)
    fetcher.mockImplementationOnce(() => Promise.resolve(read));
  vi.stubGlobal('fetch', fetcher);
  const view = mountElement(element());
  setInput(audience(view.container), 'changed');
  await submitForm(view.container);
  return { ...view, fetcher };
};

describe('CmsTemplateEditDesigner (cmsTemplateLatestRead) latestReadState', () => {
  it('[P2-S12-AC-271] latestReadState idle: cmsTemplateLatestRead (CmsTemplateEditDesigner): server HTML rendered the latest version, no client read ran and the form is prefilled from it', async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    const { container } = mountElement(element());
    await settle(5_000);
    expect(fetcher).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Editing version 2.');
    expect(audience(container).value).toBe('public');
    expect(
      container.querySelector<HTMLInputElement>('#cms-template-key')?.value,
    ).toBe('release-note');
    expect(
      container.querySelector<HTMLInputElement>('#cms-template-locale')?.value,
    ).toBe('en-US');
    expect(skeleton(container)).toBeNull();
    expect(check(container)).toBeUndefined();
    expect(save(container).disabled).toBe(false);
  });

  it('[P2-S12-AC-271] latestReadState loading: cmsTemplateLatestRead (CmsTemplateEditDesigner): a skeleton after 250 ms (nothing at 249), the check and the submit controls disabled, the read no-store', async () => {
    let release: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { container, fetcher } = await mountConflicted(held);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => {
      check(container).click();
    });
    await settle(249);
    expect(skeleton(container)).toBeNull();
    expect(check(container).textContent).toBe('Checking latest version…');
    expect(check(container).disabled).toBe(true);
    expect(save(container).disabled).toBe(true);
    await settle(1);
    expect(skeleton(container)?.getAttribute('role')).toBe('status');
    expect(skeleton(container)?.textContent).toBe(
      'Checking the latest version…',
    );
    expect(save(container).disabled).toBe(true);
    await submitForm(container);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, init] = fetcher.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/v1/cms/templates/release-note');
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store' });
    await act(async () => {
      release(newer());
    });
    await settle();
    expect(skeleton(container)).toBeNull();
  });

  it('[P2-S12-AC-271] latestReadState success: cmsTemplateLatestRead (CmsTemplateEditDesigner): a 200 detail is shown beside the preserved unsent values; the form is never overwritten and rebases only on request', async () => {
    const { container, fetcher } = await mountConflicted(newer());
    expect(save(container).disabled).toBe(true);
    await press(container);
    expect(container.textContent).toContain('Latest version 3');
    expect(container.textContent).toContain('Latest canonical values');
    expect(container.querySelector('pre')?.textContent).toContain(
      '"audience": "newer"',
    );
    expect(container.textContent).toContain('Your unsent values');
    expect(container.textContent).toContain('"audience": "changed"');
    expect(audience(container).value).toBe('changed');
    expect(container.textContent).toContain('Editing version 2.');
    await act(async () => {
      button(container, /^Use version 3 as parent/u).click();
    });
    expect(container.textContent).toContain('Editing version 3.');
    expect(audience(container).value).toBe('changed');
    expect(save(container).disabled).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("[P2-S12-AC-271] latestReadState empty (not-disclosed): cmsTemplateLatestRead (CmsTemplateEditDesigner): an absent or another owner's key answers 404 and shows only the concealing copy; no-records is N/A for a single-detail read", async () => {
    const { container } = await mountConflicted(refusal(404));
    await press(container);
    expect(alerts(container)).toContain(
      'This template is unavailable to the current acting context.',
    );
    expect(container.textContent).not.toContain('other-owner-key');
    expect(container.querySelector('pre')).toBeNull();
    expect(audience(container).value).toBe('changed');
    expect(save(container).disabled).toBe(true);
  });

  it.each([
    [401, 'Your session expired. Sign in again.'],
    [403, 'Template designer access is required for this acting context.'],
    [404, 'This template is unavailable to the current acting context.'],
    [500, 'The latest version is unavailable. Wait and try again.'],
  ])(
    '[P2-S12-AC-271] latestReadState error: cmsTemplateLatestRead (CmsTemplateEditDesigner): a typed %i read renders its fixed alert copy, keeps the unsent values and keeps submit disabled',
    async (status, copy) => {
      const { container } = await mountConflicted(refusal(status));
      await press(container);
      expect(alerts(container)).toContain(copy);
      expect(container.textContent).not.toContain('other-owner-key');
      expect(audience(container).value).toBe('changed');
      expect(save(container).disabled).toBe(true);
      expect(check(container).disabled).toBe(false);
    },
  );

  it('[P2-S12-AC-271] latestReadState error: cmsTemplateLatestRead (CmsTemplateEditDesigner): a 429 with Retry-After is announced politely (not an alert) and keeps the check off for the stated wait', async () => {
    const limited = Response.json(
      {
        code: 'RATE_LIMITED',
        message: 'm',
        requestId: ID,
        details: { retryAfterSeconds: 5 },
      },
      { status: 429, headers: { 'retry-after': '5' } },
    );
    const { container } = await mountConflicted(limited);
    await press(container);
    const notice = container.querySelector('[data-cms-template-rate-limit]');
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.textContent).toBe(rateLimitMessage(5));
    expect(alerts(container).join(' ')).not.toContain('rate');
    expect(check(container).disabled).toBe(true);
    expect(save(container).disabled).toBe(true);
  });

  it('[P2-S12-AC-271] latestReadState degraded (kept half): cmsTemplateLatestRead (CmsTemplateEditDesigner): a read that fails keeps the last verified base version and the unsent values, and submit stays disabled; the earlier verified latest panel is dropped (DEFECT)', async () => {
    const { container } = await mountConflicted(newer(), refusal(503));
    await press(container);
    expect(container.textContent).toContain('Latest version 3');
    await press(container);
    expect(alerts(container)).toContain(
      'The latest version is unavailable. Wait and try again.',
    );
    expect(container.textContent).toContain('Editing version 2.');
    expect(audience(container).value).toBe('changed');
    expect(save(container).disabled).toBe(true);
  });

  it('[P2-S12-AC-271] latestReadState disabled (kept half): cmsTemplateLatestRead (CmsTemplateEditDesigner): the reason names the missing session or the missing designer capability, and submit is off; the empty content-type prerequisite names no reason (DEFECT)', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>());
    const { container } = mountElement(element(''));
    expect(container.textContent).toContain(
      'Reload to restore the protected form session.',
    );
    expect(save(container).disabled).toBe(true);
    const { container: denied } = await mountConflicted(refusal(403));
    await press(denied);
    expect(alerts(denied)).toContain(
      'Template designer access is required for this acting context.',
    );
    expect(save(denied).disabled).toBe(true);
  });
});
