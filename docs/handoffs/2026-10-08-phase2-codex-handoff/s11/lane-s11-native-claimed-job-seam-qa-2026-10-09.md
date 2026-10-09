# Native QA — claim binding and trusted receipt conveyance

Named preparation factory/exact dispatcher GREEN336; named-purpose mutant10
failures killed and exact restored. Receiver witness additive, unbound-callback
mutant3failed/52passed55, exact producer restoration then77/77 and static gates0.
This wave tests the next internal seam, NOT server resolution or job authority.

Source anchors: `.memory/wiki/specs/be/00-infrastructure.md`487/495/502 fixes immutable event identity,
claimed-version CAS and replay preservation. JobLeaseClaimResult in application
jobs/runtime-types63–69 already carries jobId/token/requestedVersion/claimed
version/expiry. Consumer81–85 drops all except token, while outcome91 uses actual
claimed version. Worker async-runtime-parsing94–122 validates response shape but
not request binding. Real SQL claim_job returns job_id/version/state/lease_until/
attempt_count, deliberately not token or requested version; omitted fields must
retain submitted-value fallback. Claim SQL version increments at acquisition;
controlled unit receipts are not evidence of the actual SQL claim algorithm.

Checkpoint/push/exact-origin verification before both disjoint native authors.
Root only `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`; actualgpt6astra/high.
PURE ctx JS fs/path source reads plus native apply_patch writes ONLY. NO commands/
exec/write_stdin/shell/child_process/scripts/tests/DB/network/format/lint/TSC/Git/
commits/packages/nestedagents. All existing production/contracts/tests/support/
SQL/README/tracking frozen. Each new test<=400 formatted, support<=300.

## Lane A — existing receipt through consumer boundary

SOLE new file
`packages/application/src/infrastructure/jobs/consumer-claimed-lease.test.ts`.
Use actual executeJobDispatch and existing typed persistence/effect ports, strict
QueueEnvelopeSchema fixtures. Proposed PRIVATE optional `JobEffectInput.claimedLease`
member carries existing JobLeaseClaimResult, not a new queue/API field. Initial
tests must type-check against current source: examine the captured effect input
as object/unknown with property assertions, no absent import or unsafe casts.

For exact CMS and both object aliases, prove effect sees the actual full receipt
under claimedLease (same object identity), original preclaim job remains queued
with original version/identity, envelope retains original aggregateVersion and
strict key shape, token retained. Use lossless >2^53 decimal versions. Include
one controlled valid-shape receipt whose version differs from a computed +1 to
kill client arithmetic; explicitly label it synthetic unit-port behavior, not
real SQL adjacency. Do not replace claimed version with requested/envelope value.
Observe final outcome CAS exact quoted claimed version/token and processed event
after terminal application; no effect/result/outcome fixture simulates new SQL.

Add real no-effect controls for null claim and existing restore/dispatch refusal,
preserving state machine. Malformed/foreign HTTP claim binding belongs to lane B,
not a new mock-port trust contract. No fake success path, preclaim job rewriting,
lease timing policy, global stale exception, retry/heartbeat/attempt change or
assumption that metadata proves a live job throughout preparation.

## Lane B — actual claim response/request binding

SOLE new file `apps/worker/src/async-runtime-claim-binding.test.ts`.
Read full parseLease/createJobPersistence and current tests/SQL response. Exercise
real parseLease and protected persistence adapter with fake RPC only; no network.
Positive actual SQL snake row with absent token/expected fields uses request
fallback; explicit equal camel and snake fields normalize safely, big decimal
version preserved. Request objects remain unchanged. Shape-only tests remain
controls, not fresh authority evidence.

Independent valid-shape response mismatches: jobId/job_id versus requestedjobId,
leaseToken/lease_token versus submittedtoken, expectedVersion/expected_version
versus requestedversion. Reject before returning a receipt; include explicit
dual-alias conflict witnesses so a valid first alias cannot hide a mismatched
second alias. Missing token/requestedversion remains permitted fallback; explicit
invalid/null aliases are invalid, not omission. Preserve existing supported row
or singleton-array response shape. Use malformed value controls without unsafe
casts or printer payloads. Do NOT impose a new calculated next-version adjacency,
current-time expiry check, state field requirement or whole SQL row closed shape.

At least one actual adapter→executeJobDispatch mismatch case must prove effect,
outcome and processed-event ports never called. Existing consumer may reject the
claim promise; assert current rejection plus no effects, not an invented manual
review policy. All incoming mismatches valid UUID/decimal shapes where equality
is the intended RED. No widening of job types or SQL/grant changes.

Freeze/report UNRUN. Root formats/checks and runs both QA plus current legacy
consumer/parsing regressions; accepted genuine RED and independent6.1 oracle
review BEFORE producer edits. Then separate minimal consumer/type and parser
GREEN claims checkpointed before authors. Claimed resolver closed request/
response and persisted CMS resultRef.type remain separate design work. Jobs
SELECTONLY/no row locks/new grants; resolver snapshot not enduring job fence.
GenuineAPI7RED/0of122/full/owner/external holds unchanged, no S09 restart.
