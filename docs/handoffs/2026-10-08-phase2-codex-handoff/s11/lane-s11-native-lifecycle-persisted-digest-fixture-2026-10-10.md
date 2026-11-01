# Slice 11 lifecycle persisted approval-digest fixture correction

Status: selected sole test oracle correction after actual focused RED; author
UNRUN until root final full-gate receipt and clean pushed exact-origin checkpoint.
Native gpt-6-astra/high; root gpt-6.1-sol/ultra commands/review/verification.

## Exact sole-file scope

Only tests/postgrest/phase-02-slice-11-lifecycle.apispec.ts. Read complete file and
effective approval digest/ownership/RLS source. Only first leaf SQL expectation
may change: replace direct cms_schema_review_approval_digest(r.id) diagnostic call
with exact persisted JSON projection passed to pure cms_jcs_sha256. No other
leaf/body/title or fixture/production/SQL/policy change; no extra module.

Keep exact first title:
activates a fresh draft only with the actual dry-run, independent decision and server-derived approval hash

Actual parent-s11-first-gate-fixtures-api-real-20261010.log752–768 gives empty psql
string rather than true at line83. This does NOT prove the outer join missing.
Digest in 20261002125000_cms_schema_review_support.sql292–317 is SECURITY DEFINER
and reads review/decision rows under non-bypass CMS owner (03120500 ownership).
The independent postgres diagnostic supplies neither resolved session scope nor
RPC context, so digest can return NULL. Do not fabricate JWT/GUC, relax RLS, grant
authority, change producer digest or drop equality.

Inline exact source projection only:
version numeric1; reviewId r.id; definitionHash r.definition_hash; policyHash
r.policy_hash; decisions approved rows for r.id, ordered by decision.id, containing
id/assignmentId/capability/reviewedHash. Coalesce to JSONB empty array exactly.
Use pg_catalog.jsonb_build_object/jsonb_agg and existing pure cms_jcs_sha256,
not another table-reading SECURITY DEFINER. Preserve the stored activation approval
hash equals stored review approval hash AND equals independently recomputed
persisted projection; preserve both actual dry_run_id bindings. Keep outer v/r
join and candidate IDs, independent reviewer/MFA evidence and zero transport
refusal assertions exact. This repairs a diagnostic authority context, not evidence
manufacturing; underlying approvals must still be real committed rows.

Existing206 lines; QA hard400/target350. No unrelated extraction. Author reads/
apply_patch only, no commands/scripts/tests/format/runtime/Git/DB/network/docs/
memory/settings. Return exact changed leaf and projection, release claim. Root
checks source projection/token equivalence and six other case bodies/titles,
refutes independently, actual API/full db:verify then validate freshCI0/flock and
postreset, honest receipt/canonical/handoff/checkpoint. Acceptance0/122 remains.
