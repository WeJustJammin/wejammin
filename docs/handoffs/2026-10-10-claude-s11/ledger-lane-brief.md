# Slice 11 evidence-ledger lane brief (2026-10-10)

You are one of four independent evidence lanes filling the Slice 11 identity-receipt evidence
ledger. Your job is discovery and honest classification, not implementation. The orchestrator
uses your gap report to decide what code and tests still have to be written.

## Where you work

- Worktree: `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`.
- Every shell command you run MUST start with `cd /home/rob/.codex/worktrees/phase2-slice11/WeJammin &&`.
  Your shell's working directory resets to a different checkout between calls; a command without
  that prefix runs in the wrong repository.
- First command: `cd /home/rob/.codex/worktrees/phase2-slice11/WeJammin && git rev-parse --show-toplevel && git rev-parse HEAD`
  (expect HEAD `618ec5c16585d295263770a9d79138f36bfa10dc`). Quote it in your final report.
- NEVER touch the primary checkout `/home/rob/Projects/WeJammin`.

## Hard limits

- Write ONLY two files: your ledger fragment and your gap report (paths in your assignment).
- Do NOT run tests, `pnpm`, `vitest`, `playwright`, `node` scripts, `supabase`, `psql`, `docker`, or
  anything that touches the database. A shared database is in use by a full verification run.
- Do NOT run git commands that change state (no add/commit/stash/checkout/reset/restore).
- Do NOT edit tests, sources, specs, trackers or other lanes' fragments.
- Reading any file and using grep/find/sed/cat is fine.

## What to read first

1. `scripts/evidence/README.md` — the ledger rules the guard enforces (clauses must tile the
   criterion text verbatim and in order; citation identity formats; status semantics).
2. Two or three filled entries in `tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts`
   as worked examples (vitest, pgtap incl. `.sqlinc` files, playwright with `project`, race).
3. The Slice 11 tracker `.memory/pipeline/progress/slices/phase-02-slice-11.md` (criterion lines
   with their spec citations) and, for AC-049 onward, the depth-floor derivation
   `.memory/pipeline/progress/verification/2026-10-08-slice-11-depth-floor.md`.
4. The locked specs each criterion cites: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`
   (BE03b), `.memory/wiki/specs/ia/03-cms-content-modeling.md` (IA03),
   `.memory/wiki/specs/fe/03-cms-content-modeling.md` (FE03), BE05c/BE00 where cited.
   Binding rulings: `.memory/wiki/decisions.md` DEC-149 through DEC-163.
5. Optional context (historical, do not trust claims without checking code):
   `docs/handoffs/2026-10-09-phase2-claude-handoff.md` (Codex notes; terse).

## Where the tests are

- pgTAP: `supabase/tests/phase_02_slice_11_*.sql` plus included `.sqlinc` files in
  `supabase/tests/phase_02_slice_11_*/` directories (cite the file that holds the description).
- Real-stack API (Worker → Kong/PostgREST → DB): `tests/postgrest/phase-02-slice-11-*.apispec.ts`,
  `tests/postgrest/cms-*.apispec.ts`.
- Worker/web/contract unit tests: `apps/worker/src/**/*.test.ts`, `apps/web/src/**/*.test.ts(x)`,
  `packages/contracts/src/**/*.test.ts`, `tests/contracts/phase-02-slice-11-*.test.ts`.
- Browser: `tests/e2e/phase-02-slice-11-*.spec.ts` (Playwright; find the project name in
  `playwright.config.ts`).
- Races: `infra/database-races/` and `infra/run-database-race-runners.mjs`.

Citation identity: vitest = file + full title path (describe names and test name joined by single
spaces, exactly as vitest prints it); playwright = file + `Describe > test` title + `project`;
pgtap = file + the assertion description text with whitespace collapsed; race = file + exact
`ok - ...` text. Titles must be copied exactly from the source; never invent a title.

## How to judge proof

Cite a test for a clause only when its assertions actually produce the condition and check the
outcome the clause names. These do NOT prove a clause:

- a `[P2-S11-AC-NNN]` marker in a title by itself (Slice 09 markers over-claimed about 38%);
- a test that stubs the port or dependency to return the very error being "proven";
- a mock or fake API when the clause is about real composition (Worker + PostgREST + database);
- shape-only assertions (`toBeDefined`, schema parse) when the clause names behavior;
- a sibling test that proves an adjacent clause.

When unsure, choose `partial` and name the unproven clause precisely. Over-claiming is the
failure mode this ledger exists to stop; an honest `partial` is a good result.

Status rules: `verified` = every clause cited, empty limitation; `partial` = some clauses cited, a
limitation naming each uncited clause; `unverified` = no clauses cited, limitation of at least 20
characters saying why. Do not use `contract-only` (no Slice 11 policy range exists). Never edit the
`text` field.

## Gap report format

For every criterion that is not `verified`, write one section:

```
### P2-S11-AC-NNN — <status>
- Unproven clause(s): "<verbatim clause>" ...
- Implementation: present at <path:line> | appears missing (searched: ...)
- Missing evidence: <exact test to add or extend: tool, file, what it must assert>
- Size: S (<1h) | M (1-4h) | L (>4h)
```

End the report with: (a) counts verified/partial/unverified, (b) criteria whose implementation
appears entirely missing, (c) cited tests you have reason to believe currently fail or are
skipped (e.g. `it.skip`, known-RED notes), with file paths.

## Final message to the orchestrator

At most 400 words: HEAD you verified, the two paths you wrote, the counts, and the five most
important gaps. Your files are the deliverable; write them before you report.
