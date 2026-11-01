# Lane report — claude_s12_retire_cascade

## Status
GREEN (docs only, no code, no compile). `pnpm progress:check` exit 0 under `flock -s /tmp/wejammin-quiet.lock`; `git diff --check` clean on the six files.
DEC-190 cascade applied as scoped by the propagation scan section R, plus the root-ratified corrections and three same-ruling mirror fixes (listed under "Extensions", for root to accept or revert).

## Scope
Brief `briefs/retire-cascade.md`; skill `propagate-decision-apply`; scan `.memory/wiki/specs/audits/propagation-scan-governed-lifecycle-2026-10-13.md` section R; DEC-190 (`.memory/wiki/decisions.md`, last entry).
Tracker edits were exact line replacements on the four AC lines only (tracker diff = 4 hunks, 1972, 2096, 2126, 2157). The Dispatch Log and everything else in the tracker were untouched. No criterion ticked, added, removed or renumbered: plan 285 / 0 checked, tracker 285 / 0 checked.

## Files (post-edit SHA-256) and hash movement
| File | Before | After |
| --- | --- | --- |
| .memory/wiki/specs/phases/phase-2.md | 15bd664950f6be43da64239a5b06717d59b0be36581e2cd261033c3e80e88112 | e15395a8d2a7ad0b1cfd6416ea90592679b2306500066a81bff50d426dc0b87d |
| .memory/pipeline/progress/slices/phase-02-slice-12.md | 4edd574eed2bb01ceecbdf12b6bf0e48d01c6dbf281867f2a0721ab04cce6709 | dba0b634fe1bc3fc97885d51e4d606fe9c3eadd17e9a8bf694748bc38dadc07d |
| .memory/pipeline/progress/verification/2026-10-11-slice-12-depth-floor.md | 3068de83f0fa1e6fa2381d04291aabeaa74877e15c9d0d211faeb93f125552c8 | dabfd98620fe73916eef1e9ef97d5960750adce3307a4a06c2e2c5ed6d90fd6f |
| .memory/wiki/specs/be/03c-composition-taxonomy-localization.md | f202ee7d8840752f25397db3e02f51e5b7d664ef222bc8582fa5824bccdcc9b6 | f7985258db8661bbd745ff979850365c9694fb49b3e1aaa3448094f09f40dc1d |
| .memory/wiki/specs/fe/03-cms-content-modeling.md | 0e1a903e83b40e8e848318c7801b9e872401728b42db4e208c1727a5a60d21b1 | 26cce1270b832758f9462dd501e53796049ab3db1095dd773fa11bc0c4d7f2c1 |
| .memory/wiki/specs/ia/03-cms-content-modeling.md | a087fce3289c8a95b9bc5dc5eb15af9d4e03396e5134c92abf8e624f0ee782cb | 45929c3d71c893398ac5a4c8e6755f970c4174f22e5d2ab5aa8c45927d16c92b |

Slice 12 acceptance-section SHA-256 (`## Acceptance Criteria` heading through end of tracker file):
before `2843410c575c759a9e1b474cbd814bf1be987f16a16da3127c73ab336ed5e224`, after `c5c3885e54671bc857a29a74bdf8475618c756a6720c1acebf14269a78e5daec`.
Root must record the new hash in the tracker Dispatch Log (this lane did not touch it).

## Exact AC wording diffs (identical body text in plan, tracker and depth matrix; the trailing source link differs per file and was not changed)
AC083 (plan 3182, tracker 1972, matrix 110)
- old: "the unconditional step-up proof, the review resolved and concealed per scope, an `approved` review whose `version` equals `expectedVersion` (409 `GOVERNED_REVIEW_VERSION_CONFLICT`), and a recheck of the subject hash, the policy basis and every dependency in which a difference commits the invalidation (subject back to `draft`) and answers 409 `GOVERNED_REVIEW_VERSION_CONFLICT` with `details.reasonCode` `dependency_changed`; `retire` accepts an optional reason of 1-256 code points that is already NFC (refused, never normalized); the strong `If-Match` equals `expectedVersion` exactly."
- new: "the unconditional step-up proof, the review resolved and concealed per scope and the review `version` equal to `expectedVersion` (409 `GOVERNED_REVIEW_VERSION_CONFLICT`) for every action; `activate` and `schedule` further require an `approved` review and a recheck of the subject hash, the policy basis and every dependency in which a difference commits the invalidation (subject back to `draft`) and answers 409 `GOVERNED_REVIEW_VERSION_CONFLICT` with `details.reasonCode` `dependency_changed`; `retire` requires only an `active` subject (else 409 `subject_not_retirable`), needs no fresh approval and no hash, policy, dependency, provider or preflight validity (DEC-190), and accepts an optional reason of 1-256 code points that is already NFC (refused, never normalized); the strong `If-Match` equals `expectedVersion` exactly."

AC207 (plan 3306, tracker 2096, matrix 260)
- old: "and needs no review, makes it `retired`,"
- new: "and needs no new approval or review decision and no dependency, policy, provider or preflight validity (DEC-190) while keeping the `reviewId` addressing, the review-`version` `If-Match`, the unconditional recent MFA and the subject kind's owner capability, makes it `retired`,"

AC268 (plan 3367, tracker 2157, matrix 321)
- old: "the activation form only for the subject's owner-capability holder on an `approved` or `blocked` version, `GovernedReviewQueueQuery`"
- new: "the activation form only for the subject's owner-capability holder, offering _Activate_ and _Schedule_ on an `approved` or `blocked` version and _Retire_ on an `active` version when the server permits it, `GovernedReviewQueueQuery`"

AC237 (plan 3336, tracker 2126, matrix 290): `aggregateType `cms.locale_variant`` -> `aggregateType `cms_locale_variant`` (review-locale F1 ruling). Nothing else changed.

Parity check (node): AC083/207/268/237 body text equal across plan and tracker; matrix text equals plan text.

## Spec cascade items (source: DEC-190 unless stated)
| Item | Location (post-edit line) | Change |
| --- | --- | --- |
| BE03c 171 | route registry CMS-03C-09 event column | "only on a committed immediate activation, scheduled execution or retirement (schedule acceptance emits none)" |
| BE03c 1326 | ordered steps | step 3 approval, step 4 recheck and step 5 preflight scoped to activate/schedule; retire takes steps 1, 2 and the version comparison; retire paragraph lists kept checks (MFA, resolution, owner capability, review-version If-Match, idempotency, audit), no approval/hash/policy/dependency/provider/preflight validity, exactly one event |
| BE03c 1470 | authorization/precondition row CMS-03C-09 | preconditions split by action; retire: subject `active` only |
| BE03c 1492 | security summary | "needs no review" replaced by the no-new-approval statement keeping MFA, capability, review-version CAS |
| BE03c 1502 | CMS-03C-09 order of checks | split per action; "exactly one event" scoped to immediate activation/execution and retirement, schedule emits none |
| FE03 1069 | page route row | Activate/Schedule on approved or blocked, Retire on active when the server permits it |
| FE03 1798 | CMS-03C-09 contract row | dependency/hash-invalidated 409 scoped to activate and schedule; retire stays usable |
| IA03 267 | governed review row | activation/scheduling approval-gated; retirement via same review-addressed switch, no new approval/dependency/policy/preflight validity |
| BE03c 388, 1395 | D12 validation row, fan-out paragraph | `cms.locale_variant` -> `cms_locale_variant` (review-locale F1) |
| BE03c 163 | route row CMS-03C-05 | hidden/absent SOURCE 404; hidden/absent/ineligible TARGET uniform 422 `related_target_ineligible` (lane-related-report ruling; matches BE03c D11 at 1381 and validation row 385) |
| FE03 1050 | lifecycle/placement ceiling paragraph | producer over-budget refusal removed as unreachable; refusal exists only at Worker transport/route (review-placement B3/F9); no measurement written into the spec |
| Changelog rows | BE03c (after 1687), FE03 (after 2828), IA03 (after 580) | one 2026-10-15 row each |

## Extensions beyond the brief's named lines (same ruling; revert if root disagrees)
1. BE03c 1487 (response ceiling bullet) carries the same unsatisfiable "over-budget refusal against the actual producer" clause named in review-placement B3 (that review cites both FE03 1050 and BE03c 1487). Corrected identically.
2. BE03c 1258 (error matrix CMS-03C-05: 404 "hidden/absent source/target", 422 column) and BE03c 1466 (authorization matrix 404 column "hidden source/target") and FE03 1690 (CMS-03C-05 page contract row) repeat the pre-ruling 404 text for a target. Aligned to the 163 ruling.
3. Changelog rows (above) in the three specs.

## Verification
- `pnpm progress:check` (pinned toolchain, `flock -s /tmp/wejammin-quiet.lock`): exit 0, run twice (after the AC edits, and after the last edit).
- `git diff --check` on the six files: clean.
- No repo spec lint other than `progress:check` applies to these files. `.memory/pipeline/compile.mjs` was NOT run; no graph refresh (root's step: scan says refresh the graph only after the approved cascade, without regenerating the decision ledger).
- Static text only; no runtime proof, no AC check-off.

## Open items / BOUNDARY
- Review `version` on retire: BE03c 215 says "a decision, an invalidation and an activation" advance the review version and is silent on retirement; DEC-190 and the scan say not to infer a review-counter algorithm. I left it unspecified. The retire SQL producer needs a root ruling on whether retirement advances the review `version` (and what the response `reviewVersion` then carries). No spec text invented.
- Review state on retire: the spec does not say the originating review must still be `approved` at retire time; I wrote only "subject `active`" per DEC-190.
- Lock order for CMS-03C-09 (BE03c 1348) deliberately unchanged (scan: do not remove locks by implication).
- Scan items outside this brief and NOT applied (DEC-188 L-side): BE03c 1424/1425/208/1537 wording, IA03 332 and IA deep-dive line 66. The brief names no deep-dive line for the retire branch and the scan lists none under R (IA deep-dive 66 is an L item), so the IA deep dive is untouched.

## Requests to root
1. Stale tracker/plan/matrix ACs not named in the brief and left unedited (tracker only-the-named-lines rule): AC060 (plan 3159, tracker, matrix) still says "a hidden source or target is 404 `RELATED_CONTENT_NOT_FOUND`", which now contradicts BE03c 163 (target is the uniform 422). AC248 (plan 3347, tracker 2137, matrix 301) still says "`cms.locale_variant`" and contradicts BE03c 388/1395/AC237. Authorize a follow-up identical-text edit in plan/tracker/matrix for AC060 and AC248, or tell me to apply it.
2. Record the new acceptance-section SHA-256 (`c5c3885e...5daec`) in the Dispatch Log.
3. Run the graph refresh / `memory_compile` for the cascade (not run here).
4. Ruling on the review-version-on-retire open item above before the retire SQL producer lane starts.

## Follow-up pass
Date 2026-10-15. Authority: root rulings in the follow-up brief (AC060, AC248, DEC-188 wording residue per scan section L). Status: GREEN (docs only; no compile; no tick, add, remove or renumber of any criterion).

### Edits
1. AC060 (plan 3159, tracker 1950, matrix 87), identical body text in all three. Old: "a hidden source or target is 404 `RELATED_CONTENT_NOT_FOUND`, a visible source". New: "a hidden or absent source is 404 `RELATED_CONTENT_NOT_FOUND`, a hidden, absent or ineligible target is the uniform 422 `related_target_ineligible`, a visible source". Matches BE03c 163.
2. AC248 (plan 3347, tracker 2138, matrix 301): `cms.locale_variant` -> `cms_locale_variant`; nothing else changed. No `cms.locale_variant` remains in specs, plan or matrix; the only two hits left are historical Dispatch Log entries in the tracker (lines 1791-1792), deliberately untouched.
3. DEC-188 wording residue (BE03c line numbers unchanged by the edits, all single-line):
   - BE03c 208: definition fields, "including the definition `version`", are immutable from creation and stay immutable after activation.
   - BE03c 1424: "activation makes the row immutable, and immutable rows enforce updated_at=created_at with UPDATE/DELETE rejected" -> immutable definition rows reject DELETE and every UPDATE other than the guarded lifecycle-metadata transition (`state`, `lifecycle_version`, `activated_at`, `retired_at`, `updated_at`) through the governed RPCs; `updated_at` moves only with such a transition.
   - BE03c 1425: "active rows reject UPDATE/DELETE" -> reject DELETE and every UPDATE other than the guarded lifecycle-metadata transition; definition fields and `version` never change.
   - BE03c 1537: definition fields and `version` immutable from creation, active content immutable, only the five lifecycle columns advance, only through the governed RPCs.
   - IA03 332 and IA deep dive 66: only the `TemplateVersion`/`PatternVersion` (`template_version`/`pattern_version`) clause qualified: definition fields and definition `version` immutable from creation; only separate lifecycle metadata (private `lifecycle_version`, +1 per governed transition) advances through governed RPCs; no public lifecycle-version field. Signed-block and composition-version rules untouched; the mixed aggregate row was not rewritten.
   - Changelog rows (2026-10-15): one each in BE03c (after the existing DEC-190 row) and IA03. The deep dive has no changelog.
4. Tracker: exact in-place replacements on the AC060 and AC248 lines only; Dispatch Log and every other criterion untouched.

### Hashes
Acceptance section of tracker (`## Acceptance Criteria` through EOF): before `c5c3885e54671bc857a29a74bdf8475618c756a6720c1acebf14269a78e5daec`, after `9950eb5ddcd3df08516ed73a8c65a1acab9bfb794076dfc1f51eb38490820427`. Root must record the new hash in the Dispatch Log.

| File | Before | After |
| --- | --- | --- |
| .memory/pipeline/progress/slices/phase-02-slice-12.md | f556c4d62e972fe5cdf649257a9e9f4e0137cadb84bf297b4208ea26f08a3d90 | 0d826b0538f19ecf52018f899f6f616e36e1901475fc5d9dca85f301080dbe27 |
| .memory/wiki/specs/phases/phase-2.md | e15395a8d2a7ad0b1cfd6416ea90592679b2306500066a81bff50d426dc0b87d | 562e0b609ce9ec8cec8e892de9075064cf8e96783e935a38da1a7753584db9db |
| .memory/pipeline/progress/verification/2026-10-11-slice-12-depth-floor.md | dabfd98620fe73916eef1e9ef97d5960750adce3307a4a06c2e2c5ed6d90fd6f | 7bbd1773a1641539fff5e98ef0a7bb706dcda01f4f9103ae2510f170726aa21a |
| .memory/wiki/specs/be/03c-composition-taxonomy-localization.md | f7985258db8661bbd745ff979850365c9694fb49b3e1aaa3448094f09f40dc1d | eb57b3bf2f01a93eb105ad1c030f8160dec459d65d1f7921be1d23e06520e1fc |
| .memory/wiki/specs/ia/03-cms-content-modeling.md | 45929c3d71c893398ac5a4c8e6755f970c4174f22e5d2ab5aa8c45927d16c92b | a9399086318e08bf8e00f5d684c799e561a153b19a69dc4497c56c2c5dbf7e3c |
| .memory/wiki/specs/ia/deep-dives/03-cms-content-modeling.md | a6cbab5bdd5cda7d5a34475427bc7a600e2cf7df82d2fa2a06e8039eeaed0950 | 293ee639904b5a933af5c145009ac20978f072e42de0c4bc69e338537f6428fa |

### Verification
- `pnpm progress:check` (pinned toolchain, `flock -s /tmp/wejammin-quiet.lock`): exit 0. `git diff --check` on the six files: exit 0.
- Parity (python): AC060 and AC248 body text equal in plan and tracker, and the plan text occurs verbatim in the matrix. Criterion counts: plan 285, tracker 285, checked 0.
- `compile.mjs` NOT run; no graph refresh. Static text only; no AC check-off.

### Open items / Requests to root
1. Record the new acceptance-section hash above in the Dispatch Log.
2. Graph refresh remains root's step (graph-only command, never `compile.mjs` here).
3. Not in this pass: IA03 272 and any remaining "over-budget refusal against the actual producer" wording outside FE03 1050/BE03c 1487 (IA03 272 still says the 1 MiB sufficiency is proven by "an over-budget refusal"; review-placement B3 cites only FE03 1050 and BE03c 1487). Authorize if wanted.
4. Root ruling recorded in the Dispatch Log (retire advances review `version` by one) is not yet reflected in BE03c 215 / CMS-03C-10 text; no spec text written for it in this pass.
