# Lane `claude_s12_unique_titles` — make duplicated Slice 12 Vitest titles unique and re-cite them (delegated by root)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (tar-backup every untracked file before
editing it in place — all eight files below are untracked). Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`.
Report: `docs/handoffs/2026-10-22-claude-s12/lane-unique-titles-report.md` (checkpoint early; keep `## Status` current).
No database runs, no evidence runner, no receipts edits.

## Problem

The Slice 12 evidence guard (`tests/contracts/phase-02-slice-12-evidence-guard.test.ts`, rules in
`scripts/evidence/ledger-guard-lib.mjs` and `scripts/evidence/README.md`) refuses any cited file in which one full Vitest
test name (describe chain + title) occurs more than once: "is duplicated N times (identity is ambiguous)". Receipts are
keyed by test identity, so a duplicated name cannot vouch for a single case. The full list of 21 duplicates is in
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/guard-s12-problems.txt`
(lines beginning `cited file`; ignore the two `pgtap` lines — root owns those). They arise from `it.each([...])` (or a loop)
whose title has no per-case interpolation. Files:

- `apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx`
- `apps/web/src/components/cms-governed-review/governed-review-command-failures.test.ts`
- `apps/worker/src/cms-composition/governed-review-decision-input.test.ts`
- `apps/worker/src/cms-composition/governed-review-reads.test.ts`
- `apps/worker/src/cms-composition/pattern-definition-admission.test.ts`
- `apps/worker/src/cms-composition/pattern-update-admission.test.ts`
- `apps/worker/src/cms-composition/taxonomy-definition-write.test.ts`
- `apps/worker/src/cms-composition/taxonomy-selector-read.test.ts`

## Work

1. In each file, give every case of every duplicated test a distinct, descriptive title that names what differs (the
   operation id, the field, the value or the status), e.g. object cases `{ name: 'CMS-03C-12 write', request: writeRequest }`
   with `$name` in the title, or `%s` for primitive cases. Sweep the WHOLE file, not only the listed titles: no full test
   name may occur twice in any of the eight files. Change no assertion, no setup, no case set (same count of cases, same
   inputs). Before/after `vitest run <file> --reporter=json` must show the same number of tests, all passing.
2. Re-cite in the Slice 12 ledgers (`tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`, root delegates exactly
   this): every citation whose `file` is one of the eight and whose `title` is an old duplicated name is replaced by one
   citation per new case title (same `tool`, same `file`, same clause, same order position). Do not touch clause `text`,
   criterion `text`, `status`, `limitation`, or any other citation. Old title → new titles mapping goes in the report as
   a table.
3. Verify with a script (put it in your scratch dir, cite it): run the eight files with `--reporter=json`, then check that
   every ledger citation whose file is one of the eight matches exactly one passing test's full name (describe chain
   joined by a space, then the title — copy the join rule from `scripts/evidence/receipts-lib.mjs` / `identity-receipts-lib.mjs`,
   do not guess), and that no full name in those files is duplicated. Print N/N.
4. `pnpm exec prettier --check`, `pnpm exec eslint`, and `pnpm exec tsc -p <the package tsconfig> --noEmit` (or the
   package's `type-check` script) on the touched files/packages.

## Claim

The eight test files; citation lines for those eight files in `tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`.
Live: root (S11 ledger, `supabase/tests/phase_02_slice_12_template_authority.sql` citations in the S12 ledger — do not
touch those lines; if you must edit the same ledger file, edit only your citation entries and re-read the file right
before each edit). Never edit receipts, trackers, specs or product code.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, per-file test counts before/after, the N/N
verification line, files with before/after SHA-256, requests to root.
