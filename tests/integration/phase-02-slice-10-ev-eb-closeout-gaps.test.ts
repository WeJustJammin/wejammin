import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Evidence lane EB: Slice 10 closeout record (AC-059). This began as a known-defect probe wrapped in
// `it.fails`; the orchestrator checked the tracker's ordered gate lines at closure (2026-10-08), so it
// is now an ordinary assertion. The AC-060 implementation-boundary and compiled-graph probes live in
// phase-02-slice-10-ev-eb-closeout.test.ts.

const ROOT = resolve(import.meta.dirname, '../..');
const read = (relativePath: string): string =>
  readFileSync(resolve(ROOT, relativePath), 'utf8');

describe('EB closeout gaps: Slice 10 implementation boundaries and records', () => {
  it('EB-AC059: the slice tracker records the ordered Contract, QA RED, BE, FE, QA GREEN gate as checked', () => {
    const tracker = read(
      '.memory/pipeline/progress/slices/phase-02-slice-10.md',
    );
    const stages = [
      '- [x] Contract:',
      '- [x] `QA` RED:',
      '- [x] `BE` data',
      '- [x] `FE` Astro',
      '- [x] `QA` GREEN',
    ];
    const positions = stages.map((stage) => tracker.indexOf(stage));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
