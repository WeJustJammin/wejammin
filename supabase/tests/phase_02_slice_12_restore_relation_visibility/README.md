# Restore carried-relation visibility

Normative boundary: BE03b editorial workflow, lines1723–1741. Restoring a
relation carries a target reference. Source-entry authority does not replace
current target readability or its assignment fence. No new public error is
introduced: a refused restore uses `migration_chain_incomplete`.

## Serial driver

`../phase_02_slice_12_restore_relation_visibility.sql` includes000/010 and runs
inside a rollback. It proves actual service-role public create, append and
visible restore, then revokes the real target assignment while source authority
remains. A refused restore must preserve complete durable-store row images and
the immutable source. Its serial image excludes no target rows.

Root's first actual509 run:90 assertions,81 PASS/9 FAIL, complete TAP without SQL
abort. The wrong success and seven changed store images are meaningful RED;
the enclosing transaction rolled back. This is not a durable bad-commit claim.

## Concurrent driver — root release only

Use Node22.23.1, the exact authorized ALT database, and all four project locks:

```sh
PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH \
RUN_S12_RESTORE_RELATION_RACE=1 \
S10_RACE_DB_CONTAINER=supabase_db_wejammin_ev \
S12_RESTORE_RELATION_CONFIRM_CONTAINER=supabase_db_wejammin_ev \
flock -x /tmp/wejammin-supabase-ci.lock \
flock -s /tmp/wejammin-quiet.lock \
flock -x /tmp/wejammin-altdb.lock \
flock -x /tmp/wejammin-reset.lock \
node --test supabase/tests/phase_02_slice_12_restore_relation_visibility/020-race.mjs
```

Root must independently verify the staged history, source hashes and unchanged
post-E7 restore body before the first RED. Never import the driver as a syntax
check; `node --check` does not execute its top-level tests.

The driver first establishes a successful visible public control. Cases then
observe actual owned backend PIDs/application names and exact row/blocker
edges, not sleep-based success:

- R1: an invisible target must refuse while its row remains locked; an actual
  restore→holder blocker edge plus an exact-target NOWAIT probe proves the
  forbidden lock lever.
- R2, assignment revoke and archive: target lock precedes restore; the schema
  row must remain free before the holder commits. After that wait, restore must
  recheck and refuse without changing other complete durable stores. Only the
  separately mutated target and its assignments are excluded in race images.
- R3: a successful restore parked uncommitted must fence both target lifecycle
  and the actual caller assignment writer. After restore commits, both writers
  resume; literal copied relation/hash/CAS and immutable-source checks follow.

Wrong success/order assertions run before caller COMMIT. Cleanup cancels only
an observed PID matching this run's exact nonce application name, drains it,
then rolls back owned sessions. A timeout, setup failure, missing barrier or
cleanup failure is a harness/precondition failure, not meaningful RED.

The shared race fixture commits guarded setup and legacy workflow-evidence
support. A fresh verified ALT reset through `lane-db-alt-staged.sh` is mandatory
after EVERY actual race, including failed runs. Never delete immutable fixture
history, touch the primary/default stack, or treat this local race as hosted
acceptance. No slice criterion is checked by this README.
