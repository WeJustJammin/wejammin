# Integration support modules

## Contents

- `ev-ea-editorial-app.ts`: the shared harness of the Slice 10 lane-EA editorial
  evidence tests (`tests/integration/phase-02-slice-10-ev-ea-*.test.ts`). It lists
  the four CMS-03B operations under test and builds the production Hono app
  (`createCmsEditorialApp`) over the production RPC adapter, supplying only the
  PostgREST transport, the verified session and the rate limiter.
- `ev-eb-publication-boundary-support.ts`: applies the Worker body boundary every
  editorial command route shares (`parseJsonBody`) to a contract schema and
  provides the 422 assertions the publication-boundary evidence tests build on.
- `ev-eb-worker-create-support.ts`: the CMS-03B-10 (initial entry create) route
  composition for the lane-EB create evidence tests: the production app with only
  the PostgREST `fetch`, the session and the rate limiter faked, plus the request
  and failure helpers those tests share.

## Ownership

The editorial evidence lanes maintain these modules. They hold no test of their
own beyond the small shared assertions their suites call; every criterion
assertion stays in the `phase-02-slice-10-ev-*.test.ts` files in the parent
directory.

## Extension

Add a module only when two or more integration suites need the same composition
or helper. Compose it from production functions (the production app and adapters)
and replace only the external seams: transport, session and rate limiter. Name it
after the lane and the boundary it serves, keep it under 300 lines, and give it a
header comment that names the criteria and operations it supports.

## Conventions

Use fixed, obviously synthetic identifiers and example hosts (`*.example.test`),
never real secrets or provider payloads, and never a stand-in for production
behavior the suite claims to prove. Return typed values; do not widen to `any`.

## Related links

- `tests/integration/README.md` (the suites that import these modules)
- `tests/postgrest/support/README.md` (the real PostgREST counterparts)
- `apps/worker/src/cms-editorial` (the production routes composed here)
