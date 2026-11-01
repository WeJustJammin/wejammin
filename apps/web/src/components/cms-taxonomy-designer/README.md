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

A 409 version conflict reads the versions by itself (`useReconcileOnOutcome` in `use-taxonomy-designer.ts`; FE03 1048,
DEC-242), and a verified save refetches the versions table (`use-taxonomy-version-rows.ts`): a failed refetch keeps the table
it had and says so. A NEW vocabulary has no id to read before its first save, so its 409 and unknown outcome are not read
back here (the same `Idempotency-Key` replay is the reconciliation).

While a save is pending only the commit control is disabled (FE03 1048): every field stays editable and keeps focus, and an edit made meanwhile does not change the pending state. The fields lock only after a verified success (`CmsTaxonomyVersionDesigner.pending.test.tsx`).

## Related links

- `../cms-taxonomy-terms/README.md`
- `../cms-taxonomy-pages/README.md`
- `../cms-governed-review/README.md`
- `../../pages/api/v1/cms/taxonomies/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md` (`CmsTaxonomyVersionDesigner`)

The versions read (`taxonomy-versions-read.ts`) is not part of the route's cold load: every use of it is a re-read after a
command, a lost answer or a 409, so the islands default to `readTaxonomyVersionsOnDemand` (`taxonomy-versions-on-demand.ts`,
which depends on the reader and nothing points back; `TAXONOMY_VERSIONS_PAGE_MAX` lives in `taxonomy-vocabulary-core.ts`) and the module is listed in `CMS_ON_DEMAND_CHUNKS` as `taxonomy-versions-read`
with its proof in `cms-on-demand-taxonomy-locale.proof.test.tsx`. A chunk that cannot be fetched answers `unavailable`. `taxonomy-versions-on-demand.test.tsx` pins that path (the table is kept and the list is said not to be refreshed).
The read has the shared 8,000 ms deadline (`../../lib/read-deadline.ts`; `taxonomy-versions-read.deadline.test.ts`): a read
that never answers is `unavailable`, with the control that repeats it.
Tests that run on fake timers must load that chunk first (`await import('./taxonomy-versions-read')` in `beforeAll`): a real
module load cannot progress under fake timers, so the first test that reads would otherwise fail depending on the
transform cache (`CmsTaxonomyVersionDesigner.latest-states.test.tsx`). `CmsTaxonomyVersionDesigner.closing-words.test.tsx`
asserts the closing words of the FE03 state table: the save and the versions read after it are same-origin `no-store`
requests and nothing is claimed before the server answers.
