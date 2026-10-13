# Lane S11-SR — fix the Codex SQL review findings (read ORCH/lanes/COMMON.md first; LANE = slice11 checkout)
Source: ORCH/codex/s11-review-sql1.md "## Findings" (8 findings). Orchestrator verified both [high] items against the code (confirmed).
Verify every other finding yourself (refute with evidence when wrong). The Slice 11 migrations are UNMERGED, so fix them IN PLACE in the
owning file (no new migration needed): S11-2 files 20261005017000..017090 and S11-3s files 20261005017500..017595, plus their pgTAP files
supabase/tests/phase_02_slice_11_{reviews_*,schedules_*,helpers_*}.sql and fragment dirs. Both owning lanes are finished; nobody else edits
those files. Do NOT touch 017600+ (lanes 3a/3b/3c/3d are active there) or any Slice 09/10 test.
Items (RED pgTAP observed first, then fix, then GREEN):
 1 [high] cms_evaluate_preflight: dispatch on (provider_key, provider_version); every implemented database provider requires version 1;
   an unimplemented version of a known key -> unavailable/provider_unavailable (DEC-160). Test with same key + version 2.
 2 [high] cms_review_cas_guard: an open->open|approved|rejected transition must match the actual decision rows (count of decisions for the
   review = new.recorded_decision_count; approved/rejected only when the qualifying-decision rules hold — reuse
   cms_editorial_review_qualifying_decisions / distinct_approvals where they apply). Fix the wrong-oracle tests that assert count-only
   updates succeed (reviews_guard.sql ~159, ~241) by inserting the decision rows first. Lane S11-3a's cms_record_review_decision inserts the
   decision row before updating the review — confirm with its migration (read-only) that the order satisfies the new guard; if not, write
   "S11-SR -> S11-3a" in ORCH/lanes/NOTES.md.
 3 [medium] schedule guard: executing->failed_retryable increments attempt_count by exactly 1; reason_code retries_exhausted requires
   attempt_count = 3; negative tests for both.
 4 [medium] schedule guard: remove executing->cancelled (DEC-158(d), BE03b:2083); rejection test.
 5 [medium] cms_version_set_of / matches: canonical UUIDs, identity-once, every projected list sorted bytewise (incl. validator refs if the
   spec orders them — check BE03b:408 and :1755); reject or normalize consistently with the TS versionSetOf (lane S11-1R is making the TS
   contract require ascending lists — mirror that: reject non-canonical input). Unsorted + duplicate fixtures.
 6 [medium] cms_manifest_identities_current: validate the exact strict DependencyManifest structure first (all groups/keys, types, hashes,
   bounds, ordering, uniqueness); one missing-group case per group.
 7 [low] lineage test: behavioural update/delete rejection + a real two-session same-head append race runner under
   supabase/tests/phase_02_slice_11_races/ (follow infra/run-database-race-runners.mjs conventions).
 8 [low] tzdb: already covered TS-side by S11-1R's parity test (tests/contracts/phase-02-slice-11-sql-parity.test.ts); just confirm it
   exists and note it — no SQL change.
DB: ORCH/bin/lane-db.sh LANE [files] (shared lock; focused runs). Final: run every file you touched + phase_02_slice_11_* together; report.
Usage is tight: be economical. Report ORCH/s11/lane-s11-sr-report.md with a checkpoint per item. Final chat <=5 lines.
