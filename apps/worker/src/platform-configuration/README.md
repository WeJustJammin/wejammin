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

CFG-05B-06 (`POST /api/v1/admin/identity/mfa-factor-resets`, DEC-111 recovery) is also active: `admin-mfa-reset-route.ts` admits the named `admin.identity.mfa_reset` capability, requires a fresh step-up (401 `STEP_UP_REQUIRED`), charges 5 per hour per user and 10 per hour per party (`admin-mfa-reset-rate.ts`), and refuses self-targets with 422. `admin-mfa-reset-port.ts` reserves the reset through the `admin_mfa_factor_reset` RPC, removes each provider factor through the operator-only adapter in `admin-mfa-reset-provider.ts` (service credential only, no retry after send, shared breaker), then records outcomes through `admin_mfa_factor_reset_settle`. The port is optional on `AdminWorkspaceDependencies` and `PlatformConfigurationDependencies`; an absent port fails closed with 503.

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
