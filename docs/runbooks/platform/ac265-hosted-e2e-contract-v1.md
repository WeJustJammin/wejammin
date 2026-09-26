# AC265 hosted E2E runner contract v1

**Contract:** `ac265-hosted-runner-v1`  
**Acceptance report:** `ac265-hosted-e2e-v3`  
**Environment:** staging only

This contract defines the inputs, evidence, controls, isolation, and teardown
required before an AC265 hosted runner may produce an acceptance report. It
does not itself prove AC265, authorize identity or grant changes, or authorize
production testing. The runner and report producer must remain fail-closed
until they implement every requirement below.

This is a local trust-boundary contract only. Local schema, verifier, or test
success does not establish a protected hosted runner, session broker, evidence
issuer, staging control plane, or AC265 acceptance. Hosted acceptance remains
open until a protected staging run produces a complete v3 report and the
existing release-evidence verifier accepts it.

## CP-04c local attestation/resolver foundation (not hosted acceptance)

The local/private CP-04c foundation authenticates exact raw artifact bytes with a
strict, domain-separated Ed25519 attestation. Its branded resolver requires an
independent `expectedSubjectSha256` and binds the exact artifact reference,
artifact kind, run ID, candidate identity digest, and runner-contract digest.
It enforces exact reference/kind membership, snapshots the source set, and caps
that set at 256 sources. Raw artifacts and attestation envelopes are each capped
at 64 KiB; public-key PEM input is capped at 8192 characters.

This foundation does not establish the upstream authenticated
manifest/registry/run authority or the external replay ledger. No approved live
target, signing key, issuer, artifact store, broker, hosted report, server
receipt, or browser matrix exists. These local contracts and tests are not
hosted acceptance evidence; AC265 remains open as a mandatory pre-release gate that does not block Slice 10 implementation.

CP-03 adds a promoted signed mapping-attestation application boundary for the
exact `ac265-approved-runner-mappings-v1` bytes. PR #85 at exact main SHA
`a94ffbca3d41da703218dff12ee7527f31c23a34` passed exact-main CI
`35592046696`; staging workflow `35592722418` succeeded after one failed-job
retry for the immediate Cloudflare provider-evidence query, with no provider
configuration change, and deployment `6567092259` succeeded at
`https://staging.wejamm.in`. The code promotion does not create live
signing-key configuration, registry rows, retained attestation artifact,
attestation workflow run, protected hosted run, independently authenticated
receipt, or AC265 acceptance, so it does not alter the hosted acceptance gate.

The retained release gate is V3-only. It requires the exact protected runner
contract bytes and a separately trusted V3 verification context; a V2 report or
the legacy compatibility validator cannot satisfy or downgrade this gate.

## Immutable candidate identity

Resolve the candidate from protected CI and staging deployment outputs. Bind
every session reference, resource reference, server receipt, and report to the
same identity. The reporter must compare these values exactly; a mutable branch,
tag, `latest` label, manually entered URL, or “current staging” lookup is not an
identity.

| Identity field    | Required value                                                        |
| ----------------- | --------------------------------------------------------------------- |
| CI run            | Exact protected workflow run ID and attempt that built the candidate  |
| Staging run       | Exact staging workflow run ID and attempt that deployed the candidate |
| Deployment        | Immutable staging deployment ID and provider environment              |
| Source            | Full source commit SHA used by both the build and deployment          |
| Build             | Immutable build ID and build-manifest digest                          |
| Artifact          | SHA-256 digest of the exact deployed artifact                         |
| Web origin        | Exact public, pathless HTTPS staging origin                           |
| API origin        | Exact public, pathless HTTPS staging origin                           |
| Hosting project   | Exact hosting account and staging project identifiers                 |
| Auth/data project | Exact Supabase staging project reference                              |
| Migration         | Exact applied migration version and content digest                    |

Read identity from signed or otherwise protected workflow/deployment outputs.
At run start, verify that the deployed web and API identify the same source,
build, artifact, hosting project, Supabase project, and migration as the
candidate. Recheck those values when collecting receipts and before report
publication. Reject redirects or receipts that bind to another origin,
deployment, project, source, build, artifact, or migration. No production
origin, project, or deployment is an allowed target.

## Trusted run window

The verifier receives `maxRunDurationMs` as a positive safe integer from
trusted caller policy. It must not derive or enlarge this bound from the
runner contract, report, or scenario parameters. The independently trusted
`trustedCutoffAt` is captured from protected workflow state after evidence
assembly and before verification. Require the report's ordered
`startedAt`/`completedAt` window to fit within `maxRunDurationMs` and require
both timestamps to be at or before the trusted cutoff. Every authenticated
server receipt's `issuedAt` must be inside that report window and at or before
the cutoff. Each role and scenario `durationMs` must also be no greater than
`completedAt - startedAt`; a per-result duration cannot extend beyond the
report window. Missing or invalid trusted bounds fail closed.

The trusted-key list, `trustedCutoffAt`, and `maxRunDurationMs` are trusted
release-policy context preconditions. A future protected orchestration
constructor must source all three from authenticated release/deployment policy
context; they must not be supplied by an untrusted caller. No current
untrusted caller exists, and this local contract does not establish that
protected constructor.

## Run manifest and external references

The protected run manifest contains the contract version, immutable candidate
identity, exactly one session reference for each locked role, the approved
pre-existing resource references, the bounded control policy, and the run
correlation ID. The manifest contains references only; it never contains
session state, credentials, or resource contents.

Session references use this form, with the role component matching the role
matrix exactly:

```text
ac265-session://<role>/<uuid>
```

There must be nine distinct references. Resolve them only through the
approved external secret/session broker inside the protected run. A reference
is not a bearer credential and must not, by itself, grant access to the
referenced session. The broker authorizes resolution only for this run and
runner identity. Do not put resolved cookies, access or refresh tokens, OAuth
codes, or Playwright storage-state bytes in arguments, logs, environment
values, repository files, caches, or retained artifacts. Any temporary
materialization is private to the disposable runner and is destroyed with it.

Resources use this form:

```text
ac265-resource://<kind>/<uuid>
```

`<kind>` is exactly one of `content_schema`, `staff_case`, `organization`, or
`prerequisite`. References resolve only to pre-existing, non-production,
synthetic staging resources approved for this run. They must not contain real
personal data, external side effects, billing effects, or data belonging to a
minor. The runner may not create identities, grants, mandates, organizations,
cases, content schemas, or prerequisites to make a case pass.

For every session, resource, and receipt reference retained in the protected
manifest or report, record the exact opaque reference beside a lowercase
SHA-256 digest of its canonical UTF-8 reference or receipt bytes. The digest
must not be computed from, or used to publish, session-state contents. The
reference alone is not sufficient authority to resolve a protected object.

## Independent role and scenario mappings

The contract and report cannot authorize their own role/resource or
scenario/role mappings. Policy version `ac265-hosted-runner-policy-v1` in
[`infra/workflows/ac265-hosted-runner-policy-v1.ts`](../../../infra/workflows/ac265-hosted-runner-policy-v1.ts)
pins fixed scenario parameters only; it does not invent resource kinds or
scenario/role pairs. V3 verification requires exact
`ac265-approved-runner-mappings-v1` bytes from an independently protected
source. The strict, duplicate-member-rejecting schema binds `mappingId`,
`approvedAt`, `runId`, candidate `identity`, the complete
`roleResourceBindings` reference arrays, and the complete
`scenarioRoleBindings` map. V3 verification requires those canonical bytes plus
the strict domain-separated Ed25519 attestation and independently trusted key
registry; a caller-provided boolean callback cannot substitute. Trusted context
map fields must match the authenticated bytes, and the contract must match them
exactly. Resource kinds are those of the approved safe-resource references; no
per-role kind map is inferred here.

Require every locked role and scenario key exactly once where the report
requires coverage; reject omitted, extra, duplicated, or altered mapping keys.
The approved `scenarioRoleBindings` source supplies the role set for each
scenario. Never infer that every role participates in every scenario or derive
either mapping from the submitted contract or report. Bind each role receipt to
that role's session-reference digest and resource-reference digests, and each
scenario receipt to its authenticated role bindings and corresponding
session/resource digests. A browser or manifest assertion alone does not prove
the mapping was authorized. CP-02 now provides a promoted staging private
registry foundation for these opaque resource references and mapping envelopes.
Its forced-RLS tables and service-role-only RPCs derive
candidate/run/identity/deployment/project scope, enforce immutable/idempotent
redacted records, and never retain raw resource contents or locators. Its
forward-only migration seeds no registry rows. No live mapping-source endpoint
or trusted authentication key/configuration is currently defined; the registry
therefore does not authenticate mapping provenance or establish hosted approval.

CP-03 now supplies the promoted application attestation verifier and protected-entrypoint
contract for canonical mapping bytes. Its Ed25519 signature and trusted-window
checks authenticate supplied bytes, not a live source or the referenced
resources. The source key, live registry population, retained mapping artifact,
and protected hosted run remain absent; fixtures and generated test keys are not
acceptance evidence.

CP-04a remains the promoted approved outage-target read and attestation
boundary. Its service-role-only `ac265_approved_outage_target_read` RPC reads
CP-01 target rows and returns a redacted canonical projection plus the stored
target digest. A distinct, domain-separated Ed25519 envelope authenticates the
exact `ac265-approved-outage-target-v1` bytes, target reference, run ID, digest,
key ID, and validity window. The protected manual main/staging entrypoint and
workflow require that signed target attestation; the verifier and policy do
not accept a caller-provided authenticity callback as a substitute. The
current promoted baseline is PR #88 at implementation main SHA
`52b66272e61331827c59ac1e169868474a2c09c8`, exact-main CI `35612415141`,
staging workflow `35613284966`, and deployment `6570861931`. Candidate artifact
`10645302055` has digest
`12f05e8371586996dc413b85b75167934045f342091defff5197435b8b707782`. Live
target key/configuration, seeded target or registry rows, retained artifact, or
workflow run remain absent, so CP-04a is not hosted acceptance evidence.

CP-04b is now a promoted approved outage-target registration foundation. PR #88
uses implementation main SHA `52b66272e61331827c59ac1e169868474a2c09c8`.
PR CI replacement `35611484121` passed its application (6m32s), database
(1m55s), and artifact (57s) jobs; exact-main CI `35612415141` passed its
application (6m43s), database (2m00s), and artifact (56s) jobs; staging
workflow `35613284966` passed in 1m28s and published deployment `6570861931`.
The candidate artifact is `10645302055` with digest
`12f05e8371586996dc413b85b75167934045f342091defff5197435b8b707782`.
Promotion carries the strict `ac265-hosted-approved-outage-target-registration-v1`
request, bounded service-role client, and migration. The request accepts only
the criterion, schema version, authorization reference, exact
`ac265-outage-policy://staging/v1` policy reference, and idempotency reference.
The bounded service-role client calls only
`ac265_approved_outage_target_register`, validates the exact Supabase origin
and project reference, bounds and parses the response, rejects redirects, and
collapses transport, body, timeout, and malformed-response failures to one
generic error. Its 15 tests cover status and redirect failures, duplicate keys,
malformed/oversized content lengths and streams, awaited cancellation,
missing/undefined reader chunks, release/read failures, invalid UTF-8, timeout,
and secret non-disclosure. The migration creates private forced-RLS policy and
registration ledgers with immutable mutation triggers and service-role-only
RPC execution. It seeds no policy or registration rows; disposable SQL
fixtures populate them only inside local tests and clean them up.

Registration is fail-closed and server-derived. The policy target validity is
exactly 120 seconds, which reserves a bounded 60-second acquisition window
before CP-01's exact 60-second, one-request lease. The RPC requires the policy
to be active and the authorization window to cover the full 120-second target
validity (`authorized_at <= v_now` and `expires_at >= target_expires_at`),
matches the verified candidate's source revision, deployment, staging hosting
project, and Supabase project identity, and derives the dependency, route,
target reference, timestamps, validity window, project fields, and canonical
target digest on the server. The canonical JSON golden test pins digest
`ecd573c63eff6b11b4ff044a70a8180901948e88a9c1db036f51f4a27e1f3d7e`.
The direct SQL integration proof registers a target and then calls CP-01 lease
acquisition using the returned target reference; it proves `state=acquired`,
`leaseDurationSeconds=60`, and `requestLimit=1`. Future-dated policies and
policy windows shorter than the required 120 seconds return only
`{"status":"conflict"}` and create no target. Replay returns the same
redacted registration only for the same request digest; changed requests,
missing/expired/mismatched authorization or policy, and registration races
return the same generic conflict. The SQL suite contains 35 registration
assertions and the lock-aware concurrency probe contains 2 assertions proving
single-winner behavior with exactly one target and one registration sidecar.
Promotion recorded staging API p95 `32.589357ms` and automated axe digest
`df2522f8512dcea587146f5bce43ad5232b94964d5048825ffdb745286dd772d`; the axe
result is only the automated AC266 component and does not satisfy the deferred
manual platform reports or protected combined verification. The policy table
remains empty, with no live dependency/route policy, target, signing key,
retained artifact, hosted matrix, or independently authenticated receipt; CP-04b
promotion does not close AC265; AC265 remains a mandatory pre-release gate that does not block Slice 10 implementation.

The read-only AC209 verifier `35612514031` passed exact-main preflight,
protection, and workspace checks, then failed closed at the capability query
with `provider_graphql_error`; it made no effects and retained no receipt.

## Versioned scenario parameter policy

Policy v1 pins `viewportWidthsCssPx` to mobile 320, tablet 769, and desktop
1025; it pins the `CMS-03A-06` `GET /api/v1/cms/content-types` rate-limit
target to 120 requests per user per minute and stops after request 121. These
values are compared exactly, in addition to the schema's valid ranges.

The locked sources do not name a safe dependency-outage target. The verifier
therefore cannot complete policy v1 from contract or dispatch data. It requires
raw `ac265-approved-outage-target-v1` bytes from the protected staging fault
control plane plus the CP-04a domain-separated Ed25519 attestation over those
exact bytes. The target must bind the current run, staging hosting project,
Supabase project, and deployment; placeholders, missing input, unsigned input,
or failed authenticity leave the retained gate closed. CP-04a implements only
the local read/attestation boundary, and CP-04b implements only local
server-derived registration: the CP-04b policy table is empty outside
disposable tests, with no live dependency/route policy, source key/configuration,
seeded target, retained target artifact, or protected workflow run currently
existing. The CP-03 mapping-attestation source does not provide this
outage-target source and must not be treated as one.
The policy pins the registered target validity to exactly 120 seconds. This
reserves a bounded 60-second acquisition window before CP-01's exact
60-second, one-request lease; the active policy and authorization must cover
the full target window. The run-scoped lease reference and timestamps remain
bound to the authenticated control-plane receipt and the run window.

## Locked role matrix

Run every role exactly once and require the fixed assertion shown below. The
server, under the authenticated actor's real session and RLS context, must
derive the result. A browser label, manifest claim, fixture, service-role
query, or policy map cannot establish a role pass.

| Role                    | Required assertion     | Required authority condition                                                                                                   |
| ----------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `entitled_read`         | `authorized_access`    | Existing adult actor has the required read capability for the referenced resource.                                             |
| `owner_full`            | `authorized_access`    | Existing adult actor is the actual owner of the referenced organization or content-schema resource.                            |
| `guardian_mandate`      | `denied_no_disclosure` | Adult actor attempts a deferred guardian-context path without an active mandate; no guardian or minor identity is created.     |
| `junior_restricted`     | `denied_no_disclosure` | Adult actor attempts the deferred restricted-context path; no junior/minor account or mandate is created.                      |
| `business_mandate`      | `denied_no_disclosure` | Adult actor attempts a deferred business-context path without an active mandate.                                               |
| `staff_case_scoped`     | `authorized_access`    | Existing adult staff actor has a current, server-verified assignment and case scope for the referenced safe case.              |
| `admin_step_up`         | `authorized_access`    | Existing adult administrator has the required organization-scoped grant and completes current-context step-up during this run. |
| `forbidden_hidden`      | `denied_no_disclosure` | Adult actor requests a referenced resource that is not visible or authorized to that actor.                                    |
| `disabled_prerequisite` | `disabled_no_mutation` | Referenced prerequisite is disabled in staging; the operation remains disabled and changes no state.                           |

Denied cases use eligible adult sessions. They do not represent or create
minors, fabricate mandates, or disclose whether a protected resource exists.
Positive cases prove current server authority, ownership, case assignment, or
step-up as applicable. If a required authority condition is absent or cannot
be independently verified, stop the run; do not repair grants or substitute a
different identity.

For every denied case and `disabled_prerequisite`, capture server-derived
before/after state digests for the referenced safe resource and verify both no
protected disclosure and no mutation. The snapshot is limited to the fields
needed to prove equality and must contain no personal or protected content.

## Locked scenario matrix

Run every scenario exactly once against the same immutable staging candidate.
Each must pass within the duration bounds enforced by the report schema. Local
request interception, mocked APIs, local servers, synthetic success objects,
or client-only status overrides do not satisfy hosted scenarios.

| Scenario                          | Required hosted proof                                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idp_sign_in`                     | Perform a fresh `fresh_google_oauth_through_supabase` transaction in a clean browser context. Traverse the real Google authorization flow, Supabase Auth callback, and application callback; verify the resulting actor and project from server receipts. Do not reuse a saved Supabase session or fabricate an OAuth callback. |
| `server_authoritative_rls`        | Exercise the deployed application/API with the real role sessions. Verify actor, acting context, capability, and database row-level behavior on the server; prove denied reads disclose no protected data and do not mutate state. Never use a service-role client for the assertion.                                           |
| `keyboard_landmarks_live_regions` | Exercise the delivered UI with keyboard-only navigation and assert the contracted landmarks, focus behavior, and live-region announcements in the real browser. Bind the browser observations to the exact server-delivered build receipt.                                                                                      |
| `three_breakpoints`               | Exercise the three viewport widths locked by the applicable FE specification and assert the responsive behavior there. Read the widths from the pinned candidate contract; do not choose them dynamically from the runner display.                                                                                              |
| `zoom_200`                        | Use browser-native 200% zoom and assert the contracted content and controls remain operable without loss or prohibited horizontal overflow. CSS transforms or viewport-only scaling are not equivalent.                                                                                                                         |
| `offline_reconnect`               | Exercise the browser's offline and reconnect transitions, then verify recovery through a real request to the deployed staging origin. The offline transition may be browser-controlled; the recovered server result may not be mocked.                                                                                          |
| `stale_multi_tab`                 | Use two tabs in one run-scoped browser context. Change to another eligible, pre-existing context in one tab; prove the stale tab is rejected or requires reconfirmation before protected access, with no disclosure or mutation. Restore the original context when required.                                                    |
| `auth_expiry`                     | Exercise a real Supabase-issued session at its actual expiry boundary and verify the deployed server's contracted reauthentication or denial behavior. Do not alter the application clock, forge/shorten a token, intercept the request, or treat client-side expiry as proof.                                                  |
| `rate_limit_429`                  | Trigger the deployed server's genuine rate limiter using the dedicated safe staging scope and a fixed request budget derived from the pinned policy. Stop at the first real HTTP 429; do not loop without a bound, change global limits, or synthesize a response.                                                              |
| `dependency_outage`               | Acquire and consume a `staging_one_use_lease` for one named staging-only dependency, one exact project/deployment, and one bounded request. Verify the real deployed application fails according to its contract, then release the lease and verify recovery.                                                                   |

The runner records each role result and each scenario result as separate,
exactly-once coverage sets. It must not infer an untested role/scenario pair or
generate a pass from the coverage matrix. Any mapping of a scenario to a role
must be fixed by the versioned test manifest and bound to the same session
reference and candidate identity.

## Bounded hosted controls

`dependency_outage` and its lease evidence are mandatory in every V3 run. The
runner contract must declare the lease; the report must carry matching outage
lease evidence, an authenticated control-plane receipt, exactly one consume
event, a cleanup release proof, and verified dependency recovery. There is no
skip, omitted-lease, or no-fault alternative that can produce a passing report.

`rate_limit_429` uses the rate limit already enforced by the deployed staging
candidate. Use only the pre-approved staging actor and route scope. The
request-count budget is finite, comes from the immutable candidate policy, and
is capped by protected runner configuration. Send no further request after
the first genuine 429. Do not lower or raise a shared limit, affect another
actor, or exercise production.

`dependency_outage` is the only injected-failure control. The control plane
must issue a `staging_one_use_lease` reference in the form
`ac265-lease://staging/<uuid>` and a signed/authenticated control-plane receipt.
The verifier derives `expectedOutageLeaseScope` only from separately protected
`ac265-approved-outage-target-v1` bytes after authenticating those exact raw
bytes with the CP-04a domain-separated Ed25519 target attestation and trusted
target keys. Do not accept the target, its scope, or an authenticity callback
from workflow dispatch or the runner contract. The derived scope must exactly
match the contract and receipt: `runId`, `hostingProjectId`,
`supabaseProjectRef`, `deploymentId`, `dependencyId`, and route
`{ operationId, method, path }`. No live source endpoint, target key/config, or
approved row is currently defined, so the hosted gate remains closed until one
is approved and implemented.

The CP-01 database foundation now provides private, forced-RLS approved-target
and lease ledgers plus service-role-only acquire, consume, and release RPCs
(`supabase/migrations/20260921010000_ac265_hosted_control_plane.sql`). It
enforces the staging identity, exact 60-second/one-request policy, canonical
lease digest, one active lease per authorization/target binding, exactly-once
consumption, bounded release, and retry-safe conflict behavior. The migration
seeds no approved target and exposes no public Worker route. It is therefore a
local control-plane prerequisite only: the independently authenticated target
source, hosted workflow wiring, signed receipt issuer/resolver, and genuine
provider fault remain mandatory before AC265 acceptance.

The CP-02 approved safe-resource and runner-mapping registry is a separate
promoted staging foundation on exact-main PR #84 SHA
`cea2e5601872975a2f974d13e739ace26da677ff` / deployment `6564785922`
(`20260921020000_ac265_approved_runner_registry.sql`). It
stores only server-derived opaque references, reference/locator digests, and
redacted role/scenario bindings behind forced RLS and service-role-only RPCs.
The migration seeds no registry rows and exposes no public route. It does not
authenticate an external approval source, verify underlying resource contents,
issue receipts, or connect the hosted runner; those boundaries remain required
for AC265 acceptance.

The CP-03 approved runner-mapping attestation is a separate promoted code
foundation
(`ac265-approved-runner-mapping-attestation.ts`; `attest-ac265-approved-runner-mapping.ts`;
`attest-ac265-hosted-runner-mapping.yml`). It canonicalizes exact mapping bytes
and verifies a trusted Ed25519 signature, key/report windows, and run binding,
but has no live key configuration, registry rows, retained artifact, attestation
workflow run, hosted browser matrix, receipt, or AC265 acceptance. It therefore
does not establish hosted acceptance.

CP-03 hardening also verifies UUID-v4 mapping-ID alignment, awaited
response-body cancellation, realpath/symlink-safe execution, an unnamed Linux
`O_TMPFILE` writability preflight, no-follow held descriptors, summaries
constrained beneath `RUNNER_TEMP`, and deletion-free fail-closed handling that
preserves only private runner-local remnants. These are local
implementation checks, not hosted evidence.

CP-04a is a separate promoted target-read/attestation foundation
(`ac265-approved-outage-target-rpc.ts`;
`ac265-approved-outage-target-attestation.ts`;
`attest-ac265-approved-outage-target.ts`;
`attest-ac265-hosted-outage-target.yml`). It reads only CP-01 target rows,
returns a redacted canonical projection with the stored target digest, and
authenticates the exact target bytes with a distinct Ed25519 domain. Its
focused and full local checks pass, but it has no live signing key/configuration,
seeded target or registry rows, retained artifact, protected workflow run,
hosted matrix, or receipt. CP-04a does not establish AC265 acceptance.

CP-04b is the promoted private staging registration foundation
(`operational-release-evidence-hosted-approved-outage-target-registration.ts`;
`ac265-approved-outage-target-registration-rpc.ts`;
`20260921040000_ac265_approved_outage_target_registration.sql`). Its strict
request contains only the criterion, schema version, authorization reference,
exact policy reference, and idempotency reference. The service-role client
calls the exact registration RPC through the exact project origin and applies
bounded, redirect-rejecting, generic-error transport handling. The migration's
private forced-RLS policy and registration ledgers are immutable and
service-role-only; the policy table and registration table are empty in the
foundation, with disposable policy fixtures used only by local SQL tests.
The policy target validity is exactly 120 seconds. The RPC requires the policy
to be active at server time and requires `authorized_at <= v_now` and
`expires_at >= target_expires_at`, reserving a bounded 60-second acquisition
window before CP-01's exact 60-second, one-request lease. It derives the
target, candidate/source/deployment/project identity, dependency, route,
timestamps, and target validity on the server, hashes the canonical target JSON
(golden digest `ecd573c63eff6b11b4ff044a70a8180901948e88a9c1db036f51f4a27e1f3d7e`),
and returns only a redacted registration or the generic conflict sentinel.
The direct registration-to-lease SQL proof acquires CP-01's lease from the
returned target reference and proves `state=acquired`, 60 seconds, and one
request. Future-dated and short-policy windows return generic conflicts; the
35 registration assertions and 2 concurrency assertions also cover replay,
immutable-ledger, missing/expired/future authorization, candidate mismatch,
and lock-aware single-winner behavior. The 15 RPC-client tests cover bounded
transport and reader edge cases. CP-04b does not provide a live
dependency/route policy, target, signing key, retained artifact, hosted matrix,
or receipt and does not establish AC265 acceptance.

The lease reference's lowercase SHA-256 digest is computed from its exact
UTF-8 bytes. Acquisition and expiry are bounded timestamps; the lease must be
acquired during the run, expire after acquisition but no later than its
declared `leaseSeconds` (at most 60 seconds) and the trusted cutoff, and be
consumed within that interval. Require exactly one consume event with the same
reference and digest; the authenticated receipt must bind the exact scope,
one-request limit, and replay rejection. The cleanup release proof must name
the same reference and digest, report `released`, follow consumption, and be
within expiry and cleanup bounds. The control cannot target production or a
shared provider-wide service. If any scope, signature, digest, timestamp,
one-use property, release, or recovery proof is missing or mismatched, do not
report acceptance.

No other scenario may change staging configuration or inject a fault. Auth
expiry must be natural; the Google sign-in must use the live configured IdP and
Supabase Auth; the 429 must come from the deployed rate limiter. A browser
proxy or Playwright route handler may not impersonate any server outcome.

## Server receipts and report

The deployed server/auth/database/control-plane receipt issuers produce
receipts for candidate identity, each role assertion, each scenario, and
cleanup. Receipts must be independently retrievable or verifiable from the
protected staging evidence service and bound to the run ID and complete
immutable identity. The reporter collects and verifies receipts; it cannot
author a receipt, upgrade an outcome, or infer a pass from browser output.

Before `JSON.parse` or schema validation, scan the exact raw V3 report,
runner-contract, and receipt JSON bytes for duplicate object members at every
nested level. Compare decoded member names, so escaped-equivalent spellings
such as `"role"` and `"\u0072ole"` count as duplicates too. Reject a duplicate
before parsing; never rely on JSON's last-member-wins behavior.

Every receipt has an opaque reference and an adjacent SHA-256 digest over its
exact raw receipt bytes. Resolve each reference through the authenticated
evidence service, hash the returned bytes before parsing, compare the digest,
then validate the receipt schema and independently verify the issuer's
signature/authenticity over those bytes. Bind the parsed envelope to the exact
run ID, immutable identity, subject, result, and execution binding. A digest
without trusted resolution and authenticity verification is not proof.

For role, scenario, and session-teardown execution evidence, resolve each
opaque evidence reference to its exact raw bytes, hash those bytes, and compare
the adjacent SHA-256 digest before parsing. Bind each payload to the expected
evidence kind, candidate-identity digest, and role/scenario subject digest;
session-teardown evidence must also bind the matching session-reference
digest. UI evidence remains correlated to an authenticated server receipt
identifying the deployed build. Do not treat a local resolver, fixture, or
hash as a hosted evidence service or issuer.

Publish `ac265-hosted-e2e-v3` only when all of the following are true:

- All nine role keys and all ten scenario keys appear exactly once and pass
  with bounded durations and their fixed assertions. Each result duration fits
  inside the report's `startedAt`/`completedAt` window.
- Every receipt verifies, every reference digest matches, and every receipt
  carries the same immutable candidate identity as the report.
- The Google-through-Supabase flow, RLS checks, and required no-disclosure and
  no-mutation checks have server-derived proof.
- The outage lease is consumed once, released, and has a verified recovery
  receipt.
- Logout uses the fixed `current_session_only` policy, and all nine run
  sessions have distinct teardown evidence; no broader logout or provider
  revocation is allowed.
- The authenticated cleanup receipt is issued at or after
  `cleanup.completedAt`, within the report window and trusted cutoff, and
  confirms teardown completed.
- The report passes the strict redaction and schema checks without unknown
  fields or unreferenced evidence.

The report may contain the exact candidate identity, role/scenario keys,
assertions, outcomes, bounded durations, approved opaque references and their
digests, server-receipt references and digests, and redacted cleanup result.
It must not contain names, email addresses, user IDs, personal data, credentials,
OAuth codes, access/refresh tokens, cookies, headers containing secrets,
storage-state content, screenshots, video, traces, HAR, resource contents, or
unredacted request/response bodies. Reject the entire report if the redactor or
secret scan finds any prohibited material.

## Runner isolation and teardown

Run only from a protected CI job on an isolated, disposable runner dedicated to
this one acceptance attempt. A shared persistent self-hosted runner is
prohibited. Use a fresh browser profile and private temporary directory for
each run; disable cross-run caches, retries, parallel sessions, and persisted
workspaces. Restrict the job to the AC265 staging test entry points and exact
origins. Disable screenshots, video, traces, and HAR capture. Do not print
environment values or resolved session material.

Acquire only the run-scoped outage lease and temporary session material
authorized by the manifest. On every exit path, including assertion failure,
attempt bounded teardown in reverse acquisition order:

1. Release the one-use outage lease and verify the dependency is healthy.
2. Restore any acting context changed by `stale_multi_tab` to its recorded
   eligible starting context.
3. Log out each of the nine run-scoped sessions exactly once using the fixed
   mode `current_session_only`, and capture a session-reference-bound teardown
   result for every role. Do not revoke all sessions, revoke a provider
   connection, disable an account, or sign out other actors.
4. Destroy temporary browser state and external session material; never upload
   it as an artifact.
5. Obtain the authenticated cleanup receipt and verify it against the run ID
   and candidate identity. Its `issuedAt` must be at or after
   `cleanup.completedAt` and within the report window and trusted cutoff.

The referenced safe resources pre-exist and are not deleted by teardown. Any
unexpected resource mutation is a failed run and requires ordinary staging
incident handling; the runner must not erase evidence to make the baseline
match.

## Fail-closed behavior

Do not publish any `ac265-hosted-e2e-v3` report if a role or scenario is
missing, duplicated, failed, skipped, or out of bounds; if identity or receipt
verification fails; if an origin or project differs; if any session, resource,
or control is outside the manifest; if the mandatory outage lease or any
consume, signed-receipt, release, or recovery proof is absent; if duplicate
JSON members are present; if any result duration exceeds the report window; if
a protected disclosure or unexpected mutation occurs; if redaction fails; or
if any cleanup step or cleanup receipt fails. Cleanup remains mandatory after
an assertion failure. A cleanup failure invalidates the whole acceptance
attempt even if all tests passed.

Write the acceptance report only after every assertion, receipt, and cleanup
check has passed. On any failure, exit non-zero and leave the acceptance-report
path absent; never write a partial or success-shaped diagnostic artifact.
Failure diagnostics may identify only a run ID, failed check key, and
redacted error class. They must not contain any prohibited report material.

This document approves a runner contract only. AC265 remains open until the
implemented runner executes against the exact staging candidate, publishes a
valid `ac265-hosted-e2e-v3` report, and passes the existing release-evidence
verifier. A local or synthetic pass, this contract, or staging database setup
alone is not hosted acceptance.
