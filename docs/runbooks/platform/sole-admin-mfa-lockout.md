# Sole administrator MFA lockout

Use only when the one administrator has lost every verified authenticator and
no second operator holding `admin.identity.mfa_reset` can reset it. With a
second capable operator, use the in-product reset instead: the admin form at
`/app/platform-configuration-admin/mfa-reset` (BE05b `CFG-05B-06`). No HTTP
route, grant or support bypass substitutes for this procedure, and the
operator can never reset their own account through the product.

## Prerequisites

Confirm there is genuinely no other administrator with the capability and a
working authenticator. Confirm the person is who they claim through the
existing account recovery flow (passwordless `recovery` intent, AUTH-API-02 and
AUTH-API-04) and the owner's own out-of-band check. Open a change record first;
the audit note below is attached to it. Do not put credentials, codes, email
addresses or the account's identifiers in this repository, a ticket title or
shell history.

## Procedure

1. In the Supabase dashboard for the exact project, open the Authentication
   users view and find the account by the owner-confirmed identity.
2. Remove every MFA factor enrolled for that account. Do not change the
   account's login methods, sessions, password or recovery baseline.
3. Write the audit note in the change record: who acted, the UTC time, the
   project, that the reason was sole-administrator MFA lockout, and who
   confirmed the person's identity. Record no secret and no factor detail.
4. Have the administrator sign in again and open `/settings/security/mfa`.
   First-factor enrollment needs a primary sign-in within the last 600 seconds;
   if it has lapsed the page asks them to sign in again. They enroll a new
   authenticator (AUTH-API-17), verify it with a code, then use `/step-up` to
   confirm protected actions work.

## Verification and failure

The authenticator list at `/settings/security/mfa` must show only the new
verified factor. If a removed factor still appears, or enrollment is refused,
stop and escalate to the Identity owner; do not edit identity rows by hand. If
the dashboard removal fails or its outcome is unclear, check the factor list
again before repeating it, and record the unclear outcome in the audit note.
This runbook performs no reset for any other person and implies no production
execution from a staging result.
