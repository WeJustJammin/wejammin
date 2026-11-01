# Slice 12 criteria and spec wording batch: draft for owner ratification

Drafted 2026-10-12 on `claude/phase2-slice12` (stacked on `claude/phase2-slice11` at `5b7eee20`). Read-only draft: nothing in Sections 1 and 2 is applied. Section 0 lists the two rewordings DEC-176 already ratified and the cascade applied. Approve all items, or strike single ids from the checklist at the end.

How to read an item:

- CURRENT is the tracker text copied by script from the checkbox up to the first source link. For every Slice 12 item the plan line (`.memory/wiki/specs/phases/phase-2.md`) is checked for equality after link normalization (all items below: True).
- PROPOSED is CURRENT with exactly the DELTA fragments replaced, each asserted to occur once. Everything else is untouched.
- LOCKED TEXT IT MUST MATCH gives the line numbers in this tree (BE03c is `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, BE03b is `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`, resolved by script after the cascade edits).
- These are the existing-row wording defects of the setup report (section 9), plus two found by the cascade: AC010 (its success shape changed under DEC-175) and the Slice 10 AC030 pointer clause (G5).

## Rulings this batch rests on

| Ruling | Effect on this batch |
| --- | --- |
| DEC-155, DEC-172 | Precedent: defects in existing rows are not repaired in a cascade; they wait for an owner wording batch |
| DEC-175 | CMS-03C-02 answers `201 PatternPlacementResource` (an `items` list of 1-32 rows), which makes the AC010 text stale (W-08) |
| DEC-176 | AC026 and AC043 reworded and applied (Section 0); W-10 offers the fuller AC026 wording as an optional residual |
| DEC-180 | G5 (BE03b changed-path clause) is deliberately not applied by the cascade and sits in Section 2 |

## Section 0: applied by the cascade under DEC-176 (not for ratification)

Patterns apply to entry revisions only. IA03:46 and IA03:67, BE03c:90, BE03c:160 and BE03c:1441 were reworded in the same change.

### A-01 P2-S12-AC-026 (applied)

BEFORE (HEAD):

```text
- [ ] **P2-S12-AC-026** — Enforce CMS-03C-02: revisionId/patternId; UUIDs; revision/template draft readable and pattern immutable; 400/404.
```

APPLIED:

```text
- [ ] **P2-S12-AC-026** — Enforce CMS-03C-02: revisionId/patternId; UUIDs; entry revision readable and pattern immutable; 400/404.
```

### A-02 P2-S12-AC-043 (applied)

BEFORE (HEAD):

```text
- [ ] **P2-S12-AC-043** — CMS-12 Use reusable pattern: given Actor may edit the target entry revision or template draft, the referenced pattern version is immutable and readable, and the resulting block tree stays acyclic within the protected depth and count limits., implement locked behavior and completion exactly. Operations: CMS-03C-12 (pattern version create), CMS-03C-13 (pattern selector), CMS-03C-14 (update diff) and CMS-03C-15 (pattern update), BE03c ledger 25.03.03.
```

APPLIED:

```text
- [ ] **P2-S12-AC-043** — CMS-12 Use reusable pattern: given Actor may edit the target entry revision, the referenced pattern version is immutable and readable, and the resulting block tree stays acyclic within the protected depth and count limits., implement locked behavior and completion exactly. Operations: CMS-03C-12 (pattern version create), CMS-03C-13 (pattern selector), CMS-03C-14 (update diff) and CMS-03C-15 (pattern update), BE03c ledger 25.03.03.
```

## Section 1: Slice 12 criteria (not applied)

### W-01 P2-S12-AC-022 (DEC-155 precedent: key grammar, reserved keys and the (owner, key, version) triple)

CURRENT (tracker line, copied by script up to the source links):

```text
- [ ] **P2-S12-AC-022** — Enforce CMS-03C-01: templateKey/version; key /^[a-z][a-z0-9-]{1,63}$/; version positive integer; pair never reused; 422/409.
```

PROPOSED:

```text
- [ ] **P2-S12-AC-022** — Enforce CMS-03C-01: templateKey/version; key /^[a-z][a-z0-9-]{1,63}$/ and not a reserved key (`context`, `versions`, `new`); version positive integer; the (owner, key, version) triple never reused; first version `expectedVersion: null`, a successor names its parent's `version`; 422/409.
```

DELTA (exact fragments replaced):

```text
- key /^[a-z][a-z0-9-]{1,63}$/; version positive integer; pair never reused; 422/409.
+ key /^[a-z][a-z0-9-]{1,63}$/ and not a reserved key (`context`, `versions`, `new`); version positive integer; the (owner, key, version) triple never reused; first version `expectedVersion: null`, a successor names its parent's `version`; 422/409.
```

LOCKED TEXT IT MUST MATCH: BE03c:361 (E13 reserved keys, E14 per-owner uniqueness)

WHY: The row still says "pair never reused", but uniqueness is per owner (E14) and `context`, `versions` and `new` are refused (E13).

EFFECT: No code change; the contracts and migrations already follow BE03c. The evidence ledger row for AC022 must carry the new text.

### W-02 P2-S12-AC-025 (audience grammar E4)

CURRENT (tracker line, copied by script up to the source links):

```text
- [ ] **P2-S12-AC-025** — Enforce CMS-03C-01: bindings/locale/audience; strict binding manifest; BCP 47 locale; audience 1–64 safe chars; 422.
```

PROPOSED:

```text
- [ ] **P2-S12-AC-025** — Enforce CMS-03C-01: bindings/locale/audience; strict binding manifest; BCP 47 locale; audience `^[a-z0-9_-]{1,48}$` matched as submitted and never trimmed; 422.
```

DELTA (exact fragments replaced):

```text
- audience 1–64 safe chars; 422.
+ audience `^[a-z0-9_-]{1,48}$` matched as submitted and never trimmed; 422.
```

LOCKED TEXT IT MUST MATCH: BE03c:365 (E4, the BE04c audience grammar)

WHY: The matrix row fixes `^[a-z0-9_-]{1,48}$`; "1-64 safe chars" is a looser, different grammar.

EFFECT: No code change.

### W-03 P2-S12-AC-027 (pattern version must be active and compatible)

CURRENT (tracker line, copied by script up to the source links):

```text
- [ ] **P2-S12-AC-027** — Enforce CMS-03C-02: patternVersion/linkMode; positive version; linked or detached only; 422.
```

PROPOSED:

```text
- [ ] **P2-S12-AC-027** — Enforce CMS-03C-02: patternVersion/linkMode; positive version naming an `active` PatternVersion of that lineage whose `compatibleTypeIds` lists the revision's content type (else 422 `pattern_version_not_active` or `pattern_incompatible`); linked or detached only; 422.
```

DELTA (exact fragments replaced):

```text
- positive version; linked or detached only; 422.
+ positive version naming an `active` PatternVersion of that lineage whose `compatibleTypeIds` lists the revision's content type (else 422 `pattern_version_not_active` or `pattern_incompatible`); linked or detached only; 422.
```

LOCKED TEXT IT MUST MATCH: BE03c:367

WHY: The row omits the activity and compatibility refusals that the matrix and the typed refusal list state.

EFFECT: No code change.

### W-04 P2-S12-AC-030 (active vocabulary version and hierarchical parents)

CURRENT (tracker line, copied by script up to the source links):

```text
- [ ] **P2-S12-AC-030** — Enforce CMS-03C-03: taxonomyId/action; UUID; action create, rename, alias, deprecate, merge; 400/422.
```

PROPOSED:

```text
- [ ] **P2-S12-AC-030** — Enforce CMS-03C-03: taxonomyId/action; UUID (the vocabulary lineage id); the vocabulary must have an `active` TaxonomyVersion (else 409 `taxonomy_not_active`); action create, rename, alias, deprecate, merge; `parentId` other than null requires shape `hierarchical`; 400/422.
```

DELTA (exact fragments replaced):

```text
- UUID; action create, rename, alias, deprecate, merge; 400/422.
+ UUID (the vocabulary lineage id); the vocabulary must have an `active` TaxonomyVersion (else 409 `taxonomy_not_active`); action create, rename, alias, deprecate, merge; `parentId` other than null requires shape `hierarchical`; 400/422.
```

LOCKED TEXT IT MUST MATCH: BE03c:370

WHY: The matrix row adds the active-version precondition and the hierarchical-parent rule.

EFFECT: No code change.

### W-05 P2-S12-AC-034 (locale membership and fallback chain equality (OD-4))

CURRENT (tracker line, copied by script up to the source links):

```text
- [ ] **P2-S12-AC-034** — Enforce CMS-03C-04: fields/fallbackChain; 1–128 field IDs/values; only localizable fields; ordered BCP 47 list ≤16, explicit no_fallback; 422.
```

PROPOSED:

```text
- [ ] **P2-S12-AC-034** — Enforce CMS-03C-04: fields/fallbackChain; 1–128 field IDs/values; only localizable fields; `locale` a member of the active version's `supportedLocales`; `fallbackChain` ≤16 tags that equal the active version's chain for `locale` as an equality expectation (any difference 409 `FALLBACK_CHAIN_MISMATCH`); explicit no_fallback; 422.
```

DELTA (exact fragments replaced):

```text
- ordered BCP 47 list ≤16, explicit no_fallback; 422.
+ `locale` a member of the active version's `supportedLocales`; `fallbackChain` ≤16 tags that equal the active version's chain for `locale` as an equality expectation (any difference 409 `FALLBACK_CHAIN_MISMATCH`); explicit no_fallback; 422.
```

LOCKED TEXT IT MUST MATCH: BE03c:374

WHY: OD-4 made the chain an equality expectation, not an authoring input.

EFFECT: No code change.

### W-06 P2-S12-AC-036 (pin and exclusion target eligibility (D11))

CURRENT (tracker line, copied by script up to the source links):

```text
- [ ] **P2-S12-AC-036** — Enforce CMS-03C-05: pins/exclusions; pin UUID array ≤32, exclusion UUID array ≤64, de-duplicated; exclusions win; 422.
```

PROPOSED:

```text
- [ ] **P2-S12-AC-036** — Enforce CMS-03C-05: pins/exclusions; pin UUID array ≤32, exclusion UUID array ≤64, de-duplicated; exclusions win; every pin is an eligible target and every exclusion an existing readable entry, and an ineligible, hidden or absent target is the one uniform 422 `related_target_ineligible`; 422.
```

DELTA (exact fragments replaced):

```text
- de-duplicated; exclusions win; 422.
+ de-duplicated; exclusions win; every pin is an eligible target and every exclusion an existing readable entry, and an ineligible, hidden or absent target is the one uniform 422 `related_target_ineligible`; 422.
```

LOCKED TEXT IT MUST MATCH: BE03c:376

WHY: The matrix row adds the eligibility rule and the uniform refusal.

EFFECT: No code change.

### W-07 P2-S12-AC-037 (derived rule registry (OD-5))

CURRENT (tracker line, copied by script up to the source links):

```text
- [ ] **P2-S12-AC-037** — Enforce CMS-03C-05: derivedRule; strict bounded rule or null; explainable key/version, no arbitrary query/expression; 422.
```

PROPOSED:

```text
- [ ] **P2-S12-AC-037** — Enforce CMS-03C-05: derivedRule; strict bounded rule or null; `key` a member of the code-owned rule registry (`shared-terms`, `same-type-recent`), `version` its registered version, `reasonCode` an equality expectation of the registry value, `maxCandidates` 1–128 (an unknown key or version is 422 `derived_rule_unknown`); no arbitrary query/expression; 422.
```

DELTA (exact fragments replaced):

```text
- strict bounded rule or null; explainable key/version, no arbitrary query/expression; 422.
+ strict bounded rule or null; `key` a member of the code-owned rule registry (`shared-terms`, `same-type-recent`), `version` its registered version, `reasonCode` an equality expectation of the registry value, `maxCandidates` 1–128 (an unknown key or version is 422 `derived_rule_unknown`); no arbitrary query/expression; 422.
```

LOCKED TEXT IT MUST MATCH: BE03c:377

WHY: The matrix row names the code-owned registry and the typed refusal.

EFFECT: No code change.

### W-08 P2-S12-AC-010 (DEC-175 consequence: the CMS-03C-02 success shape)

CURRENT (tracker line, copied by script up to the source links):

```text
- [ ] **P2-S12-AC-010** — CMS-03C-02: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03C-02 — CMS-12 — POST /api/v1/cms/compositions/pattern-instances — PatternInstanceRequest → 201 CompositionInstanceResource.
```

PROPOSED:

```text
- [ ] **P2-S12-AC-010** — CMS-03C-02: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03C-02 — CMS-12 — POST /api/v1/cms/compositions/pattern-instances — PatternInstanceRequest → 201 PatternPlacementResource.
```

DELTA (exact fragments replaced):

```text
- PatternInstanceRequest → 201 CompositionInstanceResource.
+ PatternInstanceRequest → 201 PatternPlacementResource.
```

LOCKED TEXT IT MUST MATCH: BE03c:160, 1343 (the route registry row and the placement paragraph)

WHY: DEC-175 (owner, 2026-10-12) makes the CMS-03C-02 success an `items` list, one row per block root of the pinned pattern, and DEC-181 (owner, 2026-10-12) expands a top-level nested pattern reference into its own block roots, so the list holds one or more rows bounded by the 512-node cap after expansion; AC010 still names the single-resource shape.

EFFECT: No code change beyond the DEC-175 implementation. The AC010 evidence must prove the list shape.

### W-09 Citations of AC022-AC039 and AC004-AC021 (source suffix only)

Two citation defects, each applied by the same fragment replacement to every row listed (the criterion text is untouched).

1. P2-S12-AC-022 through AC-039 (18 rows) cite `§Request/Response Contracts validation table at line 148`. The table is `BE03c:361` through `BE03c:399` (heading `Route field validation matrix`).

```text
- §Request/Response Contracts validation table at line 148
+ §Route field validation matrix
```

2. P2-S12-AC-004 through AC-021 (18 rows) cite `§§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy`. The headings in BE03c are `Error Handling` (BE03c:1551) and `Testing Strategy` (BE03c:1578).

```text
- §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
+ §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling, Testing Strategy
```

EFFECT: citation text only; the rows keep their ids and meaning. The IA, FE and BE sources of the other rows are unchanged.

### W-10 P2-S12-AC-026 (optional residual: the fuller AC026 wording (setup report section 9))

CURRENT (tracker line, copied by script up to the source links):

```text
- [ ] **P2-S12-AC-026** — Enforce CMS-03C-02: revisionId/patternId; UUIDs; entry revision readable and pattern immutable; 400/404.
```

PROPOSED:

```text
- [ ] **P2-S12-AC-026** — Enforce CMS-03C-02: revisionId/patternId; UUIDs; `revisionId` is the entry's current draft revision (effective state `draft`, else 409 `revision_not_editable`) readable by the caller; `patternId` a lineage id of the caller's owner scope; 400/404.
```

DELTA (exact fragments replaced):

```text
- UUIDs; entry revision readable and pattern immutable; 400/404.
+ UUIDs; `revisionId` is the entry's current draft revision (effective state `draft`, else 409 `revision_not_editable`) readable by the caller; `patternId` a lineage id of the caller's owner scope; 400/404.
```

LOCKED TEXT IT MUST MATCH: BE03c:366

WHY: DEC-176 only removed "template draft". The matrix row also fixes the current-draft-revision rule and the lineage id of `patternId`; this item is optional and builds on the Section 0 text.

EFFECT: No code change.

## Section 2: G5, the CMS-03B-01 changed-path clause (Slice 10 AC030, not applied)

Why this is an owner item: BE03b:251 and BE03b:1543 say a `/blocks/...` changed path is refused "until a composition write path exists", and Slice 10 AC030 (ratified under DEC-147 option C) carries the same clause. Slice 12 ships that write path (CMS-03C-02, CMS-03C-15), yet DEC-180 (G5) keeps refusing `/blocks/...` as `changedPaths`: composition is written only by those two commands under the entry aggregate `version`, and comparison reports it. The clause must say so, which changes ratified criterion text, so the cascade did not apply it and changed no BE03b line.

### G5-01 P2-S10-AC-030 (Slice 10 tracker and plan)

CURRENT:

```text
- [ ] **P2-S10-AC-030** — Enforce CMS-03B-01: changedPaths; 1–128 unique JSON Pointers, each `/fields/{stableFieldId}` (lowercase UUID, 44 characters; every field kind including relation); `/blocks/...` and every other pointer is refused until a composition write path exists; 422. Relation changes are keyed by stable field ID rather than version-specific relation-definition ID.
```

PROPOSED:

```text
- [ ] **P2-S10-AC-030** — Enforce CMS-03B-01: changedPaths; 1–128 unique JSON Pointers, each `/fields/{stableFieldId}` (lowercase UUID, 44 characters; every field kind including relation); `/blocks/...` and every other pointer is refused (composition changes are written only by CMS-03C-02 and CMS-03C-15 under the entry aggregate `version` and are reported by comparison, never accepted as `changedPaths`); 422. Relation changes are keyed by stable field ID rather than version-specific relation-definition ID.
```

DELTA:

```text
- `/blocks/...` and every other pointer is refused until a composition write path exists; 422.
+ `/blocks/...` and every other pointer is refused (composition changes are written only by CMS-03C-02 and CMS-03C-15 under the entry aggregate `version` and are reported by comparison, never accepted as `changedPaths`); 422.
```

### G5-02 BE03b:251 (CMS-03B-01 `changedPaths`, field validation matrix cell)

```text
- `/blocks/...` and every other pointer is refused until a composition write path exists
+ `/blocks/...` and every other pointer is refused (composition changes are written only by CMS-03C-02 and CMS-03C-15 under the entry aggregate `version` and are reported by comparison, never accepted as `changedPaths`)
```

### G5-03 BE03b:1543 (`Pointers` bullet)

```text
- `/blocks/…` is refused by CMS-03B-01 until a composition write path exists (03c owns composition writes);
+ `/blocks/…` is refused by CMS-03B-01 (03c owns composition writes: CMS-03C-02 and CMS-03C-15 write them under the entry aggregate `version`, and they are reported by comparison, never accepted as `changedPaths`);
```

LOCKED TEXT IT MUST MATCH: BE03c:1343 (DEC-175 placement), BE03c CMS-03C-15 `accept` and `detach` (the entry `version` as `If-Match`).

EFFECT: no code change; the refusal already exists. The Slice 10 evidence for AC030 must be regenerated with the new text.

## Checklist (strike ids to exclude)

- [ ] W-01 AC022
- [ ] W-02 AC025
- [ ] W-03 AC027
- [ ] W-04 AC030
- [ ] W-05 AC034
- [ ] W-06 AC036
- [ ] W-07 AC037
- [ ] W-08 AC010
- [ ] W-09 citations of AC022-AC039 and AC004-AC021
- [ ] W-10 AC026 residual (optional)
- [ ] G5-01 Slice 10 AC030, G5-02 BE03b:251, G5-03 BE03b:1543
