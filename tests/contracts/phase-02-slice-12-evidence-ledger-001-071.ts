import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 12 evidence ledger, criteria AC001-AC071. Aggregated by
// tests/contracts/phase-02-slice-12-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-12-evidence-guard.test.ts.
export const S12_EVIDENCE_LEDGER_001_071: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S12-AC-001',
    text: 'Preserve reserved profile and provenance regions, block compatibility, audience and locale constraints, and accessibility contracts in templates.',
    clauses: [
      {
        text: 'Preserve reserved profile and provenance regions, block compatibility, audience and locale constraints, and accessibility contracts in templates.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-002',
    text: 'Reject cyclic or over-limit composition trees and retain immutable reusable-pattern versions.',
    clauses: [
      {
        text: 'Reject cyclic or over-limit composition trees and retain immutable reusable-pattern versions.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-003',
    text: 'Keep taxonomy keys stable, hierarchies acyclic, merges survivor-directed, assignments convergent, and redirects intact.',
    clauses: [
      {
        text: 'Keep taxonomy keys stable, hierarchies acyclic, merges survivor-directed, assignments convergent, and redirects intact.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-004',
    text: 'CMS-03C-01: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03C-01 — CMS-11 — POST /api/v1/cms/templates/versions — TemplateVersionRequest → 201 TemplateVersionResource.',
    clauses: [
      {
        text: 'CMS-03C-01: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03C-01 — CMS-11 — POST /api/v1/cms/templates/versions — TemplateVersionRequest → 201 TemplateVersionResource.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-005',
    text: 'CMS-03C-01: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
    clauses: [
      {
        text: 'CMS-03C-01: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-006',
    text: 'CMS-03C-01: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
    clauses: [
      {
        text: 'CMS-03C-01: derive actor and acting context server-side;',
        citations: [],
      },
      {
        text: 'enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-007',
    text: 'CMS-03C-01: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03C-01: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-008',
    text: 'CMS-03C-01: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
    clauses: [
      {
        text: 'CMS-03C-01: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-009',
    text: 'CMS-03C-01: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03C-01: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-010',
    text: 'CMS-03C-02: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03C-02 — CMS-12 — POST /api/v1/cms/compositions/pattern-instances — PatternInstanceRequest → 201 PatternPlacementResource.',
    clauses: [
      {
        text: 'CMS-03C-02: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03C-02 — CMS-12 — POST /api/v1/cms/compositions/pattern-instances — PatternInstanceRequest → 201 PatternPlacementResource.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-011',
    text: 'CMS-03C-02: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
    clauses: [
      {
        text: 'CMS-03C-02: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-012',
    text: 'CMS-03C-02: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
    clauses: [
      {
        text: 'CMS-03C-02: derive actor and acting context server-side;',
        citations: [],
      },
      {
        text: 'enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-013',
    text: 'CMS-03C-02: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03C-02: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-014',
    text: 'CMS-03C-02: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
    clauses: [
      {
        text: 'CMS-03C-02: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-015',
    text: 'CMS-03C-02: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03C-02: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-016',
    text: 'CMS-03C-03: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03C-03 — CMS-14 — POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions — TaxonomyTermActionRequest → 200 TaxonomyTermResource.',
    clauses: [
      {
        text: 'CMS-03C-03: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03C-03 — CMS-14 — POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions — TaxonomyTermActionRequest → 200 TaxonomyTermResource.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-017',
    text: 'CMS-03C-03: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
    clauses: [
      {
        text: 'CMS-03C-03: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-018',
    text: 'CMS-03C-03: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
    clauses: [
      {
        text: 'CMS-03C-03: derive actor and acting context server-side;',
        citations: [],
      },
      {
        text: 'enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-019',
    text: 'CMS-03C-03: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03C-03: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-020',
    text: 'CMS-03C-03: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
    clauses: [
      {
        text: 'CMS-03C-03: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-021',
    text: 'CMS-03C-03: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03C-03: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-022',
    text: "Enforce CMS-03C-01: templateKey/version; key /^[a-z][a-z0-9-]{1,63}$/ and not a reserved key (`context`, `versions`, `new`); version positive integer; the (owner, key, version) triple never reused; first version `expectedVersion: null`, a successor names its parent's `version`; 422/409.",
    clauses: [
      { text: 'Enforce CMS-03C-01: templateKey/version;', citations: [] },
      {
        text: 'key /^[a-z][a-z0-9-]{1,63}$/ and not a reserved key (`context`, `versions`, `new`);',
        citations: [],
      },
      { text: 'version positive integer;', citations: [] },
      { text: 'the (owner, key, version) triple never reused;', citations: [] },
      {
        text: "first version `expectedVersion: null`, a successor names its parent's `version`;",
        citations: [],
      },
      { text: '422/409.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-023',
    text: 'Enforce CMS-03C-01: compatibleTypeIds; 1–64 UUIDs, each active/allowlisted ContentTypeVersion family; 422.',
    clauses: [
      { text: 'Enforce CMS-03C-01: compatibleTypeIds;', citations: [] },
      {
        text: '1–64 UUIDs, each active/allowlisted ContentTypeVersion family;',
        citations: [],
      },
      { text: '422.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-024',
    text: 'Enforce CMS-03C-01: slots/reservedRegions; strict JSON manifests; ≤64 slots, ≤32 reserved names; fixed Shard 02 Header→Now→Record→Detail/provenance regions immutable; 422.',
    clauses: [
      { text: 'Enforce CMS-03C-01: slots/reservedRegions;', citations: [] },
      { text: 'strict JSON manifests;', citations: [] },
      { text: '≤64 slots, ≤32 reserved names;', citations: [] },
      {
        text: 'fixed Shard 02 Header→Now→Record→Detail/provenance regions immutable;',
        citations: [],
      },
      { text: '422.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-025',
    text: 'Enforce CMS-03C-01: bindings/locale/audience; strict binding manifest; BCP 47 locale; audience `^[a-z0-9_-]{1,48}$` matched as submitted and never trimmed; 422.',
    clauses: [
      { text: 'Enforce CMS-03C-01: bindings/locale/audience;', citations: [] },
      { text: 'strict binding manifest;', citations: [] },
      { text: 'BCP 47 locale;', citations: [] },
      {
        text: 'audience `^[a-z0-9_-]{1,48}$` matched as submitted and never trimmed;',
        citations: [],
      },
      { text: '422.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-026',
    text: "Enforce CMS-03C-02: revisionId/patternId; UUIDs; `revisionId` is the entry's current draft revision (effective state `draft`, else 409 `revision_not_editable`) readable by the caller; `patternId` a lineage id of the caller's owner scope; 400/404.",
    clauses: [
      { text: 'Enforce CMS-03C-02: revisionId/patternId;', citations: [] },
      { text: 'UUIDs;', citations: [] },
      {
        text: "`revisionId` is the entry's current draft revision (effective state `draft`, else 409 `revision_not_editable`) readable by the caller;",
        citations: [],
      },
      {
        text: "`patternId` a lineage id of the caller's owner scope;",
        citations: [],
      },
      { text: '400/404.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-027',
    text: "Enforce CMS-03C-02: patternVersion/linkMode; positive version naming an `active` PatternVersion of that lineage whose `compatibleTypeIds` lists the revision's content type (else 422 `pattern_version_not_active` or `pattern_incompatible`); linked or detached only; 422.",
    clauses: [
      { text: 'Enforce CMS-03C-02: patternVersion/linkMode;', citations: [] },
      {
        text: "positive version naming an `active` PatternVersion of that lineage whose `compatibleTypeIds` lists the revision's content type (else 422 `pattern_version_not_active` or `pattern_incompatible`);",
        citations: [],
      },
      { text: 'linked or detached only;', citations: [] },
      { text: '422.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-028',
    text: 'Enforce CMS-03C-02: slotPath/overrides; normalized path 1–512 chars; strict overrides max 64 keys/8 depth; 422.',
    clauses: [
      { text: 'Enforce CMS-03C-02: slotPath/overrides;', citations: [] },
      { text: 'normalized path 1–512 chars;', citations: [] },
      { text: 'strict overrides max 64 keys/8 depth;', citations: [] },
      { text: '422.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-029',
    text: 'Enforce CMS-03C-02: graph; no cycles; max protected depth/nodes; all blocks registered and compatible; 409/422.',
    clauses: [
      { text: 'Enforce CMS-03C-02: graph;', citations: [] },
      { text: 'no cycles;', citations: [] },
      { text: 'max protected depth/nodes;', citations: [] },
      { text: 'all blocks registered and compatible;', citations: [] },
      { text: '409/422.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-030',
    text: 'Enforce CMS-03C-03: taxonomyId/action; UUID (the vocabulary lineage id); the vocabulary must have an `active` TaxonomyVersion (else 409 `taxonomy_not_active`); action create, rename, alias, deprecate, merge; `parentId` other than null requires shape `hierarchical`; 400/422.',
    clauses: [
      { text: 'Enforce CMS-03C-03: taxonomyId/action;', citations: [] },
      { text: 'UUID (the vocabulary lineage id);', citations: [] },
      {
        text: 'the vocabulary must have an `active` TaxonomyVersion (else 409 `taxonomy_not_active`);',
        citations: [],
      },
      {
        text: 'action create, rename, alias, deprecate, merge;',
        citations: [],
      },
      {
        text: '`parentId` other than null requires shape `hierarchical`;',
        citations: [],
      },
      { text: '400/422.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-031',
    text: 'Enforce CMS-03C-03: termKey/labels; stable key /^[a-z][a-z0-9-]{1,63}$/; 1–64 localized labels; NFC; 422.',
    clauses: [
      { text: 'Enforce CMS-03C-03: termKey/labels;', citations: [] },
      { text: 'stable key /^[a-z][a-z0-9-]{1,63}$/;', citations: [] },
      { text: '1–64 localized labels;', citations: [] },
      { text: 'NFC;', citations: [] },
      { text: '422.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-032',
    text: 'Enforce CMS-03C-03: survivorId/parentId; UUID or null; required for merge/specified hierarchy; cannot be self/cyclic/merged; 422/409.',
    clauses: [
      { text: 'Enforce CMS-03C-03: survivorId/parentId;', citations: [] },
      { text: 'UUID or null;', citations: [] },
      { text: 'required for merge/specified hierarchy;', citations: [] },
      { text: 'cannot be self/cyclic/merged;', citations: [] },
      { text: '422/409.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-033',
    text: 'Enforce CMS-03C-04: entryId/locale/sourceRevisionId; UUID, BCP 47, UUID; source revision must exist and be readable; 400/404.',
    clauses: [
      {
        text: 'Enforce CMS-03C-04: entryId/locale/sourceRevisionId;',
        citations: [],
      },
      { text: 'UUID, BCP 47, UUID;', citations: [] },
      { text: 'source revision must exist and be readable;', citations: [] },
      { text: '400/404.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-034',
    text: "Enforce CMS-03C-04: fields/fallbackChain; 1–128 field IDs/values; only localizable fields; `locale` a member of the active version's `supportedLocales`; `fallbackChain` ≤16 tags that equal the active version's chain for `locale` as an equality expectation (any difference 409 `FALLBACK_CHAIN_MISMATCH`); explicit no_fallback; 422.",
    clauses: [
      { text: 'Enforce CMS-03C-04: fields/fallbackChain;', citations: [] },
      { text: '1–128 field IDs/values;', citations: [] },
      { text: 'only localizable fields;', citations: [] },
      {
        text: "`locale` a member of the active version's `supportedLocales`;",
        citations: [],
      },
      {
        text: "`fallbackChain` ≤16 tags that equal the active version's chain for `locale` as an equality expectation (any difference 409 `FALLBACK_CHAIN_MISMATCH`);",
        citations: [],
      },
      { text: 'explicit no_fallback;', citations: [] },
      { text: '422.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-035',
    text: 'Enforce CMS-03C-04: sourceHash/expectedVersion; 64 lowercase hex; positive decimal version; 422/409.',
    clauses: [
      {
        text: 'Enforce CMS-03C-04: sourceHash/expectedVersion;',
        citations: [],
      },
      { text: '64 lowercase hex;', citations: [] },
      { text: 'positive decimal version;', citations: [] },
      { text: '422/409.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-036',
    text: 'Enforce CMS-03C-05: pins/exclusions; pin UUID array ≤32, exclusion UUID array ≤64, de-duplicated; exclusions win; every pin is an eligible target and every exclusion an existing readable entry, and an ineligible, hidden or absent target is the one uniform 422 `related_target_ineligible`; 422.',
    clauses: [
      { text: 'Enforce CMS-03C-05: pins/exclusions;', citations: [] },
      {
        text: 'pin UUID array ≤32, exclusion UUID array ≤64, de-duplicated;',
        citations: [],
      },
      { text: 'exclusions win;', citations: [] },
      {
        text: 'every pin is an eligible target and every exclusion an existing readable entry, and an ineligible, hidden or absent target is the one uniform 422 `related_target_ineligible`;',
        citations: [],
      },
      { text: '422.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-037',
    text: 'Enforce CMS-03C-05: derivedRule; strict bounded rule or null; `key` a member of the code-owned rule registry (`shared-terms`, `same-type-recent`), `version` its registered version, `reasonCode` an equality expectation of the registry value, `maxCandidates` 1–128 (an unknown key or version is 422 `derived_rule_unknown`); no arbitrary query/expression; 422.',
    clauses: [
      { text: 'Enforce CMS-03C-05: derivedRule;', citations: [] },
      { text: 'strict bounded rule or null;', citations: [] },
      {
        text: '`key` a member of the code-owned rule registry (`shared-terms`, `same-type-recent`), `version` its registered version, `reasonCode` an equality expectation of the registry value, `maxCandidates` 1–128 (an unknown key or version is 422 `derived_rule_unknown`);',
        citations: [],
      },
      { text: 'no arbitrary query/expression;', citations: [] },
      { text: '422.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-038',
    text: 'Enforce CMS-03C-05: expectedVersion; positive decimal strong If-Match match; 400/409. The related-content public-target projection CMS-03C-21 (BE03c ledger 25.05.04) is owned here with the CMS-03C-05 command.',
    clauses: [
      { text: 'Enforce CMS-03C-05: expectedVersion;', citations: [] },
      { text: 'positive decimal strong If-Match match;', citations: [] },
      { text: '400/409.', citations: [] },
      {
        text: 'The related-content public-target projection CMS-03C-21 (BE03c ledger 25.05.04) is owned here with the CMS-03C-05 command.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-039',
    text: 'Enforce All: headers/body; JSON, raw body ≤256 KiB, Idempotency-Key 8–128 printable ASCII, unknown keys reject; 400/415/422.',
    clauses: [
      { text: 'Enforce All: headers/body;', citations: [] },
      {
        text: 'JSON, raw body ≤256 KiB, Idempotency-Key 8–128 printable ASCII, unknown keys reject;',
        citations: [],
      },
      { text: '400/415/422.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-040',
    text: 'CMS-11 Define template: given Actor holds the template designer capability, every referenced block version is registered and currently supported, and the target content types, locale/audience and reserved regions — including the Shard 02 fixed profile spine and provenance components — are declared and left intact., implement locked behavior and completion exactly. Operations: CMS-03C-06 (governed review submit), CMS-03C-07 (decision), CMS-03C-08 (reviewer assignment), CMS-03C-09 (activation), CMS-03C-10 (review detail), CMS-03C-11 (review queue) and CMS-03C-19 (governed scheduled-activation executor), BE03c ledger 25.03.02.',
    clauses: [
      {
        text: 'CMS-11 Define template: given Actor holds the template designer capability, every referenced block version is registered and currently supported, and the target content types, locale/audience and reserved regions — including the Shard 02 fixed profile spine and provenance components — are declared and left intact., implement locked behavior and completion exactly.',
        citations: [],
      },
      {
        text: 'Operations: CMS-03C-06 (governed review submit), CMS-03C-07 (decision), CMS-03C-08 (reviewer assignment), CMS-03C-09 (activation), CMS-03C-10 (review detail), CMS-03C-11 (review queue) and CMS-03C-19 (governed scheduled-activation executor), BE03c ledger 25.03.02.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-041',
    text: 'CMS-11 Define template: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-11 Define template: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-042',
    text: '`CMS-11` Define template: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-11` Define template: implement Native link/button/form;',
        citations: [],
      },
      {
        text: 'focus stays until navigation or named result heading;',
        citations: [],
      },
      {
        text: 'Server-derived actor/context/capability, valid Zod input, required ETag/idempotency;',
        citations: [],
      },
      {
        text: 'Render authoritative response/version/provenance/next action;',
        citations: [],
      },
      { text: 'announce status;', citations: [] },
      { text: 'Map exact `ApiError`;', citations: [] },
      { text: 'retain input;', citations: [] },
      { text: 'focus summary/field;', citations: [] },
      { text: 'reconcile unknown mutation before retry;', citations: [] },
      { text: 'URL for navigation/filter;', citations: [] },
      { text: 'scoped draft before commit;', citations: [] },
      { text: 'server after success.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-043',
    text: 'CMS-12 Use reusable pattern: given Actor may edit the target entry revision, the referenced pattern version is immutable and readable, and the resulting block tree stays acyclic within the protected depth and count limits., implement locked behavior and completion exactly. Operations: CMS-03C-12 (pattern version create), CMS-03C-13 (pattern selector), CMS-03C-14 (update diff) and CMS-03C-15 (pattern update), BE03c ledger 25.03.03.',
    clauses: [
      {
        text: 'CMS-12 Use reusable pattern: given Actor may edit the target entry revision, the referenced pattern version is immutable and readable, and the resulting block tree stays acyclic within the protected depth and count limits., implement locked behavior and completion exactly.',
        citations: [],
      },
      {
        text: 'Operations: CMS-03C-12 (pattern version create), CMS-03C-13 (pattern selector), CMS-03C-14 (update diff) and CMS-03C-15 (pattern update), BE03c ledger 25.03.03.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-044',
    text: 'CMS-12 Use reusable pattern: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-12 Use reusable pattern: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-045',
    text: '`CMS-12` Use reusable pattern: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-12` Use reusable pattern: implement Native link/button/form;',
        citations: [],
      },
      {
        text: 'focus stays until navigation or named result heading;',
        citations: [],
      },
      {
        text: 'Server-derived actor/context/capability, valid Zod input, required ETag/idempotency;',
        citations: [],
      },
      {
        text: 'Render authoritative response/version/provenance/next action;',
        citations: [],
      },
      { text: 'announce status;', citations: [] },
      { text: 'Map exact `ApiError`;', citations: [] },
      { text: 'retain input;', citations: [] },
      { text: 'focus summary/field;', citations: [] },
      { text: 'reconcile unknown mutation before retry;', citations: [] },
      { text: 'URL for navigation/filter;', citations: [] },
      { text: 'scoped draft before commit;', citations: [] },
      { text: 'server after success.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-046',
    text: 'CMS-14 Govern taxonomy term: given Actor holds the taxonomy curator capability for that specific editorial vocabulary, the term key is stable and the proposed hierarchy stays acyclic, canonical-taxonomy overlap has been checked, and a merge names a survivor whose counterpart is not already merged., implement locked behavior and completion exactly. Operations: CMS-03C-16 (taxonomy version create), CMS-03C-17 (taxonomy selector) and CMS-03C-18 (canonical-taxonomy overlap provider), BE03c ledger 25.05.01.',
    clauses: [
      {
        text: 'CMS-14 Govern taxonomy term: given Actor holds the taxonomy curator capability for that specific editorial vocabulary, the term key is stable and the proposed hierarchy stays acyclic, canonical-taxonomy overlap has been checked, and a merge names a survivor whose counterpart is not already merged., implement locked behavior and completion exactly.',
        citations: [],
      },
      {
        text: 'Operations: CMS-03C-16 (taxonomy version create), CMS-03C-17 (taxonomy selector) and CMS-03C-18 (canonical-taxonomy overlap provider), BE03c ledger 25.05.01.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-047',
    text: 'CMS-14 Govern taxonomy term: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-14 Govern taxonomy term: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-048',
    text: '`CMS-14` Govern taxonomy term: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-14` Govern taxonomy term: implement Native link/button/form;',
        citations: [],
      },
      {
        text: 'focus stays until navigation or named result heading;',
        citations: [],
      },
      {
        text: 'Server-derived actor/context/capability, valid Zod input, required ETag/idempotency;',
        citations: [],
      },
      {
        text: 'Render authoritative response/version/provenance/next action;',
        citations: [],
      },
      { text: 'announce status;', citations: [] },
      { text: 'Map exact `ApiError`;', citations: [] },
      { text: 'retain input;', citations: [] },
      { text: 'focus summary/field;', citations: [] },
      { text: 'reconcile unknown mutation before retry;', citations: [] },
      { text: 'URL for navigation/filter;', citations: [] },
      { text: 'scoped draft before commit;', citations: [] },
      { text: 'server after success.', citations: [] },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-049',
    text: 'Execute Contract → QA-RED → data, API, SSR and island implementation → QA-GREEN → refactor; retain failing-test evidence and run canonical validation.',
    clauses: [
      {
        text: 'Execute Contract → QA-RED → data, API, SSR and island implementation → QA-GREEN → refactor;',
        citations: [],
      },
      {
        text: 'retain failing-test evidence and run canonical validation.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-050',
    text: 'Update slice tracking, feature-ledger assignments, applicable runbooks, and architecture graph in the same change; leave no unresolved implementation boundary or undocumented drift.',
    clauses: [
      {
        text: 'Update slice tracking, feature-ledger assignments, applicable runbooks, and architecture graph in the same change;',
        citations: [],
      },
      {
        text: 'leave no unresolved implementation boundary or undocumented drift.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-051',
    text: 'Resolve a `no_fallback` field only from its own target-locale variant: it is never resolved through `fallbackChains` to `defaultLocale` or any other locale, and a missing target-locale value for a `no_fallback` field blocks publication of that locale and increments `cms_no_fallback_block_total` (DEC-121; received from Slice 09 AC005 and AC1166 under DEC-122, which own only the declaration and storage); resolved by CMS-03C-20 (shared locale field resolution and locale preflight provider, BE03c ledger 25.05.03).',
    clauses: [
      {
        text: 'Resolve a `no_fallback` field only from its own target-locale variant: it is never resolved through `fallbackChains` to `defaultLocale` or any other locale, and a missing target-locale value for a `no_fallback` field blocks publication of that locale and increments `cms_no_fallback_block_total` (DEC-121; received from Slice 09 AC005 and AC1166 under DEC-122, which own only the declaration and storage);',
        citations: [],
      },
      {
        text: 'resolved by CMS-03C-20 (shared locale field resolution and locale preflight provider, BE03c ledger 25.05.03).',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-052',
    text: 'Keep serving the last approved translation for a stale fallback-permitted locale field after its source changes (never resolving it through the fallback chain to the default locale and never blocking the locale), expose the stale state to editorial reads and `cms_locale_stale_total` until revalidation, and keep `no_fallback` fields blocking publication when their value is missing (DEC-121, DEC-122).',
    clauses: [
      {
        text: 'Keep serving the last approved translation for a stale fallback-permitted locale field after its source changes (never resolving it through the fallback chain to the default locale and never blocking the locale), expose the stale state to editorial reads and `cms_locale_stale_total` until revalidation, and keep `no_fallback` fields blocking publication when their value is missing (DEC-121, DEC-122).',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-053',
    text: 'Author template versions that declare compatibility with an existing content-type id through CMS-03C-01 `compatibleTypeIds` and keep every template binding consistent afterwards: a successor that binds a template through CMS-03A-09 resolves it through the compatibility resolver against the exact candidate, refuses an absent template with 404, a template that does not list the type id with 422 and a pointer, and a withdrawn template with 409, and never alters an already-active definition hash (DEC-123; the flows beyond the first-successor binding mechanics that Slice 09 delivers, received under DEC-122).',
    clauses: [
      {
        text: 'Author template versions that declare compatibility with an existing content-type id through CMS-03C-01 `compatibleTypeIds` and keep every template binding consistent afterwards: a successor that binds a template through CMS-03A-09 resolves it through the compatibility resolver against the exact candidate, refuses an absent template with 404, a template that does not list the type id with 422 and a pointer, and a withdrawn template with 409, and never alters an already-active definition hash (DEC-123; the flows beyond the first-successor binding mechanics that Slice 09 delivers, received under DEC-122).',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-054',
    text: 'CMS-03C-04 registers POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants with the strict `LocaleVariantRequest` (`entryId`, `locale`, `sourceRevisionId`, 1-128 `fields` of `fieldId` and `value`, `fallbackChain` of at most 16 tags, `noFallbackFieldIds` of at most 128, `sourceHash`, `expectedVersion`) and returns the strict `LocaleVariantResource` as 201 (`state` one of `untranslated`, `draft`, `review`, `approved`, `stale`; `entryId`, `revisionId`, `locale`, `sourceRevisionId`, `fallbackChain`, `noFallbackFieldIds` and `staleFieldIds`, which is empty unless `state` is `stale`); one transaction appends the target revision, its field values and the variant, the entry version, the audit record and the `cms.localization.changed.v1` outbox event; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-04 registers POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants with the strict `LocaleVariantRequest` (`entryId`, `locale`, `sourceRevisionId`, 1-128 `fields` of `fieldId` and `value`, `fallbackChain` of at most 16 tags, `noFallbackFieldIds` of at most 128, `sourceHash`, `expectedVersion`) and returns the strict `LocaleVariantResource` as 201 (`state` one of `untranslated`, `draft`, `review`, `approved`, `stale`; `entryId`, `revisionId`, `locale`, `sourceRevisionId`, `fallbackChain`, `noFallbackFieldIds` and `staleFieldIds`, which is empty unless `state` is `stale`);',
        citations: [],
      },
      {
        text: 'one transaction appends the target revision, its field values and the variant, the entry version, the audit record and the `cms.localization.changed.v1` outbox event;',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-055',
    text: "CMS-03C-04 derives session and acting context server-side and serves only an assigned CMS author or editor who may edit the entry for the localizable fields of the requested locale, on a source revision the caller can read: a hidden or absent entry, locale or source revision is 404 `LOCALE_SOURCE_NOT_FOUND`, a visible entry without edit assignment is 403 `LOCALE_FORBIDDEN`, no ownership, party or person identifier is serialized, and the operation never borrows another jurisdiction's text.",
    clauses: [
      {
        text: "CMS-03C-04 derives session and acting context server-side and serves only an assigned CMS author or editor who may edit the entry for the localizable fields of the requested locale, on a source revision the caller can read: a hidden or absent entry, locale or source revision is 404 `LOCALE_SOURCE_NOT_FOUND`, a visible entry without edit assignment is 403 `LOCALE_FORBIDDEN`, no ownership, party or person identifier is serialized, and the operation never borrows another jurisdiction's text.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-056',
    text: 'CMS-03C-04 requires an `Idempotency-Key` and the strong `If-Match` equal to the entry aggregate `version` (`expectedVersion`), applies CAS on the source revision and the entry, enforces a unique entry, locale and source revision, rate buckets of 60/min/user and 120/min/party, a 15,000 ms deadline, no-store and the Tier 2 p95 < 1,200 ms and RPC < 300 ms targets, replays an exact repeat of the same command, and answers a changed actor, body, path or version under the same key with 409.',
    clauses: [
      {
        text: 'CMS-03C-04 requires an `Idempotency-Key` and the strong `If-Match` equal to the entry aggregate `version` (`expectedVersion`), applies CAS on the source revision and the entry, enforces a unique entry, locale and source revision, rate buckets of 60/min/user and 120/min/party, a 15,000 ms deadline, no-store and the Tier 2 p95 < 1,200 ms and RPC < 300 ms targets, replays an exact repeat of the same command, and answers a changed actor, body, path or version under the same key with 409.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-057',
    text: 'CMS-03C-04 maps malformed IDs, header or body (400 `INVALID_REQUEST`), a missing session (401), a denied edit (403 `LOCALE_FORBIDDEN`), a hidden or absent entry or source (404 `LOCALE_SOURCE_NOT_FOUND`), a stale source hash or entry version or a duplicate locale (409 `LOCALE_VERSION_CONFLICT`), a non-JSON body (415), a BCP 47, field, fallback or no_fallback schema failure (422 `LOCALE_VALIDATION_FAILED`), the locale limit (429), a schema or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.locale.v1`; a failure before commit leaves no record and a lost response replays by idempotency key.',
    clauses: [
      {
        text: 'CMS-03C-04 maps malformed IDs, header or body (400 `INVALID_REQUEST`), a missing session (401), a denied edit (403 `LOCALE_FORBIDDEN`), a hidden or absent entry or source (404 `LOCALE_SOURCE_NOT_FOUND`), a stale source hash or entry version or a duplicate locale (409 `LOCALE_VERSION_CONFLICT`), a non-JSON body (415), a BCP 47, field, fallback or no_fallback schema failure (422 `LOCALE_VALIDATION_FAILED`), the locale limit (429), a schema or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.locale.v1`;',
        citations: [],
      },
      {
        text: 'a failure before commit leaves no record and a lost response replays by idempotency key.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-058',
    text: "CMS-03C-04 is consumed by the protected `CmsLocaleVariantForm` at `/app/cms-content-modeling/entries/:entryId/locales/:locale`, which offers only localizable fields, shows the fallback order read-only from the protected version detail and submits it unchanged as the equality expectation, shows per-field resolution (own value, fallback source locale, `no_fallback` missing or stale) and the derived variant state, marks `staleFieldIds`, never displays another locale's text for a `no_fallback` field, offers explicit revalidation, and renders fixed copy then refetches on 409 `FALLBACK_CHAIN_MISMATCH` and `locale_limit_reached`; verification covers per-field resolution and the `no_fallback` rule, the derived variant states, both fixed 409 messages, the 403/404 split and the focused result heading.",
    clauses: [
      {
        text: "CMS-03C-04 is consumed by the protected `CmsLocaleVariantForm` at `/app/cms-content-modeling/entries/:entryId/locales/:locale`, which offers only localizable fields, shows the fallback order read-only from the protected version detail and submits it unchanged as the equality expectation, shows per-field resolution (own value, fallback source locale, `no_fallback` missing or stale) and the derived variant state, marks `staleFieldIds`, never displays another locale's text for a `no_fallback` field, offers explicit revalidation, and renders fixed copy then refetches on 409 `FALLBACK_CHAIN_MISMATCH` and `locale_limit_reached`;",
        citations: [],
      },
      {
        text: 'verification covers per-field resolution and the `no_fallback` rule, the derived variant states, both fixed 409 messages, the 403/404 split and the focused result heading.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-059',
    text: 'CMS-03C-05 registers POST /api/v1/cms/entries/{entryId}/related-content with the strict `RelatedContentRuleRequest` (`entryId`, unique `pins` of at most 32, unique `exclusions` of at most 64, a nullable `derivedRule` of `key`, `version`, `reasonCode` and `maxCandidates`, and `expectedVersion`) and returns the strict `RelatedContentResource` as 201 (`state` `active` or `revoked`, `sourceEntryId`, `pins`, `exclusions`, `derivedRule` of `key` and `version` or null, and `eligibleCount` 0-128); generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-05 registers POST /api/v1/cms/entries/{entryId}/related-content with the strict `RelatedContentRuleRequest` (`entryId`, unique `pins` of at most 32, unique `exclusions` of at most 64, a nullable `derivedRule` of `key`, `version`, `reasonCode` and `maxCandidates`, and `expectedVersion`) and returns the strict `RelatedContentResource` as 201 (`state` `active` or `revoked`, `sourceEntryId`, `pins`, `exclusions`, `derivedRule` of `key` and `version` or null, and `eligibleCount` 0-128);',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-060',
    text: 'CMS-03C-05 serves only an assigned CMS author or editor who can edit the source entry: a hidden source or target is 404 `RELATED_CONTENT_NOT_FOUND`, a visible source without edit assignment is 403 `RELATED_CONTENT_FORBIDDEN`, a recommendation never grants access to a target the caller could not already read, and the stored rule carries no authority.',
    clauses: [
      {
        text: 'CMS-03C-05 serves only an assigned CMS author or editor who can edit the source entry: a hidden source or target is 404 `RELATED_CONTENT_NOT_FOUND`, a visible source without edit assignment is 403 `RELATED_CONTENT_FORBIDDEN`, a recommendation never grants access to a target the caller could not already read, and the stored rule carries no authority.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-061',
    text: 'CMS-03C-05 requires an `Idempotency-Key` and the strong `If-Match` equal to the source entry aggregate `version` (`expectedVersion`), applies CAS on the source entry, enforces unique pin and exclusion targets, rate buckets of 60/min/user and 120/min/party, a 15,000 ms deadline, no-store and Tier 2, appends rows without updating any, and emits no event of its own (it consumes `cms.publication.changed.v1` for invalidation).',
    clauses: [
      {
        text: 'CMS-03C-05 requires an `Idempotency-Key` and the strong `If-Match` equal to the source entry aggregate `version` (`expectedVersion`), applies CAS on the source entry, enforces unique pin and exclusion targets, rate buckets of 60/min/user and 120/min/party, a 15,000 ms deadline, no-store and Tier 2, appends rows without updating any, and emits no event of its own (it consumes `cms.publication.changed.v1` for invalidation).',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-062',
    text: 'CMS-03C-05 maps malformed IDs, header or body (400), a missing session (401), a denied source edit (403 `RELATED_CONTENT_FORBIDDEN`), a hidden source or target (404 `RELATED_CONTENT_NOT_FOUND`), a stale version or duplicate pin (409 `RELATED_CONTENT_VERSION_CONFLICT`), a non-JSON body (415), a pin, exclusion or rule schema failure (422 `RELATED_CONTENT_VALIDATION_FAILED`), the relationship limit (429), a target projection or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.related-content.v1`, commits no mutation on unresolved target authorization, and lets a target that later becomes private or unpublished drop out of the public projection while the rule history stays private.',
    clauses: [
      {
        text: 'CMS-03C-05 maps malformed IDs, header or body (400), a missing session (401), a denied source edit (403 `RELATED_CONTENT_FORBIDDEN`), a hidden source or target (404 `RELATED_CONTENT_NOT_FOUND`), a stale version or duplicate pin (409 `RELATED_CONTENT_VERSION_CONFLICT`), a non-JSON body (415), a pin, exclusion or rule schema failure (422 `RELATED_CONTENT_VALIDATION_FAILED`), the relationship limit (429), a target projection or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.related-content.v1`, commits no mutation on unresolved target authorization, and lets a target that later becomes private or unpublished drop out of the public projection while the rule history stays private.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-063',
    text: 'CMS-03C-05 is consumed by the protected `CmsRelatedContentForm`, which builds `RelatedContentRuleRequest` from an ordered pin list with move controls (no drag-only path), an exclusion list, a derived rule chosen from the registry (`shared-terms`, `same-type-recent`) with `maxCandidates`, and the `eligibleCount` shown after save, states beside the lists that exclusions win, picks entries only from the caller-readable entry list (CMS-03B-13), and renders `related_target_ineligible` as one fixed message at the offending row without saying why; verification covers the pin and exclusion bounds, the uniform refusal, the 403/404 split and the focused result heading.',
    clauses: [
      {
        text: 'CMS-03C-05 is consumed by the protected `CmsRelatedContentForm`, which builds `RelatedContentRuleRequest` from an ordered pin list with move controls (no drag-only path), an exclusion list, a derived rule chosen from the registry (`shared-terms`, `same-type-recent`) with `maxCandidates`, and the `eligibleCount` shown after save, states beside the lists that exclusions win, picks entries only from the caller-readable entry list (CMS-03B-13), and renders `related_target_ineligible` as one fixed message at the offending row without saying why;',
        citations: [],
      },
      {
        text: 'verification covers the pin and exclusion bounds, the uniform refusal, the 403/404 split and the focused result heading.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-064',
    text: 'CMS-03C-06 registers POST /api/v1/cms/governed-reviews with the strict `GovernedReviewSubmissionRequest` (`subjectKind`, `subjectId`, `subjectHash`) and returns the strict `GovernedReviewResource` as 201: `ResourceMeta` whose `contentHash` is the JCS SHA-256 of `{ subjectKind, subjectId, subjectHash, policyBasisHash, requiredDecisionCount, requiredCapabilities }`, plus `state` `open`, `subjectKind`, `subjectId`, `lineageId`, `subjectKey`, `subjectVersion`, `subjectHash`, `riskClass`, `requiredDecisionCount` 1-8, `recordedDecisionCount` 0-8, `requiredCapabilities` 1-16, `policyBasisHash`, `submittedAt`, `decidedAt`, `activatedAt` and `invalidatedReason`; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-06 registers POST /api/v1/cms/governed-reviews with the strict `GovernedReviewSubmissionRequest` (`subjectKind`, `subjectId`, `subjectHash`) and returns the strict `GovernedReviewResource` as 201: `ResourceMeta` whose `contentHash` is the JCS SHA-256 of `{ subjectKind, subjectId, subjectHash, policyBasisHash, requiredDecisionCount, requiredCapabilities }`, plus `state` `open`, `subjectKind`, `subjectId`, `lineageId`, `subjectKey`, `subjectVersion`, `subjectHash`, `riskClass`, `requiredDecisionCount` 1-8, `recordedDecisionCount` 0-8, `requiredCapabilities` 1-16, `policyBasisHash`, `submittedAt`, `decidedAt`, `activatedAt` and `invalidatedReason`;',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-065',
    text: "CMS-03C-06 accepts only a closed `subjectKind`, a `subjectId` that is the exact version row id in the caller's owner scope and a `subjectHash` of 64 lowercase hex equal to the stored `content_hash` (422 at `/subjectHash` otherwise), requires the subject state `draft` with no live review (else 409 `subject_not_submittable`) and, for a taxonomy version, a registered provider for every declared canonical domain (else 422 `canonical_source_unavailable` with `details.domain`), names the exact subject version by id and hash so no `If-Match` applies, and admits at most one live review per subject version through the partial unique index.",
    clauses: [
      {
        text: "CMS-03C-06 accepts only a closed `subjectKind`, a `subjectId` that is the exact version row id in the caller's owner scope and a `subjectHash` of 64 lowercase hex equal to the stored `content_hash` (422 at `/subjectHash` otherwise), requires the subject state `draft` with no live review (else 409 `subject_not_submittable`) and, for a taxonomy version, a registered provider for every declared canonical domain (else 422 `canonical_source_unavailable` with `details.domain`), names the exact subject version by id and hash so no `If-Match` applies, and admits at most one live review per subject version through the partial unique index.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-066',
    text: "CMS-03C-06 derives session and acting context server-side and serves only a holder of the subject kind's owner capability in the subject's owner party (`cms.template_designer` for a template or pattern version, `cms.taxonomy_curator` for a taxonomy version): a hidden or absent subject is 404, a visible subject without the capability is 403 `capability_missing`, `submitted_by` is server-derived, no step-up is required, and no person, party or authority identifier is serialized.",
    clauses: [
      {
        text: "CMS-03C-06 derives session and acting context server-side and serves only a holder of the subject kind's owner capability in the subject's owner party (`cms.template_designer` for a template or pattern version, `cms.taxonomy_curator` for a taxonomy version): a hidden or absent subject is 404, a visible subject without the capability is 403 `capability_missing`, `submitted_by` is server-derived, no step-up is required, and no person, party or authority identifier is serialized.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-067',
    text: 'CMS-03C-06 requires an `Idempotency-Key` and no `If-Match`, enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline, no-store and the Tier 2 p95 < 1,200 ms target, and in one transaction freezes the subject hash, the policy basis and the block digest, inserts the `open` review with its dependency rows, sets the subject to `review` and writes the audit record, emitting no event.',
    clauses: [
      {
        text: 'CMS-03C-06 requires an `Idempotency-Key` and no `If-Match`, enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline, no-store and the Tier 2 p95 < 1,200 ms target, and in one transaction freezes the subject hash, the policy basis and the block digest, inserts the `open` review with its dependency rows, sets the subject to `review` and writes the audit record, emitting no event.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-068',
    text: 'CMS-03C-06 maps malformed IDs, header or body (400), a missing session (401), a missing capability (403), a hidden or absent subject (404), `subject_not_submittable` or an idempotency conflict (409), a non-JSON body (415), a subject hash or kind failure or, for a taxonomy version that declares an unbuilt canonical domain, `canonical_source_unavailable` with `details.domain` (422), the governed-review limit (429), a preflight or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`, writes no review, dependency row or subject-state change on any refusal, and answers a NULL workflow-policy evidence as 503 `DEPENDENCY_UNAVAILABLE`.',
    clauses: [
      {
        text: 'CMS-03C-06 maps malformed IDs, header or body (400), a missing session (401), a missing capability (403), a hidden or absent subject (404), `subject_not_submittable` or an idempotency conflict (409), a non-JSON body (415), a subject hash or kind failure or, for a taxonomy version that declares an unbuilt canonical domain, `canonical_source_unavailable` with `details.domain` (422), the governed-review limit (429), a preflight or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`, writes no review, dependency row or subject-state change on any refusal, and answers a NULL workflow-policy evidence as 503 `DEPENDENCY_UNAVAILABLE`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-069',
    text: 'CMS-03C-06 is consumed by the protected `CmsGovernedReviewPanel` on the template, pattern and vocabulary pages, which shows the subject version\'s lifecycle as text and icon, builds `GovernedReviewSubmissionRequest` from the served version id and hash (never typed), offers _Submit for review_ only when the server permits it, states why a version cannot yet be activated ("Needs an independent reviewer\'s approval") and never shows an activate control without an `approved` review; verification covers each subject kind, `subject_not_submittable`, one live review per version, the 403/404 split and the focused result heading.',
    clauses: [
      {
        text: 'CMS-03C-06 is consumed by the protected `CmsGovernedReviewPanel` on the template, pattern and vocabulary pages, which shows the subject version\'s lifecycle as text and icon, builds `GovernedReviewSubmissionRequest` from the served version id and hash (never typed), offers _Submit for review_ only when the server permits it, states why a version cannot yet be activated ("Needs an independent reviewer\'s approval") and never shows an activate control without an `approved` review;',
        citations: [],
      },
      {
        text: 'verification covers each subject kind, `subject_not_submittable`, one live review per version, the 403/404 split and the focused result heading.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-070',
    text: 'CMS-03C-07 registers POST /api/v1/cms/governed-reviews/{reviewId}/decision with the strict `GovernedDecisionRequest` (`reviewId`, `decision` `approve` or `reject`, `reason`, `expectedVersion`) and returns the strict `GovernedReviewResource` as 200 with the recorded decision counted; `capability` and `stepUpAt` are unknown keys (422); generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-07 registers POST /api/v1/cms/governed-reviews/{reviewId}/decision with the strict `GovernedDecisionRequest` (`reviewId`, `decision` `approve` or `reject`, `reason`, `expectedVersion`) and returns the strict `GovernedReviewResource` as 200 with the recorded decision counted;',
        citations: [],
      },
      {
        text: '`capability` and `stepUpAt` are unknown keys (422);',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-071',
    text: 'CMS-03C-07 requires the path `reviewId` to equal the body `reviewId`, `decision` `approve` or `reject`, a `reason` of 1-2000 code points in NFC with no control, line or paragraph separator or bidirectional-formatting character and no `<>{}`, and an `expectedVersion` that is the review `version` with the strong `If-Match` equal to it exactly; a body `capability` or `stepUpAt` is refused as an unknown key.',
    clauses: [
      {
        text: 'CMS-03C-07 requires the path `reviewId` to equal the body `reviewId`, `decision` `approve` or `reject`, a `reason` of 1-2000 code points in NFC with no control, line or paragraph separator or bidirectional-formatting character and no `<>{}`, and an `expectedVersion` that is the review `version` with the strong `If-Match` equal to it exactly;',
        citations: [],
      },
      {
        text: 'a body `capability` or `stepUpAt` is refused as an unknown key.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
];
