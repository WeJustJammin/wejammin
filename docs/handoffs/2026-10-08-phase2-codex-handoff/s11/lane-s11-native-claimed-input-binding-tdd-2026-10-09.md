# Slice 11 — private claimed input/binding TDD, initial import RED

Dispatched after exact clean pushed24a5a85a. Authors froze only the two new tests.
Parent formatted344/325 lines; actual CI0/flock focused run exited1 with two
missing-module suites/no tests executed. This is import RED, not functional proof.
Independent input review identified valid19 preclaim/original and prototype
identity/inherited-scalar QA gaps. New clean pushed checkpoint precedes amendments.
See [initial RED proof](proof-s11-claimed-input-binding-initial-red-2026-10-10.md).
Original dispatch prerequisite below is historical, satisfied at24a5a85a.

Do not dispatch until distinguishing mutants3 restored/reloaded, final API76/
unit1116/static/pgTAP/catalog/lint receipts closed, canonical proof compiled,
new clean checkpoint pushed/exact origin proven. This is the next pure
contract-first seam, not production factory/queue integration or SQL authority.

Root verified BE00:491/495 durable ACK/next state, bounded retries/heartbeat;
BE03a:2305-2315 real preparation scan/nonzero backfill/verification/no switch and
plan CAS/lease. Actual consumer.ts81-86 forwards actual acquired receipt and
untouched preclaim canonical job/original envelope. runtime-types.ts63-69 receipt
five fields;124-142 optional receipt/no signal effect port. Dispatcher83-98
missing/throwing/invalid preparation -> manual review, not durable retry.
Trusted preparation factory220-230 still returns legacy methods/admission287-295
three-key read. Response.ts71 guarantees internal relations, not caller binding.
Legacy input/factory/queue/activation contracts remain frozen in this wave.

Existing Zod two-key request and strict six-part response are authoritative.
No new public DTO, purpose selector, plan-ID guessing, job/event version
arithmetic, parser/domain widening, or unbound legacy fallback. Pure functions
proposed implementation-owned contract below; no new owner decision.

A contract:
buildCmsSchemaDryRunClaimRequest(input: JobEffectInput):
CmsSchemaDryRunClaimRequest | null
New production file later: apps/worker/src/content-schema-registry/schema-dry-run-claim-input.ts.
Require explicit actual claimedLease; reject wrong exact cms.schema.dry_run type,
receipt.jobId vs canonical job.id/event.aggregateId, receipt.leaseToken vs outer
leaseToken, receipt.expectedVersion vs preclaim canonical version. Validate
existing positive signed-bigint decimal/UUID domains and finite nonnegative
receipt.leaseUntilMs; do not use it as enduring authority or alter clocks.
Use actual receipt.version unchanged, never original/preclaim version or +1.
Do NOT require original event aggregateVersion equals current preclaim version:
retry/continuation must retain original event. Do not invent narrower queued-only
state rules or new closedness for internal JobEffectInput. Preserve request's
exact2/claim3/event8 shape; feed entire original envelope to its existing parser
so extra/inherited/symbol keys are not silently projected away. Null means invalid
input; no RPC/effects. Return parsed immutable request, never mutate caller.

B contract:
decodeCmsSchemaDryRunClaimResponse(request: CmsSchemaDryRunClaimRequest,
value: unknown): CmsSchemaDryRunClaimResponse | null
New production file later: apps/worker/src/content-schema-registry/schema-dry-run-claim-binding.ts.
Validate complete request and whole six-part response with existing schemas.
Additionally bind returned job.id/version to actual claimedJob, originatingEventId
to original eventId and all eight returned event fields to unchanged original
request. Return whole immutable parsed response. Invalid input/output or coherent
foreign caller tuple -> null; never unwrap plan/fall back/repair/coerce/project.
Fixed eventType/schemaVersion/aggregateType literals are also enforced by parser;
do not claim tests isolate a redundant external comparison independently.
Internal owner/plan/report relations remain parser checks. CanonicalJob lacks
owner context; decoder alone cannot establish stored owner or enduring authority.

Native authors gpt-6-astra/high; parent gpt-6.1-sol/ultra owns ALL commands.
Only pure ctx JS fs/path reads + native apply_patch to sole claimed files.
No child_process/shell/tests/DB/network/Git/formatter/packages/executable imports/
scripts/provider changes/nested agents. Existing helpers/schemas/tests frozen.
A ONLY NEW schema-dry-run-claim-input.test.ts in same module directory, cap400.
B ONLY NEW schema-dry-run-claim-binding.test.ts in same directory, cap400.
Both use existing pure responseFixture/IDS where useful; no shared fixture edits.
Controlled unit fixtures must be labelled, never actual persisted/claim proof.
No production file creation yet. Expected missing implementation module/export
RED is not a functional runtime/security proof; parent records actual result and
later GREEN/mutation sensitivity. Literal titles/assertions must distinguish
boundaries, not only source tokens/import/title existence.

A minimum cases: nonadjacent full19 acquired receipt vs separate preclaim/original
versions, exact2/3/8 complete output/immutability; missing receipt; each subject
mismatch; receipt scalar malformed/full19 overflow; actual nil/max UUID token
domain positives; wrong job type; original old-version preservation; original
envelope grammar/own shape negative controls. Do not require fresh clock or fake
state progression. No network/mock RPC necessary for a pure builder.

B minimum: full complete bound response preserved; acquired full19 and distinct
plan version/original event preserved; privately schema-valid coherent foreign
job tuple and wrong acquired version rejected; coherent changed eventId plus job
origin, correlationId, causationId, original aggregateVersion rejected. Every
event field negative, with private parser success/failure explicitly distinguished
for fixed literals. Malformed/missing/extra/inherited whole/nested projection and
legacy plan-only wrapper rejected. Request invalidity rejected; both inputs
unchanged; result immutable. Nullable-source controlled shape may pass only if
existing response schema accepts, not genuine completed replay evidence.

Root later implements each pure production module ONLY after actual RED and
fresh clean checkpoint; no producer wiring yet. GREEN plus distinguishing
mutations/exact source restores required before the separate claimed worker
entry/shared post-read extraction wave. Existing admission492 exceeds utility
cap; any future touch must plan surgical decomposition and legacy equivalence.
Real cancellation signal/attempt, updated plan-token handoff, typed JobEffectResult
mapping, genuine sealed empty/nonzero preparation, receiving/processed-event/
ACK/heartbeat/per-stage fences and environment composition remain separate.
No Slice11 criterion or full/external gate promoted;0/122.
