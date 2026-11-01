# CMS editorial field editors

## Contents

The typed, native field-editing system every CMS authoring surface shares (the
create form, the draft editor and the conflict resolution form), plus a typed
read-only value view. A field is described once from the CMS-03B-14
`AuthoringContextField`, validated with the database's own semantics, and
edited with a native control chosen by its kind. There is no JSON editor.

## Ownership

These modules own _presentation, input and local validation_. They do not own
the field definitions (03a), the value grammar the database enforces, the
authoring context read, or any request: hosts (the create island, the editor
controller, the conflict controller) own state and submission. Local validation
mirrors `cms_field_kind_value_shape`; the server stays the authority.
The one scoped exception is read-only: the connected taxonomy field
(`CmsTaxonomyFieldConnected.tsx` over `cms-taxonomy-field-connection.ts`) owns the
protected CMS-03C-17 selector GET for a taxonomy field, while the host still owns
the value, the draft state and every mutation — a read never writes a value.

## Module map

- `cms-field-descriptor-decode.ts` — `describeCmsAuthoringFields`: the decode of the
  projected field definitions into descriptors, with the contract schemas. It runs
  where zod is available (the page loaders and the Astro create form), and the
  islands receive the result in their `init` (AC-106). `cms-field-descriptor.ts`
  keeps the descriptor types and the zod-free helpers.
- `cms-field-descriptor.ts` — the descriptor types and helpers; the decode of
  kind (scalar, rich_text, list with `itemKind`, DEC-133 object with its declared
  `properties[]`, relation with its definition bounds, taxonomy as a
  selector-backed descriptor, and media/unsupported as the typed unavailable
  state). Labels and help come from `editorConfig`; the object structure declares
  no per-property label, so the label is derived from the stable key and the
  description from the declared constraints.
- `cms-field-basics.ts` — what every field editor needs when it first renders: `isJsonRecord`, the empty rich text
  document and the datetime control conversion. Editors import these, never the validators.
- `cms-field-validation.ts` — the registry the entry editor reads a refused field's local issues from. The validators are
  not in its cold load: the save chunk imports `cms-field-value.ts`, which registers itself, and until then the server's
  message stands (`cms-field-validators-cold-load.test.ts` guards the boundary).
- `cms-field-value*.ts` — validation (`validateCmsFieldValue`), emptiness,
  initial values and the datetime control conversion (re-exported from `cms-field-basics.ts`). Lengths count Unicode
  characters; dates must be real; an invalid rich text document is not "empty".
- `cms-field-taxonomy-value.ts` — the `taxonomy` value mirror of the database's
  `cms_field_kind_value_shape`: exactly `{ termIds: UUID[] }` bounded at 128,
  with the emptiness and validation branches. The server stays the authority for
  term eligibility.
- `cms-taxonomy-field-level.ts` — the level text of one selector term, derived
  from the page alone. Because the selector carries no depth and a page is
  bounded, a level is stated only when the whole ancestry is present on the page
  and in the same vocabulary; anything else — an ancestor the page does not carry,
  a chain that leaves the page or a cycle — states "Level unavailable" rather than
  an invented depth, and a flat vocabulary states no level.
- `cms-taxonomy-selector-read.ts` and `cms-taxonomy-selector-read-rules.ts` — the
  protected browser transport of the CMS-03C-17 selector read plus its zod-free
  query and page rules. The read carries no mutation authority; it retries only a
  declared 502/503/504, returns a 429's stated wait as metadata and never
  auto-retries it (the connection above owns that wait), and accepts a 200 only as
  the strict, `no-store` page of this request.
- `CmsTaxonomyFieldEditor.tsx` — the `taxonomy` control: a bounded labelled
  multi-select over the CMS-03C-17 selector page (`termIds`, at most 128),
  keyboard reachable, with the typed refusal announced.
- `cms-taxonomy-field-connection.ts` — the connected read hook of the CMS-03C-17
  selector: its dependencies are the scope (the server-derived `typeKey`, the decoded
  descriptor's `key` and the `locale`), an injected fetcher and a reload token.
  A scope change drops the shown page at once; a same-scope reload keeps the last
  verified page but marks it
  stale, so its choices stay closed. Every read is abort- and generation-fenced,
  so a superseded answer changes nothing. The hook owns the pagination (first /
  next / start again), the retained disabled page while a reload is in flight, and
  the 429 wait: it holds a stated wait closed until it elapses and exposes the
  retry as a manual command. A verified empty page is kept rather than dropped, so its
  announced selection count and the explicit Clear selection command stay available
  without any automatic value change. A read never writes a value.
- `CmsTaxonomyFieldConnected.tsx` — the connected taxonomy field: the
  presentational `CmsTaxonomyFieldEditor` over the verified page, with the host
  still owning the value. The commands below the group are the only controls; they
  render according to the page state and are disabled during a stated wait, and no
  automatic GET is issued.
- `CmsFieldEditor.tsx` — the dispatcher: persistent label (`CmsFieldFrame`),
  help text, the declared constraints as a description, linked errors.
  `CmsScalarControl` (text, long text, boolean, integer, decimal, date, datetime,
  enum as a `<select>` over `enumValues`), `CmsListEditor` (one control per item
  with add / remove / move buttons), `CmsObjectEditor` (one fieldset and native
  control per declared property, required marks), `CmsRelationEditor` (ordered
  targets by entry id with an optional pinned version, within the definition
  bounds), `CmsUnavailableField` (typed unavailable state).
- `CmsFieldErrorSummary.tsx` and `cms-field-focus.ts` — the linked error summary;
  a link moves focus to the control (`field-<stableFieldId>`).
- `CmsFieldValueView.tsx` — a typed read-only rendering (text, numbers, dates,
  rich text through the typed renderer, lists, objects, relations, taxonomy).
- `CmsTaxonomyFieldEditor.connected-degraded.test.tsx` — the connected selector's degraded state (a page read that fails
  after a verified page keeps that page, the selection and the count, and the retry asks for the same page), a read that never
  answers (it ends at the shared 8,000 ms deadline of `cms-taxonomy-selector-read.ts` in the degraded cell, DEC-246(1)) and its
  closing words (every read is a `no-store` GET; nothing changes before the server answers).
- `cms-taxonomy-selector-read.edges.test.ts` — the selector reader's defensive answers (a non-Response, a caller that aborts
  while a 429 wait is read).
- `*.test-support.ts(x)` — shared fixtures (parsed through the real contract
  schemas) and a native-DOM driver for jsdom tests.

## Extension rules

A new field kind needs a descriptor shape, a validation branch matching the
database, an editor, a value view and tests for the accepted and the refused
form. Keep every control native and labelled, keep the numeric controls as text
with a numeric keyboard hint (browsers disagree on a half-typed number), never
emit a value the control could not parse, and keep files within the size limits
(components 200 lines, lib 300, tests 400).

## Conventions

Ids are `field-<stableFieldId>` (control), `field-<id>-group`, `-help`, `-hint`
and `-errors`. The stable field id is the only request key. Errors are text and
carry `aria-invalid`; colour is never the only signal.

## Contract status

The projected field definitions come from the CMS-03B-14 `AuthoringContextType`,
which now carries a required, response-only `typeKey` — the owning content
type's stable key, derived server-side. The projection migration and its pgTAP
coverage are **UNRUN** (native/database prerequisites blocked), and the
`taxonomy` editor consumes the CMS-03C-17 selector read; the connected selector
source is implemented with focused local tests and the required database, browser
and Slice 12 gates are still held. Selector-backed frontend editing does not
prove non-empty taxonomy write acceptance: the SQL write path
still refuses a non-empty taxonomy value with `taxonomy_source_unavailable` until
a Slice 12 registration is implemented and verified. This directory therefore
claims no gate or acceptance-criteria pass and no database, browser or Slice 12
result.

## Related links

- `apps/web/src/components/cms-editorial/README.md`
- `apps/web/src/components/cms-rich-text/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`
