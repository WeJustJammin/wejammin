# Native lock-recovery tooling review — 2026-10-21

Diagnostic tooling/local review only. This is **not** an actual helper, driver, native
database, criterion or phase receipt, and a `.memory` tooling test is not a domain
receipt.

## Creator initial RED

The initial creator was 299 lines, SHA-256
`649f7dd2ee7514c831c16c5a8dfce52e3feb9d28609ea520fa4f41d8c39876b9`, normalized to 386
lines by normal formatting, and it ignored the final `lstat`. On the same 23 fake-FS/VM
controls it scored 16 pass / 7 RED. The 7 RED were the final-missing, inode, mode, owner,
symlink, size and directory cases, each falsely reported exit 0 with `complete:true`.

## Creator repaired GREEN

The repaired creator is 251 lines, SHA-256
`8fccb421dcff67830f7542f0d5e066df1d58e6fdc6d7fa78ae7fdfbdfa55d0fb`, with a 198-line
helper, SHA-256
`93614f3504b7f2c8a630353e83d311bf0ac06139784abec870faf7d056519f0d`; together they now
score 23/23 GREEN. Controls exercised: baseline; wrong UID/GID with zero FS; existing
marker with zero lock writes; existing target with zero lock opens/chmod; third open
conflict preserving 2 with attempts 3; umask with a fresh FD `fchmod`; chmod/fsync/close
failures stopping; the 7 final variants; combined fsync+close recording both with one
close; and short/zero/write/fsync/close marker persistence handled honestly.

## Observer modules and wrappers

The 4 new observer modules scored 10/10 pre and 10/10 post under the same VM controls;
the invalid constructor, free path and import-only cases performed zero FS operations.
The wrappers were corrected to exit 1 if persistence fails **before** consumption.
Normal formatting left the main and helper unchanged, and pinned Node 22.23.1 native
`--check` on all 6 new CJS files exited 0.

## Limits and current state

These are tooling/local checks only; there is no actual helper/driver, native database,
criterion or phase acceptance here. ROOT's actual recovery preflight completed, and a
single privileged batch is now live matching the four-tuple plus five-pin fence; the live
handle and raw report details are intentionally omitted from this note. Native outcomes
are recorded separately by ROOT, and no recovery or native clear is claimed.
