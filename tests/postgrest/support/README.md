# Real-API support modules

## Contents

- `stack.ts`: reads the local API URL and JWT signing material at runtime (from
  `supabase status -o env`, falling back to the running PostgREST container's JWKS),
  mints test JWTs and calls `/rest/v1/rpc/<name>` through Kong; no secret lives in
  source.
- `cms-app.ts`: composes the production CMS Hono app on real `fetch`; only the
  session resolver and rate limiter are supplied by the suite.
- `cms-release.ts`: a real Ed25519 release-worker principal that signs CMS-03A-05
  and CMS-03A-08 requests.

- `claim-gate-manifest.ts`: the checked-in list of claim-gated `platform_api`
  functions (name, grant class, and the helper family that resolves the caller).
- `claim-gate-fixtures*.ts`: one VALID request per manifest entry, split by family
  (CMS actor, admin and configuration, identity, profile, workers), plus the exact
  outcome a real caller gets once the gate has passed.
- `claim-gate-success.ts`: the entries where a real person (the CMS owner) gets a
  success through the same gate.
- `claim-gate-check.ts`: the drift check and the behaviour probes (exact outcomes
  for ghost, forged, ungranted and real callers) the claim-gate suites assert.
- `claim-gate-mutants.ts`: the shared-gate mutations, with the entries that must
  fail for each.
- `claim-gate-world.ts`: the committed fixtures the claim-gate suites share.
- `phase-02-slice-11-assert.ts`: strict assertion helpers for the Slice 11
  real-composition suites (`expectSafeError` with the exact closed details and
  MIME boundary, `sameInstant` at nanosecond resolution, the safe evidence-shape
  probes). It re-exports the effect helpers below so existing consumers keep one
  import site.
- `phase-02-slice-11-effect.ts`: the durable-effect snapshot builder/decoder
  (`snapshotDigest`, `decodeSnapshot`) that hashes every row of every effect table
  SQL-side, the SELECT-only idempotency projection used to prove full-row
  sensitivity at an unchanged count, and `expectUnchanged`. Split from the
  assertion module to stay within the 300-line utility limit.

## Ownership

The database owner maintains these modules. Apart from the exact expectations the
claim-gate fixtures state (one per entry), they contain no assertions; suites in the
parent directory own every assertion.

## Extension

Adding a claim-gated `platform_api` function means one manifest entry, one family,
one fixture (a request that passes every check before the identity gate) and, when
a real person can succeed without domain rows, a success control; the manifest suite
fails until all four exist. Add a module only when two or more suites need the same production composition. Build
it from production functions, never from a stand-in, and never set a GUC (claims
travel only inside a minted JWT).

## Conventions and related material

- Related: `tests/postgrest/README.md` (suites and how to run them),
  `supabase/tests/README.md` (pgTAP) and `apps/worker/src/content-schema-registry`
  (the production adapters composed here).
