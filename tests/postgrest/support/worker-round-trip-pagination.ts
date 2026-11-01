/** Public draft creation and real registry continuation; no synthetic CMS rows. */
import { randomUUID } from 'node:crypto';

import {
  ContentSchemaRegistryListPageSchema,
  ContentSchemaRegistryListQuerySchema,
  ContentTypeVersionResourceSchema,
  type ContentSchemaRegistryListQuery,
} from '@wejammin/contracts';
import { expect } from 'vitest';

import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryPortInput,
} from '../../../apps/worker/src/content-schema-registry/types';
import { createCmsApp, draftTypeBody, ownerSession } from './cms-app';
import { callRpc, userToken, type CmsOwner } from './stack';

export const assertContentTypePage = (value: unknown) => {
  const parsed = ContentSchemaRegistryListPageSchema.safeParse(value);
  expect(parsed.success, 'complete registry page contract').toBe(true);
  if (!parsed.success) throw new Error('Invalid registry page');
  return parsed.data;
};

const assertPagination = async (
  owner: CmsOwner,
  read: (query: ContentSchemaRegistryListQuery) => Promise<unknown>,
) => {
  const app = createCmsApp(
    ownerSession(owner.authUserId, owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const keyPrefix = `pager${randomUUID().replaceAll('-', '')}`;
  const create = async (suffix: string) => {
    const typeKey = `${keyPrefix}_${suffix}`;
    const response = await app.send('POST', '/api/v1/cms/content-types', {
      body: draftTypeBody(typeKey),
      idempotencyKey: randomUUID(),
    });
    expect(response.status).toBe(201);
    const version = ContentTypeVersionResourceSchema.parse(response.body);
    expect(version.typeKey).toBe(typeKey);
    expect(version.state).toBe('draft');
    return version;
  };
  const first = await create('a');
  const second = await create('b');
  expect(first.contentTypeId).not.toBe(second.contentTypeId);
  const query = ContentSchemaRegistryListQuerySchema.parse({
    resourceKind: 'content_type',
    keyPrefix,
    limit: 1,
    sort: 'key',
    direction: 'asc',
  });
  const firstPage = assertContentTypePage(await read(query));
  expect(firstPage.items.map((item) => item.id)).toEqual([first.contentTypeId]);
  expect(firstPage.items).toMatchObject([
    {
      resourceKind: 'content_type',
      id: first.contentTypeId,
      typeKey: first.typeKey,
    },
  ]);
  expect(firstPage.nextCursor).not.toBeNull();
  if (firstPage.nextCursor === null)
    throw new Error('Expected registry continuation');
  expect(firstPage.nextCursor.length).toBeGreaterThan(0);
  expect(firstPage.nextCursor.length).toBeLessThanOrEqual(512);
  const secondPage = assertContentTypePage(
    await read(
      ContentSchemaRegistryListQuerySchema.parse({
        ...query,
        cursor: firstPage.nextCursor,
      }),
    ),
  );
  expect(secondPage.items.map((item) => item.id)).toEqual([
    second.contentTypeId,
  ]);
  expect(secondPage.items).toMatchObject([
    {
      resourceKind: 'content_type',
      id: second.contentTypeId,
      typeKey: second.typeKey,
    },
  ]);
  expect(secondPage.nextCursor).toBeNull();
  expect(
    firstPage.items.some((left) =>
      secondPage.items.some((right) => left.id === right.id),
    ),
  ).toBe(false);
};

export const assertAdapterContentTypePagination = async (
  owner: CmsOwner,
  dependencies: Pick<ContentSchemaRegistryDependencies, 'ports'>,
) => {
  const input = {
    operationId: 'CMS-03A-06',
    requestId: randomUUID(),
    request: new Request('http://127.0.0.1/api-gate'),
    session: ownerSession(owner.authUserId, owner.organizationId, []),
  } satisfies ContentSchemaRegistryPortInput;
  const signal = new AbortController().signal;
  await assertPagination(owner, async (query) => {
    const result = await dependencies.ports.listContentTypes(
      { ...input, query },
      signal,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Owner registry adapter read failed');
    return result.value;
  });
};

export const assertDirectContentTypePagination = async (owner: CmsOwner) => {
  const token = userToken(owner.authUserId);
  const context = {
    authUserId: owner.authUserId,
    actingPartyId: owner.organizationId,
  };
  await assertPagination(owner, async (query) => {
    const result = await callRpc('cms_list_content_types', token, {
      p_request: { ...query, context },
    });
    expect(result.status).toBe(200);
    return result.body;
  });
};
