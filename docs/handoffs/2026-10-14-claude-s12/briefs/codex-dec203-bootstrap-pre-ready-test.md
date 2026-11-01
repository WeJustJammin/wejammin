# DEC203 pre-ready native adoption and closure — proposal

Planning only, source-author UNRUN, native gpt-6.1-sol/ultra. This document
releases no TEST, production source, lock acquisition or execution. Root must
select the bounded interface below and issue exact claims before authoring.

Root's reviewed runtime binding now fixes raw argv/UUID, owned root/fdchmod,
internal zero-runner, lifecycle and O-only diagnostics; see
`codex-dec203-bootstrap-pre-ready-runtime-binding.md`. No native gate is relaxed.
All paths are repository-relative in the S12 worktree. `NT/` means
`infra/database-upgrades/native-tracing/`; `HD/` means
`docs/handoffs/2026-10-14-claude-s12/`.

## Approach

Build the real fixed owner and lease addon, adopt the genuine four-lock handoff,
then irreversibly cancel and close BEFORE supervisor/workflow construction.
Use the same fixed outer CLI, C owner, coordinator and native adoption producer.
Do not call the full session factory with incomplete inputs or fabricate readiness.
The outer actual owner, not an inner return value, determines bootstrap closure.

The current contracts reserve consideration of this branch; they do not already
release its input selector or construction-only work-terminal transition. The
specific selections below are prerequisites, not interpretations silently applied
to the frozen factory. A closed slice is feasible with those selections; without
them only missing-API evidence is available, not a genuine positive.

## Scope

In: fixed construction, actual lease adoption, independent held-resource checks,
native cancel/FINISH and actual outer I/C/channel/stdio closure. No ordinary work.
Out: ReceivingSession.ready, OwnedSupervisor, Workflow, RunCapability, ClientPermit,
history/TranscriptCapability, LocalSettlement, PhaseDrainProof, forwarding, Docker,
SQL, setup/probes/reset/restoration/observers, finality and native080 acceptance.
No services, defaults, configuration, privilege, installs or signal authority change.

## Source basis and required selections

The following current documents were read fully; references use their current lines.

| Document under HD | Source fact |
| --- | --- |
| `briefs/codex-dec203-bootstrap-tcb-amendment.md:15–38,40–68` | Finite construction TCB only; outer-only global drain; separate pre-ready review allowed, not released. |
| `lane-codex-dec203-native-bootstrap-plan-2026-10-18.md:56–138,140–223,254–287` | Fixed owner, both lifetimes, recipe/fences, proposed nine paths and full TEST HOLD. |
| `lane-codex-dec203-native-bootstrap-interface-2026-10-18.md:13–105` | One fixed coordinator, exact descriptors, input settlement and real compiler-child FD control. |
| Same:107–203,205–278 | Native CANCEL/HUP latch, closed frames, actual adoption, ready barrier and retained uncertainty. |
| `lane-codex-dec203-supervisor-authority-contract-2026-10-18.md:39–117,248–281` | Full factory needs every genuine input; private zero-argument lease issuer; capabilities cannot be serialized. |
| `lane-codex-dec203-owned-supervisor-plan-2026-10-18.md:44–117,226–265` | Ordinary-client/history/local-drain semantics stay separate and unchanged. |

Root would explicitly select THREE narrow additions before TEST release:

1. A closed construction-only CLI input distinct from the existing valid plan.
2. A private constructor collocated with issuer/build/native ownership in lease;
   bootstrap only calls the guarded zeroarg void runner, never the full factory.
3. Native ADOPTED→cancelled work-terminal→FINISH before RUN_ACK, with no ordinary
   registry ever constructed; SETTLED reports actual construction termination only.

Do not reinterpret an empty or invalid workflow plan as this branch. Existing full
plan validation-before-allocation and factory options `{plan,signal}` stay intact.
No new frame kind, ACK, reason, error token or workflow success state is proposed.

## Closed private interface and entry route

Keep `NT/receiving-native-launch.mjs` the actual outer process entry, using the
profile's fixed Node/argv. Tests import it inside each case before allocation;
import has no side effects. They then launch that exact entry as an actual owned
child, not an arbitrary test program impersonating its parent image/argv.

The proposed construction input is exactly these UTF-8 bytes, then stdin EOF:

```text
DEC203_PRE_READY_CLOSE_V1
```

This is one finite purpose, not a plan or arbitrary command language. The fixed
launcher alone emits that same literal on its owned coordinator stdin. Extra bytes,
missing EOF or another construction token refuse; no caller script/source/profile,
FD/PID list, environment, callback, injected issuer or build receipt is accepted.
The ordinary full-plan branch remains HELD. The selector grants no native authority:
direct coordinator invocation with identical bytes still lacks a genuine handoff.
O writes/ends that owned stdin only after START/fork reservation, independently of
event reads; C never parses it and closes its unused reader after fork. Actual
input completion/errors remain in O's closure record, not a successful write guess.

Private, unexported helpers in the already proposed modules:

```ts
// receiving-native-launch.mjs, called only by the fixed validated CLI branch:
runPreReadyBootstrapClosure(): Promise<void>;
// receiving-lease.mjs: lexical constructor/issuer/record/native owner:
createPreReadyLeaseConstruction(): PreReadyConstruction;
// Internal zeroarg void bridges, never a returned owner/handle:
runPreReadyLeaseConstruction(): Promise<void>; // lease
runPreReadyCoordinator(): Promise<void>; // guarded bootstrap caller
// Frozen internal handle; never returned over IPC or to the TEST:
type PreReadyConstruction = Readonly<{
  adopted: Promise<void>;
  settle(): Promise<{state:'work-terminal'|'uncertain',failure:SupervisorError|null}>;
  close(): Promise<void>;
}>;
```

Both reserve their actual record synchronously before the first await. The inner
handle exists before build allocation, so failure retains settle/close ownership.
It has NO ready property, supervisor/workflow/view/permit/proof or public adoption
method. `adopted` resolves only from the genuine native ADOPTION_ACK path after
live rechecks; it cannot be supplied or resolved by a caller callback.
The existing private `adoptReceivingLease()` still takes zero arguments and keeps
its genuine capability/records internal. There is no public raw fd/PID adopter.
The native construction slot and ACKs are spent once across views/reimport/failure;
fresh input, runId, signal or a second constructor cannot refund this bootstrap.

The fixed CLI does not expose a live control handle to the TEST. After actual
adoption it performs the fixed independent observations below, immediately sends
the existing CANCEL(close), and follows settlement. Bounded terminal diagnostics
may identify this case and existing failure tokens, but are never reusable proof.
No opaque capability, native descriptor or partly ready object crosses IPC.

## Fixed profile and source closure

Source-selection fixes nine base paths plus twenty-three private helpers (32 total).
Every implementation must remain naturally≤300 lines; any further required
cohesive extraction needs a new exact claim before authoring, not compressed C.

| Exact NT path | Responsibility in this slice |
| --- | --- |
| `receiving-bootstrap-profile.mjs` | Closed Node/GCC/header/source/output profile and finite construction input. |
| `receiving-bootstrap-profile.h` | Fixed C lock literals, Node/entry and endpoint topology; attested support source. |
| `receiving-bootstrap-build.mjs` | Fixed owner/addon recipes, actual owned compiler records and uncertainty. |
| `receiving-native-launch.mjs` | Actual O entry, one BootRecord, independent observations and outer closure. |
| `receiving-lease-owner.c` | Actual C owner, four FLOCKs, pidfds, one fork, named protocol and waits. |
| `receiving-lease.c` | Real fixed-descriptor adoption, sole native reader/latch and FINISH join. |
| `receiving-lease.mjs` | Lexical constructor/issuer/LeaseBuildRecord/native owner; zeroarg void runner only. |
| `receiving-native-bootstrap.mjs` | Guarded zeroarg void caller, no handle; full factory stays HELD. |
| `receiving-native-coordinator.mjs` | Fixed I entry, strict input branch, native construction and natural exit. |

Only the fixed owner and lease addon are built here. Do not build a pretend
owned-supervisor artifact or stub ingress/policy/run inputs. Pin every actual new
source/support byte at its later freeze; source hashes do not yet exist here.
The approved observation is `HD/briefs/codex-dec203-node221-bootstrap-source-inventory.md`
and `/tmp/wejammin-native-s12-20261017.Adf0uP/dec203-bootstrap-host-profile-observation.json`,
the latter SHA256 `ffaf40d313f24dab8129f8433c38e7beb8b0c2d2be44d3571de0e6e5d4032c52`.

| Fixed input | Observed SHA256; approved path/profile proposal |
| --- | --- |
| Node v22.23.1 | `93956de2e59480474a7b46571da1651180b1a050cdf32641ebec4ce6e478e068`; `/home/rob/.cache/chrome-gate-runtime/node-v22.23.1-linux-x64/bin/node`, uid1000,0100755. |
| GCC | `4063c2a4919a7531523a61397052b6582386df1cbe0e558c3ffb045c0717d3bc`; `/usr/bin/gcc`, uid0,0100755. |
| `js_native_api.h` | `82d3708ce120f8000ec34d72e1aa70b0d7d8a43027986293681374a71b2cb840`. |
| `js_native_api_types.h` | `c12406a8c0036aefdb66b98065fc88e2e7a053c1f274deef33af6c26c099b933`. |
| `node_api.h` | `2d4560831e525b47b060ec8a0864ab73993df9e20215ce9f0fe7b24cd31af32a`. |
| `node_api_types.h` | `a25356630d3058f0a0c8937d9f297e9471e037fda58c2696d8a505c2bd99cb00`. |

All four headers are under `/usr/include/node`, uid0,0100644. Reobserve fresh
held/named device/inode/size/mode/owner/hash around each build/load/adoption. The
old receipt is not BuildCapability, freshness proof or a reusable inode assertion.
Do not resolve Node/GCC/header replacements through PATH, environment or node-gyp.

Fixed owner flags: `-std=c11 -O2 -Wall -Wextra -Werror -D_GNU_SOURCE`.
Fixed addon flags: `-std=c11 -O2 -fPIC -shared -pthread -DNAPI_VERSION=8
-Wall -Wextra -Werror -I /usr/include/node`. Source/output operands are private
exact literals from the profile: owner C→owned `owner/receiving-lease-owner`;
lease C→owned `lease/receiving-lease.node`; no caller recipe. Attest profile.h too.
Use exclusive outputs and canonical current-UID0700 run/subdirectories. Compiler
environment is exactly PATH=/usr/bin:/bin,LANG=C,LC_ALL=C,TZ=UTC,TMPDIR=owned build
directory, shell=false, ignored stdin, separately drained stdout/stderr.
Keep the existing actual new-session/start/UID fence, monotonic30s build budget,
one still-fenced compiler-only SIGKILL and5s settlement/session-absence requirement.
Never extend that signal permission to owner/coordinator or unrelated processes.

## Genuine descriptor, adoption and closure path

1. O validates the fixed input/profile, reserves its one record, builds only the
   owner and retains actual compiler/output records before launching exact C once.
   HELLO→INIT requires independently checked actual C PID/start/image/argv/parent.
2. C moves original child3-read/4-write outer endpoints to CLOEXEC scratch, maps
   outer8-read/9-write, then obtains the four named locks directly and in order:
   fd3 CI EX;4 quiet SH;5 ALT EX;6 reset EX. No lock replacement/chmod/chown/unlink.
   Canonical regular nonsymlink0100644/uid1000/gid1000 is the observed profile;
   capture fresh held/named identities, actual fdinfo FLOCK and /proc/locks rows.
3. C opens actual self pidfd7 and genuine getppid-derived O pidfd10 BEFORE fork,
   with original ancestry/start/image/live checks. LEASE_READY→START consumes the
   single fork slot. Child I inherits SAME lock descriptions at SAME3–6 and7/10.
4. Separate inner pipes: C retains12-read/13-write; I has8-read/9-write. Close all
   outer/unused/scratch aliases in I and child-only ends in C. One native reader
   owns I-fd8; JS never competes. Both O/C event and command directions stay distinct.
5. C clears CLOEXEC only for designated3–10 for first fixed Node exec, including
   dup2's same-fd case. Node22 marks first16 CLOEXEC. Before ANY inner compile,
   I synchronously checks actual self-fdinfo3–10, parsing full octal O_CLOEXEC
   0o2000000, availability and fixed entry/profile; recheck across awaits.
6. I builds/loads the real lease addon. Native F_GETFD requires FD_CLOEXEC1 and
   actual held/named FLOCK, parent/current same-fd, ancestry and pidfd facts.
   Native HELLO→ADOPT→ADOPTION_ACK is one-shot; pending CANCEL/HUP is consumed
   before ACK. O's relayed ADOPTION_ACK alone is not a lease or positive oracle.
7. While I remains ADOPTED, O independently brackets actual C/I identities and
   reads their complete FD inventories, named locks, /proc/locks and fdinfo facts
   from its owned launch record. Require the exact3–10/12–13 topology, both lifetime
   handles and no extra alias of any protected resource at another FD number.
   These direct observations are mandatory checks, not callback-supplied DTOs.
8. O sends CANCEL(close), latching its own refusal first. C latches and relays;
   native I-fd8 reader latches before CANCEL_ACK/TSFN. Both7 and10 are synchronously
   polled with the native cancel state at every admission/ACK boundary. No JS queue
   may authorize progress; RUN_READY/RUN_ACK are illegal in this finite branch.
9. After actual construction compiler settlement, native I emits the selected
   SETTLED(work-terminal,CANCELLED), preserving its reader/aliases until FINISH.
   This records no ordinary registry was created, not a no-launch transcript or
   fabricated all-client proof. C FINISH then joins the native reader and closes
   I-owned aliases once; I exits naturally; C obtains real I wait status and EOF.
10. C closes its aliases only after proved inner closure and emits existing TERMINAL.
    O additionally awaits actual C close, all its stdio/control/event EOF/close/error
    settlements and its own input completion. Only this actual outer record may
    report GLOBAL bootstrap drained. CANCELLED remains cancellation, not work success.

Each frame has a1–4096B UTF-8 JSON envelope plus4-byte BE length (max4100B wire), and contiguous
per-direction positive-u64 seq. Reserve every ACK/write/fork slot before awaits;
failed or partial writes never refund it. Do not add a TEST_SEND/inspection command.
The existing full source/inventory and shell runner are not invoked under these locks.

## Real compiler-child leak discriminator

This cannot be replaced by parent CLOEXEC, source or spawn-options assertions.
O independently observes I's actual compiler child during its live fixed GCC image,
using original I ancestry and the actual child record, not caller PID metadata.
Before native I-HELLO exists, O derives I from the actual held C's direct-children
file, requiring exactly one fixed Node/coordinator image/argv/start/UID/parent.
Then it follows only that held I's direct compiler child; no unrelated process scan
or HELLO-declared PID fills a missed identity. Recheck that complete owned ancestry.
Bracket /proc PID/start/UID/parent/session/group/exe identity before and after the
COMPLETE fd inventory. Compare object identities across ALL child FD numbers with
the retained lock, channel and pidfd objects, not merely absence at numbers3–10.
No inherited lock description, either lifetime handle or bootstrap pipe may appear.
Unknown/malformed/inaccessible or raced facts refuse; preserve bounded diagnostics.

Use immediate synchronous observation plus bounded live-record retries, never a
sleep-based no-leak inference. If GCC finishes before a qualifying observation,
the mandatory witness is MISSED/OPEN: fail this positive, do not skip or assume
absence. No SIGSTOP, wrapper compiler, stdin/FIFO recipe, injected scheduler or
compiler command variant is authorized to manufacture a longer observation window.
A deterministic held-compiler route, if needed, requires its own precise selection.
This bounded raw-FD observation is not continuous construction/client history.

## Exact prospective TEST claim and cases

The exact source-only claim fixes the main native-bootstrap-pre-ready driver and
nine dec203-bootstrap-pre-ready helpers: harness/observe/diagnostics/artifacts/
assertions/processes/values/inventory-fixtures/inventory-controls (all.mjs in tests/native/helpers). The observer reads
only actual owned process/FD/lock facts; it does not issue capabilities or accept
injected observations. No C test artifact or alternate coordinator is needed for
these safe positives. Later source claims should also append the existing
`infra/database-upgrades/native-tracing/README.md`; no such edit occurs here.

| Case | Reached witness and limitation |
| --- | --- |
| PR01 fixed construction | Actual fixed builds, independent bytes/identities, real compiler waits/streams/session absence; import/missing API is not this proof. |
| PR02 inherited lease | Actual one C owner, four correct FLOCK modes, same parent/current3–6, both pidfds, separate channels and native ADOPTION_ACK. |
| PR03 compiler FD boundary | Independent I-fdinfo and live GCC complete no-alias inventory; actual native F_GETFD is producer-mediated through genuine ADOPTION_ACK, not directly observed. Missing observation cannot pass. |
| PR04 pre-ready close | Actual outer CANCEL_ACK/TERMINAL plus independent I/C/stream closure; actual inner SETTLED→FINISH is producer-mediated by the verified native gates, not directly observed. No RUN_READY/RUN_ACK/ordinary work/ready object. |

Use a fresh actual outer invocation per case. Root alone coordinates exclusive
use of all four existing global lock paths; do not wrap this owner in the staged
runner's pre-held locks or run against an active staging/reset lane. No new lock paths.
Tests use existing actual toolchain/profile, fixed producers and cooperative close.
No duplicate/fault/owner-death/protocol-corruption TEST is released by these positives.
Those need their own fixed compiled fixture and exact fence/settlement claim.

## Settlement, RED prerequisites and limits

At cancel/close start one nonrenewing monotonic5s global settlement budget. Complete
native join, aliases, actual I/C waits and every stream are required. An unproved
boundary reports DRAIN_UNCERTAIN, preserving original error, actual process/pipe/
compiler/fence/pidfd/lock/artifact records and evidence. No LOCK_UN, process.exit,
detach, generic kill or evidence deletion to make the test finish. Unknown/foreign
files stay untouched. Inner close never proves its own exit. First failure wins.

The original21 paths were absent at initial missing-API RED, before resource allocation.
Later helper claims do not turn that RED into native evidence. After genuine implementation,
only actually reached kernel/build/closure assertions are native evidence. Missing
support is UNAVAILABLE/refusal, never a supported positive or acceptance skip.
PR01–04 may be facets of one initial safe end-to-end control to avoid needless
global-lock acquisitions; distinct named assertions must retain their prerequisites.

Root must review any further additions, freeze exact future source/TEST claims,
review native safety, then execute actual controls. Full factory/RUN_ACK tests remain
HELD until every genuine artifact/ingress/policy/run input and all native gates exist.
No history, writer-image-at-send, daemon/backend finality, restoration, adapter080 or
phase gate is cleared by pre-ready closure. This proposal performs no runtime action.
