# Review V12 — `taxonomy-integrity` WIP (DEC-141 receiving obligations) before promotion

You did not write this work; your job is to find what is wrong with it. Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
first. Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split. `/bin/ls`, never bare `ls`. READ-ONLY
except your report `docs/handoffs/2026-10-22-claude-s12/review-v12-report.md` (Bash heredoc if Write refuses). You may run
the staged ALT pgTAP runner named in the lane rules (background, wait) to confirm a finding or a mutant; nothing else
that touches a database.

## Input

- Lane report `docs/handoffs/2026-10-22-claude-s12/lane-taxonomy-integrity-report.md` and its BOUNDARY list.
- WIP `supabase/migrations-wip/taxonomy-integrity/` (nine files, `20261024100000`–`100800`).
- Tests `supabase/tests/phase_02_slice_12_taxonomy_integrity.sql`, `…_provider.sql`, `…_taxonomy_integrity/`.
- The proposed corrections of eight existing test files: `docs/handoffs/2026-10-22-claude-s12/lane-taxonomy-integrity-test-corrections.diff`
  and the verified copies in `supabase/tests/phase_02_slice_12_taxonomy_integrity_corrected_oracles/`.
- Contracts/Worker edits named in the report (`packages/contracts/src/cms-editorial/preflight.ts` and tests,
  `apps/worker/src/cms-editorial/error-vocabulary.ts`, …).
- Spec: BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` "Preflight providers registered by Slice
  12" (~1574, now with DEC-229), "Receiving obligations from Slice 10 (DEC-141)" (~1576-1590), TermAssignment (~1605),
  term actions; BE03b `Value encodings by field kind`, restore and comparison; criteria AC-221, 224, 239, 241, 242, 244,
  246 in `.memory/wiki/specs/phases/phase-2.md`.

## Check

1. Spec conformity, clause by clause (each reason, each refusal token and status, `comparison_unavailable`
   non-disclosure, `migration_chain_incomplete`, `term_unavailable` 422 at the field pointer, merged-term re-pointing
   incl. chains, `taxonomy_version_ids` = current active ids, deprecated tolerated only where already assigned).
2. The eight test corrections: is each old oracle truly contradicted by DEC-141 (cite the line), and does each new
   assertion still assert at least as much as the old one (no weakening, no deleted negative case)?
3. Security and posture: SECURITY DEFINER ownership, `search_path = ''`, grants (no API role executes private
   functions), RLS, `app.cms_rpc` set/restore on every entry point (PAT-031: a context-cleared real-role test exists and
   would fail without the flag), owner scoping (no cross-owner read through the resolver or encoder).
4. Anchored patches: every patch of a live function body is anchored to the newest definition across promoted and WIP
   migrations, with a reverse check; nothing silently drops a later lane's change (the WIP dirs `node-pointers/`,
   `placement-perf/` and any `gaps-*` of live lanes are siblings — note any overlap of functions).
5. Lock order (BE03c "Slice 12 lock order") for every new write path; idempotency; deterministic ordering.
6. Test quality: RED evidence, mutants, every predicate both ways, no fixture that supplies the hoped-for context.

## Output

Report: findings ranked BLOCKER / MAJOR / MINOR / NIT with file:line, the evidence, and a proposed fix; a verdict PROMOTE /
PROMOTE-WITH-CONDITIONS / DO-NOT-PROMOTE; and for the eight corrections a per-file ACCEPT/REJECT.
Final message to root: verdict, report path + SHA-256, counts per severity, the top findings.
