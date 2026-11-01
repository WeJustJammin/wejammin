# Slice 12 related public-target fragments (lane related)

Fragments (`*.sqlinc`) of `../phase_02_slice_12_related_public_targets.sql`, the CMS-03C-21 projection suite (BE03c
190, 1385). They are includes, not discovered tests; the executable suite opens one transaction, includes the
Slice 10/11 preludes and the shared world of `../phase_02_slice_12_related_content/` (`000-helpers`, `001-world`),
then these fragments, and rolls back.

| Fragment                        | Content                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `001-projection.sqlinc`         | pins first in position order, public eligibility by locale and audience, `shared-terms` and `same-type-recent` ranking, exclusions win, refill, the list-contract checker |
| `002-recompute-and-ties.sqlinc` | read-only proof, argument validation, recomputation after archive / foreign owner / unpublish / publish, tie-breaks on equal head instants                                |
| `003-bound.sqlinc`              | 124 extra published entries, the 128-target cut with pins first, the functional result at 64 related targets (timing lives in `../phase_02_slice_12_related_perf.sql`)    |

`002` mutates the world (archive, hold, owner change, tie instants) and `003` adds entries, so the order is fixed.

## Related paths

- `../phase_02_slice_12_related_content/` (world and helpers shared with the curation suite)
- `../../migrations/` (promoted `20261014060000`-`20261014060500`, the related-content migrations)
