# Authentication contracts

## Contents

This module defines authentication primitives, strict request and resource schemas, provider metadata, and the authoritative AUTH-API-01 through AUTH-API-21 policy registry.

AUTH-API-16 through AUTH-API-21 (MFA factor list, TOTP enrollment start and
verify, factor removal, step-up challenge and verify) are declared in
`routes.ts`; their strict requests and resources live in `requests-mfa.ts` and
`resources-mfa.ts`. Enrollment start and verify and factor removal carry the
strong MFA-version `If-Match`; only removal carries an `Idempotency-Key`. A
`session_conditional_step_up` route needs a fresh step-up proof only when a
verified factor already exists. The enrollment secret exists only in the
one-time `TotpEnrollmentStart` body, and no resource carries a token or a
provider identifier.

## Ownership

The Identity domain owns the contract vocabulary. Worker, web, OpenAPI, tests, and future clients consume the same runtime schemas.

## Extension rules

Change a contract only through the originating specification workflow. Keep objects strict, enums closed, return paths first-party, times UTC, and provider launch state honest.

## Conventions

Schemas use Zod 4 and stable validation codes. Browser input never supplies authority identifiers or session claims, and success resources exclude tokens and provider secrets.

## Related links

See `apps/worker/src/authentication/`, `apps/web/src/pages/auth/`, and `docs/openapi/openapi.json`.
