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

## Ownership

The database owner maintains these modules. They contain no assertions; suites in
the parent directory own every assertion.

## Extension

Add a module only when two or more suites need the same production composition. Build
it from production functions, never from a stand-in, and never set a GUC (claims
travel only inside a minted JWT).

## Conventions and related material

- Related: `tests/postgrest/README.md` (suites and how to run them),
  `supabase/tests/README.md` (pgTAP) and `apps/worker/src/content-schema-registry`
  (the production adapters composed here).
