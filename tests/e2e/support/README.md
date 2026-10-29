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
- `s10-real-editorial.ts` — the Slice 10 editorial dependency of this Worker:
  the PRODUCTION composition (production RPC adapter -> Kong -> PostgREST -> the
  newest SQL of the local Supabase stack) with only two seams supplied, as the
  `tests/postgrest` real-API gate suites do: the verified session (the signed
  local cookie names the actor, the acting party and the capability claims, see
  `s10-session-claims.ts`) and an always-allow rate limiter. It replaces the old
  test-owned history port, which answered a fixed page for one entry and so could
  only ever prove itself. Every non-2xx RPC answer is logged as `[s10-rpc]`.
- `cms-template-fixture.ts` — in-memory latest-version/CAS behavior for the
  production-built CMS-11 browser route; it is not a Supabase implementation.
- `s09-session-authority.ts` — local HMAC signature, expiry, session-ID, and
  revocation verifier shared by the API fixture.
- `local-signed-session.ts` — test-only browser cookies matching that verifier;
  the Slice 12 flow additionally supplies a non-HttpOnly CSRF cookie.
- `wrangler.s09-api.jsonc` — Wrangler configuration for that API Worker.
- `run-s09-real-servers.mjs` — ordered production web build, API/web startup,
  readiness polling, explicit port handling, and process-group teardown.
- `run-s09-real-suite.mjs` — runs all production-built Chrome checks with a
  bounded whole-suite retry (three attempts total) that is armed only by a
  recognized local infrastructure disconnect: either the known ProxyWorker
  `Network connection lost` signature in that attempt's own Wrangler log, or
  the launcher's explicit `S09 web server exited before teardown` line. Any
  assertion failure, missing log, unrelated Wrangler error, or exhaustion of the
  attempt budget stays red; each retry is accounted on stderr.
- `profile-portfolio-api.mjs` — legacy HTTP fixture for profile-portfolio E2E;
  it is independent of the Slice 09 Worker binding harness.

The Slice 12 test uses two authenticated Chrome tabs against the production-built
Astro route and the real Worker route with `cms-template-fixture.ts` as its
port. Its 201/409/rebase proof covers browser transport and reconciliation,
not Supabase persistence, provider authorization, or hosted acceptance.

The Slice 10 real-route specs (`phase-02-slice-10-*-real-route.spec.ts`) run
through the REAL composition: the built web app, the first-party proxy, the
production editorial Worker routes and adapter, Kong, PostgREST and the newest
SQL. They therefore need the local Supabase stack at the newest migrations
(`pnpm db:start && pnpm db:reset`); `run-s09-real-servers.mjs` fails loudly when
it is not answering and hands the API Worker the stack's service key through a
0600 file (never a command line). Support for these specs:

- `s10-real-world.ts` — the committed world: the operator-bootstrapped owner, an
  active content type made through the production registry app (the 03a
  activation envelope carries the real workflow-policy member, exactly as
  `tests/postgrest/support/cms-editorial-world.ts` does), and fresh authors, a
  confirmed member without a grant and an outsider per run. Entries, revisions,
  conflicts and restores are never seeded by SQL.
- `s10-real-api.ts` — first-party requests through the same proxy chain, used for
  preconditions (an entry with history, a second author's entry).
- `s10-real-browser.ts` — signed-in contexts, the axe gate and the scroll gate.

The Slice 11 workflow spec (`phase-02-slice-11-workflow-real-route.spec.ts`)
layers these on the same world:

- `s11-real-world.ts` — reviewer, publisher and owner principals with their
  grants (30 days by default; a spec that schedules months ahead passes
  `grantDays`, because a schedule is refused when the publisher's grant ends
  before the day it takes effect) and the signed Slice 11 session.
- `s11-real-browser.ts` / `s11-real-flow.ts` — signed-in contexts, the completed
  step-up instant, and the first-party submit, assign and decide preconditions.
- `s11-approved-entry.ts` — the author, reviewer, publisher and owner cast on the
  Slice 10 world (the publisher's grant outlasts the 366 day schedule horizon) and
  `approvedEntry`, a fresh entry submitted, assigned and approved through the
  first-party routes, for a spec that needs the publisher's schedule and publish
  forms on the workflow page.
- `s11-status-recorder.ts` — records every text a command form's polite status
  line shows. The form's own line lasts only until the canonical read replaces
  the form (20 to 40 ms on a quiet host); the island's persistent status line
  keeps the confirmation after the refetch. Specs assert that the confirmation
  was announced, that the island line still holds it, and the canonical page
  state, never a visibility check on the transient form line.
- `s11-dst-gap.ts` (with `s11-dst-gap.test.ts`) — the next real spring-forward
  gap inside the schedule horizon, read from the host's tz data, so the schedule
  spec never types a fixed calendar date that goes stale.
- `s12-real-governed.ts` (with `s12-real-governed.test.ts`) — the Slice 12 CMS
  composition boundaries of the real-route API Worker (governed review, taxonomy
  definition and term actions, pattern placement, definition and update, related
  content), each the PRODUCTION composition over the local stack. A boundary left
  out is an unregistered route that the web relays as a 502, so the test pins that
  every boundary the production Worker composes is served (the launcher serves
  `cmsEditorial`, and `cmsTemplate` / `cmsLocale` through the routing below). This
  directory is not type-checked by `pnpm type-check`; guard behaviour with Vitest,
  not types.
- `s12-real-template-locale.ts` (with `s12-real-template-locale.test.ts`) — the
  template (CMS-03C-01 and its context / latest reads) and locale (CMS-03C-04)
  boundaries. A request whose signed session carries the Slice 11/12 claims
  (party, person, capabilities) is answered by the PRODUCTION composition; every
  other request (lane and legacy fixture sessions) keeps its test-owned fixture
  port (`cms-template-fixture.ts`, `cms-locale-fixture.ts`), so the older
  real-route specs are untouched. The home is chosen once in `resolveSession` and
  remembered by Request identity, so rate limit, read and write of one request
  never mix homes. Without it a signed-in Slice 11/12 session was a fixture 401
  and the pattern/locale pages redirected to sign-in with no API request.

The Slice 11 bundle-budget spec (`phase-02-slice-11-bundle-budget-real-route.spec.ts`)
reads every JavaScript response Chrome loads from the production-built workflow
route, gzips each body exactly as `pnpm bundle:check` gzips a built asset, and
asserts that the Time authority chunk is absent from the cold load, fetched once
when the schedule form opens, and within the lazy-chunk threshold. The threshold is
`BUNDLE_BUDGETS`, imported from `scripts/verify-bundle-budget.mjs` so it has one
owner. The route's own initial JavaScript is not asserted there. The spec runs
only in the real-route project (it is in the functional config's `testIgnore` and
in this project's `testMatch`).

Local iteration: start `node tests/e2e/support/run-s09-real-servers.mjs` once and
run Playwright with `S09_REUSE_SERVERS=1`; CI never sets it.

These tests are loopback-only local evidence, not hosted acceptance.

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
