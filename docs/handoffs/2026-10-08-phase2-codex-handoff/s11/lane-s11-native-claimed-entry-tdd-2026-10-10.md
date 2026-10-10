# Slice 11 — unwired claimed preparation entry TDD

Contract frozen for bounded QA; not implemented or executed. Baseline checkpoint
58e30105c31f62859b1fcd15102df43d779a62d9 is clean and pushed. Root must checkpoint
this brief/tracking before native QA authors. This is an implementation-owned
private seam, not a new owner decision or receiving/acceptance closure.

Independent 6.1 source review found no concrete contradiction or test-blocking
choice. Separate read-only matrix review corroborated distinguishing witnesses.
These are static verdicts only; native QA and all new runtime work remain UNRUN.

## Scope and exact private API

New module: apps/worker/src/content-schema-registry/claimed-schema-migration-preparation.ts.
Export createClaimedSchemaMigrationPreparation(dependencies), accepting
Omit<SchemaMigrationWorkerDependencies, 'executionPurpose'>. Return an object
with process(input: JobEffectInput, options: { signal: AbortSignal; attempt: number }).
Both options are required private invocation context, not claimed queue provenance.
Root must leave startup, production effect dispatcher, queue consumer, adapters,
public exports, SQL, pure input/binding modules and their frozen QA unchanged.

Export the private discriminated result type ClaimedSchemaMigrationPreparationResult:

- { kind: 'invalid_claim' }: strict builder refused; no RPC, telemetry, legacy
  reader, repair, dead-letter or fabricated report reference.
- { kind: 'resolution_failed'; failure: MigrationWorkerRpcFailure }: preserve
  the existing runtime call's normalized code/retryable pair; no fallback.
- { kind: 'invalid_resolution' }: whole bound response refused; no later RPC,
  event claiming/ACK/release/dead-letter, repair or plan-only fallback.
- { kind: 'processed'; claimRequest: CmsSchemaDryRunClaimRequest;
  reportId: string; result: MigrationWorkerResult }: retain the actual immutable
  request/original eight-field event and resolved report ID separately from the
  stage result. Do not advertise initial plan as final plan, invent a report
  reference, or map this result to JobEffectResult/shared job state.

Typed invocation options are trusted internal context, as in the existing
worker. Do not invent option defaulting, lease-clock authority, attempt policy,
new failure codes or a queue ACK policy here. Existing runtime.call short-circuits
an already-aborted signal to DEPENDENCY_DEADLINE_EXCEEDED/retryable:true.

## Exact implementation flow after witnessed RED

Hardcode runtime construction executionPurpose:'dry_run' after dependency spread,
even if a runtime caller supplies an extra activation purpose. For each process:

1. Call buildCmsSchemaDryRunClaimRequest(input); null returns invalid_claim.
2. Capture invocation start time for existing admission telemetry.
3. Call SCHEMA_MIGRATION_RPC.readPlan exactly once with that exact two-key
   request and the same invocation signal. Preserve runtime failure pair.
4. Call decodeCmsSchemaDryRunClaimResponse(request, value) on the whole six-part
   response. Null returns invalid_resolution. Never unwrap or reread.
5. Derive the five-field internal stage job from response.plan.toVersionId,
   response.plan.id, response.plan.version and the original event's correlationId/
   causationId. These are distinct from BE00 preclaim/acquired/original versions.
6. Invoke extracted shared post-read admission with that same plan, event:null,
   derived job, real signal/attempt/start time. If admitted, invoke extracted
   admitted-plan execution. Return processed with report ID and stage result.

No new in-flight map or legacy plan-ID-only coalescing. Every distinct claimed
invocation independently resolves/binds. Do not fabricate a CMS activation event.

Surgical legacy-equivalent extraction:

- Move admission ACK/release helpers into migration-worker-event-recovery.ts.
- Move the post-read branch currently admission.ts334-491 into
  migration-worker-resolved-admission.ts, export admitResolvedMigrationInput.
  Accept non-null job, nullable legacy event, resolved plan, signal/attempt/start
  time. Preserve identity/version checks, completed-version exception,
  terminal/blocked behavior, ACK/release recovery and telemetry exactly.
- Keep legacy admission event-claim/read/parse/malformed handling. Its successful
  read delegates to the shared helper; legacy three-key request unchanged.
- In migration-worker-execution.ts export processAdmittedMigration for its
  existing post-admission stages. processNormalized still admits then delegates.
- Do not change legacy engine process/replayDlq, in-flight behavior, results,
  stage helpers or wire contracts. All touched/new utilities <=300 physical lines.

## Native QA lanes — sole write claims

A: claimed-schema-migration-preparation.test.ts only, <=400 formatted lines.
B: claimed-schema-migration-preparation-stages.test.ts only, <=400 formatted lines.
Use existing frozen fixtures or file-local bounded fixtures; no old helper edits.
New support file requires root approval of an exact additional claim first.

Boundary witnesses: missing/mismatched receipt before RPC; nonadjacent full19
preclaim/acquired/original versions; exact two-key read and signal identity;
valid running preclaim remains accepted, with no queued-only narrowing;
malformed/coherent foreign response and altered original event refuse before
stages; preserved normalized retryable/terminal errors and pre-abort; controlled
in-flight abort with listener cleanup; all accepted invocations preserve actual
report/request. Two valid receipts resolving the same plan must both independently
read/bind rather than plan-only coalesce. Positive null/non-null causation.
Do not mutate caller objects/prototypes/descriptors/extensibility. Keep every
retained identity and version distinct enough to refute substitution.

Stage witnesses: exact ordered nonzero scan/seal/fresh reclaim/backfill history
with plan-owned expectedVersion and distinct plan/BE00 tokens; verification/
completion continuation without activation; sealed all-zero READY shortcut only,
not provisional zero draft/dry_running; terminal/blocked outcomes retained.
Use existing controlled purpose fixtures without weakening their requests or
assertions. Legacy activation/default-purpose/recovery regression stays mandatory.

Root owns formatting, independent 6.1 review, fresh-CI/shared-flock RED and GREEN,
mutation proof, canonical tracking and clean pushed checkpoints. Native authors
perform only pure ctx JS fs/path reads and native apply_patch sole-claim edits:
no shell/child_process, executable imports, scripts/tests, DB/network/Git,
formatter/packages or nested agents.

## Evidence limits / next gate

### QA amendment and legacy equivalence claims

Initial actual import RED: two absent-module suites/no tests/232ms/exit1; not
functional assertion proof. Root formatted A431>400, B382<=400; cases26/8 UNRUN.
Checkpoint before next native wave. A may move only existing fixture/helpers to
claimed-schema-migration-preparation-test-support.ts (new utility <=300), retain
all26 cases/assertions and make concurrent tokens AND versions distinct. Sole
A claims that support file plus its existing boundary spec; B stays frozen.

C sole new claim: migration-worker-resolved-admission-equivalence.test.ts, <=400.
Add otherwise valid foreign plan-ID with matching target/version, completed
identity mismatch before terminal exception, nonadjacent completed version with
exact successful event ACK, exact failed-terminal failure ACK, successful blocked
release exactly once with acquired token/full identity/signal, and rejected
in-flight eviction followed by successful fresh read. Keep old helpers unchanged;
new support file needs an exact additional root claim. All commands root-owned.

Existing22 legacy suites341/341/12.49s/exit0 are actual pre-extraction control.
This additional QA is implementation-owned proof, not a product/ACK-policy change.

BE03a2305-2329 requires real nonzero scan -> seal -> backfill -> verify -> complete
without activation. Controlled unit histories do not establish SQL owner/lease
authority, real public lifecycle or persisted completed report. Current queue
consumer records processed even on queued outcomes and async runtime ACKs them;
therefore receiving, durable continuation, retry/terminal mapping, BE00 heartbeat,
per-stage live-claim fencing and startup remain separately unwired/open.
DEC163, full Validation Cmd, later slices and external gates remain open;0/122.
