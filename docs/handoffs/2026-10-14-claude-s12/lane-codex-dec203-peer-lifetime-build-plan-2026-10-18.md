# DEC203 peer-lifetime fixed build plan

Status: source-only PLAN, author UNRUN; not a TEST or production release.
Author: inherited native gpt-6.1-sol/ultra. Worktree:
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Only this newly claimed document is written. Existing production, tests,
fixtures, reports, tracker and approved contracts remain unchanged.

## Approach

Build the separately selected lifetime capability from one fixed C source and
one fixed local support header. Reuse only proven generic artifact helpers;
copy the frozen compiler lifecycle into a separate fixed-source module with an
exact inverse. Keep capability, compiler and real-kernel evidence distinct.

## Scope

In: feasible private module boundaries, exact include/metadata closure, reuse
proofs, proposed exact TEST paths, and root-owned staged TDD gates.
Out: proxy/listener integration, process-history producer, Docker/reset work,
new privilege/package/kernel policy, public API changes, or implementation.
The accepted297-line lifetime plan SHA
`22ae73078eb919f5d30eb662b9ea6091758e11d3c49ca4d31e337e2ce2f582ce`
governs capability behavior; this document supplies its build boundary only.

## Steps

1. Claim the exact TEST paths below; freeze literal interface/metadata/error
   oracles and actual fixture prerequisites before any production authoring.
2. Run missing-builder RED through imports inside cases, before resource
   allocation; distinguish missing API from reached native behavior.
3. Review the real fixture compiler, owned peers, descriptor accounting and
   cleanup. Root runs the feature probe and records supported/unavailable honestly.
4. Claim the six production paths below only after the TEST readback and RED.
5. Implement the fixed builder/include closure and capability without editing
   any of the four frozen peer-credential production files.
6. Prove compiler/guard/output-copy inverses; independently review all genuinely
   new C ownership, tag, poll, fdinfo and wrapper-revocation logic.
7. Validate under root authority: syntax-only checks without module execution,
   normal300-line gates, lint, original peer cohort, then new real native cases.
8. Freeze exact source/runtime receipts and remaining gaps. A supported positive
   capability receipt is still not registry/history, forwarding or native080 proof.

## Proposed production paths and responsibilities

All six paths are NEW under `infra/database-upgrades/native-tracing/`.
Normal-format sizes below are estimates, not measured implementation results.

| Filename | Closed responsibility | Estimated lines |
| --- | --- | ---: |
| `peer-lifetime.mjs` | `buildPeerLifetimeReader(options)`; pinned Socket guard; private tracked handles; open/read attestation and reader revocation. | 230 |
| `peer-lifetime-build.mjs` | Exact options/runtime gate; fixed input manifest; prepare/compile/load; six-key metadata; uncertain-build retention. | 240 |
| `peer-lifetime-compiler.mjs` | `compileLifetime` with fixed lifetime C path and unchanged30s/5s compiler lifetime/drain algorithm. | 250 |
| `peer-lifetime-output.mjs` | Fixed `peer-lifetime.node` reservation only; no caller basename/output override. | 60 |
| `peer-lifetime.c` | Node-API8 exports, numeric arguments, private type tag, wrap/read/close callbacks, finalizer and result construction. | 250 |
| `peer-lifetime-state.h` | Guarded static native state, socket acquisition, poll/fdinfo classification and one-shot descriptor release. No Node-API entry point. | 250 |

The JS DAG is wrapper → build → compiler/output; all may import only the
needed generic `peer-artifacts.mjs` exports and Node built-ins. No import of the
old credential builder/compiler, runner, tests or native adapter. C includes
its one fixed header; that header never includes another project-local file.
If normal formatting exceeds300, stop and request a precise new path: do not
minify, hide code in macros, or expand the existing four-file scope.

## Fixed compilation and complete input closure

Public builder options remain exactly three own string-valued data properties:
`compilerPath`, `includeDirectory`, `runDirectory`; reject Proxy/accessors,
unknown keys and source/addon/flags/include overrides as in the existing guard.
Paths must remain canonical, non-symlink and correctly owned; the run directory
starts empty/current-UID/mode0700. `peer-lifetime.node` is reserved O_EXCL,
O_NOFOLLOW, mode0600 before compilation. Never delete the caller's directory.

Resolve `SOURCE` and the support path relative to the new module URL, not cwd,
environment or caller data. The sole support filename is
`peer-lifetime-state.h`; compile the C with this literal quoted include.
The header has an include guard and only reviewed platform angle-includes;
no further quoted/macro/absolute project includes, include_next, forced include,
generated local source or inline binary input is permitted. The four fixed
Node headers are separate, sorted by basename:
`js_native_api.h`, `js_native_api_types.h`, `node_api.h`, `node_api_types.h`.

The compiler argv is the existing literal list, with only fixed SOURCE changed:

```text
-std=c11 -O2 -fPIC -shared -DNAPI_VERSION=8 -Wall -Wextra -Werror
-I <canonical includeDirectory> <fixed peer-lifetime.c>
-o <owned runDirectory/peer-lifetime.node>
```

No shell, caller flags, -include, extra -I/-L/-l, or environment inheritance.
Environment stays exactly PATH=/usr/bin:/bin, LANG=C, LC_ALL=C, TZ=UTC,
TMPDIR=the owned run directory. The existing compiler/toolchain, platform C
headers and runtime loader remain trusted OS inputs, not a hermetic-build claim.
Node-API stays8; no V8/libuv ABI or new package is introduced.

Before the first compile, capture source, the complete fixed local support
list, compiler and all four Node headers using the unchanged artifact reader.
Root source review verifies every conditional/direct local include against that
list. An owned-copy test copies that explicit closure, not directory globs or
discovered imports; it must compile without reaching the original source tree.
An extra local dependency requires a new claimed path and metadata/test cascade,
not an unchecked file or a source-parser claim of hermetic dependency discovery.

Capture/read input artifacts again after actual compiler drain, immediately
before/after loading, and before/after every open and handle read. Also retain
the run/header-directory identity checks. The private record array contains
C, support header, compiler, four Node headers and output; no caller record
can be substituted. Drift refuses even when the unchanged binary could run.
On post-native-open attestation failure, synchronously close the newly created
handle before propagating failure; it must not escape untracked.

Root approves this private supplement to distinguish public and native handles:
the public handle is a frozen object with exactly `read` and `close`. A private
WeakMap maps its actual facade receiver to the genuine tagged native handle.
Plain, foreign and Proxy receivers refuse; a copied method called on ANY
registered facade remains valid. Only the private native object receives native
method calls, whose Node-API8 tag is checked before unwrap. Neither object exposes
raw fds; the facade never exposes its native handle. Independently test both
receiver boundaries, rather than claiming a JS object has a native tag.

The WeakMap is local to one builder-module instance, never global. It registers
facades from every reader built by that same module instance. Each entry owns
the actual native handle, its owner-build identity and artifact records, and a
closed flag. A borrowed method attests that facade's actual owner build, never
the build that created the function; reader.close revokes only its own owned
set. Facades from separately imported/copied module instances remain foreign
and unregistered: no global discovery or registry sharing is permitted. The
genuine tagged native ABI receiver contract remains a separate boundary.

For nonrevoked public open/read, artifact checks bracket the native operation.
Close must revoke and attempt owned-fd cleanup despite source/artifact drift:
no identity check may prevent cleanup. Reader.close revokes all facades before
its first await, attempts all native closes, then artifact cleanup, retaining the
first error. Read-after-close checks the closed state before artifact access.
This is private facade integrity, not protection against arbitrary same-process
code. Accepted-Socket registry and continuous-history requirements are unchanged.

## Metadata, errors and cleanup

Lifetime metadata has exactly six deeply frozen keys:
`node`, `source`, `compiler`, `headers`, `supportSources`, `output`.
`node` remains exactly `{path, version:'v22.23.1', napi:8}`. Every artifact is
exactly `{path,sha256,device,inode,size,mode,uid}` with lossless decimal dev/ino.
`headers` contains the four sorted Node records; `supportSources` contains the
single sorted local-header record. An empty support list is not valid for this
selected split. Neither list contains generated output or substitutes for C.

Reuse unchanged generic `failure`, `artifact`, `assertArtifacts`, `directory`,
`assertDirectory`, `executable`, and `removeOwnedOutput`. Their paths/records are
privately constructed here. Do NOT call `reserveOutput`: it hardcodes the old
`peer-credentials.node` basename at `peer-artifacts.mjs:139–161`.
The new fixed reserver copies its identity/reservation algorithm only.

Keep exact existing build/load tokens: `DEC203_NATIVE_UNAVAILABLE`,
`DEC203_INVALID_BUILD`, `DEC203_COMPILER_FAILED`, `DEC203_IDENTITY_CHANGED`.
Preserve `.code === .message`, including current load-error normalization and
artifact-error precedence. Capability `DEC203_PIDFD_*` tokens remain those in
the accepted lifetime plan; do not remap build errors to socket/capability errors.

The compiler copy retains monotonic performance.now deadlines, detached owned
session/group, captured PID/start/UID/parent/session/group fence, single fenced
SIGKILL on timeout, all child/stream close waits and independent session absence.
Unproved5s settlement returns no reader, retains the actual pending compiler
record, and does not unlink output or claim cleanup. The build coordinator also
retains its frozen input/build records privately on that uncertain path.
Proved-drained failure removes only identity-matching owned output, preserving
the primary error and reporting cleanup failure. Foreign replacement stays.
Native handle partial-wrap ownership and no-EINTR-retry rules are not weakened.

## Copy proofs and frozen source pins

Root must verify these on future code, not accept the plan as their proof:

- The new compiler inverse changes only the SOURCE basename back to
  `peer-credentials.c` and `compileLifetime` back to `compilePeer`; full original
  bytes must reproduce SHA`bc4361112d4f2977ab21caa3876a93f5cb101cfd0de7c3941c016fff246551f4`.
- Copy runtime/options36–67 unchanged. Copy socket helpers105–182 and the
  Socket getter31–34 with only the invalid-socket token changed to
  `DEC203_PIDFD_INVALID_SOCKET`; inverse must recover exact old helper bytes.
- The reserver copies `identity`34–42 and reservation139–161; inverse changes
  only its private function name and `peer-lifetime.node` basename. Imports are
  separately inventoried, not an excuse to alter the old implementation.
- New C/state-header code is genuinely new logic. Review it fully; do not
  describe its allocation, receiver or lifetime changes as mechanical extraction.

Full source pins from this readback, with all four files left untouched:

| Frozen file | SHA256 |
| --- | --- |
| `peer-credentials.mjs` | `171031e458814f4e48b9e9d38e05c31aaf492834ac602c98e0b6d5d0c5f1ef21` |
| `peer-credentials.c` | `d328ec58d5443db33ad0fdf1cb87981e51e4b3b362dc02cc1177b835c01edc4c` |
| `peer-artifacts.mjs` | `38a022186e7555e02696022daa71fc7eed1de540243116fc4a14e9ae21b8b65f` |
| `peer-build.mjs` | `bc4361112d4f2977ab21caa3876a93f5cb101cfd0de7c3941c016fff246551f4` |

Block hashes use exact inclusive source lines joined by LF plus one final LF:
runtime/options36–67 `91a96b72bc88c4864d1e84ce668fa00127824501057fada83bd35e9c76bf8551`;
socket105–182 `6b826f61a30768dd9618ecb5662765e37538ab25e77b661dd2c4bd188ef06eb4`;
identity34–42 `afb25b4398bdc8dae95e46e9eea6985fcdcc3a03ab8d41151be6f824f5b3d558`;
reservation139–161 `8d0f5c976784307b223a2fb94aa88a4da5d90d8bef8e476c1269ddc703e0f7b8`.

## Proposed exact TEST and fixture paths

All below are NEW, proposed only; root must claim before TEST authoring.
Every helper, fixture and driver targets normal formatting below300 lines.

| Path under `tests/native/` | Responsibility |
| --- | --- |
| `phase-02-slice-11-peer-lifetime.mjs` | Serial node:test registration, case-local missing-builder RED and explicit classifications. |
| `helpers/dec203-lifetime-harness.mjs` | Fixed module/output/closed-copy manifest, owned paths and complete cleanup. Reuse only proven generic Fixture ownership methods. |
| `helpers/dec203-lifetime-build-cases.mjs` | Exact three options, six metadata keys, include closure/drift/load/output/cleanup cases. |
| `helpers/dec203-lifetime-capability-cases.mjs` | Real feature, open/read/close, exit, caller-fd preservation, receiver and independent fd-inventory cases. |
| `helpers/dec203-lifetime-peers.mjs` | Owned allowHalfOpen Unix server, IPC peer/exit barriers and terminal child/socket/stream collection. |
| `helpers/dec203-lifetime-values.mjs` | Attest/build/load the one fixed TEST C fixture, with expected exports; never manufacture a lifetime handle. |
| `helpers/dec203-lifetime-fixture-compiler.mjs` | Same bounded compiler algorithm, but fixed TEST C source; no source/flag option. Separate exact inverse. |
| `fixtures/dec203-lifetime-peer.mjs` | Real child connects, declares a wrong PID, then closes/exits only through its owned IPC protocol. |
| `fixtures/dec203-lifetime-probe.mjs` | Dedicated child for potentially unsafe foreign native receivers and repeated fd-leak accounting. No arbitrary PID/fd action API. |
| `fixtures/dec203-lifetime-values.c` | Foreign napi_wrap object and owned connected Unix-datagram pair only; no production tag or raw pidfd. |

Future report paths are
`docs/handoffs/2026-10-14-claude-s12/lane-codex-dec203-peer-lifetime-red-2026-10-18.md`
and `lane-codex-dec203-peer-lifetime-green-2026-10-18.md` in the same directory.
The existing Fixture's generic file/identity/removal methods are reusable
(`dec203-peer-harness.mjs:90–128,186–225,255–285`); its static open, factory build,
copySubject and residue method hardcode the old module/output and must NOT run
for lifetime tests. New overrides use the exact new fixed manifest/basename.
Do not change that harness or any old case to fit the new capability.

## Native cases and honest proof limits

First prove actual compiler/headers/runtime and fixture cleanup. Import the
subject inside each case before allocating resources; missing import/API is an
assertion failure, not collection abort, skipped case or successful unavailable.
Then exercise the actual getsockopt path on a real connected Unix stream.
An unsupported result is recorded as exact `DEC203_PIDFD_UNAVAILABLE`; it never
passes a test requiring a usable positive lifetime handle or clears capability
acceptance. Header constants and kernel-version labels are not the feature probe.

For support, compare literal observation fields to the independently spawned
child PID, not its declared PID; use two distinct peers. Require live reads,
latched peer-exit reads, explicit-close precedence, idempotent close, reader-wide
revocation, caller-original-fd survival and original-close non-retargeting.
For open-after-exit, explicitly assert the real accepted Socket remains
undestroyed with a genuine owned Pipe handle after actual child close/reap.
Use allowHalfOpen and actual barriers, never substitute a forged Socket or fd.
If that combination fails, report a fixture prerequisite failure, not kernel RED.

Use actual tagged handles for genuine/cross-handle method receivers; foreign
native wrappers run in the dedicated child to contain an unsafe unwrap mutant.
Separately prove facade receiver rejection, copied methods on any registered
facade, and cleanup after owned source/header drift without a cleanup-blocking
attestation guard. Never expose native state to make a facade test convenient.
Count independently identified `/proc/self/fd` identities in that child before
and after repeated successful/invalid opens and explicit closes, with all peer
resources held stable. Await terminal child/stream/socket cleanup; no sleeps as
proof, bare FD-number counts, arbitrary close, or whole-directory deletion.
Include actual wrong socket kinds/numeric refusals and source/header/output drift
on owned copied subjects only. Preserve foreign replacement bytes and identity.

Actual allocation/NAPI-failure injection and unusual poll/EINTR paths are not
proved by a normal leak loop. Do not mock syscalls/addon/compiler or add production
fault hooks to claim them. Root must select any additional discriminating fault
strategy separately; ownership/error paths still require full source review.

## Assumptions and source authority

Root brief `briefs/codex-dec203-isolated-native-tracing.md:98–100` selects this
private build/metadata contract; its16–22,58–65 preserve integration/compiler gates.
The lifetime plan115–187 governs polling and ownership;247–265 governs native TDD.
Relevant existing source anchors and complete hashes are recorded above.
The compiler and OS are trusted as before; no additional primary-source question
is needed to propose these boundaries. Actual target SO_PEERPIDFD support,
retained-Socket premise, normal file lengths and new fault discrimination remain
UNPROVEN. Root selects exact releases and runs every validation command.

The planning skill supplied the eight-step staged outline; surgical-development
guidance kept all existing production immutable and separated generic reuse from
fixed-name copies. Author performed source reads and text/hash/count analysis,
then this apply_patch write only: no parser, import, formatter, compiler, tests,
signals, socket/process orchestration, database, Docker, Git or network action.
