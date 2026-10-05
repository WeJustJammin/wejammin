# Evidence scripts

## Contents

- `receipts-lib.mjs` — pure parsers and the receipts guard for Slice 09: vitest and
  Playwright JSON, assertion-level pgTAP TAP, race-runner output, the receipt
  builder and `evaluateReceipts`.
- `collect-receipts.mjs` — the CLI behind `pnpm evidence:collect`. It reads the
  machine output of a run and writes
  `tests/contracts/phase-02-slice-09-receipts.generated.jsonl`.
- `refreeze-ledger-sources.mjs` — refreshes the content hashes the evidence ledger
  freezes for its sources.

## How receipts are made

One receipt per criterion marker and executed test, with the SHA-256 of the test file
the report describes. Inputs, all from real runs:

- `--vitest report.json` (repeatable): `vitest run --reporter=json`. The dedicated
  gate `pnpm test:evidence:s09` writes `test-results/vitest-evidence-s09.json`; pass
  it too, because the live-execution test of AC-269 is skipped everywhere else.
- `--pgtap tap.out`: verbose TAP from `pnpm db:test:tap` (one receipt per assertion).
- `--playwright report.json` (repeatable): the JSON reporter of each Playwright config.
- `--races db-races.out`: `pnpm db:races` output.

## What fails the guard

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
`collect-receipts.mjs`.

## Related

- `tests/contracts/phase-02-slice-09-receipts-guard.test.ts` — the guard that reads the
  generated file in `pnpm validate`.
- `infra/run-pgtap-verbose.mjs` and `infra/run-database-race-runners.mjs` — the
  database runners whose output is collected.
