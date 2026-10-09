# Worker composition

`index.ts` composes versioned routes, middleware, Queue consumers, and scheduled handlers. Transport modules validate contracts and call application use cases; they do not own SQL, business invariants, or provider-shaped canonical data.

Middleware order is correlation, security headers, body and size limits, authentication, acting context, authorization, validation, idempotency, and observability. Public readiness responses remain sanitized.

## Contents

The composition root and its colocated transport tests live here. New
consumers, schedules, and routes should remain small modules with one
responsibility.

`production-worker-runtime-cms.ts` constructs protected schema migration
workers. The legacy factory binds activation; the named preparation factory
binds private `dry_run` purpose without exposing a caller option. Both facades
re-export the same functions. `production-job-effect-dispatcher.ts` selects
only exact internal object-verification aliases or `cms.schema.dry_run`;
provider and lookalike families never select a dependency. These construction
seams do not themselves supply claimed-job resolution or persistent job fences.

## Ownership

This directory owns Worker entry-point composition and transport orchestration;
it does not own domain policy, SQL, provider payloads, or browser UI.

The request boundary is split by responsibility: `request-boundary.ts` is the
stable public barrel; `request-boundary-types.ts` owns shared result/error
types and limits; `request-boundary-support.ts` owns bounded IDs, query values,
issue mapping, and transport helpers; `request-boundary-reads.ts` owns public
and authenticated read parsing; `request-boundary-command.ts` owns protected
JSON command parsing; and `request-boundary-response.ts` owns no-store and
safe error responses. `browser-security.ts` remains the origin/CSRF boundary.

`upload-completion/` owns the thin `POST
/api/v1/upload-intents/:uploadIntentId/complete` transport. It enforces the
bounded JSON request, authentication, rate/deadline limits, conditional
version, and idempotency headers before calling the shared application port.
The default production composition has no provider registry and returns a
sanitized `503` until an explicit server-side adapter is injected; local tests
use fake storage and queue ports. Responses contain only the shared JobStatus
representation and safe transport metadata, never signed URLs or object keys.

## Extension

Add a module beside the composition root when a new transport seam is needed,
then register it from `index.ts` and add a focused test beside the module.
Keep request-boundary modules under 300 lines and route new exports through
`request-boundary.ts`.

## Conventions

Preserve middleware order, import contracts from `@wejammin/contracts`, derive
security context server-side, and keep public health/readiness responses
disclosure-safe. Post-route middleware must set only the security headers it
owns; never round-trip the complete response header set because repeated
`Set-Cookie` fields must remain independent.

`GET /api/v1/ready` is fail-closed. A composition without the explicit,
server-only `checkReadiness` dependency returns a sanitized `503 not_ready`;
only a checker result of `true` (or `{ ready: true }`) can return `200 ready`.
The production entry point intentionally supplies no checker until canonical
recovery evidence and the restore-fence checks have been verified. Supabase
Free has no hosted PITR, so missing, synthetic-only, stale, or failed
integrity/RLS/RPC evidence keeps readiness and protected writes closed. The
route never enables a provider, paid add-on, or pay-as-you-go service.

## Related links

- [Worker boundary](../README.md)
- [Shared contracts](../../../packages/contracts/README.md)
- [Application modules](../../../packages/application/README.md)
