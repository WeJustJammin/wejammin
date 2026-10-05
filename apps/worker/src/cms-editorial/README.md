# CMS editorial Worker routes

## Contents

`routes.ts` registers the protected CMS-03B-01 revision command,
`conflict-routes.ts` the CMS-03B-02 resolver, `create-routes.ts` the
CMS-03B-10 initial-entry create, `history-routes.ts` the CMS-03B-03 safe
revision-history read, `restore-routes.ts` the CMS-03B-04 new-draft restore,
and `detail-routes.ts` the CMS-03B-11 draft-detail read. The
admission helpers enforce bounded JSON, strong validators, browser origin and
CSRF rules for mutations, capability checks, dual rate buckets, dependency
deadlines, and canonical responses. `route-execution.ts` contains the rate and
redacted telemetry seams; `types.ts` defines the injected session, rate, and
persistence ports. Co-located tests cover those boundaries.

## Ownership

This directory owns HTTP admission and response policy only. The production
adapter in `apps/worker/src/cms-editorial-production*.ts` owns authentication,
rate-limit transport, and service-role RPC calls. The database owns durable
idempotency, entry assignment, immutable revisions, and conflict persistence.
An in-isolate replay cache must never bypass those database checks.

## Extension

Add each new BE03b operation by first extending the strict contracts and RED
route tests, then injecting a named port and registering the route here. Keep
new operations fail-closed until their production adapter, RPC, and policy
source are available. CMS-03B-10 create has its protected Worker route and
production RPC adapter, but its human form remains disabled because no served
source supplies the required workflow-policy evidence and the private policy
source is unconfigured.
CMS-03B-03 history now binds its named production RPC port to the signed
service-role wrapper. Without an owner-controlled, per-environment Vault key,
that RPC returns a typed 503 and no history; the local fixed test key is not an
operational secret. The private database reader remains unsigned internally;
only its service-role API wrapper signs outward cursors. Hosted composition and
key rotation are not yet verified. Its read route rejects body/media claims
before session lookup and reports the locked 400 field violations for malformed
cursor, limit, comparison ID, and locale; signed context mismatches remain
distinct private-RPC conflicts. CMS-03B-11 draft
detail now has a named production RPC adapter. Its private read verifies active
schema fields and currently resolves authorized content-relation targets;
unsupported or opaque non-omit projections still fail closed rather than
returning partially verified values. This local wiring is not hosted acceptance.
CMS-03B-04 restore is registered with a missing production port until the
private RPC proves source readability and the ordered migration chain; the
POST returns a typed 503 without creating a revision.
CMS-03B-02 has a protected route and production RPC adapter, but the missing
real editorial-policy source still makes database resolution fail closed.

## Conventions

Only allowlisted browser origins receive CORS headers. Never trust caller
authority metadata, echo SQL errors, or include entry/field values in
telemetry. Return `Cache-Control: no-store` for protected editorial responses.
Keep source and test files within the project 400-line limit.

## Related links

See the locked BE03b editorial specification, the CMS editorial contracts
README, and `apps/web/src/server/README.md` for the browser proxy boundary.
