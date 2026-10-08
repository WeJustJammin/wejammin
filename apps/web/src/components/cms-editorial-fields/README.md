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

## Module map

- `cms-field-descriptor.ts` — `describeCmsAuthoringFields`: a typed descriptor per
  kind (scalar, rich_text, list with `itemKind`, DEC-133 object with its declared
  `properties[]`, relation with its definition bounds, taxonomy/media/unsupported
  as an unavailable state). Labels and help come from `editorConfig`; the object
  structure declares no per-property label, so the label is derived from the
  stable key and the description from the declared constraints.
- `cms-field-value*.ts` — validation (`validateCmsFieldValue`), emptiness,
  initial values and the datetime control conversion. Lengths count Unicode
  characters; dates must be real; an invalid rich text document is not "empty".
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
  rich text through the typed renderer, lists, objects, relations).
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

## Related links

- `apps/web/src/components/cms-editorial/README.md`
- `apps/web/src/components/cms-rich-text/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`
