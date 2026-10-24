# Lane brief — `claude_s12_worker_hygiene_2`

1. F5 (`review-worker-pattern-updates.md`, `lane-worker-hygiene-1-report.md`): the three near-copy request-bound
   context verifiers (pattern-update rpc, `pattern-definition.ts`, `governed-review.ts`) become one shared helper — a
   pure refactor: identical behaviour, all existing tests unchanged and green, plus a focused test of the helper.
   If a difference between the copies is behavioural, stop and report it instead of unifying it.
2. `review-hardening-5-hygiene-1.md` B minor: the hygiene-1 F2 "version pair only" test cannot fail (extra members are
   stripped earlier by `STRUCTURED_KEYS`, `cms-editorial-production-error-details.ts:133-145`): add a structured member
   such as `retryAfterSeconds` to its input and show a "relay every member" mutant fails it.
3. Nits: `taxonomy-term-details.test.ts:218` comment about 13/14/15 403s; the "exactly one 403 token" wording in the two
   capability test headers (CMS-03C-06/07 also publish `separation_of_duties`); remove the now-redundant 403 branch in
   `taxonomy-term-details.ts` only if a test proves it unreachable (else leave it and say why).
Mutations on scratch copies under `<scratchpad>/claude_s12_worker_hygiene_2/` (mutant batches under /bin/bash). Gates:
focused + full `apps/worker` Vitest, worker `tsc`, eslint + prettier, under `flock -s /tmp/wejammin-quiet.lock`.
Report `docs/handoffs/2026-10-14-claude-s12/lane-worker-hygiene-2-report.md`.
