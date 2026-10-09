# Slice 11 read-RPC pgTAP fragments (lane S11-3c)

`000-world.sqlinc` holds the builders the safe-read suites of `cms_get_editorial_review` (CMS-03B-16),
`cms_list_editorial_reviews` (CMS-03B-17), `cms_get_entry_workflow` (CMS-03B-15) and
`cms_load_quality_gate_input` share: an open review frozen from the REAL manifest of an `r11_entry` revision
(`r11r_review`), one `platform_api` read through the probe (`r11r_call`) and the counters a safe read must leave
alone (`r11r_effects`). It is an include, not a discovered test.

| Entrypoint                                    | Covers                                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `../phase_02_slice_11_rpc_reads_review.sql`   | CMS-03B-16: reader scopes, own reason only, owner-only assignments, live recount, next actions, 404 / 403       |
| `../phase_02_slice_11_rpc_reads_queue.sql`    | CMS-03B-17: assigned / submitted scopes, millisecond keyset order, signed cursor and its DEC-140 fault classes  |
| `../phase_02_slice_11_rpc_reads_workflow.sql` | CMS-03B-15: preparation and preflight, evidence degradation, derived states, schedule / publication bounds      |
| `../phase_02_slice_11_rpc_reads_gate.sql`     | the quality-gate load: node shapes and order, per-phase dependency hash, binding-hash vector, uniform NOT_FOUND |

## Adding a test

Include the prelude of `../phase_02_slice_11_rpc_preview/README.md` plus `phase_02_slice_11_rpc_review/020-decision.sqlinc`
(`r11_protected`, `r11_assign_now`, `r11_decide_now`), then `000-world.sqlinc` here. The queue suite also includes
`phase_02_slice_10_signed_read/000-cursor-helpers.sqlinc` (cursor forging).

## Conventions

- Insert every revision of an entry BEFORE its first review (a newer revision invalidates older live reviews).
- A read test brackets its reads with `r11r_effects()` and asserts the counters are equal: a safe read writes nothing.
- Keep each file below 400 lines.

## Related paths

- `../../migrations/20261005017880_cms_get_editorial_review.sql` .. `20261005017910_cms_load_quality_gate_input.sql`
