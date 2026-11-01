# Review V16 report (claude_s12_review_v16)

Independent adversarial review of the wave-5 product changes of three lanes: `gaps-unit5` (template leave guard, commit-only
disabling in the template designers, and its refutation-4 fix round: CMS-03C-08 without `Location`, DEC-239, plus the AC-164 blind-test
repair), `web6` (FE03 1048 in three more command forms, the AC-042 named result heading) and `pwfix6` (`cmsRedirectResponse` in the 23
CMS pages, its guard test, and the real-route harness for template and locale). I did not author any of it. Read-only except this file.
Brief: `docs/handoffs/2026-10-22-claude-s12/briefs/review-v16-web-fixes.md`. Rules: `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
(its HEAD text says b16edb54; the worktree is at cd89d54c, noted only).

## Status

COMPLETE. Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD
`cd89d54cc84403e32699666c8d3710f45bbffce0` (unchanged at the end). Review window 2026-10-29 01:31 to about 02:05 EDT.
Lane reports as reviewed (SHA-256):

- `lane-gaps-unit5-report.md` `c7a3f7adf5cb0ee84fdf31a72342258890afcd9d70a8104461967500d04c9f4e` (contains `## Fix round`, written 01:40 EDT)
- `lane-web6-report.md` `1079f539ee483b57a458151ebad63cc05f17621d3d5822406e346d170d5598b0`
- `lane-pwfix6-report.md` `e3efaee668c161fdac281743b76051ce93872a2821ed6ba50b7d1e313d6ce4fa`

No drift while I worked: all 50 files of `lane-pwfix6-hashes.txt` match; all 15 files of unit5's fix-round table match; 48 of the 49 files
of web6's table match (the one exception is V16-06 below, a cross-lane edit by unit5). Scratch (logs, mutation harness, probes):
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/review-v16/`.

## Verdicts

| Lane | Verdict | Why |
|---|---|---|
| gaps-unit5 (leave guard, pending, fix round) | ACCEPT-WITH-CONDITIONS | The guard, the dirty test and the create-designer pending fix are correct and non-blind (22 of 25 in-memory mutations killed). But the fix round leaves one existing test failing (V16-01, BLOCKER, one line) and the inline confirmation only guards links inside the island (V16-02, MAJOR). |
| web6 (FE03 1048 x3, named result heading) | ACCEPT | The four product edits are minimal and exactly what the spec cell asks; every RED test fails when its fix is reverted. Recommended only: V16-03 (late edit), V16-10. Re-hash the one file unit5 edited (V16-06). |
| pwfix6 (redirects, harness) | ACCEPT-WITH-CONDITIONS | Behaviour of the 23 pages and of the harness is right (status, Location, no-store, fixture sessions untouched). Conditions: V16-05 (duplicate of an existing helper, a rule violation), V16-04 (guard test is easy to bypass), and the real-route runs below before any evidence claim. |

Conditions:

- C1 (before commit, unit5) fix V16-01: delete the stale `location` member (line 176) from the mocked upstream in
  `apps/web/src/pages/api/v1/cms/governed-reviews/governed-reviews-routes.test.ts` and rerun `apps/web/src/pages`.
- C2 (unit5, before any AC-042 "inline leave confirmation" evidence) V16-02: widen the capture to the document (as the composition page
  does) and add the missing test, or have root rule that the clause is met for in-island links only and rewrite the proposal limitation.
- C3 (pwfix6, before commit) V16-05: use `authPageRedirect` (or alias it) instead of a second helper; recommended V16-04 hardening in the same change.
- C4 (root) run the real-route specs listed under "Real-route specs root must run", and `pnpm build && pnpm bundle:check` (the guard and
  the heading add bytes to the template routes) and `pnpm contracts:check` (OpenAPI was regenerated).

### Counts

13 findings: 1 BLOCKER, 1 MAJOR, 5 MINOR, 6 NIT.
Severity scale (as in V12 to V15): BLOCKER = must not be committed as is (wrong behaviour, data loss, security, broken build, a gate that fails);
MAJOR = a spec-required behaviour or the evidence for an acceptance claim is missing, so the claim would be false as written;
MINOR = a deviation with a small blast radius; NIT = polish or test shape.
Test corrections reviewed: pwfix6 18 files (14 page route tests and 4 Slice 09 source tests, all ACCEPT), unit5 fix round 7 oracle edits plus the rewritten
AC-164 test (all ACCEPT, but not listed in the report, V16-06), web6 none.

## Findings

### V16-01 BLOCKER (unit5 fix round): an existing test fails; the lane reports GREEN

- Where: `apps/web/src/pages/api/v1/cms/governed-reviews/governed-reviews-routes.test.ts:171-197` ("CMS-03C-08 binds the review id from the route").
  The mocked upstream answer still carries the old header (`:174-177`, `location: .../assignments/${ASSIGNMENT_ID}`); the assertion at `:195`
  fails with `AssertionError: expected 502 to be 201`.
- Cause: DEC-239 made the web proxy spec for CMS-03C-08 `location: () => null`
  (`apps/web/src/server/cms-governed-review-platform-command-specs.ts:145-146`), and the proxy answers `unverified()` when the upstream
  `Location` differs from the spec (`cms-governed-review-platform-command.ts:169-170`). A stale upstream Location is now a 502 by design
  (the lane added tests for that); this test was not updated. The file is untouched since commit 6450e6aa (`git status` clean).
- Evidence: `run-b.log` and `run-c.log` in scratch. `vitest run apps/web/src/pages apps/web/src/server apps/web/src/components/cms-governed-review
  apps/web/src/components/content-schema-registry apps/web/src/components/step-up-required.inventory.test.ts tests/e2e/support`: 297 files,
  4,087 tests, exactly this one failure. Re-run at 01:55 and again at the end: still failing. The lane's fix-round run ("338 files, 6,467 tests"
  over `apps/worker/src/cms-composition apps/web/src/server apps/web/src/components/cms-governed-review` plus four contract files) omits
  `apps/web/src/pages`, which its first-round run had included. So "GREEN for both items" is false for the tree, and `pnpm test:coverage` (the
  `validate` gate) fails.
- Fix: replace the mock at `:173-178` with `jsonResponse(201, governedAssignmentFixture(), { etag: '"1"' })`, rerun `apps/web/src/pages`, list the
  edit under `## Test corrections`.

### V16-02 MAJOR (unit5 first round): the inline leave confirmation only guards links inside the island

- Spec: FE03 927 "retain scoped draft, show inline leave confirmation, use `beforeunload` only while dirty, and clear only after success or
  explicit discard"; CMS-11 row (FE03 1110) "Retain unsent values".
- Where: `CmsTemplateLeaveGuard.tsx:42-46` puts `onClickCapture` on the designer's own `<section>`; the shared hook only sees a click that bubbles
  through that node (`use-cms-editorial-leave-guard.ts:100-107`). Every navigation link of both template pages lies outside the island:
  `templates/new.astro:81-87` and `templates/[templateKey].astro:127-133` (home, "Content modeling", "System status", skip link). The only
  links inside are the transient 401 "Sign in" and the post-success "Open latest draft" (guard already disarmed).
- Evidence: scratch probe `probe/outside-link.probe.test.tsx` (not in the repo): a dirty create designer with a header link outside the island
  root. `beforeunload` is armed (true), the guard did not prevent the click (`defaultPrevented` false), and no `.cms-template-leave` is rendered.
  The lane's tests (`CmsTemplateDesigner.unsaved.test.tsx:252,278,296,359`) all click the 401 "Sign in" link inside the island, so they cannot see
  this. The README says so itself (`README.md:60`, "a click on an in-island link"). The composition page of the same repo documents why the capture
  must listen on the document: `use-composition-page.ts:60-67` ("The island holds no link of its own: the page's navigation lies outside it").
- Impact: for the real page the inline confirmation is unreachable; only the browser's native `beforeunload` prompt protects the draft. Data is
  not lost silently (beforeunload covers header links, Back, reload), which is why this is MAJOR and not BLOCKER. The term form (AC-048,
  `CmsTaxonomyTermForm.tsx:112-116`) and the entry editor share the root-scoped pattern; both are outside this review.
- Fix: in `CmsTemplateLeaveGuard` register the capture on `document` (copy the `capture` ref and `useEffect` of `use-composition-page.ts:60-67`),
  keep rendering the confirmation in the section, and add a test that clicks a link placed outside the island root (my probe is the shape);
  update README `:60`.

### V16-03 MINOR (unit5 + web6 combination): a late edit during a pending save is shown under the success banner and the guard disarms

- FE03 1048 now keeps the fields editable while the command is pending (correct). Combined with `dirty && status.kind !== 'created'`
  (`CmsTemplateDesigner.tsx:114-117`, `CmsTemplateEditDesigner.tsx:74-80`) and no reset to the saved resource after a 201, an edit typed while the
  request is in flight is neither sent nor kept honest.
- Evidence: scratch probe `probe/late-edit.probe.test.tsx`. Create designer: sent "public", user typed "LATE-EDIT-NEVER-SENT" while pending, verified
  201: banner "Draft created", the locked field shows "LATE-EDIT-NEVER-SENT", `beforeunload` not armed. Successor designer: same, and the field is
  still editable (commit is blocked by the `created` phase). The pending result itself is not corrupted (the sent snapshot is what is saved);
  the form and the guard disagree with it. By reading, the vocabulary designer (`designer.done` locks the field with the late value) and the locale
  form (`savedIds` mark on a later-edited field) behave alike; the term form closes on success (spec: "the form clears its draft").
- Fix (either): on `created` reset the form to the saved resource (the spec's success cell says the form clears its draft), or compute `dirty` against
  the snapshot that was sent instead of blanket `status.kind !== 'created'`.

### V16-04 MINOR (pwfix6): `no-store-redirects.test.ts` is satisfied by pages that redirect another way

- Where: `no-store-redirects.test.ts:25` forbids only the literal `Astro.redirect(`; `:29-31` restricts the import and no-303 checks to pages that already
  contain `cmsRedirectResponse(`; `:19` and `:34` only need at least 23.
- Evidence: `guard-hole.mjs` (the three predicates applied to synthetic pages): a page that adds `Response.redirect(url, 303)`,
  `new Response(null, { status: 302, headers: { Location } })`, `Astro.redirect (` with a space, or `Astro['redirect'](` passes; so does a new 24th page
  that redirects by hand without the helper. Only `status: 303` inside a page that also uses the helper is caught.
- Fix: for every `.astro` file forbid `/\bredirect\b/` other than the import and `cmsRedirectResponse(`, forbid `/status:\s*30\d/u` and `Response.redirect`,
  and compare the page count with the directory listing instead of `>= 23`. README: V16-09.

### V16-05 MINOR (pwfix6): `cmsRedirectResponse` duplicates an existing helper

- `apps/web/src/server/auth-page-redirect.ts:7-12` (`authPageRedirect`, used by `step-up.astro` and `settings/security/mfa.astro`) is the same
  `new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store' } })`. The new `cms-editorial-page-outcome.ts:46-55` re-implements
  it and cites the very precedent (P2-S09-AC-1067) that `authPageRedirect` already satisfies. `.claude/rules/extensibility.md` lists "copy-pasted
  logic in two files" and "new code uses a different pattern than existing code for the same thing" as Rejected.
- Behaviour is identical (header name case aside), so this is MINOR. Fix: import `authPageRedirect` in the 23 pages (or `export const cmsRedirectResponse =
  authPageRedirect`), keep one test, update the guard's import regex.

### V16-06 MINOR (unit5 report discipline): test corrections not listed, cross-lane edit, regression scope

- `lane-gaps-unit5-report.md:59-60` still says `## Test corrections: none`. The fix round (`:73-100`) edits seven existing test files
  (`governed-review-assignment.test.ts:31-38`, `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` AC-076,
  `governed-review-command-transport.test.ts` two cases, `CmsGovernedAssignmentForm.test.tsx`, `CmsGovernedAssignmentForm.states.test.tsx`,
  `cms-governed-review-platform-command.test.ts` and `.test-support.ts`) as prose, without the exact diffs lane-rules require, and rewrites the
  AC-164 isolation test. I reviewed all of them against BE03c row 176 and AC-076 (`phase-02-slice-12.md:3996`): each is the minimal inversion
  (`toBe(location)` becomes `toBeNull()`, `to contain Location` becomes `not.toHaveProperty('Location')`), none weakens an assertion, ACCEPT.
- unit5 also edited `CmsGovernedAssignmentForm.states.test.tsx` (web6's new file, in web6's claim), so web6's recorded SHA `e3a927d1...` (399 lines) is
  stale: disk is `a7bf5ba6...` (394 lines). Root must cite the current hash.
- The fix-round regression run left out `apps/web/src/pages` (V16-01).

### V16-07 MINOR (tests): three assertions survive the mutation that should kill them (PAT-031)

- `tests/e2e/support/s12-real-template-locale.test.ts:220-224` ("accepts the fixture and the configured human origins"): fixture origins and
  `S10_HUMAN_ORIGINS` are the same string (`http://127.0.0.1:4324`), so replacing the union with `...base.humanOrigins` (m19) still passes. Use a
  production origin that differs (the launcher passes `https://platform-api.internal` too) and assert both appear.
- `CmsTemplateLeaveConfirm.tsx:16` moves focus to "Keep editing" on mount; deleting that line (m21) passes all 34 tests. FE03 927 keyboard path
  is therefore unpinned: assert `document.activeElement` is the button right after the confirmation opens.
- `CmsTemplateEditDesigner.tsx:74-80` measures dirt against the rebased parent (`state.baseDetail`); measuring against the first `detail` (m22) passes.
  Decide which is meant and pin it with a test that rebases (the README says "the parent version for a successor").

### NITs

- V16-08 `CMS_TEMPLATE_NO_AUTOSAVE` (`CmsTemplateLeaveGuard.tsx:20-23`) is exported only so `CmsTemplateDesigner.unsaved.test.tsx:368-372` can call two
  constant functions for coverage. Make `save`/`stillUnsent` optional in the hook, or leave them inline as the term form does.
- V16-09 `apps/web/src/pages/app/cms-content-modeling/README.md` (Conventions, Contents) does not name `cmsRedirectResponse` or `no-store-redirects.test.ts`;
  a new page author learns the rule only from a failing test.
- V16-10 "announced once" (brief): the new `h3` sits inside the polite live region that states the result and also takes focus
  (`CmsTemplateStatus.tsx:67-99`), so a screen reader can announce it twice. The old design (focused status region) did the same, the spec asks for both,
  and no test or text claims once; note it, do not treat as a regression.
- V16-11 `cmsRedirectResponse(location: string)` accepts any string. The 23 callers pass only allowlisted paths, but the helper is now the one choke point:
  reject a location that is not a single-slash relative path.
- V16-12 stale comment `packages/contracts/src/cms-composition/governed-assignment.ts:49` ("Create is 201 with `Location`, revoke is 200.") after DEC-239;
  `.cms-template-leave` has no CSS (the term form's confirm is also unstyled).
- V16-13 `CmsTaxonomyTermAction.tsx` is 209 lines (component cap 200). It was 209 before web6's one-line edit (another lane's arrival-focus code); not web6's doing.

## FE03 cell by cell

Line numbers are those of the working-tree `fe/03-cms-content-modeling.md`; the lanes and the brief cite the Slice 12 `loading` row as 1048 and the
CMS-11 row as 1109, which are lines 1046 and 1110 today.

| Cell | Result | Evidence |
|---|---|---|
| 927 retain scoped draft | met | state lives in the island; guard keeps it; probe shows nothing is stored |
| 927 inline leave confirmation | met only for in-island links | V16-02 |
| 927 `beforeunload` only while dirty | met | `useCmsEditorialLeaveGuard` effect keyed on `active`; test "arms beforeunload only while the form holds unsent input"; mutation m27 (pristine baseline) killed |
| 927 clear only after success or explicit discard | met | `dirty && status.kind !== 'created'`; "Start another draft" test; m10, m11 killed. Late-edit gap: V16-03 |
| CMS-11 row (1110) "retain unsent values", Back/Cancel | met | no Cancel on these pages; Back and reload are covered by `beforeunload` (Playwright auto-accepts unhandled `beforeunload`, `coreBundle.js` `_close()`), so the real-route specs do not hang |
| keyboard path, focus return | partly | Enter/Space on the link opens the confirmation; "Keep editing" returns focus to the link (tested); initial focus unpinned (m21) |
| 1046 `loading`: only the commit control disabled (template create, vocabulary, term, locale) | met | pending tests in four files; m01 to m06 killed; successor designer had no fieldset lock to begin with |
| 1046: inputs editable, focus kept, no second submit | met | tests type into a field while pending and assert `activeElement`; the submit button is disabled, so implicit submission is refused by the browser; `inFlightRef`/`submitting` guards remain |
| 1046: late edit does not lift pending (locale hook `edited()`) | met | `use-locale-variant-form.ts:136-147`; m03 killed. Hook has no other path that resets `pending` |
| 1046: late edit and the saved result | gap | V16-03 |
| 1083-1087, 1110 named result heading, focus, create and successor | met | `h3#cms-template-result-heading` (`CmsTemplateStatus.tsx:88-90`), `focusCmsTemplateResult` shared by both designers; refusal keeps summary focus; m07, m08 killed |
| not re-stolen on refetch | met | the focus effect depends on `status`, which no read changes; test waits 50 ms and re-asserts |
| announce once | n/a | V16-10 |
| 1110 "announce the version and the next action (submit for review)" | open (reported by web6) | the page announces "Open latest draft"; the heading change does not close it, so the AC-042 proposal must not claim it |

## Redirects (pwfix6)

- `Astro.redirect` in Astro 7.2.9 is `new Response(null, { status, headers: { Location: path } })` (`core/fetch/fetch-state.js:402`), so the helper
  differs only by the added `Cache-Control: no-store`. Cookies set through `Astro.cookies` are attached by Astro to any returned Response.
- All 23 pages: 30 call sites at HEAD (`Astro.redirect(`, every one with status 303) and 30 now (`cmsRedirectResponse(`), equal page by page: one
  sign-in or outcome redirect per page (23) plus 7 more on the POST, continuation and step-up paths of `index` (1), `[versionId]` (2),
  `capability-grants` (2) and `schema-reviews/[reviewId]` (2). The Location strings are byte-identical (the diff only wraps them); each page imports the
  helper from a path that resolves and sits inside the frontmatter (checked by script); no page exceeds 200 lines (max 197); no other redirect form
  remains in the tree.
- Mutations: no-store removed (m09a) and status 302 (m09b) both fail `cms-editorial-page-outcome.test.ts`.
- The 14 page route tests and the 4 Slice 09 source tests keep their meaning: the 303 now lives in the helper, whose test pins status, Location, no-store
  and null body. The `toContain('303')` assertions were dropped from the S09 tests only; nothing else weakened.

## Harness (pwfix6)

- `tests/e2e/support/s12-real-template-locale.ts`: the home is chosen in `resolveSession` by `claimsOf(...) === null` and remembered in a `WeakSet<Request>`.
  The Worker passes the same `context.req.raw` to the session, rate limit and port calls (`template-*-routes.ts`), and `instrumentComposition`
  forwards inputs unchanged (`observability-instrument.ts`), so one request never mixes homes. The port lists equal the dependency types
  (`template-shared.ts`, `locale-routes-types.ts`); `now` and `telemetry` stay the base's; the parity test pins the key sets.
- Fixture sessions: the existing template and locale specs sign in with `authenticateLocalSession` and no party/person/capability claims, so
  `claimsOf` is null and they take the fixture, as before. Slice 10 sessions carry party and capabilities but no person claim, so they stay on the fixture
  too; only Slice 11/12 sessions (`s11Session`) take production. A revoked or expired session also falls back to the fixture (fails closed, mutation m17/m18 killed).
- Origins: fixture sessions now also accept the production origins (the union); harmless, and the one blind assertion is V16-07.

## Revert-checks (PAT-031)

Method: a scratch Vitest config (`mut/vitest.mut.config.mjs`) applies in-memory source edits at transform time; the repository is never written.

| Mutation | Test file | Result |
|---|---|---|
| m01 create fieldset also disabled while pending | CmsTemplateDesigner.pending | killed |
| m02 create commit not disabled while pending | CmsTemplateDesigner.pending | killed |
| m03 locale `edited()` resets pending again | CmsLocaleVariantForm.pending | killed |
| m04 locale fieldset disabled while pending | CmsLocaleVariantForm.pending | killed |
| m05 vocabulary fieldset disabled while pending | CmsTaxonomyVersionDesigner.pending | killed |
| m06 term action fieldset disabled while pending | CmsTaxonomyTermForm.pending | killed |
| m07 `h3` back to `strong` | CmsTemplateDesigner.result-focus (2) | killed |
| m08 focus the summary instead of the heading | CmsTemplateDesigner.result-focus (2) | killed |
| m09a/m09b helper without no-store / with 302 | cms-editorial-page-outcome | killed |
| m10/m11 guard stays armed after success (create / successor) | CmsTemplateDesigner.unsaved | killed |
| m13 audience ignored by dirty | draft-dirty + unsaved (5) | killed |
| m14 no capture handler | unsaved (5) | killed |
| m24 content-type order counts | draft-dirty | killed |
| m25 default navigate removed | unsaved | killed |
| m27 pristine baseline locale wrong | unsaved + draft-dirty (3) | killed |
| m17 harness always production / m18 home not remembered | s12-real-template-locale (4 / 2) | killed |
| m20 Location restored on CMS-03C-08 | assignment-no-location + assignment (2) | killed |
| m30 diff values leaked into an attribute (AC-272) | diff-privacy | killed |
| m31 slot schema loose (AC-001) | accessibility-contract + member (4) | killed |
| m19 origins union removed | s12-real-template-locale | SURVIVED (V16-07) |
| m21 "Keep editing" auto-focus removed | unsaved + draft-dirty + pending + result-focus | SURVIVED (V16-07) |
| m22 dirty measured against the first detail | same four files | SURVIVED (V16-07) |

25 mutations, 22 killed, 3 survived. The repaired AC-164 test (`template-context-session-isolation.test.ts`) now routes the capability-bearing session
through the real `production.readSession` (`production-session.ts:244`, which parses exactly the six members), asserts the spy received that session, and
asserts the exact body: not blind. The old constant-mock weakness is gone.

## Runs (all focused; nothing forbidden was run)

| # | What | Result |
|---|---|---|
| R1 | 16 lane test files (pending, unsaved, result-focus, draft-dirty, outcome, guard, harness, parity, no-location, assignment, isolation, OpenAPI, contract) | 16 files, 162 tests pass |
| R2 | `cms-composition`, `cms-taxonomy-designer`, `cms-taxonomy-terms`, `cms-locale`, `cms-editorial-pages`, on-demand proof, with v8 coverage on the 14 touched web modules | 134 files, 1,258 tests pass. Coverage of every new or changed line: 100% (uncovered lines are untouched older ones: designers 78-79 and 127, status 40/50, reconcile 41/47/161, locale hook 160) |
| R3 | worker `governed-review*` and `governed-activation*` with coverage on `governed-review-command-routes.ts`, `governed-review-response.ts`, `governed-activation-routes.ts` | 32 files, 951 tests pass, 100% statements, branches, functions, lines (`governed-activation-routes.ts:106` still exercises the shared `location` option) |
| R4 | `apps/web/src/pages`, `server`, `cms-governed-review`, `content-schema-registry`, `step-up-required.inventory`, `tests/e2e/support` | 297 files, 4,087 tests, 1 failure (V16-01) |
| R5 | web root closure and boundary tests (`cms-island-static-closure`, `cms-lazy-forms-closure*`, `client-chunk*`, `browser-validator-import-boundaries`, `security-headers`) | 8 files, 109 tests pass (the guard adds no zod to the island closure) |
| R6 | `tests/contracts/phase-02-slice-12*` and `tests/contracts/openapi*` | 30 files, 681 tests, 2 failures outside these lanes: `phase-02-slice-12-evidence-guard` (1,175 stale or missing receipts) and `phase-02-slice-12-closeout` (the BOUNDARY-marker list now includes `supabase/migrations/20261024100700_cms_restore_term_assignments.sql`). The committed OpenAPI equals the generated one (that closeout case passes) |
| R7 | `cms-composition-instances`, `cms-pattern-designer`, `cms-related-content`, `cms-editorial-fields` (web6 matrix), AC-001 contract and Worker tests | 109 files, 1,353 tests pass |
| R8 | `tsc --noEmit -p` in `apps/web` and `apps/worker` | both exit 0 |

Static: no `any`, `@ts-ignore` or `eslint-disable` and no TODO in any new file of the three lanes; component files are at or under 200 lines (V16-13 aside);
every new directory file is covered by an existing README.

## Real-route specs root must run

Priority 1 (changed behaviour, run after `pnpm build`):

1. `tests/e2e/phase-02-slice-12-template-states-real-route.spec.ts`: AC-042 heading focus (already rewritten to the heading), the AC-265 "Back restores the
   form" test (now a dirty form with an armed `beforeunload`; Playwright accepts it, but confirm), and the four 303 + no-store cases.
2. `phase-02-slice-12-template-real-route.spec.ts`, `phase-02-slice-12-template-uncertain-real-route.spec.ts`, `phase-02-slice-12-template-edit.spec.ts`: the
   fixture seam (harness routing), the leave guard, and the `h3` inside the status role.
3. `phase-02-slice-12-locale-real-route.spec.ts`: the locale fixture seam; `phase-02-slice-12-definition-pages-real-route.spec.ts` (AC-105, AC-176, AC-058: S12
   sessions now reach production template and locale reads; the AC-176 403 versus 404 risk pwfix6 named held in run 2).
4. `phase-02-slice-12-governed-review-real-route.spec.ts`, `-protected-decision-real-route.spec.ts`, `-definition-journeys-real-route.spec.ts`: a real assignment
   create against the real Worker with no `Location` (DEC-239); the web proxy and the browser transport both reject a Location, so the first real create
   proves the pair.

Priority 2 (every CMS page redirect changed, pwfix6's request stands): all `phase-02-slice-09-*-real-route.spec.ts` that sign out or step up
(`registry-browser`, `step-up-return`, `capability-grants`, `capability-grant-personas`, `schema-review`, `schema-version`, `content-schema-registry`,
`cross-tab-scope`), all Slice 10 `*-real-route.spec.ts` plus `phase-02-slice-10-entry-routes-auth-scope.spec.ts`, and Slice 11 `workflow-real-route` and
`bundle-budget-real-route` (bytes of the template routes after the guard).

Also `pnpm contracts:check`, `pnpm type-check` (tests/e2e is not type-checked) and `pnpm lint`.

## Not reviewed in depth (limits)

- The 31 files and 300 tests of web6's AC-271 matrix: I ran them (R2, R4, R7: all pass), scanned for assertion-free or weak-only tests (none; two flagged
  files are `it.each` tables) and mutation-probed AC-272 and AC-001 (killed), but did not read each cell against FE03 1042-1050. Their
  "(kept half)" titles and the defect list (D1 to B8) are the lane's own reports of product gaps outside its claim; AC-271 must stay partial.
- unit5's first-round Worker tests (AC-039, AC-095, AC-126/128, AC-134, AC-164 contracts), outside this brief.
- Real-route behaviour, bundle bytes, database behaviour: not run (rules).

## Requests to root

1. Have unit5 (or fix directly) V16-01 before anything is committed; ask it to rerun `apps/web/src/pages` and to move the eight oracle edits into `## Test corrections`.
2. Decide V16-02: document-level capture (recommended) or a ruling that the clause covers in-island links only.
3. Decide V16-05 (reuse `authPageRedirect`), then V16-04 hardening in the same change.
4. Re-hash `CmsGovernedAssignmentForm.states.test.tsx` before citing web6's AC-271 rows (V16-06).
5. Run the specs above; the two `tests/contracts` failures in R6 are not from these lanes but are red in the tree today.

## Verification round (2026-10-29, 02:36 to about 03:25 EDT)

Coordinator request: verify the lane answers to V16-01 to V16-07 (unit5 "Fix round 2", pwfix6 "Fix round") and review the new WIP lane `gaps-db5`
(DEC-240) before promotion. Same rules: read-only except this file, focused Vitest and `tsc --noEmit` only, no Playwright, database, build or race run.
The sections above are left as written; this section supersedes their verdicts where it says so.

Inputs as reviewed: HEAD `cd89d54cc84403e32699666c8d3710f45bbffce0` (unchanged). `lane-gaps-unit5-report.md`
`ee270ea4576610f6882ac894b7c0d58967aa8b627d28fb10de89a16b3639ce4c`, `lane-pwfix6-report.md`
`0880f77f6b28cc6668b81bf9153423c143616039087fce109bbe42e6065c5c82`, `lane-pwfix6-hashes.txt`
`0764130026e18bf255c2a8b2808479214cad11d4dec621c7d8cd7cf4c542e7e2`, `lane-gaps-db5-report.md`
`deb39fff7bd495517ca2cd019b29d03dbadc8b9e29e24ec25fa495086d4a282a`. All 17 files of unit5's Fix round 2 table, all 50 files of pwfix6's hash list and all
5 files of the db5 table match their recorded SHA-256 on disk. Scratch: `.../scratchpad/review-v16/round2/`, `.../mut/`, `.../probe/`.

### Verdicts after the round

| Lane | Verdict | Remaining condition |
|---|---|---|
| gaps-unit5 (leave guard, late edit, fix rounds) | ACCEPT-WITH-CONDITIONS | V16-14 only: bind the "sent" snapshot to the confirmed attempt (locale form, vocabulary designer). Candidate patches below, verified in memory. |
| web6 | ACCEPT (unchanged) | none; six files of its hash table now differ because unit5 edited them (V16-18): cite the current hashes |
| pwfix6 | ACCEPT | none (V16-16 is a NIT) |
| WIP gaps-db5 | DO-NOT-PROMOTE as submitted | V16-15: the migration turns a green Slice 10 pgTAP assertion red; correct that oracle and its ledger citation, then run every restore-calling suite. Everything else in the WIP is sound. |

### The original findings, one by one

| ID | Result | Evidence |
|---|---|---|
| V16-01 | MET | `governed-reviews-routes.test.ts` mock no longer sends the old `Location` (diff: the `location` member and the unused `ASSIGNMENT_ID` import are gone); the directory passes 8/8; with `apps/web/src/pages`, `server`, `cms-governed-review`, `content-schema-registry`, `cms-editorial-pages`, the root closure tests, `cms-composition-instances`, `cms-pattern-designer`, `cms-related-content`, `cms-editorial-fields` and `tests/e2e/support`: 433 files, 5,680 tests, 0 failures |
| V16-02 | MET | `CmsTemplateLeaveGuard.tsx:46-57` registers a document-level capture listener (a `capture` ref refreshed in an effect, as `use-composition-page.ts:60-67`); the section no longer carries `onClickCapture`. New `CmsTemplateDesigner.unsaved-guard.test.tsx` (both designers): a header link outside the island opens the confirmation, "Keep editing" takes focus on opening and returns it to the link, "Leave without saving" navigates to that link, a clean form lets the link through. Mutants killed: listener removed (7 tests fail), ref never refreshed (7 fail). README updated |
| V16-03 | NOT MET (three of four forms met) | Template create and successor: met. `use-cms-template-sent-fields.ts` remembers the exact `fields` object the request is built from (create designer: after validation; successor: at submit start, before `state.submit`; both from the render closure the request uses), compares by value with the normalised comparator that covers every editable member, and the state arrays are updated immutably (no aliasing); a created save is unsent exactly when the form differs from that snapshot. Mutants killed (s1 to s6, 2 to 4 tests each): late edit never detected, guard disarmed after created, snapshot never stored, dirt after created not taken from the snapshot, snapshot call removed in the successor, snapshot call removed in the create designer. Vocabulary designer and locale form: the snapshot is bound to the latest attempt, not to the confirmed one, so an edited value can be shown as saved: new V16-14 |
| V16-04 | MET | `no-store-redirects.test.ts` is now a `violations()` predicate plus an explicit list of the 23 pages compared by equality (39 tests: 1 + 23 + 1 + 1 clean + 9 + 4 inverse probes). I injected four bypasses into real page sources through the `?raw` glob (`Response.redirect`, a hand-built 302 with `Location`, `Astro.redirect (` with a space, `Astro['redirect']`): the page's own test fails each time. Residual alias forms: V16-16 |
| V16-05 | MET | `cms-editorial-page-outcome.ts:54-55`: `export const cmsRedirectResponse: (location: string) => Response = authPageRedirect;`; the test asserts identity (`toBe(authPageRedirect)`) and keeps status, `Location`, no-store and null body; a mutant with its own builder fails 2 tests. `authPageRedirect` is tracked and unmodified; header names are lower-case, and `Headers.get` and Playwright's `response.headers()` are case-insensitive or lower-cased. The root closure tests (`cms-island-static-closure`, `client-chunk*`, `cms-lazy-forms-closure*`) pass with the new import chain |
| V16-06 | MET | `## Test corrections` of the unit5 report lists eight existing test files with their diffs and the two lane-owned rewrites. I re-read every listed change against the tree and against the earlier diffs: they match; the cross-lane edit of web6's file is recorded. Two files carry no change beyond the lane's table (`CmsTemplateLeaveConfirm.tsx`, `tests/e2e/support/s12-real-template-locale.ts` were touched by the lane's mutation runs and restored byte-identical: SHA-256 `788a1865...` and `978387...` as before) |
| V16-07 | MET | (a) origins: new `s12-real-template-locale.origins.test.ts` uses two different origins and asserts the exact union; dropping either side of the union fails both tests (2 mutants, 2 tests each). (b) "Keep editing" auto-focus: asserted as the confirmation opens; the focus effect removed fails both designers. (c) rebased parent: the new rebase test fails when dirt is measured against the first `detail`. All three revert-checked by me |
| V16-08, -09, -11, -12, -13 | open NITs, as the lanes said | `CMS_TEMPLATE_NO_AUTOSAVE` still exported; no README names `cmsRedirectResponse` or the guard test; the helper accepts any string; `governed-assignment.ts:49` still says "Create is 201 with `Location`"; `CmsTaxonomyTermAction.tsx` is 209 lines |
| V16-10 | n/a | unchanged |

### New findings

**V16-14 MAJOR (unit5 Fix round 2): the "sent" snapshot is keyed to the latest attempt, so an edited value can be shown as saved.**
- Locale form (reproduced). `use-locale-variant-form.ts` writes `sentValuesRef.current = values` at every attempt (before the outcome is known, `:188`), but
  `savedIds` is replaced only by a confirmed save (`:217`), and the mark is `savedIds.filter(value equals sentValuesRef)` (`:264-268`, rendered at `:280-281`). Probe
  `probe/locale-mark.probe.test.tsx` (the lane's own fixtures): save "v1" (mark shown, 1), type "v2" (mark gone, 0), save again: while that save is
  pending the mark is back (1), and after it fails with 503 ("Nothing was confirmed") it is still there (1), next to a value no save confirmed.
  The form has no leave guard, so nothing else warns. HEAD showed the false mark after any edit; the lane's change removed it for the same attempt but not
  after a re-send.
- Vocabulary designer (reproduced, narrower). `use-taxonomy-designer.ts` sets `sentRef.current = snapshot` at every send (`:140`), but `created` can also come from
  the reconcile of an EARLIER unknown attempt (`:188`; the direct path is `:165`, the notice test `:250-253`). The Save button is enabled while that read runs (web6's own defect L5). Probe
  `probe/vocab-reconcile.probe.test.tsx`: attempt 1 unknown, edit, attempt 2 refused, then the read verifies attempt 1: the banner "Vocabulary draft saved"
  shows, the form holds the edit, and no late-edit notice appears.
- Same class, by reading only (not reproduced): the template successor stores its snapshot at submit start, before `state.submit` admits the attempt, so
  it too depends on the disabled button to keep a refused second call from overwriting it; storing it when `created` arrives would remove that dependence.
- Fix (verified in memory, repository untouched). Bind the snapshot to the confirmation. Locale: delete `sentValuesRef.current = values;` at send and set it
  in the `saved` branch next to `setSavedIds(...)`. Vocabulary: set `sentRef.current = snapshot;` immediately before each of the two
  `setStatus({ kind: 'created', ... })` calls and not at send. With these two edits my two probes go RED to GREEN, and the lane's own directories stay green
  (`cms-locale` 16 files / 157 tests, `cms-taxonomy-designer` 17 files / 208 tests). Add the two probes as tests (locale: save, edit, held second save has no
  mark, failed second save has no mark; vocabulary: unknown attempt, edited second save, reconcile verifies attempt 1, notice shown).

**V16-15 BLOCKER for promotion (WIP gaps-db5): DEC-240 turns a green Slice 10 pgTAP assertion red; the lane did not run it or correct it.**
- `supabase/tests/phase_02_slice_10_ev_ea_lineage.sql:105-110` asserts, for a source revision that pins a resolvable taxonomy version `...f3` and holds no
  term assignment, that the restore response reports `taxonomyVersionIds = ["...f3"]` ("the restored draft records exactly the taxonomy version ids of its
  source revision"). That is exactly the behaviour DEC-240 removes: the lane's own new test 19 asserts that a source with a recorded version and no assignment
  restores to `[]`. The two tests cannot both pass. The assertion is green today (`ok 9` in every TAP that ran the file, latest
  `.lane-logs/alt-staged-taxonomy-integrity-204306-352086.tap`), the file is a top-level pgTAP entry of `supabase test db`, and it is not among the
  lane's 11 files. The lane swept for body-hash pins of `cms_restore_term_plan` and for the old 050 title, not for assertions about the ids a restore records.
- Reach. 26 top-level pgTAP files name `cms_restore_revision`; the lane ran 6 of them (plus 5 taxonomy suites that reach it through includes). The other 20 are
  `phase_02_slice_09_p240_a03_relation`, `_09_r8_api_surface`, `_10_activation_lock_order`, `_10_compare_chain_shared`, `_10_conflict_lifecycle`,
  `_10_ev_ea_atomicity`, `_10_ev_ea_authority`, `_10_ev_ea_lineage`, `_10_ev_eb_restore_resolve`, `_10_ev_ec_r1b_restore_binding`,
  `_10_protected_validator_freeze`, `_10_response_contracts`, `_10_restore_chain_rebind`, `_10_restore_policy_evidence`, `_10_validation_pointers`,
  `_10_write_path_catalog`, `_10_write_path_locks`, `_11_e2_adoption`, `_11_rpc_publication_lock_order`, `_12_gaps_entry_default` (all `.sql` under
  `supabase/tests/`; list also in scratch `round2/restore-callers-not-run.txt`). By reading, `ev_ea_lineage.sql` is the only one
  that asserts recorded taxonomy ids after a restore (every other restore fixture records `[]`, the PostgREST specs record `[]`), but that is a static
  sweep: run them.
- The assertion is cited as evidence for P2-S10-AC-002 at `tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts:225` and in
  `tests/contracts/phase-02-slice-10-receipts.generated.jsonl:124`. The Slice 10 evidence guard is already red in the tree for stale receipts of other files;
  once receipts are regenerated, a cited title that no longer exists fails it ("no receipt: title does not match").
- To reach PROMOTE: (1) correct the oracle as a spec-forced test correction citing BE03c 1593 (item 3 as amended) and DEC-240: expect `'[]'::jsonb`, retitle
  it (for example "the restored draft records no taxonomy version id of a vocabulary its source holds no assignment for: the pin resolves, the restore
  proceeds and DEC-240 does not carry it"), and fix the file header (`:5-8`, "carries the pinned taxonomy version ids onto the new draft unchanged");
  (2) change the title in the Slice 10 ledger citation (`:225`) and regenerate the Slice 10 receipts (root, database stack); (3) list it in the lane's
  `## Test corrections`; (4) run all 26 restore-calling pgTAP files, or the full `pnpm db:test`, on the final bytes.

**NITs**
- V16-16 (pwfix6) The hardened guard still passes aliased forms: `const A = Astro; A.redirect(...)`, `(Astro as X).redirect(...)`, a status held in a constant,
  headers built apart, `const R = Response; R.redirect(...)` (checked with the guard's exact predicates, `round2/guard2.mjs`). A rule that bans the token
  `redirect` outside the shared import, the call and the `'redirect'` outcome kind would close them; the real pages contain no such form.
- V16-17 (unit5) `use-locale-variant-form.ts` is now exactly 300 lines (the utility cap) and the locale and vocabulary READMEs do not document the sent-snapshot
  and late-edit rule that lives in their hooks (only `cms-composition/README.md` does).
- V16-18 (process) unit5 ran its mutants in place on `tests/e2e/support/s12-real-template-locale.ts` (pwfix6's harness) and on its own
  `CmsTemplateLeaveConfirm.tsx`, restoring them byte-identical (hashes verified). A real-route run in that window would have used a mutated harness; use an
  out-of-tree harness (mine: `mut/vitest.mut.config.mjs`). Hash drift against web6's table, all from unit5's rounds: `CmsTemplateDesigner.tsx`,
  `cms-composition/README.md`, `CmsGovernedAssignmentForm.states.test.tsx`, `CmsLocaleVariantForm.tsx`, `use-locale-variant-form.ts`,
  `CmsTaxonomyVersionDesigner.tsx` (re-hash before citing web6 rows).
- V16-19 (WIP) the migration header lists "SECURITY DEFINER" among the unchanged attributes; the function is SECURITY INVOKER (the guard rightly requires
  `not prosecdef`). Wording only.

Counts after the round: 19 findings in total (13 earlier plus 6 new). Open: 1 BLOCKER (V16-15, against the WIP, not against a committed lane), 1 MAJOR
(V16-14), NITs V16-08, -09, -11, -12, -13, -16, -17, -18, -19. Resolved: V16-01 (BLOCKER), V16-02 (MAJOR), V16-04, -05, -06, -07 (MINOR); V16-03 is replaced by V16-14.

### WIP gaps-db5: verdict DO-NOT-PROMOTE as submitted (PROMOTE once V16-15 is done)

What I checked and found sound:

| Item | Result |
|---|---|
| Anchored patch | Replayed offline against the installed source of `cms_restore_term_plan` (6,938 characters, taken from `20261024100700`): each of the three old anchors occurs exactly once, each new anchor exactly once after its replacement, the result contains neither `pin.version_id` nor `lineages`, and my result equals the lane's scratch `new_body.sql` (6,244 characters). The diff is exactly two declarations, one assignment and the 12-line tail loop, replaced by a two-line comment. Syntax by reading: the `declare` section still ends on a valid declaration, the loop and `if` structure is unchanged |
| Inverse check | The inverse replay (last anchor first) restores the installed source byte for byte (my replay: true); the DO block raises 55000 if it does not |
| Attribute preservation | Owner `wejammin_cms_definer`, `prosecdef` false, volatile `s`, `search_path=""` checked before; after `execute replace(pg_get_functiondef, old, new)` every pg_proc column except `prosrc` is compared (the oid included, so it is the same function) and the function comment separately. Same mechanism as `20261024100800` and the DEC-232 precedent |
| Populated-DB safety | Catalog-only: no table is read or written; `lock_timeout` 5s, `statement_timeout` 30s; every failure is a typed 55000 refusal inside one transaction, nothing changes; if the live body differs from the repo's, the anchors are absent and it refuses. It cannot be applied twice (same as the precedents). No backfill: already restored revisions keep the ids they recorded (revision rows are append-only history); say so in the promotion note |
| Pin check | `cms_restore_revision` is not patched; the pin check (`cms_taxonomy_version_resolves`, any state, owner scope) still runs first and still refuses an unresolvable recorded version: new test 20 (with a carried assignment) and `050-restore.sqlinc` `rs_rn` (without one) both assert `P0001:migration_chain_incomplete` and are green |
| RED to GREEN | RED run (02:05, TAP sha `3fbf1ddd...`): 5 of 20 `not ok` (10, 11, 15, 17, 19), all genuine have/want differences of the old behaviour; controls pass. GREEN run started 02:07:14, after the migration's last write (02:07:01): the new file 20/20, 11 files, 535 tests, 0 `not ok`, `Result: PASS` (TAP sha `8311b6bf...`). Test 17 reverses the plan order to pin the bytewise ascending sort; test 15 pins "current active, not recorded"; test 16 pins DEC-229 |
| Test correction `050-restore.sqlinc` | Minimal inversion forced by BE03c 1593 and DEC-240 (`["<rs7>"]` becomes `[]`, comment and title follow); the adjacent pin-check assertion is untouched; the old title is cited nowhere (only historical TAP logs and a lane narrative) |
| Closeout test | 11/11 pass. Four in-memory faults, each caught: a `BOUNDARY:` left in the new migration (c1), `DEC-240` removed from it (c2), the promoted `20261024100700` edited so its marker disappears (c3, two tests fail), a new marker in another promoted migration (c4). The closed set now deliberately includes `20261024100700`, whose marker text is pinned |
| Spec fit | BE03c item 3 and the 2026-10-29 changelog row; AC-244 and AC-246 already read "the vocabularies' current active version ids", no conflict |
| Fixture | the new file writes the legacy-shape `taxonomy_version_ids` of a source revision through the shared labelled helper `h11_raw_exec` (it disables user triggers on that table inside the rolled-back test transaction), as `050-restore.sqlinc` already does for the same column. The lane disclosed it; no producer path creates that shape. Root should rule once against the lane rule "never disable triggers" |

Promotion mechanics for root once V16-15 is done: move the file with the same name (`20261029130000_cms_restore_records_carried_vocabularies.sql`) into
`supabase/migrations/` and delete `supabase/migrations-wip/gaps-db5/` including its README (the closeout test requires exactly one of the two locations
and that exact name); canonical reset, `db:types:check` (signature unchanged, so no type change expected), the 26 restore-calling pgTAP files; cite the new
file's 20 titles in the Slice 12 ledger (AC-244); note that BE03b:1718 (2) ("restore reinstates the source content under the taxonomy versions the source
revision recorded", an "until then" paragraph) is superseded by BE03c item 3 for the ids a restore records, and that FE03 927 (global rule) also applies to the
vocabulary designer and the locale form, which still have no leave guard (unit5 disclosed it; no criterion owns it).

### Runs of this round (focused; nothing forbidden was run)

| # | What | Result |
|---|---|---|
| V1 | `cms-composition`, `cms-taxonomy-designer`, `cms-taxonomy-terms`, `cms-locale`, `cms-editorial-pages`, on-demand proof, `tests/e2e/support`, v8 coverage on 13 touched web modules | 143 files, 1,305 tests pass; every new or changed line at 100% (remaining uncovered lines are untouched older ones) |
| V2 | `apps/web/src/pages`, `server`, `cms-governed-review`, `content-schema-registry`, `cms-editorial-pages`, root closure tests, `cms-composition-instances`, `cms-pattern-designer`, `cms-related-content`, `cms-editorial-fields`, `tests/e2e/support` | 433 files, 5,680 tests pass |
| V3 | 24 round-2 in-memory mutants (p1 to p4, a1, d1, d2, f1, b1, o1, o2, s1 to s6, v1 to v3, l1 to l4) | 24 of 24 killed |
| V4 | `tests/contracts/phase-02-slice-12-closeout.test.ts` and 4 closeout faults | 11/11; 4 of 4 faults killed |
| V5 | scratch probes: locale mark, vocabulary reconcile, with and without the candidate patches | RED on the current code, GREEN with the patches; lane directories stay green (157 and 208 tests) |
| V6 | offline replay of the DEC-240 patch; TAP logs and mtimes; static sweep of restore-calling pgTAP files | as in the table above |
| V7 | `tsc --noEmit -p` in `apps/web` and `apps/worker` | both exit 0 |
