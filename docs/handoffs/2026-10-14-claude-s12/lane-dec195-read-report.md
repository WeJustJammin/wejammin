# Lane report: claude_s12_dec195_read (DEC-195 protected related-content read, full stack)

## Status
IN PROGRESS (checkpoint 3, 2026-10-15T17:31Z). Layer 1 contracts GREEN (see Layer 1). Layer 2 SQL GREEN (runs 1-4). Layer 3 Worker GREEN (focused suites), full Worker suite pending. Layers 4 Web, 5 spec cascade not started.

## Scope
Brief `briefs/dec195-read.md`. Operation `cmsRelatedContentRead` (`GET /api/v1/cms/entries/{entryId}/related-content` -> `RelatedContentRuleRead { rule: RelatedContentResource | null }`), authorized as CMS-03C-05 (BE03c catalog row, authority row, DEC-195).

## Files
(none yet)

## Layer 1: contracts (GREEN, 2026-10-15T17:14Z)
RED first: `related-content.test.ts` (new describe, 4 tests), registry order in `registries.test.ts`, `error-catalog.test.ts` (22 operations, read -> `relatedContent`), `refusals-operations.test.ts` (22 operations, `cmsRelatedContentRead: ['capability_missing']`, marker AC-062), `tests/contracts/phase-02-slice-12-related-content-openapi.test.ts` (registry row + generated operation via `registerAgreementTests`, 200 -> `RelatedContentRuleRead`, no 409/422). Failed for the missing schemas/registration. GREEN: `RelatedContentReadApiRequestSchema` (strict `{entryId}`) and `RelatedContentRuleReadSchema` (`{rule: RelatedContentResource.nullable()}`) in `related-content.ts`; registry row after CMS-03C-05 (`cms-related-content-read`, 300/600 per minute, 8,000 ms, Tier 1, no-store); `openapi.ts` schema lists; `CMS_03C_OPERATION_CATALOG.cmsRelatedContentRead = 'relatedContent'`; `CMS_SLICE_12_OPERATION_REASONS.cmsRelatedContentRead = ['capability_missing']`; `infra/openapi-definitions-cms-composition.mjs` response set (bounded read statuses 400/401/403/404/415/429/500/502/503/504); contracts README line.
OpenAPI: `node infra/generate-openapi.mjs --check` reported drift before generation (expected); `node infra/generate-openapi.mjs` regenerated `docs/openapi/openapi.json`: sha256 before `72399c5004a45da6996fbe03c40d7a93d8f1b8b6929bf8f135cabe16d651a925`, after `26ac6affaf54498c568af28705e7343a420bdb05717c5e6b8f0f61e093ee3a97`; diff is additions only (385 lines, 0 removed): the GET operation `cmsRelatedContentRead` (251 lines, line 28444) and the components `RelatedContentReadApiRequest` and `RelatedContentRuleRead` (134 lines, line 49075); `--check` then exits 0. Test correction: `core-contracts.test.ts` exhaustive component-name list gained the two new component names (it fails otherwise by design).
Runs: contracts+openapi suites 176 files / 2131 tests green; `tsc --noEmit` (packages/contracts) clean; eslint --max-warnings=0 and prettier clean on touched files.

## Runs
- Run 1 (RED) 2026-10-15T17:17Z, lane `dec195`, stamp `alt-staged-dec195-131734-2543053`, plan: `supabase/tests/phase_02_slice_12_related_content_read.sql` (no WIP migration staged, wip=0): 91 tests, 31 ok, 60 not ok, first failing #12 (private function missing). Classification: genuine missing feature (function missing; the world, 4 prelude tests and every control write ran green). TAP `.lane-logs/alt-staged-dec195-131734-2543053.tap` SHA-256 `035475bddc0422c91e621b5af4b6b820b423480813c0c52b86f5d1b91e9f5ac6`. Five assertions passed vacuously in RED (identical error objects or "unchanged evidence"); two were hardened with non-vacuity controls before run 2.

## Test corrections
(none yet)

## Spec citations
DEC-195; BE03c route registry, validation (`cmsRelatedContentRead | entryId`), error matrix, catalog, authority, `RelatedContentRuleRead` schema, changelog 2026-10-15.

## Open items / BOUNDARY
- The resource's `derivedRule` is `{key, version}` only (no `maxCandidates`), so a saved rule cannot prefill the form's `maxCandidates`; to be resolved in the Web layer (see Web notes below once written).

## Requests to root
(none yet)

- Run 2 (GREEN attempt) 17:19Z, stamp `alt-staged-dec195-131926-2553974`, same plan with the 2 migrations (wip=2): 92 tests, 90 ok, 2 not ok (#65 control write by the editor, #66 the editor read). Classification: harness (my fixture): the editor is assigned to no target entry, so its CMS-03C-05 write with a pin was refused `related_target_ineligible`; the feature itself was not at fault. Fixed by a derived-only write by the editor. TAP SHA-256 `7b545ebb5bd47fc7d7db2de0a7c78f1e9b02b8c7eedd5308c82619c734327e84`.
- Run 3 (GREEN) 17:21Z, stamp `alt-staged-dec195-132139-2566416`: `phase_02_slice_12_related_content_read.sql` 92 tests, 92 ok, PASS. TAP SHA-256 `80db8966b9962de223f46a3150d430d4c517d04e1c2bc7a69cef3310fe093e93`.
- Run 4 (regression) 17:24Z, stamp `alt-staged-dec195-132435-2583577`: `phase_02_slice_09_r8_api_surface.sql`, `phase_02_slice_09_sec2_all_schema_definer_rls.sql`, `phase_02_slice_12_related_content.sql` (CMS-03C-05, unchanged behaviour), `phase_02_slice_12_related_content_read.sql`: 4 files, 322 tests, all pass. The r8 file needed `cms_get_related_content` added to its classification list (see Test corrections). TAP SHA-256 recorded below in Files if different on re-run.

## Layer 2: SQL (GREEN)
WIP `supabase/migrations-wip/dec195/`: `20261014200000_cms_get_related_content.sql` (150 lines, private SECURITY DEFINER reader, definer-owned, empty search_path, privilege closure) and `20261014200010_cms_get_related_content_public.sql` (43 lines, `platform_api` wrapper, service_role only). Behaviour: strict envelope -> actor/party -> UUID check (400 before any 404/403) -> source absent/other party/invisible = NOT_FOUND -> neither editor nor author assignment (`cms_authority_origin`, the CMS-03C-05 helper) = `capability_missing` -> the current active rule or `{rule:null}`. Resource = CMS-03C-05's: id = sourceEntryId = entry id; version = current entry aggregate version; contentHash = the write's JCS SHA-256 recipe; createdAt = updatedAt = newest rule row instant; state `active`; pins in stored position order; exclusions in ascending target id order (the table keeps no exclusion order); derivedRule key+version; eligibleCount from `cms_related_eligible_count`. Revoked everything = `{rule:null}`. Source lifecycle not constrained (the write answers INVALID_TRANSITION; a read has no such answer). No lock, no write, no audit, no idempotency record.
pgTAP: `supabase/tests/phase_02_slice_12_related_content_read.sql` + `supabase/tests/phase_02_slice_12_related_content_read/{README.md,000-helpers,001-shape-and-grants,002-read,003-authority}.sqlinc` (92 tests: shape/grants, null, read == write answer, derived rule, replacement, exclusion order, partial and full revocation, stored-as-written after a target is archived or unassigned, archived source, evidence unchanged by reads, author and editor access, 403 vs 404 vs 401 vs 400 ordering, parity with CMS-03C-05, no oracle between hidden and absent).

## Layer 3: Worker (focused GREEN)
RED: 41 route tests failed (Hono 404) and 11 adapter tests failed before any production code. GREEN: new `cms-composition/related-content-read-routes.ts` (GET, BE00 order: origin, request media 415 with empty allowlist, session, strict path and no query 400, no precondition headers or body 400, route capability 403, user 300 then party 600 quota, port, strict `RelatedContentRuleRead` contract incl. active state, same entry, no pin/exclusion overlap; 409/422 from a port fold to a scrubbed 500; 8,000 ms deadline; ETag = rule version, none for null); extracted `related-content-rate.ts` (the quota loop, now shared with CMS-03C-05) and `related-content-run.ts` (deadline, scrubbed 500, telemetry, shared); OPTIONS now allows `GET, POST, OPTIONS`; new port `readRelatedContent` in `CmsRelatedContentDependencies` and `cms-composition-production-related-read.ts` (the production RPC adapter; `relatedReadRpcError` in the existing rpc file maps with the read's own token list, `capability_missing` only); operation id added to the editorial rate-limit input union. Typecheck clean (`tsc --noEmit` in apps/worker, after `pnpm --filter contracts build` refreshed the ignored dist).
