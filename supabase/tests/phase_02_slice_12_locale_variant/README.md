# Slice 12 locale variant authoring fragments (lane locale)

Fragments (`*.sqlinc`) of `../phase_02_slice_12_locale_variant.sql`, the CMS-03C-04 suite (BE03c route
field validation matrix, Locale field resolution (DEC-121, DEC-138) and fan-out (D12), LocaleVariant
table). They are includes, not discovered tests: the executable suite opens one transaction, includes them
with psql `\ir` after the Slice 10 RPC fixtures, and rolls back.

| Fragment                                | Content                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-helpers.sqlinc`                    | `pg_temp.l12_*` probes (statement outcome, json and text readers), the request builder built from live state, an independent RFC 4122 UUIDv5, the source-edit builder (a newer source revision the way a revision writer writes it: revision row, its values, then the draft head move that runs the fan-out) and the rolled-back author probe |
| `001-persistence-and-write.sqlinc`      | the `field_source_hashes` / `stale_field_ids` columns and their CHECKs, the two-state physical vocabulary, the write-time field hashes, the strict 201 resource, the author event identity                                                                                                                                                     |
| `003-contract-and-idempotency.sqlinc`   | replay, idempotency mismatch, absent entry / source, malformed key, the unique key; every refusal leaves no record                                                                                                                                                                                                                             |
| `002-limit-and-fanout.sqlinc`           | the 32-locale ceiling, the per-locale stale fan-out and event identity, live per-field staleness, revalidation, derived state                                                                                                                                                                                                                  |
| `004-relay-source-race-grants.sqlinc`   | the relay claim of the locale aggregate and its aggregate-type grammar, the superseded-source refusal, lock order and typed deadlock, grants                                                                                                                                                                                                   |
| `005-fanout-trigger-and-writers.sqlinc` | the structure that makes `stale_field_ids` exact: the draft-head-move trigger, the retired revision-insert trigger, the writer inventory guard                                                                                                                                                                                                 |

`003` runs before `002` on purpose: it asserts against the single committed variant of `001` (its default-locale probes roll back).

## Adding a case

Use `pg_temp.l12_req(locale, fields, key, overrides)` (it reads the newest source revision, its hash and the
current entry version), `pg_temp.l12_try` for a refusal and `pg_temp.l12_json` for a resource. Hand-written
rows must say so in a comment (see the ceiling fixture in `002`). Keep every file under 400 lines.

## Related paths

- `../phase_02_slice_12_locale_resolution/` (the CMS-03C-20 resolver world) and `../phase_02_slice_12_locale_gate/`
- `../../migrations/` (promoted `20261014050000`-`20261014050900`, the locale variant migrations)
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`
