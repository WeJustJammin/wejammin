# Platform configuration admin pages

## Contents

- `index.astro` is the configuration list and workspace route.
- `[recordId].astro` is a single configuration record route.
- `mfa-reset.astro` serves the FE05 admin MFA factor reset form.

## Ownership

These pages own server-rendered route composition for FE05. Each resolves the
admin workspace or the page context through `src/server/` projections and
answers an actor without the required capability with a bare 404. Authorization
and persistence stay in the API Worker and database.

## Extension

Add a route as a sibling `.astro` file, validate path parameters with the
contract schema before any read (a malformed `recordId` is a 404), set
`export const prerender = false`, and keep the file under 200 lines by moving
presentation into `apps/web/src/components/platform-configuration/`.

## Conventions

- `Cache-Control: no-store` on the MFA reset page.
- Return targets pass through `normalizeSafeReturnPath`.
- Request IDs come from `x-request-id` through `createRequestId`.

## Related links

- `apps/web/src/components/platform-configuration/README.md`
- `apps/web/src/components/platform-configuration/admin-mfa-reset/README.md`
- `.memory/wiki/specs/fe/05-platform-configuration-admin.md`
