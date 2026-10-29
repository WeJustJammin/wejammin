# Lane `claude_s12_pwfix6` — real-route harness sessions for template/locale reads + no-store on CMS sign-in redirects

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`.
zsh does not word-split; `/bin/ls`, never bare `ls`. Report `docs/handoffs/2026-10-22-claude-s12/lane-pwfix6-report.md`
(checkpoint early). Debug-by-test (RED first). You may NOT run Playwright, db, supabase, docker or races; root runs the browser
suites. Focused Vitest only; repo-wide coverage stays 100%.

## Evidence (root, pw5 run 1, `.lane-logs/canonical/pw5-run1-20261029T044420Z/{pw.log,servers.log}`)

Lane pw5's new specs (`tests/e2e/phase-02-slice-12-{definition-pages,template-states,protected-decision,definition-journeys}-real-route.spec.ts`)
ran 16 passed / 9 failed. Root's diagnosis:

1. `/app/cms-content-modeling/patterns/new`, `/patterns/:patternKey` and `/entries/:entryId/locales/:locale` answered **303 to
   sign-in in ~12 ms with no API request logged** for a signed-in Slice 11/12 session (`servers.log` lines ~9513, ~10497).
   The pattern loader's first read is `cmsTemplateContextRead` (`/api/v1/cms/templates/context`,
   `apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.ts:43-56,140-147`); the locale page reads the locale
   variant. In the real-route API Worker (`tests/e2e/support/content-schema-registry-api.ts`) `cmsTemplate` and `cmsLocale` are
   launcher FIXTURES that do not recognise the Slice 11/12 signed sessions → 401 → the loader's sign-in redirect.
2. Every CMS page returns `Astro.redirect(outcome.location, 303)`, which does not carry the `Cache-Control: no-store` the page
   set on `Astro.response`, so the protected routes' 303 sign-in redirects have no `no-store`. FE03 gives these routes a
   `no-store` policy and the Slice 09 precedent (`tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts:303-314`,
   P2-S09-AC-1067) asserts `no-store` on its 303 to sign-in.

## Work

A. **Harness (test code).** Follow the `createS12RealRegistry` precedent (`content-schema-registry-api.ts`: a request carrying the
   Slice 11/12 claims goes through the PRODUCTION composition; every other request keeps its previous port byte for byte): give
   `cmsTemplate` and `cmsLocale` the same session-routed composition (production `createProductionCmsTemplateDependencies` /
   `createProductionCmsLocaleDependencies` with the `s12-real-governed.ts` options for real sessions; the existing fixtures for
   lane/fixture sessions, so the existing template and locale real-route specs and their fixture seams are untouched). Update
   `tests/e2e/support/s12-real-governed.test.ts` parity and the support README. A Vitest proving the routing (a real-session
   request reaches production, a fixture session reaches the fixture).
B. **Product (web).** One shared helper (beside `cmsEditorialSignInRedirect` in
   `apps/web/src/components/cms-editorial-pages/cms-editorial-page-outcome.ts` or the pages' render path) so every CMS page's 303
   carries `Location` and `Cache-Control: no-store`; replace `Astro.redirect(outcome.location, 303)` in every
   `apps/web/src/pages/app/cms-content-modeling/**.astro` (and the `index.astro` variants). RED unit test first; update the
   existing route source-assertion tests (`*-route.test.tsx` expecting `Astro.redirect(outcome.location, 303)`) to the new form
   in the same change. Name every page you changed.
C. Re-read the other pw5 failures with A and B in mind and say what you expect on rerun: AC-176 "a saved pattern is a 403 notice"
   (received 200), AC-273 J2 (`regionOf(page, 'governed-submit')` never appeared on the pattern page). If a pw5 spec assertion
   is itself wrong against FE03, say so with lines (do not edit pw5's specs; root decides).

## Claim

The harness files named in A (+ support README), the helper and pages in B and their route tests, new test files, your report.
Never edit ledgers, receipts, trackers, specs, migrations, pw5's specs or other lanes' files (lane web6 owns
`apps/web/src/components/cms-composition/**`, `cms-taxonomy-*`, `cms-locale-*` component files — do not touch them).

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, changed files with SHA-256, Vitest runs, what root must
run (the four pw5 specs + every real-route spec, since B changes all CMS pages).
