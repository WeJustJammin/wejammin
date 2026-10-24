# Lane claude_s12_coverage_2 report

## Status
GREEN (2026-10-24 ~04:00). All 20 lane-2 files are at 100/100/100/100 (statements 908/908, branches 842/842, functions 131/131, lines 805/805) in the final run; the whole `apps/worker/src` suite (739 files, 13032 tests) passes in that same run; `tsc --build`, eslint `--max-warnings=0`, prettier `--check` are clean on every touched file. No spec/code contradiction (defect) was found; no `v8 ignore` was used. Four product files changed, each a provable dead-code or instrumentation-artifact removal (listed below).

## Scope
Every gap-list file whose path has no `governed-` and no `pattern-`: 20 files (taxonomy x6, locale x5, related-content x4, observability x3, `production-job-effect-dispatcher.ts`, plus `locale-observability.ts`):
cms-composition-production-{locale-read,locale,related-read,related-rpc,related,taxonomy-definition-versions,taxonomy-definition}.ts, production-job-effect-dispatcher.ts, cms-composition/{locale-observability,locale-read-routes,locale-routes-quota,locale-routes-run,observability-facts,observability-instrument,observability-observation,related-content-read-routes,taxonomy-definition-response,taxonomy-definition-shared,taxonomy-definition-versions-route,taxonomy-definition-write-route}.ts.
Never touched: any `governed-`/`pattern-` file, vitest config, ledgers, specs, receipts. No existing test file was edited (no `## Test corrections`).

## Files (path, lines, SHA-256)
New tests / support (all under `apps/worker/src/`):
- cms-composition-production-locale-related.coverage.test-support.ts 53 e2c50b1993477a68a998c952633e2f1fe7eb4c808d4c1e422c58b6b15b6a7f4b
- cms-composition-production-locale-related.coverage.test.ts 303 f50b3fd2e806980f407070a410a55d819784893ff47e33d0576563cc83880770
- cms-composition-production-locale-related-deadline.coverage.test.ts 143 f88fa06db9586659e3f2244a02a592c0ac3981126afbcd74c506edee3df1553c
- cms-composition-production-taxonomy-definition-versions.coverage.test.ts 354 37f7ebeab39f901e8bb413737203841f1481ba10ae75a9f60ffe5bd2120b40d7
- cms-composition-production-taxonomy-definition.coverage.test.ts 99 3817f594c2096126846a6efc3d4467f054b18457a4905811f168ed48c79be118
- cms-composition/taxonomy-definition.coverage.test.ts 395 174938cbbb0c4542406c8a35bbe452706a69fcfaf21c00efc57e24f05227f78d
- cms-composition/locale-routes.coverage.test.ts 199 30e7d4cfcc191bd1d1b18c462c89bbc79ca2edd712a36d55310539e34533033d
- cms-composition/related-content-read-routes.coverage.test.ts 60 3930f8c5957a3de9f3a3214f0d43cde5be2dfadd99113f423f2efe1b79955b46
- cms-composition/observability-facts.coverage.test.ts 85 c444a3285588bfdd2728fa207835bbceccab55dd33477b38ad1bdd351f604c1f
Product files changed:
- cms-composition/taxonomy-definition-response.ts 308 cf088fe044d6b19a22e16aab0e6b03b5266fc58452e04dca6f6027af3b091f75
- production-job-effect-dispatcher.ts 260 f07cd926f702690d2d97b26f4180b77462039b88c163dbf9c2af07bb406fc1a2
- cms-composition-production-locale.ts 305 d706564932daebc2d0b5f1d1cbe74af9d2815033ea245a681c353cfc12c9cc6b
- cms-composition-production-related-rpc.ts 94 ec5f073fc93f57ae0e4544d1f57699c84c882826029419817eac8fd28e5455fe

### Product changes and their proofs (none is a behavior change)
1. `taxonomy-definition-response.ts:261` `let remove: () => void = () => {}` -> `let remove!: () => void`. Proof: the only reader is `finally { remove() }` after the `new Promise` executor, which runs synchronously and always assigns `remove`; the empty initializer can never run (it was the single uncovered function).
2. `production-job-effect-dispatcher.ts` (CMS preparation result check): `if (invalid) return cmsUnavailable(); return queued&&final ? cmsUnavailable() : result;` -> one `return a || b || (queued&&final) ? cmsUnavailable(context) : result`. Same truth table. Reason: V8 reported the implicit else of that `if` as count -9 (parent range count 3 < then-count 12, async-continuation block accounting), which istanbul scores as an uncovered branch although every case is exercised by 6 existing test files (150 tests). Pre-change: 98.75% branches, 100% after, same 150 tests.
3. `cms-composition-production-locale.ts` `mismatchDetails`: removed the `typeof payload !== 'object' || payload === null` guard; parameter is now `Readonly<Record<string, unknown>>`, the caller casts with the proof. Proof: `mismatchDetails` runs only for a mapped status 409; `mapCmsCompositionRpcFailure` gives 409 only through a token read from a record payload (`carriesProductToken` requires `isRecord`; `codeFromRpcError` returns '' for non-records; 4xx without a product token is the scrubbed 500; 5xx never maps to 409). New regression test pins it: a 409 with body `null`, a string or an array is a scrubbed 500 with no chain detail.
4. `cms-composition-production-related-rpc.ts`: `isRecord(payload) ? payload.details : null` -> `(payload as Readonly<Record<string, unknown>>).details` inside `if (reason.success)`. Proof: `reason.success` is only reachable when `isRecord(payload) && payload.code === 'P0001'`, so the `: null` arm was dead.

## Runs (host: other lanes active; vitest only; no supabase/docker/db/race/Playwright)
Narrow measure command (the 20 files via repeated `--coverage.include`, reporter text+json):
`pnpm exec vitest run --coverage --coverage.reporter=text --coverage.reporter=json --coverage.reportsDirectory=<scratch>/covdir --coverage.include=<each of the 20 files> apps/worker/src`
- 02:57 baseline (cov0): 721 files / 12732 tests pass; gaps as in the brief list for these 20 files.
- 03:05-03:18 narrow filtered runs (`locale related taxonomy observab dispatcher`): converged to 0 uncovered statements/branches/functions.
- Final (cov7, 2026-10-24 ~04:00, after the last edit, hashes above): `Test Files 739 passed (739)`, `Tests 13032 passed (13032)`, exit 0, coverage summary of the 20 files `Statements 100% (908/908) Branches 100% (842/842) Functions 100% (131/131) Lines 100% (805/805)`, no threshold error.
- An intermediate full run (cov6) failed one branch (`locale-routes-quota.ts:54`): my fake-timer test asserted before the aborted work had resumed (the assertion was vacuous and the line raced coverage collection). Fixed by flushing the aborted work before asserting (same fix for the two taxonomy abort tests); three solo repeats stable, final full run green.
- `pnpm exec tsc --build --pretty false tsconfig.json`: clean. `pnpm exec eslint <touched> --max-warnings=0`: clean. `pnpm exec prettier --check <touched>`: clean. File-size rule: all new test files <= 400 lines (split once from 468/443).

## Behaviour asserted (spec citations, BE03c = `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`)
- Pinned server identity, BE00/BE03c admission: a port input claiming another user or acting party than `resolveSession` bound to that Request is a 401 and sends no RPC (cmsLocaleVariantRead, cmsRelatedContentRead, CMS-03C-05).
- Provider fault containment: a response whose accessors throw is a scrubbed 503 `DEPENDENCY_UNAVAILABLE` and never echoes the thrown text (BE03c 1439-1444 502/503/504 DEPENDENCY_UNAVAILABLE; 1453 contract failure is a scrubbed 500).
- CAS: a `40001` whose whole message is `VERSION_MISMATCH`/`STALE_EDIT_PRESENCE` is a 409 for CMS-03C-05, an engine `40001` is a scrubbed 500 (error-tokens contract comment; BE03c 1453).
- Foreign editorial reasons (Slice 11 `separation_of_duties`, conflict and validation reasons) never cross CMS-03C-05/cmsRelatedContentRead: scrubbed 500 (BE03c 1453, 1457 per-operation reason lists).
- One total deadline over headers and body: stalled error/answer body is 504 with Retry-After 15 for locale-read, related-read and CMS-03C-05; taxonomy transport: pre-aborted caller, verifier throw (503, Retry-After 5), deadline firing as the verifier settles, caller abort mid-body, post-deadline late response body cancelled with a failing cancel swallowed, unread non-JSON body cancelled (BE03c 161, 166-167, 1447 as cited in the code).
- Oversized RPC request (> 256 KiB) is a 400 before any network; invalid versions-reader request shapes (operation, UUID, method, path, query, If-Match, Idempotency-Key, Content-Type, Content-Length, Transfer-Encoding) are a 400 with no RPC; createVersion admission (operation, method, path, query, body contract, header mismatch, curator capability -> 403 `capability_missing`).
- Taxonomy routes: malformed session -> 401 reauthenticate with no quota charge; non-envelope session/port answers -> 502; limiter refusal relayed with Retry-After; deadline passing while the last quota bucket answers -> 504 Retry-After 5 and no port call; 409/429 detail projection keeps only well-formed members; statuses outside the catalog publish 502; telemetry rejection/throw never changes a response; unread request body cancel failure swallowed; `boundedBytes` table; catalog token details (`TAXONOMY_*`).
- Locale read: malformed session 401, limiter throw 503/15, non-envelope 502, relayed refusal drops provider text, deadline after the user bucket charges no party bucket (504/15), uncaught failure is a scrubbed 500 with exactly one telemetry event, minted UUID request id when none supplied.
- Locale observability (BE03c 1777, DEC-208): a scheduled time whose window leaves the representable range is refused; the probe logs a failed sample and never reads.
- Related-content read: malformed session 401; minted request id. Observability: stage dedupe/order, unregistered seams and non-Request inputs untouched, `actor_class` human for explicit and omitted actor.

## Test corrections
None. No existing test file was modified.

## Open items / BOUNDARY
None. V8 negative-count artifact (product change 2) is a general hazard for `if (...) return` inside async functions after awaits; other files may show it (`branch(if#1) undefined` entries in `coverage-final.json` with a negative count). Fix pattern: express the guard as one conditional expression.

## Requests to root
- Root reruns evidence receipts for any cited file: none of the pre-existing test files was changed; the four product files above changed (receipts that cite them need rerun).
- The scratch measuring scripts live in `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_coverage_2/` (`cov.sh`, `unc.mjs`).
