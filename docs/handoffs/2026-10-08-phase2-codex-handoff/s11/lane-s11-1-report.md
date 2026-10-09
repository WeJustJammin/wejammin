# Lane S11-1 report: Slice 11 contract spine (packages/contracts, registry rows, OpenAPI, tz pin)

LANE = /home/rob/.codex/worktrees/phase2-slice11/WeJammin (claude/phase2-slice11). Nothing staged or committed. No SQL, Worker or web edits.
Baseline before work: `pnpm exec vitest run packages/contracts/src/cms-editorial` = 16 files / 328 tests green; git status clean.

## Plan (operation order; each item = RED test observed, then GREEN)

A. Shared vocabulary + operation IDs + route-policy surface (statuses 202/200, outcomes, step-up code, rate classes, reason catalog)
B. CMS-03B-05 / 06 resources + transport views
C. CMS-03B-07 schedule resource + typed time refusals
D. CMS-03B-08 preview token resource
E. CMS-03B-09 publication resource
F. Preflight (17 categories, report, evidence) + dependency/version-set helpers
G. CMS-03B-15 workflow read
H. CMS-03B-16 / 17 / 18
I. Internal CMS-03B-19 / 20 schemas (absent from browser inventory)
J. Events (review-changed, publication-changed) + settings registry E7 + tz pin E8 (DEC-153)
K. Route rows, platform registry rows, OpenAPI definitions, generated openapi.json, runbook
L. Gates: focused vitest, contracts:check, type-check, lint, format:check

## Checkpoints

(append below after each finished item)

### CP1 (items A-E partial): vocab, review/schedule/preview/publication resources, transport views
Files (new): packages/contracts/src/cms-editorial/{workflow-models,review-resources,publication-resources,workflow-requests}.ts,
 workflow-fixtures.test-support.ts, workflow-resources.test.ts, workflow-requests.test.ts. Exported via cms-editorial/index.ts.
Edited (mechanical, behavior-preserving): publication-schedule-contracts.ts exports its grammar schemas as CmsPublicationAudienceSchema,
 CmsScheduleTimezoneSchema, CmsScheduleLocalDateTimeSchema, CmsPreviewRouteSchema and reuses PublicationActionSchema.
RED observed: workflow-resources.test.ts 25/25 failed (schemas undefined); workflow-requests.test.ts 6/6 failed. GREEN: 25/25 and 6/6 (31 total).
Decisions inside the contract (implementation level, owner may override):
 - PublicationScheduleResource.reasonCode is the closed six-token enum (BE03b text says closed set; its Zod shows a regex); actualUtc and deviationSeconds
   exist exactly when state is completed (BE03b Schedule execution step 5).
 - PreviewTokenResource.token is exactly 43 unpadded base64url chars (BE03b derivation text; its Zod shows min 43 / max 512).
 - PublicationResource: action publish <=> state active|superseded; every other action <=> revoked (E3 text).
 - Did NOT add open => recorded<required style invariants to the review: BE03b allows an open review with recorded == required after a standing-grant lapse.
Remaining: preflight, read resources (15/16/17), assignment (18), internal 19/20, events, settings, tz pin, route rows, registry, OpenAPI, runbook, gates.

### CP2 (item F + G): preflight registry/report/evidence, versionSetOf, CMS-03B-15 workflow read
New: preflight.ts (+test, 19), version-set.ts (+test, 5), workflow-read.ts (+test, 14). All cms-editorial tests: 21 files / 397 green (Slice 10 files untouched and green).
RED observed first each time (19/19, 19/19 incl. version-set, then 1 targeted RED for the frozen-candidate hash binding), then GREEN.
 - CMS_PREFLIGHT_REGISTRY mirrors BE03b table rows 1-17 (provider key/kind/reference kind/reason set) = the single source for the SQL parity test (lanes 2/3).
 - PreflightReport enforces registry order (not just uniqueness); a `failed` reasonCode must be in the category's reason set; `unavailable` may name any lowercase token
   (BE03b registers only checker_failed for unavailable: spec gap, flagged, not invented).
 - PreflightEvidence uses healthy|blocked|failed (DEC-150) with BE05c invariants; mapping helper and the 60 s freshness helper exported.
 - versionSetOf / versionSetMatchesManifest are the pure E1 projection; EntryWorkflowPreparation refuses a versionSet that does not project its manifest, a riskClass or
   workflowPolicy that differs from the frozen policy; EntryWorkflowResource refuses preparation unless the revision is a current effective draft, frozenHash != contentHash,
   a latest review of another revision/entry, and review.frozen hashes that differ from the review's own.

### CP3 (items H + I): CMS-03B-16/17/18 and internal CMS-03B-19/20 contracts
New: review-read.ts (+test 17), review-assignment.ts (+test 14), internal-rpc.ts (+test 15). RED observed (17/17, 14/14, 15/15 failing on missing exports), then GREEN each.
 - Review detail: decisions listed == recordedDecisionCount (<=8, unique ids, <=1 own), reason only on `mine`, distinctApprovalCount <= approve decisions, assignments <=32 owner-only default [],
   assignment summary reuses the 03a SchemaReviewAssignmentSummary (identical shape, DEC-136 mirror; label never an id, window <=7 d).
 - Queue page enforces the (updatedAt DESC, reviewId DESC) keyset order, <=50 items, <=512 char cursor; item enforces recorded<=required and protected>=2.
 - Assignment request is a strict discriminated create|revoke; reason 1-256 code points NFC (refused not normalized); resource = read+decide under cms.editorial_review, window <=7 d;
   CMS_REVIEW_ASSIGNMENT_MAX_ACTIVE (16), expiry-ceiling helper, create 201 / revoke 200 helper.
 - Internal: CMS_EDITORIAL_INTERNAL_OPERATIONS (19/20 with RPC names + principals) is not part of CMS_EDITORIAL_OPERATION_IDS or the route registry; verifier constants
   (500 ms, 75/150 ms, 30 s, 900 s token, HMAC domain), sweep constants (60 s, batch 25/100, lease 300 s, 15 s deadline, ladder 15/60/300, 3 attempts), denial helper (byte-identical JSON).
SPEC DECISIONS TO RATIFY (implementation-level, needed so lane 3 SQL matches):
 (1) CMS-03B-20 execute argument `expected_version` is the claim-produced `scheduleVersion` (the schedule-row CAS operand); the approved-review version is read from the schedule row.
     BE03b:179 does not say which of the two; lane-0 nit 2b. ExecuteScheduleRequest documents it.
 (2) ScheduleExecutionResult.outcome gains `cancelled` (BE03b Schedule execution cancels with entry_unavailable and the error-matrix text names the executor's "cancelled outcome";
     its Zod lists only four). Superset: a four-outcome RPC reply still parses.
 (3) `unavailable` PreflightResult reasonCode vocabulary is unregistered for non-accessibility providers (only checker_failed exists); contract accepts any lowercase token for unavailable.

### CP4 (item J1/J2 + route rows): refusal catalog, events, settings registry E7, 18-row editorial route registry
New: refusals.ts (+9), events.ts (+6), settings-registry.ts (+4), route-slo.ts, routes-review-publication.ts (9 rows), routes-slice11.test.ts (34). RED observed each (9/9, 10/10, "no tests"
 on missing rows), then GREEN. Edited: route-policy-base/-contract/-errors/-ts, routes-errors.ts, routes.ts (SLO consts moved to route-slo.ts; two additive fields `gate` and `stepUp` on the nine Slice 10 rows).
 - Registry now 18 operations: CMS_EDITORIAL_OPERATION_IDS appends 05,06,07,08,09,15,16,17,18 after the Slice 10 nine (positional S10 tests untouched).
 - New route fields: gate capability|rpc_scope (rpc_scope = RPC resolves reviewer-assignee/submitter/receipt-owner scope; no coarse Worker gate), stepUp required|none (=401 STEP_UP_REQUIRED present iff required),
   outcome accepted(202)|updated(200), additionalSuccessStatuses [200] for CMS-03B-18, location on_create, 5 new rate classes (cms-review-write 05/06 30-60, cms-review-assignment 18 10-20,
   cms-schedule-write 20-40, cms-preview-write 60-120, cms-publish-write 20-40; reads reuse cms-entry-read 300-600), reasonCodes per op from CMS_SLICE_11_OPERATION_REASONS.
 - assertCmsEditorialRouteRegistry now also fails closed on: step-up/error disagreement, capability gate with no capability, command without CSRF+key, safe read with a mutation guard/step-up/event.
 - cmsEditorialRouteAdmitsPrincipal(route, granted) = the Worker's coarse admission helper.
 - CMS-03B-17 errors: no 403/404 (BE03b "not applicable to a scoped list") but cursor 409; 15/16: bounded read codes (no CONFLICT); 06/07/09/18: command codes + STEP_UP_REQUIRED 401.
 - Event envelope pins (decision for lanes 3/4): producer `cms.editorial` (cms.entry. prefix exists in outbox_event_producers; `cms.publication.` prefix must be REGISTERED by a forward migration -> lane 3),
   aggregateType cms_editorial_review (aggregateVersion = review version; assignment change leaves it unchanged) and cms_publication (aggregateId = lineage publication_id, aggregateVersion = lineage sequence),
   cms_entry for the two Slice 10 events.
CONCURRENT SPEC RULINGS APPLIED (orchestrator DEC-156..158, seen in the worktree .memory diff): ScheduleExecutionResult keeps FOUR outcomes (my earlier `cancelled` superset REMOVED, RED then GREEN);
 assignment reason = 1-256 code points + NFC (already implemented identically); only `healthy` satisfies category 11; projectionState `pending` in Slice 11.
 Dropped spec decision (2) from CP3. Still open: (1) execute `expected_version` = claim-produced scheduleVersion (documented in ExecuteScheduleRequest), (3) unavailable reason vocabulary.
S10 TEST CASCADE (DEC-148, assertions kept, only the row-count scope changed; titles UNCHANGED so S10 ledger citations still resolve; S10 receipts for these two files go stale -> orchestrator re-collect):
 - packages/contracts/src/cms-editorial/routes.test.ts: nine-operation list now asserted over registry.slice(0,9); 'non-member id' fixture CMS-03B-07 -> CMS-03B-99 (07 is now a member);
   command/read row counts (4/5) taken over the nine Slice 10 rows.
 - packages/contracts/src/cms-editorial/supplemental-routes.test.ts: expectedOrder asserted over registry.slice(0,9).
 All 28 cms-editorial files / 496 tests green; all packages/contracts/src 120 files / 1629 tests green before the DEC-158 edit.

### CP5 (item K): platform registry rows, OpenAPI definitions, generated openapi.json, runbook, cascade tests
New: tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts (10; RED 8 failed|2 passed, then GREEN), docs/runbooks/platform/cms-publication.md.
Edited: packages/contracts/src/{platform-registries,openapi,registry-primitives}.ts (9 rows right after CMS-03B-14; 9 ApiRequest + 8 resource schemas registered; runbook path added to the closed runbook enum),
 infra/openapi-definitions.mjs (9 route definitions + editorialStepUpErrors/editorialBoundedReadErrors helpers + `unversioned` header kind), infra/openapi-document.mjs (`unversioned` header kind), docs/openapi/openapi.json (regenerated).
 - docs/openapi/openapi.json: verified by script that every pre-existing path and component is byte-for-byte unchanged; only 9 paths and 17 components added (document 44,094 -> 52,715 lines). `pnpm contracts:check` = 0.
 - CMS-03B-19/20 absent from registry, paths and components (test asserts no PreviewVerification*, ClaimedSchedule, ExecuteScheduleRequest, ScheduleExecutionResult, PreflightEvidence component).
 - Parity test compares every platformRegistrySet row with cmsEditorialRoutePolicies (method, path, authClass, stepUp, csrf, idempotency, ifMatch, rate, timeout, tier, success schema) and the OpenAPI
   statuses/headers (ETag, Location only where policy says; 401 step-up union only on the four step-up routes; revoke 200 has ETag but no Location).
S10/S09 TEST CASCADE (additions only, assertions kept): packages/contracts/src/core-contracts.test.ts (component list +17 names), packages/contracts/src/registries.test.ts (route id list +9 ids).
 tests/contracts/phase-02-slice-10-evidence-guard.test.ts is RED with 12 stale-receipt problems, ALL from my edits to routes.test.ts and supplemental-routes.test.ts (receipt hash binds the file): orchestrator must re-collect
 receipts (node scripts/evidence/run-slice-evidence.mjs --slice 10). core-contracts/registries tests may also be hash-cited by S09.
Gates so far: packages/contracts + tests/contracts vitest all green except the stale-receipt guard; `pnpm type-check` = 0 errors (no Worker/web exhaustive map broke); eslint packages/contracts infra = 0;
 prettier --write applied to every touched file (zsh does not word-split $VAR: use xargs).

### CP6 (item J3): tz pin (DEC-153) + shared Time authority (BE03b E8)
PINNED: CMS_TZDB_VERSION = 2026e (newest stable IANA release on 2026-10-08; 2026e dated 2026-09-29, tarballs published 2026-09-30).
 CMS_TZDB_SHA256 = 862c1656e10ab81c18359393473448dcd2540d4254fa5b2c432a2989cac81c3b (SHA-256 of the exact snapshot text). tzdata2026e.tar.gz sha256 b26882805f26aac59d5b222978e6580484b834ccdc98be89df2f05a6dc53a652,
 tzcode2026e.tar.gz sha256 cc3d27ca2a0d8399504551b920970d80af83bfb9c216e8082a15491921935d54. Recorded as raw decision `dec-153-pin` (title "DEC-153 (pin recorded): ...", canonicalId DEC-153) and compiled into wiki/decisions.md.
 Generation: `node infra/generate-tzdb-snapshot.mjs --download` (`--check` = drift guard). A fresh download regenerates the identical snapshot (verified `--download --check`).
New files: infra/generate-tzdb-snapshot.mjs; packages/contracts/src/cms-editorial/time-authority/{tzdb-pin,tzdb-snapshot-data(generated, 218 KB / 26 KB gz),tzdb-snapshot,tzdb-zone,posix-footer,local-datetime,schedule-time,time-authority,index}.ts
 + tests (local-datetime 7, posix-footer 10, tzdb-snapshot 3, tzdb-zone 12 incl. Morocco 2026e, tzdb-differential 40, schedule-time 17, time-authority 6) and tests/contracts/phase-02-slice-11-tzdb-pin.test.ts (4). RED observed per module, GREEN.
 - E8 steps 1-8 implemented as one pure function `resolveScheduleTime(zoneOf, pinnedVersion, input, nowMs)` (refusals carry the RFC 6901 pointer and CmsEditorialRefusalDetails that satisfy the refusal catalog; exact nanosecond
   equality for resolvedUtc; BigInt horizon bounds, both inclusive; gap alternatives measured by the gap length; ambiguous alternatives earlier then later). `cmsScheduleOffsetPlausible` = the RPC's -12h/+14h sanity bound.
 - Footers use only fixed-offset and Mm.w.d[/time] rules (parser refuses anything else); times may be negative or >24 h (Greenland, Gaza-style) and the Dublin negative-DST wrap is handled. Far future (2090) verified.
 - INDEPENDENT ORACLE: 39 zones x every offset change and weekly samples 2000-2040 agree with host ICU (Intl); Africa/Casablanca compared only to 2026-09-19 because 2026e moves Morocco to permanent +00 on 2026-09-20 (host ICU is 2026a).
 - Import split: the light pin + `resolveScheduleTime` are exported from the main barrel; the 218 KB snapshot and `createTimeAuthority`/`loadPinnedTimeAuthority`/`TzdbIntegrityError` live ONLY behind the new subpath
   `@wejammin/contracts/time-authority` (packages/contracts/package.json export + vitest alias) so web can lazy-load it (26 KB gz vs the 80 KB lazy-chunk budget) and the Worker verifies the hash at module load.
 - Root-config edit (needed for the new subpath): vitest.config.ts alias `@wejammin/contracts/time-authority`.
