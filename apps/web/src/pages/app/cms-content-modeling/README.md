# CMS content-modeling app pages

## Contents

The signed-in Astro surfaces for CMS content modeling: `index.astro` is the
content-schema registry workbench and its primary navigation,
`capability-grants.astro` is the owner-scoped capability-grant surface, and
`registry-entry-nav.test.ts` guards that the registry navigates to the entry
list. The subdirectories hold the schema detail (`[contentTypeId]/`), schema
reviews (`schema-reviews/`), template designer (`templates/`), and the
editorial entry workbench (`entries/`), each with its own README where it has
more than two files.

## Ownership

These pages own addressing, no-store headers, status mapping, and the choice of
which component renders each state. They do not own authorization, validation,
or persistence: every read and mutation goes through a first-party proxy in
`apps/web/src/server/` to the protected Worker, which derives authority. A page
never fabricates data it was not served, and a denial or absence it cannot prove
is rendered as the upstream status.

## Extension

Add a page only after its route contract and a failing structural route test
exist. Every new route must be reachable from an existing navigation element
(the registry's primary navigation here), render through the shared document
shell so heading-focus and auth-scope scripts are bundled, and stay within the
200-line Astro cap by moving markup into a component or logic into a module.

## Conventions

One named main region, one focusable `h1`, `Cache-Control: no-store`, and
`export const prerender = false`. Route tests read the `.astro` source as text,
so keep the guarantees they assert in the page or in the single module the test
names. Raw interpolations are escaped before they enter a document.

## Related links

- `apps/web/src/pages/app/cms-content-modeling/entries/README.md`
- `apps/web/src/components/content-schema-registry/README.md`
- `apps/web/src/components/cms-editorial/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
