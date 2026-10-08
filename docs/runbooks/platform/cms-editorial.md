# CMS editorial entry authoring

Trigger this runbook when a `cms.editorial.*` log event, a `cms_editorial_*` or
`cms_*` metric, or an editor report points at entry creation, autosave, conflict
resolution, revision history/comparison, restore, the entry list, or the
authoring-context read. Every one of those events carries
`attributes.runbook = "cms-editorial"` (`CMS_EDITORIAL_RUNBOOK`,
`apps/worker/src/cms-editorial-production-types.ts:96`; written to the event at
`apps/worker/src/cms-editorial-production-telemetry.ts:51`), alert route
`platform.on_call`, and alert class `cms_editorial_tier1` (reads) or
`cms_editorial_tier2` (commands).

This runbook covers the nine Slice 10 operations. The wiki runbook
[`.memory/wiki/operations/runbooks/cms-editorial.md`](../../../.memory/wiki/operations/runbooks/cms-editorial.md)
keeps the wider BE03b contract (review, scheduling, preview, publication);
use it for those. Local verification is not hosted acceptance: no Slice 10
hosted or production result is claimed here.

## Safety boundary

The database is canonical. The browser, the first-party web proxy and the Worker
are transports that forward an authority-checked request and verify the answer.
Never edit an entry, revision, conflict, presence lease, idempotency record,
audit row or outbox row by hand, never replay an unknown-outcome request
under a new `Idempotency-Key`, and never bypass authentication, acting context, assignment,
RLS, CSRF, `If-Match`, rate limits or deadlines to clear an incident.

Write incident notes with the UTC time, `requestId`, `correlationId`, `traceId`,
operation ID, outcome, error code, `entityIdHash` and `entityVersion` only.
Never record a field value, comment, token, cookie, CSRF value, `Idempotency-Key`,
entry ID, person ID, party name, cursor, signed-cursor key, request body or
SQL error text. The entry ID is logged only as `sha256:<hex>`; to find an entry,
hash the ID the reporting editor supplies and compare, never enumerate entries.
An editor's unsent local values stay in that browser; do not ask for them.

## Release state and what is not wired

- Telemetry is structured logs. The Worker emits the metrics below as keys of the
  log event's `metrics` map; the repository deploys no editorial alert rule. The
  Slice 09 operational-alert pipeline covers only the content-schema registry
  (`apps/worker/src/content-schema-registry/operational-alert-*.ts`). The BE03b
  thresholds (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2080`)
  are the intended alert contract; confirm a provider-side rule exists before
  treating silence as health.
- The Worker emits no `cms_conflict_one_open_violation_total`, `cms_review_*`,
  schedule, preview, publication, outbox or queue metric for these operations
  (review, schedule, preview and publication belong to Slice 11 and later).
- Hosted composition, key rotation and drills are unverified. A missing signed
  cursor key, workflow-policy projection or protected-validator freeze fails
  closed with a typed 503 and no payload.

## The nine operations

Browsers reach every operation except history through the first-party API routes
in `apps/web/src/pages/api/v1/cms/entries/`; the server-rendered pages make the same
reads in-process through `apps/web/src/components/cms-editorial-pages/cms-editorial-page-reads.ts`,
and the history read (CMS-03B-03) has no browser API route, only the revisions page.
Every path forwards over the private `PLATFORM_API` binding to the same path on the
API Worker (`packages/contracts/src/cms-editorial/routes.ts`). The Worker calls
`POST {SUPABASE_URL}/rest/v1/rpc/<rpc>` with `Content-Profile: platform_api`
(`apps/worker/src/cms-editorial-production-ports.ts`). Authority for every
operation is `cms.author` or `cms.editor` (CMS-03B-03 also admits `cms.reviewer`
as a reader) plus an active entry assignment, always server-derived.

| Operation    | Method and path                                                     | RPC                               | Per user / party per minute | Deadline | SLO tier |
| ------------ | ------------------------------------------------------------------- | --------------------------------- | --------------------------- | -------- | -------- |
| `CMS-03B-10` | `POST /api/v1/cms/entries`                                          | `cms_create_entry`                | 120 / 240                   | 15 s     | 2        |
| `CMS-03B-01` | `POST /api/v1/cms/entries/{entryId}/revisions`                      | `cms_create_revision`             | 120 / 240                   | 15 s     | 2        |
| `CMS-03B-02` | `POST /api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve` | `cms_resolve_conflict`            | 60 / 120                    | 15 s     | 2        |
| `CMS-03B-04` | `POST /api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore` | `cms_restore_revision`            | 30 / 60                     | 15 s     | 2        |
| `CMS-03B-03` | `GET /api/v1/cms/entries/{entryId}/revisions`                       | `cms_list_revisions`              | 300 / 600                   | 8 s      | 1        |
| `CMS-03B-11` | `GET /api/v1/cms/entries/{entryId}`                                 | `cms_get_entry_draft`             | 300 / 600                   | 8 s      | 1        |
| `CMS-03B-12` | `GET /api/v1/cms/entries/{entryId}/conflicts/{conflictId}`          | `cms_get_conflict_detail`         | 300 / 600                   | 8 s      | 1        |
| `CMS-03B-13` | `GET /api/v1/cms/entries`                                           | `cms_list_entries`                | 300 / 600                   | 8 s      | 1        |
| `CMS-03B-14` | `GET /api/v1/cms/entries/authoring-context`                         | `cms_get_entry_authoring_context` | 300 / 600                   | 8 s      | 1        |

RPC names, deadlines, rates and rate classes are the single declarations in
`apps/worker/src/cms-editorial-production-types.ts:32-93`; the SLO tiers are
Tier 1 p95 < 750 ms and Tier 2 p95 < 1,200 ms, protected RPC p95 < 300 ms
(`packages/contracts/src/cms-editorial/routes.ts:16-30`). Rate classes are
`cms-entry-write` (01, 04, 10), `cms-entry-conflict` (02) and `cms-entry-read`
(the five reads); a read never shares a bucket with a write. A successful 01, 02,
04 or 10 commits one immutable revision, one audit row and one
`cms.entry.revision-created.v1` outbox event `{ entryId, revisionId }`; the reads
write nothing and emit no event.

### Failure modes by operation

| Operation    | Failure modes an operator can see                                                                                                                                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CMS-03B-10` | 409 duplicate key or `IDEMPOTENCY_MISMATCH`; 422 typed value reason; 503 when the version's workflow-policy evidence, activation evidence, compiled artifact or protected-validator freeze is absent or stale (nothing written); 429.                                                                                               |
| `CMS-03B-01` | 409 `VERSION_MISMATCH` (stale `If-Match`/`expectedVersion`); 409 with `expectedVersion` and `currentVersion` when a same-field divergence recorded a durable conflict; `IDEMPOTENCY_MISMATCH`; 422 typed value reason; 429 from the database cap of three concurrent writes per actor; 503 as for create; 403 after authority loss. |
| `CMS-03B-02` | 409 `INVALID_TRANSITION` when the conflict is closed or superseded (the draft advanced); 409 `VERSION_MISMATCH`; 422 on an invalid choice (`/choices/{n}`); 404 for a closed, hidden or absent conflict (one concealed answer).                                                                                                     |
| `CMS-03B-03` | 400 malformed cursor/limit/compare/locale; 409 expired, tampered, foreign-key or foreign-scope cursor; 422 `comparison_too_large` / `comparison_unavailable`; 503 when the active signing key is missing.                                                                                                                           |
| `CMS-03B-04` | 409 `migration_chain_mismatch`, `migration_chain_unavailable`, `migration_chain_incomplete`, `template_incompatible`, `VERSION_MISMATCH`; `IDEMPOTENCY_MISMATCH`; 503 as for create; 404 for an unreadable or mis-lineaged source.                                                                                                  |
| `CMS-03B-11` | 404 concealment (hidden or absent entry), 403 for a visible entry without read scope, 400 malformed ID or unknown query key, 503. No 409 exists; an unexpected 409 from the database is published as a scrubbed 500.                                                                                                                |
| `CMS-03B-12` | The same 404 for hidden, wrong-scope, closed and absent conflicts (DEC-139); 403 for a visible entry without scope; 503.                                                                                                                                                                                                            |
| `CMS-03B-13` | 400 malformed filter/cursor structure; 409 expired, tampered or foreign cursor (restart from page 1); 503 when the active signing key is missing.                                                                                                                                                                                   |
| `CMS-03B-14` | 404 for an off-registry or foreign version, 403 without author/editor scope, 400 for a malformed selector, 503.                                                                                                                                                                                                                     |

Every refusal is a BE00 `ApiError` with a canonical message per code; the upstream
text never reaches a client (`apps/worker/src/cms-editorial/route-errors.ts`).

## Where a response came from

| Layer          | How to recognise it                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web proxy      | Refusal before dispatch (origin, CSRF, media type, header grammar, `If-Match` vs body `expectedVersion` disagreement as 422 `/expectedVersion`); no Worker event exists for it.                                                       |
| Web proxy, 5xx | `x-cms-editorial-outcome: unknown` (`apps/web/src/server/cms-editorial-platform-write.ts`): the write may have committed. The browser keeps its key and replays the byte-identical request.                                           |
| Worker         | One `cms.editorial.request` event per request, with `traceSteps` listing the stages it entered (`cms.admission`, `cms.authority`, `cms.rate_limit`, `cms.rpc`, `cms.response`). A request without `cms.rpc` never reached PostgreSQL. |
| PostgreSQL     | A whole-message `RAISE EXCEPTION '<token>'` (SQLSTATE `P0001`; `40001` only for the two CAS tokens) mapped by the closed table in `cms-editorial-production-error-tokens.ts`.                                                         |

## Metrics and log events

The route builds one event per request in `apps/worker/src/cms-editorial/route-telemetry.ts`
and the default sink writes it (`cms-editorial-production-telemetry.ts`). Label
values are closed sets, never request text. Outcome labels: `success`,
`rate_limited` (429), `denied` (401/403/404), `conflict` (409), `invalid`
(400/415/422), `failed` (everything else).

| Metric (as emitted)                                             | When                                                                                     | What it signals                                                                         |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `cms_editorial_request_total{operation,outcome}`                | every request                                                                            | Volume and outcome mix per operation. `failed` is the page-worthy label.                |
| `cms_editorial_latency_ms`                                      | every request                                                                            | End-to-end duration; compare with the SLO attributes below.                             |
| `cms_editorial_error_total{code,operation}`                     | status 400 and above                                                                     | Published `ApiError` code; an off-list code is labelled `UNREGISTERED`.                 |
| `cms_editorial_rate_limited_total`                              | 429                                                                                      | Per-user/party bucket or the three-writer cap tripped.                                  |
| `cms_editorial_conflict_total{operation,reason}`                | 409                                                                                      | `reason` is `VERSION_MISMATCH`, `IDEMPOTENCY_MISMATCH` or `INVALID_TRANSITION`.         |
| `cms_revision_created_total`                                    | 2xx of 01, 02, 04, 10, not on an idempotent replay                                       | Committed revisions; a replay returns the first revision and is not counted.            |
| `cms_revision_validation_failed_total`                          | 422 of 01, 02, 10                                                                        | Value refusals (typed reasons or `VALIDATION_FAILED`).                                  |
| `cms_conflict_open_total`, `cms_conflict_records_created_total` | a CMS-03B-01 409 naming `expectedVersion` and `currentVersion` (a conflict was recorded) | A durable same-field conflict was committed.                                            |
| `cms_conflict_closed_total`                                     | 2xx of 02                                                                                | A conflict was resolved.                                                                |
| `cms_entry_create_total{outcome}`                               | every CMS-03B-10                                                                         | Create outcome mix.                                                                     |
| `cms_entry_create_replayed_total`                               | CMS-03B-10 answered from the stored outcome                                              | Lost-response retries that were absorbed.                                               |
| `cms_entry_create_conflict_total`                               | CMS-03B-10 409                                                                           | Duplicate key or idempotency mismatch on create.                                        |
| `cms_entry_draft_detail_total{outcome}`                         | every CMS-03B-11                                                                         | Draft read outcome mix.                                                                 |
| `cms_entry_draft_detail_denied_total`                           | CMS-03B-11 401/403/404                                                                   | Denials; a spike after a grant change or authority loss is expected, otherwise a probe. |
| `cms_presence_active`                                           | each presence-sweep tick (`cms_edit_presence_sweep.completed`)                           | Presence leases still `active` after the sweep.                                         |

Safe counts ride in the same map (never values): `changed_paths`, `choices`,
`restore_edge_count`, `items_returned`, `changes_returned`, `fields_returned`,
`relations_returned`, `paths_returned`, `types_returned`, plus `request_status`
and the policy SLO attributes `slo_command_p95_ms`, `slo_protected_rpc_p95_ms`
and `slo_acceptance_p99_ms`. Request events also carry `operation`
(`cms.editorial.CMS-03B-NN`), `outcome` (`success`, `rejected` for 4xx,
`failure` for 5xx), `errorCode`, `retryable` (true only for 429, 503, 504),
`traceId`, `correlationId`, `actorClass`, `actingContextClass`, `entityIdHash`
and `entityVersion`. Every event is sampled always, and a non-success event is
marked high risk.

Event names and double counting: `cms.editorial.request` is written for every
request. A command (01, 02, 04, 10) also writes `cms.editorial.command`, writes
`cms.editorial.rpc` only if `cms.rpc` was entered, and writes
`cms.editorial.acceptance` only on success. Those three repeat the request
event's `metrics` map, so aggregate metrics from `cms.editorial.request` only or
every command counts several times.

## Alert triage: typed reasons

Read `errorCode`, then `details.reasonCode` or `details.conflict`. A reason is
published only if it is in the closed vocabulary
(`apps/worker/src/cms-editorial/error-vocabulary.ts`); everything else is dropped
at the boundary. Operator action means what an operator may do; none of these
authorizes editing data.

| Token (SQL message)                                                                                              | Published as                                                    | Meaning                                                                                                                                                                                                 | Operator action                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VALIDATION_FAILED`                                                                                              | 422, `details.violations[{path,code,message}]` (at most 50)     | A value, pointer or evidence failed the active schema. Paths are RFC 6901, for example `/fields/{stableFieldId}`.                                                                                       | Caller-owned. A burst right after a schema activation points at client/schema drift: check the activation with the schema owner.                                                |
| `rich_text_not_canonical`, `object_kind_unspecified`, `object_property_invalid`                                  | 422, `details.reasonCode`                                       | The value is not a canonical `rich_text.v1` document, or an object field has no typed structure or breaks it.                                                                                           | Caller-owned. A spike for valid editor output suggests TypeScript/PostgreSQL grammar drift: run the parity corpus `supabase/tests/phase_02_slice_10_rich_text_link_parity.sql`. |
| `relation_target_unavailable`                                                                                    | 422, `reasonCode`                                               | A relation target is hidden, archived, of another type or moved past its pinned version.                                                                                                                | Caller-owned. Ask the editor to relink; never loosen visibility to clear it.                                                                                                    |
| `taxonomy_source_unavailable`, `media_source_unavailable`                                                        | 422, `reasonCode`                                               | A non-empty taxonomy or media value was submitted while no provider exists; empty values are stored.                                                                                                    | Expected until those providers land. Do not insert rows around it.                                                                                                              |
| `comparison_too_large`, `comparison_unavailable`                                                                 | 422 on CMS-03B-03, `reasonCode`                                 | More than 512 combined changes, or a recorded version/lineage that cannot be resolved (nothing disclosed).                                                                                              | `comparison_too_large`: compare closer revisions. `comparison_unavailable` in volume: escalate with identifiers (lineage or compiled-artifact drift).                           |
| `VERSION_MISMATCH`, `STALE_EDIT_PRESENCE`                                                                        | 409 `conflict: VERSION_MISMATCH`, `recoveryAction: reload`      | The entry moved on. `STALE_EDIT_PRESENCE` needs a caller that presents a presence version; autosave renewal sends none.                                                                                 | Expected under concurrent editing. Many `STALE_EDIT_PRESENCE` events mean an unknown caller: escalate.                                                                          |
| `INVALID_TRANSITION`, `CONFLICT`                                                                                 | 409 `conflict: INVALID_TRANSITION`, `recoveryAction: refresh`   | Closed or superseded conflict, expired/tampered/foreign list or history cursor, an inactive schema version, a lock deadlock victim.                                                                     | Restartable: refresh and retry. A cursor storm after a key change is expected (see the signing key section).                                                                    |
| `IDEMPOTENCY_MISMATCH`, `IDEMPOTENCY_CONFLICT`                                                                   | 409 `conflict: IDEMPOTENCY_MISMATCH`, `use_new_idempotency_key` | The key was already bound to a different request, actor or acting party.                                                                                                                                | Caller bug unless it follows a client release; the first outcome is never overwritten.                                                                                          |
| `migration_chain_mismatch`, `migration_chain_unavailable`, `migration_chain_incomplete`, `template_incompatible` | 409 `conflict: INVALID_TRANSITION`, `refresh`, `reasonCode`     | Restore chain failure; see the restore section.                                                                                                                                                         | See the restore section.                                                                                                                                                        |
| `RATE_LIMITED`                                                                                                   | 429 with `Retry-After` (60 s for the database cap)              | A per-user or per-party bucket, the Worker pre-filter, or the database cap of three concurrent writes per actor.                                                                                        | Wait. A sustained rate without an editor surge is a runaway client: find it by `actorClass` and `rate_class`, not by identity.                                                  |
| `DEPENDENCY_UNAVAILABLE`                                                                                         | 503, `details.dependencyClass`, `retryable`, `Retry-After` 5 s  | A required dependency is missing: signing key, workflow-policy evidence, activation evidence, compiled artifact, protected-validator freeze, exactly one active schema version, or the database itself. | Not caller-fixable. Identify the class below, restore the dependency through its owner, then retry.                                                                             |
| 502 `BAD_GATEWAY`, 504 `GATEWAY_TIMEOUT`                                                                         | `dependencyClass: cms_editorial`                                | The database answer failed the strict response contract, or the 8 s / 15 s deadline passed.                                                                                                             | 502 is a contract drift between SQL and contracts: escalate, do not retry. 504: the write may have committed, so reconcile before any retry.                                    |
| `INTERNAL_ERROR` and any unregistered plain `P0001`                                                              | scrubbed 500, `details: {}`                                     | A database invariant failed or the database raised a token this table does not know.                                                                                                                    | Escalate with request and correlation IDs. Never reword it as a caller error.                                                                                                   |

Concealment: absent, hidden and cross-tenant targets return one empty-detail 404;
a visible target without the capability returns 403. Do not use a 404 vs 403
difference to learn what exists.

### DEPENDENCY_UNAVAILABLE classes

1. Signing key: first page of a list or history read fails for everyone. See the
   next section.
2. Workflow-policy evidence, activation evidence, compiled artifact or
   `editor_manifest.validators` freeze: create, append, resolve and restore fail
   for entries of one content type only. The migrations that raise these are
   `20261005012300_cms_write_commands_hardening.sql` and
   `20261005012400_cms_restore_hardening.sql`
   (`cms_validators_frozen_current`, `cms_editorial_workflow_policy_valid`). The
   freeze must equal the registry descriptor for `rich_text.v1`@1
   (`cms/validators/rich_text.v1/v1`). Escalate to the content-schema owner; a
   recompile and activation through CMS-03A is the only repair, never a row edit.
3. Not exactly one active schema version for the entry's type, or a stored base
   value that no longer validates: escalate with the operation ID and entry hash.
4. PostgREST, Kong or the database unreachable: use the platform operational
   endpoints runbook and stop promotion.

## Signed cursor key (Vault)

CMS-03B-03 history and CMS-03B-13 list cursors are HMAC-SHA-256 envelopes
(`base64(JCS({...payload, keyId, signature}))`, at most 512 characters, expiry at
most 24 hours) opened and sealed by
`platform_private.cms_signed_cursor_require_key`, `cms_signed_cursor_open` and
`cms_signed_cursor_seal_page` (`20261005010400_cms_revision_comparison_domains.sql`).
The two cursor kinds sign under separate domains (`cms-03b-03`, `cms-03b-13`) but
share one per-environment key.

Secret names, exactly:

- Active: `cms_editorial_history_cursor_active`, value 64 lowercase hexadecimal
  characters (32 random bytes). It is the only secret that signs new pages.
- Retired: a name starting `cms_editorial_history_cursor_retired_`. It verifies
  old cursors only while its Vault `updated_at` is within the last 24 hours. Any
  other name, or no name, never verifies a cursor.

No migration, fixture or repository file provisions an operational value. Without a
valid active secret, every first-page read of CMS-03B-03 and CMS-03B-13 is
`DEPENDENCY_UNAVAILABLE` (503) with no payload, so a missing key shows on the
first request, not on the second page.

Provision (new environment):

1. Generate 32 random bytes as 64 lowercase hex characters on a trusted
   workstation. Paste the value only into the Supabase Vault create-secret form
   with the name above. Do not run it through a shell argument, SQL editor
   history, ticket, log, URL or chat.
2. Verify with a real authorized session: `GET /api/v1/cms/entries?limit=1` returns
   200, not 503. With two or more visible entries the response carries a
   `nextCursor` of at most 512 characters, and the continuation returns 200.

Planned rotation:

1. Rename the current secret first, with a statement that contains no secret value:

   ```sql
   select vault.update_secret(
     '<secret id>'::uuid,
     new_name => 'cms_editorial_history_cursor_retired_<yyyymmdd>'
   );
   ```

   The rename sets `updated_at`, which starts the 24-hour window; do not update
   that secret again or the window restarts.

2. Create the new active secret immediately (Provision, step 1). Between the rename
   and the create, first-page reads return 503.
3. Verify that a cursor issued before the rotation still returns 200 and that a
   new first page signs with the new key. Delete the retired secret after 24 hours.

Suspected compromise: delete the old secret at once, create a new active secret,
and expect every outstanding cursor to answer 409 `CONFLICT`; clients restart from
page 1 (the list page does this automatically). The local pgTAP key is test data
created only inside a rolled-back transaction.

## Idempotency and lost-response reconciliation

Every command (01, 02, 04, 10) requires an `Idempotency-Key` of 8 to 128 printable
ASCII characters, reserved before any write (`cms_reserve`,
`20260930150000_cms_idempotency_business_hash.sql`) and bound to the operation
name (`CMS-03B-NN`), the actor, the normalized request and the acting party. A
record lives 30 days and is removed only by the audited TTL sweep
(`docs/runbooks/platform/retention.md`).

- Exact replay: the stored first response comes back and the database sets the
  private header `x-cms-idempotent-replay: true`. The Worker reads it
  (`cms-editorial-production-ports.ts`, `REPLAY_HEADER`) and never forwards it.
  A replay creates nothing and is not counted as a second revision.
- Same key, different body, actor or acting party: 409 `IDEMPOTENCY_MISMATCH`;
  the first binding is never replaced.
- Unknown outcome: a lost response, a post-dispatch 500/502/503/504 or an
  unverifiable 2xx. The web proxy marks it `x-cms-editorial-outcome: unknown`;
  only then may the browser replay the byte-identical request with the same key.
  A response without the marker is definite and the client rotates its key.
- Operator reconciliation of an unknown outcome: do not replay it yourself. Read
  the canonical state through the authorized draft read (CMS-03B-11): its
  `entry.version` and `revisionNumber` show whether the command committed. A
  committed create or append shows exactly one revision, one audit row and one
  `cms.entry.revision-created.v1` event; restore also commits one
  `cms.entry.revision.restore.chain` audit row and one
  `cms.entry.revision-restored.v1` event whose payload is identifiers, the chain
  hash and counts only (`entryId`, `revisionId`, `sourceRevisionId`,
  `migrationChainId`, `chainHash`, `edgeCount`, `valueCount`, `relationCount`).
  Event consumers deduplicate by event identity; follow
  `docs/runbooks/platform/jobs-outbox-reconciliation.md` for a stuck event.
- Concurrency cap: the database takes one of three per-actor advisory slots in
  `cms_create_revision` after the replay check and before the first insert
  (`cms_acquire_revision_write_slot`, `20261005012100`); a fourth writer gets
  `RATE_LIMITED` with nothing committed. The Worker's in-isolate counter of
  three (`apps/worker/src/cms-editorial-production.ts:54`) is only a pre-filter.
- Next version: after a 201, the next `If-Match` is the response's `entryVersion`
  (also the quoted ETag `"{entryVersion}"`), never the revision's own `version`,
  which is always `1`.
- A deadlock between two writers that reference each other's entries is a
  typed 409 `CONFLICT` and the loser commits nothing. Any other deadlock victim
  (SQLSTATE `40P01`) also rolls back completely; replay the same request with
  the same key.

## Edit presence (Worker cron)

Presence is an advisory, per-person, per-entry two-minute lease. It never blocks
another editor and is never a browser or HTTP command: every authorized autosave
renews it inside the CMS-03B-01 transaction (`cms_touch_edit_presence`,
`20261005010600_cms_edit_presence_lease.sql`), and the only `platform_api` presence
function is the service-role sweep.

- Revocation: losing a capability grant, membership tenure or entry assignment
  releases the active lease in the same transaction (three triggers, for example
  `cms_entry_assignments_edit_presence_revocation`). Per DEC-143, losing a grant or
  tenure also revokes the person's now-unproven entry assignments
  (`20261005011300`); re-granting never resurrects an assignment.
- Expiry: the existing one-minute scheduled event (`apps/worker/wrangler.jsonc`,
  cron `* * * * *`) starts `runProductionCmsEditPresenceSweep` with
  `Promise.allSettled` beside the outbox, TTL, review-authority and alert tasks
  (`apps/worker/src/index.ts:201-250`). Each tick calls
  `platform_api.cms_expire_edit_presence_leases(p_batch: 500)` once; SQL accepts
  1 to 5000, locks rows with `SKIP LOCKED`, and marks lapsed `active` leases
  `expired` (never `revoked`: expiry records a lapse, not lost authority). A full
  batch leaves the rest for the next tick.
- Result and signals: the RPC answers exactly `{ expiredLeases, activeLeases }`.
  Success logs `cms_edit_presence_sweep.completed` (service `wejammin-worker`)
  with `expiredLeases` and the `cms_presence_active` gauge. A dependency failure
  logs `cms_edit_presence_sweep.failed` with `DEPENDENCY_UNAVAILABLE` or
  `DEPENDENCY_INVALID_RESPONSE` and retries on the next scheduled event; a typed
  manual-review failure logs `cms_edit_presence_sweep.manual_review_required` and
  is not retried. Other tasks in the same tick still run.
- Triage: a rising `cms_presence_active` with `expiredLeases` stuck at 0 means the
  sweep is failing or not running; check the failed/completed events, never
  edit `cms_edit_presence` rows. Stale presence rows affect only the advisory
  indicator; saving and conflict handling do not depend on them.

## Restore chain failures

CMS-03B-04 never edits or activates the source revision. It re-derives the
immutable chain manifest (`cms_restore_chain_manifests`) from completed 03a
migration-plan edges, requires the request's `migrationChainId` to equal it, then
appends one new draft with `parentRevisionIds = [currentDraftRevisionId,
sourceRevisionId]` (`20261005010500_cms_restore_chain_manifest.sql`). A same-schema
restore is the zero-edge chain; the chain is capped at 64 edges (65 schema
versions, `restore_edge_count` in telemetry).

| Reason                        | Cause                                                                                                                                                                                                  | Operator action                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migration_chain_mismatch`    | The submitted `migrationChainId` differs from the one re-derived from the completed plan edges.                                                                                                        | Re-read the comparison to get the current `compare.restore` descriptor for the left revision and retry once. Persistent: escalate.                  |
| `migration_chain_unavailable` | The chain is ambiguous, unreachable or over 64 edges, an edge is not completed, not consecutive or lacks the target version's activation evidence, or the active version has a further completed edge. | Not caller-fixable; the schema owner reviews the 03a plans. A foreign edge is invisible under RLS and so is indistinguishable from an absent one.   |
| `migration_chain_incomplete`  | A transform is unregistered or cannot prove an edge, a value or relation fails the target schema, a required field has no literal default, or a pinned taxonomy version no longer resolves.            | Nothing is fabricated and the source is unchanged. Collect operation ID and entry hash; the editor restores a nearer revision or fixes the content. |
| `template_incompatible`       | The source revision's template binding no longer resolves against the active version through the BE03c compatibility gate.                                                                             | Escalate to the template owner; do not rebind.                                                                                                      |

Also: stale `If-Match` is 409 `VERSION_MISMATCH`; the restore requires the same
workflow-policy and protected-validator evidence as an append (503 otherwise), and
a restore supersedes any open conflict of the entry in the same transaction.
Taxonomy-version resolution and composition-instance translation remain Slice 12
obligations (DEC-141); until they land, restore of a revision pinned to an
unresolvable taxonomy version refuses with `migration_chain_incomplete`.

## Local verification

Use the pinned toolchain (`~/.local/share/wejammin-toolchain/bin` on this host). The
focused proofs for this runbook are:

- `pnpm exec vitest run apps/worker/src/cms-editorial apps/worker/src/cms-editorial-production`
  (routes, error table, telemetry, rate scope, cancellation, restore chain).
- `pnpm exec vitest run apps/web/src/server apps/web/src/pages/api` (proxies and the
  outcome-unknown contract).
- `pnpm db:test` for the pgTAP files `supabase/tests/phase_02_slice_10_*.sql`, then
  `pnpm db:races` for the lock and cap runners
  (`supabase/tests/phase_02_slice_10_races/README.md`).
- `pnpm db:api-test` runs `tests/postgrest/cms-editorial-composition*.apispec.ts`:
  browser request, web proxy, Worker, production adapter, PostgREST and the newest
  SQL. Run `pnpm db:reset` before and after.

None of these is hosted acceptance, and a green run does not clear an incident.

## Escalation and stop conditions

Escalate through `platform.on_call` with identifiers only. Stop automatic recovery
and escalate at once for: any published `INTERNAL_ERROR` or `BAD_GATEWAY` burst,
a field value, token, cursor, key or entry ID in a log or response, a 404/403 that
discloses existence, a duplicated entry or revision after a replay, a committed
write without its audit row or outbox event, an editor able to write after losing
authority, or a signing key observed outside the Vault. Preserve the redacted
evidence; do not declare Slice 10 operationally accepted from this runbook.

## Related material

- BE03b: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (Observability at
  `:2068`, security and abuse controls at `:1964`, error coverage at `:2044`).
- [Jobs and outbox reconciliation](./jobs-outbox-reconciliation.md),
  [Retention](./retention.md), [SLO](./slo.md),
  [Operational endpoints](./operational-endpoints.md).
- Code: `apps/worker/src/cms-editorial/README.md`,
  `apps/web/src/server/README.md`, `supabase/migrations/README.md`.
