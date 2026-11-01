# Lane brief — `claude_s12_worker_hardening` (Worker 03c hardening)

Root rulings to implement, test-first (see `review-governed-worker-fix.md` and `review-governed-worker-p2.md`):
1. Token-less provider 4xx (incl. `PGRST202`@404, `PGRST301`@401, raw SQLSTATE@400) is a scrubbed 500 in
   every 03c adapter (BE03c 1298–1302). Apply the existing `apps/worker/src/cms-composition/provider-fault-guard.ts`
   (or move it into a composition-scoped wrapper used by all 03c adapters) for: template
   (`cms-composition-production*.ts` template paths, `template-*.ts`), template detail, pattern-instance
   (CMS-03C-02: `pattern-instance-*.ts`, `cms-composition-production-pattern.ts` — correct the
   `cms-composition-production-pattern.test.ts:133-156` 503 pin to 500, spec-cited) and taxonomy term action
   (`taxonomy-*.ts`, `cms-composition-production-taxonomy.ts`). Do NOT change 03b `mapCmsEditorialRpcFailure`
   semantics (03b oracles rely on its fallback). Locale and related adapters are excluded (other lanes).
2. Header validation (`Idempotency-Key`, `If-Match`) before capability and quota consumption (BE00 386/387,
   BE03c 408, 1502) in template, pattern-instance and taxonomy term write routes; assert the rate limiter is
   not called on a malformed header.
3. 502 `retryable`: read BE00 ~172 and ~592 and make the 03c 502 envelopes consistent with BE00; cite.
4. Governed minors from `review-governed-worker-p2.md`: merge the CMS-03C-11 OPTIONS preflight with 06's on
   the shared path (03b precedent `apps/worker/src/cms-editorial/routes.ts:71`) + test; correct the
   registry-pin over-claim (pin `capabilities`, `declared`, `pointers` or narrow the claim); change the
   `VERSION_MISMATCH` fixture to P0001 + JSON DETAIL; make the three vacuous replay tests discriminating or
   remove them with a reason.
Files: the Worker files named above and their tests, `governed-review-*.ts` files for item 4, shared
integration files only if wiring changes. Precedent and commands: `briefs/governed-worker.md`. Run focused
sets, the 345 joint set and the full Worker suite (report counts; the locale lane's recheck edits are now
complete, so the full suite should be clean); tsc/eslint/prettier on touched files. Report
`docs/handoffs/2026-10-14-claude-s12/lane-worker-hardening-report.md`.
