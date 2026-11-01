# Slice 12 governed-fix3 test support

Suite: `../phase_02_slice_12_governed_fix3.sql`. Lane `claude_s12_governed_fix3_sql`, forward migration
`supabase/migrations/20261014100000_cms_governed_digest_pattern_compat.sql` (anchored patch: the pattern
branch of `cms_governed_current_digest` calls `cms_pattern_blocks_compatible` after the block loop and refuses exactly
as the pattern producer does: `P0001`, `VALIDATION_FAILED`, DETAIL `["/blockTree"]`).

- `010-pattern-compat.sqlinc`: the recompute driven directly. In-range subjects (including deprecated, empty and absent
  `typeIds`) return their unchanged digest; every out-of-range shape (all-types-must-be-covered, inverted, unregistered or
  keyless range, unregistered artifact compiler, unknown type) raises the producer refusal; missing and withdrawn blocks keep
  their earlier tokens. Fixtures (`bc.*` blocks, real chain types, two labelled clones) are the block-compatibility suite's
  `000-fixtures.sqlinc`, included read-only.
- `020-template-parity.sqlinc`: a 7 x 6 matrix of range shapes and bound-type sets; the pattern and template recompute admit
  exactly the same pairs.
- `030-identity.sqlinc`: md5 oracles computed by script from the applied body plus the promoted patches; everything outside
  the new check (template branch, pattern loop, closing fold) is byte-identical, plus catalog ACL/owner of the helper.
- `040-replay.sqlinc`: byte-identical copies of the migration's `do $amend$` block, replayed: idempotent against the patched
  body and 55000 against a body without the anchor. Regenerate it if the migration changes.
- `compat-flow.sql` (standalone, not included by the main file; run it with the lane list `governed-b,governed-fix3`): a
  pattern created over a real type, then the type's active version moves to a 1.9 artifact (the one labelled fixture clone):
  the recompute and the governed submit refuse it; a sibling pattern walks draft, review, approved, active; a move to a
  still-covered compiler (1.0.0) stays submittable.

Adding a case: append an include (or a case in `compat-flow.sql`) and keep each file under 300 lines. Never weaken an oracle.
