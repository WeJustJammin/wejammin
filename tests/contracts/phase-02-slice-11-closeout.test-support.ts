import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ROOT,
  read,
} from './phase-02-slice-09-amendment-evidence.test-support';

/**
 * Pure helpers of the Slice 11 closeout guard (P2-S11-AC-045): which source files belong to
 * Slice 11, which of them carry an implementation-boundary marker, and what the closed list of
 * tracked boundaries looks like. Every function takes plain text or a path, so the guard test can
 * feed it mutated input and prove each check refuses what it claims to refuse.
 */
/** A directory is walked recursively; a file is taken as is; a name ending in `*` is a prefix glob. */
export const SLICE_11_SOURCE_ROOTS = [
  'apps/worker/src/cms-editorial',
  'apps/worker/src/cms-editorial-production*',
  'apps/worker/src/cms-publication-schedule-sweep*',
  'apps/worker/src/async-runtime*',
  'apps/worker/src/production-async-entrypoint.ts',
  'apps/worker/src/production-job-effect-dispatcher.ts',
  'packages/contracts/src/cms-editorial',
  'packages/application/src/infrastructure/jobs',
  'apps/web/src/components/cms-editorial-workflow',
  'apps/web/src/components/cms-editorial-pages',
  'apps/web/src/server/cms-workflow-platform-*',
  'apps/web/src/pages/api/v1/cms/reviews',
  'apps/web/src/pages/api/v1/cms/previews',
  'apps/web/src/pages/api/v1/cms/publications',
  'apps/web/src/pages/api/v1/cms/publication-schedules',
  'apps/web/src/pages/app/cms-content-modeling/reviews',
] as const;

/** Slice 11 forward migrations: the first and the last file of the two ranges. */
export const SLICE_11_MIGRATION_RANGES = [
  ['20261005017000', '20261005018100'],
  ['20261010130000', '20261010171000'],
] as const;

const isProductionSource = (name: string): boolean =>
  /\.(?:ts|tsx|astro|mjs)$/u.test(name) &&
  !/\.test(?:-support)?\.(?:ts|tsx)$/u.test(name) &&
  !/\.test-support\./u.test(name) &&
  !/\.d\.(?:ts|mts)$/u.test(name);

const walk = (relativePath: string): string[] => {
  const absolute = resolve(ROOT, relativePath);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [relativePath];
  return readdirSync(absolute).flatMap((name) =>
    walk(`${relativePath}/${name}`),
  );
};

const expand = (root: string): string[] => {
  if (!root.endsWith('*')) return walk(root);
  const slash = root.lastIndexOf('/');
  const directory = root.slice(0, slash);
  const prefix = root.slice(slash + 1, -1);
  return readdirSync(resolve(ROOT, directory))
    .filter((name) => name.startsWith(prefix))
    .flatMap((name) => walk(`${directory}/${name}`));
};

/** Every production TypeScript, TSX, Astro and MJS file of the Slice 11 source roots, sorted. */
export const slice11ProductionSources = (): string[] =>
  [...new Set(SLICE_11_SOURCE_ROOTS.flatMap(expand))]
    .filter((file) => isProductionSource(file))
    .sort();

/** The Slice 11 migrations (both ranges), sorted. */
export const slice11Migrations = (): string[] =>
  readdirSync(resolve(ROOT, 'supabase/migrations'))
    .filter((name) => /^\d{14}_.*\.sql$/u.test(name))
    .filter((name) =>
      SLICE_11_MIGRATION_RANGES.some(
        ([first, last]) =>
          name.slice(0, 14) >= first && name.slice(0, 14) <= last,
      ),
    )
    .map((name) => `supabase/migrations/${name}`)
    .sort();

/** `BOUNDARY:` (the allowed, tracked marker), TODO and FIXME are case-sensitive: a `boundary:` key is ordinary code. */
export const hasBoundaryMarker = (source: string): boolean =>
  /BOUNDARY:/u.test(source);

/** A lazy placeholder: always forbidden, whatever the file. */
export const hasLazyMarker = (source: string): boolean =>
  /\bTODO\b|\bFIXME\b/u.test(source) ||
  /not implemented|unimplemented|\bunwired\b/iu.test(source);

/**
 * The tracked implementation boundaries Slice 11 leaves open, each with the file that carries the
 * `BOUNDARY:` comment, the GitHub issue its `TRACKING:` line names and the sentinel test that
 * fails the day the boundary is resolved (`.claude/rules/boundary-not-placeholder.md`).
 */
export type TrackedBoundary = Readonly<{
  issue: number;
  file: string;
  sentinel: string;
  sentinelTitle: string;
}>;

export const TRACKED_BOUNDARIES: readonly TrackedBoundary[] = [
  {
    issue: 127,
    file: 'supabase/migrations/20261010165000_cms_projection_consumer_state.sql',
    sentinel: 'supabase/tests/phase_02_slice_11_projection_state.sql',
    // DEC-197 (decisions.md "Replace the #127 sentinel only after the real FK exists"): the
    // promoted migration keeps its historical, immutable BOUNDARY comment; the pgTAP file now
    // proves the real validated FK (supabase/migrations/20261016030000_delivery_receiving_contracts.sql) instead of the old
    // missing-FK sentinel, so the tracked identity is the first DEC197-PS test, which names #127.
    sentinelTitle:
      'DEC197-PS-F01 direct projection FK is validated, ordered, immediate and restrictive with a valid parent key',
  },
];

/** The files of `files` whose text satisfies `predicate`. */
export const filesWhere = (
  files: readonly string[],
  predicate: (source: string) => boolean,
  readFile: (relativePath: string) => string = read,
): string[] => files.filter((file) => predicate(readFile(file)));

/** The `TRACKING: #<n>` numbers within 14 lines after each `BOUNDARY:` marker of a source. */
export const trackingIssues = (source: string): number[] => {
  const lines = source.split('\n');
  return lines.flatMap((line, index) => {
    if (!line.includes('BOUNDARY:')) return [];
    const window = lines.slice(index, index + 14).join('\n');
    const match = /TRACKING:\s*#(\d+)/u.exec(window);
    return match === null ? [-1] : [Number(match[1])];
  });
};

/** Problems with one tracked boundary: its marker, its issue number and its sentinel. */
export const boundaryProblems = (
  boundary: TrackedBoundary,
  readFile: (relativePath: string) => string = read,
  exists: (relativePath: string) => boolean = (path) =>
    existsSync(resolve(ROOT, path)),
): string[] => {
  const problems: string[] = [];
  if (!exists(boundary.file)) return [`${boundary.file} does not exist`];
  const issues = trackingIssues(readFile(boundary.file));
  if (issues.length === 0)
    problems.push(`${boundary.file} carries no BOUNDARY: marker`);
  if (issues.some((issue) => issue !== boundary.issue))
    problems.push(
      `${boundary.file} has a BOUNDARY: marker without TRACKING: #${String(boundary.issue)}`,
    );
  if (!exists(boundary.sentinel))
    problems.push(`${boundary.sentinel} does not exist`);
  else {
    const sentinel = readFile(boundary.sentinel);
    if (!sentinel.includes(boundary.sentinelTitle))
      problems.push(
        `${boundary.sentinel} has no sentinel titled "${boundary.sentinelTitle}"`,
      );
    if (!sentinel.includes(`#${String(boundary.issue)}`))
      problems.push(
        `${boundary.sentinel} does not name issue #${String(boundary.issue)}`,
      );
  }
  return problems;
};
