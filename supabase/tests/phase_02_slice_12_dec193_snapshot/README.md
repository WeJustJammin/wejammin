# DEC-193 snapshot storage tests

TEST-ONLY author lane; runtime, parser, DB and container execution UNRUN.

Entry point: `../phase_02_slice_12_dec193_snapshot.sql`. Reuses the existing
Slice 09 actor/block and Slice 12 governed-pattern/placement fixtures. One real
CMS-03C-02 detached placement supplies the root's owner, draft revision, signed
block identity, stable pattern pin, namespace chain, position and old override
map. Direct storage candidates are explicitly guarded fixtures, not claims that
an update, detach, render or carry-over producer exists.

`000-fixture.sqlinc` writes candidates with `jsonb_populate_record` and observes
`to_jsonb(stored row)`. A missing `detached_tree` column is ignored on input and
therefore fails exact persisted-row assertions; malformed trees fail their
expected CHECK/no-effects assertions. No future SQL identifier/helper can abort
setup. Exceptions capture SQLSTATE; invalid INSERTs roll back in a subtransaction.
Every refusal compares complete rows across the existing placement snapshot's
stores, not counts alone. Successful probes require exactly one append and
unchanged previous rows/other stores. No trigger or constraint is disabled.

`010-storage.sqlinc` covers nullable jsonb storage and immutable-validator CHECK
metadata; 1 and 512 nodes; a complete aggregate over 256 KiB; namespace-preserving
root/child key chains; preorder stack closure, sole-root and parent type/order;
unique addresses and matching ancestry; strict outer/node fields; canonical key,
block key and version bounds; scalar/null/array/object values; exact existing
per-value 256-KiB, 8-container, 128-member/item limits; root identity, detached mode
and empty row props; the actual direct-write guard; and unchanged legacy NULL.

The large fanout is synthetic expanded storage, not a 512-node authored pattern.
Its root is registered; child identity upper-bound probes exercise pure storage
grammar, not registry admission. These tests intentionally impose no authored
32-child limit or whole-snapshot 128-member, 256-KiB or topological-depth-8 cap.
They do not prove a validator is shared by producers, producer registry safety,
resolution choices, render/preflight behavior, carry-over or concurrency.
`carried_from_id` is confirmed by BE03c 1545/1563 but is not required here; its
storage and copying belong to the receiving lane.

Normative source: `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`
1487 (effective content/provenance), 1536 (NULL distinction), 1545 (later carry),
1563 (complete storage grammar). Existing per-value implementation:
`20261014020000_cms_pattern_forest_validators.sql:74-79`,
`20261014110200_cms_pattern_placement_request.sql:91-99`,
`20261003130100_cms_json_bounded_typed_expansion.sql:17-71`.

Root-only suggested RED command, using promoted migrations without WIP:

```sh
bash docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh \
  /home/rob/.codex/worktrees/phase2-slice12/WeJammin none \
  supabase/tests/phase_02_slice_12_dec193_snapshot.sql
```

Root owns lock-serialized execution, actual RED receipt, independent review and
any subsequent exact GREEN claim. No migration promotion or acceptance asserted.
