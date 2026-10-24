# Slice 12 DEC-191: governed read gap (`supersededVersion`, `activationSchedule`)

DEC-191 (orchestrator resolution, BE03c changelog row "FE03-BE03c read gap") adds two nullable read members, nothing else:

- CMS-03C-09 `GovernedActivationResource.supersededVersion`: the definition `version` of the lineage's previously `active` version that a
  committed immediate `activate` superseded; `null` for `schedule`, `retire` and a lineage's first activation.
- CMS-03C-10 `GovernedReviewDetailResource.activationSchedule`: the review's most recent `cms_governed_activation_schedules` row as
  `{ state, reasonCode }` or `null`; `reasonCode` is non-null exactly when `state` is `blocked` or `cancelled`.

Entry points (all reuse existing fixtures read-only by `\ir`):

| File                                        | Plan     | Content                                                                                                                      |
| ------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `../phase_02_slice_12_dec191.sql`           | see file | the governed-b world, then `000` .. `050` below; about 90 s of real waiting                                                  |
| `../phase_02_slice_12_dec191_pattern.sql`   | see file | the pattern-definition nested scenario, then `060`                                                                           |
| `../phase_02_slice_12_dec191_exhausted.sql` | see file | `retries_exhausted` through the real 15 s / 60 s / 300 s ladder (about 7.5 minutes; run separately)                          |
| `../phase_02_slice_12_dec191_lineage.sql`   | see file | `supersededVersion` is the previously ACTIVE version: a never-activated middle version, and a retired version (no real wait) |

| Fragment                | Content                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `000-helpers.sqlinc`    | pg_temp helpers: lineage successor past version two, claim bookkeeping, the 12-member key list                               |
| `010-setup.sqlinc`      | grants, approved reviews, the early fire-time schedules (real wait overlaps the rest)                                        |
| `020-activation.sqlinc` | template lineage v1 -> v2 -> v3: first activation null, superseded 1 then 2, replay, schedule null, retire null              |
| `030-taxonomy.sqlinc`   | the taxonomy kind: first activation null, successor names 1                                                                  |
| `040-detail.sqlinc`     | the detail read: none, pending, cancelled, executing, completed, failed_retryable, three blocked reasons, most recent of two |
| `050-structure.sqlinc`  | helper privileges and attributes, no new lock, producers keep owner/ACL                                                      |
| `060-pattern.sqlinc`    | the pattern kind (own entry point)                                                                                           |
| `070-exhausted.sqlinc`  | `retries_exhausted` through the real ladder (own entry point)                                                                |
| `080-lineage.sqlinc`    | lineage `sa` (v1 active, v2 never activated, v3 activated -> 1) and `sb` (v1 retired, v2 -> null, v3 -> 2)                   |

How to extend: a new governed read member gets a fragment here, a key-list update in the pinned-key oracles it changes, and an `EVIDENCE` line
for the contract-parse check.
Related: `../phase_02_slice_12_governed_activation/`, `../phase_02_slice_12_governed_schedule/`, `../phase_02_slice_12_governed_reads/`.
