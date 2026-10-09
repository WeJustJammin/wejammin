# Lanes S11-3a / S11-3b / S11-3c — Slice 11 command, read and internal RPCs (read ORCH/lanes/COMMON.md first; LANE = slice11 checkout)
Common inputs (read before writing): ORCH/s11/helpers-api.md (FROZEN helper names/signatures from lane S11-3s — call them, never redefine
them; if a helper you need is missing or its body is not landed yet, write your RED test, append "NEEDS FROM S11-3s: ..." to
ORCH/lanes/NOTES.md and continue with another item), ORCH/s11/lane-s11-3s-report.md and ORCH/s11/lane-s11-2-report.md (what has landed),
ORCH/codex/s11-rpc-plan.md §1-§5 (Codex draft: existing helper table, global lock order, refusal catalog, per-RPC sketches — VERIFY every
claim against code/spec before relying on it), ORCH/lanes/NOTES.md rulings DEC-156 (single-JSON convention: platform_private.<name>(p_request
jsonb) returns jsonb + platform_api.<name> wrapper, SECURITY DEFINER, search_path '', owner wejammin_cms_definer, revoke from PUBLIC/anon/
authenticated, grant execute to service_role; internal 19/20 also get platform_api wrappers granted to service_role only), DEC-157 (global lock
order governs; assignment serializes on the review row), DEC-158; BE03b .memory/wiki/specs/be/03b-editorial-workflow-publication.md (Route
Registry :145-245, Field validation matrix, Request/Response Contracts, Data Flow, Error Handling :1895-1910, Database Schema :1940-1990,
Access control :1990-2025, transactions/events :2030-2120, Verification :2120-2180); the contract module packages/contracts/src/cms-editorial/**
(resource shapes your JSON must match key-for-key: review-resources, publication-resources, workflow-read, preflight, refusals, events);
Slice 11 criteria P2-S11-AC-001..122 in .memory/pipeline/progress/slices/phase-02-slice-11.md; Slice 10 RPC patterns in supabase/migrations/
2026100501*.sql (idempotency reserve/complete, typed reason tokens with DETAIL = JSON array of RFC 6901 pointers, cms_emit_event, deadlock
-> CONFLICT mapping, concealment 404 vs 403). RPC NAMES ARE BINDING (the Worker lane S11-4 calls exactly these): cms_submit_review,
cms_record_review_decision, cms_assign_editorial_reviewer, cms_schedule_publication, cms_publish_revision, cms_mint_preview,
cms_get_entry_workflow, cms_get_editorial_review, cms_list_editorial_reviews, cms_verify_preview_token, cms_claim_due_publication_schedules,
cms_execute_publication_schedule. Before writing a wrapper, read ORCH/s11/lane-s11-4-report.md for the exact request keys the Worker sends
(if it differs from the contract, the contract wins; note the mismatch in NOTES).
Rules: atomic canonical state + audit + idempotency + outbox in one transaction; identifier-only events; replay with the same key returns
the stored result with no second effect; IDEMPOTENCY_MISMATCH on changed request; STEP_UP_REQUIRED decided by the Worker (the RPC receives
server-derived step-up evidence and refuses without it where BE03b requires); never leak person/party/actor ids beyond what the resource
allows; concealment: hidden target 404, visible-but-unauthorized 403.
GUARD FILES ARE ORCHESTRATOR-OWNED: do NOT edit supabase/tests/phase_02_slice_09_r8_api_surface.sql, phase_02_slice_10_ev_eb_publication_scope.sql
or phase_02_slice_09_sec2_all_schema_definer_rls.sql; list every new function (schema.name, grant, definer tables) under "GUARD CASCADE" in
your report — the orchestrator applies all three lanes' rows at integration. Expect those three files to be red meanwhile.
Every RPC: pgTAP (RED first) covering success, each typed refusal token, concealment, idempotency replay/mismatch, CAS stale, no partial
effects, grants (anon/authenticated cannot execute; service_role can), audit/outbox rows, and privacy of the returned JSON; add a race runner
under supabase/tests/phase_02_slice_11_races/*.mjs (follow infra/run-database-race-runners.mjs and supabase/tests/phase_02_slice_10_races/)
for each concurrency obligation BE03b names for your RPCs. DB: ORCH/bin/lane-db.sh LANE [your files] (main stack, shared lock; keep runs
focused) — the second stack ORCH/bin/lane-db-ev.sh is available too (same lock discipline). Report ORCH/s11/lane-s11-3<x>-report.md with a
checkpoint after every RPC (files, RED->GREEN, refusal tokens covered). Final chat <=6 lines.

## S11-3a — review authority. Migrations 20261005017600..20261005017699; tests supabase/tests/phase_02_slice_11_rpc_review_*.sql
cms_submit_review (CMS-03B-05: assignee author/editor; recompute frozen hash, dependency manifest <=256/32 KiB, risk class, workflow policy,
submit-phase preflight 1-16; one live review per revision; open review + dependency index; event cms.entry.review-changed.v1),
cms_record_review_decision (CMS-03B-06: active per-review assignment + standing cms.reviewer, specialist slot capability, separation of duties,
step-up evidence <=600+/-30 s, reason SafeText; first rejection terminates; approval count recount via cms_editorial_review_distinct_approvals;
dependency_changed check before the review lock per DEC-157), cms_assign_editorial_reviewer (CMS-03B-18 create|revoke, DEC-136, DEC-157:
owner holding non-grantable cms.editorial_review.assign, review open, eligible reviewer, <=16 active, expiry <=7 days bounded by reviewer and
grantor authority; review version unchanged; event).

## S11-3b — schedule and publication. Migrations 20261005017700..20261005017849; tests phase_02_slice_11_rpc_publication_*.sql
cms_schedule_publication (CMS-03B-07: owner-party publisher, approved review If-Match, step-up, tzdb version = cms_tzdb_version(), resolved UTC
supplied by the Worker time authority and re-checked for plausibility, horizon 60 s..366 d, authority_ends_before_schedule, uniqueness incl.
audience, all 17 preflights, 202 resource; no event until execution), cms_publish_revision (CMS-03B-09: publisher != author, step-up, frozen
hash/version set/manifest current, all 17 preflights, cms_append_publication_lineage, exactly one cms.publication.changed.v1, projectionState
pending), cms_claim_due_publication_schedules (batch 1..100, FOR UPDATE SKIP LOCKED, expired leases first returned to failed_retryable,
5-minute lease, bounded ClaimedSchedule with ids/versions/hashes only) and cms_execute_publication_schedule (lease + expected version, steps
1-6 of BE03b Schedule execution, evidence verification per DEC-158(c), retry ladder 15/60/300 s then blocked retries_exhausted, already_completed
replay, deviation recording). Race runners: multi-worker claim, crash/lease expiry, concurrent publish vs schedule, outbox dedupe.

## S11-3c — preview and reads. Migrations 20261005017850..20261005017999; tests phase_02_slice_11_rpc_preview_*.sql, _rpc_reads_*.sql
cms_mint_preview (CMS-03B-08: assignee/assigned reviewer/publisher, entry-version If-Match, exact version set, audience/route grammar, token
derivation: 43-char base64url, exact 900 s expiry, replay re-derives the same unexpired token, expired/revoked replay preview_expired; only the
token hash is stored), cms_verify_preview_token (CMS-03B-19: read-safe, exact binding to actor/acting-context version/route/locale/audience,
byte-identical denials except the bound actor's own revoked flag), cms_get_entry_workflow (CMS-03B-15: preparation recompute with 1-16
preflight report, <=16 schedules, <=64 publications, permitted actions, composite ETag inputs), cms_get_editorial_review (CMS-03B-16: role-scoped
detail, own decision reason only, owner-only assignments <=32), cms_list_editorial_reviews (CMS-03B-17: signed keyset cursor over
(updatedAt DESC, reviewId DESC) using the Slice 10 cms_signed_cursor_* helpers; assigned|submitted scopes; never scans the hidden population).
