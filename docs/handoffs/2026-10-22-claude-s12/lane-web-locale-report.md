# Lane claude_s12_web_locale report

## Status
PARTIAL. Everything the brief assigns is built and tested (page, island, loader, reads, transport, refetch, proxy fix,
README, CSS); two spec parts have no served read and are BOUNDARY (SG-S12-05 resolution projection / current translation,
SG-S12-06 author-safe fallback order), and the page-level edit-authority 403 has no dedicated read (SG-S12-07). Vitest only;
no canonical gate was run. Last updated 2026-10-22T06:25Z.

## Scope
Locale variant page `/app/cms-content-modeling/entries/:entryId/locales/:locale` and island `CmsLocaleVariantForm`
(CMS-15 / CMS-03C-04; P2-S12-AC-058, AC-270, AC-282, AC-152 form half, AC-233/234/235 browser halves), wired to the existing
CMS-03C-04 Worker route through the first-party Astro proxy. Nothing outside the claim was edited.

## Files (new unless noted; lines, SHA-256 at 2026-10-22T06:25Z)
| path | lines | sha256 |
| --- | --- | --- |
| `apps/web/src/components/cms-locale/CmsLocaleFallbackOrder.tsx` | 27 | `c3c0d963ec78c18c31069fe5dfcc7e41fb6dd0bdff33e8aa0e3a0d7a0e608a23` |
| `apps/web/src/components/cms-locale/CmsLocaleFieldRow.tsx` | 65 | `5df37904bcb301092334d7f1cfe1223baea76f68b9cb6a6affc0d675427d342f` |
| `apps/web/src/components/cms-locale/CmsLocaleSourceReview.tsx` | 51 | `d1775e3313b3cbe121c95e16fcdbdbdeed09547fa40b0b1190ddfe6493bf3efb` |
| `apps/web/src/components/cms-locale/CmsLocaleStatus.tsx` | 102 | `23c78bd6f9c798f2e93cdca691757afac9889510e4abdc935949719bc79d336e` |
| `apps/web/src/components/cms-locale/CmsLocaleVariantForm.a11y.test.tsx` | 189 | `590e96512b01d292533a919c88a2d7df7a6ec655c4345e9dc9cf38fd2fd899f1` |
| `apps/web/src/components/cms-locale/CmsLocaleVariantForm.refusals.test.tsx` | 267 | `9c14e7e9aa4167226c25eadb9b2d832c77b3f1a2bd0c67d412dfa278b0a4e465` |
| `apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx` | 280 | `e0b41bf0d1826e77e638e71bcd65cd9ac262ac743c048f07c820ee5e3e55b119` |
| `apps/web/src/components/cms-locale/CmsLocaleVariantForm.tsx` | 177 | `8a36e22f89230e2fa80b51b5457d0216d69e17f43a71b72b7ac42a1ce813dede` |
| `apps/web/src/components/cms-locale/README.md` | 82 | `abad987d373bb41b0f1b5c4fe0d37241737ab98acc8783bf62a6d7d1de0cb3a4` |
| `apps/web/src/components/cms-locale/cms-locale.css` | 76 | `59bf7e86ab728272e964e0aa7f5a1fb808565ef2fb2684c51241bb5100f6688c` |
| `apps/web/src/components/cms-locale/load-locale-variant-page.test.ts` | 329 | `e070ed5754e4c49542bb7013ca8fb3324ee898936084714c78ee1d19a808f83a` |
| `apps/web/src/components/cms-locale/load-locale-variant-page.ts` | 260 | `3665f7db267cb50c1f50dd82d6e3ff2150b9e5501bf719b3898e6a3aea9ff988` |
| `apps/web/src/components/cms-locale/locale-resolution-text.test.ts` | 90 | `e1931b48ce06affe6092610b7fa19a3b518b4e95db36a5e29b6ab5a6d4c8225f` |
| `apps/web/src/components/cms-locale/locale-resolution-text.ts` | 42 | `30c98bcef7bd9cf8d29a73f6fe803b1c97cacfd26cadd6f2ab631d097def8008` |
| `apps/web/src/components/cms-locale/locale-source-refresh.test.ts` | 115 | `307185c1986d3261c9181f1be04f8442a8fb8a31f3f2d9e4e4eb8ff0684eb074` |
| `apps/web/src/components/cms-locale/locale-source-refresh.ts` | 135 | `5dc2e98806eb93e98260ee9239e8e9dddae6d285fdbf6c2d74e0dbb46b852649` |
| `apps/web/src/components/cms-locale/locale-variant-copy.ts` | 96 | `d57bcb9c2ae72fdcaf08e3cd644d0984ce8eff8e986312696c625691de8aebe8` |
| `apps/web/src/components/cms-locale/locale-variant-form.test-support.tsx` | 70 | `d6029c783b5e209e18eb2ab44a61b1731fd27f21933d8c31379881d4b0d87707` |
| `apps/web/src/components/cms-locale/locale-variant-links.test.ts` | 41 | `713962b16071dbe52e3ee00305248788ed02b08a57875c14b7b4a25c7414a48c` |
| `apps/web/src/components/cms-locale/locale-variant-links.ts` | 27 | `aa33c6145fdd1cc3bfac3b8b673c640aeb17b51bd11569618e0b0b03429aaf3d` |
| `apps/web/src/components/cms-locale/locale-variant-page-reads.test.ts` | 136 | `e9649a36f4123b4923729cd67a83e660aa06acd184f0b71429c505b111fc7ddc` |
| `apps/web/src/components/cms-locale/locale-variant-page-reads.ts` | 106 | `62f982523a8489c8a46960939268dd0662c4a52d995c564639e3b9f38c045364` |
| `apps/web/src/components/cms-locale/locale-variant-path.ts` | 20 | `49006707c2351b6656544ab85381a1998e3946ec9d10640321a5b37ab9f36145` |
| `apps/web/src/components/cms-locale/locale-variant-request.test.ts` | 146 | `2c21fd2cc561e947867a638575f06be24536f1a7c3738c3c4904aa6fca134d8f` |
| `apps/web/src/components/cms-locale/locale-variant-request.ts` | 148 | `8a9634d1d4ca9d5dd6a3d3d0f1cc83b6e41f5ec3edd4db347d94cb78afdeb724` |
| `apps/web/src/components/cms-locale/locale-variant-static-closure.test.ts` | 58 | `3572315369a5afc84adc9a9a50a6fa386f54f4456677b9144e7b2975465dee72` |
| `apps/web/src/components/cms-locale/locale-variant-submit.test.ts` | 229 | `9c1d8664ed93aa84824334c1aa6ee5f7b33be607ed0420be4dc39329a0b7af4b` |
| `apps/web/src/components/cms-locale/locale-variant-submit.ts` | 205 | `fa5139d09a4d16e547b897d29ce1ec54fb258ca39cfc196344e676a3dbceac01` |
| `apps/web/src/components/cms-locale/locale-variant-types.ts` | 49 | `b69c9e57259e1d7e48b7c9f3993d6df29b630a250c84f560e1fca4b932fd2aab` |
| `apps/web/src/components/cms-locale/locale-variant.test-support.ts` | 84 | `94dc91a8160b0c6d7103189c65cb8dfeec9baf61494bba3339c139b5a25c0c15` |
| `apps/web/src/components/cms-locale/use-locale-source-review.ts` | 80 | `2d6f9fb79a1c079eff8bc39cabfa4241cd84dadd1f8210b87dd8fe487dbafdf1` |
| `apps/web/src/components/cms-locale/use-locale-variant-form.ts` | 242 | `a1e7d9f5d7173fc3ec1a8650a6f47f8b01b0618c5bcc1cab514058c7a8f78e08` |
| `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/[locale].astro` | 74 | `7f3e4a45d9a67ac5abfa7ea9eeec0705e8c1e86869b90784dfe3859dd8efc657` |
| `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/locale-route.test.tsx` | 264 | `a0f893a74e34a6fa7f905dd5c6a04229c12faffc4f8d50dad8494e9ed6bb3664` |
| `apps/web/src/server/cms-composition-platform-locale.ts` | 241 | `ec21ba8ad8e7d9398000b7faa8a45b19ca89fb07d3ee5edba02494d4c530df44` |
| `apps/web/src/server/cms-composition-platform-locale.test.ts` | 361 | `15dd9392c757851569af6456f7470422505c42a0d4461fce102d8134711dd877` |
| `apps/web/src/server/cms-composition-platform-locale.limit.test.ts` | 94 | `5b016702f0829429f3c1fc46f9ea5b6e39e603ce08b705809c4cb41ef6096cbd` |

Edited (not new): `apps/web/src/server/cms-composition-platform-locale.ts` (the worktree already carried other uncommitted
edits; mine is `LOCALE_LIMIT_REACHED` plus its 2-line relay in `safeErrorDetails`) and, untouched by the final state,
`cms-composition-platform-locale.test.ts` (my case was moved to the new `.limit.test.ts` so the existing file stays under 400 lines).

## Runs (focused Vitest, PATH=/home/rob/.local/share/wejammin-toolchain/bin, vitest 4.1.11)
| time (UTC) | what | result |
| --- | --- | --- |
| 06:08 | proxy `[P2-S12-AC-236]` case | RED for the right reason (`reasonCode` dropped by `safeErrorDetails`); fix; GREEN 55/55 over proxy, capability-missing, variants route |
| 06:09-06:14 | request builder, submit transport, resolution text, page reads, loader, source refresh | request: RED = module missing, one oracle of mine corrected (below), GREEN 11; submit GREEN 28; resolution text GREEN 10 (written with its module, no separate RED run); reads 4; loader 17 (later 19); refresh 10 |
| 06:17 | island tests (render, saving, refusals) | RED = component missing; first GREEN run 30/31, the one failure was my own textContent oracle (`dt`/`dd` have no space), fixed in the test |
| 06:18 | axe (5 incl. a negative control), static closure (4) | GREEN |
| 06:20 | route test composed with the real proxies and the Astro-file invariants (11) | RED = `[locale].astro` missing; GREEN after the page |
| 06:21 | mutation check of 9 invariants (loader source-locale head, no_fallback source text, review gate, chain replacement, ETag binding, stale ids on a draft, "(required)", noFallback ids) | 8 killed; 1 survived (`required: false` in the field row) so I added a test that a schema-required field never reads "(required)" and re-ran the mutant: killed |
| 06:24 | final: `apps/web/src/components/cms-locale` + locales page dir + limit test | 13 files, 138 tests pass (new). With the pre-existing proxy/variants-route/capability-missing tests: 16 files, 192 pass |
| 06:24 | `tsc -p apps/web/tsconfig.json --noEmit` | no error in any file of this lane (14 errors elsewhere, all in `cms-composition-instances*`, the other lane) |
| 06:24 | `eslint --max-warnings=0` and `prettier --check` on every lane file | clean |
| 06:24 | guards: `browser-validator-import-boundaries`, `cms-island-static-closure`, `step-up-error-class.cross-surface`, `cms-editorial-bundle-budget-islands` | pass |
| 06:24 | `step-up-required.inventory.test.ts` | FAILS: 8 new 401 mappers unlisted, 3 of them mine (see Requests to root 2) |

## Test corrections
None to an existing oracle. Two oracles of my own were wrong and were changed with the reason: whitespace-only text is a value in
the shared editor semantics (`cmsTextIsEmpty` is exactly `''`), so the "nothing to save" test uses `''`; and a `dt`/`dd` pair has no
separating space in `textContent`, so the version assertion reads the `dd`.

## Spec citations (behaviour to line)
- Page and route (FE03 1073, 1641; AC-270): 303 sign-in redirect, 400 for a malformed id/tag or any query, disclosure-safe 404, 403
  for an entry that cannot be read or translated, locale must be a member of the version's `supportedLocales`, `:entryId`/`:locale`
  only URL state, order never serialized to the URL (`load-locale-variant-page.ts`, tests).
- Title `Translate | WeJammin`, description text (FE03 1641): Astro file test.
- Fallback order read-only `{target}: a → b → default`, submitted unchanged as the equality expectation, replaced by
  `details.activeFallbackChain` on 409 `FALLBACK_CHAIN_MISMATCH` with the exact sentence (FE03 891, 1336-1342).
- `locale_limit_reached` fixed copy and refetch (FE03 891; BE03c 392, 1530): proxy now relays the token; island shows copy, refetches
  the draft detail and holds saving until the person adopts it.
- `no_fallback` never shows another locale's text (FE03 891, 1122, 2710): no status sentence carries locale text, and the source text of a
  `no_fallback` field is never put into the page data; `noFallbackFieldIds` are the schema's `no_fallback` fields (BE03c 385).
- Unknown outcome keeps the `Idempotency-Key` (BE03c 1502); strong `If-Match` = entry `version` = `expectedVersion` (BE03c 215).
- Derived variant state shown after the write (`draft`), `staleFieldIds` marked (FE03 891; BE03c 1532), explicit Revalidate action visible
  whenever a field is known stale.
- Locale configuration: chain `[]` exactly for the default locale (AC-233): loader derives it from the version detail.

## Open items / BOUNDARY
1. **SG-S12-05, resolution projection, derived variant state and the current translation have no served read.**
   Missing spec: a browser read of the CMS-03C-20 projection (per field: `mode`, `outcome`, `provenance`, `resolvedFromLocale`, `stale`,
   `blocking`, `reasonCode`) plus the variant state and the target revision's own values. FE03 891/1122/1549 require the form to show
   them "from the resolver projection"; BE03c 189/191 make CMS-03C-20 internal, "no browser route" (AC-150), and CMS-03B-11 is scoped
   to the draft head's own locale. I did not add a route or contract. Stub: the form takes `resolutions: readonly LocaleResolution[] | null`
   (shape = `LocaleFieldResolutionSchema`) and renders each sentence (tested); the loader passes `null`; the page says the status is
   not available. Sentinel test: `[BOUNDARY SG-S12-05] carries no resolution projection ...`. Tracking issue number: pending root.
   Consequence recorded openly: with no read of the current translation, every save writes exactly the fields sent (the RPC builds the
   new revision from the request only, 20260927580000), so a field left empty is not carried over. The form states this before the first
   save. Precedent: root held the related-content save while its rule was unreadable (SG-S12-03). `saveAllowed` in the loader view is the
   one switch (set it false to hold saves); I left it true because the brief builds the working form. ROOT DECISION NEEDED.
2. **SG-S12-06, the fallback order is only readable through CMS-03A-07.** Admitted for `cms.schema_registry.read` or `cms.schema_designer`
   (`apps/worker/src/content-schema-registry/admission-identity.ts:28`); CMS-03B-14 (author-safe) has no `fallbackChains`. The page reads
   CMS-03A-07 with the draft's `schemaVersionId`/`contentTypeId`; an assigned author without the capability gets the fixed 403 notice
   (test `[SG-S12-06]`). Needs an author-safe read (e.g. `fallbackChains` on the CMS-03B-14 selected type). `BOUNDARY:` comment in the loader.
3. **SG-S12-07, no dedicated edit-authority read for the page-level 403** (AC-270 "a visible target without entry assignment and edit
   authority is 403"). The 403 covers an entry the account cannot read (CMS-03B-11) or cannot author (CMS-03B-14); an account that can
   read but not edit meets the Worker's 403 `LOCALE_FORBIDDEN` on save (fixed copy "Not allowed"). Related content got DEC-195 for this.
4. Fallback-chain drift: the page uses the version the draft was created with; the Worker compares against the ACTIVE version, so a
   successor can make the first save a 409 `FALLBACK_CHAIN_MISMATCH`, which the form handles (order replaced, values kept).
5. Source text is shown for fallback-permitted fields only (FE03 does not require it; it is the translator's reference). The 409 refetch is
   automatic but adoption is explicit ("Use the current source") because a new `sourceHash` stamped on a translation of the old source
   would hide its staleness. FE03 says "render fixed copy then refetches"; this keeps that and adds the gate. Flag if root prefers silent adoption.
6. Localizable fields of a kind CMS-03C-04 cannot write (anything beyond short/long text, boolean, integer, decimal, date, datetime) are listed
   as "cannot be translated on this page yet" (BE03c 20260927580000: `DEPENDENCY_UNAVAILABLE`).
7. Not exercised here: Playwright/hosted browser flows, the `astro check` of the `.astro` file (tsc does not cover it), colour contrast and target
   size (jsdom has no layout; the e2e/manual a11y reports own them). No criterion is ticked by this lane.

## Requests to root
1. **Entry page link (vertical-slice reachability), `apps/web/src/pages/app/cms-content-modeling/entries/[entryId].astro` and the editor view.**
   `localeVariantLinks(entryId, supportedLocales, sourceLocale)` (new, tested, `components/cms-locale/locale-variant-links.ts`) returns the
   links. The data is already parsed in `load-entry-edit-page.ts` as `selected.supportedLocales`/`selected.sourceLocale`. Proposed diff:
   - `load-entry-edit-page.ts`: add `translateLinks: localeVariantLinks(input.entryId, selected.supportedLocales, selected.sourceLocale)` to the
     `editor` view (beside `init`), i.e. `kind: 'editor'; init; translateLinks: readonly LocaleVariantLink[]`.
   - `[entryId].astro` after the Related content paragraph:
     `{outcome.view.translateLinks.length > 0 && (<nav aria-label="Translate"><ul>{outcome.view.translateLinks.map((link) => (<li><a href={link.href}>Translate to {link.locale}</a></li>))}</ul></nav>)}`
   - route test beside it: the editor view carries one link per supported language except the source.
2. **`apps/web/src/components/step-up-required.inventory.test.ts`** (`exempt` map) add, reason `NO_STEP_UP_ROW` (BE03c catalog `cms.03c.locale.v1` has
   no `STEP_UP_REQUIRED`; only CMS-03C-07/08/09 do):
   `'components/cms-locale/CmsLocaleStatus.tsx': NO_STEP_UP_ROW,` `'components/cms-locale/locale-variant-copy.ts': NO_STEP_UP_ROW,`
   `'components/cms-locale/locale-variant-submit.ts': NO_STEP_UP_ROW,`. The same test also lists 5 unlisted mappers from other lanes
   (`cms-composition-instances/*`, `server/cms-composition-instances-errors.ts`, and two `cms-editorial-fields/cms-taxonomy-*` files).
3. **`scripts/verify-bundle-budget.mjs`**, after the `CMS related content` route:
   `{ name: 'CMS locale variant', page: 'entries/[entryId]/locales/[locale].astro', island: 'CmsLocaleVariantForm', routeScripts: 'cms-editorial-document' }`
   and update `tests/performance/cms-editorial-bundle-budget-islands.test.ts` counts if it enumerates routes.
4. **`apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/README.md`**: add a bullet
   `- \`locales/[locale].astro\` - CMS-03C-04 locale variant: translate the localizable fields of one entry into one supported language; the fallback order is read-only text from the protected version detail; BOUNDARY SG-S12-05/06/07 (\`components/cms-locale/README.md\`).`
   and `locale-route.test.tsx` in the list of route tests.
5. **Tracking issues** for SG-S12-05, SG-S12-06, SG-S12-07 (numbers into the `TRACKING:` lines, README and this report) and the ruling on `saveAllowed`
   (open item 1). Suggested decision rows: a CMS-03C-04 companion read returning `LocaleVariantResource` state plus `LocaleFieldResolution[]` and the
   target revision's values to an assigned author/editor (like DEC-195), and `fallbackChains` on the CMS-03B-14 selected type.
6. **Tracker**: `P2-S12-AC-058`, `AC-270`, `AC-282` and `AC-152` stay open (the resolution display, derived state before a save and the edit-authority 403
   wait on SG-S12-05/07). The proxy half of `AC-236` (`locale_limit_reached` relay) is proved by `cms-composition-platform-locale.limit.test.ts`.
7. No Worker, contract, migration or e2e change was made. A Playwright spec for the form (`tests/e2e/phase-02-slice-12-locale-form.spec.ts`) is not in this lane.
