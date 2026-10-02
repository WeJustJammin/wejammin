# Slice 09 staging MFA inspection — read-only

**Date:** 2026-10-01  
**Surface:** existing Google Chrome session; Supabase `wejammin-staging` project  
**Source:** https://supabase.com/dashboard/project/ytmgizarejtjtfplkwoi/auth/mfa  
**Effect:** no provider setting, plan, account, factor or credential changed.

## Observed hosted configuration

- Organization badge: FREE. Project name: `wejammin-staging`.
- TOTP (App Authenticator): **Enabled**.
- Maximum per-user MFA factors: **10**.
- Limit duration of AAL1 sessions: **ON**; the displayed description says
  verification is required within 15 minutes of initial sign-in.
- SMS/phone MFA: **Disabled**, with the controls disabled and explicitly
  marked Pro-only. No upgrade or paid flow was entered.
- Save buttons were disabled; no control was changed or saved.

## Application boundary

The local CLI configuration's disabled TOTP defaults do not describe the hosted
staging project. The CMS adapter nevertheless has no configured method-list
source, so its newly corrected `STEP_UP_REQUIRED` disclosure uses an empty
allowlist rather than accepting method names from an RPC body. The next
implementation step is an explicit server-controlled source that advertises
only the verified configured method for the matching staging environment;
local or unknown configurations must remain fail-closed.

This inspection does not prove enrollment, a successful challenge, a fresh
acting-context-bound session, any independent reviewer identity, or schema
activation. No factor secret, token, credential, or private identity UUID is
included in this record. Slice 09 remains 261/279 active; Phase 2 remains 8/17.
