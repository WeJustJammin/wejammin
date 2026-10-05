# Sole administrator MFA lockout

Use only when the one administrator has lost every verified authenticator and
no second operator holding `admin.identity.mfa_reset` can reset it. With a
second capable operator, use the in-product reset instead: the admin form at
`/app/platform-configuration-admin?tab=mfa-reset` (BE05b `CFG-05B-06`). No HTTP
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
4. Have the administrator sign in again with their primary method and open
   `/settings/security/mfa`. The list can still show the removed authenticator
   as verified: removing it in the dashboard does not tell the application.
5. Step-up reconciliation hop. Have the administrator choose "Set up an
   authenticator". The application still believes a verified factor exists, so
   it answers 401 and sends the browser to `/step-up`. This is expected, not a
   fault. On `/step-up` the page asks the provider for a challenge, the provider
   reports that the factor is gone, and the application marks that factor
   reconciling and answers `no_verified_factor` ("Add an authenticator before
   verifying"). Follow the page's link back to `/settings/security/mfa`.
6. The row now shows "Checking status". That is the normal intermediate state:
   the auth-state-reconciler polls the provider after 15, 60 and 300 seconds
   and then settles the row as removed. Use the refresh control until the list
   shows "No authenticator is set up". Do not repeat the dashboard removal while
   a row is still being checked.
7. First-factor enrollment needs a primary sign-in within the last 600 seconds.
   If that window has lapsed the page answers 401, which is also expected, and
   asks them to sign in again; they sign in again, return to the page and
   continue. They enroll a new authenticator (AUTH-API-17), verify it with a
   code (AUTH-API-18), then use `/step-up` to confirm protected actions work.

## Verification and failure

The authenticator list at `/settings/security/mfa` must show only the new
verified factor. Three states are normal and are not reasons to escalate: the
first enrollment attempt answering 401 and opening `/step-up` while the removed
factor is still listed as verified; a removed factor listed as "Checking
status" (reconciling) until the reconciler's three polls at 15, 60 and 300
seconds complete; and a 401 asking for a fresh sign-in once the 600 second
window has lapsed. Escalate to the Identity owner only when a removed factor is
still listed after those three polls have run and the refresh control shows no
change, when `/step-up` never answers `no_verified_factor` for a removed factor,
or when enrollment is refused for any other reason; do not edit identity rows by
hand. If the dashboard removal fails or its outcome is unclear, check the
factor list again before repeating it, and record the unclear outcome in the
audit note. This runbook performs no reset for any other person and implies no
production execution from a staging result.
