# Lane S11-5 report: Slice 11 web surfaces + browser verification

LANE = /home/rob/.codex/worktrees/phase2-slice11/WeJammin (claude/phase2-slice11). Nothing staged or committed. Edits only under apps/web/** (and web-scoped tests).

## Plan (surface order; each = RED observed, then GREEN, then checkpoint here)

A. Server proxies: shared command/read kit + 9 Astro API routes (CMS-03B-05, 06, 07, 08, 09, 15, 16, 17, 18) over the generated contracts
B. Command engine: transport, outcome classification, fixed copy, idempotency/unknown-outcome reconcile, step-up draft/restore, React hook + shared frame
C. Read views: PreflightSummary, WorkflowPanel, ReviewQueue, ReviewDetail (server-rendered) + page loaders + Astro pages + navigation
D. Command forms: ReviewSubmitForm, DecisionForm, ReviewAssignmentForm, ScheduleForm (lazy Time authority), PreviewForm, PublishConfirmation + islands
E. Accessibility (axe), privacy (no token/manifest/identifier leakage), step-up recovery and bundle-chunk boundary tests
F. Real-route Playwright (only after S11-4 Worker routes + S11-3s SQL wrappers exist)
G. Gates: focused vitest, type-check, lint, format:check

## Checkpoints

(append below after each finished surface)

### CP-A (Surface A): first-party proxies for CMS-03B-05, 06, 07, 08, 09, 15, 16, 17, 18 - DONE
New (apps/web/src/server): cms-workflow-platform-command.ts (one admission kit for the six commands, registry-driven), cms-workflow-platform-reads.ts (15/16/17),
 cms-workflow-platform-errors.ts (Slice 11 detail projector), tests cms-workflow-platform-{command,reads,errors}.test.ts (+ command.test-support.ts).
New endpoints (apps/web/src/pages/api/v1/cms): entries/[entryId]/{reviews,workflow}.ts, reviews/index.ts, reviews/[reviewId].ts, reviews/[reviewId]/{decision,assignments}.ts,
 publication-schedules/index.ts, previews/index.ts, publications/index.ts + slice-11-workflow-routes.test.ts (each module sits at its registry path, only the registry method).
New fixtures: apps/web/src/components/cms-editorial-workflow/cms-workflow-fixtures.test-support.ts (every builder is parsed by the real contract).
Edited (additive): cms-editorial-platform-bounded.ts (+ optional detail projector), cms-editorial-platform-write.ts (pass-through), cms-editorial-platform-shared.ts (STEP_UP_REQUIRED message), READMEs.
RED observed: errors (module absent: no test ran), reads (module absent), routes (19 failed: no endpoint). Command-kit tests were written before the module; the first run already had the module,
 so its sensitivity was proven by mutation instead (dropping the identity binding failed 7 tests; dropping the If-Match/expectedVersion equality failed 1; both reverted).
GREEN: 3 proxy suites (77 + 25 tests) + routes (19); whole apps/web/src/server dir 66 files / 992 tests incl. proxy-body-untouched (new POST routes leave a refused body unread). tsc --build 0 errors; eslint/prettier clean on touched files.
Decisions inside the lane (override welcome): If-Match vs body expectedVersion disagreement is 400 (matches the Worker, S11-4 CP1); path vs body id is 422 `mismatch`; the success Location/ETag are verified against
 the Worker's actual values (05 /reviews/{id}, 07 /publication-schedules/{id}, 09 /publications/{id}, 18 create /reviews/{reviewId}/assignments/{id}, 06/08 none); CMS-03B-15 validator only needs to be a strong ETag (composite).

### CP-B (Surface B): command engine - DONE
New (apps/web/src/components/cms-editorial-workflow): cms-workflow-command-specs.ts (the six commands as ONE table shared by the proxy and the browser, incl. verifyCommandSuccess; server now consumes it),
 cms-workflow-command-transport.ts (send one command, reduce the answer to committed | step-up | signed-out | unknown | refused | local), cms-workflow-command-controller.ts (key policy, exactly-once, reconcile-before-retry,
 tab-scoped step-up draft + restore + sync conflict, startOver), cms-workflow-refusal.ts + cms-workflow-labels.ts (fixed copy for every closed vocabulary, drift-guarded against the contract enums),
 cms-workflow-canonical-read.ts (no-store refetch of 15/16), use-cms-workflow-{command,canonical,draft-fields}.ts, cms-workflow-reason.ts, cms-workflow-expiry.ts, cms-workflow-form-state.ts, cms-workflow-reviewer-options.ts.
Step-up rules implemented: 401 STEP_UP_REQUIRED -> classifyStepUpResponse -> persist ONLY editable text + original key + If-Match operand in the existing step-up draft store, navigate to /step-up?returnTo=, never auto-replay;
 on return restore as an overlay (no setState in effects), changed version -> sync conflict (key rotated on acknowledgement), unchanged -> explicit re-confirmation with the original key; allowedMethods other than totp ignored, empty -> degraded with request id.
 Unknown outcome (transport loss, marker header, 5xx, unverifiable 2xx, redirect) keeps the key, refetches canonical state, and only then enables the byte-identical retry. 429 and the retryable preflight 503 keep the key; every other refusal rotates it.
RED observed per module (module absent) for: errors, reads, routes, refusal, labels, controller, preflight summary, canonical read, transport (moved aside), frame (moved aside), every form and island. GREEN: 21+36+9+33+20+17+16+7... (see CP-D totals).

### CP-C (Surface C): read views, loaders, pages, navigation - DONE
Views: CmsEditorialWorkflowPanel (5 named regions, 17 checks via CmsEditorialPreflightSummary, review, schedules "Scheduled, not published", publications with projectionState copy that never claims visibility), CmsEditorialReviewQueue (scope links, GET state filter, signed cursor in URL, no-records vs filter-miss),
 CmsEditorialReviewDetail (frozen candidate as hash text + version identities, decisions list without the decider, own reason only, owner-only assignment labels).
Loaders (cms-editorial-pages): load-workflow-page.ts, load-review-detail-page.ts, load-review-queue-page.ts (+ reads seam: workflow / reviewDetail / reviewQueue; page-outcome subjects workflow/review/reviews).
Pages: entries/[entryId]/workflow.astro, reviews/index.astro, reviews/[reviewId].astro (+ route tests composing the REAL loader with the REAL view/island, and source invariants: not prerendered, no-store, shared shell, only the allowlisted 303).
Navigation: registry index nav -> Reviews; entry list rows -> "Review and publish"; draft editor page -> workflow link; app-route helpers (cmsEditorialAppWorkflowPath, CMS_EDITORIAL_APP_REVIEWS_PATH, cmsEditorialAppReviewPath).
Cascades (explained): phase-02-slice-10-ev-ec-entry-list.test.tsx (CITED by S10 evidence; 2 assertions): the tab order and the row anchor list now include each row's /workflow link (FE03 route rows require it; strength kept: order and exact hrefs asserted) -> orchestrator re-collect S10 receipts for that file;
 step-up-required.inventory.test.ts (+3 classified files, no weakening); CmsEditorialCapabilityGate gained an optional `title` (default unchanged).

### CP-D (Surface D): command forms + islands - DONE
Forms: CmsEditorialReviewSubmitForm (05), CmsEditorialDecisionForm (06), CmsEditorialScheduleForm (07; lazy Time authority: dynamic import when the form opens, same pinned resolver, gap alternatives, earlier/later pair, window refusal),
 CmsEditorialPreviewForm + CmsEditorialPreviewToken (08; token in component memory only, copy control, hide), CmsEditorialPublishConfirmation (09; inline confirmation naming the replacement and the 17 re-run checks),
 CmsEditorialReviewAssignmentForm = AssignmentCreate (reviewer list read client-side from CMS-03A-18 so person ids never ride in island props; person id never stored) + AssignmentRevoke (named by reviewerLabel).
Islands: CmsEditorialWorkflowIsland (forms only from permittedNextActions, disabled-reason copy, degraded/gone/signed-out handling, focus to the result heading only after a command), CmsEditorialReviewDetailIsland.
Bundle: apps/web/client-chunk-boundaries.mjs gains TIME_AUTHORITY_LAZY_CONTRACT_MODULES (the 4 modules only the subpath reaches, incl. the 218 KB snapshot) mapped to chunk `contracts-time-authority` by clientChunkFor (S09 AC261 test untouched);
 client-chunk-time-authority.test.ts proves the list equals the closure. NOT verified by a real build (orchestrator: pnpm build && pnpm bundle:check; expect a separate ~26 KB gz lazy chunk).

### CP-E (Surface E): accessibility + privacy - DONE (unit level)
cms-workflow-axe.test.tsx: 11 axe runs (wcag2a/aa, 21a/aa, best-practice; contrast/target-size are e2e) over: submittable draft, failed/unavailable/unbuilt checks, approved revision with schedules+publications, refused submit alert,
 schedule form opened (local errors, ambiguous time radios, gap radios), publish confirmation + preview, review detail (assignee), refused decision + capability gate, owner assignment controls, queue populated/empty/filter-miss.
 axe found ONE real defect (landmark-unique: two sections named "Checks"); fixed (heading level/title props, panel no longer double-wraps), all 11 green.
cms-workflow-privacy.test.tsx: after a step-up detour of decision / schedule / publish / assignment and a preview mint, sessionStorage/localStorage/cookies/URL/history/title/console never hold a hash, manifest, version set, token or the chosen person id;
 draft keys are exactly the per-form scopes; server-rendered views print no person/party/ownership identifier.
Totals so far (apps/web, focused): 187 files / 2135 tests green over components/cms-editorial*, pages, server, step-up inventory, chunk boundaries; tsc --build 0 errors; eslint + prettier clean on the 108 touched files.

### CP-E2 (resume after the session limit; no half-written file found)
Fixed the type-check error other lanes reported: cms-workflow-axe.test.tsx imports node:module, which the web project has no typings for -> new apps/web/src/components/cms-editorial-workflow/node-module-shim.d.ts (declares only createRequire). `pnpm type-check` = exit 0.
Mutation spot-checks (10 mutations, each applied to the shipped source, the focused test file run, then restored): retry-before-reconcile, 429-rotates-key, draft-without-original-key, 5xx-not-unknown, no-alert-focus, wrong-expectedVersion, token-persisted-to-storage,
 unverified-read-allows-send, person-id-in-draft, queue-drops-state-filter: ALL 10 made >=1 test fail (1-8 failures each). (A first run was killed mid-mutation; the one file it left mutated, cms-workflow-refusal.ts, was found and restored by hand before any further run.)
Narrow coverage (web Slice 11 files, v8): 45 files / 541 tests green; ~99.1% statements, ~98.1% branches over the new web files; added use-cms-workflow-hooks.test.tsx (key fallback, draft overlay, canonical supersede/gone/signed-out/degraded, default read seams of both islands). apps/web is not in the repo coverage gate (vitest.config include has no apps/web).
Contract drift absorbed: PreflightRefusalEntrySchema now refines reasons per category (only accessibility may be `unavailable`); two of my fixtures used media/unavailable -> corrected to accessibility.
Functional Playwright spec (no stack needed): tests/e2e/phase-02-slice-11-workflow-routes.spec.ts (5 pages x [400/503 state, axe, 320 px reflow, scripts + auth-scope guard], foreign-origin commands refused, reads never answer without a verified service). Authored; NOT yet executed.

### CP-F (real-route Playwright, in progress)
Harness (tests/e2e/support, all new): s11-real-editorial.ts (a second PRODUCTION composition resolving the session through the `auth` seam so the RPC context carries `stepUpAt`; used only when the signed cookie carries `wj_step_up_at`, every Slice 10 request keeps the unchanged path), s11-real-world.ts (reviewer/publisher/owner principals + grants), s11-real-browser.ts, s11-real-flow.ts (first-party 05/15/18/06 preconditions), s11-session-claims.ts; one import swap in content-schema-registry-api.ts; spec tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts registered in both Playwright configs.
FIRST END-TO-END RUN FOUND A REAL DEFECT (NOTES 20:00): migration 20261005017560 line 187 has an unqualified `delete from pg_temp...` - PostgREST loads pg_safeupdate, so cms_get_entry_workflow and cms_load_quality_gate_input answer 400 and the workflow page, 05, 07 and 09 are unusable on the real stack (pgTAP is blind to it). Owner: S11-3s. I validate with a patched COPY applied inside the lane-e2e lock; no repo SQL edited.
Results so far against the patched stack: PROBE (05 -> 18 -> 06 -> workflow read), S11-RR-05 (UI submit), S11-RR-18 (stale step-up 401, ineligible 409, create 201, review version unchanged), S11-RR-06 (UI decision: 401 -> /step-up?returnTo=<review page> request, nothing recorded, completed-MFA cookie, draft restored, NO auto-replay, one confirm commits, review approved) GREEN. S11-RR-09 / S11-RR-07 (publish pending-not-visible, schedule gap + scheduled-not-published) written, last edit being re-run. The step-up surface proved the /step-up?returnTo= navigation; the loopback harness has no MFA session behind /step-up (it redirects to sign-in), so the ceremony is simulated by re-signing the cookie with a completed-MFA instant.

## Remaining
- S11-RR-09 (publish pending-not-visible) and S11-RR-07 (schedule gap + scheduled-not-published) browser runs: specs written, prettier/eslint/type-check clean, but NEVER GREEN: the last attempt timed out waiting 28 min for the shared lock and was stopped (no stray process). The earlier S11-RR-09 failure was a selector (3 Audience fields), fixed by scoping to the section; the page behavior is unobserved. Run: LANE_E2E_NO_RESET=1 ORCH/bin/lane-e2e.sh LANE <wrapper that applies the patched manifest copy> pnpm exec playwright test -c playwright.s09-real.config.ts tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts -g 'S11-RR-0[79]'.
- 08 preview mint, 15/16/17 reads on pages: 15 is proven by the workflow page and the probes; 16/17 (review detail/queue pages) and 08 (preview token shown once) have NO real-route spec yet.
- The SQL fix for migration 017560 line 187 (S11-3s) must land; until then the whole spec only passes against a patched copy. Final re-run on a freshly reset DB with the real migrations is the orchestrator's.
- Functional spec phase-02-slice-11-workflow-routes.spec.ts is authored but never executed (host time).
- Gates (run after the last spec edit): pnpm type-check exit 0, pnpm format:check clean, pnpm lint clean (--max-warnings=0).
- Unverified: lazy `contracts-time-authority` chunk needs `pnpm build && pnpm bundle:check` (orchestrator).
