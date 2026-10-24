# Lane report: claude_s12_web_definition_reviews (Web surface, FE03 CMS-03C-06/07/08/10/11)

## Status
GREEN for the lane scope, with two root-owned items outside the claim (see Requests to root 1 and 2). Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54`, 2026-10-14 (17:13 local).

## Scope
Delivered: protected queue `/app/cms-content-modeling/definition-reviews` and detail `.../:reviewId` (FE03 :1069);
`CmsGovernedReviewQueue`, `CmsGovernedReviewDetail` (+ island), `CmsGovernedDecisionForm`, owner
`CmsGovernedAssignmentForm` (create + revoke); the Submit-for-review action of `CmsGovernedReviewPanel` mounted on the
template designer page through `CmsGovernedTemplatePanel`; first-party proxies for CMS-03C-06/07/08/10/11; nav entry in the
`/app/cms-content-modeling` primary navigation. Out of scope as briefed: CMS-03C-09 activation form and Retire.

## Design decisions
1. Zero zod in the browser (FE03 AC261). Requests are built by code from server-verified data; the decision reason uses the
   existing lazy `DecisionReasonSchema`; a commit is verified structurally in the browser (status, strong ETag = quoted version,
   request identity, Location) because the same-origin proxy has already parsed the strict governed resource and bound it to
   the request. `governed-review-static-closure.test.ts` proves the two islands reach no zod, barrel or lazy entry statically.
   Hard-coded vocabularies (`governed-review-reasons.ts`, `governed-review-labels.ts`) have drift-guard tests against the contracts.
2. The shared Slice 11 command controller and refusal table are reused: CMS-03C-07/-08 are the 03b -06/-18 contracts applied to a
   definition review (DEC-137), so `GovernedCommandSpec.classifyAs` selects the shared fixed copy; the two submission refusals
   it cannot speak (`subject_not_submittable`, `canonical_source_unavailable` naming the domain) are classified in
   `governed-review-refusal.ts` from the refusal the governed transport keeps. Draft keys name the governed operation
   (`CMS-03C-07`, `CMS-03C-08-create|revoke`), never colliding with the editorial forms.
3. Defect found in the precedent and avoided here: a refusal triggers the canonical re-read, and the re-read can remove the very
   action the refusal was about (review closed), which unmounts the form and erases the sentence. Governed forms stay mounted and
   draw their frame while the server permits the action OR the command still has something to say
   (`governed-review-form-visibility.ts`); island tests drive a real re-read to a closed review.
4. Proxy errors are verified against the BE03c catalog (code and message must be the catalog's for the status, step-up code only on
   -07/-08) and details are rebuilt from the operation's reason list and request pointers (`CMS_SLICE_12_OPERATION_REASONS`).

## Files (path under apps/web/src, lines, SHA-256)
| path | lines | sha256 |
|---|--:|---|
| components/cms-governed-review/CmsGovernedAssignmentCreate.tsx | 192 | 79a23411110f591cadbda56f314530c6a4f40168cd5240c4a91b3faa05e55f4b |
| components/cms-governed-review/CmsGovernedAssignmentFields.tsx | 111 | 7b5186b72c0885b8c2cb7c819cf643bc10af68e8d5e3c3da86d620c3da2adf5d |
| components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx | 389 | 46501fad870b80ffd3314d44b0a90d90f042cd2af6dc15bcdba9ea7e5e560971 |
| components/cms-governed-review/CmsGovernedAssignmentForm.tsx | 66 | 439b1749a96e5d771be5ff3d803bb7b9c06f3c5264652d0f05d9c92712e25e97 |
| components/cms-governed-review/CmsGovernedAssignmentRevoke.tsx | 99 | 00dba13737c2ae22432e1e5705b8f6f70f8f842dff62d43f2be8dacc29102507 |
| components/cms-governed-review/CmsGovernedDecisionForm.test.tsx | 357 | 9f3857cb50d0c1a80dfe301ece8c6378ed5ca45ef75d654ff5dc233cc95442be |
| components/cms-governed-review/CmsGovernedDecisionForm.tsx | 171 | d8cbb847fcf4a3fc190da82516f6c1b0e600af2f15d86bf65590b7c532a53aba |
| components/cms-governed-review/CmsGovernedReviewDetail.test.tsx | 166 | 81152642248579397960e5f9367add38a2540df437026b3700e13dd737e3e283 |
| components/cms-governed-review/CmsGovernedReviewDetail.tsx | 179 | 3ff53573e6897f9aa45ddff28f8c623f0aa3747e278030a8df0fe7fb8bdf82fc |
| components/cms-governed-review/CmsGovernedReviewDetailIsland.test.tsx | 338 | 29e1f77446ee3323214dabc2e7835ad912f172f46edce37253e1f763bb841f4d |
| components/cms-governed-review/CmsGovernedReviewDetailIsland.tsx | 110 | aec5c97f8c049cc545919918cab64f8eaa7e818f4d93f1eb811f89e0486f1215 |
| components/cms-governed-review/CmsGovernedReviewPanel.test.tsx | 249 | 2c088fe7c6f6ee7950f1eb7486a094cbba25ae6d10860f89fe6076e35083cdf8 |
| components/cms-governed-review/CmsGovernedReviewPanel.tsx | 177 | 5c393c6bc78f51daee27adfd669f610ead9a8f8a9597c914259f3f3c2a442b6b |
| components/cms-governed-review/CmsGovernedReviewQueue.test.tsx | 182 | d6154443462ab06c51f71cc9781a31016d9b721968731dd9e7d0405b54340132 |
| components/cms-governed-review/CmsGovernedReviewQueue.tsx | 183 | 53eebf4cfcfb92a7127ec3facb73489eb391420e9ecb3489f1f2e0c76f7d59ff |
| components/cms-governed-review/CmsGovernedTemplatePanel.test.tsx | 111 | 8330e6112576ac0b6204b6c8b30413789a6d1b0e19fb3b21240a8500304ca5d9 |
| components/cms-governed-review/CmsGovernedTemplatePanel.tsx | 64 | 30ec654690ff35fbb7a2c38f9335182e31c642c394f1e37bf4ea3754e37df915 |
| components/cms-governed-review/README.md | 75 | 185767a2be06ee8247a179e08d038d7313b334d006239cece2b28629f94bb51d |
| components/cms-governed-review/governed-review-canonical-read.test.ts | 103 | 67672cc5a0205dd428d774c1c3e707e3d415eca02edec49bfd373136e9df45eb |
| components/cms-governed-review/governed-review-canonical-read.ts | 122 | 2f9f54bc3593061deb8a3df3d46a343077555c22ec1ee7a85129e041438ed6d3 |
| components/cms-governed-review/governed-review-command-failures.test.ts | 141 | c0e4afda1901dbbc0717f745b1d3350d698b0c46d203f2e3cd79a2c3411bda5d |
| components/cms-governed-review/governed-review-command-specs.ts | 239 | 5e428e8120b790ad97ccc137b370ab26b283b9e60eed85fe4c5deca1a733624e |
| components/cms-governed-review/governed-review-command-transport.test.ts | 275 | 00efbe87a02fa941d6c506c923a12517511fc7f748ac737b285fec900428c727 |
| components/cms-governed-review/governed-review-command-transport.ts | 266 | 0b87f72dedb7dd95e08732ec5bb3ecc1cacd977cceae1de7029ccccf60a8206d |
| components/cms-governed-review/governed-review-form-test-support.ts | 49 | 4ece4f10c7c1cb444b59d99f2d4dd2539f63081836beb0c26cd46d8a0b25d9bc |
| components/cms-governed-review/governed-review-form-visibility.ts | 26 | 37ca606d56da2e1ac0e3819e429292f596195ff63e5e8d5d9e3d7e88009ed7af |
| components/cms-governed-review/governed-review-labels.test.ts | 54 | fc8994a4ca892ff84d02b3497873349f0a7d7793340bb303b60279ddf8dd264d |
| components/cms-governed-review/governed-review-labels.ts | 64 | d65e63525eb8a893d2cf7b292ff5c0332b389208f369158135ae4538b1fb6997 |
| components/cms-governed-review/governed-review-mounts.test.ts | 73 | 75b3c0cf548b1d2724c0edec39215cde4d04fcc928589629ea284d85ad2a2be5 |
| components/cms-governed-review/governed-review-page-reads.test.ts | 61 | 677698867e376070d6fe5710defb8ddfb74fd484883ece227fc5645d38a8df60 |
| components/cms-governed-review/governed-review-page-reads.ts | 44 | df998ec408af6fde667c4e3d38045e792ef9b81fb1887e33ff41dabdc9bb821b |
| components/cms-governed-review/governed-review-reasons.test.ts | 41 | 6c2c15a34180783b39c6347e609d61b7d2709b14c41c60013f9dcadbef53aa59 |
| components/cms-governed-review/governed-review-reasons.ts | 64 | b2dad4e9c32f93c1839d7740ee76a1e176306459a7237f8cd414741eb3435a86 |
| components/cms-governed-review/governed-review-refusal.test.ts | 90 | 9971755559ba643e165a8ee4f5005570d9851bef8612d7f38691a84ba525c186 |
| components/cms-governed-review/governed-review-refusal.ts | 53 | b0ee750252703aa2a1699828e0a19d41b907d5b9b2dd19fc9fce4964010271de |
| components/cms-governed-review/governed-review-static-closure.test.ts | 94 | 4b72ed26805ff50f0ff10a74a78f9a6a72883787b39fd54a60c15b1d29f74949 |
| components/cms-governed-review/governed-review-transport.test-support.ts | 84 | fea499cc0df04c0a8e9c55d9011599a24f9c438f39f65fa3f105812973d2fa46 |
| components/cms-governed-review/load-governed-detail-page.test.ts | 98 | bb8e2fab817eee7d56b08609344a8853d8f09f49e31c5eb31c5cc31007df5268 |
| components/cms-governed-review/load-governed-detail-page.ts | 79 | a0b31a89cf0c50b55e1d3da4aa78ff336e97af1b773c24a36d09e94c19ad207e |
| components/cms-governed-review/load-governed-queue-page.test.ts | 148 | d439a45fec0d14b15481c88cc7ace6b24083bba78e873cc3cda31f96e1cbe143 |
| components/cms-governed-review/load-governed-queue-page.ts | 103 | 0687254a35f8d8eadd96bd1361cb5ba48790abbe19009e7e1c0bea20bab00a51 |
| components/cms-governed-review/use-governed-review-command.ts | 113 | a133fb727eb617038b0510e0c5922871f0050b76e6600fdda243327e7c670de4 |
| pages/api/v1/cms/governed-reviews/README.md | 35 | 47dacd68373f10dba6d071604d75ba825c32b85a7fa28bcd615141c0f1633baa |
| pages/api/v1/cms/governed-reviews/[reviewId].ts | 15 | 71225e3dd7711ac8ecd63532faa72b965d0abcc103d4282f0b2334afddc44f95 |
| pages/api/v1/cms/governed-reviews/[reviewId]/assignments.ts | 15 | 547195a876c658c778d1dbceb25d455af749a0625f0befd4773528458099b388 |
| pages/api/v1/cms/governed-reviews/[reviewId]/decision.ts | 15 | 9e2b9fb2c8898932868a32bd71aa79023d26d05777c8eb2deddca028f3a5d0f0 |
| pages/api/v1/cms/governed-reviews/governed-reviews-routes.test.ts | 195 | aa1d3566cc6229f63d00c2cf74b8c4951e369f1143ea293c5f95d3b48e9831fa |
| pages/api/v1/cms/governed-reviews/index.ts | 15 | 81378f32a5b298b82fc0dcc6ed33152b0f7572b372c6d0cc0a8cfb38ebf2df7f |
| pages/app/cms-content-modeling/definition-reviews/README.md | 35 | 957e4b8347220d064ac6336b6173910c7d0607683818c21be8935f3161bf037d |
| pages/app/cms-content-modeling/definition-reviews/[reviewId].astro | 57 | 0ace10967b5e3a5ad2e1e3751720a4d7cc1e51eeb34320a0872a19fe79165e28 |
| pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx | 201 | 8af9a0abe2bf95c3df4a1dbb023658eb8b3441c0f99ce136040566cf365f7040 |
| pages/app/cms-content-modeling/definition-reviews/index.astro | 55 | 9272471e4f7b0e1a1bb030eac842c131c464aec74b60bcdddf14869f5d6b73dd |
| server/cms-governed-review-binding.ts | 118 | fb2b36f3f131ded9e11d51d30d3993b80b251b526dd567dc2b5cd4f28e7e5cee |
| server/cms-governed-review-fixtures.test-support.ts | 182 | 773f812a0544edec69426d8139f1dba04d3343e050d85a0785000c3671f5086e |
| server/cms-governed-review-platform-command-specifics.test.ts | 245 | 282391cb5b4f1bc7f53205591915b00fe8202529aea599e7d5f666cac8d0c7f4 |
| server/cms-governed-review-platform-command-specs.ts | 144 | 5292f23a3e5ad3c5edc20f5aeedccc74192d0ce9df1051982b4bbde05cbc7aed |
| server/cms-governed-review-platform-command.test-support.ts | 197 | 1b5c9607a3117a678e4431d4b2ffe70fb6493d574adae828eba67ccfaf50a0e0 |
| server/cms-governed-review-platform-command.test.ts | 186 | 386dc4ffde2e9e4cf6e0fc78048954513c11bba81a494b2bb7ca93cd55687376 |
| server/cms-governed-review-platform-command.ts | 192 | 529afe5931fecc69ae9bdaaa816496e5b6970361ce7a056e2399ad41ca2acf74 |
| server/cms-governed-review-platform-error-details.ts | 220 | 404dc5e6f1d3d52a3a429ed1915fc239f5f1a3173ff2ba890cedb111681d69d8 |
| server/cms-governed-review-platform-errors.test.ts | 396 | 4da5abd74847732b897531097ce57e24dfe76dd407495530dd5bdc00da877b3a |
| server/cms-governed-review-platform-errors.ts | 128 | 7dce26b615391be2677c73b35b88a950ed6e56b43f0a9ab13109f65c2e820663 |
| server/cms-governed-review-platform-reads.test.ts | 367 | 04547308ae8d9b3a580e839996dd9c02e399c2fced1248a5b8e090169ee00eef |
| server/cms-governed-review-platform-reads.ts | 180 | 287735ba04f7e61cb3f05289c8474ee20cc00cd01606d4963496365ddf88f243 |
| pages/app/cms-content-modeling/index.astro (edited) | 170 | 45715d02741d52c088196c82bcbbb2148df993a84a0d2b5815d742c4679567fb |
| pages/app/cms-content-modeling/templates/[templateKey].astro (edited) | 186 | cce34048e805b5986a77b25d55295ab3087e0e12d31e9622e91c564a6f9d0171 |

Preexisting edits by other lanes in `apps/web` (cms-workflow-labels.ts, cms-composition-platform-pattern*, cms-editorial-platform-bounded*)
were not touched. Every non-test file is within the size limits (components <=200, libs <=300); every test file is <=400 lines.

## Runs (all `pnpm exec vitest run` from the worktree root under `flock -s /tmp/wejammin-quiet.lock`, pinned PATH)
- RED observed (module absent) before implementation for: errors proxy, reads proxy, browser reasons/transport/refusal path, decision form,
  assignment form, island, panel, template panel, loaders, page reads, detail view, pages. Authored together with their implementation
  (RED not separately run, covered by the mutation battery below): command proxy, API route tests, labels, queue view, canonical read,
  mounts/closure tests.
- 16:38-17:12: focused suites green. Final focused set (components/cms-governed-review, server/cms-governed-review*, governed-reviews routes,
  pages/app/cms-content-modeling): 33 files, 378/378.
- Mutation battery (script in scratchpad): 30 targeted mutations (message equality, step-up scoping, canonical domain, empty-filter absence,
  duplicate query member, page ETag, page filter binding, decision version+1, assignment reason, If-Match on submit, Location, CSRF, 5xx unknown marker,
  route operation, browser ETag, domain closed set, reason status match, reject-state binding, frame visibility, draft key, refusal override, consequence copy,
  own-reason-only, cursor on scope change, successor reset, canonical-read ETag, cursor 409 restart, nav link, panel mount, zod in closure): 30/30 killed, sources restored byte-identical.
  Two gaps found by it were closed (decision/assignment/submission binding beyond identity).
- `astro check` (apps/web): 0 errors, 0 warnings (170 hints, same classes as the precedent: unused React import in tests). eslint --max-warnings=0: 0.
  prettier --check: clean. `git diff --check`: 0. No TODO, skip, only or `any` in the lane files.
- Full web suite (`vitest run apps/web`, 17:06): 450 files, 4977/4979 pass; 2 failures, neither a defect of this lane's behavior:
  (a) `components/step-up-required.inventory.test.ts` (AC1127 sweep guard) lists every file that reads a 401 and this lane adds three:
  see Requests to root 1; (b) `pages/api/v1/cms/compositions/pattern-instances.test.ts` returns 502 for CMS-03C-02: that route and its proxy
  (`cms-composition-platform-pattern*`) are another lane's uncommitted in-flight work, untouched here.
  Bundle budget (`pnpm bundle:check`) needs a build and was not run; the closure test is the source-level guard.

## Test corrections
none (no existing oracle changed).

## Spec citations
FE03 :877-882 (components), :1036-1050 (states), :1066-1072 (routes, :1069 definition reviews), :1115-1119 (operations), :1171 and :1179 (retry, step-up
DEC-111, same recovery as `CmsEditorialDecisionForm`), :1216 (form contract), :1460-1465 (props), :1566-1571, :1598, :1695-1700, :1718 (responsive),
:1736 (budgets), :1795-1799 (data mapping), :2662 (reconciliation), :2678 (testing). BE03c rows 168-173, error catalog (`error-catalog.ts`),
`refusals.ts` reason lists. Vertical-slices rule: nav link and panel mount are guarded by `governed-review-mounts.test.ts`.

## Open items / BOUNDARY
1. BOUNDARY: `CmsGovernedActivationForm` and the Activate/Schedule/Retire actions of `CmsGovernedReviewPanel` (CMS-03C-09). Missing: Worker transport for
   09 (not built) and the retire policy (owner decision pending). The panel says "Activation is not available from this panel yet." for approved/blocked
   versions; the detail never offers activate/schedule/retire although `permittedNextActions` may list them. No stub control exists.
2. The panel is mounted for templates only. Pattern (`patterns/:patternKey`) and taxonomy (`taxonomies/:taxonomyId`) pages do not exist yet;
   `CmsGovernedReviewPanel` is subject-generic, each page needs a thin wrapper like `CmsGovernedTemplatePanel`.
3. (Resolved in the fix pass.) Two copies of the static-closure helper existed (`cms-island-static-closure.test.ts` outside the claim, mine inside); fold the two entries into the
   original and delete `governed-review-static-closure.test.ts`.
4. `apps/web/src/server/README.md` and `apps/web/src/pages/api/v1/cms/README.md` were not edited (outside the claim); the new directories carry their own READMEs.
5. Browser E2E (later lane) must cover: queue scopes, filters and cursor restart on 409; detail as assignee (decision approve and reject, reason bounds, step-up
   round trip restoring the draft under the original key, separation_of_duties gate, review_not_open after a concurrent close with the refusal sentence kept);
   owner assignment create/revoke (island-local reviewer id, expiry bounds, step-up; the reviewer option label prints the person id inside the owner island only, as the editorial precedent and FE03 :1898 allow, so "no person id" applies to URL, storage, logs and the step-up draft, not to the owner's select); submit-for-review from the template page
   (id/hash never typed, canonical_source_unavailable naming the domain on a vocabulary page when built); keyboard-only operation, 200% zoom and 320px reflow;
   an invalidated review (dependency_changed) returning the subject to draft.

## Requests to root
1. `apps/web/src/components/step-up-required.inventory.test.ts` (outside my claim) must classify three files this lane added that read a 401:
   stepUpAware: `components/cms-governed-review/governed-review-command-transport.ts`, `server/cms-governed-review-platform-error-details.ts`
   (both name `STEP_UP_REQUIRED` / `classifyStepUpResponse`); exempt (WORKER_READ): `components/cms-governed-review/governed-review-canonical-read.ts`.
   Nothing else is needed; this is the only failure attributable to the lane.
2. `apps/web/src/pages/api/v1/cms/compositions/pattern-instances.test.ts` fails (502) in the shared worktree because of another lane's in-flight pattern proxy work.
3. Optional, not blocking: export `GovernedReviewResourceSchema`, `GovernedReviewAssignmentResourceSchema` and `GovernedReviewSubmissionRequestSchema` from
   `packages/contracts/src/cms-editorial/validators.ts` so the browser transport can parse commit answers strictly (today: structural), and fold the closure entries
   into `cms-island-static-closure.test.ts`.
4. Optional: add an `classify?` option to the shared `createWorkflowCommandController` so `use-governed-review-command.ts` can drop its refusal override.

## Fix pass (2026-10-15, review `review-web-definition-reviews.md`, brief `web-defreview-f1.md`)

Status: GREEN. All nine findings dispositioned (2 majors fixed, 7 minors fixed or corrected). Worktree HEAD `b16edb54`.

| # | Finding | Disposition |
|---|---|---|
| 1 | major, revoke buttons without permission | Fixed. `CmsGovernedAssignmentRevoke.tsx` renders the `<ul>` of revoke buttons only when `permitted` (the frame stays for the refusal sentence). RED first: the island test's closed re-read now keeps the active assignment and drops `revoke_assignment` (it asserts `Reviewer A` is still shown and `ul button` is null); it failed with the live `Revoke Reviewer A` button, then passed. |
| 2 | major, panel summary and link | Fixed (in-lane, not deferred). New `load-governed-subject-review.ts` resolves the subject version's review on the server from the owned queue (CMS-03C-11 `scope=owned&subjectKind&limit=50`, signed cursor followed for at most 4 pages, exact kind+key+version match, any failure = null). New `CmsGovernedPanelReviewSummary.tsx` prints `Review: <state> · n of m decisions · Open the review` linking `/definition-reviews/{reviewId}` (FE03 :877, :1066). `CmsGovernedReviewPanel` takes `review`, replaces it from the committed answer after a submit, and forgets it for a successor draft (keyed by subject id). The owned-queue link remains only as the honest fallback when no review is resolved. Template and pattern wrappers pass `review` through; both pages call the loader (template page; pattern page is a minimal edit of the other lane's file, see below). The committed-answer structural check now also demands `subjectId` and `requiredDecisionCount` (RED row in the unknown-outcome table first). |
| 3 | minor, `retryable` | Fixed. Both proxy sites publish `retryable: true` for 502, 503 and 504 (BE00 172; Worker `governed-review-errors.ts:111-113`). Two oracles of mine asserted `false` for 502 (see Test corrections). |
| 4 | minor, vacuous leak assertions | Replaced. Queue: visible text (tags stripped) never contains a review id (it is only an address in the `href`), and the strict page schema rejects `personId`, `subjectHash` and `reviewerPersonId` members. Routes: a detail body whose assignment carries `reviewerPersonId` is refused as a notice and never rendered; the benign owner case now also asserts `Reviewer A` is rendered so the absence check can fail. |
| 5 | minor, person id in the owner select | Report corrected (Open item 5 wording above). No code change: FE03 :1898 allows it inside the owner island. |
| 6 | minor, "activate" copy | Fixed: `GOVERNED_QUEUE_DESCRIPTION` = "Review and approve templates, patterns and vocabularies." |
| 7 | minor, raw tokens | Fixed with labels `GOVERNED_RISK_CLASS_LABEL`, `GOVERNED_MY_DECISION_LABEL` (`none` = "None yet"), `GOVERNED_DECISION_LABEL` (Approved/Rejected) in `governed-review-labels.ts`, used by the queue and, for the same raw tokens, the detail (risk class, decision rows). Drift-guard test covers each table against the contract options. |
| 8 | minor, act() warnings | Fixed. Verified 0 "not wrapped in act" occurrences across the full web run. Causes: sync assertions before the reviewer-options promise settled (now `await flush()`), and `vi.waitFor` polling that let step-up state updates land outside `act` (replaced by `flushUntil` in `governed-review-form-test-support.ts`, which loops `flush()` plus a macrotask tick inside `act`, bounded at 25 turns). |
| 9 | minor, duplicate closure test | Folded. `CmsGovernedReviewDetailIsland.tsx`, `CmsGovernedTemplatePanel.tsx` and `CmsGovernedPatternPanel.tsx` are entries in `apps/web/src/cms-island-static-closure.test.ts`; `governed-review-static-closure.test.ts` is deleted. Mutation: a `zod` import in the revoke form fails the folded test. |

### Files touched in the fix pass (sha256, lines; paths under apps/web/src)
| path | lines | sha256 |
|---|--:|---|
| components/cms-governed-review/CmsGovernedAssignmentRevoke.tsx | 102 | e5cb099c633478e98f211576a3b76658e3b2f4d7788b9ebbb43d4da9d6bff8e3 |
| components/cms-governed-review/CmsGovernedReviewPanel.tsx | 193 | 47c2978e93ed6da927d734efc494e3719ccf0aaaa4b2652c6596e7f82b28b989 |
| components/cms-governed-review/CmsGovernedPanelReviewSummary.tsx (new) | 29 | dafb4060b5c9c056232182ed4c1c2a05497c3ce9bd2b2364bc21bdf8d85c3426 |
| components/cms-governed-review/CmsGovernedTemplatePanel.tsx | 69 | 9e8436457264f13e75e1686302896040354d6b57cc3a57375a1dbec6886ecbbe |
| components/cms-governed-review/CmsGovernedPatternPanel.tsx (pattern lane's file, extended) | 71 | 8bf6f5137e806bca7f1447eb8dcdcb7b2ee655f754f27b2751453ab7051c1a47 |
| components/cms-governed-review/CmsGovernedReviewQueue.tsx | 186 | a92f614a64853f4baabe5fd87c02eeb9c254220c933d1966efa566162502664e |
| components/cms-governed-review/CmsGovernedReviewDetail.tsx | 182 | b58a516109e86031d634557ae41235474860d7171113be632bcd5fdf8fe53f1a |
| components/cms-governed-review/load-governed-subject-review.ts (new) | 91 | 009d94ce31a3ae0cbfbb7ed5841d7c94b7346173df87e42de15554c3777f1591 |
| components/cms-governed-review/load-governed-subject-review.test.ts (new) | 148 | 310bbf442f87dbf67bc53232595f08ad54185496a9a116bc13cdc5cec61b564a |
| components/cms-governed-review/governed-review-labels.ts | 88 | ba3ce122fe7b30acbf40c507f1e564de6975ea719b34c1770e8160d5b36f7495 |
| components/cms-governed-review/governed-review-command-specs.ts | 246 | fd33ace1d8917fc2429e42bf9552af4283e523706f041360dbd9e4de51bd320f |
| components/cms-governed-review/governed-review-form-test-support.ts | 69 | 886ed5b0f55e79db83090484cb151b4451743df67349a17835ad6fa46314e157 |
| components/cms-governed-review/governed-review-mounts.test.ts | 121 | e2759c8eff2857e1acbf319e8c24bc643c05e5841d4438f965ea9f74b41516be |
| components/cms-governed-review/CmsGovernedReviewPanel.test.tsx | 340 | 30f1e34c3ec245db213b9a97aa6f1538ba78430d8a9c992ead1f93fd44b98726 |
| components/cms-governed-review/README.md | 79 | ccbe01e7f3c891a37cc37857693f57ad19beb292071b04d3937a49238c83bac3 |
| pages/app/cms-content-modeling/templates/[templateKey].astro | 203 | 4204e60aaefa551eb3693d0be370220a16615af55a3c35a10a94607f4873ce9c |
| pages/app/cms-content-modeling/patterns/[patternKey].astro (pattern lane's file, minimal edit) | 86 | e3c7dc8a9eb5bed9d01a49c528b97a51a398ff00ec12731d51e2910fa9688c9f |
| cms-island-static-closure.test.ts | 141 | 524d67b81d129382db65f9c9ae1d34419f2bbf3fa49d1ee024ea66a8af7a4537 |
| server/cms-governed-review-platform-errors.ts | 128 | 82949a968859f8f958ab1966ae161e1a44a4aade8a060e06541f9c447584fcf6 |
| server/cms-governed-review-platform-error-details.ts | 221 | 2706cf6910e92615a560357a4ab87f324ccd7fa705fd8042b516720ddceaa7cd |
| server/cms-governed-review-platform-errors.test.ts | 396 | ef0e05106669ec50fb62c38c9894eb036632cf5121566765f4586fa26e2d766d |

Also edited (hash not repeated): `CmsGovernedReviewDetailIsland.test.tsx`, `CmsGovernedAssignmentForm.test.tsx`, `CmsGovernedDecisionForm.test.tsx`,
`CmsGovernedReviewQueue.test.tsx`, `CmsGovernedReviewDetail.test.tsx`, `CmsGovernedTemplatePanel.test.tsx`, `CmsGovernedPatternPanel.test.tsx`,
`governed-review-labels.test.ts`, `governed-review-command-transport.test.ts`, `load-governed-queue-page.test.ts`, `load-governed-queue-page.ts`,
`pages/app/.../definition-reviews/definition-review-routes.test.tsx`. Deleted: `components/cms-governed-review/governed-review-static-closure.test.ts`.
`load-governed-subject-review.ts` is server-only (imports the strict queue schema); no island imports it (only `import type`), which the folded closure test proves.

### Coordination with the pattern-designer lane
Read `lane-web-patterns-report.md`. `CmsGovernedPatternPanel` (its file) gained one optional `review` prop passed straight through; its mount test regex in
`governed-review-mounts.test.ts` was relaxed from `<CmsGovernedPatternPanel detail=` to `<CmsGovernedPatternPanel\s+detail=` because prettier now breaks the
element over lines (formatting only, assertion unchanged); the pattern page gained one loader call and the `review={panelReview}` prop. Nothing of the pattern lane
was reverted; its panel, nav, mount and pattern tests all pass.

### Test corrections (own oracles, for independent review)
1. `server/cms-governed-review-platform-errors.test.ts`: two assertions `retryable: false` for status 502 became `retryable: true` (BE00 172; Worker `governed-review-errors.ts:111-113`); test title updated.
2. `CmsGovernedReviewQueue.test.tsx` and `CmsGovernedReviewDetail.test.tsx`: `Risk class: protected`, `Your decision: approve`, `Decision: reject` became `Risk class: Protected`, `Your decision: Approved`, `Decision: Rejected` (FE03 :1036 fixed copy per token; finding 7).
3. `load-governed-queue-page.test.ts`: the description oracle follows the copy fix (finding 6).
4. `CmsGovernedReviewDetailIsland.test.tsx`: the closed re-read fixture now includes the active assignment (finding 1) and asserts it is still shown.
5. `governed-review-mounts.test.ts`: whitespace-tolerant regex described above, plus two new describe-level assertions for the loader and `review={panelReview}` on both pages.

### Runs (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`, from the worktree root)
- RED observed for: revoke guard (1 failure, live `Revoke Reviewer A`), loader (10/10, module absent), panel summary (5 failures), template/pattern pass-through (2), labels/queue/detail (4), `retryable` (2), submission answer without `requiredDecisionCount` (1), description copy (1), act-clean step-up tests (2 failures until `flushUntil` waited a macrotask).
- Mutation battery (11 targeted, then 4 survivors closed with new tests, re-run): loader version match, key match, scope, status check; summary link text; fallback link gate; successor reset; label token; retryable at both sites; revoke guard. Final: all killed; sources restored byte-identical (suite green afterwards).
- Focused set `components/cms-governed-review pages/app/cms-content-modeling server/cms-governed-review`: green.
- Full web suite (`vitest run apps/web`): 474 files, 5400/5400 pass; 0 `not wrapped in act` lines. The two failures reported in the first pass are gone (root classified the inventory; the pattern-instances route is fixed by its lane).
- `astro check` (apps/web): 0 errors, 0 warnings, 176 hints (the unused-React-import class in tests, same as the precedent; the count moved with other lanes' files). eslint `--max-warnings=0`: clean. prettier `--check`: clean. `git diff --check`: clean. No TODO, skip, only, `any` or console in lane files; components at most 193 lines, tests at most 396.

### Open items after the fix pass
- BOUNDARY unchanged: CMS-03C-09 activation form and Retire (Worker transport not built; retire policy awaits the owner).
- The review summary looks through the 200 newest owned reviews of the kind. A subject with a review older than that (more than 200 newer owned reviews of the same kind) falls back to the owned-queue link. A key-filtered queue member would need a BE03c ruling; recorded, not invented.
- Browser E2E must also cover: reload of an in-review and an approved template and pattern shows `Review: <state> · n of m decisions` and the link opens that review; a closed review under the owner shows the refusal sentence with no revoke button.

### Requests to root
none (the closure fold the review assigned to root was done here because the brief named it; `step-up-required.inventory.test.ts` needed no further entry: the new loader reads no 401).
