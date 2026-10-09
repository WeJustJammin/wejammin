# Real-API gate suites

## Contents

`*.apispec.ts` suites that call the disposable local Supabase stack through the same
path the Worker uses (`${SUPABASE_URL}/rest/v1/rpc/<name>` through Kong to PostgREST
v16) with JWTs minted in the test. They exist because pgTAP runs as the database
owner and Worker tests fake PostgREST, so neither can see which identity the database
is actually given. Selected only by `vitest.postgrest.config.ts` (`pnpm db:api-test`),
which `pnpm db:verify` and `infra/verify-database.sh` (CI) run as a blocking step.

| Suite                                  | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authority-gate.apispec.ts`            | Per role (anon, authenticated, service_role), enumerated from the live catalog: forged `p_request.context` is refused for every cms\_ function, every identity function reads the real token subject, the claim-reading families are owned by the manifest suites below, anon and cross-role denial is total, and step-up reads the real `aal`.                                                                                                                                                                                                                                                       |
| `claim-gate-manifest.apispec.ts`       | SEC-1 manifest: the checked-in list of claim-gated `platform_api` functions equals the live catalog exactly (both directions, gate against EXECUTE grants); every entry has an actor family and a valid request; and every listed function is called through the real API with that request: exact UNAUTHENTICATED for ghost and forged subjects, exact permission errors for roles not granted, the function's own outcome (or a success) for a real caller.                                                                                                                                         |
| `claim-gate-mutation.apispec.ts`       | Mutation test: every manifest entry is replaced by a gate-less stub (or, when ungranted, granted to anon) and drift plus its own behaviour probes must name it; each shared gate helper (cfg_actor, identity_auth_user, the release gates, profile_actor, request_jwt_claim) is weakened and exactly the entries that rely on it must fail; every original is restored and re-verified.                                                                                                                                                                                                               |
| `cms-idempotency-mismatch.apispec.ts`  | D-IDEM: CMS-03A-10 through the production Hono app and RPC adapter against the real database: a same-key retry replays, a changed body is 409 CONFLICT `{ conflict: IDEMPOTENCY_MISMATCH, recoveryAction: use_new_idempotency_key }`, a different key is judged on its merits.                                                                                                                                                                                                                                                                                                                        |
| `cms-editorial-composition.apispec.ts` | Slice 10 (CMS-03B-01..14) end to end: browser request -> first-party web proxy -> private binding -> production Worker app -> production RPC adapter -> Kong -> PostgREST -> newest SQL. A CMS-03B-14 projection round-trips into a CMS-03B-10 create; create, append, resolve and restore each commit exactly one revision, audit row and outbox event; an exact-key replay and a lost-response replay add nothing; a stale-base same-field save records one open conflict served by CMS-03B-12 and closed by CMS-03B-02; an unknown field mutates nothing; 401/403/404 are the database's decision. |
| `cms-field-default-null.apispec.ts`    | AC064: a literal default of explicit JSON null is accepted by CMS-03A-01 and CMS-03A-02 end to end and stored as the JSON value; the missing key stays distinct.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `cms-rpc-request-shape.apispec.ts`     | Every human CMS operation's production-adapter request (16 operations) satisfies the live function's first `cms_exact_keys(p_request, ...)` gate; found the CMS-03A-02 flat-versus-`field` mismatch.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `cms-release-routes.apispec.ts`        | Real Ed25519-signed CMS-03A-05/08 through the Worker: nonce replay is a counted, alertable rejection; human callers are 403; unknown block version is 404.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `cms-not-found-rows.apispec.ts`        | AC307: absent and hidden source versions are the same concealed 404 end to end.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `worker-round-trip.apispec.ts`         | The Worker's production adapters (migration-worker transport, CMS registry, platform configuration, profile ownership) against the live API with the Worker's apikey-only credential: release-worker gate, migration lease claim, human CMS read, configuration capability read, step-up from Worker context.                                                                                                                                                                                                                                                                                         |

`support/cms-editorial-stack.ts` composes the whole Slice 10 chain (web proxies in front of the production editorial Worker app) with only the session and rate limiter supplied, and `support/cms-editorial-world.ts` builds the committed owner, grants and an active content type (its activation envelope uses the REAL registry workflow-policy member, so the production policy projection resolves). `support/cms-app.ts` composes the production CMS Hono app on real fetch (only the session and rate limiter are supplied) and `support/cms-release.ts` is a real signed release worker; `support/stack.ts` reads the API URL and JWT signing secret at runtime (from
`supabase status -o env`, falling back to the running PostgREST container's JWKS) and
mints HS256 tokens; no secret lives in source.

## Ownership

The database owner maintains these suites: they prove what PostgREST actually
delivers to the database (identity, role, claims transport and the Worker's
production adapters against the live schema). pgTAP under `supabase/tests` owns
SQL behaviour given a claim; the Worker unit suites own Worker behaviour given a
stubbed RPC. A criterion whose proof depends on the delivered identity cites a
suite from this directory.

## Running

1. `pnpm db:start` (once; it starts `postgrest` and `kong`) and `pnpm db:reset`.
2. `pnpm db:api-test`.
3. `pnpm db:reset` again: the suites commit auth users, a release principal and the
   operator-bootstrapped CMS owner that the pgTAP suites expect absent. Reruns without a
   reset reuse the recorded owner.

A missing stack fails loudly; nothing is skipped.

## Extension

### Slice 11 native preparation (not acceptance)

The native API preparation is split by operation: submit/decision (05/06),
schedule/time/actions and sweep composition/outcomes (07/20), preview/verifier and
publication lineage/preflight (08/09/19), and workflow/detail/queue/assignment
(15–18). Original literal titles remain in their feature files; new scenario
suites use the same `phase-02-slice-11-*.apispec.ts` prefix. Shared assertions hash
the complete fourteen durable-effect groups without exposing raw resources.

Preparation/static checks are not runtime or acceptance receipts. Do not execute
the inherited stale-review fixtures that disable immutable guards in
`support/phase-02-slice-11-read-fixtures.ts` or the original publish suite until
their canonical successor-activation fixture is repaired. The shared type helper
now prepares the genuine03A bind/session/dry-run/worker/review/activation chain,
without fabricated activation rows. Its first real run is RED before dry-run
processing: first-version plan null IDs conflict with the Worker parser in
source; safe runtime diagnostics must confirm the exact early exit. No ordinary
API acceptance follows from this unverified fixture. Archived-entry and standing-grant projections are synthetic controls,
not authorized archival/revoke or real-time-lapse proof. These authority gaps,
the parent cold-read mutation, complete negative matrices and actual concurrency
remain open; no Slice11 criterion is promoted by this preparation.

The queue's explicitly named privileged local test-artifact signer performs a
SELECT-only call to the existing server-side cursor signer. It never exposes
Vault key material, changes grants/keys/clock/rows, or pretends a browser/service
role may call the private signer. Sweep expiry/retry witnesses use actual server
time; their450-second test deadlines require yielding parent execution. Every DB
operation still requires fresh active-CI preflight and the shared lock/main stack.

Name it `*.apispec.ts`, call only through `support/stack.ts` (never set a GUC), build
fixtures with production functions (`createPerson`, `ensureCmsOwner`), and document any
reset requirement in the file header.

## Conventions and related material

- One concern per suite; file header states reset requirements and what it proves.
- Related: `supabase/tests/README.md` (pgTAP suites and the claim helper),
  `supabase/README.md` (local stack), `infra/verify-database.sh` (the CI gate that
  runs `pnpm db:verify`), and `tests/contracts/README.md` (guards that read these
  suites' receipts).
