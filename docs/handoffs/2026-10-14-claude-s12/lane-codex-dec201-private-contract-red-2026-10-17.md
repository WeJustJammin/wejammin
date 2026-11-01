# DEC-201 private restore contracts — QA source freeze, UNRUN

Native `gpt-6.1-sol` / `ultra`; 2026-10-17. This lane authors only the new
standalone catalog/role test and this handoff. No production helper, fixture,
existing carry test, driver, README, public contract or migration was changed.
Root owns independent review, formatting, parsing and actual ALT execution.

## Governing contract and scope

The root selection in
`lane-codex-dec201-restore-implementation-preflight-2026-10-16.md:122–193`
defines the private implementation contract, not a new public/product API.
Its exact five signatures/returns/languages/volatility are at137–141;
CMS ownership, SECURITY INVOKER, empty search_path, no defaults/overloads and
PUBLIC/API EXECUTE closure are at133–145. That source was read in full.
Its source SHA256 at author readback was
`637a90b851376190164f83aeaad46241bb52798c524a4adac1cd7336fd54b618`.

The test literals are independent expected metadata, not extracted from future
helper bodies. They require the following private functions:

| Name after `platform_private.` | Inputs | Return | Language / volatility |
| --- | --- | --- | --- |
| `cms_restore_composition_heads` | `uuid` | SETOF composition row | SQL / STABLE |
| `cms_restore_composition_refs` | composition row | TABLE(`kind text`, `ref_id uuid`) | PLpgSQL / STABLE |
| `cms_restore_composition_plan` | `uuid` | TABLE(`heads` composition row[], `pattern_ids uuid[]`, `block_ids uuid[]`) | PLpgSQL / VOLATILE |
| `cms_restore_composition_registry` | composition row, `uuid`, `uuid[]`, `uuid[]` | `text` | PLpgSQL / STABLE |
| `cms_restore_composition_copy` | `uuid`, `uuid`, `timestamptz`, composition row[], `uuid[]`, `uuid[]` | `void` | PLpgSQL / VOLATILE |

“Composition row” above means the exact existing named composite
`platform_private.cms_composition_instances`, not anonymous record or JSONB.
The SQL literals retain that complete type name and ordered argument list.

## Fixed assertion inventory

`supabase/tests/phase_02_slice_12_dec201_restore_contracts.sql:4–7` opens one
transaction and declares `plan(86)`. The file ends with `finish()` and rollback.
The pgTAP extension prerequisite is transaction-scoped if installation is needed;
there is no prelude COMMIT or persistent fixture/grant mutation.

Thirteen catalog checks run for each of five helpers, in fixed expected order:

1. Exact private signature resolves to an OID.
2. Exactly one same-name private overload exists.
3. Ordinary function, zero defaults, no variadic argument.
4. Exact result type/set flag and ordered TABLE names/types/argument modes.
5. Selected language.
6. Selected volatility.
7. Owner is `wejammin_cms_definer`.
8. SECURITY INVOKER.
9. Explicit empty search_path configuration.
10. PUBLIC has no EXECUTE, including the default function ACL when `proacl` is NULL.
11. `anon` has no effective EXECUTE.
12. `authenticated` has no effective EXECUTE.
13. `service_role` has no effective EXECUTE.

The four remaining per-helper assertions are one actual CMS-role privilege
probe and three actual API-role direct-call denials. One final assertion checks
restoration of the original effective caller: `5 × (13 + 1 + 3) + 1 = 86`.
This is source arithmetic, not an observed TAP count.

## Discovery, missing-function and role mechanics

- SQL12–19 resolves each exact signature dynamically with `to_regprocedure`.
  Discovery exceptions return NULL rather than aborting the suite. The fixed
  expected row survives regardless of discovery outcome.
- SQL69–122 uses LEFT JOIN and false-coalesced verdicts. It never silently
  removes a missing function from an aggregate or treats NULL privilege as denial.
  TABLE output types, names and `i`/`t` modes are checked from actual catalog
  arrays, separately from the printed identity signature.
- SQL108–120 separates PUBLIC/default ACL inspection from effective named-role
  privileges, including inherited grants. Missing named roles also fail rather
  than satisfy a negative privilege assertion.
- SQL128–158 executes `SET LOCAL ROLE` inside an exception subtransaction and
  records actual `current_user`. A deliberate caught exception rolls back the
  whole probe, restoring role/GUC state and any accidental successful execution.
  Failure to switch roles returns `PROBE_ERROR`, not a passing denial.
- A missing exact OID returns literal `MISSING_FUNCTION`; it cannot pass either
  the CMS privilege check or the API `42501` direct-call expectation.
- SQL160–162 switches to the real CMS role and checks schema USAGE plus effective
  EXECUTE. It intentionally does not invoke helper bodies as that role.
- SQL167–171 switches to each real API role and attempts the exact typed-NULL
  call. Only actual role identity plus SQLSTATE42501 passes. Successful calls,
  missing-object errors, policy errors and other SQLSTATEs fail. A schema-level
  42501 is accepted as direct-call denial, while the separate effective EXECUTE
  checks prevent schema denial from masking an erroneous function grant.
- SQL173–174 verifies final effective-caller restoration against the caller
  captured before any probe, not a hardcoded operator role.

The test creates only temporary expectations/support functions. It neither
creates identities nor changes an existing fixture, helper, ACL or production
schema. No API-role or CMS-role privilege is granted for the probes.

## Verification boundary and next root gate

Author work is source-only **UNRUN**. No parser, formatter, test runner, SQL
execution, DB/Docker command, Git operation, network access or child agent ran.
Source was read back and hashed using context-mode filesystem/crypto analysis.
The TDD and verification guidance therefore limits this handoff to a test-source
freeze; there is no claimed genuine RED, GREEN or acceptance completion.

Root should independently review these contracts, then run this standalone file
against the explicitly authorized ALT under its canonical four-lock protocol.
Require complete86 TAP output, no setup abort, and rollback. If all five private
helpers are absent, the source predicts85 explicit failures plus the final
caller-restoration pass; that prediction has not been observed by this author.
Do not release helper implementation merely because the test source exists.

These tests do not prove selector eligibility/order, graph closure completeness,
source/destination authority, row RLS, lock ownership/order, live nested policy,
slot/registry repinning, parent remapping, atomic copy effects or replay behavior.
The CMS probe is not a helper call-tree/SELECT/INSERT/crypto permission proof.
The API probes are direct execution-closure checks, not public transport tests.
No concurrent relation/dependency barrier, native receiving or hosted gate is
cleared. Existing carry021–024 behavioral QA and its actual root receipts remain
separate evidence; this lane did not edit or rerun them.

## Source manifest

Test: `supabase/tests/phase_02_slice_12_dec201_restore_contracts.sql`

- Physical lines176; bytes8648.
- SHA256 `8c85c13c074506b854366b3008c6644c5ef344a2bf5cb81e820e1ee78e4b9a8a`.

This report is the second and only other released path. Its final hash is sent
in the formal freeze message rather than embedded in its own bytes.
