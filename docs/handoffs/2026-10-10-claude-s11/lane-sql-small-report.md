# Lane sql-small report (2026-10-10)

Persisted by the orchestrator from the lane's final message (the harness refused the lane's own
write to this path). Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`; lane HEAD at start
`9b9b588e`, at finish `352c397a`; nothing committed by the lane. All pgTAP ran on the alt stack.

- RED evidence: `.lane-logs/alt-tap-153810-1992932.tap`.
- GREEN: `.lane-logs/alt-tap-154620-2031467.tap` — 24 files, 683 tests, 0 failed (9 new files plus 15
  assignment, decision and preview neighbour suites).
- 120 new assertions; every new title carries `[P2-S11-AC-nnn]` or `[finding 14]`. No existing title changed.

| Item | Result | New file (`supabase/tests/`) |
| --- | --- | --- |
| AC-004 | 26 assertions, green on arrival | `phase_02_slice_11_criteria_publish_gates.sql` |
| AC-108 | 15 assertions, green on arrival | `phase_02_slice_11_criteria_decision_order.sql` |
| AC-087 | 11 assertions, green on arrival | `phase_02_slice_11_criteria_manifest_rls.sql` |
| AC-103 | 13 assertions, green on arrival | `phase_02_slice_11_criteria_schedule_tzdb_tag.sql` |
| AC-112 | 10 assertions, green on arrival | `phase_02_slice_11_criteria_invalidation_states.sql` |
| AC-119 | 10 assertions, RED, real defect, fixed | `phase_02_slice_11_criteria_assignment_revoke.sql` |
| AC-120 | 17 assertions, green on arrival | `phase_02_slice_11_criteria_review_ranges.sql` |
| AC-121 | 9 assertions, green on arrival | `phase_02_slice_11_criteria_decision_snapshot_time.sql` |
| Finding 14 | 9 assertions, green on arrival | `phase_02_slice_11_criteria_safe_read_effects.sql` |

Shared helper: `phase_02_slice_11_criteria/000-effect-digest.sqlinc` (SQL twin of the TypeScript
fourteen-table `snapshotDigest`), with a README in that directory.

## AC-119 RED → GREEN

- RED (run 1, TAP line 28): `not ok 8 - a revoke that leaves updated_at unchanged is refused…`, have
  `00000`, want `P0001:CONFLICT`. `cms_review_assignment_guard()` in
  `20261005017020_cms_editorial_review_assignments.sql` rejected only `updated_at < old.updated_at`.
- Tests 10–12 failed only as a cascade of test 8; each probe then received its own assignment. The
  restructured file was not re-run against the unfixed guard.
- Fix: the guard rejects `updated_at <= old.updated_at` (S11-only file, not on main, not MD5-pinned).
- GREEN: run 2 with the 15 neighbour suites that revoke or read assignments. The main-stack race runner
  `010-review-assignment-race.mjs` was not run by this lane (it revokes through the RPC, which already
  advances `updated_at`).

## Findings and open items

- A. At publish, `template_not_active` and `block_withdrawn` never reach the preflight: the frozen-identity
  check (step 7) commits 409 `version_set_stale` plus a `dependency_changed` invalidation first, matching
  BE03b:1773. Tests pin that real behaviour and record the evaluator's would-be reason beside each case.
- B. The four step-7 publish strings (`version_set_stale`, `details {}`) track the publication lane's
  in-flight edits to `17700`, `17720` and `162000`–`162200`; if that lane changes the token or details,
  only those strings in `phase_02_slice_11_criteria_publish_gates.sql` change.
- C. Finding 14: the old `r11r_effects`, `p11_effects` and `r11_effects` counters omit snapshots,
  evidence, entries and revisions and filter by name. The new oracle proves CMS-03B-15/16/17 reads change
  no row; three controls show what the old counters miss (a snapshot insert, an in-place idempotency
  rewrite, a renamed audit event). Upgrade path: include `phase_02_slice_11_criteria/000-effect-digest.sqlinc`
  in `phase_02_slice_11_rpc_reads/000-world.sqlinc` and make `r11r_effects()` return `c11_snapshot()::text`;
  the same applies to `p11_effects` in `phase_02_slice_11_rpc_publication/000-world.sqlinc`. Finding 7 (a
  read inserting a snapshot for an owner with none) is not exercised because the world already has one.
- D. `plan(n)` counts include assertions from shared prelude fragments (16, 24, 18, 18, 18, 35, 22, 18, 22).
- E. Not covered: AC-112 for revision-append commands CMS-03B-02/-04, the AC-119 `now < ends_at`
  decide-window boundary, and API-level twins.
