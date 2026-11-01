# Slice 11 — actual claimed SQL mutation receipts

Baseline clean pushed ed427f8b9d595663f7c9724dd57bb5f56e51e410.
Statement-clock correction API69/expired-claim GREEN; catalog/private ACL,
pgTAP4/121/static/types0; lint inherited39/100 only, NOT clean.

Root-only one mutation at a time. Fresh activeCI0 at each stage, main54322
shared flock held through pre-reset/API/native source restore/post-reset.
Post-reset waits for parent native apply_patch plus complete three-source SHA
proof; it reloads restored sources, not mutant sources.55322 untouched.
Same unchanged three-suite69 run each; no QA changes/fake claims/time injection.
M6 is a sensitivity-gap control; expected masking is not runtime evidence.

| Mutation                                                 | Actual API receipt                 | Pre/post reset | Exact SHA restore |
| -------------------------------------------------------- | ---------------------------------- | -------------- | ----------------- |
| M1 nineteen-digit cap narrowed                           | 3 failed/66 passed/69,32.05s       | 0/0            | all3 match        |
| M2 job version fence removed                             | 4 failed/65 passed/69,31.89s       | 0/0            | all3 match        |
| M3 UUID token fence removed                              | 2 failed/67 passed/69,31.27s       | 0/0            | all3 match        |
| M4 real lease expiry fence removed                       | 1 failed/68 passed/69,33.04s       | 0/0            | all3 match        |
| M5 original envelope equality removed                    | 6 failed/63 passed/69,31.82s       | 0/0            | all3 match        |
| M6 current-attempt group removed                         | SURVIVED:0 failed/69 passed,31.99s | 0/0            | all3 match        |
| M7 current artifact/manifest recomputation group removed | 1 failed/68 passed/69,32.19s       | 0/0            | all3 match        |

M6 removes candidate.dry_run_id AND plan.superseded_at; M7 removes artifact
rehash AND editor/renderer recomputation. Group kills are not proof of individual
predicate sensitivity. M6 field-edit supersession fixture changes target/artifact/
transform hashes, masking current-attempt group; future same-hash public repeat
dry-run QA must be independently checkpointed.

Restored baseline SHA256 (18400/18500/18600):

- 8b8b1f9d96fb70935c589615e6d61b421c7ccb091505cfce42c6384609536e81
- 02c95ec5ac1d4202b686b8a0b82e4517d465962c934467eb07b6695dc9ceb859
- 3a1b3cf0185a94291ec2ce4be13a9775759360530445c2400335a4209c792ebe

Final restored main54322 CI0/flock pre0/API0/post0;3 suites69/69,31.73s.
Security pgTAP4/121 PASS,9s; contracts/DB types check/progress/ESLint/type/diff0;
unit35 suites1116/1116,21.25s. Catalog3 existing-owner/owner-only ACL/API EXECUTE
false/empty search_path/v-i-s/temporary CREATE false; statement clock STABLE.
Actual Docker main port54322 verified;55322 untouched. Lint39/100 exact inherited
baseline,0 new warnings but old cms_build_dependency_manifest42P01 remains.
All gate sessions closed; no live mutant, source hashes unchanged after gates.
All seven source restores verified, all fourteen pre/post resets0. Six actual
killed mutations, one actual masked survival; never seven proven guards.
M1 actual witnesses: smallest nineteen-digit, nineteen-digit interior and signed
bigint maximum stale versions return wrong grammar refusal instead of CONFLICT.
No predicted failure count substituted for execution.
M2 actual witnesses: three full19 stale versions plus stale actual preclaim
version with current token; each fails exact status/SQLSTATE/reason refusal.
M3 actual witnesses: valid nil wrong token and wrong valid UUID live-claim token;
both fail exact status/SQLSTATE/reason refusal.
Source stack.ts142-143 normalizes missing error code/message to empty strings.
M2/M3 actual tuple SHA c9302d6fd4297f84 equals [200,"",""]; expected SHA
9ec6d246b5dd246a equals [400,"P0001","CONFLICT"]. M1 wrong grammar tuple
SHA692ddb072638626b equals [400,"P0001","INVALID_REQUEST"].
Other owner/type/report/actor/census/completed/race/universal guards not isolated.
M6 actual survival confirms frozen69 cannot isolate pointer/supersession group.
Retained changed-hash comparisons still refuse old claim; no SQL-defect claim.
Separate same-hash public repeat dry-run QA remains required.
M7 actual witness: real public precompile graph edit with cached artifacts/
fingerprint unchanged. Removed recomputation group returns wrong accepted200
tuple instead of exact CONFLICT. Compound group only, not each predicate.
M4 actual witness: genuine one-second BE00 claim expiry, no injected clock;
exact expected CONFLICT refusal fails with expiry predicate removed.
M5 actual witnesses: changed eventId, aggregateVersion, correlationId,
causationId plus transplanted second event with first-job aggregate aligned and
second-job claim with first-job event. All six actual200/empty-error tuples
instead of exact400/P0001/CONFLICT.
No acceptance/full/owner/external closure;0/122.

Logs .lane-logs/parent-s11-claim-sql-m1 through m7-20261009(.log and pre/post-reset);
final parent-s11-claim-sql-mutants7-restored-20261009-{pre-reset,api69,post-reset,
catalog,lint,pgtap,static,unit1116}.log. Existing API69 frozen throughout.
