# Content schema registry release evidence

Use this runbook to assemble and verify the release sidecar for
`P2-S09-AC-209`, `P2-S09-AC-211`, `P2-S09-AC-265`, and `P2-S09-AC-266`.
Passing local tests does not satisfy these gates.

For Phase 2 implementation completion, DEC-105 moves AC265 to a mandatory
pre-release production-readiness/release gate, so Slice 10 implementation has
no AC265 prerequisite. The plan retains all 283 authored Slice 09 IDs
and 2000 authored Phase 2 criteria, while implementation completion uses
denominators of 279 for Slice 09 and 1996 for Phase 2. AC209, AC211, AC265, and
AC266 remain authored and unchecked outside those implementation denominators,
on distinct timelines, and must not be marked passed, waived, simulated, or
inferred.

This sidecar's production-bound expectations apply to production evidence.
`alerting` and `slo` are mandatory members of the production sidecar and
remain mandatory for AC209 and AC211: AC209 is a
production-rollout/post-initial-controlled-deployment alert gate that must pass
before alerting is declared ready for the release, and AC211 is post-launch
operational SLO acceptance that is mandatory after initial launch. Neither
gates the initial controlled production deployment or the initial launch.
AC266 remains the separate pre-release real-device gate; only the genuine
protected macOS/Safari/VoiceOver and Windows/Firefox/NVDA reports and combined
verification can close it.

AC265 follows the staging-only identity and evidence contract, and its logic
reads hosted evidence only. The combined release-evidence verifier still pins
`alerting.deploymentId` and `slo.deploymentId` to the expected production
deployment, but `verify-ac265-hosted-staging-evidence.yml` now provides the
separate prelaunch AC265 acceptance route. AC265 remains open until a genuine
protected hosted report and signed exact artifact provenance pass that route.
This production-bound sidecar is not AC265's only acceptance path.

## Immutable identity

Start from one successful immutable build. Record its full lowercase 40-character
source SHA, artifact SHA-256 digest, build ID, and migration version. Every
component report in the sidecar must name that same source SHA, and the hosted
E2E migration version must equal the artifact migration version. AC265 follows
the staging-only identity and evidence contract in the
[AC265 hosted E2E runner contract v1](./ac265-hosted-e2e-contract-v1.md); a
production-origin E2E run cannot satisfy AC265.

The protected workflow must independently create an expected-release-identity
JSON containing the trusted source SHA, artifact digest, build ID, migration
version, production deployment ID/`productionDeployedAt`, hosted
environment/deployment ID/`hostedDeployedAt`, exact web/API/Supabase origins,
and trusted evidence cutoff `trustedCutoffAt`. For AC265, it must additionally
pin the protected CI run ID/attempt, staging run ID/attempt, exact staging
deployment, build-manifest digest, deployed artifact digest, public pathless
web/API origins, hosting account and project, Supabase project reference, and
applied migration version and digest. Populate these values, deployment times,
and the cutoff from immutable deployment outputs/protected workflow state,
never by copying values from the sidecar being checked. The cutoff is captured
after the sidecar and reports are assembled, immediately before verification.

The protected workflow must retain the combined sidecar and its referenced,
redacted component reports as workflow artifacts. AC266 raw manual reports are
the exception: they are private workflow inputs only, and the intake and
verification workflows retain sanitized manifests rather than the source JSON.
Do not commit generated evidence, browser storage state, provider exports, raw
manual reports, or manual-test recordings to the repository.

## Required reports

| Criterion | Required non-local evidence                                                                                                                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC209     | Production-native alert configuration containing every locked condition plus one redacted delivered `platform.on_call` receipt captured after that configuration.                                                                                        |
| AC211     | Production query/report and dataset, at least 200 command/RPC/acceptance samples, retained queue/DLQ counts, one complete UTC day, and all five observed values below their strict thresholds.                                                           |
| AC265     | Staging-only `ac265-hosted-e2e-v3` report: all nine locked roles and ten scenarios, fresh Google through Supabase Auth, exact immutable candidate identity, opaque external session/resource references, server-derived receipts, and verified teardown. |
| AC266     | Automated axe report with zero Serious/Critical findings and complete manual VoiceOver/Safari/macOS plus NVDA/Firefox/Windows runs against the exact hosted deployment, origin, and SHA.                                                                 |

The automated axe target `/app/cms-content-modeling` is an unauthenticated
auth-boundary check only: it must finish at `/auth/sign-in` with HTTP 200. It
does not claim authenticated CMS page coverage; authenticated coverage belongs
to the AC265 hosted matrix and the manual accessibility runs.

## AC265 contract and current gate

The required runner input and evidence shape is defined by
[`ac265-hosted-runner-v1`](./ac265-hosted-e2e-contract-v1.md). Its accepted
aggregate report version is `ac265-hosted-e2e-v3`; an `ac265-hosted-e2e-v2`
report is legacy and cannot satisfy this gate. The report must bind the exact
CI/staging runs and attempts, deployment, source, build and build manifest,
artifact, public web/API origins, hosting and Supabase projects, and applied
migration. Every role, scenario, reference, and server receipt must bind to
that same identity.

#### AC265 staging-scope acceptance route

AC265 is staging-only by contract, but the combined sidecar above is
production-bound: it pins `alerting.deploymentId` and `slo.deploymentId` to
the expected production deployment, so it cannot pass before production
evidence exists. The `verify-ac265-hosted-staging-evidence.yml` workflow is
the staging-scope acceptance route that removes that prelaunch circularity. It
reuses the same V3 verifier and the same branded protected context as the
combined route, and it leaves the combined sidecar and its five production
files unchanged.

The route derives run, revision, deployment, and report-archive identity from
the GitHub Actions API for the exact completed `Deploy staging` run identified
by `staging_run_id` and `staging_run_attempt`. Those two dispatch inputs are
untrusted selectors only: they name which run and attempt to look up, and no
identity, digest, or trust value is taken from dispatch text or from the
artifact under verification. Every identity value is read back from the
verified GitHub Actions API response for that exact run attempt. `Deploy
staging` is triggered by `workflow_run`, and the report artifact is bound to
the exact attempt window so a stale prior-attempt artifact cannot satisfy the
gate.

Trust material comes only from the protected `staging` environment secret
`AC265_HOSTED_VERIFICATION_CONTEXT_BUNDLE_B64`, which carries the trusted
runner contract, the approved runner mappings and outage target with their
Ed25519 attestations and trusted public keys, the signed artifact-source
manifest and artifact trusted keys, the trusted cutoff, the report archive
member name, and the owner-pinned report body digest. The bundle has no
`workflow_dispatch` override. Missing, stale, mismatched, unsigned, or
future-cutoff input fails closed.

The archive digest reported by the GitHub artifact API authenticates the
downloaded archive; the report body digest is compared separately to the
owner-pinned bundle value. Both comparisons are required and are never
cross-compared.

The bundle is a bearer credential for this route, so it is rotated rather than
reused. It carries an explicit `trustedCutoffAt`; a cutoff that has not yet
occurred fails closed, so a bundle cannot be used before its window opens, and
every attestation, manifest, and report timestamp is bounded by it. Re-mint the
bundle for each acceptance attempt with a cutoff that covers only that run, and
rotate the trusted Ed25519 public keys, the signed artifact-source manifest,
the approved runner mappings, and the approved outage target together whenever
any of them changes. Revoke a superseded public key by publishing it with
`status: revoked` in the replacement bundle rather than by editing the
previous one. The bundle is delivered only as a protected `staging`
environment secret with no `workflow_dispatch` override, so it is never
echoed, logged, or uploaded.

**Current prerequisite, not present acceptance.** This route cannot execute
until a protected hosted producer integrates an upload of the
`ac265-hosted-e2e-report-v3` artifact into the completed staging run. The
current `Deploy staging` workflow does not upload that artifact, so no
staging run can satisfy the selector resolver today, and no AC265 closure may
be claimed from this route until that producer lands and runs. The route's
passing tests prove the verification boundary, not hosted acceptance.

The retained release gate is V3-only and fails closed without
`hostedV3Verification`, including the exact protected `runnerContractBytes` and
trusted `verificationContext`. The report's `runnerContractSha256` and trusted
`expectedRunnerContractSha256` must bind those exact bytes. Do not route this
gate through the legacy V2 compatibility validator: V2 cannot satisfy or
downgrade the retained release requirement.

The manifest carries exactly nine opaque
`ac265-session://<role>/<uuid>` handles and pre-existing safe staging resources
identified as `ac265-resource://<kind>/<uuid>`, with `kind` limited to
`content_schema`, `staff_case`, `organization`, or `prerequisite`. Session
contents never enter repository files, logs, reports, or retained artifacts.
Denied cases use eligible adults and do not create minors or invent mandates.
The real `fresh_google_oauth_through_supabase` flow, natural provider expiry,
server-generated HTTP 429, one-use staging-only `staging_one_use_lease`,
server-derived role/RLS/UI/scenario receipts, fixed `current_session_only`
logout, and a cleanup receipt are required. Any missing assertion or cleanup
failure blocks report publication.

`dependency_outage` and its lease proof are mandatory. The runner contract
must declare `scenarioParameters.dependencyOutage.outageLease`; the V3 report
must include the matching outage evidence, authenticated `leaseReceipt`, exactly
one consume event, and cleanup `outageLeaseReleaseProof`. The one-request lease
must be staging-only and at most 60 seconds. There is no skipped, omitted, or
unleased outage path that can pass the retained gate.

Role/resource and scenario/role mappings are independently trusted inputs, not
values the runner contract or report may authorize. Supply the protected V3
context's `approvedRunnerMappingsBytes`,
`approvedRunnerMappingAttestationBytes`, and
`approvedRunnerMappingTrustedKeys` for the versioned
`ac265-approved-runner-mappings-v1` source. Its exact run/candidate-bound role
resource-reference arrays and scenario-role assignments must authenticate over
the canonical bytes through the domain-separated Ed25519 envelope. The context's
`expectedRoleResourceBindings` and
`expectedScenarioRoleBindings` are cross-checked against that payload, then the
contract is compared exactly with the authenticated mappings. Keep required
keys complete; do not infer all role/scenario pairs or per-role resource kinds.
Bind role/scenario receipts to the approved session and resource reference
digests.

CP-03 now supplies a promoted application attestation boundary for the exact
`ac265-approved-runner-mappings-v1` bytes. PR #85 at exact main SHA
`a94ffbca3d41da703218dff12ee7527f31c23a34` passed exact-main CI
`35592046696`; staging workflow `35592722418` succeeded after one failed-job
retry for the immediate Cloudflare provider-evidence query, with no provider
configuration change, and deployment `6567092259` succeeded at
`https://staging.wejamm.in`. It canonicalizes those bytes and verifies a
trusted Ed25519 signature, key/report validity windows, domain separator, and
run/mapping identity. No live signing-key configuration, registry rows,
retained mapping/attestation artifact, attestation workflow run, hosted browser
matrix, independently authenticated receipt, or AC265 acceptance exists;
fixtures and generated test keys are not acceptance evidence.

CP-04a remains the promoted approved outage-target read and attestation
boundary. The service-role-only `ac265_approved_outage_target_read` RPC reads
CP-01 target rows and returns a redacted canonical target projection with its
stored `targetSha256`. A distinct domain-separated Ed25519 envelope binds the
exact `ac265-approved-outage-target-v1` bytes, target reference, run ID, digest,
key ID, and validity window. The protected manual main/staging entrypoint and
workflow, verifier, and policy require this signed target; a caller-provided
authenticity callback cannot substitute. The current promoted baseline is PR
#88 at implementation main SHA `52b66272e61331827c59ac1e169868474a2c09c8`,
exact-main CI `35612415141`, staging workflow `35613284966`, and deployment
`6570861931`. Candidate artifact `10645302055` has digest
`12f05e8371586996dc413b85b75167934045f342091defff5197435b8b707782`.
Live target key/configuration, seeded target or registry rows, retained
artifact, workflow run, hosted browser matrix, independently authenticated
receipt, and AC265 acceptance remain absent.

CP-04b is now the promoted approved outage-target registration foundation. PR
#88 uses implementation main SHA `52b66272e61331827c59ac1e169868474a2c09c8`.
PR CI replacement `35611484121` passed application (6m32s), database (1m55s),
and artifact (57s) jobs; exact-main CI `35612415141` passed application
(6m43s), database (2m00s), and artifact (56s) jobs; staging workflow
`35613284966` passed in 1m28s and published deployment `6570861931`.
Candidate artifact `10645302055` has digest
`12f05e8371586996dc413b85b75167934045f342091defff5197435b8b707782`.
Promotion carries its strict `ac265-hosted-approved-outage-target-registration-v1`
contract, bounded service-role client, and forward-only migration. The request
accepts only the criterion, schema version, authorization reference, exact
`ac265-outage-policy://staging/v1` policy reference, and idempotency reference.
The migration creates private forced-RLS policy and registration ledgers with
immutable mutation triggers and service-role-only execution. The policy target
validity is exactly 120 seconds, reserving a bounded 60-second acquisition
window before CP-01's exact 60-second, one-request lease. The active policy and
authorization must cover the full 120-second target window. The policy table is
empty in the deployed foundation and the registration table has no seeded rows;
disposable fixtures populate them only within local SQL tests.

The registration RPC matches the verified candidate's source, deployment,
staging hosting project, and Supabase project identity, then derives the
dependency, route, target reference, timestamps, validity window, project
fields, and canonical target digest on the server. The canonical JSON golden
test pins digest
`ecd573c63eff6b11b4ff044a70a8180901948e88a9c1db036f51f4a27e1f3d7e`.
The direct SQL integration proof registers a target and then acquires CP-01's
lease from the returned target reference, proving acquired state, exact
60-second duration, and one-request limit. Future-dated policies and windows
shorter than 120 seconds return only `{"status":"conflict"}` and create no
target. Replay is request-digest bound; changed requests and missing, expired,
mismatched, or racing registrations return the same generic conflict. Local
evidence is 35 registration pgTAP assertions, 2 concurrency assertions, and
15 RPC-client tests covering redirect/status/length/stream/UTF-8/cancellation,
reader, timeout, and secret-boundary failures. Promotion recorded staging API
p95 `32.589357ms` and automated axe digest
`df2522f8512dcea587146f5bce43ad5232b94964d5048825ffdb745286dd772d`; the axe
result is only the automated AC266 component and does not satisfy the deferred
manual platform reports or protected combined verification. No live
dependency/route policy, target, signing key, retained artifact, hosted matrix,
or independently authenticated receipt exists, so CP-04b promotion does not
satisfy AC265; AC265 remains a mandatory pre-release gate that does not block
Slice 10 implementation.

### CP-04c local attestation/resolver foundation (not release evidence)

CP-04c now provides a local/private foundation for strict, domain-separated
Ed25519 attestation over exact raw artifact bytes. The branded resolver requires
an independent `expectedSubjectSha256` and binds the exact artifact reference,
kind, run ID, candidate identity digest, and runner-contract digest. It keeps
exact reference/kind membership and caps the source set at 256. Each artifact
and attestation envelope is bounded to 64 KiB; public-key PEM input is bounded
to 8192 characters.

The upstream authenticated manifest/registry/run authority and external replay
ledger remain open. No approved live target, signing key, issuer, artifact
store, broker, hosted report, server receipt, or browser matrix exists. This
local foundation is not synthetic or hosted acceptance evidence: AC265 remains
open as a mandatory pre-release gate that does not block Slice 10
implementation.

### CP-01 outage-lease control operation (not release evidence)

The CP-01 lease now has a bounded control operation for the staging control
plane. One manually dispatched `main`/staging run performs exactly one
`acquire`, `consume`, or `release` call through
`run-ac265-outage-lease-control.ts` and its bounded service-role client
`ac265-outage-lease-rpc.ts`. The operator supplies only the authorization,
target, and idempotency references, plus the lease reference and digest for
consume and release; the entrypoint selects no dependency, route, target,
duration, or limit. The server still owns every timestamp, the canonical
reference digest, the fixed 60-second one-request policy, and the conflict
decision, and the client re-derives the lease digest from the returned
reference before accepting any result.

The control plane answers a deliberate refusal with an exact envelope whose
only member is `status` set to `conflict`. The operation reports that as a
distinct `AC265 outage lease <operation> conflict` outcome so an operator can
separate an authorization refusal from a transport or trust failure; every
other rejection collapses to one generic failure. The retained record carries
the operation, state, environment, lease digest, redaction marker, and the
server-derived lifecycle timestamps for the state it recorded: acquisition and
expiry with the fixed duration and request limit for an acquire, the consume
timestamp and request limit for a consume, and the release timestamp for a
release. Retaining those server timestamps is what lets an operator distinguish
an expired replay from a fresh decision without re-reading provider state. The
raw lease reference is a one-use capability for the subsequent consume and
release calls, so it is masked through a workflow command before use and then
written only to the job-scoped step output; it never enters the step summary or
the uploaded record.

One limitation is recorded rather than fixed: the control plane's acquire
replay is keyed to the exact request digest, so it returns the original
`acquired` envelope even after that lease has already been consumed or released.
The replay stays fail-closed for the capability itself, because a spent lease
cannot be consumed again and consumption never survives release, and the
retained lifecycle timestamps let an operator detect the spent state without
guessing. Do not treat a replayed `acquired` result as a live one-use grant.

This is transport and plumbing for an already-promoted private foundation. It
exercises no outage, seeds no approved target, registers no dependency or
route, contacts no hosted browser session, mints no receipt, and creates no
identity or grant. The approved dependency, route, and target remain
owner-pending and are deliberately not selected here. It is not AC265
acceptance evidence, it closes no criterion, and it does not satisfy the AC265
pre-release gate.

The read-only AC209 verifier `35612514031` passed exact-main preflight,
protection, and workspace checks, then failed closed at the capability query
with `provider_graphql_error`; it made no effects and retained no receipt. That
historical failure is not the current state: the same protected verifier passes
every step, including the capability query, at
[run 35777357009](https://github.com/WeJustJammin/wejammin/actions/runs/35777357009),
so AC209 is open on its evidence path and not on authorization.

The protected workflow must resolve each opaque reference and receipt to its
exact raw bytes, recompute SHA-256 before parsing, and cross-verify the
session-to-role binding, resource kind/project/safety, and every receipt's
subject and complete candidate identity against independently captured
protected deployment outputs. Receipt signatures/authenticity must be checked
over those same bytes; a digest alone is not authentication. Execution evidence
bytes must likewise be resolved, hashed, and bound to the expected evidence
kind, identity, subject, and (for teardown) session-reference digest. The local
v3 verifier uses trusted release-policy identity, run ID, contract digest,
canonical approved-mapping and attestation bytes, an independently trusted key
registry, matching trusted map fields, `resolveReceipt`, and
`verifyReceiptAuthenticity`; when execution evidence is declared, its resolver
must provide the raw bytes.

The retained V3 report, runner-contract JSON, and resolved receipt JSON must
reject duplicate object members before `JSON.parse` or schema validation.
Duplicate detection is recursive and compares decoded member names, so nested
duplicates and escaped-equivalent keys fail closed. For each role and scenario,
`durationMs` must fit inside the report window:
`durationMs <= completedAt - startedAt`.

The trusted verification context also supplies a positive safe-integer
`maxRunDurationMs`, `trustedCutoffAt`, the exact
`approvedOutageTargetBytes`, `approvedOutageTargetAttestationBytes`, and
`approvedOutageTargetTrustedKeys`. The target is parsed as
`ac265-approved-outage-target-v1` and its scope is the only source of
`expectedOutageLeaseScope`; authenticate the target bytes with the
domain-separated attestation and trusted keys before using that scope. Do not
accept the target, scope, or authenticity callback from workflow dispatch or
the runner contract. The scope is exactly `runId`,
`hostingProjectId`, `supabaseProjectRef`, `deploymentId`, `dependencyId`, and
route `{ operationId, method, path }`. No live target-source endpoint,
target key/configuration, approved row, or retained target artifact is defined,
so the retained gate stays closed. The
signed/authenticated lease receipt
must bind that scope to the staging-only `ac265-lease://staging/<uuid>` ref and
its exact-UTF-8 SHA-256, bounded acquire/expiry timestamps, one matching
consume event, one-request limit, and replay rejection. Cleanup release proof
must use the same lease ref/digest and be covered by the authenticated cleanup
result. Report duration must fit the trusted `maxRunDurationMs`; every receipt
`issuedAt` must be inside the report window and at or before the trusted
cutoff. All nine sessions require teardown proof using only
`current_session_only`; the authenticated cleanup receipt must be issued at or
after `cleanup.completedAt` and within that run window/cutoff.

The trusted-key list, `trustedCutoffAt`, and `maxRunDurationMs` are trusted
release-policy context preconditions. A future protected orchestration
constructor must source them from authenticated release/deployment policy
context; they must not be supplied by an untrusted caller. No current
untrusted caller exists, and this local verifier does not establish that
protected constructor.

These are local trust-boundary checks only. The verifier does not implement a
protected issuer, session broker, evidence-byte service, outage-lease service,
or independent binding to actual protected workflow/deployment outputs. CP-02
now provides a promoted staging private safe-resource and runner-mapping
registry foundation with forced-RLS tables and service-role-only RPCs; it stores
only opaque references/digests and redacted bindings, does not authenticate
mapping provenance or verify underlying resource contents, and seeds no rows.
CP-03 authenticates only supplied canonical mapping bytes; its code is promoted,
but it does not provide the live source key, resource-content validation, or
protected artifact needed for hosted acceptance.
Its local hardening covers UUID-v4 mapping-ID alignment, awaited response-body
cancellation, realpath/symlink-safe execution, an unnamed Linux `O_TMPFILE`
writability preflight, no-follow held descriptors, summaries constrained
beneath `RUNNER_TEMP`, and deletion-free fail-closed handling that preserves
only private runner-local remnants.
CP-04a authenticates only supplied canonical target bytes through its promoted
domain-separated attestation boundary. It does not provide live target-key
configuration, approved rows, retained artifacts, or hosted evidence.
CP-04b is a promoted server-derived registration foundation only. Its
private forced-RLS policy and registration ledgers are immutable and
service-role-only; the policy table is empty outside disposable local tests,
and the RPC requires the policy target validity to be exactly 120 seconds,
with the active policy and authorization covering the full target window. It
derives target identity, route, project, timestamps, expiry, and canonical
digest from the active server policy, authorization window, and verified
candidate. Direct local SQL proof registers a target and acquires CP-01's exact
60-second, one-request lease from its returned target reference; future-dated
and short-policy windows fail with the generic conflict. The expanded 15-test
RPC client suite covers bounded transport/reader failures and secret
non-disclosure. It does not provide a live dependency/route policy, target,
signing key, retained artifact, hosted matrix, or independently authenticated
receipt.
The protected population/authentication source, v1 session broker,
fault-evidence service, isolated hosted workflow, and report producer remain
unimplemented. The runner must be isolated and disposable; shared persistent
self-hosted runners and cross-run browser/session state are prohibited. Keep
this criterion blocked: these contracts and local checks do not prove hosted
acceptance.

The protected staging deployment runs `infra/workflows/collect-staging-axe-evidence.sh`
after public contract verification. It paginates GitHub deployment/status metadata,
binds the record to the current protected run's SHA, staging environment, ref,
task, creator, timestamps, and current `in_progress` status, then writes
`promotion-candidate/accessibility/axe.json` plus its independently generated
`axe.sha256` sidecar. The report verifier receives the independent sidecar
digest before the candidate and deployment evidence artifacts are uploaded, together with the
run-owned deployment creation time and a protected collection cutoff. GitHub keeps
the deployment status `in_progress` while this collection step runs; it may mark
the deployment `success` only after the job completes. This proves only the
automated Google Chrome (Chromium engine family)/axe portion and GitHub run
binding. Its precondition is the preceding `verify-staging` gate: the served
Cloudflare web response must expose
`x-wejammin-release` equal to the promoted SHA (the API response is checked too).
The GitHub deployment ID and Cloudflare Worker version ID are distinct provider
identities and must be recorded separately; neither substitutes for the served
release header or the other ID. The collector does not create or replace either
required manual screen-reader report.

After both staging Workers deploy, the protected workflow runs
`collect-provider-release-evidence.sh`. It queries Wrangler's JSON versions and
deployments listings for `wejammin-api-staging` and `wejammin-web-staging` and
retains only `promotion-candidate/provider-release-evidence.json`. The report
requires the newest deployment for each Worker to route exactly one version at
100%, that version to exist in the retained versions response, and its exact
`workers/tag`/`workers/message` annotations to bind `DEPLOY_SHA` and
`GITHUB_RUN_ID`. It contains version/deployment IDs, bounded timestamps, and
redacted annotations only; Wrangler payloads and credentials are never retained.

## Collect AC209 configuration evidence

After an exact `main` revision has passed CI, staging, and production promotion,
dispatch `collect-production-ac209.yml` from `main` with its full lowercase
`source_revision`, exact Cloudflare `production_version_id`, expected production
DLQ ID, approved configuration ID and reference, and
`confirm_collection: true`. The protected collector resolves the Cloudflare
deployment from one documented REST snapshot and obtains the exact retained
version's release attestation through the repository-pinned Wrangler CLI. It
fails closed unless the requested version appears in exactly one deployment,
that deployment is the current first deployment and routes only that version at
100%, and the version's `workers/tag` and `workers/message` bind the requested
source revision to a nonzero GitHub run ID. Mutable worker-settings annotations
are not accepted as version evidence. A GitHub deployment ID must not be
supplied as a Cloudflare deployment identity.

The retained configuration artifact is redacted configuration proof only. It
does not replace the required production-native alert exercise, Cloudflare email
delivery event, mailbox receipt, or exact-message DLQ cleanup evidence.

## Exercise AC209 delivery

Provision `CLOUDFLARE_QUEUE_EXERCISE_TOKEN` in the protected production
environment with account-scoped Workers Queues Write only. Do not reuse the
deployment token or a local Wrangler OAuth credential. Pin the provider-verified
Email Sending zone as `CLOUDFLARE_EMAIL_ZONE_ID`, the fixed sender digest as
`PRODUCTION_ALERT_SENDER_SHA256`, and the production source queue as
`CLOUDFLARE_PLATFORM_QUEUE_ID`. The existing observability token supplies
Account Analytics Read for Queue Analytics and Zone Analytics Read for the Email
Sending query. Its Zone Resources must include the exact Email Sending zone.
The production monitoring preflight requires the same settings capability the
exercise enforces: it rejects the observability token unless the exact Email
Sending zone's dataset is enabled, every event-query field is available to the
token, and the requester limits cover the 50-row bound, all seven selections,
and the one-hour analytics window. A capability shortfall therefore fails at
deployment verification rather than well into a protected exercise.

After the verification RPC migration and exercise workflow are deployed,
dispatch `exercise-production-ac209.yml` from `main`. Supply the exact deployed
source revision and Worker version, production DLQ ID, approved configuration ID
and reference, and set `confirm_exercise: true`. The protected job recollects
the exact-version configuration before any mutation. It then requires an
eligible alert cooldown and queries the exact zone's Email Sending Settings
node. The capability preflight requires `emailSendingAdaptive.enabled = true`
and every field selected by the event query to appear in `availableFields` for
the observability token. Its requester-specific `maxPageSize` must support the
50-row bound, `maxNumberOfFields` must support all seven selections, and both
`maxDuration` and `notOlderThan` must cover the exercise's own one-hour
analytics window at 3600 seconds or more, so a requester that cannot serve the
evidence window fails before any mutation rather than at the evidence stage.
Only after both preflights pass does the step record
`cleanup_required=true`, enter the queue boundary, require empty exact
source/DLQ peeks, push one UUID-marked malformed envelope, observe retry
exhaustion in the DLQ, and keep that exact message present while it correlates
one delivered Email Sending event. The
retained `dlq.attempts` value is the DLQ-local consumer counter and can be zero
before any DLQ consumer delivery. Retry exhaustion is proved by the verified
source consumer retry limit and DLQ binding, empty exact preflight, source-only
publish, and exact marker arrival in the bound DLQ; the DLQ-local counter is not
used as the source retry count. The
service-only database verifier hashes the provider-owned message identifier
internally and requires one delivered `dlq_nonempty` row for the exact release.
The Email Sending request follows Cloudflare's documented individual-event
query shape and bounds the provider result by zone, exercise timestamps, and a
50-row limit. The collector then accepts only `status = delivered` and
`isLastEvent = 1` locally, and fails closed if the page reaches the limit so an
unobserved matching event can never be inferred from a truncated result.
The identifier is an opaque, visible-ASCII provider value of at most 512 bytes;
it is not a caller-authored RFC `Message-ID`. The verifier sends
`notBefore = exercise.startedAt` and accepts only a row whose claim and delivery
both occurred at or after that boundary. The internal UUID receipt remains
separately hashed and private. Provider response bodies are capped while they
stream, time out deterministically, and fail closed on invalid UTF-8.

Migration `20260910030000_ac209_operational_alert_verification.sql` is the
expand phase: it accepts the deployed five-field completion body while adding
the optional provider identifier. Deploy the Worker that supplies
`providerMessageId`, verify it, and only then deploy a separate forward-only
migration that requires the sixth field. Applying both phases before the Worker
would break in-flight or still-running old-version completions.

The 75-minute exercise and its `always()` safety step purge only peek refs whose
body exactly matches the pre-generated marker. Cleanup runs only after the
exact-version configuration collector succeeds and the exercise step records
that it is about to enter the queue boundary. Eligibility or Email Sending
capability failure therefore performs no queue cleanup because no queue access
began. Both cleanup paths reject
ambiguous/full peeks and never invoke queue-wide purge. A hard-cancelled run is
recovered by rerunning that same GitHub Actions run, which derives the same
opaque marker. If its first rerun finds and removes a delayed marker during
fail-closed preflight, rerun the same run again to start from verified-empty
queues. Standalone cleanup performs a final source/DLQ peek after the elapsed
poll bound is reached, so normal provider latency cannot prevent a verified
already-absent result. A failed exercise reports
`email_not_observed` when no unique delivered Email Sending event was found, or
`email_invalid_configuration` when the bounded analytics input was invalid.
Provider failures are split into closed, non-secret categories:
`email_provider_permission_denied` for an HTTP authorization response,
`email_provider_resource_unavailable` for an empty exact-zone result, disabled
dataset, or required event field unavailable to the requester, and
`email_provider_graphql_error` for a well-formed GraphQL error envelope whose
free-text details are not interpreted; `email_provider_request_failed` for
another request or non-success response; `email_provider_result_truncated` when
the bounded time-window page reaches its hard limit; and
`email_provider_response_invalid` when the response is unreadable, malformed,
oversized, or rejected by the response schema. The diagnostic never includes a
provider message, path, extension, body, address, or token. `email_query_failed`
is reserved for an unexpected internal exception. The analytics request uses
the provider-documented zone/time filters, while the collector requires
`status = delivered` and `isLastEvent = 1` before accepting evidence. It reports
`database_not_observed` when that event was found but its exact provider message
identifier was not bound to a delivered database row. On success, retain only
`ac209-exercise/configuration.json` and `ac209-exercise/exercise.json` for 30
days. The latter contains hashed addresses/queue identities plus the exact
provider message identifier, and states `pending_manual_verification`; it is
provider/database proof, not Gmail acceptance.

Finally inspect the real Gmail receipt. Confirm the exact recipient, subject
`[WeJammin] dlq_nonempty`, provider message identifier, delivery time, and
redacted body fields for the same release, then record the bounded manual
receipt and reviewer attestation. Do not close AC209 from the Cloudflare
`delivered` status alone.

The same protected diagnostic dispatch runs one corroboration probe beside the
per-event query. When the per-event window returns zero rows, the operator
cannot tell an empty zone from a missing identity, so
`probe-production-ac209-sending-groups.ts` reports the provider's own `count`
per `datetimeHour` x `status` group for the same operator-supplied UTC window,
using Cloudflare's documented hourly `emailSendingAdaptiveGroups` shape. The
hourly `Time` filters are used because the day-level `Date` forms would
collapse a sub-hour exercise window into one day. Only the aggregated `count`
and the `datetimeHour`/`status` dimensions are selected, so no address,
subject, provider message identifier, or sending domain is read or retained, and
the provider's `status` label is published only as a one-way digest. A page
that reaches the row bound fails closed as `provider_result_truncated` instead
of publishing a partial total, and the artifact pins `diagnosticOnly: true`,
`pageComplete: true`, the adaptive-sampling caveat, and
`observation: 'provider_reported_grouped_totals'`. This probe is
corroboration only: a grouped total carries no identity, so it can neither
replace the unique per-event AC209 acceptance predicate nor close AC209.

The group counts are scoped to whole UTC hour buckets, and the artifact says so
rather than leaving it to inference. A bucket labelled `20:00` covers the whole
20:00-21:00 hour, and the provider's hour filter compares bucket labels, so the
probe asks for exactly the buckets that overlap the operator's window: an
unaligned request would exclude the very bucket that holds the activity and
report a false zero, while asking for an aligned end's own hour would add an
hour the operator never requested. The report records both the requested and the
queried window, plus `granularity: 'utc_hour_bucket'` and `hourRounded`; when
`hourRounded` is true the counts cover whole hours and may include activity just
outside the requested span. The window is capped at 7 days, because the dataset
returns one row per hour and status and 720 hourly buckets cannot fit one page.
Read a group count as corroboration of magnitude for an hour-scoped window -
never as an exact count for the arbitrary sub-hour window the per-event query
used, which remains the only exact-window diagnostic.

A Cloudflare support case is open for the underlying question this probe
corroborates: the Email Sending activity is missing for the development/staging
validation despite a delivered control. Case `02343626` was still `New` with
no provider reply as of 2026-09-25 19:29Z
(https://www.support.cloudflare.com/s/case/500Nv00000jYwsWIAS/email-sending-activity-is-missing-for-our-developmentstaging-validation-despite-a-delivered-control).
That case is the operator-approved channel and holds only redacted zone
identifiers and zero-row counts. Do not post further provider telemetry to it
without explicit approval, and do not treat its contents as acceptance
evidence.

Manual accessibility reports record stable opaque operator IDs rather than
names or email addresses. They use strict schema version
`ac266-manual-a11y-v1`, bind the exact source SHA, deployment, origin, and
`/app/cms-content-modeling` path, and attest that the authenticated, authorized
CMS workbench was tested rather than the sign-in or access-denied boundary.
Each report records the matching OS, browser, and screen-reader product-family
versions, UTC start/completion times, `passed` outcome, and every canonical
check exactly once. Check observations are bounded structured values rather
than free-text notes. A Linux screen reader or Chromium run cannot substitute
for the two locked platform pairs.

## Collect AC266 manual accessibility evidence

Run one real macOS/Safari/VoiceOver session and one real
Windows/Firefox/NVDA session against the same successful hosted staging
candidate. Complete all 11 canonical checks in each report. The structured
observations must cover keyboard order, focus visibility and restoration,
pointer/keyboard equivalence, error association, screen-reader labels and
descriptions, heading navigation and the sanitized announced-status identity,
semantic landmarks/live regions, reflow and text spacing, zoom, contrast, and
all eligible target sizes. Target-size evidence uses unique opaque target IDs,
per-target CSS-pixel dimensions and any applicable exception, plus an explicit
attestation that every eligible target was measured. Do not include content,
names, email addresses, account identifiers, screenshots, recordings, or
free-text notes.

Run the helper only on a trusted Linux operator workstation, using a local
filesystem where POSIX mode bits and the ACL mask authoritatively constrain
access. The helper rejects macOS and Windows because their ACL models are not
proven safe by Node's owner/group mode checks. Securely transfer the completed
macOS and Windows reports to that workstation without changing their bytes.
Create the two candidate-bound draft files in a new private directory outside
the repository. The drafts contain the exact 11 check identifiers but are
intentionally incomplete and fail the report schema until a human tester
records every required observation:

```sh
pnpm ac266:reports -- template \
  --source-revision <40-character-staging-source-sha> \
  --deployment-id <staging-deployment-id> \
  --web-origin <pathless-staging-https-origin> \
  --output-dir <absolute-private-draft-directory>
```

After both real platform sessions are complete, validate and encode the exact
report bytes into a second new private directory. The command rejects schema,
platform, candidate, UTF-8, duplicate-key, size, symlink, permission, and
overwrite failures and prints only filenames, byte counts, SHA-256 digests, and
the public candidate identity:

```sh
pnpm ac266:reports -- prepare \
  --voiceover-report <absolute-private-voiceover-report> \
  --nvda-report <absolute-private-nvda-report> \
  --source-revision <40-character-staging-source-sha> \
  --deployment-id <staging-deployment-id> \
  --web-origin <pathless-staging-https-origin> \
  --output-dir <absolute-private-secret-file-directory>
```

Hash the exact UTF-8 bytes of each completed JSON report with SHA-256. Store
their base64 encodings as the protected `ac266-manual-evidence` environment
secrets `AC266_VOICEOVER_REPORT_BASE64` and
`AC266_NVDA_REPORT_BASE64`; set `STAGING_WEB_ORIGIN` to the exact hosted origin.
The environment is limited to `main` and requires its configured reviewer. A
single-account reviewer configuration permits owner self-approval, so it must
not be described as independent review.

Dispatch `intake-ac266-manual-accessibility-reports.yml` from `main` with the
exact lowercase `voiceover_report_sha256` and `nvda_report_sha256` values. The
protected job materializes the secret bytes only in a run-ID/run-attempt-specific
directory below `runner.temp`, strictly parses the reports, verifies the two
digests, and removes the private directory in both the implementation and an
`always()` cleanup step. Its 30-day `ac266-manual-accessibility-intake`
artifact contains only the sanitized intake manifest. Raw reports are never
uploaded as artifacts.

Then dispatch `collect-ac266-manual-accessibility.yml` from `main` with the
exact `staging_run_id`, 40-character `source_sha`, GitHub
`staging_deployment_id`, and successful `manual_report_run_id`. The protected
collector downloads the named staging candidate and sanitized intake manifest,
re-materializes the same secret bytes, and requires their digests to match the
approved intake. It binds both source reports to the repository, workflow,
source SHA, staging run ID and attempt, deployment, origin, and candidate
artifact. It also verifies that the selected staging deployment was successful
before testing and remained the effective hosted release through each report's
completion. Report start must be at or after deployment; completion must be
after start and no later than the trusted intake-run start.

The collector removes the private report directory before uploading the 30-day
`ac266-manual-accessibility-evidence` artifact, which contains only the
sanitized verification manifest and report digests. Keep the two report secrets
until the protected combined-sidecar finalizer has re-materialized, strictly
parsed, and verified the exact report bytes in its private report root; rotate
or remove them only after that step completes. A digest/status manifest alone
does not substitute for the structured manual observations.

Passing either dedicated workflow proves intake and provenance infrastructure
only. The current combined release verifier does not automatically consume the
sanitized AC266 manifest: its protected assembly step must supply the original
strict report bytes privately, run the four-gate verifier, and remove them
before artifact upload. AC266 is not production-bound by policy, but it is
still open and has no proven standalone acceptance path: its protected staging
manual verifier and automated-axe verifier exist separately, and no AC266-only
consumer binds both yet. AC266 therefore closes only once the hosted-scope
acceptance route binds those two components. That staging-scope acceptance is
distinct from the combined release sidecar, which remains unchanged and still
requires all four evidence streams, including the production AC209 and AC211
evidence.

DEC-104's additive hosted-only Zod contract is now defined in
`operational-release-evidence-hosted-scope.ts`: exactly `artifact`,
`hostedE2e`, `accessibility`, and `verifiedAt`, with an expected identity that
omits only the two production-deployment fields. It enforces the locked role,
scenario, manual-check, candidate-identity, and chronology constraints. This
contract is not an acceptance route by itself; do not consume a status/digest
manifest as proof without authenticating and verifying the retained report
bytes through the hosted report, axe, and manual verifiers.

## Collect AC211 evidence

Wait until a UTC day has ended and that entire day follows the selected
production deployment. Dispatch `collect-production-ac211.yml` from `main` with
the complete `utc_day`, full lowercase `source_revision`, GitHub
`production_deployment_id`, and `confirm_collection: true`. Its unprotected
preflight reads GitHub deployment metadata and statuses; only a verified source,
successful production status, and eligible day enter the protected `production`
job.

The protected job requires `CLOUDFLARE_OBSERVABILITY_API_TOKEN` plus the
non-secret `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_PLATFORM_QUEUE_ID`
environment variables. It reads Workers Observability events for the exact
production release and UTC window, queries Queue Analytics `ReadMessage`
attempts and `DeleteMessage` rows whose outcome is `dlq`, and retains only:

- `slo/dataset.json`
- `slo/measurement.json`
- `slo/ac211-slo.json`

The collector fails closed on incomplete pagination, unexpected event identity,
fewer than 200 command/RPC/acceptance samples, missing queue first-attempt data,
incoherent queue counts, threshold equality or failure, and any report-integrity
mismatch. It publishes the three files atomically and uploads them for 30 days
only after successful collection. Raw provider payloads are never retained.

Queue Analytics returns Cloudflare's adaptive aggregate counts. The report
preserves that provider provenance and does not claim a lossless raw queue-event
ledger. Low natural traffic is a real failed gate: do not manufacture production
requests merely to reach 200 samples. Re-run promptly after an eligible day
because Workers Observability retention is bounded.

The `outcome` dimension is documented as applicable only to `DeleteMessage`
(https://developers.cloudflare.com/queues/observability/metrics/), so a DLQ
message is only ever a `DeleteMessage` row whose outcome is exactly `dlq`.
Protected runs return read and write rows with a populated `outcome` anyway;
that value is treated as inapplicable, accepted when it is absent, null, or a
bounded string, and never counted toward `dlqMessages`. A non-string value, a
string past 64 characters, or a `dlq` marker on a non-delete row fails
collection closed on `outcome_shape` rather than silently under- or
over-counting DLQ messages.

## Assemble the sidecar

Create the JSON only inside the protected workflow workspace. Its strict shape
is `ContentSchemaRegistryOperationalReleaseEvidenceSchema` in
`packages/contracts/src/content-schema-registry/operational-release-evidence.ts`.
Unknown fields fail. Raw provider payloads, request bodies, cookies, tokens,
authorization headers, email addresses, content values, and capability graphs
do not belong in the sidecar.

Every retained-file digest in the release sidecar is paired with a safe path
relative to one retained-report root.
The verifier streams that fixed tree within entry and depth budgets derived
from the declared report paths, resolves each path inside the root, forbids
symlink report entries and escapes, rejects special files before a nonblocking
open, pins each unique regular file's identity and size to that descriptor,
reads no more than 10 MiB plus a growth sentinel, recomputes every SHA-256 digest
from the same bytes it parses, and rejects every unreferenced file or directory.
`hosted/e2e.json` must satisfy the strict redacted
`ContentSchemaRegistryHostedE2eReportSchema` for version
`ac265-hosted-e2e-v3`; it contains only exact release identity, timestamps,
passed role/scenario keys, explicit role assertions, bounded durations,
approved opaque references and digests, verified server-receipt references and
digests, and the redacted cleanup result. Version `ac265-hosted-e2e-v2` is
legacy and cannot satisfy this contract.
The approved Phase 2 role assertions are:

| Roles                                                                   | Required assertion   |
| ----------------------------------------------------------------------- | -------------------- |
| entitled_read, owner_full, staff_case_scoped, admin_step_up             | authorized_access    |
| guardian_mandate, junior_restricted, business_mandate, forbidden_hidden | denied_no_disclosure |
| disabled_prerequisite                                                   | disabled_no_mutation |

Exercise deferred context denial using eligible adult sessions, without creating
minor accounts or invented mandates. Assert no protected disclosure or mutation
on denied contexts. Positive cases require real server capability, ownership,
case scope, and recent step-up as applicable; unavailable authority remains a
blocker. A disabled case must demonstrate disabled controls and no mutation.
All nine cases and all ten scenarios remain mandatory, with actual hosted
IdP/RLS and session teardown evidence. Do not relabel an old result, skip a case,
or use the policy or authenticated mapping to generate claimed passes. They
validate evidence; neither runs a test nor grants authority. The
verifier then confirms shape, exact check coverage,
immutable identity, ordering, strict SLO limits, derived daily DLQ rate,
hosted-origin safety, deployment chronology, trusted-cutoff bounds, and evidence
timing. It does not collect telemetry,
activate a provider, provision identities, attest provider truth independently,
or perform the manual tests. A local pass proves sidecar/report consistency; it
does not by itself satisfy any of the four release criteria.

The local v3 schema and internal cross-verifier are implemented. For AC265,
the verifier hashes exact raw runner-contract, reference, execution-evidence,
and receipt bytes; checks their declared digests; resolves protected evidence
by opaque reference; validates receipt authenticity through the supplied
authenticity verifier; and compares subjects, results, resource bindings, and
complete candidate identity. It compares complete role/resource and
scenario/role maps against the separately authenticated
`ac265-approved-runner-mappings-v1` bytes; only fixed scenario parameters come
from `ac265-hosted-runner-policy-v1`. It validates the outage-lease lifecycle
against the scope from authenticated approved-target bytes. Both protected
source endpoints and authentication key/configuration remain unresolved. The
verifier also enforces caller-supplied `maxRunDurationMs`, trusted cutoff, receipt run-window, and
cleanup-receipt ordering. A hash of `hosted/e2e.json` or a local fixture alone proves none of
the external sessions, resources, signed receipts, or hosted observations.

This remains a local trust-boundary check, not hosted AC265 acceptance. CP-03's
attestation implementation authenticates exact canonical mapping bytes only;
it does not make the local verifier a hosted issuer, source, or acceptance
runner. The
protected session broker, authenticated population/mapping source, authenticated
outage lease/fault-evidence service, evidence-byte service, isolated hosted
workflow, and v3 hosted report producer are still missing. A future protected workflow
must supply the verifier's trusted context from authenticated CI/deployment
outputs and resolve/sign the real staging evidence. Keep the criterion
blocked until a complete protected staging run and accepted v3 report exist.

Treat `approved_scheduled_boundary` as incomplete until the protected-workflow
reviewer confirms that its alert-configuration report contains the approved
change/reference record. The verifier hashes that report but does not interpret
its provider-specific contents; the enum value alone is not approval evidence.

## Protected verification entrypoint

The standalone command is not a successful verification path. Its local JSON
arguments cannot provide the function-valued V3 trust inputs `resolveReceipt`,
`verifyReceiptAuthenticity`, or `resolveEvidence` when execution evidence is
present. The direct CLI therefore fails closed with an error instructing the
caller to use a protected workflow; do not invoke it as an acceptance gate or
expect a success marker.

Only a protected workflow entrypoint may call
`verifyContentSchemaRegistryOperationalReleaseEvidenceFile` with
`hostedV3Verification` constructed from trusted protected context. That context
must supply the exact protected `runnerContractBytes`, independently trusted
identity/digests, authenticated approved-mapping bytes and authenticity
callback, matching mapping fields, time bounds, and the receipt/evidence
resolvers and authenticity verifier. The workflow may emit
`content_schema_registry_release_evidence=passed` only after the V3 retained
report and all four release gates pass. Until that protected entrypoint exists,
no standalone command can produce acceptance success. This combined
production-bound route is the acceptance path for AC209 and AC211; it is not
the acceptance path for AC265 or AC266, whose staging-only and pre-release
evidence must be verified through a hosted-scope route (see the policy section
above and `DEC-105`). Keep AC265 as a mandatory pre-release gate that does not
block Slice 10 implementation and remains blocked until it produces passing
protected evidence and an operator reviews the retained source reports. AC209
and AC211 remain unchecked deferred production-evidence gates, and AC265 and
AC266 remain the separate pre-release production-readiness/release gates; while
deferred none of them can be passed, waived, or simulated.

Any missing, malformed, duplicate, out-of-root, digest-mismatched,
structurally local/synthetic, stale-order, threshold-equal,
threshold-exceeding, or sidecar record declared non-redacted fails closed.
Matching bytes and a `redacted: true` declaration do not prove report truth or
redaction; protected source review must reject forged, synthetic, or sensitive
report contents.

## Security boundary

- Resolve exactly nine role-bound session handles through the protected
  external broker; keep session contents outside repository files, logs, and
  retained artifacts.
- Use a protected ephemeral runner per attempt. Do not share a persistent
  self-hosted worker, browser profile, or session state across runs.
- Disable Playwright traces, screenshots, video, and HAR for authenticated
  hosted runs. The v1 contract does not retain browser session state.
- Keep retained report roots minimal. Unreferenced traces, screenshots, videos,
  storage state, provider payloads, files, and directories fail verification.
- Retain only allowlisted aggregate measurements and opaque report IDs/digests.
- Never enable a paid provider or integration from this runbook.
