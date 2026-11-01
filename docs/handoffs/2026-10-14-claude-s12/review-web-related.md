# Review: claude_s12_web_related (independent, adversarial)

## Status
FINAL, 2026-10-15 13:41Z. Reviewer did not author the lane. HEAD b16edb54. Read-only except this file.
Target: lane report SHA-256 bdba9ee5...1874, brief `briefs/web-related.md`.

## Claims re-verified
- Lane report SHA-256 matches. All 43 file rows: SHA-256 and line counts match (rechecked after my mutation run).
- No lane file left mutated by the in-place battery: every find string of the lane's 170 + 22 + 3 mutants is present
  exactly once today, except #124 (bad mutant, found 2) and #145/#146/#161/#162, whose lines were deliberately
  rewritten by the two redundancy removals; none of their replacement strings is present.
- Redundancy #161 true: `cmsEditorialForwardHeaders` (cms-editorial-platform-shared.ts:238-261) forwards only the
  filtered cookie, x-correlation-id and x-client-binding-id, so conditional headers never reach a read.
- Lane mutation counts: `run.out` shows 140 killed / 29 survived / 1 bad (report: 28); rerun set 22 (19 + 3 killed;
  report: 20). Off by one each; substance holds. The six equivalent mutants are equivalent on my reading (#47
  `Number.isInteger` covers `typeof`; #52 regex rejects "null"; #97 button absent without a version; #101 button
  `disabled` while loading; #102 cursor already null; #163 UUID path needs no encoding).
- Full-suite claim consistent with scratch `full.out` (548 files, 6734 tests passed).

## Runs (mine)
- 13:28Z focused Vitest (13 lane files + route test + step-up inventory), pinned PATH, `flock -s`: 15 files,
  213 tests, all pass, exit 0.
- 13:30Z `astro check` (apps/web): 1987 files, 4 errors, all in other lanes' files
  (`cms-pattern-designer/CmsPatternVersionDesigner.form-contract.test.tsx:154,157`,
  `styles/cms-danger-action.test.ts:2,13`); 0 diagnostics in lane files. Lane's "0 errors" was true for its run only.
- Independent mutation sample, IN MEMORY (scratch Vite config with a `load` hook substitutes the mutant; no worktree
  byte written; baseline 208/208 green; probe killed): 23 mutants on the critical clauses, 23 killed. Key reuse only on
  unknown outcome (R01-R03), weak If-Match (R04), ETag binding (R05), pins binding (R06), catalog-code check (R07),
  `credentials: 'include'` (R08), owner/assignee member accepted in load-more (R09), source offered server/browser
  (R10/R11), inactive entry pinnable (R12), query accepted (R13), another entry's draft accepted (R14), exclusion not
  winning (R15), refused-row mark hidden (R16), boundary note hidden (R17), result-heading focus removed (R18, first
  form was a syntax error; valid `void 0` form killed by 2 tests), no-CSRF send (R19), reason code not from registry
  (R20), lane survivors #69/#143/#89 re-checked (R21-R23). Component tests are non-vacuous for what they cover.

## Findings
1. `CmsRelatedContentForm.tsx:129-132`, `use-related-content-form.ts:186-189`, `load-related-content-page.ts:120` —
   BLOCKER — Save is enabled while `rule === null`, which is always. Root has ruled the page must refuse saving
   while the boundary stands; the code does not. A save replaces the whole set (BE03c 1417: revoked rows for every
   removed item), so pinning one entry silently revokes every unseen saved pin, exclusion and derived rule; the
   conflict "Keep my choices" path (hook :236-245) re-applies over a concurrent author's unseen set. A note
   (`SAVED_RULE_NOT_SHOWN`) is the only guard. Fix: gate `save()` and the submit control on a known rule (or a
   loader flag), show the boundary refusal in place of the commit, sentinel test asserting no fetch while
   `rule === null`; keep submit-path tests through a non-null `RelatedRuleSnapshot` seam.
2. `load-related-content-page.ts:65-72,88-90`; route test :139 — MAJOR — page gate is not FE03 :1072/:1601
   compliant. The spec requires 403 for "a visible target without the capability" and "entry assignment with edit
   authority". The page 403s only when CMS-03B-11 refuses READ. A caller who can read (owner-party scope, BE03c 1417 d;
   BE03b 163/2041) but holds no author/editor assignment gets 200 and the full form; the 403 `capability_missing`
   appears only inline after a write (producer SQL 20261014060400 :131-133). No specified read can prove edit
   authority: `EntryDraftDetailResourceSchema` has no capability member, `EntryListItemSchema` omits authority by
   design, workflow `permittedNextActions` is not an edit signal. So this is a second spec gap, recorded only as
   "Decision 4", not as a BOUNDARY. Fix: root rules either a spec'd edit-capability signal (CMS-03B-11 or a CMS-03C
   context read) or an FE03 :1072 amendment that ratifies the write-time 403. Track it as BOUNDARY meanwhile.
3. `apps/web/src/server/cms-composition-platform-related.ts:83-112` (not a lane file) — MAJOR — the proxy defect is
   confirmed. `safeErrorDetails` returns `{}` for 422 (and 400). The Worker sends `{ reasonCode, violations:[{path,
   code}] }` (≤16, `apps/worker/src/cms-composition/related-content-details.ts:42`). End to end,
   `related_target_ineligible` never marks a row, `derived_rule_unknown` is unreachable, and a 422 renders "Could not
   save". So FE03 :890/:2665 and the :2678 Vitest clause hold only under the injected `submitStub`
   (`CmsRelatedContentForm.refusals.test.tsx:30`): those tests mock the exact outcome production cannot deliver.
   Size: one branch (~15 lines) allowlisting `reasonCode` ∈ {related_target_ineligible, derived_rule_unknown},
   `violations` ≤50 with `path` matching `^/(pins|exclusions)/(0|[1-9]\d{0,2})$` or `^/derivedRule(/…)?$`, `code`
   the same token, no message. Then replace the defect-pinning test `related-content-submit.proxy.test.ts:52-60`.
   No browser change is needed: `refusedRows`/`typedRefusal` already read both.
4. `related-candidates.ts:142-173` — MAJOR — the candidate "Load more" read violates FE03 Network and retry contract
   :1174-1175. One attempt only: a 502/503/504 whose details declare `retryable: true` (relayed,
   `cms-editorial-platform-error-details.ts:229`) becomes `failed` at once with no 250/750 ms retries, and a 429 is
   `failed` with no `Retry-After` wait or announcement. Sibling Slice 12 reads use `retryingSafeRead` and
   `rateLimitWaitSeconds` (`lib/safe-read-retry.ts`; `cms-taxonomy-terms/taxonomy-terms-read.ts`). No test pins
   either rule. Fix: wrap in `retryingSafeRead`, map 429 to a wait state, and test both with an injected sleep. The
   server-side first page has no retry, which matches the loader precedents.
5. `load-related-content-page.ts:21-32`, `related-content-types.ts:13-17`, README :13 — MAJOR — the boundary stub is
   incomplete under `.claude/rules/boundary-not-placeholder.md`. It meets: BOUNDARY prefix, a sentinel
   (`load-related-content-page.test.ts:117`, which asserts `rule === null` and the structured constant), and a typed
   shape (`RelatedRuleSnapshot`). It misses: no tracking issue (`TRACKING: issue to be filed by root`); no typed read
   seam in `RelatedContentPageReads` for the missing read to plug into; and the stub's behavior is a destructive
   default, not a safe no-op (see 1). Fix: file the issue and put its number in every TRACKING line. After 1, the
   sentinel also asserts the save refusal.
6. `CmsRelatedCandidates.tsx:130` — minor — the candidate-list sign-in link returns to
   `/app/cms-content-modeling/entries`, not this page, although `returnTo` is available. It is inconsistent with the
   save-401 link, which returns here.
7. FE03 :1601 vs BE03c 216 — minor (spec) — FE03 says "step-up gates the commits", but BE03c gives CMS-03C-05 no
   recent-MFA rule and the proxy maps 401 to `reauthenticate`. The lane follows BE (correct, Decision 2), and its four
   `NO_STEP_UP_ROW` inventory entries match. Root should cascade the spec wording.
8. Props vs FE03 :1473 — minor — `{ onSubmit, idempotencyKey }` became the `submit`/`csrfToken`/`returnTo` seams,
   with the key held inside the hook. This is documented and matches precedent; accept it or cascade the spec.
9. Proxy, not a lane file — minor — a 201 the proxy cannot verify becomes a plain 502 with no
   `x-cms-editorial-outcome: unknown` marker. The browser then drops the key (hook :209) though the write may have
   committed. CAS (409) prevents a double effect, but the copy says "Nothing was confirmed" before a conflict appears.
   Consider the unknown marker.

## Security (checked, no defect found)
- Candidates come only from CMS-03B-13: server-first via the loader (:97-105) and the same-origin list route for
  "Load more". The structural verifier refuses unknown members (an owner or assignee id) and drops `authorClass`.
  The source is never offered. The server still decides eligibility.
- No PII: rows show entry id, locale, revision state, lifecycle and time. Failure copy is fixed; no request id,
  provider detail or body is rendered.
- Transport: same-origin, `credentials: 'same-origin'`, `redirect: 'error'`, `no-store`, double-submit CSRF.
  Exact strong `If-Match` = entry version (BE03c 215; producer returns the new entry version, SQL :32/:230).
  A 201 counts only when bound to the request (ETag = expected+1, pins, exclusions, rule).
- Idempotency: the key is reused only for an identical body after an unknown outcome. It is new after any definite
  answer, including a 409, as BE03c 1311 requires (R01-R03 killed).

## Spec clause map (FE03 / BE03c)
- :890 lists ≤32/≤64, move controls, exclusions-win note: implemented and tested. Readable-only picker: yes.
  Registry rule plus `maxCandidates` 1-128: yes. `eligibleCount`: yes. Fixed refusal at the row: component only,
  blocked end to end by 3.
- :1072/:1601: 303 sign-in, 400 for a bad id or any query, 404 concealment: yes. The capability 403 is NOT met (2).
- :1121/:1223: focus on the named result heading, pending text, duplicate-activation guard, conflict "reapply" or
  reload: yes. "Review changes" is impossible while the boundary stands.
- Network contract :1174-1175: not met for "Load more" (4). Commit-side 429 wait and key reuse: yes.
- :2678 Vitest "one fixed message for an ineligible target": met only via the stub (3). Playwright journey: not run
  (no staging; the lane says so).
- BE03c 385-387 and 1417 are mirrored client-side; the server is authoritative. BOUNDARY "no saved-rule read" is
  confirmed: route registry 156-179 has only the POST for CMS-03C-05, CMS-03C-21 is internal (190), and the
  contracts carry no read shape.

## Requests to root
1. Apply your save-refusal ruling (finding 1) before merge.
2. Rule on finding 2: spec an edit-capability signal, or amend FE03 :1072.
3. Fix the proxy 422 relay (finding 3) in the proxy owner's lane.
4. File the BOUNDARY tracking issue (finding 5).

VERDICT: BLOCK
