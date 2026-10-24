# Lane `claude_s12_recite_apply` — apply the refuted re-citation proposals to the Slice 12 ledger (delegated by root)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Root DELEGATES to you the Slice 12
ledger files `tests/contracts/phase-02-slice-12-evidence-ledger-*.ts` (normally root-reserved) and the description-only
renames named below. Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&` (HEAD
`fc62deef` or a later root commit). Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not
word-split: multi-file commands go in a bash script. `/bin/ls`, never bare `ls`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-recite-apply-report.md` (write it with a Bash heredoc if Write refuses).

## Inputs (all under `docs/handoffs/2026-10-22-claude-s12/`)

- `recite/{a,b,c,d}-proposals.json` and the lane reports `lane-recite-{a,b,c,d}-report.md`.
- `recite/{a,b,c,d}-refutation.json` and `review-refute-{a,b,c,d}-report.md` — read every report's "Requests to root" /
  hazards: they are your apply rules.
- Root decisions: `.memory/raw/events/2026-10-24.jsonl` record `dec-226` (evidence policy: (1) a tier label never proves
  a p95; (2) "every other role" needs a proacl assertion; (3) "consumed at /app/…" needs page-level behaviour, never
  source text; (4) a stubbed-token Worker test counts only if the DB raises that token on that operation; (5) a computed
  pgTAP description cites the owning entrypoint `.sql`).
- Guard rules: `scripts/evidence/README.md`, `scripts/evidence/ledger-guard-lib.mjs`, types `tests/contracts/phase-02-evidence-ledger.ts`.

## Rules

1. Write ONE deterministic script `docs/handoffs/2026-10-22-claude-s12/recite/apply.mjs` that reads the current ledgers,
   proposals and refutations and writes the new ledgers (then `pnpm exec prettier --write` them). No hand edits of
   citations: every change comes from the script, so a rerun reproduces it.
2. Per citation: KEEP → add; FIX → add the refutation's `fix` (never the original); DROP → omit; an existing citation
   the refutation DROPs or FIXes is changed likewise. `missedTests` of the refutations → add, after your script verifies
   the identity (rule 5). AC-039 `heldBackAdd` → never apply.
3. Per clause structure: a split or removal the refutation marks OK → apply; REJECT → apply the refutation's corrected
   split when it gives one (`fix` / recommended split), else keep the original clause. The refutation's recommended NEW
   splits (e.g. AC-084, AC-108, AC-240, AC-241, AC-286, and the 21 of review c) → apply. Every criterion's clauses must
   tile its `text` exactly (the guard checks). Never change a criterion `text`.
4. Status and limitation are COMPUTED from the final citations: every clause cited → `verified`, limitation `''`; some →
   `partial`; none → `unverified`. For partial/unverified write a limitation (≥ 20 characters, no TODO/tbd/n/a) that names
   each uncited clause and why it is unproven, from the refutation's `missedGaps`/`statusNote` and the lane gap text —
   accurate to the FINAL citations (remove any statement a refutation found false, e.g. AC-065, AC-069, AC-075, AC-207).
5. Identity verification in the script, for every citation in the new ledgers (not only new ones):
   - vitest: exact `fullName`, status `passed`, occurring once in its file, in
     `.lane-logs/canonical/s09-evidence-20261024T020357Z/pass2/vitest-all.json` (the newest full run, 2026-10-24 06:03Z);
     `*.apispec.ts` citations are run by the PostgREST config, so check them against the source instead and list them.
   - pgTAP: the description must occur EXACTLY ONCE (whitespace-collapsed) in
     `.lane-logs/canonical/s09-evidence-20261024T020357Z/db-test.tap` (the full verbose `pnpm db:test:tap` of
     2026-10-24 02:04Z) with `ok`, and `file` must be the file that owns it (an entrypoint `.sql` for a computed
     description; the `.sqlinc` for a literal one — follow the README rule and the existing ledger precedent). Use
     `node scripts/evidence/list-test-identities.mjs --pgtap <that tap> --file <sub>` to see owner files.
   - playwright and race: from the source; list them for root.
   Print counts per tool: verified / missing / ambiguous. A citation that fails verification is dropped and its clause
   recomputed; list every such drop in the report.
6. Duplicate descriptions: rename (description text only, append a short distinguishing phrase in the same brackets
   style, e.g. `… stores status 200 for the retire [P2-S12-AC-086]`) one member of every duplicated pgTAP description
   pair inside any pgTAP file the new ledger cites — at least `governed_activation/095-retire.sqlinc:153,165` (twins at
   `030-activate.sqlinc:48,55`) and the six siblings refute-a lists. Grep the TAP for every duplicate inside each cited
   entrypoint and fix all of them. Tar-backup each edited file first; list old → new text in the report. These are
   test-description edits only: no assertion, setup or SQL logic change.
7. Simulate the guard in memory with synthetic PASSING receipts for every cited identity (as refute-b's `apply_all.mjs`
   in `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_refute_b/`
   does) using the real `evaluateLedger`: the result must have 0 problems. Report the counts verified / partial /
   unverified of 296.

## Runs

No supabase, docker, db, race modules or Playwright. Vitest only for `tests/contracts/phase-02-slice-12-evidence-ledger*`
tiling/contract tests if they exist (the evidence guard itself will fail until root regenerates receipts — expected;
report its problems by class). `pnpm exec tsc --build --pretty false tsconfig.json` and prettier on touched files.

## Claim

`tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`, `recite/apply.mjs` (+ any helper beside it), the pgTAP files you
rename descriptions in (named in the report before editing). Never edit receipts, trackers, specs or product code.
Live: coverage lanes 1 and 2 (Worker tests/code — do not touch), root.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, the identity verification counts, the simulated
guard result and status counts, files with SHA-256, the rename list, requests to root (including the apispec, race and
Playwright identities root must check with the real runner).
