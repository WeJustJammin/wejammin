# Lane claude_s12_governed_v4 report

## Status
GREEN (2026-10-23T05:21:54Z). HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. V4-01, 02, 04, 05, 06, 07, 08, 09, 10, 11 closed (V4-03 race modules, V4-12, V4-13 are root's). Final run (stack
`pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,block-rules,dec208,governed-v4`, 45 files): **12,204 tests, 0 failed, Result PASS**
(governed_recheck 157/157, governed_recheck_pattern 21/21, governed_activation 124, governed_decision 58, governed_schedule 56, governed_schedule_ladder 24, dec191 53, all other governed/dec191 files green).
Worker Vitest (governed-recheck module + the review-recheck entrypoint test): 8 files / 88 tests / 0 failed. RED, GREEN, two mutation runs and the broad run are recorded under Runs.

## Scope
Brief: `docs/handoffs/2026-10-22-claude-s12/briefs/governed-v4.md`. Review: `review-v4-report.md`. Decisions DEC-221 (V4-02, V4-05). Claim: `supabase/migrations-wip/governed-recheck/*`, NEW `supabase/migrations-wip/governed-v4/`,
governed pgTAP files/dirs, `apps/worker/src/cms-composition/governed-recheck/*`. `governed-recheck-red/` never touched.

## Design decisions
- **V4-02 (migration).** NEW `governed-v4/20261022120000_cms_governed_frozen_status_lock_failures.sql`, an anchored patch of the LIVE `platform_private.cms_governed_frozen_status(uuid)` (only definition: promoted
  `20261013300400`; no WIP redefines it; the three later digest patches touch `cms_governed_current_digest`, not this function). One anchor (`exception when others then return 'changed'; end;`), asserted to occur exactly once in the
  installed source and absent from the replacement, inverse replacement proven byte for byte, every pg_proc attribute except the source compared before/after (owner, SECURITY DEFINER, search_path, ACL), same shape as
  `block-rules/20261022080400`. New handler: `when deadlock_detected or lock_not_available then raise; when others then return 'changed';`. The function comment gains one DEC-221 sentence after the verification.
  **57014 does not belong**: PL/pgSQL `when others` never traps `query_canceled` (nor `assert_failure`), so a statement timeout already propagates unchanged; naming it would be dead code. 40001 is not named (the digest runs
  at READ COMMITTED; no serializable path). The decision and activation wrappers already map 40P01/55P03 to P0001 CONFLICT, so no wrapper changes.
- **V4-05 (edit in place of `governed-recheck/20261022030200`).** New private definer function `cms_governed_invalidate_review_if_live(review, reason, actor, party, correlation) returns boolean`: subject row FOR UPDATE
  (`cms_governed_subject_resolve(..., true)`, position 3), plain re-read of the review (a fresh statement, so it sees any command that committed before the lock was granted), `false` and no write when the review is not
  `open`/`approved` or has `activated_at`, otherwise the unchanged single-review invalidation and `true`. The person invalidation calls it per candidate and counts only `true`; `review_not_open` stays tolerated.
  Why a separate function: one session cannot interleave two commits inside one statement, so the stale candidate is reproduced at the per-candidate seam (a review that is not live when the step runs); the real
  interleaving is race R-3 (root). Owner/ACL bracket extended (owner `wejammin_cms_definer`, revoke from public/anon/authenticated/service_role). File is 209 lines.
- **V4-07.** The template world has no pattern subject, so the pattern recheck is a NEW suite `phase_02_slice_12_governed_recheck_pattern.sql` (+ dir with README), built on the pattern-definition fixtures with 2 types
  (`s12pd.type_count`): a nested pattern review really approved but not activated, the nested child's successor really activated, the producers' resolver over the real `cms.pattern.activated.v1` event, and the `pattern` run called
  with THAT event id; the audit record's correlation id equals the outbox row's. (It passed on the original migrations: it is test strength, like V4-01/04/06.)
- **V4-10.** Handoff ids (`R3-07`, `R3-08`, `R3-12`, `R3-20`) removed from the immutable headers of `030000`, `030100` (4 places), `030200`; DEC-207 (synchronous invalidation, no recheck enqueue) and DEC-218 (isolation) and section names put in their place.
- **V4-06.** `job.ts` logs a successful run with `unavailable > 0` at **warn** level (outcome stays `success`, ack unchanged, `highRisk` true); info otherwise. Worker README names both RPCs and the isolation behaviour (V4-11).

## Files (SHA-256, first 12 hex; full hashes by `sha256sum`)
| path | before | after |
| --- | --- | --- |
| `apps/worker/src/cms-composition/governed-recheck/README.md` | 957bd70d4c6d | b7c2408ae924 |
| `apps/worker/src/cms-composition/governed-recheck/contract.test.ts` | 0c509be35e98 | 79197287639b |
| `apps/worker/src/cms-composition/governed-recheck/job.test.ts` | fecd1355a7c9 | 5ff3167c9e31 |
| `apps/worker/src/cms-composition/governed-recheck/job.ts` | a440f52de104 | 02a6d70ec0f0 |
| `supabase/migrations-wip/governed-recheck/20261022030000_cms_governed_recheck_verdict.sql` | 0fad12738d3d | 7c6b93c99111 |
| `supabase/migrations-wip/governed-recheck/20261022030100_cms_recheck_governed_reviews.sql` | 4057f46d4395 | 5d11a406b8a4 |
| `supabase/migrations-wip/governed-recheck/20261022030200_cms_invalidate_governed_reviews_for_person.sql` | fa59297541a6 | 9ef5e2baa757 |
| `supabase/migrations-wip/governed-recheck/README.md` | 7f87728d1b7d | f4155499792a |
| `supabase/tests/phase_02_slice_12_governed_recheck.sql` | cd88328b9455 | 3e8c8c912560 |
| `supabase/tests/phase_02_slice_12_governed_recheck/002-lapse-helpers.sqlinc` | f62edc832ab0 | aa3495259cbd |
| `supabase/tests/phase_02_slice_12_governed_recheck/020-contract.sqlinc` | 2d296a5da3b9 | f9f5acc0c74b |
| `supabase/tests/phase_02_slice_12_governed_recheck/080-tenure.sqlinc` | d6d232540c76 | 60a9c83c87ce |
| `supabase/tests/phase_02_slice_12_governed_recheck/README.md` | 05982a6c77dd | 7b78f1adbf34 |
| `supabase/migrations-wip/governed-v4/20261022120000_cms_governed_frozen_status_lock_failures.sql` | (new) | 81a4ed063a5e |
| `supabase/migrations-wip/governed-v4/README.md` | (new) | e776c2b7ecf1 |
| `supabase/tests/phase_02_slice_12_governed_recheck/075-digest-locks.sqlinc` | (new) | 881e34bfa7c7 |
| `supabase/tests/phase_02_slice_12_governed_recheck/078-person-live.sqlinc` | (new) | 8b34cc991cee |
| `supabase/tests/phase_02_slice_12_governed_recheck/085-real-reader.sqlinc` | (new) | acbd103c4d66 |
| `supabase/tests/phase_02_slice_12_governed_recheck/090-rpc-context.sqlinc` | (new) | c07b4fa0a3bf |
| `supabase/tests/phase_02_slice_12_governed_recheck_pattern.sql` | (new) | 47bf9e6422f2 |
| `supabase/tests/phase_02_slice_12_governed_recheck_pattern/010-pattern.sqlinc` | (new) | a7b98cd784ee |
| `supabase/tests/phase_02_slice_12_governed_recheck_pattern/README.md` | (new) | 0cccb148dc9c |
Unchanged: `governed-recheck/20261022030300_*`, all other governed pgTAP files, `governed-recheck-red/`.

## Runs (all through `lane-db-alt-staged.sh`, background, no `timeout`)
| # | time (local) | stack / plan | result | classification | TAP |
| --- | --- | --- | --- | --- | --- |
| 1 | 00:22 | RED stack: `governed-recheck` replaced by scratch `governed-v4-red` (the ORIGINAL four migrations, hashes equal the review's), no governed-v4; governed_recheck + governed_recheck_pattern | recheck aborted at 075:25 after 105 tests (24-26 not ok); pattern 21/21 | **harness**: template keys are lowercase, my tags `dgA`.. gave VALIDATION_FAILED; fixed (`dga`..) | `.lane-logs/...governed-v4-red...-002215-471866.tap` |
| 2 | 00:25 | same RED stack, governed_recheck | 156 tests, 21 not ok: 24-26 (new function missing: genuine missing feature V4-05/V4-08), 107-114 + 116 (V4-02 defect reproduced: `have: ok\|ok want: P0001:CONFLICT\|P0001:CONFLICT`; activation `ok\|subject_not_activatable`, decision `ok\|review_not_open` because the first call had already invalidated the healthy review), 120-122, 124-129 (V4-05 step missing; 128/129 cascade). 085/090/080 (V4-01/04/09) and the pattern suite pass on the original migrations. 109/110 fail only through their `untouched` conjunct (cascade of 107). | RED as intended | `...002526-492366.tap` sha256 `0f76537221e3...` |
| 3 | 00:33 | GREEN: `...,governed-recheck,block-rules,dec208,governed-v4`; governed_recheck + pattern | 177/177 | GREEN | `...003233-527579.tap` |
| 4 | 00:35 | same, after adding the amended-function metadata assertion to 075 | 178/178 (157 + 21) | GREEN | `...003434-541077.tap` |
| 5 | 00:41 | MUTANT 1 (scratch `governed-v4-mutant`): resolver wrapper, person function, grant trigger, tenure trigger and recheck wrapper no longer restore `app.cms_rpc`; step no longer checks liveness | 121-122, 127 (liveness) and 153, 154, 155, 156, 157 (one per entry point) not ok: each PAT-031 / V4-05 assertion detects its own mutation | mutation killed | `...003551-550246.tap` sha256 `0f8ee71a36ad...` |
| 6 | 00:48 | MUTANT 2 (`governed-v4-mutant2`): private recheck no longer sets the flag before its first read | 28 not ok incl. 153 (examined 0): the cleared-flag read answers nothing | mutation killed | `...004229-581489.tap` sha256 `c85aa0774c57...` |
| 7 | 00:49 | FINAL: stack above, 45 files: all `phase_02_slice_12_governed*`, `dec191*`, every Slice 12 file that reaches `cms_activate_governed_subject` through its includes (34, minus `linked_scan`: another live lane), plus `phase_02_slice_09_sec2_definer_rls` (catalog-derived definer guard: the new function conforms), `phase_02_slice_10_activation_lock_order`, `phase_02_slice_10_presence_lease`, `phase_02_slice_11_helpers_invalidation`, `phase_02_slice_09_r3_grants_misc`, `phase_02_slice_09_dec119_future_membership` (the suites that write the tenure/actor-grant tables under the new tenure trigger, V4-12f) | **12,204 tests, 0 failed, PASS** | GREEN | `.lane-logs/alt-staged-pattern-updates+dec193+dec194+dec195+locale-gate+dec197+dec202+dec205+dec206+governed-recheck+block-rules+dec208+governed-v4-004900-611571.tap` sha256 `d878c4d962b10049e9739b960d95a2d5282e88f54227dfab082256214ea2285d`; manifest sha256 `7f1ad4ae0fbd3b2f720ea85cf9e84817196e113e855a40a463fe84bfafc78936` |
Worker: RED (2 failing: warn level) -> GREEN: `vitest run apps/worker/src/cms-composition/governed-recheck apps/worker/src/production-async-entrypoint-review-recheck.test.ts`: 8 files / 88 tests / 0 failed (JSON in scratch, sha256 `cafdf8bffeb3bd221c21d053017767595f97cf202708be4e053e3ad327c0fca3`).
Scratch WIP dirs of runs 1, 5, 6 were removed from `supabase/migrations-wip/`; copies live in `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_governed_v4/scratch-wip/`.

## Test corrections
No existing oracle was weakened or changed in meaning.
- `080-tenure.sqlinc` (V4-09): the vacuous control (`not holds(otherOrg, x11)` was true before the tenure ended) is replaced: x11 gets a labelled second-organization tenure AND a `cms.reviewer` actor-grant projection (precedent: the S09 harness forges the second organization's schema-designer projection the same way; INSERTs fire no trigger), a pre-condition assertion proves x11 holds the capability in BOTH organizations, the tenure UPDATE is proven to have ended exactly one row, and afterwards x11 holds it only in the owner organization while tn6 still counts.
- `020-contract.sqlinc` (V4-08): metadata assertion 4 -> 7 functions (adds both trigger functions and the new step), ACL assertion for those three (no API role may execute), `has_function` for the step. Additions only.
- `002-lapse-helpers.sqlinc`: comment only (cites the real-reader witness, V4-01 (3)). `phase_02_slice_12_governed_recheck.sql`: driver gains the four includes.

## Spec citations
BE03c "Governed review machinery" Invalidation and changelog row "Governed lock failures and revocation races" (DEC-221); "Reviewer-authority invalidation on revocation"; "Slice 12 lock order"; BE03b "Write-path lock order and authority fencing" rules 3 and 4; DEC-207, DEC-218, DEC-221; PAT-031 (`.memory/raw/events/2026-10-23.jsonl`).

## Open items / BOUNDARY
- V4-04 optional real-PostgREST composition spec (`tests/postgrest/...apispec.ts`) NOT written (needs a PostgREST run; the review marks it optional). The two service_role wrappers are exercised under the real role in pgTAP; the private recheck, verdict and event reference are reachable only through their wrappers and are covered through them.
- V4-05 true interleaving (activation committing between the candidate snapshot and the subject lock) cannot be produced in one session; covered at the per-candidate seam, with the real interleaving left to root's R-3 race (revocation versus activation, both orders: the activation-first order must now end with the revocation committing and invalidating nothing for that review).
- V4-01 alternative (2) (`s09g_warp`, disabled user triggers) NOT used (lane rule); alternative (1) used, plus the comment. A STORED `approved` state that lags is still refused through the stand-in, because with AC-204 triggers a real write invalidates first.
- The new function `cms_governed_invalidate_review_if_live` is a third private object in `030200` beyond the person function and two triggers: promotion order is unchanged (one file), the catalog-derived SEC-2 guard passes; root's hand-listed inventories (`r8_api_surface`) name only platform_api functions and are unaffected.
- `governed-v4` is an anchored patch of a promoted function: it must be promoted AFTER the promoted tree contains `20261013300400` (it is) and exactly once; the runner stages it together with `governed-recheck`.

## Requests to root
1. Promote `governed-v4/20261022120000_*` together with the `governed-recheck` files; delete `governed-recheck-red/` and `fix-recheck/` (C1) before staging.
2. BE03c: the lock-order table row for `cms_invalidate_governed_reviews_for_person` can now say the candidate is re-read under the subject lock (DEC-221 wording exists in root's update); the per-candidate step is a new private function name that no spec lists.
3. Race R-3 (both orders) and R-1/R-2/R-4 stay with root (V4-03).
4. Optional: raw DEC record for the R3-07 tenure trigger (V4-12e) is still open.

## Backups
- Pre-edit tar of every file edited in place: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_governed_v4/orig-20261023T041007Z.tar` (SHA-256 `64d3ba36b2b77a8cc93d26d10179ce910ab76f8167bc0e6b1a655b2ee41aff85`).
