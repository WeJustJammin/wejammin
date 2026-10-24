# Lane brief — `claude_s12_governed_b_sql` fix pass (staged-runner lane `governed-b`)

Read `docs/handoffs/2026-10-14-claude-s12/review-governed-b.md` fully. Root rulings (binding):
1. Major 1 — FIX: `20261014070400` must take the lineage advisory lock BE03c 1326/1348 mandate for
   CMS-03C-09, mirroring `070600:180-185`, so concurrent activators deterministically get
   `activation_conflict`. Add a test that proves the lock is taken (e.g. a second session cannot be
   simulated in pgTAP — assert via `pg_locks` inside the producer's transaction from a test wrapper, or
   assert the deterministic refusal path with a pre-held advisory lock), RED first.
2. Major 2 — RATIFIED as an implementation decision: the claim may take the subject row
   `FOR UPDATE SKIP LOCKED` to move `scheduled -> blocked` when lease expiry exhausts the retries
   (deadlock-free; closes a stranding gap). Record it in your report under `## Decisions` with the
   BE03c lock-order row it deviates from; root records the DEC and the spec clarification. You MUST add the
   missing ladder step that exercises this claim-side exhaustion path (and the review's untested
   `blocked -> scheduled` and fire-time `approval_invalidated` paths if reachable sequentially).
3. Minors at your discretion with reasons; at minimum honor an expired-but-unrecovered lease the way 03b
   does under the row lock, or justify the difference with spec citations.
4. Document in `## RPC boundary` that execute's `expectedVersion` is the immutable review version (not
   03b's `scheduleVersion`) — the Worker sweep lane will read this.
Edit your WIP migrations in place (unpromoted). Lane list for runs: `governed-b` (pattern-def, governed-fix
and governed-fix2 are now promoted). Rerun all three governed-b suites and
`phase_02_slice_12_pattern_definition.sql`. Append `## Fix pass` to your report.
