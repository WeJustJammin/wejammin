# Step-up and MFA components

## Contents

The FE01 browser surface for AUTH-API-16 to AUTH-API-21: the `/step-up`
challenge form (`StepUpChallengeForm`), the `/settings/security/mfa`
enrollment wizard (`MfaEnrollmentWizard`), their hooks, API client, failure
mapping, return-target rules and the client-side QR encoder under `qr/`.

## Extension pattern

Add a call to `mfa-api.ts` (every call goes through `mfaApiCall`, parses the
contract schema and returns an `ApiOutcome`). Map its failures in
`mfa-failure-view.ts` or `step-up-failure.ts` with the exact FE01 copy, keep
state transitions in the `use-*` hook or `*-state.ts`, and keep components to
rendering. Other protected forms reuse `stepUpHref` from `step-up-return.ts`
to send a 401 `STEP_UP_REQUIRED` to `/step-up?returnTo=`; the admin reset form
in `../../platform-configuration/admin-mfa-reset/` is the reference consumer.

## Conventions

- The browser holds no Supabase token; calls are same-origin proxies under
  `src/pages/api/v1/account/mfa/**` and `src/pages/api/v1/auth/step-up/**`.
- A one-time code, the otpauth URI and the manual key live only in island
  memory; `step-up-draft.ts` refuses to persist fields that could hold them.
- The QR code is rendered client-side from the one-time payload; no service
  receives the secret.
- Tests sit next to their source; `*.test-support.*` files are shared fixtures.
- Components stay at or under 200 lines and hooks at or under 300.

## Related

- Pages: `src/pages/step-up.astro`, `src/pages/settings/security/mfa.astro`
- Server projections: `src/server/step-up-page-context.ts`,
  `src/server/mfa-settings-page-context.ts`
- Spec: `.memory/wiki/specs/fe/01-identity-authority.md`

`StepUpRecoveryLink` is the shared 401 `STEP_UP_REQUIRED` recovery anchor for
legacy surfaces (login-method manager, provider evidence): it links to
`/step-up?returnTo=<current relative path>` and never renders a gate.
