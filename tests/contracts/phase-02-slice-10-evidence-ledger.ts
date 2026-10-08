import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';
import { S10_EVIDENCE_LEDGER_001_035 } from './phase-02-slice-10-evidence-ledger-001-035.ts';
import { S10_EVIDENCE_LEDGER_036_070 } from './phase-02-slice-10-evidence-ledger-036-070.ts';
import { S10_EVIDENCE_LEDGER_071_105 } from './phase-02-slice-10-evidence-ledger-071-105.ts';

// Slice 10 evidence ledger: per criterion, which exact tests prove which clause.
// Skeleton generated from .memory/pipeline/progress/slices/phase-02-slice-10.md by scripts/evidence/new-ledger.mjs --slice 10;
// `text` is the tracker claim byte for byte and must never be reworded. A citation names ONE
// test (tool, file, full title; Playwright also project). Fill an entry by listing clauses
// (verbatim parts of text that tile it) with citations, then set status and limitation;
// the guard (tests/contracts/phase-02-slice-10-evidence-guard.test.ts) checks every rule.
// Entries live in three disjoint fragments so independent evidence lanes can fill them in parallel.
export const S10_EVIDENCE_LEDGER: readonly EvidenceLedgerEntry[] = [
  ...S10_EVIDENCE_LEDGER_001_035,
  ...S10_EVIDENCE_LEDGER_036_070,
  ...S10_EVIDENCE_LEDGER_071_105,
];
