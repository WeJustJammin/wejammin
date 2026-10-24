# Lane claude_s12_apispec_fixes report

## Status
GREEN (edits done; awaiting root's apispec run). No DB/docker/supabase command and no apispec was run by this lane.
HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. Backup tar of every pre-edit file:
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_apispec_fixes/orig-20261023T071744Z.tar`.

## Scope
- A: DEC-194 ALT-only suite removed from the canonical glob, own config + script + docs.
- D: `capability_missing` expectations and per-test session restoration.

## Files (before -> after SHA-256)
| File | Before | After |
|---|---|---|
| tests/postgrest/phase-02-slice-12-dec194-isolation.apispec.ts -> `.alt-apispec.ts` (rename only, bytes identical) | b7a38c40907d8231af4e44c91a78bde95e02617e0d0034571fe493bd97310737 | b7a38c40907d8231af4e44c91a78bde95e02617e0d0034571fe493bd97310737 |
| tests/postgrest/phase-02-slice-12-template-version.apispec.ts | ff66d26699a9411573a8bddbce5f9db0f6136cbe7b829ce2bf9ff54cf02d2eba | e37934811a7061efb7f42591b8a6b2d5ab45114eb008cf29916513bf33666486 |
| tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts (before already carried another lane's uncommitted outbox-query edit) | a8544052e6d3ab185478726dba9d16844472e36f67065f1e9f2c95dc765ea83e | 4b2ec6bcd365421a0aa01c23871c12e305306776507bdcbb01f1bd70c327c661 |
| tests/postgrest/README.md | 5bc39d356ffb415c7425c7edc5e8b6561bf43769dd1529f80410b660576be8ad | 4e50bebef2c690d932599da159c80ebad69ee2f9e4ea8770b6cb39a2b25bab2b |
| tests/postgrest/support/README.md | 1c540ce61554846730b98fb936f3f114a45cd386d1d61f471cbde5ad9a49d962 | e91d399e9d4d7bb76eef605ea220a8c668c1eda6628cdb3073c3337d8a316153 |
| package.json (one script added) | b00aa036749744efa08f3a553c0d63587fe9a8aa5c5cc6c8ada9dddff38ce7de | fd179cc50493900f29e52154a4c88f0158a68b86ded44c82ea456918347c8e04 |
| vitest.postgrest-alt.config.ts (new) | absent | 20d7f47f2414741f84fbfd4f5b8f167b27a3582ff7f4a628f287a9bfcbd11ea1 |
| vitest.postgrest.config.ts | db3cb0e2...fa8d81 | unchanged |

## A. ALT-only suite
- Renamed to `*.alt-apispec.ts` (`-apispec.ts` does not match `*.apispec.ts`), in place so relative `./support/...` imports are untouched. Proof: `vitest list --filesOnly` on `vitest.postgrest.config.ts` lists 0 dec194 files; on `vitest.postgrest-alt.config.ts` lists exactly the renamed file.
- `vitest.postgrest-alt.config.ts` includes `tests/postgrest/**/*.alt-apispec.ts` (same maxWorkers 1 and timeouts as canonical). Script `db:api-test:dec194-alt` = `vitest run --config vitest.postgrest-alt.config.ts`. `db:verify` / `infra/verify-database.sh` unchanged.
- Documented: new section "ALT-only suites" in `tests/postgrest/README.md` (prerequisites: ALT stack `wejammin_ev`, release vars `S12_DEC194_RPC_{ROOT,FIXTURE,CLEANUP}_RELEASE=2026-10-16-local-alt`, optional `S12_DEC194_RPC_NON_RC_EXPECTED`) and the support modules in `tests/postgrest/support/README.md`.
- Runbook `docs/runbooks/platform/cms-taxonomy-merge-converge.md`: grep shows it never named the old path or the ALT suite; not edited.
- References to the old path found by repo-wide grep (excluding node_modules/.git/.lane-logs): only historical records, left untouched: `.memory/pipeline/progress/slices/phase-02-slice-12.md` (lines 3504, 3790 `files:` lists), `docs/handoffs/2026-10-14-claude-s12/lane-codex-dec194-*.md`, `docs/handoffs/2026-10-22-claude-s12/{review-v1,review-r2,lane-fix-dec194}-report.md`, `docs/handoffs/2026-10-22-claude-phase2-s12-inventory.json`. No live reference in race modules, READMEs, `docs/runbooks` or `tests/contracts` ledgers. Root may want to update the two `files:` lines in the slice tracker (not claimed by this lane).
- Other ALT-only files in `tests/postgrest/*.apispec.ts`: none. `grep ALT|S12_` finds env asserts only in `support/phase-02-slice-12-dec194-alt-{environment,stack}.ts`, imported only by the renamed suite, `-isolation-worker.ts` and `-unit-test-support.ts` (unit tests `*.test.ts`, collected by the base config, not apispec). `phase-02-slice-12-dec194-probe-ownership.pg.mjs` is not an apispec (not collected).

## D. Typed refusal token and cascade
- `phase-02-slice-12-template-version.apispec.ts` (AC-006) and `phase-02-slice-12-locale-variant.apispec.ts` (AC-055): `details.reasonCode` expectation `CAPABILITY_REQUIRED` -> `capability_missing`, with a comment citing BE03c line 1457 ("Slice 12 typed refusals"; Worker routes: template-version-routes.ts:144, locale-routes.ts:163).
- Other `CAPABILITY_REQUIRED` hits on Slice 12 operations were all NEGATIVE assertions that the pre-contract token is dropped/rejected (correct, left alone): apps/worker/src/cms-composition/{taxonomy-term-details,related-content-read-refusals,locale-read-refusals,pattern-update-details,pattern-instance-reasons,capability-missing-refusals}.test.ts, apps/worker/src/cms-composition-production-pattern-update-failure.test.ts, apps/web/src/server/{cms-composition-platform-mutation-error-relay,cms-composition-platform-capability-missing,cms-composition-platform-pattern-reasons,cms-taxonomy-platform-errors}.test.ts, packages/contracts/src/cms-composition/refusals.test.ts. Remaining hits are Slice 09/10 or generic BE00 operations (not Slice 12). No other `tests/postgrest/*slice-12*` file expects the token; `template-reads.apispec.ts` 403s assert status/code only.
- Cascade: added file-level `afterEach(() => stack.as(<default caller>))` in both files (template-version: `designerSession(ownerA)`; locale-variant: `session(world)`), so a failed assertion in any test that switched session (AC-006, AC-055, owner-B tests) cannot change the next test's caller. Removed the now-redundant last-line `stack.as(designerSession(ownerA))` in the AC-006 pair of tests; mid-test restores left (semantic). AC-055 already restores its grant in try/finally.

## Test corrections (for independent review)
Only the two token expectations above; each cites BE03c line 1457; no assertion weakened (still `toMatchObject` on `code` and exact reasonCode).

## Checks run
prettier --check (all touched files) pass; eslint --max-warnings=0 on both apispecs, the renamed suite and the new config pass; `vitest list --filesOnly` glob proof above. No tsc project covers `tests/`.

## Root verification commands
- D: `pnpm exec vitest run --config vitest.postgrest.config.ts tests/postgrest/phase-02-slice-12-template-version.apispec.ts tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts`
- A (canonical must not collect it): `pnpm exec vitest list --config vitest.postgrest.config.ts --filesOnly | grep -c dec194` expects `0`. ALT run (only with ALT stack + release vars): `pnpm db:api-test:dec194-alt`.

## Requests to root
- Run the D command on the canonical stack after reset; then the full `pnpm db:api-test`.
- Optionally update the two `files:` lines in `.memory/pipeline/progress/slices/phase-02-slice-12.md` to the new `.alt-apispec.ts` name.
