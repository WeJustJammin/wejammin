# integrator-v5b (2026-10-03, worktree HEAD 76664abb, no source edits during runs)
Citation sync first: 0 add / 0 remove. Then frozen.
## Runs (logs scratchpad/logs/g-*)
- db:reset rc0, db:lint rc0, db:test:tap (verbose TAP, `pnpm db:test` has no verbose mode): 8233 ok / 0 not ok, rc0 (g-dbtest.tap)
- db:races: 6/6 runners passed, 38 receipt lines (g-dbraces.out)
- db:api-test: 9 files / 58 tests pass (g-dbapi.json)
- root vitest: 1222 files; 1221 passed, 1 failed (receipts-guard, 3 tests, expected pre-collect); 13530 passed | 3 failed | 1 skipped (13534)
- Playwright functional (Chrome, single run): 105 passed, 0 unexpected
- Playwright s09-real run 1: 108 passed, 1 unexpected (schema-review-real-route AC1020/AC1049: openEnrollment toPass 45 s, Authenticator name textbox never visible; solo rerun of the file 3/3 pass; flake in hydration retry loop, not reproduced). Full single rerun: 109 passed, 0 unexpected, 0 flaky (used for collection). Run 1 kept as g-pw-real-run1-1fail.json.
## Receipts
- collect (A minus guard/ledger/collector files, + B guard rerun, + db:api-test JSON; postgrest apispecs cite criteria so the api JSON is a required input): 9961 rows = vitest 4952 (4951 passed, 1 skipped evidence-map), pgtap 4759 assertion, playwright 154, race 96. 0 stale, 0 file-level pgtap rows. Idempotent (cmp identical on re-collect). Guard + ledger guard + collector test: 36/36 then 12/12 after final collect; no refreeze needed (ledger digest test passed in run A).
## pnpm validate run 1: FAILED at test:coverage (all 1222 files / 13533 tests passed; 100% global threshold missed: 99.98 lines, 99.97 stmts, 99.93 branches)
Real gaps in 6 worker files (R14 refactors left branches unproven). Fixes (new test files only, none cited by receipts) + one code simplification:
- routes-provider-access.ts 172-176: cookieless non-sign_in oauth start origin/CSRF refusal untested; the CSRF-success arm was dead (token is bound to wj_session_ref which is itself a session cookie), so cookieless now returns the same 403 FORBIDDEN directly. Tests: authentication/be00-oauth-start-cookieless-gate.test.ts (3).
- upload-intent-completion.ts 60/98: non-JSON body + missing If-Match: upload-completion/upload-intent-completion-be00-order.test.ts (2).
- route-human-handlers/route-refusal-telemetry (clock fallback): content-schema-registry/phase-02-slice-09-clock-fallback.test.ts (1).
- migration-worker-engine.ts 259: blocked queue event duration: migration-worker-blocked-event-duration.test.ts (1).
- admin-route-admission.ts 180 parseBody success: platform-configuration/admin-route-admission-parse-body.test.ts (2).
Coverage subset re-run: all six files 100% branches/stmts.
Because the Worker source changed, re-ran root vitest (1227 files, 13542 passed, 1 skipped, 0 failed), s09-real (109/109), functional (105/105), recollected: 9961 rows, idempotent, guards 36/36.
## Final gates (all on the final tree; logs g-/h-/i-*)
- validate run 2 failed typecheck on my new test (async wrapper), fixed. validate run 3 (i-validate.log) rc0: contracts:check, db:types:check, progress:check, format:check, lint (max-warnings 0), type-check, test:coverage 1227 files / 13542 passed / 1 skipped, coverage 100/100/100/100 (stmts 19631, branches 14729, fns 3284, lines 18104), test:evidence:s09, test:e2e, build, bundle:check, performance:smoke all green.
- db:verify rc0 (db:test 201 files / 8233 PASS, api-test 9 files / 58, races 6/6, types check). progress:check rc0. Receipts guard 4/4 + ledger guard: no stale, no file-level rows, no refreeze needed.
- Receipts file tests/contracts/phase-02-slice-09-receipts.generated.jsonl: 9961 rows, untracked (to be committed). Criteria lacking a passing receipt for a cited proof: none (guard asserts every verified criterion x cited file). Only skipped row: evidence-map test (1 skipped vitest).
- Flags: s09-real hydration flake (openEnrollment) seen once in 4 full runs; BE01a ruling still needed (sign_in with stale session cookie needs CSRF header); STEP_UP_SCOPE_SECRET must be set out of band.
- Process: one `git checkout` no-op rule breach was in v5 (not this run). No git commit/checkout this run. No leftover processes.
