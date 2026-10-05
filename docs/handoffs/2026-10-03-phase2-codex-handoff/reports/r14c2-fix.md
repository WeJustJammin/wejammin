# r14c2-fix report

Worktree /home/rob/.codex/worktrees/ac265-hosted-evidence-producer/WeJammin, HEAD 76664abb (no commits made). Evidence: scratchpad/evidence/r14c2-fix.json (legacy list with owner and tables, converted list, RED notes). Logs: scratchpad/logs.

## 1 SEC-2 all-schema sweep (done)
- RED: new supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql, 11 of 31 not ok before migrations (red-sec2all.log): 33 bypass-owned definers, no platform role, forged-session admin reset COMPLETED under postgres.
- GREEN: migrations 20261003150000 (role wejammin_platform_definer), 150010 (auth_user_usable lookup, because no migration can grant USAGE on the Auth-owned auth schema), 150100 (grants/policies/EXECUTE), 150200 (ownership of 33 functions: both MFA reset fns -> wejammin_cms_definer; 14 read-only authority/identity lookups -> wejammin_cms_authority_reader; 5 non-CMS fns -> wejammin_platform_definer).
- Policies constrain: reset record system-scope only; binding version/session/security-event writes via identity_session_scope_ok; actor-grant projection only inside CMS RPC context. Other slices' tables: per-verb policy for the one NOLOGIN owner.
- Guard: all schemas, all forced tables, exact legacy list (support/sec2-legacy-bypass-definers.sqlinc, equality both ways), 33 named one by one, exact touched-table list pinned, privilege-to-policy verb parity, least privilege, no API grants. Behavioural: forged/foreign session refused by RLS (42501) in admin_mfa_factor_reset and rpc_admin_reset_mfa_factors, system scope and verified subject admitted.
- Legacy: 154 pre-Slice-09 definers still postgres-owned and touch forced tables (51 platform_api, 74 platform_private, 13 identity_private, 16 profile_private); full list with tables in the evidence JSON. Nested legacy helpers on the MFA reset path (cfg_request_actor, identity_idempotency_reserve, ...) still bypass; not converted.
- Edited existing guards: old sec2 test derives its table set from PUBLIC policies only (coverage moved to the new superset file); r3_grants_misc AC658 grantee list now includes wejammin_cms_definer (owner of the single projection writer). Citations for AC181/946/658 added to the amendment evidence map (mechanical).

## 2 PostgREST manifest (done)
- RED: old authority-gate suite 14/14 green with cms_start_schema_dry_run replaced by a gate-less stub.
- tests/postgrest/support/claim-gate-manifest.ts (90 names + gate), claim-gate-check.ts (drift: exact equality + gate vs grants; behaviour per entry), claim-gate-manifest.apispec.ts, claim-gate-mutation.apispec.ts (stubs one authenticated-subject and one service-role function, proves drift and behaviour name it, restores and re-verifies). claimReadingApiFunctions removed. db:api-test 9 files/58 pass.

## 3 Receipts (done)
- RED 9 failed; GREEN 24/24. receipts-lib: no file-level fallback; plan/numbering/SKIP/TODO parsed; incomplete file fails all its assertions; skipped never passes; unattributable skip emits skipped file rows; guard rejects pgtap file-level and skipped rows; collector exits 3 on non-verbose input. New pnpm db:test:tap (infra/run-pgtap-verbose.mjs, same pg_prove image with -v): 8233 ok -> 4759 assertion receipts, 0 failed.
- The committed receipts jsonl is still absent: receipts guard fails (3 expected) until integrator runs db:test:tap + evidence:collect.

## 4 F5 (done)
- RED 16 failed; GREEN 21. wj_step_up_scope is a random 32-char nonce; HttpOnly wj_step_up_subject = HMAC-SHA-256(STEP_UP_SCOPE_SECRET, subject) rotates the nonce on subject change; both cleared signed out. No secret -> fail closed (fresh nonce per load). Secret via web Worker secret (.github/SECRETS.md, apps/web/.dev.vars.example); local runs: playwright config writes random value to gitignored apps/web/.dev.vars, s09-real launcher passes --var. Chrome: step-up-return real route 3/3, registry-states + network-resilience 6/6.

## 5 F4 residual (done)
- RED 7 failed. Any session cookie (wj_session_ref, wj_access, wj_refresh) -> origin + CSRF before body read; chunksPulled 0 on every refusal. Worker auth dir 68 files/1235 pass.
- NEEDS RULING (BE01a silent): a public sign_in start carrying a stale session cookie must now send X-CSRF-Token (403 otherwise). Mitigation: web /auth/start strips cookie and CSRF header for sign_in (server/auth-public-start.ts).

## Verification
db:verify steps: reset, db:test 201 files/8233 PASS, db:api-test 58 PASS, db:races 6/6; db:types regenerated (+auth_user_usable) and check green; lint, format:check, type-check green; full vitest 1220/1222 files (only receipts guard failing: missing generated receipts). Needs ruling also: STEP_UP_SCOPE_SECRET must be set out of band on wejammin-web and -staging (no CI secret added).
