import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  CMS_EDITORIAL_INTERNAL_OPERATIONS,
  CmsSlice11ReasonCodeSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { CMS_EDITORIAL_RPC } from '../../apps/worker/src/cms-editorial-production-types';
import {
  ROOT,
  read,
} from './phase-02-slice-09-amendment-evidence.test-support';
import {
  TRACKED_BOUNDARIES,
  boundaryProblems,
  filesWhere,
  hasBoundaryMarker,
  hasLazyMarker,
  slice11Migrations,
  slice11ProductionSources,
  trackingIssues,
} from './phase-02-slice-11-closeout.test-support';

/**
 * Guard for P2-S11-AC-045: "Update slice tracking, feature-ledger assignments, applicable
 * runbooks, and architecture graph in the same change; leave no unresolved implementation
 * boundary or undocumented drift."
 *
 * What this proves: the recorded artifacts exist and agree with the code. What it cannot prove:
 * that they were updated in the same change as the code (the commit or pull request shows that).
 *
 * The second clause is NOT proved. The sources of Slice 11 carry exactly two implementation
 * boundaries (`.claude/rules/boundary-not-placeholder.md`): the `projection_id` foreign key
 * (issue #127) and the production trigger of the claimed schema-migration preparation entry
 * (issue #128). Each is a typed interface with a tracking issue and a sentinel test, which is
 * what that rule allows when the governing specification does not exist, but both are
 * unresolved by definition. What the tests below pin is that the open set is closed and
 * tracked: nothing else is a boundary, and no TODO, FIXME or not-implemented marker remains.
 * Whether tracked boundaries satisfy "leave no unresolved implementation boundary" is an owner
 * ruling; until it is made the criterion stays partial.
 */

const TRACKER = '.memory/pipeline/progress/slices/phase-02-slice-11.md';
const RUNBOOK = 'docs/runbooks/platform/cms-publication.md';
const SLICE_11_BROWSER = [
  'CMS-03B-05',
  'CMS-03B-06',
  'CMS-03B-07',
  'CMS-03B-08',
  'CMS-03B-09',
  'CMS-03B-15',
  'CMS-03B-16',
  'CMS-03B-17',
  'CMS-03B-18',
] as const;
const SLICE_11_INTERNAL = ['CMS-03B-19', 'CMS-03B-20'] as const;

const runNode = (script: string, args: readonly string[] = []) =>
  spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  });

const section = (text: string, from: string, to: string): string => {
  const start = text.indexOf(from);
  expect(start, `${from} exists`).toBeGreaterThan(-1);
  const end = text.indexOf(to, start + from.length);
  return text.slice(start, end === -1 ? undefined : end);
};

/** The text from `heading` to its end, or the empty string when the heading is absent. */
const fromHeading = (text: string, heading: string): string => {
  const start = text.indexOf(heading);
  return start === -1 ? '' : text.slice(start);
};

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

describe('Slice 11 tracking and feature ledger (P2-S11-AC-045)', () => {
  it('tracking: the six Slice 11 gate lines are checked, and the tracker carries a dated Depth Ratio and Completion Signature', () => {
    const tracker = read(TRACKER);
    const tasks = section(tracker, '## Tasks', '## Acceptance Criteria');
    const gates = [
      'Contract: lock Zod, data, registry, event, and route contracts',
      '`QA` RED: failing contract, permission, unit, integration, component, accessibility, and applicable E2E tests',
      '`BE` data, API, and policy implementation',
      '`FE` Astro SSR and bounded React-island implementation',
      '`QA` GREEN, adversarial verification, and canonical validation',
      'Documentation, runbooks, graph, feature ledger, and progress tracking',
    ];
    for (const gate of gates)
      expect(tasks, `gate line "${gate}"`).toContain(`- [x] ${gate}`);
    const depth = fromHeading(tracker, '## Depth Ratio');
    expect(depth).toMatch(/^## Depth Ratio$/mu);
    expect(depth).toMatch(/^- \d{4}-\d{2}-\d{2}: depth floor \d+/mu);
    const signature = fromHeading(tracker, '## Completion Signature');
    expect(signature).toMatch(/^## Completion Signature$/mu);
    expect(signature).toMatch(/^- Completed: \d{4}-\d{2}-\d{2}$/mu);
    expect(signature).toMatch(/^- Verifier: .*exit 0/mu);
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

  it('feature ledger: exactly 25.02.03, 25.02.04 and 25.03.04 are assigned to P2-S11, complete in IA/BE/FE, listed by the phase plan, and carry the implementation note', () => {
    const ledger = read('.memory/wiki/specs/feature-ledger.md');
    const rows = ledger
      .split('\n')
      .filter(
        (line) => line.startsWith('|') && /\|\s*P2-S11\s*\|\s*$/u.test(line),
      );
    const ids = rows.map((row) => /`(\d{2}\.\d{2}\.\d{2})`/u.exec(row)?.[1]);
    expect(ids).toEqual(['25.02.03', '25.02.04', '25.03.04']);
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
    const planRow = plan
      .split('\n')
      .find((line) => /^\|\s*Slice 11\s*\|\s*`25\.02\.03`/u.test(line));
    expect(planRow, 'the phase plan lists the three features').toBeDefined();
    for (const id of ['25.02.03', '25.02.04', '25.03.04'])
      expect(planRow).toContain(id);
    const note = section(
      ledger,
      '> **Phase 2 Slice 11 implementation evidence:**',
      '\n\n',
    );
    for (const id of ['25.02.03', '25.02.04', '25.03.04', '#127', '#128'])
      expect(note, `the ledger note names ${id}`).toContain(id);
    const links = [...note.matchAll(/\]\(([^)#]+)\)/gu)].map(
      (match) => match[1] as string,
    );
    expect(links.length).toBeGreaterThanOrEqual(4);
    for (const link of links)
      expect(
        existsSync(resolve(ROOT, '.memory/wiki/specs', link)),
        `the ledger note links ${link}`,
      ).toBe(true);
    expect(note).toContain('not acceptance');
  });
});

describe('Slice 11 runbooks (P2-S11-AC-045)', () => {
  const runbook = read(RUNBOOK);

  it('runbook: cms-publication names every Slice 11 operation with its RPC, and the internal operations with theirs', () => {
    for (const operation of SLICE_11_BROWSER) {
      expect(runbook, `names ${operation}`).toContain(operation);
      expect(runbook, `names the RPC of ${operation}`).toContain(
        `platform_api.${CMS_EDITORIAL_RPC[operation]}`,
      );
    }
    for (const operation of SLICE_11_INTERNAL) {
      expect(runbook, `names ${operation}`).toContain(operation);
      for (const rpc of CMS_EDITORIAL_INTERNAL_OPERATIONS[operation].rpcs)
        expect(runbook, `names ${rpc}`).toContain(rpc);
    }
  });

  it('runbook: cms-publication triages every typed Slice 11 reason', () => {
    for (const reason of CmsSlice11ReasonCodeSchema.options)
      expect(runbook, `names ${reason}`).toContain(`\`${reason}\``);
  });

  it('runbook: cms-publication has a section for every Slice 11 behaviour change an operator needs', () => {
    const topics: readonly (readonly [string, readonly string[]])[] = [
      [
        'Schedule execution',
        [
          'entry_unavailable',
          'cancelled',
          'preflight_evidence_stale',
          'evidence_stale',
          'deadline_exceeded',
          '15,000 ms',
        ],
      ],
      [
        'Preview verification and takedown',
        ['cms_takedown_preview_tokens', 'service_role', '42501'],
      ],
      [
        'Dependency recheck',
        ['cms.review.dependency_recheck', '500', 'dependency_changed'],
      ],
      [
        'Outbox relay poison rows',
        ['platform.outbox.sweep', 'INVALID_QUEUE_PAYLOAD'],
      ],
      ['History cursors', ['273 bytes', '364', '0x01', '409']],
      ['Projection state', ['projection_consumer_state', 'pending', '#127']],
      ['Reviewer queue read plan', ['20261010171000', 'relpages']],
      [
        'Row-level reads',
        ['wejammin_cms_definer', 'nobody for preview tokens'],
      ],
      ['Job lease control', ['LEASE_CONTROL_UNAVAILABLE', '#128']],
      ['Dependency failures', ['DEPENDENCY_UNAVAILABLE', '502', '503']],
    ];
    for (const [heading, facts] of topics) {
      // Markdown wraps prose at any space: compare on single-spaced text.
      const body = section(runbook, `\n## ${heading}\n`, '\n## ').replace(
        /\s+/gu,
        ' ',
      );
      for (const fact of facts)
        expect(body, `${heading} states ${fact}`).toContain(fact);
    }
  });

  it('runbook: every repository path the runbooks cite exists, and the sealed cursor reaches the Slice 10 and wiki runbooks', () => {
    for (const file of [
      RUNBOOK,
      'docs/runbooks/platform/cms-editorial.md',
      '.memory/wiki/operations/runbooks/cms-editorial.md',
    ])
      for (const path of citedPaths(read(file)))
        expect(existsSync(resolve(ROOT, path)), `${file}: ${path}`).toBe(true);
    for (const file of [
      'docs/runbooks/platform/cms-editorial.md',
      '.memory/wiki/operations/runbooks/cms-editorial.md',
    ])
      expect(read(file), file).toMatch(/sealed|encrypt-then-MAC/u);
    expect(read('docs/runbooks/platform/README.md')).toContain(
      './cms-publication.md',
    );
  });
});

describe('Slice 11 architecture map and generated contracts (P2-S11-AC-045)', () => {
  const architecture = read('docs/ARCHITECTURE.md');
  const heading =
    '### Phase 2 Slice 11 CMS review, scheduling, preview and publication implementation delta';

  it('architecture map: the Slice 11 delta names all eleven operations and every repository path it cites exists', () => {
    const delta = section(architecture, heading, '\nTogether, the base tree');
    for (const operation of [...SLICE_11_BROWSER, ...SLICE_11_INTERNAL]) {
      const shorthand =
        operation === 'CMS-03B-05'
          ? operation
          : operation.slice('CMS-03B'.length);
      expect(delta, `the delta names ${operation}`).toContain(
        `\`${shorthand}\``,
      );
    }
    const flow = section(architecture, '### Flow Q', '\n---\n');
    const cited = [...citedPaths(delta), ...citedPaths(flow)];
    expect(cited.length).toBeGreaterThanOrEqual(30);
    const missing = cited.filter((path) => !existsSync(resolve(ROOT, path)));
    expect(
      missing,
      `cited paths that do not exist: ${missing.join(', ')}`,
    ).toEqual([]);
    for (const component of [
      'Lease control',
      'Sealed cursor',
      'Render plan',
      'Dependency recheck',
      'Schedule executor',
      'Projection state',
      'Takedown RPC',
      'Queue plan guard',
      'Row-level reads',
    ])
      expect(delta, component).toContain(`**${component}.**`);
  });

  it('architecture map: the header no longer calls Slice 11 dependency-locked, and the tracked boundaries are named', () => {
    const scope = /\*\*Implementation scope:\*\*[^\n]*/u.exec(
      architecture,
    )?.[0];
    expect(scope).toBeDefined();
    expect(scope).not.toMatch(/Slice 11 and Slices 13/u);
    expect(scope).toContain('Slice 11');
    for (const boundary of TRACKED_BOUNDARIES)
      expect(architecture).toContain(`#${String(boundary.issue)}`);
    expect(architecture).toMatch(/\*\*Last Updated:\*\* 2026-10-1\d/u);
  });

  it('contracts: the committed OpenAPI document equals the one generated from the route registry (no undocumented drift)', () => {
    const result = runNode('infra/generate-openapi.mjs', ['--check']);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  // Content-based, not mtime-based: the committed graph must equal the graph rebuilt from the
  // committed spec text, built in a temporary copy so the repository is never written. The copy
  // of the whole specification tree takes 13-17 s on a loaded host.
  it('architecture graph: the compiled specification graph equals the graph rebuilt from the committed spec text', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 's11-spec-graph-'));
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

describe('Slice 11 implementation boundaries (P2-S11-AC-045)', () => {
  const sources = slice11ProductionSources();
  const migrations = slice11Migrations();

  it('boundaries: the scan covers the Slice 11 production sources and both migration ranges', () => {
    expect(sources.length).toBeGreaterThanOrEqual(150);
    expect(sources).toContain(
      'apps/worker/src/cms-publication-schedule-sweep.ts',
    );
    expect(sources).toContain(
      'packages/application/src/infrastructure/jobs/cms-lease-control.ts',
    );
    expect(sources).toContain(
      'apps/worker/src/cms-editorial/review-recheck/job.ts',
    );
    expect(migrations.length).toBeGreaterThanOrEqual(70);
    expect(migrations).toContain(
      'supabase/migrations/20261010171000_cms_list_editorial_reviews_bounded_plan.sql',
    );
  });

  it('boundaries: no TODO, FIXME, not-implemented or unwired marker remains in the Slice 11 production sources', () => {
    expect(filesWhere(sources, hasLazyMarker)).toEqual([]);
  });

  it('boundaries: the only BOUNDARY: markers in the Slice 11 sources and migrations are the two tracked ones, each with its issue, typed interface and sentinel test', () => {
    const marked = filesWhere([...sources, ...migrations], hasBoundaryMarker);
    expect(marked).toEqual(TRACKED_BOUNDARIES.map((b) => b.file).sort());
    expect(TRACKED_BOUNDARIES.map((b) => b.issue)).toEqual([127, 128]);
    for (const boundary of TRACKED_BOUNDARIES)
      expect(boundaryProblems(boundary), boundary.file).toEqual([]);
  });

  it('boundaries: a marker without its issue, a missing sentinel and a renamed sentinel title are refused', () => {
    const [first] = TRACKED_BOUNDARIES;
    const boundary = first as (typeof TRACKED_BOUNDARIES)[number];
    const text = read(boundary.file);
    const untracked = text.replace(/TRACKING:\s*#\d+/u, 'TRACKING: soon');
    expect(
      boundaryProblems(boundary, (path) =>
        path === boundary.file ? untracked : read(path),
      ),
    ).toContain(
      `${boundary.file} has a BOUNDARY: marker without TRACKING: #${String(boundary.issue)}`,
    );
    expect(
      boundaryProblems(boundary, read, (path) => path !== boundary.sentinel),
    ).toContain(`${boundary.sentinel} does not exist`);
    expect(
      boundaryProblems(boundary, (path) =>
        path === boundary.sentinel
          ? read(path).replace(boundary.sentinelTitle, 'renamed')
          : read(path),
      ),
    ).toContain(
      `${boundary.sentinel} has no sentinel titled "${boundary.sentinelTitle}"`,
    );
    expect(trackingIssues('// BOUNDARY: x\n// TRACKING: #9')).toEqual([9]);
    expect(trackingIssues('// BOUNDARY: x\n// nothing')).toEqual([-1]);
    expect(hasLazyMarker('// TODO: later')).toBe(true);
    expect(hasLazyMarker('throw new Error("not implemented")')).toBe(true);
    expect(hasLazyMarker('const boundary = { a: 1 }')).toBe(false);
  });

  it('boundaries: both open boundaries are named in the runbook, the feature ledger and the architecture map', () => {
    const documents = [
      read(RUNBOOK),
      read('.memory/wiki/specs/feature-ledger.md'),
      read('docs/ARCHITECTURE.md'),
    ];
    for (const boundary of TRACKED_BOUNDARIES)
      for (const document of documents)
        expect(document).toContain(`#${String(boundary.issue)}`);
  });
});
