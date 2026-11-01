# Lane brief — `claude_s12_governed_worker` fix pass (+ precedent fix)

Read `docs/handoffs/2026-10-14-claude-s12/review-governed-worker-p1.md` fully. Fix, test-first:
1. MAJOR: `apps/worker/src/cms-composition-production-governed-review-rpc.ts:102-105` lets provider 4xx
   that carry no product token (PostgREST `PGRST202`@404, `PGRST301`@401, raw SQLSTATE such as
   `42702`@400) become caller refusals. BE03c 1298–1302 requires a scrubbed 500. Add the guard and the
   three tests the review names.
2. Same defect in the precedent transports (pattern definition/latest and taxonomy definition/versions
   production adapters, `apps/worker/src/cms-composition-production-{pattern,taxonomy}-definition*.ts`).
   Fix there too, with tests, preserving every existing test (the 345-test joint set must stay green and
   only grow).
3. The review's minors: header validation order relative to quota consumption (only if the spec orders
   it; cite), the domain-less `canonical_source_unavailable` 422 (SQL will now always send `domain`; decide
   with spec whether a domain-less response is a provider fault → 502), untested `retry-after` on 503,
   429 header details, the SQL-side `/subjectHash` 422 mapping, and the README line in
   `apps/worker/src/cms-composition/README.md`.
Files: your existing governed-review files plus the six shared integration files (as in
`briefs/governed-worker.md`), plus the pattern/taxonomy definition transport files named in the
2026-10-13 dispatch claims (`apps/worker/src/cms-composition/{pattern,taxonomy}-definition-*.ts`,
`apps/worker/src/cms-composition-production-{pattern,taxonomy}-definition*.ts`) and
`apps/worker/src/cms-composition/README.md`. Append `## Fix pass` to your report. Run the focused sets,
the 345 joint set and the full Worker suite; tsc/eslint/prettier on touched files. Then stop; phase 2
(07/08/10/11) is released separately.
