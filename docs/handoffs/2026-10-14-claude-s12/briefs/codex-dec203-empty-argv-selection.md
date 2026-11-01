# DEC203 zero-byte TEST argument observation

2026-10-21 local. Main orchestration/research/review/validation selects
`gpt-6.1-sol` / `ultra`; execution inherits the native model at `high`.

## Evidence and bounded decision

Restored source native PR01/02/03 passed separately. PR04 session 15839 closed 1:
the TEST's final exact owner-compiler argv assertion saw `[]`, not its fixed GCC
command. `processInfo()` splits a zero-byte cmdline read into `['']`, pops the
empty terminator, returns `[]`, then observer `save()` retains that first record.
The returned invocation had completed its independent closure checks; this is
not evidence of the earlier closed-target failure or of full-factory acceptance.

Linux v6.17 `fs/proc/base.c` get_mm_cmdline() explicitly returns zero before
mm->env_end is initialized; get_task_mm absence also returns zero. Primary source:
https://github.com/torvalds/linux/blob/v6.17/fs/proc/base.c
This establishes that zero bytes cannot prove a complete argv, not which kernel
transition caused this particular read. Do not claim the latter was observed.

Select only a zero-byte raw TEST cmdline as an incomplete observation, using the
already selected `DEC203_TEST_INCOMPLETE_SNAPSHOT` classification and original
live invocation/deadline. No empty compiler record may be saved or resolve the
pending compiler slot. A subsequent complete bracket must supply the actual
fixed argv; missed compiler evidence still fails. Do not accept `[]`, synthesize
arguments, overwrite a prior role instance, extend deadlines, add a wait/hold,
renew a native invocation, or weaken exact final command and identity checks.
Nonempty malformed input and non-race errors remain hard refusals. An incomplete
sample supplies no process/FD/closure/acceptance proof. Production code unchanged.

## Contract-first execution scope

1. Add mocked, strict planned-I/O controls to the existing
   `tests/contracts/phase-02-slice-11-dec203-test-observer-caller-order.test.ts`
   (<=400 natural lines): an empty first compiler read saves no compiler and
   increments the existing race count; the same original instance can later
   supply complete fixed argv; malformed nonempty cmdline and EACCES stay hard.
   Keep existing tests unchanged. No real proc/native/DB/process evidence.
2. Root runs actual RED against unchanged helpers, verifies causal failures.
3. Only then add pure `liveArguments(raw)` to existing TEST values helper,
   <=300 lines, and consume it in TEST `processInfo()`. Use a meaningful namespace
   import for the existing values module if needed to retain the processes cap;
   no new module or scope, no minification, preserve stat parsing/brackets/I/O.
4. Root runs scoped GREEN/static/configured typing/progress, old-parser replay,
   restores and freezes new source pins. Review exact TEST import DAG and caps.
5. PR01 alone first; PR02-04 separately only after closure/pin checks. Stop first
   failure. No blind retry window or old approvals renewed.

This is a necessary reviewed TEST observation-binding correction within DEC203,
not a public API/Zod/SQL contract change, new native primitive or capability.
The runtime-binding's raw exact argv, the existing private pending-exec joins,
closed target and metadata policy, all identity guards, budgets and actual native
construction remain mandatory. Full factory/RUN_ACK, native080, db:verify then
validate, canonical receipts, external gates and counters remain held.
