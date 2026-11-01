# Injected database-upgrade decisions

DEC-197's receiving-upgrade modules contain pure decisions and an injected
orchestrator. Importing them opens no file, starts no process, reads no environment,
connects to no database and launches no CLI. There is no default/local adapter or
package/CI registration in this claim.

## Modules and dependency direction

| Module                                                      | Responsibility                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `delivery-receiving-upgrade-target.mjs`                     | Exact ALT descriptor; ordered locks; identity, lease, epoch and restoration-envelope checks.                  |
| `delivery-receiving-upgrade-outcome.mjs`                    | Independently parse migration-session JSON and verbose psql outcome.                                          |
| `delivery-receiving-upgrade-snapshot.mjs`                   | Validate 070 documents; lossless row-text/full-catalog rollback equality; committed historical-world linkage. |
| `delivery-receiving-upgrade-catalog-contract.mjs`           | SQL-derived receiving catalog expectations, without importing test fixtures.                                  |
| `delivery-receiving-upgrade-catalog-relations-contract.mjs` | Independent source-derived table, column and index metadata.                                                  |
| `delivery-receiving-upgrade-catalog-constraints.mjs`        | Exact ordered CHECK/key/FK and index contracts.                                                               |
| `delivery-receiving-upgrade-catalog-security.mjs`           | Sequence, guard, implicit type and RI-trigger semantics.                                                      |
| `delivery-receiving-upgrade-catalog.mjs`                    | Preserve every old catalog/row image and permit only the complete intended receiving additions.               |
| `delivery-receiving-upgrade-plan.mjs`                       | Injected source resolution; copied byte/hash bindings; prefix manifest; exact argv; public pure API exports.  |
| `../run-delivery-receiving-upgrade.mjs`                     | `runReceivingUpgrade({ io, plan })`; serial I/O and mandatory verified restoration before passing receipt.    |

Dependency flow is runner → plan/catalog/snapshot → contract/target, with outcome
also depending on target. No module imports the runner or a test. Node crypto,
path and Buffer are pure utilities here; filesystem/process adapters are absent.

## API and safety boundary

`resolveMigrationSource` requires an injected `readOptional`; only `undefined`
means absent. The migration is promoted (`supabase/migrations/`) and has no WIP
twin; an absent source or a read error refuses. `buildUpgradePlan` binds the
exact migration filename, complete source/copy buffers and sorted predecessor
entries. It copies all buffers and freezes structural metadata. Nonempty Buffer
contents cannot be frozen by Node; the runner revalidates hashes/bindings before
I/O boundaries to reject drift.

The caller's manifest agreement proves only a pure decision, not completeness of
the actual repository or applied database history. A separately authorized adapter
must independently rebuild inventory/history and attest the actual root-owned
four-lock lease, container pin, cluster, database OID/owner, predecessor digest and
ordinary promoted-baseline digest. No default/primary/hosted fallback is allowed.

`buildPsqlInvocation` returns only the precise `docker exec ... psql` vector and
a copied whole-file stdin. The read-only `-c` session witness precedes `-f -` in
the same client. Migration SQL owns its BEGIN/COMMIT; no shell, extra SQL wrapper,
quiet option or external single transaction is added.

`runReceivingUpgrade` requires these injected async operations, in order:
`preparePrefix`, `resetBefore`, `setupWorld`, `observe('before')`,
`executeMigration`, `observe('after')`, `restoreBaseline`, `writeReceipt`.
Failed preflight authorizes no reset/restoration. After any validated reset
attempt—even an ambiguous thrown reset—restoration is mandatory. Original failure
identity survives a secondary restoration failure. The first observed attestation
remains immutable. Closed reset transitions bind initial, case and restored
identities to the same logical target, owner, database OID and source inventories.
Only an independently proved owned reset may renew physical container/cluster
identity; ordinary envelopes remain pinned to the accepted case identity.
Setup/observer/migration backend PIDs must differ, and each ordinary envelope
belongs to that case reset epoch. Transition DTOs are diagnostic, not native
execution or ownership capabilities.

Negative accepts only the direct consumer-FK 23503, subsequent aborted-transaction
25P02 diagnostics and terminal ROLLBACK, plus exact fresh-session rollback equality.
Positive requires real COMMIT transcript and the complete committed receiving
catalog, preserving all old rows/security. A passing receipt requires a verified
different restoration epoch and the independently attested ordinary baseline,
which is not presumed equal to the predecessor prefix digest.

Author source remains UNRUN. Unit green would establish injected decisions only;
actual independent inventory, live lock/process ownership, committed fixture
visibility, reset/restoration, PostgreSQL transaction behavior and real upgrade
evidence remain separate root-owned adapter/runtime gates.

## Explicitly injected local adapters

The following local adapter sources are now authored, without a default host
binding, CLI entry point or package/CI registration. The earlier absence statement
describes the pure-module claim. Importing these files still performs no I/O.

| Local module                                       | Responsibility                                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `delivery-receiving-upgrade-local-prefix.mjs`      | Read-only preflight, independent prefix/baseline reset verification and mandatory ordinary-baseline restoration.  |
| `delivery-receiving-upgrade-local-reset-state.mjs` | Private reset lifecycle, accepted case rebinding and separately proved failed-prefix recovery.                    |
| `delivery-receiving-upgrade-local-session.mjs`     | Serial setup, fresh observers and unchanged whole-file migration transport.                                       |
| `delivery-receiving-upgrade-local-target.mjs`      | Explicit dependency contract, sealed ALT config/container/database probes and exact psql invocation.              |
| `delivery-receiving-upgrade-local-inventory.mjs`   | Actual regular-file inventory, source/copy/seed binding, independent applied history and filename/hash digests.   |
| `delivery-receiving-upgrade-local-staging.mjs`     | Byte-verified owned temporary files and atomic, ownership-checked migrations-link replacement/restoration.        |
| `delivery-receiving-upgrade-local-child.mjs`       | Inherited ancestor/FD/FLOCK lease proof and owned streaming-client close/timeout/cancellation settlement.         |
| `delivery-receiving-upgrade-local-observer.mjs`    | Confined fixture expansion, complete TAP-before-COMMIT checks and actual-session/lossless 070 transcript parsing. |

Both constructors require `{ fs, process, clock, lease }`; missing ports refuse.
There is no `node:fs`, `node:child_process`, environment, network or native process
fallback. Prefix and session depend on the helpers above; staging/observer depend
on inventory, inventory depends on target, target depends on child, and child
depends only on the pure target contract. No reverse import reaches a runner/test.

Preflight proves the exact four-lock descriptor using current file identities,
ancestor PID evidence and both inherited FD lock records. It independently reads
actual repository bytes and live applied version/name history. The first observed
container ID, cluster, database OID and owner are observed, not supplied as
authority by a caller. Every mutating boundary rechecks the target. Physical
replacement refuses, including restoration, unless the pending owned reset's
native registry proves that exact replacement and all independent checks pass.
Logical target, owner, OID, lease and nonsecret envelope constraints stay strict.
Only nonsecret database ACL/configuration count/key names are queried, never GUC
values or Docker environment. Nonsecret metadata is compared privately for drift.

Every reset uses a complete regular-file stage verified against copied source
bytes/hashes before invoking the explicit ALT reset command. Final restoration
uses the separately captured ordinary promoted baseline and a distinct epoch.
The original raw migrations-link target is restored only while link ownership is
proved. Unknown/replaced stage contents are retained and cause cleanup failure;
loss of target authority can also prevent cleanup. No broad deletion is used.

Setup withholds COMMIT until complete, non-skipped TAP and the labelled world
witness pass in that same client. Positive setup uses the separately reset 065
empty-world premise. Observers use full 070 and retain row text unchanged. The
migration client receives exact 080 bytes, its own transaction and the literal
same-session marker vector; raw status/stdout/stderr go to the pure classifier.
Errors/timeouts/cancellation kill only owned clients and await actual close and
owned asynchronous work before settlement, not merely an exit event.

Local adapter author status is **UNRUN**. Source review and injected unit results
cannot establish live Linux FD inheritance, Docker/CLI binding, real reset or
PostgreSQL atomicity. Root separately owns formatting, unit/independent review,
host binding, four-lock execution, cleanup/restoration receipts and canonical
validation. No Auth, hosted environment or acceptance gate is cleared here.

## Reset-only identity renewal and injected host boundary

The local prefix adapter requires `beginOwnedReset`, `completeOwnedReset` and
`proveRecoveryOwnership` before any reset staging mutation. There is no fallback
to an unregistered raw CLI invocation. Private one-use handles, not serialized
transition data, identify the pending operation. A failed prefix may establish a
recovery-only candidate but never a successful case epoch or passing receipt.
Incomplete or missing applied-history catalogs conservatively require manual
recovery; automatic restoration after arbitrary mid-reset failures is not proved.

The following host modules supply decisions over explicitly injected trusted
observations. Their native observation producer is a separate, still-required
authority boundary; matching observation DTOs alone cannot authenticate it.

| Host module suffix     | Responsibility                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `host-reset.mjs`       | Private registration, one-use completion, exclusion and failed-operation recovery.                 |
| `host-request.mjs`     | Exact command/target/sequence admission and private request copies.                                |
| `host-boundary.mjs`    | Repeated independent daemon, environment, identity and lease checks.                               |
| `host-source.mjs`      | Actual linked source, promoted/staged bytes and applied-history binding.                           |
| `host-executables.mjs` | Attested shim, shell, Node, JavaScript launcher, compiled Bun and Docker artifacts.                |
| `host-ingress.mjs`     | Mandatory private ingress DTO and lossless injected parent/socket filesystem observations.         |
| `host-trace.mjs`       | Historical process ancestry and raw causal container-create/exec attribution.                      |
| `host-drain.mjs`       | Terminal child collection plus independent descendant, daemon-work and all-client-backend absence. |

All filenames above carry the `delivery-receiving-upgrade-` prefix. They add no
default adapter, CLI/package registration or native OS/network fallback. An owned
CLI exit or a diagnostic create ID is not sufficient: native attribution,
four-lock ownership, source/daemon/executable stability, complete work drain and
independent database verification must all pass. Named, unnamed and unrelated
remaining database clients refuse conservative absence proof; no generic backend
termination is permitted. Real Linux/Docker causal-proxy binding, fresh-session
negative/positive upgrade behavior and verified ordinary-baseline restoration
remain distinct runtime gates.

DEC203 requires an explicit eight-key binding with a private ingress parent/socket,
exact endpoint, immutable upstream and current UID. Child DOCKER_HOST names only
that private endpoint. BigInt lstat→realpath→lstat rounds bracket all existing
executable verification; missing, symlinked or changed observations refuse without
a legacy/ambient fallback. Shape validation reads getuid only and grants no
ownership/reset capability. These repeated pathname observations are not atomic
descriptor/lifetime fencing; the real producer, proxy, causal trace and all-client
drain/native080 proof remain separate gates. No default/native adapter is supplied.

## Contents

The DEC-197 receiving-upgrade modules (`delivery-receiving-upgrade-*.mjs`) listed
in the tables above: pure decision modules, the injected local adapters and the
injected host-boundary modules. The `native-tracing/` subdirectory holds the
separate DEC-203 native primitives and has its own README. The runner that
consumes these modules is `../run-delivery-receiving-upgrade.mjs`.

## Ownership

The DEC-197 and DEC-203 database-upgrade work owns this directory. Root owns host
binding, four-lock execution, receipts and canonical validation; author source
here is unrun until root records otherwise. Several files are pinned by SHA-256
in `.memory/pipeline/progress/verification/`, so changing one invalidates the
matching receipt.

## Extension

Add a module only with its contract tests under `tests/contracts/` first. Keep
decisions pure and inject every filesystem, process, clock and lease port;
follow the dependency direction described above and the
`delivery-receiving-upgrade-<layer>-<subject>.mjs` naming, with `local-` and
`host-` for adapters. Keep each module under 300 lines, add no default adapter,
CLI or package registration without a root-owned decision, and update the module
tables above.

## Conventions

No module opens a file, starts a process, reads the environment or connects to a
database on import. Refuse on any drift or ambiguity instead of falling back to a
default, hosted or ambient target. No `any`; no `TODO` markers.

## Related links

- [Native tracing primitives](native-tracing/README.md)
- `../run-delivery-receiving-upgrade.mjs`
- `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-*.test.ts`
- `.memory/wiki/decisions.md` (DEC-197, DEC-203)
