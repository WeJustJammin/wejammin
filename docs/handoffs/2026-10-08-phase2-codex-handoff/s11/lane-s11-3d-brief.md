# Lane S11-3d — E2 derived revision state adoption (read ORCH/lanes/COMMON.md first; LANE = slice11 checkout)
Why: BE03b E2 (.memory/wiki/specs/be/03b-editorial-workflow-publication.md "Derived revision state (E2)", ~:1732-1746, and the persistence
row for cms_entry_revisions) makes the physical cms_entry_revisions.state the constant 'draft' and derives every browser-visible
EntryRevisionState with one helper. S11-3s built the helper (platform_private.cms_revision_effective_state(uuid) / cms_revision_effective_states(uuid[]),
ORCH/s11/helpers-api.md §1; report H5). S11-2 deliberately did NOT narrow the CHECK (migration 20261005017000 header explains why). Slice 11
criteria for derived state: P2-S11-AC-085/086 (read them in .memory/pipeline/progress/slices/phase-02-slice-11.md) — they are yours.
Ownership: NEW migrations 20261005018000..20261005018099 and NEW supabase/tests/phase_02_slice_11_e2_*.sql; forward CREATE OR REPLACE of the
Slice 10 functions that project revision.state (S11-3s listed ~8: cms_list_entries, cms_list_revisions, cms_get_entry_draft,
cms_create_revision / cms_resolve_conflict / cms_restore_revision responses, and any other function that reads cms_entry_revisions.state —
grep the migrations and enumerate them first in your report); decision-cited cascades of the Slice 10/12 suites that seed non-draft physical
states (phase_02_slice_10_entry_list_authorized_keyset.sql, phase_02_slice_10_entry_list_epoch_cursor.sql,
phase_02_slice_12_composition_instance_guards.sql, the S10 pin supabase/tests/phase_02_slice_10_remaining_schema/001-entries-and-revisions.sqlinc
'closed workflow union') — re-seed them with DERIVED evidence (reviews/schedules/publication rows) so they keep testing the same behaviour;
never weaken an assertion. Also the CMS-03B-03/13 `state` filter over DERIVED states as BE03b specifies (200-candidate batches, 1000-row scan
bound — read the exact text) with keyset/cursor semantics unchanged. Never edit historical migrations; never edit other Slice 11 lanes' files
(3a/3b/3c own 017600..017999); the three guard files stay orchestrator-owned (list GUARD CASCADE rows in your report).
Last step: narrow the CHECK on cms_entry_revisions.state to 'draft' (only after every read is rewired and every seeding suite is cascaded).
Every change RED first (pgTAP), then GREEN. Also confirm the Worker/web mapping still type-checks (no TS edits: if a Worker/web test asserted a
physical state, list it in NOTES for the orchestrator). DB: ORCH/bin/lane-db.sh LANE [files] (shared lock; keep runs focused; host is loaded).
Final: full ORCH/bin/lane-db.sh LANE run, classify every red by owner. Report ORCH/s11/lane-s11-3d-report.md with checkpoints. Final chat <=6 lines.
