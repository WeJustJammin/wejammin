import { defineSliceEvidenceGuard } from './phase-02-evidence-guard-suite';
import { S12_EVIDENCE_LEDGER } from './phase-02-slice-12-evidence-ledger';

// Slice 12 has no contract-only policy range: every criterion is proven by
// receipt-backed behaviour or stays partial/unverified with a limitation.
defineSliceEvidenceGuard({
  slice: '12',
  ledger: S12_EVIDENCE_LEDGER,
  contractOnly: null,
  criteria: 296,
  maxSoleProof: 3,
});
