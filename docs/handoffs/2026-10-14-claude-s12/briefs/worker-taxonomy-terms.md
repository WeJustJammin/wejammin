# Lane brief — `claude_s12_worker_taxonomy_terms` (Worker transport)

Build, test-first, the Worker transport over the PROMOTED taxonomy-terms SQL (`supabase/migrations/20261014120000`–`120820`;
exact RPC boundary, request/answer shapes, tokens, DETAILs and ETag rules in
`docs/handoffs/2026-10-14-claude-s12/lane-taxonomy-terms-report.md` `## RPC boundary` and `## Follow-up f2`):
1. CMS-03C-03 POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions — the route and contract exist; the
   production port `apps/worker/src/cms-composition-production-taxonomy.ts` currently fails closed 503:
   wire it to `platform_api.cms_act_taxonomy_term`, map every token (403 `capability_missing`, 404, 409
   `taxonomy_not_active`, 422 `canonical_overlap`/`canonical_source_unavailable` + `details.domain`, etc.).
2. `cmsTaxonomyTermsRead` GET /api/v1/cms/taxonomies/{taxonomyId}/terms and CMS-03C-17 GET
   /api/v1/cms/taxonomies/selector — new routes (registry rows exist in `packages/contracts/src/platform-registries.ts`):
   strict query admission, cursor passthrough, ETag page version, no-store, 400 vs 422 per BE03c 406/407.
3. The merge-converge job: a Worker job handler for the registered job type calling
   `platform_api.cms_run_taxonomy_merge_converge` with the claimed job (id, version, lease token), recording
   the job `succeeded` and NEVER re-queueing it (the SQL requests the fresh continuation job), omitting `batch`.
Use `mapCmsCompositionRpcFailure` (provider-fault guard), header-before-quota ordering, 502/503/504
`retryable: true` (hardening precedents in `lane-worker-hardening-report.md`, `lane-hardening-2-report.md`).
Spec BE03c rows ~161, ~166–167, ~179, ~187, D10 ~1369–1377, error catalog, testing. Files: taxonomy Worker
routes/adapters (`apps/worker/src/cms-composition/taxonomy-*.ts`, `apps/worker/src/cms-composition-production-taxonomy*.ts`),
new job handler file(s) + registration (list them), shared integration files for wiring only, tests. Run
focused, joint 345, full Worker; tsc/eslint/prettier. Report `docs/handoffs/2026-10-14-claude-s12/lane-worker-taxonomy-terms-report.md`.
