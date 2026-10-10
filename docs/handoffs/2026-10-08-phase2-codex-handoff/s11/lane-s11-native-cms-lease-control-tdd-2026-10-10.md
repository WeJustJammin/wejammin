# Slice11 private CMS Job lease-control TDD contract

## Status and boundary

Derived operational contract; QA and producer UNRUN. Receiving-origin QA currently
owns only its new test file. This document releases no additional author claim.
Root6.1/ultra owns commands/Git/DB/canonical memory. Native6astra/high authors
start only from a later clean pushed exact-origin checkpoint. S11 remains0/122.

BE00 platform.job.execute requires heartbeat before one-third lease remains and
current Job.version CAS (00-infrastructure.md552). Current consumer79–105 always
uses initial post-claim lease.version; heartbeat SQL492–515 increments version
but returns Boolean. Therefore later final CAS must use a separately observed
actual server version, never arithmetic. No new Job type/RPC/grant/role/wire
field/security mode/error/recovery policy selected.

Canonical reader357–377 deliberately omits token. Boolean true plus a later
same-id/type/running snapshot cannot prove continuous ownership after expiry and
foreign reclaim. This control exposes candidate operational facts, NOT enduring
ownership or stage permission. Every CMS mutating boundary still requires an
atomic SQL check of actual original token, current version, native live expiry,
origin/plan/report binding, restore fence and fresh post-lock clock. Final Job CAS
already checks token/version/expiry. Do not add token disclosure/new authority or
claim that this control alone closes the separate unselected stage-fence work.

## Private contract

Leave JobEffectInput, original job/envelope and initial claimedLease references
untouched. Builder requires claimedLease.expectedVersion === job.version
(schema-dry-run-claim-input.ts28); claimedLease.version is post-claim, not the
pre-claim expectedVersion or envelope origin version.

Add readonly internal types in runtime-types:

```ts
type CmsLeaseCheckpoint =
  | Readonly<{
      kind: 'current';
      claimedJob: Readonly<{
        jobId: string;
        version: string;
        leaseToken: string;
      }>;
      leaseUntilMs: number;
    }>
  | Readonly<{ kind: 'lost' }>;
type CmsLeaseControl = Readonly<{
  checkpoint(): Promise<CmsLeaseCheckpoint>;
}>;
```

The name current means observed metadata only; each returned object must be a
fresh frozen snapshot, never a mutable receipt reference.

JobEffectPort.execute accepts optional second CmsLeaseControl argument.
JobConsumerInput adds optional private leaseNow():number and optional
heartbeatJobLease port using existing JobPersistencePort signature. Runtime
threads its existing trusted injected now callback, not another Date.now or
frozen input.nowMs. Production dispatcher conditionally forwards second argument
ONLY to CMS preparation when control is present; absent control retains exactly
one argument (never append undefined). Ordinary verification/provider effects
retain exactly one argument even if caller supplied control. This foundation does
not wire a production CMS prep callback or
thread checkpoints into CMS stage execution.

Construct control ONLY when verifiedImmutableJobOrigin===true, actual canonical
job.type==='cms.schema.dry_run', and eventJobType clamps that exact CMS type.
Missing fresh clock/heartbeat capability or invalid actual initial receipt =>
retry lease_conflict before any effect/outcome/processed call. Non-CMS or legacy
unverified paths retain existing one-argument behavior, no new clock/HB/read calls.

Implement controller in a separate small private module, not consumer sprawl.
Validate initial acquired receipt matches canonical id, original lease token and
pre-claim canonical version; actual positive post-claim version is greater than
pre-claim version; finite actual expiry beyond fresh finite clock. Preserve all
initial references and descriptors.

checkpoint acceptance linearizes at invocation before close. Accepted queued
checkpoints serialize and finish despite close. Permanently latched lost => lost
with no further I/O. Calls after close return lost with no I/O and do not poison
the internal lease-loss latch. Finalization drains accepted work, inspects private
health, and never calls the closed public checkpoint for final status. No heartbeat
may run after final CAS. Before I/O reject known expiry or invalid/throwing fresh clock. Recheck
restore fence once at checkpoint start before its heartbeat/read sequence;
closed restore or reader error latches
lost. Use existing heartbeatJobLease helper and exact one-third threshold:
tracked actual post-claim version, acquired original token, tracked actual expiry,
existing leaseSeconds and fresh now. Require actual response Boolean, never truthy
coercion. False/throw/nonboolean/reject => lost; unknown transport may have applied
and cannot be ACKed as manual review.

After renewed Boolean true, invalid/throwing fresh clock latches lost before any
further I/O. With valid fresh clock, read canonical Job even when OLD tracked
expiry elapsed during the heartbeat wait: successful renewal changed expiry,
so the old expiry is not known current expiry. Require exact id/CMS type/running,
positive actual decimal version strictly greater than tracked previous version
(no +1 assumption), finite non-null native expiry beyond another fresh clock.
For not_due still read canonical and require unchanged tracked version, unchanged
actual expiry and live expiry beyond fresh clock. Wrong/missing state/identity,
malformed/nonadvancing version, expiry loss or reader exception latches lost.
Keep acquired token; do not claim canonical read proves it. Store only validated
server-returned version/expiry for next heartbeat and final CAS.

Consumer captures effect success/throw, then closes control to new requests and
drains all already accepted checkpoints BEFORE effect-error/manual-review handling
or final CAS. A final fresh clock must still show tracked lease unexpired.
Lost/unknown/expired overrides even terminal/manual-review/throw result: existing
retry lease_conflict/acknowledge:false, zero outcome/processed writes. Healthy
manual review/throw preserves existing policy; healthy final CAS uses tracked
actual server post-claim/renewal version and acquired token. Existing queued
outcome has no processed marker/ACK; terminal processed barrier unchanged.
No adapter can set receipt, clear lost, resume a closed control or bypass CAS.

## Next native TEST-ONLY claim, not yet released

Only three new paths: packages/application/src/infrastructure/jobs/consumer-cms-lease-control.test.ts,
packages/application/src/infrastructure/jobs/consumer-cms-lease-control-test-support.ts,
and apps/worker/src/production-job-effect-dispatcher-cms-lease-control.test.ts.
Each target<=350lines/hard400 after Prettier. Use actual executeJobDispatch,
actual production dispatcher and existing helper types. Helper extraction must
not weaken or outsource assertions.
Future leaseNow/heartbeat/private-origin properties on a structural input variable
compile against current source. Optional second callback parameter can use a
file-local structural control type; no nonexistent import/type failure as RED.
No any/asT, sleeps, commands, production edits, docs/memory/Git/network/DB.

Causal witnesses, with exact args/order/counts and no early writes:

1. Due renewal: pre-claim7/post-claim19, actual reread37; heartbeat expected19,
   original token/expiry/clock exact; final CAS37, never7/19/20/38.
2. Two sequential and overlapping requests: second renewal uses actual first
   reread version/expiry; no concurrent stale heartbeat calls. Deferred heartbeat
   and canonical-read barriers show effect return cannot cause early CAS. Two
   accepted requests still drain after effect return/close; a later retained call
   returns lost without poisoning healthy CAS using last observed version.
   Also deferred true renewal may cross old expiry300000 while actual reread
   returns37/expiry600000 still live; healthy CAS37 must remain possible. Invalid
   fresh clock after true renewal instead loses before the canonical read.
3. Not_due: zero heartbeat, actual canonical validation, final CAS19.
4. False/throw/nonboolean heartbeat: terminal, pending_manual_review and thrown
   effect each retry; zero outcome/processed; later checkpoint does no I/O.
5. Null/foreign id/wrong type/state/invalid or nonadvancing version/null or
   expired expiry/changed not_due version or expiry/read exception independently
   latch lost. Fresh clock/restore loss after deferred boundary also closes.
6. Missing clock/HB, invalid initial receipt or known initial expiry: no effect.
7. Frozen initial job/envelope/claimedLease retain exact references/descriptors
   and same claim-builder result after renewal; checkpoint snapshots independently
   frozen. Late retained checkpoint after outcome performs zero I/O.
8. Direct exported decideJobDispatch control, not only consumer: valid frozen
   object.verify binding/eventJobType, private verifiedImmutableJobOrigin=true,
   envelope7/current11 exact stale skip and envelope7/current3 exact future retry.
   This independently kills dropping core actualCMS-type predicate even when
   consumer clamps forwarding. Use structural variable, no cast/nonexistent API.
   Direct ordinary non-CMS consumer with private origin flag true preserves both stale
   incoming7/current13 ACK and future incoming23/current13 retry, zero claim/
   effect/HB/outcome/processed writes. This kills dropping actualCMS-type guards
   in core version comparison, unlike receiver tests that never inject that flag.
   Healthy ordinary non-CMS with private flag true: one effect argument, no CMS
   control/HB/new canonical or restore reads. Legacy unverified CMS likewise.
9. Healthy renewed queued result: actual version CAS; no processed marker.
   Healthy renewed terminal result: deferred processed write before completion.
10. Token-blind foreign-reclaim metadata is not asserted as ownership: demonstrate
    old token remains in outcome operands and a false final CAS produces no
    processed marker. This is not proof of actual CMS stage rejection.
11. Actual dispatcher passes exactly input/sameControl to CMS callback with
    unchanged dependency receiver; absent control passes only input; both object
    aliases still receive only input even if dispatcher was supplied control.
    Use structural optional-argument variable typing against current producer,
    not a nonexistent API/type error as RED.

Root runs functional RED, exact-change/source-only refutation and freezes QA before
a separately scoped native producer. No test schema/title/security weakening.
Full db:verify then validate remains mandatory; a focused green is not acceptance.

## First63 actual RED / controlled assertion amendment

Actual32 application/31 Worker,54failed9passed; application404/support346/Worker291.
Lint0; combined types2 is receiving cancellation global typing, separate lane.
After clean pushed exact-origin checkpoint only same three QA paths may change.
Preserve every existing title/operand/assertion/history; mechanical helper/case
extraction between these files permitted, acyclic, each formatted hard400
(target350). Do not shorten by deleting assertions or hiding source in strings.

Independent source review requires four narrow additions before producer:

1. Three effect-outcome rows: accept an unawaited deferred checkpoint, immediately
   return succeeded/manual_review or throw; pending HB later resolves false.
   Explicit barrier races prove delivery still pending before release; afterward
   exact retry/lease_conflict, no outcome or processed writes. Existing await-before
   return loss cases remain. Add final-expiry manual_review/throw rows (succeeded
   already exists), requiring lost precedence and zero persistence.
2. Strengthen existing not_due case to two checkpoints at same valid facts19/
   expiry301000: distinct outer and claimedJob identities, both levels frozen for
   both; exact two restore/read sequences, zero heartbeat, final CAS19.
3. Add initial valid positive receipt version6 below preclaim7, all other fields
   valid; retry before effect/outcome/processed calls. Equality7 case remains.
4. Isolate construction eventJobType clamp: verified=true, canonical CMS,
   matching envelope/current version, omitted eventJobType. Existing legacy
   dispatch behavior without control/extra clock/HB/read; wrong-type binding
   refusal is not this witness. Omit through a structural input variable, no cast.

Expected70 executed cases if additions use seven new rows; root independently
counts actual cases. Restore reread once at checkpoint start, not after each I/O.
No enduring stage-authority proof/production change/acceptance claim.
