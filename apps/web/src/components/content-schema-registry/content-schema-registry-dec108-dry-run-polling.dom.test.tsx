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
import {
  activationPreparation,
  passedDryRunPreparation,
  queuedDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';

/**
 * FE03 "DEC-108 dry-run job status": a queued or running dry run is observed
 * by polling `GET /api/v1/jobs/{jobId}` (the BE00 job status resource). The
 * job state is announced without moving focus; a succeeded job never renders
 * a passed result by itself, it triggers a canonical detail refetch so the
 * sealed report is read from the server.
 */

type JobBody = {
  readonly state: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  readonly etag: string;
};

const jobResponse = ({ state, etag }: JobBody): Response =>
  new Response(
    JSON.stringify({
      id: JOB_ID,
      type: 'cms.schema_dry_run',
      state,
      progress: null,
      resultRef: null,
      error:
        state === 'failed'
          ? { code: 'DRY_RUN_FAILED', retryable: false }
          : null,
      createdAt: '2026-10-02T12:00:00.000Z',
      updatedAt: '2026-10-02T12:00:01.000Z',
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json', etag },
    },
  );

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const mount = (
  preparation: Parameters<typeof draftDetail>[0],
  onCanonicalRefetch: (reason: string) => Promise<void>,
): void => {
  container = document.createElement('div');
  (document.body as unknown as HTMLElement).appendChild(container);
  root = createRoot(container);
  const props = versionPageProps({
    initialDetail: successDetail(draftDetail(preparation)),
    onCanonicalRefetch: onCanonicalRefetch as () => Promise<void>,
  });
  act(() => root?.render(React.createElement(WorkbenchUnderTest, props)));
};

const unmount = (): void => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
};

const jobReads = (fetcher: ReturnType<typeof vi.fn>) =>
  fetcher.mock.calls.filter(([input]) =>
    String(input).includes(`/api/v1/jobs/${JOB_ID}`),
  );

const panelText = (): string =>
  regionNamed(document, /activation preparation/iu)?.textContent ?? '';

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterEach(() => {
  unmount();
  vi.unstubAllGlobals();
});

describe('[DEC-108] dry-run job polling', () => {
  it('polls the same-origin BE00 job resource for a queued dry run and announces running', async () => {
    const responses: JobBody[] = [
      { state: 'running', etag: '"2"' },
      { state: 'running', etag: '"2"' },
    ];
    const fetcher = vi.fn(async () =>
      jobResponse(responses.shift() ?? { state: 'running', etag: '"2"' }),
    );
    vi.stubGlobal('fetch', fetcher);
    mount(queuedDryRunPreparation, async () => undefined);

    await vi.waitFor(
      () => expect(panelText().toLowerCase()).toContain('running'),
      {
        timeout: 3_000,
      },
    );
    const [href, init] = jobReads(fetcher)[0] ?? [];
    expect(String(href)).toBe(`/api/v1/jobs/${JOB_ID}`);
    expect((init as RequestInit).method).toBe('GET');
    expect((init as RequestInit).credentials).toBe('same-origin');
    const headers = new Headers((init as RequestInit).headers);
    for (const forbidden of ['idempotency-key', 'if-match', 'x-csrf-token'])
      expect(headers.has(forbidden)).toBe(false);
    expect(panelText()).not.toMatch(/passed/iu);
  });

  it('does not poll when there is no queued or running dry run', async () => {
    const fetcher = vi.fn(async () =>
      jobResponse({ state: 'running', etag: '"2"' }),
    );
    vi.stubGlobal('fetch', fetcher);
    // Control: a queued dry run is polled.
    mount(queuedDryRunPreparation, async () => undefined);
    await vi.waitFor(
      () => expect(jobReads(fetcher).length).toBeGreaterThan(0),
      {
        timeout: 3_000,
      },
    );
    unmount();
    fetcher.mockClear();
    for (const preparation of [
      passedDryRunPreparation,
      activationPreparation(),
    ]) {
      mount(preparation, async () => undefined);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));
      });
      expect(jobReads(fetcher)).toHaveLength(0);
      unmount();
    }
  });

  it('never moves focus while the job state changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jobResponse({ state: 'running', etag: '"2"' })),
    );
    const sentinel = document.createElement('button');
    (document.body as unknown as HTMLElement).appendChild(sentinel);
    sentinel.focus();
    mount(queuedDryRunPreparation, async () => undefined);
    await vi.waitFor(
      () => expect(panelText().toLowerCase()).toContain('running'),
      {
        timeout: 3_000,
      },
    );
    expect(document.activeElement).toBe(sentinel);
    sentinel.remove();
  });

  it('on success requests a canonical refetch instead of rendering a passed result', async () => {
    const responses: JobBody[] = [
      { state: 'running', etag: '"2"' },
      { state: 'succeeded', etag: '"3"' },
    ];
    const fetcher = vi.fn(async () =>
      jobResponse(responses.shift() ?? { state: 'succeeded', etag: '"3"' }),
    );
    const refetch = vi.fn(async () => undefined);
    vi.stubGlobal('fetch', fetcher);
    mount(queuedDryRunPreparation, refetch);

    await vi.waitFor(
      () => expect(refetch).toHaveBeenCalledWith('detail-read'),
      {
        timeout: 4_000,
      },
    );
    expect(panelText()).not.toMatch(/passed/iu);
  });

  it('stops polling after a terminal job state', async () => {
    const fetcher = vi.fn(async () =>
      jobResponse({ state: 'succeeded', etag: '"3"' }),
    );
    vi.stubGlobal('fetch', fetcher);
    mount(queuedDryRunPreparation, async () => undefined);
    await vi.waitFor(
      () => expect(jobReads(fetcher).length).toBeGreaterThan(0),
      {
        timeout: 3_000,
      },
    );
    const settled = jobReads(fetcher).length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_300));
    });
    expect(jobReads(fetcher)).toHaveLength(settled);
  });

  it('renders unsealed failure copy for a failed job and never a passed result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jobResponse({ state: 'failed', etag: '"3"' })),
    );
    const refetch = vi.fn(async () => undefined);
    mount(queuedDryRunPreparation, refetch);
    await vi.waitFor(
      () => expect(panelText().toLowerCase()).toContain('failed'),
      {
        timeout: 3_000,
      },
    );
    expect(panelText()).not.toMatch(/passed/iu);
    expect(refetch).toHaveBeenCalledWith('detail-read');
  });
});
