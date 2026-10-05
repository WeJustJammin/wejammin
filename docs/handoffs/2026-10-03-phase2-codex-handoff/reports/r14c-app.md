# r14c-app report

Worktree /home/rob/.codex/worktrees/ac265-hosted-evidence-producer/WeJammin, base HEAD e1e53a74, nothing committed.

## Finding 1: AUTH-API-03 body read before origin/CSRF
RED: be00-middleware-order-oauth-start.test.ts (reordered to BE00 step 2 before step 6) and new be00-oauth-start-body-order.test.ts (body stream spy) = 12 failed / 26 passed. Failing line: step 1 "CORS origin allowlist wins over every later step" got 422 VALIDATION_FAILED.
GREEN: apps/worker/src/authentication/routes-provider-access.ts. A request with the wj_session_ref cookie is origin-checked before anything; size and content type next; CSRF before the body when it also carries X-CSRF-Token, Idempotency-Key or If-Match (credentials only link and prove_merge send); then body. Public sign_in keeps the documented order (no origin or CSRF gate, a stale session cookie with no CSRF header still starts sign-in).
Residual: a same-origin session-cookie request with none of the three headers and a non-sign_in intent still has its body read, then gets 403 (mode unknown until read). Foreign origin is always refused first.
Sweep (N/N = 12/12 body-reading Worker route families): auth (email/start public, oauth/start fixed, session, login-methods, account-merges via admitJsonMutationTransport), cms-editorial (4 route files), cms-composition (5), content-schema-registry human handlers, platform-configuration, profile-portfolio, profile-ownership, identity-authority, upload-admission, upload-completion, infrastructure-security, release/webhook/ac265-hosted (signed or OIDC, not cookie). All others already run origin, size/type, CSRF before the body. Dead helpers parseIdentityJsonBody, parseRelationshipJsonBody, parseConfigurationBody/parseBody have no production caller.

## Finding 2: step-up drafts and envelopes unbound
Spec constraint found: FE03 line 614 forbids actor/party/binding identifiers "raw, hashed, or truncated" in island props, URL or logs, and the step-up proof ROTATES the session id (lane rotation port, DEC-111), and the wj_csrf cookie rotates with it. So neither session id, csrf nor an island prop can carry the binding. No island exposes actor/context identity for the registry or grants consoles.
Implemented binding: the web edge (middleware, src/server/step-up-scope.ts) derives an opaque 32-char scope from the subject claim of the wj_access cookie it already receives (decode, not verify; hygiene key, not authorization) and sets a script-readable wj_step_up_scope cookie on signed-in HTML pages (expires it on signed-out pages). The scope follows the subject, so it survives the step-up rotation but changes for any other user. No new server field, no identifier in props.
step-up-binding.ts stamps every record with {binding, createdAt}; restore requires same binding, 0 <= age <= 600 000 ms (DEC-111 window); otherwise cleared. Applied to 3 of 3 step-up detour records: wj-step-up-draft:* (registry runtime, profile ownership), wj:cms-grants:step-up-return envelope, wj-admin-mfa-reset-interrupted marker. hasStepUpDraftWithPrefix purges dead drafts.
Cleared on acting-context change (switcher invalidateDependentSurfaces + revoked broadcast + revert-to-self in acting-context-api-read) and when a tab reaches /auth/sign-in (logout and expiry funnel there). apps/web has no logout control (only the pages/api/v1/auth/logout proxy), so logout is covered by binding mismatch at the next render plus the sign-in clear.
Sweep of apps/web storage writers (7 keys): 3 step-up records bound; not drafts/envelopes and left alone: wj:cms-review-flash (identifier-free one-shot note consumed on the redirect load), sidebar collapse preference, route-heading focus mark, wj_client_binding_id_v1 tab selector.
RED recorded: step-up-draft.test.ts could not import ./step-up-binding; grant envelope/admin marker/switcher/island-session binding tests failed ("expected ... to be null"); step-up-scope.test.ts could not import ./step-up-scope. GREEN after implementation.
Existing tests updated, not weakened: envelope/draft shape assertions now also require binding and createdAt (grant.dom, privacy.dom, profile-ownership draft test, grants real-route spec).

## Verification
- apps/web + apps/worker vitest: 723 files, 9098 tests passed.
- tests/contracts + tests/integration: 4 failures, all integrator-area and unrelated (ledger-guard IA03 digest; receipts guard: generated receipts file missing/stale). Not touched.
- type-check exit 0; eslint --max-warnings=0 and prettier clean on all touched files.
- Chrome s09-real (step-up-return, capability-grants, mfa, admin-mfa-reset, schema-review): 42 passed incl. the new logout -> second reviewer spec. Earlier runs in the log folder: run1 2 failed (envelope shape assertion; my spec locator), later runs port clash after a previous server and a Wrangler ProxyWorker crash (infra, whole run failed); final run clean.
- Chrome functional (authentication, slice-03 acting-context, slice-05 profile-ownership, slice-09 registry, roles, states, network-resilience, accessibility-keyboard): 27 passed.
- Not run: no DB, no db:* (per rules).
Markers used: P2-S09-AC-911, 1032, 1069, 1127.
