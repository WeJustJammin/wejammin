# Lane gates report (Slice 11, 2026-10-11)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, lane started at HEAD `a2df2469` (HEAD was `ab805427` at the end; this lane staged,
committed, stashed and reset nothing). Logs: `.lane-logs/api-*.log` (DB API runs, named below), `.lane-logs/gates/*.log` (unit runs and
the RED reproductions). Diagnostic being answered: `.lane-logs/claude-diag-20261010-223620/` (HEAD `000e4739`).

## Summary

| Item | Outcome |
| ---- | ------- |
| 1 SEC-1 registry and S09 caller test | `cms_dependency_recheck_run` was the ONLY unlisted claim reader; registered as a `service-principal` entry (actorless service_role, DEC-156). `cms_dependency_recheck_resolve_event` and `cms_takedown_preview_tokens` read no claims, so they are correctly NOT in the manifest. S09 caller test counts updated (38 to 54 supporting). |
| 2 Isolation re-run | Every file in the list PASSES in isolation on a fresh reset. All the diagnostic failures other than the claim-gate drift were contamination from the timed-out mutation test. |
| 3 Unit failures | documentation-boundaries (missing READMEs, not the BOUNDARY comment), `phase-02-slice-10-ev-eb-closeout` (stale registry pin), `upload-intent-completion` (wall-clock race, 3 tests): all root-caused and fixed. |
| 4 claim-gate-mutation | Cause: the drift oracle `catalogClaimReaders` took 17 s per call (35 to 45 s under load) and the suite calls it once per manifest entry. Fixed (24x faster, identical output). Restoration is now independent of how a test ends and verified by a whole-catalog fingerprint. |

## Item 1: SEC-1 manifest and S09 caller registration

RED: `.lane-logs/api-011643.log` (isolated manifest file on a fresh reset): `lists every claim-reading platform_api function and
no other` fails with `cms_dependency_recheck_run: reads claims but is not in the manifest`; `reports each kind of drift against
a synthetic catalog` fails with `unlisted: [brand_new_reader, cms_dependency_recheck_run]`. Nothing else is unlisted: the
catalog scan (below) lists 106 readers = the 105 old entries + this one, and answers `false` for
`cms_dependency_recheck_resolve_event` and `cms_takedown_preview_tokens` (they reach no claim reader, so listing them would
fail the `noLongerClaimReading` direction of the same drift check). The projection-state reads are bodies spliced into two
existing functions (`cms_get_entry_workflow`, `cms_append_publication_lineage`), not new `platform_api` functions.

Registration (`tests/postgrest/support/claim-gate-manifest.ts`): `cms_dependency_recheck_run: 'service-role'`, family
`service-principal` (it resolves no caller, so no ghost/forged probe applies; boundary = the service_role EXECUTE grant plus the
Worker module boundary, DEC-156). Valid request fixture: `{ eventId, kind: 'schema', refId, cursor: null }` over an event no
review depends on, so the Worker credential gets the successful empty run `{ examined, invalidated, nextCursor }`.

Two harness changes were needed to make the entry mean something:

- A gate-less stub also answers 200, so for an actorless entry whose real outcome is a success the stub would have passed every
  probe (the mutation test would report `behaviour=0`). New optional `GateFixture.successKeys` pins the member names of the
  success body (`claim-gate-outcome.ts`); a stub answering `{}` becomes `200:[members: ]`.
- The ACL mutant (widen the actorless grant to `authenticated`) now runs for EVERY `service-principal` entry (was a single
  hardcoded name), and the family-coverage check subtracts the service-principal entries instead of a literal `1`.

Module boundary (the "locked boundary" half): `apps/worker/src/cms-editorial-principals.test.ts` gains
`keeps the dependency recheck RPC names inside the review-recheck names module` (both names appear in production source only in
`cms-editorial/review-recheck/rpc-names.ts`) and the browser-app test now also covers both recheck RPCs.

S09 caller test: the SQL guard `supabase/tests/phase_02_slice_09_r8_api_surface.sql` already lists all 16 Slice 11 RPCs in
`r8a_supporting` (54 = 38 + 16). The TS side pinned 38. RED: diag `unit.log` `expected [ …(54) ] to have a length of 38 but got
54`. Title changed (S09 receipts cite it, regenerate them):

- OLD `enumerates 8 original, 10 amendment and 38 supporting RPCs and two internal functions`
- NEW `enumerates 8 original, 10 amendment and 54 supporting RPCs and two internal functions` (also `new Set(allowed).size` 56 to 72).
  The other two tests (every executable RPC is named by Worker/web/workflow source; no source names an unexecutable function)
  pass unchanged: all 16 RPCs already have callers.

## Item 2: isolation re-run

Fresh reset (`lane-api.sh`), ONE invocation without `claim-gate-mutation`, shared quiet lock, after the item 1 and 4 changes:
`.lane-logs/api-025729.log` (copy `.lane-logs/gates/item2-isolation-api-025729.log`): **10 files, 70 tests, all pass** in 164 s:
`authority-gate`, `worker-round-trip`, `cms-editorial-composition`, `cms-editorial-composition-flows`, `claim-gate-manifest`
(now with the registered entry), `claim-gate-restore`, `phase-02-slice-11-schedule`, `phase-02-slice-11-schedule-precision-legacy`,
`phase-02-slice-11-read-workflow`, `phase-02-slice-11-review-chain`. The first isolated run, before any change, was already
8 of 9 files green (`.lane-logs/api-011643.log`; the only red file was the manifest, item 1).

| Diagnostic failure (`db-api-test.log`) | Verdict |
| --- | --- |
| `authority-gate` (2), `worker-round-trip` (1), `cms-editorial-composition` (9), `cms-editorial-composition-flows` (file), `phase-02-slice-11-review-chain` (file), `phase-02-slice-11-schedule` (1), `phase-02-slice-11-schedule-precision-legacy` (1), `phase-02-slice-11-read-workflow` (1) | CONTAMINATION, none is a defect. They failed with `PERSON_NOT_FOUND` / `INTERNAL_ERROR` / 400 invalid-uuid for ordinary entry commands, i.e. a shared caller helper or an entry left mutated by the timed-out mutation test. Reproduced deterministically: with the previous mutation spec and a 25 s test timeout, the next suites fail on the same database (`.lane-logs/gates/item4-drill-old-then-manifest.log`: `cms_assign_editorial_reviewer: listed but no longer reads claims`, ghost actor answered `200:`). |
| `claim-gate-manifest` (3) | Real: item 1 (the unregistered reader) |
| `claim-gate-mutation` (11) | Real: item 4 (the first timeout, then contamination of its own later tests) |

Also run on the SAME database right after the mutation suite, without a reset (`.lane-logs/gates/post-mutation-same-db.log`):
`authority-gate`, `claim-gate-manifest`, `worker-round-trip`, `cms-editorial-composition`, `claim-gate-restore`: 5 files, 45 tests, all pass.


## Item 3: unit failures

1. `tests/documentation-boundaries.test.ts`. The rule (read from the test): every directory under `apps packages infra tests
   docs` with more than two direct files needs a `README.md` with non-empty `## Contents`, `## Ownership`, `## Extension`
   (or `Extension rules`), `## Conventions` and `## Related links` (or the combined `Conventions and related material`)
   sections. The cause is NOT a `BOUNDARY:` comment (nothing in the test looks at them). The test throws at the first
   violation, so the diagnostic showed one; a full scan found 14 directories without README (2 source, 12 orchestration) and 3 READMEs missing sections:
   `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/` (Slice 11 added `workflow.astro` and the route test, making 3
   files), `infra/database-races/` (6 kits), `apps/worker/src/cms-editorial/a11y-structural/README.md` (renamed
   `What is here` to `Contents`, `How to add a rule` to `Extension`, `Related` to `Related links`, added `Ownership`),
   `.../review-recheck/README.md` (added `Ownership`), `packages/contracts/src/cms-editorial/time-authority/README.md` (added
   `Ownership`, `Extension`, `Conventions`), and the orchestration directories `docs/handoffs/2026-10-08-phase2-codex-handoff/{codex,lanes,s11}`,
   `docs/handoffs/2026-10-10-claude-s11/` and its `lane-*-logs/` (checker, fe, integration, integration/bench, lease,
   preview-projection, recheck, bench), per the convention already on main (`docs/handoffs/README.md`: "bulk evidence in a
   sibling directory with its own README"). GREEN: `.lane-logs/gates/item3-green-batch.log` (10 files, 66 tests, including the 5 of `documentation-boundaries`). Any NEW directory with three
   or more files (including ignored `*.log` files, which the test counts) needs its own README the same way. No log was moved or edited.
   GitHub tracking issue for the `projection_consumer_state.projection_id` boundary: not needed by this test, none created. The
   boundary rule would want one; suggested text is in "Open items".
2. `tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts` > `EB closeout runbook: ... documents every Slice 10 operation
   with its RPC`. RED (diag): `Object.keys(CMS_EDITORIAL_RPC).sort()` has 18 keys, the test pinned the 9 Slice 10 ones (HEAD added
   CMS-03B-05..09 and 15..18 to the same registry; origin/main still has 9). Fixed to the behaviour Slice 11 requires: the
   registry equals the Slice 10 operations plus the nine Slice 11 ones, and the runbook facet still checks every Slice 10
   operation and RPC. Title unchanged. Also gave the two spec-graph rebuild tests an explicit 60 s budget: each copies the 45 MB /
   1,568-file spec tree and rebuilds the graph (13 to 17 s measured on a loaded host against the 15 s default); one of three
   consecutive runs timed out at 15 s while another lane was running. Not in the diagnostic's failure list; titles unchanged.
3. `apps/worker/src/upload-completion/upload-intent-completion.test.ts` > `fences an in-flight canonical completion before a late
   commit can apply`. Unchanged production code (identical to origin/main). Root cause: the test used a 5 ms wall-clock command
   deadline and waited 15 ms; the use case registers its deadline recovery (`cancelCompletion`) only when it reaches the canonical
   commit, so a host that stalls more than 5 ms before that point leaves nothing to fence and `cancelCompletion` is never called.
   RED (deterministic, valid session plus a 30 ms stall before the commit): `.lane-logs/gates/item3-upload-red.log`
   `AssertionError: expected "vi.fn()" to be called once, but got 0 times`, the same message as the diagnostic. The same race is
   in two sibling tests with `deadlineMs: 5` (`aborts the exact command deadline and propagates the abort signal`,
   `returns within the bounded recovery window when canonical completion never settles`), which also failed in a batch run under
   load (that log was overwritten by the later green batch). Fix (test only): only the `setTimeout`/`clearTimeout` clock is faked, the test waits for an event that proves
   the dependency under test is in flight (session resolver entered, commit entered), then advances exactly the deadline; the
   fence test now also stalls the session resolver 30 ms. GREEN: `.lane-logs/gates/item3-upload-green.log` (6 files, 40 tests) and
   `item3-green-batch.log` (10 files, 66 tests). Titles unchanged.

## Item 4: claim-gate-mutation

Measurement of the diagnostic (`db-api-test.log`): `starts from a clean baseline` 18.7 s, `mutates all 105` hit its 900 s limit, then
three helper mutants hit 300 s, the rest failed on contaminated state; file 1,994 s. Cause analysis:

- The mutation test calls `manifestDrift(mutated)` once per manifest entry, and `manifestDrift` runs the catalog scan
  `catalogClaimReaders()`. That scan compiled one regular expression per (caller, callee) pair
  (`i.prosrc ~ ('\m' || callee.name || '\M')` inside a recursive CTE). On the current catalog (219 `platform_api` functions, 901
  internal functions, 1.98 MB of source) it takes 16.8 to 17.2 s on a calm host and 38 to 45 s under load (rehearsal logs,
  `.lane-logs/gates/diag-numbers-shared-lock-calm-host.txt` and the exclusive-run numbers below). 105 entries times that is 30 min against the 15 min test limit. Codex's passing run of
  2026-10-10 (`parent-s11-root-zod-db-verify-validate-20261010.log`) took 563 s for 105 entries (5.4 s per entry) when the scan
  was cheaper; the scan is quadratic in the catalog and the Slice 11 migrations since then grew it. Probe count is NOT the cause: one
  full pass of all entries' probes is 5.4 to 6.3 s, one entry 0.18 s.
- Fix in `tests/postgrest/support/claim-gate-check.ts`: extract the words of each source once (`regexp_matches(prosrc, '(\w+)', 'g')`)
  and join them to function names. This is the same relation as the old per-pair `\m name \M` test (a name delimited by non-word
  characters is exactly a maximal word run). Proof of equality, not argument: on the live catalog and on catalogs with five entries
  stubbed (including `cms_create_entry`, `identity_person_read`, `cms_dependency_recheck_run`, `rpc_profile_section`) the old query and the
  new one return identical sets (106 = 106, 105 = 105 each time); old 16.8 to 17.2 s versus new 0.68 to 0.86 s (24x) on a calm host.
  The scanner is not weakened: same input, same output, still an oracle only.
- Restoration: new `tests/postgrest/support/claim-gate-restore.ts` plus rewritten `claim-gate-mutation.apispec.ts`. A journal snapshots
  each function (full definition digest, owner, EXECUTE ACL with a NULL ACL equal to its default spelling, comment) BEFORE it is
  mutated, `withMutation` restores and verifies in `finally`, `MutationGuard.checkpoint` stops a body that is past its own
  deadline (30 s before vitest's) or whose test timed out (vitest does not cancel a timed-out body, which is what kept mutating
  in the diagnostic), and `afterEach`/`afterAll` wait for the body to unwind, restore whatever is still journaled (every target is
  attempted, one failure does not stop the rest) and compare a fingerprint of every function of the gate schemas with the baseline taken
  before the first mutation. Each test also asserts `journal.open == []` and fingerprint equality explicitly. New
  `tests/postgrest/claim-gate-restore.apispec.ts` proves it against the real catalog for: body returns, body throws, apply fails halfway
  (stub plus grant), ACL-only mutation, a body still running when its test times out (no further mutation, all restored), a body
  past its own deadline, and a mutation made behind the journal (reported, not trusted).
- First restoration bug found by the rehearsal and fixed (kept here because it is the failure mode the guard exists for): the
  first version compared the raw ACL text, so restoring `platform_private.cfg_actor` (default NULL ACL) failed its own verification;
  the comparison is now on the effective ACL, and the failure message names the differing parts.

### Numbers (quiet host, exclusive `/tmp/wejammin-quiet.lock`)

Run: fresh reset, then `zz` timing diagnostic, then the full `claim-gate-mutation.apispec.ts`, all in one invocation started at
02:45 with load 1.75 (`.lane-logs/gates/item4-exclusive-phase.status`), `.lane-logs/api-024526.log`
(copy `.lane-logs/gates/item4-exclusive-quiet-zz-and-mutation-api-024526.log`): 15 tests pass. Then, on the SAME database with no reset,
5 further files pass (above). Raw numbers: `.lane-logs/gates/item4-exclusive-quiet-diag-numbers.txt`; the throwaway diagnostic spec is kept as
`.lane-logs/gates/zz-gates-diagnostic.apispec.ts.txt`, not in the tree.

| Quantity | Value |
| --- | --- |
| Catalog | 219 `platform_api` functions, 901 functions in the 7 gate schemas, 1.99 MB of function source, 106 manifest entries, 8 helper mutants, 2 ACL mutants |
| Old claim-reader scan | 16,878 and 17,283 ms (38 to 45 s with the host busy, 16.8 to 17.2 s shared-lock calm host) |
| New claim-reader scan | 739, 688, 754 ms (24x), identical output on the live catalog and on five stubbed catalogs |
| `listApiFunctions` / `catalogFingerprint` / one `docker exec psql` | 160 ms / 260 ms / 142 ms |
| Behaviour probes, all 106 entries / one entry | 5.3 to 6.2 s / 0.18 s |
| `claim-gate-mutation.apispec.ts` whole file (vitest result cache) | **374.7 s** (6.2 min), with the unchanged limits 900 s (entries) / 300 s (each helper) / 120 s (each ACL mutant), so no timeout was adjusted |
| Previous passing run (Codex, `parent-s11-root-zod-db-verify-validate-20261010.log`) | 609.8 s file, 563.1 s for the 105-entry test (5.4 s per entry) |
| Diagnostic run | 1,994 s file; the 105-entry test hit 900 s |

Why the diagnostic was slower than Codex's run: per entry the mutation test does ~10 cheap calls (about 0.14 s each) and 1 scan.
Codex's 5.4 s per entry cannot contain a 17 s scan, so the scan was then a few seconds; it has since grown with the catalog (the
Slice 11 migrations added the schedule, cursor, recheck, projection and takedown functions and rewrote large bodies) because it is
quadratic in the catalog: one regular expression compiled per (caller, callee) pair. The probe count is not the cause (the one new
entry adds 0.2 s); `106 x 17 s` is 30 min, which is the observed timeout. After the fix the scan is no longer the dominant cost.
(The earlier catalog size was not re-measured; the statement about it is inferred from the recorded per-entry time.)

### Timeout drill: RED and GREEN for the restoration guarantee

Temporary copies of the old and the new mutation spec with the entries test limited to 25 s, so vitest times it out mid-loop (the
diagnostic's failure mode), run on a fresh reset and followed by the manifest and authority suites on the same database
(`zz-drill-*.apispec.ts.txt` in `.lane-logs/gates/`):

- RED, previous spec: `item4-drill-old-timeout.log` `Error: Test timed out in 25000ms.`; then `item4-drill-old-then-manifest.log`:
  3 failed, 17 passed: `cms_assign_editorial_reviewer: listed but no longer reads claims` and
  `service_role with a ghost actor: expected 400:UNAUTHENTICATED, got 200:` (a stub left installed after the timeout).
- GREEN, new spec: `item4-drill-new-timeout.log` the entries test fails with the same timeout (its own deadline disabled so
  only vitest's timeout ends it), the other 12 tests (baseline, 8 helper mutants, coverage, 2 ACL mutants) pass, and
  `item4-drill-new-then-manifest.log`: 2 files, 20 tests pass on the same database. `afterEach` stopped the body at its next
  checkpoint and restored the one entry it held.


## Files changed

Created (new files):

- `tests/postgrest/support/claim-gate-restore.ts` (journal, snapshot/restore, catalog fingerprint, `MutationGuard`)
- `tests/postgrest/support/claim-gate-outcome.ts` (`outcomeOf` with the success-body member check; split out of `claim-gate-probes.ts` to stay under 300 lines)
- `tests/postgrest/claim-gate-restore.apispec.ts` (8 tests)
- `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/README.md`
- `infra/database-races/README.md`
- `docs/handoffs/2026-10-08-phase2-codex-handoff/{codex,lanes,s11}/README.md`
- `docs/handoffs/2026-10-10-claude-s11/README.md`
- `docs/handoffs/2026-10-10-claude-s11/lane-{checker,fe,integration,lease,preview-projection,recheck,bench}-logs/README.md`, `lane-integration-logs/bench/README.md`

Modified:

- `tests/postgrest/support/claim-gate-manifest.ts` (entry, family member, comment)
- `tests/postgrest/support/claim-gate-fixtures-editorial.ts` (recheck run fixture with `successKeys`; header comments)
- `tests/postgrest/support/claim-gate-fixtures-types.ts` (`GateFixture.successKeys`)
- `tests/postgrest/support/claim-gate-probes.ts` (uses `outcomeOf`; 297 to 298 lines)
- `tests/postgrest/support/claim-gate-check.ts` (`catalogClaimReaders` rewritten, same output)
- `tests/postgrest/claim-gate-mutation.apispec.ts` (journal/guard, per-entry ACL mutants, service-principal count)
- `tests/postgrest/claim-gate-manifest.apispec.ts` (editorial list and comment: twelve commands; `>= 2` successes)
- `tests/postgrest/README.md`, `tests/postgrest/support/README.md`
- `tests/contracts/phase-02-slice-09-api-surface-callers.test.ts`
- `tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts`
- `apps/worker/src/cms-editorial-principals.test.ts` (recheck names stay in `rpc-names.ts`, never in the browser app)
- `apps/worker/src/upload-completion/upload-intent-completion.test.ts`
- READMEs: `apps/worker/src/cms-editorial/a11y-structural/README.md`, `apps/worker/src/cms-editorial/review-recheck/README.md`, `packages/contracts/src/cms-editorial/time-authority/README.md`

No production source, migration or generated file was changed. The throwaway `tests/postgrest/zz-*` specs are deleted.


## Changed or added test titles

- `tests/contracts/phase-02-slice-09-api-surface-callers.test.ts` (P2-S09-AC-180): `enumerates 8 original, 10 amendment and 38 supporting RPCs and two internal functions` to `enumerates 8 original, 10 amendment and 54 supporting RPCs and two internal functions`; expectation 38 to 54 and 56 to 72.
- `tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts`: title unchanged; expectation `registry == the 9 Slice 10 operations` to `registry == Slice 10 operations + the 9 Slice 11 operations`; the two spec-graph rebuild tests gained a 60 s timeout (titles unchanged).
- `apps/worker/src/upload-completion/upload-intent-completion.test.ts`: three titles unchanged (`aborts the exact command deadline and propagates the abort signal`, `fences an in-flight canonical completion before a late commit can apply`, `returns within the bounded recovery window when canonical completion never settles`); same assertions (503, abort observed, `cancelCompletion` called once, no late commit), deterministic clock instead of wall-clock.
- `tests/postgrest/claim-gate-mutation.apispec.ts`: `mutates all 105 manifest entries ...` becomes `mutates all 106 manifest entries ...` (count in the title); `widening the actorless execute grant to authenticated fails exactly that entry, then the ACL and every catalog body are restored` becomes one test per entry: `widening the actorless execute grant of cms_dependency_recheck_run to authenticated ...` and `... of cms_execute_publication_schedule to authenticated ...`. Other titles unchanged.
- `tests/postgrest/claim-gate-manifest.apispec.ts`: titles unchanged; the Slice 11 editorial-command probe set gains `cms_dependency_recheck_run` and its success floor goes from 1 to 2.
- New: `tests/postgrest/claim-gate-restore.apispec.ts` describes `SEC-1 mutation restoration does not depend on how a test ends` with 8 tests.


## Open items

1. Tracking issue for the boundary rule (not created, as instructed). `documentation-boundaries` does not need it, but
   `.claude/rules/boundary-not-placeholder.md` asks every `BOUNDARY:` for one, and
   `supabase/migrations/20261010165000_cms_projection_consumer_state.sql` and `supabase/tests/phase_02_slice_11_projection_state.sql`
   currently cite only `TRACKING: Slice 13 P2-S13-AC-164`. Suggested issue:
   Title `BOUNDARY: projection_consumer_state.projection_id has no foreign key until publication_projection exists (P2-S13-AC-164)`.
   Body: missing spec: BE04c `PublicationProjection` (`publication_projection`) and BE04a `delivery.route_manifest_version` are defined nowhere
   beyond their names. Current behaviour: `platform_private.projection_consumer_state.projection_id` is a typed uuid with no
   constraint; `platform_private.cms_publication_projection_state` derives pending / converged / degraded from the newest row of
   each of the eight consumers; pgTAP `phase_02_slice_11_projection_state.sql` ("BOUNDARY sentinel") fails the day the constraint
   lands. When the spec exists: forward migration `ALTER TABLE platform_private.projection_consumer_state ADD CONSTRAINT
   projection_consumer_state_projection_fk FOREIGN KEY (projection_id) REFERENCES <publication_projection>(id)`, replace the sentinel
   with behavioural tests, and add `TRACKING: #<n>` to the sentinel test comment.
2. Receipts: the S09 and S10 receipt guards fail because cited test files changed (`phase-02-slice-09-api-surface-callers`,
   `phase-02-slice-10-ev-eb-closeout`) and one S09 title changed; regenerate with the evidence runner (orchestrator step 3).
3. Any new directory with three or more files under `apps packages infra tests docs` needs its own README (the test counts ignored
   `*.log` files in the worktree). New `docs/handoffs/2026-10-10-claude-s11/lane-*-logs/` directories will break
   `documentation-boundaries` again until they get one.
4. The two spec-graph tests in the S10 closeout file are 13 to 17 s on a loaded host; 60 s is now their explicit budget.
5. `lane-api.sh` does not take `/tmp/wejammin-quiet.lock`; I wrapped each call in `flock -s`. A canonical gate held it exclusively
   for at least 15 minutes during this lane (02:30 to 02:45; the holder is not visible from this PID namespace).
6. Memory candidates for the orchestrator (not written by this lane): (a) vitest does not cancel a timed-out test body, so a mutation
   test needs journaled restore plus cooperative stop, not only `finally`; (b) tests with a 5 ms wall-clock deadline are a load flake,
   synchronise on the in-flight event and drive the deadline with a controlled clock; (c) a gate-less stub that answers 200 passes an
   actorless entry whose real outcome is 200, so such a fixture must pin the success shape.

