import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';
import { S11_EVIDENCE_LEDGER_001_034 } from './phase-02-slice-11-evidence-ledger-001-034.ts';
import { S11_EVIDENCE_LEDGER_035_066 } from './phase-02-slice-11-evidence-ledger-035-066.ts';
import { S11_EVIDENCE_LEDGER_067_100 } from './phase-02-slice-11-evidence-ledger-067-100.ts';
import { S11_EVIDENCE_LEDGER_101_122 } from './phase-02-slice-11-evidence-ledger-101-122.ts';

// Slice 11 evidence ledger: per criterion, which exact tests prove which clause.
// Skeleton generated from .memory/pipeline/progress/slices/phase-02-slice-11.md by scripts/evidence/new-ledger.mjs --slice 11;
// `text` is the tracker claim byte for byte and must never be reworded. A citation names ONE
// test (tool, file, full title; Playwright also project). Fill an entry by listing clauses
// (verbatim parts of text that tile it) with citations, then set status and limitation;
// the guard (tests/contracts/phase-02-slice-11-evidence-guard.test.ts) checks every rule.
// Entries live in four disjoint fragments so independent evidence lanes can fill them in parallel.
export const S11_EVIDENCE_LEDGER: readonly EvidenceLedgerEntry[] = [
  ...S11_EVIDENCE_LEDGER_001_034,
  ...S11_EVIDENCE_LEDGER_035_066,
  ...S11_EVIDENCE_LEDGER_067_100,
  ...S11_EVIDENCE_LEDGER_101_122,
];
