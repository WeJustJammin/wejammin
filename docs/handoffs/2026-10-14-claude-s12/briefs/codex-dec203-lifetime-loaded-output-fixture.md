# DEC-203 loaded-output TEST fixture repair

Root authorizes a TEST-only repair, not a production correction or weaker oracle.
Existing native lane `native_registry_green_20261016` retains gpt-6.1-sol/ultra.
Write only the authorized Slice12 worktree.

## Evidence and classification

Actual native49 attempt:32PASS then SIGSEGV at the next loaded-output drift case;
LB16 was not reached. Receipt `dec203-lifetime-49-native-lb16-red.log` SHA256
`54af49d2acb41710a57e153fb01037d76cc2ab17bad1c1535b94b0b95dc7d871`.
The unchanged isolated output case reproduces SIGSEGV; receipt
`dec203-lifetime-loaded-output-original-repro.log` SHA256
`236f58d05a5df5ee2ce2b51bb3e881d688ecafdd2c4c37ce7e34892b5ef4a8d0`.
All99 guarded source/report pins were unchanged in both runs.

Generic peer-harness drift186–208 appends a suffix then restores with path-based
fs.writeFile. Official Node22.23.1 promises.js1199–1229 confirms flagw/open then
rewrite; source SHA256
`83c0bef43b6f4937a9f8afbd2f590e150284ff68aedec07783bb6ed7e9adf933`.
Independent source review agrees that truncating a dlopen-mapped image is the
strongest fixture-causal hypothesis. No stack/core was inspected; exact signal
cause and safe-restoration control remain unproved. Do not call this production
C RED or the expected cached-exit regression RED.

## Exact source claim

- NEW `tests/native/helpers/dec203-lifetime-output-drift.mjs` owns the complete
  held-output append/tail-restoration algorithm, naturally≤300 lines.
- Existing `tests/native/helpers/dec203-lifetime-harness.mjs` gets only a small
  dispatch/import for non-atomic exact peer-lifetime.node drift. Its other
  behavior and all atomic/nonbinary generic drift remain unchanged.
- Existing lifetime RED report records the new source/pins and truthful limits.

No other path is released. In particular all production, generic peer fixtures,
old34 and binding721 sources, and every existing49 case body remain read-only.
Ask before any additional path or natural300-line overflow; no minification.

## Required algorithm and handoff

Require exact fixture-owned output/map and matching actual reader.metadata.output.
Hold one O_RDWR|O_NOFOLLOW|O_APPEND FileHandle. Before mutation verify original
ownership, full mode/size/hash and held/named dev/ino/UID identity. Append only a
fixed known suffix at kernel EOF; never overwrite any original byte. Preserve the
unchanged callback's open/read refusal assertions.

Before restoration verify the held/named ownership, unchanged original prefix and
only the exact known suffix (or a verified known partial suffix after failed append).
Only then truncate the held original inode to its original size, never below it;
do not rewrite the mapped prefix. Verify original full hash/stat/name after restore.
Unknown bytes or replacement are not permission to truncate or delete anything.

Attempt the owned FileHandle close once on every path. Preserve a sole original
error unchanged; aggregate multiple check/restore/close errors without hiding
the primary (cause=first). Uncertainty retains strong references/evidence and
adds the existing fail-closed cleanup guard, so generic cleanup cannot delete
uncertain output. Never retry a possibly stale descriptor or adopt foreign residue.

Author uses FS/hash/count analysis and apply_patch only; no parser/import/formatter,
compiler/test/process/socket/signal/Git/DB/Docker/network/secret/install/policy change.
Freeze exact source hashes, old49 body and harness inverse proofs as author UNRUN.
Root independently reviews, normalizes, reruns the same isolated output case,
then the full49 suite. No cached-exit production fix is released until actual
native LB16 RED. All adapter/native080/canonical/phase gates remain separate OPEN.
