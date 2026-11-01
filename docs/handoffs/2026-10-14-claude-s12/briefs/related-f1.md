# Lane brief — `claude_s12_related` fix pass (staged-runner lane `related`)

Read `docs/handoffs/2026-10-14-claude-s12/review-related.md` fully. Root rulings (binding):
1. Major: move the two single-sample `< 300 ms` wall-clock asserts out of the gate suite
   (`003-bound-and-bench.sqlinc:52,56`) into a separate non-gating perf suite (precedent: the locale lane's
   `phase_02_slice_12_locale_perf.sql`), measuring p95 over repeated samples; keep the functional 128-cap
   assertions in the gate suite.
2. `contentHash` must include `maxCandidates` (two rule sets differing only in `maxCandidates` must not hash
   equal) — RED first. Cite the BE03c line defining the hash inputs; if the spec lists the inputs and omits
   it, report that instead of changing behavior.
3. Archived source → `INVALID_TRANSITION` 409 with empty details: cite the spec token for this case or record
   it as a BOUNDARY (spec gap) in your report.
4. Record the absent `cms.publication.changed.v1` consumer (invalidation) as a BOUNDARY with the missing
   owner/spec named.
5. Re-run the eight `*related*` Worker test files with a verbose reporter and report the exact test count
   (the review counted 62 `it` blocks vs your claimed 73 — parameterised cases may explain it; show it).
6. Minors at your discretion with reasons (head predicate duplication / full-scan `heads` CTE; decision 6
   caveat; decision 8 hash recipe).
`DISABLE TRIGGER` in `r12_equalize` via the S11 shared helper is ACCEPTED (producer-unreachable equal head
instants, re-enabled on success and exception); keep its label. Edit WIP in place (complete files, then mv).
Append `## Fix pass` to your report.
