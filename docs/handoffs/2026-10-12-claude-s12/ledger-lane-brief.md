# Slice 12 evidence-ledger lane brief (2026-10-13)

You are one of four independent evidence lanes filling the Slice 12 identity-receipt evidence
ledger. Your job is discovery and honest classification, not implementation. The orchestrator
uses your gap report to decide what code and tests still have to be written.

## Where you work

- Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`.
- Every shell command you run MUST start with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`.
  Your shell's working directory resets to a different checkout between calls; a command without
  that prefix runs in the wrong repository.
- First command: `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && git rev-parse --show-toplevel && git rev-parse HEAD`
  (expect HEAD `b57a7483` or later on claude/phase2-slice12). Quote it in your final report.
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
2. Two or three filled entries in `tests/contracts/phase-02-slice-11-evidence-ledger-001-034.ts` and `tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts`
   as worked examples (vitest, pgtap incl. `.sqlinc` files, playwright with `project`, race).
3. The Slice 12 tracker `.memory/pipeline/progress/slices/phase-02-slice-12.md` (criterion lines
   with their spec citations) and, for AC-049 onward, the depth-floor derivation
   `.memory/pipeline/progress/verification/2026-10-11-slice-12-depth-floor.md` (including its "Application record").
4. The locked specs each criterion cites: `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`
   (BE03c; BE03b `03b-editorial-workflow-publication.md` and BE03a where cited), `.memory/wiki/specs/ia/03-cms-content-modeling.md` (IA03),
   `.memory/wiki/specs/fe/03-cms-content-modeling.md` (FE03), BE05c/BE00 where cited.
   Binding rulings: `.memory/wiki/decisions.md` DEC-121..123, DEC-135..141, DEC-148..184.
5. Optional context (historical, do not trust claims without checking code):
   `docs/handoffs/2026-10-09-phase2-claude-handoff.md` (Codex notes; terse).

## Where the tests are

- pgTAP: `supabase/tests/phase_02_slice_12_*.sql` plus included `.sqlinc` files in
  `supabase/tests/phase_02_slice_12_*/` directories (cite the file that holds the description).
- Real-stack API (Worker → Kong/PostgREST → DB): `tests/postgrest/phase-02-slice-12-*.apispec.ts`,
  `tests/postgrest/cms-*.apispec.ts`.
- Worker/web/contract unit tests: `apps/worker/src/**/*.test.ts`, `apps/web/src/**/*.test.ts(x)`,
  `packages/contracts/src/**/*.test.ts`, `tests/contracts/phase-02-slice-12-*.test.ts`.
- Browser: `tests/e2e/phase-02-slice-12-*.spec.ts` (Playwright; find the project name in
  `playwright.config.ts`).
- Races: `infra/database-races/` and `infra/run-database-race-runners.mjs`.
- Slice 12 code predates this slice in places: Slice 09 shipped the composition, template, taxonomy and locale tables and several CMS-03C routes. Search beyond the slice-12 file names: `supabase/tests/*cms*`, `supabase/tests/phase_02_slice_09*`, `apps/worker/src/cms-composition*`, `apps/web/src/components/cms-composition/`, `packages/contracts/src/cms-composition/`, and grep for each operation id (`CMS-03C-NN`) and RPC name.
- Most of the 232 rows added on 2026-10-12 (AC054-AC285) describe behaviour that is not built yet. Say so plainly: `unverified` with the missing implementation named is the expected, honest result for them.

Citation identity: vitest = file + full title path (describe names and test name joined by single
spaces, exactly as vitest prints it); playwright = file + `Describe > test` title + `project`;
pgtap = file + the assertion description text with whitespace collapsed; race = file + exact
`ok - ...` text. Titles must be copied exactly from the source; never invent a title.

## How to judge proof

Cite a test for a clause only when its assertions actually produce the condition and check the
outcome the clause names. These do NOT prove a clause:

- a `[P2-S12-AC-NNN]` marker in a title by itself (Slice 09 markers over-claimed about 38%);
- a test that stubs the port or dependency to return the very error being "proven";
- a mock or fake API when the clause is about real composition (Worker + PostgREST + database);
- shape-only assertions (`toBeDefined`, schema parse) when the clause names behavior;
- a sibling test that proves an adjacent clause.

When unsure, choose `partial` and name the unproven clause precisely. Over-claiming is the
failure mode this ledger exists to stop; an honest `partial` is a good result.

Status rules: `verified` = every clause cited, empty limitation; `partial` = some clauses cited, a
limitation naming each uncited clause; `unverified` = no clauses cited, limitation of at least 20
characters saying why. Do not use `contract-only``contract-only` (no Slice 12 policy range exists). Never edit the
`text` field.

## Gap report format

For every criterion that is not `verified`, write one section:

```
### P2-S12-AC-NNN — <status>
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
