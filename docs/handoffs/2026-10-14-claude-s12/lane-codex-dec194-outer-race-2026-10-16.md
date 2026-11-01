# DEC-194 outer-entry race RED authoring freeze (2026-10-16)

## Status and scope

FROZEN / UNRUN. Requested native gpt-6.1-sol / ultra. No runtime, parser,
syntax check, test, formatter, DB, Docker, network, or git command ran. No RED,
GREEN, hosted acceptance, or migration correctness is claimed by this author.

Exact two-path claim in the Slice 12 Dispatch:

- supabase/tests/phase_02_slice_12_dec194_outer.race.mjs (new)
- docs/handoffs/2026-10-14-claude-s12/lane-codex-dec194-outer-race-2026-10-16.md (new)

Worktree: /home/rob/.codex/worktrees/phase2-slice12/WeJammin. The protected
primary /home/rob/Projects/WeJammin was not written. No WIP, existing race,
fixture, session kit, migration, schema, specification, or tracking file changed.

Runner: 165 physical lines; SHA-256
a5544783138cd490cec9e33e74ebe234f3dfb2dcba5993a88e6cbde197577922.

## Actual boundary and predicted RED

The applied 20261014120500_cms_act_taxonomy_term.sql validates actor and current
curator authority, checks the idempotency-key type, reserves CMS-03C-03, locks
the active vocabulary FOR SHARE, locks the terms FOR UPDATE, and calls merge
application/convergence. The current outer body has no enqueue mutex. The
locked root brief requires the party mutex after authority/key-type checks and
before reservation, vocabulary/term locks, or early convergence.

This standalone runner calls the actual private outer function in a separate
owned psql backend. It never calls a proposed/missing mutex helper. The holder
uses the root-approved raw transaction advisory key directly:

pg_catalog.hashtextextended('cms.taxonomy.merge.enqueue:' || partyUUID::text, 0)

The expected baseline failure is the frozen 091 blocked assertion that the
producer statement completed while its required blocker still held its
transaction. A missing function/relation, invalid actor/request, fixture error,
or SQL abort is a prerequisite failure and is not acceptable behavioral RED.

The case is deliberately a three-assignment merge. All work normally converges
inside the outer transaction, so the later conditional enqueue helper is never
needed. Adding a mutex only to that later helper cannot pass this witness.
This does not impose global ordinary-job coalescing or alter its per-term policy.

## Controls and observable proof

The bounded bootstrap is copied from the frozen main race and imports the same
090/091 helpers unchanged. It builds the real S09 actor/tenure world, real CMS
grants and active vocabulary through existing S12 producers. Two active,
unmerged terms are created through s12tt_act. Three entry/revision/assignment
rows use the existing explicitly labelled s12tt_seed_bulk fixture seam; no Job,
receipt outcome, lease, token, state, or guard is fabricated.

The raw request is built by s12tt_req plus the real s12ga_ctx envelope, with
active definition operand 1 and a string idempotency key. Before racing, the
actual private outer call must succeed under a SAVEPOINT and every effect must
roll back to the complete before snapshot. While the holder owns the key, a
numeric idempotency key must still produce P0001 INVALID_REQUEST and no effects.

The valid outer call then must show the actual waiter/blocker PIDs, application
names, pg_blocking_pids edge and matching ungranted/granted ExclusiveLock advisory
tuple through the existing 091 blocked predicate. The holder executes only the
one raw advisory-lock statement, so that edge identifies the approved party key.
Before the assertion, the runner records both actual PIDs and separately proves
the holder remains idle in its transaction with its granted advisory lock.
At the observed wait:

- RowShareLock must already exist on person_party, membership_tenure and
  organization_actor_grant: authority precedes the mutex.
- Neither RowShareLock nor RowExclusiveLock may exist on the actual
  cms_taxonomy_versions, cms_terms or idempotency_records relations: the mutex
  precedes vocabulary/term row locking and CMS receipt insertion/FOR UPDATE.
- Committed domain/receipt/effect snapshots must still equal the before state.

Release uses 091 commit, which acknowledges explicit COMMIT and verifies that
the same backend is still connected, idle, outside a transaction and free of
advisory locks before closing it. The outer backend stays open too; its changes
must remain invisible until its own explicit COMMIT.

After release/commit the runner requires the real merged resource at version 2,
the permanent survivor redirect, unchanged survivor/authority/vocabulary/labels/
Job stores, all original assignment rows unchanged, exactly three superseding
retired assignments and three active survivor assignments with retained owner,
taxonomy version, position, provenance and creator, and zero unconverged work.
It checks exactly one actor/party-bound merge audit, one correctly identified
cms.taxonomy.changed.v1 payload/aggregate, and one completed real CMS receipt
containing the returned canonical resource. No counts-only lock or source-token
substitute is used.

## Root release and cleanup boundary

Guards precede every DB call. They reject the primary checkout and default
database and require all of:

- S12_DEC194_OUTER_RACE_ROOT_RELEASE=2026-10-16-native-outer-red
- explicit S10_RACE_DB_CONTAINER
- matching S12_DEC194_OUTER_RACE_ALT_CONTAINER
- a named local supabase_db_ ALT container other than supabase_db_wejammin

Root must separately release runtime under the existing outer CI, quiet,
ALT/reset locks after full source read and parser-only validation. Never import
this standalone executable to check syntax. Use a freshly reset ALT database.
Readiness, statement/lock timeouts and polling are bounded by frozen 091; the
100 ms cadence is only polling, and the database lock predicate is the barrier.

Finally always rolls back held owned sessions, invokes frozen bounded cleanup,
checks that all owned backends are absent, and drops only the four owned public
s12dcr bridge tables when this runner owned bootstrap. Real fixture domain data
is deliberately not broadly deleted: root must reset the ALT database after
success or failure before reuse. No automatic retry or 190030 author release.

## Frozen input read-back

All five captured inputs still match after authoring:

| input | SHA-256 |
| --- | --- |
| phase_02_slice_12_dec194_sweep.race.mjs | 612d11bc358e7cbe4980b7a77dcd2ed080353a0e01c7adf81590dd532f8a402c |
| 090-race-fixture.sqlinc | 26131d66cfdfbec1a77dfaeb7262773a42614c868449fa0883c44f861db2e383 |
| 091-race-session-kit.mjs | 7cf9c43ea560a2f4fe70325eb7419ed68336a0fc139bb883526b0773cba095ee |
| 20261014120500_cms_act_taxonomy_term.sql | e5d4ff829ba5b45aff17a7d0cc0ee143dc1b348821b156511f9f3b6db32b88cb |
| briefs/codex-dec194-durable-admission.md | daa84397dcd52ac77c2ef7a2afe0e14bca3b345e78933ab625f0390a9e2eb802 |

Next: root full read, parser-only check, then one separately approved fresh-ALT
runtime RED. Keep the current main race and all 190030 production writes frozen
until the actual valid outer statement reaches the intended failing boundary.
