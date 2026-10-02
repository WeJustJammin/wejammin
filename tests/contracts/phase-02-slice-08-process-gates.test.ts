import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');

const readSource = (relativePath: string): string => {
  try {
    return readFileSync(resolve(ROOT, relativePath), 'utf8');
  } catch {
    return '';
  }
};

const readTreeSource = (
  relativePath: string,
  includeStructuralTests = true,
): string => {
  const absolutePath = resolve(ROOT, relativePath);
  if (!existsSync(absolutePath)) return '';
  try {
    const entries = readdirSync(absolutePath, { withFileTypes: true });
    return entries
      .filter(
        (entry) =>
          includeStructuralTests ||
          !/(?:traceability|depth-audit|process-gates)/iu.test(entry.name),
      )
      .map((entry) =>
        readTreeSource(
          resolve(relativePath, entry.name),
          includeStructuralTests,
        ),
      )
      .join('\n');
  } catch {
    return readSource(relativePath);
  }
};

const sliceProgress = readSource(
  '.memory/pipeline/progress/slices/phase-02-slice-08.md',
);
const phaseProgress = readSource(
  '.memory/pipeline/progress/phases/phase-02.md',
);
const implementationSources = [
  'apps/web/src/pages/app/platform-configuration-admin/index.astro',
  'apps/web/src/components/platform-configuration/AdminWorkspaceOperationsWorkbench.tsx',
  'apps/web/src/components/platform-configuration/CapabilityGate.tsx',
  'apps/web/src/components/platform-configuration/AdminWorkspaceActiveView.tsx',
  'apps/web/src/components/platform-configuration/AdminWorkspaceActionViews.tsx',
  'apps/web/src/server/platform-configuration-platform-api.ts',
  'apps/worker/src/index.ts',
  'apps/worker/src/worker-route-composition.ts',
  'apps/worker/src/platform-configuration/routes.ts',
  'apps/worker/src/platform-configuration/route-runtime.ts',
  'apps/worker/src/platform-configuration/route-support.ts',
]
  .map(readTreeSource)
  .join('\n');
const evidenceSources = [
  'tests/contracts',
  'tests/integration',
  'tests/accessibility',
  'tests/e2e',
  'apps/worker/src',
  'apps/web/src',
  'packages/contracts/src',
  'supabase/tests',
];

describe('Phase 2 Slice 08 completion-boundary RED evidence', () => {
  it('keeps Contract → QA-RED → implementation → QA-GREEN → tracking as an ordered gate', () => {
    const labels = [
      'Contract:',
      'QA` RED',
      'BE` data',
      'FE` Astro',
      'QA` GREEN',
      'Documentation, runbooks, graph, feature ledger, and progress tracking',
    ];
    const positions = labels.map((label) => sliceProgress.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual(
      [...positions].sort((left, right) => left - right),
    );
    if (/\*\*Status\*\*:\s*complete/iu.test(sliceProgress)) {
      expect(phaseProgress).toMatch(
        /Slice 08[\s\S]{0,180}(?:complete|51\/51)/iu,
      );
      expect(phaseProgress).toMatch(
        /09 Content schemas, relations, activation, and block registry[\s\S]{0,180}(?:not started|in.progress|blocked|complete|\d+\/\d+\s+active\s+\(\d+\s+authored\))/iu,
      );
    } else {
      expect(phaseProgress).toMatch(
        /Current gate.*Slice 08.*(?:Contract.*QA.*RED|QA.*GREEN)/isu,
      );
    }
  });

  it('requires active CFG-05B-01, CFG-05B-04, and CFG-05B-05 evidence', () => {
    const missingActive = ['CFG-05B-01', 'CFG-05B-04', 'CFG-05B-05'].filter(
      (operation) => !implementationSources.includes(operation),
    );
    expect(
      missingActive,
      `Active Slice 08 operation boundary is absent: ${missingActive.join(', ')}`,
    ).toEqual([]);
  });

  it('keeps CFG-05B-02 search and CFG-05B-03 bulk operations explicitly deferred', () => {
    const evidence = evidenceSources
      .map((relativePath) => readTreeSource(relativePath, false))
      .join('\n');
    expect(evidence).toMatch(
      /(?:CFG-05B-02[\s\S]{0,300}(?:defer|reserved|out.of.scope)|(?:defer|reserved|out.of.scope)[\s\S]{0,300}CFG-05B-02)/iu,
    );
    expect(evidence).toMatch(
      /(?:CFG-05B-03[\s\S]{0,300}(?:defer|reserved|out.of.scope)|(?:defer|reserved|out.of.scope)[\s\S]{0,300}CFG-05B-03)/iu,
    );
    expect(implementationSources).not.toMatch(
      /\/api\/v1\/admin\/(?:search|bulk-operations)/iu,
    );
  });

  it('requires capability-filtered SSR and server-authoritative decisions', () => {
    expect(implementationSources).toMatch(
      /capabilit|server.author|authorized|authority|hidden|not.rendered/iu,
    );
    expect(implementationSources).toMatch(
      /PlatformConfigurationAdminRoute|AdminWorkspaceOperationsWorkbench/iu,
    );
  });

  it('requires final tracking, runbook, ledger, and architecture evidence', () => {
    const finalEvidence = [
      {
        name: 'slice tracking',
        source: sliceProgress,
        pattern: /P2-S08-AC-051.*\[x\]|Status.*complete|51\/51/isu,
      },
      {
        name: 'phase tracking',
        source: phaseProgress,
        pattern: /Slice 08[\s\S]{0,160}(?:complete|51\/51)/iu,
      },
      {
        name: 'runbook',
        source: readSource(
          '.memory/wiki/operations/runbooks/platform-configuration.md',
        ),
        pattern: /CFG-05B-01/iu,
      },
      {
        name: 'feature ledger',
        source: readSource('.memory/wiki/specs/feature-ledger.md'),
        pattern: /P2-S08|CFG-05B/iu,
      },
      {
        name: 'architecture map',
        source: readSource('docs/ARCHITECTURE.md'),
        pattern: /Slice 08/iu,
      },
    ];
    const missing = finalEvidence
      .filter(({ source, pattern }) => !pattern.test(source))
      .map(({ name }) => name);
    const runbook =
      finalEvidence.find(({ name }) => name === 'runbook')?.source ?? '';
    const ledger =
      finalEvidence.find(({ name }) => name === 'feature ledger')?.source ?? '';
    const missingActiveDocs = [
      ['runbook', runbook],
      ['feature ledger', ledger],
    ].flatMap(([name, source]) =>
      ['CFG-05B-01', 'CFG-05B-04', 'CFG-05B-05']
        .filter((operation) => !source.includes(operation))
        .map((operation) => `${name}:${operation}`),
    );
    expect(
      [...missing, ...missingActiveDocs],
      `Missing final Slice 08 evidence: ${[...missing, ...missingActiveDocs].join(', ')}`,
    ).toEqual([]);
  });
});
