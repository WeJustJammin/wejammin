# DEC203 pre-ready entry and diagnostic binding

Root-selected private implementation contract, 2026-10-18T19:54Z.
Independent planning review is STATIC CLEAR; source/runtime retain release gates.
Selected pre-ready contract, native frames, finite TCB and full-factory HOLD
remain binding. No new native frame/ACK, public constructor, cancellation channel,
provider, service, default-stack/config or host-policy change is selected.

## Fixed entry, correlation and owned build root

O accepts only the already-selected literal stdin plus EOF, with exact argv
`[fixedNode,'--',fixedLauncher]`. After validation it synchronously reserves its private
BootRecord and generates one canonical lowercase UUIDv4 bootstrapId with the
existing Node crypto RNG. The ID is correlation only, never permission or a
caller option. C's exact argv is `[actualOwnedOwnerImage,bootstrapId]`; C passes
that unchanged as I argv `[fixedNode,'--',fixedCoordinator,bootstrapId]`. Reject extra
arguments, malformed IDs and mismatches with actual parent/owned records. Native
I derives it from its actual validated entry/parent record, not a JS adopter arg.
Existing per-direction native sequence and one-shot slots remain unchanged.
These are RAW kernel `/proc/.../cmdline` argv, preserving literal `--`; Node's
normalized `process.argv` is not a replacement for those actual-entry checks.

O creates one canonical current-UID0700 temporary root, with fixed0700 `owner`
and `lease` subdirectories, then uses that actual root as C/I cwd. No caller path,
environment selector or inherited build receipt chooses it. I derives the root
only from its independently bracketed original C executable at the fixed suffix
`owner/receiving-lease-owner`, and verifies it equals its actual canonical cwd,
the held/named0700 identities and the original C/driver/descriptor relationship.
This path is not BuildCapability; all existing native adoption checks still apply.

After actual compilation and proved compiler settlement, normalize ONLY the
exclusively reserved output through its held identity-checked fd: O's owner ELF
to0700; I's lease addon to0600. Initial output creation remains strictly0600.
Before either transition, accept only full regular-file modes0100600,0100601,
0100610,0100611,0100700,0100701,0100710,0100711: compiler-added execute-bit subsets,
not final modes or caller-selected permissions. Keep the original held/named0700
directory guards. Recheck descriptor/named device/inode/UID/size/hash and exact
final mode around the fd transition and independent RO handoff, before exec/load.
No named-path chmod, chmod of replacements, other files or shared locks. Lease
output MUST be0600 before RO handoff/load. This explicit production authority
was separately approved for lease output; it is not inherited from TEST fixtures
or from emergency process cleanup. No new production signal permission follows.

Keep constructor/private issuer/LeaseBuildRecord/native owner lexical in lease.
Only internal zeroarg runPreReadyLeaseConstruction():Promise<void> is exported there;
bootstrap's guarded zeroarg runPreReadyCoordinator():Promise<void> awaits it.
Neither takes/returns a handle, record, callback or option. Both slots spend before
await; genuine native entry/adoption/one-shot guards remain. No import startup/raw
adopter; source-selection and selected native ABI fix the exact ownership route.

## Finite branch and TEST cleanup

The fixed O branch has a nonrenewing90000ms construction budget from synchronous
reservation, including both builds and lock waits. Existing30s/5s compiler bounds
remain unchanged. Earlier cancellation is not permission to exceed the lock-wait
upper bounds. On normal adoption plus all required independent observations, or
its own build/observation/protocol/deadline failure, O cooperatively cancels via
its existing owned channel and follows the original nonrenewing5s settlement.
Native CANCEL/HUP handling must continue during nonblocking LOCKING waits.

TEST finally preserves the first external-observer/assertion failure and awaits
this automatic O path, actual child/stdio/input closure and original deadlines.
TEST gets no cancel handle/command/signal, private reader, unref or detach. Missing
closure retains real owned records/resources and remains uncertainty; no forced
exit, kill, unlock or synthetic EOF. An actual stuck producer is not a passing case.

O may return naturally with exitCode0 only for successful finite construction,
genuine adoption/observations and verified cooperative closure of its actual
owned records. Inner CANCELLED construction remains CANCELLED, not workflow
success. Other failures retain the first existing error; exitCode1 is allowed
only after actual owned closure. Uncertainty cannot force process exit. Tests
must additionally observe actual O close and stdout/stderr EOF; a record cannot
prove its producer's own exit or output EOF. No `process.exit()` shortcut.

Normal expected cancellation has EXACT inner SETTLED body
`{state:'work-terminal',failure:'DEC203_SUPERVISOR_CANCELLED'}` and C TERMINAL body
`{state:'drained',failure:'DEC203_SUPERVISOR_CANCELLED',exitCode:0,signal:null}`.
Normal O local-terminal has state closed, failureCode DEC203_SUPERVISOR_CANCELLED,
actual ownerWait exitCode0/signalnull, input eof, ownerInput/commands finished and
ownerStdout/ownerStderr/events eof. Actual O exit0/signalnull and stdout/stderr EOF
remain TEST observations, not fields that O may predict. No null alternative or
uncertain/error tuple passes this positive control; cancellation is never erased.

## Closed read-only stdout records

O is the sole stdout diagnostic writer. Use strict UTF-8 JSONL: one complete
object followed by LF, no banner, partial-record acceptance or truncation. Each
record has EXACT keys `{v:1,bootstrapId,seq,kind,body}`; ID is the actual private
BootRecord ID, diagnostic seq canonical positive u64 decimal starting1/increment1.
Diagnostic seq is distinct from each native direction's seq. Max65536 encoded
bytes including LF per record,256 records and1048576 bytes total per invocation.
Unknown/extra keys, invalid UTF-8, missing/duplicate/gapped IDs/sequences, excess
counts/bytes or malformed records irreversibly fail evidence; no dropped records.

Numbers below are safe nonnegative integers unless stated. PID/PPID/session are
positive; `startTime`, device/inode and file positions are lossless canonical
decimal strings. SHA256 is lowercase64hex. Artifact EXACT keys are
`{path,sha256,device,inode,size,mode,uid}` from the actual fixed observation.
Process EXACT keys are `{pid,ppid,startTime,session,uid,executable}` with executable
that Artifact. Paths/hints/data are not capabilities; TEST derives actual owners
and opens/stats/hashes actual resources independently while the premise is live.

The closed union of kinds and EXACT body keys is:

| kind | body |
| --- | --- |
| artifact | `{phase,role,artifact}`; phase owner/lease; role node/compiler/source/support/header/output, from that phase's fixed source closure only. |
| process | `{role,process}`; role owner-compiler/owner/coordinator/lease-compiler; actual bracketed owned ancestry, never caller PID metadata. |
| inventory | `{phase,process,fds,locks}`; phase owner-leased/coordinator-precompile/lease-compiler-live/coordinator-adopted. Complete actual FD table, not filtered expected entries. |
| compiler-terminal | `{phase:'owner',process,exitCode,signal,stdout,stderr,session}`; stdout/stderr eof/error/pending, session absent/present/unavailable. Only O's actually retained owner compiler; no invented ownership of I's compiler wait/streams. |
| frame | `{direction,frame}`; direction O_TO_C/C_TO_O, exact original native envelope. |
| local-terminal | `{state,failureCode,ownerWait,input,channels}`; state closed/uncertain; failureCode null or existing full DEC203_SUPERVISOR_ token; ownerWait null or exact `{pid,startTime,exitCode,signal}`; input eof/error/pending. |

Two closed fixed-recipe compiler starts accept genuine workspace keys only and
return synchronously a frozen mechanical actual-child/stream/cached-settlement view,
not a lease owner or wire DTO. Keep pending/fence/state private; original drain and
final predicate start immediately. Attach wait/end/error/close before yielding;
close alone is not EOF. No selectors, extra data reader or expanded signal permission.

Wait exitCode is integer or null; signal is existing signal name or null, never
both nonnull. `channels` has EXACT ownerInput/ownerStdout/ownerStderr/commands/events;
ownerInput/commands are finished/error/pending; other channels eof/error/pending.
These are O's retained child/channel facts, NOT O's own stdout EOF or own exit.
Uncertain requires nonnull failureCode. No passed/drainProven/ready capability flag.
failureCode uses only the existing DEC203_SUPERVISOR_ prefix plus REFUSED, CANCELLED,
IDENTITY_CHANGED, UNAVAILABLE, PROTOCOL, HISTORY_GAP, TIMEOUT, FAILED or DRAIN_UNCERTAIN.

Inventory fds is sorted unique by fd, max64, with EXACT per-entry keys
`{fd,target,device,inode,mode,uid,gid,flags,pos,pidfd}`. flags is canonical octal
prefixed0 (zero exactly0); pidfd is null or exact `{pid,nspid}`, pid integer≥-1,
nspid an array≤16 of positive integers. Every observed descriptor is included.
target≤512 bytes, no NUL/CR/LF; only fixed profile inputs, actual owned-root paths,
/dev/null, or kernel pipe/socket/known anon_inode targets may be emitted. Unknown
targets refuse without logging their text; no arbitrary file content is read.
locks is sorted by fd, max4, with EXACT `{fd,ownerPid,mode,device,inode,start,end}`;
fd3–6 only, mode READ/WRITE, start exactly'0',end exactly'EOF'. These encode actual
FLOCK fdinfo plus matching /proc/locks observations, not generic OFDLCK metadata.
Process/FD identities, full enumeration and actual image/start/ancestry are
rechecked around snapshots. Races/inaccessibility retry only within the original
live record/budget; missed live/compiler evidence fails, never a partial table.

Publish frame records only for completely written O→C frames and fully validated
C→O frames; preserve their original envelope/direction/seq/body. Never manufacture
an inner HELLO/SETTLED/FINISH/F_GETFD event as an outer observation. Normal branch
outer sequence is HELLO,INIT,LEASE_READY,START,ADOPTION_ACK,CANCEL,CANCEL_ACK,TERMINAL;
RUN_READY/RUN_ACK are forbidden. Failure records cannot fabricate absent stages.

PR02/03/04 use producer-mediated native ADOPTION_ACK/CANCEL_ACK/TERMINAL prerequisites
plus independent actual process/FD/resource facts and source-reviewed native gates.
Inner SETTLED→FINISH and native F_GETFD remain mandatory actual implementation
gates, but TEST must NOT claim it directly observed those frames/syscalls. A bare
diagnostic bool/receipt or matching DTO never establishes the native premise.
Live GCC complete FD observation must occur BEFORE actual native I HELLO/adoption;
delivered stdout ordering alone proves no live timing or independent observation.

Reserve bounded output storage before enqueue; process native protocol/cancellation
independently of stdout backpressure. Error/overflow/lost evidence irreversibly
fails with existing PROTOCOL/HISTORY_GAP mapping and triggers cooperative close,
not native admission or a TEST ACK. O must keep cancellation/FINISH progressing
without waiting for diagnostic drain. Unproved stdout delivery/closure at original
5s settlement is uncertainty, never a partial successful transcript. TEST drains
bounded stderr separately without using raw stderr/env/plan/payload as evidence.
Numeric fd facts are non-authoritative process-local observations, not transferred
descriptors or usable handles. No descriptor transfer, opaque object, raw secret
or arbitrary error/stack is emitted or accepted as input/adoption authority.

This addendum releases no source/runtime. Native addon ABI and final source/helper
closure still require their own reviewed selection before production GREEN.
