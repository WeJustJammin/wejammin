# Lane `claude_s12_web6` — FE03 command-form conformance fixes + the remaining web proofs

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`.
zsh does not word-split; `/bin/ls`, never bare `ls`. Report `docs/handoffs/2026-10-22-claude-s12/lane-web6-report.md` (checkpoint
early, keep `## Status` current); proposals `docs/handoffs/2026-10-22-claude-s12/recite4/web6-proposals.json` (the
`recite2/*-proposals.json` schema). Debug-by-test: RED test first, then the product fix, then green. Never run Playwright, db,
supabase, docker or races. Focused Vitest only; repo-wide coverage stays 100% (cover every new branch).

Context: lane unit5 (`lane-gaps-unit5-report.md`) already fixed the template designers (leave guard; fieldset locked only after
success, commit disabled while pending — FE03 1048). Lane pw5 (`lane-gaps-pw5-report.md`) found the AC-042 success focus target.

## Rows

1. **FE03 1048 in the three other command forms** — `CmsTaxonomyVersionDesigner.tsx:108`, `CmsTaxonomyTermAction.tsx:121`,
   `CmsLocaleVariantForm.tsx:128` disable the whole fieldset while a command is pending; FE03 1048 disables only the commit
   control (inputs stay editable and focus is not lost). RED component test per form, then the fix, matching unit5's template
   designer fix pattern.
2. **AC-042 "focus stays until navigation or named result heading"** (FE03 1083-1087 generic row; CMS-11 row) — the template
   define success result is a focusable status region, not a heading. Make the success result a named heading (accessible name
   = the result) that receives focus, keep the polite announcement; RED test first. Check the successor designer too. Tell root
   which pw5 spec assertions (`tests/e2e/phase-02-slice-12-template-states-real-route.spec.ts`) now hold.
3. **AC-271 governance states** — per island named in the clause (CMS-03C-10 and the others it lists): component tests that
   enumerate idle/loading (≥250 ms skeleton per FE03)/success/empty/error/degraded/disabled as FE03 specifies them; add only what
   is missing (unit5 proved CMS-03C-01 loading only).
4. **AC-272 governed surface privacy, browser half** — the pattern diff surface (`CmsDiffPath` and its parents) must not render
   or store the sentinel values the clause names beyond what FE03 allows; component test with sentinels (DOM, storage, URL).
5. **AC-001 "and accessibility contracts in templates."** — root reading (owner may override): a template preserves block
   accessibility contracts because it references exact immutable block versions and its strict CMS-03C-01 definition carries no
   member that overrides a block's accessibility manifest. Prove: the contract schema (`packages/contracts`) and the Worker route
   refuse a definition carrying an accessibility (or any unknown) member on a slot/block entry (422 at that pointer); invent no
   new behaviour — if the schema accepts such a member, report it as a defect and stop for root.

## Claim

New test files; the product files named in rows 1-2 (+ their READMEs); your report and proposals. Never edit ledgers,
receipts, trackers, specs, migrations, Playwright specs or another lane's files. After edits: eslint, prettier, `tsc --noEmit`
in apps/web, focused Vitest; list the bundle-relevant files changed (root runs `pnpm build && pnpm bundle:check`).

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, per-row table, runs, changed files with SHA-256,
defects, BOUNDARY items.
