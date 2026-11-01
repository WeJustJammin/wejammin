import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ROOT,
  read,
} from './phase-02-slice-09-amendment-evidence.test-support';
import {
  filesWhere,
  hasBoundaryMarker,
  hasLazyMarker,
} from './phase-02-slice-11-closeout.test-support';
import { S12_EVIDENCE_LEDGER } from './phase-02-slice-12-evidence-ledger';

/**
 * Guard for P2-S12-AC-050: "Update slice tracking, feature-ledger assignments, applicable runbooks,
 * and architecture graph in the same change; leave no unresolved implementation boundary or
 * undocumented drift."
 *
 * What this proves: the recorded artifacts exist and agree with the code and with each other, and the
 * set of open implementation boundaries is closed and pinned. What it cannot prove: that they were
 * updated in the same change as the code (the commit shows that), or that a tracked boundary
 * satisfies "leave no unresolved implementation boundary" (an owner ruling). Modelled on
 * phase-02-slice-11-closeout.test.ts.
 */

const TRACKER = '.memory/pipeline/progress/slices/phase-02-slice-12.md';
const FEATURE_LEDGER = '.memory/wiki/specs/feature-ledger.md';
const PHASE_PLAN = '.memory/wiki/specs/phases/phase-2.md';
const RUNBOOKS = [
  'docs/runbooks/platform/cms-taxonomy-merge-converge.md',
  'docs/runbooks/platform/cms-editorial.md',
] as const;

const runNode = (script: string, args: readonly string[] = []) =>
  spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  });

const featureIds = (rows: readonly string[]): string[] =>
  rows.map((row) => /`(\d{2}\.\d{2}\.\d{2})`/u.exec(row)?.[1] as string);

/** Every repository path cited in backticks by `text` (a `:line` suffix is ignored). */
const citedPaths = (text: string): string[] => [
  ...new Set(
    [
      ...text.matchAll(
        /`((?:apps|packages|docs|supabase|tests|infra|scripts|\.memory)\/[A-Za-z0-9_.\-/[\]]+?)(?::\d+(?:-\d+)?)?`/gu,
      ),
    ].map((match) => match[1] as string),
  ),
];

describe('Slice 12 tracking and feature ledger (P2-S12-AC-050)', () => {
  it('tracking: the tracker status agrees with the evidence ledger, and a Completion Signature exists exactly when every criterion is verified', () => {
    const tracker = read(TRACKER);
    const open = S12_EVIDENCE_LEDGER.filter(
      (entry) => entry.status !== 'verified',
    );
    expect(S12_EVIDENCE_LEDGER.length).toBeGreaterThanOrEqual(296);
    const signature = tracker.includes('\n## Completion Signature')
      ? tracker.slice(tracker.indexOf('\n## Completion Signature'))
      : '';
    if (open.length === 0) {
      expect(tracker).toMatch(/^\*\*Status\*\*: complete\s*$/mu);
      expect(signature).toMatch(/^- Completed: \d{4}-\d{2}-\d{2}$/mu);
    } else {
      // A slice with an open criterion is not complete and must not be signed.
      expect(tracker).toMatch(/^\*\*Status\*\*: in-progress\s*$/mu);
      expect(signature).toBe('');
    }
    // The architecture map says the same about Slice 12.
    const scope = /\*\*Implementation scope:\*\*[^\n]*/u.exec(
      read('docs/ARCHITECTURE.md'),
    )?.[0];
    expect(scope).toBeDefined();
    if (open.length === 0)
      expect(scope).not.toMatch(/Slice 12[^.]*IN PROGRESS/u);
    else expect(scope).toMatch(/Slice 12[^.]*IN PROGRESS/u);
  });

  it('tracking: the progress checker reports slice, phase and index agreement with no drift', () => {
    const result = runNode('scripts/check-progress-consistency.mjs', [
      '--json',
    ]);
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as {
      status?: string;
      drift?: unknown[];
    };
    expect(report.status).toBe('consistent');
    expect(report.drift ?? []).toEqual([]);
  });

  it('feature ledger: the P2-S12 rows are 25.03.02, 25.03.03, 25.05.01 and 25.05.02, complete in IA/BE/FE and listed by the phase plan; 25.05.03 and 25.05.04 are the plan-listed, unassigned remainder', () => {
    const lines = read(FEATURE_LEDGER).split('\n');
    const assigned = lines.filter(
      (line) => line.startsWith('|') && /\|\s*P2-S12\s*\|\s*$/u.test(line),
    );
    expect(featureIds(assigned)).toEqual([
      '25.03.02',
      '25.03.03',
      '25.05.01',
      '25.05.02',
    ]);
    for (const row of assigned) {
      const cells = row.split('|').map((cell) => cell.trim());
      expect(cells.slice(-6, -2), row).toEqual([
        '03-cms-content-modeling',
        'complete',
        'complete',
        'complete',
      ]);
    }
    const plan = read(PHASE_PLAN)
      .split('\n')
      .find((line) => /^\|\s*Slice 12\s*\|\s*`25\.03\.02`/u.test(line));
    expect(plan, 'the phase plan lists the Slice 12 features').toBeDefined();
    const planned = [
      ...(plan as string).matchAll(/`(\d{2}\.\d{2}\.\d{2})`/gu),
    ].map((match) => match[1]);
    expect(planned).toEqual([
      '25.03.02',
      '25.03.03',
      '25.05.01',
      '25.05.02',
      '25.05.03',
      '25.05.04',
    ]);
    // KNOWN DRIFT, reported to root: the plan assigns these two to Slice 12 (DEC-114 built CMS-15 and CMS-16 in
    // Phase 2) while the feature ledger still reads "—". The guard pins the difference so it cannot widen unseen.
    const unassigned = lines.filter(
      (line) =>
        line.startsWith('|') &&
        /`25\.05\.0[34]`/u.test(line) &&
        /\|\s*—\s*\|\s*$/u.test(line),
    );
    expect(featureIds(unassigned)).toEqual(['25.05.03', '25.05.04']);
  });
});

describe('Slice 12 runbooks (P2-S12-AC-050)', () => {
  it('runbook: every runbook the slice cites exists, is linked from the platform runbook index and cites only existing repository paths', () => {
    const index = read('docs/runbooks/platform/README.md');
    for (const file of RUNBOOKS) {
      expect(existsSync(resolve(ROOT, file)), file).toBe(true);
      expect(index, `${file} is linked`).toContain(
        `./${file.slice(file.lastIndexOf('/') + 1)}`,
      );
      for (const path of citedPaths(read(file)))
        expect(existsSync(resolve(ROOT, path)), `${file}: ${path}`).toBe(true);
    }
    const converge = read(RUNBOOKS[0]);
    for (const fact of ['DEC-194', 'cms_taxonomy_merge', 'service_role'])
      expect(converge, `the converge runbook states ${fact}`).toContain(fact);
  });
});

describe('Slice 12 generated contracts and architecture graph (P2-S12-AC-050)', () => {
  it('contracts: the committed OpenAPI document equals the one generated from the route registry (no undocumented drift)', () => {
    const result = runNode('infra/generate-openapi.mjs', ['--check']);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  // Content-based, not mtime-based: the committed graph must equal the graph rebuilt from the committed spec text,
  // built in a temporary copy so the repository is never written.
  it('architecture graph: the compiled specification graph equals the graph rebuilt from the committed spec text', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 's12-spec-graph-'));
    try {
      cpSync(
        resolve(ROOT, '.memory/wiki/specs'),
        join(tmp, '.memory/wiki/specs'),
        { recursive: true },
      );
      const { buildSpecGraph } = (await import(
        pathToFileURL(resolve(ROOT, '.memory/pipeline/spec-graph.mjs')).href
      )) as {
        buildSpecGraph: (options: {
          projectRoot: string;
          memoryRoot: string;
        }) => unknown;
      };
      buildSpecGraph({ projectRoot: tmp, memoryRoot: join(tmp, '.memory') });
      const strip = (json: string): Record<string, unknown> => {
        const graph = JSON.parse(json) as Record<string, unknown>;
        delete graph['builtAt'];
        return graph;
      };
      expect(
        strip(
          readFileSync(join(tmp, '.memory/schema/spec-graph.json'), 'utf8'),
        ),
      ).toEqual(strip(read('.memory/schema/spec-graph.json')));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60_000);
});

/** A directory is walked recursively; a file is taken as is. */
const walk = (relativePath: string): string[] => {
  const absolute = resolve(ROOT, relativePath);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [relativePath];
  return readdirSync(absolute).flatMap((name) =>
    walk(`${relativePath}/${name}`),
  );
};
const SLICE_12_SOURCE_ROOTS = [
  'apps/worker/src/cms-composition',
  'packages/contracts/src/cms-composition',
  'apps/web/src/components/cms-composition',
  'apps/web/src/components/cms-composition-instances',
  'apps/web/src/components/cms-governed-review',
  'apps/web/src/components/cms-locale',
  'apps/web/src/components/cms-pattern-designer',
  'apps/web/src/components/cms-related-content',
  'apps/web/src/components/cms-taxonomy-designer',
  'apps/web/src/components/cms-taxonomy-pages',
  'apps/web/src/components/cms-taxonomy-terms',
  'apps/web/src/pages/api/v1/cms/templates',
  'apps/web/src/pages/api/v1/cms/patterns',
  'apps/web/src/pages/api/v1/cms/compositions',
  'apps/web/src/pages/api/v1/cms/taxonomies',
  'apps/web/src/pages/api/v1/cms/governed-reviews',
] as const;
const isProductionSource = (name: string): boolean =>
  /\.(?:ts|tsx|astro|mjs)$/u.test(name) &&
  !/\.test(?:-support)?\.(?:ts|tsx)$/u.test(name) &&
  !/\.test-support\./u.test(name) &&
  !/\.coverage\.test/u.test(name) &&
  !/\.d\.(?:ts|mts)$/u.test(name);
const productionSources = [
  ...new Set(SLICE_12_SOURCE_ROOTS.flatMap(walk)),
  ...readdirSync(resolve(ROOT, 'apps/worker/src'))
    .filter((name) => name.startsWith('cms-composition-production'))
    .map((name) => `apps/worker/src/${name}`),
]
  .filter(isProductionSource)
  .sort();

describe('Slice 12 implementation boundaries (P2-S12-AC-050)', () => {
  it('boundaries: the scan covers the Slice 12 production sources', () => {
    expect(productionSources.length).toBeGreaterThanOrEqual(150);
    expect(productionSources).toContain(
      'apps/worker/src/cms-composition/pattern-instance-routes.ts',
    );
    expect(productionSources).toContain(
      'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.tsx',
    );
  });

  it('boundaries: no TODO, FIXME, not-implemented or unwired marker remains in the Slice 12 production sources', () => {
    expect(filesWhere(productionSources, hasLazyMarker)).toEqual([]);
  });

  // The open set is CLOSED: a new BOUNDARY: marker fails here until it has a tracking issue, a typed interface and a sentinel
  // test (.claude/rules/boundary-not-placeholder.md). The nested-pattern picker was the one open marker; it is wired to the
  // designer-only cmsPatternNestableRead (DEC-196), so no TypeScript production source holds a marker any more (AC-105).
  it('boundaries: no BOUNDARY: marker remains in the Slice 12 production sources (the nested picker is wired to cmsPatternNestableRead)', () => {
    expect(filesWhere(productionSources, hasBoundaryMarker)).toEqual([]);
  });

  it('boundaries: the SQL BOUNDARY: markers are the replaced anchors of the retire-request amendment and the restore marker the DEC-240 migration supersedes', () => {
    // The one Slice 11 marker (issue #127) is tracked by phase-02-slice-11-closeout.test.ts and is not a Slice 12 boundary.
    const migrations = readdirSync(resolve(ROOT, 'supabase/migrations'))
      .filter((name) => /^\d{14}_.*\.sql$/u.test(name))
      .filter(
        (name) => name !== '20261010165000_cms_projection_consumer_state.sql',
      )
      .map((name) => `supabase/migrations/${name}`)
      .filter((file) => hasBoundaryMarker(read(file)));
    // The closed set: two replaced anchors, plus the 20261024100700 restore comment that DEC-240 supersedes (asserted below).
    expect(migrations).toEqual([
      'supabase/migrations/20261014070300_cms_governed_activation_request.sql',
      'supabase/migrations/20261014160000_cms_governed_retire_request.sql',
      'supabase/migrations/20261024100700_cms_restore_term_assignments.sql',
    ]);
    const amendment = read(migrations[1] as string);
    const replacements = amendment.indexOf('replacements constant');
    expect(replacements).toBeGreaterThan(0);
    expect(amendment.slice(0, replacements)).toContain('BOUNDARY:');
    expect(amendment.slice(replacements)).not.toContain('BOUNDARY:');
  });

  // 20261024100700 kept a source-recorded taxonomy version of a vocabulary without a carried assignment and marked the rule
  // "BOUNDARY: 03c states the rule for assignments only". DEC-240 (BE03c Receiving obligations item 3) closes it: the restore records
  // only the vocabularies of carried assignments. The superseding migration lives in supabase/migrations once promoted and in
  // supabase/migrations-wip/gaps-db5 before; the promoted 20261024100700 is never edited.
  it('boundaries: the restore marker in 20261024100700 is superseded by the DEC-240 migration, which names DEC-240 and holds no marker', () => {
    const name = '20261029130000_cms_restore_records_carried_vocabularies.sql';
    const locations = [
      `supabase/migrations/${name}`,
      `supabase/migrations-wip/gaps-db5/${name}`,
    ].filter((file) => existsSync(resolve(ROOT, file)));
    expect(locations).toHaveLength(1);
    const superseding = read(locations[0] as string);
    expect(superseding).toContain('DEC-240');
    expect(superseding).toContain('cms_restore_term_plan');
    expect(hasBoundaryMarker(superseding)).toBe(false);
    // It sorts after the marker it supersedes, so a fresh reset ends with the DEC-240 body.
    expect(name > '20261024100700_cms_restore_term_assignments.sql').toBe(true);
    const superseded = read(
      'supabase/migrations/20261024100700_cms_restore_term_assignments.sql',
    );
    expect(superseded).toContain('BOUNDARY: 03c states the rule');
  });
});
