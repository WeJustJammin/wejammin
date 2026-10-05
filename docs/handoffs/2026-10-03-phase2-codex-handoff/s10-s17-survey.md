# Phase 2 Slices 10–17 readiness survey (read-only)

Surveyed worktree: `/home/rob/.codex/worktrees/ac265-hosted-evidence-producer/WeJammin`
(PR #124 head `1a21d3b5`, clean tree). Survey date 2026-10-01/02. No repo file edited.

Path abbreviations used in citations:

- `P2` = `.memory/pipeline/progress/phases/phase-02.md`
- `IDX` = `.memory/pipeline/progress/index.md`
- `S1x` = `.memory/pipeline/progress/slices/phase-02-slice-1x.md`
- `PLAN` = `.memory/wiki/specs/phases/phase-2.md`
- `SCAN:<name>` = `.memory/wiki/specs/audits/propagation-scan-<name>.md`
- `HO` = `docs/handoffs/2026-10-02-phase2-claude-handoff.md`
- `APPR` = `.memory/pipeline/progress/verification/2026-10-02-slice-09-activation-amendment-approval.md`
- `BE03b/BE03c/BE04a/BE04b/BE04c/BE05c` = `.memory/wiki/specs/be/<file>.md`; `ENG` = `.memory/wiki/specs/ENGINEERING-STANDARDS.md`; `ARCH` = `.memory/wiki/specs/2026-08-02-architecture-design.md`

---

## 0. Headline findings

1. **Slices 10–17 are hard-gated on amended Slice 09.** `HO:187-188` says to resume them only after amended S09 acceptance. `APPR:50-52` says they "remain gated until the amended Slice 09 implementation requirements pass". S10's own gate is at `S10:7`.
2. **DEC-108 moved S10/S12 work into S09.** The protected entry create/draft-read (S10 CMS-03B-10/11, AC061–075) and CMS-03C-01 template draft creation (S12 AC004–009, 022–025) are now S09 prerequisites (`HO:78-85`, `APPR:29-31`). The S09/S10/S12 count and depth-floor cascade is still pending (`HO:166-169`), so the S10 and S12 denominators may change.
3. **The editorial workflow-policy source is now on the S09 critical path.** Real source rows need CMS-03B-10 entry create. `cms_create_entry` refuses while `platform_private.cms_editorial_workflow_policy_evidence()` returns NULL (`SCAN:2026-09-28-cms-editorial-policy-source:10-13`; `HO:177-178`). No owner answer exists.
4. **Thirteen recorded owner decisions are still open.** Survey 2026-10-01/02, after DEC-108, found no approval in `.memory/wiki/decisions.md`, the verification records or the session logs. They are D1–D13 below.
5. **The survey found 11 further gaps that no tracker records yet** (G1–G11). Several are structural:
   - S11 publication needs preflight categories owned by later slices.
   - S13 holds about 40 media/delivery criteria that only S14/S15 can satisfy, which is a dependency cycle.
   - S12 and S16 hold criteria for flows the Phase 2 scope lock explicitly defers.
   - BE03b's editorial-decision request accepts a caller-supplied `capability` and `stepUpAt`.
6. **Phase 2 counts:** 2,011 active / 2,015 authored, 1,475 checked (`IDX:6`). Unchecked = 519 (S10–S17) + 17 (S09) = 536. Every S10–S17 criterion is unchecked.

---

## 1. Per-slice summary table

| Slice | ACs (checked) | Status | Scope | Depends on | Ops / tables / screens (rough size) | Existing code |
|---|---|---|---|---|---|---|
| 10 Entry authoring, conflict, restore | 75 (0) | in progress, gated | web | S09 | 6 ops (CMS-03B-01/02/03/04/10/11), +1 proposed conflict-detail GET; 12 private tables (all exist); 4–5 screens | substantial (see §2) |
| 11 Review, schedule, preview, publish | 45 (0) | not started | web | S10 | 5 ops (CMS-03B-05..09) + schedule worker; 5 tables already exist, no RPCs; 3 flows/screens | DB tables only |
| 12 Templates, patterns, taxonomy | 50 (0) | in progress, gated | web | S09 | 3 ops (CMS-03C-01..03) + 2 support reads; extra 03C-04/05 transport; ~9 tables exist; 3 screens | substantial |
| 13 Menus, routes, slugs, discovery | 174 (0) | not started | web | S11, S12 | 4 ops (DLV-NAV-API-01..04); ~7 tables; FE04 shell, 3 workbenches, 32 role variants | none |
| 14 Media ingest, rights, renditions | 65 (0) | not started | web | S09, S13 | 4 ops (DLV-04B-01..04); 8 tables; scanner and transform adapters; 1 workbench | upload intent/completion (Phase 1/S04) reusable |
| 15 Delivery, preview, convergence | 72 (0) | not started | web | S11–S14 | 6 ops (2 public GET, 4 internal); 5 tables; workers; public/preview/degraded pages | none |
| 16 Quality and privacy lifecycle | 28 (0) | not started | web | S08, S15 | 1 op (CFG-05C-02); 6 tables; 1 workbench | deferred placeholder component only |
| 17 Integration and close gate | 10 (0) | not started | web | S01–S16 | no new endpoint; integration, verification, runbooks | n/a |

Sources:
- AC counts come from the trackers' `- [ ] **P2-S1x-AC-` lines (all unchecked). They match the table at `P2:345-352`.
- Scope and dependencies come from tracker headers (`S1x:3-6`) and the per-slice headers in `PLAN` (S10:1842–1847, S11:1938–1943, S12:2003–2008, S13:2073–2078, S14:2267–2272, S15:2352–2357, S16:2444–2449, S17:2492–2497).

---

## 2. Slice-by-slice detail

### Slice 10: Entry authoring, conflict resolution, and revision restore

**Header (`S10:3-9`)**
- Status in-progress, complexity M, surface web, depends on S09, depth floor 75, ACs 75, checked 0.
- Implementation gate: the 17 reopened S09 activation criteria (`S10:7`).

**AC composition (`S10:517-591`)**
- 3 locked gates.
- 6×6 BE operation ACs for CMS-03B-01..04 (AC004–027).
- 22 validation rows (AC028–049). Note: AC038–048 enforce CMS-03B-05..09 request validation, which are **Slice 11 operations** (G3).
- CMS-05/06/07 IA and FE flows (AC050–058), TDD/validation (AC059–060).
- DEC-106 create/read criteria (AC061–075).

**Existing code (local, unpromoted; per `IDX:27`, `S10` continuation logs)**
- Worker:
  - `apps/worker/src/cms-editorial/` has create, revision, conflict, history, restore and detail routes plus admission, deadline and query guards.
  - `apps/worker/src/cms-editorial-production-*.ts` holds the production ports, session resolver, rate, telemetry and error relay.
  - Restore has no RPC. The rate seam comment says "Restore consumes a quota before its migration-chain RPC is wired" (`apps/worker/src/cms-editorial-production-types.ts:150`).
- Web:
  - Proxies under `apps/web/src/pages/api/v1/cms/entries/**`: create, revisions, conflict resolve, restore.
  - SSR pages under `apps/web/src/pages/app/cms-content-modeling/entries/`: `new.astro` (renders "Entry creation is unavailable", line 65), `[entryId].astro`, `[entryId]/revisions.astro`.
  - Components under `apps/web/src/components/cms-editorial/` (autosave, conflict-resolve, entry-create, draft-detail transports, SyncConflict).
  - `cms-editorial-entry-loader-boundary.ts:7` is a `BOUNDARY:` marker: the editor loader is still unwired.
- Contracts: `packages/contracts/src/cms-editorial/` (requests/resources/routes/conflict/history/restore/create/draft-detail). There are no S11 schemas.
- DB:
  - Migrations `20260926090000`…`20260930150000`: entry authority, conflict record, history RPC with signed cursor, revision write, conflict resolution, rich-text refusal gate, calendar/enum admission, owner-chain FKs, idempotency business hash.
  - RPCs present: `cms_create_entry`, `cms_create_revision`, `cms_resolve_conflict`, `cms_list_revisions`, `cms_get_entry_draft`.
  - Missing: `cms_restore_revision` and any conflict-detail read.
- Tests:
  - `supabase/tests/phase_02_slice_10_*` (schema, rpc, conflict, remaining_schema, snapshot/owner-chain, rich-text, calendar).
  - `tests/contracts/phase-02-slice-10-*`.
  - `tests/e2e/phase-02-slice-10-history.spec.ts` and `phase-02-slice-10-revision-history-real-route.spec.ts`.
  - Last recorded pgTAP is 88 files / 3,001 assertions (`S10:63`).

**Completeness:** about 60–70% of BE plumbing exists. Still missing:
- the CMS-05 editor loader and create form, blocked on the policy source;
- the conflict form, blocked on D2;
- restore success, blocked on D6;
- full comparison, blocked on D5;
- rich text, blocked on D4.

**Open decisions:** D1, D2, D3, D4, D5, D6 (see §3). Gaps: G2 (AC042 caller stepUpAt), G3, G11. Locale fan-out D12 also affects S10 revision writes (trigger fires on revision insert).

**Hosted vs local:** every AC is provable locally (pgTAP, Vitest, production-built Chrome). No S10 AC text requires hosted evidence; the trackers' "hosted acceptance remains open" notes are extra caution, not AC text. Hosted role tests would need editorial test grants beyond DEC-103's single read grant (see G11).

**Size:** 6 ops plus about 1 new. Tables exist. Roughly 5 screens: create, editor, conflict, history/compare, restore.

### Slice 11: Review, scheduling, preview, and safe publication

**Header (`S11:3-8`)**
- Not started, M, web, depends on S10, 45 ACs, 0 checked.
- `PLAN:1940` still says "awaiting plan approval", but the whole plan was approved 2026-08-31 (`PLAN:3-5`). Slices 04–09 carried the same label and completed, so it looks stale.

**AC composition (`S11:21-66`)**
- 4 gates. AC004 is "Publish only after … accessibility, settings, schema, template, block, media, relation, route, locale, and privacy gates re-pass" (`S11:25`).
- 5×6 operation ACs for CMS-03B-05..09.
- CMS-08/09/13 IA and FE flows, plus TDD.

**Existing code**
- Private tables only: `platform_private.cms_editorial_reviews`, `cms_editorial_decisions`, `cms_publication_schedules`, `cms_publication_versions`, `cms_preview_tokens`, `cms_edit_presence` (from the S10 editorial-support migrations).
- pgTAP: `supabase/tests/phase_02_slice_10_remaining_schema/001-presence-and-reviews.sqlinc` and `002-decisions-schedules-publications.sqlinc`.
- None of the following exist: review/decision/schedule/preview/publish RPCs, Worker routes, contracts, UI, schedule worker.

**Open decisions:**
- D1 (editorial policy: risk class, decision count, capabilities). Every review needs it (`BE03b:204, 485-493`).
- Step-up surface (D13).
- Template activation (D8), because publishing composed content implies active templates.
- Gaps G1 (cross-slice preflights) and G2 (caller-supplied stepUpAt/capability).

**Hosted vs local:** locally provable. The schedule worker runs under local Wrangler/Queues and the tzdb logic is pure.
- Production caveat: Supabase is on Free and `ENG:137` keeps "Protected production money, rights, and publication writes … disabled". Real production publication needs an owner-approved recovery capability. This does not block Phase 2 implementation completion.
- A practical constraint: `requiredDecisionCount` is 1–8 and the reviewer must be distinct from the author (`BE03b:488-493`), so every publication needs at least two humans. With a sole-owner org, hosted demonstration needs a second provisioned human.

**Size:** 5 ops, 1 worker, about 3 screens (review/decision, schedule, preview/diff/publish). Medium.

### Slice 12: Templates, reusable patterns, and taxonomy governance

**Header (`S12:3-9`)**
- In progress, gated on S09 (`S12:7`), M, web, depends on S09, 50 ACs, 0 checked.

**AC composition (`S12:755-804`)**
- 3 gates; 3×6 operation ACs for CMS-03C-01..03.
- 18 validation rows (AC022–039). **AC033–038 enforce CMS-03C-04 (localization, CMS-15) and CMS-03C-05 (related content, CMS-16).** Both flows are explicitly deferred out of Phase 2 (`PLAN:30`: "Explicitly deferred: … CMS-15–16 … localization, related content"). This is G4.
- CMS-11/12/14 flows, TDD.

**Existing code**
- Worker:
  - `apps/worker/src/cms-composition/`: template, template-context, template-detail, pattern-instance, taxonomy, locale and related-content routes.
  - Production ports `cms-composition-production*.ts`.
  - Taxonomy `actTerm` port returns `unavailable` (`cms-composition-production-taxonomy.ts:55`).
  - Related `actRelatedContent` returns `unavailable` (`cms-composition-production-related.ts:56`).
  - Pattern port maps a missing RPC to 503 (`cms-composition-production-pattern.ts:183, 219`).
- Web:
  - `pages/app/cms-content-modeling/templates/new.astro` and `[templateKey].astro`.
  - Proxies under `pages/api/v1/cms/templates/*`, `compositions/pattern-instances.ts`, `entries/[entryId]/locales/[locale]/variants.ts`, `entries/[entryId]/related-content.ts`.
  - Components in `components/cms-composition/` (designer, edit designer, reconcile, rate-wait).
- DB:
  - Roughly 35 migrations `20260927200000`…`20260930161000` covering template authority, digest, guards, taxonomy authority and guards, composition authority and guards, locale/related authority, template context/latest, locale author RPC and source-stale trigger, binding compatibility guard.
  - RPCs present: `cms_define_template`, `cms_template_context`, `cms_template_latest`, `cms_author_locale_variant`.
  - Missing: pattern-instance insert RPC, taxonomy curator RPC, related-content RPC, template activation.
- Tests: about 15 `supabase/tests/phase_02_slice_12_*.sql`; `tests/contracts/phase-02-slice-12-*` (template/locale/related/taxonomy OpenAPI); 4 `tests/e2e/phase-02-slice-12-*` specs.

**Completeness:** CMS-11 (template draft) is close to complete locally, apart from D7 latest-read propagation. CMS-12 is blocked on D9 and CMS-14 on D10. Template activation (D8) is not required by AC-CMS-11, which returns a "Versioned template candidate" (`ia/03-cms-content-modeling.md:43`), but it blocks safe publication downstream (S11/S15).

**Open decisions:** D7, D8, D9, D10, D11 (deferred CMS-16), D12 (locale fan-out, deferred CMS-15 but the trigger is live). Gap G4.

**Hosted vs local:** locally provable.

**Size:** 3 ops plus 2 support reads. Patterns and taxonomy each need about 2–4 more ops depending on D9/D10. 3 screens.

### Slice 13: Menus, routes, slugs, and discovery metadata

**Header (`S13:3-8`)**
- Not started, **L**, web, depends on S11 and S12, 174 ACs, 0 checked.

**AC composition (`S13:22-195`)**
- 3 gates; 4×6 operation ACs (DLV-NAV-API-01..04); 8 validation rows; 4 flows ×3.
- 21 IA edge cases (AC048–068), 38 FE components/forms, 9 FE states, 10 FE navigation/network, 32 role variants (AC087–118), responsive, 7 accessibility, 5 tests, 2 TDD.
- Breakdown is at `PLAN:2081`.

**Existing code:** none. No menu/route/redirect/discovery tables, contracts, routes or UI.

**Gaps (none recorded yet):**
- **G5, dependency cycle.** These ACs belong to S14/S15 work that runs *after* S13:
  - AC054–068 (`S13:75-89`): upload, scanner, rights, rendition, preview, cache purge, last-known-good, inbound delivery holds;
  - AC131–132 and AC136–137 (media/delivery workbenches);
  - AC147–148 and AC163–167 (04b/04c schemas and errors);
  - AC150–151 and AC155–161 (`S13:171-182`; data mapping for DLV-MEDIA/DLV-04B/DLV-DEL operations).
- **G6, ID drift.** FE04 maps an operation `DLV-MEDIA-API-01` "from 04a" into `NavigationRoutesDiscoveryWorkbench` (`fe/04-cms-delivery-media.md:345,430`; AC150 at `S13:171`). BE04b defines media ops as `DLV-04B-01..04`, and BE04a:27 says the "DLV-MEDIA-API-01–04" range lives in 04b.
- **G7, missing approval transition.** BE04a gives Menu/MenuVersion/RouteRecord/RedirectRecord/DiscoveryMetadataVersion the lifecycle `draft → review → approved → active` (`BE04a:194`). DLV-NAV-API-02 requires an "approved" candidate whose hash matches "previewed responsive variants" (`BE04a:166`). No operation performs draft→review→approved and no menu-preview operation exists (the template-activation pattern again). Whether slug and metadata writes need approval is also unclear.
- **G8, undefined reciprocal source.** BE04a names a "Shard 05 policy projection" `{publicationId, locale, policyVersion, fields} → {noindex, excludeSitemap, redactFields, blockerCode}` (`BE04a:94`). BE05a/05b define no such projection, and no code has one.

**Role matrix:** Guardian, Junior and Business variants depend on mandates, which `PLAN:30` defers. Use the S09 AC265 "approved Phase 2 launch overlay" precedent (denial without disclosure).

**AC171 "VoiceOver/NVDA smoke" (`S13:192`):** the same text was checked in S03/S05/S07 (`S03:319`, `S05:276`, `S07:196`). S09 AC266 treats it as a real-device pre-release gate (DEC-101). This needs an owner interpretation (D16).

**Hosted vs local:** locally provable except AC171 if it is read as real-device (D16). AC172 (LCP/CLS) can be measured locally.

**Size:** large. 4 ops, about 7 tables, a full FE04 route shell, 3 workbenches (2 of which belong to S14/S15), 32-role matrix. Roughly 3–4× S10.

### Slice 14: Governed media ingest, rights, renditions, and lifecycle

**Header:** not started, M, web, depends on S09 and S13, 65 ACs, 0 checked.

**AC composition:** 3 gates; 4×6 operation ACs (DLV-04B-01..04); 24 validation rows; 4 flows ×3; TDD.

**Existing code**
- Reusable BE00 upload-intent/completion: `apps/worker/src/upload-admission/` and `upload-completion/`. BE04b:441 names this "BE00 upload-intent command" seam.
- No asset/rights/rendition/reference/takedown tables.
- No malware scanner implementation anywhere: no scanner adapter in the worker, and `ARCH:393` defers the "scanning path" to setup.

**Gaps and decisions**
- **D15, scanner and transform providers (architecture).**
  - BE04b:442 defines a scanner adapter (`verdict clean|infected|unavailable`). BE04b:485 makes providers replaceable adapters.
  - `ENG:160` requires "100% quarantined until allowlisted detection/scan/metadata checks pass … scanner sandbox".
  - Without a real scanner, DLV-07 rendition can never reach a clean `ready` asset in hosted use.
- **Plan limit.** BE04b validation rejects sizes over 5 GiB (S14 AC040). Hosted Supabase is Free (`ENG:137-138`; `supabase/config.toml:117` `file_size_limit = "50MiB"`; image transformation commented out at 131). `ARCH:392` cites Smart CDN as Pro-plan; Supabase image transformations are also a paid-plan feature (external fact; verify current pricing before presenting). `docs/local-bootstrap.md:109-113` authorizes only Workers Paid as a paid exception.
- **G9 (shared with S15), table owned twice.** `DeliveryPurgeRecord` is defined by both BE04b (`cms_delivery_purge_records`, `BE04b:67`) and BE04c (`delivery_purge`, `BE04c:184`).
- Rights and takedown operations need MFA and case IDs. Shards 06/10/20 do not exist in Phase 2; same issue as D17.

**Hosted vs local:** locally provable with a scanner sandbox/fake and a local transform. Hosted ingest of files over 50 MiB is impossible on the Free plan.

**Size:** 4 ops, 8 tables, 2 async adapters plus workers, 1 workbench.

### Slice 15: Public delivery, exact-version preview, convergence, and recovery

**Header:** not started, M, web, depends on S11–S14, 72 ACs, 0 checked.

**AC composition:** 4 gates; 6×6 operation ACs (DLV-DEL-API-01..06); 12 validation rows; 6 flows ×3; TDD.

**Existing code:** none.
- `cms_publication_versions` and `cms_preview_tokens` exist from S10/S11 storage.
- BE04c's `publication_projection`, `projection_consumer_state`, `delivery_purge`, `active_delivery_pointer` and `preview_session` are absent.

**Gaps and decisions**
- **D17, internal callers that do not exist yet.** DLV-DEL-API-05/06 accept only a "Shard 06/10/20 owning-domain command principal with step-up" and that caller's own `case_id` (`BE04c:78-79,162-163`; `S15:66-67`). Internal commands use "mTLS/service authentication" (`BE04c:83`). Shards 06 (trust & safety), 10 (rights) and 20 (licensing) are later phases. Service-principal "step-up" is undefined. The existing service-credential pattern is `apps/worker/src/platform-configuration/service-credentials.ts` (S07 CFG-05A-01 release service).
- G9 purge-record ownership.
- S11 preview token (`cms_preview_tokens`) vs BE04c `preview_session`: likely consistent (token → session), but the binding should be confirmed during the contract phase.

**Hosted vs local:**
- Locally provable with a fake CDN purge seam (BE00 purge seam `BE04c:90`).
- Real CDN purge and last-known-good behavior under a control-plane failure need staging for operational proof, but no S15 AC text requires hosted evidence.

**Size:** 6 ops (4 internal), 5 tables, a convergence worker, a recovery worker, public, preview and degraded rendering.

### Slice 16: Content quality and privacy lifecycle foundation

**Header:** not started, S, web, depends on S08 and S15, 28 ACs, 0 checked.

**AC composition (`S16:22-49`)**
- 4 gates. AC004 limits Phase 2 to request and lifecycle foundations; fulfillment is Phase 6.
- CFG-05C-02 ×6; 13 validation rows (AC011–023); CFG-14 flow; TDD.

**Existing code**
- Only a deferred placeholder: `apps/web/src/components/platform-configuration/PortabilityQualityLifecycleWorkbench.tsx` (data-state="deferred").
- No `quality_*` tables or routes.

**Gaps and decisions**
- **G4b, deferred-flow ACs.** AC011–013 (`S16:32-34`: `quality_import_jobs`, `quality_export_artifacts`, `quality_restore_verifications`), AC017 (`S16:38`) and AC019–021 (`S16:40-42`) enforce CFG-05C-01 import/export/restore. `PLAN:30` explicitly defers "import, export, and restore".
- **G10, checker execution environment unspecified.** BE05c:133 and 430 define code-owned checker versions and a "Checker adapter", but not where an accessibility checker runs. axe needs a DOM, and Workers have none.

**Hosted vs local:** locally provable. Privacy erasure fulfillment is Phase 6.

**Size:** 1 op (multi-action), 6 tables, a checker adapter, a lifecycle store processor, 1 workbench. Small to medium.

### Slice 17: Phase 2 integration, infrastructure verification, and close gate

**Header (`S17:1-9`):** not started, S, web, depends on S01–S16, 10 ACs, 0 checked. Breakdown is "locked gates 10" (`PLAN:2505-2506`); there is no new endpoint (`PLAN:2492-2506`).

**Exact requirements (`S17:22-31`):**
1. AC001: complete auth and provider-link abuse tests (enumeration, CSRF and state replay, identity substitution, final-method unlink, duplicate proof, stale session and stale context).
2. AC002: identity, organization, CMS, config, admin, media and privacy RLS and capability matrices, through both direct policy and HTTP tests.
3. AC003: CMS last-known-good, failed activation, rollback, outbox replay, duplicate event, worker crash, stale projection, urgent purge.
4. AC004: inaccessible required content cannot publish; checker failures are attributable, recoverable and version-bound.
5. AC005: scan source, built assets, config, migrations and projections for hard-coded settings, registry items, secrets or policy values.
6. AC006: contract, permission, unit, integration, component, accessibility, responsive, degraded-network, multi-tab and E2E suites.
7. AC007: canonical validation green on tests, 100% coverage, lint, type-check, build, browser, security, dependency and spec coverage.
8. AC008: `/verify-infrastructure` across auth, admin, settings, CMS, media, queue, storage, staging, observability, backup and rollback.
9. AC009: exercise auth-provider, CMS-publication, security/privacy, queue/outbox, database-recovery and rollback runbooks with exact evidence.
10. AC010: update progress, ledger, architecture graph, validation evidence and session continuity, only after every check passes.

**Phase-level gates (`P2:398-400`):**
- "AC266 post-Phase 2 production-readiness/release evidence remains deferred and is excluded from the active Phase 2 completion denominator."
- "Slice 17 close-gate `/verify-infrastructure` passes."
- "`/validate-phase` passes after every slice is complete."

**Hosted requirements and risks:**
- **AC008 needs staging, and observability is the risk.** The prior verify-infrastructure run marked "Logging/alerting" and "Production telemetry" **BLOCKED** on the AC209 receipt and AC211 samples (`.memory/wiki/specs/audits/verify-infrastructure-2026-09-06-0300.md:17-19`). DEC-104 moved those to post-deployment/post-launch. **D18:** the owner must say whether S17's observability gate can pass on configuration/staging evidence without AC209/AC211. Otherwise Phase 2 cannot close.
- **Backup and database recovery on the Free plan.** `ENG:137-138` says Free has no PITR and that "local restore drills record observations without promoting them to hosted recovery guarantees". AC009's database-recovery runbook can therefore be a local drill (diagnostic). "backup" under AC008 must be interpreted the same way (part of D18).
- **Auth-provider runbook (AC009)** needs live provider configuration. One real Google identity was created (`P2:325-329`). Other providers (Apple/Facebook/SoundCloud) were "temporarily_unavailable" at the 2026-09-06 check; current status was not re-verified in this survey.

**Size:** integration-heavy; likely the longest wall-clock slice because of hosted gates.

---

## 3. Open owner decisions: recorded in trackers/scans, unresolved

"Resolved?" was checked against `.memory/wiki/decisions.md` (DEC-101..107), `APPR` (DEC-108), and session logs 2026-09-26..10-02. Unless noted, no approval was found.

### D1. Editorial workflow-policy authority source (S10, S11, and now the S09 critical path)

**Citations**
- `SCAN:2026-09-28-cms-editorial-policy-source:3,10-19,38-50`
- `S10:431-433` ("protected workflow-policy source … still await owner decisions") and `S10:485-487`
- `IDX:27`, `HO:177-178`
- `BE03b:485-493` requires an immutable key/version/policyHash, requiredDecisionCount 1–8, requiredCapabilities and approvalEvidenceHash.

**Status:** open. DEC-108 created a *code-owned* schema-review workflow registry (`BE03a:1556-1561`), but not an editorial one.

**Options**

| Option | Pros | Cons |
|---|---|---|
| A. Code-owned editorial workflow registry, versioned in code and seeded immutable rows, bound to a content-type version at activation. Mirrors DEC-108's BE03a registry. | Consistent with DEC-108. No new op or UI. Deterministic and PR-reviewed. Fastest unblock for S09 real source rows. | Policy change requires a deploy. Relaxes the scan's "no default rows" stance. |
| B. Owner-enrolled append-only persisted registry, as the scan proposes, with a new protected enrollment op. | Runtime owner control, full audit trail. | Adds op, UI and RPC. Owner must enroll before any entry create, including hosted tests. Larger cascade. |
| C. Reuse the 03a schema activation evidence. | No new source. | The scan says it is distinct and "cannot be substituted". Conflates schema and editorial governance. |

**Recommendation:** A. Ask the owner the product sub-question in the same message: which content types are "protected", and is a solo-author/no-review path ever allowed? BE03b's minimum of 1 independent reviewer means two humans for every publish.

### D2. Protected CMS-06 conflict-detail read (S10)

**Citations:** `SCAN:2026-09-30-cms-conflict-detail-read:47-63`; `S10:264, 322-325`; `IDX:27`.

**Options**

| Option | Pros | Cons |
|---|---|---|
| A. New protected `GET /api/v1/cms/entries/{entryId}/conflicts/{conflictId}` with bounded base/theirs/yours values and provenance, conflict ETag, 403/404 concealment, no-store. This is the scan proposal. | Clean read-only path. Matches IA03 AC-CMS-06. Survives reload and multiple tabs. | New op, RPC and spec cascade; about 6 more ACs. |
| B. Return the three values in the CMS-03B-01 409 or in `ConflictRecordResource`. | No new route. | BE00 409 detail allowlist forbids values. Lost on reload. Values in error bodies are a telemetry risk. |
| C. Add open-conflict values to the CMS-03B-11 draft detail. | One loader. | Mixes concerns. Bigger payload and ETag churn on every load. |

**Recommendation:** A.

### D3. Draft base and schema identity on `EntryDraftDetailResource` (S10, also S12 CMS-15)

**Citations:** `SCAN:2026-09-27-cms-draft-revision-number:3-7,32-47`; `S10:432` ("draft-detail response correction"); `IDX:27`.

**Status:** open. `BE03b:815-825` still lacks `revisionNumber` and `schemaVersionId`. The contract has `schemaVersionId` only in server evidence (`packages/contracts/src/cms-editorial/entry-draft-detail.ts:171`).

**Options**

| Option | Pros | Cons |
|---|---|---|
| A. Add required server-derived `revisionNumber` and `schemaVersionId`. This is the scan proposal. | Minimal; the data already exists in SQL. Unblocks the editor's autosave base and field-definition load. | Locked-spec amendment, plus FE/IA updates. |
| B. Change CMS-03B-01 `baseRevision` to the revision UUID. | Removes the number. | Rewrites an implemented contract and tests (AC029). |
| C. Derive the base from history (CMS-03B-03). | No contract change. | Not authoritative, racy, effectively a fabricated base. |

**Recommendation:** A.

### D4. Rich-text AST grammar, validator and renderer (S10)

**Citations:** `SCAN:2026-09-30-cms-rich-text-ast:34-55`; `S10:308-322`. Migration `20260927540000_cms_rich_text_admission_gate.sql` refuses all non-null rich text.

**Options**

| Option | Pros | Cons |
|---|---|---|
| A. Own minimal versioned grammar (`rich_text.v1`): paragraph, heading, list, quote; marks bold/italic/code; https/mailto/internal-route links; no embeds (media via governed blocks). Shared TS plus plpgsql validator, JCS hash, typed React renderer. | Smallest attack surface. SQL-validatable. CSP-safe. No dependency. | Must build a constrained editor; limited formatting. |
| B. Allowlisted subset of an existing schema (TipTap/ProseMirror JSON or Portable Text). | Mature editor UX. | Bundle-budget cost. Upstream schema drift. Still needs a PG validator and canonical hash. |
| C. Exclude rich text from Phase 2 (keep refusal; narrow field kinds). | Zero work now. | Feature gap. Needs an owner scope amendment so AC031/050–052 are truthfully satisfiable. |

**Recommendation:** A. The owner chooses the node and mark set.

### D5. CMS-07 revision comparison across field, block and relation (S10)

**Citations:** `SCAN:2026-09-30-cms-revision-comparison:3-5,37-54`; `S10:150-154`; `IDX:20`.

**Options**

| Option | Pros | Cons |
|---|---|---|
| A. Extend BE03b/FE03 to all three domains with privacy-safe stable identities: field ID; relation-definition ID plus opaque target hash; block = composition-instance stable path. A typed refusal (not a partial 200) above 512 changes. | Meets IA03 AC-CMS-07. | Needs S12 composition data; a cross-slice dependency on S12. |
| B. Narrow IA03 for Phase 2 to field+relation; blocks later. | Smaller. | Owner narrowing. Block and template changes are invisible. |
| C. Field-only response with an explicit `coverage` flag. | Truthful and quick. | Does not satisfy IA03 as written; still needs narrowing. |

**Recommendation:** A.

### D6. CMS-03B-04 restore migration-chain identity (S10)

**Citations:** `SCAN:2026-09-28-cms-restore-chain:3,8-23,40-52`; `S10:184-186, 357-358`; no `cms_restore_revision` RPC exists.

**Options**

| Option | Pros | Cons |
|---|---|---|
| A. `migrationChainId` names a private immutable chain-manifest row, server-composed from completed 03a plan edges (≤64), with content hash. This is the scan proposal. | Keeps the locked request shape. Immutable and auditable. | New table and producer. Couples to DEC-108 migration-plan producers. |
| B. ID is the last completed plan; the server walks edges. | No new table. | Ambiguous if more than one plan per edge; needs a uniqueness rule. |
| C. Drop `migrationChainId` from the request; the server computes the chain and returns its digest. | No caller-supplied authority. Simplest client. | Changes the locked request and AC037. |

**Recommendation:** A, since the request already carries the UUID.

### D7. CMS-11 protected latest-template read: BE03c/FE03 propagation (S12)

**Citations:** `SCAN:2026-09-27-cms-template-latest-read:3-4,27-38`; `S12:116-118, 498-499`; `IDX:22,26`. The route is already implemented and tested. BE03c registers only `cmsTemplateContextRead` (`BE03c:143,151`; that context read was resolved 2026-09-27, `S12:570-572` → 15:38 entry).

**Options**

| Option | Pros | Cons |
|---|---|---|
| A. Approve as implemented. | Zero new code. Two-tab 409/rebase already proven locally. | Locked-spec edit. |
| B. Reject and fold into the context read. | One route. | Bigger context payload; rework. |
| C. Reject and remove the edit page. | Smaller surface. | CMS-11 successor edit loses its canonical read; stale-tab 409 recovery breaks. |

**Recommendation:** A.

### D8. Governed template activation authority (S12 contract gap; blocks S11/S15 safe publication)

**Citations:**
- `SCAN:2026-09-28-cms-template-activation:3-4,29-46`; `S12:192-200`
- `BE03c:226-230` ("Public template activation remains an explicit, unresolved 03c contract gap")
- `APPR:31`, `HO:85`. DEC-108 explicitly did not resolve it.

**Options**

| Option | Pros | Cons |
|---|---|---|
| A. Reviewer-gated activation that reuses DEC-108's CMS review, decision and assignment machinery generalized to a template subject, with CAS switch and `cms.template.activated.v1`. | Consistent and safe. Code reuse. | About 3–4 ops. Needs a second human. |
| B. Designer-only activation with recent MFA and CAS. | Small. Works for a sole owner. | Self-approval. |
| C. Policy-derived: ordinary templates designer-activated; reserved/provenance-region changes review-gated. | Balanced. | Two paths, more spec. |

**Recommendation:** A, or B if the owner prioritizes solo operation.

### D9. CMS-12 reusable-pattern authority source and RPC (S12)

**Citations:** `SCAN:2026-09-28-cms-pattern-source:3,8-35`; `S12:151-153, 267-270, 500-502`; `IDX:27` ("CMS-03C-02 transport still lacks its atomic private RPC and pattern source authority").

**Options**

| Option | Pros | Cons |
|---|---|---|
| A. Protected pattern-version create, activate and selector-read ops plus linked-update diff and detach. This is the scan proposal. | Complete runtime authoring. | 4–6 new ops and UI. |
| B. Code-owned patterns registered like blocks (release/registry path), with a read-only selector for authors; runtime authoring later. | IA AC-CMS-12 only requires *using* an immutable readable pattern. Reuses the code-owned registry pattern. Smallest. | Designers cannot create patterns in-app. Linked-update diff is still needed on version bump. |
| C. Reuse template versions as the pattern source. | No new aggregate. | Conflates aggregates; violates the BE03c split. |

**Recommendation:** B for Phase 2.

### D10. CMS-14 canonical-taxonomy overlap source, taxonomy-version ops, and the curator port (S12)

**Citations:** `SCAN:2026-09-28-cms-taxonomy-source:3,7-41`; `S12:37-38` (`actTerm` fail-closed 503), `S12:444-446`; `IDX:5`.

**Options**

| Option | Pros | Cons |
|---|---|---|
| A. A read-only canonical-taxonomy projection contract fed by owning domains, plus taxonomy-version create/activate/selector ops. | Correct long-term. | Most owning domains (instrument, gear, place, rights, jurisdiction) are later phases, so overlap fails closed for those. |
| B. Code-owned canonical seed list. | Unblocks now. | Risks duplicating canonical taxonomies, which Ideation D-01 forbids. |
| C. A plus scope: implement providers that exist in Phase 2 (e.g. S03 role facets, S04 organization types); vocabularies in absent domains get a typed "canonical source unavailable" refusal. | Truthful and partial. | Some vocabularies are unusable until later phases. |

**Recommendation:** C, built on A's contract.

### D11. CMS-16 related-content eligible-target authority (S12 AC036–038; the flow is deferred)

**Citations:** `SCAN:2026-09-28-cms-related-content-source:3,31-47`; `S12:162-163, 202-210`. The flow is deferred at `PLAN:30`.

**Options**

| Option | Pros | Cons |
|---|---|---|
| A. Treat AC036–038 as admission-validation-only; keep the fail-closed port with `BOUNDARY:` plus tracking issue plus sentinel test. | Smallest. | AC050 says "leave no unresolved implementation boundary"; arguable. |
| B. Amend the plan to move AC033–038 (CMS-15/16) out of Phase 2, consistent with the scope lock. | Clean and consistent. | Count change and propagation. |
| C. Specify and implement the eligibility projection now. | Complete. | Builds a deferred feature. |

**Recommendation:** B. This also covers G4.

### D12. CMS-15 locale source-stale fan-out bound and event dedupe key (S12, but the trigger fires on S10 revision writes)

**Citations:** `S12:356-364`; `.memory/pipeline/progress/memory/blockers.md:5-13` (active blocker). Migration `20260927450000_cms_locale_source_stale`.

**Options**

| Option | Pros | Cons |
|---|---|---|
| A. Synchronous with a per-entry dependent-locale cap (e.g. ≤32, with new-locale refusal) and a per-locale aggregate key for `cms.localization.changed.v1`. | Simple, deterministic, fits the 15s deadline. | Hard cap on locales. |
| B. Asynchronous fail-closed invalidation via outbox, with a publish-time staleness recheck. | Scales. | Worker complexity; eventual-consistency window. |
| C. Disable the trigger until CMS-15's phase (forward-only migration). | Removes the S10 risk. | Removes already-built protection. |

**Recommendation:** A.

### D13. MFA step-up surface (cross-cutting: S09, S11 decisions/publish, S14 revoke, S15 holds, S16 lifecycle)

**Citations:** `.memory/pipeline/progress/verification/2026-09-25-ac265-free-identity-and-read-grant-decision.md:106-108` ("step-up surface decision remains open").
- Code derives `stepUpAt` from token MFA claims (`apps/worker/src/authentication/production-token.ts:253`).
- No in-app MFA challenge page exists under `apps/web/src/pages`.
- DEC-108 requires recent MFA for S09 decisions, so S09 may settle this. Verify before asking.

**Options**

| Option | Pros | Cons |
|---|---|---|
| A. Server-side step-up op (Worker-mediated challenge/verify, cookie rotation to aal2). | Server-first; no browser Supabase tokens. | New auth op. |
| B. Browser Supabase MFA challenge then session refresh. | Less server code. | Browser holds Supabase auth surface. |

**Recommendation:** A, unless S09 work already settled it.

> Numbering note: D-IDs below continue for survey-identified items that need owner choice.

---

## 4. Survey-identified gaps not yet in any tracker (G1–G11) and the decisions they imply

### G1 / D19: S11 publication preflights depend on later slices

`S11:25` (AC004) and `BE03b:964` require "contract/relation/privacy/security/accessibility/rights/media/route/SEO/locale/migration/domain-binding preflights" at review, schedule execution and publish. Media is S14, route/SEO is S13, and accessibility checkers are S16, all after S11.

| Option | Pros | Cons |
|---|---|---|
| A. S11 builds a preflight registry; a category whose domain is not built yet passes only when the frozen dependency manifest contains no references of that kind, and otherwise fails closed. Later slices register providers. | Truthful; no fabricated pass; keeps order. | Requires a registry abstraction now. |
| B. Split S11: review/schedule/preview now, publish (03B-09) after S13, S14 and S16. | Simple. | Plan amendment; S13's dependency on S11 publish must be re-checked. |
| C. Always fail closed. | Safe. | S11 happy path is impossible; S11 cannot close. |

**Recommendation:** A.

### G2 / D20: BE03b `EditorialDecisionRequest` takes caller `capability` and `stepUpAt`

`BE03b:417-424`, validated at `BE03b:206` and `S10:558` (AC042). DEC-108 replaced the analogous schema-review request with `{expectedVersion, decision}` plus server-resolved binding MFA.

| Option | Pros | Cons |
|---|---|---|
| A. Align with DEC-108: remove both fields; derive from assignment and binding. | Consistent; no trust in caller authority. | Spec amendment; S10 AC042 rewording. |
| B. Keep them as assertions the server must equal. | No contract change. | Redundant; leaks policy shape. |
| C. Keep as is. | Nothing to do. | Trust-boundary weakness. |

**Recommendation:** A.

### G3: S10 AC038–048 validate S11 operations (CMS-03B-05..09)

`S10:554-564`. S10 cannot fully close without S11 request admission.

**Recommendation (implementation-level):** lock the S11 Zod contracts during S10's contract phase. Otherwise move the 11 ACs to S11 (plan change).

### G4 / D21: Phase 2 ACs for flows the scope lock defers

- S12 AC033–038 (CMS-03C-04/05; `S12:787-792`).
- S16 AC011–013, 017, 019–021 (CFG-05C-01 import/export/restore; `S16:32-42`).
- Both conflict with `PLAN:30`.

| Option | Pros | Cons |
|---|---|---|
| A. Move them out of Phase 2 (count-preserving deferral). | Consistent with the scope lock. | Propagation. |
| B. Satisfy them at contract/storage/admission level only. | Partial work, no plan change. | Ambiguous under AC050 "no unresolved boundary". |
| C. Implement the deferred flows fully. | Complete. | Builds deferred scope. |

**Recommendation:** A.

### G5 / D22: S13 cross-slice cycle

About 40 S13 ACs belong to S14/S15 (AC054–068, 131–132, 136–137, 147–148, 150–151, 155–161, 163–167; `S13:75-89, 152-188`). S14 depends on S13 and S15 on S14, so as planned S13 cannot close before S15. This is the same class of cycle DEC-108 fixed for S09.

| Option | Pros | Cons |
|---|---|---|
| A. Count-preserving reassignment to S14/S15. | Removes the cycle. | Plan amendment. |
| B. Close S13–S15 as a group. | No reassignment. | Long-lived open slice; muddier tracking. |
| C. Stubs. | Nothing to plan. | Violates boundary-not-placeholder. |

**Recommendation:** A.

### G6: FE04 `DLV-MEDIA-API-01` vs BE04b `DLV-04B-01..04` ID drift

`fe/04-cms-delivery-media.md:345,430`; `BE04a:27`; `S13:171` (AC150).

**Recommendation:** a mechanical cross-layer correction via propagate-decision; the owner is informed, not asked to choose.

### G7 / D23: menu and route approval transition undefined

The `draft→review→approved→active` lifecycle (`BE04a:194`) has no review/approve or preview op, yet DLV-NAV-API-02 requires an approved and previewed candidate (`BE04a:166`).

| Option | Pros | Cons |
|---|---|---|
| A. Generalize the S11 editorial review to a menu subject. | Reuse. | Coupling. |
| B. Publish = approval: DLV-NAV-API-02 validates and previews; publisher ≠ editor optional. | Smallest. | Weaker separation. |
| C. Admin task-inbox approval (S08). | Reuses the S08 shell. | New task type. |

**Recommendation:** B, with the owner choosing separation of duties. Slug and metadata lifecycle needs the same answer.

### G8 / D24: "Shard 05 policy projection" for discovery metadata undefined

The projection is named at `BE04a:94` and listed under Shard 05 at `BE04a:306`. No BE05 counterpart or code exists.

| Option | Pros | Cons |
|---|---|---|
| A. Define it in S13 over S07 typed settings plus S05 unclaimed status plus S16 holds. | Real policy source. | Cross-shard spec. |
| B. Code-owned conservative default policy until Shard 05 definitions exist. | Fast. | Hard-coded policy; S17 AC005 forbids hard-coded policy values. |
| C. Fail-closed noindex for anything without policy. | Safe. | Discovery is useless. |

**Recommendation:** A, with C as the explicit unavailable state.

### G9: `DeliveryPurgeRecord` defined twice

`cms_delivery_purge_records` (`BE04b:67`) vs `delivery_purge` (`BE04c:184`). S14 (DLV-08 urgent purge) runs before S15.

**Recommendation:** one physical table created in S14, with S15 consuming it through the BE00 purge seam (`BE04c:90`). Architecture-level data ownership: inform the owner and propagate.

### G10 / D25: S16 accessibility checker runtime unspecified

`BE05c:133,430`; S17 AC004 depends on it.

| Option | Pros | Cons |
|---|---|---|
| A. Structural checks over the CMS AST and registry in the Worker (alt text, heading order, captions metadata, link text). | Deterministic, cheap. | Not a full axe. |
| B. Cloudflare Browser Rendering plus axe-core. | Real DOM audit. | Quota and cost must be verified; adds a provider. |
| C. CI runner job. | Uses existing CI. | Not an in-product check; latency. |

**Recommendation:** A, with the owner confirming the scope.

### G11 / D26: hosted test-identity grants for editorial roles

DEC-103 allows exactly one expiring `cms.schema_registry.read` grant and keeps the owner as sole admin. Hosted proof of S10–S16 author, reviewer, publisher, curator, media and privacy roles would need more grants. No S10–S16 AC text requires hosted evidence, but S17 AC008/AC009 runbook and staging exercise likely touch CMS publication.

**Recommendation:** ask once, when S17 approaches:
- A. authorize scoped expiring staging grants per role;
- B. owner-only hosted smoke plus local role matrix;
- C. defer hosted role proof to the AC265-style pre-release gate.

### Other decisions surfaced in §2

- **D15:** S14 scanner and transform providers, plus the Supabase Free 50 MiB limit vs the BE04b 5 GiB rule.
  - A: self-hosted ClamAV consumer on owner hardware or runner, plus in-Worker or WASM image transforms. $0 but operational load.
  - B: approve Supabase Pro (image transformations) plus a paid scanning API. Needs exact price approval per `docs/local-bootstrap.md:111-113`.
  - C: Phase 2 ships fail-closed quarantine only, so assets never become `ready` in hosted use. That conflicts with the DLV-07 happy path.
  - Recommendation: A for scanner and transforms; cap Phase 2 purpose profiles at the plan limit unless the owner approves Pro. Verify current provider pricing before presenting.
- **D16:** S13 AC171 "VoiceOver/NVDA smoke": precedent conflict between S03/S05/S07 (checked) and S09 AC266 (real-device pre-release, DEC-101).
  - A: same interpretation as S03/S05/S07 (automated accessibility-tree smoke); B: real-device, deferred like AC266; C: real-device now.
  - Recommendation: A, consistent with the three completed slices; real-device stays under AC266.
- **D17:** S15 internal callers for Shards 06/10/20 plus service "step-up" and mTLS.
  - A: register Phase 2 internal command principals using the S07 service-credential pattern, test-driven, with step-up defined as signed short-lived principal assertions.
  - B: defer DLV-13/14 (6+6 ACs) to the phase that builds those shards.
  - C: a staff/admin case operator proxies the commands in Phase 2.
  - Recommendation: A.
- **D18:** S17 verify-infrastructure observability and backup gates vs DEC-104 and the Free tier.
  - A: S17 passes on configuration/staging plus local restore-drill evidence; AC209/AC211 stay on their own timelines.
  - B: S17 waits for AC209.
  - C: approve Supabase Pro for PITR before close.
  - Recommendation: A. This is the reading consistent with `ENG:137-138` and DEC-104.

---

## 5. AC209 / AC211 / AC265 / AC266 vs the Phase 2 completion definition

All four are **outside** the Phase 2 implementation-completion denominator. They remain authored, unchecked and mandatory on their own timelines.

- `PLAN:34`: "**Phase 2 implementation-completion denominator**: 2011."
- `PLAN:37`: "AC209, AC211, AC265, and AC266 remain authored and unchecked outside the active implementation denominators."
- `PLAN:45`, AC209: "**production-rollout/post-deployment evidence gate**. It does not gate Slice 10 implementation or the initial controlled production deployment; it must pass before alerting is declared ready."
- `PLAN:46`, AC211: "**post-launch operational SLO acceptance**. It does not gate the initial launch and is mandatory after initial launch…"
- `PLAN:47`, AC265: "**mandatory pre-release production-readiness/release gate** … excluded from the Slice 09 and Phase 2 active implementation denominators without being waived."
- `PLAN:48`, AC266: "**pre-release real-device** accessibility gate … must never be marked passed, accepted, waived, simulated, or inferred."
- `PLAN:50`: "none may ever be marked passed, waived, simulated, or inferred before genuine evidence exists."
- `PLAN:163`: "**Phase 2 implementation-completion denominator**: 2011; AC209, AC211, AC265, and AC266 remain authored, unchecked, and mandatory acceptance gates on their distinct timelines."
- `P2:398`: "AC266 post-Phase 2 production-readiness/release evidence remains deferred and is excluded from the active Phase 2 completion denominator."
- `IDX:6`: "AC209, AC211, AC265, and AC266 remain authored and unchecked outside the active implementation denominator."
- `HO:37-38, 187-189`: keep them on their deployment, launch and pre-release timelines, with "no synthesized provenance or devices".

The caveat is D18: S17 AC008's verify-infrastructure "observability" and "backup" gates could pull AC209-type evidence back into the close gate unless the owner confirms the scoped reading.

---

## 6. Hosted vs local summary

| Slice | Locally provable | Needs hosted/provider/paid/device | Looks impossible locally |
|---|---|---|---|
| 10 | all 75 | none by AC text (hosted role proof optional, G11) | none |
| 11 | all 45 | production publication writes disabled on Free (`ENG:137`); not a Phase 2 AC | none |
| 12 | all 50 (subject to D8–D11) | none | none |
| 13 | 173 | AC171 if read as real-device (D16) | AC171 under the AC266 reading |
| 14 | all 65 with scanner sandbox and local transforms | real scanner/transform provider (D15); >50 MiB hosted ingest needs Supabase Pro | hosted large-file ingest on the Free plan |
| 15 | all 72 with a fake purge seam | real CDN purge proof is operational, not AC-mandated | none |
| 16 | all 28 | checker provider if option B (D25) | none |
| 17 | AC001–007, 010 | AC008 staging/observability/backup; AC009 auth-provider runbook (live IdP), database recovery (local drill acceptable per `ENG:138`) | AC008/AC009 cannot be closed locally |

---

## 7. Tracking hygiene noticed (low priority)

- `IDX:14-30` dated lines mix "Phase 2 9/17" (e.g. `IDX:20,22,25,26`) with the authoritative 8/17 (`IDX:5,10,37`). These are stale historical lines.
- `PLAN:1940, 2075, 2269, 2354, 2446, 2494` say "awaiting plan approval" for S11 and S13–17, although the plan was approved 2026-08-31 (`PLAN:3-5`) and earlier slices with the same label completed. Probably stale; confirm in one line with the owner.
- `PLAN` checkboxes for some completed-slice ACs (e.g. `PLAN:1125` S05-AC-255, `PLAN:1462` S07-AC-173) are `[ ]` while the trackers show `[x]`. The trackers are authoritative.
- BE04a/04b/04c/05c and BE03b/03c all state "Open Questions: None" (e.g. `BE03c:832-834`) while BE03c itself records an unresolved activation gap at `BE03c:226-230`. Treat "None" as unreliable.

---

## 8. Suggested decision batching (one question at a time per project rule)

1. **Before S09 can finish:** D1 (editorial policy) and D13 (step-up surface, if S09 has not settled it).
2. **Before S10 RED:** D3, D2, D4, D6, D5, G2/D20, and the D12 locale cap.
3. **Before S12 RED:** D7, D9, D10, D8, D21/D11 (deferred-flow ACs).
4. **Before S11/S13 planning:** D19 (preflights), D22 (S13 cycle), D23, D24.
5. **Before S14/S15:** D15, D17, G9.
6. **Before S16/S17:** D25, D16, D18, D26.
