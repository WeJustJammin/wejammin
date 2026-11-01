# Lane brief — `claude_s12_governed_retire_sql` fix pass (staged-runner lane `governed-retire`)

Root ruling (made after your first pass launched; binding): retire ADVANCES the review `version` by exactly
one, like activation. Reason: CMS-03C-10's strong ETag is `"{review.version}"` while its body exposes
`subjectState`/`permittedNextActions`; a retire that changes them without a version change would serve
changed content under an unchanged ETag (HTTP semantics), and BE03c 215 lists "an activation" — retire is a
CMS-03C-09 transition. Fix test-first (edit your WIP in place; unpromoted):
1. SQL: retire bumps the review `version` by one in the same transaction (mirror activate); response
   `reviewVersion` = expected + 1. Update `095-retire.sqlinc` and the pattern retire suite oracles (ruling-forced
   corrections, report them).
2. Worker: `validGovernedActivation` binds a retire answer to `reviewVersion === expectedVersion + 1` (replace
   your equality tightening); update the `it.each` test accordingly; ETag on the 200 = the new review version.
3. Keep the retire-reason BOUNDARY as written (root accepted: validated and hashed, not stored; spec names no
   storage).
Lane `governed-retire`. Rerun governed activation, retire-pattern, schedule and pattern-definition suites and the
governed Worker tests + full Worker suite. Append `## Fix pass` to your report.
