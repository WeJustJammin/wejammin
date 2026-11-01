import { act } from 'react';
import { vi } from 'vitest';

import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  CSRF,
  KEY,
} from '../../server/cms-governed-review-fixtures.test-support';
import { flush } from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { WorkflowCommandEnvironment } from '../cms-editorial-workflow/use-cms-workflow-command';

/** The browser seams a governed form is mounted over: the wire, the key, the tab storage. */
export const governedEnvironment = (
  fetcher: ReturnType<typeof vi.fn>,
  storage: MemoryStorage = new MemoryStorage(),
  navigate: (target: string) => void = vi.fn(),
): WorkflowCommandEnvironment => ({
  transport: {
    fetcher: fetcher as never,
    documentRef: { cookie: `wj_csrf=${CSRF}` },
  },
  newKey: () => KEY,
  storage: () => storage,
  navigate,
});

/** A fetcher that answers the queued responses in order. */
export const queuedFetcher = (responses: readonly Response[]) => {
  const queue = [...responses];
  return vi.fn(async () => queue.shift() as Response);
};

export const bodyOf = (
  fetcher: ReturnType<typeof vi.fn>,
  call = 0,
): Record<string, unknown> =>
  JSON.parse(
    (fetcher.mock.calls[call] as unknown as [string, RequestInit])[1]
      .body as string,
  ) as Record<string, unknown>;

export const headersOf = (
  fetcher: ReturnType<typeof vi.fn>,
  call = 0,
): Headers =>
  new Headers(
    (fetcher.mock.calls[call] as unknown as [string, RequestInit])[1].headers,
  );

export const pathOf = (fetcher: ReturnType<typeof vi.fn>, call = 0): string =>
  (fetcher.mock.calls[call] as unknown as [string, RequestInit])[0];

/**
 * Settles the command's async chain inside `act` until `done` holds (bounded):
 * the wire, the lazy validators and the state updates each take a turn. Unlike a
 * polling wait it never lets React update outside `act`.
 */
export const flushUntil = async (
  done: () => boolean,
  attempts = 25,
): Promise<void> => {
  for (let turn = 0; turn < attempts && !done(); turn += 1) {
    await flush();
    // A real Response body resolves on a macrotask, which microtasks alone never reach.
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }
};
