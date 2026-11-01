# Lane report: claude_s12_worker_hygiene_2

## Status
GREEN (2026-10-15 17:39Z). HEAD b16edb54. Items 1-3 done. Pure refactor (F5), one non-vacuity fix (F2), nits done; one production
branch removed (proved redundant). Scratch: `/tmp/claude-1000/-home-rob-Projects-WeJammin/5e403708-915a-4cd3-958f-4ebc866d0c82/scratchpad/claude_s12_worker_hygiene_2/` (mutation tree `tree/` is a COPY of apps/worker/src with symlinked
packages/node_modules; the worktree was never mutated; `pristine/` restore verified after every batch, driver prints "done" with no NOT RESTORED).

## Scope
`briefs/worker-hygiene-2.md`: (1) F5 one shared request-bound fresh-context verifier for the three near-copies, (2) review-hardening-5-hygiene-1 B minor
(F2 test could not fail), (3) nits (comment at taxonomy-term-details.test.ts:218, "exactly one 403 token" header, redundant 403 branch).

## F5 comparison of the three copies (no behavioural difference found)
Copies: update rpc (`pattern-update-rpc.ts`), `pattern-definition.ts`, `governed-review.ts`. Identical: requestId UUID gate, x-request-id header gate, stored
context + user/party equality (401), fresh resolution, envelope guard (502), refusal relay, post-resolution context equality (401) incl.
`validHumanSession`, rebuilt context via `cmsEditorialContextFor` on the refreshed session. Differences, all parameterised, none behavioural:
- Comparison ORDER of the four post-resolution equalities (update compared sessionId first): side-effect-free `||` over plain property reads of an already
  fetched object; same result. Helper uses the definition/governed order.
- Capability decision: update `actingPartyId===null || !(author|editor)` -> 403 capability_missing; definition `... || !template_designer`; governed
  `governedGate(operationId, session)` (returns any refusal incl. 401 STEP_UP_REQUIRED, null admits). Parameter `authorize(refreshedSession, input) => Refusal | null`.
- `failure` / `validEnvelope` come from three catalogs (pattern-instance, template-shared, governed's own catalog messages): parameters, never merged.
Helper: `cms-editorial-production-fresh-context.ts`; adopters keep exports/signatures (`createPatternUpdateContextVerifier` is now a thin wrapper).

## Files (SHA-256 at the time of the final full run)
| path | lines | SHA-256 |
|---|---|---|
| apps/worker/src/cms-editorial-production-fresh-context.ts (new) | 116 | 82f61efbd1ccda466ae98865894e7df7f585f4e76c345241dc9629ab09d6787b |
| apps/worker/src/cms-editorial-production-fresh-context.test.ts (new) | 217 | 52dc6005640247361b864504b025a78f3491fddd21be05cffcd829c609fc47bb |
| apps/worker/src/cms-composition-production-pattern-update-rpc.ts | 188 | a28e71f744cd68100c192a3d1d9a9a289d5dda8f7b746743925d5fc11e38c507 |
| apps/worker/src/cms-composition-production-pattern-definition.ts | 141 | e8511d3c0c9d7ca84b86a56af13fef482172e620cf49596f0619cca158e79bf6 |
| apps/worker/src/cms-composition-production-governed-review.ts | 121 | 5b471a70cffaed13b580d9ab745817858985f981341ef7de10f7bc7eec5c5074 |
| apps/worker/src/cms-composition-production-pattern-update-failure.test.ts | 356 | ed0944a51ce04408f5078ad048c480cbd59aad03c64d2525d7ecb30c79c9a14e |
| apps/worker/src/cms-composition/taxonomy-term-details.test.ts | 263 | 81b9a8377dcb6cff433bb10658d579c23b65549c8253215cd91202fafce18f7b |
| apps/worker/src/cms-composition/taxonomy-term-details.ts | 63 | 7692da51a67e89c5219e84658bba96cc7162c092da040459b62ab97d8352adde |
| apps/worker/src/cms-composition/capability-missing-refusals.test.ts | 352 | ab275c56694dc43aac65b1a983b2f2485a96a457e0ad38c80c45852df1ffde40 |
All files last modified 16:45:48Z or earlier, before the full run (17:27:59Z), except `capability-missing-refusals.test.ts`, whose comment-only header citation was refreshed on 2026-10-16 by the Codex evidence lane (row hash above updated; still 352 lines). Existing tests untouched except the three edits below.

## What changed
1. **F5.** New helper + focused test (18 tests at first draft/run: requestId/header gates, user/party equality before resolution, refusal relay incl. empty details and retry hint,
   non-envelope 502, five post-resolution drifts never reaching the authorizer, malformed fresh session, authorizer gets the REFRESHED session and port
   input, authorizer refusal returned verbatim, context rebuilt once; the final helper adds the independent requestId-UUID test for 19 total). RED first: import of the missing module failed. All existing tests unchanged and green
   (initial 18-test checkpoint: focused 55 files / 1,686 tests before; 56 files / 1,704 after, +18 new; the final 19-test file is recorded by the saved `worker-full.json`).
2. **F2.** `pattern-update-failure.test.ts` "version pair only": starting DETAIL now also carries STRUCTURED members `retryAfterSeconds`, `dependencyClass`,
   `dependencyHash` (these survive `structuredMembersFromDetailText`); the non-structured members stay. Mutants KILLED by this test (by name): relay every member
   (also killed the invalid-versions row), relay `retryAfterSeconds`, relay `dependencyClass`, relay `dependencyHash`.
3. **Nits.** (a) taxonomy-term-details.test.ts comment reworded: `patternUpdateDetails` routes every 403 to `forbiddenDetails` first
   (`pattern-update-details.ts:44`), CMS-03C-13/14/15 do not depend on the shared allowlist's 403. (b) Worker `capability-missing-refusals.test.ts` header cites BE03c "Slice 12 typed refusals" (line 1399),
   names the operations it exercises and says CMS-03C-06/-07 also publish `separation_of_duties`. (c) `taxonomyTermDetails` 403 branch REMOVED
   (`return safeDetails(status, source)`): `safeDetails(403, x)` returns {} for every x (`taxonomy-safe-details.ts`: early `{}` for non-objects, explicit 403 guard before
   the 409/429/5xx members, `{}` at the end). Proved by a new 12-row table (undefined, null, text, number, array, {}, violations, version pair, rate members, dependency members, recovery
   hint, media-type hint) asserting `safeDetails(403, s)` AND `taxonomyTermDetails(403, s)` are {}; mutants making the 403 guard delegate to 409/429/503/401/415 are KILLED.

## Mutation evidence (copy tree, real Vitest; catalogue cat1/cat2/cat3.js, driver mutate.js 3cf5684d…, results res1 4b3f805c… res2 930bf82f… res3 b38b9e6d…)
Helper (H, focused set 56 files): 20 mutants. First run: KILLED 18 (header gate x2, stored-context check, user and party compare, 502->503,
relay drops details / retry / status, post-resolution undefined check, authUser/session/person/party re-check, validHumanSession, authorize skipped, authorize on
admitted session, authorizer refusal rewritten). Two SURVIVORS, both analysed:
- H01 (requestId UUID gate removed) SURVIVED the first run: the pre-existing update-context test (and my first draft) pair a bad requestId with a valid
  x-request-id header, so the header gate masks it. New independent helper test "a request id that is not a UUID is 400 even when no x-request-id header corroborates it" (`cms-editorial-production-fresh-context.test.ts:142`); H01 re-run KILLED (1).
- H20 (context built from `input` instead of `{...input, session: refreshed}`) EQUIVALENT: `cmsEditorialContextFor` reads `input.session` only when the Request has no
  recorded server context, and the helper has already returned 401 for that case.
Combined across the runs: 19 KILLED and 1 EQUIVALENT (H20); no single run killed all 20.
Adopters: update A01-A05 (author only 1, editor only 54, party check 1, no capability 4, reason dropped 5) all KILLED; definition D01 (136), D03 (2), D04 (2) KILLED;
**D02 (definition: party-null clause removed) SURVIVED** (kept, not removed: pure refactor). The clause is unreachable through the composed adapter: the verifier is private to
`createProductionCmsPatternDefinitionDependencies`; the route gate (`pattern-definition-ports.ts:157-160`) already 403s a null party and the resolver stores the same
`actingPartyId` it returns (`production-session-resolver.ts:113-124`), so a refreshed null party would already be a 401. Defense in depth, equal to the HEAD behaviour. Governed
G01 (gate dropped) and G02 (admitted session) KILLED (5 each).
F2 and taxonomy: see item 2/3. Equivalent non-kills (cat2 T01, T02, T04): widening a status test AFTER `safeDetails`' explicit `if (status === 403) return {}` cannot take effect; the
real mutants (cat3 T05-T09, guard delegating) are the ones that count and all KILLED.

## Runs (UTC, pinned PATH, `flock -s /tmp/wejammin-quiet.lock`)
| time | what | result |
|---|---|---|
| 16:35 | baseline focused (governed-review, pattern-definition, governed-activation, pattern-update, pattern-selector, runtime) | 55 files, 1,686/1,686 |
| 16:35 | helper test RED | module missing (right reason) |
| 16:36 | helper test GREEN | 18/18 |
| 16:38 | focused after adoption (existing tests unchanged + helper) | 56 files, 1,704/1,704 |
| 16:44 | taxonomy-term-details + taxonomy* after branch removal | 14 files, 364/364 |
| 17:27 | prettier --check + eslint --max-warnings=0 on the 9 files | clean / exit 0 |
| 17:27 | worker `tsc --noEmit` | exit 2: 12 errors, ALL in other lanes' related-content-read files (RelatedContentReadApiRequestSchema, RelatedContentRuleRead not yet exported by contracts, `cmsRelatedContentRead` index); 0 in my files. It was exit 0 after my adoption edits at 16:37. |
| 17:27:59-17:38:46 | full `apps/worker` Vitest (`worker-full.json` a89d44d6…) | 681 files, 12,088 tests, 12,088 passed, 0 failed, 0 pending |
A first attempt at `pnpm exec vitest` inside the scratch tree made pnpm try to reinstall; it refused (ERR_PNPM_UNSAFE_MODULES_DIR) and nothing was removed. The tree now runs `node node_modules/vitest/vitest.mjs`.

## Test corrections
None to oracles' meaning. Strengthened: `pattern-update-failure.test.ts` F2 starting DETAIL (richer input, same assertion). Header/comment text in two test files. New rows only otherwise.

## Spec citations
BE03c "Slice 12 typed refusals" (line 1399): 403 tokens `capability_missing`, `separation_of_duties`; per-operation lists. CMS-03C-13/14/15 author|editor capability (rows 177-179), CMS-03C-12 template_designer,
governed review owner capability + step-up and the hidden-review 404 rule (BE03c "Recent MFA" line 218, "Known readable resources with insufficient capability" line 1597, enforced by `governedGate`). Identity re-proof is transport convenience; the database re-proves under its locks.

## Open items / BOUNDARY
None. Notes: (1) D02 above. (2) The remaining hygiene-1 nit 2 (scrubbed-500 rows still subset-match `details: {}`) is outside this brief; unchanged.

## Requests to root
1. Web twin of the capability header nit: `apps/web/src/server/cms-composition-platform-capability-missing.test.ts:15-16` and `apps/web/src/server/README.md:178` still say each 03c operation gives its 403 "exactly one lowercase token". I may not touch `apps/web/**`.
2. Optional: one line in `apps/worker/src/README.md` naming `cms-editorial-production-fresh-context.ts` (README is being edited by other lanes; not in my claim).
3. Worker `tsc` is red only from the related-content-read lane in flux; re-run the canonical gate after it lands.

## Correction / history (Codex evidence lane, 2026-10-16)
Written by the Codex hygiene-evidence lane after a root 6.1/ultra independent review found no executable or security defect and two evidence/citation nits. Transparent correction of this report's own claims; no source behaviour or test assertion changed.

- **Helper test count.** The `18 tests`/`+18 new` figures describe the FIRST draft/run. The final helper test file has 19 cases: it adds the independent requestId-UUID test (`cms-editorial-production-fresh-context.test.ts:142`). The saved `worker-full.json` records 19 for that file. The `55 files / 1,686 tests -> 56 files / 1,704 tests` receipt is preserved as the initial 18-test checkpoint; the final 19 is not a retcon of the old counts.
- **Mutant accounting.** The original 20 helper mutants: first run killed 18 and left 2 survivors. H01 (requestId UUID gate) was then killed by the added independent UUID test and its re-run. Combined, the final tally is 19 killed and 1 equivalent (H20). No single run killed all 20. The other D02 survivor/story is unchanged and remains as recorded above.
- **Citation refresh.** The `BE03c 1323` reference was stale: line 1323 is now `locale: Bcp47,` inside `LocaleFieldResolution` (CMS-03C-20), not the typed-refusals clause. The typed-refusals paragraph is line 1399; the report and the test header now cite the stable human-section label with the current line 1399. Token reasons, operation names and test cases are unchanged. Other citations were rechecked against the current clauses: Recent MFA line 218; typed refusals line 1399; the disclosure/404 sentence line 1597; the CMS-03C-13/14/15 author|editor rows are lines 177-179. Different behaviours were not 'fixed'.

## Independent review limit (Codex evidence lane, 2026-10-16)

- All nine files in the manifest table above were untracked at HEAD `b16edb54`, so no pre-lane committed baseline exists for them.
- The pre-lane Oct-14 archive holds only an OLDER pattern-definition adopter; the two adopter before-images are unavailable.
- Fresh independent proof (a rerun/read-back of the manifest hashes and the helper test count at a reviewed commit) is pending; the saved receipts are the lane's own runs, not an independent rerun.
- No GREEN, runtime, or acceptance claim is made here. Root runs validation.
