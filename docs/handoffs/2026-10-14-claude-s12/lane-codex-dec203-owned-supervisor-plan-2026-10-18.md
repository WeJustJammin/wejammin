# DEC203 owned-child supervisor: proposed private contract

Status: DESIGN ONLY, UNRUN; selected finite TCB amendment cascaded, not source/TEST release.
Historical source hashes are baseline observations, not current pins; no new authority.

## Approach

Every Docker/workflow client gets one attested, short-lived C supervisor. Its child
requests tracing before target exec; Node gates release on registration and
ordered kernel-history ACKs. This is process history, not Docker attribution.

## Scope

In: prelaunch admission, private pipes, continuous owned history, raw identity
references, lossless/fail-closed protocol, owned cancellation and local drain.
Out: unrelated attach, daemon/policy changes, generic PID/group signals, a proxy,
new Docker authority, peer-primitive changes or replacement of frozen validators.

## Steps

1. Pin the selected outer-CLI/inner-coordinator route, fixed source/toolchain/ABI and refusals.
2. Stage protocol/identity RED, then actual owned-child native RED.
3. Implement registration, initial stop, options and ACK-before-exec release.
4. Implement closed syscall admission and lifecycle/task-image bookkeeping.
5. Implement bounded channels, cancellation and complete wait/stream settlement.
6. Prove real fork/thread/exec races, channel loss and foreign-resource preservation.
7. Review new history DTO and all-consumer cascade before any host integration.
8. Root validates peer/Docker/all-role drain before any later integration/native080 release.

## Assumptions and existing contradictions

Root fixes all-role admission/fail-closed gaps. The host/toolchain are trusted;
no support, hermetic-build or hostile-same-UID isolation is claimed. Historical peer baseline:
`22ae73078eb919f5d30eb662b9ea6091758e11d3c49ca4d31e337e2ce2f582ce`.

`host-boundary.mjs:65-123` authenticates no producer; `host-trace.mjs:169-205`
requires direct Node parentage, two shell/Node images and three commands.
Do not fabricate those facts. `host-drain.mjs:119-168` conflates PID absence,
zero exit and terminal drain. Amend contracts later; never add a legacy bypass.
These suffixes are under `infra/database-upgrades/delivery-receiving-upgrade-`.
Four-lock, target, executable, stdin, daemon, migration and baseline-restoration
constraints remain mandatory.

## 1. Closed private Node surface

```ts
type Role = 'run' | 'spawn' | 'setup' | 'probe' | 'observer' |
  'migration' | 'restore' | 'drain-observer';
type Reason = 'cancel' | 'timeout' | 'signal' | 'close' | 'protocol';
type SupervisorError = 'DEC203_SUPERVISOR_REFUSED' |
  'DEC203_SUPERVISOR_UNAVAILABLE' | 'DEC203_SUPERVISOR_PROTOCOL' |
  'DEC203_SUPERVISOR_HISTORY_GAP' | 'DEC203_SUPERVISOR_IDENTITY_CHANGED' |
  'DEC203_SUPERVISOR_CANCELLED' | 'DEC203_SUPERVISOR_TIMEOUT' |
  'DEC203_SUPERVISOR_FAILED' | 'DEC203_SUPERVISOR_DRAIN_UNCERTAIN';
// Opaque genuine objects held in private WeakMaps, never serialized authority.
type LocalSettlement = Readonly<{
  state: 'drained' | 'uncertain';
  work: 'zero' | 'nonzero' | 'cancelled' | 'timeout' | 'failed';
  failure: SupervisorError | null; trace: TranscriptCapability;
}>;
type OwnedClient = Readonly<{
  start(): Promise<void>; // one use; resolves only after admitted first exec
  cancel(reason: Reason): Promise<LocalSettlement>;
  settled: Promise<LocalSettlement>;
}>;
type OwnedSupervisor = Readonly<{
  initialPhase: PhaseCapability;
  prepare(input: { permit: ClientPermit; signal: AbortSignal }): OwnedClient;
  seal(phase: PhaseCapability): void;
  advance(input: { prior: PhaseCapability; proof: PhaseDrainProof;
    permit: NextPhasePermit }): PhaseCapability;
  cancel(reason: 'cancel' | 'signal' | 'close'): Promise<readonly LocalSettlement[]>;
  settle(): Promise<readonly LocalSettlement[]>;
  close(): Promise<void>; metadata: SupervisorMetadata;
}>;
createOwnedSupervisor({ run, lease, ingress, artifact, policy }): OwnedSupervisor;
```

One retained coordinator/registry owns the genuine RunCapability and every phase.
Phase/proof objects are coordinator-owned; NextPhasePermit admits one exact successor once.
ClientPermit is one-use, binding phase/Role, approved executable/argv/images, cwd/env,
stdin bytes/hash, sinks and deadline. Prepare requires the current open phase;
register before spawn/await, refusing stale/cross-run/forged permits or overrides.
Client cancellation revokes only that client. Coordinator cancel/close latches
run-wide abort before awaiting; a new factory/signal/phase cannot renew authority.
Rejection code/message equal SupervisorError; diagnostics contain no secrets.

Metadata keys: source/compiler/headers/output/node/abi/options/buildFlags.
Artifact keys: path/sha256/device/inode/size/mode/uid; node: path/version. Bind
fixed source/toolchain/headers/output/C identity; [selected TCB](briefs/codex-dec203-bootstrap-tcb-amendment.md) applies.
Finite compiler/lease-owner/coordinator prehistory is not client history; see [interface](lane-codex-dec203-native-bootstrap-interface-2026-10-18.md).
Inner ReceivingSession.settle is work-terminal|uncertain; close local; outer alone GLOBAL TCB drain.

## 2. Launch barrier and trusted channels

Node verifies lease/binding/ingress/artifacts and creates the private record.
Spawn fixed C with permit cwd/env, fixed descriptor arguments, `--` and exact
target argv; C execs that argv unchanged, without a new shell/PATH fallback.
C sends HELLO and forks nothing until Node verifies its actual image, argv,
UID, parent and raw identity, then ACKs initialization. No HELLO claim alone
authenticates C. Drift, missing support or unexpected children refuse launch.

Use separate inherited event C→Node and control Node→C pipes. Target stdin,
stdout and stderr have three further channels; supervisor stdout/stderr are
diagnostic channels, never target output or event records. Close all unused
ends promptly. The target receives only its approved stdio: control/event
descriptors and lifetime handles are closed/CLOEXEC before target execution.

C forks one new child; only that child calls `PTRACE_TRACEME`, then stops before
target exec. C requires successful SETOPTIONS, records its exact mask (not a
GETOPTIONS observation), captures stopped-task facts and sends ARMED. Candidates:
TRACEFORK, TRACEVFORK, TRACECLONE, TRACEEXEC, TRACEEXIT, EXITKILL, TRACESYSGOOD
and TRACEVFORKDONE. Unsupported options/syscall introspection refuse, not
degrade. No ATTACH/SEIZE of an existing or unrelated process is permitted.

Node commits ARMED to the registered record and ACKs release. C resumes only
that owned stop. The first EXEC stop is captured/ACKed before the new image's
userspace instructions; target executable/argv/UID/ABI must match admission.
Every subsequent birth/exec is likewise held until its raw identity edge is
registered. Child initial stops delivered before their parent event are held
in a bounded quarantine until the authoritative event-message birth joins them;
never infer parentage from a later PPid snapshot or resume an unmatched task.

## 3. Ordered, bounded protocol

Frames: 4-byte unsigned network-order length plus UTF-8 JSON, maximum64KiB.
Exact event keys: `{v:1, runId, clientId, seq, kind, body}`. IDs are parent-issued
non-secret correlation only; `seq` is canonical positive u64 decimal, starts1
and increases exactly1. Each body has exact fields fixed by the following table.
Raw bytes use canonical base64/decoded-size bounds. Unknown keys/kinds,
duplicates, gaps, malformed UTF-8/length or cross-client/run/phase replay refuse.

| Kind | Exact body fields |
| --- | --- |
| HELLO | supervisorFacts, artifactHash, abi, requestedOptions |
| ARMED | rootTask, facts, installedOptions |
| SYSCALL | task, syscallOrdinal, auditArch, number, registerArgs, decision |
| BIRTH | parentTask, childTask, cause, eventMessage, flags, childFacts |
| EXEC | task, priorImage, image, formerTid, eventMessage, facts |
| VFORK_DONE | parentTask, childTask, eventMessage |
| SIGNAL | task, waitStatus, siginfo, decision |
| EXIT_STOP | task, waitStatus, eventMessage |
| REAP | task, waitStatus, exitCode, signal |
| FINAL | lastSeq, taskCount, terminalCount, waitEchild, failure |

`cause` is fork/vfork/clone; `decision` is allow/deny/emulate-enosys, with
the admitted policy rule bound by syscallOrdinal. Unused exitCode/signal are
null. Facts/references below are typed, not free-form witness objects. Control
frames have exactly `{v:1, runId, clientId, cseq, kind, ackSeq}`; kind is
INIT/ACK/RELEASE/CANCEL. CANCEL adds exact `reason`; other variants may not.
Cseq is independently contiguous. ACK accepts only the next recorded event;
RELEASE consumes that acknowledged stop once. Unexpected ACK/release refuses.

One event credit is outstanding per client. Node reserves bounded transcript
capacity before ACK; C keeps at most1024 admitted task slots plus bounded
unmatched stops. Candidate transcript ceiling64MiB/client; reserve closure
capacity per task before admitting its birth. Limits are refusal/cancellation,
never truncation, coalescing, overwrite or silent event loss. C services control
and waits under nonblocking I/O while event/output channels are backpressured.
Running tasks may reach kernel stops; none resumes without its required ACK.

Sequence is wait-delivery order, not kernel total order across CPUs. Preserve
per-task order/birth/exec dependencies; never sort by wall time. Deadlines use
actual monotonic clocks, not caller ticks/Date.now, fake sleeps or renewed budgets.
Closed policy may handle ordinary non-identity syscall stops locally; no
selected lifecycle event or security-relevant admission result is omitted.
FINAL.lastSeq equals its frame seq; only ACK, not RELEASE, closes that frame.
C treats control EOF as cancellation. Event EOF before FINAL, partial frame,
failed write, ACK stall or exhaustion revokes the client and blocks restoration.

## 4. Creation/escape admission is necessary

TRACE options alone are not universal creation coverage. Candidate C policy uses
PTRACE_SYSCALL and PTRACE_GET_SYSCALL_INFO: require the pinned native audit ABI,
known syscall numbers and entry/exit pairing before continuing an owned task.
Reject compat/x32/unknown ABI or creation routes; no guessed register layout.

Classic clone flags come from the kernel register snapshot. Admit only closed
reviewed fork/vfork/pthread masks; reject UNTRACED, NEW* namespaces, PARENT,
ptrace transfer/unknown bits; CLONE_FILES requires admitted CLONE_THREAD.
Pointer-based clone3 arguments are not TOCTOU-safe merely because read once:
initially skip it, return explicit supervisor-injected ENOSYS and record
emulate-enosys; trace any real legacy fallback. Never label this kernel lack of
support. Supporting clone3
requires a separately proved memory-stability barrier before changing policy.

Deny unshare/setns, tracee ptrace, pidfd_getfd, io_uring escape/transfer paths
and unreviewed policy-changing seccomp/prctl paths before execution. Any
unclosed escape remains OPEN and prevents a history-completeness claim.
EXEC validates the actual new stopped image, including execveat/script cases;
unknown images, privilege/namespace changes or stop classifications refuse.
Do not suppress genuine signal-delivery stops as if they were exec events.

## 5. Task, thread, exec and socket identities

TaskRef denotes a kernel-observed birth, ProcessRef a thread-group incarnation,
ImageRef an exec transition; never reuse refs for numeric PID reuse. Facts have
exactly tid/tgid/ppid/uid/gid/startTicks/pidNamespace/proc/executable/argv.
Proc has exactly status/stat/exe/cmdline, captured raw while stopped. Namespace
is the admitted kernel namespace identity; numeric facts are not capabilities.
Only approved non-secret argv/facts enter transcripts; environment, stdin and
Docker payloads remain opaque streams/hashes, never diagnostic/raw receipts.

Nonleader exec/de-thread can change the reported TID and retire sibling task
identities. Join the EXEC event's former TID and actual resulting facts to the
same history, explicitly recording re-identification; never invent another
fork, reuse the old leader's record or assume startTicks cannot change.
Only pinned-kernel semantics plus a real multithread-exec fixture may close
retired slots without ordinary final waits. Until proved, that transition
refuses; it is not a fabricated REAP or successful universal thread support.

Shared/inherited descriptors are not new connector identities. SO_PEERCRED
and SO_PEERPIDFD identify the connection-time peer, not the thread/process
writing each HTTP request. Raw ProcessRef/ImageRef history must precede linking
the exact accepted Socket object and genuine held peer-lifetime handle; match
namespace/lifetime facts, not a later numeric PID lookup. No post-hoc pidfd_open
may replace SO_PEERPIDFD. Owned cancellation pidfds below have a different role.

An accepted-socket WeakMap may reference a proven client family, but forked or
CLONE_FILES descriptor inheritance, SCM_RIGHTS delegation, foreign fd theft
and cross-process writers cannot be assumed away. This supervisor is not a
complete FD-provenance tracer. Until a reviewed closed transfer/ownership rule
and actual native linkage prove that boundary, forwarding remains blocked;
never fabricate actorPid per request from the connector or JSON metadata.

## 6. Cancellation, waits and all-role drain

Every Docker/workflow Role, including restore, shares the global registry/environment/terminal path.
One-way phase seal forbids new prepare/ordinary starts; running work may finish.
Finite drain/cleanup observers must register before seal and may start only at
their declared barrier while unaborted. No recursion or post-seal admissions.
Advance consumes only the current sealed phase, once, checking local+daemon+backend
proof bound to run/phase/final registry revision and every observer terminal,
plus NextPhasePermit bound to existing workflow authority. No reopened phase/factory.
Unresolved/uncertain mutation or incomplete post-observer proof blocks advance;
quiescence is a passive global fold, never a new probe or omitted own backend.
Runner194–228 retains failure on finally restore; reset-state224–287 consumes
one failed-prefix recovery after proof resolves pending state. Drained nonzero
may use that existing allowance; original failure stays latched through restore.
Run cancel/close revokes every new phase/start/ordinary release, observers too;
queued observers are cancelled, active ones use the same owned cancellation.
Only cancellation/wait settlement continues; no newly admitted cleanup command.
local-child.cancel240–244 maps to run-wide abort, not client-only cancellation.

C is a dedicated single-thread waiter owning no unrelated children. Consume
all traced waits with __WALL; validate each returned task against birth/quarantine
state. EXIT_STOP is not terminal: continue the owned exit stop and await final
wait status. De-thread exceptions require the proved mapping above. ECHILD
plus zero live/unmatched slots is necessary, not enough by itself.

Cancel uses private control; C revokes releases and kills only held owned pidfds
acquired while kernel-born tasks were stopped/unreaped. Never numeric-PID/group
fallback, foreign attach/scan/signal. Identity/acquisition uncertainty bars resume.
Only a stopped owned task may continue with SIGKILL under its live ptrace fence;
never reuse that integer after final wait. EXITKILL is a tracer-death fail-safe,
not drain proof. Unresponsive C at deadline returns uncertain, not guessed kills.

Local drained requires acknowledged history, all task terminal waits, FINAL then
event EOF, target stdin/stdout/stderr and supervisor stdout/stderr settlement,
and Node's actual supervisor close; inherited writers cannot be ignored.
Supervisor0 is protocol completion only; target nonzero/signal/cancel/timeout
remains failure. Docker upgraded streams/jobs and PostgreSQL backends need
separate proofs, not C exit/empty tasks. Gaps retain first failure/ownership/
evidence and block restore; cleanup errors are secondary. Only identity-checked
owned artifacts may be cleaned after proof; foreign residue remains untouched.

## 7. TDD witnesses and minimum future paths

| Discriminator | Required actual witness / limit |
| --- | --- |
| First exec barrier | Real target writes a marker only after registration/ARMED/EXEC ACK; withheld ACK proves no early progress. |
| Short-lived fork/vfork | Real kernel events and independently controlled pipe barriers retain birth/exit even when later snapshots miss the child. |
| Threads/de-thread exec | Real pthread/nonleader exec fixture records independent TIDs; validate raw event-message mapping and complete waits. |
| Escape policy | Real UNTRACED attempt cannot create an untracked child; clone3 observes recorded injected ENOSYS and any real fallback, never fake kernel refusal. |
| Loss/backpressure | Actual full/closed pipes and interrupted owner revoke progress; pure codec corruption tests do not count as native history proof. |
| Cancel and tracer death | Real owned descendants/held writers terminate or explicitly remain uncertain; unrelated owned-by-test sentinel remains untouched. |
| Terminal versus success | Real nonzero/signal/timeout, delayed EOF and missing FINAL never become work success or restore authority. |
| Identity/capability | Replay, wrong phase, replaced artifact and reused stale refs refuse; do not force global PID pressure or claim reuse unless actually observed. |
| Socket writer distinction | Real inherited/SCM_RIGHTS socket exposes connector-versus-writer gap; no Docker attribution passes from history alone. |
| All roles/observers | Actual finite observer batch has the same environment/registry/terminal obligations; unfinished observer blocks restore. |
| Phase authority | A real held observer blocks advance; drained nonzero retains failure through authorized recovery; run abort, stale proof/factory/signal cannot restart. |

Proposed later new paths under `infra/database-upgrades/native-tracing/`:
`owned-supervisor.c`, `owned-supervisor.mjs`, `owned-supervisor-protocol.mjs`,
`owned-supervisor-build.mjs`. Native tests: `tests/native/dec203-owned-supervisor.test.mjs`,
`tests/native/fixtures/dec203-supervised-client.c` and
`tests/native/helpers/dec203-owned-supervisor-harness.mjs`. No path is released
by this list. Frozen peer files, old host bindings/history/drain and trace
fixtures require separate exact claims and inverse-preservation evidence.

## 8. Root primary-source questions / proof limits

Fetch pinned Linux: ptrace options/__WALL/stops (`kernel/ptrace.c`, `kernel/exit.c`);
clone/syscall ABI (`kernel/fork.c`, architecture tracing); de-thread/start-time
(`fs/exec.c`); connector/TGID, pidfd/SCM_RIGHTS (`net/core/sock.c`,
`net/unix/af_unix.c`, `fs/pidfs.c`).
Prove local support, exec ordering, pidfd cancel/de-thread waits and Node22 pipe
inheritance/close with native tests, not headers/versions. No primary fetch or
process observation occurred; history, peer linkage, Docker attribution,
all-client drain and native080 remain separate OPEN gates.
