# Node artifact pin — selected strict correction, implementation UNRUN

Root decision2026-10-19T22:26Z: add actual Node artifact identity/hash checks.
Do NOT downgrade to path/version-only trust. Independent three-file binding
review is BLOCK; one privileged inspection remains UNCONSUMED.
No additional privileged target, service, stack, signal or permission follows.

## Evidence and initial selection

Existing final plan says pinned Node, while driver/helper check only path/version.
The actual binary attestation currently covers sudo/readlink only.
A same-version Node replacement can evade that guard. This remains open.

Root obtained initial ordinary-readonly Node artifact metadata, not a previously
approved Node-byte hash. Receipt dec203-four-pid-node-initial-artifact-metadata.json
under existing receipt base. Current executing /proc/self/exe dev/inode matched
the fixed named/held binary before selection; full named/held stamps bracketed
actual EOF/hash and owned FD closed once. No targetPID or privilege used.

Fixed Node path:
/home/rob/.cache/chrome-gate-runtime/node-v22.23.1-linux-x64/bin/node
versionv22.23.1; dev37; inode77902051; UID1000; mode100755; size124835376;
SHA93956de2e59480474a7b46571da1651180b1a050cdf32641ebec4ce6e478e068.
No silent rebasing if any initial or subsequent identity/hash differs.

## Bounded implementation plan

Proposed one cohesive private runtime module:
dec203-four-pid-inspection-binaries.cjs under existing owned receipt base.
Not source-released until discriminating controls reach actual RED.

Exports fixed deeply frozen BINARIES records and zero-argument
verifyInspectionBinaries(). No selectors, injected execution choices, import I/O
or public API. Fixed record order sudo,readlink,Node (append Node to old order).
Each record uses {path,device,inode,uid,mode,size,sha256}; source receipt retains
the complete initial Node stamp too. Keep fixed minimal execution env.

Stream hashing through ONE64KiB buffer reserved before any open. Reserve private
FD ownership bookkeeping before opening. Exact canonical regular file, pinned
UID/mode/dev/ino/size, full held/named stamp equality, actual EOF, exact bytes and
digest required before/after. Bind current process through ordinary
/proc/self/exe identity to selected Node as well. No whole124MB allocation.

Compare reviewed outer metadata with actual inner open bracket (preserve fixed
baseline binding added by root after actual1PASS2FAIL ->3PASS). Preserve first
failure across postchecks/close. Close only still-identified owned slots once;
ambiguous/failed-close slots stay uncertain, never retry or claim cleanup.
No write, delete, chmod, signal, timer, destroy, unref or cleanup operation.

Attestation should call the new verifier at EVERY existing verify(), so existing
driver/helper pre/post fences cover every helper launch. Moving fixed binary
records/verification into this cohesive module frees the current300LF attest
cap; do not golf. Helper/driver privilege command, counter, grant, FD3 and
settlement semantics must remain unchanged. Source-only authors remain UNRUN.

After freeze, NEW final manifest becomes23 exact source entries and3 binaries,
in fixed sudo/readlink/Node order. Grant sourceHashes order:
[finalManifestSHA,repository196SHA,sudoSHA,readlinkSHA,NodeSHA].
No self-hash cycle; final SHA still a fixed argument. No actual final manifest
exists yet. Do not overwrite/create a consumed grant or operator claim.

## Required tests/review before any launch

Pure controls with independent expected metadata:
valid baseline; inert import/strictzeroargs; same-version inode replacement;
changed bytes/digest; outer/open gap; size/EOF/fullstamp drift; fragmented reads;
read/fstat/close faults; first error preserved; no retry or unsafe numeric close.
Use bounded fixtures and genuine source execution in isolated stubs, not tokens.
Do not derive oracle from implementation constants or stub acceptance alone.

Keep prior binary3 semantics meaningful when import wiring changes. Re-run420
transport,13 binding (not yet final sensitivity) and full current static/pin
checks. Negative CLI controls must prove no real grant or child spawn.
Review actual new source independently, not merely this plan. Recheck Node
selection fresh against initial receipt, freeze ALL authors, prepare/verify
23-source manifest, and ONLY THEN consume the operator claim for one actual run.
This plan is preparation; no privileged release, native or phase acceptance.
