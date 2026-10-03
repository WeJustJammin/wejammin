# Real-API gate suites

## Contents

`*.apispec.ts` suites that call the disposable local Supabase stack through the same
path the Worker uses (`${SUPABASE_URL}/rest/v1/rpc/<name>` through Kong to PostgREST
v16) with JWTs minted in the test. They exist because pgTAP runs as the database
owner and Worker tests fake PostgREST, so neither can see which identity the database
is actually given. Selected only by `vitest.postgrest.config.ts` (`pnpm db:api-test`),
which `pnpm db:verify` and `infra/verify-database.sh` (CI) run as a blocking step.

| Suite                                 | Proves                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authority-gate.apispec.ts`           | Per role (anon, authenticated, service_role), enumerated from the live catalog: forged `p_request.context` is refused for every cms\_ function, every identity function reads the real token subject, every claims-reading service_role family passes its gate, anon and cross-role denial is total, and step-up reads the real `aal`. |
| `cms-idempotency-mismatch.apispec.ts` | D-IDEM: CMS-03A-10 through the production Hono app and RPC adapter against the real database: a same-key retry replays, a changed body is 409 CONFLICT `{ conflict: IDEMPOTENCY_MISMATCH, recoveryAction: use_new_idempotency_key }`, a different key is judged on its merits.                                                         |
| `cms-field-default-null.apispec.ts`   | AC064: a literal default of explicit JSON null is accepted by CMS-03A-01 and CMS-03A-02 end to end and stored as the JSON value; the missing key stays distinct.                                                                                                                                                                       |
| `cms-rpc-request-shape.apispec.ts`    | Every human CMS operation's production-adapter request (16 operations) satisfies the live function's first `cms_exact_keys(p_request, ...)` gate; found the CMS-03A-02 flat-versus-`field` mismatch.                                                                                                                                   |
| `cms-release-routes.apispec.ts`       | Real Ed25519-signed CMS-03A-05/08 through the Worker: nonce replay is a counted, alertable rejection; human callers are 403; unknown block version is 404.                                                                                                                                                                             |
| `cms-not-found-rows.apispec.ts`       | AC307: absent and hidden source versions are the same concealed 404 end to end.                                                                                                                                                                                                                                                        |
| `worker-round-trip.apispec.ts`        | The Worker's production adapters (migration-worker transport, CMS registry, platform configuration, profile ownership) against the live API with the Worker's apikey-only credential: release-worker gate, migration lease claim, human CMS read, configuration capability read, step-up from Worker context.                          |

`support/cms-app.ts` composes the production CMS Hono app on real fetch (only the session and rate limiter are supplied) and `support/cms-release.ts` is a real signed release worker; `support/stack.ts` reads the API URL and JWT signing secret at runtime (from
`supabase status -o env`, falling back to the running PostgREST container's JWKS) and
mints HS256 tokens; no secret lives in source.

## Running

1. `pnpm db:start` (once; it starts `postgrest` and `kong`) and `pnpm db:reset`.
2. `pnpm db:api-test`.
3. `pnpm db:reset` again: the suites commit auth users, a release principal and the
   operator-bootstrapped CMS owner that the pgTAP suites expect absent. Reruns without a
   reset reuse the recorded owner.

A missing stack fails loudly; nothing is skipped.

## Adding a suite

Name it `*.apispec.ts`, call only through `support/stack.ts` (never set a GUC), build
fixtures with production functions (`createPerson`, `ensureCmsOwner`), and document any
reset requirement in the file header.
