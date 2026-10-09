# cms.a11y.structural, version 1

The BE05c accessibility and content-quality checker (decision D25, DEC-134) and
the in-process `quality_gate_evaluate` gate call built on it. It is a pure,
in-process TypeScript module: no network provider, no DOM, no Browser Rendering
provider, no axe-core. Its result is evidence for a human reviewer, never a
substitute for one or for the build-time accessibility tests.

Slice 11 delivers it as the first `worker` preflight provider (category
`accessibility`). Slice 16 reuses this directory unchanged for the
`quality_check` action, `quality_check_runs` persistence and the quality reads.
Until then a gate call persists nothing.

## What is here

| File                                                                           | Purpose                                                                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `index.ts`                                                                     | The only import path for callers outside this directory.                                                |
| `catalog.ts`                                                                   | Code-owned rule catalog: ruleId to severity and static message.                                         |
| `input-schema.ts`                                                              | Strict Zod input: revision identity and hashes, plus the nodes in render order. Refuses any media node. |
| `checker.ts`                                                                   | `runAccessibilityChecker`: runs the groups in order and builds the run.                                 |
| `rules-structure.ts`, `rules-heading.ts`, `rules-link.ts`, `rules-landmark.ts` | One module per rule group (media is inert, see below).                                                  |
| `findings.ts`, `locations.ts`                                                  | Finding model, deterministic order, bounded collector, pointer builders.                                |
| `text.ts`                                                                      | NFKC normalizers, whitespace test, primary language, generic-phrase lists.                              |
| `hashes.ts`                                                                    | `accessibilityInputHash` and `accessibilityBindingHash` (JCS + SHA-256).                                |
| `gate.ts`, `gate-budget.ts`                                                    | `evaluateAccessibilityGate`: one wall-clock budget, retry once, typed failures.                         |
| `evidence.ts`                                                                  | `toPreflightEvidence` and `auditRecordOf`.                                                              |
| `zod-runtime.ts`                                                               | The single `zod` import seam.                                                                           |
| `*.test.ts`, `a11y-structural.test-support.ts`                                 | Colocated tests; the support file holds fixtures only.                                                  |

## Public surface

- `runAccessibilityChecker(input, { shouldStop? })` returns a run
  (`healthy` or `blocked`, at most 500 findings, true `blockingCount` and
  `warningCount`, `truncated`, `inputHash`) or `{ state: 'stopped' }` when
  `shouldStop()` returned true between nodes.
- `evaluateAccessibilityGate({ load, timeoutMs?, now?, sleep?, signal? })`
  returns a completed run or a `failed` run with `CHECKER_TIMEOUT`,
  `CHECKER_DEPENDENCY_UNAVAILABLE` or `TARGET_UNREADABLE`.
- `toPreflightEvidence(gateRun)` and `auditRecordOf(gateRun)`.
- `accessibilityInputHash(input)` and `accessibilityBindingHash(binding)`.

## Behaviour that is easy to get wrong

- **Order.** The `nodes` array is the render order (template slot, bound field,
  composition). The checker never re-derives it. Findings sort blocking first,
  then render position `[node, block, span]`, then ruleId, then pointer, so
  identical input gives byte-identical output.
- **Privacy.** A finding holds only the ruleId, severity, a pointer built from
  stable ids and indexes, the catalog message and `humanReview: 'required'`.
  Author text, link text, URLs, alt text and names never enter a finding, and
  the privacy test serializes a run with a canary string to prove it.
- **Links.** A link is the run of adjacent spans with the same target
  (rich_text.v1 only merges adjacent spans with equal marks and link, so one
  styled link is several spans). The finding addresses the run's first span.
- **Languages.** Version 1 has a generic-phrase list for `en` only. Any other
  primary language raises one `link.text_unchecked_language` warning at its
  first link instead of silence.
- **Media is inert.** No media reference can exist before Slice 14, so the media
  rules (`alt.missing`, `media.accessibility_not_approved`,
  `media.captions_missing`) have no catalog entry and no code. The input schema
  refuses a media node, so the gate reports `TARGET_UNREADABLE` (fail closed).
  `inputHash` keeps an empty `accessibilityRows` member so Slice 14 extends it
  without changing the shape.
- **Truncation.** Counts are true totals; only the stored findings are bounded.
  `PreflightEvidence.blockingCount` is clamped to 1000 (the contract bound);
  the run keeps the true total.
- **A failed run has no evidence.** `toPreflightEvidence` returns `null` for a
  `failed` gate run: a checker that could not finish has no binding to prove.
  The database maps absent evidence to an `unavailable` result with reasonCode
  `checker_failed` (DEC-150), which refuses the command with 503
  `DEPENDENCY_UNAVAILABLE` or retries it at schedule execution.
- **Binding.** `accessibilityBindingHash` must equal what PostgreSQL
  `cms_accessibility_binding_hash` recomputes. `hashes.test.ts` pins a vector
  computed independently with `sha256sum`; if either side changes, change both.
- **Budget.** One budget (100 to 2000 ms, default 2000) covers load,
  validation and evaluation. The load is retried once after 250 ms, only if the
  load says it is retryable and the pause still fits inside the deadline. A
  timer, the cooperative stop and a parent abort all end as `CHECKER_TIMEOUT`.
  A throwing `load` or `sleep` is `dependency_unavailable` and never propagates.

## How to add a rule

Rules of version 1 are frozen: changing what an existing rule reports, or adding
a rule, is a new checker version (BE05c: positive-integer versions, older
versions stay readable, one current version per target type).

1. Add the rule to `ACCESSIBILITY_RULE_CATALOG` in `catalog.ts` with its
   severity and a static message that quotes no content.
2. Write `rules-<group>.ts` exporting `create<Group>Rule(collector, ...)`
   that calls `collector.add(ruleId, location, position)`. Build locations with
   `locations.ts`; a position is `[node, block, span]` with `-1` for unused levels.
3. Wire it into `checker.ts` in BE05c evaluation order
   (structure, heading, link, media, landmark) with a `visitAll` pass so
   `shouldStop` is polled before each node.
4. Write the failing test first (`rules-<group>.test.ts`): a positive and a
   negative fixture per rule, built with `a11y-structural.test-support.ts`.
5. Keep coverage at 100%, files under 300 lines (tests under 400), no `any`.

## Conventions

- Tests are colocated `*.test.ts`; helpers are `*.test-support.ts`.
- Import `zod` only through `zod-runtime.ts`.
- Hashes use the shared RFC 8785 module
  `apps/worker/src/content-schema-registry/migration-transform-jcs.ts`.

## Related

- Spec: `.memory/wiki/specs/be/05c-portability-quality-lifecycle.md`
  (Accessibility and content-quality checker) and
  `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`
  (Accessibility provider, Accessibility outcome mapping).
- Contracts: `packages/contracts/src/cms-editorial/preflight.ts`
  (`PreflightEvidenceSchema`, `preflightResultForAccessibilityEvidence`) and
  `packages/contracts/src/content-schema-registry/structured-values.ts`
  (`validateRichTextV1`).
- Parent: `apps/worker/src/cms-editorial/README.md`.
