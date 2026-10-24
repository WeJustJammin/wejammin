# Slice 12 related-content fragments (lane related)

Fragments (`*.sqlinc`) of `../phase_02_slice_12_related_content.sql`, the CMS-03C-05 curation suite, and the shared
world of `../phase_02_slice_12_related_public_targets.sql`, the CMS-03C-21 projection suite (BE03c 163, 190, 385-387,
1379-1385, 1432). They are includes, not discovered tests: each executable suite opens one transaction, includes
the Slice 10 and Slice 11 preludes and then these fragments with psql `\ir`, and rolls back.

| Fragment                       | Content                                                                                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-helpers.sqlinc`           | `pg_temp.r12_*` probes (outcome, json with DETAIL, text), the request builder built from live entry state, the tag registry that lets a result read as `c1,c2`, rule-set readers |
| `001-world.sqlinc`             | taxonomy and terms, 15 published entries through the real lineage producer, unpublished sources, lifecycle and foreign-owner fixtures (hand-written, labelled)                   |
| `002-shape-and-grants.sqlinc`  | the rule registry predicate, the `max_candidates` column and its CHECKs, function shape, volatility and grants                                                                   |
| `003-write.sqlinc`             | first write, strict resource, append-only rows, audit-only evidence, `eligibleCount`, replay and mismatch                                                                        |
| `004-replace.sqlinc`           | whole-set replacement as revoked and active versions, re-add, append-only guard                                                                                                  |
| `005-validation.sqlinc`        | bounds, duplicates, overlap, rule shape, registry membership, envelope and version                                                                                               |
| `006-eligibility-authz.sqlinc` | the uniform `related_target_ineligible`, accepted exclusions, source concealment and capability                                                                                  |
| `007-cas-and-locks.sqlinc`     | stale operands, the lock order and typed deadlock (static source assertions)                                                                                                     |

## Adding a case

Build a request with `pg_temp.r12_req(source_tag, pins, exclusions, rule, idempotency_key, overrides)` (it reads the
live entry version) and call `pg_temp.r12_curate`; a refusal answers `{__error, __detail, __state}`. Each test group
owns one `src*` entry so versions never couple groups. Hand-written rows must say so in a comment.

## Related paths

- `../phase_02_slice_12_related_public_targets/` (the CMS-03C-21 projection fragments)
- `../phase_02_slice_11_helpers/` (the review and lineage builders this world calls)
- `../../migrations/` (promoted `20261014060000`-`20261014060500`, the related-content migrations)
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`
