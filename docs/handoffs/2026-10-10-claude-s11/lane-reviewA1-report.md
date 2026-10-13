# Lane reviewA1 report (2026-10-11, second resume)

Items of `review-a-ledger-refutation.md`: A-B1 (AC-069), A-M7 (AC-083), A-M2 (predicate RLS for AC-007/013/019/025/031),
A-M14 (AC-051), A-M11 (AC-084), A-M10 (AC-091), A-M13 (AC-081).
Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD `1988e5ee` (the lane
started at `844117ca`; the orchestrator has since committed other lanes' work). I ran no `git add/commit/stash/checkout/reset/restore`;
nothing of this lane is staged or committed. Two earlier agents of this lane died at usage limits (snapshots
`refs/backup/s11-claude-wip-3` and `-4`); their work was inspected, completed and re-verified at HEAD `1988e5ee`, not restarted.
reviewA-2's files (no-effect harness, benches, retain-input) and reviewB's files were not edited or reverted.

Log paths below are under `/home/rob/.codex/worktrees/phase2-slice11/WeJammin/.lane-logs/` (ignored by git, not committed).

## State found on resume

- No leftover temporary mutant or test copy exists in any tracked directory (`find` for `zz_*`/`*mutant*` under `supabase/`, `apps/`,
  `packages/`, `tests/` is empty; `git status` shows only lane files). The earlier agents' temporary mutants live only in
  `.lane-logs/reviewA1-mutants/` (ignored, kept so the mutation runs below are reproducible); their `apps/zz-reviewA1-mirror` tree
  is already gone. Nothing had to be deleted. This session's mutation mirror lives outside the worktree (agent scratchpad).
- The lane's code was complete. What was missing: a final run of everything on the final tree, one stale test plan, and this report.

## Files of this lane

Production (the only two production SQL files of the lane):
- `supabase/migrations/20261005017620_cms_assign_editorial_reviewer.sql` (edited in place; Slice 11 only, never on `main`, not MD5-pinned by any later
  migration): the owner's valid `cms.editor` grant is required for a REVOKE as well as a create, in both authority passes.
- `supabase/migrations/20261010169000_cms_slice11_session_scope_rls.sql` (new, forward, 4 helper functions, 18 policies).

Tests and runners:
- new `supabase/tests/phase_02_slice_11_rls_session_scope.sql` (57 assertions)
- new `supabase/tests/phase_02_slice_11_rpc_publication_sweep_grants.sql` (6)
- new `supabase/tests/phase_02_slice_11_rpc_reads_workflow_reviewer_scope.sql` (18)
- new `supabase/tests/phase_02_slice_11_races/032-schedule-sweeper-overlap-race.mjs` (15 ok-lines), registered in `infra/run-database-race-runners.mjs`
- new `apps/worker/src/import-graph.test-support.ts`, `apps/worker/src/import-graph.test.ts` (5 tests),
  `apps/worker/src/cms-publication-schedule-import-graph.test.ts` (7 tests)
- new `apps/worker/src/cms-editorial-principal-boundaries.test-support.ts` (allow-lists consumed by reviewB-1's `cms-editorial-principals.test.ts` and
  `cms-editorial-principals-mutation.test.ts`; the committed versions of those two files already import it and the
  import-graph helper, so these untracked support files MUST be committed with this lane)
- edited `supabase/tests/phase_02_slice_11_races/010-review-assignment-race.mjs` (A7)
- edited `supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql` (tests 10 and 11 only; the rest of that file's diff is reviewA-2's no-effect work)
- edited `supabase/tests/phase_02_slice_11_schema_posture.sql`, `supabase/tests/phase_02_slice_11_rpc_review_evidence_audit.sql`,
  `supabase/tests/phase_02_slice_09_evidence_misc.sql` (policy inventories follow the new policies)
- edited `supabase/tests/phase_02_slice_11_helpers_settings.sql` (AC-091 behavioural test; fixture clears the leftover session)

Documentation (extension READMEs): `supabase/migrations/README.md` (169000 + the 017620 change), `supabase/tests/phase_02_slice_11_races/README.md`
(032 row; 010 A7), `supabase/tests/phase_02_slice_11_rpc_reads/README.md`, `supabase/tests/phase_02_slice_11_rpc_publication/README.md`,
`supabase/tests/phase_02_slice_11_schema/README.md`, `apps/worker/src/README.md` (new paragraph on the import-graph helper; the other
paragraph in that file is reviewA-2's). Prettier and eslint pass on all lane TypeScript, and `tsc -p apps/worker --noEmit` is clean.

## Verdict per finding

| Finding | Result |
| --- | --- |
| A-B1 / AC-069 revoke requires `cms.editor` | Fixed in `017620` (never deployed). RED then GREEN, pgTAP and race. |
| A-M7 / AC-083 executor `entry_unavailable` | NOT changed in code: binding DEC-158(d) overrides BE03b:1898. Needs a ledger limitation and a spec sentence (below). |
| A-M2 predicate RLS | Implemented: forward migration `20261010169000` + 57-assertion pgTAP. RED then GREEN. One scoping decision left open (below). |
| A-M14 / AC-051 | Three negatives added (revoked assignee, other revision, other entry) + positive controls. Proven non-vacuous by production mutants. |
| A-M11 / AC-084 | New registered race 032 with an overlap barrier. Proven by a production mutant (no `SKIP LOCKED`). |
| A-M10 / AC-091 | Source-text greps replaced by a spy-resolver behavioural test. Proven by two mutants. |
| A-M13 / AC-081 | Exact-ACL role walk (pgTAP) + static import-graph test (vitest). Proven by a grant mutant and five import mutants. |

### A-B1 / AC-069: revoke needs the owner's valid `cms.editor` grant

BE03b:1858 (CMS-03B-18, no revoke exception) and the tracker text of P2-S11-AC-069 require it; no DEC in 149..172 exempts revoke.
- RED (pgTAP) `reviewA1-red-alt.out`, TAP `alt-tap-111751-135005.tap`, `phase_02_slice_11_rpc_review_assign_refusals.sql`:
  `not ok 10 - an owner without a valid cms.editor grant is refused both a create and a revoke ...`, `have: P0001:capability_missing|00000:` /
  `want: P0001:capability_missing|P0001:capability_missing`; test 11 (lapsed grant) the same.
- RED (race) `reviewA1-race-red-010.out` / `reviewA1-red-010-20261011-111930.log`: runner `010-review-assignment-race.mjs` stops at
  `ASSERTION FAILED: A7: once the revocation commits, the waiting revoke re-proves the grantor under its locks and is refused capability_missing (ok)`.
- Fix: `017620` pass 1 and pass 2 now check `cms_person_holds_capability(owner, grantor, 'cms.editor')` for every action (the `if action = 'create'` guard removed; header comment updated).
- GREEN: final full pgTAP run (below) 25/25 in `assign_refusals`; race `reviewA1-final-010-review-assignment-race.log` 22 ok-lines, exit 0.
  The neighbouring `phase_02_slice_11_rpc_review_assign.sql` and the apispecs that revoke as an owner with a grant stay green.

### A-M7 / AC-083: not changed

BE03b:1898 says "A schedule whose entry is not `active` at execution is `cancelled` with `entry_unavailable`." DEC-158(d) (binding, DEC-149..163)
verified BE03b:1844 and 2073 and decided: cancellation happens only inside the review-invalidation transaction (a `pending` or `failed_retryable` schedule becomes
`cancelled`/`entry_unavailable` when the entry leaves `active`, BE03b:1866), and an `executing` schedule whose review was invalidated is `blocked`/`approval_invalidated`
(BE03b:1867), so `ScheduleExecutionResult` has no `cancelled`. The code does exactly that (`20261005017740_cms_execute_publication_schedule.sql` blocks;
`20261005017580_cms_review_invalidation.sql` cancels), and `phase_02_slice_11_rpc_publication_execute_refusals.sql` already pins "... is blocked approval_invalidated, never cancelled by the
executor (DEC-158(d)) [P2-S11-AC-083]" (an archived entry). Changing the executor would contradict a binding decision, so the code and tests stay.
Open for the orchestrator (not my files): set AC-083 partial with a DEC-158(d) limitation (the executor blocks; cancellation is the invalidation transaction's), cite the
`helpers_invalidation.sql` tests as the producer of `cancelled`/`entry_unavailable`, add AC-083 to the owner wording batch (it is not in STATE's list), and amend BE03b:1898
to "A `pending` or `failed_retryable` schedule whose entry leaves `active` is `cancelled` with `entry_unavailable` by the invalidation transaction; an `executing` schedule whose
entry is not `active` at execution is `blocked` with `approval_invalidated` (DEC-158(d))".

### A-M2: predicate RLS (BE03b:2015-2016 "RLS predicates use verified session, acting party, relationship/assignment, capability ..." and "positive/negative RLS tests")

Before: every Slice 11 table had one policy, the CMS RPC-context gate `using (cms_rpc_context_valid())` (a transaction flag, not a caller predicate).
`20261010169000` ADDS (never replaces the gate) RESTRICTIVE policies to the nine BE03b tables and `cms_command_accessibility_evidence`, plus the preflight registry:
- tenant (ALL, USING and WITH CHECK): `owner_id` = the acting party of the published session, whose actor must be a live member (re-resolved every statement through
  `cms_entry_tenant_visible`, so a forged setting reaches no more than a real member's scope). A transaction with NO published session (the service paths: sweep, recheck,
  verifier, takedown, migrations) is admitted by the gate alone as before; a half-published or malformed session is not "no session" and reads nothing.
- person (INSERT): review `submitted_by`, decision `reviewer_person_id`, schedule `created_by`, preview-token `person_id` = the session person.
- owner (assignments): INSERT needs `grantor_person_id` = the session person AND the immutable owner receipt; UPDATE (the only update is a revoke) needs the owner receipt.
- system (registry): INSERT/UPDATE/DELETE only under the Slice 09 system scope.
Four STABLE SECURITY DEFINER helpers (`cms_s11_session_unbound/_owner/_person/_is_owner`, owner `wejammin_cms_definer`, empty search_path, no API-role EXECUTE) are evaluated once per
statement through uncorrelated sub-selects; they read only identity tables, so no policy recurses.
- RED `reviewA1-red-alt.out` / `alt-tap-111751-135005.tap`: 19 of 49 `rls_session_scope` assertions fail before the migration, all for the right reason (the old gate shows everything), e.g.
  `not ok 24 - READ denied: a caller who is not a member of the acting party reads no row ...` `have: assignments=2;decisions=2;dependencies=1;evidence=1;reviews=2;schedules=1;snapshots=1;tokens=1;versions=1;registry=17`
  `want: assignments=0;decisions=0;...;registry=17`; `not ok 36 - INSERT denied: the owner's session cannot write a row owned by another party ...` (`have: ...=pass:23505 ... want: ...=rls`);
  also `schema_posture` test 5 and `evidence_audit` test 11 (policy inventories), and the INSERT/UPDATE person/owner assertions 38-49.
- GREEN: final full pgTAP run: `rls_session_scope` 57/57, `schema_posture` 8/8, `evidence_audit` 40/40, `phase_02_slice_09_evidence_misc` 50/50, and every real definer command suite (the whole Slice 11 set) still passes under the policies.
- LEFT OPEN (owner/record decision, not a defect found by tests): BE03b:2015 also lists "relationship/assignment, capability, risk, lifecycle, locale". The five review scopes (owner, submitter, reviewer assignee, entry assignee,
  publisher) and the capability checks stay in the definer bodies (404 vs 403 selection) and are NOT row predicates. Reason, recorded in the migration header: the same rows are read and written by definer
  code under a session that holds none of the five scopes (the decision recount, the invalidation triggers run in the transaction of whoever changed the entry or grant); a relationship filter on SELECT would hide a review from the very
  UPDATE that must invalidate it, and an UPDATE that matches no visible row is not an error, so an approval could survive a changed dependency. A decision record (DEC) that "tenant + exclusive-writer + owner-receipt row predicates, with relationship scopes in the definer bodies" satisfies BE03b:2015-2016
  is needed; I did not write one (memory capture is the orchestrator's).

### A-M14 / AC-051: reviewer read scope of CMS-03B-15

New `phase_02_slice_11_rpc_reads_workflow_reviewer_scope.sql` (18): positive controls (active assignee reads its revision) and the three negatives the ledger named: a revoked assignee, an active assignee of a review of
another revision (default and named revision), an assignee of another entry, each 403 `capability_missing` (not a concealed 404), distinct from a non-member's 404; the reads write nothing.
The production code (`cms_workflow_read_scopes`) was already correct; the proof is mutation:
- Mutant `revision_id = p_revision_id` -> `true` (`.lane-logs/reviewA1-mutants/zz_reviewA1_mutant_scope_revision.sql`, run in `reviewA1-green-full-alt.out`/`alt-tap-153857-1276001.tap`): tests 13, 14, 15 fail.
- Mutant `assignment_item.state = 'active'` -> `true` (`zz_reviewA1_mutant_scope_state.sql`, `reviewA1-green-iter4-alt.out`): `not ok 15 - a reviewer whose assignment was REVOKED holds no read scope ...`.
- GREEN: 18/18 on the final tree.

### A-M11 / AC-084: two overlapping sweepers

New race `032-schedule-sweeper-overlap-race.mjs` (registered; the runner list now has 22 entries). A test-probe AFTER UPDATE statement trigger on `cms_publication_schedules` parks a sweeper (by `application_name`) on an advisory
lock after its claim UPDATE and before its commit. D1: eight due schedules; sweeper A (batch 4) is parked; a third session sees exactly four rows locked by A and all eight still `pending/1`; sweeper B runs and COMPLETES while A
is still parked, claiming exactly A's complement; a third sweeper finds nothing; after the gate opens A commits exactly its four; the sets are disjoint, together all eight, eight distinct leases. D2: one executing schedule with an expired lease; A
is parked after recovering it; B completes without waiting and recovers nothing; after the gate opens exactly one recovery audit record exists (`failed_retryable`, attempt 1, version 3).
- Mutant (`zz_mutant_032.mjs`: the private claim function rewritten without `for update skip locked`): `reviewA1-red-mutant-032.out` exit 1 after 3 ok-lines at
  `ASSERTION FAILED: D1: sweeper B runs and COMPLETES while sweeper A is parked holding its row locks: it does not wait for A (SKIP LOCKED)`.
- GREEN: `reviewA1-final-032-schedule-sweeper-overlap-race.log` 15 ok-lines, exit 0.

### A-M10 / AC-091: behavioural settings-snapshot test

The two source-grep assertions of `phase_02_slice_11_helpers_settings.sql` became a spy test: `pg_temp.h11s_spy_run` replaces `cfg_resolve_effective_value` in the rolled-back transaction with a function that appends every request (key, consumerKey, partyId, at) to a
setting and answers a typed result (`cms.h11.b` has no source value version), and replaces the registry with keys registered OUT OF ORDER (`b, a, B`; `B` sorts before `a` bytewise but after it in a locale collation). It asserts the requests received (order `B, a, b`; consumer key
`cms.publication`; the owner party; the exact instant) and the returned array members `{ key, definitionVersionId, sourceValueVersionId, valueHash }` with a null source version for the contract default. The fixture also clears the transaction's leftover CMS session (the S10 fixture ran real commands in one transaction; in production each command is one) so the policies of `169000` do not confine the direct helper call.
The criterion's "command's server instant" is `clock_timestamp()` at the write tail (`20261010130000`); I read that as a server instant of the command and did not change it (the ledger entry may say so).
- Mutant consumer key `'cms.publication'` -> `'cms.publicationx'` in `cms_publication_settings_effective_values` (`zz_reviewA1_mutant_settings_consumer.sql`, `reviewA1-green-iter4-alt.out`): `not ok 31 - each registered key is resolved through cfg_resolve_effective_value with consumer key cms.publication ...`.
- Mutant ` collate "C"` removed from the same function (`zz_reviewA1_mutant_settings_collate.sql`, `reviewA1-green-full-alt.out`): tests 31 and 32 fail.
- GREEN: `helpers_settings` 35/35.

### A-M13 / AC-081: exact ACL and module boundary

DEC-156: the registered principal is the Worker service credential (`service_role`) plus the Worker module boundary.
- pgTAP `phase_02_slice_11_rpc_publication_sweep_grants.sql` (6): the whole `aclexplode(proacl)` of the four claim/execute functions (`platform_api` wrappers: definer + `service_role`; `platform_private`: definer only), the effective privilege of EVERY role of the cluster
  (including roles that merely inherit), the private functions reachable by the definer alone (`service_role` included), and the named browser/platform roles. Mutant `grant execute on platform_private.cms_claim_due_publication_schedules to authenticated` (`zz_reviewA1_mutant_grant.sql`,
  `reviewA1-green-full-alt.out`): tests 2, 4, 5, 6 fail.
- vitest `cms-publication-schedule-import-graph.test.ts` (7) on a TypeScript-parser import graph (`import-graph.test-support.ts`: value and type-only `import`, `export ... from`, `import = require`, `require()`, dynamic `import()`; prose, strings and packages are never edges):
  the port is imported by the sweep alone, the sweep by `index.ts` alone, the RPC-name constants are VALUE-imported by the port alone (the shared RPC type reads them type-only), the names module has no imports, no other non-test source of any workspace mentions the names or constants, and the names are spelled exactly once as string literals (any quoting).
  Helper proof `import-graph.test.ts` (5) on a throwaway tree.
- Mutants, out-of-tree mirror of the worker, web and package sources (`reviewA1-final-mirror-mutants.out`; baseline GREEN `reviewA1-final-mirror-baseline.out`, 7/7): M1 a new module value-importing the RPC-name constants -> 2 fail; M2 a second importer of the sweep -> 1 fails;
  M3 a re-export of the port by another module -> 1 fails; M4 the RPC name in a template literal elsewhere -> 2 fail; M5 the name mentioned in another workspace package -> 1 fails; baseline restored 7/7.
  The committed `cms-editorial-principals.test.ts` (14 tests) stays GREEN against M1 in the same mirror (`reviewA1-final-mirror-m1-committed-principals.out`), i.e. the finding was right that it was blind to the constants conduit; the new test is RED on it (`reviewA1-final-mirror-m1-vs-committed.out`).
- GREEN on the real tree: `reviewA1-final-worker-vitest.out` (4 files, 48 tests: import-graph 5, schedule import-graph 7, principals 14, principals-mutation 22).

## Final verification on the final tree (HEAD `1988e5ee` + uncommitted lane files)

- Full pgTAP, alt stack, 367 files / 13,959 assertions (`reviewA1-final-full-alt-202609.out`, TAP `alt-tap-202609-2484653.tap`): 13,955 pass, 4 fail. The 4 are all in
  `phase_02_slice_09_evidence_bench128.sql` (activate, create128, dry_run, submit p95 over 300 ms), run while this lane's races, vitest and mutation runs loaded the host. @@BENCH@@
  Per file of the lane: `rls_session_scope` 57, `rpc_publication_sweep_grants` 6, `rpc_reads_workflow_reviewer_scope` 18, `rpc_review_assign_refusals` 25, `helpers_settings` 35, `schema_posture` 8, `rpc_review_evidence_audit` 40, `slice_09_evidence_misc` 50: all ok, 0 not ok.
- Races, main stack, every Slice 11 runner (`reviewA1-final-races.out`, `reviewA1-final2-races.out`): 010 22, 011 18, 012 9, 013 22, 014 29, 015 8, 016 8, 020 12, 030 16, 031 26, 032 15 ok-lines, all exit 0. (Two resets failed with `supabase_storage_wejammin container is not ready: unhealthy` on a loaded host; 011 was rerun with reset retries, `reviewA1-final2-011-review-decision-race.log`.)
- Worker: `tsc -p apps/worker/tsconfig.json --noEmit` clean; eslint `--max-warnings=0` and prettier `--check` clean on the lane's TypeScript and READMEs.
- @@API@@

## Changed and new test titles

Changed (old -> new). The evidence ledgers cite the OLD titles; these ledger lines need the new ones (ledger files are not mine):
- `phase_02_slice_11_rpc_review_assign_refusals.sql` #10 (ledger `phase-02-slice-11-evidence-ledger-067-100.ts:318`, AC-069):
  "an owner without a valid cms.editor grant is refused a create (no grantor authority end) but may still revoke [P2-S11-AC-069]" (expected `P0001:capability_missing|00000:`)
  -> "an owner without a valid cms.editor grant is refused both a create and a revoke: 403 capability_missing (BE03b CMS-03B-18, review of finding A-B1) [P2-S11-AC-069]" (expected `P0001:capability_missing|P0001:capability_missing`).
- `010-review-assignment-race.mjs` A7 (three ok-lines -> four):
  "A7: a revoke BLOCKS on the authority rows held by an uncommitted revocation of the owner cms.editor grant" -> "A7: a revoke whose unlocked check passes BLOCKS on the authority rows held by an uncommitted revocation of the owner cms.editor grant";
  "A7: the waiting revoke still commits after the cms.editor grant was lost: a revoke needs the owner receipt only (...)" -> "A7: once the revocation commits, the waiting revoke re-proves the grantor under its locks and is refused capability_missing (...)";
  "A7: the assignment is revoked at version 2, the review version never moved and one event was emitted" -> "A7: the refused revoke left the assignment active at version 1 and wrote no event or idempotency reservation";
  new "A7: the very same request (same key) succeeds once the grant is restored: the assignment is revoked at version 2, the review version never moved and one event was emitted (...)".
- `phase_02_slice_11_helpers_settings.sql` (plan stays 35), AC-091 (ledger `...-067-100.ts:4386` and `:4392`):
  "the evaluation goes through cfg_resolve_effective_value with consumer key cms.publication [P2-S11-AC-091]" -> "each registered key is resolved through cfg_resolve_effective_value with consumer key cms.publication, for the owner party and the given instant, in ascending bytewise order (observed on a spy resolver) [P2-S11-AC-091]";
  "registered keys are evaluated in ascending bytewise order [P2-S11-AC-091]" -> "keys registered out of order (b, a, B) come back in ascending bytewise order (B, a, b) as { key, definitionVersionId, sourceValueVersionId, valueHash } members, a contract default carrying a null source value version [P2-S11-AC-091]".
- `phase_02_slice_11_schema_posture.sql` #5 (ledger `...-101-122.ts:4079`, AC-119):
  "posture: each Slice 11 table has exactly one policy, the CMS RPC-context gate [P2-S11-AC-119]" -> "posture: each Slice 11 table has exactly its CMS RPC-context gate plus its named restrictive session-scope policies (tenant, exclusive-writer, owner, system), never an unnamed one - proved row by row in phase_02_slice_11_rls_session_scope.sql [P2-S11-AC-119]".
- `phase_02_slice_11_rpc_review_evidence_audit.sql` #11 (AC-101):
  "RLS is enabled and forced, anon / authenticated / service_role hold no privilege and the only policy is the CMS RPC-context gate [P2-S11-AC-101]" -> "RLS is enabled and forced, anon / authenticated / service_role hold no privilege and the policies are the CMS RPC-context gate plus the restrictive session-scope (tenant) policy [P2-S11-AC-101]".
- `phase_02_slice_09_evidence_misc.sql` #45 "every other cms_ policy is a RESTRICTIVE session-scope policy (AND-ed with the RPC gate) that calls the session-resolving helper [P2-S09-AC-181]": title unchanged; the policy-name regex also admits the six Slice 11 writer-policy suffixes and the `cms_s11_session_*` helpers (it still fails an unnamed or helper-less restrictive policy).
- Not changed in meaning: `phase_02_slice_11_rpc_publication_execute_refusals.sql` "an executing schedule whose review was invalidated ... never cancelled by the executor (DEC-158(d)) [P2-S11-AC-083]".

New:
- `phase_02_slice_11_rpc_review_assign_refusals.sql` #11: "an owner whose cms.editor grant has lapsed (its valid_through day passed) is refused both a create and a revoke: 403 capability_missing [P2-S11-AC-069]".
- `phase_02_slice_11_rpc_publication_sweep_grants.sql` (6) and `phase_02_slice_11_rpc_reads_workflow_reviewer_scope.sql` (18): titles in the final TAP (`alt-tap-202609-2484653.tap`); the P2-S11-AC-081 and P2-S11-AC-051/053 ones are quoted in the sections above.
- `032-schedule-sweeper-overlap-race.mjs` (15): D1 x11, D2 x4 ("D1: sweeper A is parked inside its transaction on the gate ..." through "D2: once the gate opens the lease is recovered exactly once ..."), all carrying P2-S11-AC-084 in the file header; the runner prints no marker, so the ledger cites them by `ok -` label.
- `import-graph.test.ts` (5) and `cms-publication-schedule-import-graph.test.ts` (7): see above.
- `phase_02_slice_11_rls_session_scope.sql` (57; items 1-9 are the shared world fixture):

1. CMS-03B-10 closed capability registry admits cms.author and cms.editor at version 1
2. P2-S10-RPC fixture content type draft is created with a schema artifact hash
3. P2-S10-RPC fixture schema version is active and compiled with activation evidence
4. P2-S10-RPC fixture draft entry seeds one revision, two assignments and a value
5. S11 fixture: two entries, three revisions with two distinct authors and seventeen reviewer persons exist
6. h11 world: the h11doc type compiles with nine fields (title, taxonomy, media, rich_text, object, no_fallback, three relations)
7. h11 world: the production editorial workflow-policy evidence function answers for the h11doc version (no stub)
8. h11 world: the builders resolve stable field ids and create an entry with a draft revision
9. R11 world: nine real actors, the receipt-derived owner and the standing reviewer, specialist and publisher grants exist
10. fixture: the probe role does not bypass RLS
11. fixture: all nine tenant tables and the registry hold rows (the world builds a review, an assignment, a decision, a dependency, a snapshot, a schedule, a publication, a token and an accessibility audit summary)
12. every tenant-scoped Slice 11 table carries a RESTRICTIVE policy for ALL commands that reads and re-checks the verified session party in USING and WITH CHECK [P2-S11-AC-119]
13. the exclusive writers are bound by RESTRICTIVE INSERT policies (submitter, decider, creator, minter, grantor) and the assignment revoke by a RESTRICTIVE UPDATE policy [P2-S11-AC-119]
14. the release-seeded preflight registry is written only under the system scope: RESTRICTIVE INSERT, UPDATE and DELETE policies [P2-S11-AC-119]
15. the CMS RPC-context gate is still present on all ten tables: the session policies are in addition to it, never instead [P2-S11-AC-119]
16. the four session-scope helpers exist as STABLE SECURITY DEFINER functions of the CMS definer with an empty search_path and no EXECUTE for anyone else [P2-S11-AC-119]
17. exactly one overload of each session-scope helper exists [P2-S11-AC-119]
18. row-level security stays enabled and forced on all ten tables [P2-S11-AC-119]
19. READ allowed: the receipt-derived owner acting in its party reads every row of the nine tenant tables and the registry [P2-S11-AC-007]
20. READ allowed: the submitter (cms.editor) reads the party's rows [P2-S11-AC-013]
21. READ allowed: an assigned reviewer reads the party's rows (the five review scopes are the RPC layer's: the recount a decision runs must see every assignment and decision) [P2-S11-AC-013]
22. READ allowed: the publisher reads the party's rows [P2-S11-AC-019]
23. READ allowed at the row level: a confirmed member with no CMS capability reads the party's rows (its 403 is the definer RPCs' capability check, proved in their suites) [P2-S11-AC-025]
24. READ denied: a caller who is not a member of the acting party reads no row of any tenant table (the code-owned registry stays readable) [P2-S11-AC-007]
25. READ denied: the owner acting in ANOTHER party (its own person party) reads no row of the organization [P2-S11-AC-031]
26. READ denied: a member whose membership tenure ended reads no row (the predicate re-resolves the membership on every statement) [P2-S11-AC-013]
27. READ allowed again: once the tenure is confirmed again the same session reads the party's rows (the verdict is per statement, not remembered) [P2-S11-AC-013]
28. READ denied: a session published for only one of actor and party, or with a malformed party, is not "no session": it reads nothing [P2-S11-AC-031]
29. READ allowed: a transaction with NO published session (the service paths: sweep, recheck, verifier, takedown) is admitted by the RPC-context gate alone, as before [P2-S11-AC-019]
30. READ denied: the owner's own session sees nothing outside a CMS RPC context - the gate still applies in addition to the session policy [P2-S11-AC-025]
31. WRITE allowed: the owner's session updates every row of its party in all nine tenant tables [P2-S11-AC-007]
32. WRITE denied: a non-member acting in the party updates no row of any tenant table [P2-S11-AC-007]
33. WRITE denied: the owner acting in another party updates no row of the organization [P2-S11-AC-031]
34. WRITE denied: a non-member deletes no row of any tenant table [P2-S11-AC-007]
35. WRITE allowed: with no published session (a service path) the gate alone admits the update, as before [P2-S11-AC-019]
36. INSERT denied: the owner's session cannot write a row owned by another party into any tenant table (WITH CHECK) [P2-S11-AC-031]
37. INSERT allowed: a row of the session's own party passes row-level security where no exclusive writer is bound (dependencies, snapshots, publication versions) [P2-S11-AC-019]
38. INSERT denied: a review is written for the session person only - the submitter cannot attribute a submission to someone else [P2-S11-AC-013]
39. INSERT allowed: the same review naming the session person passes row-level security [P2-S11-AC-013]
40. INSERT denied: a decision is written for the session person only - a reviewer cannot record a decision as another reviewer [P2-S11-AC-013]
41. INSERT allowed: the same decision naming the session reviewer passes row-level security [P2-S11-AC-013]
42. INSERT denied: a schedule is created for the session person only [P2-S11-AC-019]
43. INSERT allowed: the same schedule naming the session publisher passes row-level security [P2-S11-AC-019]
44. INSERT denied: a preview token is minted for the session person only [P2-S11-AC-025]
45. INSERT allowed: the same token naming the session person passes row-level security [P2-S11-AC-025]
46. INSERT denied: a member who is not the receipt-derived owner cannot write a reviewer assignment, even naming itself the grantor (CMS-03B-18 is owner-only) [P2-S11-AC-013]
47. INSERT denied: the owner cannot attribute an assignment to another grantor [P2-S11-AC-013]
48. INSERT allowed: the owner naming itself the grantor passes row-level security [P2-S11-AC-013]
49. UPDATE denied: a member who is not the owner revokes (updates) no reviewer assignment [P2-S11-AC-013]
50. UPDATE allowed: the owner updates (revokes) the party's reviewer assignments [P2-S11-AC-013]
51. REGISTRY INSERT denied: no human session may write the release-seeded preflight registry [P2-S11-AC-119]
52. REGISTRY INSERT denied: a transaction with no session and no service-role JWT is not the system scope [P2-S11-AC-119]
53. REGISTRY INSERT allowed under the system scope (no human session, verified service-role JWT) [P2-S11-AC-119]
54. REGISTRY UPDATE and DELETE touch no row for a human session [P2-S11-AC-119]
55. REGISTRY UPDATE reaches every row under the system scope [P2-S11-AC-119]
56. composition: the real CMS-03B-07 command still schedules an approved review as the publisher under the session policies, attributing the schedule to the publisher [P2-S11-AC-019]
57. composition: the same command by a non-member is still the concealed NOT_FOUND under the session policies [P2-S11-AC-019]

## Spec lines satisfied

BE03b:1858 (CMS-03B-18 owner + valid `cms.editor`, create and revoke), BE03b:2015-2016 (RLS predicates on verified session / acting party / ownership; positive and negative RLS tests; schema-qualified definers with empty search_path),
BE03b:2038 and the reviewer scope of CMS-03B-15 (A-M14), BE03b CMS-03B-20 (claim `FOR UPDATE SKIP LOCKED`, two sweepers never claim or recover the same schedule; EXECUTE to the Worker principal only, DEC-156), BE03b:1829 (E7 evaluation order, consumer key, member shape).

## Left open

1. AC-083 / BE03b:1898 vs DEC-158(d): ledger limitation and a spec sentence (above). Not in STATE's owner wording batch.
2. Row-predicate scope of A-M2: whether tenant + exclusive-writer + owner-receipt row predicates (relationship scopes in the definer bodies) satisfy BE03b:2015 needs a DEC; if the owner wants relationship predicates on SELECT, they cannot be added without breaking the invalidation paths (see A-M2).
3. Ledger citations to refresh (not my files): AC-069 (`...-067-100.ts:318`), AC-091 (`:4386`, `:4392`), AC-119 (`...-101-122.ts:4079`); add the new files as citations for the RLS member of AC-007/013/019/025/031 clause 1 (`rls_session_scope`), AC-051 clause 3 (`reviewer_scope`), AC-081 clause 0 (`sweep_grants`, the two vitest files), AC-084 clause 2 (race 032).
4. Commit with this lane: the untracked `apps/worker/src/import-graph.test-support.ts`, `import-graph.test.ts` and `cms-editorial-principal-boundaries.test-support.ts` are imported by the already committed `cms-editorial-principals*.test.ts`.
5. A-m16/A-m... items of the minor table were not in this lane.
