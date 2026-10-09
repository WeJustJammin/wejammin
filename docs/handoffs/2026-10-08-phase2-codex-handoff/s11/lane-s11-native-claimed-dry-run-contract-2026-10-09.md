# Native contract-first — private claimed schema dry-run resolution

Claim seam parent63/63 plus related32suites491/491, static gates0. Independent6.1
no weaker oracle. Receipt/binding mutations4failed8passed12 /25failed26passed51,
exactSHA restoration then79/79/static0. Existing source/QA frozen.

Checkpoint/push/exact-origin BEFORE nativegpt6astra/high contract author. ONLY
`/home/rob/.codex/worktrees/phase2-slice11/WeJammin`. PURE ctx JavaScript fs/path
reads plus native apply_patch ONLY; NO commands/exec/shell/child_process/scripts/
runtime/tests/DB/network/format/lint/TSC/Git/packages/nestedagents.

SOLE NEW files in apps/worker/src/content-schema-registry:

- schema-dry-run-claim-request.ts (schema<=150 formatted)
- schema-dry-run-claim-response.ts (schema<=150 formatted)
- schema-dry-run-claim-shape.ts (focused private schema helper<=300, only if needed)

No existing source/tests/barrel/README/tracking edits. No endpoint, runtime,
SQL branch, adapter, queue field, effect, startup, receiving behavior or migration.
This is internal Zod4 contract definition BEFORE behavior QA/implementation;
reuse existing dependency and exact contracts, no new packages.

Read actual JobLeaseClaimResult and JobEffectInput, frozen claim QA, QueueEnvelope
schema, CmsUuid/CmsVersion schemas, MigrationPlanRecordSchema/output, existing
schema-core helpers, current cms_get_schema_migration_plan and CMS03A10 producer,
report immutable joins, and BE00 resultRef/decision-classification source.

## Request

Export CmsSchemaDryRunClaimRequestSchema and inferred readonly type. Exact outer
keys: claimedJob, requestedEvent. claimedJob exact jobId/version/leaseToken, all
UUID/positive-bigint decimal strings using existing schemas. version is ACTUAL
claimed receipt version, never preclaim/envelope version or adjacent arithmetic.
requestedEvent exact existing eight-field QueueEnvelopeSchema, narrowed to
job.requested/schemaVersion1/aggregateType job; aggregateId equals claimed jobId.
Own complete key sets on outer/every nested object before normalization. Reject
extras/mixed legacy keys/aliases/coercion/malformed/null. No caller time/expiry,
report/plan/schema IDs, state or purpose. Do not infer adjacency; immutable
originating envelope aggregateVersion need not equal actual claimed version.

## Response

Export CmsSchemaDryRunClaimResponseSchema and inferred readonly type. Exact keys:

- outer: job, requestedEvent, report, candidate, planScope, plan
- job: id, type, version, actingPartyId, originatingEventId
- report: id, jobId, planId, ownerId, contentTypeId, sourceVersionId, targetVersionId
- candidate: id, ownerId, contentTypeId, supersedesId, dryRunId
- planScope: ownerId, dryRunId
- requestedEvent: unchanged exact eight-field QueueEnvelopeSchema, same job event narrowing
- plan: exact existing23-key MigrationPlanRecordSchema, BYTE UNCHANGED

Use actual existing plan safeParse/output, not blind `.plan` unwrap, generic cast,
whole SQL row exposure or a weakened redefinition. Own complete key sets before
normalization; UUIDs, positive decimal versions and existing plan validations.
All response UUIDs nonnull except report.sourceVersionId and candidate.supersedesId.
Preserve existing first-null-source and completed baseline active-version rules.
Raw report/evidence/creator/state/attempt/token/expiry projections excluded.

Response internal cross-bindings (null-safe where nullable): exact CMS job type;
job.originatingEventId=event.eventId; event aggregateType=job and aggregateId=job.id;
report.jobId=job.id; report.planId=plan.id; job.actingPartyId=report.ownerId=
candidate.ownerId=planScope.ownerId; report/candidate/plan contentType IDs equal;
report.targetVersionId=candidate.id=plan.toVersionId; report.sourceVersionId=
candidate.supersedesId=plan.fromVersionId; report.id=candidate.dryRunId=
planScope.dryRunId. No expectedVersion equality with original event/current plan.
Do not add time/state/newer-ready/version exceptions or require a sealed completed
report for a legitimate draft scan. A later context decoder will compare response
job.id/version to trusted receipt and all eight returned event fields to original
request; this contract alone cannot prove context binding or database provenance.

## Authority and source limits

Existing server reader currently accepts only migrationPlanId/schemaVersionId/
expectedVersion; legacy completed-plan exception stays unchanged. Future additive
claimed request branch on SAME existing service-role RPC/owner/ACL must resolve
job→immutable original event→unique report→plan/candidate from server state.
Running/current version/token/live expiry against DB time, non-supersession,
compiler/artifact/transform/current-fingerprint/applicable sealed-report checks
are future server-only checks, NOT implemented by these schemas. Plan/report
created_by=job.actor_id is supported by producer1107–1135. Candidate.created_by
MUST NOT equal job actor: a different authorized designer may start the attempt.
No new role/grant or FOR UPDATE/SHARE on jobs/outbox (SELECT-only ACL).

Root personally verified BE00:233/253 and current JobStatus:39–43: resultRef.type
uses open Code grammar. A result-resource label is implementation naming, not an
owner reapproval gate; this schema wave selects NO literal/success condition.
Synthetic cms_schema_migration test label is not normative authority.

Freeze/report UNRUN exact files/counts/exports. Parent owns scopedformat/ESLint/
type/contracts/progress and regression, independent6.1 review; then separate
behavior QA and genuine RED BEFORE resolver/effect/SQL producers. Decoder schema
consistency is NOT persisted/enduring job authority. No receiving continuation,
attempt/heartbeat or activation policy changes. GenuineAPI7RED/0of122/full/owner/
external holds unchanged; no S09 restart or DB handles.

Source anchors: platform-events.ts134–146; runtime-types.ts existingreceipt;
migration-worker-plan-record-schema.ts25–50 (23 actual keys); private original
reader20260902080000:6101–6138; CMS03A10 producer20261002202000:957–961/1107–1141;
report20261002123000:104–139; existing definerprivileges20261003120100:48–63.
