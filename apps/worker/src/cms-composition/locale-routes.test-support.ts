import type { LocaleVariantResource } from '@wejammin/contracts';

import type { CmsLocaleDependencies, CmsLocaleError } from './locale-routes';

/** Shared fixtures of the CMS-03C-04 locale route suites (`locale-routes*.test.ts`). */
export const entryId = 'd1000000-0000-4000-8000-000000000001';
export const sourceRevisionId = 'd1000000-0000-4000-8000-000000000002';
export const revisionId = 'd1000000-0000-4000-8000-000000000003';
export const variantId = 'd1000000-0000-4000-8000-000000000004';
export const fieldId = 'd1000000-0000-4000-8000-000000000005';
export const origin = 'https://cms.example.test';
export const path = `/api/v1/cms/entries/${entryId}/locales/fr-FR/variants`;
export const body = {
  entryId,
  locale: 'fr-FR',
  sourceRevisionId,
  fields: [{ fieldId, value: 'Titre traduit' }],
  fallbackChain: ['en-US'],
  noFallbackFieldIds: [],
  sourceHash: 'a'.repeat(64),
  expectedVersion: '1',
};
export const resource: LocaleVariantResource = {
  id: variantId,
  version: '1',
  contentHash: 'b'.repeat(64),
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T12:00:00.000Z',
  state: 'draft',
  entryId,
  revisionId,
  locale: 'fr-FR',
  sourceRevisionId,
  fallbackChain: ['en-US'],
  noFallbackFieldIds: [],
  staleFieldIds: [],
};

export const request = (
  overrides: {
    path?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) =>
  new Request(`https://api.example.test${overrides.path ?? path}`, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'idempotency-key': 'locale-command-0001',
      'if-match': '"1"',
      ...overrides.headers,
    },
    body: JSON.stringify(overrides.body ?? body),
  });

export const deps = (
  overrides: Partial<CmsLocaleDependencies> = {},
): CmsLocaleDependencies => ({
  humanOrigins: [origin],
  now: () => 1_000,
  resolveSession: async () => ({
    ok: true,
    value: {
      userId: 'd1000000-0000-4000-8000-000000000006',
      actingPartyId: 'd1000000-0000-4000-8000-000000000007',
      capabilities: ['cms.author'],
      mfaFresh: true,
    },
  }),
  rateLimit: async (input) => ({
    ok: true,
    value: {
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      resetAt: 2_000,
    },
  }),
  authorLocale: async () => ({ ok: true, value: resource }),
  // The write suites never read; the read suites install their own port (`locale-read.test-support.ts`).
  readLocaleVariant: async () => ({
    ok: false,
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'The write suites do not exercise the read port.',
  }),
  telemetry: () => undefined,
  ...overrides,
});
export const portError = (
  status: CmsLocaleError['status'],
  details?: Readonly<Record<string, unknown>>,
  retryAfterSeconds?: number,
): CmsLocaleError => ({
  ok: false,
  status,
  code: 'UNTRUSTED',
  message: 'private provider text must not escape',
  ...(details === undefined ? {} : { details }),
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});
