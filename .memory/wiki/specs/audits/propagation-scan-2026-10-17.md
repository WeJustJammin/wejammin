# DEC-202 propagation scan — confirmation required

Native `gpt-6.1-sol` / `ultra`; source-only scan, 2026-10-17.
Only this NEW report is authored. No specification, contract, implementation,
test, tracking, permission or graph change has been applied.

## Locked source and selected scope

[DEC-202:5324–5334](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/decisions.md:5324),
recorded at **2026-10-17T23:18:55Z**, is the authority, not the earlier research
reports that left failure mapping open. It requires:

- First-revision pin from the exact authorized active schema's stored
  `default_template_version_id`; absent default preserves SQLNULL.
- Existing resolver policy: missing/concealed →404 `NOT_FOUND`, no details;
  incompatible →422 `VALIDATION_FAILED`, machine DETAIL
  `["/contentTypeVersionId"]`; retired/blocked →409 `CONFLICT`.
  Superseded defaults remain eligible, not active-only.
- No new request operand, permission, public reason/status, latest/first-binding
  fallback, historical rebind or fabricated composition.
- Completed replay remains before dependency revalidation; authority, response
  shapes and unexpected-fault propagation are preserved. Fence/recheck actual
  dependencies in relation2 → dependency3 → schema4 order.

Root directly selected contract/API, data and FE consequences. The workflow's
selection menu is therefore not reopened. Structure, stack and authorization
model are not being redesigned. All513 executed migrations, including the new
restore helpers, are immutable by root instruction; implementation changes
would require a separately released forward migration.

## Pre-scan: supported types and reproducible counts

The six supported types come from
[Decision Propagation Reference:7](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.codex/skills/prd-templates/references/decision-propagation.md:7).
Contract/API and FE are the owner-selected surfaces; data placement, patterns
and error architecture carry the selected semantic changes.

Discovery corpus: every `.md` recursively below `.memory/wiki/specs/{ia,be,fe,phases}`,
plus the exact Slice12 tracker. **291 files**: IA85, BE157, FE44, phases4,
tracker1. Audits, handoffs, decisions and code are excluded from this denominator.
Counts below are case-insensitive matching **lines**, once per line/category,
not semantic contradictions, acceptance results or claims of full review of291 files.

| Supported type | Matching files | Matching lines | Case-insensitive discovery alternatives |
| --- | ---: | ---: | --- |
| structure | 211 | 1873 | directory/directories/folder/file structure/route registry/component hierarchy |
| tech-stack | 259 | 4651 | Astro/React/TypeScript/Hono/Cloudflare/Supabase/PostgreSQL/Zod/pnpm/Vitest/Playwright |
| auth-model | 288 | 11231 | authentication/authorization/RLS/capability/capabilities/session/acting context/service_role/permission |
| data-placement | 287 | 8296 | table/tables/column/columns/schema/revision/ContentTypeVersion/EntryRevision/template_version_id/default_template_version_id |
| patterns | 286 | 8858 | idempotency/lock order/FOR SHARE/FOR UPDATE/append.any-character.only/immutable/server.any-character.derived |
| error-architecture | 273 | 10791 | ApiError/NOT_FOUND/VALIDATION_FAILED/CONFLICT/DEPENDENCY_UNAVAILABLE/404/409/422/error envelope/error boundary |

Each alternative is bounded by regex `\b`; the two `any-character` entries
represent the exact regexes `append.only` and `server.derived`. This makes the
discovery counts reproducible rather than an unspecified keyword estimate.

Focused cue scan used `defaultTemplateVersionId|default_template_version_id|CMS-03B-10|EntryCreateRequest|cms_create_entry|first (?:draft )?revision|entry bootstrap`,
case-insensitive, matching lines once. **119 matching lines in8 selected files**:

| File | Matching lines |
| --- | ---: |
| IA03 `.memory/wiki/specs/ia/03-cms-content-modeling.md` | 12 |
| IA03 deep dive `.memory/wiki/specs/ia/deep-dives/03-cms-content-modeling.md` | 10 |
| BE03a `.memory/wiki/specs/be/03a-content-schema-registry.md` | 15 |
| BE03b `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` | 41 |
| BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` | 0 |
| FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md` | 26 |
| Phase2 `.memory/wiki/specs/phases/phase-2.md` | 14 |
| S12 `.memory/pipeline/progress/slices/phase-02-slice-12.md` | 1 |

Zero direct cues in BE03c does not mean no impact: its broader bound-definition
and lock-order clauses were read semantically. Discovery and classified counts
are deliberately separate. The bounded inventory below has **28 reference
groups across31 distinct source files**:4 explicit contradictions,9 implicit
omissions/assumptions,15 consistent groups. Groups can cite multiple files or
different clauses of one file; they are not28 new requirements or test cases.

## Explicit contradictions — propose individually, do not apply

| ID | Exact current source | Conflict with DEC-202 | Minimal proposed disposition |
| --- | --- | --- | --- |
| E1 | [BE03c:1473](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1473): a writer waiting on a “pinned or bound definition” finds it superseded and is refused. | Unqualified wording would reject the exact superseded default that DEC-202 explicitly keeps eligible. Existing pattern operations still require active pins. | Qualify this general rule with the DEC-202 initial-entry-template exception; retain pattern-specific active-only refusals and publication currentness unchanged. |
| E2 | [FE03:1854](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/fe/03-cms-content-modeling.md:1854): create's409 cell says “replayed create/idempotency.” | An exact completed replay returns its original success, not409; DEC-202 explicitly preserves that behavior before dependency revalidation. | Replace overbroad replay wording with idempotency mismatch/conflict, derived-template withdrawal and typed lock conflict; state completed replay remains original success. |
| E3 | [create18040:330–339](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261005018040_cms_create_entry_derived_state.sql:330): first revision INSERT supplies literal `null` at337. | NonNULL schema defaults are discarded. This is the concrete implementation gap, not a missing request field. | Future guarded amendment derives and persists the exact default after fencing/revalidation; keep NULL branch, public response and effects unchanged. Do not edit this executed migration. |
| E4 | [create18040:121](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261005018040_cms_create_entry_derived_state.sql:121) acquires schema4 before the relation resolver at254; [lock helpers:416–423](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261005012100_cms_write_path_lock_helpers.sql:416) performs actual relation-target locks. | Existing relation2 work occurs after schema4. Adding template3 late would create another inversion; DEC-202 requires2→3→4. | Keep this pre-existing implementation defect explicit. TEST-first future work must preflight visible targets, lock their complete union in ascending UUID order at2, then exact template3, then schema4, with rechecks. No private/foreign target lock lever. |

E3/E4 are implementation follow-ups, not permission to modify production during
spec propagation. A forward migration must preserve the current post-E7 source,
function OID/attributes/ACL/comment, deadline and SQL refusal boundary.

## Implicit omissions and assumptions — propose individually

| ID | Exact current source | Missing propagation / minimal proposed fix |
| --- | --- | --- |
| I1 | [IA03 AC-CMS-05:39](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/ia/03-cms-content-modeling.md:39) and CMS-05 interaction60 describe atomic first revision but not how its template is initialized. | Add server-derived exact active-schema default/NULL behavior and no caller template authority; preserve immutable history and route ownership. |
| I2 | [IA03 deep dive:49](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/ia/deep-dives/03-cms-content-modeling.md:49), bootstrap algorithm323–324. | Add the initialization/default-NULL rule and an exact DEC-202 reference; keep same request, first revision identity and replay/atomicity contract. |
| I3 | [BE03b field matrix:276](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:276), [data flow:2075](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2075). | Specify derivation from the exact authorized active schema, NULL preservation, no latest/first-binding fallback, existing resolver lifecycle policy and completed replay before new dependency checks. |
| I4 | [BE03b CMS-03B-10 error row:1920](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1920); pointer convention1930. | Add missing/concealed404 with empty details, incompatible422 with exact pointer-array DETAIL `["/contentTypeVersionId"]`, retired/blocked409; superseded eligible; unexpected faults propagate. Do not introduce a reason token or nonexistent template request pointer. |
| I5 | [BE03b lock positions:1728–1731](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1728), rule1736. | Explicitly place create's exact owner-scoped template dependency at3 after all visible relation targets2 and before schema4; rederive default and compatibility after waits. No lock on an unreadable/foreign template. No locks for unused slot allow-list blocks. Preserve typed lock failure and same-key retry. |
| I6 | [FE03 CMS-05:1096](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/fe/03-cms-content-modeling.md:1096), mapping1806 and mandatory tests2751–2757. | State template is server-derived without a control/request member. Add non-disclosing404, form-level recovery for422 `/contentTypeVersionId`, and409 withdrawal/conflict handling; preserve typed values, safe focus/status, exact replay and same wire shapes. No template identity/reason invented for display. |
| I7 | [Phase2 receiving scope:3097](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/phases/phase-2.md:3097), [AC053:3153](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/phases/phase-2.md:3153). | Explicitly receive DEC-202 bootstrap/default-NULL/refusal/replay/fencing behavior under template-binding scope. Root must derive any necessary independently testable criterion/depth accounting; do not silently declare the existing285 floor complete or fabricate new AC IDs here. |
| I8 | [S12 receiving scope:57](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/pipeline/progress/slices/phase-02-slice-12.md:57), mirrored [AC053:3059](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/pipeline/progress/slices/phase-02-slice-12.md:3059). | Mirror the approved plan wording; record DEC-202 and separate contract/QA/implementation/replay/atomicity/real-lock evidence as OPEN until observed. Do not reinterpret earlier restore storage fixtures as public bootstrap proof. |
| I9 | [Web submit copy:83–89](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/web/src/components/cms-editorial/cms-editorial-entry-create-submit.ts:83), validation149–154. | Current404/409 copy assumes only content-type absence/change; a derived template can now cause these responses without that condition. Plan TEST-first neutral safe copy and form-level non-field-pointer recovery, without disclosing which dependency failed or adding a template selector. This is an implementation assumption, not a new public error contract. |

## Consistent references — preserve; no required wire/schema change

| ID | Current source | Consistent boundary / disposition |
| --- | --- | --- |
| C1 | [BE03a:206/209](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03a-content-schema-registry.md:206) | DEC-123 initially templateless **type** and exact successor default/bindings pair are upstream producers, not an entry-templateless mandate. Preserve. |
| C2 | [FE03:1274](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/fe/03-cms-content-modeling.md:1274) | “The template new entries start from” already expresses intent. Cross-reference DEC-202 if useful; do not change the successor's UI or pair rule. |
| C3 | [IA03:279/285–286](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/ia/03-cms-content-modeling.md:279) | Optional immutable schema default and first-revision template reference already exist; no new entity/column/cardinality. |
| C4 | [BE03b strict create:1041–1051](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1041), nullable stored template1993 | No template request operand; nullable storage supports both outcomes. Clarify semantics, not request or table shape. |
| C5 | [BE03b atomic bootstrap:1949](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1949); [create replay:63–79](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261005018040_cms_create_entry_derived_state.sql:63) | Existing locked author/editor proof and completed-reservation response precede dependency validation. Keep authorization and exact replay, not a post-retirement revalidation. |
| C6 | [BE03b:1715](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1715); [append:528](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261005018045_cms_create_revision_derived_state.sql:528), [resolve:579](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261005018050_cms_resolve_conflict_derived_state.sql:579), [restore:413](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261005018055_cms_restore_revision_derived_state.sql:413) | Existing current/theirs/named-source pins are not replaced by a later schema default. This is preservation of policy, not restore implementation acceptance. |
| C7 | [resolver:38–56](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261002132000_cms_template_compatibility_resolver.sql:38); [UUID compatibility:16–27](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20260930161000_cms_template_binding_uuid_identity.sql:16) | Exact owner/type/version, missing/withdrawn/incompatible and UUID identity semantics match DEC-202. No active-only or latest fallback; preserve original unexpected errors. |
| C8 | [successor:294–316](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261003100200_cms_successor_workflow_key_change.sql:294); [activation guard:75–112](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20260930160000_cms_template_binding_compat_guard.sql:75) | Real default storage/compatibility producers already exist. No schema-designer permission is added to entry create. |
| C9 | [placement:115–125](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261014110300_cms_insert_pattern_instance.sql:115); [manifest template branch:176–184](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261005017560_cms_dependency_manifest.sql:176) | Consumers use the revision's exact stored pin, not its schema default. Initialization makes the path reachable; do not add consumer-side fallback or fabricate composition rows. |
| C10 | [canonical entry-create:32–77](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/packages/contracts/src/cms-editorial/entry-create.ts:32) | Strict request, no If-Match and unchanged eight-member response already fit. No required public/shared Zod shape edit. The schema-evidence checklist at85–154 is explicitly not runtime attestation; DEC-202 does not require inventing a new wire seam token. |
| C11 | [canonical errors:72–84](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/packages/contracts/src/cms-editorial/routes-errors.ts:72); [safe pointer grammar:50–57](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/worker/src/cms-editorial/error-vocabulary.ts:50); [DETAIL parser:64–88](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/worker/src/cms-editorial-production-error-details.ts:64) | Existing404/409/422 and safe `/contentTypeVersionId` work without a new enum/status or structured successor-style DETAIL. Add behavior tests, not new public vocabulary. |
| C12 | [revision resource:40–55](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/packages/contracts/src/cms-editorial/resources.ts:40) | `templateVersionId` already nullable/read-only in the revision resource. Initial create's different envelope remains unchanged. |
| C13 | [Worker parse:112–113](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/worker/src/cms-editorial/create-routes.ts:112); [RPC mapping:63](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/worker/src/cms-editorial-production-types.ts:63); [canonical route:187–221](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/packages/contracts/src/cms-editorial/routes.ts:187) | Existing protected POST/RPC mapping, author/editor authority, CSRF, idempotency, no If-Match and15s deadline are unchanged. No new HTTP operation/OpenAPI field is required. |
| C14 | [Web prefill shape:47–62](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/web/src/components/cms-editorial/cms-editorial-entry-create-form.ts:47); [entry-level summary:131–141](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/web/src/components/cms-editorial/use-cms-editorial-entry-create.ts:131) | Browser echoes schema evidence and has a generic non-field summary path. Preserve typed values and unknown-attempt replay; no browser-side template derivation or control. Copy/recovery semantics still need I9's receiving tests. |
| C15 | [frozen QA:16–104,171–226](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/tests/phase_02_slice_12_entry_default_template.sql:171) |40 checks:16 real producer/governance premises +2×12 bootstrap assertions; independent T1/slot and NULL control. It intentionally does not guess failures/races. Preserve this frozen file; additional DEC-202 policy tests require a separate claim. |

## Minimal one-by-one apply proposal

These are proposed review units, not edits or write authorization:

1. **BE03b**: resolve I3–I5 together as distinct clauses: derivation/replay,
   exact refusal DETAIL, then2→3→4 fencing/recheck. Keep strict request/resource,
   authority, effects, timeout and unexpected-error policy unchanged.
2. **BE03c**: apply E1's narrow superseded-template exception; do not relax live
   pattern or publication active-state policy.
3. **IA03**, then **IA03 deep dive**: apply I1/I2's first-revision initialization
   wording, independently review each file; preserve existing model fields.
4. **FE03**: resolve E2's replay phrase; propagate I6's derived-default and
   safe form-level error/recovery rules, without a template input or new copy
   that identifies concealed dependencies.
5. **Phase2 plan**, then **S12 tracker**: receive DEC-202 under AC053, derive
   any necessary criterion/depth changes explicitly, mirror them and keep OPEN.
   No automatic denominator or acceptance update follows from this report.
6. **After specification confirmation and TEST-first release only**: resolve
   E3/E4 and I9 through new forward implementation and bounded Web changes.
   Existing strict shared/public schemas, route/status registries and recorded
   pins require no structural change on the inspected sources.

Required future proof includes exact default/NULL, eligible superseded default,
404 concealment,422 pointer array,409 retirement/blocking, unexpected fault
propagation, full-store late-fault rollback/same-key retry, exact completed replay
after dependency withdrawal, and real two-client dependency/schema/relation
lock barriers. Schema-default changes must affect only subsequent new entries,
not append/resolve/restore history. These are OPEN proof obligations, not test
receipts or instructions to modify the frozen happy-path40.

## Stop gate and limits

The main agent read the parent, scan and apply skill instructions completely.
[Scan step5](/home/rob/Projects/WeJammin/.codex/skills/propagate-decision-scan/SKILL.md:20)
requires confirmation before apply. **STOP here for scan confirmation.**
No spec application, graph refresh/`memory_compile`, production/test change,
formatter/parser, app runtime, DB/Docker, Git, network or child execution occurred.
Only source inspection/counting/hashing and this report's `apply_patch` write
were performed. Root owns the frozen QA's actual execution, all513 immutable
migrations and later acceptance decisions. Earlier dated research/handoff
statements that the failure policy was pending remain historical; DEC-202
supersedes that uncertainty without rewriting evidence or claiming GREEN.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
