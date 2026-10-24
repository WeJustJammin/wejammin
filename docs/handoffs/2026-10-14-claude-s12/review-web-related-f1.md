# Review: claude_s12_web_related_f1 (Fix pass 1; independent, adversarial re-review)

## Status
FINAL, 2026-10-15 ~16:55Z. Reviewer did not author the lane. HEAD b16edb54. Read-only except this file.
Target: `lane-web-related-report.md` `## Fix pass 1` (file SHA-256 c6fb2024...8f3f, verified), brief
`briefs/web-related-f1.md`, prior BLOCK `review-web-related.md`.

## Claims re-verified
- All 28 Fix-pass file rows: SHA-256 and line counts match (rechecked after my mutation run; unchanged).
- Lane mutation counts: `mutation-run1.out` 34 killed / 4 survived (P3, P12, W16, W28) / 2 bad (P9, W15);
  rerun 5/5 killed. Matches the report. W28 is equivalent through the UI: the restart is offered only with
  an empty list or a null cursor, where replace and merge agree.
- Full-suite claim (569 files, 6913 tests) not rerun (not allowed for me); focused set below is green.

## Runs (mine, pinned PATH, `flock -s /tmp/wejammin-quiet.lock`)
- 16:36Z focused Vitest (`cms-related-content/`, proxy test, route test, step-up inventory): 21 files,
  269 tests, all pass, exit 0.
- 16:36-16:38Z `astro check` (apps/web): 2017 files, 0 errors, 0 warnings, 182 hints; nothing in lane files
  (one "Unsupported file type" notice for the route test in `pages/`, same as 32 other page tests).
- Independent mutation sample, IN MEMORY (Vite `transform` hook; no worktree byte written; baseline 264/264
  green): 12/12 killed (`<scratchpad>/review_web_related_f1/mutation-results.txt`, SHA-256 1a37b6c5...fe44).
  R01 403 token dropped; R02 `denied` still reads the list; R03 capability asked before the entry read;
  R04 wait not in a live region; R05 a 429 clears the list; R06 browser ignores the marker; R07 `boundary`
  closes the page (13 fail); R08 proxy drops the pointers (kills the composed form test alone, run
  separately); R09 browser ignores rows; R10 local 5xx with empty details; R11 picker enabled while
  read-only; R12 a 401 is not sign-in. Lane mutants already cover the `writable` gate (W1-W5) and the stub.

## Brief items
1. BLOCKER resolved. `rule === null` makes `writable` false (`use-related-content-form.ts:83`); `save`
   returns first (:162); the picker is disabled (`enabled: writable`, :87; `use-related-candidates.ts:45`);
   the form renders only facts plus `SAVING_UNAVAILABLE` and no control (`CmsRelatedContentForm.tsx:84-149`).
   No 409 can arise, so `adoptVersion` ("keep my choices") is unreachable. The SSR markup has no submit
   button, and the form has no action. Tests assert no `fetch`, `submit` or `loadPage` via a dispatched
   submit and a direct hook probe (`CmsRelatedContentForm.readonly.test.tsx:69-117`). In production
   `readSavedRelatedRule` always answers `boundary`, so the page is read-only for everyone.
2. Boundary stubs (`related-content-boundaries.ts`): typed seams (`SavedRuleRead`, `EditCapabilityRead`),
   structured `BoundaryResult` values with gap, missing spec and safe default, `BOUNDARY:` comments,
   sentinel tests with exact values. Both safe defaults write nothing. Only the linked issue is missing
   (`TRACKING: pending owner authorization`, as root's brief prescribed). That is a residual for root.
3. SG-S12-04 reasoning confirmed independently. CMS-03C-05 needs "author/editor with source assignment"
   (BE03c 163, 1502), which is the BE03b 1858 "entry assignee" scope. CMS-03B-11 (BE03b 163/2041) admits any
   read scope, and `EntryDraftDetailResourceSchema` has no authority member. CMS-03B-13 lists assigned OR
   owned entries with no distinguishing member. CMS-03B-14 is per acting context, not per entry.
   CMS-03B-12 needs an open conflict id. CMS-03B-15 (BE03b 167/2045) serves assignee, owner-party publisher
   and reviewer. Its caller-dependent `preparation` (BE03b 289: "the caller may submit") and
   `permittedNextActions` are positive-only, exist only for a submittable draft, and "grant no authority"
   (2045). So no read can prove a denial, and a 403 page built on them would be invented. Gating order is
   right: the check comes after the entry is proven readable, before the list read (loader :91-102).
4. Proxy 422 relay matches the Worker for the typed 422. The token must parse, carry status 422, and be in
   `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-05']` (proxy :97-117 = Worker `related-content-details.ts:14-26`).
   Pointers are rebuilt through `CmsViolationSchema` with the fixed message, at most 16. The Worker's
   pointer regex is looser than the contract's `SafePointerSchema`, so the proxy accepts a subset of what
   the Worker sends. The browser keeps only `/(pins|exclusions)/n` (`related-content-submit.ts:75`).
   The composed form -> `submitRelatedContent` -> real `forwardCmsRelatedContentMutation` test is real
   (R08 kills it alone).
5. Load more follows FE03 :1172-1175: it goes through `retryingSafeRead` (250/750 ms, retryable 5xx only).
   A 429 is not retried; `rateLimitWaitSeconds`, the wait, a polite `role="status"`, and the button stays
   disabled until the wait elapses. Pins and exclusions stay in the form hook and are untouched.
   Fake-timer tests check the 249/1 ms boundaries. The 429 move out of the `failed` list in
   `related-candidates.test.ts` is a justified correction (FE03 :1172), not a weakened oracle.
6. Minors 5a/5b/5d done and tested. 5c and the FE03 :1601 step-up wording are for root.

## Findings
1. `apps/web/src/server/cms-composition-platform-related.ts:232,234,239` — minor (latent until SG-S12-03) —
   a transport loss to the Worker (plain 503) and a relayed upstream 5xx carry no unknown-outcome marker.
   The browser reads them as `rejected` (`related-content-submit.ts:255`) and the hook drops the key
   (`use-related-content-form.ts:182`). A retry then sends a new key; if the first write committed, CAS
   returns 409 instead of replaying the 201. No double effect, but a misleading conflict. Answer to the
   author's question: YES, mark both. FE03 :1174 says "Mutations reuse idempotency and reconcile status
   first". BE00 :172 says `DEPENDENCY_UNAVAILABLE` is `retryable: true`. Precedent:
   `cms-taxonomy-platform-write.ts:114-126` marks a transport loss and every relayed status >= 500. Fix:
   the same two branches plus a test. Today's test `fails closed 503 ... throws` does not pin the absence,
   so no oracle changes.
2. `apps/web/src/server/cms-composition-platform-related.test.ts` (541 lines) — minor — over the 400-line
   test cap in `.claude/rules/extensibility.md`. This pass added about 195 lines (346 at hardening-3).
   Fix: move the `typed 422` describe block and the unknown-outcome test into a sibling
   `cms-composition-platform-related-refusals.test.ts`.
3. Proxy vs Worker scope — minor/doc — the Worker relays violations on a 400 and on an untyped 422
   (`related-content-details.ts:37-65`; Worker test `related-content-errors.test.ts:171`). The proxy drops
   both. This is stricter, and the browser marks rows only under a typed token, so the user sees no
   difference. But the report's "exactly the Worker's shape" holds for the typed 422 only. Say so in the
   proxy doc comment.
4. Citations — minor/doc — proxy :88 "BE03c 1323: at most 16" (1323 states no 16; the bound is the Worker's
   `slice(0, 16)`); :235 "BE03c 1502" is the authz table row (inherited from the taxonomy precedent).
   `related-content-boundaries.ts:47-48` and README :30-31 say CMS-03B-15 "carry no capability member".
   Reword: it has positive-only signals (`preparation`, `permittedNextActions`) that cannot prove denial.
5. `load-related-content-page.ts:104-112` — observation — while read-only, the loader still reads
   CMS-03B-13 and puts an unused candidate page into the island props. A list failure then replaces the
   read-only page with an error. It leaks nothing (the caller's own readable entries). Optional: skip the
   list read when `savedRule` is a boundary.
6. README :24-25 "editable with no other change" — latent note for root. Once SG-S12-03 lands, the 409
   "keep my choices" path (`adoptVersion`, hook :210-219) re-saves over a concurrently changed saved set
   it never showed. When the read is specified, the conflict path should re-read the rule (FE03 reload
   option) before re-applying.

## Security (checked, no defect found)
No request leaves a read-only page, by any path. The 403 page is reached only on an explicit `denied`,
after the 401/404 concealment. Proxy 422 details are allowlisted per member, with no message text, no
foreign token, and no extra member (tests :287-385). The unverified-201 marker never appears on a definite
answer (test :432-438).

## Requests to root
1. Authorize the two tracking issues (SG-S12-03, SG-S12-04) and put the numbers in the TRACKING lines.
2. Schedule the BE03c saved-rule read (until then the FE03 :2678 authoring journey cannot complete).
   Decide on the edit-capability signal or an FE03 :1072 amendment.
3. Optional follow-up: findings 1-2 (proxy unknown-outcome parity and the test split) in the proxy owner's
   lane. Findings 3-4 are doc-only.

VERDICT: CLEAR
