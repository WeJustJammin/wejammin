# Per-run native tracing primitives

Private DEC-203 implementation work. This directory does not install a service,
select a Docker context, change the default stack or activate an upgrade adapter.
The kernel credential primitive is not a complete tracing or authorization system.

| Module                         | Responsibility                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `peer-credentials.mjs`         | Explicit build inputs, fixed runtime checks, verified loading, private reader and synchronous revocation.                   |
| `peer-credentials.c`           | Node-API8 descriptor validation, connected Unix stream checks, descriptor identity brackets and kernel SO_PEERCRED.         |
| `peer-artifacts.mjs`           | Canonical owned-file/directory observations, lossless identities, hashes and identity-guarded output cleanup.               |
| `peer-build.mjs`               | Sanitized existing-compiler launch, owned session fencing, monotonic timeout, stream completion and bounded drain evidence. |
| `peer-lifetime.mjs`            | Separate private lifetime factory, actual receiver-owner attestation and synchronous revocation.                            |
| `peer-lifetime-build.mjs`      | Fixed C/support-header and compiler/header/output attestation with immutable build metadata.                                |
| `peer-lifetime-compiler.mjs`   | Fixed lifetime build recipe retaining the existing compiler/session/drain algorithm.                                        |
| `peer-lifetime-output.mjs`     | Exclusive lifetime-addon output reservation and identity-guarded cleanup.                                                   |
| `peer-lifetime.c`              | Node-API8 tagged lifetime handles obtained through actual SO_PEERPIDFD on a verified owned socket duplicate.                |
| `peer-lifetime-state.h`        | Held socket/pidfd ownership, live/exit checks and one-attempt descriptor cleanup.                                           |
| `stream-ingress.mjs`           | Fixed demand scheduler: one10ms timer, at most8 accept and8 receive attempts per turn.                                      |
| `stream-ingress-build.mjs`     | Fixed stream build inputs, genuine owner-build registry and before/after artifact brackets.                                 |
| `stream-ingress-compiler.mjs`  | Separate fixed stream recipe using the existing compiler/session/drain algorithm.                                           |
| `stream-ingress-output.mjs`    | Exclusive output, verified loader and immutable owned socket identities.                                                    |
| `stream-ingress-facades.mjs`   | Private receiver resolution, public capability wrapping and new-result unwind.                                              |
| `stream-ingress-ownership.mjs` | Genuine native parent/child construction, synchronous revocation and retained uncertainty.                                  |
| `stream-ingress.c`             | Sole native listener/accept/recvmsg entry, tagged Node-API8 handles.                                                        |
| `stream-ingress-state.h`       | Refcounted native ownership, descriptor ledgers and one-attempt cleanup.                                                    |
| `stream-ingress-listener.h`    | Exact receive options, owned socket identity, nonblocking listen/accept.                                                    |
| `stream-ingress-receive.h`     | Bounded ancillary validation and native-owned byte segments.                                                                |
| `stream-ingress-writer.h`      | Held received-writer pidfd poll→fdinfo→poll linkage.                                                                        |
| `stream-ingress-values.h`      | Tagged capability values, diagnostic copies and NAPI/finalizer unwind.                                                      |

The private factory is
`buildPeerCredentialReader({ runDirectory, compilerPath, includeDirectory })`.
All paths are explicit and canonical. The caller supplies an empty, current-UID
mode0700 directory; the factory owns only its exclusively reserved addon output.
It uses the existing compiler and Node headers, never a shell or package installer.
Node22.23.1 and Node-API8 are required. The host compiler, operating system and
transitive headers remain trusted; this is not a hermetic build.

The frozen result exposes exactly `read`, `close` and immutable build `metadata`.
`read(socket)` returns kernel `{ pid, uid, gid, device, inode }` for a supported
live Node Unix stream socket. Device/inode are lossless decimal strings. A claimed
PID, serialized metadata or matching JavaScript fields do not authorize work.
`close()` immediately revokes reads and removes only the exact owned output;
it preserves replacements and caller data, and does not unload a native library.
Unproved compiler drain refuses a reader and retains suspect evidence/artifacts.

The separate lifetime factory is
`buildPeerLifetimeReader({ runDirectory, compilerPath, includeDirectory })`.
Its frozen reader exposes exactly `open`, `close` and `metadata`; `open(socket)`
returns a frozen `read`/`close` capability for that connection-time peer lifetime.
It uses SO_PEERPIDFD directly, never a later PID-based fallback. Native receiver
type tags precede unwrapping; module-private facade ownership prevents serialized
metadata from constructing a capability. Build metadata additionally records the
fixed local support header. Every nonclosed open/read attests its actual owner's
source/compiler/headers/output, including a read with cached peer exit. Closed
capabilities refuse before artifact access; closing the reader revokes all its
handles before awaiting cleanup. Unsupported or ambiguous kernel state refuses.

The lifetime primitive still does not identify the writer of each queued byte,
the executable image at send, a PostgreSQL backend or Docker job. Those subjects
need their own genuine native producers; the socket peer pidfd cannot replace them.

The separate stream factory is
`buildNativeStreamIngress({ runDirectory, compilerPath, includeDirectory })`.
It owns its per-run `docker.sock` listener and reserves `stream-ingress.node`.
Its ingress exposes only `accept`, `close`, `endpoint`, `identity` and `metadata`;
accepted streams expose `receive`/`close`. A nonempty received segment owns its
original native bytes and exactly one kernel credential/pidfd writer association.
`copyBytes()` returns a fresh diagnostic copy; `writer.read()` rechecks the held
writer lifetime. `release()` revokes both and returns credit once. Actual validated
EOF returns null, never an empty segment or writer credential. No JavaScript socket
reader competes with recvmsg. Caps are16 streams,4 segments per stream and32 total.
This primitive does not infer historical executable images, HTTP operations,
Docker jobs or database backends. It does not forward bytes or authorize clients.
Stream implementation is under validation, not adapter acceptance. The pending-call
attestation repair followed genuine RED; the current24-case native cohort passes.
Receipts are in the native validation handoff. Native/rare-fault gates stay open.

SO_PEERCRED describes connection-time credentials, not current peer lifetime or
historical process ancestry. The wrapper is not an unforgeable security boundary
against arbitrary same-process JavaScript. Future integration still requires a
private accepted-socket registry, live peer-instance fencing, continuous owned
process history, closed Docker-operation admission and independent all-client
drain before restoration. Pathname checks are not descriptor-atomic protection
against hostile same-UID writers.

Actual primitive tests live in
`tests/native/phase-02-slice-11-peer-credentials.mjs` and
`tests/native/phase-02-slice-11-peer-lifetime.mjs`. Stream controls are in
`tests/native/phase-02-slice-11-native-stream-ingress.mjs`; fixtures are test-only and
do not supply production credentials. Current execution receipts, exclusions and
remaining gates are recorded in the Slice12 native validation handoff. Primitive
or injected binding results never clear native080, canonical database validation,
hosted acceptance or phase completion.

## Contents

Modules, Node-API C sources and headers in this directory are listed in the
table at the top: the peer-credential reader, the peer-lifetime reader, the
stream ingress and the receiving-bootstrap and lease machinery
(`receiving-bootstrap-*`, `receiving-lease*`, `receiving-native-*`). Their
tests are in `tests/native/` and `tests/contracts/`.

## Ownership

The DEC-203 native validation work owns this directory. Its files are frozen
source for pinned receipts (`.memory/pipeline/progress/verification/` holds
SHA-256 values), and the bootstrap profile names its source files explicitly.
Native, database, hosted and phase acceptance stay open.

## Extension

Do not add or edit a file here without a root-owned decision: the bootstrap
profile lists its source files by name, and any edit changes a pinned hash. A new
primitive follows the existing split of a public `.mjs` factory, a separate fixed
build recipe and a `.c` source with `.h` state headers, plus new tests in
`tests/native/` that run under the pinned Node 22.23.1.

## Conventions

Paths are explicit and canonical, builds use only the existing compiler and Node
headers (never a shell or package installer), and every handle is revoked
synchronously on close. Unproved or ambiguous kernel state refuses. No `any`; no
`TODO` markers.

## Related links

- [Database upgrades](../README.md)
- `tests/native/README.md`
- `tests/contracts/helpers/README.md`
- `.memory/wiki/decisions.md` (DEC-203)
