# Native placement response ceiling — bounded lane receipt

Date: 2026-10-13. Lane: `native_s12_placement_ceiling`.
Model/effort: `gpt-6-astra` / `ultra`.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Primary `/home/rob/Projects/WeJammin` remained read-only.

## Result and scope

The existing outgoing 1 MiB guard is mutation-sensitive and restored exactly.
The production RPC error reader now retains the ordinary 256 KiB ceiling,
including when a higher success limit is configured, and preserves tighter
configured limits. Nine focused Worker suites passed, 118 tests total.
TypeScript, scoped ESLint, formatting and scoped `git diff --check` passed.
Independent native review returned CLEAR through root, with no blocking finding.

No DB, migration, race, service, network, Web, public-contract, spec, tracking,
package/config, staging, commit or push action was performed by this lane.
No acceptance criterion, depth ratio or completion signature is closed here.
Full canonical validation remains with root; it was not run by this lane.

## Source and implementation evidence

- Normative scope: `.memory/wiki/decisions.md:5250-5261` (DEC-189),
  `.memory/wiki/specs/be/00-infrastructure.md:488`, and
  `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:160,1487,1632`.
  Exception carries the successful 1–512-row placement body; request and error
  limits remain ordinary. No truncation or public-schema change is allowed.
- `apps/worker/src/cms-composition-production-pattern.ts:177-182` now passes
  `Math.min(maxResponseBytes, MAX_DEFAULT_RESPONSE_BYTES)` to `readRpcError`.
  This lane's production delta is the existing constant's import and that
  argument change. Success parsing retains its separate 1 MiB cap at line 206.
- `apps/worker/src/cms-composition/pattern-instance-routes.ts:233-236` retains
  the authored `serializedBytesWithin` check before any successful response.
- `apps/worker/src/cms-composition/pattern-placement.test.ts:173-241` proves
  actual decoded 1 MiB success; 262144-byte RPC errors interpreted normally;
  262145-byte errors discarded under default and oversized configured limits,
  with and without Content-Length; a 128-byte configured error budget preserved.
  A valid VERSION_MISMATCH token on HTTP 500 maps to 409 only when its complete
  body is within budget. Over-budget bodies fall back to safe 503, without value
  or provider message disclosure. This distinguishes bounded parsing from merely
  returning some non-success status.
- `apps/worker/src/cms-composition/pattern-placement-http.test.ts:64-134`
  proves the original approximately 2.2 MiB valid fixture fails closed, exact
  1048576-byte successful output is preserved, 1048577 bytes yields 502 without
  ETag, and requests of 262144/262145 bytes yield 201/400 respectively. The
  over-budget request never calls the mutation port.
- `apps/worker/src/cms-editorial-production-conflict-detail-bound.test.ts:118-170`
  was run unchanged: unrelated CMS-03B-12 still accepts exact 256 KiB and refuses
  one additional byte through real route/production-adapter composition.
- `apps/worker/src/cms-composition/pattern-placement.test-support.ts:63-86`
  identifies the exact-byte placement as a synthetic schema-valid value, not a
  producer maximum. Unbounded fractional-second precision in the existing
  instant schema supplies the padding. Public schemas and cardinality unchanged.

## RED / GREEN provenance

All commands ran with `/bin/bash --noprofile --norc -c` (non-login),
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`, Node `v22.23.1`,
pnpm `11.24.0`, and shared `flock -s /tmp/wejammin-quiet.lock`.
Logs live at `/tmp/wejammin-s12-native-placement-2YgrF6/`.

The original outgoing route SHA-256 was recorded before mutation:
`9ac320fd66327c45734dad7517e35d6f39c284391513e914d171c8753569433f`.
An `apply_patch` removed only lines 233-236, the byte guard. The already-authored
test `refuses a placement whose serialized body exceeds the response budget`
failed with expected 502 / actual 201. A second `apply_patch` restored those
exact four lines; the SHA-256 equalled the recorded original before GREEN.
The same test then passed. No test was changed between that RED and GREEN.

The error-budget tests were added and executed before the reader fix. Both
declared and undeclared 262145-byte variants failed with actual
409 COMPOSITION_VERSION_CONFLICT versus expected 503 DEPENDENCY_UNAVAILABLE.
The exact 1 MiB success and tighter-budget controls passed in that RED run.
Only the reader argument/import then changed; all four selected tests passed.

The workspace was already dirty, and placement tests/support were untracked.
Their original contents were inspected before additive `apply_patch` edits;
this lane did not capture their pre-edit hashes. Therefore this receipt does
not claim hash-based proof of a wholly untouched original test baseline.
The guard mutation has exact before/after restoration provenance; the error
test's RED-before-production-fix and unchanged-test GREEN have separate logs.

| Log | Result | SHA-256 |
| --- | --- | --- |
| `guard-red.log` | exit 1; 1 assertion failed, 12 filtered | `3def92350abeb176b3e3c52bd3a536bd63db80ae94428747983cba9f1ac775e4` |
| `guard-green.log` | exit 0; 1 passed, 12 filtered | `afdce3977f09fbd05b751ab02df2c267d8a05e7ecf1509d5f0e521d096a117e7` |
| `error-budget-red.log` | exit 1; 2 failed, 2 passed, 14 filtered | `c598db3bb979ae9de103ecb35a82c8c8596ea5837df8d98de9ff25ac5aba7f25` |
| `error-budget-green.log` | exit 0; 4 passed, 14 filtered | `452846723c2f8c5c1cb71b5d8c732f4a6a5d808557ea1004d81e0c357933dc15` |
| `neighbor-complete-green.log` | exit 0; 9 files, 118 passed | `a1b655481e5ff207b9c9706d38ba024e97a9fb79d03a64537b376df67c503110` |
| `lint.log` | exit 0 | `9cc780e5974c4d620fa9eee8dcf5e92ab40a2cd2343a72639b9cfacff389a3da` |
| `types.log` | exit 0 | `4caf7912fc3f4693de4851d4fc06a32a7f5fe2f83d9a5cee4062b7ee7bd44176` |
| `format.log` | exit 0 | `43bb84acce97eed4060548f7352dcf8eac57424459ca5582c6225b4537bf5807` |

The intermediate `neighbor-green.log` executed eight files/76 tests because one
requested historical neighbor pathname did not exist; Vitest ignored it. The
correct path was resolved and the complete nine-file/118-test run above
supersedes that intermediate receipt. No nonexistent suite is counted.

## Reproduction commands

Run from the stated worktree with the pinned PATH. Every command below was
prefixed with `node --version && pnpm --version &&` and the shared quiet lock.

```sh
flock -s /tmp/wejammin-quiet.lock pnpm exec vitest run apps/worker/src/cms-composition/pattern-placement-http.test.ts -t "refuses a placement whose serialized body exceeds the response budget"
flock -s /tmp/wejammin-quiet.lock pnpm exec vitest run apps/worker/src/cms-composition/pattern-placement.test.ts -t "caps RPC errors|tighter configured RPC error|exactly 1 MiB"
flock -s /tmp/wejammin-quiet.lock pnpm exec vitest run apps/worker/src/cms-composition/pattern-placement.test.ts apps/worker/src/cms-composition/pattern-placement-http.test.ts apps/worker/src/cms-composition/pattern-instance-routes.test.ts apps/worker/src/cms-composition/pattern-instance-contracts.test.ts apps/worker/src/cms-composition/pattern-instance-boundary.test.ts apps/worker/src/cms-composition-production-pattern.test.ts apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts apps/worker/src/production-worker-runtime-cms-composition.test.ts apps/worker/src/cms-editorial-production-conflict-detail-bound.test.ts
flock -s /tmp/wejammin-quiet.lock pnpm exec eslint --max-warnings=0 apps/worker/src/cms-composition-production-pattern.ts apps/worker/src/cms-composition/pattern-placement.test.ts apps/worker/src/cms-composition/pattern-placement-http.test.ts apps/worker/src/cms-composition/pattern-placement.test-support.ts
flock -s /tmp/wejammin-quiet.lock pnpm type-check
flock -s /tmp/wejammin-quiet.lock pnpm exec prettier --check apps/worker/src/cms-composition-production-pattern.ts apps/worker/src/cms-composition/pattern-placement.test.ts apps/worker/src/cms-composition/pattern-placement-http.test.ts apps/worker/src/cms-composition/pattern-placement.test-support.ts
```

Owned touched code sizes, newline counts: production reader 257; placement
adapter tests 298; placement HTTP tests 270; placement support 257. The restored
route remains 291. All authored code files stay below the lane's 300-line cap.

Final code SHA-256:

| File under `apps/worker/src/` | SHA-256 |
| --- | --- |
| `cms-composition-production-pattern.ts` | `c9c43fe064a5076ee3bcdeb8d9f123f110e93d802fc5e19e6c24deffd95dc030` |
| `cms-composition/pattern-placement.test.ts` | `15194727720afaa82dcfb0ba524d4ce282fe70fe64c8e1eae35f1e99b8059e5e` |
| `cms-composition/pattern-placement-http.test.ts` | `bbd02feaad254192401c0595b4d23979c5fefd750c0cf09ec93c91b3ffd07979` |
| `cms-composition/pattern-placement.test-support.ts` | `c3b666c8f1c54ad9b3a87bbb828bff9f9d8c932378854c536fe72f8bd17d554c` |

## Independent review and remaining gates

Root relayed native review CLEAR: success cap at most 1 MiB; error cap is the
minimum of 256 KiB and a tighter option; shared request admission unchanged;
exact HTTP boundary controls and synthetic-fixture limitation are explicit.
Review noted the dirty/untracked baseline; provenance limits are recorded above.

The actual SQL/PostgREST placement producer does not yet establish a maximum
serialized response. The synthetic instant fixture and normalized 512-row
fixture are not proof of maximum legal producer output. Maximum-path, maximum
field-bound success, over-budget producer refusal, atomic no-partial-effects,
slot/revision lock sequencing and real producer ETag evidence remain OPEN.
The outgoing Worker guard alone cannot establish transaction rollback after a
producer has committed. No DB or cross-surface acceptance is inferred.

Next action belongs to root: integrate this bounded repair and retain the
actual-producer and DB-first canonical gates before any Slice 12 sign-off.
