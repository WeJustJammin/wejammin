# Lane claude_s12_gaps_pw5 report

## Status
PARTIAL. Eight page-level and template-state specs plus two lifecycle journeys written, formatted (prettier) and linted (eslint exit 0);
NONE run (this lane may not run Playwright, the stack or db). Every proposal citation is "pending root run".
`tests/e2e/**` is not type-checked by `pnpm type-check`; an ad hoc `tsc` over the four specs reports no error in them (the only
errors are `Cannot find module 'node:crypto'` because no `@types/node` is installed in this worktree, identical to the existing
specs). New specs are NOT registered in the Playwright configs (not in this lane's claim): see Requests to root.

## Scope
pw5 rows of gaps-wave5: AC-042 (focus, render), 058, 075, 093, 105, 111, 129, 164 (x2), 176, 182, 265 (x3), 273.

## Per-row table (outcome: written = spec exists, pending root run)
| Criterion | Clause | Outcome | Identity (file > title) |
|---|---|---|---|
| AC-042 | focus stays until navigation or named result heading | written; NOTE the named result is a polite status region (summaryRef, tabIndex -1), not a heading element | template-states > `[P2-S12-AC-042] a successful successor save keeps focus off every other control while pending, then moves it to the named result` |
| AC-042 | Render authoritative response/version/provenance/next action | written; parent-version provenance is not rendered by the component (FE03 CMS-11 row names version and next action only), the test asserts server id + version + draft state + "Open latest draft" link and that following it edits the saved version | template-states > `[P2-S12-AC-042] a successful successor save renders the authoritative version, the draft state and the next action, and the next action opens that very draft` |
| AC-058 | CmsLocaleVariantForm at /entries/:entryId/locales/:locale | written | definition-pages > `[P2-S12-AC-058] opens /entries/:entryId/locales/:locale and mounts the CmsLocaleVariantForm from the locale variant read` |
| AC-075 | protected decision paths | written (real stack, three people) | protected-decision > `[P2-S12-AC-075] a protected review stays open after the base-slot approval, names the next required slot, and completes with the specialist approval` |
| AC-093 | CmsGovernedReviewDetail at /definition-reviews/:reviewId | written | definition-pages > `[P2-S12-AC-093] opens /definition-reviews/:reviewId and mounts the CmsGovernedReviewDetail evidence for the owner` |
| AC-105 | CmsPatternVersionDesigner at /patterns/new and /patterns/:patternKey | written (two tests) | definition-pages > `[P2-S12-AC-105] opens /patterns/new ...`; `[P2-S12-AC-105] [P2-S12-AC-176] opens /patterns/:patternKey ...` |
| AC-111 | CmsPatternSelector in the insert form at /entries/:entryId/composition | written | definition-pages > `[P2-S12-AC-111] opens /entries/:entryId/composition and mounts the CmsPatternSelector in the instance-insert form` |
| AC-129 | CmsTaxonomyVersionDesigner at /taxonomies/new and /taxonomies/:taxonomyId | written (two tests) | definition-pages > `[P2-S12-AC-129] opens /taxonomies/new ...`; `[P2-S12-AC-129] [P2-S12-AC-182] opens /taxonomies/:taxonomyId ...` |
| AC-164 | disable submission with the sign-in, capability, rate-wait or retry state ... / verification covers each denied or degraded state | PARTIAL: form-level 401/403/429/503, missing form session, 404 closed page, and the 303 redirects written; page-level 403/429/5xx of the two template pages are a BOUNDARY (below) | template-states > `[P2-S12-AC-164] ...` (see list below) |
| AC-176 | cmsPatternLatestRead consumed by designer + panel at /patterns/:patternKey | written, plus the saved-pattern 403 notice | definition-pages > `[P2-S12-AC-105] [P2-S12-AC-176] ...`; `[P2-S12-AC-176] a saved pattern is a 403 notice, not a form, for a session without the template designer capability` |
| AC-182 | cmsTaxonomyVersionsRead consumed by designer + panel at /taxonomies/:taxonomyId | written | definition-pages > `[P2-S12-AC-129] [P2-S12-AC-182] opens /taxonomies/:taxonomyId ...` |
| AC-265 | 303 sign-in redirect for a missing or expired session | written (4 tests: successor/create x missing/expired) | template-states > `[P2-S12-AC-265] [P2-S12-AC-164] a {missing|expired} session on the {successor|create} template page is the allowlisted 303 sign-in redirect and shows no form` |
| AC-265 | `new` never resolves as `:templateKey` | written | template-states > `[P2-S12-AC-265] /templates/new is the create page and never resolves as a template key` |
| AC-265 | Back restores the form without serializing a definition | written | template-states > `[P2-S12-AC-265] Back restores the template form without serializing a definition into the URL, history or storage` |
| AC-273 | end-to-end journeys | PARTIAL, must not close the clause (below) | journeys > `[P2-S12-AC-273] J1 ...`, `[P2-S12-AC-273] J2 ...` |

## Files (path, lines, SHA-256)
- tests/e2e/phase-02-slice-12-definition-pages-real-route.spec.ts, 293, 78195de2a26dc18a2c1f9c9fcb78dd7c61877418c0eda240180ba1fec333fa46
- tests/e2e/phase-02-slice-12-template-states-real-route.spec.ts, 400, 73d4c0837860e9184416af7c4f7e466c5556abbfd30ad9cd9bfd5629352b8ed1
- tests/e2e/phase-02-slice-12-protected-decision-real-route.spec.ts, 158, 04579c21c4784d4616140d85ce4789a9e033496f906eb6ee7d7cdb123e97d611
- tests/e2e/phase-02-slice-12-definition-journeys-real-route.spec.ts, 377, fa744f6c9a40d91353d236b7a7082d249b718cce73d6ca396ce4ec2ea0029198
- tests/e2e/support/s12-pw5-world.ts, 279, 080ee109e524c788f3b84e404708b49f04da75fc28e7c58d2d3644692317f4b3
- tests/e2e/support/s12-pw5-trace.ts, 54, b935669e4f3c961a5f085ad40f2dcd0626fd8672c315410ed43acb09aca2ff59
- docs/handoffs/2026-10-22-claude-s12/recite4/pw5-proposals.json, e6b7a9a7f9d76369eb09ab5fe124e3c07d0659494590f06eba22620264fa0d71
No existing file was edited.

## Runs
None (Playwright / stack / db are not permitted to this lane). Static checks only: prettier --check clean, eslint exit 0 on all six files, ad hoc tsc: no error in the new files beyond the missing `node:crypto` typings.

## Test corrections
None.

## Spec citations
FE03 CMS-11 row (line 1109: focus stays until named result heading; announce version and next action); FE03 1069 (template pages: 303 redirect, `new` reserved, Back restores the form without serializing a definition) and 1066/877 (panel + review link); FE03 1067/1068/1072/1073 (pattern, taxonomy, composition, locale pages); BE03c governed policy basis (migration 20261013300300 line 301: riskClass protected), policy rows `cms.disclosure.policy` (20261002121000 line 80); DB proof of the protected path supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc (R3, R4).

## Open items / BOUNDARY
1. AC-164 page-level 403 / 429 / 5xx notices of `templates/new.astro` and `templates/[templateKey].astro` cannot be induced: the template Worker port in the real-route harness is the test-owned `cms-template-fixture.ts` (fixed capability, answers only 401 for an invalid session, no fault seam) and the page reads are server-side, so the browser cannot intercept them. Needs a fault seam in the fixture / launcher (outside this claim). Covered instead: the form-level 401, 403, 429 (Retry-After 3, disabled then enabled), 503 states, the missing form session (no CSRF cookie, commit disabled), the 404 closed page, the 303 redirects.
2. AC-273 not done: template journey (template routes are fixtures, so there is no governed review of a template version), dependency invalidation returning a subject to draft, linked pattern update accepted and detached, term merged with convergence, locale variant with a `no_fallback` block, related content pinned and excluded, and telemetry capture (only browser requests, URLs, console and storage are scanned). The two journeys written (vocabulary: define, submit, assign, decide keyboard-only at 640x400, schedule, plus activate and retire of a second one; pattern: submit, decide, activate, retire) prove those slices of the clause only. "diff value" is not scanned because the pattern-update diff journey is not driven.
3. AC-042: the successful-save result is a focusable polite status region ("Draft version saved."), not a heading element; FE03 line 1109 says "named result heading". The test asserts focus lands on that region and stays; root should decide whether the spec wording or the component must change. Parent-version provenance is likewise not rendered (the spec row names only version and next action).
4. First-run risk (written blind): protected-type creation assumes CMS-03A-01 accepts `workflowKey: 'cms.disclosure.policy'` (the pgTAP helper `s09d_create_type` does); `registerLatencyBlock` registers one global block `s12lat.block` v1 once per database; the pattern pages' context read is the template fixture's (fake type id), so the designer shows the saved compatible type as unavailable but still renders; labels such as `Title translation`, region names and the `Vocabulary draft saved` flow follow the component sources and may need an exact-label adjustment on a first run.
5. support/README.md module map is not updated for `s12-pw5-world.ts` / `s12-pw5-trace.ts` (existing file, outside claim); no Vitest guard exists for the new helpers (support/ is not type-checked and its Vitest suites need the stack).

## Requests to root
- Register the new files: add to `playwright.s09-real.config.ts` `testMatch` AND `playwright.config.ts` `testIgnore`: `phase-02-slice-12-definition-pages-real-route.spec.ts`, `phase-02-slice-12-template-states-real-route.spec.ts`, `phase-02-slice-12-protected-decision-real-route.spec.ts`, `phase-02-slice-12-definition-journeys-real-route.spec.ts`. Keep `template-states` after `template-real-route` (its two save tests move the fixture's latest version, which `template-real-route` reads as version 1).
- Run (project `real-route-chrome`, one worker, stack up and reset): the four specs above; titles are listed in the table and in recite4/pw5-proposals.json.
- Add the README module-map lines for the two support files; decide the AC-042 "named result heading" wording (item 3) and the AC-164 fault seam (item 1).

## Proposals
docs/handoffs/2026-10-22-claude-s12/recite4/pw5-proposals.json (status "pending root run" on every citation).
