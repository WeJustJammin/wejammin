# DEC203 pre-ready lease native ABI — selected private contract

Root selected after independent planning review,2026-10-18; native gpt-6.1-sol/ultra.
Contract selection only: no production authoring, runtime, lock or acceptance release.
`NT/` means infra/database-upgrades/native-tracing; `HD/` means its handoff directory.

## Approach and scope

Propose one zero-input native constructor and a private frozen Promise-backed owner.
C owns protocol reads, refusal and writes; Node receives completion, never admission
requests. This supports only the selected genuine pre-ready adoption/cancel/close path.
No ordinary registry, supervisor, workflow, ready/RUN_ACK, client or proof is built.
There is no generic send/read/control API, fd/PID/source option or caller callback.
The selected constructor remains internal and never reaches TEST or outer IPC.

Historical initial draft basis:75-LF selection,278-LF proposal,300-LF plan,281-LF
interface, 68-LF TCB amendment, authority/supervisor contracts, Node inventory and
current primitive wrappers. Selection controls older full-bootstrap HOLD wording.
The local Node headers establish declarations, not TSFN behavior or kernel support.
The 127 primitive and 8 selected-doc manifests remain read-only; all 135 pins matched
before authoring. Manifest SHAs, respectively:
`9b5630c2bc36805c503b9d4918654b574bc15253c7a1cb848236905b139af903`;
`0f2723b853584dee8c9b1aa270dcc438c47ca7fd9e7fb4bb656862f30774fc5a`.

## 1. Exact proposed native surface

Fixed receiving-lease.node has exactly one named export:

```ts
type LeaseAddon = { adoptReceivingLease(): NativeLeaseOwner };
type NativeLeaseOwner = Readonly<{
  adopted: Promise<void>;
  settle(): Promise<Readonly<{
    state: 'work-terminal' | 'uncertain';
    failure: SupervisorError | null;
  }>>;
  close(): Promise<void>;
}>;
```

Constructor and both methods have arity 0 and accept no arguments. Owner own keys
are exactly adopted, settle, close; all are immutable data properties and it is frozen.
adopted is the original native-deferred Promise, never a getter or supplied Promise.
settle/close return their one cached native Promise; repeated calls never resend,
renew a deadline or reserve a second slot. No event emitter, notification accessor,
cancel(reason), release, poll, metadata or raw handle method exists.

| Value | Exact meaning; never authority from shape |
| --- | --- |
| adopted fulfilled void | Actual ADOPTION_ACK completed and its required native live rechecks passed. It records that completed transition, not continuing validity. |
| settle work-terminal/CANCELLED | Genuine cancelled construction is terminal; reader/aliases may still exist. No ordinary registry or no-launch/history proof is asserted. |
| settle uncertain/non-null failure | Construction termination is unproved; retain ownership. |
| close fulfilled void | Local FINISH, actual reader join, owned-alias cleanup and notification teardown completed; NOT I exit or GLOBAL drain. |

Native owner uses one fixed NAPI8 type tag. Check genuine object/tag BEFORE unwrap,
then state and arity; plain/Proxy/wrong-type/null unwrap refuses REFUSED without I/O.
Extra constructor/method arguments refuse REFUSED. Valid cleanup calls are idempotent;
no call after revocation can resume adoption. Existing close/settle observations may
return their cached outcome after closure; static Promise access performs no work.

## 2. Issuer provenance and the real JS routing gap

The addon entry is private implementation ABI, not a named raw-adopter JS export.
Propose collocating the lexical createPreReadyLeaseConstruction(), actual
LeaseBuildRecord, zero-argument private issuer and native handle in receiving-lease.mjs.
That actual record is reserved synchronously before allocation/await and retained
through timeout/rejection, not merely on a runner stack. Its frozen internal
adopted/settle/close handle owns build failures too. Helpers provide build mechanics,
never adopt that record, accept an issuer callback or return a native owner.
Only actual native deferred outcomes bridge it; no received DTO/boolean or outer IPC.

The private zero-argument adoptReceivingLease issuer closes over that same actual
construction record. Calling the native entry is allowed only after its fixed addon
compiler wait/stdio/session-absence and artifact/load checks genuinely complete.
Those retained facts, not a new compilerDone argument, satisfy construction's build
gate before SETTLED. A source hash or successfully loaded binary alone is insufficient.

Propose only internal runPreReadyLeaseConstruction():Promise<void> from lease,
called by the existing zeroarg runPreReadyCoordinator():Promise<void> in bootstrap.
Both guarded slots are spent synchronously before await. Neither runner returns
a handle/build record or takes options/callbacks. The lease runner owns adoption,
cancelled-work settlement and unconditional first-failure-preserving close.
Fixed coordinator→bootstrap→lease is the sole production route; genuine native
entry/handoff checks still apply to direct calls. ESM names are not privacy guards.
Source-selection explicitly cascades this placement before production authoring;
it is not a raw-adopter rename or full-factory/ordinary authority release.

## 3. Native construction and fixed-descriptor proof

Consume the one native construction attempt before allocation/thread/HELLO. All
partial failures remain spent; canonical reimport/view/new signal cannot refund it.
The actual private JS construction record and C parent's consumed handoff jointly
enforce this; a per-dlopen static boolean alone does not prove cross-copy one-shot.
Invalid/replayed entry never starts a competing fd8 reader or emits another HELLO.

Before ownership transfer, validate actual current Node/entry/argv and original C/O
ancestry/start/image/UID against the fixed profile and held resources, not frame PIDs.
bootstrapId has only correlation/replay meaning; no JS string/new ABI option supplies
it. Selected runtime-binding fixes the O→C→I UUID/cwd/build-root route. Raw kernel
argv MUST preserve the existing literal `--`: O[fixedNode,'--',fixedLauncher],
I[fixedNode,'--',fixedCoordinator,uuid], C[actualOwnedOwnerImage,uuid]. Do not substitute
normalized process.argv for /proc cmdline. The reviewed runtime/source selection
controls historical proposal metadata; no caller input or native authority is added.

| I resource | Required actual proof before native HELLO/ACK |
| --- | --- |
|3–6|Same parent/current numbers and inherited descriptions; fixed named regular lock identities, actual FLOCK rows and matching /proc/locks; quiet READ, others WRITE. No fcntl-OFD substitution or inode-only equivalence. |
|7|Original C-owner inherited pidfd, linked to actual getppid instance, live poll→linkage→poll. No new pidfd_open lookup. |
|8/9|Distinct inner command-read/event-write pipes, matching C13/C12; never C outer8/9. Native reader and native serialized writer only. |
|10|Original O-driver inherited pidfd, actual C/O ancestry and original driver instance; separate from7. |
|Every protected fd|F_GETFD requires FD_CLOEXEC1; complete identities/topology and no unauthorized aliases. Never close unverified caller descriptors. |

I's independent precompile fdinfo guard still precedes ANY compilation and parses
octal O_CLOEXEC0o2000000, not FD_CLOEXEC1. O's independently captured live GCC child
complete no-alias inventory BEFORE native HELLO remains mandatory. No native status,
parent flag or completed compiler substitutes; a missed witness fails the positive.
Native ABI supplies no observer callback, holding trick, fake fact or diagnostic API.

## 4. Sole reader, serialization and existing frames

One native pthread exclusively reads I-fd8; JavaScript never creates a reader for it.
One mutex/state machine owns cancellation, input parser, output sequence/ACK slots
and all adoption/closure decisions. Methods latch refusal/wake under that state;
they do not compete for channel reads. No blocking read/poll/write occurs under
the admission mutex. Input/output are bounded nonblocking framed I/O.

Keep the existing4-byte BE length plus1–4096B entire UTF-8 JSON envelope (max4100B wire), exact keys/bootstrapId and
contiguous positive-u64 per-direction sequence. Preserve fragments only within the
bounded parser; incomplete EOF, gaps, unknown/late frames or write failure refuse.
Reserve every output slot before write; failed/partial writes never refund/resend it.
CANCEL reasons remain exactly cancel/timeout/signal/close/protocol; the positive
pre-ready path uses close. No new reason or frame body is introduced.

| Native sequence | Required linearized action |
| --- | --- |
| HELLO(coordinator) | Only after genuine construction, exclusive reader ownership and all initialization succeed. |
| ADOPT→ADOPTION_ACK | Drain already available CANCEL/HUP before ACK; incomplete incoming frame withholds ACK. Under the same gate recheck both7/10, parent/lease/flags/identity; reserve ACK once, then write and recheck. |
| CANCEL(close)→CANCEL_ACK | Parse C's actual CANCEL; latch irreversible native refusal BEFORE ACK or JS notification. No ACK is fabricated from local close. |
| SETTLED | After genuine cancelled construction/build terminality, emit exact work-terminal/CANCELLED once; uncertainty uses existing uncertain/failure shape. It is not GLOBAL drain. |
| FINISH | Only valid after work-terminal SETTLED; consume once, stop reader and close I-owned aliases without LOCK_UN. Revoked FINISH is closure-only, including with dead driver; no ordinary release. |

RUN_READY/RUN_ACK are illegal, not stubbed. Local close() latches refusal before
return, but cannot emit an I→C CANCEL: that direction does not exist. It wakes the
reader and awaits actual parent CANCEL/FINISH. Missing peer progress becomes retained
uncertainty, never a synthetic ACK/EOF or forced exit. Observed cancellation wins
the serialization gate; no claim is made that a remote send was already received.

## 5. Proposed Node-API8 completion transport

Use native-deferred Promises and one fixed C TSFN call_js_cb, with func=NULL;
no JS callback argument/export. Pinned API/source facts are in the Node completion
inventory; actual native controls remain required, not inferred from declarations.
Only the env thread creates/settles deferreds and NAPI values. The reader only
updates synchronized native records and queues a bounded nonblocking wake.

Propose TSFN max_queue_size=1, initial_thread_count=1 for the sole reader, referenced
until actual shutdown. call_js_cb receives only its actual context and data=NULL;
there are NO public notification/event objects or new wire kinds. A pending-wake
bit may coalesce notifications only: every parsed frame, spent slot, first failure
and ordered watermark remains in the bounded native record. Nothing is dropped.
queue_full is acceptable only for an already accounted outstanding wake; otherwise
it is a transport failure. Reserve a context reference/counter BEFORE every enqueue;
retain it only for napi_ok. Each accepted callback, including env==NULL, drops its
wake reference once. Finalizer-called is NOT queue-drained: pinned Node runs remaining
null-env callbacks AFTER that finalizer. Counters include in-flight callbacks.
On napi_closing, Push already consumes the participant: clear pointer/credit and
never use or release that TSFN again. Other failures latch refusal/retain ownership.
The callback never requests permission from JS; queued notifications cannot reopen
native cancellation. Completed adoption is historical, never a release capability.

One serialized notification gate owns the actual TSFN pointer/participant credit.
Never hold admission/state mutex while waiting for that gate, calling TSFN or joining;
callbacks/finalizer must not invert this order or retain the gate during state snapshots.
Constructor owns it before pthread creation, then transfers it to the parked reader.
Normal reader exit makes release its last TSFN call. Local close never aborts it.
Register one native env-cleanup hook AFTER TSFN creation and BEFORE queue/thread.
LIFO puts that hook before TSFN's built-in cleanup. It irrevocably latches envClosing
and refusal, signals startup/reader and, under the notification gate, forbids further
calls, detaches pointer/credit BEFORE one abort/release of any still-owned credit.
Already-closing credit is spent; no second release. The gate must quiesce any current
call without waiting on JS/protocol or holding the admission mutex. Never join there.
No NAPI values/deferred/reference operations run on envClosing/null-env paths;
native cleanup never resolves JS success. Native peer controls/resources remain
serviceable/retained on uncertainty. Hook, reader, TSFN, accepted wakes, join and
wrapper retain distinct state references. Remove the hook exactly once after normal
verified closure; after env cleanup record that it ran, never remove it again.
No unref/detach, finalizer-only trigger or empty-queue assumption hides ownership.

## 6. Startup, join and allocation ownership

1. Reserve native attempt, allocate synchronized state with every fd slot -1, and
   prove genuine inherited ownership before taking fixed3–10 into its ledger.
2. Allocate tagged/wrapped/frozen owner, all deferreds, strong native owner reference,
   private CLOEXEC wake pipe, TSFN, cleanup hook and fixed async-work record before HELLO.
3. Queue exactly one join async-work BEFORE pthread creation. Its worker waits on
   native CREATED|FAILED/no-thread state; every constructor exit sets/signals it.
   Queue failure therefore cannot strand an already created joinable reader.
4. Create parked reader, transfer participant ownership, mark/signal CREATED; unpark
   only after all initialization/registration succeeds. Failed start signals FAILED
   and spends any still-owned TSFN participant once. No HELLO from a failed start.
5. Reader services channels/pidfds; FINISH detaches/closes owned slots once and exits.
   Worker joins iff CREATED, then waits for native finalizer-called AND zero accepted
   wake references. It neither calls NAPI nor waits for its own complete callback.
6. Live-env close publication requires joined, finalizer-called, acceptedWakes==0
   and aliases-clean, NOT total context-refcount zero; completion still owns refs.
   Only then delete work/remove hook and
   release keepalives exactly once. EnvClosing never resolves a JS success Promise.
7. I may exit naturally only after its genuine construction close and build cleanup;
   no process.exit, termination signal or forced library unload creates this proof.

Never pthread_join a potentially running reader on Node's event thread: it could
block TSFN delivery, protocol progress and bounded uncertainty reporting. The fixed
async join owner avoids that dependency. Any failed/unproved startup retains its
actual record; queue-before-create is not a detached-thread cleanup substitute.
close never cancels the fixed join work merely because ordinary admission is revoked.
Exact helper/source closure belongs to the parallel draft and still needs selection.

Before successful napi_wrap C owns allocation; afterward its finalizer alone owns
that allocation reference. Post-wrap property/freeze/start failures revoke resources
but never free behind the finalizer. Reader, TSFN, join work and wrapper hold distinct
synchronized references. Existing stream TLS/plain refs are NOT thread-safe templates.
GC/finalization latches refusal and wakes; it never blocks the env thread, closes a
reader-used fd, frees live context, retries a detached integer or claims observed join.
Free only after join, finalizer/accepted-wake teardown and every reference release; retain uncertain
tombstones/actual resources otherwise. Finalizer callbacks cannot mint completion.

## 7. Failure, evidence and remaining selections

Use only existing DEC203_SUPERVISOR_ tokens: REFUSED, IDENTITY_CHANGED, UNAVAILABLE,
PROTOCOL, HISTORY_GAP, CANCELLED, TIMEOUT, FAILED, DRAIN_UNCERTAIN. code==message;
preserve first underlying error/pending NAPI exception and secondary cleanup records.
Normal cancelled-work failure remains CANCELLED even when local close succeeds.
Local closure uncertainty cannot turn that work result into success or GLOBAL drain.
No raw environment/plan/payload/fd list/capability enters a new diagnostic channel.

Start one nonrenewing monotonic5s local close budget on first observed cancel/close;
repeat methods, queued notifications and later FINISH never renew or clear failure.
O's original global5s budget still dominates its closure verdict. At expiry retain
actual reader/join/TSFN/context, fd/pidfd/lock aliases, compiler/build and first-error
records. No owner/coordinator kill, unlock, evidence deletion or abandoned thread.
Inner close cannot prove I exit; O still needs actual I wait/EOF, C close, all streams
and input settlement. Native Promises are not reusable proof or diagnostics authority.

Root selects private owner placement, corrected join/TSFN ownership and exact
source-selection closure. UUID/raw argv remains selected. No caller
constructor token, registration callback, success boolean or new frame repairs them.
Root's readonly O diagnostics selection remains separate and is not extended here.

## Steps and proof limits

1. Enforce this reviewed ABI and selected source closure/zero-argument route.
2. Pin NodeAPI8 NULL-func call_js_cb, callback/teardown, queue and async-work lifetime
   semantics from primary source; local header declarations alone are insufficient.
3. Stage exact private-constructor/receiver/allocation tests without test-only mints.
4. Reach actual PR01–04, including live compiler-child FD witness before HELLO and
   real CANCEL_ACK/SETTLED/FINISH, thread join, aliases, I/C waits/EOF and all streams.
5. Keep rare allocation/queue/join/teardown faults unproved until real owned controls
   exist; never add production injection hooks or infer support from source/versions.

Assume only the selected trusted-host/module boundary, not hostile same-UID JS
isolation. Existing wrappers justify tag-before-unwrap, post-wrap ownership and
one-close patterns, NOT TSFN support. No ordinary history/lease-consumer/workflow,
daemon/backend, restore, native080 or hosted/canonical gate is cleared. Root alone
owns every later source/TEST release, execution, integration and acceptance decision.
