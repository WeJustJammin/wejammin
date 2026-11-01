# DEC203 private bootstrap binding propagation scan

Date: 2026-10-19. Native gpt-6.1-sol/ultra. Status: APPLIED; INDEPENDENT STATIC CLEAR.
Scope: private implementation-contract/compiler-ownership and framing clarification.
No product, public API, privilege, service, default-stack or hosted change.

## Authority and source

Owner requested an isolated per-run adapter with reviewed binding changes.
Selected117LF exact21-path contract is the current source-release authority.
Current14doc manifest SHA f61d18bf1f93dff4b1e6e7a001b7798fd22bf21b9b43ed9db4547b74bd856e46.
All127 primitive +14binding +8normalizedTEST +immutableprofile =150pins match.
Owner explicitly answered Apply reviewed clarifications (Recommended) for this
exact two-correction set on2026-10-19. No additional semantic change is approved.

Root read actual peer-build.mjs250LF/6671B, SHA
bc4361112d4f2977ab21caa3876a93f5cb101cfd0de7c3941c016fff246551f4.
Its final export returns diagnostics only; stream.done records close, not EOF.
Root and independent native_web reviewer read and cleared the proposed narrow seam.
Root scanned all4096 mentions in the frozen14docs and currentTEST frame validation;
independent native_web reviewer cleared payload4096 plus4-byte prefix interpretation.

## Classified references

| Binding | Classification and proposed correction |
| --- | --- |
| source-selection33–34,97–99 | Literal-edit-only wording needs one explicit mechanical seam exception; all fence/drain algorithm bytes remain unchanged. |
| green211–217 | Same compiler exception and exact inverse requirement. |
| runtime-binding104 | Existing genuine compiler-terminal ownership stays; add synchronous actual child/stream ownership capture, never infer EOF from close. |
| interface144–148 | Implicit size ambiguity; clarify entire UTF-8 JSON envelope<=4096 bytes plus4 BE length, total<=4100. |
| pre-ready-test213–215 | Consistent envelope bound; make prefix/payload split explicit without reducing assertion coverage. |
| native-ABI127–129 | Consistent envelope bound; make prefix/payload split explicit without changing native ownership or ACK rules. |
| green111/source-selection76 | Consistent4096-envelope wording, no additional semantic change needed. |
| immutable profile.h | Existing4096 macro means envelope bytes; do not edit header. |

## Exact reviewed mechanical seam

startOwnerCompiler(workspace) and startLeaseCompiler(workspace), arity1 each.
Only actual artifact-workspace WeakMap keys accepted; role, compiler, source, flags,
output and environment remain fixed. No caller recipe/argv/source/callback selector.
Return synchronously one frozen internal mechanical view containing actual child,
actual stdout/stderr streams and one cached immediately owned settlement promise.
Private pending/fence/state stay compiler-owned. Start original drain and final
predicate immediately; attach consumer wait/end/error/close listeners synchronously
before yielding. No second data reader, raw output diagnostic or new kill permission.
LeaseBuildRecord, issuer and native lease owner never enter this view.
Inverse explicitly removes added wrappers/view exports and restores original entry;
all other nonrecipe algorithm bytes must equal the250LF baseline.

## Framing constraints

Entire encoded JSON envelope<=4096 UTF-8 bytes; independent4-byte network-order
length yields wire<=4100. Existing profile constant remains4096 unchanged.
Reject zero/oversize lengths before allocation/arithmetic. Consume exactly declared
payload, preserve bounded fragments and subsequent frames, reject incomplete EOF,
invalid UTF-8/JSON, unknown/duplicate/extra keys and sequence violations. Never
truncate or accept a partial payload. All positive frames remain far below the cap.

## Apply and proof gates

Owner confirmation received; apply only these six binding corrections.
Seven exact hunks across six bindings replay/reverse byte-for-byte; independent
review STATIC CLEAR. Current14doc manifest is mechanical-seam-doc-pins.json SHA
c892205c5e71915a406917110dc8591a1d1a8ddf645a2997451a267d877e9ab6.
Semantics are approved; precise source-path decomposition/release remains separate.
No implementation/native/runtime/acceptance gate is cleared by this scan.
memory_compile is unavailable in current tool inventory; do not start a persistent
daemon or claim a refreshed graph. Record that limitation in propagation result.
