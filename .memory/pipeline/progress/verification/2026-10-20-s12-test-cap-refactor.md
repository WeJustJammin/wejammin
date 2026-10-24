# Slice 12 adjacent test-cap remediation — 2026-10-20

Status: scoped source refactor and local checks pass. No slice or phase acceptance claim.

## Why this is required

The locked engineering standards and extensibility rule cap test files at 400 lines. The authoring-context route test and editorial-runtime test were each 435 lines. Their behavior already passed; only fixtures/harness declarations were extracted, preserving test bodies, matrices, assertions, hooks and runtime source.

Main orchestration/research/validation/review: `gpt-6.1-sol` / `ultra`. Source execution: explicitly selected `Phils-Charm/deepseek-v4.1-flash` / `high`.

## File ownership

| Lane | Exclusive editable paths relative to the Slice 12 worktree |
| --- | --- |
| Worker harness extraction | `apps/worker/src/cms-editorial/authoring-context-routes.test.ts`; new `authoring-context-route-harness.test-support.ts` in that directory |
| Web runtime fixture extraction | `apps/web/src/components/cms-editorial/cms-editorial-runtime.test.ts`; new `cms-editorial-runtime-fixtures.test-support.ts` in that directory |
| Main only | This record, READMEs, progress/session records, final synthesis and runtime validation |

Production source, contracts, SQL, manifests, lockfiles, configs, acceptance rows and other checkouts stayed outside the two source lanes. The web lane also replaced this pre-existing main-owned record contrary to the ownership table; main recovered its original scope and baseline from the current session's actual patch and reconciled the lane report here. No authority or acceptance record changed as a result. Both source lanes are frozen.

## Fresh baseline

- Two files, **49/49 tests passed**, zero failed/pending; native exit 0.
- Receipt: `.lane-logs/s12-test-cap-refactor-20261020-baseline.json`.
- SHA-256: `b4b5ee6d5f9ff6f3ce24b55d83fc06117f07b62cf454d65ece2c2cde890e9afd`.
- Canonical TypeScript-AST direct test-call fingerprints before edits: Worker 16 call expressions, SHA-256 `aaaaae10f61e5171e1797b0364b822fb3ad6559fa5636431317d982b682795d1`; web 22, SHA-256 `cc4716d7b58b50b4b1cb1b33b746d21a945789e823e59a4b6db7f52fcfbe87e4`.
- The original regex was double-escaped for the dotted form and counted direct calls, not the web's two `it.each` call expressions. These syntax counts are not expanded Vitest cases or acceptance counts. Main separately compared the web source from `afterEach` onward with HEAD: byte-identical, including both matrices and all assertions/hooks.
- Top-level fixture/harness declarations (canonical printer, comments removed, leading export ignored): Worker 19, SHA-256 `57c631b6e88139593d96225e8588b3168cc566f02bc50b10c505de35a1377c0f`; web 10, SHA-256 `c286bb8564ee79988f2ead57194e286367d7e12ae368275acd22ac1a44cec969`.

## Independent source review

Main recomputed the direct test-call and combined old-file/new-helper declaration hashes: all match their pre-edit baselines. Worker test/helper: 303/155 lines; web test/helper: 383/73 lines before final formatting. Helpers contain no test cases. Only imports/exports and signature formatting differ; runtime source is untouched. Web `REVISION_ID` stays private to its fixture helper. Worker unused exports were not introduced.

## Evidence integrity

`scripts/evidence/ledger-guard-lib.mjs:382` rejects receipts whose `fileSha256` no longer matches the live test file. Slice 10's ledger cites the extracted Worker test. Main directly checked its 13 generated receipt rows: all 13 hashes differ from the current source SHA-256 `05a8cc50a31aae0a629f0104b863441f2f55ee53fdd254a7142172c60394a893`. No historical generated receipt, ledger claim, acceptance row or verifier was rewritten to hide that invalidation. Fresh focused receipts below are local regression evidence only. Complete machine-generated ledger receipts still need regeneration when their native/database/browser gates are available.

## Fresh validation

- Final Prettier reports all four source files unchanged; test/helper line counts remain 303/155 and 383/73. Canonical hashes above therefore remain valid after formatting. Main compared the expanded Vitest identities and statuses before/after: identical.
- Focused post-extraction run: **49/49 passed**, zero failed/pending; native exit 0. Receipt `.lane-logs/s12-test-cap-refactor-20261020-green.json`; SHA-256 `501adf5be408a4b20d79ce04d4b4a3f663cdf3b791b5f95f056689e8e57caa53`.
- Combined local regression: **1,572/1,572 across 146 files**, zero failed/pending; native exit 0. Receipt `.lane-logs/s12-test-cap-refactor-20261020-regression.json`; SHA-256 `63c3695b521c94f4c496e5661abea457bd9e6259ad6d7e26b555c8154e18fb06`.
- Fresh `tsc --build --pretty false tsconfig.json`, scoped ESLint with zero warnings, and Prettier checks of the four sources and two READMEs all exited **0**. Runtime tests used isolated pinned Node 22.23.1 / pnpm 11.24.0, one Vitest worker.
- Fresh progress consistency after the tracking append exited **0** (`Progress files consistent.`); main read the updated dispatch back. No criterion, completion signature, denominator, generated receipt, runtime contract or SQL changed in this refactor.

Full `db:verify` then `validate`, browser and final phase gates remain held at the unchanged native boundary. The pending pkexec proposal is not approved by the goal continuation.
