# Native postflight checker review — 2026-10-21

Diagnostic record only. This is a captured-source and VM review of the unprivileged
native postflight checker, not a native, database, slice or phase receipt.

## Genuine VM RED

The original 487-line checker (SHA-256
`3abc9e334304c84d6ff2f59f22b43fe8e5d07e2ef3d6864ae4f743c55a38b616`) was rejected by a
captured-source fake-FS/VM review of ten controls: two passed and eight failed. The two
passes were the baseline and the existing-output control. The eight failures were:
blocked leading arrow with an unrelated raw row; actual stat cap; stat close EIO; short
write; parsed PID mismatch; exe EACCES; symlink lock; and short write then EIO.

## Genuine VM GREEN (corrected)

The corrected three-module checker passes the same ten controls GREEN, with zero real
`/proc` reads and zero real writes during the VM run. The new summary report nests the
persisted block and normalizes byte/error field locations without changing the honesty
assertion; rerunning the original still reproduced 2/8, and the corrected version then
passed 10/10.

## Frozen code pins (actual used code)

| module          | lines | SHA-256                                                            |
| --------------- | ----- | ------------------------------------------------------------------ |
| `readonly.cjs`  | 294   | `d7b0df7ed7f1c35893c9253c679d02e03f29340e9ab09b5d66b85825640e4bff` |
| `processes.cjs` | 227   | `d7e69a1bfa986cb55a12bf8efc336492b1db5ba465c04c733d6728ae2980c2c8` |
| `locks.cjs`     | 144   | `252248ea3a972d61e00aa7b671556a2c101d6c13056a4b9e226bead333e6dc8d` |

The `processes.cjs` and `locks.cjs` modules are pure helper imports with no
observation on import; the `readonly.cjs` entrypoint runs one window. The root review
is complete. Pinned native
`--check` on the three modules exited 0 and normal formatting was applied. The pinned
Node artifact `93956de2…068` keeps the same identity. The full 32 production inputs are
present with caps OK and 17 MJS files with 0 syntax errors.

## Static versus native limits

The ten controls are fake-FS/VM-only and are not native acceptance. No real `/proc`
observation or real write occurred during the VM run, so the controls bound the source
logic, not the live host. PR01, database and phase gates remain unrun and held.
