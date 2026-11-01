# Review claude_s12_refute_b: refutation of lane b re-citation proposals (P2-S12-AC-080 to AC-124)

Reviewer population `claude_s12_refute_b`, which did not write lane b. Date 2026-10-24.
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. Inputs `docs/handoffs/2026-10-22-claude-s12/recite/b-proposals.json` and `docs/handoffs/2026-10-22-claude-s12/lane-recite-b-report.md`.

## Status

PARTIAL: review COMPLETE; the report could not be written as a file (see top). Verdict: **ACCEPT (conditional)**.

- All 796 proposed citations were checked one by one (483 pgTAP, 313 vitest, 643 distinct identities). So were 20 splits (53 sub-clauses), 16 removals and 45 proposed statuses. Result: **773 KEEP, 9 DROP, 14 FIX**.
- DROP rate is 9/796 = 1.13%. FIX rate is 14/796 = 1.76%. The 9 DROPs sit in 7 criteria and have 4 different causes.
- 5 of the 9 DROPs fall in the three items the lane itself listed as weakest (AC-105 clause 0, AC-122, AC-084). Four were not flagged by the lane (AC-089, AC-097, AC-104, AC-120).
- The proposals cannot be applied verbatim. Conditions for the ACCEPT:
  1. Apply the 9 DROPs.
  2. Hold the 14 FIX: 13 wait for a description rename in `governed_activation`, 1 is a retarget.
  3. Correct the AC-107 clause-0 split, which breaks the guard.
  4. Record AC-084 and AC-108 as `partial`.
  5. Add the three required missed tests (AC-080 x2, AC-122 x1).
- 43 of 45 proposed statuses stand.
- The lane report holds one false statement (AC-122: "no Worker test maps that token for CMS-03C-15") and one line-number slip (its Request 1).

## Scope

Reviewed: every `add` in every clause and sub-clause of `b-proposals.json` (45 criteria, 225 clauses), starting from the lane's "weakest citations". Each was checked on the brief's five axes: proof, identity, splits and removals, gaps, status.

Not done:
- The 276 existing citations the lane keeps were checked for identity only (all valid). I read them in depth only where the lane leans on them as a clause's sole proof (AC-080 c1, AC-081 c1 and c5, AC-084, AC-089 c3). These clauses rest on existing citations matched to their clause by title only: AC-092 c0-c2, AC-099 c0-c5, AC-102 c0/c4/c5, AC-116 c0-c1, AC-123 c0-c9.
- pgTAP identities were verified from SQL source and from existing TAP logs (`.lane-logs/*.tap`). I produced no TAP. Root's mechanical pass against a full verbose TAP stays authoritative, above all for computed titles.
- No code, test, spec or ledger file was edited. No sub-agent was used.

## Method and mechanical checks

1. **Proof.** I read the asserting lines of every citation: vitest blocks through the TypeScript AST, pgTAP statements with their helper templates. I derived computed pgTAP titles by hand from the helper and the call label. The helpers were `s12pd_refused`, `s12pu_refused`, `s12puc_check`, `s12pdf_check`, `s12df_check`, `s12rs_pure`, `s12td_*`, `||` chains and table-driven labels.
2. **Identity, vitest.** All 313 adds exist in `.lane-logs/canonical/final-evidence-20261023T224619Z/s09/vitest-all.json` (or `uniq8.json`), passed, and are unique in their file. `it.each` and `$n` names match the receipt text.
3. **Identity, pgTAP.** All 483 adds are a whole SQL string literal at the cited closure file or a computed title at the entrypoint. As a cross-check, all 483 descriptions occur in the 469 historical TAP logs (31,577 distinct descriptions) and pass in their newest occurrence. For the 10 entrypoints lane b cites, the newest TAP run shows 0 failing assertions and exactly 2 duplicated descriptions, both in `governed_activation` (finding 1).
4. **Guard simulation.** In memory, with synthetic passing receipts, the real `evaluateLedger` and the sole-proof limit set to 3.
   - Lane b applied to the whole Slice 12 ledger raises one structural problem: the AC-107 split.
   - All four lanes applied together raise no sole-proof violation, and only that same AC-107 problem for lane b.
   - With the DROPs removed, lane b still has the AC-107 split and the two status downgrades. A partial entry needs an uncited clause and a limitation text. Guard-clean forms are under Requests to root.
5. **Weak-assertion scan** over the 282 distinct vitest adds: 48 flagged, 18 of them because `$n` or generated names defeat static location. I re-read the generated registry/OpenAPI ones earlier in the review and the Worker and web ones in a closing pass. None is vacuous; they assert through `expectError`, `expectNoWork`, `.not.toHaveBeenCalled()` and exact `toEqual`.
6. **Status recomputed from the KEEP set.** 20 clauses in 15 criteria are uncited as proposed, all declared by the lane. No DROP or FIX leaves a clause uncited.

## Counts

| Verdict | pgTAP | vitest | Total | Share |
|---|---|---|---|---|
| KEEP | 465 | 308 | 773 | 97.11% |
| DROP | 4 | 5 | 9 | 1.13% |
| FIX | 14 | 0 | 14 | 1.76% |
| Total | 483 | 313 | 796 | 100% |

- **Splits:** 20 clauses split into 53 sub-clauses; 19 OK, 1 REJECT (AC-107 clause 0). Removals: 16 separator clauses, all OK.
- **Statuses:** lane 30 verified / 15 partial; after refutation 28 verified / 17 partial.
- **KEEP with a recorded weakness:** 10 citations (AC-083 c0 and c1, AC-085 c0/c2/c2/c4/c4, AC-088 c1.2, AC-103 c2, AC-109 c1). Each carries its weakness in its `reason`. In AC-085 c2 and c4 the criterion is partial anyway.
- **Missed gaps and weak existing citations:** 20 entries in 13 criteria. **Missed tests** (tests that exist and prove a clause the lane left uncited or weakly cited): 21 entries in 12 criteria.

## DROP: per-reason classes (9)

| Class | n | Citation | Why it does not prove the clause |
|---|---|---|---|
| A. Asserts a neighbouring property of the same resource | 3 | AC-084 c1:3 pgTAP `governed_activation/080-taxonomy.sqlinc:33-38` | Asserts the taxonomy activation response members (event type, subjectState, reviewVersion 3, lineageId). The curator grant is only a fixture. The clause is "serves only the holder of the subject kind's owner capability". |
| | | AC-089 c2:0 pgTAP `governed_reads/020-detail.sqlinc:12-17` | Asserts the 30 top-level members of the detail body. Clause 2 is the members of a decision element, asserted at `020-detail.sqlinc:44` and by the kept contract citation. |
| | | AC-097 c0:2 vitest `apps/worker/src/cms-composition/governed-review-reads.test.ts:158-167` | Asserts 200, ETag "7", body and wire defaults. It never reads `cache-control`; its CMS-03C-10 neighbour does, at line 38. Nothing about mutation, so it does not prove "no-store, mutation-free". |
| B. Wrong operation (neighbouring endpoint) | 1 | AC-120 c0:4 pgTAP `pattern_update_diff/040-authority.sqlinc:9-10` | "once assigned on the entry, a second author reads the same diff [AC-114]" is the CMS-03C-14 diff read (file header lines 1-2). AC-120 is the CMS-03C-15 update command. "Same authority gate" is an argument, not an assertion. |
| C. Wrong outcome or refusal class | 2 | AC-104 c2:4 pgTAP `pattern_definition/070-storage.sqlinc:104-108` | A version that does not follow its parent is `P0001:VALIDATION_FAILED`, the 422 class. Clause 2 names 409 `COMPOSITION_VERSION_CONFLICT`. |
| | | AC-122 c0.1:1 vitest `pattern-update-refusals.test.ts:163-173` | Asserts a successful replay: same key twice, 200, same ETag and body, port called twice. The sub-clause is an idempotency conflict (409). The opposite outcome. |
| D. Source-text assertion, not behaviour | 3 | AC-105 c0 x3 vitest `apps/web/src/pages/app/cms-content-modeling/patterns/pattern-pages.test.ts` | Reads the two Astro files with `readFileSync` and matches strings (`<CmsPatternVersionDesigner`, `client:load`, `prerender = false`, no-store, GET-only). A comment or dead branch would pass. The third also asserts a different property than "consumed by the designer at the two routes". |

DROP by tool: 4 pgTAP, 5 vitest. By criterion: AC-084, AC-089, AC-097, AC-104, AC-120 and AC-122 one each, AC-105 three.

## FIX (14)

Thirteen are sound assertions blocked by a file-level guard problem; one is a retarget.

| Criterion | Clause | File | Citation (start of title) | Class |
|---|---|---|---|---|
| AC-083 | c0 | `governed_activation/030-activate.sqlinc` | retire of the active subject with the pre-activation review version is VERSION_MISMATCH | dup-description file |
| AC-083 | c4 | `governed_activation/095-retire.sqlinc` | a scheduled, draft (invalidated review), superseded or approved subject is 409 subject_not_retirable | dup-description file |
| AC-083 | c4 | `governed_activation/095-retire.sqlinc` | the owner retires an active version whose frozen dependency evidence is stale | dup-description file |
| AC-083 | c4 | `governed_activation/095-retire.sqlinc` | the same loss of authority does not stop RETIRING the active gq1 | dup-description file |
| AC-083 | c4 | `governed_activation/095-retire.sqlinc` | the same unavailable policy evidence does not stop a retirement | dup-description file |
| AC-085 | c2 | `governed_activation/030-activate.sqlinc` | a second activation with the pre-activation version is VERSION_MISMATCH | dup-description file |
| AC-086 | c0.0 | `governed_activation/030-activate.sqlinc` | retire of the active subject with the pre-activation review version is VERSION_MISMATCH | dup-description file |
| AC-086 | c0.0 | `governed_activation/030-activate.sqlinc` | a second activation or schedule of an already active subject is 409 subject_not_activatable | dup-description file |
| AC-086 | c0.0 | `governed_activation/095-retire.sqlinc` | a scheduled, draft, superseded or approved subject is 409 subject_not_retirable | dup-description file |
| AC-086 | c0.0 | `governed_activation/030-activate.sqlinc` | the mismatch, second activation and stale-version retire left the subject, review, event and audit counts exactly as the one activation made them | dup-description file |
| AC-086 | c0.0 | `governed_activation/095-retire.sqlinc` | the subject_not_retirable refusals change nothing and reserve no idempotency record | dup-description file |
| AC-086 | c4 | `governed_activation/030-activate.sqlinc` | the mismatch, second activation and stale-version retire left the subject, review, event and audit counts exactly as the one activation made them | dup-description file |
| AC-086 | c4 | `governed_activation/095-retire.sqlinc` | every retire refusal on the active ga1 leaves the subject, review, idempotency, audit and outbox stores identical | dup-description file |
| AC-113 | c0 | `pattern_update_diff/040-authority.sqlinc` | a malformed instanceId carries no DETAIL pointer | retarget |

- **Duplicate-description class (13):** the file is one of the two `governed_activation` files with duplicated descriptions (finding 1). Do not apply until root renames one of each pair and regenerates the pgTAP receipts. The citation text needs no change.
- **Retarget (1), AC-113 c0:2:** `040-authority.sqlinc:39-40` asserts only the empty DETAIL. The INVALID_REQUEST outcome is asserted by `s12pu_refused('g-bad-id', ...)` at `040-authority.sqlinc:33-34`. Retarget to `pattern_update_diff.sql :: g-bad-id: exact SQL message token INVALID_REQUEST`. It is a computed title owned by the entrypoint and appears once, passing, in the newest TAP. Keep the empty-DETAIL assertion as a second citation.

## Splits and removals

- 19 of 20 splits are OK: each part is verbatim, in order, non-overlapping, with only separators between parts. This was guard-simulated.
- **AC-107 clause 0: REJECT.** Part 0 is ``accepts only a UUID `contentTypeId` ``, but the clause begins `CMS-03C-13 `. Those words fall outside any part and are not a separator. The guard reports `P2-S12-AC-107: criterion text not covered by any clause: "CMS-03C-13"`. Fix: start part 0 at the clause start, ``CMS-03C-13 accepts only a UUID `contentTypeId` ``. Parts 1 and 2, and the AC-107 clause-2 split, are fine.
- 16 removals are OK. The removed text is only `,`, `:` or `, and`.
- This answers the lane's Request 3: the split and removal policy is acceptable once the AC-107 fix is made.

## Status changes

| Criterion | Lane | After refutation | Reason |
|---|---|---|---|
| P2-S12-AC-084 | verified | **partial** | Clause 1 ("the subject kind's owner capability") has no wrong-kind negative and its taxonomy citation is dropped. Finding 3. |
| P2-S12-AC-108 | verified | **partial** (arguable) | "an other-owner version is never listed" has no data-backed assertion. Finding 8. If root accepts the unreachable-by-construction reading, it stays verified. |

- AC-080 and AC-122 stay `verified` only if their required missed tests are added (findings 9 and 4).
- Recommended completions that do not change a status: AC-081, AC-083, AC-093, AC-115, AC-120.
- The AC-105 limitation text must change even though its status stands. The lane's sentence says clause 0 "rests on source-text assertions of the two Astro pages plus the loader tests". After the DROPs it rests on the loader tests alone and the page glue is unproven.

## The ten most serious findings

1. **Two duplicated pgTAP descriptions in `governed_activation` make 13 of lane b's citations unappliable (FIX x13).**
   - Evidence: `supabase/tests/phase_02_slice_12_governed_activation/030-activate.sqlinc:48` and `095-retire.sqlinc:153` both read `the completed idempotency record stores status 200 [P2-S12-AC-086]`. `030-activate.sqlinc:55` and `095-retire.sqlinc:165` both read `an exact same-key replay returns the original response and writes no second event, audit record or state change [P2-S12-AC-086]`. Both files are `\ir`-included by `supabase/tests/phase_02_slice_12_governed_activation.sql` (lines 34 and 40).
   - The newest real TAP run of the suite (2026-10-23T05:20Z) prints each description twice. The guard refuses a cited file that hides a duplicated identity, so every citation in either file fails.
   - Exposure: lane b cites the two files 13 times (AC-083 x5, AC-085 x1, AC-086 x7). Lane c cites them 15 times (AC-197, AC-205, AC-207) and lane d 3 times (AC-249, AC-250). The current ledger cites neither, so the defect appears only on application.
   - The lane's Request 1 names the defect but quotes the statement-start lines 45, 53, 150, 163. The literals are on 48, 55, 153, 165.
   - Action: root renames one of each pair (description text only), regenerates the receipts, then the FIX apply unchanged.

2. **The AC-107 split of clause 0 breaks the guard.** Evidence and fix are under Splits and removals. I reproduced it by applying all proposals through the real `evaluateLedger`. As proposed, the whole ledger fails the guard on this one entry.

3. **AC-084 is proposed `verified`, but the subject-kind owner capability is never tested against the wrong kind (status to partial, c1:3 DROP).**
   - BE03c lines 173 and 1644 map `cms.template_designer` to template and pattern versions and `cms.taxonomy_curator` to taxonomy versions.
   - In `governed_activation/*` and `governed_submit/*`, no assertion shows a designer refused on a taxonomy review or a curator refused on a template or pattern review.
   - The Worker test `apps/worker/src/cms-composition/governed-activation-gate.test.ts:43` ("admits a taxonomy curator as well (the any-of owner gate); the database decides the subject kind") leaves the per-kind decision to the database, where it is untested.
   - The one taxonomy "positive" the lane cites asserts a response shape, hence the DROP.
   - The lane listed exactly this gap as its weakest item 5 and still proposed `verified`.

4. **AC-122: the Worker citation for the idempotency conflict asserts the opposite outcome, and the lane report is wrong that no mapping test exists (DROP + required missed test).**
   - `pattern-update-refusals.test.ts:163-173` is a successful replay.
   - `apps/worker/src/cms-composition-production-pattern-update-failure.test.ts:272-279` does the mapping. Its identity is `CMS-03C-15 specifics IDEMPOTENCY_MISMATCH (a lock timeout or deadlock, a reused key) is a 409 with no member`, and it passed in `vitest-all.json`. It maps `CONFLICT`, `IDEMPOTENCY_MISMATCH` and `IDEMPOTENCY_CONFLICT` to 409 with empty details (`cms-composition-production-pattern-update-failure.ts:99-103`).
   - The route publishes a producer 409 as `COMPOSITION_VERSION_CONFLICT` (`pattern-update-refusals.test.ts:57-76`).
   - Replace the dropped citation with the mapping test. The SQL token assertion (`i-mismatch`, c0.1:0) stays.
   - No equivalent CMS-03C-12 mapping test exists, so AC-104 keeps its stated gap.

5. **AC-105 clause 0: three source-text citations (DROP x3).** `pattern-pages.test.ts` lines 1-12 import `readFileSync` and state "this suite reads each Astro file for the response invariants". It asserts that strings occur in `new.astro` and `[patternKey].astro`. The lane listed it as its weakest item 2 yet proposed it. Clause 0 stays carried by the three loader behaviour tests (c0:3 to c0:5). The page glue has no behavioural test, and the limitation must say so.

6. **AC-120 clause 0: a CMS-03C-14 read assertion cited for the CMS-03C-15 command (DROP).** `pattern_update_diff/040-authority.sqlinc:9-10` reads through the CMS-03C-14 diff helper (file header: "CMS-03C-14 authority, concealment and request grammar"). The lane's "same authority gate" is an inference. The command-side proofs are c0:3 (`r-no-edit`) and c0:5 (assigned author answers the update), both kept.

7. **AC-104 clause 2: a 422-class assertion cited for a 409 clause (DROP).** `pattern_definition/070-storage.sqlinc:104-108` asserts `P0001:VALIDATION_FAILED`. Clause 2 lists the 409 refusals: stale parent, key or version, cycle, idempotency conflict. The stale parent (c2:0, c2:1) and duplicate key (c2:2, c2:3) are proven elsewhere in the clause.

8. **AC-108: "an other-owner version is never listed" has no data behind it (status to partial, arguable).**
   - No pattern owned by another party exists in the `pattern_selector` fixtures. `'other'` appears only as a caller (`020-authority.sqlinc:26,27,49`).
   - The citations that claim it assert `owner_id = ownerOrg and state = 'active'` for every listed row (`000-selector.sqlinc:73-76`), while the oracle query filters by the same owner (`000-selector.sqlinc:31`). A selector that dropped its owner filter would pass every cited test.
   - The lane marked AC-101 and AC-107 partial for the identical absence of a cross-owner id, but AC-108 verified.
   - Counter-argument: CMS-03C-12 only accepts the caller's own content types in `compatibleTypeIds`, so the case may be unreachable without forging a row. That is an owner reading, not a proof.

9. **AC-080 clause 1 and AC-081 clause 1 rest on existing citations that assert less than their titles (required and recommended missed tests).**
   - AC-080 c1: the lane adds nothing. It keeps `governed-review-ops-refusals.test.ts` "STEP_UP_REQUIRED raised by SQL ... answers 401 with the step-up members, reserving nothing". Its body (lines 52-67) asserts status 401, the code and two detail members only.
   - "Reserves no idempotency record and changes no state" is asserted by two uncited pgTAP assertions in `governed_assignment/020-create.sqlinc`. Lines 79-83 cover four step-up refusals. Lines 84-90 are `the step-up refusal reserves no idempotency record and changes no state [P2-S12-AC-080]`. Both exist once and pass in the newest TAP. Add both.
   - AC-081 c1: the component test stubs `loadOptions`. The real request (`/api/v1/cms/capability-grants?capability=cms.reviewer&state=active&limit=100`, no-store) is asserted only in uncited `cms-workflow-reviewer-options.test.ts:55-62`.

10. **Three citations show a neighbouring property (DROP AC-097 c0:2, DROP AC-089 c2:0, FIX AC-113 c0:2).** Each is a title-level match that a reading of the assertion does not support: cache-control never read (`governed-review-reads.test.ts:158-167`), the top-level key list instead of the decision element (`020-detail.sqlinc:12-17`), the empty DETAIL instead of the INVALID_REQUEST outcome (`040-authority.sqlinc:39-40`). None changes a status.

## Gaps and missed tests

**Lane-declared gaps:** all 20 uncited sub-clauses (15 criteria) are real, and I found no test that closes any of them. Confirmed in detail:
- AC-085 c1, lock order of BE03c 1501 (positions 1, 3, 4, 5): no pgTAP or race module observes it. `phase_02_slice_12_governed_authority.race.mjs` is about authority revocation, and `090-lineage-lock.sqlinc` observes only the last position. AC-085 c2 (review-row lock invisible from one session) and c4 ("atomically", no injected failure) stay weakly cited, as the lane says.
- AC-086: `activation_conflict` (needs two sessions), the 422 preflight failure (the producer folds preflight differences into `dependency_changed`), and `canonical_source_unavailable` with `details.domain` (Worker mapping only).
- AC-083 c2: the activate and schedule recheck of the subject hash and policy basis is never driven at CMS-03C-09.
- AC-110 c3: `apps/web/src/components/cms-composition-instances/use-composition-insert.ts:72-95` (`loadMore`) turns any non-page answer into selector state. There is no 409 branch and no restart from the first page. The only 409 handling (line 128) is for the placement submit. Implementation and test are both missing.
- AC-088 (policyBasis order), AC-091/097/103/109/115 (hosted p95 and the 2 s target), AC-095 (body and mutation header on the queue), AC-101/107 (cross-owner id), AC-105 (nested picker, node path) and AC-117 c6 (degraded held diff) are as the lane declared.

**Gaps the lane did not declare, or weak existing citations it relied on** (20 entries in `missedGaps`, summarised):
- AC-080 c1 and AC-081 c1/c5: existing citations assert less than their titles (finding 9).
- AC-083 c0 "in order": only step-up before concealment is observed. No test shows concealment before the version CAS, or the CAS before the approved-state check.
- AC-083 c4: retire is never staged with a changed hash, provider or preflight. A frozen hash cannot change after activation without forgery, so the weight is low.
- AC-084 x2 (finding 3) and AC-108 x2 (finding 8).
- AC-093 c5: "each reader scope" and "reason visibility to its decider only" are half-covered. The other half is in AC-090 pgTAP assertions the clause does not cite.
- AC-104 c2: the Worker mapping of `IDEMPOTENCY_MISMATCH` for CMS-03C-12 is asserted by no cited test. The SQL token is, and the 409 class is carried by the `CONFLICT` mapping.
- AC-120: the Worker halves of clauses 2, 5 and 6 are not cited.
- AC-122: the false statement (finding 4).

**Missed tests** (21; full text in the JSON `missedTests`). REQUIRED where the lane's status depends on them:
- AC-080 c1 REQUIRED: [pgtap] `governed_assignment/020-create.sqlinc` :: a missing, stale (11 min) or future (+2 min) step-up is STEP_UP_REQUIRED, even before a hidden review is concealed
- AC-080 c1 REQUIRED: [pgtap] `governed_assignment/020-create.sqlinc` :: the step-up refusal reserves no idempotency record and changes no state [P2-S12-AC-080]
- AC-081 c1: [vitest] `web/components/cms-editorial-workflow/cms-workflow-reviewer-options.test.ts` :: loadReviewerOptions reads the owner-only active cms.reviewer grants no-store and offers each person once
- AC-082 c1: [pgtap] `governed_activation/030-activate.sqlinc` :: the 200 body is exactly GovernedActivationResource (12 members, DEC-191 supersededVersion) [P2-S12-AC-082]. This file is blocked until the rename.
- AC-083 c5: [pgtap] `governed_activation.sql` :: a body capability or stepUpAt, a mismatched action member ... (SQL If-Match INVALID_REQUEST, computed title)
- AC-084 c0: [pgtap] `governed_activation/020-gates.sqlinc` :: the step-up refusal reserves no idempotency record and changes no state [P2-S12-AC-086]
- AC-086 c0: [vitest] `worker/cms-composition/governed-review-ops-refusals.test.ts` :: 'CMS-03C-09' SQL refusal transport maps activation_conflict (a lost race on the lineage). HTTP half only.
- AC-086 c1: [vitest] `worker/cms-composition/governed-review-ops-refusals.test.ts` :: 'CMS-03C-09' SQL refusal transport maps canonical_source_unavailable {domain}. HTTP half only.
- AC-093 c5 (four): [pgtap] `governed_reads/020-detail.sqlinc` :: the deciding reviewer sees his own reason and the mine flag [P2-S12-AC-090]
  - [pgtap] `governed_reads.sql` :: a holder of the subject kind's owner capability who is neither submitter, assignee nor owner reads the review ...
  - [pgtap] `governed_reads/020-detail.sqlinc` :: the submitter who is not the receipt owner reads the review without owner actions or assignments
  - [pgtap] `governed_reads/020-detail.sqlinc` :: the detail carries the review base, the recomputed block digest, the subject state and the live distinct approval count ...
- AC-102 c3: [pgtap] `pattern_definition.sql` :: capability-missing: exact SQL message token [P2-S12-AC-104]
- AC-113 c0: [pgtap] `pattern_update_diff.sql` :: g-bad-id: exact SQL message token INVALID_REQUEST (the FIX retarget)
- AC-115 c3: [vitest] `worker/cms-composition/pattern-update-registry.test.ts` :: the three registry rows CMS-03C-14: GET update-diff, 300/600 per minute, 8,000 ms. In the file it is at lines 82-96.
- AC-120 c2: [vitest] `worker/cms-composition-production-pattern-update-failure.test.ts` :: CMS-03C-15 refusal mapping NOT_FOUND is 404
- AC-120 c5 (two): [vitest] `worker/cms-composition-production-pattern-update-failure.test.ts` :: CMS-03C-15 specifics a malformed envelope, action or id is a 422 at the producer pointer
  - [vitest] `worker/cms-composition/pattern-update-refusals.test.ts` :: a refusal the producer pointed at the request is relayed as pointer-shaped violations
- AC-120 c6: [vitest] `worker/cms-composition/pattern-update-refusals.test.ts` :: a stale entry or instance version is the plain conflict with the version pair only
- AC-122 c0 REQUIRED: [vitest] `worker/cms-composition-production-pattern-update-failure.test.ts` :: CMS-03C-15 specifics IDEMPOTENCY_MISMATCH (a lock timeout or deadlock, a reused key) is a 409 with no member
- AC-122 c0: [vitest] `worker/cms-composition-production-pattern-update-failure.test.ts` :: CMS-03C-15 specifics a stale entry or instance version is a 409 with the version pair only

## Per-criterion table

| AC | Cites | KEEP | DROP | FIX | Lane | Refuted | Gaps | Missed |
|---|---|---|---|---|---|---|---|---|
| 080 | 21 | 21 | | | verified | verified | 1 | 2 |
| 081 | 13 | 13 | | | verified | verified | 2 | 1 |
| 082 | 23 | 23 | | | verified | verified | | 1 |
| 083 | 21 | 16 | | 5 | partial | partial | 2 | 1 |
| 084 | 9 | 8 | 1 | | verified | **partial** | 2 | 1 |
| 085 | 13 | 12 | | 1 | partial | partial | 3 | |
| 086 | 38 | 31 | | 7 | partial | partial | | 2 |
| 087 | 15 | 15 | | | verified | verified | | |
| 088 | 21 | 21 | | | partial | partial | | |
| 089 | 6 | 5 | 1 | | verified | verified | 1 | |
| 090 | 9 | 9 | | | verified | verified | | |
| 091 | 4 | 4 | | | partial | partial | | |
| 092 | 2 | 2 | | | verified | verified | | |
| 093 | 11 | 11 | | | verified | verified | 2 | 4 |
| 094 | 15 | 15 | | | verified | verified | | |
| 095 | 15 | 15 | | | partial | partial | | |
| 096 | 8 | 8 | | | verified | verified | | |
| 097 | 10 | 9 | 1 | | partial | partial | | |
| 098 | 10 | 10 | | | verified | verified | | |
| 099 | 12 | 12 | | | verified | verified | | |
| 100 | 24 | 24 | | | verified | verified | | |
| 101 | 34 | 34 | | | partial | partial | | |
| 102 | 17 | 17 | | | verified | verified | | 1 |
| 103 | 18 | 18 | | | partial | partial | | |
| 104 | 33 | 32 | 1 | | verified | verified | 1 | |
| 105 | 20 | 17 | 3 | | partial | partial | | |
| 106 | 12 | 12 | | | verified | verified | 1 | |
| 107 | 16 | 16 | | | partial | partial | | |
| 108 | 14 | 14 | | | verified | **partial** | 2 | |
| 109 | 12 | 12 | | | partial | partial | | |
| 110 | 10 | 10 | | | partial | partial | 1 | |
| 111 | 9 | 9 | | | verified | verified | | |
| 112 | 25 | 25 | | | verified | verified | | |
| 113 | 24 | 23 | | 1 | verified | verified | | 1 |
| 114 | 33 | 33 | | | verified | verified | | |
| 115 | 12 | 12 | | | partial | partial | | 1 |
| 116 | 6 | 6 | | | verified | verified | | |
| 117 | 23 | 23 | | | partial | partial | | |
| 118 | 17 | 17 | | | verified | verified | | |
| 119 | 28 | 28 | | | verified | verified | | |
| 120 | 27 | 26 | 1 | | verified | verified | 1 | 4 |
| 121 | 21 | 21 | | | verified | verified | | |
| 122 | 32 | 31 | 1 | | verified | verified | 1 | 2 |
| 123 | 13 | 13 | | | verified | verified | | |
| 124 | 40 | 40 | | | verified | verified | | |

## Files

| Path | Lines | Bytes | SHA-256 |
|---|---|---|---|
| `docs/handoffs/2026-10-22-claude-s12/recite/b-refutation.json` | 8215 | 499,840 | `f616a5471fe907c6c7e3aad40e4bae82f1e55f83f2659715fafab151a2e39bb2` |
| `docs/handoffs/2026-10-22-claude-s12/review-refute-b-report.md` | not written | | the Write tool refused it; this inline text is the report |

`b-refutation.json` is an array of 45 entries: `{criterion, citations[{clauseIndex, splitIndex?, tool, file, title, verdict, reason, fix}], splits[{clauseIndex, kind?, verdict, reason, fix?}], missedGaps[], missedTests[{clauseIndex, citation{tool,file,title}, evidence}], status, statusNote}`. `status` is the refuted semantic status; `statusNote` says where it differs from the lane or what it depends on. Evidence line numbers inside the JSON can be off by one against the lines quoted in this report; this report's numbers were re-verified in the closing pass.

Scratch, outside the worktree and not deliverables: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_refute_b/`. It holds the `rv/<nnn>.mjs` verdict sources, `build.mjs` (writes the JSON), `validate.mjs`, the guard simulations (`apply_all.mjs`, `postref.mjs`, `suggest.mjs`), the TAP cross-checks (`tapcheck2.mjs`, `tapdups.mjs`) and `weakscan.mjs`.

## Runs

None of the forbidden kinds. No supabase, docker, db, `pg_prove`, race module, Vitest or Playwright run, and no sub-agent. Read-only Node scripts only:
- TypeScript-AST location of vitest blocks.
- `node scripts/evidence/list-test-identities.mjs --vitest <vitest-all.json> --file <path>`.
- An in-memory `evaluateLedger` simulation with synthetic receipts.
- Parsing of the existing `.lane-logs/*.tap` files.

Entries AC-080 to AC-117 of the JSON were written before the usage-limit interruption and are unchanged since, checked byte for byte against a snapshot. AC-118 to AC-124 were added after it.

## Test corrections

None. No test, fixture or spec was edited.

## Spec citations

- **BE03c** `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`:
  - line 173 (CMS-03C-06 row) and line 1644 (CMS-03C-06 authority table): subject-kind owner capability.
  - line 1410 (CMS-03C-09 error matrix), line 1479 (CMS-03C-09 ordered steps, `Slice 12 lock order`) and line 1501 (lock order positions).
  - Criterion and clause text come from `tests/contracts/phase-02-slice-12-evidence-ledger-072-142.ts` and `.memory/wiki/specs/phases/phase-2.md`.
- **FE03** `.memory/wiki/specs/fe/03-cms-content-modeling.md` line 2727: the Slice 12 governance test strategy assigns the form, panel, designer and diff rules to Vitest. This is the basis for accepting jsdom proof of the meta clauses AC-087 c7, AC-093 c5, AC-099 c6 and AC-123 c10.
- **Guard:** `scripts/evidence/README.md`, `scripts/evidence/ledger-guard-lib.mjs` (`CLAUSE_SEPARATOR` at line 57; sibling and sole-proof rules) and `scripts/evidence/identity-receipts-lib.mjs`.

## Open items / BOUNDARY

- **Owner readings still open, not decided here:** AC-086 "a preflight failure" (422) and AC-105 "inline with the node path" (the lane's Request 4), and the AC-107/AC-108 other-owner question (finding 8).
- The existing citations listed under Scope were not re-audited in depth.
- pgTAP identity evidence is source reading plus historical TAP dated 2026-10-23, before the last edits. Root's receipts pass decides.
- The combined four-lane simulation also reported 72 guard problems outside AC-080 to AC-124. Examples: "partial entry: every clause is cited", "unverified entry cites N test(s)", a citation twice in one clause. They belong to lanes a, c and d, were not analysed here, and may partly reflect how those proposals encode status. Reproduce with `node apply_all.mjs a,b,c,d` in the scratch directory.
- The stale BOUNDARY comment in `CmsPatternNestedPicker.tsx` that the lane reported is unchanged.
- The lane's Request 2 (run the pgTAP entrypoints before applying) stands. All 483 titles already occur in historical TAP, so a match is expected.

## Requests to root

1. **Rename one description of each duplicated pair.** Use `095-retire.sqlinc:153` and `:165`, or the `030-activate.sqlinc:48` and `:55` twins. Regenerate the pgTAP receipts, then apply the 13 FIX of lane b, and the 18 of lanes c and d that cite the same two files. This is a test edit, so review it as a test correction.
2. **Apply the 9 DROPs.** For AC-122 add the mapping test from finding 4. For AC-113 apply the retarget `g-bad-id: exact SQL message token INVALID_REQUEST`.
3. **Fix the AC-107 clause-0 split.** Part 0 text: ``CMS-03C-13 accepts only a UUID `contentTypeId` ``.
4. **Record AC-084 as partial.** Split clause 1 into `then serves only the holder of`, cited by the kept clause-1 citations, and `the subject kind's owner capability as for CMS-03C-06`, uncited. Set status `partial` with this limitation: "Unproven: that the owner capability is the SUBJECT KIND's own (BE03c 173 and 1644: cms.template_designer for a template or pattern version, cms.taxonomy_curator for a taxonomy version): no pgTAP shows a template designer refused on a taxonomy review or a taxonomy curator refused on a template or pattern review. The other conditions are cited from governed_activation pgTAP and the Worker admission, gate and transport suites." A pgTAP pair would close it: a wrong-kind holder on each kind, stores unchanged.
5. **Decide AC-108.** Either:
   - **Record partial.** Split clause 2 into `so a draft, non-compatible`, cited by the kept clause-2 citations, and `or other-owner version is never listed`, uncited. Limitation: "Unproven: that an OTHER owner's pattern version is never listed (and the 'of that owner' half of the active-only clause): every pattern in the pattern_selector fixtures belongs to the caller's owner party, so the owner filter has no data-backed assertion. The draft, non-compatible, active-only, capability and serialization conditions are cited from pattern_selector pgTAP, Worker and contract tests."
   - **Keep verified.** Add a forged other-owner row case.

   The forms in requests 3, 4 and 5 were simulated guard-clean: no problem for AC-084, AC-107 or AC-108.
6. **Add the missed tests.** Required: AC-080 c1 (`020-create.sqlinc` lines 79-83 and 84-90) and AC-122 c0 (the mapping test). Recommended: AC-081 c1, AC-083 c5, AC-086 c0/c1 (HTTP halves), AC-093 c5 (four), AC-102 c3, AC-113 c0, AC-115 c3, AC-120 c2/c5/c6 and the second AC-122 test. The list is in the JSON `missedTests`.
7. **Reword the AC-105 limitation.** Clause 0 is cited from the loader behaviour tests only; the page glue of the two Astro routes has no behavioural test.
8. **Correct the lane b report before it is used as evidence.** The AC-122 sentence about the Worker mapping (finding 4) is wrong. The Request 1 line numbers should read 48/55/153/165, not 45/53/150/163.
9. **Run the final guard on the merged ledger of all lanes, not per lane.** That covers the sole-proof limit and the 72 problems listed under Open items.
10. **Persist this report as a file.** The Write tool refused it; save it at the path in the Status section.
