# Lane `claude_s12_governed_v4` — review V4 follow-ups for governed-recheck before promotion

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (tar-backup every untracked file before
editing it in place). Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`.
Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-governed-v4-report.md` (checkpoint early; keep `## Status` current).
Read `docs/handoffs/2026-10-22-claude-s12/review-v4-report.md` in full — every finding carries file:line and a proposed fix.

## Decisions (root, DEC-221; BE03c "Governed review machinery" updated, changelog row "Governed lock failures and revocation races")

- **V4-02**: a lock timeout or deadlock raised while the frozen block/pattern digest is recomputed is the retryable
  conflict, never `changed`. The promoted `supabase/migrations/20261013300400_cms_governed_frozen_status.sql:219-224` swallows
  every error into `changed`. Fix FORWARD in NEW WIP `supabase/migrations-wip/governed-v4/` (timestamps
  `20261022120000`–`129999`): an anchored patch of the LIVE body (newest definition across promoted + WIP; anchor-checked with
  reverse check like dec202) that re-raises lock-class SQLSTATEs (`40P01`, `55P03`, and say whether `57014` belongs) and keeps
  mapping genuine digest failures to `changed`. RED first: a fault-injection test that makes the digest recomputation raise
  `40P01` and `55P03` (a stand-in for `cms_governed_current_digest` inside the test transaction is acceptable here because the
  test is about error classification, not authority — restore it byte-for-byte and assert owner/ACL, as the lapse fixture
  does) and asserts recheck → retryable CONFLICT (no invalidation, no audit), decision and activation → their CONFLICT, plus
  a control that a genuine digest difference still invalidates.
- **V4-05**: the reviewer-authority invalidation re-reads each candidate under the subject lock and SKIPS a review that is no
  longer live (subject activated, review invalidated or decided meanwhile); a revocation never fails on it. Edit
  `governed-recheck/20261022030200` in place. RED first: simulate the race deterministically in one session (candidate
  snapshot, then the activation commits its state before the lock — e.g. call the invalidation for a review whose subject is
  already `active` with `activated_at` set) and assert the revoking call succeeds and changes nothing for that review.

## Also close (tests/docs only unless stated)

V4-01 (a real-reader lapse witness: direct-write premise with no disabled trigger, modelled on
`phase_02_slice_11_helpers_preflight.sql:833-836`, proving one governed recount discovers a lapse through the UNMODIFIED
`cms_person_holds_capability`); V4-04 (NEW `090-rpc-context.sqlinc` per V4's sketch: each outermost entry point with the flag
cleared, real role, non-zero effect, flag restored, plus a negative control — PAT-031); V4-06 (Worker tests with
`unavailable > 0`, the `invalidated + unavailable <= examined` boundary, and `telemetry.warn` when `unavailable > 0`);
V4-07 (a `kind = 'pattern'` recheck fixture via a nested pattern successor, and the correlation-id path with a real outbox
event id); V4-08, V4-09, V4-11; V4-10 (replace handoff ids in migration headers with DEC-207/DEC-218/DEC-221 and section names).
V4-03 race modules and V4-12/13 are root's — do not do them.

## Runs

Stack (exact): `pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,block-rules,
dec208,governed-v4`. Test files as SEPARATE runner arguments; background; one run per deliberate change. Final run: all
`phase_02_slice_12_governed*.sql`, `dec191*`, plus every Slice 12 file that activates a template/pattern/taxonomy version
(grep for `cms_activate_governed_subject`), and the Worker governed-recheck Vitest.

## Claim

`supabase/migrations-wip/governed-recheck/*`, NEW `supabase/migrations-wip/governed-v4/`, governed pgTAP files/dirs
(`phase_02_slice_12_governed_*`, `phase_02_slice_12_dec191*`), `apps/worker/src/cms-composition/governed-recheck/*`.
Never touch `governed-recheck-red/` (root deletes it). Live: `claude_s12_linked_scan`, `claude_s12_v2_nits`, reviewer V5.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, run counts, files with before/after SHA-256,
BOUNDARY items, requests to root.
