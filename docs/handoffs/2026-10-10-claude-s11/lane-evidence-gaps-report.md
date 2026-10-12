# Lane evidence-gaps report (2026-10-12)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD `9cf4b7a9` plus this lane's uncommitted files.
I ran no `git add/commit/stash/checkout/reset/restore`. Logs: `lane-evidence-gaps-logs/` (index at the end). The primary checkout was not touched.
Every production file I mutated for a mutation check (`internal-rpc.ts`, `api-error.ts`, `cms-editorial-production-types.ts`) was restored from a copy and its SHA-256 and an empty `git diff` were checked afterwards.

## Result in one table

| Item | Criterion                     | Outcome                                                                                                                               |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | P2-S11-AC-079                 | 5 contract tests, mutation-proven. Ledger: partial -> verified.                                                                       |
| 2    | P2-S11-AC-052 / 058 / 064 p95 | New composed apispec (6 tests), 3 exclusive-lock runs, every p95 under its target by more than 20x. Ledger: partial -> verified (x3). |
| 3    | P2-S10-AC-089                 | 14 tests in 3 files (contract, route, production composition), mutation-proven. Ledger: partial -> verified.                          |
| 4    | gate hardening                | `statement_timeout = '120s'` added to 2 pgTAP files (the S09 bench and the S11 recheck cap); proven by a 1 ms mutant that fails fast. |
| 5    | ledgers                       | Only the 5 named entries changed. The two guards now report only receipt-class problems (below).                                      |

## Files

New:

- `packages/contracts/src/cms-editorial/schedule-execution-outcomes.test.ts` (item 1)
- `packages/contracts/src/cms-editorial/conflict-detail-side-bound.test.ts` (item 3)
- `apps/worker/src/cms-editorial/conflict-detail-side-bound.test.ts` (item 3)
- `apps/worker/src/cms-editorial-production-conflict-detail-bound.test.ts` (item 3)
- `tests/postgrest/phase-02-slice-11-read-latency.apispec.ts` (item 2)
- `tests/postgrest/support/phase-02-slice-11-latency-world.ts`, `-latency-type.ts`, `-latency-rows.ts`, `-latency-stats.ts` (item 2 support)
- `docs/handoffs/2026-10-10-claude-s11/lane-evidence-gaps-report.md` and `lane-evidence-gaps-logs/` (runners, logs)

Changed (minimal):

- `supabase/tests/phase_02_slice_09_evidence_bench128.sql` (+6 lines: one `set local statement_timeout = '120s'` and its comment)
- `supabase/tests/phase_02_slice_11_recheck_cap.sql` (+6 lines, same)
- `tests/contracts/phase-02-slice-11-evidence-ledger-067-100.ts` (AC-079 only)
- `tests/contracts/phase-02-slice-11-evidence-ledger-035-066.ts` (AC-052, AC-058, AC-064 only)
- `tests/contracts/phase-02-slice-10-evidence-ledger-071-105.ts` (AC-089 only)

No assertion, budget or existing title was changed anywhere. Old -> new titles: none.

## Item 1: P2-S11-AC-079 (DEC-177)

File: `schedule-execution-outcomes.test.ts`, describe `[P2-S11-AC-079] ScheduleExecutionResult outcomes (CMS-03B-20, DEC-177)`. New titles:

1. `parses each of exactly five outcomes: completed, blocked, failed_retryable, cancelled and already_completed`
2. `declares exactly those five outcome members in the schema the Worker and the database share` (reads the closed set through `z.toJSONSchema`, a public API, not Zod internals)
3. `refuses every other outcome, including the schedule states that are not execution outcomes` (24 invented, near-miss and state names plus non-strings, probed with the reasonless evidence-free shape so only the outcome list can refuse them)
4. `accepts cancelled only with the reason entry_unavailable` (every other reason of `ScheduleReasonCodeSchema`, null, undefined, empty, made-up and wrong-case refused)
5. `keeps entry_unavailable out of every other outcome and publication evidence out of cancelled`

No RED phase applies (the schema already holds the behaviour); the proof is mutation (`lane-evidence-gaps-logs/ac079-*.log`):

- remove `'cancelled'` from the enum: tests 1, 2, 4 fail (`expected [ Array(4) ] to deeply equal [ Array(5) ]`)
- cancelled accepted with any reason: test 4 fails (`cancelled with approval_invalidated: expected true to be false`)
- add a sixth outcome `queued`: tests 2 and 3 fail (`... outcome "queued": expected true to be false`)
- unmutated: 5 of 5 pass.

Ledger: the uncited clause `(completed, blocked, failed_retryable, cancelled with reason entry_unavailable, or already_completed)` now cites the five tests, the existing `types the execution result with the closed outcome and reason coupling`, and the pgTAP `an executing schedule whose entry was archived after the claim is answered cancelled entry_unavailable ... [P2-S11-AC-083]` (the database emits it). Status partial -> verified, limitation empty.
Spec lines: tracker AC-079 text as amended by DEC-177; BE03b CMS-03B-20 line 1898.

## Item 2: composed p95 for CMS-03B-15 / -16 / -17

`tests/postgrest/phase-02-slice-11-read-latency.apispec.ts` drives the production Worker routes (production RPC adapter, in-process accessibility checker, strict resource revalidation, digest ETag) through Kong and PostgREST to the newest SQL, using the existing `createS11Stack`. Only the verified session and the rate limiter are supplied, as in every Slice 11 apispec, so session verification and the rate-limit store round trip of production are not in these figures.
Each read: 3 discarded warm-up requests, then 30 timed requests one at a time (so every p95 is over 30 >= 20 samples), p95 by the `percentile_cont` estimator of the SQL benches. Only the request is inside the timed region; each answer is shape-checked outside it, so an error path or an empty page cannot pass quickly.
Titles (describe `Slice 11 read latency through the real stack`):

1. `[CMS-03B-15] on a 128-field draft with the full preparation and 17-result preflight: p95 under the Tier 2 target of 1,200 ms [P2-S11-AC-052]`
2. `[CMS-03B-15] on an entry at 16 schedules, 64 publications and an open review: p95 under the Tier 2 target of 1,200 ms [P2-S11-AC-052]`
3. `[CMS-03B-16] at 7 of 8 decisions, 32 assignment summaries and a 128-field frozen manifest: p95 under the Tier 1 target of 750 ms [P2-S11-AC-058]`
4. `[CMS-03B-17] first page at the maximum limit of 50 from 200 assigned reviews among 500: p95 under the Tier 1 target of 750 ms [P2-S11-AC-064]`
5. `[CMS-03B-17] cursor page at the maximum limit of 50: p95 under the Tier 1 target of 750 ms [P2-S11-AC-064]`
6. `every request of the five measured reads, warm-ups included, completed within the exact 8,000 ms read deadline [P2-S11-AC-052]`

The world (`support/phase-02-slice-11-latency-*.ts`) is the TypeScript twin of `reads_bench128/010-fixtures.sqlinc`, committed under the shared owner's organization with fresh people: a 128-field type created by the real CMS-03A-01 route and activated with the real editorial policy member (same terminal state as the SQL bench and `cms-editorial-world.ts`); four 128-value draft entries; the open reviews submitted and assigned through the production routes (so each carries the real manifest); then row images for the bounded populations (20 schedules and 70 publication rows on the bounds entry, of which 16 and 64 are served; a detail review with 8 required / 7 recorded decisions, 16 active and 20 revoked assignments; 500 invalidated review clones, 200 assigned to the queue reviewer) and one `ANALYZE`. The tests assert the shapes first: 17 preflight results with a live (not `unavailable`) accessibility category and both `cms_load_quality_gate_input` and `cms_get_entry_workflow` issued; 16 schedules / 64 publications / the open review; 32 assignment summaries / 7 decisions; a 50-item page with a cursor, and a 50-item cursor page. The pgTAP fixtures could not be reused literally: they forge the owner receipt, of which the real database has exactly one.

Measurement: `lane-evidence-gaps-logs/api-latency-exclusive.sh` holds `/tmp/wejammin-quiet.lock` EXCLUSIVELY, then the CI lock, and per run does `supabase db reset` -> wait for a one-minute load under 1.5 -> the spec, so each run is a freshly built world on a fresh database. 3 runs, HEAD `9cf4b7a9` + this lane, node 22.23.1, pnpm 11.24.0. p95 ms (max in brackets), raw samples in `latency-exclusive/samples-run{1,2,3}.jsonl`:

| Read                                               | target | run 1       | run 2       | run 3       |
| -------------------------------------------------- | ------ | ----------- | ----------- | ----------- |
| CMS-03B-15 128-field draft + preparation           | 1,200  | 52.1 (54.0) | 54.4 (64.6) | 54.1 (56.5) |
| CMS-03B-15 16 schedules / 64 publications / review | 1,200  | 41.2 (45.3) | 42.2 (46.4) | 40.3 (40.6) |
| CMS-03B-16 review detail                           | 750    | 11.3 (13.2) | 11.9 (12.0) | 10.5 (11.5) |
| CMS-03B-17 first page, limit 50                    | 750    | 12.7 (13.5) | 11.3 (11.5) | 12.2 (12.3) |
| CMS-03B-17 cursor page, limit 50                   | 750    | 11.6 (12.4) | 11.7 (12.0) | 11.6 (11.8) |

First (warm-up) request of the draft read: 87, 86, 59 ms. Slowest warm-up or sample of any read: 87 ms against the 8,000 ms deadline. Load (one-minute average) when each spec started: 1.47, 1.43, 1.47; at its end: 1.49, 1.39, 1.59. The host never got below about 1.4 in this session (desktop applications I cannot stop), so the "under 1.5" gate was met only narrowly and the last run drifted to 1.59 near its end; no lane process ran during the runs (exclusive lock). The margin (22x to 60x) is far larger than that noise. Vitest: 6 of 6 pass in each run.
The target was not loosened. Mutation proof that the p95 assertions are live (`latency-mutation-tight-targets.*`): with the targets set to 40 ms / 9 ms the five p95 tests fail (`expected 52.28 to be less than 40`, `expected 11.90 to be less than 9`, ...) and the deadline test passes; the constants were restored.
Neighbour check (`api-coupling-check.sh`, logs `coupling-*.log`): after the latency spec on one database, `worker-round-trip`, `phase-02-slice-11-world-isolation`, `read-queue` and `read-workflow` apispecs pass (14 of 14), so the extra type and people disturb neither the registry page nor the creatable-types bound (the latency type is activated without a compiled artifact, so it is not a creatable type).

Ledger: AC-052, AC-058, AC-064 p95 clauses now cite the two/one/two composed tests, the SQL bench p95 assertions and the plan-stability guard (`phase_02_slice_11_reads_plan_stability.sql`: the stale-statistics p95 per read, the tuple-bounded queue tests and the "page of 50 within the statement timeout" tests); the 8,000 ms clauses additionally cite the composed deadline test and the guard's deadline test. Status partial -> verified, limitations empty. The text inconsistency (the 2,000 ms checker budget "inside" a 1,200 ms p95) is unchanged: that budget stays cited under its own clause, and the measured Worker route p95 includes the checker run.

## Item 3: P2-S10-AC-089, out-of-bound preimage side

The declared error (BE03b CMS-03B-12 `paths / preimages` row, line 284, and the tracker text) is a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure, never serving the side; it is a response bound, because the read has no request member that carries a preimage. The ledger limitation said the contract had no size member; it has one: `JsonValueSchema` caps every value at `JSON_VALUE_MAX_BYTES = 262,144` serialized UTF-8 bytes, so `ConflictDetailSideSchema` refuses a larger side, the route turns that into 502, and the production adapter additionally reads under BE00's 256 KiB response ceiling. Three layers, three files; no production change was needed. New titles:

- `conflict-detail-side-bound.test.ts` (contracts), describe `[P2-S10-AC-089] CMS-03B-12 conflict detail preimage side bound`: `accepts a side whose serialized value is exactly 256 KiB and refuses one byte more`; `refuses a resource whose {base,theirs,yours} side is over 256 KiB and serves the same resource at the bound` (3); `counts serialized UTF-8 bytes, not characters, and covers a nested object value`.
- `apps/worker/src/cms-editorial/conflict-detail-side-bound.test.ts`, describe `CMS-03B-12 conflict-detail route [P2-S10-AC-089] preimage side bound`: `answers a {base,theirs,yours} side over 256 KiB as 502 DEPENDENCY_UNAVAILABLE without serving it` (3: fixed envelope under 2 KiB, no refused bytes in the body, no ETag, `x-cms-editorial-retryable: false`); `serves the same answer when its {base,theirs,yours} side is exactly 256 KiB (control)` (3).
- `apps/worker/src/cms-editorial-production-conflict-detail-bound.test.ts` (whole route composition over the production adapter, only the PostgREST edge faked), describe `CMS-03B-12 production conflict-detail read [P2-S10-AC-089] over-bound preimage side`: `refuses a side of 256 KiB plus one byte (declared length) as 502 DEPENDENCY_UNAVAILABLE and serves nothing of it`; the same `(streamed without a declared length)`; `serves an answer of exactly 256 KiB and refuses the same answer one byte longer`.

Mutation proof (`ac089-*.log`): `JSON_VALUE_MAX_BYTES` 262,145 or 1 MiB: all 5 contract tests fail; adapter ceiling raised to 1 MiB: only the ceiling-pair test fails (the contract still refuses the side); contract bound raised: the 3 route tests fail (adapter still refuses); both raised: 6 fail. Unmutated: 14 of 14 pass.
Ledger: clause `or a side over 256 KiB)` cites the contract, route and production tests; the 502 clause also cites the route and production tests. Status partial -> verified.
Observation, not changed: because the whole response is capped at 256 KiB, the largest side a read can actually serve is the ceiling minus the envelope (about 1.5 KiB less than the 256 KiB side bound); the database's own `cms_json_bounded` branch raises `INTERNAL_ERROR` and is not exercised by a test (the stored value cannot exceed the bound through any command).

## Item 4: gate hardening

Added `set local statement_timeout = '120s';` after the fixtures (the same placement and limit as the reads bench) to:

- `supabase/tests/phase_02_slice_09_evidence_bench128.sql` (the loop is one statement of 25 definitions x 6 commands; measured healthy time: a few seconds, per-op p95 under 40 ms)
- `supabase/tests/phase_02_slice_11_recheck_cap.sql` (records timings, 501-review world; a healthy 500-review walk takes 1.5 to 1.8 s)

Not touched, with reason: `reads_bench128.sql` and `reads_plan_stability.sql` already have it; no other pgTAP file times anything or asserts a duration (the others that matched my search are correctness or bound tests whose "deadline" and "elapsed" words are in titles only, e.g. `phase_02_slice_10_locale_fanout_regression.sql`). Proof (`timeouts-green1.out`, `timeouts-mutation-1ms.out`): both files pass with 120 s (40 of 40); temporary copies with `1ms` (deleted afterwards) end in `canceling statement due to statement timeout` and fail the file in 5 s instead of hanging.

## Item 5: ledgers and guards

Only the entries named in the brief changed (text byte-identical, clause texts untouched; prettier clean). `flock -s /tmp/wejammin-quiet.lock pnpm exec vitest run tests/contracts/phase-02-slice-10-evidence-guard.test.ts tests/contracts/phase-02-slice-11-evidence-guard.test.ts` (`evidence-guards.log`): 7 of 10 pass; the 3 failures are the receipt tests: Slice 10 has 430 problems, Slice 11 has 2,270, and `evidence-guards.problem-classes.txt` shows every one is `stale receipt` (Slice 10: 198 test file changed + 154 pgTAP closure changed) or `no receipt` (78 on Slice 10, 2,270 on Slice 11, whose receipts file does not exist yet). No clause-tiling, status/limitation, citation-shape, duplicate or sole-proof problem. All 56 vitest/pgTAP citations I added or touched were checked against the real collected titles (vitest JSON run plus `vitest list` for the apispec, whitespace-collapsed literals for pgTAP): 0 mismatches.
Counts now: Slice 11 = 118 verified, 2 partial (AC-071, AC-106), 2 unverified (AC-044, AC-045), of 122; Slice 10 = 102 verified, 3 partial (AC-056, AC-060, AC-080) of 105.
The orchestrator must regenerate the receipts (`node scripts/evidence/run-slice-evidence.mjs --slice 10` and `--slice 11`), which will run the new files; they are expected to pass (every new test passed in this lane).

## Open / for the orchestrator

- BE03b `ScheduleExecutionResult` (lines 1505-1512, 1844, 1867, 2073 and the DEC-158 note at 2263) still lists four outcomes; DEC-177 amended the tracker and ledger, not that spec file. Not mine to edit.
- Not edited because outside my assignment: `tests/postgrest/README.md` (suite table does not list the new latency suite) and the `supabase/tests` READMEs (the two files that gained a timeout). Suggested one-liners: latency suite = "CMS-03B-15/16/17 p95 through the Worker, Kong and PostgREST over the bounded world; quiet host only".
- The latency suite commits a lot of fixtures (about 500 reviews and 240 assignments per run, in its own people's scopes) and one extra active 128-field type; a rerun without a reset builds another world (the type is reused). It must run after `pnpm db:reset`, like every apispec; the neighbour check passed after it.
- `vitest list --json <path>` treats the first path as the OUTPUT file: I overwrote `schedule-execution-outcomes.test.ts` with listing JSON once, noticed it at the next run ("No test suite found") and rewrote it from the reviewed content; mutation logs for it were re-run on the rewritten file and the final guard/lint/tsc runs include it.

## Logs (`docs/handoffs/2026-10-10-claude-s11/lane-evidence-gaps-logs/`)

`ac079-*.log` (AC-079 green + 3 mutations); `ac089-contract-*.log`, `ac089-worker-*.log` (AC-089 green + mutations); `timeouts-green1.out`, `timeouts-mutation-1ms.out`; `latency-exclusive/` (`runs.txt`, `samples-run{1,2,3}.jsonl`, `vitest-run{1,2,3}.log`, `reset-run{1,2,3}.log`), `api-latency-exclusive.sh`; `latency-dev{1..4}.*` (development runs; dev1/2 show the two world-building defects I fixed: a snapshot-time check and the missing settings snapshot); `latency-mutation-tight-targets.*`; `api-coupling-check.sh`, `coupling-*.log`; `evidence-guards.log`, `evidence-guards.problem-classes.txt`.
