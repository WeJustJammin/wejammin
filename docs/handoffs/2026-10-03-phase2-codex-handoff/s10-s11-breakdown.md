# Phase 2 Slices 10 and 11: implementation-ready breakdown (read-only research)

- **Worktree:** `/home/rob/.codex/worktrees/ac265-hosted-evidence-producer/WeJammin`
- **HEAD:** `a946b333` ("close DEC-108 spec gaps and complete schema-review contracts").
- **Uncommitted edits in progress by other agents:** IA03, IA03 deep dive, BE03a/03b/04a/04b/04c/05b/05c, FE00/01/03/04/05, auth and CMS-grant contracts, and S09 DEC-108 tests.
- **No repo file was edited.**

**Sources read:**
- S10/S11 trackers.
- Plan `phase-2.md` S10 (`:1842-1937`) and S11 (`:1938-2002`).
- BE03b, the full working-tree copy.
- FE03 editorial sections:
  - workbench `:336-484`
  - routes `:685-695` and `:1005-1013`
  - interactions `:712-786`
  - role matrix `:827-891`
  - mapping `:1167-1216` and `:1286-1300`
- IA03 `:31-66`, `:162-235`, `:355-453` and deep dive `:192-340`, `:402-421`.
- BE03a, only for decision/assignment/grant shapes.
- BE04a candidate review `:485-520`.
- BE04c preview-token seam `:88` and audience grammar.
- BE00 409 detail `:161`.
- The 5 S10 propagation scans.
- The survey and the decision files.
- Code:
  - `apps/worker/src/cms-editorial*`
  - `packages/contracts/src/cms-editorial/`
  - `apps/web/src/components/cms-editorial/` and the entries pages
  - migrations `20260926090000…20261001191923`
  - the S10 pgTAP and e2e suites.

**Caveat:** BE03b in the working tree already contains the DEC-109/DEC-110 propagation. Those paragraphs are at `:185-215` and `:524-546` and are not yet committed. FE03 already contains the DEC-111 step-up section at `:779-786`. Line numbers below refer to the working tree on 2026-10-02 and will drift.

---

## 0. Headline findings

1. **DEC-108 moved implementation, not accounting.**
   - The protected create (CMS-03B-10) and draft read (CMS-03B-11), plus the CMS-03B-01 append path they depend on, are S09 prerequisites (handoff `:78-80`; BE03b DEC-108 attribution after the route registry).
   - Their criteria **stay authored and counted in S10**: P2-S10-AC-061…075, and AC004-009/028-032 for 03B-01. The BE03b attribution says "consumption only — items stay counted in Slice 10's 75".
   - S10 therefore *verifies and checks* AC061-075 after S09 lands the real policy registry (DEC-109) and the real source rows. It also *extends* AC067/AC075 for D3.
2. **The binding decisions leave six source gaps that block truthful implementation.** None is in the survey:
   - **(a) No served source exists for server-derived request evidence.**
     - The CMS-03B-10 create form needs `schemaArtifact`, `validatorRefs`, `workflowPolicy` and `activationEvidence`. `new.astro` is a 503 for exactly this reason.
     - CMS-03B-05/08/09 need the `frozenHash`, `DependencyManifest` and `VersionSet`.
     - DEC-108 G8 already set the rule: the user never types JSON, and the FE prefills from a preparation projection. Preparation reads are therefore required.
   - **(b) An assigned reviewer cannot read the review it must decide.**
     - EditorialReviewResource is returned only by POSTs, so the reviewer has no source for `If-Match`.
     - IA03 CMS-08 also says "assign eligible reviewers", yet no editorial-review assignment op exists.
   - **(c) Only 8 scalar field kinds are admitted.**
     - The revision RPC refuses `rich_text`, `taxonomy`, `relation`, `media`, `object` and `list` with `DEPENDENCY_UNAVAILABLE` (`20260930140000:403-408`).
     - The comment there says "changed relation paths are fenced … until their typed encoding is owner-approved" (`:505-510`).
     - DEC-112 settles rich text only.
   - **(d) `object` has no structure contract.** It has none in 03a (Constraints `BE03a:305-322`) or IA03. That is the only remaining genuine owner decision (§5).
   - **(e) The editorial surfaces are not reachable by navigation.**
     - There is no entry list, reviewer queue or registry→entry link. `BE03b:103` locks "the only entry-aggregate routes".
     - This violates the vertical-slices rule ("reachable from the app's entry point via normal user navigation").
   - **(f) Two states have no producer.**
     - Schedule `cancelled` has no command.
     - Preview tokens are "revocable" with `revoked` in the resource, but no revoke command exists and PreviewTokenResource has no `id`.
3. **rich_text.v1 (DEC-112) must be a *flat* AST.**
   - BE03b caps values at depth 8, counted by containers (`primitives.ts:40-54`, `cms_json_depth`), and at 128 elements per array.
   - A nested tree such as `values → field → children → list → item → paragraph → children → text → marks` reaches depth 11.
   - The grammar in §2.4 fits the cap at depth 7.
4. **D19 has a sharp consequence.** Under "unbuilt domain passes only with zero references":
   - The accessibility owner (S16, D25) is unbuilt at S11.
   - If any rich-text or block content counts as an accessibility reference, S11 can only publish plain-field entries until S16.
   - Recommendation: S11 registers a `rich_text.v1` structural accessibility provider (§2.9).
5. **D20 "align with DEC-108" implies MFA on every editorial decision.**
   - DEC-108 G9 requires step-up for every schema decision.
   - BE03b `:154` says "step-up MFA for protected", and FE03 `:783` says 03B-07/09 "where protected", which contradicts BE03b's unconditional step-up on 03B-07.
   - Recommendation (security-first): 03B-06/07/09 always require recent binding MFA (§2.6).
6. **Already-decided items that S10/S11 consume from S09:**
   - DEC-109/110 policy registry, already in the BE03b working tree.
   - DEC-111 step-up page and ops, in S09 A2.
   - DEC-119 grants, CMS-03A-15..18. These now make `cms.reviewer`, `cms.reviewer.<class>` and `cms.publisher` grantable. `cms.publisher` and the specialist keys are **not yet** in `platform-registries.ts`; S09 must add them first.
7. **Hosted proof:**
   - All S10/S11 criteria are provable locally.
   - S11's happy path needs two humans (author ≠ reviewer). Locally they are provisioned via the CMS-03A-15 grant command, per S09 D3 precedent.
   - Hosted proof stays deferred (G11/D26 at S17).
   - `ENG:137` keeps protected production publication writes disabled.

---

## 1. Per-AC status matrix

**Legend:**
- **Built** = code and tests exist locally (unpromoted, unchecked).
- **Partial** = some layers exist.
- **None** = nothing exists.
- **S09** = implementation delivered by S09 under DEC-108.
- WP refers to §4.

Every criterion in both slices is unchecked (S10 0/75, S11 0/45).

### 1.1 Slice 10 (75)

| AC | Claim (short) | Existing evidence | Gap → WP |
|---|---|---|---|
| 001 | Changed-path autosave vs explicit base; truthful same-field conflict | `cms_create_revision` (latest body `20260930140000_cms_enum_field_authoring.sql`); pgTAP `phase_02_slice_10_rpc/004b,004c,006,008`; web `cms-editorial-autosave.ts`, `-entry-draft.ts`, `-runtime.ts` | Editor loader still `BOUNDARY` (`cms-editorial-entry-loader-boundary.ts:7`); base revision number not served (D3); only 8 scalar kinds and `/fields/{uuid}` paths admitted; policy row from S09 → WP-S10-3/4/5 |
| 002 | Compare/restore with recorded schema/template/taxonomy + proven chain | History compare field-only (`20260930130000`), SSR `[entryId]/revisions.astro` | D5 block/relation domains; D6 chain + `cms_restore_revision` missing → WP-S10-3 |
| 003 | Preserve input, conflict preimages, focus, canonical version through failure/rollback | Verified-error handling keeps keys and unsent values (tracker 2026-09-30 "verified editorial mutation errors"); `CmsEditorialSyncConflict.tsx` | Preimages need D2 read; no integrated editor; no Chrome proof of rollback → WP-S10-5/6 |
| 004 | 03B-01 strict contracts + happy path 201 | `cms-editorial/requests.ts`, `resources.ts`; Worker `routes.ts`; prod port; RPC; pgTAP 004b | Real path depends on the S09 policy registry. Rich text (DEC-112), other kinds, block/relation pointers and the FE editor are missing → WP-S10-1/3/4/5 |
| 005 | 03B-01 rejects unknown/invalid, no mutation | `routes-admission.test.ts`, `write-query-admission.test.ts`, contract tests | Typed violations for rich_text.v1 and relation/list encodings → WP-S10-1/3 |
| 006 | 03B-01 server-derived actor; 401/403/404; RLS | pgTAP 003b owner scope; `20260928000000_cms_assignment_acting_owner_scope.sql`; `20260927590000` conceal | Revocation mid-edit must remove presence and assignment (IA03 edge row) and has no implementation → WP-S10-3 |
| 007 | 03B-01 idempotency, If-Match, CAS, rate, deadline, concurrency | `20260930150000_cms_idempotency_business_hash.sql`; dual buckets (`route-execution.ts:35-59`); deadlines | The BE03b cap "concurrent revision writes cap at three per actor" is **not implemented** (no hit in Worker) → WP-S10-4 |
| 008 | 03B-01 typed ApiError + safe recovery | `cms-editorial-production-errors.ts`, error relay tests | New kind/AST error codes → WP-S10-4 |
| 009 | 03B-01 audit/outbox atomic, replay, redacted telemetry | RPC audit/outbox; telemetry coverage tests | Presence lease renewal in the write transaction; D12 fan-out regression → WP-S10-3 |
| 010 | 03B-02 contracts + happy 201 | `conflict-resolution.ts`, `conflict-choice.ts`; Worker `conflict-routes.ts`; RPC `cms_resolve_conflict` (+`20260927570000`); pgTAP 004c | Policy row (S09); kinds; FE native form needs D2 → WP-S10-5 |
| 011 | 03B-02 invalid input | Contract and Worker tests (`named choice forbids value`) | Kind-specific explicit values → WP-S10-3 |
| 012 | 03B-02 authz | pgTAP 004c; session RPC-body `conflict_id_mismatch` | none beyond hosted |
| 013 | 03B-02 idempotency/CAS | pgTAP exact-key replay, CAS | none |
| 014 | 03B-02 error mapping | Error relay | none |
| 015 | 03B-02 audit/outbox | pgTAP one outbox event | none |
| 016 | 03B-03 contracts + happy 200 | `revision-history.ts`; `history-routes.ts`; `cms_list_revisions_signed`; Chrome `phase-02-slice-10-*-history*.spec.ts` | D5: response gains `domain` and block/relation items plus the restore-preparation carrier (D6) → WP-S10-1/3 |
| 017 | 03B-03 invalid query → 400 | `history-routes.test.ts` (2026-09-30 read admission) | none |
| 018 | 03B-03 authz (author/editor/reviewer read) | pgTAP 005; SSR 403/404 Chrome | none |
| 019 | 03B-03 cursor, pagination, cache, rate | Signed cursor + compare binding (`20260927170000`, `20260930130000`) | Hosted Vault key (README) is not an AC requirement |
| 020 | 03B-03 errors | 503 when signing key missing | 512-change overflow typed refusal (D5) → WP-S10-3 |
| 021 | 03B-03 no mutation, telemetry | Read-only RPC | none |
| 022 | 03B-04 contracts + happy 201 | `revision-restore.ts`; `restore-routes.ts` (port absent → 503); web proxy `revisions/[revisionId]/restore.ts` | **No RPC**; D6 chain manifest; restore form → WP-S10-3/4/5 |
| 023 | 03B-04 invalid input | Route admission tests | Chain-specific violations → WP-S10-3 |
| 024 | 03B-04 authz | none (no RPC) | WP-S10-3 |
| 025 | 03B-04 idempotency/CAS/rate | Rate seam consumes quota (`cms-editorial-production-types.ts:150`) | Full → WP-S10-3/4 |
| 026 | 03B-04 errors | 503 boundary | WP-S10-4 |
| 027 | 03B-04 audit/outbox/replay | none | WP-S10-3 |
| 028 | entryId UUID → 400/404 | Built | none |
| 029 | baseRevision positive decimal → 422/409 | Built (RPC) | FE source = D3 `revisionNumber` |
| 030 | changedPaths 1–128, bound to field/block/relation IDs | Field pointers only (`20260930140000:384-390` regex `/fields/{uuid}`) | Block pointers belong to S12 composition (`/blocks/…` refuse until a composition write path exists). Relation paths need an encoding (§2.5) → WP-S10-3 |
| 031 | values strict, 128/8/256 KiB; rich text = AST | Bounds built (`primitives.ts:70-84`); rich text refused (`20260927540000`) | DEC-112 grammar plus validator; other kinds (§2.5) → WP-S10-1/3 |
| 032 | locale/expectedVersion | Built | none |
| 033 | conflictId: same entry, unresolved | Built | none |
| 034 | choices 1–128 strict; explicit value validates | Built for scalar kinds | Other kinds → WP-S10-3 |
| 035 | cursor/limit | Built | none |
| 036 | compareRevisionId/locale | Built | none |
| 037 | revisionId/migrationChainId; chain covers source→active | Admission only | D6 → WP-S10-3 |
| 038 | 03B-05 frozenHash 64-hex = normalized hash | **None** (no S11 schemas) | G3 lock in S10 contracts; the semantic 409 is only provable with S11 RPCs (§2.10) |
| 039 | 03B-05 dependencyManifest strict ≤256/32 KiB | None | G3 |
| 040 | 03B-05 riskClass ordinary/protected | None. **The request has no riskClass field** (`BE03b:449-454`; matrix says derived) | Reword (§2.10) + G3 |
| 041 | 03B-06 decision/reason | None | G3 |
| 042 | 03B-06 stepUpAt/capability | None | **D20 removes both fields**: reword to "caller capability/stepUpAt rejected; derived" + G3 |
| 043 | 03B-07 localDateTime/timezone | None | G3 |
| 044 | 03B-07 resolvedUtc/tzdb/disambiguation; nonexistent rejected | None | G3; nonexistent-time rejection is server semantic (S11) |
| 045 | 03B-07 action enum | None | G3 |
| 046 | 03B-08 versionSet strict; stale 409 | None | G3; 409 is S11 |
| 047 | 03B-08 audience/route | None | G3 + audience grammar drift vs BE04c (§2.7) |
| 048 | 03B-09 frozenHash/expectedVersionSet | None | G3 + add `audience` (§2.7) |
| 049 | Mutation headers incl. create exception | `admission-headers.ts` + tests | none |
| 050 | CMS-05 IA: bootstrap, load draft, autosave, server-derived context | Create/read/append RPCs (S09-hardened) | Authoring-context read, D3, FE editor, presence lease (§2.8) → WP-S10-3/5 |
| 051 | CMS-05 failure/recovery (revocation, concurrency, deletion, cascade) | Partial (RPC refusals) | Revocation removes presence/assignment; Chrome → WP-S10-3/6 |
| 052 | CMS-05 FE native create/edit forms | `new.astro:49,65` renders "Entry creation is unavailable"; `[entryId].astro` read-only | Create form + editor (all kinds, rich text editor), focus/announce/retain, entry list nav → WP-S10-5 |
| 053 | CMS-06 IA behaviour | Resolve RPC built | Three-way values need D2 → WP-S10-3 |
| 054 | CMS-06 failure/recovery | moved-base 409 built | D2 refetch-after-409 → WP-S10-5 |
| 055 | CMS-06 FE native conflict form | None (transport only) | Page `entries/[entryId]/conflicts/[conflictId].astro` + island → WP-S10-5 |
| 056 | CMS-07 IA behaviour | Field compare only | D5, D6 → WP-S10-3 |
| 057 | CMS-07 failure/recovery | Concealment built | Refused restore leaves history intact → WP-S10-3 |
| 058 | CMS-07 FE compare/restore | SSR history + compare (no restore form, "never renders … a restore mutation") | Restore confirmation form + domain-grouped diff → WP-S10-5 |
| 059 | TDD order + canonical validation | Process | WP-S10-6 |
| 060 | Tracking, ledger, runbooks, graph | Process | WP-S10-6 |
| 061–066 | 03B-10 create (contracts, invalid, authz, idempotency, errors, atomicity) | **S09 (DEC-108 prerequisite)**: Built locally; production create fails closed (`cms_editorial_workflow_policy_evidence` returns NULL, `20260927080000:60-84`) until the DEC-109 registry migration | Verify after S09; no new S10 code beyond the FE create form (AC052) |
| 067 | 03B-11 read contract incl. schema identity + canonical versions | **S09** Built (`entry-draft-detail.ts`; `cms_get_entry_draft`) | **D3**: add `revisionNumber`, `schemaVersionId` (+ `openConflict`, §2.2); reword AC067 → WP-S10-0/1/3 |
| 068–072 | 03B-11 invalid / authz / ETag no-store / errors / read-only | **S09** Built (tracker 2026-09-30 malformed-locale entry, SSR 403 entry) | Verify only |
| 073–074 | 03B-10 field validation | **S09** Built | Rich-text/kind admission inherits WP-S10-3 |
| 075 | 03B-11 field validation; no fabricated draft | **S09** Built | D3 reword (schema identity now explicit) |

### 1.2 Slice 11 (45)

Existing artifacts:
- Six private tables from `20260927090000_cms_editorial_support_authority.sql`: `cms_editorial_reviews`, `cms_editorial_decisions`, `cms_publication_schedules`, `cms_publication_versions`, `cms_preview_tokens` and `cms_edit_presence`.
- Their schema pgTAP (`phase_02_slice_10_remaining_schema/001-003`).

Nothing else exists: no RPC, Worker route, contract, page or schedule worker.

| AC | Claim (short) | Evidence | Gap → WP |
|---|---|---|---|
| 001 | Freeze hash/deps; author≠reviewer; protected approval with recent MFA | Tables only | Submit/decision RPCs; distinctness trigger (DEC-108 G7 pattern); D20; DEC-110 slots → WP-S11-3 |
| 002 | Local→UTC with IANA + tzdb; reject gaps/folds | Columns only | Server tz resolution + tzdb identity (risk R3) → WP-S11-3/4 |
| 003 | Preview token binding; recheck every open | Table only | Mint RPC + BE04c `Shard 03 preview-token verifier` seam (`BE04c:88`) + revoke op (§2.7) → WP-S11-3 |
| 004 | Publish only after all gates re-pass | None | D19 preflight registry (§2.9) → WP-S11-3 |
| 005–010 | 03B-05 contracts, invalid, authz, CAS/one-open-review, errors, audit/outbox | Table + partial unique `(revision_id) WHERE state IN ('open','approved')` | Everything: workflow-preparation read (§2.7), manifest server recompute, preflight run persistence, review-invalidation trigger on new revision → WP-S11-1..6 |
| 011–016 | 03B-06 | Table (decisions `capability NOT NULL`, `step_up_at NULL`) | D20 contract; assignment model (§2.6); `step_up_at` NOT NULL; DEC-110 slot evaluation (BE03b working-tree `:203-209`) → WP-S11-1..6 |
| 017–022 | 03B-07 | Table (no `audience` column) | Contracts; schedule RPC; cron sweep + queue consumer; cancel op; audience column → WP-S11-1..6 |
| 023–028 | 03B-08 | Table | Mint (plaintext once, hash persisted), verify seam, revoke op, `id` on resource → WP-S11-1..6 |
| 029–034 | 03B-09 | Table | Publish RPC with atomic PublicationVersion + supersession + outbox; `projectionState` pending until S15 consumers → WP-S11-1..6 |
| 035 | CMS-08 IA | None | Review detail read + assignment + reviewer queue (§2.6) |
| 036 | CMS-08 recovery (self-approval, stale hash, revoked reviewer, missing reviewer, invalidation) | None | WP-S11-3 |
| 037 | CMS-08 FE | None | Review queue/detail/decision pages + submit form → WP-S11-5 |
| 038 | CMS-09 IA | None | WP-S11-3/4 |
| 039 | CMS-09 recovery (DST, blocked at execution, late/duplicate run) | None | WP-S11-3/4 |
| 040 | CMS-09 FE | None | Schedule form with DST disambiguation UX → WP-S11-5 |
| 041 | CMS-13 IA (preview, diff vs active, publish) | None | "Diff to active projection" = 03B-03 compare with `compareRevisionId` = active publication revision (from the workflow read) → WP-S11-3/5 |
| 042 | CMS-13 recovery (forwarded/revoked token, version-set race, last-known-good) | None | Version-set 409; LKG belongs to S15 consumers. S11 proves canonical state only → WP-S11-3 |
| 043 | CMS-13 FE | None | Preview + publish forms → WP-S11-5 |
| 044–045 | Process | n/a | WP-S11-6 |

---

## 2. Spec cascade (what a spec worker writes)

**Ground rules:**
- One writer per file.
- Run after the in-flight S09/S12/S13 cascades on the same files commit.
- Say only what sources and decisions say.
- Never put corpus counts in spec files.
- Every section listed below gets a changelog row in its file plus `be/index.md` and `fe/index.md`.

### 2.1 D2: protected conflict-detail read

**BE03b changes:**

- **Endpoint reconciliation (`:88-103`):** add a CMS-06 row for `CMS-03B-12 GET /api/v1/cms/entries/{entryId}/conflicts/{conflictId}`. Change the "eleven" wording and the `:103` "only entry-aggregate routes" sentence to name the new reads (also see §2.8).
- **Route registry row:**
  - Request/response: `ConflictDetailQuery → 200 ConflictDetailResource`.
  - Authority: assigned author/editor with read on the entry. Hidden or absent entry/conflict → 404; a visible entry without assignment → 403.
  - Middleware: BE00 order, CORS cms-console, no CSRF (safe read).
  - Read semantics: safe read with no Idempotency-Key or If-Match. Strong authenticated ETag over `conflict.version`+`entry.version`.
  - Limits: 300/min/user, 600/min/party; 8,000 ms; no-store; Tier 1 p95 <750 ms. No event.
- **Registry invariants:** add 03B-12 to the "strong no-store ETag" list.
- **Validation matrix:**
  - `CMS-03B-12 entryId/conflictId`: UUIDs; the conflict must belong to the entry → 400/404.
  - `CMS-03B-12 query`: no keys accepted → 400.
- **Zod:**

  ```ts
  const ConflictSide = z.strictObject({ value: Json.nullable(), provenance: <EntryDraftFieldValue provenance enum>, valueHash: Hash.nullable() });
  const ConflictDetailPath = z.strictObject({ path: JsonPointer, base: ConflictSide, theirs: ConflictSide, yours: ConflictSide });
  const ConflictDetailResource = z.strictObject({
    conflict: ResourceMeta.extend({ state: ConflictRecordState, changedPaths: z.array(JsonPointer).min(1).max(128), conflictHash: Hash }),
    entry: ResourceMeta,
    base: z.strictObject({ revisionId: UUID, revisionNumber: Version, schemaVersionId: UUID, contentHash: Hash }),
    theirs: <same>,
    yours: z.strictObject({ source: ConflictYoursSource, revisionId: UUID.nullable(), contentHash: Hash }),
    paths: z.array(ConflictDetailPath).max(128),   // empty unless state==='open'
    resolvedRevisionId: UUID.nullable(),
  });
  ```

  Values are bounded by 256 KiB total and are schema-typed against `base.schemaVersionId`/`theirs.schemaVersionId`.
- **Privacy:**
  - Fields the caller cannot read are omitted, never placeholdered with data.
  - **No `resolvedByPersonId`.** The existing `ConflictRecordResource` (`:648-656`) exposes a person UUID and conflicts with the "no ownership identifiers in browser envelopes" invariant (`:170`).
  - Recommendation: drop `resolvedByPersonId` from the browser projection of ConflictRecordResource as well. This is a mechanical privacy correction, so call it out in the changelog.
- **Data flow:** read-only RPC `platform_api.cms_get_conflict_detail`. It loads the open record and the three snapshots under RLS, emits no audit/outbox and has no side effects.
- **Error matrix and operation coverage:** add rows mirroring 03B-11.
- **Tests:** concealment, cross-tenant, resolved/superseded metadata-only, values-bounded, ETag change after 409.
- **Conflict discovery (needed, not in D2):**
  - The 03B-01 409 returns only `conflictHash` (`20260930140000:470-474`, matching BE03b `:896`).
  - Recommendation: keep the 409 minimal and add `openConflict: { conflictId: UUID, version: Version, conflictHash: Hash } | null` to `EntryDraftDetailResource` (with D3). The editor refetches the draft after a 409, so the open conflict survives reload and multiple tabs.
  - The 409 details add only `recoveryAction: 'resolve_conflict'`, as the BE00 `:161` shape requires a `recoveryAction`.

**IA03 changes:**
- CMS-05 and CMS-06 Contracts/Editorial Lifecycle: add a "Conflict detail" row stating the protected three-way read. The concealment and no-store rules are as for draft detail.
- Edge Cases: add "conflict detail requested after resolution → metadata only, no preimages".

**FE03 changes:**
- Page/route tables (`:685-695` and `:1005-1013`): add `/app/cms-content-modeling/entries/:entryId/conflicts/:conflictId`.
- Workbench operation union (`:376-470`): add the GET.
- Interaction row CMS-06: "protected conflict-detail load then native explicit-choice form; 409 → refetch detail, retain choices for unchanged paths".
- Data mapping (`:1167-1216`).
- AsyncState enumeration for conflict detail (idle/loading/success/empty-not-open/error per class).
- Role variants (assigned author/editor full; others 403 gate/404).
- a11y row: a radio group per path with three labelled preimages plus an explicit value control; error summary.

**Contracts:** `packages/contracts/src/cms-editorial/conflict-detail.ts` (+ test). Add the route row and registry row.

### 2.2 D3: draft base and schema identity

**BE03b changes:**
- `EntryDraftDetailResource` (`:822-832`) gains:
  - `revisionNumber: Version`, server-derived from `cms_entry_revisions.revision_number`.
  - `schemaVersionId: UUID`, the verified current draft schema.
  - `openConflict` (§2.1).
- Add to CMS-03B-11 data flow, the validation row, and tests: first and later revision, schema mismatch refusal.
- Add the sentence: "`baseRevision` for CMS-03B-01 is `revisionNumber`; `expectedVersion` is `entry.version`; the composite GET ETag is a representation validator, not the numeric `If-Match`" (scan `…draft-revision-number:38-44`).

**Other files:**
- IA03 Editorial Lifecycle "Draft detail" row and deep dive `:315-317`: "schema identity" becomes explicit (`schemaVersionId`, `revisionNumber`).
- FE03 CMS-05 data mapping (`:1182`) and the CMS-15 mapping: the editor builds `baseRevision` from `revisionNumber`. Field definitions come from the authoring-context read (§2.8), never from a caller-chosen schema.
- **Plan/tracker:** reword P2-S10-AC-067 and AC-075 to name `revisionNumber`, `schemaVersionId` and `openConflict`. They stay S10 criteria; per §0 they are verified after S09.
- **SQL:** forward-only replacement of `platform_private.cms_get_entry_draft` and its `platform_api` wrapper.

### 2.3 D5: three-domain comparison

**BE03b `RevisionHistoryPage.compare.changes` item** becomes:

```ts
z.strictObject({ domain: z.enum(['field','block','relation']), path: JsonPointer, kind: <existing 4>, leftHash: Hash.nullable(), rightHash: Hash.nullable() })
```

**Pointer grammar (normative):**
- field: `/fields/{stableFieldId}`, unchanged.
- block: `/blocks/{compositionInstancePath}`, the `cms_composition_instances.path` (BE03c `:655`) of the revision.
- relation: `/relations/{stableFieldId}/{targetToken}`.
  - `targetToken` is the lowercase hex HMAC-SHA-256 over JCS `{entryId, fieldId, targetKind, targetId}`, keyed by a server key with domain separator `cms.compare.relation.v1`. It reuses the Vault-held history-signing key, so no new secret is needed.
  - A keyed token, rather than a bare hash, stops a reader confirming a guessed hidden target UUID.
  - **Orchestrator confirm:** D5 says "relation-definition ID". Relation definitions are per field *version*, so a definition-ID key would report every relation as removed/added across a schema change. Use the stable field ID and record the definition version inside the side hash.

**Side hashes:**
- field: `valueHash` (JCS SHA-256 of the normalized value, locale-scoped).
- block: JCS SHA-256 of `{blockKey, blockVersion, blockRegistryDigest, mode, patternRef, props, bindings}`.
- relation: JCS SHA-256 of `{relationDefinitionVersion, position, expectedTargetVersion}`.

Hashes never include target IDs. Hidden or unavailable targets are compared by token only.

**Ordering:** domain (field, block, relation), then path (bytewise UTF-8).

**Refusal:**
- More than 512 combined changes → 422 `VALIDATION_FAILED`, violation `/compareRevisionId`, reason `comparison_too_large`. Never a truncated 200.
- An unresolvable recorded schema/template/taxonomy version or block registry digest → typed non-disclosing 422 reason `comparison_unavailable`.

**Snapshot:** the right side is the newest readable revision at the requested locale at read time. The response names both IDs, and the FE uses `leftRevisionId` for restore.

**Other files:**
- `RevisionHistoryCompareSchema` doc changes from "safe field diffs" to "field, block and relation". IA03 is already correct.
- FE03 CMS-07 row: the semantic linear change list grouped by domain (BE03b accessibility handoff `:1131`), plus states for `comparison_too_large`/`unavailable`.
- Tests: every field kind, block add/remove/move/prop change, pattern link/detach, relation add/remove/reorder/hidden target, version drift, 513-change overflow, cross-owner concealment, Chrome compare.

### 2.4 DEC-112: `rich_text.v1` grammar, validator and renderer

**Write the grammar into BE03b**, either as a new subsection "Rich text value grammar" under Request/Response Contracts or as a shared reference cited from BE03a FieldKind and FE03.

```ts
const RichTextMark = z.enum(['bold','italic','code']);            // canonical order = this order
const RichTextLink = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('https'),    href: <absolute https URL, ≤2048, host required, no userinfo, no control chars> }),
  z.strictObject({ kind: z.literal('mailto'),   address: <addr-spec subset, ≤254> }),
  z.strictObject({ kind: z.literal('internal'), route: <BE04a normalized_path grammar; leading '/', no '//', '.', '..', scheme, query or fragment; ≤2048> }),
]);
const RichTextSpan = z.strictObject({ text: z.string().min(1) /* NFC, no C0/C1 except U+000A */, marks: z.array(RichTextMark).max(3) /* unique, canonical order */, link: RichTextLink.optional() });
const RichTextBlock = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('paragraph'), spans: z.array(RichTextSpan).max(128) }),
  z.strictObject({ type: z.literal('heading'), level: z.union([z.literal(2), z.literal(3), z.literal(4)]), spans: z.array(RichTextSpan).min(1).max(128) }),
  z.strictObject({ type: z.literal('list_item'), list: z.enum(['bulleted','numbered']), depth: z.union([z.literal(1), z.literal(2), z.literal(3)]), spans: z.array(RichTextSpan).max(128) }),
  z.strictObject({ type: z.literal('quote'), spans: z.array(RichTextSpan).min(1).max(128) }),
]);
const RichTextV1 = z.strictObject({ format: z.literal('rich_text.v1'), blocks: z.array(RichTextBlock).min(1).max(128) });
```

**Normative rules:**
- **Flat representation (required by the depth-8 cap, §0.3).**
  - A list is a maximal run of consecutive `list_item` blocks with the same `list`.
  - `depth` may increase by at most 1 from the previous `list_item`, and the first item in a run has depth 1.
  - A multi-paragraph quote is consecutive `quote` blocks.
  - Container depth of a stored value is ≤7.
- **Canonical form only:**
  - Text is NFC.
  - No empty spans.
  - Adjacent spans with equal `marks`+`link` are merged.
  - `marks` are unique and in enum order.
  - `link` is absent rather than null.
  - Non-canonical input is refused with 422 reason `rich_text_not_canonical`. Refusing, rather than canonicalizing server-side, keeps client and server `valueHash` equal.
- **Bounds:** only existing caps apply:
  - 128 blocks, 128 spans per block (BE03b "arrays 128").
  - 256 KiB per request.
  - 03a `minLength`/`maxLength` bound the total NFC text length across all spans.
  - Link limits are as above.
- **No inline embeds, images, HTML, CSS, attributes or unknown keys.** Media goes through governed blocks.
- **Hash:** `valueHash` = JCS SHA-256 of the canonical value.
- **Validator identity:**
  - The kind is intrinsically validated by `format`. A code-owned `CMS_RICH_TEXT_FORMATS = ['rich_text.v1']` is mirrored by `platform_private.cms_rich_text_v1_valid(jsonb)`.
  - A field-level 03a `validatorKey` stays optional and additive.
  - New formats ship only as code plus a forward migration.
  - This avoids reopening S09's frozen 03a validator registry. **Orchestrator confirm.**
- **Link targets:** routes are not checked at save. The publication `route` preflight checks them (§2.9).
- **SQL:** a forward migration replaces the refusal in `20260927540000`. It keeps the preflight that no legacy non-AST rows exist.
- **Renderer:**
  - Typed React/Astro components: `<p>`, `<h2-4>`, grouped `<ul>/<ol><li>`, `<blockquote>`, `<strong>/<em>/<code>`, `<a>`.
  - https links get `rel="noopener noreferrer"`.
  - No `dangerouslySetInnerHTML`; CSP-safe.
  - SSR-capable so S15 public delivery reuses it.
- **Editor (FE03, "constrained native editor"):**
  - Block rows of native controls: a type `<select>`, level/list/depth selects, and a `<textarea>` per block.
  - Inline marks and links are authored with a documented constrained markup subset: `**bold**`, `_italic_`, `` `code` ``, `[text](href)`. It is parsed deterministically to canonical spans, with a live preview via the renderer.
  - The FE spec defines labels, keyboard handling and validation summary rows.
  - This is an FE implementation choice within DEC-112; the FE spec owner may refine it.

**Files:**
- BE03b: contracts, security controls `:996`, testing `:1123`.
- BE03a: FieldKind note, one sentence plus the min/maxLength semantics for `rich_text`.
- FE03:
  - component inventory: `CmsRichTextEditor`, `CmsRichTextRenderer`
  - form-by-source row
  - a11y rows
  - testing
- IA03: field kinds note "rich_text values are `rich_text.v1` AST".
- Architecture §Security already requires an AST; no change.

### 2.5 Other field-kind encodings (gap (c), consistency resolutions)

BE03b subsection "Value encodings by field kind":
- **relation:**
  - Value shape: `{ targets: [{ targetId: UUID, expectedTargetVersion: Version | null }] }`, ordered, with `position` = index.
  - Length is bounded by the 03a RelationDefinition `min`/`max` and by 512.
  - `targetKind`, projection and `onUnavailable` come only from the immutable definition, mirroring `EntryDraftRelation` `:807-820`.
  - Content targets resolve now.
  - Domain-kind targets resolve only through a registered domain projection. If none is registered: typed 422 reason `relation_target_unavailable` (D19 pattern).
- **list:**
  - An array of `itemKind` values.
  - `itemKind` must be a scalar kind or `enum`. Nested `list`/`object`/`relation`/`media`/`rich_text` items are refused at activation by 03a. **Orchestrator confirm:** this touches 03a compile rules.
  - Count ≤128.
- **taxonomy:**
  - Value shape: `{ termIds: UUID[] ≤ 128 }`, persisted as 03c `TermAssignment` rows bound to the active TaxonomyVersion.
  - Provider: S12 (D10). Until the taxonomy-version activation op exists, a non-empty value fails closed with typed reason `taxonomy_source_unavailable` (D19 pattern).
- **media:**
  - Value shape: `{ assetId: UUID, assetVersion: Version }` (or an array per list).
  - Provider: S14 (BE04b DLV-04B). Until then, a non-empty value fails closed with reason `media_source_unavailable`.
- **object:** owner decision O1 (§5). Until decided, refuse at write with reason `object_kind_unspecified`. No untyped pass-through (`BE03b:255`).
- **Pointers:** `/fields/{uuid}` for all field kinds. `/blocks/…` is refused by 03B-01 until a composition write path exists (S12 owns composition writes).
- **S10 AC030** wording ("bound to stable field/block/relation IDs"): relation values are addressed through their field pointer. Note this in the plan rewording.

### 2.6 D20: decision request and the reviewer model (S11 contracts locked in S10)

**BE03b changes:**
- `EditorialDecisionRequest` becomes `{ reviewId, decision, reason, expectedVersion }`, strict.
- The validation matrix row `CMS-03B-06 stepUpAt/capability` (`:239`) becomes "caller `capability`/`stepUpAt` are unknown keys → 422; the reviewer, slot capability and MFA are server-derived".
- Missing or stale MFA → 401 `STEP_UP_REQUIRED` `{ recoveryAction: 'step_up', allowedMethods: string[] }`, reusing BE03a/BE00 and `step-up-required.ts`. `stepUpIsFresh` tolerates +30 s skew (A2).
- Persist the server-derived `capability` (the slot the decision satisfies) and `step_up_at` (binding MFA instant). Forward migration sets `cms_editorial_decisions.step_up_at NOT NULL`; no rows exist.
- **MFA scope:** "align with DEC-108" means every editorial decision (ordinary and protected) requires recent binding MFA. Route row `:154` "step-up MFA for protected" becomes "step-up MFA". **Orchestrator confirm**; security-first supports it.

**Reviewer eligibility model (orchestrator resolution, DEC-108/DEC-115 precedent):**
- IA03 CMS-08 says "assign eligible reviewers"; BE03b `:154` says "reviewer capability and assigned review"; there is no assignment op.
- Recommend the DEC-108 machinery shape:
  - New `CMS-03B-17 POST /api/v1/cms/reviews/{reviewId}/assignments` with a create/revoke discriminated union, identical in shape to `SchemaReviewAssignmentRequest` (`BE03a:557-570`).
  - Caller: the receipt-derived owner holding owner-only `cms.editorial_review.assign`, with step-up.
  - Assignee: an existing org human who currently holds `cms.reviewer`. For a specialist slot, the human must hold the specialist capability through a grant, never through the assignment alone (DEC-110).
  - Not the submitter. At most 7 days and ≤ grantor authority.
  - New private table `cms_editorial_review_assignments` (G6 envelope).
  - A decision requires active assignment + current grant + MFA.
- **Alternative (cheaper, weaker match to sources):** grant-only eligibility with no assignment. Rejected because IA03 explicitly lists an assignment step.

**Other changes:**
- Decision rows gain `assignment_id`/`assignment_version` (G6 pattern).
- Submitter ≠ reviewer is enforced by trigger (G7 pattern).
- `cms.editorial_review.assign` joins the owner-only/non-grantable list (BE03a `:239` and IA03 `:200-205`), alongside `cms.schema_review.assign` and `cms.delivery_review.assign`.

**Plan/tracker:** reword P2-S10-AC-042 (D20) and P2-S10-AC-040 (riskClass is derived; a caller `riskClass` is an unknown key).

**FE03:** the CMS-08 decision row's precondition "capability" becomes "server-derived"; step-up via `/step-up?returnTo=` is already present at `:779-786`.

### 2.7 Other S11 contract corrections to lock in S10 (G3)

- **Audience:**
  - `PublicationRequest` and `PublicationScheduleRequest` have no `audience`, yet `PublicationVersion.audience` is NOT NULL and unique per `(entry, locale, audience)`.
  - Add `audience` to both requests.
  - Adopt the BE04c deliverable grammar `^[a-z0-9_-]{1,48}$` (`BE04c:108,244`) for Preview/Schedule/Publication audience. BE03b's `1-64 with '.'` (`:473`, `:765-770`) can produce undeliverable audiences, so this is a mechanical cross-layer correction (G6-style).
  - Schedule table gains an `audience` column, and its unique key includes it.
- **Preview token:** `PreviewTokenResource` gains `id: UUID`. Add `CMS-03B-18 POST /api/v1/cms/previews/{previewId}/revoke` (`{expectedVersion}`, If-Match, Idempotency-Key) to produce the `revoked` state the resource already exposes. Recommend revoke authority = the minting user or a publisher.
- **Schedule cancel:** add `CMS-03B-19 POST /api/v1/cms/publication-schedules/{scheduleId}/cancel` (`{expectedVersion}`) so the `cancelled` state has a producer (enum-padding rule, both ways). Only `pending` schedules can be cancelled; `executing` → 409.
- **Preview verify seam (internal, consumed by S15 DLV-DEL-API-02):**
  - Name `platform_api.cms_verify_preview_token` with exactly the BE04c `:88` request/response.
  - Service-role only, side-effect free, with every binding rechecked.
  - This lets S11 prove AC003 "recheck every open" in pgTAP without S15's route.
- **Workflow preparation read (gap (a)):**
  - `CMS-03B-15 GET /api/v1/cms/entries/{entryId}/workflow?locale=` → `EntryWorkflowResource`. Fields:
    - `revisionId` (current draft)
    - server-computed `frozenHash`, `dependencyManifest`, `versionSet`
    - `preflight[]` safe results (§2.9)
    - `review` summary (id, version, state, required/recorded counts, riskClass)
    - `schedules[]` (≤20 pending/recent)
    - `activePublications[]` (`{publicationVersionId, revisionId, locale, audience, publicationHash, state}`)
    - `permittedNextActions`
  - no-store; ETag; 404/403 as 03B-11.
  - The FE echoes the frozen values back into 03B-05/08/09, and the server recomputes and compares (409 on drift). This is the DEC-108 G8/`activationPreparation` precedent.
- **Review detail read (gap (b)):**
  - `CMS-03B-16 GET /api/v1/cms/reviews/{reviewId}` → `EditorialReviewDetailResource`. Fields:
    - review resource
    - frozen candidate values (bounded, typed, same shape as draft-detail fields/relations)
    - comparison to the active publication revision (D5 shape)
    - decision summary without reviewer UUIDs (display labels only)
    - owner-only `assignments[]` safe summary (S09 WP2c precedent)
    - `permittedNextActions`
  - Authority: submitter, entry editors, or assigned reviewer. DEC-108 CMS-03A-13 analogue.
- **Reviewer queue (gap (e)):** `CMS-03B-20 GET /api/v1/cms/reviews?state=&cursor=&limit=` returns reviews where the caller is assigned or is the submitter. Signed cursor, 1–50.
- **D12 event shape (BE03b event table `:1044`):** `cms.localization.changed.v1` dedupe is per `(entryId, locale)` with a per-locale aggregate version (BE03c owns it; S12 applies it). S10 adds only the regression: a revision write with ≤32 dependent locales completes within its deadline and emits one deduped event per locale.

### 2.8 S10 reachability and authoring-context gaps (orchestrator resolutions)

- **Authoring context read (gap (a)):**
  - Support read `cmsEntryAuthoringContextRead GET /api/v1/cms/entries/authoring-context?contentTypeVersionId=`, following the `cmsTemplateContextRead` precedent (FE03 `:748-760`).
  - Without the query parameter it returns the author/editor's creatable active content types, each with exact `contentTypeVersionId`, `schemaArtifact`, `validatorRefs`, `workflowPolicy` and `activationEvidence` (the 03B-10 request evidence).
  - With `contentTypeVersionId` it returns the author-safe field-definition projection: stable field ID, key, kind, constraints, required, default, localization, editorConfig, relation definition summary.
  - No-store; scoped to `cms.author`/`cms.editor`; does not grant `cms.schema_registry.read`.
  - Unblocks AC052, which `new.astro` documents.
- **Entry list (gap (e)):**
  - `CMS-03B-13 GET /api/v1/cms/entries?state=&contentTypeId=&cursor=&limit=` → `EntryListPage` of the caller's assigned entries (id, version, contentType label, lifecycle, current draft `revisionNumber`, `state`, `updatedAt`). Signed cursor 1–50.
  - Plus a nav link from `/app/cms-content-modeling` and an `/app/cms-content-modeling/entries` page.
  - This replaces the `:103` "only entry-aggregate routes" sentence.
- **Presence (IA03 CMS-05 "acquire a renewable presence lease"):**
  - FE03 `:1293` keeps `EditPresence` out of browser unions, so no browser op is needed.
  - Recommend that CMS-03B-10 and CMS-03B-01 acquire or renew the lease in their transactions via a named private `cms_renew_edit_presence`.
  - Authority revocation (assignment revoked or grant lapse observed at the next write) removes the lease. The lease stays advisory.
  - State this in BE03b data flow `:1006-1008` and IA03.
- **Restore preparation (D6 carrier):** see §2.11.
- **Concurrency cap:** BE03b `:1000` "concurrent revision writes cap at three per actor" needs an implementation location. Recommend a Worker per-actor in-flight counter scoped to the isolate, backed by an RPC advisory-lock count. If it cannot be enforced across isolates, the spec must say which layer enforces it. **Flag for the BE03b owner.**

### 2.9 D19: preflight registry (S11)

**BE03b data flow `:1016` gains a "Preflight registry" subsection:**
- **Registry shape:** a code-owned `CMS_EDITORIAL_PREFLIGHT_REGISTRY` (TS) mirrored by an immutable seeded PG table. Each member has:
  - `category`
  - `version`
  - `owningShard`
  - `providerKey`/`providerVersion` (or `null` when the owning domain is unbuilt)
  - `referenceKinds`: which `DependencyManifest` keys, field kinds or link kinds count as references
- **Categories:** the union of BE03b `:1016` and plan AC004:
  - contract (schema/artifact/validators)
  - settings
  - template, block, pattern
  - relation
  - locale
  - migration
  - domain_binding
  - route, seo
  - media
  - rights
  - privacy, security
  - accessibility
  - revocation
- **Rule (D19):**
  - With a registered provider, the provider decides `pass|fail` with a `blockerCode`.
  - With no provider: `pass` iff the frozen manifest has zero references of that category's `referenceKinds`, otherwise `fail` with `blockerCode: '<category>_provider_unavailable'`.
  - Run at submit, schedule execution and publish.
  - Persist results in an append-only `cms_editorial_preflight_runs` table, keyed by (review|schedule|publication, category, providerVersion, outcome, blockerCode).
- **`DependencyManifest.checker`:** set to `{key:'cms.editorial.preflight', version:<registry version>}`. The registry version *is* the checker version, so later slices bump it when they register providers.
- **Provider availability at S11:**

  | Category | Provider status at S11 |
  |---|---|
  | contract, migration, domain_binding | registered (S09) |
  | settings | registered (S07) |
  | relation | registered (S10, content targets) |
  | template, block, pattern, locale | S12 |
  | route, seo | S13; internal rich-text links are route references |
  | media | S14 |
  | revocation, privacy holds | S15/S16 |
  | accessibility | S16 (D25) |
  | rights | outside Phase 2 |

- **Accessibility consequence (orchestrator confirm):** recommend S11 registers a `rich_text.v1` structural accessibility provider (heading order 2→3→4 without skips; non-empty link text). The checks are on S10's own grammar, which is more work now. S16 extends the provider to blocks and media. Without it, any entry containing rich text fails the accessibility preflight until S16.
- **Execution-time authority:**
  - Sources say an "approved candidate remains invalid if … authority changes" (IA03 CMS-08) and that execution rechecks evidence (`:1016`).
  - So schedule execution rechecks the approving reviewers' current grant and assignment (G10 precedent). It does not recheck the scheduling publisher's grant, which was exercised with step-up at creation.
  - A lapsed reviewer leaves the schedule `blocked` with `blockerCode: 'review_authority_lapsed'`.
  - Operational note for the runbook: DEC-119 grants last ≤7 days, so a schedule more than 7 days out needs grant renewal.

### 2.10 Plan/tracker AC rewording (orchestrator, D4 precedent)

- **AC038–048** (S11 request validation inside S10):
  - Their 409 and server-semantic clauses (hash equality, stale set, nonexistent local time, two-person policy) are provable only with S11 RPCs.
  - Recommend rewording each to the contract-level claim: strict Zod, exact 422/400 field violations, OpenAPI parity. The semantic clauses go explicitly to the S11 per-op validation criteria (S11 AC006/012/018/024/030).
  - Then S10 closes without S11.
  - Alternative: keep the wording and close S10 together with S11.
- **AC040, AC042:** as in §2.6.
- **AC067, AC075:** as in §2.2.
- **AC030:** as in §2.5.
- **FE03 route table drift:** add the existing `/entries/:entryId/revisions` page. It is implemented but missing from FE03 `:685-695` and `:1005-1013`.
- **IA03 contradiction:** edge-case row `:439` "Owner targets itself for a capability other than registry read or schema design — refused" contradicts the IA03 grant paragraph and the A1 override ("may grant itself any grantable capability"). Delete or rewrite the row. It blocks a sole-owner author/reviewer/publisher setup.

### 2.11 D6: restore chain manifest

**New private table `platform_private.cms_restore_chain_manifests`:**
- Columns:
  - IA envelope: `id`, `owner_id`, `state` ∈ {`active`}, `version`=1, `created_at`, `updated_at`=`created_at`
  - `content_type_id` FK
  - `source_schema_version_id` FK
  - `target_schema_version_id` FK
  - `plan_ids jsonb` (ordered array, 0..64)
  - `edge_count smallint` (0..64, = array length)
  - `manifest_hash char(64) UNIQUE`: JCS SHA-256 of `{contentTypeId, sourceSchemaVersionId, targetSchemaVersionId, planIds}`
- Constraints: immutable (UPDATE/DELETE rejected), RLS forced, no grants.
- Each edge must be the *completed* 03a plan bound to the activation of its `to` version: consecutive, `from[i+1]=to[i]`, with `to[last]` = the current active version at restore time.
- Zero edges = same-schema restore.

**Producer (recommended: lazy and deterministic):**
- The **read** derives the unique activation-plan path, its `manifest_hash`, and `migrationChainId = UUID derived from manifest_hash` (UUIDv5-style; implementation chooses).
- It is exposed in `RevisionHistoryPage.compare.restore: { migrationChainId, edgeCount, chainHash, availability: 'available'|'chain_unavailable'|'transform_missing' } | null` for `leftRevisionId`.
- `cms_restore_revision` re-derives the path and ID and requires equality with the request (409 `migration_chain_mismatch`). It inserts the manifest if absent (`ON CONFLICT (id) DO NOTHING`, then verify hash), then translates.
- No read-side writes and no coupling to S09's activation transaction.
- **Alternative:** compose manifests inside 03a activation. Rejected because it edits S09-frozen activation and creates O(versions) rows per activation.
- An ambiguous path (a re-activated older version) or more than 64 edges → `availability: 'chain_unavailable'`. The POST returns 409.

**Translation:**
- Apply each edge plan's registered transforms with DB-side semantics, per the S09 protocol (`identity.revalidate`, `default.fill_literal`).
- Fields map by stable field ID and are revalidated against the current active schema, including `rich_text.v1` and kind encodings.
- Relations are re-resolved against current RelationDefinitions.
- Template is re-resolved through 03c `cms_resolve_template_compatibility` (S09). If incompatible → 409 `template_incompatible`.
- Taxonomy assignments follow merged-term redirects. A non-active term fails closed.
- Any field without a transform, or a required field without a literal default → 409 `migration_chain_incomplete`. Nothing is fabricated.

**Result:**
- A new draft revision with `parentRevisionIds = [currentDraftRevisionId, sourceRevisionId]`. **Orchestrator confirm** the provenance convention; the alternative is an explicit audit-only source reference.
- The source is unchanged.
- One `cms.entry.revision-created.v1` and an audit record.

**Files:**
- BE03b DB table list ("twelve tables" → thirteen), validation row `:229`, data flow `:1014`, tests.
- IA03 Contracts (restore relationship).
- FE03 CMS-07 restore row: confirmation form shows availability and edge count; disabled with copy when unavailable.

### 2.12 Thinness and consistency gates after the cascade

- Run `/audit-ambiguity`-style fresh passes on IA03/BE03b/FE03.
- Run the cross-layer check: BE03b ↔ FE03 operation unions, FE route registry, OpenAPI.

---

## 3. Depth-floor delta implications

The formula is `.claude/skills/prd-templates/references/slice-depth-floor.md`. Every item below is new and adds criteria. The exact delta must come from a per-item ledger (S09 WP0b method), never back-solved.

**Slice 10: new BE operations or support reads**

Each adds happy + field×constraint + messages + error codes per code + authz roles incl. deny + scoping + idempotency/concurrency + cascade + rate:
- CMS-03B-12 conflict detail (D2).
- CMS-03B-13 entry list.
- `cmsEntryAuthoringContextRead` (two modes).

**Slice 10: changed BE contracts**
- 03B-11 resource: +3 fields (D3/openConflict).
- 03B-03 compare: `domain`, two pointer grammars, overflow/unavailable refusals, restore carrier (D5/D6).
- 03B-01/02/10 values: rich_text.v1 (~12 grammar constraints/messages: block types, level, list/depth step, span text, marks unique/order, three link kinds, canonical-form refusal, caps), plus relation/list/taxonomy/media encodings and their fail-closed reasons.
- 03B-04: chain manifest table, translation refusals, provenance.
- Concurrency cap, presence lease rule.

**Slice 10: FE**
- New pages, each with guard, deep link, back and multi-tab items:
  - `/entries` list
  - `/entries/:id/conflicts/:cid`
  - restore form on `/revisions`
  - integrated editor
  - create form
- New components with states, form fields×validation and a11y rows: `CmsRichTextEditor`, `CmsRichTextRenderer`.
- Role variants for reviewer read-only history.

**Slice 10: IA**
- New edge rows: conflict-detail after resolution, restore chain unavailable/incomplete, rich-text non-canonical/unsafe link, unbuilt-provider kind refusal, presence removal on revocation.
- Possibly a new IA AC-level GWT for the conflict-detail read. Follow the IA-ID pattern used for DLV-15..17 in A3.

**Slice 10 (moved by G3, decided):** contract-only items for the 5 S11 requests stay in S10's AC038–048 block. Rewording changes no counts.

**Slice 11: new ops**
- CMS-03B-15 workflow read.
- CMS-03B-16 review detail.
- CMS-03B-17 review assignment.
- CMS-03B-18 preview revoke.
- CMS-03B-19 schedule cancel.
- CMS-03B-20 reviewer queue.
- Internal `cms_verify_preview_token` seam.
- Schedule worker (cron claim + queue execute: idempotency, lease, late/duplicate, DLQ items).

**Slice 11: new or changed contracts and data**
- Audience fields.
- `step_up_at` NOT NULL.
- Assignment table + trigger.
- Preflight registry + runs table (one item per category × outcome rule).
- Review invalidation on new revision.

**Slice 11: FE**
- Pages:
  - `/entries/:id/workflow` (submit/schedule/preview/publish panels)
  - `/reviews`
  - `/reviews/:id` (decision form + owner assignment form)
- Each with states, role variants (submitter, assigned reviewer, specialist slot, publisher, owner-assign, forbidden, disabled-prerequisite), step-up recovery and DST disambiguation UX.

**Thinness gate:** every new endpoint above has non-zero happy/field/error/authz by construction. Verify after the cascade.

**Totals:** S10 plan `:1855-1857` and S11 `:1953-1955` breakdown lines, the phase/index/spec-pipeline counts and the consistency guards all change. S10's 75 and S11's 45 are no longer final.

---

## 4. Ordered work packages

Common settings:
- `export PATH="$HOME/.local/share/wejammin-toolchain/bin:$PATH"`
- Root owns every shared file: `platform-registries.ts`, `infra/openapi-*.mjs`, the generated `docs/openapi/openapi.json`, `apps/worker/src/worker-route-composition.ts`, `apps/worker/src/async-entrypoint.ts`, `apps/worker/src/production-worker-runtime-cms.ts`, the e2e real-route harness `tests/e2e/support/*`, and the plan/trackers.
- Migration timestamps must sort after every S09 migration.

**Gate:** amended S09 acceptance is complete. That includes:
- the DEC-109 policy registry migration (so `cms_create_entry` stops failing closed)
- the DEC-111 step-up ops
- the DEC-119 grants, with `cms.publisher` and `cms.reviewer.<class>` registered
- the S09 migration-worker DB transform semantics

### WP-S10-0: spec cascade (single spec writer, serial)
- **Files:**
  - `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`
  - `.memory/wiki/specs/fe/03-cms-content-modeling.md`
  - `.memory/wiki/specs/ia/03-cms-content-modeling.md`
  - `.memory/wiki/specs/ia/deep-dives/03-cms-content-modeling.md`
  - `.memory/wiki/specs/be/03a-content-schema-registry.md` (rich_text/list notes and the `cms.editorial_review.assign` non-grantable entry only)
  - `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (restore uses the resolver; D12 text if not already applied by S12)
  - `.memory/wiki/specs/be/index.md`, `.memory/wiki/specs/fe/index.md`
- **Content:** §2.1–2.11 for **both** slices. G3 needs the S11 request text frozen now; do the S11 read/assignment/preflight text in the same pass.
- **Verify:** cross-layer op-union diff BE03b↔FE03, then a fresh ambiguity audit. Raw records for any new DEC/PAT go through `flushEntry` + `node .memory/pipeline/compile.mjs`, never hand-edited wiki files.

### WP-S10-0b: depth-floor ledgers and count cascade (root, serial)
- **Files:**
  - new `.memory/pipeline/progress/verification/2026-10-XX-slice-10-11-decision-depth-floor.md`
  - `.memory/wiki/specs/phases/phase-2.md` S10/S11 sections
  - `.memory/pipeline/progress/slices/phase-02-slice-10.md`, `-11.md`
  - `.memory/pipeline/progress/phases/phase-02.md`, `index.md`, `spec-pipeline.md`
  - `scripts/check-progress-consistency.mjs` (if counts are pinned)
- **Order:** guard expectations RED first, then docs. Add AC rows contiguous and open (§2.10 rewordings documented row by row).
- **Verify:** `pnpm progress:check`, then `node scripts/check-progress-consistency.mjs --json`, then the S09 guard suite listed in s09-breakdown WP0b.

### WP-S10-1: contracts (root, serial)

**Files:**
- `packages/contracts/src/cms-editorial/`:
  - `entry-draft-detail.ts`, `revision-history.ts`, `revision-restore.ts`, `resources.ts` (drop `resolvedByPersonId` from the browser schema)
  - new `conflict-detail.ts`, `entry-list.ts`, `authoring-context.ts`, `value-encodings.ts`
  - S11 request/resource schemas: new `review-submission.ts`, `editorial-decision.ts`, `publication-schedule.ts`, `preview.ts`, `publication.ts`, `dependency-manifest.ts`
  - `route-policy-base.ts`, `route-policy-contract.ts`, `route-policy-errors.ts`, `routes.ts`, `routes-errors.ts`, `index.ts`, `README.md`
- new `packages/contracts/src/cms-rich-text/` (`rich-text-v1.ts`, canonicalizer, `README.md`)
- `packages/contracts/src/platform-registries.ts` (03B-12/13 + authoring-context rows)
- `infra/openapi-definitions.mjs`, `infra/openapi-document.mjs`

**Rules:**
- S11 schemas have **no** route rows yet; the registry assert fails closed on extras.

**RED-first contract tests:**
- every rich_text.v1 rule incl. depth ≤7 and non-canonical refusal
- every encoding
- D20 unknown-key rejection
- audience grammar
- D3/D2/D5/D6 shapes
- 100% branch coverage per `vitest.config.ts`

**Verify:**
- `pnpm exec vitest run packages/contracts/src/cms-editorial packages/contracts/src/cms-rich-text`
- `pnpm contracts:generate && pnpm contracts:check`
- `pnpm type-check && pnpm lint`

### WP-S10-2: QA-RED (parallel, disjoint, tests only)

- **2a DB:** new
  - `supabase/tests/phase_02_slice_10_rich_text_v1.sql`
  - `…_value_encodings.sql`
  - `…_draft_detail_identity.sql`
  - `…_conflict_detail.sql`
  - `…_comparison_domains.sql`
  - `…_restore_chain.sql`
  - `…_presence_lease.sql`
  - `…_entry_list.sql`
  - `…_authoring_context.sql`
  - `…_locale_fanout_regression.sql`

  Cases:
  - RLS/forced/grants and concealment
  - restore: zero-edge, multi-edge, ambiguous path, >64 edges, missing transform, required-no-default, template incompatible, replay/CAS
  - compare: 513 overflow; relation token unlinkability (no target UUID in output)
  - rich text: unsafe link schemes (`javascript:`, `data:`, protocol-relative), NFC, control chars
  - no hand-inserted plan/approval rows (use real S09 producers)
- **2b Worker:** new
  - `apps/worker/src/cms-editorial/conflict-detail-routes.test.ts`
  - `list-routes.test.ts`
  - `authoring-context-routes.test.ts`
  - `restore-production.test.ts`
  - `concurrency-cap.test.ts`

  Plus additions to the production port and session tests (RPC name map, 403/404, no-store, rate keys).
- **2c Web:** new
  - `apps/web/src/components/cms-rich-text/*.test.tsx` (renderer/editor parse-serialize round trip, a11y)
  - `apps/web/src/components/cms-editorial/*` (editor loader wiring, create form, conflict form, restore form, list)
  - page structure tests next to the new `.astro` files
- **2d E2E (production-built Chrome only):** new
  - `tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts`: create → autosave → two-tab conflict → resolve → compare → restore
  - `…-rich-text-real-route.spec.ts`
  - `…-entry-list-real-route.spec.ts`
- **Verify RED:** each suite fails for the stated reason. Record the counts in the tracker.

### WP-S10-3: DB GREEN (one DB owner, serial migrations)
- **Files:** new `supabase/migrations/2026100X…`:
  1. `cms_rich_text_v1_validator.sql`: replaces the `20260927540000` refusal and changes `cms_draft_field_value_valid`.
  2. `cms_field_kind_encodings.sql`: relation/list admission; taxonomy/media/object typed refusals; revision, resolve and create allowlists.
  3. `cms_draft_detail_identity.sql`
  4. `cms_conflict_detail_read.sql`
  5. `cms_revision_comparison_domains.sql`
  6. `cms_restore_chain_manifest.sql` (table + `cms_restore_revision` + `platform_api` wrapper)
  7. `cms_edit_presence_lease.sql`
  8. `cms_entry_list_read.sql`
  9. `cms_entry_authoring_context.sql`
  10. a concurrency-cap support function if the DB layer is chosen

  Regenerate `packages/data-access/src/database.types.ts`.
- **Verify:** `pnpm db:verify` (reset + lint + test + types:check). Tests must be focused GREEN, then full.

### WP-S10-4: Worker GREEN
- **Files:**
  - new `apps/worker/src/cms-editorial/{conflict-detail-routes.ts,list-routes.ts,authoring-context-routes.ts}`
  - `index.ts`, `routes.ts`, `types.ts`, `README.md`
  - `apps/worker/src/cms-editorial-production-{ports,types,session-rpc-body,session-capabilities,rate}.ts`; restore port wiring removes the 503 seam at `cms-editorial-production-types.ts:150`
  - root mounts in `worker-route-composition.ts`
- **Verify:** `pnpm exec vitest run apps/worker/src/cms-editorial apps/worker/src/cms-editorial-production*`

### WP-S10-5: Web GREEN
- **Pages:**
  - `apps/web/src/pages/app/cms-content-modeling/entries/{index.astro,new.astro,[entryId].astro,[entryId]/revisions.astro,[entryId]/conflicts/[conflictId].astro}`
  - registry `index.astro` nav link
- **Proxies:** new `apps/web/src/pages/api/v1/cms/entries/{authoring-context.ts,[entryId]/conflicts/[conflictId].ts}` and list GET in `entries/index.ts`. Update `apps/web/src/server/cms-editorial-platform-reads.ts`.
- **Components:** new `apps/web/src/components/cms-rich-text/`. In `apps/web/src/components/cms-editorial/*`, remove the `BOUNDARY` loader once the loader is real.
- **Verify:** `pnpm exec vitest run apps/web/src/components/cms-editorial apps/web/src/components/cms-rich-text apps/web/src/pages/app/cms-content-modeling/entries`, then `pnpm build` and bundle budgets.

### WP-S10-6: QA-GREEN, adversarial, closure
- Adversarial pass: rich-text injection, relation-token probing, chain tampering, cross-tenant.
- Production-built Chrome real-route suite.
- `pnpm validate` (pinned) and `pnpm db:verify`.
- Tracker/plan checkboxes from evidence only; AC061–075 verified against S09 output.
- Runbook/README updates.
- `node .memory/pipeline/compile.mjs`.
- Session log.

### WP-S11-1..6: same shape after S10

- **S11-1 contracts (root):** add route rows for 03B-05..09 and 15–20 to `cms-editorial/routes.ts` and `platform-registries.ts`; regenerate OpenAPI.
- **S11-2 RED:**
  - **DB** `supabase/tests/phase_02_slice_11_{review_submit,decision_slots,assignment,preflight_registry,schedule,schedule_worker,preview_mint_verify_revoke,publish,workflow_read,review_read,review_queue,invalidation}.sql`. Cases:
    - DEC-110 ordinary 1 / protected 2 + specialist slot; unsatisfiable-slot approve refusal
    - submitter/self/duplicate refusal; MFA 401
    - DST gap/fold
    - late/duplicate run single publication
    - token plaintext never stored; forwarded/expired/revoked denial
    - version-set race 409
    - preflight absent-provider pass/fail by reference
  - **Worker** `apps/worker/src/cms-editorial-workflow/*.test.ts` and `apps/worker/src/cms-publication-schedule/*.test.ts`.
  - **Web** `apps/web/src/components/cms-editorial-workflow/*.test.tsx`.
  - **E2E** `tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts`: two test humans provisioned via CMS-03A-15 → submit → assign → decide with step-up → schedule → preview → publish.
- **S11-3 DB:** new migrations:
  - `cms_editorial_review_assignment.sql`
  - `cms_editorial_preflight_registry.sql`
  - `cms_submit_review.sql`
  - `cms_record_review_decision.sql` (`step_up_at NOT NULL`, distinctness trigger)
  - `cms_publication_schedule.sql` (audience column, cancel, `cms_claim_due_schedules`/`cms_execute_publication_schedule`)
  - `cms_preview_tokens.sql` (mint/verify/revoke)
  - `cms_publish_revision.sql`
  - `cms_editorial_workflow_reads.sql`
  - `cms_review_invalidation.sql` (trigger on new revision of the same entry/locale)
- **S11-4 Worker:**
  - new dir `apps/worker/src/cms-editorial-workflow/` (routes + admission reuse) and `apps/worker/src/cms-editorial-workflow-production*.ts`
  - schedule worker `apps/worker/src/cms-publication-schedule/`, following the schema-migration envelope pattern in `async-entrypoint.ts:117-145`
  - root edits `async-entrypoint.ts`, `index.ts` (cron path), `wrangler.jsonc` only if a new cron expression is needed. The existing `* * * * *` sweep can dispatch.
- **S11-5 Web:**
  - pages `entries/[entryId]/workflow.astro`, `reviews/index.astro`, `reviews/[reviewId].astro`
  - proxies under `apps/web/src/pages/api/v1/cms/{reviews,publication-schedules,previews,publications}/…`
  - components `apps/web/src/components/cms-editorial-workflow/`
  - step-up via `/step-up?returnTo=`
- **S11-6:** closure as WP-S10-6. Hosted two-human proof stays deferred (G11/D26).

---

## 5. Remaining genuine owner decision

### O1: Is the `object` field kind authorable in Phase 2, and with what structure?

**Why it is genuine:**
- 03a lets a schema designer declare `kind: 'object'`, but defines no properties schema (Constraints `BE03a:305-322`). IA03 is also silent.
- BE03b forbids untyped pass-through (`:255`).
- Any structure therefore requires a product/architecture choice that touches S09's frozen 03a contract.

| Option | Pros | Cons |
|---|---|---|
| A. Extend 03a: `object` declares a nested `properties[]` (each with stable key, scalar/enum/rich_text kind, required, constraints; ≤32 per object, depth 1). Compiled into the artifact; 03b validates. | Full feature. Typed. Consistent with "every value typed". | Reopens S09-frozen 03a schema design, compiler, dry-run and FE forms. Adds S09/S10 criteria. |
| B. Keep `object` declarable but **refuse non-null object values** at write (typed 422 `object_kind_unspecified`) until a later approved contract. Amend IA03/BE03b to say so. | No S09 reopen. Truthful fail-closed. Small. | A declared kind cannot hold data. Schema designers can create unusable fields. |
| C. Remove `object` from Phase 2 FieldKind at activation (refuse activation of a schema with an object field). Structured content goes through governed blocks (S12) instead. | Clean model with no dead kind. Matches the "media via governed blocks" stance in DEC-112. | Narrows a locked enum. Needs an 03a amendment and S09 test updates. |

**Recommendation: A.**
- The owner default is more work now, and typed nested fields are what `object` implies.
- If the owner prefers not to reopen S09, use C over B, because C avoids an unusable kind.

### Not owner decisions (resolved by sources or precedent; listed for orchestrator confirmation)

- Reviewer assignment model (§2.6, DEC-108/115 precedent).
- MFA on every editorial decision (§2.6, D20).
- Relation pointer key (§2.3, deviation from D5 wording).
- Rich-text validator identity (§2.4).
- Restore provenance (§2.11).
- AC038–048 rewording (§2.10).
- S11 rich-text accessibility provider (§2.9).
- List itemKind restriction (§2.5).
- New list/queue/preparation reads (vertical-slices rule).

### Risks

- **R1:** the S09 cascade is in flight on the same spec files. WP-S10-0 must wait for it and rebase on the committed text.
- **R2:** the concurrency cap (three per actor) may be unenforceable across Worker isolates without a DB counter. The BE03b owner must name the layer.
- **R3:** the tzdb identity source in Workers/PG is unverified. Spike in WP-S11-1: either pin a code-owned tzdb snapshot with its release ID, or validate `resolvedUtc` with runtime ICU and record both client and server `tzdbVersion`. Choose before contracts freeze.
- **R4:** DEC-119's 7-day grants block long-horizon schedules unless renewed (§2.9).
- **R5:** under D19, entries with media, template, locale or internal links cannot publish until S12/S13/S14 register providers. This is truthful but limits the S11 demo content.
