# Lane report: claude_s12_dec194_sweep

## Status
GREEN for the lane scope. Worktree HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e` (verified at start and 17:38Z). No git mutation, no spec, contract, Web or shared pgTAP file touched.
- SQL: `supabase/tests/phase_02_slice_12_dec194_sweep.sql` 83 / 83 (staged lane `dec194`); the taxonomy-terms, canonical, reads and definition suites and the two sec2 definer suites still pass beside it (run 4, below). One shared-test consequence needs root (Requests #2).
- Worker: full `apps/worker` Vitest 677 files, 12,036 / 12,036 (17:20-17:35Z); worker `tsc --noEmit` exit 0; eslint `--max-warnings=0` and prettier clean on every touched file; coverage of the new module 100 % (25/25 statements, 19/19 branches, 2/2 functions).
- Runbook: "the open gap" replaced by the sweep; the runbook sync test is green (its two gap-assertions were replaced, see Test corrections).

## Scope
Brief `briefs/dec194-sweep.md`; owner decision DEC-194; BE03c "Merge convergence recovery (DEC-194 ...)" (line 1414); design input `lane-worker-taxonomy-terms-report.md` fix pass Requests to root #1.

## Design decisions (implementation tier; root may override)
- D1 Candidate: one head per acting party = the party's LATEST `failed` job of the type (`created_at desc, id desc`). Its id derives the idempotency key `digest('cms.taxonomy.merge_converge.reconcile:' || failed id)` and the request hash (BE03c 1414 "derived from the failed Job's id"). The namespace is new per failed job: the first request is keyed `...:<term id>` and a continuation `...continuation:<job id>`, so neither collides.
- D2 "Per 15 minutes" is measured from the party's last job activity of the type (any job of the type with `updated_at` within 15 minutes excludes the party). Stricter than `created_at`: the back-off runs from the failure, and a request never follows any job activity within 15 minutes. Pinned by 4 tests (fresh, 14 min, 16 min) and by the `bound-created` mutant.
- D3 "3 consecutive failed generations": count consecutive `failed` jobs of the type from the party's newest job backwards; stop at >= 3; any non-failed job (succeeded, cancelled) ends the run. A queued or running job excludes the party first.
- D4 The new job carries the failed job's actor, acting party and correlation id (the same binding the existing continuation uses, 20261014120810).
- D5 `requested` counts only first acceptances; a replayed key (the failed job was already reconciled) counts nothing, so each failed job is reconciled at most once.
- D6 The body sets `app.cms_rpc` itself (the work predicate reads forced-RLS tables); the wrapper restores the caller's flag (CMS-03C-19 pattern).
- D7 Worker: one `platform_api` call per tick, empty argument object, strict parse of exactly `{ requested }` (integer 0 .. 2147483647), no in-tick retry (a replayed tick is harmless, the platform retry and the next minute are the retry), count-only logs. Failure disposition copied from the review-authority sweep (transport -> `DEPENDENCY_UNAVAILABLE` retry; non-JSON -> manual review rethrown; malformed answer -> `DEPENDENCY_INVALID_RESPONSE` retry).

## Files (path, lines, SHA-256)
New (SQL, WIP; unpromoted):
- `supabase/migrations-wip/dec194/20261014190000_cms_reconcile_taxonomy_merge_converge.sql` 90 `8c9f94b119ca71dd86fd27c0f0b594349b9ecf36a063f7ec7565445bd80bdbb4`
- `supabase/migrations-wip/dec194/20261014190010_cms_reconcile_taxonomy_merge_converge_public.sql` 43 `724320cf4770abb7affe681ad4f294b3fbe84ad44f2ddc01d09e668ba31ac198`

New (pgTAP):
- `supabase/tests/phase_02_slice_12_dec194_sweep.sql` 37 `7c517ccb28edef44585fc2797048aa8247e69ee65adfaf4886908fb1aeb2eb41`
- `supabase/tests/phase_02_slice_12_dec194_sweep/000-helpers.sqlinc` 129 `527a496fc52f59f5e04e46528525215b5bcf7ff020bc1da8964295d3317d47cc`
- `.../010-surface.sqlinc` 40 `e8071389329475e55b1180713983ad93a3e8d5503b05dbdd15a8fb5f033a6db5`
- `.../020-no-work.sqlinc` 62 `2f21444ac774d9eae1956f56310acfb7c96add92382654f617abb694706d161e`
- `.../030-gates.sqlinc` 52 `ac68402fc81f828041be00f656c938a4d21ac557506aeb535ab954367eea0487`
- `.../040-request.sqlinc` 66 `03fcd7bf57fe6a84ef7f92bffc287d3875d9b4c536b455bce87dbea52c450a30`
- `.../050-generations.sqlinc` 43 `c50b0bef971b9341d3546fd22b9471639da5fe5ac6b6b19c38d31d86667e20b8`
- `.../README.md` 21 `ba4a243e442426eae821cd3c604d0e16edd077d33ba988700aae9b0e4676c596`

New (Worker):
- `apps/worker/src/cms-taxonomy-merge-reconcile-sweep.ts` 111 `1b8e0a5225f39a75f4b3d05546799338af915b9f4d6cd67bb19cc92649f1392c`
- `apps/worker/src/cms-taxonomy-merge-reconcile-sweep.test.ts` 182 `4d131a79ae5c4029441b26c0721fcf22b42011f47e867131047b3f9b9e55685e`
- `apps/worker/src/cms-taxonomy-merge-reconcile-wiring.test.ts` 173 `ba29ec321d505d427ae3967e29086c98d93223e23f1bac8ec04434cf3a7cdfd0`
- `apps/worker/src/cms-taxonomy-merge-reconcile-import-graph.test.ts` 96 `09b22d805b2a822634dbe5ceffe7223b3be374cc9fce34610922eb096f881afd`

Edited (SHA after my edit; the first two also carry other lanes' uncommitted hunks, mine are the `taxonomyMergeReconcile*` additions and the one union literal):
- `apps/worker/src/index.ts` 278 `4805d1a65c416e898ba12706abe8603889ec3c17f6aaabf061c2c6e3ce26657f` (import, call, settled result, rejection filter, throw after the governed result and before the alerts)
- `apps/worker/src/async-runtime-rpc-types.ts` 88 `ae0828746911472a3ad2f7bdb1e3c85c6a23f092a606d7828a9e7c7c98cf5b8a` (`'cms_reconcile_taxonomy_merge_converge'` in `AsyncRpcOperation`)
- `apps/worker/src/README.md` 148 `866badb9bbde0167d3198ba0fd42e4b34d4cac15b831431236ee350e319a07bd`
- `apps/worker/src/cms-taxonomy-merge-converge-names.ts` 37 `927e17aa48b3f5053dfac2e70c4907c569ab305a41694d784494ad238950fa55` (comment only: the stale "no spec defines the recovery / nothing guarantees one" sentence now points at the sweep)
- `docs/runbooks/platform/cms-taxonomy-merge-converge.md` 110 `b19ef8c55e84a5bffed4d5f204c6f29d060e4fad977d5f651c72e3c403692ebd`
- `docs/runbooks/platform/README.md` 27 `59685c68375a8bc56c27e6915ac39a8de36b4e11371c353573aecb81857e510a`, `docs/runbooks/platform/jobs-outbox-reconciliation.md` 57 `a694c101d1b75279afd812954a1836946fe99d7ebd81dd0e64030781d262236e` (one phrase each: "open recovery gap" -> the sweep)
- Test files edited (see Test corrections): `cms-taxonomy-merge-converge-runbook.test.ts` 177 `caa19b6c21f5a444c587b0235c95c1d956495f1259ed9eafe11cca332de31db2`; `index-scheduled.test.ts` 249 `ed0010bf199635ecff6d6fd8dd19f76ea8e36d6681ba77a10fdb8040cda58717`; `production-idempotency-expiry-sweep.test.ts` 362 `ca0266a22da60dd53657b863623b29e3d7f6387873f75670aa4b2ef2a1cb0e49`; `scheduled-manual-review-retry.test.ts` 213 `9c52ddac9e64984053f38a8252b4aecaf181780b675819c28aa6adb16208ab15`; `cms-publication-schedule-sweep-wiring.test.ts` 141 `257618b5d7188fc1b2a948089e7f676b35991c61678f141901e05d27875676a2`; `cms-governed-activation-sweep-wiring.test.ts` 175 `84e08c366491e7b9d7abd642fa68b3d8acece03b56fa3de4a15a2dee02c41d1d`.

## Runs
Times UTC, 2026-10-15. All pgTAP through the staged runner (lane `dec194`; `dec194mut` for mutants), TAP under `.lane-logs/`.
| time | what | plan | result | note | TAP (SHA-256) |
| --- | --- | --- | --- | --- | --- |
| 17:10 | RED: new suite, no WIP migration | 59 run, no_plan | 41 ok / 18 not ok, aborted at `040-request.sqlinc:13` | first failing: not ok 15 (function absent). Genuine missing feature; every `fixture:` assertion (1-14, 26-28, 33-35, 38-40, 43, 46, 49-50, 53, 56) passed, so the harness is sound; the abort is the cascade of an absent sweep | `alt-staged-dec194-131029-2495809.tap` `ff943393df9baa77b263ab6c827f2883367edf84efaa020ffc0ae1631c25547e` |
| 17:12 | GREEN, WIP 190000 + 190010 | 77 | 77 / 77 | | `alt-staged-dec194-131205-2506071.tap` `968ad263920bee73d206d0d509293f27f0c4036d1fea715c2f99b7545a91c231` |
| 17:14 | GREEN after the suite gained the real-recovery block (the sweep-requested job is claimed and drained by the real handler) and a stricter ACL/overload pin; replaced the cancel-based replay step | 83 | 83 / 83 | | `alt-staged-dec194-131407-2520073.tap` `304f0b09c6139fdd06ff2be61691373309c53756a649fb00df71edc2b4620823` |
| 17:15-17:29 | 10 mutation runs of the WIP body (below) | 83 each | see below | | `.lane-logs/alt-staged-dec194mut-*.tap` |
| 17:34 | Regression + surface: `taxonomy_terms`, `taxonomy_terms_canonical`, `taxonomy_terms_reads`, `taxonomy_definition`, `phase_02_slice_09_r8_api_surface`, `phase_02_slice_09_sec2_definer_rls`, `phase_02_slice_09_sec2_all_schema_definer_rls`, `dec194_sweep` | 8 files, 2,141 tests | 2,138 ok / 3 not ok, all in `r8_api_surface` (4, 5, 13) | not ok 4 and 13: `platform_api.cms_reconcile_taxonomy_merge_converge` is not classified in the shared list (Requests #2). not ok 5: `cms_get_related_content` is listed but absent: another lane's pending function (DEC-195 `dec195` lane), not this lane. Everything else green, including all taxonomy-terms suites | `alt-staged-dec194-133439-2639052.tap` `1047b5cab6e99341a0ca819c6649db6f5a433badee55b7f47cde97ba486fa751` |
| 17:20-17:35 | full `pnpm exec vitest run apps/worker` under `flock -s /tmp/wejammin-quiet.lock` | 677 files | 12,036 / 12,036 | | stdout in scratchpad `claude_s12_dec194_sweep/worker-full-1.out` |
Worker focused runs (all green): the new sweep test (24), wiring (6), import graph (3), runbook test and the eight scheduled-handler files edited or affected (54).

Mutation runs (one deliberate mutation of the WIP body each; a surviving mutant would have meant a missing test):
| mutant | result |
| --- | --- |
| 15-minute guard removed | killed (4 not ok) |
| live-job guard reduced to `running` only | killed (8) |
| work predicate removed | killed (9) |
| `if not replayed` -> `if true` (count replays) | killed (1: "reconciled at most once") |
| key derived from the party, not the failed job | killed (abort at the key-lookup pin, 040:13) |
| stop limit 4 in the loop AND the check | killed (3) |
| stop limit 4 in the loop only | SURVIVED: an equivalent mutant (the loop leaves at the first non-failed job, the check still stops at 3). Not a test gap; the complete mutant above is the real one |
| streak counts all failed jobs, not consecutive | killed (1 + abort) |
| head = oldest failed job | killed (abort) |
| bound measured from `created_at` | killed (4) |

## Test corrections
No existing oracle contradicted the old spec. Eight existing Worker tests had to change because the new spec (DEC-194, BE03c 1414) adds a scheduled participant and removes the open gap. Exact diffs (originals kept in scratchpad `claude_s12_dec194_sweep/orig-*.test.ts`), for independent review:
1. `scheduled-manual-review-retry.test.ts`, `cms-publication-schedule-sweep-wiring.test.ts`, `cms-governed-activation-sweep-wiring.test.ts`: add `runProductionCmsTaxonomyMergeReconcileSweep: vi.fn()` to the hoisted mocks, a `vi.mock('./cms-taxonomy-merge-reconcile-sweep', ...)` block (same shape as its sibling mocks), and `.mockResolvedValue(undefined)` for it in `beforeEach` (an entry in the existing mock list, or one added statement). Without this the unmocked module runs against `{}` and the tick throws.
2. `production-idempotency-expiry-sweep.test.ts`: `operationalResponse` answers `/rest/v1/rpc/cms_reconcile_taxonomy_merge_converge` with `{ requested: 0 }`.
3. `index-scheduled.test.ts`: the fetch mock answers the same RPC with `{ requested: 0 }` (two places); the RPC count per tick 7 -> 8 and 8 -> 9; the sorted RPC list gains `cms_reconcile_taxonomy_merge_converge`.
4. `cms-taxonomy-merge-converge-runbook.test.ts`: removed `expect(runbook).toContain('BOUNDARY')`, the test "states what really drains an unconverged tail..." (it asserted `'Only a later merge of the same acting party above 5,000 assignments'`, `'a continuation of a chain of that party that is still running'`, `'nothing guarantees one'`, and `not /no later event drains/`) and renamed the retry-pause test; added two tests: the runbook documents the sweep (RPC name from the exported constant, tick file, log event, metric, `service_role` only, no live job, key derived from the failed job's id, 15 minutes, 3 consecutive failed generations, reconciled at most once, DEC-194) and no longer contains `BOUNDARY`, `nothing guarantees one`, "open gap" or "no product recovery"; and the BE03c recovery paragraph carries the wrapper name, `service_role`, `15 minutes`, `3 consecutive failed generations`, `platform.on_call`. The registered-code table assertions and the BE03c table sync are untouched and green.

## Spec citations
BE03c line 1414 (recovery rule: wrapper and body names, grants, candidate set, once per failed job key, 15 minutes, 3 generations, `{ requested }`, writes nothing else), 1399 (disposition section), 1377 (convergence and redirect), 1334 (job transport), 1338/1344/1351 (lock order: the sweep takes no row locks of its own; the handler it schedules keeps them); BE00 571 (domain recovery reference), BE00 547 (a re-queued ordinary job is skipped as stale, which is why the recovery requests a FRESH job); DEC-194; tracker P2-S12-AC-226 (the sweep is what lets "re-points every active TermAssignment" hold after a failed job).

## Open items / BOUNDARY
1. No BOUNDARY: the missing spec (DEC-194 / BE03c 1414) now exists and is implemented. The earlier BOUNDARY in the taxonomy-terms report and runbook is closed.
2. Spec-silent points resolved at implementation tier (D1-D3 above): the failed job whose id derives the key, the clock the 15 minutes run from, and what ends a run of failures. Root to ratify or amend.
3. The sweep re-requests for any failed code, as the spec is written. A deterministic failure (for example `CAPABILITY_MISSING` after the curator lost the capability) therefore burns the 3 generations before stopping. The spec does not distinguish codes; the runbook says so (Mitigation). If the owner wants deterministic codes to stop at once, that is a spec change.
4. No per-tick cap on parties: the number of requests per tick is the number of qualifying parties (each already bounded by 15 minutes and 3 generations). BE03c names no cap, so none was invented.
5. After 7 days the idempotency record of a failed job may expire; a party whose latest failed job is older than that and whose run is not at the stop could then be reconciled once more. Bounded by the generation stop; not specified further.
6. Unmeasured: the cold-database cost of the work predicate across many parties in one tick (no DB timing here); it reads `jobs` by `(job_type, state, created_at)` and `(acting_party_id, created_at)` indexes and the existing indexed work predicate.
7. No hosted or production claim is made.

## Requests to root
1. Independent review of this lane, then promote `supabase/migrations-wip/dec194/*.sql` (both files, unchanged bytes of the SHA-256 above) into `supabase/migrations/` and delete the WIP directory. My scratch mutation directory `supabase/migrations-wip/dec194mut/` was deleted after the mutation runs; `dec194/` is the only directory of mine left.
2. Shared test, outside my claim: add `('cms_reconcile_taxonomy_merge_converge')` to the `r8a_supporting` list of `supabase/tests/phase_02_slice_09_r8_api_surface.sql` (beside `('cms_run_taxonomy_merge_converge')`, around line 160, with a comment "DEC-194 recovery sweep, 20261014190010") and bump the count text/number in its last test (currently "8 + 10 + 73"; the supporting set grows by 1). Not ok 4 and 13 of run 4 are exactly this. Not ok 5 (`cms_get_related_content` listed, absent) belongs to the DEC-195 lane.
3. After promotion run `pnpm db:types` (root-owned): `packages/data-access/src/database.types.ts` lists every `platform_api` function; the import-graph test already ignores that file.
4. Ratify D1-D7 and Test corrections #1-#4. Tracker: P2-S12-AC-226 now has an executable recovery (SQL 83 assertions + Worker); the evidence-ledger entries are root-owned.
5. Canonical gates (Worker: full Vitest, `tsc`, eslint; DB: `db:verify` with the promoted migrations). The new RPC adds one `platform_api` call per scheduled tick (every minute).
6. Memory candidate: "a mutation that changes only one of two places a bound is enforced is an equivalent mutant (loop exit vs. check): mutate both before concluding a test gap". And a process note: the Worker module was written after its tests but its RED was not observed by execution (the module did not exist when the tests were written; the first Vitest run was already GREEN), while the SQL layer's RED was observed and recorded above.
