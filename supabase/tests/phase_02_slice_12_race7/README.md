# Slice 12 race7: real two-session concurrency for pgTAP files

Support fragments for the `supabase/tests/phase_02_slice_12_race7_*.sql` files (lane `claude_s12_race7`; BE03c "Slice 12 lock order" and
"Authorization, persistence, and concurrency tests"; tracker P2-S12-AC-013, 019, 047, 085, 086, 145, 205, 218, 276, 277).

## Contents

| File                        | Purpose                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-harness.sqlinc`        | dblink command sessions, held / sent commands, lock observation (`pg_blocking_pids`, `pg_locks`), row and advisory lock probes, notes, TAP; includes `005-snapshot.sqlinc` |
| `005-snapshot.sqlinc`       | the snapshot of every user table before the world and the three-step restore after it (`r7_snapshot`, `r7_restore_off`, `r7_restore_delete`, `r7_restore_on`, `r7_report`) |
| `010-governed-world.sqlinc` | the committed governed world (S09 owner, real grants, two real active types, governed helpers) shared by the activation, claim, lease and block files                      |
| `020-sys.sqlinc`            | a system command (no actor) for the CMS-03C-19 claim / execute and the signed block lifecycle commands                                                                     |
| `090-restore.sqlinc`        | removes the committed world again (triggers off, rows out, foreign keys and triggers back) and writes the report the file asserts on                                       |

| Test file                                    | Rows                                  | What it does                                                                                                  |
| -------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `phase_02_slice_12_race7_harness.sql`        | (harness self-test)                   | lock wait observation, probes, collect, stashed command, snapshot / restore on the DEC-108 world              |
| `phase_02_slice_12_race7_activation.sql`     | AC-085, 086, 205, 276                 | CMS-03C-09: lineage race `activation_conflict`, lock order by observation, lock failure, revocation, deadlock |
| `phase_02_slice_12_race7_placement.sql`      | AC-013, 218, 276                      | CMS-03C-02: two placements into one slot, path conflict, lock order, lock failure                             |
| `phase_02_slice_12_race7_taxonomy_term.sql`  | AC-019, 047, 276                      | CMS-03C-03: duplicate key, double deprecation, lock order, activation versus stale operand                    |
| `phase_02_slice_12_race7_claim.sql`          | AC-145                                | CMS-03C-19 claim `FOR UPDATE SKIP LOCKED` (waits about 70 s for real schedules to fall due)                   |
| `phase_02_slice_12_race7_lease.sql`          | AC-277 (worker lease expiry)          | expired lease versus an in-flight executor and a replaced lease (waits about 6.5 minutes for real leases)     |
| `phase_02_slice_12_race7_template_block.sql` | AC-277 (template activation vs block) | a signed block withdrawal committed while a template activation waits: `dependency_changed`                   |

## Method

1. The world is built by the REAL producers in one `begin; ... commit;` of the file's session, so every dblink session sees it. Before the world the
   harness snapshots every user table (`md5(row::text)`); after the scenarios `090-restore.sqlinc` removes every row that is not in the snapshot.
2. The command under test is the lock holder wherever it can be: `r7_hold` opens a transaction on a dblink connection, runs the real
   `platform_api` function under `service_role` and leaves the transaction open. The contender is sent with `r7_send` and observed
   blocked with `r7_blocked_by` (live `pg_blocking_pids`); `r7_waiting_for` names the lock type. No sleep is evidence.
3. Lock positions are proved by probes from a third session: `r7_row_locked` (`FOR UPDATE NOWAIT`: `55P03` = held) and `r7_advisory_probe`.
4. The assertions are emitted by `r7_is` / `r7_ok` / `r7_finish` (pgTAP allows one plan per session and the world transaction uses it).

## How to add a scenario

Build the extra world rows with the real producers inside the world transaction, stash the command with `r7_stash_cmd` (an actor of the world)
or `r7_stash_sys` (no actor), drive it with `r7_hold` / `r7_send` / `r7_collect`, record each observation with `r7_note`, and assert after
`\ir phase_02_slice_12_race7/090-restore.sqlinc`. Keep one world per file; run through the staged ALT runner only.

## Related links

- `../README.md`, `../phase_02_slice_12_gaps_lock_position4_race.sql` (the forged-fixture precedent), `../../../infra/database-races/README.md` (the race module kits)
