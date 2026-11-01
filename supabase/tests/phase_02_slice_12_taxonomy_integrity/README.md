# phase_02_slice_12_taxonomy_integrity

Includes (never discovered as tests) for the two entrypoints `../phase_02_slice_12_taxonomy_integrity.sql` (gallery world) and
`../phase_02_slice_12_taxonomy_integrity_provider.sql` (Slice 11 helper world). They prove the DEC-141 receiving obligations of
BE03c "Receiving obligations from Slice 10" and the `cms.taxonomy.assignment_integrity` provider, over the real write commands.

| File                                                                            | Proves                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-world.sqlinc`                                                              | helpers: stable ids, vocabulary version and term builders (labelled fixture forgeries with the table triggers paused), assignment readers, merge convergence                                            |
| `005-gallery-vocab.sqlinc`                                                      | gallery vocabularies and the real create / append callers                                                                                                                                               |
| `010-resolver.sqlinc`                                                           | `cms_resolve_taxonomy_version` (P2-S12-AC-242)                                                                                                                                                          |
| `020-encoder.sqlinc`, `025-resolve.sqlinc`, `027-successor.sqlinc`              | the `taxonomy` value encoder, persistence of assignments, `term_unavailable` (AC-246, AC-221, AC-224)                                                                                                   |
| `028-active-ids.sqlinc`                                                         | current active version ids on resolve and restore, a revision spanning two vocabularies, the fail-closed branches of the restore term plan, the position-6 lock helper recheck (AC-244, AC-246, AC-276) |
| `030-compare.sqlinc`                                                            | comparison and lineage by identity (AC-242)                                                                                                                                                             |
| `040-provider.sqlinc`, `045-provider-context.sqlinc`, `046-provider-cap.sqlinc` | the preflight provider, registry row, evaluator dispatch (AC-239, AC-241), the 1000 cap                                                                                                                 |
| `050-restore.sqlinc`                                                            | restore translation of term assignments (AC-244)                                                                                                                                                        |
| `060-resolver-context.sqlinc`                                                   | context-cleared calls with a negative control (PAT-031)                                                                                                                                                 |

The static lock-position oracle is the entrypoint `../phase_02_slice_12_taxonomy_integrity_lock_order.sql` (no world).

Extension pattern: add a numbered `.sqlinc`, include it in the matching entrypoint after `000-world.sqlinc`, and write each assertion
with its criterion marker. Related: `../phase_02_slice_12_taxonomy_terms/`, `../phase_02_slice_12_locale_gate/`.
