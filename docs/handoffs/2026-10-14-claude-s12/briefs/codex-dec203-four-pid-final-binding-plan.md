# Four-PID final binding plan — source integration only

Status: PLANNED, runtime/privilege UNRUN. No new owner authority.
Models: gpt-6.1-sol / ultra. Writable repo remains Slice12 only.

## Fixed facts

Existing metadata main191LF69b6566b and actors257LF5ff150a7 stay byte-exact.
Compile actors privately with ONLY its node:fs binding replaced by bridge.fs;
compile main privately with ONLY its exact actorsFile require supplied by that
compiled actor module. Other imports, bodies, process roles/ancestry/UID,
source196 checks, four-lock checks, error semantics and console result stay.
No patch of global fs, require, console or process. No cached exe images.

Bridge67 +grant217 +capture40 +decoder96 =420/420 pure controls at22:01:58Z.
Seventeen files canonical/syntax/caps pass;196 repository pins remain exact.
Capture maximum JSON bound5710<8192 independently reviewed. Grant and
capture/decoder independent static reviews clear. Actual bindings still UNRUN.

## Three cohesive source paths, pending review/release

Under existing /tmp/wejammin-native-s12-20261017.Adf0uP only:
- dec203-four-pid-inspection-attest.cjs: read-only source/binary/receipt fences.
- dec203-four-pid-inspection-helper.cjs: unprivileged async capture CLI.
- dec203-four-pid-inspection-driver.cjs: one-run consumption + adapted metadata.

Each <=300 canonicalLF. No source execution on import except guarded CLI main.
No actual privilege while writing, parsing, formatting, tests or reviewing.

## Attestation and source closure

Create a NEW bounded final source manifest after freezing these files; do not
overwrite existing17-tool or196-source manifests. Manifest may include driver/
helper/attest hashes, but never its own hash (avoid self-hash cycles).
Root independently pins manifest SHA before launch. Driver/helper take ONLY
that64-lowercase-hex SHA argument; helper additionally takes exact approved exe
path. Manifest path is literal, not caller-selected. Strict closed schema,
literal allowed file roots/names, unique bounded entries, no arbitrary program.
Attest checks manifest hash, every selected source hash and existing196-source
manifest/hash/content. Preserve original main checks too.
Trusted binaries remain literal /usr/bin/sudo and /usr/bin/readlink, canonical
root-owned regular files at reviewed dev/inode/mode/size/hash. Recheck before/
after every actual privileged call, including negative results. No env reads.
Actual parent grant record sourceHashes binds final manifest SHA,196 manifest
SHA and trusted binary hashes (<=16), plus fixed approval and target cores.

## Helper ownership and emission

Parent invokes ONLY pinned Node +literal helper +fixed SHA +approved path,
unprivileged, shellfalse, no timeout, stdin/stderrignore, stdoutpipe, retained
read-only receipt FD duplicated as3. Parent spawnSync stdout max16384; its
latent overflow termination must be unreachable because helper unconditionally
emits at most one canonical Buffer below8192 on every branch, no other stdout.
No generic command/path/env input. No privileged user-writable JavaScript.

Before any sudo, helper verifies fd3 held/named identity, UID/GID/mode, canonical
receipt bytes/hash and expected approval/targets/sourceHashes, retaining it
through closure; exact approved PID/start/UID/parent/group/session fence.
Use existing captureReadlink with genuine child_process.spawn and fresh fence.
It alone calls sudo -n -- /usr/bin/readlink -- exact-approved-proc-exe.
Fixed minimal env PATH=/usr/bin:/bin,LANG=C,LC_ALL=C,TZ=UTC.
No timeout, signals, destroy, unref, abort, cleanup, service or stack changes.
Await actual child close and both present pipes' close; positive additionally
requires actual exit, both EOFs and zero status/stderr/error/signal/overflow.
Write one bounded private capture Buffer once, after natural settlement.
On pre-start failure emit at most one bounded negative record or nothing with
nonzero exit; never print raw path/stderr/stack/data. Stall stays retained,
uncertain and blocked; no new forced-cleanup authority.

## Driver and grant lifecycle

Root writes a separate operator CONSUMED claim with apply_patch and verifies it
BEFORE the one actual launch. Original immutable approval is historical, not a
renewable permission. Genuine grant.consume creates the exclusive leaf once;
existing or partial receipt refuses without repair/delete/retry. Do not run a
positive driver rehearsal against real FS or consume approval during unit work.
Keep held parent +readonly receipt through each genuine helper's natural exit.
Before every invoke: grant.verify/descriptor, source/binary/identity attest.
Normalize parent result to exactly {status,signal,error,stdout}; error missing
becomesnull. Decoder then supplies exact normalized bridge transport result.
Bridge spends first and limits two privileged reads/PID eight total, no retries.
Fresh reads at both original actor image points; never reuse cached results.
After main settles, bridge.finish and grant.finish, plus final source guards,
and record truthful bridge/grant state. Do not create any output file in the
sealed base between consume and finish (would change sealed parent stamp).
Keep original metadata result distinct from adapted transport settlement.
Clear metadata is point-in-time evidence, NOT global/native absence proof.
No shell wrapper with huge -e cmdline in actual run; direct fixed driver path.

## Required release gate and next action

This plan needs independent static integration review before source release.
After source-only authoring: canonical/syntax/caps, full source read, negative
no-privilege CLI controls and pure fake-port wiring checks. Independent source
review must clear the actual binding. Only then consume operator claim and
perform this ONE approved read-only metadata run. If sudo -n refuses, stop and
report exact sanitized availability problem; never ask for password, change
sudo policy, try a different privilege route, or silently renew permission.
If actual metadata clears and natural settlement/source guards hold, proceed
to normal PR01 only under existing native ownership/closure protocol.
First native failure holds all later native/DB/validate gates.
