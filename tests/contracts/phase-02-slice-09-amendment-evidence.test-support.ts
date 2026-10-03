import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, posix, resolve } from 'node:path';

/**
 * Shared helpers for the Slice 09 amendment evidence guards: the gate model
 * (which files `pnpm validate` really executes), marker parsing and source
 * normalisation. Nothing here knows an individual criterion.
 */
export const ROOT = resolve(import.meta.dirname, '../..');

export const read = (relativePath: string): string =>
  readFileSync(resolve(ROOT, relativePath), 'utf8');

export type EvidenceKind = 'vitest' | 'pgtap' | 'playwright' | 'other';

const stringsIn = (source: string, name: string): string[] =>
  [
    ...source.matchAll(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]`, 'gu')),
  ].flatMap(([, body]) =>
    [...(body ?? '').matchAll(/'([^']+)'/gu)].map(([, v]) => v ?? ''),
  );

const expandBraces = (glob: string): string[] => {
  const match = /^(.*)\{([^}]+)\}(.*)$/u.exec(glob);
  if (match === null) return [glob];
  return (match[2] ?? '')
    .split(',')
    .map((alternative) => `${match[1] ?? ''}${alternative}${match[3] ?? ''}`);
};

const globToRegExp = (glob: string): RegExp => {
  let out = '';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index] ?? '';
    if (char === '*' && glob[index + 1] === '*') {
      if (glob[index + 2] === '/') {
        out += '(?:.*/)?';
        index += 2;
      } else {
        out += '.*';
        index += 1;
      }
    } else if (char === '*') out += '[^/]*';
    else out += char.replace(/[.+?^${}()|[\]\\]/gu, '\\$&');
  }
  return new RegExp(`^${out}$`, 'u');
};

const matchesAny = (file: string, globs: readonly string[]): boolean =>
  globs.flatMap(expandBraces).some((glob) => globToRegExp(glob).test(file));

/** Include globs of vitest.config.ts: what `pnpm test:coverage` executes. */
export const vitestIncludeGlobs = (): string[] =>
  stringsIn(read('vitest.config.ts'), 'include').filter((glob) =>
    glob.includes('.test.'),
  );

export const inVitestGate = (file: string): boolean =>
  matchesAny(file, vitestIncludeGlobs());

const realRouteSpecs = (): string[] =>
  stringsIn(read('playwright.s09-real.config.ts'), 'testMatch');
const functionalIgnores = (): string[] =>
  stringsIn(read('playwright.config.ts'), 'testIgnore');

/** `pnpm test:e2e` runs the functional config and the s09-real config. */
export const playwrightGate = (file: string): string | null => {
  if (!/^tests\/e2e\/[^/]+\.spec\.ts$/u.test(file)) return null;
  if (realRouteSpecs().includes(basename(file))) return 'test:e2e:s09-real';
  const relative = file.replace(/^tests\/e2e\//u, '');
  const ignored = functionalIgnores().some((pattern) =>
    pattern.includes('/') || pattern.includes('*')
      ? matchesAny(relative, [pattern]) || matchesAny(basename(file), [pattern])
      : pattern === basename(file),
  );
  return ignored ? null : 'test:e2e:functional';
};

/** Top-level pgTAP entrypoints: what `pnpm db:test` discovers. */
export const pgtapEntrypoints = (): string[] =>
  readdirSync(resolve(ROOT, 'supabase/tests'))
    .filter((name) => name.endsWith('.sql'))
    .map((name) => `supabase/tests/${name}`);

/** Fragments pulled into an entrypoint through psql \ir or \i. */
export const pgtapIncludes = (): Set<string> => {
  const reached = new Set<string>();
  const visit = (file: string): void => {
    if (!existsSync(resolve(ROOT, file))) return;
    for (const [, target] of read(file).matchAll(/^\\ir?\s+(\S+)/gmu)) {
      const next = posix.normalize(posix.join(dirname(file), target ?? ''));
      if (!reached.has(next)) {
        reached.add(next);
        visit(next);
      }
    }
  };
  for (const entrypoint of pgtapEntrypoints()) visit(entrypoint);
  return reached;
};

export const kindOfFile = (file: string): EvidenceKind => {
  if (/^supabase\/tests\/[^/]+\.sql$/u.test(file)) return 'pgtap';
  if (/^supabase\/tests\/.+\.sqlinc$/u.test(file)) return 'pgtap';
  if (/\.test\.tsx?$/u.test(file)) return 'vitest';
  if (/^tests\/e2e\/.+\.spec\.ts$/u.test(file)) return 'playwright';
  return 'other';
};

/** The command of the validate pipeline that executes the file, or null when none does. */
export const validateGate = (
  file: string,
  includes: ReadonlySet<string>,
): string | null => {
  const kind = kindOfFile(file);
  if (kind === 'vitest')
    return inVitestGate(file) ? 'pnpm test:coverage' : null;
  if (kind === 'pgtap') {
    return /\.sql$/u.test(file) || includes.has(file) ? 'pnpm db:test' : null;
  }
  if (kind === 'playwright') return playwrightGate(file);
  return null;
};

/** Criterion numbers a marker group such as [P2-S09-AC-219, AC-242, 243] names. */
export const idsIn = (text: string): Set<number> => {
  const ids = new Set<number>();
  for (const [, id] of text.matchAll(/P2-S09-AC-(\d{3,4})(?!\d)/gu)) {
    ids.add(Number(id));
  }
  for (const [group] of text.matchAll(/\[P2-S09-AC-[^\]\n]{0,300}\]/gu)) {
    for (const [, id] of group.matchAll(/(?:AC-?|,\s*)(\d{3,4})(?!\d)/gu)) {
      ids.add(Number(id));
    }
  }
  return ids;
};

export const normalise = (text: string): string =>
  text.replace(/\\(.)/gu, '$1').replace(/\s+/gu, ' ').trim();

/**
 * The criterion title is produced at run time: a literal filled in by it.each
 * (%s), a template (${}), or an it.each table whose rows carry the marker.
 */
export const hasParameterizedTitle = (source: string, id: number): boolean =>
  (idsIn(source).has(id) && /\.each\b/u.test(source)) ||
  [
    ...source.matchAll(
      /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/gu,
    ),
  ].some(
    ([literal]) =>
      /%[sdifjo#]|\$\{/u.test(literal) &&
      (idsIn(literal).has(id) || /P2-S09-AC-(?:\$\{|%[sid])/u.test(literal)),
  );

/** `observed` carries a failure count above zero. */
export const FAILURE_COUNT =
  /(?<![\d.])[1-9]\d*\s+(?:failed|failing|failures?)\b|\b(?:failed|failures?)\s*[:=]\s*[1-9]/iu;

/** Criterion wording that depends on computed layout, focus or a real browser. */
export const ENVIRONMENTAL =
  /production-built|\bChrome\b|real browser|\b\d+\s*px\b|CSS px|reflow|viewport|virtual keyboard|Shift\+Tab|real Tab|browser history/iu;

export const COMPOSITION =
  /composeProduction|dec111-composition\.test-support|production-test-support|countingRateLimiter|createWorld\(/u;

/**
 * Error-mapping tables and the statuses whose condition they are told: the session,
 * limiter, port or provider is stubbed to return the refusal, so the table proves
 * the mapping only. Rows for the other statuses (400, 413, 415, 422 ...) send a
 * real request that the production admission pipeline refuses.
 */
export const MAPPING_ONLY_TABLES: Readonly<Record<string, readonly number[]>> =
  {
    'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts':
      [401, 403, 404, 409, 429, 502, 503, 504],
    'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts':
      [404, 409, 429],
  };
export const MAPPING_ONLY_FILES: readonly string[] =
  Object.keys(MAPPING_ONLY_TABLES);

/** The HTTP status a "returns NNN CODE" error-row criterion states. */
export const statusOfRow = (text: string): number | null => {
  const match = /\breturns (\d{3}) [A-Z_]+/u.exec(text);
  return match === null ? null : Number(match[1]);
};

export type Rows = Readonly<{
  all: ReadonlySet<number>;
  checked: ReadonlySet<number>;
  text: ReadonlyMap<number, string>;
}>;

/** Criterion rows `- [ ] **P2-S09-AC-NNN** ...` of a plan or tracker file. */
export const rowsOf = (path: string): Rows => {
  const all = new Set<number>();
  const checked = new Set<number>();
  const text = new Map<number, string>();
  for (const line of read(path).split(/\r?\n/u)) {
    const match = /^- \[([ x])\] \*\*P2-S09-AC-(\d{3,4})\*\*(.*)$/u.exec(line);
    if (match === null) continue;
    const id = Number(match[2]);
    all.add(id);
    text.set(id, match[3] ?? '');
    if (match[1] === 'x') checked.add(id);
  }
  return { all, checked, text };
};
