import { describe, expect, it, vi } from 'vitest';
import {
  CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
} from '@wejammin/contracts';

import {
  createContentSchemaRegistryPorts,
  resolveContentSchemaRegistryPage,
} from '../../server/content-schema-registry-context';
import { createContentSchemaRegistryPlatformPorts } from '../../server/content-schema-registry-platform-api';
import type { ContentSchemaRegistryAuthority } from '../../server/content-schema-registry-context';
import {
  ACTOR_ID,
  detail,
  list,
  PARTY_ID,
  TYPE_ID,
  VERSION_ID,
} from './content-schema-registry-server-test-values';

const makePorts = (
  authority: ContentSchemaRegistryAuthority = {
    actingPartyId: PARTY_ID,
    capabilities: ['cms.schema_registry.read'],
  },
) => {
  const loadList = vi.fn(() => list);
  const loadDetail = vi.fn(() => detail);
  return {
    ports: createContentSchemaRegistryPorts({
      verifySession: () => ({ userId: ACTOR_ID, expiresAt: 200 }),
      now: () => 100,
      resolveAuthority: () => authority,
      loadList,
      loadDetail,
    }),
    loadList,
    loadDetail,
  };
};

describe('content schema registry protected read context', () => {
  it('requires a live session and server-derived read capability', async () => {
    const { ports } = makePorts();
    const authorized = await resolveContentSchemaRegistryPage({
      request: new Request(
        'https://app.test/app/cms-content-modeling?limit=25',
      ),
      route: 'list',
      ports,
      requestId: ACTOR_ID,
    });
    expect(authorized.kind).toBe('authorized');
    if (authorized.kind === 'authorized') {
      expect(authorized.page.access).toBe('read-only');
      expect(authorized.page).not.toHaveProperty('actorId');
      expect(authorized.page).not.toHaveProperty('actingPartyId');
      expect(authorized.page.initialList.status).toBe('success');
    }

    const unauthenticated = await resolveContentSchemaRegistryPage({
      request: new Request('https://app.test/app/cms-content-modeling'),
      route: 'list',
      ports: createContentSchemaRegistryPorts({
        verifySession: () => null,
        now: () => 100,
        resolveAuthority: () => ({
          actingPartyId: PARTY_ID,
          capabilities: ['cms.schema_registry.read'],
        }),
        loadList: () => list,
        loadDetail: () => detail,
      }),
      requestId: ACTOR_ID,
    });
    expect(unauthenticated).toMatchObject({
      kind: 'unauthenticated',
      reason: 'missing_session',
    });
  });

  it.each([
    ['cms.schema_registry.read,cms.schema_designer', 'authorized', 'full'],
    ['cms.schema_registry.read', 'authorized', 'read-only'],
    [undefined, 'forbidden', null],
  ] as const)(
    'projects adapter capability proof %s without trusting browser claims',
    async (capabilityHeader, expectedKind, expectedAccess) => {
      const responseHeaders = new Headers({
        'content-type': 'application/json',
      });
      if (capabilityHeader !== undefined)
        responseHeaders.set(
          CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
          capabilityHeader,
        );
      if (expectedAccess === 'full')
        responseHeaders.set(
          CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
          'ownerFull',
        );
      else if (expectedAccess === 'read-only')
        responseHeaders.set(
          CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
          'entitledRead',
        );
      const ports = createContentSchemaRegistryPlatformPorts({
        fetch: vi.fn(
          async () =>
            new Response(JSON.stringify(list), {
              status: 200,
              headers: responseHeaders,
            }),
        ),
      });
      const result = await resolveContentSchemaRegistryPage({
        request: new Request('https://app.test/app/cms-content-modeling', {
          headers: {
            cookie: 'wj_access=opaque-session',
            'x-capability': 'cms.schema_designer',
          },
        }),
        route: 'list',
        ports,
        requestId: ACTOR_ID,
      });

      expect(result.kind).toBe(expectedKind);
      if (expectedKind === 'authorized') {
        if (result.kind !== 'authorized') throw new Error('expected page');
        expect(result.page.access).toBe(expectedAccess);
        expect(result.page.variant).toBe(
          expectedAccess === 'full' ? 'ownerFull' : 'entitledRead',
        );
      }
    },
  );

  it.each([
    ['Paid', 'entitledRead', 'cms.schema_registry.read', 'read-only'],
    [
      'Creator',
      'ownerFull',
      'cms.schema_registry.read,cms.schema_designer',
      'full',
    ],
    ['Guardian', 'guardianMandate', 'cms.schema_registry.read', 'read-only'],
    ['Junior', 'juniorRestricted', 'cms.schema_registry.read', 'read-only'],
    ['Business', 'businessMandate', 'cms.schema_registry.read', 'read-only'],
    ['Staff', 'staffCaseScoped', 'cms.schema_registry.read', 'read-only'],
    ['Admin', 'adminStepUp', 'cms.schema_registry.read', 'read-only'],
  ] as const)(
    'projects the trusted %s server presentation variant through the production adapter',
    async (_role, variant, capabilityHeader, expectedAccess) => {
      const responseHeaders = new Headers({
        'content-type': 'application/json',
        [CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER]: capabilityHeader,
        [CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER]: variant,
      });
      const ports = createContentSchemaRegistryPlatformPorts({
        fetch: vi.fn(
          async () =>
            new Response(JSON.stringify(list), {
              status: 200,
              headers: responseHeaders,
            }),
        ),
      });
      const result = await resolveContentSchemaRegistryPage({
        request: new Request('https://app.test/app/cms-content-modeling', {
          headers: { cookie: 'wj_access=opaque-session' },
        }),
        route: 'list',
        ports,
        requestId: ACTOR_ID,
      });

      expect(result.kind).toBe('authorized');
      if (result.kind !== 'authorized') throw new Error('expected page');
      expect(result.page.variant).toBe(variant);
      expect(result.page.access).toBe(expectedAccess);
      expect(result.page).not.toHaveProperty('actorId');
      expect(result.page).not.toHaveProperty('actingPartyId');
    },
  );

  it('fails closed for the server-derived Free/forbiddenHidden scope', async () => {
    const responseHeaders = new Headers({
      'content-type': 'application/json',
      [CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER]: 'forbiddenHidden',
    });
    const ports = createContentSchemaRegistryPlatformPorts({
      fetch: vi.fn(
        async () =>
          new Response(JSON.stringify(list), {
            status: 200,
            headers: responseHeaders,
          }),
      ),
    });
    const result = await resolveContentSchemaRegistryPage({
      request: new Request('https://app.test/app/cms-content-modeling', {
        headers: { cookie: 'wj_access=opaque-session' },
      }),
      route: 'list',
      ports,
      requestId: ACTOR_ID,
    });
    expect(result).toEqual({ kind: 'forbidden' });
  });

  it('keeps trusted actor and acting-party IDs server-side and out of the authorized page', async () => {
    const ports = createContentSchemaRegistryPlatformPorts({
      fetch: vi.fn(
        async () =>
          new Response(JSON.stringify(list), {
            status: 200,
            headers: {
              'content-type': 'application/json',
              [CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER]:
                'cms.schema_designer,cms.schema_registry.read',
              [CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER]: ACTOR_ID,
              [CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER]: PARTY_ID,
            },
          }),
      ),
    });
    const result = await resolveContentSchemaRegistryPage({
      request: new Request('https://app.test/app/cms-content-modeling', {
        headers: { cookie: 'wj_access=opaque-session' },
      }),
      route: 'list',
      ports,
      requestId: ACTOR_ID,
    });

    expect(result.kind).toBe('authorized');
    if (result.kind !== 'authorized') throw new Error('expected page');
    expect(result.page).not.toHaveProperty('actorId');
    expect(result.page).not.toHaveProperty('actingPartyId');
    expect(JSON.stringify(result.page)).not.toContain(PARTY_ID);
    expect(result.page.access).toBe('full');
  });

  it('loads exact detail IDs and performs no write or mutation operation', async () => {
    const { ports, loadList, loadDetail } = makePorts();
    const result = await resolveContentSchemaRegistryPage({
      request: new Request(
        `https://app.test/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`,
      ),
      route: 'detail',
      contentTypeId: TYPE_ID,
      versionId: VERSION_ID,
      ports,
      requestId: ACTOR_ID,
    });
    expect(result.kind).toBe('authorized');
    expect(loadList).not.toHaveBeenCalled();
    expect(loadDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        contentTypeId: TYPE_ID,
        versionId: VERSION_ID,
      }),
    );
  });

  it('returns typed invalid-query, forbidden, and degraded boundaries', async () => {
    const baseRequest = new Request(
      'https://app.test/app/cms-content-modeling?resourceKind=content_type&state=draft',
    );
    const { ports } = makePorts();
    await expect(
      resolveContentSchemaRegistryPage({
        request: baseRequest,
        route: 'list',
        ports,
        requestId: ACTOR_ID,
      }),
    ).resolves.toMatchObject({ kind: 'invalid_query' });

    const forbidden = await resolveContentSchemaRegistryPage({
      request: new Request('https://app.test/app/cms-content-modeling'),
      route: 'list',
      ports: createContentSchemaRegistryPorts({
        verifySession: () => ({ userId: ACTOR_ID, expiresAt: 200 }),
        now: () => 100,
        resolveAuthority: () => ({
          actingPartyId: PARTY_ID,
          capabilities: [],
        }),
        loadList: () => list,
        loadDetail: () => detail,
      }),
      requestId: ACTOR_ID,
    });
    expect(forbidden).toMatchObject({ kind: 'forbidden' });

    const degraded = await resolveContentSchemaRegistryPage({
      request: new Request('https://app.test/app/cms-content-modeling'),
      route: 'list',
      ports: createContentSchemaRegistryPorts({
        verifySession: () => ({ userId: ACTOR_ID, expiresAt: 200 }),
        now: () => 100,
        resolveAuthority: () => ({
          actingPartyId: PARTY_ID,
          capabilities: ['cms.schema_registry.read'],
        }),
        loadList: () => {
          throw new Error('registry unavailable');
        },
        loadDetail: () => detail,
      }),
      requestId: ACTOR_ID,
    });
    expect(degraded).toMatchObject({ kind: 'degraded' });
  });

  it('returns a disclosure-safe detail 404 instead of redirecting to sign-in', async () => {
    const ports = createContentSchemaRegistryPlatformPorts({
      fetch: vi.fn(async () => new Response('{}', { status: 404 })),
    });
    const result = await resolveContentSchemaRegistryPage({
      request: new Request(
        `https://app.test/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`,
        { headers: { cookie: 'wj_access=opaque-session' } },
      ),
      route: 'detail',
      contentTypeId: TYPE_ID,
      versionId: VERSION_ID,
      ports,
      requestId: ACTOR_ID,
    });

    expect(result).toEqual({ kind: 'not_found' });
  });
});
