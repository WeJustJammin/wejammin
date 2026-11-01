# CMS capability grant console

## Contents

The owner-only `CmsCapabilityGrantConsole` island for BE03a CMS-03A-15 (grant),
CMS-03A-16 (renew), CMS-03A-17 (revoke) and the CMS-03A-18 list, per FE03
(DEC-119, with the DEC-120 90-day ceiling).

- `CmsCapabilityGrantConsole.tsx` composes the console; `CmsCapabilityGrantConsoleIsland.tsx`
  is the serializable Astro boundary.
- `CmsCapabilityGrantList.tsx` and `CmsCapabilityGrantListRegion.tsx` render the
  table and every `listState` status; `CmsCapabilityGrantFilters.tsx` holds the
  capability/state URL filters and the island-local person filter.
- `CmsCapabilityGrantForm.tsx`, `CmsCapabilityGrantRenewForm.tsx` and
  `CmsCapabilityGrantRevokeConfirmation.tsx` are the three native forms;
  `CmsCapabilityGrantFields.tsx` holds the shared labelled controls.
- `CmsCapabilityGrantCommandResult.tsx` shows the latest outcome (result
  heading focus on success; step-up, filter and retry actions on failure).
- `cms-capability-grant-validation.ts` owns the exact FE03 field copy and the
  `termWindow` check; `cms-capability-grant-commands.ts` maps a command result
  onto the FE03 state table; `cms-capability-grant-client.ts` owns the two
  transports (a reconciling POST over the shared registry executor, and the
  no-store JSON list read); `use-cms-capability-grants.ts` is the state hook.
- `cms-capability-grant-labels.ts` lists the grantable registry in four groups.
- `cms-capability-grant-console-url.ts` holds the zod-free address rules the
  island uses; `cms-capability-grant-url.ts` re-exports them and adds the
  server-only `parseCmsCapabilityGrantPageQuery` (static schema), which is why
  the island never imports it.
- `CmsCapabilityGrantCheckNotice.tsx` is the form-level alert shown when the
  checks could not run (see Performance below).

## Performance (FE03 budgets, AC261)

The island ships no zod: nothing in its static import graph imports a value
from `@wejammin/contracts` (types only). Every schema comes from the lazily
loaded `lib/cms-contract-validators.ts`: forms run their checks through
`withCmsValidators` (synchronous once a focus warmed the load), the list read
and command answer load the schemas before parsing, and Back parses the address
with `parseCmsCapabilityGrantPageQueryWith`. When the schemas cannot be fetched
a form sends nothing and shows `GRANT_CHECK_UNAVAILABLE_COPY`; a list read is
`degraded` (last verified rows kept, retry offered). A cold load fetches none
of the validators chunk.

## Ownership

These components own presentation and island-local interaction state for the
owner-only CMS capability grant console. The worker/API and database contracts
stay authoritative for ownership, eligibility, step-up proof, the 90-day term
ceiling, persistence and the canonical grant list; the client only renders the
server-computed `termWindow` and the command results it receives.

## Conventions

- Nothing is optimistic: every verified command refetches the canonical list.
- A person ID exists only in island memory and the owner-only table cell. It is
  never put in a URL, `localStorage`, `IndexedDB`, an announcement or a log.
  The only value kept across a step-up detour is the boolean marker that the
  detour happened.
- The server stays authoritative for ownership, eligibility, step-up and the
  term ceiling (`validThrough` <= today + 89 UTC days); the client only bounds
  its inputs with the server-computed `termWindow`.
- Reuse the `content-schema-registry-*` classes from
  `../content-schema-registry/content-schema-registry.css`; table and layout
  rules live in `cms-capability-grants.css`.

## Extension

To add a field or command, extend the generated contract first, then the
validation module, the form, `stateForResult` and the matching tests
(`*.test.ts`, `CmsCapabilityGrantConsole.*.test.tsx`). Components stay under 200
lines; split by form rather than growing the console.

## Related links

`apps/web/src/server/cms-capability-grant-*.ts` (page resolver, ports, query),
`apps/web/src/pages/app/cms-content-modeling/capability-grants.astro`,
`apps/web/src/pages/api/v1/cms/capability-grants/`, and
`.memory/wiki/specs/fe/03-cms-content-modeling.md`.

## Session loss and history

- A 401 `UNAUTHENTICATED` on a command or a list read sets `signedOut` in
  `use-cms-capability-grants.ts`: the console renders only the sign-in notice
  (rows, forms, filters and person IDs are removed) before the safe redirect.
- Back and Forward re-derive the page query from the address with
  `parseCmsCapabilityGrantPageQuery` (shared with the server) on `popstate` and
  re-read the list without pushing a new entry.
- The shared step-up recovery (`step-up-mfa/step-up-return.ts`) builds
  `/step-up?returnTo=`; the console still persists no entries across the detour.

## Disabled commands and their reason

Every disabled command (row Renew, Revoke, Grant again and the form submits)
carries `aria-describedby` naming the visible reason: the degraded-list notice
(`DEGRADED_REASON_ID`) or the step-up recovery (`STEP_UP_REASON_ID`), chosen by
`disabledReasonIdFor` in `cms-capability-grant-reasons.ts`.
