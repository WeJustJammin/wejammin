# Adjacent authoring-context contract test cap — 2026-10-20

Status: scoped source refactor independently reviewed and locally verified. No slice/phase acceptance claim. Main: `gpt-6.1-sol` / `ultra`; source execution: `Phils-Charm/deepseek-v4.1-flash` / `high`.

The existing `packages/contracts/src/cms-editorial/authoring-context.test.ts` is 541 lines, above the locked 400-line test cap. This is behavior-preserving TDD refactoring, not response-contract evolution. No runtime schema, barrel export, protected DTO, SQL, authority, assertion or acceptance criterion may change.

## Main-owned source baseline

- Fresh actual run: **25/25 passed**, zero failed/pending; native exit 0.
- Receipt `.lane-logs/s12-authoring-contract-cap-20261020-baseline.json`; SHA-256 `55f958ad5f905b7b118175c0444219093af50df24d85996375b41dc76d116d50`.
- Canonical TypeScript printer, comments removed: all five complete top-level `describe` expressions (including every matrix, test, assertion and hook), sorted/joined by newline, SHA-256 `50a23f9aa7ed2739ad0625345474db080b15afa4c9171af53df931664eeab9f1`.
- All 16 top-level variable declarations (same printer, leading export ignored), sorted/joined by newline, SHA-256 `55b8426b77a3db0d09132f7cb607e4470bbff6cdf043797079a2f99831d06f5c`.
- Both proposed new files are absent. Main's AST lookup of Slice 10 ledger citation objects found **zero** citations to the read-precedence suite being moved. Other suites remain in the original file. No citation or historical generated receipt rewrite is justified by this move.

## Exclusive source ownership after release

1. Existing `packages/contracts/src/cms-editorial/authoring-context.test.ts`: retain query, type, field and resource suites verbatim.
2. New `packages/contracts/src/cms-editorial/authoring-context-read.test.ts`: move the entire existing read-precedence `describe` block (old lines 464–541), unchanged.
3. New `packages/contracts/src/cms-editorial/authoring-context-fixtures.test-support.ts`: move all 16 existing top-level fixture declarations (old lines 11–99), with exports/import placement/formatting only. Export only names the two suites need. No fixture mutation, rename, new cast/factory/type, timer change, extra wrapper or public export.

Main exclusively owns this record, READMEs, tracking, runtime tests and independent review. Agent must not touch any other file, including the ownership manifest, schemas, `index.ts`, ledger or generated receipts. All production contracts and other checkouts are frozen. The in-flight broader conflict-loader run must finish before release, so its source snapshot stays stable.

## Required independent gate

After source freeze, main must prove identical combined canonical suite/declaration hashes and identical full expanded test names/statuses (file path differs only for the moved suite); confirm size limits, then run focused and relevant regression, TypeScript, scoped lint/format and progress checks. Existing generated source hashes become stale honestly; do not refresh them without real machine output. Canonical native/database/browser/slice/phase gates remain open and confer no authority for a privileged retry.

## Independent integration review

Main parsed all three actual files with the TypeScript compiler. The combined five complete suite expressions and 16 top-level declarations reproduce both baseline SHA-256 values exactly. This covers all test bodies, parameter matrices, assertions, fixtures, types/casts and hooks, not only titles. Original file: four suites / zero declarations / 384 lines; new read test: one suite / zero declarations / 94 lines; new fixture helper: zero suites / 16 declarations / 95 lines.

The helper imports nothing, so extraction adds no dependency cycle. Thirteen externally referenced fixture names are exported; `uuid4`, `hash` and `ordinaryPolicy` remain private. The helper's only added prose is a six-line doc comment. No runtime contract or barrel imports the helper, and no ledger/receipt changed. Main updated the contract README with the test organization.

Prettier reported all four source/README paths unchanged. Fresh focused runtime: **25/25 passed**, zero failed/pending, native exit 0. Nineteen cases remain in the original file, six read-precedence cases moved to the new file. Main compared all expanded full names and statuses with the baseline: identical. Receipt `.lane-logs/s12-authoring-contract-cap-20261020-green.json`; SHA-256 `13ef3d877e44500cab0fb19b10acd5b9ba68280b75edd73d285300bfd382c3ce`.

Fresh TypeScript, zero-warning scoped ESLint, the explicit four-path format check and OpenAPI `contracts:check` all reached native exit **0**.

Final broader regression explicitly includes the new read test: **1,578/1,578 passed across 148 files**, zero failed/pending, native exit **0**. Receipt `.lane-logs/s12-authoring-contract-cap-20261020-regression.json`; SHA-256 `93f0dd5d5c2dbab22893ab8ccfe1c5bd050babd22866f30b1bc11c7df984bc7e`. Test count is unchanged from the pre-extraction broader run; file count increases by one as intended.

Fresh progress consistency after the final tracking append exited **0** (`Progress files consistent.`), and main read the updated tracking back. No acceptance checkbox, denominator, completion signature, generated receipt or privileged permission changed. Latest weekly usage is **6%**, below the 98% handoff trigger.

## Remaining scope, not waived

This resolved only the identified adjacent test caps. At this test-only checkpoint, runtime `authoring-context.ts` was **171 lines**, over the separate locked **150-line schema cap**, and intentionally frozen. A subsequent separately baselined continuation split it into **139/46-line** schema modules, preserving the complete declaration hash, public export/singleton identity and exact generated OpenAPI bytes. Its actual RED/GREEN, expanded regression and limitations are in `2026-10-20-s12-authoring-schema-cap.md`. No claim of global size compliance follows from either scoped refactor.

Conflict taxonomy replacement still lacks a proven locale source for every immutable conflict preimage. The authored `typeKey` SQL projection/pgTAP suite remains UNRUN. Historical ledger receipts still need real regeneration, and native preflight, canonical `db:verify` → `validate`, browser/hosted/external evidence, slice and final phase gates remain open. The consumed sudo approval does not authorize retry or pkexec.
