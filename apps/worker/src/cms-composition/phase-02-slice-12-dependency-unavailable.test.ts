/**
 * P2-S12-AC-008, AC-014, AC-020, AC-057, AC-062, AC-169, AC-175 (DEC-186 item 7):
 * every CMS-03C-01..05 route and both template reads answer a dependency
 * failure of 502, 503 and 504 as the BE03c catalog code `DEPENDENCY_UNAVAILABLE`
 * with the bound message `{CODE}: {operation} operation rejected or unavailable.`
 * and the closed dependency details (BE00: `dependencyClass`, `retryable`).
 */
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCmsLocaleApp } from './locale-routes';
import { createCmsPatternInstanceApp } from './pattern-instance-routes';
import { createCmsRelatedContentApp } from './related-content-routes';
import {
  dependencies as relatedDependencies,
  request as relatedRequest,
} from './related-content-routes.test-support';
import { createCmsTaxonomyApp } from './taxonomy-routes';
import { registerCmsTemplateDetailRoutes } from './template-detail-routes';
import {
  createCmsTemplateApp,
  type CmsTemplateDependencies,
} from './template-routes';

const origin = 'https://cms.example.test';
const ID = (n: number): string =>
  `d1200000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const REQUEST_ID = ID(900);
const STATUSES = [502, 503, 504] as const;
/**
 * BE00 line 172 types the DEPENDENCY_UNAVAILABLE member `{ dependencyClass, retryable: true }` for
 * 502, 503 and 504 alike; BE03c 1274 and the retry column of every 03c catalog row ("502/503/504:
 * retry at most 3 times") agree. Every surface, locale and related-content included, publishes
 * `retryable: true`.
 */
type Surface = Readonly<{
  name: string;
  token: string;
  /** An app whose single port is `port`, plus the request that reaches it. */
  build: (port: () => Promise<unknown>) => Readonly<{
    send: () => Promise<Response>;
  }>;
}>;

const portFailure = (status: number) => ({
  ok: false as const,
  status,
  code: 'PRIVATE_PROVIDER_CODE',
  message: 'secret provider prose',
  details: { privateData: 'secret' },
});

const session = (capability: string) => ({
  ok: true as const,
  value: {
    userId: ID(1),
    actingPartyId: ID(2),
    capabilities: [capability],
    mfaFresh: true,
  },
});
const allowRate = async (input: { limit: number }) => ({
  ok: true as const,
  value: {
    allowed: true,
    limit: input.limit,
    remaining: input.limit - 1,
    resetAt: 2_000,
  },
});
const writeHeaders = {
  origin,
  'content-type': 'application/json',
  'idempotency-key': 'dependency-map-0001',
  'x-request-id': REQUEST_ID,
};
const successorHeaders = { ...writeHeaders, 'if-match': '"1"' };

const templateDependencies = (
  overrides: Partial<CmsTemplateDependencies>,
): CmsTemplateDependencies =>
  ({
    humanOrigins: [origin],
    now: () => 1_000,
    resolveSession: async () => session('cms.template_designer'),
    rateLimit: allowRate,
    defineTemplate: async () => portFailure(500),
    readContext: async () => portFailure(500),
    readLatest: async () => portFailure(500),
    telemetry: () => undefined,
    ...overrides,
  }) as unknown as CmsTemplateDependencies;

const readRequest = (path: string) =>
  new Request(`https://api.example.test${path}`, {
    method: 'GET',
    headers: { origin, 'x-request-id': REQUEST_ID },
  });

const SURFACES: readonly Surface[] = [
  {
    name: 'CMS-03C-01 template define',
    token: 'template',
    build: (port) => {
      const app = createCmsTemplateApp(
        templateDependencies({
          defineTemplate: async () => port() as never,
        }),
      );
      return {
        send: () =>
          Promise.resolve(
            app.request('/api/v1/cms/templates/versions', {
              method: 'POST',
              headers: writeHeaders,
              body: JSON.stringify({
                templateKey: 'profile-header',
                compatibleTypeIds: [ID(3)],
                slots: [],
                reservedRegions: [
                  'header',
                  'now',
                  'record',
                  'detail',
                  'provenance',
                ],
                bindings: {},
                locale: 'en-US',
                audience: 'public',
                expectedVersion: null,
              }),
            }),
          ),
      };
    },
  },
  {
    name: 'cmsTemplateContextRead',
    token: 'template',
    build: (port) => {
      const app = createCmsTemplateApp(
        templateDependencies({ readContext: async () => port() as never }),
      );
      return {
        send: () =>
          Promise.resolve(
            app.request(readRequest('/api/v1/cms/templates/context')),
          ),
      };
    },
  },
  {
    name: 'cmsTemplateLatestRead',
    token: 'template',
    build: (port) => {
      const app = new Hono();
      registerCmsTemplateDetailRoutes(
        app,
        templateDependencies({ readLatest: async () => port() as never }),
      );
      return {
        send: () =>
          Promise.resolve(
            app.request(readRequest('/api/v1/cms/templates/profile-header')),
          ),
      };
    },
  },
  {
    name: 'CMS-03C-02 pattern instance',
    token: 'composition',
    build: (port) => {
      const app = createCmsPatternInstanceApp({
        humanOrigins: [origin],
        now: () => 1_000,
        resolveSession: async () => session('cms.author'),
        rateLimit: allowRate,
        insertPattern: async () => port() as never,
        telemetry: () => undefined,
      });
      return {
        send: () =>
          Promise.resolve(
            app.request(
              new Request(
                'https://api.example.test/api/v1/cms/compositions/pattern-instances',
                {
                  method: 'POST',
                  headers: successorHeaders,
                  body: JSON.stringify({
                    revisionId: ID(11),
                    patternId: ID(12),
                    patternVersion: 1,
                    linkMode: 'linked',
                    slotPath: '/primary',
                    overrides: {},
                    expectedVersion: '1',
                  }),
                },
              ),
            ),
          ),
      };
    },
  },
  {
    name: 'CMS-03C-03 taxonomy term action',
    token: 'taxonomy',
    build: (port) => {
      const app = createCmsTaxonomyApp({
        humanOrigins: [origin],
        now: () => 1_000,
        resolveSession: async () => session('cms.taxonomy_curator'),
        rateLimit: allowRate,
        actTerm: async () => port() as never,
        telemetry: () => undefined,
      });
      return {
        send: () =>
          Promise.resolve(
            app.request(
              new Request(
                `https://api.example.test/api/v1/cms/taxonomies/${ID(21)}/terms/actions`,
                {
                  method: 'POST',
                  headers: successorHeaders,
                  body: JSON.stringify({
                    taxonomyId: ID(21),
                    action: 'create',
                    termKey: 'jazz-fusion',
                    parentId: null,
                    survivorId: null,
                    labels: [{ locale: 'en-US', label: 'Jazz fusion' }],
                    aliases: [],
                    expectedVersion: '1',
                  }),
                },
              ),
            ),
          ),
      };
    },
  },
  {
    name: 'CMS-03C-04 locale variant',
    token: 'locale',
    build: (port) => {
      const app = createCmsLocaleApp({
        humanOrigins: [origin],
        now: () => 1_000,
        resolveSession: async () => session('cms.author'),
        rateLimit: allowRate,
        authorLocale: async () => port() as never,
        readLocaleVariant: async () => {
          throw new Error('the write suite never reads');
        },
        telemetry: () => undefined,
      });
      return {
        send: () =>
          Promise.resolve(
            app.request(
              new Request(
                `https://api.example.test/api/v1/cms/entries/${ID(31)}/locales/fr-FR/variants`,
                {
                  method: 'POST',
                  headers: successorHeaders,
                  body: JSON.stringify({
                    entryId: ID(31),
                    locale: 'fr-FR',
                    sourceRevisionId: ID(32),
                    fields: [{ fieldId: ID(33), value: 'Titre' }],
                    fallbackChain: ['en-US'],
                    noFallbackFieldIds: [],
                    sourceHash: 'a'.repeat(64),
                    expectedVersion: '1',
                  }),
                },
              ),
            ),
          ),
      };
    },
  },
  {
    name: 'CMS-03C-05 related content',
    token: 'related-content',
    build: (port) => {
      const app = createCmsRelatedContentApp(
        relatedDependencies({
          actRelatedContent: async () => port() as never,
        }),
      );
      return { send: () => Promise.resolve(app.request(relatedRequest())) };
    },
  },
];

afterEach(() => {
  vi.useRealTimers();
});

describe('[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE', () => {
  describe.each(SURFACES)('$name', ({ token, build }) => {
    it.each(STATUSES)(
      'a port failure of %i answers that status as DEPENDENCY_UNAVAILABLE with the bound message and closed details',
      async (status) => {
        const response = await build(async () => portFailure(status)).send();
        const text = await response.clone().text();
        expect(response.status).toBe(status);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(JSON.parse(text)).toEqual({
          code: 'DEPENDENCY_UNAVAILABLE',
          message: `DEPENDENCY_UNAVAILABLE: ${token} operation rejected or unavailable.`,
          requestId: response.headers.get('x-request-id'),
          details: {
            dependencyClass: 'cms_composition',
            retryable: true,
          },
        });
        expect(text).not.toContain('secret');
        expect(text).not.toContain('PRIVATE_PROVIDER_CODE');
      },
    );

    it('a port that throws answers 503 DEPENDENCY_UNAVAILABLE without its prose', async () => {
      const response = await build(async () => {
        throw new Error('secret provider prose');
      }).send();
      const text = await response.clone().text();
      expect(response.status).toBe(503);
      expect(JSON.parse(text)).toMatchObject({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: `DEPENDENCY_UNAVAILABLE: ${token} operation rejected or unavailable.`,
        details: { dependencyClass: 'cms_composition', retryable: true },
      });
      expect(text).not.toContain('secret');
    });

    it('a malformed port envelope answers 502 DEPENDENCY_UNAVAILABLE', async () => {
      const response = await build(async () => ({ unexpected: true })).send();
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({
        code: 'DEPENDENCY_UNAVAILABLE',
        details: {
          dependencyClass: 'cms_composition',
          retryable: true,
        },
      });
    });

    it('the 15-second route deadline answers 504 DEPENDENCY_UNAVAILABLE', async () => {
      vi.useFakeTimers();
      const pending = build(() => new Promise(() => undefined)).send();
      await vi.advanceTimersByTimeAsync(15_000);
      const response = await pending;
      expect(response.status).toBe(504);
      expect(await response.json()).toMatchObject({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: `DEPENDENCY_UNAVAILABLE: ${token} operation rejected or unavailable.`,
        details: { dependencyClass: 'cms_composition', retryable: true },
      });
    });
  });
});
