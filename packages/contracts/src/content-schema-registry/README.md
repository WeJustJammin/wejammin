# Content schema registry contracts

## Contents

Strict request, response, event, and release-evidence schemas for the CMS
content schema registry and their Slice 09 contract tests.

The operational release-evidence sidecar is structural and fail-closed. It
binds production alerts/SLOs, hosted Auth/RLS/IdP E2E, and both manual screen-
reader platform reports to one immutable artifact without storing raw provider
payloads, credentials, tokens, or PII. Each digest has a traversal-safe relative
report path; the workflow verifier binds those references to retained files.

The retained hosted-report gate accepts `ac265-hosted-e2e-v3` only;
`ac265-hosted-e2e-v2` remains a compatibility schema and cannot satisfy the
gate. V3 uses the role assertion policy in
`operational-release-evidence-hosted-role.ts` to distinguish authorized access,
denial without disclosure, and disabled controls without mutation. The
independently versioned runner policy pins only fixed scenario parameters;
run/candidate-bound role-resource references and scenario-role assignments
must come from authenticated `ac265-approved-runner-mappings-v1` bytes. Its
strict schema requires complete keys and read-only parsed maps. Deferred Phase
2 guardian/junior/business-mandate contexts require denial; these schemas and
policies never grant runtime authority or supply hosted proof.

`operational-release-evidence-hosted-outage-lease-control.ts` defines the
strict CP-01 service boundary for acquiring, consuming, and releasing a
staging-only one-request lease. It accepts opaque references only and returns
redacted references, digests, policy, and server timestamps. The contract does
not approve a target, issue a signed receipt, expose a public route, or prove a
hosted outage run.

`operational-release-evidence-hosted-approved-registry-control.ts` defines the
strict CP-02 contract version `ac265-hosted-approved-registry-control-v1` for
registering safe-resource references and complete runner mappings, plus reading
an authorization-bound redacted mapping envelope. The private database
foundation derives candidate/run/identity/deployment/project scope, enforces
staging-only strict references and idempotency, and stores no raw resource
contents, locators, credentials, or tokens. The contract and local registry do
not authenticate mapping provenance, verify underlying resource safety, expose a
route, issue receipts, or prove hosted acceptance.

`operational-release-evidence-hosted-approved-runner-mapping-attestation.ts`
defines the strict CP-03 V1 attestation envelope. It binds the UUID-v4 mapping
ID, run ID, exact lowercase canonical mapping SHA-256, protected key ID, Ed25519
signature, domain separator, and a positive maximum five-minute validity
window. The envelope is only a verification input; it does not create a key,
authenticate a hosted run by itself, or prove AC265 acceptance.

`operational-release-evidence-hosted-approved-outage-target-control.ts`
defines the strict CP-04 read boundary for one authorization-bound, staging-only
outage target. The response retains the canonical target plus its stored digest
while exposing no provider locator, credential, token, or mutation surface.
`operational-release-evidence-hosted-approved-outage-target-attestation.ts`
binds that exact canonical target digest, target reference, run ID, protected
key ID, Ed25519 domain, and bounded validity window. These contracts support a
protected signing workflow; they neither create signing keys nor prove a hosted
outage or AC265 acceptance.

`operational-release-evidence-hosted-session-broker-control.ts` defines the
strict CP-05 run-scoped session broker boundary for authorizing, resolving, and
tearing down exactly nine role-bound handles of one protected hosted run. It
accepts opaque `ac265-session://<role>/<uuid>` handle references and opaque
`ac265-session-material://staging/<uuid>` material references only, requires
every locked role exactly once with distinct handles and material, binds each
handle reference to its embedded role, and keeps every result redacted with a
bounded five-minute window and exactly one resolve per handle. The contract
carries no session state, resolves no material, and proves no hosted
acceptance. A material reference is a caller-declared request-side value: the
authorize boundary validates only its shape, distinctness, and per-role binding,
the database verifies no ownership of it, and no result envelope returns it, so
it is never authority. A material reference is not a bearer credential,
resolving it is decided solely by the approved external broker at dereference
time inside the protected run, and the resolve envelope reports only the bound
handle and its digest. The schemas are sharded so every shard stays inside the
repository schema line cap.

The DEC-108 activation producers CMS-03A-09 through CMS-03A-14 (successor,
dry run, review submission, review decision, review read, review assignment)
are declared in `route-policy-review.ts` (types) and `routes-review.ts`
(policies), alongside the 03A-01 through 03A-08 policies. Each policy carries a
`stepUp` flag; missing or stale MFA on a `stepUp: 'required'` route is 401
`STEP_UP_REQUIRED` with the details of `step-up-required.ts`
(`{ recoveryAction: 'step_up', allowedMethods }`). Their request and resource
schemas live in `requests-human.ts` and `resources-workflow.ts`; the safe
`activationPreparation` projection reuses the BE00 job states and may carry the
`templateCompatibility` projection from `../cms-composition/`.
`openapi-tuple.ts` pins fixed-length tuples (the read/decide assignment actions)
to `prefixItems` with equal `minItems`/`maxItems` in generated OpenAPI. Contract
tests for these live in `routes-review.test.ts`,
`requests-review.coverage.test.ts`, `resources-workflow.coverage.test.ts`, and
`openapi-tuple.test.ts`; `review-fixtures.test-support.ts` holds their shared
valid fixtures.

## Ownership

These schemas define the cross-surface boundary. They do not grant authority,
persist state, or expose private evidence; those decisions belong to the worker
and database layers.

## Extension rules

Add fields deliberately with strict validation and update the matching contract
and traceability tests. Preserve stable error codes and public/private
projection boundaries.

## Conventions

Use the existing content-schema-registry naming and export schemas through the
package contract entrypoints only.

## Related links

- `.memory/wiki/specs/be/03a-content-schema-registry.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
