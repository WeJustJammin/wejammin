# Lane brief — `claude_s12_hardening_3` (CMS-03C-02 Worker + Web token fidelity)

Read `docs/handoffs/2026-10-14-claude-s12/review-hardening-2.md` fully. Implement test-first:
1. Web relay `apps/web/src/server/cms-composition-platform-pattern.ts:~95-105` strips typed tokens; FE03 :1112
   requires the insert form to distinguish `revision_not_editable` / `pattern_version_not_active` /
   `pattern_incompatible` (and the other CMS-03C-02 tokens). Relay the Worker's typed error with its
   `details.reasonCode` per the contract (`packages/contracts/src/cms-composition/refusals.ts`,
   `error-catalog.ts`), allowlisted exactly; update the browser mapper/copy if the form consumes it (FE03 :1112).
2. Worker `apps/worker/src/cms-composition/pattern-instance-routes.ts:~144` route-local 403 must emit the 03c
   token `capability_missing` (the contract test says `CAPABILITY_REQUIRED` is not an 03c token).
3. ROOT RULING (revises an earlier one): BE03c :378 lists placement graph validation (no cycles, max
   protected depth/nodes) as 409/422. If the producer raises `pattern_cycle`, `pattern_depth_exceeded` or
   `pattern_nodes_exceeded`, the Worker maps them to the typed 422 validation error (catalog code with a
   pointer) — NOT a scrubbed 500 — without inventing a `reasonCode` outside the closed CMS-03C-02 list
   (BE03c 1304). Update the test that asserted 500.
4. Minors: READMEs list the two new hardening-2 files; locale/related new tests pin the relayed status.
Files: `apps/web/src/server/cms-composition-platform-pattern.ts` (+tests, browser mapper/copy if needed),
`apps/worker/src/cms-composition/pattern-instance-*.ts`, `apps/worker/src/cms-composition-production-pattern*.ts`
(+tests), the two READMEs, the locale/related test files hardening-2 added. Run focused, full Worker, full
Web, tsc/astro check/eslint/prettier. Report `docs/handoffs/2026-10-14-claude-s12/lane-hardening-3-report.md`.
