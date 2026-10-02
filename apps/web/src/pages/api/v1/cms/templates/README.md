# CMS template first-party API routes

## Contents

`versions.ts` forwards CMS-03C-01 template creation and successor writes.
`context.ts` forwards the protected `cmsTemplateContextRead` selector read.
`[templateKey].ts` forwards the protected current-definition read and checks
the returned key, strict detail shape, and strong ETag.

## Ownership

These endpoints perform transport hygiene through server proxies. The context
read returns only validated active-type and supported-block selectors. Neither
endpoint grants `cms.template_designer` or claims that a template is active.

## Extension

Keep any future activation commands in separately tested routes with their own
locked contracts. A detail read does not authorize a later mutation.

## Conventions

No browser-selected RPC, service secret, or caller-named actor reaches the
upstream Worker. A draft response remains private and no-store.

## Related links

See `apps/web/src/server/cms-composition-platform-mutation.ts`,
`apps/web/src/server/cms-composition-platform-context.ts`,
`apps/web/src/server/cms-composition-platform-detail.ts`, and
`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`.
