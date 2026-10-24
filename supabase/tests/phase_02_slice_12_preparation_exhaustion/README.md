# Slice 12 preparation-exhaustion fragments

`../phase_02_slice_12_preparation_exhaustion.proposal.sqlinc` is an **UNAPPROVED DIAGNOSTIC**,
not an acceptance suite. It is named `.proposal.sqlinc` (not `.sql`) so Supabase pgTAP discovery
does not auto-collect it as a required database test. It is included manually (psql `\ir`) when a
diagnostic run is authorized, and includes the real DEC-108 producer chain and DEC-119 grant helpers.

## Authority

Locked BE03a "Migration scan protocol" (lines 2484-2491): on the fourth delivery a would-be `queued`
disposition rolls an in-flight plan back "through the terminal rollback with reason
`MIGRATION_RETRIES_EXHAUSTED`"; the rollback "uses the plan lease it finds or claims a fresh one (a
`verifying` plan cannot be re-leased)"; and "a plan that cannot be rolled back (no live lease and
none claimable, or an unreadable plan) is left as it was: the Job is `failed` all the same and the
`migration retry >3` and DLQ alerts are the operator signal."

The optional private fresh-CAS-lease extension that would admit an expired `verifying` plan to a
fresh lease (DEC-184:2659 outcome) is **not a required Phase 2 completion gate** and awaits owner
approval. These fragments exercise that extension as a diagnostic witness only.

## Last diagnostic run (2026-10-13, alt stack, runner-owned locks)

44 assertions, 21 failures — **not all intended RED**. Breakdown:

- **Recovery proposal witness (core)**: the expired-verifying re-lease is refused under locked
  authority; the witness and its cascades fail as expected for the unapproved extension.
- **Fixture/oracle defects in this harness (4, preserved separately)**: the sealed-report control
  predicate; the wrong-`sourceHash` and stale-token reason codes (version CAS precedes those checks).
- **Trusted-private-RPC clock characterization (43/44, pending authority review)**: a live `running`
  claim with a forged future `now` succeeded because the claim request carries the required `now`
  and the private grant is service-role only. This is a characterization of the private RPC's caller
  clock, **not an external/security acceptance defect**; the actual worker server-owned clock flow
  must still be checked.

## Fragments

| Fragment              | Coverage                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `010-fixtures.sqlinc` | Real plans to `verifying`/`running`; short real lease; bounded server-time expiry; whole-row + row-evidence + effect snapshots |
| `020-recovery.sqlinc` | Zero-row and positive-row expired verifying re-lease + preservation + rollback + new CMS-03A-10 admission (proposal)           |
| `030-security.sqlinc` | Live VERIFYING forged-clock + stale CAS/fingerprint/token/fallback; RUNNING baseline clock characterization                    |
