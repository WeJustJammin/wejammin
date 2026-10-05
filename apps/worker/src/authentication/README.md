# Authentication worker boundary

## Contents

Strict request parsing, route policy enforcement, Supabase Auth integration, encrypted server cookies, protected RPC composition, and Phase 2 authentication acceptance tests live here.

## Ownership

The Identity domain owns these routes and persistence calls. Supabase validates provider credentials; the worker remains the application authority for sessions, people, audit, and recovery.

## Step-up MFA and TOTP enrollment (DEC-111)

AUTH-API-16 through AUTH-API-21 are implemented over three typed ports in `mfa-types.ts`: `MfaPersistencePort` (protected registry and challenge state), `MfaProviderPort` (Supabase Auth MFA, always called with the caller's own server-held token) and `SessionRotationPort` (aal2 token validation plus sealing of the access, refresh, session-reference and CSRF cookies, with no persistent effect; the index-row touch or swap travels in the settle RPCs as `p_new_session_id` and `p_issued_at`, so settlement and rotation commit in one database transaction and a failed rotation rolls the settlement back). A step-up failure that cannot be recorded (`recordChallengeFailure` not ok) is returned instead of the provider result, so guesses are never uncounted. `mfa-service*.ts` and `step-up-service.ts` own ordering and the error matrix; `routes-mfa.ts` and `routes-step-up.ts` own the HTTP boundary. Unit tests use the fakes in `mfa-test-support.ts`.

Production adapters: `production-mfa-provider.ts` (Supabase MFA with a 5 s deadline, pre-effect retries and a breaker), `production-mfa-persistence.ts` (one `platform_api` RPC per port method; names are listed in `MFA_PERSISTENCE_RPC` and must match the identity migration), `production-session-rotation.ts`, composed by `production-mfa.ts`. `AuthRateLimitInput.scope` makes shared-limiter buckets explicit: `user` (operation plus auth user only), `party` (operation plus acting party only); the default keeps the client-address-scoped login and flow buckets. Step-up freshness is `STEP_UP_FRESHNESS_SECONDS` in `step-up.ts`; every step-up shortfall is 401 `STEP_UP_REQUIRED` with `recoveryAction: 'step_up'` and the method registry. The browser never receives a provider token, factor id or challenge id. The user-facing MFA adapter and the operator-only admin adapter (CFG-05B-06) share one circuit through `mfa-provider-breaker.ts` (keyed on the provider transport, five failures in 60 s open it for 60 s; refusals are tagged with `markMfaCircuitOpen` so telemetry can count them without widening public error details). `mfa-telemetry.ts` emits one `identity.mfa.operation` event per AUTH-API-16..21 request (reason code, STEP_UP_REQUIRED, lockout, provider latency and calls, circuit state, reconciling mark) through `app.use` in `routes-mfa.ts` and `routes-step-up.ts`, with provider timing recorded by a decorator in `production-mfa.ts`; no code, secret, token or provider identifier is ever attached.

## Extension rules

Start from a locked Zod contract and failing test. Add policy metadata before a route, keep all secrets server-side, use protected RPCs instead of direct table access, and preserve exact idempotency and deadline behavior.

Route modules separate provider access, sessions, login methods, and account merges. Production adapters separate configuration, cookies, tokens, bounded HTTP/RPC calls, authorization flows, sessions, login methods, merge commands, and rate limiting. Keep each module within the repository size limits and preserve the public composition exports in `routes.ts` and `production.ts`.

## Conventions

Errors use the shared `ApiError` envelope. Logs contain stable IDs and outcome codes, never tokens, raw emails, state, nonces, PKCE verifiers, or provider payloads.

OAuth callbacks require locally validated one-time app state and PKCE. The nonce remains hashed in the intent, sealed in the first-party flow cookie, and sent through the Supabase provider adapter. Supabase social PKCE responses may omit the provider ID token; when one is returned, the worker requires a valid token shape and an exact nonce match. A verified Supabase user and provider subject are required before an intent-specific RPC may run. Sign-in/recovery callbacks may establish a session; provider-link and duplicate-proof callbacks preserve the initiating survivor session. Mutation CSRF tokens are bound to the sealed session reference, and high-risk step-up freshness comes from the original explicit MFA AMR event rather than JWT issue or refresh time. Provider unlink remains `reconciling` until its governed provider operation reaches a terminal outcome.

## Related links

See `packages/contracts/src/authentication/`, `supabase/migrations/20260901010000_authentication_foundation.sql`, `supabase/migrations/20260901020000_login_methods_account_merge.sql`, and `docs/openapi/openapi.json`.
