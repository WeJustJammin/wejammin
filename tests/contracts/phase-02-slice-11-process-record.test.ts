import { describe, expect, it } from 'vitest';

import {
  inVitestGate,
  read as readRoot,
} from './phase-02-slice-09-amendment-evidence.test-support';
import {
  CANONICAL_GATES,
  GUARD_TEST,
  LANE_REPORTS,
  RECORD_PATH,
  REQUIRED_LAYERS,
  REQUIRED_WORK_PACKAGES,
  guardGateProblems,
  identityProblems,
  laneReportPath,
  layerProblems,
  parseRecord,
  realFiles,
  structureProblems,
  validateLineProblems,
  validateProblems,
  type Files,
  type GateInput,
} from './phase-02-slice-11-process-record.test-support';

/**
 * Guard for P2-S11-AC-044: "Execute Contract → QA-RED → data, API, SSR and island
 * implementation → QA-GREEN → refactor; retain failing-test evidence and run canonical
 * validation." The record (RECORD_PATH) is compiled from the lane reports of both sessions of
 * Slice 11; this guard proves it is complete, that every failing test it names still exists, and
 * that the canonical validation gate that would run them is wired. It cannot prove the
 * chronology, and it does not prove that `pnpm validate` has been run: the record's
 * "canonical validate:" line is filled by the orchestrator at closure, and the test of that line
 * fails until it is (it is the one assertion of this file that depends on the closure).
 */
const record = realFiles.read(RECORD_PATH);
const tracker = readRoot(
  '.memory/pipeline/progress/slices/phase-02-slice-11.md',
);
const packageJson = JSON.parse(readRoot('package.json')) as {
  scripts: Record<string, string>;
};
const packages = parseRecord(record);

const withoutSection = (text: string, id: string): string =>
  text.replace(new RegExp(`^### ${id}: [\\s\\S]*?(?=^### |^## )`, 'mu'), '');

/** Replaces (or, with null, removes) every line of one work package that starts with `startsWith`. */
const editLine = (
  text: string,
  id: string,
  startsWith: string,
  replacement: string | null,
): string => {
  const start = text.indexOf(`### ${id}: `);
  const end = text.indexOf('\n### ', start + 1);
  const block = text.slice(start, end === -1 ? undefined : end);
  const edited = block
    .split('\n')
    .flatMap((line) =>
      line.startsWith(startsWith)
        ? replacement === null
          ? []
          : [replacement]
        : [line],
    )
    .join('\n');
  return text.slice(0, start) + edited + text.slice(start + block.length);
};

/** A file system in which one file has other content, or is gone. */
const filesWith = (path: string, content: string | null): Files => ({
  exists: (relativePath) =>
    relativePath === path ? content !== null : realFiles.exists(relativePath),
  read: (relativePath) =>
    relativePath === path && content !== null
      ? content
      : realFiles.read(relativePath),
});

const realGate = (): GateInput => ({
  validate: packageJson.scripts.validate ?? '',
  coverageScript: packageJson.scripts['test:coverage'] ?? '',
  inGate: inVitestGate,
  guardSource: realFiles.exists(GUARD_TEST) ? realFiles.read(GUARD_TEST) : '',
  guardExists: realFiles.exists(GUARD_TEST),
});

/** The first required package for which `pick` answers true. */
const sample = (pick: (id: string) => boolean): string => {
  const found = REQUIRED_WORK_PACKAGES.find(pick);
  if (found === undefined) throw new Error('no sample package');
  return found;
};

describe('Slice 11 process record (P2-S11-AC-044)', () => {
  it('the red-green record exists, names its lane-report sources and carries the sections and the canonical validate line', () => {
    expect(realFiles.exists(RECORD_PATH)).toBe(true);
    expect(LANE_REPORTS.length).toBeGreaterThanOrEqual(40);
    for (const report of LANE_REPORTS) {
      expect(record, report).toContain(report);
      expect(realFiles.exists(laneReportPath(report)), report).toBe(true);
    }
    expect(record).toMatch(/^- canonical validate: \S/mu);
    expect(record).toMatch(/^## Sources and limits$/mu);
    expect(record).toMatch(/^## Canonical validation$/mu);
    expect(record).toMatch(/^## Characterization and spec-only work/mu);
  });

  it('every required work package records its contract first, then a RED entry with an observed failure, then GREEN', () => {
    expect(REQUIRED_WORK_PACKAGES).toHaveLength(105);
    expect(new Set(REQUIRED_WORK_PACKAGES).size).toBe(
      REQUIRED_WORK_PACKAGES.length,
    );
    for (const id of REQUIRED_WORK_PACKAGES)
      expect(packages.has(id), id).toBe(true);
    expect(structureProblems(record, realFiles)).toEqual([]);
  });

  it('the record holds no work package the guard does not require', () => {
    expect([...packages.keys()].sort()).toEqual(
      [...REQUIRED_WORK_PACKAGES].sort(),
    );
  });

  it('every RED identity named by the record still exists as a test title or fragment in its file', () => {
    const named = REQUIRED_WORK_PACKAGES.flatMap(
      (id) => packages.get(id)?.reds ?? [],
    );
    expect(named.length).toBeGreaterThanOrEqual(REQUIRED_WORK_PACKAGES.length);
    expect(identityProblems(record, realFiles)).toEqual([]);
  });

  it('the required work packages cover the data, API, SSR and island layers and at least three record a refactor', () => {
    expect(REQUIRED_LAYERS).toEqual(['data', 'api', 'ssr', 'island']);
    expect(layerProblems(record)).toEqual([]);
  });

  it('refuses a record that drops a work package, a RED line, a GREEN line, an observed failure, the contract line or a source', () => {
    const [first, second, third, fourth] = REQUIRED_WORK_PACKAGES;
    expect(
      structureProblems(withoutSection(record, first ?? ''), realFiles),
    ).toContain(`${first ?? ''}: no work-package section`);
    const noRed = editLine(record, second ?? '', '- RED', null);
    expect(structureProblems(noRed, realFiles)).toContain(
      `${second ?? ''}: no RED entry`,
    );
    const noGreen = editLine(record, third ?? '', '- GREEN: ', null);
    expect(structureProblems(noGreen, realFiles)).toContain(
      `${third ?? ''}: no GREEN result`,
    );
    const noContract = editLine(
      record,
      fourth ?? '',
      '- Contract first: ',
      null,
    );
    expect(structureProblems(noContract, realFiles)).toContain(
      `${fourth ?? ''}: Contract first is missing or empty`,
    );
    const red = packages.get(first ?? '')?.reds[0];
    const unobserved = editLine(
      record,
      first ?? '',
      '- RED',
      `- RED: \`${red?.file ?? ''}\` :: \`${red?.identity ?? ''}\` => `,
    );
    expect(
      structureProblems(unobserved, realFiles).some((problem) =>
        problem.startsWith(`${first ?? ''}: the RED `),
      ),
    ).toBe(true);
    expect(
      structureProblems(
        record.replace('- canonical validate: ', '- x: '),
        realFiles,
      ),
    ).toContain('the record has no "- canonical validate:" line');
    const report = LANE_REPORTS[0] ?? '';
    expect(
      structureProblems(record.replaceAll(report, 'lane-x'), realFiles)[0],
    ).toBe(`the record does not name ${report}`);
    const elsewhere = editLine(
      record,
      first ?? '',
      '- Source: ',
      '- Source: lane-nowhere-report.md (a report that is not a source)',
    );
    expect(structureProblems(elsewhere, realFiles)).toContain(
      `${first ?? ''}: Source does not name one of the lane reports`,
    );
  });

  it('refuses a GREEN written before the RED and a contract line that names a file that does not exist', () => {
    const id = sample(
      (candidate) => packages.get(candidate)?.reds[0] !== undefined,
    );
    const red = packages.get(id)?.reds[0];
    const redLine = `- RED: \`${red?.file ?? ''}\` :: \`${red?.identity ?? ''}\` => ${red?.observed ?? ''}`;
    const swapped = editLine(
      editLine(record, id, '- RED', null),
      id,
      '- Refactor: ',
      `- GREEN: late result entered before the failure\n${redLine}\n- Refactor: none reported`,
    );
    expect(structureProblems(swapped, realFiles)).toContain(
      `${id}: the entries are not in the order Contract first, RED, GREEN`,
    );
    const ghost = editLine(
      record,
      id,
      '- Contract first: ',
      '- Contract first: spec `.memory/wiki/specs/be/no-such-contract.md` was written first',
    );
    expect(structureProblems(ghost, realFiles)).toContain(
      `${id}: the contract file .memory/wiki/specs/be/no-such-contract.md does not exist`,
    );
  });

  it('refuses a RED identity that was renamed, whose quotes are gone, or whose file is gone', () => {
    const id = sample((candidate) => {
      const red = packages.get(candidate)?.reds[0];
      return (
        red?.mode === 'title' &&
        red.file.endsWith('.test.ts') &&
        !/['"`\\]/u.test(red.identity)
      );
    });
    const red = packages.get(id)?.reds[0];
    const file = red?.file ?? '';
    const identity = red?.identity ?? '';
    const source = realFiles.read(file);
    const renamed = source.replaceAll(identity, `${identity} (renamed)`);
    expect(identityProblems(record, filesWith(file, renamed))).toContain(
      `${id}: ${file} has no title "${identity}"`,
    );
    const unquoted = ["'", '"', '`'].reduce(
      (text, quote) => text.replaceAll(`${quote}${identity}${quote}`, identity),
      source,
    );
    expect(identityProblems(record, filesWith(file, unquoted))).toContain(
      `${id}: ${file} has no title "${identity}"`,
    );
    expect(identityProblems(record, filesWith(file, null))).toContain(
      `${id}: ${file} does not exist`,
    );
    const fragmentId = sample((candidate) =>
      (packages.get(candidate)?.reds ?? []).some(
        (entry) => entry.mode === 'fragment',
      ),
    );
    const fragment = packages
      .get(fragmentId)
      ?.reds.find((entry) => entry.mode === 'fragment');
    const fragmentFile = fragment?.file ?? '';
    expect(
      identityProblems(
        record,
        filesWith(
          fragmentFile,
          realFiles
            .read(fragmentFile)
            .replaceAll(fragment?.identity ?? '', 'changed'),
        ),
      ),
    ).toContain(
      `${fragmentId}: ${fragmentFile} has no fragment "${fragment?.identity ?? ''}"`,
    );
  });

  it('refuses a layer that no required work package covers and a record with fewer than three refactors', () => {
    const covering = (layer: string): string[] =>
      REQUIRED_WORK_PACKAGES.filter((id) => packages.get(id)?.layer === layer);
    const ssr = covering('ssr');
    let noSsr = record;
    for (const id of ssr)
      noSsr = editLine(noSsr, id, '- Layer: ', '- Layer: island');
    expect(layerProblems(noSsr)).toContain(
      'no required work package covers the ssr layer',
    );
    const noRefactor = record.replace(
      /^- Refactor: (?!none reported).*$/gmu,
      '- Refactor: none reported',
    );
    expect(layerProblems(noRefactor)).toContain(
      'only 0 work packages record a refactor (3 required)',
    );
  });

  it('the canonical-validate line records pnpm validate exit 0 with its date and every gate count, and the tracker carries the same date', () => {
    const line = /^- canonical validate: (.*)$/mu.exec(record)?.[1] ?? '';
    expect(line).toMatch(
      /`pnpm validate` exit 0 on 2026-10-\d{2} \(\d{2}:\d{2} UTC\)/u,
    );
    expect(line).toMatch(
      /vitest coverage [\d,]+ files \/ [\d,]+ tests at 100% thresholds/u,
    );
    expect(validateLineProblems(record, tracker)).toEqual([]);
  });

  it('refuses the placeholder, a non-zero exit, a missing date or count, a run before the record and a tracker without the closure date', () => {
    const synthetic =
      '- canonical validate: `pnpm validate` exit 0 on 2026-10-12 (09:00 UTC) on the integration checkout — vitest coverage 1,400 files / 16,500 tests at 100% thresholds, functional Playwright 110 passed, real-route Playwright 150 passed, pgTAP 368 files / 14,006 tests, PostgREST 73 / 869';
    const good = record.replace(/^- canonical validate: .*$/mu, synthetic);
    const goodTracker = `${tracker}\nClosed 2026-10-12.`;
    expect(validateLineProblems(good, goodTracker)).toEqual([]);
    const swap = (replacement: string): string =>
      good.replace(synthetic, replacement);
    expect(
      validateLineProblems(
        swap('- canonical validate: pending closure'),
        goodTracker,
      ),
    ).toEqual(
      expect.arrayContaining([
        'the canonical-validate line does not record "`pnpm validate` exit 0 on <date> (<hh:mm> UTC)"',
        'the canonical-validate line has no positive count for vitest coverage files',
        'the canonical-validate line has no positive count for PostgREST tests',
      ]),
    );
    expect(
      validateLineProblems(
        swap(synthetic.replace('exit 0', 'exit 1')),
        goodTracker,
      ),
    ).toContain('the canonical-validate line records a non-zero exit');
    expect(
      validateLineProblems(
        swap(synthetic.replace('2026-10-12 (09:00 UTC)', '(09:00 UTC)')),
        goodTracker,
      ),
    ).toContain(
      'the canonical-validate line does not record "`pnpm validate` exit 0 on <date> (<hh:mm> UTC)"',
    );
    expect(
      validateLineProblems(
        swap(
          synthetic.replace(
            /vitest coverage [\d,]+ files/u,
            'vitest coverage 0 files',
          ),
        ),
        goodTracker,
      ),
    ).toContain(
      'the canonical-validate line has no positive count for vitest coverage files',
    );
    expect(
      validateLineProblems(
        swap(synthetic.replace('2026-10-12', '2026-10-11')),
        goodTracker,
      ),
    ).toContain('the canonical-validate run predates the record (2026-10-12)');
    expect(
      validateLineProblems(good, tracker.replaceAll('2026-10-12', 'then')),
    ).toContain('the tracker does not carry the closure date 2026-10-12');
    expect(validateLineProblems('no such line', goodTracker)).toEqual([
      'the record has no "- canonical validate:" line',
    ]);
  });

  it('pnpm validate contains every canonical gate', () => {
    expect(CANONICAL_GATES).toHaveLength(12);
    expect(validateProblems(packageJson.scripts.validate ?? '')).toEqual([]);
    for (const gate of CANONICAL_GATES) {
      const without = (packageJson.scripts.validate ?? '')
        .split(' && ')
        .filter((step) => step !== gate)
        .join(' && ');
      expect(validateProblems(without)).toEqual([
        `pnpm validate does not run ${gate}`,
      ]);
    }
    expect(validateProblems('pnpm lint:fix && pnpm type-check')).toContain(
      'pnpm validate does not run pnpm lint',
    );
  });

  it('the Slice 11 evidence guard runs inside the vitest gate of pnpm validate', () => {
    const real = realGate();
    expect(real.guardExists).toBe(true);
    expect(real.inGate(GUARD_TEST)).toBe(true);
    expect(guardGateProblems(real)).toEqual([]);
  });

  it('refuses a validate without the vitest gate, a filtered vitest gate, an unconfigured guard and a skipped guard', () => {
    const real = realGate();
    expect(
      guardGateProblems({
        ...real,
        validate: real.validate.replace('pnpm test:coverage && ', ''),
      }),
    ).toContain('pnpm validate does not run pnpm test:coverage');
    expect(
      guardGateProblems({
        ...real,
        coverageScript: 'vitest run --coverage --exclude tests/contracts',
      })[0],
    ).toContain('not a plain "vitest run --coverage"');
    expect(guardGateProblems({ ...real, inGate: () => false })).toContain(
      `vitest.config.ts includes no pattern for ${GUARD_TEST}`,
    );
    expect(guardGateProblems({ ...real, guardExists: false })).toContain(
      `${GUARD_TEST} does not exist`,
    );
    expect(
      guardGateProblems({
        ...real,
        guardSource: real.guardSource.replace(
          'defineSliceEvidenceGuard(',
          'it.skip(',
        ),
      }),
    ).toEqual(
      expect.arrayContaining([
        'the guard test does not define the Slice 11 evidence guard',
        'the guard test is skipped, marked todo/only or expected to fail',
      ]),
    );
  });
});
