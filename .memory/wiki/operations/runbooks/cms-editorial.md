# CMS editorial entry and publication runbook

## Scope and release state

The CMS editorial on-call owns BE03b operations `CMS-03B-01` through
`CMS-03B-11`, private entry/revision authority, protected authoring reads,
review, scheduling, preview, publication, audit, and outbox effects. This
runbook describes the contract and recovery procedure; its presence does not
mean a route is deployed or a Slice 10 acceptance criterion has passed. Check
the exact deployment, migration, progress tracker, and operation inventory
before enabling or diagnosing a capability.

## Authority and route map

| Operation    | Method and path                                                     | Required authority and precondition                                                              |
| ------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `CMS-03B-10` | `POST /api/v1/cms/entries`                                          | `cms.author` or `cms.editor`, active compiled content type, idempotency key; no prior `If-Match` |
| `CMS-03B-11` | `GET /api/v1/cms/entries/{entryId}`                                 | assigned protected reader; no mutation header; no-store ETag for entry and draft versions        |
| `CMS-03B-01` | `POST /api/v1/cms/entries/{entryId}/revisions`                      | assigned author/editor, readable positive base revision, idempotency key and exact `If-Match`    |
| `CMS-03B-02` | `POST /api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve` | assigned author/editor, explicit conflict choice, key and CAS                                    |
| `CMS-03B-03` | `GET /api/v1/cms/entries/{entryId}/revisions`                       | assigned protected reader; bounded keyset history, no draft values                               |
| `CMS-03B-04` | `POST /api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore` | editor with readable source revision, migration-chain recheck, key and CAS                       |
| `CMS-03B-05` | `POST /api/v1/cms/entries/{entryId}/reviews`                        | assigned submitter, dependency preflight, key and CAS                                            |
| `CMS-03B-06` | `POST /api/v1/cms/reviews/{reviewId}/decision`                      | assigned reviewer, protected-step-up MFA where required, key and CAS                             |
| `CMS-03B-07` | `POST /api/v1/cms/publication-schedules`                            | publisher with visible entry/revision, step-up MFA, key and CAS; 202 is acceptance only          |
| `CMS-03B-08` | `POST /api/v1/cms/previews`                                         | authorized preview scope, audience-bound token, key and revision/version-set CAS                 |
| `CMS-03B-09` | `POST /api/v1/cms/publications`                                     | publisher with frozen approval/dependency set, key and CAS; 202 is acceptance only               |

All authority comes from the authenticated server context and current private
capability, assignment, and ownership records. Browser-supplied owner,
assignee, actor, party, capability, or approval assertions are never trusted.
Private editorial tables remain inaccessible directly to browser roles.
Concealed or absent targets return an indistinguishable 404; a visible target
without the required assignment/capability returns a safe 403. Protected
reads never degrade to anonymous, untyped, cached, or cross-tenant content.

## History cursor signing key

`CMS-03B-03` signs its outward keyset cursor in the service-role database API
wrapper. The underlying unsigned reader is private and ungranted to browser
or service roles. Each environment needs one owner-provisioned Supabase Vault
secret named `cms_editorial_history_cursor_active`, containing 32 random bytes
encoded as 64 lowercase hexadecimal characters. No migration, fixture, or
repository setting provisions an operational value. Without a valid active
secret, the bound production Worker port maps the database refusal to a typed
`DEPENDENCY_UNAVAILABLE` 503 with no history payload. Do not claim hosted
acceptance until the owner provisions and verifies that environment's secret.

For planned rotation, rename the old Vault secret to a name beginning
`cms_editorial_history_cursor_retired_`, then create a new active secret.
Keep the old record for the 24-hour cursor lifetime; the verifier accepts a
freshly retired key for at most one day and every cursor still carries its own
expiry and actor/party/filter binding. For suspected compromise, remove the old
secret immediately and have clients restart pagination from the first page.
Never put key material in a ticket, log, URL, migration, or chat. The local
pgTAP key is fixed test data created only inside a rolled-back transaction.

## Detection and immediate containment

Inspect per-operation request rate, latency, typed errors, idempotency and
version conflicts, assignment denial, schema-evidence failure, outbox age,
queue attempts, DLQ depth, and publication convergence. Follow the BE00 and
BE03b alert thresholds; do not substitute a local test or staging sample for
post-launch AC211 traffic evidence.

1. Record environment, exact deployed SHA, migration identity, operation ID,
   request/correlation ID, outcome, safe aggregate/version hashes, and first
   observed time. Keep bodies and credentials out of incident notes.
2. Pause only the affected write, scheduler, preview issuer, or outbox consumer.
   Continue protected reads only if authority and freshness remain verifiable.
3. Do not bypass authentication, acting context, capability/assignment, RLS,
   CSRF, idempotency, CAS, schema validation, review/MFA, deadlines, or rate
   limiting to clear an incident. Never mutate a private entry row manually.
4. If authority or current draft cannot be established, fail closed. Preserve
   an editor's unsent local values without sending them to logs, analytics,
   Realtime, or a URL.

## Diagnosis

1. Confirm the Worker is serving the exact operation registry and strict
   request/response contracts. Check the current compiled schema artifact,
   content-type version, workflow policy, validator references, and active
   activation evidence before interpreting a field error.
2. For `CMS-03B-10`, reconcile the idempotency reservation with the entry,
   first immutable draft revision, normalized field/relation rows, initial
   assignment, audit, and outbox event in one transaction. No refused or
   replayed create may leave an orphan or duplicate aggregate.
3. For `CMS-03B-11`, verify that the entry and current draft revision are
   readable by this actor, field values match the active schema, provenance is
   explicit, and the strong ETag binds both canonical versions. Confirm
   `Cache-Control: no-store` and zero mutation side effects.
4. For `CMS-03B-01` and conflict/restore writes, compare the authorized base
   revision, changed paths, entry version, `If-Match`, parent IDs, and current
   assignment. A same-field divergence requires explicit resolution; it must
   not silently overwrite either value.
5. For review, scheduling, and publication, verify immutable approval and
   dependency evidence, protected step-up context, exact version set, worker
   lease/CAS, projection state, and audit/outbox. A 202 response is pending
   acceptance, never proof of publication.
6. For an unknown result after timeout, inspect canonical idempotency state,
   aggregate version, audit, and outbox before any retry. Retries use the
   original key only for the identical operation, actor/party, path, body hash,
   and expected-version binding.

## Recovery and stop conditions

After a safe conflict, refetch the authorized canonical draft and retain
unsent local input for an explicit choice. Requeue only a canonical outbox
event by event identity; consumers deduplicate by event and aggregate version.
Resume a scheduler only from durable lease and version evidence. Restore a
protected route only after cross-tenant denial, concealed 404, visible 403,
replay/mismatch, CAS, rollback, audit/outbox failure, no-store read, and
browser-data-exclusion checks pass against the affected build.

Stop automatic recovery and escalate for cross-tenant disclosure, browser
access to a private table, missing server-derived authority, duplicate entry
or revision on replay, mutable immutable evidence, publication without frozen
approvals, missing atomic audit/outbox, leaked field/review/token material, or
an irreconcilable canonical result. Preserve redacted evidence; do not
declare Slice 10 complete from this runbook or local checks alone.

## Local verification and evidence

Use the pinned project Node/pnpm versions. Run `pnpm db:verify`, applicable
contracts/Worker/web tests, `pnpm validate`, `pnpm progress:check`, and
`git diff --check` on the exact worktree under review. Capture test totals,
failed/skipped checks, migration identity, and generated contract inventory.
The Slice 10 tracker records individual acceptance criteria only after their
contract, implementation, test, and operational evidence is present. Hosted
and device evidence gates retain their separate timing and must not be
inferred from local or synthetic tests.
