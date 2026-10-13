import { defineSliceEvidenceGuard } from './phase-02-evidence-guard-suite';
import { S11_EVIDENCE_LEDGER } from './phase-02-slice-11-evidence-ledger';

// Slice 11 has no contract-only policy range: every criterion is proven by
// receipt-backed behaviour or stays partial/unverified with a limitation.
defineSliceEvidenceGuard({
  slice: '11',
  ledger: S11_EVIDENCE_LEDGER,
  contractOnly: null,
  criteria: 122,
  maxSoleProof: 3,
});
