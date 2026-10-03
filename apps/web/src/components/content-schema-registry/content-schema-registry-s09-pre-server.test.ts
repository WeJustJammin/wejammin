import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import * as generated from '@wejammin/contracts';

import {
  createContentSchemaRegistryPorts,
  resolveContentSchemaRegistryPage,
} from '../../server/content-schema-registry-context';
import * as serverContracts from '../../server/content-schema-registry-contracts';
import { safeContentSchemaRegistryReturnPath } from '../../server/content-schema-registry-contracts';
import {
  ACTOR_ID,
  detail,
  list,
  PARTY_ID,
  TYPE_ID,
  VERSION_ID,
} from './content-schema-registry-server-test-values';
import { CONTENT_SCHEMA_REGISTRY_OPERATION_IDS } from './content-schema-registry-types';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));
const source = (relative: string): string =>
  readFileSync(fromHere(relative), 'utf8');

type Calls = Record<
  'verifySession' | 'resolveAuthority' | 'loadList' | 'loadDetail',
  ReturnType<typeof vi.fn>
>;
const makePorts = (
  options: {
    session?: unknown;
    now?: number;
    capabilities?: readonly string[];
  } = {},
): {
  ports: ReturnType<typeof createContentSchemaRegistryPorts>;
  calls: Calls;
} => {
  const calls: Calls = {
    verifySession: vi.fn(() =>
      options.session === undefined
        ? { userId: ACTOR_ID, expiresAt: 200 }
        : options.session,
    ),
    resolveAuthority: vi.fn(() => ({
      actingPartyId: PARTY_ID,
      capabilities: options.capabilities ?? ['cms.schema_registry.read'],
    })),
    loadList: vi.fn(() => list),
    loadDetail: vi.fn(() => detail),
  };
  return {
    calls,
    ports: createContentSchemaRegistryPorts({
      verifySession: calls.verifySession as never,
      now: () => options.now ?? 100,
      resolveAuthority: calls.resolveAuthority as never,
      loadList: calls.loadList as never,
      loadDetail: calls.loadDetail as never,
    }),
  };
};
const resolve = (
  ports: ReturnType<typeof createContentSchemaRegistryPorts> | null,
  route: 'list' | 'detail' = 'list',
  url = 'https://app.test/app/cms-content-modeling',
  ids: { contentTypeId?: string; versionId?: string } = {
    contentTypeId: TYPE_ID,
    versionId: VERSION_ID,
  },
) =>
  resolveContentSchemaRegistryPage({
    request: new Request(url),
    route,
    ports,
    requestId: ACTOR_ID,
    ...(route === 'detail' ? ids : {}),
  } as never);
const order = (mock: ReturnType<typeof vi.fn>): number =>
  mock.mock.invocationCallOrder[0] ?? Number.NaN;

describe('[P2-S09-AC-218] [P2-S09-AC-263] the protected route verifies everything before composing HTML', () => {
  it('verifies session, expiry, acting context and read capability in that order before any registry read', async () => {
    const { ports, calls } = makePorts();
    const result = await resolve(ports);
    expect(result.kind).toBe('authorized');
    expect(order(calls.verifySession)).toBeLessThan(
      order(calls.resolveAuthority),
    );
    expect(order(calls.resolveAuthority)).toBeLessThan(order(calls.loadList));
    const detailPorts = makePorts();
    expect((await resolve(detailPorts.ports, 'detail')).kind).toBe(
      'authorized',
    );
    expect(order(detailPorts.calls.resolveAuthority)).toBeLessThan(
      order(detailPorts.calls.loadDetail),
    );
  });

  it('refuses a missing, malformed or expired session with no authority or registry read', async () => {
    for (const [session, now, reason] of [
      [null, 100, 'missing_session'],
      [{ userId: 'not-a-uuid', expiresAt: 200 }, 100, 'missing_session'],
      [{ userId: ACTOR_ID, expiresAt: 200 }, 200, 'expired_session'],
      [{ userId: ACTOR_ID, expiresAt: 200 }, 900, 'expired_session'],
    ] as const) {
      const { ports, calls } = makePorts({ session, now });
      expect(await resolve(ports)).toMatchObject({
        kind: 'unauthenticated',
        reason,
      });
      for (const port of [
        calls.resolveAuthority,
        calls.loadList,
        calls.loadDetail,
      ])
        expect(port).not.toHaveBeenCalled();
    }
    expect(await resolve(null)).toMatchObject({ kind: 'unauthenticated' });
  });

  it('refuses a caller without a read capability and an invalid query or record id before any registry read', async () => {
    const forbidden = makePorts({ capabilities: ['cms.something_else'] });
    expect((await resolve(forbidden.ports)).kind).toBe('forbidden');
    expect(forbidden.calls.loadList).not.toHaveBeenCalled();
    const badQuery = makePorts();
    expect(
      (
        await resolve(
          badQuery.ports,
          'list',
          'https://app.test/app/cms-content-modeling?limit=9999&owner=x',
        )
      ).kind,
    ).toBe('invalid_query');
    expect(badQuery.calls.resolveAuthority).not.toHaveBeenCalled();
    const badId = makePorts();
    expect(
      (
        await resolve(
          badId.ports,
          'detail',
          'https://app.test/app/cms-content-modeling',
          { contentTypeId: 'article', versionId: VERSION_ID },
        )
      ).kind,
    ).toBe('invalid_record');
    expect(badId.calls.resolveAuthority).not.toHaveBeenCalled();
    const post = makePorts();
    expect(
      (
        await resolveContentSchemaRegistryPage({
          request: new Request('https://app.test/x', { method: 'POST' }),
          route: 'list',
          ports: post.ports,
          requestId: ACTOR_ID,
        })
      ).kind,
    ).toBe('invalid_record');
  });

  it('hands the page minimal serializable values with no actor, party or capability identifier', async () => {
    const { ports } = makePorts({
      capabilities: ['cms.schema_registry.read', 'cms.schema_designer'],
    });
    const result = await resolve(ports);
    if (result.kind !== 'authorized')
      throw new Error('expected an authorized page');
    const text = JSON.stringify(result.page);
    expect(JSON.parse(text)).toStrictEqual(
      JSON.parse(JSON.stringify(JSON.parse(text))),
    );
    for (const forbidden of [
      ACTOR_ID,
      PARTY_ID,
      'cms.schema_designer',
      'cms.schema_registry.read',
    ])
      expect(text, forbidden).not.toContain(forbidden);
    expect(Object.keys(result.page)).not.toEqual(
      expect.arrayContaining([
        'actorId',
        'actingPartyId',
        'capabilities',
        'session',
      ]),
    );
    expect(typeof result.page.variant).toBe('string');
    expect(['full', 'read-only', 'disabled', 'not-rendered']).toContain(
      result.page.access,
    );
  });

  it('returns from the frontmatter for every non-authorized outcome, so no HTML is composed before verification', () => {
    for (const path of [
      '../../pages/app/cms-content-modeling/index.astro',
      '../../pages/app/cms-content-modeling/[contentTypeId]/versions/[versionId].astro',
    ]) {
      const text = source(path);
      const [, frontmatter = '', template = ''] = text.split(/^---$/mu);
      expect(frontmatter).toContain('await resolveContentSchemaRegistryPage(');
      for (const kind of ['unauthenticated', 'invalid_query', 'forbidden'])
        expect(frontmatter, `${path} ${kind}`).toMatch(
          new RegExp(`result\\.kind === '${kind}'[\\s\\S]{0,200}return`, 'u'),
        );
      expect(frontmatter).toMatch(
        /not_found[\s\S]{0,200}return new Response\('Not found'/u,
      );
      expect(
        frontmatter.indexOf('resolveContentSchemaRegistryPage('),
      ).toBeLessThan(frontmatter.indexOf('const page = result.page'));
      expect(template).toContain('ContentSchemaRegistryWorkbenchIsland');
      expect(template).not.toMatch(/\breturn\b/u);
    }
    expect(
      safeContentSchemaRegistryReturnPath(
        new URL('https://app.test/app/cms-content-modeling?limit=25'),
      ),
    ).toBe('/app/cms-content-modeling?limit=25');
  });
});

describe('[P2-S09-AC-221] FE03 consumes the generated BE03a contracts and operation ids', () => {
  const ORIGINAL = [
    'CMS-03A-01',
    'CMS-03A-02',
    'CMS-03A-03',
    'CMS-03A-04',
    'CMS-03A-05',
    'CMS-03A-06',
    'CMS-03A-07',
    'CMS-03A-08',
  ];

  it('uses the generated operation id list itself, which contains the original eight', () => {
    expect(CONTENT_SCHEMA_REGISTRY_OPERATION_IDS).toBe(
      generated.CONTENT_SCHEMA_REGISTRY_OPERATION_IDS,
    );
    for (const id of ORIGINAL)
      expect(CONTENT_SCHEMA_REGISTRY_OPERATION_IDS).toContain(id);
  });

  it('re-exports the generated request and resource schemas by identity, never a copy', () => {
    for (const name of [
      'ContentTypeDraftRequestSchema',
      'FieldSchemaChangeRequestSchema',
      'RelationBindingRequestSchema',
      'SchemaActivationRequestSchema',
      'ContentTypeVersionResourceSchema',
      'FieldDefinitionVersionResourceSchema',
      'RelationDefinitionResourceSchema',
      'SchemaActivationResourceSchema',
      'ContentSchemaRegistryDetailSchema',
      'ContentSchemaRegistryListPageSchema',
      'ContentSchemaRegistryListQuerySchema',
      'ContentSchemaRegistryRecordSchema',
    ] as const)
      expect((serverContracts as Record<string, unknown>)[name], name).toBe(
        (generated as Record<string, unknown>)[name],
      );
    expect(serverContracts.ContentSchemaRegistrySafeBlockProjectionSchema).toBe(
      generated.BlockDefinitionRegistryRecordSchema,
    );
  });

  it('declares no hand-written DTO or client authority type in the web registry sources', () => {
    const files = [
      'content-schema-registry-types.ts',
      '../../server/content-schema-registry-contracts.ts',
    ];
    const dto =
      /\b(?:interface|type)\s+(ContentTypeDraftRequest|FieldSchemaChangeRequest|RelationBindingRequest|SchemaActivationRequest|ContentTypeVersionResource|FieldDefinitionVersionResource|RelationDefinitionResource|SchemaActivationResource|ContentSchemaRegistryDetail|ContentSchemaRegistryListPage|ContentSchemaRegistryRecord)\b\s*(?:=\s*\{|\{)/u;
    for (const file of files) expect(source(file), file).not.toMatch(dto);
    const authority =
      /\b(?:interface|type)\s+\w*(?:Authority|Permission|ClientRole|ClientCapabilit)\w*\s*(?:=\s*\{|\{)/u;
    for (const file of files) expect(source(file), file).not.toMatch(authority);
    expect(
      source('../../server/content-schema-registry-contracts.ts'),
    ).toContain("from '@wejammin/contracts'");
  });
});
