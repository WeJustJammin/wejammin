# DEC203 stream ingress — exact mirror and operation attestation

Source-only design refinement; author UNRUN. Companion to
`lane-codex-dec203-native-stream-ingress-plan-2026-10-18.md` in this directory.
Only two pre-TEST gaps are refined: exact native ABI and owner-build attestation.
All listener/SCM/byte/resource/privacy/TDD guards and OPEN gates in that plan remain.
No TEST/production path, HTTP/body policy, forwarding, reset or runtime is released.

## 1. Exact synchronous native mirror

The addon exports exactly one named function, `createIngress(parentPath)`.
It accepts exactly one canonical owned-parent string; fixed basename/options/bounds
and independent parent/listener guards remain those in the main plan. No fd, PID,
Node Socket, source, callback, scheduler, credit or metadata argument is accepted.
Successful construction returns the actual tagged NativeOwner, never a DTO.

```ts
type NativeAddon = {
  createIngress(parentPath: string): NativeOwner;
};
type NativeOwner = Readonly<{
  accept(): NativeStream | undefined;
  close(): void;
}>;
type NativeStream = Readonly<{
  receive(): NativeSegment | null | undefined;
  close(): void;
}>;
type NativeSegment = Readonly<{
  copyBytes(): Buffer;
  writer: NativeWriter;
  release(): void;
}>;
type NativeWriter = Readonly<{
  read(): Readonly<{pid: number; uid: number; gid: number; fdInfoPid: number; alive: true}>;
}>;
```

These are exact own JavaScript method/data keys; native wrap/tag slots are private.
Every returned native object is frozen. writer is a plain immutable data property
containing the genuine NativeWriter, not a getter, claimed PID or lazy lookup.
Each no-argument method validates its fixed per-type Node-API8 tag before unwrap.
Wrong/foreign/Proxy/null-unwrapped receivers refuse INVALID_CAPABILITY. Extra method
arguments refuse PROTOCOL without I/O, after genuine-receiver/closed checks.
There are no named arm/demand/pump/poll/identity methods or hidden JS-callable variants.
Internal C helpers/ledgers are not exported resource-adoption or test interfaces.

| Native result | Exact meaning |
| --- | --- |
| owner.accept → undefined | Nonblocking EAGAIN/EWOULDBLOCK, no readiness, or native stream credit unavailable; no accepted object was handed off. |
| owner.accept → NativeStream | A newly accepted, native-registered, tagged owned stream; before returning, options/kind/identity checks and resource ownership succeeded. |
| stream.receive → undefined | No data/readiness or native segment credit; no consumed segment was discarded. |
| stream.receive → null | Actual recvmsg EOF with the main plan's control checks, or the already recorded actual EOF; never EAGAIN, cancellation or failure. |
| stream.receive → NativeSegment | One genuine attributed private-byte segment and its genuine held-SCM-pidfd writer; no guessed send or HTTP boundary. |

Every native operation is synchronous and bounded/nonblocking. Exceptions preserve
the main plan's closed capability tokens and ownership unwind, never undefined/null.
Cached native EOF and cached writer-exited remain native state, not successful work.
Native close/release revoke synchronously, detach each owned fd before its single close
attempt and are idempotent. Neither requires source/artifact attestation for cleanup.

## 2. JavaScript facade, scheduling and credits

Public Ingress/AcceptedStream/Segment/Writer own keys/signatures remain the main plan's:
accept/receive return Promises; copyBytes/read/release/stream.close are synchronous;
Ingress.close returns a Promise after synchronous revocation. No native Promise exists.
The JS facade alone owns pending demand, Promise settlement, one real10ms scheduler,
round-robin iteration and public credits. It calls only the exact mirror above.
There is no native arm/demand/pump protocol to implement or mock.

Call native accept only for actual pending public accept demand. undefined leaves that
Promise pending; it is never published as a successful accept. Likewise native receive
undefined leaves the actual receive pending without losing bytes or settling EOF.
The JS turn keeps the existing at-most8 accept/8 receive call bounds and idle-timer stop.
No demand or exhausted public credits suspends that path; release/close may wake it.
JS must not spin synchronously until ready, bypass round-robin or invent native events.

C independently enforces max16 owned open streams and segment limits4 per stream/32
per owner before accepting/consuming input. JS bookkeeping cannot enlarge those limits.
Native close/release returns credit once even through failed close attempts; uncertainty
still latches and cannot be presented as drain. EOF alone does not free a stream fd.
JS tracks the same actual facade ownership and revocation, not caller-provided counts.
Duplicate pending public calls remain LIMIT; ordinary credit waiting is not an error.

The wrapper's genuine-receiver maps retain the actual native object and actual OwnerBuild
for each facade. Native resources remain in C's ledger before any JS wrapper allocation.
Both layers retain the main plan's partial-NAPI/finalizer/group-lifetime rules.
No public facade exposes its native object, fd, pointer or mutable original bytes.
Live descendant facade state retains its actual owner native object/state until
revocation; owner GC cannot silently preclose an otherwise live public facade.
JS latches transitive closed flags before native cleanup and on error paths that revoke;
there is no isClosed discovery API. Cached writer exit alone is not a close.

## 3. Before/after attestation is per operation, including caches

OwnerBuild is the actual admitted builder instance with private source/support/compiler/
Node-header/output records and directory/runtime checks. It is not supplied by callers.
Attest real current identities/bytes against those records, including the complete fixed
local include closure. Do not accept metadata equality, stat-only/hash-cache shortcuts or
one shared check covering a batch of independently performed operations.
The build-parent check uses its retained identity; initial emptiness is not re-required
after this builder legitimately created its own output/listener.

| Nonclosed public operation | Required before and after checks |
| --- | --- |
| Ingress.accept | Actual receiver's OwnerBuild before each native attempt and after its result, including undefined/credit wait and newly accepted stream. |
| AcceptedStream.receive | Same, including undefined, new segment and actual/cached EOF null. |
| Segment.copyBytes | Same, bracketing the actual copy; no copy escapes after failed post-check. |
| Writer.read | Same, including live reads and native/JS cached WRITER_EXITED outcomes. |

Public admission checks the actual receiver/closed state and arguments first, then
attests before queuing demand. Each scheduled native attempt performs its own fresh
before/after pair. An existing pending Promise cannot exempt later attempts from checks.
Cached facade EOF takes the same operation guard even when it needs no native call.
Cached exited state must not short-circuit either attestation boundary.
Use synchronous checks for synchronous copyBytes/read; do not silently change their API.

The operation order is:

1. Resolve the genuine receiver and its transitive owner/stream/segment revocation.
2. Refuse closed first, without disk access; then validate no arguments and capture that
   receiver's actual OwnerBuild. Foreign receivers never reach a filesystem/native read.
3. Perform before-attestation. Failure means no native attempt/public result.
4. Perform native work or the guarded cached outcome; retain the first primary failure.
5. Prepare/validate/freeze any facade results privately, without publishing them.
6. Perform after-attestation even when native work/result wrapping already failed.
7. Publish only after all success checks. On failure revoke all newly returned native
   objects/results, settle the operation once and preserve the first primary failure.

Post-attestation is not skipped after WRITER_EXITED, EOF, undefined or a native exception.
If a prior failure already exists, later attestation/cleanup failures are secondary;
retain them privately without replacing the primary. No partial public object escapes.
An inability to construct an NAPI error still follows cleanup and preserves its pending
exception, never manufacturing EOF, would-block, attribution or proven cleanup.

Borrowing a method onto another genuine registered facade resolves that receiver's
OwnerBuild, not the build that created the function. Drift in owner A does not cause
owner B to be attested as A; drift in B cannot hide behind a borrowed method from A.
Another module instance's unregistered facade remains foreign, as in the main plan.

## 4. Post-result unwind and unconditional cleanup

| Newly returned native value before wrapper/post-check failure | Required unwind |
| --- | --- |
| NativeStream from accept | Invoke that genuine stream's close; revoke/remove any unpublished facade and retain uncertainty if cleanup fails. |
| NativeSegment from receive | Invoke release, including its writer pidfd/private bytes/credit; revoke/remove every unpublished segment/writer facade. |
| Buffer copy from copyBytes | Never publish it; discard wrapper references for GC. No copy is adopted as authoritative bytes. |
| Plain observation from read | Discard it; it is not a writer capability or work permission. |

Attempt every newly owned object cleanup despite the first unwind error. If native
construction threw before returning, C remains responsible for its own complete unwind;
JS cannot invent an object or guess its fd to finish cleanup. Native post-wrap allocation
stays finalizer-owned: revocation/one-shot resource cleanup never frees behind a finalizer.

Ingress.close, stream.close and segment.release check genuine receiver, then latch
revocation before any cleanup. They always attempt owned cleanup despite artifact drift;
they do not run before/after operational attestation as a prerequisite to that attempt.
Repeated cleanup does not retry detached descriptor integers. Owner close also revokes
all children and settles pending facade demands despite cleanup/artifact failures.
Closed read/copy/accept/receive wins over drift or cached EOF/exit; no disk reads occur.
Known cleanup failure/unknown ownership remains uncertain, never a successful drain receipt.
All foreign path replacements and caller descriptors remain untouched.

## 5. Error mapping and static diagnostics

Factory/build/compile/load retain existing DEC203_INVALID_BUILD, DEC203_COMPILER_FAILED,
DEC203_IDENTITY_CHANGED and DEC203_NATIVE_UNAVAILABLE behavior. No build error is renamed
merely because this primitive will later accept a stream.
On nonclosed operations, observed source/support/compiler/header/output/directory drift
or failed artifact reobservation maps to DEC203_STREAM_IDENTITY_CHANGED. Native socket-
identity drift uses that same stream token; native I/O/protocol errors keep their own.
An unexpected programming error is not disguised as artifact drift or success.
All normal closed tokens retain code==message and the main plan's privacy limits.

Before-attestation drift is primary because no native operation occurred. Successful
native work followed by drift fails STREAM_IDENTITY_CHANGED and reclaims new results.
Earlier native/wrapper failure remains primary if post-attestation also fails. No
cleanup error may replace that first failure or be suppressed as proven cleanup.

metadata and identity are plain deeply frozen diagnostic data snapshots, constructed
by the JS build/listen wrapper. All properties are data properties, not getters, Proxy,
lazy disk reads or native-method aliases. There is no attestation on static access;
the same diagnostics remain readable after close/drift without granting work authority.
Segment.writer is likewise a static genuine facade reference, not an operational read.
Its Writer.read remains fully guarded even if the reference was retrieved earlier.

JS independently observes the canonical parent and filesystem socket entry, including
the required before/after setup identity checks. C independently retains its private
dirfd/socket fstat state. No native identity accessor is added; C fstat identities stay
private and are never equated with or exposed as filesystem-entry diagnostic identities.
Serialized matching snapshots cannot create a NativeOwner, stream, segment or writer.

## 6. Bounded TEST amendments and proof limits

Refine only the already proposed initial TEST paths when root releases them. Require
real owned listener/client controls before negative cases; no new production hooks.

- Load the actual attested addon in an owned native ABI control; assert its one export
  and the exact frozen native mirror from real accept/receive/SCM results. No mock ABI.
- Prove undefined EAGAIN/credits, null actual/cached EOF and exact tagged objects, with
  actual child/control/stdio terminals and one-close descriptor accounting.
- Obtain real EOF and real exited-writer caches; drift owned copied-source/support/output
  artifacts, then require guarded failures rather than cached null/WRITER_EXITED bypass.
- Use two actual owner builds and genuine borrowed receivers; attest the receiver's
  records, preserve closed-first behavior, and keep copied diagnostic buffers unauthoritative.
- Assert plain/deep-frozen diagnostic data descriptors and stable no-I/O static access;
  this is not a source-token oracle or a permission to forge resource capabilities.
- Independently inspect before/after ordering and post-result unwind. A deterministic
  actual post-boundary/NAPI failure strategy needs its own reviewed resource control;
  if unreached, mark it unproved rather than add syscall/addon/FS callback injection.

No additional TEST/production/helper paths are claimed by this interface companion.
Stop/request an exact cohesive source path if implementation exceeds natural file caps;
do not minify or reintroduce a vague generic scheduler/validator interface.
Actual ABI/kernel support, queued-before-accept two-writer and PASSRIGHTS0 controls,
ancillary/resource failure paths, send-image/history/HTTP joining and native acceptance
remain the main plan's OPEN gates. Root owns review, release and all execution.
