/**
 * The concealed 404 rows through the production Worker against the real database
 * (AC307: CMS-03A-09 for a hidden or absent source).
 *
 * The request goes browser -> production Hono app -> production RPC adapter -> Kong ->
 * PostgREST -> database. The database raises NOT_FOUND for a source version that does
 * not exist in the caller's scope; the Worker answers the BE00 404 whose body carries
 * no port-authored text and an empty details object, byte-identical for an absent
 * source and for an existing version of another type (a hidden one).
 *
 * Commits fixtures (the owner's content type): run right after `pnpm db:reset`.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  type CmsApp,
  createCmsApp,
  draftTypeBody,
  ownerSession,
} from './support/cms-app';
import { type CmsOwner, ensureCmsOwner } from './support/stack';

let owner: CmsOwner;
let app: CmsApp;
let typeId = '';
let versionId = '';
let otherTypeId = '';

const successor = (type: string, version: string) =>
  app.send(
    'POST',
    `/api/v1/cms/content-types/${type}/versions/${version}/successors`,
    {
      body: {
        expectedVersion: '1',
        supportedLocales: null,
        fallbackChains: null,
        defaultTemplateVersionId: null,
        templateBindings: null,
      },
      ifMatch: '1',
    },
  );

const unique = (prefix: string): string =>
  `${prefix}_${randomUUID().slice(0, 8).replaceAll('-', '')}`;

beforeAll(async () => {
  owner = ensureCmsOwner();
  app = createCmsApp(
    ownerSession(owner.authUserId, owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const first = await app.send('POST', '/api/v1/cms/content-types', {
    body: draftTypeBody(unique('nf_a')),
  });
  const second = await app.send('POST', '/api/v1/cms/content-types', {
    body: draftTypeBody(unique('nf_b')),
  });
  expect([first.status, second.status]).toEqual([201, 201]);
  typeId = String(first.body.contentTypeId);
  versionId = String(first.body.id);
  otherTypeId = String(second.body.contentTypeId);
});

describe('CMS-03A-09 concealed 404 for a hidden or absent source, end to end', () => {
  it('[P2-S09-AC-307] an absent source version is 404 with the concealed body and empty details, from the database NOT_FOUND', async () => {
    app.clearObserved();
    const response = await successor(typeId, randomUUID());
    expect(app.observed()).toEqual([
      { rpc: 'cms_create_schema_successor', status: 400, message: 'NOT_FOUND' },
    ]);
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      code: 'NOT_FOUND',
      message: 'The requested CMS registry resource was not found.',
      details: {},
    });
  });

  it('[P2-S09-AC-307] a source version that exists under another type is hidden: the same 404, member for member, as an absent one', async () => {
    const absent = await successor(typeId, randomUUID());
    const hidden = await successor(otherTypeId, versionId);
    expect(hidden.status).toBe(404);
    const { requestId: absentRequest, ...absentBody } = absent.body;
    const { requestId: hiddenRequest, ...hiddenBody } = hidden.body;
    expect(typeof absentRequest).toBe('string');
    expect(typeof hiddenRequest).toBe('string');
    expect(hiddenBody).toEqual(absentBody);
  });
});
