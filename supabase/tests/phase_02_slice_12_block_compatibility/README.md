# Block-compatibility suite (Slice 12)

Suite: `../phase_02_slice_12_block_compatibility.sql`, included files in this directory. Lane
`claude_s12_block_compat_sql`; forward migrations `20261014090000` (range helpers), `20261014090100`
(`cms_template_block_digest`), `20261014090200` (`cms_pattern_blocks_compatible`).

The rule under test (BE03a 1098-1101, 2761; BE03c 209, 321, 396, 1361, 1567; IA03 44-45, 65-66): a block is compatible
with a content type when it is registered, its lifecycle admits it (templates: supported; patterns: not withdrawn) and its
registered compatibility `{ minSchemaCompiler, maxSchemaCompiler }` covers the `compiler_version` of the type's ACTIVE schema
artifact, compared dotted-numerically over the closed compiler registry (`1 = 1.0 = 1.0.0 < 1.9`), failing closed.

- `000-fixtures.sqlinc`: producer prerequisites and fixtures. Two real S09 chain types (`bc-type-1`, `bc-type-2`, compiler
  `1`); six blocks registered through the signed CMS-03A-05 command with real ranges (`bc.exact` 1..1, `bc.wide` 1.0.0..1.9,
  `bc.high` 1.9..1.9, `bc.inverted` 1.9..1, `bc.dep` deprecated, `bc.wd` withdrawn through the signed lifecycle command).
  Fixture clones, each labelled in the file because no producer can write the state:
  - types `c19` (artifact `1.9`, a registry-valid compiler the real compiler never emits) and `c2` (artifact `2`, a defensive
    fail-closed witness: 03a activation refuses an unregistered compiler, so it is not a spec-required state);
  - block rows `bc.badvalue` (unregistered bound), `bc.minonly` (no `maxSchemaCompiler`), `bc.empty` (`{}`), witnesses of the
    fail-closed decision for rows registered before any range rule.
    Helpers `bc_types(...)`, `bc_t1()`, `bc_t2()`, `bc_c19()`, `bc_c2()` build the `compatibleTypeIds` operands.
- `010-patterns.sqlinc`: `platform_api.cms_create_pattern_version`: in-range admissions, the out-of-range and fail-closed
  refusals (`VALIDATION_FAILED`, DETAIL `["/blockTree"]`, nothing stored), lifecycle (deprecated admitted, withdrawn and
  missing refused) and the unchanged stored digest.
- `020-templates.sqlinc`: the same matrix through `platform_api.cms_define_template` (deprecated and withdrawn are `CONFLICT`).

Adding a case: register the block with `bc_register(key, min, max)` (or clone a row with `bc_clone_block` only for a range the
producer cannot write), then add the case to `010` and `020` so patterns and templates stay in parity. Keep each file under
300 lines. The governed recompute that re-enforces this rule at submit, decision, activation and recheck is covered in
`../phase_02_slice_12_governed_fix3/`. Related: `../phase_02_slice_12_pattern_definition/` (`047-block-compat.sqlinc`).
