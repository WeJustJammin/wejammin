import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  S09_AMENDMENT_EVIDENCE,
  S09_AMENDMENT_OPEN,
  S09_PRE_AMENDMENT_CHECKED,
} from './phase-02-slice-09-amendment-evidence';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (relativePath: string): string =>
  readFileSync(resolve(ROOT, relativePath), 'utf8');

const TRACKER = '.memory/pipeline/progress/slices/phase-02-slice-09.md';
const PLAN = '.memory/wiki/specs/phases/phase-2.md';
const AUTHORED = 1239;
const DEFERRED_GATES: readonly number[] = [209, 211, 265, 266];

const numberOf = (criterion: string): number =>
  Number(/P2-S09-AC-(\d{3,4})$/u.exec(criterion)?.[1] ?? Number.NaN);

type Rows = Readonly<{
  all: ReadonlySet<number>;
  checked: ReadonlySet<number>;
}>;

const rowsOf = (path: string): Rows => {
  const all = new Set<number>();
  const checked = new Set<number>();
  for (const line of read(path).split(/\r?\n/u)) {
    const match = /^- \[([ x])\] \*\*P2-S09-AC-(\d{3,4})\*\*/u.exec(line);
    if (match === null) continue;
    const id = Number(match[2]);
    all.add(id);
    if (match[1] === 'x') checked.add(id);
  }
  return { all, checked };
};

const tracker = rowsOf(TRACKER);
const plan = rowsOf(PLAN);
const sourceCache = new Map<string, string | null>();
const sourceOf = (path: string): string | null => {
  if (!sourceCache.has(path)) {
    sourceCache.set(path, existsSync(resolve(ROOT, path)) ? read(path) : null);
  }
  return sourceCache.get(path) ?? null;
};
const PARAMETERIZED_TITLE = /P2-S09-AC-(?:\$\{|%[sid])/u;

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

  it('checks a criterion only when the index verifies it or it belongs to the frozen pre-amendment set', () => {
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
    // The canonical plan mirrors the index-verified checks (and the earlier AC250
    // check) but not the rest of the frozen pre-amendment set, so it can only be a
    // subset of the tracker.
    for (const id of plan.checked) {
      expect(
        tracker.checked.has(id),
        `plan AC${id} is [x] only in the plan`,
      ).toBe(true);
    }
  });

  it('requires every checked criterion from AC087 up to have verified evidence or the frozen baseline', () => {
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

  it('names a runnable command, existing test files and markers that exist in them for every verified entry', () => {
    for (const entry of S09_AMENDMENT_EVIDENCE) {
      const { criterion, command, testFiles, testMarkers } = entry;
      expect(entry.status, criterion).toBe('verified');
      expect(command.length, `${criterion} command`).toBeGreaterThan(10);
      expect(entry.observed.length, `${criterion} observed`).toBeGreaterThan(
        10,
      );
      expect(testFiles.length, `${criterion} files`).toBeGreaterThan(0);
      expect(testMarkers.length, `${criterion} markers`).toBeGreaterThan(0);
      // Markers are unique per criterion; the same marker may recur across
      // other criteria and across files.
      expect(new Set(testMarkers).size, `${criterion} markers unique`).toBe(
        testMarkers.length,
      );
      expect(new Set(testFiles).size, `${criterion} files unique`).toBe(
        testFiles.length,
      );
      const parameterized = new Set(entry.parameterizedMarkers ?? []);
      for (const file of testFiles) {
        expect(sourceOf(file), `${criterion} file ${file}`).not.toBeNull();
      }
      for (const marker of testMarkers) {
        const sources = testFiles.map((file) => sourceOf(file) ?? '');
        if (parameterized.has(marker)) {
          expect(
            sources.some((source) => PARAMETERIZED_TITLE.test(source)),
            `${criterion} parameterised marker ${marker} needs a title template`,
          ).toBe(true);
        } else {
          expect(
            sources.some((source) => source.includes(marker)),
            `${criterion} marker ${marker} exists in a listed file`,
          ).toBe(true);
        }
      }
      for (const marker of parameterized) {
        expect(testMarkers, `${criterion} parameterised ${marker}`).toContain(
          marker,
        );
      }
    }
  });

  it('gives every open criterion a status other than verified and a reason', () => {
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

  it('accounts for every authored criterion as baseline-checked, indexed verified, or listed open', () => {
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
