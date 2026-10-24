# Lane report: claude_s12_hardening_4

## Status
GREEN for this lane's scope (2026-10-15T09:08:21Z). All four brief items done; one full-Web failure belongs to the Web taxonomies lane (Open item 1).
HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`.

## Scope
Brief `briefs/hardening-4.md`: BE03c 1304 gives every 03c operation exactly one lowercase 403 token, `capability_missing`
(`packages/contracts/src/cms-composition/refusals.ts:116-202`; `refusals.test.ts:203-212` rejects `CAPABILITY_REQUIRED`). Removed the
pre-contract upper-case token from the five Worker route-local 403s, the four Worker detail filters (plus the pattern-instance fallback), and
the three Web relays; closed review-hardening-3 findings 1, 2, 5. Out-of-scope catalogs (BE03b `cms-editorial-*`, content-schema-registry,
provider-evidence, diagnostics, CMS-03C-15 `pattern-update-*`) untouched.

## Progress
- Item 1 (Worker routes + filters) DONE. RED first: new `capability-missing-refusals.test.ts` (5 routes: template context read, template
  detail read, CMS-03C-01, CMS-03C-04, CMS-03C-05; each with missing capability, null acting party, session port 403 carrying
  `CAPABILITY_REQUIRED` / `separation_of_duties` / `revision_not_editable` / `not_a_token`, and the typed token): 19 failed / 16 passed
  (failures = route-local and filter still emitting `CAPABILITY_REQUIRED`; the 16 passes were the already-correct drop rows and the related
  typed row). GREEN: new `capability-details.ts` (`forbiddenDetails(operationId, source)`: relays a 403 token only if it parses as a
  `CmsSlice12ReasonCode`, its contract status is 403 and it is in `CMS_SLICE_12_OPERATION_REASONS[operationId]`; else `{}`). Used by
  `template-respond.ts` (`CMS-03C-01`; `cmsTemplateContextRead` has no table row and shares the template family's identical 403 token) and
  `locale-routes-support.ts` (`CMS-03C-04`). `related-content-details.ts` lost its `CAPABILITY_REQUIRED` branch (its `typedReason` already
  covers `capability_missing` for `CMS-03C-05`). `taxonomy-safe-details.ts` 403 now `{}` (the shared BE00 allowlist names no 403 token).
  Five route-locals now `{ reasonCode: 'capability_missing' }`.
- Item 2 (Web relays) DONE. RED: new `cms-composition-platform-capability-missing.test.ts` (5 relays x typed token + 6 foreign/untyped upstream
  403s): 10 failed / 25 passed. GREEN: new `cms-composition-platform-capability.ts` (same `forbiddenDetails`), used by `-mutation.ts`
  (`CMS-03C-01`; also serves the context/detail reads through `forwardedError`), `-locale.ts` (`CMS-03C-04`), `-related.ts` (`CMS-03C-05`).
  Web consumers: grep of `apps/web/src` non-test sources for `CAPABILITY_REQUIRED|capability_missing|reasonCode` shows no template/locale/related
  browser mapper that reads the 403 reason; `components/cms-composition/cms-template-designer-submit.ts:38` maps `403: 'TEMPLATE_FORBIDDEN'` by
  status only. Nothing to change there.
- review-hardening-3 finding 1 DONE: `cms-composition-production-pattern-reasons.test.ts` gained rows (DETAIL `'["/secret-pointer"]'`,
  `'["/revisionId","/secret-pointer"]'`, `null`, absent) expecting exactly `[{path:'/patternId',code:'invalid',message:'The value is invalid.'}]`
  and neither `secret-pointer` nor `/revisionId` for both guard tokens. These pin an already-correct property, so they were green on arrival
  (4 rows x2 tokens); a copy-from-DETAIL mutation would yield `/secret-pointer`/`/revisionId` and fail them. I did not mutate shared
  production code to prove it (other lanes run).
- review-hardening-3 finding 2 DONE: RED `pattern-instance-reasons.test.ts` "relays {} for a 403 from the session port carrying ..." (3 rows;
  1 failed: `CAPABILITY_REQUIRED` came out). GREEN: `patternInstanceDetails` returns `{}` for an untyped/foreign 403 (explicitly, independent of the
  shared filter, which is now also `{}` at 403).
- review-hardening-3 finding 5 DONE: new `cms-composition-production-pattern-composed.test.ts`: fetch double (PostgREST P0001 raise) -> real
  `createProductionCmsPatternInstanceDependencies` (injected rate limiter only) -> real `createCmsPatternInstanceApp` ->
  `revision_not_editable` = 409 `COMPOSITION_VERSION_CONFLICT` `{reasonCode}` (parses `CmsCompositionRefusalDetailsSchema`);
  `pattern_nodes_exceeded` with hostile DETAIL = 422 `COMPOSITION_VALIDATION_FAILED` with one hardcoded `/patternId` violation and no reasonCode.
  Green on arrival (seam already correct); a first run was a harness miss (no rate limiter -> 503), classified harness, fixed by injecting `options.rateLimit`.
- Worker README: one sentence naming `capability-details.ts`.

## Files
| path | lines | SHA-256 |
|---|---|---|
| `apps/worker/src/cms-composition/capability-details.ts` | 34 | `5f7905a42ed9af6b96eed5c8c74be57957dbc35ad18b06a01a0d5df86253ab3c` |
| `apps/worker/src/cms-composition/capability-missing-refusals.test.ts` | 271 | `7c5d4105863b2096dcfe05e81755e7275ef6d657792801c994901280b9d91c41` |
| `apps/worker/src/cms-composition/template-respond.ts` | 146 | `4f8c26ec890c8067e0da76b191e63eaaf8bbf10caabedc97654f3b803f907249` |
| `apps/worker/src/cms-composition/locale-routes-support.ts` | 156 | `fd2920ce4875d264c47ae03d7ae69172bbfc34496a68907a9ed94178f4b2d095` |
| `apps/worker/src/cms-composition/related-content-details.ts` | 95 | `89fc855121abbb6eccae7b8071586022d532fa776c0b0ced0e3e46dfa6f37a7e` |
| `apps/worker/src/cms-composition/taxonomy-safe-details.ts` | 72 | `38ed63a0b710b86e4051f9c85f2f5e647e3ef253846eccb5e4f73c03e0445e0c` |
| `apps/worker/src/cms-composition/pattern-instance-details.ts` | 39 | `57d39476bc50f651a13f3bc41b50b1c05286891f0c13cfecedfba48c754acf3b` |
| `apps/worker/src/cms-composition/pattern-instance-reasons.test.ts` | 167 | `669e748d3c3d5923d115cb7ce2dcca23341ac4229e2091864e1a26152c7aadd1` |
| `apps/worker/src/cms-composition/locale-routes.ts` | 297 | `6bc7975af16d2e69d6cbdbd50c87f44f33a2b6871ecea3bd54ade8dbf5e44ca0` |
| `apps/worker/src/cms-composition/related-content-routes.ts` | 283 | `9c6c5d049bd721ef21adf321a24256864922b1dd2dbc078b119a1ab239ffacef` |
| `apps/worker/src/cms-composition/template-context-routes.ts` | 195 | `35a31aef1f3987bb66c3b7e1eb54c3bce46b0c43e9b05728a3d83210c6029f5f` |
| `apps/worker/src/cms-composition/template-detail-routes.ts` | 216 | `1489bdaa9100a41ccd66f6bd934f1803b856a3e989a566968bdb7b6fb305fbe6` |
| `apps/worker/src/cms-composition/template-version-routes.ts` | 257 | `136b5f1b4b385972fc89ffb545a643d3cbe50f62524bfc0a542ce8d9823c0b11` |
| `apps/worker/src/cms-composition/locale-routes.test.ts` | 889 | `32167b8d96d54f2905e7e661266e214aa268dd69cdbd3cd8735d5d528612df15` |
| `apps/worker/src/cms-composition/related-content-envelope.test.ts` | 229 | `1c79029ba4a50d8ecc994dde6d015c096d7f7fffe36235fb70f80875595e80b2` |
| `apps/worker/src/cms-composition/related-content-errors.test.ts` | 332 | `352a7d42049dc1bdd68a989ac459954a639839a88a7b1f21c1531698fdbc0dc5` |
| `apps/worker/src/cms-composition/taxonomy-term-details.test.ts` | 214 | `733ded68138c7c75688dfec751a081affec9573ab3c24a500e21d15074ccc545` |
| `apps/worker/src/cms-composition/README.md` | 133 | `d13c39f4a4d8a2338637bf29f2954dd12868d5d6f7aaa2b28ae3656ac92dd8b9` |
| `apps/worker/src/cms-composition-production-pattern-composed.test.ts` | 89 | `d05647b4d682722f39e8b5227eadf8713091a40282cefcefe549cf214cd8fed3` |
| `apps/worker/src/cms-composition-production-pattern-reasons.test.ts` | 203 | `f8fa0652b50be70c3ae579ba516c1bfa662d8f77e83aacda4710ed38aa682cbd` |
| `apps/web/src/server/cms-composition-platform-capability.ts` | 34 | `ba1e053d27d23e1caa294cc240c8449454ce0f625d5d7acc2e9e13923c680935` |
| `apps/web/src/server/cms-composition-platform-capability-missing.test.ts` | 179 | `f6c0cae9871edf1b0a58141bdb051e86c457a4a2dc01e6aba1032a0fb2ff1190` |
| `apps/web/src/server/cms-composition-platform-mutation.ts` | 321 | `938f89c6931c53db7486e58e03e069da07c562f8abdbe082a30fbd6678e1ebd9` |
| `apps/web/src/server/cms-composition-platform-locale.ts` | 236 | `d2c547525d5de7cd0c1a460a136d92e597a3a91d295d7b67c220b0fea056a061` |
| `apps/web/src/server/cms-composition-platform-related.ts` | 230 | `1a7fd6a7a2cf9331eb0df97f2042996b9fefed9e18ec7c7c564429a78ed861f4` |
| `apps/web/src/server/cms-composition-platform-mutation-error-relay.test.ts` | 256 | `41dbb2d7d2928cf286134f5f03073d54cf59a15c6cb737b0dd69669302165828` |

`taxonomy-safe-details.ts` (under independent re-review): SHA-256 before `8d46d5734e764aaadbcaff9b6cb53f9614e4127c2b9a500040494b0a622a7eb3` (74 lines),
after `38ed63a0b710b86e4051f9c85f2f5e647e3ef253846eccb5e4f73c03e0445e0c` (72 lines). The only change is the 403 branch: the four-line
`CAPABILITY_REQUIRED` ternary became a comment line plus `if (status === 403) return {};`. (File is untracked, so no git diff exists.)
Not hash-listed but modified: none other. `locale-routes-support.ts` gained one import line.

## Runs
Clock: all times UTC 2026-10-15, `date -u`.
| what | result |
|---|---|
| RED worker `capability-missing-refusals.test.ts` | 19 failed / 16 passed (right reasons) |
| RED worker `pattern-instance-reasons.test.ts` | 1 failed / 13 passed |
| RED web `cms-composition-platform-capability-missing.test.ts` | 10 failed / 25 passed |
| pin tests (finding 1 rows, finding 5 composed) | green on arrival, as expected for regression pins |
| after GREEN: worker `cms-composition` + production pattern | 87 files, 2185/2185 (before oracle corrections: 4 failed = the pinned oracles listed under Test corrections) |
| after GREEN: web `server/cms-composition*` + `pages/api/v1/cms` | 27 files, 210 tests; 1 failed before the oracle correction, then `server/cms-composition` 10 files 112/112 |
| full Worker `vitest run apps/worker` (08:58Z) | 649 files, 11,306/11,306 |
| full Web `vitest run apps/web` (09:05Z) | 498 passed / 1 failed of 499 files; 6,016 / 6,017 tests. Failure `components/step-up-required.inventory.test.ts`: the 7 unclassified readers are all `cms-taxonomy-*` (`components/cms-taxonomy-designer/*`, `components/cms-taxonomy-terms/taxonomy-terms-read.ts`, `server/cms-taxonomy-platform-details.ts`): the Web taxonomies lane's files, none touched here |
| `tsc --noEmit` apps/worker | 0 errors |
| `astro check` apps/web | 0 errors, 0 warnings, 175 hints (pre-existing) |
| eslint `--max-warnings=0`, prettier `--check`, `git diff --check` on the 25 touched code/test files | clean |
All Vitest under `flock -s /tmp/wejammin-quiet.lock`, pinned PATH.

## Test corrections
All spec-cited (BE03c 1304; CMS-03C-01/-04/-05 contract lists, `refusals.ts:116-202`; `refusals.test.ts:203-212`). None weakened: each token swap keeps the
assertion and the drop of the old token is now asserted in the two new suites.
- `apps/worker/src/cms-composition/locale-routes.test.ts:421` fixture `reasonCode: 'CAPABILITY_REQUIRED'` -> `'capability_missing'`; `:448` expected `details.reasonCode` `'CAPABILITY_REQUIRED'` -> `'capability_missing'`.
- `apps/worker/src/cms-composition/related-content-errors.test.ts:92` and `related-content-envelope.test.ts:109`: expected `details: { reasonCode: 'CAPABILITY_REQUIRED' }` -> `{ reasonCode: 'capability_missing' }` (route-local 403s).
- `apps/worker/src/cms-composition/taxonomy-term-details.test.ts` (last `describe`): "the shared BE00 allowlist keeps the pre-contract 403 token for its other consumer" replaced by "names no 403 token": `safeDetails(403, CAPABILITY_REQUIRED)` `{reasonCode:'CAPABILITY_REQUIRED'}` -> `{}`, plus `capability_missing` and `other` -> `{}`, plus the unchanged `taxonomyTermDetails(403, ...)` -> `{}`. The "other consumer" was the pattern-instance fallback, now explicit `{}`.
- `apps/web/src/server/cms-composition-platform-mutation-error-relay.test.ts` 403 row: upstream/expected `{ reasonCode: 'CAPABILITY_REQUIRED' }` -> `capability_missing`; added a row pinning upstream `CAPABILITY_REQUIRED` -> `{}` (the existing `{reasonCode:'private'}` -> `{}` row kept).
- Added tests (not corrections): `capability-missing-refusals.test.ts`, `cms-composition-platform-capability-missing.test.ts`, `cms-composition-production-pattern-composed.test.ts`, 3 rows in `pattern-instance-reasons.test.ts`, 8 checks (4 rows x 2 tokens) in `cms-composition-production-pattern-reasons.test.ts`.

## Spec citations
BE03c 1304 ("Slice 12 typed refusals": one lowercase 403 token, `capability_missing`), BE03c 378 (placement guards), `refusals.ts:116-202`, `refusals.test.ts:203-212`,
FE03 1112, BE00 step 7 (capability precedes quota and the port; proved by the throwing ports in the new Worker suite), review-hardening-3 findings 1, 2, 5.

## Open items / BOUNDARY
1. Full-Web failure is `step-up-required.inventory.test.ts` due to the Web taxonomies lane's new `cms-taxonomy-*` readers (above). Not this lane.
2. `apps/worker/src/cms-composition/taxonomy-routes.ts:63` (origin-failure 403 on the taxonomy reads) answers `failure(403)` with `{}` details; the taxonomy reads `cmsTaxonomyVersionsRead`/`cmsTaxonomyTermsRead` list `capability_missing`. That file and the taxonomy Web relays belong to the taxonomies lanes; I did not check whether a capability-gate 403 exists there for the reads.
3. Out of scope and unchanged: `pattern-update-details.test.ts:50` and `cms-composition-production-pattern-update-failure.test.ts:77` (CMS-03C-15) already assert `CAPABILITY_REQUIRED` is dropped.
4. File-size notes (pre-existing): `locale-routes.test.ts` 889 lines (limit 400), `cms-composition-platform-mutation.ts` 321 (limit 300; this lane reduced it by 2).
5. Finding 4 (triplicated token/status/list predicate) is now four-fold (Worker `capability-details.ts`, Web `cms-composition-platform-capability.ts`, plus the per-operation pattern copies). Needs a contract helper `cmsSlice12OperationReason(operationId, status, value)` when contracts open; contracts frozen here.

## Requests to root
- `apps/web/src/server/README.md:170-171` still says "the named private insertion RPC is not yet implemented"; `cms_insert_pattern_instance` is promoted (`20261014110300`). The Web taxonomies lane holds that file: have it drop or restate the sentence. Also add one sentence there naming `cms-composition-platform-capability.ts` (the single 403 filter of the template, locale and related relays).
- Independent review of this lane (focus: `forbiddenDetails` list semantics, the `taxonomy-safe-details.ts` 403-only change, and that no first-party 03c consumer relied on the old token).
- Tell the Web taxonomies lane about Open item 1.
