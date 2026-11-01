# Lane claude_s12_pwfix9 report

## Status
GREEN for what this lane may run (Vitest on the new reader/writer, eslint, prettier, `node --check`, ad hoc `tsc`). The capture itself
is UNPROVEN end to end until root runs the browser gate: Playwright, wrangler, docker and the stack are not permitted to this lane.
HEAD at start 85ab5ff0. No product change. AC-273 stays `partial` until a run shows the scan reading real logs (see Requests to root).

## Scope (brief items)
| Item | Outcome |
|---|---|
| 1 production logger, not a no-op | `content-schema-registry-api.ts`: `createLogger: createRuntimeDependencies().createLogger` (the exact factory `apps/worker` composes: observability `createLogger`, service `wejammin-api`). Sink: see Deviation 1. |
| 2 web server stdout/stderr to a file, still echoed | The LAUNCHER pipes both children (API and web) through `tee` into `<run>/api-worker.log`, `web-server.log`; bytes echoed unchanged to its stdout/stderr. `playwright.s09-real.config.ts` needs no edit (it never sees the child: the launcher does). |
| 3 telemetry emitters | enumerated below |
| 4 scan extended + Vitest proof | `s12-pw9-scan.ts` `expectNothingLeaked` reads the logs last (settled) and asserts no person id, auth-user id (pass in `persons`), reason, policy basis, diff value, canonical id; `Forbidden` gained optional `canonicalIds` and `policyBasis`. Outbox/audit scan kept. `server-log-capture.test.ts`: 13 tests incl. seeded sink with and without a leak (mutation check: with the matcher stubbed out, 4 of 13 fail). |
| 5 README + launcher comments | done; exact root commands below |

## Deviations from the brief (decisions)
1. **Sink file written by the launcher, not by the Worker.** The API Worker runs in workerd (`wrangler dev`) and has no host filesystem, so it
   cannot open a path from an environment variable. The production logger's default sink is `console.info`; workerd writes that to the
   Worker's stdout; the launcher appends it to `api-worker.log`. This also captures every other `console` line (`[s10-rpc]`) and wrangler's own
   request and error lines. The env var that exists is `S09_SERVER_LOG_DIR` (directory override), read by the launcher and the reader.
2. **Directory discovery**: the specs run in Playwright workers, separate from the launcher. The launcher writes
   `.lane-logs/e2e-server-logs/current.json` `{directory, pid, runToken}`; the reader requires that pid alive (stale pointer = throw).
   `.lane-logs/` is excluded by `.git/info/exclude` here; **root: add `.lane-logs/` to `.gitignore` if it is not already** (not in my claim).
3. `server-log-layout.mjs` (+ `.d.mts`) is the single source for the layout, shared by launcher and reader.

## What is captured where (directory `.lane-logs/e2e-server-logs/<run>/`, never under test-results)
| File | Content |
|---|---|
| `api-worker.log` | API Worker stdout+stderr: production logger lines (request logger, plus the route `telemetry` callbacks of every production boundary, all via `defaultCmsEditorialLogger` -> `console.info`), `[s10-rpc]` lines, wrangler request/error lines |
| `web-server.log` | web wrangler stdout+stderr, all supervised generations appended |
| `launcher.log` | launcher lines (restarts, held-request lines with method+URL, startup errors) |
Also scanned, unchanged: `platform_private.outbox_events`, `audit_private.audit_events`, browser URLs/requests/console/storage/IndexedDB.

## Telemetry emitters traced (web and Worker paths of the journeys)
- Production logger / boundary `telemetry` callbacks (`cms-composition-production*.ts`, `cms-editorial-production-telemetry.ts`): CAPTURED (api log).
- `[s10-rpc]` console.error (`s10-real-editorial.ts:63`): CAPTURED (api log).
- Outbox events: CAPTURED (DB scan, existing).
- Worker `captureException` (`worker-route-composition.ts:174`): UNCAPTURED, no sink: the production runtime's own value is `() => {}`, and the harness keeps that parity.
- CSP `report-to csp-endpoint` (`apps/web/edge-security-runtime.mjs:41`, `apps/worker/src/security-headers.ts:27`): UNCAPTURED, no sink: no `Reporting-Endpoints`/`Report-To` header defines the group, so Chrome sends no report.
- Cloudflare Workers Logs (`observability.enabled` in `apps/web/wrangler.s09-real.jsonc`): UNCAPTURED, deployed-only.
- Web client code: grep found no `sendBeacon`, `PerformanceObserver`, tracing or analytics call in `apps/web/src` outside tests; browser console is already scanned by `s12-pw5-trace.ts`.
- Kong/PostgREST/Postgres container logs: UNCAPTURED (docker; not a Worker/web emitter).
- Queue consumers and cron sweeps (`production-*-sweep.ts`): not running in this harness (pw9 BOUNDARY 2); their loggers would be console too.

## Files (path, lines, SHA-256)
| Path | Lines | SHA-256 |
|---|---|---|
| tests/e2e/support/server-log-layout.mjs (new) | 142 | ed4476394479d62a26eb4eed388af5681a09891087f29530efd589f253b0732a |
| tests/e2e/support/server-log-layout.d.mts (new) | 40 | 3a2faf8f45ff8b6a25f96583673b19f90c7aef36e8a6e919ef649c205ec99d28 |
| tests/e2e/support/server-log-capture.ts (new) | 151 | 2727c63bad0528154233c58441b676277b76d438645df24687181b5702e2849f |
| tests/e2e/support/server-log-capture.test.ts (new) | 242 | fd4410d1d00b0ecf346f30493a5460241629c7123fee48165fa65b529395f16e |
| tests/e2e/support/s12-pw9-scan.ts (edited) | 142 | 57fb40123cbb21a9a1b2eb1977de17e3226d953790649bda00e9458b8f8518af |
| tests/e2e/support/run-s09-real-servers.mjs (edited) | 405 | b39944731c06fc8ee9a2c77a033830ad01b94a68e0378ffb51a2a6304f1ec68a |
| tests/e2e/support/content-schema-registry-api.ts (edited) | 407 | 7c7bbeeeff59fdac9dea1b6bc03b4b5709b2dd9598f89bdba89d3a1d68a00446 |
| tests/e2e/support/README.md (edited) | 217 | 92b0d774a25c2f717c0473221250927da736c7c2f09f971fe6d89adc32ffe73b |

## Runs (all foreground)
- `vitest run tests/e2e/support/` : 7 files, 46 tests pass (13 new). Mutation: matcher stubbed -> 4 new tests fail; restored -> 13 pass.
- `prettier --check`, `eslint` on the changed files: clean. `node --check run-s09-real-servers.mjs`: ok.
- Ad hoc `tsc --noEmit`: only environment errors (no `@types/node`, no workers types: `node:*` modules, `Buffer`, `process`, `ExecutionContext`, and the pre-existing `unknown` env argument at `appFor`); none in the logic.

## Open items / risks to confirm at the first root run
1. The reader fails closed if `api-worker.log` or `web-server.log` holds nothing beyond its header. That relies on wrangler printing request
   lines (the launcher's readiness probes produce some) to stdout/stderr at its default log level. If it does not, the first journey fails with
   "holds no captured output", which means the pipe works but wrangler is silent: say so and I will add a launcher-side probe line.
2. `console.info(object)` is rendered by workerd in its own object format (not JSON). The scan is a substring match over raw, JSON-escaped and
   percent-encoded spellings, so format does not matter for run-unique ids and text; a value that workerd truncates or rewrites would not match.
3. Wrangler request lines carry URL paths; a person id in an API path would now fail the scan (correct per AC-273; the browser URL scan already asserts none).
4. The production logger samples successes (authenticated 10%, public 1%); errors and `highRisk` lines are always kept. A leak on a sampled-out success line is not visible: the scan proves the lines that were logged, not every request.

## Requests to root
1. Run (once, foreground): the pw9 journeys' project as before, e.g. `pnpm db:start && pnpm db:reset` then
   `pnpm exec playwright test --config=playwright.s09-real.config.ts --project=real-route-chrome --workers=1 <the five pw9 specs>`.
   Then inspect `.lane-logs/e2e-server-logs/*/api-worker.log` for `"eventName"`-bearing production logger lines, and confirm `web-server.log` is non-trivial.
2. Add `.lane-logs/` to `.gitignore` (outside my claim) if it is not tracked there.
3. Optional local iteration: `S09_REUSE_SERVERS=1` works (the pointer names the standalone launcher).
