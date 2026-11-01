# WeJammin Phase 2 — Slice 11 implementation brief

Strictly read-only review. No files changed; no tests, scripts, Docker, `psql`, or database operations ran.

Slice 11 is `not-started`, depends on Slice 10, and has 48 unchecked criteria. The current plan covers CMS-08/09/13 and CMS-03B-05..09; DEC-148 additionally assigns CMS-03B-15..20 to Slice 11 but defers their full six-class depth-floor cascade until setup. [Phase plan:2926-2993](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/phases/phase-2.md:2926), [tracker:1-71](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/pipeline/progress/slices/phase-02-slice-11.md:1), [DEC-148:2144-2155](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/decisions.md:2144).

## 1. Operation briefs

Common browser rules:

- Strict Zod objects; unknown keys reject. Mutation routes require printable `Idempotency-Key`, strong `If-Match`, and JSON; CMS-03B-10 is the only no-`If-Match` exception. Responses expose no authority graph or ownership identifiers. [BE03b:246-300](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:246)
- Commands atomically persist canonical state, audit, idempotency, and outbox effects. Lost responses reconcile using the same key; audit failure blocks the command. [BE03b:2030-2054](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2030), [BE03b:2093-2117](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2093)
- `401 STEP_UP_REQUIRED` for CMS-03B-06/07/09/18 must not reserve idempotency or mutate state. Recovery uses `/step-up?returnTo=…`, never auto-replays, refetches the CAS operand, requires confirmation, then submits the original key exactly once. [Phase plan:2991-2993](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/phases/phase-2.md:2991)

### CMS-03B-05 — Submit review

- **Route/schema:** `POST /api/v1/cms/entries/{entryId}/reviews`; strict `{entryId, revisionId, frozenHash, dependencyManifest}` → `201 EditorialReviewResource`. The resource contains the frozen policy/evidence, counts, hashes, state, invalidation reason, and submission/decision timestamps. [BE03b:157](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:157), [BE03b:511-516](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:511), [BE03b:845-929](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:845)
- **Authority/validation:** Entry assignee with `cms.author` or `cms.editor`; current draft only, no live review. Server recomputes the 64-hex payload hash, strict ≤256-entry/32-KiB dependency manifest, risk class, workflow policy, activation evidence, and submit-phase preflight. Hidden target is 404; visible but unauthorized is 403. [BE03b:261-263](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:261), [BE03b:1994](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1994)
- **Concurrency/failure:** Key + entry-version `If-Match`; partial uniqueness permits one live review per revision. Errors include `revision_not_submittable`, `dependency_changed`, open-review/idempotency conflict, `preflight_failed`, or retryable preflight unavailability. No review exists on refusal. [BE03b:1874](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1874), [BE03b:2105](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2105)
- **Effects/bounds/state:** 30/min/user, 60/min/party, 15 seconds, no-store, Tier 2. Creates `open` review plus dependency index and emits identifier-only `cms.entry.review-changed.v1`. Review later becomes `approved`, `rejected`, or `invalidated`. [BE03b:2058-2079](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2058)
- **Code:** Request/path/header contracts exist in [publication-contracts.ts:231-260](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/packages/contracts/src/cms-editorial/publication-contracts.ts:231); foundational review storage exists in [20260927090000…sql:62-135](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/supabase/migrations/20260927090000_cms_editorial_support_authority.sql:62). Missing: resource schema/export, route policy, Hono/web route, `cms_submit_review`, dependency table, preflight registry, audit/outbox runtime, UI, and tests.

### CMS-03B-06 — Record decision

- **Route/schema:** `POST /api/v1/cms/reviews/{reviewId}/decision`; strict `{reviewId, decision: approve|reject, reason, expectedVersion}` → `200 EditorialReviewResource`. [BE03b:158](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:158), [BE03b:517-522](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:517)
- **Authority/validation:** Active per-review `cms.editorial_review` assignment plus standing `cms.reviewer`; specialist slot also requires its named capability. Reviewer must differ from author and submitter. Step-up is unconditional and server-derived, fresh for 600 seconds ±30 seconds. Reason is 1–2000 NFC Unicode code points, excluding controls, bidi formatting, separators, and `<>{}`. [BE03b:264-265](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:264), [BE03b:1995](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1995)
- **Concurrency/failure:** Key + review-version `If-Match`; unique reviewer/review decision and CAS. Typed failures include `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable`, `dependency_changed`, capability/separation failures, and `STEP_UP_REQUIRED`. First rejection terminates the review. [BE03b:1875](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1875)
- **Effects/bounds/state:** 30/60 per minute, 15 seconds, no-store, Tier 2. Decision is append-only `recorded`; the review count and state change transactionally and emit `cms.entry.review-changed.v1`. [BE03b:2058-2076](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2058)
- **Code:** Strict request and safe-reason contracts exist at [publication-contracts.ts:262-332](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/packages/contracts/src/cms-editorial/publication-contracts.ts:262); foundational decisions exist at [migration:137-180](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/supabase/migrations/20260927090000_cms_editorial_support_authority.sql:137). Missing: assignment identity/version linkage, mandatory step-up evidence, response schema, route/runtime, `cms_record_review_decision`, UI, and events.

### CMS-03B-07 — Schedule publication action

- **Route/schema:** `POST /api/v1/cms/publication-schedules`; strict revision/action/local datetime/IANA timezone/resolved UTC/tzdb/disambiguation/audience/expected review version → `202 PublicationScheduleResource`. [BE03b:159](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:159), [BE03b:523-549](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:523), [BE03b:930-963](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:930)
- **Authority/validation:** Owner-party `cms.publisher`, approved revision/review, publisher not author for publish, unconditional step-up. Grant must remain valid through `resolvedUtc`. Pinned tzdb must resolve gaps/folds exactly; horizon is 60 seconds–366 days. [BE03b:266-271](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:266), [BE03b:1996](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1996)
- **Concurrency/failure:** Key + approved-review-version `If-Match`; unique entry/revision/action/local-time/timezone/audience; executor CAS. Typed errors cover tzdb/gap/fold/resolution/horizon, `authority_ends_before_schedule`, stale review/version set, collision, preflight, and idempotency. [BE03b:1876,1893](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1876)
- **Effects/bounds/state:** 20/40 per minute, 15-second acceptance, no-store, Tier 2. `202` means scheduled, not published. State is `pending → executing → completed|failed_retryable|blocked|cancelled`; no event occurs until execution. [BE03b:2059-2076](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2059)
- **Code:** Request/header contracts exist in [publication-schedule-contracts.ts:154-235](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/packages/contracts/src/cms-editorial/publication-schedule-contracts.ts:154); a preliminary schedule table exists at [migration:182-238](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/supabase/migrations/20260927090000_cms_editorial_support_authority.sql:182). It lacks review/audience uniqueness, attempt/lease/reason fields, executor RPCs, route/runtime, UI, and resource schema.

### CMS-03B-08 — Mint preview token

- **Route/schema:** `POST /api/v1/cms/previews`; strict `{entryId, revisionId, locale, audience, route, versionSet}` → `201 PreviewTokenResource`. Response includes plaintext token once, expiry, exact binding, and no persisted token hash. [BE03b:160](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:160), [BE03b:550-560](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:550), [BE03b:964-977](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:964)
- **Authority/validation:** Entry assignee, active assigned reviewer, or owner-party publisher. Strong `If-Match` is the entry version. Version set must exactly match canonical state; audience and normalized internal route are strictly bounded. [BE03b:272-274](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:272), [BE03b:1997](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1997)
- **Concurrency/failure:** Exact replay re-derives the same unexpired token. Expired/revoked replay is `preview_expired`; stale entry/version set is 409. No token mint occurs on failure. [BE03b:1847-1851](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1847), [BE03b:1877](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1877)
- **Effects/bounds/state:** 60/120 per minute, 8 seconds, no-store, Tier 1. Token is active, expires derivationally after exactly 900 seconds, or is CAS-revoked; no event.
- **Code:** Request/header contracts exist at [publication-schedule-contracts.ts:175-235](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/packages/contracts/src/cms-editorial/publication-schedule-contracts.ts:175); preliminary token storage exists at [migration:309-356](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/supabase/migrations/20260927090000_cms_editorial_support_authority.sql:309). Missing: canonical person binding, exact expiry constraint/state model, response schema, mint RPC, route/runtime, one-time UI, and verifier.

### CMS-03B-09 — Publish immediately

- **Route/schema:** `POST /api/v1/cms/publications`; strict `{entryId, revisionId, frozenHash, expectedVersionSet, audience, expectedVersion}` → `202 PublicationResource`, including append-only version identity and `projectionState: pending|converged|degraded`. [BE03b:161](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:161), [BE03b:561-568](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:561), [BE03b:978-989](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:978)
- **Authority/validation:** Owner-party publisher, approved review, not revision author, unconditional step-up. Frozen hash, version set, dependency manifest, identities, revocation, and all publication preflights must still match. [BE03b:275-276](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:275), [BE03b:1998](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1998)
- **Concurrency/failure:** Key + approved-review-version `If-Match`; unique lineage version. Errors include stale review/version/dependency, `publication_conflict`, `publication_not_active`, preflight failure/unavailability, separation of duties, and idempotency mismatch. No partial publication. [BE03b:1878,1893](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1878)
- **Effects/bounds/state:** 20/40 per minute, 15-second acceptance, no-store, Tier 2. Atomically appends publication lineage, audit, idempotency, and exactly one `cms.publication.changed.v1`. `202/pending` is not proof of public visibility. [BE03b:1843-1845](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1843), [BE03b:2073-2079](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2073)
- **Code:** Request/header contracts exist at [publication-schedule-contracts.ts:189-235](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/packages/contracts/src/cms-editorial/publication-schedule-contracts.ts:189); preliminary publication storage exists at [migration:240-307](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/supabase/migrations/20260927090000_cms_editorial_support_authority.sql:240). It conflicts with the locked append-only lineage model and lacks lineage/action/schedule/publisher fields, RPC/outbox/runtime/UI, and response schemas.

### CMS-03B-15 — Workflow preparation read

- **Route/schema:** `GET /api/v1/cms/entries/{entryId}/workflow`; strict optional `revisionId` query → bounded `EntryWorkflowResource` containing entry/revision, nullable preparation/review, ≤16 schedules, ≤64 publications, and permitted actions. [BE03b:167](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:167), [BE03b:580-584](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:580), [BE03b:1306-1372](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1306)
- **Authority/validation:** Entry assignee, owner-party publisher, or active reviewer assignee. Preparation exists only for a submittable draft; it recomputes the frozen manifest/version set and up to 17 preflight results. Hidden entry/revision is 404; visible but outside scope is 403. [BE03b:289-290](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:289), [BE03b:2004](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2004)
- **Runtime/failure:** Safe read, no key/`If-Match`, composite strong ETag, 300/600 per minute, 8 seconds, no-store, Tier 2 p95 <1.2 seconds. Provider unavailability is represented inside the preflight report; it does not turn the preparation read into a mutation failure. [BE03b:1884](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1884), [BE03b:2112](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2112)
- **Code:** Entirely missing from package route policy, worker/web routes, ports, schemas, and RPCs. Current operation unions stop at 01–04 and 10–14. [route-policy-base.ts:3-58](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/packages/contracts/src/cms-editorial/route-policy-base.ts:3), [worker index.ts:15-31](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/apps/worker/src/cms-editorial/index.ts:15), [web app routes:10-35](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/apps/web/src/components/cms-editorial/cms-editorial-app-routes.ts:10)

### CMS-03B-16 — Review detail read

- **Route/schema:** `GET /api/v1/cms/reviews/{reviewId}` → `EditorialReviewDetailResource`: frozen candidate, safe decision metadata ≤8, owner-only assignments ≤32, caller assignment, and permitted actions. Only the caller’s own decision reason is returned. [BE03b:168](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:168), [BE03b:1373-1418](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1373)
- **Authority/validation:** Submitter, active reviewer assignee, entry assignee, publisher, or receipt-derived owner. Cross-owner/hidden is 404; visible but unauthorized is 403. No person/actor/party IDs leak. [BE03b:291-292](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:291), [BE03b:2005](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2005)
- **Runtime/failure:** Safe no-store read, review-version ETag, 300/600 per minute, 8 seconds, Tier 1 p95 <750 ms; no audit, outbox, or mutation. [BE03b:1885](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1885)
- **Code:** Spec-only; no response contract, read RPC, worker port, route, server loader, or page exists.

### CMS-03B-17 — Reviewer queue

- **Route/schema:** `GET /api/v1/cms/reviews`; strict `{cursor?, limit 1..50, scope: assigned|submitted, state?}` → `ReviewQueuePage {items≤50,nextCursor,pageVersion}`. [BE03b:169](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:169), [BE03b:585-591](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:585), [BE03b:1419-1441](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1419)
- **Authority/privacy:** Verified human; `assigned` returns only active assignments and `submitted` only the caller’s submissions. It never scans or reports the hidden population. [BE03b:293-294](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:293), [BE03b:2006](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2006)
- **Runtime/failure:** Signed keyset cursor over `(updatedAt DESC, reviewId DESC)`, query/context-bound; 300/600 per minute, 8 seconds, no-store, Tier 1. Structural cursor fault is 400; expired/tampered/foreign cursor is 409 and restarts from page one. [BE03b:1886](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1886), [BE03b:2114](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2114)
- **Code:** Spec-only; no queue contract, keyset RPC, worker/web route, cursor signer, page, or island exists.

### CMS-03B-18 — Assign/revoke reviewer

- **Route/schema:** `POST /api/v1/cms/reviews/{reviewId}/assignments`; discriminated `create|revoke` request → `201|200 EditorialReviewAssignmentResource`. Create supplies expected version, eligible reviewer, expiry, and optional reason; revoke supplies expected version and assignment ID. [BE03b:170](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:170), [BE03b:593-607](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:593), [BE03b:1442-1451](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1442)
- **Authority/validation:** Receipt-derived owner holding non-grantable `cms.editorial_review.assign`, unconditional step-up, review open, reviewer a current eligible human with `cms.reviewer`, not author/submitter, no duplicate assignment. Expiry is ≤7 days and bounded by reviewer and grantor authority; maximum 16 active assignments. [BE03b:295-298](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:295), [DEC-136:1990-2002](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/decisions.md:1990)
- **Concurrency/failure/effects:** Key + exact review-version `If-Match`; 10/20 per minute, 15 seconds, no-store, Tier 2. Typed refusals include `reviewer_not_eligible`, `assignment_exists`, `assignment_limit`, `review_not_open`, `expiry_out_of_bounds`, and step-up. Success atomically writes audit plus `cms.entry.review-changed.v1`; expiry is inert without a mutating sweep. [BE03b:1887,1893](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1887), [BE03b:2115](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2115)
- **Code:** Assignment table, RPC, contract exports, route, step-up UI, and page controls are entirely absent.

### CMS-03B-19 — Preview-token verifier

- **Interface/schema:** Internal-only `platform_api.cms_verify_preview_token`; strict token hash, actor person, acting-context hash, route, locale, and audience → discriminated `PreviewVerificationResult`. Browser plaintext never reaches the RPC. [BE03b:174-178](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:174), [BE03b:608-618](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:608), [BE03b:1452-1473](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1452)
- **Authority/validation:** Only the registered Shard 04 delivery principal. Token must be active, unexpired, unrevoked, and exactly bound to actor/context/route/locale/audience on an active entry. [BE03b:2008](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2008)
- **Runtime/failure:** Read-safe with no audit/outbox; 500-ms RPC, retries at 75/150 ms, 30-second circuit. Unknown, ambiguous, transport, or binding failure returns preview denial with no draft detail. Denials are byte-identical except the bound actor may see their own `revoked` flag. [BE03b:1847-1851](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1847)
- **Code:** Preliminary token storage exists, but the named RPC, service grant, exact binding fields, production adapter, BE04c integration, and verifier tests do not.

### CMS-03B-20 — Claim/execute due schedules

- **Interface/schema:** Internal claim RPC accepts `batch 1..100` and returns bounded `ClaimedSchedule`; execute accepts schedule identity, expected version, lease, and verified worker `PreflightEvidence`, returning `ScheduleExecutionResult`. [BE03b:174-179](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:174), [BE03b:1283-1298](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1283), [BE03b:1475-1502](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1475)
- **Authority/validation:** Only the registered scheduled Worker principal. Execution rechecks approval, review version, frozen manifest, revocation, publisher authority, all 17 preflights, and accessibility evidence. MFA is not rechecked at fire time. [BE03b:2009](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2009)
- **Concurrency:** Claim uses `FOR UPDATE SKIP LOCKED`; `pending|failed_retryable → executing` under CAS, with five-minute lease. Expired executing leases return to retryable. Execute is idempotent by schedule/version and returns completed schedules unchanged. [BE03b:1853-1864](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1853)
- **Bounds/failure/effects:** Sweep batch 25 each minute; 15-second deadline; 15/60/300-second retries, then `blocked`. Failed preflight leaves prior publication intact; unavailable is retryable. Successful execution appends publication lineage and exactly one `cms.publication.changed.v1`.
- **Code:** Preliminary schedule/publication tables exist, but lease/attempt fields, both RPCs, scheduled handler, worker port, lineage/outbox transaction, and crash/CAS verification are absent.

### Current implementation summary

The package route registry, Worker operation IDs, production RPC map, ports, and web route registry all stop at Slice 10 operations 01–04 and 10–14. [route-policy-base.ts:3-58](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/packages/contracts/src/cms-editorial/route-policy-base.ts:3), [worker types.ts:52-149](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/apps/worker/src/cms-editorial/types.ts:52), [production types:12-78](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/apps/worker/src/cms-editorial-production-types.ts:12), [web page reads:15-73](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/apps/web/src/components/cms-editorial-pages/cms-editorial-page-reads.ts:15).

Therefore:

- CMS-03B-05..09 have partial request-contract and preliminary-table foundations only.
- CMS-03B-15..20 are specification-only.
- None of the eleven operations currently has a complete contract → route → Worker → RPC → web/consumer → verification path.
- The existing migration explicitly treated named RPCs, Zod contracts, and middleware as future work. [migration:1-17](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/supabase/migrations/20260927090000_cms_editorial_support_authority.sql:1)

## 2. DEC-148 depth-floor cascade proposal

Do not assign final `P2-S11-AC-*` numbers yet. DEC-148 says the ownership edits do not change the count, but simultaneously requires a full per-operation six-class cascade. The Slice 10 precedent treated five operations × six classes as 30 additive criteria and raised its floor. [Slice 10 depth-floor:3-48](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/pipeline/progress/verification/2026-10-05-slice-10-depth-floor.md:3)

### CMS-03B-15 candidates

1. **Contract/shape:** Implement the exact GET workflow route and strict query/resource contracts, including bounded preparation, review, schedule, publication, and `permittedNextActions` fields; generated OpenAPI and discovered routes MUST match. BE03b:167, 580–584, 1306–1372.
2. **Validation:** Reject malformed/unknown query members; conceal absent or cross-entry revisions; return preparation only for a submittable draft; enforce the 17/16/64 response bounds and exact frozen manifest/version-set schemas. BE03b:289–290.
3. **Authority/privacy:** Resolve assignee, publisher, or active reviewer scope server-side; return 403 only for a visible target; expose no authority/ownership identifiers and never let the projection grant authority. BE03b:2004.
4. **Runtime bounds:** Make the read no-store and mutation-free, with composite strong ETag, 300/600 rate buckets, 8-second deadline, and the registered Tier 2 SLO. BE03b:167.
5. **Safe failure:** Use typed `ApiError`; preserve 404 concealment; represent provider unavailability inside `preparation.preflight`; emit no audit/outbox/idempotency effect. BE03b:1884, 2112.
6. **Consumer/verification:** Mount the workflow/preflight surface from canonical data, render all preflight outcomes accessibly, enable only server-permitted actions, and verify response bounds, no-store, concealment, privacy, and refetch behavior. FE03:586–603; BE03b:2135–2174.

### CMS-03B-16 candidates

1. **Contract/shape:** Implement the exact review-detail route and resource, bounding decisions to eight and assignments to 32, returning assignments only to the owner and reason only for the caller’s own decision. BE03b:168, 1373–1418.
2. **Validation:** Enforce UUID path/no-query shape and response invariants for decision counts, frozen candidate, assignment bounds, and closed states. BE03b:291–292.
3. **Authority/privacy:** Permit only submitter, qualifying reviewer, entry assignee, publisher, or receipt-derived owner; conceal hidden/cross-owner review and serialize no person/party/actor identifiers. BE03b:2005.
4. **Runtime bounds:** Provide a safe no-store read with review-version ETag, 300/600 rate buckets, 8-second deadline, and Tier 1 p95 target. BE03b:168.
5. **Safe failure:** Return typed 400/401/403/404/415/422/429/dependency/internal errors without mutation, audit, or outbox effects. BE03b:1885, 2113.
6. **Consumer/verification:** Render immutable review evidence, caller-scoped reason, owner-only assignment controls, and canonical permitted actions; verify concealment, no identity leakage, and ETag refetch. FE03:586–603; BE03b:2135–2174.

### CMS-03B-17 candidates

1. **Contract/shape:** Implement the exact queue route, strict assigned/submitted query, bounded item/page schema, closed state filter, signed cursor, and stable `(updatedAt DESC, reviewId DESC)` order. BE03b:169, 585–591, 1419–1441.
2. **Validation:** Reject unknown query keys and out-of-range limits; treat malformed cursors as 400 and expired/tampered/foreign-bound cursors as 409. BE03b:293–294.
3. **Authority/privacy:** Derive the queue from the caller’s assignments or submissions only; never scan, count, cache, or expose reviews outside that scope. BE03b:2006.
4. **Runtime bounds:** Make the read no-store and mutation-free, with 300/600 buckets, 8-second deadline, Tier 1 SLO, page ETag, default 25 and maximum 50. BE03b:169.
5. **Safe failure:** On cursor conflict require restart from page one without retaining unauthorized rows; write no audit/outbox state. BE03b:1886, 2114.
6. **Consumer/verification:** Implement assigned/submitted queue URL state and accessible pagination; verify cursor binding, scope isolation, stable order, 409 restart, and event-driven refetch rather than event-payload caching. BE03b:90, 2067–2079.

### CMS-03B-18 candidates

1. **Contract/shape:** Implement the exact assignment route, strict create/revoke discriminated request, and closed assignment resource; return 201 for create and 200 for revoke. BE03b:170, 593–607, 1442–1451.
2. **Validation:** Enforce open review, reviewer eligibility, no author/submitter/duplicate assignment, ≤16 active assignments, expiry ≤7 days and within reviewer/grantor authority, and strict reason bounds. BE03b:295–298.
3. **Authority/privacy:** Require the receipt-derived, non-grantable `cms.editorial_review.assign` owner capability and unconditional step-up; assignment grants only read/decide on one review and exposes no raw reviewer identity to non-owner consumers. BE03b:2007; DEC-136.
4. **Runtime bounds:** Require key plus exact review-version `If-Match`, 10/20 rate buckets, 15-second deadline, no-store, Tier 2, and atomic audit/event persistence. BE03b:170.
5. **Safe failure:** On stale review, ineligible/duplicate/full assignment, closed review, invalid expiry, or failed step-up, persist nothing; reconcile lost success by idempotency and retry the identifier-only event. BE03b:1887, 2115.
6. **Consumer/verification:** Provide owner-only reviewer selection/revocation with explicit step-up return, canonical refetch, no auto-replay, retained scoped draft, and tests for expiry, revocation, concealment, focus, and event refetch. Phase plan:2991–2993; FE03:586–603.

### CMS-03B-19 candidates

1. **Contract/shape:** Implement only the named internal verifier RPC with strict hashed-token request and discriminated verification result; create no browser route, proxy, or browser client type. BE03b:174–178, 608–618, 1452–1473.
2. **Validation:** Require lowercase SHA-256 token hash and exact actor/context/route/locale/audience binding against an active, unexpired, unrevoked token and active entry. BE03b:1847–1851.
3. **Authority/privacy:** Grant execute only to the registered Shard 04 delivery principal; revoke PUBLIC/anon/authenticated; never transmit or persist plaintext through the RPC. BE03b:174, 2008.
4. **Runtime bounds:** Keep verification read-safe with 500-ms RPC timeout, retries at 75/150 ms, 30-second circuit, and no audit/outbox/idempotency mutation. BE03b:178.
5. **Safe failure:** Convert unknown, ambiguous, unavailable, malformed, expired, or mismatched states into a byte-identical `valid:false` result with no draft detail; expose `revoked` only to the bound actor. BE03b:1452–1473, 1893.
6. **Consumer/verification:** Integrate only BE04c’s preview route; verify all denial causes, circuit behavior, no-store/noindex, no draft leakage, and absence from browser route/OpenAPI inventories. BE04c:87–92; BE03b:2135–2174.

### CMS-03B-20 candidates

1. **Contract/shape:** Implement the named claim and execute RPCs, batch `1..100`, bounded `ClaimedSchedule`, verified accessibility evidence, and closed execution result; create no browser route. BE03b:174–179, 1283–1298, 1475–1502.
2. **Validation:** Claim only due pending/retryable rows; execute only the matching leased version and recheck approval, manifest, revocation, publisher authority, exact identities, and all 17 preflight categories. BE03b:1853–1864, 2009.
3. **Authority/privacy:** Grant only the scheduled Worker principal; queue and claim payloads contain identifiers, versions, hashes, and correlation data—never content, comments, tokens, or authority graphs. BE03b:141–143, 2009.
4. **Runtime bounds:** Sweep every minute with batch 25; use `SKIP LOCKED`, version CAS, five-minute lease, 15-second deadline, and 15/60/300-second retry ladder capped at three attempts. BE03b:179, 1853–1864.
5. **Safe failure:** Recover expired leases, return repeat-completed executions unchanged, preserve the prior publication on blocker, use retryable state for unavailable providers, and never create duplicate lineage/events. BE03b:1853–1864.
6. **Consumer/verification:** Emit exactly one identifier-only publication event after canonical commit; make schedule/publish UIs refetch canonical state and verify multi-worker races, crash recovery, late execution/deviation, retry exhaustion, blocked state, and outbox deduplication. BE03b:2067–2079, 2135–2174.

## 3. Cross-slice dependencies and fail-closed behavior

| Dependency | Slice 11 contract |
|---|---|
| **Slice 12 — locale/taxonomy/composition, DEC-138** | S12 owns the shared `no_fallback` helper and locale preflight provider used by S11 and S15. Until present, D19 passes only when the revision contains no locale/reference requiring that provider; otherwise publication fails with `provider_unbuilt_reference`. [DEC-138:2018-2030](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/decisions.md:2018) |
| **Slice 14 — media** | S14 owns media validation/provider behavior. A revision containing media cannot be treated as valid by an unbuilt provider; D19 must fail closed. Slice 11’s structural accessibility checker receives no media in Phase 2. [BE03b:1763-1789](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1763) |
| **Slice 15 — delivery** | Shard 04 consumes CMS-03B-19 and `cms.publication.changed.v1`. Publication may be canonically committed while delivery is `pending/degraded`; `202` or `projectionState` must never be presented as public visibility. Delivery freshness/cache checks remain delivery-time gates. [BE04c:59-92](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/04c-public-delivery-cache.md:59) |
| **Slice 16 — quality gate/settings** | DEC-134 requires Slice 11 to ship `cms.a11y.structural` v1 and its in-process `quality_gate_evaluate` preflight provider. Slice 16 later adds `quality_check` actions, persisted runs, and reads using the same module. Quality warnings never authorize publication; blockers preserve the last active version. [DEC-134:1962-1973](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/decisions.md:1962), [BE05c:89-135](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/05c-portability-quality-lifecycle.md:89) |

DEC-134/D19 rules:

- Registry is immutable and forward-migration-owned, with 17 ordered categories.
- Missing domain provider uses `reference_gate`: pass only when the canonical reference count is zero; otherwise 422 `preflight_failed` with `provider_unbuilt_reference`.
- Provider failure is 422 with bounded preflight details. Provider unavailable is retryable 503 and must not reserve successful idempotency.
- Submission evaluates categories 1–16; schedule, immediate publish, and execution evaluate all 17.
- CMS-03B-15 reports unavailable outcomes read-only; it never turns them into authority or a successful publication.
- Worker accessibility evidence is accepted only for the current provider key/version, `passed` outcome, ≤60-second freshness, and exact JCS binding hash. [BE03b:1757-1789](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1757)

## 4. Proposed implementation lanes

All migration timestamps are after `20261005016999`. Only database lanes may create SQL migrations.

| Lane | Exclusive ownership | Migration allocation | Exit condition |
|---|---|---:|---|
| **1. Contract spine** | `packages/contracts/src/cms-editorial/**`, platform registry entries, generated OpenAPI/contract tests. Adds resources, operation IDs 05–09/15–18, internal schemas 19/20, errors/events/rate policies. | None | Every route/resource/error parses strictly; package registry is authoritative. |
| **2. Data model and guards** | New `supabase/migrations/20261005017000..20261005017499_*`, corresponding `supabase/tests` files. Reconciles review/decision/assignment/dependency/preflight/settings, schedule lease, preview binding, and publication lineage tables; RLS, immutable guards, indexes, grants. | `20261005017000–20261005017499` | Locked BE03b record shapes exist without rewriting historical migrations. |
| **3. Commands, reads, and internal RPCs** | New `supabase/migrations/20261005017500..20261005017999_*` plus disjoint RPC-focused DB tests. Owns `cms_submit_review`, decision/schedule/preview/publish, workflow/detail/queue/assignment, verifier, claim/execute, invalidation, audit/outbox, and preflight execution. | `20261005017500–20261005017999` | Named RPCs implement atomic CAS/idempotency/events and service grants. |
| **4. Worker/API runtime** | `apps/worker/src/cms-editorial/**` and `cms-editorial-production-*` plus colocated Worker tests. Owns Hono routes 05–09/15–18, ports/adapters, D25 checker, deadlines/rates/errors/telemetry, and scheduled handler. No SQL or web files. | None | All browser routes match policy registry; 19/20 remain internal-only. |
| **5. Web surfaces and browser verification** | `apps/web/src/**` plus web Vitest/Playwright files. Owns workflow, queue, detail, assignment, schedule, preview, publication UI/proxies, navigation, step-up recovery, accessibility/privacy tests. No contract/Worker/SQL files. | None | FE03 surfaces consume generated contracts, preserve drafts, refetch canonical state, and never leak tokens/manifests/identity. |

The lanes are dependency ordered: **1 → 2 → 3 → 4 → 5**. Database lanes may work in parallel only after their shared table/RPC boundary is frozen; their timestamp and test-file allocations must remain exclusive.

## 5. Ambiguities and decision ownership

### Owner/spec decision required

1. **Cascade accounting:** Is DEC-148’s 36-op/class cascade additive—raising Slice 11 from 48 to 84—or nested under AC035/038/041 while retaining 48? Slice 10 precedent supports additive counting; DEC-148 says its ownership edit caused no count change. Do not silently choose.
2. **Accessibility outcome vocabulary:** The registry/BE05c language uses `healthy`, while the Worker evidence clause accepts `passed`. One canonical enum is required before contracts and SQL are authored. [BE03b:1763-1789](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1763)
3. **FE03 ownership amendment:** FE03’s primary workbench union enumerates 05–09 but not the DEC-148 routes 15–18. Confirm that FE03 receives explicit workflow/queue/detail/assignment contract rows rather than treating BE03b alone as permission to alter a locked FE layer. [FE03:320-363](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/fe/03-cms-content-modeling.md:320)
4. **Locale scope contradiction:** FE03 still describes CMS-15 runtime as deferred while DEC-114/DEC-138 place the locale provider in Phase 2/Slice 12. Ratify the decision-led interpretation and amend FE03. [FE03:536](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/fe/03-cms-content-modeling.md:536)
5. **Universal review rule:** IA03 says “where workflow says review”; BE03b E11 requires every registry workflow to contain at least one reviewer. Confirm the stricter E11 rule.
6. **Locked criterion defects:** AC041 ends with `current revocation sta,`; AC035 and AC038 contain punctuation breaks. Correct and ratify the intended locked text before generating evidence identities. [Phase plan:2980-2986](/home/rob/.codex/worktrees/phase2-slice10/WeJammin/.memory/wiki/specs/phases/phase-2.md:2980)
7. **Pinned tzdb artifact:** If `CMS_TZDB_VERSION` and its exact asset/hash are contract-visible, an architecture owner must freeze the release before tests and schedule evidence are authored.

### Engineer-resolvable under existing locks

- Add missing response schemas, operation IDs, registry rows, OpenAPI generation, route modules, ports/adapters, pages/islands, and typed error projection.
- Forward-migrate the 20260927 foundation to the normative BE03b shapes; do not modify historical migrations.
- Choose SQL lock/RPC internals while preserving exact CAS, idempotency, immutability, concealment, and outbox contracts.
- Implement D19 registry rows and `provider_unbuilt_reference` behavior once the `healthy`/`passed` enum is settled.
- Select module names, page/component decomposition, indexes, and query plans within the specified bounds.
- Add contract, SQL, Worker, browser, concurrency, privacy, accessibility, and consumer verification required by the locked specifications.

The adversarial split above treats contract, authority, scope, and cross-layer contradictions as owner decisions; ordinary missing implementation and file organization remain engineering work.

exit=0
