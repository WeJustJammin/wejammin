# Lanes `claude_s12_gaps_<name>` — prove the uncited Slice 12 clauses with new tests

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (ALT pgTAP through the staged runner
only; tar-backup every untracked file before editing it). Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&` (HEAD must be the latest root commit on `claude/phase2-slice12`).
Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split: multi-file commands go in a
bash script. `/bin/ls`, never bare `ls`. Report: `docs/handoffs/2026-10-22-claude-s12/lane-gaps-<name>-report.md`
(checkpoint early; keep `## Status` current; write it with a Bash heredoc if Write refuses).

## Input

`docs/handoffs/2026-10-22-claude-s12/gaps/inventory.json`: every uncited ledger clause with its criterion, clause text,
coarse `class` and the criterion's `limitation` (which names the missing test, file and spec line). Your rows:

| Lane | Rows |
|---|---|
| `db1` | `class` in {pgtap, other} and criterion AC-001..AC-180 |
| `db2` | `class` in {pgtap, other} and criterion AC-181..AC-296 |
| `perf` | `class` = hosted (every p95 / Tier target, all criteria) |
| `unit` | `class` in {worker, web} (all criteria) |

Evidence policy (root DEC-226, `.memory/raw/events/2026-10-24.jsonl` `dec-226`): a tier label never proves a p95 (a
measurement does); "every other role" needs a `proacl` assertion; "consumed at /app/…" needs page-level behaviour;
a stubbed-token Worker test counts only if the database raises that token on that operation; a computed pgTAP
description is cited under the entrypoint `.sql`. DEC-227 (same file, `dec-227`) amended some clause texts.

## Work, per row

1. Read the clause, the limitation, and the spec lines it names (BE03c
   `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, FE03, BE03b). Confirm the gap is real (search the
   tests: a refutation may have missed one — if a test already proves it, report the identity and write nothing).
2. Write the test that proves the clause's exact behaviour (values, refusal token, state transition, order, bound, ACL),
   positive and negative, through the real entry point and the real caller role, with a context-cleared case for any
   SECURITY DEFINER entry point (PAT-031). Put new pgTAP cases in NEW entrypoint files
   `supabase/tests/phase_02_slice_12_gaps_<area>.sql` (+ `.sqlinc` dirs) that may `\ir` existing helpers but never edit an
   existing suite file; new Vitest cases in NEW files beside the source. Each test title is unique in its file, carries the
   criterion marker `[P2-S12-AC-NNN]`, and computed descriptions are avoided where a literal will do.
3. If the real behaviour contradicts the spec, it is a defect: keep the failing test (RED), then fix forward in a NEW WIP
   dir `supabase/migrations-wip/gaps-<name>/` (timestamps: db1 `20261024120000`–`129999`, db2 `20261024130000`–`139999`,
   perf none, unit: no SQL; Worker/web product fixes named in the report first) — debug-by-test. A spec that is silent or
   self-contradictory → BOUNDARY with lines; never invent.
4. `perf` only: follow the Slice 11 precedent `tests/postgrest/phase-02-slice-11-read-latency.apispec.ts` and
   `supabase/tests/phase_02_slice_11_reads_bench128.sql` (real-stack latency apispec + pgTAP bench at the spec's data
   bound, p95 against the clause's target). Apispecs run only under root's PostgREST runner: write them, name them; root runs.
5. Record, per row: proven (the new identity, file:line of the assert) / already proven (identity) / BOUNDARY (lines) /
   defect fixed (WIP file + test).

## Runs

ALT staged runner for pgTAP (your new files + the suites your WIP touches); focused Vitest; never Playwright, races or
the canonical db commands. Final: every file you added, green; tsc/eslint/prettier on touched files.

## Claim

Only NEW files named above (+ your WIP dir, + Worker/web product fixes you name in the report first). Never edit ledgers,
receipts, trackers, specs, promoted migrations or existing test files. Live: the other gap lanes and the taxonomy-integrity
lane (`supabase/migrations-wip/taxonomy-integrity/`, `phase_02_slice_12_taxonomy_integrity*`, the contracts preflight
registry) — never touch theirs.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, per-row table (criterion, clause index, outcome,
identity), run counts, files with SHA-256, BOUNDARY items, requests to root.
