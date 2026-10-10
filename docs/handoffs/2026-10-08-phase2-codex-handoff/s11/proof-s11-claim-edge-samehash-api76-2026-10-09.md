# Slice 11 — actual edge/same-hash API76 baseline

Started from clean pushed da47efaa2483eafcb27e8564b7ed8df6ceda838c.
Actual native A/B gpt-6-astra/high; root gpt-6.1-sol/ultra. Authors wrote only
two disjoint new files and released claims without execution. Parent full reads
and independent 6.1 reviews found no bounded actionable defect.

Formatted edge191/six cases and same-hash267/one case, within400 cap. Old69,
helpers, private contracts and three SQL unchanged; README describes boundaries.
Actual main54322 fresh activeCI0/shared flock pre-reset0/API0/post-reset0,
closed exit0. Five suites76/76 passed,42.36s. All seven new cases executed:

- Raw uppercase claimed job vs canonical original event: INVALID_REQUEST.
- Valid lowercase max UUID wrong token: CONFLICT, actual stored/receipt controls.
- String schemaVersion one: INVALID_REQUEST.
- Actual raw wire numeric1.0: accepted; exactly one changed lexeme/parsed equality,
  strict full raw/parsed response equals independently verified accepted baseline.
- Legacy eighteen-digit stale version: CONFLICT; nineteen-digit: INVALID_REQUEST.
- Same-hash public repeat: old live claim CONFLICT, new actual claim full acceptance.

Same-hash control compares whole candidate/type/source/artifact identity/content,
whole old fingerprint, new fingerprint differing only in actual dryRunId, canonical
hash/compiler/transform/counters, real supersession/version advances, report links/
11-null evidence/one current pair, unchanged entire old job/eight-field event,
actual old receipt/version/UUID token/unexpired lease immediately before refusal.
No edited graph/changed-hash helper/fake authority/claim/arithmetic version/row or
clock/GUC injection. Both fourteen/thirteen-table digest brackets surround reads.

Fresh CI0/flock static contracts/progress/ESLint/type/diff0; formatter mechanical.
All three SQL SHA256 match restored baseline18400/18500/18600:

- 8b8b1f9d96fb70935c589615e6d61b421c7ccb091505cfce42c6384609536e81
- 02c95ec5ac1d4202b686b8a0b82e4517d465962c934467eb07b6695dc9ceb859
- 3a1b3cf0185a94291ec2ce4be13a9775759360530445c2400335a4209c792ebe

Logs .lane-logs/parent-s11-claim-edge-samehash-api76-20261009.log plus
-pre-reset.log/-post-reset.log; parent-s11-claim-edge-samehash-static-20261009.log.
Previous unit1116/pgTAP121/catalog/lint39/100 receipts belong to prior SQL
checkpoint, not this new run. Inherited lint not clean.

Distinguishing mutants3 UNRUN: M6 current-attempt compound group, raw UUID
identity relation, numeric lexical comparison. Checkpoint baseline before root
mutation/exact3-source restore/post-reset under lock. M6 group kill would not
prove either predicate individually. Lifecycle/nonzero/completed/receiving/stage/
DEC163/full/later/owner/external open; Slice11 remains0/122. Usage27%, no reset
needed/available; no purchase. Context knowledge base preserved.
