# Lane brief — `claude_s12_worker_taxonomy_terms` fix pass

Read `docs/handoffs/2026-10-14-claude-s12/review-worker-taxonomy-terms.md` fully. Fix test-first:
1. M1: in-job retry pauses follow a BE00 schedule (15/60 s within the 240 s budget, cite BE00); assert the pause
   lengths in tests.
2. M2: a permanently failed merge-converge job must not strand the tail forever. Cite BE00 554/571/233 and
   BE03c 1334/1351–1354; implement the spec-grounded recovery (e.g. a scheduled reconciliation that requests a
   fresh convergence job for a merged term with unconverged assignments and no live job — only if the spec
   supports it; if it needs SQL, write the exact SQL requirement into `## Requests to root` instead of SQL),
   register the seven new error codes where BE00 requires, and add the job to the runbook/alert inventory the
   repo uses (find it). Record any remaining gap as a precise BOUNDARY.
3. Minors: make test correction #2 discriminating; align `taxonomy-definition-response.ts:133` with D-W4 (500);
   selector `limit` out-of-range answers consistently (one class per BE03c 403); the two nits.
Files: your existing claim plus the runbook/alert inventory file(s) you name. Append `## Fix pass` to your report.
