# DEC203 native stream TEST release contract

Root TEST-only release — 2026-10-18T18:16Z. Independent STATIC CLEAR covers
main300linesSHA`be51784ac09265a9154f40d651ab495b2b6ab1bb4271b915dce5b1724296c026`,
interface217linesSHA`58ec14b389e8c1b3beb5a37775fd733d94811a5366b6352026ddfba031841125`
and the unchanged TEST scope/body reviewed as draftSHA
`1756bfebb2cf4bfa2e662fccf240bad4f137d23abda3f5bef22d150d686fe4df`.
Author lane native_dec194_race_red_20261016 retains native gpt-6.1-sol/ultra.
No production, forwarding, HTTP, Docker, reset or acceptance authority follows here.

## Context and immutable boundaries

Read the complete corrected native-stream-ingress plan and, if extracted, its
native-stream-interface companion. Read the root tracing brief and writer-source
inventory. Frozen peer/lifetime production and all existing83 native tests remain
read-only. Binding721, existing fixtures and contract assertions stay read-only.
Root owns every import/parser/formatter/lint/compiler/process/socket/signal/test,
Git, network and database action. Author uses FS/hash/count and apply_patch only.

The public factory is fixed `buildNativeStreamIngress` from
`infra/database-upgrades/native-tracing/stream-ingress.mjs`, with exactly
`runDirectory,compilerPath,includeDirectory`. No source/addon/fd/PID/scheduler override.
Import it INSIDE each case before allocating any fixture. Missing import is staged
RED only, never actual kernel or functional evidence. No skip/unavailable branch
may count as a supported positive control.

## Selected raw-native and facade constraints

Private addon exports only createIngress(parentPath). Its synchronous frozen,
per-type-tagged objects have exact keys:

| Object | Exact own keys | Nonterminal no-progress |
| --- | --- | --- |
| native owner | accept,close | accept returns undefined |
| native stream | receive,close | receive returns undefined |
| native segment | copyBytes,writer,release | none |
| native writer | read | none |

Native receive returns null only on actual EOF, never EAGAIN/credits. Public
accept/receive remain Promise operations under the fixed bounded JS scheduler.
Every nonclosed operation, including cached EOF/exit and copyBytes, brackets its
actual receiver-owner build. Immutable metadata/identity are diagnostic snapshots,
not getters or fresh authority. Release/close revoke despite artifact drift;
first primary errors survive secondary cleanup/attestation errors.

## Exact prospective TEST-only claim

Only the following NEW paths, subject to explicit root release above:

- `tests/native/phase-02-slice-11-native-stream-ingress.mjs`
- `tests/native/helpers/dec203-stream-ingress-harness.mjs`
- `tests/native/helpers/dec203-stream-ingress-core-cases.mjs`
- `tests/native/helpers/dec203-stream-ingress-stream-cases.mjs`
- `tests/native/helpers/dec203-stream-ingress-writers.mjs`
- `tests/native/helpers/dec203-stream-ingress-writer-build.mjs`, root-approved
  mechanical extraction of the fixed executable build/attestation helper.
- `tests/native/helpers/dec203-stream-ingress-fixture-compiler.mjs`
- `tests/native/fixtures/dec203-stream-writers.c`
- `tests/native/fixtures/dec203-stream-writers-state.h`, only if needed for the
  cohesive fixed writer/descriptor-transfer/child-lifecycle implementation.
- `tests/native/helpers/dec203-stream-ingress-limit-cases.mjs`, separately owned
  by native_pattern_green_20261016 for NS21/NS22; root alone wires registration
  after the original author freezes its driver. No overlapping write claim.
- `tests/native/phase-02-slice-11-stream-writer-fixture.mjs`, separately owned
  by native_registry_green_20261016 for a fixture-only prerequisite control.
- `docs/handoffs/2026-10-14-claude-s12/lane-codex-dec203-native-stream-ingress-red-2026-10-18.md`

All naturally formatted source files must remain≤300lines. Do not minify or drop
assertions to fit. The exact helper extension above separates case registration
and fixed fixture compilation; it does not authorize hidden helpers. Request any
other path before writing it. Fixed C fixture support closure must be complete.

## Real fixture, not an injected subject

Compile only the fixed reviewed C fixture into its separately owned directory,
using the existing canonical compiler, explicit fixed flags and sanitized env.
Reuse the unchanged compiler/session/drain algorithm through a fixed-name copy
where needed; report exact extraction inverse and necessary fixture-recipe deltas.
No caller source/output recipe or generic arbitrary-fd action protocol.

The fixed ELF recipe uses the claimed C plus its optional fixed header, exclusive
`stream-writers` executable output and existing canonical compiler. Remove shared-
library/Node-API/include flags only as necessary for that fixed executable recipe;
retain full source/header/compiler attestation and the unchanged monotonic30s/5s
compiler fence, stream/session-drain and uncertain-retention algorithm. Record every
recipe delta and exact unchanged-algorithm inverse; do not replace it with bare spawn.

The C fixture owns a connector and two genuinely distinct child writers, one
inheriting and one receiving that same connected client socket via actual
SCM_RIGHTS on a separate fixture-owned channel. Keep writers alive behind explicit
barriers. Commands choose only fixed literal scenario actions, never arbitrary
payloads, descriptors or processes. Emit bounded nonsecret PID/UID/GID, send count,
errno and barrier witnesses. No Docker endpoint or production capability is supplied.

Use a fixed standalone ELF coordinator, not fork from multithreaded Node. Prefer
forking B before the client connection exists; alternatively B must close every
inherited client alias before accepting the actual SCM_RIGHTS handoff. A inherits
the connected client. The coordinator closes its client alias after the verified
handoff. Independently check held child PID/PPID/start/executable identities before
counting READY as a valid fixture prerequisite. No inherited duplicate may mask the
transfer. Descriptor ownership/unused-end closure must be explicit per process.

Seal the finite scenario vocabulary in the fixture source: SEND_A/SEND_B use fixed
literal A/B bytes; SPLIT_A uses fixed literal fragments; TRY_RIGHTS_A/B sends the
fixture's own connected descriptor with fixed R bytes; HALF_CLOSE performs the
fixed shared write shutdown only after selected sends; EXIT_A/B waits the named
owned child terminal; FINISH is cancellation-only closure/settlement. No caller
payload, fd, PID, signal, option or executable operand. Malformed/state-invalid
commands refuse. ACK requires actual complete send/shutdown/terminal, not enqueue.

The real separate-channel transfer must succeed before either ingress EPERM test.
Use fixed tiny nonblocking writes and explicit control ACKs; interleave receives,
not large prequeues dependent on send-buffer capacity. The exact raw-native mirror
provides a synchronous credit-refusal discriminator. Public waits need actual
progress/close barriers; sleeping or a single untaken timer turn is not proof.

Normal FINISH or parent stdin EOF closes child control ends, makes children close
only their own descriptors, and collects actual wait statuses plus every pipe/
stdio terminal. Preserve a primary fixture failure. No compiler-only signal policy
authorizes killing these processes. Bounded5second unproved fixture settlement
reports DEC203_FIXTURE_DRAIN_UNCERTAIN and retains ownership/evidence; it is not
success or permission to delete. Other fixture setup/protocol failures use distinct
DEC203_FIXTURE_PRECONDITION and DEC203_FIXTURE_PROTOCOL tokens, never subject errors.

Use actual send-completion ACKs before calling accept for the preaccept test;
do not use sleep or assume one recv per send. Independently require concatenated
literal bytes and the correct held writer identity for each actual received segment.
The connection-time connector is a third identity and cannot satisfy writer checks.
Prove preaccept/postaccept rights-send refusal with actual literal EPERM witnesses,
not a manually returned error. Unsupported flags cannot pass these controls.

Await actual fixture children, control endpoints and stdout/stderr terminal. Close
only owned descriptors once. Retain uncertain evidence/ownership rather than generic
kill/delete. Any signal requires a separately exact root-authorized owned fence;
do not infer owner/coordinator signal authority from compiler-only cancellation.

## Initial case coverage

Valid genuine controls precede discriminating negatives:

1. Closed factory/result/metadata/identity shapes and real private endpoint.
2. Two distinct held-live writers queued before accept, inheritance plus actual
   transfer, proving per-segment writer identity rather than connector fallback.
3. Postaccept writer change, split/coalesced data and exact byte preservation.
4. Actual preaccept and postaccept incoming-rights EPERM; no rights payload or fd
   admitted, unrelated fixture handles preserved.
5. Would-block remains pending; queued tail survives HUP; only actual EOF yields
   null. A dead writer may accompany queued data but cannot return alive identity.
6. Per-stream credit backpressure/release without lost bytes, duplicate pending
   accept/receive refusal, and close settling pending operations exactly once.
7. Fresh copyBytes buffers; mutating a copy cannot change retained native bytes.
8. Live→exited writer, latched exit, release/stream/ingress revocation and repeated
   release/close. Closed-state priority must survive later artifact drift.
9. Genuine borrowed methods use actual receiver ownership; plain/Proxy/wrong-type
   receivers refuse. Raw-native tests target only the exact named mirror above.

Do not truncate/rewrite a dlopen-mapped .node fixture for drift. Initial nonbinary
source drift may reuse unchanged safe generic logic. Loaded output drift needs a
separately claimed held-fd/tail-only fixture with complete identity/retention checks.

Root selected NS21/NS22 at18:31UTC: actual native16-stream and32-segment per-owner
limits, no consumed/discarded input at refusal, and actual close/release resumption.
Use at most17 fixed coordinators/34 held A/B children; only their existing finite
commands and cooperative cleanup are permitted. No fixture signal authority is added.
The writer-build extraction must preserve its complete function body (only export
and imports move); root retained its exact pre-normalization body hash for comparison.

The separate fixture-only control uses a test-owned Node Unix server at the owned
docker.sock path,0600, to receive fixed SPLIT_A/SEND_B literals. It verifies actual
SCM transfer startup and actual all-client EXIT/EOF/FINISH drain without HALF_CLOSE.
That Node reader is not the subject ingress, a writer-credential producer or proof
of PASSCRED/PASSPIDFD/PASSRIGHTS support. It cannot satisfy a functional subject test.
No new factory is imported or faked in this control; the existing Fixture import
still precedes allocation. Root review is required before compilation or execution.

Full build/header/output replacement matrices and dedicated descriptor-accounting
probe processes require later exact TEST claims. State
unreached/rare syscall/NAPI/control-truncation paths honestly; do not manufacture
reachability using production fault hooks or label normal loops exhaustive proof.

## Handoff and gates

Freeze raw source hashes/counts, case names and fixed support/compile closure as
author UNRUN. Preserve all old source bytes. Root reviews fixture safety, normal
caps and actual import-before-allocation RED before any GREEN source release.
Actual fixture prerequisite proof is distinct from the subject's functional result.
Every remaining native/kernel/history/image/HTTP/wire/finality/adapter080/canonical
and phase gate stays OPEN until its own reached evidence passes.
