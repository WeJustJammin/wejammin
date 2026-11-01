# Lane report: claude_s12_hardening_5

## Status
GREEN for this lane's scope (2026-10-15T12:24:08Z). Gates: full Worker green; full Web has one failure and astro check one error, both in other lanes' files (Open items 1-2). HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. Nothing under supabase/**, packages/contracts touched.

## Scope
Brief `briefs/hardening-5.md` items 1-7 over review-hardening-4 (VERDICT CLEAR) minors F1-F5.

## Progress
- Item 1 (F1) DONE. `forbiddenDetails` takes no HTTP status: its "403" gate is `cmsSlice12ReasonStatus(token) === 403` (the token must be a 403 token),
  which is what the review's fix asks to pin (the brief's "non-403 status" wording is the same thing read the other way: the token, not the HTTP status). Each of
  the five routes/relays gained one row: a token on the operation's list whose contract status is not 403 (`block_registry_digest_mismatch` for CMS-03C-01 and both
  template reads, `locale_limit_reached` for 03C-04, `derived_rule_unknown` for 03C-05) on a 403 must relay `{}`. Worker 35 -> 40 rows, Web 35 -> 40 rows.
  Green on arrival (regression pins); mutation proof (scratch only, below) shows each row fails when the gate is removed.
- Item 2 (F3) DONE, RED then GREEN. New describe in both suites: widens CMS-03C-01's live row with `separation_of_duties` for one test (try/finally), then
  asserts define route relays it, detail read relays `{}` (RED before the fix: both apps, 1 failed each), context read follows 03C-01. GREEN: Worker
  `template-respond.ts` `errorResponse(..., additionalHeaders?, operationId = 'CMS-03C-01')` and `safeDetails(status, source, operationId)`; `template-detail-routes.ts`
  passes `cmsTemplateLatestRead`. Web `forwardedError(request, upstream, operationId = 'CMS-03C-01')`, `safeDetails(..., operationId)`; `cms-composition-platform-detail.ts`
  passes `cmsTemplateLatestRead`. Comments of both `capability` modules corrected.
  **Context read has no contract row**: `error-catalog.ts:96-97` leaves `cmsTemplateContextRead` out deliberately and `refusals.ts` `CMS_SLICE_12_OPERATION_REASONS`
  has no key for it, so I did not invent one; it keeps following CMS-03C-01 (pinned by a characterization row, documented in the module comment). If root wants it
  independent, contracts need a row first.
- Item 3 (F4) DONE: `taxonomy-term-details.test.ts` gained `describe.each(CMS-03C-13/14/15) untyped 403` (pre-contract token, foreign member, no token) asserting `{}`
  from `safeDetails(403, ...)` (the taxonomy-safe-details layer) and from `patternUpdateDetails(op, 403, ...)`. 9 rows. Mutation proof below.
  **Side-effect disclosure**: the 403-only change in `taxonomy-safe-details.ts` (hardening-4) altered the wire of CMS-03C-13/14/15 for any untyped 403 (a session-port
  403 `{reasonCode:'CAPABILITY_REQUIRED'}` was relayed before, `{}` now), which is the BE03c 1323-correct result. Since the Worker pattern-updates lane,
  `pattern-update-details.ts:44` routes 403 through `forbiddenDetails(operation, source)` first, so that branch of `taxonomy-safe-details.ts` is no longer reached by
  13/14/15; its remaining consumers are `taxonomy-term-details.ts:62` (explicit `{}` for 403) and `taxonomy-responses.ts` (CMS-03C-03 route). The test pins both layers.
- Item 4 (F2) DONE: `apps/worker/src/cms-composition/README.md` capability-details paragraph now lists the real users (template routes via `template-respond.ts`,
  locale via `locale-routes-support.ts`, CMS-03C-13/14/15 via `pattern-update-details.ts`) and says related-content filters its own 403 in `related-content-details.ts`.
  The review's second false pointer (`pattern-update-details.ts` "403 goes through `capability-details.ts`") is **now true** (the pattern-updates lane added the import),
  so the sentence stays. Item 7 DONE: the "selector read and linked-update authority still await locked contract decisions" sentence now points at the separate
  CMS-03C-12, -09, -13/-14/-15 routes and says this route is only the CMS-03C-02 insertion boundary. README also documents the locale test split.
- Item 5 DONE (pure moves): see Split.
- Item 6 DONE: see Investigation.

## Split (item 5)
`apps/worker/src/cms-composition/locale-routes.test.ts` 889 lines -> `locale-routes.test.ts` (240), `locale-routes-refusals.test.ts` (293),
`locale-routes-binding-and-order.test.ts` (306), `locale-routes.test-support.ts` (96; the shared top-level fixtures, `export` added). Tests before 35, after 35; the
sorted list of "describe > title" names is identical (JSON reporter, `locale-before-names.txt` vs after). Test bodies were cut by line range; only import lines and `export`
on the fixtures differ; prettier reformatted import lists only. Describe titles kept; the one `CMS-03C-04 locale authoring route` describe now spans three files.
`apps/web/src/server/cms-composition-platform-mutation.ts` 321 -> 294 by moving `SchemaIssue` + `violationsOf` (the RFC 6901 violation builder, one concern) into
`cms-composition-platform-mutation-violations.ts` (36); existing Web suites unchanged and green (mutation, error-relay, key-reserved, fail-closed, forward).

## Investigation (item 6, read-only): CMS-03C-01 and `block_registry_digest_mismatch`
Spec REQUIRES it. BE03c `03c-composition-taxonomy-localization.md`: line 323-327 ("a well-formed digest that differs from the recomputed one writes nothing and is 409
with the closed `details.reasonCode` `block_registry_digest_mismatch` on CMS-03C-01 (`TEMPLATE_VERSION_CONFLICT`), CMS-03C-02 and CMS-03C-12 (`COMPOSITION_VERSION_CONFLICT`) (DEC-186)"),
373 (route field matrix, CMS-03C-01: "409 `block_registry_digest_mismatch`; DEC-186"), 1273 (CMS-03C-01 conflict column), 1323 (token listed under 409 "on CMS-03C-01,
CMS-03C-02 and CMS-03C-12"). DEC-186 (`decisions.md:2677`, item 2): "a differing digest is 409 with the new closed token block_registry_digest_mismatch (the shipped
CMS-03C-01 SQL already behaves so) for CMS-03C-01, -02 and -12". Contract: `refusals.ts` lists it under `'CMS-03C-01'`.
Actual state: DEC-186's parenthesis is half true. The shipped producer (`20261013100200_cms_define_template_per_owner.sql:138-141`, same in `20260927200000:443-446`)
refuses a differing digest with `raise exception 'CONFLICT' using errcode = 'P0001'`: a 409-class refusal but the generic token, not `block_registry_digest_mismatch`
(only the pattern producers `20261014020400:251-252` and `20261014110300` raise the typed token with DETAIL `["/blockRegistryDigest"]`). The existing oracle
`supabase/tests/phase_02_slice_12_template_authority.sql:426-427` asserts message `CONFLICT` ("refuses caller digest that differs"), which contradicts the spec lines above.
Worker: `cms-composition-production-template-errors.ts` types only `key_reserved`; `template-respond.ts` 409 relays the version pair only; Web `safeDetails` 409 likewise.
Recommendation (needs a root/SQL lane, I did not change SQL): (1) fix-forward migration redefining `platform_private.cms_define_template` (and its `platform_api` wrapper if it
re-raises) to `raise exception 'block_registry_digest_mismatch' using errcode='P0001'` at the digest check; (2) correct the pgTAP oracle at `:426-427` (spec-cited, strengthening);
(3) Worker: map the exact `P0001`/`block_registry_digest_mismatch` pair in `mapTemplateRpcFailure` to 409 `VERSION_CONFLICT` with `reasonCode`, and let `template-respond.ts` 409 relay
`reasonCode` when the token is on the operation's row and 409; (4) Web `safeDetails` 409 and the template designer's conflict handling likewise; (5) tests in all four layers.
Until then CMS-03C-01 answers 409 without the closed token while the contract/FE03 list it: a spec gap in the implementation, not a doc gap.

## Files
| path | lines | SHA-256 |
|---|---|---|
| `apps/worker/src/cms-composition/capability-details.ts` | 37 | `6b93f780be32c709d2b7c10a82771b390ddb50244e521b8e908d925b96e44f1a` |
| `apps/worker/src/cms-composition/capability-missing-refusals.test.ts` | 350 | `492b6e5ec4eff02cb9a3b8e462bd8358a3d60480c55501c9d86ad01db13c6ebb` |
| `apps/worker/src/cms-composition/template-respond.ts` | 151 | `0a67b34879bb2997727e202c464435d25ad5cef5c781f0f58ad57ff0b5fc79ab` |
| `apps/worker/src/cms-composition/template-detail-routes.ts` | 223 | `65c7b92d2ba6cedf4adb60b847b33cfe228111feb5daff1dc7255de222f2ab43` |
| `apps/worker/src/cms-composition/taxonomy-term-details.test.ts` | 238 | `e3185cabe198143f3d999724ff3a260dc2c2217efcea2238305b9f2cb84392b1` |
| `apps/worker/src/cms-composition/README.md` | 163 | `08e8d17f8f7553fa4167d97091b49de1fa22f7eec35bc4bc75434828ec602769` |
| `apps/worker/src/cms-composition/locale-routes.test.ts` | 240 | `47cbe6b50a1112e787392cc7fcc0e193bba648ac504f768630df17cd5be7ca07` |
| `apps/worker/src/cms-composition/locale-routes-refusals.test.ts` | 293 | `ffc97b767746308b8b23210a2a1946b5751dc0ada7afbd46367a4b0f09498c25` |
| `apps/worker/src/cms-composition/locale-routes-binding-and-order.test.ts` | 306 | `7edfcd012d3cdb5984eae43489def850fe5b3e4e5f7c2c221c2b23600b11bf7f` |
| `apps/worker/src/cms-composition/locale-routes.test-support.ts` | 96 | `331e67878856274f30bc627438386737d4be24a1ec542bf6c6124f7c368e8640` |
| `apps/web/src/server/cms-composition-platform-capability.ts` | 38 | `dfaa09e777d9b482ee8eb14398f66ab6d30d4ee89b4f7b5db511f98bc07f5952` |
| `apps/web/src/server/cms-composition-platform-capability-missing.test.ts` | 251 | `f710beaf8ef45325026feb948d695ef6d07e74761618aa222cb5ab6f231db644` |
| `apps/web/src/server/cms-composition-platform-mutation.ts` | 294 | `849c885e6466f4e189e2e01c4fae81af284cb5641eadd5334113cd2f58fa6ad1` |
| `apps/web/src/server/cms-composition-platform-mutation-violations.ts` | 36 | `3f30216c664d6aa2c52e6f1303abc47becee842ef85968f979f3b8518d9fbe4c` |
| `apps/web/src/server/cms-composition-platform-detail.ts` | 60 | `30bd210099a8a327a4caad820fd8549efe7b12a1b9fa1ad0228bef7539365168` |

Prior hashes (hardening-4 report) for files changed here: `capability-details.ts` 5f7905a4..., `capability-missing-refusals.test.ts` 7c5d4105... (271 lines), `template-respond.ts` 4f8c26ec..., `template-detail-routes.ts` 1489bdaa..., `taxonomy-term-details.test.ts` 733ded68..., `locale-routes.test.ts` 32167b8d... (889 lines), Web `-capability.ts` ba1e053d..., `-capability-missing.test.ts` f6c0cae9..., `-mutation.ts` 938f89c6... (321 lines); `-detail.ts` 6a2d2cb4... (read at start); `README.md` was already changed by the pattern-updates lane (455cb386... when I started).
`capability-details.ts` and Web `-capability.ts` changed in the doc comment only.

## Runs
Clock: `date -u`, 2026-10-15. All Vitest under `flock -s /tmp/wejammin-quiet.lock`, pinned PATH. No DB runs.
| clock | what | result |
|---|---|---|
| 11:54Z | Worker `capability-missing-refusals.test.ts` +5 rows: green on arrival 40/40; scratch mutants (status gate removed from `forbiddenDetails`; from related `typedReason`) | 5 failed / 35 passed: exactly the 5 new rows (all 5 routes) |
| 11:54Z | Web `-capability-missing.test.ts` +5 rows: 40/40; scratch mutant (gate removed from Web `forbiddenDetails`) | 5 failed / 35 passed: exactly the 5 new rows |
| ~11:56Z | RED F3 (3 rows added to each suite) | Worker 1 failed / 42 passed; Web 1 failed / 42 passed: detail read relayed `separation_of_duties` (right reason) |
| 11:56Z | GREEN F3: Worker `capability-missing`, `template*`, `pattern-update*` | 13 files, 404/404 |
| 11:56Z | GREEN F3: Web `server/cms-composition*` + `pages/api/v1/cms` | 27 files, 218/218 |
| ~11:58Z | F4 rows in `taxonomy-term-details.test.ts`: green 27/27; scratch mutant (old `CAPABILITY_REQUIRED` relay restored in `taxonomy-safe-details`) | 4 failed / 23 passed (the old safeDetails row + the 3 new pre-contract-token rows) |
| ~12:00Z | split: `locale-routes*.test.ts` JSON reporter | 3 files, 35/35; sorted "describe > title" list identical to the pre-split list (35) |
| 12:01-12:13Z | full Worker `vitest run apps/worker` | 670 files, 11,904/11,904 |
| 12:13-12:20Z | full Web `vitest run apps/web` | 519 passed / 1 failed of 520 files; 6,302 / 6,303 tests. Failure: `components/step-up-required.inventory.test.ts` (Open item 1) |
| 12:21Z | `tsc --noEmit -p apps/worker` | exit 0 |
| 12:22Z | `astro check` apps/web | 1 error, 0 warnings, 180 hints, 1947 files; the error is `components/cms-taxonomy-pages/taxonomy-filter-roundtrip.test.tsx:74` (Open item 2) |
| ~12:10Z | eslint `--max-warnings=0`, `prettier --check`, `git diff --check` on the 14 touched code/test files (+ README prettier) | clean |
Scratch mutants live only in `<scratchpad>/claude_s12_hardening_5/mut-*` (a vitest config with a `resolveId` plugin redirecting one module to the mutated copy); no production file was mutated. The tsc check caught `CMS_SLICE_12_OPERATION_REASONS[...] as string[]` (readonly tuple) in my first F3 tests: fixed with `as unknown as string[]` and a comment, re-run green.

## Test corrections
None. All changes to existing test files are additions (rows, a field on the Route/Relay tables, a new describe) or the pure-move split. No assertion in an existing test was edited, weakened or removed.
The only edit to an existing fixture shape: the `Route` (Worker) and `Relay` (Web) tables gained the `offStatusToken` field.

## Corrections (hardening-5)
Corrections to hardening-4 report wording (review-hardening-4 findings 4 and 5):
- "every 03c operation gives its 403 exactly one token, `capability_missing`" (Scope, and the code comments of `capability-details.ts` / Web `-capability.ts`) was an overstatement: CMS-03C-06/-07 also publish `separation_of_duties` (`refusals.ts:144-157`, BE03c 1323). The template, locale and related-content operations publish `capability_missing` alone. The code is list-driven; both comments are corrected (and now cite 1323, not the drifted 1304).
- The composed test `cms-composition-production-pattern-composed.test.ts` injects `resolveSession` as well as the rate limiter (`:40-43`, honoured at `cms-editorial-production-session-resolver.ts:64`), not "injected rate limiter only". The seam under test (real adapter + real route, fetch double at the network edge) is unchanged.
- "The 'other consumer' was the pattern-instance fallback" was incomplete: `pattern-update-details.ts` also fell back to the shared `taxonomy-safe-details.ts` for an untyped 403, so CMS-03C-13/14/15 changed on the wire too (a session-port 403 `{reasonCode:'CAPABILITY_REQUIRED'}` was relayed, is `{}` now; BE03c 1323-correct). Open item 3 of that report cited `pattern-update-details.test.ts:50` and `...-pattern-update-failure.test.ts:77` as already dropping the token: those rows are a 409 and the production 500 mapping, not the 403 relay. Now pinned by the F4 rows above.

## Spec citations
BE03c 1323 ("Slice 12 typed refusals"; drifted from "1304"), 323-327, 373, 1273 (digest token on CMS-03C-01), DEC-186 (`decisions.md:2677`), `refusals.ts:94-102` (one status per token), `refusals.ts:116-202` (operation rows incl. `cmsTemplateLatestRead` at 199), `error-catalog.ts:96-97` (context read has no row), review-hardening-4 findings 1-5.

## Open items / BOUNDARY
1. Full-Web failure `components/step-up-required.inventory.test.ts`: seven readers unclassified, now `components/cms-related-content/{CmsRelatedStatus.tsx,related-candidates.ts,related-content-submit.ts,related-status-copy.ts}` (the four taxonomy ones from last run are now classified): another lane's files (a related-content Web lane). Not touched here.
2. `astro check` 1 error: `apps/web/src/components/cms-taxonomy-pages/taxonomy-filter-roundtrip.test.tsx:74` (TS2352 cast), Web taxonomies lane. None of my files.
3. `cmsTemplateContextRead` has no contract row (see Progress item 2): it follows CMS-03C-01. A contracts row would be needed to make it independent; I did not invent one.
4. Item 6 gap (CMS-03C-01 does not raise `block_registry_digest_mismatch`; see Investigation): needs a SQL fix-forward lane plus Worker/Web mapping; oracle `supabase/tests/phase_02_slice_12_template_authority.sql:426-427` asserts the generic `CONFLICT`.
5. `forbiddenDetails` is still duplicated Worker/Web (contract helper `cmsSlice12OperationReason(operationId, status, value)` remains the cure when contracts open; unchanged from hardening-4 Open item 5).
6. The F3 tests widen the live `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-01']` array for one test (try/finally restore, vitest isolates modules per file). If contracts ever freeze that table at runtime, those two describes must switch to `vi.mock`.

## Requests to root
- Run the canonical gates; the only red items I saw belong to other lanes (Open items 1-2).
- Decide who owns the item 6 fix (SQL migration + Worker `mapTemplateRpcFailure`/`template-respond.ts` 409 + Web `safeDetails` 409 + oracle correction).
- `apps/web/src/server/README.md` (Web taxonomies lane): hardening-4's request still stands (name `cms-composition-platform-capability.ts`; the capability filter now takes an `operationId`, and `cms-composition-platform-mutation-violations.ts` is new).
