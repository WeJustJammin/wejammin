# Slice 11 SEC-1 claim-gate cascade — pending execution

Orchestration/review: `gpt-6.1-sol` / `ultra`. Implementation: explicitly select `Phils-Charm/deepseek-v4.1-flash` / `high`, verify live metadata, and stop on availability/routing failure. This brief is not dispatch authorization: parent must finish the active foundation review, checkpoint/commit/push and refresh the live Claude handoff before assigning this scope and the sole DB slot.

## Fresh prerequisite and exact targets

The repository-only full API candidate `.lane-logs/api-034933.log` exited1:29/31 files,491/495 tests passed. The four failures are unchanged tests:

- `claim-gate-manifest.apispec.ts`: `lists every claim-reading platform_api function and no other`; `reports each kind of drift against a synthetic catalog`.
- `claim-gate-mutation.apispec.ts`: `starts from a clean baseline`; `mutates all 94 manifest entries and each one is caught by drift and by its own behaviour probes`.

The exact unlisted readers are `cms_assign_editorial_reviewer`, `cms_execute_publication_schedule`, `cms_get_editorial_review`, `cms_get_entry_workflow`, `cms_list_editorial_reviews`, `cms_load_quality_gate_input`, `cms_mint_preview`, `cms_publish_revision`, `cms_record_review_decision`, `cms_schedule_publication`, `cms_submit_review`. This proves catalog/manifest drift, not that every producer has the required gate. Do not label the entire failure a stale fixture until each gate, valid request and mutation is proven.

## Exclusive file scope

- `tests/postgrest/support/claim-gate-manifest.ts`, existing claim-gate fixture modules/aggregator, or focused new claim-gate manifest/fixture modules if needed to keep utilities<=300 lines. The fixed registry remains independently checked in, never generated from catalog bodies. Keep tests<=400 lines; report moved module paths and extension documentation for parent integration.
- Focused claim-gate success/mutation support only where required to exercise the added entries without weakening existing checks.
- The two existing claim-gate apispecs only for demonstrably stale literal counts/titles and focused new assertion cases. List every changed existing literal title exactly.

No SQL, migrations, contracts, application production, Slice11 API foundation files, browser files, configuration/runners, ledgers/tracking/handoffs or memory edits. No commits, pushes, nested agents, broad formatting or cleanup. A real producer omission requires fresh RED, exact source and a separately authorized file scope from parent; never work around it through the catalog scanner or fixture expectations.

## Required reads and invariants

Read active AGENTS.md, CLAUDE.md, always-active rules, relevant implement-slice/TDD/systematic-debugging/context-mode skills, source handoff and COMMON/NOTES instructions. Read the manifest, actor-family mapping, fixed valid-request fixtures, `claim-gate-check.ts`, mutation suite and shared mutation helpers completely. Inspect all11 named functions and their transitive identity/role helpers, current EXECUTE grants, BE00 security boundaries and binding DEC-149–161. Preserve all owner-held partials and external release gates.

`claim-gate-check.ts:46–73` scans transitive claim readers for drift only. Fixed manifest entries select behavioral tests independently of function bodies. Exact bidirectional equality, grant agreement, family/fixture one-to-one coverage, valid requests, positive controls and mutation sensitivity remain mandatory. Do not derive behavioral targets dynamically from catalog bodies, exclude a new reader, lower the floor or accept `INVALID_REQUEST`/`VALIDATION_FAILED` as an authentication refusal.

Static preparation found10 named human operations resolve `cms_actor(p_request)` (for example submit17640:79, decision17630:89, workflow17900:111, load17910:207). `cms_actor` delegates to `cfg_actor` at `supabase/migrations/20260902080000_content_schema_registry_authority.sql:2227–2236`; do not assume that all shared-helper mutants necessarily exercise every new request. Execute17740:106–132 accepts only scheduleId/expectedVersion/leaseId/evidence and has no human actor binding. It is still a transitive claim reader: frozen dependencies → manifest → settings snapshot → effective values → configuration resolver → cfg_request_actor/cfg_actor. Registry-v1 settings keys are empty, so this static reachability does not prove a live caller-authentication predicate. DEC-156 explicitly chooses service_role grants and the one-principal Worker module-boundary architecture test; it does not require a human actor context or a release-worker JWT-role helper inside this function. Classify its valid actorless request, actual API-role denials and principal boundary separately, retaining fixed-manifest coverage and mutation sensitivity without weakening existing families. A grant alone is not proof of a body-level role check, and the absence of an additional body check is not automatically a DEC-156 violation. Report a producer defect only against a specific violated locked requirement; never invent a human context or accept a validation refusal as authentication proof.

## Execution and evidence

1. Capture a fresh focused manifest RED on repository migrations under the shared lock before edits; retain the existing broad-run receipt as history only.
2. Extend the deliberately checked-in registry/families and valid fixtures against actual contracts/grants. Every new case reaches its genuine gate, not an earlier malformed-input check. Exercise ghost/forged binding where applicable, forbidden API roles, real subject/Worker next outcome and safe positive controls. No real accounts/grants; only existing local synthetic test workflows.
3. Prove each new entry is tested when its own gate is removed and that appropriate shared-gate weakening/legacy-claim-GUC mutants fail. Preserve restoration in `finally`; never leave catalog mutations installed. Catalog mutation is permitted only inside this existing security-test workflow while holding the sole DB lock, never as a production fix or diagnostic overlay.
4. Run focused manifest/mutation suites, then the complete S09/S10/S11 API suite on a fresh repository-only reset. Report exact counts, first failure, log/exit identities and literal title changes. Run proportionate format/lint/type gates. No acceptance checkbox closes solely from this prerequisite.

Parent grants the sole slot only after the checkpoint push and CI/lock preflight. Check active CI before each reset; use the existing `lanes/lane-api.sh`, active worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, main wejammin54322 only, `/tmp/wejammin-supabase-ci.lock` and pinned toolchain PATH. No DB work until that grant, no concurrent reset/test, no passwords/deployments/paid plans. Finish every runner and explicitly release the slot before parent verification.
