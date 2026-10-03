import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BlockLifecycleAdvanceRequestSchema } from '@wejammin/contracts';

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

// Comments carry prose about status codes; only executable code can reserve a code.
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');

const workerFiles = walk('apps/worker/src');
const webFiles = walk('apps/web/src');
const migrationFiles = walk('supabase/migrations');
const webCmsFiles = webFiles.filter(({ source }) =>
  /CMS-03A|ContentSchemaRegistry|cms\/content-types|schema-registry/iu.test(
    source,
  ),
);
const webCmsSource = webCmsFiles.map(({ source }) => source).join('\n');
const releaseWorkerSource = workerFiles
  .filter(({ source }) =>
    /CMS-03A-05|CMS-03A-08|cms\/blocks\/versions|release\.block_registry\.write/iu.test(
      source,
    ),
  )
  .map(({ source }) => source)
  .join('\n');
const contractsLifecycleSource = readFileSync(
  resolve(
    ROOT,
    'packages/contracts/src/content-schema-registry/resources-blocks.ts',
  ),
  'utf8',
);
const admissionSchemasSource =
  workerFiles.find(({ path }) =>
    path.endsWith('/content-schema-registry/admission-schemas.ts'),
  )?.source ?? '';
const releaseHandlerSource =
  workerFiles.find(({ path }) =>
    path.endsWith('/content-schema-registry/route-release-handler.ts'),
  )?.source ?? '';
const releaseAdmissionSource =
  workerFiles.find(({ path }) =>
    path.endsWith('/content-schema-registry/admission-release.ts'),
  )?.source ?? '';
const signedContractSource = [...workerFiles]
  .filter(({ source }) =>
    /CMS-03A|P2-S09|cms\/blocks\/versions|cms_block_definition_versions/iu.test(
      source,
    ),
  )
  .map(({ source }) => stripComments(source))
  .join('\n');
const s09MigrationSource = migrationFiles
  .filter(({ source }) =>
    /CMS-03A|P2-S09|cms_create_type_draft|cms_content_types/iu.test(source),
  )
  .map(({ source }) => source)
  .join('\n');

const expectedReleaseHeaders = [
  'X-WeJammin-Release-Key-Id',
  'X-WeJammin-Release-Issued-At',
  'X-WeJammin-Release-Nonce',
  'X-WeJammin-Release-Signature',
] as const;

const workerEvidenceFields = [
  'ownerId',
  'owner_id',
  'propsSchemaSnapshot',
  'propsSnapshotAttestation',
  'releaseKeyId',
  'releasePrincipalId',
  'releaseRawBodyHash',
  'releaseSignatureHash',
  'releaseNonceHash',
  'releaseVerifiedAt',
  'rawBody',
  'signature',
  'nonce',
] as const;

describe('Phase 2 Slice 09 release and browser security boundaries', () => {
  it('[P2-S09-AC-117] [P2-S09-AC-120] [P2-S09-AC-164] [P2-S09-AC-281] gates A05 and A08 behind signed release-worker admission', () => {
    expect(releaseWorkerSource).not.toBe('');
    expect(releaseWorkerSource).toMatch(/CMS-03A-05/iu);
    expect(releaseWorkerSource).toMatch(/CMS-03A-08/iu);
    expect(releaseWorkerSource).toMatch(/release\.block_registry\.write/iu);
    for (const header of expectedReleaseHeaders) {
      expect(
        releaseWorkerSource,
        `missing exact release header ${header}`,
      ).toContain(header);
    }
    expect(releaseWorkerSource).toMatch(/raw.?body/iu);
    expect(releaseWorkerSource).toMatch(/signature/iu);
    expect(releaseWorkerSource).toMatch(/nonce/iu);
    const rawBodyReadIndex = releaseAdmissionSource.indexOf('readBytes(');
    const verificationIndex = releaseAdmissionSource.indexOf(
      'dependencies.verifyRelease',
    );
    expect(rawBodyReadIndex).toBeGreaterThanOrEqual(0);
    expect(verificationIndex).toBeGreaterThan(rawBodyReadIndex);
    expect(
      releaseAdmissionSource.slice(rawBodyReadIndex, verificationIndex),
    ).not.toMatch(/JSON\.parse|\.json\s*\(/u);
  });

  it('[P2-S09-AC-135] [P2-S09-AC-200] reserves WEBHOOK_REJECTED for the exact 401 release-principal/signature boundary', () => {
    const occurrences = [
      ...signedContractSource.matchAll(/WEBHOOK_REJECTED/gu),
    ];
    expect(occurrences.length).toBeGreaterThan(0);
    const invalidOccurrences = occurrences.flatMap(({ index }) => {
      if (index === undefined) return ['unknown occurrence'];
      const window = signedContractSource.slice(
        Math.max(0, index - 400),
        index + 400,
      );
      return /\b401\b/iu.test(window) &&
        !/(?:\b400\b|\b409\b|\b422\b)[\s\S]{0,180}WEBHOOK_REJECTED|WEBHOOK_REJECTED[\s\S]{0,180}(?:\b400\b|\b409\b|\b422\b)/iu.test(
          window,
        )
        ? []
        : [window];
    });
    expect(invalidOccurrences).toEqual([]);
    expect(webCmsSource).not.toContain('WEBHOOK_REJECTED');
  });

  it('[P2-S09-AC-156] [P2-S09-AC-158] [P2-S09-AC-159] [P2-S09-AC-163] persists durable nonce and append-only lifecycle evidence', () => {
    expect(s09MigrationSource).toMatch(/cms_release_nonce_receipts/iu);
    expect(s09MigrationSource).toMatch(
      /cms_block_definition_lifecycle_events/iu,
    );
    expect(s09MigrationSource).toMatch(
      /(?:unique|constraint)[\s\S]{0,500}release_key_id[\s\S]{0,160}nonce_hash/iu,
    );
    expect(s09MigrationSource).toMatch(/expires_at[\s\S]{0,300}10\s*minutes/iu);
    expect(s09MigrationSource).toMatch(
      /(?:append.only|immutable|rejects?\s+(?:update|delete)|trigger)/iu,
    );
    // The Worker no longer spells the event type or the lifecycle order; it
    // enforces both by parsing the generated contracts (route-release-handler.ts
    // parses through schemaForReleaseOperation -> BlockLifecycleAdvanceRequestSchema). Assert the contract itself.
    expect(releaseHandlerSource).toContain('schemaForReleaseOperation');
    expect(admissionSchemasSource).toMatch(
      /BlockLifecycleAdvanceRequestSchema/u,
    );
    const base = {
      expectedVersion: '1',
      releaseDigest: 'a'.repeat(64),
    };
    const accepted = (fromLifecycle: string, toLifecycle: string): boolean =>
      BlockLifecycleAdvanceRequestSchema.safeParse({
        ...base,
        fromLifecycle,
        toLifecycle,
      }).success;
    expect(accepted('supported', 'deprecated')).toBe(true);
    expect(accepted('deprecated', 'withdrawn')).toBe(true);
    expect(accepted('supported', 'withdrawn')).toBe(false);
    expect(accepted('withdrawn', 'deprecated')).toBe(false);
    expect(accepted('deprecated', 'supported')).toBe(false);
    expect(contractsLifecycleSource).toContain(
      "eventType: z.literal('cms.block.lifecycle.changed.v1')",
    );
  });

  it('[P2-S09-AC-123] [P2-S09-AC-259] [P2-S09-AC-260] keeps browser projections free of ownership and worker evidence', () => {
    expect(webCmsFiles.length).toBeGreaterThan(0);
    expect(webCmsSource).toMatch(
      /BlockDefinitionRegistryRecord|block_definition_registry_record/iu,
    );
    const leakedFields = workerEvidenceFields.filter((field) =>
      new RegExp(`\\b${field}\\b`, 'u').test(webCmsSource),
    );
    expect(leakedFields).toEqual([]);
  });

  it('[P2-S09-AC-222] [P2-S09-AC-223] [P2-S09-AC-257] [P2-S09-AC-258] keeps protected CMS UI free of release controls', () => {
    expect(webCmsSource).toMatch(/ContentSchemaRegistryWorkbench/iu);
    expect(webCmsSource).toMatch(/(?:protected|session|capabilit|auth)/iu);
    const releaseControls = [
      '/api/v1/cms/blocks/versions',
      'X-WeJammin-Release-',
      'BlockRegistrationRequest',
      'BlockLifecycleAdvanceRequest',
      'propsSnapshotAttestation',
      'releaseNonceHash',
      'releaseVerifiedAt',
      'WEBHOOK_REJECTED',
    ].filter((token) => webCmsSource.includes(token));
    expect(releaseControls).toEqual([]);
  });
});
