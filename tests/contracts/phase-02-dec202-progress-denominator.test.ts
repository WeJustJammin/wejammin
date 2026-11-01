// DEC-202 progress-denominator reconciliation (Slice 12 eleven-check cascade).
//
// Authoritative source:
//   .memory/pipeline/progress/verification/2026-10-17-slice-12-dec202-depth-floor.md
//
// The current Phase 2 denominators are derived from the criterion ROWS, not from
// broad historical mentions: the canonical plan holds 3,325 unique authored rows
// (Slice 12 = 296, AC001-AC296); exactly four Slice 09 external gates stay outside
// the active denominator, so active = 3,325 - 4 = 3,321. Authored, active and the
// Slice 12 ID range are fixed; the checked total and completion state stay dynamic
// so later implementation and closure are not frozen out. The current-policy
// headers of the plan, tracker, index, spec-pipeline and Slice 09 tracker must
// publish those derived numbers, and the read-only consistency checker must exit 0.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');

const PATHS = {
  plan: '.memory/wiki/specs/phases/phase-2.md',
  phaseTracker: '.memory/pipeline/progress/phases/phase-02.md',
  index: '.memory/pipeline/progress/index.md',
  specPipeline: '.memory/pipeline/progress/spec-pipeline.md',
  slice09: '.memory/pipeline/progress/slices/phase-02-slice-09.md',
  slice12: '.memory/pipeline/progress/slices/phase-02-slice-12.md',
  sliceDir: '.memory/pipeline/progress/slices',
  checker: 'scripts/check-progress-consistency.mjs',
} as const;

const read = (relative: string): string =>
  readFileSync(resolve(ROOT, relative), 'utf8');

const numeric = (value: string): number => Number(value.replaceAll(',', ''));

// Capture groups are typed `string | undefined` under noUncheckedIndexedAccess;
// the fallbacks surface as a meaningful NaN/'' assertion failure, never a mask.
const toNumber = (value: string | undefined): number =>
  value === undefined ? Number.NaN : numeric(value);

interface Row {
  readonly id: string;
  readonly slice: string;
  readonly checked: boolean;
}

const collectRows = (source: string): Row[] =>
  [
    ...source.matchAll(
      /^\s*-\s*\[([ x/!])\]\s+\*\*(P2-S(\d{2})-AC-(\d{3,4}))\*\*/gmu,
    ),
  ].map((match) => ({
    id: match[2] ?? '',
    slice: match[3] ?? '',
    checked: (match[1] ?? '') === 'x',
  }));

// The four authored Slice 09 gates that stay outside the active Phase 2
// implementation-completion denominator (DEC-101 / DEC-104 / DEC-105).
const EXTERNAL_GATES: readonly string[] = [
  'P2-S09-AC-209',
  'P2-S09-AC-211',
  'P2-S09-AC-265',
  'P2-S09-AC-266',
];

const isExternalGate = (id: string): boolean => EXTERNAL_GATES.includes(id);

const EXPECTED_AUTHORED_BY_SLICE: Readonly<Record<string, number>> = {
  '01': 103,
  '02': 47,
  '03': 301,
  '04': 156,
  '05': 258,
  '06': 121,
  '07': 176,
  '08': 51,
  '09': 1239,
  '10': 105,
  '11': 122,
  '12': 296,
  '13': 174,
  '14': 65,
  '15': 72,
  '16': 29,
  '17': 10,
};

const uniqueBySlice = (rows: readonly Row[]): Map<string, Set<string>> => {
  const bySlice = new Map<string, Set<string>>();
  for (const row of rows) {
    const ids = bySlice.get(row.slice) ?? new Set<string>();
    ids.add(row.id);
    bySlice.set(row.slice, ids);
  }
  return bySlice;
};

const authoredCounts = (rows: readonly Row[]): Record<string, number> =>
  Object.fromEntries(
    [...uniqueBySlice(rows)]
      .map(([slice, ids]) => [slice, ids.size] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

const rowLine = (source: string, id: string): string =>
  source.split(/\r?\n/u).find((line) => line.includes(`**${id}**`)) ?? '';

const boxOf = (line: string): string | undefined =>
  /^\s*-\s*\[([ x/!])\]/u.exec(line)?.[1];

const activeAuthored = (
  source: string,
  pattern: RegExp,
): readonly [number, number] | null => {
  const match = source.match(pattern);
  return match ? [toNumber(match[1]), toNumber(match[2])] : null;
};

const planSource = read(PATHS.plan);
const planRows = collectRows(planSource);
const planBySlice = uniqueBySlice(planRows);
const planAuthoredTotal = [...planBySlice.values()].reduce(
  (sum, ids) => sum + ids.size,
  0,
);
const planAuthoredBySlice = authoredCounts(planRows);

const externalPresentInPlan = EXTERNAL_GATES.filter((id) =>
  planBySlice.get('09')?.has(id),
);
const derivedActive = planAuthoredTotal - externalPresentInPlan.length;

// Checked rows live in the per-slice trackers, not the canonical plan.
const sliceFiles = readdirSync(resolve(ROOT, PATHS.sliceDir)).filter((name) =>
  /^phase-02-slice-\d{2}\.md$/u.test(name),
);
const trackerRows = sliceFiles.flatMap((name) =>
  collectRows(read(`${PATHS.sliceDir}/${name}`)),
);
const derivedChecked = new Set(
  trackerRows
    .filter((row) => row.checked && !isExternalGate(row.id))
    .map((row) => row.id),
).size;

const currentCriteriaLine =
  read(PATHS.phaseTracker)
    .split(/\r?\n/u)
    .find((line) => /^\*\*Criteria \([^)]*\)\*\*:/u.test(line)) ?? '';

const expectedSlice12Ids = Array.from(
  { length: 296 },
  (_, index) => `P2-S12-AC-${String(index + 1).padStart(3, '0')}`,
).sort();

describe('DEC-202 Phase 2 progress denominator', () => {
  it('derives 3,325 unique authored rows from the canonical plan with no duplicate criteria', () => {
    expect(planAuthoredTotal, 'plan authored rows').toBe(3_325);
    expect(planRows.length, 'plan row occurrences').toBe(planAuthoredTotal);
    expect(planAuthoredBySlice).toEqual(EXPECTED_AUTHORED_BY_SLICE);
  });

  it('adds exactly the eleven DEC-202 Slice 12 checks (AC286-AC296), mirrored by state across plan and tracker', () => {
    expect(
      [...(planBySlice.get('12') ?? [])].sort(),
      'Slice 12 criterion set',
    ).toEqual(expectedSlice12Ids);

    const dec202Ids = expectedSlice12Ids.slice(-11);
    expect(dec202Ids, 'DEC-202 id count').toHaveLength(11);
    expect(dec202Ids[0], 'first DEC-202 id').toBe('P2-S12-AC-286');
    expect(dec202Ids[dec202Ids.length - 1], 'last DEC-202 id').toBe(
      'P2-S12-AC-296',
    );

    const trackerSource = read(PATHS.slice12);
    for (const id of dec202Ids) {
      const planBox = boxOf(rowLine(planSource, id));
      const trackerBox = boxOf(rowLine(trackerSource, id));
      expect(planBox, `${id} plan row state`).toBeDefined();
      expect(trackerBox, `${id} tracker row state`).toBeDefined();
      expect(planBox, `${id} plan/tracker state`).toBe(trackerBox);
    }
  });

  it('excludes exactly the four Slice 09 external gates from the 3,321-item active denominator and keeps them unchecked', () => {
    expect(externalPresentInPlan, 'external gates present in plan').toEqual(
      EXTERNAL_GATES,
    );
    expect(derivedActive, 'derived active denominator').toBe(3_321);

    const slice09Source = read(PATHS.slice09);
    for (const id of EXTERNAL_GATES) {
      expect(boxOf(rowLine(planSource, id)), `${id} plan row state`).toBe(' ');
      expect(boxOf(rowLine(slice09Source, id)), `${id} tracker row state`).toBe(
        ' ',
      );
    }
  });

  it('derives the checked total from the per-slice trackers without counting any external gate', () => {
    expect(derivedChecked, 'derived checked rows').toBeGreaterThan(0);
    expect(
      trackerRows
        .filter((row) => isExternalGate(row.id) && row.checked)
        .map((row) => row.id),
      'checked external gates',
    ).toEqual([]);
  });

  it('current tracker declaration matches the derived denominators and checked total', () => {
    expect(currentCriteriaLine, 'current tracker criteria line').not.toBe('');
    expect(
      activeAuthored(
        currentCriteriaLine,
        /^\*\*Criteria \([^)]*\)\*\*:\s*([\d,]+)\s+active\s*\/\s*([\d,]+)\s+authored/u,
      ),
      'tracker active/authored declaration',
    ).toEqual([derivedActive, planAuthoredTotal]);
    expect(
      toNumber(
        currentCriteriaLine.match(/records\s+([\d,]+)\s+active-checked/u)?.[1],
      ),
      'tracker checked declaration',
    ).toBe(derivedChecked);
  });

  it('canonical plan current headers publish the derived 3,325 authored / 3,321 active denominators', () => {
    expect(
      toNumber(
        planSource.match(
          /\*\*Total authored acceptance criteria\*\*:\s*([\d,]+)/u,
        )?.[1],
      ),
      'plan authored declaration',
    ).toBe(planAuthoredTotal);
    expect(
      [
        ...planSource.matchAll(
          /\*\*Phase 2 implementation-completion denominator\*\*:\s*([\d,]+)/gu,
        ),
      ].map((match) => toNumber(match[1])),
      'plan active declarations',
    ).toEqual([derivedActive, derivedActive]);
  });

  it('index.md current criteria header publishes the derived denominators', () => {
    expect(
      activeAuthored(
        read(PATHS.index),
        /^\*\*Phase 2 criteria\*\*:\s*([\d,]+)\s+active\s*\/\s*([\d,]+)\s+authored/mu,
      ),
      'index current declaration',
    ).toEqual([derivedActive, planAuthoredTotal]);
  });

  it('spec-pipeline.md current declarations all publish the derived denominators', () => {
    const declared = [
      ...read(PATHS.specPipeline).matchAll(
        /([\d,]+)\s+out of\s+([\d,]+)\s+authored/gu,
      ),
    ].map((match) => [toNumber(match[1]), toNumber(match[2])] as const);
    expect(declared.length, 'spec-pipeline declaration count').toBeGreaterThan(
      0,
    );
    expect(declared, 'spec-pipeline current declarations').toEqual(
      declared.map(() => [derivedActive, planAuthoredTotal] as const),
    );
  });

  it('Slice 09 tracker current Phase 2 denominator matches the derived active count', () => {
    expect(
      toNumber(
        read(PATHS.slice09).match(
          /^\*\*Phase 2 implementation-completion denominator\*\*:\s*([\d,]+)/mu,
        )?.[1],
      ),
      'Slice 09 tracker Phase 2 denominator',
    ).toBe(derivedActive);
  });

  it('read-only progress consistency checker exits 0 on the live repository', () => {
    const run = spawnSync(
      process.execPath,
      [resolve(ROOT, PATHS.checker), '--root', ROOT, '--json'],
      { encoding: 'utf8' },
    );
    let driftKinds: string[];
    try {
      const report = JSON.parse(run.stdout) as {
        drift?: ReadonlyArray<{ kind: string }>;
      };
      driftKinds = (report.drift ?? []).map((item) => item.kind);
    } catch {
      driftKinds = ['<unparseable checker output>'];
    }
    expect(
      run.status,
      `checker exit code; drift=${JSON.stringify(driftKinds.slice(0, 5))}`,
    ).toBe(0);
    expect(driftKinds, 'checker drift kinds').toEqual([]);
  });
});
