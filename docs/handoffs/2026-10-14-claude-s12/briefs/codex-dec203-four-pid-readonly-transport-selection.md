# Four-PID read-only metadata transport selection

Status: OWNER APPROVED; SOURCE/CONTROL REVIEW REQUIRED; actual inspection UNRUN.
Selected 2026-10-19 after the strict metadata preflight blocked PR01.

## Scope and owner authority

One logical independently reviewed privileged READ-ONLY inspection only.
Owner approval: /tmp/wejammin-native-s12-20261017.Adf0uP/
dec203-four-protected-pids-readonly-owner-approval.json (21:23:32Z).
Targets:3151412,3413674,709,721. No replacement PID/instance is admitted.

This is private root validation tooling, not native TEST13/SOURCE32, a production
API, a new diagnostic channel, native acceptance or phase-completion evidence.
No signals, cleanup, environment/secrets, service/default-stack/host-policy change,
generic privilege grant, lock acquisition, automatic renewal or validation credit.
No user-writable program may execute privileged.

## Fixed retained identity tuples

Columns: PID, PPID, process group, session, start ticks, UID.

| PID | PPID | Group | Session | Start | UID |
| --- | --- | --- | --- | --- | --- |
| 3151412 | 3151385 | 3151412 | 3151412 | 37073007 | 1000 |
| 3413674 | 3413587 | 3413674 | 3413674 | 9448053 | 1000 |
| 709 | 1 | 709 | 709 | 592 | 1000 |
| 721 | 709 | 709 | 709 | 595 | 1000 |

These derive from actual21:10:55Z unprivileged proc metadata in
dec203-normal-pr01-direct-preflight-blocked.json, not comm/GID/seccomp role hints.
Before and after EVERY privileged call, freshly fence all six identity fields.
Any mismatch irreversibly disables privilege; never inspect a replacement.

## Immutable observer and source boundaries

Keep exact original metadata main191LF SHA
69b6566b07326707cb4a206cf6b03879a3d4f4f33404a30972428a18c8468060
and actors257LF SHA
5ff150a7ff68569d25a5ce5d20477283262a65d229618dced214cc62b24e1ea8.
Privately compile those bodies with only actors' readlink transport adapted.
Every other filesystem call, receiver/options,196 source guards, four exact lock
identities/held+waiting rows, roles, ancestry and uncertainties remain unchanged.
This is an ADAPTED metadata preflight, never an unchanged direct invocation.

Fallback only after genuine EACCES on an exact approved /proc/PID/exe path,
with exactly one argument. All other paths/errors/options delegate unchanged.
Perform a genuine kernel read at each original before/after image point; no cache.
Root-owned canonical binaries are pinned by full identity/hash:
- /usr/bin/sudo: dev38,ino44037,uid0,mode104755,size289976,
  SHAfe945435e24e1c733fb559a05d6f607dd8203799e84dd885e724a81944041d14.
- /usr/bin/readlink: dev38,ino9129108,uid0,mode100755,size76088,
  SHA092f87a1632ad9102757d676c85150556b71cc377642f2d55f04c9df9af63aa1.

Only command: sudo -n -- /usr/bin/readlink -- /proc/<approvedPID>/exe.
Use absolute binary paths, shell:false, ignored stdin, explicit PATH=/usr/bin:/bin,
LANG=C,LC_ALL=C,TZ=UTC. No askpass/inherited environment or timeout that signals.
Recheck binary identities/hashes before and after every actual attempt.

## Finite budget, output and first failure

Spend before spawning, max2 attempts/PID and8 total; no retry/cache/refund.
Success requires actual status0, no signal/error, captured Buffer stdout/stderr,
empty stderr, stdout1..4096bytes with exactly one finalLF, losslessUTF8 and a
nonempty absolute target containing no NUL/newline. Remove only finalLF, never trim.
Changed before/after images are handled by unchanged observer identity refusal.
Do not emit raw target paths, stderr or stacks.

Private bridge report exact deeply frozen shape:
{attempts:[{pid,count}],total,failed,closed,tag}.
Tags:OK,IDENTITY_CHANGED,BINARY_CHANGED,GRANT_USED,LIMIT,CLOSED,
TRANSPORT_FAILED,MALFORMED. Only actual process-fence drift exposes code
IDENTITY_CHANGED; other bridge refusals expose EACCES. Preserve first error/tag
through postchecks and later fallback requests. finish revokes privilege only;
genuine unprivileged delegation may continue.

## One-run ownership and TDD

Root marks owner approval consumed before first privileged invocation.
Process/module recreation must not renew it. Pure controls use fake ports only
and consume no real privilege. READY/GO is not selected. Independent lifecycle
review clears one ordinary unprivileged tracking receipt in the existing owned
base: literal dec203-four-pid-readonly-consumption.json, exclusive/no-follow0600,
held/named full stamps and readback hash, original parent directory held through
the phase. Existing or partially created files remain consumed; no overwrite,
delete or retry. Retain the read-only receipt FD until natural helper settlement.
This output artifact is not a new global lock, target write or native proof.

Direct synchronous sudo capture is not selected: buffer overflow can signal a
child. A separate pinned UNPRIVILEGED Node helper drains both sudo/readlink pipes,
retains at most4096 stdout bytes and no stderr content, uses saturating counters,
never signals/destroys/unrefs, and awaits actual child and stream closure. Its
single canonical private result is unconditionally below8192bytes. Only that
fixed-source bound permits parent capture16384 without reaching its latent kill
limit; pure worst-case controls must prove the bound. This bounds memory/calls,
not elapsed time. A stalled helper remains uncertain; no forced cleanup follows.
Parent validates the entire private record and never emits its image field.
No runner execution is released before root pure tests and independent review.

Pure RED precedes bridge implementation. Cover both image points, raw success,
wrong path/PID/error/options, every before/after fence field, budgets, recreation,
failure latch, unavailable sudo, malformed/oversized output, binary/source drift
and unchanged delegation. Natural canonical300LF per code artifact still binds.

PR01 remains UNRUN. Inspection/preflight clearance alone is not native validation.
