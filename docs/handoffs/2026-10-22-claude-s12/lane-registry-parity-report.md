# Lane claude_s12_registry_parity report (P2-S12-AC-275)

## Status

GREEN (updated after root's B1 decision). 5 new Vitest files, 436 tests, plus `phase-02-slice-12-template-openapi.test.ts` (4): 440 passing, 0 failing; `node infra/generate-openapi.mjs --check` exit 0; eslint and prettier clean. Two defects fixed (D1 ETag, D2 missing 415); BOUNDARY B1 resolved. Updated 2026-10-23.

## Scope

Brief: `briefs/registry-parity.md`. Criterion P2-S12-AC-275. Lane owns NEW `tests/contracts/phase-02-slice-12-registry-parity*.ts`; registry/route/OpenAPI-input files edited only after being named here (see Files).

## Files (path, lines, SHA-256)

NEW, all under `tests/contracts/`:

| File | Lines | SHA-256 |
| --- | ---: | --- |
| phase-02-slice-12-registry-parity-types.ts | 90 | 90661312327259d5907e8ff0f4a2b1b7fcd47401270ba3b3142b9b5fe3025219 |
| phase-02-slice-12-registry-parity-writes.ts | 260 | 63c16c559c4236daccc00fdfd771ce273f13ec3c9df242f8e22c4662afc1c415 |
| phase-02-slice-12-registry-parity-reads.ts | 241 | 90ad57378f5a5510d4c321669837715052a09e90ab766f57d3083ebfb9990bc3 |
| phase-02-slice-12-registry-parity-fixture.ts | 45 | f318e672dbd6b896026ef775462f195cbe4ea7d8542d22588d6686b641a8a87d |
| phase-02-slice-12-registry-parity-spec.ts | 157 | 7f83c7c1647030eda5157ef4f84c9f3bb1372093585197a90923df8c2a37ea40 |
| phase-02-slice-12-registry-parity-worker.test-support.ts | 73 | ffd0e3fbf19ca86cbf50ca88de5576637fc1caa3e0cbe215954c180cd3597d32 |
| phase-02-slice-12-registry-parity-worker-bodies.ts | 188 | 34a7bc7a9382cc785b9a494ea83411bf7c735969358896352669a7743053a5d1 |
| phase-02-slice-12-registry-parity.test.ts | 224 | 13180b94b6e55cca609155947b1602d377c52cb6f2079cbde8c09483bd16fb13 |
| phase-02-slice-12-registry-parity-openapi.test.ts | 180 | d9fdd425493affd00e1982a4476eed9030c61cd8590c9684a1ec62a3e4a50d0a |
| phase-02-slice-12-registry-parity-hono.test.ts | 184 | 55965d134276096cb3de97f2202e3599d6c0e29ac4f81b3022dc1721f927a7dc |
| phase-02-slice-12-registry-parity-worker-policy.test.ts | 51 | 4b87e45d588c6e6571abe241623800e9ef0ed5e3a95915bd342cf58678e464bf |
| phase-02-slice-12-registry-parity-worker-rate.test.ts | 102 | 22fc681edf623b4003e1529b84539721c9ea063e80446878d5899fea42324fc0 |

EDITED (named before editing):

- `infra/openapi-definitions-cms-composition.mjs` (SHA-256 73e9b9a438aa9fa13a5eadf0b3099d1793e0ce0dc4d863d2121f0cee4fd80864): `cmsCompositionInstancesRead` success header kind `'entity'` -> `'unversioned'`, one line plus a comment.
- `infra/openapi-definitions.mjs` (SHA-256 2adc37ba03ba6f5d8cc971e4bc3d713da08a5cfad767e940e7457220521dbce1): the two operations live here, not in the cms-composition file; added a `415 Request media type is unsupported` entry to `cmsTemplateContextRead` and `cmsTemplateLatestRead` (2 lines).
- `docs/openapi/openapi.json` (SHA-256 61208384e23d1681d1376f0c4660fbe0bdfacee82a35ce58e57882e77761a267): regenerated; diffs are the six-line ETag block removal (D1) and two new 415 `ApiError` responses (D2).
- `tests/contracts/phase-02-slice-12-template-openapi.test.ts` (SHA-256 dc70a62a1330aa05439a0e8f5441b2adb4db7237c59102787fe85ba86bfdfcb3): see Test corrections.

Spec read (not edited; SHA-256 after root's template-reads error-table completion): `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, SHA-256 343a2434d1e89a40bc51ecb7102fb9f610beae083d5c82884ea625dc39f64e46.

## Runs (Vitest, no database)

- RED: `phase-02-slice-12-registry-parity-openapi.test.ts` 151/152; the one failure was `cmsCompositionInstancesRead ETag: expected true to be false` (right reason, see defect below).
- GREEN after the fix: `pnpm exec vitest run tests/contracts/phase-02-slice-12-registry-parity` = 5 files, 413 tests passed (105 registry + 152 OpenAPI + 106 Hono + 25 Worker deadline + 25 Worker quota).
- B1 follow-up, RED first: fixture changed to require 415 for both reads (and a new test comparing every fixture error set to the BE03c Contract and error matrix row) -> OpenAPI tests failed 4 (statuses and the `415` `$ref`) and the BOUNDARY sentinel failed, for the right reason; after the two `infra/openapi-definitions.mjs` lines and `node infra/generate-openapi.mjs` + `--check` (exit 0): 5 files 436 tests + template OpenAPI test 4 = 440 passing (also `openapi-reference-integrity`, `phase-02-slice-12-locale-openapi`: pass).
- Related suites with the OpenAPI change: `openapi-reference-integrity`, `authentication-openapi-contract`, all `phase-02-slice-12-*` contracts tests, slice-03/10/11 registry/OpenAPI tests: all pass except the two pre-existing `phase-02-slice-12-evidence-guard.test.ts` tests (receipts "no receipt: the test did not run" for Worker tests outside this run; not caused by this lane, root regenerates receipts).
- Mutation check: fixture rate of CMS-03C-02 changed 120 -> 121 failed 4 tests across the registry, OpenAPI and Worker-quota suites; reverted (file hash restored).
- `node infra/generate-openapi.mjs --check` exit 0 after regeneration.

## What the tests do

1. Fixture of 25 operations (CMS-03C-01 to -17 and the eight named reads: `cmsTemplateContextRead`, `cmsRelatedContentRead`, `cmsLocaleVariantRead`, `cmsTemplateLatestRead`, `cmsPatternLatestRead`, `cmsTaxonomyVersionsRead`, `cmsTaxonomyTermsRead`, `cmsCompositionInstancesRead`), each citing its Route Registry row (BE03c L161 to L185), with error statuses from the Contract and error matrix.
2. The fixture is itself checked against the live spec text: the spec parser reads the Route Registry table and asserts method, path, rate (user and party), timeout, no-store, tier, CSRF, CORS, step-up, idempotency, If-Match, ETag class, request and success schema names and statuses, and the capability literals in the Auth cell. The fixture cannot drift from the spec silently.
3. Platform registry row equals the fixture; the registry `requestSchema` wrapper's `body` member IS (identity) the BE03c request schema; success schema is a contracts export.
4. Generated OpenAPI equals the fixture: operation id at method and path, all `x-*` policy extensions, parameters, request body equals the wrapper's body schema, exact status set, success `$ref`, every error `$ref ApiError` (step-up union on 401 for the four step-up operations), ETag declared exactly as BE03c states it, 429 rate headers.
5. Hono routes are DISCOVERED from the real Worker (`createProductionWorkerAppRuntime` + `createWorkerApp`, `app.routes`): each operation and its OPTIONS preflight are mounted exactly once; the first route Hono resolves for each operation's sample path is its own (fixed segments before parameters); every non-OPTIONS `/api/v1/cms/` Hono route is in the platform registry; credentialed cms-console CORS (allowed origin 204, other origin 403); unauthenticated request is 401 `UNAUTHENTICATED` ApiError with no-store and CORS headers; media 415 where declared.
6. Worker deadline: a never-answering session leaves only the route's deadline timer; fake timers prove 504 at exactly the registry timeout (8,000 or 15,000 ms) and not one ms earlier, for all 25.
7. Worker quota: with a stubbed session and limiter, each route asks for the user bucket then the party bucket with the registry rate class, limit and 60 s window, and answers the denied party bucket with the BE00 429, for all 25 (valid sample requests in `-worker-bodies.ts`).
8. CMS-03C-18 to -21 are absent from all three browser inventories (platform registry operation ids, paths and schema names; OpenAPI operation ids, paths and component schemas; Hono paths), and the spec's Internal service operations table names the RPCs the fixture uses.

## AC-275 clause coverage

Clause by clause (method and path | request | success schemas | error schemas | auth | CORS | rate | timeout | cache | idempotency | ETag | SLO | 18-21 absent):

- Method and path: registry + OpenAPI + Hono mount (all 25). Request schema: wrapper-body identity + OpenAPI body equality. Success schema and statuses: registry + OpenAPI `$ref` + spec table parse. Error schemas and statuses: OpenAPI exact status set and ApiError `$ref`, registry `errorSchemas`; Worker answers 401/415/429/504 with ApiError.
- Auth: registry authClass and capabilities vs spec Auth cell; Worker unauthenticated 401. CORS: registry/OpenAPI `cms-console`; Worker preflight and response headers.
- Rate: registry, OpenAPI `x-rate-limit`, Worker quota calls (all 25). Timeout: registry, OpenAPI, Worker 504 timing (all 25). Cache: `no-store` registry, OpenAPI, Worker 401/415/429 `cache-control`.
- Idempotency, If-Match: registry, OpenAPI headers and `x-*`, spec parse. SLO: tier in registry/OpenAPI; p95 (750/1,200) pinned where the registry carries `slo`; the p95 value for Tier 1 rows (no `slo` object) is only the tier name.
- ETag: OpenAPI header presence for strong/page/none per BE03c (defect fixed); the Worker's actual success-path ETag header is NOT exercised here (no database), only cited for `cmsCompositionInstancesRead` (`composition-instances-routes.ts` `NO_ETAG`).
- CMS-03C-18 to -21 absent: all three inventories.

Not proven by this lane: Worker behavior on success paths (needs the database), the Worker's own 403/404 classes, and the ETag value of reads whose BE03c row is silent (`cmsTemplateContextRead`, `cmsLocaleVariantRead`, `cmsRelatedContentRead`, CMS-03C-11; the fixture marks them `unstated` and asserts nothing).

## Defects fixed

D2. `cmsTemplateContextRead` and `cmsTemplateLatestRead` answered 415 in the Worker (`templateReadMediaError`) and are listed with 415 in the BE03c matrix and catalog rows root added, but the OpenAPI declared no 415. Declared in `infra/openapi-definitions.mjs`; regenerated.

D1. `cmsCompositionInstancesRead`: BE03c L182 says "default limit 25, max 50; no entity tag"; the Worker answers `NO_ETAG` (no `ETag`), yet the generated OpenAPI 200 declared an `ETag` header (copy of the `entity` header kind). Fixed in the OpenAPI input (`'unversioned'` kind, which the generator already supports); regenerated; no other OpenAPI byte changed.

## Test corrections

One existing oracle edited, additions only, per root's decision (BE03c "Contract and error matrix" rows `cmsTemplateContextRead` and `cmsTemplateLatestRead`, "unsupported media if sent"; catalog rows with `415 UNSUPPORTED_MEDIA_TYPE`). `tests/contracts/phase-02-slice-12-template-openapi.test.ts`, in each of the two read tests, after the 200 schema assertion:

```diff
+    // BE03c contract matrix: "unsupported media if sent" (415 UNSUPPORTED_MEDIA_TYPE).
+    expect(
+      operation?.responses['415']?.content?.['application/json']?.schema,
+    ).toEqual({ $ref: '#/components/schemas/ApiError' });
```

(inserted at lines 78-81 for `cmsTemplateLatestRead` and 108-111 for `cmsTemplateContextRead`). Nothing removed or weakened. That test pinned no status set for the reads, so it passed before the fix; the RED evidence is the parity suite.

## Spec citations

BE03c Route Registry (L161 to L185), Internal service operations (L193 to L196), Route field validation matrix (parameters), Contract and error matrix (error statuses), Registry invariants (cmsTemplateContextRead error set); BE00 performance gates (Tier 1 p95 < 750 ms, Tier 2 p95 < 1,200 ms).

## Open items / BOUNDARY

B1. RESOLVED by root (2026-10-23): the Worker is right; BE03c now has matrix rows (and a catalog row for the context read) with 415. The fixture requires 415 for both reads, the BOUNDARY sentinel is replaced by the normal per-operation 415 behavioural test, and the OpenAPI declares 415 (D2). The error statuses of all 25 fixture rows are now compared to the spec matrix text itself.
B2. Worker note (no defect): the content-schema registry's blanket `OPTIONS /api/v1/cms/*` handler (`content-schema-registry/routes.ts`, registered first) answers every CMS preflight with a generic `GET, POST, OPTIONS` policy, so the per-route `OPTIONS` handlers of the Slice 12 routes (`'GET, OPTIONS'` etc.) are unreachable in the composed Worker. The tests assert the reachable behavior only (credentialed allow-origin, method listed). Root may want a decision whether the dead per-route preflight handlers should be removed or the blanket handler narrowed.

## Requests to root

R1. (none; B1 closed.)
R2. Re-cite P2-S12-AC-275 clauses above in the ledger and receipts; the evidence-guard failures listed under Runs are pre-existing receipt staleness.
R3. Note the regenerated `docs/openapi/openapi.json` and `infra/openapi-definitions-cms-composition.mjs` for integration (other lanes also have uncommitted edits to the infra file).
