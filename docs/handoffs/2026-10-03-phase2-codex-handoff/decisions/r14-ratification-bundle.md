# Slice 09 ratification bundle (held criteria), 2026-10-03

Nothing here is applied. Each held criterion is unchecked in the plan and the tracker with the inline note "held: reworded text pending owner ratification (ledger row ACnnn)". For each: the original text, the current reworded text, the defect the audit-3 found (or the authority gap), a corrected text that says only what the code and tests prove, the evidence, and what needs an owner decision. Ledger rows: `.memory/pipeline/progress/verification/2026-10-02-slice-09-dec108-depth-floor.md (section "Rewording after the evidence rulings")`. Audit: `scratchpad/reports/s09-audit3.md` (section 6, 9) and `scratchpad/audit3/table.md`. "Original" is the text before any reword: the 2026-09-26 plan text for AC001-AC283 and the 2026-10-02 plan text (commit c196eca3) for AC284 and above. AC181 and AC685 are not held; the audit lists them as reopen-now and they are included because their wording depends on AC037 and AC180.

| Criterion | Authority of the current text | Decision needed |
|---|---|---|
| AC005 | orchestrator ruling (Integrator-v3 holdover rulings), pending owner ratification | ratify the proposed text (or the current text) |
| AC007 | orchestrator ruling (Integrator-v3 holdover rulings, per the R12 app proposal), pending owner ratification | ratify the proposed text (or the current text) |
| AC025 | orchestrator ruling (Integrator-v3 holdover rulings): superseded by the R14 BE03a correction; nothing remains to ratify except that BE03a no longer lists an order | ratify the proposed text (or the current text) |
| AC034 | orchestrator ruling (R12-db flag rulings), pending owner ratification | Whether BE03a rows 164/165 (human 403, unknown release target 404 on CMS-03A-05) should be database rows or stay Worker rows; the database answers 401 for a human caller there. |
| AC037 | orchestrator ruling (P240-db rulings), pending owner ratification | ratify the proposed text (or the current text) |
| AC180 | orchestrator ruling (P240-db rulings, security-first), pending owner ratification | Whether to keep the per-class counts (8, 10, 33) in the criterion text; the guard, not the text, is the source of truth for the exact set. |
| AC185 | orchestrator ruling (P240-db rulings), pending owner ratification | Moving legal-hold and incident-fence enforcement out of Slice 09 is a product decision; S16-029 depends on it. |
| AC233 | orchestrator ruling (R8 web rulings), pending owner ratification; criterion stays open per its own ledger row | Drop the server-revalidation clause from the FE03 requirement or prove it with a real-composition replay test. |
| AC246 | orchestrator ruling (P240-app rulings), pending owner ratification (virtualization clause only) | ratify the proposed text (or the current text) |
| AC261 | orchestrator ruling (R8 web rulings), pending owner ratification | Whether the bundle-size clauses are in scope for Slice 09 or move to the build-gate slice. |
| AC282 | orchestrator ruling (Integrator-v3 holdover rulings), pending owner ratification | ratify the proposed text (or the current text) |
| AC356 | orchestrator ruling (R12-db flag rulings), pending owner ratification | ratify the proposed text (or the current text) |
| AC390 | orchestrator ruling (R12-db flag rulings), pending owner ratification (API addition) | Owner decision on adding the optional workflow pair to the CMS-03A-09 request contract. |
| AC431 | DEC-122 (owner-ratified) refined by an orchestrator ruling (Integrator-v3 holdover rulings), refinement pending owner ratification | ratify the proposed text (or the current text) |
| AC641 | orchestrator ruling (R12-db flag rulings), pending owner ratification (behaviour change in a database RPC) | Owner confirmation that a dry_running plan may be failed through the rollback RPC and then recovered by a new CMS-03A-10. |
| AC658 | orchestrator ruling (R12-db flag rulings), pending owner ratification | ratify the proposed text (or the current text) |
| AC708 | consequence of the AC180 ruling, orchestrator, pending owner ratification | ratify the proposed text (or the current text) |
| AC906 | orchestrator ruling (Integrator-v3 holdover rulings), pending owner ratification | Whether the original 'projections refetch AUTH-API-16' means an event-driven consumer (not built) or the pull model. |
| AC1147 | orchestrator ruling (Integrator-v3 holdover rulings), pending owner ratification | ratify the proposed text (or the current text) |
| AC181 | none yet: needs the same ratification as AC037 | ratify the proposed text (or the current text) |
| AC685 | none yet: consequence of the AC180 ruling | ratify the proposed text (or the current text) |

## AC005

- **Original** (f0bde9f1): Treat sourceLocale as the canonical authoring locale and defaultLocale as the governed delivery fallback root; no_fallback fields do not borrow it.
- **Current**: Treat sourceLocale as the canonical authoring locale and defaultLocale as the governed delivery fallback root; the declaration and storage of no_fallback fields belong to AC1166, while the resolution semantics that a no_fallback field never borrows defaultLocale belong to Slice 12 and Slice 15 delivery (DEC-121, DEC-122).
- **Defect found**: No defect in the reworded text: the audit rates it PROVEN. The only open item is authority: the criterion cites DEC-122 for the no_fallback move, but the ratified DEC-122 covers the AC1166 declaration/storage scope only; the AC005 resolution-semantics move is this orchestrator ruling.
- **Proposed text**: Treat sourceLocale as the canonical authoring locale and defaultLocale as the governed delivery fallback root; the declaration and storage of no_fallback fields belong to AC1166, and the resolution semantics that a no_fallback field never borrows defaultLocale belong to Slice 12 AC051 and AC052 (DEC-121).
- **Authority**: orchestrator ruling (Integrator-v3 holdover rulings), pending owner ratification
- **Evidence**: `supabase/tests/phase_02_slice_09_p240_locale.sql`
- **Owner decision**: ratify the proposed text, or keep the current text and accept its defect.

## AC007

- **Original** (f0bde9f1): Compile each definition deterministically to strict Zod/OpenAPI/editor/database/renderer artifacts and reject unknown fields.
- **Current**: Compile each definition deterministically to a versioned Zod/OpenAPI contract reference plus editor and renderer manifests under one deterministic hash, and reject unknown fields.
- **Defect found**: No defect in the reworded text (audit: PROVEN, adjudicated from NOT-PROVEN): the compiler already emits exactly the contract reference plus editor and renderer manifests under one deterministic hash and rejects unknown members. Only the authority is missing; the original wording named database and OpenAPI artifacts the compiler never persists.
- **Proposed text**: Compile each definition deterministically to a versioned Zod/OpenAPI contract reference plus editor and renderer manifests under one deterministic hash, and reject unknown fields (BE03a names this artifact set; no separately persisted OpenAPI or database artifact exists).
- **Authority**: orchestrator ruling (Integrator-v3 holdover rulings, per the R12 app proposal), pending owner ratification
- **Evidence**: `packages/contracts/src/content-schema-registry/phase-02-slice-09-ac007-artifact-strict.test.ts`; `supabase/tests/phase_02_slice_09_p241_ac007_artifact_compile.sql`; `tests/contracts/phase-02-slice-09-r12-spec-text.test.ts`
- **Owner decision**: ratify the proposed text, or keep the current text and accept its defect.

## AC025

- **Original** (f0bde9f1): Apply BE00 canonical middleware order, cms-console CORS and CSRF to human mutations, and no browser CSRF authority to release-worker requests.
- **Current**: Apply BE00 canonical middleware order, cms-console CORS and CSRF to human mutations, and no browser CSRF authority to release-worker requests. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria.
- **Defect found**: The criterion text is unchanged. The ruling edited BE03a:147 to list an order that contradicted BE00 §Hono Middleware Order (Zod validation before CORS and the session; session-bound CSRF after capability and step-up) and a guard asserted that order 'as implemented'. Audit: NOT-PROVEN. Since then (R14): BE03a defers to BE00 exactly (changelog 2026-10-03, r12-spec-text guard rewritten) and the Worker now runs the BE00 order (r14-wk item 1, apps/worker/.../phase-02-slice-09-be00-middleware-order.test.ts, 12 tests, RED 9 failed -> GREEN).
- **Proposed text**: Apply BE00 canonical middleware order (BE00 §Hono Middleware Order, restated nowhere else), cms-console CORS and session-bound CSRF to human mutations, and no browser CSRF authority to release-worker requests. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria.
- **Authority**: orchestrator ruling (Integrator-v3 holdover rulings): superseded by the R14 BE03a correction; nothing remains to ratify except that BE03a no longer lists an order
- **Evidence**: `apps/worker/src/content-schema-registry/phase-02-slice-09-worker-admission.test.ts`; `tests/contracts/phase-02-slice-09-pre-structure.test.ts`; `tests/contracts/phase-02-slice-09-r12-spec-text.test.ts`; `apps/worker/src/content-schema-registry/phase-02-slice-09-be00-middleware-order.test.ts`; `tests/contracts/phase-02-slice-09-r12-spec-text.test.ts`
- **Owner decision**: ratify the proposed text, or keep the current text and accept its defect.

## AC034

- **Original** (f0bde9f1): Return 403 when a readable resource exists but capability is insufficient, and indistinguishable 404 when owner/scope/resource existence is concealed.
- **Current**: Return 403 when a readable resource exists but capability is insufficient, and indistinguishable 404 when owner/scope/resource existence is concealed. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria.
- **Defect found**: The criterion text only gained the A01-A08 scope sentence under the DEC-108 group row. The pending part is the R12-db ruling that CMS-03A-01 answers 404 for a foreign or absent target scope (BE03a row 160) and 403 for a member without schema_designer. Audit: WEAK (S): A01-A04 and A07 are database-proven, but the CMS-03A-05 403 and 404 and the CMS-03A-08 403 exist only as Worker mappings of a stubbed RPC (the database answers 401 for a human on CMS-03A-05 and has no 404 for an unknown release target), and the CMS-03A-06 absent-page omission is unasserted.
- **Proposed text**: Return 403 when a readable resource exists but capability is insufficient, and an indistinguishable 404 when owner, scope or resource existence is concealed. Scope: CMS-03A-01 (404 for a foreign or absent target scope, 403 for a member without schema_designer), CMS-03A-02, CMS-03A-03, CMS-03A-07 and the unknown-id 404 of CMS-03A-08, each proven in the database; the CMS-03A-05 and CMS-03A-08 human 403 and the CMS-03A-05 unknown-target 404 are Worker mappings (BE03a rows 164 and 165) and are proven only where the Worker rows for those operations assert them.
- **Authority**: orchestrator ruling (R12-db flag rulings), pending owner ratification
- **Evidence**: `apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts`; `apps/worker/src/content-schema-registry/phase-02-slice-09-r12-authority-production.test.ts`; `supabase/tests/phase_02_slice_09_p240_a01_aggregate.sql`; `supabase/tests/phase_02_slice_09_p240_authority.sql`; `supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql`; `supabase/tests/phase_02_slice_09_p240_block_register.sql`
- **Owner decision**: Whether BE03a rows 164/165 (human 403, unknown release target 404 on CMS-03A-05) should be database rows or stay Worker rows; the database answers 401 for a human caller there.

## AC037

- **Original** (f0bde9f1): Resolve RLS predicates through a schema-qualified immutable helper and execute mutations only through named schema-qualified RPCs.
- **Current**: Resolve RLS predicates through a schema-qualified, pinned-search_path STABLE helper (never IMMUTABLE: it reads the session context) and execute mutations only through named schema-qualified RPCs. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria.
- **Defect found**: The original said 'immutable helper'; the code and the AC037 evidence use a pinned-search_path STABLE helper because the helper reads the session context. The ruling changed the text to match the code. Audit: not sampled; AC181 still carries the old word 'immutable' and is NOT-PROVEN for that reason.
- **Proposed text**: Resolve RLS predicates through a schema-qualified, pinned-search_path STABLE helper (IMMUTABLE would be wrong because the helper reads the session context) and execute mutations only through named schema-qualified RPCs. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria.
- **Authority**: orchestrator ruling (P240-db rulings), pending owner ratification
- **Evidence**: `apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts`; `supabase/tests/phase_02_slice_09_p240_authority.sql`; `supabase/tests/phase_02_slice_09_schema/001-contract.sqlinc`
- **Owner decision**: ratify the proposed text, or keep the current text and accept its defect.

## AC180

- **Original** (f0bde9f1): The SQL API exposes only the eight named cms_* RPCs for these operations; anon/authenticated roles have no direct table INSERT/UPDATE/DELETE grants.
- **Current**: The SQL API exposes exactly the enumerated cms_* RPC set: the eight original named RPCs for A01-A08 (CMS-03A-01 through CMS-03A-08), the ten amendment RPCs and 33 Worker, workflow and sweep-called supporting RPCs, checked by an exact-set guard on the live catalog and against the callers; cms_resolve_template_compatibility and cms_validate_locale_config are executable by no API role; anon/authenticated roles have no direct table INSERT/UPDATE/DELETE grants.
- **Defect found**: Audit: PROVEN (live-catalog guard exact: 53 classified, 51 executable, 5 of them by authenticated, and the 2 internal functions executable by no API role). The original 'only the eight named RPCs' was false once the amendment added operations; the rewording widens it to the exact enumerated set. BE03a:2178 was edited to match. It also forces AC685 ('exactly eighteen') to be reworded.
- **Proposed text**: The SQL API exposes exactly the cms_ RPC set that the exact-set guard enumerates on the live catalog and against the callers: the eight original named RPCs for A01-A08 (CMS-03A-01 through CMS-03A-08), the ten amendment RPCs and the Worker, workflow and sweep-called supporting RPCs; cms_resolve_template_compatibility and cms_validate_locale_config are executable by no API role; anon and authenticated roles have no direct table INSERT, UPDATE or DELETE grants.
- **Authority**: orchestrator ruling (P240-db rulings, security-first), pending owner ratification
- **Evidence**: `supabase/tests/phase_02_slice_09_dec108_resolver.sql`; `supabase/tests/phase_02_slice_09_od4_locale_validator.sql`; `supabase/tests/phase_02_slice_09_r8_api_surface.sql`; `tests/contracts/phase-02-slice-09-api-surface-callers.test.ts`; `tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts`; `tests/contracts/phase-02-slice-09-pre-api-surface.test.ts`; `supabase/tests/phase_02_slice_09_r8_api_surface.sql`; `supabase/migrations/20261002212000_* (platform_api trim)`
- **Owner decision**: Whether to keep the per-class counts (8, 10, 33) in the criterion text; the guard, not the text, is the source of truth for the exact set.

## AC185

- **Original** (f0bde9f1): Retention preserves active/superseded definitions and migration evidence; retirement is state, key uniqueness is forever, and legal hold/incident fencing blocks purge.
- **Current**: Retention preserves active/superseded definitions and migration evidence; retirement is state, key uniqueness is forever, and no purge path exists for CMS definitions, plans or reports (legal-hold and incident-fence enforcement over CMS records is received by the Slice 16 lifecycle foundation).
- **Defect found**: Original said legal-hold and incident-fence enforcement blocks purge; no CMS purge path exists, so there is nothing to block. The ruling moves legal-hold and incident-fence enforcement to the Slice 16 lifecycle foundation and adds receiving criterion Slice 16 AC-029. Audit: not sampled. The Slice 16 receiving criterion is open and exists.
- **Proposed text**: Retention preserves active and superseded definitions and migration evidence; retirement is state and key uniqueness is forever; no purge path exists for CMS definitions, plans or reports, and legal-hold and incident-fence enforcement over CMS records is received by Slice 16 AC029.
- **Authority**: orchestrator ruling (P240-db rulings), pending owner ratification
- **Evidence**: `supabase/tests/phase_02_slice_09_p240_tables.sql`
- **Owner decision**: Moving legal-hold and incident-fence enforcement out of Slice 09 is a product decision; S16-029 depends on it.

## AC233

- **Original** (f0bde9f1): Unsaved protected registry data is never persisted as draft/offline intent; reconnect revalidates identity, authority, input, and version.
- **Current**: Unsaved protected registry data is never persisted as a durable draft or offline intent (the only permitted persistence is the DEC-111 tab-scoped step-up draft, session-scoped, cleared on return or re-confirmation and never auto-replayed); reconnect revalidates identity, authority, input, and version.
- **Defect found**: Ledger: 'stays open until the reconnect-revalidation clause is asserted under its marker', yet it was checked. Audit: WEAK (S). The 'reconnect' test is an immediate in-memory retry after a TypeError (online and visibility events do nothing) and every revalidation answer is a stubbed fetch reply, so server revalidation on a same-key replay is never exercised; the step-up draft 'cleared on return or re-confirmation, never auto-replayed' is asserted only in an uncited file.
- **Proposed text**: Unsaved protected registry data is never persisted as a durable draft or offline intent; the only permitted persistence is the DEC-111 tab-scoped step-up draft (session-scoped). A command that failed on the network is re-sent only by an explicit user action with the same Idempotency-Key, never automatically and never from storage. The reconnect clause 'revalidates identity, authority, input and version' stays open until a test sends the replay through the real Worker.
- **Authority**: orchestrator ruling (R8 web rulings), pending owner ratification; criterion stays open per its own ledger row
- **Evidence**: `apps/web/src/components/content-schema-registry/content-schema-registry-s09-r12-reconnect-revalidation.dom.test.tsx`; `apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-no-offline-intent.dom.test.tsx`
- **Owner decision**: Drop the server-revalidation clause from the FE03 requirement or prove it with a real-composition replay test.

## AC246

- **Original** (f0bde9f1): At desktop ≥1025 px it uses twelve columns/24 px gutter/max 1440 px, stable list/detail split, action rail, and virtualization above 100 rows.
- **Current**: At desktop ≥1025 px it uses twelve columns/24 px gutter/max 1440 px, stable list/detail split, action rail, and at most 100 rows per cursor page (BE03a page cap), so no client virtualization is required.
- **Defect found**: Original clause 'virtualization above 100 rows' contradicted the BE03a page cap of 100; the ruling replaces it with 'at most 100 rows per cursor page, so no client virtualization is required'. Ledger: 'the layout clauses await the production-built Chrome run'. Audit: not sampled.
- **Proposed text**: At desktop >= 1025 px it uses twelve columns, a 24 px gutter, max 1440 px, a stable list and detail split and an action rail, and a list page holds at most 100 rows (BE03a page cap), so no client virtualization is required.
- **Authority**: orchestrator ruling (P240-app rulings), pending owner ratification (virtualization clause only)
- **Evidence**: `apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx`; `apps/web/src/components/content-schema-registry/content-schema-registry-s09-r10-shell.dom.test.tsx`; `tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts`; `tests/accessibility/phase-02-slice-09-registry-shell-layout.test.ts`; `tests/e2e/phase-02-slice-09-content-schema-registry.spec.ts`; `tests/e2e/phase-02-slice-09-registry-layout-real-route.spec.ts`; `tests/e2e/phase-02-slice-09-registry-layout-real-route.spec.ts (layout clauses, Chrome)`
- **Owner decision**: ratify the proposed text, or keep the current text and accept its defect.

## AC261

- **Original** (f0bde9f1): The registry route starts at ≤90 KB initial app JS, workbench hydrated entry ≤35 KB, detail/editor modules split, and no barrel import; list >100 virtualizes.
- **Current**: The registry route starts at ≤90 KB initial app JS, workbench hydrated entry ≤35 KB, detail/editor modules split, and no barrel import; registry lists render at most 100 rows per page through cursor pagination (BE03a page cap), so no client virtualization is required.
- **Defect found**: Audit: WEAK (S). The FE03 'virtualize above 100 rows' requirement was dropped by the ruling. The at-most-100 rows claim is proven on the page schema, not at render time, and the bundle budgets are asserted on synthetic manifests with no real pnpm bundle:check receipt.
- **Proposed text**: The registry list page is capped at 100 rows by the BE03a cursor page cap (the page schema rejects more) and the list renders the rows it receives, so no client virtualization is required. The initial app JS, hydrated workbench entry, module splitting and barrel-import budgets stay open until `pnpm bundle:check` on the real build is attached as the receipt.
- **Authority**: orchestrator ruling (R8 web rulings), pending owner ratification
- **Evidence**: `apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-page-cap.test.ts`; `tests/performance/phase-02-slice-09-content-schema-registry.test.ts`
- **Owner decision**: Whether the bundle-size clauses are in scope for Slice 09 or move to the build-gate slice.

## AC282

- **Original** (f0bde9f1): Verify S10/S11/S12/S15 existing owner criteria cover removed later-only S09 editorial/composition/public topics; transfer count is zero.
- **Current**: Verify S10/S11/S12/S15 existing owner criteria cover removed later-only S09 editorial/composition/public topics; the transfer count of those topics is zero, and the scope DEC-122 later moved out of Slice 09 (step-up recovery for the later review, schedule and publication commands, no_fallback resolution semantics, template binding flows beyond DEC-123, legal-hold enforcement over CMS records) is received by seven explicit receiving criteria (Slice 11 AC046 through AC048, Slice 12 AC051 through AC053, Slice 16 AC029).
- **Defect found**: Audit: WEAK (S). (1) 'existing owner criteria cover removed topics' was a keyword-existence regex; (2) the text credits DEC-122 with all seven moves, but the ratified DEC-122 covers only AC1031 (Slice 11 AC046-AC048) and AC1166 (Slice 12 AC051-AC052); Slice 12 AC053 is DEC-123 and Slice 16 AC029 is the pending AC185 ruling. R14 fixed (1) (exact 11-topic mapping guard) and the transfer record (attribution table); the criterion text still carries the wrong attribution.
- **Proposed text**: Verify S10/S11/S12/S15 existing owner criteria cover removed later-only S09 editorial/composition/public topics (the exact mapping is asserted in the pre-traceability guard); the transfer count of those topics is zero; the scope the amendment rulings moved out of Slice 09 is received by seven explicit receiving criteria: Slice 11 AC046 through AC048 (DEC-122, AC1031), Slice 12 AC051 and AC052 (DEC-122, AC1166), Slice 12 AC053 (DEC-123) and Slice 16 AC029 (AC185 ruling, pending ratification).
- **Authority**: orchestrator ruling (Integrator-v3 holdover rulings), pending owner ratification
- **Evidence**: `tests/contracts/phase-02-slice-09-pre-traceability.test.ts`; `.memory/pipeline/progress/verification/2026-09-02-slice-09-contract-reconciliation.md (Transfer addendum)`
- **Owner decision**: ratify the proposed text, or keep the current text and accept its defect.

## AC356

- **Original** (c196eca3): CMS-03A-10 returns 422 VALIDATION_FAILED for a transform, registry or count-input schema failure, a transform pair inconsistent with the derived classification, or a classification that is not derivable with the BE00 ApiError envelope and only the allowlisted details for that status.
- **Current**: CMS-03A-10 returns 422 VALIDATION_FAILED for a transform or registry schema failure, a transform pair inconsistent with the derived classification, or a classification that is not derivable, and 400 INVALID_REQUEST for a caller-supplied count, hash or classification member (an unknown key), each with the BE00 ApiError envelope and only the allowlisted details for that status.
- **Defect found**: The original text sent a caller-supplied count to 422; BE00's structural rule and the database answer 400 INVALID_REQUEST for a caller-supplied count, hash or classification (unknown key). The ruling rewrote the text, the BE03a row and error matrix, and the Worker (admission-body unknownKeyIsStructural). Audit: PROVEN (P).
- **Proposed text**: CMS-03A-10 returns 422 VALIDATION_FAILED for a transform or registry schema failure, a transform pair inconsistent with the derived classification, or a classification that is not derivable, and 400 INVALID_REQUEST for a caller-supplied count, hash or classification member (an unknown key), each with the BE00 ApiError envelope and only the allowlisted details for that status.
- **Authority**: orchestrator ruling (R12-db flag rulings), pending owner ratification
- **Evidence**: `apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts`; `apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts`; `supabase/tests/phase_02_slice_09_evidence_misc.sql`; `supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql`
- **Owner decision**: ratify the proposed text, or keep the current text and accept its defect.

## AC390

- **Original** (c196eca3): CMS-03A-11 reviews a successor under the strictest of the source version's and the candidate's workflow policy members, so a protected-to-ordinary key change keeps the protected count and specialist slot.
- **Current**: CMS-03A-11 reviews a successor under the strictest of the source version's and the candidate's workflow policy members, so a protected-to-ordinary key change keeps the protected count and specialist slot.
- **Defect found**: The criterion text never changed. The pending ruling is the producer: CMS-03A-09 gained an optional nullable workflowKey/workflowVersion pair so a protected-to-ordinary change can be requested through the API instead of a direct UPDATE. That adds members to a public operation contract (an architecture-level change) and has no ledger row until R14. Audit: PROVEN (P).
- **Proposed text**: CMS-03A-11 reviews a successor under the strictest of the source version's and the candidate's workflow policy members, so a protected-to-ordinary key change keeps the protected count and specialist slot; the candidate's key is set only through the optional workflowKey and workflowVersion pair of CMS-03A-09 (both null or absent keep the source member, both present replace it with a seeded registry member, 422 otherwise).
- **Authority**: orchestrator ruling (R12-db flag rulings), pending owner ratification (API addition)
- **Evidence**: `apps/worker/src/content-schema-registry/phase-02-slice-09-r12-successor-workflow.test.ts`; `packages/contracts/src/content-schema-registry/phase-02-slice-09-r12-successor-workflow.test.ts`; `supabase/tests/phase_02_slice_09_dec108_submit.sql`; `supabase/tests/phase_02_slice_09_r12_successor_workflow.sql`
- **Owner decision**: Owner decision on adding the optional workflow pair to the CMS-03A-09 request contract.

## AC431

- **Original** (c196eca3): CMS-03A-12 returns 403 FORBIDDEN for an assignment or capability denial with the BE00 ApiError envelope and only the allowlisted details for that status.
- **Current**: CMS-03A-12 returns 403 FORBIDDEN, with the BE00 ApiError envelope and only the allowlisted details for that status, when the review is readable to the caller through submitter or schema-designer scope but the caller is not assigned or authorized to decide it, and 404 NOT_FOUND when the review is not readable to the caller (concealment).
- **Defect found**: Original: 403 for an assignment or capability denial. DEC-122 (ratified) made it 403 for a readable-but-not-authorized review and 404 for an unreadable one; the third 403 class (an assignment that grants read but whose decide authority is not current) is unreachable because cms_review_scope grants read only through an effective assignment, so the orchestrator refinement drops it. Audit: not sampled.
- **Proposed text**: CMS-03A-12 returns 403 FORBIDDEN, with the BE00 ApiError envelope and only the allowlisted details for that status, when the review is readable to the caller through submitter or schema-designer scope but the caller is not assigned or authorized to decide it, and 404 NOT_FOUND when the review is not readable to the caller (concealment).
- **Authority**: DEC-122 (owner-ratified) refined by an orchestrator ruling (Integrator-v3 holdover rulings), refinement pending owner ratification
- **Evidence**: `apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts`; `apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts`; `apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts`; `supabase/tests/phase_02_slice_09_evidence_cms11_14.sql`; `supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql`; `supabase/tests/phase_02_slice_09_r8_error_details.sql`; `supabase/tests/phase_02_slice_09_r8_review_owner_consistency.sql`
- **Owner decision**: ratify the proposed text, or keep the current text and accept its defect.

## AC641

- **Original** (c196eca3): activationPreparation dryRunRef carries an optional nullable failureCode matching ^[A-Z][A-Z0-9_]{0,63}$ taken from the sealed dry-run failure code.
- **Current**: activationPreparation dryRunRef carries an optional nullable failureCode matching ^[A-Z][A-Z0-9_]{0,63}$ taken from the sealed dry-run failure code.
- **Defect found**: The criterion text never changed. The pending ruling is the producer behaviour: cms_rollback_schema_migration now accepts a dry_running plan, marks the latest attempt failed with the code, and blocks the plan (retryable is 409, a code outside the pattern is 400); before it no scan could end failed, so failureCode could not come from a real failed attempt. Audit: PROVEN (P). There was no ledger row until R14.
- **Proposed text**: activationPreparation dryRunRef carries an optional nullable failureCode matching ^[A-Z][A-Z0-9_]{0,63}$ taken from the sealed dry-run failure code of the latest attempt, which only cms_rollback_schema_migration on a dry_running plan writes; a later queued attempt projects null.
- **Authority**: orchestrator ruling (R12-db flag rulings), pending owner ratification (behaviour change in a database RPC)
- **Evidence**: `packages/contracts/src/content-schema-registry/phase-02-slice-09-r2-contract-evidence.test.ts`; `packages/contracts/src/content-schema-registry/resources-workflow.coverage.test.ts`; `supabase/tests/phase_02_slice_09_r12_scan_failure.sql`; `supabase/tests/phase_02_slice_09_r3_activation_gates.sql`
- **Owner decision**: Owner confirmation that a dry_running plan may be failed through the rollback RPC and then recovered by a new CMS-03A-10.

## AC658

- **Original** (c196eca3): cms_capability_grants writes through the grant, renew and revoke RPCs only, each upserting the matching identity_private.organization_actor_grant row in the same transaction, and no other CMS code writes that projection.
- **Current**: cms_capability_grants writes through the grant, renew and revoke RPCs only, each upserting the matching identity_private.organization_actor_grant row in the same transaction; the exact writer set of that projection is cms_capability_grant_project (the grant, renew and revoke RPCs, CMS-03A-15 through CMS-03A-17), initialize_cms_owner (its owner-initialization backfill writes the grant aggregate only) and rpc_create_organization (organization capability grants), and no other function, trigger or rule writes it.
- **Defect found**: Audit: NOT-PROVEN. The reworded text says the table writes 'through the grant, renew and revoke RPCs only', yet names initialize_cms_owner's backfill as a writer. Its own marked assertion shows cms_backfill_owner_capability_grants (fired by a trigger on cms_owner_initialization) inserting grant aggregates without upserting the projection (evidence_constraints_grants.sql:94-95). The text contradicts its test.
- **Proposed text**: cms_capability_grants rows are written only by the grant, renew and revoke operations (cms_capability_grant_project, CMS-03A-15 through CMS-03A-17) and by the owner-initialization backfill, which writes the aggregate only. The identity_private.organization_actor_grant projection is written only by cms_capability_grant_project, initialize_cms_owner and rpc_create_organization, and no other function, trigger or rule writes it.
- **Authority**: orchestrator ruling (R12-db flag rulings), pending owner ratification
- **Evidence**: `supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql`; `supabase/tests/phase_02_slice_09_r3_grants_misc.sql`; `supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql:94-95`
- **Owner decision**: ratify the proposed text, or keep the current text and accept its defect.

## AC708

- **Original** (c196eca3): Resolver is executable only by the service-role Worker with no browser or authenticated table access and no browser route.
- **Current**: The resolver is DB-internal: executable by no API role (the Worker never calls it; activation preflight calls the platform_private resolver), with no browser or authenticated table access and no browser route.
- **Defect found**: Original said the resolver is executable only by the service-role Worker. After the AC180 ruling (platform_api trimmed, r9 migration 212000) it is executable by no API role and activation preflight calls the platform_private resolver; the criterion follows that ruling. Audit: not sampled.
- **Proposed text**: The template-compatibility resolver is DB-internal: executable by no API role (the Worker never calls it; activation preflight calls the platform_private resolver), with no browser or authenticated table access and no browser route.
- **Authority**: consequence of the AC180 ruling, orchestrator, pending owner ratification
- **Evidence**: `supabase/tests/phase_02_slice_09_dec108_resolver.sql`
- **Owner decision**: ratify the proposed text, or keep the current text and accept its defect.

## AC906

- **Original** (c196eca3): identity.mfa-factor.changed.v1 carries exactly { mfaFactorId, authBindingId } with no secret, URI or provider id and projections refetch AUTH-API-16.
- **Current**: identity.mfa-factor.changed.v1 carries exactly { mfaFactorId, authBindingId } with no secret, URI or provider id and projections refetch AUTH-API-16 under the pull model (no client projection cache exists, so every read re-fetches canonical state and a new ETag; an event consumer that refetches projections is required only if a projection cache is introduced).
- **Defect found**: Audit: WEAK (S). The refetch clause was reworded from 'projections refetch AUTH-API-16' to a pull model. 'No client projection cache exists' is asserted nowhere globally, the tab refetch is tested with a stubbed BroadcastChannel, and no consumer of the event refetches.
- **Proposed text**: identity.mfa-factor.changed.v1 carries exactly { mfaFactorId, authBindingId } with no secret, URI or provider id. AUTH-API-16 returns canonical state and a new ETag on every read (pull model); no event consumer refetches projections, and the browser refetches on its own mutation and on the multi-tab broadcast.
- **Authority**: orchestrator ruling (Integrator-v3 holdover rulings), pending owner ratification
- **Evidence**: `apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.multitab.dom.test.tsx`; `apps/worker/src/authentication/phase-02-slice-09-r8-factor-refetch.test.ts`; `supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql`; `supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql`
- **Owner decision**: Whether the original 'projections refetch AUTH-API-16' means an event-driven consumer (not built) or the pull model.

## AC1147

- **Original** (c196eca3): Record that Slices 10 and 12 implementation prerequisites include the amended Slice 09 criteria and that the later-only topics moved by the amendment have a transfer count of zero.
- **Current**: Record that Slices 10 and 12 implementation prerequisites include the amended Slice 09 criteria and that the later-only topics moved by the amendment have a transfer count of zero, and that the scope DEC-122 later moved is carried by seven explicit receiving criteria (Slice 11: 3, Slice 12: 3, Slice 16: 1).
- **Defect found**: Audit: WEAK (S). 'The scope DEC-122 later moved' includes Slice 16 AC029 (pending AC185 ruling) and Slice 12 AC053 (DEC-123), neither in the ratified DEC-122; the Slice 10 and 12 gate notes said 249/1235 (fixed in R14).
- **Proposed text**: Record that Slices 10 and 12 implementation prerequisites include the amended Slice 09 criteria, that the later-only topics moved by the amendment have a transfer count of zero, and that the scope the amendment rulings moved out of Slice 09 is carried by seven explicit receiving criteria (Slice 11: 3 under DEC-122; Slice 12: 2 under DEC-122 and 1 under DEC-123; Slice 16: 1 under the pending AC185 ruling).
- **Authority**: orchestrator ruling (Integrator-v3 holdover rulings), pending owner ratification
- **Evidence**: `tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts`; `tests/contracts/phase-02-slice-09-pre-traceability.test.ts`
- **Owner decision**: ratify the proposed text, or keep the current text and accept its defect.

## AC181 (not held, reopen-now)

- **Original** (f0bde9f1): RLS is enabled and forced on every table, reads are scope/acting-context filtered, WITH CHECK re-resolves allowlists/current state, and a schema-qualified immutable helper is used.
- **Current**: RLS is enabled and forced on every table, reads are scope/acting-context filtered, WITH CHECK re-resolves allowlists/current state, and a schema-qualified immutable helper is used.
- **Defect found**: Not held; audit reopen-now (NOT-PROVEN). The text still says 'a schema-qualified immutable helper', but the code and AC037 use a pinned-search_path STABLE helper because the helper reads the session context.
- **Proposed text**: RLS is enabled and forced on every table, reads are scope/acting-context filtered, WITH CHECK re-resolves allowlists/current state, and a schema-qualified pinned-search_path STABLE helper is used.
- **Authority**: none yet: needs the same ratification as AC037
- **Evidence**: `supabase/tests/phase_02_slice_09_dec111_mfa_self_views.sql`; `supabase/tests/phase_02_slice_09_evidence_misc.sql`; `supabase/tests/phase_02_slice_09_r3_rls_session_scope.sql`; `supabase/tests/phase_02_slice_09_r8_review_owner_consistency.sql`; `supabase/tests/phase_02_slice_09_schema/001-contract.sqlinc`; `tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts`
- **Owner decision**: ratify the proposed text, or keep the current text and accept its defect.

## AC685 (not held, reopen-now)

- **Original** (c196eca3): The SQL API exposes exactly the eighteen named RPCs cms_create_type_draft through cms_list_capability_grants to named capability grants and anon and authenticated hold no direct INSERT, UPDATE or DELETE on the tables.
- **Current**: The SQL API exposes exactly the eighteen named RPCs cms_create_type_draft through cms_list_capability_grants to named capability grants and anon and authenticated hold no direct INSERT, UPDATE or DELETE on the tables.
- **Defect found**: Not held; audit reopen-now (NOT-PROVEN). The text says 'exactly the eighteen named RPCs', but the AC180 guard proves a larger exact set (51 executable) and the AC685 pgTAP asserts only the eighteen-member named API.
- **Proposed text**: The eighteen named RPCs cms_create_type_draft through cms_list_capability_grants are members of the SQL API set that AC180 enumerates exactly, and anon and authenticated hold no direct INSERT, UPDATE or DELETE on the tables.
- **Authority**: none yet: consequence of the AC180 ruling
- **Evidence**: `supabase/tests/phase_02_slice_09_r3_grants_misc.sql`; `tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts`
- **Owner decision**: ratify the proposed text, or keep the current text and accept its defect.
