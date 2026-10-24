# DEC203 Node22.23.1 bootstrap descriptor inheritance

Root primary-source research, 2026-10-18T17:51Z. Source evidence only;
actual fixed-launch/child descriptor controls remain required. No execution,
compiler, lock acquisition, service or default-stack change follows here.

All sources use the immutable prefix
`https://raw.githubusercontent.com/nodejs/node/v22.23.1/`.

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| `src/node.cc` | 58177 | `878553644444ef00f8d3c2a144b5b6ff542c9235cff774f23dd4e9ddb364a73a` |
| `deps/uv/src/unix/core.c` | 48102 | `bebf5062eefb617a1d03e5e78f864b6384e14fb7055d534c3a092fc2132f4ac4` |
| `deps/uv/src/unix/process.c` | 31333 | `cedc79cb473c0dde5c270ff2ee7b7956cbdfe0b3aceba19597b9a75a21e119f0` |

`node.cc:895–899` makes inherited handles noninheritable through
`uv_disable_stdio_inheritance`, unless nonstandard process-initialization flags
enable inheritance or omit stdio initialization. The proposed launcher uses the
fixed standard Node executable/entry, not a custom embedding with those flags.

`core.c:800–808` unconditionally attempts FD_CLOEXEC on the first16 descriptors,
then continues until the first error above15. This supports the fixed3–9 bootstrap
route without adding an unreviewed pre-adoption native helper. `:700–713` uses
F_SETFD for that flag. The current process keeps those descriptors; subsequent
execs should not inherit them unless explicitly remapped.

`process.c:342–369` handles selected child stdio mappings, including clearing
CLOEXEC when the source already has the target descriptor number. This is not
proof of the actual compiler child's complete descriptor inventory.

The C owner must explicitly clear CLOEXEC on exactly designated3–9 for the FIRST
fixed Node exec, including source==target duplication. Before any inner compiler
launch, the coordinator must independently inspect its own fdinfo3–9 and require
the CLOEXEC state. These early observations are a refusal guard, not a native
LeaseCapability or authority minted from metadata. Native adoption later checks
actual F_GETFD/held identities. A real owned compiler-child absence control must
prove none of the lock, owner-pidfd or control descriptors crossed that exec.

Original-owner pidfd readiness does not prove the outer build driver is alive.
The selected protocol must separately latch its authenticated channel EOF/cancel
in native state before any ordinary release. A thread-safe JS notification cannot
be the release authority. Exact topology/ownership, one reader per channel and
bounded cancellation/reap/uncertainty contracts remain pre-TEST review gates.

No arbitrary descriptor adoption, process signal, new PID fallback, installer,
privilege or kernel-policy change is authorized by these source observations.
