# Lane S11-0 — Slice 11 setup: specification and plan cascade (no code, no DB)
LANE = /home/rob/.codex/worktrees/phase2-slice11/WeJammin (branch claude/phase2-slice11, stacked on codex/phase2-slice10 = PR #126).
Every command: `cd LANE && export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH" && ...`. No git commit/stage/stash/reset.
Do NOT touch /home/rob/.codex/worktrees/phase2-slice10/WeJammin or /home/rob/Projects/WeJammin. No pnpm db:*, supabase, psql, docker.
Read first: ORCH/s11/s11-brief.md (Codex digest; verify every claim you rely on against the cited spec lines), the `plan-phase-write`
and `spec-writing` skills (.claude/skills/*/SKILL.md), .memory/pipeline/progress/verification/2026-10-05-slice-10-depth-floor.md
(the precedent format for an additive depth-floor cascade), .memory/rules memory-capture rule (flushEntry raw records, never edit
decisions.md directly), and DEC-147/148 in .memory/raw/events/*.jsonl.
Tasks:
1. Record orchestrator resolutions as raw decision records (flushEntry, ids dec-149.., agent "claude", type decision, "owner may
   override" in text; then run `node .memory/pipeline/compile.mjs`): (a) the DEC-148 depth-floor cascade is ADDITIVE (Slice 10 DEC-133
   precedent): six obligations (contract/shape, validation, authority/privacy, runtime bounds, safe failure, consumer/verification) per
   cascaded operation CMS-03B-15..20; (b) accessibility outcome vocabulary: adopt the BE05c canonical enum and amend the conflicting BE03b
   clause (cite both lines); (c) FE03 gains explicit route/component rows for CMS-03B-15..18 consistent with BE03b; (d) FE03:536 locale
   runtime follows DEC-114/DEC-138; (e) pinned tzdb: a code-owned constant release identifier + content hash, server-verified, recorded
   per schedule (cite BE03b E8 lines) — if the spec makes the asset itself contract-visible, do NOT decide: write the exact owner question
   with options into your report instead.
2. Author the additive criteria for Slice 11 in BOTH .memory/wiki/specs/phases/phase-2.md (Slice 11 section) and
   .memory/pipeline/progress/slices/phase-02-slice-11.md: new ids continue after the current last S11 id, each with exact spec citations,
   one obligation per criterion (no padding: if an operation genuinely lacks an obligation class, say so and justify — see memory
   "enum padding failure mode"). Write the depth-floor ledger .memory/pipeline/progress/verification/2026-10-08-slice-11-depth-floor.md
   (formula, additive ledger table). Update every stated total (Slice 11 criteria/floor, Phase 2 authored/active denominators, slice
   inventory line, completion policy paragraph) and run `node scripts/check-progress-consistency.mjs` until exit 0.
3. Spec text edits for 1(b)(c)(d) with changelog rows citing the DECs. Do not change existing criterion TEXT (AC035/038/041 have
   punctuation defects — list them with proposed corrected text in your report; the owner ratifies wording).
4. `pnpm format:check` clean for touched docs in its glob; `pnpm progress:check` exit 0; `pnpm exec vitest run tests/contracts` (plan/
   traceability guards, e.g. S09 AC-268) green.
Report: ORCH/s11/lane-s11-0-report.md (decisions recorded, criteria added with ids, totals before/after, open owner questions).
Final chat ≤6 lines.
