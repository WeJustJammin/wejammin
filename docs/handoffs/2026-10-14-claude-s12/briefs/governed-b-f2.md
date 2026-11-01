# Lane brief — `claude_s12_governed_b_sql` fix pass 2 (staged-runner lane `governed-b`)

Read `docs/handoffs/2026-10-14-claude-s12/review-governed-b-f1.md` fully. Root rulings (binding):
1. Major: the conflict re-read under the lineage advisory lock (`070400:172-173` and `070600:181-182`) must
   NOT take a row lock (it calls `cms_governed_lock_lineage_active`, FOR UPDATE — a position-3 lock after
   the last position, BE03c 1338). Use a non-locking read; the advisory lock already serializes every writer
   of the active row. Fix both call sites.
2. Extract the advisory-key derivation into one helper used by activate, execute and schedule.
3. BE03c 1326/1348 cover scheduling: `schedule` takes the same lineage advisory lock, last, consistent with
   activate (no new deadlock path — prove by reasoning over every producer that takes it).
4. Add an oracle that the re-read takes no row lock (e.g. `pg_locks` shows no RowExclusive/tuple lock on the
   active row from the re-read beyond those taken earlier by position) — RED on the current bytes if
   achievable, else state why.
Edit your WIP in place (write complete new files then move into place; other lanes stage your WIP). Lane
list `governed-b`. Rerun activation, schedule (ladder only if `070500`/`070600` change in a way it
exercises — say which) and `phase_02_slice_12_pattern_definition.sql`. Append `## Fix pass 2` to your report.
