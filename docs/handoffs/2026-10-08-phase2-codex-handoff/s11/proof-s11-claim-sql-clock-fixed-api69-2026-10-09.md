# Slice 11 — statement-clock correction, actual API69 GREEN

Only18400 observed_at initializer changed clock_timestamp() to once-captured
statement_timestamp(); complete diff one line,215/101/60 source caps retained.
No predicate/parser/dispatcher/QA/ACL changes.

Actual main54322 freshCI0 before every stage/shared flock:
pre-reset0/API0/post-reset0, unchanged3 suites69/69,32.18s. Actual one-second
BE00 expired claim still refused;55322 untouched; both gate sessions closed0.
Catalog existing-definer owner-only ACL/API EXECUTE all false for three routines;
empty search_path, dispatcher/request/snapshot volatilityv/i/s, request invoker,
others definer; temporary schema CREATE false; statement_timestamp STABLE.
Security pgTAP4 files121 assertions PASS,9s. Contracts/generated DB types check/
progress/ESLint/type/diff0 after correction.

DB lint CLI0:39 functions100 issues, every function/issue object identical to
first-empty baseline. Zero new warning; earlier clock warning removed.
Whole lint NOT clean: inherited cms_build_dependency_manifest42P01 missing
pg_temp.cms_manifest_block_refs still present. Earlier unit35/1116 receipt
20.68s predates this sole SQL correction; final restored regression still due.

Exact source SHA256 baseline before mutations:

- 18400:8b8b1f9d96fb70935c589615e6d61b421c7ccb091505cfce42c6384609536e81
- 18500:02c95ec5ac1d4202b686b8a0b82e4517d465962c934467eb07b6695dc9ceb859
- 18600:3a1b3cf0185a94291ec2ce4be13a9775759360530445c2400335a4209c792ebe

Seven root-only mutants UNRUN. Independent source review and root exact reads
find M6 supersession witness masked: fixture first adds a field, oracles prove
old fingerprint retained AND target/artifact hashes changed; retained target/
compiler/transform comparisons still refuse after removing current dryRunId/
superseded_at checks. Record actual outcome, not predicted kill. Separate future
public repeat dry-run with unchanged hashes needed; no fabricated state.
Plan distinguishes compound groups from individual predicates.

No acceptance/full validation closure. Raw-ID/max UUID/numeric-wire/legacy/GUC
edges, genuine nonzero/completed producers, receiving/heartbeat/per-stage
integration, DEC163, later slices, owner/external holds open;0/122.

Logs under .lane-logs:

- parent-s11-claim-sql-clock-fixed-api69-20261009{-pre-reset,-post-reset}.log
- parent-s11-claim-sql-clock-fixed-api69-20261009.log
- parent-s11-claim-sql-clock-fixed-catalog-20261009.log
- parent-s11-claim-sql-clock-fixed-lint-20261009.log
- parent-s11-claim-sql-clock-fixed-pgtap-20261009.log
- parent-s11-claim-sql-clock-fixed-static-20261009.log
