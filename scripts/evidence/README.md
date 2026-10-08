# Evidence scripts

Two receipt designs live here. **Slice 09** attributes tests to criteria by a
`[P2-S09-AC-NNN]` marker in the test title. **Slice 10 and later** never read a
marker: a per-criterion ledger names exact tests, and a receipt is keyed by the test's
identity. The second design exists because markers over-claimed (about a third of the
Slice 09 criteria), per-file totals were copied onto criteria, skipped and failed
cited tests were hidden, and criteria were reworded to fit the tests that existed.

## Contents

- `receipts-lib.mjs` — pure parsers (vitest and Playwright JSON, assertion-level pgTAP
  TAP, race-runner output), the Slice 09 receipt builder and `evaluateReceipts`. The
  marker grammar is `P2-S(\d\d)-AC-(\d{3,4})`; `markersIn`, `buildReceipts` and
  `parsePgtapTap` take the slice (default `09`, output unchanged).
- `collect-receipts.mjs` — the CLI behind `pnpm evidence:collect`. `--slice NN` picks the
  output file `tests/contracts/phase-02-slice-NN-receipts.generated.jsonl`.
- `identity-receipts-lib.mjs` — receipts keyed by test identity (below).
- `ledger-lib.mjs` — tracker parser, ledger loader, `citationsOf`, `proposeClauses`.
- `ledger-guard-lib.mjs` — `evaluateLedger`, every rule the guard enforces.
- `new-ledger.mjs` — prints an all-unverified ledger skeleton from a slice tracker.
- `list-test-identities.mjs` — lists the exact identity of every test in a run, or
  ready-to-paste citation literals.
- `run-slice-evidence.mjs` (+ `run-plan-lib.mjs`, `run-execute-lib.mjs`) — runs every
  test a ledger cites, then writes the receipts.
- `refreeze-ledger-sources.mjs` — refreshes the hashes the Slice 09 depth-floor ledger
  freezes for its sources.

## Slice 10 and later: the ledger

`tests/contracts/phase-02-slice-NN-evidence-ledger.ts` exports `SNN_EVIDENCE_LEDGER`, one
entry per criterion (types in `tests/contracts/phase-02-evidence-ledger.ts`):

```ts
{
  criterion: 'P2-S10-AC-005',
  text: '<the tracker claim, byte for byte>',
  clauses: [{ text: '<verbatim part of text>', citations: [
    { tool: 'vitest', file: 'apps/worker/src/x.test.ts', title: 'suite name test name' },
  ] }],
  status: 'verified' | 'partial' | 'unverified' | 'contract-only',
  limitation: '',
}
```

A citation names ONE test: vitest and Playwright by file + full title path (Playwright
also `project`), pgTAP by the file that holds the description + the exact
`ok N - description` text with whitespace collapsed, a race runner by file + the exact
`ok - ...` text. `tests/contracts/phase-02-slice-NN-evidence-guard.test.ts` calls
`defineSliceEvidenceGuard` (`tests/contracts/phase-02-evidence-guard-suite.ts`).

### What the guard rejects (`ledger-guard-lib.mjs`)

- **Ledger vs tracker**: a missing, extra, repeated or reordered criterion; a criterion
  text that differs from the tracker claim by one character (ticking the checkbox or
  editing a source link never changes the claim); a tracker header count that disagrees.
- **Clauses**: each is a non-empty verbatim, in-order, non-overlapping part of the text
  and together they tile it (only separators and the words and/or may sit between them),
  so an entry cannot prove less than it claims or reword a clause to fit a test.
- **Status**: `verified` = every clause cited and no limitation; `partial` = some cited
  and some not, with a limitation; `unverified` = nothing cited, with a limitation of at
  least 20 characters (not n/a, TODO, tbd); `contract-only` = only inside the policy range
  (Slice 10: AC-038..AC-048), only where the tracker text itself says "contract-only"
  (AC-040 and AC-042 do not say it, so they cannot be contract-only until the tracker
  text changes or the policy sets `contractOnlyNeedsTrackerText: false`), every clause
  cited, limitation required, and never counted as verified.
- **Citations**: exact keys; repository-relative POSIX path of a file that exists whose kind
  matches the tool; a trimmed single-line title that is never a file-level verdict (a path,
  `x.sql .... ok`, `Result: PASS`, `All tests successful.`, `Files=...`); `project` for
  Playwright and nowhere else; no duplicate inside a clause.
- **Receipts**: every cited identity needs a receipt, and ALL receipts of it must be
  `passed` (skipped, todo, flaky, failed and stale are named); the receipt's `fileSha256`
  must equal the file now, and for pgTAP its `closureSha256` must equal the hash over every
  file the entrypoint includes; a file-level row, an ambiguous identity (`occurrences` > 1:
  a pgTAP description or test title used twice in one file) and any receipt carrying a
  `criterion` field (a marker-mode receipt) are rejected.
- **Cited files**: any non-passing or duplicated test of a cited file that no citation
  names is a problem; a cited file may not hide a skip, todo, failure or duplicate.
- **Sole proof**: a citation that is the ONLY citation of a clause counts that criterion;
  more than `maxSoleProof` (default 3) distinct criteria is a problem, so a generic
  "everything works" test cannot carry many criteria.

The guard reports the counts (`verified`, `partial`, `contract-only`, `unverified`) as a
vitest annotation (use `--reporter=verbose`).

## Filling a ledger

1. `node scripts/evidence/new-ledger.mjs --slice NN [--clauses] > tests/contracts/phase-02-slice-NN-evidence-ledger.ts`
   then `pnpm exec prettier --write` it (done for Slice 10; `--clauses` pre-splits each
   claim into verbatim uncited clauses). Add `phase-02-slice-NN-evidence-guard.test.ts`
   (copy the Slice 10 one: ledger, contract-only range, criteria count).
2. Pick the test that proves a clause and copy its identity, do not type it:
   `node scripts/evidence/list-test-identities.mjs --vitest report.json --file x.test.ts`
   (add `--citations` for paste-ready literals, `--status skipped` to find hidden skips).
   Prefer a top-level pgTAP `.sql` file to an included `.sqlinc` (see below).
3. Set the clauses, `status` and `limitation`. Never change `text`.
4. `node scripts/evidence/run-slice-evidence.mjs --slice NN`, then
   `pnpm exec vitest run tests/contracts/phase-02-slice-NN-evidence-guard.test.ts --reporter=verbose`.
   Commit the ledger, the guard and `phase-02-slice-NN-receipts.generated.jsonl` together.

## Running the cited tests

`run-slice-evidence.mjs --slice NN` plans from the ledger (`--dry-run` prints the plan),
runs the plain steps (vitest `*.test.ts(x)`, functional Playwright), then the steps that
need the shared local Supabase stack in ONE child process under
`flock /tmp/wejammin-supabase-ci.lock` (override with `--lock-file` or
`WEJAMMIN_SUPABASE_CI_LOCK`; `--lock-wait` seconds, default 3600): `pnpm db:reset` before
each step and a closing one, pgTAP through `infra/run-pgtap-verbose.mjs`, vitest
`*.apispec.ts` (postgrest config) and `*.dbspec.ts` (db-integration config), real-route
Playwright, and each cited race runner. A cited `.sqlinc` runs every `.sql` that includes
it (a widely included fixture file therefore runs many entrypoints). Playwright specs are
offered to `playwright.config.ts` and `playwright.s09-real.config.ts`
(`--playwright-config` overrides; a config that does not select a spec reports "No tests
found", not a failure; the staging config is never run). Outputs and logs go to
`test-results/evidence/`; then `collect-receipts.mjs --slice NN` writes the receipts.
`--only vitest,pgtap,playwright,race` limits tools. A failing run still writes receipts.
Exit 0 all good, 1 a step failed or a cited test has no receipt, 2 usage/ledger/plan
problem, 3 lock not taken.

## Receipts by identity

`collect-receipts.mjs --slice NN` uses identity mode when the slice has a ledger (and
slice is not 09; `--markers` forces marker mode). A row is
`{tool, granularity, file, title, [project], [entrypoint], status, [occurrences], fileSha256, [closureSha256]}`:
a receipt for every cited test, plus every non-passing or duplicated test of a cited
file; uncited passing tests produce none. An empty ledger writes an empty file. Identity
merging has no skip allowlist: a skip in one invocation is never replaced by a pass in
another. pgTAP: the owner file is the one whose source holds the description as a whole
SQL string literal (the entrypoint when none does), a literal in two files of one
entrypoint is ambiguous, and a SKIP or TODO with no description makes every file of the
entrypoint skipped.

## Slice 09 (marker receipts, unchanged)

One receipt per criterion marker and executed test, with the SHA-256 of the test file the
report describes. Inputs, all from real runs:

- `--vitest report.json` (repeatable): `vitest run --reporter=json`. The dedicated
  gate `pnpm test:evidence:s09` writes `test-results/vitest-evidence-s09.json`; pass
  it too, because the live-execution test of AC-269 is skipped everywhere else.
- `--pgtap tap.out`: verbose TAP from `pnpm db:test:tap` (one receipt per assertion).
- `--playwright report.json` (repeatable): the JSON reporter of each Playwright config.
- `--races db-races.out`: `pnpm db:races` output.

`evaluateReceipts` rejects, for every criterion and cited test file: a missing
receipt, a stale one (the file changed after the run), a failed or flaky one, a
file-level pgTAP verdict, and any skipped, pending, todo or fixme test whatever tool
ran it, even beside passing siblings. A test one invocation skipped is counted once
as its executed result only when a DIFFERENT invocation executed that same test
(`mergeReports`); a test nothing executed stays skipped and fails the guard.

## Extension

Add a parser for a new tool in `receipts-lib.mjs` with a regression test in
`tests/contracts/phase-02-slice-09-receipts-collector.test.ts` (and the skip
behaviour in `phase-02-slice-09-receipts-skipped.test.ts`), then wire its output into
`collect-receipts.mjs`. A new guard rule goes in `ledger-guard-lib.mjs` with an
adversarial fixture in `tests/contracts/phase-02-evidence-guard-*-rules.test.ts`.

## Related

- `tests/contracts/phase-02-slice-09-receipts-guard.test.ts` — the Slice 09 guard that
  reads the generated file in `pnpm validate`.
- `tests/contracts/phase-02-slice-10-evidence-guard.test.ts` — the Slice 10 guard.
- `infra/run-pgtap-verbose.mjs` and `infra/run-database-race-runners.mjs` — the
  database runners whose output is collected.
