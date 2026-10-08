import { defineSliceEvidenceGuard } from './phase-02-evidence-guard-suite';
import { S10_EVIDENCE_LEDGER } from './phase-02-slice-10-evidence-ledger';

// AC-038..AC-048 are the contract-only dependency-manifest rules of CMS-03B-05..09;
// no other Slice 10 criterion may be contract-only.
defineSliceEvidenceGuard({
  slice: '10',
  ledger: S10_EVIDENCE_LEDGER,
  contractOnly: { from: 38, to: 48 },
  criteria: 105,
  maxSoleProof: 3,
});
