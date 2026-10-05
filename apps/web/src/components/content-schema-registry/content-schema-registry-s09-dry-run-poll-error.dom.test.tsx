// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  JOB_ID,
  draftDetail,
} from './content-schema-review-dec108.test-support';
import {
  WorkbenchUnderTest,
  regionNamed,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';
import { queuedDryRunPreparation } from './content-schema-registry-activation-preparation.test-support';

/**
 * FE03 dry-run `error` row: a failed job poll is a retryable error. The job
 * read failing never invents a result; the panel says the status could not be
 * read and offers Retry only for a retryable failure.
 */

const errorResponse = (status: number, code: string): Response =>
  new Response(
    JSON.stringify({
      code,
      details: {},
      message: 'Refused.',
      requestId: '6a3173d9-f113-4aa4-91c3-3fbc137ea258',
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );

const runningResponse = (): Response =>
  new Response(
    JSON.stringify({
      id: JOB_ID,
      type: 'cms.schema_dry_run',
      state: 'running',
      progress: null,
      resultRef: null,
      error: null,
      createdAt: '2026-10-02T12:00:00.000Z',
      updatedAt: '2026-10-02T12:00:01.000Z',
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json', etag: '"2"' },
    },
  );

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const mount = (): void => {
  container = document.createElement('div');
  (document.body as unknown as HTMLElement).appendChild(container);
  root = createRoot(container);
  const props = versionPageProps({
    initialDetail: successDetail(draftDetail(queuedDryRunPreparation)),
  });
  act(() => root?.render(React.createElement(WorkbenchUnderTest, props)));
};

const panel = (): HTMLElement | null =>
  regionNamed(document, /activation preparation/iu);

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
});

describe('[P2-S09-AC-965] a failed dry-run job poll is a retryable error', () => {
  it('[P2-S09-AC-965] shows the status could not be read and retries the poll on demand', async () => {
    let healthy = false;
    const fetcher = vi.fn(async () =>
      healthy
        ? runningResponse()
        : errorResponse(503, 'DEPENDENCY_UNAVAILABLE'),
    );
    vi.stubGlobal('fetch', fetcher);
    mount();
    await vi.waitFor(
      () =>
        expect(
          panel()?.querySelector('[data-dry-run-poll-error]'),
        ).not.toBeNull(),
      { timeout: 6_000 },
    );
    const error = panel()?.querySelector('[data-dry-run-poll-error]');
    expect(error?.textContent).toMatch(/status could not be read/iu);
    expect(panel()?.textContent).not.toMatch(/passed/iu);
    const retry = error?.querySelector<HTMLButtonElement>(
      'button[data-cms-retry-control="enabled"]',
    );
    expect(retry).not.toBeNull();
    const callsBefore = fetcher.mock.calls.length;
    healthy = true;
    act(() => retry?.click());
    await vi.waitFor(
      () => expect(panel()?.textContent?.toLowerCase()).toContain('running'),
      { timeout: 4_000 },
    );
    expect(fetcher.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(panel()?.querySelector('[data-dry-run-poll-error]')).toBeNull();
  }, 15_000);

  it('[P2-S09-AC-965] offers no Retry for a failure that retrying cannot fix', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => errorResponse(404, 'NOT_FOUND')),
    );
    mount();
    await vi.waitFor(
      () =>
        expect(
          panel()?.querySelector('[data-dry-run-poll-error]'),
        ).not.toBeNull(),
      { timeout: 4_000 },
    );
    expect(
      panel()?.querySelector('[data-dry-run-poll-error] button'),
    ).toBeNull();
  });
});
