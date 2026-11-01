# Contract tests

## Contents

Cross-package contract, schema, fixture, and acceptance-criteria tests.

## Ownership

The contract owner maintains wire-shape and boundary assertions here.

## Extension

Add a focused test file for one contract family and keep acceptance identifiers
unique across the suite.

## Conventions

Exercise strict parsing, boundary values, unknown keys, and disclosure-safe
failures with deterministic fixtures.

## Slice 12 evidence inventory

[`phase-02-slice-12-ledger-inventory.test.ts`](phase-02-slice-12-ledger-inventory.test.ts)
checks the real ledger's complete criterion identities and exact claims against
the approved tracker. This is record fidelity only, not acceptance, clause proof,
citation freshness, depth credit, or the full Slice 12 evidence guard.

[`phase-02-slice-12-unit-citation-reconciliation.test.ts`](phase-02-slice-12-unit-citation-reconciliation.test.ts)
guards the known moved/quoted unit identities and explicit retirement of two
deleted historical tests. Its static fixtures preserve the original
criterion/clause bindings. This is a narrow bookkeeping regression, not a live
freshness check for every future citation or acceptance evidence; actual
machine-generated reports and the full evidence guard are still required.

[`phase-02-slice-12-evidence-ledger.ts`](phase-02-slice-12-evidence-ledger.ts)
aggregates the criterion fragments, including the owner-approved bootstrap rows
in `phase-02-slice-12-evidence-ledger-286-296.ts`. Uncited obligations stay
explicitly unverified; adding their records does not complete their criteria.

[`phase-02-slice-12-local-module-boundaries.test.ts`](phase-02-slice-12-local-module-boundaries.test.ts)
checks two structural properties: that
`template-context-routes.test.ts` and `template-detail-routes.test.ts` stay
within the 400-line test-file limit, and that the
`phase-02-slice-12-unit-citation-reconciliation-*` helper graph is acyclic,
counting type-only `import type` and re-export edges. This is structural
bookkeeping only, not acceptance, clause proof, depth credit, or a substitute
for the full Slice 12 evidence guard.

[`phase-02-slice-12-unit-citation-reconciliation-types.ts`](phase-02-slice-12-unit-citation-reconciliation-types.ts)
is the independent, type-only module that holds the shared
`CitationReconciliationKind`, `CitationReconciliationBinding` and
`CitationReconciliationRecord` aliases. Both citation fixtures import it (the
moved-records module and the primary aggregate, which also re-exports the
aliases); the shared types remove the moved→primary back edge, while the primary
aggregate keeps its one-way runtime import of the moved records, so the helper
graph stays acyclic.

## Related links

See [`../../packages/contracts/README.md`](../../packages/contracts/README.md)
and [`../README.md`](../README.md).
