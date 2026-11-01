# Claude Slice 12 lane rules (read fully before any action)

Every lane agent follows these rules. Your brief adds lane-specific scope. If the brief and these
rules conflict, stop and report the conflict instead of choosing.

## Workspace

- Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`,
  HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`.
- Your shell cwd resets to `/home/rob/Projects/WeJammin` on every call. That checkout is PROTECTED:
  never read-modify-write it, never run tools there. Start EVERY shell command with
  `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. First command of your session:
  `git rev-parse --show-toplevel && git rev-parse HEAD`.
- Toolchain: `/bin/bash`, `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH` (Node 22.23.1,
  pnpm 11.24.0). Login shells pick incompatible tools.
- Several lanes run at once in this worktree. Touch only files your brief assigns. If you need a file
  outside your claim, stop and ask root through your report's `## Requests to root` section and your
  final message.

## Never

- Before editing any UNTRACKED file in place (every `supabase/migrations-wip/` file is untracked), copy it to your
  lane scratch directory first (`tar -cf <scratch>/<lane>/orig-<stamp>.tar <paths>`) and record the tar path in your
  report: git cannot restore it, and on 2026-10-22 a lane had to rebuild 24 originals from transcripts.
- Never write scratch files directly in the shared session scratchpad root: use a subdirectory named after
  your lane (`<scratchpad>/<lane>/`). Several lanes share the scratchpad; on 2026-10-15 one lane ran another
  lane's mutation script against Worker files.

- No `git add`, commit, stash, checkout, reset, clean, restore, or push. No PR actions.
- Never `pkill`, `killall` or `kill` by name/pattern: other lanes run the same commands (on 2026-10-15 a lane's `pkill -f "vitest run apps/web"` may have killed another lane's run). Stop only a PID you started yourself, or a background task by its own task id.
- Never edit the thirteen applied migrations `supabase/migrations/20261013300000_*` …
  `20261013300830_*`, or any other existing file under `supabase/migrations/`. Fix forward only.
- Never edit shared pgTAP helpers (`supabase/tests/phase_02_slice_09_dec108/`,
  `supabase/tests/phase_02_slice_10*`, `supabase/tests/phase_02_slice_11_helpers/`, JWT helpers) or
  another lane's files.
- Never run `pnpm db:verify`, `pnpm validate`, `pnpm db:test`, `pnpm db:types`, `supabase db reset`
  directly, `supabase start/stop`, docker commands, race modules (`*.race.mjs`), or the old
  `lane-db-alt.sh`. Root runs canonical gates.
- Never disable triggers, forge approvals/evidence, insert active rows directly to bypass producers,
  widen grants beyond the spec, or weaken a test so it passes.
- No secrets, network services, hosted/production claims, or fabricated evidence.

## Database runs (pgTAP)

- Run pgTAP ONLY through the staged ALT runner:
  `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH bash docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh /home/rob/.codex/worktrees/phase2-slice12/WeJammin <lane> supabase/tests/<file>.sql`
  It takes all locks itself and queues behind other lanes (waits can be long; that is normal). Run it in
  the background and wait for it; never wrap it in `timeout` (a killed run loses its result).
- Your new migrations live in `supabase/migrations-wip/<lane>/` (create the directory) and use ONLY
  your assigned timestamp range. The runner stages promoted migrations plus your WIP ones. Root
  promotes reviewed migrations into `supabase/migrations/`.
- One run per deliberate change. Never rerun identical bytes hoping for a different result. Record
  every run in your report: time, stamp, plan, pass/fail counts, first failing test, TAP path and
  SHA-256.
- A reset failure or harness abort (parse error, missing helper, cast error) is NOT feature RED.
  Classify every failure: harness / genuine missing feature / genuine defect.

## Method

- Read `.claude/rules/*.md` in the worktree (TDD contract-first, boundary-not-placeholder,
  security-first, specificity, extensibility, debug-by-test). They bind you.
- Spec is the source of truth: `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`
  (BE03c), `.memory/wiki/specs/ia/03-cms-content-modeling.md` (IA03), `.memory/wiki/specs/fe/03-cms-content-modeling.md`
  (FE03), decisions in `.memory/wiki/decisions.md` (DEC-NNN). Cite spec lines for every behavior.
- Contracts already exist in `packages/contracts/src/cms-composition/` and are frozen unless your
  brief says otherwise. SQL must produce exactly what those schemas accept.
- RED first: existing RED suites are the spec's executable form. Where a behavior has no test, write
  the failing test first and run it to see it fail for the right reason. Then GREEN with the minimal
  correct production code. Then refactor with tests green.
- Existing test oracles were independently reviewed. Change one only if it contradicts the spec;
  cite the spec line, keep the change minimal, never weaken, and list the exact diff in your report
  under `## Test corrections` for independent review.
- Follow existing SQL conventions: look at `supabase/migrations/20260927200000_cms_template_authority.sql`
  (`cms_define_template`), `20261013300800_*`/`300820_*` (governed submit) for private producer +
  `platform_api` wrapper shape, SECURITY DEFINER owner, `search_path`, idempotency reservation,
  audit/outbox, grants (`revoke all … from public, anon, authenticated`; execute to `service_role`
  only where the existing pattern does), error tokens (`P0001` + message token + DETAIL json).
- Keep each new SQL file under 300 lines; split by concern.
- If information genuinely does not exist in the spec (not "it is hard"), record a BOUNDARY in your
  report with the missing spec named, instead of inventing behavior.

## Report and checkpoints

- Your report path is in your brief. Write a first checkpoint within your first few steps and update
  it after every run and every significant decision; a crash otherwise loses your work.
- Report sections: Status, Scope, Files (path, lines, SHA-256), Runs, Test corrections, Spec
  citations, Open items / BOUNDARY, Requests to root.
- Final message to root: status line (GREEN / PARTIAL / BLOCKED), report path + SHA-256, final run
  counts, ≤20-line summary, and requests to root.
