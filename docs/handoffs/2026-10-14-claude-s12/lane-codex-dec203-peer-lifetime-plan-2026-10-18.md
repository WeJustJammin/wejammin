# DEC203 peer-lifetime plan: SO_PEERPIDFD held capability

Status: design-only. No production or test implementation is released by this
document. Author: native gpt-6.1-sol/ultra. Scope: one new handoff file.

## 1. Baseline and decision boundary

The frozen DEC203 primitive remains the only accepted implementation boundary:
`buildPeerCredentialReader({ runDirectory, compilerPath, includeDirectory })`
builds the fixed Node-API 8 addon, and its `read(socket)` returns kernel
`pid`, `uid`, `gid`, `device`, and `inode`. Its four production files and the
33-case native evidence remain unchanged.

SO_PEERPIDFD is a separate, private capability. It may report that the process
represented by a held pidfd is still live; it does not authorize a request,
prove process ownership, or replace the existing five-field reader. No fallback
from SO_PEERPIDFD to a claimed PID, SO_PEERCRED-only forwarding, `pidfd_open`,
pathname lookup, or a serialized token is permitted.

The capability cannot be used for forwarding until an owner-approved accepted-
socket registry and continuous fork/vfork/clone/exec/exit history exist. A
pidfd plus an instantaneous `/proc` observation is not that history.

## 2. Closed private interface

The future wrapper exports one new private builder; it does not widen the
existing builder or accept caller-selected source/addon paths:

```ts
type PeerLifetimeObservation = Readonly<{
  pid: number;        // positive integer from SO_PEERCRED at open
  fdInfoPid: number;  // positive integer from this handle's fdinfo at read
  alive: true;        // returned only after the live check passes
}>;

type PeerLifetimeHandle = Readonly<{
  read(): PeerLifetimeObservation; // synchronous, no arguments
  close(): void;                    // synchronous, idempotent
}>;

type PeerLifetimeArtifact = Readonly<{
  path: string; sha256: string; device: string; inode: string;
  size: number; mode: number; uid: number;
}>;

type PeerLifetimeMetadata = Readonly<{
  node: Readonly<{ path: string; version: 'v22.23.1'; napi: 8 }>;
  source: PeerLifetimeArtifact; compiler: PeerLifetimeArtifact;
  headers: readonly PeerLifetimeArtifact[]; // sorted by basename
  output: PeerLifetimeArtifact;
}>;

type PeerLifetimeReader = Readonly<{
  open(socket: NodeJS.Socket): PeerLifetimeHandle;
  close(): Promise<void>;           // revokes opens before its first await
  metadata: PeerLifetimeMetadata;
}>;

buildPeerLifetimeReader(options): Promise<PeerLifetimeReader>;
```

`options` has exactly the existing three string keys
`compilerPath`, `includeDirectory`, and `runDirectory`. The new builder fixes
its adjacent `peer-lifetime.c` source and `peer-lifetime.node` output; it never
accepts `sourcePath`, an addon path, a pidfd, or a credential callback.
It retains the existing canonical-path, non-symlink, owner/mode, fresh-run,
sanitized-environment, artifact-hash, and compiler-drain requirements.

The native addon exposes exactly `openPeerPidfd(fd: number)`. It returns a
Node-API-wrapped native handle, never a raw pidfd or raw pointer. The wrapper's
`open` obtains the descriptor only from the pinned real Node 22 Socket shape,
then passes the integer to the addon. `PeerLifetimeHandle.read` accepts no
numeric, PID, path, or metadata argument.

The wrapper owns one fixed, non-secret `napi_type_tag` UUID for
`PeerLifetimeHandle`. Every wrapped method calls
`napi_check_object_type_tag` (Node-API 8) before `napi_unwrap`; a false or
null match, a plain object, copied JSON, forged prototype, Proxy, or foreign
addon wrapper fails with `DEC203_PIDFD_INVALID_CAPABILITY`. Only a matching
tagged object reaches native state. An unbound/cross-object copied method
fails; explicitly calling that method with the same genuine tagged receiver
remains valid and is not a forgery. The object is frozen after methods are
installed. Native state contains the duplicated socket fd, kernel-returned
pidfd, initial peer PID, socket identity, and closed bit; none is exposed to
JavaScript.

## 3. Native open and numeric ownership rules

`openPeerPidfd` accepts exactly one JavaScript Number. Node-API validation
requires finite, integral `0 <= fd <= INT_MAX` and exact double-to-int
round-trip. Reject strings, BigInt, null, undefined, NaN, infinities,
fractions, negatives, and values above `INT_MAX` with
`DEC203_PIDFD_INVALID_SOCKET`.

The native call must:

1. `fstat` the caller fd and require a socket; duplicate it with
   `F_DUPFD_CLOEXEC` and retain only the duplicate.
2. Require `SO_TYPE == SOCK_STREAM`, `SO_DOMAIN == AF_UNIX`, and a successful
   connected `getpeername`; compare the original and duplicate identities.
3. Read `SO_PEERCRED` and retain its positive `pid` solely as the linkage
   witness. The caller fd is never closed.
4. Call `getsockopt(SOL_SOCKET, SO_PEERPIDFD, ...)` on the retained duplicate,
   requiring an exact `socklen_t == sizeof(int)` and a nonnegative returned fd.
   The returned pidfd is owned by the native handle and is closed exactly once.
5. Re-fstat the caller fd and reject device/inode/mode/uid/gid drift before
   returning the wrapped handle. No `pidfd_open(peer_pid)` is allowed.

Compile-time absence of `SO_PEERPIDFD` is an unavailable capability, not a
stub. Runtime `ENOPROTOOPT`, `EOPNOTSUPP`, `ENOSYS`, or an equivalent
unsupported-kernel result maps to `DEC203_PIDFD_UNAVAILABLE` after the socket
kind checks. Other invalid-descriptor errors map to
`DEC203_PIDFD_INVALID_SOCKET`; no unsupported result becomes success.

## 4. Held-pidfd read semantics

`read()` first rejects a closed native state and re-fstats the retained socket
duplicate, requiring the pinned identity to match. Each liveness poll is
`poll(nfds=1, events=POLLIN, timeout=0)`, interpreted fail-closed:

* `rc < 0` (including `EINTR`), `rc > 1`, or an rc/revents inconsistency maps
  to `DEC203_PIDFD_UNAVAILABLE`; never retry.
* If `rc == 1` and any known terminal bit is set,
  `(revents & (POLLIN|POLLHUP)) != 0`, throw `DEC203_PIDFD_PEER_EXITED`.
  `POLLIN` alone or `POLLHUP` alone is terminal, and terminal wins `POLLERR`.
* `rc == 1` without a terminal bit (lone `POLLERR`, `POLLNVAL`, or unknown
  bits) maps to `DEC203_PIDFD_UNAVAILABLE`.
* Only `rc == 0` with `revents == 0` continues; unknown bits are never live.

Run `poll → fdinfo → poll`. Read only `/proc/self/fdinfo/<pidfd>`, requiring
exactly one `Pid:` value. A positive value must equal stored `SO_PEERCRED`;
malformed, nonpositive (including `Pid:-1`), or mismatching values proceed to
the second poll so an exit event gets precedence. Its terminal result is
`PEER_EXITED`; an exact zero returns the frozen three-field result only for a
matching positive PID, otherwise `UNAVAILABLE` (malformed/nonpositive) or
`LINKAGE_CHANGED` (positive mismatch). No `/proc/<pid>` or unrelated scan is
permitted. A terminal result latches peer-exited: further reads repeat
`PEER_EXITED` until explicit close, which always returns `CAPABILITY_CLOSED`
first. Linux `PIDFD_STALE` can make an already-dead peer's pidfd readable;
forwarding still requires the separate continuous-history gate.

Closed error tokens are exact and stable:

| Condition | Code and message |
| --- | --- |
| Invalid number, wrong socket, or caller descriptor closed/reused before open | `DEC203_PIDFD_INVALID_SOCKET` |
| Missing/unsupported option, malformed pidfd observation | `DEC203_PIDFD_UNAVAILABLE` |
| Valid handle after `close()` or reader after revocation | `DEC203_PIDFD_CAPABILITY_CLOSED` |
| Forged/unwrapped native receiver | `DEC203_PIDFD_INVALID_CAPABILITY` |
| Held process exited | `DEC203_PIDFD_PEER_EXITED` |
| fdinfo PID no longer links to the open-time PID | `DEC203_PIDFD_LINKAGE_CHANGED` |
| Pinned socket identity drift | `DEC203_PIDFD_IDENTITY_CHANGED` |
| Owned close syscall failed after revocation | `DEC203_PIDFD_CLEANUP_FAILED` |

Every error has identical `.code` and `.message`. No raw errno, path, pidfd,
request data, or PII is placed in the message. These are capability tokens
only; existing DEC203 build, load, artifact, and compiler tokens remain exact
and are never remapped to capability errors.

## 5. Revocation and cleanup

`PeerLifetimeHandle.close()` sets the native closed bit before any syscall and
returns `undefined` on repeated calls. A native `take_fd(int *slot)` sets each
owned slot to `-1` before making its one `close(fd)` attempt. Both pidfd and
duplicated-socket attempts run even if the first fails; no EINTR or other
close error is retried because the integer could already be reused. Any
attempted close error, including `EBADF`, reports
`DEC203_PIDFD_CLEANUP_FAILED`; an already-detached `-1` slot is not an error
on a repeated call. The closed bit remains permanent and the caller's
descriptor is never closed.

Before successful wrapping, C is sole owner of the allocation and acquired
slots. Every allocation, tag, wrap, or prevalidation failure detaches both
slots, attempts each close once, and frees the allocation exactly once. After
successful wrapping, the finalizer is sole allocation owner; a post-wrap
freeze/validation failure synchronously revokes, detaches, and closes both
fds but never frees behind the finalizer. The finalizer later takes each slot,
attempts each close once while ignoring errors, then frees once; it never
throws to JavaScript, retries EINTR, stale-closes, or closes the caller fd.

The wrapper tracks opened handles in a private set. `PeerLifetimeReader.close`
revokes new opens, synchronously closes every tracked handle, then performs
the existing asynchronous build-artifact cleanup. It attempts every handle
close, retains the first cleanup error, and rejects only after all handles have
been revoked/attempted; the reader stays permanently closed. A foreign
replacement at an artifact path remains untouched. Read-after-revocation
always returns the closed token, even if artifact cleanup later fails.

## 6. Registry and lifetime proof required before forwarding

The accepted-socket registry must key entries by the actual accepted Socket
object and its private handle, not by PID, path, JSON, or `(device,inode)`
alone. On accept it opens one `PeerLifetimeHandle`; on socket close/error it
closes and removes that entry. Request code may retrieve only the exact object
entry and may not substitute a serialized observation.

Closing or reusing the original caller fd after a successful open cannot
invalidate or retarget the retained duplicate/pidfd. The registry still
revokes the exact Socket entry on its close/error event; this is separate from
the native handle's owned-fd lifetime.

Forwarding a peer identity requires an owner-approved witness stream that began
before accept and records every fork, vfork, clone, exec, and exit transition
for the accepted process and any permitted descendant. Missing, reordered, or
gapped history is a refusal. The pidfd liveness result is an input to that
witness check, never its replacement. No post-hoc PID snapshot, pidfd_open,
or broad `/proc` scan closes this boundary. The root-owned tracer/supervisor
direction is selected; no new history-witness owner choice is introduced.

## 7. Race and failure matrix

| Event | Required result |
| --- | --- |
| Caller closes/reuses fd during open/read | Open-time duplicate plus before/after identity checks refuse; after success the retained duplicate/pidfd remain bound and cannot retarget, while the caller fd remains caller-owned. |
| Peer is already dead at open | SO_PEERPIDFD may return a stale-readable pidfd; first poll classifies either terminal `POLLIN` or `POLLHUP` as `PEER_EXITED`. |
| Peer exits after open | Held pidfd latches `PEER_EXITED`; PID reuse cannot retarget it until explicit close. |
| First/second poll has lone error or unknown bits | `UNAVAILABLE`; no nonzero mask is interpreted as live. |
| fdinfo PID differs from open-time PID | `LINKAGE_CHANGED`; never forward. |
| fdinfo is malformed or `Pid:-1` | Second poll gets exit precedence; otherwise `UNAVAILABLE`. |
| Unsupported kernel/socket option | `UNAVAILABLE`; no SO_PEERCRED fallback. |
| Single-isolate synchronous close/read order | Native closed bit wins once close is invoked; read gets `CAPABILITY_CLOSED`. |
| Fork/exec descendant has no continuous witness | Registry refuses forwarding despite a live original pidfd. |
| One owned close returns an error | Both slots were detached/attempted; state stays closed, any attempted error is explicit, and repeat close cannot retry a stale integer. |
| Finalizer runs after partial failure | Nonthrowing one-shot attempts consume both slots; no stale close or leak claim is inferred from ignored errors. |

## 8. Minimal future paths and safe reuse

Proposed new paths only: `infra/database-upgrades/native-tracing/peer-lifetime.mjs`,
`peer-lifetime.c`, one native fixture/helper pair, one focused native test file,
and a GREEN handoff. The frozen peer-credentials files remain untouched.

The existing artifact identity and compiler-drain algorithms may be copied into
a new fixed-source builder only if source, header list, output basename,
attestation records, environment, and cleanup remain separately pinned. The
current builder hardcodes `peer-credentials.c` and `peer-credentials.node`, so
it is not safe to add a caller-selected source or silently reuse its output.

## 9. TDD and acceptance sequence

1. RED: require the absent builder and assert the closed interface, exact
   tokens, no raw-fd fields, and no fallback branch.
2. Compile an actual Node-API 8 fixture with the existing explicit compiler and
   headers. Exercise positive connected Unix stream, wrong kinds, all numeric
   invalids, closed/unconnected sockets, and caller-fd preservation.
3. Exercise actual SO_PEERPIDFD support. On an unsupported kernel, assert the
   exact `UNAVAILABLE` outcome; this is a recorded branch, never a skipped test.
4. Verify the actual tagged receiver, fdinfo linkage, the exact poll/fdinfo/
   poll sequence, peer exit, opening after peer exit, close revocation,
   repeated close, reader-wide revocation, partial close failure, and no
   owned-fd leak in a dedicated child process. Closing the original caller fd
   after open must not invalidate or retarget the held capability.
5. Attempt plain-object, JSON, Proxy, forged-prototype, foreign/untagged
   copied-method receivers, and raw integer-handle substitutions; all must
   fail without invoking native state. A copied method explicitly called with
   any genuine tagged receiver must remain valid. Include unknown poll bits,
   `POLLERR`, terminal `POLLIN`/`POLLHUP` masks, and malformed/`Pid:-1`
   fdinfo cases.
6. Add descriptor identity drift and single-isolate synchronous close/reuse
   invocation-order fixtures. Preserve caller files and foreign replacements;
   do not claim arbitrary concurrent-race proof.
7. Add registry/history negative cases. No forwarding test may pass from a
   pidfd-only or post-hoc `/proc` observation.
8. Root-owned compile, runtime, lint, and independent source review must pass
   before any integration claim. Native success remains distinct from ingress,
   Docker, reset, or production acceptance.

## 10. Current source anchors

The existing JavaScript capability and socket-shape guard are in
`infra/database-upgrades/native-tracing/peer-credentials.mjs:124-209`.
The Node-API numeric validation, descriptor duplication, AF_UNIX/SOCK_STREAM
checks, SO_PEERCRED acquisition, and before/after fstat bracket are in
`peer-credentials.c:35-62` and `peer-credentials.c:81-112`. Compiler session,
stream, and settlement ownership are in `peer-build.mjs:13-65` and
`peer-build.mjs:194-248`. The DEC203 brief fixes the five-field boundary and
explicitly says SO_PEERCRED does not prove lifetime or request attribution.

## 11. Open proof boundary

Linux source review says SO_PEERPIDFD derives a pidfd from the socket's stored
peer PID. In Linux v6.17, `PIDFD_STALE`/`pidfd_prepare` can preserve a
readable pidfd for an already-dead task; this is source evidence for the
open-after-exit test, not local syscall proof. Read the pinned primary sources:
`https://raw.githubusercontent.com/torvalds/linux/v6.17/kernel/fork.c`,
`https://raw.githubusercontent.com/torvalds/linux/v6.17/net/core/sock.c`, and
`https://raw.githubusercontent.com/torvalds/linux/v6.17/fs/pidfs.c`. Node's
type-tag contract is the Node-API 8 documentation at
`https://nodejs.org/download/release/v22.23.1/docs/api/n-api.html#napi_type_tag_object`.

The current header constant and local kernel observation are not syscall
proof. Before implementation, root must pin target kernel/header behavior and
decide who supplies continuous accepted-socket lifecycle witness. Capability-
only TDD and an actual feature test may precede history integration, but
cannot clear the forwarding gate: registry plus continuous history remain
mandatory. Until both are evidenced, this plan remains private liveness
diagnostics only; no counterfeit compiler or kernel proof is accepted.
