# Slice11 native origin-admission contract / QA gate

Last clean QA baseline: `2f4f55f2db768aed3261dbe6234ed293d1605a16`.

## Corrected producer proof / verifier mutation receipts / SQL gate

Disjoint correction from clean refutation checkpoint12709db9 is now actual:
request17/unit372/77cases/verifier22/SQL142/API345/57cases. Original request,
verifier, SQL origin prefix and unit76/API56 oracles byte-exact after private-
key mapping plus sole explicit refusal additions. All18 pre-origin paths exact.
Actual unit77/77GREEN1.32s and separate contracts/db-types/progress/format/lint/
project type-check/diff0. Actual three SQL suites143 assertions PASS and seven
API suites135/135GREEN91.05s; pre/SQL/API/post exits0/0/0/0, all23SHAexact.
Existing missing-claimedJob refusal and two/three-key behavior remain intact.
Independent amendment reviews no bounded finding; wording residue corrected.

This is origin-only local proof, not stage/race/receiving/ACK authority or hosted
Auth/fullValidation/Slice11 acceptance. Root saves clean pushed proof checkpoint
before source mutants at9753ca21e1d33aac0251559065aba2ccb7a7124b. All8 verifier
mutants are now caught, each followed by exact23-SHA restore and actual77GREEN
control. Four SQL-origin-source mutants remain UNRUN.
Keep every QA/other-source path frozen; mutate only the selected producer
temporarily. Stored Jobcorr/cause/payload predicate removal is not independently
proven by consistent genuine fixtures; do not corrupt protected stored rows.

### Actual verifier mutations; exact SQL mutants still UNRUN

Actual failed/passed counts, total77 each: O1 8/69; O2 18/59; O3 18/59;
O4 18/59; O5 17/60; O6 1/76; O7 1/76; O8 17/60. Decisive unit assertion
lines respectively208/109/110/98/93/237/226/85. Each actual restored control
77/77, exit0; each mutation exit1. FreshCI0/flock before every run, all22
other-source hashes exact under mutation and all23 exact before controls.
No QA edits or active mutant. Pure unit runs require no DB reset.

Tracked receipts: origin-admission-mutation-receipts-2026-10-10.json beside
this brief; ignored execution logs .lane-logs/parent-s11-origin-verifier-oN-
20261010.log and oN-control-20261010.log, N1–8. Root captured historical
preflight/hash fields; independent log review must not imply historical source
hash reconstruction. These mutations prove only their named unit assertions.

Independent16-log review found no bounded receipt mismatch: counts, assertions,
locations, CI flags and durations match. O6 reaches its false-result assertion
before its no-call assertion; no separate no-call-only witness inferred.
Fresh restored verifier77/77GREEN1.32s and bounded contracts/db-types/progress/
format/diff0 before canonical checkpoint; SQL4 remain UNRUN.

Verifier-only, one at a time, same frozen77-case QA; restore before77GREEN control:

1. O1: return Boolean(response), not response === true — truthy reply refused.
2. O2: pass { ...parsed.data } — root freeze fails; event remains frozen.
3. O3: pass Object.freeze({ originEvent: { ...parsed.data.originEvent } }) —
   root freeze passes, independent event freeze fails.
4. O4: pass new AbortController().signal — exact invocation signal fails.
5. O5: second raw readPlan call before return — one-call cardinality fails.
6. O6: omit prefix signal.aborted refusal — already-aborted call/result fails.
7. O7: catch raw rejection and throw a new Error with same controlled message —
   Boolean rejection-object identity fails, one call remains.
8. O8: Object.preventExtensions(envelope) after successful parse — caller
   extensibility fails without changing descriptors/prototype/frozen flags.

SQL-origin-only, one at a time; use actual genuine targeted RED then restore
before full57-case origin GREEN control, with actual pre/post DB resets:

1. S1: j.job_type is not null replaces CMS type equality — genuine non-CMS false.
2. S2: tuple jsonb object is not null replaces equality — crossed/five mismatch
   oracles; absent aggregateId remains false. Grouped comparison proof only.
3. S3: if false replaces fixed-pair grammar guard — wrong pair reaches lookup
   and200/false instead of400/INVALID_REQUEST; other scalar/UUID guards remain.
4. S4: add j.version = e.aggregate_version — queued true first, postclaim false;
   first failure prevents independently observing later heartbeat/outcome here.

Keep existing two/three-key suffix/header exact. No new QA assertions weakened,
protected stored-row edits, grants, owner changes or current authority claims.
Active checkout `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`,
branch `claude/phase2-slice11`. Slice11 remains0/122. Receipts below are scoped;
historical UNRUN/refuted snapshots below do not supersede this top proof gate.
Root checkpoints before SQL mutation writes.

## Compatibility refutation / selected disjoint-key correction

First producers are verifier22/SQL142. Actual unit76/76GREEN1.32s;
origin API56pass/0fail. However full seven-suite regression is1failed/133passed
(134),88.29s, pre/test/post0/1/0: existing missing-claimedJob QA produces exactly
one-key requestedEvent, which the new origin branch incorrectly admits.
Both prior static compatibility conclusions are refuted. Byte-identical
two/three-key suffixes did not preserve request-admission behavior.

Keep the existing refusal/assertion unchanged. Selected correction: origin-only
uses the disjoint one-key originEvent; claimed reader remains claimedJob plus
requestedEvent, legacy reader its unchanged three keys. Old one-key
requestedEvent and mixed origin/claimed/legacy forms remain INVALID_REQUEST.
No RPC/signature/grant/owner/policy change. After clean pushed refutation
checkpoint, native A may amend ONLY origin request/unit/verifier files; B may
amend ONLY origin API and18700 origin branch. All18 pre-origin frozen paths
remain exact. Preserve every existing oracle; add explicit legacy-key refusal
to new contract/API QA. All corrected tests/producer results remain UNRUN.

## Selected bounded contract

An origin proof is a read, not a claim, current-attempt admission, plan lease,
heartbeat, stage authority, result, processed-event receipt or ACK.
Original outbox eight-field identity stays immutable when Job.version advances.
Ordinary dispatch stale rules remain unchanged during this bounded step.

Existing service-only `cms_get_schema_migration_plan(p_request jsonb)` gains
one additive read-only branch: strict `{ originEvent }`; response is a
literal JSON Boolean. No new RPC, signature, EXECUTE/table grant, role,
membership, owner or bypass exemption. Existing strict two-key claimed resolver
and three-key legacy reader retain their contracts.

The eight event fields are exactly eventId, eventType, schemaVersion,
aggregateType, aggregateId, aggregateVersion, correlationId and causationId.
Grammar matches the existing canonical QueueEnvelope: job.requested/1/job,
canonical lower-case non-nil UUIDs, positive signed-bigint decimal-string
aggregateVersion, causationId UUID or null. Malformed/extra/missing keys are
INVALID_REQUEST before lookup; do not fabricate claimedJob facts to reuse a
two-key validator.

After service identity and bounded grammar admission, return true only when
the actual Job rooted at aggregateId is cms.schema.dry_run and its actual
originating_event_id joins the stored outbox row whose whole eight-field tuple
equals originEvent. Also prove stored event job.requested/1/job,
aggregate/job id, Job correlation/causation, and stored payload jobId/jobType
binding. A well-formed mismatch or absent Job returns false. Dispatch status,
current Job.version/state/lease, and current report/plan are not origin identity.
A correct original event therefore still proves origin after a genuine claim,
heartbeat or queued outcome. This never permits execution by itself.

No row lock, advisory lock, table mutation, attempt/lease/outbox dispatch update,
job creation, report sealing or active-schema switch in the origin branch.
The existing STABLE claimed snapshot remains unchanged.

## Native contract and unit QA

A owns only these two new paths:

- apps/worker/src/content-schema-registry/schema-dry-run-origin-request.ts
- apps/worker/src/content-schema-registry/schema-dry-run-origin-verifier.test.ts

Contract source exports CmsSchemaDryRunOriginRequestSchema plus inferred
CmsSchemaDryRunOriginRequest type. Reuse existing requireClaimOwnKeys and
ClaimRequestedEventSchema from schema-dry-run-claim-shape: own-key root guard
for originEvent, pipe through strict object with the guarded event schema,
then transform(Object.freeze). No new public contract or synthetic claimedJob.
Do not wrap raw QueueEnvelope directly: its non-aborting decimal regex can
reach BigInt on malformed input; readonly can freeze rejected caller arrays.
Existing aborting own-shape/CmsVersion guards must run before that parser.

The UNWRITTEN producer will be
schema-dry-run-origin-verifier.ts, exporting
createCmsSchemaDryRunOriginVerifier({ port: MigrationWorkerPort }) and an
object with verify(envelope: unknown, signal: AbortSignal): Promise<boolean>.
It validates before RPC, refuses malformed/non-job envelopes without a call,
calls readPlan once with the parsed frozen one-key request and the exact
invocation signal, and accepts only response === true. False and every other
response shape return false; RPC rejection propagates unchanged, never true.
An already-aborted signal returns false without RPC.
No claim facts or synthetic schema-activation event; no input mutation.

Tests: literal true/false; non-Boolean adversarial response matrix; exact
one-key/eight-field request; independent frozen root/event checks; original
field values; exact signal identity; one call; malformed root/fields/version/
UUID/ninth-field and wrong event/schema/aggregate pairs; already-aborted signal.
Malformed input, including decimal 1.2 and root/event arrays, must not throw,
must return false without RPC, and must preserve rejected caller descriptors,
prototype, extensibility and frozen state. Cover objects as well as arrays.
For RPC rejection catch a sentinel and assert Boolean caught === sentinel
plus one call; same-message toThrow is insufficient. Do not use the error-
normalizing MigrationWorkerRuntime.call to stand in for the verifier.
Use Boolean reference assertions for signal/input identity; no token-bearing
raw object diff. Contract <=100 physical lines; unit spec <=400. Producer
intentionally absent for the initial RED receipt.

## Native genuine API QA

B owns only this new path:

- tests/postgrest/phase-02-slice-11-origin-admission.apispec.ts

Use existing prepareClaimAttempt, claimAttempt, originalEvent, observeRead,
selectJson/selectText, safe assertions and protected callRpc helpers. Do not
edit the frozen helpers/specs. Inspect their complete relevant source first.
Actual public draft and CMS03A10 queue acceptance are required; no hand-built
Job/report/outbox/plan rows or fake replies.

Prove exact original queued event returns200/true with unchanged stored
projection and observeRead27-table census. Then actual claim, Boolean
heartbeat and lease-aware queued outcome using genuine current parsed server
version/expiry and retained token: require each actual heartbeat/outcome reply
to be literal true, then observe canonical poststate/version/expiry before
the origin read. A no-op setup must fail. Each original event still returns
200/true and each origin read itself is independently mutation-free. Never
compute version+1 or expiry, rewrite the event version, steal a lease, or
expose tokens in an assertion.

Use actual second accepted Job/event for crossed provenance, plus independent
well-formed mutations of the eight stored tuple members where grammar permits;
these return200/false and no mutations. Invalid pair/scalar/UUID/version,
missing/extra/ninth fields or root keys return400/INVALID_REQUEST and no effects.
Do not classify a whole legitimate second originating event as foreign.
Also accept a genuine registered non-CMS platform.job.execute through the
existing protected acceptance API, then submit its correct whole originating
event: require200/false with unchanged projection/census. This must kill a
removed CMS job_type predicate; two CMS Jobs alone cannot prove exclusion.
Unauthenticated/non-service denial must retain existing service-only ACLs.
Read-only origin says nothing about superseded report/current-attempt authority.
Spec <=400 physical lines, no helper edits. Actual replies/assertions only.

## Reviewed QA freeze / bounded producer gate

Contract checkpoint a5ef923d32d7847821a16994fe07605d336fbc40 was clean/pushed.
Native QA is now frozen: request17, unit371/76 planned cases, API338/56 cases.
Actual amended unit initial import RED executes no cases; project type check
has only the expected missing-verifier TS2307. Genuine API initial RED is
8 failed/48 passed,39.71s, with actual pre/test/post exits0/1/0. Passed existing
grammar/ACL refusals are not origin-branch proof. Format/lint/diff pass and all
18 old source/QA SHA match. Independent reviews: MAX positive added; no other
bounded QA finding. No GREEN, receiving or Slice11 acceptance claim.

After root saves a clean pushed QA checkpoint, freeze all21 old/new QA paths.
Native A owns ONLY new schema-dry-run-origin-verifier.ts under the same worker
directory (<=100 lines): use frozen guarded request schema and direct raw port,
with the exact verify API above. No receiving/runtime/dispatcher edits.
Native B owns ONLY new migration
supabase/migrations/20261005018700_cms_origin_admission_reader.sql (<=300 lines).
CREATE OR REPLACE only the existing private cms_get_schema_migration_plan body:
add the strict one-key service/bounded-grammar origin branch above; retain
existing two/three-key branch bodies byte-for-byte, owner/signature/grants and
their behavior. Reuse existing worker admission; validate all event own keys,
JSON scalar types, fixed pair, canonical UUIDs and decimal signed-bigint range
before lookup/casts. Return literal JSON Boolean from actual Job/outbox join
and complete immutable binding; no current version/state/lease/report filter.
No new function signature/helper/RPC/grant/owner/role or SQL authority change.
Native source reads/apply_patch only; root retains actual commands, resets,
formatting, source review, mutations, canonical flush/compile and Git.

## Receiving research retained, not yet selected or implemented

Existing consumer finalizes against its initial claim version, records queued
outcomes processed, and async handling then ACKs them. Signal/attempt are not
forwarded. Existing ordinary stale-event comparison rejects unchanged original
events after Job.version advances. These are later integration boundaries.

Grant-free enduring-fence candidate: existing invoker guard_jobs and existing
CMS-owned stage bodies share a code-owned transaction advisory key. BE00
mutators take Job-row then advisory; stages take advisory then legal CMS locks
and never row-lock/update Jobs. All four Job mutators require fresh server time
after waits; trigger-only locking is insufficient. Preserve Boolean/no-row
refusals, actual token/version, ordinary non-CMS behavior, all owners/signatures,
global CMS order, and STABLE snapshot. No new grants or privileged helper.

Existing Boolean heartbeat plus genuine canonical read and strict resolver
can reconcile actual operational version/expiry/token without a new RPC.
Immutable initial claim evidence remains separate. Reclaim between reads
refuses; stage/final CAS supplies enduring authority, never the read alone.

Missing/malformed stage context cannot select an unguarded preparation path.
Server-derived historical/actual activation classification is still under
source review; context absence, GUC flags and caller purpose are not authority.
No stage/advisory/heartbeat/origin admission wiring starts in this QA wave.

BE00 already fixes shared states, four deliveries, 15/60/300s retries, sanitized
six-key summaries, immutable result pointers and post-accept terminal domain
recovery. No shared blocked or novel automatic recovery. CMS report Code and
closed owning-domain error mapping remain implementation choices, unselected.

## Ownership and verification

Root: commands, formatting, source review, actual RED receipts, CI0/shared
flock/main54322/API54321 resets, hashes, Git, artifacts and canonical flush/compile.
Native A/B: pure fs/path source reads and native apply_patch of sole claimed
paths only; no commands, Git, runtime imports, DB/network/secrets, formatters,
nested agents or other writes. Freeze and report line counts; release claim.
No author self-report establishes execution or acceptance.

Initial unit import RED and actual API INVALID_REQUEST must be reported as
such, not functional GREEN. Save clean pushed checkpoint and refresh the live
Claude handoff at every checkpoint. Producers require a later explicit scoped
write wave after independent QA review and actual RED.
