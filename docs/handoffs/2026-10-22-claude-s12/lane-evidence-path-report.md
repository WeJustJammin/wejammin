# Lane claude_s12_evidence_path report

## Status
GREEN. Bracketed citation paths accepted by the guard; Playwright filter escaping fixed; Vitest/identity pipeline verified. Vitest: `tests/contracts/phase-02-evidence-*` 10 files / 144 tests pass.

## Scope
Accept `[`/`]` (Astro dynamic routes) in evidence-ledger citation file paths and prove the receipt pipeline handles such paths. No DB runs.

## Findings (debug-by-test)
1. Guard: `CITATION_PATH` rejected `[`/`]`. RED: new test "accepts a bracketed dynamic-route segment" failed with `expected true to be false` on the "repository-relative" reason for `.../[entryId]/related.test.ts`. GREEN: regex now `/^[A-Za-z0-9_.@+/[\]-]+$/u`. A second test (16 rejected inputs: absolute, `..`, `./`, backslash, spaces, `*`, `?`, `{}`, NUL, tab, newline, DEL, NEL) passed before and after, proving nothing else loosened.
2. Pipeline, Vitest: filters are substring matches. Real run of `apps/web/src/pages/api/v1/cms/entries/[entryId]/related-content.test.ts` selected exactly that file (4 tests passed); `list-test-identities.mjs --vitest ... --citations` printed correct bracketed citation literals. No change needed. Added regression test asserting the exact path reaches the vitest args.
3. Pipeline, Playwright: DEFECT. Positional args to `playwright test` are regular expressions. Scratch proof (own scratchpad, tests/[id]/a.spec.ts + tests/i/a.spec.ts): the unescaped `tests/[id]/a.spec.ts` listed `i/a.spec.ts` (WRONG spec, real one missed); the escaped form listed `[id]/a.spec.ts`. RED: new run-plan test failed (`tests/e2e/[id]/a.spec.ts` not matched by the emitted filter). GREEN: `playwrightFilter` in `run-plan-lib.mjs` escapes `\ ^ $ * + ? ( ) [ ] { } | ` (`.` left alone so the existing oracle `tests/e2e/a.spec.ts` is unchanged). Verified the emitted `tests/\[id\]/a.spec.ts` selects the right spec in real Playwright.
4. pgTAP/race paths unaffected (`.sql`/`.sqlinc`/`.mjs` under supabase/tests, exact paths, spawnSync without a shell).
5. Slice 12 guard (`phase-02-slice-12-evidence-guard.test.ts`) now emits zero "repository-relative" problems; the remaining failures are all "no receipt" (root regenerates receipts), not mine.

## Files
| File | Lines | SHA-256 |
| --- | --- | --- |
| scripts/evidence/ledger-guard-lib.mjs | 594 | 539d1f0455b215c8664316f9d949a96c0d94f451058793532f36cb1b63701543 |
| scripts/evidence/run-plan-lib.mjs | 263 | 1df89bb40c25c4cf32b11e0d77a58de7eb25b66a35e225c38eed485716d25688 |
| scripts/evidence/README.md | 169 | 7e4501731d7ef9621bdbed90159431ceff8f1d0b6ac5b398c8f96dcd45936376 |
| tests/contracts/phase-02-evidence-guard-citation-rules.test.ts | 310 | 0aa3261989c77b4c47c85a764e16261b3a2a6b63cff7f9df1bdf05028df9ef41 |
| tests/contracts/phase-02-evidence-run-plan.test.ts | 573 | 0fb50ec01ff5d24eab97e8e91d6ef1368bdded6ec7b0037b3baa6c2ba02a8f30 |

(`run-plan-lib.mjs` and the run-plan test were not named in the brief claim but are `scripts/evidence/*.mjs` / its test; the run-plan test file is the only home of the plan oracle.)

## Runs
- citation-rules test RED 13 pass / 1 fail (right reason), GREEN 14/14.
- run-plan test RED 15 pass / 1 fail (right reason), GREEN 16/16.
- `tests/contracts/phase-02-evidence-` 10 files / 144 tests pass; prettier and eslint clean on edited files.
- Dry run: vitest on the one bracketed file + identity listing; Playwright --list on a scratch config (scratchpad `claude_s12_evidence_path/`). No receipt regeneration.

## Test corrections
None. Existing oracles unchanged (additions only).

## Spec citations
Tooling lane; brief only.

## Open items / BOUNDARY
None. Ledger AC-059's bracketed citation needs no change; its receipts need regeneration by root.

## Requests to root
- Run receipt regeneration after canonical gates; the `[entryId]` Vitest/Playwright citations should then resolve.
- Note: `run-plan-lib.mjs` and `tests/contracts/phase-02-evidence-run-plan.test.ts` were edited beyond the literal claim list (both are evidence tooling); ratify or revert.
