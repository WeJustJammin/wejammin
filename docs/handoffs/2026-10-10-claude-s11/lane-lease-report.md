# Slice 11 implementation lane "lease" report (2026-10-10/11)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD `a2df2469` at the end
(`000e4739` at start). I committed, staged, stashed and reset nothing.

Item: private CMS lease-control for the production job-effect dispatcher. Frozen RED contract:
`apps/worker/src/production-job-effect-dispatcher-cms-lease-control.test.ts` (39 cases) and its companion
`packages/application/src/infrastructure/jobs/consumer-cms-lease-control.test.ts` (31 cases). Neither frozen file nor
`consumer-cms-lease-control-test-support.ts` was edited.

## Ownership note (read first)

The Worker file cannot pass from `apps/worker/src` alone. The checkpoint, heartbeat renewal and loss, drain-before-disposition and
outcome-CAS behaviour it drives all live in the application consumer (`executeJobDispatch`). The orchestrator later authorised
`packages/application/src/infrastructure/jobs/**`, which is where I edited. One further boundary crossing needs your decision: two
frozen composition support files had to be amended (see "Existing assertions changed").

## Files changed

Production:

| File | Change |
|---|---|
| `packages/application/src/infrastructure/jobs/cms-lease-control.ts` (NEW, 198 lines) | `openCmsLeaseSession`: validated actual receipt, serialized checkpoint queue, close/drain, strict-Boolean heartbeat wrapper, fresh clock, latched loss. |
| `packages/application/src/infrastructure/jobs/consumer.ts` (187) | Builds the session only for verified origin + canonical CMS type + `eventJobType` CMS; passes `(input, control)` to CMS and exactly `(input)` otherwise; settles (close, drain, fresh final clock) before manual-review / throw / CAS handling; final CAS uses the tracked server version. |
| `packages/application/src/infrastructure/jobs/runtime-types.ts` (251) | `CmsLeaseCheckpoint`, `CmsLeaseControl`; `JobEffectPort.execute(input, control?)`; `JobConsumerInput.leaseNow?` and optional `persistence.heartbeatJobLease`. |
| `apps/worker/src/production-job-effect-dispatcher.ts` (115) | Forwards the control to `prepareSchemaDryRun` only when present (absent control keeps exactly one argument, receiver unchanged); verification callbacks always get one argument. |
| `apps/worker/src/async-runtime.ts` (195) | Threads the existing trusted `now` callback as `leaseNow` for the verified CMS origin only. No Date.now substitute. |
| `packages/application/src/infrastructure/jobs/README.md`, `apps/worker/src/README.md` | Document the new module and the forwarding rule. |

New tests:

| File | Cases |
|---|---|
| `packages/application/src/infrastructure/jobs/consumer-cms-lease-settlement.test.ts` | 7 |
| `apps/worker/src/async-runtime-cms-lease-control.test.ts` (real receiving composition over the protected RPC client) | 7 |

## RED (before any production edit)

Log `docs/handoffs/2026-10-10-claude-s11/lane-lease-logs/red-targets.log` (+ `.json`), run at HEAD `a2df2469` under the shared quiet lock.

- Worker frozen file: 34 failed / 5 passed. Application frozen file: 26 failed / 5 passed. My new files: 6/6 and 5/6 failed. Total 71 failed / 11 passed.
- Right reasons: no control was ever passed (`Error: Expected CMS lease control` from `need(control)`), `Delivery ended before checkpoint gate`
  (consumer finished before the unawaited heartbeat drained), call-history mismatches (`apply`/`processed` happened with no restore/heartbeat/read), and
  `expected false to be true` on `f.assertEffect()` (effect got one argument, not `(input, control)`).
- Baseline neighbours (`baseline-neighbours.log`): 28 files / 312 tests all passed before the change.

## Fix

Per `lane-s11-native-cms-lease-control-{tdd,green}-2026-10-10.md` and BE00 `platform.job.execute` (heartbeat before one-third lease remains; CAS `Job.version`).

- Control exists only for `verifiedImmutableJobOrigin === true` + canonical type CMS + `eventJobType` CMS. Missing `leaseNow`, missing heartbeat port, or an invalid receipt
  (foreign id/token, `expectedVersion` != pre-claim canonical version, malformed or non-advancing post-claim version, non-finite or already-expired lease) returns
  `retry/lease_conflict` after the claim and before any effect, outcome or processed call.
- `checkpoint()` linearizes at invocation; accepted calls run one at a time; after close it returns `lost` with no I/O and does not poison the internal latch.
  Sequence per call: fresh clock (invalid/throwing/expired lost, no I/O) -> restore fence reread once -> existing `heartbeatJobLease` helper at the exact one-third boundary
  with the tracked version/expiry and fresh `nowMs` (raw Boolean required: false/throw/non-Boolean/reject are lost) -> after a renewal a fresh valid clock, then canonical reread.
  The reread must be the same id, CMS type, `running`, a decimal version strictly greater than the tracked one (equal when not due), a finite non-null expiry beyond another fresh clock
  (unchanged when not due). Every current result is a fresh outer+nested frozen snapshot. The original token is never replaced.
- Consumer: capture effect result or throw, close, drain, require a live fresh clock, then apply the existing policy. Lost or expired overrides success, manual review and throw.
  Healthy manual review / throw keep the existing policy. Final CAS uses the tracked version (never arithmetic). Queued has no processed marker; terminal waits for the processed write.
- Original job/envelope/claimedLease references and descriptors are untouched. Tokenblind metadata is not treated as stage authority.

Debug-by-test finding (not fixed, outside my files): `PositiveBigintDecimalSchema` in `packages/contracts/src/platform-events.ts:17-22` throws `SyntaxError: Cannot convert 1e3 to a BigInt`
from `safeParse` for a non-numeric string, because the zod 4 `.refine` runs after `.regex` fails. Frozen case "refuses unusable capability or initial receipt 8" (`version: '1e3'`) exposed it as
the only failure of my first GREEN run (`green-targets.log`). I guard with the same regex before calling the schema in `cms-lease-control.ts`. Other `safeParse` callers on untrusted strings
(`dispatch.ts`, `execution.ts` `isPositiveVersion`) have the same latent exposure; the fix belongs in the contract schema (abort on the regex failure).

## GREEN

- `green-targets.log` (first run): 81 passed / 1 failed (the `1e3` case above). After the guard: `b3-neighbours.log` 32 files / 396 tests passed. Worker frozen file 39/39, application frozen file 31/31, new files 7/7 and 7/7.
- Neighbouring suites (`packages/application/src/infrastructure/jobs`, `apps/worker/src/async-*`, `production-job-effect-dispatcher*`, `production-async*`): all pass.
- Broad run (`c-broad-summary.txt`): `apps/worker packages/application`, `tests/documentation-boundaries`, the infrastructure job integration/accessibility suites: 580 of 582 files, 9115 of 9117 tests pass. The two failures are not mine:
  `tests/documentation-boundaries.test.ts` (missing `lane-bench-logs/README.md`, another lane's directory) and `phase-02-slice-09-r8-factor-refetch.test.ts` [P2-S09-AC-906]
  (`STACK_TRACE_ERROR` under load; passes in isolation, `r8-rerun.log`, 4/4).
- Static: `tsc --build --pretty false tsconfig.json` exit 0, eslint `--max-warnings=0` on changed files exit 0, `prettier --check` exit 0 (`b3-*.log`).
- Coverage (`b3-coverage.log`, all jobs + Worker async/dispatcher tests, include limited to the changed production files): statements 224/224, branches 222/222, functions 28/28, lines 196/196 = 100%.
  The first coverage run showed `async-runtime.ts:115` (`if (controller.signal.aborted) return 'retry'` before the origin reader) uncovered. That is an existing gap in the receiving-24 contract, not my line. I closed it with the new test
  "retries before the origin reader when the receiver signal is already aborted".

## Existing assertions changed (old -> new)

Production wiring now gives a verified CMS delivery's effect a second argument, so two frozen composition support files that pinned exactly one argument were amended. Titles unchanged; no assertion loosened beyond the arity.

- `apps/worker/src/async-entrypoint-queued-continuation-test-support.ts`, `assertFinished`:
  old `same(effect.mock.calls, [[expectedEffect]])`;
  new: the first argument of each call must equal `[[expectedEffect]]`, each call has length 2, and the second argument has a `checkpoint` function. Seven queued-continuation tests failed on the old line before the amendment (`b1-neighbours.log`).
- `apps/worker/src/async-entrypoint-cms-origin-admission-test-support.ts`, `check`:
  old `same(effect.mock.calls, expected...map((x) => [x[1]]))`;
  new: the first argument of each call must equal that list, and every call has length 2 with a `checkpoint` function. Three origin-admission tests failed on the old line.

If you prefer the frozen files untouched, revert these two files; the 10 composition tests then fail on the arity assertion only.

## Titles added

`consumer-cms-lease-settlement.test.ts` ("private CMS lease settlement"): hands the effect a frozen control that exposes only checkpoint; calls the heartbeat port as a method of the supplied persistence;
a %s final clock overrides a healthy checkpoint (invalid, throwing); settles a synchronously throwing effect as manual review while the lease is healthy; lets lease loss win over a synchronously throwing effect;
treats an observed version that is not a decimal string as lost.
`async-runtime-cms-lease-control.test.ts` ("private CMS lease control through the real receiving composition"): renews through the protected heartbeat RPC and finalizes at the renewed version;
retries without an outcome when the protected heartbeat answers %j (false, "true", null); asks the trusted clock afresh instead of reusing the frozen request time; keeps ordinary verification on one argument with no heartbeat;
retries before the origin reader when the receiver signal is already aborted.

## Other failing apps/worker tests that reference CMS receiving / lease / continuation

Grep of `apps/worker/src` finds six files: the two frozen composition suites (`async-entrypoint-queued-continuation*`, `async-entrypoint-cms-origin-admission*`, passing baseline, passing after the amendment above),
the frozen lease file (fixed), and my new file. In the diagnostic unit run the only other failing Worker test was `upload-completion/upload-intent-completion.test.ts` "fences an in-flight canonical completion before a late commit can apply"
(no CMS, lease or continuation reference; not fixed by this change, not touched).

## Open

- No production CMS preparation callback wiring (the dispatcher still answers `DEPENDENCY_UNAVAILABLE` for CMS in production), no enduring SQL stage-fence, no CMS-specific resultRef naming or Worker-to-shared error mapping: none is reachable from this RED file.
- Contract schema `PositiveBigintDecimalSchema` throws on non-numeric strings (above): needs an owner for `packages/contracts`.
- Memory capture: PAT candidate "zod 4 refine runs after regex failure; guard the pattern first". I did not write raw memory records.
