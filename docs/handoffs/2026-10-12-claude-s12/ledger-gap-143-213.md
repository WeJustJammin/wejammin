# Slice 12 evidence ledger gap report, criteria P2-S12-AC-143 .. AC-213 (lane C)

- Worktree: /home/rob/.codex/worktrees/phase2-slice12/WeJammin, branch claude/phase2-slice12, HEAD ddda7d58c4a2af8e593f36e6e4ef16fe97017c74 (read-only audit; no tests were run).
- Ledger fragment: tests/contracts/phase-02-slice-12-evidence-ledger-143-213.ts (71 entries, `text` untouched).
- Method: every cited title was resolved programmatically from the test source (vitest/Playwright title paths, whitespace-collapsed pgTAP descriptions), and each is unique in its file.
- A clause is cited only where the cited assertions produce and check its condition. Uncited clauses and the reason are listed per criterion.

Summary: 2 verified, 12 partial, 57 unverified (of 71).

Verified: P2-S12-AC-160, P2-S12-AC-163.

### P2-S12-AC-143 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: no CMS-03C-19 claim/execute RPC, governed activation schedule table, lease logic or Worker sweep exists, so there is no behavior to test yet.
- Implementation: appears missing (searched cms_claim_due_governed_activations, cms_execute_governed_activation, governed_activation, cms.governed_activation.execute and cms_governed_activation_schedules under supabase/, apps/, packages/, infra/; the nearest model is the Slice 11 publication-schedule claim/execute: supabase/migrations/20261005017730_cms_claim_due_publication_schedules.sql and apps/worker/src/cms-publication-schedule-sweep.test.ts)
- Missing evidence: pgTAP supabase/tests/phase_02_slice_12_governed_activation_claim.sql plus a race runner: the claim returns only due pending/failed_retryable rows (not-due, executing and completed rows untouched); execute with a stale lease_id is refused and the schedule, subject, audit and outbox fingerprint is unchanged; execution re-reads the review (approved at the stored expected_version), the subject (scheduled, equal hash), policy basis, dependencies and canonical providers and blocks with the closed reasonCode when any differs; a revoked or ended designer/curator grant of the schedule creator blocks with activation_authority_ended.
- Size: L (includes the RPCs; tests alone M)

### P2-S12-AC-144 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: the CMS-03C-19 RPCs, their EXECUTE grants and the registered scheduled-sweep principal do not exist yet.
- Implementation: same as AC-143 (identical search and findings).
- Missing evidence: pgTAP: has_function_privilege is false for PUBLIC, anon, authenticated and every role except the registered Worker scheduled principal on both RPCs (add both names to the exact-set guard in supabase/tests/phase_02_slice_09_r8_api_surface.sql); authority re-derivation blocks on a revocation or a grant end before the fire instant and does NOT block on a stale MFA (DEC-120: a creator with mfaFresh=false still executes); claim output keys are identifiers, versions and correlation data only.
- Size: M (plus the RPCs)

### P2-S12-AC-145 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: no governed-activation sweep (cron, batch 25, SKIP LOCKED claim, lease, retry ladder) exists to test.
- Implementation: same as AC-143 (identical search and findings).
- Missing evidence: Vitest apps/worker/src/cms-governed-activation-sweep.test.ts (model cms-publication-schedule-sweep.test.ts): scheduled handler runs every minute with batch 25; pgTAP + two-claimer race runner: FOR UPDATE SKIP LOCKED claims each row once, version CAS pending/failed_retryable -> executing with a five-minute lease_id/lease_until; retry ladder: attempt_count+1 and next_attempt_at now+15 s, 60 s, 300 s for failures 1-3 and a fourth consecutive retryable failure blocks with retries_exhausted.
- Size: L

### P2-S12-AC-146 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: lease-expiry return, already_completed replay, terminal reasonCode blocking, review-invalidation cancel and late-run deviation_seconds have no implementation.
- Implementation: same as AC-143 (identical search and findings).
- Missing evidence: pgTAP: an expired executing lease returns to failed_retryable with attempt_count+1 before the claim; a repeated execution of a completed schedule returns already_completed with no effect; each closed reasonCode (approval_invalidated, dependency_changed, activation_authority_ended, canonical_source_unavailable, retries_exhausted) blocks the schedule, makes the subject blocked and leaves the prior active version intact; an invalidated review cancels the schedule (cancelled, approval_invalidated) and returns the subject to draft; a late run executes and records deviation_seconds.
- Size: L

### P2-S12-AC-147 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: there is no governed activate-switch execution, atomic event/audit/schedule commit, or browser-route absence check to test.
- Implementation: same as AC-143 (identical search and findings).
- Missing evidence: pgTAP: executing a due schedule performs the activate switch, completes the schedule with actual_at_utc and deviation_seconds and commits one activation event, the audit record and the schedule CAS atomically (forced failure leaves none); contract test that neither RPC name appears in platformRegistrySet.routes, the browser route inventory or docs/openapi/openapi.json (model apps/worker/src/cms-editorial-principals.test.ts).
- Size: L

### P2-S12-AC-148 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: platform_private.cms_resolve_locale_field and the LocaleFieldResolution contract do not exist.
- Implementation: appears missing (searched cms_resolve_locale_field, LocaleFieldResolution, resolvedFromLocale, fallbackChains resolution; only the per-variant no_fallback declaration exists: supabase/migrations/20260927440000_cms_locale_author_rpc.sql, packages/contracts/src/cms-composition/locale-variant.ts)
- Missing evidence: Contract vitest packages/contracts/src/cms-composition/locale-resolution.test.ts (strictObject key set fieldId, locale, mode, outcome, provenance, resolvedFromLocale, stale, blocking, reasonCode and each enum) plus pgTAP supabase/tests/phase_02_slice_12_locale_resolver.sql asserting the RPC signature and the exact returned key set for each mode/outcome/provenance combination.
- Size: L (includes the resolver; tests alone M)

### P2-S12-AC-149 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: no resolver exists, so mode none/localized/no_fallback resolution, the fallback-chain walk and resolvedFromLocale are untested.
- Implementation: same as AC-148 (identical search and findings).
- Missing evidence: pgTAP: mode none returns the source-locale value; localized returns the target locale own revision field when present, else the first locale of the active version fallbackChains[locale] (ordered, at most 16, ending at the default locale) that has a value with resolvedFromLocale and provenance localized_fallback; no_fallback never walks the chain (outcome missing, blocking); stale fallback keeps serving the last approved translation (DEC-121).
- Size: M (after the resolver)

### P2-S12-AC-150 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: the resolver, its restricted EXECUTE grants and its absence from the browser inventory cannot be tested yet.
- Implementation: same as AC-148 (identical search and findings).
- Missing evidence: pgTAP: EXECUTE revoked from PUBLIC/anon/authenticated and every role except the registered non-browser callers; the result carries identifiers, enums and booleans only (no locale text key, asserted by key set); contract test that the RPC is absent from platformRegistrySet.routes and buildOpenApiDocument().
- Size: M (after the resolver)

### P2-S12-AC-151 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: determinism and read-only behavior cannot be tested without the resolver.
- Implementation: same as AC-148 (identical search and findings).
- Missing evidence: pgTAP: two calls with identical inputs return identical output; table fingerprint, audit_events and outbox counts are unchanged around the call; catalog volatility is stable (not volatile with writes).
- Size: S (after the resolver)

### P2-S12-AC-152 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: neither the 03b locale preflight provider call, the Shard 04 delivery projection nor CmsLocaleVariantForm consume a resolver.
- Implementation: same as AC-148 (identical search and findings).
- Missing evidence: pgTAP that the 03b publication preflight locale provider returns the same outcome as the resolver for each localizationMode and fallback walk; vitest that CmsLocaleVariantForm per-field resolution calls the same RPC result; delivery projection (Shard 04, not in this slice) adds no rule of its own.
- Size: M-L (Shard 04 dependency)

### P2-S12-AC-153 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: platform_private.cms_related_content_public_targets and the RelatedPublicTarget contract do not exist.
- Implementation: appears missing (searched cms_related_content_public_targets, RelatedPublicTarget; only the CMS-03C-05 pin/exclusion authoring exists: apps/worker/src/cms-composition/related-content-routes.ts, supabase/migrations/20260927310000_cms_locale_related_authority.sql)
- Missing evidence: Contract vitest for the strict RelatedPublicTarget (entryId, source pin|derived, nullable reasonCode, position 0-127, array <=128) and pgTAP supabase/tests/phase_02_slice_12_related_public_targets.sql for the RPC signature/shape; contract test that it has no browser route and is absent from the route inventory and OpenAPI.
- Size: L (includes the RPC; tests alone M)

### P2-S12-AC-154 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: ordering, public eligibility and exclusion/refill rules have no implementation.
- Implementation: same as AC-153 (identical search and findings).
- Missing evidence: pgTAP: eligible pins first in position order (lineage head is an active publish row for (locale, audience), no hold), then derived candidates in rank order; exclusions always removed; a vacated slot refilled only from eligible derived candidates.
- Size: M (after the RPC)

### P2-S12-AC-155 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: the RPC, its restricted callers and its draft/hidden/other-owner filtering cannot be tested yet.
- Implementation: same as AC-153 (identical search and findings).
- Missing evidence: pgTAP: EXECUTE only for the registered non-browser callers; never returns a draft, hidden, unpublished or other-owner target; a recommendation never grants access (a derived candidate the caller cannot see is absent).
- Size: M (after the RPC)

### P2-S12-AC-156 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: bound, statelessness and read-only behavior cannot be tested without the RPC.
- Implementation: same as AC-153 (identical search and findings).
- Missing evidence: pgTAP: 129+ candidates return exactly 128; no table stores the result; table fingerprint, audit and outbox counts unchanged; each projection, preview and publication call recomputes.
- Size: S (after the RPC)

### P2-S12-AC-157 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: disappearance of an unpublished target while the editorial explanation stays private cannot be tested without the RPC.
- Implementation: same as AC-153 (identical search and findings).
- Missing evidence: pgTAP: unpublish/hold a pinned target, call again -> target absent from the output while the relationship row and its explanation stay unchanged and are not returned.
- Size: S (after the RPC)

### P2-S12-AC-158 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: neither consumer (Shard 04 delivery projection, Slice 11 related-content recheck) calls a public-targets RPC.
- Implementation: same as AC-153 (identical search and findings).
- Missing evidence: pgTAP/vitest for pins-first ordering, deterministic shared-terms and same-type-recent ranking and tie-breaks, the 128 bound, refill rule and recomputation per projection; contract test for absence from browser routes and OpenAPI; recheck consumer uses the RPC instead of its own eligibility.
- Size: M-L (Shard 04 dependency)

### P2-S12-AC-159 — partial
- Unproven clause(s): "owned active compiled content-type selectors (`id`, `typeKey`, `activeVersionId`, `activeVersion`, `sourceLocale`)" | "at most 128 owned registered, currently supported block selectors (`blockKey`, `blockVersion`)" | "the discovered Hono route match the registry row."
- Why: Uncited: (1) 'owned active compiled content-type selectors' - no test asserts owner scoping, active-version-only or compiled-artifact-only selection (the pgTAP only checks that one fixture type is returned); (2) 'at most 128 owned registered, currently supported block selectors' - the 128 bound is not tested (only 64 content types are) and no test excludes other-owner or non-supported blocks; (3) 'the discovered Hono route match the registry row' - no test compares the mounted Hono route to the registry row.
- Implementation: present at apps/worker/src/cms-composition/template-context-routes.ts:31-197, packages/contracts/src/cms-composition/template.ts:32-48, supabase/migrations/20260927320000_cms_template_designer_context.sql:5-107, packages/contracts/src/platform-registries.ts:1733-1756
- Missing evidence: pgTAP in supabase/tests/phase_02_slice_12_template_context.sql: two owners with types and blocks, an inactive type, a type version without a compiled artifact, a deprecated and a withdrawn block, 65 types and 129 blocks; assert only the caller's active compiled types and supported blocks come back, capped at 64 and 128 in (key, version) order. Contract vitest: TemplateDesignerContextSchema rejects 129 registeredBlocks. Worker vitest comparing createCmsTemplateApp().routes (method, path) to platformRegistrySet for both reads (model apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts:150).
- Size: M

### P2-S12-AC-161 — partial
- Unproven clause(s): "rechecks the actor, acting party, confirmed membership and current designer grant on every read" | "never reserves permission for a later write."
- Why: Uncited: (1) 'rechecks the actor, acting party, confirmed membership and current designer grant on every read' - only the grant revocation is asserted against cms_template_context (an acting party the actor is not a confirmed member of, an absent actor and an ended or pending membership are not tested against the RPC; the membership predicate is tested on the helper only); (2) 'never reserves permission for a later write' - no test asserts that a context read stores or mints nothing.
- Implementation: present at supabase/migrations/20260927320000_cms_template_designer_context.sql:17-30 and supabase/migrations/20260927200000_cms_template_authority.sql:228-262 (cms_template_designer_authorized), apps/worker/src/cms-composition/template-context-routes.ts:79-84
- Missing evidence: pgTAP in supabase/tests/phase_02_slice_12_template_context.sql: (a) context call whose actingPartyId the actor is not a confirmed member of -> FORBIDDEN, no actor claims -> UNAUTHENTICATED, membership ended/not yet started -> FORBIDDEN; (b) fingerprint of audit_events, outbox_events, idempotency_records and cms_template_versions identical before/after a successful context read.
- Size: S

### P2-S12-AC-162 — partial
- Unproven clause(s): "enforces read buckets of 60/min/user and 60/min/party" | "the Tier 2 target."
- Why: Uncited: (1) 'enforces read buckets of 60/min/user and 60/min/party' - no context-route test asserts that both the user and the party bucket are consulted with limit 60 and window 60 s (only the 429 header limit and a rejected wrong limit are checked; the detail route has the scope assertion, the context route does not); (2) 'the Tier 2 target' - no latency or SLO evidence.
- Implementation: present at apps/worker/src/cms-composition/template-context-routes.ts:86-130, packages/contracts/src/platform-registries.ts:1733-1756 (rateLimit 60, partyRateLimit 60, sloTier tier_2 via contentSchemaRegistryRouteDefaults)
- Missing evidence: Vitest in apps/worker/src/cms-composition/template-context-routes.test.ts mirroring the detail route 'uses the existing read-rate class for both actor and party': capture rateLimit inputs and assert user and party scopes, limit 60, windowSeconds 60, rateClass cms-template-read, and that a party-only denial is a 429. Tier 2: assert sloTier/slo values of the two GET rows in tests/contracts/phase-02-slice-12-template-openapi.test.ts and record a measured p95 in the Slice 12 performance evidence.
- Size: S for buckets; M for the Tier 2 measurement

### P2-S12-AC-164 — partial
- Unproven clause(s): "`CmsPatternVersionDesigner`" | "disable submission with the corresponding sign-in, capability, rate-wait or retry state when the context is missing, denied or degraded" | "neither extend the general auth-session resource nor grant designer authority in the browser" | "verification covers each denied or degraded state and that the POST revalidates authority."
- Why: Uncited: (1) '`CmsPatternVersionDesigner`' - that consumer does not exist; (2) 'disable submission with the corresponding sign-in, capability, rate-wait or retry state when the context is missing, denied or degraded' - only the no-types/no-CSRF disabled state and the degraded fail-closed page are behavior-tested; the 401 sign-in redirect, 403 capability copy and 429 rate-wait of the context load are asserted only as source substrings in template-designer-route.test.ts; (3) 'neither extend the general auth-session resource nor grant designer authority in the browser' - no test; (4) 'verification covers each denied or degraded state and that the POST revalidates authority' - the per-state verification does not exist.
- Implementation: partly present: apps/web/src/pages/app/cms-content-modeling/templates/new.astro, [templateKey].astro, apps/web/src/components/cms-composition/CmsTemplateDesigner.tsx, CmsTemplateEditDesigner.tsx; CmsPatternVersionDesigner does not exist (searched apps/web)
- Missing evidence: Playwright (chrome project, fixture ports) tests/e2e/phase-02-slice-12-template-states.spec.ts driving /app/cms-content-modeling/templates/new and /templates/<key> with the context GET answered 401 (303 to sign-in with returnTo), 403 (capability copy, no form), 429 with Retry-After (rate-wait copy, header, no form), 503 (reload link, no form) and 200 (form enabled); vitest that the auth-session resource schema carries no designer capability; the CmsPatternVersionDesigner part waits for the CMS-03C-12 FE (AC-124..129).
- Size: M (states) + L (pattern designer, separate criteria)

### P2-S12-AC-165 — partial
- Unproven clause(s): "the discovered Hono route match the registry row."
- Why: Uncited: 'the discovered Hono route match the registry row' - no route-discovery parity test for GET /api/v1/cms/templates/{templateKey} (the OpenAPI/registry half is tested). The 'caller owner's latest version' scoping is only proven for a single owner; cross-owner scoping is the open item of AC-166/AC-167.
- Implementation: present at apps/worker/src/cms-composition/template-detail-routes.ts:35-217, packages/contracts/src/cms-composition/template-detail.ts, supabase/migrations/20260927330000_cms_template_latest_detail.sql, packages/contracts/src/platform-registries.ts:1830-1852
- Missing evidence: Worker vitest comparing the mounted Hono routes of createCmsTemplateApp() (and the production worker app) to platformRegistrySet rows and generated OpenAPI paths for cmsTemplateLatestRead (method, path, operationId); same test file as AC-159.
- Size: S

### P2-S12-AC-166 — partial
- Unproven clause(s): "is not a reserved key (`context`, `versions`, `new`)" | "resolves it only within the caller's owner scope" | "answers a hidden or absent key with the same 404."
- Why: Uncited: (1) 'is not a reserved key (`context`, `versions`, `new`)' - E13 is not built: CmsTemplateKeySchema accepts all three; (2) 'resolves it only within the caller's owner scope' - no cross-owner test exists; (3) 'answers a hidden or absent key with the same 404' - only the absent key is tested (pgTAP NOT_FOUND for missing and unknown keys, route and adapter 404 mapping); no test reads a key held by another owner.
- Implementation: partly present: grammar and absent-key 404 at apps/worker/src/cms-composition/template-detail-routes.ts:84-88 and supabase/migrations/20260927330000_cms_template_latest_detail.sql:29-45 (owner-scoped query); reserved-key rule missing (packages/contracts/src/cms-composition/template.ts CmsTemplateKeySchema is a regex only)
- Missing evidence: (a) contracts vitest: CmsTemplateKeySchema rejects context, versions, new with issue key_reserved (E13, AC-189); (b) pgTAP in supabase/tests/phase_02_slice_12_template_detail.sql: a second organization with the designer grant reads owner A's key and gets NOT_FOUND byte-identical to an unused key, and the reverse; (c) real-stack apispec tests/postgrest/phase-02-slice-12-template-latest.apispec.ts: identical 404 TEMPLATE_NOT_FOUND bodies for other-owner and unused keys through Worker -> PostgREST -> DB.
- Size: M

### P2-S12-AC-167 — partial
- Unproven clause(s): "in the caller's owner scope" | "resolves the key only within that scope so that a key held by another owner is the same 404 as an unused key"
- Why: Uncited: (1) "in the caller's owner scope" and (2) 'resolves the key only within that scope so that a key held by another owner is the same 404 as an unused key' - there is no cross-owner test at any layer (the owner_id predicate in the RPC query is unexercised).
- Implementation: present at supabase/migrations/20260927330000_cms_template_latest_detail.sql:29-45 (owner_id = acting_party_id predicate) and apps/worker/src/cms-composition/template-detail-routes.ts:90-97; unexercised across owners
- Missing evidence: Cross-owner pgTAP and real-stack apispec as for AC-166 (b)/(c): owner B holds the designer grant and the same template key, owner A holds a draft; B reads -> NOT_FOUND identical to an unused key; A reads -> its own definition; assert no 403 vs 404 difference leaks existence.
- Size: S

### P2-S12-AC-168 — partial
- Unproven clause(s): "enforces read buckets of 60/min/user and 60/min/party" | "the Tier 2 target."
- Why: Uncited: (1) 'enforces read buckets of 60/min/user and 60/min/party' - the user and party scopes and the 60 limit are asserted, but the 60-second window is passed by the route (windowSeconds 60) and never asserted, so '/min' is unproven; (2) 'the Tier 2 target' - no latency or SLO evidence.
- Implementation: present at apps/worker/src/cms-composition/template-detail-routes.ts:99-148 (buckets), 172-176 (no-store, ETag), 180-189 (deadline); packages/contracts/src/platform-registries.ts:1830-1852
- Missing evidence: Extend 'uses the existing read-rate class for both actor and party' (apps/worker/src/cms-composition/template-detail-routes.test.ts) to assert windowSeconds 60 and limit 60 for each of the user and party calls; Tier 2: assert the registry sloTier/slo of the GET row and record a measured p95 (see AC-162).
- Size: S (window) + M (Tier 2 measurement)

### P2-S12-AC-169 — partial
- Unproven clause(s): "a missing capability (403 `TEMPLATE_FORBIDDEN`)" | "a hidden or absent key (404 `TEMPLATE_NOT_FOUND`)" | "a dependency failure (502/503/504 `DEPENDENCY_UNAVAILABLE`)" | "to typed ApiError of catalog `cms.03c.template.v1`" | "as a safe read retries at most three times at 15 s, 60 s and 300 s with jitter."
- Why: Uncited: (1) 'a missing capability (403 `TEMPLATE_FORBIDDEN`)' and (2) 'a hidden or absent key (404 `TEMPLATE_NOT_FOUND`)' - the read-route tests assert the status only, never the catalog code (the codes are asserted only on the POST route); (3) 'a dependency failure (502/503/504 `DEPENDENCY_UNAVAILABLE`)' - the implementation maps 502 to DEPENDENCY_INVALID_RESPONSE and 504 to DEPENDENCY_DEADLINE_EXCEEDED (apps/worker/src/cms-composition/template-shared.ts:108-121), contradicting the clause (spec/code drift to resolve); (4) 'to typed ApiError of catalog `cms.03c.template.v1`' - no such catalog id exists in code; (5) 'as a safe read retries at most three times at 15 s, 60 s and 300 s with jitter' - no client retry ladder exists.
- Implementation: partly present: status mapping at apps/worker/src/cms-composition/template-shared.ts:108-121 and template-respond.ts:24-146; catalog id cms.03c.template.v1 and the jittered retry ladder missing (searched cms.03c, jitter in apps/ and packages/)
- Missing evidence: Decide whether the spec or ERROR_CODES wins for 502/504 (record as a DEC). Then vitest on the detail route asserting status AND code for 400, 401, 403, 404, 415, 429, 502, 503, 504, 500; a contract test declaring catalog cms.03c.template.v1 in the platform error catalog; web vitest for a 15 s/60 s/300 s jittered retry ladder capped at three on 502/503/504 using fake timers (apps/web/src/components/cms-composition/cms-template-edit-reconcile.ts).
- Size: M

### P2-S12-AC-170 — partial
- Unproven clause(s): "never resolves `context`, `versions` or `new` as a template key" | "verification covers the prefill, the successor `expectedVersion`, the 409 reconciliation and the 403/404 split."
- Why: Uncited: (1) 'never resolves `context`, `versions` or `new` as a template key' - E13 reserved keys are not built (the edit page accepts any grammar-valid key); (2) 'verification covers the prefill, the successor `expectedVersion`, the 409 reconciliation and the 403/404 split' - the prefill, expectedVersion and 409 parts are tested, but no test asserts the distinct 403 vs 404 outcome of the edit page.
- Implementation: present at apps/web/src/pages/app/cms-content-modeling/templates/[templateKey].astro, apps/web/src/components/cms-composition/CmsTemplateEditDesigner.tsx, cms-template-edit-reconcile.ts; reserved-key handling missing
- Missing evidence: Playwright in tests/e2e/phase-02-slice-12-template-edit.spec.ts (chrome, fixture ports): /templates/context and /templates/versions render the not-found page (needs E13/AC-189), and 403 (no capability) vs 404 (absent key) render distinct copy with the same no-store header.
- Size: S-M (depends on AC-189)

### P2-S12-AC-171 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: appears missing (searched cmsPatternLatestRead, PatternLatestQuery, PatternVersionDetail, /api/v1/cms/patterns in packages/contracts, apps/worker, apps/web, infra/openapi-definitions.mjs; no pattern-definition route or RPC exists, only CMS-03C-02 instance placement)
- Missing evidence: Contract + OpenAPI tests (model tests/contracts/phase-02-slice-12-template-openapi.test.ts) for GET /api/v1/cms/patterns/{patternKey}: registry row, PatternLatestQuery path schema, strict PatternVersionDetail (PatternVersionResource plus blockTree of 1-32 root nodes, no owner or authority field), generated OpenAPI and the discovered Hono route.
- Size: L (includes route, RPC and contracts)

### P2-S12-AC-172 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-171 (identical search and findings).
- Missing evidence: Worker route tests and pgTAP: patternKey grammar, reserved keys context|versions|selector|new -> 400, owner-scoped resolution, body/Idempotency-Key/If-Match rejected, hidden key == absent key 404 (cross-owner case).
- Size: M (after the route)

### P2-S12-AC-173 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-171 (identical search and findings).
- Missing evidence: pgTAP + route tests: cms.template_designer required (403), cross-owner key is the same 404 as an unused key, no owner or authority field serialized.
- Size: M (after the route)

### P2-S12-AC-174 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-171 (identical search and findings).
- Missing evidence: Route tests: no-store, strong ETag "{version}", read buckets 60/min/user and 60/min/party (both scopes asserted), 15,000 ms deadline; Tier 2 evidence.
- Size: M (after the route)

### P2-S12-AC-175 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-171 (identical search and findings).
- Missing evidence: Route tests asserting status and code for 400, 401, 403, 404, 415, 429, 502/503/504 and 500 against catalog cms.03c.composition.v1 (resolve the DEPENDENCY_UNAVAILABLE vs INVALID_RESPONSE/DEADLINE drift first, see AC-169).
- Size: M (after the route)

### P2-S12-AC-176 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-171 (identical search and findings).
- Missing evidence: Web vitest + Playwright for CmsPatternVersionDesigner and CmsGovernedReviewPanel at /app/cms-content-modeling/patterns/:patternKey: prefill of the node list, successor expectedVersion, lifecycle display, 40x states (components do not exist).
- Size: L

### P2-S12-AC-177 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: appears missing (searched cmsTaxonomyVersionsRead, TaxonomyVersionsPage, TaxonomyVersionsQuery, /taxonomies/{taxonomyId}/versions; the only taxonomy route is POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions: packages/contracts/src/platform-registries.ts:1808, apps/worker/src/cms-composition/taxonomy-routes.ts)
- Missing evidence: Contract + OpenAPI tests for GET /api/v1/cms/taxonomies/{taxonomyId}/versions: registry row, TaxonomyVersionsQuery path schema, strict TaxonomyVersionsPage (<=50 TaxonomyVersionResource newest first, pageVersion), generated OpenAPI and discovered Hono route.
- Size: L (includes route, RPC and contracts)

### P2-S12-AC-178 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-177 (identical search and findings).
- Missing evidence: Route tests + pgTAP: UUID taxonomyId only (any query key -> 400), body/Idempotency-Key/If-Match rejected, hidden vocabulary == absent vocabulary 404.
- Size: M (after the route)

### P2-S12-AC-179 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-177 (identical search and findings).
- Missing evidence: pgTAP + route tests: cms.taxonomy_curator required in the owner scope (403), cross-owner vocabulary 404, no owner or authority field.
- Size: M (after the route)

### P2-S12-AC-180 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-177 (identical search and findings).
- Missing evidence: Route tests: no-store, ETag on the page version, read buckets 60/min/user and 60/min/party, 8,000 ms deadline; Tier 1 p95 < 750 ms measurement.
- Size: M (after the route)

### P2-S12-AC-181 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-177 (identical search and findings).
- Missing evidence: Route tests asserting status and code for 400, 401, 403 TAXONOMY_FORBIDDEN, 404 TAXONOMY_NOT_FOUND, 415, 422, 429, 502/503/504 and 500.
- Size: M (after the route)

### P2-S12-AC-182 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-177 (identical search and findings).
- Missing evidence: Web vitest + Playwright for CmsTaxonomyVersionDesigner and CmsGovernedReviewPanel at /app/cms-content-modeling/taxonomies/:taxonomyId (newest first, <=50, lifecycle, review summary, permitted actions, taxonomy_not_active link); components do not exist.
- Size: L

### P2-S12-AC-183 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: appears missing (searched cmsTaxonomyTermsRead, TaxonomyTermListQuery, TaxonomyTermListPage, GET /taxonomies/{taxonomyId}/terms; the only taxonomy route is POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions: packages/contracts/src/platform-registries.ts:1808)
- Missing evidence: Contract + OpenAPI tests for GET /api/v1/cms/taxonomies/{taxonomyId}/terms: registry row, strict TaxonomyTermListQuery and TaxonomyTermListPage (<=50 TaxonomyTermListItem with termId, termKey, lifecycle, version, parentId, successorId), generated OpenAPI and discovered Hono route.
- Size: L (includes route, RPC and contracts)

### P2-S12-AC-184 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-183 (identical search and findings).
- Missing evidence: Route tests + pgTAP: UUID taxonomyId, optional lifecycle active|deprecated|merged, signed cursor <=512 chars, limit 1-50 (default 25), every other key/body/mutation header rejected, concealment of hidden vocabulary.
- Size: M (after the route)

### P2-S12-AC-185 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-183 (identical search and findings).
- Missing evidence: pgTAP + route tests: cms.taxonomy_curator in the owner scope (403), hidden vocabulary 404, merged terms listed with successorId, no owner or authority field.
- Size: M (after the route)

### P2-S12-AC-186 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-183 (identical search and findings).
- Missing evidence: Route tests: no-store, ETag on the page version, signed cursor bound to query and acting context, read buckets 120/min/user and 240/min/party, 8,000 ms deadline; Tier 1 p95 evidence.
- Size: M (after the route)

### P2-S12-AC-187 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-183 (identical search and findings).
- Missing evidence: Route tests: structurally malformed cursor 400, expired/tampered/foreign-bound cursor 409 (client restarts from page one), status+code mapping for session, capability, concealment, read-limit, dependency and internal failures; 256 KiB response over-limit is 502.
- Size: M (after the route)

### P2-S12-AC-188 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: this operation has no route, RPC or contract yet, so there is nothing to test.
- Implementation: same as AC-183 (identical search and findings).
- Missing evidence: Web vitest + Playwright for CmsTaxonomyTermForm: term list with lifecycle, cursor as URL state without a protected value, merged term survivor redirect, canonical_overlap copy with copyable canonical id and no term creation, taxonomy_not_active link to the governed review; keyset order, cursor binding, merged terms with successor.
- Size: L

### P2-S12-AC-189 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built (E13): neither the contracts schema nor a SQL CHECK rejects the reserved template and pattern keys; CmsTemplateKeySchema accepts context, versions and new.
- Implementation: appears missing (searched key_reserved and reserved-key refinements; packages/contracts/src/cms-composition/template.ts CmsTemplateKeySchema is a regex only, supabase/migrations/20260927200000_cms_template_authority.sql:156 and 20260927290000_cms_composition_authority.sql:53 check the grammar only)
- Missing evidence: Forward migration adding the CHECKs plus the contracts refine; contracts vitest rejecting context|versions|new (template) and context|versions|selector|new (pattern) with issue key_reserved at /templateKey|/patternKey; pgTAP: a direct insert of each reserved key violates the CHECK and cms_define_template answers VALIDATION_FAILED with details.reasonCode key_reserved (route 422 TEMPLATE_VALIDATION_FAILED); a reserved key never resolves in a latest read.
- Size: M

### P2-S12-AC-190 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built (E14): uniqueness is still global per key and cms_define_template looks the previous version up without the owner, so a second owner creating an existing key gets CONFLICT - a live cross-owner existence signal.
- Implementation: appears missing (current constraints: supabase/migrations/20260927200000_cms_template_authority.sql:178 UNIQUE(template_key, version), 20260927290000_cms_composition_authority.sql:63, 20260927260000_cms_taxonomy_authority.sql:29; unscoped lookup at 20260927200000_cms_template_authority.sql:448-452)
- Missing evidence: Forward migration to UNIQUE(owner_id, key, version) for all three; pgTAP: two owners define the same key at version 1 independently, no 409/23505 across owners, every lookup (latest read, parent lookup, selectors) is owner-scoped, other-owner key indistinguishable from an unused key across define, successor and latest; race runner for two owners creating the same key.
- Size: M

### P2-S12-AC-191 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: no template_id/pattern_id/taxonomy_id lineage columns and no partial unique index on the active version of a lineage exist; supersedes_id exists only on templates.
- Implementation: appears missing (searched template_id, pattern_id, taxonomy_id lineage columns and a unique index WHERE state = active under supabase/migrations; supersedes_id exists only at supabase/migrations/20260927200000_cms_template_authority.sql:165 and is tested for templates in supabase/tests/phase_02_slice_12_template_authority.sql)
- Missing evidence: Forward migration + pgTAP: lineage id equals the version-1 id on every successor row for templates, patterns and taxonomies; version unique within a lineage; supersedes_id parent chain for all three kinds; a second active row in one lineage violates the partial unique index; same key under a different owner has a different lineage.
- Size: M

### P2-S12-AC-192 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built (E4): audience still follows the older safe-text rule (1-64 characters excluding <>{}), not the BE04c grammar ^[a-z0-9_-]{1,48}$.
- Implementation: partly present with a different rule (packages/contracts/src/cms-composition/template.ts SafeAudienceSchema 1-64 chars rejecting <>{}; supabase/migrations/20260927200000_cms_template_authority.sql:66-68 octet_length 1..64 and no [<>{}]); the BE04c grammar is not enforced and no CHECK exists on cms_template_versions.audience
- Missing evidence: Contracts vitest: audience Public, " public", "public ", 49 characters and "a b" rejected at /audience, 48 characters accepted (update the existing safe-audience case in packages/contracts/src/cms-composition/template.test.ts); pgTAP: CHECK on cms_template_versions.audience rejects the same values and cms_define_template raises VALIDATION_FAILED; route maps 422 TEMPLATE_VALIDATION_FAILED with a bounded /audience pointer.
- Size: S-M

### P2-S12-AC-193 — partial
- Unproven clause(s): "deduplicated `{blockKey,blockVersion,releaseDigest,propsSchemaHash,rendererRef,lifecycle}` tuples sorted by the UTF-8 bytes of `blockKey` and then numeric `blockVersion`" | "the server recomputes the digest at template create, template activate, pattern create, pattern activate and 03b publication preflight."
- Why: Uncited: (1) 'deduplicated ... tuples sorted by the UTF-8 bytes of `blockKey` and then numeric `blockVersion`' - the SQL digest is tested with zero or one block only (no duplicate reference, no multi-block ordering); the multi-block TypeScript reference apps/worker/src/cms-composition/block-registry-digest.ts has unit tests but no production caller; (2) 'the server recomputes the digest at template create, template activate, pattern create, pattern activate and 03b publication preflight' - only template create exists; activation, pattern create/activate and a registry-recomputing preflight do not.
- Implementation: template-create path present at supabase/migrations/20260927240000_cms_template_digest_supported_lifecycle.sql:6-99 and 20260927200000_cms_template_authority.sql:440-446; TypeScript reference module present but unwired (apps/worker/src/cms-composition/block-registry-digest.ts, no importer outside its test); activate, pattern and registry-recomputing preflight missing
- Missing evidence: pgTAP in supabase/tests/phase_02_slice_12_template_authority.sql: a template with three blocks across two slots, a duplicate reference and two versions of one key (profile.header v2 and v10) - assert the persisted digest equals encode(sha256(JCS of the tuples in UTF-8 byte then numeric order)); a caller digest equal to the server digest is accepted and the stored value is the server's; recompute-at-activate/pattern/preflight tests land with AC-199/200/208/209 and the 03b template provider (supabase/migrations/20261005017570_cms_preflight_evaluation.sql:426-444 compares frozen vs rebuilt manifest hashes).
- Size: M

### P2-S12-AC-194 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not proven as a whole: only the template-create SQL path reads the registry (pgTAP refuses withdrawn, deprecated and renderer-incompatible blocks); missing/duplicate/unreachable blocks, the safe BlockDefinitionRegistryRecord adapter (block-registry-digest.ts has no production caller), the never-mutates guarantee, the lifecycle-event consumer and pattern validation are untested or unbuilt.
- Implementation: partly present (template create: supabase/migrations/20260927240000_cms_template_digest_supported_lifecycle.sql; reference adapter apps/worker/src/cms-composition/block-registry-digest.ts unwired); pattern validation and the cms.block.lifecycle.changed.v1 consumer missing
- Missing evidence: pgTAP: missing block version, duplicate reference and unreachable (not in any slot) block each fail closed before any insert (row/audit/outbox fingerprint unchanged); a deprecated block follows the fixed compatibility policy (decide: SQL refuses with CONFLICT, Slice 11 preflight still passes a deprecated block - supabase/tests/phase_02_slice_11_helpers_preflight.sql); a consumer test for cms.block.lifecycle.changed.v1; catalog assertion that 03c holds no INSERT/UPDATE/DELETE path on cms_block_definition_versions.
- Size: M-L

### P2-S12-AC-195 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not proven as a whole: definition immutability is enforced by guard triggers and tested for patterns ('pattern definition cannot mutate in place') and taxonomies ('taxonomy definition is immutable after creation') but the TemplateVersion guard has no test, activation-immutability is unbuilt, and the governed RPCs CMS-03C-06..09 that are the only lifecycle writers do not exist.
- Implementation: partly present (guards: supabase/migrations/20260927200000_cms_template_authority.sql:190-226, 20260927290000_cms_composition_authority.sql, 20260927260000_cms_taxonomy_authority.sql); governed RPCs missing
- Missing evidence: pgTAP in supabase/tests/phase_02_slice_12_template_authority.sql: every definition column of cms_template_versions (template_key, compatible_type_ids, slots, reserved_regions, bindings, locale, audience, content_hash, block_registry_digest, supersedes_id, created_by) refuses UPDATE while draft; an active version refuses all definition updates; lifecycle columns (state, version, activated_at, retired_at, updated_at) change only inside the governed RPC context for all three kinds.
- Size: M (plus governed RPCs)

### P2-S12-AC-196 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: the five governed review/schedule tables keyed by (subject_kind, subject_id) do not exist.
- Implementation: appears missing (searched cms_governed_reviews, cms_governed_review_decisions/_assignments/_dependencies, cms_governed_activation_schedules, subject_kind, cms_recheck_governed_reviews, cms_invalidate_governed_reviews_for_person, cms.governed_review.recheck under supabase/, apps/, packages/; the subject tables already carry the state enum and write guards: supabase/migrations/20260927200000_cms_template_authority.sql:147-226, 20260927290000_cms_composition_authority.sql:41-65, 20260927260000_cms_taxonomy_authority.sql)
- Missing evidence: pgTAP supabase/tests/phase_02_slice_12_governed_review_tables.sql: the five private tables exist keyed by (subject_kind, subject_id) with subject_kind limited to template_version|pattern_version|taxonomy_version, forced RLS and no API-role grants (extends the AC-181 guard); cms_schema_reviews and the 03b editorial review tables are unchanged (catalog fingerprint).
- Size: L (migration + RPC base shared by AC-196..210)

### P2-S12-AC-197 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: the subject and review state machines are not implemented, so no transition is testable.
- Implementation: same as AC-196 (identical search and findings).
- Missing evidence: pgTAP transition matrix over CMS-03C-06..11: every legal subject transition (draft->review->approved->active|scheduled, scheduled->active|blocked, blocked->active|scheduled, active->superseded|retired) succeeds through the named RPC and every other pair, including from superseded/retired and any direct table write, is refused; rejection/invalidation returns the subject to draft with an audit row while the review stays rejected/invalidated; review machine open->approved|rejected|invalidated and approved->invalidated; assignment create/revoke never changes review state.
- Size: L

### P2-S12-AC-198 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: no governed policy basis resolution (strictest DEC-110 policy, basis array, basis hash) exists.
- Implementation: same as AC-196 (identical search and findings).
- Missing evidence: pgTAP: strictest policy over the bound content types (compatibleTypeIds for template/pattern, allowedTypeKeys within the owner scope for taxonomy), basis sorted by (policyKey, policyVersion, contentTypeId), risk_class protected if any member is, required_decision_count the largest, required_capabilities base cms.reviewer then specialists in first-appearance order (<=16), editorial.default v1 (CMS_GOVERNED_DEFAULT_POLICY) when no type resolves, policy_basis_hash = lowercase SHA-256 of the JCS basis, fail-closed when cms_editorial_workflow_policy_evidence cannot resolve.
- Size: M-L

### P2-S12-AC-199 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: template_version submission (CMS-03C-06) does not exist.
- Implementation: same as AC-196 (identical search and findings).
- Missing evidence: pgTAP: submit requires state draft (409 otherwise), a compatibility-resolver success for the active version of every compatibleTypeIds member and a recomputed blockRegistryDigest equal to the stored one; freezes dependency kinds block (each reachable block record) and content_type (each compatible content type active version id) into cms_governed_review_dependencies.
- Size: M (after the review base)

### P2-S12-AC-200 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: pattern_version submission does not exist (no pattern definition command at all).
- Implementation: same as AC-196 (identical search and findings).
- Missing evidence: pgTAP: submit requires state draft, every nested pattern active, compatible and acyclic and an equal recomputed digest; freezes block, pattern (each nested pattern version) and content_type dependencies.
- Size: M (after CMS-03C-12 and the review base)

### P2-S12-AC-201 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: taxonomy_version submission and the canonical-domain provider registry do not exist.
- Implementation: same as AC-196 (identical search and findings).
- Missing evidence: pgTAP + route test: submit requires state draft and a registered provider for every declared canonical domain (else 422 canonical_source_unavailable with details.domain); freezes content_type (each allowedTypeKeys type) and canonical_domain (provider registry row) dependencies.
- Size: M (after CMS-03C-16 and the review base)

### P2-S12-AC-202 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: no invalidation producers or cms.governed_review.recheck job exist.
- Implementation: same as AC-196 (identical search and findings).
- Missing evidence: Vitest in apps/worker/src for the consumers of cms.block.lifecycle.changed.v1 (withdrawn), cms.schema.activated.v1 and cms.pattern.activated.v1 plus the capability-grant revocation transaction: each enqueues the idempotent job cms.governed_review.recheck (typed platform-queue message, DEC-166) exactly once; pgTAP: live reviews are selected through cms_governed_review_dependencies (review_id, kind, ref_id) for kind block|pattern|content_type|canonical_domain (model Slice 11 apps/worker/src/async-entrypoint-review-recheck.test.ts).
- Size: L

### P2-S12-AC-203 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: cms_recheck_governed_reviews and the recheck job do not exist.
- Implementation: same as AC-196 (identical search and findings).
- Missing evidence: pgTAP + race: cms_recheck_governed_reviews(kind, ref_id, batch) handles at most 500 reviews per run with a continuation cursor, skips an already invalidated review, rebuilds hash/policy basis/identities and invalidates with dependency_changed or reviewer_authority_changed, returns the subject to draft and, while scheduled, cancels the schedule (cancelled, approval_invalidated) in the same transaction; governed review state changes emit no event in Phase 2.
- Size: L

### P2-S12-AC-204 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: cms_invalidate_governed_reviews_for_person and reviewer_authority_changed handling for governed reviews do not exist.
- Implementation: same as AC-196 (identical search and findings).
- Missing evidence: pgTAP: revoking a counted approver's standing capability calls cms_invalidate_governed_reviews_for_person(person_id, capability) in the revoking transaction (definer, not scoped to the revoker's party) and invalidates every open|approved review the person counted on under that capability with reviewer_authority_changed and the subject back to draft; revoking an assignment while the review is open also invalidates; while approved it does not (model supabase/tests/phase_02_slice_11_rpc_review_decision_invalidation.sql).
- Size: M-L

### P2-S12-AC-205 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: governed immediate activation (activate RPC) does not exist.
- Implementation: same as AC-196 (identical search and findings).
- Missing evidence: pgTAP + race: activate requires approved|blocked (else 409 subject_not_activatable); one transaction makes the subject active (version+1, activated_at), supersedes the lineage previous active version (version+1), records activated_at on the review (version advance) and commits the audit record and exactly one activation event; two concurrent activates on one lineage: the loser is 409 activation_conflict with nothing committed.
- Size: L

### P2-S12-AC-206 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: governed scheduled activation (schedule RPC, cms_governed_activation_schedules) does not exist.
- Implementation: same as AC-196 (identical search and findings).
- Missing evidence: pgTAP + route test: schedule resolves activateAt through the 03b Time authority (pinned tz database, DST rules, 60 s to 366 d horizon), runs the kind-specific preflight, makes the subject scheduled and inserts one pending schedule row (a second live schedule for the subject is 409 schedule_exists), answers 202 and emits no event.
- Size: L

### P2-S12-AC-207 — partial
- Unproven clause(s): "Retirement: `retire` requires the subject `active` (else 409 `subject_not_retirable`) and needs no review, makes it `retired`, emits the same event type naming the retired version"
- Why: Uncited: 'Retirement: `retire` requires the subject `active` (else 409 `subject_not_retirable`) and needs no review, makes it `retired`, emits the same event type naming the retired version' - the retire command and its event do not exist. Cited: only the consumer side of an already retired template (resolver WITHDRAWN and preflight template_not_active).
- Implementation: consumer side present (supabase/migrations/20261002132000_cms_template_compatibility_resolver.sql:50, supabase/migrations/20261005017570_cms_preflight_evaluation.sql:426-444); the retire command and its governed event are missing (governed RPCs CMS-03C-06..11 do not exist)
- Missing evidence: pgTAP: retire requires an active subject (409 subject_not_retirable otherwise), needs no review, sets retired and emits exactly one activation event of the same type naming the retired version, for template, pattern and taxonomy; the retired template then fails the resolver as WITHDRAWN and the preflight template provider (end-to-end through the new RPC rather than a fixture state shift).
- Size: M (after the review base)

### P2-S12-AC-208 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: template activation/scheduling (CMS-03C-08/09 for templates) with its pre-switch compatibility and digest recheck does not exist.
- Implementation: same as AC-196 (identical search and findings).
- Missing evidence: pgTAP: activate/schedule of a template_version runs cms_resolve_template_compatibility for every compatibleTypeIds member (a withdrawn or incompatible member blocks) and recomputes blockRegistryDigest before the switch (a lifecycle change between submit and activate yields dependency_changed).
- Size: M (after the activation RPC)

### P2-S12-AC-209 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: pattern activation/scheduling and its nested-pattern state check do not exist.
- Implementation: same as AC-196 (identical search and findings).
- Missing evidence: pgTAP: activate/schedule of a pattern_version checks the state of every nested pattern (a retired or not-active nested pattern blocks) and recomputes the block digest before the switch.
- Size: M (after CMS-03C-12 and the activation RPC)

### P2-S12-AC-210 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: taxonomy activation/scheduling and the canonical-domain provider check do not exist.
- Implementation: same as AC-196 (identical search and findings).
- Missing evidence: pgTAP + route test: activate/schedule of a taxonomy_version requires a registered provider for every declared canonical domain, else 422 canonical_source_unavailable with details.domain, and nothing commits.
- Size: M (after CMS-03C-16 and the activation RPC)

### P2-S12-AC-211 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: the pattern graph validation (depth 8, 512 nodes after expansion, cycles, nested-active/compatible rules) and node_count do not exist.
- Implementation: appears missing (searched pattern_depth_exceeded, pattern_nodes_exceeded, nested_pattern_not_active, pattern_cycle, node_count; only a generic JSON bound exists in supabase/migrations/20260927290000_cms_composition_authority.sql:31 cms_json_bounded(depth 8) and the key grammar cms_pattern_tree_keys_valid)
- Missing evidence: Contracts + pgTAP: forest depth <=8 and <=512 nodes after expanding nested pattern references, unique sibling keys, no cycle through a nested lineage (visited set is pattern_id), every nested pattern active and listing every compatibleTypeIds member; typed 422 pattern_depth_exceeded/pattern_nodes_exceeded/nested_pattern_not_active and 409 pattern_cycle, refused before save and again before publish (03b pattern provider); node_count stores the expanded count.
- Size: L (with CMS-03C-12)

### P2-S12-AC-212 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: the cms.pattern.linked_update_scan consumer job does not exist.
- Implementation: appears missing (searched cms.pattern.linked_update_scan and any pending_diff writer; the pending_diff instance state is declared at supabase/migrations/20260927290000_cms_composition_authority.sql:76 and packages/contracts/src/cms-composition/pattern-instance.ts:68 but nothing produces it and there is no pending_pattern_version column)
- Missing evidence: pgTAP + vitest: on cms.pattern.activated.v1 the consumer (typed platform-queue message { patternId, patternVersionId }, DEC-166) appends a pending_diff row pinned to the unchanged version and carrying pending_pattern_version for each linked instance on a draft revision whose pinned version is older and whose entry type is compatible; instances on reviewed or published revisions stay on their pin as history.
- Size: L

### P2-S12-AC-213 — unverified
- Unproven clause(s): the entire criterion (it is one clause in the ledger entry). Why: Not built: the linked-update scan, its 500-instance bound and idempotency do not exist.
- Implementation: appears missing (same as AC-212)
- Missing evidence: pgTAP/race: the scan processes at most 500 instances per run with a continuation cursor; re-delivery of one cms.pattern.activated.v1 appends no duplicate pending_diff row; a list longer than 500 continues from the cursor.
- Size: M (after AC-212)

## Totals and flags

(a) Counts: verified 2, partial 12, unverified 57.

(b) Criteria whose implementation appears entirely missing (54): AC-143, AC-144, AC-145, AC-146, AC-147, AC-148, AC-149, AC-150, AC-151, AC-152, AC-153, AC-154, AC-155, AC-156, AC-157, AC-158, AC-171, AC-172, AC-173, AC-174, AC-175, AC-176, AC-177, AC-178, AC-179, AC-180, AC-181, AC-182, AC-183, AC-184, AC-185, AC-186, AC-187, AC-188, AC-189, AC-190, AC-191, AC-196, AC-197, AC-198, AC-199, AC-200, AC-201, AC-202, AC-203, AC-204, AC-205, AC-206, AC-208, AC-209, AC-210, AC-211, AC-212, AC-213.

Partly implemented but unverified or partial for lack of tests or a rule: AC-164, AC-166, AC-169, AC-192, AC-193, AC-194, AC-195, AC-207.

(c) Cited tests believed to fail or be skipped: none found. A scan of all 26 cited files found no skip, todo, fixme or only marker.
Run-environment notes (not failures, but they decide whether a receipt can be produced):
- tests/e2e/phase-02-slice-12-template-real-route.spec.ts and ...-uncertain-real-route.spec.ts are in the testIgnore list of playwright.config.ts and run only under playwright.s09-real.config.ts (project real-route-chrome); they use the in-memory fixture tests/e2e/support/cms-template-fixture.ts, not Supabase.
- tests/e2e/phase-02-slice-12-template-edit.spec.ts runs under the default config (project chrome) against the Astro dev server with no platform fixture.
- supabase/tests/phase_02_slice_12_template_authority.sql opens a dblink connection to host=db (docker network); it must run through the supabase test runner, not a host psql.
- Several citations are Slice 09/11 pgTAP assertions (phase_02_slice_09_evidence_misc.sql, _r8_api_surface.sql, _dec119_future_membership.sql, _dec108_resolver.sql, phase_02_slice_11_helpers_preflight.sql) reused for cross-cutting facts (table grants, service-role-only RPCs, membership predicate, retired-template behavior); a regression there would fail these criteria too.

Drift found while auditing (decide before writing the missing tests):
- Error codes: AC-169/AC-175 name 502/503/504 `DEPENDENCY_UNAVAILABLE`; apps/worker/src/cms-composition/template-shared.ts:108-121 maps 502 to DEPENDENCY_INVALID_RESPONSE and 504 to DEPENDENCY_DEADLINE_EXCEEDED and tests assert the former.
- Cross-owner existence signal (AC-190): cms_define_template (supabase/migrations/20260927200000_cms_template_authority.sql:448-452) reads the latest version of a key without an owner predicate, so owner B creating a key owner A holds gets CONFLICT; this is live today.
- Deprecated blocks (AC-194): the template-create digest refuses any non-supported block (CONFLICT), while the Slice 11 preflight passes a deprecated block ("a deprecated block still passes"); BE03c says only "fixed compatibility policy".
- AC-168/AC-162: the Worker passes windowSeconds 60 to the limiter but no test asserts it.

