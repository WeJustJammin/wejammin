# Lane governed-fix4 report (claude_s12_governed_fix4)

Staged-runner lane `governed-fix4`, Sonnet 5.5. Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch
`claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. Timestamp range 20261014150000-159999 (used 150000).

## Status

**GREEN.** All four root rulings implemented. SQL: governed activation 92/92, governed schedule 56/56, retry ladder 24/24 (172/172) with the
one WIP migration staged. Worker: focused 31 files 910/910, full `apps/worker` 628 files 10,875/10,875, tsc 0, eslint clean, prettier clean.
No applied migration, shared helper, other lane's file, trigger, clock, or grant was touched.

## Scope (brief `briefs/governed-fix4.md`, review-governed-worker-p3 findings 1-4)

1. CMS-03C-09's committed invalidation answers `dependency_changed` for BOTH invalidation verdicts (BE03c 1262 row 09 lists no
   `review_not_open`; 1326 step 4). The review row still records the real reason (`reviewer_authority_changed` for a dead approval).
   Worker: `COMMITTED_ONLY` removed; a committed `review_not_open` envelope on 09 is a local 502.
2. SQL `resolved_utc_mismatch` carries the contract's `expectedUtc` DETAIL; the Worker maps it.
3. The 09 route emits `cms_governed_activation_total{subject_kind,action,outcome}`; the sweep's `action` label conforms.
4. The `retire` success binding on review version = expected + 1 is removed (BE03c 215); retire stays forwarded unchanged.

## Decisions (implementation tier, mine; root may override)

1. SQL `expectedUtc`: the database owns no tz rules (BE03b 1849: it re-checks only that local - resolved lies in -12 h .. +14 h), so the
   member is the instant nearest the supplied `resolvedUtc` that passes that same window: `local - clamp(local - resolved, -12h, +14h)`, as
   `auth_iso_time` (millisecond ISO, `Z`). It is NOT the tz-rules instant (only the Worker's pinned Time authority knows that, BE03b 1846
   step 7), and is reachable only if the Worker's exact check is bypassed (real offsets lie inside the window). Fail-closed shape is
   preserved: a bare `resolved_utc_mismatch` without DETAIL is still a 502 in the Worker (token-table row kept).
2. Metric `outcome` for the route = `metricOutcome(status)` (`cms-editorial/route-telemetry.ts`), the closed vocabulary that file declares
   "shared by every `outcome` metric label": success, rate_limited, denied, conflict, invalid, failed. `subject_kind` is known only from a
   verified success resource; every other outcome is labelled `unknown`. A request refused before the body is decoded (origin, media,
   session, bytes) has no known action and is not counted.
3. Sweep `action` = `activate`: BE03c "Scheduled activation (OD-6)" says the execute "performs the `activate` switch". The sweep's
   `outcome` values stay its closed result enum (`completed`, `already_completed`, `blocked`, `failed_retryable`) plus `error`; they differ
   from the route's vocabulary by emitter (see Request 1).
4. The anchored patch is one migration with two exactly-once anchors, each independently skippable (idempotent) and the
   `pg_proc` non-body attributes compared before/after (precedent `20261014080000`).

## Files

### Migration (WIP, promote with the lane)
| path | lines | SHA-256 |
|---|--:|---|
| `supabase/migrations-wip/governed-fix4/20261014150000_cms_governed_activation_refusal_alignment.sql` | 80 | `62062e7b058dfa4e6151e1b300ce1f844b6e7841275df57453ac776e6eddd706` |

### pgTAP (corrections and additions)
| path | lines | SHA-256 |
|---|--:|---|
| `supabase/tests/phase_02_slice_12_governed_activation.sql` (plan 90 -> 92) | 41 | `c9994b0b49e6c3f2d6ef72bc129f51cb126f44334f9137388b735daaef4f617c` |
| `supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc` | 125 | `5ae9cc4f0442139a7c8bd8a347911c92aa7c8a49a8221170a7c93212ba3c8160` |
| `supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc` | 117 | `4d15bf5df717bbb6c98693932d27c5b108bfb02fbdcc6cb57e19548f8c9d8590` |
| `supabase/tests/phase_02_slice_12_governed_schedule/055-fire-approval.sqlinc` | 46 | `57fc817b0cd77b8fed7c821a2483c0d650258aafa8781b7f5223ecd5dc8f5b53` |
| `supabase/tests/phase_02_slice_12_governed_activation/README.md` (plan note) | 23 | `fa97a5e483b6c260d2249aea5c37701d5cffcda9213a570d3f2ec6f066b2f885` |

### Worker (under `apps/worker/src/`)
| path | lines | SHA-256 |
|---|--:|---|
| `cms-composition/governed-review-errors.ts` | 197 | `1bb5c9098c77834f74f99042a6624fe83118e0f37cab79eb2636ab9d8e10dbe6` |
| `cms-composition/governed-review-validate.ts` | 153 | `67ae9346e683c90f52b3fcb6c1a6629fbc1656dacad9f963901a5f9cfeb0c08d` |
| `cms-composition/governed-review-ports.ts` | 279 | `44b451e066c6636a3db1422cfbed1988be82873801721419e7793781ea11581d` |
| `cms-composition/governed-review-response.ts` | 125 | `d644817249faf2927eca24b865f7c74067fe859f98989dc52b565b78fdf43a73` |
| `cms-composition/governed-review-command-routes.ts` | 283 | `5dacb468b1590ac277bddf3b806a942c0eda44ee87210a15fe86f228ea00a271` |
| `cms-composition/governed-activation-routes.ts` | 108 | `c2fa40df68eac01dd98a54effed749af879ae85a5b558ce1999f35b722011cbb` |
| `cms-composition-production-governed-review.ts` | 153 | `917ce448fd71aaa53adff3dbee432f6062c3f147f5165c7ab8bec028c0648b28` |
| `cms-composition-production-governed-review-errors.ts` | 147 | `93224340a70f9dde7f67b5f5ab3d727c0ec36413cefdabb825f28a1919478364` |
| `cms-governed-activation-sweep.ts` | 226 | `ca0c1f6654859f1e0accd991572a60c4941cc07aec800f78b5a7435716c4011a` |
| tests: `cms-composition/governed-activation-metrics.test.ts` (new) | 191 | `29845cb08c0d4f5a3ec4393c2e16a933699730dd98884972055a194ddcb24186` |
| tests: `cms-composition/governed-activation-refusals.test.ts` | 131 | `6b6799eb71811cd96a353edeebabf2502b233e4518843d1b6ba9cf8a215392f8` |
| tests: `cms-composition/governed-activation.test.ts` | 283 | `b307e030e2ee6fdbcc6a6156192b9b3d9eb4b08b576e0e215df71a46b0cce17a` |
| tests: `cms-composition/governed-activation-tokens.test-support.ts` | 251 | `acbcebe25a106fe670a1c5d6941dce6f2701bde61ebd54223906dbc7db5e571a` |
| tests: `cms-governed-activation-sweep.test.ts` | 272 | `dd53aa85bf695f0ef1df508dd65f2bcb34684eae086d6c2184d09b23127b7a64` |

All files under the 300-line limit. The new `activation` telemetry fact is a small typed addition (`GovernedActivationFacts`,
`GovernedRouteFacts`) threaded `CommandSpec.activation` -> `runGovernedRoute(…, facts)` -> `GovernedTelemetry.activation` -> the production
`telemetry` hook, which builds the metric key with the shared `metricKey`.

## Runs

| # | stamp | targets (plan) | result | notes | TAP sha256 |
|---|---|---|---|---|---|
| RED-1 | 220814-2729857 | activation 92, schedule 56 (wip=0, no migration) | 3 `not ok` of 148 | activation 55 (`expectedUtc` DETAIL absent: have bare token), 65 (`review_not_open`, want `dependency_changed`); schedule 52 (same). Classification: genuine missing feature / defect, not harness. Edge controls (+14 h / -12 h reach the horizon rule) passed. | `96718c303bae3d538a028569954ead87950afefa925c073d0ee3216ebabf57d4` |
| GREEN-1 | 221213-2754559 | activation 92, schedule 56, ladder 24 (wip=1) | 172/172, 0 not ok | final bytes of every file above | `3a4a1460f47a569f235607a6180de3885c837384c8a975078de7d00d1f09bb89` |

Worker (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`, vitest):
- focused `apps/worker/src/cms-composition/governed- apps/worker/src/cms-governed-activation`: 31 files, 910/910.
- full `apps/worker`: 628 files, 10,875/10,875 (470 s).
- `apps/worker` `tsc --noEmit`: exit 0. eslint on the 14 touched files: clean. prettier --check: clean.

TDD note (honest): the Worker tests were written before the Worker code, but I did not capture a RED vitest run before writing the code.
RED for the Worker is proven afterwards by mutants (each reverts one ruling in place, restored immediately and re-checked):
| mutant | file | killed by |
|---|---|---|
| M1 09 accepts a committed `review_not_open` again | `cms-composition-production-governed-review-errors.ts` | refusals test, 2 failed (activate, schedule rows) |
| M3 retire bound on review version +1 | `governed-review-validate.ts` | `governed-activation.test.ts`, 2 failed |
| M4 no activation metric | `cms-composition-production-governed-review.ts` | metrics test, 8 failed |
| M5 sweep `action="execute"` | `cms-governed-activation-sweep.ts` | sweep test, 3 failed |
| M6 subject kind always `unknown` | `governed-activation-routes.ts` | metrics test, 3 failed |
| M7 outcome always `success` | `cms-composition-production-governed-review.ts` | metrics test, 5 failed |
The `expectedUtc` Worker mapping already existed (token-table row `resolved_utc_mismatch {expectedUtc}`); I added a row with the exact
producer shape (millisecond instant) and kept the bare-token row as the fail-closed case.

## Test corrections (existing oracles that contradict BE03c 1262 / 1326 step 4; the brief said "add cases only", but these assertions
## pin the behavior the ruling reverses and cannot coexist with it)

1. `supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc` (case gr7, test 65): committed envelope
   `{"kind":"refusal","details":{},"reasonCode":"review_not_open"}` -> `"reasonCode":"dependency_changed"`; description reworded. Every other
   assertion of gr7 (review `invalidated`/`reviewer_authority_changed`/version 3, subject draft, status 409 stored, replay) is untouched.
2. `supabase/tests/phase_02_slice_12_governed_schedule/055-fire-approval.sqlinc` (test 52, `eb-again`): same one-token change.
3. `apps/worker/src/cms-composition/governed-activation-refusals.test.ts`: the committed-envelope `it.each` loop over
   `['dependency_changed','review_not_open']` -> `['dependency_changed']`; new tests assert a committed `review_not_open` envelope of activate
   and schedule is 502 DEPENDENCY_UNAVAILABLE (strictly stronger on that point).
4. `apps/worker/src/cms-composition/governed-activation-tokens.test-support.ts`: label of the raised-`review_not_open` row (assertion
   unchanged: still the scrubbed 500); the bare `resolved_utc_mismatch` row relabelled "without its mandatory DETAIL" (assertion unchanged)
   and a producer-shape DETAIL row added.
5. `apps/worker/src/cms-governed-activation-sweep.test.ts`: three metric-key strings `action="execute"` -> `action="activate"`.
6. `apps/worker/src/cms-composition/governed-activation.test.ts`: nothing removed; the retire ETag `"4"` test stays; added tests for
   reviewVersion 3/4/9 retire answers and another-review refusal.
Nothing was weakened; the 07 decision suites keep both committed reasons (BE03c 1262 row 07 lists both).

## Spec citations

- BE03c 1262 (row CMS-03C-09: no `review_not_open`), 1326 step 4 (committed `invalidated` outcome answered 409 `dependency_changed`),
  BE03c Scheduled activation (OD-6) ("performs the `activate` switch"), BE03c Observability 1597 (`cms_governed_activation_total{subject_kind,action,outcome}`),
  BE03c 215 (version-advancing events: decision, invalidation, activation), BE03b 1846 step 7 and 1849 and 1934 (`resolved_utc_mismatch`
  `details.expectedUtc`; the RPC re-checks only the -12 h .. +14 h window), `route-telemetry.ts` `metricOutcome` (shared outcome vocabulary),
  `CmsGovernedTimeRefusalDetailsSchema` (`expectedUtc` mandatory).

## Open items / BOUNDARY

- Migration idempotency (re-apply is a no-op) is by construction (per-anchor skip when the replacement is present, `return` when nothing
  changed) and the precedent migration is untested the same way; it was NOT exercised on a populated database here (only fresh apply, via
  the staged reset). Root's populated-DB migration witness (`migration up` without reset) would exercise it.
- Stored idempotency records in a long-lived database may hold an old `review_not_open` 409 response for CMS-03C-09; replays of those
  would still be served. Phase 2 has no production data (no claim of hosted state is made here).
- The SQL `expectedUtc` is a window-nearest instant, not the tz-rules instant (Decision 1). If root wants a stricter oracle, the SQL cannot
  produce one without a pinned tz database (BE03b 1849): the Worker already owns it.
- BOUNDARY: none new. `retire` remains HELD (owner decision), forwarded unchanged.
- The governed-b / governed-worker reports still describe `review_not_open` for 09 (`## RPC boundary`, Worker Decision 1 / Open 2 /
  Request 2); they are other lanes' files and are now superseded by this report. Web (`cms-governed-review-platform-error-details.ts`)
  already filters by the frozen 09 list and now agrees with the Worker.

## Requests to root

1. Record the metric label values in a DEC or BE03c 1597: `cms_governed_activation_total` `action` ∈ {activate, schedule, retire}; route
   `outcome` = the shared `metricOutcome` vocabulary with `subject_kind="unknown"` when no verified resource exists; the sweep counts a due
   execution as `action="activate"` with its own outcome enum (`completed|already_completed|blocked|failed_retryable|error`). Decide whether
   the sweep outcomes should be folded into the shared vocabulary (a one-file change, `cms-governed-activation-sweep.ts`).
2. Promote `supabase/migrations-wip/governed-fix4/20261014150000_cms_governed_activation_refusal_alignment.sql` into
   `supabase/migrations/` and run the canonical gates (including a populated-DB `migration up` witness for the idempotent branch).
3. Review finding 5 (the tick runner exists twice, 03b and 03c sweeps) and the 06-08 metrics gap are untouched (outside this brief).
