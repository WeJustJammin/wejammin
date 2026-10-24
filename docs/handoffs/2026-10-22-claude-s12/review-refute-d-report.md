# Refutation review: lane d re-citation proposals, P2-S12-AC-215 .. AC-296

Reviewer: `claude_s12_refute_d` (independent of lane d). Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Inputs: `docs/handoffs/2026-10-22-claude-s12/recite/d-proposals.json` (82 criteria, 675 proposed citations, 36 retained existing citations), the lane report `lane-recite-d-report.md`, the brief `briefs/recite-refutation.md`.
Output: `docs/handoffs/2026-10-22-claude-s12/recite/d-refutation.json` (82 entries, written criterion by criterion; this report is derived from it).
Nothing was run (no Vitest, Playwright, pgTAP, race, docker, supabase); evidence is the final canonical run `.lane-logs/canonical/final-evidence-20261023T224619Z` (`vitest-all.json`, `uniq8.json`), the lane TAP logs `.lane-logs/*.tap` and the sources. Only the refutation JSON and this report were written to the repository.

## 1. Verdict

**ACCEPT**, on the brief's rule (13 DROP of 675 proposed citations = 1.9%, at most 5%), **conditional on applying every DROP, FIX, REJECT-split and status verdict in `d-refutation.json`**. DROP plus FIX is 23 of 675 (3.4%). The lane is not over-claiming systematically: it left 10 criteria unverified and 25 partial, flagged most of its own weak links, and under-cited as often as it over-cited (492 tests it missed, 122 outside AC-275). What is wrong is concentrated in three places: five citations the ledger guard would reject outright, three criteria stated verified over a known untested exclusion, and seven criteria whose cited-but-incomplete units would make the guard record an unproven half as proven. Applied unchanged, the proposal makes the guard fail (section 6, findings 1 to 3).

## 2. Counts

Every one of the 675 proposed citations and the 36 retained existing citations received a verdict.

| | KEEP | FIX | DROP | total |
|---|---|---|---|---|
| Proposed by the lane | 652 (96.6%) | 10 (1.5%) | 13 (1.9%) | 675 |
| Retained existing (not proposed) | 36 | 0 | 0 | 36 |
| Both | 688 | 10 | 13 | 711 |

By tool (proposed only): pgTAP 417 KEEP / 7 FIX / 8 DROP; Vitest 229 KEEP / 3 FIX / 5 DROP; race 3 KEEP; Playwright 3 KEEP. 16 of 82 criteria carry at least one DROP or FIX.

Statuses (lane proposed -> recomputed from the citations I keep): verified 47 -> 44, partial 25 -> 28, unverified 10 -> 10.
Splits: the lane proposed splits for 19 criteria; I accept 15 and reject 4 (224, 261, 265, 278); I propose new splits for three clauses the lane left whole (240, 241, 286).
Missed tests (tests that prove a clause and the proposal does not cite): 492 across 44 criteria, of which 370 are the uncited data-driven rows of AC-275 and 122 are spread over the rest. Missed or corrected gaps and notes: 129 entries.

## 3. DROP: reason classes (13)

| Class | n | Citations | What is wrong |
|---|---|---|---|
| Mechanical: the guard rejects the ledger | 1 | AC-281 [2.0] | The test is already the existing citation of that clause; `ledger-guard-lib.mjs:541` rejects "cited twice in one clause". |
| Proves a neighbouring property, not the clause part it is attached to | 9 | AC-235 [0.6] (a 128-bound on staleFieldIds the clause never states), AC-238 [4.3] (a retired row contributes nothing, not a canonical tree validating its own blocks), AC-241 [0.2] (the build/status/evaluate calls raised nothing), AC-245 [4.1] (revision lineage, not which composition rows restore translates), AC-247 [0.1] (plan_position consecutive: padding), AC-271 [0.5.1] (the diffState error row, not "a degraded diff is never kept"), AC-281 [2.1] (invalid authority, not revocation), AC-281 [3.1] and [3.2] (a superseded source is the concurrency scenario, not deletion) | The assertion is true and passing but belongs to another clause or to no clause. |
| Source-substring test that cannot discriminate | 1 | AC-265 [0.1.0] | `template-designer-route.test.ts:38-46` greps the page source for `Astro.redirect`, a 401 test and a 502 mapping; nothing names 303 or the sign-in path. |
| Fixture premise, not the behaviour | 1 | AC-286 [2.0] | EDT16 counts zero bindings; a server that picked the first binding passes identically, so "do not select the first binding" is untested. |
| Asserts the opposite of the label | 1 | AC-270 [0.8] | The request-builder test asserts the fallback chain IS serialized into the body; the lane label is "never in the URL", which the test never inspects. |

## 4. FIX (10)

| Class | n | Citations |
|---|---|---|
| Wrong owner file for a pgTAP title (the guard cannot find the identity) | 4 | AC-218 [7.6]; AC-258 [0.0.0], [0.1.1], [0.2.7]. The whole quoted description sits in an included `.sqlinc`, which is the owner (`literalOwners`); the proposal names the entrypoint. |
| Right area, wrong sibling (the cited assertion does not prove the clause; the discriminating twin exists) | 6 | AC-215 [1.3] -> CC-RST004; AC-243 [3.8] -> CC-RST001 fresh-rows test; AC-265 [0.5.2] -> Worker "reads only the validated latest definition ..."; AC-280 [4.4] -> the form's save test (a page-serving test was cited as "completion"); AC-283 [0.6] -> the related-content form's save test (same pattern); AC-286 [2.1] -> the `edp-sbound` first-revision pin (the cited EDP-S03 is a setup assertion). |

## 5. Criteria whose status changed, and structural verdicts

Status changed (3), all verified -> partial:
- **AC-240**: "a missing value outranks a stale one" is asserted nowhere (no revision with both a missing and a stale no_fallback field). The lane note admits it; one unsplit unit cannot express it. Re-split isolates that precedence as an uncited part.
- **AC-241**: `packages/contracts/src/cms-editorial/preflight.ts:148` registers category taxonomy as `referenceGateRow` (reason `provider_unbuilt_reference` only), so the fixed reason copy does not accept `term_merged_unconverged`, `allowlist_changed` or `taxonomy_version_not_active`; the lane note "its reasons are accepted by the contracts" is wrong. The taxonomy provider is unbuilt (AC-239).
- **AC-286**: the "first binding" exclusion has no test (every fixture is built with empty bindings); the route-manifest half of "placement/route-manifest consumers" has no test (placement does).

Status unchanged but the proof boundary moved (the lane's split is rejected, so the guard does not count an unproven half as proven): **AC-224** (as drawn the entry is partial with every clause cited, which the guard itself rejects), **AC-261**, **AC-265**, **AC-278**. The three downgrades above also carry new splits.

Confirmed unverified, no citation can honestly be added: AC-239, 242, 244, 246 (taxonomy assignment integrity is unbuilt), 251, 254, 273, 276, 277, 279. Final status table: appendix A.

## 6. The ten most serious findings

1. **AC-281 [2.0]: a test cited twice in one clause.** The proposal adds the apispec "no session is 401 ... a revoked database grant is 403 ..." to clause 2, which already holds it. Applying the proposals as written makes the guard fail. It is the only duplicate among the 675 adds (every clause and part was scanned).
2. **Four wrong-owner pgTAP identities and one structurally rejected entry.** AC-218 [7.6] (SR-REUSE), AC-258 [0.0.0], [0.1.1], [0.2.7] cite the entrypoint while the included `.sqlinc` owns the description; AC-224 is stated partial with every clause cited, which the guard rejects ("partial entry: every clause is cited"). AC-218's was caught only by the final identity sweep (see section 9).
3. **Race citations cannot yield receipts as the evidence runner is set up (AC-249 [0.7], AC-294 [0.1], [0.2]).** The Slice 12 race modules run in canonical mode only with `WEJAMMIN_CANONICAL_RACE=1` (`infra/database-races/canonical-mode.mjs`); otherwise the module asserts the explicit ALT release variables (`RUN_S12_ENTRY_DEFAULT_TEMPLATE_LOCK_RACE=1` and the ALT container names, `040-race-session.mjs:35-55`) and fails when they are absent. `scripts/evidence/run-plan-lib.mjs:229-244` plans `node <runner>` and `run-execute-lib.mjs:51-54` spawns it with `process.env` plus an empty step env; only `infra/run-database-race-runners.mjs:162` sets the variable. `summary.txt` of the final run has no race step under SLICE12, so this path has never been exercised.
4. **"Verified" over a known untested exclusion (AC-286, AC-240, AC-241).** See section 5. AC-286's cited EDT16 is a premise that passes for the wrong implementation.
5. **Seven criteria with cited-but-incomplete units.** E.g. AC-278 part "a log or a cache." is cited by two log tests only (no cache test, although no-store tests exist; nine are listed in missedTests); AC-261 part 2 cites the empty-`search_path` test for a sentence that also demands PUBLIC execute revoked, named grants only and positive and negative grant tests; AC-265 part 1 bundles the proven session check with the unproven 303 redirect.
6. **AC-271: the "skeleton after 250 ms" loading rule has neither implementation nor test.** No slice-12 island (`cms-governed-review`, `cms-composition`, `cms-composition-instances`, `cms-locale`, `cms-pattern-designer`, `cms-taxonomy-*`, `cms-related-content`, `cms-editorial-fields`) contains a skeleton or a 250 ms deferral (`CmsCompositionPage.tsx:56-58` renders "Reading the update..." at once). The lane limitation says "has no test"; it is a spec deviation that needs an owner decision (implement, or amend FE03's loading row).
7. **AC-274: the clause text is false as literally written and the lane's verified hides it.** The clause says a provider timeout is 503. The cited matrix shows the Worker's own 15 s deadline answers 504 and a provider-reported 504 is mapped to 503; the clause says an unmapped status or foreign message is treated as 500, while the browser proxies collapse both to 502 (`cms-pattern-platform-errors.test.ts` "collapses an undeclared status to a 502"). Each behaviour matches its own spec row; the criterion wording needs the owner. The contract tests also pin two tokens the clause omits (`block_registry_digest_mismatch`, `expiry_out_of_bounds`).
8. **AC-275: a clause about "every operation" cited by 66 of 436 passing data-driven rows.** The 370 others are listed in `missedTests` (derived mechanically, unique `fullName`s). Two single assertions that carry "every operation" (the registry lists exactly the 25 operations; OpenAPI documents exactly the 25) are uncited. The clause says "five supporting reads"; the fixture, the tests and BE03c hold eight.
9. **Leakage criteria cite the wrong channel (AC-272, AC-278).** Public-projection claims (draft composition, canonical-domain authority, capability data absent from a public read) have no test; AC-272 part 0 (decision reasons, policy basis, diff values, canonical ids, assignment ids never in a cache, analytics event, Realtime body, URL or log) has no sweep and no Realtime evidence at all.
10. **Proof the lane missed, in the other direction.** AC-270 cites route and loader tests that inject the read's 403/404 and never the sixteen AC-270-tagged pgTAP assertions that prove `supportedLocales` membership, authority-before-locale and concealment (of the nine AC-270 citations only [0.8] is wrong). AC-233's lane gap for "[] exactly when locale is its defaultLocale" is false (`locale_variant/003-contract-and-idempotency.sqlinc:97-146`). AC-232's entryId tie-break test, AC-263's route-level suites and AC-283's completion tests (RPC, Worker 201, browser save) are uncited. AC-294's gap (a) is covered for relation targets by the Slice 10 race `012-relation-target-race.mjs` ("S2 create/unassign").

## 7. Open items that no citation can close (implementation or owner decision)

- Unbuilt: taxonomy assignment integrity (AC-239, 242, 244, 246; `term_unavailable`/`comparison_unavailable` for taxonomy versions do not exist in the migrations); relay narrowing of the template/pattern/taxonomy events to their aggregate types (AC-248 parts 1 and 2: only the locale tuple is narrowed in `20261014050800_cms_relay_locale_variant_aggregate.sql`).
- Untested with no neighbour at all: worker lease expiry and restore-epoch fencing (AC-277), per-writer lock order for CMS-03C-01/-02/-03/-06..-09/-12/-16, the carry-over and the merge command (AC-276), the 64-slot, 512-node and 50-term performance sizes and every end-to-end p95 target (AC-279), persistence constraints and grants (AC-251 to AC-256), the end-to-end journeys (AC-273).
- Owner wording decisions: AC-274 (timeout 503 versus 504, 500 versus 502), AC-275 (five versus eight reads), AC-277 (does "deterministic tested outcome" mean a two-session race per pair, or one pinned outcome per commit order; scenarios 7 and 8 are open under either reading).

## 8. Under-citation

492 tests are listed under `missedTests` (Vitest 442, pgTAP 50): 370 are the AC-275 rows; the rest include the AC-270 pgTAP set, AC-283/285 completion and announcement tests, AC-274's catalog and provider-fault tests, AC-278's no-store tests, AC-263's route-level suites, AC-269's 303 pin. Tests that are only partial evidence for an unverified or partial clause are described in `missedGaps` and are deliberately NOT in `missedTests`, so that nobody cites them and flips a status.

## 9. Deviations from the resume instruction

The resume message asked that the 47 entries already in the JSON stay unchanged. Two were corrected after the final identity and status sweep, because leaving them would have left known errors in the file:
- **AC-261**: status was recorded `unverified` (an artefact of the assembler's REJECT handling); the correct status after the re-split is `partial` (parts 0 and 2a cited, parts 1 and 2b uncited). Now `partial` with `statusReason`.
- **AC-218 [7.6]** (SR-REUSE): verdict KEEP -> FIX (owner file). Reason text states the correction.
Everything else in the first 47 entries is byte-identical to the file I found.

## 10. Applying the refutation (for root)

- Citation `tag`: `c.i` is add `i` of clause `c`; `c.p.i` is add `i` of split part `p` of clause `c`; `xc.i` is existing citation `i` of clause `c`. KEEP = add as proposed. DROP = do not add. FIX = add the object in `fix` (tool, file, title) instead.
- `splits[].verdict = REJECT`: do not use the lane's `proposedSplit` (or lack of one) for that clause; the verbatim re-split is quoted in `reason`. The `status`, `statusReason` and `limitation` fields are the ones the re-split yields; where the entry carries no `limitation`, keep the lane's.
- `missedTests`: add only where the clause is otherwise cited; they carry `clauseIndex` and, for a split clause, `splitPart` of the lane's split.
- Run the real guard on the combined ledger: the "sole proof for at most 3 criteria" rule and cross-lane duplicates can only be checked ledger-wide (within lane d no test is the sole proof of a clause for more than one criterion).
- Before the evidence run that follows: export `WEJAMMIN_CANONICAL_RACE=1` and start from a freshly reset database (finding 3). The three AC-280 citations to `tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts` get receipts only once cited (the receipts file lists cited tests); that step passed (exit 0) in the final run.
- pgTAP identities were checked against the lane TAP logs (owner rule, uniqueness, ok), not against a canonical verbose TAP; root's later mechanical check is still the arbiter.

## 11. Method and limits

Per citation: opened the test and read the asserting lines; checked that the assertion is the clause's behaviour and not a premise, a source substring or a neighbouring property; checked identity (Vitest `fullName` and `passed` in `vitest-all.json`/`uniq8.json`; pgTAP owner rule, TAP count and ok in the lane TAP logs; race and Playwright title and project against the sources and the run log); searched for tests the lane missed (grep of the suites, the TAP descriptions, the Vitest identities); recomputed the status from the kept citations. Final sweeps over the finished JSON: identity of every KEEP, every FIX target and every missed test; duplicates inside any clause or split part; sole-proof counts within lane d. Not done: any execution, anything outside lane d's criteria, a re-review of the retained existing citations beyond identity.

## Appendix A: final status per criterion

Columns: criterion | lane status | refuted status | KEEP / DROP / FIX | missed tests | notes.

| AC | lane | final | K / D / F | missed | notes |
|---|---|---|---|---|---|
| 215 | verified | verified | 12 / 0 / 1 | 0 | FIX 1.3 |
| 216 | partial | partial | 7 / 0 / 0 | 1 | - |
| 217 | verified | verified | 8 / 0 / 0 | 2 | - |
| 218 | partial | partial | 50 / 0 / 1 | 2 | FIX 7.6 |
| 219 | partial | partial | 6 / 0 / 0 | 2 | - |
| 220 | verified | verified | 5 / 0 / 0 | 2 | - |
| 221 | partial | partial | 4 / 0 / 0 | 0 | - |
| 222 | verified | verified | 6 / 0 / 0 | 0 | - |
| 223 | partial | partial | 3 / 0 / 0 | 1 | - |
| 224 | partial | partial | 10 / 0 / 0 | 2 | re-split |
| 225 | partial | partial | 8 / 0 / 0 | 1 | - |
| 226 | verified | verified | 11 / 0 / 0 | 1 | - |
| 227 | verified | verified | 7 / 0 / 0 | 2 | - |
| 228 | partial | partial | 12 / 0 / 0 | 0 | - |
| 229 | verified | verified | 11 / 0 / 0 | 4 | - |
| 230 | verified | verified | 7 / 0 / 0 | 1 | - |
| 231 | verified | verified | 4 / 0 / 0 | 1 | - |
| 232 | verified | verified | 4 / 0 / 0 | 1 | - |
| 233 | partial | partial | 11 / 0 / 0 | 3 | - |
| 234 | verified | verified | 6 / 0 / 0 | 0 | - |
| 235 | verified | verified | 6 / 1 / 0 | 0 | DROP 0.6 |
| 236 | verified | verified | 10 / 0 / 0 | 2 | - |
| 237 | verified | verified | 4 / 0 / 0 | 0 | - |
| 238 | partial | partial | 26 / 1 / 0 | 2 | DROP 4.3 |
| 239 | unverified | unverified | 0 / 0 / 0 | 0 | - |
| 240 | verified | partial | 17 / 0 / 0 | 0 | status verified -> partial; re-split |
| 241 | verified | partial | 7 / 1 / 0 | 1 | status verified -> partial; re-split; DROP 0.2 |
| 242 | unverified | unverified | 0 / 0 / 0 | 0 | - |
| 243 | verified | verified | 16 / 0 / 1 | 2 | FIX 3.8 |
| 244 | unverified | unverified | 0 / 0 / 0 | 0 | - |
| 245 | verified | verified | 22 / 1 / 0 | 0 | DROP 4.1 |
| 246 | unverified | unverified | 0 / 0 / 0 | 0 | - |
| 247 | verified | verified | 9 / 1 / 0 | 0 | DROP 0.1 |
| 248 | partial | partial | 2 / 0 / 0 | 0 | - |
| 249 | verified | verified | 8 / 0 / 0 | 0 | - |
| 250 | verified | verified | 5 / 0 / 0 | 0 | - |
| 251 | unverified | unverified | 0 / 0 / 0 | 0 | - |
| 252 | partial | partial | 5 / 0 / 0 | 1 | - |
| 253 | partial | partial | 8 / 0 / 0 | 0 | - |
| 254 | unverified | unverified | 0 / 0 / 0 | 0 | - |
| 255 | partial | partial | 4 / 0 / 0 | 0 | - |
| 256 | partial | partial | 2 / 0 / 0 | 0 | - |
| 257 | verified | verified | 7 / 0 / 0 | 0 | - |
| 258 | verified | verified | 30 / 0 / 3 | 1 | FIX 0.0.0,0.1.1,0.2.7 |
| 259 | verified | verified | 5 / 0 / 0 | 0 | - |
| 260 | verified | verified | 14 / 0 / 0 | 0 | - |
| 261 | partial | partial | 4 / 0 / 0 | 0 | re-split |
| 262 | verified | verified | 5 / 0 / 0 | 4 | - |
| 263 | verified | verified | 16 / 0 / 0 | 8 | - |
| 264 | verified | verified | 11 / 0 / 0 | 0 | - |
| 265 | partial | partial | 11 / 1 / 1 | 1 | re-split; DROP 0.1.0; FIX 0.5.2 |
| 266 | verified | verified | 14 / 0 / 0 | 1 | - |
| 267 | verified | verified | 13 / 0 / 0 | 4 | - |
| 268 | verified | verified | 12 / 0 / 0 | 4 | - |
| 269 | verified | verified | 9 / 0 / 0 | 4 | - |
| 270 | verified | verified | 8 / 1 / 0 | 11 | DROP 0.8 |
| 271 | partial | partial | 10 / 1 / 0 | 3 | DROP 0.5.1 |
| 272 | partial | partial | 6 / 0 / 0 | 1 | - |
| 273 | unverified | unverified | 0 / 0 / 0 | 0 | - |
| 274 | verified | verified | 13 / 0 / 0 | 6 | - |
| 275 | verified | verified | 66 / 0 / 0 | 370 | - |
| 276 | unverified | unverified | 0 / 0 / 0 | 0 | - |
| 277 | unverified | unverified | 0 / 0 / 0 | 0 | - |
| 278 | partial | partial | 6 / 0 / 0 | 9 | re-split |
| 279 | unverified | unverified | 0 / 0 / 0 | 0 | - |
| 280 | verified | verified | 4 / 0 / 1 | 2 | FIX 4.4 |
| 281 | verified | verified | 3 / 4 / 0 | 2 | DROP 2.0,2.1,3.1,3.2 |
| 282 | verified | verified | 10 / 0 / 0 | 4 | - |
| 283 | verified | verified | 6 / 0 / 1 | 6 | FIX 0.6 |
| 284 | verified | verified | 7 / 0 / 0 | 3 | - |
| 285 | verified | verified | 6 / 0 / 0 | 7 | - |
| 286 | verified | partial | 7 / 1 / 1 | 2 | status verified -> partial; re-split; DROP 2.0; FIX 2.1 |
| 287 | partial | partial | 2 / 0 / 0 | 0 | - |
| 288 | verified | verified | 5 / 0 / 0 | 0 | - |
| 289 | partial | partial | 1 / 0 / 0 | 0 | - |
| 290 | verified | verified | 3 / 0 / 0 | 0 | - |
| 291 | verified | verified | 6 / 0 / 0 | 1 | - |
| 292 | partial | partial | 6 / 0 / 0 | 0 | - |
| 293 | verified | verified | 9 / 0 / 0 | 3 | - |
| 294 | partial | partial | 3 / 0 / 0 | 0 | - |
| 295 | partial | partial | 1 / 0 / 0 | 1 | - |
| 296 | verified | verified | 6 / 0 / 0 | 0 | - |
