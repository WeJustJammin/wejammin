# Slice 12 governed-b: CMS-03C-19 scheduled governed activation

Entry point: `../phase_02_slice_12_governed_schedule.sql` (plan 56 = 9 producer controls + 47 own). It reuses
`../phase_02_slice_12_governed_activation/000-world.sqlinc`. Seven schedules are accepted by the real CMS-03C-09 producer at least 62 s
ahead and the suite really waits (about 100 s, plus 64 s for the `055` schedule) for them to fall due: no clock is forged and no trigger is disabled.

| Fragment                   | Content                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `010-setup.sqlinc`         | grants, approved reviews, seven real pending schedules                                                                                                                                            |
| `020-claim.sqlinc`         | claim structure, nothing due, cancelled schedule, ordered batches, five-minute lease                                                                                                              |
| `030-execute.sqlinc`       | fence, completed execution with supersession, repeat (`already_completed`), late run, authority-ended block, re-activation                                                                        |
| `040-retry.sqlinc`         | the first retry step under the labelled negative policy-evidence fault, re-claim, completion                                                                                                      |
| `050-blocked.sqlinc`       | a changed frozen dependency at fire time blocks `dependency_changed`                                                                                                                              |
| `055-fire-approval.sqlinc` | a counted approver's grant revoked after acceptance blocks `approval_invalidated` at fire time; a new command then invalidates the review; a committed `schedule` holds the lineage advisory lock |
| `060-privileges.sqlinc`    | privilege boundary, role control, evidence rows                                                                                                                                                   |

The full 15 s / 60 s / 300 s ladder and the lease expiry are in `../phase_02_slice_12_governed_schedule_ladder.sql` (about 8 minutes).
