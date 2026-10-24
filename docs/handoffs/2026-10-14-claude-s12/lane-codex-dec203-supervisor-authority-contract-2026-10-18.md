# DEC203 supervisor authority — proposed private issuer contract

Design only, UNRUN; selected finite TCB amendment is cascaded, not source/TEST release.
Historical source hashes below are baseline observations, not current release pins.
No native producer, kernel support, ALT acceptance or new reset authority is proved.

## Approach

Use the fixed outer CLI/inner coordinator route and one retained producer-owned registry.
Callers select existing workflow steps, never manufacture permissions or proofs.
Keep missing producer contracts explicit; matching DTOs cannot fill those gaps.

## Scope

In: callable issuers, finite prerequisites, consumption, revocation and valid controls.
Out: implementation, arbitrary commands/source/PID/fd APIs, runtime or gate activation.
The approved ALT target, four locks, upstream and existing failure semantics stay fixed.

## 1. Current source versus proposed authority

All source references below are under `infra/`, with database modules under
`database-upgrades/delivery-receiving-upgrade-` (abbreviated `DU-`).

| Current source | What it establishes; what it does not |
| --- | --- |
| `DU-host-request.mjs:55–111,139–211` | Explicit injected dependencies and sealed request bytes; no authentic native issuer. |
| `DU-host-executables.mjs:57–119,168–202` | Closed binding and observed artifacts/ingress; DTO equality is not resource ownership. |
| `DU-host-boundary.mjs:65–123` | Explicitly consumes observations without authenticating their producer. |
| `DU-host-reset.mjs:16–43,98–138` | Private reset handles and recovery lifecycle; native ports are deliberately absent. |
| `DU-local-prefix.mjs:52–75,89–137` | Preflight state binds source/initial authority; a supplied attestation is not a new issuer. |
| `DU-local-reset-state.mjs:224–287` | One failed-prefix recovery attempt, consumed before its await; pending mutation blocks staging cleanup. |
| `run-delivery-receiving-upgrade.mjs:194–228` | Finally attempts authorized restore after reset attempt; original failure wins. |
| `DU-local-child.mjs:20–96,240–244` | Actual OFD-lock facts required; cancel permanently closes that client's whole registry. |

Historical supervisor-plan source baseline SHA (not a current release pin):
`8fcb880538f3bbcd917bd6f2aa8bdb26674c66ac33efd9e19176d3f6d6e7e6ed`.
Its protocol, syscall/FD gaps, phase seal and complete-drain requirements remain binding.

## 2. Single construction route and module ownership

Proposed entry in `native-tracing/receiving-native-bootstrap.mjs`:

```ts
createReceivingSupervisorSession({plan, signal}): ReceivingSession;
// Exact own keys: ready, settle, close. Construction is synchronous.
ready: Promise<{supervisor: OwnedSupervisor, workflow: Workflow, metadata: Metadata}>;
settle(): Promise<{state: 'work-terminal' | 'uncertain', failure: SupervisorError | null}>;
close(): Promise<void>; // run-wide revocation before await; local cleanup, not own exit proof
```

Options have exactly `plan,signal`; no fs/process/clock/observer/mint callbacks.
Plan is existing validated receiving scope, copied before await and reobserved from
fixed allowed source/inventory. Its target/IDs/hashes do not themselves grant authority.
Signal is a real AbortSignal, not a renewal token. No ambient/default adapter fallback.
The module reserves its one bootstrap/coordinator synchronously before any await.
Repeated/concurrent construction refuses, including after failure, abort or close.
A pre-aborted session latches abort without allocation; ready rejects CANCELLED.
Its claimed bootstrap remains spent: a fresh signal cannot retry that run.
A new runId, imported factory view or phase view cannot replace that retained registry.
This is a trusted host-module boundary, not protection against hostile same-UID JS.

The session exists before allocation; failed bootstrap retains actual settle/close.
Ready requires genuine adoption/build, all inputs/gates and native RUN_ACK; never partly ready.
Inner settle covers results only; close is local cleanup, not its own process-exit proof.
Uncertainty rejects DRAIN_UNCERTAIN; only the outer actual record proves GLOBAL TCB drained.

`native-tracing/owned-supervisor-authority.mjs` alone owns the coordinator, phase,
permit and proof WeakMaps. Constructors/mint functions are not named exports.
The fixed bootstrap, workflow and native history/finality modules are its only callers,
through run-bound closures created once internally, not caller-supplied factories.
Private `createOwnedSupervisor({run,lease,ingress,artifact,policy})` has exactly those
five keys. It consumes genuine same-bootstrap inputs once; it is not a public test API.
`supervisor.initialPhase` is minted there once as preflight, not accepted as an input.
All phase views close over this coordinator; none owns another acceptance/abort latch.

Every authority token (`*Capability`, `*Permit`, `*Proof`) is frozen, null-prototype,
with zero own keys, symbols/nonenumerables included; authority lives in its private record.
Metadata, JSON, structured clones, spreads, matching IDs and prototypes grant nothing.
Capabilities cross private calls by exact object identity only; no deserialize/adopt API.

## 3. Input issuers: actual resources, not trusted names

Private calls have exact option keys and close over the one native BootRecord;
none accepts a caller-created bootstrap record or exports a constructor:

```ts
adoptReceivingLease(): LeaseCapability;
buildSupervisorArtifact({lease}): Promise<BuildCapability>;
openReceivingIngress({lease, artifact}): Promise<IngressCapability>;
compileReceivingPolicy({plan, lease, artifact, ingress}): PolicyCapability;
mintRun({lease, artifact, ingress, policy}): RunCapability;
```

| Input / sole issuer | Required actual construction and lifetime |
| --- | --- |
| LeaseCapability / native bootstrap | Genuine fixed C-owner FLOCK3–6 handoff; original-owner pidfd7 AND driver pidfd10, actual ancestry/descriptions and native cancellation/release checks. No caller owner/FD list; recheck after awaits and before release; loss/replacement revokes. |
| BuildCapability / fixed supervisor builder | Fixed source/support/toolchain, closed actual build, full bytes/identities and output handle. Selected finite TCB prehistory is not continuous history/client proof; no caller-selected binary/source or receipt grants authority. |
| IngressCapability / native ingress owner | Create and retain the fresh canonical0700 parent and0600 listener, actual bound identities and lifetime; retain immutable upstream `unix:///run/docker.sock`. No caller socket/path DTO becomes ownership. |
| PolicyCapability / fixed operation compiler | Compile the reviewed finite operation/witness matrix against sealed plan and actual source bytes. No caller rules, allow-all mode, role string or unknown-operation fallback. |
| RunCapability / coordinator | Mint only after the four same-bootstrap inputs are live and their native prerequisite gates pass. Bind one registry, lease, ingress, artifact and policy; never mint from a plan/attestation alone. |

Selected route: outer receiving-native-launch CLI, one C owner and fixed coordinator.
Genuine capabilities stay inside; outer status IPC never grants authority. The reviewed
native-bootstrap-interface fixes3–10, separate channels, both lifetimes, native CANCEL/
HUP/release latches; TSFN is notification only. Root's TCB amendment selects finite
fixed compiler/lease-owner/coordinator PREHISTORY, never Docker/SQL/setup/probe/
migration/reset/restoration/observer work. EVERY workflow client keeps continuous
history/finality; metadata or duplicated FDs cannot extend original authority.
The fixed recipe/profile and actual native positive gates remain mandatory.

Build/ingress/policy capabilities expose no public methods. Their owners retain native
handles and revocation routines; metadata exports contain diagnostics only.
Ready preflight may issue only fixed read-only ALT probes, not reset permission.
Actual probe transcripts must establish target/database/source authority before prefix.
Thus bootstrap does not require a mutating reset to prove permission for its first probe.
Peer-history/lifetime and connector-versus-writer proof remain prerequisites for forwarding;
an ingress capability alone never authorizes bytes, Docker operations or a reset.

## 4. Finite workflow issuer and immutable client permits

`native-tracing/receiving-supervisor-workflow.mjs` closes over the retained run,
actual native transcript consumers and existing prefix/reset/session state machines.
Workflow has exactly `permitClient,prepareObservers,drainProof,nextPhase` methods:

```ts
permitClient({step: Step}): ClientPermit;
prepareObservers({phase: PhaseCapability}): readonly OwnedClient[];
drainProof({phase: PhaseCapability}): Promise<PhaseDrainProof>;
nextPhase({prior: PhaseCapability, proof: PhaseDrainProof}): Promise<NextPhasePermit>;
```

Step has form `<stage>:<ordinal>`; stage is exactly preflight, prefix, setup, before,
migration, after or baseline, with canonical decimal ordinal0–1023. Only actual entries
of the fixed plan-derived manifest exist; matching grammar never creates a slot.
The operation compiler must pin each entry before ready (gap D), not learn new work.
`run` and `spawn` are transport entrypoints, not permission to add another command.
Each role, including probes/observers/drain observers, uses the same permit/prepare path.

| Manifest slot family | Issuer prerequisites; no caller-supplied success marks |
| --- | --- |
| Preflight probe batch | Live input capabilities; fixed read-only target, applied-history and source checks only. |
| Prefix reset | Accepted initial authority, prefix inventory/staging checks and fresh lease/binding rechecks; existing purpose prefix/sequence1. |
| Setup, before observer, migration, after observer | Accepted prefix transition; existing ordered setup COMMIT/snapshot/outcome gates. Native transcripts feed the actual validators; distinct backend sessions remain required. |
| Phase drain/recovery observers | Exact finite batch derived from witnessed operation IDs and existing workflow state, prepared before seal; no arbitrary probe or recursive observer slot. |
| Baseline restore | Accepted case reset or successfully proved one-shot failed-prefix recovery; baseline inventory, original initial authority and existing purpose baseline/sequence2. |

Slots consume verified producer results, not `accept(result)` calls from the test/runner.
After every await, issuance/release rechecks the same run latch, live inputs and phase/
revision. It reserves any one-shot workflow attempt before await; failure cannot renew it.
The issuer binds role, phase, executable/image set, exact argv/cwd/environment, immutable
stdin bytes/hash, sinks and deadline into the permit record. No overrides at prepare/start.
Dynamic Docker IDs come only from paired native response witnesses before slot minting.
Fixed setup readiness may release only its existing literal COMMIT after rechecks;
there is no caller stdin-writer, arbitrary callback or extra interactive command API.

Mint reserves one slot synchronously; duplicate mint, forged/stale phase or wrong step
refuses without issuing another permit. Permits cannot migrate to another phase/run.
`prepare({permit,signal})` checks real identities, phase/open state and abort latches
before consuming. Invalid calls do not burn a valid permit. A genuine pre-aborted client
consumes its slot into terminal no-launch cancellation, then refuses CANCELLED without
native allocation; a fresh client signal cannot refund that slot.
Successful admission consumes once and registers the client before any await/spawn.
Later preparation failure leaves a terminal failed record or an uncertain owned record;
it never refunds the permit or silently removes the registry entry. First failure latches.
Start is one-use, run/phase-gated and ordered by the original supervisor ACK protocol.
Client cancel before start records owned no-launch settlement; it cannot mint replacement work.

`prepareObservers` is one-use per phase. It prepares the complete finite batch through
ordinary permits, registering even queued observers before seal. The batch has declared
barriers and no recursive child-observer factory. All required slots must be prepared
before `seal`; missing registration refuses rather than treating absence as completion.
Seal revokes unprepared ordinary slots/permits; prepared observers alone may start at
their declared barriers while unaborted. Their own subprocesses/backends remain included.

## 5. Transcript and drain proof provenance

TranscriptCapability is minted only by the native history owner for that registered
client. Launched work requires the actual private event pipe, attested C instance,
contiguous acknowledged events, actual waits, FINAL/EOF, all streams and Node child close.
Only a synchronously proved no-spawn/no-handoff record may carry a no-launch transcript;
it records no invented kernel events. An attempted/uncertain spawn cannot use that branch.
It can represent failed/partial evidence; possession alone does not mean complete/success.
Private `captureTranscript({client})` accepts only the registered genuine OwnedClient;
the native history owner supplies all record contents, never a caller event/proof object.
The private validator reads that issuer record; callers cannot supply a transcript DTO,
raw PID list, event array or replacement pipe. A diagnostic snapshot cannot mint it back.

`drainProof` reads the sealed phase/global fold and fixed native finality producers.
PhaseDrainProof is minted only when every registered client and preadmitted observer
is terminal with complete local history/streams, including cancelled and nonzero work.
No task/peer/operation/stream gap or unresolved mutation may be hidden by work exit0.
The private record binds exact run/phase objects, final registry revision, complete
observer-terminal set, transcript identities and native daemon/backend proof identities.
Revision increments on client admission/release/terminal or ownership changes, not
capability mint/reservation alone. Final proof mint itself does not change revision.
Any later change invalidates the proof; no observer may be admitted to repair it.

Independent daemon proof must cover every paired create/exec/job and upgraded stream,
the immutable actual daemon and ALT-only target transitions, with terminal outcome.
Nonzero terminal work remains failed, not absent or successful. Backend proof must cover
the independent owned superset including every probe/observer's own backend, after its
last relevant work. Source timestamps, appname, empty DTOs and client exit are insufficient.
Neither history nor operation-policy validators are native proof producers by naming.

Proposed private native-finality method, not an injectable observation callback:
`collectFinality({phase}) -> Promise<{daemon,backends}>`, exact keys and opaque outputs.
It takes only the issuer-known phase, obtains registry revision/observer watermarks itself,
and returns same-run native producer capabilities; it accepts no raw proof arguments.
Its owner must actually retain independently authenticated causal observations through
the final observer terminal barrier without starting new unregistered work. Gap C remains.
After collection, recheck the unchanged final revision, observer set and run/phase latches
before minting; a raced cancellation/ownership change cannot leave a usable stale proof.
If that cannot be proved, `drainProof` rejects DRAIN_UNCERTAIN; no NextPhasePermit exists.

## 6. Phase transition and cancellation semantics

Only preflight→prefix→case→baseline→complete, or proved failed-prefix→baseline, is legal.
Phase labels are diagnostic; genuine PhaseCapability objects are coordinator-minted.
`nextPhase` validates the authentic proof, current sealed phase and existing workflow
authority. Successful preflight/prefix gates issue their single exact successor permit.
Case work failure may still issue baseline permission only after complete drain and the
existing accepted reset. The failed-prefix workflow consumes its recovery attempt before
starting its preregistered ownership/reobservation barrier. Failure burns that attempt.
This work finishes inside the prior phase before drainProof can mint; nextPhase cannot
launch a recovery observer after proof. Recovery is not an untracked post-seal probe.
Only successful recovery resolves pending mutation and permits baseline, with no accepted
prefix epoch fabricated. Unknown identity/pending mutation does not become recovery.
Baseline→complete additionally requires accepted baseline transition and restored staging.

NextPhasePermit records run, exact prior/proof/revision, target phase and transition slot.
Mint reserves that slot once; no second permit from replayed proof or concurrent calls.
`advance({prior,proof,permit})` has exactly those keys and is synchronous: validate first,
then atomically consume the permit/proof and mint one successor under the same registry.
No awaits/partial transition, reopened phase, old permit reuse or fresh-factory bypass.
Failure before consumption preserves existing records; revoked/uncertain authority never
re-enters an open phase. Previously latched work failures survive successful restoration.

OwnedClient.cancel revokes that client only; a drained failure can reach the already
authorized recovery path. It does not reopen a slot or grant another client permission.
The session signal is run-wide; prepare's signal is client-local.
Run signal/cancel/close sets an irreversible coordinator latch before await, revoking
all permits, successors, starts and ordinary releases in every phase, observers included.
Queued observers settle cancelled; active observers take the same owned cancellation.
Only cancellation/wait settlement continues; no post-abort cleanup/probe/restoration
command is admitted. Replacing signal or client object cannot renew run authority.
Existing local-child.cancel/local-session.cancel must map to that run-wide latch.

## 7. Closed refusal/error and positive TEST contract

Errors use the frozen SupervisorError tokens, with identical `.code`/`.message`:
REFUSED for shape/forgery/cross-run/stale/consumed/illegal workflow; CANCELLED for
run/pre-abort; IDENTITY_CHANGED for observed drift; UNAVAILABLE for absent native
issuer/support; PROTOCOL/HISTORY_GAP for transcript loss; TIMEOUT/FAILED for work;
DRAIN_UNCERTAIN for incomplete finality. Each suffix has `DEC203_SUPERVISOR_` prefix.
Unexpected programming errors never become success/proof. Retain the first failure;
cleanup errors remain secondary. Serialization/logging exposes no secrets or raw handles.

| TDD level | Genuine control and discriminator |
| --- | --- |
| Pure unit state machine | Ordinary non-authoritative event data exercises ordering/refusal; it cannot mint RunCapability, native proof or clear a native gate. |
| Private issuer positive | Invoke the actual bootstrap entry with the existing valid plan under a real approved four-lock handoff; obtain real ready/workflow, permit, prepare, seal and proof objects. No test-only constructors or injected producer success. |
| Authority negatives | After that valid control, try clone/replay/cross-run/view, duplicate mint/prepare/start, preabort, failed prepare, seal omission and stale revision; prove no extra launch/mutation. |
| Real phase race | Hold an actually registered observer/stream/backend; advance must refuse until independent terminal proof. Race run abort against nextPhase/advance; abort wins without renewing authority. |
| Recovery positive | Actual drained failed prefix, one real ownership proof and baseline restore preserve original failure; repeated recovery, uncertainty and run abort cannot authorize a second attempt. |
| Native acceptance | Real C/kernel history, owned resources, peer/writer linkage, actual ALT lease, independent daemon/backend terminal facts and baseline verification; mocks/unit GREEN cannot substitute. |

## 8. Open producer interfaces and bounded follow-on

A/B. The selected TCB amendment and reviewed native-bootstrap-interface fix the
outer CLI/inner coordinator, actual3–10 handoff and separate construction boundary;
the native issuers are still unimplemented. Inner settle is work-terminal|uncertain.
Only outer FINISH/native join/alias close/I exit/C wait+EOF/C close/streams can prove
GLOBAL TCB drained. Compiler receipts are not history, no-launch or PhaseDrainProof.
Full bootstrap/RUN_ACK TESTs remain HELD until all genuine inputs/gates exist;
The reviewed private pre-ready-runtime-binding grants no ready/capability/workflow/drain authority; no synthetic RUN_READY.
C. Current observeDaemonWork/observeBackends are injected ports. A finite final observer
cannot certify its own later backend absence by omitting itself or spawning a successor.
Close the passive post-observer native-finality interface above; otherwise advancement
and restoration remain blocked, even with a genuine local transcript.
D. Peer lifetime, syscall escape/FD transfer closure and complete operation-policy native
producers remain separate gates. A genuine capability brand cannot erase their gaps.

Source-selection fixes32 pre-ready paths; lease owns lexical constructor/issuer/
LeaseBuildRecord/native owner; bootstrap only a guarded zeroarg void caller.
Full owned-supervisor-authority/workflow/native-finality stays HELD, not caller options.
Later local-prefix/reset-state/session/runner integration needs separate exact claims.
Never add a parallel validator path or legacy/native admission fallback.

## Steps and assumptions

1. Close A–D against actual producer/resource ownership before claiming native readiness.
2. Pin exact source/module/launcher interfaces and independently review their trust boundary.
3. Stage pure state-machine tests separately from actual-issuer/native-resource tests.
4. Observe missing-API RED without allocating fixtures; never add success-capable stubs.
5. Implement one retained issuer/registry with finite workflow integration under new claims.
6. Validate real positive controls, races, failures and complete ALT baseline restoration.

Assume the existing trusted-host boundary and owner-approved ALT workflow only; no new
product decision, provider access, privilege, kernel policy or arbitrary-command scope.
This document's FS/source review is not execution. Root owns all release and validation.
