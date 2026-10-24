# DEC-197 native bridge plan — 2026-10-18

Design-only handoff. No native adapter, CLI, test, parser, database, Docker,
network, or acceptance execution is claimed. The pure runner and injected
local/host decisions remain unchanged until a separate implementation release.

## Approach

Add one explicit capability bridge around the existing local and host seams,
then a separate DEC-197 entry module that composes the bridge with
`runReceivingUpgrade`. Keep the bridge fail-closed: the root-owned four-lock
lease, exact ALT descriptor, executable/environment attestation, raw process
observations, and complete 080 bytes are inputs, never inferred defaults.

The bridge must settle every owned client only after independent descendant,
Docker-daemon work, and PostgreSQL-backend drain. Reset renewal is accepted
only at the bridge's own locked, verified, drained reset boundary.

## Scope

**In:**

- `infra/database-upgrades/delivery-receiving-upgrade-native.mjs` — Node 22
  capability bridge and composition factory.
- `infra/run-delivery-receiving-upgrade-native.mjs` — explicit DEC-197 facade;
  no generic `supabase`, environment selector, Auth/provider, or default-stack
  path.
- `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-native-bridge.test.ts`
  — RED/GREEN contract cases for binding, identity, handle lifetime, and
  cancellation; injected doubles are decision tests only.
- `tests/native/phase-02-slice-11-delivery-receiving-upgrade-080.mjs` — an
  explicitly invoked native ALT acceptance driver for negative/positive 080,
  cancellation, and restoration. It must not join the ordinary Vitest unit
  collection or canonical `db:verify`.

**Out:**

- Changing `run-delivery-receiving-upgrade.mjs`, SQL, catalog contracts,
  `package.json`/`db:verify`, Auth/provider configuration, Docker daemon
  startup, or adding a new daemon/service.
- Treating host DTOs, unit fixtures, historical unit-127 receipts, test titles,
  or token presence as native proof.
- A new PIDFD dependency unless the owner first decides that the existing
  kernel/process capability cannot satisfy the normative process contract.

## Existing seam and normative inputs

1. `runReceivingUpgrade({ io, plan })` is intentionally injected and requires
   seven ordered operations (`infra/run-delivery-receiving-upgrade.mjs:93-102;
   :24-32`). The directory README says no default adapter or package/CI
   registration exists (`infra/database-upgrades/README.md:3-6,73-77,138-160`).
2. Local constructors require `{ fs, process, clock, lease }`; the reset port is
   obtained through `beginOwnedReset`, `completeOwnedReset`, and
   `proveRecoveryOwnership` (`local-target.mjs:42-87,244-257`). Host binding
   requires the same process ports plus `nativeBinding` and six independent
   observations (`host-request.mjs:55-111`).
3. The target is the sealed four-lock ALT descriptor; no caller-supplied bare
   database/container or fallback is authoritative (`target.mjs:17-57;
   codex-dec197-upgrade-alt-reset.md:20-44`). The reset renewal amendment
   permits identity change only after this runner's own admitted, locked,
   awaited, drained reset and rejects unexplained replacement
   (`codex-dec197-upgrade-reset-identity-renewal.md:19-24`).
4. Normative process evidence is the current raw `/proc` contract: PID,
   parent PID, start ticks, executable, argv, and raw status/stat/exe/cmdline
   (`host-trace.mjs:23-64,152-234`), plus inherited FD/OFD lease proof
   (`local-child.mjs:20-94`). No frozen source requires PIDFD; PIDFD is an
   optional hardening decision, not a silently introduced dependency.
5. The 080 bytes are already bound and must be replayed unchanged in a fresh
   client with its own transaction (`README.md:114-120;
   codex-dec197-upgrade-alt-reset.md:78-90,92-114`). Existing host fixtures
   explicitly state that mocks do not prove descendant attribution or DB drain
   (`host-renewal.test.ts:21-24`).

## Bridge contract

`delivery-receiving-upgrade-native.mjs` exports:

```ts
createNativeProcessPort({ target, lease, binding, clock }): NativeProcessPort
createNativeUpgradeIO({ repository, plan, target, lease, binding, clock,
  receiptWriter }): { io, cancel, close }
```

`NativeProcessPort` supplies the existing local/host shape: `pid`, `run`,
`spawn`, `nativeBinding`, `observeBoundary`, `readResetTrace`,
`observeProcessTree`, `observeDaemonWork`, and `observeBackends`. It uses Node
22 built-ins (`child_process.spawn`, `fs/promises`, `net`, `Buffer`, crypto)
with `shell:false`, pipe stdio, explicit bound environment, and the target
workdir. No `process.env`, PATH search, Docker context, or unqualified binary
may select a target.

The bridge owns a private operation registry keyed by opaque object identity.
Each record contains the actual child PID/start ticks/executable/argv, exact
request bytes, Docker exec/job IDs, and observed PostgreSQL backend marker.
Registration occurs before spawn; removal occurs only after terminal drain and
all pending raw I/O settle. An uncertain record remains recoverable and cannot
be reused as a successful reset epoch. The host module's one-use WeakMap handle
(`host-reset.mjs:21-43`) remains the capability boundary; serialized transition
DTOs never become authority. The bound lease and executable/daemon snapshot are
immutable for the run; every mutation rechecks them through the existing
boundary validator before admission.

`createNativeUpgradeIO` composes `createLocalPrefixAdapter`,
`createLocalSessionAdapter`, and `createOwnedResetPort`. It returns the runner's
exact operations: prefix preparation/reset, setup, before/after observers,
migration execution, baseline restoration, and receipt writing. The caller
must provide an already-held root-owned four-lock lease; this plan adds no lock
acquisition or lock-path fallback.

## Raw attribution and drain

The native producer must bind actual kernel process facts and Docker/PG facts to
the registry record. `host-trace.mjs` and `host-boundary.mjs` remain validators;
they do not authenticate a DTO. A Docker Unix-socket observation alone is not
causal attribution. If no existing root-owned tracer can tie the CLI's raw
Docker requests/responses to the registered child, stop at a typed “native
causal producer unavailable” refusal; do not activate a new daemon or pretend
the Docker response ID is owned.

Add one bridge-local operation drain seam, used by setup, before observer,
migration, and after observer clients:

```ts
await drainOwnedClient(record, {
  sessionMarker: parsedMarker | null,
  reason: 'close' | 'cancel' | 'timeout' | 'signal',
}): Promise<void>
```

It first waits for child close, then independently requires: no descendants;
all registry-attributed Docker execs/jobs terminal with `ExitCode=0` and
`Pid=0`; no owned PostgreSQL backend (and no unexplained remaining backend under
the conservative absence rule); and settled raw streams. A missing marker,
live work, changed daemon, PID/start-ticks reuse, or observer error leaves the
operation uncertain and rejects restoration. The existing `proveDrain` checks
reset attribution only (`host-reset.mjs:82-95; host-drain.mjs:119-167`); it is
not sufficient for local psql clients, whose current cancellation only signals
direct children (`local-child.mjs:130-148,240-247;
local-session.mjs:243-247`).

`cancel(error)` closes admission, signals every registered child, waits
`drainOwnedClient` for every phase, and resolves only after registry cleanup.
The facade's SIGINT/SIGTERM handler calls this method and keeps the process alive
until the active bridge operation rejects (or the next boundary observes the
cancelled state) and `runReceivingUpgrade` reaches its mandatory
`restoreBaseline` path. Failed or ambiguous reset/cancel never becomes a passing
receipt.

## Facade and native acceptance

`run-delivery-receiving-upgrade-native.mjs` exports:

```ts
runNativeReceivingUpgrade({ repository, mode, runId, target, lease, binding,
  clock, receiptWriter }): Promise<UpgradeReceipt>
```

It resolves the promoted/WIP source, builds the existing plan, independently
rebuilds the prefix/applied-history inventory, creates the bridge, and calls the
pure runner. `target` must pass `sealTarget`; `lease` and `binding` must pass
the existing validators. A shell entrypoint may call this only from the
root-owned lock supervisor; absent capability inputs are a refusal, not a
default invocation. No `db:verify` wiring is proposed: `package.json:31-40`
still runs ordinary `db:reset`, and `reset-local-database.mjs:75-85` runs
`supabase db reset --local` against the repository root.

The native driver must have genuinely failing setup cases before any positive:

- wrong/missing lock, target, daemon, executable, environment, source/080
  bytes, applied history, lease, or setup TAP ⇒ typed setup refusal, no reset;
- negative 060 world commits real labelled historical consumers; fresh reset,
  exact 080, first direct FK `23503`, subsequent `25P02`, terminal ROLLBACK,
  fresh 070 no-effect equality, then exact ordinary-baseline restore;
- positive uses a separate fresh reset and 065 empty world; exact 080 commits,
  independent 070 proves complete new catalog plus unchanged old rows/security,
  then exact ordinary-baseline restore;
- injected signal/cancel/timeout at each client phase proves child, daemon, and
  backend drain before restore; a live or un-attributed process is failure;
- every path verifies source bytes, applied history, reset epochs, restoration
  receipt, and no durable negative effects. Setup/TAP/transport failures are
  not controlled migration refusals and never count as native proof.

## Dependency order

1. Add the native bridge RED cases, including a cancellation-at-each-phase case.
2. Implement the Node22 process/stream bridge and capability-bound registry.
3. Bind the existing `/proc`/Docker/PG observation producer; decide separately
   whether an approved PIDFD helper is required.
4. Add all-client causal drain and wire local child settlement to it.
5. Compose prefix/session/reset ports in the explicit native facade.
6. Run the native negative/positive 080 driver under the four locks and retain
   reset/source/no-effect receipts; only then consider a separate normal
   `db:verify` run.

No implementation or acceptance is released by this plan.
