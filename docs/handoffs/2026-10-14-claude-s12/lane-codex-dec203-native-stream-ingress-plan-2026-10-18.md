# DEC203 exclusive native stream ingress — proposed primitive

Design only; author source-only UNRUN. No source/TEST release, activation,
forwarding, HTTP implementation, reset or native acceptance follows from this plan.
Frozen peer-credentials and peer-lifetime modules/interfaces remain unchanged.

## Approach and scope

A separate fixed-source Node-API8 addon owns listener, accept and recvmsg exclusively.
It retains each received segment's original bytes and kernel-supplied writer pidfd.
Node schedules bounded nonblocking calls; no Node Socket/libuv reader owns these fds.
This is a byte/writer evidence primitive, not a Docker or process-history authority.

Inputs read: root tracing brief; `briefs/codex-dec203-stream-writer-source-inventory.md`;
peer-lifetime plan SHA`22ae73078eb919f5d30eb662b9ea6091758e11d3c49ca4d31e337e2ce2f582ce`;
fixed-build plan SHA`9a63dbcd28d458132c2f3e06f2124b8240209af0931d7d4c11186b59544f3569`.
All document paths above are under this handoff directory. Existing trusted-host,
unprivileged owned-run assumptions apply; no hostile privileged/same-UID-JS protection.

## 1. Source evidence and limits

Root's immutable Linuxv6.17 inventory pins `af_unix.c` SHA`4ceb96094d9e65166901d3a9017a9049a5ef3eaec7252f40b5667d45a49c2887`.
Its1762–1765 copies listener receive-SCM flags into the newly connected server socket;
1889–1901 accepts that queued socket. `sock.c`1547–1566 sets the receive flags and
1869–1881 reports them (SHA`25305e30f6a89ac625b6b244128410295da1b4ac25327cd875126f7c4718cf05`).
The pinned generic ABI header defines PASSCRED16/PASSPIDFD76/PASSRIGHTS83, not local ABI.
No numeric fallback is permitted: actual compiled headers/options and queued-before-
accept native controls must establish support on the actual custom kernel.
Root additionally pinned `include/net/sock.h` SHA`3e8ec10a3bb01e5ea527ca2261c6bdbe39d12dc8d9f03a0ee55da22f421f3479`:
534–543 overlays the SCM credential/security/pidfd/rights bits, so inheritance includes
rights. sock.c1568–1573/1883–1888 sets/gets PASSRIGHTS; af_unix1118 defaults it on,
2496–2500 refuses stream-send rights with EPERM when off. Set it off before listen.
Root's scm.c183–239/249 permits only RIGHTS/validated CREDENTIALS for SOL_SOCKET send;
other types reject/destroy.465–499 installs pidfd only for a nonnegative prepared file.
These supplied source facts reduce the surface, not actual-kernel support/fault proof.

The inventory's SCM paths retain sender TGID/UID/GID, stop aggregation on sender
identity changes and can deliver a pidfd. They do not promise one recv per send,
one image per PID, live sender, sufficient fd capacity or untruncated control data.
Connection-time SO_PEERCRED/SO_PEERPIDFD is never substituted for per-segment SCM.
Explicit credentials remain subject to kernel namespace/capability assumptions;
unknown/privileged identity provenance cannot be excused by a positive number.

## 2. Closed public primitive

Proposed export `buildNativeStreamIngress(options)` has exactly the existing three
own string data keys: `runDirectory,compilerPath,includeDirectory`. Reject accessors,
Proxy/unknown options and source/addon/flags/fd/PID/socket/scheduler overrides.
Use the same canonical path, current-UID, non-symlink, empty0700 build-parent guards.
The parent is caller-owned; this primitive never removes it or an unrelated entry.

```ts
type Ingress = Readonly<{
  accept(): Promise<AcceptedStream>;
  close(): Promise<void>;
  endpoint: string;
  identity: Readonly<{parent: PathIdentity; socket: PathIdentity}>;
  metadata: BuildMetadata;
}>;
type AcceptedStream = Readonly<{
  receive(): Promise<Segment | null>; // null means actual read EOF only
  close(): void;
}>;
type Segment = Readonly<{
  copyBytes(): Buffer; // diagnostic/parser copy, never authoritative storage
  writer: Writer;
  release(): void;
}>;
type Writer = Readonly<{
  read(): Readonly<{pid: number; uid: number; gid: number; fdInfoPid: number; alive: true}>;
}>;
```

Those are exact own keys; every facade is frozen. Methods accept no extra arguments.
One pending accept per ingress and one receive per stream; concurrent duplicates refuse.
Factory compilation/drain/load precedes native listen. No upstream is opened.
`endpoint` is exactly `unix://` plus canonical `runDirectory/docker.sock`, under108
UTF-8 path bytes. Existing output/socket names cause refusal, never adoption/unlink.
PathIdentity has exactly `path,device,inode,mode,uid`, with lossless decimal identities;
full modes are parent040700/socket0140600. These snapshots are diagnostics, not brands.
Native socket-object fstat identity and filesystem socket-entry identity are distinct;
record both privately and never equate their inode/device tuples.

Private addon exports only `createIngress(parentPath)`; owner accept/close and stream
receive/close are exact sync methods; segment copyBytes/writer/release and writer read.
Native objects are frozen; no-argument methods tag-check before unwrap. No adoption API.
Exact mirror/attestation: `lane-codex-dec203-native-stream-interface-2026-10-18.md`.

## 3. Listener timing and bounded scheduler

C opens/retains a verified parent dirfd and creates AF_UNIX/SOCK_STREAM with NONBLOCK
and CLOEXEC. Set SO_PASSCRED=1, SO_PASSPIDFD=1 and SO_PASSRIGHTS=0; get/require those
three exact integer results before bind/listen. Pin actual ABI; missing/unsupported
support refuses UNAVAILABLE and closes acquired state, with no getsockopt-only success.
Bind the exclusive fixed path, establish0600 without changing process umask, verify
the actual entry/parent identities, then listen. Parent0700 protects setup; same-UID
adversarial replacement is outside the trust model, but observed drift always refuses.
Use accept4 NONBLOCK|CLOEXEC; verify accepted kind/domain/options and pinned fd state.
Require accepted PASSCRED/PASSPIDFD still1 and PASSRIGHTS still0, without late enablement.
Options must already apply when a peer writes before accept, not be enabled afterward.
Never pass the listener/accepted descriptor to net.Server, Socket or another reader.

Native accept/receive use poll(timeout0), accept4 and recvmsg(DONTWAIT|CMSG_CLOEXEC).
The JS facade runs at most one real10ms timer while demand can progress; no worker,
native blocking poll, uv reader or user callback/timer injection. Stop idle timers.
JS rounds perform at most8 accepts and8 receives, round-robin over at most16 streams.
Per receive:16KiB data and16KiB control; at most4 outstanding segments per stream,
32 total. Check credits before recvmsg; exhausted credits suspend reads, not drop data.
These are primitive resource bounds, not HTTP/body/archive size or workload policy.
At the connection limit stop accepting; kernel backlog/backpressure remains bounded
by the native listener configuration (backlog16). Do not accept-and-forget a peer.
No invented whole-body buffer/spool/deadline policy. Pending I/O waits for progress,
EOF/error or explicit close; root harness bounds its waits, future run deadlines differ.

EAGAIN/EWOULDBLOCK means no progress, never EOF; EINTR/other poll/recv errors fail closed
as IO_FAILED rather than a speculative retry inside one turn. Validate readiness masks.
HUP does not discard queued bytes: continue attributed receives until actual recvmsg0.
EOF requires zero bytes and no unexpected control result, distinct from would-block.
It is delivered after earlier segments, once; later receives return null while open.
EOF neither closes outstanding writer handles nor proves the writer process exited.
Close/error rejects pending operations exactly once; no rearm after revocation.

## 4. Receive, byte and ancillary ownership

Each successful nonempty recvmsg yields one exact-length private segment, not an HTTP
message or a presumed sender write boundary. Before publishing anything, scan the whole
bounded control region and ledger every identifiable installed fd, even after a fault.
Require exactly one SOL_SOCKET/SCM_CREDENTIALS with exact ucred size and one SCM_PIDFD
with exact int size and nonnegative fd. Credential PID must be positive; UID/GID
are uint32 values including0; namespace/history admission remains a separate gate.
Reject missing/duplicate credentials or pidfd, negative pidfd, bad lengths/alignment,
unknown levels/types, MSG_CTRUNC, MSG_TRUNC and every unrequested SCM_RIGHTS.
The pidfd is kernel-received ownership, not pidfd_open(SCM_PID) or a claimed handle.

Every well-bounded received SCM_RIGHTS fd and extra received pidfd enters the ledger
for one-shot cleanup; no early return skips later cmsgs. Adopt only the single required
pidfd into a Writer after the entire receive validates. Rejected payload bytes never
escape and a consumed malformed receive poisons/closes that stream; do not retry/replay.
Unknown payload integers are not guessed to be fds. If malformed/unknown ancillary
prevents proving complete descriptor enumeration, poison the owner, close known owned
slots once and report cleanup uncertain. No guessed process-wide scan/close is allowed.
That uncertainty latches privately: close cannot resolve it as proven resource cleanup.
Before GREEN, pin/prove which SCM types can install fds on the actual ABI and how the
kernel disposes truncated undelivered rights. Source review alone cannot clear this gate.
PASSRIGHTS0 should prevent rights queuing, but the defensive ledger is still mandatory;
it does not stop the client socket being transferred over a different control channel.

Retain original bytes in the native Segment until release. copyBytes returns a fresh
Node-owned Buffer copy: mutation cannot change native bytes or their writer binding.
No external Buffer is re-adopted as attributed data; Buffer freeze is not immutability.
The private registry binds exact stream/segment/native-writer objects and sequence;
metadata, hashes and numeric PID do not manufacture that relationship.
release revokes the segment/writer, frees original bytes and returns its credit once;
retained diagnostic copies belong to the caller/GC and are not native-authorized bytes.
No payload is logged, persisted or hashed merely to identify its writer.
Future parsing/authorization must consume the same private bytes, not caller copies;
this primitive exposes no forwarding/sink/grant API to make that integration look done.

## 5. Writer lifetime and genuine receivers

Writer.read checks its own closed state first, then poll→self-fdinfo→poll on the held
SCM pidfd. Both polls are timeout0; only rc0/revents0 is live. POLLIN or POLLHUP is
terminal (wins error bits); lone ERR/NVAL, unknown bits, EINTR or inconsistent results
refuse UNAVAILABLE. Require exactly one positive fdinfo Pid equal to SCM credential PID.
Second-poll exit wins; malformed/nonpositive linkage refuses UNAVAILABLE, positive
mismatch LINKAGE_CHANGED. Exit latches WRITER_EXITED until release/close takes precedence.
No unrelated `/proc/<pid>` lookup, numeric reuse assumption or connector fallback.

Separate per-type fixed Node-API8 type tags guard native owner/stream/segment/writer
objects before unwrap. Reject plain/Proxy/foreign/wrong-type receivers and null unwrap.
Facade WeakMaps map genuine receivers to native handles and their actual owner build;
copied methods on any registered genuine receiver use that receiver's owner, not the
function creator. Another module instance's facades remain foreign. Metadata grants none.
No native fd, pointer, pidfd, native object or mutable original byte storage is exposed.

The pidfd proves a retained kernel writer lifetime input, not ImageRef at send time.
Same PID/pidfd across exec does not identify which image wrote a queued segment.
Joining segment identity to continuous owned history, namespace, run/phase/permit and
actual send-image ordering remains a separate refusal-until-proved integration gate.

## 6. One-close, partial allocation and resource failure

All fd slots start at-1. Detach/set-1 before each single close attempt; never retry
EINTR/EBADF or another close result because the integer may have been reused.
Attempt every owned slot despite the first failure. No caller/foreign fd is closed.
Segment.release and stream.close revoke synchronously and are idempotent; stream close
also revokes/releases its segments/writers. Ingress.close revokes everything and stops
the scheduler before its first await, settles waiters, attempts all child/listener/dirfd
closes, then identity-checked socket/output cleanup. Retain the first failure.
Do not unlink a replacement occupying either path or remove the caller parent.
A close error is explicit CLEANUP_FAILED, not proof of descriptor drain; keep evidence.

Before napi_wrap succeeds C owns allocation/bytes/fds and unwinds every acquired slot.
After wrap succeeds its finalizer owns allocation; post-tag/property/freeze/result-array
failure revokes/closes/frees byte storage but never frees behind that finalizer.
Native group lifetime is refcounted across wrapped children; parent finalization revokes
all children, while group allocation outlives them. Children detach before final free.
Finalizers close remaining slots once, never throw/retry or count as observed drain.
Received-fd ownership is registered before any NAPI allocation. Failure after consuming
bytes cannot return would-block or silently lose a segment: fail/revoke, clean all known
resources and reject. Normal leak loops do not prove rare NAPI/syscall failure branches.
Post-native wrapper/attestation failure revokes every newly returned batch object too.
Unconstructible NAPI errors preserve the pending exception after cleanup, never fake EOF.

## 7. Fixed build, metadata and closed errors

Copy only the frozen generic artifact checks and fixed30s/5s compiler-drain algorithm
under new exact names/output. Do not edit/import a caller-selectable old builder.
Compile fixed `stream-ingress.c` with exactly its five fixed support headers below,
Node-API8/four pinned Node headers, existing compiler, sanitized environment and no shell.
C includes only the five listed local headers; they have no further local includes.
No untracked local include, source/addon/flags override, package or V8/libuv ABI.
Output is exclusively reserved `stream-ingress.node`; retain build/drain/load checks.
Before/after owner-build attestation brackets all nonclosed operations, cached results too.
Uncertain compiler drain returns no ingress/retains ownership; close/release bypass drift.
Metadata has exactly node/source/compiler/headers/supportSources/output, deeply frozen;
node is `{path,version:'v22.23.1',napi:8}`; artifact records exactly
`{path,sha256,device,inode,size,mode,uid}`. Support/header lists are fixed and sorted.

Preserve build-only tokens DEC203_INVALID_BUILD/COMPILER_FAILED/IDENTITY_CHANGED/
NATIVE_UNAVAILABLE. Capability tokens all prefix `DEC203_STREAM_` with code==message:
INVALID_CAPABILITY, CAPABILITY_CLOSED, UNAVAILABLE, IDENTITY_CHANGED, PROTOCOL,
WRITER_EXITED, LINKAGE_CHANGED, LIMIT, IO_FAILED, CLEANUP_FAILED. Duplicate pending calls
use LIMIT; credit backpressure is normal waiting, not LIMIT. No raw errno/path/payload.
Programming errors never become a successful capability, EOF or cleanup proof.

## 8. Proposed exact paths and smallest next release

All production paths below are NEW under `infra/database-upgrades/native-tracing/`;
each targets natural≤300 lines. Feasibility needs later formatted source review.

| Filename | Responsibility |
| --- | --- |
| `stream-ingress.mjs` | Public builder/facades, tracked ownership and bounded shared scheduler. |
| `stream-ingress-build.mjs` | Fixed options/manifest/build/load/metadata and retention. |
| `stream-ingress-compiler.mjs` | Fixed-source compiler copy with exact old inverse. |
| `stream-ingress-output.mjs` | Exclusive fixed output reservation/identity only. |
| `stream-ingress.c` | Node-API export and exact sync owner accept/close, stream receive/close mirror. |
| `stream-ingress-state.h` | State, group lifetime, credits, fd ledger and one-shot cleanup. |
| `stream-ingress-listener.h` | Native parent/socket setup, option timing, accept and readiness. |
| `stream-ingress-receive.h` | Bounded recvmsg, complete ancillary validation and segment creation. |
| `stream-ingress-writer.h` | Held SCM pidfd liveness/linkage, no adoption. |
| `stream-ingress-values.h` | Segment/writer tags, wrappers, copies/release and NAPI failure ownership. |

Smallest next claim is TEST-only, after independent review, not these production files:
`tests/native/phase-02-slice-11-native-stream-ingress.mjs`;
`tests/native/helpers/dec203-stream-ingress-harness.mjs`;
`tests/native/helpers/dec203-stream-ingress-core-cases.mjs`;
`tests/native/helpers/dec203-stream-ingress-writers.mjs`;
`tests/native/fixtures/dec203-stream-writers.c`;
new handoff `lane-codex-dec203-native-stream-ingress-red-2026-10-18.md` here.
Harness fixes the subject/fixture source and explicit compiler closure; no generic
fd/PID action protocol. C fixture owns its client/control sockets and two actual child
writers, uses explicit held barriers and passes that one owned client socket between
writers. It never manufactures a production capability or drives the Docker daemon.
Await every fixture child/control/stdio terminal; uncertainty retains owned evidence.
Import missing builder inside each case before allocation; classify missing-API RED
separately. Root then owns actual fixture compilation/drain and native core receipts.
Root reviews missing-API RED/fixture gates before any source claim; missing import is
not native functional RED. Supported positive claims require reached real discriminators.

## 9. Required discriminators and unresolved integration

| Case | Required real witness / limitation |
| --- | --- |
| First-byte timing | Two held-live writers enqueue distinct literal bytes before accept; both correct writer tuples/pidfds, not just connector, survive the queue. |
| Transfer/inheritance | Real inherited and SCM_RIGHTS-passed client socket; A/B writer changes cross actual recv boundaries and neither is attributed from SO_PEERCRED. |
| Stream semantics | Split/coalesced sends, queued tail plus HUP, EAGAIN versus EOF, credit exhaustion/release and close with pending waits; no dropped bytes or stale timer. |
| Ancillary rejection | Real preaccept/postaccept rights-send EPERM under inherited PASSRIGHTS0; reachable explicit-credential/truncation/resource faults plus independent fd-identity cleanup inventories. Unreachable faults stay unproved. |
| Lifetime | Writer live/exit-before-receive/exit-after-receive, read-after-release/close, no PID retargeting; unsupported is explicit, never positive acceptance or skipped success. |
| Identity/receivers | Real owner controls precede plain/Proxy/foreign/copied receiver and source/header/output/socket replacement faults. Preserve replacements and every unrelated descriptor. |
| Resource paths | Dedicated owned probe process accounts descriptor identities across repeated success/failure/close; rare NAPI/unknown-control branches need review and separately selected real fault controls, not production hooks. |

Follow-on TEST-only paths, if required for cap/cleanup coverage, must be separately
claimed: `tests/native/helpers/dec203-stream-ingress-build-cases.mjs`,
`tests/native/helpers/dec203-stream-ingress-resource-cases.mjs` and
`tests/native/fixtures/dec203-stream-ingress-probe.mjs`. No hidden helper expansion.

OPEN: actual ABI/kernel support and preaccept timing; exhaustive installed-fd cleanup;
NAPI/close failure paths; send-image/history joining; complete owned-resource drain.
Mixed-writer HTTP is explicitly OPEN: verified-prefix streaming versus whole-message
withholding/backpressure needs reviewed source/workload-derived authorization. This
primitive neither predicts future writers nor adds a guessed body cap or secret spool.
Opaque archive/body totals, parsing, upstream request/response pairing, operation policy,
daemon/backend finality and restoration remain separate; native primitive GREEN cannot
clear them. All later clients/observers still need the same retained run admission.

## Steps and assumptions

1. Review this closed primitive and root's pinned source/ABI questions independently.
2. Claim only the initial TEST/fixture paths, then obtain import-before-allocation RED.
3. Prove writer-fixture barriers/ownership separately, without labeling that subject proof.
4. Claim fixed production/include paths only after root reviews RED/fixture prerequisites.
5. Implement and review receiver, ancillary, byte and partial-allocation ownership.
6. Validate real queued-before-accept native cases, faults and frozen peer/lifetime tests.

Assume only existing compiler/headers/trusted OS and authorized owned temporary paths.
No process/socket/compiler/parser/import/TEST/Git/network action occurred by this author.
Technical-writer structure separates callable contracts, resource failures and evidence;
root selects exact future releases and owns all execution/integration decisions.
