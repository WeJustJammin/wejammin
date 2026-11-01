# DEC-203 closed Docker-operation policy — 2026-10-18

Design-only, source analysis; UNRUN. This is the optional second document allowed
by the DEC-203 brief. It changes no code, validator, schema, grant, test, trace,
runner, package wiring, daemon, socket, database, or existing decision. Root owns
primary-source retrieval, implementation, execution, and acceptance.

## 1. Locked boundaries and evidence status

DEC-203 selects an isolated per-run adapter, with no persistent service or
default-stack change. Only the sealed ALT project/database and four-lock lease are
eligible; the upstream daemon is immutable `unix:///run/docker.sock`. No hosted or
provider access, package installation, elevated privilege, kernel-policy change,
generic backend termination, clone, or secret extraction/logging is authorized
(`briefs/codex-dec203-isolated-native-tracing.md:3-12`).

The root brief selects implementation constraints, not an acceptance receipt:
prelaunch registration; continuous owned fork/vfork/clone/exec/exit history from an
attested per-run supervisor; live peer-instance fencing before forwarding; missing
events/lifetime gaps refuse. Every run/spawn/setup/probe/observer/migration/restore/
drain-observer client uses one private admission/environment/registry/completion
boundary. Restore waits for observer-inclusive quiescence, with no recursive
untracked drain admission (`briefs/codex-dec203-isolated-native-tracing.md:16-24`).

Root-provided source inventory locks Supabase CLI `v2.116.0` commit
`997a1e69a4a83466964ed874d3a604c88a7b3866`/tree
`656e3836031e686f10cc6f6ca41e90724c8029d5`, but does not prove installed-binary
reproducibility (`briefs/codex-dec203-supabase2116-source-inventory.md:7-11`).
Verified branches set labels/workdir, create named volumes, copy secret files,
extract pre-start archives, then start; pre-start archive failure attempts owned
forced container/volume cleanup (`briefs/codex-dec203-supabase2116-source-inventory.md:29-37`).
Secret files are stdin tar transport, never retained or treated as authority; the
shared helper's Docker→Podman fallback is unregistered and must refuse pre-exec
(`briefs/codex-dec203-supabase2116-source-inventory.md:39-50`).

The exact five raw-source URLs, byte counts, and SHA256s are frozen in the source
inventory (`briefs/codex-dec203-supabase2116-source-inventory.md:13-24`). Docker public source fixes
client API negotiation range 1.40–1.56, unversioned `HEAD /_ping` with GET fallback,
exec `Env` support for PGAPPNAME, 101 hijack/upgrade, separate exec inspection,
nonzero exit propagation, and PUT archive copy; it does not prove a daemon version
or complete transitive lifecycle (`briefs/codex-dec203-docker299-source-inventory.md:38-58`).

The existing modules are injected validators/clients, not a causal producer:

- `delivery-receiving-upgrade-host-trace.mjs:71-149,153-234` accepts exactly three
  reset commands and synthetic `actorPid`/response objects.
- `delivery-receiving-upgrade-host-drain.mjs:119-168` observes injected process,
  daemon, and backend values and currently requires `ExitCode === 0`.
- `delivery-receiving-upgrade-host-ingress.mjs:35-88` validates DTO shape and
  lstat/realpath snapshots; it does not listen, forward bytes, or identify writers.
- `delivery-receiving-upgrade-local-child.mjs:99-241` owns direct injected child
  handles; `local-session.mjs:137-238` uses that runner for setup, before/after
  observers, and migration; `local-target.mjs:126-205` runs probes/inspect.
- `delivery-receiving-upgrade-local-reset-state.mjs:169-301` performs prefix and
  baseline reset transitions; `run-delivery-receiving-upgrade.mjs:93-224` orders
  all phases and mandatory restoration.

These sources establish client seams and refusal obligations only. Existing
peer-credential production/native tests and ingress bindings are not a complete
adapter, byte-writer attribution, Docker history, or all-client drain proof.

## 2. All-client operation inventory

Every row enters the same private admission registry, carries the run's immutable
lease/target/daemon/source digests, and closes admission before cancellation. A
client cannot start after cancellation; restoration is withheld until every row's
child, stream, observer, Docker work, and backend are quiescent.

| Role | Current source seam | Client bytes/labels | Required terminal witness |
| --- | --- | --- | --- |
| preflight inspect | `local-target.mjs:182-205` `createTargetGuard` | `docker inspect`; target container; project label and DB port | actual response, bound container ID, project label, no foreign selector |
| preflight SQL probes | `local-target.mjs:126-143,198-205`; inventory `:193` | `ALT_TARGET_SQL`/`APPLIED_HISTORY_SQL`, fresh `PGAPPNAME` | actual backend marker, one JSON document, stream close and `/exec/{id}/json` terminal |
| prefix reset | `local-prefix.mjs:74-134`; reset state `:169-229` | exact Supabase CLI invocation `db reset --local --workdir`; staged prefix digest | actual CLI lifecycle manifest, replacement identity, all operation IDs and terminal statuses |
| setup | `local-session.mjs:112-170` | interactive `docker exec -i ... psql`; phase `*-setup`; exact fixture bytes and READY/COMMIT boundary | upgraded stream terminal, COMMIT response, backend marker, no live exec/job |
| before/after observers | `local-session.mjs:188-216` | read-only `docker exec -i ... psql`; phase label; exact 070 snapshot | rollback/read-only terminal, observer backend marker, complete output framing |
| migration | `delivery-receiving-upgrade-plan.mjs:203-238`; local session `:220-238` | exact `docker exec -i ... psql -f -`; `PGAPPNAME`; exact 080 witness bytes and mode | request/response pair, upgraded-stream terminal, SQL classifier status, exec terminal |
| baseline restore | `local-reset-state.mjs:252-301` | second exact owned reset with baseline digest and sequence 2 | replacement identity, source/history checks, all lifecycle terminals, restore receipt |
| drain observers | host drain `:119-168`; local child `:99-241` | process tree, daemon work, backends, raw streams | independent no-descendant/no-live-work/no-backend/quiescence proof |

The migration invocation is literal: `buildPsqlInvocation` emits `docker exec -i`,
`PGAPPNAME`, the bound container/database, `psql -X -U postgres`, exact
`ON_ERROR_STOP`, `VERBOSITY=verbose`, `-A -t`, the session witness, and `-f -`
with copied whole-file stdin (`delivery-receiving-upgrade-plan.mjs:203-238`).
The local target invocation has the same vector and phase-specific application
name (`local-target.mjs:100-124`). These are byte-level client contracts, not proof
that a Docker socket writer is attributable.

The run graph starts at the pinned A0 container: negotiate the daemon, inspect A0,
then perform the source-defined probe/exec-status pair before mutation. Each owned
reset may then follow `create -> secret-copy (opaque stdin tar) -> pre-start archive
extract -> start -> inspect/exec`, with the actual source-defined volume/network
branches included. A copy/archive error before start has a legal owned cleanup edge
(forced removal of that new container/volumes), preserves the first error, and never
pretends that start or success occurred. Recovery and baseline reset use their own
source-defined attempt records; the old three-command projection is not a graph.

The registry is run-global and retained across phases, while each role/phase gets a
sealed attempt scope `(runId, phase, role, attempt, parentOrdinal)`. Repeated valid
before/after observers are new attempts, not cycles; duplicate frames inside one
scope refuse. A failed prefix has exactly one `proveRecoveryOwnership` path for its
pending handle (`local-reset-state.mjs:231-251`); it may not reopen a fresh factory,
reset registry, or bypass the original lease/identity checks. Run-wide cancel/close
permanently seals the global registry, revokes phase handles, and cannot restore or
mint a successor even after owned work drains; the supervisor's continuous event
producer remains a separate open gate. Client-only cancel/nonzero failure is distinct:
after fully proven drain, existing authorized finally-restore may run with first failure latched.

## 3. Closed request/response and stream contract

The producer must emit immutable, ordered frame records. Bodies are never copied to
receipts except the independently bound migration/fixture digest. Nonsecret control
documents may be hashed; approved secret `cp` archives and other opaque transport
are streamed with bounded memory, monotonic time and lossless counters, never
retained or automatically hashed. A frame has this conceptual closed shape:

```ts
type OperationFrame = {
  ordinal: number; role: string; phase: string;
  request: {
    method: string; path: string; query: string;
    headers: Readonly<Record<string, string>>;
    body: {
      length: number;
      sha256?: string;
      class: 'none' | 'nonsecret' | 'bound-workload' | 'opaque-transport';
    };
  };
  response: {
    status: number; headers: Readonly<Record<string, string>>;
    body: {
      length: number;
      sha256?: string;
      class: 'none' | 'nonsecret' | 'bound-workload' | 'opaque-transport';
    };
    operationId?: string; containerId?: string;
    terminal: boolean;
    execStatus?: { Running: boolean; Pid: number; ExitCode: number | null };
  };
  stream?: {
    upgraded: boolean; chunks: number; bytes: number;
    terminal: 'close' | 'inspect';
  };
};
```

`headers` is an allowlist of framing/upgrade/content metadata only; authorization,
cookies, and secret-bearing headers are rejected and never stored. Docker `Env` on
exec-create is allowed only for the exact nonsecret
`PGAPPNAME=<bound phase application name>`; container-create `Env` remains
source-gated by the pinned manifest, with no guessed keys/values and no retained
secret values. Private child environment selectors are attested separately. Secret
archive and SQL/fixture transport is allowed only as the bound opaque workload,
never retained.
Each request and response has one ordinal and lossless byte-length accounting;
hashing is limited to nonsecret or independently bound workload classes.
`Content-Length`, chunked framing, trailers, and upgraded-stream closure must be
internally consistent; short, duplicate, ambiguous, malformed, or out-of-order
frames refuse. Chunks may be forwarded, but receipt state stores only count, length,
optional nonsecret/bound hash, and terminal status.

The run receipt also binds `cliSourceSha256`, `operationManifestSha256`, immutable
daemon endpoint, sealed target, lease epoch, and ordered frame digest. A frame hash
without the live socket/process/response pairing is diagnostic only, never authority.

Control JSON bodies (inspect/create/exec metadata) have an explicit 64 KiB cap.
Archive/copy and psql/stdin streams use bounded-memory opaque forwarding, monotonic
deadlines, lossless byte counters, backpressure, and terminal gates; no fixed
whole-stream cap is selected here. Any total limit must derive from the authorized
workload/source manifest before implementation. Upgraded streams have no retained
body; they require a witnessed terminal frame and a follow-up status inspection.

The operation allowlist is method/path/query exact, with IDs substituted only after
an actual response binds them:

| Class | Candidate Docker wire shape | Query/body rule | Acceptance state |
| --- | --- | --- | --- |
| daemon handshake | `HEAD /_ping`; source-defined GET fallback | empty query/body; record `Api-Version` only | negotiated client range 1.40–1.56; no fixed daemon version claim |
| inspect | `GET /containers/{boundContainer}/json` | empty query/body; response JSON ≤64 KiB | bound ALT container only |
| exec-create | `POST /containers/{boundContainer}/exec` | exact pinned CLI JSON keys; ≤64 KiB; `Env` only exact `PGAPPNAME`; no selectors/secrets | ID must come from this response |
| exec-start | `POST /exec/{actualExecId}/start` | exact pinned start body; upgraded stream required | actual exec ID/container pair only |
| exec-status | `GET /exec/{actualExecId}/json` | empty query/body; JSON ≤64 KiB | pinned-source parsed witness `{Running, Pid, ExitCode}`; terminal `Running=false`, `Pid=0`; unknown/missing schema refuses |
| copy | CLI/API copy path and method from pinned 2.116 manifest | exact `path`/archive framing; opaque bounded-memory stream; no arbitrary host path | only bound ALT workdir/container transition |
| create/start/remove | CLI/API lifecycle paths from pinned 2.116 manifest | exact query/body/headers from manifest; no unknown fields | project label and target transition below |

The last two rows are intentionally source-gated. The host validator's three
commands cannot supply the transitive 2.116 `cp`, create/start/remove ordering or
exact wire paths. The attached source inventory establishes branch order but not a
complete wire manifest; until that manifest is computed, any unlisted
method/path/query/body or lifecycle transition refuses. No guessed Docker API
fallback is permitted. The first four rows are also
protocol-shape candidates until the pinned CLI source confirms that it emits those
paths and headers; a source mismatch refuses rather than silently adapting.
`ExecStatus` is a nonsecret operation-specific witness: only the pinned source's
parsed `Running`/`Pid`/`ExitCode` fields (including terminal values) can authorize
completion; HTTP status, body hash, or stream closure alone cannot.

## 4. Attributable IDs, project labels, and ALT transitions

Create and exec IDs are witnesses only when parsed from the actual paired response:
the create response's container ID must be newly bound to the request's exact
project label `com.supabase.cli.project={target.projectId}` and requested name;
the exec-create response's ID must name that same bound container; exec-start and
exec-status must carry the same actual ID. A declared ID, `actorPid`, request ID,
container name, or response text without a paired frame grants no authority.

The only allowed logical transitions are:

```text
pinned ALT A0 -> daemon negotiation -> inspect A0 -> source-defined probe/exec-status
source-defined preflight -> owned removal (only after locked preflight)
owned removal -> response-bound create -> opaque secret-copy -> pre-start archive
pre-start volume/network branches -> response-bound start -> inspect/exec stream
copy/archive error before start -> owned forced cleanup (first failure, no start)
exec/stream operation -> terminal status (zero success or recorded failure)
role/phase attempt -> repeated observer/recovery as a new sealed attempt scope
failed prefix -> one `proveRecoveryOwnership` path for its pending handle
case/reset epoch -> baseline replacement -> independent restored baseline
```

No foreign container, project label, daemon endpoint, arbitrary archive path,
response ID, or post-cancel operation may enter this graph. Unknown, ambiguous, or
cyclic transitions within one attempt scope refuse; a repeated observer/recovery
role is legal only as a new sealed scope under the same run-global registry. Any
Docker-to-Podman or alternate executable/daemon fallback is unregistered and must
refuse before process exec. The private child environment remains attested even
when the CLI strips Docker selectors from container-facing `Env`. Nonzero/cancelled
terminal work is a drained failure, not success; preserve the original failure.
Causal termination uncertainty blocks restoration even when a later status is
terminal.

## 5. Byte-writer and lifetime limits

The private accepted-socket registry binds a fresh current-UID parent mode `0700`,
socket mode `0600`, identities, admitted endpoint, peer facts, run object, and
lifetime. It does not
prove which process wrote bytes. FD inheritance, `dup`, or `SCM_RIGHTS` can move a
descriptor without changing pathname/device/inode; a registry entry or peer
credential alone therefore cannot authenticate a byte writer. The producer must
record accepted-FD ownership and every transfer/close event, reject unregistered
or replaced descriptors, and correlate each frame to the live writer's process
edge. Missing transfer/lifetime events refuse.

`SO_PEERCRED` supplies connection-time kernel pid/uid/gid plus descriptor identity;
it does not prove current PID lifetime, start ticks, request attribution, or Docker
operation ownership. The five-field primitive remains unchanged. A held
`SO_PEERPIDFD` capability is only a candidate pending actual native support; a
later PID or `/proc` lookup is not atomic lifetime proof. Continuous supervisor
fork/vfork/clone/exec/exit history and pre-forward peer-instance fencing remain
required.

## 6. Drain, cancellation, and restoration

Admission closes before any cancel/timeout/signal. The registry rejects new work,
then drains every owned child, stdin/stdout/stderr stream, upgraded Docker stream,
exec/job, observer, migration, probe, and restoration client. It independently
requires no descendant, no live daemon work, no unexplained backend, no open
private ingress connection, and settled observer clients. A terminal nonzero or
cancelled operation may be fully drained but remains the original failure; a
missing/ambiguous causal drain is uncertain and blocks restore. No generic backend
kill or recursive untracked drain is allowed.

Restore starts only after all clients quiesce and the operation registry is complete.
The existing runner's mandatory restore path remains (`run-delivery-receiving-upgrade.mjs:93-224`);
the policy adds no alternate restore, reset, or success receipt. Setup/observer/
migration/reset failures preserve their first failure identity while secondary
cleanup/restoration failures are reported separately. A passing receipt requires
independent target/source/history/lock checks after the final baseline transition.

## 7. Contract-first negative/positive discriminators

Before implementation, tests must use real frame-shaped observations and a valid
control for each fault, not token presence or serialized DTOs:

1. Positive full pinned 2.116 lifecycle: cp-before-start and every source-attested
   operation, exact request/response pairing, actual IDs, labels, stream terminals,
   setup/probe/observer/migration/restore roles, and complete drain.
2. Missing/duplicate/out-of-order frame, malformed chunk/trailer, short upgrade,
   absent terminal inspect, unknown method/path/query/body, or mismatched ID refuses.
3. Foreign/replaced private socket, inherited/SCM_RIGHTS descriptor, changed peer
   lifetime, missing supervisor edge, PID reuse, and post-run-cancel admission
   refuse; client timeout/cancel cannot silently become run abort or renewal.
4. A proven-fully-drained client-only nonzero/cancelled exec preserves the first
   error and emits no success receipt, but permits the existing authorized
   mandatory restoration path; permanent run-wide cancel/close cannot restore or
   mint a successor. Live observer/backend/descendant or cleanup uncertainty blocks
   restoration.
5. Project-label/name mismatch, foreign target/container/daemon, changed exact 080
   bytes, retained secret content/headers, oversized body, or unproved writer
   attribution refuse; required secret `cp` transport remains opaque and bounded.

## 8. Source gaps that must close before implementation

- Supabase is pinned to `v2.116.0`, commit `997a1e69a4a83466964ed874d3a604c88a7b3866`, tree `656e3836031e686f10cc6f6ca41e90724c8029d5`; exact URLs/hashes: [reset.layers.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/commands/db/reset/reset.layers.ts) `1f706af2b690a05b393d0a2868aaa9599e23d5d7b99415290462da26db368937`; [legacy-container-cli.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/legacy-container-cli.ts) `75fec02290c3f332fd8c9a185e2ab8b4587dab60fc8f31dc6b07c45547ae7068`; [container-lifecycle.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/db-bootstrap/container-lifecycle.ts) `937dc01a0f4ee2a18bda08265d1cde0e474a9ad7e0e96591c9bbf9e23043cc6a`; [recreate-local-database.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/db-bootstrap/recreate-local-database.ts) `1220ff75f4f319ae6b7ec4dac7d50eb462985fed8ac12091b9eabc66ede8f755`; [legacy-docker-run.args.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/legacy-docker-run.args.ts) `97b78edf316c5aeef568a5072a2924c518d6228bfac3dd4c1ae667ca3d5f81a8`.
- Docker source commit `f415da838bed6a0e12ca6cb86ba198fdac6beb9c`, tree `687900947292b56d41aeab392077094aca50dcec`: API range 1.40–1.56, unversioned `HEAD /_ping` with GET fallback/`Api-Version`, actual exec IDs, 101 upgrade, separate status, and PUT archive semantics (`briefs/codex-dec203-docker299-source-inventory.md:15-58`). No actual daemon-version or binary-reproducibility claim.
- Transitive lifecycle branches, JSON/versioned schemas, copy destinations, upgrade framing/backpressure, writer-FD attribution, and native observer drain remain OPEN; source establishes create→secret copies/pre-start archives→start, not a complete manifest. Native producer must capture bytes/writers across inherited/duplicated/passed descriptors; DTOs/tests/lstat do not.
- One registry/drain boundary must cover every §2 row, including `process.run` probes/observers; `local-child.mjs:177-180` currently supplies only shell/stdio spawn options, not private environment, socket registry, or writer causality. Existing SIGTERM/SIGKILL helpers are not drain proof.
- Lifecycle manifest must bind operation digests, transitions, labels, paired witnesses, stream terminals, and data minimization. Missing source is typed setup refusal, never stub/default/fallback/three-command projection. Docker→Podman or alternate executable/daemon is unregistered pre-exec refusal; preserve private child environment when container-facing selectors are stripped.

No adapter, proxy, Docker operation collector, reset facade, receipt, or acceptance
is released by this design. Source-only; root owns official research and all runtime.
