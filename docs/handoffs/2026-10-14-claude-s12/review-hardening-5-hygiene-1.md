# Review: claude_s12_hardening_5 + claude_s12_worker_hygiene_1 (independent, adversarial)

Independent, read-only except this file. HEAD `b16edb54`. Report SHA-256 match disk: h5 `03066ed8…486d`, hy1 `7e594370…dd4e9`.
## A. claude_s12_hardening_5
**Hashes.** 12/15 Files rows match disk. 3 files changed after the report (12:31-12:35Z) by the template-digest lane:
`template-respond.ts`, Web `-mutation.ts`, Worker `README.md`. I rebuilt the reported bytes by removing that lane's
4-line 409 addition (`conflictReasonDetails` import + 3 lines). Result: `template-respond.ts` 151 lines `0a67b348…79ab`
and `-mutation.ts` 294 lines `849c885e…ad1`, both EXACT matches. I judged the README (163 -> 170, edited by two later lanes)
by content only. Both are within limits now: 155 and 298 lines.
**F1 reading: correct.** `forbiddenDetails(operationId, source)` never sees the HTTP status: the caller branches on
`status === 403` (`template-respond.ts`, Web `safeDetails`). The unpinned clause in review-h4 F1 is
`cmsSlice12ReasonStatus(token) === 403` (`refusals.ts:94-102`: one status per token). Its fix asked for on-list, off-status
rows -> `{}`, and that is what the lane did. The brief's literal reading ("capability_missing on a non-403 status") is
handled by the status branch selection: the 409 branch relays only the version pair (now
`conflictReasonDetails`, which is gated `=== 409`), and 422 relays violations only.
**F3: correct.** Worker `errorResponse(..., operationId = 'CMS-03C-01')`; `template-detail-routes.ts:32,64-71` passes
`cmsTemplateLatestRead`; Web `-detail.ts:45` passes it to `forwardedError`. The context read characterization is right:
`error-catalog.ts:96-97` deliberately leaves out `cmsTemplateContextRead`, `CMS_SLICE_12_OPERATION_REASONS` has no key for
it, and BE03c 1323 binds typed refusals "within these catalogs". It follows 03C-01 through the default parameter, and nothing was invented.
Other `forwardedError` callers: context (default, intended), define (`:281`). Pattern has its own local `forwardedError`. No leak.
**F4: rows present** (`taxonomy-term-details.test.ts:223-238`, 3 ops x 3 = 9). The side effect is disclosed accurately.
**Splits: pure moves, confirmed.** A pristine pre-split `locale-routes.test.ts` (889 lines, `32167b8d…`, identical to the
h4 hash) is in another review's scratch. A line multiset against the four new files differs ONLY in `export` on 12
fixtures, import lines and two re-opened `describe` wrappers. The lane's before/after JSON gives 35 = 35 with an identical
sorted title list. Web: pristine `-mutation.ts` (`938f89c6…`) vs the reconstructed 294-line bytes differs only in the
moved `SchemaIssue`/`violationsOf` (bodies byte-identical in `-mutation-violations.ts`, `export` added, one comment
clause) plus the F3 threading. Behaviour is identical.
**README: true.** `capability-details` importers are exactly template-respond, locale-routes-support and
pattern-update-details, plus conflict-details (type) and a test from the later digest lane. Related filters in
`related-content-details.ts:67-70`. The item 7 sentence now points at the routes that exist below.
**Item 6 investigation: right.** BE03c 323-327, 373, 1273 and 1323 all require the 409 `block_registry_digest_mismatch`
on CMS-03C-01. DEC-186 item 2 (`decisions.md:2677`) is as quoted, and its "(already behaves so)" is indeed half true. The
latest producer body is `20261013100200:138-141` (`raise 'CONFLICT'`, no later redefinition among promoted migrations).
The HEAD oracle at `template_authority.sql:426-427` asserted `CONFLICT` (since corrected by the digest lane). The pattern
precedent is `20261014020400:251-252`. The recommendation matches the digest lane's brief.
**Corrections section: verified** (`refusals.ts:144-157`; composed test `:40-43`; resolver `:64`).

### Findings (A)
1. `lane-hardening-5-report.md:14,88` — minor — the claim "each row fails when the gate is removed / 5 failed: exactly the 5
   new rows" was measured at 11:54Z, BEFORE F3 (11:56Z). In the final bytes the detail-read row's token is off
   `cmsTemplateLatestRead`'s list, so the list check drops it whether or not the gate is there. My re-run (status gate
   deleted in a scratch `capability-details.ts`) kills 3 Worker rows: context, define and locale (related has its own
   `typedReason`). The same deletion in the Web capability module kills 4 Web rows (detail survives). The gate is still pinned in
   every filter, and the test comment (`capability-missing-refusals.test.ts:167-168`, Web `:100-101`) admits it. Fix:
   correct the report sentence. No test change is possible while the latest-read row lists only `capability_missing`.
2. `apps/worker/src/cms-composition/taxonomy-term-details.test.ts:218-219` — nit — the comment says CMS-03C-13/14/15 "depend on
   the 403 branch above" of the shared allowlist. That is false: `pattern-update-details.ts:44` routes 403 to
   `forbiddenDetails` first, as the lane's own disclosure says. The `safeDetails(403, …)` assertion is operation-independent
   (repeated 3x), and the `patternUpdateDetails` assertion pins `forbiddenDetails`. Fix: reword the comment.
3. `capability-missing-refusals.test.ts:20-22`, Web `-capability-missing.test.ts:15-16` — nit — the headers of files this
   lane edited still say "BE03c 1304 … every 03c operation … exactly one lowercase 403 token": the review-h4 F5(b)
   overstatement and the drifted line, both corrected in the two modules. Fix: same wording as the modules.

## B. claude_s12_worker_hygiene_1
**Hashes.** 14/14 Files rows match disk. Scratch evidence hashes match: `mutation-results.jsonl` `c65542eb…3778`,
`mutate.py` `a1dcd38c…7abe`, `worker-full.json` `b134ccff…c467d`, `worker-full-run1.json` `3e653e78…c662`. The mutation tree's
copies of all touched files and the three mutated sources are byte-identical to the worktree. The full-run claims match the
JSON: run 1 had 11,951 tests, 3 failed, all digest-lane RED rows in `-template-errors.test.ts`; run 2 had 11,972 tests with
1 failure, the load-sensitive S09 deadline test.
**Mutants sampled (my own scratch copies, redirect config, real Vitest):**
| Mutant | Lane | Mine | Killing rows (mine) |
|---|---|---|---|
| UPDATE_POINTER `/^\/.*$/u` | 5 | 5 | the 5 out-of-grammar 03C-15 pointer rows |
| versionPair relays `{...members, ...pair}` | 1 | 1 | **the invalid-versions 409 row, NOT the F2 test** (Finding B1) |
| no narrowing (`deadlineMs`) | 3 | 3 | the 3 new registry-deadline rows (8,000/8,000/15,000) |
| registry only (`spec.deadlineMs`) | 2 | 2 | the "3,000 ms kept" row + the stalled-body row |
| guard `mergeLoggerFor(undefined, injected)` | 3 | 3 | the 3 new production-composition rows |
I did not re-run the other 6 mutants; read-only checks: `Math.max`, the constant 8,000, null logger, both-undefined, and the
runbook clause (pinned at `runbook.test.ts:129-134`).
**F3 is right.** The tests call `createPatternUpdateRpc` directly with configured 60,000 ms and a never-settling fetch. Nothing
settles at registry-1, and it is 504 at 8,000 / 8,000 / 15,000 ms (`pattern-update-operations.ts:38-56`, registry-pinned). A
configured 3,000 ms is kept for 03C-13. Fake timers are restored in `afterEach`.
**m-f2a is right.** No injected logger, a valid env, `console.info` spied, exactly one `outcome:"failure"` event with
service/env/release/attempt/metric, and the lease token absent. **F4:** title-only diffs (`%i` -> `$2`/`$1`) in 7 files.
The baseline had 86 passing "NaN" titles, the after run has 0, and the printed titles are sensible. **F5 no-extract
reasoning: sound.** There are three copies (`-pattern-update-rpc.ts:60-112`, `-pattern-definition.ts:69-112`,
`-governed-review.ts:67-108`). Extraction needs files outside the claim, and governed-review is in an active lane. One
quibble: the "comparison order" difference is a side-effect-free `||` chain, so it does not block a helper. **Item 7 is right**
(names.ts and runbook wording, AC-226 cited by id and now at `:2221`, Open item 1 marked SUPERSEDED).

### Findings (B)
1. `apps/worker/src/cms-composition-production-pattern-update-failure.test.ts:222-242` — minor — the F2 test cannot fail for
   its property. `versionPair` reads only `structuredMembersFromDetailText`, which keeps only `STRUCTURED_KEYS`
   (`cms-editorial-production-error-details.ts:133-145`). The test's extra members (`instanceId`, `pageVersion`, `reasonCode`,
   `violations`) are therefore stripped before `versionPair` sees them. Under "relay all members" it still passes. The
   report's "Mutant relaying every DETAIL member KILLED" is true, but the kill comes from the invalid-versions row
   (`:244-256`, strengthened by F1), not from F2. A mutant relaying non-pair structured members (`dependencyClass`,
   `retryAfterSeconds`) survives every row. Exposure is low (the route 409 allowlist strips, per review F2). Fix: add a
   STRUCTURED_KEYS member, e.g. `retryAfterSeconds: 5`, `dependencyClass: 'x'`, to the starting DETAIL, and re-run the
   mutant against this row alone.
2. Same file `:85`, `:108` and report item 1 — nit — "every `toMatchObject({… details …})` … is now `toEqual`" overstates.
   The scrubbed-500 rows still use subset `details: {}` (vacuous for `details`, the same pattern F1 fixed), and `:147`,
   `:160`, `:201`, `:289`, `:312` keep subset matchers on non-empty details. Array-length strictness and
   `not.toHaveProperty` mitigate those. Fix: narrow the claim to relayed refusals, or convert `:85/:108`.
3. `mutate.py` m3 id `M-F2A-env-only-injected` — nit — the code is `mergeLoggerFor(undefined, undefined)`, which drops
   both sinks, so the "env-only/injected-only" label is misleading. The kill is valid.

## Conventions and security (both)
No `any` or TODO in touched files; all touched test files are ≤351 lines, and `-mutation.ts` has 298 lines (limit 300).
No weakened oracle: hardening-5 adds rows only, and hygiene-1 removes only the vacuous `not.toHaveProperty` on an
instanceId-free DETAIL, now subsumed by `toEqual`. No mock returns the expected error. 403 concealment and PII scrubbing are
unchanged. The F3 tests mutate the live contract array under try/finally; Vitest isolates modules per file (no `isolate`
override).

## Runs (UTC 2026-10-15, pinned PATH, `flock -s /tmp/wejammin-quiet.lock`)
| time | what | result |
|---|---|---|
| 13:04 | hardening-5 focused: capability x2, taxonomy-term-details, locale x3, Web mutation + error-relay | 8 files, 190/190 |
| 13:04 | gate-deleted mutants (Worker / Web capability module) | 3 / 4 rows fail (Finding A1) |
| 13:05 | F3 mutants (template-respond / forwardedError ignore operationId) | 1 / 1 fail: detail-read row (RED confirmed) |
| 13:08 | 5 hygiene mutants (table above) | all KILLED; F2 kill comes from another row |
| 13:11 | hygiene focused: 11 touched test files | 11 files, 389/389 |
| 13:11 | `tsc --noEmit -p apps/worker` | exit 0 |
| 13:13 / 13:17 | `astro check` apps/web | 2 errors (1969 files) then 0 errors / 176 hints (1973 files): concurrent Web lanes in flux |
Not re-verified (outside allowed execution): full suites, eslint, prettier.

Verdict A (hardening-5): CLEAR. 1 minor (stale mutation claim), 2 nits.
Verdict B (worker-hygiene-1): CLEAR. 1 minor (F2 row non-discriminating; property still pinned elsewhere), 2 nits.

VERDICT: CLEAR
