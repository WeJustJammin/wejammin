# BE 05c — Portability, quality and lifecycle

## Split Group

This companion is the backend contract for Shard 05 portability, quality and
data-lifecycle operations. It owns CFG-13 and CFG-14 and the 25.10 feature
family:

- 25.10.01 Import, Mapping, Validation & Dry Run
- 25.10.02 Export, Backup, Restore & Portability
- 25.10.03 Accessibility & Content Quality Gates
- 25.10.04 Retention, Legal Hold & Erasure

05a owns settings and runtime configuration. 05b owns admin workspace,
capabilities, audit links and diagnostics. Shard 03 and Shard 04 retain
canonical CMS records and media. Shard 06 retains safety cases, legal
restrictions and evidence truth. This split orchestrates bounded jobs and
stores proof; it cannot import authority, ownership, consent, verification,
money, rights, legal status or evidence as truth.

## Phase 2 Scope and Environment Constraints

Phase 2 builds every operation in this companion, including CFG-05C-01 import,
export and restore verification (DEC-114, 2026-10-02). Nothing below is
deferred to a later phase except production restore promotion, which this file
does not specify.

### Hosted-plan constraints

- Supabase Free has no point-in-time recovery, no uptime SLA and no RPO or RTO
  claim (DEC-104, BE00 and ENGINEERING-STANDARDS Availability and Recovery).
  Protected money, rights and publication writes therefore stay disabled.
- Export bundles and restore verification are diagnostic portability evidence.
  A `verified` RestoreVerification never reopens protected writes, never
  records recovery-readiness evidence and never changes the restore-fence epoch.
- Restore targets only a registered isolated non-production environment. No
  operation in this file restores into or promotes to a production environment,
  and no promotion command exists in Phase 2. (Import writes drafts only into
  the environment that serves the request, through that environment's ordinary
  commands.) The production gate
  stays `docs/runbooks/platform/release-recovery-gates.md`; the
  `reviewer_person_id` column stays NULL until a promotion command is
  separately specified under an owner-approved recovery capability.
- The hosted per-file cap is the recorded plan-limit profile of 52,428,800
  bytes (50 MiB, DEC-116). It applies to import source objects, import
  quarantine objects and export artifacts. A larger payload is refused with
  typed 422 PORTABILITY_LIMIT_EXCEEDED. The 5 GiB BE00/BE04b contract ceiling is
  unchanged and applies only after a plan upgrade records a larger profile.

### Release-registered constants

These are code-owned release constants, not ordinary settings, because they
bound security and plan limits (IA05 protected exclusions). Each value below
reuses an existing limit named in the Source column.

| Constant | Value | Source |
|---|---|---|
| PORTABILITY_MAX_OBJECT_BYTES | 52,428,800 | DEC-116 Phase 2 plan-limit profile |
| PORTABILITY_MAX_ROWS | 500 | Existing ImportJob counter bound and 500-entry manifest bound in this file |
| PORTABILITY_MAX_ROW_BYTES | 65,536 | Existing JsonValue 64 KiB bound in this file |
| PORTABILITY_BATCH_ROWS | 50 | ENGINEERING-STANDARDS 50-row list and batch bound |
| PORTABILITY_ERROR_SAMPLE_ROWS | 50 | Same 50-row bound |
| EXPORT_MAX_TTL | 7 days | IA05 seven-day bounded grant term |
| EXPORT_MAX_DOWNLOADS | 3 | Existing maxDownloads bound |
| DOWNLOAD_MAX_CONCURRENT | 3 per user | BE00 concurrent upload limit |
| VERIFIER_LEASE_MS | 120,000, heartbeat at most every 30,000 | BE00 platform.object.verify two-minute lease |
| VERIFIER_MAX_ATTEMPTS | 3 | Existing three-attempt dead-letter rule in this file |
| CHECKER_TIMEOUT_MS | Registered per checker version, 100 to 2,000; cms.a11y.structural version 1 is 2,000 | Existing 100..2,000 ms stored-checker range in this file |
| QUALITY_RUN_REUSE_SECONDS | 900 | BE00 15-minute signed-transfer window |
| FINDINGS_STORED_MAX | 500 | Existing 500-entry manifest bound |

## Classification

| IA interaction | Operation ID | Backend classification | Authority and completion |
|---|---|---|---|
| CFG-13 Import/export/restore | CFG-05C-01 | Protected portability command with two-step import (dry run, then explicit commit or cancel), scoped asynchronous export with explicit revoke, and isolated restore verification request | Source and target manifests are explicit and hashed; imports are source-marked claims written as drafts only; exports expire; a restore verification is executed by an isolated verifier and never promotes. |
| CFG-13 Import/export/restore | CFG-05C-03 | Portability record list read | Cursor page of capability-filtered import, export and restore summaries; no total count. |
| CFG-13 Import/export/restore | CFG-05C-04 | Portability record detail read | One record with dry-run report, import row results, export metadata or restore check vector. |
| CFG-13 Import/export/restore | CFG-05C-05 | Export download claim | Atomic grant, expiry, revocation and download-count recheck before any byte is streamed. |
| CFG-13 Import/export/restore | CFG-05C-08 | Internal restore-verifier lease, heartbeat and report command | Service-principal pull model; the verifier reports evidence and the server derives the terminal state. |
| CFG-13 Import/export/restore | CFG-05C-09 | Internal restore-verifier artifact read | Leased byte read for the verifier only; audited and never counted as an operator download. |
| CFG-14 Run quality/retention action | CFG-05C-02 | Registered quality-check command and privacy/legal lifecycle workflow | Checker versions and exact target versions produce evidence; lifecycle actions use cross-store manifests, legal holds and truthful partial completion. |
| CFG-14 Run quality/retention action | CFG-05C-06 | Quality and lifecycle record list read | Cursor page of capability-filtered quality-run and lifecycle-request summaries; no total count. |
| CFG-14 Run quality/retention action | CFG-05C-07 | Quality and lifecycle record detail read | One run with a findings page, or one lifecycle request with a store-result page. |

## Referenced Material Inventory

| Source | Sections and exact lines | Use in this companion |
|---|---|---|
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | title, links and scope lines 1-22 | Confirms the parent boundary, three-way split and deferred enterprise administration. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Features and acceptance criteria lines 24-45 | Binds feature IDs 25.10.01 through 25.10.04 and all import, export, restore, quality and lifecycle failure behavior. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Interactions and global rules lines 47-71 | Supplies exact CFG-13 and CFG-14 identifiers and the no-authority-import boundary. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Contracts lines 98-106 | Supplies import mapping, export allowlist, isolated restore, quality blockers and hold/erasure contracts. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Data Models and typed registry lines 108-152 | Supplies ImportJob, ExportArtifact, RestoreVerification, QualityCheckRun and DataLifecycleRequest. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Access Control and escalation lines 154-187 | Supplies privacy/legal operator, support purpose grant and no-override escalation. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Accessibility lines 189-197 | Supplies accessible import mapping, restore verification and checker findings. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Event Schemas lines 199-211 | Supplies quality.lifecycle.changed.v1 and the identifier-only event envelope. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Edge cases and matrix lines 213-258 | Supplies protected-field export, restore false confidence, publish blocker and hold/shared-record conflict recovery. |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | scope and deepening record lines 1-18 | Confirms portability and lifecycle boundaries and adversarial convergence. |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | portability, quality and lifecycle models lines 35-55 | Expands import, export, restore, check, lifecycle and store-result fields. |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | state machines lines 57-69 | Locks import, export and lifecycle transitions, including blocked and partial outcomes. |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | portability algorithms lines 106-121 | Locks private upload, mapping, dry run, allowlist, encryption, isolated restore and proof requirements. |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | quality/lifecycle algorithms lines 123-130 | Locks checker blockers, cross-store manifest, hold sealing and shared-record exception handling. |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | abuse/recovery and cross-shard lines 132-162 | Locks export exfiltration, count-only restore failure, evidence preservation and provider boundaries. |
| .memory/wiki/specs/feature-ledger.md | Shard 05 rows lines 785-788 | Reconciles every assigned 25.10 feature row to an operation and test surface. |
| .memory/wiki/specs/be/00-infrastructure.md | inventory, ApiError and contracts lines 22-41 and 112-138 | Inherits RequestContext, strict Zod 4 and exact ApiError { code, message, requestId, details }. |
| .memory/wiki/specs/be/00-infrastructure.md | database, middleware, jobs and provider boundaries lines 202-365 | Inherits private schema, RLS, middleware, idempotency, queue retry, object and provider circuit rules. |
| .memory/wiki/specs/be/00-infrastructure.md | errors, observability, tests and ambiguity lines 416-534 | Inherits typed status mapping, scrubbed telemetry, recovery proof and quality gates. |
| .memory/wiki/specs/2026-08-02-architecture-design.md | stack, access and integration lines 157-167, 348-370 and 495-502 | Confirms Hono/Zod/Workers, server-derived authorization, PostgreSQL authority and replaceable storage/provider seams. |
| .memory/wiki/specs/2026-08-02-architecture-design.md | data/security lines 638-655, 707-765 and 900-907 | Confirms PostgreSQL/RLS source, Storage metadata boundary, secrets exclusion, BOLA/BOPLA and allowlisted APIs. |
| .memory/wiki/specs/data-placement-strategy.md | placement and isolation lines 13-16, 23-32, 42-52 and 120-130 | Confirms relational authority, governed objects, protected schemas and server-derived acting context. |
| .memory/wiki/specs/ENGINEERING-STANDARDS.md | contract, bounds, security and migration lines 35-50, 92-101 and 149-188 | Sets strict validation, 256 KiB request bound, 50-row lists, endpoint tests and RLS/grant tests. |
| .memory/wiki/specs/be/00-infrastructure.md | Upload Lifecycle, object records and job lease sections | Supplies upload intents, ready-only consumption, the 15-minute signed transfer, the two-minute verifier lease and object-state CAS that the object adapter inherits. |
| .memory/wiki/specs/be/03a-content-schema-registry.md | BlockDefinitionVersion accessibility manifest and PropsSchemaSnapshot | Supplies nameRequired, block keys and props kinds consumed by the accessibility checker. |
| .memory/wiki/specs/be/03b-editorial-workflow-publication.md | cms_create_entry, cms_create_revision, dependencyManifest checker field and publication preflights | Supplies the import commit paths and the gate consumer of the accessibility checker. |
| .memory/wiki/specs/be/04b-governed-media-renditions.md | AssetAccessibility table and DLV-04B-02 | Supplies alt text, decorative flag, caption and transcript references read by the checker. |
| .memory/wiki/specs/be/05a-settings-flags-runtime.md | CFG-05A-03 propose setting change | Supplies the draft-only commit path for settings imports. |
| docs/runbooks/platform/release-recovery-gates.md | Current cost and capability boundary; Recovery readiness | Supplies the Free-tier no-PITR boundary and the production promotion gate that stays closed. |
| .memory/raw/events/2026-10-02.jsonl | DEC-112, DEC-114, DEC-116 | Supplies the rich_text.v1 AST grammar, the Phase 2 scope of CFG-05C-01 and the 50 MiB plan-limit profile. |

## IA Source Map

| Exact source item | 05c ownership | Backend realization |
|---|---|---|
| CFG-13 Import/export/restore | Owned | CFG-05C-01 with import job, export artifact and restore verification action branches. |
| CFG-14 Run quality/retention action | Owned | CFG-05C-02 with quality check, lifecycle request and per-store evidence branches. |
| ImportJob | Owned | Bounded private import job with source hash, mapping, cursor and quarantine evidence. |
| ExportArtifact | Owned | Encrypted, checksummed, expiring and download-limited artifact projection. |
| RestoreVerification | Owned | Isolated restore proof for schema, count, hash, reference, RLS, rendering and accessibility. |
| QualityCheckRun | Owned | Versioned checker evidence against an exact target and blocking finding count. |
| DataLifecycleRequest | Owned | Hold, archive, delete, anonymize and erasure plan with conflicts and residual manifest. |
| LifecycleStoreResult | Supporting deep-dive model, owned | One evidence result for every database, object, projection, cache, export, backup and processor store. |
| quality.lifecycle.changed.v1 | Owned event | Identifier-only event after lifecycle request or store-result state change. |
| ImportRowResult | Supporting model, owned | Per-row classification, rule code and target reference with row hash only; no source row bytes. |
| QualityFinding | Supporting model, owned | One bounded finding with rule, severity, location and human-review marker inside QualityCheckRun findings. |
| ExportDownloadClaim | Supporting model, owned | One idempotent download claim that atomically consumes one allowed download. |
| CFG-01 through CFG-12 | Excluded | 05a and 05b own settings/runtime and admin operations. |

## Feature Ledger Coverage

| Feature ledger ID | Feature | Operation coverage | Acceptance evidence |
|---|---|---|---|
| 25.10.01 | Import, Mapping, Validation & Dry Run | CFG-05C-01 import, import_commit and import_cancel actions; CFG-05C-03/04 reads | Private ready-object intake, registered mapper, duplicate classification against the import ledger, dry-run report, quarantine, draft-only commit and exact cursor tests. |
| 25.10.02 | Export, Backup, Restore & Portability | CFG-05C-01 export, export_revoke and restore actions; CFG-05C-03/04/05 reads and download claim; CFG-05C-08/09 verifier | Scope/field allowlist, encryption modes, expiry/download limits, revoke, isolated restore and eight-check proof tests. |
| 25.10.03 | Accessibility & Content Quality Gates | CFG-05C-02 quality_check action; CFG-05C-06/07 reads; in-process gate evaluation for BE03b preflights | Code-owned structural checker version over the rich_text.v1 AST and block registry, findings schema, blocking rules and human review. |
| 25.10.04 | Retention, Legal Hold & Erasure | CFG-05C-02 lifecycle actions; CFG-05C-06/07 reads | Cross-store manifest, hold precedence, sealed access, shared-evidence conflict, partial completion and residual proof. |

## Endpoint Completeness Reconciliation

The two assigned interactions have nine route registry entries. CFG-05C-01 and
CFG-05C-02 are the two protected command routes, each with action-specific
branches. CFG-05C-03, 04, 06 and 07 are the read projections the workbench needs
to list and inspect records; CFG-05C-05 is the only route that streams export
bytes; CFG-05C-08 and 09 are the internal routes for the isolated restore
verifier. Every entry has one strict request contract, one success projection,
one status/error row, one authorization row, one idempotency/rate/telemetry row
and one test row below. CFG-05C-01 does not duplicate BE00's upload, object or
job endpoints: it consumes a ready private object created through BE00 upload
intents and owns only the import/export/restore job records.

CFG-05C-02 combines checker and lifecycle actions behind a strict action
discriminant while keeping quality evidence and destructive lifecycle state
machines distinct. Quality warnings cannot authorize publication, and CMS
cannot decide legal exceptions. Shard 06 and counsel-gated policy packs remain
owners of case, evidence and legal decisions.

## Shared Contract Inheritance

Every route inherits BE00 request ID, TLS and method guard, exact first-party
CORS, body/content limits, session and acting-party resolution, CSRF for
cookie mutations, strict Zod 4 validation, capability/RLS checks, idempotency,
transactional outbox, bounded queue workers, object reconciliation and exact
ApiError { code, message, requestId, details } normalization. details is
limited to 16 keys, four nesting levels and 8 KiB.

The server derives actor, party and scope. Caller-supplied ownership,
authority, consent, verification, legal, rights, money or evidence fields are
source claims only and cannot become canonical state. Export and restore
never expose secrets, signed tokens or protected payload to an unauthorized
actor.

## API Endpoints

### Route Registry

| Operation ID | IA interaction | Method and path | Auth and capability | Request contract | Success contract | Error contract | Idempotency and rate | CORS and middleware |
|---|---|---|---|---|---|---|---|---|
| CFG-05C-01 | CFG-13 Import/export/restore | POST /api/v1/admin/portability/actions | Capability by action: admin.portability.import for import, import_commit and import_cancel; admin.portability.export for export and export_revoke; admin.portability.restore for restore; step-up for protected data | Cfg05c01PortabilityActionRequest | Cfg05c01PortabilityActionResponse 202 for import, import_commit, export and restore; 200 for import_cancel and export_revoke | ApiError { code, message, requestId, details }; 400 or 401 or 403 or 404 or 409 or 415 or 422 or 503 | Idempotency-Key required (BE00 8 to 128 printable ASCII); import_commit, import_cancel and export_revoke carry expectedVersion; 10/min user and 20/min party; 15s route deadline, queued job | CORS first-party admin allowlist; BE00 request-id, session/context, CSRF, strict Zod, capability, rate, object/RPC and ApiError normalization |
| CFG-05C-02 | CFG-14 Run quality/retention action | POST /api/v1/admin/quality-lifecycle/actions | admin.quality.run for quality_check; admin.privacy.lifecycle with MFA for lifecycle; support only named purpose grant | Cfg05c02QualityLifecycleActionRequest | Cfg05c02QualityLifecycleActionResponse 200 or 202 | ApiError { code, message, requestId, details }; 400 or 401 or 403 or 404 or 409 or 422 or 503 or 504 | Idempotency-Key required; 10/min user and 20/min party; 15s route deadline, queued store plan | CORS first-party admin allowlist; BE00 request-id, session/context, CSRF, strict Zod, step-up, capability, rate, RPC and ApiError normalization |
| CFG-05C-03 | CFG-13 Import/export/restore | GET /api/v1/admin/portability/records | admin.portability.read; each record also passes actor/party scope | Cfg05c03PortabilityRecordsQuery (query only) | Cfg05c03PortabilityRecordPage 200; no-store | ApiError { code, message, requestId, details }; 400 or 401 or 403 or 503 | Safe read; no Idempotency-Key; 300/min user and 600/min party; 8s deadline (BE00 authenticated-read limit) | CORS first-party admin allowlist; BE00 order without CSRF; strict query Zod |
| CFG-05C-04 | CFG-13 Import/export/restore | GET /api/v1/admin/portability/records/{kind}/{recordId} | admin.portability.read; record must be visible to actor/party | Path kind and recordId plus Cfg05c04PortabilityRecordQuery (child-page cursor and limit) | Cfg05c04PortabilityRecordDetail 200; ETag of version; no-store | ApiError { code, message, requestId, details }; 400 or 401 or 403 or 404 or 503 | Safe read; 300/min user and 600/min party; 8s deadline | CORS first-party admin allowlist; BE00 order without CSRF; strict path and query Zod |
| CFG-05C-05 | CFG-13 Import/export/restore | POST /api/v1/admin/portability/artifacts/{artifactId}/downloads | admin.portability.export on the artifact's acting party; step-up when the artifact contains protected resources | Cfg05c05DownloadRequest (empty strict object) | 200 byte stream (application/octet-stream); no-store | ApiError { code, message, requestId, details }; 401 or 403 or 404 or 409 or 429 or 503 | Idempotency-Key required; 10/min user and 20/min party; max 3 concurrent downloads per user; 15s time to first byte | CORS first-party admin allowlist; BE00 request-id, session/context, CSRF, capability, rate and ApiError normalization before the first byte |
| CFG-05C-06 | CFG-14 Run quality/retention action | GET /api/v1/admin/quality-lifecycle/records | admin.quality.read for quality runs; admin.privacy.lifecycle for lifecycle requests; support only a named purpose grant on one record | Cfg05c06QualityLifecycleRecordsQuery (query only) | Cfg05c06QualityLifecycleRecordPage 200; no-store | ApiError { code, message, requestId, details }; 400 or 401 or 403 or 503 | Safe read; 300/min user and 600/min party; 8s deadline | CORS first-party admin allowlist; BE00 order without CSRF; strict query Zod |
| CFG-05C-07 | CFG-14 Run quality/retention action | GET /api/v1/admin/quality-lifecycle/records/{kind}/{recordId} | Same capability as CFG-05C-06 for that kind; record must be visible | Path kind and recordId plus Cfg05c07RecordQuery (child-page cursor and limit, and an optional findings severity filter applied by the server) | Cfg05c07QualityLifecycleRecordDetail 200; ETag of version; no-store | ApiError { code, message, requestId, details }; 400 or 401 or 403 or 404 or 503 | Safe read; 300/min user and 600/min party; 8s deadline | CORS first-party admin allowlist; BE00 order without CSRF; strict path and query Zod |
| CFG-05C-08 | CFG-13 Import/export/restore | POST /api/v1/internal/portability/restore-verifier/actions | Registered service principal portability.restore_verifier with scope portability.restore.verify; no browser session, acting context or CSRF | Cfg05c08RestoreVerifierRequest (lease, heartbeat or report) | Cfg05c08RestoreVerifierResponse 200 | ApiError { code, message, requestId, details }; 401 or 403 or 409 or 422 or 503 | lease and heartbeat are naturally idempotent; report is idempotent by verificationId and leaseToken; 30/min per principal; 15s deadline | mTLS service-credential principal as CFG-05A-01; BE00 request-id, strict Zod and ApiError normalization; no CORS |
| CFG-05C-09 | CFG-13 Import/export/restore | GET /api/v1/internal/portability/restore-verifier/artifacts/{artifactId} | Same service principal; X-Restore-Lease-Token must match a live lease for that artifact | Path artifactId plus lease header | 200 byte stream; no-store | ApiError { code, message, requestId, details }; 401 or 403 or 404 or 409 or 503 | Safe read; 30/min per principal; 15s time to first byte | mTLS service-credential principal; BE00 request-id and ApiError normalization; no CORS |

### Registry invariants

- Portability actions accept only registered formats, schema versions, mapper
  keys, mapping versions, duplicate strategies, target scopes, resource types
  and field manifests.
- Import always consumes a private object that BE00 has verified `ready`
  (size, media type, SHA-256 and malware scan), maps it through a registered
  mapper, records source hash and provenance, dry-runs before any commit, and
  quarantines unsupported or authority-like rows. A commit references the
  dry-run report by hash. It writes drafts only through the owning domain's
  ordinary command and never writes canonical ownership, consent,
  verification, money, rights or legal truth.
- Export scope and field manifests are allowlisted and compiled server-side.
  Artifacts are encrypted, checksummed, short-lived, download-limited and
  revoked before bytes are served. Bytes are served only through CFG-05C-05.
- Restore always targets a registered isolated non-production environment. An
  isolated verifier executes it. Counts alone never prove success; schema,
  hashes, references, RLS, rendering, accessibility and secret-exclusion checks
  must all pass for `verified`, and `verified` is diagnostic evidence only on
  the Free tier.
- Quality checkers are code-owned and versioned. A finding against a changed
  target or checker is stale. Blocking findings prevent publication and leave
  the last active output intact.
- Lifecycle requests enumerate every affected store and shared reference.
  Legal hold wins over destructive actions. Erasure of jointly authored
  evidence becomes a counsel/operator-reviewed exception, not silent deletion.
- A GET never mutates state. The only route that consumes a download is the
  CSRF-protected POST CFG-05C-05.
- 403 means a visible job, target or policy is known but the action is outside
  the current grant. 404 hides inaccessible target or artifact existence.

### Operation contract and error matrix

| Operation ID | Request and success | Error codes and status | 403 versus 404 |
|---|---|---|---|
| CFG-05C-01 | PortabilityActionRequest import, import_commit, import_cancel, export, export_revoke or restore branch to PortabilityActionResponse with job/artifact/verification state, version and failure code | INVALID_REQUEST 400; UNAUTHENTICATED 401; STEP_UP_REQUIRED 401; FORBIDDEN 403; PORTABILITY_TARGET_NOT_FOUND 404; MANIFEST_CONFLICT 409; VERSION_CONFLICT 409; IDEMPOTENCY_CONFLICT 409; UNSUPPORTED_FORMAT 415; PROTECTED_FIELD 422; PORTABILITY_LIMIT_EXCEEDED 422; RESTORE_UNVERIFIED 422; RATE_LIMITED 429; PORTABILITY_UNAVAILABLE 503 | Hidden object, target, job, artifact or verification is 404; visible scope outside actor grant is 403; protected source claim is 422 and never canonicalized. |
| CFG-05C-02 | QualityLifecycleActionRequest quality or lifecycle branch to QualityLifecycleActionResponse with evidence/state and failure code | INVALID_REQUEST 400; UNAUTHENTICATED 401; STEP_UP_REQUIRED 401; FORBIDDEN 403; LIFECYCLE_TARGET_NOT_FOUND 404; VERSION_CONFLICT 409; IDEMPOTENCY_CONFLICT 409; BLOCKING_FINDING 422; HOLD_CONFLICT 422; RATE_LIMITED 429; LIFECYCLE_UNAVAILABLE 503; UPSTREAM_TIMEOUT 504 | Hidden target or hold is 404; visible target without privacy/legal or quality capability is 403; blocking evidence or hold conflict is 422 with no destructive mutation. A completed quality run with blockers is a 200 evidence response, not an error. |
| CFG-05C-03 | Cfg05c03PortabilityRecordsQuery to Cfg05c03PortabilityRecordPage | INVALID_REQUEST 400; UNAUTHENTICATED 401; FORBIDDEN 403; PORTABILITY_UNAVAILABLE 503 | Records outside actor/party scope are omitted, never counted, never 403 per item. |
| CFG-05C-04 | Path kind and recordId to Cfg05c04PortabilityRecordDetail | INVALID_REQUEST 400; UNAUTHENTICATED 401; FORBIDDEN 403; PORTABILITY_TARGET_NOT_FOUND 404; PORTABILITY_UNAVAILABLE 503 | Hidden or absent record is 404; visible kind without admin.portability.read is 403. |
| CFG-05C-05 | Empty body to byte stream | UNAUTHENTICATED 401; STEP_UP_REQUIRED 401; FORBIDDEN 403; PORTABILITY_TARGET_NOT_FOUND 404; ARTIFACT_NOT_DOWNLOADABLE 409; IDEMPOTENCY_CONFLICT 409; RATE_LIMITED 429; PORTABILITY_UNAVAILABLE 503 | Hidden artifact is 404; visible artifact whose manifest or acting party is outside the current grant is 403; expired, revoked, exhausted or not-ready artifact is 409 ARTIFACT_NOT_DOWNLOADABLE with details { state } only. |
| CFG-05C-06 | Cfg05c06QualityLifecycleRecordsQuery to Cfg05c06QualityLifecycleRecordPage | INVALID_REQUEST 400; UNAUTHENTICATED 401; FORBIDDEN 403; LIFECYCLE_UNAVAILABLE 503 | Hidden lifecycle requests and holds are omitted; no total count is returned. |
| CFG-05C-07 | Path kind and recordId to Cfg05c07QualityLifecycleRecordDetail | INVALID_REQUEST 400; UNAUTHENTICATED 401; FORBIDDEN 403; LIFECYCLE_TARGET_NOT_FOUND 404; LIFECYCLE_UNAVAILABLE 503 | Hidden or absent record or hold is 404; visible kind without the capability is 403. |
| CFG-05C-08 | Cfg05c08RestoreVerifierRequest to Cfg05c08RestoreVerifierResponse | UNAUTHENTICATED 401; FORBIDDEN 403; LEASE_EXPIRED 409; LEASE_CONSUMED 409; REPORT_INVALID 422; PORTABILITY_UNAVAILABLE 503 | Not a human route: bad or absent credential is 401, wrong scope or unregistered target environment is 403. |
| CFG-05C-09 | Path artifactId and lease header to byte stream | UNAUTHENTICATED 401; FORBIDDEN 403; PORTABILITY_TARGET_NOT_FOUND 404; LEASE_EXPIRED 409; PORTABILITY_UNAVAILABLE 503 | An artifact that is not the leased verification's source artifact is 404. |

## Request/Response Contracts (Zod 4 schemas)

All objects are Zod 4 strictObject schemas. Action branches are a strict
discriminated union. Unknown keys fail. UUIDs are canonical UUIDs, timestamps
carry offsets and all manifests are bounded to 500 entries and 256 KiB
request bodies. Export is asynchronous; no synchronous export bytes are
returned. Bytes leave the system only through CFG-05C-05 (operators) and
CFG-05C-09 (the isolated verifier).

~~~ts
import { z } from "zod";

const Uuid = z.uuid();
const IsoTime = z.string().datetime({ offset: true });
const Version = z.string().regex(/^[1-9][0-9]{0,17}$/);
const NonEmptyText = z.string().trim().min(1).max(512);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Key = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+){0,15}$/).max(128);
const RuleCode = z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/);
const StepUpToken = z.string().min(20).max(4096);
const Cursor = z.string().min(1).max(512);
const PageLimit = z.coerce.number().int().min(1).max(50).default(25);
const Count500 = z.number().int().min(0).max(500);
const Bcp47 = z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,4}$/).max(35);
const JsonValue = z.json().refine(v => {
  const encoded = JSON.stringify(v);
  return encoded !== undefined && encoded.length <= 65536;
}, "value exceeds 64 KiB");
const JsonObject = z.record(z.string().max(128), JsonValue).superRefine((v, c) => {
  if (Object.keys(v).length > 64) c.addIssue({ code: "custom", message: "too many keys" });
});
const ScopeManifest = z.array(z.strictObject({
  resourceType: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/),
  resourceId: Uuid,
  version: Version
})).min(1).max(500);
const FieldManifest = z.array(z.string().regex(/^[a-z][a-z0-9_.-]{1,63}$/)).min(1).max(128);
const ApiError = z.strictObject({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
  message: z.string().min(1).max(256),
  requestId: Uuid,
  details: z.record(z.string().max(64), z.json()).superRefine((v, c) => {
    if (Object.keys(v).length > 16) c.addIssue({ code: "custom", message: "too many details" });
  })
});

const SourceFormat = z.enum(["json", "csv", "ndjson", "xml", "cms_bundle"]);
const DuplicatePolicy = z.enum(["reject", "quarantine", "update_if_version_matches", "create_new"]);
const RecipientPublicKey = z.strictObject({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  y: z.string().regex(/^[A-Za-z0-9_-]{43}$/)
});

const ImportAction = z.strictObject({
  action: z.literal("import"),
  objectId: Uuid,
  sourceFormat: SourceFormat,
  sourceVersion: Version,
  mapperKey: Key,
  mappingVersion: Version,
  provenance: z.strictObject({
    sourceSystem: z.string().trim().min(1).max(128),
    sourceRunId: z.string().trim().min(1).max(128),
    sourceHash: Hash
  }),
  duplicatePolicy: DuplicatePolicy,
  targetScope: JsonObject,
  fieldManifest: FieldManifest,
  stepUpToken: StepUpToken.optional(),
  reason: NonEmptyText
});
const ImportCommitAction = z.strictObject({
  action: z.literal("import_commit"),
  importJobId: Uuid,
  expectedVersion: Version,
  expectedReportHash: Hash,
  stepUpToken: StepUpToken.optional(),
  reason: NonEmptyText
});
const ImportCancelAction = z.strictObject({
  action: z.literal("import_cancel"),
  importJobId: Uuid,
  expectedVersion: Version,
  reason: NonEmptyText
});
const ExportAction = z.strictObject({
  action: z.literal("export"),
  exportType: z.enum(["cms", "settings", "audit_safe_projection", "portability_bundle"]),
  scopeManifest: ScopeManifest,
  fieldManifest: FieldManifest,
  actorPurpose: NonEmptyText,
  encryptionMode: z.enum(["managed_key", "recipient_key"]),
  recipientPublicKey: RecipientPublicKey.nullable(),
  expiresAt: IsoTime,
  maxDownloads: z.number().int().min(1).max(3),
  excludeProtectedEvidence: z.literal(true),
  stepUpToken: StepUpToken.optional(),
  reason: NonEmptyText
}).superRefine((v, c) => {
  if (v.encryptionMode === "recipient_key" && v.recipientPublicKey === null) c.addIssue({ code: "custom", path: ["recipientPublicKey"], message: "recipient key required" });
  if (v.encryptionMode === "managed_key" && v.recipientPublicKey !== null) c.addIssue({ code: "custom", path: ["recipientPublicKey"], message: "recipient key forbidden for managed_key" });
});
const ExportRevokeAction = z.strictObject({
  action: z.literal("export_revoke"),
  exportArtifactId: Uuid,
  expectedVersion: Version,
  reason: NonEmptyText
});
const RestoreAction = z.strictObject({
  action: z.literal("restore"),
  sourceArtifactId: Uuid,
  targetEnvironment: Key,
  isolatedTarget: z.literal(true),
  requestedScope: ScopeManifest,
  expectedManifestHash: Hash,
  verifyAccessibility: z.literal(true),
  verifyRls: z.literal(true),
  stepUpToken: StepUpToken.optional(),
  reason: NonEmptyText
});
export const Cfg05c01PortabilityActionRequest = z.discriminatedUnion("action", [
  ImportAction, ImportCommitAction, ImportCancelAction, ExportAction, ExportRevokeAction, RestoreAction
]);

const PortabilityState = z.enum([
  "draft", "dry_run", "approved", "running", "completed", "partial", "failed", "cancelled",
  "requested", "generating", "ready", "expired", "revoked",
  "restoring", "verifying", "verified"
]);
const CheckResult = z.enum(["pass", "fail", "unknown"]);
const RestoreVerificationVector = z.strictObject({
  schema: CheckResult,
  counts: CheckResult,
  hashes: CheckResult,
  references: CheckResult,
  rls: CheckResult,
  rendering: CheckResult,
  accessibility: CheckResult,
  secretScan: CheckResult
});

export const Cfg05c01PortabilityActionResponse = z.strictObject({
  action: z.enum(["import", "import_commit", "import_cancel", "export", "export_revoke", "restore"]),
  importJobId: Uuid.nullable(),
  exportArtifactId: Uuid.nullable(),
  restoreVerificationId: Uuid.nullable(),
  state: PortabilityState,
  version: Version,
  sourceHash: Hash.nullable(),
  manifestHash: Hash.nullable(),
  cursor: Count500,
  importedCount: Count500,
  quarantinedCount: Count500,
  blockedCount: Count500,
  expiresAt: IsoTime.nullable(),
  downloadCount: z.number().int().min(0).max(3),
  failureCode: RuleCode.nullable(),
  verification: RestoreVerificationVector.nullable(),
  outboxEventId: Uuid.nullable()
});

const ImportClassification = z.strictObject({
  create: Count500, update: Count500, duplicate: Count500, conflict: Count500,
  quarantine: Count500, unsupported: Count500, blocked: Count500
});
const ImportDryRunReport = z.strictObject({
  reportHash: Hash,
  rowCount: Count500,
  classification: ImportClassification,
  impact: z.strictObject({
    routeRefs: Count500, mediaRefs: Count500, rightsClaims: Count500, accessibilityBlockers: Count500
  }),
  targetVersionsHash: Hash,
  errors: z.array(z.strictObject({
    rowIndex: z.number().int().min(0).max(499),
    classification: z.enum(["duplicate", "conflict", "quarantine", "unsupported", "blocked"]),
    ruleCode: RuleCode
  })).max(50),
  errorsTruncated: z.boolean()
});
const ImportRowResultView = z.strictObject({
  rowIndex: z.number().int().min(0).max(499),
  sourceRowId: z.string().min(1).max(128),
  classification: z.enum(["create", "update", "duplicate", "conflict", "quarantine", "unsupported", "blocked"]),
  state: z.enum(["planned", "committed", "quarantined", "blocked", "failed"]),
  ruleCode: RuleCode.nullable(),
  targetType: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/).nullable(),
  targetId: Uuid.nullable(),
  targetVersion: Version.nullable()
});

export const Cfg05c03PortabilityRecordsQuery = z.strictObject({
  kind: z.enum(["import", "export", "restore"]).optional(),
  state: PortabilityState.optional(),
  cursor: Cursor.optional(),
  limit: PageLimit
});
const PortabilityRecordSummary = z.strictObject({
  kind: z.enum(["import", "export", "restore"]),
  recordId: Uuid,
  state: PortabilityState,
  version: Version,
  createdAt: IsoTime,
  updatedAt: IsoTime,
  sourceHash: Hash.nullable(),
  manifestHash: Hash.nullable(),
  expiresAt: IsoTime.nullable(),
  downloadCount: z.number().int().min(0).max(3).nullable(),
  counts: z.strictObject({ imported: Count500, quarantined: Count500, blocked: Count500 }).nullable(),
  failureCode: RuleCode.nullable()
});
export const Cfg05c03PortabilityRecordPage = z.strictObject({
  items: z.array(PortabilityRecordSummary).max(50),
  nextCursor: Cursor.nullable()
});
export const Cfg05c04PortabilityRecordQuery = z.strictObject({
  rowsCursor: Cursor.optional(),
  rowsLimit: PageLimit
});
export const Cfg05c04PortabilityRecordDetail = z.strictObject({
  summary: PortabilityRecordSummary,
  import: z.strictObject({
    sourceFormat: SourceFormat,
    sourceVersion: Version,
    mapperKey: Key,
    mappingVersion: Version,
    duplicatePolicy: DuplicatePolicy,
    cursor: Count500,
    dryRunReport: ImportDryRunReport.nullable(),
    rows: z.strictObject({ items: z.array(ImportRowResultView).max(50), nextCursor: Cursor.nullable() })
  }).nullable(),
  export: z.strictObject({
    exportType: z.enum(["cms", "settings", "audit_safe_projection", "portability_bundle"]),
    encryptionMode: z.enum(["managed_key", "recipient_key"]),
    maxDownloads: z.number().int().min(1).max(3),
    byteSize: z.number().int().min(1).max(52428800).nullable(),
    containsProtected: z.boolean(),
    scopeCount: z.number().int().min(1).max(500),
    fieldManifest: FieldManifest
  }).nullable(),
  restore: z.strictObject({
    targetEnvironment: Key,
    checkSetVersion: z.literal("1"),
    attemptCount: z.number().int().min(0).max(3),
    expectedManifestHash: Hash,
    actualManifestHash: Hash.nullable(),
    verification: RestoreVerificationVector,
    evidenceRef: z.string().max(256).nullable()
  }).nullable()
});
export const Cfg05c05DownloadRequest = z.strictObject({});

const VerifierLease = z.strictObject({
  verificationId: Uuid,
  sourceArtifactId: Uuid,
  expectedManifestHash: Hash,
  requestedScope: ScopeManifest,
  checkSetVersion: z.literal("1"),
  encryptionMode: z.enum(["managed_key", "recipient_key"]),
  leaseToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  leaseExpiresAt: IsoTime,
  attempt: z.number().int().min(1).max(3)
});
export const Cfg05c08RestoreVerifierRequest = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("lease"), verifierId: z.string().trim().min(1).max(128), targetEnvironment: Key }),
  z.strictObject({ action: z.literal("heartbeat"), verificationId: Uuid, leaseToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/), phase: z.enum(["restoring", "verifying"]) }),
  z.strictObject({
    action: z.literal("report"),
    verificationId: Uuid,
    leaseToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    actualManifestHash: Hash.nullable(),
    results: RestoreVerificationVector,
    targetCounts: z.strictObject({ resources: Count500, objects: Count500 }),
    evidenceRef: z.string().trim().min(1).max(256),
    failureCode: z.enum(["RESTORE_KEY_UNAVAILABLE", "OBJECT_BYTES_UNAVAILABLE", "MANIFEST_HASH_MISMATCH"]).nullable()
  })
]);
export const Cfg05c08RestoreVerifierResponse = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("lease"), lease: VerifierLease.nullable() }),
  z.strictObject({ action: z.literal("heartbeat"), leaseExpiresAt: IsoTime }),
  z.strictObject({ action: z.literal("report"), state: z.enum(["verified", "failed"]), version: Version })
]);

const RuleId = z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,3}$/).max(64);
export const QualityFinding = z.strictObject({
  ruleId: RuleId,
  severity: z.enum(["blocking", "warning"]),
  location: z.strictObject({
    kind: z.enum(["field", "block", "route"]),
    pointer: z.string().min(1).max(512),
    fieldId: Uuid.nullable(),
    blockPath: z.string().min(1).max(512).nullable()
  }),
  message: z.string().min(1).max(256),
  evidenceRef: z.string().max(256).nullable(),
  humanReview: z.literal("required")
});
export const QualityFindingsDocument = z.strictObject({
  schemaVersion: z.literal(1),
  outcome: z.enum(["completed", "timeout", "dependency_unavailable"]),
  truncated: z.boolean(),
  items: z.array(QualityFinding).max(500)
});

const QualityAction = z.strictObject({
  action: z.literal("quality_check"),
  checkerKey: Key,
  checkerVersion: Version,
  targetType: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/),
  targetId: Uuid,
  targetVersion: Version,
  reason: NonEmptyText
});
const LifecycleAction = z.strictObject({
  action: z.enum(["archive", "delete", "anonymize", "hold", "release_hold", "erasure"]),
  subjectPersonId: Uuid,
  targetType: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/),
  targetId: Uuid,
  targetVersion: Version.nullable(),
  scope: JsonObject,
  verifiedSubject: z.literal(true),
  manifest: z.strictObject({
    manifestHash: Hash,
    stores: z.array(z.strictObject({
      store: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/),
      itemCount: z.number().int().min(0).max(1000000),
      sharedReferenceCount: z.number().int().min(0).max(1000000)
    })).min(1).max(64)
  }),
  counselDecisionRef: z.string().trim().min(1).max(256).nullable(),
  stepUpToken: z.string().min(20).max(4096),
  reason: NonEmptyText
}).superRefine((v, c) => {
  if ((v.action === "delete" || v.action === "erasure") && v.counselDecisionRef === null) c.addIssue({ code: "custom", path: ["counselDecisionRef"], message: "counsel decision required" });
});
export const Cfg05c02QualityLifecycleActionRequest = z.discriminatedUnion("action", [QualityAction, LifecycleAction]);

export const Cfg05c02QualityLifecycleActionResponse = z.strictObject({
  action: z.enum(["quality_check", "archive", "delete", "anonymize", "hold", "release_hold", "erasure"]),
  qualityCheckRunId: Uuid.nullable(),
  lifecycleRequestId: Uuid.nullable(),
  state: z.enum(["requested", "verifying", "planned", "approved", "blocked", "executing", "running", "healthy", "stale", "completed", "partial", "failed"]),
  targetType: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/),
  targetId: Uuid,
  targetVersion: Version.nullable(),
  blockingCount: z.number().int().min(0).max(1000000),
  warningCount: z.number().int().min(0).max(1000000),
  manifestHash: Hash.nullable(),
  residualCount: z.number().int().min(0).max(1000000),
  holdConflict: z.boolean(),
  evidenceRef: z.string().max(256).nullable(),
  failureCode: RuleCode.nullable(),
  outboxEventId: Uuid.nullable()
});

export const Cfg05c06QualityLifecycleRecordsQuery = z.strictObject({
  kind: z.enum(["quality", "lifecycle"]).optional(),
  state: z.string().regex(/^[a-z_]{3,24}$/).optional(),
  targetType: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/).optional(),
  targetId: Uuid.optional(),
  cursor: Cursor.optional(),
  limit: PageLimit
});
const QualityLifecycleRecordSummary = z.strictObject({
  kind: z.enum(["quality", "lifecycle"]),
  recordId: Uuid,
  state: z.string().regex(/^[a-z_]{3,24}$/),
  version: Version,
  targetType: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/),
  targetId: Uuid,
  targetVersion: Version.nullable(),
  blockingCount: z.number().int().min(0).max(1000000).nullable(),
  warningCount: z.number().int().min(0).max(1000000).nullable(),
  residualCount: z.number().int().min(0).max(1000000).nullable(),
  createdAt: IsoTime,
  updatedAt: IsoTime
});
export const Cfg05c06QualityLifecycleRecordPage = z.strictObject({
  items: z.array(QualityLifecycleRecordSummary).max(50),
  nextCursor: Cursor.nullable()
});
export const Cfg05c07RecordQuery = z.strictObject({
  childCursor: Cursor.optional(),
  childLimit: PageLimit,
  severity: z.enum(["blocking", "warning"]).optional()
});
export const Cfg05c07QualityLifecycleRecordDetail = z.strictObject({
  summary: QualityLifecycleRecordSummary,
  quality: z.strictObject({
    checkerKey: Key,
    checkerVersion: Version,
    targetEntryId: Uuid.nullable(),
    inputHash: Hash,
    timeoutMs: z.number().int().min(100).max(2000),
    runAt: IsoTime,
    expiresAt: IsoTime,
    outcome: z.enum(["completed", "timeout", "dependency_unavailable"]),
    findingsTruncated: z.boolean(),
    failureCode: RuleCode.nullable(),
    findings: z.strictObject({ items: z.array(QualityFinding).max(50), nextCursor: Cursor.nullable() })
  }).nullable(),
  lifecycle: z.strictObject({
    requestType: z.enum(["archive", "delete", "anonymize", "hold", "release_hold", "erasure"]),
    manifestHash: Hash,
    holdConflict: z.boolean(),
    stores: z.strictObject({
      items: z.array(z.strictObject({
        store: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/),
        action: z.enum(["archive", "delete", "anonymize", "hold", "release_hold", "erasure"]),
        state: z.enum(["pending", "executing", "completed", "partial", "failed", "blocked"]),
        itemCount: z.number().int().min(0),
        residualCount: z.number().int().min(0),
        errorCode: RuleCode.nullable(),
        evidenceRef: z.string().max(256).nullable()
      })).max(50),
      nextCursor: Cursor.nullable()
    })
  }).nullable()
});

export type Cfg05cApiError = z.infer<typeof ApiError>;
~~~

### Contract and policy rules

- Import requires a BE00 `ready` private object, format/version, mapper key and
  mapping version, provenance hash, duplicate policy and field manifest. A dry
  run emits the ImportDryRunReport (classification counts, impact counts,
  bounded errors and report hash) before any canonical write. A commit names
  that report by hash and writes drafts only.
- Imported ownership, authority, consent, verification, money, rights and
  legal fields remain source-marked claims or quarantine records. They cannot
  satisfy Shard 01, Shard 03, Shard 04 or Shard 06 authorization or truth
  predicates.
- Export requires exact server-validated scope and field manifests, purpose,
  encryption mode, expiry, download cap and protected-evidence exclusion. The
  artifact is not downloadable by possession of an object key or link; the only
  delivery route is the CFG-05C-05 claim.
- Restore requires isolatedTarget true, a registered isolated target
  environment, requested scope, expected manifest hash and explicit RLS and
  accessibility verification. The isolated verifier produces the eight-check
  vector. No production promotion exists in Phase 2.
- Quality checkers identify exact target and version and return bounded
  findings with field/block/route, severity and rule. Structural, schema,
  reference, required accessibility, privacy, rights and legal blockers
  prevent publish; readability/style are warnings unless a new checker version
  elevates them.
- Lifecycle actions require a verified subject, scope, complete store manifest,
  step-up and purpose. Legal hold prevents destructive actions, seals and
  minimizes access, and shared authored evidence becomes an operator/counsel
  exception with residual proof.

### Object adapter and storage profile

CFG-05C-01 never accepts bytes in a request body. It uses three BE00 object
purposes registered by this companion in the BE00 target registry. The hosted
per-file cap is PORTABILITY_MAX_OBJECT_BYTES for all three.

| Purpose | Created by | Allowed media types | Retention class | Consumers |
|---|---|---|---|---|
| portability.import | Operator upload through BE00 INF-API-02 (purpose and target portability_import, capability admin.portability.import, immutable target so no If-Match) | application/json for json; text/csv for csv; application/x-ndjson for ndjson; application/xml for xml; application/vnd.wejammin.cms-bundle+json for cms_bundle | portability.import: object deleted 7 days after the owning job's terminal state | Import dry run and commit |
| portability.quarantine | Import worker, server-originated object path | application/x-ndjson | portability.import | Audit evidence only; no Phase 2 route reads quarantine bytes. Operators identify rows by rowIndex and sourceRowId in CFG-05C-04 and correct the source. |
| portability.export | Export worker, server-originated object path | application/octet-stream | portability.export: object deleted at expiry or revoke, whichever is first | CFG-05C-05 and CFG-05C-09 only |

- A server-originated object path creates the BE00 ObjectRecord in `uploaded`,
  writes the bytes to the server-generated key, and reuses the
  `platform.object.verify` job to reach `ready`. No UploadIntent or signed URL
  is issued for it. Only a `ready` object may be consumed.
- An import is accepted only when the object is `ready`, owned by the same
  actor and acting party, has purpose portability.import, is within
  PORTABILITY_MAX_OBJECT_BYTES, has a verified media type matching the declared
  sourceFormat (else 415 UNSUPPORTED_FORMAT) and a SHA-256 equal to
  provenance.sourceHash (else 409 MANIFEST_CONFLICT). The malware scan is the
  BE00 verifier scan that precedes `ready`; there is no second scan.
- The two retention classes are registered in the operational retention
  registry with hard-delete mode. The CFG-05C-02 lifecycle planner enumerates
  their objects as stores like any other, so a legal hold on a subject blocks
  their deletion.
- Expiry is enforced at claim time from `expires_at` regardless of any sweeper.
  `platform_api.portability_expiry_sweep(p_limit, p_correlation_id)` runs on the
  one-minute Worker cron with limits 1 to 100 (default 64) and the retention
  runbook's locking pattern. It moves expired artifacts to `expired`, deletes
  their objects, and returns restore verifications whose lease expired after
  the third attempt to `failed` with failure code LEASE_EXHAUSTED.

### Mapper and resource registries

Registries are code-owned and release-registered. Request values that are not
registry members fail before any job exists. Adding a mapper or resource type is
a new registry entry with its own strict schema and tests, never a request
field. The mapper and resource field allowlists, the registered restore targets
and the current checker versions are exported from the shared contracts package
as constants, so the FE forms and the BE validators read one source.

| mapperKey and version | Source formats | Target scope schema (strict) | Natural key | Commit path | Source claims (never canonical) |
|---|---|---|---|---|---|
| cms.entry version 1 | json, ndjson, cms_bundle | { contentTypeId: UUID, contentTypeVersionId: UUID, locale: BCP 47 } resolving to one active compiled schema | naturalKey of the row envelope | cms_create_entry for create; cms_create_revision with the row's expectedTargetVersion as If-Match base for update_if_version_matches; always a draft, never submit, review, schedule or publish | Keys under claims and any field the mapper lists as ownership, party, publication state, review or approval, rights, consent, verification, money or legal status |
| settings.value version 1 | json, ndjson | { scopeType: platform, environment, party, site, route, feature or user; scopeId: UUID or null; environment: string up to 64 characters or null } | definition key, scopeType, scopeId and environment | CFG-05A-03 propose setting change as a draft proposal in the importing actor's context; activation stays CFG-05A-04 | Risk class, approvals and any protected-exclusion category |

`portability.secrets.v1` is a code-owned detector set that matches JSON Web
Tokens, PEM private-key blocks, the provider API-key prefixes in the secret-name
registry and any value whose digest equals a configured secret's digest. It is
used by import row screening and by the restore secretScan check.

A (sourceFormat, mapperKey, mappingVersion) combination not listed above is
415 UNSUPPORTED_FORMAT. The csv and xml formats are registered enum members that
no Phase 2 mapper accepts.

Every supported format yields an ordered array of at most PORTABILITY_MAX_ROWS
row envelopes, each at most PORTABILITY_MAX_ROW_BYTES serialized: json as a
top-level object with a rows array, ndjson as one envelope per line, and
cms_bundle as a json document that adds bundleVersion 1. More rows is a
dry-run failure with PORTABILITY_LIMIT_EXCEEDED; the operator splits the source.

~~~ts
const ImportRowEnvelope = z.strictObject({
  sourceRowId: z.string().trim().min(1).max(128),
  naturalKey: z.string().trim().min(1).max(256),
  expectedTargetVersion: Version.nullable(),
  fields: JsonObject,
  claims: JsonObject.optional()
});
~~~

Portable resource registry (export and restore). Each entry fixes the field
allowlist, the canonical projection and the restore adapter. Secrets,
credentials, provider tokens, raw audit payload and protected evidence appear
in no allowlist.

| resourceType | Allowlisted fields | Protected |
|---|---|---|
| cms.entry_revision | entry_id, revision_number, locale, schema_version_id, template_version_id, content_hash, values, relations | Yes when the content type version binds a DEC-110 protected workflow policy (cms.disclosure.policy, cms.disclosure.legal, cms.disclosure.security or cms.disclosure.financial); otherwise no |
| cms.template_version | id, template_key, template_version, state, compatible_type_ids, slots, reserved_regions, allowed_blocks | No |
| settings.value_version | definition_key, definition_version, scope_type, scope_id, environment, typed_value, effective_from, effective_to, state | Yes |
| audit.safe_projection | content_revision_id, change_id, audit_event_id, security_event_id, occurred_at | Yes |

exportType selects resource types: cms allows the cms.* types, settings allows
settings.value_version, audit_safe_projection allows audit.safe_projection, and
portability_bundle allows any registered type. Step-up is required when any
scoped resource is protected.

### Import dry run and commit

1. CFG-05C-01 import validates the strict branch, registry membership, the
   mapper's strict targetScope schema, fieldManifest as a subset of the
   mapper's allowlist, object readiness and hash (above), capability and
   target scope. In one transaction it creates the job in `draft`, the
   idempotency record, audit and one `portability.import.dry_run` job, and
   returns 202.
2. The dry-run worker leases the job with CAS and streams the object with a
   bounded parser. Per row it classifies, in this order: parse or envelope
   failure, size over PORTABILITY_MAX_ROW_BYTES or a secret match from the
   code-owned detector set `portability.secrets.v1` is `blocked` with rule code
   ROW_INVALID, ROW_TOO_LARGE or SECRET_DETECTED and its bytes are never
   persisted; a field outside fieldManifest is `unsupported` with
   UNSUPPORTED_FIELD; a non-empty claims object or a claim-listed field is
   `quarantine` with AUTHORITY_CLAIM; a natural key repeated earlier in the same
   source is `conflict` with NATURAL_KEY_DUPLICATE; a natural key already
   `committed` in the import ledger is `duplicate` with NATURAL_KEY_DUPLICATE;
   otherwise `create`.
   A duplicate with duplicatePolicy update_if_version_matches whose
   expectedTargetVersion equals the ledger target's current version is
   `update`; a different version is `conflict` with VERSION_MISMATCH.
3. The import ledger is the set of `committed` rows in
   quality_import_row_results keyed by mapper key and natural-key hash. The
   latest committed row for a key identifies the target. No heuristic match
   against canonical tables is used.
4. duplicatePolicy outcomes: reject fails the whole job at dry run with failure
   code DUPLICATE_REJECTED when any row is `duplicate` or `conflict`;
   quarantine sends `duplicate` and `conflict` rows to quarantine;
   update_if_version_matches commits `update` rows and quarantines `conflict`
   rows; create_new commits `duplicate` rows as new targets with new identities
   and never overwrites.
5. The worker writes quarantined rows (envelopes including claims, as
   canonical-JSON NDJSON with the job's provenance) to one portability.quarantine
   object, computes the ImportDryRunReport and its reportHash (SHA-256 of the
   RFC 8785 canonical JSON of the report), and moves the job to `dry_run`.
   Failures end in `failed` with failure code SOURCE_UNPARSEABLE,
   PORTABILITY_LIMIT_EXCEEDED, DUPLICATE_REJECTED or MAPPER_UNAVAILABLE.
6. CFG-05C-01 import_commit requires the job in `dry_run` or `partial`, a
   matching expectedVersion (CAS) and expectedReportHash equal to the stored
   reportHash, else 409 VERSION_CONFLICT or MANIFEST_CONFLICT. One transaction
   records approved_by_person_id and approved_at, moves `dry_run` to `approved`
   to `running` (`partial` resumes at the stored cursor) and enqueues
   `portability.import.commit`. Step-up is required again when the job targets
   protected data.
7. The commit worker processes PORTABILITY_BATCH_ROWS rows per lease under a
   two-minute lease with CAS on cursor. Each `create` or `update` row calls the
   mapper's commit path with the importing actor's replayed acting context and
   the row idempotency key hex SHA-256 of jobId, rowIndex and mappingVersion
   joined by colons. Capability, target scope and target version are rechecked
   per batch; a target that changed since the dry run quarantines that row with
   TARGET_CHANGED and never overwrites; a revoked grant stops the job as
   `partial`. Row results, counts and cursor advance in one transaction per
   batch, so a crash repeats the batch idempotently.
8. A job is `completed` when every row is terminal and none is `failed`.
   A row that fails retryably three times becomes `failed` with
   ROW_RETRIES_EXHAUSTED and the job is `partial`. Quarantined rows do not
   prevent `completed`. import_cancel is valid in `draft`, `dry_run`,
   `approved`, `running` and `partial` with CAS; a running job stops at the next
   batch boundary. Committed drafts are never rolled back automatically.

Import never submits, reviews, schedules or publishes content and never
activates a setting; drafts then pass the ordinary editorial workflow, including
the accessibility preflight below.

### Export compilation, encryption and download

1. CFG-05C-01 export validates the strict branch, that every scoped
   resourceType is registered for the exportType, that every fieldManifest
   name is allowlisted for at least one scoped type, expiresAt later than now
   and at most EXPORT_MAX_TTL later (else 400 INVALID_REQUEST at /expiresAt),
   the recipient key rule, capability, per-resource read scope and step-up for
   protected resources. A field outside every allowlist is 422 PROTECTED_FIELD
   with a denial audit and no artifact row. The transaction creates the
   artifact in `requested` with contains_protected, audit and one
   `portability.export.compile` job and returns 202.
2. The compile worker moves the artifact to `generating` with CAS, rechecks the
   actor's grant and that every scoped resource still has the manifest
   version (a changed resource fails the artifact with SCOPE_VERSION_CHANGED),
   projects each resource to its allowlisted fields intersected with
   fieldManifest, and computes each contentHash as SHA-256 of the RFC 8785
   canonical JSON of the projection.
3. manifestHash is the SHA-256 of the canonical JSON of { formatVersion: 1,
   exportType, resources sorted by resourceType then resourceId with
   resourceType, resourceId, version and contentHash, objects sorted by
   objectId with objectId, checksum and byteSize, schemaFingerprints keyed by
   resourceType, migrationHead }. The plaintext bundle is one JSON document
   { manifest, resources } with the projected values inline. Phase 2 bundles
   carry governed-object manifests (identifier, checksum, size) and never
   object bytes.
4. A bundle that would exceed PORTABILITY_MAX_OBJECT_BYTES after encryption
   fails the artifact with PORTABILITY_LIMIT_EXCEEDED. Otherwise the worker
   encrypts, writes through the server-originated object path, waits for
   `ready`, and commits checksum (SHA-256 of the stored bytes), byte_size,
   manifest_hash, encryption_ref, object_id, state `ready` and the outbox event
   in one transaction.
5. Encryption envelope version 1. Content is chunked AES-256-GCM with 1,048,576
   byte plaintext chunks; each chunk nonce is 12 bytes made of a 64-bit
   big-endian chunk index and 32 zero bits, and the additional authenticated
   data is the header hash plus a final-chunk flag, so truncation and reorder
   fail. A fresh random 256-bit data key is generated per artifact. The header
   is canonical JSON { v: 1, mode, wrap } followed by the chunks.
   - managed_key: the data key is wrapped with AES-256-KW under the managed key
     held as a Worker secret named by version (PORTABILITY_EXPORT_KEK_V1,
     never in code, logs, events or responses). encryption_ref is
     `managed:v<version>:<wrapped data key, base64url>`. Old key versions stay
     available until the last artifact wrapped under them has expired.
   - recipient_key: the data key is wrapped with ECDH-ES+A256KW (RFC 7518)
     against recipientPublicKey. encryption_ref is `recipient:` followed by the
     RFC 7638 SHA-256 thumbprint of that key in lowercase hex. The recipient
     public key is stored in recipient_public_key until the artifact is
     `ready`, then cleared.
6. CFG-05C-05 (POST downloads, Idempotency-Key required) calls
   `portability_download_claim` which locks the artifact and checks in this
   order: visibility (else 404); a current grant covering every manifest
   resource and field and the acting party (else 403); fresh step-up when
   contains_protected (else 401 STEP_UP_REQUIRED); state `ready`, `now` before
   expires_at and revoked_at NULL (else 409 ARTIFACT_NOT_DOWNLOADABLE with
   details { state } where state is not_ready, expired or revoked); an existing
   claim for the same artifact, actor and key is reused without incrementing;
   otherwise download_count below max_downloads (else 409
   ARTIFACT_NOT_DOWNLOADABLE with state exhausted). A new claim inserts the
   claim row and increments download_count in one transaction with the audit.
7. After the claim the Worker streams from Storage with a server credential.
   managed_key artifacts are decrypted while streaming; recipient_key artifacts
   are streamed as stored. Headers: Content-Type application/octet-stream,
   Content-Disposition attachment with a server-generated filename from the
   artifact UUID, X-Content-Type-Options nosniff, Cache-Control no-store, and
   X-Artifact-Manifest-Hash and X-Artifact-Encryption. An aborted transfer marks
   the claim `aborted` and does not refund the download.
8. export_revoke (CAS) moves `requested`, `generating` or `ready` to `revoked`,
   sets revoked_at and schedules object deletion; delivery capability is removed
   before bytes because every claim rechecks state. A revoked artifact cannot be
   restored.

### Restore environment, verifier and check set

Restore never runs inside the hosted Worker. CFG-05C-01 restore only records the
request; an isolated verifier pulls it.

- Registered targets are code-owned. The Phase 2 registry has one target,
  `local_ephemeral`: an ephemeral local PostgreSQL and Storage stack created
  from the repository migration chain with no network path to the hosted
  Supabase project, never reachable with hosted credentials. A target must be
  isolated, non-production and production-fenced; a key outside the registry is
  400 INVALID_REQUEST at /targetEnvironment.
- The request must name an artifact in `ready` that has not expired or been
  revoked and that the actor may read (else 404 or 409 MANIFEST_CONFLICT with
  details { state }); expectedManifestHash must equal the artifact manifest_hash
  and requestedScope must be a subset of its scope (else 409 MANIFEST_CONFLICT);
  step-up when contains_protected. The transaction creates the verification in
  `requested` with evidence_version one above the highest prior terminal
  verification for the same artifact, target and hash, and one
  `portability.restore.verify` job. A second request while one is not terminal
  is 409 VERSION_CONFLICT.
- The verifier is the registered service principal portability.restore_verifier
  authenticated as CFG-05A-01 authenticates its release principal. CFG-05C-08
  lease selects the oldest `requested` verification for the verifier's target
  (SKIP LOCKED), or one whose lease expired with attempt_count below
  VERIFIER_MAX_ATTEMPTS, sets `restoring`, increments attempt_count and issues a
  VERIFIER_LEASE_MS lease with a 256-bit random token stored only as its SHA-256.
  The lease response is identifier-only. heartbeat extends the lease and sets
  the phase. A verification whose lease expires after the third attempt becomes
  `failed` with LEASE_EXHAUSTED and dead-letter evidence.
- CFG-05C-09 serves the source artifact to the lease holder. managed_key
  artifacts are decrypted server-side during this authenticated read;
  recipient_key artifacts are served as stored, and a verifier without the
  operator-supplied recipient private key must report failureCode
  RESTORE_KEY_UNAVAILABLE and never a pass. Verifier reads are audited and are
  not downloads.
- The verifier restores the requested scope into the registered target with the
  per-resource-type restore adapters (preserved identifiers, one transaction per
  resource type), then evaluates the check set below and sends one report.
  Check set version `1`:

| Result | Check | Pass condition |
|---|---|---|
| schema | Registered schema | For every restored resource type the target's registered column names and types equal manifest schemaFingerprints, and the target migration head equals manifest migrationHead or a registered forward-compatible successor |
| counts | Row and object counts | Restored resource count equals the scoped manifest entries and object references equal the manifest objects |
| hashes | Content hashes | Every restored resource recomputes its manifest contentHash, every object checksum matches, and the recomputed manifest hash equals expectedManifestHash |
| references | Reference closure | Every relation, term, route, media and template reference of every restored resource resolves inside the target; Phase 2 bundles carry no object bytes, so an object reference passes only when the target holds a ready object with the same SHA-256, otherwise the check fails with OBJECT_BYTES_UNAVAILABLE |
| rls | Row-level security | The code-owned suite portability.rls.v1 passes on every restored private table: anon and a wrong-party authenticated principal read nothing and write nothing; the owning actor reads and writes only within grant |
| rendering | Public rendering | Every restored entry that had a published revision in scope renders its public projection with HTTP 200 and no error state |
| accessibility | Accessibility checker | cms.a11y.structural at the current registered version returns `healthy` for every restored published revision |
| secretScan | Secret absence | The detector set portability.secrets.v1 matches nothing in restored rows, restored object metadata or artifact plaintext |

- The report carries the vector, actualManifestHash, target counts, an opaque
  evidenceRef and an optional failure code. The server alone derives the
  terminal state: `verified` only when all eight results are `pass`,
  actualManifestHash equals expected_manifest_hash and no failure code is
  present; otherwise `failed` with the report's failure code or CHECK_FAILED.
  `unknown` never counts as a pass. A replayed report with the same lease token
  returns the stored result; a different second report is 409 LEASE_CONSUMED.
- A `verified` verification is diagnostic evidence under the Free-tier
  constraints above. It sets no promotion state and writes no recovery-readiness
  record.
- Runbook gate: the Slice 16 documentation layer adds a restore-verification
  section to `docs/runbooks/platform/release-recovery-gates.md` that states how
  an operator starts the verifier against `local_ephemeral`, supplies a
  recipient private key and object fixtures, reads the eight-check vector, and
  what a `verified` result does not prove (no PITR, RPO, RTO or promotion
  eligibility). Promotion stays governed by that runbook's Recovery readiness
  rules, which remain closed on the Free tier.

### Accessibility and content-quality checker

D25 decision: the checker is code-owned, versioned structural checks executed
in the Worker over the rich_text.v1 AST (DEC-112) and the block and template
registry. It is not a rendered-DOM audit, uses no browser, no Browser Rendering
provider and no axe-core, and its result never replaces human review or the
build-time accessibility tests of ENGINEERING-STANDARDS.

| Registry field | cms.a11y.structural version 1 |
|---|---|
| checkerKey and checkerVersion | cms.a11y.structural and 1; versions are positive integers, older versions stay readable, and the registry marks exactly one current version per target type |
| targetType | cms.entry_revision with targetId the revision UUID and targetVersion its revision_number |
| runtime | In-process pure TypeScript module in the Worker; no network provider and no DOM |
| timeoutMs | 2,000 wall-clock milliseconds covering input load and evaluation, inside the 100 to 2,000 range |
| Inputs | One read-only RPC load of the revision (values by stable field ID, locale, schema version, template version, composition instances); for every referenced block its safe BlockDefinitionRegistryRecord (lifecycle, accessibility manifest, props snapshot); for every media reference the asset's verified media type family and the approved AssetAccessibility row for that asset, use code and the revision locale; the revision's render plan |
| Document order | The render plan: template slot order, then bound field position within each slot, then composition order. It is the pure function the projection compiler also uses; the checker never re-derives order |
| inputHash | SHA-256 of the canonical JSON of the checker key and version, the revision content hash, the block record hashes, the accessibility row identifiers, versions and states, and the render-plan hash |

Rules of version 1. Messages come from a code-owned catalog keyed by ruleId. A
finding never contains author text, alt text, link text, URLs or asset names.

| ruleId | Severity | Condition |
|---|---|---|
| structure.rich_text_invalid | blocking | A rich_text value fails the shared rich_text.v1 validator |
| structure.block_unregistered | blocking | A block key and version is not in the registry or its lifecycle is withdrawn |
| heading.empty | blocking | A heading node has no non-whitespace text |
| heading.first_level | blocking | The first heading in document order is not level 2 |
| heading.level_skipped | blocking | A heading level exceeds the previous heading level by more than one; decreases are allowed |
| link.text_empty | blocking | A link has no non-whitespace text |
| link.text_generic | blocking | The normalized link text is in the version's generic-phrase list for the revision's primary language |
| link.text_is_url | warning | The link text equals its target or starts with https:// or mailto: |
| link.text_unchecked_language | warning | The revision's primary language has no generic-phrase list, so link.text_generic was not evaluated |
| alt.missing | blocking | An image reference has no approved AssetAccessibility row for its asset, use code and locale, or that row is neither decorative nor has non-empty alt text |
| media.accessibility_not_approved | blocking | A media reference's AssetAccessibility row exists but is not `approved` |
| media.captions_missing | blocking | An audio or video reference lacks the caption or transcript reference its use code's registered policy requires |
| landmark.name_missing | blocking | A block instance whose manifest has nameRequired true lacks a non-empty accessibleName prop of 1 to 160 characters after trimming |
| landmark.name_duplicate | warning | Two instances of the same landmark-type block share a normalized accessibleName |

- Link text is normalized by NFKC, lowercase, trim, whitespace collapse and
  removal of trailing punctuation. Version 1's generic-phrase list for primary
  language `en` is: click here, click, here, more, read more, learn more, link,
  this link, this page, tap here. An absent language list produces the warning
  above, never silence.
- A missing AssetAccessibility row for the revision locale is `alt.missing` or
  `media.captions_missing`; there is no fallback to another locale's text.
- If a block manifest has nameRequired true but its props snapshot defines no
  accessibleName short_text field, every instance yields `landmark.name_missing`
  so a registry defect fails closed.
- Evaluation order is structure, heading, link, media, landmark. Findings are
  sorted blocking first, then render order, ruleId and pointer, which makes
  results deterministic. At most FINDINGS_STORED_MAX findings are stored;
  blocking_count and warning_count are true totals and the findings document
  sets truncated when more were found.
- A QualityFinding carries ruleId, severity, a location (kind, JSON Pointer into
  the revision values using stable field IDs and indexes, fieldId, blockPath),
  the catalog message, an optional evidenceRef and the constant
  humanReview `required`. Location kind `route` is reserved for registered
  route checkers; no version-1 rule produces it.
- Run state: `healthy` when blocking_count is 0; `blocked` when at least one
  blocking finding exists; `failed` when the checker could not complete, with
  failure code CHECKER_TIMEOUT when the timer elapses and
  CHECKER_DEPENDENCY_UNAVAILABLE or TARGET_UNREADABLE otherwise (the idempotent
  input load is retried once after 250 ms inside the deadline); `stale` when
  now is at or after expires_at (run_at plus QUALITY_RUN_REUSE_SECONDS), the
  recomputed inputHash differs, or the checker version is no longer current.
  Staleness is evaluated on read and by consumers and persisted on first
  detection. A `failed` or `stale` run is never healthy.
- Gate use: the accessibility preflight of the BE03b preflight registry calls
  the in-process `quality_gate_evaluate` RPC at review submission, schedule
  execution and publication for the exact revision. A gate call always runs
  the current checker version fresh and never reuses a stored run. Only
  `healthy` passes; `blocked` returns the typed BLOCKING_FINDING refusal with
  details { runId, blockingCount }; `failed` is an unresolved preflight and no
  publication commits. The frozen dependency manifest records the checker key and
  version. Blocking findings leave the last active output intact; the `blocked` run
  is visible to the owner through CFG-05C-06 and CFG-05C-07 and emits
  quality.check.changed.
- The CFG-05C-02 quality_check action returns the evidence as 200 whether the
  run is `healthy` or `blocked`; an identical (checker, target version,
  inputHash) request inside QUALITY_RUN_REUSE_SECONDS returns the existing
  terminal run. A timeout returns 504 UPSTREAM_TIMEOUT with the persisted
  `failed` run.
- CFG-05C-07 returns targetEntryId, resolved server-side from the revision and
  only when the actor may read that entry (else null), so findings can link to
  the field in the editor without exposing a hidden entry.
- Warnings and findings are evidence, never facts: they cannot waive a blocker,
  approve content or replace the human reviewer.

## Database Schema

All tables are in private schema platform_private, RLS-enabled and forced.
Every field includes SQL type, nullability and constraint. Object IDs refer to
BE00 object metadata, while source/target polymorphic IDs are validated by
registered producer RPCs rather than a generic foreign key. Defaults are
revoked from public, anon and authenticated; only named Worker RPCs have
grants. A SQL CHECK written as `CHECK state <> x or ...` means the row
constraint is implemented as an implication on that state.

### Canonical records and fields

| Table | Fields with SQL type, nullability and constraints | Foreign keys | Query indexes and uniqueness | RLS and grants |
|---|---|---|---|---|
| platform_private.quality_import_jobs | id uuid NOT NULL PRIMARY KEY; source_format text NOT NULL CHECK registered format; source_version bigint NOT NULL CHECK >0; object_id uuid NOT NULL; mapper_key text NOT NULL CHECK registered mapper key; source_hash text NOT NULL CHECK 64 lowercase hex; target_scope jsonb NOT NULL; mapping_version bigint NOT NULL CHECK >0; duplicate_policy text NOT NULL CHECK reject or quarantine or update_if_version_matches or create_new; field_manifest jsonb NOT NULL; state text NOT NULL CHECK draft or dry_run or approved or running or completed or partial or failed or cancelled; cursor integer NOT NULL CHECK 0..500; row_count integer NULL CHECK 0..500; imported_count integer NOT NULL CHECK 0..500; quarantined_count integer NOT NULL CHECK 0..500; blocked_count integer NOT NULL CHECK 0..500; dry_run_report jsonb NULL; report_hash text NULL CHECK 64 lowercase hex; quarantine_object_id uuid NULL; failure_code text NULL CHECK uppercase code <=64; approved_by_person_id uuid NULL; approved_at timestamptz NULL; actor_person_id uuid NOT NULL; acting_party_id uuid NULL; idempotency_key text NOT NULL CHECK length 16..128; version_no bigint NOT NULL CHECK >0; created_at timestamptz NOT NULL; updated_at timestamptz NOT NULL | object_id references platform_private.object_records(id); quarantine_object_id references platform_private.object_records(id); actor_person_id and approved_by_person_id reference auth.users(id); acting_party_id references platform_private.party(id); format, mapper key and mapping version are release registry references; approved state requires report_hash, approved_by_person_id and approved_at | UNIQUE actor_person_id and idempotency_key; INDEX state and updated_at; INDEX source_hash; INDEX object_id; INDEX acting_party_id and created_at DESC; INDEX mapper_key, mapping_version and source_format | RLS forced; import RPC checks scope/capability and object intent; worker lease checks cursor/version; no direct authenticated table grant; source claims never enter authority tables |
| platform_private.quality_import_row_results | id uuid NOT NULL PRIMARY KEY; job_id uuid NOT NULL; mapper_key text NOT NULL CHECK registered mapper key; row_index integer NOT NULL CHECK 0..499; source_row_id text NOT NULL CHECK length 1..128; natural_key_hash text NOT NULL CHECK 64 lowercase hex; row_hash text NOT NULL CHECK 64 lowercase hex; classification text NOT NULL CHECK create or update or duplicate or conflict or quarantine or unsupported or blocked; rule_code text NULL CHECK uppercase code <=64; state text NOT NULL CHECK planned or committed or quarantined or blocked or failed; attempt_count integer NOT NULL CHECK 0..3; target_type text NULL; target_id uuid NULL; target_version bigint NULL CHECK >0; version_no bigint NOT NULL CHECK >0; created_at timestamptz NOT NULL; updated_at timestamptz NOT NULL | job_id references platform_private.quality_import_jobs(id) ON DELETE RESTRICT; target_type and target_id are validated by the mapper's producer RPC, not a generic foreign key | UNIQUE job_id and row_index; INDEX mapper_key, natural_key_hash, state and created_at DESC (import ledger lookup); INDEX job_id and state; INDEX target_type and target_id | RLS forced; import RPC and worker lease only; source row bytes are never stored, only hashes; no direct authenticated grant; readable only through the CFG-05C-04 projection |
| platform_private.quality_export_artifacts | id uuid NOT NULL PRIMARY KEY; export_type text NOT NULL CHECK cms or settings or audit_safe_projection or portability_bundle; scope_manifest jsonb NOT NULL; field_manifest jsonb NOT NULL; object_id uuid NULL; checksum text NULL CHECK 64 lowercase hex; manifest_hash text NULL CHECK 64 lowercase hex; byte_size bigint NULL CHECK 1..52428800; encryption_mode text NOT NULL CHECK managed_key or recipient_key; encryption_ref text NULL; recipient_public_key jsonb NULL; contains_protected boolean NOT NULL; expires_at timestamptz NOT NULL CHECK expires_at > created_at and expires_at <= created_at + interval 7 days; max_downloads integer NOT NULL CHECK 1..3; download_count integer NOT NULL CHECK 0..3; actor_person_id uuid NOT NULL; acting_party_id uuid NULL; purpose text NOT NULL CHECK length 1..512; state text NOT NULL CHECK requested or generating or ready or expired or revoked or failed; failure_code text NULL CHECK uppercase code <=64; CHECK state <> ready or (object_id, checksum, manifest_hash, byte_size and encryption_ref are all NOT NULL); CHECK recipient_public_key is NOT NULL only when encryption_mode = recipient_key and state is requested or generating; version_no bigint NOT NULL CHECK >0; created_at timestamptz NOT NULL; revoked_at timestamptz NULL | object_id references platform_private.object_records(id); actor_person_id references auth.users(id); acting_party_id references platform_private.party(id); scope and fields validated against owning projection registries | INDEX actor_person_id, state and expires_at; INDEX acting_party_id and created_at DESC; INDEX checksum; INDEX object_id; partial INDEX ready and expires_at WHERE state = ready; UNIQUE id and version_no | RLS forced; export RPC applies actor scope and field allowlist; object download RPC rechecks current grant, expiry, revocation and count; no object URL in logs |
| platform_private.quality_export_download_claims | id uuid NOT NULL PRIMARY KEY; artifact_id uuid NOT NULL; actor_person_id uuid NOT NULL; acting_party_id uuid NULL; idempotency_key text NOT NULL CHECK length 8..128; state text NOT NULL CHECK claimed or completed or aborted; claimed_at timestamptz NOT NULL; completed_at timestamptz NULL | artifact_id references platform_private.quality_export_artifacts(id) ON DELETE RESTRICT; actor_person_id references auth.users(id); acting_party_id references platform_private.party(id) | UNIQUE artifact_id, actor_person_id and idempotency_key; INDEX artifact_id and claimed_at DESC; INDEX state and claimed_at | RLS forced; portability_download_claim RPC only; the claim insert and the download_count increment commit in one transaction; no direct authenticated grant |
| platform_private.quality_restore_verifications | id uuid NOT NULL PRIMARY KEY; source_artifact_id uuid NOT NULL; evidence_version bigint NOT NULL CHECK >0; check_set_version text NOT NULL CHECK 1; target_environment text NOT NULL; target_scope jsonb NOT NULL; schema_result text NOT NULL CHECK pass or fail or unknown; count_result text NOT NULL CHECK pass or fail or unknown; hash_result text NOT NULL CHECK pass or fail or unknown; reference_result text NOT NULL CHECK pass or fail or unknown; rls_result text NOT NULL CHECK pass or fail or unknown; render_result text NOT NULL CHECK pass or fail or unknown; accessibility_result text NOT NULL CHECK pass or fail or unknown; secret_scan_result text NOT NULL CHECK pass or fail or unknown; state text NOT NULL CHECK requested or restoring or verifying or verified or failed; actor_person_id uuid NOT NULL; acting_party_id uuid NULL; attempt_count integer NOT NULL CHECK 0..3; lease_expires_at timestamptz NULL; lease_token_digest text NULL CHECK 64 lowercase hex; verifier_ref text NULL CHECK length 1..128; failure_code text NULL CHECK uppercase code <=64; reviewer_person_id uuid NULL (no Phase 2 writer, always NULL); completed_at timestamptz NULL; evidence_ref text NULL; expected_manifest_hash text NOT NULL CHECK 64 lowercase hex; actual_manifest_hash text NULL CHECK 64 lowercase hex; version_no bigint NOT NULL CHECK >0; CHECK state <> verified or (all eight result columns = pass and actual_manifest_hash = expected_manifest_hash); created_at timestamptz NOT NULL | source_artifact_id references quality_export_artifacts(id); actor_person_id and reviewer_person_id reference auth.users(id); acting_party_id references platform_private.party(id); target environment is a setup/runbook registry value and never production for initial pass | INDEX source_artifact_id and created_at DESC; INDEX target_environment and state; INDEX state and completed_at; UNIQUE source_artifact_id, target_environment, expected_manifest_hash and evidence_version; partial UNIQUE source_artifact_id, target_environment, expected_manifest_hash WHERE state is requested or restoring or verifying; INDEX state and lease_expires_at | RLS forced; restore RPC and the portability.restore_verifier lease, heartbeat and report RPCs only; no promotion path exists in Phase 2; authenticated sees status projection only; lease token only as digest |
| platform_private.quality_check_runs | id uuid NOT NULL PRIMARY KEY; checker_key text NOT NULL CHECK registered key; checker_version bigint NOT NULL CHECK >0; target_type text NOT NULL CHECK registered type; target_id uuid NOT NULL; target_version bigint NOT NULL CHECK >0; state text NOT NULL CHECK requested or running or healthy or blocked or stale or failed; findings jsonb NOT NULL CHECK a QualityFindingsDocument of at most 500 items; input_hash text NOT NULL CHECK 64 lowercase hex; timeout_ms integer NOT NULL CHECK 100..2000; failure_code text NULL CHECK uppercase code <=64; blocking_count integer NOT NULL CHECK 0..1000000; warning_count integer NOT NULL CHECK 0..1000000; evidence_ref text NULL; run_at timestamptz NOT NULL; expires_at timestamptz NOT NULL; actor_person_id uuid NOT NULL; version_no bigint NOT NULL CHECK >0; CHECK state <> healthy or blocking_count = 0; CHECK state <> blocked or blocking_count > 0; UNIQUE checker_key, checker_version, target_type, target_id, target_version, run_at | checker and target are code/producer registry references validated by quality RPC; actor_person_id references auth.users(id) | INDEX target_type, target_id, target_version, run_at DESC; INDEX checker_key, checker_version, expires_at; INDEX state and blocking_count; INDEX checker_key, checker_version, target_type, target_id, target_version and input_hash; INDEX evidence_ref | RLS forced; checker registry and quality RPC only; target owner/capability rechecked before response; no direct findings write |
| platform_private.quality_data_lifecycle_requests | id uuid NOT NULL PRIMARY KEY; request_type text NOT NULL CHECK archive or delete or anonymize or hold or release_hold or erasure; subject_person_id uuid NOT NULL; scope jsonb NOT NULL; verification jsonb NOT NULL; store_manifest jsonb NOT NULL; manifest_hash text NOT NULL CHECK 64 lowercase hex; conflict_refs uuid[] NOT NULL; decision_ref text NULL; state text NOT NULL CHECK requested or verifying or planned or approved or blocked or executing or completed or partial or failed; requester_person_id uuid NOT NULL; acting_party_id uuid NULL; counsel_decision_ref text NULL; reason text NOT NULL CHECK length 1..512; idempotency_key text NOT NULL CHECK length 16..128; version_no bigint NOT NULL CHECK >0; created_at timestamptz NOT NULL; updated_at timestamptz NOT NULL; completed_at timestamptz NULL; residual_manifest jsonb NULL | subject_person_id, requester_person_id reference auth.users(id); acting_party_id references platform_private.party(id); conflict_refs reference protected case/hold registry through typed RPC; counsel_decision_ref references approved policy registry when destructive | UNIQUE requester_person_id and idempotency_key; INDEX subject_person_id, request_type, state; INDEX manifest_hash; INDEX state and updated_at; INDEX acting_party_id and created_at DESC; INDEX conflict_refs using GIN | RLS forced; privacy/legal RPC verifies subject/scope, MFA, hold and counsel policy; worker updates only store evidence; held rows sealed and audited; no direct authenticated DML |
| platform_private.quality_lifecycle_store_results | id uuid NOT NULL PRIMARY KEY; request_id uuid NOT NULL; store text NOT NULL CHECK registered store; item_count bigint NOT NULL CHECK >=0; action text NOT NULL CHECK archive or delete or anonymize or hold or release_hold or erasure; state text NOT NULL CHECK pending or executing or completed or partial or failed or blocked; evidence_ref text NULL; attempted_at timestamptz NOT NULL; completed_at timestamptz NULL; error_code text NULL CHECK uppercase code <=64; residual_count bigint NOT NULL CHECK >=0; version_no bigint NOT NULL CHECK >0 | request_id references quality_data_lifecycle_requests(id); store is a code-owned adapter registry reference; no generic FK to heterogeneous stores | UNIQUE request_id, store, action; INDEX request_id, state; INDEX store, state; INDEX error_code; INDEX attempted_at DESC | RLS forced; lifecycle worker and status RPC only; store adapter may append result but cannot mark request complete; authenticated sees aggregate projection only |

### Permission, RLS and grants

The Worker role receives EXECUTE only on portability_action, portability_record_read,
portability_download_claim, quality_lifecycle_action and quality_record_read
RPCs plus named object-intent, restore-request, quality_gate_evaluate and
lifecycle-lease functions. The restore verifier service principal receives
EXECUTE only on portability_verifier_lease, portability_verifier_heartbeat,
portability_verifier_report and the leased artifact read. Security-definer
functions use an empty fixed search path, fully qualified objects and
server-derived RequestContext; the verifier functions derive the principal
from the mTLS credential and never from a body field.

Import RLS requires private object ownership/intent, target scope and actor
capability. Export RLS checks every manifest resource and field before
compilation and again at every download claim. Restore RLS limits writes to
registered isolated targets, requires the expected manifest hash, and lets only
the lease holder report. Quality RLS checks the exact target/version and checker
registry. Lifecycle RLS checks verified subject, acting party, privacy/legal
capability, hold precedence and purpose grant; a store worker cannot widen a
manifest or close a request from one store result. Read RPCs return only rows
the actor and acting party may see and never a total count.

## Middleware & Policies

### Hono middleware order

Every route runs request ID, TLS/method/security headers and exact CORS,
content/body size guard, session and acting context, CSRF for cookie
mutations, strict Zod action parsing, target/scope capability policy, step-up
for protected/lifecycle operations, rate limiting, idempotency lookup,
handler/RPC, transaction/outbox, queue lease and ApiError normalization.
Object adapters run after database authorization, never before. The internal
routes CFG-05C-08 and CFG-05C-09 replace session, acting context, CSRF and CORS
with mTLS service-credential verification and then follow the same order.

### Per-operation authorization matrix

| Operation ID | Principal and capability | Ownership and scope predicate | Commit or response recheck | Denial result |
|---|---|---|---|---|
| CFG-05C-01 | admin.portability.import for import, import_commit and import_cancel; admin.portability.export for export and export_revoke; admin.portability.restore for restore; step-up for protected data | Import object intent, target scope, mapper, source format/mapping and manifest are registered; export every resource/field is allowed; restore target is a registered isolated environment | Lock job/artifact/verification; recheck actor grant, source hash, report hash, expected manifest, expiry and target environment | Hidden object/artifact/job/target 404; visible scope outside grant 403; protected field or failed proof 422 |
| CFG-05C-02 | admin.quality.run for quality_check; admin.privacy.lifecycle with MFA for lifecycle; support only named purpose grant | Checker owns registered target/version; lifecycle subject and stores are verified; hold/counsel policy applies | Lock request and store manifest; recheck grant, hold, subject, checker version and each store result before terminal state | Hidden target/hold 404; visible action outside capability 403; blocker/hold conflict 422 |
| CFG-05C-03 | admin.portability.read | Each record is visible to actor and acting party; no total count | RLS on every returned row | Out-of-scope rows omitted; no 404 per row |
| CFG-05C-04 | admin.portability.read | Record kind and ID visible to actor and acting party | Re-read at response time | Hidden or absent 404; capability missing 403 |
| CFG-05C-05 | admin.portability.export on the artifact's acting party; step-up when contains_protected | Current grant covers every manifest resource, field and the acting party | Lock artifact; recheck state, expiry, revocation and count in the claim transaction | Hidden 404; grant gap 403; not ready, expired, revoked or exhausted 409 |
| CFG-05C-06 | admin.quality.read; admin.privacy.lifecycle for lifecycle; named purpose grant for one support record | Each record visible to actor and acting party; holds concealed | RLS on every returned row | Out-of-scope rows omitted; no total count |
| CFG-05C-07 | Same as CFG-05C-06 for the record kind | Record visible to actor and acting party | Re-read at response time | Hidden or absent record or hold 404; capability missing 403 |
| CFG-05C-08 | Service principal portability.restore_verifier, scope portability.restore.verify | Target environment is registered and isolated; lease token digest matches an unexpired lease | Lock verification; recheck lease, attempt count and token digest | Bad credential 401; wrong scope or target 403; expired or consumed lease 409 |
| CFG-05C-09 | Same service principal plus live lease token | Artifact is the leased verification's source artifact | Recheck lease and artifact state | Other artifact 404; expired lease 409 |

### Capability registry additions

These keys are registered in the BE05b capability registry and issued through
CFG-11 grants with named actions, scope and a mandatory end time. None carries
grant or revoke actions.

| Capability key | Allows | Never allows |
|---|---|---|
| admin.portability.read | Read CFG-05C-03 and CFG-05C-04 for records in scope | Any command, download or bytes |
| admin.portability.import | CFG-05C-01 import, import_commit and import_cancel within the mapper target scope | Publication, activation, authority import |
| admin.portability.export | CFG-05C-01 export and export_revoke and CFG-05C-05 claims within the granted scope and fields | Wildcard export, protected evidence, secrets |
| admin.portability.restore | CFG-05C-01 restore against registered isolated targets | Production restore or promotion |
| admin.quality.read | Read quality runs and findings through CFG-05C-06 and CFG-05C-07 | Running checkers, waiving blockers |
| admin.quality.run | CFG-05C-02 quality_check for registered target types | Publishing, editing content, legal exceptions |
| admin.privacy.lifecycle | CFG-05C-02 lifecycle actions and lifecycle reads, with MFA | Ordinary content access beyond the case, erasing holds or audit |

The restore verifier is a registered service principal, not a human
capability. It is registered like the CFG-05A-01 release principal with mTLS,
scope portability.restore.verify and the registered target environment keys it
may serve; a service principal cannot be recovered by a support grant.

### Security and abuse controls

- Import bytes are scanned privately before mapping. Supported fields,
  relations, routes, media manifests and setting values are mapped through
  versioned registries. Unknown rows are bounded and quarantined; no
  caller-controlled SQL, template, executable, HTML or object path runs.
- Import provenance is preserved and source claims cannot create authority,
  ownership, consent, verification, money, rights or legal status. A duplicate
  policy never overwrites a newer target without an exact version match.
- Export has a server-built allowlist for scope, fields and references.
  Secrets, credentials, private content, unrelated evidence, raw audit
  payload and provider tokens are excluded or require a separate protected
  workflow. Encryption key references never enter response or logs.
- Artifact access rechecks actor, party, scope, expiry, revocation and
  download count. A signed URL or object key is not an authorization decision.
- Restore proof checks schema, counts, hashes, references, RLS, representative
  rendering, accessibility and secret absence. Count-only success is failure.
  The isolated target is fenced from production until proof and runbook
  approval are complete.
- Quality findings include exact target version, location, severity, rule,
  evidence reference and blocker classification. Warnings do not become facts
  or replace human review; stale checker or target results cannot gate current
  content as healthy.
- Lifecycle planning enumerates DB rows, revisions, projections, objects,
  renditions, caches, search, sitemap, exports, backups, processors and
  third-party references. Legal holds block destructive actions and minimize
  access. Erasure separates subject-owned optional content from jointly
  authored evidence and records residual exceptions.
- Row screening, restore secretScan and export allowlists use the code-owned
  detector set portability.secrets.v1 and the portable resource registry; a
  caller cannot supply a pattern, a field outside the registry or a mapper.
- A verifier credential, lease token, recipient public key, wrapped data key,
  managed key version secret and object key never enter logs, events, error
  details or responses. The lease token is shown once in the lease response and
  stored only as a SHA-256 digest.
- Download claims, verifier reads and denials are audited with artifact ID,
  actor class and outcome only. CFG-05C-05 is POST so that a cross-site request
  cannot consume a download without the CSRF token.
- The checker returns catalog messages and locations only. Alt text, link text,
  URLs, headings and asset names never appear in findings, logs or events.
- Rate counters use verified user and acting party. Logs and event payloads
  contain IDs, hashes, versions, counts and codes only, never source bytes,
  private fields, evidence or credentials.

## Data Flow

### Transaction and external seams

| Operation ID | Canonical transaction | External seam request and response | Timeout, retries and circuit breaker |
|---|---|---|---|
| CFG-05C-01 import | Validate ready private object, mapper and manifests; create job `draft`; dry-run worker writes row results, quarantine object and report and moves the job to `dry_run`; import_commit records approval and moves to `running`; commit worker batches of PORTABILITY_BATCH_ROWS write drafts, row results, counts, cursor, idempotency and outbox atomically per batch | Object adapter request: object ID, owner scope, expected SHA-256. Response: byte stream from a BE00 `ready` object (scan already passed in BE00 verification). Mapper adapter (in-process registry module) request: mapper key and version, at most 50 row envelopes, mapping version. Response: typed row classifications and target IDs/versions; the commit path calls the owning command (cms_create_entry, cms_create_revision, CFG-05A-03) with a row idempotency key | Object read and mapper call 2,000 ms each; 3 retries at 15/60/300 s for safe read and classify and for idempotent row commits; circuit after 5 failures for 60 s. Unknown outcome leaves the row `planned` and is reconciled by row idempotency; route deadline 15,000 ms and the queue executes. |
| CFG-05C-01 export | Validate manifest and fields; create artifact `requested`; compile worker moves to `generating`, projects canonical versions, encrypts and writes the object, then commits hash, size, expiry, download cap and audit/outbox on `ready` | Export compiler (in-process registry module) request: scope manifest, field manifest, canonical versions. Response: projections, content hashes and manifest hash. Object adapter request: server-originated write of the ciphertext. Response: object ID and SHA-256 after BE00 verification. | Compiler read and object write 2,000 ms each; 3 retries at 15/60/300 s; circuit 5/60 s. Unknown compile leaves `generating`, never `ready`; a download claim and stream have no Worker retry. |
| CFG-05C-01 restore | Validate artifact, hash and registered isolated target; create verification `requested`; no Worker outbound call. The isolated verifier leases, restores, verifies and reports; the report transaction derives the terminal state | Verifier seam (CFG-05C-08 and 09): lease response is identifier-only; artifact read is a leased byte stream; report request carries the eight-result vector, actualManifestHash, target counts, evidenceRef and optional failure code | Lease 120,000 ms with heartbeat at most every 30,000 ms; 3 attempts then `failed` with LEASE_EXHAUSTED; no Worker retry and no circuit because the Worker makes no outbound call. Any fail or unknown prevents `verified`. |
| CFG-05C-02 quality | Lock exact checker/target; insert run; execute the in-process checker; persist findings/evidence and outbox | In-process checker adapter request: checker key/version, target type/id/version, one RPC load of the revision, block records and AssetAccessibility rows. Response: QualityFindingsDocument with counts and inputHash. | Wall clock timeout_ms of the checker version (100 to 2,000; cms.a11y.structural version 1 is 2,000) covering load and evaluation; one retry at 250 ms for the idempotent load only; circuit 5/60 s on the load dependency. Timeout persists `failed` and returns 504, never healthy; queued run deadline 15,000 ms. |
| CFG-05C-02 lifecycle | Lock request/manifest; verify subject, hold and policy; lease each store; append result/evidence; derive completed only when every store terminal and no residual conflict | Store processor request: request ID, store name, action, exact manifest subset and idempotency key. Response: attempted/completed counts, residual count, state, error code and evidence reference. | Processor 2,000 ms; 3 retries at 15/60/300 s only for idempotent store operation; circuit 5/60 s per store. Unknown remains partial/pending; held store stays blocked. |
| CFG-05C-03, 04, 06, 07 | One read RPC returning only rows visible to actor and acting party, cursor-bounded to 50 rows | None | 8,000 ms deadline; no retry; no-store; an RPC failure is 503, never an empty page. |
| CFG-05C-05 | download-claim transaction (visibility, grant, step-up, state, expiry, revocation, count) then stream | Storage read with a server credential; managed_key artifacts decrypted while streaming | 15,000 ms to first byte; no retry after the first byte; aborted transfer marks the claim `aborted` and does not refund. |
| CFG-05C-08, 09 | Lease, heartbeat, report and leased read transactions locking the verification row | mTLS service principal | 15,000 ms; lease rules above. |

All portability, checker and lifecycle jobs are BE00 at-least-once jobs with
stable idempotency keys and dead-letter evidence after three attempts. A worker
crash after a store commit is reconciled by request/store/action uniqueness and
by row idempotency for imports. An unknown provider result is pending, partial
or unknown, never complete.

### State machine and concurrency

| Aggregate | Allowed transitions and guards | Concurrent or failure behavior |
|---|---|---|
| Import job | draft to dry_run to approved to running to completed or partial or failed or cancelled; draft may also go to failed at dry run; dry_run or partial may go to approved again through import_commit; draft, dry_run, approved, running and partial may go to cancelled | Source, mapper and report hashes are frozen. Commit requires the stored report hash. Cursor and batch idempotency are CAS-protected; interrupted execution resumes at the exact cursor; a changed target version quarantines that row. |
| Export artifact | requested to generating to ready to expired or revoked or failed; requested, generating and ready may go to revoked | Artifact is downloadable only in ready state before expiry, with revoked_at NULL and download_count below the cap. Expiry/revoke removes delivery capability before bytes; duplicate request replays the artifact. |
| Restore verification | requested to restoring to verifying to verified or failed; an expired lease returns restoring or verifying to requested while attempt_count is below 3, else to failed | Initial target is isolated. Any schema/count/hash/reference/RLS/render/a11y/secret failure fences the evidence as failed; a later verification is a new row with the next evidence_version. |
| Quality check run | requested to running to healthy or blocked or failed; healthy or blocked to stale | Checker and target version are immutable. Staleness is evaluated on read and by consumers; duplicate run uses exact idempotency and does not claim current health. |
| Lifecycle request | requested to verifying to planned to approved or blocked to executing to completed or partial or failed | Hold conflict remains blocked. Each store result is unique and retryable; completion requires all store evidence and empty residual obligations. |
| Lifecycle store result | pending to executing to completed or partial or failed or blocked | Store processor cannot close parent. Reconcile after unknown outcome before retrying; completed items remain evidence. |

Import execution never reruns a broad query. Export field and scope manifests
are exact. A verified restore is fenced from any promotion by the absence of a
promotion command. Quality publishing uses the last active output while blockers
exist. Lifecycle deletion and erasure are never inferred from a missing store
result; partial state remains open until operator resolution or a recorded
exception.

## Event Schemas

The event uses the BE00 identifier-only envelope: eventId uuid, eventType
literal, occurredAt timestamptz, requestId uuid, correlationId uuid,
actorRef uuid nullable, aggregateId uuid, aggregateVersion bigint and strict
payload. No source bytes, legal rationale, subject identity, evidence content
or store payload is emitted.

~~~ts
export const QualityLifecycleChangedV1 = z.strictObject({
  lifecycleRequestId: z.uuid()
});
~~~

| Event type | Producer operation | Payload and consumer rule |
|---|---|---|
| quality.lifecycle.changed.v1 | CFG-05C-02 | lifecycleRequestId; lifecycle, privacy/legal and admin projections refetch current authorized state and store evidence, never infer completion from the event. |

Import, export, restore and quality-check job transitions use BE00 job/event
records and remain identifier-only. They do not mint additional Shard 05 event
types or duplicate the parent event registry.

## Error Handling

### Boundary mapping

| Boundary | Typed internal failure | HTTP and ApiError code | State guarantee |
|---|---|---|---|
| Action/schema | Unknown action branch, format, field, scope, manifest, unregistered mapper, resource type or target environment, expiresAt outside the 7-day bound, or oversized body | 400 INVALID_REQUEST or 415 UNSUPPORTED_FORMAT | No object, artifact, checker or lifecycle mutation. |
| Auth/session/step-up | Missing session, expired session or stale MFA | 401 UNAUTHENTICATED or 401 STEP_UP_REQUIRED | No target lookup that could disclose existence and no lease. |
| Capability/scope | Visible target outside portability, quality, privacy/legal or purpose grant | 403 FORBIDDEN | No mutation, download or destructive lease. |
| Visibility | Object, artifact, target, hold or subject not visible | 404 NOT_FOUND | No existence, count, snippet, artifact or hold leakage. |
| Version/hash/idempotency | Changed target, manifest, report hash, checker, source or duplicate key; active verification already open | 409 VERSION_CONFLICT, MANIFEST_CONFLICT or IDEMPOTENCY_CONFLICT | Transaction rolls back; prior active output and evidence remain. |
| Download state | Artifact not ready, expired, revoked or out of downloads | 409 ARTIFACT_NOT_DOWNLOADABLE with details { state } | No claim, no count change, no byte. |
| Verifier lease | Expired, consumed or mismatched lease token | 409 LEASE_EXPIRED or LEASE_CONSUMED; 422 REPORT_INVALID for a malformed or contradictory report | Verification keeps its prior state; the lease is never extended after expiry. |
| Domain safety | Protected field, unsupported mapping, size or row limit, blocking finding, hold/shared-record conflict | 422 PROTECTED_FIELD, PORTABILITY_LIMIT_EXCEEDED, BLOCKING_FINDING or HOLD_CONFLICT | Import quarantines or fails, export refuses, publish remains active, lifecycle remains blocked. |
| Provider/worker | Storage, mapper, compiler, checker or store timeout/unavailability, or a verifier lease that exhausts its attempts | 503 PORTABILITY_UNAVAILABLE or LIFECYCLE_UNAVAILABLE; 504 UPSTREAM_TIMEOUT | Pending, unknown, stale or partial state; never ready, healthy or complete. |
| Unexpected | Unclassified exception | 500 INTERNAL_ERROR | Rollback and safe request ID telemetry; no false terminal state. |

### Operation error coverage

| Operation ID | Required edge cases and recovery |
|---|---|
| CFG-05C-01 | Unsupported format/version or unlisted mapper, malformed or oversized row, row cap exceeded, source over the 50 MiB profile, duplicate/conflict under each duplicate policy, changed target after dry run, ownership/authority import claim, secret in a row, protected export field, expired/revoked artifact, download over cap, restore with a missing isolated target or missing recipient key, restore count-only pass with schema/hash/reference/RLS/render/a11y/secret failure, expired verifier lease, and interrupted cursor; quarantine, block, fail, deny, expire or retry exact state. |
| CFG-05C-02 | Structural/schema/reference/a11y/privacy/rights/legal blocker, checker timeout, stale checker/target/input, unavailable diagnostic dependency, missing store, legal hold, shared evidence, failed processor and residual erasure; preserve active output, block/partial state and store-by-store evidence. |
| CFG-05C-03, 04, 06, 07 | Hidden record, out-of-scope row, malformed cursor, limit above 50, stale ETag consumer and read dependency failure; omit, 404, 400 or 503 and never an empty page standing for failure. |
| CFG-05C-05 | Hidden artifact, grant gap, missing step-up, not-ready/expired/revoked/exhausted artifact, duplicate claim key with the same body, aborted transfer and concurrent download over 3; typed refusal or idempotent reuse with no unrecorded byte. |
| CFG-05C-08, 09 | Wrong principal or target, no work available, lease expiry mid-restore, third failed attempt, report replay and contradictory report; typed refusal or the stored result. |

### Failure and rule codes

failureCode and ruleCode values are uppercase codes of at most 64 characters
stored on the record and returned in detail reads. They are not HTTP errors.

| Scope | Codes |
|---|---|
| Import job failureCode | SOURCE_UNPARSEABLE, PORTABILITY_LIMIT_EXCEEDED, DUPLICATE_REJECTED, MAPPER_UNAVAILABLE, ROW_RETRIES_EXHAUSTED |
| Import row ruleCode | NATURAL_KEY_DUPLICATE, VERSION_MISMATCH, AUTHORITY_CLAIM, UNSUPPORTED_FIELD, ROW_INVALID, ROW_TOO_LARGE, SECRET_DETECTED, TARGET_CHANGED |
| Export artifact failureCode | PORTABILITY_LIMIT_EXCEEDED, SCOPE_VERSION_CHANGED, COMPILER_UNAVAILABLE |
| Restore verification failureCode | RESTORE_KEY_UNAVAILABLE, OBJECT_BYTES_UNAVAILABLE, MANIFEST_HASH_MISMATCH, LEASE_EXHAUSTED, CHECK_FAILED |
| Quality run failureCode | CHECKER_TIMEOUT, CHECKER_DEPENDENCY_UNAVAILABLE, TARGET_UNREADABLE |

## Observability

| Operation ID | Required structured event and metrics | Trace and redaction |
|---|---|---|
| CFG-05C-01 import | quality.import.changed with job ID, state, source format/version, mapper key, mapping version, cursor, counts, report hash and outcome; quarantine, conflict, blocked-row, retry and DLQ metrics | Trace object read, mapper and target RPC; source bytes, rows, natural keys, ownership claims and private fields are scrubbed |
| CFG-05C-01 export | quality.export.changed with artifact ID, export type, manifest hash, state, expiry, download count and encryption mode; rejected-field, expiry, revoke, size-limit and download-denial metrics | Trace compiler and object write; no fields, scope IDs, key references, wrapped keys, recipient keys or object links |
| CFG-05C-01 restore | quality.restore.changed with verification ID, target environment, evidence version, attempt count, result-state vector and outcome; false-confidence, lease-expiry and proof-failure metrics | Trace request and verifier lease; target payload, object bytes, lease tokens and secret scan content are excluded |
| CFG-05C-02 quality | quality.check.changed with run ID, checker key/version, target type/version, state, finding counts, input hash and timeout; blocker, stale, failed, timeout and latency metrics | Trace checker registry and in-process load; finding text, alt text, link text and evidence content are redacted |
| CFG-05C-02 lifecycle | quality.lifecycle.changed with request ID, action, state, manifest hash, store count, residual count and outcome; hold, partial, conflict, deletion and reconciliation metrics | Trace planner and each store lease; subject identity, legal rationale, evidence and store payload are excluded |
| CFG-05C-03, 04, 06, 07 | portability.read.completed and quality.read.completed with route template, record kind, result count class, outcome and latency | Trace read RPC; record IDs may be hashed, no counts of hidden rows and no field values |
| CFG-05C-05 | quality.export.downloaded with artifact ID, claim outcome (claimed, reused, denied by reason), concurrency and bytes class | No object key, filename content, key material or manifest contents |
| CFG-05C-08, 09 | quality.restore.verifier with verification ID, action (lease, heartbeat, report, read), attempt and outcome | No lease token, credential, payload or evidence content |

Logs use BE00 severity, environment, release, service, operation, outcome,
latency, requestId and correlationId. provider-native diagnostic sinks receive only scrubbed exception
metadata. Metrics distinguish requested, running, ready, healthy, blocked, stale,
unknown, partial, failed, expired and revoked; no absent evidence
implies success.

## Testing Strategy

### Contract and route tests

| Operation ID | Contract and route acceptance tests |
|---|---|
| CFG-05C-01 | Parse each strict branch (import, import_commit, import_cancel, export, export_revoke, restore); reject unknown keys, unsupported format or unlisted mapper, missing mapper key, missing report hash, recipient key rules, expiresAt past 7 days or in the past, protected export fields, unregistered or non-isolated restore target and oversized manifests; assert exact 400/401/403/404/409/415/422/429/503 and ApiError envelope and the 202 versus 200 status per action. |
| CFG-05C-02 | Parse quality checker and all six lifecycle actions; reject missing subject, manifest, step-up or counsel ref; assert healthy, blocked, failed (timeout 504), stale, hold, partial and terminal projections with CORS and idempotent replay. |
| CFG-05C-03, 04, 06, 07 | Parse strict queries (limit above 50, unknown keys and bad cursors rejected); assert no total count, hidden rows omitted, ETag on detail, child pages of at most 50, 403 versus 404 and that a failing read is 503 and never an empty page. |
| CFG-05C-05 | Assert POST-only, CSRF, Idempotency-Key, claim reuse for the same key, count increment once per new claim, the exact 401/403/404/409 order, response headers, managed_key decryption and recipient_key ciphertext, aborted-transfer behavior and the 3-concurrent cap. |
| CFG-05C-08, 09 | Parse each verifier action; assert credential and scope failures, SKIP LOCKED lease selection, token shown once and stored as a digest, heartbeat extension, expiry, three-attempt exhaustion, report replay, contradictory report and that the server derives the terminal state. |

### Authorization, persistence and concurrency tests

- For both operations test anonymous, wrong valid user, wrong party, forged
  object/artifact/target ID, expired/revoked grant, missing/stale MFA, hidden
  subject, stale target version and changed manifest. Match the exact matrix.
- Verify direct table access is denied to anon and authenticated. Positive and
  negative RLS/RPC tests cover admin portability, restore, quality, privacy/
  legal and named support purpose grants.
- Run two identical imports, exports, restores and lifecycle requests and
  assert one job/artifact/verification/request, one outbox event where
  applicable and identical replay response. Crash after object or store commit
  must reconcile by idempotency before retry.
- Change a target after import dry run or quality start and assert quarantine
  or stale result rather than overwrite. Revoke export grant before download
  and assert access denied even with a previously issued object link.
- Create a legal hold while lifecycle execution is queued and a shared
  evidence conflict during planning. Assert destructive stores block, optional
  subject-owned records are separated and residual manifest remains open.

### Portability and checker behavior tests

- Import: run each duplicate policy against the import ledger, an intra-file
  duplicate natural key, a claims-bearing row, a secret-bearing row, a row over
  65,536 bytes, a source over 500 rows and an object over 52,428,800 bytes;
  assert classification, counts, the report hash, that blocked rows leave no
  bytes, that import_commit with a stale report hash is 409, that a changed
  target quarantines with TARGET_CHANGED, resume from the exact cursor after a
  crash between batches, and that no row ever submits, reviews, publishes or
  activates anything.
- Export: assert each exportType's resource allowlist, protected step-up,
  PROTECTED_FIELD with no artifact row, SCOPE_VERSION_CHANGED, size-limit
  failure, deterministic manifestHash, envelope round trips for managed_key and
  recipient_key, tamper, truncation and reorder detection, KEK version retention
  and that no key material reaches logs, events or responses.
- Restore: assert the eight-check vector against a clean restore and against one
  injected failure per check, count-only success failing, OBJECT_BYTES_UNAVAILABLE
  for object references, a missing recipient key, evidence_version increments
  and that no code path promotes or writes recovery-readiness evidence.
- Checker (cms.a11y.structural version 1): table-driven fixtures for every
  ruleId in both pass and fail form, heading first level, skip and decrease,
  empty and generic and URL link text, an unlisted language warning, missing
  unapproved and decorative AssetAccessibility rows, caption and transcript
  policies per use code, nameRequired with and without accessibleName,
  duplicate landmark names, an invalid rich_text.v1 value, a withdrawn block,
  deterministic ordering and identical inputHash for identical inputs, the
  500-finding truncation with true totals, the 2,000 ms timeout producing
  `failed` and 504, the 250 ms single load retry, stale detection and that
  findings contain no author text.
- Gate: assert the BE03b accessibility preflight runs a fresh run at review,
  schedule execution and publication, passes only on `healthy`, refuses
  `blocked` with BLOCKING_FINDING, treats `failed` as unresolved and leaves the
  last active output intact.

### Security, performance and recovery tests

- Fuzz import bytes, mapping keys, field manifests, scope manifests, checker
  inputs and lifecycle JSON. Confirm no SQL, template, executable, HTML,
  path traversal, secret or provider token reaches adapters or logs.
- Prove imported claims cannot satisfy ownership, authority, consent,
  verification, money, rights or legal policy. Prove export count, filename,
  object key and manifest cannot disclose protected fields.
- Measure command route under 15-second deadline and queue adapters at exact
  2,000 ms provider timeout. Assert three retries at 15/60/300 seconds,
  circuit open after five failures for 60 seconds and DLQ after three worker
  attempts. Measure read routes under the 8-second deadline and the checker
  under its 2,000 ms timeout at the 512-node composition and 128-field bounds.
- Simulate storage, mapper, compiler, checker and lifecycle provider timeout,
  verifier lease expiry, duplicate delivery, unknown commit, partial store and
  restore false confidence. Assert pending, unknown, stale, failed or partial—not ready,
  healthy or complete.
- Verify export encryption and expiry, artifact revocation, isolated restore,
  secret scan, RLS negative tests and accessibility verification, and that a
  `verified` verification still opens no recovery gate on the Free tier.

### Accessibility handoff tests

The FE companion must render import mapping, row classification, dry-run
counts, quarantine errors and exact cursor state as keyboard-accessible tables.
Export scope/field allowlists, expiry, encryption and download limit are
announced in text. Restore verification presents every schema/count/hash/
reference/RLS/render/accessibility result, not just a green count. Quality
findings identify target, field/block/route, severity, rule and human-review
state; the findings table is a semantic table with a linear reading order and
severity as text. Lifecycle UI announces hold, blocker, store progress, residual
manifest and partial completion with semantic status rather than color alone.

## Deepening Passes

| Pass | Resulting hardening |
|---|---|
| Micro contract pass | Added strict action unions, bounded manifests, format/version enums, isolated restore literal, consent/counsel/step-up refinements and exact result vectors. |
| Boundary pass | Kept BE00 object/upload/job ownership intact; separated source claims from canonical truth, quality evidence from publication, and lifecycle orchestration from Shard 06 legal/evidence truth. |
| Adversarial pass | Rejected protected exports, authority imports, link-possession downloads, count-only restore, stale checker health, hold bypass and shared-evidence deletion. |
| Failure/recovery pass | Added exact cursors, per-store idempotency, unknown/pending/partial states, retry/circuit behavior, isolated restore fencing and residual manifests. |
| Data pass | Typed every table field, constraint, FK or registry rationale, index, forced RLS and named grant. |
| Macro consistency pass | Reconciled four 25.10 features, two interactions, six canonical/support models and the exact lifecycle event with 05a/05b and Shard 06 ownership. |
| Phase 2 completeness pass (2026-10-02) | Closed the import commit/approve/cancel, export revoke/download, restore verifier and check-set, encryption, size/expiry, mapper/resource registry and read-projection gaps for DEC-114 and defined the D25 structural accessibility checker. |

## Ambiguity Gate

PASS. Evidence:

- Micro: all nine operations have strict request/success contracts, exact
  ApiError/status mappings, explicit 403/404 behavior, rate/idempotency rules
  and operation-keyed tests; CFG-05C-01 and CFG-05C-02 carry strict
  action-specific branches.
- Macro: all four 25.10 ledger rows, two interactions, five canonical model
  names, the supporting store-result, import-row-result, finding and
  download-claim models and quality.lifecycle.changed.v1 map once;
  settings/admin ownership is explicit.
- External seams: object, mapper, compiler, in-process checker and store
  adapters and the isolated restore verifier have exact request/response,
  timeout, lease, retry/backoff and circuit behavior. Unknown outcomes remain
  pending, stale, blocked or partial.
- Persistence: every table field has SQL type, nullability, constraint,
  foreign key or registered polymorphic rationale, index, forced RLS and
  grant boundary.
- Transport: every registry row names CORS and exact BE00
  ApiError { code, message, requestId, details }.
- Tables: Markdown table widths were checked after authoring; cells contain
  no unescaped pipe separators.
- No unresolved gap, hidden authorization rule or undecided choice
  remains in this split.

## Open Questions

None.

## Changelog

| Date | Change | Workflow | Sections affected |
|---|---|---|---|
| 2026-08-28 | Authored 05c backend contracts from approved Shard 05 IA and deep dive; reconciled 25.10.01 through 25.10.04 | /write-be-spec | All |
| 2026-08-28 | Added strict portability branches, isolated restore proof, quality blockers, hold precedence and store-level lifecycle recovery | /write-be-spec-write | API, database, middleware, events, tests |
| 2026-10-02 | Phase 2 scope (DEC-114): closed CFG-05C-01 import, export and restore gaps (object adapter and 50 MiB profile, mapper and resource registries, import commit/cancel, export revoke, encryption envelope, download claim, isolated restore verifier and eight-check set, Free-tier no-PITR boundary) and added CFG-05C-03 to CFG-05C-09; defined the D25 code-owned structural accessibility checker (cms.a11y.structural version 1) over rich_text.v1 and the block registry | /propagate-decision | Phase 2 scope, API, contracts, database, middleware, data flow, errors, observability, tests |

## Dependency References

- BE00 Cross-cutting platform foundation: ApiError, RequestContext,
  object intents, jobs, idempotency, outbox, logging, SLOs and recovery.
- Shard 01 Identity authority and party governance: session, acting party,
  subject verification and MFA freshness.
- Shard 03 CMS content modeling and authoring: canonical content revisions,
  import/export projections and quality target versions.
- Shard 04 CMS navigation, media and delivery: media manifests, renditions,
  route projections, restore references and delivery quality.
- Shard 05a settings, flags and runtime: settings definitions and values
  accepted only through typed registry/import rules.
- Shard 05b admin workspace and operations: admin capabilities, task/audit
  projections and diagnostic evidence.
- Shard 06 Trust and safety: legal holds, safety cases, evidence and
  counsel-gated restrictions; this split stores references and orchestration.
