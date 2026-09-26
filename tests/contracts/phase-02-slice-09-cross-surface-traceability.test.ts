import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');

type SourceFile = Readonly<{ path: string; source: string }>;

const walk = (relativeDirectory: string): SourceFile[] => {
  const absoluteDirectory = resolve(ROOT, relativeDirectory);
  if (!existsSync(absoluteDirectory)) return [];

  const files: SourceFile[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (
          !['.git', 'coverage', 'dist', 'node_modules'].includes(entry.name)
        ) {
          visit(absolutePath);
        }
        continue;
      }
      if (
        !entry.isFile() ||
        !/\.(?:astro|json|mjs|sql|ts|tsx)$/iu.test(entry.name) ||
        /(?:\.test\.|\.spec\.)/iu.test(entry.name)
      ) {
        continue;
      }
      files.push({
        path: relative(ROOT, absolutePath),
        source: readFileSync(absolutePath, 'utf8'),
      });
    }
  };
  visit(absoluteDirectory);
  return files.sort((left, right) => left.path.localeCompare(right.path));
};

const workerFiles = walk('apps/worker/src');
const webFiles = walk('apps/web/src');
const contractFiles = walk('packages/contracts/src');
const migrationFiles = walk('supabase/migrations');
const implementationFiles = [
  ...workerFiles,
  ...webFiles,
  ...contractFiles,
  ...migrationFiles,
];
const contractSurface = [...contractFiles, ...workerFiles];
const s09MigrationSource = migrationFiles
  .filter(({ source }) =>
    /CMS-03A|P2-S09|cms_create_type_draft|cms_content_types/iu.test(source),
  )
  .map(({ source }) => source)
  .join('\n');

const phasePlan = readFileSync(
  resolve(ROOT, '.memory/wiki/specs/phases/phase-2.md'),
  'utf8',
);
const sliceTracker = readFileSync(
  resolve(ROOT, '.memory/pipeline/progress/slices/phase-02-slice-09.md'),
  'utf8',
);
const implementationEvidence = readFileSync(
  resolve(ROOT, '.memory/wiki/operations/runbooks/content-schema-registry.md'),
  'utf8',
);

const expectedRoutes = [
  ['CMS-03A-01', 'POST', '/api/v1/cms/content-types'],
  [
    'CMS-03A-02',
    'POST',
    '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/fields',
  ],
  [
    'CMS-03A-03',
    'POST',
    '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/relations',
  ],
  [
    'CMS-03A-04',
    'POST',
    '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/activate',
  ],
  ['CMS-03A-05', 'POST', '/api/v1/cms/blocks/versions'],
  ['CMS-03A-06', 'GET', '/api/v1/cms/content-types'],
  [
    'CMS-03A-07',
    'GET',
    '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}',
  ],
  [
    'CMS-03A-08',
    'POST',
    '/api/v1/cms/blocks/versions/{blockDefinitionVersionId}/lifecycle',
  ],
] as const;

const expectedTables = [
  'cms_content_types',
  'cms_content_type_versions',
  'cms_content_type_template_bindings',
  'cms_content_type_capability_bindings',
  'cms_field_definition_versions',
  'cms_relation_definitions',
  'cms_schema_migration_plans',
  'cms_schema_artifacts',
  'cms_schema_dry_run_reports',
  'cms_block_definition_versions',
  'cms_release_nonce_receipts',
  'cms_block_definition_lifecycle_events',
] as const;

const expectedRpcs = [
  'cms_create_type_draft',
  'cms_add_field_definition',
  'cms_bind_relation',
  'cms_activate_schema',
  'cms_register_block',
  'cms_advance_block_lifecycle',
  'cms_list_content_types',
  'cms_get_content_type_version',
] as const;

const expectedWorkerRpcs = [
  'cms_get_schema_migration_plan',
  'cms_claim_schema_migration_lease',
  'cms_heartbeat_schema_migration_lease',
  'cms_process_schema_migration_dry_run_batch',
  'cms_finalize_schema_migration_dry_run',
  'cms_process_schema_migration_batch',
  'cms_begin_schema_migration_verification',
  'cms_verify_schema_migration',
  'cms_complete_schema_migration',
  'cms_activate_schema_migration',
  'cms_reconcile_schema_activation',
  'cms_rollback_schema_migration',
  'cms_claim_schema_migration_event',
  'cms_release_schema_migration_event',
  'cms_acknowledge_schema_migration_event',
  'cms_dead_letter_schema_migration_event',
] as const;

const acceptanceIds = (source: string): string[] =>
  [...source.matchAll(/P2-S09-AC-(\d{3})/gu)].map(
    (match) => `P2-S09-AC-${match[1]}`,
  );

const distinctSorted = (values: readonly string[]): string[] =>
  [...new Set(values)].sort();

const sourceWithMarker = (
  files: readonly SourceFile[],
  marker: string,
): SourceFile | undefined =>
  files.find(({ source }) => source.includes(marker));

const markerWindow = (
  source: string,
  marker: string,
  width = 6_000,
): string => {
  const markerIndex = source.indexOf(marker);
  return markerIndex < 0 ? '' : source.slice(markerIndex, markerIndex + width);
};

const hasRouteDeclaration = (
  source: string,
  operationId: string,
  method: string,
  path: string,
): boolean => {
  const operationPattern = new RegExp(operationId, 'gu');
  return [...source.matchAll(operationPattern)].some(({ index }) => {
    if (index === undefined) return false;
    const window = source.slice(Math.max(0, index - 2_000), index + 2_000);
    return window.includes(method) && window.includes(path);
  });
};

describe('Phase 2 Slice 09 cross-surface traceability', () => {
  it('[P2-S09-AC-018, P2-S09-AC-019] exposes exactly A01-A08 with the locked method/path pairs', () => {
    const routeEvidence = implementationFiles.map(({ source }) => source);
    const operationIds = distinctSorted(
      routeEvidence.flatMap((source) =>
        [...source.matchAll(/CMS-03A-0[1-8]/gu)].map(([operationId]) =>
          String(operationId),
        ),
      ),
    );
    const expectedIds = distinctSorted(expectedRoutes.map(([id]) => id));
    expect(operationIds).toEqual(expectedIds);

    const missingRoutes = expectedRoutes
      .filter(
        ([operationId, method, path]) =>
          !routeEvidence.some((source) =>
            hasRouteDeclaration(source, operationId, method, path),
          ),
      )
      .map(([operationId, method, path]) => `${operationId} ${method} ${path}`);
    expect(missingRoutes).toEqual([]);
  });

  it('[P2-S09-AC-056, P2-S09-AC-068, P2-S09-AC-085, P2-S09-AC-093, P2-S09-AC-279] keeps migrationPlanId required and nullable in field and activation contracts', () => {
    for (const marker of [
      'FieldSchemaChangeRequest',
      'SchemaActivationRequest',
    ]) {
      const sourceFile = sourceWithMarker(contractSurface, marker);
      expect(sourceFile, `Missing ${marker} source contract`).toBeDefined();
      const window = markerWindow(sourceFile?.source ?? '', marker);
      const migrationOccurrences = [
        ...window.matchAll(/migrationPlanId[\s\S]{0,220}/gu),
      ].map(([match]) => match);
      expect(
        migrationOccurrences.length,
        `${marker} migrationPlanId`,
      ).toBeGreaterThan(0);
      expect(
        migrationOccurrences.some(
          (occurrence) =>
            /nullable|z\.null\(\)|null\s*\]/iu.test(occurrence) &&
            !/\.optional\s*\(/iu.test(occurrence),
        ),
        `${marker} migrationPlanId must be required nullable`,
      ).toBe(true);
    }
  });

  it('[P2-S09-AC-015, P2-S09-AC-122, P2-S09-AC-278] keeps browser resource states closed and aligned with the worker contracts', () => {
    const stateResources = [
      [
        'ContentTypeVersionResource',
        [
          'draft',
          'review',
          'approved',
          'scheduled',
          'active',
          'superseded',
          'retired',
          'blocked',
        ],
      ],
      [
        'BlockDefinitionRegistryRecord',
        ['supported', 'deprecated', 'withdrawn'],
      ],
      ['SchemaArtifactResource', ['compiled']],
    ] as const;
    for (const [marker, states] of stateResources) {
      const sourceFile = sourceWithMarker(
        contractSurface,
        `export const ${marker}Schema`,
      );
      expect(sourceFile, `Missing ${marker} contract`).toBeDefined();
      const resourceSource = sourceFile?.source ?? '';
      const referencedSchemas = [
        ...resourceSource.matchAll(/\b(Cms[A-Za-z0-9]+Schema)\b/gu),
      ].map(([, schemaName]) => schemaName);
      const window = [
        resourceSource,
        ...contractSurface
          .filter(({ source }) =>
            referencedSchemas.some((schemaName) =>
              source.includes(`export const ${schemaName}`),
            ),
          )
          .map(({ source }) => source),
      ].join('\n');
      for (const state of states) {
        expect(
          new RegExp(`(?:['"]|\\b)${state}(?:['"]|\\b)`, 'u').test(window),
          `${marker} missing closed state ${state}`,
        ).toBe(true);
      }
      expect(window).toMatch(/(?:z\.enum|as const|literal|union)/iu);
    }
  });

  it('[P2-S09-AC-165, P2-S09-AC-180] keeps the twelve canonical tables and eight named RPCs in the S09 migration', () => {
    const tableNames = distinctSorted(
      [
        ...s09MigrationSource.matchAll(
          /(?:create\s+table|alter\s+table)\s+(?:if\s+not\s+exists\s+)?(?:[a-z0-9_]+\.)?["']?(cms_[a-z0-9_]+)["']?/giu,
        ),
      ].map(([, name]) => name),
    );
    expect(tableNames).toEqual(distinctSorted([...expectedTables]));

    const rpcNames = distinctSorted(
      [
        ...s09MigrationSource.matchAll(
          /create\s+(?:or\s+replace\s+)?function\s+platform_api\.["']?(cms_[a-z0-9_]+)["']?\s*\(/giu,
        ),
      ].map(([, name]) => name),
    );
    expect(rpcNames).toEqual(
      distinctSorted([...expectedRpcs, ...expectedWorkerRpcs]),
    );

    const authenticatedGrantSource = [
      ...s09MigrationSource.matchAll(
        /grant\s+execute\s+on\s+function([\s\S]*?)to\s+authenticated\s*,\s*service_role\s*;/giu,
      ),
    ]
      .map(([, functions]) => functions)
      .join('\n');
    const authenticatedRpcNames = distinctSorted(
      [
        ...authenticatedGrantSource.matchAll(
          /platform_api\.["']?(cms_[a-z0-9_]+)["']?\s*\(/giu,
        ),
      ].map(([, name]) => name),
    );
    expect(authenticatedRpcNames).toEqual(distinctSorted([...expectedRpcs]));
  });

  it('[P2-S09-AC-267, P2-S09-AC-269, P2-S09-AC-273, P2-S09-AC-275] keeps the phase plan, tracker, runbook, and source anchors traceable', () => {
    const expectedIds = Array.from(
      { length: 283 },
      (_, index) => `P2-S09-AC-${String(index + 1).padStart(3, '0')}`,
    );
    expect(distinctSorted(acceptanceIds(phasePlan))).toEqual(expectedIds);
    expect(distinctSorted(acceptanceIds(sliceTracker))).toEqual(expectedIds);
    expect(implementationEvidence).toMatch(/CMS-03A-01[\s\S]*CMS-03A-08/iu);
    expect(implementationEvidence).toMatch(/twelve private registry tables/iu);
    expect(implementationEvidence).toMatch(/eight named .*RPCs/iu);

    const sourceRows = [
      ['P2-S09-AC-018', 'BE03a', 'Route Registry'],
      ['P2-S09-AC-068', 'BE03a', 'Request/Response Contracts'],
      ['P2-S09-AC-165', 'BE03a', 'Database Schema'],
      ['P2-S09-AC-223', 'FE03', 'Data Mapping'],
      ['P2-S09-AC-259', 'FE03', 'Data Mapping'],
      ['P2-S09-AC-267', 'Engineering Standards', 'Tests'],
    ] as const;
    for (const [criterion, source, section] of sourceRows) {
      const row = `${phasePlan}\n${sliceTracker}`.match(
        new RegExp(`${criterion}[^\\n]*`, 'u'),
      )?.[0];
      expect(row, `${criterion} source row`).toBeDefined();
      expect(row).toContain(`[${source}]`);
      expect(row).toContain(section);
    }
  });

  it('[P2-S09-AC-267] separates the 283 authored IDs from the 279-item active completion policy', () => {
    expect(distinctSorted(acceptanceIds(sliceTracker))).toHaveLength(283);
    expect(sliceTracker).toMatch(
      /\*\*Acceptance criteria \(authored\)\*\*:\s*283\b/iu,
    );
    expect(sliceTracker).toMatch(
      /\*\*Active release denominator\*\*:\s*279\b/iu,
    );
    expect(sliceTracker).toMatch(
      /\*\*Slice 09 implementation-completion denominator\*\*:\s*279\b/iu,
    );
    expect(sliceTracker).toMatch(
      /\*\*Local QA-GREEN \(active\)\*\*:\s*279\/279\s+verified;\s*283\s+authored IDs remain/iu,
    );

    const ac266Row = sliceTracker
      .split(/\r?\n/u)
      .find((line) => /P2-S09-AC-266/iu.test(line));
    expect(ac266Row).toMatch(/^\s*-\s*\[ \]/u);
    expect(sliceTracker).toMatch(
      /AC266[\s\S]{0,500}owner-deferred[\s\S]{0,500}remains unchecked and excluded from active Phase 2/iu,
    );
    expect(sliceTracker).toMatch(
      /Slice 10 implementation prerequisites\*\*:\s*none\b/iu,
    );
    expect(sliceTracker).toMatch(
      /AC266[\s\S]{0,300}mandatory[\s\S]{0,100}pre-release[\s\S]{0,100}production-readiness\/release/iu,
    );
  });
});
