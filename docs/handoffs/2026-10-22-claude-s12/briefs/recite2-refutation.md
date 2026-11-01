# Reviews `claude_s12_refute2_{a,b}` — refute the Slice 12 re-citation round-2 proposals (separate population)

You did not write these proposals; your job is to break them. Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
first (it binds you). Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split: multi-file commands go in a bash script.
`/bin/ls`, never bare `ls`. READ-ONLY except your two outputs. Never run supabase, docker, db, race modules, Vitest suites or
Playwright in any form (root's evidence runs are live and own `test-results/`).

Input (lane `<x>`): `docs/handoffs/2026-10-22-claude-s12/recite2/<x>-proposals.json` and the lane report
`docs/handoffs/2026-10-22-claude-s12/lane-recite2-<x>-report.md` (start with its "weakest citations"). Ledger rules:
`scripts/evidence/README.md` ("What the guard rejects"), `scripts/evidence/ledger-guard-lib.mjs`, types
`tests/contracts/phase-02-evidence-ledger.ts`. Criterion and clause text: the ledgers
`tests/contracts/phase-02-slice-12-evidence-ledger-*.ts` and `.memory/wiki/specs/phases/phase-2.md`. Specs: BE03c
`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md`.

Outputs: `docs/handoffs/2026-10-22-claude-s12/recite2/<x>-refutation.json` (write per criterion as you go) and report
`docs/handoffs/2026-10-22-claude-s12/review-refute2-<x>-report.md`.

## What to check, for EVERY proposed citation (not a sample)

1. **Proof.** Open the test, read the asserting lines. Does the assertion check the clause's exact behaviour — the value,
   refusal code, state transition, order, bound, actor — under the clause's conditions? Typical over-claims to reject:
   the test sets up the condition but asserts something else; it asserts a pure helper while the clause is about the
   endpoint/DB/browser; it asserts source text, a fixture or a mock rather than behaviour; it covers one of several
   conditions; it asserts the happy path for a refusal clause; a "computed" pgTAP title whose loop never reaches the case;
   a test that is cited as the only proof for more than 3 criteria.
2. **Identity.** Vitest: the exact `fullName` and `passed` status in
   `.lane-logs/canonical/final-evidence-20261023T224619Z/s09/vitest-all.json` (or
   `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_root/uniq8.json` for the
   eight files listed in `briefs/recite-proposals.md`); `node scripts/evidence/list-test-identities.mjs --vitest <json> --file <sub>`.
   pgTAP/Playwright/race: the source text (root checks pgTAP identities mechanically against a full verbose TAP later —
   flag only what you can see is wrong, e.g. a description used twice in one file, or a file that is not run as a pgTAP
   entrypoint such as a `populated-*.sql` witness or a `.sqlinc` no top-level `.sql` includes).
3. **Splits and removals.** A proposed split must be verbatim, in order, non-overlapping, and tile the original clause
   (only separators and and/or between parts). A `proposeRemoval` may remove only text the guard allows between clauses.
4. **Gaps.** Is each named gap real (search for a test the lane missed), and is each "verified" truly complete? A gap the
   lane missed is as important as a weak citation.
5. **Status.** Recompute `verified`/`partial`/`unverified` from the citations you KEEP.

## Output (`recite/<x>-refutation.json`, an array)

```json
{ "criterion": "P2-S12-AC-0NN",
  "citations": [ { "clauseIndex": 0, "title": "...", "verdict": "KEEP|DROP|FIX",
                   "reason": "path:line — what it actually asserts and why that does / does not prove the clause",
                   "fix": null } ],
  "splits": [ { "clauseIndex": 0, "verdict": "OK|REJECT", "reason": "..." } ],
  "missedGaps": [ "clause index + what is unproven" ],
  "missedTests": [ { "clauseIndex": 0, "citation": { "tool": "...", "file": "...", "title": "..." }, "evidence": "path:line" } ],
  "status": "verified|partial|unverified" }
```

Report: counts KEEP/DROP/FIX, per-reason classes of DROP, criteria whose status changed, the ten most serious findings,
and an overall verdict for the lane: ACCEPT (≤ 5% DROP) / ACCEPT-WITH-DROPS / REJECT (systematic over-claiming).

Final message to root: verdict, report path + SHA-256, refutation path + SHA-256, the counts.

## Round-2 specifics (root, 2026-10-29)

- The new tests come from the gap-wave lanes; their reports and the reviews' `## Verification` sections
  (`review-v12/v13/v14/v15-report.md`) record known-blind tests (e.g. V13-16: static #5/#6 of
  `phase_02_slice_12_gaps_lock_position4.sql` cannot fail) — DROP any citation of a test a review found blind.
- Root decisions: DEC-226 (evidence policy); a "Tier N p95" clause needs the real-stack latency apispec (receipt pending
  root's run) — a pgTAP RPC bench alone never proves it; clauses with an unreachable sub-branch (AC-186, AC-244, AC-289,
  AC-292 and any like them) are SPLIT, the unreachable part left uncited with its BOUNDARY text — never verified-with-caveat.
- Identities are static; root verifies them mechanically against the fresh full TAP and Vitest JSON — judge PROOF first.
- Do not run supabase, docker, db, race, Vitest suites or Playwright: root's canonical `db:verify` is live.
