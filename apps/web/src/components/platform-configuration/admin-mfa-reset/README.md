# Admin MFA factor reset

## Contents

The FE05 `AdminMfaFactorResetForm` for BE05b `CFG-05B-06`
(`POST /api/v1/admin/identity/mfa-factor-resets`): validation, API client,
failure mapping, state hook, and the form, confirmation and notice components.
Served as the `tab=mfa-reset` tab of the admin workbench
(`src/pages/app/platform-configuration-admin/index.astro`, rendered by
`PlatformConfigurationAdminRoute.astro`); there is no route of its own.

## Ownership

These components own presentation and island-local state for the FE05 admin MFA
factor reset form. The API Worker and database own the operator capability
check, the organization and step-up derivation, idempotency and the reset
itself; the client sends only `{ targetPersonId, reason }`.

## Extension

New outcomes are added in `admin-mfa-reset-failure.ts` with exact copy in
`admin-mfa-reset-values.ts` (`ADMIN_RESET_COPY`) and a matching case in
`admin-mfa-reset-failure.test.ts`. State changes belong in
`use-admin-mfa-reset.ts`; components only render.

## Conventions

- The request is exactly `{ targetPersonId, reason }`; operator, organization,
  capability and step-up time are server-derived and never sent.
- The person ID and reason are island memory only. Before a step-up round trip
  only a one-bit "entries were not saved" flag is kept in session storage.
- An unknown outcome (network failure, 504) is never shown as a reset; Retry
  replays the same `Idempotency-Key`, and any edit mints a new key.
- Responses are never echoed: no person ID, reset ID or factor detail is shown.
- The tab answers every actor without `admin.identity.mfa_reset` with a bare 404.
- Failure mapping reuses `../../identity-authority/step-up-mfa/` (`mfa-api.ts`,
  `mfa-failure.ts`, `use-lockout.ts`, `step-up-return.ts`).

## Related links

- Runbook for the sole administrator: `docs/runbooks/platform/sole-admin-mfa-lockout.md`
- Spec: `.memory/wiki/specs/fe/05-platform-configuration-admin.md`
- Server projection: `src/server/admin-mfa-reset-page-context.ts`
