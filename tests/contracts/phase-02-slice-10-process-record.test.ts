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
  layerProblems,
  parseRecord,
  realFiles,
  structureProblems,
  validateLineProblems,
  validateProblems,
  type Files,
  type GateInputs,
} from './phase-02-slice-10-process-record.test-support';

/**
 * Guard for P2-S10-AC-059: "Execute Contract → QA-RED → data, API, SSR and island
 * implementation → QA-GREEN → refactor; retain failing-test evidence and run canonical
 * validation." The record (RECORD_PATH) is compiled from the lane reports; this guard proves
 * it is complete, that every failing test it names still exists, and that the canonical
 * validation gate that would run them is wired. It cannot prove the chronology, and it does
 * not prove that `pnpm validate` has been run: the record's "canonical validate:" line is
 * filled by the orchestrator at closure.
 */
const record = realFiles.read(RECORD_PATH);
const tracker = readRoot(
  '.memory/pipeline/progress/slices/phase-02-slice-10.md',
);
const packageJson = JSON.parse(readRoot('package.json')) as {
  scripts: Record<string, string>;
};

const withoutSection = (text: string, id: string): string =>
  text.replace(new RegExp(`^### ${id}: [\\s\\S]*?(?=^### |^## )`, 'mu'), '');

/** Replaces one line of one work package. */
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

const realGate = (): GateInputs => ({
  validate: packageJson.scripts.validate ?? '',
  coverageScript: packageJson.scripts['test:coverage'] ?? '',
  inGate: inVitestGate,
  guardSource: realFiles.exists(GUARD_TEST) ? realFiles.read(GUARD_TEST) : '',
  guardExists: realFiles.exists(GUARD_TEST),
});

describe('Slice 10 process record (P2-S10-AC-059)', () => {
  it('the red-green record exists, names its eight lane-report sources and carries the canonical validate line', () => {
    expect(realFiles.exists(RECORD_PATH)).toBe(true);
    for (const report of LANE_REPORTS) expect(record).toContain(report);
    expect(record).toMatch(/^- canonical validate: \S/mu);
    expect(record).toMatch(/^## Canonical validation$/mu);
    expect(record).toMatch(/^## Characterization and spec-only work/mu);
  });

  it('every required work package records its contract first, then a RED entry with an observed failure, then GREEN', () => {
    const packages = parseRecord(record);
    expect(REQUIRED_WORK_PACKAGES).toHaveLength(47);
    for (const id of REQUIRED_WORK_PACKAGES)
      expect(packages.has(id)).toBe(true);
    expect(structureProblems(record, realFiles)).toEqual([]);
  });

  it('every RED identity named by the record still exists as a test title in its file', () => {
    const named = REQUIRED_WORK_PACKAGES.flatMap(
      (id) => parseRecord(record).get(id)?.reds ?? [],
    );
    expect(named.length).toBeGreaterThanOrEqual(REQUIRED_WORK_PACKAGES.length);
    expect(identityProblems(record, realFiles)).toEqual([]);
  });

  it('the required work packages cover the data, API, SSR and island layers and at least three record a refactor', () => {
    expect(REQUIRED_LAYERS).toEqual(['data', 'api', 'ssr', 'island']);
    expect(layerProblems(record)).toEqual([]);
  });

  it('refuses a record that drops a work package, a RED line, a GREEN line, an observed failure or the contract line', () => {
    expect(
      structureProblems(withoutSection(record, 'H05'), realFiles),
    ).toContain('H05: no work-package section');
    const noRed = editLine(record, 'H06', '- RED', null);
    expect(structureProblems(noRed, realFiles)).toContain('H06: no RED entry');
    const noGreen = editLine(record, 'N03', '- GREEN: ', null);
    expect(structureProblems(noGreen, realFiles)).toContain(
      'N03: no GREEN result',
    );
    const noContract = editLine(record, 'P02', '- Contract first: ', null);
    expect(structureProblems(noContract, realFiles)).toContain(
      'P02: Contract first is missing or empty',
    );
    const unobserved = editLine(
      record,
      'Q01',
      '- RED: ',
      '- RED: `tests/documentation-boundaries.test.ts` :: `documents every non-generated directory with more than two direct files` => ',
    );
    expect(
      structureProblems(unobserved, realFiles).some((problem) =>
        problem.startsWith('Q01: the RED documents every'),
      ),
    ).toBe(true);
    expect(
      structureProblems(
        record.replace('- canonical validate: ', '- x: '),
        realFiles,
      ),
    ).toContain('the record has no "- canonical validate:" line');
    expect(
      structureProblems(
        record.replaceAll('lane-q-report.md', 'lane-x'),
        realFiles,
      )[0],
    ).toBe('the record does not name lane-q-report.md');
  });

  it('refuses a GREEN written before the RED and a contract line that names a file that does not exist', () => {
    const reds = parseRecord(record).get('H04')?.reds ?? [];
    const redLine = `- RED (fragment): \`${reds[0]?.file ?? ''}\` :: \`${reds[0]?.identity ?? ''}\` => ${reds[0]?.observed ?? ''}`;
    const swapped = editLine(
      editLine(record, 'H04', '- RED', null),
      'H04',
      '- Refactor: ',
      `- GREEN: late result entered before the failure\n${redLine}\n- Refactor: none reported`,
    );
    expect(structureProblems(swapped, realFiles)).toContain(
      'H04: the entries are not in the order Contract first, RED, GREEN',
    );
    const ghost = editLine(
      record,
      'H03',
      '- Contract first: ',
      '- Contract first: spec `.memory/wiki/specs/be/no-such-contract.md` was written first',
    );
    expect(structureProblems(ghost, realFiles)).toContain(
      'H03: the contract file .memory/wiki/specs/be/no-such-contract.md does not exist',
    );
  });

  it('refuses a RED identity that was renamed, whose quotes are gone, or whose file is gone', () => {
    const red = parseRecord(record).get('H06')?.reds[0];
    expect(red?.file).toBe(
      'supabase/tests/phase_02_slice_10_successor_create.sql',
    );
    const file = red?.file ?? '';
    const source = realFiles.read(file);
    const identity = red?.identity ?? '';
    const renamed = source.replace(identity, `${identity} (renamed)`);
    expect(identityProblems(record, filesWith(file, renamed))).toContain(
      `H06: ${file} has no title "${identity}"`,
    );
    const unquoted = source.replace(`'${identity}'`, identity);
    expect(identityProblems(record, filesWith(file, unquoted))).toContain(
      `H06: ${file} has no title "${identity}"`,
    );
    expect(identityProblems(record, filesWith(file, null))).toContain(
      `H06: ${file} does not exist`,
    );
    const fragment = parseRecord(record).get('H04')?.reds[0];
    const fragmentFile = fragment?.file ?? '';
    const fragmentSource = realFiles.read(fragmentFile);
    expect(fragment?.mode).toBe('fragment');
    expect(
      identityProblems(
        record,
        filesWith(
          fragmentFile,
          fragmentSource.replace(fragment?.identity ?? '', 'changed'),
        ),
      ),
    ).toContain(
      `H04: ${fragmentFile} has no fragment "${fragment?.identity ?? ''}"`,
    );
  });

  it('refuses a layer that no required work package covers and a record with fewer than three refactors', () => {
    const onlyData = record.replace(/^- Layer: ssr$/gmu, '- Layer: island');
    expect(layerProblems(onlyData)).toContain(
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
      /`pnpm validate` exit 0 on 2026-10-08 \(\d{2}:\d{2} UTC\)/u,
    );
    expect(line).toMatch(
      /vitest coverage [\d,]+ files \/ [\d,]+ tests at 100% thresholds/u,
    );
    expect(validateLineProblems(record, tracker)).toEqual([]);
  });

  it('refuses the old placeholder, a non-zero exit, a missing date or count, a run before the record and a tracker without the closure date', () => {
    const line = /^- canonical validate: .*$/mu.exec(record)?.[0] ?? '';
    const swap = (replacement: string): string =>
      record.replace(line, replacement);
    const placeholder = swap('- canonical validate: see Completion Signature');
    expect(validateLineProblems(placeholder, tracker)).toEqual(
      expect.arrayContaining([
        'the canonical-validate line does not record "`pnpm validate` exit 0 on <date> (<hh:mm> UTC)"',
        'the canonical-validate line has no positive count for vitest coverage files',
        'the canonical-validate line has no positive count for PostgREST tests',
      ]),
    );
    expect(
      validateLineProblems(swap(line.replace('exit 0', 'exit 1')), tracker),
    ).toEqual(
      expect.arrayContaining([
        'the canonical-validate line records a non-zero exit',
      ]),
    );
    expect(
      validateLineProblems(
        swap(line.replace('2026-10-08 (09:53 UTC)', '(09:53 UTC)')),
        tracker,
      ),
    ).toContain(
      'the canonical-validate line does not record "`pnpm validate` exit 0 on <date> (<hh:mm> UTC)"',
    );
    expect(
      validateLineProblems(
        swap(
          line.replace(
            /vitest coverage [\d,]+ files/u,
            'vitest coverage 0 files',
          ),
        ),
        tracker,
      ),
    ).toContain(
      'the canonical-validate line has no positive count for vitest coverage files',
    );
    expect(
      validateLineProblems(
        swap(
          line.replace(
            /real-route Playwright \d+ passed/u,
            'real-route Playwright passed',
          ),
        ),
        tracker,
      ),
    ).toContain(
      'the canonical-validate line has no positive count for real-route Playwright',
    );
    expect(
      validateLineProblems(
        swap(line.replace('2026-10-08', '2026-10-07')),
        tracker,
      ),
    ).toContain('the canonical-validate run predates the record (2026-10-08)');
    expect(
      validateLineProblems(record, tracker.replaceAll('2026-10-08', 'then')),
    ).toContain('the tracker does not carry the closure date 2026-10-08');
    expect(validateLineProblems('no such line', tracker)).toEqual([
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

  it('the Slice 10 evidence guard runs inside the vitest gate of pnpm validate', () => {
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
        'the guard test does not define the Slice 10 evidence guard',
        'the guard test is skipped, marked todo/only or expected to fail',
      ]),
    );
  });
});
