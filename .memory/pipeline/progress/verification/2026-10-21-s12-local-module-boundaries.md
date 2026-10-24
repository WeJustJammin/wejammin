# Slice 12 local module boundaries — 2026-10-21

## Scope and current authority

The previous goal turn made actual progress: the 296-row evidence inventory and
stale unit citations were reconciled, the extended local regression passed
5,938/5,938, the current cited-unit selection passed 455/455, the two metadata
suites passed 44/44, and 213 fresh partial receipts were collected. These are
local checks, not Slice 12 or Phase 2 completion. The current cited-unit report
is `.lane-logs/s12-current-unit-20261021-reconciled/vitest.json`; its SHA-256 is
`f8d4845542bd32c7a95eab38dce745e8edb58b41deb33e0374a7908ee580a850`.

Fresh current-turn routing metadata confirms `gpt-6.1-sol` / `ultra` for Main's
planning, research, validation, independent review and integration. Execution
agents must be explicitly selected as `Phils-Charm/deepseek-v4.1-flash` / `high`.
The only writable checkout is the owned Slice 12 worktree, branch
`claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`.

The failed sudo inspection consumed its approval. This automatic goal
continuation does not approve the fixed-target pkexec alternative. No privileged
or process inspection, native/DB/browser execution, cleanup, service/stack or
provider change is released. Native PR01 and canonical `db:verify` before
`validate` remain held; all acceptance gates stay open.

## Required local defects

`.agents/rules/extensibility.md` limits test files to 400 lines and requires a
DAG with no circular imports. Engineering Standards also require zero circular
dependencies. Current cited suites exceed the line limit:

| Target                                                            | Lines | Current source SHA-256                                             |
| ----------------------------------------------------------------- | ----: | ------------------------------------------------------------------ |
| `apps/worker/src/cms-composition/template-context-routes.test.ts` |   408 | `ef8334f02fbfde1e064087b1bb6877e55261430815973e8ed43c436a58e56ce2` |
| `apps/worker/src/cms-composition/template-detail-routes.test.ts`  |   446 | `5927102da0fb609511b52fdb4939dc94a245a6feb27ed0eb547430186fd1c8ce` |

The citation primary fixture imports the moved fixture; that moved fixture
type-imports its record types from the primary fixture. This is a type-only
back edge, not a claimed runtime cycle, but the locked DAG rule has no exception.
Extract the shared types into an independent type-only file and preserve the
primary fixture's existing type exports. All fixture values/order must retain
JSON SHA-256 `f636d08c649ae75dc883549e1f5a3cb8bb7e05e12bd8881dfa12c6140313ad11`.

## Ownership and TDD order

RED owns only the new
`tests/contracts/phase-02-slice-12-local-module-boundaries.test.ts`.
It checks the two real file sizes and the actual citation-fixture import graph,
including type-only imports/exports. These structural guards earn no domain
acceptance or depth credit. Main must run and verify actual RED before GREEN.

After actual RED, disjoint source-only GREEN streams may own:

| Stream                     | Exclusive source ownership                                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context fixture extraction | `apps/worker/src/cms-composition/template-context-routes.test.ts` and new `template-context-routes.test-support.ts`                                                                                       |
| Detail fixture extraction  | `apps/worker/src/cms-composition/template-detail-routes.test.ts` and new `template-detail-routes.test-support.ts`                                                                                         |
| Citation fixture DAG       | `tests/contracts/phase-02-slice-12-unit-citation-reconciliation-fixtures.ts`, `phase-02-slice-12-unit-citation-reconciliation-moved.ts` and new `phase-02-slice-12-unit-citation-reconciliation-types.ts` |

Shared files are frozen during parallel source work: the new RED guard,
existing test bodies/matrices/hooks/assertions, all six evidence-ledger sources,
contracts, application/SQL sources, specs, manifests/configuration, receipts,
tracking documents, READMEs and the immutable inspection records. Main owns
integration notes and sequential documentation updates after source freeze.
No actor may change another actor's file. No BOUNDARY placeholder is needed.

### RED-authoring path incident

The RED execution agent reported that its first relative `apply_patch` created
the new guard in the primary checkout. It then removed only that new stray
untracked copy and retained the complete guard in the owned worktree. Main
independently verifies the stray primary path is absent and primary's status
is back to the same two preexisting untracked directories, with no tracked
changes reported. This is a boundary violation, not a claim that primary was
never touched. Existing user data was not reported deleted; the authored guard
remains recoverable in the owned checkout. Every later actor must use absolute
`apply_patch` paths rooted in the owned Slice 12 worktree, never relative paths.

The test-cap streams may move only fixture constants and harness setup into
their helpers, preserving all test bodies byte-for-byte from the first
`describe` onward. Current body SHA-256 values are:

- Context: `8c80551f775eed42e7681b665a1a3fea4c18933c26347801f897f9e9c800dbfb`.
- Detail: `c2b4f7d5220d8bb5faeae94bae3dc1c3e48cf93a73e8f77d6cf7b6ab68a982d3`.

Main independently verifies extracted declaration bodies, preserved test and
fixture identities, the acyclic graph, file limits, actual focused and current
cited-unit GREEN, fresh separate receipt collection, scoped lint/format, actual
repository type-check and post-write progress consistency. Existing receipts
remain historical after test-source hashes change; do not rewrite or credit
them as current. Canonical receipts and acceptance checkboxes are untouched.

## Actual RED and GREEN release

The exact 51-file local integration baseline exits **1**: **502 tests, 499
passed, 3 failed, 0 pending/todo**. All 499 previous cited-unit and metadata
identities remain. Only the new guard fails: 408 and 446 exceed 400, and the
two fixture modules form the expected type-only import cycle. This is actual
assertion failure, not an import/harness error. Report:
`.lane-logs/s12-local-module-boundaries-20261021-red.json`, SHA-256
`a865a7b52864a468de7f22e67975018b22bcf56f1a09c5c1cf160992784bf388`.

Main retains recoverable copies of both original test files, both citation
fixture modules and the frozen guard under
`.lane-logs/s12-local-module-boundaries-20261021.mds8AW/`. Main also captured
TypeScript-printer declaration fingerprints before any GREEN changes, with
comments removed for semantic comparison. The two existing test files and two
fixture modules all pass the baseline format check.

Only the three disjoint GREEN source streams in the ownership table are now
released. All writes must use absolute owned-worktree paths. Main retains
runtime validation, independent declaration/body/data review, receipt refresh,
documentation integration and final tracking. No test assertions or guard may
be weakened, and no full validation or acceptance is inferred.

Dispatched execution owners, all explicitly `Phils-Charm/deepseek-v4.1-flash`
with `high` effort and no history fork:

- `/root/s12_context_read_caps`: context test and context support helper only.
- `/root/s12_detail_read_caps`: detail test and detail support helper only.
- `/root/s12_citation_fixture_dag`: primary/moved citation fixtures and the new
  independent type-only helper only.

The 213-receipt baseline contains fifteen context and fourteen detail identities.
Their test-file hashes will change during extraction. All twenty-nine must be
refreshed by actual execution and a new separately collected receipt candidate;
the baseline candidate must not be rewritten or silently treated as current.

## Independent review and actual GREEN

All three execution streams are frozen. Main compared the extracted variable
declarations with the original TypeScript-printer fingerprints: all seven
Worker fixture/harness declarations and every citation-fixture runtime
declaration match. The three exported type aliases match in the independent
type module; local aliases are unchanged. Primary retains its existing type
re-exports and its one-way runtime import of moved records. The former moved
to primary type-only back edge is gone. Main corrected inaccurate explanatory
comments during review; no declaration or assertion changed.

Both test bodies retain their exact recorded SHA-256 from the first `describe`
through EOF. Context now has 364 lines and its helper 51; detail has 389 lines
and its helper 65. Citation primary/moved/types have 281/119/23 lines; the
frozen guard has 132. All meet their applicable limits. Formatting all eight
TypeScript paths makes no changes. All six ledger sources and the recoverable
original sources are unchanged.

The first GREEN launch rejected the unsupported Vitest 4.1.11 `--minWorkers`
option before tests started. Removing that option retained the same root
configuration, 51-file set, `--maxWorkers=1` and `--retry=0`; it did not narrow
the regression or alter any test.

The actual GREEN exits **0**: **502/502 tests across 51 files**, no failed,
pending, todo, duplicate or missing RED identities. The fixture JSON pin still
passes at `f636d08c649ae75dc883549e1f5a3cb8bb7e05e12bd8881dfa12c6140313ad11`.
Report: `.lane-logs/s12-local-module-boundaries-20261021-green.json`, SHA-256
`207bbeda44ebf254169ddecaa253ad3d99ec918bfacb6cff8a20d4e0dc57e498`.

The existing collector exits 0 and writes a new separate partial candidate:
`.lane-logs/s12-local-module-boundaries-20261021-receipts.partial.jsonl`, SHA-256
`cd8e2f79d35e5a4d8d40f8bfa71c43ee86d291212b7a48cc6dd1dbd2f01d7457`.
Main independently verifies **213 passing receipts**, zero duplicate, missing,
unexpected or non-passing identities, zero current test-file hash mismatches,
and every identity present in the actual GREEN. Exactly fifteen context and
fourteen detail receipt hashes refresh; all other receipt identities/hashes
match the previous candidate. The previous candidate remains byte-identical
at `882a22955feb89d18f95ed3c0b39bd2d1b068ff90593ce884b1c2923deceed11`
and is historical, not current proof for those twenty-nine changed sources.

Canonical Slice 12 receipts remain absent. Canonical Slice 10 receipts remain
unchanged at `c1a337c5cf6a05aac4b74f616935055c2e19bb06ef102e0e48e976ece2580177`.
Eight-path ESLint with zero warnings exits 0. Actual repository
`pnpm run type-check` (`tsc --build --pretty false tsconfig.json`) exits 0.
Required README updates describe the helper boundaries and explicitly deny
acceptance/depth credit. Final formatting and post-write tracking checks follow.

This closes only the three local structural defects. Slice 12 remains **0/296**,
Phase 2 **9/17**. No checkbox, denominator, depth credit, completion signature,
canonical receipt or inspection authority changes. Native PR01, canonical
`db:verify` before `validate`, browser/hosted/external and final phase gates
remain held. Weekly usage this turn is **12%**, below the 98% handoff threshold.

## Final record checks

Thirteen-path formatting and post-write progress consistency both exit 0.
Main readback confirms all eight source hashes, all six unchanged ledger
sources, the unchanged frozen guard, all seventeen slices' exact checkbox
arrays, and all three immutable inspection-record hashes. Primary again
reports only its original two untracked directories and no tracked changes.
No runtime session remains live. These checks are repeated after this closing
record write; native and full-phase gates are still not executed or passed.
