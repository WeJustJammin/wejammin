# Slice 12 implementation-lane brief (2026-10-13)

You are an implementation lane for Phase 2 Slice 12 (templates, reusable patterns, taxonomy governance, locale,
related content: BE03c CMS-03C-01..21 and five supporting reads). The orchestrator integrates, re-verifies, commits
and runs the canonical gates. You own only the files and migration range named in your assignment.

## Where you work

- Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`.
- Every shell command MUST begin with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&` (your shell resets to
  another checkout between calls). First command:
  `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && git rev-parse --show-toplevel && git rev-parse HEAD`.
- Toolchain: prefix commands with `export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH" &&` (Node 22.23.1,
  pnpm 11.24.0). Plain `pnpm` is broken on this host.
- NEVER touch the primary checkout `/home/rob/Projects/WeJammin` or `/home/rob/.codex/worktrees/phase2-slice11/`.
- Never `git add/commit/stash/checkout/reset/restore`. Never edit files outside your assignment. If a fix needs another
  file, stop and say which file and why in your report.

## Read first

- `CLAUDE.md`, `.claude/rules/tdd-contract-first.md`, `.claude/rules/debug-by-test.md`,
  `.claude/rules/boundary-not-placeholder.md`, `.claude/rules/security-first.md`, `.claude/rules/specificity-standards.md`.
- The locked spec: BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (and BE03b, BE03a, BE00, BE05c,
  IA03, FE03 where your rows cite them). Binding rulings: `.memory/wiki/decisions.md` DEC-121..123, DEC-135..141,
  DEC-148..186 (DEC-175 placement rows, DEC-176 revisions only, DEC-181 nested-root expansion, DEC-185 position column,
  DEC-186 implementation decisions, DEC-156..160 conventions, DEC-157 lock order, DEC-172 502 mapping).
- The Slice 12 tracker `.memory/pipeline/progress/slices/phase-02-slice-12.md` (your criteria) and the gap reports
  `docs/handoffs/2026-10-12-claude-s12/ledger-gap-*.md` (what exists, what is missing, which tests to add).
- Existing code to extend, never duplicate: `packages/contracts/src/cms-composition/`, `apps/worker/src/cms-composition*`,
  `apps/web/src/components/cms-composition/`, the Slice 09/11 CMS migrations, and the Slice 11 editorial-review
  machinery as the model for governed review.

## Method (non-negotiable)

1. Contract first: strict Zod schemas (and registry rows / OpenAPI where your assignment says) before implementation.
2. Write the failing test FIRST (pgTAP in `supabase/tests/`, race runner, vitest, apispec through the real Worker +
   Kong/PostgREST + database, or Playwright). It must produce the real condition and assert the exact outcome the spec
   requires (exact status, code, reason token, row values). Run it and confirm it fails FOR THE RIGHT REASON; keep the
   log path and the failing line.
3. Make the minimal production change; run the new test and every neighbouring suite you touched until GREEN; refactor.
4. Never weaken, skip or loosen an existing assertion. If an existing test pins behaviour the locked spec contradicts,
   change it only to what the spec requires and list the exact old and new title/expectation in your report.
5. No `TODO`; no stubbed ports that return the expected error; no mock in place of real composition. Boundary stubs only
   under `.claude/rules/boundary-not-placeholder.md`. Name every new test with the criterion marker `[P2-S12-AC-NNN]`
   it proves, but remember a marker is not proof: the assertions are.
6. Files stay under the size limits of `.claude/rules/extensibility.md` (300 lines for lib/SQL modules you add; split).
   Every new directory with more than two files needs a `README.md`.

## Migrations

- Only NEW forward migrations, in your assigned timestamp range. Never edit a migration already on `main` or on
  `claude/phase2-slice11` (every existing file). `CREATE OR REPLACE` of an existing function must preserve owner,
  `SECURITY DEFINER`, `search_path = ''`, grants, signature and volatility exactly, and functions whose body a later
  migration MD5-pins need a guarded amendment in the same style as the Slice 11 forward migrations.
- A migration that alters a populated table must succeed on populated data (PAT-025): backfill before NOT NULL,
  self-checks that hold on existing rows, and a populated-database witness in your tests where the change is risky.
- Keep schema-qualified names and the BE03b global lock order (DEC-157) extended by BE03c (DEC-180 G2).

## Database (shared; read carefully)

- pgTAP-only runs: `bash docs/handoffs/2026-10-10-claude-s11/lanes/lane-db-alt.sh /home/rob/.codex/worktrees/phase2-slice12/WeJammin supabase/tests/<file>.sql ...`
  (second stack, linked to this worktree, its own lock, resets to this worktree's current migrations). Default choice.
- Race runners or real-API specs need the main stack:
  `bash docs/handoffs/2026-10-08-phase2-codex-handoff/lanes/lane-db.sh /home/rob/.codex/worktrees/phase2-slice12/WeJammin <files>`
  or `.../lane-api.sh /home/rob/.codex/worktrees/phase2-slice12/WeJammin <apispec files>`. Both take
  `/tmp/wejammin-supabase-ci.lock` (shared with self-hosted CI) and may wait up to an hour; that is expected.
- Never run `pnpm db:verify`, `pnpm validate`, `supabase db reset` directly, `docker`, or `psql` outside these runners.
  Other lanes share the worktree's migrations: a reset includes their in-progress files, so if a reset fails in a file
  you do not own, report it and wait.

## Quiet host

A canonical gate may hold `/tmp/wejammin-quiet.lock` exclusively. Prefix EVERY heavy command you run (`pnpm exec vitest`,
`pnpm exec tsc`, eslint, playwright, anything touching a database) with `flock -s /tmp/wejammin-quiet.lock`. It blocks
while a gate runs; keep authoring while you wait. Never bypass it.

## Report

Before your final message, write `docs/handoffs/2026-10-12-claude-s12/lane-<your-lane>-report.md` (if the harness refuses
the write, put the full report in your final message): files changed; per criterion or finding the RED log path and exact
failing assertion, the change, the GREEN log path and counts; every added or changed test title (old -> new); spec lines
satisfied; anything left open with the exact reason. Final message: at most 300 words with HEAD, report path, RED/GREEN
summary and open items.
