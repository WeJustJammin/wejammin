# DEC203 native stream ingress — TEST source freeze

Author: native_dec194_race_red_20261016, native gpt-6.1-sol/ultra.
Status: AUTHOR UNRUN. No parser/import/formatter/lint/compiler/process/socket,
signal/test/Git/network/DB/Docker action was performed by this author.
Only native FS source/hash/count analysis and apply_patch were used.

## Authority and locked source

Root's TEST release is `briefs/codex-dec203-native-stream-test.md`:
initial166LF SHA34c805cb009c4474ac22929652cf8c8f856e6f1e05586bc5597f4f21f07af6c0;
current178LF SHA66e9e255b4f612980ac9596bc59285cecd1c016e25f18f4517bd905f94a8c4c8
includes root's separate NS21/22 release. Those two cases are NOT authored here.
Root separately approved the ninth source, writer-build, before its creation.

The locked main plan is `lane-codex-dec203-native-stream-ingress-plan-2026-10-18.md`,
300LF SHAbe51784ac09265a9154f40d651ab495b2b6ab1bb4271b915dce5b1724296c026.
Its sections2–7 specify the primitive, listener timing, ancillary ownership,
writer lifetime, revocation and fixed build. The companion
`lane-codex-dec203-native-stream-interface-2026-10-18.md`,217LF
SHA58ec14b389e8c1b3beb5a37775fd733d94811a5366b6352026ddfba031841125,
sections1–5 fixes native shapes, scheduler, per-operation attestation and errors.
Both full documents, the root tracing brief and writer-source inventory were read.

No production, existing83 native tests, binding721, old fixture, README, tracker or
other lane path was changed. Root reports its100 guarded source pins stable;
this author did not execute those suites or independently recreate that receipt.

## Exact raw source manifest

Paths below are relative to the S12 worktree. LF counts count physical newline
bytes, not a parser/formatter result. All files are NEW. Report's own hash belongs
in the final handoff rather than recursively inside this table.

| Path | LF | Bytes | SHA256 |
| --- | ---: | ---: | --- |
| tests/native/phase-02-slice-11-native-stream-ingress.mjs | 147 | 6779 | 61429a4f46de15925e619bba47b66c1e2bd40627641a65d6a34d696919b6ee7c |
| tests/native/helpers/dec203-stream-ingress-harness.mjs | 176 | 8438 | 5bf1a34f48e4bc5374ecfc3a005fa86dc3096c1e7ba62d96834456c83c7620d4 |
| tests/native/helpers/dec203-stream-ingress-core-cases.mjs | 111 | 5818 | 850859612567b0d11dd935c67430fb392ef645d9d4a260545c290bdade56028d |
| tests/native/helpers/dec203-stream-ingress-stream-cases.mjs | 199 | 9161 | 533cd2918c1ea55148e07bc3312202160bab90628bf83d301218a65502bbcb4c |
| tests/native/helpers/dec203-stream-ingress-writers.mjs | 208 | 8422 | 78786284eccb9fe852e05ca9319343de13b748de925d9727fec6cd39f1166cfc |
| tests/native/helpers/dec203-stream-ingress-writer-build.mjs | 55 | 2242 | 7bec8da920ae4120b7abf23ecfa401dd40d31d80e442796193f458e3d9eb151c |
| tests/native/helpers/dec203-stream-ingress-fixture-compiler.mjs | 245 | 6633 | cb021c687dca7d4d2444855b03d59557738bc1335e62573e801fe4b43e9a82f9 |
| tests/native/fixtures/dec203-stream-writers.c | 141 | 5197 | f836f8410e08832ac45684e8fc854db859009058389f017193888dbad4f54d87 |
| tests/native/fixtures/dec203-stream-writers-state.h | 206 | 6924 | b1aef0d62539cf5648a376a66454de158367f305d6d9612d6c49513370e07e95 |

Root's read-only normal previews, not author execution: main259/harness292/core204/
stream292/writers290/writer-build71/compiler247/C183 lines. Header's earlier preview
was226 before the final15LF monotonic-send-budget addition; its final normal cap
still needs root confirmation. Nothing was compressed to bypass a normal300 cap.

## Twenty independently named cases

| Identity | Actual oracle, once prerequisites are reached |
| --- | --- |
| NS01 | Closed frozen public/metadata/path identity shapes; full actual stat equality and literal private endpoint; repeated close |
| NS02 | Genuine successful build precedes missing/extra/source/addon/scheduler/null-option refusals |
| NS03 | A and B actual SEND ACKs precede accept; concatenated literal bytes and independent writer PIDs, never connector PID |
| NS04 | Postaccept A split fragments then B; arbitrary receive partitioning, exact byte ranges and writer boundaries |
| NS05 | Actual preaccept sendmsg errno1/count−1; earlier separate transfer succeeded; no R bytes, unrelated child handle survives |
| NS06 | Same actual rights refusal after accept, using B |
| NS07 | Owned nonbinary source drift refuses copy/read/receive/accept; diagnostic snapshots remain data; release/close still revoke |
| NS08 | Borrowed methods use actual second receiver owner after first owner closes; first descendants revoked |
| NS09 | Public/plain/Proxy/wrong-type guards and all four exact native types' callback receiver/extra-argument matrix |
| NS10 | Independently copied module registry rejects foreign ingress; no DTO adoption |
| NS11 | No connector/data exists before demand; duplicate pending LIMIT; actual connector/SEND ACK causes progress |
| NS12 | Queued split A/B tail survives shared write shutdown; only real/cached EOF returns null |
| NS13 | Same writer handle first alive, then actual EXIT_A/wait/reap; latched exit still attests source, release wins closed priority |
| NS14 | Fresh independent copy buffers; mutating one cannot alter retained bytes; release revokes bytes/writer |
| NS15 | Four public retained segments; actual next send queued; release resumes pending receive with complete ordered byte accounting |
| NS16 | Raw synchronous EAGAIN/credit undefined, real queued-byte credit discriminator, release and full literal drain without loss |
| NS17 | Owner close revokes before await, settles pending accept once, repeated close and closed-entry refusal |
| NS18 | Stream close settles pending receive once and revokes retained descendants; owner close remains idempotent |
| NS19 | Actual cached EOF still brackets owned source; stream closed priority survives source drift |
| NS20 | Both actual writers reaped with queued data; tail drains before EOF and no dead writer reports alive |

NS09 was moved from core into the roomy main driver, preserving every existing
assertion, before adding its fixed receiver matrix. Public byte oracles permit
partial/coalesced receives; no test equates one send to one receive. Outstanding
subject promises have rejection observers so a later fixture failure/cleanup cannot
create an unhandled rejection; the same original promises remain asserted.

## Fixed real fixture and ownership

`dec203-stream-writers.c` starts B before the connected client exists. It connects
as the third process, forks A with the connected descriptor, and actually sends
that descriptor to B through a separate owned SOCK_SEQPACKET/SCM_RIGHTS channel.
Both child ACKs compare actual fstat device/inode with the connector's original;
the coordinator closes its client alias only after both ACKs. A closes B's control
alias; B cannot have inherited the later connection; children close stdio aliases.

Before READY counts as a prerequisite, JS checks the actual spawned coordinator PID,
distinct A/B PIDs, current UID/GID, each held process's actual PPID/start ticks/exe,
and the attested ELF. It rechecks held identities before/after commands. Endpoints
must name literal docker.sock inside a recorded own directory with canonical path,
same recorded parent dev:ino:uid, full0700 directory/0600 socket modes and current UID;
the fixture never connects based on a mere caller-provided endpoint prefix.

Only SEND_A=AAAA, SEND_B=bbbb, SPLIT_A=s1/s2/s3, TRY_RIGHTS_A/B=R+own connected fd,
HALF_CLOSE, EXIT_A/B and FINISH exist. Commands accept no operands. ACKs follow
actual complete send/shutdown or waitpid terminal status. Tiny nonblocking sends
use one monotonic5s budget across partial/EAGAIN attempts. Control packets are
SEQPACKET, not ingress stream framing. The independent receive oracle concatenates
literal data and rejects a segment crossing a different live-writer byte range.

The child opens an unrelated /dev/null handle and verifies it remains open after
commands, including rights refusal. Separate-channel transfer success precedes
all ingress rights assertions; an LSM-denied transfer cannot masquerade as EPERM
coverage. No arbitrary descriptor/PID/payload/action transport exists.

Normal FINISH or stdin EOF closes control ends, makes children close their owned
descriptors and reaps actual children. JS requires FINISH terminal statuses,
coordinator exit0/no signal, stdin/stdout/stderr close, and original process absence.
Only cooperative fixture cleanup exists. Five-second unproved settlement raises
DEC203_FIXTURE_DRAIN_UNCERTAIN and retains the actual record/artifacts; it never
authorizes deletion or a signal. Setup/protocol failures carry distinct fixture
tokens/causes, not subject errors. Resource cleanup attempts all registered owners
and refuses artifact cleanup after any unproved resource result.

## Fixed executable build and exact compiler inverse

`writer-build` attests exactly dec203-stream-writers.c plus its fixed local
dec203-stream-writers-state.h and the explicit canonical existing compiler before
and after compilation. No hidden local include or caller source exists. Standard
OS headers/compiler remain trusted host inputs, not a hermetic-build claim.
The output is exclusive writers/stream-writers, separately owned, regular/currentUID,
attested before/after an owned-file-handle chmod to full0100700. Inputs and ELF are
re-attested before launch, after held READY and before each command.

Fixed argv is `-std=c11 -O2 -Wall -Wextra -Werror SOURCE -o OUTPUT`.
SOURCE/OUTPUT are the fixed C and reserved owned executable. Sanitized compiler
environment, session/group/start-ticks fence, single authorized compiler SIGKILL,
monotonic30s deadline/5s settlement, close/both-stream/session-absence proof and
uncertain ownership retention are copied unchanged from peer-build.mjs. This
compiler-only cancellation policy grants no fixture-child signal authority.

Exact raw inverse from fixture-compiler to frozen peer-build.mjs:

1. Replace failure import `../../../infra/database-upgrades/native-tracing/peer-artifacts.mjs` with `./peer-artifacts.mjs`.
2. Replace SOURCE URL `../fixtures/dec203-stream-writers.c` with `./peer-credentials.c`.
3. In spawnCompiler destructuring, restore `includeDirectory` between compiler and output.
4. Immediately after argv `'-O2',`, restore the three lines `'-fPIC',`, `'-shared',`, `'-DNAPI_VERSION=8',`, with their original four-space indentation.
5. Immediately after argv `'-Werror',`, restore `'-I',` then `includeDirectory,`, with original four-space indentation.
6. Rename exported compileWriters back to compilePeer. No other bytes change.

Native FS-only string equality confirmed this reconstructs all6671 bytes exactly,
250LF SHA bc4361112d4f2977ab21caa3876a93f5cb101cfd0de7c3941c016fff246551f4.
Root should repeat the inverse against these raw pins before normalization.

The approved writer-build extraction moved executableFixture's complete body;
strip only leading `export `, then trim boundary whitespace:46lines/1829B,
SHA0f218c74b05dea92dc62b948e036cd33401d7c57f26367ce5a12cf1f28b580d0.
Author and root independently matched the same retained pre-extraction text.
Imports moved with that function; no compile/drain/body statement changed in extraction.
Later writers-only changes are the explicit error wrappers and owned endpoint guard,
not undisclosed changes to that extracted function.

## Root next gates and exclusions

FS observation at freeze: stream-ingress.mjs is absent. Each case imports that
exact module inside StreamFixture.open BEFORE allocating its fixture. An initial
missing-module run can establish only missing-API RED, not twenty reached behavioral
failures. No stub/mock/skip/unavailable positive was added. A genuine supported
control must pass before late negative assertions discriminate anything.

Root owns normalization/caps, syntax-only --check (never top-level race import),
independent source/fixture review and execution with explicit pinned Node22.23.1,
DEC203_CC_PATH=/usr/bin/gcc and DEC203_NODE_INCLUDE=/usr/include/node. Suggested
suite shape: pinned Node `--test --test-concurrency=1 tests/native/phase-02-slice-11-native-stream-ingress.mjs`.
Root's separately authored NS21/22/helper/registration need their own freeze pins.

Actual local SO_PASSPIDFD/SO_PASSRIGHTS inheritance, per-message PIDFD semantics,
rights EPERM, compiler/ELF lifecycle and all fixture resource premises remain UNPROVEN.
A deadline/resource/fixture failure is not meaningful product RED. Raw credit
undefined plus complete drain tests observable backpressure/no loss, not a hidden
syscall-count proof. No source-token assertion replaces actual native behavior.

Rare ancillary truncation/duplicate controls, allocation/finalizer faults, dedicated
FD-accounting probes and loaded-output drift remain outside this initial cohort.
No mapped addon was rewritten/truncated. No currentness/publication/restore SQL,
HTTP/proxy forwarding, image/history, all-client drain, finality, native080,
canonical gate, phase acceptance or AC294 closure is claimed. All remain OPEN.
