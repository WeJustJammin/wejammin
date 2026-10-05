# Phase 2 Slice 12 — implementation-ready breakdown (DEC-113, DEC-114, DEC-120, D7, D9–D12)

- Worktree: `/home/rob/.codex/worktrees/ac265-hosted-evidence-producer/WeJammin`.
  - First pass (01:24) was written at HEAD `a946b333`.
  - Refreshed 2026-10-02 at HEAD `295b0850` ("wip(s09): checkpoint partial GREEN work"). That commit landed the BE03b, BE04a/b/c and BE05* spec edits and the S09 review-machinery migrations `20261002125000…20261002137000`.
  - Still **uncommitted** in the tree: BE03a, IA03, DD03 and FE03 (the DEC-119/DEC-120 touch-ups), the plan (`PLAN`, S09 amendment AC284–AC1200), the S09/S10/S12 trackers, and the web/worker S09 GREEN work.
  - BE03c is byte-identical to the S09 ledger freeze: SHA-256 `b5ee667b…`, 878 lines.
- Refresh delta: DEC-120 is applied (§2.13, OD-6). Line citations were re-anchored to current disk. The S09 helper reuse is now concrete (§2.2). The depth floor is re-estimated now that S09 adopted the strict method (§3). The localization contract was corrected against IA03:250 and DD03:398-399 (§2.7 items 1 and 10, OD-4).
- Method: read-only. Only this report was written. No tests were run, because concurrent edits are in flight and validation is heavy. Status claims cite tracker continuations and code presence, not fresh runs.
- Path abbreviations:
  - `S12` = `.memory/pipeline/progress/slices/phase-02-slice-12.md`
  - `PLAN` = `.memory/wiki/specs/phases/phase-2.md`
  - `IA03` = `.memory/wiki/specs/ia/03-cms-content-modeling.md`
  - `DD03` = `.memory/wiki/specs/ia/deep-dives/03-cms-content-modeling.md`
  - `BE03a/b/c` = `.memory/wiki/specs/be/03{a,b,c}-*.md`
  - `BE04a` = `.memory/wiki/specs/be/04a-navigation-routes-discovery.md`
  - `FE03` = `.memory/wiki/specs/fe/03-cms-content-modeling.md`
  - `SCAN:x` = `.memory/wiki/specs/audits/propagation-scan-2026-09-2*-cms-x.md`
  - `A4` = `scratchpad/reports/a4-shard05.md`
  - `RES` = `scratchpad/decisions/s10-s17-resolutions.md`
  - `DEC-113/114/119/120` = raw records in `.memory/raw/events/2026-10-02.jsonl`
  - `S09L` = `.memory/pipeline/progress/verification/2026-10-02-slice-09-dec108-depth-floor.md`

## 0. Headline findings

1. **No S12 criterion moves out of S12 because of DEC-108.** DEC-108 moved the *implementation* of CMS-03C-01 (immutable template draft) and the new `cms_resolve_template_compatibility` resolver into S09 scope as prerequisites. Sources:
   - The approval record `verification/2026-10-02-slice-09-activation-amendment-approval.md:29-31` says: "Only the minimum … immutable compatible-template prerequisites move into Slice 09. Remaining Slice 10/12 work stays in place."
   - S09 AC282 says the transfer count is zero.
   - The S09 breakdown rule says these items stay counted in their owning slice; S09 counts only integration criteria.
   - **Confirmed on disk by the S09 ledger.** `S09L:112` says "the CMS-03B-10, CMS-03B-11, CMS-03B-01 and CMS-03C-01 items stay in Slices 10 and 12". S09 counts only:
     - the resolver (13 rows, P2-S09-AC-669…681);
     - the integrated path that consumes a CMS-03C-01 template (P2-S09-AC-751).

   AC004–009 and AC022–025 therefore stay authored and counted in S12. Their evidence is produced on the S09 critical path, and S12 closes them only after amended S09 acceptance. See §1.2.
2. **DEC-113 is underspecified in two places, and the sources cannot close either.**
   - DEC-113's count rule is the strictest policy "among the bound content types". `PatternVersion` has no bound content types (IA03 data model; DD03 `pattern_version` row) → OD-2.
   - D10 asks for taxonomy-version *activate* but does not say whether activation is reviewer-gated. The IA state machine includes `review`, but DEC-113 names only templates and patterns → OD-1.
3. **BE04a already points at review machinery that does not exist yet.** The DEC-115 edit is now **committed** in `295b0850` (`BE04a:487`). It says delivery review "use[s] the generalized CMS review machinery of DEC-108 and DEC-113. BE03a defines the review, decision, and assignment records…".
   - BE03a's tables are schema-specific (`BE03a:1711-1713`). A grep of BE03a for "generalized" returns nothing.
   - The S12 cascade must author the generalized definition. The BE04a precedent (per-family tables "same column set as BE03a … with these substitutions", `BE04a:475-477`) is the pattern to follow.
   - S09 has since shipped review helpers in `20261002125000_cms_schema_review_support.sql` and `…130000`. About half of them are already family-neutral; the other half read the schema tables directly. §2.2 lists which S12 reuses as-is and which need a family-parameterized core.
4. **Templates, patterns and taxonomies lack a stable series identity.**
   - Events require `templateId` and `taxonomyId` separately from the version ID (`BE03c:754-755`, `IA03` events).
   - The CMS-03C-03 path names `{taxonomyId}`.
   - The tables have only a per-version `id` and a **global** `UNIQUE(key, version)`:
     - `20260927200000_cms_template_authority.sql:147-176`
     - `20260927260000_cms_taxonomy_authority.sql:29`
     - `20260927290000_cms_composition_authority.sql:63`
   - Global uniqueness is also a latent cross-owner existence leak: a 409 on another owner's key.
5. **Live route path collision.**
   - Two routes overlap: the implemented latest read `GET /api/v1/cms/templates/{templateKey}` (`platform-registries.ts:1479`) and the static `GET /api/v1/cms/templates/context` (`:1382`).
   - A template key of `context` is legal under `^[a-z][a-z0-9-]{1,63}$`. Such a template can never be read through the latest read, whichever route the router matches first.
   - No reserved-key list exists (grep of `template.ts` and the template migrations).
6. **CMS-15 is partly built, with defects that D12 targets:**

   | Defect | Location |
   |---|---|
   | Every locale event of one write shares `aggregateType=cms_content_entry` and one `aggregateVersion`. This collides on the BE00 `(aggregate_type, aggregate_id, aggregate_version)` dedupe index (`BE00:313`). | `20260927440000_cms_locale_author_rpc.sql:279-286` and `20260927450000_cms_locale_source_stale.sql:52, 95-104` |
   | Staleness is revision-level (`payload_hash`), not per field. | — |
   | No locale cap. | — |
   | The authored target revision stores only the fields sent in the request, so earlier translations are not carried forward. | — |

   The cap of 32 has a source: BE03b `DependencyManifest.localeSources.max(32)` (`BE03b:371-373`).
7. **CMS-16 has no producer, no reads, and no freeze.**
   - The production port returns a fail-closed 503 (`cms-composition-production-related.ts:56`).
   - The 03b dependency manifest has no related-content member (`BE03b:358-381`).
   - Shard 04 specs never mention related content or locale fallback; grep of BE04c, IA04 and FE04 for "related" finds only unrelated hits. Public delivery of both is therefore a cross-shard gap that S15 must consume.
8. **Additional spec gaps:**
   - "Versioned template candidate with **exact impact set**" (IA03 AC-CMS-11 `:43`) is defined nowhere in BE03c or FE03.
   - IA03 says CMS-12 applies to "entry revision **or template draft**" (`:44, :65`), but `cms_composition_instances` references only entry revisions.
   - The 03b "active schema locale set" (`BE03b:245`) is undefined, and entry create validates only the BCP 47 shape (`20260927080000:791`) → OD-4.
   - **Fallback-chain home contradicts IA.** BE03c carries `fallbackChain` (≤16) per *variant* in the CMS-03C-04 request (`BE03c:456, 589`). IA says otherwise in three places:
     - IA03:250: "Each content-type version records … `default_locale` (delivery fallback root …). Fallback is an explicit ordered per-type/field chain"
     - IA03 AC-CMS-15 (`:47`): "the ordered per-type/field fallback chain is explicitly declared"
     - DD03:45: "Field/type-specific ordered chain"

     The first pass also wrongly said resolution "never [uses] default_locale implicitly" for *all* fields. DD03:398-399 limits that rule to `no_fallback` fields; `default_locale` is the governed root for the others. Corrected in §2.7; the home is folded into OD-4.
9. **S09 adopted the strict per-item depth floor.** Its floor is 1200, with 917 delta criteria (`PLAN:1549-1553`, `S09L`). The S12 floor (50) is therefore the coarse per-op lump that S09 replaced. It already omits two existing BE03c matrix rows: `allowedBlocks/blockRegistryDigest` and "All browser responses state/ownership envelope" (`BE03c:300, 318`). Every AC022–039 citation of "validation table at line 148" is stale; the table is now at `BE03c:296-318`. See §3.
10. **The CMS-15/16 publication interplay depends on later slices:**
    - Slice 11: CMS-03B-05/06/09 and the D19 preflight registry.
    - Slice 15: delivery consumption.
    - Slice 10: the revision write paths that fire source-stale, taxonomy-field assignment, and composition copy-forward.

    S12 currently "Depends on: Slice 09, including the amended Slice 09 criteria…" only (`PLAN:2926`). See §4 and §6.
11. **DEC-120 affects S12 in three ways** (§2.13):
    - Standing designer, curator, author, editor and specialist grants now run up to 90 UTC days. Every S12 capability check already goes through the term-aware `cms_person_holds_capability` (`20261002125000:29-55`).
    - Definition-review **assignments** stay at most 7 days, because DEC-120 keeps the DEC-108 bound.
    - That 7-day bound collides with *scheduled* definition activation. S09's `cms_review_qualifying_approvers` (`20261002125000:321-339`) counts only approvers whose assignment is *currently* effective. A schedule that fires more than 7 days after assignment start therefore always fails closed → OD-6.

---

## 1. Per-AC status matrix

### 1.1 Status of AC001–AC050 at HEAD

Legend for the Status column:

- **L-done**: implemented locally with RED→GREEN evidence cited in S12; not accepted.
- **L-part**: partly built.
- **Blocked**: the needed spec or decision is missing; resolved now by DEC-113/114/D-items unless an OD is noted.
- **None**: nothing built.

| AC | Topic | Status | Evidence | Gap → closing WP (§4) |
|---|---|---|---|---|
| 001 | Template invariants: reserved regions, block compatibility, audience/locale, a11y contracts | L-part | `cms_define_template` and guards (migrations `20260927200000…250000`, `470000`, `20260930160000/161000`) | Template-level accessibility contract (publish a11y gate, IA03 Accessibility) and **impact set** unspecified; activation path (DEC-113) → WP0, WP4-M4, WP6a |
| 002 | Reject cyclic or over-limit trees; immutable pattern versions | L-part | Tree bound validator `20260927300000:14-48`; instance guards `20260927500000`; owner FKs `20260927340000` | Pattern graph semantics (nodes ≤512, pattern refs, cycle), pattern create/activate → WP0 §2.5, WP4-M5 |
| 003 | Taxonomy stable keys, acyclic, survivor merge, convergent assignments, redirects | L-part | Stable key `20260927460000`; cycle/merged/successor guards `…380000–410000`; link integrity `…350000`; field-owner FK `…480000` | No curator RPC, no convergence, no canonical source → WP4-M6 |
| 004–009 | CMS-03C-01 6-pack | L-done (S09-prereq) | Route `cms-composition/template-version-routes.ts`; RPC `cms_define_template`; proxy `pages/api/v1/cms/templates/versions.ts`; OpenAPI `tests/contracts/phase-02-slice-12-template-openapi.test.ts`; idempotency business hash `20260930150000`; e2e `template-real-route.spec.ts`, `template-uncertain-real-route.spec.ts` | Closure waits for S09 acceptance. Needs: designer grant producer (CMS-03A-15, DEC-119); hosted route re-check (S09 breakdown §1.2); reserved-key refusal (finding 5); owner-scoped key uniqueness (finding 4) |
| 010–015 | CMS-03C-02 6-pack | L-part | Route/adapter/proxy/contract (S12 continuation 2026-09-28 15:00); `cms-composition-production-pattern.ts:183,219` maps the missing RPC to 503 | Pattern source (D9), `cms_insert_pattern_instance` RPC, targetKind, linked diff → WP4-M5, WP5b, WP6b |
| 016–021 | CMS-03C-03 6-pack | L-part | Route plus registry/OpenAPI (2026-09-30); production `actTerm` 503 (`cms-composition-production-taxonomy.ts:55`); **no web proxy** (no `pages/api/v1/cms/taxonomies/**`) | Canonical projection plus `cms_act_taxonomy_term` plus convergence (D10) → WP4-M6, WP5c, WP6c |
| 022–025 | CMS-03C-01 validation rows | L-done (S09-prereq) | Contract tests; `cms_template_manifest_valid`; UUID identity `20260927470000` | Citation drift (line 148); missing `allowedBlocks/digest` row AC (finding 9) → WP1 |
| 026–029 | CMS-03C-02 rows | L-part | Zod contract (`packages/contracts/src/cms-composition/pattern-instance.ts`), SQL bounds | RPC-level admission (pattern immutable/readable, graph) → WP4-M5 |
| 030–032 | CMS-03C-03 rows | L-part | Zod plus SQL constraints | RPC admission → WP4-M6 |
| 033–035 | CMS-03C-04 rows | L-done (transport and RPC) | `cms_author_locale_variant` (`20260927440000`), source-hash conflict (`…510000`), calendar values (`…580000`), route/adapter/proxy, real-route e2e `locale-real-route.spec.ts` | Now in scope (DEC-114). Remaining: per-locale event key, cap 32, per-field staleness, carry-forward (§2.7) → WP4-M7. **AC034 rewording:** if OD-4 is A, its "ordered BCP 47 list ≤16" clause becomes the equality check against the 03a chain. The AC is unchecked, so this is a plan edit, not a D4 reopen. |
| 036–038 | CMS-03C-05 rows | L-part | Zod contract, route, proxy; port 503 | Eligibility authority (D11); `expectedVersion` nullable for first curation (§2.8) → WP4-M8. **AC038 rewording** (unchecked): "positive decimal strong If-Match match" becomes "null with no If-Match for first curation, else positive decimal strong If-Match equal to the set version". |
| 039 | All headers/body | L-part | Five routes admit; taxonomy proxy missing | WP6c |
| 040 | CMS-11 composite | L-part | Create page `templates/new.astro`, edit page `templates/[templateKey].astro`, latest read (D7) | Impact set; DEC-113 activation is now part of the governed lifecycle (new ACs) → WP0, WP6a |
| 041 | CMS-11 failure/recovery | L-part | Two-tab 409/rebase e2e (`SCAN:template-latest-read:27-34`) | Revocation/cascade/activation-race recovery → WP4-M4 |
| 042 | CMS-11 FE | L-part | `components/cms-composition/CmsTemplateDesigner*.tsx`, `CmsTemplateEditDesigner.tsx` | Review/activation UI → WP6a |
| 043–045 | CMS-12 composite | None | — | WP4-M5, WP5b, WP6b |
| 046–048 | CMS-14 composite | None | — | WP4-M6, WP5c, WP6c |
| 049 | TDD evidence | Ongoing | Tracker RED/GREEN record | — |
| 050 | Tracking, ledger, runbooks, graph; no unresolved boundary | Open | Three fail-closed 503 ports remain | All 503 ports replaced (WP5b/c/e); ledger rows 25.05.03/04 assigned (WP1) |

### 1.2 DEC-108 accounting answer (AC004–009, AC022–025)

| What | Where it is implemented | Where it is counted | Closure rule |
|---|---|---|---|
| CMS-03C-01 draft create, plus AC039's 03C-01 column | S09 critical path (`HO:78-85`) | S12 (unchanged IDs; `S09L:112`) | Check in S12 only after S09's integrated create → compatible template → successor path (P2-S09-AC-751) passes. Cite the S09 evidence; do not duplicate evidence |
| `cms_resolve_template_compatibility` | S09 (`20261002132000`) | S09 (P2-S09-AC-669…681, resolver items `BE03c:172-249`) | Not an S12 criterion |
| Template **activation** (DEC-113) | S12 | S12 (new ACs) | `BE03c:245-249` "separate Slice 12 gap" is closed by §2.3 |

The S09 ledger already records this in `S09L:112`. No S09 edit is needed. The S12 ledger must cite it and must not count the resolver or AC751.

---

## 2. Spec cascade text plan

### 2.0 Order and ownership

All locked-spec edits are root-serialized. Rules:

- Edits land **after** the uncommitted S09 DEC-119/DEC-120 touch-ups to IA03, DD03, BE03a and FE03 are committed. BE03b and BE04a were committed in `295b0850`. BE03c is clean.
- BE03a and IA03 edits made by S12 (the §2.2 subsection, the capability lists, and the OD-4 locale policy) are S09 *source* files. Landing them after the S09 ledger freeze restarts the S09 freeze rule (`S09L` "re-read … after source mtimes settle and re-freeze", P2-S09-AC-1197). Sequence them in one window with the S09 cascade owner, or land them before S09's re-freeze.
- Every section gets a changelog row `| 2026-10-0X | DEC-113/DEC-114/DEC-120/D7/D9–D12 … | /propagate-decision | … |`.
- Mark the five scans "applied" with a pointer to the decision:
  - `SCAN:template-latest-read`
  - `SCAN:template-activation`
  - `SCAN:pattern-source`
  - `SCAN:taxonomy-source`
  - `SCAN:related-content-source`
- Write one propagation record: `.memory/wiki/specs/audits/propagation-2026-10-0X-s12-dec113-dec114.md`.
- Sections marked **[OD-n]** wait for the owner decision in §5. Everything else is source-derived or an agent implementation decision. Agent decisions are stated, and the owner may override them.

New operation IDs, all `/api/v1` and Tier 2:

| ID | Method and path | Purpose | Capability | Rate (user/party per min) |
|---|---|---|---|---|
| `cmsTemplateLatestRead` (D7, built) | GET `/cms/templates/{templateKey}` | Latest editable template detail | `cms.template_designer` | 60/60 (as built) |
| CMS-03C-06 | POST `/cms/definition-reviews` | Submit template/pattern/taxonomy draft for review | Subject's designer or curator | 30/60 |
| CMS-03C-07 | POST `/cms/definition-reviews/{reviewId}/decisions` | Independent decision, step-up | `cms.definition_review` assignment | 30/60 |
| CMS-03C-08 | GET `/cms/definition-reviews/{reviewId}` | Safe review projection | Submitter scope or assigned reviewer | 120/240 |
| CMS-03C-09 | POST `/cms/definition-reviews/{reviewId}/assignments` | Create or revoke a bounded assignment, step-up | Owner with `cms.definition_review.assign` | 10/20 |
| CMS-03C-10 | POST `/cms/definition-activations` | activate / schedule / cancel_schedule / retire / reopen, step-up | Template/pattern: `cms.template_designer`; taxonomy: `cms.taxonomy_curator` | 10/20 |
| CMS-03C-11 | GET `/cms/templates` | Template selector page | `cms.template_designer` | 60/120 |
| CMS-03C-12 | POST `/cms/patterns/versions` | Pattern draft create | `cms.template_designer` | 30/60 |
| CMS-03C-13 | GET `/cms/patterns` | Pattern selector page (active for authors; plus own drafts for designers) | author/editor/designer | 60/120 |
| CMS-03C-14 | GET `/cms/patterns/versions/{patternVersionId}` | Pattern detail and tree | author/editor/designer | 120/240 |
| CMS-03C-15 | GET `/cms/compositions/instances/{instanceId}/linked-update` | Three-way diff | Assigned author/editor | 120/240 |
| CMS-03C-16 | POST `/cms/compositions/instances/{instanceId}/linked-update` | accept / detach | Assigned author/editor | 120/240 |
| CMS-03C-17 | POST `/cms/patterns/versions/{patternVersionId}/linked-updates` | Eligible bulk accept | Assigned author/editor | 30/60 |
| CMS-03C-18 | POST `/cms/taxonomies/versions` | Taxonomy version draft (new vocabulary or successor) | `cms.taxonomy_curator` | 30/60 |
| CMS-03C-19 | GET `/cms/taxonomies` | Vocabulary selector page | curator; author/editor (active only) | 60/120 |
| CMS-03C-20 | GET `/cms/taxonomies/{taxonomyId}` | Vocabulary detail plus term page | curator; author/editor (active only) | 120/240 |
| CMS-03C-21 | GET `/cms/entries/{entryId}/locales` | Locale overview | Assigned author/editor | 120/240 |
| CMS-03C-22 | GET `/cms/entries/{entryId}/locales/{locale}` | Variant detail, per-field state, fallback resolution preview | Assigned author/editor | 120/240 |
| CMS-03C-23 | POST `/cms/entries/{entryId}/locales/{locale}/revalidations` | Re-bind unchanged translations to the current source | Assigned author/editor | 60/120 |
| CMS-03C-24 | GET `/cms/entries/{entryId}/related-content` | Rule set, candidates, eligibility | Assigned author/editor | 120/240 |
| CMS-03C-25 | GET `/cms/entries/{entryId}/related-content/targets` | Eligible target picker | Assigned author/editor | 60/120 |

Every mutation uses:

- BE00 middleware order (`BE03c:113`)
- `Idempotency-Key` 8–128
- strong `If-Match`, except first-create operations
- CSRF and the `cms-console` CORS class
- `no-store`
- the 15,000 ms route deadline
- audit/outbox committed atomically with the mutation

Every read sets no Idempotency-Key, no If-Match and no body, and is `no-store`.

### 2.1 D7: latest-template read (approved as implemented)

- **BE03c Route Registry (`:138-147`).** Add the row `cmsTemplateLatestRead | CMS-11 | GET /api/v1/cms/templates/{templateKey} | path → 200 TemplateVersionDetail`. Its policy:
  - Auth: authenticated human, confirmed acting-party membership, active `cms.template_designer` grant. Absent or cross-owner key → 404; no grant → 403.
  - BE00 order; `cms-console` origin; no CSRF or body; server-derived context.
  - Read-only.
  - 60/min/user, 60/min/party; 15,000 ms; no-store with a strong ETag equal to the latest version; Tier 2.
  - Errors: 400/401/403/404/429/502/503/504/500 under catalog `cms.03c.template.v1`.
- **BE03c Registry invariants (`:149-170`).** Add a paragraph: "`cmsTemplateLatestRead` returns the owner's highest-version TemplateVersion for the key as `TemplateVersionDetail` (the TemplateVersionResource fields plus `slots`, `bindings`, `locale`, `audience` and `impact` §2.4). It calls only `platform_api.cms_template_latest` and never grants write authority; the successor POST rechecks everything."
- **Reserved keys (finding 5).** Add to `BE03c:299` (the templateKey row) and to the matching pattern/taxonomy key rows: "key ∉ {`context`, `versions`, `reviews`, `activations`} (path-segment reservation); 422 `TEMPLATE_VALIDATION_FAILED` with pointer `/templateKey` and reason `reserved_key`". Agent decision: keep the implemented path rather than move it to `/by-key/`. Migration preflight refuses any existing row with a reserved key.
- **FE03 `:734-746`.** Replace "Editing an existing version still requires a protected canonical read … does not claim that coverage". New text: `/app/cms-content-modeling/templates/:templateKey` loads `cmsTemplateLatestRead`, offers a successor form with strong `If-Match`, and on 409 shows the latest version and offers rebase while retaining unsent values. Add this route to the FE03 Page and Route table (`:687-695`) and to the query registry (`:974-1003`).

### 2.2 Generalized CMS review machinery (DEC-108 → DEC-113/DEC-115)

**BE03a: new subsection "Generalized CMS review machinery" after the Workflow policy registry (`:1738-1762`).** This is the shared definition that BE04a already cites. Normative text:

1. A *review family* is one private triple: `<family>_reviews`, `<family>_review_decisions` and `<family>_review_assignments`.
2. Each table has the same column set, CHECKs, envelope, ENABLE/FORCE RLS, revoked direct grants and named-RPC-only writes as `cms_schema_reviews`, `cms_schema_review_decisions` and `cms_schema_review_assignments` (`:1711-1713`), with one substitution: the content-type candidate columns become `subject_kind`, `subject_id`, `subject_version` and `frozen_hash`.
3. Every family shares these rules:
   - **submitter distinctness:** a BEFORE INSERT trigger plus the decision RPC enforce it.
   - **reviewer count:** at most one decision per human, `UNIQUE(review_id, reviewer_person_ref)`.
   - **owner derivation:** from the receipt identity, as in CMS-03A-14.
   - **assignment bounds:** read/decide only; ≤7 days (DEC-120 explicitly keeps the DEC-108 assignment bound, distinct from the 90-day standing grants); no later than the grantor's authority end (`cms_review_owner_authority_end`); effective only while `starts_at<=now<ends_at`.
   - **MFA:** recent binding-bound MFA at decision and assignment (DEC-111, 401 `STEP_UP_REQUIRED`).
   - **evaluation:** slot evaluation and approval-evidence hashing as in `:1757-1761`. Specialist slots are satisfied by a *standing* grant checked through `cms_person_holds_capability`, which is term-aware (DEC-120, ≤90 days).
   - **drift:** drift invalidates the review.
   - **activation recheck:** activation rechecks the approving reviewers' current assignment and capability, and the activator's own MFA. Decision age is not checked.
4. The registered families are:

   | Family | Subject kinds | Owner |
   |---|---|---|
   | `cms_schema` | — | BE03a |
   | `cms_definition` | `template_version`, `pattern_version`, `taxonomy_version` [OD-1] | BE03c |
   | `cms_delivery` | `menu_version`, `route_record`, `discovery_metadata_version` | BE04a |

5. Each family has one assignment-only capability and one owner-only `.assign` capability. Neither is grantable through CMS-03A-15.
6. Implementation note (extensibility rule: no copy-paste). The policy evaluation, approval-evidence hash and distinctness trigger functions are generic `platform_private.cms_review_*` helpers, parameterized by family and reused by S09, S12 and S13. S09 has shipped the helpers below, and S12 must reuse them:

   | S09 helper (`20261002125000`, `…130000`) | Status for S12 |
   |---|---|
   | `cms_reserve_conflict`, `cms_person_holds_capability`, `cms_review_context_hash`, `cms_review_binding`, `cms_review_owner_authority_end`, `cms_review_is_owner`, `cms_review_person_eligible`, `cms_review_assignment_effective`, `cms_with_content_hash` | Family-neutral. Reuse as-is. |
   | `cms_resolve_review_policy(p_version_id)` | Schema-coupled: reads `cms_content_type_versions`. S12 adds `cms_review_policy_strictest(p_members jsonb)`, which takes the N-member strictest-of. S09's function should then delegate to it; that delegation is S09-owned refactor follow-up, guarded by S09 pgTAP. |
   | `cms_schema_review_approval_digest`, `cms_review_qualifying_approvers`, `cms_review_unsatisfied_slots`, `cms_review_scope` | Schema-coupled: read `cms_schema_review*` tables. S12 adds family-generic cores that take a `regclass` family or a decision-row set (for example `cms_review_unsatisfied_slots_core(p_owner, p_required_capabilities, p_approvers uuid[])`). The schema wrappers keep their names. |

   Agent decision: S12 does not `create or replace` an S09 function while S09 is unaccepted. The delegation migration lands after amended S09 acceptance, and S09's tests are its regression guard.

**BE03a edits:**

- Add `cms.definition_review` (assignment-only) and `cms.definition_review.assign` (owner-only) to every non-grantable list:
  - the CMS-03A-15 field row (`:239`), next to `cms.schema_review` and `cms.delivery_review`;
  - the `GrantableCmsCapability` comment (`:572-577`);
  - the grantable-registry consistency rule (`:1834`);
  - the doc comment in `packages/contracts/src/content-schema-registry/models-grants.ts:3-9` (code, WP2).
- `cms.template_designer` and `cms.taxonomy_curator` are already grantable (`models-grants.ts:13-14`; IA03 `:197-205`).

**BE03c, new section "Definition reviews (DEC-113)" after the resolver (`:172-249`).** Replace `:245-249` ("Public template activation remains an explicit, unresolved 03c contract gap…") with: "Public template activation is CMS-03C-10 under the DEC-113 review machinery below; a draft binding is never proof of activation, and AC169 still requires only an immutable compatible template version."

Tables are added to the Database Schema (`:644-676`), and "exactly nine" becomes "exactly thirteen". The four added tables are the three below plus `cms_related_content_sets` (§2.8).

| Table | Definition |
|---|---|
| `cms_definition_reviews` | As BE04a `cms_delivery_reviews` (`BE04a:475`) with `subject_kind IN ('template_version','pattern_version','taxonomy_version')` and `risk_class IN ('ordinary','protected')`. Additional columns: `policy_members jsonb` (1..64 sorted `{key,version,hash}`), `policy_members_hash char(64)`, `required_capabilities` (ordered union, ≤16), and `required_decision_count 1..8`. `UNIQUE(subject_kind, subject_id, subject_version) WHERE state='open'`. |
| `cms_definition_review_decisions` | As `cms_schema_review_decisions`, with `capability_key = 'cms.definition_review'` and a `reviewed_hash`. |
| `cms_definition_review_assignments` | As `cms_schema_review_assignments`, with `capability_key = 'cms.definition_review'`. |

**Frozen evidence (`frozen_hash` = JCS SHA-256 of):**

| Subject | Frozen evidence |
|---|---|
| template_version | `{templateVersionId, version, contentHash, blockRegistryDigest (recomputed), compatibleTypeIds, reservedRegions, policyMembersHash}` |
| pattern_version | `{patternVersionId, version, contentHash, blockRegistryDigest (recomputed), expandedNodeCount, patternRefs[], compatibleTypeIds [OD-2], policyMembersHash}` |
| taxonomy_version | `{taxonomyVersionId, version, contentHash, shape, allowlists, canonicalDomain, canonicalOverlapEvidenceHash, policyMembersHash}` |

**Policy derivation (DEC-113 count rule):**

- **Template:** strictest-of across the workflow members bound to the *active* version of each content type in `compatibleTypeIds`. "Strictest-of" generalizes BE03a's downgrade guard (`:1761`) to N members: risk is `protected` if any member is protected; count is the maximum count; capabilities are the base slot `cms.definition_review` followed by the specialist slots of the members, ordered by member `key` UTF-8 then version, without duplicates, at most 16. A compatible type without an active version, or with an unresolvable or hash-mismatched member → 503 `DEPENDENCY_UNAVAILABLE`; no review is created.
- **Pattern:** [OD-2].
- **Taxonomy:** [OD-1]. Recommended: strictest-of across the active versions of `allowlisted_type_keys`.
- **Drift at decision and activation:** recompute the members. A stricter recomputation or any member-hash change invalidates the review (`409 … details.reason evidence_drift`).

**Contracts.** Mirror BE03a `:549-571` and `:984-1160` in camelCase:

- `DefinitionReviewSubmissionRequest {subjectKind, subjectId, expectedSubjectVersion}`
- `DefinitionReviewDecisionRequest {expectedVersion, decision}`
- `DefinitionReviewAssignmentRequest`, a discriminated union identical to CMS-03A-14
- `DefinitionReviewResource`: `SchemaReviewResource` minus content-type fields, plus `subjectKind`, `subjectId`, `subjectVersion`, `frozenHash` and `permittedNextActions ⊆ {assign_reviewer, record_decision, activate, schedule, resubmit}` (≤5)
- Decision and assignment resources with the literal `resourceKind` values `definition_review_decision` and `definition_review_assignment`

**Error catalog.** Add catalog `cms.03c.definition-review.v1`:

| Status | Code |
|---|---|
| 400 | INVALID_REQUEST |
| 401 | UNAUTHENTICATED or STEP_UP_REQUIRED (decide/assign) |
| 403 | DEFINITION_REVIEW_FORBIDDEN |
| 404 | DEFINITION_REVIEW_NOT_FOUND |
| 409 | DEFINITION_REVIEW_CONFLICT, with `details.reason ∈ {live_review_exists, subject_not_draft, evidence_drift, self_review, repeated_reviewer, slot_unsatisfiable, stale_version, idempotency}` |
| 415 | UNSUPPORTED_MEDIA_TYPE |
| 422 | DEFINITION_REVIEW_VALIDATION_FAILED |
| 429 | RATE_LIMITED |
| 502/503/504 | Dependency codes |
| 500 | INTERNAL_ERROR |

**Authz matrix rows (`:682-690`).**

| Op | Allowed | 403 | 404 |
|---|---|---|---|
| 06 | Designer/curator in the subject's owner scope | Visible subject, missing capability | Hidden subject |
| 07 | Assigned human, not the submitter, with MFA | Readable review, no assignment | Concealed |
| 08 | Submitter scope or assigned review-only scope | — | — |
| 09 | Receipt-derived owner | — | Cross-owner review |

**IA03.**

- Add "Definition Review and Activation (DEC-113)" after the Workflow Policy Registry and Owner CMS Capability Grants subsection (`IA03:162-219`), before Editorial Lifecycle (`:220`), with the rules above in IA prose.
- Edit the Access Control table `:364-365`: Template designer adds "submit for review, activate an approved version with recent MFA"; taxonomy curator adds the same, subject to [OD-1].
- Add a role row "Definition reviewer — assignment-only; read/decide one frozen definition review".

**DD03.** Add a `definition_review` model row next to `editorial_review` (`DD03:213`) and a state row `Definition review open → approved|rejected|invalidated`.

### 2.3 CMS-03C-10 definition activation (DEC-113 switch, scheduled, retire, reopen)

The scheduled, retired and blocked states are reachable by IA's design: IA state machine `DD03:236` "draft → review → approved → scheduled|active → superseded|retired; blocked may return draft", and ideation 25.05.01 States. They must be built rather than left as enum padding.

Reachability note: the same state machine also governs ContentTypeVersion (`BE03a:1765, 1885`). S09 built no schedule action for content types, so `scheduled` is unreachable there today. S12 builds definition scheduling on the more-work-now default. The S09 asymmetry is recorded in §6, not changed here.

**Request:** `DefinitionActivationRequest`, a discriminated union on `action`:

| action | Fields | Transition |
|---|---|---|
| `activate` | `{subjectKind, subjectId, expectedSubjectVersion, reviewId}` | `approved → active` |
| `schedule` | `{…, reviewId, localDateTime, timezone, resolvedUtc, tzdbVersion, disambiguation}` | `approved → scheduled`. Field shapes are identical to CMS-03B-07 (`BE03b:456-469`). `resolvedUtc` must be ≥ now+60 s and ≤ now+30 days (agent bound). It must also be before the scheduler's own standing-grant end (DEC-120; 422 reason `schedule_after_authority_end`). The OD-6 horizon applies on top. |
| `cancel_schedule` | `{subjectKind, subjectId, expectedSubjectVersion}` | `scheduled → approved` |
| `retire` | `{…}` | `active → retired`. Retired is not selectable for new bindings or insertions; existing pinned references keep resolving. |
| `reopen` | `{…}` | `blocked → draft` |

**Response:** `200 DefinitionActivationResource {subjectKind, subjectId, state, version, activatedAt|scheduledFor|null, supersededVersionId|null}`.

**Transaction for `activate` (and the scheduled job):**

1. Lock the subject's series row.
2. CAS on `expectedSubjectVersion`.
3. Require the review to be `approved` for exactly this subject version.
4. Recompute `frozen_hash`, which re-runs the 03a safe registry, the digest and the policy members. On drift → subject `blocked`, review `invalidated`, response `422 … reason evidence_drift`, and no event.
5. Recheck the approving reviewers' current assignment and capability, as S09 G10 does (`cms_review_qualifying_approvers` semantics).
6. Recheck the activator's capability and recent MFA. This is not checked for the job. At fire time the job instead runs:
   - the scheduler's standing grant, still current (DEC-120 "schedule authority recheck"; a lapse → schedule `blocked`, reason `scheduler_authority_lapsed`, no event);
   - the frozen-evidence recompute (step 4);
   - the reviewer-authority recheck that **[OD-6]** defines.
7. Atomically move the prior `active` version of the same series to `superseded`, move this version to `active`, write audit and write the outbox.

**Events.** BE03c Event schemas `:752-758`, using the stable series IDs from §2.4:

- template: `cms.template.activated.v1 {templateId: series UUID, templateVersionId}`
- pattern: new `cms.pattern.activated.v1 {patternSeriesId, patternVersionId}`
- taxonomy: `cms.taxonomy.changed.v1 {taxonomyId: series, taxonomyVersionId}`

Each event uses aggregate type `cms_template_series`, `cms_pattern_series` or `cms_taxonomy_series`, with aggregateVersion equal to the series activation counter. Rules: same-key replay returns the identical response; concurrent activation of two versions of one series gives one winner and a 409 for the other; a refusal emits no event.

**Scheduled execution.** A BE00 job `cms.definition.activate` with a lease, at most 3 retries at 15 s/60 s/300 s, then DLQ. It reuses the BE00 job executor.

**Errors.** Catalog `cms.03c.definition-activation.v1`: 401 STEP_UP_REQUIRED; 403; 404; 409 `DEFINITION_ACTIVATION_CONFLICT`; 422 `DEFINITION_ACTIVATION_BLOCKED`; 429; 502–504; 500.

**Metrics.** `cms_template_activation_age` already exists (`BE03c:790`). Add `cms_definition_activation_total{subjectKind,outcome}` and `cms_definition_scheduled_lag_seconds`.

### 2.4 Templates: series identity, uniqueness, impact set, selector

- **Series identity.** Add `series_id uuid NOT NULL` to the TemplateVersion, PatternVersion and TaxonomyVersion tables (`BE03c:653-656`). Version 1 generates it; a successor copies it from `supersedes_id` or from the latest version of the same owner and key.
- **Uniqueness.** Replace `UNIQUE(template_key, version)` with `UNIQUE(owner_id, template_key, version)` and `UNIQUE(series_id, version)`. Apply the same change to patterns and taxonomies. A forward migration: preflight refuses duplicates and backfills `series_id` deterministically, using the min-version row ID per `(owner, key)`. Agent decision; this closes finding 4.
- **Impact set** (IA03 AC-CMS-11 "exact impact set"; Access "preview impact" `:364`). Add `TemplateImpact = {compatibleTypeIds, bindingContentTypeVersionIds (≤64), draftEntryCount, activePublicationCount}` to `TemplateVersionDetail` and to the CMS-03C-01 201 response as `impact`.
  - `bindingContentTypeVersionIds` are the active content-type versions whose 03a template bindings or `defaultTemplateVersionId` reference any version of this series, resolved through the 03a safe projection.
  - Counts are owner-scoped integers, capped at 100000. The impact set is informational: it is not frozen evidence and its drift never invalidates a review.
- **CMS-03C-11 template selector:**
  - Query `{state?: draft|review|approved|scheduled|active|retired|blocked, cursor?: opaque ≤512, limit 1..50 default 25}`.
  - Page of `{templateId (series), templateKey, latestVersion, latestState, activeVersion|null, updatedAt}`.
  - Sort `updatedAt desc, id`; the cursor binds query and acting scope.

### 2.5 Patterns (D9)

**CMS-03C-12 `PatternVersionRequest`.** Strict object:

| Field | Constraint |
|---|---|
| `patternKey` | TemplateKey regex plus reserved list |
| `blockTree` | `PatternBlockTree` (below) |
| `compatibleTypeIds` | 1..64 UUIDs **[OD-2 option A]** |
| `blockRegistryDigest` | Hash, optional; an equality expectation only |
| `expectedVersion` | `Version.nullable()`; null means a new series, as `TemplateVersionRequest` does |

Response `201 PatternVersionResource`: the existing resource (`BE03c:590-595`) plus `patternSeriesId` and `compatibleTypeIds`.

**PatternBlockTree.** Define it in BE03c Contracts; it is currently only "acyclic block_tree JSONB object".

- Shape: `{ nodes: Node[1..64] }`, where `Node` is one of:
  - `{kind:'block', blockKey, blockVersion, props: BoundedPatternOverrides-shaped object, slots?: Record<SlotKey, Node[≤64]>}`
  - `{kind:'pattern', patternVersionId: UUID}`
- Expanded bounds: ≤512 nodes and depth ≤8. This matches the existing validator (`20260927300000:14-48`: 256 KiB, depth 8, 128 keys/items) and BE03c's test target of 512 nodes (`:820`).
- A `pattern` node must reference an **active** version of a *different* series. Any transitive reference back to the same series is `409 COMPOSITION_VERSION_CONFLICT reason pattern_cycle` (IA03 "recursive or cyclic pattern graph … rejected").
- The digest covers the expanded reachable block tuples.

**CMS-03C-13 selector:**

- Query `{state?: active|draft (drafts only for designers), compatibleTypeId?: UUID, cursor, limit 1..50}`.
- Items `{patternSeriesId, patternVersionId, patternKey, version, state, compatibleTypeIds, blockRegistryDigest}`.
- Authors and editors see only `active` items that are compatible with an entry they can edit.

**CMS-03C-14 detail.** `PatternVersionDetail` = resource + `blockTree` + `expandedNodeCount` + `linkedInstanceCount` (impact).

**CMS-03C-02 changes.**

- Add `targetKind: 'entry_revision' | 'template_draft'`. `revisionId` is renamed `targetId` only if contract churn is acceptable; agent default: keep `revisionId` and add `targetKind`. This honours IA03 "entry revision or template draft".
- Add `cms_composition_instances.template_version_id uuid NULL`, with the XOR `CHECK ((revision_id IS NULL) <> (template_version_id IS NULL))`. Instances may be added to a template only while it is `draft`. The submit freeze in §2.2 includes the template's instance set hash.
- Admission requires that the target's content type, or for a template its `compatibleTypeIds`, is ⊆ the pattern's `compatibleTypeIds` [OD-2 A] → 422 reason `pattern_incompatible`.

**Linked updates.**

- **Trigger.** On `cms.pattern.activated.v1` for series P at version N, a 03c consumer marks each *linked* instance of an earlier version of P in a **draft** entry revision or draft template:
  - Instance has no override collision → appends a `pending_diff` row with `conflictState: 'none'`; it is eligible for bulk accept.
  - Instance has a collision → appends a `pending_diff` row with `conflictState: 'pending_diff'`.

  Collision definition: any override key whose path changed between the base and the new pattern trees. Instances in non-draft revisions are never touched; they are frozen evidence.

  Bound: at most 500 instances per event per transaction batch. The cursor is continued by a BE00 job with idempotency keyed by `(instanceId, targetPatternVersionId)`.
- **CMS-03C-15 read.** Returns `LinkedUpdateDiff {instanceId, baseVersion, targetVersion, base/theirs/yours entries[≤256] {path, base, theirs, yours, collision:boolean}, truncated:false|refuse}`. More than 256 changed paths → 422 reason `diff_too_large`; the only recovery is detach (mirrors D5's 512 refusal style).
- **CMS-03C-16 `LinkedUpdateResolutionRequest`.** Union of:
  - `{action:'accept', targetPatternVersionId, resolutions: [{path, choice:'theirs'|'yours'}] (required for every collision path), expectedVersion}`
  - `{action:'detach', expectedVersion}`

  Response: `201 CompositionInstanceResource` (new instance version). A detached instance copies the expanded tree as local blocks with `patternId: null`. "An unanswered update leaves the instance on its current version" (IA03 `:44`): a pending row never changes the effective instance until accept.
- **CMS-03C-17 bulk.** Request `{instanceIds: UUID[1..100], expectedVersions: Record<UUID, Version>}`. Only `conflictState:'none'` instances are accepted. Response is `200 {accepted: id[], skipped: [{id, reason: 'collision'|'stale'|'not_found'}]}`. Skipped entries do not distinguish hidden from absent; hidden instances are reported as `not_found`.

**03b/03c copy-forward rule** (BE03c Cross-shard `:767` and BE03b revision save). When 03b creates a new draft revision from a non-draft parent, it copies the parent's latest instance versions into the new revision. Linked instances stay at their pinned version, and pending updates re-evaluate. This is an S10 seam (§2.9).

### 2.6 Taxonomy (D10)

- **Series ID.** `taxonomyId` = `series_id` (§2.4). The CMS-03C-03 path `{taxonomyId}` addresses the vocabulary series.
- **Terms.** Terms gain `taxonomy_id uuid NOT NULL` (the series) next to `taxonomy_version_id` (the creating version). The stable-key uniqueness becomes `(taxonomy_id, term_key)` for the durable term. This replaces `(taxonomy_version_id, term_key)` from `20260927460000`; the migration preflight refuses duplicates.
- **Term action targets.** Term actions apply to the series' current active version rules: `shape: flat` refuses `parentId`. The series may also have only a draft version (pre-activation seeding). Terms are assignable only while the series has an `active` version.
- **CMS-03C-18 `TaxonomyVersionRequest`.** Strict object:

  | Field | Constraint |
  |---|---|
  | `taxonomyKey` | Key regex plus reserved list |
  | `shape` | `flat` or `hierarchical` |
  | `allowlistedTypeKeys` | 1..64 content-type keys, each with an active version in owner scope |
  | `allowlistedFieldKeys` | 1..64; each must be a `taxonomy`-kind field of an allowlisted type (BE03a field kinds `:202`) |
  | `canonicalDomain` | `'none' \| 'role' \| 'organization_type' \| 'instrument' \| 'gear' \| 'place' \| 'rights' \| 'jurisdiction'` |
  | `ownerCapability` | literal `cms.taxonomy_curator` |
  | `labels` | 1..64 `{locale, label}`, NFC |
  | `expectedVersion` | `Version.nullable()` |

  Response: `201 TaxonomyVersionResource {taxonomyId, taxonomyVersionId, version, state, taxonomyKey, shape, canonicalDomain, contentHash}`. Add the missing `TaxonomyVersionResource` to BE03c. `TaxonomyVersionState` already exists in the table (`BE03c:656`) but has no browser resource.
- **CMS-03C-19 and CMS-03C-20.**
  - Selector page: `{state?, canonicalDomain?, cursor, limit ≤50}`.
  - Detail: series, versions (≤64), and a term page `{termCursor, termLimit ≤50, lifecycle?}` of `TaxonomyTermResource` plus labels and aliases. Merged terms are included with `successorId` as redirect.
  - Authors and editors see only active vocabularies allowlisted for a field they can edit.

**Canonical taxonomy projection contract** (BE03c Cross-shard `:762-770`, new subsection):

- `platform_private.cms_canonical_taxonomy_overlap(p_owner_id uuid, p_domain text, p_candidates jsonb)` is service-only and read-only.
  - `p_candidates` holds ≤ 64 terms × (key + labels ≤64 + aliases ≤64).
  - Returns `{domain, providerVersion, available: boolean, matches: [{candidatePointer, canonicalId, canonicalKey}]}`.
- **Normalization.** NFC, then Unicode case fold, then whitespace collapse, then hyphen/underscore unification. A match is exact equality against the provider's canonical key or any canonical label or alias.
- **Providers.** A code-owned registry of domain → provider function. Phase 2 has two providers:
  - `role`: provider `identity_private.cms_canonical_role_facets()`, reading the S03 facet codes `performer, writer, producer, engineer, teacher, seller, tech` (`packages/contracts/src/identity-authority/primitives.ts:14-22`, DB check `20260901030000:77`) and their public labels.
  - `organization_type`: provider `identity_private.cms_canonical_organization_types()`, reading `identity_private.organization_type_registry` (`20260901040000:286-297, 459-465`; `display_policy.publicLabel`), active rows only.

  These provider functions live in identity domain schemas. S12 authors them in its own migration; they are read-only and service-only.
- **Absent domains.** `instrument`, `gear`, `place`, `rights` and `jurisdiction` have no Phase 2 provider and return `available:false`.
- **Overlap check runs:**
  - at taxonomy-version create and activate, against the version's `canonicalDomain` **and** every available provider;
  - on the term actions `create`, `rename` and `alias`, against every available provider.
- **Refusals:**

  | Case | Response |
  |---|---|
  | Overlap | `422 TAXONOMY_VALIDATION_FAILED`, `details.violations[{pointer, reason:'canonical_overlap', canonicalDomain, canonicalKey, canonicalId}]`. This is the IA "pointer to the canonical ID"; canonical vocabularies are public, so no disclosure issue. |
  | `canonicalDomain` names an unavailable domain | `503 DEPENDENCY_UNAVAILABLE`, `details {dependencyClass:'canonical_taxonomy', domain, retryable:false}` at create and activate. This is the D10 typed "canonical source unavailable" refusal; a provider *runtime* outage uses the same code with `retryable:true` and BE03c's seam rules (`:730-737`). |

  Agent decision: reuse the existing exhaustive catalog codes rather than add new ones.

**Accountable curator** (ideation 25.05.01 D-03; IA "unassigned vocabulary is refused"). Activation preflight requires at least one human with a current effective grant of the vocabulary's `ownerCapability`; otherwise 422 `DEFINITION_ACTIVATION_BLOCKED reason no_accountable_curator`.

**Assignment convergence (CMS-14 "converge exactly once").**

- `cms_act_taxonomy_term` with `merge` runs these steps in one transaction:
  1. Lock the survivor and retired term rows (by ID order).
  2. Append the retired term version `lifecycle:'merged', successor_id`.
  3. Append the survivor version, adding the retired key to its aliases.
  4. For every `active` TermAssignment of the retired term, append a `superseded` version and a new `active` assignment to the survivor, with provenance `system_rule` and the same position. Assignments that already point at the survivor become `superseded` without a duplicate.
- Bound: ≤5,000 assignments in-transaction; beyond that, `409 reason merge_too_large`. Agent bound, chosen to fit the 15 s deadline.
- Write audit and outbox `cms.taxonomy.changed.v1`.
- A replay by idempotency key returns the same result.
- **Assignment producer (S10 seam §2.9):** a taxonomy-kind field value in a revision save calls `platform_private.cms_validate_and_assign_terms(revision_id)` (S12-built). It accepts only active terms of an active, allowlisted vocabulary, and a merged term ID resolves to its survivor.

**Term impact** (IA "after overlap and impact checks"). The CMS-03C-03 200 response adds `impact {activeAssignmentCount}`.

### 2.7 CMS-15 localization: full contract (DEC-114, D12)

Replace the whole CMS-03C-04 treatment at BE03c `:146, 312-314, 448-459, 583-589, 660, 712, 744, 756` and the FE03 deferred rows. Normative text plan:

1. **Allowed target locales and the fallback-chain home [OD-4].**
   - Target locale ∈ the content-type version's supported locale set, minus `source_locale`. Mismatch → `422 LOCALE_VALIDATION_FAILED reason unsupported_locale`.
   - The path `{locale}` must equal `body.locale`, compared case-insensitively, and the path `{entryId}` must equal `body.entryId`. A mismatch → 400 `INVALID_REQUEST` before any existence check.
   - Under OD-4 A, both the supported set and the per-target-locale ordered chains live on the 03a ContentTypeVersion, because IA03:250 says "Each content-type version records …" and "explicit ordered per-type/field chain". The request's `fallbackChain` then becomes an *equality expectation* of the type's chain for that locale (422 reason `fallback_chain_mismatch`), and the response echoes the type chain.
   - Changes to supported locales or chains ship only as a schema successor through DEC-108 review. They are part of `definition_hash` and therefore frozen into activation evidence.
2. **Authorization.** An active `cms.author` or `cms.editor` `EntryAssignment` on the entry (`BE03b:931`) covers every supported locale. Phase 2 has no locale-scoped assignment, and none is specified anywhere. Agent decision: IA03 `:47` "may edit the entry in the requested target locale" is satisfied by entry assignment plus the supported-set check.
3. **Locale series and D12 key.**
   - Add `series_id uuid NOT NULL` to `cms_locale_variants`. It is the ID of the first variant for `(entry_id, lower(locale))`; later rows copy it. Add `UNIQUE(series_id, version)`.
   - `cms.localization.changed.v1` uses `aggregateType='cms_locale_series'`, `aggregateId=series_id` and `aggregateVersion=variant.version`. This is the D12 per-locale aggregate dedupe key, and the payload is unchanged.
   - Fix both emitters: `cms_author_locale_variant` and `cms_stale_locale_dependents`.
   - Add to BE03c Event schemas: "consumers deduplicate on (aggregateType, aggregateId, aggregateVersion) and never regress a lower series version".
4. **Cap (D12).** At most 32 distinct target-locale series per entry (source: `BE03b:371-373 localeSources.max(32)`).
   - CMS-03C-04 for a 33rd distinct locale → `409 LOCALE_VERSION_CONFLICT`, `details {reason:'entry_locale_limit', limit:32}`. The request is valid in isolation but conflicts with current state. Agent choice of 409 over 422.
   - Fan-out stays **synchronous** inside the entry-serialized revision transaction (existing trigger `20260927450000:123-125`), bounded by the cap: at most 31 appended rows plus audit and outbox per source revision, within the 15,000 ms deadline.
   - The migration preflight refuses any existing entry with more than 32 series and does not rewrite rows.
5. **Per-field source tracking.**
   - Each variant row stores `source_field_hashes jsonb` (fieldId → `cms_entry_field_values.value_hash` of the source revision when translated; ≤128) and `stale_field_ids jsonb` (≤128).
   - Source-stale fan-out compares per field. Only changed source fields become stale. "Unchanged fields keep their approved state": IA03 `:47`; DD03 "marks translated fields stale by source field/hash".
   - Variant row state is `stale` if any translated field is stale.
   - Define `sourceHash` (request field) = the source revision `payload_hash`. It is unchanged and is a revision-level CAS expectation only.
6. **Carry-forward.** A CMS-03C-04 write creates a target-locale EntryRevision whose values are the previous target revision's values overlaid with the request `fields`. Unsent fields keep their values and their per-field approval if their source hash is unchanged.
   - The revision is still written by 03c under the entry lock. Specify in BE03b `:943`/`:996` that 03c-authored target-locale revisions follow the same allocation `revision_number = max+1 per (entry, locale)`, with `parent_revision_ids = [previous target revision, source revision]`. This matches the implementation at `20260927440000:228-241`.
7. **State machine.** BE03c `:744`; IA03 `:47`; DD03 `:238`.

   | Transition | How it happens |
   |---|---|
   | (none) → `draft` | CMS-03C-04 |
   | `draft` → `review` | The target revision is submitted through 03b CMS-03B-05 |
   | `review` → `approved` | The 03b editorial review approves under the content type's DEC-109/110 policy |
   | `review` → `draft` | Rejection |
   | `approved` → `stale` | Source change of a translated field |
   | `stale` → `draft` | Revalidation (CMS-03C-23) or a new CMS-03C-04 write; review then proceeds as above |

   Notes:
   - Locale approval uses the 03b editorial review, so protected policies still require two humans and a specialist; there is no single-author re-approval path.
   - Amend BE03c `:744` from "explicit revalidation appends a new approved version" to "explicit revalidation appends a new draft version bound to the current source; independent editorial approval appends `approved`". This is a security-first consistency fix (DEC-110); the owner may override it.
   - The variant state follows the revision's review through the 03c function `platform_private.cms_locale_variant_follow_review(p_revision_id, p_review_state)`. 03b's submit, decide and invalidate RPCs call it in the same transaction (an S11 seam). It appends `review`, `approved` (with `approval_evidence {reviewId, approvalEvidenceHash}`) or `draft` versions.
   - `untranslated` is **read-model only**. CMS-03C-21 derives it for a supported locale with no series. A forward migration removes `untranslated` from the table CHECK; the read enum keeps it. This closes enum padding.
8. **CMS-03C-23 `LocaleRevalidationRequest`.**
   - Fields: `{sourceRevisionId: UUID, sourceHash: Hash, fieldIds: UUID[1..128] unique and each currently stale, expectedVersion: Version (entry CAS)}`.
   - Effect: appends a target revision that copies the current values and rebinds the listed fields' source hashes to the new source, plus a `draft` variant version.
   - Response: `201 LocaleVariantResource`.
   - Errors: the 03C-04 catalog. Revalidating a field that is not stale → 422 reason `field_not_stale`.
9. **Reads.**
   - **CMS-03C-21:** `LocaleOverview {entryId, sourceLocale, supportedLocales[≤32], series: [{locale, state (incl. derived untranslated), variantVersion, revisionId|null, staleFieldCount, noFallbackBlocked:boolean, updatedAt}]}` with ETag = entry version.
   - **CMS-03C-22:** `LocaleVariantDetail` = `LocaleVariantResource` + `fields: [{fieldId, localizationMode: 'localized'|'no_fallback', state: 'approved'|'draft'|'review'|'stale'|'missing', valueHash|null}]` (≤128) + `resolution` (item 10). Query `{revisionId?: UUID}` defaults to the latest.
10. **Fallback resolution.** The algorithm is normative in BE03c Data Flow. Sources: IA03 `:250`; DD03 `:398-399`, "resolves per field through explicit ordered locales, recording chosen source. `no_fallback` returns missing/block state … and never silently falls through to `default_locale`"; and `default_locale` "is only the governed fallback root". For a field f in target locale L:
    - L has an `approved` value for f that is not stale → `{source: L}`.
    - f is `stale` → **[OD-3]**.
    - f is `no_fallback`, and missing or stale → `{state:'blocked'}`. It never consults the chain or `default_locale`.
    - Otherwise, walk L's explicit chain in order (OD-4 home). The first locale with an approved, non-stale value → `{source: Li, revisionId, valueHash, via:'chain'}`.
    - Chain exhausted → resolve at the governed root `default_locale` → `{source: default_locale, via:'root'}`. This is recorded, not silent. `default_locale` defaults to `source_locale`, whose canonical revision always exists.
    - Root value absent → `{state:'missing'}`.

    **Correction of the first pass.** The first pass said "never `default_locale` implicitly" for every field. The sources limit that ban to `no_fallback` fields; for every other localized field, `default_locale` is the explicit root. Field-level behaviour comes from 03a `localizationMode` (`none` | `localized` | `no_fallback`). A per-field chain override has no further source detail and is **not** added, to avoid over-specifying.
11. **Publication interplay** (BE03b cascade; S11-owned seam).
    - S11's publish preflight category `locale` calls the 03c function `cms_locale_publication_readiness(p_entry_id, p_locale, p_revision_id, p_audience)`, which returns `{ready, blockers[{fieldId, reason: no_fallback_missing|no_fallback_stale|required_missing}], resolution[], resolutionHash}`.
    - Not ready → the 03b publish 422 with `details.reason 'locale_blocked'` and blocker field IDs. Stable field IDs are not private.
    - The resolution's distinct `{locale, revisionId, hash}` set is frozen into `DependencyManifest.localeSources` (≤32, already in the schema).
    - On `cms.localization.changed.v1`, 03b invalidates any open review or scheduled publication whose frozen `localeSources` include the changed series (already stated `BE03b:1043`; add the series key).
    - An existing active target publication remains as last-known-good, per IA03 AC-CMS-13 fail-closed exceptions.
    - **Mapping** (A4 CMS-15 gap 7). PublicationVersion is one active per entry, locale and audience. Publishing locale L takes, as `revisionId`, the target-locale revision of L's series at its latest `approved` variant version. Any other revision → 03b 422 `locale_blocked` reason `revision_not_approved_variant`. Publishable variant state: `approved` only, with OD-3 governing stale fields.
12. **Accessibility interplay** (A4 gap 11). The D25 checker evaluates locale-specific alt text and captions. Add to BE03c: "a locale publication requires media accessibility rows for that locale or the media's declared fallback per BE04b; the checker blocker is reported through the publish preflight". This is a cross-reference only and is S14/S16-owned.
13. **Value validation** (A4 gap 2). The 201 path keeps the BE03b per-kind validators (`cms_draft_field_value_valid`). `rich_text` follows DEC-112 `rich_text.v1` once S10 lands. Unsupported complex kinds stay a typed 503 (`20260927440000:205-208`) until their validator exists. This must be stated in BE03c, not only in code.
14. **`noFallbackFieldIds` vs 03a `localizationMode`** (A4 CMS-15 gap 3).
    - The request set must equal the content-type version's fields with `localizationMode='no_fallback'`, so the request can neither add nor drop one (422 reason `no_fallback_mismatch`).
    - Fields with `localizationMode='none'` are not localizable (422 reason `field_not_localizable`, already in `BE03c:313`).
    - Agent decision: keep the request field as an equality expectation, like `blockRegistryDigest`, rather than remove it. Removing it would churn the shipped contract; IA requires that legal/safety/jurisdiction defaults be explicit.
15. **CAS and "creates or replaces"** (A4 CMS-15 gap 9). `expectedVersion` is the entry aggregate version (strong If-Match), as implemented, so a first variant needs no prior series version. "Creates or replaces" means the request appends the next immutable version to L's series, creating the series on first write. Rows are never updated in place.

### 2.8 CMS-16 related content (DEC-114, D11)

1. **Rule-set aggregate** (closes A4 gap 5). New table `cms_related_content_sets`:
   - Envelope with `state 'active'`.
   - `source_entry_id UNIQUE`, `set_hash char(64)`, `derived_rule_key/version`, `max_candidates`.
   - The `version` is the CAS counter.
   - Request change: `RelatedContentRuleRequest.expectedVersion: Version.nullable()`. Null means first curation and sends no `If-Match`; null when a set already exists → 409. This follows the `TemplateVersionRequest` precedent and decouples related CAS from the 03b entry/autosave version.
   - Rules stay append-only per target. Set replacement appends `revoked` versions for removed targets and `active` versions for added ones, with `position` equal to the pin array index.
2. **Eligible-target authority** (D11). Function `platform_private.cms_related_target_eligibility(p_owner_id, p_source_entry_id, p_target_ids uuid[≤160], p_purpose 'curation'|'preview'|'publication'|'delivery', p_locale text NULL, p_audience text NULL)` returns `(target_id, eligible, reason)` with `reason ∈ {eligible, not_found, self_reference, lifecycle_blocked, not_published_in_scope}`. Owned by 03c; it reads 03b entries and publications through named 03b predicates.

   | Purpose | Eligible when |
   |---|---|
   | `curation` | The target exists, is in the same owner as the source (cross-owner reference has no authority source, so it is denied by default), is not the source, has `lifecycle='active'` (excludes `archived`, `deletion_pending`, `held`; `BE03b:942`), and the actor has 03b entry read scope. |
   | `preview`, `publication`, `delivery` | The target has an `active` PublicationVersion for `audience` and for `p_locale`, or for the first locale in the source variant's `fallbackChain` that has one (recorded). The publication is not revoked, held or taken down. |

   - Any pin or exclusion failing `curation` → `404 RELATED_CONTENT_NOT_FOUND` with empty details and **no** per-item index. This resolves the 404/422 ambiguity (A4 gap 1) without leaking existence. The FE prevents it by picking only from CMS-03C-25.
   - Remove "cycles allowed only where relation definition permits" (DD03 `related_content_rule` row). Related lists are depth-1 and never expand a target's own list, so mutual pins are allowed. This is a spec contradiction fix.
3. **Derived rules [OD-5].** A code-owned, versioned registry `cms_related_rule_registry`, seeded immutable like the workflow policy registry (`BE03a:1682-1705`). Members are `{key, version, inputs, ordering, reasonCode, maxCandidatesCeiling ≤128}`. An unknown `key`/`version` → 422 reason `unknown_rule`. `maxCandidates` counts derived candidates **after** removing self, pins and exclusions and **before** read-time eligibility.
4. **Ordering.** The final list is:
   1. eligible pins in pin order;
   2. then eligible derived candidates in rule order, excluding pinned and excluded targets;
   3. truncated to 128.

   `eligibleCount` = the final list length (≤128; `BE03c:604`). Exclusions always win, including over derived candidates.
5. **Freeze and propagation.**
   - Add `relatedContent: {setId, setVersion, setHash, candidateListHash} | null` to the 03b `DependencyManifest` and `VersionSet` (`BE03b:343-381`).
   - At review submission and publication preflight, 03c `cms_related_candidates_freeze(source revision, locale, audience)` computes the ranked derived candidate IDs (≤ maxCandidates) with rule key/version/reason.
   - Rule-set changes after publication emit no event and affect public output only at the next publication. This keeps `BE03c:147` "no event emitted until publication".
   - Read-time eligibility filtering removes ineligible items and refills from the frozen ranked list. This is the IA "slot refills only from eligible candidates".
6. **Delivery** (BE04c/IA04 cascade, S15-owned).
   - Shard 04 projection build (DLV-11) and query (DLV-09) call the service-only `cms_related_content_projection(publication_version_id, audience)` and `cms_locale_resolution(publication_version_id)`.
   - Cached responses carry surrogate keys `cms-related:<targetEntryId>` (≤160 per response). A target's `cms.publication.changed.v1` purges that tag. This is a bounded fan-out (A4 gap 7) without per-source writes.
   - Add this to BE04c's projection inputs and to S15's DLV-09/11 criteria as a consumption clause.
7. **Reads.**
   - **CMS-03C-24:** `RelatedContentSetResource {setId|null, version ("0" not allowed; null when no set exists), pins[{targetId, position, eligibility}], exclusions[], derivedRule|null, derivedCandidates[{targetId, rank, reasonCode, ruleKey, ruleVersion, eligibility}] (≤128), eligibleCount}` with ETag = set version. Eligibility here uses `purpose 'preview'` with the entry's source locale and the default audience.
   - **CMS-03C-25:** query `{contentTypeId?: UUID, cursor, limit 1..50}`, items `{entryId, contentTypeId, contentTypeKey, displayLabel, publicationState}`. `displayLabel` is the value of the content type's first `short_text` field in the source locale, ≤160 chars, or `null`. This is an agent decision because no "title field" designation exists. Only curation-eligible targets are listed, and there is no free-text search, which the scope lock defers.
8. **Locale and audience.** A rule set is per source entry and applies to all locales. Eligibility is evaluated per locale and audience at preview, publication and delivery, as in item 2. Agent decision; the owner may override.
9. **Target types** (A4 CMS-16 gap 2). RelatedContentRule carries no `relation_definition` reference, and no source names an allowed-target-type list. Any content type in the owner's scope is therefore an eligible target type, and the item-2 predicate is the whole authority. Agent decision; this avoids inventing a per-type allowlist.
10. **Unavailable pinned targets in the editor** (A4 CMS-16 gap 9).
    - CMS-03C-24 returns an ineligible pin with `eligibility.reason`, and the editor renders it as a placeholder row: "Unavailable — hidden from readers ({reason copy})". The row still offers remove and reorder controls.
    - Readers never see the target.
    - A pin that is concealed from the actor appears as `reason:'not_found'` without the target's label.

### 2.9 Cross-slice seams (named so no slice invents them)

| Seam | Producer (builds/tests) | Consumer (wires) | Spec home |
|---|---|---|---|
| `cms_locale_variant_follow_review` | S12 | S11 CMS-03B-05/06 RPCs | BE03b §Data Flow `:1016`, BE03c §2.7 item 7 |
| `cms_locale_publication_readiness`, `cms_related_candidates_freeze`, template/pattern/taxonomy active-version checks as preflight categories (D19 registry) | S12 | S11 preflight registry | BE03b `:999`, `:1016` |
| `relatedContent` manifest member | S11 (03b schema) | S12 functions | BE03b `:358-381` |
| `cms_validate_and_assign_terms`, composition copy-forward | S12 | S10 CMS-03B-01/02/04 | BE03b `:996`, BE03c `:710, :742` |
| Source-stale trigger on revision insert (exists) | S12 | Fires on S10 writes | BE03c `:712` |
| Generic `cms_review_*` helpers | S09 (neutral helpers, shipped) plus S12 M1 (family cores) and M10 (S09 delegation) | S13 DLV-NAV-API-05–08 | BE03a §2.2 |
| `cms_related_content_projection`, `cms_locale_resolution`, surrogate keys | S12 | S15 DLV-09/11 | BE04c, IA04 |

### 2.10 FE03 cascade

- **`:552-570`, `:731-732`, `:765`, `:1000-1001`.** Delete `human-form-deferred-phase-2` and "disabled until runtime slice is authorized". CMS-03C-04 and CMS-03C-05 become `human-form`.
- **Page and Route table (`:687-695`).** Add each route with guard, deep link, back and multi-tab rules. The new pages are: the template list, `templates/new` (exists), `templates/:templateKey` (exists; adds review and activation panels), `definition-reviews/:reviewId`, the pattern list, `patterns/new`, `patterns/versions/:patternVersionId`, `entries/:entryId/composition`, `compositions/instances/:instanceId/linked-update`, the taxonomy list, `taxonomies/new`, `taxonomies/:taxonomyId`, `entries/:entryId/locales`, `entries/:entryId/locales/:locale` and `entries/:entryId/related-content`. All live under `/app/cms-content-modeling`.
- **Navigation reachability** (vertical-slices rule): links from the CMS shell; a link from the entry draft page (S10 file, root-integrated).
- **Components.** Split `CompositionTaxonomyLocalizationWorkbench` (`:486-573`) into five bounded islands, each ≤200 lines (extensibility rule): `DefinitionReviewPanel`, `PatternWorkbench`, `TaxonomyConsole`, `LocaleWorkbench`, `RelatedContentEditor`. Each defines the following:

  | Element | Specification |
  |---|---|
  | AsyncState rows | Rendered as in the `:619-647` table pattern |
  | Role variants | Add `definitionReviewAssigned` (mirrors `schemaReviewAssigned`), `templateDesigner`, `taxonomyCurator`, `entryAssignee`, plus `forbiddenHidden` / `disabledPrerequisite` |
  | Form fields × validation messages | Covers activation schedule fields, `patternKey`/tree editor, `taxonomyKey`/shape/allowlists/canonicalDomain, locale fields/chain, pins/exclusions/rule |
  | Accessibility rows | Linked-update diff (three-way table with row headers; per-collision radio group); pin reorder (keyboard Move up/Move down buttons, no drag-only); fallback-resolution table; review decision form (reuse) |
  | Responsive | Diff stacks base/theirs/yours on mobile |
  | Network rules | Scheduled-activation status; job poll for bulk linked-updates if async |

- **Copy rules:**
  - Stale fields name "source changed after approval".
  - `no_fallback` blockers name "publication blocked for this locale".
  - Unavailable canonical domain: "the canonical list for this domain is not available yet; choose canonicalDomain none or wait".
  - A canonical overlap shows the canonical key to use instead.
  - A missing designer or curator capability (`disabledPrerequisite`) names the owner's grant console route `/app/cms-content-modeling/capability-grants` (FE03 `:695`). The copy states the grant may run up to 90 days (DEC-120); the copy is shown to the owner role only.
  - An expired definition-review assignment says "assignment ended; ask the owner to assign again". It reuses the DEC-108 schema-review copy rules (FE03 `:619-647`).

### 2.11 Plan, scope lock and tracker text (WP1)

- **`PLAN:30` scope lock.** Remove "CMS-15–16" and "localization, related content" from "Explicitly deferred". Add: "DEC-114 (2026-10-02) brings CMS-15 and CMS-16 into Phase 2 (Slice 12)." S16's import/export/restore edit belongs to the S16 package.
- **Assignment rows:**
  - `PLAN:69`: Slice 12 IA flows become CMS-11, CMS-12, CMS-14, CMS-15, CMS-16.
  - `PLAN:90` (currently lists only CMS-03C-01..03 although AC033-038 already cover 03C-04/05): BE endpoints add CMS-03C-04..25 and `cmsTemplateLatestRead`.
  - `PLAN:109`: the ledger adds `25.05.03` and `25.05.04`.
- **S12 header (`PLAN:2922-2939`, `S12:3-10`).**
  - Depends on: "Slice 09; Slice 11 for the CMS-15/16 publication-interplay and locale-review criteria; Slice 10 seams per §2.9".
  - New floor and breakdown (§3).
  - Note: "AC004–009, AC022–025 implemented on the S09 DEC-108 critical path; counted here".
- **AC022–039 citations.** Change to `§Route field validation matrix (BE03c:296-318)`.
- **Rewording of unchecked ACs** (a plan edit; no D4 reopen, because nothing in S12 is checked):
  - AC034: the chain clause, per OD-4.
  - AC038: nullable first-curation `expectedVersion` (§2.8 item 1).
  - AC040–042: add activation through review (DEC-113).
  - AC043–045: add pattern create/activate (D9).
  - AC046–048: add the vocabulary version and canonical projection (D10).

  Each reworded AC keeps its ID.

### 2.12 Spec defects found in passing (fix in WP0)

| # | Defect | Location |
|---|---|---|
| a | Changelog row is malformed: missing workflow and sections columns | `BE03c:865` |
| b | Templates/patterns are designed by `cms.template_designer` per IA. The DD03 `pattern_version.owner_capability` column exists, but BE03c never states its value; state `cms.template_designer`. | — |
| c | `BE03c:670` named RPC list must add every new RPC | — |
| d | The BE03c Deepening Passes / Ambiguity Gate claim "No unresolved … ambiguity". Re-run passes 1–10 after the cascade, with evidence rows for the new operations. | `BE03c:827-848` |
| e | `be/index.md` and `fe/index.md` must list CMS-03C-06..25 and the new routes | — |
| f | BE03c CMS-03C-04 carries a per-variant `fallbackChain`, contradicting IA03:250 and AC-CMS-15 "per-type/field". The first pass's "never default_locale" over-generalized DD03:399. Fixed by §2.7 items 1 and 10 and OD-4. | `BE03c:313, 456, 589, 697` |

### 2.13 DEC-120 implications for S12 (standing grants ≤90 days; assignments stay ≤7 days)

| # | Rule written into the cascade | Spec home | Source |
|---|---|---|---|
| 1 | S12 capability checks resolve standing grants through the term-aware `cms_person_holds_capability`: `valid_from ≤ today ≤ valid_through`, active grant, confirmed membership. This covers `cms.template_designer`, `cms.taxonomy_curator`, `cms.author`, `cms.editor` and the specialist reviewer slots. A lapsed grant is "no capability": 403 when the subject is visible, otherwise 404 concealment. | BE03c Middleware & Policies; IA03 Access Control `:364-365` | DEC-120; `20261002125000:29-55` |
| 2 | Definition-review **assignments** (`cms.definition_review`) are bounded at ≤7 days and by the grantor's authority end. They are never 90 days. | BE03a §2.2 subsection, item 3 | DEC-120 "DEC-108 schema-review assignments remain at most 7 days", by family generalization |
| 3 | Scheduled definition activation must resolve before the scheduler's standing-grant end (schedule-time 422 `schedule_after_authority_end`). Fire time rechecks the scheduler's grant; a lapse → `blocked`, no event. Reviewer authority at fire time → OD-6. | BE03c CMS-03C-10 (§2.3) | DEC-120 downstream "S11 schedule authority recheck" (same rule as 03b schedules) |
| 4 | Accountable-curator preflight (§2.6) counts only humans whose `cms.taxonomy_curator` grant is current at activation. After activation, a lapse does not deactivate the vocabulary; curation commands simply refuse (403) until the owner renews (CMS-03A-16). | BE03c §2.6; IA03 | ideation D-03; DEC-120 "renewable with step-up" |
| 5 | WP8 acceptance provisions every test human only through CMS-03A-15, with `validThrough ≤ today+89`. A negative path shows a designer whose grant lapsed (time-shifted fixture) receiving 403 on CMS-03C-12 and on a scheduled fire. | S12 tracker, tests | DEC-120; S09 D3 |
| 6 | FE copy points missing-capability states at the grant console (§2.10). | FE03 | DEC-120 FE downstream |

No S12 contract field changes because of DEC-120 itself. Only rules 3 and 5 add new criteria rows (§3).

---

## 3. Depth-floor delta implications

1. **The current floor of 50 cannot stand as computed.**
   - It was computed as per-op lumps across only three endpoints (`PLAN:2936-2938`).
   - It already omits two existing matrix rows (finding 9).
   - DEC-114 adds 2 IA flows and 2 ledger rows. §2 adds 20 HTTP operations plus one propagated read, 4 tables and 2 column families, 2 new events, and about 7 projection seams.
2. **The method is settled.** S09 used the strict per-item formula. Its floor is 1200, with a 917-row delta (`PLAN:1549-1553`, `S09L:60-131`). S12 must use the same method; the coarse estimate in item 3 is kept only for comparison. Procedure, copying `S09L`:
   - Freeze sources: SHA-256 and line counts of IA03, DD03, BE03a (§2.2 subsection), BE03b (seams), BE03c, BE04c (consumption clauses) and FE03, after the WP0 cascade settles.
   - Build per-item rows using the `S09L:106-113` conventions:
     - one happy-path row per op;
     - field × constraint, including headers;
     - one row per distinct validation message;
     - one row per HTTP status in the matrix, with 401 UNAUTHENTICATED and 401 STEP_UP_REQUIRED separate, and 502, 503 and 504 separate;
     - authz role × op, including deny;
     - ownership, idempotency, rate, failure cascade, persistence, events and observability.
   - Consumed boundaries (BE03b, BE04c, BE03a) count only integration rows. S09's resolver and AC751 are excluded (`S09L:112`).
   - Dedup against AC001–050, apply the thinness gate, author `P2-S12-AC-051…` contiguous and all `- [ ]`, then cascade the totals in one commit.
   - Never back-solve from a desired total.
   - Ledger file: `.memory/pipeline/progress/verification/2026-10-0X-slice-12-dec113-dec114-dec120-depth-floor.md`.
   - **Baseline top-up.** The locked 50 lumps CMS-03C-01..05 into 6-packs. The strict pass over those five ops yields rows the 50 do not cover, which become new IDs; the 50 IDs are kept and reworded per §2.11. This matches S09, whose 283 baseline was regenerated strictly before the delta.
3. **Comparison only: the old S12/S10 coarse granularity** (6-pack per mutation, 5-pack per read, 1 per matrix row, IA triple per flow):

   | Item | Count | ACs |
   |---|---|---|
   | Mutations (06, 07, 09, 10, 12, 16, 17, 18, 23) | 9 × 6 | 54 |
   | Reads (08, 11, 13, 14, 15, 19, 20, 21, 22, 24, 25, latest) | 12 × 5 | 60 |
   | New matrix rows (≈33) plus the 2 omitted rows | 35 | 35 |
   | IA triples: CMS-15, CMS-16, plus activation and linked-update composites | ≈6 × 3 | ≈18 |
   | New IA edge-case rows | ≈2 | ≈2 |
   | Tables/columns | ≈6 | ≈6 |
   | Events/consumers | ≈4 | ≈4 |
   | Seam/projection functions | ≈7 | ≈7 |
   | FE interaction/a11y/nav rows | ≈17 | ≈17 |
   | Gates (scope lock, ledger, transfer note) | 3 | 3 |
   | **Total delta** | | **≈206** |

   This would give a floor of about 256. **Superseded**: S09 rejected this granularity.
4. **Strict estimate, calibrated on S09's realized densities.**
   - S09 densities:
     - 378 rows over the 10 ops CMS-03A-09..18, about 38 per op. Thinness: mutations 1 happy, 8–16 field, 12–13 error, 2–3 authz, plus messages, ownership, idempotency and rate; reads (03A-13, 03A-18) about 15–22.
     - 71 cross-cutting rows.
     - 104 FE03 rows over three surfaces.
     - 15 IA edge cases.
   - These estimates are for planning only. The ledger decides, and none of these numbers goes into a spec file.

   | Family | Basis | Estimate |
   |---|---|---|
   | BE03c new mutations: 06, 07, 09, 10, 12, 16, 17, 18, 23 | 9 × ≈40 (03C-10's five-action union and 03C-16's union run high) | ≈360 |
   | BE03c new reads: 08, 11, 13, 14, 15, 19, 20, 21, 22, 24, 25, plus `cmsTemplateLatestRead` | 12 × ≈22 | ≈265 |
   | Amendment rows on 03C-01..05: reserved keys, owner-scoped uniqueness, impact, `targetKind`, nullable `expectedVersion`, 409 locale cap, equality expectations, template-draft target | — | ≈35–50 |
   | Strict top-up of the 03C-01..05 baseline beyond the 50 | 5 × ≈35 − 50 | ≈100–130 |
   | BE03c cross-cutting: 4 tables plus series columns, 2 events plus the dedupe rule, 2 jobs, 2 canonical providers, ~7 seam functions, 3 metrics, RLS/grant audit | — | ≈70–100 |
   | BE03a generalized-machinery subsection and capability lists | Family rules × 3 families; integration rows only for S13 | ≈15–25 |
   | Consumed BE03b/BE04c clauses | Integration rows only | ≈8–12 |
   | FE03: 5 islands (review/activation, pattern plus linked update, taxonomy, locale, related) and ~15 routes | ≈30–35 per island plus ≈2 per route | ≈180–220 |
   | IA03/DD03 edge cases: activation race, assignment expiry, pattern cycle, merge convergence, locale cap, stale field, unavailable target, canonical unavailable | — | ≈15–25 |
   | Integrated producer paths (§4 WP8 1–5, with sub-scenarios) | — | ≈12–18 |
   | DEC-120 rules (§2.13 rules 3 and 5) | — | ≈4 |
   | Engineering and traceability | As `S09L` family | ≈9–10 |
   | **Delta** | | **≈1,070–1,420** |

   The new S12 floor would be about 1,120–1,470, and Phase 2 authored would rise from 2,932 by the same delta.
5. **Totals that move together.**
   - Plan: S12 header (`PLAN:2922-2939`), slice inventory `:157`, completion-policy totals `:32-53` (add a DEC-113/114/120 sentence after the S09 one), and Phase 2 authored/active totals (currently 2,932/2,928).
   - `phases/phase-02.md` S12 row; `progress/index.md:6`; `spec-pipeline.md`.
   - `scripts/check-progress-consistency.mjs` pins "2,928 active / 2,932 authored" at `:375, :395, :535` and the 1196/2928 comment at `:320`.
   - Any S12 guard/source-link tests.
   - The S12 tracker header (`S12:3-10`): floor, criteria count, and a gate line that already cites "260/1196".
   - Coordinate with the S10, S11 and S16 cascades so Phase 2 totals change once, in a fixed order. S09's amendment is already applied (uncommitted).
6. **Thinness check.** Each new op must yield non-zero happy/field/error/authz items. The locale and related reads need ≥3 FE states and ≥1 a11y row. The diff and pin-reorder flows need a11y rows. OD-gated sections (OD-1..6) cannot pass the thinness gate until answered.

---

## 4. Ordered work packages (disjoint file ownership)

**Rules:**

- Root owns every shared file:
  - `packages/contracts/src/platform-registries.ts`
  - `infra/openapi-definitions.mjs`, `infra/openapi-document.mjs`, generated `docs/openapi/openapi.json`
  - the capability registry and S09-owned `packages/contracts/src/content-schema-registry/models-grants.ts`
  - generated DB types
  - `apps/worker/src/production-worker-runtime-cms.ts`, `apps/worker/src/cms-composition-production.ts`, `apps/worker/src/worker-route-composition.ts`
  - CMS shell/nav and web route-policy registries
  - every README touched by more than one package
  - all progress and spec files
- Agents create only the files listed for them.
- Migration timestamps go in an orchestrator-reserved window. It must sort after S09's current last migration (`20261002137000_cms_private_function_grant_sweep.sql`, plus any S09 GREEN additions) and stay disjoint from the S10/S11 windows. The S10/S11 breakdown requires only "sort after every S09 migration", so the orchestrator must assign windows to all three. Proposed for S12: `20261010000000`–`20261010235959`. One DB agent writes them serially.

| WP | Owner and timing | Files | Depends on |
|---|---|---|---|
| **WP0 Spec cascade** | Root, serial, first | IA03, DD03, BE03c, BE03a (§2.2 subsection and capability lists), BE03b (manifest `relatedContent`, seams, locale follow), BE04c/IA04 (consumption clauses), FE03, `be/index.md`, `fe/index.md`, 5 scans marked applied, the new propagation record, raw DEC events for agent decisions if the owner wants them recorded | Commit of the in-flight DEC-115/A-series spec edits; OD-1..6 for their sections |
| **WP1 Ledger and plan** | Root, serial | Ledger file, `PLAN` (scope lock, assignment rows, S12 header, AC rows), `S12`, `phases/phase-02.md`, `progress/index.md`, `spec-pipeline.md`, `scripts/check-progress-consistency.mjs`, S12 guard tests | WP0 frozen; S09 ledger order |
| **WP2 Contracts Phase 0** | One agent, then root integrates the registry/OpenAPI | New `packages/contracts/src/cms-composition/{definition-review,definition-activation,template-selector,pattern-version,pattern-tree,pattern-selector,linked-update,taxonomy-version,taxonomy-selector,canonical-taxonomy,locale-read,locale-revalidation,related-content-read,related-targets,related-rules}.ts` with colocated tests. Edit `template.ts` (reserved keys, `impact`), `template-detail.ts`, `pattern-instance.ts` (`targetKind`), `related-content.ts` (nullable `expectedVersion`, new resource), `locale-variant.ts` (detail/series), `taxonomy-term.ts` (impact), `index.ts`, `README.md` | WP0 |
| **WP3a DB RED** | Agent A | `supabase/tests/phase_02_slice_12_{definition_review,definition_activation,series_identity,pattern_version,pattern_graph,linked_update,taxonomy_version,canonical_taxonomy,term_curator,assignment_convergence,locale_series_cap,locale_field_staleness,locale_reads,locale_readiness,related_set,related_eligibility,related_derived}.sql` | WP2 |
| **WP3b Worker RED** | Agent B | `apps/worker/src/cms-composition/{definition-review,definition-activation,template-list,pattern-version,linked-update,taxonomy-version,locale-read,locale-revalidation,related-read}-routes.test.ts`; `apps/worker/src/cms-composition-production-{review,activation,pattern-version,taxonomy-version,locale-read,related-read}.test.ts` | WP2 |
| **WP3c Web RED** | Agent C | New `apps/web/src/components/cms-composition/*.test.tsx` for the five islands; `apps/web/src/pages/api/v1/cms/{definition-reviews,definition-activations,patterns,taxonomies,compositions/instances}/**.test.ts`; locale/related proxy tests; `apps/web/src/server/cms-composition-platform-{review,activation,pattern-version,taxonomy,locale-read,related-read}.test.ts` | WP2 |
| **WP3d E2E and OpenAPI RED** | Agent D | `tests/e2e/phase-02-slice-12-{definition-review,pattern,taxonomy,locale,related}-real-route.spec.ts`; `tests/contracts/phase-02-slice-12-{definition-review,activation,pattern,taxonomy-version,locale-read,related-read}-openapi.test.ts` | WP2 |
| **WP4 DB GREEN** | One agent, serial migrations | **M1** the three `cms_definition_review*` tables, plus family-generic cores beside S09's helpers (§2.2 table). It reuses S09's family-neutral helpers unchanged and never `create or replace`s an S09 function. **M2** `series_id` and owner-scoped uniqueness for templates/patterns/taxonomies, reserved keys, untranslated CHECK narrowing. **M3** submit/decide/read/assign RPCs. **M4** activation RPC, scheduled job and events. **M5** pattern create/selector/detail, `cms_insert_pattern_instance` incl. template drafts, linked-update consumer/diff/resolve/bulk. **M6** canonical providers (role, organization_type), overlap function, taxonomy version create/list/detail, `cms_act_taxonomy_term`, convergence, `cms_validate_and_assign_terms`. **M7** locale series, D12 key fix in both emitters, cap 32, per-field hashes, carry-forward, revalidation, reads, readiness/resolution, follow-review. **M8** related sets, rule registry seed, `cms_curate_related_content`, eligibility, candidates/projection, reads. **M9** grant/privilege audit. **M10**, after amended S09 acceptance: S09's schema-coupled wrappers delegate to the M1 cores, with S09 pgTAP as the regression guard and the S09 owner co-signing. Each migration is a new `supabase/migrations/20261010…_cms_s12_*.sql`. | WP3a; S09 DB GREEN landed; WP-L before M7 when OD-4 is A |
| **WP-L Type locale policy (only if OD-4 is A)** | Root together with the S09 owner, because these are S09-owned files | BE03a/IA03/FE03 text (§2.7 item 1). ContentTypeVersion gains `supportedLocales` and `fallbackChains`, both included in `definition_hash`, in the 03a request/resource contracts (`packages/contracts/src/content-schema-registry/*`). A forward migration adds the columns and backfills `[source_locale, default_locale]` with empty chains. Schema-designer form fields. S09 plan AC039 wording. | WP0; S09 ledger re-freeze window |
| **WP5a Worker: review and activation** | Agent | `cms-composition/definition-review-routes.ts`, `definition-activation-routes.ts`, `cms-composition-production-review.ts`, `cms-composition-production-activation.ts` | WP4 M1–M4 |
| **WP5b Worker: templates and patterns** | Agent | `cms-composition/template-list-routes.ts`, `pattern-version-routes.ts`, `linked-update-routes.ts`, `cms-composition-production-pattern.ts` (replace the 503 at `:183,219`), `cms-composition-production-pattern-version.ts` | WP4 M5 |
| **WP5c Worker: taxonomy** | Agent | `cms-composition/taxonomy-version-routes.ts`, `cms-composition-production-taxonomy.ts` (replace the 503 at `:55`), `cms-composition-production-taxonomy-version.ts` | WP4 M6 |
| **WP5d Worker: locale** | Agent | `cms-composition/locale-read-routes.ts`, `locale-revalidation-routes.ts`, `cms-composition-production-locale.ts` (cap/409 mapping), `cms-composition-production-locale-read.ts` | WP4 M7 |
| **WP5e Worker: related** | Agent | `cms-composition/related-read-routes.ts`, `cms-composition-production-related.ts` (replace the 503 at `:56`), `cms-composition-production-related-read.ts` | WP4 M8 |
| **WP6a Web: review and activation** | Agent | `pages/app/cms-content-modeling/definition-reviews/[reviewId].astro`, `templates/[templateKey].astro` (owned for the panel), `components/cms-composition/CmsDefinitionReview*.tsx`, `CmsDefinitionActivation*.tsx`, `pages/api/v1/cms/definition-reviews/**`, `pages/api/v1/cms/definition-activations.ts`, `server/cms-composition-platform-{review,activation}.ts` | WP5a |
| **WP6b Web: templates and patterns** | Agent | `pages/app/cms-content-modeling/templates/index.astro`, `patterns/{index,new}.astro`, `patterns/versions/[patternVersionId].astro`, `entries/[entryId]/composition.astro`, `compositions/instances/[instanceId]/linked-update.astro`, `components/cms-composition/CmsPattern*.tsx`, `CmsLinkedUpdate*.tsx`, `pages/api/v1/cms/templates/index.ts`, `pages/api/v1/cms/patterns/**`, `pages/api/v1/cms/compositions/instances/**`, `server/cms-composition-platform-pattern-version.ts` | WP5b |
| **WP6c Web: taxonomy** | Agent | `pages/app/cms-content-modeling/taxonomies/{index,new,[taxonomyId]}.astro`, `components/cms-composition/CmsTaxonomy*.tsx`, `pages/api/v1/cms/taxonomies/**` (including the missing `[taxonomyId]/terms/actions.ts` proxy), `server/cms-composition-platform-taxonomy.ts` | WP5c |
| **WP6d Web: locale** | Agent | `pages/app/cms-content-modeling/entries/[entryId]/locales/{index,[locale]}.astro`, `components/cms-composition/CmsLocale*.tsx`, `pages/api/v1/cms/entries/[entryId]/locales/index.ts`, `.../locales/[locale]/index.ts`, `.../locales/[locale]/revalidations.ts`, `server/cms-composition-platform-locale-read.ts` | WP5d |
| **WP6e Web: related** | Agent | `pages/app/cms-content-modeling/entries/[entryId]/related-content.astro`, `components/cms-composition/CmsRelatedContent*.tsx`, `pages/api/v1/cms/entries/[entryId]/related-content.ts` (adds GET), `.../related-content/targets.ts`, `server/cms-composition-platform-related.ts` (owned) | WP5e |
| **WP7 Cross-slice seam wiring** | Root with the S10/S11/S13/S15 owners | Only in those slices' files, per §2.9; S12 provides tested functions | S10, S11 progress |
| **WP8 Integrated acceptance and docs** | Root, last | Runbook `.memory/wiki/operations/runbooks/cms-composition-taxonomy-localization.md`; READMEs; feature ledger; `node .memory/pipeline/compile.mjs`; memory records; S12 tracker evidence | All |

**WP8 acceptance paths.** Each must run end to end with real producers: test humans are provisioned only through CMS-03A-15 with `validThrough ≤ today+89` (DEC-120), and no hand-inserted review, decision or approved rows are used. A lapsed-grant negative (time-shifted fixture) covers §2.13 rule 5.

1. Template: draft → submit → assign → decide with MFA → activate → event; then a scheduled activation, a cancel, and a concurrent activation (one winner).
2. Pattern: create → review → activate → linked insert → v2 activate → diff → accept and detach → bulk.
3. Taxonomy:
   - an overlap refusal against a role facet;
   - an unavailable-domain 503;
   - activation requiring an accountable curator;
   - merge convergence with live assignments.
4. Locale:
   - author;
   - source edit with per-field stale fan-out;
   - a 33rd-locale 409;
   - revalidate → review → approve;
   - a `no_fallback` publish block (needs S11).
5. Related: pins, exclusions and a derived rule; then a target unpublish drops the target and refills the list (needs S11, and S15 for delivery).

---

## 5. Remaining owner decisions

Questions are asked one at a time. Each is genuinely not answerable from the sources. The default is more-work-now, so no option below is "less work"; for example, "do not build definition scheduling" is deliberately not offered in OD-6.

Ask order, most time-critical first:

1. OD-4: S09 re-freeze window.
2. OD-1, OD-2 and OD-6: they shape the shared review/activation contract that S13 also consumes.
3. OD-3 and OD-5.

### OD-1. Gating of taxonomy-version activation

Sources: DEC-113 covers templates and patterns only. D10 asks for taxonomy-version "create/activate/selector" ops without a gate. The IA state machine includes `review` for taxonomy versions (`DD03:236`). Ideation 25.05.01 says "low-risk work saves as a new attributable version; high-risk work enters required review/step-up".

| Option | Pros | Cons |
|---|---|---|
| A. Reviewer-gated through the same DEC-113 machinery (`taxonomy_version` subject; count = strictest across the allowlisted types' policies) | One mechanism; matches the IA review state; a curator cannot self-activate a vocabulary that feeds published pages | A second human is needed to activate a vocabulary |
| B. Curator activates alone with recent MFA and CAS | Matches the ideation "low-risk" wording; a solo owner can activate | The `review`/`approved` states become unreachable for taxonomies (enum padding); this is the first activation path in CMS with no independent review |
| C. Risk-split: ordinary allowlisted types → curator with MFA; any protected allowlisted type → review | Proportional | Two paths and more spec; still unreachable states for ordinary vocabularies |

**Recommendation: A.** It is consistent with DEC-113, IA and DEC-108.

### OD-2. Where a pattern's review count comes from

Patterns have no bound content types (IA03, DD03).

| Option | Pros | Cons |
|---|---|---|
| A. Add `compatibleTypeIds` (1..64) to PatternVersion, mirroring templates. The count is strictest across them, and insertion is refused into incompatible entries or templates. | Makes DEC-113 literal; ordinary patterns stay ordinary; adds a safety check at insertion | Designers must declare types; adds a contract field and an admission rule |
| B. Strictest across every content type in the owner's scope with an active version, frozen at submission | No new field; never under-reviews | Over-reviews: one protected type forces two humans plus a specialist for every pattern; drifts when types change |
| C. A fixed ordinary member, `cms.composition.pattern` v1 (count 1) | Simple; the DEC-115 `cms.delivery.navigation` precedent | Ignores DEC-113's strictest rule; protected content is guarded only at entry review |

**Recommendation: A.**

### OD-3. A stale, fallback-permitted locale field at publication and read

IA only states that `no_fallback` fields block (`IA03:47`; DD03:413 "Missing no-fallback field blocks locale publication"). DD03:398 says only that "unchanged fields may retain approved state", which implies changed fields lose it. It does not say what readers get meanwhile. The ideation edge case allows either "fail closed" or "explicit degraded".

| Option | Pros | Cons |
|---|---|---|
| A. Block publishing the target locale until every stale field is revalidated | Strictest; no outdated text | One source edit can freeze every translation; contradicts IA's narrower `no_fallback`-only block |
| B. Serve the last approved translation; the field is marked stale in editorial reads and the `cms_locale_stale_total` metric | Right language; approved text; honest to editors | Readers may see text that lags the source |
| C. Resolve the stale field as if it were missing: the type's explicit chain, then the `default_locale` root (§2.7 item 10) | Always current approved meaning | Mixed-language pages; a source edit silently switches readers to another language |

**Recommendation: B.**

### OD-4. Where the locale policy lives: the supported target-locale set and the ordered fallback chains

The sources point at the content-type version without saying how it is governed:

- IA03:250: "Each content-type version records … `source_locale` … `default_locale` (delivery fallback root …). Fallback is an explicit ordered per-type/field chain"
- IA03 AC-CMS-15: "the ordered per-type/field fallback chain is explicitly declared"
- DD03:45: "Field/type-specific ordered chain"
- BE03b:245: "validated against the active schema locale set", which nothing defines

BE03c instead takes a per-*variant* chain in the CMS-03C-04 request. Choosing the home changes S09-owned contracts, so this is an architecture decision.

| Option | Pros | Cons |
|---|---|---|
| A. ContentTypeVersion (03a) gains `supportedLocales` (1..32, including source and default) and `fallbackChains` (per target locale, ordered, ≤16). Both are changed only by a successor plus DEC-108 schema review and are frozen in `definition_hash`. The CMS-03C-04 `fallbackChain` becomes an equality expectation. | Literal reading of IA03:250, AC-CMS-15 and "schema locale set"; versioned, reviewed and frozen into activation evidence; deterministic preflight and resolution | Changes the S09 CMS-03A-01/02 request (open AC039 "exactly …" wording) and S09 source files; restarts the S09 ledger freeze; needs WP-L in S09-owned files |
| B. Owner-wide S07 typed settings: `cms.localization.supported_locales` (≤32) and per-locale chains, through config review | No S09 contract change | Not per type, which contradicts IA "per-type"; adds a settings dependency to CMS-15 preflight and resolution |
| C. Keep the per-variant chain (current BE03c); the supported set is any well-formed BCP 47 tag, bounded by the per-entry cap of 32 | No new authority; no S09 change | Contradicts IA03:250 and AC-CMS-15; no governance of which languages exist; typo locales become permanent series |

**Recommendation: A.** It is what IA says, and S09 is still open (AC039 is unchecked), so this is the cheapest moment to make the change. Run WP-L inside the S09 re-freeze window.

### OD-5. The Phase 2 derived related-content rule registry

IA requires "review explainable derived candidates" (`IA03:48`). The rules themselves define what "related" means to users.

| Option | Pros | Cons |
|---|---|---|
| A. `cms.related.shared-terms` v1: same-owner eligible entries sharing ≥1 active term assignment on allowlisted taxonomy fields. Ranked by shared-term count desc, then publication `activatedAt` desc, then `entryId`. Reason `shared_terms`. | Editorially meaningful; reuses taxonomy | Depends on the S10 taxonomy-field assignment seam |
| B. `cms.related.same-type-recent` v1: same content type, most recently published first. Reason `same_type_recent`. | No taxonomy dependency | Weak relevance |
| C. Both A and B | Editors choose per entry | Two rules to test and explain |

**Recommendation: C.**

### OD-6. Reviewer authority when a scheduled definition activation fires (DEC-120 interplay)

The sources collide:

- S09 G10 rechecks the approving reviewers' *current* assignment at activation. It is implemented as `cms_review_qualifying_approvers` → `cms_review_assignment_effective(starts_at <= now < ends_at)` (`20261002125000:196-207, 321-339`).
- DEC-120 keeps assignments at ≤7 days, while lifting standing grants to 90 days so that schedules do not fail closed on routine term expiry.
- 03b scheduled publication "re-runs preflight at execution" against "current revocation state" (`BE03b:999, 1018`). It states no approver-assignment recheck.
- `scheduled` is a definition state (`DD03:236`), which S12 builds (§2.3).

Under the literal G10 rule, any schedule that fires more than 7 days after the assignment start always blocks.

| Option | Pros | Cons |
|---|---|---|
| A. Fire time uses the immediate-activation semantics: approvers' assignments must still be effective. The schedule-time horizon is capped at the earliest approving assignment's `ends_at` (422 `schedule_after_review_authority_end`). | Identical to G10/S09; no new semantics; strictest | Horizon ≤7 days from assignment start, often hours; scheduling further out needs re-assignment and re-review; does not honour DEC-120's intent for reviewers |
| B. The schedule command is the authority checkpoint. The full G10 recheck runs at schedule time. At fire time the job checks four things: no approving assignment is `revoked`, the approvers are still eligible members, the scheduler's standing grant is current, and the frozen evidence is unchanged. Natural assignment expiry after scheduling does not void the schedule. Horizon ≤30 days and before the scheduler's grant end. | Mirrors 03b scheduled publication ("current revocation state"); matches DEC-120's intent; usable horizons; revocation and `cancel_schedule` still fail closed | Adds an expired-vs-revoked distinction (a helper variant beside S09's); approval authority outlives the assignment window by up to 30 days |
| C. Reconfirmation. Schedule as in B, but if any approving assignment has expired at fire time, the schedule moves to `blocked` with reason `reconfirmation_required`. A currently assigned reviewer then records a reconfirm decision with MFA before the job retries. | Freshest authority at fire time; long horizons still possible | Extra decision kind and state handling; reviewer workload; the most spec and test surface |

**Recommendation: B.** It follows the closest precedent (03b schedules) and DEC-120's stated purpose, while explicit revocation and `cancel_schedule` keep a fail-closed kill switch. If the owner prefers that authority never outlive an assignment, choose C rather than A, because A makes scheduling nearly unusable.

---

## 6. Sequencing risks

- **S12 cannot close before amended S09 acceptance** (`S12:7`; S09 is 260/1196 active). In the meantime, WP0–WP3 (spec/contract/RED) can proceed. WP4 waits for S09's DB GREEN migrations so that timestamps and helpers do not conflict. M10 (S09 helper delegation) waits for S09 acceptance.
- **S12 spec edits in S09 source files** (the BE03a §2.2 subsection, capability lists, and the OD-4 locale policy in BE03a/IA03/FE03) restart S09's ledger freeze (P2-S09-AC-1197). Batch them into one S09 re-freeze window.
- **S09 asymmetry (observation, not an S12 change).** ContentTypeVersion shares the definition state machine, but S09 has no schedule action. After OD-6, the orchestrator should either record `scheduled` as justified-open for content types or add a matching S09 follow-up, so that the two definition families do not diverge silently.
- **CMS-15/16 publication criteria need S11.** S12 should declare S11 as a dependency for those criteria. This does not change S13, which already depends on S11 and S12. Templates, patterns and taxonomy can close earlier.
- **Spec files are actively dirty** from other agents: IA03, DD03, BE03a, FE03, the plan and the trackers are uncommitted now. WP0 must start after the S09 DEC-119/120 edits commit, and must re-read before editing. Any later source edit restarts the S12 ledger freeze.
- **S13 consumes the generic review helpers and the "generalized machinery" text.** The BE03a subsection in §2.2 should land before S13's DEC-115 implementation.
- **Local Wrangler flakiness under repeated rejected POSTs** (`S12:272-301`, workers-sdk #15203) will recur with about 20 new routes. Keep the real-route suites split.
