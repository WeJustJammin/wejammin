# Slice 09 DEC-108 — orchestrator resolutions for agent-resolvable gaps (2026-10-02)

Source: research/s09-breakdown.md §3 (G1–G26) and §6. These are implementation/contract-consistency
resolutions made by the orchestrator. They must be applied identically in specs (WP0a) and contracts (WP1).
Owner-pending items are marked OWNER and must NOT be resolved by agents.

- G1  CMS-03A-10 (dry-run) creates the migration plan; CMS-03A-04 activation only advances an existing bound plan.
- G2  Plan identity is attempt-scoped. Earlier immutable attempts are retained. Uniqueness: one plan per dry-run attempt; at most one *live* (non-terminal) plan per (from_version_id, to_version_id) via partial unique index.
- G3  Dry-run attempts get typed lifecycle: state uses the BE00 job vocabulary for the job, and the report row carries attempt_no, state (queued|running|passed|failed|cancelled), job_id, plan_id, failure_code, sealed_at. Rows are append-only until sealed; sealed rows are immutable (trigger). Unsealed rows carry no result/counts/hashes (matches existing contract `resources-workflow.ts`).
- G4  Per-row migration evidence is a typed private table (plan/attempt FK, source table + row id, source hash, output hash or null, error code or null, recorded_at). Bounds must be stated as numbers reusing existing batch limits in BE03a/deep dive; never unbounded.
- G5  Transform registry: typed code-owned registry contract (key, version, digest, sourceConstraints, targetConstraints, acceptedFieldKinds, deterministic bounded behavior; no uploaded expressions/SQL/code). Initial members: only transforms whose need is evidenced by IA03 deep-dive migration classes / the integrated second-activation path. Do NOT pad the vocabulary; document the registry as code-extensible.
- G6  `cms_schema_review_decisions` carries the full IA envelope (id, owner, version, created_at, updated_at) plus assignment_id, assignment_version, capability_key, capability_version, reviewed evidence hash, decision, decided_at, MFA evidence. Fix the malformed CHECK text.
- G7  Submitter ≠ reviewer is enforced by trigger (or denormalized submitter column + CHECK), not a cross-row CHECK.
- G8  `approvalIds` = the approve-decision IDs of exactly one approved review for the candidate. FE prefills them from `activationPreparation`; the user never types JSON.
- G9  Activator needs schema_designer only; approvals come from assigned reviewers. Missing/stale MFA = 401 STEP_UP_REQUIRED with `{ recoveryAction: 'step_up', allowedMethods: string[] }`.
- G10 Activation rechecks reviewers' current assignment/capability authority only; it does not re-require MFA freshness of an earlier decision. Activator's own binding/MFA is rechecked.
- G11 jobRef uses BE00 `JobStateSchema` (`packages/contracts/src/job-status.ts`). Drop the prose promise of a separate "server-derived readiness" field; readiness is expressed by `nextActions` in `activationPreparation`.
- G12 Successor 409 conflict = a live successor draft already exists for that source (not "source already active").
- G13 Review read (CMS-03A-13) authority = submitter/schema-designer scope OR assigned review-only scope (approved proposal text). Remove the `cms.schema_registry.read` alternative.
- G14 Keep BE03a rate class names (cms-definition-write, cms-definition-read, cms-activation) with per-route limits as the existing route policies already do. Verify the limiter keys buckets per operation; if it shares one bucket per class across routes with different limits, report it (do not silently change).
- G15 Align the error-coverage lists (BE03a ~:1635-1640) with the operation error matrix (~:1335-1340), including 404, 415 and 5xx rows.
- G16 `contentHash` for review/decision/assignment/dry-run resources = lowercase SHA-256 hex of RFC 8785/JCS canonical JSON of the resource excluding `contentHash` itself.
- G17 OWNER-DECIDED 2026-10-02 (DEC-110): existing keys editorial, editorial.default, cms.content.workflow, cms.standard v1 stay ordinary (1 independent reviewer). New protected keys cms.disclosure.policy / .legal / .security / .financial v1: >=2 distinct human decisions incl. one holder of the class specialist capability cms.reviewer.policy / .legal / .security / .financial. Schema reviews (DEC-108) follow the key's risk class: ordinary = 1 cms.schema_review reviewer, protected = 2.
- G18 "Current effective owner authority" = immutable owner initialization receipt identity AND the owner's currently valid CMS grant; grantor authority end instant = the earliest of the receipt grant end and the grant valid_through. State it precisely. (Note risk: owner CMS grants expire ≤7 days after bootstrap with no renewal path — record as an observed risk, do not invent a renewal mechanism.)
- G19 Resolver typed failures: NOT_FOUND (absent or concealed), INCOMPATIBLE, WITHDRAWN, VERSION_MISMATCH (expectedTemplateVersionNo mismatch). Service-role only, zero side effects. The safe projection is surfaced to the browser only through `activationPreparation` (add an optional `templateCompatibility` projection there) — no new browser route.
- G20 Align IA03 AC-CMS-04 wording with IA03 :100-134 and DEC-108 (dry-run/review are producers, approvals are decision references).
- G21 BE03b ~:103: the 03a schema/block routes are CMS-03A-01…14.
- G22 Complete the truncated FE03 sentence (~:1071-1073) from context only.
- G23 FE03: add AsyncState enumerations for review detail and dry-run status, the `activationPreparation` data mapping, and reviewer selection UX: if an existing protected person-lookup read op exists that the owner may call, reference it; otherwise a validated UUID input with explicit helper copy. Do not invent a new read op.
- G24 Add IA03 edge-case rows: assignment expiry/revocation mid-review, self/duplicate decision, threshold race, drift after approval, rejection returns to draft.
- G25 OWNER-DECIDED 2026-10-02 (D2 = code-owned registry): editorial workflow policies come from a code-owned, versioned policy registry sharing the shape of DEC-108's schema-review registry (key, version, policyHash, riskClass, requiredDecisionCount 1..8, requiredCapabilities). A forward-only migration seeds immutable policy rows from that registry; each content-type version binds exactly one editorial policy key/version at activation; `platform_private.cms_editorial_workflow_policy_evidence` resolves the bound immutable row (NULL on absence/ambiguity/malformed). Policy changes ship only as code + migration. Caller-supplied policy is never authority. Membership per G17/DEC-110. Recorded as DEC-109.
- G26 Spec Zod mirrors the contract refinements (approvalEvidenceHash/decidedAt only when approved). OpenAPI tuple for fixed `actions` pins length (minItems=maxItems=2, additionalItems false / prefixItems+items:false).
- D3  Local acceptance: test humans' CMS grant rows may be provisioned in test setup (precedent supabase/tests/phase_02_slice_12_template_context.sql). Never insert review/decision/dry-run/approved/completed-plan/report rows. Hosted author/template-designer grant producer gap is logged as a blocker.
- D4  Checked criteria whose universal claim DEC-108 made false: reword to explicit A01–A08 scope only when the original evidence still proves that scoped claim; reopen any whose claim is false even when scoped (AC019 and AC259 per research, verify each). New ACs cover the fourteen-operation invariants. Report every reworded/reopened ID.

General: say only what the sources say (placeholder replacement over-specifies). Never write corpus measurements or counts into spec files.

## A1 follow-ups (orchestrator, 2026-10-02)
- Accept A1 judgement 1 (grant ops derive owner from receipt identity alone, so lapsed bootstrap grants are recoverable with step-up), 2 (grantable set excludes cms.public_content.read; includes cms.taxonomy_curator and spec-named cms.publisher, which must be added to the capability registry), 3 (base/specialist slot semantics), 5 (non-member subject 404).
- OVERRIDE judgement 4: the owner may self-grant ANY grantable CMS capability (author, editor, reviewer, specialists, template designer, publisher, taxonomy curator, designer, registry read). Rationale: the owner is the only human today; restricting self-grants deadlocks authoring. Separation of duties is enforced where it matters — at decision time (submitter != reviewer, distinct humans, specialist slot) — not at grant time. Remove OWNER_SELF_GRANT_LIMITED.
- Downgrade guard: a successor's schema review uses the STRICTEST of (the source/active version's workflow policy, the candidate's workflow policy); a protected -> ordinary key change therefore still needs the protected count and specialist. Same strictest-of rule for editorial policy changes carried by a successor.
- BE01c (identity owner of organization_actor_grant) must name the CMS grant RPCs as an authorized projection writer.
- FE03 references the DEC-111 /step-up page explicitly (route /step-up?returnTo=).
- Navigation/media capabilities (BE04a editor/publisher scopes, BE04b media_contributor/media_curator) join the grantable registry when Slice 13/14 specs are cascaded (same CMS-03A-15 op).

## WP2c follow-ups (orchestrator, 2026-10-02)
- SchemaReviewResource gains an owner-only `assignments[]` safe summary (assignmentId, version, state active|revoked, startsAt, endsAt, reviewer display label — no person UUID) so the owner can revoke via CMS-03A-14; non-owners receive an empty array.
- activationPreparation.dryRunRef gains nullable safe `failureCode` (the sealed dry-run failure code enum) so FE03's promised safe failure copy has a source.
- Dry-run/job polling reuses the existing FE00 job polling hook defaults (apps/web lib/infrastructure-jobs / useJobPolling) — spec FE03 names it explicitly.
- CONTENT_SCHEMA_REGISTRY_HUMAN_CAPABILITIES must include cms.schema_review (and the grant-console owner capability path) so the private boundary keeps reviewer capability.
- AC250 island tests that encode raw actorId/actingPartyId props are amended in WP5a together with the privacy invariant (AC250 behavior retained; only the prop transport changes).

## WP2a follow-ups (orchestrator, 2026-10-02)
- Accept WP2a request convention (#1), candidate states (#2), service-role-only new RPC wrappers (#3), create_type_draft must stop self-certifying a pass dry-run (#4), dry-run compiles the candidate (#5), worker protocol reuse (#7).
- #6 first version plan: `cms_schema_migration_plans.from_version_id` is nullable ONLY for the first version of a type (CHECK from_version_id IS NULL OR from_version_id <> to_version_id; partial unique for live plans handles NULL). CMS-03A-10 always returns a non-null migrationPlanId. Spec BE03a updated accordingly in the GREEN spec touch-up.
- #9 revoked reviewer after decision: open review stays open, activation refuses (recheck), consistent with G10.
- #10 approval digest: computed and stored at the approving decision; activation verifies stored digest against stored decision rows (no recompute from mutable data), so time-shift fixtures remain valid.
- Remaining hand-built fixtures (005-migration-worker, 007/008 internal seam, 009-recovery-acceptance) are rewritten to real producers by the DB GREEN package; AC096/AC099 seam tests change per G1 (plan created by dry-run).

## Migration worker <-> DB protocol (binding for DB stage 3; from WG2 report wg2-worker-migration.md, 2026-10-02)
- NEW RPC `platform_api.cms_read_schema_migration_source_rows` request `{migrationPlanId, expectedVersion (plan version), cursor, limit 1..128, leaseToken}` -> `{rows:[{sourceTable, sourceRowId uuid, sourceHash 64-hex computed by DB, document object}], nextCursor (counter string), done boolean, targetField}` with exactly these keys. `targetField` = `{fieldKey, kind, required, defaultMode, defaultValue, constraints}` where `constraints` is the compiled target constraint object for that field from the candidate artifact (so identity.revalidate validates real target constraints, e.g. a stricter maxLength). sourceTable allowlist owned by the DB.
- `cms_process_schema_migration_dry_run_batch` and `cms_process_schema_migration_batch` requests now carry `rowEvidence[<=128]` ({sourceTable, sourceRowId, sourceHash, outputHash|null, errorCode|null}, source order) plus transformKey/transformVersion/compilerHash/sourceHash/targetHash; the DB derives every counter from rowEvidence and verifies each sourceHash against the row it served; caller counters are never trusted. Backfill writes target rows DB-side from the registered transform semantics (worker posts evidence only).
- Existing plan/lease/heartbeat/finalize/verify/complete/activate/rollback RPC names unchanged.
- Worker follow-up (WG2b, after DB stage 3): identity.revalidate validates `targetField.constraints` (all IA field kinds' compiled constraints) and fill_literal uses `defaultValue`; entry source/target constraints populated.

## Worker <-> DB MFA/step-up protocol (binding for DB stage 4; from WG3 report wg3-worker-stepup.md, 2026-10-02)
- Schema platform_api, service-role only, params p_auth_user_id, p_request_id, p_correlation_id plus per-RPC fields. RPC names: auth_mfa_factors_read, auth_mfa_enrollment_begin, auth_mfa_enrollment_finish, auth_mfa_enrollment_verify_prepare, auth_mfa_enrollment_verify_settle, auth_mfa_factor_mark_reconciling, auth_mfa_removal_begin, auth_mfa_removal_finish, auth_step_up_challenge_begin, auth_step_up_challenge_finish, auth_step_up_challenge_verify_prepare, auth_step_up_challenge_failure_record, auth_step_up_challenge_verify_settle, auth_session_rotate (p_auth_user_id, p_previous_session_id, p_session_id, p_issued_at, trace; existing auth_session_register covers same-session), admin_mfa_factor_reset and admin_mfa_factor_reset_settle (jsonb p_request like admin_capability_action).
- Exact parameter and response shapes are defined in the Worker files: apps/worker/src/authentication/production-mfa-persistence*.ts (MFA_PERSISTENCE_RPC), production-mfa-registry-persistence.ts, production-step-up-persistence.ts, production-session-rotation.ts, and the admin reset port admin-mfa-reset-port.ts (find under apps/worker/src). Refusal messages: production-mfa-failures.ts (LAST_FACTOR_REQUIRED etc.) and TARGET_NOT_FOUND, MFA_RESET_IN_PROGRESS, IDEMPOTENCY_CONFLICT, MFA_RESET_INVALID, FORBIDDEN, STEP_UP_REQUIRED. DB must implement these exactly (read those files) — never store TOTP secrets.
- Contracts follow-up: CFG-05B-06 route registry/policy + OpenAPI entry (Zod exists).

## DB stage 1 reconciliations (orchestrator, 2026-10-02)
- CMS-03A-02/03 (and any definition edit) on a candidate in `review` is admitted only to atomically invalidate the open review (and its decisions) and return the candidate to `draft`; an `approved` candidate stays frozen. BE03a CMS-03A-02/03 state preconditions must say this (spec reconcile in the next S09 spec window).
- Assignment eligibility "current binding" = the reviewer's most recently selected acting-context binding is active and unexpired.

## MFA protocol amendment (FX-A, 2026-10-02) — supersedes the settle lines above; binding for DB stage 4
- platform_api.auth_step_up_challenge_verify_settle(p_auth_user_id, p_session_id /*initiating*/, p_challenge_id, p_new_session_id uuid, p_issued_at timestamptz, p_request_id, p_correlation_id)
- platform_api.auth_mfa_enrollment_verify_settle(p_auth_user_id, p_factor_id, p_expected_version, p_session_id, p_new_session_id uuid, p_issued_at timestamptz, p_request_id, p_correlation_id)
- In ONE transaction: settle (consume challenge / mark factor verified, bump version), then if p_new_session_id = p_session_id do the auth_session_register touch, else insert the new session index row and revoke p_session_id (old auth_session_rotate body). Any failure raises and rolls back the settle. The Worker no longer calls auth_session_register/auth_session_rotate for MFA (keep them as internal helpers).
- recordChallengeFailure persistence failure => Worker fails closed (no provider result returned).

## Transform registry digest + constraint shape (FX-B, 2026-10-02) — binding for DB stage 3/5
- identity.revalidate v1 digest is now 9088ab84f3c3ec40733e76e1e5a8320da14388e5a1be9272b5259140dc1d7578 (behavior string changed); default.fill_literal unchanged. DB seed/registry rows must match the Worker registry exactly (apps/worker/src/content-schema-registry/migration-transform-registry.ts).
- targetField.constraints emitted by cms_read_schema_migration_source_rows = FieldConstraintsSchema keys + optional validatorKey/validatorVersion + `relation` (full RelationBindingInputSchema binding for relation fields). null targetField is refused by the Worker.

## DB stage 3 follow-ups (orchestrator, 2026-10-02) — for DB stage 5 + Worker WG2b + spec reconcile
- Multi-field scan protocol (more-work-now): cms_read_schema_migration_source_rows returns `targetFields[]` (every changed/added field of the candidate with compiled constraints, same per-field shape as targetField) and `retiredFields[]` (fieldKeys removed/deprecated by the successor; their values are carried as retired and never validated against a target). The single `targetField` member is removed. identity.revalidate / default.fill_literal apply per field in targetFields; plans with multiple changed fields are admitted (drop MIGRATION_TARGET_FIELD_AMBIGUOUS). Retiring/deprecating a field on a populated type must succeed.
- Read and batch page limits are the same value per request (Worker sends one limit; DB asserts evidence count == min(limit, remaining)).
- Source drift detected after review freeze (at switch, verify, complete) atomically invalidates the open/approved review and returns the candidate to `draft` (typed 409 detail MIGRATION_SOURCE_DRIFT), so a new dry run + resubmission is possible; no stuck candidates.
- Race fix: cms_create_entry and every revision/entry write that targets a content-type version takes a FOR SHARE lock on that version's row (or equivalent advisory lock), and the activation switch takes the conflicting lock, so no entry commits unscanned between the final unchanged check and the switch. (Touches Slice 10-owned functions; required for Slice 09 integrity.)
- Spec reconcile: name private table cms_schema_migration_target_rows (backfill target store: transformed document + hashes per source row) in BE03a/IA03; document the error detail codes list (MIGRATION_SOURCE_DRIFT, MIGRATION_EVIDENCE_COUNT/ROW, MIGRATION_SOURCE_HASH_MISMATCH, MIGRATION_EVIDENCE_UNPROVEN, MIGRATION_OUTPUT_HASH_MISMATCH, MIGRATION_EVIDENCE_DRIFT, TRANSFORM_NOT_REGISTERED, TRANSFORM_FIELD_KIND_MISMATCH); validator-key and itemKind checks are Worker-side, DB rejects only passes it can disprove.
- Read RPC documents are service-role only and must never be logged (assert in Worker tests).

## FX-E SQL requirement (2026-10-02) — DB stage 5
- platform_private.cfg_resolve_effective_value adds 'ownerCapability', definition.owner_capability to its final jsonb_build_object; supabase/tests/phase_02_slice_07_behavior.sql expects that key. Until then the Worker CFG-05A-02 effective read fails closed (503) by design.

## DB stage 5 follow-ups (orchestrator, 2026-10-02)
- Drift refusal semantics: 409 MIGRATION_SOURCE_DRIFT refusals at switch/begin-verify/complete change nothing (transaction rollback); recovery = new dry run, which atomically invalidates the review and returns the candidate to draft; the non-raising verify verdict invalidates eagerly. Spec BE03a "Source drift" must say exactly this (spec window).
- Locale-only (or any field-neutral) breaking change over a populated type must complete: when a plan has no targetFields and no retiredFields, identity.revalidate carries every row unchanged (clean evidence, outputHash == sourceHash). Worker (migration-transform-registry/executor) and DB backfill mirror must both implement it; transform digests change only if the behavior string changes (keep Worker and DB registry equal).
- Worker follow-ups (WG-F, after evidence lane E2 releases apps/worker/src/content-schema-registry): migration-worker-queue-schema.ts + fixtures accept localeConfigHash in cms.schema.activated.v1; Worker maps RPC error DETAIL (violations, reasonCode, activeFallbackChain) for the new OD-4 422/409 shapes.

## E1 gap rulings (orchestrator, 2026-10-02)
- AC300: follow BE00 idempotency binding scope. A different actor is a distinct binding (reword AC300 to BE00 actor scope). A same-actor same-key request whose path params (source content-type/version) differ: if BE00's canonical request hash covers path params it MUST be 409 CONFLICT — implement; if BE00 binds per operation+key only, also 409 (key reuse with a different request). Fixer verifies BE00 text and implements the 409 for changed path.
- AC678: spec reconcile — cms_schema_migration_plans.dry_run_report holds a provisional fingerprint object from creation (dryRunId, source/target/compiler/transform hashes, zero counters, lease) used for supersession; the sealed cms_schema_dry_run_reports row is the authority for results. Reword BE03a + AC678 accordingly.
- AC1166: reword to declaration/storage scope in Slice 09 (no_fallback declared and enforced at authoring); public resolution semantics belong to Slice 12/15 (CMS-15 delivery, DEC-121).
- AC1197: implement — locale-config breaking changes scan the affected cms_locale_variants rows (removed locale's variants / retained-chain changes) through the real protocol, so the plan's counts reflect locale variant rows, not only entry revisions.
- AC215: finish the universal proof — add trigger-catalog enumeration over the original twelve tables plus new tables.
- AC774: spec reconcile — the refusing AUTH-API-18 RPC returns 409 ENROLLMENT_EXPIRED without persisting (rollback); auth_mfa_registry_sweep persists the expiry and emits the event; reword AC774/BE01a.
- AC903: implement invoker views for self reads of safe MFA projections (factor list, step-up state) per BE01a; Worker may keep service RPCs for writes.
- AC945: align admin_mfa_factor_resets idempotency key length to BE05b 16..128 (DB CHECK + contract + Worker validation).
- G3 DB: activationPreparation.dryRunRef projection adds sourceCount, targetCount, rowErrorCount, sourceHash, targetHash, reportHash for completed reports only (all-or-none) from cms_schema_dry_run_reports; BE03a reconcile names dryRunRef as the carrier.

## Audit remediation rulings (orchestrator, 2026-10-02; DEC-122 addendum)
- AC285: reword to the current BE03a SchemaSuccessorRequest shape including the OD-4 pair (both-null clone or both-present replace).
- Recent MFA (AC089, 091, 421, 484, 523, 556, 585): DEFECT, not a ruling. cms_review_binding and every "recent binding-bound MFA" check must use the binding's verified step-up/MFA instant (the stepUpAt carried from the aal2 token / recorded MFA evidence) within the 600 s freshness window (+30 s skew), never acting_context_binding.last_seen_at or any heartbeat. Heartbeat freshness remains a separate binding-liveness check.
- AC904: reconcile must not settle pending -> expired where the criterion forbids reconciling -> expired; fix per BE01a state machine.

## R3 follow-up rulings (orchestrator, 2026-10-02; DEC-122 addendum)
- AC942: reword to BE05b matrix — self-target 422 MFA_RESET_INVALID; schema violations 400 INVALID_REQUEST.
- AC1049: reword — revoke sends assignmentId and the review expectedVersion (If-Match), per BE03a CMS-03A-14 revoke request.
- AC181: implement as spec (BE03a ~2108): immutable session-resolving RLS helper and WITH CHECK policies re-resolving scope on every new private table, in addition to the RPC gate (defense in depth); no table grants still.
- AC1135: implement eager invalidation — a scheduled sweep (reuse the existing registry sweep/cron pattern) invalidates open/approved reviews whose counted decision relied on a specialist capability or assignment that has since expired, returning the candidate to draft and emitting the audit/outbox event; activation recheck stays.

## Final closure rulings (orchestrator, 2026-10-02; DEC-122 addendum)
- AC431 (BE03a:171 vs ~2155): CMS-03A-12 returns 403 FORBIDDEN when the review is readable to the caller (submitter/schema-designer scope, or an assignment that grants read but whose decide authority/capability is not current) and 404 NOT_FOUND when the review is not readable to the caller (concealment). Reword AC431 and the BE03a ~2155 sentence to this rule; implement if the code returns 404 for readable-but-not-authorized callers.
- Race-runner-only criteria (AC424, AC586): the .mjs independent-session runners must be executed by the repo's gates — wire them into the database verification chain that CI runs (db:verify / infra/verify-database.sh / db:test wrapper) so validate/CI executes them.

## DEC-122 ratified by owner (2026-10-02) — all nine rewordings (AC300, 678, 774, 1031, 1166, 285, 431, 942, 1049). Moved scope needs explicit receiving criteria in Slice 11/12 plans.

## Re-audit rulings (orchestrator, 2026-10-02; spec consistency, not owner questions)
- 409 details: BE00 is the envelope contract — every 409 carries the BE00-required fields (conflict + recoveryAction as BE00 defines) plus BE03a's expectedVersion/currentVersion where applicable; update BE03a text to say it extends BE00.
- Violations use `path` (BE00 and BE03a both say path); change the CMS wire from `pointer` to `path`.
- 403 from a DB refusal carries a BE00 reasonCode (registered value) on the wire.
- Worker idempotency: no per-isolate cache that can answer with a non-spec code; idempotency is authoritative in the DB (actor-scoped binding); any Worker short-circuit must be actor-scoped and use only BE00 codes — prefer removing it.
- Step-up proof: every Worker step-up gate requires the token's aal = aal2 (plus the MFA instant freshness); aal1 is always 401 STEP_UP_REQUIRED (BE01a).
- Pre-amendment 240 criteria: reopen any the re-audit found contradicted; for the rest, add markers/evidence entries so every checked criterion has an executable citation (one evidence standard for the whole slice).

## R8 web rulings (orchestrator, 2026-10-03; DEC-122 addenda pending owner ratification)
- AC233: reword — unsaved protected registry data is never persisted as durable draft or offline intent; the only permitted persistence is the DEC-111 tab-scoped step-up draft (session-scoped, cleared on return/re-confirm, never auto-replayed). Authority: DEC-111 (owner) + FE03 step-up recovery.
- AC261: reword — registry lists render at most 100 rows per page via cursor pagination (BE03a page cap), so no client virtualization is required; keep the bundle-size clauses unchanged.
- AC972: keep text; UI gates every control solely on permittedNextActions; if an action is present but its prefill data is missing, render the control in a degraded/unavailable state (no hidden gating on other fields).

## P240-db rulings (2026-10-03)
- DEC-123 (owner): AC003/045/049 — new types bind a template only via first successor; reword positive clauses; BE03a/FE03 text: CMS-03A-01 refuses template bindings for a brand-new type (or omits the field) and the successor carries them.
- AC037 (orchestrator): reword helper as "schema-qualified, pinned-search_path STABLE helper" (IMMUTABLE would be incorrect because it reads session context).
- AC081/AC203 (orchestrator): implement the opaque relation placeholder {status:'unavailable', reason:'unavailable'} for unavailable relation targets across DB read, contract and Worker; reopen until proven.
- AC180 (orchestrator, security-first): trim platform_api to RPCs the Worker actually calls (move others to platform_private, not executable by API roles), then reword the clause to the exact enumerated set with a guard test.
- AC185 (orchestrator): reword to "no purge path exists for CMS definitions/plans/reports"; legal-hold enforcement over CMS records is received by Slice 16 lifecycle foundation (receiving note in S16 tracker).
- AC190 (orchestrator): emit the BE00 `producer` envelope member, derived from a registered event-type-prefix map in the outbox dispatcher, with tests.
- AC204: process criterion closed by the aggregate of security suites in validate (integrator).

## P240-app rulings (orchestrator, 2026-10-03)
- AC220: reword to the DEC-108 island-privacy rule (Workbench props carry the verified context label and safe resources, never actor/acting/person/binding ids) — authority DEC-108 amendment (owner-approved) + AC218.
- AC245/AC246: IMPLEMENT per FE03:949-950 — collapsible sidebar at 769-1024 px (8 columns/20 px gutter/24 px margins, two columns only for independent fields) and a stable list/detail split with a detail-owned action rail at >=1025 px (12 columns/24 px gutter/max 1440 px); production-built Chrome layout assertions. Reword only the "virtualization above 100 rows" clause of AC246 to the 100-row page cap (same as AC261).
- AC262: production-built Chrome web-vitals measurement (LCP < 2.5 s, INP < 200 ms, CLS < 0.1, no input task > 50 ms) on the registry, review and grant routes with the Performance/LongTask APIs and a fixed throttling profile stated in the test.

## Integrator-v3 holdover rulings (orchestrator, 2026-10-03; rewordings pending owner ratification)
- AC005: reword to authoring/storage scope; no_fallback resolution semantics belong to Slice 12/15 (DEC-121), with a receiving criterion there.
- AC007: match BE03a's compiled-artifact definition exactly (versioned contract reference /v{n}, editor and renderer manifests, deterministic hash); if BE03a lists more artifacts than the compiler emits, IMPLEMENT the missing ones; if the criterion lists more than BE03a, reword to BE03a.
- AC025: BE00 canonical order governs (request/correlation id -> deadline/body/content/origin/CSRF -> session -> ...); fix BE03a ~147 text to cite BE00 order; the existing origin-before-session test stands.
- AC431: reachable 403 class only — readable via submitter/schema-designer scope but not assigned/authorized to decide -> 403; not readable -> 404. Reword (refines DEC-122).
- AC658: reword to name the legitimate writers of the actor-grant projection: the three grant RPCs plus initialize_cms_owner and the owner-initialization backfill/trigger; assert no other writer.
- AC906: reword to the pull model (no client projection cache exists; reads re-fetch canonical state with new ETag); the consumer requirement applies only if a projection cache is introduced.
- AC282/AC1147: author explicit receiving criteria in the Slice 11 (CMS-03B-06/07/09 step-up recovery), Slice 12 (no_fallback resolution; AC005/AC1166 scope) and Slice 16 (legal-hold enforcement over CMS records) plans and trackers (open), and correct the transfer record counts.
- AC217: attempt to meet the BE03a anchor RPC p95 < 300 ms for create128 (profile, index, batch); if physically infeasible on the local stack, report measurements for an owner ruling — do not exempt silently.
- AC390: provide a producer path for a workflow-key change on a successor (successor request may change workflow key/version, validated against the registry, strictest-of review applies) — implement if absent.

## R12-db flag rulings (orchestrator, 2026-10-03)
- AC034 A01: implement BE03a row 160 — foreign or absent target registry scope -> 404 (byte-identical bodies), member of the scope without schema_designer -> 403; nothing committed.
- A05/A08 human 403 / A05 unknown release target 404: Worker-produced rows; worker real-composition proofs suffice (no DB change).
- AC356 count-input: caller-supplied counts/hashes are unknown keys -> 400 INVALID_REQUEST per BE00 structural rule; reword AC356 and fix BE03a row ~234 to 400 (pending owner ratification with the other rewordings).
- AC658: reword writer set = {cms_capability_grant_project (via CMS-03A-15..17), initialize_cms_owner (+ owner-initialization trigger/backfill writes aggregate only), rpc_create_organization (organization capability grants)}.
- AC390/AC641: BE03a text must state the successor workflowKey/workflowVersion pair (both-null keep / both-present seeded member / else 422; strictest-of review) and the failed-dry-run failureCode provenance from real scans.

## R14 owner ratifications (2026-10-03)
- DEC-124 (OWNER): ratified the proposed texts in decisions/r14-ratification-bundle.md for AC005, 007, 025, 034, 037, 180, 181, 233, 246, 282, 356, 431 (refinement), 658, 685, 708, 1147. Apply proposed text verbatim; criteria re-check only on evidence.
- DEC-125 (OWNER): AC185 legal-hold/incident-fence enforcement over CMS records lives in Slice 16 lifecycle (receiving S16-AC029); S09 text = bundle proposed text.
- DEC-126 (OWNER): AC390 keep optional workflowKey/workflowVersion pair on CMS-03A-09 (both absent keep, both present replace w/ seeded member, else 422); bundle proposed text.
- DEC-127 (OWNER): AC641 keep rollback RPC failing a dry_running plan (latest attempt failed + code, plan blocked; recover via new CMS-03A-10); bundle proposed text.
- DEC-128 (OWNER): AC906 pull model, proven: guard that no MFA factor projection cache exists + real (non-stubbed) multi-tab BroadcastChannel refetch test; bundle proposed text.
- Orchestrator (more-work-now): AC261 bundle clauses stay in S09 and close only on a real `pnpm bundle:check` receipt; virtualization reword ratified only if no client accumulation beyond 100 rows exists, else implement virtualization. AC034/SEC-5: DB rows (human 403, unknown target 404) implemented in DB3. AC233: proven by real reconnect test (WEB lane).

## R14-web rulings (orchestrator, more-work-now; 2026-10-03)
- AC1127 profile ownership: implement FE00:488 scoped tab draft persistence before /step-up and restore on return (DEC-111 pattern) for the convert form. Consolidate all per-surface STEP_UP mappers onto the shared reader and the three CapabilityGate copies into one FE00 component (extensibility: no copy-paste).
- CapabilityGate showing "Reason: ownerFull" (variant name as reasonCode) = defect: render spec copy.
- AC261: budget means everything loaded initially. Commission bundle reduction (lazy detail/editor split, keep zod/contracts out of the initial island where server validates, measure). Only if 90 KB is unreachable without replacing React does it go to the owner as an architecture question, with measurements.
- AC233 "input": prove input revalidation on reconnect (form re-validated against the refetched definition; server validates resubmission), real offline/online cycle.
- AC1122: prove each branch with real responses (self-target -> MFA_RESET_INVALID copy; schema-invalid -> field errors). If the criterion text demands both in one response, flag for reword.
- AC248: read FE03; if forms must validate on blur, implement blur feedback on every registry command form + blur-then-422 server-authority tests; otherwise scope to locale tag list + template choice with those tests.
- AC1050-1056 personas: build a persona-bearing session fixture and prove each persona row through the real path.
- Orchestrator (R14b DB3): AC527 — CMS-03A-15 existing-aggregate 409 carries recoveryAction 'renew' (BE00 types recoveryAction as string); add to Worker closed lookup, FE00/FE03 recovery mapping routes to the renew command; BE03a changelog row. More-work-now; matches the approved criterion.
- DEC-129 (OWNER): delete BE03a 'unknown release target is 404' clause for CMS-03A-05 (rows ~164/1825/2219) with changelog row; A05 creates its resource; A08 keeps its 404.
- DEC-130 (OWNER): AC1122 reworded to each branch: "self-target gives 422 MFA_RESET_INVALID shown with the self-target copy; schema-invalid input gives VALIDATION_FAILED shown as field errors from the schema."
- Orchestrator (R14b web): AC248 blur copy derived mechanically from request schemas accepted (error-message formatting = implementation). AC1108: conform to spec `tab=mfa-reset` (spec governs). AC261 budget scope = registry list route initial (as criterion says); detail total reported only. CmsEditorialCapabilityGate stays separate (different denial-surface contract; S10 scope).
