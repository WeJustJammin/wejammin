# Lane claude_s12_pwfix6 report

## Status
GREEN on the lane's own checks (focused Vitest, eslint, prettier); full `apps/web` + `tests/e2e/support` Vitest result recorded
under Runs. Browser suites NOT run (forbidden): root runs them. HEAD cd89d54c.

## Scope
A. Harness: `cmsTemplate` and `cmsLocale` of the real-route API Worker are session-routed (Slice 11/12 claims -> PRODUCTION
   `createProductionCmsTemplateDependencies` / `createProductionCmsLocaleDependencies` with the `s12-real-governed.ts` options;
   every other request -> the unchanged fixture port).
B. Product: one shared `cmsRedirectResponse(location)` (303 + `Location` + `Cache-Control: no-store`) beside
   `cmsEditorialSignInRedirect`; every `Astro.redirect(...)` in `apps/web/src/pages/app/cms-content-modeling/**.astro` replaced.
C. pw5 failure re-read (below).

## Design (A)
New `tests/e2e/support/s12-real-template-locale.ts` (`createS12RealTemplate`, `createS12RealLocale`). The home is chosen once in
`resolveSession` (`claimsOf(request) === null` -> fixture; else production) and remembered in a `WeakSet<Request>`; the port calls
`rateLimit`, `defineTemplate`, `readContext`, `readLatest` (template) and `rateLimit`, `authorLocale`, `readLocaleVariant`
(locale) follow the request's home, exactly as `createS12RealRegistry`. `humanOrigins` is the union of fixture and production
origins; `now` and `telemetry` stay the base's (telemetry events carry no request). `claimsOf` and `options` in
`s12-real-governed.ts` gained `export` (nothing else changed there but a comment). Wired in `content-schema-registry-api.ts`
`appFor` (only when the launcher has a Supabase stack, like the other production boundaries).

Observation: `cms-locale-fixture.ts` has no `readLocaleVariant` member (the e2e tree is not type-checked), so a fixture session
reading a locale variant has always hit `undefined`. Not changed (fixture seam untouched); real sessions now have a read.

## Pages changed (B) - all 23 `.astro` files under `apps/web/src/pages/app/cms-content-modeling/`
`capability-grants`, `index`, `[contentTypeId]/versions/[versionId]`, `schema-reviews/[reviewId]`, `definition-reviews/index`,
`definition-reviews/[reviewId]`, `entries/index`, `entries/new`, `entries/[entryId]`, `entries/[entryId]/composition`,
`.../conflicts/[conflictId]`, `.../locales/[locale]`, `.../related-content`, `.../revisions`, `.../workflow`, `patterns/new`,
`patterns/[patternKey]` (that file also carried earlier uncommitted changes from another lane; only the redirect + import are
mine), `reviews/index`, `reviews/[reviewId]`, `taxonomies/new`, `taxonomies/[taxonomyId]`, `templates/new`,
`templates/[templateKey]`. Includes the POST-continuation 303 in `index` and the step-up 303s in `capability-grants`,
`[versionId]`, `schema-reviews` (all now `no-store`; same status and Location). Guard: new
`no-store-redirects.test.ts` fails on any `Astro.redirect(` in the tree and requires the shared import.

## Files (full SHA-256 in `lane-pwfix6-hashes.txt` beside this report)
New: `tests/e2e/support/s12-real-template-locale.ts` (81 lines), `.test.ts` (286), `apps/web/src/pages/app/cms-content-modeling/no-store-redirects.test.ts`.
Edited: `tests/e2e/support/{content-schema-registry-api.ts,s12-real-governed.ts,s12-real-governed.test.ts,README.md}`,
`apps/web/src/components/cms-editorial-pages/cms-editorial-page-outcome{.ts,.test.ts}`, the 23 pages above, route source tests
(`entries/*-route.test.*`, `[entryId]/*-route.test.tsx`, `locales/locale-route.test.tsx`, `reviews/*`, `definition-reviews/*`,
`patterns/pattern-pages.test.ts`, `taxonomies/taxonomy-pages.test.ts`, `templates/template-designer-route.test.ts`) and
`apps/web/src/server/{cms-capability-grant-route-source,content-schema-review-route-source}.test.ts`,
`apps/web/src/components/content-schema-registry/{content-schema-registry-routes.test.ts,content-schema-registry-s09-pre-state.dom.test.tsx}`.

## Test corrections (existing oracles; intent kept, only the redirect spelling)
- `toContain('Astro.redirect(outcome.location, 303)')` -> `toContain('cmsRedirectResponse(outcome.location)')` in the 12 route
  tests above; `not.toContain('Astro.redirect(`')` -> `not.toContain('cmsRedirectResponse(`')` (still: no template-literal location).
- pattern/taxonomy page tests: the exact page line `return Astro.redirect(outcome.location, 303)` -> `return cmsRedirectResponse(outcome.location)`.
- Slice 09 source tests (4 files): `toContain('Astro.redirect')` -> `toContain('cmsRedirectResponse(')`; the `toContain('303')` assertion
  dropped because the status now lives in the helper, which `cms-editorial-page-outcome.test.ts` pins (status 303, Location, no-store);
  the S09 dom regex accepts `cmsRedirectResponse(\`/auth/sign-in?returnTo=${...}\`)`.

## Spec citations
FE03 protected routes `no-store`; Slice 09 precedent `phase-02-slice-09-registry-browser-real-route.spec.ts:303-314` (P2-S09-AC-1067).

## C. Expected pw5 rerun
- AC-105 x2 (`/patterns/new`, `/patterns/:key`: "cache-control undefined, status 200"), AC-058 (locale page): the 200 was the sign-in
  page after the 303; with A the context/locale read reaches production and the page renders, so `no-store` (set on
  `Astro.response`) is present. Expected pass.
- Template-states AC-265 x4 (missing/expired x successor/create): header-only failure; B fixes it. Expected pass.
- AC-176 "a saved pattern is a 403 notice" (received 200): same cause (reviewer session redirected to sign-in). With A the context
  read answers 403 (`cmsTemplateContextRead` requires `cms.template_designer`). RISK for root: the loader lets the pattern's
  own `latest` answer win (`load-pattern-designer-page.ts` ~l.141-147); if the production pattern read conceals a pattern from a
  reviewer as 404 (disclosure-safe) the page renders the 404 copy, not the 403 copy the spec expects. FE03 says "a visible key
  without the capability is a 403"; whether the reviewer's pattern is "visible" is a database answer I cannot run. If rerun
  shows 404, the spec line (definition-pages spec :232-236) or the SQL concealment is the thing to rule on, not the harness.
- AC-273 J2 (`governed-submit` region never appeared): `submitFromPage` opened `/patterns/:key`, redirected to sign-in; same
  cause as AC-105. Expected to pass; nothing in the spec looks wrong beyond that dependency.
- No pw5 spec assertion looked wrong against FE03 other than the AC-176 uncertainty above.

## Runs (Vitest, RED then GREEN)
- RED A: `tests/e2e/support/s12-real-template-locale.test.ts` failed to import the missing module.
- RED B: `no-store-redirects.test.ts` failed for every page (Astro.redirect still present) and `cmsRedirectResponse` tests missing export.
- GREEN: `tests/e2e/support/s12-real-template-locale.test.ts` 8/8; `tests/e2e/support` 5 files 31/31;
  `apps/web/src/components/cms-editorial-pages/cms-editorial-page-outcome.test.ts` 17/17;
  `apps/web/src/components/content-schema-registry apps/web/src/server apps/web/src/pages` 239 files 3440 tests pass;
  `no-store-redirects.test.ts` 48/48. eslint --max-warnings=0 and prettier --check clean on all touched TS/MD.
- FULL RUN (final bytes): `vitest run apps/web tests/e2e/support` 743 files, 8591 tests, all pass (exit 0).

## Open items / BOUNDARY
None. No `git add/commit`. No untracked file was edited in place (the two lane-new files are mine).

## Requests to root
Run (Playwright, real-route): the four pw5 specs (`phase-02-slice-12-{definition-pages,template-states,protected-decision,definition-journeys}-real-route.spec.ts`)
and EVERY other real-route spec, because B changes all CMS pages' redirect responses (and Slice 09/10/11 specs on index,
capability-grants, versions, schema-reviews, entries, reviews, workflow). Also `pnpm lint`/`type-check` (tests/e2e is not type-checked).

## Fix round (review V16-04, V16-05)
Status: GREEN. Browser suites still root's.

1. V16-05, one 303 + no-store builder. `cmsRedirectResponse` no longer has its own body: in `cms-editorial-page-outcome.ts` it is
   `export const cmsRedirectResponse: (location: string) => Response = authPageRedirect;` imported from
   `apps/web/src/server/auth-page-redirect.ts` (the existing builder used by `/step-up` and `/settings/security/mfa`). I kept the
   alias name rather than renaming in the 23 pages because lane unit5's `CmsGovernedReviewQueue.states.test.tsx` (not mine to touch)
   already imports `cmsRedirectResponse`. Every page's `Location` is unchanged (same value; the header name is now lower-case
   `location`, and Headers lookup is case-insensitive). Test: `cms-editorial-page-outcome.test.ts` gains
   `expect(cmsRedirectResponse).toBe(authPageRedirect)`; the existing three assertions on status, Location and no-store stay.
2. V16-04, `no-store-redirects.test.ts` rewritten around a `violations(source)` predicate:
   - forbids, in every page: `Astro.redirect` in any spacing, newline or bracket form (`Astro.redirect (`, `Astro\n.redirect`,
     `Astro['redirect']`), a destructured `redirect` from Astro, `Response.redirect`, a `status: 30x` / `status = 30x`, a 30x number
     passed to `new Response`, a hand-set `location` header;
   - requires, in any page with a redirect signal (`'redirect'` kind, `/auth/sign-in`, `kind === 'unauthenticated'`,
     `stepUpTargetForLocation`), the exact shared import and a call of `cmsRedirectResponse(`;
   - compares the glob with an explicit list of the 23 pages (equality, not `>= 23`) and asserts all 23 call the helper.
   - Inverse probes (synthetic strings, no page edited), each proven flagged: `Response.redirect`, hand-built 302 and 303
     `Response`, `Astro.redirect (` with a space, `Astro\n.redirect(`, `Astro['redirect']`, destructured redirect, a status assignment,
     a hand-set Location header, a redirect without the import, a redirect with the import but another route, a sign-in redirect
     without the helper, a helper imported from the wrong module; plus a clean page that must pass. 39 tests.

### Test corrections (this round)
- `no-store-redirects.test.ts` (my own new file): rewritten as above; stricter, nothing weakened.
- `cms-editorial-page-outcome.test.ts` (my own edit last round): added the identity assertion, no assertion removed.
- No other existing oracle changed.

### Runs
- `vitest run apps/web/src/pages apps/web/src/components/cms-editorial-pages apps/web/src/server apps/web/src/components/content-schema-registry apps/web/src/components/cms-governed-review`: 311 files, 4200 tests, all pass (the last directory is unit5's, run only to prove the alias still serves their test).
- `no-store-redirects.test.ts` alone: 39/39. `pnpm type-check` (tsc --build): exit 0. eslint --max-warnings=0 and prettier --check clean on the touched files.
- The earlier full `apps/web` + `tests/e2e/support` run (743 files, 8591 tests) pre-dates this round; the files changed since are the three below.

### Files changed this round
See `lane-pwfix6-hashes.txt` for the recomputed list (it now covers the whole lane).
