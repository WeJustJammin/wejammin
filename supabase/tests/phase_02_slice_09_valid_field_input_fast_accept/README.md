# Field-input early-accept equivalence (P2-S09-AC-217)

Includes of `../phase_02_slice_09_valid_field_input_fast_accept.sql`, the suite that proves
`supabase/migrations/20261010167000_cms_valid_field_input_fast_accept.sql` changed the speed of
`platform_private.cms_valid_field_input` and nothing else: the function may answer `true` earlier, for an input it
fully verifies, and decides every other input exactly as before.

## Contents

- `00-legacy-body.sqlinc`: the verbatim body of the function as
  `20261005010100_cms_field_kind_encodings.sql` installed it, created for the length of the test transaction as
  `platform_private.cms_valid_field_input_legacy`. The suite asserts its md5 equals the md5 the migration pins before it
  replaces the function.
- `01-corpus.sqlinc`: the corpus. `fi_dim` lists, per member of a field definition, an ordered list of variants (the first
  is the base); `fi_cases` holds the base, each variant alone, 3,000 deterministic mixtures, inputs that are not objects
  and every word `cms_reserved_key` refuses, read from that function so a new reserved word is covered without an edit.

## Extension pattern

To cover another input shape add the variant to the right `pg_temp.fi_dim('<member>', array[...])` call in
`01-corpus.sqlinc` (the first item of a member is its base, `'@absent'` removes the member). When the early accept grows
(another kind, another constraint), add the variants that sit on each new boundary and keep every assertion.

## Conventions

- Nothing here is production code; the legacy copy and the counting copy of `cms_exact_keys` exist only inside the test
  transaction, which is rolled back.
- When a later migration legitimately changes what the validator accepts, change `00-legacy-body.sqlinc` and the pinned
  md5 together in that change; do not loosen the comparison.

## Related

- `../phase_02_slice_09_evidence_bench128.sql`: the p95 budget this change serves.
- `../phase_02_slice_09_create_draft_parity/README.md`: the same technique for the create command.
- `../../migrations/README.md`
