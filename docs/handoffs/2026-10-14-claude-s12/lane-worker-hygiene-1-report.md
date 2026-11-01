# Lane report: claude_s12_worker_hygiene_1

## Status
GREEN for this lane's scope (see `## Runs` for the two full-suite runs and why each had a non-lane failure). Test-only plus comment/runbook/report text; no production
behaviour changed. HEAD `b16edb54`. Items 1-4, 6, 7 done; item 5 (F5) intentionally NOT extracted, reason below.
Scratch: `/tmp/claude-1000/-home-rob-Projects-WeJammin/5e403708-915a-4cd3-958f-4ebc866d0c82/scratchpad/claude_s12_worker_hygiene_1/`
(mutation tree `tree/` is a COPY of `apps/worker/src` with symlinked `packages/` and `node_modules`; the worktree was never mutated).

## Scope
`briefs/worker-hygiene-1.md` items 1-7 from `review-worker-pattern-updates.md` (F1-F5) and `review-worker-taxonomy-terms-f2.md`
(m-f2a, n-f2a, AC-226 citation, f1 n-f2 carry-over).

| Item | Result |
|---|---|
| 1 F1 | `cms-composition-production-pattern-update-failure.test.ts`: every `toMatchObject({... details: {...}})` on a relayed refusal is now `status` + `expect(refusal.details).toEqual(...)` (pointer-dropped cases for CMS-03C-13 and 15, the no-DETAIL/prose/array/invalid-version 409s, the CONFLICT/IDEMPOTENCY 409s, the common table, the prose-injection 404). Mutants widening `UPDATE_POINTER` and `SELECTOR_POINTER` are KILLED (5 and 1 tests). |
| 2 F2 | The "version pair only" test starts from a DETAIL that carries `instanceId`, `pageVersion`, `reasonCode` and `violations` beside the pair and asserts `details` `toEqual({expectedVersion:'7', currentVersion:'9'})`. Mutant relaying every DETAIL member KILLED. |
| 3 F3 | New rpc-layer tests (fake timers, never-answering fetch, configured deadline 60,000 ms): CMS-03C-13/14 settle 504 at exactly 8,000 ms (nothing at 7,999), CMS-03C-15 at exactly 15,000 ms; a configured 3,000 ms is kept, not widened. Four mutants KILLED (see table). Independent of the route's own deadline: the test calls `createPatternUpdateRpc` directly. |
| 4 F4 | All `%i`-fed-a-string titles fixed with `$N` index placeholders (vitest 4 `formatTitle` supports `$<index>` on array rows). 8 files; before: 86 passing-test titles containing "NaN" in the focused set (`baseline-verbose.txt`), after: 0 (`after-verbose.txt`). No test body changed except parameter names untouched. |
| 5 F5 | NOT extracted. See Open items. |
| 6 m-f2a | `production-job-effect-dispatcher-taxonomy-merge-telemetry.test.ts`: `it.each` over the three guard paths (effect not wired, effect throws, answer outside the disposition set) with NO injected logger and a valid Worker env (`APP_ENVIRONMENT`, `APP_RELEASE`); `console.info` (default sink) is spied and one `outcome:"failure"` event with `service:"wejammin-cms-taxonomy-merge"`, environment, release, attempt and the metric is asserted; the lease token is asserted absent. Mutant `mergeLoggerFor(undefined, ...)` (dropping `context?.env`) KILLED (3). |
| 7 nits | Wording now names the running chain (`names.ts` comment, runbook "Mitigation and the open gap"); the pinned wording test also pins the new clause (mutant dropping it from the runbook KILLED). AC-226 citation in `lane-worker-taxonomy-terms-report.md` m-f3 now cites the tracker line `:2213` (verified 12:26Z) and says to find it by id because the line drifts. The first-pass Open item 1 (report line 120) is marked SUPERSEDED. |

## Files (touched; SHA-256 at the time of the final run)
| path | lines | SHA-256 |
|---|---|---|
| `apps/worker/src/cms-composition-production-pattern-update-failure.test.ts` | 351 | dc3fccedcf1aa9e45f6b89a63c1cc745273e44f22003fb0716855585c4014a7a |
| `apps/worker/src/cms-composition-production-pattern-update-rpc.test.ts` | 296 | eb21209e49baf42a137fc9b78bc94ed74b8298c5481948012a9b16ad8c0ba32e |
| `apps/worker/src/cms-composition/pattern-update-admission.test.ts` | 248 | 6a053d74f7938b79c03e79c28144f518e026266f27903e73da66fd4ec58e5fd3 |
| `apps/worker/src/cms-composition-production-pattern-update.test.ts` | 242 | 0bdd8ae9995c897e6137a1d8963f4103b2b4057aa369ec1f2af9fa34caa29fef |
| `apps/worker/src/cms-composition-production-pattern-update-apply.test.ts` | 326 | 8d5e388c67fc0c70d10c2221b2a5b190f4fa64d205f3467eb7ce0598cfd5dded |
| `apps/worker/src/cms-composition/pattern-update-routes.test.ts` | 274 | b4c3b62e275825adcc4b758d96c06a3f7a1dece5953c875a7ec1daf5e6cf377e |
| `apps/worker/src/cms-composition/pattern-selector-routes.test.ts` | 222 | 8dd7a205c6d9b000bfd504677fa89c14e082fea96a471622dc066eb774c18dbc |
| `apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts` | 166 | cd1844da5da58bd9217a8d089cad789e7893e4027cb5aae22dd2d716b35df47f |
| `apps/worker/src/cms-composition/pattern-update-details.test.ts` | 147 | 9002a5b3c49ada1c0627f62b82d00904c9391d842ffd12c35491eba7a85b725e |
| `apps/worker/src/production-job-effect-dispatcher-taxonomy-merge-telemetry.test.ts` | 249 | bc64ac5942a9ddcfdd349d38cb70a7759dbd5830ca3a22c52c2426d553e24bec |
| `apps/worker/src/cms-taxonomy-merge-converge-names.ts` (comment only) | 38 | 1b2798b93b2237334df9ba7a43b2de97a965f8fd136b9dc803af3d78cbdcfb7c |
| `apps/worker/src/cms-taxonomy-merge-converge-runbook.test.ts` | 146 | be840934a26cd0cc1dbf2d0dccd4acaeccae471d4d66a9743cd553fbd8048ec8 |
| `docs/runbooks/platform/cms-taxonomy-merge-converge.md` | 87 | fb4f36a5e9f56b7295df6aa054fc162d745fa1466edabb7d2b62d9224f51141a |
| `docs/handoffs/2026-10-14-claude-s12/lane-worker-taxonomy-terms-report.md` (m-f3 citation, Open item 1 superseded marker) | 356 | 8c48b536d81aacff196786bc94261ed690b5facadf6436062d3b066fa4b85207 |
Test files all <= 351 lines (limit 400); production source touched: one comment in `names.ts`.

## Mutation evidence (copy tree, real Vitest; `mutation-results.jsonl` SHA-256 `c65542eb…3778`, driver `mutate.py` `a1dcd38c…abe`)
| id | Mutant | Result |
|---|---|---|
| F1-UPDATE-POINTER-widened | `UPDATE_POINTER = /^\/.*$/u` | KILLED (5 failed) |
| F1-SELECTOR-POINTER-widened | `SELECTOR_POINTER = /^\/.*$/u` | KILLED (1) |
| F2-version-pair-relays-extra | `failure(409, {...members, ...pair})` | KILLED (1) |
| F3-no-narrowing | `Math.min(deadlineMs, spec.deadlineMs)` -> `deadlineMs` | KILLED (3) |
| F3-registry-only | -> `spec.deadlineMs` (configured ignored) | KILLED (2) |
| F3-max | -> `Math.max(...)` | KILLED (5) |
| F3-constant-8000 | -> `Math.min(deadlineMs, 8_000)` | KILLED (1) |
| M-F2A-guard-env-dropped | guard `mergeLoggerFor(undefined, injected)` | KILLED (3) |
| M-F2A-guard-logger-never | guard logger `null` | KILLED (11) |
| M-F2A-env-only-injected | `mergeLoggerFor(undefined, undefined)` | KILLED (11) |
| N-names-wording | runbook drops the running-chain clause | KILLED (1) |
One invalid first attempt of N-names-wording (tree lacked the BE03c spec and two runbook files: 3 baseline ENOENT failures) was
discarded; the tree was completed, the baseline shown 8/8, and the mutant re-run. F4 has no assertion (titles only); its evidence is
the NaN-title count 86 -> 0.

## Runs
| time (UTC) | what | result |
|---|---|---|
| 12:2xZ | baseline focused (18 pattern-update files, verbose) | 18 files, 552/552 passed |
| 12:21Z | failure test after F1/F2 edit | 1 file, 128/128 |
| 12:2xZ | rpc test after F3 | 17/17 |
| 12:25Z | dispatcher telemetry test after m-f2a | 15/15 |
| 12:3xZ | focused after all edits (verbose, `after-verbose.txt`) | 18 files, 556/556 (552 + 4 new rpc tests), 0 NaN titles |
| 12:27Z | worker `tsc --noEmit` (`tsc.out`) | exit 2: 4 errors, ALL in `cms-composition/governed-activation-superseded.test.ts` and `governed-review-reads-schedule.test.ts` (DEC-191 phase-2 lane in flux); 0 in touched files |
| 12:27:36-12:38:25Z | full `apps/worker` Vitest, run 1 (`worker-full-run1.json`, SHA-256 `3e653e78…c662`) | 672 files, 11,951 tests, 11,948 passed, 3 failed, all in `cms-composition-production-template-errors.test.ts`, a hardening-5 file that was rewritten at 12:31:04Z DURING the run; re-run alone at 12:38Z: 10/10 |
| 12:38:46-12:56:45Z | full `apps/worker` Vitest, run 2 (`worker-full.json`, SHA-256 `b134ccff…c467d`; host load average ~18) | 673 files, 11,972 tests, 11,971 passed, 1 failed: `content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts` "504 DEPENDENCY_UNAVAILABLE is produced by an exceeded deadline" (a wall-clock deadline test, not a lane file); re-run alone at 12:58Z: 52/52. Zero failures in any touched or pattern-update file in either run. |
| 12:58Z | worker `tsc --noEmit` re-run (after the DEC-191 lane fixed its tests) | exit 0 |
| 12:2xZ | eslint `--max-warnings=0` on the 12 code files | exit 0 |
| 12:2xZ | prettier `--check` on the 12 code files + runbook | clean |

## Test corrections
None to assertions' meaning. Strengthenings only (exact `details` equality, a richer starting DETAIL), plus title text. No oracle weakened; no
test removed or skipped. `it.each` parameter lists and callback bodies are unchanged except the F1/F2 assertions.

## Spec citations
BE03c per-lane reports unchanged: CMS-03C-15 error matrix and "typed refusals" (the pointer allowlist and version-pair-only 409), CMS-03C-13/14
registry deadlines 8,000 ms and CMS-03C-15 15,000 ms (`pattern-update-operations.ts:38-56`), BE03c "Merge convergence Job disposition",
BE00 550 jitter (unchanged), SQL `20261014120400:180-182` and `120810:106-122` (merge converges its own term; the fenced handler drains
party-wide) as cited by `review-worker-taxonomy-terms-f2.md` n-f2a.

## Open items / BOUNDARY
1. F5 NOT done (decision, not a BOUNDARY). `createPatternUpdateContextVerifier` (`cms-composition-production-pattern-update-rpc.ts:60-112`) is one of
   THREE near-copies of the same fresh-context verifier: `cms-composition-production-pattern-definition.ts:69-112` and
   `cms-composition-production-governed-review.ts` (grep `validHumanSession(refreshed.value) !== null`). A shared helper is only worth having if all
   three adopt it (otherwise a fourth variant is added). That requires editing `pattern-definition.ts` (outside this brief's file claim) and
   `governed-review.ts` (DEC-191 phase 2 lane is editing the governed-review files now). The brief allows extraction only as a pure refactor
   with every test unchanged, which cannot be demonstrated while another lane rewrites one of the three copies. The copies also differ in
   the comparison order and in the capability predicate (`cms.author|cms.editor` vs `cms.template_designer` vs governed review's `any_of` owner capability), so the
   helper needs a predicate parameter; all would reference the same `failure` and result types (verified `pattern-instance-contracts`).
   Recommendation: one root-assigned refactor lane after DEC-191 phase 2 lands: `createFreshContextVerifier({contexts, resolveSession,
   configuration, hasCapability})` in a new file, three adopters, all existing context tests unchanged.
2. The `lane-worker-pattern-updates-report.md` citation drift (F6: "BE03c 1266-1268" etc.) is not in this brief; unchanged.
3. Worker `tsc` was red at 12:27Z only because of the DEC-191 phase-2 governed tests listed in `## Runs`; at 12:58Z it exits 0.
4. The wall-clock deadline test in `phase-02-slice-09-r2-admission-dependency.test.ts` is load-sensitive (failed once at host load ~18, passes alone); the canonical gate should run on a quiet host.

## Requests to root
1. Schedule the F5 shared-verifier refactor (Open item 1) after DEC-191 phase 2, or accept the three copies.
2. None for tsc (now clean). Run the canonical Worker gate on a quiet host (Open item 4).
