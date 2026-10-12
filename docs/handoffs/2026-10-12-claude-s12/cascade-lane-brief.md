# Slice 12 cascade lane brief (2026-10-12)

You apply the Slice 12 specification cascade: docs, specifications, plan, tracker and the pinned totals. No
production code, migration or test behaviour. The orchestrator records the decisions, reviews, commits and runs
gates.

## Where you work

- Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12` (stacked on
  `claude/phase2-slice11` at `5b7eee20`). Every shell command MUST begin with
  `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&` (your shell resets between calls). First command:
  `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && git rev-parse --show-toplevel && git rev-parse HEAD`.
- NEVER touch `/home/rob/Projects/WeJammin` (primary checkout) or `/home/rob/.codex/worktrees/phase2-slice11/`
  (a canonical gate is running there).
- Never `git add/commit/stash/checkout/reset/restore`. This worktree has no `node_modules`: do not run pnpm,
  vitest, tsc, eslint, prettier, playwright, docker, psql or supabase. Plain `node` scripts that read files (for
  example to resolve line anchors or count rows) are fine. The host must stay quiet: no heavy commands at all.
- Do not write memory records (`.memory/raw/*`) and do not run `.memory/pipeline/compile.mjs`; the orchestrator
  does both. Never edit `.memory/wiki/decisions.md`, `patterns.md` or `blockers.md` (derived files).

## Read first

1. `CLAUDE.md`, `.claude/rules/specificity-standards.md`, `.claude/rules/decision-classification.md`,
   `.claude/rules/source-before-ask.md`.
2. The setup report `docs/handoffs/2026-10-10-claude-s11/s12-setup-report.md` (all of it) and its ledger
   `.memory/pipeline/progress/verification/2026-10-11-slice-12-depth-floor.md` (appendix A holds the drafted
   criterion lines AC054-AC285 in plan form).
3. Specs: `.memory/wiki/specs/be/03c-*.md` (BE03c), `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`
   (BE03b), `.memory/wiki/specs/ia/03-cms-content-modeling.md` (IA03), `.memory/wiki/specs/fe/03-cms-content-modeling.md`
   (FE03), BE00 and BE05c in the same folders. Binding rulings: `.memory/wiki/decisions.md` (DEC-121..123, 135..141,
   148, 149, 154, 156..177). The plan: `.memory/wiki/specs/phases/phase-2.md`. Tracker:
   `.memory/pipeline/progress/slices/phase-02-slice-12.md`.
4. The Slice 11 worked example of the same cascade: DEC-148/DEC-149/DEC-154 paragraphs in the phase plan and
   `.memory/pipeline/progress/verification/2026-10-08-slice-11-depth-floor.md`.

## Decisions you apply (already made; cite them by id in the text you write)

- **DEC-175** (owner, 2026-10-12): a pattern placement stores one composition row per root node of the pattern's
  forest, each pinned to `(patternId, patternVersion)` and carrying that root node's block identity with its node key
  as the path suffix; children stay inside the pinned tree; CMS-03C-02 returns an items list (1-32 rows, the
  `CompositionUpdateResource` precedent of CMS-03C-15); `overrides` keys are normalized node paths under the
  inserted root.
- **DEC-176** (owner, 2026-10-12): patterns apply to entry revisions only; reword IA03:46, IA03:67, BE03c:90 and the
  criterion text of P2-S12-AC-026 and P2-S12-AC-043 (drop "template draft").
- **DEC-178** (orchestrator, cascade): apply DEC-148 to Slice 12 exactly as the setup report section 1 and 8
  propose: floor 53 -> 285, new ids AC054-AC285 contiguous after AC053, Phase 2 authored 3082 -> 3314, active
  3078 -> 3310. Every judgement-call row the report lists (five supporting reads, CMS-03C-04/-05 rows, six IA-level
  rows, six FE page rows) is KEPT ("more work now" is the owner's standing rule).
- **DEC-179** (orchestrator, mechanical): reconciliations R1-R4 of the setup report section 5, verbatim propagation
  of DEC-172, DEC-158 and DEC-159 and of the 2026-10-07 cascade into BE03c and FE03.
- **DEC-180** (orchestrator, owner may override): the implementation decisions G2, G3, G4, G6, G8, G9 and G11 take the
  setup report's recommendation (section 6), and R5 takes one reading per item: (i) and (ii) follow the BE00/BE03b
  status rule (a referenced version that exists but is not active is a 409 state conflict when the caller named it as
  an expectation, a 422 when it is an input that fails validation; read the surrounding BE03c rows and pick the one the
  matrix and BE03b precedent support, then edit the other line and state the evidence in your report); (iii) the
  catalog code wins: every governed 409 is `GOVERNED_REVIEW_VERSION_CONFLICT` with the reason token in
  `details.reasonCode`, and :1279 is reworded to that; (iv) the field validation matrix wins: the digest is an
  equality expectation (:363, :368) and :1552 says the server recomputes and refuses a mismatched expectation.
- **G5 is NOT applied.** Rewording BE03b:251/:1538 changes the Slice 10 AC030 criterion text, which is an owner
  wording item. Put it in the wording-batch draft (below) with the exact old and new text; change no BE03b line.

## Deliverables

1. **Plan** (`phase-2.md`, Slice 12 section): the header lines of report section 8 (IA flows incl. CMS-15/CMS-16,
   BE endpoints CMS-03C-01..21 plus the five reads, feature ledger incl. 25.05.03/25.05.04, floor 285, breakdown,
   authored 285, cascade paragraph citing DEC-178 placed after the DEC-148/DEC-149/DEC-154 paragraph and never inside
   the AC209 paragraph), the 232 new criterion lines from appendix A adjusted to DEC-175 wherever a row describes a
   pattern placement, the AC026/AC043 rewording (DEC-176), the coverage tables (G10), the slice inventory line and the
   Phase 2 total lines (3314 authored, 3310 active).
2. **Tracker** (`phase-02-slice-12.md`): header counts 285/285, the 232 new criterion lines unchecked in the same
   format as the existing lines, the AC026/AC043 text, a dated continuation paragraph (2026-10-12, DEC-178) and every
   stale count in the narrative ("0/50" and similar) corrected to the current state.
3. **Specifications**: R1-R4 (DEC-179); R5 per DEC-180; R6 via G11; R7 via DEC-176; R8 via G6 (mirror BE03b:1872 and
   rule 7 of BE03b:1737) and G8; G1 per DEC-175 (CMS-03C-02 request/response contract text, the composition table
   rule, how one request writes 1-32 rows, `overrides` key mapping, the diff and render-plan consequence); G2 (a
   lock-order paragraph in BE03c placing every Slice 12 writer in the BE03b global order, extending DEC-157, and fix
   BE03c:1261 so it no longer prescribes the order DEC-157 rejected); G3; G4; G9; G11. Cite the DEC id beside each
   change. Do not invent behaviour beyond the decision text; where a decision leaves a detail open, say so in your
   report instead of filling it.
4. **Pinned totals** (they must change together): `scripts/check-progress-consistency.mjs` constants (3,078/3,082 ->
   3,310/3,314; find every occurrence), `tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts`
   (denominator), `tests/contracts/phase-02-slice-09-pre-traceability.test.ts` (the Slice 12 pin 53 -> 285; Slice 11
   stays 122), the denominator lines in `.memory/pipeline/progress/slices/phase-02-slice-09.md`,
   `.memory/pipeline/progress/index.md`, `.memory/pipeline/progress/phases/phase-02.md` and
   `.memory/pipeline/progress/spec-pipeline.md`. Read each test to find what else it pins that the cascade changes
   (for example a per-slice criteria table); list every edit with old and new value. Do not change any assertion's
   meaning beyond the number.
5. **Wording-batch draft** `docs/handoffs/2026-10-12-claude-s12/wording-batch-draft.md`: report section 9 rows
   (AC022, AC025, AC027, AC030, AC034, AC036, AC037, AC022-AC039 citation, AC004-AC021 section names; AC026/AC043 are
   already ratified by DEC-176 and only listed as applied) plus G5 (BE03b:251/:1538 and Slice 10 AC030), each with the
   exact current text, the locked spec line it must match, and the proposed text. Not applied.
6. **Report** `docs/handoffs/2026-10-12-claude-s12/cascade-lane-report.md`: every file changed; for each decision the
   exact lines edited (old -> new, abbreviated where long); R5 readings with evidence; anything a decision left open;
   row counts by range proving 232 new rows and 285 total in both plan and tracker (by script); and the full list of
   pinned totals changed. Final message at most 300 words: HEAD, report path, counts, open items.

## Checks you run (read-only scripts)

- Plan and tracker each have exactly 285 Slice 12 criterion lines, ids AC001-AC285 contiguous, and identical text
  per id between plan and tracker (compare by script; the tracker checkbox prefix is the only difference).
- Every spec line number you cite in the report is resolved by script after your edits.
- No `{{PLACEHOLDER}}`, `TODO` or `TBD` introduced.
