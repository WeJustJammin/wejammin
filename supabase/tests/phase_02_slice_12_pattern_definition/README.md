# Pattern-definition RED suite

Included only by `../phase_02_slice_12_pattern_definition.sql`. All cases are
authored and unrun; this directory is not an acceptance receipt.

- `000`: real S09 owner/grant/block/type producer prerequisites and body builders. `s12pd_chain_types` are real CMS-03A chain types and `s12pd_types` (what patterns name) are those same types (compiler_version 1, no renderer-manifest block member); `s12pd_variant_types` holds one fixture clone whose artifact carries compiler_version 1.9. Blocks are registered through the signed producer with real ranges (`s12pd.block` 1..1, `s12pd.high` 1.9..1.9, `s12pd.wide` 1.0.0..1.9). `s12pd.type_count` (default 65) sizes both sets.
- `010`: labeled SQLSTATE/message/DETAIL captures and full-row effect snapshots.
- `020`: initial definition, exact replay, immutable successor and lineage pins.
- `025`, `055`: the stored digest equals the governed recompute (`cms_governed_current_digest`), plain and nested.
- `030`: transport, CAS, digest, authority, concealment and retry refusals.
- `040`: literal graph, registered props and compatible-type boundaries.
- `045`: 64/65 registered props and registry digest ordering.
- `047`: schema-compiler range compatibility of every reachable block with every `compatibleTypeIds` member (BE03c 1361, BE03a 1098-1101).
- `050`: genuine governed activation prerequisites, nested expansion and cycles.
- `060`: real block retirement chain: a deprecated block is admitted, a withdrawn one refused (BE03c 396, 1361).
- `070`: storage and guard witnesses (forest CHECKs on every row (no legacy shape), per-owner keys, lineage, immutability).
- `080`: `cmsPatternLatestRead` (`cms_pattern_latest`): detail shape, lineage-latest, concealment, ACL.
- `090`: all-or-nothing under an injected audit fault (a trigger created and dropped inside the suite). PostgreSQL statement atomicity already guarantees the unchanged row images; the non-vacuous assertions are that the fault is not masked and that the same key and request then succeed (no stranded reservation).

Add cases with unique labels and idempotency keys. Derive inputs from the locked
contracts. Pair a refusal's exact outcome with a full before/after image; do not
accept unchanged state alone. Never write active patterns, disable triggers,
replace a producer or count a fixture failure as feature RED. S09 shared actor
fixtures explicitly label test-human membership provisioning and the other-owner
negative-control capability; no producer claim is made for those provisions.

BE03c names `cms_create_pattern_version`; its public `jsonb` wrapper, flattened
header envelope and raw SQL error tokens are derived adapter
choices, following existing CMS RPCs. Reconcile that single boundary with the
implementation before counting behavioral results. HTTP catalog/headers/rate/
deadline tests remain separate. Only root may release a serialized DB run.

`populated-lineage.sql` (a standalone pgTAP file, not included by the main file) is the populated-table witness of
`20261014020100_cms_pattern_storage_lineage.sql`: it reverts the table to its pre-lineage shape, adds legacy rows
and replays the migration DDL (the text between the `BEGIN/END PATTERN-LINEAGE-DDL` markers, kept byte-identical by
`tests/contracts/phase-02-slice-12-pattern-lineage-witness-parity.test.ts`). It stands in for a populated database:
refusals (55000) on every unconvertible shape, success on an emptied table, and the producer working afterwards.
