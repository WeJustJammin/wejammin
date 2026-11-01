# Slice 11 canonical gate runners — fail-open repair (Codex lane)

Date: 2026-10-13. Worktree: `/home/rob/.codex/worktrees/phase2-slice11/WeJammin` at HEAD `9b8a74192a8a21d81bbc60d262bb49350881e76b` (`claude/phase2-slice11`).

Owned files in this lane (nothing else edited, staged, committed or reset):

- `docs/handoffs/2026-10-10-claude-s11/lanes/gate-validate.sh` (modified, 49 lines).
- `docs/handoffs/2026-10-10-claude-s11/lanes/gate-db-verify.sh` (modified, 32 lines).
- `tests/slice-11-canonical-validation-runner.test.ts` (new, 299 lines).
- `.lane-logs/gate-runner-red2.log`, `.lane-logs/gate-runner-green3.log` (evidence; git-ignored).

## Defects (all fail-open)

### gate-validate.sh (pre-repair)

1. Pre-stamped the record before running: `sed -i -E ... "$REC"` rewrote the `- canonical validate:` line with the run's own date/time _before_ `pnpm validate`, so a failed run mutated the prior proven line.
2. Ignored a failed pre-reset: `PRE=$?` captured, never checked; the gate ran anyway.
3. Non-zero never propagated: `RC` was printed but never returned (`echo "LOG=$LOG RC=$RC"` at EOF), so a failing `pnpm validate` or post-reset was invisible to callers.
4. Hash fail-open: `sha256sum "$LOG" > "${LOG%.log}.sha256"` was unchecked, so a failed evidence-hash write still ended with a successful `echo` and exit 0.

### gate-db-verify.sh (pre-repair)

Same shape as (3) and (4): `RC`/postReset were captured and printed but never returned, and the final `sha256sum` was unchecked, so a failing `pnpm db:verify`, a failing post-reset, or a failed hash write still exited 0.

## TDD — RED first

Test: `tests/slice-11-canonical-validation-runner.test.ts` (10 cases: 6 for gate-validate, 4 for gate-db-verify). It copies each runner under test into a temporary fixture and patches ONLY the copy (hardcoded `W=` and the two `/tmp` lock paths become fixture-local), then spawns it. The fixture routes `db:reset`, `validate` and `db:verify` to shims whose exit codes come from env vars; a `sha256sum` shim can be forced to fail and a `gh` shim keeps the db:verify header offline. No database, container, network or real gate command runs.

RED command (against the round-1-fixed scripts, before the round-2 fix):

```bash
node_modules/.bin/vitest run tests/slice-11-canonical-validation-runner.test.ts --reporter=default
```

RED log `.lane-logs/gate-runner-red2.log`, SHA-256 `7415701ce9a51de2367daf5384acf7122efdf78727c33a9b70c577c7a569684d`: `Tests 6 failed | 4 passed (10)`, exit 1. Failures (right reason each):

- passing-run (validate): expected a `[validate] gate RC=0 ...` line the runner did not yet emit.
- post-reset (validate): `expected +0 to be 1` (post-reset failure not propagated).
- hash failure (validate): `expected +0 not to be +0` (failed hash write ignored).
- db:verify failure: `expected +0 to be 6` (not propagated).
- post-reset (db:verify): `expected +0 to be 1` (not propagated).
- hash failure (db:verify): `expected +0 not to be +0` (ignored).

## Fix (minimal, fail-closed)

Both runners now: stop before the gate when the pre-reset fails (validate); compute a single `GATE` RC with validate precedence (`RC` first, else `POST`); write a final `gate RC=<GATE> (<gate>=<RC> postReset=<POST>)` line; hash the log only after it is complete; propagate a failed hash write as exit 5; and `exit "$GATE"`. `gate-validate.sh` no longer touches the record (the pre-stamp `sed` is removed; the prior line is only read into the log for provenance). Both accept an optional checkout argument `W="${1:-<canonical>}"` (default unchanged).

Note: the first attempt appended the `gate RC=` line _after_ `sha256sum`, which made the recorded hash cover a stale log; the test's `sha256(log bytes)` assertion caught it (GREEN attempt 1: 8/10). The line is now written before the hash, so the hash covers the final log.

## GREEN

GREEN log `.lane-logs/gate-runner-green3.log`, SHA-256 `8702c1bc7ecd3d48d5c8f339beccfebac3378ffc224edc438461f3c1bc02331a`: `Test Files 1 passed (1)`, `Tests 10 passed (10)`, exit 0. `bash -n` on both scripts exits 0.

## Exact assertions (test -> proves)

| Test                          | Key assertions                                                                                                                                                            | Defect fixed                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| validate passing run          | `status===0`; `[validate] exit=0`; `[validate] gate RC=0 (validate=0 postReset=0)`; `reset.count==='2'`; sha256 file equals `sha256(log bytes)`; `record===SEEDED_RECORD` | record untouched; hash covers final log |
| validate failed pre-reset     | `status!==0`; `validate.ran===null`; `preReset=1`                                                                                                                         | pre-reset blocks validate               |
| validate failed gate          | `status===7`; `[validate] exit=7`                                                                                                                                         | validate failure propagated             |
| validate failed post-reset    | `status===1`; `[validate] exit=0`; `postReset exit=1`; `gate RC=1 (validate=0 postReset=1)`; stdout `RC=1`                                                                | post-reset propagated; RC named apart   |
| validate hash failure         | `status!==0`; `[validate] exit=0`; stdout `hash=FAILED`; hash file empty                                                                                                  | hash write failure fails the run        |
| validate log/exit consistency | `/\[validate\] exit=(-?\d+)/` equals `String(status)`                                                                                                                     | captured log matches exit               |
| dbverify passing run          | `status===0`; `dbverify.count==='1'`; `reset.count==='1'`; `[dbverify] exit=0`; sha256 file equals `sha256(log bytes)`                                                    | hash covers final log                   |
| dbverify failed gate          | `status===6`; `[dbverify] exit=6`                                                                                                                                         | db:verify failure propagated            |
| dbverify failed post-reset    | `status===1`; `postReset exit=1`; `gate RC=1 (dbverify=0 postReset=1)`                                                                                                    | post-reset propagated; RC named apart   |
| dbverify hash failure         | `status!==0`; `[dbverify] exit=0`; stdout `hash=FAILED`; hash file empty                                                                                                  | hash write failure fails the run        |

## Verification and limits

- `bash -n gate-validate.sh` and `bash -n gate-db-verify.sh` -> OK.
- Focused vitest: RED 6 failed -> GREEN 10 passed (~19s).
- Sizes: `gate-validate.sh` 49 lines, `gate-db-verify.sh` 32 lines, test 299 lines.
- Real record hash unchanged across the whole lane: `3990da00ae577bbf506062d85c3134d451f6811a294e715da83ba39632d0b1e4`.
- Heavy steps ran under `flock -s /tmp/wejammin-quiet.lock`. No commit, staging, reset, or DB command was issued.
- The unsafe pre-existing db:verify wrapper was NOT invoked; the db:verify path is exercised only through the shimmed fixture.
- Not done here (owner): the real `pnpm db:verify` then `pnpm validate` runs and the fresh successful record, applied with `apply_patch` only after the real gates pass.

## Format checkpoint (2026-10-13)

The canonical DB gate passed on this HEAD + runner changes (pgTAP 370 files / 14,044 assertions, PostgREST 74 / 875, 22 races, types, postReset=0, hash verified). The fresh full `pnpm validate` then failed FIRST at the Prettier warning on this lane's test file only (wrapper exit 1, postReset 0, hash verified; the prior attestation was untouched). The file, not any production or script behavior, was the only failure.

Repair (bounded): under the shared `flock -s /tmp/wejammin-quiet.lock` and the pinned toolchain `/home/rob/.local/share/wejammin-toolchain/bin` (pnpm 11.24.0, Prettier 3.9.6):

```bash
pnpm exec prettier --write tests/slice-11-canonical-validation-runner.test.ts
node_modules/.bin/vitest run tests/slice-11-canonical-validation-runner.test.ts --reporter=default
```

`--write` made the file Prettier-clean but grew it 299 -> 304 lines, over the 300-line limit. The header comment was then condensed by hand (Prettier leaves comments literal) back to 300 lines. Result: `prettier --check` exits 0, the targeted regression passes `Tests 10 passed (10)`, file SHA-256 `a0dd2c62c93eac66b630088d38c547902adc711607aa4d612fcee50ac5e1b7ef`, log `.lane-logs/gate-runner-formatted.log` SHA-256 `b9eb7a2c5fe5768baedc74b06187d009eae5c520469130a9d482fe3232815583`.

Diff scope unchanged: ` M gate-db-verify.sh`, ` M gate-validate.sh`, `?? tests/slice-11-canonical-validation-runner.test.ts`, `?? lane-codex-gate-runner-report.md`. Record hash unchanged: `3990da00ae577bbf506062d85c3134d451f6811a294e715da83ba39632d0b1e4`.

This is a targeted format fix and re-run, not a full validation. `pnpm validate` has not been re-run by this lane; the owner re-runs it.
