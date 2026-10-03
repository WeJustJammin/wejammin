import { describe, expect, it } from 'vitest';

import {
  S09_AMENDMENT_EVIDENCE,
  S09_AMENDMENT_OPEN,
  S09_PRE_AMENDMENT_CHECKED,
} from './phase-02-slice-09-amendment-evidence';
import {
  read,
  rowsOf,
} from './phase-02-slice-09-amendment-evidence.test-support';

const TRACKER = '.memory/pipeline/progress/slices/phase-02-slice-09.md';
const PLAN = '.memory/wiki/specs/phases/phase-2.md';
const LEDGER =
  '.memory/pipeline/progress/verification/2026-10-02-slice-09-dec108-depth-floor.md';
const PUBLISHERS = [
  PLAN,
  TRACKER,
  '.memory/pipeline/progress/phases/phase-02.md',
  '.memory/pipeline/progress/index.md',
  '.memory/pipeline/progress/spec-pipeline.md',
] as const;
const DEFERRED_GATES: readonly number[] = [209, 211, 265, 266];
const BASELINE_FLOOR = 283;

const tracker = rowsOf(TRACKER);
const plan = rowsOf(PLAN);
const numberOf = (criterion: string): number =>
  Number(/(\d{3,4})$/u.exec(criterion)?.[1] ?? Number.NaN);

// Every figure below is computed from rows, the ledger or the evidence index;
// nothing is a pinned literal (AC1145: never back-solve a total).
const authored = tracker.all.size;
const active = authored - DEFERRED_GATES.length;
const verifiedActive =
  S09_PRE_AMENDMENT_CHECKED.length + S09_AMENDMENT_EVIDENCE.length;

describe('Slice 09 evidence cascade guards', () => {
  it('[P2-S09-AC-1144] checks an amendment criterion only when an index entry carries zero-failure receipts, and mirrors every row in plan and tracker', () => {
    const indexed = new Map(
      S09_AMENDMENT_EVIDENCE.map((entry) => [numberOf(entry.criterion), entry]),
    );
    const open = new Set(
      S09_AMENDMENT_OPEN.map(({ criterion }) => numberOf(criterion)),
    );
    for (let id = BASELINE_FLOOR + 1; id <= authored; id += 1) {
      expect(plan.all.has(id), `AC${id} in the plan`).toBe(true);
      expect(tracker.all.has(id), `AC${id} in the tracker`).toBe(true);
      const entry = indexed.get(id);
      const description = (rows: typeof tracker): string =>
        (rows.text.get(id) ?? '').replace(/\]\([^)]*\)/u, '](link)');
      expect(description(tracker), `AC${id} text`).toBe(description(plan));
      if (entry === undefined) {
        expect(
          tracker.checked.has(id),
          `AC${id} checked without evidence`,
        ).toBe(false);
        expect(open.has(id), `AC${id} listed open`).toBe(true);
      } else {
        expect(tracker.checked.has(id), `AC${id} verified`).toBe(true);
        expect(plan.checked.has(id), `AC${id} verified in plan`).toBe(true);
        expect(entry.receipts.length, `AC${id} receipts`).toBeGreaterThan(0);
        for (const receipt of entry.receipts) {
          expect(receipt.failed, `AC${id} ${receipt.file}`).toBe(0);
        }
      }
    }
  });

  it('[P2-S09-AC-1145] derives authored, active and verified counts from the rows, the ledger and the index, and every document publishes the computed figure', () => {
    const ledger = read(LEDGER);
    const ledgerRows = ledger.match(/^\| P2-S09-AC-\d{3,4} \|/gmu) ?? [];
    expect(authored, 'authored rows = baseline floor + ledger rows').toBe(
      BASELINE_FLOOR + ledgerRows.length,
    );
    expect(plan.all.size).toBe(authored);
    expect(active).toBe(authored - DEFERRED_GATES.length);
    const checked = [...tracker.checked].filter(
      (id) => !DEFERRED_GATES.includes(id),
    );
    expect(
      checked,
      'checked active rows = surviving baseline + index',
    ).toHaveLength(verifiedActive);
    const claim = `${verifiedActive}/${active}`;
    for (const path of PUBLISHERS) {
      expect(read(path), `${path} publishes ${claim}`).toContain(claim);
    }
    expect(read(TRACKER)).toContain(
      `Authored acceptance items: ${verifiedActive}/${authored} verified`,
    );
    expect(read(TRACKER)).toMatch(/\*\*Spec depth floor\*\*:\s*1239\b/u);
    expect(read(PLAN)).toMatch(/\*\*Spec depth floor\*\*:\s*1239 criteria/u);
  });

  it('[P2-S09-AC-1149] keeps plan, tracker, phase tracker, progress index and spec pipeline in agreement: no repeated header sentence, no stale reopen note on a checked row', () => {
    const lines = read(TRACKER).split(/\r?\n/u);
    for (const line of lines.slice(0, 40)) {
      const sentences = line
        .split(/(?<=\.)\s+/u)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 60);
      expect(
        new Set(sentences).size,
        `repeated sentence in: ${line.slice(0, 100)}`,
      ).toBe(sentences.length);
    }
    for (const line of lines) {
      if (!/^- \[x\] \*\*P2-S09-AC-\d{3,4}\*\*/u.test(line)) continue;
      expect(
        /Reopened 2026-09-30:[^\n]*no production producer/u.test(line),
        `checked row still carries a stale reopen note: ${line.slice(0, 80)}`,
      ).toBe(false);
    }
    const claim = `${verifiedActive}/${active}`;
    for (const path of PUBLISHERS) {
      expect(read(path), `${path} publishes ${claim}`).toContain(claim);
    }
  });

  it('[P2-S09-AC-1149] states one Slice 10 prerequisite note across plan, tracker, phase tracker, progress index and spec pipeline, naming the open-criteria block that really exists', () => {
    const prerequisite =
      'Slice 10 stays blocked until every criterion listed in the open-criteria block of the Slice 09 tracker is verified.';
    for (const path of PUBLISHERS)
      expect(
        read(path).split(prerequisite).length - 1,
        `${path} states the Slice 10 prerequisite exactly once`,
      ).toBe(1);
    const lineOf = (path: string): string | undefined =>
      read(path)
        .split(/\r?\n/u)
        .find((line) =>
          line.startsWith('**Slice 10 implementation prerequisites**'),
        )
        ?.trimEnd();
    expect(lineOf(PLAN), 'plan prerequisite line').toBeDefined();
    expect(lineOf(PLAN)).toBe(lineOf(TRACKER));
    expect(read(TRACKER)).toMatch(
      /<!-- s09-open:start -->[\s\S]*<!-- s09-open:end -->/u,
    );
    for (const { criterion } of S09_AMENDMENT_OPEN)
      if (!DEFERRED_GATES.includes(numberOf(criterion)))
        expect(read(TRACKER), `open block lists ${criterion}`).toContain(
          `- AC${String(numberOf(criterion)).padStart(3, '0')} (`,
        );
  });
});
