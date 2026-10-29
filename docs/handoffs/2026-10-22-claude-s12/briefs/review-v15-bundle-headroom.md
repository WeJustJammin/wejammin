# Review V15 — bundle-headroom web changes (deferred validators, on-demand term action) before commit

You did not write this work; your job is to find what is wrong with it. Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
first. Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split. `/bin/ls`, never bare `ls`. READ-ONLY
except your report `docs/handoffs/2026-10-22-claude-s12/review-v15-report.md` (Bash heredoc if Write refuses). You may run
focused Vitest and `pnpm build && pnpm bundle:check`; no database, race or Playwright.

## Input

Lane report `docs/handoffs/2026-10-22-claude-s12/lane-bundle-headroom-report.md` (SHA `9b264aae…`) and every file it lists:
the on-demand `CmsTaxonomyTermAction` (`term-action-view.tsx`, `cms-on-demand-view.tsx`, the new `CMS_ON_DEMAND_CHUNKS`
entry in `scripts/verify-bundle-budget.mjs`), the entry editor's deferred field validators (`cms-field-basics.ts`,
`cms-field-validation.ts` registry filled when `cms-field-value.ts` loads with the save chunk), the `CmsLoadingRegion`
wiring into `CmsGovernedReviewPanel`, `CmsTaxonomyConflictPanel`, `CmsTaxonomyTermChoice`, and the test corrections.

## Check (spec first)

1. **Client validation timing.** `.claude/rules/security-first.md`: "Every form validates client-side with Zod AND
   server-side with the same schema". FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md` and the Slice 10/11 field
   editor rules (FE02/FE03 field editors: validate on blur? inline errors? before autosave?). With the validators loaded
   only with the save chunk, what does a person see between typing an invalid value and the first save, on blur, and on
   submit? Is any validation that FE specifies now missing before first save? Is any invalid value sent to the server that
   the client was required to stop? Cite the spec lines either way.
2. **On-demand term action.** Is the chunk genuinely on-demand (never mounted at hydration — the budget gate exempts only
   such chunks)? Focus management on open (FE03 focus rules), failed-load retry (`retryable-import.ts`, cached failed import
   — PAT-031), leave guard interplay, keyboard path.
3. **Loading region** rules (FE03 AC-271 wording, 249/250 ms) and no regression in the three components' existing states.
4. Bundle numbers reproduce; no budget raised; the `CMS_ON_DEMAND_CHUNKS` entry is justified.
5. Test corrections: the preload imports added to ten `CmsTaxonomyTermForm*.test.tsx` files — do they still test the
   real async loading path anywhere (jsdom limits: name the real-route spec that must cover it)?

## Output

Findings BLOCKER / MAJOR / MINOR / NIT with file:line, evidence and a proposed fix; verdict ACCEPT / ACCEPT-WITH-CONDITIONS /
REJECT; the real-route specs root must run. Final message to root: verdict, report path + SHA-256, counts, top findings.
