# Wording batch applied

Applied 2026-10-11 on the Slice 11 worktree (S3-048 added in a follow-up the same day at the orchestrator's request, since "approve all" includes it). Source: `docs/handoffs/2026-10-10-claude-s11/wording-batch-draft.md`.
Ratification: owner ruling in chat 2026-10-11, "approve all" for the 37-item checklist (including the orchestrator note that 502 items name `DEPENDENCY_UNAVAILABLE` per BE00:172/590), and DEC-147 = option C (keep the Slice 10 criteria wording and prove it with the Slice 11 runtime; reword only the genuinely defective texts: P2-S10-AC-030, 045, 047, 089 and the defective part of 080).

Nothing was committed. No test, production or migration file was touched. Spec and tracker text was applied by script from the draft's CURRENT/PROPOSED blocks, each CURRENT asserted equal to the file before replacement.

## Deviations from the draft, read these first

1. **Matrix cells say `DEPENDENCY_UNAVAILABLE`, not `BAD_GATEWAY` (S2-05, S2-06).** The draft's matrix replacement text ends `(BAD_GATEWAY)`. The orchestrator note the owner approved says 502 items name `DEPENDENCY_UNAVAILABLE`, and neither BE00 nor BE03b defines `BAD_GATEWAY` (zero occurrences in both). The cells now read `read dependency/deadline, response-contract breach (`DEPENDENCY_UNAVAILABLE`)`. If the owner wanted the literal draft text, it is a five-cell edit at BE03b lines 1914, 1915, 1917, 1918, 1919.
2. **IA03:43 has no exact replacement in the draft** (the draft's N-2 lists it as out of scope; the orchestrator note says it is included). I derived the edit from the S1-02 text: "is not the author of the revision" became "is not the author of the revision when the action is `publish`". Nothing else in IA03 changed.
3. **The shipped Worker code is `BAD_GATEWAY`**, so the draft's statements that the breach suites can be cited under the response clause (R-502 "Shared effect", N-1) do not hold yet. The clauses that name `502 DEPENDENCY_UNAVAILABLE` stay uncited until the conformance fix (Worker codes, web error mapping, breach tests) lands. See the ledger table.

## Files changed

| File | Change |
| --- | --- |
| `.memory/wiki/specs/phases/phase-2.md` | 17 criterion lines (11 Slice 11, 6 Slice 10): claim replaced, checkbox and source links kept |
| `.memory/pipeline/progress/slices/phase-02-slice-11.md` | 11 criterion lines |
| `.memory/pipeline/progress/slices/phase-02-slice-10.md` | 6 criterion lines |
| `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` | S2-01 to S2-14 (16 lines edited, 1 changelog row added) |
| `.memory/wiki/specs/ia/03-cms-content-modeling.md` | AC-CMS-09 (line 43) and one changelog row |
| `tests/contracts/phase-02-slice-11-evidence-ledger-035-066.ts` | AC-035, 038, 041, 050, 053, 056, 059 |
| `tests/contracts/phase-02-slice-11-evidence-ledger-067-100.ts` | AC-070, 090, 097 |
| `tests/contracts/phase-02-slice-11-evidence-ledger-101-122.ts` | AC-122 |
| `tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts` | AC-030 |
| `tests/contracts/phase-02-slice-10-evidence-ledger-036-070.ts` | AC-045, 047, 048 |
| `tests/contracts/phase-02-slice-10-evidence-ledger-071-105.ts` | AC-080, 089 |

Ledger `text` equals the tracker claim byte for byte for all 17 (checked by script). Every changed entry was re-tiled (verbatim, ordered, non-overlapping clauses; gaps only separators and and/or). Existing citations stayed on the clauses they prove; newly cited tests are named in the table.

## Item by item

### Section 1: Slice 11 criteria

| Item | Criterion | Trackers and plan | Ledger | Final ledger status |
| --- | --- | --- | --- | --- |
| S1-01 | P2-S11-AC-035 | text replaced | MFA clause split from the specialist clause; "from the submitter" rides the existing 403 `separation_of_duties` citation | verified |
| S1-02 | P2-S11-AC-038 | text replaced | new clause "is not the author of the revision when the action is `publish`" cites the schedule refusal (author cannot schedule a publish) and the schedule test (author may schedule an expire) | verified |
| S1-03 | P2-S11-AC-041 | text replaced | truncated "sta" clause gone; new clauses "recent binding-bound MFA" (CMS-03B-09 step-up tests) and "a publisher who is not the revision's author" (publish refusal); the preflight clause keeps its 5 citations | verified (was partial) |
| S1-04 | P2-S11-AC-050 | text replaced | response clause re-worded, uncited | partial |
| S1-05 | P2-S11-AC-053 | text replaced | "a response-bound failure (502 `DEPENDENCY_UNAVAILABLE`)" uncited | partial |
| S1-06 | P2-S11-AC-056 | text replaced | response clause re-worded, uncited | partial |
| S1-07 | P2-S11-AC-059 | text replaced | "a response-bound failure" keeps its 3 citations; "(502 `DEPENDENCY_UNAVAILABLE`)" is its own uncited clause | partial (was verified) |
| S1-08 | P2-S11-AC-070 | text replaced | revoke exception cited by the uncounted-revoke controls; counted-revoke invalidation clause cites the DEC-161 tests (invalidated at version + 1, two events, two audit records) | verified |
| S1-09 | P2-S11-AC-090 | text replaced | executor clause cites the execute refusal and the four executor gate tests; "all three invalidate" keeps the 10 existing citations | verified (was partial) |
| S1-10 | P2-S11-AC-097 | text replaced | new committed-refusal exception clause cites the publish and schedule lapse tests, the reservation-completed tests and the two cancellation tests | verified |
| S1-11 | P2-S11-AC-122 | text replaced | UNIQUE clause keeps its 4 citations (the schema assertion already checks the seven-column constraint) and adds the nanosecond-apart apispec | verified |

The four partial entries (050, 053, 056, 059) carry this limitation: the 502 status is proven by the existing breach tests, but the Worker emits `BAD_GATEWAY`, not the ratified `DEPENDENCY_UNAVAILABLE`; the conformance fix is queued and the clause is cited once it lands and the breach tests assert the ratified code. AC-053 also keeps its earlier note that the 500 and 502/504 envelope proof is the shared per-row tests.

### Section 2: spec edits

| Item | Where | Done |
| --- | --- | --- |
| S2-01 | BE03b:284 CMS-03B-12 row | 422 became 502 `DEPENDENCY_UNAVAILABLE` response-contract failure |
| S2-02 | BE03b:289 CMS-03B-15 row | same |
| S2-03 | BE03b:291 CMS-03B-16 row | same |
| S2-04 | BE03b:299 all-responses row | same |
| S2-05 | BE03b:1918, 1919 matrix | 422 cell "not applicable to bounded read"; 502 cell gains the response-contract breach (see deviation 1) |
| S2-06 | BE03b:1914, 1915, 1917 matrix | same |
| S2-07 | BE03b:193 If-Match operands | DEC-161 exception added |
| S2-08 | BE03b:1858 Assignment paragraph | counted-revoke invalidation, other revokes change nothing |
| S2-09 | BE03b:2093 state machine | DEC-161 exception added |
| S2-10 | BE03b:2184 verification list | "unwinding" wording replaced |
| S2-11 | BE03b:1783 frozen manifest paragraph | executor moved to typed `blocked`/`approval_invalidated` |
| S2-12 | BE03b:1817 preflight aggregation | DEC-169 committed-refusal exception |
| S2-13 | BE03b:159 CMS-03B-07 row | identity includes the sub-microsecond remainder |
| S2-14 | BE03b changelog | new last row (line 2269) citing the 2026-10-11 ratification |
| IA03 | IA03:43 AC-CMS-09, plus one changelog row (line 576) | author bar only for action `publish` |

### Section 3: Slice 10 set (DEC-147 option C)

| Item | Criterion | Trackers and plan | Ledger | Final ledger status |
| --- | --- | --- | --- | --- |
| S3-030 | P2-S10-AC-030 | text replaced | `/fields/{stableFieldId}` clause cites the field-pointer accept test, three field-shape refusals and the relation pointer test; `/blocks/...` clause cites the five other-pointer refusals and the apispec `/blocks` 422 | verified (was partial) |
| S3-038 | P2-S10-AC-038 | unchanged | unchanged | partial (Slice 11 citations are separate work) |
| S3-040 | P2-S10-AC-040 | unchanged | unchanged | partial |
| S3-042 | P2-S10-AC-042 | unchanged | unchanged | partial |
| S3-044 | P2-S10-AC-044 | unchanged | unchanged | partial |
| S3-045 | P2-S10-AC-045 | final sentence replaced | last clause cites the same four scope tests AC-044's identical sentence cites | contract-only (was partial) |
| S3-046 | P2-S10-AC-046 | unchanged | unchanged | partial |
| S3-047 | P2-S10-AC-047 | audience bound replaced | audience clause cites the two Slice 10 grammar tests and the Slice 11 mint refusal ("matched as submitted") | contract-only (was partial) |
| S3-048 | P2-S10-AC-048 | final sentence "contract-only unpublish/expire/archive rule" became "contract-only publication rule" | text and last clause re-worded, all 7 clauses and their citations (2, 3, 3, 0, 1, 0, 5) kept | partial (unchanged; the "equal to approved candidate" and "409" clauses are still uncited, pending Slice 11 citations) |
| S3-079 | P2-S10-AC-079 | unchanged | unchanged | partial |
| S3-080 | P2-S10-AC-080 | text replaced | publication clause and "Preview evaluates no field value" uncited; "it binds the same frozen bytes (P2-S10-AC-079)" cites two Slice 11 version-set tests | partial |
| S3-089 | P2-S10-AC-089 | text replaced | UUID, query/body and "before any existence or dependency work" cited; the 502 `DEPENDENCY_UNAVAILABLE` preimage clause uncited | partial |

Reasons the two S10 partials stay partial: AC-080's publication clause needs one new pgTAP case (a stored DEC-133 object value that violates the structure fails the publish-phase `contract` category, in step with the TypeScript verdict), and "Preview evaluates no field value" is a negative no test asserts. AC-089 needs the conformance fix.

The six "provable now" Slice 10 criteria (038, 040, 042, 044, 046, 079) were left alone as instructed, so they are still partial in the Slice 10 ledger until their Slice 11 citations are added. P2-S10-AC-048 gets its label fix only; its provable-now citations are the same separate work.

## Checks run

- `node scripts/check-progress-consistency.mjs`: exit 0 ("Progress files consistent."), re-run after the S3-048 follow-up.
- `vitest run` of both evidence guards: 7 of 10 tests pass (after the S3-048 follow-up the Slice 10 guard alone was re-run: 4 of 5 pass, 0 structural problems); the 3 failures are all receipt-class. Slice 10: stale receipt hashes (files changed since the run) and "no receipt" for the new citations. Slice 11: `tests/contracts/phase-02-slice-11-receipts.generated.jsonl` does not exist yet. No structural problem was reported by either guard (no text mismatch, tiling, status, limitation or citation-shape finding).
- `prettier --check` on all seven ledger fragments clean before and after (the six edited were formatted with `--write`).

## Still to do (not done here)

1. Regenerate both receipt files: `node scripts/evidence/run-slice-evidence.mjs --slice 10` and `--slice 11`. Newly cited identities are listed as "no receipt" until then.
2. The `BAD_GATEWAY` to `DEPENDENCY_UNAVAILABLE` conformance fix, then cite the four Slice 11 response clauses and the AC-089 clause and set those entries verified.
3. Regenerate the semantic index under `.memory/schema/` (BE03b, IA03 and the plan changed) and flush the missing decision records (DEC-147, DEC-170, DEC-171 and a batch record; the draft's N-3).
4. The pgTAP `comment on function` for `cms_assign_editorial_reviewer` still says the review version never advances (draft S1-08 housekeeping); fix with the next migration touching it.
5. Not touched, same class: P2-S12-AC-025 still says "audience 1–64 safe chars" (BE03c validation table), and AC-083 / BE03b:1888 (`entry_unavailable`, draft N-5).
