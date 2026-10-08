import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Parser and checks for the Slice 10 RED to GREEN record (P2-S10-AC-059).
 * The record is a Markdown file of work-package sections; every check here is a pure
 * function of the record text plus an injected file system, so the guard test can feed
 * it mutated records and prove each check refuses what it claims to refuse.
 */
export const ROOT = resolve(import.meta.dirname, '../..');

export const RECORD_PATH =
  '.memory/pipeline/progress/verification/2026-10-08-slice-10-red-green-record.md';

export const LANE_REPORTS = [
  'lane-ea-report.md',
  'lane-eb-report.md',
  'lane-ec-report.md',
  'lane-h-report.md',
  'lane-l-report.md',
  'lane-n-report.md',
  'lane-p-report.md',
  'lane-q-report.md',
] as const;

export const LAYERS = [
  'data',
  'api',
  'ssr',
  'island',
  'e2e',
  'guard',
  'evidence',
] as const;
export type Layer = (typeof LAYERS)[number];

/** The layers the criterion names: "data, API, SSR and island implementation". */
export const REQUIRED_LAYERS: readonly Layer[] = [
  'data',
  'api',
  'ssr',
  'island',
];

const ids = (prefix: string, count: number): string[] =>
  Array.from(
    { length: count },
    (_, index) => `${prefix}${String(index + 1).padStart(2, '0')}`,
  );

/** Every Slice 10 work package that has a RED in the lane reports (lane H, N, P, Q and the EA mutation proof). */
export const REQUIRED_WORK_PACKAGES: readonly string[] = [
  ...ids('H', 21),
  ...ids('N', 18),
  ...ids('P', 4),
  ...ids('Q', 3),
  ...ids('E', 1),
];

/** Every gate `pnpm validate` must run, in the order it runs them. */
export const CANONICAL_GATES: readonly string[] = [
  'pnpm contracts:check',
  'pnpm db:types:check',
  'pnpm progress:check',
  'pnpm format:check',
  'pnpm lint',
  'pnpm type-check',
  'pnpm test:coverage',
  'pnpm test:evidence:s09',
  'pnpm test:e2e',
  'pnpm build',
  'pnpm bundle:check',
  'pnpm performance:smoke',
];

export const GUARD_TEST =
  'tests/contracts/phase-02-slice-10-evidence-guard.test.ts';

export type RedEntry = Readonly<{
  file: string;
  identity: string;
  mode: 'title' | 'fragment';
  observed: string;
}>;

export type WorkPackage = Readonly<{
  id: string;
  heading: string;
  layer: string;
  source: string;
  contract: string;
  reds: readonly RedEntry[];
  green: readonly string[];
  refactor: readonly string[];
  /** The order the keys appear in: Contract first, RED, GREEN. */
  order: readonly string[];
}>;

export type Files = Readonly<{
  exists: (relativePath: string) => boolean;
  read: (relativePath: string) => string;
}>;

export const realFiles: Files = {
  exists: (relativePath) => existsSync(resolve(ROOT, relativePath)),
  read: (relativePath) => readFileSync(resolve(ROOT, relativePath), 'utf8'),
};

const RED_LINE = /^- RED( \(fragment\))?: `([^`]+)` :: `([^`]+)` => (.*)$/u;

export const parseRecord = (text: string): Map<string, WorkPackage> => {
  const packages = new Map<string, WorkPackage>();
  for (const block of text.split(/^### /mu).slice(1)) {
    const lines = block.split('\n');
    const heading = lines[0] ?? '';
    const id = /^([A-Z]\d{2}): /u.exec(heading)?.[1];
    if (id === undefined) continue;
    const reds: RedEntry[] = [];
    const green: string[] = [];
    const refactor: string[] = [];
    const order: string[] = [];
    let layer = '';
    let source = '';
    let contract = '';
    for (const line of lines.slice(1)) {
      const red = RED_LINE.exec(line);
      if (red !== null) {
        reds.push({
          file: red[2] ?? '',
          identity: red[3] ?? '',
          mode: red[1] === undefined ? 'title' : 'fragment',
          observed: (red[4] ?? '').trim(),
        });
        order.push('RED');
      } else if (line.startsWith('- Layer: ')) layer = line.slice(9).trim();
      else if (line.startsWith('- Source: ')) source = line.slice(10).trim();
      else if (line.startsWith('- Contract first: ')) {
        contract = line.slice(18).trim();
        order.push('Contract');
      } else if (line.startsWith('- GREEN: ')) {
        green.push(line.slice(9).trim());
        order.push('GREEN');
      } else if (line.startsWith('- Refactor: '))
        refactor.push(line.slice(12).trim());
    }
    packages.set(id, {
      id,
      heading,
      layer,
      source,
      contract,
      reds,
      green,
      refactor,
      order,
    });
  }
  return packages;
};

/** The quoted forms a title can take inside a source file (plain, SQL-doubled, JavaScript-escaped). */
const encodings = (identity: string): string[] => [
  identity,
  identity.replaceAll("'", "''"),
  identity
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('"', '\\"')
    .replaceAll('`', '\\`'),
];

export const identityExistsIn = (red: RedEntry, source: string): boolean =>
  red.mode === 'fragment'
    ? encodings(red.identity).some((form) => source.includes(form))
    : encodings(red.identity).some((form) =>
        ["'", '"', '`'].some((quote) =>
          source.includes(`${quote}${form}${quote}`),
        ),
      );

/** Problems with one work package: its sections, their order and the paths its contract line names. */
const packageProblems = (pkg: WorkPackage, files: Files): string[] => {
  const problems: string[] = [];
  const at = `${pkg.id}`;
  if (!(LAYERS as readonly string[]).includes(pkg.layer))
    problems.push(
      `${at}: Layer "${pkg.layer}" is not one of ${LAYERS.join(', ')}`,
    );
  if (!/lane-[a-z]+-report\.md/u.test(pkg.source))
    problems.push(`${at}: Source names no lane report`);
  if (pkg.contract.length < 20)
    problems.push(`${at}: Contract first is missing or empty`);
  for (const path of pkg.contract.matchAll(
    /`([^`\s]+\/[^`\s]+\.[A-Za-z]+)`/gu,
  )) {
    const file = path[1] ?? '';
    if (!files.exists(file))
      problems.push(`${at}: the contract file ${file} does not exist`);
  }
  if (pkg.reds.length === 0) problems.push(`${at}: no RED entry`);
  for (const red of pkg.reds)
    if (red.observed.length < 15)
      problems.push(`${at}: the RED ${red.identity} has no observed failure`);
  if (pkg.green.length === 0 || pkg.green.some((line) => line.length < 15))
    problems.push(`${at}: no GREEN result`);
  const contractAt = pkg.order.indexOf('Contract');
  const firstRed = pkg.order.indexOf('RED');
  const lastRed = pkg.order.lastIndexOf('RED');
  const firstGreen = pkg.order.indexOf('GREEN');
  if (!(contractAt === 0 && firstRed > contractAt && firstGreen > lastRed))
    problems.push(
      `${at}: the entries are not in the order Contract first, RED, GREEN`,
    );
  return problems;
};

/** Every problem of the record: structure first, then the identities. */
export const structureProblems = (text: string, files: Files): string[] => {
  const problems: string[] = [];
  for (const report of LANE_REPORTS)
    if (!text.includes(report))
      problems.push(`the record does not name ${report}`);
  if (!/^- canonical validate: \S/mu.test(text))
    problems.push('the record has no "- canonical validate:" line');
  const packages = parseRecord(text);
  for (const id of REQUIRED_WORK_PACKAGES) {
    const pkg = packages.get(id);
    if (pkg === undefined) problems.push(`${id}: no work-package section`);
    else problems.push(...packageProblems(pkg, files));
  }
  return problems;
};

export const identityProblems = (text: string, files: Files): string[] => {
  const problems: string[] = [];
  for (const id of REQUIRED_WORK_PACKAGES) {
    for (const red of parseRecord(text).get(id)?.reds ?? []) {
      if (!files.exists(red.file)) {
        problems.push(`${id}: ${red.file} does not exist`);
      } else if (!identityExistsIn(red, files.read(red.file))) {
        problems.push(
          `${id}: ${red.file} has no ${red.mode} "${red.identity}"`,
        );
      }
    }
  }
  return problems;
};

export const layerProblems = (text: string): string[] => {
  const packages = parseRecord(text);
  const present = new Set(
    REQUIRED_WORK_PACKAGES.map((id) => packages.get(id)?.layer),
  );
  const problems = REQUIRED_LAYERS.filter((layer) => !present.has(layer)).map(
    (layer) => `no required work package covers the ${layer} layer`,
  );
  const refactors = REQUIRED_WORK_PACKAGES.filter((id) =>
    (packages.get(id)?.refactor ?? []).some(
      (line) => line.length > 0 && !/^none reported/iu.test(line),
    ),
  );
  if (refactors.length < 3)
    problems.push(
      `only ${String(refactors.length)} work packages record a refactor (3 required)`,
    );
  return problems;
};

export type GateInputs = Readonly<{
  validate: string;
  coverageScript: string;
  /** Does the vitest configuration include this file? */
  inGate: (file: string) => boolean;
  guardSource: string;
  guardExists: boolean;
}>;

export const validateProblems = (validate: string): string[] =>
  CANONICAL_GATES.filter(
    (gate) => !new RegExp(`(?:^|&& )${gate}(?: &&|$)`, 'u').test(validate),
  ).map((gate) => `pnpm validate does not run ${gate}`);

/** The Slice 10 evidence guard runs inside `pnpm test:coverage`, which `pnpm validate` runs. */
export const guardGateProblems = (input: GateInputs): string[] => {
  const problems: string[] = [];
  if (!/(?:^|&& )pnpm test:coverage(?: &&|$)/u.test(input.validate))
    problems.push('pnpm validate does not run pnpm test:coverage');
  if (!/^vitest run --coverage$/u.test(input.coverageScript.trim()))
    problems.push(
      `pnpm test:coverage is "${input.coverageScript}", not a plain "vitest run --coverage" (no --config, --exclude, --dir or file filter)`,
    );
  if (!input.guardExists) problems.push(`${GUARD_TEST} does not exist`);
  else {
    if (!input.inGate(GUARD_TEST))
      problems.push(`vitest.config.ts includes no pattern for ${GUARD_TEST}`);
    if (
      !/defineSliceEvidenceGuard\(\{[^}]*slice: '10'/u.test(input.guardSource)
    )
      problems.push(
        'the guard test does not define the Slice 10 evidence guard',
      );
    if (/\.(?:skip|todo|only|fails)\b/u.test(input.guardSource))
      problems.push(
        'the guard test is skipped, marked todo/only or expected to fail',
      );
  }
  return problems;
};

const COUNT = '([\\d,]+)';
const toNumber = (digits: string | undefined): number =>
  Number((digits ?? '').replaceAll(',', ''));

/**
 * The orchestrator's closure line: `pnpm validate` exit 0 with its date and the gate counts.
 * The line is an attestation (a test cannot run `pnpm validate` inside the vitest gate it
 * belongs to), so the checks refuse everything that is not an explicit, dated, counted exit 0
 * and require the tracker to carry the same closure date.
 */
export const validateLineProblems = (
  text: string,
  tracker: string,
): string[] => {
  const line = /^- canonical validate: (.*)$/mu.exec(text)?.[1];
  if (line === undefined)
    return ['the record has no "- canonical validate:" line'];
  const problems: string[] = [];
  const run =
    /`pnpm validate` exit 0 on (\d{4}-\d{2}-\d{2}) \((\d{2}:\d{2}) UTC\)/u.exec(
      line,
    );
  if (run === null)
    problems.push(
      'the canonical-validate line does not record "`pnpm validate` exit 0 on <date> (<hh:mm> UTC)"',
    );
  else if (Number.isNaN(Date.parse(`${run[1] ?? ''}T${run[2] ?? ''}:00Z`)))
    problems.push(`the canonical-validate date ${run[1] ?? ''} is not a date`);
  else if ((run[1] ?? '') < '2026-10-08')
    problems.push(
      'the canonical-validate run predates the record (2026-10-08)',
    );
  else if (!tracker.includes(run[1] ?? ''))
    problems.push(
      `the tracker does not carry the closure date ${run[1] ?? ''}`,
    );
  const counts: readonly (readonly [string, RegExp])[] = [
    [
      'vitest coverage files',
      new RegExp(`vitest coverage ${COUNT} files`, 'u'),
    ],
    [
      'vitest coverage tests',
      new RegExp(`files / ${COUNT} tests at 100% thresholds`, 'u'),
    ],
    ['functional Playwright', /functional Playwright (\d+) passed/u],
    ['real-route Playwright', /real-route Playwright (\d+) passed/u],
    ['pgTAP files', new RegExp(`pgTAP ${COUNT} files`, 'u')],
    ['pgTAP tests', new RegExp(`pgTAP ${COUNT} files / ${COUNT}`, 'u')],
    ['PostgREST files', new RegExp(`PostgREST ${COUNT} / ${COUNT}`, 'u')],
    ['PostgREST tests', new RegExp(`PostgREST ${COUNT} / ${COUNT}`, 'u')],
  ];
  for (const [name, pattern] of counts) {
    const match = pattern.exec(line);
    const counted =
      name.endsWith('tests') && match !== null
        ? match[match.length - 1]
        : match?.[1];
    if (!(toNumber(counted) > 0))
      problems.push(
        `the canonical-validate line has no positive count for ${name}`,
      );
  }
  if (/\bexit [1-9]/u.test(line))
    problems.push('the canonical-validate line records a non-zero exit');
  return problems;
};
