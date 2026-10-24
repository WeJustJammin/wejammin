# Slice 12 placement focused integration review

Root: `gpt-6.1-sol` / `ultra`. Execution: `Phils-Charm/deepseek-v4.1-flash` / `high`.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`; primary preserved.

## Reviewed boundaries

The placement DTO remains the locked `PatternPlacementResource` list, 1–512 rows.
Success carries the entry aggregate's strong ETag separately; no public aggregate
field was invented and the tag is not inferred from a placement row's version.
Only CMS-03C-02 decoded success responses use DEC-189's 1,048,576-byte ceiling.
Requests, error responses and unrelated routes retain their existing budgets.

Root independently read the Worker and Web request-binding corrections. A row
must be a normalized descendant of the exact requested slot, with a nonempty
node-key chain validated by the existing `PatternNodePathSchema`, and at most
248 UTF-8 octets. Bare slot/root paths, dot segments, doubled/trailing separators
and prefix lookalikes are refused. Public schemas remain unchanged.

## Rehashed focused evidence

- Worker: `lane-logs/s12-pattern-placement-green-focused.log`, 26 tests passing;
  SHA-256 `ac20b02bcd9bfcf541ab221d8580f16680d1fc8b6fc58a9f930725f0dbd1ed43`.
- Worker seven suites: `lane-logs/s12-pattern-placement-green-suites-v2.log`,
  108 tests passing; SHA-256
  `295033649f1aa30f513f1a2561fbb8fbef50d7f5f6ecab763f51841bb4f6afb6`.
- Web: `lane-logs/s12-web-pattern-path-binding-green.log`, three suites,
  31 tests passing; SHA-256
  `55b9c75c1c5b74b0b7c5890f8af7a471f1fecd65722e2daf7a7867d537f059b9`.
- The old single-row Web oracle genuinely failed before its list-body update:
  `lane-logs/s12-web-pattern-existing-oldcase-fail.log`, 1 failed / 4 passed;
  SHA-256 `89d44c8e24cea3e5e8d1cfbaefa30f39d6b964c375a42fbc8c97f5cf5eff5e53`.
- Preparation fallback typing repair: two suites / 22 tests, Prettier clean,
  root `tsc --build --pretty false tsconfig.json` exit 0, under Node 22.23.1 /
  pnpm 11.24.0. Root rehashed
  `lane-logs/s12-fallback-typing-focused-20261013T171801Z.log`:
  `e7aa800cb6542a374a25cb811db798cf7451f4c3a576e4d474445b0317f3d9e4`.
  Repair omits the optional `control` property when undefined; production
  semantics and the quarantined exhaustion proposal are unchanged.

## Open integration gates

The Worker route's final serialized success response still needs a behavioral
ceiling check for a schema-valid oversized injected port value; authoring is
released to its existing execution owner. The old Web test's fixture extraction
is released to bring that touched file below the 300-line limit without changing
assertions. Later receipts supersede the focused numbers above where applicable.

These fixtures do not establish the actual database producer's maximum response,
real governed pattern creation/activation, atomic placement or its races.
No Slice 12 criterion is signed off by this review. Full DB-first canonical
validation and all four-surface acceptance/tracking gates remain required.
