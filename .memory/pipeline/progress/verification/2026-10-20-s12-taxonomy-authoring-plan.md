# Slice 12 taxonomy authoring implementation plan — 2026-10-20

Status: in progress; no acceptance criterion closed by this plan.

## Authority and boundaries

- Orchestration, research, validation, independent review and integration: `gpt-6.1-sol`, `ultra`.
- Source execution: `Phils-Charm/deepseek-v4.1-flash`, `high`; separate bounded file ownership, tests before implementation. Main runs and reviews tests.
- Checkout: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`; existing dirty work preserved. Other checkouts remain read-only.
- No database, native, privileged, service, stack, provider or hosted operations in this frontend work. The four-PID sudo approval was consumed and stopped at exit 1; no retry or alternative privilege is authorized by this plan.
- Canonical database/full validation remains held at the native prerequisite. Focused unit/lint/type evidence is not a substitute for `pnpm db:verify`, `pnpm validate`, browser acceptance or `/validate-phase`.

## Locked sources and observed gap

- Phase 2 Slice 12 AC-135 and FE03 `CmsTaxonomyFieldEditor` (lines 890, 1512): consume CMS-03C-17 within entry value authoring; active terms scoped to entry type/field key; locale label or term key only; write `{ termIds }`; refetch on `term_unavailable`, preserving other values; labeled native group, polite selection count and hierarchical level text.
- FE03 state channel/read contract (lines 1618, 1747): protected no-store GET with typed query, signed cursor and authenticated ETag; loading, empty, refusal, rate and degraded states, without optimistic state.
- BE03b value encodings (line 1539), BE03c receiving obligation 5 (line 1546), and existing `cms_field_kind_value_shape`: exact `{ termIds: UUID[] <= 128 }`; local shape never proves active-term eligibility. Server remains authority.
- Existing taxonomy selector contract and first-party read proxy exist. The field descriptor currently marks taxonomy unavailable; `CmsFieldEditor` has no taxonomy control; create collection excludes taxonomy. No `CmsTaxonomyFieldEditor` exists.
- Existing SQL producer refusal still contains `taxonomy_source_unavailable`; frontend work does not establish that the Slice 12 database authority has replaced it.

## Execution order and seams

1. Freeze and run RED tests for the pure checkbox control, protected selector transport, and taxonomy value validation/collection.
2. Implement those independent seams after RED. Reuse existing field frame and safe-read retry behavior; keep initial island imports Zod-free. Validate the browser decoder against the real shared Zod selector contract.
3. Connect the shared field editor to a bounded selector state hook and supply server-derived type key plus entry locale from create/draft hosts. Preserve unrelated values and exact unknown-attempt replay. Refusal-driven refresh must not automatically resubmit or silently remove selected IDs.
4. Cover initial load, pagination/retry, locale/scope change and out-of-order completion. Never show terms from an old context or trust a stale read after a newer refresh. Cursor stays component-local; no private response content enters URLs, storage, telemetry or logs.
5. Exercise actual create/draft rendering and outgoing values through mocked fetch boundaries, including typed `term_unavailable` recovery. Conflict replacement is another shared-control consumer and must remain explicit about context rather than guessing type or locale.
6. Run focused regressions, formatting/lint and type checks. Record actual receipts and unresolved limits. Do not check AC-135 or mark Slice 12 complete until its full required gates pass.

## Hierarchy constraint

`TaxonomySelectorTerm` supplies `parentId`, not depth, and parents may be absent from a page. Show exact levels only when a same-vocabulary ancestry is known (root level 1). An absent ancestor or malformed cycle must not be labeled with an invented level; show `Level unavailable`. This bounded behavior is not claimed to prove complete hierarchy navigation across every paginated vocabulary.

## Owner decision required before host integration

The source check found no `typeKey` in the strict `AuthoringContextType`: BE03b lines 1192–1204 and `packages/contracts/src/cms-editorial/authoring-context.ts` lines 51–65 expose IDs, label, locales and evidence only. Draft detail also has no type key. CMS-03C-17 requires the type key. Deriving it from a display label or UUID, using a designer-only registry read, or adding an undeclared response member would violate the locked contracts/access boundary.

The owner explicitly approved the coordinated server-derived `typeKey` addition through `/evolve-contract` (BE/FE source, schema, SQL projection, consumers and tests), without adding a capability or client-chosen authority. Approval: “Approve the coordinated typeKey contract addition (recommended)” in the direct asynchronous question reply on 2026-10-20. Host integration may resume after the contract migration plan and RED checks. The `resolve-ambiguity` skill caused the preceding integration pause. This approval does not authorize privileged inspection, services, stack changes, hosted operations, or acceptance-gate bypasses.

## Existing focused evidence

- Entry-create focused regression: 70/70 passed, `.lane-logs/s12-entry-create-20261020.json`, SHA-256 `72889c0e472a8462f9bc8aebdb631bf9d979344b005a77996fc7ef1b1dde956c`.
- This receipt predates taxonomy implementation and establishes a baseline only.
