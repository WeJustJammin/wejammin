# Lanes `claude_s12_recite2_{a,b}` — cite the gap-wave tests in the Slice 12 ledger (PROPOSALS, no ledger edits)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` first; it binds you. Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`.
zsh does not word-split. `/bin/ls`, never bare `ls`. READ-ONLY except your outputs:
`docs/handoffs/2026-10-22-claude-s12/recite2/<x>-proposals.json` (write per criterion as you go) and
`docs/handoffs/2026-10-22-claude-s12/lane-recite2-<x>-report.md` (Bash heredoc if Write refuses). Never run supabase,
docker, db, race, Vitest suites or Playwright — root's canonical gates are live.

| Lane | Rows |
|---|---|
| a | `docs/handoffs/2026-10-22-claude-s12/gaps/inventory-20261029.json` rows with criterion AC-001..AC-150 |
| b | the same file, AC-151..AC-296 |

## Sources of new tests (read the per-row tables; every claim is to be re-checked, never trusted)

Lane reports in `docs/handoffs/2026-10-22-claude-s12/`: `lane-gaps-db1-report.md`, `lane-gaps-db2-report.md` (incl.
`## V13 follow-ups`, `## V13-05 position 4`), `lane-gaps-perf-report.md`, `lane-taxonomy-integrity-report.md` (all
follow-up sections), `lane-web-impl-report.md`, `lane-nestable-read-report.md`, `lane-placement-perf-report.md`,
`lane-bundle-headroom-report.md`, plus the reviews `review-v12/v13/v14/v15-report.md` (their `## Verification` sections say
which tests are blind — e.g. V13-16: static #5/#6 of `phase_02_slice_12_gaps_lock_position4.sql` cannot fail; cite the race
rows instead). Root-written tests: `apps/worker/src/cms-composition-production-locale-unsupported.test.ts` (AC-055),
`apps/web/src/server/cms-editorial-platform-term-unavailable.test.ts` (AC-246),
`apps/worker/src/cms-composition/node-pointer-refusal.test.ts` (AC-105).

## Rules (the same as the first re-citation, `briefs/recite-proposals.md`, plus root DEC-226)

- A citation names ONE test by exact identity: vitest = file + full name (describe chain + title, space-joined); pgTAP =
  file that OWNS the description (the entrypoint `.sql` for a computed description, DEC-226 rule 5) + the whitespace-
  collapsed description; Playwright = file + title path + project; race = file + the `ok - …` assertion text without the
  prefix (precedent). Copy identities from source; mark `identitySource: "static"`; root verifies every one against the
  fresh full TAP and Vitest JSON before applying.
- Cite only a test whose asserting line you read and that proves the clause's exact behaviour (DEC-226: no tier label for
  a p95 — the perf benches ARE measurements; "every other role" needs proacl; page-level behaviour for "consumed at
  /app/…"; a stubbed-token Worker test only if the DB raises that token on that operation). A named gap beats a weak
  citation. A clause that now has a BOUNDARY a lane recorded keeps the BOUNDARY text as the limitation.
- Use the CURRENT ledger (`tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`; texts changed by DEC-227/230/231/232)
  for clause texts and existing citations. Propose splits only where a clause is partly proven (verbatim, tiling).
- Output per criterion: `{ criterion, clauses: [{ index, text, add: [citation + evidence "path:line — what it asserts"],
  gap }], proposedStatus, proposedLimitation }` — the same schema as `recite/<x>-proposals.json`.

Report: counts (criteria newly verified / still partial, clauses newly cited, remaining gaps by class), the five weakest
proposed citations. Final message to root: GREEN / PARTIAL / BLOCKED, report and proposals paths + SHA-256, the counts.
