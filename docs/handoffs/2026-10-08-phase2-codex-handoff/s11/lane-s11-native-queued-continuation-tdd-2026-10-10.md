# Slice11 native queued-continuation TDD contract

## Latest producer checkpoint: focused GREEN, full DB gate failed

After clean pushed QA5e2ccedc, native sole consumer.ts +3 lines (126 total):
applied queued returns actual completed/outcome/processed:null before processed
write. Root actual12GREEN/1.96s then22files197GREEN/12.70s; all other33 source/
QA exact. Independent producer review no bounded finding. Terminal/noop/claim/
manual review unchanged; real running→queued helper cannot emit queued noop.

Required full db:verify reset/lint0 then db:test333files12764assertions, one
failure: reads_review assertion16/AC057/source118 (188s SQL test phase).
API/races/types and validate UNRUN after first failure; postReset0. SQL source
unchanged. Source diagnosis: equal fixture created_at + random reviewer IDs
make label ordinals nondeterministic; assertion expects active/revoked order.
Separate native fixture-only contract preserves every original assertion and
production SQL; author only after clean pushed checkpoint. Tracked green-gate
JSON holds exact producer/other33 hashes and actual logs. Full gates NOT green;
no complete redelivery/production/stage-authority/S11 acceptance inferred.

## Latest QA checkpoint: actual assertion RED, producer UNRUN

Contract checkpoint21b956a4 clean/pushed before native test-only writes.
Root application actual5 tests:1failed/4passed,1.22s; receiving latest actual7:
2failed/5passed,1.47s. Failures are queued processed/history Boolean assertions,
not import/setup failures. CAS-conflict and all terminal controls pass; deferred
apply/processed barriers assert zero ACK/retry before durable response. Full
ordered arguments/cardinalities, receipt/preclaim separation and immutable
fixtures retained. Application301 lines; type-safe receiving360, both below400.

First receiving attempt stopped in ESLint before tests; later project types
reported node:util unavailable and generic Mock incompatibility. Neither is
functional RED. Native sole-file repairs preserved all7 cases/oracles: browser
structural equality for these plain acyclic values and a genuinely generic RPC
forwarder through actual createSupabaseRpc with a local fake Response, no network.
Renewed actual receiving RED2/5; separate contracts/db-types/progress/format/
ESLint/project-type/diff chain0, freshCI0/flock/all34 SHA exact. Source/type-repair
independent reviews no bounded finding; latest log review no mismatch. Tracked
queued-continuation-qa-receipts-2026-10-10.json preserves exact hashes/logs.
No producer edits yet. Clean pushed QA checkpoint required before consumer.ts
sole minimal queued branch; all other source/QA remains frozen. Local controlled
composition only, not DB durability/production wiring/redelivery/acceptance.

Clean source/evidence baseline: `7af16cffad8ffc2a6e0430f445b13060f5af39c6`.
Origin12 source mutants caught/12 actual restored controls; local evidence only.
All23 origin/claimed QA/source hashes remain frozen. Slice11 acceptance0/122.

Independent bounded planning review found no contract finding after barrier/
import amendments. Manifest freezes32 paths; no producer writes authorized.
B's actual runtime composition performs two canonical reads and two restore-
fence reads before claim; preserve that exact ordered fixture behavior.

## Selected implementation repair, no new policy

BE00 infrastructure lines489–495 already requires at-least-once delivery,
bounded retryable queued recovery, canonical Job CAS and ACK only after durable
terminal/next state. Lines510–512 prohibit invented blocked states. Retry budget
remains max_retries3/max4 deliveries; delays15/60/300s, no new error codes.

Current application consumer applies queued outcome then unconditionally records
the original job.requested event: consumer.ts92–120. On redelivery dispatch.ts
224–233 treats that dedupe entry as duplicate. async-runtime.ts33–48 already
maps completed/processed:null to retry and recorded/duplicate to ACK; actual
generic queue handler async-entrypoint.ts201–229 calls Message.retry or ack.

Selected repair: after actual queued outcome is applied, return completed with
the actual outcome and processed:null WITHOUT calling recordProcessedEvent.
Keep unsuccessful outcome behavior unchanged. Succeeded/failed/cancelled retain
apply→record processed→ACK. Do not weaken canonical lease/CAS, add schema fields,
change RPCs/grants/roles, invent error mapping, or alter pending manual review.
This is internal application sequencing, not a new public wire contract.

## Explicit limits and later dependencies

This does NOT clear the separate original-envelope/current-Job-version stale
gate at dispatch.ts244–250. No full redelivery/automatic recovery claim yet.
Production CMS prep callback is still absent, Job heartbeat unused, durable
advisory stage fence and current-receipt refresh still unselected/unwired.
No new preparation progress/error/outcome mapping selected by this repair.
No stored row edits, synthetic DB claims, real secrets, hosted auth, deployment,
new accounts/grants or paid services. No Slice11 acceptance inferred.

## Test-first native wave after clean pushed contract checkpoint

Native A sole new QA file:
`packages/application/src/infrastructure/jobs/consumer-queued-continuation.test.ts`.
Use actual executeJobDispatch and existing typed persistence/effect ports.
Cover queued applied: actual claimed receipt version used in outcome CAS;
result completed/outcome applied/processed:null; exact one effect/apply and zero
processed-event writes. Keep immutable originating envelope/preclaim Job and
postclaim receipt distinct, including a synthetic non-adjacent version fixture
without claiming SQL version adjacency. Add queued CAS-conflict control and
terminal succeeded/failed/cancelled controls with exact apply-before-record
sequence, frozen fixture preservation and complete call cardinalities.
Do not force impossible queued no-op through mocks or bypass execution helpers.

Native B sole new QA file:
`apps/worker/src/async-entrypoint-queued-continuation.test.ts`.
Use actual createAsyncJobDependencies plus actual generic createAsyncEntrypoint
queue handler, with controlled typed RPC port and real application consumer.
No fabricated orchestrator/queueOutcome return, no mocked executeJobDispatch.
Queued applied must cause exactly one Message.retry, zero ACK and zero
record_processed_event; assert actual safe RPC call order and current claimed
version. Include an actual deferred apply RPC barrier: before durable response,
zero transport ACK/retry; after release, exactly one retry/no processed write.
Queued CAS conflict remains retry/no processed write. Terminal
succeeded/failed/cancelled controls remain one ACK/no retry after durable apply
and processed write. This is controlled receiving-component QA, not genuine
PostgREST, production composition, complete redelivery or stage-authority proof.
Add terminal processed-write barrier: before its durable response, zero ACK/
retry; after release, one ACK/no retry. No sleeps; actual port-entered gates.

Both authors: read relevant stable source, rules and skill instructions. Own
sole assigned new path only; native apply_patch. Preserve every existing test
and producer. No commands, test execution, Git, DB/network, formatter, secrets,
tool-time runtime source imports, nested agents or unrelated writes. Ordinary
test-file imports of the actual production functions are required. Boolean comparisons
for sensitive request/receipt/argument invariants; no raw request/token diffs.
No call-name sets or toHaveBeenCalled-only substitutes for ordered full oracles.
No tests passing merely because injected RPC fake returns completed/processed.
Freeze/count planned cases and physical lines, report UNRUN, release claim.
Root owns all formatting/commands/actual RED, independent review, hashes, CI0/
flock, canonical flush→compile, progress/live handoff, exact Git checkpoint.

## Producer and validation gate

Existing sole producer target:
`packages/application/src/infrastructure/jobs/consumer.ts`.
Producer changes UNRUN and forbidden until actual focused assertion RED, frozen
QA, independent review and clean pushed QA checkpoint. Minimal queued branch
only; existing shared consumer shape and all old tests remain unchanged.
Root then runs focused GREEN plus existing consumer/claim/runtime/entrypoint
regressions, full Validation Cmd from project commands (first failure repair),
and requested db:verify then validate gates without weakening checks.
Full S11/public/nonzero lifecycle and Slices12–17 remain pending.

Earned-only Codex resets automatic when needed; no purchases. Live usage53%,
ordinary available, no reset needed; earned balance not exposed.
