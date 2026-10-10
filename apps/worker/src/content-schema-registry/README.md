# Content schema registry worker

## Contents

Validated CMS registry contracts, lifecycle routes, release verification,
bounded dependency adapters, telemetry, and their Slice 09 acceptance tests.

## Ownership

This boundary owns request admission, caller-derived authority, release
evidence verification, dependency/error mapping, and scrubbed observability.
Database RPCs remain the transaction and audit authority.

## Module map

- `migration-worker.ts` is the compatibility export facade.
- `migration-worker-engine.ts` owns normalization, in-flight dedupe and event
  claim scoping; `migration-worker-execution.ts` composes admission, lease,
  dry-run, backfill and verification stages with trusted private purpose.
- `migration-worker-{admission,lease,dry-run,backfill,verification}.ts` own
  stage decisions; `migration-worker-batches.ts` owns bounded batch execution.
- `migration-worker-activation.ts` preserves activation/reconciliation/rollback
  and durable event-ACK continuation, separate from pre-review preparation.
- `migration-worker-input-schemas.ts` is the stable facade over the focused
  job, activation-evidence, and queue schema modules.
- `migration-worker-plan-schemas.ts` is the stable facade over plan types,
  plan-record, batch, and plan-record output modules; `schema-core.ts` and
  `validation.ts` own shared parsing and validation.
  The plan-record parser/output preserve DEC-162's narrow first-empty null ID
  pairs; the producer must independently prove firstness and actual emptiness.
- `schema-dry-run-claim-{request,response,shape}.ts` define the private closed
  claimed-receipt/original-event resolution contracts and 15 internal response
  relations, reusing the existing event/plan parsers. These contracts do not
  resolve server records, bind an external claim context or prove live authority.
- `schema-dry-run-claim-{request,response}.test.ts` and focused support exercise
  actual private parsers, each internal relation, original own-key boundaries,
  readonly output/input immutability, lossless versions and UUID-v7 claim tokens.
  All 31 isolated parent mutations are detected; restored 419 parser cases plus
  491 related cases pass. See the Slice 11 mutation receipt handoff for limits.
  Controlled fixtures are not persisted provenance or live-authority evidence.
- `schema-dry-run-claim-{input,binding}.ts` are the pure acquired-receipt request
  builder and complete-response caller binder. Their focused tests retain the
  original event, distinguish original/preclaim/acquired versions, preserve
  immutable complete output and caller metadata, and reject unbound/legacy
  projections. These seams do not wire preparation, resolve SQL records or
  establish enduring job/owner authority. Verification receipts belong in the
  Slice11 handoff; import RED alone is not behavioral proof.
- `migration-worker-results.ts` owns result and rollback mapping.
- `migration-worker-first-empty-baseline.test.ts` pins DEC-162's defensive null-ID
  shape and completed read-only replay; provisional zeros are not SQL eligibility
  or authenticated migration/activation evidence.
- `migration-worker-lease-token-compatibility.test.ts` checks actual UUID lease
  decoding and preservation of bounded legacy tokens without widening non-lease
  token domains.
- `migration-worker-sealed-lease-handoff.test.ts` and its focused
  `migration-worker-sealed-lease-test-support.ts` pin canonical post-seal reclaim
  operands, failure barriers, held-lease and read-only replay controls. Controlled
  ports prove worker transitions, not SQL authority, seal races or approval.
- `migration-worker-dry-run-purpose.test.ts` and its focused
  `migration-worker-dry-run-purpose-test-support.ts` pin the trusted, private
  preparation-purpose boundary and unchanged activation controls. Controlled ports do not
  establish production dispatch or persisted job completion.
- `migration-worker-pre-review-purpose.test.ts` and its focused support pin
  DEC-108 nonzero preparation through verification/complete without an early
  switch, genuine-empty shape controls and unchanged activation/failure behavior.
  Empty controlled shapes are not SQL census or concurrent-fence proof.
- `migration-worker-pre-review-response-guards.test.ts` pins strict completion
  state and each empty-plan discriminator operand independently; controlled
  dependency denials are not legal sealed SQL states or authority proof.
- `migration-source-read.ts` validates the `cms_read_schema_migration_source_rows`
  page (at most 128 rows; `targetFields[]` of changed fields with compiled
  constraints, `retiredFields[]` of removed keys carried unvalidated; a page
  that is not last must be full); `migration-batch-read.ts` reads and scans one
  batch with the one page limit the batch RPC also sends;
  `migration-scan-executor.ts` turns rows into per-row evidence;
  `migration-transform-registry.ts` is the code-owned registry
  (`identity.revalidate` v1, `default.fill_literal` v1) with
  `migration-transform-jcs.ts` (RFC 8785 JSON, SHA-256) and
  `migration-transform-types.ts`. Add a member in code plus a forward migration;
  update its digest and the registry test.
- `contracts.ts` remains the stable feature seam; `contracts-schema-exports.ts`
  owns runtime schema re-exports and `contracts-type-aliases.ts` owns parsed
  worker aliases.
- `migration-worker-runtime.ts` owns validated dependencies and durable
  dead-letter persistence.
- `types.ts` is the stable seam over `types-core.ts` (operation ids, session,
  results) and `types-ports.ts` (the eighteen named operation ports).
- `route-registration.ts` mounts CMS-03A-01 through CMS-03A-18 (human
  commands, protected reads, and the two signed release commands).
  `route-human-authority.ts` is the shared human pipeline: origin, session,
  capability (`admission-identity.ts`), step-up and CSRF as the route policy
  requires, then the per-user and per-party rate gate. The owner-only grant
  operations (CMS-03A-15 through CMS-03A-18) have no capability key; the named
  RPC derives the owner from the owner initialization receipt.
- `production.ts` maps each port to one `cms_*` RPC in `CMS_SCHEMA_REGISTRY_RPC`;
  `production-context.ts` builds the server-derived RPC context and projects
  the private acting-context binding into the review, activation and owner
  grant RPCs only; `production-rate.ts` enforces the per-user bucket and the
  per-party bucket and fails closed when either cannot be evaluated.
- `operational-alert-production.ts` composes the production alert
  dependencies, while `operational-alert-provider.ts` owns absolute provider
  deadlines, streaming response caps, fatal decoding, and redacted failures.
  The scheduled entrypoint starts alert evaluation independently of the outbox
  sweep so an outbox retry cannot suppress monitoring.

## Extension rules

Keep secrets and private evidence server-side. Add operations through strict
contracts and named RPC adapters; preserve fail-closed defaults and bounded
request, response, and dependency behavior.

To add a human operation: add its request and response schemas to
`@wejammin/contracts`, its operation id and port to `types-core.ts` and
`types-ports.ts`, its body schema to `admission-schemas.ts`, its capability
row to `admission-identity.ts`, its route to `route-registration.ts`, its
response schema and port name to `runtime-port.ts`, its RPC to
`CMS_SCHEMA_REGISTRY_RPC`, and RED-first tests beside the existing
`phase-02-slice-09-*` suites. Step-up, CSRF, If-Match and rate limits come from
the contract route policy and are never restated here.

## Conventions

Use the existing `ContentSchemaRegistry` naming and keep security branches and
contract changes covered by colocated tests.

## Related links

- `.memory/wiki/specs/be/03a-content-schema-registry.md`
- `.memory/wiki/operations/runbooks/content-schema-registry.md`
