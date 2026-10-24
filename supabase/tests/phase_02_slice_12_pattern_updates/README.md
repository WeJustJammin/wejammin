# Slice 12 pattern updates (CMS-03C-15) pgTAP support

Fragments of `supabase/tests/phase_02_slice_12_pattern_updates.sql` and the populated-table witness `populated-pending.sql`: `POST
.../compositions/pattern-updates` -> `platform_api.cms_apply_pattern_update` -> `platform_private.cms_apply_pattern_update` (BE03c 177, 400,
1268, 1336-1357, 1367, 1476; DEC-181/185; tracker P2-S12-AC-118 .. AC-123, AC-219, AC-258, AC-261).

| File                     | Contents                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `000-oracles.sqlinc`     | an RFC 8785 oracle, the independent row/hash oracle, `s12puc_check` (a successful update with every effect)                                                  |
| `005-schema.sqlinc`      | catalog and grants, definer ownership                                                                                                                        |
| `010-accept.sqlinc`      | accept: theirs-only, choices, retained overrides, removed roots, nested chains, targets, template slots                                                      |
| `020-detach.sqlinc`      | detach: materialized props, ineligible instances, the 128-key bound                                                                                          |
| `030-envelope.sqlinc`    | the store-free request grammar, table-driven                                                                                                                 |
| `040-refusals.sqlinc`    | concealment, authority, CAS, editability, targets, collisions and choices                                                                                    |
| `050-bulk.sqlinc`        | bulk, all-or-nothing, DEC-181 successive requests of at most 32                                                                                              |
| `060-effects.sqlinc`     | idempotent replay, live-review invalidation, audit, second author, the RPC-context flag does not leak after any call                                         |
| `070-adoption.sqlinc`    | the adopted block identity and registry digest (independent digest oracle), `nested_pattern_not_active` at `/targetPatternVersion`                           |
| `075-eligibility.sqlinc` | accept needs pending_diff or active; detach takes a linked draft head (labelled fixture)                                                                     |
| `080-lock-order.sqlinc`  | static check of the lock positions 0, 1, 3, 4, 5 in the stored function source                                                                               |
| `085-rpc-context.sqlinc` | PAT-031 restore leg: both `platform_api` wrappers (CMS-03C-14, CMS-03C-15) restore the caller's `app.cms_rpc` (cleared and a sentinel, plus the replay path) |
| `populated-pending.sql`  | replays the `pending_pattern_version` DDL against legacy rows (separate pgTAP file)                                                                          |

The shared world is in `../phase_02_slice_12_pattern_updates_common/`. A new case: build the request with `s12pu_update_request`, run it with
`s12pu_update` (success: `s12puc_check` with the expected row per path; refusal: `s12pu_refused` with the exact token and DETAIL).
