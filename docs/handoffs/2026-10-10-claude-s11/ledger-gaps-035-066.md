# Slice 11 evidence ledger gaps, P2-S11-AC-035 .. AC-066 (lane B)

Fragment: `tests/contracts/phase-02-slice-11-evidence-ledger-035-066.ts` (32 entries).
Method: static reading only (no test, pnpm, node, DB or docker was run). Every citation title was extracted from source and
resolved by a script that rejects an absent, ambiguous or duplicated title; hand-built titles (vitest `it.each`/`describe.each`
and Worker `forEachCase` expansions) were checked against the source by hand. Tree state: started at HEAD
`618ec5c16585d295263770a9d79138f36bfa10dc`; the worktree HEAD moved to `9b9b588e` (precision producers) while I worked, and other
lanes had uncommitted edits to `supabase/tests/phase_02_slice_11_helpers_preflight.sql`,
`supabase/tests/phase_02_slice_11_races/010-review-assignment-race.mjs` and `infra/database-races/review-kit.mjs`. The fragment was
generated against the `9b9b588e` tree plus those edits; it cites neither the race 010 runner nor `review-kit.mjs`, and cites
`helpers_preflight.sql` once (AC-036).

Result: 18 verified, 12 partial, 2 unverified. 523 distinct citations (950 with repeats across clauses: 647 vitest incl. apispec,
281 pgtap, 15 race, 7 playwright `real-route-chrome`) in 106 files. Other lanes keep editing the tree (an impl lane added assertions to
`rpc_review_assign_refusals.sql`, which I cite); re-run the title resolution before the receipts run.

## Cross-cutting findings

1. **422 versus 502 (AC-050, AC-053, AC-056).** The criteria say a response that breaks the contract is "a 422 response-contract
   failure". The contracts refuse every listed breach (cited), but the Worker answers a resource that fails its strict schema as
   502 `BAD_GATEWAY` (`apps/worker/src/cms-editorial/workflow-read.ts:236` `if (accepted === null) return fail(BAD_GATEWAY)`,
   `workflow-support.ts:144-149`), the SQL reads raise no 422, and no test produces a 422. The route registry nevertheless declares
   `VALIDATION_FAILED: 422` for the read envelope (`packages/contracts/src/cms-editorial/routes-errors.ts:192-204`). This is the same
   class as Slice 10 AC-089 and needs a wording ruling before it can be "fixed" either way.
2. **Focus rules.** Positive focus moves are tested (refusal alert, local-error summary, named result headings). The negative rules
   ("focus stays until navigation", "keep focus on refetch", "moves focus ... on navigation only") have no test.
3. **Feature-ledger pointers (AC-035/038/041).** "BE03b ledger 25.02.03/25.02.04/25.03.04" are traceability references; nothing in
   the repo asserts them. DEC-155 also lists these three rows as wording defects still awaiting the owner batch.

## Non-verified criteria

### P2-S11-AC-035 — partial
- Unproven clause(s): "BE03b ledger 25.02.03."
- Implementation: present as data at `.memory/wiki/specs/feature-ledger.md:758` (row `25.02.03` -> `P2-S11`) and
  `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:82` (BE ownership CMS-03B-05, -06, -15, -16, -17, -18); no code needed.
- Missing evidence: vitest `tests/contracts/phase-02-slice-11-feature-ledger.test.ts` that reads both tables and asserts that the
  operation ids owned by 25.02.03, 25.02.04 and 25.03.04 in BE03b equal the operation ids the tracker's `BE endpoints` line and the
  route registry (`cmsEditorialRoutePolicies` plus `CMS_EDITORIAL_INTERNAL_OPERATIONS`) assign to them, and that feature-ledger.md names
  `P2-S11` for the three rows. Or an owner ruling that the pointer is not testable (then amend the text with the DEC-155 batch).
  One test covers AC-035, AC-038 and AC-041.
- Size: S

### P2-S11-AC-037 — partial
- Unproven clause(s): "focus stays until navigation"
- Implementation: focus is moved only by `apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.tsx:99,104` (refusal
  and local-error alerts) and `CmsEditorialWorkflowIsland.tsx:40` (`focusHeading`, called through `onDone` after a command). Nothing
  else calls `.focus()`, but no test records that.
- Missing evidence: jsdom tests, one per form (extend `CmsEditorialReviewSubmitForm.test.tsx`, `CmsEditorialDecisionForm.test.tsx`,
  `CmsEditorialReviewAssignmentForm.test.tsx`): focus the activated button, hold the command pending, assert
  `document.activeElement` is still the button while pending and after an unknown-outcome reconcile; assert it moves only to the
  named result heading or the refusal alert on completion. Model: `cms-editorial-submit-focus.test.tsx` in Slice 10.
- Size: S

### P2-S11-AC-038 — partial
- Unproven clause(s): "BE03b ledger 25.02.04."
- Implementation: `.memory/wiki/specs/feature-ledger.md:759`, `be/03b-editorial-workflow-publication.md:83` (CMS-03B-07, CMS-03B-20).
- Missing evidence: the same traceability test as AC-035 (row 25.02.04 owns CMS-03B-07 and CMS-03B-20). DEC-155 wording batch also
  pending (".," break; lags IA03 AC-CMS-09 on E6/E11).
- Size: S

### P2-S11-AC-040 — partial
- Unproven clause(s): "focus stays until navigation"
- Implementation: `CmsEditorialScheduleForm.tsx` (focus only through `CmsWorkflowCommandFrame.tsx:99,104` and `onDone`).
- Missing evidence: jsdom test in `CmsEditorialScheduleForm.test.tsx`: while a schedule command is pending and after the time-authority
  resolution updates, the focused control keeps focus; only the refusal alert / `workflow-schedules-title` take it afterwards.
- Size: S

### P2-S11-AC-041 — partial
- Unproven clause(s): "BE03b ledger 25.03.04."
- Implementation: `feature-ledger.md:763`, `be/03b-editorial-workflow-publication.md:84` (CMS-03B-08, -09, -19).
- Missing evidence: the AC-035 traceability test. Note: the criterion text is truncated ("a preflight rerun against current revocation
  sta", DEC-155); that clause is cited against its evident meaning (publish-phase preflight rerun failing on revoked authority or an
  unavailable entry) and should be re-checked after the owner wording batch. The flow title says "diff", but no Slice 11 operation
  compares a preview with the active projection (only the Slice 10 revision compare exists); the criterion text has no diff clause.
- Size: S

### P2-S11-AC-043 — partial
- Unproven clause(s): "focus stays until navigation"
- Implementation: `CmsEditorialPreviewForm.tsx`, `CmsEditorialPublishConfirmation.tsx` (focus via `onDone` and the preview token region only).
- Missing evidence: jsdom tests in `CmsEditorialPreviewForm.test.tsx` and `CmsEditorialPublishConfirmation.test.tsx`: focus is unchanged
  during the pending mint/publish and after a refetch, and moves only to `preview-token-title` / `workflow-publications-title` or the
  refusal alert.
- Size: S

### P2-S11-AC-044 — unverified
- Unproven clause(s): "Execute Contract → QA-RED → data, API, SSR and island implementation → QA-GREEN → refactor", "retain failing-test evidence", "run canonical validation."
- Implementation: not code; a process criterion. The tracker records full gates as pending; Codex handoffs hold RED/GREEN receipts
  (`docs/handoffs/2026-10-08-phase2-codex-handoff/s11/*.json`).
- Missing evidence: slice-close artifacts, not a test: a green canonical validation run and the retained RED receipts, then either an
  owner ruling that the all-green guard run is the proof or a process-gate test like `phase-02-slice-08-process-gates.test.ts`
  (no Slice 11 process-gate test exists).
- Size: M

### P2-S11-AC-045 — unverified
- Unproven clause(s): "Update slice tracking, feature-ledger assignments, applicable runbooks, and architecture graph in the same change", "leave no unresolved implementation boundary or undocumented drift."
- Implementation: not code. Partial checks exist but do not prove it: `tests/contracts/phase-02-slice-11-runbook.test.ts` (runbook covers
  every operation), `scripts/check-progress-consistency.mjs` (tracker counts).
- Missing evidence: the slice-close change plus a guard: the AC-035 traceability test, a graph-freshness check (spec-graph vs the tracker),
  and a repo scan asserting no `TODO:` and only tracked `BOUNDARY:` stubs under `apps/`, `packages/`, `supabase/` for Slice 11 paths.
- Size: M

### P2-S11-AC-050 — partial
- Unproven clause(s): "and refuses a response as a 422 response-contract failure"
- Implementation: breaches are refused by the strict schema, then mapped to 502 at `apps/worker/src/cms-editorial/workflow-read.ts:236`;
  no 422 path exists (see cross-cutting finding 1).
- Missing evidence: after the ruling. If 422: Worker tests in `apps/worker/src/cms-editorial/workflow-read-routes.test.ts` that a port
  success payload with a preparation on a submitted revision, 18 preflight results, 17 schedules, 65 publications and a broken manifest
  or version set each answers 422 `VALIDATION_FAILED` with bounded details. If amended to 502: change the wording and replace the
  `{ x: 1 }` payload of "is 502 when the success payload breaks the resource contract" by one test per breach.
- Size: M

### P2-S11-AC-052 — partial
- Unproven clause(s): "schedule and publication versions"
- Implementation: `apps/worker/src/cms-editorial/workflow-read-routes.ts:89-95` (ETag = entry id/version, revision id, review id/version
  plus a caller-scoped SHA-256 of the whole serialized body, so a schedule or publication change moves it by construction).
- Missing evidence: vitest in `apps/worker/src/cms-editorial/workflow-read-operations.test.ts`: two port resources identical except
  `schedules[0].version` (and another pair except `publications[0].version`/`projectionState`) yield different ETags; same body yields
  the same ETag. The existing validator test builds resources with `schedules: []`.
- Size: S

### P2-S11-AC-053 — partial
- Unproven clause(s): "a response-bound failure (422)"
- Implementation: as AC-050 (502 at `workflow-read.ts:236`).
- Missing evidence: as AC-050. Also thin (cited, not downgraded): the 500 and 502/504 envelope tests run through the publish row and the
  every-declared-status loop, not a dedicated CMS-03B-15 internal-failure case.
- Size: M

### P2-S11-AC-054 — partial
- Unproven clause(s): "keep focus on refetch"
- Implementation: `apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowIsland.tsx:39-41` (focus only after a command) and
  `use-cms-workflow-canonical.ts` (no focus calls).
- Missing evidence: jsdom test in `CmsEditorialWorkflowIsland.test.tsx`: focus a control, resolve a refetch (verified, then degraded),
  assert `document.activeElement` is unchanged.
- Size: S

### P2-S11-AC-056 — partial
- Unproven clause(s): "and refuses a response as a 422 response-contract failure"
- Implementation: as AC-050 (`workflow-read.ts:236`; the detail read uses the same `registerWorkflowRead`).
- Missing evidence: as AC-050, for `EditorialReviewDetailResource` breaches (invalidatedReason without invalidated, decidedAt without a
  decided state, recorded > required, protected with fewer than 2 decisions, 9 decisions, 33 assignments, an extra decision member).
- Size: M (share the ruling with AC-050)

### P2-S11-AC-060 — partial
- Unproven clause(s): "and moves focus to the heading on navigation only"
- Implementation: `apps/web/src/lib/route-heading-focus.ts:17-33` (`installRouteHeadingFocus`, installed at `:100`), included by
  `CmsEditorialDocument.astro:51`; `reviews/[reviewId].astro:4,36` uses that shell. `route-heading-focus.test.ts` covers only the
  one-shot post-commit mark; `installRouteHeadingFocus` has no test anywhere.
- Missing evidence: (1) vitest jsdom for `installRouteHeadingFocus`: no focus on the first `astro:page-load`, focus on the next one,
  none when `location.hash` is set; (2) in `review-detail-route.test.tsx` and `review-queue-route.test.tsx`, a source assertion that the
  page uses the shell that includes the script (the shell assertion exists only in `revision-history-route.test.tsx`); (3) the AC-054
  no-focus-on-refetch test for `CmsEditorialReviewDetailIsland`.
- Size: S

## Cited but thin (status not downgraded; consider hardening)

- AC-046/047/048: "allowedMethods entries other than totp are ignored" is proven in the Slice 11 transport test only for an `['sms']`
  list (degraded) and `['totp']` (navigate); a mixed `['sms','totp']` -> navigate case exists only for the Slice 09 registry form
  (`content-schema-registry-s09-step-up.dom.test.tsx`, not cited). Add it to `cms-workflow-command-transport.test.ts`. Size S.
- AC-047/048: the form-level degraded "No verification method is available" and changed-version SyncConflict cases exist only for the
  decision form; schedule and publish are covered by the shared controller/frame tests (`cms-workflow-command-controller.test.ts`
  hard-codes CMS-03B-06). Add one case each to `CmsEditorialScheduleForm.test.tsx` and `CmsEditorialPublishConfirmation.test.tsx`. Size S.
- AC-047/048 "reserves no idempotency record": proven at the Worker (`reservationCount` unchanged) and in pgTAP; "commits exactly once" for
  schedule rests on the shared controller test, the DB replay assertions and, for publish, the real-stack replay test.
- AC-051 "the projection grants no authority": proven by negative command tests of readers (owner-party publisher cannot submit; readers
  without an effective assignment cannot decide) and by the strict, identifier-free resource, not by a test named for it.
- AC-052/058/064 "p95 < ... ms target" and "8,000 ms deadline": proven as declared registry values and the injected-deadline 504
  mechanism; no performance run measures p95 (`tests/performance` holds only Slice 09 and generic budget tests).
- AC-059 "keeps a concealed review a 404 on every refetch": proven by the effect-free read plus the concealment cases; no test reads the
  same concealed id twice.
- AC-066 "caches no row offline": proven by `Cache-Control: no-store`, `prerender = false` and the no-store proxy; the app has no
  service worker, so there is no positive offline-cache assertion.
- AC-036/039/042 "deletion": cited as history-never-deleted guards, grant deletion revoking assignments (DEC-143), and
  archived/held/deletion-pending entries failing the revocation category, the same reading Slice 10 used.
- Race citations use only static `ok - ...` labels (the runners also print interpolated labels that are not stable ids).

## Summary

(a) Counts: verified 18 (AC-036, 039, 042, 046, 047, 048, 049, 051, 055, 057, 058, 059, 061, 062, 063, 064, 065, 066), partial 12
    (AC-035, 037, 038, 040, 041, 043, 050, 052, 053, 054, 056, 060), unverified 2 (AC-044, 045).

(b) Implementation entirely missing: none. All CMS-03B-15/16/17 routes, RPCs, contracts, FE islands and pages exist. AC-044 and AC-045
    are process/tracking criteria with nothing to implement.

(c) Cited tests I have reason to doubt (nothing was run):
    - No `it.skip`/`todo`/`fixme` appears in any of the 106 cited files; no duplicated static titles either (the only "SKIP" hit is the
      comment "SKIP LOCKED" in `rpc_publication_claim.sql`).
    - The handoff (`docs/handoffs/2026-10-09-phase2-claude-handoff.md`) records the nine-digit/legacy-six-digit schedule-precision family
      RED at `618ec5c1`; the producers landed in `9b9b588e` and the tracker says they were verified, but full gates are pending. I cite no
      precision test, but I cite neighbours that share its fixtures and were edited by that commit:
      `supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql`, `supabase/tests/phase_02_slice_11_schedules_schema.sql`,
      `tests/postgrest/phase-02-slice-11-schedule.apispec.ts`, `phase-02-slice-11-schedule-time.apispec.ts`,
      `phase-02-slice-11-sweep.apispec.ts`, `phase-02-slice-11-sweep-outcomes.apispec.ts` (the sweep-composition expired-lease positive path
      is still marked UNRUN in the handoff; that file is not cited).
    - `supabase/tests/phase_02_slice_11_helpers_preflight.sql` (cited once, AC-036) has uncommitted edits in the worktree.
    - `tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts` runs `serial` under project `real-route-chrome`
      (`playwright.s09-real.config.ts`); one failure skips the rest and the guard then rejects every cited test of the file
      (AC-035, 038, 041, 046).
    - `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/workflow-route.test.tsx` has regex-special brackets in its path;
      check the run planner selects it.
