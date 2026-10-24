# Slice 12 governed-authority race support

Status: static corrections authored; database behavior **UNRUN**. No acceptance criterion or
completion signature is cleared. Governing sources: BE03c §Slice 12 lock order and §Governed review
machinery, CMS-03C-06; DEC-188 immutable definition version versus lifecycle counter.

## Files and extension pattern

- `governed-authority-kit.mjs`: human actor/transport context, governed fixture commands, command
  request builder, and the exact administrative grant-row revocation seam.
- `governed-authority-fixture.mjs`: audited S09 SQL fragments for the real source producer chain.
- `governed-authority-processes.mjs`: sole process boundary, immediate registration, unique names,
  startup server timeouts, bounded client outcome waits and exact child reaping.
- `governed-authority-execution.mjs`: asynchronous query facade and finite tracked cleanup.
- `governed-authority-sessions.mjs`: same-probe `pg_blocking_pids` chain, readiness and SQL outcomes.
- `governed-authority-assertions.mjs`: complete ordered rows of all covered stores; exact success
  effects and zero-effect refusal/replay oracles.
- [`../phase_02_slice_12_governed_authority.race.mjs`](../phase_02_slice_12_governed_authority.race.mjs):
  standalone schedules. Never import it for syntax or source checks: its top level opens sessions.

Add schedules in the runner; put new probes/oracles in the corresponding support module. Register
every backend with `startSession`; use the owned asynchronous query facade for fixture/probe/restore
SQL, await every result, and retain outer `finally` cleanup. Keep each module at most 300 lines.
Related reusable fixture source lives in
[`../../../infra/database-races/`](../../../infra/database-races/README.md).

## Fixture provenance and roles

The fixture executes only the audited SQL fragments underlying `chain-kit.mjs` `buildWorld`,
`buildSources(['govrace'])`, and `bindOwner`, through the owned facade in one committed transaction.
No shared JavaScript execution helper is imported or called.
The type follows the real S09 draft → dry-run → seal → submit → assign → decide → activate chain.
The owner initialization and binding are real producer calls. The existing shared actor world also
contains labeled, unrelated negative-control membership/grant fixtures; those are not race subjects.
No `insertGrantRow`, trigger disabling, direct active-type update, or fake active pattern is used.

The designer capability is granted by `platform_api.cms_grant_capability` (CMS-03A-15). Both ordinary
draft subjects are minted by `platform_api.cms_define_template` (CMS-03C-01), bound to the same real
active ordinary content-type version. Fixture command calls and the racing submitter use actual
`SET LOCAL ROLE service_role`; human identity is carried in verified-context-style settings and the
real acting-context binding. Each racing command emits `current_user` before the RPC and asserts it.
Administrative sessions only build/probe fixtures, hold the subject row, and update the exact grant
projection row. That projection UPDATE tests the authority-lock seam; it is not evidence for the
full CMS-03A-17 revocation command or its aggregate/event behavior.

## Schedules and oracles

S1 holds the real draft template version `FOR UPDATE`. The writer must block on that holder. The
revoker updates only `(organization_id, person_id, capability_code='cms.template_designer')` to
`active=false`; one probe must observe both `revoker → writer` and `writer → holder`. Without an
authority fence before the subject lock, the required chain is absent.

After release, exactly one ordinary open review freezes the definition version/hash/lineage/key.
All subject fields are compared; only state, lifecycle counter (+1), and update timestamp may move.
Exactly one immutable `content_type` dependency names the bound active version ID. Exactly one
audit identifies the command/actor/party/review/correlation; the entire outbox is unchanged. Exactly
one new completed idempotency row must match this actor, operation, key hash, request fingerprint,
review resource reference, 201 status and exact returned response. All pre-existing covered rows
remain unchanged. Grant revocation completes second.

S2 restores then revokes the same grant and awaits its COMMIT before either writer starts. A fresh
submission and the exact previously completed S1 request must both return SQLSTATE `P0001`, token
`capability_missing`, and no successful/cached body. Complete ordered rows of reviews, dependencies,
template versions, audit, outbox and idempotency must remain identical. This SQL runner does not
itself prove the Worker's HTTP 403 mapping.

Every fixture, probe, snapshot, restore, holder, writer, revoker and cleanup client has a registered
run-unique exact application name. Startup `PGOPTIONS` supplies statement, lock, idle-transaction
and idle-session timeouts before any SQL runs; `PGCONNECT_TIMEOUT=5` bounds connection setup.
Ordinary outcomes have a 45-second client deadline. Controllers use 5-second statement/idle bounds,
a 1-second lock bound and an 8-second client deadline. These are failure ceilings, not race barriers.

Readiness failures release/reap their holder. Cleanup makes two bounded passes: each controller
terminates only registered exact application names, clears the statistics snapshot while checking
their absence, then terminates its own backend. Success requires the absence marker plus PostgreSQL
`57P01` self-termination acknowledgement. The final verifier therefore needs no recursive verifier.
Each corresponding child is reaped with bounded waits and exact-child TERM/KILL fallback. A second
pass includes earlier controllers and covers connection/reap ordering; any cleanup failure remains
an error even if a later pass succeeds. Original assertion and cleanup errors are preserved.
Sleep keeps the holder alive; observed lock edges are the proof. All teardown behavior is **UNRUN**.

## Execution gate

Only `node --check` and focused static checks were permitted for this correction. Runtime needs
governed-submit GREEN, independent static re-review, separate explicit root database release,
failure-cleanup runtime proof, a freshly reset disposable local database, pinned
Node 22.23.1/pnpm 11.24.0, and quiet/database lock ownership. Root owns runner registration and reset
ordering; this lane changes neither. No DB, Docker, runner import or full validation was executed.
