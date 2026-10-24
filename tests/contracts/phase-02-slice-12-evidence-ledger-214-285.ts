import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 12 evidence ledger, criteria AC214-AC285. Aggregated by
// tests/contracts/phase-02-slice-12-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-12-evidence-guard.test.ts.
// Re-cited 2026-10-24 from the refuted proposals by docs/handoffs/2026-10-22-claude-s12/recite/apply.mjs (a rerun reproduces it).
export const S12_EVIDENCE_LEDGER_214_285: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S12-AC-214',
    text: "Pattern update `accept`: for each listed instance a listed path that is not a collision adopts the target value, a local override on a path the target did not change is retained, every collision takes the explicit `yours` or `theirs` choice (on a `props` collision `theirs` takes the target `props` and `yours` keeps the override; on a `structure` collision `theirs` adopts the target's block identity and `children` there, keeping that path's override only when the target left its `props` unchanged), and the command appends an `active` row pinned to the target version whose kept overrides each name a node of the target tree; on a `removed_root` collision `theirs` appends a `retired` row, and `yours` on a `structure` or `removed_root` collision appends a `detached` row materializing the tree every explicit choice resolves to (an ordinary `detach` copies the current effective content unchanged instead), so no choice is discarded and no row is ever left linked and pinned to a version whose forest lacks its block root; a complete answer set that cannot form one consistent reachable tree is refused atomically 422 `COMPOSITION_VALIDATION_FAILED`; accept never creates a row for a block root the target adds (DEC-193).",
    clauses: [
      {
        text: "Pattern update `accept`: for each listed instance a listed path that is not a collision adopts the target value, a local override on a path the target did not change is retained, every collision takes the explicit `yours` or `theirs` choice (on a `props` collision `theirs` takes the target `props` and `yours` keeps the override; on a `structure` collision `theirs` adopts the target's block identity and `children` there, keeping that path's override only when the target left its `props` unchanged), and the command appends an `active` row pinned to the target version whose kept overrides each name a node of the target tree;",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-10 absent O auto-adopts noncolliding target props: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-12 O equal to B is noncolliding and dropped on changed target: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-13 unchanged target preserves a redundant authoritative O key: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-11 present JSON null is a real yours answer: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-03 ancestor theirs / descendant yours: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-15 structure theirs preserves O only when target props equal B: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-none: exact selected snapshot/overrides, disposition, root identity and provenance pin',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-null: exact selected snapshot/overrides, disposition, root identity and provenance pin',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-equal: exact selected snapshot/overrides, disposition, root identity and provenance pin',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-none: exactly one composition row appended; no added-root implicit placement',
          },
        ],
      },
      {
        text: 'on a `removed_root` collision `theirs` appends a `retired` row, and `yours` on a `structure` or `removed_root` collision appends a `detached` row materializing the tree every explicit choice resolves to (an ordinary `detach` copies the current effective content unchanged instead), so no choice is discarded and no row is ever left linked and pinned to a version whose forest lacks its block root;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-06 removed-root theirs is explicit retirement: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-05 highest removed-root yours carries every suppressed L descendant: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-07 highest membership frontiers yours carry suppressed deep subtree: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-01 ancestor structure yours / descendant props theirs: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-rm-t: exact selected snapshot/overrides, disposition, root identity and provenance pin',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-rm-y: exact selected snapshot/overrides, disposition, root identity and provenance pin',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-yours: exact selected snapshot/overrides, disposition, root identity and provenance pin',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/020-detach.sqlinc',
            title:
              'the detached row keeps the pattern version it was pinned to (its origin)',
          },
        ],
      },
      {
        text: 'a complete answer set that cannot form one consistent reachable tree is refused atomically 422 `COMPOSITION_VALIDATION_FAILED`;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-inconsistent-one: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-inconsistent-one: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-inconsistent-two: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-25 parent excludes explicit present child: exact refusal, not incidental SQL failure',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-26 parent requires explicit absent child: exact refusal, not incidental SQL failure',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-refusals.test.ts',
            title:
              'CMS-03C-15 pattern-update refusals a refusal the producer pointed at the request is relayed as pointer-shaped violations',
          },
        ],
      },
      {
        text: 'accept never creates a row for a block root the target adds (DEC-193).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution/020-accept-results.sqlinc',
            title:
              'RESOLVE-API-04: a newly offered root remains unplaced by an accept of /panel',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-yours: exactly one composition row appended; no added-root implicit placement',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-215',
    text: "Pattern update `detach`: the command appends a `detached` row that materializes the instance's current effective content (the full subtree of its block root in the pinned version, nested pattern references expanded in place, every override applied) as a detached local block tree in `detached_tree`, bounded by the 512-node pattern limit with no key-count refusal, keeps the pin of the row it follows as provenance only and stops the instance receiving updates; it is admitted for any linked pattern-origin row, including a `retired` one, and the render plan, restore and the revision-append carry-over resolve the tree (DEC-193).",
    clauses: [
      {
        text: "Pattern update `detach`: the command appends a `detached` row that materializes the instance's current effective content (the full subtree of its block root in the pinned version, nested pattern references expanded in place, every override applied) as a detached local block tree in `detached_tree`, bounded by the 512-node pattern limit with no key-count refusal, keeps the pin of the row it follows as provenance only and stops the instance receiving updates;",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'd-ap7 [/hero]: the detached local block tree (null unless the row materialized the resolved or pinned tree) [DEC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'd-ap7 [/hero]: state, link mode and pinned pattern version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/020-detach.sqlinc',
            title:
              'the detached row keeps the pattern version it was pinned to (its origin)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/020-detach.sqlinc',
            title:
              'a detached instance receives no further update: its diff is the empty no-update',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'd-wide [/wide]: the detached local block tree (null unless the row materialized the resolved or pinned tree) [DEC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_consumers/025-boundary-fixture.sqlinc',
            title:
              'CB-LONG premise: actual public detach persisted exactly five reference namespaces and the literal child',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot.sql',
            title: '513 nodes: exact SQLSTATE',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot.sql',
            title:
              '512 nodes, namespaces, scalar/null props, over 256 KiB: exact full row persists the complete snapshot without props coercion',
          },
        ],
      },
      {
        text: 'it is admitted for any linked pattern-origin row, including a `retired` one, and the render plan, restore and the revision-append carry-over resolve the tree (DEC-193).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'd-retired [/gone]: state, link mode and pinned pattern version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-retired: exact selected snapshot/overrides, disposition, root identity and provenance pin',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_consumers/030-effective-boundaries.sqlinc',
            title:
              'CB-L01: expanded reference chain renders every block, no reference pseudo-node',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/020-restore.sqlinc',
            title:
              'CC-RST004: source local full subtree wins over current linked target',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/010-append-conflict.sqlinc',
            title:
              'CC-APP003: carried detached snapshot equals independent literal, not origin/target pattern',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-216',
    text: "Pattern insertion target: CMS-03C-02 inserts only on the entry's current draft revision (effective state `draft` per E2, else 409 `revision_not_editable`) that the caller can read (patterns apply to entry revisions only, DEC-176), and `patternId` is a lineage id of the caller's owner scope.",
    clauses: [
      {
        text: "Pattern insertion target: CMS-03C-02 inserts only on the entry's current draft revision (effective state `draft` per E2, else 409 `revision_not_editable`) that the caller can read (patterns apply to entry revisions only, DEC-176),",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'old-revision: exact SQL message token revision_not_editable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'submitted-revision: exact SQL message token revision_not_editable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'archived-entry: exact SQL message token revision_not_editable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'old-revision: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'current-revision: the placement succeeds',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'hidden-owner: exact SQL message token NOT_FOUND',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-reasons.test.ts',
            title:
              'CMS-03C-02 route typed Slice 12 refusals publishes revision_not_editable as 409 COMPOSITION_VERSION_CONFLICT with exactly its reasonCode',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern-reasons.test.ts',
            title:
              'CMS-03C-02 production adapter Slice 12 reason tokens maps the producer raise revision_not_editable to 409 COMPOSITION_VERSION_CONFLICT carrying exactly its reasonCode',
          },
        ],
      },
      {
        text: "`patternId` is a lineage id of the caller's owner scope.",
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "`patternId` is a lineage id of the caller\'s owner scope.": No cross-owner patternId test in the placement suite; see clause gap (unknown-pattern: exact SQL message token NOT_FOUND covers only an absent id and is not cited).',
  },
  {
    criterion: 'P2-S12-AC-217',
    text: "Pattern insertion version: the named pattern version must be `active` and its `compatibleTypeIds` must list the revision's content type, else 422 `pattern_version_not_active` or `pattern_incompatible`.",
    clauses: [
      {
        text: "Pattern insertion version: the named pattern version must be `active` and its `compatibleTypeIds` must list the revision's content type, else 422 `pattern_version_not_active` or `pattern_incompatible`.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'draft-pattern: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'absent-version: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'superseded-version: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'incompatible-type: exact SQL message token pattern_incompatible',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'incompatible-type: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'incompatible-type: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-reasons.test.ts',
            title:
              'CMS-03C-02 route typed Slice 12 refusals publishes pattern_version_not_active as 422 COMPOSITION_VALIDATION_FAILED with exactly its reasonCode',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-reasons.test.ts',
            title:
              'CMS-03C-02 route typed Slice 12 refusals publishes pattern_incompatible as 422 COMPOSITION_VALIDATION_FAILED with exactly its reasonCode',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern-reasons.test.ts',
            title:
              'CMS-03C-02 production adapter Slice 12 reason tokens maps the producer raise pattern_version_not_active to 422 COMPOSITION_VALIDATION_FAILED carrying exactly its reasonCode',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern-reasons.test.ts',
            title:
              'CMS-03C-02 production adapter Slice 12 reason tokens maps the producer raise pattern_incompatible to 422 COMPOSITION_VALIDATION_FAILED carrying exactly its reasonCode',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-218',
    text: "Pattern insertion rows (DEC-175, DEC-181, DEC-185): the request `slotPath` must exist in the revision's template (or be a root path when the entry has no template); a top-level nested pattern reference (`kind: pattern`) in the pinned forest is expanded at placement into that pattern's own block roots, recursively, so every row carries a block; one placement writes one append-only row per block root of the pinned pattern version's forest after that expansion, one or more rows (at most 512, the node cap after expansion) in one transaction and all-or-nothing, at consecutive `position` values in forest order starting one above the greatest `position` of the revision's slot (0 for an empty slot) under the revision/slot lock (DEC-185), and answers 201 `PatternPlacementResource`, an `items` list of one or more `CompositionInstanceResource` in position order; each row stays pinned to the placed `(patternId, patternVersion)`, carries its block root's block identity in `block_key` and `block_version` with that root's `key` as the suffix of its `path`, keeps the nodes below a block root inside the pinned tree and stores the server-recomputed digest, the link mode and the `overrides` that lie under its root; `overrides` keys are normalized node paths under the inserted root (`/{nodeKey}(/{nodeKey})*`, at most 512 characters) that each name a node of the pinned tree, any other key being 422 `COMPOSITION_VALIDATION_FAILED` at `/overrides`; `(revision_id, path)` is unique per version, and an override collision produces `pending_diff` and never overwrites; an optional `roots` places only the named block roots (how the author places the block roots a newer version adds, DEC-193), a path whose newest row is not `retired` is occupied (409 `COMPOSITION_VERSION_CONFLICT`, nothing written), and a path whose newest row is `retired` is free, the placed row being that path's next version at its kept position (DEC-185, DEC-193).",
    clauses: [
      {
        text: "Pattern insertion rows (DEC-175, DEC-181, DEC-185): the request `slotPath` must exist in the revision's template (or be a root path when the entry has no template);",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'slot-not-in-template: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'slot-not-in-template: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'root-with-template: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'no-template-slot-1: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'slot-in-template: the placement succeeds',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'no-template-root: the placement succeeds',
          },
        ],
      },
      {
        text: "a top-level nested pattern reference (`kind: pattern`) in the pinned forest is expanded at placement into that pattern's own block roots, recursively, so every row carries a block;",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'p2: row paths are slotPath joined with each root key chain, in forest order [DEC-186]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'path-248: row paths are slotPath joined with each root key chain, in forest order [DEC-186]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title:
              'rows carry the slot key, the revision owner, the acting author, the root block identity, empty bindings and no parent [P2-S12-AC-258]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title:
              'sr-nested: exact literal paths, successor versions, ordered positions and block identities',
          },
        ],
      },
      {
        text: "one placement writes one append-only row per block root of the pinned pattern version's forest after that expansion, one or more rows (at most 512, the node cap after expansion) in one transaction and all-or-nothing, at consecutive `position` values in forest order starting one above the greatest `position` of the revision's slot (0 for an empty slot)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'p1: exactly 2 composition rows were appended',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'p2: one item per block root, 5 rows',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'p1: consecutive positions in forest order from 13 [DEC-185]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'p3: consecutive positions in forest order from 100 [DEC-185]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'p4: consecutive positions in forest order from 0 [DEC-185]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/060-big.sqlinc',
            title:
              'the maximum placement stored exactly 512 rows [P2-S12-AC-218]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/060-big.sqlinc',
            title:
              'positions run 0..511 consecutively in forest order [DEC-185]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/065-defensive.sqlinc',
            title:
              'a forest of 513 block roots is refused pattern_nodes_exceeded at /patternId (422) [BE03c 1612, DEC-175]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/050-refusals.sqlinc',
            title:
              'the placement whose LAST root collides wrote none of its five rows: all-or-nothing [P2-S12-AC-218]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'collide-on-last-root: the refusal preserves every captured full row of every store',
          },
        ],
      },
      {
        text: 'under the revision/slot lock (DEC-185),',
        citations: [],
      },
      {
        text: 'and answers 201 `PatternPlacementResource`, an `items` list of one or more `CompositionInstanceResource` in position order;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'p1: the 201 body is exactly { items }',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'p1: the response items equal the persisted rows resource by resource',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'p1: row paths are slotPath joined with each root key chain, in forest order [DEC-186]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-placement-http.test.ts',
            title:
              'CMS-03C-02 pattern placement at the HTTP app.request boundary [P2-S12-AC-010] answers 201 with the placement list and the forwarded entry ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-placement-http.test.ts',
            title:
              'PatternPlacementResource cardinality (schema control, DEC-175/DEC-181) [P2-S12-AC-010] accepts 1 and 512 rows and refuses 0 and 513',
          },
        ],
      },
      {
        text: "each row stays pinned to the placed `(patternId, patternVersion)`, carries its block root's block identity in `block_key` and `block_version` with that root's `key` as the suffix of its `path`, keeps the nodes below a block root inside the pinned tree and stores the server-recomputed digest, the link mode and the `overrides` that lie under its root;",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'p1: every row is pinned to the placed (patternId, patternVersion), carries the server digest, the mode, state active, version 1',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'p5: every row is pinned to the placed (patternId, patternVersion), carries the server digest, the mode, state active, version 1',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title:
              'the override under hero is stored on the hero row only [P2-S12-AC-218]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title:
              'the override naming the cta root is stored on the cta row only [P2-S12-AC-218]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title: 'the node title below hero is never a row [DEC-175]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title:
              'only the row whose key chain begins the override key stores it [DEC-186]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'digest-mismatch: exact SQL message token block_registry_digest_mismatch',
          },
        ],
      },
      {
        text: '`overrides` keys are normalized node paths under the inserted root (`/{nodeKey}(/{nodeKey})*`, at most 512 characters) that each name a node of the pinned tree, any other key being 422 `COMPOSITION_VALIDATION_FAILED` at `/overrides`;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'override-ghost: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'override-ghost: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'override-at-reference: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'override-missing-child: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'override-without-chain: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'overrides-grammar-1: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'overrides-grammar-2: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract [P2-S12-AC-028] accepts only normalized node paths as override keys and reports any other key at /overrides',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract bounds override key count, names, JSON depth, and non-JSON values',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern.test.ts',
            title:
              'CMS-03C-02 production pattern adapter maps private domain failures and transport failures without exposing provider content',
          },
        ],
      },
      {
        text: '`(revision_id, path)` is unique per version,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title:
              'pattern and composition versions have stable unique identities',
          },
        ],
      },
      {
        text: 'and an override collision produces `pending_diff` and never overwrites;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title: 'a linked instance with a local override gets one too',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title:
              'the pending row keeps the local override of the row it follows (an unanswered update overwrites nothing)',
          },
        ],
      },
      {
        text: "an optional `roots` places only the named block roots (how the author places the block roots a newer version adds, DEC-193), a path whose newest row is not `retired` is occupied (409 `COMPOSITION_VERSION_CONFLICT`, nothing written), and a path whose newest row is `retired` is free, the placed row being that path's next version at its kept position (DEC-185, DEC-193).",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title:
              'sr-subset: exact literal paths, successor versions, ordered positions and block identities',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'sr-occupied-one-of-two: exact SQL message token CONFLICT',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title:
              'sr-occupied-one-of-two: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'sr-occupied-active: exact SQL message token CONFLICT',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'sr-occupied-superseded: exact SQL message token CONFLICT',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title:
              'sr-mixed: exact literal paths, successor versions, ordered positions and block identities',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots/030-retired-reuse.sqlinc',
            title:
              'SR-REUSE: full a/c history retained, including both retired tombstones',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.test.ts',
            title:
              'CMS-03C-02 protected pattern instance route returns a redacted conflict without leaking provider details',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "under the revision/slot lock (DEC-185),": missing test: race (tool race), new module supabase/tests/phase_02_slice_12_placement.race.mjs (add to infra/run-database-race-runners.mjs plan): two independent sessions place into one slot of one revision; assert the two runs get disjoint consecutive positions in commit order and neither shares a position (BE03c "Slice 12 lock order" 1336-1357, DEC-185). The only sequential evidence, `the slot main holds each position once`, is not cited because it proves no lock.',
  },
  {
    criterion: 'P2-S12-AC-219',
    text: "Composition write effect: every composition write (CMS-03C-02, which appends one row per block root (DEC-181), CMS-03C-15, the linked-update scan and the revision-append carry-over) appends a row, never changes the revision's `contentHash` (composition instances are not part of it) and invalidates the revision's live editorial review in the same transaction, with the reason `dependency_changed` for CMS-03C-02 because the manifest `blocks` and `patterns` groups changed.",
    clauses: [
      {
        text: "Composition write effect: every composition write (CMS-03C-02, which appends one row per block root (DEC-181), CMS-03C-15, the linked-update scan and the revision-append carry-over) appends a row, never changes the revision's `contentHash` (composition instances are not part of it)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'p1: the revision row, payload_hash included, is unchanged by the composition write [AC-219]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'd-ap7: the revision row, payload_hash included, is unchanged by the composition write [AC-219]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title:
              'run 1 wrote exactly the composition rows, the invalidated review, one audit record and one event: no entry, revision, assignment, pattern, schedule or idempotency row changed',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/010-append-conflict.sqlinc',
            title:
              'CC-APP003: carried detached snapshot equals independent literal, not origin/target pattern',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'p1: exactly 2 composition rows were appended',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'd-ap7 [/hero]: the next version of the path is appended',
          },
        ],
      },
      {
        text: "and invalidates the revision's live editorial review in the same transaction,",
        citations: [],
      },
      {
        text: 'with the reason `dependency_changed` for CMS-03C-02 because the manifest `blocks` and `patterns` groups changed.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title:
              'the live review is invalidated dependency_changed in the same transaction, version advanced once [P2-S12-AC-219]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title:
              'the placement emits exactly the one review-changed event of the invalidation it performed [P2-S12-AC-219]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "and invalidates the revision\'s live editorial review in the same transaction,": missing test: pgTAP, supabase/tests/phase_02_slice_12_dec193_carry/010-append-conflict.sqlinc (or 016-append-carry-boundaries): a revision append that carries composition rows while the old draft has a live review asserts that review is invalidated in the SAME transaction (and the carried rows exist); today only rollback (CB-FAULT-REVIEWS) and the restore path (RR-RETRY: revision INSERT trigger invalidates the review revision_superseded) are asserted. Proven for the other three writers (not cited here because this part names all four): placement p7 (`the live review is invalidated dependency_changed in the same transaction, version advanced once [P2-S12-AC-219]`), pattern update 060-effects.sqlinc:27, scan 030-scan.sqlinc:63-66. BE03c Canonical records "every composition write".',
  },
  {
    criterion: 'P2-S12-AC-220',
    text: 'Vocabulary model: a vocabulary is identified by its stable lineage id `taxonomyId`, a TaxonomyVersion is the reviewed rule set (shape, allowlists and declared canonical overlap domains), and the terms belong to the vocabulary, so `cms_terms` carries `taxonomy_id` and `UNIQUE (taxonomy_id, term_key, version)` replaces `UNIQUE (taxonomy_version_id, term_key, version)`, a successor version never duplicates or re-keys a term, and term ids stay stable across versions and merges.',
    clauses: [
      {
        text: 'Vocabulary model: a vocabulary is identified by its stable lineage id `taxonomyId`, a TaxonomyVersion is the reviewed rule set (shape, allowlists and declared canonical overlap domains), and the terms belong to the vocabulary, so `cms_terms` carries `taxonomy_id` and `UNIQUE (taxonomy_id, term_key, version)` replaces `UNIQUE (taxonomy_version_id, term_key, version)`, a successor version never duplicates or re-keys a term, and term ids stay stable across versions and merges.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/095-lineage-storage.sqlinc',
            title:
              'cms_terms carries a NOT NULL uuid taxonomy_id (the vocabulary lineage) [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/095-lineage-storage.sqlinc',
            title:
              'a second row for a key of the vocabulary is a unique violation even under another taxonomy version [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/095-lineage-storage.sqlinc',
            title:
              'the successor version duplicated, re-keyed and touched no term: ids, keys, versions and write-versions are byte-identical [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/095-lineage-storage.sqlinc',
            title:
              'a version-1 term merges into a version-2 term: the permanent redirect crosses taxonomy versions, the retired row keeps its write-version [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title:
              'a term written under version 1 is listed under the ACTIVE version 2 of its vocabulary: term ids are stable across taxonomy versions [P2-S12-AC-130]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/095-lineage-storage.sqlinc',
            title:
              'UNIQUE (taxonomy_id, term_key, version) replaces the version-keyed unique under its old name (BE03c 1428) [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'flat-first: shape, key and all declared allowlists round trip',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-221',
    text: "Term action preconditions: CMS-03C-03 runs under the vocabulary's `active` TaxonomyVersion (no active version is 409 `taxonomy_not_active`), `parentId` other than null requires shape `hierarchical`, and assigning a term to a field requires the vocabulary's active version to list the entry content type's key in `allowedTypeKeys` and the field key in `allowedFieldKeys`.",
    clauses: [
      {
        text: "Term action preconditions: CMS-03C-03 runs under the vocabulary's `active` TaxonomyVersion (no active version is 409 `taxonomy_not_active`), `parentId` other than null requires shape `hierarchical`,",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              "a vocabulary of the caller's organization without an active version is 409 taxonomy_not_active [P2-S12-AC-018]",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-act-tokens.test.ts',
            title:
              'CMS-03C-03 production port: token mapping (BE03c 1290, 1298-1306, 1375) taxonomy_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/060-hierarchy.sqlinc',
            title:
              'a parent in a flat vocabulary is 422 at /parentId: the shape is flat [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/060-hierarchy.sqlinc',
            title:
              'a hierarchical vocabulary accepts a root, a child and a grandchild; each resource names its parent [P2-S12-AC-016]',
          },
        ],
      },
      {
        text: "and assigning a term to a field requires the vocabulary's active version to list the entry content type's key in `allowedTypeKeys` and the field key in `allowedFieldKeys`.",
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "and assigning a term to a field requires the vocabulary\'s active version to list the entry conten...": missing test (and missing implementation): the entry-side term assignment is still `taxonomy_source_unavailable` (migrations 20261005010100_cms_field_kind_encodings.sql:364-393; AC-246). Once built: pgTAP in supabase/tests/phase_02_slice_12_taxonomy_terms (new 100-assignment-allowlists.sqlinc) assigning a term whose active version omits the entry type key from allowedTypeKeys, then one whose allowedFieldKeys omits the field key, each refused with no write; BE03c Taxonomy (allowedTypeKeys/allowedFieldKeys). The selector read (taxonomy_terms_reads/050-selector.sqlinc) filters by the allowlists but is not an assignment check and is not cited.',
  },
  {
    criterion: 'P2-S12-AC-222',
    text: "Canonical overlap (DEC-135): the overlap check runs only against the `canonicalOverlapDomains` declared by the vocabulary's active version, so for `create`, `rename` and `alias` over a declared built domain a `match` from CMS-03C-18 refuses the action with 422 `TAXONOMY_VALIDATION_FAILED` `canonical_overlap` carrying `details.domain` and `details.canonicalId` and creates nothing, `merge` and `deprecate` run no overlap check, and a vocabulary that declares no domain is never checked.",
    clauses: [
      {
        text: "Canonical overlap (DEC-135): the overlap check runs only against the `canonicalOverlapDomains` declared by the vocabulary's active version, so for `create`, `rename` and `alias` over a declared built domain a `match` from CMS-03C-18 refuses the action with 422 `TAXONOMY_VALIDATION_FAILED` `canonical_overlap` carrying `details.domain` and `details.canonicalId` and creates nothing, `merge` and `deprecate` run no overlap check, and a vocabulary that declares no domain is never checked.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'a key, a label, a normalized alias, a later-locale label, a rename label and an alias that equal a role facet are all 422 canonical_overlap [P2-S12-AC-141]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'each refusal names exactly the domain and the canonical id to reference instead, and nothing else [P2-S12-AC-141]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'no overlap refusal created a term, label, alias, audit, outbox, idempotency or job row [P2-S12-AC-141]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'vf declares no canonical domain, so a key, label and alias equal to role facets are accepted: the overlap check is per declared domain [P2-S12-AC-141]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'a failing provider does not touch an undeclared vocabulary, a deprecate or a merge: they introduce no new string and run no overlap check [P2-S12-AC-141]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-act-tokens.test.ts',
            title:
              'CMS-03C-03 production port: token mapping (BE03c 1290, 1298-1306, 1375) canonical_overlap',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-223',
    text: 'Unbuilt canonical domain (DEC-135): a declared domain whose provider is `unbuilt` is refused with the typed `canonical_source_unavailable` carrying `details.domain` at taxonomy-version activation and, defensively, at every `create`, `rename` and `alias` action, and a provider fault or timeout is 503 `DEPENDENCY_UNAVAILABLE` with no editorial write.',
    clauses: [
      {
        text: 'Unbuilt canonical domain (DEC-135): a declared domain whose provider is `unbuilt` is refused with the typed `canonical_source_unavailable` carrying `details.domain` at taxonomy-version activation',
        citations: [],
      },
      {
        text: 'and, defensively, at every `create`, `rename` and `alias` action,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/099-registry-drift.sqlinc',
            title:
              'create, rename and alias are refused canonical_source_unavailable when a declared domain has no built provider [P2-S12-AC-140]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/099-registry-drift.sqlinc',
            title:
              'each refusal carries exactly details.domain naming the unbuilt declared domain [P2-S12-AC-140]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-act-tokens.test.ts',
            title:
              'CMS-03C-03 production port: token mapping (BE03c 1290, 1298-1306, 1375) canonical_source_unavailable',
          },
        ],
      },
      {
        text: 'and a provider fault or timeout is 503 `DEPENDENCY_UNAVAILABLE` with no editorial write.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'with the role provider failing, create, rename and alias are 503 DEPENDENCY_UNAVAILABLE: never a success-shaped body [P2-S12-AC-140]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "Unbuilt canonical domain (DEC-135): a declared domain whose provider is `unbuilt` is refused with...": missing test: pgTAP, supabase/tests/phase_02_slice_12_governed_activation (or taxonomy_definition 060): activate (CMS-03C-09) a taxonomy version whose declared domain has lost its provider (registry drift) and assert 422 canonical_source_unavailable with DETAIL {"domain":...}, no state change (BE03c 413, 1407-1410, 1680). Only submission is asserted today (taxonomy_definition/060-review-successor.sqlinc: `<domain>: canonical-source refusal identifies its declared domain`, submit-time), which is a different command.',
  },
  {
    criterion: 'P2-S12-AC-224',
    text: 'Term actions: `create` inserts a term with lifecycle `active` and its first labels, `rename` appends a new label version and never changes the key, `alias` appends an alias, `deprecate` moves the term to `deprecated` (still resolvable, not newly assignable), a `merged` term never reactivates, and label versions are immutable (a replacement creates a new version).',
    clauses: [
      {
        text: 'Term actions: `create` inserts a term with lifecycle `active` and its first labels,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/030-create.sqlinc',
            title:
              'one version-1 label row exists per submitted locale, owner-bound and active [P2-S12-AC-016]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/030-create.sqlinc',
            title:
              'the resource names the stable term id, the vocabulary lineage, the key, lifecycle active, version "1" and null parent and successor [P2-S12-AC-016]',
          },
        ],
      },
      {
        text: '`rename` appends a new label version and never changes the key,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/070-rename-alias-deprecate.sqlinc',
            title:
              'rename keeps the term id and key, advances the version to 2 and the update instant, and changes the content hash [P2-S12-AC-016]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/070-rename-alias-deprecate.sqlinc',
            title:
              'rename appended label versions (en-US 2, de-DE 1) and left the version-1 en-US row unchanged: labels are append-only [P2-S12-AC-016]',
          },
        ],
      },
      {
        text: '`alias` appends an alias,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/070-rename-alias-deprecate.sqlinc',
            title:
              'alias appends only the new aliases to the existing ones (a repeated alias is not duplicated), consuming version 3 [P2-S12-AC-016]',
          },
        ],
      },
      {
        text: '`deprecate` moves the term to `deprecated` (still resolvable,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/070-rename-alias-deprecate.sqlinc',
            title:
              'deprecate moves the term to deprecated at version 5 with the same id and no successor [P2-S12-AC-016]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/070-rename-alias-deprecate.sqlinc',
            title:
              'a deprecated term keeps its aliases and labels: it stays resolvable [P2-S12-AC-016]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title:
              'lifecycle=deprecated lists only deprecated terms [P2-S12-AC-184]',
          },
        ],
      },
      {
        text: 'not newly assignable),',
        citations: [],
      },
      {
        text: 'a `merged` term never reactivates,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'a merged term cannot reactivate',
          },
        ],
      },
      {
        text: 'and label versions are immutable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'a label version cannot be changed in place',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'label and assignment version rows reject UPDATE and DELETE',
          },
        ],
      },
      {
        text: '(a replacement creates a new version).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/070-rename-alias-deprecate.sqlinc',
            title:
              'rename appended label versions (en-US 2, de-DE 1) and left the version-1 en-US row unchanged: labels are append-only [P2-S12-AC-016]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "not newly assignable),": The "not newly assignable" half has no test: assigning a deprecated term to a field is the unbuilt value encoder (AC-246, still taxonomy_source_unavailable). missing test (after AC-246): pgTAP assigning a deprecated term on a new field value is refused term_unavailable while an existing assignment is tolerated (AC-239).',
  },
  {
    criterion: 'P2-S12-AC-225',
    text: 'Term merge: `merge` locks the survivor and the retired term (`FOR UPDATE` in id order), requires a survivor that is `active` or `deprecated` and a retired term that is not already `merged`, sets the retired term `merged` with its `successor_id`, and keeps the retired id as a permanent redirect.',
    clauses: [
      {
        text: 'Term merge: `merge` locks the survivor and the retired term (`FOR UPDATE` in id order),',
        citations: [],
      },
      {
        text: 'requires a survivor that is `active` or `deprecated` and a retired term that is not already `merged`,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title: 'a deprecated term is an accepted survivor [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'a deprecated term can be merged: active to deprecated to merged, one version per action (1, 2, 3) [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'rename, alias, deprecate, a second merge and a re-create of a merged term are all 409: a merged id never reactivates [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'a merged redirect cannot be a survivor: no redirect chains [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'merge of an active term into an active survivor is accepted [P2-S12-AC-016]',
          },
        ],
      },
      {
        text: 'sets the retired term `merged` with its `successor_id`,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'the retired row is merged with the survivor as successor and the survivor row itself is untouched [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'the resource is the RETIRED term, now merged at version 2, naming the survivor: the retired id is a permanent redirect [P2-S12-AC-003]',
          },
        ],
      },
      {
        text: 'and keeps the retired id as a permanent redirect.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'merge requires a permanent survivor redirect',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'a merged term cannot reactivate',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "Term merge: `merge` locks the survivor and the retired term (`FOR UPDATE` in id order),": missing test: the merge command\'s own lock order is unasserted. A source regexp over the convergence batch (taxonomy_terms/085-continuation.sqlinc:198-200, `the convergence batch locks the retired term and its survivor in ONE statement in ascending id order…`) pins only the batch function, not cms_act_taxonomy_term merge (BE03c 1377). Needed: race module (new supabase/tests/phase_02_slice_12_taxonomy_merge_lock.race.mjs): two concurrent merges A->B and B->A on the same pair, both in id order, assert no deadlock (one wins, the other CONFLICT) — or a pg_proc source-order oracle on the command. Not cited because the batch oracle is a different function.',
  },
  {
    criterion: 'P2-S12-AC-226',
    text: "Term merge convergence: `merge` re-points every `active` TermAssignment of the retired term to the survivor by appending superseding assignment versions, converging up to 5,000 assignments in the same transaction and continuing a larger set through the idempotent job `cms.taxonomy.merge_converge` (a BE00 jobs row bound to the merge command's actor and acting party) from a durable cursor, with the retired id resolving to the survivor throughout.",
    clauses: [
      {
        text: "Term merge convergence: `merge` re-points every `active` TermAssignment of the retired term to the survivor by appending superseding assignment versions, converging up to 5,000 assignments in the same transaction and continuing a larger set through the idempotent job `cms.taxonomy.merge_converge` (a BE00 jobs row bound to the merge command's actor and acting party) from a durable cursor, with the retired id resolving to the survivor throughout.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'an assignment of the retired term is superseded and re-pointed: the survivor gets an active row at the same position [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/097-bulk-continuation.sqlinc',
            title:
              'exactly 5,000 survivor assignments were appended in the merge transaction [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/097-bulk-continuation.sqlinc',
            title:
              'exactly 5,000 retired assignments were superseded in the merge transaction [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/097-bulk-continuation.sqlinc',
            title:
              'the merge enqueued exactly one continuation job (the remaining > 0 branch of the real command) [P2-S12-AC-021]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/097-bulk-continuation.sqlinc',
            title:
              'the job is a queued BE00 row bound to the actor and the acting party [P2-S12-AC-021]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/097-bulk-continuation.sqlinc',
            title:
              'the handler converges the one remaining assignment through the platform_api transport and reports none left [P2-S12-AC-021]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/097-bulk-continuation.sqlinc',
            title:
              'a re-delivery of the job finds nothing to do [P2-S12-AC-021]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/097-bulk-continuation.sqlinc',
            title:
              'the retired id resolved to the survivor throughout [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/0971-chained-continuation.sqlinc',
            title:
              'the merge transaction converged exactly 5,000 and enqueued exactly one continuation job (40 assignments left) [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/0971-chained-continuation.sqlinc',
            title: 'and the chain converged all 40 [P2-S12-AC-226]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/085-continuation.sqlinc',
            title:
              'a re-delivery of the same job under the same lease converges one more and names the SAME continuation job: the continuation is idempotent per job [P2-S12-AC-021]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/097-bulk-continuation.sqlinc',
            title:
              'the resource names the survivor immediately: the retired id resolves to it although the convergence is not complete [P2-S12-AC-003]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-227',
    text: 'Related-content targets (D11): a pin target must exist, differ from the source, have lifecycle `active`, belong to the same owner party as the source and be readable by the caller under the draft-read predicate, an exclusion target must exist and be readable by the caller (its lifecycle is not constrained), and an ineligible, hidden or absent pin or exclusion is one uniform 422 `RELATED_CONTENT_VALIDATION_FAILED` `related_target_ineligible` at `/pins/{n}` or `/exclusions/{n}` with identical bodies, so that a write is never an existence oracle.',
    clauses: [
      {
        text: 'Related-content targets (D11): a pin target must exist, differ from the source, have lifecycle `active`, belong to the same owner party as the source and be readable by the caller under the draft-read predicate, an exclusion target must exist and be readable by the caller (its lifecycle is not constrained), and an ineligible, hidden or absent pin or exclusion is one uniform 422 `RELATED_CONTENT_VALIDATION_FAILED` `related_target_ineligible` at `/pins/{n}` or `/exclusions/{n}` with identical bodies, so that a write is never an existence oracle.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'an absent, self, archived, held, unassigned (hidden) and other-owner pin each give related_target_ineligible [P2-S12-AC-227]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'the six refusals are byte-identical: a write is never an existence oracle [P2-S12-AC-227]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'the refusal names the offending pin by index [P2-S12-AC-227]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'an absent, hidden or other-owner exclusion gives one identical refusal [P2-S12-AC-227]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'it is related_target_ineligible at /exclusions/0 [P2-S12-AC-227]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title: 'the answer lists them in request order [P2-S12-AC-228]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-typed-refusals.test.ts',
            title:
              'CMS-03C-05 typed refusals (BE03c 1304, 1380-1383) publishes related_target_ineligible with the offending row pointers as one uniform 422',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-related.test.ts',
            title:
              'CMS-03C-05 production related-content adapter maps the typed uniform refusal to a 422 with the offending row pointers',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-related.test.ts',
            title:
              'CMS-03C-05 production related-content adapter serves the whole route: a typed refusal reaches the browser as one uniform 422',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-228',
    text: 'Related-content rule storage: rules are append-only versions, a request replaces the whole rule set (pins in array order as `position`, exclusions and the derived rule) by appending `revoked` rows for removed items and `active` rows for new ones, the strong `If-Match` is the source entry `version`, and derived rows carry no target while pin and exclude rows require one.',
    clauses: [
      {
        text: 'Related-content rule storage: rules are append-only versions,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_related_authority.sql',
            title: 'related-content rules are append-only',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_related_authority.sql',
            title:
              'locale and related-content versions reject direct writes and mutation',
          },
        ],
      },
      {
        text: 'a request replaces the whole rule set (pins in array order as `position`, exclusions and the derived rule) by appending `revoked` rows for removed items and `active` rows for new ones,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/004-replace.sqlinc',
            title:
              'B: a removed pin is revoked (v2); a moved pin is revoked (v2) then active again (v3); the changed rule is revoked then added; an unchanged exclusion adds nothing; a new exclusion is active v1 [P2-S12-AC-228]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/004-replace.sqlinc',
            title:
              'B: the live set is the new request: pins c3 (0), c1 (1), both exclusions and the same-type-recent rule [P2-S12-AC-228]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'pins are stored in array order as position, exclusions and the derived rule as active version-1 rows [P2-S12-AC-228]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/004-replace.sqlinc',
            title:
              'D: five revoked rows were appended in the one write, one per live item [P2-S12-AC-228]',
          },
        ],
      },
      {
        text: 'the strong `If-Match` is the source entry `version`,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/007-cas-and-locks.sqlinc',
            title: 'a write at the live version succeeds [P2-S12-AC-061]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/007-cas-and-locks.sqlinc',
            title:
              'the previous operand is now stale: the loser of two writers from version 1 is refused [P2-S12-AC-061]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/007-cas-and-locks.sqlinc',
            title:
              'a version ahead of the entry is a version mismatch [P2-S12-AC-061]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'the resource version is the NEW entry aggregate version, the next If-Match operand [P2-S12-AC-061]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title:
              'an If-Match that differs from expectedVersion is an invalid request [P2-S12-AC-038]',
          },
        ],
      },
      {
        text: 'and derived rows carry no target while',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_related_authority.sql',
            title: 'derived rule cannot hardcode a target entry',
          },
        ],
      },
      {
        text: 'pin and exclude rows require one.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "pin and exclude rows require one.": missing test: pgTAP, supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc: an `exclude` row inserted WITHOUT target_entry_id is refused by the table CHECK (23514) beside the existing pin-row probe (`a pin row requires a target (existing table CHECK) [P2-S12-AC-228]`, :77), BE03c 1385 / Canonical records. Only the pin kind is asserted today, so the clause (pin AND exclude rows require a target) is not cited.',
  },
  {
    criterion: 'P2-S12-AC-229',
    text: 'Derived-rule registry (OD-5): the code-owned registry `CMS_RELATED_RULES` has `shared-terms` (reason `shared_terms`) and `same-type-recent` (reason `same_type_recent`) at version 1, a rule row selects exactly one, `derivedRule.reasonCode` is an equality expectation of the registry value, `maxCandidates` is 1-128, the rule key and version are validated by `platform_private.cms_related_rule_valid`, and an unknown key or version is 422 `derived_rule_unknown`.',
    clauses: [
      {
        text: 'Derived-rule registry (OD-5): the code-owned registry `CMS_RELATED_RULES` has `shared-terms` (reason `shared_terms`) and `same-type-recent` (reason `same_type_recent`) at version 1, a rule row selects exactly one, `derivedRule.reasonCode` is an equality expectation of the registry value, `maxCandidates` is 1-128, the rule key and version are validated by `platform_private.cms_related_rule_valid`, and an unknown key or version is 422 `derived_rule_unknown`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'cms_related_rule_valid accepts shared-terms at version 1 [P2-S12-AC-229]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'cms_related_rule_valid accepts same-type-recent at version 1 [P2-S12-AC-229]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'an unregistered key is not valid: no arbitrary query or expression [P2-S12-AC-229]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'an unregistered version of a registered rule is not valid [P2-S12-AC-229]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'a derived row whose reason code is not the registry reason of its rule is refused [P2-S12-AC-229]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title: 'maxCandidates above 128 is refused [P2-S12-AC-229]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title: 'maxCandidates below 1 is refused [P2-S12-AC-229]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'a derived row must select a rule: a derived row without a rule key is refused [P2-S12-AC-228]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title:
              'a well-formed key outside the registry is derived_rule_unknown [P2-S12-AC-229]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-public-target.test.ts',
            title:
              'CMS-03C-21 related public targets (D11, OD-5) [P2-S12-AC-229] holds the code-owned rule registry to shared-terms and same-type-recent at version 1',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-typed-refusals.test.ts',
            title:
              'CMS-03C-05 typed refusals (BE03c 1304, 1380-1383) publishes derived_rule_unknown at its member pointer',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title:
              'an unregistered version of a registered rule is derived_rule_unknown [P2-S12-AC-229]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title:
              'a reasonCode that is not the registry value of the rule is refused [P2-S12-AC-229]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title: 'maxCandidates 129 is refused [P2-S12-AC-037]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-related.test.ts',
            title:
              'CMS-03C-05 production related-content adapter maps derived_rule_unknown, capability_missing and the schema failure',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-230',
    text: "Related-content `eligibleCount`: a rule is never evaluated at write time except to compute `eligibleCount` (the eligible pins plus the derived candidates for the source revision's locale and the audience of the source's most recent active publication, with 0 derived when the source has none), and the count never exceeds 128.",
    clauses: [
      {
        text: "Related-content `eligibleCount`: a rule is never evaluated at write time except to compute `eligibleCount` (the eligible pins plus the derived candidates for the source revision's locale and the audience of the source's most recent active publication, with 0 derived when the source has none), and the count never exceeds 128.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'a published source: one pin plus the two derived candidates its maxCandidates allows [P2-S12-AC-230]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'with room for all candidates: one pin plus the nine eligible public candidates (pinned and excluded entries are not candidates) [P2-S12-AC-230]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'no derived rule: eligibleCount is the pins alone [P2-S12-AC-230]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'a source with no publication has 0 derived candidates: one pin, eligibleCount 1 [P2-S12-AC-230]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'the audience is that of the most recent active publication (members): only x4 is a members candidate, not the nine public ones [P2-S12-AC-230]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'eligibleCount is recomputed on every write from live publications, not read from an earlier write [P2-S12-AC-230]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/003-bound.sqlinc',
            title:
              'eligibleCount never exceeds 128 (32 pins plus 100 candidates) [P2-S12-AC-230]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'a pinned entry published after the pin appears at its pin position: nothing was stored at write time [P2-S12-AC-156]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-231',
    text: "Derived `shared-terms` ranking: candidates are entries of the same owner with an `active` publication head for the requested locale and audience, other than the source, not excluded and not already pinned, ranked by the number of active terms shared with the source's term assignments (the published revision's in a public projection, the draft's in an editorial preview) descending, then the target head's `created_at` descending, then `entryId` ascending.",
    clauses: [
      {
        text: "Derived `shared-terms` ranking: candidates are entries of the same owner with an `active` publication head for the requested locale and audience, other than the source, not excluded and not already pinned, ranked by the number of active terms shared with the source's term assignments (the published revision's in a public projection, the draft's in an editorial preview) descending, then the target head's `created_at` descending, then `entryId` ascending.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'pin c2 first, then the four best-ranked eligible candidates (two shared terms: srcp, c6, c5 by head created_at desc; then c3 with one); the excluded c1 and the pinned c2 are not candidates [P2-S12-AC-231]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              "published-revision ranking: score 2 (c6 c5 c1 by head created_at desc), score 1 (c3 c2), score 0 (xo x7 x6 srcm c7 c4); a deprecated, superseded or revoked term counts for nothing; the draft's term3 is ignored [P2-S12-AC-231]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'preview ranking uses the draft terms {term1, term2}: srcp joins the score-2 group at the top [P2-S12-AC-231]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'shared-terms: srcp (newest, two shared), then the tied c5/c6 by entry id ascending, then c2 (one shared), then the zero-share group x5 xo srcm and the tied c7/c4 by entry id ascending [P2-S12-AC-231]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'the derived list follows: the archived x6, held x7, foreign-owned c1 and unpublished c3 are gone, the newly published x5 leads (exclusion of c3 still wins) [P2-S12-AC-157]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-232',
    text: "Derived `same-type-recent` ranking: the same candidate set restricted to the source's content type is ranked by the target head's `created_at` descending then `entryId` ascending, and at most `maxCandidates` derived candidates are used.",
    clauses: [
      {
        text: "Derived `same-type-recent` ranking: the same candidate set restricted to the source's content type is ranked by the target head's `created_at` descending then `entryId` ascending, and at most `maxCandidates` derived candidates are used.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'pin c3 first (not repeated as a candidate), then the three most recent same-type candidates [P2-S12-AC-232]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'all same-type eligible candidates by head created_at desc; the article-typed c5 and the excluded c3 are absent [P2-S12-AC-232]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'an article-typed source ranks only article-typed candidates [P2-S12-AC-232]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'derived candidates carry the registry reason same_type_recent [P2-S12-AC-232]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'same-type-recent: head created_at desc with the tied c7/c4 by entry id ascending; the article c5 is outside the type [P2-S12-AC-232]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-233',
    text: "Locale configuration check (OD-4): CMS-03C-04 requires `locale` to be a member of the active content-type version's `supportedLocales` (422 `LOCALE_VALIDATION_FAILED` otherwise) and `fallbackChain` to equal, element for element, that version's `fallbackChains` entry for `locale` (`[]` exactly when `locale` is its `defaultLocale`); any difference in membership, order or length is 409 `LOCALE_VERSION_CONFLICT` with `details.reasonCode` `FALLBACK_CHAIN_MISMATCH` and `details.activeFallbackChain` (at most 16 tags) and writes no variant, and after a successor changes the chain the new chain applies and the old chain is refused.",
    clauses: [
      {
        text: "Locale configuration check (OD-4): CMS-03C-04 requires `locale` to be a member of the active content-type version's `supportedLocales` (422 `LOCALE_VALIDATION_FAILED` otherwise)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              "a locale outside the active version's supportedLocales is a validation failure (422)",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter maps a locale outside supportedLocales to the 422 catalog code without a chain',
          },
        ],
      },
      {
        text: "and `fallbackChain` to equal, element for element, that version's `fallbackChains` entry for `locale`",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'the exact active chain and a supported locale author a variant',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'a fallbackChain that differs from the active chain is a 409 version conflict',
          },
        ],
      },
      {
        text: '(`[]` exactly when `locale` is its `defaultLocale`);',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc',
            title:
              'the empty fallbackChain is accepted for the default locale (en-US), sourced from a locale revision [P2-S12-AC-233]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc',
            title:
              'a non-empty chain for the default locale is the 409 FALLBACK_CHAIN_MISMATCH with the active chain [] [P2-S12-AC-233]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc',
            title:
              'control: the empty chain is refused for a non-default locale, whose active chain is [en-US] [P2-S12-AC-233]',
          },
        ],
      },
      {
        text: 'any difference in membership, order or length is 409 `LOCALE_VERSION_CONFLICT` with `details.reasonCode` `FALLBACK_CHAIN_MISMATCH` and `details.activeFallbackChain` (at most 16 tags) and writes no variant,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'a fallbackChain that differs from the active chain is a 409 version conflict',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'the conflict detail carries the reason code and the active chain',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'an empty chain for a locale whose active chain is [en-US] is a conflict',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title: 'a longer chain than the active one is a conflict',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'a refused authoring writes no variant, no revision and does not move the entry version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter carries the active fallback chain on a chain-equality conflict (OD-4)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              'CMS-03C-04 fallback-chain equality conflict (OD-4) accepts the active chain, bounded at sixteen canonical tags',
          },
        ],
      },
      {
        text: 'and after a successor changes the chain the new chain applies and the old chain is refused.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "and after a successor changes the chain the new chain applies and the old chain is refused.": missing test: pgTAP in supabase/tests/phase_02_slice_12_locale_config_enforcement.sql: activate a successor content-type version that changes the chain for a locale, then author with the new chain (accepted) and the old chain (409 FALLBACK_CHAIN_MISMATCH carrying the new activeFallbackChain). Every cited enforcement test runs against one active version.',
  },
  {
    criterion: 'P2-S12-AC-234',
    text: 'Derived locale variant state: a stored LocaleVariant row is `draft` (written by CMS-03C-04) or `stale` (appended by the source-change fan-out), while the browser `LocaleVariantState` also shows `review` and `approved`, derived from the editorial review of the locale revision by the 03b effective-state rule (`submitted` shows `review`; `approved` and `published` show `approved`), and `untranslated` when no variant exists for the locale.',
    clauses: [
      {
        text: 'Derived locale variant state: a stored LocaleVariant row is `draft` (written by CMS-03C-04) or `stale` (appended by the source-change fan-out), while the browser `LocaleVariantState` also shows `review` and `approved`, derived from the editorial review of the locale revision by the 03b effective-state rule (`submitted` shows `review`; `approved` and `published` show `approved`), and `untranslated` when no variant exists for the locale.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a variant whose revision has an approved review is shown approved [P2-S12-AC-234]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a variant whose revision has an open review (effective state submitted) is shown review [P2-S12-AC-234]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a variant whose revision is scheduled is shown approved, in agreement with the gate [P2-S12-AC-234]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a variant whose revision is published is shown approved [P2-S12-AC-234]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc',
            title: 'a locale with no variant is untranslated [P2-S12-AC-234]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title:
              'the physical state is draft or stale: review, approved and untranslated are derived, never stored [P2-S12-AC-260]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-235',
    text: "Per-field staleness: the variant records `field_source_hashes` (the source value hash of each translated field at write time), a field is stale when the current source value hash differs, `staleFieldIds` carries those fields, unchanged fields keep their approved state, and explicit revalidation is a new CMS-03C-04 write with the current `sourceHash` that appends a `draft` row and returns to `approved` only through the revision's editorial review.",
    clauses: [
      {
        text: "Per-field staleness: the variant records `field_source_hashes` (the source value hash of each translated field at write time), a field is stale when the current source value hash differs, `staleFieldIds` carries those fields, unchanged fields keep their approved state, and explicit revalidation is a new CMS-03C-04 write with the current `sourceHash` that appends a `draft` row and returns to `approved` only through the revision's editorial review.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title:
              'field_source_hashes records the source value hash of each translated field at write time; an absent source value is the hash of JSON null [P2-S12-AC-235]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc',
            title:
              'the live per-field staleness lists exactly the translated field whose current source value hash differs [P2-S12-AC-235]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc',
            title:
              'the stored stale_field_ids is exactly the changed translated field (title), not a superset [P2-S12-AC-235]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc',
            title:
              'the date was translated against an absent source value, so only it differs now; the unchanged title keeps its approved state [P2-S12-AC-235]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc',
            title:
              'revalidation appends a draft version (4) with no stale fields [P2-S12-AC-235]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc',
            title:
              'a revalidated variant is draft until the revision editorial review approves it [P2-S12-AC-234]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-236',
    text: 'Locale fan-out bound (D12): a source-locale change appends stale rows synchronously for at most 32 dependent locale variants per entry, and a request that would create a 33rd distinct locale variant is refused 409 `LOCALE_VERSION_CONFLICT` `locale_limit_reached`.',
    clauses: [
      {
        text: 'Locale fan-out bound (D12): a source-locale change appends stale rows synchronously for at most 32 dependent locale variants per entry,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_locale_fanout_branch.sql',
            title:
              'a fan-out at exactly the limit answers the number of dependent locales',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_locale_fanout_branch.sql',
            title:
              'three dependent locales over a limit of two are refused, never truncated',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_locale_fanout_branch.sql',
            title: 'one stale variant is appended per dependent locale',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_source_stale.sql',
            title:
              'a changed source appends one stale version for each dependent locale',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_source_stale.sql',
            title:
              'the second source-dependent locale is invalidated in the same transaction',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc',
            title:
              'a source-locale change appends a stale row for each of the 32 dependent locale variants [P2-S12-AC-236]',
          },
        ],
      },
      {
        text: 'and a request that would create a 33rd distinct locale variant is refused 409 `LOCALE_VERSION_CONFLICT` `locale_limit_reached`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc',
            title:
              'a request that would create a 33rd distinct locale variant is the 409 conflict [P2-S12-AC-236]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc',
            title:
              'the 409 carries the machine reason locale_limit_reached [P2-S12-AC-236]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc',
            title:
              'the refused 33rd locale writes no variant, revision, event or idempotency record and does not move the entry version [P2-S12-AC-236]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc',
            title:
              'an existing locale can still be rewritten at the ceiling: only a new locale is refused [P2-S12-AC-236]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes-refusals.test.ts',
            title:
              'CMS-03C-04 locale authoring route [P2-S12-AC-236] returns locale_limit_reached on the 409 of a 33rd locale variant and nothing else',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter [P2-S12-AC-236] carries locale_limit_reached on the 33rd-locale conflict and nothing else',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-237',
    text: "Locale event identity (D12): every locale variant and every stale row is a version of the locale aggregate `(entry, locale)`, and the outbox identity of `cms.localization.changed.v1` is aggregateType `cms_locale_variant`, aggregateId a UUIDv5 over the entry id and locale under the fixed namespace `cms.locale.aggregate.v1`, and aggregateVersion the variant row's `version`, so that the author RPC and the fan-out writer never share a dedupe key.",
    clauses: [
      {
        text: "Locale event identity (D12): every locale variant and every stale row is a version of the locale aggregate `(entry, locale)`, and the outbox identity of `cms.localization.changed.v1` is aggregateType `cms_locale_variant`, aggregateId a UUIDv5 over the entry id and locale under the fixed namespace `cms.locale.aggregate.v1`, and aggregateVersion the variant row's `version`, so that the author RPC and the fan-out writer never share a dedupe key.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title:
              'the locale aggregate id is a UUIDv5 over the entry id and locale under the namespace cms.locale.aggregate.v1 [P2-S12-AC-237]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title:
              'the author RPC emits cms.localization.changed.v1 under (cms_locale_variant, UUIDv5(entry, locale), variant version) [P2-S12-AC-237]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc',
            title:
              'the author RPC and the fan-out writer never share a dedupe key [P2-S12-AC-237]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc',
            title:
              'fr-FR walks versions 1 (author), 2 (author rewrite) and 3 (fan-out stale) of one aggregate [P2-S12-AC-237]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-238',
    text: 'Preflight provider `cms.pattern.active_digest` version 1 (category `pattern`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate`. Live pinned PatternVersions require active state, equal frozen content hashes and equal recomputed reachable block-registry digests; every reached pinned nested version must also remain active and satisfy the existing graph compatibility rule (DEC-199). Failure reasons are `pattern_not_active`, `nested_pattern_not_active`, `pattern_digest_changed` and `pattern_block_rules_violated` (DEC-210). A nonnull canonical detached tree validates its own blocks/digest without reopening its retained pattern provenance; NULL-tree linked/legacy detached rows keep live checks, and mixed live/provenance use still validates the live use. Manifest provenance identities are retained (DEC-193).',
    clauses: [
      {
        text: 'Preflight provider `cms.pattern.active_digest` version 1 (category `pattern`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate`.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight-pattern-provider.test.ts',
            title:
              'BE03c pattern preflight provider (DEC-199) keeps the main registry and Slice 12 provider catalog on one active-digest row',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/preflight-providers.test.ts',
            title:
              'Preflight providers registered by Slice 12 (BE03c) [P2-S12-AC-241] registers exactly the pattern, taxonomy and locale providers, each replacing a reference gate',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-sql-parity.test.ts',
            title:
              '[P2-S11-AC-093] the SQL preflight registry seed equals CMS_PREFLIGHT_REGISTRY [P2-S12-AC-241] replaces the seeded reference gate only for categories whose provider a later slice registered',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness/010-provenance-currentness.sqlinc',
            title:
              'PC-REG-01: real current immutable registry row replaces only the pattern reference gate',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness/010-provenance-currentness.sqlinc',
            title:
              'PC-REG-02: original immutable pattern registry row remains intact',
          },
        ],
      },
      {
        text: 'Live pinned PatternVersions require active state, equal frozen content hashes and equal recomputed reachable block-registry digests;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-P02-legacy-inactive: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-P14-frozen-hash: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-D05-live-digest: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-P03-live: exact actual pattern provider outcome/reason/single-offender count',
          },
        ],
      },
      {
        text: 'every reached pinned nested version must also remain active',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-N05-transitive: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-N03-live-publish: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-N01-control: exact actual pattern provider outcome/reason/single-offender count',
          },
        ],
      },
      {
        text: 'and satisfy the existing graph compatibility rule (DEC-199).',
        citations: [],
      },
      {
        text: 'Failure reasons are `pattern_not_active`, `nested_pattern_not_active`, `pattern_digest_changed` and `pattern_block_rules_violated` (DEC-210).',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight-pattern-provider.test.ts',
            title:
              'BE03c pattern preflight provider (DEC-199) parses every closed pattern reason through result, report and refusal contracts',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/preflight-providers.test.ts',
            title:
              'Preflight providers registered by Slice 12 (BE03c) [P2-S12-AC-238] closes the pattern provider to its own failure reasons',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-P02-legacy-inactive: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-N05-transitive: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-D04-selected-digest: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules/070-provider.sqlinc',
            title:
              'BR-V05: the provider function itself answers failed with exactly one unit for the offending pin',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules_legacy.sql',
            title:
              'BR-V02-live-pin: exact actual pattern provider outcome/reason/single-offender count',
          },
        ],
      },
      {
        text: 'A nonnull canonical detached tree validates its own blocks/digest without reopening its retained pattern provenance;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-P01-submit: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-N08-canonical-target: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-P05-target-snapshot: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-D04-selected-digest: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules_legacy.sql',
            title:
              'BR-V03-canonical-tree: exact actual pattern provider outcome/reason/single-offender count',
          },
        ],
      },
      {
        text: 'NULL-tree linked/legacy detached rows keep live checks, and mixed live/provenance use still validates the live use.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-P02-legacy-inactive: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-N04-legacy-nulltree: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-P11-mixed-pin: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-N06-mixed-same-pin: exact actual pattern provider outcome/reason/single-offender count',
          },
        ],
      },
      {
        text: 'Manifest provenance identities are retained (DEC-193).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title: 'PC-P01-submit: exact effective provenance/live membership',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title: 'PC-P01-publish: exact effective provenance/live membership',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "and satisfy the existing graph compatibility rule (DEC-199).": missing test: pgTAP, supabase/tests/phase_02_slice_12_dec193_pattern_currentness/020-active-digest-provider.sqlinc: a reached nested active version whose compatible type set (or owner) no longer matches the parent produces nested_pattern_not_active. dec193_pattern_currentness/README.md states this branch "is not runtime-proven" (create/activate guards and definition immutability prevent constructing the state); needs either an authorised fixture or a direct provider-function probe with a synthesized manifest.',
  },
  {
    criterion: 'P2-S12-AC-239',
    text: "Preflight provider `cms.taxonomy.assignment_integrity` version 1 (category `taxonomy`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate`, requires every `active` TermAssignment of the revision to name an `active` term (a `deprecated` term is tolerated for an existing assignment and a `merged` term whose assignment has not converged fails `term_merged_unconverged`), the vocabulary's active version to still list the entry type key and field key (`allowlist_changed`), and every manifest taxonomy version id to be `active` (`taxonomy_version_not_active`).",
    clauses: [
      {
        text: "Preflight provider `cms.taxonomy.assignment_integrity` version 1 (category `taxonomy`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate`, requires every `active` TermAssignment of the revision to name an `active` term (a `deprecated` term is tolerated for an existing assignment and a `merged` term whose assignment has not converged fails `term_merged_unconverged`), the vocabulary's active version to still list the entry type key and field key (`allowlist_changed`), and every manifest taxonomy version id to be `active` (`taxonomy_version_not_active`).",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test is cited. Unproven: "Preflight provider `cms.taxonomy.assignment_integrity` version 1 (category `taxonomy`, `database`...": missing implementation and tests: no migration or WIP registers cms.taxonomy.assignment_integrity (only a contract descriptor exists). Needed: forward migration + pgTAP supabase/tests/phase_02_slice_12_taxonomy_assignment_integrity.sql asserting (1) the registry row is a newer row replacing preflight.reference_gate (category taxonomy, kind database), (2) an active assignment of a deprecated term passes while a merged-unconverged assignment fails term_merged_unconverged, (3) a changed allowlist fails allowlist_changed, (4) a non-active manifest taxonomy version fails taxonomy_version_not_active (BE03c Preflight providers registered by Slice 12). The contract tests (closed reason set, registry parity) prove only the descriptor and are not cited.',
  },
  {
    criterion: 'P2-S12-AC-240',
    text: "Preflight provider `cms.locale.no_fallback_gate` version 1 (category `locale`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate` and evaluates every `no_fallback` field of the revision's schema for the revision's locale in one statement: every blocking resolution fails the category with `no_fallback_missing` or `no_fallback_stale`, in the `schedule`, `publish` and `execute` phases a revision whose locale variant is not in effective state `approved`, `scheduled` or `published` fails with `locale_variant_not_approved` (never at `submit`; a missing value outranks a stale one, which outranks the approval check; DEC-192), and otherwise the category passes; the `route`, `media` and `privacy` categories stay on the reference gate.",
    clauses: [
      {
        text: "Preflight provider `cms.locale.no_fallback_gate` version 1 (category `locale`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate` and evaluates every `no_fallback` field of the revision's schema for the revision's locale in one statement: every blocking resolution fails the category with `no_fallback_missing` or `no_fallback_stale`, in the `schedule`, `publish` and `execute` phases a revision whose locale variant is not in effective state `approved`, `scheduled` or `published` fails with `locale_variant_not_approved` (never at `submit`;",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'the locale category is served by cms.locale.no_fallback_gate version 1 (database) as a newer registry row [P2-S12-AC-240]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a source-locale revision that holds no value for the no_fallback field blocks with no_fallback_missing [P2-S12-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a revision translated against an older source value of the no_fallback field blocks with no_fallback_stale [P2-S12-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a locale variant whose revision is not approved fails schedule acceptance with locale_variant_not_approved [P2-S12-AC-240]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a locale variant whose revision is not approved fails publication with locale_variant_not_approved [P2-S12-AC-240]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a locale variant whose revision is not approved fails scheduled execution with locale_variant_not_approved (DEC-192) [P2-S12-AC-240]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'submit never applies the approval check to a submitted locale revision (DEC-192) [P2-S12-AC-240]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a translation holding its no_fallback value passes at submit, where the revision is still a draft [P2-S12-AC-240]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-resolution.test.ts',
            title:
              'CMS-03C-20 locale field resolution (DEC-121, DEC-138) [P2-S12-AC-240] registers the no_fallback_gate provider and its three closed failure reasons',
          },
        ],
      },
      {
        text: 'a missing value outranks a stale one,',
        citations: [],
      },
      {
        text: 'which outranks the approval check; DEC-192), and otherwise the category passes;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a blocking field outranks the approval check [P2-S12-AC-240]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'stale blocks a locale revision that was previously approved but is now invalidated, and outranks the approval check [P2-S12-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'missing outranks the approval check at scheduled execution (DEC-192) [P2-S12-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a scheduled locale revision passes scheduled execution, where it is scheduled by construction (DEC-192) [P2-S12-AC-240]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'an approved locale revision passes publication [P2-S12-AC-240]',
          },
        ],
      },
      {
        text: 'the `route`, `media` and `privacy` categories stay on the reference gate.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-sql-parity.test.ts',
            title:
              '[P2-S11-AC-093] the SQL preflight registry seed equals CMS_PREFLIGHT_REGISTRY [P2-S12-AC-241] replaces the seeded reference gate only for categories whose provider a later slice registered',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-093] publication preflight registry (D19) [P2-S12-AC-240][P2-S12-AC-241] registers cms.locale.no_fallback_gate version 1 for the locale category as registry version 2 with its three closed reasons',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'the route, media and privacy categories stay on the reference gate [P2-S12-AC-240]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "a missing value outranks a stale one,": a missing value outranks a stale one is asserted nowhere: no test builds a revision with both a missing and a stale no_fallback field; each is only shown to outrank the approval check',
  },
  {
    criterion: 'P2-S12-AC-241',
    text: "Preflight dispatch: each Slice 12 provider is implemented in the deployed preflight evaluation before its registry row is inserted, so that no category evaluates `unavailable` with `provider_unavailable` because its provider is not implemented, and the contracts' per-category closed reason sets and the fixed reason copy accept exactly the reasons of `cms.pattern.active_digest` (including `pattern_not_active`, `nested_pattern_not_active` and `pattern_digest_changed`, DEC-199), `cms.taxonomy.assignment_integrity` and `cms.locale.no_fallback_gate`.",
    clauses: [
      {
        text: "Preflight dispatch: each Slice 12 provider is implemented in the deployed preflight evaluation before its registry row is inserted, so that no category evaluates `unavailable` with `provider_unavailable` because its provider is not implemented, and the contracts' per-category closed reason sets and the fixed reason copy accept exactly the reasons of `cms.pattern.active_digest` (including `pattern_not_active`, `nested_pattern_not_active` and `pattern_digest_changed`, DEC-199),",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'the deployed evaluator dispatches the locale category to the registered gate and reports its reason [P2-S12-AC-241]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'the locale category never evaluates unavailable with provider_unavailable [P2-S12-AC-241]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-P03-live: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/preflight-providers.test.ts',
            title:
              'Preflight providers registered by Slice 12 (BE03c) [P2-S12-AC-241] registers exactly the pattern, taxonomy and locale providers, each replacing a reference gate',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/preflight-providers.test.ts',
            title:
              'Preflight providers registered by Slice 12 (BE03c) [P2-S12-AC-241] gives no two providers a shared reason code',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-sql-parity.test.ts',
            title:
              '[P2-S11-AC-093] the SQL preflight registry seed equals CMS_PREFLIGHT_REGISTRY [P2-S12-AC-241] replaces the seeded reference gate only for categories whose provider a later slice registered',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight-pattern-provider.test.ts',
            title:
              'BE03c pattern preflight provider (DEC-199) parses every closed pattern reason through result, report and refusal contracts',
          },
        ],
      },
      {
        text: '`cms.taxonomy.assignment_integrity`',
        citations: [],
      },
      {
        text: 'and `cms.locale.no_fallback_gate`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'the deployed evaluator dispatches the locale category to the registered gate and reports its reason [P2-S12-AC-241]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'the locale category never evaluates unavailable with provider_unavailable [P2-S12-AC-241]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/preflight-providers.test.ts',
            title:
              'Preflight providers registered by Slice 12 (BE03c) [P2-S12-AC-241] registers exactly the pattern, taxonomy and locale providers, each replacing a reference gate',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-093] publication preflight registry (D19) [P2-S12-AC-241] knows the locale refusal tokens, so a revision blocked by the gate answers 422 preflight_failed and not a scrubbed 500',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "`cms.taxonomy.assignment_integrity`": cms.taxonomy.assignment_integrity is neither implemented nor registered (AC-239), and the contracts register the taxonomy category as the reference gate (preflight.ts referenceGateRow, reason provider_unbuilt_reference only), so the fixed reason copy does not accept its reasons',
  },
  {
    criterion: 'P2-S12-AC-242',
    text: "Taxonomy-version resolution (DEC-141): `platform_private.cms_resolve_taxonomy_version(p_taxonomy_version_id uuid)` resolves any taxonomy version id of the caller's owner scope, in any state from `draft` through `retired`, to `{ taxonomyId, taxonomyKey, taxonomyVersion, state, contentHash }` and answers an absent or out-of-scope id with the non-disclosing `comparison_unavailable`, so that CMS-03B-03 comparison and the CMS-03B-04 lineage compare recorded taxonomy versions by that identity and no longer fail closed for a non-empty reference.",
    clauses: [
      {
        text: "Taxonomy-version resolution (DEC-141): `platform_private.cms_resolve_taxonomy_version(p_taxonomy_version_id uuid)` resolves any taxonomy version id of the caller's owner scope, in any state from `draft` through `retired`, to `{ taxonomyId, taxonomyKey, taxonomyVersion, state, contentHash }` and answers an absent or out-of-scope id with the non-disclosing `comparison_unavailable`, so that CMS-03B-03 comparison and the CMS-03B-04 lineage compare recorded taxonomy versions by that identity and no longer fail closed for a non-empty reference.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test is cited. Unproven: "Taxonomy-version resolution (DEC-141): `platform_private.cms_resolve_taxonomy_version(p_taxonomy_...": missing implementation and tests: platform_private.cms_resolve_taxonomy_version does not exist (no migration, nothing in apps/packages). Needed: migration + pgTAP (new supabase/tests/phase_02_slice_12_taxonomy_version_resolve.sql): resolves a draft, active, superseded and retired version of the caller\'s owner scope to {taxonomyId, taxonomyKey, taxonomyVersion, state, contentHash}; an absent id and another owner\'s id answer the identical comparison_unavailable; CMS-03B-03/04 comparison of a revision with non-empty taxonomy_version_ids no longer fails closed (BE03c DEC-141).',
  },
  {
    criterion: 'P2-S12-AC-243',
    text: "Restore of composition instances (DEC-141, DEC-201): `cms_restore_revision` selects the named source revision's newest row at each path before eligibility and carries only its `active` rows into the new draft revision. A copied child's recorded parent is resolved within that source owner/revision by logical path to the newest eligible active copied parent, including historical parent references; an excluded parent or collapsed cycle refuses the entire restore atomically, without resurrecting history, dropping/detaching a child, fabricating topology or retaining a cross-revision edge. Fresh parent-first copies have immediate `carried_from_id` provenance, keep path, position, link mode and detached local block tree (DEC-193), and are re-pinned to the current registry, so that a pinned block version, or a block of a detached tree, that is `withdrawn` fails the restore 409 `migration_chain_incomplete`, a pinned pattern version that is no longer `active` fails it the same way unless the instance is `detached`, and a slot path absent from the current compatible template fails it 409 `template_incompatible`, with nothing fabricated. Pending/draft heads are not carried.",
    clauses: [
      {
        text: "Restore of composition instances (DEC-141, DEC-201): `cms_restore_revision` selects the named source revision's newest row at each path before eligibility and carries only its `active` rows into the new draft revision.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/022-restore-boundaries.sqlinc',
            title:
              'RR-MASK: only explicit active keeper, no pending carry or old-active resurrection',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/020-restore.sqlinc',
            title:
              'CC-RST004: source local full subtree wins over current linked target',
          },
        ],
      },
      {
        text: "A copied child's recorded parent is resolved within that source owner/revision by logical path to the newest eligible active copied parent, including historical parent references;",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/023-restore-parent-path.sqlinc',
            title:
              'RR-PARENT: exact child copy reconnects to fresh selected-P2 copy by source parent path, not P1 identity',
          },
        ],
      },
      {
        text: 'an excluded parent or collapsed cycle refuses the entire restore atomically, without resurrecting history, dropping/detaching a child, fabricating topology or retaining a cross-revision edge.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/023-restore-parent-path.sqlinc',
            title:
              'RR-PARENT-REFUSALS: existing translation token, full rollback; no child drop, detach, resurrection or cross-revision edge',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title: 'RR-PARENT-EXCLUDED: exact application refusal',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title: 'RR-PARENT-CYCLE: exact application refusal',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title:
              'RR-PARENT-EXCLUDED: all source history/children/parents remain unchanged',
          },
        ],
      },
      {
        text: 'Fresh parent-first copies have immediate `carried_from_id` provenance, keep path, position, link mode and detached local block tree (DEC-193), and are re-pinned to the current registry, so that a pinned block version, or a block of a detached tree, that is `withdrawn` fails the restore 409 `migration_chain_incomplete`, a pinned pattern version that is no longer `active` fails it the same way unless the instance is `detached`, and a slot path absent from the current compatible template fails it 409 `template_incompatible`, with nothing fabricated.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/022-restore-boundaries.sqlinc',
            title:
              'RR-GENERATION: immediate first-generation source, never original ancestor provenance',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/020-restore.sqlinc',
            title:
              'CC-RST007: nonnull detached tree restores despite inactive positive prior pattern pin',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/020-restore.sqlinc',
            title:
              'CC-RST009: registry digest recomputed from current reachable tuples, not copied old digest/whole pattern',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title: 'CC-RST010: exact application refusal',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title: 'CC-RST011: exact application refusal',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title: 'CC-RST005: exact application refusal',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/020-restore.sqlinc',
            title:
              'CC-RST006: legacy SQL NULL tree is retained, not fabricated from pattern or mistaken for nonnull snapshot',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title: 'CC-RST008: exact application refusal',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title:
              'CC-RST001: fresh append-only rows preserve every semantic column, exact position/tree/bindings and carried_from_id',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'restore 409 reason tokens (BE03b:1213, :1345) [P2-S10-AC-026] [P2-S10-AC-037] maps migration_chain_incomplete to 409 CONFLICT with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'restore 409 reason tokens (BE03b:1213, :1345) [P2-S10-AC-026] [P2-S10-AC-037] maps template_incompatible to 409 CONFLICT with a refresh recovery',
          },
        ],
      },
      {
        text: 'Pending/draft heads are not carried.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/022-restore-boundaries.sqlinc',
            title:
              'RR-MASK: only explicit active keeper, no pending carry or old-active resurrection',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-244',
    text: "Restore of term assignments (DEC-141): each `active` TermAssignment of the source revision is carried to the new revision, an assignment to an `active` or `deprecated` term carrying unchanged, a `merged` term re-pointed to its surviving successor, and an unknown or other-vocabulary term failing the restore 409 `migration_chain_incomplete`, and the new revision's `taxonomy_version_ids` are the vocabularies' current `active` version ids.",
    clauses: [
      {
        text: "Restore of term assignments (DEC-141): each `active` TermAssignment of the source revision is carried to the new revision, an assignment to an `active` or `deprecated` term carrying unchanged, a `merged` term re-pointed to its surviving successor, and an unknown or other-vocabulary term failing the restore 409 `migration_chain_incomplete`, and the new revision's `taxonomy_version_ids` are the vocabularies' current `active` version ids.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test is cited. Unproven: "Restore of term assignments (DEC-141): each `active` TermAssignment of the source revision is car...": missing implementation and tests: cms_restore_revision still copies taxonomy_version_ids unchanged and carries no TermAssignments (supabase/migrations/20261005018055_cms_restore_revision_derived_state.sql). Needed: migration + pgTAP (supabase/tests/phase_02_slice_12_dec193_carry or a new restore_terms suite): active/deprecated assignment carried unchanged, merged term re-pointed to its surviving successor, unknown and other-vocabulary term -> 409 migration_chain_incomplete with nothing written, new revision taxonomy_version_ids = the vocabularies\' current active version ids (BE03c DEC-141).',
  },
  {
    criterion: 'P2-S12-AC-245',
    text: "Revision append carry-over (DEC-141, DEC-198, DEC-200): `cms_create_revision` (from its base revision) and `cms_resolve_conflict` (from the current draft `theirs`, never the conflict base, DEC-209) select newest-per-path source rows before eligibility and carry both `active` and `pending_diff` compositions as fresh append-only rows with immediate `carried_from_id` provenance, parent remapping by the owner/revision-bound source parent path to its newest eligible copied head (DEC-200), with atomic whole-command refusal if no eligible parent remains or the remapped graph is unrepresentable, unchanged position, bindings, overrides and full detached local tree (DEC-193). Pending state, existing pin and `pending_pattern_version` survive unchanged; autosave neither drops visible content nor accepts/clears the unanswered update or resurrects older active history. Explicit command pointers retain their defined exception. Restore separately translates the named source's eligible `active` rows under AC243, not the current draft or this pending-row expansion.",
    clauses: [
      {
        text: 'Revision append carry-over (DEC-141, DEC-198, DEC-200): `cms_create_revision` (from its base revision) and `cms_resolve_conflict` (from the current draft `theirs`, never the conflict base, DEC-209) select newest-per-path source rows before eligibility and carry both `active` and `pending_diff` compositions as fresh append-only rows with immediate `carried_from_id` provenance, parent remapping by the owner/revision-bound source parent path to its newest eligible copied head (DEC-200), with atomic whole-command refusal if no eligible parent remains or the remapped graph is unrepresentable, unchanged position, bindings, overrides and full detached local tree (DEC-193).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/016-append-carry-boundaries.sqlinc',
            title:
              'CB-GENERATION: carried source is immediate first-generation identity, not original ancestor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/016-append-carry-boundaries.sqlinc',
            title:
              'CB-APP-PARENT: both selected rows exist in one destination revision, not source-linked children',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/016-append-carry-boundaries.sqlinc',
            title:
              'CB-APP-WIDE: all512 nodes and exact scalar/null/large values copy without aggregate cap',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/010-append-conflict.sqlinc',
            title:
              'CC-APP003: carried detached snapshot equals independent literal, not origin/target pattern',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/010-append-conflict.sqlinc',
            title:
              'CC-APP002: removed middle root is absent; gap/order preserved, never repacked',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/010-append-conflict.sqlinc',
            title:
              'CC-RES004: resolved draft carries the current draft (theirs) placements: link mode, pin and props, DEC-209',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/010-append-conflict.sqlinc',
            title:
              'CC-RES005: nothing from the conflict base revision (detached tree, literal binding) leaks into the resolved draft',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title:
              'CP-APP: historical P1 resolves by its path to fresh selected-P2 copy, with valid destination edge and exact gaps',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title:
              'CP-RES: historical P1 resolves by its path to fresh selected-P2 copy, with valid destination edge and exact gaps',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title:
              'CP-APP: every other semantic member and fresh identity/immediate provenance preserved',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title:
              'CP-EXCLUDED-APP: exact existing typed semantic refusal, not natural FK/error leakage',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title:
              'CP-EXCLUDED-APP: whole durable image rolls back revision/composition/entry/review/conflict/reservation/audit/outbox',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title:
              'CP-CYCLE-RES: whole durable image rolls back revision/composition/entry/review/conflict/reservation/audit/outbox',
          },
        ],
      },
      {
        text: 'Pending state, existing pin and `pending_pattern_version` survive unchanged;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title:
              'CB-APP-PENDING: exactly one fresh pending copy keeps immediate provenance and every pending discriminator',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title:
              'CB-RES-PENDING: exactly one fresh pending copy keeps immediate provenance and every pending discriminator',
          },
        ],
      },
      {
        text: 'autosave neither drops visible content nor accepts/clears the unanswered update or resurrects older active history.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/010-append-conflict.sqlinc',
            title:
              'CC-APP005: nonempty literal binding survives ordinary autosave',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title:
              'CB-APP-PENDING-DIFF: literal B/T/local collision survives carry without accepting or clearing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title:
              'CB-APP-PENDING: exactly one fresh pending copy keeps immediate provenance and every pending discriminator',
          },
        ],
      },
      {
        text: 'Explicit command pointers retain their defined exception.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/010-append-conflict.sqlinc',
            title: 'CC-APP004: real changed field reaches new draft',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/010-append-conflict.sqlinc',
            title:
              'CC-RES002: explicit yours choice wins, current/base values not substituted',
          },
        ],
      },
      {
        text: "Restore separately translates the named source's eligible `active` rows under AC243, not the current draft or this pending-row expansion.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/020-restore.sqlinc',
            title:
              'CC-RST004: source local full subtree wins over current linked target',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/022-restore-boundaries.sqlinc',
            title:
              'RR-MASK: only explicit active keeper, no pending carry or old-active resurrection',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-246',
    text: "Taxonomy field values (DEC-141): once Slice 12 registers the taxonomy authority, the 03b `taxonomy` value encoder replaces its fail-closed `taxonomy_source_unavailable` with the rule that each `termId` must be an `active` term of a vocabulary whose active version lists the entry's content type key and the field's key, and a merged, deprecated-for-assignment, unknown or other-vocabulary term is the uniform 422 `VALIDATION_FAILED` reason `term_unavailable`, with the revision's `taxonomy_version_ids` being the active version ids of the vocabularies of its terms.",
    clauses: [
      {
        text: "Taxonomy field values (DEC-141): once Slice 12 registers the taxonomy authority, the 03b `taxonomy` value encoder replaces its fail-closed `taxonomy_source_unavailable` with the rule that each `termId` must be an `active` term of a vocabulary whose active version lists the entry's content type key and the field's key, and a merged, deprecated-for-assignment, unknown or other-vocabulary term is the uniform 422 `VALIDATION_FAILED` reason `term_unavailable`, with the revision's `taxonomy_version_ids` being the active version ids of the vocabularies of its terms.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test is cited. Unproven: "Taxonomy field values (DEC-141): once Slice 12 registers the taxonomy authority, the 03b `taxonom...": missing implementation and tests: the 03b taxonomy value encoder still fail-closes with taxonomy_source_unavailable (migrations 20261005010100_cms_field_kind_encodings.sql:364-393, 20261005011000_cms_value_source_refusal.sql); term_unavailable exists only in the contract refusal catalog. Needed: migration + pgTAP (new supabase/tests/phase_02_slice_12_taxonomy_value_encoder.sql): an active term of a vocabulary whose active version lists the entry type key and field key is accepted; a merged, deprecated, unknown or other-vocabulary term gives the identical 422 VALIDATION_FAILED reason term_unavailable; the revision\'s taxonomy_version_ids are the active version ids of its terms\' vocabularies (BE03c DEC-141). The Slice 10 fail-closed assertions (phase_02_slice_10_value_source_refusal.sql) are replaced, not cited.',
  },
  {
    criterion: 'P2-S12-AC-247',
    text: 'Render plan (DEC-165 receiving obligation, DEC-185): `platform_private.cms_revision_render_plan` takes, for each `(revision_id, path)`, the current (highest `version`) composition instance in state `draft`, `active` or `pending_diff` in template slot order, then `position` (so the rows of one placement render in forest order and two placements in one slot stay grouped), then path (bytewise) and id, renders a `pending_diff` instance from its pinned version, renders a row that carries a nonnull `detached_tree` from that tree, never from its provenance pin or overrides, while a plain `detached` row with a NULL `detached_tree` keeps its defined pinned render and checker behavior (DEC-193), reads each block-root row of a pattern placement as one block root at its own `path` (DEC-175, DEC-181), followed by the descendant blocks of its effective tree at `/composition/{rowId}/nodes/{i}` in canonical preorder (DEC-214), and excludes `superseded` and `retired` rows, so that the accessibility checker input and the projection compiler read one derivation of what readers get, and field placement changes only if a field-to-slot binding is introduced (none is: template `bindings` map named keys to domain projections).',
    clauses: [
      {
        text: 'Render plan (DEC-165 receiving obligation, DEC-185): `platform_private.cms_revision_render_plan` takes, for each `(revision_id, path)`, the current (highest `version`) composition instance in state `draft`, `active` or `pending_diff` in template slot order, then `position` (so the rows of one placement render in forest order and two placements in one slot stay grouped), then path (bytewise) and id, renders a `pending_diff` instance from its pinned version, renders a row that carries a nonnull `detached_tree` from that tree, never from its provenance pin or overrides, while a plain `detached` row with a NULL `detached_tree` keeps its defined pinned render and checker behavior (DEC-193), reads each block-root row of a pattern placement as one block root at its own `path` (DEC-175, DEC-181), followed by the descendant blocks of its effective tree at `/composition/{rowId}/nodes/{i}` in canonical preorder (DEC-214), and excludes `superseded` and `retired` rows, so that the accessibility checker input and the projection compiler read one derivation of what readers get, and field placement changes only if a field-to-slot binding is introduced (none is: template `bindings` map named keys to domain projections).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_consumers/030-effective-boundaries.sqlinc',
            title:
              'CB-O01: complete render order is slot, position, path/id, not key/UUID order',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_consumers/030-effective-boundaries.sqlinc',
            title:
              'CB-H04: newest active re-placement wins over both old active and retired records',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_consumers/030-effective-boundaries.sqlinc',
            title:
              'CB-P01: pending head renders unchanged B, never the newer active target block',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_consumers/030-effective-boundaries.sqlinc',
            title: 'CB-P03: pending supersedes older history, one root renders',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_consumers/030-effective-boundaries.sqlinc',
            title:
              'CB-L04: private canonical ordinal projection does not concatenate expanded namespaces',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_consumers.sql',
            title:
              'cs-detached: checker reads effective canonical props, not empty row props or old pin',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_consumers.sql',
            title:
              'cs-detached: first canonical descendant remains under newest-row anchor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_consumers.sql',
            title:
              'cs-legacy: exact canonical preorder identities, no stale history',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_consumers.sql',
            title:
              'cs-retired: complete plan row count, not only a filtered block count',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-248',
    text: "Event relay (DEC-166 receiving obligation): Slice 12's forward migration makes every Slice 12 event claimable by the outbox relay under the exact aggregate type its producer writes, including `cms_locale_variant` for `cms.localization.changed.v1` and the aggregate types of `cms.template.activated.v1`, `cms.pattern.activated.v1` and `cms.taxonomy.changed.v1` (`cms_template_version`, `cms_pattern_version`, `cms_taxonomy_version` and `cms_term`, DEC-180 G3), and registers the `cms.pattern.` and `cms.taxonomy.` producer prefixes only as insert-if-absent, so that no claimed event has an unregistered producer or an unlisted aggregate type.",
    clauses: [
      {
        text: "Event relay (DEC-166 receiving obligation): Slice 12's forward migration makes every Slice 12 event claimable by the outbox relay under the exact aggregate type its producer writes, including `cms_locale_variant` for `cms.localization.changed.v1`",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/004-relay-source-race-grants.sqlinc',
            title:
              'the outbox relay claims cms.localization.changed.v1 under aggregate cms_locale_variant with its registered producer [P2-S12-AC-248]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/004-relay-source-race-grants.sqlinc',
            title:
              'every localization event the lane produced is under the single aggregate type cms_locale_variant [P2-S12-AC-237]',
          },
        ],
      },
      {
        text: 'and the aggregate types of `cms.template.activated.v1`, `cms.pattern.activated.v1` and `cms.taxonomy.changed.v1` (`cms_template_version`, `cms_pattern_version`, `cms_taxonomy_version` and `cms_term`, DEC-180 G3),',
        citations: [],
      },
      {
        text: 'and registers the `cms.pattern.` and `cms.taxonomy.` producer prefixes only as insert-if-absent, so that no claimed event has an unregistered producer or an unlisted aggregate type.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "and the aggregate types of `cms.template.activated.v1`, `cms.pattern.activated.v1` and `cms.taxon...": missing implementation and test: claim_outbox_batch still claims cms.template.activated.v1, cms.pattern.activated.v1 and cms.taxonomy.changed.v1 under ANY registry key (20261010164000_cms_review_recheck_relay.sql narrows only the locale tuple, 20261014050800); Slice 12 does not narrow them to cms_template_version, cms_pattern_version, cms_taxonomy_version / cms_term. Needed: forward migration narrowing the tuple list + pgTAP (extend phase_02_slice_11_recheck_relay.sql-style, new supabase/tests/phase_02_slice_12_relay_aggregates.sql) claiming each event under its exact aggregate type and refusing a wrong registry key (DEC-166, DEC-180 G3, DEC-188). "and registers the `cms.pattern.` and `cms.taxonomy.` producer prefixes only as insert-if-absent, ...": The producer prefixes cms.pattern. and cms.taxonomy. are registered by the Slice 11 relay migration (insert-if-absent); the Slice 11 test `the relay claims each of the six recheck source events with its aggregate and registered producer [P2-S11-AC-113]` shows a registered producer but nothing asserts insert-if-absent, and `no claimed event has an unlisted aggregate type` is false for the three events above until they are narrowed. missing test: same suite as the previous part.',
  },
  {
    criterion: 'P2-S12-AC-249',
    text: "Activation events: `cms.template.activated.v1` `{ templateId, templateVersionId }` and `cms.pattern.activated.v1` `{ patternId, patternVersionId }` (a new event type registered by Slice 12) are emitted exactly once by CMS-03C-09 only on a committed immediate activation, a committed retirement (naming the retired version) or a committed scheduled execution, in the transaction with the switch and the audit record, have the outbox identity of the switched subject version row (aggregateType `cms_template_version` or `cms_pattern_version`, aggregateId the activated or retired version id, aggregateVersion that row's `lifecycle_version` after the switch, DEC-188 (correcting DEC-180 G3)) so that every committed command has a unique triple, carry identifiers only (no content values, labels, locale text, target names, secrets, tokens or authority), and are not emitted for a schedule acceptance, a refusal or a governed review state change.",
    clauses: [
      {
        text: "Activation events: `cms.template.activated.v1` `{ templateId, templateVersionId }` and `cms.pattern.activated.v1` `{ patternId, patternVersionId }` (a new event type registered by Slice 12) are emitted exactly once by CMS-03C-09 only on a committed immediate activation, a committed retirement (naming the retired version) or a committed scheduled execution, in the transaction with the switch and the audit record, have the outbox identity of the switched subject version row (aggregateType `cms_template_version` or `cms_pattern_version`, aggregateId the activated or retired version id, aggregateVersion that row's `lifecycle_version` after the switch, DEC-188 (correcting DEC-180 G3)) so that every committed command has a unique triple, carry identifiers only (no content values, labels, locale text, target names, secrets, tokens or authority), and are not emitted for a schedule acceptance, a refusal or a governed review state change.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation.sql',
            title:
              'exactly one cms.template.activated.v1 commits with one audit record: aggregate = the switched subject row at its lifecycle counter 4, payload = { templateId, templateVersionId } (DEC-180 G3, DEC-188) [P2-S12-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'exactly one more cms.template.activated.v1 commits (aggregate = the retired subject row at lifecycle counter 5, payload { templateId, templateVersionId }) with one retirement audit record [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_retire_pattern/010-retire.sqlinc',
            title:
              'exactly one more cms.pattern.activated.v1 commits (aggregate cms_pattern_version at lifecycle 5, payload { patternId, patternVersionId }) with one retirement audit record [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'the scheduled execution supersedes the previous active version and commits exactly one cms.template.activated.v1 (aggregate version 5) and one audit record [P2-S12-AC-150]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'scheduling moves the subject approved -> scheduled (lifecycle 3 -> 4), emits NO event, writes one audit record and stores status 202 [P2-S12-AC-142]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'every retire refusal on the active ga1 leaves the subject, review, idempotency, audit and outbox stores identical [P2-S12-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'submit emits no outbox event (submission emits no event; activation and retirement are the emitting governed commands) [P2-S12-AC-251]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_12_dec199_publication.race.mjs',
            title:
              'change-first: explicit commit order, full effects and unchanged same-key replay',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-250',
    text: "Taxonomy changed event: `cms.taxonomy.changed.v1` `{ taxonomyId, taxonomyVersionId }` is emitted once per committed CMS-03C-03 term action (carrying the vocabulary's active version id) and by CMS-03C-09 after a taxonomy-version activation or retirement, as an identifier-only event whose outbox identity is the term row for a term action (aggregateType `cms_term`, aggregateId the term id, aggregateVersion the term `version` after the action) and the subject version row for an activation or retirement (aggregateType `cms_taxonomy_version`, aggregateId the version id, aggregateVersion that row's `lifecycle_version` after the switch, DEC-188 (correcting DEC-180 G3)), and whose consumers refetch aliases and terms under their own authority.",
    clauses: [
      {
        text: "Taxonomy changed event: `cms.taxonomy.changed.v1` `{ taxonomyId, taxonomyVersionId }` is emitted once per committed CMS-03C-03 term action (carrying the vocabulary's active version id) and by CMS-03C-09 after a taxonomy-version activation or retirement, as an identifier-only event whose outbox identity is the term row for a term action (aggregateType `cms_term`, aggregateId the term id, aggregateVersion the term `version` after the action) and the subject version row for an activation or retirement (aggregateType `cms_taxonomy_version`, aggregateId the version id, aggregateVersion that row's `lifecycle_version` after the switch, DEC-188 (correcting DEC-180 G3)), and whose consumers refetch aliases and terms under their own authority.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/030-create.sqlinc',
            title:
              'exactly one cms.taxonomy.changed.v1 (aggregate cms_term at the term version, payload { taxonomyId, taxonomyVersionId }) and one audit record commit [P2-S12-AC-021]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/095-lineage-storage.sqlinc',
            title:
              'every term action has its own (aggregateType, aggregateId, aggregateVersion) identity: no two actions share an outbox dedupe key (BE03c 1561) [P2-S12-AC-021]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/080-taxonomy.sqlinc',
            title:
              'the taxonomy activation commits exactly one cms.taxonomy.changed.v1 (aggregate cms_taxonomy_version at lifecycle 4, payload { taxonomyId, taxonomyVersionId }) and one audit record [P2-S12-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'the taxonomy retirement commits exactly one more cms.taxonomy.changed.v1 (aggregate cms_taxonomy_version at lifecycle 5, payload { taxonomyId, taxonomyVersionId }) and one audit record; the review stays approved and activated at version 4 [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/097-bulk-continuation.sqlinc',
            title:
              'the merge emitted exactly one cms.taxonomy.changed.v1 for the retired term at its merge version 2, not one per batch [P2-S12-AC-021]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-251',
    text: "Persistence `cms_governed_reviews`: rows are inserted only through `cms_submit_governed_review`, with `state` one of `open`, `approved`, `rejected`, `invalidated`, `subject_kind` one of the three subject kinds, a polymorphic `subject_id` validated by `platform_private.cms_governed_subject_resolve(kind,id)` in the RPC and a BEFORE INSERT trigger, `subject_hash`, `policy_basis_hash` and `approval_evidence_hash` as 64 lowercase hex (the last the JCS SHA-256 of `{ policyBasisHash, subjectHash, subjectId, subjectKind }`), `required_decision_count` 1 to 8 with `recorded_decision_count` at most that count, `required_capabilities` of 1 to 16 and `policy_basis` of 1 to 64 entries, CHECKs tying `protected` to at least 2 decisions and 2 capabilities, `invalidated` to `invalidated_reason` and `approved` or `rejected` to `decided_at`, and `UNIQUE(subject_kind, subject_id) WHERE state IN ('open','approved')`; the frozen columns are immutable, only the named RPCs advance `state`, the recorded count, `activated_at`, `version` and `updated_at` under CAS, and direct UPDATE, DELETE and table grants are revoked.",
    clauses: [
      {
        text: "Persistence `cms_governed_reviews`: rows are inserted only through `cms_submit_governed_review`, with `state` one of `open`, `approved`, `rejected`, `invalidated`, `subject_kind` one of the three subject kinds, a polymorphic `subject_id` validated by `platform_private.cms_governed_subject_resolve(kind,id)` in the RPC and a BEFORE INSERT trigger, `subject_hash`, `policy_basis_hash` and `approval_evidence_hash` as 64 lowercase hex (the last the JCS SHA-256 of `{ policyBasisHash, subjectHash, subjectId, subjectKind }`), `required_decision_count` 1 to 8 with `recorded_decision_count` at most that count, `required_capabilities` of 1 to 16 and `policy_basis` of 1 to 64 entries, CHECKs tying `protected` to at least 2 decisions and 2 capabilities, `invalidated` to `invalidated_reason` and `approved` or `rejected` to `decided_at`, and `UNIQUE(subject_kind, subject_id) WHERE state IN ('open','approved')`; the frozen columns are immutable, only the named RPCs advance `state`, the recorded count, `activated_at`, `version` and `updated_at` under CAS, and direct UPDATE, DELETE and table grants are revoked.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test is cited. Unproven: "Persistence `cms_governed_reviews`: rows are inserted only through `cms_submit_governed_review`, ...": missing test: pgTAP, new supabase/tests/phase_02_slice_12_governed_persistence.sql (catalog + direct-write probes of the governed tables, BE03c Canonical records / Persistence): cms_governed_reviews: CHECK definitions for state in (open,approved,rejected,invalidated), subject_kind in the three kinds, the three 64-hex hash columns, required_decision_count 1..8, recorded_decision_count <= required, required_capabilities 1..16, policy_basis 1..64, the protected>=2 decisions/2 capabilities, invalidated->invalidated_reason, approved|rejected->decided_at ties and the partial UNIQUE (subject_kind, subject_id) WHERE state IN (open,approved); the BEFORE INSERT cms_governed_subject_resolve trigger; approval_evidence_hash = JCS SHA-256 of {policyBasisHash, subjectHash, subjectId, subjectKind}; frozen columns immutable and direct UPDATE/DELETE/table grants refused for anon, authenticated and service_role. Only the generic trigger inventory (phase_02_slice_09_evidence_trigger_catalog.sql, 06-trigger-probes.sqlinc) and the schema-wide definer/RLS sweep touch these tables, which assert neither the CHECK/UNIQUE/index definitions nor per-table grants. Behavioural neighbours exist but prove other things and are not cited: governed_submit.sql `a second live review for the same subject version is refused 409 subject_not_submittable [P2-S12-AC-251]` (RPC pre-check, not the index), `the strictest-of basis over an ordinary and a protected member yields protected, two decisions…`.',
  },
  {
    criterion: 'P2-S12-AC-252',
    text: "Persistence `cms_governed_review_decisions`: rows are append-only (`state` `recorded`, `version` 1, `updated_at = created_at`, UPDATE, DELETE and direct grants revoked) with `UNIQUE(review_id, reviewer_person_id)`, a NOT NULL `step_up_at`, the `assignment_id` and `assignment_version` recorded, `capability` the satisfied slot, `decision` `approve` or `reject`, a `reason` of 1 to 2000 code points (`char_length`) with `comment_hash` and `reviewed_hash` as 64 hex, the reviewer, slot capability and MFA instant server-derived, `reason` readable only by its decider, and a BEFORE INSERT trigger forbidding a `reviewer_person_id` equal to the review's `submitted_by` or the subject version's creator.",
    clauses: [
      {
        text: 'Persistence `cms_governed_review_decisions`: rows are append-only (`state` `recorded`, `version` 1, `updated_at = created_at`, UPDATE, DELETE and direct grants revoked)',
        citations: [],
      },
      {
        text: 'with `UNIQUE(review_id, reviewer_person_id)`, a NOT NULL `step_up_at`, the `assignment_id` and `assignment_version` recorded, `capability` the satisfied slot, `decision` `approve` or `reject`,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc',
            title:
              'one human records at most one decision per review: the second is duplicate_decision and writes nothing [P2-S12-AC-073]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/030-happy.sqlinc',
            title:
              'the decision row stores the server-derived reviewer, satisfied slot, frozen hash, reason hash, assignment and MFA instant [P2-S12-AC-072]',
          },
        ],
      },
      {
        text: 'a `reason` of 1 to 2000 code points (`char_length`) with `comment_hash` and `reviewed_hash` as 64 hex, the reviewer, slot capability and MFA instant server-derived, `reason` readable only by its decider,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc',
            title:
              'a reason of exactly 2000 code points (3000 octets) is accepted and stored whole with the hash of its UTF-8 bytes [P2-S12-AC-071]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'a decision shows its slot capability and instant to every reader but its reason to no one but its decider [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/030-happy.sqlinc',
            title:
              'the decision row stores the server-derived reviewer, satisfied slot, frozen hash, reason hash, assignment and MFA instant [P2-S12-AC-072]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'a body capability or stepUpAt is an unknown key; a malformed review id, a missing key or If-Match disagreeing with expectedVersion is INVALID_REQUEST; a bad decision, version or an empty, over-long, non-NFC, control, markup or brace reason is VALIDATION_FAILED at its pointer [P2-S12-AC-071]',
          },
        ],
      },
      {
        text: "and a BEFORE INSERT trigger forbidding a `reviewer_person_id` equal to the review's `submitted_by` or the subject version's creator.",
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "Persistence `cms_governed_review_decisions`: rows are append-only (`state` `recorded`, `version` ...": missing test: pgTAP, new supabase/tests/phase_02_slice_12_governed_persistence.sql (catalog + direct-write probes of the governed tables, BE03c Canonical records / Persistence): cms_governed_review_decisions: append-only (state recorded, version 1, updated_at = created_at) enforced by the immutable guard, UPDATE/DELETE and direct table grants refused. Only the generic trigger inventory (phase_02_slice_09_evidence_trigger_catalog.sql, 06-trigger-probes.sqlinc) and the schema-wide definer/RLS sweep touch these tables, which assert neither the CHECK/UNIQUE/index definitions nor per-table grants. "and a BEFORE INSERT trigger forbidding a `reviewer_person_id` equal to the review\'s `submitted_by...": missing test: pgTAP in supabase/tests/phase_02_slice_12_governed_decision (new 060-separation-trigger.sqlinc): a direct INSERT (RPC context) of a decision row whose reviewer_person_id equals the review submitted_by, and one equal to the subject version creator, is refused by the BEFORE INSERT trigger (BE03c Persistence cms_governed_review_decisions). The RPC-level separation_of_duties behaviour is not cited because it proves the command, not the trigger.',
  },
  {
    criterion: 'P2-S12-AC-253',
    text: "Persistence `cms_governed_review_assignments`: rows are created and revoked only by `cms_assign_governed_reviewer` with `capability_key` fixed to `cms.definition_review`, `actions` fixed to `read` and `decide`, `state` `active` or `revoked`, a `grantor_person_id`, `ends_at` after `starts_at` and at most seven days later, `UNIQUE(review_id, reviewer_person_id) WHERE state = 'active'`, decide authority only while `starts_at <= now < ends_at` on a non-revoked row (rechecked with the standing capability at decision time), an optional `reason` of 1 to 256 code points (`char_length`), no stored acting context or delegation authority, and direct UPDATE, DELETE and grants revoked.",
    clauses: [
      {
        text: 'Persistence `cms_governed_review_assignments`: rows are created and revoked only by `cms_assign_governed_reviewer` with `capability_key` fixed to `cms.definition_review`, `actions` fixed to `read` and `decide`, `state` `active` or `revoked`, a `grantor_person_id`,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'the assignment confers exactly read and decide on this review for the requested window inside the seven-day ceiling [P2-S12-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'the stored assignment names the server-derived grantor and the requested reviewer and nothing else [P2-S12-AC-078]',
          },
        ],
      },
      {
        text: "`ends_at` after `starts_at` and at most seven days later, `UNIQUE(review_id, reviewer_person_id) WHERE state = 'active'`,",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'an expiry beyond seven days, in the past, not after now, or beyond the grantor designer grant end (the reviewer grant is 30 days) is expiry_out_of_bounds at /expiresAt [P2-S12-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/030-refusals.sqlinc',
            title:
              'a second active assignment of the same reviewer on the review is refused assignment_exists [P2-S12-AC-080]',
          },
        ],
      },
      {
        text: 'decide authority only while `starts_at <= now < ends_at` on a non-revoked row (rechecked with the standing capability at decision time), an optional `reason` of 1 to 256 code points (`char_length`),',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc',
            title:
              'an assignment whose window has ended still reads the review but cannot decide: 403 capability_missing [P2-S12-AC-072]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc',
            title:
              'a revoked assignee has lost the read scope with the decide authority: the review is concealed, 404 [P2-S12-AC-072]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc',
            title:
              'an assignee without the standing cms.reviewer grant is refused capability_missing and nothing changes [P2-S12-AC-072]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/040-bounds-revoke.sqlinc',
            title:
              'a reason of exactly 256 code points (512 octets) is accepted and stored whole: the bound counts code points, not octets [P2-S12-AC-077]',
          },
        ],
      },
      {
        text: 'no stored acting context or delegation authority, and direct UPDATE, DELETE and grants revoked.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "no stored acting context or delegation authority, and direct UPDATE, DELETE and grants revoked.": missing test: pgTAP, new supabase/tests/phase_02_slice_12_governed_persistence.sql (catalog + direct-write probes of the governed tables, BE03c Canonical records / Persistence): cms_governed_review_assignments: no acting-context / delegation columns exist, state in (active,revoked), UNIQUE(review_id, reviewer_person_id) WHERE state = active as an index definition, and direct UPDATE/DELETE/table grants refused for anon, authenticated and service_role; rows only created/revoked by cms_assign_governed_reviewer. Only the generic trigger inventory (phase_02_slice_09_evidence_trigger_catalog.sql, 06-trigger-probes.sqlinc) and the schema-wide definer/RLS sweep touch these tables, which assert neither the CHECK/UNIQUE/index definitions nor per-table grants.',
  },
  {
    criterion: 'P2-S12-AC-254',
    text: 'Persistence `cms_governed_review_dependencies`: rows are written only by `cms_submit_governed_review` from the frozen identities with `kind` one of `block`, `pattern`, `content_type` and `canonical_domain`, `UNIQUE(review_id, kind, ref_id)`, immutable (`state` `active`, `version` 1, `updated_at = created_at`), indexes on `(kind, ref_id)` and `review_id` for the recheck job, forced RLS and no grants.',
    clauses: [
      {
        text: 'Persistence `cms_governed_review_dependencies`: rows are written only by `cms_submit_governed_review` from the frozen identities with `kind` one of `block`, `pattern`, `content_type` and `canonical_domain`, `UNIQUE(review_id, kind, ref_id)`, immutable (`state` `active`, `version` 1, `updated_at = created_at`), indexes on `(kind, ref_id)` and `review_id` for the recheck job, forced RLS and no grants.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test is cited. Unproven: "Persistence `cms_governed_review_dependencies`: rows are written only by `cms_submit_governed_rev...": missing test: pgTAP, new supabase/tests/phase_02_slice_12_governed_persistence.sql (catalog + direct-write probes, BE03c Canonical records / Persistence): cms_governed_review_dependencies: kind in (block, pattern, content_type, canonical_domain), UNIQUE(review_id, kind, ref_id), immutable state active/version 1/updated_at = created_at, indexes on (kind, ref_id) and (review_id), forced row level security, no table grants for anon/authenticated/service_role. Only the generic trigger inventory (phase_02_slice_09_evidence_trigger_catalog.sql, 06-trigger-probes.sqlinc) and the schema-wide definer/RLS sweep touch these tables; neither asserts the definitions or per-table grants. Behavioural neighbours cover two of the four kinds only and are not cited: governed_submit.sql `the review freezes its dependency identity, the bound content-type version [P2-S12-AC-249]` (content_type), taxonomy_definition/060-review-successor.sqlinc `built-domain review freezes exactly its real provider registry identity` (canonical_domain).',
  },
  {
    criterion: 'P2-S12-AC-255',
    text: "Persistence `cms_governed_activation_schedules`: `state` is one of `pending`, `executing`, `completed`, `failed_retryable`, `blocked`, `cancelled`, `reason_code` is non-null exactly for `blocked` and `cancelled` and one of `approval_invalidated`, `dependency_changed`, `activation_authority_ended`, `canonical_source_unavailable`, `retries_exhausted`, `attempt_count` is 0 to 3, `expected_version` is the approved review's version at acceptance, `UNIQUE(subject_kind, subject_id) WHERE state IN ('pending','executing','failed_retryable')` allows one live schedule per subject, the time evidence, lease, retry and `actual_at_utc`/`deviation_seconds` columns exist and are never replaced, and rows are written only by CMS-03C-09 (insert) and the claim and execute RPCs of CMS-03C-19 (CAS on `state` and `version`) with direct UPDATE, DELETE and grants revoked.",
    clauses: [
      {
        text: 'Persistence `cms_governed_activation_schedules`: `state` is one of `pending`, `executing`, `completed`, `failed_retryable`, `blocked`, `cancelled`, `reason_code` is non-null exactly for `blocked` and `cancelled` and one of `approval_invalidated`, `dependency_changed`, `activation_authority_ended`, `canonical_source_unavailable`, `retries_exhausted`, `attempt_count` is 0 to 3,',
        citations: [],
      },
      {
        text: "`expected_version` is the approved review's version at acceptance, `UNIQUE(subject_kind, subject_id) WHERE state IN ('pending','executing','failed_retryable')` allows one live schedule per subject, the time evidence, lease, retry and `actual_at_utc`/`deviation_seconds` columns exist and are never replaced,",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'exactly one pending schedule (version 1) exists with the approved review version, the time evidence as submitted, the creator and no lease [P2-S12-AC-142]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'a second live schedule of the subject is 409 schedule_exists; an immediate activation of a scheduled subject is 409 subject_not_activatable [P2-S12-AC-143]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a completed execution records the actual instant and the signed deviation from the scheduled instant (a late run still activates) [P2-S12-AC-150]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc',
            title:
              'the fourth failure blocks the schedule retries_exhausted (three attempts spent) and the subject blocked, with no event and one audit record [P2-S12-AC-152]',
          },
        ],
      },
      {
        text: 'and rows are written only by CMS-03C-09 (insert) and the claim and execute RPCs of CMS-03C-19 (CAS on `state` and `version`) with direct UPDATE, DELETE and grants revoked.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "Persistence `cms_governed_activation_schedules`: `state` is one of `pending`, `executing`, `compl...": missing test: pgTAP, new supabase/tests/phase_02_slice_12_governed_persistence.sql (catalog + direct-write probes, BE03c Canonical records / Persistence): cms_governed_activation_schedules: CHECK state in (pending, executing, completed, failed_retryable, blocked, cancelled); reason_code non-null exactly for blocked and cancelled and in the five listed reasons (including canonical_source_unavailable, which no schedule test exercises); attempt_count between 0 and 3. Only the generic trigger inventory (phase_02_slice_09_evidence_trigger_catalog.sql, 06-trigger-probes.sqlinc) and the schema-wide definer/RLS sweep touch these tables; neither asserts the definitions or per-table grants. The ladder (governed_schedule_ladder/010-ladder.sqlinc) shows attempt values 1..3 and four of the five block reasons through the commands, which are not the constraint. "and rows are written only by CMS-03C-09 (insert) and the claim and execute RPCs of CMS-03C-19 (CA...": missing test: pgTAP, new supabase/tests/phase_02_slice_12_governed_persistence.sql (catalog + direct-write probes, BE03c Canonical records / Persistence): the schedule rows are only inserted by CMS-03C-09 and advanced by the claim/execute RPCs under CAS; direct UPDATE, DELETE and table grants refused for anon, authenticated and service_role. Only the generic trigger inventory (phase_02_slice_09_evidence_trigger_catalog.sql, 06-trigger-probes.sqlinc) and the schema-wide definer/RLS sweep touch these tables; neither asserts the definitions or per-table grants.',
  },
  {
    criterion: 'P2-S12-AC-256',
    text: 'Persistence `cms_canonical_domain_registry`: rows are seeded by forward migration only, immutable and never writable by a caller (`state` `seeded`, `updated_at = created_at`, `owner_id` the seeding release record), hold `domain` one of `role`, `instrument`, `gear`, `place`, `rights` and `jurisdiction` with `provider_state` `built` or `unbuilt` and `provider_key` and `provider_version` non-null exactly when `built`, `UNIQUE(domain, version)`, the current row of a domain being the one with the greatest `version`; Phase 2 seeds `role` as `built` (its provider reading the Shard 02 role facet assertion projection) and the other five `unbuilt`, and an owning shard registers its provider by inserting a newer row.',
    clauses: [
      {
        text: 'Persistence `cms_canonical_domain_registry`: rows are seeded by forward migration only, immutable and never writable by a caller (`state` `seeded`, `updated_at = created_at`, `owner_id` the seeding release record), hold `domain` one of `role`, `instrument`, `gear`, `place`, `rights` and `jurisdiction` with `provider_state` `built` or `unbuilt` and `provider_key` and `provider_version` non-null exactly when `built`, `UNIQUE(domain, version)`, the current row of a domain being the one with the greatest `version`;',
        citations: [],
      },
      {
        text: 'Phase 2 seeds `role` as `built` (its provider reading the Shard 02 role facet assertion projection) and the other five `unbuilt`,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'SETUP the registry is the Phase 2 seed: role built, the other five unbuilt',
          },
        ],
      },
      {
        text: 'and an owning shard registers its provider by inserting a newer row.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'a provider de-registered by a newer registry row makes the domain source_unavailable (the current row is the greatest version) [P2-S12-AC-140]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "Persistence `cms_canonical_domain_registry`: rows are seeded by forward migration only, immutable...": missing test: pgTAP, new supabase/tests/phase_02_slice_12_governed_persistence.sql (catalog + direct-write probes, BE03c Canonical records / Persistence): cms_canonical_domain_registry: domain in the six values, provider_state in (built, unbuilt), provider_key and provider_version non-null exactly when built, UNIQUE(domain, version), state seeded, updated_at = created_at, owner_id = the seeding release record, seeded by forward migration only and no caller grant. Only the generic trigger inventory (phase_02_slice_09_evidence_trigger_catalog.sql, 06-trigger-probes.sqlinc) and the schema-wide definer/RLS sweep touch these tables; neither asserts the definitions or per-table grants.',
  },
  {
    criterion: 'P2-S12-AC-257',
    text: 'Persistence `cms_pattern_versions` (Slice 12 delta): `compatible_type_ids jsonb NOT NULL` is an array of 1 to 64 UUIDs, `node_count smallint NOT NULL` is between 1 and 512, and `block_tree` is the bounded `PatternNode` forest whose every block key follows the canonical BlockKey grammar.',
    clauses: [
      {
        text: 'Persistence `cms_pattern_versions` (Slice 12 delta): `compatible_type_ids jsonb NOT NULL` is an array of 1 to 64 UUIDs, `node_count smallint NOT NULL` is between 1 and 512, and `block_tree` is the bounded `PatternNode` forest whose every block key follows the canonical BlockKey grammar.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title:
              'a forest row must list 1..64 compatible types [P2-S12-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title:
              'a row that omits its compatible type list is refused: there is no empty-list default',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/040-graph.sqlinc',
            title:
              'all 64 compatible type ids survive persistence [P2-S12-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title: 'a forest row must store 1..512 nodes [P2-S12-AC-211]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title:
              'a row that omits its node count is refused: there is no zero default',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title:
              'a legacy object-tree row is refused even with a valid type list and node count (no grandfathering, BE03c 1425)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'bad-block-key: exact SQL message token [P2-S12-AC-104]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-258',
    text: "Persistence `cms_composition_instances` (Slice 12 delta): `pending_pattern_version integer` is non-null exactly when `state = 'pending_diff'`, `carried_from_id uuid` references `cms_composition_instances(id)` as the revision-append and restore carry-over provenance, `position integer NOT NULL` records the authored order of a row within its `(revision_id, slot_key)` (a placement takes consecutive values in forest order appended after the slot's greatest, the forward migration backfills every existing row, and accept, detach, the linked-update scan, restore and carry-over copy it unchanged, DEC-185), `detached_tree jsonb` is null or, only on a `detached` row whose `props` is `{}`, a `{ format: 'cms.detached_tree.v1', nodes: [...] }` preorder snapshot of 1–512 nodes `{ parent, keySegments, blockKey, blockVersion, props }` whose index-0 node is the row's block root, with relative key segments preserving reference namespaces and effective props copied exactly (DEC-193), and every instance version is append-only with `updated_at = created_at` and UPDATE and DELETE rejected.",
    clauses: [
      {
        text: "Persistence `cms_composition_instances` (Slice 12 delta): `pending_pattern_version integer` is non-null exactly when `state = 'pending_diff'`,",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/000-schema.sqlinc',
            title:
              'a non-pending row carrying pending_pattern_version is refused by the table: it is non-null exactly when state = pending_diff [AC-258]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/000-schema.sqlinc',
            title:
              'a pending_diff row without pending_pattern_version is refused [AC-258]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/000-schema.sqlinc',
            title: 'pending_pattern_version is a positive integer [AC-258]',
          },
        ],
      },
      {
        text: '`carried_from_id uuid` references `cms_composition_instances(id)` as the revision-append and restore carry-over provenance,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/016-append-carry-boundaries.sqlinc',
            title:
              'CB-STORAGE001: private provenance is nullable UUID with no invented default/backfill',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/016-append-carry-boundaries.sqlinc',
            title:
              'CB-GENERATION: carried source is immediate first-generation identity, not original ancestor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/022-restore-boundaries.sqlinc',
            title:
              'RR-GENERATION: immediate first-generation source, never original ancestor provenance',
          },
        ],
      },
      {
        text: "`position integer NOT NULL` records the authored order of a row within its `(revision_id, slot_key)` (a placement takes consecutive values in forest order appended after the slot's greatest, the forward migration backfills every existing row, and accept, detach, the linked-update scan, restore and carry-over copy it unchanged, DEC-185),",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/020-schema.sqlinc',
            title:
              'cms_composition_instances.position is integer NOT NULL [P2-S12-AC-258]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/020-schema.sqlinc',
            title: 'position carries CHECK (position >= 0) [P2-S12-AC-258]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/020-schema.sqlinc',
            title:
              'a negative position is refused by the CHECK (23514) [P2-S12-AC-258]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/020-schema.sqlinc',
            title:
              'a stored row is append-only: its position cannot be updated (immutable guard) [P2-S12-AC-258]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'p1: consecutive positions in forest order from 13 [DEC-185]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'u-ap3 [/hero]: position, revision, slot, path, lineage, bindings and owner are copied unchanged [DEC-185]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/060-helper.sqlinc',
            title:
              'pending: every other member of the head is copied unchanged, position, slot, block, props, bindings, digest, parent and created_by included',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry/023-restore-parent-path.sqlinc',
            title:
              'RR-PARENT: exact child copy reconnects to fresh selected-P2 copy by source parent path, not P1 identity',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title:
              'CP-APP: historical P1 resolves by its path to fresh selected-P2 copy, with valid destination edge and exact gaps',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/populated-position.sql',
            title:
              'the backfill is the dense bytewise rank from 0 per (revision, slot), shared by every version of a path [DEC-185]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'd-ap7 [/hero]: position, revision, slot, path, lineage, bindings and owner are copied unchanged [DEC-185]',
          },
        ],
      },
      {
        text: "`detached_tree jsonb` is null or, only on a `detached` row whose `props` is `{}`, a `{ format: 'cms.detached_tree.v1', nodes: [...] }` preorder snapshot of 1–512 nodes `{ parent, keySegments, blockKey, blockVersion, props }`",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot/010-storage.sqlinc',
            title: 'DEC-193 storage: detached_tree is nullable jsonb',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot/010-storage.sqlinc',
            title:
              'DEC-193 storage: a validated CHECK depends on an immutable boolean validator',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot.sql',
            title: 'nonnull snapshot cannot be linked: exact SQLSTATE',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot.sql',
            title: 'nonnull snapshot requires empty row props: exact SQLSTATE',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot.sql',
            title: '513 nodes: exact SQLSTATE',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot.sql',
            title: 'zero nodes: exact SQLSTATE',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot.sql',
            title:
              'minimal snapshot: exact full row persists the complete snapshot without props coercion',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot.sql',
            title: 'wrong format: exact SQLSTATE',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot.sql',
            title: 'unknown node field: exact SQLSTATE',
          },
        ],
      },
      {
        text: "whose index-0 node is the row's block root,",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot.sql',
            title: 'root block key differs from row: exact SQLSTATE',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot.sql',
            title: 'root block version differs from row: exact SQLSTATE',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot.sql',
            title: 'root parent is zero: exact SQLSTATE',
          },
        ],
      },
      {
        text: 'with relative key segments preserving reference namespaces and effective props copied exactly (DEC-193),',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot.sql',
            title:
              'ordered preorder with a closed left branch: exact full row persists the complete snapshot without props coercion',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_snapshot.sql',
            title:
              'closed reference namespace reopened between siblings: exact SQLSTATE',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'd-ap7 [/hero]: the detached local block tree (null unless the row materialized the resolved or pinned tree) [DEC-193]',
          },
        ],
      },
      {
        text: 'and every instance version is append-only with `updated_at = created_at` and UPDATE and DELETE rejected.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title: 'composition instance version cannot mutate after creation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title: 'composition instance versions reject UPDATE and DELETE',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-259',
    text: "Persistence `cms_taxonomy_versions` (Slice 12 delta): `canonical_overlap_domains jsonb NOT NULL DEFAULT '[]'` is an array of at most 6 unique members of `role`, `instrument`, `gear`, `place`, `rights` and `jurisdiction`, and a version holds rules only, the terms belonging to the vocabulary.",
    clauses: [
      {
        text: "Persistence `cms_taxonomy_versions` (Slice 12 delta): `canonical_overlap_domains jsonb NOT NULL DEFAULT '[]'` is an array of at most 6 unique members of `role`, `instrument`, `gear`, `place`, `rights` and `jurisdiction`, and a version holds rules only, the terms belonging to the vocabulary.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'declared domains refuse: seven members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'declared domains refuse: duplicate',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'declared domains refuse: unknown member',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/080-schema-guards.sqlinc',
            title:
              'lineage columns exist; lineage id, declared domains and lifecycle counter are mandatory',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/095-lineage-storage.sqlinc',
            title:
              'the successor version duplicated, re-keyed and touched no term: ids, keys, versions and write-versions are byte-identical [P2-S12-AC-003]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-260',
    text: "Persistence `cms_locale_variants` (Slice 12 delta): `field_source_hashes jsonb NOT NULL DEFAULT '{}'` is an object of at most 128 field-id keys to 64-hex hashes, `stale_field_ids jsonb NOT NULL DEFAULT '[]'` is an array of at most 128 UUIDs, the physical state is `draft` or `stale`, and each snapshot is immutable (`updated_at = created_at`), source changes appending a stale or new variant row.",
    clauses: [
      {
        text: "Persistence `cms_locale_variants` (Slice 12 delta): `field_source_hashes jsonb NOT NULL DEFAULT '{}'` is an object of at most 128 field-id keys to 64-hex hashes,",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title:
              'cms_locale_variants carries field_source_hashes jsonb NOT NULL DEFAULT {} and stale_field_ids jsonb NOT NULL DEFAULT [] [P2-S12-AC-260]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title: 'field_source_hashes refuses a 129th key [P2-S12-AC-260]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title:
              'every field_source_hashes value is 64 lowercase hex [P2-S12-AC-260]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title: 'field_source_hashes must be an object [P2-S12-AC-260]',
          },
        ],
      },
      {
        text: "`stale_field_ids jsonb NOT NULL DEFAULT '[]'` is an array of at most 128 UUIDs,",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title: 'stale_field_ids refuses a 129th member [P2-S12-AC-260]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title: 'stale_field_ids members are UUIDs [P2-S12-AC-260]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title: 'stale_field_ids members are unique [P2-S12-AC-260]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title: 'stale_field_ids must be an array [P2-S12-AC-260]',
          },
        ],
      },
      {
        text: 'the physical state is `draft` or `stale`,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title:
              'the physical state is draft or stale: review, approved and untranslated are derived, never stored [P2-S12-AC-260]',
          },
        ],
      },
      {
        text: 'and each snapshot is immutable (`updated_at = created_at`), source changes appending a stale or new variant row.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_related_authority.sql',
            title: 'locale snapshots are append-only',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_related_authority.sql',
            title:
              'locale and related-content versions reject direct writes and mutation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_source_stale.sql',
            title:
              'a changed source appends one stale version for each dependent locale',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'one immutable locale variant is committed',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title:
              'a snapshot with updated_at different from created_at is refused [P2-S12-AC-260]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-261',
    text: 'RPC and grant inventory: all fifteen 03c tables and the support table `platform_private.taxonomy_merge_recoveries` use forced RLS with no direct write grants for `authenticated` and `anon`; the named RPCs are the five original commands (`cms_define_template`, `cms_insert_pattern_instance`, `cms_act_taxonomy_term`, `cms_author_locale_variant`, `cms_curate_related_content`) plus `cms_template_latest`, `cms_pattern_latest`, `cms_list_taxonomy_versions`, `cms_list_taxonomy_terms`, `cms_submit_governed_review`, `cms_record_governed_decision`, `cms_assign_governed_reviewer`, `cms_activate_governed_subject`, `cms_get_governed_review`, `cms_list_governed_reviews`, `cms_create_pattern_version`, `cms_list_pattern_selector`, `cms_get_instance_update_diff`, `cms_apply_pattern_update`, `cms_create_taxonomy_version`, `cms_list_taxonomy_selector`, `cms_get_related_content`, `cms_get_locale_variant` and `cms_list_composition_instances`, with the internal RPCs `cms_canonical_taxonomy_match`, `cms_claim_due_governed_activations`, `cms_execute_governed_activation`, `cms_resolve_locale_field`, `cms_related_content_public_targets`, `cms_resolve_taxonomy_version`, `cms_invalidate_governed_reviews_for_person`, `cms_recheck_governed_reviews(p_request jsonb)`, `cms_governed_recheck_resolve_event`, `cms_scan_linked_pattern_updates`, `cms_linked_scan_resolve_event`, `cms_reconcile_taxonomy_merge_converge` and `cms_locale_observability_read` and the job handlers `cms.pattern.linked_update_scan` and `cms.governed_review.recheck` (typed platform-queue messages) and `cms.taxonomy.merge_converge` (a BE00 jobs row); every SECURITY DEFINER function is schema-qualified with an empty `search_path`, has PUBLIC execute revoked and named grants only, and has positive and negative grant tests.',
    clauses: [
      {
        text: 'RPC and grant inventory: all fifteen 03c tables and the support table `platform_private.taxonomy_merge_recoveries` use forced RLS with no direct write grants for `authenticated` and `anon`;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql',
            title:
              'the exact set of forced tables that functions owned by the definer roles name is pinned (a new table, or a function that starts naming one, must be reviewed here) [P2-S09-AC-181]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql',
            title:
              'no API role holds any privilege on any forced table the dedicated roles touch (N/N) [P2-S09-AC-181] [P2-S09-AC-946]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title: 'both composition tables enforce forced RLS',
          },
        ],
      },
      {
        text: 'the named RPCs are the five original commands (`cms_define_template`, `cms_insert_pattern_instance`, `cms_act_taxonomy_term`, `cms_author_locale_variant`, `cms_curate_related_content`) plus `cms_template_latest`, `cms_pattern_latest`, `cms_list_taxonomy_versions`, `cms_list_taxonomy_terms`, `cms_submit_governed_review`, `cms_record_governed_decision`, `cms_assign_governed_reviewer`, `cms_activate_governed_subject`, `cms_get_governed_review`, `cms_list_governed_reviews`, `cms_create_pattern_version`, `cms_list_pattern_selector`, `cms_get_instance_update_diff`, `cms_apply_pattern_update`, `cms_create_taxonomy_version`, `cms_list_taxonomy_selector`, `cms_get_related_content`, `cms_get_locale_variant` and `cms_list_composition_instances`, with the internal RPCs `cms_canonical_taxonomy_match`, `cms_claim_due_governed_activations`, `cms_execute_governed_activation`, `cms_resolve_locale_field`, `cms_related_content_public_targets`, `cms_resolve_taxonomy_version`, `cms_invalidate_governed_reviews_for_person`, `cms_recheck_governed_reviews(p_request jsonb)`, `cms_governed_recheck_resolve_event`, `cms_scan_linked_pattern_updates`, `cms_linked_scan_resolve_event`, `cms_reconcile_taxonomy_merge_converge` and `cms_locale_observability_read` and the job handlers `cms.pattern.linked_update_scan` and `cms.governed_review.recheck` (typed platform-queue messages) and `cms.taxonomy.merge_converge` (a BE00 jobs row);',
        citations: [],
      },
      {
        text: 'every SECURITY DEFINER function is schema-qualified with an empty `search_path`,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql',
            title:
              'every such definer function pins an empty search_path (N/N) [P2-S09-AC-181]',
          },
        ],
      },
      {
        text: 'has PUBLIC execute revoked and named grants only, and has positive and negative grant tests.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "the named RPCs are the five original commands (`cms_define_template`, `cms_insert_pattern_instanc...": missing test: pgTAP, new supabase/tests/phase_02_slice_12_rpc_grant_inventory.sql listing every named RPC (the 5 original commands, the 20 platform RPCs, the 13 internal RPCs and the three job handler registrations) and asserting for each: exists, SECURITY DEFINER, empty search_path, no PUBLIC execute, and the exact grantees (service_role only for platform_api wrappers, none for private functions). Per-function grant tests exist for most (governed_activation/070-privileges, governed_schedule/060-privileges, governed_assignment/050, governed_decision/050, governed_reads/040, dec194_sweep/010-surface, pattern_definition/070-storage `only the service transport may execute the latest-read wrapper`, taxonomy_terms_canonical `PUBLIC, anon, authenticated and service_role cannot execute the RPC [P2-S12-AC-138]`, locale_resolution/002-resolver) but they are not an inventory and are not cited: the inventory lists cms_resolve_taxonomy_version, which does not exist (AC-242), and none of cms_template_latest/cms_pattern_latest is covered by name beside the pattern-definition suite. "has PUBLIC execute revoked and named grants only, and has positive and negative grant tests.": Only the empty-search_path half of this part is asserted schema-wide; "PUBLIC execute revoked and named grants only" and "positive and negative grant tests" per function need the inventory test above.',
  },
  {
    criterion: 'P2-S12-AC-262',
    text: "Governed read scopes: GovernedReview SELECT requires one of the scopes of the governed machinery (the submitter, a non-revoked reviewer assignee, a holder of the subject kind's owner capability, or the receipt-derived owner), a decision's `reason` is readable only by its decider, assignments are serialized only to the owner and the own assignment to its reviewer with no person, actor or party identifier, and `cms_governed_activation_schedules`, `cms_governed_review_dependencies` and `cms_canonical_domain_registry` have no browser or service-role read.",
    clauses: [
      {
        text: "Governed read scopes: GovernedReview SELECT requires one of the scopes of the governed machinery (the submitter, a non-revoked reviewer assignee, a holder of the subject kind's owner capability, or the receipt-derived owner), a decision's `reason` is readable only by its decider, assignments are serialized only to the owner and the own assignment to its reviewer with no person, actor or party identifier, and `cms_governed_activation_schedules`, `cms_governed_review_dependencies` and `cms_canonical_domain_registry` have no browser or service-role read.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the receipt owner/submitter/capability holder, an assignee, the deciding reviewer and a second assignee can all read R3 [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'a decision shows its slot capability and instant to every reader but its reason to no one but its decider [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'only the receipt owner receives the assignment summaries, by distinct display label; every other reader receives [] [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'no person, auth user or party identifier appears anywhere in any reader document [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql',
            title:
              'no API role holds any privilege on any forced table the dedicated roles touch (N/N) [P2-S09-AC-181] [P2-S09-AC-946]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              'an absent, cross-owner or non-member read is one concealed NOT_FOUND; a confirmed member with no read scope, or whose assignment was revoked, is 403 capability_missing; extra or malformed input is INVALID_REQUEST [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'an assignee receives only the id and end of the own assignment [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              "a holder of the subject kind's owner capability who is neither submitter, assignee nor owner reads the review and is offered activate and schedule, without the owner assignments [P2-S12-AC-090]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the submitter who is not the receipt owner reads the review without owner actions or assignments [P2-S12-AC-090]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-263',
    text: 'Slice 12 metrics: `cms_governed_review_total{subject_kind,outcome}`, `cms_governed_decision_total{decision,outcome}`, `cms_governed_activation_total{subject_kind,action,outcome}`, `cms_governed_review_invalidated_total{reason}`, `cms_governed_schedule_blocked_total{reason}`, `cms_pattern_linked_update_pending_total`, `cms_pattern_update_total{action,outcome}`, `cms_canonical_match_total{domain,outcome}`, `cms_canonical_source_unavailable_total{domain}`, `cms_related_target_ineligible_total`, `cms_locale_fanout_total` and `cms_locale_limit_reached_total` are emitted at the events they name, and labels never carry an id, label text, locale text, hash or person.',
    clauses: [
      {
        text: 'Slice 12 metrics: `cms_governed_review_total{subject_kind,outcome}`, `cms_governed_decision_total{decision,outcome}`, `cms_governed_activation_total{subject_kind,action,outcome}`, `cms_governed_review_invalidated_total{reason}`, `cms_governed_schedule_blocked_total{reason}`, `cms_pattern_linked_update_pending_total`, `cms_pattern_update_total{action,outcome}`, `cms_canonical_match_total{domain,outcome}`, `cms_canonical_source_unavailable_total{domain}`, `cms_related_target_ineligible_total`, `cms_locale_fanout_total` and `cms_locale_limit_reached_total` are emitted at the events they name, and labels never carry an id, label text, locale text, hash or person.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-registry.test.ts',
            title:
              '[P2-S12-AC-263] the Slice 12 metric registry names exactly the twelve metrics of BE03c Observability and cms_locale_stale_total with exactly their labels, plus the gate counter and the stale legal-field gauge',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-registry.test.ts',
            title:
              '[P2-S12-AC-263] the Slice 12 metric registry never names a label that could carry an id, label text, locale text, hash or person',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-metrics.test.ts',
            title:
              '[P2-S12-AC-263] governed review submit and decision counters counts a template_version submit answered 201 once as outcome success',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-metrics.test.ts',
            title:
              '[P2-S12-AC-263] governed review submit and decision counters counts a approve decision answered 200 once as outcome success',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-metrics.test.ts',
            title:
              'CMS-03C-09 emits cms_governed_activation_total with the spec labels counts a verified activate success once, with its subject kind',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-metrics.test.ts',
            title:
              'CMS-03C-09 emits cms_governed_activation_total with the spec labels keeps every label closed: no key, user, party or review id reaches the metric',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-metrics.test.ts',
            title:
              '[P2-S12-AC-263] cms_governed_review_invalidated_total counts a committed dependency_changed refusal of CMS-03C-07 as one invalidation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-governed-activation-sweep.test.ts',
            title:
              'executing claims counts a blocked schedule with its closed reason and only then',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/linked-scan/job.test.ts',
            title:
              '[P2-S12-AC-212] the cms.pattern.linked_update_scan job increments cms_pattern_linked_update_pending_total by the rows the run appended [BE03c Observability]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-metrics.test.ts',
            title:
              '[P2-S12-AC-263] pattern update counter counts a CMS-03C-15 accept answered 200 as outcome success',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-metrics.test.ts',
            title:
              '[P2-S12-AC-263] canonical taxonomy counters counts a canonical_overlap refusal of CMS-03C-03 as a match in its published domain',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-metrics.test.ts',
            title:
              '[P2-S12-AC-263] canonical taxonomy counters counts a canonical_source_unavailable refusal of CMS-03C-03 in both counters',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-metrics.test.ts',
            title:
              '[P2-S12-AC-263] related-content and locale counters counts the uniform related_target_ineligible refusal of CMS-03C-05 once',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-metrics.test.ts',
            title:
              '[P2-S12-AC-263] related-content and locale counters counts the 409 locale_limit_reached refusal of CMS-03C-04 once',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-observability-probe.test.ts',
            title:
              '[P2-S12-AC-263] the counters and the gauge adds fanoutRows and staleFieldsAppended to the two counters and sets the gauge, in one event',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-metrics.test.ts',
            title:
              '[P2-S12-AC-263] closed facts only only ever produces keys the registry accepts, for every operation, status and refusal',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-governed.test.ts',
            title:
              'CMS-03C-06 emits cms_governed_review_total counts a committed template_version submit once, with its subject kind and the success outcome',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-governed.test.ts',
            title:
              'CMS-03C-06 emits cms_governed_review_total counts a refused submit under its outcome and the canonical counters of its published domain',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-governed.test.ts',
            title:
              'CMS-03C-07 emits cms_governed_decision_total and the invalidation counter counts a recorded approve decision once',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-governed.test.ts',
            title:
              'CMS-03C-07 emits cms_governed_decision_total and the invalidation counter counts a committed dependency_changed refusal as a conflicting decision, and the invalidation in its own event',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-pattern-update.test.ts',
            title:
              'CMS-03C-15 emits cms_pattern_update_total counts an accept once under the success outcome',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-related-locale.test.ts',
            title:
              'CMS-03C-05 emits cms_related_target_ineligible_total counts the uniform related_target_ineligible 422 once and carries no target pointer',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-related-locale.test.ts',
            title:
              'CMS-03C-04 emits cms_locale_limit_reached_total counts the 409 locale_limit_reached refusal once and carries no locale',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-taxonomy.test.ts',
            title:
              'CMS-03C-03 canonical counters counts a canonical_overlap refusal as a match in the published domain, and the canonical id nowhere',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-264',
    text: 'Alerts and diagnostics: alerts fire on a DLQ above 0, outbox age above 2 minutes, an activation blocked for more than 15 minutes, a stale locale legal-field count above 0 or a target-filter anomaly, traces cover validation, principal and assignment, registry or projection refetch, idempotency, RPC and SQL, audit and outbox, and consumer refetch, and structured logs and diagnostics carry allowlisted fields only (operation, request id, safe ids and hashes, version, outcome, error code, duration, dependency class, retryability) and never content, locale text, labels, target names, tokens, raw rules or a capability graph.',
    clauses: [
      {
        text: 'Alerts and diagnostics: alerts fire on a DLQ above 0, outbox age above 2 minutes, an activation blocked for more than 15 minutes, a stale locale legal-field count above 0 or a target-filter anomaly, traces cover validation, principal and assignment, registry or projection refetch, idempotency, RPC and SQL, audit and outbox, and consumer refetch, and structured logs and diagnostics carry allowlisted fields only (operation, request id, safe ids and hashes, version, outcome, error code, duration, dependency class, retryability) and never content, locale text, labels, target names, tokens, raw rules or a capability graph.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/observability/phase-02-slice-12-alert-policy.test.ts',
            title:
              '[P2-S12-AC-264] composition alert thresholds pins the six named conditions and their numbers in one executable policy',
          },
          {
            tool: 'vitest',
            file: 'tests/observability/phase-02-slice-12-alert-policy.test.ts',
            title:
              '[P2-S12-AC-264] composition alert evaluation pages the exact dlq_nonempty condition once, to the on-call route and the composition runbook',
          },
          {
            tool: 'vitest',
            file: 'tests/observability/phase-02-slice-12-alert-policy.test.ts',
            title:
              '[P2-S12-AC-264] composition alert evaluation pages the exact outbox_age_exceeded condition once, to the on-call route and the composition runbook',
          },
          {
            tool: 'vitest',
            file: 'tests/observability/phase-02-slice-12-alert-policy.test.ts',
            title:
              '[P2-S12-AC-264] composition alert evaluation pages the exact activation_blocked condition once, to the on-call route and the composition runbook',
          },
          {
            tool: 'vitest',
            file: 'tests/observability/phase-02-slice-12-alert-policy.test.ts',
            title:
              '[P2-S12-AC-264] composition alert evaluation pages the exact stale_locale_legal_fields condition once, to the on-call route and the composition runbook',
          },
          {
            tool: 'vitest',
            file: 'tests/observability/phase-02-slice-12-alert-policy.test.ts',
            title:
              '[P2-S12-AC-264] composition alert evaluation pages the exact target_filter_anomaly condition once, to the on-call route and the composition runbook',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-observation.test.ts',
            title:
              '[P2-S12-AC-264] the trace stage vocabulary lists the seven BE03c stages in their spec order, each with one owner and one step name',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-observation.test.ts',
            title:
              '[P2-S12-AC-264] request traces records the stages a request entered in the canonical order, whatever order they were noted in',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-observation.test.ts',
            title:
              '[P2-S12-AC-264] the structured request log writes only allowlisted members, even when every fact is hostile',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-observation.test.ts',
            title:
              '[P2-S12-AC-264] the structured request log lists exactly the BE03c log keys and the logger envelope as its allowlist',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-governed.test.ts',
            title:
              'governed review request traces and log members writes only allowlisted members and no request, session or provider text',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-265',
    text: "Template pages: `/app/cms-content-modeling/templates/new` and `/app/cms-content-modeling/templates/:templateKey` are protected Astro SSR pages (`CmsTemplateDesigner` for create, `CmsTemplateEditDesigner` for a successor from `cmsTemplateLatestRead`) with the bounded `CmsGovernedReviewPanel`: the server verifies the Supabase session, expiry and acting context (a missing or expired session uses the allowlisted 303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without `cms.template_designer` in the owner scope is 403, `context`, `versions` and `new` never resolve as `:templateKey`, `:templateKey` addresses the owner's latest definition, and Back restores the form without serializing a definition.",
    clauses: [
      {
        text: 'Template pages: `/app/cms-content-modeling/templates/new` and `/app/cms-content-modeling/templates/:templateKey` are protected Astro SSR pages (`CmsTemplateDesigner` for create, `CmsTemplateEditDesigner` for a successor from `cmsTemplateLatestRead`) with the bounded `CmsGovernedReviewPanel`:',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/templates/template-designer-route.test.ts',
            title:
              'CMS-11 protected template designer page renders on demand with no-store headers and a navigable focus target',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/templates/template-designer-route.test.ts',
            title:
              'CMS-11 protected template successor page loads canonical detail and selectors before hydrating the edit form',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedTemplatePanel.test.tsx',
            title:
              'CmsGovernedTemplatePanel submits the template version it was served and re-reads the latest template afterwards',
          },
        ],
      },
      {
        text: 'the server verifies the Supabase session, expiry and acting context',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route fails closed when 'unauthenticated'",
          },
        ],
      },
      {
        text: '(a missing or expired session uses the allowlisted 303 sign-in redirect),',
        citations: [],
      },
      {
        text: 'malformed ids or keys are 400,',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-edit.spec.ts',
            title:
              'Phase 2 Slice 12 protected template edit > [P2-S12-AC-265] a malformed template key is a no-store, accessible 400 without disclosure',
            project: 'chrome',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route rejects invalid selectors after authentication and before authorization or the read',
          },
        ],
      },
      {
        text: 'a concealed or absent target is a disclosure-safe 404,',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-unavailable-copy.test.ts',
            title:
              'cmsTemplateUnavailableCopy (the edit page notice, FE03 :877, :1066) answers 404 with its fixed sentence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route preserves concealed not-found and rejects malformed dependency data',
          },
        ],
      },
      {
        text: 'a visible target without `cms.template_designer` in the owner scope is 403,',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-unavailable-copy.test.ts',
            title:
              'cmsTemplateUnavailableCopy (the edit page notice, FE03 :877, :1066) answers 403 with its fixed sentence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route requires the live designer capability before reading',
          },
        ],
      },
      {
        text: '`context`, `versions`',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-edit.spec.ts',
            title:
              'Phase 2 Slice 12 protected template edit > [P2-S12-AC-265] [P2-S12-AC-189] the reserved key context never resolves as a template key',
            project: 'chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-edit.spec.ts',
            title:
              'Phase 2 Slice 12 protected template edit > [P2-S12-AC-265] [P2-S12-AC-189] the reserved key versions never resolves as a template key',
            project: 'chrome',
          },
        ],
      },
      {
        text: '`new` never resolve as `:templateKey`,',
        citations: [],
      },
      {
        text: "`:templateKey` addresses the owner's latest definition,",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route reads only the validated latest definition with a strong ETag and no-store',
          },
        ],
      },
      {
        text: 'and Back restores the form without serializing a definition.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "(a missing or expired session uses the allowlisted 303 sign-in redirect),": no behavioural test drives the allowlisted 303 sign-in redirect for a missing or expired session (the only citation, a source-text page test, was refuted) "`new` never resolve as `:templateKey`,": `new` never resolving as `:templateKey` is not asserted (new.astro is a sibling route file, so the router, not a test, resolves it): missing test: Playwright in tests/e2e/phase-02-slice-12-template-edit.spec.ts, GET /app/cms-content-modeling/templates/new renders the create page (h1 not "Not found", no latest read), FE03 877. "and Back restores the form without serializing a definition.": missing test: Playwright (real-route, project real-route-chrome) in tests/e2e/phase-02-slice-12-template-real-route.spec.ts: edit a template draft, navigate away and press Back; assert the form is restored from the browser (not from a URL carrying the definition: location.search/hash empty and the history entry holds no serialized definition) FE03 877/1066. No existing test presses Back on the template pages.',
  },
  {
    criterion: 'P2-S12-AC-266',
    text: "Pattern pages: `/app/cms-content-modeling/patterns/new` and `/app/cms-content-modeling/patterns/:patternKey` are protected Astro SSR pages with `CmsPatternVersionDesigner` and the bounded `CmsGovernedReviewPanel`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without `cms.template_designer` is 403, `context`, `versions`, `selector` and `new` are reserved keys, `:patternKey` addresses the owner's latest version (`cmsPatternLatestRead`), and a successor sends the read version as `expectedVersion`.",
    clauses: [
      {
        text: "Pattern pages: `/app/cms-content-modeling/patterns/new` and `/app/cms-content-modeling/patterns/:patternKey` are protected Astro SSR pages with `CmsPatternVersionDesigner` and the bounded `CmsGovernedReviewPanel`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without `cms.template_designer` is 403, `context`, `versions`, `selector` and `new` are reserved keys, `:patternKey` addresses the owner's latest version (`cmsPatternLatestRead`), and a successor sends the read version as `expectedVersion`.",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a new pattern redirects an expired session to sign-in and back to the new-pattern page',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern redirects when either read says the session ended',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/patterns/pattern-pages.test.ts',
            title:
              'new.astro redirects an expired session with a 303 and takes its status from the loader',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/patterns/pattern-pages.test.ts',
            title:
              '[patternKey].astro redirects an expired session with a 303 and takes its status from the loader',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern answers the key "selector" with a 400 before any read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern answers the key "new" with a 400 before any read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern answers the key "context" with a 400 before any read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern answers the key "versions" with a 400 before any read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern answers the key "Bad_Key" with a 400 before any read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern shows the disclosure-safe 404 for a concealed or absent key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a new pattern shows one fixed notice for a 403',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern serves the latest version as the edit preimage and the panel facts',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/pattern-designer-request.test.ts',
            title:
              'buildPatternVersionRequest sends the read version as expectedVersion for a successor',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedPatternPanel.test.tsx',
            title:
              'CmsGovernedPatternPanel submits the pattern version it was served and re-reads the latest pattern afterwards',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'latest-no-capability: exact SQL message token [P2-S12-AC-104]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-267',
    text: 'Taxonomy pages: `/app/cms-content-modeling/taxonomies/new` and `/app/cms-content-modeling/taxonomies/:taxonomyId` are protected Astro SSR pages with `CmsTaxonomyVersionDesigner`, `CmsTaxonomyTermForm` and the bounded `CmsGovernedReviewPanel`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without `cms.taxonomy_curator` in the owner scope is 403, term actions render only against an `active` version, `:taxonomyId` is the vocabulary lineage id, and the term list cursor is URL state that never serializes a protected value.',
    clauses: [
      {
        text: 'Taxonomy pages: `/app/cms-content-modeling/taxonomies/new` and `/app/cms-content-modeling/taxonomies/:taxonomyId` are protected Astro SSR pages with `CmsTaxonomyVersionDesigner`, `CmsTaxonomyTermForm` and the bounded `CmsGovernedReviewPanel`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without `cms.taxonomy_curator` in the owner scope is 403, term actions render only against an `active` version, `:taxonomyId` is the vocabulary lineage id, and the term list cursor is URL state that never serializes a protected value.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/taxonomies/taxonomy-pages.test.ts',
            title:
              'new.astro renders on demand with no-store headers and answers only GET',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/taxonomies/taxonomy-pages.test.ts',
            title:
              '[taxonomyId].astro renders on demand with no-store headers and answers only GET',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/taxonomies/taxonomy-pages.test.ts',
            title:
              'new.astro redirects an expired session with a 303 and takes its status from the loader',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/taxonomies/taxonomy-pages.test.ts',
            title:
              '[taxonomyId].astro redirects an expired session with a 303 and takes its status from the loader',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.new.test.ts',
            title:
              'loadTaxonomyPage: a new vocabulary is the curator capability gate when the probe is refused with 403',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary shows one fixed notice for a versions 403',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary shows one fixed notice for a versions 404',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary answers the malformed or reserved id not-a-uuid with 400 before any read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary answers the malformed or reserved id versions with 400 before any read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary offers term actions against no version when none is active',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary serves the newest version as the edit preimage, the history, the active version and the first term page',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary forwards the URL state of the term list and never any other member of the page URL',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/taxonomies/taxonomy-pages.test.ts',
            title:
              'the saved-vocabulary page mounts the term form only from a verified vocabulary and term page',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.active.test.tsx',
            title:
              'CmsTaxonomyTermForm: a vocabulary whose active version was not found keeps the plain no-active-version sentence when every version was read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.active.test.tsx',
            title:
              'CmsTaxonomyTermForm: a vocabulary whose active version was not found says the search stopped at the newest 50 when the read was full, and links the review',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedTaxonomyPanel.test.tsx',
            title:
              'CmsGovernedTaxonomyPanel submits the vocabulary version it was served and re-reads the versions afterwards',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.new.test.ts',
            title:
              'loadTaxonomyPage: a new vocabulary redirects an expired session to sign-in and back to the new-vocabulary page',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-268',
    text: "Definition review pages: `/app/cms-content-modeling/definition-reviews` and `/app/cms-content-modeling/definition-reviews/:reviewId` are protected server-first pages (`CmsGovernedReviewQueue`, `CmsGovernedReviewDetail`, `CmsGovernedDecisionForm`, owner `CmsGovernedAssignmentForm`, `CmsGovernedActivationForm`): the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without the capability is 403, the decision form renders only with an effective assignment, the assignment form only for the owner, the activation form only for the subject's owner-capability holder, offering _Activate_ and _Schedule_ on an `approved` or `blocked` version and _Retire_ on an `active` version when the server permits it, `GovernedReviewQueueQuery` owns `scope`, `state`, `subjectKind`, `limit` and `cursor` in URL state, and the detail URL carries only the immutable `reviewId`.",
    clauses: [
      {
        text: "Definition review pages: `/app/cms-content-modeling/definition-reviews` and `/app/cms-content-modeling/definition-reviews/:reviewId` are protected server-first pages (`CmsGovernedReviewQueue`, `CmsGovernedReviewDetail`, `CmsGovernedDecisionForm`, owner `CmsGovernedAssignmentForm`, `CmsGovernedActivationForm`): the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without the capability is 403, the decision form renders only with an effective assignment, the assignment form only for the owner, the activation form only for the subject's owner-capability holder, offering _Activate_ and _Schedule_ on an `approved` or `blocked` version and _Retire_ on an `active` version when the server permits it, `GovernedReviewQueueQuery` owns `scope`, `state`, `subjectKind`, `limit` and `cursor` in URL state, and the detail URL carries only the immutable `reviewId`.",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'definition-reviews/index.astro response invariants maps a sign-in outcome to the allowlisted 303 only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'definition-reviews/[reviewId].astro response invariants maps a sign-in outcome to the allowlisted 303 only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/load-governed-detail-page.test.ts',
            title:
              'loadGovernedDetailPage answers a malformed review id with a 400 before any read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/load-governed-detail-page.test.ts',
            title:
              'loadGovernedDetailPage answers a hidden, absent or cross-owner review with one identical 404 state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/load-governed-detail-page.test.ts',
            title: 'loadGovernedDetailPage renders a 403 as one closed state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'CMS-03C-10 protected definition-review detail page, composed serves the evidence and the decision form to an assignee',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'CMS-03C-10 protected definition-review detail page, composed serves the assignment controls to the owner and no person identifier',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx',
            title:
              'CmsGovernedAssignmentForm visibility (CMS-03C-08) renders only the controls the server permits',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx',
            title:
              'CmsGovernedActivationForm (CMS-03C-09) controls offers exactly the permitted actions as unselected radios under a named heading',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx',
            title:
              'CmsGovernedActivationForm (CMS-03C-09) controls offers only Retire for an active version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/load-governed-queue-page.test.ts',
            title:
              'loadGovernedQueuePage returns the verified page with the URL-owned query for the view',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'CMS-03C-11 protected definition-review queue page, composed lists the scope as native links with a signed, URL-owned continuation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.test.tsx',
            title:
              'CmsGovernedReviewDetailIsland (CMS-03C-10) serves the evidence and exactly the forms permittedNextActions allows',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.test.tsx',
            title:
              'CmsGovernedReviewDetailIsland (CMS-03C-10) states why no decision form is offered on an open review',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.activation.test.tsx',
            title:
              'CmsGovernedReviewDetailIsland activation (CMS-03C-09, DEC-190) offers Activate and Schedule for an approved version and Retire for an active one, from permittedNextActions only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/load-governed-detail-page.test.ts',
            title:
              'loadGovernedDetailPage returns an expired session to this exact review',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-269',
    text: "Composition page: `/app/cms-content-modeling/entries/:entryId/composition` is a protected server-first page with `CmsCompositionInstanceList`, `CmsPatternSelector` and `CmsPatternUpdateDiff`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids are 400, a concealed or absent target is a disclosure-safe 404, a visible target without entry assignment and edit authority is 403, commands target only the entry's current draft revision, `:entryId` is the only URL state, instance ids are row-local, and Back restores the list without serializing a diff.",
    clauses: [
      {
        text: "Composition page: `/app/cms-content-modeling/entries/:entryId/composition` is a protected server-first page with `CmsCompositionInstanceList`, `CmsPatternSelector` and `CmsPatternUpdateDiff`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids are 400, a concealed or absent target is a disclosure-safe 404, a visible target without entry assignment and edit authority is 403, commands target only the entry's current draft revision, `:entryId` is the only URL state, instance ids are row-local, and Back restores the list without serializing a diff.",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx',
            title:
              'protected composition page, composed serves the insert form with the real selector and the entry instances once the four reads are verified',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx',
            title:
              'protected composition page, composed returns an expired session to this page by the allowlisted sign-in redirect',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx',
            title:
              'protected composition page, composed answers malformed ids and any URL state with 400 and no read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx',
            title:
              'protected composition page, composed answers a concealed or absent entry with one closed 404 and reads nothing more',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx',
            title:
              'protected composition page, composed refuses a visible entry the account cannot edit with the page-level 403 of the instance list read, before the content type or the selector is read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/load-composition-page.test.ts',
            title:
              'loadCompositionPage: the view marks a revision that is not the editable draft as read-only without hiding the page',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx',
            title:
              'entries/[entryId]/composition.astro response invariants hydrates exactly one island from the loader view and puts no id in the markup',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.privacy.test.tsx',
            title:
              'composition island: no state outside the component leaves the URL, history, storage, cookies and console untouched through a full journey',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'review: the diff is read fresh and nothing is preselected reads the diff again on every open: it is never cached',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx',
            title:
              'entries/[entryId]/composition.astro response invariants maps a sign-in outcome to the allowlisted 303 only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx',
            title:
              'protected composition page, composed reads the entry, its instances, its content type and the selector exactly once each, with the session and no URL state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/load-composition-page.test.ts',
            title:
              'loadCompositionPage: closed states refuses a list of another revision than the draft as unverified',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: refusals after revision_not_editable disables the commands once the draft is no longer editable',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-270',
    text: "Locale page: `/app/cms-content-modeling/entries/:entryId/locales/:locale` is a protected server-first page with `CmsLocaleVariantForm`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids are 400, a concealed or absent target is a disclosure-safe 404, a visible target without entry assignment and edit authority is 403, `:locale` must be a member of the active version's `supportedLocales`, `:entryId`/`:locale` are the only URL state, and the fallback order is read from the version detail and never serialized.",
    clauses: [
      {
        text: "Locale page: `/app/cms-content-modeling/entries/:entryId/locales/:locale` is a protected server-first page with `CmsLocaleVariantForm`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids are 400, a concealed or absent target is a disclosure-safe 404, a visible target without entry assignment and edit authority is 403, `:locale` must be a member of the active version's `supportedLocales`, `:entryId`/`:locale` are the only URL state, and the fallback order is read from the version detail and never serialized.",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/locale-route.test.tsx',
            title:
              'CMS-03C-04 protected locale variant page, composed serves the translation form with the read-only order, the localizable fields and the version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/locale-route.test.tsx',
            title:
              'CMS-03C-04 protected locale variant page, composed returns an expired session to this page by the allowlisted sign-in redirect',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/locale-route.test.tsx',
            title:
              'CMS-03C-04 protected locale variant page, composed answers malformed ids, a malformed tag and any URL state with 400 and no read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/locale-route.test.tsx',
            title:
              'CMS-03C-04 protected locale variant page, composed answers a concealed or absent entry with one closed 404 and no form',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/locale-route.test.tsx',
            title:
              'CMS-03C-04 protected locale variant page, composed [P2-S12-AC-270] answers a visible entry the account cannot edit (the read’s 403) with the page-level 403 and no form',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/locale-route.test.tsx',
            title:
              'CMS-03C-04 protected locale variant page, composed answers a locale outside the active supportedLocales (the read’s 404) with the disclosure-safe 404',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/load-locale-variant-page.test.ts',
            title:
              'loadLocaleVariantPage (FE03 :1073, :1641; AC-270; DEC-205) answers a locale outside the active supportedLocales (the read’s 404) with the disclosure-safe 404 and no form',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: what the page shows (FE03 :891, :1122, :1336) states the entry, the language and the read-only fallback order as "{target}: {a} → {default}"',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/locale-route.test.tsx',
            title:
              'entries/[entryId]/locales/[locale].astro response invariants maps a sign-in outcome to the allowlisted 303 only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/locale-route.test.tsx',
            title:
              'CMS-03C-04 protected locale variant page, composed reads the draft, the definitions and the locale variant exactly once each, with the session and no URL state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/locale-route.test.tsx',
            title:
              'CMS-03C-04 protected locale variant page, composed answers a visible entry the account cannot read with 403, and one it cannot translate with 403',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/locale-route.test.tsx',
            title:
              'entries/[entryId]/locales/[locale].astro response invariants hydrates exactly one island from the loader’s verified view and puts no id in the markup',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/load-locale-variant-page.read.test.ts',
            title:
              'loadLocaleVariantPage: what cmsLocaleVariantRead carries into the view (DEC-205) shows the read’s own order: an empty order for the default locale and the declared one otherwise',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/load-locale-variant-page.test.ts',
            title:
              'loadLocaleVariantPage (FE03 :1073, :1641; AC-270; DEC-205) answers the source locale itself with the same 404, whatever the read answered',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant_read/003-authority.sqlinc',
            title:
              'a well-formed locale that is not configured is NOT_FOUND [P2-S12-AC-270]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant_read/003-authority.sqlinc',
            title:
              'a locale outside the active version supportedLocales is the same NOT_FOUND answer as an absent entry [P2-S12-AC-270]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant_read/003-authority.sqlinc',
            title:
              'a granted editor with no assignment on the entry is refused FORBIDDEN although the entry is visible [P2-S12-AC-270]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant_read/003-authority.sqlinc',
            title:
              'a hidden entry and an absent one are byte-identical answers: the read is no existence oracle [P2-S12-AC-270]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant_read/003-authority.sqlinc',
            title:
              'authority is answered before the locale: a caller without edit gets FORBIDDEN for an unsupported locale too [P2-S12-AC-270]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-271',
    text: 'Definition governance states: for `governedReviewState` (CMS-03C-10 and -11), `selectorState` and `latestReadState` (CMS-03C-13 and -17 and the template, pattern, vocabulary-version and term reads), `diffState` (CMS-03C-14) and `commandState` (CMS-03C-01 to -09, -12, -15 and -16) the island renders `idle`, `loading` (a skeleton after 250 ms and only the commit control disabled), `success`, `empty`, `error`, `degraded` and `disabled` exactly as the state table states, server-authoritative, no-store and never optimistic: a 401 `STEP_UP_REQUIRED` routes to `/step-up?returnTo=`, a 403 `capability_missing` or `separation_of_duties` renders the `CapabilityGate` copy, 409 reasons render fixed copy and refetch, 422 reasons render fixed copy at the field, an unknown mutation outcome renders pending and reconciles by refetching the review, subject or entry before any retry, and a degraded diff is never kept but re-required.',
    clauses: [
      {
        text: 'Definition governance states: for `governedReviewState` (CMS-03C-10 and -11), `selectorState` and `latestReadState` (CMS-03C-13 and -17 and the template, pattern, vocabulary-version and term reads), `diffState` (CMS-03C-14) and `commandState` (CMS-03C-01 to -09, -12, -15 and -16) the island renders `idle`, `loading` (a skeleton after 250 ms and only the commit control disabled), `success`, `empty`, `error`, `degraded` and `disabled` exactly as the state table states, server-authoritative, no-store and never optimistic:',
        citations: [],
      },
      {
        text: 'a 401 `STEP_UP_REQUIRED` routes to `/step-up?returnTo=`,',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) routes a step-up shortfall to the verification page with the draft stored and nothing replayed',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx',
            title:
              'unconditional step-up (DEC-111) routes a shortfall to verification with the choice stored, replaying nothing',
          },
        ],
      },
      {
        text: 'a 403 `capability_missing` or `separation_of_duties` renders the `CapabilityGate` copy,',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) renders the separation-of-duties gate, never a step-up route',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx',
            title:
              'refusals and unknown outcomes renders the capability gate and never a step-up route for a 403',
          },
        ],
      },
      {
        text: '409 reasons render fixed copy and refetch, 422 reasons render fixed copy at the field,',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) refetches the review and states why for dependency_changed',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx',
            title:
              'refusals and unknown outcomes states why for activation_conflict and re-reads the review',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: refusals maps a 422 at /slotPath to the slot field and keeps every input',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx',
            title:
              'CmsPatternVersionDesigner: what the server answered puts a reserved key at the key field',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.refusals.test.tsx',
            title:
              'an ineligible target (422 related_target_ineligible) marks the offending pin row with the one fixed message and no other row',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'accept: refusals keep the author choices on diff_has_collisions refetches the entry version and the diff and keeps choices for unchanged paths',
          },
        ],
      },
      {
        text: 'an unknown mutation outcome renders pending and reconciles by refetching the review, subject or entry before any retry,',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) keeps the entered text and offers a reconciled retry after a lost answer',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx',
            title:
              'refusals and unknown outcomes keeps the entries and offers a reconciled retry under the same key after a lost answer',
          },
        ],
      },
      {
        text: 'and a degraded diff is never kept but re-required.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'review: the diff is read fresh and nothing is preselected reads the diff again on every open: it is never cached',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "Definition governance states: for `governedReviewState` (CMS-03C-10 and -11), `selectorState` and...": missing tests: (1) a Vitest per island (governed review queue/detail, template/pattern/vocabulary/term designers, composition list, diff, locale form) asserting the seven states idle/loading/success/empty/error/degraded/disabled against the FE03 state table, including loading = a skeleton only after 250 ms with only the commit control disabled (fake timers at 249/250 ms) and never optimistic; today no test mentions the 250 ms skeleton rule and islands are covered state by state only for some commands (governed decision/activation/assignment, related content, composition insert/update).',
  },
  {
    criterion: 'P2-S12-AC-272',
    text: 'Governed surface privacy: decision reasons, the policy basis, pattern diff values, canonical ids and every assignment identifier are re-derived by the server and never enter a public or private cache, an analytics event, a Realtime body, a URL or a log, and a browser never calls CMS-03C-18 to CMS-03C-21 because no browser route, form, proxy or client type exists for them.',
    clauses: [
      {
        text: 'Governed surface privacy: decision reasons, the policy basis, pattern diff values, canonical ids and every assignment identifier are re-derived by the server and never enter a public or private cache, an analytics event, a Realtime body, a URL or a log,',
        citations: [],
      },
      {
        text: 'and a browser never calls CMS-03C-18 to CMS-03C-21 because no browser route, form, proxy or client type exists for them.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-136] keeps the internal CMS-03C-18 to CMS-03C-21 operations and their records out of the browser inventory and OpenAPI',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes-refusals.test.ts',
            title:
              'CMS-03C-04 locale authoring route [P2-S12-AC-150] keeps the CMS-03C-20 resolver out of the browser route inventory and the locale app',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'CMS-03C-18 has no platform_api wrapper: it is not a browser or Worker route [P2-S12-AC-136]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'CMS-03C-21 has no platform_api wrapper and so no browser route [P2-S12-AC-153]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-no-public-targets-route.test.ts',
            title:
              'CMS-03C-21 has no browser route (BE03c 190) answers 404 or 405 for GET /api/v1/cms/related-content/public-targets',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] the platform route registry holds no other Slice 12 browser operation [P2-S12-AC-275] registers CMS-03C-01 to CMS-03C-17 contiguously as numbered ids and never CMS-03C-18 to CMS-03C-21',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'no platform_api (browser reachable) wrapper of the resolver exists [P2-S12-AC-150]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "Governed surface privacy: decision reasons, the policy basis, pattern diff values, canonical ids ...": missing test: Vitest (new apps/web/src/components/cms-governed-review/governed-privacy.test.tsx plus a Worker log/cache sweep) driving the governed detail, decision, pattern diff and assignment surfaces with sentinel values for a decision reason, policy basis hash, pattern diff value, canonical id and assignment identifier, then asserting none appears in fetch URLs, Cache-Control (no-store on every governed response), analytics/telemetry events, Realtime payloads, history/location or any log line. Partial evidence exists but is not a sweep and is not cited: governed-review headers tests (no-store), observability-governed `writes only allowlisted members and no request, session or provider text`, composition privacy journey (URL/history/storage untouched), load-governed-detail-page `refuses a body with a person identifier beyond the contract`.',
  },
  {
    criterion: 'P2-S12-AC-273',
    text: 'End-to-end journeys: Playwright, using the real routes and two people, creates, submits, assigns, decides (ordinary and protected) and activates, schedules and retires a template, a pattern and a vocabulary; shows a dependency invalidation returning a subject to draft, a linked pattern update accepted and detached, a term merged with convergence, a locale variant with a `no_fallback` block, and related content pinned and excluded; and runs keyboard-only and at 200% zoom with no diff value, canonical id or person id in the URL, storage, logs or telemetry.',
    clauses: [
      {
        text: 'End-to-end journeys: Playwright, using the real routes and two people, creates, submits, assigns, decides (ordinary and protected) and activates, schedules and retires a template, a pattern and a vocabulary; shows a dependency invalidation returning a subject to draft, a linked pattern update accepted and detached, a term merged with convergence, a locale variant with a `no_fallback` block, and related content pinned and excluded; and runs keyboard-only and at 200% zoom with no diff value, canonical id or person id in the URL, storage, logs or telemetry.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test is cited. Unproven: "End-to-end journeys: Playwright, using the real routes and two people, creates, submits, assigns,...": missing tests: Playwright real-route specs (project real-route-chrome, new tests/e2e/phase-02-slice-12-definition-journeys-real-route.spec.ts, two people) for (1) create, submit, assign, decide (ordinary and protected), activate, schedule and retire of a template, a pattern and a vocabulary; (2) a dependency invalidation returning a subject to draft, a linked pattern update accepted and detached, a term merged with convergence, a locale variant with a no_fallback block, related content pinned and excluded; (3) the same under keyboard only and a 200% layout asserting no diff value, canonical id or person id in URL, storage, logs or telemetry. Existing partial evidence not cited as proof of the clause: phase-02-slice-12-governed-review-real-route.spec.ts T6 (vocabulary only: API-defined and submitted, then assign/decide/activate/retire; no schedule, no template, no pattern), T3 (keyboard and 200% for the decision form only), phase-02-slice-12-locale-real-route.spec.ts (a locale draft, no no_fallback block), phase-02-slice-12-template-real-route.spec.ts (conflict and rebase).',
  },
  {
    criterion: 'P2-S12-AC-274',
    text: 'Typed refusals: within the Slice 12 catalogs a refusal carries exactly one lowercase `details.reasonCode` from the closed list (`capability_missing`, `separation_of_duties`, `subject_not_submittable`, `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable`, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit`, `dependency_changed`, `subject_not_activatable`, `subject_not_retirable`, `activation_conflict`, `schedule_exists`, `revision_not_editable`, `pattern_cycle`, `diff_has_collisions`, `taxonomy_not_active`, `locale_limit_reached`, `FALLBACK_CHAIN_MISMATCH`, `key_reserved`, `pattern_version_not_active`, `pattern_incompatible`, `nested_pattern_not_active`, `pattern_depth_exceeded`, `pattern_nodes_exceeded`, `diff_too_large`, `canonical_overlap`, `canonical_source_unavailable`, `term_unavailable`, `derived_rule_unknown`, `related_target_ineligible`, `block_rules_violated` (DEC-210) and the 03b time tokens, each keeping the single status the catalog lists it under: `pattern_version_not_active`, `pattern_incompatible` and `nested_pattern_not_active` are 422 and every governed 409 is `GOVERNED_REVIEW_VERSION_CONFLICT`) plus only the members named for it, a provider fault or provider-reported timeout is 503, an invalid provider response 502 and the route deadline 504 `DEPENDENCY_UNAVAILABLE` and never a success-shaped body, and an unmapped status or a message not generated by its operation catalog is a contract failure treated as 500 `INTERNAL_ERROR` without leaking the original payload.',
    clauses: [
      {
        text: 'Typed refusals: within the Slice 12 catalogs a refusal carries exactly one lowercase `details.reasonCode` from the closed list (`capability_missing`, `separation_of_duties`, `subject_not_submittable`, `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable`, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit`, `dependency_changed`, `subject_not_activatable`, `subject_not_retirable`, `activation_conflict`, `schedule_exists`, `revision_not_editable`, `pattern_cycle`, `diff_has_collisions`, `taxonomy_not_active`, `locale_limit_reached`, `FALLBACK_CHAIN_MISMATCH`, `key_reserved`, `pattern_version_not_active`, `pattern_incompatible`, `nested_pattern_not_active`, `pattern_depth_exceeded`, `pattern_nodes_exceeded`, `diff_too_large`, `canonical_overlap`, `canonical_source_unavailable`, `term_unavailable`, `derived_rule_unknown`, `related_target_ineligible`, `block_rules_violated` (DEC-210) and the 03b time tokens, each keeping the single status the catalog lists it under: `pattern_version_not_active`, `pattern_incompatible` and `nested_pattern_not_active` are 422 and every governed 409 is `GOVERNED_REVIEW_VERSION_CONFLICT`) plus only the members named for it, a provider fault or provider-reported timeout is 503, an invalid provider response 502 and the route deadline 504 `DEPENDENCY_UNAVAILABLE` and never a success-shaped body, and an unmapped status or a message not generated by its operation catalog is a contract failure treated as 500 `INTERNAL_ERROR` without leaking the original payload.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/refusals.test.ts',
            title:
              'BE03c Slice 12 typed refusals (closed reason-token sets) [P2-S12-AC-274] lists exactly the 403 tokens capability_missing and separation_of_duties',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/refusals.test.ts',
            title:
              'BE03c Slice 12 typed refusals (closed reason-token sets) [P2-S12-AC-274] lists exactly the BE03c 409 tokens, DEC-186 digest mismatch and FALLBACK_CHAIN_MISMATCH included',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/refusals.test.ts',
            title:
              'BE03c Slice 12 typed refusals (closed reason-token sets) [P2-S12-AC-274] lists exactly the BE03c 422 tokens and the 03b time tokens of a scheduled activation',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/refusals.test.ts',
            title:
              'BE03c Slice 12 typed refusals (closed reason-token sets) [P2-S12-AC-274] lists each token under exactly one status and keeps it on every operation',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/refusals.test.ts',
            title:
              'BE03c Slice 12 typed refusals (closed reason-token sets) [P2-S12-AC-274] makes every token lowercase snake_case except the one documented FALLBACK_CHAIN_MISMATCH exception',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/refusals.test.ts',
            title:
              'BE03c Slice 12 typed refusals (closed reason-token sets) [P2-S12-AC-274] refuses an unknown token, a missing token and any member the token does not name',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/refusals.test.ts',
            title:
              'BE03c Slice 12 typed refusals (closed reason-token sets) [P2-S12-AC-274] types block_rules_violated as one 422 token with bounded RFC 6901 violations (DEC-210)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/refusals-operations.test.ts',
            title:
              'BE03c Slice 12 typed refusals per operation [P2-S12-AC-274] names an allowlist for exactly the 24 Slice 12 operations of the error catalog',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/error-catalog.test.ts',
            title:
              'BE03c normative application error catalog [P2-S12-AC-274] resolves a status to the catalog code of an operation and refuses a status outside the catalog',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-reasons.test.ts',
            title:
              'CMS-03C-02 route typed Slice 12 refusals publishes pattern_version_not_active as 422 COMPOSITION_VALIDATION_FAILED with exactly its reasonCode',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-reasons.test.ts',
            title:
              'CMS-03C-02 route typed Slice 12 refusals drops a token on a status other than its own, and a token this operation does not publish',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-provider-fault.test.ts',
            title:
              'CMS-03C-06 provider 4xx without a product token (BE03c 1298-1302) scrubs PGRST202 function not found (RPC missing or unexposed) to 500 INTERNAL_ERROR',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-01 template define' a port that throws answers 503 DEPENDENCY_UNAVAILABLE without its prose",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/error-catalog.test.ts',
            title:
              'BE03c normative application error catalog [P2-S12-AC-008] maps every status to the exact catalog code and never uses a status as a code',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-07' provider boundary maps provider HTTP 504 to 503 with retry-after 15",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-07' provider boundary answers a success that fails the strict resource schema as a local 502",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-07' provider boundary scrubs unsupported 4xx to 500",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern-update-failure.test.ts',
            title:
              'CMS-03C-13 specifics the command and diff token VERSION_MISMATCH is not generated by the selector: scrubbed 500',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/refusals.test.ts',
            title:
              'BE03c Slice 12 typed refusals (closed reason-token sets) [P2-S12-AC-274] accepts a plain token with bounded RFC 6901 violations only',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-07' provider boundary ends a stalled RPC at the 15000 ms route deadline and never retries",
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-275',
    text: 'Registry parity: CI matches the discovered Hono routes and the generated OpenAPI to every Slice 12 browser operation ID (CMS-03C-01 to CMS-03C-17 and the five supporting reads) on method and path, request, success and error schemas, auth, CORS, rate, timeout, cache, idempotency, ETag and SLO, and CMS-03C-18 to CMS-03C-21 are absent from the browser route inventory and generated OpenAPI.',
    clauses: [
      {
        text: 'Registry parity: CI matches the discovered Hono routes and the generated OpenAPI to every Slice 12 browser operation ID (CMS-03C-01 to CMS-03C-17 and the five supporting reads) on method and path, request, success and error schemas, auth, CORS, rate, timeout, cache, idempotency, ETag and SLO, and CMS-03C-18 to CMS-03C-21 are absent from the browser route inventory and generated OpenAPI.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-02 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-02 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-02 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-02 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsLocaleVariantRead [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsLocaleVariantRead [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsLocaleVariantRead [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsLocaleVariantRead [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono inventory [P2-S12-AC-275] mounts no internal service operation, RPC, job or provider path (CMS-03C-18 to CMS-03C-21)',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono inventory [P2-S12-AC-275] resolves each operation sample path to that operation own route (fixed segments before parameters)',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono inventory [P2-S12-AC-275] mounts no /api/v1/cms route that the platform route registry does not list (no unregistered browser route)',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono inventory [P2-S12-AC-275] mounts every registered Slice 12 operation exactly once per method and path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-02 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-02 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-02 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-02 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-02 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-02 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsLocaleVariantRead [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsLocaleVariantRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsLocaleVariantRead [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsLocaleVariantRead [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsLocaleVariantRead [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsLocaleVariantRead [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI inventory [P2-S12-AC-275] documents none of CMS-03C-18 to CMS-03C-21, their RPCs, providers or contracts',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-02 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline cmsLocaleVariantRead [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-02 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota cmsLocaleVariantRead [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] the BE03c Route Registry is the browser inventory [P2-S12-AC-275] names CMS-03C-18 to CMS-03C-21 only as internal service operations',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-01 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-02 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-02 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-02 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-02 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-02 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-03 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-04 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-05 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-06 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-07 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-08 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-09 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-12 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-15 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-16 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTemplateContextRead [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsRelatedContentRead [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsLocaleVariantRead [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsLocaleVariantRead [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsLocaleVariantRead [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsLocaleVariantRead [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsLocaleVariantRead [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTemplateLatestRead [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsPatternLatestRead [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyVersionsRead [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyTermsRead [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-10 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-11 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-13 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-14 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsCompositionInstancesRead [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-17 [P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] the platform route registry holds no other Slice 12 browser operation [P2-S12-AC-275] registers CMS-03C-01 to CMS-03C-17 contiguously as numbered ids and never CMS-03C-18 to CMS-03C-21',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] the platform route registry holds no other Slice 12 browser operation [P2-S12-AC-275] carries no internal RPC, job or provider name in any registry operation id, path or schema name',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] the platform route registry holds no other Slice 12 browser operation [P2-S12-AC-275] keeps every method and path of the 25 operations unique in the registry',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-01 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-01 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-01 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-01 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-03 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-03 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-03 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-03 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-04 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-04 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-04 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-04 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-05 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-05 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-05 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-05 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-06 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-06 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-06 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-06 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-07 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-07 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-07 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-07 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-08 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-08 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-08 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-08 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-09 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-09 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-09 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-09 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-12 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-12 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-12 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-12 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-15 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-15 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-15 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-15 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-16 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-16 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-16 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-16 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTemplateContextRead [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTemplateContextRead [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTemplateContextRead [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTemplateContextRead [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsRelatedContentRead [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsRelatedContentRead [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsRelatedContentRead [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsRelatedContentRead [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTemplateLatestRead [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTemplateLatestRead [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTemplateLatestRead [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTemplateLatestRead [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsPatternLatestRead [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsPatternLatestRead [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsPatternLatestRead [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsPatternLatestRead [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTaxonomyVersionsRead [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTaxonomyVersionsRead [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTaxonomyVersionsRead [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTaxonomyVersionsRead [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTaxonomyTermsRead [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTaxonomyTermsRead [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTaxonomyTermsRead [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTaxonomyTermsRead [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-10 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-10 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-10 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-10 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-11 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-11 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-11 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-11 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-13 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-13 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-13 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-13 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-14 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-14 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-14 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-14 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsCompositionInstancesRead [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsCompositionInstancesRead [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsCompositionInstancesRead [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsCompositionInstancesRead [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-17 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-17 [P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-17 [P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-17 [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-01 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-01 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-01 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-01 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-01 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-01 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-03 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-03 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-03 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-03 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-03 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-03 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-04 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-04 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-04 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-04 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-04 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-04 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-05 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-05 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-05 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-05 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-05 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-05 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-06 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-06 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-06 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-06 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-06 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-06 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-07 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-07 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-07 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-07 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-07 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-07 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-08 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-08 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-08 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-08 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-08 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-08 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-09 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-09 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-09 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-09 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-09 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-09 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-12 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-12 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-12 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-12 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-12 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-12 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-15 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-15 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-15 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-15 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-15 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-15 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-16 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-16 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-16 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-16 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-16 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-16 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsRelatedContentRead [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsRelatedContentRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsRelatedContentRead [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsRelatedContentRead [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsRelatedContentRead [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsRelatedContentRead [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateLatestRead [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateLatestRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateLatestRead [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateLatestRead [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateLatestRead [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateLatestRead [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsPatternLatestRead [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsPatternLatestRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsPatternLatestRead [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsPatternLatestRead [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsPatternLatestRead [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsPatternLatestRead [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyVersionsRead [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyVersionsRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyVersionsRead [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyVersionsRead [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyVersionsRead [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyVersionsRead [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyTermsRead [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyTermsRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyTermsRead [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyTermsRead [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyTermsRead [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyTermsRead [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-10 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-10 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-10 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-10 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-10 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-10 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-11 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-11 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-11 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-11 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-11 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-11 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-13 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-13 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-13 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-13 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-13 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-13 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-14 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-14 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-14 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-14 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-14 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-14 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsCompositionInstancesRead [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsCompositionInstancesRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsCompositionInstancesRead [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsCompositionInstancesRead [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsCompositionInstancesRead [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsCompositionInstancesRead [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-17 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-17 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-17 [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-17 [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-17 [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-17 [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI inventory [P2-S12-AC-275] documents exactly the 25 browser operations, CMS-03C-01 to CMS-03C-17 and the eight supporting reads',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-01 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-03 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-04 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-05 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-06 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-07 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-08 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-09 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-12 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-15 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-16 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline cmsTemplateContextRead [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline cmsRelatedContentRead [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline cmsTemplateLatestRead [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline cmsPatternLatestRead [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline cmsTaxonomyVersionsRead [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline cmsTaxonomyTermsRead [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-10 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-11 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-13 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-14 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline cmsCompositionInstancesRead [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline CMS-03C-17 [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-01 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-03 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-04 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-05 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-06 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-07 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-08 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-09 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-12 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-15 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-16 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota cmsTemplateContextRead [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota cmsRelatedContentRead [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota cmsTemplateLatestRead [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota cmsPatternLatestRead [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota cmsTaxonomyVersionsRead [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota cmsTaxonomyTermsRead [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-10 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-11 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-13 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-14 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota cmsCompositionInstancesRead [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota CMS-03C-17 [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] the BE03c Route Registry is the browser inventory [P2-S12-AC-275] lists exactly CMS-03C-01 to CMS-03C-17 and the eight named supporting reads',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-01 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-01 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-01 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-01 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-03 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-03 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-03 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-03 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-04 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-04 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-04 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-04 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-05 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-05 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-05 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-05 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-06 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-06 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-06 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-06 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-07 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-07 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-07 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-07 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-08 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-08 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-08 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-08 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-09 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-09 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-09 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-09 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-12 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-12 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-12 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-12 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-15 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-15 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-15 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-15 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-16 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-16 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-16 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-16 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTemplateContextRead [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTemplateContextRead [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTemplateContextRead [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTemplateContextRead [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsRelatedContentRead [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsRelatedContentRead [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsRelatedContentRead [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsRelatedContentRead [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTemplateLatestRead [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTemplateLatestRead [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTemplateLatestRead [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTemplateLatestRead [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsPatternLatestRead [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsPatternLatestRead [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsPatternLatestRead [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsPatternLatestRead [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyVersionsRead [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyVersionsRead [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyVersionsRead [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyVersionsRead [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyTermsRead [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyTermsRead [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyTermsRead [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyTermsRead [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-10 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-10 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-10 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-10 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-11 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-11 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-11 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-11 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-13 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-13 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-13 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-13 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-14 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-14 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-14 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-14 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsCompositionInstancesRead [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsCompositionInstancesRead [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsCompositionInstancesRead [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsCompositionInstancesRead [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-17 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-17 [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-17 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-17 [P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-276',
    text: "Lock order: the Slice 12 writers (CMS-03C-01 to CMS-03C-09, CMS-03C-12, CMS-03C-15, CMS-03C-16 and CMS-03C-19, the linked-update scan, the revision-append carry-over, the recheck job and the term merge) take their locks in the Slice 12 lock order, the BE03b global write-path order extended by DEC-157 with one position for term rows, and never acquire an earlier position after a later one (the ten CMS-03B-06 decision steps order checks, not locks), re-prove their capability under the locks, and map `deadlock_detected` and a lock-acquisition failure to the 409 code of the operation's catalog (`*_VERSION_CONFLICT`) with nothing committed and the same `Idempotency-Key` reusable.",
    clauses: [
      {
        text: "Lock order: the Slice 12 writers (CMS-03C-01 to CMS-03C-09, CMS-03C-12, CMS-03C-15, CMS-03C-16 and CMS-03C-19, the linked-update scan, the revision-append carry-over, the recheck job and the term merge) take their locks in the Slice 12 lock order, the BE03b global write-path order extended by DEC-157 with one position for term rows, and never acquire an earlier position after a later one (the ten CMS-03B-06 decision steps order checks, not locks), re-prove their capability under the locks, and map `deadlock_detected` and a lock-acquisition failure to the 409 code of the operation's catalog (`*_VERSION_CONFLICT`) with nothing committed and the same `Idempotency-Key` reusable.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test is cited. Unproven: "Lock order: the Slice 12 writers (CMS-03C-01 to CMS-03C-09, CMS-03C-12, CMS-03C-15, CMS-03C-16 an...": missing tests (lock order is asserted per writer, not for the clause): pgTAP source/behaviour order tests for CMS-03C-01 (template), -02 (placement; the only sequential check is a table lock oracle), -03 (term action), -06/-07/-08/-09 (governed submit, decision, assign, activate: only the lineage advisory lock is asserted for activate/retire), -12 (pattern create), -16 (taxonomy create), the revision-append carry-over and the term-merge COMMAND; and deadlock_detected / lock_not_available -> 409 conversion tests with the same Idempotency-Key reusable for each. Present and NOT cited (they cover single writers): CMS-03C-04 `a deadlock inside the author command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]` and its lock-acquisition twin, CMS-03C-05 007-cas-and-locks static order, CMS-03C-15 080-lock-order, the linked scan `the scan acquires position 0 (entry), 3 (pattern version), 4 (content-type version) and 5 (live reviews) in that order`, the recheck run (070-isolation: deadlock/lock_not_available -> typed CONFLICT), the merge handler (085-continuation order) and the schedule/activation lineage lock.',
  },
  {
    criterion: 'P2-S12-AC-277',
    text: 'Concurrency scenarios: template activation versus block withdrawal, linked pattern update versus local override, term merge versus assignment, locale source edit versus translation, related target unpublish, duplicate and out-of-order events, worker lease expiry and restore-epoch fencing each have a deterministic tested outcome.',
    clauses: [
      {
        text: 'Concurrency scenarios: template activation versus block withdrawal, linked pattern update versus local override, term merge versus assignment, locale source edit versus translation, related target unpublish, duplicate and out-of-order events, worker lease expiry and restore-epoch fencing each have a deterministic tested outcome.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test is cited. Unproven: "Concurrency scenarios: template activation versus block withdrawal, linked pattern update versus ...": missing tests, one deterministic outcome each (race tool, independent sessions): (1) template activation versus block withdrawal; (2) linked pattern update (accept) versus a concurrent local override edit; (3) term merge versus a concurrent assignment; (4) locale source edit versus translation (concurrent form; only the sequential 409 `a translation of a superseded source revision is the 409 conflict: the source edit won [P2-S12-AC-277]` exists); (5) related target unpublish; (6) duplicate and out-of-order events (outbox redelivery of cms.template.activated/pattern.activated/localization events); (7) worker lease expiry (only the sequential ladder exists); (8) restore-epoch fencing. Existing neighbours are not cited because each proves a different race: dec193_writer.race (accept versus a concurrent target ACTIVATION), dec194 races (merge-convergence recovery sweep), dec199_publication.race (publish versus nested pattern activation), restore_relation_visibility/020-race.mjs (restore versus relation visibility), entry_default_template_lock/020-race.mjs.',
  },
  {
    criterion: 'P2-S12-AC-278',
    text: 'No leakage: no private locale text, draft composition, unauthorized target, capability or canonical-domain authority enters a public projection, an event payload, a log or a cache.',
    clauses: [
      {
        text: 'No leakage: no private locale text, draft composition, unauthorized target, capability or canonical-domain authority enters a public projection,',
        citations: [],
      },
      {
        text: 'an event payload,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title:
              'the localization event stays identifier-only: entryId, locale, revisionId [P2-S12-AC-278]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'outbox payload excludes translated field values and source text',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_source_stale.sql',
            title:
              'locale change events never disclose source or translated text',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation.sql',
            title:
              'exactly one cms.template.activated.v1 commits with one audit record: aggregate = the switched subject row at its lifecycle counter 4, payload = { templateId, templateVersionId } (DEC-180 G3, DEC-188) [P2-S12-AC-082]',
          },
        ],
      },
      {
        text: 'a log',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-observation.test.ts',
            title:
              '[P2-S12-AC-264] the structured request log writes only allowlisted members, even when every fact is hostile',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-governed.test.ts',
            title:
              'governed review request traces and log members writes only allowlisted members and no request, session or provider text',
          },
        ],
      },
      {
        text: 'a cache.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-read-routes.test.ts',
            title:
              'cmsLocaleVariantRead route (DEC-205) answers 200 with the strict read, no-store, the request id and the allowed origin',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/composition-instances-routes.test.ts',
            title:
              'cmsCompositionInstancesRead route serves the strict page, uncached, with no entity tag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-10 review detail (BE03c row 172) answers 200 with the strict detail, a strong review-version ETag and no-store',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-read-routes.test.ts',
            title:
              'cmsRelatedContentRead route (DEC-195) answers 200 with the stored rule, a strong ETag of its version, no-store and the request id',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route serves the page with a quoted page-version ETag, no-store and the CORS echo',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-governed-review-platform-reads.test.ts',
            title:
              'CMS-03C-10 governed review detail proxy relays a strict, bound, validator-carrying 200 as no-store',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx',
            title:
              'entries/[entryId]/composition.astro response invariants is never prerendered or cached, uses the one shared shell and bundles no script of its own',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/locale-route.test.tsx',
            title:
              'entries/[entryId]/locales/[locale].astro response invariants is never prerendered or cached, uses the one shared shell and bundles no script of its own',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'definition-reviews/[reviewId].astro response invariants is never prerendered or cached, uses the one shared shell and bundles no script of its own',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "No leakage: no private locale text, draft composition, unauthorized target, capability or canonic...": missing tests: (a) a public-projection assertion that a draft composition (cms_composition_instances rows of a draft revision) never appears in a published read or in cms_related_content_public_targets output; (b) that canonical-domain registry authority and capability data never appear in any public projection. Present but not cited because they prove other pieces: locale resolution carries no locale text (`a resolution never carries locale text: only identifiers, enums and booleans [P2-S12-AC-150]`), related targets never cross owners (`an entry now owned by another party disappears: a recommendation never crosses owners [P2-S12-AC-155]`), `an unpublished (tombstoned), other-locale and other-audience entry is never a candidate [P2-S12-AC-155]`.',
  },
  {
    criterion: 'P2-S12-AC-279',
    text: 'Representative-size performance: 64-slot templates, 512-node pattern bounds, 50-term pages, 128 locale fields and 64 related targets meet the Tier 2 p95 < 1,200 ms and RPC < 300 ms targets.',
    clauses: [
      {
        text: 'Representative-size performance: 64-slot templates, 512-node pattern bounds, 50-term pages, 128 locale fields and 64 related targets meet the Tier 2 p95 < 1,200 ms and RPC < 300 ms targets.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test is cited. Unproven: "Representative-size performance: 64-slot templates, 512-node pattern bounds, 50-term pages, 128 l...": missing tests: bench suites (like locale_perf/related_perf) for a 64-slot template define/read, a 512-node pattern create/place/update-diff, and a 50-term page read, plus end-to-end Tier 2 p95 < 1,200 ms measurements through Worker + PostgREST for each representative size (tests/performance or hosted). Present and not cited because they cover only two of the five sizes at RPC level: locale_perf `a 128-field CMS-03C-04 write meets the RPC < 300 ms target (median of five) [P2-S12-AC-279]`, `resolving all 128 locale fields of an entry in one statement meets the RPC < 300 ms target (p95 of 20) [P2-S12-AC-279]`, related_perf `curating 64 related targets meets the RPC < 300 ms target (p95 of 10) [P2-S12-AC-279]` and `projecting the 64-target rule set meets the RPC < 300 ms target (p95 of 20) [P2-S12-AC-279]`.',
  },
  {
    criterion: 'P2-S12-AC-280',
    text: 'CMS-15 Author locale variant: given Actor may edit the entry in the requested BCP 47 target locale, a source-locale revision exists for the fields being translated, only schema-localizable fields are in scope, and the ordered fallback chain is the one the active content-type version declares for the target locale (the request may carry it only as an equality expectation), implement locked behavior and completion exactly. Operation: CMS-03C-04 (author locale variant), BE03c ledger 25.05.03.',
    clauses: [
      {
        text: 'CMS-15 Author locale variant: given Actor may edit the entry in the requested BCP 47 target locale,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'member without entry assignment and author/editor capability is denied',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'assigned author receives a draft locale resource tied to the exact source',
          },
        ],
      },
      {
        text: 'a source-locale revision exists for the fields being translated,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'assigned author receives a draft locale resource tied to the exact source',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_revision_integrity.sql',
            title:
              'source locale must match the immutable source revision locale',
          },
        ],
      },
      {
        text: 'only schema-localizable fields are in scope,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'nonlocalizable source-schema field cannot be translated [P2-S09-AC-1166]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'nonlocalizable field cannot be misdeclared as no-fallback [P2-S09-AC-1166]',
          },
        ],
      },
      {
        text: 'and the ordered fallback chain is the one the active content-type version declares for the target locale (the request may carry it only as an equality expectation),',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'the exact active chain and a supported locale author a variant',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'a fallbackChain that differs from the active chain is a 409 version conflict',
          },
        ],
      },
      {
        text: 'implement locked behavior and completion exactly. Operation: CMS-03C-04 (author locale variant), BE03c ledger 25.05.03.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts',
            title:
              'CMS-03C-04 author a locale variant through the real stack [P2-S12-AC-054] [P2-S12-AC-056] a variant is a strict 201 draft with the aggregate ETag, an immutable target revision, one audit and one outbox event',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts',
            title:
              'CMS-03C-04 author a locale variant through the real stack [P2-S12-AC-056] a stale entry version, a stale source hash and a fallback chain that differs from the active one are 409 and write nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts',
            title:
              'CMS-03C-04 author a locale variant through the real stack [P2-S12-AC-055] [P2-S12-AC-056] a locale the active version does not support, an unlocalized field and an invalid value are 422 and write nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title:
              'the 201 resource has exactly the strict LocaleVariantResource members: no owner, party or person identifier is serialized [P2-S12-AC-055]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: saving (CMS-03C-04) sends the exact request with the CSRF token and a fresh idempotency key, then shows the saved draft state',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts',
            title:
              'CMS-03C-04 author a locale variant through the real stack [P2-S12-AC-056] an exact replay, also after a lost response, returns the stored 201 and adds nothing; a changed body under the same key is 409',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts',
            title:
              'CMS-03C-04 author a locale variant through the real stack [P2-S12-AC-057] a dependency that never answers is 503 DEPENDENCY_UNAVAILABLE and writes nothing',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-281',
    text: 'CMS-15 Author locale variant: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-15 Author locale variant: preserve declared failure and recovery across invalid authority,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'member without entry assignment and author/editor capability is denied',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'other-tenant entry existence remains concealed',
          },
        ],
      },
      {
        text: 'concurrency,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'stale entry version cannot create a second variant',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'false source hash is rejected before mutation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/004-relay-source-race-grants.sqlinc',
            title:
              'a deadlock inside the author command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]',
          },
        ],
      },
      {
        text: 'revocation,',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts',
            title:
              'CMS-03C-04 author a locale variant through the real stack [P2-S12-AC-055] no session is 401, no author capability is 403 before the database, a revoked database grant is 403 from the database, and none writes',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant_read/003-authority.sqlinc',
            title:
              'a revoked assignment removes the right to read [P2-S12-AC-270]',
          },
        ],
      },
      {
        text: 'deletion,',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts',
            title:
              'CMS-03C-04 author a locale variant through the real stack [P2-S12-AC-055] an absent source revision and an entry another owner holds are the same 404 LOCALE_SOURCE_NOT_FOUND',
          },
        ],
      },
      {
        text: 'and cascade.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_source_stale.sql',
            title:
              'a changed source appends one stale version for each dependent locale',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc',
            title:
              'revalidation appends a draft version (4) with no stale fields [P2-S12-AC-235]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-282',
    text: '`CMS-15` Author locale variant: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-15` Author locale variant: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: saving (CMS-03C-04) sends the exact request with the CSRF token and a fresh idempotency key, then shows the saved draft state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/locale-variant-submit.test.ts',
            title:
              'submitLocaleVariant (CMS-03C-04 browser transport) posts the exact request with the CSRF token, the idempotency key and the entry version as the strong If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/locale-variant-submit.test.ts',
            title:
              'submitLocaleVariant (CMS-03C-04 browser transport) accepts a 201 that answers THIS request and reports the next entry version and the draft state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/locale-variant-request.test.ts',
            title:
              'buildLocaleVariantRequest (CMS-03C-04, FE03 :891, :1834) builds a request the strict contract accepts, with only the filled fields, the equality chain and the schema no_fallback ids',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.refusals.test.tsx',
            title:
              'CmsLocaleVariantForm: typed refusals keep the input and say one fixed thing each maps 422 to its own heading and copy',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.refusals.test.tsx',
            title:
              'CmsLocaleVariantForm: 409 FALLBACK_CHAIN_MISMATCH (FE03 :1336) shows the fixed copy, replaces the order with the active one, keeps the values and submits the new order next',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.refusals.test.tsx',
            title:
              'CmsLocaleVariantForm: rate limit and unknown outcome keeps the idempotency key and replays the identical request while the outcome is unknown, and changes it with the request',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: saving (CMS-03C-04) names a field that breaks its own limit and sends nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.a11y.test.tsx',
            title:
              'CmsLocaleVariantForm: axe, no serious or critical finding (FE03 testing floor) is clean in the invalid, saved and refused states',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/locale-route.test.tsx',
            title:
              'CMS-03C-04 protected locale variant page, composed answers malformed ids, a malformed tag and any URL state with 400 and no read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: saving (CMS-03C-04) ignores a second activation while a save is in flight',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.refusals.test.tsx',
            title:
              'CmsLocaleVariantForm: 409 conflict and locale_limit_reached shows {"kind":"conflict","currentVersion":"9"} as fixed copy, refetches the source and blocks saving until it is used',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.load-failure.test.tsx',
            title:
              'the translation save chunk fails to load reports that nothing was sent, is not left pending, and the next press sends',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: what the page shows (FE03 :891, :1122, :1336) offers exactly the localizable fields, with the label and no "(required)", and each rule in words',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-283',
    text: 'CMS-16 Curate related content: given Actor may edit the source entry, every pinned or excluded target is an existing entry the acting context is authorized to reference, and derived candidates come only from explainable bounded deterministic rules over currently authorized projections, implement locked behavior and completion exactly. Operation: CMS-03C-05 (curate related content), BE03c ledger 25.05.04.',
    clauses: [
      {
        text: 'CMS-16 Curate related content: given Actor may edit the source entry, every pinned or excluded target is an existing entry the acting context is authorized to reference, and derived candidates come only from explainable bounded deterministic rules over currently authorized projections, implement locked behavior and completion exactly. Operation: CMS-03C-05 (curate related content), BE03c ledger 25.05.04.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'an assigned editor may curate the source (author or editor, BE03c 163) [P2-S12-AC-060]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'a granted editor with no assignment on the source is refused capability_missing [P2-S12-AC-060]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'an absent, self, archived, held, unassigned (hidden) and other-owner pin each give related_target_ineligible [P2-S12-AC-227]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'an absent, hidden or other-owner exclusion gives one identical refusal [P2-S12-AC-227]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'pin c2 first, then the four best-ranked eligible candidates (two shared terms: srcp, c6, c5 by head created_at desc; then c3 with one); the excluded c1 and the pinned c2 are not candidates [P2-S12-AC-231]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title: 'maxCandidates 129 is refused [P2-S12-AC-037]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx',
            title:
              'CmsRelatedContentForm: saving announces the saved rule set and eligible count in the focused result heading, and moves to the next version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'the resource version is the NEW entry aggregate version, the next If-Match operand [P2-S12-AC-061]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title: 'one audit record names the curation [P2-S12-AC-061]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'replaying the same key and body answers the stored response byte for byte [P2-S12-AC-061]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'the same key with another body is an idempotency mismatch [P2-S12-AC-061]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-success.test.ts',
            title:
              'CMS-03C-05 success and runtime resilience admits a contract-shaped resource to 201 with stable headers',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-typed-refusals.test.ts',
            title:
              'CMS-03C-05 typed refusals (BE03c 1304, 1380-1383) publishes related_target_ineligible with the offending row pointers as one uniform 422',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-284',
    text: 'CMS-16 Curate related content: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-16 Curate related content: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'a caller without edit authority is refused capability_missing even when a pin is ineligible [P2-S12-AC-060]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/007-cas-and-locks.sqlinc',
            title:
              'the previous operand is now stale: the loser of two writers from version 1 is refused [P2-S12-AC-061]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'a revoked entry assignment removes the right to edit the source [P2-S12-AC-060]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'an archived source cannot be curated (409 conflict) [P2-S12-AC-062]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'the stored pins are untouched by their targets leaving the public list (editorial history stays private) [P2-S12-AC-157]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'an unpublished entry (tombstone head) disappears [P2-S12-AC-157]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.conflict.test.tsx',
            title:
              'CmsRelatedContentForm: 409 review, reapply and discard keeps the ordered pins, the rule and the entered bound, and offers Review changes',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/007-cas-and-locks.sqlinc',
            title:
              'static: the transport converts a deadlock or a lock timeout to the retryable CONFLICT token (409 RELATED_CONTENT_VERSION_CONFLICT), rolling its sub-transaction back [P2-S12-AC-276]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'an absent, self, archived, held, unassigned (hidden) and other-owner pin each give related_target_ineligible [P2-S12-AC-227]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.refusals.test.tsx',
            title:
              'an ineligible target (422 related_target_ineligible) marks the offending pin row with the one fixed message and no other row',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-285',
    text: '`CMS-16` Curate related content: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-16` Curate related content: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx',
            title:
              'CmsRelatedContentForm: saving sends the ordered pins, exclusions and chosen rule with the entry version, csrf token and a fresh key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx',
            title:
              'CmsRelatedContentForm: saving announces the saved rule set and eligible count in the focused result heading, and moves to the next version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx',
            title:
              'CmsRelatedContentForm: idempotency replays the identical request with the same key after an unknown outcome',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.refusals.test.tsx',
            title:
              'an ineligible target (422 related_target_ineligible) marks the offending pin row with the one fixed message and no other row',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.conflict.test.tsx',
            title:
              'CmsRelatedContentForm: 409 review, reapply and discard reads the protected draft detail first and then the saved rule on Review changes, with no save and no mutation header',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/related-content-route.test.tsx',
            title:
              'CMS-03C-05 protected related-content page, composed serves the editing form once the composed read supplies the saved rule, with the picker and the version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx',
            title:
              'CmsRelatedContentForm: submission announces a saved result politely and every failure as an alert',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx',
            title:
              'CmsRelatedContentForm: saving refuses a rule without a bound before sending, linking to the field, and sends nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx',
            title:
              'CmsRelatedContentForm: saving disables the button while pending and ignores a second submit',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx',
            title:
              'CmsRelatedContentForm: submission handles the native submit itself: the browser default is prevented',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.conflict.test.tsx',
            title:
              'CmsRelatedContentForm: 409 review, reapply and discard keeps the ordered pins, the rule and the entered bound, and offers Review changes',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/related-content-route.test.tsx',
            title:
              'CMS-03C-05 protected related-content page, composed answers malformed ids and any URL state with 400 and no read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/related-content-route.test.tsx',
            title:
              'CMS-03C-05 protected related-content page, composed reads the entry, the stored rule and the list exactly once each, with the session and no URL state',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
];
