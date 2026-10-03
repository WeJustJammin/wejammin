import { holders, replayExecuteAcl } from './phase-02-slice-09-pre-acl-replay';
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
  .filter(({ source }) => /CMS-03A|P2-S09|cms_create_type_draft/iu.test(source))
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

const expectedAmendmentRoutes = [
  [
    'CMS-03A-09',
    'POST',
    '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/successors',
  ],
  [
    'CMS-03A-10',
    'POST',
    '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/dry-runs',
  ],
  [
    'CMS-03A-11',
    'POST',
    '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/reviews',
  ],
  ['CMS-03A-12', 'POST', '/api/v1/cms/schema-reviews/{reviewId}/decisions'],
  ['CMS-03A-13', 'GET', '/api/v1/cms/schema-reviews/{reviewId}'],
  ['CMS-03A-14', 'POST', '/api/v1/cms/schema-reviews/{reviewId}/assignments'],
  ['CMS-03A-15', 'POST', '/api/v1/cms/capability-grants'],
  ['CMS-03A-16', 'POST', '/api/v1/cms/capability-grants/{grantId}/renewals'],
  ['CMS-03A-17', 'POST', '/api/v1/cms/capability-grants/{grantId}/revocations'],
  ['CMS-03A-18', 'GET', '/api/v1/cms/capability-grants'],
] as const;

const expectedAmendmentTables = [
  'cms_schema_reviews',
  'cms_schema_review_decisions',
  'cms_schema_review_assignments',
  'cms_schema_dry_run_row_evidence',
  'cms_capability_grants',
  'cms_capability_grant_events',
  'cms_workflow_policies',
] as const;

// Supporting objects that later forward migrations in the same slice extend
// (locale variant scan rows, operational alert codes and snapshot, locale
// configuration validator). They are not part of the BE03a amendment surface
// that carries forced-RLS and grant assertions, only of the closed-world check.
const expectedSupportingTables = [
  'cms_schema_migration_target_rows',
  'cms_operational_alert_deliveries',
] as const;
const expectedSupportingRpcs = [
  'cms_claim_operational_alert',
  // DEC-122 R3 ruling for AC1135: scheduled eager invalidation of reviews whose
  // counted decision relied on a specialist capability or assignment that expired.
  'cms_sweep_expired_review_authority',
  'cms_get_operational_state_snapshot',
  'cms_validate_locale_config',
] as const;

const expectedAmendmentRpcs = [
  'cms_create_schema_successor',
  'cms_start_schema_dry_run',
  'cms_submit_schema_review',
  'cms_decide_schema_review',
  'cms_get_schema_review',
  'cms_assign_schema_review',
  'cms_grant_capability',
  'cms_renew_capability_grant',
  'cms_revoke_capability_grant',
  'cms_list_capability_grants',
  'cms_resolve_template_compatibility',
] as const;

const amendmentMigrationSource = migrationFiles
  .filter(({ source }) => /\bcms_[a-z_]+/iu.test(source))
  .map(({ source }) => source)
  .join('\n');

const expectForcedRls = (tables: readonly string[]): void => {
  const tableNames = distinctSorted(
    [
      ...amendmentMigrationSource.matchAll(
        /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:[a-z0-9_]+\.)?["']?(cms_[a-z0-9_]+)["']?/giu,
      ),
    ].map(([, name]) => name),
  );
  expect(tableNames).toEqual(
    expect.arrayContaining(distinctSorted([...tables])),
  );
  for (const table of tables) {
    const creator = migrationFiles.find(({ source }) =>
      new RegExp(`create\\s+table[^;]*\\b${table}\\b`, 'iu').test(source),
    );
    expect(creator, `${table} must be created by a migration`).toBeDefined();
    expect(creator?.source ?? '', `${table} must enable RLS`).toMatch(
      /enable\s+row\s+level\s+security/iu,
    );
    expect(creator?.source ?? '', `${table} must force RLS`).toMatch(
      /force\s+row\s+level\s+security/iu,
    );
  }
};

const acceptanceIds = (source: string): string[] =>
  [...source.matchAll(/P2-S09-AC-(\d{3,4})/gu)].map(
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
  it('[P2-S09-AC-018] keeps the original A01-A08 operations with the locked method/path pairs', () => {
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

  it('[P2-S09-AC-165, P2-S09-AC-180] keeps the twelve original canonical tables and eight original named RPCs in the S09 migration', () => {
    const tableNames = distinctSorted(
      [
        ...s09MigrationSource.matchAll(
          /(?:create\s+table|alter\s+table)\s+(?:if\s+not\s+exists\s+)?(?:[a-z0-9_]+\.)?["']?(cms_[a-z0-9_]+)["']?/giu,
        ),
      ].map(([, name]) => name),
    );
    expect(tableNames).toEqual(
      expect.arrayContaining(distinctSorted([...expectedTables])),
    );
    expect(
      tableNames.filter(
        (name) =>
          !(expectedTables as readonly string[]).includes(name) &&
          !(expectedAmendmentTables as readonly string[]).includes(name) &&
          !(expectedSupportingTables as readonly string[]).includes(name),
      ),
    ).toEqual([]);

    const rpcNames = distinctSorted(
      [
        ...s09MigrationSource.matchAll(
          /create\s+(?:or\s+replace\s+)?function\s+platform_api\.["']?(cms_[a-z0-9_]+)["']?\s*\(/giu,
        ),
      ].map(([, name]) => name),
    );
    expect(rpcNames).toEqual(
      expect.arrayContaining(
        distinctSorted([...expectedRpcs, ...expectedWorkerRpcs]),
      ),
    );
    expect(
      rpcNames.filter(
        (name) =>
          ![...expectedRpcs, ...expectedWorkerRpcs].includes(
            name as (typeof expectedRpcs)[number],
          ) &&
          !(expectedAmendmentRpcs as readonly string[]).includes(name) &&
          !(expectedSupportingRpcs as readonly string[]).includes(name),
      ),
    ).toEqual([]);

    // Effective grants come from replaying every GRANT and REVOKE in migration
    // order (see phase-02-slice-09-pre-acl-replay.ts): a grant that a later
    // statement revokes is never counted, which a text match over one
    // migration cannot tell.
    expect(holders(replayExecuteAcl(), 'authenticated')).toEqual([
      'cms_add_field_definition',
      'cms_bind_relation',
      'cms_create_type_draft',
      'cms_get_content_type_version',
      'cms_list_content_types',
    ]);
  });

  it('[P2-S09-AC-267, P2-S09-AC-269, P2-S09-AC-273, P2-S09-AC-275] keeps the phase plan, tracker, runbook, and source anchors traceable', () => {
    const expectedIds = Array.from(
      { length: 1239 },
      (_, index) => `P2-S09-AC-${String(index + 1).padStart(3, '0')}`,
    ).sort();
    expect(distinctSorted(acceptanceIds(phasePlan))).toEqual(expectedIds);
    expect(distinctSorted(acceptanceIds(sliceTracker))).toEqual(expectedIds);
    expect(implementationEvidence).toMatch(/CMS-03A-01[\s\S]*CMS-03A-18/iu);
    expect(implementationEvidence).toMatch(
      /nineteen private registry tables/iu,
    );
    expect(implementationEvidence).toMatch(/eighteen named .*RPCs/iu);

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

  it('[P2-S09-AC-267] separates the 1239 authored IDs from the 1235-item active completion policy after the 2026-09-30 activation, AC250 and 2026-10-02 DEC-108 reopens', () => {
    expect(distinctSorted(acceptanceIds(sliceTracker))).toHaveLength(1239);
    expect(sliceTracker).toMatch(
      /\*\*Acceptance criteria \(authored\)\*\*:\s*1239\b/iu,
    );
    expect(sliceTracker).toMatch(
      /\*\*Active release denominator\*\*:\s*1235\b/iu,
    );
    expect(sliceTracker).toMatch(
      /\*\*Slice 09 implementation-completion denominator\*\*:\s*1235\b/iu,
    );
    expect(sliceTracker).toMatch(
      /\*\*Local QA-GREEN \(historical, 2026-09-26\)\*\*:\s*279\/279\s+verified at that checkpoint;\s*283\s+authored IDs remain/iu,
    );
    expect(sliceTracker).toMatch(
      /\*\*Current active verification\*\*:\s*1235\/1235\s+verified;\s*17\s+CMS-03A-04 activation-chain criteria reopened 2026-09-30,\s*plus AC250 separately reopened 2026-09-30 and Chrome-reverified and closed 2026-10-01/iu,
    );

    const ac266Row = sliceTracker
      .split(/\r?\n/u)
      .find((line) => /P2-S09-AC-266/iu.test(line));
    expect(ac266Row).toMatch(/^\s*-\s*\[ \]/u);
    expect(sliceTracker).toMatch(
      /AC266[\s\S]{0,500}owner-deferred[\s\S]{0,500}remains unchecked and excluded from active Phase 2/iu,
    );
    expect(sliceTracker).toMatch(
      /Slice 10 implementation prerequisites\*\*:\s*completion of the amended Slice 09 activation criteria:\s*the 17 reopened activation-chain criteria,\s*AC019, AC039, AC043, AC054, AC100, AC143, AC181, AC196, AC215, AC222, AC259, AC264 and AC273 reopened under the DEC-108 accounting,\s*and the 956 open DEC-108\/109\/110\/111\/119\/120 criteria AC284-AC1239;\s*AC250 is separately verified and no longer blocking;\s*AC265 remains a separate pre-release gate/iu,
    );
    expect(sliceTracker).toMatch(
      /AC266[\s\S]{0,300}mandatory[\s\S]{0,100}pre-release[\s\S]{0,100}production-readiness\/release/iu,
    );
  });

  it('[P2-S09-AC-284, P2-S09-AC-019] exposes exactly CMS-03A-01 through CMS-03A-18 with the locked method/path pairs', () => {
    const routeEvidence = implementationFiles.map(({ source }) => source);
    const operationIds = distinctSorted(
      routeEvidence.flatMap((source) =>
        [...source.matchAll(/CMS-03A-(?:0[1-9]|1\d)/gu)].map(([operationId]) =>
          String(operationId),
        ),
      ),
    );
    expect(operationIds).toEqual(
      distinctSorted(
        [...expectedRoutes, ...expectedAmendmentRoutes].map(([id]) => id),
      ),
    );
    const missingRoutes = expectedAmendmentRoutes
      .filter(
        ([operationId, method, path]) =>
          !routeEvidence.some((source) =>
            hasRouteDeclaration(source, operationId, method, path),
          ),
      )
      .map(([operationId, method, path]) => `${operationId} ${method} ${path}`);
    expect(missingRoutes).toEqual([]);
  });

  it('[P2-S09-AC-686] creates cms_workflow_policies with forced RLS', () => {
    expectForcedRls(['cms_workflow_policies']);
  });

  it('[P2-S09-AC-181] creates the review, row-evidence and capability-grant tables with forced RLS', () => {
    expectForcedRls(
      expectedAmendmentTables.filter(
        (table) => table !== 'cms_workflow_policies',
      ),
    );
  });

  it('[P2-S09-AC-685] exposes the eighteen named registry RPCs plus the service-only template resolver', () => {
    const rpcNames = distinctSorted(
      [
        ...amendmentMigrationSource.matchAll(
          /create\s+(?:or\s+replace\s+)?function\s+platform_api\.["']?(cms_[a-z0-9_]+)["']?\s*\(/giu,
        ),
      ].map(([, name]) => name),
    );
    expect(rpcNames).toEqual(
      expect.arrayContaining(
        distinctSorted([...expectedRpcs, ...expectedAmendmentRpcs]),
      ),
    );
  });
});
