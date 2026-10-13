import {
  LAYERS,
  REQUIRED_LAYERS,
  identityExistsIn,
  parseRecord,
  validateLineProblems as baseValidateLineProblems,
  type Files,
  type WorkPackage,
} from './phase-02-slice-10-process-record.test-support';

/**
 * Checks of the Slice 11 RED to GREEN record (P2-S11-AC-044). The record is a Markdown file of
 * work-package sections in the Slice 10 format, so parsing, title lookup and the canonical-validate
 * line reuse the Slice 10 support. What differs is what is required: the Slice 11 work packages,
 * the lane reports they are compiled from (two handoff directories, one per session) and the gate
 * that runs the Slice 11 evidence guard. Every check is a pure function of the record text plus an
 * injected file system, so the guard test can feed it mutated records.
 */
export {
  CANONICAL_GATES,
  REQUIRED_LAYERS,
  parseRecord,
  realFiles,
  validateProblems,
  type Files,
} from './phase-02-slice-10-process-record.test-support';

export const RECORD_PATH =
  '.memory/pipeline/progress/verification/2026-10-12-slice-11-red-green-record.md';

/** The date of the record: no canonical validation run may predate it. */
export const RECORD_DATE = '2026-10-12';

export const CLAUDE_LANE_DIR = 'docs/handoffs/2026-10-10-claude-s11';
export const CODEX_LANE_DIR =
  'docs/handoffs/2026-10-08-phase2-codex-handoff/s11';

/** The lane reports of the Claude session (from 618ec5c1) the record is compiled from. */
export const CLAUDE_LANE_REPORTS = [
  'lane-a11y-status-report.md',
  'lane-assign-report.md',
  'lane-bench-report.md',
  'lane-bench2-report.md',
  'lane-bundle-report.md',
  'lane-checker-report.md',
  'lane-dep502-report.md',
  'lane-e2e-report.md',
  'lane-evidence-gaps-report.md',
  'lane-fe-report.md',
  'lane-finisher-report.md',
  'lane-gates-report.md',
  'lane-integration-report.md',
  'lane-last-gaps-report.md',
  'lane-lease-report.md',
  'lane-misc-report.md',
  'lane-order-report.md',
  'lane-preflight-cursor-report.md',
  'lane-preview-projection-report.md',
  'lane-publication-report.md',
  'lane-queue-perf-report.md',
  'lane-recheck-report.md',
  'lane-reviewA-2-report.md',
  'lane-reviewA1-report.md',
  'lane-reviewB-1-report.md',
  'lane-reviewB-2-report.md',
  'lane-sql-small-report.md',
  'lane-worker-report.md',
] as const;

/** The lane reports of the earlier Codex session (before 618ec5c1) the record is compiled from. */
export const CODEX_LANE_REPORTS = [
  'lane-s11-0-report.md',
  'lane-s11-1-report.md',
  'lane-s11-1r-report.md',
  'lane-s11-2-report.md',
  'lane-s11-3a-report.md',
  'lane-s11-3b-report.md',
  'lane-s11-3c-report.md',
  'lane-s11-3d-report.md',
  'lane-s11-3s-report.md',
  'lane-s11-4-report.md',
  'lane-s11-4a-report.md',
  'lane-s11-4r-report.md',
  'lane-s11-5-report.md',
  'lane-s11-g-report.md',
  'lane-s11-sr-report.md',
] as const;

export const LANE_REPORTS: readonly string[] = [
  ...CLAUDE_LANE_REPORTS,
  ...CODEX_LANE_REPORTS,
];

const range = (prefix: string, from: number, to: number): string[] =>
  Array.from(
    { length: to - from + 1 },
    (_, index) => `${prefix}${String(from + index).padStart(2, '0')}`,
  );

/** Every Slice 11 work package that has a RED in a lane report. */
export const REQUIRED_WORK_PACKAGES: readonly string[] = [
  ...range('Z', 51, 99),
  ...range('A', 1, 1),
  ...range('C', 1, 2),
  ...range('F', 1, 3),
  ...range('L', 1, 2),
  ...range('P', 1, 4),
  ...range('R', 1, 3),
  ...range('S', 1, 1),
  ...range('V', 1, 4),
  ...range('G', 1, 2),
  ...range('H', 1, 2),
  ...range('J', 1, 2),
  ...range('K', 1, 2),
  ...range('D', 1, 2),
  ...range('Q', 1, 1),
  ...range('E', 1, 4),
  ...range('M', 1, 1),
  ...range('N', 1, 1),
  ...range('T', 1, 1),
  ...range('X', 1, 3),
  ...range('U', 1, 2),
  ...range('I', 1, 2),
  ...range('B', 1, 2),
  ...range('O', 1, 3),
  ...range('Y', 1, 6),
];

export const GUARD_TEST =
  'tests/contracts/phase-02-slice-11-evidence-guard.test.ts';

/** The directory a lane report lives in. */
export const laneReportPath = (report: string): string =>
  `${(CODEX_LANE_REPORTS as readonly string[]).includes(report) ? CODEX_LANE_DIR : CLAUDE_LANE_DIR}/${report}`;

/** Problems with one work package: its sections, their order and the paths its contract line names. */
const packageProblems = (pkg: WorkPackage, files: Files): string[] => {
  const problems: string[] = [];
  const at = pkg.id;
  if (!(LAYERS as readonly string[]).includes(pkg.layer))
    problems.push(
      `${at}: Layer "${pkg.layer}" is not one of ${LAYERS.join(', ')}`,
    );
  if (!LANE_REPORTS.some((report) => pkg.source.startsWith(`${report} `)))
    problems.push(`${at}: Source does not name one of the lane reports`);
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

/** Every problem of the record: the sources, the canonical-validate line and each package. */
export const structureProblems = (text: string, files: Files): string[] => {
  const problems: string[] = [];
  for (const report of LANE_REPORTS) {
    if (!text.includes(report))
      problems.push(`the record does not name ${report}`);
    else if (!files.exists(laneReportPath(report)))
      problems.push(`${laneReportPath(report)} does not exist`);
  }
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

/** The RED identities of every required package that no longer exist as a title or fragment. */
export const identityProblems = (text: string, files: Files): string[] => {
  const problems: string[] = [];
  const packages = parseRecord(text);
  for (const id of REQUIRED_WORK_PACKAGES) {
    for (const red of packages.get(id)?.reds ?? []) {
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

/** The data, API, SSR and island layers must each be covered, and at least three packages record a refactor. */
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

export type GateInput = Readonly<{
  validate: string;
  coverageScript: string;
  /** Does the vitest configuration include this file? */
  inGate: (file: string) => boolean;
  guardSource: string;
  guardExists: boolean;
}>;

/** The Slice 11 evidence guard runs inside `pnpm test:coverage`, which `pnpm validate` runs. */
export const guardGateProblems = (input: GateInput): string[] => {
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
      !/defineSliceEvidenceGuard\(\{[^}]*slice: '11'/u.test(input.guardSource)
    )
      problems.push(
        'the guard test does not define the Slice 11 evidence guard',
      );
    if (/\.(?:skip|todo|only|fails)\b/u.test(input.guardSource))
      problems.push(
        'the guard test is skipped, marked todo/only or expected to fail',
      );
  }
  return problems;
};

/**
 * The orchestrator's closure line: `pnpm validate` exit 0 with its date and the gate counts. It is
 * an attestation (a test cannot run `pnpm validate` inside the vitest gate it belongs to), so the
 * checks refuse everything that is not an explicit, dated, counted exit 0 and require the tracker
 * to carry the same closure date. The format is the Slice 10 one; only the earliest date differs.
 */
export const validateLineProblems = (
  text: string,
  tracker: string,
): string[] => {
  const problems = baseValidateLineProblems(text, tracker);
  const line = /^- canonical validate: (.*)$/mu.exec(text)?.[1] ?? '';
  const date = /`pnpm validate` exit 0 on (\d{4}-\d{2}-\d{2})/u.exec(line)?.[1];
  if (date !== undefined && date < RECORD_DATE)
    problems.push(
      `the canonical-validate run predates the record (${RECORD_DATE})`,
    );
  return problems;
};
