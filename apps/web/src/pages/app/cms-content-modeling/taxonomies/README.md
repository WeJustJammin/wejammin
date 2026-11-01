# Protected CMS vocabulary pages

## Contents

`new.astro` serves the designer for a new vocabulary. `[taxonomyId].astro` serves a saved
vocabulary: the version designer, the bounded definition-review panel and the term form.
`taxonomy-pages.test.ts` reads both for their response invariants; the behavior lives in the tested
loader `components/cms-taxonomy-pages/load-taxonomy-page.ts` and the islands.

## Ownership

Both pages are server-rendered on demand, `no-store` and GET-only. The loader verifies every read
before any form exists; denied, absent, malformed or degraded answers become one closed notice. The
designer island gets the newest version and the history rows, the panel island only the few facts of
that version, the term form the verified term page, the active version and the URL state.

## Extension rules

`new` is a static segment and wins over `[taxonomyId]`, which is always a lineage id; any other word
is a 400. A malformed id or term list query is a 400, a concealed or absent vocabulary the
disclosure-safe 404, a missing capability a 403, an expired session a 303 to sign-in, a stale term
cursor a 303 to the first page.

## Conventions

Keep the pages thin: map the loader outcome to a response and nothing else. Do not read the request
headers or body in a page.

## Related links

- `../../../../components/cms-taxonomy-pages/README.md`
- `../../../../components/cms-taxonomy-designer/README.md`
- `../../../../components/cms-taxonomy-terms/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md` (route table, `/taxonomies/:taxonomyId`)
