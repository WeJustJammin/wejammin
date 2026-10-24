# DEC-193 existing writer integration — author freeze

Date: 2026-10-16. Author: native `gpt-6.1-sol` / `ultra`.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Primary checkout remains read-only. Exact nine-path S12 Dispatch claim:
`DEC-193 existing writer integration GREEN`.

Status: implementation authored, **UNRUN**. All seven SQL WIPs form one frozen
cohort; no partial staging is authorized by this handoff. Root owns actual
isolated staging, GREEN, independent review, any corrections and promotion.
Generic protected-props acceptance proof remains OPEN, not implicitly cleared.

## Release evidence and authority

Root's release reports 552 assertions, 447 PASS and 105 writer FAIL, without
abort. The failure-name multiset matches the prior 105 writer failures. Pure
metadata, explicit null/key presence, choices/permutations, 512-node and large
graph cases pass with independent review CLEAR. Those are parent-provided
pre-integration results, not independently rerun receipts or GREEN for these
seven files. No author runtime, parser, formatter, tests, DB, Docker, network,
process, Git, CI or promotion was performed.

Governing source is `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`:
line 1487 (every explicit typed choice, selected topology, atomic choices
refusal, linked/detached/retired behavior), line 1563 (canonical complete
detached tree, arbitrary bounded effective JSON, empty row props and prior
provenance), and lines 1454-1475 (ordered lock positions and reproof).
The exact source clauses were read, not inferred from test titles.

The frozen foundations remain unchanged:

| File suffix under `supabase/migrations-wip/dec193/` | SHA-256 |
| --- | --- |
| `20261016040000_cms_detached_tree_storage.sql` | `ac3ec91d42b72fee2e5b4420c15c8cda8a33990483d5dfad3500448d343d3371` |
| `20261016040100_cms_pattern_diff_delta.sql` | `f9065f20e67db4bfef6390d42b211f2c4cad0c9f6c5e76f4f49b432bb9e81288` |
| `20261016040500_cms_pattern_snapshot_expanded.sql` | `f58cb800533044b6653b67a7651e459aed98b0035687786eea6b0619d85ac0e4` |
| `20261016040600_cms_pattern_update_resolve.sql` | `50087e85f14ec02d1b0896dee8fbcfafffd08e7b6b4a911dac27fe893bc22a6d` |

## Forward implementation

1. `40700`: a real pattern pin and exact declared flat-slot binding determine
   the block-root chain. Full ordered expansion becomes canonical relative
   namespaces; B root identity must match the stored row. An absent newer T
   root is JSONB null. No shortest suffix or root-identity heuristic remains
   in this writer adapter. B expansion permits immutable historical pins;
   target expansion uses the caller's existing strictness.
2. `40800`: selected-tree registry validation and safe tuple digest. Exact
   canonical validation is shared with storage. Arbitrary effective props use
   key presence and the existing per-value JSON bounds. Registered safe block
   identity, nonwithdrawn lifecycle, allowed children and subtree slot limits
   are checked. Registry tuples remain sorted/deduplicated exactly by block
   key C-order and numeric version, then JCS-hashed.
3. `40900`: evolve only `cms_pattern_update_plan`, retaining its old
   pinned/target/targetId/rootChain/rootBlock metadata, adding full B/T snapshots
   and the frozen typed delta. The separate GET402/403 path is untouched.
4. `41000`: one call to the frozen pure resolver per append row. Ordinary
   detach resolves B=B with current overrides, materializing L. Linked results
   retain resolved overrides and target pin; detached results retain prior pin
   and store the selected full tree with `{}` row props; removed-root theirs
   retires with prior pin. Snapshot identity, not unchanged whole L, supplies
   a nonretired result's root. Existing metadata/position/bindings are copied.
5. `41100`: preserve the original writer envelope and post-write effects.
   Gather B and T nested pin locks in the existing pattern lock position.
   Assemble rows purely, then prelock the complete B/T/selected/whole-target
   block-reference union once in C-key/numeric-version order before either
   registry helper. Linked rows use the original whole-T digest; detached rows
   use the selected-tree digest; retired rows retain their prior digest/pin.
6. `41200`: one private immutable/security-invoker content image. SQL NULL
   snapshot produces the exact legacy seven-member image. A nonnull snapshot
   contributes privately and excludes its provenance-only pattern reference
   from content identity. No other D5/hash/render/carry call site is changed.
7. `41300`: unchanged public resource projection; only `contentHash` delegates
   to the private shared image. No snapshot field or new API surface appears.

## Security, compatibility and open proof

New helpers are CMS-owned, empty-search-path private functions, with public,
anon, authenticated and service_role execution revoked. Existing replacements
retain owner/ACL through CREATE OR REPLACE and repeat the existing API denial.
No table grant, actor/GUC authority, capability, replay/CAS bypass or public
signature is added. Existing body `app.cms_rpc` use is retained, not introduced
as a new authority source. Existing 32-instance/128-choice controls remain.

`cms_pattern_blocks_compatible(owner, forest, typeIDs)` remains the compatibility
authority and uses its documented active content-type/artifact route. Flat
registered refs are only an adapter to that lookup; no authored forest parser
or new exact-revision artifact requirement is introduced. Existing immutable
signed registration supplies safe renderer/schema identities. Registered slot
limits apply to selected topology, not an authored 32-child parser.

The only semantic resolver/selected-content failures remapped by the writer
are `P0001` / `VALIDATION_FAILED`, to the existing choices pointer where required.
Nonsemantic SQL/infrastructure errors are rethrown. Existing nested inactive
target and target version refusals retain their established reasons/pointers.
The old props-only aggregate row guard remains unchanged and is harmless for
materialized `{}` row props; no whole-snapshot byte/key/depth cap is added.

There is no source-backed generic protected-JSON member predicate in the read
sources. `cms_pattern_props_valid` is an authored object-only schema validator;
`cms_reserved_key` protects declared identifiers, not arbitrary JSON members.
This integration therefore does NOT invent a recursive key blacklist or reject,
coerce, or silently discard approved null/scalar/array local override values.
Generic protected-props acceptance proof remains **OPEN**. Root explicitly owns
targeted negative proof and source resolution before final AC closure; the
552-case foundation receipt does not establish this boundary.

## Static-only checks

- Protected original writer body from `set_config` through the eligibility
  condition: equal after removing comments/whitespace. Eligibility alone now
  permits any newest positive-pin linked origin for ordinary detach, including
  retired rows; accept still requires active/pending_diff.
- Original post-write effects from entry CAS update through returned response:
  equal after removing comments/whitespace. Review invalidation, audit and
  idempotency completion remain inside the existing atomic function.
- Resource members from `createdAt` through the final projection: byte-identical
  to the promoted resource. The old NULL-tree hash input is the same seven
  values and old patternRef case, plus an empty JSONB object.
- No registry-locking/digest helper precedes the operation union block prelock.
  The unchanged target-selection compatibility lookup still precedes it and
  acquires no block row locks; selected content is rechecked after the prelock.
  Pattern, bound-type and live-review lock positions remain unchanged; the new
  pure row assembler takes no block locks. This avoids B/T/selected helper-order
  inversion rather than acquiring an earlier position after a later one.
- Each new WIP is below 300 normal lines. No frozen tests, old WIPs, promoted
  migrations, contracts, specs, shared tracking or unrelated files were edited.

These are source comparisons, not SQL parsing, execution, race proof or GREEN.
TDD preserved the root's frozen independent RED oracles; surgical boundaries
kept old envelope/effects intact; adversarial review drove union prelocking and
error discrimination. Root must validate all seven together before acceptance.

## Author freeze manifest

Raw SHA-256 values; lines exclude trailing blank lines. Paths below are relative
to `supabase/migrations-wip/dec193/`. No formatting command was run.

| File | Lines | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `20261016040700_cms_pattern_root_snapshot.sql` | 107 | 5079 | `af5e6e2b6a3d1d7b853b308130b118f79eb62882f087cfa4eca06cb4f76e75c8` |
| `20261016040800_cms_detached_tree_registry.sql` | 124 | 6765 | `348f294c75459b9d7602ddf91baf2cc60db06574e183d17c3f0c65a32421a46c` |
| `20261016040900_cms_pattern_update_plan_dec193.sql` | 59 | 3062 | `c605b0f4beb660c89934d59285ba9cf4fdb329ac4ddb65cf859386bdb739e577` |
| `20261016041000_cms_pattern_update_next_row_dec193.sql` | 88 | 3989 | `8b7b7d30155b6410b4efd85cf4ab38a5e017a2fae2fa3e9c9b2d8d0749ed134f` |
| `20261016041100_cms_apply_pattern_update_dec193.sql` | 278 | 16620 | `c3f44ef01dedf794fa900807a58d943c7110808ee11467422907c0e1331933d4` |
| `20261016041200_cms_composition_instance_content.sql` | 34 | 1835 | `c0685f16f6bbee598e70c5bce531d0963a1e59548b030b450fc4494f4a4f8743` |
| `20261016041300_cms_composition_instance_resource_dec193.sql` | 29 | 1636 | `72285c651a3a24539062ed9dd4ddd7722c50ec0327b265ba18ccff27a0fa5746` |

README and report hashes are supplied in the final handoff rather than made
self-referential here. Root owns any mechanical normalization and new manifest.
