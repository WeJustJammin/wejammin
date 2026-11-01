# Slice 12 governed-b: CMS-03C-19 retry ladder and lease expiry

Entry point: `../phase_02_slice_12_governed_schedule_ladder.sql` (plan 24 = 9 producer controls + 15 own). Real waits only (about 12
minutes): failure 1 -> 15 s, failure 2 -> 60 s, failure 3 -> 300 s, failure 4 -> `blocked` `retries_exhausted`. Four schedules:
`l1` is exhausted through `execute` and then scheduled again (`blocked -> scheduled`); `l3` is exhausted by the CLAIM that finds the lease
of its fourth attempt expired (schedule and subject blocked by the claim); `l2` is recovered by the claim (one retry spent) and completes;
`l4` keeps an expired but unrecovered lease and an executor presenting it still runs (the schedule row lock is the fence, as in
CMS-03B-20). Run it separately from the routine schedule suite. Related: `../phase_02_slice_12_governed_schedule/`,
`../phase_02_slice_12_governed_activation/000-world.sqlinc`.
