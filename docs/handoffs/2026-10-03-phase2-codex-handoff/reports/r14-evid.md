# r14-evid report (lane EVID) — in progress, appended per finished item

Worktree /home/rob/.codex/worktrees/ac265-hosted-evidence-producer/WeJammin, HEAD 073496db at start.

## Item 1 (H) machine-generated receipts: DONE (collector + guard + unit tests); real-output run is the integrator's
- scripts/evidence/receipts-lib.mjs (parsers, builder, evaluateReceipts), scripts/evidence/collect-receipts.mjs (CLI), `pnpm evidence:collect`.
- Output: tests/contracts/phase-02-slice-09-receipts.generated.jsonl, one JSON line per marker x test: {criterion, tool, granularity, file, title, status, fileSha256}.
- Inputs: vitest `--reporter=json`, pgTAP TAP (verbose = per-assertion receipts attributed to the included .sqlinc whose source holds the text; non-verbose `supabase test db` output = file-level receipts, flagged), Playwright JSON (`--playwright-test-dir`), db:races.
- DB3 race format (designed here): JSON lines `{"marker":"P2-S09-AC-052","title":"...","status":"passed|failed","file":"supabase/tests/.../x.mjs"}` (marker = one criterion id, file = repo-relative runner path). The collector ALSO accepts today's plain db:races text (`ok - ...` lines + `PASS|FAIL <runner> exit=`), verified on scratchpad/logs/r13-races.log.
- Trial on real r13/s09v4 outputs (not committed): 7501 receipts (pgtap 2930 file-level, vitest 4415, playwright 125, race 31), 1239 criteria, 0 missing file hashes.
- Guards: tests/contracts/phase-02-slice-09-receipts-guard.test.ts (every verified criterion x cited file needs a fresh, passing receipt, stale/failed/flaky/missing fail; race runners listed as supplementary need race receipts; runs in pnpm validate via vitest gate; ci.yml `database` job runs db:ci -> db:verify -> db:races with no continue-on-error and `build` needs `database`). Collector unit tests: tests/contracts/phase-02-slice-09-receipts-collector.test.ts (13 tests, fixtures only).
- Hand-typed `receipts`/`observed` removed from every index entry (N/N 1239 entries); guards that read them were rewritten.

## Item 2 citations from markers: bidirectional guard DONE; E-list status below
- tests/contracts/phase-02-slice-09-marker-citations.test.ts: every file that carries a verified criterion marker in a TITLE (vitest it/test/describe/each title, pgTAP assertion description, race-runner string; comments and guard data are not carriers) is cited by that criterion (testFiles or supplementary), and every cited test file carries it. 6 tests (1 guard + 5 carrier-detection fixtures).
- RED: 3 uncited carriers (AC1127 step-up.dom test, AC025 be00-middleware-order test, AC1149 the new guard). GREEN: AC1127 cited; AC025 is now held (not indexed); new guard files cited under AC1144 / AC1149 / AC274.

## Item 3 vacuous assertions: DONE
- tests/contracts/phase-02-slice-09-vacuous-assertions.test.ts: static scan of ALL Slice 09 guard files (tests/contracts/phase-02-slice-09-*.test.ts and .test-support.ts) for always-true shapes (empty slice, toContain(''), expect(literal), self-equality, length>=0, || true, empty-literal loops, filter(()=>false), match-everything toMatch) + fixture tests of each shape + a nested vitest run with --expect.requireAssertions over the non-AC265/AC211 guard files (any test that executes zero assertions fails). AC265/AC211 guard files (heavy) were swept once with the same flag: 98 files, 964 tests.
- RED (2): pre-traceability.test.ts:264 `.slice(0, 0)` (AC274 asserts nothing about the plan) and amendment-evidence.test.ts "keeps a non-empty limitation ..." (zero assertions: all 11 browser-dependent criteria cite Playwright, so nothing ever ran). Log scratchpad/logs/evid-red-vac.log.
- GREEN: AC274 now asserts the plan states `${authored} authored / ${authored-gates} active**`; the limitation test asserts for each environmental criterion (browser run OR limitation) and that the set is non-empty. N/N = 2/2 vacuous guards fixed, 0 left.

## Item 4 tracking: DONE except where marked
- Tracker lines 10/13: "956 open"/missing block replaced; open-criteria block now lists the 19 held criteria; plan+tracker prerequisite sentence reads "every ... criterion AC284-AC1239 that the open-criteria block of the Slice 09 tracker lists as open" (guards in phase-completion-policy and cross-surface-traceability updated to the new text).
- "249/1235" notes in Slice 10 and Slice 12 trackers -> 1216/1235. spec-pipeline.md NEXT no longer lists AC678/AC1128-1138 (all [x]); phase tracker line 388 now consistent (1216/1235, holds named). Counts: Slice 09 verified 1216/1235 (1235 - 19 holds), Phase 2 active-checked 2,448 -> 2,429; scripts/check-progress-consistency.mjs and cross-surface-traceability guard now COMPUTE the verified count from checked rows instead of hard-coding 1235/1235.
- decisions.md: raw events already hold DEC-108..DEC-123 (N/N 16/16, ids as recorded); `node .memory/pipeline/compile.mjs` run, decisions.md now runs DEC-100..DEC-123. PITFALL: compile rewrites spec-graph footers in ~22 spec files and silently breaks the AC1148 ledger digests; I undid those (scratchpad/evid/uncompile.py, run it after every compile).
- Ledger rows added for AC034, AC390, AC641 (pending owner ratification, authority "R12-db flag rulings"); guard added: pending-ratification ledger rows == index held list == unchecked plan/tracker rows with the inline note.
- AC282/AC1147 attribution: ledger rows and the contract-reconciliation transfer record now say DEC-122 (ratified) covers AC1031->S11 046-048 and AC1166->S12 051-052; S12-053 DEC-123; S16-029 the pending AC185 ruling. Keyword regex "covered by existing owners" replaced by an exact mapping (11 topics -> slice/criterion/words). NOT changed (held rewording): the criterion text of AC282/AC1147 still credits all seven to DEC-122, and S12-053's own text cites DEC-122 beside DEC-123 -> needs ruling.

## Item 2 E-list (WEAK C): 25/27 fixed, 2 open
- The uncited proof files carried a DIFFERENT criterion's marker, so citing them was impossible without the marker. Added the criterion marker to the exact assertion/title and cited the file (32 one-line title edits, all text-only, listed in scratchpad/evid/e-list-edits.json): 023, 167, 171, 303 (CMS-03A-09 rate row), 307, 308, 454 (CMS-03A-13 rate row), 527, 545, 594, 602, 629, 632 (two files), 739, 797, 814, 828, 856, 863, 895, 898, 918, 929, 1047, 1227.
- STILL OPEN (could not identify the proving assertion by grep): AC090 (immutability of the frozen WorkflowPolicyEvidence snapshot: the proof is "in dec108_submit pgTAP", only summary-present assertion AC372 found), AC1142 (lost-access link + CFG-05B-06 authority proof lives in AC1098 files / authority tests). Needs the lane that wrote them to name the assertion.
- pgTAP edits are description-only and unrun (NO database runs): the db:test receipts for those files must be regenerated by the integrator.
- Index maintenance tools (scratchpad/evid): transform-index.cjs (strip/hold/addFiles, idempotent), sync-citations.test.ts (prints the uncited carriers as an ops file), uncompile.py, refreeze: scripts/evidence/refreeze-ledger-sources.mjs. DO NOT re-run the old scratchpad/s09v4/merge-v4.mjs: it regenerates the whole index and would drop the receipt-field removal, holds and citation edits.

## Item 5 AC1150 runbook: DONE
- docs/runbooks/platform/sole-admin-mfa-lockout.md: procedure now 7 steps. Step 5 is the step-up reconciliation hop (first enrollment 401 -> /step-up -> provider 404 -> factor marked reconciling -> 409 no_verified_factor "Add an authenticator"), step 6 "Checking status" until the reconciler's polls (15, 60, 300 s) settle it, step 7 the 600 s primary sign-in window (401 asks to sign in again). Escalate only when a removed factor is still listed after the three polls and refresh, `/step-up` never answers no_verified_factor, or enrollment is refused otherwise.
- RED 3/4 (tests/contracts/phase-02-slice-09-sole-admin-runbook-hop.test.ts, log evid-red-runbook.log) -> GREEN 4/4; the older tests/security runbook test still 4/4.
- needs ruling: BE01a does not state the dashboard-removal hop; it is derived from apps/worker/src/authentication/step-up-service.ts (comment names this runbook) and FE01 ("Checking status"). Suggest one BE01a sentence.

## Item 6 AC025 / BE03a: DONE
- BE03a bullet (~line 147) now defers to BE00 §Hono Middleware Order exactly and restates no order; changelog row 2026-10-03 (R14 spec consistency). Guard rewritten (r12-spec-text AC025 block): RED 2/8 (bullet restated an order; no changelog row) -> GREEN 8/8. BE00 order itself asserted in the guard.
- Ledger "Sources frozen" re-frozen for BE03a (scripts/evidence/refreeze-ledger-sources.mjs); re-run it after any further spec edit (ledger guard AC1148 fails otherwise).
- r14-wk.md "spec-deltas" was empty: nothing to apply. WK's code now follows BE00 order (its own new test); AC025's text is unchanged and may be re-provable: see bundle.

## Item 7 holds: DONE 19/19
- 005, 007, 025, 034, 037, 180, 185, 233, 246, 261, 282, 356, 390, 431, 641, 658, 708, 906, 1147 moved from the index to S09_AMENDMENT_OPEN (status held-pending-ratification), unchecked in plan and tracker with the inline note "held: reworded text pending owner ratification (ledger row ACnnn)", listed in the tracker open-criteria block. Counts: verified 1216/1235 (denominators unchanged 1239/1235), Phase 2 active-checked 2,429. progress:check exits 0.

## Item 8 ratification bundle: DONE
- scratchpad/decisions/r14-ratification-bundle.md: 19 held + AC181 and AC685 (not held, audit reopen-now). Original (2026-09-26 plan text for AC001-283, c196eca3 for AC284+), current, defect, proposed text (no counts beyond the enumerations the criteria already carry), authority, evidence, owner decision. Not applied.

## Verification (exact)
- All Slice 09 guard files + tests/security runbook test (101 files): 971 passed, 5 failed, 1 skipped (977). The 5: receipts-guard x3 (no committed receipts file yet: the integrator must run `pnpm evidence:collect` / scripts/evidence/collect-receipts.mjs on real vitest/pgTAP/Playwright/db:races output; the collector marks any result whose file changed after its report as `stale`: on the old r13/s09v4 outputs 3,501 of 7,525 rows come out stale) and AC1108 x2 (amendment-evidence + marker-citations): another lane (WEB) removed `[P2-S09-AC-1108]` from AdminMfaFactorResetForm.dom.test.tsx; restore it or reopen AC1108.
- `pnpm progress:check` exit 0. `pnpm format:check`: my files clean; 3 files of other lanes flagged (cms-editorial/conflict-routes.test.ts, cms-editorial/route-fixtures.test-support.ts, content-schema-registry/route-human-handlers.ts). `pnpm type-check`: 6 errors, all in other lanes' web files (step-up-required.inventory.test.ts x5, content-schema-registry-s09-r8-no-offline-intent.dom.test.tsx x1); eslint clean on my files.
- Open cross-lane notes: S12-053's own text cites DEC-122 beside DEC-123 (should be DEC-123 only per the ruling); AC282/AC1147 criterion texts still credit DEC-122 (held; fix is in the bundle).
