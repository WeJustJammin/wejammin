# Review V16 — wave-5 product changes (web + Worker) before commit

You did not write this work; your job is to find what is wrong with it. Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
first. Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split; `/bin/ls`, never bare `ls`. READ-ONLY except
your report `docs/handoffs/2026-10-22-claude-s12/review-v16-report.md`. You may run focused Vitest and `tsc --noEmit`; never
Playwright, db, supabase, docker, races or `pnpm build`.

## Input (every product file and every corrected existing test each report lists)

1. Lane gaps-unit5 (`lane-gaps-unit5-report.md`, incl. its `## Fix round` when present): template designer leave guard
   (`CmsTemplateLeaveGuard.tsx`, `CmsTemplateLeaveConfirm.tsx`, `cms-template-draft-dirty.ts`, `use-cms-template-draft-fields.ts`,
   `CmsTemplateDesigner.tsx`, `CmsTemplateEditDesigner.tsx`); the fix round's CMS-03C-08 Location removal (root DEC-239,
   `.memory/raw/events/2026-10-29.jsonl`) and its blind-test repair.
2. Lane web6 (`lane-web6-report.md`): FE03 1048 commit-only disabling in `CmsTaxonomyVersionDesigner.tsx`,
   `CmsTaxonomyTermAction.tsx`, `CmsLocaleVariantForm.tsx`, `use-locale-variant-form.ts`; the AC-042 named result heading
   (`CmsTemplateStatus.tsx`, `CmsTemplateDesigner.tsx`, `cms-template-edit-reconcile-state.ts`, `cms-template-result-focus.ts`, CSS).
3. Lane pwfix6 (`lane-pwfix6-report.md`, `lane-pwfix6-hashes.txt`): `cmsRedirectResponse` in
   `apps/web/src/components/cms-editorial-pages/cms-editorial-page-outcome.ts` replacing every `Astro.redirect` in the 23 CMS
   pages, the guard `no-store-redirects.test.ts`, the 16 corrected route source tests; harness `tests/e2e/support/s12-real-template-locale.ts`.

## Check (spec first: FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md`, BE03c, security-first rule)

- Behaviour vs FE03 cell by cell: leave guard (FE03 927, CMS-11 row 1109: scoped draft before commit, cleared after success,
  Back/Cancel, keyboard path, focus return); commit-only disabling (1048: inputs editable, focus not lost, a second submit
  impossible, a late edit during pending does not corrupt the pending result — check the locale hook's "reset to idle" change);
  the result heading (1083-1087: named, focused, not re-stolen on refetch, announced once, works for create AND successor).
- Redirects: every 303 keeps the exact `Location` (returnTo encoding, allowlist), status 303 on GET and POST paths, no-store, no
  regression in the step-up 303s; the guard test cannot be satisfied by a page that redirects some other way.
- Harness: fixture sessions provably unchanged (existing template/locale real-route specs depend on fixture seams).
- PAT-031: a test that would pass with the fix reverted is blind — revert-check the key RED tests mentally against the diff.
- Coverage 100% of each touched module; no `any`; file-size limits (components ≤ 200 lines).

## Output

Findings BLOCKER / MAJOR / MINOR / NIT with file:line, evidence and a proposed fix; ACCEPT / ACCEPT-WITH-CONDITIONS / REJECT per
lane; the real-route specs root must run. Final message to root: verdicts, report path + SHA-256, counts, top findings.
