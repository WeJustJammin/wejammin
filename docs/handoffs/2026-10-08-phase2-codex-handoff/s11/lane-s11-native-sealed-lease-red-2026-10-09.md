# Native QA-RED — sealed dry-run lease handoff

Root `/home/rob/.codex/worktrees/phase2-slice11/WeJammin` only. Native author
gpt-6-astra/high; parent/review6.1/ultra. Parent checkpoints/pushes before dispatch.
Create ONLY `apps/worker/src/content-schema-registry/migration-worker-sealed-lease-handoff.test.ts`
(<=400 lines, prefer250). No production/old-test/support/README/progress/SQL/
package/config/lock/environment edits. Ask exact extra scope before touching it.
PURE ctx JavaScript fs/path reads/native apply_patch writes ONLY. NO commands,
exec/write_stdin/shell/child_process/scripts/tests/DB/network/format/lint/TSC/git/
packages/commits/nested agents. Source UNRUN; parent alone witnesses RED.

Read live seal source021830:429–469, runDryRunStage, runBackfillStage, actual
factory/stage types and existing test support before design. SQL finalization
returns canonical ready plan with null leaseOwner/token; actual runDryRunStage
currently returns old token and backfill skips reclaim if token non-null.
Parent lifecycle has later lease-expired logs, but deterministic unit must
establish this precise causal transition independently, not reuse ambiguous logs.

Required proof using actual exported stages or actual Worker factory with clearly
controlled ports (no authority/SQL proof from stubs):

- Successful real dry-run stage consumes bounded evidence and finalizes; returned
  sealed ready plan with null lease must not carry stale input token onward.
- Actual continuation must reacquire before any backfill using canonical sealed
  version/cursor/fingerprints, not original job operands. Exact calls/order/body.
  Use letter-leading tokens here so independent UUID bug cannot mask handoff.
- Reclaim unavailable/failure blocks backfill/verification/activation and keeps
  exact existing retry/failure semantics. Prefer bounded successful-backfill
  witness that yields before unrelated verification/public activation stages.
- Preserve non-finalized dry-run held lease; completed read-only replay must
  never claim. Do not invent fake approval or an impossible claim-completed plan.

No existing test weakening or production fix here. Any later stage contradiction
is a separate scope. Return exact file/cases/limitations; freeze for parent RED.
