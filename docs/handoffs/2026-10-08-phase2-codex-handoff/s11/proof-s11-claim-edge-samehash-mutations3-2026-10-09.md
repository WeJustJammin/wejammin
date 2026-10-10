# Slice 11 — actual distinguishing edge/same-hash mutation proof

Baseline clean pushed 2f4756f369f7ef731d4ac53812e7bd546a3fdc49:
actual API76/76,42.36s, pre0/post0/static0; two new native QA files frozen.
Root-only one transient SQL mutation at a time; all QA/helpers/contracts frozen.
Fresh activeCI0/main54322/shared flock spans pre-reset/test/native restore/
three-source SHA verification/baseline post-reset.55322 untouched.

| Mutation                                         | Actual result                | Named final oracle                | Pre/post | Exact restore  |
| ------------------------------------------------ | ---------------------------- | --------------------------------- | -------- | -------------- |
| M6R current-attempt two-guard group              | 1 failed/75 passed/76,42.61s | new same-hash old-claim refusal   | 0/0      | all3 SHA match |
| E1 raw text relation replaced by UUID casts      | 1 failed/5 passed/6,5.38s    | raw uppercase claim refusal       | 0/0      | all3 SHA match |
| E2 numeric JSONB comparison narrowed to text one | 1 failed/5 passed/6,5.04s    | actual wire numeric1.0 acceptance | 0/0      | all3 SHA match |

M6R reached old refusal AFTER all unchanged candidate/type/source/artifact/
fingerprint/hash/transform/counter and supersession/report/identity/live-old-lease
controls passed. Actual refusal SHA c9302d6fd4297f84 = [200,"",""], expected
9ec6d246b5dd246a = [400,"P0001","CONFLICT"]. Historical M6 SURVIVED old69 because
field editing changed hashes. New same-hash QA distinguishes the compound
candidate.dry_run_id + plan.superseded_at group. No individual-predicate proof.

E1 changes only raw text comparison to UUID identity; uppercased claimed job UUID
still selects actual canonical job. Final refusal actual SHA c9302d6fd4297f84
instead expected692ddb072638626b = [400,"P0001","INVALID_REQUEST"].
E2 keeps numeric type guard but compares extracted text against lexical one.
Raw numeric1.0 request reaches test-local real RPC and returns400 rather than200;
ordinary independent complete accepted baseline passed first. Five other edge
cases remain green. No private parser/tests/helper/privilege changes.

All three mutants caught; all six mutant reset exits0, each exact native restore
proved before restored baseline reload/unlock. All sessions closed, no live
mutant/DB handle/reset. Final fresh main54322 CI0/flock pre0/API0/post0 closed0:

- Five suites76/76,41.65s (log suffix api69 is inherited filename, actual run76).
- Unit35 suites1116/1116,22.23s.
- Security pgTAP4 files121 assertions PASS,9s.
- Contracts/DB types check/progress/ESLint/types/diff0.
- Catalog existing wejammin_cms_definer owner/owner-only ACL, all direct API-role
  EXECUTE false, empty search_path, dispatch/request/snapshot v/i/s, only request
  security-invoker, temporary schema CREATE false, statement clock STABLE.
- Docker5432 maps actual main54322, IPv4/IPv6;55322 untouched.
- Lint CLI0;39 function groups100 issues exactly inherited by canonical sorted
  function/issue objects,0 added/removed. Legacy cms_build_dependency_manifest
  missing pg_temp relation42P01 persists. Whole SQL lint NOT clean.
- Complete18400/18500/18600 SHA match baseline after final controls.

SHA25618400/18500/18600:

- 8b8b1f9d96fb70935c589615e6d61b421c7ccb091505cfce42c6384609536e81
- 02c95ec5ac1d4202b686b8a0b82e4517d465962c934467eb07b6695dc9ceb859
- 3a1b3cf0185a94291ec2ce4be13a9775759360530445c2400335a4209c792ebe

Logs .lane-logs/parent-s11-claim-edge-samehash-{m6r,e1,e2}-20261009.log,
each matching -pre-reset.log/-post-reset.log; final common prefix
parent-s11-claim-edge-samehash-mutants3-restored-20261009, suffixes
-pre-reset/-api69/-post-reset/-catalog/-lint/-pgtap/-static/-unit1116.log.

Next pure claimed-input/binding TDD is UNDISPATCHED behind new clean pushed
checkpoint. Existing Zod request/response authoritative; full response internal
consistency does not bind caller receipt/original event. Worker entry, live
cancellation/attempt, plan-token handoff, effect result mapping/environment
composition, genuine nonzero/completed lifecycle, receiving/ACK/heartbeat/
per-stage fences/DEC163/full/later/owner/external all open. No criterion promoted;
Slice11 remains0/122. Free reset authorization retained; no purchase.
