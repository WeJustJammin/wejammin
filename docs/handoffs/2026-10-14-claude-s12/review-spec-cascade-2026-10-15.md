# Independent review: Slice 12 spec-text cascade, 2026-10-15 (items 1-5)

Reviewer: Claude (adversarial, read-only; did not author the edits). Worktree `claude/phase2-slice12` at HEAD `b16edb54`, working-tree text as of this review. Method: `git diff`, `grep` and `sed` only. Line numbers are current working-tree lines. Severity: MED = two implementers can diverge or a line contradicts another; LOW = wording, attribution or bookkeeping.

## 1. BE03c :215 If-Match operands: "a decision, an invalidation, an activation and a retirement do" advance the review version

Verdict: **correct against SQL; under-specified in the governing section; the ruling's principle is not applied consistently.**
- Matches the promoted SQL: `20261014160100_cms_governed_retire_apply.sql:108-114` sets review `version + 1` under CAS (`VERSION_MISMATCH` on loss) and answers `reviewVersion`; `...160200:15` states the same ruling.
- Not over-specified: DEC-190 says nothing about review-CAS bookkeeping. The ruling (`briefs/governed-retire-f1.md:3-6`) is an implementation call grounded in CMS-03C-10's strong ETag `"{review.version}"` (:172).
- 1a (LOW, under-specified): the normative text at :1345 says for `activate` "the review records `activated_at` and its `version` advances", but the `retire` sentence in the same paragraph is silent on it, so :215 is now the only statement. Add "and the review `version` advances (no other review column changes)" to the retire sentence.
- 1b (MED, principle conflict, widened by item 4): the ruling's rationale is that a changed body under an unchanged strong ETag violates HTTP semantics. But the schedule path never advances the review version: only `...070200_cms_governed_activation_core.sql:121` and the invalidation helper `...070000:174` update `cms_governed_reviews`. Schedule acceptance (`approved`→`scheduled`), claim, `failed_retryable` and `blocked` all change the CMS-03C-10 body (`subjectState`, `permittedNextActions` and, after DEC-191, `activationSchedule`) under the same ETag. :215 now reads as an exhaustive list that excludes them. Either state that the review `version` is a CAS operand only (CMS-03C-10 is no-store with no conditional GET), or extend the advance. Root/owner call; this is not a defect in the retire edit itself.
- Changelog :1726 is accurate.

## 2. BE03c :1287 CMS-03C-15 error-matrix cell

Verdict: **consistent with :1323 and `refusals.ts`; the trigger is under-specified; the sweep is incomplete.**
- The 409 cell now has `revision_not_editable`, and the 422 cell has `pattern_version_not_active`, `pattern_incompatible` and `nested_pattern_not_active`. This equals `packages/contracts/src/cms-composition/refusals.ts:191-197`: the 422 trio was already in HEAD, and `revision_not_editable` was added by the same uncommitted lane change B3. It also equals the :1323 status mapping. FE03 :885 and P2-S12-AC-123 require the front end to handle `revision_not_editable`.
- 2a (MED, under-specified): no BE03c behaviour line says when CMS-03C-15 raises `revision_not_editable`. The field row :400 and authorization row :1512 omit it, and :1386 is silent. Only CMS-03C-02 states its condition (:375, :1384 "effective state `draft`, else 409"). The producer's condition (instance revision no longer the editable draft, or an archived entry) lives only in `lane-pattern-updates-report.md:97` and a code comment. Likewise, no row says when CMS-03C-15 raises `pattern_incompatible` or `nested_pattern_not_active`: :400 maps every target failure to `pattern_version_not_active`. Add the conditions to :400 (mirroring :375) and state their order relative to the stale entry `version` 409.
- 2b (LOW-MED, incomplete sweep): the CMS-03C-02 cell :1274 has the very gap the changelog gives as its reason. Its 409 cell omits `revision_not_editable` (:375) and its 422 cell omits `pattern_version_not_active` and `pattern_incompatible` (:376), all of which `refusals.ts:121-127` lists.
- 2c (LOW): the :1323 parenthetical "the 409 of those operations is a stale CAS operand, a cycle or a collision" is now narrower than the matrix. It omits `revision_not_editable` (02, 15) and `block_registry_digest_mismatch` (02, 12).
- 2d (LOW, attribution): changelog :1729 says "pins kept as history per DEC-176". DEC-176 (`decisions.md:5081`) decides only that patterns apply to entry revisions; the "keep their pin as history" rule is BE03c :1386, which cites no decision.

## 3. BE03c :1398-1413 "Merge convergence Job disposition (BE00 233, 554, 571)"

Verdict: **the table is correct against code and runbook; several under-specifications; one upstream guarantee left unqualified.**
- The eight codes equal `TAXONOMY_MERGE_JOB_ERROR` (`apps/worker/src/cms-taxonomy-merge-converge-names.ts:25-34`) and runbook rows `docs/runbooks/platform/cms-taxonomy-merge-converge.md:50-59`. The mapping from row to code agrees with `cms-taxonomy-merge-converge-effect.ts:113-117, 176-181, 188-193` and `production-job-effect-dispatcher.ts:207-215`.
- "Never `queued`" is consistent with BE00 :547 (stale event-version rule) and :571. It narrows BE00 :554 ("retryable pre-effect failure returns job to queued") for this job type, which an owning-domain registry may do, but :554 is not annotated.
- 3a (MED, unqualified guarantee): :1396 still says a merge "re-points every `active` TermAssignment ... to the survivor", while :1413 now concedes that a `failed` Job leaves an unconverged tail that nothing re-requests. Qualify :1396 with a cross-reference. The tracker already records that P2-S12-AC-226 cannot close (owner question #6), and the recovery BOUNDARY has no tracking issue yet.
- 3b (LOW-MED): BE00 :571 requires a `failed` block to carry a registered code "and domain recovery reference". The section cites :571 but has none, and says none exists. That is honest, but it is non-conformant until owner question #6 is answered.
- 3c (LOW-MED, under-specified against the BE03a form the changelog (:1728) claims to follow): no `resultRef.type` literal (code `cms.taxonomy.merge_converge`, `effect.ts:206-209`; BE03a fixes `cms_schema_dry_run_report`); no `resultRef` on `failed`, and no `error.retryable` value (runbook :30: none and `false`); no attempt count or budget behind "every attempt" (runbook :26: 3 attempts, 15 s/60 s, `min(240 s, lease − 60 s)`; BE03a has a DEC-184 budget section).
- 3d (LOW): the section says "exactly one code below", yet the table is not exhaustive. It does not cover a mixed sequence (conflict then timeout), where the code uses the last attempt's class (`effect.ts:176-181`), or a missing Worker context (runbook :56).
- 3e (LOW): :1413 is literally true. But a later merge of the same party above 5,000, or a running continuation chain, drains all of that party's merged-term work (`20261014120300_cms_taxonomy_merge_convergence.sql:179-209`; runbook :78-80). Saying so avoids the "never drains" overstatement already caught as m-f1.
- 3f (LOW, changelog accuracy): ":1728 No behavior change" understates the edit, which registers eight wire-visible `JobStatus.error.code` values. The row also cites "D-W3", a lane-local id absent from `decisions.md`. The graph refresh turned it into the phantom node `decision:d-w3` (`.memory/schema/spec-graph.json:11004-11007`) and the dangling link `[[decisions.md#d-w3|D-W3]]` (BE03c :1751-1752), and lint did not flag it.

## 4. DEC-191 members (BE03c :1054-1068 `activationSchedule`, :1106-1108 `supersededVersion`)

Verdict: **correct and additive; two under-specifications; the decision-record pins are stale.**
- The `state` and `reasonCode` enums equal the :1473 CHECKs, and the "non-null exactly when blocked or cancelled" comment equals `CHECK((state IN ('blocked','cancelled')) = (reason_code IS NOT NULL))`. The contracts match (`governed-review-read.ts`; `governed-activation.ts` refines `supersededVersion` to null unless `activate`). FE03 :882 (render the superseded version; closed reason for blocked and cancelled schedules) and FE03 :1118 are satisfied. `supersededVersion` being null for schedule, retire and first activation is consistent with :1345.
- 4a (LOW-MED, under-specified): "the most recent GovernedActivationSchedule of this review" has no ordering key. The SQL invents one: a live state first, then `created_at DESC, id DESC` (`20261014170000_cms_governed_read_gap_helpers.sql:54-56`). A second implementer would likely use `created_at` alone. State the order in the schema comment or at :1347.
- 4b (LOW-MED, disclosure scope): :1485 says GovernedActivationSchedule has "no browser or service-role read", yet CMS-03C-10 now projects the schedule state and reason to every reader: submitter, reviewer assignee and owner. The reason can be `activation_authority_ended`, which reveals that the owner's grant ended. `assignments` is explicitly owner-only, but this member has no scope note, while DEC-191 says "no new ... authority". Either restrict the member to the owner or qualify :1485.
- 4c (LOW): Decision status :29 lists decisions through DEC-189 and omits DEC-191 (and DEC-190).
- 4d (LOW): DEC-191 (`decisions.md:5288-5293`) cites "BE03c 1328, 1437". Later inserts shifted those lines, which are now a blank line and an unrelated heading; the targets are now :1347 and :1473. The derived `decisions.md` text also differs cosmetically from raw record `dec-191` (backticks and "Source:"), so the next compile will rewrite it. Substance is identical.
- Changelog :1727 is accurate apart from omitting the selection rule (4a).

## 5. IA03 :272 over-budget wording (changelog IA03 :583)

Verdict: **the edit is correct and matches FE03 :1050 and BE03c :1523, but the same correction is missing on two other lines.**
- All three lines now agree: a maximum-size success shows the 1 MiB ceiling is sufficient, and an over-budget refusal exists only at the Worker transport and route. "The largest producible response fits" can be derived from the bounded `CompositionInstanceResource` (:882-901: no props or overrides; path ≤248 octets), so it is not a measurement claim.
- 5a (MED, contradicts other lines; the same residue the follow-up was fixing): BE00 :488 still requires "a maximum-size success **and an over-budget refusal against the actual producer**", and BE03c :29 still says sufficiency "remains to be proven by a maximum-size success and an over-budget refusal". Both contradict the ratified ruling (changelog :1724) and the three corrected lines. The 2026-10-13 history rows (BE00 :707, BE03c :1723) are correctly untouched.
- 5b (LOW, tense): IA03 :272 "is proven" and FE03 :1050 "is validated" read as completed facts. BE03c :1523 says "remains required before it is accepted" and BE00 :488 says "is not claimed to be already proven". Align them on "must be proven before acceptance".
- Changelog IA03 :583 is accurate. Its citation BE03c :1487 was correct when written and is now :1523.

## Cross-cutting checks

- No measurement or corpus count was written into spec text. The DEC-189 fixture byte count stays only in `decisions.md`. The new numbers are spec bounds or line pins.
- Fragile line pins in normative text: the :1398 heading "(BE00 233, 554, 571)" and "(BE00 547)". BE03a's equivalent heading cites "(DEC-183)". LOW.
- Changelog format: BE03c rows :1726-1729 and IA03 :583 carry 2 of the 4 header cells. BE03c has precedent (:1715-1718), but IA03 :575-582 all carry 4. LOW.
- No acceptance criterion was edited. The tracker's "spec text only" claim (`phase-02-slice-12.md:1918`) holds.

## Required follow-ups (none invalidates the five edits)

1. DEC-189 residue at BE00 :488 and BE03c :29 (5a).
2. CMS-03C-15 trigger conditions at :400, and a sweep of the CMS-03C-02 cell :1274 (2a, 2b).
3. `activationSchedule` selection order and reader scope; qualify :1485 (4a, 4b).
4. Qualify :1396 against :1413; add `resultRef.type`, `retryable` and the attempt budget (3a, 3c).
5. Root/owner: does the review version advance on schedule transitions, or is the ETag CAS-only (1b)?
6. Bookkeeping: :1345 retire sentence (1a), :29 decision list (4c), DEC-191 pins (4d), D-W3 phantom graph node (3f).

VERDICT: PARTIAL
