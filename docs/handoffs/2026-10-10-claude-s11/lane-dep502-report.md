# Lane dep502 report (2026-10-11)

HEAD `896003bde24b92b711279c1e214040d36619a69d`, worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`,
branch `claude/phase2-slice11`. Nothing was staged or committed. Logs: `docs/handoffs/2026-10-10-claude-s11/lane-dep502-logs/`
(`run-set.sh` is the exact vitest set; `my-files.txt` lists every file this lane touched).

## Defect

BE00:172 and :590 define one global code for a dependency failure, `DEPENDENCY_UNAVAILABLE`, with 502 = a contacted dependency
returned an invalid response, 503 = unavailable, and details `{ dependencyClass, retryable: true }`. No spec or decision defines
`BAD_GATEWAY`, yet every CMS editorial route, the production adapter and the web proxy published it with `retryable: false`.

## Fix (wire contract)

Every CMS editorial 502 is now `DEPENDENCY_UNAVAILABLE` with details `{ dependencyClass: 'cms_editorial', retryable: true }`, the
unchanged fixed message, no `Retry-After`, no provider or upstream text. 503 (`DEPENDENCY_UNAVAILABLE`, `Retry-After` 5) and 504
(`GATEWAY_TIMEOUT`) are unchanged.

- **Contracts.** `BAD_GATEWAY` removed from `CmsEditorialErrorCode`. A route `errors` map is code -> status; one code cannot hold two
  statuses, so `DEPENDENCY_UNAVAILABLE` is declared `[502, 503]` on all 13 envelopes (`routes-errors.ts`). New exports in
  `route-policy-errors.ts`: `CmsEditorialDependencyStatuses`, `CmsEditorialErrorDeclaration`, `cmsEditorialDeclaredStatuses`,
  `cmsEditorialDeclaresError`, `CMS_EDITORIAL_INVALID_ANSWER_DETAILS`. `CmsEditorialErrorMap` maps `DEPENDENCY_UNAVAILABLE` to the pair.
- **Worker.** `route-error-details.ts` gains `INVALID_DEPENDENCY_RESPONSE` (one object replacing eleven inline copies and the
  `BAD_GATEWAY` constant of `workflow-support.ts`); `normalizedError`, `READ_ERROR_CODE_BY_STATUS`, `CODE_BY_STATUS` and the 502
  details in `route-errors.ts` / `workflow-errors.ts` publish the BE00 shape; both `declaredStatuses` use the contract helper;
  `cms-editorial-production-errors.ts` `invalidResponse()` (shared with the composition adapters) is `DEPENDENCY_UNAVAILABLE`.
- **Web.** `cmsEditorialErrorMessage(code, status?)` keeps the 502 text ("returned invalid data") by status, so relayed and local
  messages are unchanged; `cmsEditorialErrorCodeForStatus(502)` is `DEPENDENCY_UNAVAILABLE`; the local 502 carries the BE00 details;
  `cmsEditorialForwardedError` / `relayCmsEditorialWriteFailure` take `CmsEditorialErrorDeclaration` and use the helpers;
  `cms-editorial-mutation-errors.ts` verifies a 502 against `DEPENDENCY_UNAVAILABLE` and returns the generic-failure copy class
  (`INTERNAL_ERROR`) for a 502, which is exactly the copy the editor showed for `BAD_GATEWAY`. Retry gate: status based
  (`>= 500` is degraded and retryable), unchanged.
- **Unchanged on purpose.** The Worker's `x-cms-editorial-retryable` header and the telemetry `retryable` stay `false` for 502 (a
  contract drift is not retried automatically; the web does not read the header; runbook says escalate, do not retry). Body
  `retryable: true` is the BE00 literal. Pinned by `route-errors-dependency.test.ts`.
- **OpenAPI.** Not generated from route `errors` (status-keyed hand-written definitions; `ApiError.code` is a pattern). No
  regeneration needed: `pnpm contracts:check` exit 0 (`contracts-check.log`).
- **Runbook** (outside the named list, two lines): `docs/runbooks/platform/cms-editorial.md` rows `502 BAD_GATEWAY` ->
  `502 DEPENDENCY_UNAVAILABLE` and the escalation line.

## Files

Production: `packages/contracts/src/cms-editorial/{route-policy-base,route-policy-errors,routes-errors}.ts`;
`apps/worker/src/cms-editorial/{route-error-details,route-errors,workflow-errors,workflow-support,workflow-read,workflow-command,authoring-context-routes,conflict-detail-routes,conflict-routes,history-routes,create-routes,routes,detail-routes,list-routes,restore-routes}.ts`;
`apps/worker/src/cms-editorial-production-errors.ts`;
`apps/web/src/server/{cms-editorial-platform-shared,cms-editorial-platform-bounded,cms-editorial-platform-write}.ts`;
`apps/web/src/components/cms-editorial/cms-editorial-mutation-errors.ts`.

New tests: `packages/contracts/src/cms-editorial/routes-dependency-code.test.ts` (7),
`apps/worker/src/cms-editorial/route-errors-dependency.test.ts` (20: 18 routes, policy-free, 503/504 unchanged),
`tests/contracts/phase-02-slice-11-dependency-unavailable-code.test.ts` (2: source scan, no editorial contract/Worker/web source names the retired code).

Changed tests (assertion `BAD_GATEWAY` -> `DEPENDENCY_UNAVAILABLE`, title unchanged unless listed below; 502 details `retryable: false` -> `true`
where asserted): contracts `routes.test.ts`, `routes-slice11.test.ts`, `routes-workflow.test.ts`, `supplemental-routes.test.ts` (error maps
now `DEPENDENCY_UNAVAILABLE: [502, 503]`; the `Object.keys(...).toHaveLength(N)` checks count declared statuses: same 12/11 statuses);
worker `route-errors.test.ts` ("reauthenticates on a 401 and states the dependency class on 502/503/504": 502 details retryable true),
`workflow-errors-typed.test.ts` ("publishes the canonical 502, 504 and 500 envelopes"; "always validates as an ApiError..." iterates
declared statuses), `workflow-read-routes.test.ts` ("is 502 when the success payload breaks the resource contract": now also asserts code and
details), `workflow-read-breach.test-support.ts` (ENVELOPE 502 row: code `DEPENDENCY_UNAVAILABLE`, details asserted in the body, telemetry
`errorCode` follows; pending-ruling comment replaced by the ratification; `RESPONSE_BOUND_STATUS` stays 502), `conflict-detail-routes`,
`detail-routes`, `list-routes`, `authoring-context-routes`, `restore-production`, `routes-admission`, `workflow-command-operations`,
`workflow-command-quota`, `cms-editorial-production`, `-errors-coverage` (two tests, invalidResponse details), `-ports-coverage`,
`-rate-coverage`, `-response-headers` (details retryable true), composition `cms-composition-production-locale` /
`-pattern` (they share `invalidResponse()`); web `cms-editorial-platform-error-relay` (+3 tests), `-outcome-unknown`, `-proxies`,
`cms-workflow-command-transport`, `cms-editorial-runtime` (+1 test); root `tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts`
(declared statuses via helper); `tests/postgrest/support/phase-02-slice-11-safe-diagnostics.ts` (retired code removed from the diagnostic allowlist).

### Titles that changed (old -> new); the evidence ledgers cite these and were not edited

1. `apps/web/src/components/cms-editorial/cms-editorial-entry-create-transport.test.ts`:
   `executeCmsEditorialEntryCreate outcomes maps 502 BAD_GATEWAY to a degraded outcome with retryable=true` ->
   `executeCmsEditorialEntryCreate outcomes maps 502 DEPENDENCY_UNAVAILABLE to a degraded outcome with retryable=true`
2. `apps/web/src/components/cms-editorial/cms-editorial-runtime.test.ts`:
   `executeCmsEditorialRevisionMutation outcomes maps 502 BAD_GATEWAY to a degraded outcome with retryable=true` ->
   `executeCmsEditorialRevisionMutation outcomes maps 502 DEPENDENCY_UNAVAILABLE to a degraded outcome with retryable=true`
3. `apps/web/src/components/cms-editorial/ev-ea-conflict-recovery.test.ts`:
   `EA conflict resolution recovers from every dependency failure a 502 BAD_GATEWAY keeps every choice, shows fixed copy and the retry replays the identical request under the same key` ->
   `... a 502 DEPENDENCY_UNAVAILABLE keeps every choice, shows fixed copy and the retry replays the identical request under the same key`
4. `tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts` (four rows, N = 1..4):
   `'CMS-03B-0N' failure mapping through the production app and adapter CMS-03B-0N maps a success payload that fails the declared resource contract to a non-retryable 502 BAD_GATEWAY` ->
   `... to a 502 DEPENDENCY_UNAVAILABLE that is not retried automatically`
   Cited in `tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts`: title 4 at lines 1598, 1857, 2838, 3929, 4172, 5092; title 3 at line 2936.

## RED (before any production change)

`lane-dep502-logs/red-1.log`: 33 files, 131 tests failed, 986 passed (1117). Failing assertions, all for the right reason:
`expected 'BAD_GATEWAY' to be 'DEPENDENCY_UNAVAILABLE'` (22, worker routes, adapters, relay, integration), `CMS-03B-01: expected
['INVALID_REQUEST', ...] to not include 'BAD_GATEWAY'` (log line 7724, routes-dependency-code.test.ts), `expected [ ...(22) ] to deeply equal []` (line 6766, the
scan guard: 22 source files named the retired code), `TypeError: cmsEditorialDeclaredStatuses / cmsEditorialDeclaresError is not a
function` (8), error-map `toEqual` mismatches (7), 502 details mismatches (`retryable` false vs true), 18/20/7 failures in the three
`workflow-read-breach-*` suites (shared driver now asserts code and details), web verifier `expected 'unknown' to be 'degraded'` (a 502
`DEPENDENCY_UNAVAILABLE` was not verified), `route-errors-dependency.test.ts` 19 failures (one per route and the policy-free path).

## GREEN

`green-3.log`: 72 files, 1162 tests passed (the `run-set.sh` set: affected contracts, worker route/production/composition, web, integration,
root contract and runbook tests). `green-2.log` (whole `apps/worker/src/cms-editorial`, `cms-composition`, contracts `cms-editorial`, web
`cms-editorial*`/`cms-workflow*` server, `tests/integration/phase-02-slice-10`, `tests/contracts/phase-02-slice-10|11`): 325 files, 5049
tests, 4 failures, none caused by this lane (see open items). `pnpm exec eslint --max-warnings=0` on every touched file and
`prettier --check`: clean. `tsc --build`: 6 errors, all in another lane's `cms-workflow-input-retention*.test.tsx` (`tsc-2.log`); none in files touched here.

## Spec lines satisfied

BE00:172 (`DEPENDENCY_UNAVAILABLE`, `{ dependencyClass, retryable: true }`), BE00:590 (502 when a contacted dependency returns an invalid response), BE03b:1925
(502/503/504 carry dependencyClass, retryable, optional retryAfterSeconds), owner ratification 2026-10-11 for P2-S11-AC-050/053/056/059.

## Open items

1. **504 is the same defect.** `GATEWAY_TIMEOUT` is not a BE00 code either (BE00:172 and BE01a:406 list 504 under `DEPENDENCY_UNAVAILABLE`).
   Left unchanged per the brief; one more pass of the same shape (contract pair `[502, 503, 504]`, Worker, web) would close it.
2. 503/504 local web errors (`cmsEditorialLocalError`) still carry `details: {}`; BE00 requires the dependency details. Unchanged.
3. Header/telemetry `retryable` for 502 stays `false` while the body says `true` (see above). Decide whether to align; nothing reads it today.
4. **Evidence/spec text owned by the other lane:** the four renamed titles above break their ledger citations until the ledger is
   regenerated; `tests/contracts/phase-02-slice-11-evidence-ledger-035-066.ts` lines 4229, 4959, 5883, 6490 say the Worker answers with
   `BAD_GATEWAY` (now false; the breach suites `workflow-read-breach-{workflow,review,queue}.test.ts` assert code, details and telemetry
   code, so the code clause can be cited); `wording-batch-draft.md` S2-xx cells propose writing `(BAD_GATEWAY)` into BE03b rows 1914-1919
   and must say `DEPENDENCY_UNAVAILABLE`. The evidence guards (`phase-02-slice-10|11-evidence-guard`) already fail for unrelated reasons
   (382 and 2130 problems, Slice 11 receipts file missing).
5. Editor copy for a 502 save is preserved exactly (generic failure copy); `DEPENDENCY_INVALID_RESPONSE` / `DEPENDENCY_DEADLINE_EXCEEDED` in
   `cms-editorial-types.ts` remain unused vestiges of a vocabulary the specs retired on 2026-10-02.
6. No real-API (`*.apispec.ts`) or e2e spec asserts a 502 or `BAD_GATEWAY`; the apispec `DEPENDENCY_UNAVAILABLE` assertions are 503 and
   unchanged, so the main-stack lane runner was not needed or run.
7. Unrelated failures seen while running wider sets: `apps/worker/src/cms-editorial/a11y-structural/max-input.test.ts` (2,000 ms budget under
   host load), `zz-lane-e2e-probe.test.ts` (another lane's transient file), and once the 504 `aborted` assertion of
   `phase-02-slice-10-ev-ea-error-mapping.test.ts` (30 ms deadline; passes alone and in `green-3.log`).
