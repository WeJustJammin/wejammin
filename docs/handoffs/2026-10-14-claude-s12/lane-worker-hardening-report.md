# Lane report: claude_s12_worker_hardening

## Status
GREEN. All four brief items implemented test-first. Full Worker suite 612 files, 10,495 / 10,495 passed (0 skipped, 0 failed);
joint 345 set 345 / 345; `tsc --noEmit` exit 0; eslint `--max-warnings=0` and prettier clean on every touched file.
Worktree HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. No SQL, no contracts, no Web, no shared pgTAP touched; no git mutation.

## Scope
Brief `briefs/worker-hardening.md`, root rulings from `review-governed-worker-fix.md` and `review-governed-worker-p2.md`.
Locale and related-content files were not touched (other lanes).

### 1. Provider-fault guard on every 03c adapter in scope (BE03c 1298-1302)
- New `apps/worker/src/cms-composition-production-failure.ts`: `mapCmsCompositionRpcFailure(status, payload)` = `status < 500 && !carriesProductToken(payload)`
  -> scrubbed `internalError()` (500 `INTERNAL_ERROR`, `{}`), otherwise `mapCmsEditorialRpcFailure` unchanged. 03b semantics and every 03b oracle are untouched.
- Wired into CMS-03C-01 define (`mapTemplateRpcFailure` in `cms-composition-production-template-errors.ts`), `cmsTemplateContextRead`
  (`cms-composition-production.ts`), `cmsTemplateLatestRead` (`cms-composition-production-detail.ts`) and CMS-03C-02
  (`cms-composition-production-pattern.ts`). The CMS-03C-02 pre-mapper `PGRST202 -> 503` stop-gap is removed: `PGRST202`@404 is now 500.
- Taxonomy term action (CMS-03C-03): `cms-composition-production-taxonomy.ts` has no RPC (`actTerm` is a fail-closed `unavailable`), so no provider payload can reach
  it; there is nothing to guard. Recorded, not a gap. The governed (06-11), pattern-definition (12) and taxonomy-definition (16, 17) adapters already carry the guard.
- RED: `cms-composition-production-provider-fault.test.ts` (4 adapters x 15 faults + prose-borrowing case, plus per adapter four product-token controls and a 503 control):
  64 failed / 20 passed against the pre-change code (every failing case answered 401/403/404/409/422/418 or 503 instead of 500; the controls passed).

### 2. Header validation before capability and quota (BE00 386 < 387; BE03c 408, 1502)
- `template-version-routes.ts`, `pattern-instance-routes.ts`, `taxonomy-routes.ts`: the Idempotency-Key / If-Match parse and the If-Match-vs-`expectedVersion`
  agreement now run right after the strict body (step 6) and before the capability check and both quota calls. Body 422 still precedes header 400.
- RED: the three BE00 order suites with the key step moved ahead of `capability` (3 failed: the route answered 403), and the new
  `cms-composition/write-header-order.test.ts` (18 failed / 9 passed): malformed key (missing, <8, >128, non-printable), bad If-Match, caller without capability,
  asserting 400 and `rateLimit` not called and port not called, valid request still reaches the port after two quota calls, valid-header no-capability caller still 403 with no quota.
- New helper `be00-header-order.test-support.ts` (`headersBeforeAuthorization`) reorders the shared `standardMutationSteps` list per route (the shared list is unchanged, locale and related still use it as is).

### 3. 502 `retryable` (BE00 172, 592)
BE00 172 types the `DEPENDENCY_UNAVAILABLE` member `{ dependencyClass, retryable: true, retryAfterSeconds? }` for 502, 503 and 504 alike; BE00 592 defines 502 as "a contacted
dependency returns an invalid response" and gives `Retry-After` only to 429 and retryable 503 (no 502 header, unchanged); BE03c 1274 ("502/503/504 dependencyClass/retryable/...") and the
retry column of every 03c catalog row ("502/503/504: retry at most 3 times") agree. Every 03c 502 envelope said `retryable: status !== 502`; now `true` in `template-respond.ts`,
`taxonomy-responses.ts` (also serves pattern-instance), `pattern-definition-response.ts`, `taxonomy-definition-response.ts`, `governed-review-errors.ts`.
Oracles corrected (see Test corrections). New assertions: pattern-definition and taxonomy-definition malformed-2xx -> 502 `retryable: true`
(mutation: flipping `pattern-definition-response.ts` to false fails 2 tests).

### 4. Governed minors
- OPTIONS: new `governed-review-preflight.ts` registers one `OPTIONS` per distinct governed path from the policy table; CMS-03C-06 and -11 share
  `/api/v1/cms/governed-reviews` and now answer `GET, POST, OPTIONS` with the union of request headers (no If-Match), precedent `cms-editorial/routes.ts:71`; the origin
  refusal is flagged `middleware` so its 403 is published for any path. The three per-operation `app.options` blocks are removed. RED: 2 tests (headers + new queue-path test in `governed-review-reads.test.ts`).
- Registry pin over-claim: `governed-review-registry.test.ts` now also pins `capabilities` (registry list, with an explicit table of the three deliberate no-Worker-gate operations: 08, 10, 11),
  `declared` (literal mirror of the OpenAPI status sets in `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts`) and `pointers` (contract request-schema members); the policy header comment states exactly what is pinned. 36 tests.
- `VERSION_MISMATCH` fixture is now `P0001` + `{"expectedVersion":"3","currentVersion":"99"}` DETAIL (the promoted producers' form) for 07 and 08, with the former `40001` CAS form kept as a second row; both expect 409 `{}` and no `"99"` on the wire.
- Three vacuous replay tests (decision success, decision committed refusal, assignment) now assert byte-identical `p_request` and the same `X-Idempotency-Key` on both calls
  (mutation: adding a random member to `p_request` fails 6 tests). Not removed.

## Files (SHA-256 at report time)
| path | lines | SHA-256 |
| --- | ---: | --- |
| `apps/worker/src/be00-header-order.test-support.ts` | 18 | `4595e11e85cad106b6a50f2977a04277d3bc875be61bca9e9a4abd1b49653fab` |
| `apps/worker/src/cms-composition-production-failure.ts` | 26 | `0e289525a58a69f808ad76571adc1a5b1172abdae79bfcae5a07449c11529355` |
| `apps/worker/src/cms-composition-production-template-errors.ts` | 46 | `db92ec32511409f25a938d4bea764fbc66ed5f708c7c456ee098c29a95a1cc34` |
| `apps/worker/src/cms-composition-production-detail.ts` | 129 | `ba7ea7b6faaddbd0a4814a8f2163faf73ceb1131044abe80db7d62cf16c8b109` |
| `apps/worker/src/cms-composition-production.ts` | 314 | `dd708f2462c37b9d786fdd6de99c427a098a254f8168cce63007b57cc598211d` |
| `apps/worker/src/cms-composition-production-pattern.ts` | 250 | `a22d0a092f56a70e5732afc2c7f433bcbe4ef712b74f71b9232ab047c13fac50` |
| `apps/worker/src/cms-composition-production-provider-fault.test.ts` | 210 | `e609b19a843c2d97d2c1edd30fbc69c0e51d95580904c6d845b563c9eceeb07b` |
| `apps/worker/src/cms-composition-production-pattern.test.ts` | 357 | `fc0e65a7544f03be1e513a80205888a2860337d579836efa3ed75b1456540fdc` |
| `apps/worker/src/cms-composition/template-version-routes.ts` | 259 | `464ebcf8d6ee6d8b34e885df15cc9d12bb8e7a5775eabfc0f9f239ce1f2dfdf6` |
| `apps/worker/src/cms-composition/pattern-instance-routes.ts` | 291 | `2a0c216b0984df8b88754e180005154a78b303bb26b6886f8de43d68a46d0ae2` |
| `apps/worker/src/cms-composition/taxonomy-routes.ts` | 287 | `dc7bbceb5aae7a9174d56a019235700643465436437f879117fc32334804669f` |
| `apps/worker/src/cms-composition/template-routes.test.ts` | 946 | `c683e486675d49f83bcb60f352ccc562aa9937b6da312b6a0ea2f2092768dcfb` |
| `apps/worker/src/cms-composition/pattern-instance-routes.test.ts` | 309 | `07ce4b0f53d86279ba5e617ccdedc9991f17b4931722f38eb259c1b9abe36e8d` |
| `apps/worker/src/cms-composition/taxonomy-routes.test.ts` | 705 | `80d6963184c2bb2123b8d50ad9a44e8604d327f6ca95bf599ed17df25c00a6d4` |
| `apps/worker/src/cms-composition/write-header-order.test.ts` | 352 | `631f01f1b9995a45313f9aa6250a681d54d544c7b4ec6d95dcde36c14b0c6765` |
| `apps/worker/src/cms-composition/template-respond.ts` | 148 | `e38cdf376eb2e239282875c0946dcc4f3c218bd4c32cf403fa8df6819bbe331c` |
| `apps/worker/src/cms-composition/taxonomy-responses.ts` | 131 | `511fc10ce8da12a8aea8a82ff3542a15c4d146e26a59d52f06c5394e52acaffd` |
| `apps/worker/src/cms-composition/pattern-definition-response.ts` | 269 | `7cd52da7724d6f1a27ce1dfecce14e8103525b2520fc6f441885f13da903fd41` |
| `apps/worker/src/cms-composition/taxonomy-definition-response.ts` | 279 | `c64e4a24881834be2615e5385396b8a31c312203c3251499e5e65e66b55d45ad` |
| `apps/worker/src/cms-composition/governed-review-errors.ts` | 186 | `ab6e479d4a04e74a2d4d81e2c41c02a93de067c1680bf881994887cb2e0bbaca` |
| `apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts` | 368 | `a33051a6950fffd67ef2cb737bdbed6d1e09d9519f01c45deb3e66c66c4a13ea` |
| `apps/worker/src/cms-composition/governed-review-decision.test.ts` | 210 | `8ded01cb14c277d74194b262e546b58087f7d32ff270ab4ab0729fd3548fc40e` |
| `apps/worker/src/cms-composition/governed-review-ops-provider.test.ts` | 282 | `57b5afe659f6e52b477d8ad9e22f775d1836ed88315c5f17fc461b5918156cee` |
| `apps/worker/src/cms-composition/pattern-definition-provider-fault.test.ts` | 102 | `06d3943362e2c189c6801ec67bc8077aedbe9522d753a821faafe2e631f6af8e` |
| `apps/worker/src/cms-composition/taxonomy-definition-provider-fault.test.ts` | 96 | `7c1256b93a6e566aa63bd249281f92202a8bfca4c0892263aa7e590dd6f9136a` |
| `apps/worker/src/cms-composition/governed-review-preflight.ts` | 96 | `d37ce6f652b2004a11c34d0b7c4f12e0017f5a4d709c7c0dd027e73c2c560f39` |
| `apps/worker/src/cms-composition/governed-review-routes.ts` | 129 | `1fb277149a7d4d5f3738dd42edcc71120a5aee96dc50fcd82b992ed2d26ee70a` |
| `apps/worker/src/cms-composition/governed-review-read-routes.ts` | 229 | `95e24914d856fc2659bee2d3e2ced6d35d8a6a3861a48c79635dd263765fc5cf` |
| `apps/worker/src/cms-composition/governed-review-command-routes.ts` | 249 | `5fdeef27d0eefbb01823a27b83e3014a88889b3aa79dc6fed1e5c6886b1c022c` |
| `apps/worker/src/cms-composition/governed-review-policy.ts` | 148 | `212223ec747bf1656d06042a94dbe4cd0cd002bceec0fb37b8880e7d4a133f36` |
| `apps/worker/src/cms-composition/governed-review-headers.test.ts` | 124 | `4678d793a13b77763000ddf33cdc04f1f1626bae122210bd45be77f87ed9c42a` |
| `apps/worker/src/cms-composition/governed-review-reads.test.ts` | 293 | `ab088f9d0f01f0b4eec2409743551bdd8f44874ef4efc3a70fdb27febed1cb79` |
| `apps/worker/src/cms-composition/governed-review-registry.test.ts` | 153 | `3828eac72fe4e283135ab2ff696f471caed065272d4b56d131dcaee397dbcf5f` |
| `apps/worker/src/cms-composition/governed-review-ops-tokens.test-support.ts` | 301 | `648f05a3f9780fddbda97e8dbe46b78f206abb25c285a8017087d2e29c5a11bf` |
| `apps/worker/src/cms-composition/governed-review-assignment.test.ts` | 167 | `2464dfa104841337a0a5c6832ce0e76fdc113c470af6dbe8ed614ac905e92219` |
| `apps/worker/src/cms-composition/README.md` | 107 | `9bb07d81300a8e8ece2c04e4c504f9ff2be15017a5b3ccfa2963a33d283c5a79` |

New: `be00-header-order.test-support.ts`, `cms-composition-production-failure.ts`, `cms-composition-production-provider-fault.test.ts`, `cms-composition/write-header-order.test.ts`, `cms-composition/governed-review-preflight.ts`. All other rows are edits.

## Runs (all `pnpm exec vitest run` from the worktree root under `flock -s /tmp/wejammin-quiet.lock`, pinned PATH)
| time (local, minutes marked `x` were not recorded) | what | result |
| --- | --- | --- |
| 16:33 | baseline: cms-composition-production*, template*, pattern-instance*, taxonomy-routes, phase-02 (17 files) | 277 / 277 |
| 16:34 | RED item 1: new `cms-composition-production-provider-fault.test.ts` | 64 failed / 20 passed (84) |
| 16:36 | RED item 2: reordered BE00 order tests, 3 files | 3 failed (key step answered 403) |
| 16:40 | RED item 2: new `write-header-order.test.ts` | 18 failed / 9 passed / 3 skipped (then fixture fix; 3 skips later removed) |
| 16:5x | GREEN items 1 and 2 focused (10 files) | 236 passed, 3 skipped |
| 17:0x | RED item 3: oracles to `retryable: true` over `cms-composition/` (60 files) | 27 failed |
| 17:0x | GREEN item 3 `cms-composition/` | 60 files, 1,482 passed, 3 skipped |
| 17:1x | RED item 4a (2 tests), GREEN governed-review-* (20 files) | 591 / 591 |
| 17:2x | registry (36), ops-refusals (61), decision+assignment (32) | all pass |
| final | joint 345 set (the 11 files of `lane-native-worker-integration-report.md:67`) | 11 files, 345 / 345 |
| final | full Worker suite `apps/worker` | 612 files, 10,495 / 10,495, 0 skipped |
| final | `pnpm --filter @wejammin/worker type-check` | exit 0 |
| final | eslint `--max-warnings=0` on the touched .ts files; prettier `--write` (no diff left); `git diff --check` on tracked touched files | all exit 0 |
One earlier full run (before the final one) showed 3 failures in `async-runtime-outbox-poison.test.ts` and `async-runtime-review-recheck-claim.test.ts`: both files were being edited
by another lane at that moment (untouched by this lane, they passed on re-run and in every later full run).

## Test corrections (for independent review; each cites the spec)
1. `cms-composition-production-pattern.test.ts` (was lines 133-156): `PGRST202`@404 asserted 503 `DEPENDENCY_UNAVAILABLE {retryable:true}`; now 500 `INTERNAL_ERROR` `{}`, same no-leak assertion, retitled.
   Cite: BE03c 1298-1302 and the root ruling (README text updated accordingly). Production change: the pre-mapper `PGRST202 -> unavailable` branch removed.
2. `template-routes.test.ts`, `pattern-instance-routes.test.ts`, `taxonomy-routes.test.ts` (BE00 order suites): `steps: standardMutationSteps(...)` wrapped in
   `headersBeforeAuthorization(...)`, moving the "idempotency key" defect ahead of "capability". Cite: BE00 386 before 387, BE03c 408/1502. No assertion weakened: same defects, same expected statuses, one position changed.
3. `phase-02-slice-12-dependency-unavailable.test.ts`: the two `retryable` expectations on a 502 become `retryableFor(token, status)`: `true`, except the `locale` and `related-content` surfaces which stay `false`
   until root applies the same one-line change to their files (outside this lane). Cite: BE00 172.
4. `governed-review-decision.test.ts` (5 local-502 binding cases) and `governed-review-ops-provider.test.ts` (12 malformed-2xx cases): `retryable: false` -> `true`. Cite: BE00 172.
5. `governed-review-headers.test.ts`: the CMS-03C-06 preflight `access-control-allow-methods` `POST, OPTIONS` -> `GET, POST, OPTIONS` (shared path with CMS-03C-11), plus a header-allowlist assertion. Cite: 03b precedent `cms-editorial/routes.ts:71`, BE00 step 2 ("OPTIONS exposes only registered methods/headers").
6. `governed-review-ops-tokens.test-support.ts`: `VERSION_MISMATCH` fixture `40001` -> `P0001` + JSON DETAIL (the `40001` form kept as an added row). Cite: `20261002202000:34`, review-governed-worker-p2 finding 4.
7. `governed-review-decision.test.ts`, `governed-review-assignment.test.ts`: three replay tests strengthened (additive assertions only).

## Spec citations
BE00 172 (`DEPENDENCY_UNAVAILABLE` member), 386-387 (steps 6, 7), 388 (step 8), 592 (502 definition); BE03c 408 (header validation matrix), 1274 (502 details), 1288-1296 (per-operation catalogs, retry column),
1298-1302 (non-catalog response = scrubbed 500), 1502 (parse -> authenticate -> capability); 03b `cms-editorial/routes.ts:71` (merged preflight).

## Open items / BOUNDARY
- Taxonomy term action (CMS-03C-03) has no production RPC yet; when it gains one it must use `mapCmsCompositionRpcFailure` (README step recorded). Not a stub added here.
- `cms-composition-production.ts` is 314 lines (was 314 before; over the 300 guideline, untouched size). Three route test files exceed 400 lines (`template-routes.test.ts` 946, `taxonomy-routes.test.ts` 705) as before.
- The governed reason-less 409 (`review-governed-worker-p2` finding 3 / BOUNDARY 1) remains a root spec decision; no code change.

## Requests to root
1. Locale lane files: `cms-composition-production-locale.ts` (line ~238 `mapCmsEditorialRpcFailure`) should call `mapCmsCompositionRpcFailure`; `locale-routes-support.ts:116` `retryable: status !== 502` -> `true`.
2. Related-content lane files: `cms-composition-production-related-rpc.ts` (lines ~43, ~73) same mapper swap; `related-content-details.ts:95` `retryable` -> `true`; `related-content-errors.test.ts:233-247` oracle ("treats 502 port failures as non-retryable") -> retryable true.
3. After 1 and 2, delete `STILL_NON_RETRYABLE_502` in `phase-02-slice-12-dependency-unavailable.test.ts`.
4. Locale and related header-before-quota (BE00 386/387): `locale-routes.ts`, `related-content-routes.ts` still validate headers after capability and quota; use `headersBeforeAuthorization` in their order suites.
5. Web mirrors the same `retryable: status !== 502` rule (frozen for this lane): `apps/web/src/server/cms-composition-platform-{mutation,pattern,locale,related}.ts` and their tests.
6. Decide whether `governed-review-preflight.ts` should also advertise `Authorization` on the shared queue path (it does, as the union with the read's allowlist).
