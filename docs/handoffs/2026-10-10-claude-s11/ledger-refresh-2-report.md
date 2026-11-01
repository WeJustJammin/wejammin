# Slice 10 and Slice 11 evidence-ledger refresh 2 (2026-10-12)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD `34b00313` when the citations were resolved (the a11y-status fix; the lane started at `c1541794` and re-resolved after the orchestrator addendum;
HEAD has since moved to `e3c1397b` by two docs-only commits that touch `.memory/raw/events/2026-10-12.jsonl` only, so no cited file moved). The working tree was clean when I started: every cited test file is a committed file.
Nothing was executed except the two authorized commands (prettier on the seven fragments, and the two evidence-guard files, both run under `flock -s /tmp/wejammin-quiet.lock` after the canonical `gate-db-verify.sh` released its exclusive hold); no other test, `pnpm`, `node`,
database or git write command was run.

Files written: the seven fragments `tests/contracts/phase-02-slice-11-evidence-ledger-{001-034,035-066,067-100,101-122}.ts`,
`tests/contracts/phase-02-slice-10-evidence-ledger-{001-035,036-070,071-105}.ts` and this report.

## Method (read-only analysis scripted outside the repository)

1. Parsed all seven fragments into data and re-emitted them. Before any edit the parse and emit plus prettier reproduced the committed files byte for byte (`git diff` empty).
2. Re-resolved every citation (S11 3,524 before, S10 2,857 before) against the current tree: vitest and Playwright titles by a static scan of describe/it/test/each nesting
   (exact, pattern for `it.each`/template titles, dynamic), pgTAP descriptions as whole SQL string literals occurring once in the cited file, race labels as string
   literals of the runner. For Slice 10 the committed receipts (`phase-02-slice-10-receipts.generated.jsonl`) were used as ground truth for every file that has not changed since the run
   (2,489 citations), and the 325 citations in changed files were checked statically plus by a diff of every file whose generated titles could carry a changed parameter.
3. Every citation I added is copied from the file by title, validated to exist exactly once, and read for what it asserts (bodies read for the new RLS, race 032, executor-cancel, dependency-code and status-line tests).
4. Replica of the guard's static rules over the result (clause tiling, status and limitation rules, citation shape, duplicate-in-clause, sole-proof limit): 0 problems. Duplicate scan over the 493 cited files: no duplicated test title or pgTAP description.

## Final counts

| Slice | verified | partial | unverified | contract-only | citations |
| --- | --- | --- | --- | --- | --- |
| 11 (122 criteria) | **114** | **6** (AC-052, 058, 064, 071, 079, 106) | **2** (AC-044, 045) | 0 | 3,682: 1,877 vitest, 1,699 pgTAP, 97 race, 9 Playwright |
| 10 (105 criteria) | **101** | **4** (AC-056, 060, 080, 089) | 0 | **0** | 2,913: 1,971 vitest, 828 pgTAP, 20 race, 94 Playwright |

Before this refresh: Slice 11 was 114 / 6 / 2 (AC-050, 053, 056, 059, 071, 106 partial); Slice 10 was 89 verified, 11 partial, 5 contract-only.
Slice 11 is numerically unchanged because four entries went up (050, 053, 056, 059) and four went down (052, 058, 064, 079) for the reasons below.

## Changed entries (70: 51 in Slice 11, 19 in Slice 10)

"citations" is added / removed. Status is shown only when it moved.

### S10

| AC | status | citations | why |
| --- | --- | --- | --- |
| 008 | verified | +1 / -1 | dep502 renamed the four "maps a success payload that fails the declared resource contract" tests (now "502 DEPENDENCY_UNAVAILABLE that is not retried automatically") and the EA conflict-recovery row (AC-014). |
| 010 | verified | +1 / -1 | dep502 renamed the four "maps a success payload that fails the declared resource contract" tests (now "502 DEPENDENCY_UNAVAILABLE that is not retried automatically") and the EA conflict-recovery row (AC-014). |
| 014 | verified | +2 / -2 | dep502 renamed the four "maps a success payload that fails the declared resource contract" tests (now "502 DEPENDENCY_UNAVAILABLE that is not retried automatically") and the EA conflict-recovery row (AC-014). |
| 020 | verified | +1 / -1 | dep502 renamed the four "maps a success payload that fails the declared resource contract" tests (now "502 DEPENDENCY_UNAVAILABLE that is not retried automatically") and the EA conflict-recovery row (AC-014). |
| 022 | verified | +1 / -1 | dep502 renamed the four "maps a success payload that fails the declared resource contract" tests (now "502 DEPENDENCY_UNAVAILABLE that is not retried automatically") and the EA conflict-recovery row (AC-014). |
| 026 | verified | +1 / -1 | dep502 renamed the four "maps a success payload that fails the declared resource contract" tests (now "502 DEPENDENCY_UNAVAILABLE that is not retried automatically") and the EA conflict-recovery row (AC-014). |
| 038 | partial -> verified | +13 / -5 | DEC-147 option C: the Slice 11 runtime now proves the clauses Slice 10 could only scope; the old "no S10 operation serves it" scope tests were replaced by their renamed allow-list successors plus Slice 11 runtime tests; uncited clauses cite the Slice 11 refusal/derivation tests. |
| 039 | contract-only -> verified | +8 / -5 | DEC-147 option C: the Slice 11 runtime now proves the clauses Slice 10 could only scope; the old "no S10 operation serves it" scope tests were replaced by their renamed allow-list successors plus Slice 11 runtime tests; uncited clauses cite the Slice 11 refusal/derivation tests. |
| 040 | partial -> verified | +3 / -0 | DEC-147 option C: the Slice 11 runtime now proves the clauses Slice 10 could only scope; the old "no S10 operation serves it" scope tests were replaced by their renamed allow-list successors plus Slice 11 runtime tests; uncited clauses cite the Slice 11 refusal/derivation tests. |
| 041 | contract-only -> verified | +6 / -4 | DEC-147 option C: the Slice 11 runtime now proves the clauses Slice 10 could only scope; the old "no S10 operation serves it" scope tests were replaced by their renamed allow-list successors plus Slice 11 runtime tests; uncited clauses cite the Slice 11 refusal/derivation tests. |
| 042 | partial -> verified | +7 / -0 | DEC-147 option C: the Slice 11 runtime now proves the clauses Slice 10 could only scope; the old "no S10 operation serves it" scope tests were replaced by their renamed allow-list successors plus Slice 11 runtime tests; uncited clauses cite the Slice 11 refusal/derivation tests. |
| 043 | contract-only -> verified | +6 / -4 | DEC-147 option C: the Slice 11 runtime now proves the clauses Slice 10 could only scope; the old "no S10 operation serves it" scope tests were replaced by their renamed allow-list successors plus Slice 11 runtime tests; uncited clauses cite the Slice 11 refusal/derivation tests. |
| 044 | partial -> verified | +8 / -4 | DEC-147 option C: the Slice 11 runtime now proves the clauses Slice 10 could only scope; the old "no S10 operation serves it" scope tests were replaced by their renamed allow-list successors plus Slice 11 runtime tests; uncited clauses cite the Slice 11 refusal/derivation tests. |
| 045 | contract-only -> verified | +6 / -4 | DEC-147 option C: the Slice 11 runtime now proves the clauses Slice 10 could only scope; the old "no S10 operation serves it" scope tests were replaced by their renamed allow-list successors plus Slice 11 runtime tests; uncited clauses cite the Slice 11 refusal/derivation tests. |
| 046 | partial -> verified | +8 / -5 | DEC-147 option C: the Slice 11 runtime now proves the clauses Slice 10 could only scope; the old "no S10 operation serves it" scope tests were replaced by their renamed allow-list successors plus Slice 11 runtime tests; uncited clauses cite the Slice 11 refusal/derivation tests. |
| 047 | contract-only -> verified | +6 / -4 | DEC-147 option C: the Slice 11 runtime now proves the clauses Slice 10 could only scope; the old "no S10 operation serves it" scope tests were replaced by their renamed allow-list successors plus Slice 11 runtime tests; uncited clauses cite the Slice 11 refusal/derivation tests. |
| 048 | partial -> verified | +9 / -5 | DEC-147 option C: the Slice 11 runtime now proves the clauses Slice 10 could only scope; the old "no S10 operation serves it" scope tests were replaced by their renamed allow-list successors plus Slice 11 runtime tests; uncited clauses cite the Slice 11 refusal/derivation tests. |
| 079 | partial -> verified | +4 / -0 | DEC-147 option C: "preview" and "publication bind the same bytes" cite the Slice 11 version-set staleness tests (the version set carries the schema artifact hash). |
| 089 | partial | +8 / -0 | dep502: the 502 DEPENDENCY_UNAVAILABLE clause is cited (route tests); the clause is split so the unproven 256 KiB side bound is isolated. |

### S11

| AC | status | citations | why |
| --- | --- | --- | --- |
| 006 | verified | +2 / -1 | A-M3: the "left nothing behind" probe was renamed by reviewA-2 (the digest of the fourteen durable tables is now taken before and after each probe, inside its own call); the clause cites the new title and the effect-oracle test that shows the observation is not blind. |
| 007 | verified | +5 / -0 | A-M2: the "and RLS" member now cites predicate RLS with positive and negative per-role tests (phase_02_slice_11_rls_session_scope.sql; reviewA-1 migration 169000, finisher migration 170200, DEC-174). |
| 009 | verified | +2 / -1 | A-M3: the "left nothing behind" probe was renamed by reviewA-2 (the digest of the fourteen durable tables is now taken before and after each probe, inside its own call); the clause cites the new title and the effect-oracle test that shows the observation is not blind. |
| 010 | verified | +2 / -1 | A-M3: the "left nothing behind" probe was renamed by reviewA-2 (the digest of the fourteen durable tables is now taken before and after each probe, inside its own call); the clause cites the new title and the effect-oracle test that shows the observation is not blind. |
| 012 | verified | +2 / -1 | A-M3: the "left nothing behind" probe was renamed by reviewA-2 (the digest of the fourteen durable tables is now taken before and after each probe, inside its own call); the clause cites the new title and the effect-oracle test that shows the observation is not blind. |
| 013 | verified | +8 / -0 | A-M2: the "and RLS" member now cites predicate RLS with positive and negative per-role tests (phase_02_slice_11_rls_session_scope.sql; reviewA-1 migration 169000, finisher migration 170200, DEC-174). |
| 015 | verified | +4 / -1 | A-M3 (same): renamed probe, the oracle, and the "control: the observation sees a write" test (AC-015, AC-027); AC-033 also cites the new publish probe. |
| 016 | verified | +2 / -1 | A-M3: the "left nothing behind" probe was renamed by reviewA-2 (the digest of the fourteen durable tables is now taken before and after each probe, inside its own call); the clause cites the new title and the effect-oracle test that shows the observation is not blind. |
| 018 | verified | +2 / -1 | A-M3: the "left nothing behind" probe was renamed by reviewA-2 (the digest of the fourteen durable tables is now taken before and after each probe, inside its own call); the clause cites the new title and the effect-oracle test that shows the observation is not blind. |
| 019 | verified | +5 / -0 | A-M2: the "and RLS" member now cites predicate RLS with positive and negative per-role tests (phase_02_slice_11_rls_session_scope.sql; reviewA-1 migration 169000, finisher migration 170200, DEC-174). |
| 022 | verified | +2 / -1 | A-M3: the "left nothing behind" probe was renamed by reviewA-2 (the digest of the fourteen durable tables is now taken before and after each probe, inside its own call); the clause cites the new title and the effect-oracle test that shows the observation is not blind. |
| 024 | verified | +2 / -1 | A-M3: the "left nothing behind" probe was renamed by reviewA-2 (the digest of the fourteen durable tables is now taken before and after each probe, inside its own call); the clause cites the new title and the effect-oracle test that shows the observation is not blind. |
| 025 | verified | +5 / -0 | A-M2: the "and RLS" member now cites predicate RLS with positive and negative per-role tests (phase_02_slice_11_rls_session_scope.sql; reviewA-1 migration 169000, finisher migration 170200, DEC-174). |
| 027 | verified | +3 / -1 | A-M3 (same): renamed probe, the oracle, and the "control: the observation sees a write" test (AC-015, AC-027); AC-033 also cites the new publish probe. |
| 028 | verified | +2 / -1 | A-M3: the "left nothing behind" probe was renamed by reviewA-2 (the digest of the fourteen durable tables is now taken before and after each probe, inside its own call); the clause cites the new title and the effect-oracle test that shows the observation is not blind. |
| 030 | verified | +2 / -1 | A-M3: the "left nothing behind" probe was renamed by reviewA-2 (the digest of the fourteen durable tables is now taken before and after each probe, inside its own call); the clause cites the new title and the effect-oracle test that shows the observation is not blind. |
| 031 | verified | +4 / -0 | A-M2: the "and RLS" member now cites predicate RLS with positive and negative per-role tests (phase_02_slice_11_rls_session_scope.sql; reviewA-1 migration 169000, finisher migration 170200, DEC-174). |
| 033 | verified | +2 / -1 | A-M3 (same): renamed probe, the oracle, and the "control: the observation sees a write" test (AC-015, AC-027); AC-033 also cites the new publish probe. |
| 034 | verified | +2 / -1 | A-M3: the "left nothing behind" probe was renamed by reviewA-2 (the digest of the fourteen durable tables is now taken before and after each probe, inside its own call); the clause cites the new title and the effect-oracle test that shows the observation is not blind. |
| 037 | verified | +12 / -1 | A-M15 retain input: the controller test whose title promised "keeps the input" was replaced by form-level retention tests (definite refusal and unknown outcome); a11y-status lane (34b00313): "announce status" cites the persistent island status line tests. |
| 039 | verified | +4 / -2 | Combined execute-refusal title replaced (blocked vs cancelled); the line-117 test replaced by the head-preservation test; cancellation cited under "deletion". |
| 040 | verified | +6 / -1 | A-M15 retain input: the controller test whose title promised "keeps the input" was replaced by form-level retention tests (definite refusal and unknown outcome); a11y-status lane (34b00313): "announce status" cites the persistent island status line tests. |
| 043 | verified | +8 / -1 | A-M15 retain input: the controller test whose title promised "keeps the input" was replaced by form-level retention tests (definite refusal and unknown outcome); a11y-status lane (34b00313): "announce status" cites the persistent island status line tests. |
| 045 | unverified | +0 / -0 | Limitation brought up to date (boundary issues #127 and #128); still unverified. |
| 046 | verified | +1 / -1 | A-M3 (same): the cited decision, schedule and publish refusal probes were renamed. |
| 047 | verified | +1 / -1 | A-M3 (same): the cited decision, schedule and publish refusal probes were renamed. |
| 048 | verified | +1 / -1 | A-M3 (same): the cited decision, schedule and publish refusal probes were renamed. |
| 050 | partial -> verified | +3 / -0 | partial -> verified: the 502 clause now cites tests that assert 502 with code DEPENDENCY_UNAVAILABLE and details { dependencyClass, retryable: true } (dep502, owner ratification 2026-10-11, BE00:172/590). |
| 051 | verified | +5 / -0 | A-M14: three negative reader-scope cases (revoked assignee, other revision, other entry) with controls. |
| 052 | verified -> partial | +1 / -0 | verified -> partial (A-M9): the p95 clause is uncited; see "Remaining non-verified". |
| 053 | partial -> verified | +5 / -0 | partial -> verified: the 502 clause now cites tests that assert 502 with code DEPENDENCY_UNAVAILABLE and details { dependencyClass, retryable: true } (dep502, owner ratification 2026-10-11, BE00:172/590). |
| 056 | partial -> verified | +3 / -0 | partial -> verified: the 502 clause now cites tests that assert 502 with code DEPENDENCY_UNAVAILABLE and details { dependencyClass, retryable: true } (dep502, owner ratification 2026-10-11, BE00:172/590). |
| 058 | verified -> partial | +1 / -0 | verified -> partial (A-M9): the p95 clause is uncited; see "Remaining non-verified". |
| 059 | partial -> verified | +5 / -0 | partial -> verified: the 502 clause now cites tests that assert 502 with code DEPENDENCY_UNAVAILABLE and details { dependencyClass, retryable: true } (dep502, owner ratification 2026-10-11, BE00:172/590). |
| 064 | verified -> partial | +1 / -0 | verified -> partial (A-M9): the p95 clause is uncited; see "Remaining non-verified". |
| 069 | verified | +4 / -1 | A-B1: the revoke now needs the owner cms.editor grant (migration 017620 changed in place); the title of the refusal test changed, the lapsed-grant test and race A7 (static labels) were added. |
| 070 | verified | +1 / -0 | A-m24: the review-lock clause also cites the race A2 label that shows the callers wait on the command review lock, not on the insert guard. |
| 071 | partial | +2 / -1 | A-M3: renamed probe plus its control; still partial for the redelivery clause (below). |
| 079 | verified -> partial | +3 / -3 | verified -> partial: the criterion lists four execution outcomes; DEC-173 adds a fifth (cancelled). See "Remaining non-verified". |
| 080 | verified | +4 / -2 | Renamed no-effect probes; the stale-proof recompute (reviewB-2, B-02) cited under the execute-phase preflight clause. |
| 081 | verified | +8 / -0 | A-M13: exact grantee ACL walk (sweep_grants.sql) and the import-graph tests (module boundary) added. |
| 082 | verified | +5 / -1 | A-M12: the job deadline test was retitled (one deadline shared by claim and execute) and two tests added; race 032 under SKIP LOCKED. |
| 083 | verified | +10 / -2 | A-M7 and A-m1: DEC-173 makes the executor cancel entry_unavailable; the clause cites the new 32-test file, the executor test and the real-Worker apispec; the head-preservation clause cites the xr-head tests and drops the line-117 test whose title overclaimed. |
| 084 | verified | +12 / -1 | A-M11: race 032 with a real overlap barrier (sweeper A parked while B completes) under "two concurrent sweepers" and "lease-expiry recovery"; the executor cancellation under "every reasonCode". |
| 086 | verified | +3 / -0 | B-06: sealed state-filtered history cursor paged through the real Worker route (three apispec cases). |
| 091 | verified | +2 / -2 | A-M10: the two source-grep assertions were replaced by the spy-resolver behavioural tests (titles changed). |
| 097 | verified | +3 / -3 | A-M3 renames of the three probes cited under "nothing commits". |
| 113 | verified | +10 / -1 | DEC-170: locale-source currency (recheck_locale_source.sql and the localization apispec cases) cited under rebuild/invalidate, idempotence and the source-resolving consumer; probe renamed. |
| 115 | verified | +2 / -0 | A-m33: the command-level race 014 E3 (two publishes racing on one lineage) cited beside the helper race. |
| 119 | verified | +5 / -1 | Forced-RLS clause: the posture test was renamed (named restrictive policies) and the four rls_session_scope structure tests were added. |
| 122 | verified | +5 / -2 | Schedule-state test renamed (DEC-173 allows executing -> cancelled for an unavailable entry); the three executor-cancellation schema tests cited. |

## Remaining non-verified entries and exactly what is missing

### Slice 11

- **AC-052, AC-058, AC-064 (partial, clause "the Tier 2 p95 < 1,200 ms target" / "the Tier 1 p95 < 750 ms target").** `supabase/tests/phase_02_slice_11_reads_bench128.sql` (reviewA-2)
  measures the database RPC of each read over thirty samples at the declared bounds and passed with a wide margin on the quiet host, but BE00:653 states the Tier 1/Tier 2 figures for the API
  ("Tier 2/API p95 <1,200ms and protected RPC p95 <300ms"), and no test measures the composed Worker, Kong and PostgREST read. The independent reviewer (A-M9) and the lane both name the same two exits:
  a composed-stack p95 measurement, or an owner ruling that the p95 of a read is the protected-RPC figure. If the owner rules the second, the change is mechanical: cite these bench titles in the p95
  clause and flip the entries to verified. AC-052: "CMS-03B-15 on a 128-field draft with the full preparation and 17-result preflight: p95 under the Tier 2 target of 1,200 ms [P2-S11-AC-052]" and "CMS-03B-15 on an entry at 16 schedules, 64 publications and an open review: p95 under the Tier 2 target of 1,200 ms [P2-S11-AC-052]";
  AC-058: "CMS-03B-16 at 7 of 8 decisions, 32 assignment summaries and a 128-field frozen manifest: p95 under the Tier 1 target of 750 ms [P2-S11-AC-058]";
  AC-064: "CMS-03B-17 first page at the maximum limit of 50 from 200 assigned reviews among 500: p95 under the Tier 1 target of 750 ms [P2-S11-AC-064]" and "CMS-03B-17 cursor page at the maximum limit of 50: p95 under the Tier 1 target of 750 ms [P2-S11-AC-064]"
  (all in `phase_02_slice_11_reads_bench128.sql`). The 2,000 ms checker budget the AC-052 text folds into the 1,200 ms figure runs in the Worker and is cited under its own clause; the text is inconsistent (the budget alone exceeds the p95).
  The bench's last assertion (every read's worst sample under 8,000 ms) is cited under the "8,000 ms deadline" clause of all three.
- **AC-079 (partial, clause "(`completed`, `blocked`, `failed_retryable` or `already_completed`)").** DEC-173 (BE03b CMS-03B-20 line 1898 over DEC-158(d)) gave the executor a fifth outcome, `cancelled` with `entry_unavailable`;
  `ScheduleExecutionResult` has five outcomes and `internal-rpc.test.ts` ("types the execution result with the closed outcome and reason coupling") asserts exactly five, so no test can show the list of four.
  Missing: an owner wording ruling that adds `cancelled` to the criterion and to the BE03b schema (BE03b lines 1505-1512, 1844, 1867, 2073 still describe four outcomes). The strict result type, the executor signature, the claim RPC and the private/browser separation stay cited.
- **AC-071 (partial, clause "retries the review event idempotently").** Unchanged: no test redelivers a `cms.entry.review-changed.v1` outbox event of an assignment change. The new recheck tests prove redelivery idempotence for the six
  recheck source events and for a relayed poison row, which is a different event. Needs a delivery-retry test for the review-changed event (pgTAP or consumer seam; there is no review-changed consumer in Slice 11, so the seam must be decided first).
- **AC-106 (partial, clause "stays within the bundle-budget thresholds").** Unchanged: the only gate is `pnpm bundle:check`; needs a vitest over the built `contracts-time-authority` chunk and initial route against `BUNDLE_BUDGETS`, or an owner ruling that the build gate is the proof.
- **AC-044 and AC-045 (unverified, stay unverified as instructed).** Slice-close process criteria: canonical validation run, retained RED receipts, same-change tracker/runbook/graph update, no unresolved boundary or drift. AC-045's limitation now names the two boundaries open by design
  with their tracking issues: `projection_consumer_state.projection_id` without a foreign key (issue #127) and the production trigger of the claimed schema-migration preparation entry (BOUNDARY in `production-job-effect-dispatcher.ts`, sentinel `production-job-effect-dispatcher-cms-preparation.test.ts`, issue #128).

### Slice 10

- **AC-089 (partial, clause "or a side over 256 KiB)").** The database read bounds each side at 262144 bytes (`cms_json_bounded`), but no test feeds a side over 256 KiB to the RPC, contract or route (the contract schema has no size member). Cited now: the 128-path bound (contract tests) and the route tests that answer a contract-breaking dependency answer as 502
  `DEPENDENCY_UNAVAILABLE` with a fixed body. Needs one over-bound side case (256 KiB plus one byte).
- **AC-080 (partial, clauses "publication (the preflight `contract` category in the submit, schedule and publish phases)" and "Preview evaluates no field value").** Unchanged: a pgTAP case in which a stored DEC-133 object value violating the structure fails the publish-phase `contract` category in step with the TypeScript verdict, and a test that the preview mint runs no registry phase.
- **AC-056 (partial, "taxonomy versions").** Unchanged: the resolving taxonomy authority is Slice 12.
- **AC-060 (partial, "in the same change;").** Unchanged: shown by the commit or pull request, not by a test.

## Judgement calls the refutation review should look at first

1. **AC-052, 058, 064 partial** instead of citing the bench as proof (above). The orchestrator brief listed the benches among the tests to cite; I cited the bench under the clause it does prove (the 8,000 ms deadline) and kept the p95 clause open because BE00:653 puts the Tier figures at the API. One owner sentence settles it either way.
2. **AC-079 partial** for the four-outcome list. This is a defect I found, not one of the review-A findings: DEC-173 changed the code and the BE03b/tracker text did not follow.
3. **Slice 10 AC-038 to AC-048 and AC-079 are verified, no longer partial or contract-only.** DEC-147 option C says to prove Slice 10 wording with the Slice 11 runtime. For each, the sentence "This is a contract-only ... rule; runtime completion requires ..." now cites the renamed allow-list test of the operation (it is a registered route operation and Worker RPC binding)
   plus the Slice 11 runtime tests of that operation, and each previously uncited clause cites the Slice 11 refusal or derivation test. If the owner prefers the five contract-only entries to stay contract-only, set status and limitation back; the clauses are cited either way.
4. **RLS entries stay verified** (AC-007/013/019/025/031). The predicates bind every role except the CMS definer (DEC-174); the table ACL grants only postgres and the definer, so today they bind the test probe role and any future grantee. DEC-174 is an orchestrator decision, not an owner ruling.
5. **AC-053 verified** although the 500 clause ("an internal failure (500, empty details)") still rests on shared envelope tests (`workflow-errors-typed`, `workflow-errors`), not a dedicated CMS-03B-15 internal-failure case (the former limitation said so). Same weakness as A-m2 for AC-027[4] and AC-059[8].
6. **AC-091** stays verified: the spy test proves the consumer key, the per-key request and the ascending bytewise order, and the production code passes `clock_timestamp()` (read, not tested) as the "command's server instant".
7. **AC-081 and DEC-156**: the entry cannot state that "every other role revoked" is read as `service_role` plus a module boundary (no free text in a verified entry); both halves are now tested (exact ACL walk, import graph).

## Review-A findings, one by one

| Finding | Disposition |
| --- | --- |
| A-B1 AC-069 | Fixed in code; citations moved to the new titles, plus lapsed grant and race A7. Verified. |
| A-M1 receipts | Not mine: receipts and the guard run need the quiet host (see the guard result). |
| A-M2 RLS | Cited (above). Verified. |
| A-M3 vacuous probes | Renamed titles, oracle and controls cited on all 14 clauses and the 6 other entries. |
| A-M4 AC-070 | Already settled by the wording batch (DEC-161 in the text); verified. |
| A-M5 AC-059, A-M6 AC-097, A-M8 AC-122 | Settled by the wording batch (AC-059 now also by the 502 citations; AC-097 and AC-122 retitled citations). |
| A-M7 AC-083 | Executor now cancels (DEC-173); cited; verified. Side effect: AC-079. |
| A-M9 p95 | AC-052, 058, 064 partial. |
| A-M10 AC-091, A-M11 AC-084, A-M12 AC-082, A-M13 AC-081, A-M14 AC-051, A-M15 retain input | Cited; verified. |
| A-m1 | Fixed (xr-head tests; the line-117 test dropped from AC-083 and AC-039). |
| A-m4 | Settled by the ratification (502 is the invalid-response status of a contacted dependency). |
| A-m19 | AC-014 and AC-020 already cite the barriered B5/B7 and S3/S4; the B2 and S2 labels are interpolated and cannot be cited. |
| A-m24, A-m33 | Fixed (A2 static label; E3 labels). |
| A-m2, m3, m5-m18, m20-m23, m25-m32, m34, m35 | Not changed: minor, citation-level or inference-level weaknesses that a ledger edit cannot settle without new tests (for example no per-operation 500 case for the reads, no refetch of a concealed review, no composed-stack timing, metrics `cms_preview_minted_total` and the others not emitted, hard-coded `2026e`). They stand as the reviewer rated them. |

## a11y-status lane (orchestrator addendum, commit 34b00313)

- Re-resolved: `CmsEditorialWorkflowIsland.focus.test.tsx` "[P2-S11-AC-043] keeps focus on Confirm publish until the read lands, then moves it to the publications heading only" and "[P2-S11-AC-040] keeps focus on Schedule until the read lands, then moves it to the schedules heading only" keep their titles and resolve exactly (their assertion now reads the island line).
  The Playwright titles `[S11-RR-05/06/07/09]` are unchanged and resolve.
- New tests cited for "announce status": AC-037[7] gained eight (decision confirmation after the refetch, in flight, unknown outcome, refused; island line mounted before any command; submit confirmation; hook takes and writes once);
  AC-040[7] gained the schedule confirmation test and two hook tests (sentence survives the form's removal, withdrawn on the next command); AC-043[7] gained the publication and preview confirmation tests and the same two hook tests.
- Not cited: AC-054, AC-060 and AC-072 have no "announce status" clause. The two `[P2-S11-AC-072]` tests ("Reviewer assigned" kept through the refetch / withdrawn on a new assignment) are about a confirmation sentence that no AC-072 clause names (its focus clause is "returns focus to the assignment list heading after commit"), so I did not cite them.

## Citations whose exact rendered title cannot be confirmed statically

The first collector run settles these; if it reports "no receipt", fix these first. They are `it.each`/loop titles I built from the source with the vitest `%s` rule (raw value):

- `route-errors-dependency.test.ts`: `[BE00:172][BE00:590] a 502 is published as DEPENDENCY_UNAVAILABLE on every editorial route CMS-03B-12|15|16 publishes a 502 as DEPENDENCY_UNAVAILABLE with a retryable cms_editorial dependency and no upstream text`.
- `workflow-read-breach-workflow.test.ts` / `-review.test.ts`: `... refuses <breach name>` for `18 preflight results`, `65 publications`, `a preparation for a revision that is not a draft`, `9 decisions`, `more recorded decisions than required`, `a decision with a member the contract does not name`.
- `workflow-read-routes.test.ts`: `port boundary is 502 when the success payload breaks the resource contract CMS-03B-15|16`.
- Slice 10: the four `'CMS-03B-0N' failure mapping through the production app and adapter CMS-03B-0N maps a success payload ... to a 502 DEPENDENCY_UNAVAILABLE that is not retried automatically` titles and the `... EA conflict resolution recovers from every dependency failure a 502 DEPENDENCY_UNAVAILABLE ...` row; the EB scope per-operation titles `EB publication scope CMS-03B-0N: it is a registered route operation and a Worker RPC binding on its named method and path` (N = 05 to 09).
- Race labels with interpolated values (for example `E9b: once the archive commits ... (${...})`, `A2: both creates are parked ... (${...})`) are not cited anywhere.

## Structural guard result

`pnpm exec prettier --write` on the seven fragments (exit 0; `--check` clean afterwards) and then
`pnpm exec vitest run tests/contracts/phase-02-slice-10-evidence-guard.test.ts tests/contracts/phase-02-slice-11-evidence-guard.test.ts --reporter=verbose` (the 937 KB log is not kept in the repository; the run is reproducible and the counts below are its output):

| Test | Slice 10 | Slice 11 |
| --- | --- | --- |
| covers exactly the tracker criteria, in order, text byte-identical | pass (105) | pass (122) |
| reports the counts | pass: 101 verified, 4 partial, 0 contract-only, 0 unverified | pass: 114 verified, 6 partial, 0 contract-only, 2 unverified |
| allows contract-only only inside the policy range | pass | pass |
| receipts only when cited, none with a criterion field | pass | fail (the receipts file `phase-02-slice-11-receipts.generated.jsonl` does not exist yet) |
| backs every claim with a fresh passing receipt | fail: 418 problems = 352 "stale receipt" (25 changed cited files) + 66 "no receipt" | fail: 2,244 problems, all "no receipt" |

Classification of all 2,662 reported problems: 2,310 "no receipt", 352 "stale receipt", **0 of any other kind**. There is no text mismatch, clause-tiling, status/limitation, citation-shape (path grammar, extension, trimmed title), duplicate-in-clause or sole-proof problem
(each would appear in the same problem list; my replica of those rules found none either). The three failing tests are receipt-class only, as expected before `run-slice-evidence.mjs` runs.

## Things the orchestrator still has to do

- The receipts: `node scripts/evidence/run-slice-evidence.mjs --slice 10` and `--slice 11` (25 cited Slice 10 files changed since the committed Slice 10 receipts, and 66 cited Slice 10 identities have no receipt: the renamed ones and the Slice 11 tests that Slice 10 entries now cite, so the Slice 10 run also executes those Slice 11 steps). The cited-file rule also needs every test of every cited file green, including the new files cited here
  (`rls_session_scope`, `rpc_publication_execute_entry_unavailable`, `rpc_publication_sweep_grants`, `rpc_reads_workflow_reviewer_scope`, `reads_bench128`, `effect_oracle`, `recheck_locale_source`, race 032, the three status test files, the retention test files).
- Memory records (not mine) for: AC-079 four-versus-five outcomes (needs a wording ruling), AC-052/058/064 p95 meaning, DEC-147 option C applied to Slice 10 AC-038 to AC-048.
