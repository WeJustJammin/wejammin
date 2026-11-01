# Lane `assign` report (2026-10-10)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD `9b9b588ed3ef5409f3fdfcbf1ff179eb13ab0a0f`
(uncommitted work of several lanes is in the tree; only the files below are mine).

## Files changed

| File | Change |
| ---- | ------ |
| `supabase/migrations/20261005017620_cms_assign_editorial_reviewer.sql` | Finding 1 fix, edited in place (S11-only, not on `main`, not MD5-pinned by any later migration). |
| `supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql` | one new sequential assertion (plan 22 -> 23): ended owner tenure is concealed. |
| `supabase/tests/phase_02_slice_11_races/010-review-assignment-race.mjs` | Finding 15 (A2 holder/barrier) and Finding 1 (new A5, A6, A7: real concurrent revocation). |
| `infra/database-races/review-kit.mjs` | helpers: `blockedBy`, `holdsWriteLock`, `assignmentReservations`, `commitStatement`, `grantUpdate`, `tenureUpdate`; re-exports `revokerScript`. |

No new migration file, no other file touched.

## Finding 1 (UPHELD): grantor authority checked before fencing

**Test (RED first).** Pure pgTAP cannot revoke while a command waits, so the RED test is the race runner:
`010-review-assignment-race.mjs` A5/A6/A7. A5: a gate holder keeps an advisory lock closed; a revoking session updates the
owner's `cms.editor` grant row and parks uncommitted (row lock held). A `create` is started; it passes its unlocked check on the
still-committed grant and is observed `blocked` with `pg_blocking_pids` naming exactly the revoker (`blockedBy(...) === revoker app`).
The gate opens, the revocation commits, and the waiting create must be `capability_missing`, must leave no assignment, event or
`CMS-03B-18` idempotency reservation, and the identical request (same key) must succeed once the grant is restored.
A6 does the same with the end of the owner's membership tenure against a `revoke` (expected concealment `NOT_FOUND`, assignment stays
`active/1`). A7 is a control: a `revoke` blocked behind the loss of the owner's `cms.editor` grant still commits (a revoke needs the
owner receipt only), so the fix is not over-strict.

**RED** (old migration, new runner; main stack, fresh `supabase db reset` from a snapshot of the unmodified migrations tree):

- `/home/rob/.codex/worktrees/phase2-slice11/WeJammin/.lane-logs/assign-red-full-20261010-151147.log`
  A1-A4 and the new A2 checks pass on the old code, then
  `ASSERTION FAILED: A5: once the revocation commits, the waiting create re-proves the grantor under its locks and is refused capability_missing (ok)`
  (the `check(` call at runner line 253). The create returned success: stale authorization retained, exactly the finding.
- `/home/rob/.codex/worktrees/phase2-slice11/WeJammin/.lane-logs/assign-red-no-a5-20261010-151147.log` (same runner with the A5 block cut out, so A6 is reached, fresh reset):
  `ASSERTION FAILED: A6: once the tenure end commits, the waiting revoke re-proves the owner scope under its locks and the review is concealed NOT_FOUND (ok)`
  The revoke committed (200) after the owner lost the tenure.
- Order note: the RED snapshot of the migrations was taken before the fix existed; the run itself waited ~70 minutes behind the
  orchestrator's `db:verify` for the main-stack lock, and I applied the fix to the worktree (so the alt-stack pgTAP could run) while it was queued.
  The RED run used the snapshot (old code), not the worktree.

**Fix** (`20261005017620`): steps 3 and 4 now run the SAME proof twice in a two-pass loop. Pass 1 (committed state, before any lock) is unchanged and
still decides whether this organization's authority rows may be locked at all (stranger / foreign review / non-owner lock nothing). Pass 2 runs after
`cms_lock_person_authority` and BEFORE `cms_reserve`: it re-resolves the live person (`identity_actor_person`, the live acting binding: person_party
account state, share-locked), re-reads the review owner, recomputes `cms_editorial_review_scopes` (owner receipt + confirmed tenure) and, for `create`,
`cms_person_holds_capability(owner, grantor, 'cms.editor')`. Same tokens as pass 1 (`NOT_FOUND`, `capability_missing`), nothing reserved or written before
pass 2, DEC-157 lock order unchanged. No helper function was added (an inline loop keeps a single copy of the proof; `phase_02_slice_10_ev_eb_publication_scope.sql`
pins the exact list of Slice 11 private functions, so a new helper would have broken that suite). Owner, `SECURITY DEFINER`, `search_path=''`, grants,
signature and volatility are untouched (only the body changed).

**GREEN**

- Race: `/home/rob/.codex/worktrees/phase2-slice11/WeJammin/.lane-logs/assign-green-full-20261010-151147.log` - exit 0, 21 `ok -` lines (A1-A7), fresh reset from the worktree migrations
  (which already contained other lanes' in-progress files; the reset succeeded).
- pgTAP (alt stack): `/home/rob/.codex/worktrees/phase2-slice11/WeJammin/.lane-logs/alt-tap-150559-1836035.tap` - 10 files, 241 tests, Result PASS:
  `phase_02_slice_11_rpc_review_assign.sql`, `..._assign_authority.sql`, `..._assign_refusals.sql` (23), `..._rpc_review_scopes.sql`,
  `..._rpc_review_decision_invalidation.sql`, `phase_02_slice_09_r8_api_surface.sql`, `phase_02_slice_09_sec2_definer_rls.sql`,
  `phase_02_slice_09_sec2_all_schema_definer_rls.sql`, `phase_02_slice_10_ev_eb_publication_scope.sql`, `phase_02_slice_11_schema_posture.sql`.

## Finding 15 (UPHELD concurrency-evidence gap): A2 had no overlap barrier

`010-review-assignment-race.mjs` A2 now takes a holder (`holdReviewLock`) on the review FOR UPDATE before starting the two creates
(rvA, rvB on the review with 15 active assignments), then asserts before releasing it:

1. both creates are observed `blocked` (the two callers genuinely overlap);
2. each waits only on the holder or on the other create, and the holder blocks the queue (`pg_blocking_pids`);
3. neither has a granted `RowExclusiveLock` on `cms_editorial_review_assignments`, i.e. both are parked on the command's own review lock before any
   write, not on the independent insert guard (which also locks the review and recounts, so it would otherwise mask a missing RPC lock).

After release: exactly one success and one `assignment_limit`, 16 active rows, one event (the pre-existing assertions, titles unchanged). Per the finding I do not
claim a cap bypass from defeating one guard; the new check 3 is what separates the RPC lock from the guard.

Result: A2 passes on the old and on the fixed migration (production behaviour was already correct; this is evidence-only):
RED log above (A2 lines before the A5 failure) and GREEN log. See the mutation note below for the check that the new A2 has teeth.

**Mutation check of the new A2** (main stack, fresh reset from a scratch copy of the migrations whose `cms_assign_editorial_reviewer` has the command's own
`FOR UPDATE` on the review row removed from step 5; the independent insert guard of `20261005017020` is left intact, so the cap still cannot reach 17):

- the OLD A2 (HEAD runner, A2 only) still PASSES on that mutant: `/home/rob/.codex/worktrees/phase2-slice11/WeJammin/.lane-logs/assign-mutant-old-a2-20261010-162504.log` (2 `ok`, exit 0) - the old evidence could not see the missing RPC lock;
- the NEW A2 (A2 only) FAILS on it: `/home/rob/.codex/worktrees/phase2-slice11/WeJammin/.lane-logs/assign-mutant-new-a2-20261010-162504.log` -
  `ASSERTION FAILED: A2: neither parked create has written the assignments table yet: both wait on the command's own review lock, not on the insert guard`
  (the two creates then wait inside the insert guard after writing the assignments table).
- A mutant that only moves the RPC count before its lock but keeps the lock is behaviour-equivalent (the guard recounts and still refuses the 17th), as the finding says; not distinguishable and not claimed.
- Aftermath: the shared main DB was left on the mutant migrations by that run; I queued a restoring `supabase db reset` against the worktree under the same lock (log `.lane-logs/assign-restore-reset.log`). Every lane script resets before use anyway.


## Test titles

No existing title was changed or weakened.

New race titles (`010-review-assignment-race.mjs`):

- `A2: both creates are parked behind a session holding the review row FOR UPDATE, so the two callers genuinely overlap (...)`
- `A2: each parked create waits only on the holder or on the other create, and the holder blocks the queue (...)`
- `A2: neither parked create has written the assignments table yet: both wait on the command's own review lock, not on the insert guard`
- `A5: a create whose unlocked check passes on the still-committed cms.editor grant BLOCKS on the authority rows held by an uncommitted revocation of that grant`
- `A5: once the revocation commits, the waiting create re-proves the grantor under its locks and is refused capability_missing (...)`
- `A5: the refused create wrote no assignment, event or idempotency reservation and left the review at version 1`
- `A5: the very same request (same key) succeeds once the grant is restored, so the refusal was the revoked grant alone and reserved nothing (...)`
- `A6: a revoke whose unlocked owner check passes BLOCKS on the authority rows held by an uncommitted end of the owner membership tenure`
- `A6: once the tenure end commits, the waiting revoke re-proves the owner scope under its locks and the review is concealed NOT_FOUND (...)`
- `A6: the concealed revoke left the assignment active at version 1 and wrote no event or idempotency reservation`
- `A7: a revoke BLOCKS on the authority rows held by an uncommitted revocation of the owner cms.editor grant`
- `A7: the waiting revoke still commits after the cms.editor grant was lost: a revoke needs the owner receipt only (...)`
- `A7: the assignment is revoked at version 2, the review version never moved and one event was emitted`

Unchanged and still cited by `tests/contracts/phase-02-slice-11-evidence-ledger-067-100.ts`: `A1: one active row, one review-changed event and the review untouched at version 1`,
`A2: sixteen active assignments (never seventeen) and one event`, `A3: the assignment is revoked at version 2, the review version never moved and one event was emitted`,
`A4: a create BLOCKS behind a session holding the review row FOR UPDATE (the command takes the review lock)`.

New pgTAP title (`phase_02_slice_11_rpc_review_assign_refusals.sql`, TAP number 11, later numbers shift by one):
`an owner whose membership tenure has ended no longer holds the owner scope: the review is concealed NOT_FOUND for create and revoke [P2-S11-AC-069]`
(passes on old and new code; it pins the token the A6 race expects).

## Spec lines satisfied

BE03b:1721 (Write-path lock order rule 1, "capability re-proved under the position 1 locks"), BE03b:1846 (CMS-03B-18 owner with a live binding, grantor
authority end, 403 `capability_missing`, 16-assignment limit under the review lock), DEC-157 (lock order unchanged, review row lock, exact version check),
DEC-161 (revoke invalidation path untouched).

## Left open / for the orchestrator

- `supabase/tests/phase_02_slice_11_races/README.md` (not mine, currently modified by another lane): the `010-review-assignment-race.mjs` row should add: A2 holder/barrier
  (both creates parked on the command's review lock before any assignments write), A5/A6 (grantor `cms.editor` loss / owner tenure end committed while the command waits for its
  authority locks: `capability_missing` / `NOT_FOUND`, nothing written, key reusable), A7 control (revoke still commits).
- The "live acting binding" is `identity_actor_person` (person_party `claimed|active`, share-locked with the other authority rows) re-resolved in pass 2; it is covered by the
  same pass but not raced separately (A5/A6 race the grant and the tenure). `acting_context_binding` is not part of this command's request contract (no `actingContextId`).
- Evidence ledgers (`tests/contracts/phase-02-slice-11-evidence-ledger-*.ts`) may want to cite the A5/A6 titles for the assignment-authority criteria; I did not edit them.
- `race.json` at the repo root is an untracked artefact of another lane (it records line numbers of `check(` calls in this runner); the line numbers of the checks in 010 moved.
- The orchestrator's `pnpm db:verify` running in this tree while I edited picks up the new runner and the fixed migration together at its race stage; rerun it after integration.
