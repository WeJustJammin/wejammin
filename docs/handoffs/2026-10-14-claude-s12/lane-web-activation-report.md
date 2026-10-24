# Lane report: claude_s12_web_activation (Web surface, FE03 CMS-03C-09 form)

## Status
GREEN. Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54`, 2026-10-15. Two BOUNDARY items (superseded version
number, closed reason of a blocked schedule) and one process incident (shared scratchpad, see Requests to root 1) are recorded below.
Nothing under `apps/worker/**` or `supabase/**` was touched; no contract, migration or lockfile was changed.

## Scope
Delivered, test-first: `CmsGovernedActivationForm` (FE03 :882, :1069 as amended by DEC-190) with its same-origin proxy for CMS-03C-09
(`POST /api/v1/cms/governed-reviews/{reviewId}/activation`), mounted in the definition-review detail island; radios `Activate now`,
`Schedule activation` and `Retire this version`, each offered only when the server's `permittedNextActions` lists it; the
`ScheduledInstant` is computed by the shared Time authority module exactly as `CmsEditorialScheduleForm` does; retire takes an optional
1-256 NFC reason and names "Entries bound to this version can no longer publish."; `expectedVersion` = the review `version`;
unconditional step-up with the DEC-111 recovery; `canonical_source_unavailable` names the domain; the 200 is worded "Activated, not
published", the 202 "Scheduled, not active", and a retire 200's `reviewVersion` (expected + 1) is the new validator. The
"Activation is not available from this panel yet." copy is removed from `CmsGovernedReviewPanel` (the panel now points the owner to the
review for an approved, blocked or active version).

## Design decisions (implementation tier, mine; root may override)
1. Proxy generalised minimally: the shared proxy spec gained `etagVersion(resource)` so the strong ETag is checked against the version the
   answer quotes (`reviewVersion` for CMS-03C-09; `version` for the other three). `bound` returns the resource itself. The activation
   answer is parsed strictly and bound to the request: same review, same action, activate/retire at expected + 1, schedule at the
   unchanged version with `scheduledForUtc` within 1 ms of the requested `resolvedUtc`; Location is the review. STEP_UP_OPERATIONS gained
   CMS-03C-09; the Time authority pointers `/activateAt/*` are published; time tokens are relayed as `reasonCode` only (the browser's
   own pinned resolver already produced the alternatives and window, so the server's typed members are dropped, as for every governed
   refusal).
2. Browser spec in its own file `governed-activation-command-spec.ts` (built on helpers exported from `governed-review-command-specs.ts`)
   to avoid a circular import. Its committed shape exposes the review version after the command as `version`, so the shared transport,
   which checks `ETag == "<resource.version>"`, is reused unchanged. Zero zod in the browser: the static-closure test still passes with
   the form under the detail island; `withCmsValidators` loads the one reason schema lazily, and only for a non-empty retire reason.
3. Refusal copy lives in `governed-activation-refusal.ts` (fixed, selected by the registered token and the closed domain); `classifyAs` is
   `CMS-03B-07`, so the 403 capability gate, rate limits and bare conflicts use the shared table. Draft key `CMS-03C-09` never collides
   with another form.
4. Confirmation step (FE03 :902): the form's first button is `Continue` (local checks only); an inline step then names the consequence and
   the exact subject and, for a schedule, the local time, zone and resolved instant, with `Cancel`; Escape and Cancel withdraw it, and
   so does any change to the inputs, the resolved instant or the review version (the step is derived from a signature of exactly those).
   Nothing is sent before the explicit confirm, and Enter in a field can only reach the confirmation. Focus lands on the confirm heading,
   returns to `Continue` on cancel, and goes to the review summary heading after a commit.
5. The Time authority snapshot (218 KB) is fetched only once Schedule is chosen or a restored draft holds it, then once. The step-up draft
   stores the action, local time, zone, disambiguation and reason, never an instant; on return the instant is recomputed and the person
   confirms again under the original `Idempotency-Key`.
6. After a commit the form is not auto-reset (a reset would withdraw the island's confirmation line). Beginning another command (choosing a
   radio or pressing Continue) starts over under a fresh key; the next command uses the advanced review version from the canonical re-read.
7. The frame outlives the permission (the existing `governedFrameVisible` rule): a refusal sentence survives the re-read that removes the action.
8. Island: a reader of an approved review whose subject awaits activation but who is offered neither activate nor schedule is told "Only the
   owner of this version can activate or schedule it." (FE03 :1048, the disabled reason names the missing `permittedNextActions`).

## Files (path under apps/web/src, lines, SHA-256)
| components/cms-governed-review/CmsGovernedActivationConfirm.tsx | 69 | c9f9d76f2dba16fea16d5e3e629c2340cb37409ea090f53d0f2cc93a9bbd28e6 |
| components/cms-governed-review/CmsGovernedActivationFields.tsx | 148 | c0947d1782f87c5dbe210b8147de0ed8fdf4f5ff87154ace3ba2d29815f359e1 |
| components/cms-governed-review/CmsGovernedActivationForm.tsx | 122 | 4b795f0cb0e35d6028441f0f9246b89370eade382eec89a82e62210b0505aefa |
| components/cms-governed-review/CmsGovernedActivationForm.test.tsx | 256 | f28fdb58310a5acfeddeced4a7666be22b5e3f2909c25fbf4a026fafa618f7b6 |
| components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx | 343 | 65027345dfa993dd092773792461ae876d9491f76307c3e6795de6d2ecb79f0b |
| components/cms-governed-review/CmsGovernedActivationForm.schedule.test.tsx | 279 | 6cae33de3f350e83ffe04b3e8a44980b6dfb5014e63fee9b67769b8580e4f598 |
| components/cms-governed-review/CmsGovernedReviewDetailIsland.activation.test.tsx | 214 | 43561914794ad73616c535b114729854a4f4f2461563bf00d353b19ce7c5916f |
| components/cms-governed-review/governed-activation-command-spec.ts | 147 | b57a0a1ffd761387fcf4f7623d3b3179c40d7cf1add2ccb6bcd6179f072105fb |
| components/cms-governed-review/governed-activation-command-transport.test.ts | 380 | 6cfc48f87f5f06d32fab951cebe2032753e9bdafd92329f84193ed3a5a428aa9 |
| components/cms-governed-review/governed-activation-contract-drift.test.ts | 121 | ba7e06fb046a3ec242f9c5c5acb45c0e3006034a03e6052787808ffabc823620 |
| components/cms-governed-review/governed-activation-form.test-support.tsx | 123 | 1d87201fe5dd2b5e8bcd0c3b8e8dde336cd08b9dfe1045bade4f334a6f8c85f1 |
| components/cms-governed-review/governed-activation-model.ts | 283 | 226e633f0424074281006a49138126fa2c48bc3e7e8c6ab1745431242f64b1de |
| components/cms-governed-review/governed-activation-refusal.test.ts | 139 | 5903f23aba9965ae9435bfd21ed5c4ee330556bc03c4c7df60e278c17b087617 |
| components/cms-governed-review/governed-activation-refusal.ts | 102 | 43f6f50e9c2c23e2553cc9a176f4844c7657a274cc95f6947d1b172cf3a5b498 |
| components/cms-governed-review/use-governed-activation-form.ts | 204 | 1586de348ccb75c832fe7b437c3b39ddc25765d4cfcb5a9671cd7b8b7652e53f |
| server/cms-governed-review-platform-activation.test.ts | 338 | 0f2a36fd0902a1291a1080b5806b05524075f6bd4f955db9cfab40af97e3156d |
| pages/api/v1/cms/governed-reviews/[reviewId]/activation.ts | 15 | 86ec84490e2ac509df9b951d661491c7b09b65fb7b13c3cb50ad4f73bd9a7c5c |
| components/cms-governed-review/CmsGovernedReviewDetailIsland.tsx (edited) | 121 | c6a571b7cd97f0bdd81f382c4ea75312cbb7c37cc38f22ac6cbf5dde12f8a180 |
| components/cms-governed-review/CmsGovernedReviewPanel.tsx (edited) | 191 | cb6a531cdde0f6cf68cdc4e384b561ef181a68e04da4d312d5f2b1521507cf6f |
| components/cms-governed-review/CmsGovernedReviewPanel.test.tsx (edited) | 351 | 72d432b9036329d22f5ab2ddb1dae2d36ec6af05322e63c3ee1ca9eaabcb8508 |
| components/cms-governed-review/governed-review-labels.ts (edited) | 104 | 1362c97e27c52c82116845561413fa60bd3eaf770e21ccfa8d429adf1a59a37e |
| components/cms-governed-review/governed-review-reasons.ts (edited) | 93 | d387183961a2a1567e5c25f66cd512a697ca33bd0330720777cc4aab4676d64a |
| components/cms-governed-review/governed-review-reasons.test.ts (edited) | 41 | 0580c112e06822a63f338e21e90813cf5510477f0bcab1088511b5fc3c6f25b8 |
| components/cms-governed-review/governed-review-command-specs.ts (edited) | 250 | 4919b466f9774f1df2a54b846be909dda0361a5793454342dc1d3c57d8af78d1 |
| components/cms-governed-review/governed-review-refusal.ts (edited) | 56 | fce083dd358a010de7da1d2ea6f0f1f2db160a31d17269878bce01329b83025f |
| components/cms-governed-review/governed-review-mounts.test.ts (edited) | 154 | 4ca19d4b0bb998355f875b960297bb81e7aa1b4abd1b0a8d7c18ea6e5836bd80 |
| components/cms-governed-review/governed-review-transport.test-support.ts (edited) | 115 | 3c6db95e73326d99116aa6f925767c19b3680bdc9311ffecd9dec5da0e0ad9c0 |
| components/cms-governed-review/README.md (edited) | 93 | 65ac88e907f117a1dcba7e04cf846f4a95577af86b8bb5f6718c0171ee6b80c2 |
| server/cms-governed-review-binding.ts (edited) | 151 | a0f268ed7a6930d6c4d9a777bf23095eea9e69cfca856b587026cdc7fd22dda0 |
| server/cms-governed-review-fixtures.test-support.ts (edited) | 239 | b499ffd4f2bcd212508288473c325eb4a486ce6915ad7470e42b3668442194e2 |
| server/cms-governed-review-platform-command-specs.ts (edited) | 176 | 1e0a1346f62d38f5355ed87f0509a768a490966218274069f9d57687cb1aa6b9 |
| server/cms-governed-review-platform-command.ts (edited) | 192 | 4ce94ffb3af67ec9cc4e975cad1e7ee2811d572552ad8dfba4e32bf8e977f200 |
| server/cms-governed-review-platform-command.test-support.ts (edited) | 250 | 7beb54de04ae2e4430272131e2d4ffd54de9169b85d6a801c28fe596eb0bca1f |
| server/cms-governed-review-platform-error-details.ts (edited) | 239 | 211cefd63d96e05115a6cc7ef75af9c4abad4a8e4bd03004b88176c6b1ead402 |
| pages/api/v1/cms/governed-reviews/governed-reviews-routes.test.ts (edited) | 217 | b073b865b68c932feb4548508e030238f5d8df676f55bfea4041f1e67db39a81 |
| pages/api/v1/cms/governed-reviews/README.md (edited) | 36 | e9249bd2f8d22afa448e625473f3fa236e5d5a89f108d52e1d166c18e4176281 |
| pages/app/cms-content-modeling/definition-reviews/README.md (edited) | 38 | ce83a3a8cdb76447372c5e39c89ef376093d9246dc60f1b35caad6750531fbaf |

Fixtures added to the shared `server/cms-governed-review-fixtures.test-support.ts`: `governedActivationFixture`, `governedScheduledFixture`,
`governedRetiredFixture`, `SCHEDULED_INSTANT` (all parsed through the real contract). Every non-test file is within the limits
(components <= 200, libs <= 300); every test file <= 400 lines.

## Runs (pinned PATH, every Vitest/astro run under `flock -s /tmp/wejammin-quiet.lock`)
- RED observed before each implementation step: proxy cases (module/spec absent: `Cannot read properties of undefined (reading 'operationId')`),
  reasons drift (`GOVERNED_REASONS[operation] is not iterable`), transport (module absent), refusal (classifier answered null), form and
  schedule suites (module absent), island activation suite (7 of 7 failing: form not mounted). The route test was written after the route
  file existed (RED not separately observed; covered by mutant S9).
- Focused GREEN (components/cms-governed-review, server/cms-governed-review*, governed-reviews routes): 32 files, 531 tests before the
  mutation-driven additions; components/cms-governed-review alone: 26 files, 341 tests at the end.
- Mutation battery (script `scratchpad/web-activation/mutate-web-activation.py`; sources restored byte-identical, no `.wamut` left):
  38 mutants (11 server: review/action binding, +1 and unchanged versions, ETag version, success status, step-up op, pointer, route
  operation, Location, declared statuses; 27 browser: schedule version, action binding, Location, reason status, dependency refetch,
  time-token field, retire consequence, "not published" wording, resolved instant sent, reason always sent, offer-all, confirmation
  signature, blocked guard, restore version, eager Time authority, reason max, Escape, island mount, committed restart,
  disambiguation reset, owner copy, focus target, three local resolver checks, panel note, retire confirm sentence). First pass: 33
  killed, 5 survived (confirmation signature ignoring the review version, Continue after a commit, earlier/later reset on a changed
  time, owner copy guard, retire confirmation sentence); five tests were added and all 5 re-run and killed: 38/38.
- Final bytes: `astro check` (apps/web) 0 errors, 0 warnings (175 hints, the known unused-React-import classes); eslint --max-warnings=0
  clean on components/cms-governed-review, server and governed-reviews routes; prettier --check clean on every file above;
  `git diff --check` clean; no TODO, skip, only or `any` in the lane files.
- Full web suite (`vitest run apps/web`): 483 files, 5608/5608 pass (includes `step-up-required.inventory.test.ts`, which needs no new
  entry for this lane: the new files do not read a 401 themselves, the two that do were already classified by root).
  `pnpm bundle:check` needs a build and was not run; the static-closure test is the source-level guard.

## Test corrections (existing oracles changed; none weakened)
1. `pages/api/v1/cms/governed-reviews/governed-reviews-routes.test.ts`: "exactly four endpoint modules" -> five, and the method list
   gained `./[reviewId]/activation.ts` -> `['POST']` (a new registry endpoint, BE03c row 171); one forwarding case added.
2. `components/cms-governed-review/CmsGovernedReviewPanel.test.tsx`: the approved/blocked expectations of "Activation is not available from
   this panel yet." were replaced by the new notes (approved, blocked, active), plus an assertion the old copy is gone and a link
   assertion for review/approved/blocked/active versions (the brief orders the removal).
3. `components/cms-governed-review/governed-review-reasons.test.ts`: the per-operation drift case now includes `CMS-03C-09`.
4. Table-driven suites gained cases, nothing removed: `server/cms-governed-review-platform-command.test-support.ts` (three CMS-03C-09
   cases; `status` widened to 202), `governed-review-transport.test-support.ts` (three inputs).

## Spec citations
FE03 :877-882 (component and props), :902 (ConfirmationStep), :1036-1050 (states; :1048 disabled reason), :1066-1069 (routes, as amended
by DEC-190), :1115-1119 and :1118 (operation row), :1171, :1179-1183 (step-up, DEC-111), :1216, :1403-1465, :1505, :1569, :1798 (data
mapping), :2662 (reconciliation), :2668 (testing). BE03c row 171 and :1326 (ordered steps, retire branch), the error catalog and
`CMS_SLICE_12_OPERATION_REASONS['CMS-03C-09']`. Contracts `governed-activation.ts` (schemas), `refusals.ts` (tokens, statuses), `error-catalog.ts`.
DEC-190 (retire: active-only, no fresh approval), governed worker `## Phase 3` (route behaviour, status table), fix4 and retire reports
(retire advances the review version by one; schedule leaves it).

## Open items / BOUNDARY
1. BOUNDARY: "the 200 renders the activated version and the superseded one" (FE03 :882). `GovernedActivationResource` carries only
   `subjectVersion` (the activated one); no browser read exposes the lineage's previously active version. The form therefore prints the
   activated version and says "Any version that was active before it is now superseded." without a number. Missing spec: a nullable
   `supersededVersion` member in BE03c row 171 / `GovernedActivationResource` (contracts are frozen for this lane).
2. BOUNDARY: "blocked and cancelled schedules show their closed reason" (FE03 :882). The CMS-03C-10 detail has no schedule or blocked-reason
   member and CMS-03C-19 is internal, so the detail shows the subject state `Blocked` only. Missing spec: a closed `blockedReason` /
   schedule-outcome member on `GovernedReviewDetailResource`.
3. No visual treatment: the retire button names its consequence in words but carries no Danger styling (DESIGN.md Buttons); no existing
   shared hook for a destructive button exists and global styles are outside the claim.
4. Browser E2E (later lane) must cover: approved owner activate (200) with the island line, the summary heading focus and the Retire
   control appearing; schedule at a DST gap and fold, out-of-horizon and a past time; the 202 reading "Scheduled, not active"; retire with
   and without a reason, then a second retire attempt from the stale page (409 `subject_not_retirable`, sentence kept); the step-up round
   trip for each action restoring the choice and text and waiting for a new confirmation; a vocabulary with an unbuilt provider
   (`canonical_source_unavailable` naming the domain); `dependency_changed` returning the version to draft; keyboard-only operation,
   Escape on the confirmation, 200% zoom and 320 px reflow. No browser run was possible here (no local stack).
5. `apps/web/src/server/README.md` and `apps/web/src/pages/api/v1/cms/README.md` (outside the claim) do not yet mention CMS-03C-09; the
   lane's own READMEs (components, governed-reviews routes, definition-reviews pages) do.

## Requests to root
1. Process incident, please check: the shared scratchpad `/tmp/claude-1000/-home-rob-Projects-WeJammin/5e403708-.../scratchpad/` is written by
   several lanes. I wrote my mutation script to `scratchpad/mutate.py`, another lane overwrote it with its own worker-taxonomy mutation
   script, and I executed THAT script twice (about 03:47 and 03:57), mutating and restoring files under `apps/worker/src/cms-composition*`
   (15 mutants, each restored by its own `finally`; no `.mutbak` left; every original string it checks was present afterwards except two
   that its owner edited later at 04:05). I also renamed and then restored that lane's `mutate.py` (same bytes). That lane's own mutation
   results from 03:47-04:00 may have been disturbed and its worker files may have been transiently mutated while it ran tests: please have it
   re-run its battery. My own script now lives under `scratchpad/web-activation/` with unique file names.
2. Nothing else is needed from root: the step-up inventory needs no further entry; no contract, migration or Worker change was required.
   Optional: add a `supersededVersion` member (BOUNDARY 1) when the BE03c resource is next amended.
