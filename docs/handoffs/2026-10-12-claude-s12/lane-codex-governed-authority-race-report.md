# Lane report — governed-authority race authoring (s12_governed_authority_race)

Lane: `s12_governed_authority_race` (model Phils-Charm/deepseek-v4.1-flash, high). Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. Protected primary checkout untouched. No
database was reset, started, or executed; every migration, other lane's QA, runner and tracking file
is read-only to this lane.

## What this lane delivers

Authoring only (execution gated on root): a standalone deterministic N-session race module and its
support that prove the CMS-03C-06 submit takes the owner-capability authority rows FOR SHARE BEFORE
the subject version row FOR UPDATE.

Authored files (each under the 300-line limit):

| File | Lines | Role |
| --- | --- | --- |
| `supabase/tests/phase_02_slice_12_governed_authority.race.mjs` | 167 | The standalone runner (module, imported by nothing). |
| `supabase/tests/phase_02_slice_12_governed_authority/governed-authority-kit.mjs` | 239 | Shared support: fixture, sessions, probes, authority fence, no-effect snapshot. |
| `supabase/tests/phase_02_slice_12_governed_authority/README.md` | — | Support documentation. |
| `docs/handoffs/2026-10-12-claude-s12/lane-codex-governed-authority-race-report.md` | — | This report. |

Both JS files pass `node --check`. The runner is NOT executed by a syntax check: its top level opens
real sessions.

## The guarantee and why it is mutation-sensitive

Root found the CMS-03C-06 body took the subject row FOR UPDATE before the submitter's owner-capability
rows, so a concurrent revocation could commit while a submit was in flight on authority about to
disappear. The corrective fence is
`platform_private.cms_lock_governed_authority(actor, party, capability)`
(`supabase/migrations/20261013300790_cms_governed_authority_lock.sql`): FOR SHARE on the exact
authority rows the capability check reads and the revocation seams update, called BEFORE
`cms_governed_subject_resolve(..., true)`, with the capability rechecked under the locks
(BE03c:1345 / 1467).

**S1 — authority before subject.** Three real committed sessions, deterministic lock barrier, no
sleep as proof:

1. a blocker holds the subject version row FOR UPDATE;
2. the authenticated application writer calls the real transport
   `platform_api.cms_submit_governed_review` and is OBSERVED (pg_blocking_pids / pg_locks) blocked on
   that subject;
3. the revoker UPDATEs the exact `identity_private.organization_actor_grant` row
   (`active = false`) and is OBSERVED blocked BY THE WRITER while the writer still waits on the
   subject.

Because the only row the revoker touches is the owner-capability grant, the writer can block it only
if it already holds that grant row FOR SHARE — i.e. it took the authority fence BEFORE it waited on
the subject. **Without the fence the revoker commits immediately and step 3 fails** (the revoker is
not blocked by the writer), so the assertion is mutation-sensitive to the ordering. On release the
writer commits one review, one dependency, the subject draft → review move at `lifecycle_version + 1`
and one audit record; the revocation then completes; no outbox event.

**S2 — revoke-first.** The revocation commits before the writer starts, so the writer is refused the
typed 403 `capability_missing` with the review, dependency, subject, audit, outbox and idempotency
stores byte-identical (full-content digest of the subject/review/dependency rows plus audit/outbox/
idempotency counts). The same schedule that succeeds in S1 is here refused, proving the fence is
authority-sensitive and not a blanket refusal.

## Fixture

Real ordinary draft subjects, no stub: the kit commits the SAME fragment chain the governed-submit
pgTAP suite includes (Slice 10 identity/organization, the Slice 11 h11doc world bound to the REAL
seeded editorial policy, and `phase_02_slice_12_governed_submit/000-fixtures.sqlinc`, which grants
the owner creator `cms.template_designer` and mints the `subject` template through the production
CMS-03C-01 command `platform_api.cms_define_template`). The kit mints a second `subject2` template
the same way. Both policy bases resolve the real seeded editorial policy. No fake authority helper,
no RLS/trigger disabling, no source-token assertions.

## Setup / dependency blockers (for root)

1. **Corrected fence semantics (root-owned).** Root is correcting
   `20261013300790_cms_governed_authority_lock.sql` to lock person → tenures → exact grant and to
   DROP the owner-initialization receipt lock. This runner's S1 assertion is unaffected: the revoker
   UPDATEs only the grant row, and the writer blocks it via the grant FOR SHARE regardless of whether
   the receipt is also locked. No runner change is required for the correction.
2. **The fence must be wired into the submit body.** The runner assumes the CMS-03C-06 body
   (`20261013300800_cms_submit_governed_review.sql`) calls `cms_lock_governed_authority` before the
   subject FOR UPDATE. Until that call is present and the transport
   `platform_api.cms_submit_governed_review(jsonb)` exists (20261013300810), the S1 step-3
   observation and the S2 refusal cannot be produced — a runtime run would be RED for the missing
   call/command, not a defect in the harness.
3. **Shared-runner registration is root-owned and not edited.** The runner is intentionally NOT added
   to `RACE_RUNNERS` in `infra/run-database-race-runners.mjs`; that shared file is frozen for lanes.
   Root releases the `RACE_RUNNERS` edit and the run.
4. **Execution command (not run by this lane):**

   ```
   pnpm db:reset
   node supabase/tests/phase_02_slice_12_governed_authority.race.mjs
   ```

   A syntax check must NOT execute the runner. Pinned runtime for the released run:
   Node 22.23.1, pnpm 11.24.0, `login:false`. No DB reset, start, or container execution was
   performed here.

## Scope limits

No acceptance, depth-ratio (285), or full-atomicity claim is made from unrun code. The S2 no-effect
snapshot covers the subject/review/dependency rows by full content and audit/outbox/idempotency by
count; it is a scoped refusal check, not a full-store atomicity proof. The runner evidences one
command's lock ordering; it is not Slice 12 completion.

