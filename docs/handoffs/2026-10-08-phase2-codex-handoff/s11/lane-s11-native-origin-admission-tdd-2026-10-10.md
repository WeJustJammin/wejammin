# Slice11 native origin-admission contract / QA gate

Baseline: `748bbd4def52e078f87631fcb1f9053e37c8773c`, clean/exact origin.
Active checkout `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`,
branch `claude/phase2-slice11`. Slice11 remains0/122. Everything below is
UNRUN. Root saves a clean pushed contract checkpoint before native writes.

## Selected bounded contract

An origin proof is a read, not a claim, current-attempt admission, plan lease,
heartbeat, stage authority, result, processed-event receipt or ACK.
Original outbox eight-field identity stays immutable when Job.version advances.
Ordinary dispatch stale rules remain unchanged during this bounded step.

Existing service-only `cms_get_schema_migration_plan(p_request jsonb)` gains
one additive read-only branch: strict `{ requestedEvent }`; response is a
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
equals requestedEvent. Also prove stored event job.requested/1/job,
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
for requestedEvent, pipe through strict object with the guarded event schema,
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
