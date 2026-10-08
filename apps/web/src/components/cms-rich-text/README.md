# CMS rich text components

## Contents

The browser surface for the locked DEC-112 `rich_text.v1` document: a
constrained native editor, a safe renderer, and the browser-local projection of
the shared document grammar, with their colocated tests.

## Ownership

These modules own _presentation and input only_: how a `rich_text.v1` value is
authored in a form and how it is rendered. They do not own the grammar, the
field kind, or persistence. The canonical document schema is the code-owned
`RichTextV1Schema` in `packages/contracts/src/content-schema-registry/`
(re-exported here under the slice name), the field kind and its protected
`rich_text.v1` validator live in the content schema registry, and the database
validator mirrors the same grammar. The browser never trusts a value: the
renderer parses it with the shared grammar before any element is created, and
the editor lets only a canonical document reach `onChange`.

## Module map

- `cms-rich-text-contracts.ts` — the slice-named re-export of the shared
  grammar (spans, marks, https/mailto/internal links and the document schema)
  from `@wejammin/contracts`; no second copy of the grammar exists, so the
  browser, the Worker and PostgreSQL cannot drift on a bound or on what `jsonb`
  can store (no lone surrogate, no NUL).
- `CmsRichTextRenderer.tsx` — typed SSR-capable output only (`<p>`,
  `<h2>`–`<h4>`, grouped `<ul>`/`<ol>`, `<blockquote>`, `<strong>`, `<em>`,
  `<code>`, links with `rel="noopener noreferrer"`). It never uses
  `dangerouslySetInnerHTML` and renders an inert notice for a refused value.
- `cms-rich-text-markup.ts` — the constrained inline markup, a lossless view of
  the canonical spans: `**` / `_` / backtick toggle bold / italic / code, `[text](href)`
  is a link, and a backslash makes the next special character literal. The
  serializer escapes exactly what the parser treats as special, so
  `parseInlineMarkup(serializeSpans(spans))` is the same spans byte for byte.
- `cms-rich-text-selection.ts` and `CmsRichTextToolbar.tsx` — the semantic mark
  (Bold, Italic, Code) and link (insert, edit, remove) controls of AC-086. A control
  maps the textarea selection to the TEXT it covers (`markupCharRanges`), changes the
  marks or link of exactly that range of the canonical spans, and serializes the
  block back to the lossless markup, so it never splices markers, never changes the
  text and never exposes JSON or HTML. Native buttons (`aria-pressed`), an inline
  address field (Enter applies and never submits the surrounding form, Escape closes
  and returns focus to Link, an unsafe address is refused inline and named), and
  focus returns to the text with the same text selected.
- `cms-rich-text-links.ts` — href admission (https, mailto, internal route) and
  the inverse destination text.
- `cms-rich-text-blocks.ts` — the editable block model: building a canonical
  block from markup, hydrating a server-validated document, and assembling every
  block into one document the shared schema must accept.
- `use-cms-rich-text-blocks.ts` — block state kept in step with the canonical
  value the parent owns: an echo of the editor's own document is ignored, an
  adopted canonical document rebuilds the blocks, and an unfinished edit the
  parent never saw is kept behind an explicit "load the latest text" choice.
- `CmsRichTextEditorBlock.tsx` — one block's native, labelled controls (type,
  level, list style, depth, text, move up/down, remove).
- `CmsRichTextEditor.tsx` — the editor shell: block state, the native input
  binding, only-canonical `onChange`, the inline refusal message, and a live
  preview through the renderer.

## Extension rules

Any change to the document grammar is a locked-decision change: update the
shared schema and the registry validator first, then cascade it into
`cms-rich-text-contracts.ts`; never widen a pattern here alone. A new block
type, mark, or link variant needs its renderer element, its editor control, an
accessible name, and tests for both the accepted and the refused form. Keep
every control a native, labelled form element with keyboard operation (no
pointer-only reordering), keep untrusted links on the shared allow-list, and
keep each component under the 200-line cap by extracting a helper module rather
than growing a file.

## Conventions

Block ids are never drawn from module state (the server render and the hydrating
client must agree): hydration ids are positional, a block the author adds takes the
editor instance's own counter, and the textarea's native `input` listener is bound by
closure to its block, never to a DOM attribute. Anything that renders on the server
needs a `renderToString` + `hydrateRoot` test (`CmsRichTextEditor.hydration.test.tsx`).

Markup changes need a round-trip test: add the new special character to
`cms-rich-text-roundtrip.test-support.ts` (the seeded random generator) so
`parse(serialize(spans))` stays the identity in JCS form.

Tests use `// @vitest-environment jsdom` with React `act`, `createRoot`, and
`IS_REACT_ACT_ENVIRONMENT`, matching the sibling `cms-editorial` island tests.
Assertions prefer roles, accessible names, and the rendered tag over styling.
Refusal paths are asserted as strongly as acceptance paths: a `javascript:`,
`data:`, protocol-relative, or malformed link must be shown to render nothing.

## Related links

- `.memory/wiki/specs/fe/03-cms-content-modeling.md` (CmsRichTextEditor and
  CmsRichTextRenderer rows)
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` ("Rich text
  fields (DEC-112)")
- `.memory/wiki/specs/be/03a-content-schema-registry.md` (protected validator
  registry)
- `apps/web/src/components/cms-editorial/README.md`
