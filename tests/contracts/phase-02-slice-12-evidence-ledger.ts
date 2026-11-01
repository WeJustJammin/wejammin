import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';
import { S12_EVIDENCE_LEDGER_001_071 } from './phase-02-slice-12-evidence-ledger-001-071.ts';
import { S12_EVIDENCE_LEDGER_072_142 } from './phase-02-slice-12-evidence-ledger-072-142.ts';
import { S12_EVIDENCE_LEDGER_143_213 } from './phase-02-slice-12-evidence-ledger-143-213.ts';
import { S12_EVIDENCE_LEDGER_214_285 } from './phase-02-slice-12-evidence-ledger-214-285.ts';
import { S12_EVIDENCE_LEDGER_286_296 } from './phase-02-slice-12-evidence-ledger-286-296.ts';

// Slice 12 evidence ledger: per criterion, which exact tests prove which clause.
// Skeleton generated from .memory/pipeline/progress/slices/phase-02-slice-12.md by scripts/evidence/new-ledger.mjs --slice 12 --clauses;
// `text` is the tracker claim byte for byte and must never be reworded. Entries live in five disjoint
// fragments so independent evidence lanes can fill them in parallel; the guard checks every rule.
export const S12_EVIDENCE_LEDGER: readonly EvidenceLedgerEntry[] = [
  ...S12_EVIDENCE_LEDGER_001_071,
  ...S12_EVIDENCE_LEDGER_072_142,
  ...S12_EVIDENCE_LEDGER_143_213,
  ...S12_EVIDENCE_LEDGER_214_285,
  ...S12_EVIDENCE_LEDGER_286_296,
];
