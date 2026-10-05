import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  S09_AMENDMENT_EVIDENCE,
  S09_AMENDMENT_OPEN,
  S09_PRE_AMENDMENT_CHECKED,
} from './phase-02-slice-09-amendment-evidence';
import {
  COMPOSITION,
  ENVIRONMENTAL,
  MAPPING_ONLY_FILES,
  MAPPING_ONLY_TABLES,
  ROOT,
  hasParameterizedTitle,
  idsIn,
  kindOfFile,
  pgtapIncludes,
  read,
  rowsOf,
  statusOfRow,
  validateGate,
} from './phase-02-slice-09-amendment-evidence.test-support';

const TRACKER = '.memory/pipeline/progress/slices/phase-02-slice-09.md';
const PLAN = '.memory/wiki/specs/phases/phase-2.md';
const AUTHORED = 1239;
const DEFERRED_GATES: readonly number[] = [209, 211, 265, 266];

const numberOf = (criterion: string): number =>
  Number(/P2-S09-AC-(\d{3,4})$/u.exec(criterion)?.[1] ?? Number.NaN);

const tracker = rowsOf(TRACKER);
const plan = rowsOf(PLAN);
const includes = pgtapIncludes();
const sourceCache = new Map<string, string | null>();
const sourceOf = (path: string): string | null => {
  if (!sourceCache.has(path)) {
    sourceCache.set(path, existsSync(resolve(ROOT, path)) ? read(path) : null);
  }
  return sourceCache.get(path) ?? null;
};

const verifiedIds = new Set(
  S09_AMENDMENT_EVIDENCE.map(({ criterion }) => numberOf(criterion)),
);
const baseline = new Set(S09_PRE_AMENDMENT_CHECKED);

describe('Slice 09 amendment evidence index', () => {
  it('indexes only real tracker criteria, once each, in both the plan and the tracker', () => {
    expect(tracker.all.size).toBe(AUTHORED);
    expect(plan.all.size).toBe(AUTHORED);
    const seen = new Set<number>();
    for (const { criterion } of S09_AMENDMENT_EVIDENCE) {
      const id = numberOf(criterion);
      expect(tracker.all.has(id), `${criterion} is a tracker ID`).toBe(true);
      expect(plan.all.has(id), `${criterion} is a plan ID`).toBe(true);
      expect(seen.has(id), `${criterion} indexed once`).toBe(false);
      seen.add(id);
    }
    for (const { criterion } of S09_AMENDMENT_OPEN) {
      const id = numberOf(criterion);
      expect(tracker.all.has(id), `${criterion} open ID is real`).toBe(true);
      expect(verifiedIds.has(id), `${criterion} is not also verified`).toBe(
        false,
      );
    }
  });

  it('checks a criterion only when the index verifies it or it belongs to the pre-amendment set that no lane reopened', () => {
    for (const [label, rows] of [
      ['tracker', tracker],
      ['plan', plan],
    ] as const) {
      for (const id of rows.checked) {
        const verified = verifiedIds.has(id);
        const inherited = baseline.has(id);
        expect(
          verified || inherited,
          `${label} AC${id} is [x] without a verified index entry`,
        ).toBe(true);
        expect(
          verified && inherited,
          `${label} AC${id} must not be both indexed and pre-amendment`,
        ).toBe(false);
      }
      for (const id of verifiedIds) {
        expect(
          rows.checked.has(id),
          `${label} AC${id} is verified in the index but not [x]`,
        ).toBe(true);
      }
      if (label === 'tracker') {
        for (const id of baseline) {
          expect(
            rows.checked.has(id),
            `${label} AC${id} was reopened or lost without updating the baseline`,
          ).toBe(true);
        }
      }
      for (const id of DEFERRED_GATES) {
        expect(rows.checked.has(id), `${label} AC${id} stays unchecked`).toBe(
          false,
        );
      }
    }
    // The canonical plan mirrors the index-verified checks, so it can only be a
    // subset of the tracker.
    for (const id of plan.checked) {
      expect(
        tracker.checked.has(id),
        `plan AC${id} is [x] only in the plan`,
      ).toBe(true);
    }
  });

  it('requires every checked criterion from AC087 up to have verified evidence or the surviving pre-amendment set', () => {
    for (const id of tracker.checked) {
      if (id < 87) continue;
      expect(
        verifiedIds.has(id) || baseline.has(id),
        `AC${id} (>= AC087) is checked without evidence`,
      ).toBe(true);
    }
    expect(S09_PRE_AMENDMENT_CHECKED.length).toBe(
      new Set(S09_PRE_AMENDMENT_CHECKED).size,
    );
  });

  it('gives every open criterion a status other than verified and a reason, and leaves it unchecked', () => {
    const seen = new Set<number>();
    for (const { criterion, status, reason } of S09_AMENDMENT_OPEN) {
      const id = numberOf(criterion);
      expect(status, criterion).not.toBe('verified');
      expect(reason.length, `${criterion} reason`).toBeGreaterThan(10);
      expect(seen.has(id), `${criterion} listed once`).toBe(false);
      seen.add(id);
      if (!DEFERRED_GATES.includes(id)) {
        expect(
          tracker.checked.has(id),
          `${criterion} is open and must be [ ]`,
        ).toBe(false);
      }
    }
  });

  it('accounts for every authored criterion as surviving pre-amendment, indexed verified, or listed open', () => {
    const open = new Set(
      S09_AMENDMENT_OPEN.map(({ criterion }) => numberOf(criterion)),
    );
    const unaccounted: number[] = [];
    for (const id of tracker.all) {
      if (!baseline.has(id) && !verifiedIds.has(id) && !open.has(id)) {
        unaccounted.push(id);
      }
    }
    expect(unaccounted).toEqual([]);
  });
});

describe('Slice 09 amendment evidence gates', () => {
  it('cites only files that pnpm validate actually executes, and each one carries the criterion marker', () => {
    for (const entry of S09_AMENDMENT_EVIDENCE) {
      const { criterion, testFiles, command } = entry;
      const id = numberOf(criterion);
      expect(command.length, `${criterion} command`).toBeGreaterThan(10);
      expect(testFiles.length, `${criterion} files`).toBeGreaterThan(0);
      expect(new Set(testFiles).size, `${criterion} files unique`).toBe(
        testFiles.length,
      );
      expect(entry.testMarkers, criterion).toEqual([`[${criterion}]`]);
      for (const file of testFiles) {
        const source = sourceOf(file);
        expect(source, `${criterion} file ${file} exists`).not.toBeNull();
        expect(
          validateGate(file, includes),
          `${criterion} cites ${file}, which no pnpm validate command executes`,
        ).not.toBeNull();
        expect(
          idsIn(source ?? '').has(id) ||
            hasParameterizedTitle(source ?? '', id),
          `${criterion} marker exists in ${file}`,
        ).toBe(true);
      }
      for (const file of entry.supplementary ?? []) {
        expect(
          sourceOf(file),
          `${criterion} supplementary ${file} exists`,
        ).not.toBeNull();
        expect(
          validateGate(file, includes),
          `${criterion} supplementary ${file} must be outside the validate gate`,
        ).toBeNull();
      }
    }
  });

  it('gives every criterion that depends on a real browser a cited Playwright run or a non-empty limitation', () => {
    let environmental = 0;
    for (const entry of S09_AMENDMENT_EVIDENCE) {
      const id = numberOf(entry.criterion);
      const text = tracker.text.get(id) ?? '';
      if (!ENVIRONMENTAL.test(text)) continue;
      environmental += 1;
      const browser = entry.testFiles.some(
        (file) => kindOfFile(file) === 'playwright',
      );
      expect(
        browser || entry.limitation.trim().length > 20,
        `${entry.criterion} is partly environmental and cites no Playwright run, so it needs a limitation`,
      ).toBe(true);
    }
    expect(environmental, 'environmental criteria found').toBeGreaterThan(0);
  });

  it('proves an error row whose condition the mapping table is told only together with a condition-producing proof', () => {
    for (const entry of S09_AMENDMENT_EVIDENCE) {
      const status = statusOfRow(
        tracker.text.get(numberOf(entry.criterion)) ?? '',
      );
      const told = entry.testFiles.some(
        (file) => MAPPING_ONLY_TABLES[file]?.includes(status ?? -1) === true,
      );
      if (!told) continue;
      const produces = entry.testFiles.some(
        (file) =>
          kindOfFile(file) === 'pgtap' ||
          (kindOfFile(file) === 'vitest' &&
            !MAPPING_ONLY_FILES.includes(file) &&
            COMPOSITION.test(sourceOf(file) ?? '')),
      );
      expect(
        produces,
        `${entry.criterion} cites only the told-the-answer mapping table for a ${String(status)} row`,
      ).toBe(true);
    }
  });

  it('never verifies a criterion whose only proof sits outside the validate gate', () => {
    for (const entry of S09_AMENDMENT_EVIDENCE) {
      const inGate = entry.testFiles.filter(
        (file) => validateGate(file, includes) !== null,
      );
      expect(inGate.length, entry.criterion).toBe(entry.testFiles.length);
    }
  });
});
