# Real-route support

## Contents

- Local API and session-authority fixtures
- Wrangler configuration and process runner
- Legacy profile-portfolio fixture, whose mock Worker answers the CFG-05B-07
  capability snapshot per session cookie (never a capability response header);
  `config-sessions.ts` supplies the read-only session for Slice 07 checks

## Ownership

This directory owns test-only bindings for the Slice 09, Slice 10, and Slice 12
real-route browser checks. It does not own production API behavior, Supabase
persistence, or deployment credentials.

## Extension

Add a fixture only when a browser contract needs an isolated local boundary.
Document its process lifetime, origin, authority assumptions, and cleanup in
this file, and keep production paths delegated to the real server entry.

## Conventions

Use explicit loopback origins, bounded readiness polling, process-group
cleanup, and test-only secrets. Never use these fixtures as evidence for
deployed Worker, RLS, identity-provider, or external-service behavior.

## Related links

- `tests/e2e/phase-02-slice-09-content-schema-registry-real-route.spec.ts`
- `apps/web/content-schema-registry-web.mjs`
- `docs/local-bootstrap.md`

This directory contains test-owned local bindings used by production-built
Astro/Cloudflare E2E checks. The harness starts the API Worker first, waits for
API and web readiness, runs Playwright against an explicit loopback origin, and
tears down child process groups. It does not connect to Supabase, external
identity providers, billing, or Cloudflare deployment resources.
The in-memory adapter is not evidence of Supabase persistence, PostgreSQL RLS,
or a deployed Worker.

## Module map

- `content-schema-registry-api.ts` — local Worker API composition with an
  in-memory registry projection, Slice 10 history and Slice 12 template
  fixtures, HMAC-validated session authority, and a test-only revocation
  control.
- `cms-editorial-history-fixture.ts` — in-memory, owner-bound revision summaries
  and comparison for the production-built CMS-07 read route; it cannot prove
  Supabase authorization, tamper-evident keyset cursors, or persistence.
- `cms-template-fixture.ts` — in-memory latest-version/CAS behavior for the
  production-built CMS-11 browser route; it is not a Supabase implementation.
- `s09-session-authority.ts` — local HMAC signature, expiry, session-ID, and
  revocation verifier shared by the API fixture.
- `local-signed-session.ts` — test-only browser cookies matching that verifier;
  the Slice 12 flow additionally supplies a non-HttpOnly CSRF cookie.
- `wrangler.s09-api.jsonc` — Wrangler configuration for that API Worker.
- `run-s09-real-servers.mjs` — ordered production web build, API/web startup,
  readiness polling, explicit port handling, and process-group teardown.
- `run-s09-real-suite.mjs` — runs all ten production-built Chrome checks and
  permits one complete-suite restart only when the failed Wrangler log contains
  the known local ProxyWorker `Network connection lost` signature. An assertion
  failure, missing log, unrelated Wrangler error, or second failure stays red.
- `profile-portfolio-api.mjs` — legacy HTTP fixture for profile-portfolio E2E;
  it is independent of the Slice 09 Worker binding harness.

The Slice 12 test uses two authenticated Chrome tabs against the production-built
Astro route and the real Worker route with `cms-template-fixture.ts` as its
port. Its 201/409/rebase proof covers browser transport and reconciliation,
not Supabase persistence, provider authorization, or hosted acceptance.

The Slice 10 history tests cover signed-session admission, safe summary
escaping, native filters and comparison, stale-cursor recovery, and non-owned
entry disclosure through the production-built Astro and Worker routes. The
history port remains test-owned, so these tests are not hosted or database
acceptance evidence.

The web-side test adapter lives at `apps/web/content-schema-registry-web.mjs`
and delegates all non-test paths to the production server entry. Its temporary
Wrangler config is created under the operating-system temp directory, never in
`apps/web`.

## Real-route server supervision

`run-s09-real-servers.mjs` starts the Worker API and the web Wrangler session as
detached process groups and fronts the web session with `s09-hold-proxy.mjs` on
the public port. `wrangler dev` treats any network error in its ProxyWorker as
fatal to the whole dev session, so the runner restarts the web child (at most 20
times, killing the orphaned process group first) while the proxy holds in-flight
requests and replays them to the new child. A parent-death watchdog and the
shutdown path kill every detached tree, so an interrupted run leaves no server
behind. `s09-hold-proxy.test.ts` is a Vitest-only unit suite; the functional
Playwright config ignores `support/*.test.ts`.
