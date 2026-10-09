# Native QA — dry-run purpose admission controls

## WITHDRAWN before source edits

No new test file was written. DEC-108's owner-approved source225–230 requires
nonzero pre-review backfill/verification; the later-state refusal proposal below
would contradict it. No production implementation or acceptance claim. Preserve
strict version/identity admission and approval-gated switch; replacement QA must
exercise pre-review preparation without private activation. Canonical source
precedence resolves this without a new owner decision; do not re-ask DEC-108.

Root `/home/rob/.codex/worktrees/phase2-slice11/WeJammin` only. Retained native
author gpt-6-astra/high; orchestration/review gpt-6.1-sol/ultra. Parent checkpoints,
pushes and verifies origin before dispatch. Existing purpose suite frozen351,
support203: parent29 cases17 failed/12 passed, format/ESLint0. Identity fixture
now uses distinct valid target UUID; parser unchanged. No production changes yet.

SOLE write scope NEW
`apps/worker/src/content-schema-registry/migration-worker-purpose-admission.test.ts`
(<=400 formatted lines). All other files, including purpose test/support, frozen.
PURE ctx JavaScript fs/path reads and native apply_patch writes ONLY. NO commands,
exec/write_stdin/shell/child_process/scripts/tests/DB/network/format/lint/TSC/git,
packages/commits/nested agents. Report UNRUN and freeze; parent witnesses RED.

Independent6.1 identified two mutation-sensitive coverage gaps. Add11 cases using
the actual worker and strict-valid controlled canonical plans, reusing existing
purpose support read-only; assert positive plan schema parsing before execution.
Retain exact complete result and ordered read-only RPC bodies/signal.

1. Three version controls: newer valid dry_running under dry_run; newer ready
   under omitted/default activation and explicit activation. All retain stale /
   PLAN_VERSION_MISMATCH and actual plan state/cursor/progress, only readPlan. The
   proposed exception is ONLY trusted dry_run plus canonical ready, never a blanket
   version exception. Strict completed replay under activation remains unchanged.
2. Eight phase controls: matching-version running, failed_retryable, verifying,
   completed, each through process and replayDlq under trusted dry_run. Derived
   private semantics: failed_terminal / EXECUTION_PURPOSE_MISMATCH, truthful actual
   plan identity/state/cursor/progress, null retry delay, activationSwitched:false.
   Only canonical readPlan; no lease/scan/seal/backfill/verify/complete/private
   activation/reconcile/rollback, event operations or other mutation. Do not turn
   completed activation plans into successful dry-run jobs. State refusal follows
   strict parsing and identity/version admission, before terminal completed handling.
   Existing blocked and failed-terminal dry-run cleanup semantics remain unchanged.

Read full relevant plan schema, admission, engine/runtime and existing fixtures.
No casts/any, false identities, SQL reasons or invented persisted dispatch proof.
Use exact matching expectedVersion7 and valid nonzero source/target facts. New
cases control private core semantics only; current SQL reader separately rejects
newer ready before returning, and BE00 dispatch/resolution/continuation remain
unimplemented. No approval guard changes or acceptance/status promotion.
