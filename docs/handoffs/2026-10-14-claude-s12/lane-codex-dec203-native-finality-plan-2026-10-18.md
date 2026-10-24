# DEC203 native finality plan — 2026-10-18

Design-only, source-only, UNRUN. This is a bounded proposal for authority-contract
gap C; it is not a producer release, kernel-support claim, acceptance receipt, or
architecture selection. No existing source, observer, drain, test, or decision changes.

## 1. Locked authority and conclusion

The authority contract requires a private `collectFinality({phase})` issuer method,
not an injectable observation callback. It must obtain the issuer-owned revision and
observer watermarks, retain authenticated observations through the final observer
terminal barrier, avoid starting an unregistered observer, then recheck revision,
observer set, phase and run latches before minting proof
(`lane-codex-dec203-supervisor-authority-contract-2026-10-18.md:175-213`).
`drainProof` must cover every registered client and preadmitted observer, independent
daemon terminal facts for every paired operation, and the independent backend-owned
superset after its last relevant work; DTOs, timestamps, app names and client exit do
not qualify
(`lane-codex-dec203-supervisor-authority-contract-2026-10-18.md:188-213`).

The smallest compliant design is one finite passive producer, armed as a preadmitted
finality record while the genuine final observer backend is alive, then collected
after the observer terminal barrier. It cannot be a second infinite observer, a
post-seal SQL probe, or a child-observer factory. Current sources do not prove the
candidate backend-PID namespace/cgroup mapping or a read-only native issuer. Gap C
therefore remains OPEN; this document records the narrow testable route and its
fail-closed limits.

## 2. What the current source actually proves

| Source | Concrete contract | Missing authority |
| --- | --- | --- |
| `delivery-receiving-upgrade-local-observer.mjs:55-84,192-232` | SQL marker contains the target database, `pg_backend_pid()` and application name; final snapshot requires a separate PostgreSQL backend, read-only `BEGIN`/`ROLLBACK`, and lossless 070 data. | It does not map that namespace PID to a host task, hold a pidfd, or prove backend absence after its own close. |
| `delivery-receiving-upgrade-host-drain.mjs:119-168` | Injected `observeProcessTree`, `observeDaemonWork` and `observeBackends`; daemon values require exact `execs/jobs`, terminal `Running=false`, `Pid=0`, `ExitCode=0`, while backend array must be empty. | The dependency values have no native issuer; success-only `ExitCode=0` and an empty injected array are not finality proof for nonzero or causally unknown work. |
| `delivery-receiving-upgrade-host-request.mjs:55-111` | Explicit injected `fs`, process observers, clock and `nativeBinding`; lease is four lock records. | `nativeBinding` is an injected record, not a producer of daemon/backend causality or namespace identity. |
| `delivery-receiving-upgrade-host-boundary.mjs:49-126` | Consumes independent raw boundary/source observations and rechecks the lease. | The module explicitly validates observations without authenticating their producer. |
| `delivery-receiving-upgrade-local-child.mjs:20-96,98-105,240-247` | Verifies inherited lock OFDs and gives each client a finite child runner; `cancel` closes admission and waits owned handles. | No target-container namespace map, backend pidfd, Docker-job collector, or post-observer native finality. |

The existing native directory is narrower. `README.md:7-18,28-58,60-66` documents
the peer and lifetime factories, but explicitly says the lifetime primitive does not
identify a byte writer, PostgreSQL backend or Docker job. `peer-credentials.mjs:20-40,
181-226` returns only connection-time `{pid,uid,gid,device,inode}` for a validated
Unix stream. The lifetime addon is socket-specific: `peer-lifetime-state.h:84-216`
acquires `SO_PEERPIDFD` from that socket, polls its held pidfd and checks
`/proc/self/fdinfo`; it cannot open or identify a PostgreSQL backend PID or Docker
job. `peer-lifetime.mjs:117-206` exposes only the private socket handle's `read`/`close`.
No current native module reads the target container's init namespace, cgroup
membership, or `NSpid` chain.

## 3. Candidate C: backend PID to held lifetime

Candidate protocol (not yet authorized):

1. Seal and genuinely drain every other causal client plus every known daemon exec/job
   before the final observer release. Any unclosed causal source or unknown nonobserver
   member refuses; this is not satisfied by client exit alone.
2. The final observer's last relevant query must obtain a complete, independent census
   of target backends, not merely the 070 catalog, an application-name filter or the
   observer marker. The only census member may be the observer's genuinely held live
   backend; an extra or unknown member blocks. The existing observer is not this split:
   it sends `BEGIN`, the snapshot fixture and `ROLLBACK` in one noninteractive input and
   parses the marker only after completion
   (`delivery-receiving-upgrade-local-session.mjs:186-213`).
3. Before terminal release, the private integration validates an authentic READY
   boundary, then arms native identity and held-handle acknowledgement. A read-only
   producer independently attests target init namespace, cgroup and
   `/proc/<host-pid>/status` `NSpid`, proving one current host task for the genuine
   observer backend. Numeric PID equality, same-UID `/proc`, app names or container
   names do not qualify. The initial handle method and race/identity contract remain
   an implementation gate.
4. The interactive split then writes exactly one literal `ROLLBACK`, closes/settles EOF
   and performs no further SQL. It adds no arbitrary stdin API; current noninteractive
   `local-child.mjs:207-229` cannot supply this pre-close acknowledgement.
5. `collectFinality({phase})` polls the original held handle after observer settlement
   and reads only already-admitted finite daemon terminal facts. A live handle, linkage
   drift, missing event, unresolved mapping or census change returns uncertainty; it
   cannot start another SQL observer or repair the record.
6. The coordinator rechecks the unchanged global revision, observer set, phase/run
   latches, target identity and census. Only then may `drainProof` expose opaque
   backend/daemon proof to `nextPhase`; a later admission invalidates it.

The final observer PID alone is not the owned superset. Complete independent backend
census plus drained nonobserver causal sources is the minimal candidate; a complete
PostgreSQL birth trace is an optional alternative, not a locked requirement. No
attachment to a preexisting postmaster, eBPF/proc connector, PostgreSQL
logging/configuration change or persistent collector is proposed.
The peer primitive cannot be reused for this purpose. `SO_PEERPIDFD` describes the
connection-time peer of an accepted Unix socket, not the PostgreSQL backend or each
Docker writer (`lane-codex-dec203-owned-supervisor-plan-2026-10-18.md:212-224`).

## 4. Feasibility and fail-closed boundary

Static source review finds no producer for the required namespace/cgroup/NSpid chain,
no authorized host-to-container PID mapping, and no proof that the current process can
read those facts without an added privilege or helper. The existing fs port lists
generic `readFile/readdir/lstat/stat/realpath/readlink` only, while process observers
remain injected (`host-request.mjs:55-87`). The supervisor plan's `pidNamespace` and
raw `/proc` facts are proposed history fields, not an implemented issuer
(`lane-codex-dec203-owned-supervisor-plan-2026-10-18.md:194-210`). The peer
credential/lifetime suites are now real GREEN primitives, but they attest only an
ingress socket peer and do not prove backend mapping, privilege, phase membership or a
finality producer (`native-tracing/README.md:36-58`).

Candidate C is currently **unimplemented/unproved**; `UNAVAILABLE` below is the
proposed runtime error when its producer/capability is absent, not a verified claim
that this kernel or host cannot provide it. If the producer cannot independently attest
namespace, cgroup, `NSpid`, initial held-pidfd identity and complete target-backend/
nonobserver causal-source closure under existing authority, `collectFinality` must return
`UNAVAILABLE`/`DRAIN_UNCERTAIN`; it
must not accept the SQL PID, same-UID `/proc`, or a claimed container mapping. No
default adapter, persistent service, elevated helper, unknown signal, or generic backend
termination is an acceptable fallback.

## 5. Closed passive Docker comparison

A finite Docker-side collector can cover only its own known work: paired create/exec
IDs, upgraded streams and `/exec/{id}/json` terminal `Running/Pid/ExitCode` facts,
plus source-defined jobs. The existing drain contract shows the required daemon
superset but receives it through injected `observeDaemonWork` (`host-drain.mjs:129-160`).
An HTTP 2xx, response hash, stream closure, or container inspect cannot prove an
arbitrary PostgreSQL backend has exited. A passive API endpoint is admissible only when
the pinned Docker source proves its exact method/path/body and actual operation ID;
unknown schemas or guessed fallback routes refuse. Docker-only collection can therefore
be one component of `collectFinality`, not a replacement for backend-owned finality.

## 6. Smallest private interface/file proposal

Preserve the authority contract's exact private entry in a new module:

`infra/database-upgrades/native-tracing/receiving-native-finality.mjs`

```ts
collectFinality({phase}): Promise<{daemon: unknown, backends: unknown}>;
```

The function is a run-bound closure, not an export accepting raw proof, PID, socket,
observer, clock, process or backend arguments. Its internal state is armed by the
existing coordinator while `prepareObservers` registers the finite finality record;
there is no public `arm`, recursive observer, or fresh factory. Outputs remain opaque
producer-owned records with exact keys checked by the authority owner. A C/Node-API
helper may be proposed only after a source review proves namespace/cgroup/NSpid reads,
held-task pidfd semantics and current-UID authorization; otherwise no helper path is
created. Existing `peer-lifetime.*` is not extended or reinterpreted.

The coordinator invokes `collectFinality` only after the final observer terminal
watermark, then performs the authority contract's revision/observer/latch recheck.
`DRAIN_UNCERTAIN`, `IDENTITY_CHANGED`, `UNAVAILABLE`, protocol/history-gap and first
work-failure semantics remain distinct. No finality method may log SQL/env/secret
payloads, emit raw PIDs as authority, or mutate Docker/PostgreSQL state.

## 7. Minimal native positive/negative TEST split

Proposed new test only after the producer exists and an owner-approved read-only
capability/source check pins the initial backend-handle acquisition method and its
race/identity contract. A verified live-task `pidfd_open` may be the initial method;
late numeric lookup or post-observer pidfd acquisition is never a fallback:
`tests/native/phase-02-slice-12-dec203-native-finality.mjs`.

Positive control uses the actual approved four-lock ALT run and real final observer:

1. Seal and drain every other causal client and known daemon exec/job; verify no
   unclosed source or unknown nonobserver member remains.
2. Hold the final observer's last relevant query open long enough to obtain a complete
   independent target-backend census (not 070-only or marker/appname-filtered); the
   observer's genuinely held backend is the only allowed member.
3. Validate the authentic READY boundary, arm native identity and the pinned initial
   handle acquisition while that backend is alive, then require the namespace/cgroup/
   `NSpid` linkage and held-handle acknowledgement.
4. Write exactly one literal `ROLLBACK`, settle EOF, and perform no further SQL. After
   `observerDocument` terminal validation, poll the original handle and require all
   known daemon jobs/execs terminal plus unchanged global revision/observer/latches.
   Unknown census members or causal sources remain a refusal, not an empty set.
5. Accept one opaque `drainProof`; permit the existing baseline restoration path only
   after all ordinary clients are quiescent. No fixture DTO or synthetic producer is
   a positive control.

Required negative controls:

- SQL PID with no namespace/cgroup/NSpid proof, same-UID `/proc` snapshot, or a later
  numeric PID: `UNAVAILABLE`/`DRAIN_UNCERTAIN`.
- Ingress `SO_PEERPIDFD` offered as the backend handle: reject wrong subject.
- Missing or mismatched init namespace, cgroup, `NSpid`, owner ancestry, start identity,
  or held-handle linkage: `IDENTITY_CHANGED`/uncertain.
- Handle acquired after observer close, backend still live after terminal watermark,
  or pidfd poll with ambiguous lifetime: no proof and no restore permit.
- Nonterminal/missing/unknown Docker status, unpaired operation ID, or API-only 2xx:
  daemon finality refuses; backend proof cannot be repaired by another observer.
- Unknown/nonobserver census member or unclosed earlier migration, probe, failed client
  or daemon source, even when the final observer handle is dead: proof refuses.
- Observer omitted from the preadmitted set, observer admitted after seal, registry
  revision changed, repeated collect, run cancel/close, or cleanup uncertainty:
  stale/uncertain proof refuses and no successor phase is minted.

## 8. Remaining gates

Before any implementation claim, root must perform a separate read-only capability/source
check for an already authorized complete target-backend census and nonobserver causal
source, then prove namespace/cgroup/NSpid availability, backend-to-host identity and
privilege boundaries, the pinned initial handle-acquisition race, held-pidfd behavior,
daemon operation manifest/terminal semantics, and all-client causal drain. A green peer
credential/lifetime primitive, injected host-drain result, SQL backend marker, or
successful client exit is not native finality. Until those producer facts and the
positive/negative controls exist, gap C remains open and DEC203 advancement/restoration
must fail closed. This plan makes no runtime, kernel, Docker, database, or acceptance
claim; root owns implementation and release decisions.
