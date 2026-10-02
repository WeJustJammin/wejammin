import { platformRegistrySet } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../infra/openapi-document.mjs';

type Operation = Readonly<{
  operationId: string;
  'x-auth-class': string;
  'x-capabilities': readonly string[];
  'x-capability-mode': string;
  'x-csrf': string;
  'x-idempotency': string;
  'x-if-match': string;
  'x-rate-limit': Readonly<Record<string, unknown>>;
  'x-timeout-ms': number;
  parameters?: readonly Readonly<{
    name: string;
    in: string;
    required: boolean;
  }>[];
  requestBody?: Readonly<{
    content: Readonly<{
      'application/json': Readonly<{
        schema: Readonly<{
          properties: Readonly<Record<string, unknown>>;
        }>;
      }>;
    }>;
  }>;
  responses: Readonly<
    Record<
      string,
      Readonly<{
        content?: Readonly<{
          'application/json'?: Readonly<{ schema?: { $ref: string } }>;
        }>;
      }>
    >
  >;
}>;

type Document = Readonly<{
  paths: Readonly<Record<string, Readonly<Record<string, Operation>>>>;
  components: Readonly<{ schemas: Readonly<Record<string, unknown>> }>;
}>;

const parameterNames = (
  operation: Operation | undefined,
  location: string,
): readonly string[] =>
  (operation?.parameters ?? [])
    .filter(({ in: place }) => place === location)
    .map(({ name }) => name);

describe('Slice 10 CMS-03B-01/02/03/04 canonical inventory authority', () => {
  it('registers the four served editorial workflow rows with exact policy', () => {
    const rows = platformRegistrySet.routes.filter(({ operationId }) =>
      ['CMS-03B-01', 'CMS-03B-02', 'CMS-03B-03', 'CMS-03B-04'].includes(
        operationId,
      ),
    );
    expect(rows.map(({ operationId }) => operationId)).toEqual([
      'CMS-03B-01',
      'CMS-03B-02',
      'CMS-03B-03',
      'CMS-03B-04',
    ]);
    expect(rows).toEqual([
      expect.objectContaining({
        method: 'POST',
        path: '/api/v1/cms/entries/{entryId}/revisions',
        operationId: 'CMS-03B-01',
        authClass: 'editorial_author',
        capabilities: ['cms.author', 'cms.editor'],
        capabilityMode: 'any_of',
        csrf: 'required',
        idempotency: 'required',
        ifMatch: 'required',
        rateClass: 'cms-entry-write',
        rateLimit: 120,
        partyRateLimit: 240,
        rateWindowSeconds: 60,
        rateScope: 'user',
        timeoutMs: 15_000,
        sloTier: 'tier_2',
        requestSchema: 'EntryRevisionApiRequestSchema',
        successSchema: 'EntryRevisionResourceSchema',
      }),
      expect.objectContaining({
        method: 'POST',
        path: '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve',
        operationId: 'CMS-03B-02',
        authClass: 'editorial_author',
        capabilities: ['cms.author', 'cms.editor'],
        capabilityMode: 'any_of',
        csrf: 'required',
        idempotency: 'required',
        ifMatch: 'required',
        rateClass: 'cms-entry-conflict',
        rateLimit: 60,
        partyRateLimit: 120,
        rateWindowSeconds: 60,
        rateScope: 'user',
        timeoutMs: 15_000,
        sloTier: 'tier_2',
        requestSchema: 'ConflictResolutionApiRequestSchema',
        successSchema: 'EntryRevisionResourceSchema',
      }),
      expect.objectContaining({
        method: 'GET',
        path: '/api/v1/cms/entries/{entryId}/revisions',
        operationId: 'CMS-03B-03',
        authClass: 'editorial_reader',
        capabilities: ['cms.author', 'cms.editor', 'cms.reviewer'],
        capabilityMode: 'any_of',
        csrf: 'none',
        idempotency: 'none',
        ifMatch: 'none',
        rateClass: 'cms-entry-read',
        rateLimit: 300,
        partyRateLimit: 600,
        rateWindowSeconds: 60,
        rateScope: 'user',
        timeoutMs: 8_000,
        sloTier: 'tier_1',
        requestSchema: 'RevisionHistoryApiRequestSchema',
        successSchema: 'RevisionHistoryPageSchema',
      }),
      expect.objectContaining({
        method: 'POST',
        path: '/api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore',
        operationId: 'CMS-03B-04',
        authClass: 'editorial_author',
        capabilities: ['cms.author', 'cms.editor'],
        capabilityMode: 'any_of',
        csrf: 'required',
        idempotency: 'required',
        ifMatch: 'required',
        rateClass: 'cms-entry-write',
        rateLimit: 30,
        partyRateLimit: 60,
        rateWindowSeconds: 60,
        rateScope: 'user',
        timeoutMs: 15_000,
        sloTier: 'tier_2',
        requestSchema: 'RevisionRestoreApiRequestSchema',
        successSchema: 'EntryRevisionResourceSchema',
      }),
    ]);
  });

  it('documents the two CAS commands with path, key, and If-Match parameters', () => {
    const document = buildOpenApiDocument() as Document;
    const revision = document.paths['/api/v1/cms/entries/{entryId}/revisions'];
    const create = revision?.post;

    expect(create?.operationId).toBe('CMS-03B-01');
    expect(create?.['x-auth-class']).toBe('editorial_author');
    expect(create?.['x-capability-mode']).toBe('any_of');
    expect(create?.['x-if-match']).toBe('required');
    expect(create?.['x-rate-limit']).toEqual({
      class: 'cms-entry-write',
      limit: 120,
      partyLimit: 240,
      windowSeconds: 60,
      scope: 'user',
    });
    expect(create?.['x-timeout-ms']).toBe(15_000);
    expect(parameterNames(create, 'path')).toEqual(['entryId']);
    expect(parameterNames(create, 'header')).toEqual([
      'Idempotency-Key',
      'If-Match',
    ]);
    expect(parameterNames(create, 'query')).toEqual([]);
    expect(
      create?.requestBody?.content['application/json'].schema.properties,
    ).toEqual(
      expect.objectContaining({
        baseRevision: expect.any(Object),
        changedPaths: expect.any(Object),
        expectedVersion: expect.any(Object),
      }),
    );
    expect(
      create?.responses['201']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/EntryRevisionResource' });
    expect(
      create?.responses['409']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/ApiError' });

    const restore =
      document.paths[
        '/api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore'
      ]?.post;
    expect(restore?.operationId).toBe('CMS-03B-04');
    expect(restore?.['x-if-match']).toBe('required');
    expect(parameterNames(restore, 'path')).toEqual(['entryId', 'revisionId']);
    expect(parameterNames(restore, 'header')).toEqual([
      'Idempotency-Key',
      'If-Match',
    ]);
    expect(parameterNames(restore, 'query')).toEqual([]);
    expect(
      restore?.requestBody?.content['application/json'].schema.properties,
    ).toEqual(
      expect.objectContaining({
        migrationChainId: expect.any(Object),
        expectedVersion: expect.any(Object),
      }),
    );
    expect(
      restore?.responses['201']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/EntryRevisionResource' });
  });

  it('documents conflict resolution on its distinct rate class', () => {
    const document = buildOpenApiDocument() as Document;
    const resolve =
      document.paths[
        '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve'
      ]?.post;

    expect(resolve?.operationId).toBe('CMS-03B-02');
    expect(resolve?.['x-csrf']).toBe('required');
    expect(resolve?.['x-idempotency']).toBe('required');
    expect(resolve?.['x-if-match']).toBe('required');
    expect(resolve?.['x-rate-limit']).toEqual({
      class: 'cms-entry-conflict',
      limit: 60,
      partyLimit: 120,
      windowSeconds: 60,
      scope: 'user',
    });
    expect(resolve?.['x-timeout-ms']).toBe(15_000);
    expect(parameterNames(resolve, 'path')).toEqual(['entryId', 'conflictId']);
    expect(parameterNames(resolve, 'header')).toEqual([
      'Idempotency-Key',
      'If-Match',
    ]);
    expect(parameterNames(resolve, 'query')).toEqual([]);
    expect(
      resolve?.requestBody?.content['application/json'].schema.properties,
    ).toEqual(
      expect.objectContaining({
        choices: expect.any(Object),
        baseRevision: expect.any(Object),
        expectedVersion: expect.any(Object),
      }),
    );
    expect(
      resolve?.responses['201']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/EntryRevisionResource' });
    expect(
      resolve?.responses['409']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/ApiError' });
  });

  it('keeps the query surface only on the safe history read', () => {
    const document = buildOpenApiDocument() as Document;
    const history =
      document.paths['/api/v1/cms/entries/{entryId}/revisions']?.get;

    expect(history?.operationId).toBe('CMS-03B-03');
    expect(history?.['x-auth-class']).toBe('editorial_reader');
    expect(history?.['x-csrf']).toBe('none');
    expect(history?.['x-idempotency']).toBe('none');
    expect(history?.['x-if-match']).toBe('none');
    expect(history?.['x-timeout-ms']).toBe(8_000);
    expect(history?.['x-rate-limit']).toEqual({
      class: 'cms-entry-read',
      limit: 300,
      partyLimit: 600,
      windowSeconds: 60,
      scope: 'user',
    });
    expect(history?.requestBody).toBeUndefined();
    expect(parameterNames(history, 'path')).toEqual(['entryId']);
    expect(parameterNames(history, 'header')).toEqual([]);
    expect(parameterNames(history, 'query')).toEqual([
      'cursor',
      'limit',
      'state',
      'compareRevisionId',
      'locale',
    ]);
    expect(history?.parameters?.find(({ name }) => name === 'limit')).toEqual(
      expect.objectContaining({ required: false }),
    );
    expect(
      history?.responses['200']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/RevisionHistoryPage' });
    expect(
      history?.responses['409']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/ApiError' });

    for (const status of ['400', '401', '403', '404', '409', '429', '500'])
      expect(history?.responses[status]).toBeDefined();
    for (const operation of [
      document.paths['/api/v1/cms/entries/{entryId}/revisions']?.post,
      document.paths[
        '/api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore'
      ]?.post,
      document.paths[
        '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve'
      ]?.post,
    ])
      expect(parameterNames(operation, 'query')).toEqual([]);
  });

  it('publishes every registered operation and its runtime components', () => {
    const document = buildOpenApiDocument() as Document;
    const documented = Object.values(document.paths).flatMap((pathItem) =>
      Object.values(pathItem).map(({ operationId }) => operationId),
    );

    for (const { operationId } of platformRegistrySet.routes)
      expect(documented).toContain(operationId);
    expect(documented).toHaveLength(platformRegistrySet.routes.length);
    expect(document.components.schemas).toHaveProperty('EntryRevisionResource');
    expect(document.components.schemas).toHaveProperty('RevisionHistoryPage');
    expect(document.components.schemas).toHaveProperty(
      'EntryRevisionApiRequest',
    );
    expect(document.components.schemas).toHaveProperty(
      'ConflictResolutionApiRequest',
    );
    expect(document.components.schemas).toHaveProperty(
      'RevisionHistoryApiRequest',
    );
    expect(document.components.schemas).toHaveProperty(
      'RevisionRestoreApiRequest',
    );
  });
});
