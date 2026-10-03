# Phase 2 Slices 10–17 — decisions and orchestrator resolutions (2026-10-02)

Survey: research/s10-s17-survey.md (D-numbers below are the survey's numbering, not DEC IDs).

## Owner decisions (recorded as raw DEC records in .memory/raw/events/2026-10-02.jsonl)
- DEC-109 editorial workflow policies: code-owned versioned registry, seeded immutable rows, one bound policy key/version per content-type version.
- DEC-110 protected keys cms.disclosure.policy/.legal/.security/.financial v1: >=2 distinct humans incl. one holder of cms.reviewer.policy/.legal/.security/.financial; existing 4 keys ordinary (1 reviewer).
- DEC-111 step-up MFA: server-mediated Worker ops (challenge/verify calling Supabase MFA server-side, rotate first-party session to aal2) + protected step-up page with safe returnTo; includes TOTP enrollment surface (none exists).
- DEC-112 rich_text.v1 own AST: blocks paragraph, heading 2-4, bulleted/numbered list, list item, quote; marks bold/italic/code; links https/mailto/internal routes; no inline embeds; TS + PG validators, JCS hash, typed React renderer, constrained native editor.
- DEC-113 template + pattern activation reviewer-gated via generalized DEC-108 review/decision/assignment machinery; count = strictest DEC-110 policy among bound content types; atomic CAS switch + cms.template.activated.v1 (pattern equivalent).
- DEC-114 build CMS-15 localization, CMS-16 related content and CFG-05C-01 import/export/restore in Phase 2 (S12 AC033-038, S16 AC011-013/017/019-021); amend scope lock.
- DEC-115 nav/route/slug/discovery-metadata approval via generalized CMS review machinery (editor submits, assigned reviewer approves w/ MFA filling approved_by_person_id/approved_at, publisher activates via DLV-NAV-API-02; ordinary count 1).
- DEC-116 media: self-operated ClamAV scanner container pulling identifier-only jobs over an authenticated channel; WASM image renditions in Workers; Phase 2 hosted per-file cap 50 MiB as recorded plan-limit profile (typed refusal above); 5 GiB remains contract ceiling.
- DEC-117 S13 AC171 closes on automated Chrome a11y-tree screen-reader smoke (stated as automated); AC266 pre-release real-device scope extends to S13 public delivery surfaces.
- DEC-118 S17 observability/backup: staging + configuration evidence + diagnostic local restore drill, no RPO/RTO claim; AC209/211 own timelines; protected prod writes stay disabled.
- DEC-119 owner CMS grant op: receipt-derived owner with step-up grants/renews/revokes bounded-duration CMS capabilities on organization_actor_grant to existing org humans (incl. own renewal); audited; no admin/delegation; no identity creation.

## Orchestrator resolutions (more-work-now / spec-consistency; owner may override)
- D2  CMS-06 conflict detail: new protected GET /api/v1/cms/entries/{entryId}/conflicts/{conflictId} (bounded base/theirs/yours values + provenance, conflict ETag, 403/404 concealment, no-store) — scan proposal.
- D3  EntryDraftDetailResource gains required server-derived revisionNumber and schemaVersionId.
- D5  CMS-07 comparison covers field, block and relation domains with privacy-safe stable identities; typed refusal above 512 changes (scan proposal).
- D6  restore migrationChainId names a private immutable chain-manifest row composed from completed 03a plan edges (<=64) with content hash.
- D7  approve the implemented CMS-11 protected latest-template read; propagate to BE03c/FE03.
- D9  reusable patterns: persisted owner-scoped PatternVersion create/activate/selector-read + linked-update diff + detach (IA03 says template/pattern create and activate; PatternVersion has owner/state). Activation per DEC-113.
- D10 taxonomy: read-only canonical-taxonomy projection contract fed by owning domains + taxonomy-version create/activate/selector ops; providers implemented for domains that exist in Phase 2; absent domains return typed "canonical source unavailable" refusal.
- D11 related content (CMS-16): specify and implement the eligible-target authority now (DEC-114).
- D12 locale source-stale fan-out: synchronous with per-entry dependent-locale cap 32 (new-locale refusal beyond) and per-locale aggregate dedupe key for cms.localization.changed.v1.
- D17 S15 internal callers (shards 06/10/20): register Phase 2 internal command principals via the S07 service-credential pattern; step-up = signed short-lived principal assertions; mTLS per spec.
- D19 S11 preflights: preflight registry; a category whose owning domain is not built yet passes only when the frozen dependency manifest has no references of that kind, else fails closed; later slices register providers.
- D20 BE03b EditorialDecisionRequest: remove caller capability/stepUpAt; derive from assignment + binding MFA (align with DEC-108).
- D22 S13/S14/S15 cycle: no plan change; implement S13, S14, S15 in sequence and close S13 only when its criteria (incl. media/delivery ones) pass.
- D24 Shard 05 discovery policy projection: define in S13 specs over S07 typed settings + S05 unclaimed status + S16 holds; explicit fail-closed noindex "policy unavailable" state.
- D25 S16 accessibility checker: code-owned versioned structural checks in the Worker over the CMS AST/registry (alt text, heading order, captions metadata, link text, landmarks), within BE05c's 100..2,000 ms checker timeout.
- G3  S10 contract phase locks the S11 Zod request contracts that S10 AC038-048 validate.
- G6  FE04 DLV-MEDIA-API-01 vs BE04b DLV-04B-01..04: mechanical cross-layer ID correction (BE IDs are canonical).
- G9  DeliveryPurgeRecord: one physical table created in S14 (BE04b name), S15 consumes it through the BE00 purge seam; remove the duplicate definition in BE04c.
- S09 extra: Worker rate limiter never enforces per-party limits (production-rate.ts / route-human-handlers.ts pass only rateLimit) — fix in S09 Worker work (security-first rule).

## A2 follow-ups (orchestrator, security-first; owner may override)
- fe/00-infrastructure.md error mapping (~:488) and CapabilityGate (~:167): STEP_UP_REQUIRED is 401 with recoveryAction step_up routing to /step-up?returnTo=, not a 403 gate.
- First-factor TOTP enrollment (no verified factor yet) requires recent primary authentication (session auth_time within the same 600 s freshness window); otherwise 401 with the existing BE01a reauthenticate recovery. Mitigates hijacked aal1 session enrolling an attacker factor.
- Removing the last verified factor is refused (409 last_factor_required, recoveryAction enroll_factor) while the account holds any capability whose operations require step-up; the user enrolls a replacement first.
- Lost-factor recovery: author an admin operation (S08 admin pattern: admin capability + step-up + reason + audit) that resets another user's MFA factors via the operator-only provider adapter; the sole-admin self-lockout case is a runbook via the Supabase dashboard (documented, audited by note).
- be/index.md and fe/index.md list AUTH-API-16..21 and the /step-up and /settings/security/mfa routes.
- Worker deltas for implementation: production-http.ts STEP_UP_REQUIRED must be 401 (currently 403); stepUpIsFresh tolerates +30 s skew per spec; allowedMethods from registry.

## A3 follow-ups (orchestrator)
- IA04 acceptance-criteria section: add IA-level AC-DLV-15..17 GWT entries for the new DLV-NAV-API review/decide ops (IA IDs, not plan IDs).
- DLV-DEL-API-03/04 internal ops: move to PrincipalCommandContext if their callers are internal principals per D17; otherwise document why person context stays.
- ClamAV signature database freshness gate: signatures older than 24 hours make the verdict `unavailable` (asset stays quarantined, retried); verdict evidence records signatureDbVersion/BuiltAt.
- Default image profile maxDecodedPixels = 50,000,000 (decompression-bomb guard); larger refuses as 422 media_dimensions_exceeded (or the existing BE04b code for dimension violations).
- Scanner-host operations runbook (docs/runbooks) authored in Slice 14.
- Plan/tracker AC150 DLV-MEDIA-API-01 drift and S13 additions handled in the S13 plan cascade.

## S10/S11/S12 breakdown resolutions (orchestrator unless marked owner, 2026-10-02)
- O1 (S10): `object` field kind gets a nested `properties` schema in 03a field definitions (named sub-fields with kinds/constraints, bounded depth within BE03b JSON caps); work attributed to S10.
- rich_text.v1 is also registered as a protected validator key/version in the 03a validator registry.
- D5 relation comparison keyed by stable field ID (relation-definition IDs change across schema versions).
- OD-1 (S12): taxonomy-version activation is reviewer-gated through the generalized review machinery (consistent with DEC-113/115).
- OD-2 (S12): PatternVersion carries compatibleTypeIds (mirroring templates); review count = strictest DEC-110 policy among them.
- OD-3 OWNER DEC-121: stale fallback-permitted locale fields keep serving the last approved translation; editors see stale state; no_fallback missing fields block.
- OD-4 (S09/S12, per IA03:250 + AC-CMS-15): ContentTypeVersion (03a) gains supportedLocales (1..32, includes source and default) and fallbackChains (per target locale, ordered, <=16), changed only by successor + DEC-108 schema review, frozen in definition_hash; CMS-03C-04 fallbackChain becomes an equality expectation. Implemented in Slice 09 scope (S09 still open).
- OD-5 (S12): derived related-content rules: both shared-terms and same-type-recent (code-owned rule registry).
- OD-6 (S12): scheduled activation — the schedule command performs the authority check; at fire time only revocation (and grant end before fire) is rechecked, mirroring 03b scheduled publication. Note S09 content types have no schedule action; `scheduled` state there is unreachable by design (record in BE03a).
- S12 breakdown live bugs to fix in S12: template key `context` path collision with latest-read route; global uniqueness of template/pattern/taxonomy keys leaks cross-owner existence (scope uniqueness per owner); two locale event writers share one dedupe key.
