# Lane finisher report (2026-10-11)

Items: AC-083 / A-M7 (executor cancels an unavailable entry's schedule), A-M2 (relationship / assignment / capability row predicates on
SELECT), and the one full real-API suite plus the Slice 11 races (replacing reviewA-1's unrecorded API run).
Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`. The lane started at HEAD `ad28fce9`; the
orchestrator has committed other lanes since (`1e2f03be` at the end). I ran no `git add/commit/stash/checkout/reset/restore`; nothing of
this lane is staged or committed. No decision record or memory entry was written (orchestrator's). tests/e2e, the e2e lane's files and the
Slice 12 files were not touched.

Logs are under `/home/rob/.codex/worktrees/phase2-slice11/WeJammin/.lane-logs/` (ignored by git).

## Files

New, production (forward range `20261010170000`-`20261010170999`; none of them edits an installed migration):

- `supabase/migrations/20261010170000_cms_schedule_cancel_guard.sql` the schedule state guard admits ONE more transition,
  `executing -> cancelled`, only with `reason_code = 'entry_unavailable'` (MD5-pinned baseline `be0cf18d...` / `904d5751...`, one anchor,
  inverse-proved, owner / ACL / search_path preserved).
- `supabase/migrations/20261010170100_cms_schedule_cancel_executor.sql` new `cms_schedule_cancel` and `cms_schedule_cancelled_result`
  (owner `wejammin_cms_definer`, no API-role EXECUTE) and `cms_execute_publication_schedule` changed by exactly three anchors on the
  latest installed body (pinned `0fbd3903...` source, `4507634e...` definition, inverse-proved, metadata preserved).
- `supabase/migrations/20261010170200_cms_slice11_relationship_rls.sql` five STABLE SECURITY DEFINER helpers
  (`cms_s11_review_readable`, `_assignment_readable`, `_workflow_readable`, `_snapshot_readable`, `_token_readable`) and nine restrictive
  `FOR SELECT` policies `<table>_session_relationship`.

Changed, production:

- `packages/contracts/src/cms-editorial/internal-rpc.ts` `ScheduleExecutionResultSchema`: five outcomes; `cancelled` carries exactly
  `entry_unavailable` and no publication evidence; `blocked` never carries `entry_unavailable` (the table CHECK already forbade it).
- `apps/worker/src/cms-publication-schedule-sweep.ts` `cms_schedule_blocked_total{reason}` is incremented only for outcome `blocked`; a
  cancellation is `cms_schedule_attempt_total{outcome="cancelled"}` plus the closed reason as a log attribute. No new metric name (BE03b
  lists none for cancellation).

New tests: `supabase/tests/phase_02_slice_11_rpc_publication_execute_entry_unavailable.sql` (32 assertions, AC-083).

Changed tests / runners:
`supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql` (35 -> 36), `phase_02_slice_11_schedules_schema.sql` (84 -> 87),
`phase_02_slice_11_rls_session_scope.sql` (57 -> 68), `phase_02_slice_11_schema_posture.sql`, `phase_02_slice_11_rpc_review_evidence_audit.sql`,
`phase_02_slice_09_evidence_misc.sql` (policy / helper inventories follow the new policies), `phase_02_slice_11_schedule_precision.sql` (guard
pin, see below), `supabase/tests/phase_02_slice_11_races/014-publication-execute-race.mjs` (new scenario E9, 29 -> 35 ok-lines),
`supabase/tests/phase_02_slice_11_rpc_publication/090-race-fixture.sqlinc` (two more approved reviews / schedules, tags `ex-arch-a`, `ex-arch-b`),
`packages/contracts/src/cms-editorial/internal-rpc.test.ts`, `apps/worker/src/cms-publication-schedule-sweep.test.ts` (one new test),
`tests/postgrest/phase-02-slice-11-sweep-composition.apispec.ts` (one new real-Worker case).

Documentation (extension READMEs): `supabase/migrations/README.md`, `supabase/tests/phase_02_slice_11_rpc_publication/README.md`,
`supabase/tests/phase_02_slice_11_schema/README.md`, `supabase/tests/phase_02_slice_11_races/README.md` (prettier re-flowed the tables),
and the fixture counts in the header comment of `infra/database-races/publication-kit.mjs` (comment only).

## AC-083 / A-M7: the executor cancels `entry_unavailable`

Ruling applied: BE03b:1898 governs; DEC-158(d) is superseded for this one case only. Everything else DEC-158(d) said stands: a superseded
revision, a stale manifest or a lapsed approver of an ACTIVE entry still BLOCKS the executing schedule `approval_invalidated`.

- Fix. After the fence (state, lease, version CAS) and the global locks, the executor reads the entry lifecycle under the entry row's
  `FOR SHARE` lock (position 0, so an archive or hold waits for the execution) and, BEFORE the review is re-read, an entry that is not
  `active` cancels the schedule in the same transaction: version CAS + 1, lease released, attempt count unchanged, reason
  `entry_unavailable`, one audit record `cms.publication.schedule.cancel` / `CMS_PUBLICATION_SCHEDULE_CANCELLED` (no actor), no outbox
  event (`cms.publication.changed.v1` is emitted only by an executed publication; the lifecycle invalidation already emitted the review
  event), no lineage row, no accessibility summary (no proof was verified; same as the other early returns). The result is
  `{ scheduleId, outcome: 'cancelled', reasonCode: 'entry_unavailable', publicationVersionId: null, actualUtc: null, deviationSeconds: null }`.
  By construction (not separately tested) the check also covers the lease-recovery path: an expired lease returns the schedule to
  `failed_retryable` and the next claim's execution cancels it, since the check does not depend on the attempt count.
- RED (pgTAP, through the real claim and execute RPCs; entry made unavailable AFTER the claim). `.lane-logs/finisher-red-1.out`, TAP
  `.lane-logs/alt-tap-221046-105937.tap`: `phase_02_slice_11_rpc_publication_execute_entry_unavailable.sql` 18 of 32 fail
  (`not ok 14 - an executing schedule whose entry was archived after the claim is answered cancelled entry_unavailable ...`, 15, 16, 18-23;
  `not ok 32 ... have: executing/2/0/-/lease want: cancelled/3/0/entry_unavailable/-`; the helper tests `have: 42883` = function does not
  exist); `execute_refusals` `not ok 13 - ... cancelled entry_unavailable by the executor`; `schedules_schema` `not ok 81 - schedule: the
  executor cancels an executing schedule whose entry is no longer active ...` (the guard refused `executing -> cancelled`). At HEAD the same
  scenario produced `blocked / approval_invalidated` (the old assertion in `execute_refusals` pinned exactly that).
- RED (vitest) `.lane-logs/finisher-red-ts.out`: `internal-rpc.test.ts` `AssertionError: cancelled: expected false to be true`; the sweep
  test `expected '[[{"attributes":{"checker_state":"fai...' to contain '"cms_schedule_attempt_total{outcome=\"cancelled\"}":1'` (the
  reply was a contract fault, `execute_failed`).
- GREEN: `.lane-logs/finisher-green-2.out` (TAP `alt-tap-222155-181472.tap`) 9 files, 422 tests, all pass; `finisher-green-ts.out` 2 files, 29
  tests; neighbours `finisher-green-ts2.out` 50 files, 771 tests (`packages/contracts/src/cms-editorial` + the worker CMS / import-graph /
  principal-boundary suites). Final full pgTAP (below) passes.
- Race (genuine concurrency, GREEN only: it was written after the fix, so it has no RED run): `014` scenario E9. E9a an archive BLOCKS behind an
  execution parked right before its lineage insert (entry row FOR SHARE held); the execution completes, then the archive commits; nothing is
  published after the archive. E9b the execution BLOCKS at its FOR SHARE behind an archive that updated the lifecycle and has not committed;
  once it commits the execution answers `cancelled / entry_unavailable`, schedule `cancelled/3/0/entry_unavailable/-`, no lineage row, no
  event, exactly one cancel audit record, no block record. `.lane-logs/finisher-races/race-014-publication-execute-race.log`.
- Real Worker, real PostgREST: `tests/postgrest/phase-02-slice-11-sweep-composition.apispec.ts` new case "an entry archived after the actual
  claim cancels the schedule entry_unavailable through the real Worker sweep with exact effects" (the barrier of `tick()` archives the entry
  between the claim and the execute; strict `ScheduleExecutionResultSchema` parse; effects: one schedule row changed, +1 audit record, no
  outbox / lineage / summary / idempotency change). Passed: `.lane-logs/api-232033.log` line 920 (verbose run, 4 of 4).

Titles (evidence ledgers cite them; old -> new):

- `execute_refusals.sql` (one assertion became two):
  - OLD `an executing schedule whose review was invalidated (a superseded revision, an unavailable entry) is blocked approval_invalidated, never cancelled by the executor (DEC-158(d)) [P2-S11-AC-083]`
  - NEW `an executing schedule whose review was invalidated by a superseding revision of an ACTIVE entry is blocked approval_invalidated, never cancelled by the executor [P2-S11-AC-083]`
  - NEW `an executing schedule whose entry was archived after the claim is cancelled entry_unavailable by the executor (BE03b CMS-03B-20, which supersedes DEC-158(d) for this case) [P2-S11-AC-083]`
- `schedules_schema.sql`:
  - OLD `schedule: an executing schedule is never cancelled, an invalidated approval blocks it (DEC-158 d) [P2-S11-AC-122]` (expected CONFLICT)
  - NEW `schedule: an executing schedule is cancelled only for an unavailable entry; an invalidated approval blocks it, never cancels it (BE03b CMS-03B-20, DEC-158 d) [P2-S11-AC-122]` (same CONFLICT: the approval_invalidated reason is still refused)
  - added `schedule: a fifth schedule is accepted for the executor cancellation`, `schedule: the claim moves the fifth schedule to executing`, `schedule: the executor cancels an executing schedule whose entry is no longer active, reason entry_unavailable, lease released, attempts unchanged` (each `[P2-S11-AC-122]`)
- `schedule_precision.sql` test 4: OLD `metadata: immutable schedule guard source and definition remain byte-exact` (pinned the baseline md5 of the guard,
  which this change must alter) -> NEW `metadata: immutable schedule guard source and definition remain byte-exact apart from the one executing -> cancelled (entry_unavailable) transition of 20261010170000`.
  The baseline hashes `be0cf18d...` / `904d5751...` stay pinned: the assertion undoes the single anchor and requires the baseline back byte for byte.
- New file, all new titles (32), tag `[P2-S11-AC-083]`: `phase_02_slice_11_rpc_publication_execute_entry_unavailable.sql`.
- `internal-rpc.test.ts`: title unchanged (`types the execution result with the closed outcome and reason coupling`), content changed: five outcomes, `cancelled`
  accepted only with `entry_unavailable` and no evidence, refused with null / `approval_invalidated` / `preflight_failed` / evidence; `blocked` + `entry_unavailable` refused.
  (Old: `cancelled` was asserted refused.)
- `cms-publication-schedule-sweep.test.ts` new: `accepts the executor cancelling a schedule whose entry is no longer active and counts it as an attempt outcome, never as a block (BE03b CMS-03B-20)`.

## A-M2: relationship / assignment / capability predicates on SELECT

Per table (restrictive `FOR SELECT`, `<table>_session_relationship`, in addition to the RPC gate and the tenant policy; the RPCs' own functions are the oracle):

| table | a session reads the row iff |
| --- | --- |
| `cms_editorial_reviews` | `cms_editorial_review_scopes` is non-empty (owner receipt, submitter, non-revoked reviewer, entry assignee, owner-party publisher): the SAME function the CMS-03B-16 read uses |
| `cms_editorial_decisions`, `cms_editorial_review_dependencies` | the row's review is readable (the decider-only `reason` is a column of the projection, not a row predicate) |
| `cms_editorial_review_assignments` | the owner (receipt), or the assignee reading its OWN non-revoked assignment |
| `cms_publication_schedules` | `cms_workflow_read_scopes` on the schedule's revision is non-empty (CMS-03B-15: entry assignee, owner-party publisher, active reviewer of a review of the revision) over an entry of the party that is active or held |
| `cms_publication_versions` | the same workflow scope on the entry (a reviewer of a review of ANY revision, as CMS-03B-15 serves the entry's publications) |
| `cms_command_accessibility_evidence` | the same workflow scope on the summary's revision |
| `cms_publication_settings_snapshots` | a workflow participant: owner receipt, standing `cms.author` / `cms.editor` / `cms.publisher` / `cms.reviewer`, or a non-revoked reviewer assignee (party-level evidence with no entry or review of its own: my reading, not spelled out in BE03b) |
| `cms_preview_tokens` | nobody ("PreviewToken is never directly selectable"), also not a session-less service read |

A transaction with no published session (the service paths) keeps the gate-and-tenant admission, except for tokens. The preflight registry has no relationship.

- Who it binds, and the decision this needs (not a defect found by tests): every policy admits `current_user = 'wejammin_cms_definer'` through a
  `CASE` (so the definer never evaluates a relationship helper: no recursion) and holds the definer to the TENANT predicate only. The table ACL
  is `postgres` (bypasses RLS) and the definer, so today the relationship predicates bind the probe role of the tests and any future grantee,
  and the definer paths work exactly as before. Reason, shown by a live mutant in the test (rolled back): bind the definer too and the
  lifecycle cascade run under a session that holds no scope on the review ends `archived/approved` - the entry is archived and the approval
  SURVIVES (PostgreSQL applies a SELECT policy to every UPDATE that reads a column and an UPDATE that matches no row is not an error) - and the
  RPCs lose the 403 versus 404 split (a visible review without a scope would be concealed). Making the definer relationship-bound would need the
  recount, invalidation, sweep and 404/403 bodies to run under a separate, deliberately unfiltered role; I did not do that.
- RED (`finisher-red-1.out`, TAP `alt-tap-221046-105937.tap`): `rls_session_scope` failed the reads, e.g. `not ok 21 - READ scoped: the submitter /
  entry assignee reads ...` `have: assignments=2;decisions=2;dependencies=2;evidence=1;reviews=3;schedules=1;snapshots=1;tokens=1;versions=1;registry=17`
  `want: assignments=0;decisions=2;dependencies=1;evidence=1;reviews=2;schedules=1;snapshots=1;tokens=0;versions=1;registry=17`;
  `not ok 25 - READ denied: a confirmed member with no CMS capability ...` (read everything, wanted nothing); `not ok 28 - READ equals the RPC ...`
  (the outsider read all three reviews, the RPC serves none); `not ok 66 - composition ... capability_missing|<all three review ids>`;
  `schema_posture` test 5 and `evidence_audit` test 11 (policy inventories). (Failures 39, 43, 63 in that run were my own first version of the
  UPDATE helper hitting a CHECK; corrected before the fix, not a finding.)
- GREEN: `finisher-green-2.out` (above) and the final full run: `rls_session_scope` 68/68.
- Test design (`phase_02_slice_11_rls_session_scope.sql`): fixture extended with `rls3` (an open review submitted by rvB, no reviewer assignment, the editor's entry
  assignment revoked) so the roles separate; per-role counts for owner, editor, rvA, rvB, publisher, outsider, stranger over all nine tables; the real read RPCs are the
  oracle (`READ equals the RPC` for reviews, for schedules and publications, and for decisions); tenure-ended and half-published sessions; a revoked assignment narrows
  the reviewer; the session-less service path; the gate; the definer exemption; the 403 composition; the cascade composition; the live mutant.
- Titles OLD -> NEW (`rls_session_scope.sql`; only the reads and two writes changed, the rest is unchanged and the seven structure / write titles keep their text):
  - `READ allowed: the receipt-derived owner acting in its party reads every row of the nine tenant tables and the registry [P2-S11-AC-007]` -> `READ scoped: the receipt-derived owner reads all three reviews (owner scope), both assignments, both decisions, both dependency rows and the workflow rows it is assigned to, and no preview token [P2-S11-AC-007]`
  - `READ allowed: the submitter (cms.editor) reads the party's rows [P2-S11-AC-013]` -> `READ scoped: the submitter / entry assignee reads the two reviews it submitted or is assigned to (not the third, whose entry assignment was revoked), their decisions and dependency rows, no assignment and no token [P2-S11-AC-013]`
  - `READ allowed: an assigned reviewer reads the party's rows (the five review scopes are the RPC layer's: ...) [P2-S11-AC-013]` -> `READ scoped: an assigned reviewer reads the two reviews it is assigned to and their rows, and its own two assignments, never the unassigned review [P2-S11-AC-013]`
  - `READ allowed: the publisher reads the party's rows [P2-S11-AC-019]` -> `READ scoped: the owner-party publisher reads all three reviews (publisher scope) and the workflow rows, but no assignment and no token [P2-S11-AC-019]`
  - `READ allowed at the row level: a confirmed member with no CMS capability reads the party's rows (its 403 is ...) [P2-S11-AC-025]` -> `READ denied: a confirmed member with no CMS capability and no assignment reads no row of any tenant table (the code-owned registry stays readable) [P2-S11-AC-025]`
  - `READ allowed again: once the tenure is confirmed again the same session reads the party's rows ... [P2-S11-AC-013]` -> `READ scoped again: once the tenure is confirmed again the same session reads its scoped rows (the verdict is per statement, not remembered) [P2-S11-AC-013]`
  - `READ allowed: a transaction with NO published session (...) is admitted by the RPC-context gate alone, as before [P2-S11-AC-019]` -> same text `... as before - except that a preview token is never directly selectable [P2-S11-AC-019]`
  - `WRITE allowed: the owner's session updates every row of its party in all nine tenant tables [P2-S11-AC-007]` -> `WRITE allowed: the owner's session updates the rows of its party that it may also read in all nine tenant tables (an UPDATE that reads a column is narrowed by the relationship policy: no preview token) [P2-S11-AC-007]`
  - `WRITE allowed: with no published session (a service path) the gate alone admits the update, as before [P2-S11-AC-019]` -> `... as before - a preview token is never directly selectable, so a reading UPDATE touches none [P2-S11-AC-019]`
  - `the four session-scope helpers exist as STABLE SECURITY DEFINER functions ...` -> `the nine session-scope helpers (four tenant / person / owner, five relationship) exist ...`
  - new: `every tenant-scoped Slice 11 table carries a RESTRICTIVE SELECT policy for the relationship / assignment / capability scope that exempts only the CMS definer role ...`; `READ scoped: a submitter with no assignment reads only the review it submitted ...`; `READ equals the RPC: the reviews ...`, `... the schedules and publication rows ...`, `... a role reads a decision exactly when it reads the review ...`; `READ narrows on revocation: ...`; `READ denied for everyone: a preview token is never directly selectable ...`; `READ by the CMS definer role is the tenant: ...`; `composition: a member with no scope still gets the 403 capability_missing ...`; `composition: the lifecycle cascade invalidates a review the changing session holds no scope on ...`; `negative control: with the definer bound to the relationship predicate ... the approval SURVIVES ...`.
  - `exactly one overload of each session-scope helper exists` keeps its title (count 4 -> 9).
  - `schema_posture.sql` test 5: `... named restrictive session-scope policies (tenant, exclusive-writer, owner, system) ...` -> `(tenant, relationship, exclusive-writer, owner, system)`;
    `rpc_review_evidence_audit.sql` test 11: `... plus the restrictive session-scope (tenant) policy [P2-S11-AC-101]` -> `... session-scope (tenant) and relationship (workflow read scope) policies [P2-S11-AC-101]`.

## Full verification (final tree; HEAD `1e2f03be` + this lane's uncommitted files)

- Full pgTAP, alt stack: `finisher-full-alt-2.out`, TAP `alt-tap-231045-608207.tap`: 368 files, 14,006 assertions, ALL PASS (the earlier full run,
  `finisher-full-alt-1.out`, found two of my own inventories: `ev_eb_publication_scope` test 3 (a helper name matched its `preview_token` pattern: renamed
  `cms_s11_token_readable`) and `schedule_precision` test 4 (the guard pin, above); both fixed and re-run).
- Real-API suite, once, fresh main-stack reset via the lane runner under `flock -s /tmp/wejammin-quiet.lock`: `.lane-logs/api-222509.log`:
  73 files, 869 tests, all pass, 1882.88 s (the new composition case is among them; a verbose single-file rerun, `.lane-logs/api-232033.log`, shows it).
- Slice 11 races, main stack, each runner right after a fresh reset (`finisher-races.out`, logs in `.lane-logs/finisher-races/`), all exit 0:
  010 22, 011 18, 012 9, 013 22, 014 35 (was 29: E9 adds 6), 015 8, 016 8, 020 12, 030 16, 031 26, 032 15 ok-lines.
- Worker / contracts: `tsc -p apps/worker` and `tsc -p packages/contracts` clean; eslint `--max-warnings=0` and prettier clean on every changed TypeScript, `.mjs`
  and README (the only prettier warning in the touched directory is `030-settings-snapshot-race.mjs`, which this lane did not edit).

## Left open

1. Decision records (orchestrator): (a) AC-083: BE03b:1898 governs, DEC-158(d) superseded for the executor-finds-entry-unavailable case only; BE03b:1844 / 1867 / 2073
   wording about an executing schedule being left to finish and blocked should say "unless the entry is not active, then cancelled `entry_unavailable`"; the
   `ScheduleExecutionResult` has five outcomes. (b) A-M2: relationship predicates bind every role except the CMS definer role, which keeps the tenant predicate and the
   write predicates; the snapshot rule (workflow participants), assignments (owner or own non-revoked assignee), evidence and publications (workflow read scope) and
   tokens (never) are my readings of BE03b:2012-2016 where it is silent.
2. Ledger citations to refresh (not my files): every old title above (AC-083 at `tests/contracts/phase-02-slice-11-evidence-ledger-067-100.ts` lines 2190, 2296, 2786, 3054 and
   `-035-066.ts:1461`; AC-122 at `-101-122.ts:4889`; the RLS member titles of AC-007 / 013 / 019 / 025 / 031 and AC-119); add the new file and the E9 race, the apispec case.
3. `docs/runbooks/platform/cms-publication.md` row CMS-03B-20 does not mention the cancellation; I did not edit it (outside my files; `phase-02-slice-11-runbook.test.ts` pins it).
4. E9 and the apispec case were written after the fix (GREEN only); the RED proof of the behaviour is the pgTAP and vitest RED above. I did not run an E9 mutant
   (reading the lifecycle before the FOR SHARE lock would make E9b fail; not exercised).
5. The main stack was left at the state of the last lane-api run (fixtures committed); the canonical gate resets first.
