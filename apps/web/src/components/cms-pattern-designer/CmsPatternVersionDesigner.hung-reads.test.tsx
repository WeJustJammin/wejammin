// @vitest-environment jsdom
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

import { BROWSER_READ_DEADLINE_MS } from '../../lib/read-deadline';
import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  designerContext,
  latestDetail,
  submitStub,
} from './pattern-designer.test-support';

/**
 * DEC-246(1): the pattern designer's two protected reads have the shared 8,000 ms deadline, and a read that never answers
 * ends in the island's own failed cell with the control that repeats it (FE03 "Network and retry contract": every state is
 * deterministic). The real readers run; only `fetch` is faked, and it never answers the read under test.
 */
beforeAll(async () => {
  enableReactAct();
  await import('./pattern-latest-fetch');
});
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const NEVER = (): Promise<Response> => new Promise<Response>(() => undefined);
const settle = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const reads = (
  fetcher: ReturnType<typeof vi.fn<typeof fetch>>,
  fragment: string,
) => fetcher.mock.calls.filter(([url]) => String(url).includes(fragment));
const text = (container: HTMLElement): string => container.textContent ?? '';

describe('the pattern version designer: a read that never answers', () => {
  it('[P2-S12-AC-271] commandState degraded: the latest-version read after a 409 ends at the deadline in its unavailable cell, and the control repeats it', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation((url) =>
        String(url) === '/api/v1/cms/patterns/profile-hero'
          ? NEVER()
          : Promise.resolve(Response.json({ code: 'X' }, { status: 503 })),
      );
    vi.stubGlobal('fetch', fetcher);
    const { container } = mountElement(
      <CmsPatternVersionDesigner
        context={designerContext}
        latest={latestDetail()}
        csrfToken={CSRF_TOKEN}
        submit={submitStub({ kind: 'conflict', currentVersion: '5' })}
      />,
    );
    await click(
      container.querySelector<HTMLButtonElement>('form button[type="submit"]')!,
    );
    await settle(BROWSER_READ_DEADLINE_MS - 1);
    expect(buttonNamed(container, 'Checking latest version…').disabled).toBe(
      true,
    );
    expect(reads(fetcher, '/patterns/profile-hero')).toHaveLength(1);
    await settle(1);
    expect(text(container)).toContain('The latest version is unavailable.');
    expect(buttonNamed(container, 'Check latest version').disabled).toBe(false);
    await click(buttonNamed(container, 'Check latest version'));
    expect(reads(fetcher, '/patterns/profile-hero')).toHaveLength(2);
    expect(buttonNamed(container, 'Checking latest version…').disabled).toBe(
      true,
    );
  });

  it('[P2-S12-AC-271] commandState degraded: the nestable-pattern list ends at the deadline in its failed cell, and Retry loads it again', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation((url) =>
        String(url).includes('/patterns/nestable')
          ? NEVER()
          : Promise.resolve(Response.json({ code: 'X' }, { status: 503 })),
      );
    vi.stubGlobal('fetch', fetcher);
    const { container } = mountElement(
      <CmsPatternVersionDesigner
        context={designerContext}
        latest={latestDetail()}
        csrfToken={CSRF_TOKEN}
      />,
    );
    await settle(BROWSER_READ_DEADLINE_MS - 1);
    expect(reads(fetcher, '/patterns/nestable')).toHaveLength(1);
    expect(text(container)).not.toContain('could not be loaded');
    await settle(1);
    expect(text(container)).toContain(
      'The list of patterns you can nest could not be loaded.',
    );
    await click(buttonNamed(container, 'Retry loading nestable patterns'));
    expect(reads(fetcher, '/patterns/nestable')).toHaveLength(2);
  });
});
