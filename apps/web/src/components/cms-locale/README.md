# CMS locale variants (Slice 12)

## Contents

The author's translation surface (BE03c CMS-03C-04; FE03 `CmsLocaleVariantForm`, :891, :1073, :1122, :1336,
:1513, :1601): the protected page `/app/cms-content-modeling/entries/:entryId/locales/:locale` and its form.
An assigned author or editor translates the localizable fields of one entry into one supported language. The
page loader (`load-locale-variant-page.ts`, `locale-variant-page-reads.ts`) and the island live together here;
the Astro file under `pages/app/cms-content-modeling/entries/[entryId]/locales/` only maps the loader outcome
to a response.

## What the page reads

`:entryId` and `:locale` are the only URL state; any query is a 400 before a read. Three protected reads, in
order, each verified by a strict contract before anything is rendered:

1. CMS-03B-11 draft detail: the source revision (`revision.id`), its `contentHash` (the request's `sourceHash`)
   and `entry.version` (the strong `If-Match`). The draft head must be a source-locale revision.
2. CMS-03B-14 authoring context for the draft's own `schemaVersionId`: the author-safe localizable field
   definitions (`localizationMode` `localized` or `no_fallback`; only the kinds CMS-03C-04 can write) and the
   source locale. A 403 here is the page-level "cannot translate" notice.
3. `cmsLocaleVariantRead` (DEC-205), `GET /api/v1/cms/entries/{entryId}/locales/{locale}`, through the same-origin
   proxy `apps/web/src/server/cms-composition-platform-locale-read.ts`: the entry's current variant (or an explicit
   `null`, shown as Untranslated) with its derived state and `staleFieldIds`, the stored values of the variant's
   revision, the CMS-03C-20 resolution of every localizable field and the active fallback order (the author-safe
   replacement of the old schema-registry read). It is the edit-authority gate too: its 403 (a visible entry the
   account cannot edit) is the page-level 403, its 404 (a hidden entry, or a locale outside the active version's
   `supportedLocales`) the disclosure-safe 404. The source locale itself is the same 404.

The form starts from the stored translation (`variant.values`), so a save, which writes exactly the fields on the
page, keeps what an earlier save translated; a field the translator clears is not translated. Fields the page
cannot write (kinds CMS-03C-04 refuses) keep their stored value untouched because they are not on the page.

## Rules the form keeps

- The fallback order is read-only text, `{target}: {a} → {b} → {default}`, submitted unchanged as the equality
  expectation. A 409 `FALLBACK_CHAIN_MISMATCH` shows the fixed sentence of FE03 :1336, replaces the order with
  `details.activeFallbackChain` and keeps what was typed.
- A `no_fallback` field never shows another language's text: its source text is not even put into the page data,
  and no status sentence carries locale text.
- A 409 version conflict or `locale_limit_reached` shows fixed copy, refetches the draft detail
  (`locale-source-refresh.ts`) and holds saving until the person adopts the refreshed version, source revision
  and fingerprint: a new fingerprint stamped onto a translation of the old source would hide its staleness.
- The `Idempotency-Key` is kept while an outcome is unknown and renewed when the request changes.
- Zero zod in the browser (FE03 AC261, `locale-variant-static-closure.test.ts`). `locale-variant-request.ts`,
  `locale-variant-submit.ts` and `locale-source-refresh.ts` are zod-free; their tests are the drift guards.

## Module map

- Types and paths: `locale-variant-types.ts`, `locale-variant-path.ts`, `locale-variant-links.ts` (the links an
  entry page shows, one per supported language except the source).
- Browser: `locale-variant-request.ts`, `locale-variant-submit.ts`, `locale-source-refresh.ts`,
  `locale-variant-copy.ts`, `locale-resolution-text.ts`.
- State: `use-locale-variant-form.ts`, `use-locale-source-review.ts`.
- Views: `CmsLocaleVariantForm` over `CmsLocaleFieldRow`, `CmsLocaleFallbackOrder`, `CmsLocaleStatus` (the one
  focusable result region) and `CmsLocaleSourceReview`.
- Server: `load-locale-variant-page.ts`, `locale-variant-page-reads.ts`; the same-origin proxies are
  `apps/web/src/server/cms-composition-platform-locale.ts` (the CMS-03C-04 write) and
  `cms-composition-platform-locale-read.ts` (`cmsLocaleVariantRead`, DEC-205).

## Ownership

This directory owns the CMS-03C-04 translation surface of the web app: the page loader and its reads, the zod-free
browser modules, the form island and the entry page's Translate navigation (`CmsEntryTranslateLinks.tsx`, rendered
by `entries/[entryId].astro` from the `translateLinks` of the entry edit page view). It does not own the CMS-03C-04
write or read proxies (`apps/web/src/server/cms-composition-platform-locale*.ts`), the endpoint files under
`pages/api/v1/cms/entries/[entryId]/locales/`, or the Worker routes behind them.

## Conventions

- Focus stays on the control that was used; after a save or a refusal it moves to the named result heading.
- No step-up: the CMS-03C-04 catalog has no `STEP_UP_REQUIRED` row; a 401 is sign-in.
- Components stay at most 200 lines and tests at most 400.

## Extension rules

A new field kind is writable only after CMS-03C-04 accepts it (`WRITABLE_KINDS` in the loader). A new refusal
goes in `locale-variant-submit.ts` with its fixed copy in `locale-variant-copy.ts`; add the failing test first.

## Related links

- `../cms-related-content/README.md` (the precedent page, transport and result region)
- `../../pages/app/cms-content-modeling/entries/[entryId]/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (CMS-03C-04, 163; resolution, 1524)
