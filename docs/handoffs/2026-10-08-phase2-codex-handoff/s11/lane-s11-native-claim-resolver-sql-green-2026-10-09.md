# Slice 11 — claimed dry-run resolver SQL, genuine RED before GREEN

## First GREEN and sole clock correction

Actual unchanged API69 GREEN/main54322 pre0/API0/post0; catalog ACL/volatility
correct, pgTAP4/121 and unit35/1116/static/type generation/check0. Lint exit0 is
NOT clean: existing39 functions100 issues unchanged, plus one new snapshot
STABLE/volatile-clock warning. See proof-s11-claim-sql-api69-first-green-lint-
gate-2026-10-09.md. ONLY B's existing18400 observed_at initializer may change
clock_timestamp() to once-captured statement_timestamp(); no other predicate,
request/dispatcher/QA/source changes. Root clean pushed checkpoint BEFORE
continuation; rerun actual API69/expiry/lint/catalog then mutation proof.

## Gate and disjoint ownership

Parent actual69:21 functional resolver failures/48 passing controls; graph now
reaches final CONFLICT after all public/persisted/hash/live-claim assertions.
See proof-s11-genuine-claim-api69-graph-reached-red-2026-10-09.md.
Checkpoint/push/clean exact-origin BEFORE authors/continuations.
Root ONLY `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, current branch.
Native authors gpt-6-astra/high:

- A ONLY new `supabase/migrations/20261005018500_cms_claim_resolver_request.sql`
  and `20261005018600_cms_claim_resolver_dispatch.sql`.
- B ONLY new `supabase/migrations/20261005018400_cms_claim_resolver_snapshot.sql`.

Each file<=300 lines. No existing migrations/tests/contracts/runtime/schema/
roles/global-parser edits. For helper ownership transfer ONLY, the exact existing
05018100 pattern may temporarily grant CREATE on platform_private to the existing
definer, alter owner, then immediately revoke CREATE in the same migration.
No new role, API privilege or enduring grant. Native apply_patch; pure ctx JS
fs/path reads only.
NO commands/shell/child_process/import execution/scripts/tests/DB/network/Git/
formatter/packages/TS/nested agents. FINAL FREEZE. Parent owns all execution.

## A — grammar and additive dispatcher

Private proposed `cms_schema_dry_run_claim_request(jsonb)` returns void,
IMMUTABLE pure validation, empty search_path, existing definer owner. Revoke
direct EXECUTE PUBLIC/anon/authenticated/service_role; no API exposure.
Mirror private request/Queue eight-key schema BEFORE casts:

- Root exactly claimedJob/requestedEvent; claim exactly jobId/version/leaseToken;
  event exactly eventId/eventType/schemaVersion/aggregateType/aggregateId/
  aggregateVersion/correlationId/causationId. Object/scalar JSON types first.
- Claimed UUID matches installed Zod4.4.3 regexes.js:22: v1–8/RFC variant,
  mixed hex case, nil and lowercase max exceptions. No v4-only legacy parser.
  Event UUIDs stay canonical lowercase v1–8/RFC variant. causationId explicit
  JSON null or canonical UUID. No Queue domain widening.
- Versions JSON strings, canonical positive1–19 digits <=9223372036854775807.
  No signs/space/zero/leading-zero/exponents/fractions/JSON-number acceptance.
  Guard grammar before bounded bigint casts; exact INVALID_REQUEST/P0001.
- eventType job.requested, numeric schemaVersion1, aggregateType job.
  Claimed jobId=event aggregateId RAW TEXT BEFORE UUID casts. Uppercase token
  allowed; B compares actual stored UUID identity.

Actual dispatcher `platform_private.cms_get_schema_migration_plan(jsonb)`:
prepend exact two-key branch: existing cms_worker_require_request with those
root keys → A request helper → B snapshot helper. Existing guard performs
actual service-role/bounded/exact-envelope check and RPC flag outside STABLE B.
Otherwise old statements EXACTLY authority6101–6138: three-key guard,18-digit
parser, SELECT FOR UPDATE, wrong-target conflict, completed stale-version
exception, projection. Preserve owner/ACL and public wrapper03120400 saved
flag restore. Do not widen global helpers or repair correct legacy projection.

## B — coherent read-only authority

Private proposed `cms_schema_dry_run_claim_snapshot(jsonb)` returns jsonb,
STABLE SECURITY DEFINER, empty search_path, existing wejammin_cms_definer owner.
Revoke EXECUTE PUBLIC/anon/authenticated/service_role. No GUC, new role or enduring
grant; sole temporary ownership-transfer pattern above is permitted.
All stored binding/authority reads and six-part projection share STABLE calling
snapshot; prefer one joined SELECT. No outer earlier authority read/later
projection, locks or VOLATILE fingerprint validator. Existing latest
cms_worker_plan_json is STABLE/correct and may be reused in this same snapshot.
Capture database time once for actual live lease.

Absent actual job→NOT_FOUND/P0001; existing job with any authority/current
attempt/binding mismatch→CONFLICT/P0001. Require actual cms.schema.dry_run,
running/version/UUID token/unexpired lease, no +1 inference. Match ALL eight
stored original outbox fields null-safely, originating event/aggregate and
payload jobId/jobType; never rewrite original event.

Bind unique actual report/plan/candidate/type/source/target/artifact, every
owner=job.acting_party_id; plan/report created_by=job.actor_id, NOT candidate
creator. Current candidate.dry_run_id and plan fingerprint dryRunId=report ID;
actual job/report/plan linkage, source-target/type ownership, classification/
transform pair/compiler version agree; nonsuperseded plan/current compiled
artifact. Accept another fully coherent real job; no blanket foreign refusal.

Stored fingerprint source/target/compiler/transform hash and compiler version
must match scoped rows/pure transform hash, null-safe. Recompute current target
persisted definition/artifact with STABLE cms_candidate_definition_request
and unchanged pure JCS/artifact helpers after outer guard context. Never compile
or write caches. Graph changed-but-cache-unchanged witness must refuse.

Pending sourceCount may be nonzero (DEC108); initial target/error/migrated/failed
zero. Do not require completed scan evidence/sealed final report for queued
admission; provisional fingerprint is not sealed authority. DEC162 first-null
pending retains additive/null-transform/zero/cursor prerequisites and actual
independent census via existing STABLE cms_schema_source_row_count as applicable.
Do not apply genuine-first/no-active eligibility to completed replay: preserve
nullable source and null/target/later active UUID allowed by frozen private
shape. No unconditional draft/no-active restriction or invented terminal policy.

Return EXACT closed job/requestedEvent/report/candidate/planScope/plan members,
string versions/counters per frozen response; no caller-selected IDs. No
settings/DEC163/receiving/ack/heartbeat/per-stage changes in this bounded wave.

## Actual sources and parent gates

Read actual files:

- authority20260902080000:5688 guard,6101 legacy,8236 ACL,1600/2199 forced RLS;
  03120400_cms_rpc_flag_restore.sql:290;03120500 ownership:80;
  03120200 non-S09 policies existing jobs/outbox SELECT.
- 20261002164000_cms_locale_configuration_producers.sql:29–123 graph/artifact;
  20261002127000_cms_schema_dry_run_command.sql:34 STABLE projection,100
  validator (not safe for unsealed pending admission).
- 20261002202000_cms_error_details_version_mismatch_reason_code.sql:1026 census,
  1098 fingerprint,1124 job/report provenance;05018100 existing first-empty
  census;02183000 scanner/seal.
- Frozen schema-dry-run-claim-{request,response,shape}.ts, contract primitives/
  field-rules/platform-events, installed Zod UUID regex, genuine69/support oracles.

Parent reads complete code/reviews; guarded main54322 pre/post reset and unchanged
API69 GREEN, then catalog/ACL/RLS/volatility/legacy and mutation-sensitive proof.
Genuine nonzero/completed producers remain later. No full/acceptance claim.
