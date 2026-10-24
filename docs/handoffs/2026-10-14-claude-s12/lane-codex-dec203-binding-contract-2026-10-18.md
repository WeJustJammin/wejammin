# DEC-203 binding contract — per-run ingress and causal trace

Date: 2026-10-18. Source-only design handoff; UNRUN. This document is the sole
new path in this claim. Existing validators, contracts, tests, runtime, decisions,
and package wiring remain untouched. Root owns integration and release decisions.

## 1. Locked facts

DEC-203 approves an isolated per-run tracing adapter with reviewed binding changes,
no persistent service and no default-stack change (`.memory/wiki/decisions.md:5324-5333;
briefs/codex-dec203-isolated-native-tracing.md:3-5`). DEC-197 still requires the
sealed ALT project/database, four locks, executable/source/daemon attestation,
reset-only identity renewal, strict migration bytes, independent client/daemon/
backend drain, and verified ordinary-baseline restoration
(`briefs/codex-dec203-isolated-native-tracing.md:7-12;
briefs/codex-dec197-upgrade-reset-identity-renewal.md:17-24`). No package install,
elevated privilege, kernel-policy change, secret extraction/logging, hosted/provider
access, clone, or generic backend termination is authorized.

The approved upstream daemon remains `unix:///run/docker.sock`; a private ingress
is a separate per-run resource, never an ambient Docker context or selected daemon
(`codex-dec203-isolated-native-tracing.md:9-18`). The migration client command and
stdin remain exact: `buildPsqlInvocation` emits `docker exec ... psql ... -f -`
(`delivery-receiving-upgrade-plan.mjs:191-228`; `codex-dec197-upgrade-alt-reset.md:92-114`).

The existing host modules are validators over injected observations, not producers:

- `host-request.mjs:55-111` requires `spawn`, `observeBoundary`, `readResetTrace`,
  `observeProcessTree`, `observeDaemonWork`, `observeBackends`, and `nativeBinding`.
- `host-executables.mjs:53-121` attests executable/package artifacts and currently
  requires `daemon.endpoint === unix:///run/docker.sock`, exact `PATH`/`DOCKER_HOST`,
  and empty dotenv.
- `host-boundary.mjs:65-123` explicitly consumes observations without authenticating
  their producer.
- `host-trace.mjs:23-64,152-234` validates raw PID/PPid/startTicks/executable/argv,
  `/proc` bytes, shell→Node history, native child, Docker responses, and process
  captures. `host-drain.mjs:119-168` requires descendant, daemon-work, and backend
  absence. `host-reset.mjs:82-111` calls trace validation before drain.
- Existing cancellation signals only direct child/client handles
  (`local-child.mjs:130-148,240-247`; `local-session.mjs:243-247`).

The pure runner remains injected-only (`run-delivery-receiving-upgrade.mjs:93-102`)
and has no default adapter or database/process/network access.

The following are selected implementation constraints from the DEC-203 root brief (`briefs/codex-dec203-isolated-native-tracing.md:16-24`), not owner decisions: register before launch; continuously attest every owned
fork/vfork/clone/exec/exit edge from the admitted supervisor; fence the live peer
before forwarding and refuse missing events/lifetime gaps. Every
run/spawn/setup/probe/observer/migration/restoration/drain-observer client crosses
one private admission/environment/registry/completion boundary; restoration waits
for observer-inclusive quiescence; drain tracks owned work explicitly and never
recursively admits untracked work.

The upstream endpoint is immutable. The fresh private parent is current-UID-owned
and mode `0700`; its socket is current-UID-owned and mode `0600`, with identity
checks on both. The pinned Slice-11 executable is a deliberate shared read-only
artifact, attested in place; no PATH/default fallback.

Consumer inventory: `host-request.mjs` feeds `host-source.mjs`,
`host-executables.mjs`, `host-boundary.mjs`, `host-trace.mjs`, and `host-reset.mjs`;
`host-reset.mjs` consumes boundary/trace/drain; `local-child.mjs` feeds
`local-target.mjs`, `local-session.mjs`, and boundary construction. Tests/fixtures
(`host-renewal.test.ts:21-24`, `host-launcher-fixtures.ts:20-22`,
`host-renewal-fixtures.ts:82-176`) are synthetic only; unclosed edges are
call-graph gaps, not coverage.

## 2. Proposed binding amendment (review required)

Keep the current daemon meaning and add a separate private ingress. Candidate shape:

```ts
type FileArtifact = {
  path: string; sha256: string; device: string; inode: string;
  size: number; mode: number; uid: number;
};

type PathIdentity = {
  path: string; device: string; inode: string; mode: number; uid: number;
};

type UpstreamDaemon = {
  id: string;
  endpoint: 'unix:///run/docker.sock';
};

type PeerBuildMetadata = {
  node: { path: string; version: 'v22.23.1'; napi: 8 };
  source: FileArtifact; compiler: FileArtifact;
  headers: FileArtifact[]; output: FileArtifact;
};

type PrivateIngress = {
  parent: PathIdentity;             // fresh canonical directory, mode 0700
  socket: PathIdentity;             // fresh AF_UNIX stream socket
  endpoint: string;                 // only spawned-child DOCKER_HOST value
  upstreamEndpoint: UpstreamDaemon['endpoint'];
};

type NativeBinding = ExistingBinding & {
  daemon: UpstreamDaemon;           // immutable upstream, never ingress
  ingress: PrivateIngress;          // run-scoped, object-bound lifetime
};
```

`parent` and `socket` are actual regular/socket identities captured before and
after admission; owner/mode/identity drift refuses. The adapter creates the fresh
0700 parent and exact socket; it does not accept a caller path, pre-existing output,
ambient selector, or default. `environment.DOCKER_HOST` may equal only the admitted
private `ingress.endpoint`; `ingress.upstreamEndpoint` must equal the attested
`daemon.endpoint`. All other existing environment/package/artifact checks remain.

The ingress is an in-process, per-run capability candidate, not a persistent daemon.
Its private listener forwards the unchanged Docker CLI byte stream to the immutable
upstream endpoint. The CLI executable, shell/Node/native ancestry, argv, migration
stdin, and target workdir remain exact. A direct upstream client outside the ingress
is foreign unless separately attested and recorded.

## 3. Kernel identity, authority, and lifetime are separate

The DEC-203 peer primitive is proposed/test-staged, not integration evidence
(`codex-dec203-isolated-native-tracing.md:22-42`). Its exact factory is:

```ts
buildPeerCredentialReader({
  runDirectory: string,
  compilerPath: string,
  includeDirectory: string,
}): Promise<{
  read(socket: NodeJS.Socket): {
    pid: number; uid: number; gid: number;
    device: string; inode: string;
  };
  close(): Promise<void>;
  metadata: PeerBuildMetadata;
}>;
```

The first five peer fields remain exactly `{pid, uid, gid, device, inode}`. A held
`SO_PEERPIDFD`/peer-lifetime capability is only a candidate and its actual local
native support is unproven; it cannot replace the test-staged primitive yet. Later
numeric-PID `/proc` snapshots alone are insufficient for lifetime fencing.

The fixed adjacent C source uses Node-API 8 and existing compiler/headers only.
The run directory is fresh, canonical, current-UID-owned, non-symlink, and mode
0700; output is exclusively `peer-credentials.node`. Build/load/read binds source,
compiler, four headers, output, Node `v22.23.1`, N-API 8, hashes, device/inode,
size, mode, and uid. Compilation and streams drain before failure; no inherited
`CPATH`, `C_INCLUDE_PATH`, `LD_PRELOAD`, `NODE_OPTIONS`, Docker selector, package
installer, or privilege is allowed.

`read(socket)` accepts only a live connected AF_UNIX stream descriptor, calls
`getsockopt(SO_PEERCRED)`, and compares descriptor `fstat` identity before/after.
It never accepts request-declared credentials, pathname inode, or a later `/proc`
guess. Closed/foreign/wrong-kind descriptors use exact DEC203 refusal tokens. The
capability is frozen and object-bound; `close()` revokes reads before awaiting
cleanup. Missing native capability remains typed refusal, not a fallback.

These facts are not authority by themselves:

| Layer | Required proof | Not sufficient |
| --- | --- | --- |
| Kernel peer | SO_PEERCRED pid/uid/gid + socket device/inode | declared actorPid, request ID, Docker ID |
| Lifetime | actual PID/startTicks/exe/argv and raw `/proc` before/after | PID alone or post-hoc process lookup |
| Authority | root-owned admitted supervisor, four-lock lease, sealed target, binding artifacts | caller JSON, serialized DTO, ambient environment |
| Operation | peer ↔ registered child lifetime ↔ raw request/response | matching response ID or app name |

## 4. Real supervisor ancestry and raw Docker history

The registry records the actual admitted supervisor and every owned descendant:

```ts
type ProcessIdentity = {
  pid: number; parentPid: number; startTicks: string;
  executable: FileArtifact; argv: string[];
  proc: { status: Buffer; stat: Buffer; exe: string; cmdline: Buffer };
};

type DockerOperation = {
  ordinal: number;
  process: ProcessIdentity;
  peer: { pid: number; uid: number; gid: number; device: string; inode: string };
  request: { method: string; path: string; bytesSha256: string };
  response: { status: number; bytesSha256: string; witness?: object };
};

type CausalTrace = {
  supervisor: ProcessIdentity;       // actual admitted parent, not guessed
  ancestry: ProcessIdentity[];       // every observed edge to the CLI child
  supervisorEvents: Array<{
    kind: 'fork' | 'vfork' | 'clone' | 'exec' | 'exit';
    parentPid: number; childPid: number; startTicks: string;
    executable?: FileArtifact; argv?: string[];
  }>;                                 // continuous owned-child history
  docker: DockerOperation[];         // complete ordered actual lifecycle
};
```

The supervisor is admitted through the root-owned lock lease and verified with
actual `/proc` facts. Registration precedes launch; the event stream covers every
owned fork/vfork/clone/exec/exit edge. A tracer supervisor, if needed, is itself an
admitted real process; never fabricate the old direct parent or shell→Node history
(`codex-dec203-isolated-native-tracing.md:16-20`). A missing edge, changed
start-ticks, PID reuse, foreign executable, or supervisor drift refuses.

`host-trace.mjs` currently hard-codes three reset commands (`:71-149`), while the
pinned Supabase CLI 2.116 reset lifecycle includes `cp` before start and other
Docker operations. The amended trace must therefore capture every real operation
and response in order, including copy-before-start and later work; it must not
fabricate a three-command “full history.” Unknown or unneeded payloads stream
opaquely with bounded non-secret witnesses/hashes. Known target/container IDs are
checked against the bound request; IDs never grant ownership.

Before replacing the three-command validator, close the Docker policy: each
operation needs attributable create/exec witnesses and exact request/response
pairing; upgraded streams need terminal witnesses; only approved ALT target
transitions are admitted and unknown work rejected. Nonzero/cancelled terminals are
drained failures distinct from success; preserve the original failure, and block
restoration when causal drain is uncertain.

`execHistory` is populated only from actual process observations. The adapter must
not replace the CLI with direct HTTP, inject a wrapper flag, synthesize actor PIDs,
or claim that expected argv proves execution. Existing process/response validators
remain unchanged until a reviewed DTO amendment is implemented.

## 5. Registry, drain, and failure contract

The private registry is keyed by object identity, registers before spawn, and holds
the child, supervisor ancestry, ingress sockets, peer credentials, Docker operation
records, backend marker, exact input bytes, and pending stream promises. Serialized
transition data never creates authority; existing one-use `WeakMap` reset handles
remain the admission boundary (`host-reset.mjs:18-43`).

The same private admission/environment/registry/completion boundary applies to every
run/spawn/setup/probe/observer/migration/restore/drain-observer client. Cancellation
or restore is incomplete while an observer remains attached; clients quiesce under
explicit ownership tracking, with no recursive admission of untracked drain work.

```ts
drainOwnedClient(record, {
  sessionMarker: ParsedMarker | null;
  reason: 'close' | 'cancel' | 'timeout' | 'signal';
}): Promise<void>;
```

Drain waits for child close, then requires settled raw streams, no descendants, all
owned Docker exec/jobs terminal (`Running=false`, `Pid=0`, terminal exit status
recorded; zero means success), no owned or unexplained PostgreSQL backend, and no
open ingress connection. Nonzero or cancelled terminal states remain failures, not
successful drains; the original failure is preserved while cleanup runs. It closes
private listener only after all clients drain, revokes the peer capability, and
removes only artifacts/records owned by this run. Missing peer, unknown operation,
foreign connection, changed daemon, live backend, observer error, or cleanup error
leaves the operation uncertain and blocks reset recovery/restoration. No generic
backend kill is permitted; the original failure survives cleanup failure.

Opaque streaming never persists or emits secrets. Receipt data is limited to bound
artifact/endpoint identities, peer/process facts, operation order, required
non-secret witnesses, hashes, drain outcomes, reset epochs, and source/history
digests. Raw request bodies are not logged or copied into receipts.

## 6. Contract-first discriminators and sequence

Compiler lifetime is fixed by the root brief (`briefs/codex-dec203-isolated-native-tracing.md:40-48`): 30-second deadline; one new Linux session/process group
for the explicitly spawned compiler/descendants; one SIGKILL only while PID,
startTicks, session, and group match. Await child/streams, verify no survivors, and
allow five seconds post-cancel. Uncertainty returns `DEC203_COMPILER_FAILED`, keeps
suspect artifacts, reports unproved drain, and forbids SIGTERM/escalation, generic
scan, or broad termination.

RED must precede implementation:

1. Peer primitive: real child peers with false declared PID; concurrent peers;
   invalid/TCP/unconnected/closed descriptors; source/header/output drift; wrong
   owner/mode/symlink/pre-existing output; exact refusal tokens; close revocation.
2. Binding: upstream/ingress mismatch, foreign/replaced socket, changed daemon,
   inherited selector, artifact drift, wrong `DOCKER_HOST`, and admission after
   cancellation. Test metadata/identity, not source tokens.
3. Trace: real supervisor ancestry, PID reuse/start-ticks mismatch, altered raw
   `/proc`, missing shell/Node/native edge, `cp` before start, every pinned CLI
   Docker operation, changed request/response bytes, foreign target, and fabricated
   actor/three-command history.
4. Drain: cancellation/timeout/signal during setup, observers, migration, and
   restore; open ingress, live descendants, running exec/job, backend, observer
   failure, and cleanup failure all refuse restoration.
5. Security/receipt: no secret in logs/receipt, exact CLI argv/stdin preserved,
   no default/remote/host/provider selector, no serialized capability reuse, and
   baseline restore only after all four locks and independent drain.

Implementation order: peer primitive RED/GREEN/review; private ingress and binding/trace DTO; real ancestry/full Docker capture; all-client drain through local session/reset; native 080 driver; cancellation, baseline restoration, review, and runtime evidence. Canonical `db:verify` remains unchanged.

## 7. Remaining proof gates (not owner decisions)

- Actual local `SO_PEERPIDFD`/held-lifetime support is unproven; the five-field
  peer primitive and a native regression remain required before integration.
- Continuous supervisor fork/vfork/clone/exec/exit history, the complete pinned
  CLI operation/witness sequence, and all-client causal drain are still UNRUN.
- The shared Slice-11 executable remains a deliberate pinned read-only artifact;
  adapter attestation must never install, rewrite, or fall back through PATH.
- DTO field names implement the selected constraints, not owner approvals; no
  adapter/reset/receipt/acceptance is released by this design.
