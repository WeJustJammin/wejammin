# Claude Phase 2 continuation prompt

```text
Use Claude Opus 5.5 as the main orchestration model, with the highest available reasoning effort, for planning, research, validation, independent review, and integration decisions. Use Claude Sonnet 5.5 subagents with high reasoning effort for execution and implementation. Explicitly select those models where supported; if either requested model is unavailable, report the exact availability problem instead of silently substituting another model.

Your job is to finish WeJammin Phase 2, Slices 09–17, through the existing /implement-slice workflow and the final /validate-phase gate. Continue autonomously until Phase 2 implementation is complete and its required validation and tracking gates pass. Keep externally owned release evidence on its approved timeline; never fabricate or count it as passed.

Read this new handoff first:
/home/rob/.codex/worktrees/phase2-slice10/WeJammin/docs/handoffs/2026-10-06-phase2-claude-handoff.md

Active worktree:
/home/rob/.codex/worktrees/phase2-slice10/WeJammin
Branch: codex/phase2-slice10
Committed HEAD: ac8b2c19ca90e225c0b335c60bbbf7c4038b820b

Historical PR:
https://github.com/WeJustJammin/wejammin/pull/124
PR #124 is already merged. Slice 09 active implementation is complete under DEC-132. Resume the unfinished Slice 10 work already on disk, then complete Slices 11–17 in dependency order. Do not restart Slice 09 or treat PR #124 as the current unmerged work.

Carry forward the owner's confirmed decision exactly: "AC261 approve; O1 A". DEC-132 ratifies AC261; DEC-133 selects typed depth-1 object properties[], maximum 32. Read the recorded decisions before raising any question already answered there.

1. Read CLAUDE.md, AGENTS.md, project rules/instructions, /implement-slice skills, the Phase 2 plan, and the decision/spec sources named in the handoff. Inspect the current git state and preserve every existing change. The handoff records 106 unfinished paths before its three documentation additions; nothing is staged and no Slice 10 PR exists at the checkpoint.
2. Reuse the active Slice 10 worktree. Repair its known database, static, and coverage failures with contract-first Red → Green → Refactor. Delegate independent file scopes to Sonnet 5.5 subagents; prevent overlapping edits and serialize database reset/test operations. Opus 5.5 verifies each result and directs integration.
3. Run the exact repository validation gates. Prior /tmp logs are gone: previous test counts in the handoff are historical reports, not fresh proof. Repair the first failing gate, rerun it, and continue through the complete chain. Do not weaken security or acceptance tests to obtain green results; cascade demonstrably stale fixtures only against the locked source decisions.
4. Close each slice with complete acceptance evidence, depth checks, progress tracking, architecture/runbook updates, session capture, and the canonical memory flush/compile workflow. Create reviewable PRs for completed work, verify their checks, and continue through the repository's established integration process. Respect any explicit deployment or merge approval boundary already recorded.
5. CLEAN completed task-owned worktrees, branches, and temporary artifacts as you go. Verify the exact target, ownership, clean status, merged commits, and recoverability first. Preserve active work, unrelated dirty trees, and handoff files needed by the next checkout. Prefer recoverable archive for managed worktrees. Do not leave stale task-owned resources behind.

Do not stop after a plan, a partial repair, or local tests alone. Continue through Slices 11–17 and /validate-phase. If an actual external blocker prevents required progress, exhaust safe in-scope alternatives, preserve a precise checkpoint, and report the exact unblock needed. Do not claim Phase 2 complete while required implementation or validation remains open.

Keep progress updates concise and evidence-based. Final delivery must identify completed slices, verification results, PRs/commits, remaining owner-held release gates, and cleanup performed.
```
