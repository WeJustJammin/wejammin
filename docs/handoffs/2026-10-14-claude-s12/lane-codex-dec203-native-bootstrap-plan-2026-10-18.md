# DEC203 native bootstrap — concrete A/B closure proposal

Design only, UNRUN; native gpt-6.1-sol/ultra. Pre-ready selection and runtime binding are in HD/briefs/codex-dec203-bootstrap-pre-ready-{selection,runtime-binding}.md; no executable is released.
All references are in `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
`NT/` abbreviates `infra/database-upgrades/native-tracing/`; `DU-` abbreviates
`infra/database-upgrades/delivery-receiving-upgrade-`; `HD/` abbreviates
`docs/handoffs/2026-10-14-claude-s12/`.

## Approach

Do not retrofit an asserted FD3–6 lease onto the current staged shell runner.
Propose a dedicated, fixed C lock-owner parent, built by a retained, fixed Node
prehistory driver before it launches the one coordinator. The coordinator then
builds/adopts its own native lease reader and supervisor under that genuine lease.
Root's selected finite TCB amendment applies; A/B remain unimplemented and are
not cleared by a diagram, matching DTO or compiler exit receipt.
The companion `lane-codex-dec203-native-bootstrap-interface-2026-10-18.md` fixes
the selected channels, complete frame/state contract and native cancellation gate;
it supersedes the initial3ec23b…3b7d draft's incomplete topology/ACK descriptions.

## Scope

In: actual lock acquisition/handoff, original-owner lifetime, fixed build recipe,
one-shot bootstrap barriers and the first genuine native positive TEST slice.
Out: supervisor syscall/history implementation, socket-writer authority, Docker
forwarding, finality producer C, reset/native080, integration or phase acceptance.
No persistent/default service, install, privilege, kernel policy or new ALT target.

## Locked inputs and exact source inventory

HISTORICAL input observations, not current pins: authority baseline300LF, SHA256
`eaa97522b3aec31093d6be3e9571effa41cad0dc42585bcfc58f1c6645ffe9b6`,
and historical supervisor-plan baseline300LF, SHA256
`8fcb880538f3bbcd917bd6f2aa8bdb26674c66ac33efd9e19176d3f6d6e7e6ed`.
Historical root-brief baseline `HD/briefs/codex-dec203-isolated-native-tracing.md`
(116LF), SHA256 `ce77b2391774e60d5d0eb5175424e4c0a236e881c883048cde4dd859dcf3f9d5`.

| Actual source | Supported fact and boundary |
| --- | --- |
| `HD/lanes/lane-db-alt-staged.sh:47–52` | Bash opens CI6, quiet7, ALT9; separate external `flock` calls acquire their locks. No FD3–6 issuer exists here. |
| Same:90 | Reset lock is a separate command around only Supabase reset, not a fourth retained shell descriptor. |
| Same:17–20,39–41,64–70 | Documents lock order, fixed ALT/toolchain, EXIT link restoration and signal exits; it is not the proposed native launcher. |
| Same:93–99 | Later reads container password and starts pg_prove. Do not call/reuse this runner as bootstrap or copy its environment/secret path. |
| `DU-target.mjs:17–56` | Exact approved ALT descriptor and four path/mode order. No caller-selected lock paths. |
| `DU-local-child.mjs:20–96` | Checks ancestor owner, same numeric FD in owner/current process, named inode and actual FLOCK rows. It does not issue native ownership. |
| Same:78–92 | Requires `FLOCK ADVISORY READ|WRITE`, positive row PID equal to ownerPid, and matching `/proc/locks` payload. This is not `fcntl` F_OFD/OFDLCK. |
| `DU-local-target.mjs:42–87,169–181` | Dependencies currently accept a lease DTO; guards consume proveLease before config/target probes. No native adopter exists. |
| `NT/peer-build.mjs:14–67,116–161,164–249` | Existing actual compiler fence, private session/group, fixed environment, monotonic30s/5s settlement and uncertainty retention. Not continuous fork/exec history. |
| `NT/peer-artifacts.mjs:48–90,93–136,139–181` | Held/named artifact/hash checks, private directory and owned-output cleanup; output basename is peer-specific, not a supervisor builder. |

The shell source proves neither that its external flock calls leave one live
row-owning PID nor that their transient acquiring PIDs equal Bash. No runtime
observation was made here. Do not guess util-linux internal FD allocation or
reinterpret same-inode/same-mode observations as a kcmp/OFD-equivalence result.

## A: fixed lock-owner launcher and native adoption

The current script cannot provide the authority contract102–107 handoff as-is.
Use a NEW dedicated C parent rather than remapping arbitrary live Node FDs3–6,
chaining unverified flock commands, or adopting an ownerPid/fd metadata list.
The reviewed fixed entry runs no command selected by the caller.

| C-owner FD | Resource and acquisition |
| --- | --- |
|3|`/tmp/wejammin-supabase-ci.lock`, flock LOCK_EX|
|4|`/tmp/wejammin-quiet.lock`, flock LOCK_SH|
|5|`/tmp/wejammin-altdb.lock`, flock LOCK_EX|
|6|`/tmp/wejammin-reset.lock`, flock LOCK_EX|
|7|Actual original C-owner self pidfd, opened before fork; read/poll only|
|8/9|C: outer-command read/event write; child: DIFFERENT inner-command read/event write|
|10|Actual outer-driver pidfd, opened by C before fork from genuine getppid|
|12/13|C-parent-only inner-event read/inner-command write; not inherited by Node|

All four acquisitions are direct `flock` syscalls by the same retained C owner,
in that order, before coordinator fork/release. They retain flock's shared
open-file-description semantics; do not substitute fcntl OFD-lock types.
Use O_NOFOLLOW regular-file opens without truncation, full held/named identity
checks and nonblocking flock attempts under monotonic bounds. Proposed waits
preserve the existing7200s first-three/900s reset limits; contention is no success.
Root lock-path observation SHA2620ea610eb1baa4aa4a365067ad6d041fb9c862ba971142e88c71288244c4ce
records canonical regular nonsymlink0100644/uid1000/gid1000 for all four. Use that
mode/owner proposal, not ephemeral observed dev/inodes across runs. Actual held/
named identities must match at acquisition/rechecks. No chmod/chown/unlink or0700.

O supplies distinct command/event pipes as original C-child3-read/4-write. C moves
them to CLOEXEC scratch, then outer8-read/9-write before mapping its locks3–6.
C creates separate inner pipes, retaining12-read/13-write; its forked child maps
only the child ends to inner8-read/9-write. Close all unused/outer child endpoints
and scratch aliases; no shared reader or alias may hide EOF. Never remap arbitrary
live Node/libuv descriptors. The dedicated C parent retains3–6;
its single forked coordinator inherits the SAME descriptions at SAME numbers.
The parent does not exec away or release locks while that coordinator is live.

Before fork the owner opens `pidfd_open(getpid(),0)` for itself and retains a
copy while passing the actual handle at7. This is original lock-owner lifetime,
not SO_PEERPIDFD peer attribution or a post-hoc claimed-peer PID fallback.
Missing syscall/support refuses. No arbitrary pidfd_open/kill/getfd API is exposed.
Before fork C also opens10 for its genuine getppid, bracketing actual driver image,
start/ancestry/UID and pre/post live checks. This separate lifetime is mandatory.
The native adopter has no owner/FD/path arguments: fixed3–10 only, actual getppid,
actual parent image/argv/start identity, and the one-shot native launch transcript.
It verifies fd7's actual pidfd facts against that parent and checks its readiness
before and after adoption; a dead/reparented/replaced owner cannot mint a lease.
This additional syscall/FD interface needs explicit review and actual native tests.

The adopter observes both parent/current fd3–6, each fixed named file, fdinfo
FLOCK row and `/proc/locks`, retaining exact native records. Genuine positives
must demonstrate the existing same-fd/one-live-owner predicates, not relax them.
Inode equality alone does not substitute for the held FLOCK fdinfo requirement.
Keep lossless dev/inode internally; if a later legacy numeric DTO cannot represent
them exactly, refuse rather than round. No DTO creates a LeaseCapability.

C explicitly clears3–10 CLOEXEC for the FIRST fixed Node exec, including dup2's
same-fd case. Pinned Node startup marks its first16 CLOEXEC BEFORE inner compile;
the coordinator must synchronously require self-fdinfo flags before ANY compile,
and native adoption later requires actual F_GETFD/identity checks. Source support:
new Node22 bootstrap inventory SHA3b33dbcf87fd15d9f23e39883e0f0a9d889e601eb40c883df7bd27a263e088b1.
A real compiler-child FD-absence control remains mandatory; source/spawn options
are not proof. Never LOCK_UN a shared description; close only owned aliases.

Every native ordinary release synchronously polls BOTH7 and10 plus native
cancellation state, then rechecks live lease/artifact/phase prerequisites. The
sole native inner-channel reader parses CANCEL/HUP and latches refusal before
TSFN notification; a JS queue/callback is never authority. C likewise watches
actual driver10 and outer HUP. A live C owner cannot compensate for a dead driver.
Duplicated locks preserve exclusion, not authority. Exact closure/retention and
inner work-terminal|uncertain settlement and outer-only GLOBAL TCB drain are in the
companion. Compiler-only SIGKILL never authorizes C-owner/coordinator escalation.

The C owner forks exactly once. Its one-shot handoff is consumed before release;
reimport/new runId/new factory cannot request another coordinator or reuse ACKs.
Normal completion requires actual coordinator wait status and all bootstrap pipe
settlement before the parent closes its aliases. Child failure stays failure.
On owner loss, existing coordinator-owned cancellation/waits may settle; no new
ordinary client, observer, baseline/reset or replacement owner is admitted.
Do not run the old staged runner inside this lease: its independent reset flock
could wait on the already-held reset lock. Later integration uses fixed native
ports/direct approved CLI invocations, under a separate exact callsite claim.

## B: explicit compiler prehistory, not self-attested tracing

Authority272–275 and supervisor88–92 explicitly leave this gate open. Choose a
reviewed fixed bootstrap-build route, not a caller-supplied prebuilt binary.
It has TWO construction stages, with no Docker/SQL/reset commands in either:

1. A fixed Node prehistory driver reserves one BootRecord before any await,
   builds the fixed C lease owner, retains actual compiler/output/stream records,
   and launches only that exact output after closed-build and image checks.
2. The coordinator reserves its entry before reading plan; its session.ready owns
   addon build→native adoption→supervisor build after validated plan. Raw inherited
   handles never grant ready, RunCapability or client permission.

The outer driver remains alive as the actual build owner. Parent C sends HELLO
before fork and waits. The driver independently checks actual owned child
PID/start/image/argv and held output identity/hash, then sends exact INIT.
Only after LEASE_READY and exact START may C fork its one coordinator.
The private C/Node bootstrap channels must authenticate that same owned launch;
HELLO, a copied build receipt or the C program's own hash claim is insufficient.
The inner issuer does not deserialize an outer BuildCapability. Outer prehistory
is a separate, explicitly admitted trust boundary with retained actual records;
the inner supervisor BuildCapability is minted only from its own actual build.
This multi-process handoff needs its own reviewed protocol/native positive test
before either stage can satisfy ready; no current source implements it.
The outer entry is a CLI launcher, not an IPC exporter of supervisor capabilities.
The existing factory/workflow run inside its one coordinator; outer exit is no proof.

The companion specifies every frame/direction/state, including actual ADOPT,
ADOPTION_ACK, RUN_READY and RUN_ACK. Reserve fork/ACK slots before awaits/writes.
Ready requires genuine adoption, actual supervisor build, all existing same-
bootstrap inputs and native RUN_ACK followed by live native rechecks. No unnamed
ACK, agreeing status frame or partly ready object suffices. The later supervisor
history protocol and daemon/backend proofs remain separate unsatisfied gates.

Pin the complete recipe before TEST release: source/support closure, canonical
existing compiler, Node/headers, flags, cwd, environment and output names.
Use root host profile observation SHA256
`ffaf40d313f24dab8129f8433c38e7beb8b0c2d2be44d3571de0e6e5d4032c52`:
Node v22.23.1 canonical chrome-cache path, compiler `/usr/bin/gcc`, headers from
`/usr/include/node` with its four exact records, as actually root-used for native49.
The receipt is a profile proposal, never BuildCapability or freshness proof.
Do not use the earlier node-gyp alternative or discover replacements via env/PATH.

Proposed fixed commands, with absolute profile paths and exact owned outputs:

```text
gcc -std=c11 -O2 -Wall -Wextra -Werror -D_GNU_SOURCE <fixed lease-owner.c> -o <owned owner>
gcc -std=c11 -O2 -fPIC -shared -pthread -DNAPI_VERSION=8 -Wall -Wextra -Werror
    -I <fixed Node include> <fixed lease.c/support closure> -o <owned lease.node>
gcc -std=c11 -O2 -Wall -Wextra -Werror -D_GNU_SOURCE <fixed owned-supervisor.c> -o <owned supervisor>
node -- <fixed coordinator entry> <private bootstrap UUID>
```

These are recipe templates, not permission for caller argv/source/output overrides.
Supervisor support files/flags must be completely specified by its later C claim.
Fix the owner's Node/entry/lock literals in reviewed receiving-bootstrap-profile.h,
attested as support source; owner execve has no caller program/descriptor operands.
Only sealed plan bytes pass on coordinator stdin, not a command or build receipt.
Use fresh canonical currentUID0700 run/subdirectories and exclusive owned output
names; hold/verify full artifact identities and bytes across build/load/launch.
Parent coordinator launch has only the fixed entry/descriptor protocol and sealed
plan input; a caller script, executable, stdin writer or environment is not allowed.

Compilation mirrors existing peer-build127–161: shell=false, detached owned
session, cwd=owned build directory, stdin ignored, separate stdout/stderr pipes;
environment exactly PATH=/usr/bin:/bin, LANG=C, LC_ALL=C, TZ=UTC, TMPDIR=owned run.
No inherited NODE_OPTIONS/LD_PRELOAD/CPATH/include variables or Docker selectors.
The coordinator's trusted bootstrap environment is likewise closed; admitted
Docker clients get only the later sealed ingress environment, never upstream fallback.

Preserve peer-build14–67/116–124/164–249 fencing: actual child PID/start/UID/parent
and new session/group,30s monotonic deadline, one fenced owned-group SIGKILL only
while unreaped identity still matches,5s bounded settlement, actual close and both
streams plus independently observed owned-session absence. A missing fence never
authorizes a numeric/group signal. Uncertain drain retains actual child/artifacts,
returns no capability and cannot advance into C launch, adoption or ready.
Record only bounded error tokens, exit/signal and stream counts/hashes, not raw
environment, plans, Docker payloads, secret settings or arbitrary compiler output.

Do not call compilePeer for a different source: it hardcodes peer-credentials.c
at10/127–142. A newly reviewed fixed builder must implement this constrained
pattern without arbitrary source/executable parameters or modifying frozen peers.
Cleanup checks exact owned identities, never recursively deletes compiler scratch
or foreign residue. Loaded native images must not be truncated/re-written.

## Selected TCB amendment and retained release HOLD

1. Authority39–117 now selects the outer CLI/inner coordinator route, fixed3–10
   handoff, original-owner AND driver lifetime, sole native reader/latch and all
   one-shot companion barriers. Options remain exactly plan/signal; there is no
   caller FD/owner/artifact selector. No existing shell invocation is grandfathered.
2. Authority96–110/272–275 and supervisor88–92 now explicitly admit only the finite
   fixed compiler/launcher prehistory above, under its separate retained build
   registry. It is NOT a continuous-history transcript, no-launch transcript,
   ClientPermit, PhaseDrainProof or successful all-client evidence. Its uncertainty
   blocks all later authority. This selected construction TCB grants no client proof.
3. Root brief19/25 keeps EVERY Docker/workflow client under genuine prelaunch admission
   and continuous history. Only finite compiler/lease-owner/coordinator construction
   is selected trusted prehistory; no Docker/SQL/setup/probe/migration/reset/restore/
   observer work occurs there. Inner close/settle never proves its own process exit;
   only the outer actual record establishes GLOBAL TCB drained after full closure.

Refusals retain the authority contract's exact code/message tokens: REFUSED for
foreign handoff/shape/replay, IDENTITY_CHANGED for observed drift, UNAVAILABLE
for missing native support, PROTOCOL/HISTORY_GAP for transport loss, CANCELLED
for the irreversible abort, TIMEOUT/FAILED for terminal work, DRAIN_UNCERTAIN
for unproved settlement (all prefixed DEC203_SUPERVISOR_). These mappings need
contract review; they add no success state or public API. Primary error wins;
cleanup diagnostics remain secondary, bounded and non-secret.

No change is proposed to active-client syscall/FD escape closure, peer/writer
linkage, phase sealing, exact migration bytes, independent daemon/backend finality
or original-error/baseline rules. Those remain separate unsatisfied gates.

## HELD TEST inventory — no bootstrap/full RUN_ACK release

Source-selection fixes32 NT paths and18/14 ownership; profile.h freezes before C.
No production authoring/runtime release follows. Lease owns lexical constructor/
issuer/LeaseBuildRecord/native owner; bootstrap only calls guarded zeroarg void
runner. Full factory stays HELD; no caller record/handle/callback route.
Keep each natural module≤300 lines; request cohesive helpers before overflow.
Use separate owned-supervisor build/protocol/C paths only under later release.

1. ALL bootstrap/full RUN_ACK TEST steps below are HELD until every genuine
   artifact/ingress/policy/run input/gate exists; no synthetic RUN_READY or stub.
2. Claim NEW `tests/native/phase-02-slice-11-native-bootstrap.mjs`,
   `helpers/dec203-bootstrap-harness.mjs`; use the fixed production coordinator.
   Import the subject inside each case BEFORE resources. Missing API is recorded
   only as missing API, never a functional lease/trace RED.
3. Run a real fixed-source build positive: independent held/named hashes and actual
   compiler close/streams/session absence precede C launch. No injected compiler,
   filesystem observations, PID facts, build receipt or successful producer DTO.
4. Run real four-lock handoff positive under root-coordinated exclusive use of the
   approved global lock paths: actual C-owner rows, same parent/current3–6, proper
   READ quiet/WRITE others, live owner pidfd and one-shot coordinator marker only
   AFTER INIT/START, genuine adoption and RUN_ACK. No stage/reset/DB/Docker work.
5. Initially release only genuine safe positives, including separate channels,
   both lifetime handles, self-fdinfo/F_GETFD and actual compiler-child FD absence.
   Pre-ready adoption-plus-close needs separate review; negative fixtures need FIXED
   TEST artifact and reviewed harness, not a caller-selected production entry,
   source, descriptor or test hook. Shared lock files must not be replaced/chmodded.
6. Keep withheld/replayed ACK, cancellation/partial spawn and owner-death negatives
   explicitly future-release until that fixture is concrete. Require actual owned
   barriers/settlement, original errors and no ordinary release, not sleeps or
   generic signals. Unsupported pidfd never counts as a passing positive control.
7. Root reviews and executes these native controls before issuing implementation
   GREEN, then separately reviews actual inner BuildCapability/ready integration.
   A positive marker alone cannot satisfy private-issuer workflow/proof tests.
8. Only later claim DU-local-child/target/prefix/session/host/runner integration,
   with exact inverse preservation and all-role native regressions. Do not alter
   old assertions or leave an injectable/legacy authority fallback.

## Assumptions and status

Trusted host/module boundary, not hostile sameUID JS isolation or reproducible/
hermetic compilation. Native PIDFD/FD inheritance/FLOCK/protocol facts above are
required future witnesses, not current kernel observations. No kcmp guarantee is
asserted. Source-only planning used concise planning/adversarial refusal analysis;
no saved graph exists and graph generation was barred by the no-runtime scope.
Only this report was written; this task changed no executable/test source.
Root owns amendment approval, exact claims, execution, independent review and release.
