# Native QA — preserve DEC-108 pre-review preparation, prohibit early switch

Root `/home/rob/.codex/worktrees/phase2-slice11/WeJammin` only. Native author
gpt-6-astra/high; orchestration/review gpt-6.1-sol/ultra. Parent checkpoint/push/
exact origin verification BEFORE each author continuation. Source-only PURE ctx
JS fs/path reads and native apply_patch writes; NO commands/exec/write_stdin,
shell/child_process/scripts/tests/DB/network/format/lint/TSC/git/packages/commits/
nested agents. Producers, old tests/support and tracking frozen. Report UNRUN.

Authority: DEC108 decisions1588 approves exact proposal225–230, which requires
actual nonzero dry-run/backfill/verify BEFORE independent review, then the atomic
switch. DEC162 preserves it; no later owner override. BE03a2272 and IA deep dive
286 ownership wording now cascaded to that approved source. The earlier seal-only
proposal was incorrect; no purpose implementation applied. Private trusted
`executionPurpose:'dry_run'|'activation'` selects preparation versus existing
activation behavior, never a browser/job/event flag. Default ONLY undefined is
activation; invalid config throws. Valid activation event under dry_run purpose
refused before ANY RPC; malformed wire behavior unchanged. Strict plan-version
and identity admission remain unchanged; no newer-ready version exception.

## Lane A — correct existing proposed tests

SOLE writes existing `migration-worker-dry-run-purpose.test.ts` <=400 and its
`migration-worker-dry-run-purpose-test-support.ts` <=300. No new test/support file.
Retain all29 cases; revise only four source-stale seal-only/ready/replay oracles:
nonzero seal continues into bounded backfill with canonical reclaim and no switch;
newer ready under original version remains stale/read-only for process/replay;
same-worker later replay of a strict-valid current running plan keeps original
version stale, truthful metadata and read-only request. Supply current running10
snapshot after first bounded backfill, not an impossible stale ready snapshot.
Use positive strict plan parse where introducing that snapshot. Keep all other
identity, partial/finalize/rollback/blocked, constructor9, wire3, valid wrong-
purpose event4, default/explicit activation2 controls byte-for-byte where possible.
Return exact ordered RPC bodies/signal and full outcomes. Preserve existing real
bounded scanner/ROW_ONE/ROW_TWO behavior. Inventory EACH changed old/new title;
do not weaken any approval/CAS/failure/security assertions. Legacy/new29 tests
are core controlled ports, not persisted dispatch/SQL authority acceptance.

## Lane B — new full preparation boundary tests

SOLE writes NEW `migration-worker-pre-review-purpose.test.ts` <=400 and optional
NEW `migration-worker-pre-review-purpose-test-support.ts` <=300. Lane A files
read-only. Through actual factory, real scanner/backfill/verification stages and
strict-valid typed controlled plans, add mutation-sensitive full completion:

- Nonzero matching ready plan processes an actual controlled row through claim,
  heartbeat, bounded source scan, backfill, beginVerification, verify and complete;
  process and replayDlq dry_run both return completed plan/completed worker job,
  activationSwitched:false. Complete ordered bodies/versions/cursor/fingerprints/
  fresh lease token/signal. No activate/reconcile/rollback/event operations after
  successful preparation. Preserve old activeVersionId, no manufactured switch.
- Same full path under omitted/default and explicit activation performs the
  existing private activation once and reports activationSwitched:true. These
  controlled compatibility cases prove no SQL approval authority.
- Matching genuinely empty sealed-ready plan (all counts/cursor0) under dry_run,
  process and replayDlq, returns completed worker job but truthful READY plan,
  activationSwitched:false, readPlan only; no claim/backfill/verify/private switch.
  Empty shape is a controlled unit case, not a fresh SQL census/fence proof.
- Invalid/negative verification and failed/invalid completion retain exact current
  failures and any permitted rollback cleanup; NEVER successful preparation or
  activation. Include retryable complete failure with exact delay and terminal
  malformed responses. At least four controls, with strict valid fixtures.

No test-only suppressed RPCs, fake authority, lazy counters as actual rows, casts/
any or invented policy. Read full relevant actual source and schema before exact
fixtures. Evidence ends at core: production named factory, persisted BE00 relay /
job-to-report-plan resolver/continuation/attempts/heartbeat, SQL races/fences and
public approval/switch remain separate open gates. Root parent runs RED before
any purpose implementation. Do not add grants, roles or public endpoints.
