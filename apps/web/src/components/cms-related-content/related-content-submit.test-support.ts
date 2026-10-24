import type { RelatedContentRuleRequest } from '@wejammin/contracts';

import { forwardCmsRelatedContentMutation } from '../../server/cms-composition-platform-related';
import {
  RELATED_CONTENT_CATALOG_CODES,
  submitRelatedContent,
} from './related-content-submit';

export const ENTRY = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
export const PIN = '018f0c45-73fe-7dc2-9c09-000000000001';
export const EXCL = '018f0c45-73fe-7dc2-9c09-000000000002';
export const request: RelatedContentRuleRequest = {
  entryId: ENTRY,
  pins: [PIN],
  exclusions: [EXCL],
  derivedRule: {
    key: 'shared-terms',
    version: '1',
    reasonCode: 'shared_terms',
    maxCandidates: 8,
  },
  expectedVersion: '4',
};
export const IDEMPOTENCY_KEY = 'a7f3c1de-5b2e-4f60-9d41-0c8e2b7a6f13';
export const resource = (extra: Record<string, unknown> = {}) => ({
  id: '018f0c45-73fe-7dc2-9c09-000000000009',
  version: '2',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-15T12:00:00Z',
  updatedAt: '2026-10-15T12:00:00Z',
  state: 'active',
  sourceEntryId: ENTRY,
  pins: [PIN],
  exclusions: [EXCL],
  derivedRule: { key: 'shared-terms', version: '1' },
  eligibleCount: 3,
  ...extra,
});
export const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
export const error = (
  status: number,
  details: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response =>
  json(
    status,
    {
      code: RELATED_CONTENT_CATALOG_CODES[status],
      message: 'x',
      requestId: '50000000-0000-4000-8000-000000000005',
      details,
    },
    headers,
  );
export const send = (fetcher: typeof fetch, body = request) =>
  submitRelatedContent(body, 'csrf-1', IDEMPOTENCY_KEY, fetcher);
export const answering =
  (response: Response): typeof fetch =>
  async () =>
    response;

/**
 * A `fetch` that delivers the browser's request to the REAL same-origin proxy, with only the platform
 * binding answering `upstream`: the browser transport and the proxy are composed, not stubbed apart.
 */
export const throughProxy =
  (upstream: () => Response): typeof fetch =>
  async (input, init) => {
    const origin = 'https://web.test';
    const headers = new Headers(init?.headers);
    headers.set('origin', origin);
    headers.set('cookie', 'wj_access=a; wj_csrf=csrf-1');
    return forwardCmsRelatedContentMutation(
      new Request(`${origin}${String(input)}`, { ...init, headers }),
      ENTRY,
      { fetch: async () => upstream() },
    );
  };
