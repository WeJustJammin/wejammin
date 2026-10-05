# Platform configuration worker

## Contents

This directory owns the Hono route composition, production request adapter,
runtime port, response mapping, and structured telemetry for governed settings,
feature flags, and runtime configuration changes.

## Ownership

The worker authenticates the verified actor and acting context, enforces CSRF,
idempotency, version, scope, and deadline boundaries, and maps database outcomes
to disclosure-safe API contracts. PostgreSQL remains authoritative for policy and
state transitions.

Slice 08 ownership: CFG-05B-01 inbox reads, CFG-05B-04 capability-grant
actions, and CFG-05B-05 `read_audit` are active Worker routes. CFG-05B-02
search, CFG-05B-03 bulk operations, and CFG-05B-05 `run_diagnostic` remain
deferred and unmounted; no diagnostic RPC, event, or repair side effect is
forwarded from this surface.

CFG-05B-06 (`POST /api/v1/admin/identity/mfa-factor-resets`, DEC-111 recovery) is also active: `admin-mfa-reset-route.ts` admits the named `admin.identity.mfa_reset` capability, requires a fresh step-up (401 `STEP_UP_REQUIRED`), charges 5 per hour per user and 10 per hour per party (`admin-mfa-reset-rate.ts`), and refuses self-targets with 422. `admin-mfa-reset-port.ts` reserves the reset through the `admin_mfa_factor_reset` RPC, removes each provider factor through the operator-only adapter in `admin-mfa-reset-provider.ts` (service credential only, no retry after send, shared breaker), then records outcomes through `admin_mfa_factor_reset_settle`. The port is optional on `AdminWorkspaceDependencies` and `PlatformConfigurationDependencies`; an absent port fails closed with 503. Every request logs one `admin.mfa-factor.reset` event (reset id on success, actor and target hashes, state, removed-factor count, and a closed `signal`: completed, reconciling, denied, stale_step_up, rate_limited, circuit_open, identity_unavailable, rejected or failed, also emitted as a metric). Step-up shortfalls on every operation here use the shared `stepUpRequiredError()` and the single DEC-111 window (`isConfigurationStepUpFresh` delegates to `isFreshProof`). Production-composition wire tests for CFG-05B-06 live in `phase-02-slice-09-cfg05b06-wire*.test.ts`.

CFG-05B-07 (`GET /api/v1/admin/capability-snapshot`) is the protected, service-binding-only capability projection that is the one capability source every protected web page reads in production (settings registry/effective/rollback affordances, the `inbox`, `capabilities` and `audit` admin tabs, `tab=mfa-reset`); no Worker route emits a capability response header, and the web client ignores and strips any such header. It works because a Cloudflare service binding exposes only `fetch`. `admin-capability-snapshot-route.ts` admits any verified session, takes no input (any query string is 400), charges 120 per minute per actor, and answers `{ capabilities }` containing only the `admin.*` and `settings.*` keys (at most 32) of the same server-derived request context every admin route admits on (`readCapabilityKeys` via `admin_context_capabilities`). It never reads a capability claim from the request and returns no identifier. The web consumer is `apps/web/src/server/platform-configuration-capability-snapshot.ts`; the route is deliberately not a browser route.

Production request context capabilities are read server-side through the
`platform_api.admin_context_capabilities` RPC; malformed or unavailable
responses fail closed, while an explicit trusted resolver remains an override.

## Extension rules

Add a contract and a failing behavioral test before mounting a route. New
operations must reuse the production request boundary, preserve typed error and
telemetry mappings, and call the database through the runtime port rather than
embedding persistence logic in handlers.

## Conventions

Keep route modules bounded, validate every external value, forward only
allowlisted headers, and split evidence suites by behavior when a test file
approaches the repository line limit.

## Related links

The Slice 07 acceptance traceability suite maps these files to the phase plan;
the platform-configuration backend specification defines operation identifiers,
authorization, errors, and observability obligations.
