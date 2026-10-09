# Lane S11-0 report: Slice 11 specification and plan cascade (no code, no DB)

Status: DONE. Nothing staged, committed, stashed or reset. LANE = /home/rob/.codex/worktrees/phase2-slice11/WeJammin (claude/phase2-slice11).
Pre-existing dirty file, not mine and untouched: docs/handoffs/2026-10-07-phase2-s10-live-handoff.md.
During the lane an outside process appended `pat-023` to this worktree's .memory/raw/events/2026-10-08.jsonl (source "slice-10 CI"); I left it and it is in the compiled output.

## 1. Gates (all run with the pinned toolchain)

| Gate | Result |
|---|---|
| `node scripts/check-progress-consistency.mjs` / `pnpm progress:check` | exit 0 |
| `pnpm format:check` | clean (exit 0) |
| `pnpm exec vitest run tests/contracts` | 170/170 files, 1532 passed, 1 skipped (the pre-existing S09 AC-269 gate skip) |
| `tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts` (reads the plan, runs the progress checker) | 9/9 |
| `node .memory/pipeline/compile.mjs` | ok (final run after the last edit) |

## 2. Verification of the Codex digest (each claim I relied on, checked against the cited lines)

| Claim | Verdict |
|---|---|
| Slice 11 = 48 criteria, DEC-148 names 15..20 on AC035/038/041 | Verified (phase-2.md Slice 11 section; AC035 names 15-18, AC038 names 20, AC041 names 19). |
| FE03:320-363 enumerates 05-09 but not 15-18; FE03 needs new rows | FALSE for the current file (byte-identical to the slice10 copy). FE03 already carries 15-18 everywhere: resource unions 361-364 and 377-392, operation union 521-555, components 592-598 (CmsEditorialWorkflowPanel, PreflightSummary, ReviewQueue, ReviewDetail, AssignmentForm), page rows 1095-1096 and 1495-1498, states 1017-1031 and 1547-1550, operation metadata 1676-1679, contract fields 1803-1806 and 1851-1854, error mapping 2578 and 2619-2625, tests 2760, changelog 2818. Every row compared with BE03b: consistent. (320-363 is the grant console and the workbench props.) |
| FE03:536 describes CMS-15 runtime as deferred | NOT FOUND. FE03:536 is `browserPolicy: 'protected-read-only'` of CMS-03B-16. FE03:863 says DEC-114 un-defers CMS-03C-04/05, FE03:1289 calls the locale variant form "a Phase 2 runtime form, DEC-114", FE03:2661 carries DEC-121/DEC-138. BE03c:1315-1317 and :1415 already carry the shared resolver and `cms.locale.no_fallback_gate`. |
| E11 vs IA "where the workflow says review" | Not a conflict: BE03b:195 and :2023 say every registry workflow member requires a `cms.reviewer` decision, so the IA condition is always true in Phase 2. |
| Plan 2991-2993 gives step-up recovery for CMS-03B-06/07/09/18 | PARTLY FALSE: AC046-AC048 cover 06, 07, 09 only. CMS-03B-18 step-up recovery is required by FE03:1177 and FE03:598 and had no criterion; it is carried by AC072. |
| Accessibility vocabulary conflict | Verified and sharper than the digest (see DEC-150). |
| DEC-147 is a recorded decision | NO. DEC-147 is the pending owner forward-scope ruling for Slice 10 (handoff 2026-10-07 lines 51, 65, 81, 121, 127). Last recorded id was dec-148. |

## 3. Decisions recorded (raw records via flushEntry, agent claude, "owner may override"; compiled into wiki/decisions.md)

- DEC-149: cascade is ADDITIVE (Slice 10 DEC-133 precedent): six obligations x CMS-03B-15..20 = 36 criteria AC049-AC084. Rejected: nesting under AC035/038/041 (count would stay 48).
- DEC-150: accessibility evidence outcome adopts the BE05c run-state vocabulary `healthy|blocked|failed`. BE03b amended (below). Mapping stated in the spec, derived from two quoted clauses: healthy -> passed; blocked -> failed (`blocking_finding`); failed (timeout, dependency failure, unreadable target) -> unavailable (`checker_failed`), because BE03b defines `unavailable` as "a provider dependency failed or timed out" and BE05c calls a failed run an "unresolved preflight". The owner may override the mapping specifically.
- DEC-151: (c) FE03 explicit 15-18 rows: rule recorded; verified already satisfied; no FE03 text change, so no FE03 changelog row (the 2026-10-07 FE03 changelog row already records it).
- DEC-152: (d) FE03 locale runtime follows DEC-114/DEC-138: rule recorded; no deferral text exists in FE03, so nothing to amend.
- (e) tzdb: NO decision recorded, by instruction. Owner question in section 7.

## 4. Spec text edits

- BE03b `PreflightEvidence`: new `AccessibilityRunOutcome = ['healthy','blocked','failed']`, `outcome` uses it, plus the BE05c invariants as refinements (`healthy` => blockingCount 0, `blocked` => > 0, from the quality_check_runs CHECKs, BE05c:1110). `Accessibility provider` clause: `outcome` is `healthy` to yield `passed`; other outcomes are still verified and evaluated as failed/unavailable. New paragraph `Accessibility outcome mapping (DEC-150)`. Changelog row 2026-10-08. BE05c needed no edit (it is the canonical side). No code defines `PreflightEvidence` yet (grep), so nothing drifts.
- FE03, BE03c: no edits needed (section 2).
- Existing criterion text AC001-AC048: unchanged.

## 5. Criteria added (36, all open, plan and tracker identical after link normalization)

Six per operation: contract/shape, validation, authority/privacy, runtime bounds, safe failure, consumer/verification. Every cell had spec text; none omitted (justifications for the two narrow cells in the ledger).

| Operation | IDs | Notes |
|---|---|---|
| CMS-03B-15 workflow read | AC049-AC054 | consumer cites FE03 CmsEditorialWorkflowPanel / PreflightSummary |
| CMS-03B-16 review detail | AC055-AC060 | validation row uses the enforced `checkEditorialReview` invariants |
| CMS-03B-17 reviewer queue | AC061-AC066 | DEC-140 cursor fault classes in safe failure |
| CMS-03B-18 reviewer assignment | AC067-AC072 | AC072 carries the step-up recovery no other criterion carried |
| CMS-03B-19 internal verifier | AC073-AC078 | "consumer" = Shard 04 seam + absence from browser inventory (no UI exists by spec) |
| CMS-03B-20 internal claim/execute | AC079-AC084 | "consumer" = Worker handler, event, CMS-03B-15 schedule summary |

Citations are exact heading names plus a Lines column (every line anchor asserted by script against the current files). Ledger: `.memory/pipeline/progress/verification/2026-10-08-slice-11-depth-floor.md`. Plan: phase-2.md after AC-048. Tracker: phase-02-slice-11.md after AC-048.

## 6. Totals before / after

| Stated total | Before | After |
|---|---|---|
| Slice 11 criteria / floor / authored | 48 / 48 / 48 | 84 / 84 / 84 (0 checked) |
| Phase 2 authored / active | 3008 / 3004 | 3044 / 3040 |
| Active-checked (index, phase-02.md, spec-pipeline.md) | 2,448 (stale: pre-Slice-10-closure) | 2,539 (tracker ground truth, S10 = 91 checked). This is a correction beyond the brief; revert those three numbers if you want them left alone. |
| Slice inventory line, total line, coverage table row, S11 `BE endpoints` line | 48; 3008; 05-09 | 84; 3044; 05-09 and 15-20 |
| phase-02.md Slice 11 row | 0/48 | 0/84 |
| Hard-coded copies of the denominator | 3,004 / 3,008 in script constants and S09 policy test | 3,040 / 3,044 |

Files: phase-2.md, phase-02-slice-11.md, phase-02-slice-09.md (denominator line), index.md, phases/phase-02.md, spec-pipeline.md, scripts/check-progress-consistency.mjs (constants), the two S09 tests below, the ledger, 03b, raw events and compile outputs.

Side effects you need to know about (the totals are pinned in S09 guards):
1. `tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts`: denominator regex 3,?004 -> 3,?040 and its title.
2. `tests/contracts/phase-02-slice-09-pre-traceability.test.ts`: it pins the Slice 11 plan total at 48; changed to 84. It will merge-conflict textually with the S12 lane only if that lane edits the same hunk (S12 is a different entry in the same array).
3. S09 receipts bind to the test file hash, so both edits made 42 receipt rows stale. I re-collected exactly those rows from a fresh vitest JSON run of exactly those two files (the repo's own `parseVitestJson`/`buildReceipts`/`serialiseReceipts`), 42 rows replaced in place, all `passed`, nothing else in the receipts file touched. A full `pnpm evidence:collect` at slice closure remains the normal refresh.
4. A sentence added in the middle of the completion-policy paragraph broke the S09 AC-209 window test (it reads 600 chars before and 2000 after "AC209"). The DEC-148/149 sentence is therefore its own paragraph after the DEC-105 paragraph. Keep new policy text out of that paragraph.
5. The S12 lane will touch the same totals lines (3,040 / 3,044 become S12-adjusted). Recompute with: authored = sum of plan rows, active = authored - 4.

## 7. Owner questions (Q-TZ-1/Q-TZ-2 RESOLVED by orchestrator ruling DEC-153; wording defects routed by DEC-155; see Follow-up)

### Q-TZ-1 (decision (e)): which IANA tz release does Slice 11 pin as `CMS_TZDB_VERSION`, and who names it?

Why it is not mine to decide: BE03b E8 (lines 1809-1822, the "Time authority" section) already locks the mechanism: a content-addressed snapshot generated by a pinned script from one IANA release tarball; release tag exported as `CMS_TZDB_VERSION` (`^[A-Za-z0-9._-]{1,32}$`, "such as 2025b"), SHA-256 as `CMS_TZDB_SHA256`; Worker verifies the hash at module load and answers every schedule command 503 on mismatch; `cms_tzdb_version()` returns the same constant (CI parity); advancing the pin is code plus a forward migration; stored schedules keep their version and instant. The release TAG is contract-visible: every `PublicationScheduleRequest.tzdbVersion` must equal it (422 `tzdb_version_mismatch` with `details.pinnedVersion`, BE03b:543-544, 631, 949, 1812), it is stored per schedule and returned in `PublicationScheduleResource`, and FE03:599 ships the same snapshot to the browser. The spec names no release and DST fixtures for CMS-03B-07 depend on it.

| Option | Pros | Cons |
|---|---|---|
| A. Owner names the exact tag now | Deterministic fixtures from the first RED test; owner controls a public contract value | Schedule RED tests wait on the owner; owner must know current tags |
| B. Lane proposes the newest stable IANA release on the day the contract lane starts, with tag + SHA-256 + generation output in a DEC; owner ratifies in one reply before schedule RED tests | No long wait, recent rules, owner still gates the contract value, verified value rather than recalled one | One owner touch; the tag depends on the start date |
| C. Lane pins the newest stable release as an implementation constant, DEC "owner may override", no gate | Zero wait | The contract-visible value is fixed before the owner sees it; overriding later means a forward migration |

Recommendation: B. The value becomes a stored, public contract member and fixture basis, yet the lane can supply a verified tag and hash, so the owner's cost is one ratification.
(Rejected outright: tying the pin to the host ICU/system tzdata; E8 says that is host-dependent.)

### Q-TZ-2 (ask after Q-TZ-1): should each schedule also record the snapshot SHA-256?

The orchestrator resolution said "recorded per schedule" for identifier plus hash. The spec records only the tag (`cms_publication_schedules.tzdb_version`, BE03b:1957 area); the hash is verified at load and is never stored or contract-visible.

| Option | Pros | Cons |
|---|---|---|
| A. Tag only, as specified | No schema change; an IANA tag identifies its content | No byte-level provenance per schedule |
| B. Add `tzdb_sha256 char(64)` to the schedule table (forward migration), not in the resource | Audit can prove which bytes resolved an instant if a tag were ever re-published or the asset drifted | Changes a locked table and the accept RPC for no current consumer |

Recommendation: A.

### Wording defects in AC035 / AC038 / AC041 (unapplied; they join the owner's DEC-147 wording batch per DEC-155)

All three break the sentence (`.,` or truncation) and lag IA03 AC-CMS-08/09/13 (IA03:40, :41, :45), which carry E6 (MFA unconditional) and E11 (author never publishes or reviews their own revision).

- AC035 now: "...each decision requires a reviewer distinct from the author where the workflow says review, and a protected risk class additionally requires two distinct humans, the named specialist capability and recent MFA., implement locked behavior..."
  Proposed: "...each decision requires a reviewer distinct from the author and from the submitter where the workflow says review, every decision requires recent binding MFA, and a protected risk class additionally requires two distinct humans and the named specialist capability, implement locked behavior..."
- AC038 now: "...given Actor holds the CMS publisher capability with any required step-up, the target revision is approved ... and tzdb version., implement locked behavior..."
  Proposed: "...given Actor holds the CMS publisher capability with recent binding-bound MFA, is not the author of the revision, the target revision is approved with its frozen hash and dependency set intact, and the request supplies a local datetime, IANA timezone, unambiguous resolved UTC instant and tzdb version, implement locked behavior..."
- AC041 now: "...and a preflight rerun against current revocation sta, implement locked behavior..." (truncated)
  Proposed: "...an approved revision whose frozen hash and dependency set still match, recent binding-bound MFA, a publisher who is not the revision's author, and a preflight rerun across the registry of preflight categories against current revocation state, implement locked behavior..."

## 8. Findings for the orchestrator (item 1 was acted on in the Follow-up; the rest as stated)

1. Unowned Slice 11 cascade obligations. No S11 criterion names the following spec content (S16 owns only the quality_check action, run persistence and reads, per its AC005-AC022). Candidate additive criteria, each with distinct testable spec text; I did NOT add them because the brief fixed the scope at the six operations and adding changes the 84/3044/3040 totals other lanes may rely on. If you want them: about 12-16 criteria.
   - `cms.a11y.structural` v1 checker module, registry row and `quality_gate_evaluate` gate call (DEC-134): BE03b:1799-1801, 1291-1315; BE05c:1030-1079.
   - 17-category preflight registry, D19 reference gate and `provider_unbuilt_reference`, phases and aggregation, CI parity with `PreflightCategory`: BE03b:1767-1798.
   - Time authority E8 module (resolution steps 1-8, horizon, RPC sanity bound, pinned asset check), shared by Worker and FE: BE03b:1809-1822.
   - Frozen dependency manifest and version set, currency rules, settings snapshot ordinal: BE03b:1747-1766, 1803-1808.
   - Review invalidation (four reasons, same-transaction schedule cancel and token revoke) and the 500-review recheck job: BE03b:1842-1854.
   - Publication lineage E3 (append-only, tombstones, `publication_hash`, `projectionState`): BE03b:1855-1858.
   - Preview token derivation (HMAC, never stored, 900 s, replay): BE03b:1859-1862.
   - Derived revision workflow state E2: BE03b:1732-1746.
   - Slice 11 tables (assignment, review dependency, settings snapshot, preflight registry) persistence rows: BE03b:1971-1985.
2. Spec nits found, not edited: (a) CMS-03B-15 row says Tier 2 p95 < 1,200 ms "includes the 2,000 ms accessibility checker budget"; a 2 s budget inside a 1.2 s percentile target needs the p95 reading stated. (b) `cms_execute_publication_schedule(schedule_id, expected_version, ...)`: `expected_version` is the approved-review version in the schedule table, while `ClaimedSchedule` also carries `scheduleVersion` as "the CAS operand"; the signature does not say which the RPC takes (BE03b:179, 1867, 1484-1512).
3. Plan "BE endpoints" lines: I updated Slice 11 only. Slice 10's line (omits CMS-03B-12/13/14) and Slice 12's (omits 03C-04 onward) are still stale under the same precedent.
4. Memory capture not done by me, to avoid id collisions with the S12 lane. Proposed PAT (anti-pattern, 0.5): "A stated Phase 2 total is pinned in four places (progress script constants, S09 completion-policy test, S09 pre-traceability per-slice totals, sha-bound S09 receipts) and in-paragraph policy text can break the AC-209 window test; edit the pins together and re-collect only the receipts of the edited test files." No BLOCKER logged for Q-TZ-1; log one if you want it tracked.
5. Native-memory sync (decisions DEC-149..152, the vocabulary rule) left to you.

## Follow-up (orchestrator rulings applied)

Status: DONE. Still nothing staged or committed.

### Decisions recorded (raw records, compiled)

- DEC-153: tz pin rule. The Slice 11 contract lane pins the newest stable IANA release available when it starts and appends the concrete tag, SHA-256 of the generated snapshot and generation command to DEC-153 (the concrete pin is explicitly marked "not yet recorded"). Owner may override by forward migration. Q-TZ-2: tag only, no schedule hash column (follows the spec).
- DEC-154: DEC-149's additive rule extends to every unowned Slice 11 cascade obligation: 38 criteria AC085-AC122. The count change is also in the ledger (Count change table).
- DEC-155: AC035/AC038/AC041 wording defects stay unapplied and join the DEC-147 wording batch. Proposed corrected text is in section 7 above, unchanged.

### Criteria added: AC085-AC122 (38, one obligation each, open, plan and tracker identical)

| Area | IDs | Count | Primary citation |
|---|---|---|---|
| Derived revision state (E2) | AC085-AC086 | 2 | BE03b Derived revision workflow state |
| Frozen dependency manifest (E1) | AC087-AC090 | 4 | BE03b Frozen dependency manifest build and version set |
| Settings snapshot (E7) | AC091-AC092 | 2 | BE03b Settings snapshot authority |
| Preflight registry (D19) | AC093-AC097 | 5 | BE03b Publication preflight registry |
| Accessibility checker (D25) | AC098-AC102 | 5 | BE05c Accessibility and content-quality checker; BE03b registry and DEC-150 mapping |
| Time authority (E8) | AC103-AC106 | 4 | BE03b Time authority; FE03 schedule form and Testing Obligations (AC106); DEC-153 in AC103 |
| Publisher authority / separation of duties (E11) | AC107 | 1 | BE03b Registry invariants, validation matrix |
| Reviewer decision (CMS-03B-06) | AC108-AC110 | 3 | BE03b Review scopes ... decision evaluation |
| Review invalidation | AC111-AC113 | 3 | BE03b Review invalidation |
| Publication lineage (E3) | AC114-AC116 | 3 | BE03b Publication lineage |
| Preview token (CMS-03B-08) | AC117-AC118 | 2 | BE03b Preview token and verification |
| Persistence (reviews, decisions, assignments, schedules) | AC119-AC122 | 4 | BE03b Canonical records, Support records |

Every line anchor (BE03b, BE05c, BE04c, FE03) is asserted by script against the current files and listed in the ledger Lines column. Compared with my earlier estimate (12-16) the count is 38 because I split table-driven areas only where the spec states separately testable behavior (for example manifest builder vs group content vs projection vs currency). Added beyond the original list: the three reviewer-decision rows, the separation-of-duties row, the shared Time authority module row and four persistence rows, because they also had no owner. Deliberately not added (ledger "Omitted classes" section): audience grammar and If-Match operands, lock order, CMS-03B-08 version-set recompute (owned by generic rows or earlier slices).

### Totals (all updated and consistent)

| Stated total | Before follow-up | Now |
|---|---|---|
| Slice 11 criteria / floor / authored | 84 | 122 (48 + 36 + 38), 0 checked |
| Phase 2 authored / active | 3044 / 3040 | 3082 / 3078 |
| phase-02.md Slice 11 row | 0/84 | 0/122 |
| Constants in scripts/check-progress-consistency.mjs, S09 completion-policy test, S09 pre-traceability Slice 11 pin | 3,040 / 3,044 / 84 | 3,078 / 3,082 / 122 |

Regenerated, not hand-patched: the 36+38 rows are produced by one script into plan, tracker and ledger, so the three cannot drift. The two S09 test files changed again, so the 42 receipt rows for exactly those two files were re-collected from a fresh vitest JSON run (42 replaced in place, all `passed`; a first attempt that hit a regex slip in my own test edit was refused by the splice step because a row was `failed`, fixed, rerun).

### Gates after the follow-up

- `pnpm progress:check`: exit 0. `pnpm format:check`: clean. `pnpm exec vitest run tests/contracts`: 170/170 files, 1532 passed, 1 skipped. Slice 10 closeout integration test: 9/9. `node .memory/pipeline/compile.mjs`: ok.

### New findings

1. FE03 is internally inconsistent about CMS-03B-18 step-up: FE03:598 and :1179 say the person id is discarded on a step-up navigation (the grant-console exception), while FE03:2673 says the step-up round trip "restores the draft and reuses the Idempotency-Key for CMS-03B-06, 07, 09 and 18". AC072 was reworded (my own row) to the claim that holds under both readings: no automatic replay, the person id is never persisted, explicit re-confirmation with the review `version` refetched. The owner or a spec pass should settle whether 18 restores the draft.
2. The ledger "Count change" table is the single place the three steps (48 -> 84 -> 122) are recorded; the DEC-149 raw record still states 84 (history), DEC-154 states the final.
3. Section 8 item 4 still applies: I did not log a PAT/BLOCKER. Section 8 item 3 (BE endpoints rows for S10/S12) still applies; the S11 row now lists 05-09 and 15-20.
