# Slice 12 linked-update scan (pgTAP)

Fragments of `supabase/tests/phase_02_slice_12_linked_scan.sql`: the database half of the platform-queue job
`cms.pattern.linked_update_scan` (BE03c "Linked update (diff, accept, detach)", "Job transport (DEC-166, DEC-180 G9)",
"Slice 12 lock order"; tracker P2-S12-AC-212, AC-213). Stage lane `linked-scan` on top of the standard stack.

| File                  | Contents                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `000-helpers.sqlinc`  | the context-cleared call runner (PAT-031), outcome and refusal oracles, head-row summaries, the new-row conformance oracle   |
| `010-world.sqlinc`    | the real world: lineage `ls-a` v1 placed on every scenario entry, a real template, labelled state rows, then v2              |
| `020-contract.sqlinc` | definer posture, grants, the static lock-order check and every request refusal                                               |
| `030-scan.sqlinc`     | the predicate matrix both ways, row shape, re-delivery idempotency, the late scan of a superseded version, the advance to v3 |
| `040-bounds.sqlinc`   | the 500 bound with a continuation cursor over 546 real placement rows and a cursor that splits an entry                      |
| `050-resolver.sqlinc` | `cms_linked_scan_resolve_event`: the producer's event resolver                                                               |
| `060-helper.sqlinc`   | the shared row writer `cms_pattern_update_next_row`: the `pending` action, and the unchanged output of `accept` and `detach` |

Every pattern is created by CMS-03C-12 and activated through the governed chain, and every composition row is written by the real
CMS-03C-02 producer. The labelled fixtures are: the standalone block row (`s12pl_row`), the three non-active head states of
`s12ls_staterow` (no cheap producer writes them), the open editorial review of `s12pl_review` and the archival of one entry,
exactly as the placement suite writes them. The scan RPC is only ever called through `s12ls_call`, which clears `app.cms_rpc` and
every actor setting first, so no fixture can hold the RPC flag open for it.

## How to extend

A new scenario: `select * from pg_temp.s12pu_place('<new tag>', 'la1', ...)` BEFORE the version is activated (a placement pins the
version that is active when it runs), then state the expected head summary in `030-scan.sqlinc`. Never reuse a tag across scenarios.
