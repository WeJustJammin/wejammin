# Slice 11 implementation-lane brief (2026-10-10)

You are an implementation lane fixing independently upheld Slice 11 defects. The orchestrator
integrates, re-verifies, commits and runs the canonical gates. You own only the files named in
your assignment.

## Where you work

- Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`.
- Every shell command MUST begin with `cd /home/rob/.codex/worktrees/phase2-slice11/WeJammin &&`
  (your shell resets to another checkout between calls). First command:
  `cd /home/rob/.codex/worktrees/phase2-slice11/WeJammin && git rev-parse --show-toplevel && git rev-parse HEAD`.
- Toolchain: prefix commands with `export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH" &&`
  (Node 22.23.1, pnpm 11.24.0). Plain `pnpm` is broken on this host.
- NEVER touch the primary checkout `/home/rob/Projects/WeJammin`.
- Never `git add/commit/stash/checkout/reset/restore`. Never edit files outside your assignment.
  If a fix needs another file, stop and say which file and why in your report.

## Read first

- `CLAUDE.md`, `.claude/rules/tdd-contract-first.md`, `.claude/rules/debug-by-test.md`,
  `.claude/rules/boundary-not-placeholder.md`, `.claude/rules/security-first.md`.
- The finding text in `docs/handoffs/2026-10-08-phase2-codex-handoff/codex/s11-sql2-reverification-2026-10-09.md`
  (read your findings and the "Integration order and file ownership" section).
- The normative spec lines the finding cites: BE03b = `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`,
  BE05c, FE03, and `.memory/wiki/decisions.md` (DEC-149..DEC-163 are binding).
- Line numbers in the finding are from 2026-10-09; re-locate them in the current files.

## Method (non-negotiable)

1. Write the failing test FIRST (pgTAP in `supabase/tests/`, race runner, or vitest). It must
   produce the real condition (e.g. a genuine concurrent interleaving with a barrier, a real
   revocation while a command waits) and assert the exact outcome the spec requires.
2. Run it and confirm it fails FOR THE RIGHT REASON. Keep the log path and the failing line.
3. Make the minimal production fix. Run the new test and every neighbouring suite you touched
   until GREEN. Then refactor if needed and rerun.
4. Never weaken, skip or loosen an existing assertion to get green. If an existing test pins the
   old (wrong) behaviour, change it only to the behaviour the locked spec requires, and list the
   exact old and new title/expectation in your report (evidence ledgers cite test titles).
5. No `TODO`; no stubbed ports that return the expected error; no mock in place of real
   composition. Boundary stubs only under `.claude/rules/boundary-not-placeholder.md`.

## Migrations

- Slice 11 migrations that are NOT on `main` (list:
  `git diff --name-only origin/main...HEAD -- supabase/migrations/`) were never deployed and may
  be edited in place, EXCEPT functions whose installed body is MD5-pinned by a later forward
  migration: `cms_schedule_publication`, `cms_claim_due_publication_schedules`,
  `cms_execute_publication_schedule`, `cms_get_entry_workflow`, `cms_schedule_state_guard`
  (pinned by `20261010140000`–`20261010154000`), and `cms_settings_snapshot`, `cms_create_entry`,
  `cms_create_revision`, `cms_resolve_conflict`, `cms_restore_revision`,
  `cms_author_locale_variant` (pinned by `20261010130000`).
- Changes to pinned functions, or to functions defined only in migrations already on `main`, go
  in a NEW forward migration in your assigned timestamp range, using `CREATE OR REPLACE` that
  preserves owner, `SECURITY DEFINER`, `search_path = ''`, grants, signature and volatility
  exactly. Prefer small dedicated files (under 400 lines).
- Keep schema-qualified names and the existing global lock order (DEC-157) unless your finding
  is about that order.

## Database (shared; read carefully)

- pgTAP-only runs: `bash docs/handoffs/2026-10-10-claude-s11/lanes/lane-db-alt.sh /home/rob/.codex/worktrees/phase2-slice11/WeJammin supabase/tests/<file>.sql ...`
  (second stack, its own lock, resets to the worktree's current migrations). Use this by default.
- Race runners or real-API specs need the main stack:
  `bash docs/handoffs/2026-10-08-phase2-codex-handoff/lanes/lane-db.sh <worktree> <files>` or
  `.../lane-api.sh <worktree> <apispec files>`. Both take `/tmp/wejammin-supabase-ci.lock` and may
  wait up to an hour behind a full gate; that is expected. For race runners, read
  `infra/run-database-race-runners.mjs` to run only your runner under that same lock.
- Never run `pnpm db:verify`, `pnpm validate`, `supabase db reset` directly, `docker`, or `psql`
  against either stack outside these runners. Other lanes share the worktree's migrations: a reset
  includes their in-progress files, so if a reset fails in a file you do not own, report it and wait.

## Report

Before your final message, write `docs/handoffs/2026-10-10-claude-s11/lane-<your-lane>-report.md`:
files changed; for each finding: RED log path + exact failing assertion, the fix, GREEN log path +
counts; every changed or added test title (old → new); spec lines satisfied; anything left open.
Final message: at most 300 words with HEAD, report path, RED/GREEN summary and open items.
