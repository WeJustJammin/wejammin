# Review — block compatibility for templates and patterns (read-only investigation)

Brief: `briefs/review-blockcompat.md`. Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`,
branch `claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e` (verified at start).
Reviewer did not author anything under review. No DB, no tests, no edits outside this file.

## Status

COMPLETE. Verdict at the end: **B** — the specs define a block's compatibility with a content type as the
registered block's schema-compiler compatibility range covering the type's active schema artifact
`compiler_version` (plus lifecycle), never as membership in a per-type `blocks` list inside the compiled
renderer manifest. The renderer-manifest check in `cms_template_block_digest` (and its pattern mirror
`cms_pattern_blocks_compatible`) has no spec basis and is unsatisfiable through real producers. The CMS-03A
compiler must NOT write `blocks`: the compiled artifact set is pinned by BE03a and by a reviewed Slice 09
oracle, and the type definition carries no block input from which a list could be compiled.

## Scope

Question from root (`CLAUDE-STATE.md:98-100`, pattern-def report `## Fix pass` F3, Requests to root 3): how
do BE03a/BE03c/IA03/FE03 define block "compatibility" for a template slot and for a pattern (BE03c :1361
"rejects a missing, withdrawn or incompatible block"), and must the type compiler write `blocks` into the
compiled renderer manifest. Brief items 1-4 answered in sections 1-4 below.

## 1. What is implemented today (file:line)

### 1a. Template check (applied, immutable)

- `supabase/migrations/20260927200000_cms_template_authority.sql:268-271` — the only articulation of the
  rule, a comment: "The renderer manifest is the active type's explicit block compatibility evidence, not a
  caller-supplied assertion." Introduced in commit `3cdded35` (2026-10-04, PR #124, `git blame`).
- `20260927240000_cms_template_digest_supported_lifecycle.sql:54-83` (current body of
  `platform_private.cms_template_block_digest`): for every distinct `allowedBlocks` reference and every
  `compatibleTypeIds` member, requires an active type with an active version whose artifact
  `renderer_manifest->'blocks'` or `->'blockDefinitions'` contains an element with equal `blockKey` and
  `blockVersion` (`:67-79`), else `VALIDATION_FAILED` (`:81-83`). Lifecycle: missing registered row
  `VALIDATION_FAILED` (`:42-44`), not `supported` → `CONFLICT` (`:50-53`).
- Caller `20260927200000:440-442` (`cms_define_template`), after the type-compatibility loop `:425-439`
  (each `compatibleTypeIds` member must be an active owner type with an active version — this IS the
  spec's template↔type compatibility, BE03c :371, :1500).
- Governed recompute delegates the template branch to the same function:
  `20261013300400_cms_governed_frozen_status.sql:93-95`; its comment `:133` ("renderer-manifest
  compatibility included") restates the invented rule. The pattern branch `:96-128` does NOT check any
  manifest (lifecycle + registry only).

### 1b. Pattern check (WIP, lane pattern-def)

- `supabase/migrations-wip/pattern-def/20261014020300_cms_pattern_graph_helpers.sql:110-152`
  `cms_pattern_blocks_compatible(owner, tree, type_ids)`: same manifest predicate over the governed closure;
  comment `:151-152` cites "BE03c 1361 (OD-2, mirroring templates)".
- Caller `20261014020400_cms_create_pattern_version.sql:236-238` → `VALIDATION_FAILED` at `/blockTree`.

### 1c. The compiler never writes `blocks` (applied)

- Original compiler `20260902080000_content_schema_registry_authority.sql:704-715`
  (`cms_compiled_renderer_manifest`): exactly `relations`, `templateBindings`, `capabilityBindings`.
- Single-compile body of `cms_create_type_draft` `20261010166000_cms_create_type_draft_single_compile.sql:217-221`:
  the same three members, by design ("the manifests are the compile rule of those two functions", `:202-209`),
  and the artifact hash is composed over that manifest (`:229-246`).
- Every other artifact writer copies or recomputes the same function: successor clone
  `20261002126000:98`, locale producers `20261002164000:22,248-253`, `20261002201000:139-144`,
  `20261002203000:154-159`, `20261002215000:159-164`, `20261003100100:150-155`, `20261003100400:189-194`.
  Drift guard `20261005018400_cms_claim_resolver_snapshot.sql:131` refuses an artifact whose
  `renderer_manifest` differs from `cms_compiled_renderer_manifest(definition)`.
- The canonical definition `20260902080000:641-690` (`cms_canonical_type_definition`) and the request
  contract BE03a :786-801 (`ContentTypeDraftRequest`: typeKey, label, ownerCapability, locales, workflow,
  defaultTemplateVersionId, fields, relations, templateBindings, capabilityBindings) carry no block member.
  There is no input from which a per-type block list could be compiled.
- Reviewed Slice 09 oracle `supabase/tests/phase_02_slice_09_p241_ac007_artifact_compile.sql:76-77` asserts
  the renderer manifest key set is exactly `capabilityBindings,relations,templateBindings`
  (P2-S09-AC-007, `[x]` at `.memory/pipeline/progress/slices/phase-02-slice-09.md:523`); `:79` asserts the
  canonical definition key set (no block member); `:97` recomputes the artifact hash over that manifest.

### 1d. Where `renderer_manifest.blocks|blockDefinitions` do exist in 03a (optional members, no producer)

- Activation recheck `cms_activation_references_valid` (`20260902080000:3053`, re-created
  `20261005012000:620-745`): `cms_exact_keys` requires `relations, templateBindings, capabilityBindings` and
  permits optional `blocks, blockDefinitions, rendererRefs, schemaRefs, dataSourcePermissions`
  (`20260902080000:3426-3435`); each `blocks`/`blockDefinitions` element must satisfy
  `cms_block_reference_valid` (`:3516-3535`), which requires the exact keys `{blockKey, blockVersion,
  lifecycle}` and equality of the stored derived lifecycle, not withdrawn (`:560-612`).
- Lock of referenced block rows at activation `:3598-3620`; review invalidation on block lifecycle change
  `20261002122500:245-280`; CFG-review invalidation `20260902080000:2040-2075`.
- The only test touching the member is a tamper probe: `supabase/tests/phase_02_slice_09_r3_activation_gates.sql:209-212`
  injects `{"blocks":[{"blockKey":"r3.no_such_block","version":"1"}]}` and expects activation
  `VALIDATION_FAILED` ("an unregistered block reference", P2-S09-AC-095).
- Semantics in 03a: a validity constraint ("if a manifest lists a block reference it must be a registered,
  non-withdrawn one"), never an allowlist of blocks a type supports. No BE03a/BE03c/IA03/FE03 text names
  `blocks`, `blockDefinitions`, `rendererRefs` or `schemaRefs` as renderer-manifest members (grep of all four
  specs and `decisions.md`: no hit).

## 2. What the specs define as block "compatibility" (file:line)

### 2a. Template ↔ content type (not in dispute, implemented)

- BE03c :371 (route matrix, CMS-03C-01 `compatibleTypeIds`: "1–64 UUIDs, each active/allowlisted
  ContentTypeVersion family"); :1500 ("validate slots/bindings/reserved regions/type compatibility").
- DEC-108 resolver BE03c :223-299 (`INCOMPATIBLE`), SQL `20261002132000_cms_template_compatibility_resolver.sql:10-76`
  via `cms_template_binding_compatible` (`20260930161000:5-30` = `template.compatible_type_ids ∋ type`).
- Implemented in `cms_define_template` `20260927200000:425-439`.

### 2b. Block ↔ content type: the schema-compiler compatibility range

- BE03a :1098-1101 `BlockRegistrationRequest.compatibility: { minSchemaCompiler, maxSchemaCompiler }`;
  IA03 :44 and :65 ("compatibility range" is a registered block property); IA deep dive
  `.memory/wiki/specs/ia/deep-dives/03-cms-content-modeling.md:227` (`block_definition_version` carries
  `compatible_from/to`).
- Stored as `cms_block_definition_versions.compatibility_range jsonb` (`20260902080000:1404`, CHECK `:1454-1455`);
  validated at registration against the schema-compiler registry `cms_compiler_registry_valid`
  (`:954-958`; registry `:533-540` = `'1','1.0','1.0.0','1.9'`); written by the real producer
  `cms_register_block` (`20261003130600:73,86`).
- The same registry governs the type artifact's `compiler_version`: `20261005018400:134` and
  `20261005012000:308-310` refuse an artifact whose `compiler_version` is not registry-valid; every compiled
  artifact carries `compilerVersion '1'` (`20260902080000:726`; `20261010166000:229-232`). Block range and
  artifact compiler therefore share one vocabulary.
- BE03a :2761 ("To 03c: expose immutable BlockDefinitionVersion metadata and compatibility ranges");
  :29 ("a block renderer/schema is a code-owned definition and activation compatibility input");
  :86 ("This document supplies only the schema/block compatibility inputs those consumers are allowed to
  reference").
- BE03c :1567 ("03a supplies ... SchemaArtifact id/hash/compiler ... 03c ... validates compatibility against
  those exact artifacts"); :209 ("consumed from 03a by immutable key/version, propsSchemaRef, propsSchemaHash,
  and compatibility/release digest ... unknown, withdrawn, or incompatible blocks fail before mutation");
  :321 ("Missing, withdrawn, incompatible, duplicate, or unreachable block references fail closed").
- IA deep dive :400 ("Template slot validates required/allowed blocks, max counts/depth, reserved regions,
  binding types, and compatible content/schema versions"); :260 (activation requires "impacted
  template/block compatibility").
- No migration evaluates `compatibility_range` after registration (grep: only the validator `:954-958`,
  the DDL, and the inserts). The spec-defined check is implemented nowhere.

### 2c. Lifecycle axis (separate from compatibility)

- Templates: "every referenced block version is registered and currently supported" (IA03 :45, :66;
  BE03c :1606 "deprecated/withdrawn refusal"); implemented `20260927240000:50-53`.
- Patterns: "a registered, non-withdrawn version" (BE03c :396), "rejects a missing, withdrawn or
  incompatible block" (:1361); deprecated handled by "the fixed compatibility policy" (:1514-1515).

### 2d. Evidence that the spec does NOT model a per-type block allowlist

- BE03c :194-199: `TemplateDesignerContext` offers "128 owned registered, currently supported block
  selectors (`blockKey`, `blockVersion`)" beside the type selectors — not filtered per type. SQL
  `20260927320000_cms_template_designer_context.sql:61-77` filters by owner, `registered` and lifecycle only.
- FE03 :883: the pattern designer picks "block nodes ... from the context's registered block selectors".
- BE03a :1963 `ContentSchemaRegistryDetail.blockDefinitions` is the platform registry, identical for every
  type and organization: reviewed oracle `supabase/tests/phase_02_slice_09_p240_reads_detail.sql:103-112`
  ("blocks are platform registry records, not tenant data", P2-S09-AC-145); `:106-108` asserts the safe
  record never carries `compatibilityRange` (so the range is DB-internal evidence, consistent with BE03a :2761
  exposing it to 03c's SQL, not to the browser).
- BE03a :2246-2255 pins the compiled artifact set ("a compiled `SchemaArtifact` is exactly the versioned
  contract reference ..., the `editor_manifest`, the `renderer_manifest`, the `compiler_version` and the
  deterministic `artifact_hash`"; "an artifact is only ever the compiler's output"); :2257-2269 compile rules
  name fields, relations and bindings only.
- `decisions.md`: no DEC mentions renderer-manifest block compatibility (grep "renderer", "block compat",
  "incompatible block": none). Session log `.memory/pipeline/progress/sessions/2026-09-26.md:233` records
  that the Worker digest helper left the policy injected ("a route must still resolve and supply the
  compatibility policy"); `apps/worker/src/cms-composition/block-registry-digest.ts:39-51` takes
  `isCompatible` as a callback and no production module imports the helper (grep: test file only). The SQL
  comment of 2026-10-04 is the policy's only source.

## 3. Can real template creation with a block slot succeed today? No.

- Under `cms_template_block_digest` every compatible type's active artifact must list the block; compiled
  artifacts never carry `blocks`/`blockDefinitions` (section 1c). Any non-empty `allowedBlocks` over a
  compiled, activated type is `VALIDATION_FAILED`. The same holds for the pattern WIP (section 1b).
- Non-empty `allowedBlocks` appear in exactly three suites (grep): 
  - `supabase/tests/phase_02_slice_12_template_authority.sql:145` (structural validator call only) and
    `:596` (real RPC) over a HAND-INSERTED artifact `:562-573`: `renderer_manifest = {"blocks":[{"blockKey":
    "profile.header","blockVersion":1}]}`, `editor_manifest '{}'`, `compiler_version 's12-test'`, type and
    version raw-activated `:574-585`; the block row is raw-inserted with `compatibility_range '{}'`
    (`:521-531,:538`). The oracle `:618-620` ("rejects a registered block absent from the active type
    renderer") asserts the invented rule.
  - `supabase/tests/phase_02_slice_11_criteria_publish_gates.sql:50` and
    `supabase/tests/phase_02_slice_11_helpers/003-registry.sqlinc:88`: raw inserts into
    `cms_template_versions`, bypassing `cms_define_template`; blocks raw-inserted with
    `compatibility_range '{}'` (`003-registry.sqlinc:22`).
- Every suite that creates templates through the real RPC over real compiled chains uses `slots: []`:
  `supabase/tests/phase_02_slice_12_governed_submit/000-fixtures.sqlinc:45-50`; `review-governed-fix.md:208-213`
  (F7) confirms no non-empty template digest passes through the governed recompute in any S12 suite.
- The pattern-def lane could only pass by cloning real chain types and overwriting `renderer_manifest` raw
  (`supabase/tests/phase_02_slice_12_pattern_definition/000-fixtures.sqlinc:67-72` `s12pd_block_manifest`,
  `:108` raw artifact insert). Its `s12pd_chain_types` (real chains) are not compatible with any block.
- The hand-inserted manifest shape `{blockKey, blockVersion}` lacks the `lifecycle` key that 03a's own
  `cms_block_reference_valid` requires (`20260902080000:573-580`): a real 03a activation would refuse the very
  manifest the 03c check demands. The two readers of the member disagree on its shape, which is further
  evidence that no shared contract exists.
- Worker: `apps/worker/src/cms-composition/template-routes.ts` and `pattern-definition-routes.ts` contain no
  compatibility logic (grep); the Worker delegates to SQL. No Worker mismatch.

## 4. Conclusion

**(B) The spec defines block compatibility and the check is wrong.**

- Spec definition (sections 2b, 2c): a block B is compatible with content type T when B is registered
  (`state = 'registered'`), B's lifecycle is not withdrawn (templates: is `supported`), and B's
  `compatibility_range` covers the `compiler_version` of the schema artifact of T's active version
  (BE03a :1098-1101, :2761; BE03c :209, :1567; IA deep dive :227, :400). Nothing in any spec makes a
  compiled renderer manifest the allowlist of blocks a type supports, and BE03a :2246-2255 plus the AC-007
  oracle forbid adding members to the compiled artifact.
- Must the CMS-03A compiler write `blocks`? **No.** It would (i) contradict BE03a :2246-2255 and the
  reviewed oracle `p241_ac007_artifact_compile.sql:76-77`, (ii) change every artifact hash and
  `definition_hash` (hash composed over the manifest, `20261010166000:229-246`), breaking the S09 parity
  suites (`phase_02_slice_09_create_draft_parity*.sql`) and the drift guard `20261005018400:131`, and
  (iii) have no input: the type definition has no block member (BE03a :786-801), so any list would be
  fabricated.
- The correct check (replace the manifest EXISTS in `cms_template_block_digest` `20260927240000:54-83` and
  in `cms_pattern_blocks_compatible` `020300:118-148`): for each distinct reachable block B (nested
  patterns included) and each T in `compatibleTypeIds`:
  1. T is an active owner type with an active version V whose artifact A satisfies
     `A.id = V.schema_artifact_id and A.content_type_version_id = V.id` (already selected at `:55-66`);
  2. B is `registered`, lifecycle per 2c (already `:36-53`);
  3. `B.compatibility_range` has `minSchemaCompiler` and `maxSchemaCompiler`, both registry-valid, and
     `min <= A.compiler_version <= max`; a range missing either key fails closed (`VALIDATION_FAILED`).
  Comparison rule over the closed registry `{'1','1.0','1.0.0','1.9'}`: dotted-numeric ordering
  (1 = 1.0 = 1.0.0 < 1.9). This is an implementation decision (decision-classification rule); it is not
  spelled out by BE03a and should be stated in the fix lane's report.
- Forward fix and owner: one forward migration (Slice 12, template-authority owner; the pattern mirror in
  the pattern-def WIP `020300`) replacing the two functions; 03a untouched; no contract change (the safe
  record stays without `compatibilityRange`, AC-145). RED first: a block whose range excludes `'1'` refused
  422 over a REAL compiled chain; a block whose range covers `'1'` admitted over a real compiled chain with
  no hand-inserted manifest (the first real-chain block-bearing template and pattern tests in the repo);
  deprecated per 2c.
- Oracle corrections this implies (independent review required, lane rules "Test corrections"):
  `phase_02_slice_12_template_authority.sql:618-620` asserts the unspecified rule and must become a
  compiler-range refusal; the raw block fixtures with `compatibility_range '{}'`
  (`template_authority.sql:538`, `003-registry.sqlinc:22`, pattern-def `045`/`000` fixtures) need real
  ranges; the pattern-def manifest variants (`000-fixtures.sqlinc:128-137`, `047-block-compat.sqlinc`)
  become range variants; the comment `20261013300400:133` becomes stale (cannot be edited; note in the fix
  migration).

## Files

Report (this file): `docs/handoffs/2026-10-14-claude-s12/review-blockcompat.md` (SHA-256 in the final
message). Evidence read, with SHA-256 at the time of reading:

| Path | Lines | SHA-256 |
| --- | --- | --- |
| supabase/migrations/20260927200000_cms_template_authority.sql | 530 | 8ad2e9bea144c652e2b23868a8c7ed3c2d50a36fe29ad70790537a92711d7a8b |
| supabase/migrations/20260927240000_cms_template_digest_supported_lifecycle.sql | 101 | ac3bcfe11836045a32128bc2e3463df00d915e5d820474cf125a4600bd94f3be |
| supabase/migrations/20260902080000_content_schema_registry_authority.sql | — | 4bf6f9fb91950f62b2bfc06fdabc3df4ad1edcfcca440eac3318f34f509ed087 |
| supabase/migrations/20261010166000_cms_create_type_draft_single_compile.sql | — | 50b3f336043145f2848a2977ca757744cf17adf5e7428a0b024b3f4899b4eee3 |
| supabase/migrations/20261013300400_cms_governed_frozen_status.sql | — | 979d1e8150d027c87adb0a9af3be4a0370d0a08cee296aa824d01eabbaaa6059 |
| supabase/migrations/20260927320000_cms_template_designer_context.sql | — | fa257f536841ef652bf45133e8fe8f54b68cfaf896a1b319a67762e95f44fb2b |
| supabase/migrations-wip/pattern-def/20261014020300_cms_pattern_graph_helpers.sql | 195 | a14dcc2ff1859ae6ca24f038138cbd71ca505c6d5acfa2756e7a2134f554c965 |
| supabase/migrations-wip/pattern-def/20261014020400_cms_create_pattern_version.sql | 293 | eb548000b71e83d32c45ff61f99c9a76ad2ccf488edbc37d55c3f992a007764b |
| supabase/tests/phase_02_slice_12_template_authority.sql | — | 6bad18fa1c9923b94c6fa562206f935868f92cb67567b1fffd6dc7020aeea9c2 |
| supabase/tests/phase_02_slice_09_p241_ac007_artifact_compile.sql | — | b9d82d087333aa23a16ce4ff1c4b54195b76dc323910e4211b2826bdf4ec1e4b |
| supabase/tests/phase_02_slice_12_pattern_definition/000-fixtures.sqlinc | 200 | d1c1c073c29bb48601cba1fea3ccdf730cc910a22013cfc95ba9e15030a61500 |
| supabase/tests/phase_02_slice_12_governed_submit/000-fixtures.sqlinc | — | 3b25ff67e2a0a9fc309b78a79e4efbf2969b5db398e058fef2860831297380c5 |
| .memory/wiki/specs/be/03a-content-schema-registry.md | 2919 | 7bf7bba80d9a01094d64e9055e4744332e84a19723376d484247576637c250f5 |
| .memory/wiki/specs/be/03c-composition-taxonomy-localization.md | 1710 | f202ee7d8840752f25397db3e02f51e5b7d664ef222bc8582fa5824bccdcc9b6 |
| .memory/wiki/specs/ia/03-cms-content-modeling.md | 617 | a087fce3289c8a95b9bc5dc5eb15af9d4e03396e5134c92abf8e624f0ee782cb |
| .memory/wiki/specs/ia/deep-dives/03-cms-content-modeling.md | — | a6cbab5bdd5cda7d5a34475427bc7a600e2cf7df82d2fa2a06e8039eeaed0950 |
| .memory/wiki/specs/fe/03-cms-content-modeling.md | 2857 | 0e1a903e83b40e8e848318c7801b9e872401728b42db4e208c1727a5a60d21b1 |

Also read (no hash recorded): `20260927230000_*`, `20261002210000_*`, `20260927220000_*`,
`20261002132000_*`, `20260930161000_*`, `20261002122500_*`, `20261005012000_*`, `20261005018400_*`,
`20261013300300_*`, `20261003130600_*`, `20261002126000_*`, `20261002164000_*`;
`phase_02_slice_09_r3_activation_gates.sql`, `phase_02_slice_09_p240_reads_detail.sql`,
`phase_02_slice_11_criteria_publish_gates.sql`, `phase_02_slice_11_helpers/003-registry.sqlinc`,
`phase_02_slice_12_fix/000-owners.sqlinc`, `phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc`,
`phase_02_slice_12_template_context.sql`; `apps/worker/src/cms-composition/block-registry-digest.ts`;
`packages/contracts/src/content-schema-registry/{resources-aggregates.ts,phase-02-slice-09-ac007-artifact-strict.test.ts}`;
`decisions.md` (DEC-108, DEC-113, DEC-186 and greps); `lane-pattern-def-report.md`, `review-pattern-def.md`
(F3), `review-governed-fix.md` (F7), `CLAUDE-STATE.md:94-100`, `s12-breakdown.md:100-112`,
`sessions/2026-09-26.md:232-248`, `slices/phase-02-slice-09.md:523,526,611`, `slices/phase-02-slice-12.md`
(AC-001, AC-022..025, AC-194; no AC states a renderer-manifest rule).

## Runs

None (read-only brief; no DB, no tests).

## Test corrections

None made (read-only). Required corrections are listed in section 4 for the fix lane and independent review.

## Spec citations

BE03a :29, :86, :786-801, :1098-1101, :1772-1782, :1963, :2246-2255, :2257-2269, :2608, :2761.
BE03c :194-199, :209, :223-299, :301-330, :369-373, :396, :439, :462-472, :482, :1361, :1500,
:1514-1521, :1567, :1606, :1664-1666 (Open Questions: none). IA03 :38, :44-46, :59, :65-66, :491.
IA deep dive :227, :252-260, :400. FE03 :883, :1066, :2093. DEC-108, DEC-113, DEC-186 (none defines a
renderer-manifest block rule). Tracker: P2-S09-AC-007/010/095/145, P2-S12-AC-001/022-025/194.

## Open items / BOUNDARY

- Not a BOUNDARY: the compatibility input exists in the spec (section 2b). Two implementation-level details
  are unspecified and should be stated, not escalated: (1) the ordering of the closed schema-compiler
  registry (`'1','1.0','1.0.0','1.9'`) for the range test — recommend dotted-numeric; (2) whether a block
  registered before a stricter range rule with `compatibility_range` lacking keys is admissible — recommend
  fail closed (the real producer always writes both keys, `20260902080000:954-958`; only raw fixtures
  write `'{}'`).
- Tension to record, not a blocker: P2-S12-AC-194 / BE03c :303-309 ("03c consumes only the safe
  BlockDefinitionRegistryRecord") versus BE03a :2761 ("expose ... compatibility ranges" to 03c). The safe
  record is the browser/Worker projection (AC-145 oracle); the compatibility test runs DB-side inside
  `platform_private` over 03a's table, exactly as the digest already reads `release_digest`,
  `props_schema_hash` and `renderer_ref` from the full row. Recommend root record this reading in the fix
  lane's spec citations; no contract or AC change needed.
- Out of scope, observed: `cms_template_designer_context` lists only blocks with `owner_id = acting party`
  (`20260927320000:68`), while AC-145 treats blocks as platform registry records visible to every
  organization; a real release-registered block may therefore be absent from a tenant designer's context.
  Separate question for root; it does not affect the SQL producers.

## Requests to root

1. Rule (B): replace the renderer-manifest predicate in `cms_template_block_digest` (forward migration; the
   applied `20260927240000` body is immutable) and in the pattern-def WIP `cms_pattern_blocks_compatible`
   (`020300:110-152`) with the schema-compiler range test of section 4; keep the lifecycle rules of 2c.
   Do not ask the Slice 09 compiler to emit `blocks`.
2. Assign the oracle corrections of section 4 (template_authority `:618-620`, raw block fixtures'
   `compatibility_range`, pattern-def `047`/`000` variants) to the fix lane with independent review; the
   first real-chain block-bearing template and pattern tests should be RED before the fix.
3. Record the two implementation decisions (registry ordering; fail-closed on a key-less range) and the
   AC-194/BE03a :2761 reading in the fix lane report, and consider a DEC entry so the 2026-10-04 SQL comment
   stops being the only written policy.
4. Optional follow-up: the designer-context owner filter (`20260927320000:68`) versus AC-145.

VERDICT: B
