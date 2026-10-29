# Protected CMS pattern pages

## Contents

`new.astro` serves the designer for a new pattern key. `[patternKey].astro` serves the
owner's latest version of a saved key for a successor draft, with the bounded
definition-review panel. `pattern-pages.test.ts` reads both for their response
invariants; the behavior lives in the tested loader
`components/cms-pattern-designer/load-pattern-designer-page.ts` and the islands.

## Ownership

Both pages are server-rendered on demand, `no-store` and GET-only. The loader verifies
the strict selector projection (and, for a saved key, the strict latest version bound to
the key and its ETag) before any form exists; denied, absent, malformed or degraded
projections become one closed notice. Only the active content types, the registered
blocks and the CSRF token reach the designer island; only the few facts of the served
version reach the panel island.

## Extension rules

`context`, `versions`, `selector`, `nestable` and `new` are reserved keys: `[patternKey].astro` answers
them 400 before any read. A malformed key is a 400, a concealed or absent key is the
disclosure-safe 404, a visible key without `cms.template_designer` is a 403, an expired
session is a 303 to sign-in. The nested-pattern picker (`cmsPatternNestableRead`, DEC-196) lives in
`components/cms-pattern-designer/CmsPatternNestedPicker.tsx`, not in a page.

## Conventions

Keep the pages thin: map the loader outcome to a response and nothing else. Do not read
the request headers or body in a page.

## Related links

- `../../../../components/cms-pattern-designer/README.md`
- `../../../../pages/api/v1/cms/patterns/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md` (route table, `/patterns/:patternKey`)
