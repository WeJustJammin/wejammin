# Independent review: lane `claude_s12_web_definition_reviews`

Reviewer: independent (did not author). Read-only except this file. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54`. Author report
`lane-web-definition-reviews-report.md` SHA `480658041d866449275eac5419d6cf145d657a5c116c4c893793cedcc39e330a` (verified).
Item 5 of the template (re-hashing files) skipped on root's instruction. Paths below are under `apps/web/src/`.

## Status
COMPLETE. Verdict at the end. Two majors (one missing permission guard with a fixture-weakened test; one
spec-coverage gap the brief scoped out but the author's report cites as covered), seven minors, no blocker.

## Route-registry clauses (BE03c rows 168-173; FE03 :1069, :1066)
| Clause | Implemented | Tested |
|---|---|---|
| CMS-03C-06 `POST /governed-reviews`: key required, no If-Match (400 if sent), CSRF, strict JSON, 201 bound to body (open, v1, kind/id/hash), no step-up (401 STEP_UP collapses to 502) | `server/cms-governed-review-platform-command.ts:84-176`; `-command-specs.ts:78-97`; `-binding.ts:24-41`; `-error-details.ts:38-50` | `server/...command.test.ts`; `...command-specifics.test.ts:20-68`; `pages/api/.../governed-reviews-routes.test.ts:105-119`; `components/.../governed-review-command-transport.test.ts` |
| CMS-03C-07 `POST …/{reviewId}/decision`: key + strong If-Match = `expectedVersion`, path = body `reviewId` (422 `/reviewId`), 401 `STEP_UP_REQUIRED` with typed details, 200 at version+1 (open/approved; reject → rejected) | `-command-specs.ts:99-116`; `-binding.ts:47-63`; browser `CmsGovernedDecisionForm.tsx:107-116` | `...command-specifics.test.ts:70-140,205-229`; `CmsGovernedDecisionForm.test.tsx` (step-up :172-235, conflict :237-268, 409 tokens :299-325) |
| CMS-03C-08 `POST …/assignments`: key + If-Match, create 201 + exact Location / revoke 200, expiry ≤7 d client-side, reason/expiry bound on the answer, `reviewer_not_eligible` fixed copy | `-command-specs.ts:118-138`; `-binding.ts:68-87`; `CmsGovernedAssignmentCreate.tsx:102-137` | `...command-specifics.test.ts:142-175,231-244`; `CmsGovernedAssignmentForm.test.tsx:178-389` |
| CMS-03C-10 `GET …/{reviewId}`: path only (any query 400), no Idempotency-Key/If-Match/media/body, strong ETag `"{version}"`, 403 vs 404 relayed, bound to this review | `-platform-reads.ts:62-81,130-180` | `...platform-reads.test.ts:65-217`; `governed-review-canonical-read.test.ts`; `load-governed-detail-page.test.ts` |
| CMS-03C-11 `GET …`: allowlist `scope/state/subjectKind/limit/cursor`, duplicates/unknown 400, bounds 422 at member, cursor ≤512, page bound to filters/limit, ETag `"{pageVersion}"`, 409 cursor → restart from page 1 | `-platform-reads.ts:83-127`; `load-governed-queue-page.ts:45-103` | `...platform-reads.test.ts:219-367`; `load-governed-queue-page.test.ts`; `CmsGovernedReviewQueue.test.tsx` |
| Endpoints at registry paths, declared methods only, never prerendered | `pages/api/v1/cms/governed-reviews/**` | `governed-reviews-routes.test.ts:73-91` |
| Pages: SSR, no-store, 303 sign-in, malformed id 400, hidden/absent one 404, 403 copy, URL-owned query | `pages/app/.../definition-reviews/*.astro`; loaders | `definition-review-routes.test.tsx`; loader tests |
| Nav entry from `/app/cms-content-modeling` (vertical slices); panel mounted on template page from a verified detail with only served facts | `index.astro:142`; `templates/[templateKey].astro:168-181` | `governed-review-mounts.test.ts` |
| CMS-03C-09 activate/schedule/retire | Absent by brief; panel states "not available" | `CmsGovernedReviewPanel.test.tsx:91-111` |

Cross-checked against the real Worker, not the author's fixtures: CMS-03C-06 answers 201 with ETag and no Location
(`apps/worker/src/cms-composition/governed-review-routes.ts:118-124`, `governed-review-response.ts:44-49`);
CMS-03C-08 create's Location is the one the proxy demands (`governed-review-command-routes.ts:259-263`); error
messages use the same catalog (`governed-review-errors.ts:169`); step-up details are `{step_up, allowedMethods}`
(`:106-109`); the DB advances the review `version` by exactly one on a decision
(`supabase/migrations/20261014010200_cms_record_governed_decision.sql:250`). The proxy's bindings mirror
`governed-review-validate.ts` line for line.

## Spec conformance (FE03 lines named in the brief)
- :877-882 components: queue scopes/filters/signed cursor; detail with hash, policy basis, semantic decision list
  (own reason only, contract-enforced `review-read.ts:60-67`), `myAssignment`, owner-only summaries by label; decision
  radio pair + persistent reason label + counter + consequence-naming confirm; assignment form owner-only, reviewer
  options from the grant list, person id island-local and absent from the step-up draft. Met, except finding 2.
- :1036-1050 states: idle/loading/success/empty(`no-records`/`filter-miss`/`not-disclosed`)/error/degraded/disabled all
  present; invalidated review shows fixed copy and subject at draft (`governed-review-labels.ts:45-52`).
- :1171 retry: 429 copy waits on Retry-After; 5xx/redirect/lost answer → unknown → reconcile → retry under the same key.
- :1179 DEC-111: draft persisted without the person id, `/step-up?returnTo=`, no auto-replay, re-confirm on return, same
  `Idempotency-Key`, version refetched (sync conflict), malformed details → degraded, no `totp` → degraded. Met.
- :1216 form contract / AC261: islands ship no zod (`governed-review-static-closure.test.ts`); exact member sets.
- :1403 a11y: labelled nav/form/status regions, headings `tabIndex=-1`, fieldset/legend radio group, `aria-current`.
  :1380 responsive and :1736 budgets are not statically verifiable; `bundle:check` not run (author states so).
- :1749 CSRF/same-origin/no-store: proxies enforce (`-command.ts:86-101`), reads carry no mutation header.
- :1814-1916 field ownership: `subjectId`/`lineageId`/`ownerId` never rendered; assignments `[]` for non-owners.
- :2599 error classes, :2640 URL owns query/cursor/selection: met. :2668 Vitest obligations met for 06/07/08/10/11.

## Security
AuthN/Z stays with the Worker; proxies add only hygiene. Ordering matches `cms-workflow-platform-command.ts`
(binding/method 503 → origin 403 → path 400 → query 400 → CSRF 403 → media 415 → headers 400 → body 400/422 → agreement
422 → If-Match 400). Errors relayed only when code AND message equal the catalog for the status; details rebuilt from
closed vocabularies; pointer-only violations (attacker member names never echoed, proven `command.test.ts:110-128`);
`etag`/`location` stripped from errors; rate headers only on 429. 403 vs 404 is the Worker's and relayed unchanged.
Replay/idempotency: key kept across unknown outcomes and step-up, rotated on definite refusal; 2xx not bound to the
request is an unknown outcome at both proxy and browser. No PII, secret or identifier reaches text, URL, storage or logs.

## Tests
Non-vacuous overall: proxy suites mutate status/ETag/Location/body identity/filters; forms drive the real controller;
island tests drive a real re-read to a closed review. Exceptions in findings 1 (fixture hides the defect) and 4.
No skipped/only/todo tests. Mocks never return the expected error pre-classified (all go through the real relay).

## Conventions
Components ≤192 lines, libs ≤266, tests ≤396 (`wc -l`). No `any`, no TODO/FIXME, no console (grep over all lane
files). READMEs present in the three new directories. Matches the Slice 11 precedents named in the brief.

## Author claims re-verified (executed under `flock -s /tmp/wejammin-quiet.lock`, pinned PATH)
- Focused Vitest (lane dirs + `step-up-required.inventory.test.ts`): 25 files, 336/336 pass (author's 33/378 spanned a
  wider directory set; consistent). Inventory now passes with root's three entries.
- `astro check` (apps/web): 0 errors, 0 warnings, 170 hints — exactly as reported.
- Full web suite not re-run (host quiet rule); the two reported failures are outside this lane.

## Findings
1. `components/cms-governed-review/CmsGovernedAssignmentRevoke.tsx:57,69-96` — **major** — the active-assignment list
   with its revoke buttons renders whenever `governedFrameVisible(permitted, phase)` is true, which includes
   `permitted=false` in every readable phase; in `refused` (`cms-workflow-form-state.ts:10-16`) `isCommitBlocked` is
   false, so a click dispatches `controller.submit` although `revoke_assignment` is absent from `permittedNextActions`.
   Create (`CmsGovernedAssignmentCreate.tsx:162`) and the decision form (`CmsGovernedDecisionForm.tsx:134`) guard with
   `{permitted ? … : null}`; revoke does not. Reachable when the re-read after a refusal still lists an active
   assignment while the action is gone (review closed under the owner). Violates FE03 :2678 "the governed panel
   shows an action only when the server permits it". The island test `CmsGovernedReviewDetailIsland.test.tsx:216-249`
   passes only because its closed fixture omits `assignments` (`:221-229`), so `expect(…'ul button').toBeNull()` at :245
   cannot fail. Fix: render the `<ul>` only when `permitted`; add a test whose re-read keeps an active row and drops
   `revoke_assignment`.
2. `components/cms-governed-review/CmsGovernedReviewPanel.tsx:111-133` — **major (brief-scoped)** — FE03 :877 ("its
   review summary") and :1066 ("the panel links to the governed review") are met only in the same session right
   after a submit (`reviewId` state, :111-124). After a reload of an in-review/approved template the panel shows no
   review summary and links to `?scope=owned&subjectKind=…` (:128), the owned queue, not the review. The brief limited
   the panel to the submit action, so root may accept this as a tracked follow-up, but the author's report cites
   :1066 as covered. Fix: resolve the subject's review on the template page (CMS-03C-11 `scope=owned&subjectKind`,
   match `subjectKey`/`subjectVersion`) and pass `{reviewId, state, counts}` to the panel; or move it to Open items.
3. `server/cms-governed-review-platform-error-details.ts:204`, `server/cms-governed-review-platform-errors.ts:51` —
   minor — `retryable: status !== 502` contradicts the Worker (`governed-review-errors.ts:111-113`, BE00 172:
   `retryable: true` on 502/503/504) and FE03 :1030. No consumer reads it today. Fix: publish `true` for 502-504 or
   cite the line that makes a local 502 non-retryable.
4. `components/cms-governed-review/CmsGovernedReviewQueue.test.tsx:177-181`, `pages/app/…/definition-review-routes.test.tsx:134`
   — minor — "never prints a person/hash identifier" asserts against fixtures that contain no hash or person id
   (queue items have none; SSR never loads reviewer options), so the assertions cannot fail. Fix: assert the rendered
   field set against the contract members, or drop the claim.
5. `components/cms-governed-review/CmsGovernedAssignmentFields.tsx:85` — minor — the reviewer option label prints the
   `personId` as text (as the precedent `CmsEditorialAssignmentCreate.tsx:202` does; FE03 :1898 allows it inside the
   owner island), but the report's E2E note "no person id in DOM" overstates. Fix the report; a server label would need
   CMS-03A-18 to provide one.
6. `components/cms-governed-review/load-governed-queue-page.ts:26-27` — minor — description promises "activate" on a
   surface with no activation (CMS-03C-09 unbuilt). Copy fix.
7. `components/cms-governed-review/CmsGovernedReviewQueue.tsx:157-160` — minor — `Risk class: {riskClass}` and
   `Your decision: {myDecision}` print raw tokens (`ordinary`, `none`); FE03 :1036 wants fixed copy per token. Add labels.
8. `CmsGovernedAssignmentForm.test.tsx`, `CmsGovernedReviewDetailIsland.test.tsx` — minor — React `act(...)` warnings
   from the reviewer-options promise (stderr of the run). Wrap the options load in `flush()`/`act`.
9. `components/cms-governed-review/governed-review-static-closure.test.ts` — minor — duplicate of
   `cms-island-static-closure.test.ts` (author acknowledges :6-14); extensibility rule forbids the copy. Root-owned fold.

## Ruling on the author's follow-up suggestions
1. Inventory classification (stepUpAware ×2, WORKER_READ exempt ×1): correct; applied by root; passes.
2. `pattern-instances.test.ts` 502: another lane's in-flight work; no ruling here.
3. Exporting governed resource schemas to `cms-editorial/validators.ts` for strict browser parsing: decline for now.
   The proxy parses strictly and binds; the browser's structural bound repeats identity, ETag and Location. A lazy
   validator on the commit path adds a fetch for no new guarantee. Folding the closure test: accept (finding 9).
4. `classify?` option on the shared controller: accept as a follow-up when the controller is next edited. The present
   post-hoc override is behaviourally safe: for `subject_not_submittable` the shared table already yields
   `refetch`+`refetch:true` (`cms-workflow-refusal.ts:237-244`) and for `canonical_source_unavailable` `field`+
   `rotateKey:true` (`:275-281`), the same side effects the override copy declares (`governed-review-refusal.ts:36-51`).

## Requests to root
- Dispose of finding 2 explicitly (follow-up lane item or in-lane fix) and have the author move :1066 to Open items.
- Finding 1 is a one-line guard plus one test; integrate after it lands.

VERDICT: PARTIAL
