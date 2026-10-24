# Lane brief — `claude_s12_worker_pattern_updates` (Worker transport CMS-03C-13/14/15)

Build, test-first, the Worker HTTP transport for:
- CMS-03C-13 `GET /api/v1/cms/patterns/selector` → `platform_api.cms_list_pattern_selector`
- CMS-03C-14 `GET /api/v1/cms/compositions/instances/{instanceId}/update-diff` → `platform_api.cms_get_instance_update_diff`
- CMS-03C-15 `POST /api/v1/cms/compositions/pattern-updates` → `platform_api.cms_apply_pattern_update`
The SQL is GREEN (2144/0) but NOT yet promoted: read `supabase/migrations-wip/pattern-updates/2026101414*.sql`
(public wrappers `140310`, `140410`, `140610`) for the exact `p_request` keys, answer shapes and every
`raise exception` token/DETAIL, and `lane-pattern-updates-report.md` (fix pass: malformed ids are 400
`INVALID_REQUEST`; nested/cycle/depth pointers at `/targetPatternVersion`; `revision_not_editable` and
`nested_pattern_not_active` on 15). Do not edit SQL. If the SQL changes after review, root will tell you.

## Spec
BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` rows 175-177 (route registry), 215
(If-Match operands for 15), 398-400 (validation), 1266-1268 (error matrix), 1304 (typed refusals),
1474-1476 (authority), 1342-1348 (lock order is SQL's); BE00 172 (502/503/504 retryable true). Contracts
(frozen): `packages/contracts/src/cms-composition/pattern-selector.ts`, `pattern-update.ts`,
`pattern-update-diff.test.ts` and its schema, `refusals.ts` (CMS-03C-13/14/15 lists), registry rows
`packages/contracts/src/platform-registries.ts:2123-2160` (rates, timeouts, capabilities).
Known owner-pending semantics (build to the CURRENT SQL behaviour, do not invent): override replaces whole
node props; removed-root keep-yours row; target-added root; detach over 128 keys; retired-head detach.
Record each as a BOUNDARY note in your report only if the Worker would need to change when the owner rules.

## Precedent (copy structure)
CMS-03C-02 transport `apps/worker/src/cms-composition/pattern-instance-*.ts`,
`cms-composition-production-pattern*.ts` (incl. `mapCmsCompositionRpcFailure`, header-before-quota,
`pattern-instance-details.ts` per-operation reason filter); reads with signed cursors and page validation:
`taxonomy-read-routes.ts`, `taxonomy-read-query.ts`, `taxonomy-read-pages.ts`,
`cms-composition-production-taxonomy-reads.ts` (Worker taxonomy-terms lane). Admission: strict JSON,
262,144-byte caps, unknown fields, headers; verified session + original Request proof; capability refresh;
idempotency key + strong `If-Match` = entry aggregate `version` for 15; 404 vs 403 concealment; response
parsed with the frozen schema and a response-size budget; malformed/oversized answer → local 502
retryable; deadline → 504; provider 500/502/503/504 → 503 DEPENDENCY_UNAVAILABLE; 403 relays only
`capability_missing` (never `CAPABILITY_REQUIRED`).

## Files
New: `apps/worker/src/cms-composition/pattern-{selector,update-diff,update}-*.ts` (+tests, test-support),
`apps/worker/src/cms-composition-production-pattern-{selector,update-diff,update}*.ts` (+tests). Shared
integration files (exclusive to you while this lane runs; register/wire only, preserve every existing
export/constant/rate entry, ≤300 lines each): `apps/worker/src/worker-route-composition.ts`,
`production-worker-runtime-cms.ts`, `production-worker-runtime.ts`, `worker-types.ts`,
`cms-editorial-production-types.ts`, `cms-editorial-production-boundary-types.ts`.
`apps/worker/src/cms-composition/README.md`: append your file lines only (lane hardening-4 may add one
sentence concurrently; re-read before editing). NOT the hardening-4 files (locale/related/template routes,
`*-details.ts` filters), NOT `apps/web`, contracts, SQL.

## Gates
Focused Vitest RED then GREEN per clause; full `apps/worker` Vitest; worker `tsc --noEmit`; eslint
`--max-warnings=0` + prettier on touched files; re-run the 345-test joint set
(`lane-native-worker-integration-report.md:67`) after touching shared files. All under
`flock -s /tmp/wejammin-quiet.lock`. Report `docs/handoffs/2026-10-14-claude-s12/lane-worker-pattern-updates-report.md`
with a status/code mapping table per operation.
