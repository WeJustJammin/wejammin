import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createE2EFixture } from '@wejammin/test-support';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const readRepositoryFile = (relativePath: string): string =>
  readFileSync(resolve(repositoryRoot, relativePath), 'utf8');

const readRepositoryJson = (relativePath: string): Record<string, unknown> =>
  JSON.parse(readRepositoryFile(relativePath)) as Record<string, unknown>;

const runNode = (relativePath: string, ...arguments_: string[]): string =>
  execFileSync(process.execPath, [relativePath, ...arguments_], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
  });

describe('validation toolchain contracts', () => {
  it('removes the color-environment conflict before Playwright launches children', async () => {
    const previousNoColor = process.env.NO_COLOR;
    const previousAstroBackground = process.env.ASTRO_DEV_BACKGROUND;

    try {
      process.env.NO_COLOR = '1';
      await import('../playwright.config');

      expect(process.env.NO_COLOR).toBeUndefined();
    } finally {
      if (previousNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = previousNoColor;
      }

      if (previousAstroBackground === undefined) {
        delete process.env.ASTRO_DEV_BACKGROUND;
      } else {
        process.env.ASTRO_DEV_BACKGROUND = previousAstroBackground;
      }
    }
  });

  it('declares each local test project and the managed E2E server boundary', () => {
    const vitest = readRepositoryFile('vitest.config.ts');
    const playwright = readRepositoryFile('playwright.config.ts');
    const s09RealPlaywright = readRepositoryFile(
      'playwright.s09-real.config.ts',
    );
    const s09RealRunner = readRepositoryFile(
      'tests/e2e/support/run-s09-real-suite.mjs',
    );
    const webAstro = readRepositoryFile('apps/web/astro.config.mjs');
    const ciWorkflow = readRepositoryFile('.github/workflows/ci.yml');
    const packageDocument = readRepositoryJson('package.json');
    const e2e = readRepositoryFile('tests/e2e/scaffold.spec.ts');
    const fixture = createE2EFixture();

    for (const projectPath of [
      'tests/contracts',
      'tests/integration',
      'tests/accessibility',
      'tests/performance',
      'tests/security',
    ]) {
      expect(existsSync(resolve(repositoryRoot, projectPath))).toBe(true);
    }
    for (const unitTest of [
      'packages/contracts/src/core-contracts.test.ts',
      'packages/observability/src/logging.test.ts',
    ]) {
      expect(existsSync(resolve(repositoryRoot, unitTest))).toBe(true);
    }

    expect(vitest).toContain("'tests/contracts/**/*.test.ts'");
    expect(vitest).toContain("'tests/integration/**/*.test.ts'");
    expect(vitest).toContain("'tests/accessibility/**/*.test.ts'");
    expect(vitest).toContain("'tests/performance/**/*.test.ts'");
    expect(vitest).toContain("'tests/security/**/*.test.ts'");
    expect(vitest).toContain('maxWorkers: process.env.CI ? 4 : 2');
    expect(vitest).toContain('testTimeout: 15_000');
    expect(playwright).toContain("testDir: './tests/e2e'");
    expect(playwright).toContain("name: 'chrome'");
    expect(playwright).toContain("channel: 'chrome'");
    expect(playwright).not.toContain('playwright install');
    expect(playwright).toContain('const ciRunId = process.env.GITHUB_RUN_ID;');
    expect(playwright).toContain('BigInt(ciRunId) % 10_000n');
    expect(playwright).toContain('30_000 + ciPortSlot * 2');
    expect(playwright).toContain('--port ${webPort}');
    expect(playwright).toContain('--port ${docsPort}');
    expect(playwright).toContain("WEJAMMIN_E2E_ISOLATED: '1'");
    expect(playwright).toContain('const cloudflareWebServerTimeout = 300_000;');
    expect(playwright).toContain('timeout: cloudflareWebServerTimeout');
    expect(playwright).toContain('metadata: { docsOrigin }');
    expect(playwright).toContain('baseURL: webOrigin');
    expect(playwright).toContain(
      "'phase-02-slice-09-content-schema-registry-performance.spec.ts'",
    );
    expect(playwright).toContain(
      `const webPort = ciPortSlot === undefined ? ${new URL(fixture.baseUrl).port}`,
    );
    expect(s09RealPlaywright).toContain(
      'const realRouteServerTimeout = 300_000;',
    );
    expect(s09RealPlaywright).toContain('timeout: realRouteServerTimeout');
    expect(s09RealPlaywright).toContain("trace: 'off'");
    // AC262: the registry performance spec runs in the production-built suite.
    expect(s09RealPlaywright).toContain(
      "'phase-02-slice-09-content-schema-registry-performance.spec.ts'",
    );
    expect(s09RealPlaywright).toContain("channel: 'chrome'");
    expect(s09RealRunner).toContain("'--config=playwright.s09-real.config.ts'");
    expect(s09RealRunner).toContain('runRealRouteWithRetry');
    expect(e2e).toContain("metadata['docsOrigin']");
    expect(e2e).not.toContain('http://127.0.0.1:4322');
    expect(webAstro).toContain("'GITHUB_RUN_ID' in runtimeEnvironment");
    expect(webAstro).toContain("'WEJAMMIN_E2E_ISOLATED' in runtimeEnvironment");
    expect(webAstro).toContain(
      "runtimeEnvironment.WEJAMMIN_E2E_ISOLATED === '1'",
    );
    expect(webAstro).toContain('inspectorPort: false');
    expect(webAstro).toContain('persistState: false');
    expect(webAstro).toContain(
      'devToolbar: { enabled: !isolateCloudflareDev }',
    );
    expect(webAstro).toContain("'react-dom/client'");
    expect(packageDocument.scripts).toMatchObject({
      'test:e2e': 'pnpm test:e2e:functional && pnpm test:e2e:s09-real',
      'test:e2e:functional': 'playwright test',
      'test:e2e:s09-real': 'node tests/e2e/support/run-s09-real-suite.mjs',
      'test:evidence:s09': expect.stringContaining(
        'phase-02-slice-09-evidence-map.test.ts',
      ),
    });
    expect(ciWorkflow).toContain(
      'run: pnpm test:coverage && pnpm test:evidence:s09',
    );
    expect(e2e).toContain(fixture.title);
    expect(e2e).toContain(fixture.heading);
    expect(e2e).toContain(fixture.statusText);
  });

  it(
    'keeps OpenAPI output generated from the contract authority',
    { timeout: 15_000 },
    () => {
      expect(() =>
        runNode('infra/generate-openapi.mjs', '--check'),
      ).not.toThrow();

      const document = readRepositoryJson('docs/openapi/openapi.json');
      const paths = document.paths;
      const components = document.components;

      expect(document.openapi).toBe('3.1.0');
      expect(paths).toMatchObject({
        '/api/v1/health': expect.any(Object),
        '/api/v1/ready': expect.any(Object),
        '/api/v1/internal/diagnostics': expect.any(Object),
      });
      expect(components).toMatchObject({
        schemas: expect.objectContaining({
          ApiError: expect.any(Object),
          HealthResponse: expect.any(Object),
          ReadinessResponse: expect.any(Object),
          RequestContext: expect.any(Object),
        }),
      });
      expect(JSON.stringify(document)).not.toMatch(/\{\{[^}]+\}\}/);
    },
  );

  it('keeps database type drift and generated artifact checks reviewable', () => {
    const syncTypes = readRepositoryFile('infra/sync-database-types.mjs');
    const databaseTypes = readRepositoryFile(
      'packages/data-access/src/database.types.ts',
    );
    const packageJson = readRepositoryJson('package.json');
    const scripts = packageJson.scripts as Record<string, string>;
    const ciWorkflow = readRepositoryFile('.github/workflows/ci.yml');
    const stagingWorkflow = readRepositoryFile(
      '.github/workflows/deploy-staging.yml',
    );
    const sliceProgress = readRepositoryFile(
      '.memory/pipeline/progress/slices/phase-01-slice-01.md',
    );

    expect(syncTypes).toContain('packages/data-access/src/database.types.ts');
    expect(syncTypes).toContain("process.argv.includes('--check')");
    expect(syncTypes).toContain('Generated database types are stale');
    expect(databaseTypes).toContain('export type Database');
    expect(
      existsSync(resolve(repositoryRoot, 'docs/openapi/openapi.json')),
    ).toBe(true);
    expect(
      existsSync(
        resolve(repositoryRoot, 'packages/data-access/src/database.types.ts'),
      ),
    ).toBe(true);
    expect(scripts).toMatchObject({
      'contracts:check': 'node infra/generate-openapi.mjs --check',
      'db:types:check': 'node infra/sync-database-types.mjs --check',
      'bundle:check': 'node scripts/verify-bundle-budget.mjs',
      'performance:smoke':
        'node infra/performance/api-p95-smoke.mjs --mode local',
    });
    expect(typeof scripts.validate).toBe('string');
    expect(scripts.validate).toContain('contracts:check');
    expect(scripts.validate).toContain('db:types:check');
    expect(scripts.validate).toContain('pnpm bundle:check');
    expect(scripts.validate).toContain('pnpm performance:smoke');
    expect(scripts.validate.indexOf('pnpm build')).toBeLessThan(
      scripts.validate.indexOf('pnpm bundle:check'),
    );
    expect(ciWorkflow).toContain('set -o pipefail');
    expect(ciWorkflow).toContain(
      'pnpm --silent bundle:check | tee performance-evidence/bundle-budget.json',
    );
    expect(ciWorkflow).toContain(
      'pnpm --silent performance:smoke | tee performance-evidence/api-p95-smoke.json',
    );
    expect(stagingWorkflow).toContain(
      'run: set -o pipefail; pnpm --silent performance:smoke:staging | tee promotion-candidate/api-p95-smoke.json',
    );

    const acceptanceIds = [...sliceProgress.matchAll(/P1-S01-AC-\d{3}/g)].map(
      (match) => match[0],
    );
    expect(new Set(acceptanceIds).size).toBe(24);
    expect(sliceProgress).toContain('**Spec depth floor**: 0');
    expect(sliceProgress).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('keeps streamed JSON parseable while propagating producer failure', () => {
    const root = mkdtempSync(join(tmpdir(), 'wejammin-json-evidence-'));
    const bin = join(root, 'bin');
    const evidencePath = join(root, 'evidence.json');

    try {
      mkdirSync(bin);
      const pnpm = join(bin, 'pnpm');
      writeFileSync(
        pnpm,
        [
          '#!/usr/bin/env bash',
          'set -euo pipefail',
          'printf \'{"passed":false}\\n\'',
          'test "$1" = "--silent" || printf \'[ELIFECYCLE] failed\\n\'',
          'exit 1',
        ].join('\n'),
      );
      chmodSync(pnpm, 0o700);

      const result = spawnSync(
        'bash',
        [
          '-c',
          'set -o pipefail; pnpm --silent performance:smoke | tee "$EVIDENCE_PATH"',
        ],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            EVIDENCE_PATH: evidencePath,
            PATH: `${bin}:${process.env.PATH ?? ''}`,
          },
        },
      );

      expect(result.status).toBe(1);
      const evidence = readFileSync(evidencePath, 'utf8');
      expect(JSON.parse(evidence)).toEqual({ passed: false });
      expect(evidence.trimEnd().split('\n')).toHaveLength(1);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('copies the executable Worker module to the immutable release-evidence path', () => {
    const workerPackageJson = readRepositoryJson('apps/worker/package.json');
    const workerScripts = workerPackageJson.scripts as Record<string, string>;

    expect(workerScripts.build).toContain('--outdir dist');
    expect(workerScripts.build).toContain(
      'cp dist/runtime-entry.js dist/index.js',
    );
    expect(workerScripts.build).not.toContain('--outfile');
  });
});
