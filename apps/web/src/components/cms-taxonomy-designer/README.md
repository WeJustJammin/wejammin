# CMS vocabulary designer (Slice 12)

## Contents

The browser surface that defines a vocabulary version (BE03c CMS-03C-16 and
`cmsTaxonomyVersionsRead`; FE03 `CmsTaxonomyVersionDesigner`, :886): a native form over a
vocabulary's key, shape, the content type and field keys it may be used with, and the
canonical overlap domains it declares. Saving always creates a **private draft**; the
definition-review panel (`../cms-governed-review/CmsGovernedTaxonomyPanel.tsx`) submits it for
review from the saved-vocabulary page. The term form is a sibling directory
(`../cms-taxonomy-terms/`); the loader both pages call is `../cms-taxonomy-pages/`.

## Ownership

These modules render server-verified data and send exact request bodies built from it. They own
the form state, the explicit controls, the `Idempotency-Key` policy, the conflict comparison and
the fixed copy. They own no authorization and no persistence: capability, ownership, immutable
keys and the activation state machine are decided by the Worker, reached only through the
first-party proxies in `apps/web/src/server/cms-taxonomy-platform-*.ts`.

## Module map

- Zero zod in the browser (FE03 AC261, proved by `../cms-taxonomy-pages/taxonomy-static-closure.test.ts`).
  `taxonomy-vocabulary.ts` writes out the key grammar, shapes, canonical domains, lifecycle states
  and the BE03c reason tokens; `taxonomy-tags.ts` the allowlist grammar and limits;
  `taxonomy-versions-read.ts` and `taxonomy-designer-submit.ts` verify a 2xx structurally (the proxy
  has already parsed the strict resource); `taxonomy-transport.ts` is the one fetch used by this
  directory and by the term form. Each has a `*.test.ts` drift guard against the contracts.
- Model: `taxonomy-designer-request.ts` (form to `TaxonomyVersionRequest`, naming the field a rule
  refuses), `taxonomy-designer-copy.ts` and `taxonomy-designer-ids.ts` (fixed copy; summary link
  targets), `taxonomy-designer-status.ts`.
- State: `use-taxonomy-designer.ts` (fields, submit, attempt key, rate wait),
  `use-taxonomy-conflict.ts` (the explicit latest-version comparison), `taxonomy-outcome-reconcile.ts`
  (what the latest version says about a write whose outcome was unknown) and
  `taxonomy-review-outline.ts` (both sides of a conflict as readable rows).
- Views: `CmsTaxonomyVersionDesigner` over `CmsTaxonomyBasics`, `CmsTaxonomyTagList`,
  `CmsTaxonomyDomains`, `CmsTaxonomyStatus` (the one focusable result region),
  `CmsTaxonomyConflictPanel`, `CmsTaxonomyVersionFacts` and `CmsTaxonomyVersionList`.
- `cms-taxonomy.css` styles this directory and `../cms-taxonomy-terms/`; the pages import it.

## Extension rules

A new rule of the request goes in `taxonomy-designer-request.ts` with its sentence in
`taxonomy-designer-copy.ts` and a parity case in the request test. A new BE03c reason token goes in
`taxonomy-vocabulary.ts`; its parity test fails until it equals the contract. Components stay at
most 200 lines and hold no business rule.

## Conventions

Every control has a persistent label and a 44 by 44 pixel target. The allowlists are tag lists with
explicit add and remove buttons (never drag-only). A saved version is never edited in place: saving
creates the next version from the one read. After a conflict or an unknown outcome the newer
version sits read-only beside the unsent draft before Keep or Discard is offered; the key is
reused only while an outcome is unknown. Nothing the person typed is lost on a refusal. A 403 is
the `capability_missing` copy only.

## Related links

- `../cms-taxonomy-terms/README.md`
- `../cms-taxonomy-pages/README.md`
- `../cms-governed-review/README.md`
- `../../pages/api/v1/cms/taxonomies/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md` (`CmsTaxonomyVersionDesigner`)
