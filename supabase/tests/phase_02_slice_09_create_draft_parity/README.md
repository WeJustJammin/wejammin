# CMS-03A-01 single-compile parity (P2-S09-AC-217)

Includes of `../phase_02_slice_09_create_draft_parity.sql`, the suite that proves
`supabase/migrations/20261010166000_cms_create_type_draft_single_compile.sql` changed the speed of
`platform_private.cms_create_type_draft` and nothing else.

## Contents

- `00-legacy-body.sqlinc`: the verbatim body of the function as
  `20261003100400_cms_create_type_draft_scope_concealment.sql` installed it, created for the length of the test
  transaction as `platform_private.cms_create_type_draft_legacy`, owned by `wejammin_cms_definer` like the real
  function. The suite asserts its md5 equals the md5 the migration pins before it replaces the function.
- `01-capture.sqlinc`: `parity_capture` runs one function on one request inside a sub-transaction, records the
  outcome, the response, every row written (generated ids replaced by `<type>`, `<version>`, `<artifact>`) and the
  row-count delta of every table of the four private schemas, then rolls back. `parity_diff` lists the differing
  members of two images.
- `02-requests.sqlinc`: the fixed request corpus. Field ids, keys and idempotency keys derive from the case name.

## Extension pattern

To cover another input add one `select pg_temp.parity_add('<name>', <request>[, '<expected outcome>'[, <prior requests>[, <calls>]]])`
to `02-requests.sqlinc`. `<expected outcome>` is `'OK'` or a `like` pattern of the error message; `<prior requests>`
are created through the public function before the call under test (for conflicts); `<calls>` of 2 exercises
the idempotent replay. Build the request with `parity_base` and `parity_field`, never with random ids.

## Conventions

- Nothing here is production code; the legacy copy exists only inside the test transaction.
- When a later migration legitimately changes what CMS-03A-01 does, change `00-legacy-body.sqlinc` and the
  expectations together in that change; do not loosen the comparison.
- The comparison never depends on a clock: `expires_at` is compared as whole retention days.

## Related

- `../phase_02_slice_09_evidence_bench128.sql`: the p95 budget this change serves.
- `../phase_02_slice_09_dec108/README.md`: the shared actors and RPC helpers.
- `../../migrations/README.md`
