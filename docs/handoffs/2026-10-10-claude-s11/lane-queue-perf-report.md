# Lane queue-perf report (2026-10-12)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD `4c679486` plus this lane's
uncommitted files. I ran no `git add/commit/stash/checkout/reset/restore`. Logs: `lane-queue-perf-logs/` (index in its README).
All database runs were on the ALT stack through `lanes/lane-db-alt.sh` (or the exclusive-lock bench variant of lane reviewA-2),
each after a fresh `supabase db reset`. The main stack, the ledger files and the primary checkout were not touched.

## Finding: the premise was wrong, the bug is older and the fix is in the reader

The canonical gate's 63-minute hang is NOT a regression of `20261010170200` (the relationship policies). It is a latent
planner pathology of the CMS-03B-17 reader (`20261005017890`) that the gate's statistics state exposed; the bench had simply
never run in that state (the 225.9 ms of reviewA-2 and the 23 / 9 ms of the finisher's and my alt runs are fresh-statistics
numbers; this was the first canonical gate to contain the file, and `48befba3`'s passing gate predates it).

Evidence that pins the cause:

1. The gate log's termination context (`claude-dbverify-20261011-233641.log` line 2260) shows the backend inside
   `cms_rpc_context_valid` evaluated by the reader's page query at `cms_list_editorial_reviews` line 122: a plan that
   evaluates the row-level-security quals an astronomical number of times, not a lock wait and not a helper recursion.
2. The same file passes in 129 s on the alt stack (full suite, 14,006 tests) with a 8.4 ms queue p50, so the host and the
   migrations are not enough; the state of `pg_class` is. In the gate the SQL stage ran 11 minutes before the bench
   (alt: 2), long enough for autovacuum to ANALYZE the CMS tables while every earlier file had rolled its fixtures back:
   `relpages > 0, reltuples = 0`. With that state the planner estimates ONE row for every table.
3. I reproduced exactly that state on demand (build the bench world, roll it back, `ANALYZE` the seven tables) and the
   reader's page query then takes 64,976 ms (27,079,512 buffer hits; `diag3.full`). The plan is
   `review_item(503) x [assignment(201) x review_scoped(503, a full unparameterized index scan per assignment)]`: the query joins
   `cms_editorial_reviews` twice and, at one row everywhere, every join order and every index scan looks free. Each of the 27 M
   tuples passes the RLS quals (about 1.2 microseconds each, dominated by `cms_rpc_context_valid`), so 30 calls is 30+ minutes
   on a quiet host and an hour on the main stack.
4. The relationship policies are not the cause: with all nine dropped (the pre-`88f1667b` policy state) the same statistics
   take 62,628 ms against 64,977 ms with them (`diag4.full`, B1). The definer exemption works (`current_user` is the definer in the
   reader; the helpers are never evaluated for it). DEC-174's posture is untouched.

## Fix: `supabase/migrations/20261010171000_cms_list_editorial_reviews_bounded_plan.sql`

Two MD5-pinned, reversible anchors on the installed body of `platform_private.cms_list_editorial_reviews(jsonb)` (source md5
`0661c70b7149cae7aa328232753e822f`, definition md5 `0ca3c49c24d32d3ee4f6216de530d48d`, owner / ACL / `search_path` /
volatility / comment / signature all asserted unchanged before and after; same pattern as `170000`):

- The caller's active assignments are read first, alone, into one `uuid[]`; the review arm is a single-relation probe
  `review.id = any (ids)`. There is no join clause between the two large tables, so the planner has no join order and no
  unparameterized scan to choose wrongly whatever it believes about their sizes. Work is the caller's assignment count plus the probes.
- The redundant second join to `cms_editorial_reviews` is gone (the arms carry every review column the page needs).
- The keyset order and `LIMIT` apply before the four decoration joins (revision, entry, content type, version), so those run for
  at most 51 rows; the reviewer's assignment end is looked up per page row (the active-reviewer unique index returns at most one row).
  The decoration joins are inner joins on NOT NULL, foreign-keyed columns, so applying them after the `LIMIT` returns the same rows.
- The assignment `owner_id` equals the review owner by the composite FK `cms_editorial_review_assignments_review_owner_fkey`; the
  review arm keeps its own owner filter.

Under the stale statistics the new shape takes 4.2 ms and 693 buffer hits (`diag5.full`) instead of 65 s and 27 M. No policy,
index, grant or other function changed. No existing migration was edited (`20261005017890` is untouched; the change is forward-only).

## Tests (RED then GREEN)

New: `supabase/tests/phase_02_slice_11_reads_plan_stability.sql` (20 assertions). It reproduces the gate's statistics state
(autovacuum switched off for the seven tables for its duration, bench world built and rolled back, `ANALYZE`), asserts the state
is in place, then asserts under it, with a 60 s statement timeout per statement so a regression FAILS instead of hanging:
the CMS-03B-17 first page and cursor page return their 50 items; the queue page reads under 10,000 tuples from the review and
assignment tables per call (planner-independent, host-independent: `pg_stat_xact_user_tables` seq + index fetches; old plan
26,704,773 on a validated run, new plan 201 reviews / 252 assignments); and all five reads meet their tier targets. It restores
autovacuum and vacuums the tables at the end.

- RED (`red1.tap`, before `171000` existed): 7 of 20 fail, `not ok 11 .. 14, 18 .. 20`; the queue page is cancelled at 60 s
  (`max=60031.3ms status=timeout`); the precondition (test 10) and the other three reads (15 .. 17) pass. The first RED run's work
  counter read 0 on the cancelled call (my first metric used only table-level counters, which miss index-scan fetches; fixed
  to the xact view, validated separately on the old query: `old-query-metric-validation.txt`).
- GREEN (`green2.tap`): 20 of 20; queue page 1 p95 9.3 ms, page 2 8.2 ms, detail 13.7, workflow 19.2 / 31.9 ms under the stale statistics.
- Mutation proof (`mutant1.tap`): the pre-`171000` reader reinstalled inside the guard's own transaction fails the same 7
  assertions (queue calls cancelled at 60 s, 26,237,343 review tuples read before the cancel).

Changed: `supabase/tests/phase_02_slice_11_reads_bench128.sql` (no assertion title changed; the 14 world `\ir` lines and the
fixture statements moved to the new include `supabase/tests/phase_02_slice_11_reads_bench128/010-fixtures.sqlinc`, shared with the
guard so both measure the same population; one `set local statement_timeout = '120s'` added after the fixtures, so a pathological
plan fails the bench within two minutes). READMEs: `supabase/migrations/README.md` (range `...171000` and the entry),
`supabase/tests/README.md`, `supabase/tests/phase_02_slice_11_rpc_reads/README.md` (row for the guard),
`supabase/tests/phase_02_slice_11_reads_bench128/README.md`; prettier clean.

Title list (all new, tag `[P2-S11-AC-064]` unless noted): `precondition: the planner holds the stale statistics a long gate run leaves
...`; `CMS-03B-17 under stale planner statistics returns the maximum page of 50 items and a next cursor within the statement timeout`;
`CMS-03B-17 cursor page under stale planner statistics returns its 50 items within the statement timeout`; `CMS-03B-17 first page reads
a bounded number of tuples ... (under 10,000 ...)`; `CMS-03B-17 cursor page reads a bounded number of tuples ...`; `CMS-03B-15 on a
128-field draft under stale planner statistics: p95 under the Tier 2 target of 1,200 ms [AC-052]`; `CMS-03B-15 on an entry at 16
schedules ... [AC-052]`; `CMS-03B-16 at 7 of 8 decisions ... [AC-058]`; `CMS-03B-17 first page ... p95 under the Tier 1 target`; `CMS-03B-17
cursor page ... p95 under the Tier 1 target`; `every call of the five measured reads completed within the exact 8,000 ms read deadline
under stale planner statistics (50 calls) [AC-052]`. Old -> new titles: none (no existing title changed).

## Verification (final tree)

- Reads bench, 3 runs, quiet lock held EXCLUSIVELY, one-minute load average before each run 1.40 / 1.25 / 1.21 (`bench-run{1,2,3}`),
  24 of 24 each. p95 in ms (run 1 / 2 / 3): queue page 1 6.4 / 6.1 / 5.6 (target 750); queue page 2 6.3 / 5.9 / 5.8 (750); review detail
  5.0 / 5.4 / 5.3 (750); workflow bounds 17.2 / 17.4 / 17.9 (1,200); workflow draft128 27.6 / 28.6 / 25.9 (1,200).
- RLS suite `phase_02_slice_11_rls_session_scope.sql` 68 of 68 and the read suites (`rpc_reads_queue`, `criteria_safe_read_effects`,
  and the rest of the 369) pass: full pgTAP on the alt stack, `full-suite.out`: 369 files, 14,026 tests (14,006 + the guard's 20), all pass, 130 s.
  Targeted final run: guard + bench + RLS + queue + safe-read-effects, 5 files, 163 tests (`final-targeted.out`).
- `supabase db lint --level warning` on the alt stack: exit 0, no finding on the reader.

## Spec lines and decisions

BE03b CMS-03B-17 (Tier 1 p95 < 750 ms, signed keyset cursor unchanged), tracker P2-S11-AC-064 / AC-052 / AC-058 evidence; DEC-174
(definer stays tenant-scoped, relationship predicates bind the other roles) unchanged; `.claude/rules/debug-by-test.md` (RED before the
fix), `tdd-contract-first.md`, `boundary-not-placeholder.md` (no stub, no TODO).

## Left open / for the orchestrator

1. Re-run the canonical gate; the SQL stage should now pass the bench. In the failed gate the SQL stage ran about 11 minutes before
   the bench (alt: 2); the guard poisons and restores the statistics itself, so its result does not depend on when autovacuum ran.
2. Ledger: the bench file's assertion titles are unchanged (its receipt hash changed with the include move and the timeout line); add
   `supabase/tests/phase_02_slice_11_reads_plan_stability.sql` as evidence for AC-052 / AC-058 / AC-064 (titles above).
3. Record (orchestrator's files): a decision / pattern that a pgTAP benchmark file must set a statement timeout and must be measured under
   `relpages > 0, reltuples = 0` statistics, and that the 63-minute hang was not the DEC-174 policies (premise correction). Other
   in-suite benchmark files (e.g. `phase_02_slice_09_evidence_bench128.sql`) still have no statement timeout; a plan regression
   there would hang the gate the same way. Not changed here (outside the assignment).
4. Not done: the pre-`88f1667b` reader under fresh statistics was not re-timed (not needed: B1 above is the controlled comparison).
