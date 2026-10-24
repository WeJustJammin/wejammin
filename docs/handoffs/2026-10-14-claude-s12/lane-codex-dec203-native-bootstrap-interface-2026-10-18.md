# DEC203 bootstrap — selected private interface proposal

Source-only design, UNRUN. Companion to native-bootstrap-plan-2026-10-18.
Root selected this topology for review; no source or TEST implementation is released.
Paths below are under `infra/database-upgrades/native-tracing/` unless qualified.
Root's read-only codex-dec203-bootstrap-tcb-amendment selects this finite construction TCB.
Only fixed compiler/lease-owner/coordinator PREHISTORY is admitted, with no Docker/
SQL/setup/probe/migration/reset/restoration/observer work. It is not continuous
history, a no-launch transcript, ClientPermit or PhaseDrainProof. EVERY Docker/
workflow client keeps genuine admission, continuous owned history, writer/operation
causality and independent terminal evidence; construction uncertainty blocks ready.

## Entrypoints and authority boundary

Only the private pre-ready selection in HD/briefs/codex-dec203-bootstrap-pre-ready-selection.md
adds its exact construction input/private constructor/cancelled transition. No source/TEST/runtime release.
The reviewed pre-ready-runtime-binding fixes raw argv/UUID, owned root/runner,
finite lifecycle and O-only diagnostics; no native frame or authority is added.

`receiving-native-launch.mjs` is the outer fixed CLI/build owner. It validates and
copies the existing plan, reserves its one BootRecord before await, builds only
the reviewed lease-owner C artifact, and starts that exact owned image once.
It retains actual compiler/child/stream/artifact records. No injected producer,
caller command/source/FD/owner or prebuilt receipt is accepted.

The C owner forks only the fixed `receiving-native-coordinator.mjs` under the
profile's canonical Node. The coordinator alone invokes existing
`createReceivingSupervisorSession({plan,signal})` internally once. It reads sealed
plan bytes on stdin; its real AbortController is driven by the native run latch.
No supervisor, Workflow, permit, phase or proof object crosses outer IPC. Outer
status/exit cannot mint authority. All genuine objects stay in inner private maps.
Inner ReceivingSession.settle returns exactly
`{state:'work-terminal'|'uncertain',failure:SupervisorError|null}`.
Inner close revokes its run natively before await; local cleanup cannot prove its exit. Only the outer
actual owned record reports GLOBAL TCB drained after complete native/process closure.
Work-terminal means admitted workflow/local results settled; bootstrap watchers,
retained lock aliases, processes and channels may remain. Per-client LocalSettlement
and genuine PhaseDrainProof remain unchanged.
I reserves its entry before reading plan; after validation it constructs the session
before any inner build allocation. The ready promise owns addon/adoption/supervisor
construction, preserving an actual settle/close handle on every bootstrap failure.

Construction is spent before the first await; C fork and each ACK/release slot are
also spent before work/write. Abort, failed build, partial spawn, close, new runId,
fresh signal, reimport or replay never refunds that same bootstrap's attempt.
An ordinary direct coordinator invocation has no genuine handoff and refuses.
An opaque-object-shaped input or an agreeing metadata list is not a substitute.

## Descriptor topology and sole owners

| Process | Exact retained descriptors |
| --- | --- |
| Outer Node O | C child stdin writer, stdout/stderr readers; outer command writer and event reader; actual ChildProcess/fence/build records. |
| C owner C |3–6 four locks;7 self pidfd;8 outer-command reader;9 outer-event writer;10 actual outer-driver pidfd;12 inner-event reader;13 inner-command writer. |
| Inner Node I |3–6 SAME descriptions/numbers as C;7 C-owner pidfd;8 inner-command reader;9 inner-event writer;10 O-driver pidfd. Never the outer channel. |

O spawns fixed C with separate command/event pipes as original child3-read/4-write.
Before opening/mapping locks, C moves those endpoints into disjoint CLOEXEC
scratch slots, closes original3/4, then maps them to outer8-read/9-write. It does
not use one duplex endpoint for both readers or let JS and C race over a channel.
Open/map locks3–6 in fixed order. C creates separate inner command/event pipes,
preserving retained parent12-read/13-write and child command-read/event-write ends
in scratch slots. Only in the forked child map those ends to inner8-read/9-write.
Move ALL four inner pipe ends to disjoint≥32 CLOEXEC scratch before mapping12/13.
Do not overwrite parent outer8/9: fork has a separate descriptor table.

Before child exec, close EVERY outer endpoint in that child and every unused pipe
end/scratch alias. C closes its child-only inner endpoints after fork. O retains
only its designated parent ends. No duplicate writer may mask EOF. O/C/I each
have exactly one reader per incoming channel: O outer events, C outer commands
and inner events, I native inner commands. Node JS never also reads I-fd8.
Only native I code serializes its protocol writes on fd9, not a caller send API.

C opens pidfd7 for itself before fork. C also opens pidfd10 BEFORE fork using its
genuine getppid, bracketed by actual parent image/start/UID/ancestry and live checks.
It retains that exact O instance; no caller PID, later replacement lookup or
SO_PEERPIDFD substitution is accepted. I verifies actual C parent/O ancestry and
held pidfd identities against the original native handoff, not frame claims.
Both lifetime handles are poll/read-only; no arbitrary pidfd signal/getfd export.

Outer plan input is started only after START/fork has been reserved, independently
of the event reader. Do not await a full plan pipe write before fork, which could
deadlock on pipe capacity. C never consumes plan bytes and closes its unused stdin
reader after fork; I consumes the sealed bytes and validates them before authority.
Input write/end/error settlement stays in the actual outer owned record.

## First exec and precompile leak guards

Read full root source inventory `briefs/codex-dec203-node221-bootstrap-source-inventory.md`,
SHA256 `3b33dbcf87fd15d9f23e39883e0f0a9d889e601eb40c883df7bd27a263e088b1`.
It cites Node22.23.1 node.cc895–899, libuv core.c700–713/800–808 and
process.c342–369. These are source support, not an observed descriptor control.

C must explicitly CLEAR CLOEXEC on exactly designated3–10 for FIRST fixed Node
exec, including dup2(source==target), which otherwise leaves that flag unchanged.
No scratch/parent outer/unused pipe end is cleared. Pinned standard Node startup
marks the first16 descriptors CLOEXEC while retaining them in I. Before ANY inner
compiler, I synchronously reads its own fdinfo3–10 and requires the CLOEXEC bit,
expected descriptor availability and the fixed entry/Node profile. Recheck after
awaits before compilation. These raw observations are a refusal guard, not a lease.
Parse actual fdinfo flags as full octal; require O_CLOEXEC0o2000000, not the
FD_CLOEXEC value1. Malformed/missing flags refuse; no lossy conversion or DTO echo.
After native lease addon load, adoption checks actual F_GETFD and held identities
again, requiring its FD_CLOEXEC bit1. No ordinary client can precede those checks.

The actual native positive must independently inspect the real compiler child's
descriptor inventory while it exists: none of locks3–6, pidfds7/10 or either
bootstrap channel may cross that exec. A closed spawn options object, header,
source line or parent's flag is not this control. Do not claim it from a child
whose lifetime was missed. Absence/unsupported observation refuses or remains OPEN.

## Inner native latch and release linearization

The lease addon owns the only native fd8 reader, poll thread/cancel pipe and
Node-API8 thread-safe notification. It parses CANCEL and HUP into irreversible
native cancellation state BEFORE queuing JS notification. It never asks a JS
callback whether release is allowed. No second reader drains or hides CANCEL.

Every native ordinary release synchronously polls BOTH7 and10 and checks the
native cancellation latch, genuine phase/client/adoption state and current
artifacts/locks under its admission serialization. Owner and outer-driver lifetime
are distinct prerequisites. A live C owner does not compensate for dead O.
Reader parsing/revocation and release decisions share the native serialized state;
once revoked, no queued JS work or fresh AbortSignal can reopen it. Sending CANCEL
is not claimed to be remote receipt: CANCEL_ACK means the receiver already latched.
Native TSFN delivery is notification only, never permission or the cancellation gate.

C independently polls its actual driver pidfd10 and outer command HUP. Either
latches cancellation before its next fork/ACK/inner ordinary release. I-fd7 owner
loss, I-fd10 driver loss, inner HUP or invalid protocol also latch native refusal.
Before addon availability, C owns this guard and cannot issue RUN_ACK; queued
inner CANCEL/HUP must be consumed by native I before ADOPTION_ACK, not discarded.
Raw inherited locks while I compiles its addon grant no ready/client permission.
Before addon availability I cannot emit a genuine native ADOPTION_ACK/SETTLED.
A pre-addon exit/HUP without independent compiler/session drain proof is uncertain;
never synthesize a JS success frame to unlock it. Safe positives do not clear this
failure-recovery boundary or authorize a new observer after cancellation.
Already-entered prehistory compilation may outlive a remote CANCEL before the
reader exists; its own bounded compiler record remains owned, and no ready follows.
Do not equate remote send with local pre-abort observation or cancelled-work drain.

## Frames: closed directions, bodies and meanings

Each direction has a4-byte network-order length plus a strict UTF-8 JSON envelope
of1–4096 bytes (maximum4100 wire bytes). Reject oversize/zero before allocation;
consume exactly the declared payload, retain bounded fragments and reject incomplete EOF.
Envelope exact keys `{v:1,bootstrapId,seq,kind,body}`. bootstrapId is fixed run-local
correlation, not a capability. seq is canonical positive u64 decimal, begins1,
increments exactly1 per direction. Unknown/missing/extra keys, invalid UTF-8,
partial/oversized frame, sequence gap/duplicate or cross-bootstrap replay refuses.
No ACK accepts a PID, descriptor, success boolean, build receipt or capability DTO.
Pre-ready TEST sees only real outer frames; inner native prerequisites remain
producer-mediated per HD/briefs/codex-dec203-bootstrap-pre-ready-runtime-binding.md.

| Kind | Direction | Exact body / prerequisite |
| --- | --- | --- |
| HELLO | C→O |`{role:'owner'}`; before fork, no permission from claim. |
| INIT | O→C |`{}`; only after O's actual closed build and owned C image/fence checks. |
| LEASE_READY | C→O |`{}`; actual four locks and original O/self pidfds live. |
| START | O→C |`{}`; consumes one fork slot; only after actual LEASE_READY rechecks. |
| HELLO | I→C |`{role:'coordinator'}`; native addon loaded; C verifies its actual child image/start/argv. |
| ADOPT | C→I |`{}`; fixed handoff once, original parent/driver/lease live. |
| ADOPTION_ACK | I→C |`{}`; actual native handoff and full lease/F_GETFD checks succeeded. |
| ADOPTION_ACK | C→O |`{}`; status of that consumed inner slot only. |
| RUN_READY | I→C |`{}`; private issuer has genuine adoption, supervisor build and all existing same-bootstrap inputs. |
| RUN_ACK | C→I |`{}`; consumed once after RUN_READY/current lifetime/lease checks. |
| RUN_ACK | C→O |`{}`; status, not exported ready/authority. |
| CANCEL | O→C, C→I |`{reason}`; exactly cancel/timeout/signal/close/protocol. |
| CANCEL_ACK | I→C, C→O |`{}`; native refusal already latched, NOT terminal/drain proof. |
| SETTLED | I→C |`{state,failure}`; state work-terminal/uncertain, failure null or existing closed token; work status, not full bootstrap drain. |
| FINISH | C→I |`{}`; only after work-terminal SETTLED/closed ordinary admission; closes retained bootstrap resources, never starts work. |
| TERMINAL | C→O |`{state,failure,exitCode,signal}`; actual I wait plus pipe settlement; unused code/signal null. |

All kinds are state-specific, not free-standing calls. Each ACK slot reserves
synchronously before its first write/await. Failed/partial writes burn it and
retain owned state; no resend/refund or generic ACK frame exists.
SETTLED/TERMINAL values are bounded diagnostics, not PhaseDrainProof or Docker/
backend absence evidence. Ordinary admission closes before SETTLED. Its work-terminal
status still retains the native reader until FINISH; it is not global drained status.
Uncertain requires nonnull failure. TERMINAL state is drained/uncertain; actual
normal-exit code is an integer/signal null, or signalled code null/signal nonnull.
Before any fork, C may ACK only its own latched cancellation with a proved no-fork
record. An attempted/uncertain fork cannot invent an inner ACK or no-launch proof.

## State transitions and ready barrier

O: RESERVED→BUILDING→BUILT→OWNER_REGISTERED→INIT_SENT→LEASED→START_SENT→RUNNING.
C: HELLO_WAIT→INIT_ACCEPTED→LOCKING→LEASED→FORK_RESERVED→FORKED→ADOPTED→RUN_ACKED.
I: ENTRY_GUARD→ADDON_BUILD→NATIVE_HELLO→ADOPTING→ADOPTED→SUPERVISOR_BUILD→INPUTS_READY.
After RUN_ACK: work-terminal→FINISH→native reader joined/closed→actual I exit→C wait.
Cancellation from any state enters REVOKED/SETTLING, never an ordinary successor.
All preconditions must remain live after awaits; no transition is inferred from
a matching frame kind alone. INIT/START/fork/ADOPT/ADOPTION_ACK/RUN_READY/RUN_ACK
are each one-shot slots. I's private authority module, not user data, checks the
genuine lease/artifact/ingress/policy/run records before native RUN_READY write.
INIT accepts only HELLO_WAIT; START only LEASED. After the one fork, C accepts
I-HELLO once, reserves ADOPT and enters ADOPTING; ADOPTION_ACK alone enters ADOPTED.
RUN_READY accepts only ADOPTED/unrevoked; native I accepts RUN_ACK only INPUTS_READY.
SETTLED requires native initialization, closed admission and actual work state;
FINISH consumes only work-terminal. TERMINAL consumes actual I wait/EOF once.
CANCEL accepts any spawned nonterminal state; CANCEL_ACK requires a parsed native
cancel. After revocation only CANCEL/CANCEL_ACK/SETTLED/FINISH/TERMINAL are legal.
Unexpected late HELLO/INIT/START/ADOPT/ACK cannot resume an earlier state.

Session.ready resolves only after genuine adoption, actual supervisor build/load,
all existing same-bootstrap inputs and native RUN_ACK receipt, followed by native
both-lifetime/cancellation/lease/artifact rechecks. C's RUN_ACK is a necessary
barrier, not authority by itself. No partly ready supervisor is exposed.
Before that barrier, only bootstrap construction runs; no Docker/SQL/read-only
probe/reset/workflow client is admitted. Later preflight probes require the frozen
workflow permits, continuous history and all remaining native prerequisite gates.
New construction/view/phase/plan cannot repair a failed or consumed handoff.

## Cancellation, five-second settlement and retained uncertainty

O local abort synchronously revokes further INIT/START and emits only CANCEL.
C latches its own cancellation before relaying CANCEL to I. I's native receiver
latches before CANCEL_ACK and JS notification. CANCEL/HUP/driver/owner loss are
terminal for ordinary release in every stage, including observers/restoration.
Only owned protocol cancellation, native waits and closure may continue.

Do NOT apply the compiler's group SIGKILL policy to C or I. No TCB PID/group kill,
termination escalation or generic signal fallback is authorized here. A new signal
mechanism needs separate exact root TEST and production claims. Owner-death TEST
is likewise separate; this plan does not authorize a test to kill a live parent.

Start a nonrenewing monotonic5s settlement budget at bootstrap cancellation/close.
Within it, require native poll-thread wake/join, actual owned compiler settlement,
I cancellation/SETTLED, actual I terminal wait, channel EOF/error/close and C actual
child close/streams before reporting drained. A compiler may still be governed
by its existing30s deadline;5s expiry does NOT invent an earlier kill permission.

At5s without complete GLOBAL TCB proof, the outer record reports uncertain/DRAIN_UNCERTAIN.
Inner settle never returns drained; work-terminal cannot discharge that outer proof.
Retain the actual outer ChildProcess, compiler records/streams/fences, C/I process records,
all live channel endpoints, native watchers/pidfds, parent/current lock aliases,
owned artifacts/directory identities, protocol bytes/watermarks and first failure.
Do not unlock, delete evidence, silently detach, call process.exit or claim CLI
process termination. A live outer CLI may remain owned/pending after its bounded
uncertainty status; that status is not proof its processes exited. C retains its
locks/evidence if I exits without proved drained status. No baseline/reset/client
may start while uncertainty remains. Later native observation does not erase
the failed result or autonomously mint replacement authority.

Inner close completes only its local FINISH/join/alias-closure handshake, not its exit.
FINISH after work-terminal closes native watchers/aliases once and permits natural
I exit; C requires actual wait/EOF before closing its aliases. Normal FINISH checks
unchanged live inputs. Revoked FINISH is closure-only and may settle owned handles
despite a dead driver; it never reopens admission or grants a reset. O independently
requires actual C close and streams before global drained, not merely SETTLED.
Unknown or foreign artifacts are preserved. Cleanup errors remain secondary.
Normal drain does not imply work success; actual nonzero/signal/failure stays failed.

Protocol errors use existing DEC203_SUPERVISOR_ tokens: REFUSED for invalid/cross-run
handoff or replay; IDENTITY_CHANGED for native lifetime/artifact/lease drift;
PROTOCOL/HISTORY_GAP for malformed/lost frames; CANCELLED for abort; UNAVAILABLE
for missing support; TIMEOUT/FAILED for work; DRAIN_UNCERTAIN for incomplete proof.
No new success/recovery state. Preserve the first underlying error/cause and
secondary cleanup diagnostics; never log environment, raw plan or secret payload.

## Host profile and next TEST boundary

Root observation `/tmp/wejammin-native-s12-20261017.Adf0uP/dec203-bootstrap-host-profile-observation.json`
SHA256 `ffaf40d313f24dab8129f8433c38e7beb8b0c2d2be44d3571de0e6e5d4032c52`
is a profile proposal, not BuildCapability. It records Node v22.23.1 at
`/home/rob/.cache/chrome-gate-runtime/node-v22.23.1-linux-x64/bin/node`, compiler
`/usr/bin/gcc` and includeDirectory `/usr/include/node`, the root-used native49 set.
Use exactly js_native_api.h/js_native_api_types.h/node_api.h/node_api_types.h;
their complete identity/hash records remain in that observed document and must
be reobserved around every fixed build/load/release. No node-gyp alternative.
Receipt dev/inodes are observations, not reusable authority; capture fresh held
identities per run while requiring the approved path/hash/mode/owner profile.
Root's lock-path observation `dec203-bootstrap-lock-path-observation.json` in the
same receipt directory has SHA2620ea610eb1baa4aa4a365067ad6d041fb9c862ba971142e88c71288244c4ce:
all four canonical regular nonsymlink paths are0100644/uid1000/gid1000. Recheck
held/named dev/inode at each run; do not freeze the receipt's ephemeral inode values.

ALL bootstrap/full RUN_ACK TEST release is HELD until actual genuine artifact,
ingress/policy/run inputs and every remaining native prerequisite exist. A/B alone
cannot emit synthetic RUN_READY or imply a full positive. A genuine pre-ready
adoption-plus-close contract is reviewed in source-selection; runtime is NOT released.
Future safe positives must use fixed production artifacts/entry and actual builds,
channels, locks/pidfds, flag/child-FD facts and native adoption/RUN_ACK barriers.
No caller-selected program/source/FD, injected issuer or production test hook.
Negative fixture routes remain OPEN until a separately reviewed FIXED compiled
TEST artifact and closed harness exist; genuine premises cannot be fabricated.
Missing API/import is only missing-API RED. Root owns all runtime and release.
