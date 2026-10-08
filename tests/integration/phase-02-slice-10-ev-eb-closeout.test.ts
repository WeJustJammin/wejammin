import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CMS_EDITORIAL_RPC } from '../../apps/worker/src/cms-editorial-production-types';

// Evidence lane EB: record-level evidence for the Slice 10 closeout facets of AC-060
// (runbooks, feature-ledger assignments, architecture map, generated-contract drift,
// tracking consistency). These tests prove that the recorded artifacts are present and agree
// with the code; they cannot prove the artifacts were updated in the same change.

const ROOT = resolve(import.meta.dirname, '../..');
const read = (relativePath: string): string =>
  readFileSync(resolve(ROOT, relativePath), 'utf8');

const SLICE_10_SOURCE_ROOTS = [
  'apps/worker/src/cms-editorial',
  'apps/web/src/components/cms-editorial',
  'apps/web/src/components/cms-editorial-fields',
  'apps/web/src/components/cms-editorial-pages',
  'apps/web/src/components/cms-rich-text',
  'apps/web/src/server',
  'apps/web/src/pages/api/v1/cms/entries',
  'apps/web/src/pages/app/cms-content-modeling/entries',
  'packages/contracts/src/cms-editorial',
] as const;

const isProductionSource = (name: string): boolean =>
  /\.(?:ts|tsx|astro|mjs)$/u.test(name) &&
  !/\.test(?:-support)?\.(?:ts|tsx)$/u.test(name) &&
  !/\.test-support\./u.test(name);

const walk = (relativeDirectory: string): string[] => {
  const absolute = resolve(ROOT, relativeDirectory);
  return readdirSync(absolute).flatMap((name) => {
    const child = `${relativeDirectory}/${name}`;
    return statSync(resolve(ROOT, child)).isDirectory()
      ? walk(child)
      : isProductionSource(name)
        ? [child]
        : [];
  });
};

// BOUNDARY:/TODO/FIXME are case-sensitive markers (a `boundary:` object key is ordinary code).
const hasOpenBoundary = (source: string): boolean =>
  /BOUNDARY:|\bTODO\b|\bFIXME\b/u.test(source) ||
  /not implemented|unimplemented|\bunwired\b/iu.test(source);

const OPERATIONS = [
  'CMS-03B-01',
  'CMS-03B-02',
  'CMS-03B-03',
  'CMS-03B-04',
  'CMS-03B-10',
  'CMS-03B-11',
  'CMS-03B-12',
  'CMS-03B-13',
  'CMS-03B-14',
] as const;

const TYPED_REASONS = [
  'comparison_too_large',
  'comparison_unavailable',
  'migration_chain_mismatch',
  'migration_chain_unavailable',
  'migration_chain_incomplete',
  'template_incompatible',
] as const;

const runNode = (script: string, args: readonly string[] = []) =>
  spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  });

describe('EB closeout: Slice 10 documentation and registry agreement', () => {
  it('EB closeout runbook: docs/runbooks/platform/cms-editorial.md documents every Slice 10 operation with its RPC', () => {
    const runbook = read('docs/runbooks/platform/cms-editorial.md');
    expect(Object.keys(CMS_EDITORIAL_RPC).sort()).toEqual([...OPERATIONS]);
    for (const operation of OPERATIONS) {
      expect(runbook, `runbook names ${operation}`).toContain(operation);
      expect(runbook, `runbook names the RPC of ${operation}`).toContain(
        CMS_EDITORIAL_RPC[operation],
      );
    }
  });

  it('EB closeout runbook: the cms-editorial runbook triages every typed comparison and restore refusal', () => {
    const runbook = read('docs/runbooks/platform/cms-editorial.md');
    for (const reason of TYPED_REASONS) {
      expect(runbook, `runbook names ${reason}`).toContain(reason);
    }
  });

  it('EB closeout architecture map: the Slice 10 delta names all nine operations and every repository path it cites exists', () => {
    const architecture = read('docs/ARCHITECTURE.md');
    const start = architecture.indexOf(
      '### Phase 2 Slice 10 CMS editorial authoring implementation delta',
    );
    expect(start, 'the Slice 10 delta section exists').toBeGreaterThan(-1);
    // The next paragraph deliberately lists directories that do not exist yet; it is not part of the delta.
    const end = architecture.indexOf(
      '\nTogether, the base tree and delta',
      start,
    );
    expect(
      end,
      'the delta section ends before the inventory paragraph',
    ).toBeGreaterThan(start);
    const section = architecture.slice(start, end);
    expect(section).toContain('CMS-03B-10');
    for (const shorthand of [
      '-01',
      '-02',
      '-03',
      '-04',
      '-11',
      '-12',
      '-13',
      '-14',
    ]) {
      expect(section, `delta names operation ${shorthand}`).toContain(
        `\`${shorthand}\``,
      );
    }
    const cited = [
      ...section.matchAll(
        /`((?:apps|packages|docs|supabase|tests|infra|\.memory)\/[A-Za-z0-9_.\-/]+?)(?::\d+(?:-\d+)?)?`/gu,
      ),
    ].map((match) => match[1] as string);
    expect(cited.length).toBeGreaterThanOrEqual(5);
    const missing = cited.filter((path) => !existsSync(resolve(ROOT, path)));
    expect(
      missing,
      `cited paths that do not exist: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('EB closeout feature ledger: exactly features 25.02.01 and 25.02.02 are assigned to P2-S10, complete in IA/BE/FE, and the phase plan lists the same two', () => {
    const ledger = read('.memory/wiki/specs/feature-ledger.md');
    const rows = ledger
      .split('\n')
      .filter(
        (line) => line.startsWith('|') && /\|\s*P2-S10\s*\|\s*$/u.test(line),
      );
    const ids = rows
      .map((row) => /`(\d{2}\.\d{2}\.\d{2})`/u.exec(row)?.[1])
      .filter((id): id is string => id !== undefined);
    expect(ids).toEqual(['25.02.01', '25.02.02']);
    for (const row of rows) {
      const cells = row.split('|').map((cell) => cell.trim());
      expect(cells.slice(-6, -2), row).toEqual([
        '03-cms-content-modeling',
        'complete',
        'complete',
        'complete',
      ]);
    }
    const plan = read('.memory/wiki/specs/phases/phase-2.md');
    const planRows = plan
      .split('\n')
      .filter((line) => /^\|\s*Slice 10\s*\|/u.test(line));
    expect(planRows.length, 'the phase plan has Slice 10 rows').toBeGreaterThan(
      0,
    );
    expect(
      planRows.some(
        (row) => row.includes('25.02.01') && row.includes('25.02.02'),
      ),
      'a Slice 10 row of the phase plan lists both features',
    ).toBe(true);
  });

  it('EB closeout contracts: the committed OpenAPI document equals the one generated from the route registry (no undocumented drift)', () => {
    const result = runNode('infra/generate-openapi.mjs', ['--check']);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('EB closeout tracking: the progress checker reports slice, phase and index agreement with no drift', () => {
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

  it('EB closeout: no unresolved implementation boundary marker remains in the Slice 10 production sources', () => {
    const offenders = SLICE_10_SOURCE_ROOTS.flatMap(walk)
      .filter(
        (file) =>
          !file.startsWith('apps/web/src/server/') ||
          /cms-editorial/u.test(file),
      )
      .filter((file) => hasOpenBoundary(read(file)));
    expect(offenders).toEqual([]);
  });

  // Content-based, not mtime-based: a fresh CI checkout gives every file the
  // checkout time, so file ages prove nothing. The committed graph must equal
  // the graph rebuilt from the committed spec text (built in a temporary copy so
  // the repository is never written).
  const rebuildSpecGraph = async (
    mutate?: (specsRoot: string) => void,
  ): Promise<Record<string, unknown>> => {
    const tmp = mkdtempSync(join(tmpdir(), 's10-spec-graph-'));
    try {
      const specsRoot = join(tmp, '.memory/wiki/specs');
      cpSync(resolve(ROOT, '.memory/wiki/specs'), specsRoot, {
        recursive: true,
      });
      mutate?.(specsRoot);
      const { buildSpecGraph } = (await import(
        pathToFileURL(resolve(ROOT, '.memory/pipeline/spec-graph.mjs')).href
      )) as {
        buildSpecGraph: (options: {
          projectRoot: string;
          memoryRoot: string;
        }) => unknown;
      };
      buildSpecGraph({ projectRoot: tmp, memoryRoot: join(tmp, '.memory') });
      const graph = JSON.parse(
        readFileSync(join(tmp, '.memory/schema/spec-graph.json'), 'utf8'),
      ) as Record<string, unknown>;
      delete graph['builtAt'];
      return graph;
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  };
  const committedSpecGraph = (): Record<string, unknown> => {
    const graph = JSON.parse(read('.memory/schema/spec-graph.json')) as Record<
      string,
      unknown
    >;
    delete graph['builtAt'];
    return graph;
  };

  it('EB closeout: the compiled specification graph equals the graph rebuilt from the committed Slice 10 spec text', async () => {
    expect(await rebuildSpecGraph()).toEqual(committedSpecGraph());
  });

  it('EB closeout: a spec amendment that changes the graph is detected (negative control)', async () => {
    const mutated = await rebuildSpecGraph((specsRoot) => {
      // An amendment the committed graph has not seen: a new BE spec that links
      // the editorial spec.
      writeFileSync(
        join(specsRoot, 'be/99-negative-control.md'),
        '# Negative control — Backend Specification\n\nSee [BE03b](03b-editorial-workflow-publication.md).\n',
      );
    });
    expect(mutated).not.toEqual(committedSpecGraph());
  });

  it('EB closeout tracking: all six Slice 10 gate lines are checked and the tracker carries the dated continuation and Depth Ratio', () => {
    const tracker = read(
      '.memory/pipeline/progress/slices/phase-02-slice-10.md',
    );
    const tasks = /^## Tasks\n([\s\S]*?)^## /mu.exec(tracker)?.[1] ?? '';
    const gates = tasks
      .split('\n')
      .filter((line) => /^- \[[ x]\] /u.test(line));
    expect(gates).toHaveLength(6);
    expect(gates.filter((line) => line.startsWith('- [x] '))).toHaveLength(6);
    expect(tracker).toMatch(/^\*\*Continuation \(2026-10-07\/08,/mu);
    const depth = tracker.slice(tracker.indexOf('## Depth Ratio'));
    expect(depth).toMatch(/^- 2026-10-08: depth floor 105/mu);
  });
});
