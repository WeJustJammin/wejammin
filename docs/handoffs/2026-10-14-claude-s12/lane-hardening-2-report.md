# Lane report: claude_s12_hardening_2

## Status
GREEN (successor lane after predecessor usage-limit kill). Items 1-6 done.

## Scope
Brief `briefs/hardening-2.md` items 1-6.

## Progress
- Item 1 (Worker locale/related): found DONE by predecessor on resume (mapper swap in
  `cms-composition-production-locale.ts` + `-related-rpc.ts`; 502 `retryable: true` in `locale-routes-support.ts:116`,
  `related-content-details.ts:95`; oracle `related-content-errors.test.ts`; header validation moved before capability/quota in
  `locale-routes.ts`, `related-content-routes.ts`; order suites use `headersBeforeAuthorization`; `STILL_NON_RETRYABLE_502` deleted).
  Verified 21:32: 11 files, 307/307 green (locale-routes, related-content-admission/errors, dependency-unavailable,
  write-header-order(+locale-related), provider-fault(+locale-related), production-locale/related/related-ids).
- Item 2 (Web relay) DONE: new `apps/web/src/server/cms-composition-platform-dependency.ts` (shared 502/503/504 details
  `{dependencyClass:'cms_composition', retryable:true}`); the four relays `cms-composition-platform-{mutation,pattern,locale,related}.ts`
  use it for both relayed upstream refusals and relay-local ones (local 502/503/504 previously went out with `details: {}`, also a
  BE00 172 violation). RED seen first (mutation-error-relay 502 case, pattern 502 case, new locale/related tests: retryable false / `{}`),
  then GREEN: 8 relay files + `apps/web/src/pages/api/v1/cms` 139 -> all pass.
- Item 5 (pattern-instances.test.ts 502) DONE: root cause = stale test oracle. The relay (placement lane, DEC-188/189) validates the 201
  as `PatternPlacementResource` (`{items:[...]}` with row `position`, row path under `slotPath`); the test still returned a bare
  `CompositionInstanceResource`, so the relay correctly failed closed with 502. Fixed the oracle (see Test corrections). No production change.
- Item 3 (placement Worker adapter, R2) DONE: new `apps/worker/src/cms-composition-production-pattern-errors.ts` `placementRpcError`
  (modelled on `relatedRpcError`/`patternRpcError`, operation `CMS-03C-02`); wired in `cms-composition-production-pattern.ts`. The seven tokens
  the operation publishes (`capability_missing` 403; `revision_not_editable`, `pattern_cycle`, `block_registry_digest_mismatch` 409;
  `pattern_version_not_active`, `pattern_incompatible`, `nested_pattern_not_active` 422) become the typed catalog refusal with exactly
  `details.reasonCode`; unlisted/other-operation tokens, prose, hints and PGRST faults stay the scrubbed 500; every 5xx keeps the unchanged 03b
  mapping (existing AC-218 oracle: a 500 body `VERSION_MISMATCH` -> 409). Route layer: new `cms-composition/pattern-instance-details.ts`
  (`patternInstanceDetails`) used by `pattern-instance-responses.ts`, because the shared `taxonomy-responses.safeDetails` dropped every reasonCode
  except CAPABILITY_REQUIRED, so a typed port refusal still went out with `{}`. New tests: `cms-composition-production-pattern-reasons.test.ts`
  (11) and `cms-composition/pattern-instance-reasons.test.ts` (9); both RED first (7 + 7 failures), GREEN after.
- Item 4 (R3) DONE: `tests/contracts/phase-02-slice-12-pattern-placement-witness-parity.test.ts` (3 tests; marker-region equality, whole-transform
  needles, drift). Passes (the placement lane's diff claim holds).
- Item 6 DONE by predecessor: `write-header-order*.test.ts` hold 0 `as unknown as` casts (verified by grep).

## Files (new or edited by this lane; item-1 and write-header-order files were predecessor edits, verified)
| path | lines | SHA-256 |
|---|---|---|
| `apps/web/src/server/cms-composition-platform-dependency.ts` | 19 | `048dc8be0207088a717d363d18f1ba0a8aa3de3935915214ff2627b36e4b0732` |
| `apps/web/src/server/cms-composition-platform-mutation.ts` | 323 | `389c174a6ce5a2f2c64edc863c55ac55735d2cb3a54f779c5b8d481c9aa31eeb` |
| `apps/web/src/server/cms-composition-platform-pattern.ts` | 269 | `3f1cc00919d156053ebe3f10680a5faee24bffe460dac89c56661a52bfd96d88` |
| `apps/web/src/server/cms-composition-platform-locale.ts` | 238 | `1b38b361f5ada0b93764c8e4fd2c2bdb4f0bef19daa65a8686cc34d878c90f33` |
| `apps/web/src/server/cms-composition-platform-related.ts` | 232 | `8a0355bf77a60b7017f6239654a0965070e0cefbd4f91435e0b6072a6bb8a70d` |
| `apps/web/src/server/cms-composition-platform-locale.test.ts` | 356 | `2b8b9c2a3f18f756a416556730eb135aca5d10331078394aeddb69e0e57c0173` |
| `apps/web/src/server/cms-composition-platform-related.test.ts` | 341 | `b0f3d8faae420df8f95d836f8f89323010b88527c42448dc0c86a04915c16400` |
| `apps/web/src/server/cms-composition-platform-pattern.test.ts` | 245 | `430dbce56d1257040fe33316d37d3406a9ac9914fe6d823713728458ce5c17fa` |
| `apps/web/src/server/cms-composition-platform-mutation-error-relay.test.ts` | 250 | `4bd95c3685f1115b76c75f1f6d339b6e6a8aaca95aa2910a126e37cb31725b7e` |
| `apps/web/src/pages/api/v1/cms/compositions/pattern-instances.test.ts` | 96 | `882e9ddd85a8a9b7cb9c47450a29db97348337d1c9e91e0e6263afba0d96c1a1` |
| `apps/worker/src/cms-composition-production-pattern-errors.ts` | 67 | `5a8a6ea4ee140e1cf0a5102ebbc69065afd9221bd3874aef573cb528131ca372` |
| `apps/worker/src/cms-composition-production-pattern.ts` | 247 | `5aa6728e897ec7cc53e9f5800dcfa34af29e71556a1da32570fad4e1fb562a46` |
| `apps/worker/src/cms-composition-production-pattern-reasons.test.ts` | 138 | `3c4755b08e489342e7728eb2d0dfec9ef9a34c464ffa28155628f3d8c6f1b2fd` |
| `apps/worker/src/cms-composition/pattern-instance-details.ts` | 39 | `8d7bfdcab835e7fafd675012900e8298ba2768a1683699a4472d148894b5703e` |
| `apps/worker/src/cms-composition/pattern-instance-responses.ts` | 59 | `8db1e59bb5d0395ef3a06fa702ad03622f5a44f0f3356e16556ec10d329f15e5` |
| `apps/worker/src/cms-composition/pattern-instance-reasons.test.ts` | 81 | `5af9314b36e7a571401b593f0f5504c5c0073d3cb26d881ff32b8bf725e0f2c0` |
| `tests/contracts/phase-02-slice-12-pattern-placement-witness-parity.test.ts` | 76 | `810f1db6e08e5adad186873a39e68e17c598ccf598921e25a1c2c370ea9183db` |
| `apps/worker/src/cms-composition-production-related-rpc.ts` | 74 | `13f90b9825c0fc4dbf2fcfc7afde91f7f9f32bbd128a33d2d50a804a68b4337b` |


## Runs
| time | what | result |
|---|---|---|
| 21:32 | 11 Worker files (item 1 set) | 307/307 pass |
| 21:33 | RED web relay (4 files) | 4 failed (retryable false / details {}), then GREEN |
| 21:35 | RED `cms-composition-production-pattern-reasons.test.ts` | 7 failed / 4 passed, then GREEN 11/11 |
| 21:36 | RED `pattern-instance-reasons.test.ts` | 7 failed / 2 passed, then GREEN 9/9; regression found and fixed (5xx must keep 03b mapping, AC-218 oracle) |
| 21:4x | joint 345 set (11 files of lane-native-worker-integration-report.md:67) | 11 files, 345/345 |
| 21:4x | full Worker suite `apps/worker` | 621 passed / 1 failed file of 622; 10,789/10,789 tests. The failing file `cms-governed-activation-rpc.test.ts` imports a not-yet-written module (governed lane, not mine) |
| 21:5x | full Web suite `apps/web` | 450 files, 4,981/4,981 |
| 21:4x | `astro check` apps/web | 0 errors, 0 warnings |
| 21:4x | `tsc --noEmit` apps/worker | 11 errors, all in concurrent governed-lane files (governed-review-ports.ts, cms-governed-activation-*.test.ts); none in this lane's files |
| 21:4x | eslint --max-warnings=0 + prettier --check on all touched files; `git diff --check` | clean (prettier --write applied to `cms-composition-production-related-rpc.ts`) |

## Test corrections
- `apps/web/src/server/cms-composition-platform-mutation-error-relay.test.ts` (502 row): projected `retryable: false` -> `true`
  (BE00 172: `retryable: true` literal for 502/503/504).
- `apps/web/src/server/cms-composition-platform-pattern.test.ts` (502 row): projected `retryable: false` -> `true` (same).
- `apps/web/src/pages/api/v1/cms/compositions/pattern-instances.test.ts`: upstream 201 body bare resource -> `{ items: [resource] }` with
  `position: 0` and `path: '/primary/hero0'` (BE03c CMS-03C-02 `201 PatternPlacementResource`, DEC-175/185/186; slotPath `/primary` needs a node suffix).
- Added tests (not corrections): `cms-composition-platform-locale.test.ts`, `-related.test.ts` "relays DEPENDENCY_UNAVAILABLE retryable true ...".

## Spec citations
BE00 172, 386/387; BE03c 408, 1502.

## Open items / BOUNDARY
- The placement producer (`20261014110100` nodes, `110250` plan) raises `pattern_depth_exceeded` and `pattern_nodes_exceeded`, but BE03c 1304 and
  `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-02']` do not list them for CMS-03C-02 (they are CMS-03C-12 tokens). The adapter follows the contract:
  they are a scrubbed 500 (asserted). Both are defensive guards that a pinned, validated pattern tree cannot reach. If root wants them typed 422, the
  contract operation matrix needs the two tokens first (spec ruling).

## Requests to root
1. `STILL_NON_RETRYABLE_502` is gone; the Web dependency details now come from one shared module. Dispatch an independent review.
2. Spec ruling (optional): whether `pattern_depth_exceeded`/`pattern_nodes_exceeded` should be published by CMS-03C-02 (see Open items).
3. Placement lane R1 (dependency manifest join), B1, B2 remain open for root; not touched here.
