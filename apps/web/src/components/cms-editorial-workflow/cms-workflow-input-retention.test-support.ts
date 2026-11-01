import { vi } from 'vitest';

import { CSRF } from '../../server/cms-workflow-platform-command.test-support';
import type { MemoryStorage } from '../../lib/test-support/memory-storage';
import { apiError, jsonResponse } from './cms-workflow-fixtures.test-support';
import type { Fetcher } from './cms-workflow-focus.test-support';

/*
 * Shared pieces of the retain-input specs (FE03 "retain input", P2-S11-AC-037,
 * AC-040, AC-043): a queued fetch, the environment a form is mounted with, the
 * two refusals the specs drive (a definite 409 and a lost 504 answer) and
 * readers of the request a form sent.
 */

export const KEY = 'idem-key-retention-001';
export const staleCandidate = () =>
  jsonResponse(409, apiError('CONFLICT', { reasonCode: 'version_set_stale' }));
export const lostAnswer = () => jsonResponse(504, apiError('GATEWAY_TIMEOUT'));

export const bodyAt = (
  fetcher: { mock: { calls: unknown[][] } },
  index: number,
): unknown => {
  const call = fetcher.mock.calls[index] as unknown as [string, RequestInit];
  return JSON.parse(call[1].body as string);
};
export const keyAt = (
  fetcher: { mock: { calls: unknown[][] } },
  index: number,
) =>
  new Headers(
    (fetcher.mock.calls[index] as unknown as [string, RequestInit])[1].headers,
  ).get('idempotency-key');

export const environmentFor = (fetcher: Fetcher, storage: MemoryStorage) => ({
  transport: { fetcher, documentRef: { cookie: `wj_csrf=${CSRF}` } },
  newKey: () => KEY,
  storage: () => storage,
  navigate: vi.fn(),
});

export const queueOf = (responses: readonly Response[]) => {
  const queue = [...responses];
  return vi.fn<Fetcher>(async () => queue.shift() as Response);
};

export const refusalKind = (container: HTMLElement) =>
  container
    .querySelector('[data-cms-workflow-refusal]')
    ?.getAttribute('data-cms-workflow-refusal');
