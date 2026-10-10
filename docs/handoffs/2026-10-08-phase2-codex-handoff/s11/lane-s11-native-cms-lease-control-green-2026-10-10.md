# Slice 11 operational CMS lease-control GREEN producer scope

Status: derived implementation shape, claims UNRUN. Root first completes current
origin/queued fixture gates and clean pushed checkpoint. Native gpt-6-astra/high;
root gpt-6.1-sol/ultra owns commands, integration, canonical writes and reviews.
Read complete lease-control TDD brief and all70 frozen cases/support; original
receiving24 and queued7 foundation remain frozen except root-selected amendments.

## Author A — application three paths

Only packages/application/src/infrastructure/jobs/runtime-types.ts,consumer.ts,
and NEW cms-lease-control.ts. No execution.ts/index/QA/schema/SQL edits.

Add readonly CmsLeaseCheckpoint current/lost union and CmsLeaseControl checkpoint
interface exactly as selected TDD brief. Optional second execute argument retains
legacy one-argument calls. Add optional private leaseNow callback and heartbeat
capability to JobConsumerInput while preserving all existing persistence methods.
Existing barrel type exports already cover runtime-types; no index mutation.

Small private controller module owns validated actual receipt, original acquired
token, fresh clock, serialized checkpoint queue, admission close/drain and health.
No production role/lease/token ownership claim from tokenblind canonical metadata.
Factory validation failures return lease_conflict before effect/outcome/marker:
only literal private true + actual canonical CMS + eventJobType CMS constructs it.
Missing capability/clock, invalid id/token/preclaim equality/positive strictly
advancing actual postclaim version or non-live finite expiry fail closed.
Reuse existing schemas/helpers; never mutate initial input/receipt/references.

checkpoint acceptance linearizes invocation before close; accepted work serializes
and finishes despite close. Public calls after close return lost with zero I/O,
without poisoning private health. Permanently latched loss performs no further
I/O. Before each I/O use fresh finite nonnegative clock/known-current live expiry;
restore reread once at checkpoint start before its HB/read sequence.

Use existing heartbeatJobLease helper/one-third threshold, wrapped strict raw
Boolean persistence validation (helper itself historically treats truthiness;
do not change its ordinary semantics). Exact acquired token/tracked version/
expiry/existing leaseSeconds/fresh time. False/throw/reject/nonBoolean => lost.
After true renewal valid fresh clock permits canonical read even if OLD expiry
crossed during HB wait: renewed actual expiry is not yet known. Invalid clock
stops before read. Validate returned exact id/CMS/running, positive version
strictly greater than previous, finite actual native expiry beyond fresh clock.
not_due still reads canonical, requires unchanged version+expiry and live time.
Any wrong/missing/malformed/reader/restore/clock result latches lost.
Every current result is fresh independently outer+nested frozen metadata.

Consumer creates one original JobEffectInput with unchanged job/envelope/
claimedLease references/descriptors; CMS gets exactly input/control, ordinary
and unverified legacy exactly input. Capture effect success/throw then close/drain
BEFORE manual-review handling or final CAS. Final fresh clock/live expiry required.
Lost overrides succeeded/manual-review/throw to retry/lease_conflict with no
outcome/processed writes. Healthy manual-review/throw retains existing policy.
Healthy final CAS uses tracked actual returned version and original token;
queued no-marker and terminal processed completion barriers unchanged.
Do not use closed public checkpoint to inspect final health; no HB after CAS.

## Author B — Worker two existing paths

Only apps/worker/src/async-runtime.ts and production-job-effect-dispatcher.ts.
Runtime threads existing trusted now callback as private leaseNow; no Date.now
substitute/static nowMs masquerading as fresh clock. Existing persistence already
supplies heartbeat. Origin admission/error/cancellation/terminal guards unchanged.
Dispatcher optional second argument goes ONLY to actual CMS prep callback and
only when present. Same input/control identities and dependency receiver;
absent CMS control and both ordinary aliases keep exactly one argument
(never append undefined). No production prep callback wiring or factory changes.

## Verification / unchanged scope

Root freezes both author scopes then formats, independently refutes, runs70+
receiving24/queued7 and related regression, types/lint, exact-change/old-case proof,
and db:verify then validate first-failure chain. Existing assertions never weakened.
Production modules hard300; QA hard400, target350. Authors reads/apply_patch only, no commands/scripts/
tests/format/Git/DB/runtime/network/docs/memory/settings or unauthorized extraction.
If a required cap extraction needs another file, stop claim and report before edit.

Enduring SQL stage authority, stage checkpoints/threading, registered Job result/
error/recovery mapping, environment-bound production CMS prep callback and public
lifecycle remain separate. No new grant/RPC/role/wire flag/business recovery policy,
no acceptance criterion checked and no ownership proof from metadata.
