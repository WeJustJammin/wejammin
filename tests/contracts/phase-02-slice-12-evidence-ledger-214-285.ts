import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 12 evidence ledger, criteria AC214-AC285. Aggregated by
// tests/contracts/phase-02-slice-12-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-12-evidence-guard.test.ts.
export const S12_EVIDENCE_LEDGER_214_285: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S12-AC-214',
    text: 'Pattern update `accept`: for each listed instance a path changed only by the new version adopts it, a local override on a path the new version did not change is retained, every collision takes the explicit `yours` or `theirs` choice, and the command appends an `active` row pinned to the target version.',
    clauses: [
      {
        text: 'Pattern update `accept`: for each listed instance a path changed only by the new version adopts it, a local override on a path the new version did not change is retained, every collision takes the explicit `yours` or `theirs` choice, and the command appends an `active` row pinned to the target version.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the accept command (CMS-03C-15, RPC cms_apply_pattern_update with the three-way merge over pending_diff instances) is not built.',
  },
  {
    criterion: 'P2-S12-AC-215',
    text: "Pattern update `detach`: the command appends a `detached` row that materializes the instance's current effective content (the pinned tree plus its overrides) as local props and stops the instance receiving updates, and it is admitted for any linked instance.",
    clauses: [
      {
        text: "Pattern update `detach`: the command appends a `detached` row that materializes the instance's current effective content (the pinned tree plus its overrides) as local props and stops the instance receiving updates, and it is admitted for any linked instance.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the detach command (CMS-03C-15 action detach, RPC cms_apply_pattern_update) is not built.',
  },
  {
    criterion: 'P2-S12-AC-216',
    text: "Pattern insertion target: CMS-03C-02 inserts only on the entry's current draft revision (effective state `draft` per E2, else 409 `revision_not_editable`) that the caller can read (patterns apply to entry revisions only, DEC-176), and `patternId` is a lineage id of the caller's owner scope.",
    clauses: [
      {
        text: "Pattern insertion target: CMS-03C-02 inserts only on the entry's current draft revision (effective state `draft` per E2, else 409 `revision_not_editable`) that the caller can read (patterns apply to entry revisions only, DEC-176), and `patternId` is a lineage id of the caller's owner scope.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the RPC cms_insert_pattern_instance is not deployed and CMS-03C-02 still takes a caller revisionId; the only database check is a table guard that raises VALIDATION_FAILED for a non-draft target, not the 409 revision_not_editable current-draft rule.',
  },
  {
    criterion: 'P2-S12-AC-217',
    text: "Pattern insertion version: the named pattern version must be `active` and its `compatibleTypeIds` must list the revision's content type, else 422 `pattern_version_not_active` or `pattern_incompatible`.",
    clauses: [
      {
        text: "Pattern insertion version: the named pattern version must be `active` and its `compatibleTypeIds` must list the revision's content type, else 422 `pattern_version_not_active` or `pattern_incompatible`.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: cms_insert_pattern_instance is not deployed and cms_pattern_versions has no compatible_type_ids column (AC-257), so the active-state and compatibility checks cannot run.',
  },
  {
    criterion: 'P2-S12-AC-218',
    text: "Pattern insertion rows (DEC-175, DEC-181): the request `slotPath` must exist in the revision's template (or be a root path when the entry has no template); a top-level nested pattern reference (`kind: pattern`) in the pinned forest is expanded at placement into that pattern's own block roots, recursively, so every row carries a block; one placement writes one append-only row per block root of the pinned pattern version's forest after that expansion, one or more rows (at most 512, the node cap after expansion) in one transaction and all-or-nothing, and answers 201 `PatternPlacementResource`, an `items` list of one or more `CompositionInstanceResource`; each row stays pinned to the placed `(patternId, patternVersion)`, carries its block root's block identity in `block_key` and `block_version` with that root's `key` as the suffix of its `path`, keeps the nodes below a block root inside the pinned tree and stores the server-recomputed digest, the link mode and the `overrides` that lie under its root; `overrides` keys are normalized node paths under the inserted root (`/{nodeKey}(/{nodeKey})*`, at most 512 characters) that each name a node of the pinned tree, any other key being 422 `COMPOSITION_VALIDATION_FAILED` at `/overrides`; `(revision_id, path)` is unique per version, and an override collision produces `pending_diff` and never overwrites.",
    clauses: [
      {
        text: "Pattern insertion rows (DEC-175, DEC-181): the request `slotPath` must exist in the revision's template (or be a root path when the entry has no template);",
        citations: [],
      },
      {
        text: "a top-level nested pattern reference (`kind: pattern`) in the pinned forest is expanded at placement into that pattern's own block roots, recursively, so every row carries a block;",
        citations: [],
      },
      {
        text: "one placement writes one append-only row per block root of the pinned pattern version's forest after that expansion, one or more rows (at most 512, the node cap after expansion) in one transaction and all-or-nothing, and answers 201 `PatternPlacementResource`, an `items` list of one or more `CompositionInstanceResource`;",
        citations: [],
      },
      {
        text: "each row stays pinned to the placed `(patternId, patternVersion)`, carries its block root's block identity in `block_key` and `block_version` with that root's `key` as the suffix of its `path`, keeps the nodes below a block root inside the pinned tree and stores the server-recomputed digest, the link mode and the `overrides` that lie under its root;",
        citations: [],
      },
      {
        text: '`overrides` keys are normalized node paths under the inserted root (`/{nodeKey}(/{nodeKey})*`, at most 512 characters) that each name a node of the pinned tree, any other key being 422 `COMPOSITION_VALIDATION_FAILED` at `/overrides`;',
        citations: [],
      },
      {
        text: '`(revision_id, path)` is unique per version,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title:
              'pattern and composition versions have stable unique identities',
          },
        ],
      },
      {
        text: 'and an override collision produces `pending_diff` and never overwrites.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Uncited: slotPath existence in the template or root path; nested pattern expansion into block roots; one append-only row per block root (at most 512, all-or-nothing, 201 PatternPlacementResource items); per-row pin, block identity, path suffix, digest, link mode and overrides; normalized override keys with 422 COMPOSITION_VALIDATION_FAILED at /overrides; the override collision producing pending_diff. Only the (revision_id, path, version) unique index is asserted.',
  },
  {
    criterion: 'P2-S12-AC-219',
    text: "Composition write effect: every composition write (CMS-03C-02, which appends one row per block root (DEC-181), CMS-03C-15, the linked-update scan and the revision-append carry-over) appends a row, never changes the revision's `contentHash` (composition instances are not part of it) and invalidates the revision's live editorial review in the same transaction, with the reason `dependency_changed` for CMS-03C-02 because the manifest `blocks` and `patterns` groups changed.",
    clauses: [
      {
        text: "Composition write effect: every composition write (CMS-03C-02, which appends one row per block root (DEC-181), CMS-03C-15, the linked-update scan and the revision-append carry-over) appends a row, never changes the revision's `contentHash` (composition instances are not part of it) and invalidates the revision's live editorial review in the same transaction, with the reason `dependency_changed` for CMS-03C-02 because the manifest `blocks` and `patterns` groups changed.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: no composition writer appends rows or invalidates a live review (cms_insert_pattern_instance, CMS-03C-15, the linked-update scan and the carry-over are not built).',
  },
  {
    criterion: 'P2-S12-AC-220',
    text: 'Vocabulary model: a vocabulary is identified by its stable lineage id `taxonomyId`, a TaxonomyVersion is the reviewed rule set (shape, allowlists and declared canonical overlap domains), and the terms belong to the vocabulary, so `cms_terms` carries `taxonomy_id` and `UNIQUE (taxonomy_id, term_key, version)` replaces `UNIQUE (taxonomy_version_id, term_key, version)`, a successor version never duplicates or re-keys a term, and term ids stay stable across versions and merges.',
    clauses: [
      {
        text: 'Vocabulary model: a vocabulary is identified by its stable lineage id `taxonomyId`, a TaxonomyVersion is the reviewed rule set (shape, allowlists and declared canonical overlap domains), and the terms belong to the vocabulary, so `cms_terms` carries `taxonomy_id` and `UNIQUE (taxonomy_id, term_key, version)` replaces `UNIQUE (taxonomy_version_id, term_key, version)`, a successor version never duplicates or re-keys a term, and term ids stay stable across versions and merges.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: cms_terms has no taxonomy_id column and keeps UNIQUE (taxonomy_version_id, term_key, version), so the lineage vocabulary model is not built.',
  },
  {
    criterion: 'P2-S12-AC-221',
    text: "Term action preconditions: CMS-03C-03 runs under the vocabulary's `active` TaxonomyVersion (no active version is 409 `taxonomy_not_active`), `parentId` other than null requires shape `hierarchical`, and assigning a term to a field requires the vocabulary's active version to list the entry content type's key in `allowedTypeKeys` and the field key in `allowedFieldKeys`.",
    clauses: [
      {
        text: "Term action preconditions: CMS-03C-03 runs under the vocabulary's `active` TaxonomyVersion (no active version is 409 `taxonomy_not_active`), `parentId` other than null requires shape `hierarchical`, and assigning a term to a field requires the vocabulary's active version to list the entry content type's key in `allowedTypeKeys` and the field key in `allowedFieldKeys`.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the term action RPC cms_act_taxonomy_term is not built and the production adapter fails closed.',
  },
  {
    criterion: 'P2-S12-AC-222',
    text: "Canonical overlap (DEC-135): the overlap check runs only against the `canonicalOverlapDomains` declared by the vocabulary's active version, so for `create`, `rename` and `alias` over a declared built domain a `match` from CMS-03C-18 refuses the action with 422 `TAXONOMY_VALIDATION_FAILED` `canonical_overlap` carrying `details.domain` and `details.canonicalId` and creates nothing, `merge` and `deprecate` run no overlap check, and a vocabulary that declares no domain is never checked.",
    clauses: [
      {
        text: "Canonical overlap (DEC-135): the overlap check runs only against the `canonicalOverlapDomains` declared by the vocabulary's active version, so for `create`, `rename` and `alias` over a declared built domain a `match` from CMS-03C-18 refuses the action with 422 `TAXONOMY_VALIDATION_FAILED` `canonical_overlap` carrying `details.domain` and `details.canonicalId` and creates nothing, `merge` and `deprecate` run no overlap check, and a vocabulary that declares no domain is never checked.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: neither cms_canonical_taxonomy_match, the canonical domain registry nor the term action RPC exists.',
  },
  {
    criterion: 'P2-S12-AC-223',
    text: 'Unbuilt canonical domain (DEC-135): a declared domain whose provider is `unbuilt` is refused with the typed `canonical_source_unavailable` carrying `details.domain` at taxonomy-version activation and, defensively, at every `create`, `rename` and `alias` action, and a provider fault or timeout is 503 `DEPENDENCY_UNAVAILABLE` with no editorial write.',
    clauses: [
      {
        text: 'Unbuilt canonical domain (DEC-135): a declared domain whose provider is `unbuilt` is refused with the typed `canonical_source_unavailable` carrying `details.domain` at taxonomy-version activation and, defensively, at every `create`, `rename` and `alias` action, and a provider fault or timeout is 503 `DEPENDENCY_UNAVAILABLE` with no editorial write.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: no canonical domain provider registry, taxonomy-version activation or term action RPC exists.',
  },
  {
    criterion: 'P2-S12-AC-224',
    text: 'Term actions: `create` inserts a term with lifecycle `active` and its first labels, `rename` appends a new label version and never changes the key, `alias` appends an alias, `deprecate` moves the term to `deprecated` (still resolvable, not newly assignable), a `merged` term never reactivates, and label versions are immutable (a replacement creates a new version).',
    clauses: [
      {
        text: 'Term actions: `create` inserts a term with lifecycle `active` and its first labels, `rename` appends a new label version and never changes the key, `alias` appends an alias, `deprecate` moves the term to `deprecated` (still resolvable, not newly assignable),',
        citations: [],
      },
      {
        text: 'a `merged` term never reactivates,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'a merged term cannot reactivate',
          },
        ],
      },
      {
        text: 'and label versions are immutable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'a label version cannot be changed in place',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'label and assignment version rows reject UPDATE and DELETE',
          },
        ],
      },
      {
        text: '(a replacement creates a new version).',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Uncited: the create, rename, alias and deprecate term actions (no cms_act_taxonomy_term RPC) and the rule that a replacement label is a new version. Cited: a merged term never reactivates and label versions reject in-place change at table level.',
  },
  {
    criterion: 'P2-S12-AC-225',
    text: 'Term merge: `merge` locks the survivor and the retired term (`FOR UPDATE` in id order), requires a survivor that is `active` or `deprecated` and a retired term that is not already `merged`, sets the retired term `merged` with its `successor_id`, and keeps the retired id as a permanent redirect.',
    clauses: [
      {
        text: 'Term merge: `merge` locks the survivor and the retired term (`FOR UPDATE` in id order),',
        citations: [],
      },
      {
        text: 'requires a survivor that is `active` or `deprecated` and a retired term that is not already `merged`,',
        citations: [],
      },
      {
        text: 'sets the retired term `merged` with its `successor_id`,',
        citations: [],
      },
      {
        text: 'and keeps the retired id as a permanent redirect.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'merge requires a permanent survivor redirect',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'a merged term cannot reactivate',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Uncited: the merge command locking survivor and retired term FOR UPDATE in id order; the survivor `active` or `deprecated` rule (the existing guard accepts only `active`) and the retired-term-not-already-merged rule; the command setting the retired term merged with its successor_id. Cited: the permanent-redirect invariant.',
  },
  {
    criterion: 'P2-S12-AC-226',
    text: "Term merge convergence: `merge` re-points every `active` TermAssignment of the retired term to the survivor by appending superseding assignment versions, converging up to 5,000 assignments in the same transaction and continuing a larger set through the idempotent job `cms.taxonomy.merge_converge` (a BE00 jobs row bound to the merge command's actor and acting party) from a durable cursor, with the retired id resolving to the survivor throughout.",
    clauses: [
      {
        text: "Term merge convergence: `merge` re-points every `active` TermAssignment of the retired term to the survivor by appending superseding assignment versions, converging up to 5,000 assignments in the same transaction and continuing a larger set through the idempotent job `cms.taxonomy.merge_converge` (a BE00 jobs row bound to the merge command's actor and acting party) from a durable cursor, with the retired id resolving to the survivor throughout.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: no merge command, convergence, cms.taxonomy.merge_converge job or durable cursor exists.',
  },
  {
    criterion: 'P2-S12-AC-227',
    text: 'Related-content targets (D11): a pin target must exist, differ from the source, have lifecycle `active`, belong to the same owner party as the source and be readable by the caller under the draft-read predicate, an exclusion target must exist and be readable by the caller (its lifecycle is not constrained), and an ineligible, hidden or absent pin or exclusion is one uniform 422 `RELATED_CONTENT_VALIDATION_FAILED` `related_target_ineligible` at `/pins/{n}` or `/exclusions/{n}` with identical bodies, so that a write is never an existence oracle.',
    clauses: [
      {
        text: 'Related-content targets (D11): a pin target must exist, differ from the source, have lifecycle `active`, belong to the same owner party as the source and be readable by the caller under the draft-read predicate, an exclusion target must exist and be readable by the caller (its lifecycle is not constrained), and an ineligible, hidden or absent pin or exclusion is one uniform 422 `RELATED_CONTENT_VALIDATION_FAILED` `related_target_ineligible` at `/pins/{n}` or `/exclusions/{n}` with identical bodies, so that a write is never an existence oracle.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the curation RPC cms_curate_related_content is not built and the production adapter fails closed.',
  },
  {
    criterion: 'P2-S12-AC-228',
    text: 'Related-content rule storage: rules are append-only versions, a request replaces the whole rule set (pins in array order as `position`, exclusions and the derived rule) by appending `revoked` rows for removed items and `active` rows for new ones, the strong `If-Match` is the source entry `version`, and derived rows carry no target while pin and exclude rows require one.',
    clauses: [
      {
        text: 'Related-content rule storage: rules are append-only versions,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_related_authority.sql',
            title: 'related-content rules are append-only',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_related_authority.sql',
            title:
              'locale and related-content versions reject direct writes and mutation',
          },
        ],
      },
      {
        text: 'a request replaces the whole rule set (pins in array order as `position`, exclusions and the derived rule) by appending `revoked` rows for removed items and `active` rows for new ones,',
        citations: [],
      },
      {
        text: 'the strong `If-Match` is the source entry `version`,',
        citations: [],
      },
      {
        text: 'and derived rows carry no target while',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_related_authority.sql',
            title: 'derived rule cannot hardcode a target entry',
          },
        ],
      },
      {
        text: 'pin and exclude rows require one.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Uncited: whole-rule-set replacement by appending revoked and active rows with position, the strong If-Match equalling the source entry version, and the pin and exclude rows requiring a target (a CHECK exists but no assertion drives it). Cited: append-only rules and the derived rule carrying no target.',
  },
  {
    criterion: 'P2-S12-AC-229',
    text: 'Derived-rule registry (OD-5): the code-owned registry `CMS_RELATED_RULES` has `shared-terms` (reason `shared_terms`) and `same-type-recent` (reason `same_type_recent`) at version 1, a rule row selects exactly one, `derivedRule.reasonCode` is an equality expectation of the registry value, `maxCandidates` is 1-128, the rule key and version are validated by `platform_private.cms_related_rule_valid`, and an unknown key or version is 422 `derived_rule_unknown`.',
    clauses: [
      {
        text: 'Derived-rule registry (OD-5): the code-owned registry `CMS_RELATED_RULES` has `shared-terms` (reason `shared_terms`) and `same-type-recent` (reason `same_type_recent`) at version 1, a rule row selects exactly one, `derivedRule.reasonCode` is an equality expectation of the registry value, `maxCandidates` is 1-128, the rule key and version are validated by `platform_private.cms_related_rule_valid`, and an unknown key or version is 422 `derived_rule_unknown`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the code-owned CMS_RELATED_RULES registry and cms_related_rule_valid do not exist; the contract accepts any rule key and reason code.',
  },
  {
    criterion: 'P2-S12-AC-230',
    text: "Related-content `eligibleCount`: a rule is never evaluated at write time except to compute `eligibleCount` (the eligible pins plus the derived candidates for the source revision's locale and the audience of the source's most recent active publication, with 0 derived when the source has none), and the count never exceeds 128.",
    clauses: [
      {
        text: "Related-content `eligibleCount`: a rule is never evaluated at write time except to compute `eligibleCount` (the eligible pins plus the derived candidates for the source revision's locale and the audience of the source's most recent active publication, with 0 derived when the source has none), and the count never exceeds 128.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the write RPC and the eligibleCount computation are not built; the resource only carries a contract-shaped eligibleCount field.',
  },
  {
    criterion: 'P2-S12-AC-231',
    text: "Derived `shared-terms` ranking: candidates are entries of the same owner with an `active` publication head for the requested locale and audience, other than the source, not excluded and not already pinned, ranked by the number of active terms shared with the source's term assignments (the published revision's in a public projection, the draft's in an editorial preview) descending, then the target head's `created_at` descending, then `entryId` ascending.",
    clauses: [
      {
        text: "Derived `shared-terms` ranking: candidates are entries of the same owner with an `active` publication head for the requested locale and audience, other than the source, not excluded and not already pinned, ranked by the number of active terms shared with the source's term assignments (the published revision's in a public projection, the draft's in an editorial preview) descending, then the target head's `created_at` descending, then `entryId` ascending.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: no derived-rule evaluator or cms_related_content_public_targets exists.',
  },
  {
    criterion: 'P2-S12-AC-232',
    text: "Derived `same-type-recent` ranking: the same candidate set restricted to the source's content type is ranked by the target head's `created_at` descending then `entryId` ascending, and at most `maxCandidates` derived candidates are used.",
    clauses: [
      {
        text: "Derived `same-type-recent` ranking: the same candidate set restricted to the source's content type is ranked by the target head's `created_at` descending then `entryId` ascending, and at most `maxCandidates` derived candidates are used.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test can exist yet: no same-type-recent evaluator exists.',
  },
  {
    criterion: 'P2-S12-AC-233',
    text: "Locale configuration check (OD-4): CMS-03C-04 requires `locale` to be a member of the active content-type version's `supportedLocales` (422 `LOCALE_VALIDATION_FAILED` otherwise) and `fallbackChain` to equal, element for element, that version's `fallbackChains` entry for `locale` (`[]` exactly when `locale` is its `defaultLocale`); any difference in membership, order or length is 409 `LOCALE_VERSION_CONFLICT` with `details.reasonCode` `FALLBACK_CHAIN_MISMATCH` and `details.activeFallbackChain` (at most 16 tags) and writes no variant, and after a successor changes the chain the new chain applies and the old chain is refused.",
    clauses: [
      {
        text: "Locale configuration check (OD-4): CMS-03C-04 requires `locale` to be a member of the active content-type version's `supportedLocales` (422 `LOCALE_VALIDATION_FAILED` otherwise)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              "a locale outside the active version's supportedLocales is a validation failure (422)",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter maps a locale outside supportedLocales to the 422 catalog code without a chain',
          },
        ],
      },
      {
        text: "and `fallbackChain` to equal, element for element, that version's `fallbackChains` entry for `locale`",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'the exact active chain and a supported locale author a variant',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'a fallbackChain that differs from the active chain is a 409 version conflict',
          },
        ],
      },
      {
        text: '(`[]` exactly when `locale` is its `defaultLocale`);',
        citations: [],
      },
      {
        text: 'any difference in membership, order or length is 409 `LOCALE_VERSION_CONFLICT` with `details.reasonCode` `FALLBACK_CHAIN_MISMATCH` and `details.activeFallbackChain` (at most 16 tags) and writes no variant,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'a fallbackChain that differs from the active chain is a 409 version conflict',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'the conflict detail carries the reason code and the active chain',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'an empty chain for a locale whose active chain is [en-US] is a conflict',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title: 'a longer chain than the active one is a conflict',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'a refused authoring writes no variant, no revision and does not move the entry version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter carries the active fallback chain on a chain-equality conflict (OD-4)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              'CMS-03C-04 fallback-chain equality conflict (OD-4) accepts the active chain, bounded at sixteen canonical tags',
          },
        ],
      },
      {
        text: 'and after a successor changes the chain the new chain applies and the old chain is refused.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Uncited: the `[]` chain exactly when the locale is its defaultLocale (no authoring assertion for a default-locale target); after a successor changes the chain the new chain applies and the old chain is refused. Caveats on cited clauses: the mismatch tests cover length and membership differences, an order-only difference has no assertion, and the 409/422 catalog mapping is evidenced only by Worker unit tests with a stubbed RPC response (no real-stack apispec for CMS-03C-04 exists).',
  },
  {
    criterion: 'P2-S12-AC-234',
    text: 'Derived locale variant state: a stored LocaleVariant row is `draft` (written by CMS-03C-04) or `stale` (appended by the source-change fan-out), while the browser `LocaleVariantState` also shows `review` and `approved`, derived from the editorial review of the locale revision by the 03b effective-state rule (`submitted` shows `review`; `approved` and `published` show `approved`), and `untranslated` when no variant exists for the locale.',
    clauses: [
      {
        text: 'Derived locale variant state: a stored LocaleVariant row is `draft` (written by CMS-03C-04) or `stale` (appended by the source-change fan-out), while the browser `LocaleVariantState` also shows `review` and `approved`, derived from the editorial review of the locale revision by the 03b effective-state rule (`submitted` shows `review`; `approved` and `published` show `approved`), and `untranslated` when no variant exists for the locale.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: cms_locale_variants.state still allows five physical values and nothing derives review, approved or untranslated from the editorial review of the locale revision.',
  },
  {
    criterion: 'P2-S12-AC-235',
    text: "Per-field staleness: the variant records `field_source_hashes` (the source value hash of each translated field at write time), a field is stale when the current source value hash differs, `staleFieldIds` carries those fields, unchanged fields keep their approved state, and explicit revalidation is a new CMS-03C-04 write with the current `sourceHash` that appends a `draft` row and returns to `approved` only through the revision's editorial review.",
    clauses: [
      {
        text: "Per-field staleness: the variant records `field_source_hashes` (the source value hash of each translated field at write time), a field is stale when the current source value hash differs, `staleFieldIds` carries those fields, unchanged fields keep their approved state, and explicit revalidation is a new CMS-03C-04 write with the current `sourceHash` that appends a `draft` row and returns to `approved` only through the revision's editorial review.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: cms_locale_variants has no field_source_hashes or stale_field_ids and no per-field revalidation path exists.',
  },
  {
    criterion: 'P2-S12-AC-236',
    text: 'Locale fan-out bound (D12): a source-locale change appends stale rows synchronously for at most 32 dependent locale variants per entry, and a request that would create a 33rd distinct locale variant is refused 409 `LOCALE_VERSION_CONFLICT` `locale_limit_reached`.',
    clauses: [
      {
        text: 'Locale fan-out bound (D12): a source-locale change appends stale rows synchronously for at most 32 dependent locale variants per entry,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_locale_fanout_branch.sql',
            title:
              'a fan-out at exactly the limit answers the number of dependent locales',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_locale_fanout_branch.sql',
            title:
              'three dependent locales over a limit of two are refused, never truncated',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_locale_fanout_branch.sql',
            title: 'one stale variant is appended per dependent locale',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_source_stale.sql',
            title:
              'a changed source appends one stale version for each dependent locale',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_source_stale.sql',
            title:
              'the second source-dependent locale is invalidated in the same transaction',
          },
        ],
      },
      {
        text: 'and a request that would create a 33rd distinct locale variant is refused 409 `LOCALE_VERSION_CONFLICT` `locale_limit_reached`.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Uncited: a request that would create a 33rd distinct locale variant is refused 409 LOCALE_VERSION_CONFLICT `locale_limit_reached`. Caveat on the cited clause: the bound is exercised with limits 2 and 3; the limit 32 only appears in a weak refusal assertion and no test creates 32 or 33 real variants.',
  },
  {
    criterion: 'P2-S12-AC-237',
    text: "Locale event identity (D12): every locale variant and every stale row is a version of the locale aggregate `(entry, locale)`, and the outbox identity of `cms.localization.changed.v1` is aggregateType `cms.locale_variant`, aggregateId a UUIDv5 over the entry id and locale under the fixed namespace `cms.locale.aggregate.v1`, and aggregateVersion the variant row's `version`, so that the author RPC and the fan-out writer never share a dedupe key.",
    clauses: [
      {
        text: "Locale event identity (D12): every locale variant and every stale row is a version of the locale aggregate `(entry, locale)`, and the outbox identity of `cms.localization.changed.v1` is aggregateType `cms.locale_variant`, aggregateId a UUIDv5 over the entry id and locale under the fixed namespace `cms.locale.aggregate.v1`, and aggregateVersion the variant row's `version`, so that the author RPC and the fan-out writer never share a dedupe key.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: locale events still use aggregate type cms_content_entry and the entry id; no UUIDv5 locale aggregate or cms.locale_variant identity exists.',
  },
  {
    criterion: 'P2-S12-AC-238',
    text: 'Preflight provider `cms.pattern.active_digest` version 1 (category `pattern`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate`, requires every PatternVersion in the manifest to be `active` with an equal `content_hash` and the `blockRegistryDigest` recomputed over the reachable set to equal the frozen one, and fails with the reasons `pattern_not_active` and `pattern_digest_changed`.',
    clauses: [
      {
        text: 'Preflight provider `cms.pattern.active_digest` version 1 (category `pattern`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate`, requires every PatternVersion in the manifest to be `active` with an equal `content_hash` and the `blockRegistryDigest` recomputed over the reachable set to equal the frozen one, and fails with the reasons `pattern_not_active` and `pattern_digest_changed`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the cms.pattern.active_digest provider and its registry row are not built.',
  },
  {
    criterion: 'P2-S12-AC-239',
    text: "Preflight provider `cms.taxonomy.assignment_integrity` version 1 (category `taxonomy`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate`, requires every `active` TermAssignment of the revision to name an `active` term (a `deprecated` term is tolerated for an existing assignment and a `merged` term whose assignment has not converged fails `term_merged_unconverged`), the vocabulary's active version to still list the entry type key and field key (`allowlist_changed`), and every manifest taxonomy version id to be `active` (`taxonomy_version_not_active`).",
    clauses: [
      {
        text: "Preflight provider `cms.taxonomy.assignment_integrity` version 1 (category `taxonomy`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate`, requires every `active` TermAssignment of the revision to name an `active` term (a `deprecated` term is tolerated for an existing assignment and a `merged` term whose assignment has not converged fails `term_merged_unconverged`), the vocabulary's active version to still list the entry type key and field key (`allowlist_changed`), and every manifest taxonomy version id to be `active` (`taxonomy_version_not_active`).",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the cms.taxonomy.assignment_integrity provider is not built.',
  },
  {
    criterion: 'P2-S12-AC-240',
    text: "Preflight provider `cms.locale.no_fallback_gate` version 1 (category `locale`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate` and evaluates every `no_fallback` field of the revision's schema for the revision's locale in one statement: every blocking resolution fails the category with `no_fallback_missing` or `no_fallback_stale`, a revision whose locale variant is not in effective state `approved` or `published` fails with `locale_variant_not_approved`, and otherwise the category passes; the `route`, `media` and `privacy` categories stay on the reference gate.",
    clauses: [
      {
        text: "Preflight provider `cms.locale.no_fallback_gate` version 1 (category `locale`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate` and evaluates every `no_fallback` field of the revision's schema for the revision's locale in one statement: every blocking resolution fails the category with `no_fallback_missing` or `no_fallback_stale`, a revision whose locale variant is not in effective state `approved` or `published` fails with `locale_variant_not_approved`, and otherwise the category passes; the `route`, `media` and `privacy` categories stay on the reference gate.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the cms.locale.no_fallback_gate provider and cms_resolve_locale_field (CMS-03C-20) are not built.',
  },
  {
    criterion: 'P2-S12-AC-241',
    text: "Preflight dispatch: each Slice 12 provider is implemented in the deployed preflight evaluation before its registry row is inserted, so that no category evaluates `unavailable` with `provider_unavailable` because its provider is not implemented, and the contracts' per-category closed reason sets and the fixed reason copy accept exactly the reasons of `cms.pattern.active_digest`, `cms.taxonomy.assignment_integrity` and `cms.locale.no_fallback_gate`.",
    clauses: [
      {
        text: "Preflight dispatch: each Slice 12 provider is implemented in the deployed preflight evaluation before its registry row is inserted, so that no category evaluates `unavailable` with `provider_unavailable` because its provider is not implemented, and the contracts' per-category closed reason sets and the fixed reason copy accept exactly the reasons of `cms.pattern.active_digest`, `cms.taxonomy.assignment_integrity` and `cms.locale.no_fallback_gate`.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: no Slice 12 provider is implemented, so neither the dispatch order nor the closed per-category reason sets and copy exist.',
  },
  {
    criterion: 'P2-S12-AC-242',
    text: "Taxonomy-version resolution (DEC-141): `platform_private.cms_resolve_taxonomy_version(p_taxonomy_version_id uuid)` resolves any taxonomy version id of the caller's owner scope, in any state from `draft` through `retired`, to `{ taxonomyId, taxonomyKey, taxonomyVersion, state, contentHash }` and answers an absent or out-of-scope id with the non-disclosing `comparison_unavailable`, so that CMS-03B-03 comparison and the CMS-03B-04 lineage compare recorded taxonomy versions by that identity and no longer fail closed for a non-empty reference.",
    clauses: [
      {
        text: "Taxonomy-version resolution (DEC-141): `platform_private.cms_resolve_taxonomy_version(p_taxonomy_version_id uuid)` resolves any taxonomy version id of the caller's owner scope, in any state from `draft` through `retired`, to `{ taxonomyId, taxonomyKey, taxonomyVersion, state, contentHash }` and answers an absent or out-of-scope id with the non-disclosing `comparison_unavailable`, so that CMS-03B-03 comparison and the CMS-03B-04 lineage compare recorded taxonomy versions by that identity and no longer fail closed for a non-empty reference.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: platform_private.cms_resolve_taxonomy_version does not exist and comparison still fails closed for a non-empty taxonomy reference.',
  },
  {
    criterion: 'P2-S12-AC-243',
    text: "Restore of composition instances (DEC-141): `cms_restore_revision` carries the source revision's `active` composition instances into the new draft revision, each keeping its path and link mode and re-pinned to the current registry, so that a pinned block version that is `withdrawn` fails the restore 409 `migration_chain_incomplete`, a pinned pattern version that is no longer `active` fails it the same way unless the instance is `detached`, and a slot path absent from the current compatible template fails it 409 `template_incompatible`, with nothing fabricated.",
    clauses: [
      {
        text: "Restore of composition instances (DEC-141): `cms_restore_revision` carries the source revision's `active` composition instances into the new draft revision, each keeping its path and link mode and re-pinned to the current registry, so that a pinned block version that is `withdrawn` fails the restore 409 `migration_chain_incomplete`, a pinned pattern version that is no longer `active` fails it the same way unless the instance is `detached`, and a slot path absent from the current compatible template fails it 409 `template_incompatible`, with nothing fabricated.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: cms_restore_revision does not carry composition instances.',
  },
  {
    criterion: 'P2-S12-AC-244',
    text: "Restore of term assignments (DEC-141): each `active` TermAssignment of the source revision is carried to the new revision, an assignment to an `active` or `deprecated` term carrying unchanged, a `merged` term re-pointed to its surviving successor, and an unknown or other-vocabulary term failing the restore 409 `migration_chain_incomplete`, and the new revision's `taxonomy_version_ids` are the vocabularies' current `active` version ids.",
    clauses: [
      {
        text: "Restore of term assignments (DEC-141): each `active` TermAssignment of the source revision is carried to the new revision, an assignment to an `active` or `deprecated` term carrying unchanged, a `merged` term re-pointed to its surviving successor, and an unknown or other-vocabulary term failing the restore 409 `migration_chain_incomplete`, and the new revision's `taxonomy_version_ids` are the vocabularies' current `active` version ids.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: restore copies the source taxonomy_version_ids unchanged and carries no term assignments.',
  },
  {
    criterion: 'P2-S12-AC-245',
    text: "Revision append carry-over (DEC-141): the Slice 12 migration extends `cms_create_revision`, `cms_resolve_conflict` and `cms_restore_revision` so that each carries the base revision's `active` composition instances into the new revision as append-only rows with `carried_from_id` provenance unless the command's pointers explicitly change them, so that an autosave never drops a composition.",
    clauses: [
      {
        text: "Revision append carry-over (DEC-141): the Slice 12 migration extends `cms_create_revision`, `cms_resolve_conflict` and `cms_restore_revision` so that each carries the base revision's `active` composition instances into the new revision as append-only rows with `carried_from_id` provenance unless the command's pointers explicitly change them, so that an autosave never drops a composition.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: cms_create_revision, cms_resolve_conflict and cms_restore_revision carry no composition instances and cms_composition_instances has no carried_from_id.',
  },
  {
    criterion: 'P2-S12-AC-246',
    text: "Taxonomy field values (DEC-141): once Slice 12 registers the taxonomy authority, the 03b `taxonomy` value encoder replaces its fail-closed `taxonomy_source_unavailable` with the rule that each `termId` must be an `active` term of a vocabulary whose active version lists the entry's content type key and the field's key, and a merged, deprecated-for-assignment, unknown or other-vocabulary term is the uniform 422 `VALIDATION_FAILED` reason `term_unavailable`, with the revision's `taxonomy_version_ids` being the active version ids of the vocabularies of its terms.",
    clauses: [
      {
        text: "Taxonomy field values (DEC-141): once Slice 12 registers the taxonomy authority, the 03b `taxonomy` value encoder replaces its fail-closed `taxonomy_source_unavailable` with the rule that each `termId` must be an `active` term of a vocabulary whose active version lists the entry's content type key and the field's key, and a merged, deprecated-for-assignment, unknown or other-vocabulary term is the uniform 422 `VALIDATION_FAILED` reason `term_unavailable`, with the revision's `taxonomy_version_ids` being the active version ids of the vocabularies of its terms.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the taxonomy value encoder still returns taxonomy_source_unavailable for a non-empty value.',
  },
  {
    criterion: 'P2-S12-AC-247',
    text: 'Render plan (DEC-165 receiving obligation): `platform_private.cms_revision_render_plan` takes, for each `(revision_id, path)`, the current (highest `version`) composition instance in state `draft`, `active` or `pending_diff` in template slot order, then path (bytewise) and id, renders a `pending_diff` instance from its pinned version, reads each block-root row of a pattern placement as one block at its own `path` (DEC-175, DEC-181) and excludes `superseded` and `retired` rows, so that the accessibility checker input and the projection compiler read one derivation of what readers get, and field placement changes only if a field-to-slot binding is introduced (none is: template `bindings` map named keys to domain projections).',
    clauses: [
      {
        text: 'Render plan (DEC-165 receiving obligation): `platform_private.cms_revision_render_plan` takes, for each `(revision_id, path)`, the current (highest `version`) composition instance in state `draft`, `active` or `pending_diff` in template slot order, then path (bytewise) and id, renders a `pending_diff` instance from its pinned version, reads each block-root row of a pattern placement as one block at its own `path` (DEC-175, DEC-181) and excludes `superseded` and `retired` rows, so that the accessibility checker input and the projection compiler read one derivation of what readers get, and field placement changes only if a field-to-slot binding is introduced (none is: template `bindings` map named keys to domain projections).',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet for the Slice 12 derivation: the render plan still reads only draft and active rows, with no highest-version selection, pending_diff rendering or block-root rows. The Slice 11 test orders two blocks by path inside one slot only.',
  },
  {
    criterion: 'P2-S12-AC-248',
    text: "Event relay (DEC-166 receiving obligation): Slice 12's forward migration makes every Slice 12 event claimable by the outbox relay under the exact aggregate type its producer writes, including `cms.locale_variant` for `cms.localization.changed.v1` and the aggregate types of `cms.template.activated.v1`, `cms.pattern.activated.v1` and `cms.taxonomy.changed.v1` (`cms_template_version`, `cms_pattern_version`, `cms_taxonomy_version` and `cms_term`, DEC-180 G3), and registers the `cms.pattern.` and `cms.taxonomy.` producer prefixes only as insert-if-absent, so that no claimed event has an unregistered producer or an unlisted aggregate type.",
    clauses: [
      {
        text: "Event relay (DEC-166 receiving obligation): Slice 12's forward migration makes every Slice 12 event claimable by the outbox relay under the exact aggregate type its producer writes, including `cms.locale_variant` for `cms.localization.changed.v1` and the aggregate types of `cms.template.activated.v1`, `cms.pattern.activated.v1` and `cms.taxonomy.changed.v1` (`cms_template_version`, `cms_pattern_version`, `cms_taxonomy_version` and `cms_term`, DEC-180 G3), and registers the `cms.pattern.` and `cms.taxonomy.` producer prefixes only as insert-if-absent, so that no claimed event has an unregistered producer or an unlisted aggregate type.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the relay still pins cms.localization.changed.v1 to cms_content_entry and accepts any registry-key aggregate for the three Slice 12 events.',
  },
  {
    criterion: 'P2-S12-AC-249',
    text: "Activation events: `cms.template.activated.v1` `{ templateId, templateVersionId }` and `cms.pattern.activated.v1` `{ patternId, patternVersionId }` (a new event type registered by Slice 12) are emitted exactly once by CMS-03C-09 only on a committed immediate activation, a committed retirement (naming the retired version) or a committed scheduled execution, in the transaction with the switch and the audit record, have the outbox identity of the switched subject version row (aggregateType `cms_template_version` or `cms_pattern_version`, aggregateId the activated or retired version id, aggregateVersion that row's `version` after the switch, DEC-180 G3) so that every committed command has a unique triple, carry identifiers only (no content values, labels, locale text, target names, secrets, tokens or authority), and are not emitted for a schedule acceptance, a refusal or a governed review state change.",
    clauses: [
      {
        text: "Activation events: `cms.template.activated.v1` `{ templateId, templateVersionId }` and `cms.pattern.activated.v1` `{ patternId, patternVersionId }` (a new event type registered by Slice 12) are emitted exactly once by CMS-03C-09 only on a committed immediate activation, a committed retirement (naming the retired version) or a committed scheduled execution, in the transaction with the switch and the audit record, have the outbox identity of the switched subject version row (aggregateType `cms_template_version` or `cms_pattern_version`, aggregateId the activated or retired version id, aggregateVersion that row's `version` after the switch, DEC-180 G3) so that every committed command has a unique triple, carry identifiers only (no content values, labels, locale text, target names, secrets, tokens or authority), and are not emitted for a schedule acceptance, a refusal or a governed review state change.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: CMS-03C-09 activation, retirement and scheduled execution are not built, so cms.template.activated.v1 and cms.pattern.activated.v1 have no producer.',
  },
  {
    criterion: 'P2-S12-AC-250',
    text: "Taxonomy changed event: `cms.taxonomy.changed.v1` `{ taxonomyId, taxonomyVersionId }` is emitted once per committed CMS-03C-03 term action (carrying the vocabulary's active version id) and by CMS-03C-09 after a taxonomy-version activation or retirement, as an identifier-only event whose outbox identity is the term row for a term action (aggregateType `cms_term`, aggregateId the term id, aggregateVersion the term `version` after the action) and the subject version row for an activation or retirement (aggregateType `cms_taxonomy_version`, aggregateId the version id, aggregateVersion that row's `version` after the switch, DEC-180 G3), and whose consumers refetch aliases and terms under their own authority.",
    clauses: [
      {
        text: "Taxonomy changed event: `cms.taxonomy.changed.v1` `{ taxonomyId, taxonomyVersionId }` is emitted once per committed CMS-03C-03 term action (carrying the vocabulary's active version id) and by CMS-03C-09 after a taxonomy-version activation or retirement, as an identifier-only event whose outbox identity is the term row for a term action (aggregateType `cms_term`, aggregateId the term id, aggregateVersion the term `version` after the action) and the subject version row for an activation or retirement (aggregateType `cms_taxonomy_version`, aggregateId the version id, aggregateVersion that row's `version` after the switch, DEC-180 G3), and whose consumers refetch aliases and terms under their own authority.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: neither the term action RPC nor CMS-03C-09 exists, so cms.taxonomy.changed.v1 has no producer.',
  },
  {
    criterion: 'P2-S12-AC-251',
    text: "Persistence `cms_governed_reviews`: rows are inserted only through `cms_submit_governed_review`, with `state` one of `open`, `approved`, `rejected`, `invalidated`, `subject_kind` one of the three subject kinds, a polymorphic `subject_id` validated by `platform_private.cms_governed_subject_resolve(kind,id)` in the RPC and a BEFORE INSERT trigger, `subject_hash`, `policy_basis_hash` and `approval_evidence_hash` as 64 lowercase hex (the last the JCS SHA-256 of `{ policyBasisHash, subjectHash, subjectId, subjectKind }`), `required_decision_count` 1 to 8 with `recorded_decision_count` at most that count, `required_capabilities` of 1 to 16 and `policy_basis` of 1 to 64 entries, CHECKs tying `protected` to at least 2 decisions and 2 capabilities, `invalidated` to `invalidated_reason` and `approved` or `rejected` to `decided_at`, and `UNIQUE(subject_kind, subject_id) WHERE state IN ('open','approved')`; the frozen columns are immutable, only the named RPCs advance `state`, the recorded count, `activated_at`, `version` and `updated_at` under CAS, and direct UPDATE, DELETE and table grants are revoked.",
    clauses: [
      {
        text: "Persistence `cms_governed_reviews`: rows are inserted only through `cms_submit_governed_review`, with `state` one of `open`, `approved`, `rejected`, `invalidated`, `subject_kind` one of the three subject kinds, a polymorphic `subject_id` validated by `platform_private.cms_governed_subject_resolve(kind,id)` in the RPC and a BEFORE INSERT trigger, `subject_hash`, `policy_basis_hash` and `approval_evidence_hash` as 64 lowercase hex (the last the JCS SHA-256 of `{ policyBasisHash, subjectHash, subjectId, subjectKind }`), `required_decision_count` 1 to 8 with `recorded_decision_count` at most that count, `required_capabilities` of 1 to 16 and `policy_basis` of 1 to 64 entries, CHECKs tying `protected` to at least 2 decisions and 2 capabilities, `invalidated` to `invalidated_reason` and `approved` or `rejected` to `decided_at`, and `UNIQUE(subject_kind, subject_id) WHERE state IN ('open','approved')`; the frozen columns are immutable, only the named RPCs advance `state`, the recorded count, `activated_at`, `version` and `updated_at` under CAS, and direct UPDATE, DELETE and table grants are revoked.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: cms_governed_reviews and cms_submit_governed_review do not exist.',
  },
  {
    criterion: 'P2-S12-AC-252',
    text: "Persistence `cms_governed_review_decisions`: rows are append-only (`state` `recorded`, `version` 1, `updated_at = created_at`, UPDATE, DELETE and direct grants revoked) with `UNIQUE(review_id, reviewer_person_id)`, a NOT NULL `step_up_at`, the `assignment_id` and `assignment_version` recorded, `capability` the satisfied slot, `decision` `approve` or `reject`, a `reason` of 1 to 2000 code points (`char_length`) with `comment_hash` and `reviewed_hash` as 64 hex, the reviewer, slot capability and MFA instant server-derived, `reason` readable only by its decider, and a BEFORE INSERT trigger forbidding a `reviewer_person_id` equal to the review's `submitted_by` or the subject version's creator.",
    clauses: [
      {
        text: "Persistence `cms_governed_review_decisions`: rows are append-only (`state` `recorded`, `version` 1, `updated_at = created_at`, UPDATE, DELETE and direct grants revoked) with `UNIQUE(review_id, reviewer_person_id)`, a NOT NULL `step_up_at`, the `assignment_id` and `assignment_version` recorded, `capability` the satisfied slot, `decision` `approve` or `reject`, a `reason` of 1 to 2000 code points (`char_length`) with `comment_hash` and `reviewed_hash` as 64 hex, the reviewer, slot capability and MFA instant server-derived, `reason` readable only by its decider, and a BEFORE INSERT trigger forbidding a `reviewer_person_id` equal to the review's `submitted_by` or the subject version's creator.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: cms_governed_review_decisions does not exist.',
  },
  {
    criterion: 'P2-S12-AC-253',
    text: "Persistence `cms_governed_review_assignments`: rows are created and revoked only by `cms_assign_governed_reviewer` with `capability_key` fixed to `cms.definition_review`, `actions` fixed to `read` and `decide`, `state` `active` or `revoked`, a `grantor_person_id`, `ends_at` after `starts_at` and at most seven days later, `UNIQUE(review_id, reviewer_person_id) WHERE state = 'active'`, decide authority only while `starts_at <= now < ends_at` on a non-revoked row (rechecked with the standing capability at decision time), an optional `reason` of 1 to 256 code points (`char_length`), no stored acting context or delegation authority, and direct UPDATE, DELETE and grants revoked.",
    clauses: [
      {
        text: "Persistence `cms_governed_review_assignments`: rows are created and revoked only by `cms_assign_governed_reviewer` with `capability_key` fixed to `cms.definition_review`, `actions` fixed to `read` and `decide`, `state` `active` or `revoked`, a `grantor_person_id`, `ends_at` after `starts_at` and at most seven days later, `UNIQUE(review_id, reviewer_person_id) WHERE state = 'active'`, decide authority only while `starts_at <= now < ends_at` on a non-revoked row (rechecked with the standing capability at decision time), an optional `reason` of 1 to 256 code points (`char_length`), no stored acting context or delegation authority, and direct UPDATE, DELETE and grants revoked.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: cms_governed_review_assignments and cms_assign_governed_reviewer do not exist.',
  },
  {
    criterion: 'P2-S12-AC-254',
    text: 'Persistence `cms_governed_review_dependencies`: rows are written only by `cms_submit_governed_review` from the frozen identities with `kind` one of `block`, `pattern`, `content_type` and `canonical_domain`, `UNIQUE(review_id, kind, ref_id)`, immutable (`state` `active`, `version` 1, `updated_at = created_at`), indexes on `(kind, ref_id)` and `review_id` for the recheck job, forced RLS and no grants.',
    clauses: [
      {
        text: 'Persistence `cms_governed_review_dependencies`: rows are written only by `cms_submit_governed_review` from the frozen identities with `kind` one of `block`, `pattern`, `content_type` and `canonical_domain`, `UNIQUE(review_id, kind, ref_id)`, immutable (`state` `active`, `version` 1, `updated_at = created_at`), indexes on `(kind, ref_id)` and `review_id` for the recheck job, forced RLS and no grants.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: cms_governed_review_dependencies does not exist.',
  },
  {
    criterion: 'P2-S12-AC-255',
    text: "Persistence `cms_governed_activation_schedules`: `state` is one of `pending`, `executing`, `completed`, `failed_retryable`, `blocked`, `cancelled`, `reason_code` is non-null exactly for `blocked` and `cancelled` and one of `approval_invalidated`, `dependency_changed`, `activation_authority_ended`, `canonical_source_unavailable`, `retries_exhausted`, `attempt_count` is 0 to 3, `expected_version` is the approved review's version at acceptance, `UNIQUE(subject_kind, subject_id) WHERE state IN ('pending','executing','failed_retryable')` allows one live schedule per subject, the time evidence, lease, retry and `actual_at_utc`/`deviation_seconds` columns exist and are never replaced, and rows are written only by CMS-03C-09 (insert) and the claim and execute RPCs of CMS-03C-19 (CAS on `state` and `version`) with direct UPDATE, DELETE and grants revoked.",
    clauses: [
      {
        text: "Persistence `cms_governed_activation_schedules`: `state` is one of `pending`, `executing`, `completed`, `failed_retryable`, `blocked`, `cancelled`, `reason_code` is non-null exactly for `blocked` and `cancelled` and one of `approval_invalidated`, `dependency_changed`, `activation_authority_ended`, `canonical_source_unavailable`, `retries_exhausted`, `attempt_count` is 0 to 3, `expected_version` is the approved review's version at acceptance, `UNIQUE(subject_kind, subject_id) WHERE state IN ('pending','executing','failed_retryable')` allows one live schedule per subject, the time evidence, lease, retry and `actual_at_utc`/`deviation_seconds` columns exist and are never replaced, and rows are written only by CMS-03C-09 (insert) and the claim and execute RPCs of CMS-03C-19 (CAS on `state` and `version`) with direct UPDATE, DELETE and grants revoked.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: cms_governed_activation_schedules does not exist.',
  },
  {
    criterion: 'P2-S12-AC-256',
    text: 'Persistence `cms_canonical_domain_registry`: rows are seeded by forward migration only, immutable and never writable by a caller (`state` `seeded`, `updated_at = created_at`, `owner_id` the seeding release record), hold `domain` one of `role`, `instrument`, `gear`, `place`, `rights` and `jurisdiction` with `provider_state` `built` or `unbuilt` and `provider_key` and `provider_version` non-null exactly when `built`, `UNIQUE(domain, version)`, the current row of a domain being the one with the greatest `version`; Phase 2 seeds `role` as `built` (its provider reading the Shard 02 role facet assertion projection) and the other five `unbuilt`, and an owning shard registers its provider by inserting a newer row.',
    clauses: [
      {
        text: 'Persistence `cms_canonical_domain_registry`: rows are seeded by forward migration only, immutable and never writable by a caller (`state` `seeded`, `updated_at = created_at`, `owner_id` the seeding release record), hold `domain` one of `role`, `instrument`, `gear`, `place`, `rights` and `jurisdiction` with `provider_state` `built` or `unbuilt` and `provider_key` and `provider_version` non-null exactly when `built`, `UNIQUE(domain, version)`, the current row of a domain being the one with the greatest `version`; Phase 2 seeds `role` as `built` (its provider reading the Shard 02 role facet assertion projection) and the other five `unbuilt`, and an owning shard registers its provider by inserting a newer row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: cms_canonical_domain_registry and its seed do not exist.',
  },
  {
    criterion: 'P2-S12-AC-257',
    text: 'Persistence `cms_pattern_versions` (Slice 12 delta): `compatible_type_ids jsonb NOT NULL` is an array of 1 to 64 UUIDs, `node_count smallint NOT NULL` is between 1 and 512, and `block_tree` is the bounded `PatternNode` forest whose every block key follows the canonical BlockKey grammar.',
    clauses: [
      {
        text: 'Persistence `cms_pattern_versions` (Slice 12 delta): `compatible_type_ids jsonb NOT NULL` is an array of 1 to 64 UUIDs, `node_count smallint NOT NULL` is between 1 and 512, and `block_tree` is the bounded `PatternNode` forest whose every block key follows the canonical BlockKey grammar.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: cms_pattern_versions has no compatible_type_ids or node_count and its block_tree is not the PatternNode forest.',
  },
  {
    criterion: 'P2-S12-AC-258',
    text: "Persistence `cms_composition_instances` (Slice 12 delta): `pending_pattern_version integer` is non-null exactly when `state = 'pending_diff'`, `carried_from_id uuid` references `cms_composition_instances(id)` as the revision-append and restore carry-over provenance, and every instance version is append-only with `updated_at = created_at` and UPDATE and DELETE rejected.",
    clauses: [
      {
        text: "Persistence `cms_composition_instances` (Slice 12 delta): `pending_pattern_version integer` is non-null exactly when `state = 'pending_diff'`,",
        citations: [],
      },
      {
        text: '`carried_from_id uuid` references `cms_composition_instances(id)` as the revision-append and restore carry-over provenance,',
        citations: [],
      },
      {
        text: 'and every instance version is append-only with `updated_at = created_at` and UPDATE and DELETE rejected.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title: 'composition instance version cannot mutate after creation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title: 'composition instance versions reject UPDATE and DELETE',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Uncited: pending_pattern_version non-null exactly when state is pending_diff, and carried_from_id referencing cms_composition_instances(id). Caveat on the cited clause: the DELETE rejection and the updated_at = created_at CHECK have no direct assertion (UPDATE rejection and the guard trigger are asserted).',
  },
  {
    criterion: 'P2-S12-AC-259',
    text: "Persistence `cms_taxonomy_versions` (Slice 12 delta): `canonical_overlap_domains jsonb NOT NULL DEFAULT '[]'` is an array of at most 6 unique members of `role`, `instrument`, `gear`, `place`, `rights` and `jurisdiction`, and a version holds rules only, the terms belonging to the vocabulary.",
    clauses: [
      {
        text: "Persistence `cms_taxonomy_versions` (Slice 12 delta): `canonical_overlap_domains jsonb NOT NULL DEFAULT '[]'` is an array of at most 6 unique members of `role`, `instrument`, `gear`, `place`, `rights` and `jurisdiction`, and a version holds rules only, the terms belonging to the vocabulary.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: cms_taxonomy_versions has no canonical_overlap_domains column.',
  },
  {
    criterion: 'P2-S12-AC-260',
    text: "Persistence `cms_locale_variants` (Slice 12 delta): `field_source_hashes jsonb NOT NULL DEFAULT '{}'` is an object of at most 128 field-id keys to 64-hex hashes, `stale_field_ids jsonb NOT NULL DEFAULT '[]'` is an array of at most 128 UUIDs, the physical state is `draft` or `stale`, and each snapshot is immutable (`updated_at = created_at`), source changes appending a stale or new variant row.",
    clauses: [
      {
        text: "Persistence `cms_locale_variants` (Slice 12 delta): `field_source_hashes jsonb NOT NULL DEFAULT '{}'` is an object of at most 128 field-id keys to 64-hex hashes,",
        citations: [],
      },
      {
        text: "`stale_field_ids jsonb NOT NULL DEFAULT '[]'` is an array of at most 128 UUIDs,",
        citations: [],
      },
      {
        text: 'the physical state is `draft` or `stale`,',
        citations: [],
      },
      {
        text: 'and each snapshot is immutable (`updated_at = created_at`), source changes appending a stale or new variant row.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_related_authority.sql',
            title: 'locale snapshots are append-only',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_related_authority.sql',
            title:
              'locale and related-content versions reject direct writes and mutation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_source_stale.sql',
            title:
              'a changed source appends one stale version for each dependent locale',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'one immutable locale variant is committed',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Uncited: field_source_hashes (object of at most 128 field-id keys to 64-hex hashes), stale_field_ids (array of at most 128 UUIDs) and the physical state restricted to draft or stale (the CHECK still allows five values). Caveat on the cited clause: the updated_at = created_at CHECK has no direct assertion.',
  },
  {
    criterion: 'P2-S12-AC-261',
    text: 'RPC and grant inventory: all fifteen 03c tables use forced RLS with no direct write grants for `authenticated` and `anon`; the named RPCs are the five original commands (`cms_define_template`, `cms_insert_pattern_instance`, `cms_act_taxonomy_term`, `cms_author_locale_variant`, `cms_curate_related_content`) plus `cms_template_latest`, `cms_pattern_latest`, `cms_list_taxonomy_versions`, `cms_list_taxonomy_terms`, `cms_submit_governed_review`, `cms_record_governed_decision`, `cms_assign_governed_reviewer`, `cms_activate_governed_subject`, `cms_get_governed_review`, `cms_list_governed_reviews`, `cms_create_pattern_version`, `cms_list_pattern_selector`, `cms_get_instance_update_diff`, `cms_apply_pattern_update`, `cms_create_taxonomy_version` and `cms_list_taxonomy_selector`, with the internal RPCs `cms_canonical_taxonomy_match`, `cms_claim_due_governed_activations`, `cms_execute_governed_activation`, `cms_resolve_locale_field`, `cms_related_content_public_targets`, `cms_resolve_taxonomy_version`, `cms_invalidate_governed_reviews_for_person` and `cms_recheck_governed_reviews(kind, ref_id, batch)` and the job handlers `cms.pattern.linked_update_scan` and `cms.governed_review.recheck` (typed platform-queue messages) and `cms.taxonomy.merge_converge` (a BE00 jobs row); every SECURITY DEFINER function is schema-qualified with an empty `search_path`, has PUBLIC execute revoked and named grants only, and has positive and negative grant tests.',
    clauses: [
      {
        text: 'RPC and grant inventory: all fifteen 03c tables use forced RLS with no direct write grants for `authenticated` and `anon`; the named RPCs are the five original commands (`cms_define_template`, `cms_insert_pattern_instance`, `cms_act_taxonomy_term`, `cms_author_locale_variant`, `cms_curate_related_content`) plus `cms_template_latest`, `cms_pattern_latest`, `cms_list_taxonomy_versions`, `cms_list_taxonomy_terms`, `cms_submit_governed_review`, `cms_record_governed_decision`, `cms_assign_governed_reviewer`, `cms_activate_governed_subject`, `cms_get_governed_review`, `cms_list_governed_reviews`, `cms_create_pattern_version`, `cms_list_pattern_selector`, `cms_get_instance_update_diff`, `cms_apply_pattern_update`, `cms_create_taxonomy_version` and `cms_list_taxonomy_selector`, with the internal RPCs `cms_canonical_taxonomy_match`, `cms_claim_due_governed_activations`, `cms_execute_governed_activation`, `cms_resolve_locale_field`, `cms_related_content_public_targets`, `cms_resolve_taxonomy_version`, `cms_invalidate_governed_reviews_for_person` and `cms_recheck_governed_reviews(kind, ref_id, batch)` and the job handlers `cms.pattern.linked_update_scan` and `cms.governed_review.recheck` (typed platform-queue messages) and `cms.taxonomy.merge_converge` (a BE00 jobs row); every SECURITY DEFINER function is schema-qualified with an empty `search_path`, has PUBLIC execute revoked and named grants only, and has positive and negative grant tests.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: six of the fifteen 03c tables and most of the listed RPCs and job handlers do not exist; existing grant tests cover only the Slice 09/12 tables.',
  },
  {
    criterion: 'P2-S12-AC-262',
    text: "Governed read scopes: GovernedReview SELECT requires one of the scopes of the governed machinery (the submitter, a non-revoked reviewer assignee, a holder of the subject kind's owner capability, or the receipt-derived owner), a decision's `reason` is readable only by its decider, assignments are serialized only to the owner and the own assignment to its reviewer with no person, actor or party identifier, and `cms_governed_activation_schedules`, `cms_governed_review_dependencies` and `cms_canonical_domain_registry` have no browser or service-role read.",
    clauses: [
      {
        text: "Governed read scopes: GovernedReview SELECT requires one of the scopes of the governed machinery (the submitter, a non-revoked reviewer assignee, a holder of the subject kind's owner capability, or the receipt-derived owner), a decision's `reason` is readable only by its decider, assignments are serialized only to the owner and the own assignment to its reviewer with no person, actor or party identifier, and `cms_governed_activation_schedules`, `cms_governed_review_dependencies` and `cms_canonical_domain_registry` have no browser or service-role read.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the governed review tables and their read policies do not exist.',
  },
  {
    criterion: 'P2-S12-AC-263',
    text: 'Slice 12 metrics: `cms_governed_review_total{subject_kind,outcome}`, `cms_governed_decision_total{decision,outcome}`, `cms_governed_activation_total{subject_kind,action,outcome}`, `cms_governed_review_invalidated_total{reason}`, `cms_governed_schedule_blocked_total{reason}`, `cms_pattern_linked_update_pending_total`, `cms_pattern_update_total{action,outcome}`, `cms_canonical_match_total{domain,outcome}`, `cms_canonical_source_unavailable_total{domain}`, `cms_related_target_ineligible_total`, `cms_locale_fanout_total` and `cms_locale_limit_reached_total` are emitted at the events they name, and labels never carry an id, label text, locale text, hash or person.',
    clauses: [
      {
        text: 'Slice 12 metrics: `cms_governed_review_total{subject_kind,outcome}`, `cms_governed_decision_total{decision,outcome}`, `cms_governed_activation_total{subject_kind,action,outcome}`, `cms_governed_review_invalidated_total{reason}`, `cms_governed_schedule_blocked_total{reason}`, `cms_pattern_linked_update_pending_total`, `cms_pattern_update_total{action,outcome}`, `cms_canonical_match_total{domain,outcome}`, `cms_canonical_source_unavailable_total{domain}`, `cms_related_target_ineligible_total`, `cms_locale_fanout_total` and `cms_locale_limit_reached_total` are emitted at the events they name, and labels never carry an id, label text, locale text, hash or person.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: none of the twelve Slice 12 metrics is emitted.',
  },
  {
    criterion: 'P2-S12-AC-264',
    text: 'Alerts and diagnostics: alerts fire on a DLQ above 0, outbox age above 2 minutes, an activation blocked for more than 15 minutes, a stale locale legal-field count above 0 or a target-filter anomaly, traces cover validation, principal and assignment, registry or projection refetch, idempotency, RPC and SQL, audit and outbox, and consumer refetch, and structured logs and diagnostics carry allowlisted fields only (operation, request id, safe ids and hashes, version, outcome, error code, duration, dependency class, retryability) and never content, locale text, labels, target names, tokens, raw rules or a capability graph.',
    clauses: [
      {
        text: 'Alerts and diagnostics: alerts fire on a DLQ above 0, outbox age above 2 minutes, an activation blocked for more than 15 minutes, a stale locale legal-field count above 0 or a target-filter anomaly, traces cover validation, principal and assignment, registry or projection refetch, idempotency, RPC and SQL, audit and outbox, and consumer refetch, and structured logs and diagnostics carry allowlisted fields only (operation, request id, safe ids and hashes, version, outcome, error code, duration, dependency class, retryability) and never content, locale text, labels, target names, tokens, raw rules or a capability graph.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the Slice 12 alerts, trace coverage and allowlisted diagnostics do not exist; only per-route scrubbed telemetry for CMS-03C-01..05 exists.',
  },
  {
    criterion: 'P2-S12-AC-265',
    text: "Template pages: `/app/cms-content-modeling/templates/new` and `/app/cms-content-modeling/templates/:templateKey` are protected Astro SSR pages (`CmsTemplateDesigner` for create, `CmsTemplateEditDesigner` for a successor from `cmsTemplateLatestRead`) with the bounded `CmsGovernedReviewPanel`: the server verifies the Supabase session, expiry and acting context (a missing or expired session uses the allowlisted 303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without `cms.template_designer` in the owner scope is 403, `context`, `versions` and `new` never resolve as `:templateKey`, `:templateKey` addresses the owner's latest definition, and Back restores the form without serializing a definition.",
    clauses: [
      {
        text: "Template pages: `/app/cms-content-modeling/templates/new` and `/app/cms-content-modeling/templates/:templateKey` are protected Astro SSR pages (`CmsTemplateDesigner` for create, `CmsTemplateEditDesigner` for a successor from `cmsTemplateLatestRead`) with the bounded `CmsGovernedReviewPanel`: the server verifies the Supabase session, expiry and acting context (a missing or expired session uses the allowlisted 303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without `cms.template_designer` in the owner scope is 403, `context`, `versions` and `new` never resolve as `:templateKey`, `:templateKey` addresses the owner's latest definition, and Back restores the form without serializing a definition.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No cited test proves a clause: the template pages exist but their route test only greps the page source text, the real-route specs use an in-memory port, there is no CmsGovernedReviewPanel, and a malformed key renders 404 where this criterion says 400.',
  },
  {
    criterion: 'P2-S12-AC-266',
    text: "Pattern pages: `/app/cms-content-modeling/patterns/new` and `/app/cms-content-modeling/patterns/:patternKey` are protected Astro SSR pages with `CmsPatternVersionDesigner` and the bounded `CmsGovernedReviewPanel`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without `cms.template_designer` is 403, `context`, `versions`, `selector` and `new` are reserved keys, `:patternKey` addresses the owner's latest version (`cmsPatternLatestRead`), and a successor sends the read version as `expectedVersion`.",
    clauses: [
      {
        text: "Pattern pages: `/app/cms-content-modeling/patterns/new` and `/app/cms-content-modeling/patterns/:patternKey` are protected Astro SSR pages with `CmsPatternVersionDesigner` and the bounded `CmsGovernedReviewPanel`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without `cms.template_designer` is 403, `context`, `versions`, `selector` and `new` are reserved keys, `:patternKey` addresses the owner's latest version (`cmsPatternLatestRead`), and a successor sends the read version as `expectedVersion`.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the page and its islands do not exist (patterns/new and patterns/:patternKey with CmsPatternVersionDesigner).',
  },
  {
    criterion: 'P2-S12-AC-267',
    text: 'Taxonomy pages: `/app/cms-content-modeling/taxonomies/new` and `/app/cms-content-modeling/taxonomies/:taxonomyId` are protected Astro SSR pages with `CmsTaxonomyVersionDesigner`, `CmsTaxonomyTermForm` and the bounded `CmsGovernedReviewPanel`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without `cms.taxonomy_curator` in the owner scope is 403, term actions render only against an `active` version, `:taxonomyId` is the vocabulary lineage id, and the term list cursor is URL state that never serializes a protected value.',
    clauses: [
      {
        text: 'Taxonomy pages: `/app/cms-content-modeling/taxonomies/new` and `/app/cms-content-modeling/taxonomies/:taxonomyId` are protected Astro SSR pages with `CmsTaxonomyVersionDesigner`, `CmsTaxonomyTermForm` and the bounded `CmsGovernedReviewPanel`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without `cms.taxonomy_curator` in the owner scope is 403, term actions render only against an `active` version, `:taxonomyId` is the vocabulary lineage id, and the term list cursor is URL state that never serializes a protected value.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the page and its islands do not exist (taxonomies/new and taxonomies/:taxonomyId with CmsTaxonomyVersionDesigner and CmsTaxonomyTermForm).',
  },
  {
    criterion: 'P2-S12-AC-268',
    text: "Definition review pages: `/app/cms-content-modeling/definition-reviews` and `/app/cms-content-modeling/definition-reviews/:reviewId` are protected server-first pages (`CmsGovernedReviewQueue`, `CmsGovernedReviewDetail`, `CmsGovernedDecisionForm`, owner `CmsGovernedAssignmentForm`, `CmsGovernedActivationForm`): the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without the capability is 403, the decision form renders only with an effective assignment, the assignment form only for the owner, the activation form only for the subject's owner-capability holder on an `approved` or `blocked` version, `GovernedReviewQueueQuery` owns `scope`, `state`, `subjectKind`, `limit` and `cursor` in URL state, and the detail URL carries only the immutable `reviewId`.",
    clauses: [
      {
        text: "Definition review pages: `/app/cms-content-modeling/definition-reviews` and `/app/cms-content-modeling/definition-reviews/:reviewId` are protected server-first pages (`CmsGovernedReviewQueue`, `CmsGovernedReviewDetail`, `CmsGovernedDecisionForm`, owner `CmsGovernedAssignmentForm`, `CmsGovernedActivationForm`): the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids or keys are 400, a concealed or absent target is a disclosure-safe 404, a visible target without the capability is 403, the decision form renders only with an effective assignment, the assignment form only for the owner, the activation form only for the subject's owner-capability holder on an `approved` or `blocked` version, `GovernedReviewQueueQuery` owns `scope`, `state`, `subjectKind`, `limit` and `cursor` in URL state, and the detail URL carries only the immutable `reviewId`.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the page and its islands do not exist (definition-reviews and definition-reviews/:reviewId with the queue, detail, decision, assignment and activation components).',
  },
  {
    criterion: 'P2-S12-AC-269',
    text: "Composition page: `/app/cms-content-modeling/entries/:entryId/composition` is a protected server-first page with `CmsCompositionInstanceList`, `CmsPatternSelector` and `CmsPatternUpdateDiff`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids are 400, a concealed or absent target is a disclosure-safe 404, a visible target without entry assignment and edit authority is 403, commands target only the entry's current draft revision, `:entryId` is the only URL state, instance ids are row-local, and Back restores the list without serializing a diff.",
    clauses: [
      {
        text: "Composition page: `/app/cms-content-modeling/entries/:entryId/composition` is a protected server-first page with `CmsCompositionInstanceList`, `CmsPatternSelector` and `CmsPatternUpdateDiff`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids are 400, a concealed or absent target is a disclosure-safe 404, a visible target without entry assignment and edit authority is 403, commands target only the entry's current draft revision, `:entryId` is the only URL state, instance ids are row-local, and Back restores the list without serializing a diff.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the page and its islands do not exist (entries/:entryId/composition with CmsCompositionInstanceList, CmsPatternSelector and CmsPatternUpdateDiff).',
  },
  {
    criterion: 'P2-S12-AC-270',
    text: "Locale page: `/app/cms-content-modeling/entries/:entryId/locales/:locale` is a protected server-first page with `CmsLocaleVariantForm`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids are 400, a concealed or absent target is a disclosure-safe 404, a visible target without entry assignment and edit authority is 403, `:locale` must be a member of the active version's `supportedLocales`, `:entryId`/`:locale` are the only URL state, and the fallback order is read from the version detail and never serialized.",
    clauses: [
      {
        text: "Locale page: `/app/cms-content-modeling/entries/:entryId/locales/:locale` is a protected server-first page with `CmsLocaleVariantForm`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids are 400, a concealed or absent target is a disclosure-safe 404, a visible target without entry assignment and edit authority is 403, `:locale` must be a member of the active version's `supportedLocales`, `:entryId`/`:locale` are the only URL state, and the fallback order is read from the version detail and never serialized.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the page and its islands do not exist (entries/:entryId/locales/:locale with CmsLocaleVariantForm).',
  },
  {
    criterion: 'P2-S12-AC-271',
    text: 'Definition governance states: for `governedReviewState` (CMS-03C-10 and -11), `selectorState` and `latestReadState` (CMS-03C-13 and -17 and the template, pattern, vocabulary-version and term reads), `diffState` (CMS-03C-14) and `commandState` (CMS-03C-01 to -09, -12, -15 and -16) the island renders `idle`, `loading` (a skeleton after 250 ms and only the commit control disabled), `success`, `empty`, `error`, `degraded` and `disabled` exactly as the state table states, server-authoritative, no-store and never optimistic: a 401 `STEP_UP_REQUIRED` routes to `/step-up?returnTo=`, a 403 `capability_missing` or `separation_of_duties` renders the `CapabilityGate` copy, 409 reasons render fixed copy and refetch, 422 reasons render fixed copy at the field, an unknown mutation outcome renders pending and reconciles by refetching the review, subject or entry before any retry, and a degraded diff is never kept but re-required.',
    clauses: [
      {
        text: 'Definition governance states: for `governedReviewState` (CMS-03C-10 and -11), `selectorState` and `latestReadState` (CMS-03C-13 and -17 and the template, pattern, vocabulary-version and term reads), `diffState` (CMS-03C-14) and `commandState` (CMS-03C-01 to -09, -12, -15 and -16) the island renders `idle`, `loading` (a skeleton after 250 ms and only the commit control disabled), `success`, `empty`, `error`, `degraded` and `disabled` exactly as the state table states, server-authoritative, no-store and never optimistic: a 401 `STEP_UP_REQUIRED` routes to `/step-up?returnTo=`, a 403 `capability_missing` or `separation_of_duties` renders the `CapabilityGate` copy, 409 reasons render fixed copy and refetch, 422 reasons render fixed copy at the field, an unknown mutation outcome renders pending and reconciles by refetching the review, subject or entry before any retry, and a degraded diff is never kept but re-required.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: none of the Slice 12 islands exist, so the seven-state tables are untested.',
  },
  {
    criterion: 'P2-S12-AC-272',
    text: 'Governed surface privacy: decision reasons, the policy basis, pattern diff values, canonical ids and every assignment identifier are re-derived by the server and never enter a public or private cache, an analytics event, a Realtime body, a URL or a log, and a browser never calls CMS-03C-18 to CMS-03C-21 because no browser route, form, proxy or client type exists for them.',
    clauses: [
      {
        text: 'Governed surface privacy: decision reasons, the policy basis, pattern diff values, canonical ids and every assignment identifier are re-derived by the server and never enter a public or private cache, an analytics event, a Realtime body, a URL or a log, and a browser never calls CMS-03C-18 to CMS-03C-21 because no browser route, form, proxy or client type exists for them.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: no governed surface, diff view or canonical-id handling exists, and no test asserts that no browser route, form, proxy or client type exists for CMS-03C-18 to CMS-03C-21.',
  },
  {
    criterion: 'P2-S12-AC-273',
    text: 'End-to-end journeys: Playwright, using the real routes and two people, creates, submits, assigns, decides (ordinary and protected) and activates, schedules and retires a template, a pattern and a vocabulary; shows a dependency invalidation returning a subject to draft, a linked pattern update accepted and detached, a term merged with convergence, a locale variant with a `no_fallback` block, and related content pinned and excluded; and runs keyboard-only and at 200% zoom with no diff value, canonical id or person id in the URL, storage, logs or telemetry.',
    clauses: [
      {
        text: 'End-to-end journeys: Playwright, using the real routes and two people, creates, submits, assigns, decides (ordinary and protected) and activates, schedules and retires a template, a pattern and a vocabulary; shows a dependency invalidation returning a subject to draft, a linked pattern update accepted and detached, a term merged with convergence, a locale variant with a `no_fallback` block, and related content pinned and excluded; and runs keyboard-only and at 200% zoom with no diff value, canonical id or person id in the URL, storage, logs or telemetry.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the Slice 12 end-to-end journeys cannot run because governed review, pattern, vocabulary, locale-variant and related-content surfaces are not built.',
  },
  {
    criterion: 'P2-S12-AC-274',
    text: 'Typed refusals: within the Slice 12 catalogs a refusal carries exactly one lowercase `details.reasonCode` from the closed list (`capability_missing`, `separation_of_duties`, `subject_not_submittable`, `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable`, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit`, `dependency_changed`, `subject_not_activatable`, `subject_not_retirable`, `activation_conflict`, `schedule_exists`, `revision_not_editable`, `pattern_cycle`, `diff_has_collisions`, `taxonomy_not_active`, `locale_limit_reached`, `FALLBACK_CHAIN_MISMATCH`, `key_reserved`, `pattern_version_not_active`, `pattern_incompatible`, `nested_pattern_not_active`, `pattern_depth_exceeded`, `pattern_nodes_exceeded`, `diff_too_large`, `canonical_overlap`, `canonical_source_unavailable`, `term_unavailable`, `derived_rule_unknown`, `related_target_ineligible` and the 03b time tokens, each keeping the single status the catalog lists it under: `pattern_version_not_active`, `pattern_incompatible` and `nested_pattern_not_active` are 422 and every governed 409 is `GOVERNED_REVIEW_VERSION_CONFLICT`) plus only the members named for it, a provider timeout or fault is 503 `DEPENDENCY_UNAVAILABLE` and never a success-shaped body, and an unmapped status or a message not generated by its operation catalog is a contract failure treated as 500 `INTERNAL_ERROR` without leaking the original payload.',
    clauses: [
      {
        text: 'Typed refusals: within the Slice 12 catalogs a refusal carries exactly one lowercase `details.reasonCode` from the closed list (`capability_missing`, `separation_of_duties`, `subject_not_submittable`, `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable`, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit`, `dependency_changed`, `subject_not_activatable`, `subject_not_retirable`, `activation_conflict`, `schedule_exists`, `revision_not_editable`, `pattern_cycle`, `diff_has_collisions`, `taxonomy_not_active`, `locale_limit_reached`, `FALLBACK_CHAIN_MISMATCH`, `key_reserved`, `pattern_version_not_active`, `pattern_incompatible`, `nested_pattern_not_active`, `pattern_depth_exceeded`, `pattern_nodes_exceeded`, `diff_too_large`, `canonical_overlap`, `canonical_source_unavailable`, `term_unavailable`, `derived_rule_unknown`, `related_target_ineligible` and the 03b time tokens, each keeping the single status the catalog lists it under: `pattern_version_not_active`, `pattern_incompatible` and `nested_pattern_not_active` are 422 and every governed 409 is `GOVERNED_REVIEW_VERSION_CONFLICT`) plus only the members named for it, a provider timeout or fault is 503 `DEPENDENCY_UNAVAILABLE` and never a success-shaped body, and an unmapped status or a message not generated by its operation catalog is a contract failure treated as 500 `INTERNAL_ERROR` without leaking the original payload.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: of the closed reasonCode list only FALLBACK_CHAIN_MISMATCH exists; the other members, the GOVERNED_REVIEW_VERSION_CONFLICT mapping and the catalog-wide 503/500 rules are not implemented for the unbuilt operations.',
  },
  {
    criterion: 'P2-S12-AC-275',
    text: 'Registry parity: CI matches the discovered Hono routes and the generated OpenAPI to every Slice 12 browser operation ID (CMS-03C-01 to CMS-03C-17 and the five supporting reads) on method and path, request, success and error schemas, auth, CORS, rate, timeout, cache, idempotency, ETag and SLO, and CMS-03C-18 to CMS-03C-21 are absent from the browser route inventory and generated OpenAPI.',
    clauses: [
      {
        text: 'Registry parity: CI matches the discovered Hono routes and the generated OpenAPI to every Slice 12 browser operation ID (CMS-03C-01 to CMS-03C-17 and the five supporting reads) on method and path, request, success and error schemas, auth, CORS, rate, timeout, cache, idempotency, ETag and SLO, and CMS-03C-18 to CMS-03C-21 are absent from the browser route inventory and generated OpenAPI.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test covers the criterion: the registry and OpenAPI contain only CMS-03C-01..05, and nothing asserts CMS-03C-18 to CMS-03C-21 are absent from the browser inventory.',
  },
  {
    criterion: 'P2-S12-AC-276',
    text: "Lock order: the Slice 12 writers (CMS-03C-01 to CMS-03C-09, CMS-03C-12, CMS-03C-15, CMS-03C-16 and CMS-03C-19, the linked-update scan, the revision-append carry-over, the recheck job and the term merge) take their locks in the Slice 12 lock order, the BE03b global write-path order extended by DEC-157 with one position for term rows, and never acquire an earlier position after a later one (the ten CMS-03B-06 decision steps order checks, not locks), re-prove their capability under the locks, and map `deadlock_detected` and a lock-acquisition failure to the 409 code of the operation's catalog (`*_VERSION_CONFLICT`) with nothing committed and the same `Idempotency-Key` reusable.",
    clauses: [
      {
        text: "Lock order: the Slice 12 writers (CMS-03C-01 to CMS-03C-09, CMS-03C-12, CMS-03C-15, CMS-03C-16 and CMS-03C-19, the linked-update scan, the revision-append carry-over, the recheck job and the term merge) take their locks in the Slice 12 lock order, the BE03b global write-path order extended by DEC-157 with one position for term rows, and never acquire an earlier position after a later one (the ten CMS-03B-06 decision steps order checks, not locks), re-prove their capability under the locks, and map `deadlock_detected` and a lock-acquisition failure to the 409 code of the operation's catalog (`*_VERSION_CONFLICT`) with nothing committed and the same `Idempotency-Key` reusable.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: most Slice 12 writers do not exist and no test proves the Slice 12 lock order, capability re-proof under locks or the deadlock mapping.',
  },
  {
    criterion: 'P2-S12-AC-277',
    text: 'Concurrency scenarios: template activation versus block withdrawal, linked pattern update versus local override, term merge versus assignment, locale source edit versus translation, related target unpublish, duplicate and out-of-order events, worker lease expiry and restore-epoch fencing each have a deterministic tested outcome.',
    clauses: [
      {
        text: 'Concurrency scenarios: template activation versus block withdrawal, linked pattern update versus local override, term merge versus assignment, locale source edit versus translation, related target unpublish, duplicate and out-of-order events, worker lease expiry and restore-epoch fencing each have a deterministic tested outcome.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: no Slice 12 race scenario exists; the Slice 10/11 race directories hold no template, pattern, term, locale or related-content cases.',
  },
  {
    criterion: 'P2-S12-AC-278',
    text: 'No leakage: no private locale text, draft composition, unauthorized target, capability or canonical-domain authority enters a public projection, an event payload, a log or a cache.',
    clauses: [
      {
        text: 'No leakage: no private locale text, draft composition, unauthorized target, capability or canonical-domain authority enters a public projection, an event payload, a log or a cache.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test proves the whole criterion: only two pgTAP assertions show locale text absent from the author and stale event payloads; public projection, log, cache and the other four classes are untested.',
  },
  {
    criterion: 'P2-S12-AC-279',
    text: 'Representative-size performance: 64-slot templates, 512-node pattern bounds, 50-term pages, 128 locale fields and 64 related targets meet the Tier 2 p95 < 1,200 ms and RPC < 300 ms targets.',
    clauses: [
      {
        text: 'Representative-size performance: 64-slot templates, 512-node pattern bounds, 50-term pages, 128 locale fields and 64 related targets meet the Tier 2 p95 < 1,200 ms and RPC < 300 ms targets.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: no representative-size fixtures or Slice 12 performance gate exist.',
  },
  {
    criterion: 'P2-S12-AC-280',
    text: 'CMS-15 Author locale variant: given Actor may edit the entry in the requested BCP 47 target locale, a source-locale revision exists for the fields being translated, only schema-localizable fields are in scope, and the ordered fallback chain is the one the active content-type version declares for the target locale (the request may carry it only as an equality expectation), implement locked behavior and completion exactly. Operation: CMS-03C-04 (author locale variant), BE03c ledger 25.05.03.',
    clauses: [
      {
        text: 'CMS-15 Author locale variant: given Actor may edit the entry in the requested BCP 47 target locale,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'member without entry assignment and author/editor capability is denied',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'assigned author receives a draft locale resource tied to the exact source',
          },
        ],
      },
      {
        text: 'a source-locale revision exists for the fields being translated,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'assigned author receives a draft locale resource tied to the exact source',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_revision_integrity.sql',
            title:
              'source locale must match the immutable source revision locale',
          },
        ],
      },
      {
        text: 'only schema-localizable fields are in scope,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'nonlocalizable source-schema field cannot be translated [P2-S09-AC-1166]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'nonlocalizable field cannot be misdeclared as no-fallback [P2-S09-AC-1166]',
          },
        ],
      },
      {
        text: 'and the ordered fallback chain is the one the active content-type version declares for the target locale (the request may carry it only as an equality expectation),',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'the exact active chain and a supported locale author a variant',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'a fallbackChain that differs from the active chain is a 409 version conflict',
          },
        ],
      },
      {
        text: 'implement locked behavior and completion exactly. Operation: CMS-03C-04 (author locale variant), BE03c ledger 25.05.03.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Uncited: implement locked behavior and completion exactly for CMS-03C-04 (the unbuilt per-field staleness, derived state, 33rd-variant refusal and locale aggregate identity of AC-234 to AC-237). Caveat on the cited clauses: evidence is database pgTAP and Worker unit tests; no real-stack (Worker + PostgREST) test exists for CMS-03C-04, and tests/e2e/phase-02-slice-12-locale-real-route.spec.ts runs on an in-memory port.',
  },
  {
    criterion: 'P2-S12-AC-281',
    text: 'CMS-15 Author locale variant: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-15 Author locale variant: preserve declared failure and recovery across invalid authority,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'member without entry assignment and author/editor capability is denied',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'other-tenant entry existence remains concealed',
          },
        ],
      },
      {
        text: 'concurrency,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'stale entry version cannot create a second variant',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'false source hash is rejected before mutation',
          },
        ],
      },
      {
        text: 'revocation,',
        citations: [],
      },
      {
        text: 'deletion,',
        citations: [],
      },
      {
        text: 'and cascade.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Uncited: revocation, deletion and cascade failure-and-recovery for CMS-03C-04 (no test revokes authority mid-flight, deletes a source, or drives the stale cascade through to recovery by revalidation, which is not built). Caveat on the cited clauses: they prove the refusal and that nothing is written; the recovery path in the browser flow is not exercised.',
  },
  {
    criterion: 'P2-S12-AC-282',
    text: '`CMS-15` Author locale variant: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-15` Author locale variant: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the locale page and CmsLocaleVariantForm do not exist.',
  },
  {
    criterion: 'P2-S12-AC-283',
    text: 'CMS-16 Curate related content: given Actor may edit the source entry, every pinned or excluded target is an existing entry the acting context is authorized to reference, and derived candidates come only from explainable bounded deterministic rules over currently authorized projections, implement locked behavior and completion exactly. Operation: CMS-03C-05 (curate related content), BE03c ledger 25.05.04.',
    clauses: [
      {
        text: 'CMS-16 Curate related content: given Actor may edit the source entry, every pinned or excluded target is an existing entry the acting context is authorized to reference, and derived candidates come only from explainable bounded deterministic rules over currently authorized projections, implement locked behavior and completion exactly. Operation: CMS-03C-05 (curate related content), BE03c ledger 25.05.04.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: the curation RPC and its target-authorization and derived-candidate rules are not built; Worker boundary tests use a stubbed port and the production adapter fails closed.',
  },
  {
    criterion: 'P2-S12-AC-284',
    text: 'CMS-16 Curate related content: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-16 Curate related content: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: no related-content write exists to fail or recover.',
  },
  {
    criterion: 'P2-S12-AC-285',
    text: '`CMS-16` Curate related content: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-16` Curate related content: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test can exist yet: no related-content page or form exists.',
  },
];
