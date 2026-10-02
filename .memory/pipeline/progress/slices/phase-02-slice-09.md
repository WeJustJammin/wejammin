# Phase 2 / Slice 09: Content schemas, relations, activation, and block registry

**Status**: in-progress  
**Complexity**: L  
**Surface scope**: web  
**Depends on**: Slices 07 and 08  
**Spec depth floor**: 1239  
**Acceptance criteria (authored)**: 1239  
**Active release denominator**: 1235 (the 279 pre-amendment active criteria plus 956 DEC-108/109/110/111/119/120 criteria; AC266 owner-deferred under DEC-101; AC209 and AC211 deferred under DEC-104; AC265 deferred to pre-release under DEC-105)  
**Current active verification**: 1202/1235 verified; 17 CMS-03A-04 activation-chain criteria reopened 2026-09-30, plus AC250 separately reopened 2026-09-30 and Chrome-reverified and closed 2026-10-01; AC019, AC039, AC043, AC054, AC100, AC143, AC181, AC196, AC215, AC222, AC259, AC264 and AC273 reopened 2026-10-02 under the DEC-108 accounting; 956 new criteria AC284-AC1239 added open; the 2026-10-02 evidence index re-verified the 17 activation-chain criteria and every reopened or new criterion it verifies, and lists the rest as open
**Slice 09 implementation-completion denominator**: 1235  
**Phase 2 implementation-completion denominator**: 2967  
**Slice 10 implementation prerequisites**: completion of the amended Slice 09 activation criteria: the 17 reopened activation-chain criteria, AC019, AC039, AC043, AC054, AC100, AC143, AC181, AC196, AC215, AC222, AC259, AC264 and AC273 reopened under the DEC-108 accounting, and the 956 open DEC-108/109/110/111/119/120 criteria AC284-AC1239; AC250 is separately verified and no longer blocking; AC265 remains a separate pre-release gate. Since the 2026-10-02 evidence closure the criteria still open are those listed in the open-criteria block below, and Slice 10 stays blocked until they complete. Since the 2026-10-02 evidence closure the criteria still open are those listed in the open-criteria block below, and Slice 10 stays blocked until they complete. Since the 2026-10-02 evidence closure the criteria still open are those listed in the open-criteria block below, and Slice 10 stays blocked until they complete. Since the 2026-10-02 evidence closure the criteria still open are those listed in the open-criteria block below, and Slice 10 stays blocked until they complete.
**Authored criterion policy**: Slice 09 is **1202/1235 active**; 1239 authored Slice 09 IDs remain, with AC209, AC211, AC265, and AC266 authored and unchecked outside the active implementation denominator. The 17 reopened activation-chain criteria, AC019, AC039, AC043, AC054, AC100, AC143, AC181, AC196, AC215, AC222, AC259, AC264, AC273 and the 956 new amendment criteria are inside it, and AC250 - separately reopened 2026-09-30 - is Chrome-verified and closed 2026-10-01 outside that set.
**AC209 evidence status**: production-rollout/post-deployment evidence gate; remains authored and unchecked. Does not gate Slice 10 implementation or the initial controlled production deployment, and must pass before alerting is declared ready. The delivered 2026-09-22 alert is digest-correlated to Cloudflare's Email Routing event, but Email Sending still reports zero rows. Cloudflare case 02343626 was reopened on 2026-10-01 with a redacted configuration follow-up and awaits provider diagnosis; [provider follow-up evidence](../verification/2026-10-01-ac209-cloudflare-support-follow-up.md).  
**AC211 evidence status**: post-launch operational SLO acceptance; remains authored and unchecked. Does not gate the initial launch and is mandatory after initial launch.  
**AC265 evidence status**: mandatory pre-release hosted acceptance; remains authored and unchecked. AC265 is a mandatory pre-release gate and does not block Slice 10 implementation. Nine real staging role cases, ten hosted scenarios, signed exact artifact provenance, and the authenticated receipt are still required before release.  
**AC266 evidence status**: owner-deferred pre-release gate — AC266 is a mandatory pre-release production-readiness/release gate; remains unchecked and **open** and excluded from active Phase 2 implementation completion; not passed, accepted, waived, simulated, or inferred. It has no proven standalone acceptance path until the hosted-scope acceptance route binds its separate manual and axe verifiers.  
**AC265 local producer checkpoint (2026-09-30)**: Exact CI/staging artifact IDs now bind the authenticated API resolution, ID-based downloads, and later collector verification; staging-scope verification also binds the authenticated run/attempt, validates its output root, and strictly bounds the protected bundle. Pinned `pnpm validate` passed at that checkpoint, but these are local safeguards only and AC265 remains unchecked. [Evidence and remaining boundary](../verification/2026-09-30-ac265-exact-artifact-and-staging-scope-binding.md).  
**AC265 report-artifact timestamp checkpoint (2026-09-30)**: The hosted report verifier now requires a real `updated_at` and rejects noncanonical artifact/run timestamps before treating an artifact as inside the authenticated attempt window. Fresh pinned `pnpm validate` passes; AC265 remains unchecked pending genuine hosted evidence. [RED→GREEN and final gate](../verification/2026-09-30-ac265-report-artifact-timestamp-boundary.md).  
**AC265 staging-root filesystem checkpoint (2026-09-30)**: The local hosted-staging CLI now rejects symlinked roots or ancestors and missing or non-directory roots with `AC265_HOSTED_SCOPE_FAILURE` before any GitHub fetch or manifest write. Four adversarial cases were RED against lexical validation; the expanded CLI suite is GREEN 16/16 and the combined AC265 hosted set is GREEN 40 files / 477 tests. Fresh pinned `pnpm validate` passes, but this is only a local filesystem safeguard. AC265 remains unchecked pending nine real hosted role cases, ten hosted scenarios, signed exact artifact provenance, and the authenticated receipt. [Local checkpoint](../verification/2026-09-30-phase2-local-contract-and-scope-checkpoint.md).  
**Pre-activation dry-run producer audit (2026-10-01)**: The migration worker's dry-run finalizer requires a plan that production only inserts during activation, while activation requires the report first. The existing first-version zero-row report does not cover successor migration, and no production pre-activation trigger is defined by the locked eight-operation BE03a surface. AC087 and the 17 reopened activation-chain criteria remain open at **261/279 active** pending the trigger decision and the separate acting-context/review-authority decisions. [Evidence](../verification/2026-10-01-slice-09-dry-run-producer-audit.md).  
**Activation authority decision package (2026-10-01)**: [Open options and exact trust-boundary gaps](../verification/2026-10-01-slice-09-activation-decision-package.md) cover CMS review authority, a stable server-derived actor/binding context, protected successor authoring, and pre-activation dry-run initiation. No locked contract or criterion has changed.  
**AC169 local compatibility guard checkpoint (2026-10-01)**: Forward-only migrations `20260930160000_cms_template_binding_compat_guard.sql` and `20260930161000_cms_template_binding_uuid_identity.sql` reject cross-owner or incompatible template references at draft binding/default writes and recheck persisted references at the activation state switch. The pgTAP suite `phase_02_slice_09_template_compat_guard.sql` showed RED before the guard and GREEN 15/15 after the UUID-identity correction; local `pnpm db:test` passed 89 files / 3,016 assertions. Fresh pinned Node 22.23.1 / pnpm 11.24.0 `pnpm validate` passed (769 coverage test files, 6,643 tests passed / 1 skipped, Chrome E2E, build, bundle, and local performance smoke). This is a local fail-closed invariant only: no real template activation, successor-draft, review, acting-context, or migration dry-run producer is established, so AC169 and all 18 reopened criteria remain unchecked at **261/279 active**.  
**Private acting-context binding checkpoint (2026-10-01)**: Forward-only `20261001120000_auth_session_read_private_binding_id.sql` adds the validated active binding row ID as `actingContextId` to the service-role-only `auth_session_read` response, with explicit null for absent or unbound selectors. The added pgTAP assertions were RED 3/13 before the migration and GREEN 13/13 after local incremental apply; adjacent auth-session suites passed 45/45. Fresh pinned `pnpm validate` exited 0 (769 Vitest files, 6,643 passed / 1 skipped, 100% configured coverage, Chrome E2E, builds, bundle, local performance), and `pnpm db:test` passed 89 files / 3,020 assertions. The public session resource remains unchanged; the Worker still drops the private ID, activation still lacks a production CMS review and dry-run producer, and all 18 reopened criteria remain unchecked at **261/279 active**.  
**Trusted Worker capture checkpoint (2026-10-01, supersedes the preceding Worker-drop statement)**: RED→GREEN authentication tests now carry the validated `actingContextId` through both access and refresh resolution into the internal `AuthenticationSession`; malformed private values fail closed as `DEPENDENCY_INVALID_RESPONSE`. The public session resource excludes the ID. Separate registry tests were RED 3/6 before capture and GREEN 6/6 after `ServerSessionContext` retained it only in a request-keyed WeakMap; the content-registry suite passed 50 files / 325 tests. The eight existing RPC contexts/bodies, responses, and telemetry remain ID-free. Fresh pinned `pnpm validate` exited 0 (770 Vitest files, 6,651 passed / 1 skipped, 100% configured coverage, Chrome E2E, builds, bundle, local performance); `pnpm db:test` passed 89 files / 3,020 assertions after the SQL migration. `contextFor` still omits `actingContextId`, and CMS review, dry-run, and activation authority remain unresolved. No criterion closed: **261/279 active**.  
**Hosted-only evidence contract checkpoint (2026-10-01)**: DEC-104's strict four-member hosted evidence shape and hosted-only expected identity now have RED→GREEN contract tests. The production sidecar still requires AC209 alerting and AC211 SLO evidence. Full pinned `pnpm validate` passed (771 Vitest files, 6,662 passes and one skip, configured 100% coverage, Chrome E2E, build, bundle, and local performance). This is an additive contract only: no authenticated AC266 consumer yet binds the retained hosted report, candidate axe bytes, and both real-device manual reports, so AC265/AC266 remain unchecked. [Verification record](../verification/2026-10-01-slice-09-hosted-scope-contract-checkpoint.md).  
**Hosted-only identity follow-up (2026-10-01)**: The separate RED→GREEN identity verifier checks the four-member evidence against a staging-only expected identity, artifact SHA/digest, deployment, origins, cutoff, and chronology; a self-consistent production-target payload is rejected. The two new suites pass 24/24, and subsequent full pinned `pnpm validate` exits 0 (772 Vitest files, 6,675 passes and one skip, configured 100% coverage, Chrome E2E, build, bundle, and local performance). This does not authenticate exact retained report bytes or produce the AC266 consumer; AC265/AC266 stay unchecked, and Slice 09 remains **261/279 active**. [Verification record](../verification/2026-10-01-slice-09-hosted-scope-contract-checkpoint.md).  
**Hosted retained-byte and AC266 artifact-ID continuation (2026-10-01)**: The additive hosted-only consumer now binds a branded candidate's authenticated API artifact identity/length and validated axe digest to a protected V3 hosted report, exact retained manual bytes, the staging identity, and a trusted cutoff. The CI archive digest and deployment-manifest digest remain distinct; the production sidecar verifier is unchanged. The AC266 collector now resolves candidate/intake artifact IDs through authenticated GitHub run/artifact responses and downloads by ID with digest mismatch fatal. Focused pinned provenance/hosted/retained tests pass 35/35; corrected full pinned `pnpm validate` exits 0 (774 Vitest files, 6,697 passes / one skip, configured 100% coverage, 105 functional and twelve production-built Chrome tests, build, bundle, local performance). This is local byte-verification plumbing only: no protected hosted-scope acceptance workflow, real hosted matrix, or real-device manual reports exist; AC265/AC266 remain unchecked and Slice 09 remains **261/279 active**. [Verification record](../verification/2026-10-01-slice-09-hosted-scope-contract-checkpoint.md).  
**Plan source**: [Phase 2 plan](../../../wiki/specs/phases/phase-2.md)  
**Activation re-audit (2026-09-30)**: Read-only cross-layer inspection found no production source for the CMS-03A-04 `actingContextId` or CMS candidate review/approval evidence required by the private activation RPC; the Worker sends a context shape its nested gate rejects. The recorded 279/279 active result predated this finding and is superseded: the 17 CMS-03A-04 activation-chain criteria below are reopened as `261/279 active` (seventeen activation-chain criteria plus the separately reopened AC250), and the prior `279/279` checkpoint is not proof that activation works end-to-end. Evidence: `platform_private.cms_exact_keys(p_request->'context', array['actingContextId'], array['actingContextId'])` and the `STEP_UP_REQUIRED` gate in `supabase/migrations/20260902080000_content_schema_registry_authority.sql`; `contextFor` in `apps/worker/src/content-schema-registry/production-context.ts` emits `authUserId/sessionId/actorPersonId/actingPartyId/stepUpVerified` with no `actingContextId`; the only `actingContextId` producer is the web identity-authority boundary; and the SQL fixture `supabase/tests/phase_02_slice_09_schema/002b-activation-fixture.sqlinc` hand-builds both `actingContextId` and `cfg_config_change_reviews` rows. Reopen set: AC-087, 089, 090, 091, 092, 093, 095, 096, 097, 098, 099, 101, 102, 169, 191, 217, 225. Reproduce with a RED integrated authority test and reconcile the affected acceptance criteria before relying on this count for Phase 2 closure. No gate was weakened, no criterion waived, and no synthetic acceptance claimed.  
**Preflight gate**: strict current-disk floor reconciled — [contract reconciliation](../verification/2026-09-02-slice-09-contract-reconciliation.md)
**Local QA-GREEN (historical, 2026-09-26)**: 279/279 verified at that checkpoint; 283 authored IDs remain — [evidence and external gates](../../../wiki/specs/audits/phase-02-slice-09-qa-green.md). Superseded by the 2026-09-30 activation re-audit for the 17 reopened CMS-03A-04 activation-chain criteria.

## 2026-10-01 Activation remediation dispatch (owner-approved 2026-10-02 as DEC-108; depth-floor cascade recorded 2026-10-02)

The [concrete producer amendment](../verification/2026-10-01-slice-09-activation-contract-amendment-proposal.md)
was owner-approved 2026-10-02 as DEC-108
[approval record](../verification/2026-10-02-slice-09-activation-amendment-approval.md).
It includes narrow review assignments and the source/template dependency
correction. The depth-floor cascade is recorded below and in the [2026-10-02 ledger](../verification/2026-10-02-slice-09-dec108-depth-floor.md); the pre-cascade baseline was 262/279 active with 283 authored IDs. Slices 10 and 12 remain gated.

**Source cascade (2026-10-02)**: The DEC-108 BE source cascade is frozen — BE03a
owns fourteen operations (CMS-03A-01…08 unchanged plus CMS-03A-09…14; eleven
mutations and three protected reads 06/07/13), fifteen canonical tables (the
twelve definition tables plus private `cms_schema_reviews`,
`cms_schema_review_decisions`, `cms_schema_review_assignments`), and fourteen
listed RPCs including the 03c reciprocal
`cms_resolve_template_compatibility`. Prerequisites moved into S09 scope are
03b `CMS-03B-10` / `CMS-03B-11` / `CMS-03B-01` and 03c `CMS-03C-01` plus that
resolver; public template activation stays a separate Slice 12 gap. The FE03
source is still being finalized. Contract Phase 0 (typed contracts,
platform-registry entries, and generated OpenAPI only — no handlers, DB, or
tests) is dispatched to the backend source owner under root authorization. This is
spec/contract planning only; the FE source and the depth-floor cascade are frozen below.

**Depth-floor cascade (2026-10-02)**: The amended sources (IA03 and deep dive, BE03a,
BE03b/BE03c consumed boundaries, BE01a, BE00, BE05b, FE00, FE01, FE03, FE05) were
re-read and frozen, the per-item formula in `slice-depth-floor.md` was applied once
per item, and the [ledger](../verification/2026-10-02-slice-09-dec108-depth-floor.md) records every row with its source
line, digest and disposition. The delta is **956** new open criteria,
P2-S09-AC-284 through P2-S09-AC-1239, with an authored floor of 283 + 956 = **1239**
and an active denominator of 279 + 956 = **1235**:

  - 344 BE03a operations CMS-03A-09 to CMS-03A-18
  - 70 BE03a cross-cutting (activation, persistence, events, observability)
  - 13 BE03c template-compatibility resolver
  - 6 Integrated producer paths
  - 201 BE01a/BE00/BE01c DEC-111 step-up and MFA
  - 31 BE05b CFG-05B-06 admin MFA factor reset
  - 109 FE03 review, dry-run and grant surfaces
  - 50 FE01 step-up and TOTP pages
  - 19 FE05 admin MFA reset form
  - 1 FE00 step-up mapping
  - 15 IA03/IA01 edge cases
  - 8 Engineering and traceability
  - 89 OD-4 locale configuration (BE03a, FE03, IA03)

The DEC-108 accounting (D4, ledger section "Accounting for checked criteria")
reopened AC019, AC039, AC043, AC054, AC100, AC143, AC181, AC196, AC215, AC222, AC259, AC264 and AC273: the universal every-row, every-field and every-table claims
that the amended surface falsified, and the exact-shape claims that the OD-4
locale configuration changed. It reworded AC018, AC022, AC030, AC032, AC165,
AC178, AC180, AC208, AC214, AC221, AC255 and AC269, and scoped the cross-cutting
claims listed in the ledger table, to explicit A01-A08 scope where the original
evidence still proves it; AC089, AC091 and AC099 (open) were amended to the
CMS-owned approval and advance-only plan contracts. Verified active is
therefore **249/1235**, Phase 2 is **2971 authored / 2967 active** with
**1462** active-checked, and Slices 10 and 12 stay gated on the amended criteria.
No new criterion is checked; each stays open until its real implementation path is
verified. DEC-120 (standing CMS grants up to 90 UTC days; assignments stay at seven
days) is included in the delta sources.

**Evidence closure (2026-10-02)**: the generated [amendment evidence index](../../../../tests/contracts/phase-02-slice-09-amendment-evidence.ts) merges the database, Worker, authentication, web and consumer evidence lanes and lists, per verified criterion, the command, test files and markers that must exist; plan and tracker mark exactly those criteria [x], the guard `tests/contracts/phase-02-slice-09-amendment-evidence.test.ts` keeps both in step, and `tests/contracts/phase-02-slice-09-ledger-guard.test.ts` closes AC273 and AC1148 against the depth-floor ledger. AC300, AC678, AC774, AC1031 and AC1166 were reworded by the 2026-10-02 rulings recorded in the ledger. Verified active is now **1202/1235**.

<!-- s09-open:start -->

**Open after the 2026-10-02 evidence closure** (generated by the merge script; the executable index
`tests/contracts/phase-02-slice-09-amendment-evidence.ts` carries the same list as `S09_AMENDMENT_OPEN`).
AC209, AC211, AC265 and AC266 are the deferred gates and stay outside the active denominator.

- AC222 (deferred-e4): Open: the web lane (E4) recorded no evidence entry for this FE03 row and the Worker lane deferred it to E4. The CMS-03A-01 form sends only the named ContentTypeDraftRequest fields including supportedLocales and fallbackChains still needs marker-bearing web ...
- AC225 (deferred-e4): Open: the web lane (E4) recorded no evidence entry for this FE03 row and the Worker lane deferred it to E4. The CMS-03A-04 confirmation request and response mapping still needs marker-bearing web or integration evidence.
- AC259 (deferred-e4): Open: the web lane (E4) recorded no evidence entry for this FE03 row and the Worker lane deferred it to E4. The every-field FE03 mapping of BE03a request, response and error fields including the OD-4 members still needs marker-bearing web or integration evi...
- AC264 (deferred-e4): Open: the web lane (E4) recorded no evidence entry for this FE03 row and the Worker lane deferred it to E4. The generated-fixture integration proof of all eight original operation mappings with the activationPreparation member and the OD-4 locale fields sti...
- AC678 (gap): Reworded to the provisional-fingerprint contract; no marker-bearing pgTAP assertion yet proves that cms_schema_migration_plans.dry_run_report is NOT NULL and carries the fingerprint shape (dryRunId, source, target, compiler and transform hashes, zero counte...
- AC910 (deferred-browser): Production-built Chrome scenario: from a CMS grant form at /app/<path>?x=1 trigger a stale-proof 401; the page must navigate to /step-up?returnTo=%2Fapp%2F<path>%3Fx%3D1; repeat with an unsafe current path (scheme, //authority, backslash, control character,...
- AC911 (deferred-browser): Production-built Chrome scenario: after completing /step-up the browser returns to the originating form, the interrupted command is not replayed automatically (assert no network request until the user submits), the scoped draft is restored and the resubmiss...
- AC1019 (deferred-browser): Back-button restoration of list selection needs a real browser history stack. Scenario: open the registry list with a filter and selection, open a review, press Back; the list selection and filter are restored and the address never contained a reviewer or p...
- AC1033 (deferred-browser): Responsive layout is CSS. Scenario: production-built review route and version page at 375 px in Chrome with the virtual keyboard open; schema-review forms are one column with labels above, the step-up confirmation is visible, the action bar is not covered b...
- AC1034 (deferred-browser): Tablet layout is CSS. Scenario: production-built review route at 768 px; independent fields sit in two columns while the decision and assignment forms keep the evidence summary and the prior step-up disclosure in view.
- AC1035 (deferred-browser): Desktop grouping is CSS. Scenario: production-built review route at 1280 px; the forms are grouped with the review summary and the action rail cites the frozen review version and the server-permitted next actions.
- AC1036 (deferred-browser): Mobile priority-list layout is CSS. Scenario: production-built /app/cms-content-modeling/capability-grants at 375 px; rows show capability, state and valid-through with expandable facts, forms are single column and confirmation is a separate review step.
- AC1037 (deferred-browser): Tablet layout is CSS. Scenario: production-built grant console at 768 px; the table keeps row-detail expansion and the grant form sits below it.
- AC1038 (deferred-browser): Desktop arrangement is CSS. Scenario: production-built grant console at 1280 px; a compact semantic table with sortable headers sits beside the grant form and renew and revoke open inline on the row.
- AC1071 (deferred-browser): The priority-list layout on mobile is CSS. Scenario: production-built /settings/security/mfa at 375 px with several factors; the table collapses to a priority list with no horizontal scroll and the reconciling row still shows Checking status and its refresh...
- AC1104 (deferred-browser): Target size needs computed layout. Scenario: production-built /step-up and /settings/security/mfa at 375 px and 1280 px; every control measures at least 44 by 44 CSS px on mobile and at least 24 by 24 CSS px elsewhere.
- AC1105 (deferred-browser): Layout is CSS. Scenario: production-built /settings/security/mfa at 375 px during enrollment; one column with the QR above the key and field, a full-width field, 44 px buttons and the action bar clear of the virtual keyboard.
- AC1106 (deferred-browser): Layout is CSS. Scenario: production-built enrollment at 768 px; the QR and manual key sit side by side when the container permits.
- AC1107 (deferred-browser): Layout and reflow are CSS. Scenario: production-built enrollment at 1280 px and 320 px; two columns with the QR left and the steps right, a compact semantic factor table, and no horizontal page scroll at 320 CSS px.
- AC1126 (deferred-browser): 44 by 44 px targets and the single-column stack at every width need computed layout. Scenario: production-built /app/platform-configuration-admin/mfa-reset at 320, 768 and 1280 px; every control measures at least 44 by 44 px and the form remains one column.
- AC1128 (no-evidence-lane): No evidence lane produced an entry for this criterion.
- AC1129 (no-evidence-lane): No evidence lane produced an entry for this criterion.
- AC1130 (no-evidence-lane): No evidence lane produced an entry for this criterion.
- AC1131 (no-evidence-lane): No evidence lane produced an entry for this criterion.
- AC1132 (no-evidence-lane): No evidence lane produced an entry for this criterion.
- AC1133 (no-evidence-lane): No evidence lane produced an entry for this criterion.
- AC1134 (no-evidence-lane): No evidence lane produced an entry for this criterion.
- AC1135 (no-evidence-lane): No evidence lane produced an entry for this criterion.
- AC1136 (no-evidence-lane): No evidence lane produced an entry for this criterion.
- AC1137 (no-evidence-lane): No evidence lane produced an entry for this criterion.
- AC1138 (no-evidence-lane): No evidence lane produced an entry for this criterion.
- AC1236 (deferred-browser): Ordinal text and ordered-list semantics pass in jsdom; the 24 CSS px target size needs computed layout in a production-built Chrome run at 320, 768 and 1280 px (E5).
- AC1237 (deferred-browser): Native lists, fieldsets and buttons pass in jsdom; keyboard reachability with no trap needs real Tab and Shift+Tab traversal in a production-built Chrome run (E5).

<!-- s09-open:end -->

- [x] `BE` trusted activation actor/binding transport
  - files: apps/worker/src/content-schema-registry/production-context.ts,
    apps/worker/src/content-schema-registry/production-activation-binding.test.ts,
    supabase/migrations/20261001191923_cms_activate_schema_trusted_binding_context.sql,
    supabase/tests/phase_02_slice_09_cms_activate_trusted_binding_context.sql
  - Owner: `/root` (DeepSeek patch handed back; root verified 13/13 pgTAP,
    90 files / 3,033 database assertions, and complete local validation).
- [x] `BE` exact existing BE00 step-up error recovery
  - files: apps/worker/src/content-schema-registry/production-errors.ts,
    apps/worker/src/content-schema-registry/route-human-handlers.ts,
    apps/worker/src/content-schema-registry/phase-02-slice-09-step-up-required-mapping.test.ts
  - Owner: `/root` (DeepSeek mapping patch handed back; complete local
    validation passed; this does not implement MFA enrollment/challenge).
- [x] `BE` preserve exact step-up details at the HTTP disclosure boundary
  - files: apps/worker/src/content-schema-registry/route-response-details.ts,
    focused HTTP response tests
  - Owner: `/root` (fresh `/root/cms_step_up_wire_cc` DeepSeek handoff;
    actual wire test 7/7; complete local validation passed).
- [x] `FE` safe acting-context and expiring MFA disclosure
  - files: content-schema-registry confirmation/form/workbench components,
    web context presentation and acting-context reader/tests,
    apps/worker/src/content-schema-registry/production-auth.ts,
    apps/worker/src/content-schema-registry/types.ts,
    apps/worker/src/content-schema-registry/route-response.ts,
    apps/worker/src/content-schema-registry/route-execution.ts,
    apps/worker/src/content-schema-registry/ac250-step-up-disclosure.test.ts
  - Owner: `/root` (DeepSeek patch handed back; root corrected deterministic
    fixture clock and verified the real page-to-island render; complete
    local validation passed; AC250 was later reopened and then Chrome-verified and closed 2026-10-01).

- [x] `QA` production-built Chrome AC250 confirmation evidence
  - files: tests/e2e/phase-02-slice-09-confirmation-disclosure-real-route.spec.ts,
    playwright.s09-real.config.ts, playwright.config.ts
  - Owner: `/root/s09_ac250_chrome_qa_cc` (DeepSeek; final 6/6 GREEN at
    23:06 UTC, exit 0, retained passed run, 2026-10-01).
- [x] `QA` Slice 09 tracker local source-link resolution
  - files: tests/contracts/phase-02-slice-09-source-links.test.ts,
    .memory/pipeline/progress/slices/phase-02-slice-09.md
  - Owner: `/root/s09_ac250_chrome_qa_cc` (DeepSeek; RED 282 broken local
    criterion/tracker links then GREEN 4/4 after four verified target
    replacements; documentation-traceability only, not activation acceptance).
- [x] `QA` signed local disclosure fixture wiring
  - files: tests/e2e/support/content-schema-registry-api.ts,
    tests/e2e/support/s09-session-authority.ts,
    tests/e2e/support/s09-disclosure-fixture.ts,
    tests/e2e/support/s09-disclosure-fixture.test.ts,
    tests/e2e/support/README.md
  - Owner: `/root/cms_step_up_wire_cc` (DeepSeek; RED then GREEN, focused
    unit 9/9 on the frozen fixture; no production authority, provider,
    account, or grant changes).
- [x] `QA` React-owned refresh feedback regression transfer
  - files: apps/web/src/components/content-schema-registry/content-schema-registry-island-refetch-feedback.dom.test.tsx
  - Owner: `/root/s09_refetch_feedback_tests_cc` (DeepSeek; 3/3 GREEN at
    23:04:47 on the frozen production source, 2026-10-01).
- [x] `FE` canonical refetch ownership and nonce-safe parsing repair
  - files: apps/web/src/components/content-schema-registry/ContentSchemaRegistryWorkbenchIsland.tsx,
    apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-refetch.ts,
    apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-refetch-boundary.ts,
    apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-refetch-project.ts,
    apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-refetch-project.test.ts,
    apps/web/src/components/content-schema-registry/content-schema-registry-island-props-scanner.ts,
    apps/web/src/components/content-schema-registry/content-schema-registry-island-props-scanner.test.ts,
    apps/web/src/components/content-schema-registry/content-schema-registry-island-props-codec.ts,
    apps/web/src/components/content-schema-registry/content-schema-registry-canonical-state-validate.ts,
    apps/web/src/components/content-schema-registry/content-schema-registry-canonical-projection-state.ts,
    apps/web/src/components/content-schema-registry/content-schema-registry-canonical-keys.ts,
    apps/web/src/components/content-schema-registry/content-schema-registry-canonical-read.ts,
    apps/web/src/components/content-schema-registry/content-schema-registry-canonical-refresh-scheduler.ts,
    apps/web/src/components/content-schema-registry/content-schema-registry-island-refetch.dom.test.tsx,
    apps/web/src/components/content-schema-registry/content-schema-registry-island-refetch-success.dom.test.tsx,
    apps/web/src/components/content-schema-registry/content-schema-registry-island-refetch-navigation.dom.test.tsx,
    apps/web/src/components/content-schema-registry/content-schema-registry-island-refetch.test-support.ts,
    apps/web/src/components/content-schema-registry/content-schema-registry-island-confirmation-reset.dom.test.tsx,
    apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-refetch.test.ts,
    apps/web/src/components/content-schema-registry/content-schema-registry-types.ts,
    apps/web/src/components/content-schema-registry/ContentSchemaRegistryWorkbench.tsx,
    apps/web/src/components/content-schema-registry/ContentSchemaRegistryActivationForm.tsx,
    apps/web/src/components/content-schema-registry/ContentSchemaRegistryConfirmationStep.tsx,
    apps/web/src/components/content-schema-registry/ContentSchemaRegistryStepUpDisclosure.tsx,
    apps/web/src/components/content-schema-registry/content-schema-registry-confirmation-disclosure.dom.test.tsx,
    apps/web/src/components/content-schema-registry/ContentSchemaRegistryStatus.tsx,
    apps/web/src/components/content-schema-registry/README.md,
    apps/web/src/pages/app/cms-content-modeling/[contentTypeId]/versions/[versionId].astro
  - Owner: `/root/s09_ac250_browser_failures_cc` (DeepSeek; live Chrome probe
    confirms React ownership loss and refetch nonce mismatch; production
    React-state repair approved after rejecting stale-authority retention;
    existing favicon reuse and failing-first regressions authorized;
    no CSP relaxation, new endpoint, authority prop, or privacy model).

Root owns contracts and tracking. Independently reproduced RED: the Worker
disclosure test was 2 failed / 3 passed before the additive private freshness
header constant. The initial full `pnpm validate` attempt passed contracts,
local database types and progress checks, then exited 1 on formatting in
three in-flight disclosure files. This is not final validation or acceptance.
The 17 reopened activation-chain criteria remain unchecked at **262/279 active**; the separately reopened AC250 is Chrome-verified and closed, Phase 2 **8/17**.

The subsequent focused Worker/header/label-parser snapshot passed 13/13,
but root's production-call-site audit found both label and expiry helper
functions orphaned from the actual page loader. That snapshot is therefore
not end-to-end AC250 evidence. The disclosure agent was returned to RED for
the protected loader-to-island-to-confirmation path, including authorized
context matching and fail-closed fallback. No criterion or total is promoted.

[Local transport/disclosure verification](../verification/2026-10-01-slice-09-activation-transport-and-disclosure.md)
records root binding/privacy verification (**10/10**), production-call-site
audit, the combined **22/22** focused snapshot, database RED→GREEN (**13/13**),
the complete database pass, and fresh pinned `pnpm validate` exit 0:
**781 Vitest files, 6,745 passed / 1 skipped**, configured 100% coverage,
**105 functional + 12 production-built Chrome checks**, builds, bundles,
and local performance. These narrow task completions do not close the 18
reopened criteria or unblock Slices 10–17.

The subsequent [production-built AC250 Chrome diagnostic](../verification/2026-10-01-slice-09-ac250-chrome-diagnostic.md)
records a new six-check baseline at 6 failed / 0 passed. A separate read-only
Chrome probe confirms that canonical DOM replacement orphans React handlers
and parsing the refetch response's style violates the original document nonce
policy. The earlier full validation is not a pass for these subsequent changes.

## 2026-10-01 AC250 confirmation disclosure verification (current checkpoint)

**Current status**: AC250 is verified and closed. The production-built Chrome
AC250 suite passed **6/6 GREEN at 23:06 UTC with exit 0** against the retained
run (passed status, no failed tests, exact spec digest 8df7c7bd...332ea), and
the independent actual-React feedback suite passed **3/3 GREEN at 23:04:47**
with the final post-format component suite GREEN **27 files / 165 tests** at
23:54 UTC on the frozen production source. Root authored this reconciliation; the
tracked [Chrome diagnostic](../verification/2026-10-01-slice-09-ac250-chrome-diagnostic.md)
and session documents remain root-owned.

**Count**: Slice 09 is **262/279 active** (**283 authored IDs**). Phase 2
records **1,475/2,011 active-checked** and stays **8/17**; the overall index
stays **15/24**, Slice 10 stays **0/75**, and Slice 12 stays **0/50**. The 17
CMS-03A-04 activation-chain criteria remain reopened and inside the
denominator, and AC209, AC211, AC265, and AC266 remain authored, unchecked, and
outside it.

**Scope of the claim**: this is a local production-built Chrome verification of
the AC250 disclosure clause only. It is not real MFA, not an activation
success, not hosted, provider, or whole-slice acceptance. Fresh full canonical
validation now passes locally (790 Vitest files, 6,812 passes plus one skip,
105 functional Chrome and 18 production-built route checks, build, bundle and
local smoke); it does not close the activation criteria. The producer contract
amendment was owner-approved 2026-10-02 as DEC-108; its plan/count and
depth-floor cascade is pending the BE/FE source freeze, so every count in this
checkpoint remains the pre-cascade baseline.

**Supersedes for the AC250 count**: the 2026-09-30 AC250 reopen record below and
its 2026-10-01 scope-clarification paragraph. Every dated 261/279 checkpoint in
this tracker remains historical evidence.

## 2026-10-01 Slice 09 tracker source-link repair (QA)

Colocated contract test `tests/contracts/phase-02-slice-09-source-links.test.ts`
reads the tracker and the filesystem (no mocks) and asserts that every authored
criterion row cites an existing local file and that every local tracker link
resolves on disk. RED: **282 broken local criterion citations and 282 broken
tracker links**. GREEN **4/4** after four verified target replacements only -
Architecture phasing (17), BE03a (200), FE03 (48), ENGINEERING-STANDARDS (17),
all 282 into `wiki/specs/...`; the nine other wiki-operation links already
resolved and are untouched. No criterion wording, checkbox, capability, or
count changed (**262/279 active**, 283 authored, 17 activation-chain open, 4
deferred). This is documentation-traceability evidence only and is not
activation, hosted, or whole-slice acceptance.

Fresh serial full `pnpm validate` started **2026-10-02T00:13:16Z**, handle
20339, and completed with actual `VALIDATE_EXIT=0` at
`/tmp/wejammin-validate-qGKqtS/validate.log`: 790 Vitest files, 6,812 passed
plus one skip, 100% configured coverage, bounded evidence, 105 functional and
18 production-built Chrome tests, builds, bundle budgets and local smoke all
pass. Root verified the terminal log, coverage summary, passed browser metadata
and the unchanged source-guard hash. This closes no additional criterion.

## 2026-09-30 Activation re-audit reopen (historical; superseded for the AC250 count on 2026-10-01)

**AC250 separate reopen (2026-09-30, historical; superseded by the 2026-10-01 Chrome verification)**:
The checked state at this criterion contradicted the Phase 2 plan row, which has
always been open. The criterion requires the high-risk activation confirmation to
expose consequence, scope, version, acting context, and step-up.
`ContentSchemaRegistryConfirmationStep` exposes consequence, affected scope,
expected version, step-up state, and the idempotency key, but no acting-context
value: there is no prop, field, or rendered region for it. A separate DOM suite
now passes 3/3 for heading focus, Escape cancellation/reset, and trigger return
focus; it cannot close the acting-context clause, so the whole criterion stays
open. The protected page's `actingPartyId` is only the selected party UUID, not
the `acting_context_binding.id` that `cms_activate_schema` verifies for recent
MFA; rendering that party ID as the activation context would misstate the
authority and expose an ownership identifier that BE03a keeps out of browser
response envelopes. The reopen itself was a tracking-only correction; the DOM
test adds no product authority. Slice 09 is **261/279 active**; AC250 is outside
the 17-criterion activation-chain set.

**AC250 scope clarification (2026-10-01, historical; superseded by the 2026-10-01 Chrome verification)**: Fresh locked-source review confirms
that the acting-context clause is a disclosure requirement, not proof of the
private activation binding. The earlier proposed choice between a binding
attestation and dropping the clause unnecessarily broadened AC250 and is
superseded. Its protected server-derived display label and step-up hint can be
verified by the real-page Chrome checks without changing the clause. Genuine
binding-bound MFA and activation acceptance remain separate open requirements
under AC091/AC225. AC250 itself remains unchecked pending the unchanged Chrome
rerun and faithful React-path regression/full validation; no count moves yet.

- Read-only cross-layer activation re-audit found the CMS-03A-04 authority chain
  cannot succeed as constructed in production. `cms_activate_content_schema_version`
  requires `context` to carry exactly `actingContextId`, resolves recent MFA from
  `platform_private.acting_context_binding` by that ID, and resolves approval
  evidence from `platform_private.cfg_config_change_reviews`.
- The production Worker path (`contextFor`) sends the richer
  `authUserId/sessionId/actorPersonId/actingPartyId/stepUpVerified` context and no
  `actingContextId`, so the nested exact-key gate rejects it before any authority
  check. No production CMS review/approval producer for
  `cfg_config_change_reviews` exists on this path; the passing SQL evidence hand-builds
  both `actingContextId` and the review/approval rows in a fixture.
- Consequently the 17 CMS-03A-04 activation-chain criteria are reopened and Slice 09
  is **261/279 active** (283 authored IDs). Slice 09 is no longer implementation-complete;
  Phase 2 returns to **8/17**. This is a truthful tracking correction only: no code,
  test, migration, deployment, or criterion was changed, weakened, or waived, and no
  synthetic or fixture evidence is counted as acceptance.
- Remaining owner decision: the activation-review source authority and trust model
  (how `actingContextId` and CMS review/approval evidence are produced in production),
  or an explicit amendment of the affected locked contracts.

## 2026-09-21 AC265 CP-04c hosted artifact foundation (local/private only)

- CP-04c adds strict Ed25519 attestation over exact artifact bytes and a
  branded resolver with exact artifact kind/reference/key/subject/run/candidate/
  runner bindings. The resolver bounds its source set at **256** entries and
  fails closed outside exact membership.
- PR #90 promoted this private foundation at exact main SHA
  `e7525fa9ea80bbdf2325e8ce08d18930d6485b15`; exact-main CI
  `35634692281` succeeded, and staging workflow `35635650934` failed on
  `run_attempt=1` only at transient web release-identity propagation before
  succeeding on `run_attempt=2`. Deployment `6574859596` succeeded at
  `https://staging.wejamm.in`; the exact staging endpoints now serve the
  `e7525fa9ea80bbdf2325e8ce08d18930d6485b15` main SHA. The CP-04c promotion
  record predates the CP-04d retry hardening now promoted in PR #91. Candidate
  artifact `10656615428` has digest
  `sha256:5568778c8bec9eacd8090ae2020518caa070ce82b1a901aa4c7fe9a95f03d592`;
  deployment evidence artifact `10655784856` has digest
  `sha256:02422c5ef8b4988fe50bdc7d02771c286ac81c148e51bac6bc80927736ec461d`;
  staging p95 was `49.30431599999997 ms` and the automated axe digest was
  `00968b6a806db4993ab895f83fcb592af81a65ec925f9b38e6aa3140c0f87d87`.
- This is a locally validated private construction foundation only. Upstream
  authenticated manifest/registry/run authority and the external replay ledger
  remain open; no hosted artifact, hosted matrix, independently authenticated
  receipt, or AC265 acceptance is claimed. Focused local verification passes
  **5 files / 74 tests** and `pnpm type-check` is green.
- At that checkpoint totals were unchanged: Slice 09 remained **279/282 active**
  (**283 authored IDs**), Phase 2 remained **8/17** with **1,999/2,000 active
  criteria**, AC209/AC211/AC265 were open, Slice 10 was locked, and AC266 remained
  owner-deferred as a mandatory post-Phase 2 production-readiness/release gate.

## 2026-09-21 AC265 CP-04d signed source-manifest and authority foundation (local/private only)

- CP-04d adds a strict signed artifact-source manifest with canonical code-point
  ordering, exact source references, a server-derived authorization window, and
  a manifest digest separate from the request hash.
- The authority ledger implements immutable reserve-to-finalize/readback state,
  concurrency-safe source bindings, and replay protection. Readback exposes
  truthful `sourceSetComplete` and `kindComplete` fields only; neither field
  asserts acceptance. Resolver, semantic-subject, and protected-context
  boundaries reject structural/callback-only substitutes and snapshot mutable
  inputs before use.
- Staging verification now prevalidates inputs and retries the complete release
  contract for **13 attempts at 5 seconds**. Known focused TypeScript evidence
  is **16 files / 104 tests**. Focused database authority evidence is **78/78
  assertions** and concurrency evidence is **6/6** (**84/84 total**). After a
  fresh reset, `pnpm db:test` passed **61 files / 2,208 tests**;
  `pnpm db:lint` passed with unrelated existing warnings, and
  `pnpm db:types:check` passed. Final local `pnpm validate` passed **562 files**
  with **4,498 passed + 1 skipped / 4,499**, 100% coverage (**13,184
  statements, 9,862 branches, 2,164 functions, 12,263 lines**); Slice 09
  evidence passed, Playwright passed **101/101 functional** and **5/5
  real-route** checks, builds and bundle budgets passed, and local API p95 was
  **1.2129150000000095 ms**. Final local `pnpm db:verify` passed after a fresh
  reset with migrations through `20260921050000`; database lint had existing
  warnings only, **61 files / 2,208 tests** passed, and generated types matched.
  The initial validate failure was root-caused to a fixture `PUBLIC_KEY_PEM`
  re-export issue; after the fix, focused **8/8** and **12-repeat** stability
  checks passed before the successful rerun.
- PR #91 merged to `main` at exact SHA
  `289ed3a2f4f92da383aa1464340f804777496257`; exact-main CI `35656504913`
  succeeded across all three jobs, and automatic staging run `35657406613`
  succeeded on `run_attempt=1` with deployment `6578526934`. Candidate artifact
  `10665966829` has digest
  `sha256:d51c0104d8ea7933e5d4a45af021b0ac2067a24150739390edb58e171cab827c`;
  deployment evidence artifact `10665756858` has digest
  `sha256:2724a98beb5e2152b7c601697c95042af508ee94d2e62da7ee143495362c9664`;
  source `artifactDigest` is
  `0e92da9874c0fae7e0d62fb4419678a83f00a8986087de558dc101c465451c04`;
  migration `20260921050000` and provider deployments
  `dac978c4-fe9d-4c86-9cf4-53d96a42d45e` and
  `b27ddb9f-0ab3-4c07-88da-5ff8ea0b2f7b` are recorded. Staging p95 was
  **29.956710999999927 ms** against the **500 ms** threshold; automated axe
  digest is `6a7f59d9792a176e3032a9b410c6a0c1bb03850f27ed2918bc98fe82fddbbcf4`,
  serious/critical **0/0**. These are exact-main CI and staging promotion
  proofs only; staging proof does not equal hosted AC265 acceptance. This
  remains local/private construction evidence: no hosted producer/source
  population, protected signer execution, retained hosted artifact,
  independently authenticated receipt, or complete hosted matrix exists.
  The fresh AC211 collection run `35673313035` passed preflight but failed
  closed for insufficient samples: `commands=0`, `protectedRpcs=0`,
  `acceptances=0`, `queueFirstAttempts=0`; `dataset=1`, `registry=0`,
  `productionRegistry=0`, and `releaseRegistry=0`. No artifact or SLO verdict
  exists, so AC211 remains open. At that checkpoint totals were **279/282 active**
  (**283 authored IDs**), **8/17** Phase 2 slices, and **1,999/2,000 active
  criteria**; AC209, AC211, and AC265 were open and Slice 10 was locked. AC266
  remained owner-deferred, and DEC-104 later moved AC209 and AC211 outside the
  active implementation denominator. See the [CP-04d
  verification record](../verification/2026-09-21-ac265-hosted-artifact-source-manifest.md).

## 2026-09-21 AC265 CP-04e protected publication (staging promotion only)

- Added the real protected context-capsule loader, exact CI/staging run,
  artifact, and archive-digest binding, quota-bounded ZIP handling, typed
  register/finalize/readback transport, canonical signing, finalized readback
  verification, and a main-only publication workflow retaining one allowlisted
  redacted bundle.
- Focused root verification passed **11 files / 52 tests**. Final local `pnpm
validate` passed **572 files** with **4,543 passed + 1 skipped / 4,544** and
  100% coverage. Fresh `pnpm db:verify` passed **62 files / 2,211 tests** after
  migration `20260921060000`.
- CP-04e is promoted through PR #93 at exact main SHA
  `15032d0e333c1931008c8d363a60a4840b3a6bb2`. Exact-main CI `35673427068`
  passed database `106574760348`, quality `106574760514`, and immutable-build
  `106576054809`; staging `35673923999` passed job `106576288369` with GitHub
  deployment `6581175667`. API deployment
  `62bb526d-3755-4f6d-a534-f798ae339248` published version
  `0164eae4-b06c-4e1e-a342-7cf6a3100bf5`; web deployment
  `62e2fbcb-c1f3-49a5-96cb-686b2cb20e3e` published version
  `87ec18d2-9075-4f76-a2ce-73d0124d028a`. Workspace, test, staging-candidate,
  and staging-deployment artifacts are `10672800366`, `10672235833`,
  `10672316126`, and `10672405997`; the internal manifest digest is
  `9192affb6097e48caf3aa86aa776a441f2031c2743f969cc1c2d244ed7148835`.
  Migration `20260921060000` is included. Staging p95 was **33.31 ms / 500 ms**
  across 20 samples with zero errors; accessibility was **0/0** across three
  routes. These are staging promotion proofs only, not production evidence or
  hosted AC265 acceptance. No protected context secret or signing configuration
  was populated and no genuine protected publication, retained hosted artifact,
  authenticated receipt, or complete hosted matrix ran. AC265 was open at that
  checkpoint. Totals were **279/282 active** (**283 authored IDs**), **8/17**
  Phase 2 slices, and **1,999/2,000 active criteria**; AC209/AC211 were open and
  Slice 10 was locked. AC266 remained owner-deferred, and DEC-104 later moved
  AC209 and AC211 outside the active implementation denominator. See the [CP-04e
  verification
  record](../verification/2026-09-21-ac265-hosted-artifact-source-manifest-publication.md).

## Tasks

- [/] Contract: existing locked contracts retained; DEC-108 owner-approved the
  missing producer/prerequisite amendment on 2026-10-02 and its plan/count and
  depth-floor cascade is recorded (956 new open criteria AC284-AC1239)
- [/] `QA` RED: existing tests retained; non-fixture producer/activation coverage
  remains open for the reopened and new amendment criteria
- [/] `BE` data, API, and policy implementation (missing production producers)
- [x] `FE` Astro SSR and bounded React-island implementation (AC250 disclosure
      clause Chrome-verified and closed 2026-10-01; full activation acceptance
      remains open)
- [/] `QA` GREEN, adversarial verification, and canonical validation (local
  transport/disclosure checkpoint passed 2026-10-01; reopened activation
  acceptance remains open. Historical promoted private foundation PR #91 main SHA
  `289ed3a2f4f92da383aa1464340f804777496257`; exact-main CI `35656504913`
  succeeded across all three jobs, and automatic staging run `35657406613`
  succeeded on `run_attempt=1` with deployment `6578526934`. Candidate
  artifact `10665966829` has digest
  `sha256:d51c0104d8ea7933e5d4a45af021b0ac2067a24150739390edb58e171cab827c`;
  deployment evidence artifact `10665756858` has digest
  `sha256:2724a98beb5e2152b7c601697c95042af508ee94d2e62da7ee143495362c9664`;
  source `artifactDigest` is
  `0e92da9874c0fae7e0d62fb4419678a83f00a8986087de558dc101c465451c04`;
  migration `20260921050000`; provider deployments are
  `dac978c4-fe9d-4c86-9cf4-53d96a42d45e` and
  `b27ddb9f-0ab3-4c07-88da-5ff8ea0b2f7b`; staging p95 was
  `29.956710999999927 ms` against the `500 ms` threshold; automated axe
  digest `6a7f59d9792a176e3032a9b410c6a0c1bb03850f27ed2918bc98fe82fddbbcf4`
  reported serious/critical `0/0`. These are exact-main CI and staging
  promotion proofs only; staging proof does not equal hosted AC265
  acceptance. Final canonical validation under
  exact Node `22.23.1` and pnpm `11.24.0` passed **551 Vitest files, 4,387
  passed + 1 intentional skip**, with **13,143/13,143 statements,
  9,850/9,850 branches, 2,160/2,160 functions, and 12,224/12,224 lines**
  at 100% coverage. The evidence-map gate passed; Playwright passed **101
  functional + 5 production-built Slice 09 real-route checks**. Builds,
  bundle budgets, and performance are green with API p95 **1.491154 ms**;
  `pnpm db:verify` passed **59 pgTAP files / 2,124 assertions**, with
  database lint and generated-type parity. Architecture compile passed
  **1,632 nodes / 10,125 edges** with 55 known lint issues. See the [CP-04b
  verification record](../verification/2026-09-21-ac265-approved-outage-target-registration.md).
  AC265 preflight `34824500796`
  passed, while authorization foundation run `34824651793` failed at
  `staging_prepare`; CP-01 is promoted and staging-green but seeds no
  target, while CP-02 is promoted but seeds no
  registry rows and does not establish hosted acceptance; CP-03 is promoted
  as code and staging deployment only, with no live signing-key
  configuration, registry rows, retained mapping/attestation artifact,
  attestation workflow run, independently authenticated receipt, or browser
  evidence. CP-04a is promoted but has no live target-signing key, seeded
  target, retained target/attestation artifact, protected workflow run,
  hosted matrix, or receipt; no hosted acceptance is claimed.
  CP-04b is promoted through PR #88 as a private registration foundation:
  implementation main SHA `52b66272e61331827c59ac1e169868474a2c09c8`, PR
  CI `35611484121`, exact-main CI `35612415141`, staging `35613284966`,
  deployment `6570861931`, and promotion artifact `10645302055` with digest
  `sha256:12f05e8371586996dc413b85b75167934045f342091defff5197435b8b707782`.
  Staging p95 was `32.589357 ms` and automated axe digest was
  `df2522f8512dcea587146f5bce43ad5232b94964d5048825ffdb745286dd772d`.
  No live policy/target/key, retained target/attestation/evidence artifact,
  hosted matrix, or independently authenticated receipt exists. Read-only
  AC209 verifier `35612514031` failed with `provider_graphql_error` after
  all preflight/protection/workspace gates, with no effects or receipt.
  AC266 is owner-deferred because the required real devices are unavailable,
  remains unchecked and excluded from active Phase 2 completion; the three
  active external release checks remain open.)
- [x] Documentation, runbooks, graph, feature ledger, and progress tracking

## Acceptance Criteria

- [x] **P2-S09-AC-001** — Keep content-type, field, relation, template, and block identities immutable, versioned, and removed only by deprecation or retirement; keys are never reused. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-002** — Keep dynamic schema storage normalized in definition/version tables with strictly validated JSONB; runtime DDL, general ORM/EAV escape hatches, and caller-authored executable validators are forbidden. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-003** — Make CMS-03A-01 create the type, initial version, fields, relations, template bindings, capability bindings, locale/workflow references, and compiled artifact reference in one atomic idempotent transaction. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-004** — Limit CMS-03A-02 and CMS-03A-03 to edits of an existing unactivated draft; no child definition is independently committed or exposed. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-005** — Treat sourceLocale as the canonical authoring locale and defaultLocale as the governed delivery fallback root; no_fallback fields do not borrow it. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-006** — Resolve workflowKey/workflowVersion and owner/capability references through protected registries; caller strings never create authority. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-007** — Compile each definition deterministically to strict Zod/OpenAPI/editor/database/renderer artifacts and reject unknown fields. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-008** — Persist one immutable content-addressed SchemaArtifact with compiler version, contract reference, manifests, and artifact hash; repeated compilation is hash-stable. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-009** — Classify compatibility as additive, conditional, breaking, or unknown and require the corresponding migration and evidence gates before activation. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-010** — Require activation to have zero unresolved references, valid template/block compatibility, exact dry-run evidence, and a valid migration plan for conditional or breaking changes. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-011** — Encode relation optionality with finite bounds: one uses min 0 or 1 and max 1, while many records explicit finite min/max bounds. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-012** — Keep block implementation code-owned; CMS stores only an immutable registered version and props identity/evidence, and human administration cannot register or mutate it. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-013** — Keep protected registry list/detail projections inside Shard 03, authenticated, capability-scoped, tenant/acting-context filtered, no-store, and separate from public delivery. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-014** — Make Shard 04 consume immutable publication projections only; public routes never select draft or control-plane registry tables. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-015** — Apply the IA common envelope and its complete per-model exceptions matrix, including the closed resource-state enums consumed from BE03b/BE03c; owner_id is an ownership reference and never an authority grant. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-016** — Use closed definition states and monotonic versioning; active definitions are immutable, blocked may return to draft only through an audited transition, and migration state is separate. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-017** — Reject CMS types, fields, relations, templates, and blocks that impersonate reserved identity, rights, money, entitlement, credential, evidence, institution, or authority concepts. [Architecture](../../../wiki/specs/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-018** — Register exactly the eight original BE03a operations CMS-03A-01 through CMS-03A-08 (A01-A08) with their declared method, path, operation ID, request schema, success status, auth, middleware, rate, timeout, cache, SLO, and event behavior; CMS-03A-09 through CMS-03A-18 are registered by their own criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-019** — Require discovered Hono routes and generated OpenAPI to match every BE03a route-registry row with no missing, extra, duplicate, or stale operation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-020** — Run request ID/media/query guards and strict Zod parsing before authorization; never authorize a body that has not passed structural parsing. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-021** — Enforce the 256 KiB raw JSON ceiling, maximum depth 8, maximum keys 128, maximum arrays 128, and field-specific string/object bounds. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-022** — Require Idempotency-Key of 8–128 printable ASCII on every original A01-A08 mutation (CMS-03A-01 through CMS-03A-05 and CMS-03A-08) and reject missing, malformed, aliased, or replay-mismatched keys; the amended mutations carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-023** — Require exact quoted positive-decimal If-Match on A02, A03, A04, and A08; A01 has no If-Match for a new type and reads have none. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-024** — Replay the same committed idempotency key and request as the same result, but return typed conflict for changed body, actor, path, version, or digest. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-025** — Apply BE00 canonical middleware order, cms-console CORS and CSRF to human mutations, and no browser CSRF authority to release-worker requests. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-026** — Accept only the exact four release header names and map them to keyId, issuedAt, nonce, and signature; aliases and JSON copies are invalid. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-027** — Verify release raw bytes and release headers before JSON parsing; release requests use the non-browser signed principal and release-only CORS policy. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-028** — Bind the Ed25519 signing input to operation ID, exact received header values, lowercase sha256(rawBody), fixed domain separator, and immutable field order. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-029** — Key rate buckets and the concurrent-definition cap to verified actor, acting party, or release principal; activation and registration use separate limits. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-030** — Enforce each original A01-A08 route's declared per-user and per-party limit, 15,000 ms deadline, no-store policy, response target, and Tier 2 SLO from the route registry; CMS-03A-09 through CMS-03A-18 carry their own criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-031** — Return BE00 ApiError with code, message, requestId, and bounded safe details for every declared failure; never return raw exceptions. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-032** — Implement the exhaustive 400, 401, 403, 404, 409, 415, 422, 429, 502, 503, 504, and applicable 500 mapping for the eight original operations A01-A08 (CMS-03A-01 through CMS-03A-08). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-033** — Use 400 for malformed structure, 401 for missing/expired or invalid principal, and 415 for unsupported media before domain mutation. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-034** — Return 403 when a readable resource exists but capability is insufficient, and indistinguishable 404 when owner/scope/resource existence is concealed. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-035** — Bound error details to BE00's allowlist: at most 50 JSON-pointer violations, safe reason codes, and no hidden policy predicates or private values. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-036** — Derive actor, acting party, ownership, and capability context server-side; ignore caller-supplied authority metadata. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-037** — Resolve RLS predicates through a schema-qualified immutable helper and execute mutations only through named schema-qualified RPCs. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-038** — Allow a remote compiler/registry adapter only with Zod response validation, 2,000 ms RPC timeout, 15s/60s/300s pre-effect retries with jitter, five-failure/60s circuit breaking, and 502/503/504 mapping. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-039** — CMS-03A-01 ContentTypeDraftRequest is a strict object with exactly typeKey, label, ownerCapability, sourceLocale, defaultLocale, supportedLocales, fallbackChains, workflowKey, workflowVersion, defaultTemplateVersionId, fields, relations, templateBindings, and capabilityBindings. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-040** — CMS-03A-01 typeKey is lowercase ASCII matching ^[a-z][a-z0-9_]{1,63}$ and is rejected when built-in, reserved, retired, or already used. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-041** — CMS-03A-01 label is Unicode length 2–120 and normalized to NFC. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-042** — CMS-03A-01 ownerCapability is length 1–128 and resolves to a protected capability-registry member. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-043** — CMS-03A-01 sourceLocale and defaultLocale each satisfy the canonical-case BCP 47 contract (2 to 35 characters) with the distinct authoring and fallback semantics. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-044** — CMS-03A-01 workflowKey matches the protected lowercase key grammar and workflowVersion is a positive decimal version. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-045** — CMS-03A-01 defaultTemplateVersionId is UUID or null; a present reference must be readable, immutable, and compatible. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-046** — CMS-03A-01 fields is an array of 0–128 strict FieldDefinitionInput values and rejects partial aggregate insertion. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-047** — CMS-03A-01 each initial field carries stableFieldId, FieldKey, closed kind, constraints, protected validator pair, default mode/value, localization mode, editorConfig, and lifecycle. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-048** — CMS-03A-01 relations is a bounded array of complete allowlisted RelationBindingInput values. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-049** — CMS-03A-01 templateBindings is a bounded array of immutable template-version UUID references with a maximum of 32. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-050** — CMS-03A-01 capabilityBindings is a bounded array of protected capability key/version references with a maximum of 32. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-051** — CMS-03A-01 capability bindings remain references and never grant authority by their presence. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-052** — CMS-03A-01 has no parent path and no If-Match create precondition; unique type-key locking serializes competing creates. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-053** — CMS-03A-01 inserts the type/version aggregate and matching SchemaArtifact under the deferred composite foreign key in one transaction. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-054** — CMS-03A-01 returns strict 201 ContentTypeVersionResource with ResourceMeta and the complete authorized type/version projection, including sourceLocale, defaultLocale, supportedLocales, fallbackChains and localeConfigHash. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-055** — CMS-03A-01 derives owner/created-by and returns ETag, Location, X-Request-Id, and Cache-Control: no-store without exposing unauthorized child data. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-056** — CMS-03A-02 FieldSchemaChangeRequest is a strict object with the exact field shape plus migrationPlanId and rejects unknown keys. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-057** — CMS-03A-02 path contentTypeId and versionId are UUIDs and versionId must belong to contentTypeId after structural validation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-058** — CMS-03A-02 stableFieldId is UUID when changing/deprecating an existing field and is omitted only for a new field. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-059** — CMS-03A-02 key matches ^[a-z][a-z0-9_]{1,63}$; key identity cannot be silently changed or reused. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-060** — CMS-03A-02 kind is exactly one of short_text, long_text, rich_text, boolean, integer, decimal, date, datetime, enum, taxonomy, relation, media, object, or list. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-061** — CMS-03A-02 constraints are a strict kind-specific object capped at 64 keys, depth 4, and 8 KiB, with minLength/maxLength/minimum/maximum/enumValues/itemKind refinements and min ≤ max. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-062** — CMS-03A-02 validatorKey and validatorVersion are both null or both protected registry references; free-form pattern, expression, code, or regex execution is rejected. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-063** — CMS-03A-02 required is boolean and cannot be added over populated data without a proven complete non-fabricating migration. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-064** — CMS-03A-02 defaultMode is none, literal, or inherited; literal requires defaultValue and none/inherited forbid it, preserving missing/null distinction. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-065** — CMS-03A-02 localizationMode is exactly none, localized, or no_fallback and is not inferred from defaultLocale. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-066** — CMS-03A-02 editorConfig is strict with label 1–120, helpText ≤500 when present, and order integer 0–10000. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-067** — CMS-03A-02 lifecycle is active, deprecated, or retired; physical lifecycle is one state and no deletion shortcut exists. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-068** — CMS-03A-02 migrationPlanId is required nullable UUID: null is permitted only when the change is additive/no-data, and a UUID is required for conditional or breaking compatibility. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-069** — CMS-03A-02 writes only an unactivated draft under exact If-Match/CAS and preserves immutable stable identity. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-070** — CMS-03A-02 rejects validation, authorization, or persistence failure without a partial field row or aggregate mutation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-071** — CMS-03A-02 returns strict 201 FieldDefinitionVersionResource with stable ID, key/kind, validator/default/localization/lifecycle, version, hash, and migration plan. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-072** — CMS-03A-03 RelationBindingRequest is a strict object with exactly fieldId, targetKind, targetType, projectionKey, cardinality, min, max, ordered, and onUnavailable. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-073** — CMS-03A-03 fieldId is a UUID for a relation-kind FieldDefinitionVersion in the same type version. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-074** — CMS-03A-03 targetKind is exactly content or domain and targetType is a lowercase allowlisted key of length 1–96. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-075** — CMS-03A-03 projectionKey is a named allowlisted projection key of length 1–128; arbitrary SQL, table names, and dynamic projections are rejected. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-076** — CMS-03A-03 cardinality is exactly one or many and is stored as declared relation metadata. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-077** — CMS-03A-03 min is finite integer 0–128, max is finite non-null integer 1–128, and min cannot exceed max. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-078** — CMS-03A-03 cardinality one requires min 0 or 1 and max exactly 1; many always records explicit finite bounds. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-079** — CMS-03A-03 ordered is boolean and preserves declared order semantics in the relation definition. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-080** — CMS-03A-03 onUnavailable is omit, block, or placeholder; missing behavior is not silently treated as omit. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-081** — CMS-03A-03 placeholder fallback is exactly {status: unavailable, reason: unavailable} with no target identifier, type, key, title, data, or existence distinction. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-082** — CMS-03A-03 target authority is resolved by each consumer read and a relation binding never grants authority. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-083** — CMS-03A-03 writes only a draft under exact If-Match/CAS, unique field/version binding, and no mutation on invalid bounds. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-084** — CMS-03A-03 returns strict 201 RelationDefinitionResource with target, projection, cardinality, bounds, ordering, and unavailable behavior. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-085** — CMS-03A-04 SchemaActivationRequest is a strict object with expectedVersion, dryRunId, approvalIds, migrationPlanId, and optional expectedActivationEvidenceHash. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-086** — CMS-03A-04 expectedVersion is a positive decimal string and exact strong If-Match must match the candidate version. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-087** — CMS-03A-04 dryRunId is UUID for an immutable report containing counts, hashes, compiler version, and result. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-088** — CMS-03A-04 approvalIds is an array of 1–8 UUID references with no duplicates. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-089** — CMS-03A-04 approval IDs are request references only: the server resolves them to the approve decisions of exactly one approved review, resolves the distinct counted humans with their current assignment and capability authority, and rechecks only the activator's own recent binding-bound MFA; a reviewer's earlier MFA freshness is not re-required at activation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-090** — CMS-03A-04 frozen WorkflowPolicyEvidence contains key, version, policyHash, riskClass, requiredDecisionCount 1–8, requiredCapabilities, and approvalEvidenceHash. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-091** — CMS-03A-04 protected policy, resolved from the code-owned workflow policy registry and never from the caller, requires two decisions from distinct humans for the protected members (the cms.reviewer slot plus the matching specialist slot); each decision carries its own recent binding-bound MFA at decision time. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-092** — CMS-03A-04 ordinary policy uses the server-resolved policy count and never assumes a universal two-approval rule. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-093** — CMS-03A-04 migrationPlanId is UUID or null; null is valid only for additive/no-data activation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-094** — CMS-03A-04 expectedActivationEvidenceHash is optional lowercase 64-hex equality evidence; mismatch returns conflict and never changes server policy. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-095** — CMS-03A-04 rechecks zero unresolved field/relation/template/block references and all allowlists before switching. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-096** — CMS-03A-04 verifies exact dry-run counts/hashes/compiler version and matching immutable SchemaArtifact before activation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-097** — CMS-03A-04 locks candidate and current active rows, then performs one compare-and-swap activation decision. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-098** — CMS-03A-04 never mutates a previously active version; the old active version remains readable until the switch commits. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-099** — CMS-03A-04 advances the SchemaMigrationPlan that CMS-03A-10 created and bound to the dry run, only after compatibility, evidence, and migration gates pass; activation never creates a plan. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-100** — CMS-03A-04 returns 202 with SchemaActivationResource (including localeConfigHash) and jobId when work is queued, otherwise the declared synchronous success resource. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-101** — CMS-03A-04 records cms.schema.activated.v1 with the immutable activation-evidence snapshot only after the committed switch. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-102** — CMS-03A-04 invalidates approval/evidence when candidate hash, compiler, dependency, reference, or authority changes and forces review again. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-103** — CMS-03A-05 BlockRegistrationRequest is a strict object with the exact key/version, props, renderer, children, slot, data, accessibility, compatibility, lifecycle, and releaseDigest fields. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-104** — CMS-03A-05 blockKey matches ^[a-z][a-z0-9._-]{0,95}$ and blockVersion is positive safe integer; the pair is never reused. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-105** — CMS-03A-05 accepts lifecycle supported only; deprecated and withdrawn are derived solely from CMS-03A-08 events. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-106** — CMS-03A-05 propsSchemaRef is a protected artifact reference with no traversal or URL semantics. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-107** — CMS-03A-05 propsSchemaHash is lowercase 64-hex and remains immutable identity beside propsSchemaRef. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-108** — CMS-03A-05 propsSchemaSnapshot is a strict normalized object with schemaVersion, fields, name/kind/required/constraints, and additionalProperties false. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-109** — CMS-03A-05 propsSchemaSnapshot is capped at 128 fields with bounded nested JSON and rejects unknown runtime keywords or executable content. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-110** — CMS-03A-05 propsSnapshotHash equals lowercase SHA-256 of exact RFC 8785/JCS UTF-8 normalized snapshot bytes. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-111** — CMS-03A-05 propsSnapshotAttestation uses algorithm Ed25519, a trusted ReleaseKeyId, and canonical padded base64 for a 64-byte signature. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-112** — CMS-03A-05 attestation signing binds block key/version, props ref/hash, normalized snapshot hash, and releaseDigest in the locked domain-separated byte order. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-113** — CMS-03A-05 rendererRef is a registered code-manifest reference of length 1–160; URLs, source text, and uploaded modules are rejected. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-114** — CMS-03A-05 allowedChildren is a strict BlockKey array capped at 32 and slotRules enforce maxDepth 1–16 and maxNodes 1–512. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-115** — CMS-03A-05 dataSourcePermissions is an allowlisted key array capped at 32; arbitrary data sources and projections are rejected. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-116** — CMS-03A-05 accessibility is strict with nameRequired, keyboard true, focusOrder document or managed, and statusAnnouncement. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-117** — CMS-03A-05 compatibility is strict with bounded minSchemaCompiler and maxSchemaCompiler values. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-118** — CMS-03A-05 releaseDigest is lowercase 64-hex and binds the signed release manifest. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-119** — CMS-03A-05 raw body and exact release headers are verified before JSON parsing against the trusted non-revoked Ed25519 key. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-120** — CMS-03A-05 rejects more than five minutes clock skew, nonce replay within at least ten minutes, unknown/revoked keys, and conflicting digest. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-121** — CMS-03A-05 persists immutable outer release evidence and props-attestation evidence; failed audit/outbox leaves no accepted registration. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-122** — CMS-03A-05 returns strict 201 BlockDefinitionVersionResource with full worker-only registration and verification evidence. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-123** — CMS-03A-05 never exposes release body, signature, nonce, attestation, or verification evidence to browser FE state. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-124** — CMS-03A-06 ContentSchemaRegistryListQuery is strict and rejects unknown query keys before authorization or database access. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-125** — CMS-03A-06 resourceKind is optional but, when present, is one of the eight declared RegistryResourceKind discriminators. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-126** — CMS-03A-06 keyPrefix is optional, lowercase allowlisted, and bounded to ^[a-z][a-z0-9._-]{0,63}$. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-127** — CMS-03A-06 lifecycle is a closed union and accepts only values compatible with the selected lifecycle-bearing resourceKind. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-128** — CMS-03A-06 state is a separate closed union for state-only resources and is never interpreted as a lifecycle value. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-129** — CMS-03A-06 rejects lifecycle on content_type_version, relation_definition, schema_artifact, template_binding, or capability_binding and rejects state on lifecycle-bearing kinds. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-130** — CMS-03A-06 applies omitted-resourceKind lifecycle filters only to compatible lifecycle-bearing kinds and returns no state-only matches. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-131** — CMS-03A-06 limit defaults to 25 and is integer 1–100; response items are capped at 100. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-132** — CMS-03A-06 cursor is opaque, 1–512 characters, and binds query/filter/sort/direction and acting scope. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-133** — CMS-03A-06 sort is key, createdAt, updatedAt, or version and direction is asc or desc with deterministic immutable-ID tie-break. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-134** — CMS-03A-06 returns 200 ContentSchemaRegistryListPage with discriminated ContentSchemaRegistryRecord items and nullable nextCursor. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-135** — CMS-03A-06 each list resource is capability-safe and discriminated; block rows use BlockDefinitionRegistryRecord rather than full worker resource. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-136** — CMS-03A-06 requires authenticated cms.schema_registry.read or schema-designer read scope and omits concealed rows. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-137** — CMS-03A-06 sends Cache-Control: no-store and never selects public delivery or control-plane private payloads. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-138** — CMS-03A-06 rejects Idempotency-Key, If-Match, request bodies, and all mutation effects; only rate/telemetry counters may change. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-139** — CMS-03A-07 accepts only strict contentTypeId and versionId UUID path parameters belonging to one type; labels cannot substitute for IDs. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-140** — CMS-03A-07 rejects query strings and request bodies; Idempotency-Key and If-Match are absent and Content-Type is not required. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-141** — CMS-03A-07 requires authenticated schema-registry-read or schema-designer read scope with acting-context/RLS recheck. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-142** — CMS-03A-07 returns 403 for a known readable parent lacking required detail capability and 404 for hidden, absent, or mismatched type/version. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-143** — CMS-03A-07 returns 200 ContentSchemaRegistryDetail with one ContentTypeVersionResource (including its locale configuration), the required activationPreparation projection, and bounded fields, relations, schemaArtifact, templateBindings, capabilityBindings, and blockDefinitions. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-144** — CMS-03A-07 always includes capability-safe SchemaArtifact identity/hash and never has an optional artifact omission flag. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-145** — CMS-03A-07 projects only safe BlockDefinitionRegistryRecord fields and excludes snapshot, attestation, release keys/body/nonce hashes, verification timestamps, source, and executable evidence. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-146** — CMS-03A-07 sends Cache-Control: no-store and never selects public delivery tables or private control-plane payloads. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-147** — CMS-03A-07 has zero mutation side effects on success or failure: no insert/update/delete, idempotency reservation, audit/outbox mutation, migration lease, or state transition. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-148** — CMS-03A-07 maps projection dependency-invalid-response, dependency-unavailable, dependency-deadline-exceeded, and internal failures to safe declared errors; no hidden existence or capability graph leaks. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-149** — CMS-03A-08 BlockLifecycleAdvanceRequest is strict with fromLifecycle, toLifecycle, expectedVersion, and releaseDigest. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-150** — CMS-03A-08 blockDefinitionVersionId is an existing UUID path resource; no new key/version can be created by the lifecycle route. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-151** — CMS-03A-08 fromLifecycle is supported or deprecated and must equal the server-derived current lifecycle. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-152** — CMS-03A-08 toLifecycle is deprecated or withdrawn and the only allowed transitions are supported → deprecated → withdrawn. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-153** — CMS-03A-08 expectedVersion is a positive decimal string and is checked under lock with exact strong If-Match. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-154** — CMS-03A-08 releaseDigest is lowercase 64-hex and must match the registered immutable block release. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-155** — CMS-03A-08 verifies operation-specific raw body and exact four release headers with Ed25519 before parsing or state lookup. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-156** — CMS-03A-08 claims the durable (releaseKeyId, sha256(nonce)) receipt before accepting lifecycle mutation and retains it at least ten minutes. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-157** — CMS-03A-08 locks the block version, checks expected lifecycle/version/digest, and rejects stale or duplicate transitions. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-158** — CMS-03A-08 appends one immutable lifecycle event and never updates the BlockDefinitionVersion row or mutable lifecycle column. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-159** — CMS-03A-08 commits lifecycle event, nonce receipt consumption, audit, and outbox atomically; failure rolls all effects back. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-160** — CMS-03A-08 returns strict 201 BlockLifecycleEventResource with event identity, transition, digest, release verification, and event type. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-161** — CMS-03A-08 treats duplicate idempotency or digest replay as exact replay only when the signed nonce/body is identical; conflicts never append another event. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-162** — CMS-03A-08 derives effective lifecycle from initial supported registration plus ordered immutable events and never stores a duplicate mutable lifecycle state. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-163** — CMS-03A-08 emits cms.block.lifecycle.changed.v1 only after commit with identifier-only safe payload. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-164** — CMS-03A-08 keeps all lifecycle controls, nonce evidence, and WEBHOOK_REJECTED outcomes on the release-worker boundary; no browser mutation path exists. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-165** — Every one of the twelve original BE03a definition tables (cms_content_types, cms_content_type_versions, cms_content_type_template_bindings, cms_content_type_capability_bindings, cms_field_definition_versions, cms_relation_definitions, cms_schema_migration_plans, cms_schema_artifacts, cms_schema_dry_run_reports, cms_block_definition_versions, cms_release_nonce_receipts, cms_block_definition_lifecycle_events) carries the IA envelope id, owner_id, closed state, monotonic version, created_at, and updated_at, except only the documented physical-state/timestamp-renewal cases. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-166** — Immutable and append-only rows pin updated_at = created_at and reject UPDATE/DELETE; only advisory presence is allowed to renew timestamps in the broader IA model. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-167** — cms_content_types persists UUID identity, owner/state/version/timestamps, immutable type_key, owner_capability, built_in, and created_by with unique never-reused key and scoped indexes. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-168** — cms_content_type_versions persists parent/type/version identity, workflow/locale/template/artifact references, definition hash, compatibility, supersedes/dry-run data, and server-frozen activation evidence with unique active-version constraint. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-169** — cms_content_type_template_bindings persists parent version, template UUID, position, envelope, unique parent/template pair, and immutable-after-activation binding resolved by named compatibility RPC. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067) — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-170** — cms_content_type_capability_bindings persists parent version, protected capability key/version, envelope, unique binding, and reference-only semantics that never grant authority. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-171** — cms_field_definition_versions persists stable field identity, key/kind, constraints, validator/default/localization/editor/lifecycle data, unique type-version field/key, and deprecation without physical deletion. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-172** — cms_relation_definitions persists relation field FK, target kind/type/projection, cardinality, finite bounds, ordering, unavailable behavior, unique field binding, and allowlisted target resolution without authority escalation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-173** — cms_schema_migration_plans persists source/target versions, additive/conditional/breaking classification, transform, dry-run report, durable cursor/count/hash/error counters, worker state, and unique version pair. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-174** — cms_schema_artifacts persists one compiled terminal artifact per type version with compiler, contract ref, manifests, immutable hash, composite ownership FK, and no update/delete. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-175** — cms_block_definition_versions persists registered physical state, immutable block key/version, props ref/hash/snapshot/attestation, renderer/children/slot/data/accessibility/compatibility, release digest, and outer verification evidence. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-176** — cms_release_nonce_receipts persists unique release key plus nonce hash, issued/expiry/consumed times, operation, raw/signature hashes, verification outcome, and at-least-ten-minute retention before signed acceptance. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-177** — cms_block_definition_lifecycle_events persists recorded envelope, existing block FK, from/to lifecycle, release digest/evidence, unique transition, append-only immutability, and derived-lifecycle ordering. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-178** — Every unique, foreign key, partial active index, and owner/time/query index of the twelve original BE03a definition tables named in AC165 is enforced in PostgreSQL; keys and immutable evidence are never reused or rewritten. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-179** — The deferred composite SchemaArtifact FK is checked in the same transaction; every UUID FK and registry reference is validated before any aggregate becomes visible. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-180** — The SQL API exposes only the eight original named cms_* RPCs for A01-A08 (CMS-03A-01 through CMS-03A-08), checked by an exact-set guard that treats only the named amendment RPCs as additional; anon/authenticated roles have no direct table INSERT/UPDATE/DELETE grants. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-181** — RLS is enabled and forced on every table, reads are scope/acting-context filtered, WITH CHECK re-resolves allowlists/current state, and a schema-qualified immutable helper is used. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-182** — Service-role access is limited to named migration/worker functions with empty search_path; workers receive only bounded IDs/version/counters and cannot directly mutate tables. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-183** — CMS-03A-01 commits child definitions, artifact, idempotency completion, audit, and outbox effects atomically; failed audit/outbox rolls back the aggregate. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-184** — CMS-03A-06 and CMS-03A-07 use projection-only RPCs and perform no definition/migration/idempotency/audit/outbox mutation on success or failure. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-185** — Retention preserves active/superseded definitions and migration evidence; retirement is state, key uniqueness is forever, and legal hold/incident fencing blocks purge. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-186** — Definition states follow draft → review → approved → scheduled or active → superseded or retired, with blocked → draft only through audited transition; active versions are immutable. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-187** — Migration states follow draft → dry_running → ready or blocked → running → verifying → completed, failed_retryable, or failed_terminal; cursor, counts, transform/compiler hash, and source/target hashes are durable. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-188** — A failed migration keeps the old active version readable, never deletes rows, and cannot retry a changed transform; worker lease expiry resumes through CAS. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-189** — Activation is compare-and-swap; evidence, approval, reference, compiler, allowlist, or dependency changes invalidate the candidate and require review again. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-190** — BE00 event envelopes contain eventId, eventType, schemaVersion, occurredAt, producer, correlationId, causationId, aggregateType, aggregateId, decimal aggregateVersion, and IDs only. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-191** — cms.schema.activated.v1 includes schema/version IDs and the immutable activation-evidence snapshot; no field values, private content, or authority are emitted. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210) — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-192** — Consumers process events at least once, deduplicate by event identity, enforce monotonic aggregate version, and route unknown versions to DLQ. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-193** — Every A01 failure maps to its declared validation/auth/scope/key/idempotency/RPC error and leaves no partial aggregate or false success. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-194** — Every A02 failure maps to its declared validation/auth/hidden-parent/immutable-key/stale-version/migration/RPC error and leaves the prior draft unchanged. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-195** — Every A03 failure maps to its declared validation/auth/hidden-parent/duplicate-relation/allowlist/bounds/RPC error and leaves the prior schema unchanged. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-196** — Every A04 failure maps to its declared validation/auth/step-up/MFA/policy/approval/artifact/dry-run/compatibility/locale-hash/stale-state/RPC error (including 401 STEP_UP_REQUIRED and the 409 localeConfigHash mismatch) and preserves the old active version. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-197** — Every A05 failure maps to its declared signature/principal/manifest/props/digest/duplicate/dependency/RPC error and creates no second registration. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-198** — Every A06 failure maps malformed query/cursor, UNAUTHENTICATED, FORBIDDEN, VALIDATION_FAILED, RATE_LIMITED, DEPENDENCY_INVALID_RESPONSE, DEPENDENCY_UNAVAILABLE, DEPENDENCY_DEADLINE_EXCEEDED, and INTERNAL_ERROR safely without registry mutation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-199** — Every A07 failure maps malformed UUID/header, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, RATE_LIMITED, DEPENDENCY_INVALID_RESPONSE, DEPENDENCY_UNAVAILABLE, DEPENDENCY_DEADLINE_EXCEEDED, and INTERNAL_ERROR safely without registry mutation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-200** — Every A08 failure maps to its declared signature/principal/path/lifecycle/digest/nonce/idempotency/dependency error and appends no lifecycle event. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-201** — Mutation clients retry 503/504 only with the same idempotency key after status reconciliation; protected reads retry canonical query/path without mutation headers. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-202** — Unknown or ambiguous mutation outcomes remain pending/degraded and are reconciled by idempotency/status, never guessed as active or successful. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-203** — Relation reads recheck current target visibility and apply omit, block, or the exact opaque placeholder without copying target authority or private fields. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-204** — Reserved-concept, arbitrary-code/style, draft/control-plane leak, BOLA, approval-bypass, and migration-corruption tests remain blocking security gates. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-205** — Registry dependency failures map invalid upstream data to 502, unavailable/open circuit to 503, and deadline to 504 without mutation. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-206** — Structured logs contain operation, request/trace/correlation IDs, actor/acting classes, safe IDs/hashes, expected/current version when authorized, outcome, code, duration, dependency, and retryability only. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-207** — Logs and provider diagnostics exclude request bodies, field labels/values, capability graphs, renderer/source, signatures, tokens, private domain data, and PII. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-208** — Emit the declared per-operation request, latency, error, rate, conflict, allowlist, migration, activation, block, nonce, outbox, queue-retry, and DLQ metrics for the original A01-A08 operations; the review, assignment, grant, and dry-run metrics carry their own criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [ ] **P2-S09-AC-209** — Alert on activation blocked >15m, migration retry >3, nonce rejection spikes, DLQ >0, outbox age >2m, conflict >5%/5m, or unknown event versions. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-210** — Trace validation → session/acting context → capability → idempotency → RPC/SQL → audit/outbox → worker/refetch with allowlisted diagnostics only. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [ ] **P2-S09-AC-211** — Meet Tier 2 command p95 <1,200 ms, protected RPC p95 <300 ms, acceptance p99 <1,000 ms, queue first-attempt p95 <60 s, and DLQ <0.1% daily. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-212** — A failed audit/outbox write rolls back the mutation while telemetry loss never rolls back a committed definition. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-213** — A failed signed registration/lifecycle event rolls back nonce claim and event/outbox append; duplicate release admission cannot be made valid by idempotency replay. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-214** — Contract tests prove route/OpenAPI/request/success/error/CORS/auth/rate/timeout/cache/SLO parity for the eight original operations A01-A08. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-215** — Persistence/concurrency tests prove every SQL check/FK/unique/state/immutable rule, RLS force, grant revocation, RPC path, CAS, nonce claim, and zero-side-effect protected GET. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-216** — Security tests fuzz depth/keys/arrays/Unicode/regex/SQL-like strings/signature bytes and reject executable or arbitrary projection inputs. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-217** — Performance/recovery tests benchmark 128-field definitions and prove old-active fallback, activation rollback, worker resume, DLQ replay, and no duplicate switch. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210) — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-218** — CmsContentModelingRoute props are minimal serializable disclosure-safe values; Astro verifies session, expiry, acting context, route visibility, and initial data before composing HTML. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-219** — The route renders useful semantic HTML server-first with one h1, named landmarks, skip link to main, route h1 focus, title/state context, and 320 CSS-pixel/200% zoom reflow. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-220** — ContentSchemaRegistryWorkbench has children never, the exact protected named variants, separate typed list/detail AsyncState props, actor/acting IDs, query/path/cursor/version, and canonical-refetch callback. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-221** — FE03 consumes generated BE03a Zod/OpenAPI types and the original eight operation IDs CMS-03A-01 through CMS-03A-08; no hand-written DTO or client authority type is allowed. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [ ] **P2-S09-AC-222** — The CMS-03A-01 form sends only the named ContentTypeDraftRequest fields (including supportedLocales and fallbackChains), idempotency/JSON/CSRF headers, and renders the authoritative 201 resource. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-223** — The CMS-03A-02 form sends exact path IDs, FieldSchemaChangeRequest including required nullable migrationPlanId, idempotency/If-Match/JSON/CSRF headers, and renders the 201 field resource. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-224** — The CMS-03A-03 form sends exact path IDs, RelationBindingRequest, idempotency/If-Match/JSON/CSRF headers, and renders the 201 relation resource. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [ ] **P2-S09-AC-225** — The CMS-03A-04 confirmation sends SchemaActivationRequest, step-up/MFA, idempotency/If-Match/JSON headers, and renders 202 job or synchronous activation resource. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations — Reopened 2026-09-30: CMS-03A-04 activation authority path has no production producer for the required `actingContextId` or CMS review evidence; see Activation re-audit.
- [x] **P2-S09-AC-226** — CMS-03A-05 has no browser route, form, trigger, upload, idempotency key, or optimistic mutation state; only protected safe metadata may be displayed. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-227** — CMS-03A-08 has no browser lifecycle control or mutation facade; only authorized safe block metadata refetch after a worker event hint is allowed. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-228** — CMS-03A-06 renders a protected list with typed resourceKind/keyPrefix/lifecycle/state/limit/cursor/sort/direction URL state and no record payload in the URL. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-229** — CMS-03A-07 renders protected detail from exact contentTypeId and versionId path state; labels/list positions cannot infer either identifier. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-230** — The registry represents idle, loading, empty/no-records, filter-miss, success, validation, auth, capability, not-found, conflict where applicable, rate, dependency, and degraded states explicitly. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-231** — The registry reads URL/server state as canonical, keeps only bounded island-local disclosure/filter/focus state, and forbids a global client store. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-232** — Realtime and BroadcastChannel payloads carry invalidation hints only; each tab refetches canonical authorized data and no tab writes another tab's cache. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-233** — Unsaved protected registry data is never persisted as draft/offline intent; reconnect revalidates identity, authority, input, and version. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-234** — CMS-03A-06 and CMS-03A-07 list/detail data never enters public/private/offline caches, localStorage, IndexedDB, BroadcastChannel bodies, analytics, Realtime bodies, search, or sitemaps. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-235** — The role matrix renders registry reads only for entitled/owner/guardian/junior/business/staff/admin protected variants; Free is not-rendered and roles never authorize client-side. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-236** — ActionBar uses native controls, stable pending labels, expectedVersion/operationId, named consequences, and returns focus to the trigger. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-237** — CapabilityGate hides protected names in not-rendered state, shows reason/recovery for disabled, focuses step-up heading, and never broadens disclosure. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-238** — FilterBar has persistent labels, URL Apply/Reset, scoped Escape behavior, and polite result-count announcements. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-239** — DataTable is semantic wide, uses priority-list mobile treatment, labelled sort buttons, stable keys, and named bulk count/scope where applicable. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-240** — ConfirmationStep is inline first, exposes consequence/scope/version/step-up/idempotency, focuses heading, and requires Escape-before-commit behavior. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-241** — OfflineStatus and SyncConflict use text plus icon, preserve refused intents, expose server/local versions, and never auto-overwrite. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-242** — Protected list/detail routes use server guards, safe 303 sign-in returnTo normalization, 403 visible-capability handling, and disclosure-safe 404 omission. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-243** — Deep links/bookmarks refetch exact current authority/version; stale, retired, unreadable, or mismatched detail never falls back to public data. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-244** — At mobile ≤768 px the registry uses four columns/16 px gutter, list-then-detail stack, Back-before-detail, one-column forms, and 44 px controls without horizontal scroll at 320 px. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-245** — At tablet 769–1024 px it uses eight columns/20 px gutter/24 px margins, collapsible sidebar, and two columns only for independent fields. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-246** — At desktop ≥1025 px it uses twelve columns/24 px gutter/max 1440 px, stable list/detail split, action rail, and virtualization above 100 rows. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-247** — Native links/buttons/inputs/selects/textareas provide visible names, correct keyboard operation, logical Tab order, focus ring, and no pointer-only control. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-248** — Form validation uses persistent labels, linked descriptions, JSON-pointer errors, first-invalid summary focus, polite status, and server authority after blur feedback. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-249** — Tables/filters expose caption, headers, sort direction, result count, active-filter summary, 24 CSS px minimum targets (44 preferred), and no ARIA grid without full grid behavior. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-250** — High-risk activation confirmation exposes consequence, scope, version, acting context, and step-up; modal focus containment/Escape/return focus applies only when inline is insufficient. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations — Closed 2026-10-01: production-built Chrome verified the disclosure clause (6/6 GREEN, 23:06 UTC, exit 0) on the frozen production source; not real MFA, activation, or hosted acceptance.
- [x] **P2-S09-AC-251** — Reduced-motion mode removes nonessential animation; statuses combine text/icon/structure and never rely on color. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-252** — Reads show loading only after 250 ms, use known-layout skeletons, preserve safe prior shell, and announce parsed results within the FE timing contract. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-253** — 429 honors Retry-After and preserves input; safe 502/503/504 attempts are bounded and mutation retries reconcile status first. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-254** — FE maps 400/422 inline, 401 reauthentication, 403 CapabilityGate, 404 disclosure-safe, 409 SyncConflict, 429 countdown, and 5xx degraded states to exact accessible recovery. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-255** — Astro verifies Supabase token server-side on every protected route/write of the original A01-A08 surfaces, checks expiry/revocation/acting context, and client role strings never authorize; the amended routes carry their own criteria. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-256** — Cookie mutations enforce Secure/HttpOnly same-site cookies, strict Origin/Referer and CSRF binding; no GET mutates. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-257** — Controls serialize named Zod fields only, use allowlist sanitizers, render text safely, forbid executable HTML/CSS/script/expression, and never trust client validation. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-258** — Tokens, evidence bodies, contact data, media URLs, drafts, release headers, raw bodies, signatures, and private IDs stay out of URL, logs, analytics, Realtime, and client persistence. Scope: the original A01-A08 operations (CMS-03A-01 through CMS-03A-08); CMS-03A-09 through CMS-03A-18 carry their own per-operation criteria. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [ ] **P2-S09-AC-259** — FE maps every browser-visible BE03a request/response/error field to the owning form/state/component, explicitly omits ownerId from browser response envelopes, and excludes DB-only release evidence fields. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-260** — The browser accepts only safe BlockDefinitionRegistryRecord projection and never parses full block registration/lifecycle resources or WEBHOOK_REJECTED. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-261** — The registry route starts at ≤90 KB initial app JS, workbench hydrated entry ≤35 KB, detail/editor modules split, and no barrel import; list >100 virtualizes. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-262** — The app meets LCP <2.5 s, INP <200 ms, CLS <0.1, and no input task >50 ms under the FE03 performance contract. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-263** — Vitest covers AsyncState/access variants, exact error copy, timing, rollback/focus, and absence of unauthorized props. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [ ] **P2-S09-AC-264** — Integration tests prove generated Zod fixtures, all eight original operation field/error mappings (A01-A08, including the DEC-108 activationPreparation member and the OD-4 locale fields), ETag/idempotency/rate UI behavior, and invalidation-only realtime. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [ ] **P2-S09-AC-265** — Playwright covers all nine role cases under the approved Phase 2 launch overlay: guardian/junior/business-mandate denial without disclosure or mutation, positive access only with verified current authority, forbidden denial, and disabled prerequisites without mutation. Retain all ten hosted scenarios: IdP sign-in, server-authoritative RLS, keyboard/landmarks/live regions, three breakpoints, 200% zoom, offline/reconnect, stale multi-tab, auth expiry, 429, and outage. Retain step-up and session teardown proof; skips and local fixtures do not satisfy hosted acceptance. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§Conditional Rendering Matrix, Testing Obligations
- [ ] **P2-S09-AC-266** — Accessibility release checks pass axe with zero serious/critical issues, contrast/non-color cues, VoiceOver/NVDA smoke, target size, focus, and no trap. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-267** — Record each strict floor checkpoint in both canonical phase plan and Slice 09 tracker with contiguous P2-S09-AC IDs and identical descriptions/source ownership. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-268** — Keep later-only editorial, composition, taxonomy, locale, and public-delivery behavior in S10–S17; S09 retains only registry-owned or shared boundary obligations after owner coverage review. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-269** — Trace all eight original BE03a operations (A01-A08), five feature-ledger rows, IA CMS-01/02/03/04/10, FE registry ownership, and BE03b/03c consumed boundaries to an acceptance criterion. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-270** — Execute Contract → QA-RED → data/API and SSR/island implementation → QA-GREEN → refactor, retaining failing-test evidence and canonical validation output. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-271** — Run explicit formatting, progress-consistency, diff-check, and per-slice contiguous-ID/count/mirror checks before marking the reconciliation complete. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-272** — Do not edit IA, BE, FE, implementation, or schema source documents during this phase-plan reconciliation. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-273** — Document every warning/fail with exact current source path/line anchor and an explicit owner decision; current settled sources have no unresolved S09 ambiguity. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-274** — Update phase totals, slice counts, feature/endpoint maps, progress mirrors, and reconciliation evidence together without staging unrelated dirty work. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-275** — Re-read the current IA03/deep-dive, BE03a, BE03b/03c consumed boundaries, and FE03 after source mtimes settle before freezing the floor. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-276** — Record the exact A06/A07 dependency-invalid-response, dependency-unavailable, dependency-deadline-exceeded, and internal-error owners in the floor. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-277** — Record the exact A08 release signature, nonce receipt, lifecycle CAS, append-only event, and worker-only browser boundary in the floor. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-278** — Prove the final browser resource envelopes use closed state enums and omit ownerId/worker-only fields before implementation. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-279** — Prove required-nullable migrationPlanId is present in BE03a and FE03 source contracts for field changes and activation. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-280** — Keep A06/A07 no-store GETs free of idempotency, If-Match, body, audit, outbox, migration, and definition-state effects. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-281** — Keep A05/A08 release headers, raw body, signatures, nonce evidence, and WEBHOOK_REJECTED entirely outside browser state. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-282** — Verify S10/S11/S12/S15 existing owner criteria cover removed later-only S09 editorial/composition/public topics; transfer count is zero. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-283** — Compute phase arithmetic from current per-slice counts: 1905 original total minus 188 old S09 plus 283 strict S09 equals 2000. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-284** — CMS-03A-09 accepts SchemaSuccessorRequest on an immutable readable source version and returns 201 ContentTypeVersionResource for a fresh draft. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-285** — CMS-03A-09 SchemaSuccessorRequest is a strict object containing only expectedVersion and rejects unknown keys. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-286** — CMS-03A-09 expectedVersion is a positive decimal string matching ^[1-9][0-9]*$. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-287** — CMS-03A-09 expectedVersion must equal the exact strong If-Match, which must equal the immutable source version. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-288** — CMS-03A-09 path parameter contentTypeId is a UUID and a malformed value is 400 INVALID_REQUEST before any existence check. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-289** — CMS-03A-09 path parameter versionId is a UUID and a malformed value is 400 INVALID_REQUEST before any existence check. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-290** — CMS-03A-09 requires an Idempotency-Key header and rejects a missing key with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-291** — CMS-03A-09 accepts an Idempotency-Key only as 8-128 printable ASCII characters and rejects any other value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-292** — CMS-03A-09 requires If-Match as an exact quoted positive decimal version and rejects a missing or malformed value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-293** — CMS-03A-09 success returns ETag "<positive decimal version>", Location of the new draft, X-Request-Id and Cache-Control no-store. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Registry invariants
- [x] **P2-S09-AC-294** — CMS-03A-09 clones the definition aggregate into a draft with new definition row IDs and an incremented version number. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-295** — CMS-03A-09 preserves stable field IDs and field keys across the clone and remaps local references to the new rows. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-296** — CMS-03A-09 never mutates the source version, its artifact or its dependent rows. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-297** — CMS-03A-09 response carries no actor, person, party or private acting-context binding identifier. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-298** — CMS-03A-09 allows a verified human holding cms.schema_designer whose acting party holds the registry scope on a readable immutable source in an activatable state. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-299** — CMS-03A-09 derives owner and creator server-side and accepts no browser-supplied owner. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-300** — CMS-03A-09 replays the first response for a same-key exact retry and returns 409 CONFLICT when the same actor reuses the key with a changed body, path or version; a different actor is a distinct idempotency binding under the BE00 actor scope. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Transaction and external seams
- [x] **P2-S09-AC-301** — CMS-03A-09 returns 409 CONFLICT when a live successor draft already exists for that source and concurrent same-source requests produce exactly one draft. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Operation error coverage
- [x] **P2-S09-AC-302** — CMS-03A-09 commits the cloned draft, audit row and outbox row in one transaction and leaves the source unchanged when any of them fails. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Operation error coverage
- [x] **P2-S09-AC-303** — CMS-03A-09 allows 30 requests per minute per user and 60 per minute per party (rate class cms-definition-write, keyed per operation ID and actor) and returns 429 with Retry-After and RateLimit headers once either bucket is exceeded in the 60-second window. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-304** — CMS-03A-09 returns 400 INVALID_REQUEST for malformed path, header or body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-305** — CMS-03A-09 returns 401 UNAUTHENTICATED for a missing or expired session with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-306** — CMS-03A-09 returns 403 FORBIDDEN for source capability denied, without revealing the source contents, with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-307** — CMS-03A-09 returns 404 NOT_FOUND for a hidden or absent source with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-308** — CMS-03A-09 returns 409 CONFLICT for a stale source If-Match, an existing live successor draft or an idempotency mismatch with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-309** — CMS-03A-09 returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-310** — CMS-03A-09 returns 422 VALIDATION_FAILED for a clone or definition schema failure with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-311** — CMS-03A-09 returns 429 RATE_LIMITED for exceeding the cms-definition-write limit with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-312** — CMS-03A-09 returns 502 DEPENDENCY_UNAVAILABLE for an invalid dependency response with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-313** — CMS-03A-09 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable RPC with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-314** — CMS-03A-09 returns 504 DEPENDENCY_UNAVAILABLE for an exceeded RPC deadline with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-315** — CMS-03A-09 returns 500 INTERNAL_ERROR for an unexpected failure scrubbed of internals with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-316** — CMS-03A-10 accepts SchemaDryRunRequest on a draft candidate and returns 202 SchemaDryRunResource in a queued state with a job reference. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-317** — CMS-03A-10 SchemaDryRunRequest is a strict object containing only expectedVersion, transformKey and transformVersion and rejects unknown keys. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-318** — CMS-03A-10 expectedVersion is a positive decimal string equal to the exact draft CAS version in If-Match. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-319** — CMS-03A-10 transformKey is nullable and, when present, matches the ValidatorKey grammar ^[a-z][a-z0-9._-]{0,127}$. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-320** — CMS-03A-10 transformVersion is nullable and, when present, is a positive decimal string. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-321** — CMS-03A-10 requires transformKey and transformVersion to be both null or both present. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-322** — CMS-03A-10 refuses a transform pair that is present for an additive classification or absent for a conditional or breaking classification with 422. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-323** — CMS-03A-10 requires a present transform pair to name a member of the code-owned transform registry and refuses any other pair with 422. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-324** — CMS-03A-10 path parameter contentTypeId is a UUID and a malformed value is 400 INVALID_REQUEST before any existence check. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-325** — CMS-03A-10 path parameter versionId is a UUID and a malformed value is 400 INVALID_REQUEST before any existence check. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-326** — CMS-03A-10 requires an Idempotency-Key header and rejects a missing key with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-327** — CMS-03A-10 accepts an Idempotency-Key only as 8-128 printable ASCII characters and rejects any other value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-328** — CMS-03A-10 requires If-Match as an exact quoted positive decimal version and rejects a missing or malformed value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-329** — CMS-03A-10 reports the validation message 'transform key and version must be both null or both present' on the transformVersion path. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-330** — CMS-03A-10 classification is derived server-side as additive, conditional or breaking and a candidate whose classification cannot be derived is refused with 422 before any attempt exists. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-331** — CMS-03A-10 SchemaDryRunResource exposes attemptId, jobId and migrationPlanId and never a caller-supplied value. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-332** — CMS-03A-10 SchemaDryRunResource state is one of queued, running, completed or failed. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-333** — CMS-03A-10 an unsealed (queued or running) resource carries null result, counts and hashes. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-334** — CMS-03A-10 a completed resource carries result, sourceCount, targetCount, rowErrorCount, sourceHash, targetHash and reportHash. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-335** — CMS-03A-10 reports 'a completed dry-run must expose sealed report evidence' for a completed resource missing sealed fields. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-336** — CMS-03A-10 reports 'an unsealed dry-run cannot carry final report evidence' for a non-completed resource carrying sealed fields. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-337** — CMS-03A-10 reports 'a passed dry-run requires zero row errors' for a passed resource with a nonzero rowErrorCount. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-338** — CMS-03A-10 reports 'a sealed failing scan must carry the actual scan errors' for a failed result with zero row errors. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-339** — CMS-03A-10 reports 'an unsealed failed dry-run requires a safe failure code' for a failed state without failureCode. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-340** — CMS-03A-10 reports 'only a failed dry-run carries a failure code' for a non-failed state carrying failureCode. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-341** — CMS-03A-10 contentHash is the lowercase SHA-256 hex of the RFC 8785 JCS canonical JSON of the resource excluding contentHash. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-342** — CMS-03A-10 allows a verified human holding cms.schema_designer on a draft candidate in the caller's scope. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-343** — CMS-03A-10 returns an indistinguishable 404 for a hidden or absent candidate and requires the candidate to be in state draft. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-344** — CMS-03A-10 derives source, target, compiler version and classification server-side and never from the request. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-345** — CMS-03A-10 same-key retry returns the same attempt, plan and job. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Transaction and external seams
- [x] **P2-S09-AC-346** — CMS-03A-10 changed candidate or transform evidence starts a new attempt and preserves every earlier immutable attempt. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Transaction and external seams
- [x] **P2-S09-AC-347** — CMS-03A-10 supersedes an earlier pre-running plan for the same version pair and refuses with 409 while an earlier plan is running, verifying or failed_retryable. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-348** — CMS-03A-10 commits the dry-run report, migration plan and BE00 job together in one idempotent transaction. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Operation error coverage
- [x] **P2-S09-AC-349** — CMS-03A-10 allows 30 requests per minute per user and 60 per minute per party (rate class cms-definition-write, keyed per operation ID) and returns 429 once either bucket is exceeded in the 60-second window. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-350** — CMS-03A-10 returns 400 INVALID_REQUEST for malformed path, header or body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-351** — CMS-03A-10 returns 401 UNAUTHENTICATED for a missing or expired session with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-352** — CMS-03A-10 returns 403 FORBIDDEN for draft capability denied with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-353** — CMS-03A-10 returns 404 NOT_FOUND for a hidden or absent candidate with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-354** — CMS-03A-10 returns 409 CONFLICT for a stale version or an idempotency mismatch with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-355** — CMS-03A-10 returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-356** — CMS-03A-10 returns 422 VALIDATION_FAILED for a transform, registry or count-input schema failure, a transform pair inconsistent with the derived classification, or a classification that is not derivable with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-357** — CMS-03A-10 returns 429 RATE_LIMITED for exceeding the cms-definition-write limit with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-358** — CMS-03A-10 returns 502 DEPENDENCY_UNAVAILABLE for an invalid dependency response with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-359** — CMS-03A-10 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable queue or RPC with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-360** — CMS-03A-10 returns 504 DEPENDENCY_UNAVAILABLE for an exceeded queue or RPC deadline with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-361** — CMS-03A-10 returns 500 INTERNAL_ERROR for an unexpected failure scrubbed of internals with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-362** — CMS-03A-11 accepts SchemaReviewSubmissionRequest on a draft with a passed persisted dry run and returns 201 SchemaReviewResource in state open. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-363** — CMS-03A-11 SchemaReviewSubmissionRequest is a strict object containing only expectedVersion and dryRunId and rejects unknown keys. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-364** — CMS-03A-11 expectedVersion is a positive decimal string equal to the exact draft CAS version in If-Match. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-365** — CMS-03A-11 dryRunId is a UUID. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-366** — CMS-03A-11 dryRunId must reference a persisted passed immutable dry run for the same candidate and evidence and any other reference is refused. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-367** — CMS-03A-11 path parameter contentTypeId is a UUID and a malformed value is 400 INVALID_REQUEST before any existence check. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-368** — CMS-03A-11 path parameter versionId is a UUID and a malformed value is 400 INVALID_REQUEST before any existence check. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-369** — CMS-03A-11 requires an Idempotency-Key header and rejects a missing key with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-370** — CMS-03A-11 accepts an Idempotency-Key only as 8-128 printable ASCII characters and rejects any other value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-371** — CMS-03A-11 requires If-Match as an exact quoted positive decimal version and rejects a missing or malformed value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-372** — CMS-03A-11 freezes definition, artifact, compiler, dependency manifest, dry-run, policy and stable context evidence on the review. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-373** — CMS-03A-11 resolves riskClass, requiredDecisionCount and requiredCapabilities from the code-owned workflow policy registry and never from the request. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Workflow policy registry
- [x] **P2-S09-AC-374** — CMS-03A-11 SchemaReviewResource exposes requiredDecisionCount between 1 and 8 and requiredCapabilities between 1 and 16 entries. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-375** — CMS-03A-11 SchemaReviewResource state is one of open, approved, rejected or invalidated and a new review is open. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-376** — CMS-03A-11 reports 'decision references must be unique' for duplicate decision references. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-377** — CMS-03A-11 reports 'recorded decision count must equal the decision references' for a mismatched recordedDecisionCount. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-378** — CMS-03A-11 reports 'approval evidence hash exists only when the review is approved' for a mismatched approvalEvidenceHash. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-379** — CMS-03A-11 reports 'decidedAt exists only when the review is approved' for a mismatched decidedAt. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-380** — CMS-03A-11 reports 'distinct qualifying approvers cannot exceed recorded approvals' for an inflated distinctApprovalCount. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-381** — CMS-03A-11 reports 'an approved review requires exactly the policy decision count' for an approved review whose distinctApprovalCount differs from requiredDecisionCount. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-382** — CMS-03A-11 reports 'a review with a rejection cannot be approved' for an approved review that holds a rejection. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-383** — CMS-03A-11 allows a verified human holding cms.schema_designer on a draft in the caller's scope. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-384** — CMS-03A-11 returns an indistinguishable 404 for a hidden or absent candidate and requires state draft with a persisted passed dry run for the same evidence. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-385** — CMS-03A-11 permits at most one live (open) review per exact frozen candidate and evidence identity, enforced by a partial unique index. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §State machine and concurrency
- [x] **P2-S09-AC-386** — CMS-03A-11 never counts the submitter as a reviewer. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §State machine and concurrency
- [x] **P2-S09-AC-387** — CMS-03A-11 replays the first response for a same-key exact retry. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Transaction and external seams
- [x] **P2-S09-AC-388** — CMS-03A-11 commits the frozen review and the draft-to-review transition atomically with no partial freeze. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Operation error coverage
- [x] **P2-S09-AC-389** — CMS-03A-11 returns 503 DEPENDENCY_UNAVAILABLE and creates no review when the bound workflow policy row is missing, ambiguous or hash-mismatched. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Workflow policy registry
- [x] **P2-S09-AC-390** — CMS-03A-11 reviews a successor under the strictest of the source version's and the candidate's workflow policy members, so a protected-to-ordinary key change keeps the protected count and specialist slot. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Workflow policy registry
- [x] **P2-S09-AC-391** — CMS-03A-11 allows 30 requests per minute per user and 60 per minute per party (rate class cms-definition-write, keyed per operation ID) and returns 429 once either bucket is exceeded in the 60-second window. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-392** — CMS-03A-11 returns 400 INVALID_REQUEST for malformed path, header or body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-393** — CMS-03A-11 returns 401 UNAUTHENTICATED for a missing or expired session with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-394** — CMS-03A-11 returns 403 FORBIDDEN for draft capability denied with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-395** — CMS-03A-11 returns 404 NOT_FOUND for a hidden or absent candidate with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-396** — CMS-03A-11 returns 409 CONFLICT for a stale version, a non-passed dry run, an existing live review or an idempotency mismatch with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-397** — CMS-03A-11 returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-398** — CMS-03A-11 returns 422 VALIDATION_FAILED for a review-freeze schema failure with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-399** — CMS-03A-11 returns 429 RATE_LIMITED for exceeding the cms-definition-write limit with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-400** — CMS-03A-11 returns 502 DEPENDENCY_UNAVAILABLE for an invalid dependency response with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-401** — CMS-03A-11 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable RPC or policy registry with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-402** — CMS-03A-11 returns 504 DEPENDENCY_UNAVAILABLE for an exceeded RPC deadline with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-403** — CMS-03A-11 returns 500 INTERNAL_ERROR for an unexpected failure scrubbed of internals with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-404** — CMS-03A-12 accepts SchemaReviewDecisionRequest from an assigned reviewer and returns 201 SchemaReviewDecisionResource. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-405** — CMS-03A-12 SchemaReviewDecisionRequest is a strict object containing only expectedVersion and decision, so a caller-supplied reviewer identity is rejected. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-406** — CMS-03A-12 expectedVersion is a positive decimal string equal to the exact review CAS version in If-Match. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-407** — CMS-03A-12 decision is the enum approve or reject. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-408** — CMS-03A-12 path parameter reviewId is a UUID and a malformed value is 400 INVALID_REQUEST before any existence check. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-409** — CMS-03A-12 requires an Idempotency-Key header and rejects a missing key with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-410** — CMS-03A-12 accepts an Idempotency-Key only as 8-128 printable ASCII characters and rejects any other value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-411** — CMS-03A-12 requires If-Match as an exact quoted positive decimal version and rejects a missing or malformed value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-412** — CMS-03A-12 SchemaReviewDecisionResource exposes only reviewId, decision, capability and decidedAt and no reviewer identifier. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-413** — CMS-03A-12 records capability cms.schema_review for the base reviewer slot. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Workflow policy registry
- [x] **P2-S09-AC-414** — CMS-03A-12 allows an independently authenticated human with an active cms.schema_review assignment on that frozen review and a current binding. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-415** — CMS-03A-12 does not reuse the owner-only authorization helper and requires neither schema design nor admin authority from the reviewer. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Security and abuse controls
- [x] **P2-S09-AC-416** — CMS-03A-12 treats assignment authority as effective only while starts_at <= now < ends_at with a current eligible binding. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §State machine and concurrency
- [x] **P2-S09-AC-417** — CMS-03A-12 refuses a decision by the review submitter. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-418** — CMS-03A-12 refuses a second decision by the same human on the same review. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Permission, RLS and grants
- [x] **P2-S09-AC-419** — CMS-03A-12 refuses an approve decision when the decisions that would remain unrecorded are fewer than the specialist slots no counted approver holds, and never refuses a reject decision on that ground. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-420** — CMS-03A-12 satisfies a specialist slot only through the deciding person's effective grant of the named cms.reviewer.<class> capability and never through an assignment alone. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Workflow policy registry
- [x] **P2-S09-AC-421** — CMS-03A-12 requires recent binding-bound MFA at decision time and records mfa_verified_at on the decision. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Security and abuse controls
- [x] **P2-S09-AC-422** — CMS-03A-12 approves the review only when distinct qualifying approvers equal requiredDecisionCount and every specialist slot is held by a counted approver. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §State machine and concurrency
- [x] **P2-S09-AC-423** — CMS-03A-12 invalidates the review when the candidate hash, compiler version, dependency set, dry-run evidence, policy or reviewer authority drifts. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §State machine and concurrency
- [x] **P2-S09-AC-424** — CMS-03A-12 serializes concurrent decisions on the exact review version so the loser receives a typed 409 and the approved review holds exactly the policy count. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §State machine and concurrency
- [x] **P2-S09-AC-425** — CMS-03A-12 replays the first response for a same-key exact retry. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Transaction and external seams
- [x] **P2-S09-AC-426** — CMS-03A-12 commits the append-only decision with its audit and outbox rows atomically. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Operation error coverage
- [x] **P2-S09-AC-427** — CMS-03A-12 returns a rejected review's candidate to an editable draft through an audited transition in the same transaction. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Operation error coverage
- [x] **P2-S09-AC-428** — CMS-03A-12 allows 30 requests per minute per user and 60 per minute per party (rate class cms-activation, keyed per operation ID; the class name does not set the number, because CMS-03A-04 and CMS-03A-14 to 17 use 10 and 20) and returns 429 once either bucket is exceeded in the 60-second window. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-429** — CMS-03A-12 returns 400 INVALID_REQUEST for malformed path, header or body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-430** — CMS-03A-12 returns 401 UNAUTHENTICATED for a missing or expired session with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-431** — CMS-03A-12 returns 403 FORBIDDEN for an assignment or capability denial with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-432** — CMS-03A-12 returns 404 NOT_FOUND for a hidden, absent or concealed review with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-433** — CMS-03A-12 returns 409 CONFLICT for a stale review version, a submitter or repeated human, frozen-evidence drift, an unsatisfiable specialist slot or an idempotency mismatch with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-434** — CMS-03A-12 returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-435** — CMS-03A-12 returns 422 VALIDATION_FAILED for a decision schema failure with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-436** — CMS-03A-12 returns 429 RATE_LIMITED for exceeding the cms-activation limit with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-437** — CMS-03A-12 returns 502 DEPENDENCY_UNAVAILABLE for an invalid dependency response with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-438** — CMS-03A-12 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable RPC with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-439** — CMS-03A-12 returns 504 DEPENDENCY_UNAVAILABLE for an exceeded RPC deadline with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-440** — CMS-03A-12 returns 500 INTERNAL_ERROR for an unexpected failure scrubbed of internals with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-441** — CMS-03A-12 returns 401 STEP_UP_REQUIRED with details { recoveryAction: 'step_up', allowedMethods: string[] } for missing, stale, future-dated or aal1 MFA proof, never collapsed to 400, 403 or reauthenticate recovery, evaluated before idempotency reservation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-442** — CMS-03A-13 returns 200 SchemaReviewResource with Cache-Control no-store for an authorized review. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-443** — CMS-03A-13 path parameter reviewId is a UUID and a malformed value is 400 INVALID_REQUEST before any existence check. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-444** — CMS-03A-13 rejects an Idempotency-Key header and an If-Match header with 400 INVALID_REQUEST because it is a read. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-445** — CMS-03A-13 returns only the capability-safe projection: frozen evidence summaries, required and recorded counts, decision references and permitted next actions. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-446** — CMS-03A-13 response contains no actor, person, party or private-binding identifiers and no caller-authoritative policy fields. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-447** — CMS-03A-13 distinctApprovalCount counts distinct humans who still qualify after the current assignment and capability authority recheck and does not re-require MFA freshness of earlier decisions. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-448** — CMS-03A-13 assignments is an owner-only list of at most eight safe summaries, each exactly { assignmentId, version, state active or revoked, startsAt, endsAt, reviewerLabel of 1 to 120 characters }, defaulting to [] and carrying no person, actor or party identifier. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-449** — CMS-03A-13 returns an empty assignments array to every non-owner reader. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-450** — CMS-03A-13 reports 'assignment ids must be unique and each span at most seven days' for duplicate assignmentId values or an assignment span that is not positive or exceeds seven days. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-451** — CMS-03A-13 allows a verified human in the review's submitter or cms.schema_designer scope. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-452** — CMS-03A-13 allows a human with an assigned review-only scope and denies a known readable review lacking the required capability with 403. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-453** — CMS-03A-13 performs no INSERT, UPDATE, DELETE, idempotency reservation, mutation audit, outbox write, migration lease or state transition on success or failure. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Database invariants and grants
- [x] **P2-S09-AC-454** — CMS-03A-13 allows 120 requests per minute per user and 240 per minute per party (rate class cms-definition-read, keyed per operation ID) and returns 429 once either bucket is exceeded in the 60-second window. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-455** — CMS-03A-13 returns 400 INVALID_REQUEST for a malformed UUID or a mutation-only header with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-456** — CMS-03A-13 returns 401 UNAUTHENTICATED for a missing or expired session with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-457** — CMS-03A-13 returns 403 FORBIDDEN for review-detail capability denied with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-458** — CMS-03A-13 returns 404 NOT_FOUND for a concealed, absent or out-of-scope review with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-459** — CMS-03A-13 returns 429 RATE_LIMITED for exceeding the cms-definition-read limit with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-460** — CMS-03A-13 returns 502 DEPENDENCY_UNAVAILABLE for an invalid projection response with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-461** — CMS-03A-13 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable projection or RPC with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-462** — CMS-03A-13 returns 504 DEPENDENCY_UNAVAILABLE for an exceeded projection or RPC deadline with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-463** — CMS-03A-13 returns 500 INTERNAL_ERROR for an unexpected failure scrubbed of internals with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-464** — CMS-03A-14 action create returns 201 SchemaReviewAssignmentResource for a bounded read and decide assignment on one frozen review. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-465** — CMS-03A-14 action revoke returns 200 SchemaReviewAssignmentResource for an existing assignment. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-466** — CMS-03A-14 SchemaReviewAssignmentRequest is a strict discriminated union on action with the literals create and revoke and rejects unknown keys and any other action. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-467** — CMS-03A-14 expectedVersion is a positive decimal string equal to the exact review CAS version in If-Match. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-468** — CMS-03A-14 create reviewerPersonId is a UUID. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-469** — CMS-03A-14 create reviewerPersonId must reference an authorized eligible existing human who is real, active or claimed, not banned and holds a current binding, and is never the review submitter. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-470** — CMS-03A-14 create expiresAt is an ISO 8601 datetime with an offset. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-471** — CMS-03A-14 create expiresAt is finite and no later than seven days from now. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-472** — CMS-03A-14 create expiresAt is no later than the grantor's own authority end instant. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-473** — CMS-03A-14 create reason is optional with 1 to 256 characters. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-474** — CMS-03A-14 revoke assignmentId is a UUID referencing an existing assignment of that review. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-475** — CMS-03A-14 revoke reason is optional with 1 to 256 characters. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-476** — CMS-03A-14 rejects broad scopes and delegation because the assignment is fixed to read and decide on one frozen review. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-477** — CMS-03A-14 path parameter reviewId is a UUID and a malformed value is 400 INVALID_REQUEST before any existence check. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-478** — CMS-03A-14 requires an Idempotency-Key header and rejects a missing key with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-479** — CMS-03A-14 accepts an Idempotency-Key only as 8-128 printable ASCII characters and rejects any other value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-480** — CMS-03A-14 requires If-Match as an exact quoted positive decimal version and rejects a missing or malformed value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-481** — CMS-03A-14 SchemaReviewAssignmentResource exposes capability as the literal cms.schema_review and actions as exactly [read, decide]. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-482** — CMS-03A-14 generated JSON schema pins the actions tuple with minItems and maxItems equal to 2 and additional items disallowed. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-483** — CMS-03A-14 never echoes the owner-supplied reviewerPersonId or the grantor or reviewer identity and returns only safe assignment fields. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-484** — CMS-03A-14 allows only the server-derived owner: the immutable cms_owner_initialization receipt identity with current effective owner authority, cms.schema_review.assign and recent binding-bound MFA. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-485** — CMS-03A-14 returns 404 for a concealed or cross-owner review and requires the review to be owned by the same organization. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-486** — CMS-03A-14 defines current effective owner authority as the receipt identity plus the owner's currently valid cms.schema_designer grant, and ends the grantor authority at the end of that grant's valid_through UTC day. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Security and abuse controls
- [x] **P2-S09-AC-487** — CMS-03A-14 creates no identity and grants only read and decide on the one frozen review. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-488** — CMS-03A-14 replays the first response for a same-key exact retry. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Transaction and external seams
- [x] **P2-S09-AC-489** — CMS-03A-14 commits assignment create or revoke with atomic audit and outbox rows. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Operation error coverage
- [x] **P2-S09-AC-490** — CMS-03A-14 is limited by the cms-activation rate class keyed per operation ID (10 per minute per user, 20 per party) and returns 429 at the limit. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-491** — CMS-03A-14 returns 400 INVALID_REQUEST for malformed path, header or body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-492** — CMS-03A-14 returns 401 UNAUTHENTICATED for a missing or expired session with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-493** — CMS-03A-14 returns 403 FORBIDDEN for owner assignment capability denied or cross-owner with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-494** — CMS-03A-14 returns 404 NOT_FOUND for a hidden, absent or cross-owner review with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-495** — CMS-03A-14 returns 409 CONFLICT for a stale review version, invalid expiry, unknown or ineligible human, broad scope or delegation, self or submitter target, revoke of a non-existent assignment or an idempotency mismatch with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-496** — CMS-03A-14 returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-497** — CMS-03A-14 returns 422 VALIDATION_FAILED for an assignment schema failure with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-498** — CMS-03A-14 returns 429 RATE_LIMITED for exceeding the cms-activation limit with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-499** — CMS-03A-14 returns 502 DEPENDENCY_UNAVAILABLE for an invalid dependency response with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-500** — CMS-03A-14 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable RPC with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-501** — CMS-03A-14 returns 504 DEPENDENCY_UNAVAILABLE for an exceeded RPC deadline with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-502** — CMS-03A-14 returns 500 INTERNAL_ERROR for an unexpected failure scrubbed of internals with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-503** — CMS-03A-14 returns 401 STEP_UP_REQUIRED with details { recoveryAction: 'step_up', allowedMethods: string[] } for missing, stale, future-dated or aal1 MFA proof, never collapsed to 400, 403 or reauthenticate recovery, evaluated before idempotency reservation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-504** — CMS-03A-15 accepts CapabilityGrantRequest from the receipt-derived owner and returns 201 CmsCapabilityGrantResource for one subject and one capability. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-505** — CMS-03A-15 CapabilityGrantRequest is a strict object containing only subjectPersonId, capability, validThrough and reason and rejects unknown keys, including any owner, grantor or validFrom. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-506** — CMS-03A-15 subjectPersonId is a UUID and a malformed value is 422 VALIDATION_FAILED. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-507** — CMS-03A-15 subjectPersonId must name an existing human with a confirmed unended membership in the owner's organization who is real, active or claimed and not banned. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-508** — CMS-03A-15 capability must be a member of the closed GrantableCmsCapability registry. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-509** — CMS-03A-15 refuses cms.schema_review, cms.schema_review.assign, cms.delivery_review, cms.delivery_review.assign, any admin.* key, a wildcard and an unregistered key with 422. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-510** — CMS-03A-15 lets the owner target itself for any grantable capability with no self-target refusal. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-511** — CMS-03A-15 validThrough is a YYYY-MM-DD string that is a real calendar date read as a UTC date. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-512** — CMS-03A-15 validThrough is not before the current UTC date. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-513** — CMS-03A-15 validThrough is not after today plus 89 UTC days, so the grant ends at the end of that UTC day and never later than 90 days after the command (DEC-120 standing-grant term of at most 90 UTC days). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-514** — CMS-03A-15 reason is optional, 1 to 256 Unicode characters, normalized NFC. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-515** — CMS-03A-15 requires an Idempotency-Key header and rejects a missing key with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-516** — CMS-03A-15 accepts an Idempotency-Key only as 8-128 printable ASCII characters and rejects any other value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-517** — CMS-03A-15 carries no If-Match header because it creates a new aggregate or re-establishes a revoked one. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-518** — CMS-03A-15 reports the validation message 'not a real calendar date' for a non-calendar validThrough. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-519** — CMS-03A-15 reports the field error code grant_term_spans_at_most_ninety_utc_days for a validThrough beyond today plus 89 days and the same code in the response-contract refinement for a resource whose validFrom to validThrough span exceeds 89 days. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-520** — CMS-03A-15 CmsCapabilityGrantResource state is derived as active, lapsed or revoked and lapsed is an active row whose valid_through is before the current UTC date. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-521** — CMS-03A-15 sets validFrom to the current UTC date and endsAt to 00:00:00Z of the UTC day after validThrough. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-522** — CMS-03A-15 returns subjectPersonId only to the receipt-derived owner and returns lastAction granted, a nullable reason and a JCS contentHash. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-523** — CMS-03A-15 allows only the receipt-derived owner: the immutable cms_owner_initialization receipt identity acting in that organization with a current binding and recent binding-bound MFA, with no capability key and no currently valid CMS grant required. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-524** — CMS-03A-15 confers only the named capability for a finite term and creates no identity, party, alias or membership and no admin, grant, delegation or purpose authority. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-525** — CMS-03A-15 requires every GrantableCmsCapability member to be a registered capability key and CI asserts the grantable set is a subset of the platform capability registry. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Security and abuse controls
- [x] **P2-S09-AC-526** — CMS-03A-15 never writes a non-CMS capability code. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Security and abuse controls
- [x] **P2-S09-AC-527** — CMS-03A-15 returns 409 CONFLICT when an active aggregate already exists for the subject and capability and the owner is directed to renew. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Operation error coverage
- [x] **P2-S09-AC-528** — CMS-03A-15 re-establishes a revoked aggregate at the next version through a new grant. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §State machine and concurrency
- [x] **P2-S09-AC-529** — CMS-03A-15 locks the (owner, subject, capability) key and serializes concurrent grants. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Transaction and external seams
- [x] **P2-S09-AC-530** — CMS-03A-15 replays the first response for a same-key retry and returns 409 for the same body under a new key against an active aggregate and for a changed body under the same key. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Transaction and external seams
- [x] **P2-S09-AC-531** — CMS-03A-15 commits the aggregate, event row, actor-grant projection, audit, outbox and idempotency completion in one transaction and rolls all of it back on any failure. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Transaction and external seams
- [x] **P2-S09-AC-532** — CMS-03A-15 is limited by the cms-activation rate class keyed per operation ID (10 per minute per user, 20 per party) and returns 429 at the limit. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-533** — CMS-03A-15 returns 400 INVALID_REQUEST for a malformed header or body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-534** — CMS-03A-15 returns 401 UNAUTHENTICATED for a missing or expired session with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-535** — CMS-03A-15 returns 403 FORBIDDEN for a caller who is not the receipt-derived owner, including a holder of any granted CMS capability, with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-536** — CMS-03A-15 returns 404 NOT_FOUND for an absent, ineligible or cross-organization subject with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-537** — CMS-03A-15 returns 409 CONFLICT for an existing active aggregate or an idempotency mismatch with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-538** — CMS-03A-15 returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-539** — CMS-03A-15 returns 422 VALIDATION_FAILED for a capability that is not grantable, a validThrough outside the ceiling or a reason bound with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-540** — CMS-03A-15 returns 429 RATE_LIMITED for exceeding the cms-activation limit with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-541** — CMS-03A-15 returns 502 DEPENDENCY_UNAVAILABLE for an invalid dependency response with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-542** — CMS-03A-15 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable RPC with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-543** — CMS-03A-15 returns 504 DEPENDENCY_UNAVAILABLE for an exceeded RPC deadline with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-544** — CMS-03A-15 returns 500 INTERNAL_ERROR for an unexpected failure scrubbed of internals with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-545** — CMS-03A-15 returns 401 STEP_UP_REQUIRED with details { recoveryAction: 'step_up', allowedMethods: string[] } for missing, stale, future-dated or aal1 MFA proof, never collapsed to 400, 403 or reauthenticate recovery, evaluated before idempotency reservation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-546** — CMS-03A-16 accepts CapabilityGrantRenewalRequest and returns 200 CmsCapabilityGrantResource with a restarted term. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-547** — CMS-03A-16 CapabilityGrantRenewalRequest is a strict object containing only expectedVersion, validThrough and reason and rejects unknown keys. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-548** — CMS-03A-16 expectedVersion is a positive decimal string equal to the exact strong If-Match, which must equal the grant aggregate version. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-549** — CMS-03A-16 grantId is a UUID path parameter. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-550** — CMS-03A-16 validThrough is a real calendar UTC date from the current UTC date through today plus 89 UTC days (DEC-120 standing-grant term of at most 90 UTC days). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-551** — CMS-03A-16 reason is optional, 1 to 256 Unicode characters, normalized NFC. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-552** — CMS-03A-16 requires an Idempotency-Key header and rejects a missing key with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-553** — CMS-03A-16 accepts an Idempotency-Key only as 8-128 printable ASCII characters and rejects any other value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-554** — CMS-03A-16 requires If-Match as an exact quoted positive decimal version and rejects a missing or malformed value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-555** — CMS-03A-16 restarts the term from the current UTC date, increments the aggregate version and leaves no cumulative cap on repeated renewal. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Security and abuse controls
- [x] **P2-S09-AC-556** — CMS-03A-16 allows only the receipt-derived owner with recent step-up MFA. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-557** — CMS-03A-16 renews an aggregate in physical state active whether effective or lapsed and refuses a revoked aggregate. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-558** — CMS-03A-16 serializes two concurrent commands on one grant by the aggregate lock and expected version so the loser receives a typed 409. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §State machine and concurrency
- [x] **P2-S09-AC-559** — CMS-03A-16 replays the first response for a same-key exact retry. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Transaction and external seams
- [x] **P2-S09-AC-560** — CMS-03A-16 commits the renewal atomically with its event row, actor-grant projection, audit and outbox. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Operation error coverage
- [x] **P2-S09-AC-561** — CMS-03A-16 allows 10 requests per minute per user and 20 per minute per party (rate class cms-activation, keyed per operation ID) and returns 429 once either bucket is exceeded in the 60-second window. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-562** — CMS-03A-16 returns 400 INVALID_REQUEST for a malformed path, header or body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-563** — CMS-03A-16 returns 401 UNAUTHENTICATED for a missing or expired session with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-564** — CMS-03A-16 returns 403 FORBIDDEN for a caller who is not the receipt-derived owner with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-565** — CMS-03A-16 returns 404 NOT_FOUND for a hidden, absent or cross-organization grant with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-566** — CMS-03A-16 returns 409 CONFLICT for a stale version, a revoked aggregate or an idempotency mismatch with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-567** — CMS-03A-16 returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-568** — CMS-03A-16 returns 422 VALIDATION_FAILED for a validThrough outside the ceiling or a reason bound with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-569** — CMS-03A-16 returns 429 RATE_LIMITED for exceeding the cms-activation limit with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-570** — CMS-03A-16 returns 502 DEPENDENCY_UNAVAILABLE for an invalid dependency response with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-571** — CMS-03A-16 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable RPC with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-572** — CMS-03A-16 returns 504 DEPENDENCY_UNAVAILABLE for an exceeded RPC deadline with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-573** — CMS-03A-16 returns 500 INTERNAL_ERROR for an unexpected failure scrubbed of internals with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-574** — CMS-03A-16 returns 401 STEP_UP_REQUIRED with details { recoveryAction: 'step_up', allowedMethods: string[] } for missing, stale, future-dated or aal1 MFA proof, never collapsed to 400, 403 or reauthenticate recovery, evaluated before idempotency reservation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-575** — CMS-03A-17 accepts CapabilityGrantRevocationRequest and returns 200 CmsCapabilityGrantResource in state revoked. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-576** — CMS-03A-17 CapabilityGrantRevocationRequest is a strict object containing only expectedVersion and reason and rejects unknown keys. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-577** — CMS-03A-17 expectedVersion is a positive decimal string equal to the exact strong If-Match, which must equal the grant aggregate version. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-578** — CMS-03A-17 grantId is a UUID path parameter. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-579** — CMS-03A-17 reason is optional, 1 to 256 Unicode characters, normalized NFC. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-580** — CMS-03A-17 requires an Idempotency-Key header and rejects a missing key with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-581** — CMS-03A-17 accepts an Idempotency-Key only as 8-128 printable ASCII characters and rejects any other value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-582** — CMS-03A-17 requires If-Match as an exact quoted positive decimal version and rejects a missing or malformed value with 400 INVALID_REQUEST. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-583** — CMS-03A-17 takes an active aggregate to revoked with version plus one and is effective immediately in the same transaction. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §State machine and concurrency
- [x] **P2-S09-AC-584** — CMS-03A-17 leaves a lapsed or revoked grant conferring no authority because every capability predicate requires valid_from <= current UTC date <= valid_through on an active row. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §State machine and concurrency
- [x] **P2-S09-AC-585** — CMS-03A-17 allows only the receipt-derived owner with recent step-up MFA. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-586** — CMS-03A-17 serializes concurrent commands on one grant so the loser receives a typed 409. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §State machine and concurrency
- [x] **P2-S09-AC-587** — CMS-03A-17 replays the first response for a same-key exact retry. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Transaction and external seams
- [x] **P2-S09-AC-588** — CMS-03A-17 commits the revocation atomically with its event row, actor-grant projection, audit and outbox. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Operation error coverage
- [x] **P2-S09-AC-589** — CMS-03A-17 allows 10 requests per minute per user and 20 per minute per party (rate class cms-activation, keyed per operation ID) and returns 429 once either bucket is exceeded in the 60-second window. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-590** — CMS-03A-17 returns 400 INVALID_REQUEST for a malformed path, header or body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-591** — CMS-03A-17 returns 401 UNAUTHENTICATED for a missing or expired session with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-592** — CMS-03A-17 returns 403 FORBIDDEN for a caller who is not the receipt-derived owner with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-593** — CMS-03A-17 returns 404 NOT_FOUND for a hidden, absent or cross-organization grant with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-594** — CMS-03A-17 returns 409 CONFLICT for a stale version, an already revoked aggregate or an idempotency mismatch with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-595** — CMS-03A-17 returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-596** — CMS-03A-17 returns 422 VALIDATION_FAILED for a reason bound with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-597** — CMS-03A-17 returns 429 RATE_LIMITED for exceeding the cms-activation limit with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-598** — CMS-03A-17 returns 502 DEPENDENCY_UNAVAILABLE for an invalid dependency response with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-599** — CMS-03A-17 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable RPC with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-600** — CMS-03A-17 returns 504 DEPENDENCY_UNAVAILABLE for an exceeded RPC deadline with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-601** — CMS-03A-17 returns 500 INTERNAL_ERROR for an unexpected failure scrubbed of internals with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-602** — CMS-03A-17 returns 401 STEP_UP_REQUIRED with details { recoveryAction: 'step_up', allowedMethods: string[] } for missing, stale, future-dated or aal1 MFA proof, never collapsed to 400, 403 or reauthenticate recovery, evaluated before idempotency reservation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-603** — CMS-03A-18 returns 200 CmsCapabilityGrantListPage with Cache-Control no-store for the receipt-derived owner. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-604** — CMS-03A-18 CmsCapabilityGrantListQuery is a strict object and rejects unknown query keys. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-605** — CMS-03A-18 subjectPersonId is an optional UUID filter. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-606** — CMS-03A-18 capability is an optional member of the grantable capability set. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-607** — CMS-03A-18 state is an optional filter of active, lapsed or revoked. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-608** — CMS-03A-18 limit is an integer from 1 to 100 with default 25. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-609** — CMS-03A-18 cursor is an optional opaque string of 1 to 512 characters. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-610** — CMS-03A-18 sort is updatedAt or validThrough with default updatedAt. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-611** — CMS-03A-18 direction is asc or desc with default desc. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-612** — CMS-03A-18 rejects an Idempotency-Key header and an If-Match header with 400 INVALID_REQUEST because it is a read. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-613** — CMS-03A-18 returns at most 100 CmsCapabilityGrantResource items and a nullable nextCursor of 1 to 512 characters. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-614** — CMS-03A-18 derives the lapsed state server-side as an active row whose valid_through is before the current UTC date. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-615** — CMS-03A-18 allows only the receipt-derived owner and needs no step-up for the read. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-616** — CMS-03A-18 returns only rows of the owner's organization and omits rows outside it without emitting 404. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-617** — CMS-03A-18 performs no INSERT, UPDATE, DELETE, idempotency reservation, mutation audit, outbox write or state transition on success or failure. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Database invariants and grants
- [x] **P2-S09-AC-618** — CMS-03A-18 allows 120 requests per minute per user and 240 per minute per party (rate class cms-definition-read, keyed per operation ID) and returns 429 once either bucket is exceeded in the 60-second window. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route Registry
- [x] **P2-S09-AC-619** — CMS-03A-18 returns 400 INVALID_REQUEST for a malformed query, cursor or mutation-only header with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-620** — CMS-03A-18 returns 401 UNAUTHENTICATED for a missing or expired session with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-621** — CMS-03A-18 returns 403 FORBIDDEN for a caller who is not the receipt-derived owner with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-622** — CMS-03A-18 returns 422 VALIDATION_FAILED for a filter, sort or page validation failure with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-623** — CMS-03A-18 returns 429 RATE_LIMITED for exceeding the cms-definition-read limit with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-624** — CMS-03A-18 returns 502 DEPENDENCY_UNAVAILABLE for an invalid projection response with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-625** — CMS-03A-18 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable projection or RPC with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-626** — CMS-03A-18 returns 504 DEPENDENCY_UNAVAILABLE for an exceeded projection or RPC deadline with the BE00 ApiError envelope and only the DEPENDENCY_UNAVAILABLE details { dependencyClass, retryable: true, retryAfterSeconds? } (BE00 uses this one code for 502, 503 and 504). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-627** — CMS-03A-18 returns 500 INTERNAL_ERROR for an unexpected failure scrubbed of internals with the BE00 ApiError envelope and only the allowlisted details for that status. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-628** — CMS-03A-04 returns 401 STEP_UP_REQUIRED with { recoveryAction: 'step_up', allowedMethods: string[] } for missing or stale activator MFA, never collapsed to 400 or 403 or replaced with reauthenticate. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and error matrix
- [x] **P2-S09-AC-629** — CMS-03A-04 requires cms.schema_designer only from the activator and no approver capability; required approvals come from the approve decisions of assigned reviewers. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-630** — CMS-03A-04 approvalIds are the approve-decision IDs of exactly one approved review for the candidate. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-631** — CMS-03A-04 rechecks only the activator's own binding-bound MFA at activation and does not re-require MFA freshness for a reviewer's earlier decision. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Security and abuse controls
- [x] **P2-S09-AC-632** — CMS-03A-04 rechecks current assignment and capability authority of every counted approver and the frozen evidence at activation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Transaction and external seams
- [x] **P2-S09-AC-633** — CMS-03A-04 refuses activation and invalidates the review when a counted approver stops holding the specialist capability before activation. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Workflow policy registry
- [x] **P2-S09-AC-634** — CMS-03A-04 reads approval evidence only from the CMS-owned review, decision and assignment tables and never from CFG config-change reviews. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-635** — activationPreparation carries dryRunRef, jobRef, reviewRef, optional templateCompatibility and permittedNextActions only. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-636** — activationPreparation jobRef state accepts only the BE00 job states queued, running, succeeded, failed and cancelled. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-637** — activationPreparation permittedNextActions are a closed set of at most six of create_successor, start_dry_run, submit_review, assign_reviewer, record_decision and activate. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-638** — activationPreparation never reports a queued or running dry run as passed and treats only a completed passed report with zero row errors as satisfiable readiness. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-639** — activationPreparation contains no actor ownership identifier, private binding id, raw content or caller-authoritative policy field. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-640** — The private actor, person, party and binding projection hash is computed server-side only and is never exposed to the browser as an evidence field or correlation token. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-641** — activationPreparation dryRunRef carries an optional nullable failureCode matching ^[A-Z][A-Z0-9_]{0,63}$ taken from the sealed dry-run failure code. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-642** — activationPreparation dryRunRef.failureCode is non-null only when the referenced dry run is in the unsealed failed state. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-643** — cms_schema_reviews persists the IA envelope plus the typed frozen columns with CHECKs: state in open, approved, rejected, invalidated; 64-hex definition, dependency, dry-run report, policy and context hashes; candidate_version_no > 0; policy_version > 0; risk_class in ordinary, protected; required_decision_count 1..8; required_capabilities a JSON array of 1..16. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-644** — cms_schema_reviews source_policy_key, source_policy_version and source_policy_hash are all null or all present by CHECK. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-645** — cms_schema_reviews enforces one open review per (content_type_version_id, definition_hash, dry_run_id) with a partial unique index. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-646** — cms_schema_reviews freezes its evidence columns immutably and changes state only through the decision or invalidation RPC. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-647** — cms_schema_reviews has RLS enabled and forced, direct browser and service-role table grants revoked, and a read predicate limited to the candidate's designer scope or an assigned review-only scope. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Permission, RLS and grants
- [x] **P2-S09-AC-648** — cms_schema_review_decisions persists the IA envelope plus review_id, assignment_id, assignment_version, reviewer_person_ref, binding_context_hash, capability_key = cms.schema_review, capability_version, decision in approve or reject, decided_at, reviewed_hash and a non-null mfa_verified_at. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-649** — cms_schema_review_decisions enforces UNIQUE(review_id, reviewer_person_ref) so no human decides twice on one review. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-650** — cms_schema_review_decisions forbids reviewer_person_ref equal to the review's submitter_person_ref by a BEFORE INSERT trigger together with the RPC and never by a cross-row CHECK. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-651** — cms_schema_review_decisions is append-only with updated_at equal to created_at, UPDATE, DELETE and direct grants revoked and forced RLS. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-652** — cms_schema_review_assignments persists capability_key = cms.schema_review, actions = ARRAY['read','decide'], state active or revoked, starts_at, ends_at with CHECK ends_at > starts_at and ends_at <= starts_at + 7 days, and an optional reason of 1..256 octets. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-653** — cms_schema_review_assignments confers effective authority only while starts_at <= now < ends_at with a current binding and capability, rechecked at decision and activation, so no expiry sweep is required. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-654** — cms_schema_review_assignments stores no owner acting context, is created or revoked only by the named assignment RPC, cannot be delegated or broadened, and has UPDATE, DELETE and direct grants revoked with forced RLS. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-655** — cms_capability_grants persists subject_person_ref, capability_code in the ^[a-z][a-z0-9_.-]{0,127}$ grammar, finite valid_from and valid_through dates, grantor_person_ref, last_action in granted, renewed or revoked, and an optional reason of 1..256 octets. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-656** — cms_capability_grants enforces CHECK valid_through >= valid_from and a bounded term, which DEC-120 sets at valid_through - valid_from <= 89. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-657** — cms_capability_grants enforces CHECK (state = 'revoked') = (last_action = 'revoked') and UNIQUE(owner_id, subject_person_ref, capability_code). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-658** — cms_capability_grants writes through the grant, renew and revoke RPCs only, each upserting the matching identity_private.organization_actor_grant row in the same transaction, and no other CMS code writes that projection. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-659** — A forward-only migration backfills one aggregate (version 1, last_action granted, grantor the owner initialization receipt person) for each existing CMS-capability actor-grant row of the owner's organization. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-660** — cms_capability_grants has RLS enabled and forced, is readable only by the receipt-derived owner through the projection RPC, and has no direct browser or service-role table grants. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Permission, RLS and grants
- [x] **P2-S09-AC-661** — cms_capability_grant_events is append-only: one row per grant, renewal and revocation in the same transaction as the aggregate write, with UNIQUE(grant_id, aggregate_version), action in granted, renewed or revoked, prior_valid_through, binding_context_hash and mfa_verified_at. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-662** — cms_capability_grant_events pins updated_at equal to created_at, rejects UPDATE and DELETE, forces RLS and never serializes identity hashes into a resource or log. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-663** — cms_workflow_policies is seeded only by a forward migration from the code-owned registry with state seeded, UNIQUE(policy_key, policy_version) and UPDATE and DELETE rejected. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-664** — cms_workflow_policies enforces CHECK that a protected member has at least two required decisions and at least two required capabilities. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-665** — policyHash is the lowercase SHA-256 hex of the RFC 8785 JCS canonical member object and CI recomputes every member against its seeded row. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Workflow policy registry
- [x] **P2-S09-AC-666** — The evidence projections return NULL (fail closed) when a stored policy_hash differs from the recomputation of the row's own columns. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Workflow policy registry
- [x] **P2-S09-AC-667** — The ordinary registry members editorial, editorial.default, cms.content.workflow and cms.standard (version 1) each require one decision and the cms.reviewer slot. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Workflow policy registry
- [x] **P2-S09-AC-668** — The protected members cms.disclosure.policy, .legal, .security and .financial (version 1) each require two decisions with the slots cms.reviewer plus the matching cms.reviewer.<class> specialist. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Workflow policy registry
- [x] **P2-S09-AC-669** — A content-type version binds exactly one registry member through workflow_key and workflow_version, a policy changes only by shipping a new member version in code plus a forward migration, and a caller-supplied policy, hash or capability list is never authority. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Workflow policy registry
- [x] **P2-S09-AC-670** — The same strictest-of rule applies to the editorial policy an entry carries when its bound schema version supersedes a source version. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Workflow policy registry
- [x] **P2-S09-AC-671** — cms_schema_dry_run_reports holds one row per dry-run attempt with attempt_no > 0, state in queued, running, completed or failed, job_id, plan_id, failure_code and sealed_at, with UNIQUE(target_version_id, attempt_no), UNIQUE(plan_id), UNIQUE(job_id) and CHECK (state = completed) = (sealed_at IS NOT NULL). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-672** — cms_schema_dry_run_reports advances only forward queued, running, then exactly one terminal state, an unsealed row carries NULL result, counts, hashes and report, sealing writes them together, a trigger rejects every UPDATE of a completed or failed row and DELETE is always rejected. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-673** — cms_schema_dry_run_reports retains earlier attempts for a target version and a changed candidate or transform starts a new attempt_no. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-674** — cms_schema_dry_run_row_evidence records source_table from a code-owned allowlist, source_row_id, a 64-hex source_hash, a nullable output_hash, a nullable error_code and recorded_at with UNIQUE(report_id, source_table, source_row_id). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-675** — cms_schema_dry_run_row_evidence rejects UPDATE and DELETE, has forced RLS and no browser or service-role table grants, and inserts at most 128 rows per write. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-676** — row_error_count equals the number of evidence rows whose error_code is not NULL and no resource, response, event or log carries row evidence. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-677** — cms_schema_migration_plans makes plan identity attempt-scoped with a partial unique index allowing at most one live plan per (from_version_id, to_version_id) and retaining earlier attempts' plans. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [ ] **P2-S09-AC-678** — cms_schema_migration_plans.dry_run_report holds a provisional fingerprint object from plan creation that supersession uses, and the sealed cms_schema_dry_run_reports row remains authoritative for results. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-679** — The transform registry declares for every entry a key, positive version, 64-hex digest, source and target constraints, a non-empty accepted field-kind subset and deterministic bounded behavior of at most 128 rows per batch with no I/O, clock or randomness, and is never an uploaded expression, SQL or code. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-680** — A scan refuses a registry entry whose digest, constraints or field kinds do not match the candidate and the plan stores the resolved key and version. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-681** — The transform identity.revalidate version 1 carries every stored value unchanged (output_hash equals source_hash), validates it against the target constraints and records TRANSFORM_TARGET_VIOLATION with no output hash for a failing row. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-682** — The transform default.fill_literal version 1 writes the target field's declared literal default for an absent or null value, passes an existing value unchanged and records TRANSFORM_DEFAULT_UNAVAILABLE for any other default mode. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-683** — A migration shape with no registered transform member is refused at CMS-03A-10 until a member ships in code with a forward migration. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-684** — The compiler addresses a version's artifact by cms/content-type/{typeKey}/v{versionNo}, hashes it deterministically without a random salt and never mutates the source artifact, and tests cover the second and third version. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-685** — The SQL API exposes exactly the eighteen named RPCs cms_create_type_draft through cms_list_capability_grants to named capability grants and anon and authenticated hold no direct INSERT, UPDATE or DELETE on the tables. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Database invariants and grants
- [x] **P2-S09-AC-686** — RLS is enabled and forced on the cms_workflow_policies table together with its seeded-only UPDATE and DELETE rejection (RLS on the review, grant and row-evidence tables is carried by the reopened AC181). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Database Schema
- [x] **P2-S09-AC-687** — cms.capability.grant.changed.v1 carries exactly { grantId, subjectPersonId } in the BE00 identifier-only envelope with aggregateType cms_capability_grant and aggregateVersion equal to the committed grant version. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Event schemas
- [x] **P2-S09-AC-688** — cms.capability.grant.changed.v1 is emitted by CMS-03A-15, -16 and -17 only after the aggregate, event row, actor-grant projection, audit and outbox commit. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Event schemas
- [x] **P2-S09-AC-689** — Authorization consumers refetch the current grant, never treat cms.capability.grant.changed.v1 as permission proof, and send an unknown event version to the DLQ. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Event schemas
- [x] **P2-S09-AC-690** — The metrics cms_schema_review_age, cms_schema_review_pending_total{riskClass} and cms_schema_review_decision_total{decision} are emitted for the review lifecycle. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Observability
- [x] **P2-S09-AC-691** — The metrics cms_schema_review_assignment_total{action,outcome} and cms_capability_grant_total{action,outcome} are emitted for assignments and grants. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Observability
- [x] **P2-S09-AC-692** — The metric cms_schema_dry_run_total{state,classification} is emitted for dry-run attempts. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Observability
- [x] **P2-S09-AC-693** — An alert fires for a review open past its expected window. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Observability
- [x] **P2-S09-AC-694** — An alert fires for a spike in decision, assignment or capability-grant denials. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Observability
- [x] **P2-S09-AC-695** — Logs and metrics never include reviewer, grantor, reviewerPersonId or subjectPersonId identifiers. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Observability
- [x] **P2-S09-AC-696** — The capabilities cms.taxonomy_curator, cms.publisher, cms.navigation_editor, cms.media_contributor and cms.media_curator are registered in the platform capability registry by code plus a forward migration together with the grantable set, and a grant never widens the scopes the owning operation applies. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Security and abuse controls
- [x] **P2-S09-AC-697** — cms.delivery_review and cms.delivery_review.assign follow the cms.schema_review pattern and are never grantable. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Security and abuse controls
- [x] **P2-S09-AC-698** — Resolver request is a strict object with templateVersionId (UUID), contentTypeId (UUID), contentTypeVersionId (UUID) and optional expectedTemplateVersionNo (positive decimal). [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Named template compatibility resolver (DEC-108)
- [x] **P2-S09-AC-699** — Resolver verifies contentTypeVersionId belongs to contentTypeId under the same owner and actor scope and never resolves a current or latest version implicitly. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Named template compatibility resolver (DEC-108)
- [x] **P2-S09-AC-700** — Resolver success returns exactly the ten-field safe projection (templateVersionId, templateKey, templateVersionNo, state, compatible, withdrawn, templateDigest, contentTypeId, contentTypeVersionId) with no owner IDs, binding manifests, slot internals or renderer refs. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Named template compatibility resolver (DEC-108)
- [x] **P2-S09-AC-701** — Resolver success is the literal invariant compatible true and withdrawn false and never a soft compatible false body. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Named template compatibility resolver (DEC-108)
- [x] **P2-S09-AC-702** — Resolver echoes the exact verified candidate contentTypeVersionId. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Named template compatibility resolver (DEC-108)
- [x] **P2-S09-AC-703** — Resolver returns the typed failure NOT_FOUND for an absent or concealed reference. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Named template compatibility resolver (DEC-108)
- [x] **P2-S09-AC-704** — Resolver returns the typed failure INCOMPATIBLE for an incompatible reference. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Named template compatibility resolver (DEC-108)
- [x] **P2-S09-AC-705** — Resolver returns the typed failure WITHDRAWN for a withdrawn definition. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Named template compatibility resolver (DEC-108)
- [x] **P2-S09-AC-706** — Resolver returns the typed failure VERSION_MISMATCH for an expectedTemplateVersionNo mismatch and never substitutes a template version. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Named template compatibility resolver (DEC-108)
- [x] **P2-S09-AC-707** — Resolver performs no INSERT, UPDATE, DELETE, idempotency reservation, audit or outbox write or state transition on success or failure and no GET derives a mutation from it. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Named template compatibility resolver (DEC-108)
- [x] **P2-S09-AC-708** — Resolver is executable only by the service-role Worker with no browser or authenticated table access and no browser route. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Named template compatibility resolver (DEC-108)
- [x] **P2-S09-AC-709** — Resolver conceals an inaccessible or cross-owner template, version or type. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Named template compatibility resolver (DEC-108)
- [x] **P2-S09-AC-710** — Resolver result reaches the browser only as the optional templateCompatibility member of activationPreparation and only for a compatible result. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Named template compatibility resolver (DEC-108)
- [x] **P2-S09-AC-711** — The first integrated path runs create, actual dry-run, submit review, independent decisions and activate through the real producers with no fixture rows. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and route tests
- [x] **P2-S09-AC-712** — The second integrated path runs actual source rows, a compatible template, a successor, a nonzero dry-run with backfill and verify, an independent review and the second atomic switch through the real producers. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and route tests
- [x] **P2-S09-AC-713** — Directly inserting review, decision, dry-run, approved-state or completed-plan rows cannot satisfy either integrated path and the guard tests fail on such a substitute. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and route tests
- [x] **P2-S09-AC-714** — Every test human (author, editor, reviewer, specialist reviewer, template designer, publisher) is provisioned only through CMS-03A-15 and assigned through CMS-03A-14, and directly inserting organization_actor_grant rows cannot satisfy the paths. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Contract and route tests
- [x] **P2-S09-AC-715** — The second integrated path consumes real entries created through CMS-03B-10 and CMS-03B-01 and a compatible template created through CMS-03C-01 and accepted by the service-only resolver. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Cross-shard direction
- [x] **P2-S09-AC-716** — The editorial policy evidence function resolves the bound immutable policy row of the entry's schema version and returns NULL on absence, ambiguity, malformed data or a hash mismatch. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Registry invariants
- [x] **P2-S09-AC-717** — AUTH-API-16 returns 200 MfaFactorsResource with the per-account MFA version as ETag for the signed-in user. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-718** — AUTH-API-16 takes no body, query, Idempotency-Key or If-Match. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-16 — MFA factor list
- [x] **P2-S09-AC-719** — AUTH-API-16 MfaFactorsResource is exactly { factors, allowedMethods, stepUp: { fresh, freshUntil }, version } and each factor is { id, method, friendlyName, state, verifiedAt, lastUsedAt, pendingExpiresAt }. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-16 — MFA factor list
- [x] **P2-S09-AC-720** — AUTH-API-16 returns the application factor UUID, never the Supabase factor id, and lists only pending, verified and reconciling factors, omitting removed and expired rows. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-16 — MFA factor list
- [x] **P2-S09-AC-721** — AUTH-API-16 computes stepUp from the verified token only, returning fresh false and freshUntil null when the proof is absent or stale. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-16 — MFA factor list
- [x] **P2-S09-AC-722** — AUTH-API-16 excludes any secret, otpauth URI, provider factor id, challenge id, token, IP and any other user's data and makes no provider call. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-16 — MFA factor list
- [x] **P2-S09-AC-723** — AUTH-API-16 allows the signed-in user to read only their own factors. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-724** — AUTH-API-16 denies any operator broad read of another account's factors. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-725** — AUTH-API-16 is limited to 300 per minute per user with no-store, an 8 s deadline and Tier 1 classification and returns 429 at the limit. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-726** — AUTH-API-16 returns 401 UNAUTHENTICATED for a missing or expired session with recoveryAction reauthenticate with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-727** — AUTH-API-16 returns 403 FORBIDDEN for account_not_eligible with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-728** — AUTH-API-16 returns 429 RATE_LIMITED for exceeding 300 per minute per user with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-729** — AUTH-API-16 returns 503 DEPENDENCY_UNAVAILABLE for unavailable persistence with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-730** — AUTH-API-16 returns 504 DEPENDENCY_UNAVAILABLE (deadline exceeded) for an exceeded persistence deadline with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-731** — AUTH-API-16 returns 500 INTERNAL_ERROR for an unexpected failure with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-732** — AUTH-API-17 returns 201 TotpEnrollmentStart with the new MFA version as ETag for an eligible self account. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-733** — AUTH-API-17 TotpEnrollmentStartRequest is a strict object containing only method and friendlyName. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-17 — TOTP enrollment start
- [x] **P2-S09-AC-734** — AUTH-API-17 method is a closed enum of enabled registry methods (totp) and any other value is 422 method_not_available. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-735** — AUTH-API-17 friendlyName is NFC-normalized, trimmed and 1 to 80 characters with no control character or newline, else 422 friendly_name_invalid. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-736** — AUTH-API-17 friendlyName is unique per user case-insensitively among live factors, else 409 factor_name_taken. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-737** — AUTH-API-17 requires pending, verified and reconciling factors together to number fewer than 10, else 409 mfa_factor_limit. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-738** — AUTH-API-17 requires a strong quoted positive decimal If-Match equal to the current MFA version, else 400 INVALID_REQUEST or 409 VERSION_MISMATCH. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-739** — AUTH-API-17 carries no client Idempotency-Key, its duplicate-submit guard is the one pending enrollment per user by partial unique index, and an ambiguous outcome is resolved by starting a new enrollment. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-740** — AUTH-API-17 reports the field error code method_not_available. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-741** — AUTH-API-17 reports the field error code friendly_name_invalid. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-742** — AUTH-API-17 TotpEnrollmentStart is exactly { factorId, method, friendlyName, otpauthUri, manualEntryKey, expiresAt, version } with version equal to the MFA version after the transaction. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-17 — TOTP enrollment start
- [x] **P2-S09-AC-743** — AUTH-API-17 returns otpauthUri and manualEntryKey only in the no-store response body and Worker memory and never in PostgreSQL, idempotency records, logs, traces, Queue payloads, analytics or URLs. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-17 — TOTP enrollment start
- [x] **P2-S09-AC-744** — AUTH-API-17 sets pending_expires_at to created_at plus 10 minutes and the response cannot be replayed. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-17 — TOTP enrollment start
- [x] **P2-S09-AC-745** — AUTH-API-17 allows a self account in state active or eligible claimed. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-746** — AUTH-API-17 requires recent step-up when a verified factor already exists and returns 401 STEP_UP_REQUIRED otherwise. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-17 — TOTP enrollment start
- [x] **P2-S09-AC-747** — AUTH-API-17 requires recent primary authentication (primaryAuthAt within 600 s) when no verified factor exists and returns 401 UNAUTHENTICATED with recoveryAction reauthenticate otherwise. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-17 — TOTP enrollment start
- [x] **P2-S09-AC-748** — AUTH-API-17 marks any existing pending row expired in the same transaction and the Worker removes the superseded unverified provider factor before enrolling the new one. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-17 — TOTP enrollment start
- [x] **P2-S09-AC-749** — AUTH-API-17 returns 409 VERSION_MISMATCH for a stale MFA version. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-750** — AUTH-API-17 commits the pending registry row, mfa_version bump, audit and security evidence in a second transaction after the provider enroll and never calls the provider inside a PostgreSQL transaction. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-17 — TOTP enrollment start
- [x] **P2-S09-AC-751** — AUTH-API-17 is limited to 5 per hour per user with no-store, a 15 s deadline and Tier 2 classification and returns 429 at the limit. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-752** — AUTH-API-17 returns 400 INVALID_REQUEST for a malformed body, path or header with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-753** — AUTH-API-17 returns 401 UNAUTHENTICATED for a missing, expired or revoked session with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-754** — AUTH-API-17 returns 403 FORBIDDEN for an ineligible account, CSRF or origin refusal with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-755** — AUTH-API-17 returns 409 CONFLICT for a state or version conflict with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-756** — AUTH-API-17 returns 413 PAYLOAD_TOO_LARGE for a body above the 256 KiB ceiling with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-757** — AUTH-API-17 returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-758** — AUTH-API-17 returns 422 VALIDATION_FAILED for a field validation failure with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-759** — AUTH-API-17 returns 429 RATE_LIMITED for exceeding the rate bucket with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-760** — AUTH-API-17 returns 502 DEPENDENCY_UNAVAILABLE (invalid dependency response) for an invalid provider response shape with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-761** — AUTH-API-17 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable provider, circuit or database with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-762** — AUTH-API-17 returns 504 DEPENDENCY_UNAVAILABLE (deadline exceeded) for an exceeded provider deadline with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-763** — AUTH-API-17 returns 500 INTERNAL_ERROR for an unexpected failure with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-764** — AUTH-API-17 returns 401 STEP_UP_REQUIRED with { recoveryAction: 'step_up', allowedMethods: string[] } for a missing, stale, future-dated or aal1 proof, never 403 and never a retained partial effect. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Error Response Matrix
- [x] **P2-S09-AC-765** — AUTH-API-18 returns 200 MfaFactorsResource with the new ETag, stepUp.fresh true and rotated aal2 cookies after a correct code. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-766** — AUTH-API-18 MfaFactorVerifyRequest is a strict object containing only code. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-18 — TOTP enrollment verify
- [x] **P2-S09-AC-767** — AUTH-API-18 code is exactly six ASCII digits ^[0-9]{6}$ and any other value is 422 code_invalid. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-768** — AUTH-API-18 path factorId is a UUID owned by the caller, with 400 for a malformed value and 404 for a concealed one. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-769** — AUTH-API-18 requires a strong quoted positive decimal If-Match equal to the current MFA version. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-770** — AUTH-API-18 requires the factor to be pending with pending_expires_at after now, else 409 factor_not_pending or 409 enrollment_expired. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-771** — AUTH-API-18 reports the field error code code_invalid. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-772** — AUTH-API-18 reports 422 code_incorrect for a well-formed wrong or reused code, leaves the factor pending and charges the failure bucket. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-773** — AUTH-API-18 allows only the self user who owns a pending factor. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-774** — AUTH-API-18 returns 409 enrollment_expired for an expired pending factor and persists nothing because the refusing RPC rolls back; the auth_mfa_registry_sweep marks the row expired and queues provider cleanup. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-18 — TOTP enrollment verify
- [x] **P2-S09-AC-775** — AUTH-API-18 carries no client Idempotency-Key because the code is single-use and the guard is the pending-to-verified compare-and-swap. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-776** — AUTH-API-18 after provider success runs the session rotation and then one transaction setting pending to verified, verified_at and last_used_at, an mfa_version bump, audit, security evidence, the identity.mfa-factor.changed.v1 outbox row and an mfa_factor_added security-notification request. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-18 — TOTP enrollment verify
- [x] **P2-S09-AC-777** — AUTH-API-18 marks the row reconciling on a post-send ambiguity, returns 504, 502 or 500 for timeout, invalid 2xx or local finalization failure respectively, sets no cookie and leaves settlement to auth-state-reconciler. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-18 — TOTP enrollment verify
- [x] **P2-S09-AC-778** — AUTH-API-18 shares the 10 failed per 15 minutes per IP and account bucket with AUTH-API-21 and locks verification for 15 minutes at the limit. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-779** — AUTH-API-18 returns 400 INVALID_REQUEST for a malformed body, path or header with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-780** — AUTH-API-18 returns 401 UNAUTHENTICATED for a missing, expired or revoked session with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-781** — AUTH-API-18 returns 403 FORBIDDEN for an ineligible account, CSRF or origin refusal with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-782** — AUTH-API-18 returns 404 NOT_FOUND for a concealed factor or challenge with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-783** — AUTH-API-18 returns 409 CONFLICT for a state or version conflict with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-784** — AUTH-API-18 returns 413 PAYLOAD_TOO_LARGE for a body above the 256 KiB ceiling with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-785** — AUTH-API-18 returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-786** — AUTH-API-18 returns 422 VALIDATION_FAILED for a field validation failure with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-787** — AUTH-API-18 returns 429 RATE_LIMITED for exceeding the rate bucket with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-788** — AUTH-API-18 returns 502 DEPENDENCY_UNAVAILABLE (invalid dependency response) for an invalid provider response shape with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-789** — AUTH-API-18 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable provider, circuit or database with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-790** — AUTH-API-18 returns 504 DEPENDENCY_UNAVAILABLE (deadline exceeded) for an exceeded provider deadline with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-791** — AUTH-API-18 returns 500 INTERNAL_ERROR for an unexpected failure with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-792** — AUTH-API-19 returns 200 MfaFactorsResource with the new ETag after a confirmed factor removal. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-793** — AUTH-API-19 MfaFactorRemoveRequest is a strict object containing only reason. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-19 — TOTP factor removal
- [x] **P2-S09-AC-794** — AUTH-API-19 reason is exactly user_request or factor_compromise, else 422 reason_invalid. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-795** — AUTH-API-19 path factorId is a UUID owned by the caller, with 400 for a malformed value and 404 for a concealed one. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-796** — AUTH-API-19 requires a strong quoted positive decimal If-Match equal to the current MFA version. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-797** — AUTH-API-19 requires an Idempotency-Key and is replay-safe. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-798** — AUTH-API-19 requires the factor to be pending or verified, else 409 factor_state_conflict. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-799** — AUTH-API-19 reports the field error code reason_invalid. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-800** — AUTH-API-19 allows only the self user who owns the factor. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-801** — AUTH-API-19 requires recent step-up to remove a verified factor and no step-up to cancel a pending factor. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-802** — AUTH-API-19 refuses removing the last verified factor with 409 last_factor_required and recoveryAction enroll_factor while the account holds a step-up-gated capability. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-803** — AUTH-API-19 reads the capability registry's step-up designation against the person's effective grants and assignments and fails closed with 409 if that read is unavailable. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Step-Up Proof and MFA Method Registry
- [x] **P2-S09-AC-804** — AUTH-API-19 permits removing the last verified factor when the account holds no step-up-gated capability and the current proof still lapses at its own freshUntil. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-19 — TOTP factor removal
- [x] **P2-S09-AC-805** — AUTH-API-19 with reason factor_compromise revokes every other active session-index row by exact session_id and retains the current session. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-19 — TOTP factor removal
- [x] **P2-S09-AC-806** — AUTH-API-19 never affects login methods or recoveryBaselinePresent. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-19 — TOTP factor removal
- [x] **P2-S09-AC-807** — AUTH-API-19 sets the factor reconciling, bumps mfa_version and commits audit, security evidence, idempotency and outbox before the provider unenroll, then sets removed and queues an mfa_factor_removed notification on confirmed removal. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-19 — TOTP factor removal
- [x] **P2-S09-AC-808** — AUTH-API-19 leaves a provider timeout or ambiguity reconciling, blocks duplicate removal, schedules auth-state-reconciler and never blindly resends. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-19 — TOTP factor removal
- [x] **P2-S09-AC-809** — AUTH-API-19 is limited to 5 per hour per user with a 15 s deadline and returns 429 at the limit. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-810** — AUTH-API-19 returns 400 INVALID_REQUEST for a malformed body, path or header with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-811** — AUTH-API-19 returns 401 UNAUTHENTICATED for a missing, expired or revoked session with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-812** — AUTH-API-19 returns 403 FORBIDDEN for an ineligible account, CSRF or origin refusal with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-813** — AUTH-API-19 returns 404 NOT_FOUND for a concealed factor or challenge with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-814** — AUTH-API-19 returns 409 CONFLICT for a state or version conflict with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-815** — AUTH-API-19 returns 413 PAYLOAD_TOO_LARGE for a body above the 256 KiB ceiling with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-816** — AUTH-API-19 returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-817** — AUTH-API-19 returns 422 VALIDATION_FAILED for a field validation failure with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-818** — AUTH-API-19 returns 429 RATE_LIMITED for exceeding the rate bucket with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-819** — AUTH-API-19 returns 502 DEPENDENCY_UNAVAILABLE (invalid dependency response) for an invalid provider response shape with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-820** — AUTH-API-19 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable provider, circuit or database with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-821** — AUTH-API-19 returns 504 DEPENDENCY_UNAVAILABLE (deadline exceeded) for an exceeded provider deadline with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-822** — AUTH-API-19 returns 500 INTERNAL_ERROR for an unexpected failure with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-823** — AUTH-API-19 returns 401 STEP_UP_REQUIRED with { recoveryAction: 'step_up', allowedMethods: string[] } for a missing, stale, future-dated or aal1 proof, never 403 and never a retained partial effect. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Error Response Matrix
- [x] **P2-S09-AC-824** — AUTH-API-20 returns 201 StepUpChallenge for a verified session and an eligible account with no step-up precondition. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-825** — AUTH-API-20 StepUpChallengeRequest is a strict object containing only method and optional factorId. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-20 — step-up challenge
- [x] **P2-S09-AC-826** — AUTH-API-20 method is an enabled registry method, else 422 method_not_available. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-827** — AUTH-API-20 factorId is an optional UUID, else 422 factor_id_invalid. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-828** — AUTH-API-20 requires factorId when more than one verified factor exists (422 factor_id_required) and uses the single verified factor when it is absent. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-829** — AUTH-API-20 returns 409 no_verified_factor with recoveryAction enroll_factor when no verified factor exists. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-830** — AUTH-API-20 requires a supplied factor to be owned by the caller (else 404) and verified (else 409 factor_not_verified or factor_state_conflict for reconciling). [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-831** — AUTH-API-20 reports the field error code factor_id_invalid. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-832** — AUTH-API-20 reports the field error code factor_id_required. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-833** — AUTH-API-20 StepUpChallenge is exactly { challengeId, method, factorId, friendlyName, expiresAt } and never returns the provider challenge id. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-20 — step-up challenge
- [x] **P2-S09-AC-834** — AUTH-API-20 sets expires_at to the earlier of the provider expiry and created_at plus 10 minutes and creating a challenge grants nothing. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-20 — step-up challenge
- [x] **P2-S09-AC-835** — AUTH-API-20 allows only the self user with a verified session and eligible account. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-836** — AUTH-API-20 binds the challenge to the Auth UUID, the exact session_id and the factor. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-20 — step-up challenge
- [x] **P2-S09-AC-837** — AUTH-API-20 carries no client Idempotency-Key and supersedes the pending challenge for the same session and factor by compare-and-swap, expiring the old one. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-838** — AUTH-API-20 supersedes in one transaction, creates the provider challenge, then inserts the pending challenge row in a second transaction. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-20 — step-up challenge
- [x] **P2-S09-AC-839** — AUTH-API-20 is limited to 10 per 15 minutes per IP and account with an 8 s deadline and returns 429 at the limit. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-840** — AUTH-API-20 returns 400 INVALID_REQUEST for a malformed body, path or header with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-841** — AUTH-API-20 returns 401 UNAUTHENTICATED for a missing, expired or revoked session with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-842** — AUTH-API-20 returns 403 FORBIDDEN for an ineligible account, CSRF or origin refusal with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-843** — AUTH-API-20 returns 404 NOT_FOUND for a concealed factor or challenge with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-844** — AUTH-API-20 returns 409 CONFLICT for a state or version conflict with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-845** — AUTH-API-20 returns 413 PAYLOAD_TOO_LARGE for a body above the 256 KiB ceiling with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-846** — AUTH-API-20 returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-847** — AUTH-API-20 returns 422 VALIDATION_FAILED for a field validation failure with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-848** — AUTH-API-20 returns 429 RATE_LIMITED for exceeding the rate bucket with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-849** — AUTH-API-20 returns 502 DEPENDENCY_UNAVAILABLE (invalid dependency response) for an invalid provider response shape with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-850** — AUTH-API-20 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable provider, circuit or database with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-851** — AUTH-API-20 returns 504 DEPENDENCY_UNAVAILABLE (deadline exceeded) for an exceeded provider deadline with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-852** — AUTH-API-20 returns 500 INTERNAL_ERROR for an unexpected failure with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-853** — AUTH-API-21 returns 200 StepUpResult with rotated aal2 cookies after a correct code. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-854** — AUTH-API-21 StepUpVerifyRequest is a strict object containing only code. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-21 — step-up verify and session rotation
- [x] **P2-S09-AC-855** — AUTH-API-21 code is exactly six ASCII digits ^[0-9]{6}$ and any other value is 422 code_invalid. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-856** — AUTH-API-21 path challengeId is a UUID bound to the caller's Auth UUID and exact session_id, with 400 for a malformed value and 404 for another user's or another session's challenge. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-857** — AUTH-API-21 requires the challenge to be pending and unexpired, else 409 challenge_expired with recoveryAction new_challenge or 409 challenge_consumed. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field Validation Matrix
- [x] **P2-S09-AC-858** — AUTH-API-21 StepUpResult is exactly { verified: true, method, stepUpAt, freshUntil } and contains no token. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-21 — step-up verify and session rotation
- [x] **P2-S09-AC-859** — AUTH-API-21 allows only the self user whose challenge is bound to the same Auth UUID and exact session_id. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-860** — AUTH-API-21 leaves the challenge pending, increments failed_attempt_count and charges the failure bucket for a well-formed wrong code. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-21 — step-up verify and session rotation
- [x] **P2-S09-AC-861** — AUTH-API-21 carries no client Idempotency-Key because the code is single-use and the guard is the pending-to-consumed compare-and-swap. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-862** — AUTH-API-21 after provider success runs the session rotation and then one transaction setting pending to consumed, the factor's last_used_at, audit and security evidence. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-21 — step-up verify and session rotation
- [x] **P2-S09-AC-863** — AUTH-API-21 marks the challenge failed on a provider invalid 2xx shape, failed token validation (502) or post-send timeout (504), changes no cookie and requires a new challenge. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-21 — step-up verify and session rotation
- [x] **P2-S09-AC-864** — AUTH-API-21 returns 429 with the provider's retry delay, defaulting to 900 seconds, for a provider rate refusal. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §AUTH-API-21 — step-up verify and session rotation
- [x] **P2-S09-AC-865** — AUTH-API-21 shares the 10 failed per 15 minutes per IP and account bucket with AUTH-API-18 and locks verification for 15 minutes at the limit. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-866** — AUTH-API-21 returns 400 INVALID_REQUEST for a malformed body, path or header with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-867** — AUTH-API-21 returns 401 UNAUTHENTICATED for a missing, expired or revoked session with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-868** — AUTH-API-21 returns 403 FORBIDDEN for an ineligible account, CSRF or origin refusal with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-869** — AUTH-API-21 returns 404 NOT_FOUND for a concealed factor or challenge with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-870** — AUTH-API-21 returns 409 CONFLICT for a state or version conflict with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-871** — AUTH-API-21 returns 413 PAYLOAD_TOO_LARGE for a body above the 256 KiB ceiling with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-872** — AUTH-API-21 returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-873** — AUTH-API-21 returns 422 VALIDATION_FAILED for a field validation failure with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-874** — AUTH-API-21 returns 429 RATE_LIMITED for exceeding the rate bucket with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-875** — AUTH-API-21 returns 502 DEPENDENCY_UNAVAILABLE (invalid dependency response) for an invalid provider response shape with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-876** — AUTH-API-21 returns 503 DEPENDENCY_UNAVAILABLE for an unavailable provider, circuit or database with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-877** — AUTH-API-21 returns 504 DEPENDENCY_UNAVAILABLE (deadline exceeded) for an exceeded provider deadline with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-878** — AUTH-API-21 returns 500 INTERNAL_ERROR for an unexpected failure with the BE00 ApiError envelope and the strict details row for that status. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Route Registry
- [x] **P2-S09-AC-879** — Session rotation verifies the returned token signature, issuer, authenticated audience and expiry and requires sub equal to the initiating Auth UUID, aal2 and a valid MFA amr timestamp inside the freshness window, otherwise returning 502 with no change. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Session rotation to aal2 (AUTH-API-18 and AUTH-API-21)
- [x] **P2-S09-AC-880** — Session rotation touches the index row when the returned session_id equals the initiating one and otherwise registers the new active row and revokes the initiating row by exact session_id in one transaction. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Session rotation to aal2 (AUTH-API-18 and AUTH-API-21)
- [x] **P2-S09-AC-881** — Session rotation replaces the access, refresh, sealed session-reference and session-bound CSRF cookies together, all Secure, with token cookies HttpOnly and SameSite=Lax. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Session rotation to aal2 (AUTH-API-18 and AUTH-API-21)
- [x] **P2-S09-AC-882** — Session rotation changes the CSRF token because it is bound to the session reference and the first-party response carries only stepUpAt and freshUntil, never tokens, provider session ids, factor ids or amr. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Session rotation to aal2 (AUTH-API-18 and AUTH-API-21)
- [x] **P2-S09-AC-883** — stepUpAt is the latest valid MFA amr timestamp (methods mfa, totp, webauthn, phone) as a positive safe-integer Unix second not more than 30 seconds ahead of the Worker clock, otherwise ignored. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Step-Up Proof and MFA Method Registry
- [x] **P2-S09-AC-884** — The step-up proof lives only in the token, so a refresh preserves the original MFA timestamp and never extends freshness and JWT iat and refresh time are never used. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Step-Up Proof and MFA Method Registry
- [x] **P2-S09-AC-885** — A proof is fresh when -30 s <= now - stepUpAt <= 600 s with freshUntil = stepUpAt + 600 s, tested at the -30 s, 0 s, 600 s and 601 s boundaries. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Step-Up Proof and MFA Method Registry
- [x] **P2-S09-AC-886** — STEP_UP_FRESHNESS_SECONDS is the contract constant 600, not caller-selectable and not a CMS or settings value, and a consuming spec may only tighten it numerically. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Step-Up Proof and MFA Method Registry
- [x] **P2-S09-AC-887** — The MFA method registry is a protected code-owned ordered list whose launch contents are exactly [totp] and adding a method is an evolve-feature change. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Step-Up Proof and MFA Method Registry
- [x] **P2-S09-AC-888** — Step-up always verifies the signed-in human's own Auth UUID and acting party, alias, organization, mandate or representation context never selects or relaxes the factor. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Step-Up Proof and MFA Method Registry
- [x] **P2-S09-AC-889** — mfa_version is the ETag and If-Match target for AUTH-API-16 through AUTH-API-19 and every factor-row state change bumps it while updating last_used_at on a step-up does not. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Step-Up Proof and MFA Method Registry
- [x] **P2-S09-AC-890** — No account recovery codes exist: a user who lost every verified factor recovers through the passwordless recovery intent followed by an administrative factor reset, and no self-service bypass, support bypass or operator reset without the capability exists. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Step-Up Proof and MFA Method Registry
- [x] **P2-S09-AC-891** — primaryAuthAt is the latest valid amr timestamp of a method outside the MFA method set, with the same safe-integer, 30-second tolerance and ignore rules, fresh in the 600 s window and preserved by refresh. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Step-Up Proof and MFA Method Registry
- [x] **P2-S09-AC-892** — identity.rpc_admin_reset_mfa_factors(reset_id, target_person_id, operator_person_id) is executable only by the Worker. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Administrative factor reset
- [x] **P2-S09-AC-893** — The reset transaction locks the target's Auth binding, moves every pending, verified and reconciling factor row to reconciling, expires the target's pending step-up challenges, bumps mfa_version and records security evidence. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Administrative factor reset
- [x] **P2-S09-AC-894** — The Worker then unenrolls each provider factor through the operator-only adapter, sets confirmed removals removed with removed_at and leaves any ambiguity reconciling for auth-state-reconciler with no blind resend. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Administrative factor reset
- [x] **P2-S09-AC-895** — The target receives a security-notification request with safeTemplateCode mfa_factors_reset. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Administrative factor reset
- [x] **P2-S09-AC-896** — The reset changes no session, login method or recoveryBaselinePresent and the target's existing proofs lapse at their own freshUntil. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Administrative factor reset
- [x] **P2-S09-AC-897** — The reset is not subject to last_factor_required and cannot target the operator's own account. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Administrative factor reset
- [x] **P2-S09-AC-898** — identity.mfa_factor_registry persists the application factor id, method totp, a protected unique provider_factor_id never returned, friendly_name 1..80, state pending, verified, reconciling, removed or expired, nullable pending_expires_at only while pending or reconciling, and verified_at, last_used_at, removed_at. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field-level SQL type and relationship ledger
- [x] **P2-S09-AC-899** — identity.mfa_factor_registry allows one pending row per user, a unique lowercase friendly name per user among live factors, and no secret, URI or code. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field-level SQL type and relationship ledger
- [x] **P2-S09-AC-900** — identity.step_up_challenges binds auth_user_id, exact session_id and factor_id at creation with a protected provider_challenge_id, state pending, consumed, failed or expired, expires_at no later than created_at plus 10 minutes and failed_attempt_count >= 0. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field-level SQL type and relationship ledger
- [x] **P2-S09-AC-901** — identity.step_up_challenges allows one pending row per (session_id, factor_id) and stores no code and no token. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field-level SQL type and relationship ledger
- [x] **P2-S09-AC-902** — identity.auth_user_bindings carries a positive mfa_version defaulting to 1 that every factor mutation bumps. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Field-level SQL type and relationship ledger
- [x] **P2-S09-AC-903** — The MFA registry and step-up challenge tables deny anonymous access, expose safe projections only through invoker views, accept mutations only through named RPCs and give support and identity operators no grant. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Index, RLS, and retention inventory
- [x] **P2-S09-AC-904** — The MFA factor state machine permits only pending to verified or expired, pending or verified to reconciling, reconciling to verified, pending or removed through the provider reconciliation, and verified to removed only through reconciling, with removed and expired terminal. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Data Flow, Transactions, and State
- [x] **P2-S09-AC-905** — The step-up challenge state machine permits pending to consumed, failed or expired, leaves a wrong code pending, and never reopens consumed, failed or expired challenges. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Data Flow, Transactions, and State
- [x] **P2-S09-AC-906** — identity.mfa-factor.changed.v1 carries exactly { mfaFactorId, authBindingId } with no secret, URI or provider id and projections refetch AUTH-API-16. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Events and Cross-Shard Handoff
- [x] **P2-S09-AC-907** — Immutable identity.security_events rows mfa.enroll.started, mfa.enroll.verified, mfa.factor.removed, step_up.challenge.created, step_up.verified and step_up.failed are written with factor class and safe reason and never a code, secret, URI or token. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Observability and Abuse Controls
- [x] **P2-S09-AC-908** — Step-up observability reports verification failures by reason, lockouts, provider latency and circuit state, reconciling age and STEP_UP_REQUIRED counts by operation with 100% traces for enrollment, removal and verification failures. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Observability and Abuse Controls
- [x] **P2-S09-AC-909** — STEP_UP_REQUIRED is always HTTP 401 with recoveryAction step_up and allowedMethods equal to the configured method ids and never 403, checked at middleware step 7 before idempotency reservation so no idempotency, audit or domain state is created. [BE00](../../../wiki/specs/be/00-infrastructure.md) §STEP_UP_REQUIRED Recovery Routing
- [ ] **P2-S09-AC-910** — The browser navigates to /step-up?returnTo=<current relative path plus query> satisfying the relative first-party rule (1 to 512 characters, no scheme, authority, backslash, control character or ambiguous encoding), never /step-up or /auth/, falling back to the path without query and then /app. [BE00](../../../wiki/specs/be/00-infrastructure.md) §STEP_UP_REQUIRED Recovery Routing
- [ ] **P2-S09-AC-911** — After step-up completes the interrupted command is never replayed automatically and the originating form restores its scoped draft, and because the 401 reserved nothing the draft may reuse its original Idempotency-Key. [BE00](../../../wiki/specs/be/00-infrastructure.md) §STEP_UP_REQUIRED Recovery Routing
- [x] **P2-S09-AC-912** — The Supabase Auth MFA adapter is Worker-only, uses the caller's access token and code in memory only and calls the provider with a 5,000 ms timeout per call. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §External seam contracts and circuit state
- [x] **P2-S09-AC-913** — MFA enroll and challenge calls make two pre-effect attempts at 250 ms and 750 ms while verify and unenroll never retry after send and any post-send ambiguity is reconciling or failed and polled by provider factor status, never resent. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §External seam contracts and circuit state
- [x] **P2-S09-AC-914** — Five MFA adapter failures in 60 seconds open the circuit for 60 seconds, return 503 DEPENDENCY_UNAVAILABLE, issue no cookie, create no verified or consumed state and require a new enrollment or challenge after recovery. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §External seam contracts and circuit state
- [x] **P2-S09-AC-915** — The Supabase Auth admin MFA adapter is operator-only with a separate credential binding callable only from the reset RPC path, never from a user-facing route and never with a caller's token, and shares the MFA breaker. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §External seam contracts and circuit state
- [x] **P2-S09-AC-916** — The security notification provider sends mfa_factor_added and mfa_factor_removed requests with three queue attempts at 15, 60 and 300 seconds under one notification id and never restores access on failure. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §External seam contracts and circuit state
- [x] **P2-S09-AC-917** — BE01c names cms_grant_capability, cms_renew_capability_grant and cms_revoke_capability_grant as the only authorized writers of identity_private.organization_actor_grant for CMS capability codes, atomic with their aggregate, event, audit and outbox, with the backfill reading and writing only CMS aggregates. [BE01c](../../../wiki/specs/be/01c-relationships-authority-governance.md) §Schema and ownership boundary
- [x] **P2-S09-AC-918** — CFG-05B-06 returns 200 Cfg05b06MfaFactorResetResponse in state completed when every provider removal is confirmed. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Route Registry
- [x] **P2-S09-AC-919** — CFG-05B-06 returns 202 Cfg05b06MfaFactorResetResponse in state reconciling when a provider removal is ambiguous, never reporting completed before it is. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Route Registry
- [x] **P2-S09-AC-920** — CFG-05B-06 Cfg05b06MfaFactorResetRequest is a strict object containing only targetPersonId and reason, so operator, organization, capability and step-up time are never accepted. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-921** — CFG-05B-06 targetPersonId is a UUID and a malformed value is rejected. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-922** — CFG-05B-06 reason is required and 1 to 512 characters, rejecting an empty reason and a 513-character reason. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Admin MFA factor reset (DEC-111 follow-up, 2026-10-02)
- [x] **P2-S09-AC-923** — CFG-05B-06 requires an Idempotency-Key and carries no If-Match. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Route Registry
- [x] **P2-S09-AC-924** — CFG-05B-06 Cfg05b06MfaFactorResetResponse is exactly { resetId, targetPersonId, state, removedFactorCount, mfaVersion, outboxEventId } with state completed or reconciling and removedFactorCount 0..10. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-925** — CFG-05B-06 carries no factor identifier in any response, event or log. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Contract and route tests
- [x] **P2-S09-AC-926** — CFG-05B-06 allows a verified admin operator holding admin.identity.mfa_reset with action reset on the target's organization, granted through CFG-11, with recent step-up. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-927** — CFG-05B-06 requires the target to be a confirmed unended member of the operator's organization and returns an indistinguishable 404 for an absent, ineligible, banned or cross-organization target. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-928** — CFG-05B-06 refuses a self-target with 422 MFA_RESET_INVALID because a reset by the account holder would defeat step-up. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Per-operation authorization matrix
- [x] **P2-S09-AC-929** — CFG-05B-06 permits one live reconciling reset per target by a partial unique index and returns 409 MFA_RESET_IN_PROGRESS for a second. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Canonical records and fields
- [x] **P2-S09-AC-930** — CFG-05B-06 enforces UNIQUE(operator_person_id, idempotency_key) so a replay returns the first response and a changed body under the same key is 409 IDEMPOTENCY_CONFLICT. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Canonical records and fields
- [x] **P2-S09-AC-931** — CFG-05B-06 locks the target binding and grant, inserts the reset row reconciling, calls the identity RPC and writes audit, security evidence, notification intent and outbox in one transaction before any provider removal. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Transaction and external seams
- [x] **P2-S09-AC-932** — CFG-05B-06 calls the operator-only provider adapter with a 5,000 ms per-call timeout, no retry after send, a circuit of 5 failures per 60 s and a 15,000 ms route deadline. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Transaction and external seams
- [x] **P2-S09-AC-933** — CFG-05B-06 confirms the reset completed in a second transaction and never rolls back the committed first transaction on provider failure, leaving ambiguity reconciling for auth-state-reconciler. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Transaction and external seams
- [x] **P2-S09-AC-934** — CFG-05B-06 is limited to 5 per hour per user and 10 per hour per party and returns 429 at the limit. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Route Registry
- [x] **P2-S09-AC-935** — CFG-05B-06 returns 400 INVALID_REQUEST for a malformed body, header or unknown key with the BE00 ApiError envelope. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Operation contract and error matrix
- [x] **P2-S09-AC-936** — CFG-05B-06 returns 401 UNAUTHENTICATED for a missing or expired session with the BE00 ApiError envelope. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Operation contract and error matrix
- [x] **P2-S09-AC-937** — CFG-05B-06 returns 401 STEP_UP_REQUIRED with { recoveryAction: 'step_up', allowedMethods: string[] } for stale or absent step-up, checked before idempotency reservation. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Operation contract and error matrix
- [x] **P2-S09-AC-938** — CFG-05B-06 returns 403 FORBIDDEN for a visible organization without the capability with the BE00 ApiError envelope. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Operation contract and error matrix
- [x] **P2-S09-AC-939** — CFG-05B-06 returns 404 TARGET_NOT_FOUND for a hidden or non-member target with the BE00 ApiError envelope. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Operation contract and error matrix
- [x] **P2-S09-AC-940** — CFG-05B-06 returns 409 IDEMPOTENCY_CONFLICT for a reused key with a changed body with the BE00 ApiError envelope. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Operation contract and error matrix
- [x] **P2-S09-AC-941** — CFG-05B-06 returns 409 MFA_RESET_IN_PROGRESS for a reset already reconciling for the target with the BE00 ApiError envelope. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Operation contract and error matrix
- [x] **P2-S09-AC-942** — CFG-05B-06 returns 422 MFA_RESET_INVALID for a self-target or schema violation with the BE00 ApiError envelope. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Operation contract and error matrix
- [x] **P2-S09-AC-943** — CFG-05B-06 returns 429 RATE_LIMITED for exceeding the reset rate limit with the BE00 ApiError envelope. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Operation contract and error matrix
- [x] **P2-S09-AC-944** — CFG-05B-06 returns 503 IDENTITY_UNAVAILABLE for an unavailable identity RPC, provider adapter or open circuit with the BE00 ApiError envelope. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Operation contract and error matrix
- [x] **P2-S09-AC-945** — platform_private.admin_mfa_factor_resets persists target_person_id, organization_id, operator_person_id with CHECK operator <> target, grant_id, a reason of 1..512, an idempotency_key of 16..128, state reconciling or completed, removed_factor_count 0..10 and completed_at null exactly while reconciling. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Canonical records and fields
- [x] **P2-S09-AC-946** — platform_private.admin_mfa_factor_resets has forced RLS, no direct DML for authenticated and inserts or transitions only through the admin_reset_mfa_factors RPC under the current grant and membership predicate. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Canonical records and fields
- [x] **P2-S09-AC-947** — admin.mfa-factor.reset.v1 carries exactly { resetId, targetPersonId } and consumers refetch current factor state and never treat the event as proof. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Event Schemas
- [x] **P2-S09-AC-948** — admin.mfa_factor.reset telemetry carries the reset ID, target hash, state, removed-factor count and outcome with denied, stale-step-up, reconciling and circuit-open metrics and never a factor identifier, secret, token or reason text. [BE05b](../../../wiki/specs/be/05b-admin-workspace-operations.md) §Observability
- [x] **P2-S09-AC-949** — Review detail idle: no reviewRef on the activation preparation renders no review panel. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-950** — Review detail loading: an in-flight review read renders a skeleton with a polite live region. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-951** — Review detail success: a 200 SchemaReviewResource renders open, approved, rejected or invalidated per the review state table. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-952** — Review detail empty: a concealed or absent review (404) renders only that the review is not available. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-953** — Review detail error: a typed ApiError renders with its request ID and is retryable only for 429 and 502, 503 and 504. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-954** — Review detail degraded: the last verified review is kept with lastVerifiedAt and the decision and activation controls are disabled. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-955** — Review detail disabled: the decision form names its missing prerequisite (no assignment, expired assignment or a state other than open). [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-956** — An open review shows the required and recorded decision counts and the decision form to an assigned reviewer. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-957** — An approved review shows approvalEvidenceHash and decidedAt, which render only when state is approved. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-958** — A rejected review states that the candidate returned to an editable draft. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-959** — An invalidated review states that a new frozen submission is required. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-960** — A job state of succeeded alone never renders a passed result: result comes only from the sealed report and a failed or cancelled job without a sealed report renders the unsealed failure copy and keeps submit-review disabled. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-961** — Dry-run status idle: a null dryRunRef shows the start-dry-run form only when permittedNextActions includes start_dry_run. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-962** — Dry-run status loading: a queued or running dry-run polls the BE00 job and announces queued then running without moving focus. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-963** — Dry-run status success: a completed dry-run reads counts and hashes only from the immutable report with result passed or failed. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-964** — Dry-run status empty: a candidate that has never had a dry run renders no-records. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-965** — Dry-run status error: a failed dry-run renders a safe failureCode with no counts or hashes and a failed job poll is a retryable error. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-966** — Dry-run status degraded: the last verified dryRunRef is kept with lastVerifiedAt and submit-review stays disabled. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-967** — Dry-run status disabled: the start-dry-run form names the missing prerequisite when permittedNextActions lacks start_dry_run. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-968** — activationPreparation mapping: dryRunRef renders the dry-run status panel, its id prefills dryRunId of CMS-03A-11 and CMS-03A-04, jobId is the BE00 job to poll and a non-null failureCode (only when state is failed) selects the safe failure copy. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-969** — activationPreparation mapping: jobRef renders a polite job status line (queued, running, succeeded, failed, cancelled) and never a result. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-970** — activationPreparation mapping: reviewRef is the link target for the CMS-03A-13 read and its id is the reviewId the browser holds. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-971** — activationPreparation mapping: templateCompatibility renders a read-only compatibility summary for the exact candidate and says nothing about compatibility when absent. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-972** — activationPreparation mapping: permittedNextActions is the only readiness expression and each control renders only when its action is present. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-973** — activationPreparation mapping: approvalIds in the activation form is a prefilled read-only list of the approve-decision IDs of the one approved review and the user never types or edits it. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-974** — Island props carry only display contextEvidence (actingContextLabel, stepUpState, stepUpFreshUntil) and no actor, person, party or private binding identifier, whether raw, hashed or truncated, and no matching or correlation token. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §ContentSchemaRegistryWorkbench (bounded React island)
- [x] **P2-S09-AC-975** — The reviewer person ID is one native text input validated as a UUID on blur and on submit with the SchemaReviewAssignmentRequest Zod schema. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-976** — An invalid reviewer ID shows the inline error "Enter the reviewer's person ID as a UUID." and the helper copy states the ID must be entered exactly as the reviewer gave it and grants read and decide access to this one review for at most seven days. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-977** — A 409 for an unknown, ineligible, submitter or broad-scope target renders one non-disclosing refusal that never says whether the person exists. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-978** — The reviewer ID is never echoed back, stored in a URL, telemetry event or log, or shown after submit. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-108 review, dry-run and activation-preparation states
- [x] **P2-S09-AC-979** — The create successor form maps 400, 401, 403, 404, 409, 415, 422, 429, 502/503/504 and 500 to its error copy, sends only expectedVersion with the exact source If-Match and an Idempotency-Key, and never lets the caller supply the new version number, row IDs or stable identities. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Interaction Specification
- [x] **P2-S09-AC-980** — The start dry-run form sends expectedVersion with transformKey and transformVersion both absent or both present, renders the 202 result as pending or queued with its job reference and never as a transformation result, and maps 409 and 422 transform-pair errors to inline copy. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Interaction Specification
- [x] **P2-S09-AC-981** — The submit review form sends expectedVersion and the passed dryRunId, renders the 201 SchemaReviewResource in state open with frozen policy and evidence and the required decision count, and is disabled until a passed persisted dry run exists. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Interaction Specification
- [x] **P2-S09-AC-982** — The record decision form renders native approve and reject radios, requires recent binding-bound MFA with the step-up disclosure re-evaluated on expiry, announces the exact decision and updated recorded and required counts, and renders no reviewer identifier. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Interaction Specification
- [x] **P2-S09-AC-983** — The assign or revoke reviewer form sends the discriminated create or revoke request with expectedVersion and step-up, renders 201 for create and 200 for revoke with safe fields only and announces the assignment state and expiry. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Interaction Specification
- [x] **P2-S09-AC-984** — The review detail renders the validated SchemaReviewResource with safe candidate identity, frozen evidence summary, required and recorded counts, decision references and eligible permittedNextActions and issues no body, mutation header or optimistic state. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Interaction Specification
- [x] **P2-S09-AC-985** — The schema designer (cms.schema_designer) owns the successor, dry-run and submit-review forms on the version and draft workbench. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-986** — An assigned cms.schema_review human renders the schemaReviewAssigned review-only variant, which opens only the exact review detail and its safe frozen evidence summary and the native decision form when permittedNextActions allows record_decision. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-987** — The schemaReviewAssigned variant implies no registry-wide read, ownerFull, entitledRead, successor, dry-run, submit-review, activation, entry or publication control. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-988** — The existing owner alone sees the assignment form (cms.schema_review.assign) and none of these grants administrator, capability-administration or delegation authority. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-989** — A role label never renders a protected review or assignment control client-side and each rendered action is checked against the server's per-review next actions. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-990** — The receipt-derived owner receives ownerFull and the commit controls are enabled only while the step-up disclosure is verified, otherwise disabled with the step-up recovery. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-991** — Every non-owner actor receives forbiddenHidden with no navigation entry and a 403 gate on a direct URL. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-992** — A dependency or prerequisite failure renders disabledPrerequisite and a holder of a granted capability never sees grant controls. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-993** — Grant console idle: server HTML renders the first page and the commit action is enabled only for a locally valid form. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-994** — Grant console loading: a skeleton after 250 ms and a stable pending label (Granting, Renewing, Revoking) with duplicate activation ignored. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-995** — Grant console success: a 200 list page renders rows with derived state and a 201 or 200 resource focuses the result heading, refetches the list and announces only the capability label and valid-through date. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-996** — Grant console empty: no-records versus filter-miss with one action (Grant a capability or Reset filters). [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-997** — Grant console error: a typed ApiError with request ID retryable only for 429 and 502, 503 and 504 and input retained for commands. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-998** — Grant console degraded: the last verified page is kept with lastVerifiedAt, every command is disabled with the reason and an unknown mutation outcome renders pending and reconciles through a list refetch. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-999** — Grant console disabled: disabledPrerequisite names the missing prerequisite (no step-up yet or dependency unavailable) with no handler. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-1000** — Grant console 401 STEP_UP_REQUIRED shows 'Verify your identity to change CMS access.' with the expiring step-up disclosure and a Verify identity action to /step-up?returnTo=, keeping values in island memory only and returning an empty form with 'Your entries were not saved.' [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-1001** — Grant console 401 UNAUTHENTICATED performs the safe sign-in redirect and removes protected data. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-1002** — Grant console 403 FORBIDDEN renders the gate 'Only the organization owner can manage CMS access.' with no further disclosure. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-1003** — Grant console 404 NOT_FOUND renders one non-disclosing refusal, 'That person could not be found as a member of your organization.' for grant and 'This grant is no longer available.' with a list refetch for renew and revoke. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-1004** — Grant console 409 CONFLICT renders 'This person already holds this capability. Renew the existing grant instead.' for grant and 'This grant changed. Review the current term and try again.' for renew and revoke with the refetched row, offering Grant again for a revoked grant. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-1005** — Grant console 422 VALIDATION_FAILED renders a linked summary and field errors per the form table with input preserved. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-1006** — Grant console 429 RATE_LIMITED renders an inline countdown from Retry-After with input kept. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-1007** — Grant console 502, 503 and 504 render a scoped degraded state with request ID and Retry after a list refetch, never a guessed success. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-1008** — The grant Person ID is a native text input, required, UUID-validated on blur and submit with autocomplete off, spellcheck off and monospace and the error "Enter the person's ID as a UUID." [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-1009** — The grant Capability is a required native select over the closed generated set in four groups with the error 'Choose a capability from the list.' [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-1010** — Valid through is a required native date input holding a real date between termWindow.minDate and termWindow.maxDate with the error 'Choose an end date from {minDate} through {maxDate} (UTC).' (today through today plus 89 UTC days under DEC-120). [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-1011** — Reason is an optional native textarea of 1 to 256 characters with live remaining-count text and the error 'Keep the reason to 256 characters.' [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-1012** — Revoke shows an inline ConfirmationStep naming the immediate consequence before commit. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §DEC-119 CMS capability grant console states
- [x] **P2-S09-AC-1013** — Each capability option shows its plain label and its monospace key and the key is never the only text, in the groups Design, Authoring, Delivery and media, and Review. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §CmsCapabilityGrantConsole (bounded React island)
- [x] **P2-S09-AC-1014** — Person identifiers appear only inside the owner-only island and never enter the URL, localStorage, IndexedDB, BroadcastChannel, analytics, telemetry, logs, Realtime bodies or announcement text. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §CmsCapabilityGrantConsole (bounded React island)
- [x] **P2-S09-AC-1015** — A grant is shown as 'Valid through YYYY-MM-DD (UTC)' with the derived endsAt instant as secondary text and the date helper copy states the UTC end of day and the maximum term (90 days under DEC-120). [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §CmsCapabilityGrantConsole (bounded React island)
- [x] **P2-S09-AC-1016** — The review route guard verifies session, expiry, acting context and either submitter or cms.schema_designer scope or an assigned cms.schema_review review-only scope. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Page and Route Definitions
- [x] **P2-S09-AC-1017** — The review route returns 400 for a malformed UUID, disclosure-safe 404 for a concealed or inaccessible review and 403 for a visible review without the required scope. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Page and Route Definitions
- [x] **P2-S09-AC-1018** — The review route sends an expired session to the same safe sign-in redirect. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Page and Route Definitions
- [ ] **P2-S09-AC-1019** — The review deep link carries only the immutable reviewId and Back restores list selection without serializing any reviewer or private identifier. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Page and Route Definitions
- [x] **P2-S09-AC-1020** — The assigned reviewer reaches the native decision form on the review route while the schema designer reaches the submit and activation forms from the version detail. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Page and Route Definitions
- [x] **P2-S09-AC-1021** — Review and dry-run state use BroadcastChannel for invalidation only, each tab refetches and focus never moves on a Realtime refetch. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §State Management
- [x] **P2-S09-AC-1022** — The grant console guard verifies session, expiry, acting context and that the caller is the receipt-derived owner, with the allowlisted 303 sign-in redirect for a missing or expired session. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Page and Route Definitions
- [x] **P2-S09-AC-1023** — Step-up is required to commit a grant command and never to read the console. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Page and Route Definitions
- [x] **P2-S09-AC-1024** — CmsCapabilityGrantListQuery fields other than subjectPersonId own filters, sort, direction and cursor in URL state, invalid values normalize with replaceState and Back restores list position. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Page and Route Definitions
- [x] **P2-S09-AC-1025** — The person filter is island-local and never serialized to the URL. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Page and Route Definitions
- [x] **P2-S09-AC-1026** — A grant-console step-up navigation discards person identifiers and returns the form empty rather than persisting them. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Step-up recovery (DEC-111)
- [x] **P2-S09-AC-1027** — FE03 distinguishes 401 UNAUTHENTICATED (redirect to /auth/sign-in with a safe returnTo and protected data removed) from 401 STEP_UP_REQUIRED, which is never rendered as a 403 gate or collapsed to reauthentication. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Step-up recovery (DEC-111)
- [x] **P2-S09-AC-1028** — FE03 parses STEP_UP_REQUIRED details { recoveryAction: 'step_up', allowedMethods: string[] } with the typed CMS step-up schema and treats any other shape as a malformed degraded response. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Step-up recovery (DEC-111)
- [x] **P2-S09-AC-1029** — The originating form navigates to /step-up?returnTo=<current relative path plus query> and the /app/cms-content-modeling routes are in the code-owned returnTo allowlist with /app as the fallback. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Step-up recovery (DEC-111)
- [x] **P2-S09-AC-1030** — FE03 ignores allowedMethods entries other than totp and renders 'No verification method is available' as a degraded state with the request ID for an empty list. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Step-up recovery (DEC-111)
- [x] **P2-S09-AC-1031** — CMS-03A-04 by the activator, CMS-03A-12, CMS-03A-14, CMS-03A-15 through CMS-03A-17, AUTH-API-17, AUTH-API-19, AUTH-API-20, AUTH-API-21 and CFG-05B-06 commands use the step-up recovery and the draft may reuse its original Idempotency-Key. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Step-up recovery (DEC-111)
- [x] **P2-S09-AC-1032** — Forms restore their scoped draft after step-up, refetch the expected version (a change opens SyncConflict) and wait for explicit re-confirmation without auto-submit. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Step-up recovery (DEC-111)
- [ ] **P2-S09-AC-1033** — On mobile the schema-review forms are native single-column with labels above, step-up confirmation, an action bar clear of the virtual keyboard and 44 by 44 px controls. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Per-component responsive contract
- [ ] **P2-S09-AC-1034** — On tablet the schema-review forms are two-column only for independent fields and the decision and assignment forms keep the evidence summary and prior step-up disclosure in view. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Per-component responsive contract
- [ ] **P2-S09-AC-1035** — On desktop the schema-review forms are grouped with the review summary and the action rail cites the frozen review version and the server-permitted next actions. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Per-component responsive contract
- [ ] **P2-S09-AC-1036** — On mobile the grant console is a priority list of capability, state and valid-through with expandable facts, single-column forms and confirmation as a separate review step. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Per-component responsive contract
- [ ] **P2-S09-AC-1037** — On tablet the grant console is a table with row-detail expansion and the grant form below it. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Per-component responsive contract
- [ ] **P2-S09-AC-1038** — On desktop the grant console is a compact semantic table with sortable headers beside the grant form and renew and revoke open inline on the row. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Per-component responsive contract
- [x] **P2-S09-AC-1039** — Schema dry-run status: job polling never steals focus and a polite live region announces queued then the immutable passed or failed report with counts and hashes only from the server. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Accessibility Inventory
- [x] **P2-S09-AC-1040** — Review decision form: native approve and reject radios with a persistent group label, step-up disclosure re-evaluated on expiry, precise decision text and no reviewer identifier rendered. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Accessibility Inventory
- [x] **P2-S09-AC-1041** — Review-only detail: heading focus on navigation only, the decision control rendered only when next actions allow it and no private matching identifier. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Accessibility Inventory
- [x] **P2-S09-AC-1042** — CMS capability grant list: header sort buttons, row actions reachable by Tab with specific names, focus staying put on refetch, a table caption, state as text plus icon, valid-through in UTC and a polite result count and filter summary. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Accessibility Inventory
- [x] **P2-S09-AC-1043** — Grant, renew and revoke forms: persistent labels, a native date input with min and max, a linked summary focusing the first invalid field, Escape cancelling the inline confirmation before commit, step-up disclosure re-evaluated on expiry, result heading focus and no person identifier in any announcement. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Accessibility Inventory
- [x] **P2-S09-AC-1044** — Grant row actions have the specific accessible names 'Renew {capability label} grant ending {date}' and 'Revoke {capability label} grant ending {date}' described by the row's person cell. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §CmsCapabilityGrantConsole (bounded React island)
- [x] **P2-S09-AC-1045** — The dry-run status polls GET /api/v1/jobs/{jobId} reusing the FE00 job polling defaults and never fabricates or optimistically displays a passing result and submit-review stays disabled until a passed persisted dry run exists. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Navigation, Degradation, and Concurrency
- [x] **P2-S09-AC-1046** — A schema review 409 (duplicate, self, out-of-policy, stale or idempotency) is reconciled before any retry and approve renders only when the frozen policy count is met server-side. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Navigation, Degradation, and Concurrency
- [x] **P2-S09-AC-1047** — Every grant, renewal and revocation is reconciled against a canonical list refetch, an unknown mutation outcome renders pending and is never guessed, and lapsed is derived by the server and never from the browser clock. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Navigation, Degradation, and Concurrency
- [x] **P2-S09-AC-1048** — A server 422 carrying grant_term_spans_at_most_ninety_utc_days renders the field error 'Choose an end date no more than 90 days from today (UTC).' and a value beyond today plus 89 days is not selectable. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §CmsCapabilityGrantConsole (bounded React island)
- [x] **P2-S09-AC-1049** — The review detail renders the owner-only assignments[] summaries with the reviewer label as display text only and the revoke control sends assignmentId and version, while non-owners receive no assignment controls. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Form-by-source completeness
- [x] **P2-S09-AC-1050** — For a Free persona the CMS capability grant console cell of the conditional rendering matrix is not-rendered: no navigation entry, no route content and no grant controls. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-1051** — For a Paid persona the CMS capability grant console cell of the conditional rendering matrix is not-rendered: no navigation entry, no route content and no grant controls. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-1052** — For a Creator persona the CMS capability grant console cell of the conditional rendering matrix is not-rendered: no navigation entry, no route content and no grant controls. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-1053** — For a Guardian persona the CMS capability grant console cell of the conditional rendering matrix is not-rendered: no navigation entry, no route content and no grant controls. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-1054** — For a Junior persona the CMS capability grant console cell of the conditional rendering matrix is not-rendered: no navigation entry, no route content and no grant controls. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-1055** — For a Business persona the CMS capability grant console cell of the conditional rendering matrix is not-rendered: no navigation entry, no route content and no grant controls. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-1056** — For a Staff persona the CMS capability grant console cell of the conditional rendering matrix is not-rendered: no navigation entry, no route content and no grant controls. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-1057** — For an Admin persona the CMS capability grant console cell is full only for the receipt-derived owner with recent step-up, and otherwise disabled with step-up recovery. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Phase 2 AC265 launch overlay (approved 2026-09-09)
- [x] **P2-S09-AC-1058** — StepUpPhase no-factor (no verified factor, or only pending or reconciling) explains a verified authenticator is required with a primary link to /settings/security/mfa?returnTo=<returnTo> and a secondary link back to returnTo. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1059** — StepUpPhase choosing-factor (more than one verified factor) shows a labelled radio group to choose the authenticator and Continue creates the challenge with factorId. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1060** — StepUpPhase creating-challenge (one verified factor) creates the challenge on mount with POST AUTH-API-20 { method: totp }, never during server rendering. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1061** — StepUpPhase awaiting-code names the authenticator and shows OneTimeCodeField with a Verify button. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1062** — StepUpPhase verifying makes the field read-only (not disabled), shows a stable 'Verifying' label and ignores duplicate activation. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1063** — StepUpPhase verified announces 'Verified. Returning to your page.' politely then calls window.location.assign(returnTo) as a full navigation so the rotated cookies are used and the CSRF token is re-read. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1064** — When stepUp.fresh is already true the page says so with the freshUntil time and offers a Continue link and never auto-redirects. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1065** — The /step-up route requires a signed-in session and renders the heading, explanation and verified-factor list from AUTH-API-16 server-side with Cache-Control no-store. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1066** — returnTo is parsed on the server with the relative first-party rule (1 to 512 characters, no scheme, authority, backslash, control character or ambiguous encoding), must not be /step-up or start with /auth/, and must pass the code-owned allowlist, otherwise /app. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1067** — A missing or expired session on /step-up redirects 303 to /auth/sign-in?returnTo= with the encoded /step-up?returnTo=, or /step-up alone when the combined value exceeds 512 characters. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1068** — A step-up success posts an invalidation-only BroadcastChannel message, other tabs refetch AUTH-API-16 to refresh stepUp and no tab copies another tab's proof. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1069** — A protected form on 401 STEP_UP_REQUIRED persists its tab-scoped draft (no codes or secrets, original Idempotency-Key and expected version), computes returnTo from its current relative path plus query (path only above 512 characters, /app when still invalid) and navigates to /step-up?returnTo=<encoded>. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1070** — /settings/security/mfa is reached from /settings/security (a Two-step verification link), from /step-up no-factor and directly, requires a signed-in session and redirects an expired session 303 to /auth/sign-in?returnTo=%2Fsettings%2Fsecurity%2Fmfa. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [ ] **P2-S09-AC-1071** — MfaFactorList is a semantic table (Name, Status, Added, Last used, row action) that becomes a priority list on mobile and shows 'Checking status' with a refresh control for reconciling rows. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1072** — The empty MfaFactorList shows 'No authenticator is set up' with the single action 'Set up an authenticator'. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1073** — A reload cannot re-show the secret: the pending row appears as 'Setup not finished' with Start again (AUTH-API-17 supersedes) and Cancel setup (AUTH-API-19 reason user_request, no step-up). [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1074** — Wizard step 1 Name sends AUTH-API-17 with If-Match expectedVersion and keeps the returned version as the If-Match for AUTH-API-18. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1075** — Wizard step 2 Scan renders the QR locally from otpauthUri as an inline SVG with role img and the name 'QR code for adding WeJammin to an authenticator app', with no third-party QR service and no otpauth link, plus the manual key and OneTimeCodeField with a 'Verify and finish' button. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1076** — Wizard step 3 Done shows 'Authenticator added', the freshUntil time, one Continue link to returnTo or the list and the note that account recovery by email followed by an administrator reset handles losing every authenticator because no recovery codes exist. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1077** — The manual key is shown as code translate=no in groups of four with a native Copy key button that announces 'Key copied' politely. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1078** — otpauthUri and manualEntryKey live only in island memory and never enter the URL, history.state, Web Storage, IndexedDB, Astro props, analytics, ErrorBoundary payloads or logs. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1079** — The enrollment secret is cleared on success, supersession, pagehide and unmount. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1080** — Removal opens an inline ConfirmationStep naming the consequence ('You will not be able to verify protected actions with it', and for the last verified factor '...until you add another authenticator') with Escape cancelling before commit. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1081** — Removal requires a reason radio group with user_request as default and factor_compromise with the note 'Your other signed-in sessions will be signed out', a per-instance Idempotency-Key and If-Match expectedVersion. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1082** — A successful removal replaces the list from the response, focuses the list heading and announces 'Authenticator removed'. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1083** — A 409 last_factor_required keeps the confirmation closed, announces 'You still have access that needs verification, so add another authenticator before removing this one.' politely and offers the single action 'Set up an authenticator' with no state change. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1084** — The friendlyName field is one text field with a persistent label, 1 to 80 characters and autocomplete off. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1085** — OneTimeCodeField is a single input type text with inputmode numeric, autocomplete one-time-code, maxlength 12, spellcheck false, autocapitalize none and enterkeyhint done, a persistent label, help linked by aria-describedby and paste allowed with no segmented boxes. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §IdentityAuthorityRoute (Astro server route)
- [x] **P2-S09-AC-1086** — The code form sets novalidate, the client removes spaces and hyphens before the six-digit check, and no pattern attribute is used so a pasted '123 456' is accepted. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §IdentityAuthorityRoute (Astro server route)
- [x] **P2-S09-AC-1087** — A code that is not six digits shows 422 code_invalid 'Enter the 6-digit code from your authenticator app.' with no request sent, and a wrong code shows code_incorrect "That code didn't work. Check the code and try again." [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1088** — 401 UNAUTHENTICATED from AUTH-API-17 with a stale primary sign-in redirects 303 to /auth/sign-in with returnTo=/settings/security/mfa and the status 'For your security, sign in again to set up your first authenticator.' and is never routed to /step-up. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1089** — 409 challenge_expired and challenge_consumed (and a 404 challenge) show 'This code request is no longer valid.' with the button 'Get a new code request' receiving focus after the announcement. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1090** — 409 mfa_factor_limit shows 'You have reached the limit of 10 authenticators. Remove one first.' with a link to the list. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1091** — 409 factor_name_taken is a field error on the name. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1092** — 409 enrollment_expired and factor_not_pending show 'Setup expired. Start again.' with the Start again button. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1093** — 409 VERSION_MISMATCH and factor_state_conflict open SyncConflict and refetch AUTH-API-16. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1094** — 403 account_not_eligible renders a disabled CapabilityGate with the reason. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1095** — 403 CSRF or origin shows 'Your session changed. Reload to continue.' with a Reload button. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1096** — 429 lockout shows a countdown from Retry-After with the submit button disabled and a visible reason. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1097** — 502, 503 and 504 show 'Verification is temporarily unavailable.' with the request ID and a Retry that creates a new challenge or enrollment and never resends the same code. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1098** — The lost-access link 'Lost your authenticator? Recover your account' goes to the sign-in recovery entry (AUTH-API-02 intent recovery) and never to a bypass. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1099** — All roles see the same self-account surface, acting context, alias, mandate or representation never changes whose factor is verified, and the heading and help always say 'your account'. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1100** — Staff and Admin variants gain nothing on the step-up surface except that their named-capability commands raise STEP_UP_REQUIRED. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1101** — Each step-up page has one h1 that receives focus on route load ('Verify it's you' or 'Two-step verification') and a title that includes the page purpose. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1102** — Code field errors use aria-invalid true with a linked error element role alert and keep focus in the field, and code_incorrect clears the value and re-selects the field. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1103** — There is no ticking timer announcement: challenge expiry is announced once and the lockout countdown is announced politely at start, at most once per minute and at unlock. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [ ] **P2-S09-AC-1104** — Step-up controls have a 44 by 44 CSS px target on mobile and at least 24 CSS px elsewhere. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [ ] **P2-S09-AC-1105** — On mobile the enrollment is one column with the QR above the key and field, a full-width field, 44 px buttons and the action bar clear of the virtual keyboard. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [ ] **P2-S09-AC-1106** — On tablet the QR and key sit side by side when the container permits. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [ ] **P2-S09-AC-1107** — On desktop the enrollment is two columns with the QR left and the steps right and the factor list a compact semantic table, with no horizontal page scroll at 320 CSS px. [FE01](../../../wiki/specs/fe/01-identity-authority.md) §Step-Up and TOTP Enrollment Components (DEC-111)
- [x] **P2-S09-AC-1108** — AdminMfaFactorResetForm renders as the mfa-reset tab only when the server projection says the actor holds admin.identity.mfa_reset (variant adminStepUp) and every other actor sees no navigation entry and the disclosure-safe 404 or CapabilityGate. [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1109** — A held capability with no fresh step-up renders disabledPrerequisite with 'Verify your identity to reset a person's two-step verification.' [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1110** — The targetPersonId field is a native text input with a persistent label, UUID validation on blur and submit, the helper copy 'Enter the person's ID exactly as it appears in the admin directory.' and no autocomplete, and no person lookup is invented. [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1111** — The reason field is a required native textarea of 1 to 512 characters after trim with a live character count. [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1112** — Unknown keys are never serialized and the operator, organization, capability and step-up time are never sent. [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1113** — A named confirmation states the consequence in text, the commit button reads 'Reset factors' with the stable pending label 'Resetting' and duplicate activation ignored, and the request carries a per-instance Idempotency-Key. [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1114** — A 200 completed result announces 'Two-step verification was reset for this person.', focuses the result heading and clears targetPersonId and reason. [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1115** — A 202 reconciling result announces 'The reset was recorded and is finishing. Check back shortly.' and never reports completed before the BE does. [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1116** — AdminMfaFactorResetForm: 401 STEP_UP_REQUIRED navigates to /step-up?returnTo=<current relative path> using the typed allowedMethods, persists nothing and returns the form empty with 'Your entries were not saved.' [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1117** — AdminMfaFactorResetForm: 401 UNAUTHENTICATED performs the safe sign-in redirect. [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1118** — AdminMfaFactorResetForm: 403 shows 'You do not have permission to reset two-step verification.' [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1119** — AdminMfaFactorResetForm: 404 shows 'That person could not be found.' [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1120** — AdminMfaFactorResetForm: 409 MFA_RESET_IN_PROGRESS shows 'A reset for this person is already finishing.' [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1121** — AdminMfaFactorResetForm: 409 IDEMPOTENCY_CONFLICT asks the operator to refresh and re-enter. [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1122** — AdminMfaFactorResetForm: 422 MFA_RESET_INVALID shows 'You cannot reset your own two-step verification. Ask another administrator.' plus field errors from the schema. [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1123** — AdminMfaFactorResetForm: 429 shows an inline countdown from Retry-After. [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1124** — AdminMfaFactorResetForm: 502, 503, 504 and IDENTITY_UNAVAILABLE render a degraded state with the request ID and an unknown outcome renders pending and is never guessed as reset. [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1125** — When the operator is the only administrator and has lost their factor the form's help panel names docs/runbooks/platform/sole-admin-mfa-lockout.md as plain text without operational detail. [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [ ] **P2-S09-AC-1126** — AdminMfaFactorResetForm has persistent labels, a linked error summary focusing the first invalid field, aria-describedby for helper and count, confirmation heading focus with Escape cancelling before commit, 44 by 44 px targets and a single-column stack at every width. [FE05](../../../wiki/specs/fe/05-platform-configuration-admin.md) §AdminMfaFactorResetForm (CFG-05B-06, DEC-111 recovery)
- [x] **P2-S09-AC-1127** — FE00 CapabilityGate and the global error-per-class mapping route 401 STEP_UP_REQUIRED to /step-up?returnTo= and never render it as a 403 gate. [FE00](../../../wiki/specs/fe/00-infrastructure.md) §Global feedback and command components
- [ ] **P2-S09-AC-1128** — Schema review assignment expires or is revoked mid-review: authority is effective only while starts_at <= now < ends_at with a current binding, an expired or revoked reviewer's decision cannot be recorded, activation rechecks live assignment and capability, and the review stays frozen. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §Edge Cases
- [ ] **P2-S09-AC-1129** — Submitter or duplicate schema review decision: the submitter never counts and a second decision by the same human on the same review is refused as append-only with neither row changed. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §Edge Cases
- [ ] **P2-S09-AC-1130** — Concurrent schema review decisions race the required count: the loser receives a typed 409 for a stale review version and the review is approved only when the required count of independent eligible approve decisions exists. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §Edge Cases
- [ ] **P2-S09-AC-1131** — Schema candidate, policy, compiler, dependency or reviewer authority drifts after approval: the review is invalidated, activation is refused with a typed error and resubmission freezes new evidence. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §Edge Cases
- [ ] **P2-S09-AC-1132** — Schema review is rejected: the candidate returns to an editable draft through an audited transition and prior review and decision rows remain immutable. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §Edge Cases
- [ ] **P2-S09-AC-1133** — Owner CMS grants lapse: the owner renews through the owner grant commands needing only the receipt identity, a live binding and recent MFA, with no party re-bootstrapped. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §Edge Cases
- [ ] **P2-S09-AC-1134** — Grant target is absent, banned, unclaimed or outside the owner's organization: an indistinguishable refusal and no identity, membership or grant is created. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §Edge Cases
- [ ] **P2-S09-AC-1135** — Specialist capability expires or is revoked after approval: the counted approver stops qualifying, the review is invalidated, activation is refused and resubmission freezes new evidence. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §Edge Cases
- [ ] **P2-S09-AC-1136** — Protected review has too few decisions left for its specialist slot: an approve decision that leaves the slot unsatisfiable is refused and a reject decision is always accepted. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §Edge Cases
- [ ] **P2-S09-AC-1137** — Two grant commands race on one grant: they serialize on the grant aggregate version and the loser receives a typed 409 and refetches. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §Edge Cases
- [ ] **P2-S09-AC-1138** — Owner targets itself for a grantable capability: the owner may grant itself any grantable capability and separation of duties is enforced at decision time, not at grant time. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §Edge Cases
- [x] **P2-S09-AC-1139** — Step-up proof is stale at submit: refuse with the typed step-up-required result before any mutation, the draft survives and nothing replays after step-up. [IA01](../../../wiki/specs/ia/01-identity-authority.md) §Edge Cases
- [x] **P2-S09-AC-1140** — Person has no verified factor when step-up is needed: the step-up page routes to enrollment and returns to the interrupted page and no command proceeds without a proof. [IA01](../../../wiki/specs/ia/01-identity-authority.md) §Edge Cases
- [x] **P2-S09-AC-1141** — Last verified factor is removed: refused while the person holds a step-up-gated capability, otherwise allowed with no new proof possible until a factor is enrolled. [IA01](../../../wiki/specs/ia/01-identity-authority.md) §Edge Cases
- [x] **P2-S09-AC-1142** — Every verified factor is lost: existing account recovery plus administrative factor reset by a capable operator, the sole administrator uses the audited runbook, no recovery codes or self-service bypass. [IA01](../../../wiki/specs/ia/01-identity-authority.md) §Edge Cases
- [x] **P2-S09-AC-1143** — Record the DEC-108, DEC-109, DEC-110, DEC-111, DEC-119 and DEC-120 depth-floor ledger with source digests, per-item rows, accounting dispositions and edit boundary in the 2026-10-02 verification record. [Approval record](../../../wiki/specs/../../pipeline/progress/verification/2026-10-02-slice-09-activation-amendment-approval.md) §Authorized cascade and implementation
- [x] **P2-S09-AC-1144** — Record each amendment criterion in both the canonical phase plan and the Slice 09 tracker with contiguous P2-S09-AC IDs from 284 and identical descriptions and source ownership, all open until the real implementation path verifies them. [Approval record](../../../wiki/specs/../../pipeline/progress/verification/2026-10-02-slice-09-activation-amendment-approval.md) §Authorized cascade and implementation
- [x] **P2-S09-AC-1145** — Compute the Slice 09 floor, authored, active and verified counts and the Phase 2 arithmetic from the ledger rows and never back-solve a total. [Approval record](../../../wiki/specs/../../pipeline/progress/verification/2026-10-02-slice-09-activation-amendment-approval.md) §Authorized cascade and implementation
- [x] **P2-S09-AC-1146** — Account for every checked Slice 09 criterion whose universal claim the amendment falsified row by row, rewording to explicit A01 through A08 scope only where the original evidence still proves it and otherwise reopening it. [Approval record](../../../wiki/specs/../../pipeline/progress/verification/2026-10-02-slice-09-activation-amendment-approval.md) §Boundaries retained
- [x] **P2-S09-AC-1147** — Record that Slices 10 and 12 implementation prerequisites include the amended Slice 09 criteria and that the later-only topics moved by the amendment have a transfer count of zero. [Approval record](../../../wiki/specs/../../pipeline/progress/verification/2026-10-02-slice-09-activation-amendment-approval.md) §Boundaries retained
- [x] **P2-S09-AC-1148** — Re-read the amended IA03 and deep dive, BE03a, BE03b and BE03c consumed boundaries, BE01a, BE00, BE05b, FE00, FE01, FE03 and FE05 after source mtimes settle and re-freeze the digests before the floor is recorded. [Approval record](../../../wiki/specs/../../pipeline/progress/verification/2026-10-02-slice-09-activation-amendment-approval.md) §Authorized cascade and implementation
- [x] **P2-S09-AC-1149** — Update slice tracking, runbooks and traceability guards in the same change so the amended denominators, route and table sets and prerequisite notes agree across plan, tracker, phase tracker, progress index, spec pipeline and the guard tests. [Approval record](../../../wiki/specs/../../pipeline/progress/verification/2026-10-02-slice-09-activation-amendment-approval.md) §Authorized cascade and implementation
- [x] **P2-S09-AC-1150** — Author docs/runbooks/platform/sole-admin-mfa-lockout.md as the audited Supabase dashboard procedure for the sole administrator who lost their factor, with an audit note and no credentials. [BE01a](../../../wiki/specs/be/01a-auth-account-linking.md) §Step-Up Proof and MFA Method Registry
- [x] **P2-S09-AC-1151** — CMS-03A-01 sourceLocale is a required canonical-case BCP 47 string of 2 to 35 characters that is a member of supportedLocales. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-1152** — CMS-03A-01 defaultLocale is a required canonical-case BCP 47 string of 2 to 35 characters, the governed delivery fallback root, that is a member of supportedLocales. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-1153** — CMS-03A-01 supportedLocales holds 1 to 32 entries and a request with 0 or 33 entries is refused with 422 and no partial insert. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-1154** — CMS-03A-01 every supportedLocales tag is canonical case (language lower-case, four-letter script Title-case, two-letter or three-digit region upper-case, every other subtag lower-case) and 2 to 35 characters, so EN-us, en_US and zh-hans-cn are refused. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1155** — CMS-03A-01 supportedLocales entries are unique. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-1156** — CMS-03A-01 supportedLocales includes sourceLocale. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-1157** — CMS-03A-01 supportedLocales includes defaultLocale. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-1158** — CMS-03A-01 stores supportedLocales sorted ascending by UTF-8 byte order and a request order carries no meaning. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1159** — CMS-03A-01 fallbackChains is keyed by every supported locale except defaultLocale, so a key outside supportedLocales, a key for defaultLocale and a supported locale without a key are each refused. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-1160** — CMS-03A-01 each fallbackChains value holds 1 to 16 unique supported locales and a chain of 0 or 17 entries, a repeated locale or an unsupported locale is refused. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-1161** — CMS-03A-01 a fallbackChains value never contains its own target locale. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-1162** — CMS-03A-01 each fallbackChains value ends at defaultLocale. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-1163** — CMS-03A-01 the directed graph with an edge from each target to every locale in its chain is acyclic, so a two-node cycle and a three-node cycle are refused. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-1164** — CMS-03A-01 fallbackChains is {} only when supportedLocales is exactly [defaultLocale]. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-1165** — CMS-03A-01 preserves the order of every fallbackChains value because chain order is semantic. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1166** — A field with localization mode no_fallback is declared and stored per locale variant and authoring refuses declaring a nonlocalizable field as no_fallback; public resolution that never falls through to defaultLocale belongs to Slice 12 and Slice 15 delivery (CMS-15, DEC-121). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1167** — CMS-03A-01 reports 422 VALIDATION_FAILED with path ['supportedLocales'] and the exact message 'supportedLocales must contain 1 to 32 locales' when supportedLocales has 0 or more than 32 entries. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1168** — CMS-03A-01 reports 422 VALIDATION_FAILED with path the tag's path and the exact message 'locale tag must be a canonical-case BCP 47 tag' when a tag is not canonical case, is outside 2-35 characters or is not BCP 47. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1169** — CMS-03A-01 reports 422 VALIDATION_FAILED with path ['supportedLocales', index] and the exact message 'supportedLocales must be unique' when supportedLocales repeats a tag. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1170** — CMS-03A-01 reports 422 VALIDATION_FAILED with path ['supportedLocales'] and the exact message 'supportedLocales must include sourceLocale' when sourceLocale is not a member. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1171** — CMS-03A-01 reports 422 VALIDATION_FAILED with path ['supportedLocales'] and the exact message 'supportedLocales must include defaultLocale' when defaultLocale is not a member. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1172** — CMS-03A-01 reports 422 VALIDATION_FAILED with path ['fallbackChains', key] and the exact message 'fallbackChains key must be a supported locale' when a fallbackChains key is not a supported locale. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1173** — CMS-03A-01 reports 422 VALIDATION_FAILED with path ['fallbackChains', defaultLocale] and the exact message 'defaultLocale must not have a fallback chain' when defaultLocale has a key. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1174** — CMS-03A-01 reports 422 VALIDATION_FAILED with path ['fallbackChains'] and the exact message 'every supported locale other than defaultLocale needs a fallback chain' when a supported locale other than defaultLocale has no key. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1175** — CMS-03A-01 reports 422 VALIDATION_FAILED with path ['fallbackChains', target] and the exact message 'fallback chain must contain 1 to 16 locales' when a chain has 0 or more than 16 entries. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1176** — CMS-03A-01 reports 422 VALIDATION_FAILED with path ['fallbackChains', target, index] and the exact message 'fallback chain locale must be a supported locale' when a chain entry is not a supported locale. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1177** — CMS-03A-01 reports 422 VALIDATION_FAILED with path ['fallbackChains', target, index] and the exact message 'fallback chain locales must be unique' when a chain repeats a locale. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1178** — CMS-03A-01 reports 422 VALIDATION_FAILED with path ['fallbackChains', target, index] and the exact message 'fallback chain must not include its own target locale' when a chain contains its own target. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1179** — CMS-03A-01 reports 422 VALIDATION_FAILED with path ['fallbackChains', target] and the exact message 'fallback chain must end at defaultLocale' when a chain's last entry is not defaultLocale. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1180** — CMS-03A-01 reports 422 VALIDATION_FAILED with path ['fallbackChains'] and the exact message 'fallback chains must not form a cycle' when the chain graph has a cycle. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1181** — CMS-03A-09 reports 422 VALIDATION_FAILED with path ['fallbackChains'] and the exact message 'supportedLocales and fallbackChains must be both null or both present' when CMS-03A-09 sends one of supportedLocales and fallbackChains without the other. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1182** — CMS-03A-01 and CMS-03A-09 return every locale-configuration issue of a request with several defects in the order of the exact-refusal table, each as { path, message } in ApiError.details. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1183** — CMS-03A-01 inserts no row when any locale-configuration rule refuses the request. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1184** — localeConfigHash is the lowercase SHA-256 hex of the RFC 8785 JCS canonical JSON of { sourceLocale, defaultLocale, supportedLocales, fallbackChains } with supportedLocales in stored order, so it is stable under request reordering of supportedLocales. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1185** — definition_hash composes localeConfigHash with the type's other definition inputs, so a changed locale configuration produces a new definition_hash that a dry run and a schema review bind. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1186** — CMS-03A-01 is the only draft command that carries the locale configuration and CMS-03A-02, CMS-03A-03 and every other draft command cannot read or write it, so a draft's configuration is fixed at insert. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1187** — CMS-03A-09 supportedLocales and fallbackChains are both null or both present and one present without the other is refused with 422. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Route field validation matrix
- [x] **P2-S09-AC-1188** — CMS-03A-09 with both locale fields null clones the source locale configuration unchanged so the successor's localeConfigHash equals the source's. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1189** — CMS-03A-09 with both locale fields present replaces the configuration, validated with the source's inherited sourceLocale and defaultLocale under the same rules as CMS-03A-01. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1190** — CMS-03A-09 always inherits sourceLocale and defaultLocale from the immutable source, so a successor can never remove either. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1191** — CMS-03A-04 recomputes localeConfigHash from the candidate row and returns 409 CONFLICT when it differs from the review's frozen localeConfigHash, mutating nothing. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1192** — CMS-03A-04 writes the recomputed localeConfigHash into SchemaActivationResource. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1193** — The cms.schema.activated.v1 payload carries localeConfigHash equal to the activated version's value. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1194** — SchemaReviewFrozenEvidence freezes localeConfigHash alongside the definition and dry-run evidence. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Request/Response Contracts (Zod 4 schemas)
- [x] **P2-S09-AC-1195** — The compatibility classification (CMS-03A-10) treats a successor whose locale configuration equals its source's as no locale change. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1196** — Adding a supported locale together with its chain is classified additive. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1197** — Removing a supported locale, changing the members or order of a retained locale's chain, or changing a chain so a stored LocaleVariant or published locale resolves differently is classified breaking and requires a migration plan whose dry run counts the affected locale variants and publications. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1198** — ContentTypeVersionResource in CMS-03A-07 and in CMS-03A-06 list rows exposes supportedLocales, fallbackChains and localeConfigHash to every caller that may read the version, with no ownership identifier. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Locale configuration (OD-4)
- [x] **P2-S09-AC-1199** — cms_content_type_versions source_locale and default_locale are NOT NULL text columns with a BCP 47 shape CHECK. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-1200** — cms_content_type_versions supported_locales is NOT NULL jsonb with a CHECK that it is an array of 1 to 32 entries containing source_locale and default_locale. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-1201** — cms_content_type_versions fallback_chains is NOT NULL jsonb with a CHECK that it is an object. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-1202** — cms_content_type_versions locale_config_hash is NOT NULL char(64) with a lowercase 64-hex CHECK. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-1203** — The draft and successor RPCs run the pure platform_api.cms_validate_locale_config function, which applies the same rules and exact messages as the locale refusal table, and compute localeConfigHash. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-1204** — cms_schema_reviews locale_config_hash is NOT NULL char(64) with a lowercase 64-hex CHECK and equals the candidate version's value at freeze. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-1205** — A BEFORE UPDATE trigger rejects any UPDATE of supported_locales, fallback_chains, locale_config_hash, source_locale and default_locale on cms_content_type_versions. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §Canonical records and fields
- [x] **P2-S09-AC-1206** — The scheduled state is unreachable for content-type versions because CMS-03A-04 activates synchronously or queues migration work, and no schema-version resource, evidence record or test expects scheduled (OD-6). [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §State machine and concurrency
- [x] **P2-S09-AC-1207** — The supported-languages tag input has the persistent label 'Add a language tag', the help 'For example en, fr-CA, zh-Hans-CN', autocomplete off, autocapitalize none and spellcheck false. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1208** — Pressing Enter in the tag input activates Add and never submits the form. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1209** — Supported tags render as a native list and each item has a Remove button named 'Remove {tag} from supported languages'. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1210** — A counter '{n} of 32' is linked to the tag input by aria-describedby and Add is disabled with the text 'Maximum 32 languages' at 32 tags. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1211** — A tag that is not canonical case shows the exact message 'locale tag must be a canonical-case BCP 47 tag' with a 'Use {canonical}' button that replaces the draft text only when activated, never silently. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1212** — A repeated tag shows the exact message 'supportedLocales must be unique'. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1213** — An empty supported-languages list on review shows the exact message 'supportedLocales must contain 1 to 32 locales'. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1214** — The source language control is a required native select that lists only the current supported tags, and an unselected value on review shows 'supportedLocales must include sourceLocale'. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1215** — The default language control is a required native select over the supported tags with the help 'The language every fallback order ends at', and an unselected value shows 'supportedLocales must include defaultLocale'. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1216** — Changing the default language re-renders every fallback group and keeps each group's intermediate entries that remain valid. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1217** — Each supported tag other than the default gets one fieldset with the legend 'Fallback order for {target}' holding an ordered list of 0 to 15 intermediate entries followed by a fixed non-removable final item '{defaultLocale} (always last)'. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1218** — The 'Add a fallback language' control is a native select that excludes the target, the default and entries already in the list, with an Add button. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1219** — Each intermediate fallback entry has Move earlier, Move later and Remove buttons named with the tag and target, and reordering never depends on drag. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1220** — A fallback group with no intermediate entries is valid. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1221** — On review a fallback cycle shows 'fallback chains must not form a cycle' in the summary, names the languages involved and focuses the first participating fallback group. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1222** — The successor form offers the radio group 'Languages in the new version' with Keep (default, submits both fields null) and Change (reveals the controls prefilled from the source). [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1223** — Switching a successor back to Keep discards the edits after a native confirm that names the count of changed items. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1224** — Removing a language that other groups use as an intermediate removes it from those groups in the same action and announces 'Removed {tag} from the fallback order for {a}, {b}' through the polite live region. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1225** — A Review changes step lists each added language, each removed language and each retained language whose order changed, against the source version for a successor and against the empty set for a new type. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1226** — The Review changes step states that removing a language or changing a retained fallback order is treated as a breaking change needing a migration plan at dry run, and classification is server-derived and never computed in the browser. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1227** — Locale configuration pristine: controls are prefilled for a successor or empty with the sentence 'Add at least one language', and no error shows before the first blur or submit. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1228** — Locale configuration client-invalid: a linked summary lists each message with its field path, focus moves to the summary on submit and to the first invalid control on summary-link activation. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1229** — Locale configuration pending: only the commit action is disabled with the text 'Saving…', all locale controls become read-only with aria-disabled and duplicate activation is ignored. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1230** — Locale configuration server 422: every details.issues entry is mapped by path to its control and shown with the exact message, unmapped paths go to the summary only and input is preserved. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1231** — Locale configuration server 409: the form shows 'This version changed while you were editing. Review the current version, then reapply your languages.' with Review changes, Reapply when permitted and Discard, and never overwrites the preserved draft. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1232** — Locale configuration committed: the result heading receives focus and the detail shows the configuration read-only as the language list and '{target}: {a} → {b} → {default}' per target. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1233** — Locale configuration forbidden or hidden: no controls render and the designer capability gate matches the surrounding form. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1234** — Locale configuration lists and fieldsets are native, every button has a unique accessible name containing the tag and, for chains, the target, and focus after Remove moves to the next item or to the Add input when none remains. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1235** — A change of fallback position announces '{tag} is now {k} of {n} in the fallback order for {target}'. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [ ] **P2-S09-AC-1236** — Fallback order is conveyed by ordinal text and ordered-list semantics and never by color or position alone, and interactive targets are at least 24 CSS px with 44 preferred. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [ ] **P2-S09-AC-1237** — The Review changes step and every locale message are reachable by keyboard with no trap and no hover-only content. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Locale configuration fields (OD-4)
- [x] **P2-S09-AC-1238** — The generated ContentSchemaRegistryContractField union includes supportedLocales, fallbackChains and localeConfigHash so FE03 maps the new BE03a fields. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §Exhaustive BE field and error ownership
- [x] **P2-S09-AC-1239** — Only a successor content-type version may change supported_locales or fallback_chains: it goes through dry run, schema review and activation, an active version is never edited in place, and removing a locale or reordering a retained chain is a breaking change. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §Edge Cases

## TDD Evidence

### Contract lock

- Strict Zod request/response/error contracts cover all eight BE03a operations,
  immutable registry resources, release evidence, activation, events, and
  browser-safe projections.
- The 283-item floor is contiguous and mirrored from the locked Phase 2 plan;
  later editorial, composition, taxonomy, locale, and public-delivery behavior
  remains owned by S10–S17.

### QA RED

- The retained independent baseline records 283 criteria as 252 PASS, 19 FAIL,
  and 12 UNVERIFIED before remediation.
- Real RED findings included the 133,098/92,160-byte initial-route budget
  breach, sub-100% coverage, hydration failure, activation recovery defects,
  and signed release/block-registry defects.

### QA GREEN

- Local PostgreSQL, contract, Worker, SSR/island, browser, security, recovery,
  performance, bundle, and adversarial gates pass.
- Canonical validation passes 418/418 Vitest files and 3,096/3,096 tests at
  exact 100% coverage, 102/102 default Chromium tests, all builds and bundle
  budgets, and local performance smoke.
- The dedicated production-built S09 route passes 5/5; the clean database suite
  passes 45 files / 1,670 assertions; independent psql recovery sessions pass,
  including expired zero-row lease takeover and single-owner activation/DLQ
  races.
- Full evidence and the four non-local release gates are recorded in the
  [QA-GREEN disposition](../../../wiki/specs/audits/phase-02-slice-09-qa-green.md).

## Verification

- `pnpm validate`: PASS — 418/418 Vitest files, 3,096/3,096 tests, 100%
  statements/branches/functions/lines, and 102/102 Playwright tests.
- `pnpm db:reset && pnpm db:test && pnpm db:types:check`: PASS.
- `pnpm db:verify`: PASS — 33/33 migrations, 45/45 pgTAP files and 1,670/1,670
  assertions, with generated database types matching the migrated schema.
- Prior PR merge-candidate CI: PASS — GitHub run `33841270472` completed all three
  jobs for synthetic merge `a79dfe30db60e4f54024f064fc2fdf2d01033919`,
  whose parents are baseline `9b2cff7849b25dd12ffae6287b1024e50654bc14`
  and branch head `67264c5e9b5196d00ac3f0aa272896a010c872d7`.
  This is committed PR candidate evidence, not exact-main-SHA, staging, or
  production evidence.
- Post-remediation focused workflow and migration-contract tests: PASS — 30/30
  tests cover fail-closed hosted migration ordering, step-scoped credentials,
  immutable `staging-migration-evidence`, full-history parity behavior,
  old-candidate rejection, and production's exact staging-project binding. This
  local verification does not establish GitHub CI or deployment evidence.
- Clean Worker artifact regression: PASS — Wrangler emits the executable
  `runtime-entry.js` module through `--outdir`, the build copies it to the
  immutable `dist/index.js` release path, syntax validation passes, and the API
  p95 smoke imports the freshly built artifact with zero errors.
- Dedicated S09 pgTAP: PASS — 247 assertions, including fenced event claim,
  release, ACK, dead-letter, expiry takeover, and retry ownership.
- Independent psql recovery harness: PASS — committed sessions exercised
  zero-row lease expiry takeover, concurrent activation, and a DLQ replay race
  with exactly one fenced owner.
- Dedicated production-built S09 Playwright route: 5/5 PASS.
- Operational release-evidence and protected-promotion verification: 6/6
  focused files and 74/74 tests PASS. The sidecar is independently bound to the
  expected artifact identity, retained files are SHA/root checked, workflow
  readers reject ambiguous or forged identity, production reviewer rules
  require self-review prevention, and all release/promotion CLIs fail closed
  when invoked through symlinks.
- Final structural audit, diff check, contiguous-ID/count/mirror checks, and
  progress consistency: PASS.
- Fresh `/verify-infrastructure`: FAIL / BLOCKED — the
  [post-deploy report](../../../wiki/specs/audits/verify-infrastructure-2026-09-04-1703.md)
  records exact main SHA `5d6e49f34b678c59da2ac4f7059f08e6dc3b4790`, CI run
  `33917604565` with all three required jobs green, immutable workspace
  artifact `9953929511` (`sha256:2a89077d...`), staging run `33918141133`
  and successful job `101169994068`, deployment `6272586576`, and hosted
  migration through `20260902080000` in `expanded` state with full history
  parity. Independent candidate artifact `9953965534` and deployment-evidence
  artifact `9953965990` are retained; deployed API/web versions are
  `0f6ef117-c377-4229-ab0b-72c815346414` /
  `e3b79e94-99d2-4447-ac22-be3c5e485bb1`. Public checks record web `200`,
  protected routes `303`, API health `200`/`ok`, CMS API `401`, and p95
  `42.649115ms` over `20/20` with zero errors. `/api/v1/ready` remains
  `503`/`not_ready` by intentional fail-closed behavior with no readiness
  checker; `/api/v1/auth/providers` remains `503 DEPENDENCY_UNAVAILABLE` at
  the hosted-auth boundary, and Google is disabled. No production telemetry or
  provider receipt, authorized hosted Auth/RLS/IdP matrix, or manual
  VoiceOver/Safari and NVDA/Firefox accessibility smoke is claimed. Slice 09
  remains 279/283. The 13:53 and 12:55 audit records remain preserved in the
  [prior post-remediation report](../../../wiki/specs/audits/verify-infrastructure-2026-09-04-1353.md)
  and [12:55 audit](../../../wiki/specs/audits/verify-infrastructure-2026-09-04-1255.md).

- Fresh release-evidence correction merged through PR #13 as exact main SHA
  `7250754dcdc9c1b7a863aa41d79772e6ab7092ab`. CI `33950299169`, staging
  `33950592657` / deployment `6278097284`, and production `33950658266` /
  deployment `6278109516` all passed. Production applied all migrations,
  deployed API Worker `b5ab753d-8388-490d-b6a0-ba3096f074b4` and web Worker
  `68a414d7-2f74-40d8-a9fd-367404573b93`, and retained five-file evidence
  artifact `9964724622` (`sha256:388dee00...`). Independent public checks pass
  web root/sign-in/degraded rendering and protected-route redirect contracts;
  Auth providers remain intentionally fail-closed at `503` until AC265 setup.

- 2026-09-05 operational-alert implementation checkpoint: the production
  Worker now aggregates bounded `cms.registry.*` logs, Supabase registry state,
  and the production Queue DLQ backlog; evaluates all twelve locked alert
  conditions; claims a deduplicated database receipt; sends only redacted
  safe-code content through the `PLATFORM_ALERT_EMAIL` binding; and completes a
  digest-only receipt. Production deployment requires the environment-scoped
  `CLOUDFLARE_OBSERVABILITY_API_TOKEN` with Workers Observability Write and
  Account Analytics Read, while staging remains independent of that secret.
  Local validation passes 423 Vitest files / 3,143 tests at 100% coverage, 102
  Playwright checks, build/bundle/performance gates, and database type parity.
  This checkpoint implements the provider boundary but does not claim AC209 or
  AC211: exact-SHA deployment, a post-configuration delivered alert receipt,
  and the complete production UTC-day SLO/DLQ evidence are still required.

- 2026-09-05 production provider recovery: PR #16 merged the bounded Cloudflare
  query/error-sanitization correction as `6ff9bedacdab916f5de71a8b39460b14718941f7`;
  PR #17 merged current-envelope compatibility as
  `1c969366926e9fe5db50cdd1f523207a477d243e`; and PR #18 merged the
  root-cause empty-result decoder as
  `c995ce31821e39ac6f27538813f536f9af6b39f2`. Exact-SHA CI run
  `33960218010` passed after one unchanged rerun confirmed an unrelated late
  upload-admission promise rejection was transient, staging run `33960712969`
  / deployment `6279914420` passed, and business-account-approved production
  run `33960764747` / deployment `6279925490` passed. Retained staging and
  production artifacts are `9967847252`, `9967847034`, and `9967870332`.
  Fresh Cloudflare production logs record two consecutive successful scheduled
  executions at `2026-09-05 06:31:00.649 EDT` and
  `2026-09-05 06:31:54.674 EDT`; the last `Invalid Workers Logs response` is
  pre-deployment at `2026-09-05 06:29:54.678 EDT`. Local validation passes 423
  Vitest files / 3,148 tests at 100% coverage, 102 Playwright checks, all
  build/bundle/performance gates, and 45 pgTAP files / 1,678 tests. Gmail still
  reports no message from `platform.on-call@alerts.wejamm.in`, so no live
  delivery receipt is claimed and AC209 remains open.

- 2026-09-05 hosted auth-provider transport recovery: PR #20 merged the
  active-request-context Worker fetch correction as
  `fcdf0ac027453bc764fd835859a059253dfd2b1f`. Two exact-main reruns then
  reproduced timeout-only failures in the repository-wide AST scan and
  two-build SSR deployment contract while the other 3,146 tests passed. PR #21
  retained every assertion and added shared-runner time-budget headroom; its
  merge `b22a914327291e2895bbcc7dc8f60837c8faa0d6` passed exact-main CI
  `33965293079`, staging `33965655238` / deployment `6280862362`, and
  business-account-approved production `33965764707` / deployment
  `6280885024`. Retained artifacts are `9969324579`, `9969307786`,
  `9969340186`, `9969340453`, and `9969392638`. Both staging auth origins and
  five sequential production requests now return HTTP `200` with the valid
  provider catalog; Cloudflare records the five production requests at info
  level with 21 successes and 0 errors in the 15-minute window. Google remains
  `temporarily_unavailable`: both Supabase projects have the provider disabled
  with blank OAuth credentials, and Google Cloud requires owner acceptance of
  its Terms of Service before business-owned client setup. The
  [current infrastructure report](../../../wiki/specs/audits/verify-infrastructure-2026-09-05-0824.md)
  records the evidence and keeps AC265 open.

- 2026-09-06 production DLQ-alert verification: PR #23 merged the fail-closed
  Queue Analytics response correction as exact main SHA
  `2e806ed8b399b024181878dd71e5834bfa73579f`; CI run `33969135163`, staging
  run `33969454591`, and business-account-approved production run
  `33969517664` all passed. Cloudflare Queue Analytics, queried through the
  business Wrangler OAuth session at `2026-09-06T04:29:37.083Z`, reported
  `platform-jobs=0` and `platform-jobs-dlq=1`. Production Worker version
  `9bd444fe-e7ed-499c-88f5-a3a8762ddb5c` then ran the one-minute schedule and
  failed closed with `Invalid Queue analytics response`; the durable delivery
  ledger remained empty. The exact deployed query succeeds through the
  business OAuth session, isolating the remaining fault to the protected
  `CLOUDFLARE_OBSERVABILITY_API_TOKEN` scope/resource configuration. PR #24
  adds a secret-safe pre-mutation release check for Workers Observability Write
  plus Account Analytics Read. Its local gate passes 424 Vitest files / 3,154
  tests at 100% coverage, 102 Playwright checks, all build/bundle/performance
  gates, and 45 pgTAP files / 1,678 tests. AC209 remains open until the
  production secret is rotated and a genuine delivered receipt is retained.

- 2026-09-06 exact-main observability preflight: PR #24 is current `main` SHA
  `3bf66a610b013bf9600889780ee26319559fb31c`. CI `34013034252` and staging
  `34013296132` passed. Protected production run `34016439881` reached the new
  permission check and failed with `Cloudflare Account Analytics permission
check failed` before migrations or deployment. Existing production Worker
  version `9bd444fe-e7ed-499c-88f5-a3a8762ddb5c` remained active at 100%.
  Public staging and production provider catalogs remain HTTP `200`. Business
  Wrangler OAuth can read Queue Analytics, but its scope cannot read Workers
  Observability or manage API tokens; user-token and account-token endpoints
  both return HTTP `403`. The retained report is
  [verify-infrastructure-2026-09-06-0300.md](../../../wiki/specs/audits/verify-infrastructure-2026-09-06-0300.md).

- 2026-09-06 rotated-secret retest and diagnostics: production secret metadata
  changed at `2026-09-06T07:07:48Z`. Protected run `34018343506` consumed the
  replacement and again passed Workers Observability before failing Account
  Analytics, with no migration or deployment mutation. TDD added fixed safe
  classifications for HTTP, GraphQL permission, GraphQL resource, and malformed
  responses: RED 8/12, GREEN 12/12. Full `pnpm validate` passes 424 Vitest files /
  3,162 tests at 100% coverage, 102 Playwright checks, build, bundle, and
  performance smoke. AC209 remains open; Slice 09 stays 279/283.

- 2026-09-06 exact-main parser diagnosis: PR #25 merged as
  `ccfefa7862900357586fef9031b314e7b30989b4`; CI `34019423084` and staging
  `34019696293` passed. Protected production `34019780775` stopped before
  migration/deployment and safely classified Account Analytics as `malformed
response`; Workers Observability passed. Cloudflare's documented successful
  GraphQL envelope permits `errors: null`, while the verifier rejected every
  non-array value. Regression RED failed 1/18 with `invalid errors envelope`;
  GREEN passes 18/18 after accepting `null`. AC209 remains open; Slice 09 stays
  279/283 pending exact-main production and genuine delivery evidence. Clean
  `pnpm validate` passes 424 Vitest files / 3,168 tests at 100% coverage, all 102
  Playwright checks, builds, bundle budgets, and API p95 smoke.

- 2026-09-06 successful observability promotion and runtime follow-up: PR #26
  merged as exact main SHA `6d33bd189a51b4e041e582feb604d5fe22ddce78`;
  CI `34020909710`, staging `34021192537`, and protected production
  `34021249248` passed. Production verified both Cloudflare scopes, remote
  migration parity, release identity, API Worker version
  `e1891c96-f8d9-47e4-ac5c-0671d17d3696`, web Worker version
  `6565d60c-ab9f-483d-8b3c-bb44f9ad9ba5`, and artifact `9985578911`. The
  scheduled runtime repeated the valid `errors: null` rejection in its Queue
  Analytics parser; runtime RED failed 1/29 and GREEN passes 29/29. No manual
  dispatch or delivery-ledger read path exists. AC209 remains open pending
  exact-main runtime promotion and genuine mailbox/provider receipt; Slice 09
  stays 279/283. Full `pnpm validate` passes 424 Vitest files / 3,169 tests at
  100% coverage, all 102 Playwright checks, builds, bundle budgets, and API p95
  smoke.

- 2026-09-06 scheduled-runtime exact-main promotion: PR #27 merged as
  `93c2fd837cffa89baea9d43a9f482000c5739440`; CI `34022522801`, staging
  `34022811556` / deployment `6291019997`, and protected production
  `34022888837` / deployment `6291034733` passed. Production re-verified both
  Cloudflare scopes and remote migration parity, deployed API Worker version
  `1b2d3c02-d3e9-4681-9fde-7d05f06e0cd5` and web Worker version
  `a5d3d651-29ff-4226-bff2-d11376671b6d`, and retained artifact `9986107430`
  with digest
  `sha256:6e18252a24f02cb790a56bf5b10e3685b3e491b2567ecec97e09f1f86991fcc2`.
  Native production tail captured a natural scheduled event at
  `2026-09-06T08:54:51.000Z` with outcome `ok` and zero exceptions. AC209
  remains open because no threshold fired and no genuine provider/mailbox
  receipt exists; Slice 09 stays 279/283.

- 2026-09-06 AC211 collector production deployment: PR #29 merged the
  collector, provider, and source-verifier implementation and it is deployed.
  Full `pnpm validate` passes 432/432 Vitest files,
  3,233/3,233 tests at 100% coverage, and 102/102 Playwright checks. The
  latest verified production candidate is exact main SHA
  `621f7b99745318948720afa4d670ae1a707d3365`; CI `34031918191`, staging
  `34032219768`, protected production run `34032282370` / deployment
  `6292744330`, artifact `9989024106` with digest
  `sha256:e21aeb18405deab77f8b12d43f00903481ce16fe9580ea778425ca53fffea33a`, API Worker
  `a726691a-64bc-47e5-bc5e-6b52088efbff`, and web Worker
  `18b0287a-8af7-47e8-ad43-e5bdc29a10ab` are verified. Protected secret
  verification passed and `CLOUDFLARE_PLATFORM_QUEUE_ID` is set and verified;
  no complete retained production UTC-day report exists. Protected run
  `34189916813` attempted 2026-09-07 UTC and failed closed for insufficient
  natural samples; the next eligible complete day is 2026-09-08 UTC and can be
  collected only after `2026-09-09T00:00:00Z`, so AC211 remains open and Slice
  09 stays 279/283.

- 2026-09-06 blocker remediation audit: read-only inspection of production run
  `34032282370` reconfirmed the observability permission preflight. Current API
  Worker version `a726691a-64bc-47e5-bc5e-6b52088efbff` contains the
  `PLATFORM_ALERT_EMAIL` Send Email binding. Cloudflare Email Sending is enabled
  for `alerts.wejamm.in`, its bounce MX/SPF/DKIM/DMARC records are present, and
  `admin.wejammin@gmail.com` is a verified destination. No secret rotation,
  inbound Email Routing change, manual email dispatch, or synthetic threshold
  is warranted. AC209 is reduced to the genuine threshold-triggered
  provider/mailbox receipt; Slice 09 remains 279/283.

- 2026-09-06 AC209/AC265 focused remediation: current production Worker version
  `a726691a-64bc-47e5-bc5e-6b52088efbff` recorded 504 successful scheduled
  invocations after deployment with zero script exceptions. Cloudflare's
  zone-level `emailSendingAdaptive` individual and aggregate queries returned
  zero outbound events across the latest 30-day window ending
  `2026-09-06T20:37:15.119Z`; AC209 therefore has no genuine provider receipt
  to retain. Fresh staging and production provider-catalog requests returned
  HTTP 200 at `2026-09-06T20:43:30.654Z`, with Google still
  `temporarily_unavailable`. No threshold, traffic, OAuth state, or identity was
  synthesized. AC265 retained-report verification now parses a strict redacted
  hosted body, binds it to protected release identity, streams the fixed report
  tree, and pins each bounded read to one descriptor and byte buffer. It rejects
  symlinks, special files, and unreferenced evidence. Focused
  regression RED failed 7/24 checks; GREEN passes 54/54. This hardens future
  evidence without claiming a hosted run. Final `pnpm validate` passes 433
  Vitest files / 3,248 tests at 100% coverage, 102/102 Playwright checks, and all
  remaining repository gates. AC209 and AC265 remain open; Slice 09 stays
  279/283.

- 2026-09-07 evidence and CI gate stabilization: the executable evidence gate
  now runs separately from coverage, strips parent Vitest and npm lifecycle
  state before spawning bounded child commands, and is enforced in CI with a
  45-minute quality-job ceiling. Functional browser gates use one isolated
  worker, while the production-built Slice 09 route owns a dedicated five-test
  performance/auth suite. Full local `pnpm validate` passes 433/433 Vitest
  files and 3,248/3,248 tests at 100% coverage, 101/101 functional Playwright
  checks, 5/5 production-built Slice 09 Playwright checks, builds, bundle
  budgets, and performance smoke. A fresh staging catalog request returned
  HTTP 200 with Google `temporarily_unavailable`; direct staging Supabase
  authorization returned HTTP 400 `validation_failed` because Google remains
  disabled. No alert, OAuth flow, identity, or accessibility evidence was
  synthesized. AC209, AC211, AC265, and AC266 remain open; Slice 09 stays
  279/283 and Slice 10 remains locked.

- 2026-09-08 four-gate remediation: AC209 production configuration and three
  fresh scheduled evaluations are healthy, but the retained 31-day Email
  Sending window contains zero events and no genuine receipt. AC211 run
  `34187499317` exposed Cloudflare request-schema drift; PR `34` moved
  `view: events` to the required top level and added completed-run/empty-result
  guards. Full local validation passes 434/434 Vitest files, 3,256 tests plus
  one intentional skip at 100% coverage, 101/101 functional Playwright checks,
  and 5/5 production-built Slice 09 checks. Exact-main CI `34189412445` and
  staging `34189831032` pass for SHA
  `ad1efe40963e3273714dfdee85c9a97a89d1123b`; corrected collector run
  `34189916813` reaches the real provider dataset and fails closed because
  production samples are insufficient. AC265 recheck confirms Google disabled,
  zero hosted users/identities, and no approved OAuth client. AC266 hosted
  Chromium axe, media, zoom, and keyboard checks pass, but the two signed real
  platform reports cannot run on the Linux-only host/runners. No external
  acceptance item closed; Slice 09 remains 279/283 and Slice 10 remains locked.

- 2026-09-08 hosted OAuth remediation follow-up: the exact staged candidate
  `10f320b97ccce0c62fba2ee27a3b792f08f83285` passed CI `34224641678` and
  staging `34225256920` / deployment `6327379740`. Google is now configured
  through Supabase Auth, and the provider registry is `enabled` and verified at
  version `16`. A live external-browser callback retained five distinct
  cookies, completed the session boundary, reached the protected registry route,
  and created one real Google identity. This supersedes the pre-configuration
  Google-disabled result above; AC265 remains open for the approved
  9-role/10-scenario hosted report, role/identity lifecycle, MFA/step-up, and
  teardown evidence. AC209, AC211, and AC266 remain open; Slice 09 stays
  279/283 and Slice 10 remains dependency-locked.

## Depth Ratio

- Authored acceptance items: 1202/1239 verified; authored depth ratio: 0.970
- Active implementation completion: **1202/1235** after the 2026-09-30 activation
  reopen (17 criteria, re-verified 2026-10-02), the 2026-10-02 reopen of AC019, AC039, AC043, AC054, AC100, AC143, AC181, AC196, AC215, AC222, AC259, AC264 and AC273, the
  956 new amendment criteria and the separately reopened AC250, which was
  Chrome-verified and closed 2026-10-01; active depth ratio: **0.973**. AC209,
  AC211, AC265, and AC266 are excluded from the active implementation denominator
  while remaining authored, unchecked, and mandatory on their own timelines.

## Completion Signature

- Date: 2026-09-26 (historical); runtime entrypoint: Node 22.23.1 / pnpm 11.24.0.
- Historical checkpoint: Slice 09 implementation was complete at 279/279 active;
  authored 279/283 verified (0.986) with four genuine-evidence criteria still
  unchecked. Superseded on 2026-09-30 by the 17-criterion activation re-audit and
  the separate AC250 reopen, then updated 2026-10-01 when AC250 was
  Chrome-verified and closed, giving **262/279** active.
- `pnpm validate`: exit 0; 644 Vitest files, 5,456 passed + 1 skipped,
  100% coverage; Chrome E2E, build, bundle, and performance gates passed.
- `pnpm db:verify`: exit 0; 65 pgTAP files / 2,324 tests; generated types match.
- `scripts/check-progress-consistency.mjs --json`: exit 0, `consistent`,
  Phase 2 9/17. This signs implementation completion only, not AC209, AC211,
  AC265, AC266, or production readiness.

## Blocking release evidence (current as of 2026-09-26)

DEC-105 moves AC265 out of the active implementation denominator. AC265 is a mandatory pre-release hosted gate and does not block Slice 10 implementation.
AC266 remains the pre-release real-device gate. Both AC265 and AC266 must pass
before production readiness/release; neither is waived by Slice 09
implementation completion. AC209 is a production-rollout/post-deployment gate that must pass before alerting is declared ready. AC211 is post-launch operational SLO acceptance that is mandatory after initial launch. Each remains authored and unchecked.

- P2-S09-AC-209 (production-rollout/post-deployment evidence gate, unchecked):
  retain a genuine post-configuration redacted live-delivery
  receipt. The read-only Email Routing day-count probe
  [run 36067233068](https://github.com/WeJustJammin/wejammin/actions/runs/36067233068)
  succeeded from exact `main` `20338c72` and reported **9 delivered routing rows
  across 4 days** (2026-09-22/1, 2026-09-12/4, 2026-09-11/3, 2026-09-05/1) in
  the 31-day window; the Email Sending dataset still reports **zero** in both
  windows (`zone_wide_missing`). Grouped routing counts carry only `date` and
  `status`, so none is attributable to the 2026-09-22 control alert, and the
  provider may sample adaptive datasets. The earlier `provider_graphql_error`
  on `emailSendingAdaptive` is repaired: the read-only dataset presence probe
  [run 36059761536](https://github.com/WeJustJammin/wejammin/actions/runs/36059761536)
  reached that dataset directly and returned zero rows instead of a provider
  error, so the error condition itself is cleared and what remains is the
  absence of sending telemetry. The read-only email diagnostic
  [run 36069837542](https://github.com/WeJustJammin/wejammin/actions/runs/36069837542)
  then queried that node over the exact hour of the verified send and returned
  `settings=available` with `rowsReturned=0` and classification `zero_rows`,
  confirming the query path is healthy and the dataset is empty for that hour.
  Neither run yields a correlated Sending event or a delivered `dlq_nonempty`
  row, so a fresh exercise is deferred until the evidence path works. The open
  gate is the correlated
  provider event plus a delivered `dlq_nonempty` row for the exact release.
  Per-event routing probe
  [run 36083336932](https://github.com/WeJustJammin/wejammin/actions/runs/36083336932)
  went further and found exactly **one** provider-reported `delivered` per-event
  row inside that same hour, marked final, with one complete message-id digest;
  its `action` label is `unknown`. No comparable message identifier is held from
  the send itself, so the row is not attributable to the control alert and AC209
  stays open on the same gate.
- P2-S09-AC-211 (post-launch operational SLO acceptance, unchecked): collection
  [run 36038007951](https://github.com/WeJustJammin/wejammin/actions/runs/36038007951)
  (UTC day 2026-09-23) passed preflight and failed closed for insufficient
  samples: `commands=0`, `protectedRpcs=0`, `acceptances=0`, and
  `queueFirstAttempts=0`, against floors of 200/200/200/1. No artifact was
  produced. The Sep-22 run `35846440023` had failed earlier on
  `malformed_queue_analytics_row`; that row-shape defect is fixed and promoted
  in `21929176`, and this run's queue envelope was accepted with
  `rowCount=0`, so the remaining blocker is genuine production volume. No
  complete retained UTC-day report exists; retain a later complete day with at
  least 200 samples, all five SLO results, and daily queue/DLQ counts.
- P2-S09-AC-265 (mandatory pre-release hosted gate, unchecked): the latest candidate authorization
  attempt used PR #80 SHA
  `918f598525de772c82b0a0bcd82348ea8f5d523d`, which passed CI `34823698333`
  and staging `34824312138` / deployment `6433521892`. Preflight `34824500796`
  passed, but authorization foundation run `34824651793` failed at
  `staging_prepare`; no hosted browser matrix or accepted 9-role/10-scenario
  report exists. PR #91 is the promoted CP-04d implementation baseline at exact SHA
  `289ed3a2f4f92da383aa1464340f804777496257`; exact-main CI `35656504913`
  succeeded across all three jobs, and automatic staging run `35657406613`
  succeeded on `run_attempt=1` with deployment `6578526934`. Candidate artifact
  `10665966829` has digest
  `sha256:d51c0104d8ea7933e5d4a45af021b0ac2067a24150739390edb58e171cab827c`;
  deployment evidence artifact `10665756858` has digest
  `sha256:2724a98beb5e2152b7c601697c95042af508ee94d2e62da7ee143495362c9664`;
  source `artifactDigest` is
  `0e92da9874c0fae7e0d62fb4419678a83f00a8986087de558dc101c465451c04`;
  migration `20260921050000` and provider deployments
  `dac978c4-fe9d-4c86-9cf4-53d96a42d45e` and
  `b27ddb9f-0ab3-4c07-88da-5ff8ea0b2f7b` are recorded. Staging p95 was
  `29.956710999999927 ms` against the `500 ms` threshold; automated axe digest
  `6a7f59d9792a176e3032a9b410c6a0c1bb03850f27ed2918bc98fe82fddbbcf4`,
  serious/critical `0/0`. These are exact-main CI and staging promotion proofs
  only; staging proof does not equal hosted AC265 acceptance. CP-01 through CP-04b provide
  promoted staging-only outage-lease, safe-resource/runner-mapping registry,
  signed mapping/target attestation, target-read, and target-registration
  foundations. They intentionally seed no live policy, target, registry row,
  signing key, retained attestation/evidence artifact, hosted matrix, or
  independently authenticated receipt. CP-04c PR #90 remains the prior
  artifact-attestation and branded-resolver foundation; CP-04d PR #91 is the
  latest promoted private source-manifest and authority foundation. The
  promotion does not represent a hosted producer/source population,
  protected signer execution, retained hosted artifact, external replay
  evidence, or hosted acceptance. The canonical mapping/resource and target sources, role/session
  broker, MFA/step-up, evidence service, teardown, durable uniqueness, and
  complete hosted Auth/RLS/IdP matrix remain open.
- P2-S09-AC-266 (pre-release real-device gate, unchecked): owner-deferred
  because the required real devices are
  unavailable. Retain operator-attested VoiceOver/Safari and NVDA/Firefox
  manual smoke against the exact hosted candidate when devices are available;
  Linux-hosted automation cannot replace either real-platform report.

Operational controls outside the 283-item authored acceptance count are verified for
this candidate: fail-closed staging migration executed before app deployment,
immutable migration evidence retained, exact-main-SHA CI/staging/deployment
identity recorded, two consecutive production cron evaluations succeeded, and
the staging/production auth-provider catalog transport is healthy.
Slice 09 implementation is incomplete at **261/279 active** after the 2026-09-30
activation reopen (17 criteria, re-verified 2026-10-02) and the separately reopened AC250 Chrome-verified and closed 2026-10-01; all four deferred acceptance
gates remain open and mandatory. AC265 and AC266 must pass before production
readiness/release. AC209 must pass before alerting is declared ready, and AC211 is
mandatory after initial launch. None is passed, accepted, or waived. Slice 10
remains blocked by the reopened Slice 09 criteria.

## 2026-09-21 AC266 owner-deferred phase propagation

- The authored Slice 09 ledger remains **283 IDs**. Active Phase 2 completion
  excludes unchecked AC266: Slice 09 is **279/282 active**, and Phase 2 has
  **1,999 active criteria out of 2,000 authored**.
- AC266 remains owner-deferred because the required real devices are
  unavailable. It is excluded from active Phase 2 completion, but remains
  mandatory for post-Phase 2 production-readiness/release.
- AC211 run `35560241699` passed preflight but collection failed for insufficient
  samples (`commands=0`, `protectedRpcs=0`, `acceptances=0`,
  `queueFirstAttempts=0`); no artifact exists. AC209, AC211, and AC265 remain
  the only Slice 10 blockers. Slice 10 remains locked on those three criteria.

## 2026-09-21 AC265 CP-04a approved outage-target attestation

- Added the now-promoted service-role-only
  `ac265_approved_outage_target_read` RPC over the CP-01 approved-target rows.
  The read returns a redacted canonical target projection and the stored
  `targetSha256`; it does not seed a target or expose a hosted route.
- Added the strict canonical `ac265-approved-outage-target-v1` contract and a
  distinct domain-separated Ed25519 attestation binding the exact target bytes,
  target/reference, run-scoped hosting/Supabase/deployment/dependency/route
  scope, key ID, and validity window. The protected manual main/staging
  entrypoint and workflow, verifier, and policy require this signed target;
  callback authenticity injection is not accepted.
- Focused AC265 verification passes **54 files / 483 tests** with
  `pnpm type-check` green. Exact-runtime `pnpm validate` exits 0 with **549
  Vitest files, 4,366 passed + 1 intentional skip (4,367 total)**, 100%
  coverage, 101 functional Chromium checks, five production-built checks,
  green builds/bundle checks, and local API p95 **1.377056 ms**.
- After a clean reset, all `pnpm db:verify` components are green: **57 pgTAP
  files / 2,087 assertions**, database lint, and generated-type checks pass.
- Independent security review found no CP-04a blocker; a protected orchestrator
  remains a required trust boundary. PR #86 / exact-main SHA
  `4fa8691d24177d0a528335f3c3d06ef50d67d3a9`, CI `35597438023`, and staging
  workflow `35598236704` / deployment `6568074493` are green.
- No live target-signing key/configuration, seeded target or registry rows,
  retained target/attestation artifact, attestation workflow run, hosted
  browser matrix, independently authenticated receipt, or AC265 acceptance
  exists despite code promotion. At that checkpoint AC265 was open at
  **279/282 active** and Slice 10 was locked on AC209, AC211, and AC265; AC266
  remained unchecked and owner-deferred as the mandatory post-Phase 2
  production-readiness/release gate.
- See the [CP-04a verification record](../verification/2026-09-21-ac265-approved-outage-target-attestation.md).

## 2026-09-21 AC265 CP-04b approved outage-target registration (promoted private foundation)

- Added the local contract, bounded service-role-only RPC, and forward-only
  migration for owner-approved outage-target registration. The migration keeps
  immutable policy and registration ledgers empty; registration derives target
  scope from authenticated authorization/candidate context and server policy,
  binds exact correlation/idempotency references, and returns only a redacted
  registered envelope. No live policy or target is seeded and no hosted route
  is exposed.
- The RPC client suite passes **15 tests**; together with the registration
  contract/public-export tests this is **3 files / 24 tests**. The registration
  SQL passes **35 pgTAP assertions**, including direct registration-to-lease
  acquisition proving that the registered target remains valid for the exact
  CP-01 60-second lease. The separate two-connection concurrency proof passes
  **2 assertions**. The policy requires **exact 120-second target validity**,
  leaving a bounded 60-second acquisition window before the exact 60-second
  lease; future-dated or too-short policy windows return generic conflict.
- The CP-04b baseline `pnpm validate` passed **551 Vitest files, 4,387
  passed + 1 intentional skip**, with **13,143/13,143 statements, 9,850/9,850
  branches, 2,160/2,160 functions, and 12,224/12,224 lines** (100%). The
  evidence-map gate passed; Playwright passed **101 functional + 5 production-built
  Slice 09 real-route checks**. Builds, bundle budgets, and performance are
  green; API p95 is **1.491154 ms**. Fresh `pnpm db:verify` passed
  **59 pgTAP files / 2,124 assertions**, with database lint exiting 0 after **46
  longstanding warnings** (39 never-read, 6 unused, 1 immutable/stable) and
  generated database types matching. Architecture compile passed **1,632 nodes /
  10,125 edges** with 55 known lint issues. PR #88 implementation main SHA
  `52b66272e61331827c59ac1e169868474a2c09c8`, PR CI `35611484121`, exact-main
  CI `35612415141`, staging `35613284966`, and deployment `6570861931` are
  green. Promotion artifact `10645302055` has digest
  `sha256:12f05e8371586996dc413b85b75167934045f342091defff5197435b8b707782`;
  staging p95 was **32.589357 ms** and automated axe digest was
  `df2522f8512dcea587146f5bce43ad5232b94964d5048825ffdb745286dd772d`.
- CP-04b is promoted as code/staging evidence only and has no live
  policy/target, signing-key configuration, retained target/attestation/evidence
  artifact, hosted matrix, independently authenticated receipt, or AC265
  acceptance. Read-only AC209 verifier `35612514031` failed with
  `provider_graphql_error` after all preflight/protection/workspace gates and
  produced no effects or receipt. AC265 remains open at **279/282 active**;
  Slice 10 remains locked on AC209, AC211, and AC265. AC266 remains unchecked,
  owner-deferred, and mandatory at the post-Phase 2 production-readiness/
  release gate. See the [CP-04b verification
  record](../verification/2026-09-21-ac265-approved-outage-target-registration.md).

## 2026-09-09 external-evidence remediation update

- AC209: production configuration and scheduled evaluations remain healthy;
  no genuine threshold-triggered delivery receipt exists.
- AC211: run `34296129205` truthfully failed the complete 2026-09-08 UTC day
  for insufficient natural samples; count-only failure diagnostics are ready
  for the next eligible complete-day run after `2026-09-10T00:00:00Z`.
- AC265: one real Google hosted identity flow is proven. The remaining nine-role
  gate conflicts with the adult-only launch policy and deferred mandate scope.
  The prior Slice 13 attribution was incorrect: BE03a inherits authority from
  BE01; Slice 13 covers navigation. See the
  [source audit and scope proposal](../verification/2026-09-09-ac265-scope-conflict.md).
  Scope correction approved on 2026-09-09: deferred guardian/junior/business
  mandate cases require exercised denial; authorized cases and all ten scenarios
  remain mandatory. No identity grants were changed. Hosted execution remains open.
- AC266: exact-release axe/provider evidence collection is implemented and
  locally validated. Exact-main staging run `34362941970` on
  `a4a411d2edd3c83057392fd86f87c93fd72e220c` passed served-release,
  provider-version, hosted axe, and final axe binding, but published no
  verified candidate because natural API p95 was `526.912447 ms` against the
  locked `<500 ms` budget. The follow-up preserves the threshold and makes
  both CI/staging streamed JSON producers fail at source through `pipefail`
  with silent pnpm output. Signed
  VoiceOver/Safari and NVDA/Firefox reports remain required.
- AC266 follow-up: PR `44` merged as
  `54852db03394ae2763b3241c100837c0a229fe11`; exact-main CI
  `34367574498` passed. Staging `34368311674` passed its public contract probe
  but failed closed when an axe browser document observed a different release
  header during edge propagation. All three live canonical paths later served
  the exact SHA. The collector now retries only this redacted mismatch five
  times at three-second intervals with a fresh context, while all path/status/
  origin/navigation/axe failures remain immediate. Staging CLI verification
  now rejects any expected-release override that differs from `DEPLOY_SHA`.
- AC266 exact-main result: PR `45` merged as
  `8c319243c459017e3298c00c11a071671a0459d7`; CI `34373503215` and staging
  `34374213155` / deployment `6354008407` passed. Verified-candidate artifact
  `10113208945` binds all ten promotion gates, 34 migrations, and both staging
  Workers at 100% traffic to that SHA. Natural API p95 was `71.92763 ms` over
  20/20 samples with zero retries/errors. Retained Chromium axe evidence covers
  all three canonical paths with zero violations and zero Serious/Critical
  findings. AC266 stays open only because signed VoiceOver/Safari and
  NVDA/Firefox manual reports are still required; automated evidence is not a
  substitute.

Validated with Node `22.23.1` and pnpm `11.24.0`: 443 Vitest files, 3,308
passing tests plus one intentional skip, 100% coverage, 101 functional
Playwright checks, 5 production-built Slice 09 checks, builds, bundle budgets,
and performance smoke. Status remains **279/283**; Slice 10 remains locked.

## 2026-09-13 release-candidate hardening

- Added per-tab acting-context selector isolation, same-origin-only binding
  headers, canonical session/context verification, and metadata-free dependent
  surface invalidation for accepted, ambiguous, and revoked context changes.
- Bound CMS and private relationship reads/commands to the current tab. The
  relationship projection stays read-only until bounded canonical organization
  and membership pagination verifies the target/version; public ORG-02 remains
  anonymous. Live server-to-browser revocation publication is not claimed.
- Added audited bounded idempotency expiry cleanup and scheduled sweep handling,
  while preserving manual-review `noRetry` work. Added fail-closed AC265 hosted
  prerequisite validation without claiming a hosted matrix run.
- `pnpm db:verify` passed 50 files and 1,818 assertions. Full `pnpm validate`
  passed 478 Vitest files, 3,699 tests plus one intentional skip, 100% coverage,
  all executable Slice 09 evidence checks, 101 functional and 5 production-built
  browser tests, builds, bundle budgets, and performance smoke.

AC209, AC211, AC265, and AC266 remain externally open. Status remains
**279/283**; Slice 10 and dependent Slices 11–17 remain locked pending genuine
hosted/manual acceptance evidence.

## 2026-09-13 AC266 manual-evidence prerequisite hardening

- Added strict `ac266-manual-a11y-v1` report contracts for the two locked
  platform pairs. Reports require the exact authenticated and authorized CMS
  workbench path/state, matching OS/browser/screen-reader product families,
  UTC timestamps, opaque operator IDs, all 11 structured checks, explicit
  heading/status observations, and operator-attested complete target
  measurements. Free-text notes and unknown fields fail closed.
- Added protected intake and finalizer workflows for digest-bound report
  secrets. Raw report bytes exist only in a run-ID/run-attempt-specific private
  runner-temp directory; cleanup runs in the implementation and an `always()`
  step. Only sanitized 30-day manifests are uploaded.
- Bound finalization to the exact repository, workflow, main SHA, staging run
  and attempt, candidate artifact, deployment, hosted origin, and trusted
  intake cutoff. Real GitHub deployment histories with
  `waiting`/`queued`/`in_progress` are parsed, while any newer active,
  failed, inactive, or successful deployment overlapping a report window
  rejects the evidence.
- Moved both report-secret jobs to isolated GitHub-hosted `ubuntu-24.04`
  runners. The three project self-hosted runners are persistent and continue
  to execute same-repository PR CI, so they are not an acceptable boundary for
  these raw report secrets.
- Created protected environment `ac266-manual-evidence` (ID `21821361680`)
  with the exact staging origin, `main`-only policy, required business-account
  reviewer, and administrator bypass disabled. Owner self-approval remains
  possible in the single-account repository and is not independent review.
- The dedicated AC266 manifest is a prerequisite, not the combined release
  sidecar. The current combined verifier still requires the exact source report
  bytes to be privately re-materialized, parsed, matched to the manifest, and
  removed by a protected assembly step.
- Clean Node 22.23.1/pnpm 11.24.0 verification passes 486 Vitest files,
  3,785 tests plus one intentional skip, 100% statement/branch/function/line
  coverage, every executable Slice 09 evidence check, 101 functional and five
  production-built browser tests, builds, bundle budgets, and performance
  smoke. `pnpm db:verify` separately passes 50 pgTAP files and 1,818 tests with
  migrated database-type parity.

Earlier dated entries use “signed” as shorthand for manual sign-off. No
cryptographic report signature exists; the implemented boundary uses an opaque
operator attestation, exact byte digests, protected workflow provenance, and
environment approval.

No VoiceOver/Safari or NVDA/Firefox report was created, accepted, or inferred,
and no protected AC266 workflow was dispatched. AC266 is owner-deferred and
remains unchecked; Slice 09 remains **279/283** with depth ratio **0.986**, and
Slices 10–17 remain dependency-locked.

## 2026-09-13 AC209 zone-diagnostic follow-up

- AC266 prerequisite hardening merged as exact main SHA
  `47b5ff2ca788f4470254c0161e636246719b98da`. CI `34749050376` and staging
  `34749287577` / deployment `6419900767` passed, and the verified-candidate
  artifact now contains the exact staging run/attempt identity sidecar.
- Reconciled live `ac266-manual-evidence` environment `21821361680` after
  detecting administrator-bypass drift. Administrator bypass is again disabled;
  reviewer `WeJustJammin`, owner self-review, and the sole custom `main` branch
  policy remain intact. No AC266 report secret or manual report exists.
- Protected production attempts `34749383380` and `34749687614` used that
  exact candidate. Both passed immutable promotion identity and protection
  preflight plus explicit production-environment approval, then failed closed
  at `Verify Cloudflare observability permissions` with sanitized
  `provider_graphql_error`. Migrations, release-evidence verification, Worker
  deployments, and production health checks did not run; production remains
  on `c8f0cbd52cb6140ee1a756f106fa329f8c23b0e2`.
- TDD now classifies bounded HTTP-200 GraphQL error messages without retaining
  provider detail: explicit authentication/authorization phrases map to
  `provider_permission_denied`, fixed query/schema/resource phrases map to
  `provider_resource_unavailable`, and mixed, unknown, or oversized messages
  remain `provider_graphql_error`. Schema classification precedes permission
  matching so a field named `forbidden` cannot be misclassified. RED reproduced
  five original classification gaps, the authentication gap, and the schema
  precedence gap; GREEN passes 64 focused collector tests and 124 related
  AC209/Cloudflare tests. Independent adversarial review found no remaining
  P0–P2 issue.
- Final Node 22.23.1/pnpm 11.24.0 `pnpm validate` passes 486 Vitest files,
  3,789 tests plus one intentional skip, 100% coverage, all executable Slice 09
  evidence checks, 101 functional and five production-built browser tests,
  builds, bundle budgets, and API p95 smoke (`1.669135 ms`). `pnpm db:verify`
  passes 50 pgTAP files / 1,818 tests with migrated type parity.

No acceptance item is inferred from diagnostics. AC209 still requires the
effective zone-scoped token and genuine delivery evidence; AC211, AC265, and
AC266 remain open. Slice 09 remains **279/283** with depth ratio **0.986**, and
Slices 10–17 remain dependency-locked.

## 2026-09-13 AC209 production attempt 2

- Exact main SHA `5c1af8cb7be676ec3e0bca4be5f28ceb91aeb776` passed CI
  `34751474024` and staging `34751910125`.
- Protected production run `34752000687`, attempt 2, was approved and then
  failed closed at the Cloudflare Email Sending capability check before any
  migration or deployment. Production remains unchanged on
  `c8f0cbd52cb6140ee1a756f106fa329f8c23b0e2` / deployment `6417116181`.
- Cloudflare Email Sending domain onboarding/DNS remains required. No genuine
  provider/mailbox receipt or production mutation occurred; AC209 remains open.

## 2026-09-13 AC265 hosted contract hardening (local only)

- Added local `ac265-hosted-runner-v1` contract guidance for immutable candidate
  identity, trusted run bounds, exact role/scenario mappings, authenticated
  receipts, isolation, redaction, and bounded cleanup. The contract explicitly
  does not authorize or prove hosted execution.
- Hardened the report/receipt temporal contract to require caller-supplied
  maximum run duration, keep the report within that bound, constrain each
  receipt's `issuedAt` to the execution window and trusted cutoff, and require
  the cleanup receipt to be issued at or after cleanup completion.
- Focused temporal-coherence suite passes 68/68 tests, including per-receipt
  window/cutoff checks and inclusive cleanup/report-end boundaries. This is
  local contract verification only: no protected hosted runner, complete
  9-role/10-scenario report, or AC265 acceptance is claimed.
- Final AC265/retained-evidence suite passes 22 files / 201 tests after
  adversarial review. Full `pnpm validate` passes 507 Vitest files / 3,981 tests
  plus one intentional skip at exact 100% coverage, all executable Slice 09
  evidence gates, 101 functional plus five real-Slice-09 Playwright checks,
  builds, bundle budgets, and performance smoke. Separate database verification
  remains green at 50 pgTAP files / 1,818 tests with type parity.

## 2026-09-23 AC265 CP-02 registry registration transport (plumbing only, unmerged)

This is an isolated worktree feature branch (`codex/ac265-cp02-registry-population`
from `origin/main`); nothing here is pushed, merged, or deployed, and no registry
row, identity, or grant is created.

Independent security review found a policy blocker, so this work is now
described honestly as registration transport/plumbing only. CP-02 (unlike
CP-04b) pins no approval policy table, so a `workflow_dispatch` request body
plus the currently unreviewed `staging` environment does NOT prove
owner-approved safe resources or mapping. The owner-approval binding for the
CP-02 population gate remains OPEN; this commit does not close it and is not
acceptance evidence.

- Added the missing TypeScript register transport for the already-promoted
  CP-02 migration. No migration and no contract change: the strict
  `ac265-hosted-approved-registry-control-v1` schemas are consumed as-is, so
  `contracts:check` is unaffected.

```text
infra/workflows/ac265-approved-registry-registration-rpc.ts   (new bounded service-role client; transport only)
infra/workflows/register-ac265-approved-registry.ts           (new manual registration entrypoint; owner-approval binding open)
tests/ac265-approved-registry-registration-rpc.test.ts        (new, RED-first)
tests/ac265-approved-registry-registration-entrypoint.test.ts (new, RED-first)
tests/ac265-approved-registry-registration-workflow-contract.test.ts (new)
.github/workflows/register-ac265-approved-registry.yml        (new, main-only/staging; transport only)
```

- The bounded service-role client POSTs only the strict register request to
  exactly `ac265_approved_safe_resource_register` or
  `ac265_approved_runner_mapping_register` at `https://<projectRef>.supabase.co`
  (`^[a-z0-9]{20}$`), with printable secret <= 8192, `redirect: 'error'`,
  `cache: 'no-store'`, a 64 KiB streamed response cap, content-length rejection,
  fatal UTF-8 decoding, a fixed 10-second abort deadline, duplicate-member
  rejection, awaited body cancellation, and one generic failure per RPC.
- The register results have no `status` field (unlike CP-04b): success is bound
  by echoing `authorizationRef`, `idempotencyRef`, `environment === 'staging'`,
  `hostingProjectId === 'wejammin-staging'`, `supabaseProjectRef === projectRef`,
  and `redacted === true`, plus `locatorSha256` and `resource.kind` for the
  safe-resource result and a full role/scenario mapping-to-resources re-binding
  for the mapping result. Any `{status:'conflict'}` response fails generically.
- The registration entrypoint reads only `$RUNNER_TEMP/ac265-registry-registration-request.json`
  (<= 32 KiB, strict schema, safe path/realpath checks), requires the full
  registration environment, and appends only the server-derived resource reference
  and kind, or the mapping id, to `GITHUB_OUTPUT` and `GITHUB_STEP_SUMMARY`.
- The workflow is manual-only (`workflow_dispatch`), main-only
  (`if: github.ref == 'refs/heads/main'`), `runs-on: ubuntu-24.04`,
  `timeout-minutes: 10`, `environment: staging`, `permissions: { contents: read }`,
  pinned `actions/checkout` SHA, and uses `.github/actions/setup`. It needs no
  signing key; `SUPABASE_SECRET_KEY` already exists in `.github/SECRETS.md`.
- RED proof: both new test files first failed with `Cannot find module` before
  the client and entrypoint existed. GREEN (actual completed local runs, not
  aspirational): RPC client 20 tests, entrypoint 8 tests, workflow contract 6
  tests — 34 new tests, and 49 across those three plus the untouched CP-04b
  client suite. These ran in this worktree at 01:51–01:59 local on the pinned
  workspace; a confirming focused re-run after the Prettier reformat
  (`--maxWorkers=1`, 02:17 local, after the concurrent PR #96 CI coverage gate
  ended) again reported 3 files / 34 tests passed. Prettier and ESLint are clean
  on the new files. Full `pnpm validate`/Playwright remain deliberately unrun to
  avoid host contention, per operator direction.
- Boundary: this transport registers only opaque, server-derived registry rows
  behind the existing forced-RLS/service-role RPCs. It does not seed identities,
  mandates, grants, or resources, does not verify underlying resource safety or
  owner approval, mints no receipt or attestation, and provides no hosted
  runner. It closes no AC265 criterion and is not acceptance evidence.

## 2026-09-23 AC265 CP-02 owner-approved population gate (local only, unmerged)

Independent security review found that a dispatched request body plus the
unreviewed `staging` environment does not prove owner-approved safe
resources or mapping, and CP-02 (unlike CP-04b) pinned no approval policy. This
adds an Option A forward-only, fail-closed approval gate so the registry RPCs
cannot be used as a population path until an owner-approved policy exists.

- New forward-only migration `20260923090000_ac265_approved_registry_population_gate.sql`
  creates three EMPTY private pinned policy tables
  (`ac265_approved_registry_resources`, `ac265_approved_registry_role_kinds`,
  `ac265_approved_registry_scenario_roles`: forced RLS, no direct grants,
  immutable insert-only, guard function revoked from every runtime role).
  It redefines `platform_api.ac265_approved_safe_resource_register(jsonb)` and
  `platform_api.ac265_approved_runner_mapping_register(jsonb)` with
  `create or replace` to require EXACT SET EQUALITY against those pins,
  bidirectionally, before any registry insert. The strict
  `ac265-hosted-approved-registry-control-v1` contracts are unchanged; no
  server-derived field is invented.
- It seeds no owner row, value, resource, identity, grant, or mandate. With the
  tables empty both RPCs fail closed and return only the generic
  `{"status":"conflict"}` sentinel, so the owner-approval binding remains
  OPEN. The gate is enforced inside the RPCs rather than by a row trigger
  because the register contract exposes only the conflict sentinel.
- Design decision (flagged): the pin is staging-wide (one locator digest per
  kind), following CP-04b's single-pinned-policy-reference pattern; there is no
  per-authorization dimension. The existing pgTAP suites were updated
  accordingly: `ac265_approved_runner_registry.sql` seeds the disposable pins
  (locators 1..4), and `ac265_approved_runner_registry_concurrency.sql`
  normalizes its per-authorization locator sets to that single pinned set and
  seeds the pins as the superuser fixture connection (never through
  service_role).

- Security-review correction: the first gate draft mixed a 1-column kind branch
  with 2-column role/scenario branches under one `UNION ALL`, which is
  invalid SQL (42601) rather than a conflict. The mapping gate is now three
  SEPARATE equal-arity bidirectional `EXCEPT` predicates (a: kind, one column;
  b: role-to-kind, two; c: scenario-to-role, two), verified programmatically to
  have uniform select arity within each predicate. The pgTAP suite also proves
  the missing-policy mapping case (all pins removed) returns only the conflict
  sentinel and writes no registry parent.
- `approval_ref` is documented as an opaque, documentation-only
  owner-approval locator: it is not an independently verified signature and
  grants no safety. Pins deliberately carry no time validity because they are
  immutable; expiry would require a further owner-approved forward migration.
  The pin proves only that a submitted digest equals a pinned digest, not that
  the underlying resource is real, synthetic, or safe.
- New pgTAP suite `ac265_approved_registry_population_gate.sql` proves the
  boundary: table/RLS/grant/immutability shape, fail-closed with no pins, a
  matching (kind, locator) registering, a non-pinned locator failing closed, a
  mapping equal to the pins registering, and drift in either direction (wrong
  role kind, missing scenario member) rejected by the gate with only the
  sentinel. Drift cases use fresh idempotency refs so the gate, not replay,
  rejects them.
- NOT YET RUN: the local Supabase stack was reserved by the parent's validation
  and then by PR #96 CI on this shared host, so `pnpm db:verify`/pgTAP and
  `db:types:check` are pending operator release. Expected follow-up once
  free: apply the migration, run `pnpm db:verify`, and regenerate
  `packages/data-access/src/database.types.ts` (the new private tables make
  the committed types stale, exactly as CP-04b's migration required). Closes no
  AC265 criterion; no hosted acceptance is claimed.
  AC209, AC211, AC265, and AC266 remain open. Slice 09 stays **279/283** with
  depth ratio **0.986**; Slices 10–17 remain dependency-locked.

## 2026-09-23 AC265 CP-04f frozen run-manifest contract and builder (local/private only)

- Adds the bounded frozen run-manifest contract `ac265-hosted-run-manifest-v1`
  at `packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-run-manifest.ts`
  and its fail-closed builder at `infra/workflows/ac265-hosted-run-manifest.ts`.
  The manifest carries exactly the membership the runner contract names: the
  version, criterion, runner contract version, run ID, run correlation ID,
  immutable candidate identity, the nine role-matched `ac265-session://`
  references, the four approved `ac265-resource://` references, and the bounded
  control policy. It carries no session state, credentials, resource contents,
  or mappings.
- Session and resource references reuse the existing locked schemas rather than
  re-declaring them, so role alignment, nine-way distinctness, exactly-one-per
  locked resource kind, and v4 staging shapes are enforced by the same rules as
  the runner contract. The builder additionally re-derives every reference's
  lowercase SHA-256 digest and fails closed on drift, then emits canonical
  code-point-ordered UTF-8 bytes, a manifest SHA-256, and the exact canonical
  runner-contract bytes plus their SHA-256 for the retained V3 binding.
- Red→Green: the two new suites (`phase-02-slice-09-ac265-hosted-run-manifest-contract`
  and `-builder`) pass 12 tests covering pinned versions, missing/extra/duplicated
  role and resource references, role-mismatched and digest-mismatched references,
  control-policy bound violations, sensitive-member rejection, canonical
  byte-stability under member reordering, and the absence of any approval,
  attestation, broker, or mapping-resolution surface.
- Open contract reading requiring owner confirmation: the runner contract names
  a run correlation ID in the manifest but no AC265 module defines its format or
  source. This slice binds it as a UUID supplied by the protected orchestrator
  and never derives it from the run ID. Confirming that reading (or defining a
  different source) is a documented decision, not an inferred semantic.
- Verification is focused only: pinned Node 22.23.1 / pnpm 11.24.0 focused
  Vitest, `pnpm type-check`, ESLint on changed files, Prettier, and
  `pnpm progress:check` pass. Full `pnpm validate`, `pnpm db:verify`, and the
  broader contract suite are deferred to avoid contending for the shared local
  database and host with the CP-02 agent, and no hosted, provider, or
  acceptance evidence is claimed.
- This is local/private construction only. It establishes no protected session
  broker, approval source, hosted runner, receipt, report, or AC265 acceptance;
  AC265 and Slice 10 remain exactly as open and locked as before.

### 2026-09-23 independent-review fixes (CP-04f H1/H2)

- **H1 canonicalization defect (fixed).** The first cut sorted object members but
  left array elements untouched, so reordering the four safe resource references
  or any scenario's role list produced a different `runnerContractSha256` and
  `manifestSha256` for the same logical contract, contradicting the
  byte-stability claim. A RED test that reverses `resourceRefs` now passes:
  canonicalization normalizes exactly the two collections the locked contract
  treats as sets — `resourceRefs` to the locked resource-kind declaration order
  and each `scenarioRoleBindings[scenario]` list to the locked role declaration
  order — so one logical contract yields one digest.
- Normalization deliberately excludes ordered sequences. `roleResourceBindings`
  arrays, the session-handle record, and the resource-reference record are left
  in caller order because the V3 verifier deep-compares them against the
  independently attested `ac265-approved-runner-mappings-v1` bytes. Only the
  two set-like collections are reordered, and no role or scenario key is added,
  dropped, or renamed.
- **H2 mutable-byte defect (fixed).** The build result previously exposed
  `manifestBytes`/`runnerContractBytes` as the held `Buffer` instances, so a
  caller could mutate bytes after the digests were computed and silently break
  integrity; `Object.freeze` cannot be used on a non-empty `Buffer` with
  elements. The result now exposes `manifestBytes()`/`runnerContractBytes()`
  copy-on-read accessors returning caller-owned `Uint8Array` values. A RED test
  mutates every byte of both returned buffers and proves the published digests
  and subsequent reads are unchanged.
- **Documented limits.** `correlationId` is a non-authority correlation label:
  the schema accepts any UUID version, including nil and v1, so it is neither a
  v4 identifier nor asserted unique, and it carries no anti-replay, ordering,
  binding, or ownership meaning. `controls` carries the shared bounded control
  schema only; pinned policy values are enforced by the separately versioned
  `ac265-hosted-runner-policy-v1` comparison at verification time, not by this
  builder.
- **Verifier compatibility, bounded claim.** The builder emits
  `runnerContractBytes` as the exact canonical UTF-8 bytes it digests, and
  `runnerContractSha256` binds those same bytes, matching what the retained
  verifier hashes via `sha256Bytes(runnerContractBytes)`. This does not claim V3
  integration: the retained V3 path parses raw protected bytes supplied by
  trusted context, and wiring this builder into it is a separate step.
- Re-verified with pinned Node 22.23.1 / pnpm 11.24.0: 15 focused tests across
  both suites, `pnpm type-check`, ESLint `--max-warnings=0`, and Prettier. Full
  `pnpm validate` and `pnpm db:verify` remain deferred while the CP-02 agent
  holds the shared local database and host.

### 2026-09-23 re-review fixes (CP-04f H1c and scenario-order over-normalization)

- **V3 compatibility blocker (fixed).** The H1 fix over-reached: it normalized
  each `scenarioRoleBindings[scenario]` array to locked role declaration order,
  but `assertAc265HostedRunnerPolicyV1` compares those arrays to the
  independently attested `ac265-approved-runner-mappings-v1` bytes with
  `isDeepStrictEqual`, which is position-sensitive on arrays. A legitimate
  approval whose array read `[owner_full, entitled_read, ...]` was rewritten to
  `[entitled_read, owner_full, ...]`, so the verifier rejected a correct
  contract. Scenario-order normalization is removed entirely.
- `scenarioRoleBindings` and `roleResourceBindings` are now both left untouched.
  Their element order is approval-source-significant, so a reordered sequence is
  a different mapping and must move the digest instead of being normalized to
  match; there is no canonical set normalization for those collections. Only
  `resourceRefs` is normalized, and it remains order-stable.
- **H1c (fixed).** Bytes and digest were computed from a normalized copy while
  the returned frozen `manifest` retained the caller's original reference order,
  so `sha256(canonicalManifestBytes(result.manifest))` did not reproduce
  `manifestSha256` for reversed input. The builder now parses the normalized
  candidate and returns that same frozen object, so the returned manifest, the
  published bytes, and the digest describe one value.
- RED first: a rehash-under-reversed-references case failed with mismatched
  digests, and a reversed-scenario case failed because the digest did not move.
  Both now pass, and the scenario test additionally asserts the scenario order
  is retained verbatim in the canonical bytes and that the digest changes.
- Re-verified with pinned Node 22.23.1 / pnpm 11.24.0: 16 focused tests across
  both suites, `pnpm type-check`, ESLint `--max-warnings=0`, Prettier, and
  `pnpm progress:check`. Full `pnpm validate` and `pnpm db:verify` remain
  deferred while the CP-02 agent holds the shared local database and host.

### 2026-09-23 dedicated staging test accounts - owner decision recorded

- The owner decided on 2026-09-23 to provision dedicated staging test accounts
  for the nine locked AC265 roles. The decision and its unresolved gates are
  recorded in the
  [AC265 dedicated staging test accounts decision record](../verification/2026-09-23-ac265-dedicated-staging-test-accounts-decision.md).
  Nothing was provisioned and no criterion moved.
- Open gates recorded there: the Cloud Identity Free vs existing Google org
  choice is pending, the 2026-09-10 sole-admin-principal decision still governs
  privileged admin test identity and is not superseded, the separate async
  question on that privileged identity is unanswered, and the Chrome browser
  bridge is unavailable on this host. No credential, identity, grant, tenant, or
  resource was created.

### 2026-09-23 AC265 run-manifest read-side boundary (CP-04g, local/private only)

- Adds the missing read half for the frozen run manifest. The builder could emit
  canonical bytes and a digest, but nothing could read a manifest back from
  bytes, so a hosted consumer would have had to hand-roll a loose parse.
- `infra/workflows/ac265-hosted-run-manifest-crypto.ts` now owns one canonical
  form and one parse boundary: `parseAc265HostedRunManifestV1Bytes` rejects
  non-bytes, empty, and over-64 KiB input, duplicate JSON object members, schema
  drift, and any encoding that is not already canonical;
  `canonicalizeAc265HostedRunManifestV1` canonicalizes a value;
  `canonicalAc265HostedRunManifestBytes` and
  `canonicalAc265HostedRunnerContractBytes` produce canonical bytes;
  `verifyAc265HostedRunManifestSha256` binds a digest fail-closed; and
  `readAc265HostedRunManifestV1Bytes` is the digest-bound read entrypoint, so a
  consumer cannot read manifest bytes without proving them against the expected
  digest.
- The builder consumes the shared module instead of its own private copies, so
  the build and parse sides cannot drift. `lockedOrder`, the resource-reference
  normalization, the code-point canonical serializer, the digest helper, and the
  reference-digest checks now exist once. The builder re-exports
  `AC265_HOSTED_RUN_MANIFEST_MAX_BYTES`, `canonicalManifestBytes`, and
  `sha256Bytes` so existing imports are unaffected.
- Order semantics are pinned in the new suite. Only `resourceRefs` is
  order-insensitive, matching the V3 verifier's keyed-map read; a reversed
  resource set yields one digest in both the manifest and runner-contract byte
  paths. Approved `scenarioRoleBindings` order stays significant because the V3
  verifier deep-compares it against the independently attested
  `ac265-approved-runner-mappings-v1` bytes, so a reordered approval moves the
  runner-contract digest instead of being normalized to match.
- Exported canonical byte functions return a fresh plain `Uint8Array`, not a
  `Buffer` and never a retained internal alias, so a caller cannot mutate bytes
  after the digest was computed.
- Focused evidence: 3 files / 26 tests pass, covering 10 new read-boundary cases
  plus the existing builder and contract suites; ESLint `--max-warnings=0`,
  Prettier, and `pnpm progress:check` are clean under pinned Node 22.23.1 /
  pnpm 11.24.0. Full `pnpm validate` and `pnpm db:verify` remain deferred while
  PR #98 CI and the main/staging chain own the shared runner.
- Chronology note: the test file was authored before the implementation module,
  but an independent reviewer's focused run found 3/10 failures from `Buffer`
  versus `Uint8Array` equality and one over-generic expected error message. A
  passing pre-fix run was therefore never observed, so this record does not claim
  an observed RED; the failures were test and format integration defects rather
  than missing behavior.
- This is local/private construction only. No report-v3 contract change, no
  seeded identity, resource, grant, or registry row, and no hosted acceptance.
  The external gates listed in the decision record above are unchanged.

### 2026-09-23 AC265 CP-04h retained-report producer and redactor (local/private only)

- Adds the missing producer half of the retained-report path. Until now the
  repository could assemble a V3 report in memory and verify one from bytes,
  but nothing could publish the report the verifier reads. This adds the
  integrated producer plus the value-level redaction boundary it uses.
- `infra/workflows/ac265-retained-report-producer.ts` exposes the single
  production entrypoint `produceAc265RetainedHostedE2eReportV3({ assembly,
provenance, reportRoot, declaredReportPath })`. It calls the existing
  `assembleAc265HostedE2eReportV3` with the caller's exact runner-contract
  bytes, authenticated artifact resolver, and receipt references; serializes
  the assembled report exactly once into the retained byte form; derives every
  trusted receipt/evidence digest by resolving each reference through the
  resolver and hashing the returned bytes; then redacts, binds, and publishes
  those exact bytes. The published digest is SHA-256 over the bytes written, not
  over a canonical re-serialization, so the digest the retained verifier checks
  describes the artifact on disk.
- `infra/workflows/ac265-retained-report-redactor.ts` is the value-level
  boundary: provenance parsing with field-aware structural classes, the strict
  `ac265-hosted-e2e-v3` schema, provenance equality for every identity field /
  receipt slot / session digest / resource binding / window, and a focused
  prohibited-content pass over decoded member names and string leaves. There is
  deliberately no global high-entropy scan: the contract's own UUIDs,
  revisions, and digests are high-entropy by design and a secret can be shaped
  to match a digest, so structure plus provenance plus vocabulary is the guard.
- Supporting modules keep each file inside the 300-line utility cap and give
  the boundary one owner each: `-provenance.ts` (trusted facts, identity
  classes, reference patterns), `-binding.ts` (report-to-facts equality),
  `-prohibited-content.ts` (marker vocabulary), `-trusted-digests.ts`
  (resolver-derived digests), `-writer.ts` (exclusive atomic publication), and
  `-publication.ts` (the narrow byte-level boundary). The byte-level function is
  not exported from the producer: it lives in the explicitly named publication
  module, carries no assembler/broker/resolver, and requires complete trusted
  provenance, so there is no producer-named path that skips authentication.
- Redaction binding is layered and fails closed with one opaque message, so a
  rejection never echoes the material it rejected. Enforced: identity equality
  plus field classes (`ciRunId`/`stagingRunId` numeric, `deploymentId` numeric
  or `deployment-<n>`, `buildId` `ci-<n>[-<attempt>]`/`build-<n>[-<attempt>]`,
  `hostingProjectId` pinned `wejammin-staging`); slot-exact receipt refs AND
  digests (candidate, each role, each scenario, cleanup) so swapping two refs in
  the same run fails; session-handle and resource ref/digest equality against
  the authenticated runner contract, so a forged digest cannot stand in as
  proof; contract bytes bound to an externally trusted digest recomputed from
  those exact bytes; the report window inside deployment and trusted-cutoff
  bounds; and duplicate-JSON-member rejection on the raw bytes before
  `JSON.parse`. Cleanup is required to finish inside the window, not equal to
  `completedAt`, matching the locked schema.
- Publication is exclusive and idempotent: an owner-only (`0600`) temporary
  file in the destination directory, `link` publication that cannot replace an
  existing or racing destination, a post-publish readback confirming the
  destination holds exactly the intended bytes, an existing report with
  identical bytes treated as a no-op, an existing report with different bytes
  rejected, root and every existing path component rejected if symlinked,
  missing directories created `0700`, existing files bounded and read with
  `O_NOFOLLOW|O_NONBLOCK` plus an `fstat` regular-file check and the 10 MiB cap,
  and temporary artifacts removed on every failure path. Validation runs before
  any directory is created, so a rejected report leaves no artifact behind.
- RED/GREEN honesty: the first RED run failed only as module-not-found for both
  new suites, so that run proves absence, not behavior; a later run surfaced
  three genuine behavioral failures (a marker vocabulary that missed bare
  `Bearer`, identity free-form slots that admitted a person name, and an
  integration test that needed the full retained tree). This record therefore
  does not claim a clean behavioral RED. Four independent review rounds then
  found real defects, each fixed with a regression test: deployment IDs falsely
  rejected because the class demanded an alphabetic prefix; receipt binding
  reduced to set membership so two swapped refs passed; receipt/evidence
  digests only syntax-checked so a fabricated 64-hex value passed; cleanup
  equality stricter than the contract; and trusted session/resource digests not
  cross-checked against the authenticated contract.
- Focused evidence: 5 files / 60 tests pass, including the integrated
  assemble→derive→redact→bind→write path checked by the existing
  `verifyContentSchemaRegistryRetainedReports`, a sidecar-declared path that is
  not `hosted/e2e.json`, root-contains-only-the-declared-path, symlinked root /
  destination / intermediate directory rejection, an oversized existing report,
  a racing destination, and forged-digest and swapped-slot rejections. Under
  pinned Node 22.23.1 / pnpm 11.24.0, full `pnpm validate` passed with a
  verified exit status of 0 (captured with `set -o pipefail`): 587 test files,
  4826 passed + 1 skipped / 4827, 100% coverage (13,262 statements, 9,890
  branches, 2,174 functions, 12,340 lines), S09 evidence 7 passed, Playwright
  101/101 functional and 5/5 real-route, build and bundle budgets passed, and
  local API p95 1.366 ms against the 500 ms threshold. The local Supabase stack
  was started for this validation (migrations through `20260923090000`).
- Caller requirement recorded, not assumed: the CP-04f canonical builder emits
  code-point-ordered runner-contract bytes whose digest differs from the
  insertion-ordered `JSON.stringify` bytes used by the test harness for the same
  contract. The producer binds the trusted digest to the exact bytes supplied
  (`sha256Ac265RetainedReportBytes(runnerContractBytes)`), so the protected
  caller must pass the canonical bytes together with the digest of those same
  canonical bytes — exactly what the retained verifier hashes from its trusted
  context. A regression test documents the two forms and their differing
  digests.
- This is local/private construction only. No hosted acceptance, session
  broker, receipt issuer, evidence service, fault-control plane, or reseeded
  registry is added or implied; no identity, credential, resource, or grant was
  created; no AC265 criterion is closed and no contributor count moves. Totals
  remain 279/282 active (283 authored IDs), Phase 2 8/17, and 1,999/2,000 active
  criteria; AC209, AC211, and AC265 remain open, Slice 10 remains locked, and
  AC266 remains owner-deferred as the mandatory post-Phase 2
  production-readiness/release gate.

### 2026-09-23 AC265 run-manifest producer-side integration (CP-04i, local/private only)

- Closes the producer-side gap left open by CP-04f/CP-04g: the frozen
  `ac265-hosted-run-manifest-v1` builder and its digest-bound read boundary
  existed, but nothing in the retained V3 path imported them, so the protected
  run manifest could not reach the report producer at all.
- `infra/workflows/ac265-retained-report-run-manifest.ts` is the new binding
  owner. `parseAc265RetainedReportRunManifest` reads the manifest through the
  CP-04g `readAc265HostedRunManifestV1Bytes` boundary, so the bytes must hash to
  the independently trusted digest and must already be the CP-04f canonical
  form: duplicate members, schema drift, and insertion-ordered members fail
  closed instead of being quietly re-canonicalized onto a different digest. The
  bytes are snapshotted before verification and the digest is recomputed over
  that snapshot, so a caller mutating its array afterwards cannot change what
  the digest and the manifest describe. Membership (`criterion`,
  `contractVersion` against `schemaVersion`, `runId`, `identity`,
  `sessionHandles`, `resourceRefs`, `controls`) is then deep-compared against
  the runner contract parsed from the same `assembly.runnerContractBytes` the
  report is assembled from, so the two artifacts cannot validate each other and
  a manifest for another run, candidate, session set, resource set, or control
  policy is rejected even though it is internally valid.
- `produceAc265RetainedHostedE2eReportV3` now requires `runManifestBytes` and
  `expectedRunManifestSha256` in its strict key set, binds the manifest before
  assembly and before any directory is created, and returns `runManifestSha256`
  plus a copy-on-read `runManifestBytes()` accessor. A caller recomputing
  SHA-256 over the returned bytes reproduces the published digest, which is the
  regression the new suite pins. No criterion closes; no verifier, report
  schema, or contract module changed.
- Red→Green: the new suite
  `tests/contracts/phase-02-slice-09-ac265-retained-report-run-manifest.test.ts`
  covers the digest-equality canary, absent bytes/digest, insertion-ordered
  rejection (proving canonicalization is not silently applied), malformed
  digests, run/identity/session-reference drift, unknown request fields,
  byte-snapshot immutability, and that a rejected binding leaves no report on
  disk. Two of the first three failures were test-construction defects rather
  than absent behavior and were fixed; a scratch probe then confirmed the
  legacy four-key request still published while any manifest-bearing request
  threw, so the remaining RED proved the missing behavior rather than a harness
  fault. The scratch file was removed and is not part of the change.
- Full `pnpm validate` on the final tree passed with a verified exit status of
  **0** (pinned Node 22.23.1 / pnpm 11.24.0, `set -o pipefail`): **589 test
  files, 4834 passed + 1 skipped / 4835**, 100% coverage (13,262 statements,
  9,890 branches, 2,174 functions, 12,340 lines), S09 evidence 9 groups / 46
  passed with 5 skipped, Playwright **101/101 functional** and **5/5
  real-route**, build and bundle budgets passed, and local API p95 **1.751 ms**
  against the 500 ms threshold. The local Supabase stack was started for this
  validation, migrations through `20260923090000`.
- Browser policy: the repository's Playwright configs select
  `devices['Desktop Chrome']` without a `channel`, which launches Playwright's
  bundled Chromium rather than system Google Chrome. The first full run was
  stopped at the E2E stage for that reason and is not evidence; a second run hit
  a `127.0.0.1:8787` port collision with a concurrent agent's E2E server and
  executed zero E2E tests. The conclusive run used a temporary local
  `channel: 'chrome'` override in both configs and was verified at the process
  level to use `/opt/google/chrome/chrome` (Google Chrome 154.0.8037.57). Both
  overrides were reverted with `apply_patch` afterwards and are absent from this
  change; `git diff` for both config files is empty.
- Contract reading recorded, not inferred: the run manifest is a protected
  caller input because the locked `ac265-hosted-e2e-v3` schema is strict and
  carries no manifest member, so binding it into the report body would have
  meant a contract change. The manifest's correlation ID remains
  caller-supplied and is deliberately not part of the cross-binding.
- Independent-review fixes: `resourceRefs` is now compared through the same
  kind-keyed normalization the CP-04f builder applies, because the locked
  schema defines that collection as a four-element set rather than a sequence —
  the previous raw-order comparison wrongly rejected a valid contract that
  listed the same four references in another order (RED reproduced by disabling
  the fix). The stale pre-manifest `Ac265RetainedReportProductionResult` alias,
  which had no importers, was removed. Both byte inputs are now bounded by the
  existing `MAX_RETAINED_REPORT_BYTES` cap before parsing instead of decoding an
  oversized contract first. Re-verified: 12 tests in the suite, 5 files / 40
  tests focused, 108 files / 929 passed in `tests/contracts`, ESLint, Prettier,
  `tsc --build`, `progress:check`, and `git diff --check` clean. Port-bound
  Playwright gates were not re-run because the E2E port slot was owned by
  another task.
- Bounded claim recorded: the manifest digest is bound at the producer boundary
  and returned to the protected caller, and is not carried into any retained
  artifact. `ac265-hosted-e2e-v3` is strict with no manifest member and the
  release-evidence sidecar references only the report, so this is a locally
  verifiable property, not hosted proof; carrying it into retained evidence
  would require a decision to change a locked schema.
- This is local/private construction only. No hosted acceptance, session
  broker, receipt issuer, evidence service, fault-control plane, seeded
  identity, resource, grant, or registry row is added or implied. Totals remain
  279/282 active (283 authored IDs), Phase 2 8/17, and 1,999/2,000 active
  criteria; AC209, AC211, and AC265 remain open, Slice 10 remains locked, and
  AC266 remains owner-deferred.

### 2026-09-24 AC265 hosted-artifact attestation issuer (CP-04j, local/private only)

- Adds the missing live producer for the CP-04c/CP-04d hosted-artifact
  attestation path. The repository could already authenticate exact receipt and
  execution-evidence bytes and resolve them through a branded resolver, but
  `createAc265HostedArtifactAttestation` had no non-test callsite, so nothing
  could produce the signed companions the resolver consumes. See the [CP-04j
  verification record](../verification/2026-09-24-ac265-hosted-artifact-attestation-issuer.md).
- Designation: this entry is CP-04j because the CP-04i label is already owned by
  the run-manifest producer-side integration recorded above. No duplicate
  CP-04i designation is carried into this integration.
- `infra/workflows/ac265-hosted-artifact-attestation-issuer.ts` (with its
  `-inputs`, `-contract`, and `-signing` siblings) signs caller-supplied
  artifact bytes into canonical `HostedArtifactAttestationV1` companions with
  pinned key material, and `issue-ac265-hosted-artifact-attestations.ts` (with
  its `-contract`, `-files`, and `-sources` siblings) runs the protected
  issuance entrypoint that reads one bounded request document plus the exact
  artifact members, derives every subject from the bytes, and publishes the
  signed companions with a digest index beneath `RUNNER_TEMP`.
- Run identity is v4-only and lowercase-exact through one shared
  `HostedArtifactAttestationRunIdSchema` enforced by the issuer, the
  entrypoint, the CP-04c attestation contract, and the resolver trust clone. An
  earlier revision on the source branch widened three of those gates to a
  version-agnostic form while the entrypoint still enforced v4-only, which made
  a v7 acceptance path unreachable; that was corrected on the branch — the
  widened gates restored to v4-only, the entrypoint gate folded onto the same
  shared schema, and direct end-to-end coverage added for a non-v4 rejection
  and a v4 issuance — before this integration.
- Publication properties: the output directory must be exactly
  `${RUNNER_TEMP}/ac265-hosted-artifact-attestations` and must not pre-exist;
  it is created `0700` with the mode re-asserted on a held descriptor. Each
  attestation and the index are written `O_CREAT|O_EXCL|O_NOFOLLOW` at `0600`
  with `fsync` and a digest-bound readback. Request and artifact reads use one
  held `O_RDONLY|O_NOFOLLOW` descriptor with `fstat` size rechecks and symlink
  rejection. No secret is read, written, generated, or configured.
- Focused evidence at the source SHA: **10 files / 120 tests** pass, including
  the positive assembly control that signs the real envelopes through
  the protected entrypoint and requires the protected resolver to return
  byte-identical receipt and evidence bytes, plus negative controls for
  bare-subject receipt, foreign run ID, mutated identity, declared-subject
  contradiction, kind/reference swap, duplicate reference, unbounded source set,
  unsafe member name, symlinked request, symlinked artifact, foreign signing
  key, out-of-window attestation, pre-existing output directory, and malformed
  request document. Evidence-payload kind is pinned to its descriptor kind
  (`role` → `role_assertion`, `scenario` → `scenario_observation`,
  `session_teardown` → `session_teardown`), so a self-consistent payload
  whose kind contradicts its descriptor fails closed instead of being signed
  into evidence the CP-04c verifier must reject. The focused 10 files / 120 tests above were measured on this
  final source tree; only the record's full-repository test totals, its other
  full-repository gates, and the browser gate were measured on the source branch
  and are not re-run for this static-only integration.
- Recorded boundaries, not acceptance: the request `runId` and the source
  `issuedAt`/`expiresAt` window are caller-asserted here and must be derived
  from authenticated runner context by a future protected harness; the
  reference-to-content digest binding belongs to the CP-04d source manifest and
  is not duplicated; a mid-loop failure can leave partial signed attestations in
  the fresh owner-only directory with no index, which fails closed on read; the
  execution-evidence `artifactSha256` references UI evidence this producer
  never sees and needs a future independently authenticated evidence service;
  and `createAc265HostedArtifactAttestation` remains byte-opaque, with the
  protected wrapper as the only production entrypoint. None of these is an
  owner decision or a hosted-acceptance claim.
- This is local/private construction only. No hosted acceptance, session
  broker, receipt issuer, artifact store, evidence service, seeded identity,
  credential, resource, grant, or registry row is added or implied; the distinct
  artifact-attestation issuer key and its `artifactTrustedKeys` pinning remain
  owner decisions. Totals remain 279/282 active (283 authored IDs), Phase 2
  8/17, and 1,999/2,000 active criteria; AC209, AC211, and AC265 remain open,
  Slice 10 remains locked, and AC266 remains owner-deferred.

## 2026-09-24 AC211 queue analytics row-shape diagnostic (local only, unmerged)

- Diagnosis basis: collection run `35846440023` (UTC day 2026-09-22) passed
  preflight and then failed inside
  `infra/workflows/content-schema-registry-slo-provider-queue.ts` with
  `malformed_queue_analytics_row`, before any sample counts were computed. Runs
  `35560241699` and `35673313035` never reached that parser path — they failed
  later at the sample-sufficiency gate — so the queue date gate was untested in
  those windows and the actual provider date shape remains **unverified**. No
  date-format relaxation, no widened action/outcome vocabulary, and no
  fabricated production sample was introduced.
- The collector rejection is now self-diagnosing. A shared module
  `infra/workflows/content-schema-registry-slo-queue-shape.ts` owns the row gate
  order (`row_not_object`, `dimensions_shape`, `date_missing`,
  `date_not_string`, `date_format`, `count_shape`, `action_type_missing`,
  `action_type_not_string`, `action_type_unknown`, `outcome_shape`,
  `count_sum_overflow`) and the response-envelope classification. The collector
  now throws `malformed queue analytics row (<gate>)` and imports that module, so
  collector and diagnostic verdicts cannot drift apart. Detail codes are closed
  and value-free: no provider value, timestamp, identifier, or secret is added
  to any log.
- A new read-only shape diagnostic
  (`infra/workflows/content-schema-registry-slo-queue-shape-diagnostic.ts` plus
  entrypoint `diagnose-content-schema-registry-queue-shape.mjs`) reuses the
  collector exact query string and classifiers and emits only closed value
  classes (row type, dimension presence and key count, date/count/action/outcome
  classes), bounded row counts, and the exact rejected gate, capped at 12 emitted
  rows. It is wired into the existing protected workflow
  `collect-production-ac211.yml` as a warning-only step before collection; it
  writes no evidence, closes no criterion, and cannot bypass the collection gate.
- RED/GREEN: the two new collector tests first failed at the pinned base commit
  with the bare message against expected `(row_not_object)` and
  `(count_sum_overflow)`. GREEN: 19/19 across the three directly touched suites,
  72/72 across the eight-file AC211 surface, and a full local `pnpm test` of
  589 files / 4,835 passed plus one intentional skip.
- Independent review found a verdict-parity defect, now fixed: the aggregate
  `count_sum_overflow` check lived only in the collector's own loop, so the
  diagnostic reported `accepted` for a payload the collector rejects (two
  ReadMessage rows of 64,000 each). Reproduced against the pre-fix source as
  `expected 'accepted' to be 'rejected'`. `classifyQueueAnalyticsRows` in
  `content-schema-registry-slo-queue-shape.ts` now owns the whole-row walk in the
  collector's precedence — each row's shape gate first, then the running
  `queueAttempts`/`dlqMessages` overflow check — and both the collector and the
  diagnostic call it, so one verdict governs both. The diagnostic additionally
  reports `summaryGate` and closed `queueAttemptsClass`/`dlqMessagesClass`
  labels instead of raw sums. Eight parity cases compare the collector and
  diagnostic verdicts directly, including Read and Delete overflow; the
  warning-only workflow test now asserts the guard body executes no `exit`,
  closes before the collector, chains no `&&`/`||`, and leaves the collector
  unconditional (verified by temporarily sabotaging the guard and confirming the
  test fails). Full local `pnpm test` after the fix: 589 files / 4,845 passed
  plus one intentional skip.
- Local validation under pinned Node `22.23.1` / pnpm `11.24.0`:
  `format:check`, `lint`, `type-check`, `contracts:check`, `progress:check`,
  `db:types:check`, `test:evidence:s09`, `build`, `bundle:check`, and
  `performance:smoke` all exited 0 (local API p95 18.79 ms against the 500 ms
  threshold, zero errors). E2E ran Chrome-only against system Google Chrome
  `154.0.8037.57` via a temporary `channel: 'chrome'` override: 101/101
  functional and 5/5 real-route passed. The override was reverted and
  `playwright.config.ts` is byte-identical to HEAD
  (`62f50862821d8e14963e0bfd2e16119e`); the committed change carries no
  Playwright configuration diff.
- This closes no criterion and moves no contributor count. Totals remain
  279/282 active (283 authored IDs), Phase 2 8/17, and 1,999/2,000 active
  criteria; AC209, AC211, and AC265 remain open, Slice 10 remains locked, and
  AC266 remains owner-deferred as the mandatory post-Phase 2
  production-readiness/release gate.
- Next evidence: the diagnostic must be merged to `main` and the protected
  workflow dispatched again for a complete UTC day. That run is the first one
  that can reveal the real provider row shape; until it lands, the date shape
  stays unverified and the diagnostic is only a hint, never acceptance.

## 2026-09-25 AC265 identity source and single read-grant exception (decision recorded)

- The owner decided on 2026-09-25 to source the dedicated AC265 staging test
  identities from **Cloud Identity Free** on `wejamm.in` with **no paid Google
  Workspace**, and to approve **exactly one** narrowly scoped, expiring
  `cms.schema_registry.read` staging test-account grant as an explicit exception
  to the earlier sole-admin / no-other-CMS-authority rule, keeping the existing
  owner account as the **sole admin** with no `cms.schema_designer` and no
  admin/design permission. Both are recorded in the
  [AC265 Cloud Identity Free and read-grant decision record](../verification/2026-09-25-ac265-free-identity-and-read-grant-decision.md),
  which resolves gates 1-2 of the
  [2026-09-23 dedicated-accounts record](../verification/2026-09-23-ac265-dedicated-staging-test-accounts-decision.md).
  That record's privileged-admin-question gate stays unanswered, and no second
  privileged identity is authorized.
- Nothing was provisioned and no criterion moved. Outstanding: Google-side Cloud
  Identity account/administrator creation, `wejamm.in` domain verification and
  terms acceptance; TOTP enrollment is unconfirmed (the App Authenticator feature
  is enabled on the project, not the administrator's factor); the step-up surface
  decision is still open; `staff_case_scoped` remains a scope blocker.
