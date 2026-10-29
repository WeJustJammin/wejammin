# CMS vocabulary terms (Slice 12)

## Contents

The curator's term surface (BE03c CMS-03C-03 and `cmsTaxonomyTermsRead`; FE03
`CmsTaxonomyTermForm`, :887): the keyset-paged list of a vocabulary's terms with a lifecycle filter,
and the create, rename, alias, deprecate and merge forms. Term actions render only against an
`active` vocabulary version and only for a curator; every other state is a read-only table plus a
sentence naming the reason and linking to the governed review.

## Ownership

These modules render server-verified data and send exact request bodies built from it. They own
the form state, the explicit controls, the `Idempotency-Key` policy and the fixed copy. Authority,
the immutable term key, hierarchy, cascade, merge convergence and the canonical overlap check are
the Worker's and the database's, reached only through `apps/web/src/server/cms-taxonomy-platform-*.ts`.
The canonical record a refused overlap points to is shown as copyable text, never as a link.

## Module map

- Zero zod in the browser (FE03 AC261, `../cms-taxonomy-pages/taxonomy-static-closure.test.ts`):
  `term-rules.ts` writes out the CMS-03C-03 grammar, `taxonomy-terms-read.ts` and
  `term-action-submit.ts` verify a 2xx structurally, `term-status-copy.ts` and `term-copy.ts` hold the
  fixed copy per outcome and `reasonCode`. The transport is `../cms-taxonomy-designer/taxonomy-transport.ts`.
- Model: `term-action-request.ts` (form to `TaxonomyTermActionRequest`, naming the field a rule
  refuses), `term-names.ts` (how a term and a merge survivor read in words).
- State: `use-term-form.ts` (fields, review step, submit, attempt key) and `use-term-list.ts` (the
  verified list and the active version, refetched after every action; a 409 cursor restarts from
  the first page).
- Choices: `use-term-action-choices.ts` joins the page's terms, the paged read and the chosen ids for one action. `use-term-choices.ts` reads the whole vocabulary for the parent and merge survivor
  pickers when the page is not it (a filter, a cursor or a next page): the unfiltered first page
  with `limit=50`, then each next page on request through `CmsTaxonomyTermChoice`'s named
  "Load more terms" button (keyboard operable; a stale 409 cursor restarts from the first page and
  keeps a term already chosen, a failed read keeps what is loaded and offers "Try again"). That
  one button stays mounted, with `aria-disabled` and an unchanged label while a page loads, and
  becomes "Try again" in place, so keyboard focus never falls to the page (FE03 :898, WCAG 2.4.3);
  focus moves to the select only when the last page has loaded and focus fell to the page with the
  button (a person who moved to another field keeps it). A merge survivor that a refresh
  no longer offers is cleared and announced, never confirmed or sent unseen; `merged` is terminal,
  so a term either read reports as merged is never offered. A `rename` whose current parent no
  page has brought yet shows it as a held option ("Current parent (not among the terms loaded
  yet)", `HeldChoice`), so the select exposes the value that is sent and "No parent" is a real
  change; the named option replaces it once a page lists the parent. Nothing is read when
  the page already holds every term.
- On demand: the action form (`CmsTaxonomyTermAction` and everything only it renders) is client state that exists after
  the person opens an action, so `term-action-view.tsx` loads it then (chunk `CmsTaxonomyTermAction`, listed in
  `CMS_ON_DEMAND_CHUNKS`; `term-action-preload.test-support.ts` makes it available to the form tests at once, the proof
  test and `term-action-view.test.tsx` never import it). The form takes focus itself when it mounts.
- Views: `CmsTaxonomyTermForm` over `CmsTaxonomyTermFilter`, `CmsTaxonomyTermTable`, `CmsTaxonomyTermAction`,
  `CmsTaxonomyTermFields`, `CmsTaxonomyLabelRows`, `CmsTaxonomyAliasList`, `CmsTaxonomyTermConfirm`
  (a merge review requires its survivor by type; `term-review.tsx` picks the review to show),
  `CmsTaxonomyCanonicalId` and `CmsTaxonomyTermStatus` (the one focusable result region).
  `CmsTaxonomyTermLeaveConfirm` is the inline leave confirmation of FE03 "Unsaved changes": the form arms
  `beforeunload` and intercepts in-app links only while it holds unsent input (`isTermFormDirty`), through the shared
  `useCmsEditorialLeaveGuard`; the only exits are keeping the draft or the explicit discard.

## Extension rules

A new term action goes in `term-action-request.ts` (with its contract parity case), its copy in
`term-status-copy.ts` and `term-copy.ts`, and its view under `CmsTaxonomyTermAction`. A new
`reasonCode` goes in `../cms-taxonomy-designer/taxonomy-vocabulary.ts`. Components stay at most 200
lines.

## Conventions

Merge and deprecate are irreversible and have a separate review step. A `canonical_overlap` refusal
shows the domain and the copyable canonical id; `taxonomy_not_active` links to the governed review;
a merged term shows its survivor. A vocabulary whose full 50-version read holds no active version
says so (BE03c 406) rather than claiming there is none. The list and the active version are re-read after every
committed or unknown outcome before anything else is offered. List state in the URL is `lifecycle`
and the signed `cursor` only.

While a term command is pending only the commit control is disabled (FE03 1048): the fields stay editable and keep focus. Cancel and Back keep their pending lock because FE03 is silent on them and closing a form with a command in flight is new behaviour (`CmsTaxonomyTermForm.pending.test.tsx`).

## Related links

- `../cms-taxonomy-designer/README.md`
- `../cms-taxonomy-pages/README.md`
- `../../pages/api/v1/cms/taxonomies/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md` (`CmsTaxonomyTermForm`)
