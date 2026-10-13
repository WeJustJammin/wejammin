# Lane last-gaps report (2026-10-12)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD `6dc175fa` plus this lane's uncommitted files.
I ran no `git add/commit/stash/checkout/reset/restore`. Logs: `lane-last-gaps-logs/` (index at the end; `*.log` is git-ignored). The primary checkout was not touched.
Every production file I mutated for a mutation check (four migrations, `use-cms-schedule-time.ts`) was restored from a byte copy and `git diff`/`git status` were empty afterwards.

## Result in one table

| Item | Criterion / file | Outcome |
| ---- | ---------------- | ------- |
| 1 | P2-S11-AC-071 | New pgTAP file, 12 tests, mutation-proven (8 effective mutations). Ledger: partial -> verified. |
| 2 | P2-S11-AC-106 budget clause | New Playwright spec, 2 tests on the production build, mutation-proven. **Finding: the production workflow route loads 144,220 gzip bytes of initial JavaScript against the 92,160 route threshold.** The budget clause stays uncited; entry stays partial with a rewritten limitation (decision for the owner below). |
| 3 | BE03b CMS-03B-20 | Five outcomes in the schema block, a `Result` paragraph and a 2026-10-12 changelog row. |
| 4 | READMEs | Five README files updated or added. |
| 5 | Ledger | Only AC-071 and AC-106 changed. Guard: only receipt-class problems remain (2,284, all "no receipt"). |

## Files

New:

- `supabase/tests/phase_02_slice_11_rpc_review_assign_event_delivery.sql` (238 lines, plan 18 = 6 fixture-fragment assertions + 12 of mine)
- `tests/e2e/phase-02-slice-11-bundle-budget-real-route.spec.ts` (166 lines)
- `tests/e2e/support/s11-approved-entry.ts` (97 lines: the cast and `approvedEntry`; extracted so the spec does not copy the workflow spec's setup)
- `docs/handoffs/2026-10-10-claude-s11/lane-last-gaps-report.md`, `lane-last-gaps-logs/` (README, three mutation scripts, logs)

Changed:

- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (+8 lines)
- `playwright.config.ts` (+1: the new spec in `testIgnore`, as every real-route spec is) and `playwright.s09-real.config.ts` (+1: in `testMatch`). Not in the assignment list but the spec cannot run in the real-route project without them.
- `tests/contracts/phase-02-slice-11-evidence-ledger-067-100.ts` (AC-071 only), `...-101-122.ts` (AC-106 only)
- READMEs: `tests/postgrest/README.md`, `supabase/tests/README.md`, `supabase/tests/phase_02_slice_11_rpc_review/README.md`, `tests/e2e/support/README.md`

No production code, migration, SQL function or test title of an existing test changed. Old -> new titles: none.

## Item 1: P2-S11-AC-071, "retries the review event idempotently"

### What exists and what the spec defines

- BE03b operation coverage CMS-03B-18: "assignment event retries idempotently". BE03b Event schemas: consumers are at-least-once and deduplicated by event identity. BE00: the dispatcher leases an outbox row, sends it and finalizes `dispatched_at` once; a duplicate send stays correct.
- **There is no consumer of `cms.entry.review-changed.v1` in Slice 11 and the relay does not carry it.** `claim_outbox_batch` is a closed allowlist (`20261010164000`) that does not name the family; `platform_private.processed_events` is CHECK-closed to the four base families; the task and notification consumers belong to a later shard. So a consumer-side "one effect from a redelivered event" cannot be tested in Slice 11; the layer the spec leaves is the event the command commits and the outbox row that carries it.
- Existing tests prove a replayed COMMAND adds no second event. They do not prove (a) a lost-response retry with the transport identifiers a real retry carries, (b) that the event row is untouched by a retry after delivery, or (c) what a redelivery does to the row.

### The test

`phase_02_slice_11_rpc_review_assign_event_delivery.sql` creates and revokes one assignment on one open review, each command carrying its own correlation id, so each committed event is found by the command that made it, and then:

New titles (all end `[P2-S11-AC-071]`):

1. `each accepted assignment change commits exactly one identifier-only review-changed event with an identity of its own, though both are aggregated on the unchanged review version`
2. `a retry of the create with the same key, a fresh correlation id and a fresh step-up instant returns the stored response, though the assignment was revoked since`
3. `the retry committed no second event and left both committed events, and every review, assignment, idempotency and audit row, byte-identical: the event keeps the correlation id of the attempt that committed it`
4. `the relay claims neither review-changed event while no consumer is registered for the family: both stay unleased at attempt 0`
5. `a delivery whose lease ended before it completed cannot finalize the event: the late completion is refused and the event stays undispatched`
6. `the redelivery carries the identical event - id, type, schema version, aggregate, aggregate version, correlation, causation, payload and occurrence instant - and moves only the attempt counter`
7. `the redelivery finalizes the event once: the earlier sender cannot complete it while the redelivery holds the lease, and after the redelivery completes it a second completion with either lease is refused`
8. `across the whole delivery the identity of both events and every canonical row are untouched, and the other event of the review was not dispatched with it`
9. `a delivered review-changed event cannot be reopened for another dispatch`
10. `a delivered review-changed event cannot have its payload rewritten by a consumer`
11. `a delivered review-changed event cannot have its aggregate version rewritten, so a consumer deduplicating by identity and ordering by version sees one fixed pair`
12. `a retry of the command after its event was delivered answers the stored response, emits no event and leaves the delivered event and every canonical row as they were`

**Honest limit of the seam.** Because the relay does not claim this family, the lease of delivery attempts 1 and 2 is placed by a direct UPDATE of exactly the three columns `claim_outbox_batch`'s UPDATE sets (token, expiry, attempt count + 1); what runs against the real committed event is the production `complete_outbox_event` and the production `guard_outbox` trigger. Test 4 pins the allowlist, so the day a consumer is registered it fails and this file must be extended with the real claim (m5 below proves it fails). Test 6 can only fail if something rewrites the identity on a re-lease (m8 below); it is the weakest of the twelve.

### RED / GREEN

No RED phase applies: the behaviour already exists, so the proof is mutation. The first three runs failed only on my own test defects (never on production): `concat_ws` renders booleans as `t/f` (`ac071-first-run.log`, 9 failures), and several `complete_outbox_event` calls inside one `AND` are not evaluated in order (`ac071-second-run.log`, test 13). GREEN: `ac071-fourth-run-green.log`, **18 of 18** (`Result: PASS`) after the final edit.

### Mutation proof (each on a throwaway reset of the alt stack; `ac071-mutation-*.log`)

| Mutation (one migration, restored afterwards) | Failing assertions |
| --- | --- |
| m1 `complete_outbox_event` ignores lease expiry | 11 |
| m2 `guard_outbox` allows reopening `dispatched_at` | 15, 18 |
| m3 `guard_outbox` allows rewriting `aggregate_version` | 17 |
| m4 replay path of `cms_assign_editorial_reviewer` emits an event | 9, 14, 18 |
| m5 relay allowlist claims the review-changed family | 10, 11, 12, 13, 14, 18 |
| m6b `cms_request_hash` keeps the whole context (a fresh correlation id is then a mismatch) | 8, 18 |
| m7 `guard_outbox` allows rewriting the payload | 16 |
| m8 `guard_outbox` bumps `occurred_at` on a re-lease | 12, 14 |
| m9 `complete_outbox_event` ignores the lease token | 13 (after strengthening test 7; the first pass was NOT detected, `ac071-mutation-m9-first-pass-NOT-DETECTED.log`, which is why test 7 now makes the earlier sender try while the redelivery's lease is live) |

m6 (first pass) removed `correlationId` from the top-level exclusion list, which is a no-op because the hash already reduces the context to two members; kept as `ac071-mutation-m6-...-NOT-DETECTED-ineffective-mutation.log`, replaced by m6b.

Ledger: the clause `retries the review event idempotently` cites the 12 tests (test 2 is also cited under the lost-response clause). Status partial -> verified, limitation empty.

### Not done, with reason

A race for the same `Idempotency-Key` sent twice at once for CMS-03B-18 (parity with `011` B3 and `012` C2) would be the real-concurrency form of "retry". It needs either a new runner registered in `infra/run-database-race-runners.mjs` (outside my assignment) or about 20 more lines in `010-review-assignment-race.mjs` (385 lines, over the 400-line cap). Suggested check: `A8` on review `race-assign-1` after A1 with `kit.assignRequest(ids, a1, 1, { reviewerPersonId: ids.actors.rvB.person })` called twice with the SAME request object: both code 0, equal responses, `kit.activeAssignments(a1) === 2`, `kit.eventCount(a1) === 2`. I did not run it.

## Item 2: P2-S11-AC-106, the bundle-budget clause

### The test

`phase-02-slice-11-bundle-budget-real-route.spec.ts` (project `real-route-chrome`) signs in as the publisher on an entry approved through the first-party routes (`support/s11-approved-entry.ts`), reads every JavaScript response Chrome loads from the production-built workflow route, gzips each body exactly as `scripts/verify-bundle-budget.mjs` gzips an asset, and compares with `BUNDLE_BUDGETS` **imported** from that script (no number is copied). New titles:

1. `[P2-S11-AC-106] a cold load of the production workflow route fetches no Time authority byte`
2. `[P2-S11-AC-106] opening the schedule form fetches the Time authority chunk once, within the lazy-chunk bundle threshold` (the snapshot chunk exactly once; every script and the sum of everything the open fetched within the lazy-chunk threshold; a second open fetches nothing)

GREEN: `bundle-green-1.log` 2 of 2; `bundle-and-workflow-final.log` 8 of 8 together with the existing `phase-02-slice-11-workflow-real-route.spec.ts` (the new spec sorts first, so it ran before the workflow spec's world). Mutation: P1 lowers the asserted threshold to 20 KiB, test 2 fails (`/_astro/contracts-time-authority.CFlADSoR.js ... Expected: <= 20480 Received: 27225`); P2 imports the Time authority statically, test 1 fails ("no Time authority module is fetched before the form opens") and test 2 is skipped (`bundle-mutation-*.log`).

### Finding: the route itself is over the thresholds (decision needed)

Served bytes, cold load of the production Slice 11 workflow route (`bundle-probe-1.log`, probe run of the same loader): **144,220 gzip bytes of initial JavaScript against the 92,160 initial-route threshold**, and the Time authority chunk that opens later is 27,225 bytes (well inside the 81,920 lazy threshold). The build-output measure (`measureBundleBudget` with the island as entry, `bundle-landscape-static.log`) agrees: route 137,359, island closure 79,484 against 35,840. The cause is shared by every CMS editorial island: `contracts.*.js` (the zod contracts, about 53 KB gzip) and the Astro client (about 56 KB) load eagerly. Same measure for the others: capability console 134,352; entry editor 143,862; entry create 137,610; review detail 135,554; conflict resolve 141,577. Only the Slice 09 registry route meets the thresholds (90,911 against 92,160). `pnpm bundle:check` measures three routes (Infrastructure, platform configuration, registry) and none of these, so it is silent. FE03 says budgets are hard acceptance criteria and a feature over a budget "must split or obtain an originating architecture decision".

Because a test of the route thresholds cannot pass, it is not in the spec (a failing test in a cited file also fails the guard, and `test.fail`/skip would need a tracking issue I cannot open). I read the AC-106 clause as binding the Time authority module (FE03: "lazy-loaded when the form opens, and bounded by the bundle-budget thresholds"), but the earlier lanes read it as the route too, and citing it as verified while the route is 52 KB over would over-claim. So:

- The two tests are cited under the clause `is lazy-loaded when the form opens`.
- The clause `stays within the bundle-budget thresholds` stays uncited; AC-106 stays `partial` (the guard requires an uncited clause for partial); the limitation is rewritten with the measurements and the three owner options: (a) rule that the clause binds the Time authority module alone, then move my two citations under the budget clause and the entry becomes verified (one edit, nothing else needed); (b) split the CMS editorial islands (a real refactor across Slices 9-11); (c) ratify an architecture decision for the CMS editorial budgets.

## Item 3: BE03b

`.memory/wiki/specs/be/03b-editorial-workflow-publication.md`: the `ScheduleExecutionResult` schema block now lists `completed`, `blocked`, `cancelled`, `failed_retryable`, `already_completed` (the implemented order) with comments (cancelled only with `entry_unavailable`; `reasonCode` non-null exactly for blocked and cancelled); a new `Result:` paragraph in Schedule execution (CMS-03B-20) states the five outcomes and their reason and evidence coupling, matching `ScheduleExecutionResultSchema` in `internal-rpc.ts`; changelog row `2026-10-12` records DEC-173 and the owner's DEC-177 and states that it supersedes the DEC-158 sentence "keeps its four outcomes" (that historical row is not edited). The line numbers in the earlier reports were stale: the only enumerations of the four outcomes were the schema block and that DEC-158 row. The four spec readers (`phase-02-slice-09-locked-traceability`, `-pre-traceability`, `phase-02-slice-11-feature-ledger`, `phase-02-slice-10-ev-eb-closeout`) pass, 44 of 44 (`be03b-spec-readers.log`).

## Item 4: READMEs

- `tests/postgrest/README.md`: the read-latency suite, its world and support files, its reset and quiet-host rules.
- `supabase/tests/README.md`: the `statement_timeout` caps of the four timed files (120 s; 60 s in the plan-stability guard, which I checked), what the plan-stability guard asserts, and the new event-delivery file.
- `supabase/tests/phase_02_slice_11_rpc_review/README.md`: the new entrypoint row.
- `tests/e2e/support/README.md`: `s11-approved-entry.ts` and the bundle spec.
- `docs/handoffs/2026-10-10-claude-s11/lane-last-gaps-logs/README.md`: new (the directory holds three tracked scripts).

## Item 5: ledger and guards

`flock -s /tmp/wejammin-quiet.lock pnpm exec vitest run tests/contracts/phase-02-slice-11-evidence-guard.test.ts tests/documentation-boundaries.test.ts` (`guard-and-docs-final.log`): 7 of 10 pass. Guard: 2 failures, **all 2,284 problems are "no receipt"** (the receipts file does not exist yet); no tiling, status, text, shape or duplicate problem. Counts now: Slice 11 = 119 verified, 1 partial (AC-106), 2 unverified (AC-044, AC-045) of 122. Both entries' `text` are byte-identical (the guard compares them to the tracker).

`tests/documentation-boundaries.test.ts` fails in this worktree and **did before my changes** (baseline run in this session): 10 directories under `docs/handoffs/2026-10-10-claude-s11/` hold more than two files without a complete README (16 findings: no README for `lanes`, `lane-reviewB-1-logs`, `lane-evidence-gaps-logs`, its `latency-exclusive`, `lane-e2e-logs`, its `probe` and `lane-a11y-status-logs`; missing sections in `lane-reviewB-2-logs`, `lane-reviewA-2-logs` and `lane-queue-perf-logs`). The test stops at the first one. On a snapshot of tracked plus untracked-unignored files, scanning every directory with the test's own rule, none of the offenders is a path I touched. They are other lanes' directories; I did not edit them.

Also green: eslint on the new and changed TypeScript (`eslint.log`, exit 0); prettier on all changed files; `chrome-only-browser-gate`, `validation-toolchain`, `phase-02-evidence-run-plan`, `phase-02-slice-11-feature-ledger` tests (38 of 38).

## Open

- Owner decision on the route budget (Item 2). Until then AC-106 stays partial.
- The receipts: `node scripts/evidence/run-slice-evidence.mjs --slice 11` must run the new pgTAP file and the two Playwright tests (both passed in this lane).
- The 10 directories above need READMEs (or to be removed from the tracked tree) before `documentation-boundaries` can pass.
- The existing `phase-02-slice-11-workflow-real-route.spec.ts` still carries its own copy of the cast; it can adopt `s11-approved-entry.ts`.
- The optional A8 race (Item 1, not done).
- The new real-route spec shares the per-process world with the other real-route specs (`prepareS10World` is cached per worker); it adds people, one entry, one review and one assignment, no content type.

## Logs (`lane-last-gaps-logs/`)

`ac071-first-run.log`, `-second-run.log`, `-third-run.log`, `-fourth-run-green.log`; `ac071-mutations.sh`, `ac071-mutations-summary.log`, `ac071-mutation-m*.log`; `ac071-mutations-2.sh`, `-2-first-pass-summary.log`, `-2-summary.log`; `bundle-probe-1.log` (measurement), `bundle-green-1.log`, `bundle-and-workflow-final.log`, `bundle-mutations.sh`, `bundle-mutations-summary.log`, `bundle-mutation-p1-*.log`, `bundle-mutation-p2-*.log`, `bundle-landscape-static.log`; `be03b-spec-readers.log`, `guard-after-ac071.log`, `guard-and-docs-final.log`, `eslint.log`.
