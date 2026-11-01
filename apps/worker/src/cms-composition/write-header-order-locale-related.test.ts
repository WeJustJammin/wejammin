import type { LocaleVariantResource } from '@wejammin/contracts';
import { vi } from 'vitest';

import {
  createCmsLocaleApp,
  type CmsLocaleDependencies,
} from './locale-routes';
import {
  createCmsRelatedContentApp,
  type CmsRelatedContentDependencies,
} from './related-content-routes';
import {
  body as relatedBody,
  ENTRY_ID as RELATED_ENTRY_ID,
  PATH as RELATED_PATH,
  validResource,
} from './related-content-routes.test-support';
import {
  DIGEST,
  ID,
  merge,
  ORIGIN,
  rate,
  registerHeaderOrderTests,
  session,
  type Probe,
} from './write-header-order.test-support';

/**
 * BE00 lines 386-387 and BE03c 408/1502 for CMS-03C-04 (locale variant) and CMS-03C-05 (related
 * content): the cases and the rule live in `write-header-order.test-support.ts`. Both routes
 * require an If-Match equal to the body `expectedVersion`.
 */
const ENTRY_ID = ID(40);
const FIELD_ID = ID(41);
const LOCALE_PATH = `/api/v1/cms/entries/${ENTRY_ID}/locales/fr-FR/variants`;
const LOCALE_BODY = {
  entryId: ENTRY_ID,
  locale: 'fr-FR',
  sourceRevisionId: ID(42),
  fields: [{ fieldId: FIELD_ID, value: 'Titre traduit' }],
  fallbackChain: ['en-US'],
  noFallbackFieldIds: [],
  sourceHash: DIGEST,
  expectedVersion: '1',
};
const LOCALE_RESOURCE: LocaleVariantResource = {
  id: ID(43),
  version: '1',
  contentHash: DIGEST,
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T12:00:00.000Z',
  state: 'draft',
  entryId: ENTRY_ID,
  revisionId: ID(44),
  locale: 'fr-FR',
  sourceRevisionId: ID(42),
  fallbackChain: ['en-US'],
  noFallbackFieldIds: [],
  staleFieldIds: [],
};
const LOCALE_HEADERS = {
  origin: ORIGIN,
  'content-type': 'application/json',
  'idempotency-key': 'locale-command-0001',
  'if-match': '"1"',
};
const RELATED_HEADERS = {
  origin: ORIGIN,
  'content-type': 'application/json',
  'idempotency-key': 'related-content-0001',
  'if-match': '"1"',
};
const BAD_IF_MATCH = [null, 'W/"1"', '1', '"2"'] as const;

const localeProbe: Probe = {
  name: 'CMS-03C-04 locale variant',
  badIfMatch: BAD_IF_MATCH,
  send: async (headers, capability, body) => {
    const rateLimit = vi.fn(rate);
    const authorLocale = vi.fn<CmsLocaleDependencies['authorLocale']>(
      async () => ({ ok: true, value: LOCALE_RESOURCE }),
    );
    const dependencies: CmsLocaleDependencies = {
      humanOrigins: [ORIGIN],
      now: () => 1_000,
      resolveSession: session(capability ? ['cms.author'] : []),
      rateLimit,
      authorLocale,
      readLocaleVariant: async () => {
        throw new Error('the write suite never reads');
      },
      telemetry: () => undefined,
    };
    const response = await createCmsLocaleApp(dependencies).request(
      `https://api.example.test${LOCALE_PATH}`,
      {
        method: 'POST',
        headers: merge(LOCALE_HEADERS, headers),
        body: JSON.stringify(body ?? LOCALE_BODY),
      },
    );
    return {
      response,
      rateLimit: () => rateLimit.mock.calls.length,
      port: () => authorLocale.mock.calls.length,
    };
  },
};

const relatedProbe: Probe = {
  name: 'CMS-03C-05 related content',
  badIfMatch: BAD_IF_MATCH,
  send: async (headers, capability, body) => {
    const rateLimit = vi.fn(rate);
    const actRelatedContent = vi.fn<
      CmsRelatedContentDependencies['actRelatedContent']
    >(async () => ({ ok: true, value: validResource() }));
    const dependencies: CmsRelatedContentDependencies = {
      humanOrigins: [ORIGIN],
      now: () => 1_000,
      resolveSession: session(capability ? ['cms.author'] : []),
      rateLimit,
      actRelatedContent,
      readRelatedContent: async () => ({ ok: true, value: { rule: null } }),
      telemetry: () => undefined,
    };
    const response = await createCmsRelatedContentApp(dependencies).request(
      `https://api.example.test${RELATED_PATH}`,
      {
        method: 'POST',
        headers: merge(RELATED_HEADERS, headers),
        body: JSON.stringify(
          body ?? { ...relatedBody, entryId: RELATED_ENTRY_ID },
        ),
      },
    );
    return {
      response,
      rateLimit: () => rateLimit.mock.calls.length,
      port: () => actRelatedContent.mock.calls.length,
    };
  },
};

registerHeaderOrderTests([localeProbe, relatedProbe]);
