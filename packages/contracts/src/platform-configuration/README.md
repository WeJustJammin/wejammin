# Platform configuration contracts

## Contents

Strict Zod wire contracts for governed settings, effective-value resolution,
change review, activation, rollback, and identifier-only configuration events.

- `admin-workspace.ts` is the request/resource barrel. The focused
  `admin-inbox.ts`, `admin-search.ts`, `admin-bulk.ts`, `admin-capability.ts`,
  `admin-capability-snapshot.ts` (CFG-05B-07),
  and `admin-diagnostic.ts` modules each own one CFG-05B contract family;
  `admin-common.ts` owns shared bounded primitives and grant scope rules.
- `admin-events.ts` owns identifier-only admin capability, bulk, and diagnostic
  event payloads plus their strict event envelope.
- `admin-routes.ts` is the route-policy barrel. `admin-route-policy.ts` owns
  shared metadata and errors; `admin-active-routes.ts` and
  `admin-deferred-routes.ts` keep mount posture explicit; registry and route
  contract metadata live in their focused modules. Only 01, 04, and 05 are
  active, while 02 and 03 remain explicitly deferred.

- `primitives.ts` owns bounded identifiers, JSON, scopes, and intervals.
- `settings.ts` is the public CFG-05A barrel. Focused definition, effective-value,
  and change modules own CFG-05A-01 through CFG-05A-04 request/response schemas.
- `telemetry.ts` is the public union barrel for the strict, redacted
  CFG-05A-01 through CFG-05A-07 observability envelopes. Focused definition,
  change, runtime, and common modules own the schemas; producers outside the
  Slice 07 route set consume the same contracts when their owning slice
  activates them.
- `routes.ts` owns the active route registry and transport policy metadata.
- `events.ts` owns identifier-only invalidation events.

## Ownership

This package owns transport shapes and validation only. Database policy stays in
PostgreSQL, request authorization stays in the worker, and presentation rules
stay in the web application.

## Extension rules

Add strict request, success, error, and telemetry schemas together in a focused
module capped at 150 lines, reusing `admin-common.ts` for shared primitives.
Add active and deferred route policies only in their matching modules; keep
future operation schemas unmounted until their phase boundary is active. Export
new modules through the existing barrel without importing a barrel from a
focused module, preventing cycles.

## Conventions

Use bounded primitives, reject unknown fields, export inferred TypeScript types,
and retain identifier-only events so Realtime invalidates rather than carries
authoritative values.

## Related links

The platform-configuration backend specification supplies the operation matrix;
worker and web evidence suites prove each active schema at its trust boundary.
