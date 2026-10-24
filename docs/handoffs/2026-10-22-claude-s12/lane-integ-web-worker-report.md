# Lane report: claude_s12_integ_web_worker

## Status
PARTIAL. HEAD b16edb54a7a1b698ed8ca15b6085046d4270626e (no git mutation). Items 1-4, 6, 7 done; item 5 done for every lane-owned file, but
`tests/documentation-boundaries.test.ts` still has 1 failing test because of directories outside this lane's claim (see Requests to root).

## Item 1 - Worker taxonomy-merge regression (DONE)
Reproduction: `pnpm exec vitest run apps/worker/src/production-async-entrypoint-taxonomy-merge.test.ts` = 4 failed / 1 passed
(RPC sequence missing `cms_run_taxonomy_merge_converge`; job settled `failed`, telemetry `DEPENDENCY_UNAVAILABLE`, i.e. the
dispatcher's "effect not wired" guard, `production-job-effect-dispatcher.ts:206`).
True cause: NOT the governed-recheck additions (`async-entrypoint.ts`, `async-runtime-rpc-types.ts` are sound; the CONTEXT_JOB_TYPES
and RPC-name registrations from the taxonomy-terms lane are intact). `production-async-entrypoint.ts` no longer passes
`convergeTaxonomyMerge` to `createProductionJobEffectDispatcher`. `lane-worker-taxonomy-terms-report.md:26,86` records that lane's
version (188 lines, SHA c83b2444...) as wiring it; HEAD never had it (`git log -S convergeTaxonomyMerge` empty) and the governed-recheck
lane's rewrite of the file (190 lines, 22 Oct) was based on HEAD, so the uncommitted wiring was lost (lost update).
Fix (production): import `createTaxonomyMergeConvergeEffect` and pass `convergeTaxonomyMerge: createTaxonomyMergeConvergeEffect(fetchImpl)`
in `production-async-entrypoint.ts`. Test unchanged.
Run: `vitest run apps/worker/src/production-async-entrypoint` -> 5 files, 34/34 (includes taxonomy-merge 5/5, governed-recheck/Slice 11 review-recheck entrypoint suites).

## Item 2 - Reachability (DONE)
RED first: `load-entry-edit-page.links.test.ts` (2 failed: no `translateLinks`), `entry-page-links-route.test.tsx` (suite failed: no
`CmsEntryTranslateLinks`), and the composition lane's block appended to `composition-route.test.tsx` (failed: no link).
GREEN: `load-entry-edit-page.ts` editor view gains `translateLinks` (`localeVariantLinks(entryId, selected.supportedLocales, selected.sourceLocale)`);
new server-rendered `components/cms-locale/CmsEntryTranslateLinks.tsx` (nav aria-label "Translate", one `Translate to {locale}` link each; nothing
when empty); `entries/[entryId].astro` renders the Composition link (`compositionPagePath`) and the Translate nav (page 77 lines, only one `client:load`).
Run: `vitest run apps/web/src/components/cms-editorial-pages apps/web/src/pages/app/cms-content-modeling/entries` -> 29 files, 226/226.

## Item 3 - step-up inventory (DONE)
8 new 401 readers classified `NO_STEP_UP_ROW` with per-group catalog citations (BE03c 222, 1434, 1436, 1437, 1439, 1440, 1441): composition-copy.ts,
composition-transport.ts, server/cms-composition-instances-errors.ts (CMS-03C-02/-13/-14/-15, cmsCompositionInstancesRead: 1434, 1440);
cms-taxonomy-field-connection.ts, cms-taxonomy-selector-read.ts (CMS-03C-17, cmsTaxonomyTermsRead: 1441); CmsLocaleStatus.tsx, locale-variant-copy.ts,
locale-variant-submit.ts (CMS-03C-04, cmsLocaleVariantRead: 1436, 1437). Each file reads 401 only as UNAUTHENTICATED (verified by grep). 5/5.

## Item 4 - bundle budget (DONE)
`scripts/verify-bundle-budget.mjs`: routes `CMS composition` (`entries/[entryId]/composition.astro`, island `CmsCompositionPage`) and `CMS locale variant`
(`entries/[entryId]/locales/[locale].astro`, island `CmsLocaleVariantForm`), both `routeScripts: 'cms-editorial-document'`. `tests/performance`: 10 files, 54/54.
Not run: `pnpm bundle:check` (needs a build; a root gate), so the two new routes are declared but not yet measured against `BUNDLE_BUDGETS`.

## Item 5 - documentation boundaries (PARTIAL: lane-owned parts done)
- `components/cms-locale/README.md`: `## Ownership` added. `components/cms-taxonomy-pages/README.md`: `## Conventions` added.
- `templates/[templateKey].astro` 205 -> 196 lines: the 11-line `unavailableCopy` ternary moved to `components/cms-composition/cms-template-unavailable-copy.ts`
  (+ `.test.ts`, 6 cases, written beside it; the RED run against an absent module was not made separately). Route/governed-mount suites green (39 files, 351/351).
- New READMEs: `pages/api/v1/cms/compositions/README.md`, `pages/api/v1/cms/governed-reviews/[reviewId]/README.md` (3 files, no README).
- Directories still failing the test and NOT in this lane's claim (listed under Requests to root).

## Item 6 - lane-requested READMEs (DONE)
`pages/app/.../entries/[entryId]/README.md` (composition, locales, route tests), `pages/api/v1/cms/patterns/README.md` (selector.ts live, reserved key kept),
`pages/api/v1/cms/README.md`, `pages/api/v1/cms/entries/[entryId]/README.md` (locales read + write), `apps/web/src/server/README.md` (locale-read, list, selector,
diff, update + update-answer, errors), `components/cms-composition/README.md` (unavailable-copy), new `compositions/README.md`.

## Item 7 - FE03 step-up wording (REPORT ONLY; FE03 untouched)
`.memory/wiki/specs/fe/03-cms-content-modeling.md` route-protection rows that say "step-up gates the commits and never the read" for operations whose BE03c catalog has
no `STEP_UP_REQUIRED` (only CMS-03C-07/-08/-09 carry it: BE03c 222, 1439; catalog rows 1434 CMS-03C-02, 1435 CMS-03C-03, 1436-1437 CMS-03C-04/read,
1440 CMS-03C-12..15, 1441 CMS-03C-16/17): FE03 1637 (templates, CMS-03C-01), 1638 (patterns, -12), 1639 (taxonomies, -16/-03), 1641 (composition, -02/-13/-14/-15 + DEC-206 read),
1642 (locale, CMS-03C-04 + DEC-205 read), 1643 (related-content, CMS-03C-05 + read; DEC-195 already corrected BE03c for this). Row 1640 (definition-reviews: -07/-08/-09) is correct.
Row 1644 (capability grants) is CMS-03A, outside this question. A consistent edit is to drop the clause from 1637-1639 and 1641-1643 (or say "no step-up row").

## Out-of-brief type fixes (apps/web tsc was red: 2 errors, test files of retired lanes)
- `components/cms-locale/load-locale-variant-page.read.test.ts`: added `import type { LocalePageReads } from './locale-variant-page-reads'` (TS2304).
- `server/cms-composition-platform-locale-read.test.ts` (~l.135): `vi.fn(async () => ...)` -> `vi.fn(async (input: RequestInfo | URL) => { expect(input).toBeInstanceOf(Request); return ok(...) })`
  (TS2493 on `mock.calls[0]?.[0]`; same shape as the sibling test at l.99; one assertion added, none weakened).
- `production-async-entrypoint.ts` also reformatted by prettier (one call split across lines, from the governed-recheck lane's unformatted line).

## Runs
| Run | Scope | Result |
| --- | --- | --- |
| taxonomy-merge RED | `vitest run apps/worker/src/production-async-entrypoint-taxonomy-merge.test.ts` | 4 failed / 1 passed (before fix) |
| entrypoint GREEN | `apps/worker/src/production-async-entrypoint*` | 5 files, 34/34 |
| items 2 RED | links loader test, entry-page-links, composition-route block | 2 + suite + 1 failing before the code |
| full | `vitest run apps/worker apps/web tests/documentation-boundaries.test.ts tests/performance` (14:00-14:13, JSON at scratchpad `integ-web-worker/full-1.json`) | 1371 files: 1370 passed, 1 failed; 20,368 tests: 20,367 passed, 1 failed (documentation-boundaries "documents every non-generated directory..." ) |
| types | `tsc --noEmit -p apps/worker` 0 errors; `tsc --noEmit -p apps/web` 0 errors; `astro check` 0 errors, 0 warnings, 197 hints | after the two test type fixes |
| lint | eslint `--max-warnings=0` + prettier `--check` on all touched TS/TSX/mjs/astro/md | clean |
The full run predates the two type-only test edits and the prettier reformat of `production-async-entrypoint.ts`; the touched suites were rerun afterwards (locale-read proxy 15/15, cms-locale 13 files 156/156, entrypoint 34/34 before the reformat).

## Files (lines, SHA-256 at report time)
- `apps/worker/src/production-async-entrypoint.ts` 197 `40584eda30e69ae85b0194c1b2c1a11bbc8cb22858e4fce06f76ab0b1f83419e`
- `apps/web/src/components/cms-editorial-pages/load-entry-edit-page.ts` 192 `3d1349b5fd6279e05f49287c34e280a71f07ad77abe027246e0edb30953c6634`
- `apps/web/src/components/cms-editorial-pages/load-entry-edit-page.links.test.ts` 69 `b19b08ca0d26f5e3b4fc12c327020bd2fd98ab1449cb2da0e0af40a0b3eef44a` (new)
- `apps/web/src/components/cms-locale/CmsEntryTranslateLinks.tsx` 28 `67d77066bd77efa3f7bd205e200356c99b5f61e7d0e8a8e51f2a789b24e65460` (new)
- `apps/web/src/pages/app/cms-content-modeling/entries/[entryId].astro` 75 `48568c5a3de1262dae009680cbcf1665047f18b3680c635acc67e113f7c727a3`
- `apps/web/src/pages/app/cms-content-modeling/entries/entry-page-links-route.test.tsx` 71 `dbbf0d494bf555593919f50ccde68b79ee3fa3d1a2c3066b43a38a696e02e247` (new)
- `.../entries/[entryId]/composition-route.test.tsx` 298 `45d999ee7f9534a5f08f2910b001f07f3ca3cda9222e2b25f63458c51d686388`
- `apps/web/src/components/step-up-required.inventory.test.ts` 221 `1914780383d89a2e7fe1db0935773b99bc0e56d65c126c2ce20252d7e124b5f1`
- `scripts/verify-bundle-budget.mjs` 1379 `b5164236380bc53aff22162b3768b0a280554264bccfd4a000af5b18e44fbbb2`
- `.../templates/[templateKey].astro` 196 `cd2c4862fe7ab5016f0773da88013e3fe7920915e194165fc3c304c55b87f22f`
- `apps/web/src/components/cms-composition/cms-template-unavailable-copy.ts` 18 `e40ccbc95510f9a6e402e9f0e694b51c0c40c292aa5a6567161de505c6f3428c` (new) and `.test.ts` 33 `e079d91b0034130225bd260267476c2cd7a6c1c8658e53859220a17c73b66049` (new)
- READMEs: the seven named in Items 5 and 6 (two new: `pages/api/v1/cms/compositions/README.md`, `pages/api/v1/cms/governed-reviews/[reviewId]/README.md`).

## Test corrections
- `step-up-required.inventory.test.ts`: eight added `exempt` entries (additive, cited above).
- `composition-route.test.tsx`: the block the composition lane prepared, appended unchanged.
- No existing assertion weakened or removed.

## Open items
- `pnpm bundle:check` measurement of the two new routes (needs a build; root gate).
- The LANES claim of `claude_s12_integ_contracts` includes `tests/contracts/*`; `tests/contracts/helpers/README.md` is therefore theirs.

## Requests to root
1. `tests/documentation-boundaries.test.ts` stays red until these directories (all outside this lane's claim, all untracked, none a Slice 12 web/worker file) get a README with `## Contents / Ownership / Extension (or Extension rules) / Conventions / Related links`:
   MISSING: `tests/contracts/helpers` (integ_contracts), `tests/native`, `tests/native/fixtures`, `tests/native/helpers`, `tests/observability` (appeared during this run),
   `docs/handoffs/2026-10-12-claude-s12` (+ `lane-l0-logs`, `lane-logs`), `docs/handoffs/2026-10-14-claude-s12` (+ `briefs`), `docs/handoffs/2026-10-22-claude-s12` (+ `briefs`).
   SECTIONS missing: `packages/contracts/src/cms-delivery/README.md` (all five), `infra/database-upgrades/README.md` and `infra/database-upgrades/native-tracing/README.md` (all five; they use a table layout).
   A scan script (the test's own rules) is at scratchpad `integ-web-worker/docs-scan.mjs`.
2. FE03 rows to align with BE03c (Item 7): 1637, 1638, 1639, 1641, 1642, 1643 (see above); 1640 correct.
3. Run `pnpm bundle:check` after a build to measure the new `CMS composition` and `CMS locale variant` routes against `BUNDLE_BUDGETS`.
4. Item 1 cause: confirm the lost update (the taxonomy-terms lane's `production-async-entrypoint.ts` edit was never committed and the governed-recheck lane rewrote the file from HEAD). Other taxonomy-terms registrations remain intact; the full Worker project is green.
5. `scripts/verify-bundle-budget.mjs` page budget for `[entryId].astro` now includes only server-rendered markup for Translate (no new island).
