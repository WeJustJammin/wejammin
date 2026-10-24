# CMS pattern designer (Slice 12)

## Contents

The browser surface that defines a pattern version (BE03c CMS-03C-12 and
`cmsPatternLatestRead`; FE03 `CmsPatternVersionDesigner`): a native form over an
ordered tree of registered blocks. Saving always creates a **private draft**; the
definition-review panel (`../cms-governed-review/CmsGovernedPatternPanel.tsx`) submits
it for review from the saved-pattern page.

## Ownership

These modules render server-verified data and send exact request bodies built from it.
They own the form state, the explicit tree controls, the `Idempotency-Key` policy, the
conflict comparison and the fixed copy. They own no authorization and no persistence:
capability, ownership, nested-pattern state, cycles, expansion and the block registry
digest (never typed, never sent) are decided by the Worker, reached only through the
first-party proxies in `apps/web/src/server/cms-pattern-platform-*.ts`.

## Module map

- Zero zod in the browser (FE03 AC261, proved by `pattern-designer-static-closure.test.ts`).
  `pattern-tree-rules.ts` writes out every bound and grammar of `PatternBlockTreeSchema`
  and `CmsPatternKeySchema`; `pattern-designer-reasons.ts` writes out the CMS-03C-12 reason
  tokens and the composition catalog codes; `pattern-designer-submit.ts` and
  `pattern-latest-read.ts` verify a 2xx structurally (the proxy has already parsed the strict
  resource). Their `*.test.ts` files are the drift guards against the generated contracts.
- Model: `pattern-tree-state.ts` (pure edits of the editable tree by `uiId`),
  `pattern-designer-request.ts` (the form to a `PatternVersionRequest`, naming the node a
  rule refuses), `pattern-designer-copy.ts` (fixed field copy),
  `pattern-designer-refusal-items.ts` (a server refusal as linked summary items).
- State: `use-pattern-tree-editor.ts` (operations, polite announcements, focus requests),
  `use-pattern-designer.ts` (fields, submit, attempt key, rate wait),
  `use-pattern-blur-validation.ts` (FE03 :1223: errors of the controls already left, never
  before: the pattern key, a node key and node props syntax; cross-field rules wait for submit),
  `pattern-designer-location.ts` (the address follows the saved key after a first version),
  `use-pattern-conflict.ts` (the explicit latest-version comparison, refusing an older or
  foreign same-numbered version), `pattern-outcome-reconcile.ts` (what the latest version says
  about a write whose outcome was unknown: committed, not saved, or undetermined; the identity
  rule of a comparable latest version).
- Review: `pattern-review-outline.ts` (both sides of a conflict reduced to keyed outlines,
  marked "only in ..." or "changed" by key at the same position) rendered by `CmsPatternReview`.
- Views: `CmsPatternVersionDesigner` over `CmsPatternFields`, `CmsPatternTree`,
  `CmsPatternNode`, `CmsPatternNestedPicker`, `CmsPatternStatus` (the one focusable result
  region with a named result heading), `CmsPatternConflictPanel` and
  `CmsPatternVersionFacts` (version, lifecycle, node count and the server's registry digest).
- Page: `load-pattern-designer-page.ts` is the tested loader the two Astro pages call.

## Extension rules

A new rule of the tree goes in `pattern-tree-rules.ts` with its sentence in
`pattern-designer-copy.ts` (the copy table is exhaustive, so a missing sentence does not
compile) and a parity case in `pattern-tree-rules.test.ts`. A new CMS-03C-12 reason token
goes in `pattern-designer-reasons.ts`; the parity test fails until it equals the contract.
Components stay at most 200 lines and hold no business rule.

## Conventions

Every control has a persistent label and a 44 by 44 pixel target; every tree edit has an
explicit add, remove, move earlier or move later button (never drag-only). The tree is an
`<ol>` with level text ("Level 2 of 8") and node numbers ("Node 1.2") that the error
summary uses to link to the node. A refusal the Worker answers without a node pointer
(cycle, expansion bounds, nested-pattern state) is shown at the tree, plus one "may be the
cause" link per nested pattern node; the form never invents a pointer. After a conflict or
an unknown outcome the newer version sits read-only beside the unsent draft ("Review changes")
before Keep or Discard is offered; an unknown outcome is checked against the server by itself
and a committed write is shown as saved, never as newer. A content type the read version names
but the selector no longer offers stays listed as a checked, labelled "no longer available" box
so it can be cleared (the template designer does the same). The key is reused only while an outcome is unknown; any
definite answer drops it. Nothing the person typed is lost on a refusal. While a save is pending only
the commit button is disabled (`CmsPatternCommitButton.tsx`: it shows the stable pending label
`Saving…` at the width its idle label had, FE03 :1043, :1257; the pending sentence is also in the status
region), and a duplicate activation is ignored. A latest-version read answered 429 is announced with its
stated wait, keeps the unsent tree, and keeps the check button off until the wait has elapsed; a
declared-retryable 502/503/504 of that read is retried twice (250 ms, 750 ms) first.

## BOUNDARY

The nested-pattern picker (`CmsPatternSelector`) reads CMS-03C-13
(`GET /api/v1/cms/patterns/selector`), whose Worker route and proxy are not built. The
control is disabled and names that reason. A nested pattern already saved in a version is
kept (movable, removable, not editable); none can be authored here.

## Related links

- `../cms-governed-review/README.md`
- `../../pages/app/cms-content-modeling/patterns/README.md`
- `../../pages/api/v1/cms/patterns/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md` (`CmsPatternVersionDesigner`)
