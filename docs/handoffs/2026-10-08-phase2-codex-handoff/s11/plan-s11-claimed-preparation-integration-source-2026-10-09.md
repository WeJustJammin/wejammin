# Slice 11 — claimed preparation integration, source-only proposal

Not dispatched/implemented. Finish resolver edge/same-hash QA and mutation proof
first, then root complete relevant normative/source reads and new bounded
contract-first TDD scope behind clean pushed checkpoint. This record is not a
new product/architecture decision or proof of receiving/stage authority.

Verified current source:

- packages/application/src/infrastructure/jobs/consumer.ts81-86 already forwards
  actual acquired claimedLease, unchanged canonical preclaim job and original
  envelope. runtime-types.ts124-130 has optional receipt but no AbortSignal.
- apps/worker/src/production-job-effect-dispatcher.ts83-98 forwards full input to
  prepareSchemaDryRun. Throws and missing/invalid dependency results become
  manual review; never assume throwing triggers durable queue retry.
- production-worker-runtime-cms.ts220-230 selects trusted private dry_run purpose
  but returns legacy SchemaMigrationWorker input methods.
- content-schema-registry/migration-worker-admission.ts287-294 still reads the
  three-key legacy request. migration-worker-validation.ts84-95 unwraps plan;
  using this alone on six-part response discards authority bindings.
- schema-dry-run-claim-response.ts71 explicitly proves internal consistency only.
  Coherent foreign tuple can parse; caller receipt/event binding still required.
- migration-worker-execution.ts68-88 requires sealed READY before empty dry_run
  shortcut; provisional zero counts are NOT enough. Plan-token acquisition and
  fresh post-seal reclaim remain separate from BE00 claim token.
- production-async-entrypoint.ts35-38 composes dispatcher from verification
  dependency only; environment-bound preparation wiring separate.
- async-runtime-rpc-transport.ts77-87 already propagates external abort and cleans
  listeners. Queue JobEffectInput lacks a signal; deadlines are not caller abort.

Proposed smallest coherent producer seam:

Trusted dry_run-only claimed entry requires actual receipt; validates job/token/
preclaim bindings against JobEffectInput without acquired-version arithmetic.
Build exact two-key request from receipt3 fields and original envelope8 fields.
Parse entire six-part response, explicitly bind returned job ID/version/origin
and every event field to original request. Derive migration IDs/CAS expectedVersion
from resolved plan, NOT event/BE00 version. Pass same resolved plan into existing
post-read admission/execution through narrow extraction; no unbound legacy reread
or malformed-response fallback. Preserve legacy process/replayDlq behavior.
Define signal forwarding and worker-result to JobEffectResult mapping explicitly;
dummy reference is not persisted report evidence.

Minimum TDD before implementation:

- Nonadjacent full19 acquired job version vs separate plan version/original event.
- Missing/mismatched receipt fails before RPC; exact two-key body.
- Schema-valid coherent foreign tuple and changed original-event bindings fail
  before plan lease/effects. Malformed/transport errors never legacy-fallback.
- Nonzero scan/seal/fresh reclaim/backfill/verify/complete ordered history, no
  activation; genuinely sealed empty READY shortcut, default activation retained.
- Pre-abort/in-flight abort/signal forwarding/listener cleanup; typed result map
  preserves retry versus terminal/manual review, persisted report identity.

Existing production-schema-migration-preparation.test.ts covers legacy transport/
stages, not claimed chain. No production-schema-migration-preparation.ts or
async-runtime-consumer.ts implementation file exists: discover names, never guess.

Actual genuine nonzero/completed public lifecycle, environment startup,
receiving/processed-event/ACK/heartbeat/retry/per-stage fences, DEC163 and full
phase gates remain separate open work. No acceptance closure;0/122.
