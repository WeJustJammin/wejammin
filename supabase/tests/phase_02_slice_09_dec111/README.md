# Slice 09 DEC-111 step-up MFA pgTAP fragments

Shared include for the `../phase_02_slice_09_dec111_*.sql` suites (BE01a
AUTH-API-16..21 identity state, BE05b CFG-05B-06 admin factor reset, retention).
It is a psql `\ir` include, not a Supabase-discovered test file.

| Fragment | Purpose |
| -------- | ------- |
| `00-support.sqlinc` | `m`/`mj` call a named `platform_api` RPC (named arguments, generated trace ids) inside a sub-transaction and record the SQLSTATE/message/response under a label; `m_out`/`m_resp` read it. `m_user` creates a human through the real bootstrap and session register; `m_alias` maps a fixture number onto an existing DEC-108 actor; `m_enroll`/`m_pending` drive the real enrollment RPCs; `m_warp` time-warps a real row with the guard triggers off for one statement (it never inserts a row). |

## Suites

| Suite | Covers |
| ----- | ------ |
| `mfa_schema` | tables, enums, forced RLS, no grants, constraints, indexes, state-machine triggers, RPC grants and search paths |
| `mfa_enrollment` | factor read, enrollment begin/finish/prepare/settle, session rotation, reconciliation, the 10-factor bound |
| `mfa_removal` | removal reserve/confirm, idempotency, compromise session revocation |
| `mfa_last_factor` | the fail-closed last-factor guard over receipt, grant, assignment and admin grant |
| `step_up_challenge` | challenge create, supersede, prepare, failure bookkeeping, settle |
| `admin_mfa_reset` | CFG-05B-06 reservation and settlement |
| `mfa_retention` | expiry, 30-day purge eligibility, abuse-limiter operation ids |
| `mfa_verification_lock` | shared account-scoped 10-in-15-minute verification lock across AUTH-API-18 and -21: sliding window, persisted 15-minute lock, refusal before provider contact, expiry |

## Race runners

`010-admin-reset-race.mjs` (membership and grant revocation in flight vs the administrative reset) and `011-verification-lock-race.mjs` (fourteen concurrent failure charges) commit real rows across independent `psql` sessions. Run each only right after `pnpm db:reset` and run `pnpm db:reset` again afterwards; they are not Supabase-discovered tests.

## Adding a suite

1. Include `00-support.sqlinc` (and the DEC-108 `00-helpers`/`01-actors` when a
   suite needs organizations, grants or assignments).
2. Drive every state change through the named RPCs; use `m_warp` only to move
   time on a real row.
3. Pair each refusal with an accepted path so a refusal is never vacuous.

Related: `../phase_02_slice_09_dec108/README.md`, `../../migrations/README.md`.
