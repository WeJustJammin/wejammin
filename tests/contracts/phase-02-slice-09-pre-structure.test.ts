import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BlockDefinitionRegistryRecordSchema,
  BlockDefinitionVersionResourceSchema,
  BlockLifecycleEventResourceSchema,
  CapabilityBindingResourceSchema,
  CmsDefinitionStateSchema,
  CmsVersionSchema,
  ContentSchemaRegistryDetailSchema,
  ContentTypeVersionResourceSchema,
  FieldDefinitionVersionResourceSchema,
  RelationDefinitionResourceSchema,
  SchemaActivationResourceSchema,
  SchemaArtifactResourceSchema,
  TemplateBindingResourceSchema,
} from '@wejammin/contracts';

import {
  activation,
  artifact,
  block,
  detail,
  field,
  lifecycleEvent,
  relation,
  resource,
  safeBlock,
  session,
  validBlock,
} from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-test-values';
import {
  jsonRequest,
  makeHarness,
} from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-worker-test-support';
import { detailWithPreparation } from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-dec108-test-values';
import {
  makeSignedHarness,
  makeSigning,
} from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-support';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  REQUEST_ID,
} from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-test-values';

const ROOT = resolve(import.meta.dirname, '../..');
const source = (relative: string): string =>
  readFileSync(join(ROOT, relative), 'utf8');
const walk = (directory: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(join(ROOT, directory))) {
    const relative = `${directory}/${entry}`;
    if (['node_modules', 'dist', '.astro', 'coverage'].includes(entry))
      continue;
    if (statSync(join(ROOT, relative)).isDirectory()) walk(relative, out);
    else if (
      /\.(ts|tsx|astro|mjs)$/u.test(entry) &&
      !/\.test\.|\.spec\.|test-support|database\.types/u.test(entry)
    )
      out.push(relative);
  }
  return out;
};

describe('registry boundary guards for A01-A08', () => {
  it('[P2-S09-AC-012] exposes block registration and lifecycle only as the two signed release-worker POST routes: no human route can register, mutate, withdraw or delete a block', async () => {
    const harness = makeHarness();
    const blockRoutes = harness.app.routes
      .filter((route) => route.path.includes('/blocks'))
      .map((route) => `${route.method} ${route.path}`)
      .sort();
    expect(blockRoutes).toEqual([
      'POST /api/v1/cms/blocks/versions',
      'POST /api/v1/cms/blocks/versions/:blockDefinitionVersionId/lifecycle',
    ]);
    for (const method of ['PUT', 'PATCH', 'DELETE', 'GET'])
      for (const path of [
        '/api/v1/cms/blocks/versions',
        '/api/v1/cms/blocks/versions/70000000-0000-4000-8000-000000000007',
        '/api/v1/cms/blocks/versions/70000000-0000-4000-8000-000000000007/lifecycle',
      ]) {
        const response = await harness.app.request(
          new Request(`${API_ORIGIN}${path}`, {
            method,
            headers: {
              origin: CMS_ORIGIN,
              authorization: 'Bearer x',
              'x-request-id': REQUEST_ID,
            },
          }),
        );
        expect(response.status, `${method} ${path}`).toBe(404);
      }
    const humanWithReleaseCapability = makeHarness({
      session: {
        ok: true,
        value: {
          ...session,
          capabilities: ['release.block_registry.write', 'cms.schema_designer'],
        },
      },
    });
    const response = await humanWithReleaseCapability.app.request(
      jsonRequest('/api/v1/cms/blocks/versions', validBlock),
    );
    expect(response.status).toBe(403);
    expect(
      humanWithReleaseCapability.ports.registerBlock,
    ).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-013] serves list and detail only to an authenticated, capability-scoped caller under the protected CMS prefix with no-store, never to the release origin', async () => {
    const harness = makeHarness({
      session: { ok: true, value: { ...session, capabilities: [] } },
    });
    for (const path of [
      '/api/v1/cms/content-types',
      '/api/v1/cms/content-types/30000000-0000-4000-8000-000000000003/versions/40000000-0000-4000-8000-000000000004',
    ]) {
      const refused = await harness.app.request(
        new Request(`${API_ORIGIN}${path}`, {
          headers: { origin: CMS_ORIGIN, authorization: 'Bearer x' },
        }),
      );
      expect(refused.status).toBe(403);
      expect(refused.headers.get('cache-control')).toBe('no-store');
      const releaseOrigin = await makeHarness().app.request(
        new Request(`${API_ORIGIN}${path}`, {
          headers: {
            origin: 'https://release-worker.example.test',
            authorization: 'Bearer x',
          },
        }),
      );
      expect(releaseOrigin.status).toBe(403);
    }
    const open = makeHarness();
    const list = await open.app.request(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
        headers: { origin: CMS_ORIGIN, authorization: 'Bearer x' },
      }),
    );
    expect(list.status).toBe(200);
    expect(list.headers.get('cache-control')).toBe('no-store');
    const routes = open.app.routes
      .filter((route) => route.method === 'GET')
      .map((route) => route.path);
    expect(routes.every((path) => path.startsWith('/api/v1/cms/'))).toBe(true);
    expect(
      routes.some((path) => /public|delivery|publication/u.test(path)),
    ).toBe(false);
  });

  it('[P2-S09-AC-014] keeps every control-plane registry table and RPC out of the web app, the public routes and every non-registry Worker module', () => {
    const migration = source(
      'supabase/migrations/20260902080000_content_schema_registry_authority.sql',
    );
    const tables = [
      ...migration.matchAll(/create table platform_private\.(cms_[a-z_]+)/gu),
    ].map((match) => match[1] as string);
    expect(tables.length).toBeGreaterThanOrEqual(12);
    for (const required of [
      'cms_content_types',
      'cms_content_type_versions',
      'cms_field_definition_versions',
      'cms_relation_definitions',
      'cms_schema_migration_plans',
      'cms_schema_artifacts',
      'cms_block_definition_versions',
      'cms_release_nonce_receipts',
      'cms_block_definition_lifecycle_events',
    ])
      expect(tables).toContain(required);
    const registryRpc =
      /\bcms_(create_type_draft|add_field_definition|bind_relation|activate_schema|register_block|advance_block_lifecycle|list_content_types|get_content_type_version)\b/u;
    const offenders = [
      ...walk('apps/web/src'),
      ...walk('apps/worker/src').filter(
        (file) => !file.startsWith('apps/worker/src/content-schema-registry/'),
      ),
      ...walk('packages').filter(
        (file) =>
          !/packages\/(contracts|observability)\/|packages\/data-access\//u.test(
            file,
          ),
      ),
    ].filter((file) => {
      const text = source(file);
      return (
        tables.some((table) => new RegExp(`\\b${table}\\b`, 'u').test(text)) ||
        registryRpc.test(text)
      );
    });
    expect(offenders).toEqual([]);
  });

  it('[P2-S09-AC-015] gives every browser resource the closed, ownerless IA envelope: id, decimal version, contentHash and timestamps, with the documented per-model exceptions and closed state enums', () => {
    type Row = Readonly<{
      name: string;
      schema: { safeParse: (value: unknown) => { success: boolean } };
      sample: Record<string, unknown>;
      meta: 'envelope' | 'exception';
    }>;
    const rows: readonly Row[] = [
      {
        name: 'content_type_version',
        schema: ContentTypeVersionResourceSchema,
        sample: resource,
        meta: 'envelope',
      },
      {
        name: 'field_definition_version',
        schema: FieldDefinitionVersionResourceSchema,
        sample: field,
        meta: 'envelope',
      },
      {
        name: 'relation_definition',
        schema: RelationDefinitionResourceSchema,
        sample: relation,
        meta: 'envelope',
      },
      {
        name: 'schema_activation',
        schema: SchemaActivationResourceSchema,
        sample: activation,
        meta: 'envelope',
      },
      {
        name: 'block_definition_version',
        schema: BlockDefinitionVersionResourceSchema,
        sample: block,
        meta: 'envelope',
      },
      {
        name: 'schema_artifact',
        schema: SchemaArtifactResourceSchema,
        sample: artifact,
        meta: 'exception',
      },
      {
        name: 'block_definition_lifecycle_event',
        schema: BlockLifecycleEventResourceSchema,
        sample: lifecycleEvent,
        meta: 'exception',
      },
      {
        name: 'block_definition_registry_record',
        schema: BlockDefinitionRegistryRecordSchema,
        sample: safeBlock,
        meta: 'exception',
      },
      {
        name: 'capability_binding',
        schema: CapabilityBindingResourceSchema,
        sample: detail.capabilityBindings[0] as Record<string, unknown>,
        meta: 'exception',
      },
      {
        name: 'template_binding',
        schema: TemplateBindingResourceSchema,
        sample: {
          resourceKind: 'template_binding',
          id: resource.id,
          contentTypeVersionId: resource.id,
          templateVersionId: resource.id,
          position: 0,
          version: '1',
          state: 'draft',
        },
        meta: 'exception',
      },
    ];
    for (const row of rows) {
      expect(row.schema.safeParse(row.sample).success, row.name).toBe(true);
      for (const owner of ['ownerId', 'owner_id', 'createdBy', 'authUserId'])
        expect(
          row.schema.safeParse({ ...row.sample, [owner]: resource.id }).success,
          `${row.name} ${owner}`,
        ).toBe(false);
      expect(
        row.schema.safeParse({ ...row.sample, unknown: 1 }).success,
        `${row.name} strict`,
      ).toBe(false);
      if (row.meta === 'envelope') {
        for (const member of [
          'id',
          'version',
          'contentHash',
          'createdAt',
          'updatedAt',
        ]) {
          const rest = { ...row.sample };
          delete rest[member];
          expect(
            row.schema.safeParse(rest).success,
            `${row.name} requires ${member}`,
          ).toBe(false);
        }
        expect(
          row.schema.safeParse({ ...row.sample, version: '0' }).success,
        ).toBe(false);
        expect(
          row.schema.safeParse({ ...row.sample, version: 3 }).success,
        ).toBe(false);
        expect(
          row.schema.safeParse({ ...row.sample, contentHash: 'F'.repeat(64) })
            .success,
        ).toBe(false);
      }
      if (
        'state' in row.sample &&
        row.name !== 'schema_artifact' &&
        row.name !== 'schema_activation'
      ) {
        expect(
          CmsDefinitionStateSchema.safeParse(row.sample.state).success,
          row.name,
        ).toBe(true);
        expect(
          row.schema.safeParse({ ...row.sample, state: 'unknown_state' })
            .success,
          `${row.name} closed state`,
        ).toBe(false);
      }
    }
    expect(
      SchemaArtifactResourceSchema.safeParse({ ...artifact, state: 'draft' })
        .success,
    ).toBe(false);
    expect(
      SchemaActivationResourceSchema.safeParse({
        ...activation,
        state: 'draft',
      }).success,
    ).toBe(false);
    expect(
      ContentSchemaRegistryDetailSchema.safeParse(detailWithPreparation)
        .success,
    ).toBe(true);
    expect(
      ContentSchemaRegistryDetailSchema.safeParse({
        ...detailWithPreparation,
        ownerId: resource.id,
      }).success,
    ).toBe(false);
  });

  it('[P2-S09-AC-016] uses the eight closed definition states and decimal monotonic versions and keeps migration state a separate vocabulary', () => {
    expect(CmsDefinitionStateSchema.options).toEqual([
      'draft',
      'review',
      'approved',
      'scheduled',
      'active',
      'superseded',
      'retired',
      'blocked',
    ]);
    for (const migrationOnly of [
      'dry_running',
      'ready',
      'running',
      'verifying',
      'completed',
      'failed_retryable',
      'failed_terminal',
    ])
      expect(
        ContentTypeVersionResourceSchema.safeParse({
          ...resource,
          state: migrationOnly,
        }).success,
        migrationOnly,
      ).toBe(false);
    for (const version of ['1', '2', '9223372036854775807'])
      expect(CmsVersionSchema.safeParse(version).success).toBe(true);
    for (const version of [
      '0',
      '-1',
      '01',
      '1.0',
      '9223372036854775808',
      '',
      'v1',
    ])
      expect(CmsVersionSchema.safeParse(version).success, version).toBe(false);
    expect(
      ContentTypeVersionResourceSchema.safeParse({
        ...resource,
        migrationState: 'running',
      }).success,
    ).toBe(false);
  });

  it('[P2-S09-AC-025] gives release-worker requests no browser CSRF authority: a CSRF cookie or token neither admits nor blocks A05 and A08', async () => {
    const signing = await makeSigning();
    const harness = await makeSignedHarness({ signing });
    const csrfNoise = {
      cookie: 'wj_session_ref=session; wj_csrf=server-token',
      'x-csrf-token': 'wrong-token',
    };
    for (const operationId of ['CMS-03A-05', 'CMS-03A-08'] as const) {
      const response = await harness.send(
        operationId,
        operationId === 'CMS-03A-05'
          ? validBlock
          : {
              fromLifecycle: 'supported',
              toLifecycle: 'deprecated',
              expectedVersion: '1',
              releaseDigest: 'a'.repeat(64),
            },
        { extra: csrfNoise },
      );
      expect(response.status, operationId).toBe(201);
    }
    expect(harness.resolveSession).not.toHaveBeenCalled();
  });
});
