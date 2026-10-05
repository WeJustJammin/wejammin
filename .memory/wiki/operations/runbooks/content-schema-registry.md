# Content schema registry runbook

## Scope and owner

The CMS schema-registry on-call owns `CMS-03A-01` through `CMS-03A-18`, the
nineteen private registry tables (the twelve definition tables, the three
schema-review tables, the row-evidence table, the two capability-grant tables
and the workflow policy table), schema-migration worker, audit/outbox delivery,
and the protected Astro workbench and capability-grant console. This runbook does not authorize editorial
entries, publication, taxonomy, media, or public-delivery behavior owned by
Slices 10–17.

## Access prerequisites

- Read access to scrubbed Worker telemetry, queue state, migration progress,
  audit/outbox status, and the current deployment/migration identifiers.
- Environment-appropriate access to the eighteen named `platform_api` RPCs and
  read-only inspection of the private registry authority.
- Permission to pause the affected command, release-worker principal,
  migration consumer, or outbox consumer through an approved control.
- Synthetic non-production schemas, release keys, nonce receipts, migrations,
  and block definitions reserved for recovery drills.

Never copy cookies, tokens, CSRF values, idempotency keys, release headers,
signatures, nonce values, raw bodies, schema snapshots, content values,
capability graphs, private identifiers, or personal data into incident notes.

## Route and authority map

| Operation    | Route                                                                         | Authority                                                   |
| ------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `CMS-03A-01` | `POST /api/v1/cms/content-types`                                              | schema designer; CSRF and idempotency                       |
| `CMS-03A-02` | `POST /api/v1/cms/content-types/:contentTypeId/versions/:versionId/fields`    | schema designer; CSRF, idempotency, CAS                     |
| `CMS-03A-03` | `POST /api/v1/cms/content-types/:contentTypeId/versions/:versionId/relations` | schema designer; CSRF, idempotency, CAS                     |
| `CMS-03A-04` | `POST /api/v1/cms/content-types/:contentTypeId/versions/:versionId/activate`  | schema designer; recent MFA, approvals, idempotency, CAS    |
| `CMS-03A-05` | `POST /api/v1/cms/blocks/versions`                                            | signed release worker only; durable nonce claim             |
| `CMS-03A-06` | `GET /api/v1/cms/content-types`                                               | protected registry reader; no-store and no mutation headers |
| `CMS-03A-07` | `GET /api/v1/cms/content-types/:contentTypeId/versions/:versionId`            | protected registry reader; scoped no-store detail           |
| `CMS-03A-08` | `POST /api/v1/cms/blocks/versions/:blockDefinitionVersionId/lifecycle`        | signed release worker only; durable nonce claim and CAS     |
| `CMS-03A-09` | `POST /api/v1/cms/content-types/:contentTypeId/versions/:versionId/successors` | schema designer; CSRF, idempotency, exact source If-Match   |
| `CMS-03A-10` | `POST /api/v1/cms/content-types/:contentTypeId/versions/:versionId/dry-runs`  | schema designer; CSRF, idempotency, CAS; queues a BE00 job  |
| `CMS-03A-11` | `POST /api/v1/cms/content-types/:contentTypeId/versions/:versionId/reviews`   | schema designer; passed dry run; freezes review evidence    |
| `CMS-03A-12` | `POST /api/v1/cms/schema-reviews/:reviewId/decisions`                         | assigned reviewer; recent step-up, CSRF, idempotency, CAS   |
| `CMS-03A-13` | `GET /api/v1/cms/schema-reviews/:reviewId`                                    | designer or assigned reviewer scope; no-store               |
| `CMS-03A-14` | `POST /api/v1/cms/schema-reviews/:reviewId/assignments`                       | receipt-derived owner; recent step-up, CSRF, CAS            |
| `CMS-03A-15` | `POST /api/v1/cms/capability-grants`                                          | receipt-derived owner; recent step-up, idempotency          |
| `CMS-03A-16` | `POST /api/v1/cms/capability-grants/:grantId/renewals`                        | receipt-derived owner; recent step-up, idempotency, CAS     |
| `CMS-03A-17` | `POST /api/v1/cms/capability-grants/:grantId/revocations`                     | receipt-derived owner; recent step-up, idempotency, CAS     |
| `CMS-03A-18` | `GET /api/v1/cms/capability-grants`                                           | receipt-derived owner; protected no-store list              |

All routes have a 15-second application deadline. Human and release-worker
origins use separate allowlists. Release routes never use browser credentials
or a human session. Missing or unverifiable release trust, rate limiting,
acting context, or capability authority fails closed.

## Detection and alert thresholds

Investigate the declared per-operation request, latency, error, rate, conflict,
allowlist, migration, activation, block, nonce, outbox, retry, and DLQ signals.
Page the owning team when any of these conditions occurs:

- activation remains blocked longer than 15 minutes;
- a migration exceeds three retries or stops reporting truthful progress;
- nonce-receipt rejection rises above its established release baseline;
- a schema review stays open longer than seven days, the maximum assignment span;
- decision, assignment, or capability-grant denials rise above their preceding
  five-minute baseline;
- CMS DLQ depth is greater than zero;
- oldest CMS outbox event age exceeds two minutes;
- version/idempotency conflicts exceed 5% for five minutes;
- a consumer observes an unknown event version;
- Tier 2 command p95 exceeds 1,200 ms, protected RPC p95 exceeds 300 ms,
  acceptance p99 exceeds 1,000 ms, queue first-attempt p95 exceeds 60 seconds,
  or daily DLQ rate reaches 0.1%.

Treat a browser response, log, event, cache, analytics record, or diagnostic
containing release evidence, private schema payload, authority metadata, or
content data as a security incident.

## Immediate containment

1. Record environment, release and migration identifiers, operation ID,
   request/correlation ID, safe aggregate hash, outcome code, and first
   observed time.
2. Pause only the affected command class, release key, migration lease, or
   outbox consumer. Keep independently verified protected reads available only
   while disclosure and freshness remain truthful.
3. Do not bypass request validation, session/acting context, capability/RLS,
   origin/CSRF, MFA/approval, idempotency, CAS, release signature, nonce,
   allowlist, migration, deadline, or rate gates.
4. Keep the old active schema serving during a failed activation or migration.
   Never mark a candidate active, edit a registry row, or mutate a block
   lifecycle manually as containment.
5. Revoke a compromised release key through the protected trust registry,
   preserve redacted evidence, and stop A05/A08 until overlap-key verification
   and nonce-replay protection are confirmed.

## Diagnosis

1. Verify deployment identity, Worker readiness, database migration/type
   identity, release-key registry, distinct origin allowlists, rate limiter,
   queue binding, and outbox consumer without printing secrets.
2. Confirm the route used the exact generated contract. Human requests must
   derive actor, acting party, capability, and MFA server-side. Release requests
   must bind the exact operation, key ID, issued time, nonce, and untouched raw
   body to the verified Ed25519 signature before JSON parsing.
3. Reconcile the idempotency reservation/result, target version, audit record,
   outbox event, and mutation in one transaction. A timeout remains an unknown
   outcome until this evidence agrees.
4. For activation, compare candidate definition/artifact hashes, compiler
   version, dry-run report, migration plan, distinct approvals, acting-context
   MFA, current active version, and expected version.
5. For migration, compare source/target/transform/compiler hashes, state,
   cursor, counts, lease owner/expiry, retries, restore fence, and the old active
   fallback. A resumed worker must continue from durable progress.
6. For A05/A08, verify trusted non-revoked key identity, five-minute clock
   skew, ten-minute nonce retention, raw/signature/nonce hashes, release digest,
   block attestation, immutable lifecycle event, audit, and outbox evidence.
7. For A06/A07, verify owner/scope binding, cursor/filter/sort binding,
   deterministic tie-breaks, concealed-row omission, no-store headers, and
   byte-for-byte absence of mutation side effects.

## Recovery and compensation

1. Reconcile ambiguous mutations by the original operation, actor/party or
   release principal, path, expected version, request hash, and idempotency key.
   Replay only an identical request after canonical state is known.
2. After a conflict, refetch canonical state and preserve local input for
   explicit review. Never overwrite a newer definition or reuse approvals
   against changed evidence.
3. Resume a migration only from its durable lease/cursor after rechecking all
   hashes and the old-active fence. A changed transform or schema creates a new
   plan; it never resumes the old one.
4. Requeue a canonical pending outbox event by event identity. Consumers must
   deduplicate by event and aggregate version and reject unknown versions.
5. A release retry uses a fresh nonce unless exact durable reconciliation proves
   the original committed result. Idempotency never makes a duplicate nonce
   valid.
6. Restore traffic only after synthetic drills cover cross-tenant denial,
   forged headers/signatures/attestations, stale clock and nonce, CAS and
   idempotency mismatch, audit/outbox failure, worker crash/resume, DLQ replay,
   protected-read zero side effects, and browser evidence exclusion.

## Stop conditions

Stop automatic recovery and escalate for cross-tenant access, capability or MFA
bypass, human access to release operations, signature/attestation acceptance
without trusted-key verification, nonce replay, duplicate activation/lifecycle
transition, mutable active/block evidence, missing atomic audit/outbox, public
or browser disclosure, lost migration evidence, or irreconcilable canonical
state.

## Evidence capture

Capture only redacted timestamps, deployment/migration hashes, operation and
request/correlation IDs, actor class and acting-context class, safe aggregate
hash, expected/current version when authorized, outcome/code/duration,
dependency/retry class, idempotency reconciliation result, nonce receipt
outcome, migration cursor/state, audit/outbox counts, containment action, and
post-recovery checks. Store evidence in the approved incident system.

## Local verification

Run only against the local synthetic environment:

```bash
pnpm db:verify
pnpm exec vitest run \
  packages/contracts/src/content-schema-registry \
  apps/worker/src/content-schema-registry \
  apps/web/src/components/content-schema-registry \
  tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts \
  tests/security/phase-02-slice-09-release-boundary.test.ts
pnpm exec playwright test tests/e2e/phase-02-slice-09-content-schema-registry.spec.ts
pnpm build
pnpm bundle:check
pnpm progress:check
```

These commands are validation evidence, not production-readiness evidence.
`/verify-infrastructure` must record verifier/key rotation, origin, limiter,
queue/DLQ, outbox, rollback, and recovery drills before enabling the capability.

## Drill cadence

After contract, route, trust, migration, schema, Worker, or workbench changes,
exercise all eighteen operations; exact replay and mismatch; the successor, dry-run, review, decision, assignment and capability-grant chain through real producers; grant lapse and renewal; cross-tenant and
concealment denial; 128-field definitions; forged, revoked, stale, and replayed
release evidence; nested attestation mismatch; migration crash/resume; outbox
failure/replay; 429/502/503/504 recovery; offline/multi-tab invalidation-only
behavior; three responsive breakpoints; 200% zoom; keyboard/focus/live regions;
and secret/evidence-free responses, logs, events, caches, and bundles.
