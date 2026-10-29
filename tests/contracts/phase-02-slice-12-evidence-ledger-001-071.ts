import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 12 evidence ledger, criteria AC001-AC071. Aggregated by
// tests/contracts/phase-02-slice-12-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-12-evidence-guard.test.ts.
// Re-cited 2026-10-24 from the refuted proposals by docs/handoffs/2026-10-22-claude-s12/recite/apply.mjs (a rerun reproduces it).
export const S12_EVIDENCE_LEDGER_001_071: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S12-AC-001',
    text: 'Preserve reserved profile and provenance regions, block compatibility, audience and locale constraints, and accessibility contracts in templates.',
    clauses: [
      {
        text: 'Preserve reserved profile and provenance regions',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 rejects movement of protected regions',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts bounds reserved regions and strict projection bindings',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route rejects invalid media, headers, unknown authority and protected-region movement before mutation',
          },
        ],
      },
      {
        text: 'block compatibility',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 current registered compatible block creates a draft',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 rejects a registered block whose compiler range excludes the active type compiler_version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 refuses a block after its supported lifecycle ends',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 refuses a withdrawn block without inserting a template',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 incompatible and retired block calls remain atomic refusals',
          },
        ],
      },
      {
        text: 'audience and locale constraints',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts enforces locale, safe audience, and a lowercase optional registry digest',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-keys.test.ts',
            title:
              'CMS-03C-01 template keys, audience and lineage (E13, E4) [P2-S12-AC-025] enforces the BE04c audience grammar ^[a-z0-9_-]{1,48}$ as submitted, never trimmed',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: the stored audience is exactly as submitted, never trimmed or folded [P2-S12-AC-025]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              'CMS-03C-01 define a template version through the real stack [P2-S12-AC-005] [P2-S12-AC-025] [P2-S12-AC-192] an audience outside ^[a-z0-9_-]{1,48}$ is a 422 at /audience and writes nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title: 'E4: a CHECK enforces the audience grammar [P2-S12-AC-192]',
          },
        ],
      },
      {
        text: 'and accessibility contracts in templates.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-accessibility-member.test.ts',
            title:
              'CMS-03C-01 refuses an accessibility member in a template definition [P2-S12-AC-001] the definition: 422 TEMPLATE_VALIDATION_FAILED at its pointer, before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-accessibility-member.test.ts',
            title:
              'CMS-03C-01 refuses an accessibility member in a template definition [P2-S12-AC-001] a slot: 422 TEMPLATE_VALIDATION_FAILED at its pointer, before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-accessibility-member.test.ts',
            title:
              'CMS-03C-01 refuses an accessibility member in a template definition [P2-S12-AC-001] an allowed block reference: 422 TEMPLATE_VALIDATION_FAILED at its pointer, before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-accessibility-member.test.ts',
            title:
              'CMS-03C-01 refuses an accessibility member in a template definition [P2-S12-AC-001] a binding: 422 TEMPLATE_VALIDATION_FAILED at its pointer, before the port',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-accessibility-contract.test.ts',
            title:
              "CMS-03C-01 definition carries no accessibility member the member accessibility [P2-S12-AC-001] is refused as an unrecognized key in 'the definition'",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-accessibility-contract.test.ts',
            title:
              "CMS-03C-01 definition carries no accessibility member the member accessibility [P2-S12-AC-001] is refused as an unrecognized key in 'a slot'",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-accessibility-contract.test.ts',
            title:
              "CMS-03C-01 definition carries no accessibility member the member accessibility [P2-S12-AC-001] is refused as an unrecognized key in 'an allowed block reference'",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-accessibility-contract.test.ts',
            title:
              "CMS-03C-01 definition carries no accessibility member the member accessibility [P2-S12-AC-001] is refused as an unrecognized key in 'a binding'",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-accessibility-contract.test.ts',
            title:
              "CMS-03C-01 definition carries no accessibility member the member accessibilityManifest [P2-S12-AC-001] is refused as an unrecognized key in 'the definition'",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-accessibility-contract.test.ts',
            title:
              "CMS-03C-01 definition carries no accessibility member the member accessibilityManifest [P2-S12-AC-001] is refused as an unrecognized key in 'a slot'",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-accessibility-contract.test.ts',
            title:
              "CMS-03C-01 definition carries no accessibility member the member accessibilityManifest [P2-S12-AC-001] is refused as an unrecognized key in 'an allowed block reference'",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-accessibility-contract.test.ts',
            title:
              "CMS-03C-01 definition carries no accessibility member the member accessibilityManifest [P2-S12-AC-001] is refused as an unrecognized key in 'a binding'",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-accessibility-contract.test.ts',
            title:
              "CMS-03C-01 definition carries no accessibility member the member ariaLabel [P2-S12-AC-001] is refused as an unrecognized key in 'the definition'",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-accessibility-contract.test.ts',
            title:
              "CMS-03C-01 definition carries no accessibility member the member ariaLabel [P2-S12-AC-001] is refused as an unrecognized key in 'a slot'",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-accessibility-contract.test.ts',
            title:
              "CMS-03C-01 definition carries no accessibility member the member ariaLabel [P2-S12-AC-001] is refused as an unrecognized key in 'an allowed block reference'",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-accessibility-contract.test.ts',
            title:
              "CMS-03C-01 definition carries no accessibility member the member ariaLabel [P2-S12-AC-001] is refused as an unrecognized key in 'a binding'",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-accessibility-contract.test.ts',
            title:
              'CMS-03C-01 definition carries no accessibility member [P2-S12-AC-001] a block reference names only the immutable pair, so the contract it points at is the registered one',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-accessibility-contract.test.ts',
            title:
              'CMS-03C-01 definition carries no accessibility member [P2-S12-AC-001] the stored version and the editable detail are closed too, so no accessibility member is ever read back',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p240_block_release.sql',
            title: 'a registered version cannot be mutated [P2-S09-AC-012]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-002',
    text: 'Reject cyclic or over-limit composition trees and retain immutable reusable-pattern versions.',
    clauses: [
      {
        text: 'Reject cyclic or over-limit composition trees',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'self-lineage-cycle: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'indirect-lineage-cycle: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'depth-nine: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'nodes-513: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/065-defensive.sqlinc',
            title:
              'a nested reference to a lineage already on the chain is refused pattern_cycle at /patternId (409) [BE03c 1612]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/065-defensive.sqlinc',
            title:
              'a forest nested 129 levels deep is refused pattern_depth_exceeded at /patternId (422) [BE03c 1612]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/065-defensive.sqlinc',
            title:
              'a forest of 513 block roots is refused pattern_nodes_exceeded at /patternId (422) [BE03c 1612, DEC-175]',
          },
        ],
      },
      {
        text: 'and retain immutable reusable-pattern versions.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title: 'pattern definition cannot mutate in place',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title:
              'direct pattern state transition cannot bypass named RPC authority',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title: 'composition instance version cannot mutate after creation',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-003',
    text: 'Keep taxonomy keys stable, hierarchies acyclic, merges survivor-directed, assignments convergent, and redirects intact.',
    clauses: [
      {
        text: 'Keep taxonomy keys stable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title:
              'a new term cannot reuse a stable key after the original term advances its version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'taxonomy definition is immutable after creation',
          },
        ],
      },
      {
        text: 'hierarchies acyclic',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title: 'a curator cannot reparent a root below its grandchild',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title: 'a rejected cycle leaves the existing hierarchy unchanged',
          },
        ],
      },
      {
        text: 'merges survivor-directed',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'merge requires a permanent survivor redirect',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title: 'a merge cannot redirect to another vocabulary',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title:
              'a merge cannot choose an already-merged redirect as survivor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title: 'a successful merge stores the direct survivor ID',
          },
        ],
      },
      {
        text: 'assignments convergent',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'where the survivor was already assigned the retired assignment is superseded and no duplicate survivor row is appended (convergence) [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'an assignment of the retired term is superseded and re-pointed: the survivor gets an active row at the same position [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'running the convergence again finds nothing to do: it is idempotent [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/097-bulk-continuation.sqlinc',
            title:
              'no (revision, field) holds two survivor rows: the convergence is exactly-once [P2-S12-AC-003]',
          },
        ],
      },
      {
        text: 'and redirects intact.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'a merged term cannot reactivate',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title: 'a merged redirect cannot become a new term parent',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title: 'an existing term cannot move under a merged redirect',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title:
              'a direct survivor cannot later merge while inbound redirects exist',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-004',
    text: 'CMS-03C-01: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03C-01 — CMS-11 — POST /api/v1/cms/templates/versions — TemplateVersionRequest → 201 TemplateVersionResource.',
    clauses: [
      {
        text: 'CMS-03C-01: define strict Zod request, path, query, header, and success contracts',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts accepts the exact bounded draft request and resource without browser authority fields',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts rejects unexpected request or resource fields and unknown resource states',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts requires JSON and a bounded idempotency key, with only an exact strong If-Match for updates',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority documents actual request headers, body, success, and safe errors',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-composition-platform-mutation-fail-closed.test.ts',
            title:
              'CMS-11 first-party template mutation boundary rejects an undeclared query before the protected template write',
          },
        ],
      },
      {
        text: 'and complete the declared happy path',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              'CMS-03C-01 define a template version through the real stack [P2-S12-AC-004] [P2-S12-AC-009] a first version is a strict 201 draft with a strong ETag, one audit event and no outbox event',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              'CMS-03C-01 define a template version through the real stack [P2-S12-AC-004] [P2-S12-AC-007] a successor with the strong If-Match is version 2 in the same lineage and names its parent',
          },
        ],
      },
      {
        text: 'CMS-03C-01 — CMS-11 — POST /api/v1/cms/templates/versions — TemplateVersionRequest → 201 TemplateVersionResource.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers the served template version route with conditional revision control',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/production-worker-runtime-cms-composition.test.ts',
            title:
              'production Worker runtime CMS composition injects a protected template dependency and serves the named route',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-005',
    text: 'CMS-03C-01: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
    clauses: [
      {
        text: 'CMS-03C-01: reject unknown fields',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts rejects unexpected request or resource fields and unknown resource states',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route rejects invalid media, headers, unknown authority and protected-region movement before mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-define.test.ts',
            title:
              'CMS-03C-01 production template adapter quotes successor If-Match once and projects no browser authority key',
          },
        ],
      },
      {
        text: 'and every invalid request value',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              'CMS-03C-01 define a template version through the real stack [P2-S12-AC-005] [P2-S12-AC-189] a reserved key is a 422 whose reasonCode and pointer name /templateKey, and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              'CMS-03C-01 define a template version through the real stack [P2-S12-AC-005] [P2-S12-AC-025] [P2-S12-AC-192] an audience outside ^[a-z0-9_-]{1,48}$ is a 422 at /audience and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              "CMS-03C-01 define a template version through the real stack [P2-S12-AC-005] a value the contract accepts and the database refuses (a compatible type that is not the caller's active type, a reserved concept key) is a 422 with no row",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts enforces immutable template-key grammar and a positive version field',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts bounds compatible content-type identities and rejects malformed IDs',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts rejects off-grammar blocks, invalid versions, slot overflow, and unknown slot keys',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts bounds reserved regions and strict projection bindings',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts enforces locale, safe audience, and a lowercase optional registry digest',
          },
        ],
      },
      {
        text: 'with the exact stable field violation',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts enforces immutable template-key grammar and a positive version field',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts bounds compatible content-type identities and rejects malformed IDs',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts rejects off-grammar blocks, invalid versions, slot overflow, and unknown slot keys',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts bounds reserved regions and strict projection bindings',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route reports safe field violations and authorized version metadata but discards foreign details',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-composition-platform-mutation-error-relay.test.ts',
            title:
              'CMS-11 first-party template mutation boundary bounds validation violations, replaces unknown paths and codes, and drops non-objects',
          },
        ],
      },
      {
        text: 'safe message',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route normalizes a 422 port failure to TEMPLATE_VALIDATION_FAILED without leaking dependency prose',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-composition-platform-mutation-error-relay.test.ts',
            title:
              'CMS-11 first-party template mutation boundary relays only the exact safe template error matrix and scrubs foreign details',
          },
        ],
      },
      {
        text: 'and no state mutation.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 mixed-case duplicate refusal leaves no template row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 rejected calls leave no partial template version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 rejects movement of protected regions',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route rejects invalid media, headers, unknown authority and protected-region movement before mutation',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-006',
    text: 'CMS-03C-01: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
    clauses: [
      {
        text: 'CMS-03C-01: derive actor and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-define.test.ts',
            title:
              'CMS-03C-01 production template adapter calls only the named protected RPC with server session context and an opaque secret',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-define.test.ts',
            title:
              'CMS-03C-01 production template adapter detects a port session that disagrees with the verified auth context',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-define.test.ts',
            title:
              'CMS-03C-01 production template adapter rejects forged operation, authority, headers, and session before any RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-composition-platform-mutation-forward.test.ts',
            title:
              'CMS-11 first-party template mutation boundary forwards only validated JSON and allowlisted session headers to the named Worker route',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS first server-resolved acting party reserves the key',
          },
        ],
      },
      {
        text: 'enforce principal, capability, ownership, scope, and RLS',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route fails closed on missing identity, wrong capability and absent acting party',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 confirmed member without designer grant cannot define templates',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 anonymous caller cannot define templates',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS same key cannot replay across server-resolved acting parties',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'template table has enabled and forced row-level security',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'authenticated browser role cannot write template versions directly',
          },
        ],
      },
      {
        text: 'with the specified 401, 403',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route fails closed on missing identity, wrong capability and absent acting party',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 anonymous caller cannot define templates',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 confirmed member without designer grant cannot define templates',
          },
        ],
      },
      {
        text: 'and 404 boundary.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'a successor of a key only another owner holds is NOT_FOUND [P2-S12-AC-006]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'a key held by another owner is indistinguishable from an unused key on a successor [P2-S12-AC-006] [P2-S12-AC-190]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'the refused successor writes no row for owner B [P2-S12-AC-006]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              'CMS-03C-01 per-owner keys and concealment through the real stack [P2-S12-AC-006] [P2-S12-AC-190] a successor of a key only another owner holds is the same 404 as an unused key, and the database said NOT_FOUND for both',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-007',
    text: 'CMS-03C-01: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03C-01: enforce declared idempotency',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 exact idempotency replay returns identical safe response',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 changed business body still rejects same-key replay',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 same-key retry with fresh trace IDs succeeds',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route uses generated request IDs for absent IDs and rejects missing idempotency',
          },
        ],
      },
      {
        text: 'If-Match or CAS',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 matching If-Match creates a new candidate',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 stale If-Match cannot create a third version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route requires a matching strong If-Match only for a successor version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-define.test.ts',
            title:
              'CMS-03C-01 production template adapter quotes successor If-Match once and projects no browser authority key',
          },
        ],
      },
      {
        text: 'duplicate, replay',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p240_identity.sql',
            title:
              'a template key is never rewritten or reused: defining it again without naming the prior version is refused [P2-S09-AC-001]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 replay does not create another version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 trace-ID retry creates no second template version',
          },
        ],
      },
      {
        text: 'pagination, cache',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-composition-platform-mutation-fail-closed.test.ts',
            title:
              'CMS-11 first-party template mutation boundary rejects an undeclared query before the protected template write',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route creates one draft with exact resource, server-bound context, two quotas and no-store',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route enforces both rate scopes and emits a safe retry envelope',
          },
        ],
      },
      {
        text: 'deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route times out a stalled session and prevents its late continuation from consuming quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route does not start the write when the second quota returns after the deadline',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-define.test.ts',
            title:
              'CMS-03C-01 production template adapter enforces the deadline while reading a stalled 200 RPC body',
          },
        ],
      },
      {
        text: 'and concurrency rules.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 waits for the same-key transaction lock before first-create read, and the lock timeout is the retryable CONFLICT',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 same-key create succeeds after the competing transaction ends',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 stale If-Match cannot create a third version',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-008',
    text: 'CMS-03C-01: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
    clauses: [
      {
        text: 'CMS-03C-01: map every declared domain',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route normalizes a 404 port failure to TEMPLATE_NOT_FOUND without leaking dependency prose',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route normalizes a 409 port failure to TEMPLATE_VERSION_CONFLICT without leaking dependency prose',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route normalizes a 422 port failure to TEMPLATE_VALIDATION_FAILED without leaking dependency prose',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-define.test.ts',
            title:
              'CMS-03C-01 production template adapter maps exact SQL tokens and scrubs prose, but rejects malformed success',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-composition-platform-mutation-error-relay.test.ts',
            title:
              'CMS-11 first-party template mutation boundary relays only the exact safe template error matrix and scrubs foreign details',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route normalizes a 503 port failure to DEPENDENCY_UNAVAILABLE without leaking dependency prose',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route rejects malformed sessions, rate decisions, and dependency throws before a write',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-define.test.ts',
            title:
              'CMS-03C-01 production template adapter fails closed for unavailable and expired transport without leaking a response',
          },
        ],
      },
      {
        text: 'timeout',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-01 template define' the 15-second route deadline answers 504 DEPENDENCY_UNAVAILABLE",
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route enforces both rate scopes and emits a safe retry envelope',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-composition-platform-mutation-error-relay.test.ts',
            title:
              'CMS-11 first-party template mutation boundary relays a 429 resetAt only as a valid RFC 3339 UTC instant (BE00 RATE_LIMITED)',
          },
        ],
      },
      {
        text: 'internal failure to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route normalizes a 500 port failure to INTERNAL_ERROR without leaking dependency prose',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route scrubs an unexpected route exception as INTERNAL_ERROR',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route collapses an undeclared port status and rejects unsafe rate metadata',
          },
        ],
      },
      {
        text: 'and preserve safe recovery.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route reports safe field violations and authorized version metadata but discards foreign details',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-submit.test.ts',
            title:
              'CMS-11 first-party draft submission keeps conflicts distinct from an unknown outcome and scrubs provider text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx',
            title:
              'CMS-11 successor edit and reconciliation keeps unsent values through conflict and requires an explicit latest-version rebase',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.interaction.test.tsx',
            title:
              'CMS-11 template designer interaction keeps the draft values and idempotency key across an uncertain retry',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-009',
    text: 'CMS-03C-01: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03C-01: commit audit and outbox effects atomically where applicable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 successor commits one audit event with its draft',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 rejected calls leave no partial template version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 commits exactly one private draft',
          },
        ],
      },
      {
        text: 'reconcile lost responses without duplicate effects',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 replay does not duplicate the atomic audit event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 trace-ID retry creates no second audit event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 trace-ID retry creates no second template version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 same-key retry replays the original 201 draft',
          },
        ],
      },
      {
        text: 'and emit redacted telemetry.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route creates one draft with exact resource, server-bound context, two quotas and no-store',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route keeps the response stable when telemetry fails',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-010',
    text: 'CMS-03C-02: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03C-02 — CMS-12 — POST /api/v1/cms/compositions/pattern-instances — PatternInstanceRequest → 201 PatternPlacementResource.',
    clauses: [
      {
        text: 'CMS-03C-02: define strict Zod request, path, query, header',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract accepts a bounded linked request and optional digest omission',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract rejects caller authority, unknown fields, bad ids, versions, mode, path, and digest',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract requires canonical JSON, idempotency, and a strong successor validator',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.test.ts',
            title:
              'CMS-03C-02 protected pattern instance route rejects malformed, cross-origin, and missing-authority requests before mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-composition-platform-pattern.test.ts',
            title:
              'CMS-03C-02 first-party private forwarding rejects invalid binding, admission, and body before any Worker call',
          },
        ],
      },
      {
        text: 'and success contracts',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'PatternPlacementResource (CMS-03C-02 201, DEC-175, DEC-181) [P2-S12-AC-010] answers an items list of one or more rows, at most 512 after expansion',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'PatternPlacementResource (CMS-03C-02 201, DEC-175, DEC-181) [P2-S12-AC-010] holds every row to the closed CompositionInstanceResource',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-placement-http.test.ts',
            title:
              'PatternPlacementResource cardinality (schema control, DEC-175/DEC-181) [P2-S12-AC-010] accepts 1 and 512 rows and refuses 0 and 513',
          },
        ],
      },
      {
        text: 'and complete the declared happy path',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-pattern-placement.apispec.ts',
            title:
              'CMS-03C-02 pattern placement happy path through the real stack [P2-S12-AC-010] an assigned author placing an active compatible pattern on the current draft revision is a 201 { items } of CompositionInstanceResource rows, a strong entry ETag, the committed rows and one audit record',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-pattern-placement.apispec.ts',
            title:
              'CMS-03C-02 pattern placement happy path through the real stack [P2-S12-AC-010] a nested pattern reference expands into its block roots: the 201 carries one row per expanded root at consecutive positions under the reference key chain',
          },
        ],
      },
      {
        text: 'CMS-03C-02 — CMS-12 — POST /api/v1/cms/compositions/pattern-instances — PatternInstanceRequest → 201 PatternPlacementResource.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-010] answers CMS-03C-02 with the PatternPlacementResource items list, not a single row',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/production-worker-runtime-cms-composition.test.ts',
            title:
              'production Worker runtime CMS composition injects the pattern instance adapter and mounts CMS-03C-02',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-011',
    text: 'CMS-03C-02: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
    clauses: [
      {
        text: 'CMS-03C-02: reject unknown fields',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract rejects caller authority, unknown fields, bad ids, versions, mode, path, and digest',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.test.ts',
            title:
              'CMS-03C-02 protected pattern instance route rejects malformed, cross-origin, and missing-authority requests before mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/compositions/pattern-instances.test.ts',
            title:
              'first-party CMS pattern instance endpoint (CMS-03C-02) rejects forged origin and caller authority fields before the Worker call',
          },
        ],
      },
      {
        text: 'and every invalid request value',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'version-zero: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'link-mode: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'slot-2: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'digest-malformed: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'overrides-grammar-1: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'overrides-depth: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract rejects caller authority, unknown fields, bad ids, versions, mode, path, and digest',
          },
        ],
      },
      {
        text: 'with the exact stable field violation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'version-zero: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'link-mode: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'slot-2: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'digest-malformed: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'overrides-grammar-1: exact DETAIL pointer or members',
          },
        ],
      },
      {
        text: 'safe message',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.test.ts',
            title:
              'CMS-03C-02 protected pattern instance route returns a redacted conflict without leaking provider details',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-contracts.test.ts',
            title:
              'CMS-03C-02 port result guards and error responses emits only typed public error fields and bounded retry headers',
          },
        ],
      },
      {
        text: 'and no state mutation.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.test.ts',
            title:
              'CMS-03C-02 protected pattern instance route rejects malformed, cross-origin, and missing-authority requests before mutation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'version-zero: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'slot-2: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'overrides-grammar-1: the refusal preserves every captured full row of every store',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-012',
    text: 'CMS-03C-02: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
    clauses: [
      {
        text: 'CMS-03C-02: derive actor and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern.test.ts',
            title:
              'CMS-03C-02 production pattern adapter calls only the named private RPC with server-bound context',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern.test.ts',
            title:
              'CMS-03C-02 production pattern adapter isolates the cached server context from a later caller session and permits editor role',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/compositions/pattern-instances.test.ts',
            title:
              'first-party CMS pattern instance endpoint (CMS-03C-02) rejects forged origin and caller authority fields before the Worker call',
          },
        ],
      },
      {
        text: 'enforce principal, capability, ownership',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-boundary.test.ts',
            title:
              'CMS-03C-02 Worker failure and availability boundaries fails closed on session absence, malformed envelope, or missing capability',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_owner_integrity.sql',
            title:
              'cross-owner revision cannot be used as a composition target',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_owner_integrity.sql',
            title: 'cross-owner pattern cannot be linked into a composition',
          },
        ],
      },
      {
        text: 'scope',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'visible-no-edit: exact SQL message token capability_missing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'rv-after: exact SQL message token capability_missing',
          },
        ],
      },
      {
        text: 'and RLS',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title: 'both composition tables enforce forced RLS',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title:
              'browser and service roles have no direct composition table grants',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title: 'composition row policies require verified CMS RPC context',
          },
        ],
      },
      {
        text: 'with the specified 401, 403',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-boundary.test.ts',
            title:
              'CMS-03C-02 Worker failure and availability boundaries fails closed on session absence, malformed envelope, or missing capability',
          },
        ],
      },
      {
        text: 'and 404 boundary.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'hidden-owner: exact SQL message token NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'unknown-revision: exact SQL message token NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'unknown-pattern: exact SQL message token NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'hidden-owner: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern.test.ts',
            title:
              'CMS-03C-02 production pattern adapter maps private domain failures and transport failures without exposing provider content',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-013',
    text: 'CMS-03C-02: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03C-02: enforce declared idempotency',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title: 'the exact replay succeeds [P2-S12-AC-013]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title: 'the replay returns the stored 201 body [P2-S12-AC-013]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title:
              'the replay writes nothing: no row, no version, no audit, no idempotency change [P2-S12-AC-013]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'p1-mismatch: exact SQL message token IDEMPOTENCY_MISMATCH',
          },
        ],
      },
      {
        text: 'If-Match or CAS',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract [P2-S12-AC-013] ties the strong If-Match to the entry aggregate expectedVersion in the transport view',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'stale: exact SQL message token VERSION_MISMATCH',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'stale: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'p1: the entry aggregate version advanced by exactly one',
          },
        ],
      },
      {
        text: 'duplicate, replay',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title:
              'the replay publishes the stored ETag, not the current entry version [P2-S12-AC-013]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'cl-second: exact SQL message token CONFLICT',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'collide-on-last-root: exact SQL message token CONFLICT',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/050-refusals.sqlinc',
            title:
              'the placement whose LAST root collides wrote none of its five rows: all-or-nothing [P2-S12-AC-218]',
          },
        ],
      },
      {
        text: 'pagination, cache',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.test.ts',
            title:
              'CMS-03C-02 protected pattern instance route returns the authoritative instance and forwards the exact precondition to the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.test.ts',
            title:
              'CMS-03C-02 protected pattern instance route rejects malformed, cross-origin, and missing-authority requests before mutation',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.test.ts',
            title:
              'CMS-03C-02 protected pattern instance route returns the authoritative instance and forwards the exact precondition to the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-boundary.test.ts',
            title:
              'CMS-03C-02 Worker failure and availability boundaries does not reach the mutation when either rate scope rejects or malfunctions',
          },
        ],
      },
      {
        text: 'deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-boundary.test.ts',
            title:
              'CMS-03C-02 Worker failure and availability boundaries returns a deadline when the private mutation does not settle',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-boundary.test.ts',
            title:
              'CMS-03C-02 Worker failure and availability boundaries stops between rate scopes after a deadline abort',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern.test.ts',
            title:
              'CMS-03C-02 production pattern adapter applies the total deadline to both private error and success body reads',
          },
        ],
      },
      {
        text: 'and concurrency rules.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "and concurrency rules.": missing test: race (tool race) under supabase/tests (new phase_02_slice_12_pattern_placement.race.mjs, runner infra/database-races) driving two simultaneous cms_insert_pattern_instance calls into one (revision, slot) from independent sessions and asserting serialised consecutive positions, no duplicate (revision_id, path), exactly one winner on the same path, and the revision/slot lock order of BE03c (pattern placement section ~1519: "computed under the revision/slot lock", DEC-185). No race module touches cms_insert_pattern_instance today; the pgTAP suite is single-session by its own header.',
  },
  {
    criterion: 'P2-S12-AC-014',
    text: 'CMS-03C-02: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
    clauses: [
      {
        text: 'CMS-03C-02: map every declared domain',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.test.ts',
            title:
              'CMS-03C-02 protected pattern instance route returns a redacted conflict without leaking provider details',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern.test.ts',
            title:
              'CMS-03C-02 production pattern adapter maps private domain failures and transport failures without exposing provider content',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-composition-platform-pattern.test.ts',
            title:
              'CMS-03C-02 first-party private forwarding requires a typed upstream error and strips private fields by status',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-02 pattern instance' a port failure of 503 answers that status as DEPENDENCY_UNAVAILABLE with the bound message and closed details",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-02 pattern instance' a port that throws answers 503 DEPENDENCY_UNAVAILABLE without its prose",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-02 pattern instance' a malformed port envelope answers 502 DEPENDENCY_UNAVAILABLE",
          },
        ],
      },
      {
        text: 'timeout',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-02 pattern instance' the 15-second route deadline answers 504 DEPENDENCY_UNAVAILABLE",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-boundary.test.ts',
            title:
              'CMS-03C-02 Worker failure and availability boundaries returns a deadline when the private mutation does not settle',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern.test.ts',
            title:
              'CMS-03C-02 production pattern adapter applies the total deadline to both private error and success body reads',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-boundary.test.ts',
            title:
              'CMS-03C-02 Worker failure and availability boundaries does not reach the mutation when either rate scope rejects or malfunctions',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-composition-platform-pattern.test.ts',
            title:
              'CMS-03C-02 first-party private forwarding relays a 429 resetAt only as a valid RFC 3339 UTC instant (BE00 RATE_LIMITED)',
          },
        ],
      },
      {
        text: 'internal failure to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-boundary.test.ts',
            title:
              'CMS-03C-02 Worker failure and availability boundaries scrubs an unexpected admission exception as a 500 response',
          },
        ],
      },
      {
        text: 'and preserve safe recovery.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.test.ts',
            title:
              'CMS-03C-02 protected pattern instance route returns a redacted conflict without leaking provider details',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-015',
    text: 'CMS-03C-02: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03C-02: commit audit and outbox effects atomically where applicable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'p1: one audit record names the placement',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title:
              'a placement with no live review emits no outbox event (BE03c 1504: audit only)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title:
              'the live review is invalidated dependency_changed in the same transaction, version advanced once [P2-S12-AC-219]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title:
              'the placement emits exactly the one review-changed event of the invalidation it performed [P2-S12-AC-219]',
          },
        ],
      },
      {
        text: 'reconcile lost responses without duplicate effects',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title: 'the exact replay succeeds [P2-S12-AC-013]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title: 'the replay returns the stored 201 body [P2-S12-AC-013]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title:
              'the replay publishes the stored ETag, not the current entry version [P2-S12-AC-013]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/040-positive.sqlinc',
            title:
              'the replay writes nothing: no row, no version, no audit, no idempotency change [P2-S12-AC-013]',
          },
        ],
      },
      {
        text: 'and emit redacted telemetry.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern.test.ts',
            title:
              'CMS-03C-02 production pattern adapter emits a redacted operational telemetry event',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-boundary.test.ts',
            title:
              'CMS-03C-02 Worker failure and availability boundaries isolates asynchronous and synchronous telemetry failures from the result',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-016',
    text: 'CMS-03C-03: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03C-03 — CMS-14 — POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions — TaxonomyTermActionRequest → 200 TaxonomyTermResource.',
    clauses: [
      {
        text: 'CMS-03C-03: define strict Zod request, path, query, header, and success contracts',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract requires exact transport path, headers, and body without extra authority selectors',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract rejects unknown fields, invented actions, invalid identity, keys, and versions',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract requires JSON, idempotency, and strong version binding',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract accepts only the closed browser-safe term resource',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-taxonomy-term-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-03 canonical API authority publishes the path, strong headers, action body, 200 resource, and safe errors',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route rejects malformed path, body, media, and strong preconditions before the port',
          },
        ],
      },
      {
        text: 'and complete the declared happy path',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-taxonomy-term-action.apispec.ts',
            title:
              'CMS-03C-03 term action happy path through the real stack [P2-S12-AC-016] a taxonomy curator creating a term in the active flat vocabulary is a 200 with the closed TaxonomyTermResource, the quoted term version as ETag, the committed term and labels, one audit record and one taxonomy event',
          },
        ],
      },
      {
        text: 'CMS-03C-03 — CMS-14 — POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions — TaxonomyTermActionRequest → 200 TaxonomyTermResource.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-taxonomy-term-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-03 canonical API authority registers the served taxonomy-term operation with its declared protections',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/production-worker-runtime-cms-composition.test.ts',
            title:
              'production Worker runtime CMS composition injects the taxonomy action boundary and mounts CMS-03C-03',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-017',
    text: 'CMS-03C-03: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
    clauses: [
      {
        text: 'CMS-03C-03: reject unknown fields',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract rejects unknown fields, invented actions, invalid identity, keys, and versions',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route rejects malformed path, body, media, and strong preconditions before the port',
          },
        ],
      },
      {
        text: 'and every invalid request value',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract rejects unknown fields, invented actions, invalid identity, keys, and versions',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms.sql',
            title: 'validation case action-unknown [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms.sql',
            title: 'validation case taxonomy-id-text [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms.sql',
            title: 'validation case version-leading-zero [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms.sql',
            title: 'validation case idempotency-short [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms.sql',
            title: 'validation case key-upper [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms.sql',
            title: 'validation case merge-without-survivor [P2-S12-AC-017]',
          },
        ],
      },
      {
        text: 'with the exact stable field violation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms.sql',
            title: 'validation case action-unknown [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms.sql',
            title: 'validation case key-upper [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms.sql',
            title: 'validation case parent-text [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms.sql',
            title: 'validation case survivor-on-create [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/060-hierarchy.sqlinc',
            title: 'an unknown parent is 422 at /parentId [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title: 'an unknown survivor is 422 at /survivorId [P2-S12-AC-017]',
          },
        ],
      },
      {
        text: 'safe message',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route sanitizes conflict details and rejects invalid port output',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route checks successful port output and scrubs provider-private failure details',
          },
        ],
      },
      {
        text: 'and no state mutation.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route rejects malformed path, body, media, and strong preconditions before the port',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms.sql',
            title:
              'no validation refusal changed a term, label, assignment, audit, outbox, idempotency or job row (102 cases) [P2-S12-AC-017]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-018',
    text: 'CMS-03C-03: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
    clauses: [
      {
        text: 'CMS-03C-03: derive actor and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract requires exact transport path, headers, and body without extra authority selectors',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route enforces origin, CSRF, human session, and curator capability',
          },
        ],
      },
      {
        text: 'enforce principal, capability, ownership',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route enforces origin, CSRF, human session, and curator capability',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title: 'term parent must belong to the same vocabulary and owner',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title: 'assignment cannot attach a foreign-owner revision',
          },
        ],
      },
      {
        text: 'scope',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              "a real curator of ANOTHER organization asking for this owner's vocabulary gets the same refusal [P2-S12-AC-018]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              'a readable member with the editor capability but no curator capability is refused 403 capability_missing [P2-S12-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              'the author capability is not the curator capability [P2-S12-AC-018]',
          },
        ],
      },
      {
        text: 'and RLS',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'every taxonomy table has enabled and forced RLS',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title:
              'anon authenticated and service roles have no direct taxonomy table grants',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'taxonomy row policies require verified CMS RPC context',
          },
        ],
      },
      {
        text: 'with the specified 401, 403',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route enforces origin, CSRF, human session, and curator capability',
          },
        ],
      },
      {
        text: 'and 404 boundary.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              'a caller who is not a member of the owner party gets the concealing 404 [P2-S12-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title: 'an absent vocabulary is the concealing 404 [P2-S12-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              "another organization's vocabulary gives the very same complete refusal as an absent one: no existence oracle [P2-S12-AC-018]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title: 'no refused probe created a term [P2-S12-AC-018]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-019',
    text: 'CMS-03C-03: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03C-03: enforce declared idempotency',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/030-create.sqlinc',
            title:
              'an exact same-key replay returns the original response and writes no second term, label, audit, outbox or idempotency row [P2-S12-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/030-create.sqlinc',
            title:
              'the same key with a different body is IDEMPOTENCY_MISMATCH and changes nothing [P2-S12-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/030-create.sqlinc',
            title: 'the mismatch left every store identical [P2-S12-AC-019]',
          },
        ],
      },
      {
        text: 'If-Match or CAS',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 If-Match operand [P2-S12-AC-019] ties the strong If-Match to the active taxonomy version expectedVersion, reported at headers.ifMatch',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              'an operand that is not the active definition version is 409 TAXONOMY_VERSION_CONFLICT [P2-S12-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title: 'a stale operand changed nothing [P2-S12-AC-019]',
          },
        ],
      },
      {
        text: 'duplicate',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title:
              'a new term cannot reuse a stable key after the original term advances its version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/030-create.sqlinc',
            title:
              'a second create of an existing key under a new idempotency key is a 409 duplicate; the stable key never moves [P2-S12-AC-019]',
          },
        ],
      },
      {
        text: 'replay',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/030-create.sqlinc',
            title:
              'an exact same-key replay returns the original response and writes no second term, label, audit, outbox or idempotency row [P2-S12-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/070-rename-alias-deprecate.sqlinc',
            title:
              'a same-key rename replay returns the original response and appends no second label, event or audit row [P2-S12-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'a same-key merge replay returns the original response and converges nothing twice [P2-S12-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              'with the authority restored the same key replays the original response [P2-S12-AC-019]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-act.test.ts',
            title:
              'CMS-03C-03 production port: the named RPC (BE03c 1447, 1506) replays the identical bytes and key on a repeated request (no retry, no regeneration)',
          },
        ],
      },
      {
        text: 'pagination, cache',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route serves a validated term from the protected port with both rate buckets',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route rejects malformed path, body, media, and strong preconditions before the port',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route serves a validated term from the protected port with both rate buckets',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route honors rate refusal, dependency failure, and the 15-second deadline',
          },
        ],
      },
      {
        text: 'deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route honors rate refusal, dependency failure, and the 15-second deadline',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route aborts before rate or mutation if admission completes only after the deadline',
          },
        ],
      },
      {
        text: 'and concurrency rules.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "and concurrency rules.": missing test: race (tool race) under supabase/tests (new phase_02_slice_12_taxonomy_term_action.race.mjs, runner infra/database-races) driving two simultaneous cms_act_taxonomy_term calls on one vocabulary/term from independent sessions, asserting the term lock / active-version CAS serialises them (exactly one winner of a duplicate stable key; a stale active-version operand loses), per BE03c lock order (position 1 locks, lines ~1344-1351) and the merge convergence lock order (1338). Only structural lock-order assertions exist (085-continuation.sqlinc:197,200) and single-session forms.',
  },
  {
    criterion: 'P2-S12-AC-020',
    text: 'CMS-03C-03: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
    clauses: [
      {
        text: 'CMS-03C-03: map every declared domain',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route sanitizes conflict details and rejects invalid port output',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route checks successful port output and scrubs provider-private failure details',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy.test.ts',
            title:
              'CMS-03C-03 production taxonomy boundary has no implicit allow when production auth or rate dependencies are absent',
          },
        ],
      },
      {
        text: 'timeout',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-03 taxonomy term action' the 15-second route deadline answers 504 DEPENDENCY_UNAVAILABLE",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-act.test.ts',
            title:
              'CMS-03C-03 production port: response contract and transport (BE00 172, 592) aborts a nonsettling transport at the deadline without retrying',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route honors rate refusal, dependency failure, and the 15-second deadline',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route publishes the BE00 429 contract with second-granularity reset and matching headers',
          },
        ],
      },
      {
        text: 'internal failure to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route returns a safe internal error if unexpected execution fails and ignores telemetry failure',
          },
        ],
      },
      {
        text: 'and preserve safe recovery.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-act.test.ts',
            title:
              'CMS-03C-03 production port: response contract and transport (BE00 172, 592) a dependency that throws is a retryable 503 and the mutation is not retried',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route publishes the BE00 429 contract with second-granularity reset and matching headers',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx',
            title:
              'CmsTaxonomyTermForm: the other term action outcomes keeps the entries and says the service is unavailable for a dependency failure',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-021',
    text: 'CMS-03C-03: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03C-03: commit audit and outbox effects atomically where applicable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/030-create.sqlinc',
            title:
              'exactly one cms.taxonomy.changed.v1 (aggregate cms_term at the term version, payload { taxonomyId, taxonomyVersionId }) and one audit record commit [P2-S12-AC-021]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/070-rename-alias-deprecate.sqlinc',
            title:
              'rename committed exactly one more event (aggregate version 2) and one audit record [P2-S12-AC-021]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'the merge committed ONE taxonomy event (not one per assignment) and one audit record, and needed no continuation job [P2-S12-AC-021]',
          },
        ],
      },
      {
        text: 'reconcile lost responses without duplicate effects',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/030-create.sqlinc',
            title:
              'an exact same-key replay returns the original response and writes no second term, label, audit, outbox or idempotency row [P2-S12-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'a same-key merge replay returns the original response and converges nothing twice [P2-S12-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/096-job-fence.sqlinc',
            title:
              'after a re-claim the stale delivery, the right version with another token, the right token with another version and a future version are all 409 [P2-S12-AC-021]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/096-job-fence.sqlinc',
            title: 'and none of them wrote a row [P2-S12-AC-021]',
          },
        ],
      },
      {
        text: 'and emit redacted telemetry.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route returns a safe internal error if unexpected execution fails and ignores telemetry failure',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-taxonomy.test.ts',
            title:
              'CMS-03C-03 canonical counters counts a canonical_overlap refusal as a match in the published domain, and the canonical id nowhere',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-taxonomy.test.ts',
            title:
              'CMS-03C-03 request traces lists the stages of a committed term action in the BE03c order',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-022',
    text: "Enforce CMS-03C-01: templateKey/version; key /^[a-z][a-z0-9-]{1,63}$/ and not a reserved key (`context`, `versions`, `new`); version positive integer; the (owner, key, version) triple never reused; first version `expectedVersion: null`, a successor names its parent's `version`; 422/409.",
    clauses: [
      {
        text: 'Enforce CMS-03C-01: templateKey/version; key /^[a-z][a-z0-9-]{1,63}$/',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts enforces immutable template-key grammar and a positive version field',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-request.test.ts',
            title:
              'CMS-11 template draft request refuses an immutable-key mismatch or stale protected picker choice before successor POST',
          },
        ],
      },
      {
        text: 'not a reserved key (`context`, `versions`, `new`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-keys.test.ts',
            title:
              'CMS-03C-01 template keys, audience and lineage (E13, E4) [P2-S12-AC-189] refuses a reserved templateKey at /templateKey with the key_reserved reason',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts',
            title:
              'E13 reserved template keys at the route refuses the reserved key versions with 422, key_reserved and a /templateKey pointer, before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts',
            title:
              'E13 reserved template keys at the route refuses the reserved key new with 422, key_reserved and a /templateKey pointer, before the port',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E13: a CHECK refuses the reserved template keys [P2-S12-AC-189]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E13: the RPC refuses the reserved key versions with key_reserved at /templateKey [P2-S12-AC-189]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E13: the RPC refuses the reserved key new with key_reserved at /templateKey [P2-S12-AC-189]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title: 'E13: a refused reserved key writes no row [P2-S12-AC-189]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              'CMS-03C-01 define a template version through the real stack [P2-S12-AC-005] [P2-S12-AC-189] a reserved key is a 422 whose reasonCode and pointer name /templateKey, and writes nothing',
          },
        ],
      },
      {
        text: 'version positive integer',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts enforces immutable template-key grammar and a positive version field',
          },
        ],
      },
      {
        text: 'the (owner, key, version) triple never reused',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p240_identity.sql',
            title:
              'a template key is never rewritten or reused: defining it again without naming the prior version is refused [P2-S09-AC-001]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 stale If-Match cannot create a third version',
          },
        ],
      },
      {
        text: "first version `expectedVersion: null`, a successor names its parent's `version`",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 matching If-Match creates a new candidate',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 successor retains exact prior-version provenance',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route requires a matching strong If-Match only for a successor version',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts requires JSON and a bounded idempotency key, with only an exact strong If-Match for updates',
          },
        ],
      },
      {
        text: '422/409.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route normalizes a 409 port failure to TEMPLATE_VERSION_CONFLICT without leaking dependency prose',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route normalizes a 422 port failure to TEMPLATE_VALIDATION_FAILED without leaking dependency prose',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-define.test.ts',
            title:
              'CMS-03C-01 production template adapter maps exact SQL tokens and scrubs prose, but rejects malformed success',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-023',
    text: 'Enforce CMS-03C-01: compatibleTypeIds; 1–64 UUIDs, each active/allowlisted ContentTypeVersion family; 422.',
    clauses: [
      {
        text: 'Enforce CMS-03C-01: compatibleTypeIds; 1–64 UUIDs',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts bounds compatible content-type identities and rejects malformed IDs',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 same UUID with different letter case is one compatible type',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 named RPC refuses the same compatible type in mixed case',
          },
        ],
      },
      {
        text: 'each active',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql',
            title:
              'a caller-owned content type whose state is retired (with an active version) is refused VALIDATION_FAILED [P2-S12-AC-023]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql',
            title:
              'an active caller-owned content type with no active version is refused VALIDATION_FAILED [P2-S12-AC-023]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql',
            title:
              'one inactive member among valid members refuses the whole list [P2-S12-AC-023]',
          },
        ],
      },
      {
        text: '/allowlisted',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db3_template_owner.sql',
            title:
              'an ACTIVE content type with an ACTIVE version that belongs to another owner is refused VALIDATION_FAILED [P2-S12-AC-023]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db3_template_owner.sql',
            title:
              'one other-owner member among valid owned members refuses the whole list [P2-S12-AC-023]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db3_template_owner.sql',
            title:
              'the other-owner member refuses the list wherever it stands in it [P2-S12-AC-023]',
          },
        ],
      },
      {
        text: 'ContentTypeVersion family',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql',
            title:
              'an active caller-owned content type with no active version is refused VALIDATION_FAILED [P2-S12-AC-023]',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route normalizes a 422 port failure to TEMPLATE_VALIDATION_FAILED without leaking dependency prose',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-define.test.ts',
            title:
              'CMS-03C-01 production template adapter maps exact SQL tokens and scrubs prose, but rejects malformed success',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 refuses nonexistent or inactive compatible types',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-024',
    text: 'Enforce CMS-03C-01: slots/reservedRegions; strict JSON manifests; ≤64 slots, ≤32 reserved names; fixed Shard 02 Header→Now→Record→Detail/provenance regions immutable; 422.',
    clauses: [
      {
        text: 'Enforce CMS-03C-01: slots/reservedRegions; strict JSON manifests',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts rejects off-grammar blocks, invalid versions, slot overflow, and unknown slot keys',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts bounds reserved regions and strict projection bindings',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 valid nonempty allowed-block manifest is structurally accepted',
          },
        ],
      },
      {
        text: '≤64 slots, ≤32 reserved names',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts rejects off-grammar blocks, invalid versions, slot overflow, and unknown slot keys',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts bounds reserved regions and strict projection bindings',
          },
        ],
      },
      {
        text: 'fixed Shard 02 Header→Now→Record→Detail/provenance regions immutable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 rejects movement of protected regions',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts bounds reserved regions and strict projection bindings',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route rejects invalid media, headers, unknown authority and protected-region movement before mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-request.test.ts',
            title:
              'CMS-11 template draft request builds a complete schema-validated create body with the protected spine',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route normalizes a 422 port failure to TEMPLATE_VALIDATION_FAILED without leaking dependency prose',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route rejects invalid media, headers, unknown authority and protected-region movement before mutation',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-025',
    text: 'Enforce CMS-03C-01: bindings/locale/audience; strict binding manifest; BCP 47 locale; audience `^[a-z0-9_-]{1,48}$` matched as submitted and never trimmed; 422.',
    clauses: [
      {
        text: 'Enforce CMS-03C-01: bindings/locale/audience; strict binding manifest',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts bounds reserved regions and strict projection bindings',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-request.test.ts',
            title:
              'CMS-11 template draft request rejects duplicate binding names and invalid slot values before POST',
          },
        ],
      },
      {
        text: 'BCP 47 locale',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts enforces locale, safe audience, and a lowercase optional registry digest',
          },
        ],
      },
      {
        text: 'audience `^[a-z0-9_-]{1,48}$` matched as submitted and never trimmed',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-keys.test.ts',
            title:
              'CMS-03C-01 template keys, audience and lineage (E13, E4) [P2-S12-AC-025] enforces the BE04c audience grammar ^[a-z0-9_-]{1,48}$ as submitted, never trimmed',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts',
            title:
              'E4 audience grammar at the route refuses an audience of a leading space with 422 at /audience, before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts',
            title:
              'E4 audience grammar at the route refuses an audience of a trailing space with 422 at /audience, before the port',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: the RPC refuses audience with a leading space at /audience [P2-S12-AC-192] [P2-S12-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: the RPC refuses audience of 49 characters at /audience [P2-S12-AC-192] [P2-S12-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: the stored audience is exactly as submitted, never trimmed or folded [P2-S12-AC-025]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              'CMS-03C-01 define a template version through the real stack [P2-S12-AC-005] [P2-S12-AC-025] [P2-S12-AC-192] an audience outside ^[a-z0-9_-]{1,48}$ is a 422 at /audience and writes nothing',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route normalizes a 422 port failure to TEMPLATE_VALIDATION_FAILED without leaking dependency prose',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-026',
    text: "Enforce CMS-03C-02: revisionId/patternId; UUIDs; `revisionId` is the entry's current draft revision (effective state `draft`, else 409 `revision_not_editable`) readable by the caller; `patternId` a lineage id of the caller's owner scope; 422/404.",
    clauses: [
      {
        text: 'Enforce CMS-03C-02: revisionId/patternId; UUIDs',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract rejects caller authority, unknown fields, bad ids, versions, mode, path, and digest',
          },
        ],
      },
      {
        text: "`revisionId` is the entry's current draft revision (effective state `draft`, else 409 `revision_not_editable`) readable by the caller",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'old-revision: exact SQL message token revision_not_editable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'submitted-revision: exact SQL message token revision_not_editable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'archived-entry: exact SQL message token revision_not_editable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'current-revision: the placement succeeds',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'hidden-owner: exact SQL message token NOT_FOUND',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-reasons.test.ts',
            title:
              'CMS-03C-02 route typed Slice 12 refusals publishes revision_not_editable as 409 COMPOSITION_VERSION_CONFLICT with exactly its reasonCode',
          },
        ],
      },
      {
        text: "`patternId` a lineage id of the caller's owner scope",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_placement.sql',
            title: 'foreign-lineage: exact SQL message token NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_placement.sql',
            title:
              'a foreign lineage is indistinguishable from an absent one [P2-S12-AC-043]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_placement.sql',
            title:
              "control: the caller's own active pattern places on the same revision [P2-S12-AC-043]",
          },
        ],
      },
      {
        text: '422/404.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.malformed-ids.test.ts',
            title:
              '[P2-S12-AC-026] CMS-03C-02 malformed body ids a malformed revisionId (not-a-uuid) is 422 COMPOSITION_VALIDATION_FAILED at that member and never reaches the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.malformed-ids.test.ts',
            title:
              '[P2-S12-AC-026] CMS-03C-02 malformed body ids a malformed revisionId (a number) is 422 COMPOSITION_VALIDATION_FAILED at that member and never reaches the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.malformed-ids.test.ts',
            title:
              '[P2-S12-AC-026] CMS-03C-02 malformed body ids a malformed patternId (not-a-uuid) is 422 COMPOSITION_VALIDATION_FAILED at that member and never reaches the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.malformed-ids.test.ts',
            title:
              '[P2-S12-AC-026] CMS-03C-02 malformed body ids a malformed patternId (a 37-character uuid) is 422 COMPOSITION_VALIDATION_FAILED at that member and never reaches the port',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_placement.sql',
            title: 'foreign-lineage: exact SQL message token NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_placement.sql',
            title: 'absent-lineage: exact SQL message token NOT_FOUND',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern.test.ts',
            title:
              'CMS-03C-02 production pattern adapter maps private domain failures and transport failures without exposing provider content',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-027',
    text: "Enforce CMS-03C-02: patternVersion/linkMode; positive version naming an `active` PatternVersion of that lineage whose `compatibleTypeIds` lists the revision's content type (else 422 `pattern_version_not_active` or `pattern_incompatible`); linked or detached only; 422.",
    clauses: [
      {
        text: 'Enforce CMS-03C-02: patternVersion/linkMode; positive version',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract rejects caller authority, unknown fields, bad ids, versions, mode, path, and digest',
          },
        ],
      },
      {
        text: "naming an `active` PatternVersion of that lineage whose `compatibleTypeIds` lists the revision's content type (else 422 `pattern_version_not_active` or `pattern_incompatible`)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'draft-pattern: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'draft-pattern: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'absent-version: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'incompatible-type: exact SQL message token pattern_incompatible',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'incompatible-type: exact DETAIL pointer or members',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-reasons.test.ts',
            title:
              'CMS-03C-02 route typed Slice 12 refusals publishes pattern_version_not_active as 422 COMPOSITION_VALIDATION_FAILED with exactly its reasonCode',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'superseded-version: exact SQL message token pattern_version_not_active',
          },
        ],
      },
      {
        text: 'linked or detached only',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract rejects caller authority, unknown fields, bad ids, versions, mode, path, and digest',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract accepts a bounded linked request and optional digest omission',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-reasons.test.ts',
            title:
              'CMS-03C-02 route typed Slice 12 refusals publishes pattern_incompatible as 422 COMPOSITION_VALIDATION_FAILED with exactly its reasonCode',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-reasons.test.ts',
            title:
              'CMS-03C-02 route typed Slice 12 refusals publishes pattern_version_not_active as 422 COMPOSITION_VALIDATION_FAILED with exactly its reasonCode',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-028',
    text: 'Enforce CMS-03C-02: slotPath/overrides/roots; normalized path 1–512 chars; strict overrides max 64 keys/8 depth; optional `roots` of 1–512 unique key chains, each a block root of the pinned forest after top-level expansion (else 422 at `/roots/{n}`), placing only the named roots, an `overrides` key under no named root being 422 at `/overrides` (DEC-193); 422.',
    clauses: [
      {
        text: 'Enforce CMS-03C-02: slotPath/overrides/roots; normalized',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract [P2-S12-AC-028] accepts only normalized node paths as override keys and reports any other key at /overrides',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-placement-http.test.ts',
            title:
              'CMS-03C-02 pattern placement at the HTTP app.request boundary [P2-S12-AC-218] refuses a non-normalized row path at the route',
          },
        ],
      },
      {
        text: 'path 1–512 chars',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract rejects caller authority, unknown fields, bad ids, versions, mode, path, and digest',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract [P2-S12-AC-028] bounds the slot path at 1 to 512 characters with no control character',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'SR-GUARD slot512: exact store-free outcome',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'SR-GUARD slot513: exact store-free outcome',
          },
        ],
      },
      {
        text: 'strict overrides max 64 keys/8 depth',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract bounds override key count, names, JSON depth, and non-JSON values',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract counts the override root when enforcing the locked depth-eight limit',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'overrides-depth: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'overrides-65: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'sr-overrides65: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title:
              'sr-overrides-depth9: exact SQL message token VALIDATION_FAILED',
          },
        ],
      },
      {
        text: 'optional `roots` of 1–512 unique key chains, each a block root of the pinned forest after top-level expansion (else 422 at `/roots/{n}`), placing only the named roots, an `overrides` key under no named root being 422 at `/overrides` (DEC-193);',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/dec193-contract-migration.test.ts',
            title:
              'DEC-193 public address, stored caps and pattern roots [DEC-193][roots-1] accepts an omitted roots member and a 1-512 unique full-address list',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'SR-GUARD omitted: exact store-free outcome',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'SR-GUARD 512 unique: exact store-free outcome',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'SR-GUARD-count513: exact store-free outcome',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'SR-GUARD-duplicate: exact store-free outcome',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'SR-GUARD-empty: exact store-free outcome',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'sr-semantic-missing: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'sr-semantic-descendant: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'sr-semantic-reference: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'sr-subset: exact selected cardinality',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title:
              'sr-subset: exact literal paths, successor versions, ordered positions and block identities',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_selected_roots.sql',
            title: 'sr-override-unselected: exact DETAIL pointer or members',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.test.ts',
            title:
              'CMS-03C-02 protected pattern instance route rejects malformed, cross-origin, and missing-authority requests before mutation',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-029',
    text: 'Enforce CMS-03C-02: graph; no cycles; max protected depth/nodes; all blocks registered and compatible; 409/422.',
    clauses: [
      {
        text: 'Enforce CMS-03C-02: graph; no cycles',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'self-lineage-cycle: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'indirect-lineage-cycle: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/065-defensive.sqlinc',
            title:
              'a nested reference to a lineage already on the chain is refused pattern_cycle at /patternId (409) [BE03c 1612]',
          },
        ],
      },
      {
        text: 'max protected depth/nodes',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'depth-nine: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'nodes-513: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'expanded-513: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/065-defensive.sqlinc',
            title:
              'a forest nested 129 levels deep is refused pattern_depth_exceeded at /patternId (422) [BE03c 1612]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/065-defensive.sqlinc',
            title:
              'a forest of 513 block roots is refused pattern_nodes_exceeded at /patternId (422) [BE03c 1612, DEC-175]',
          },
        ],
      },
      {
        text: 'all blocks registered and compatible',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'unknown-block: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'unregistered-version: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'block-range-excludes-chain-type: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/047-block-compat.sqlinc',
            title: 'an incompatible block points at /blockTree [P2-S12-AC-104]',
          },
        ],
      },
      {
        text: '409/422.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-reasons.test.ts',
            title:
              'CMS-03C-02 route typed Slice 12 refusals publishes pattern_cycle as 409 COMPOSITION_VERSION_CONFLICT with exactly its reasonCode',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-reasons.test.ts',
            title:
              'CMS-03C-02 route typed Slice 12 refusals relays the depth/nodes 422 violations and nothing else',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-reasons.test.ts',
            title:
              'CMS-03C-02 route typed Slice 12 refusals publishes pattern_incompatible as 422 COMPOSITION_VALIDATION_FAILED with exactly its reasonCode',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-reasons.test.ts',
            title:
              'CMS-03C-02 route typed Slice 12 refusals publishes block_registry_digest_mismatch as 409 COMPOSITION_VERSION_CONFLICT with exactly its reasonCode',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-030',
    text: 'Enforce CMS-03C-03: taxonomyId/action; UUID (the vocabulary lineage id); the vocabulary must have an `active` TaxonomyVersion (else 409 `taxonomy_not_active`); action create, rename, alias, deprecate, merge; `parentId` other than null requires shape `hierarchical`; 400/422.',
    clauses: [
      {
        text: 'Enforce CMS-03C-03: taxonomyId/action; UUID',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract rejects unknown fields, invented actions, invalid identity, keys, and versions',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route rejects malformed path, body, media, and strong preconditions before the port',
          },
        ],
      },
      {
        text: '(the vocabulary lineage id); the vocabulary must have an `active` TaxonomyVersion (else 409 `taxonomy_not_active`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              "a vocabulary of the caller's organization without an active version is 409 taxonomy_not_active [P2-S12-AC-018]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              "the other organization's curator reaches its own vocabulary: concealment is by owner, and a draft has no active version [P2-S12-AC-018]",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-act-tokens.test.ts',
            title:
              'CMS-03C-03 production port: token mapping (BE03c 1290, 1298-1306, 1375) taxonomy_not_active',
          },
        ],
      },
      {
        text: 'action create, rename, alias, deprecate, merge',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract accepts the five closed actions with a merge-only survivor',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract rejects unknown fields, invented actions, invalid identity, keys, and versions',
          },
        ],
      },
      {
        text: '`parentId` other than null requires shape `hierarchical`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/060-hierarchy.sqlinc',
            title:
              'a parent in a flat vocabulary is 422 at /parentId: the shape is flat [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/060-hierarchy.sqlinc',
            title:
              'a flat vocabulary refuses a parent on rename as well [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/060-hierarchy.sqlinc',
            title:
              'an unknown, self or cyclic parent, and any parent in a flat vocabulary, is 422 at /parentId on alias, deprecate and merge too [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/060-hierarchy.sqlinc',
            title:
              'a hierarchical vocabulary accepts a root, a child and a grandchild; each resource names its parent [P2-S12-AC-016]',
          },
        ],
      },
      {
        text: '400/422.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route rejects malformed path, body, media, and strong preconditions before the port',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-031',
    text: 'Enforce CMS-03C-03: termKey/labels; stable key /^[a-z][a-z0-9-]{1,63}$/; 1–64 localized labels; NFC; 422.',
    clauses: [
      {
        text: 'Enforce CMS-03C-03: termKey/labels; stable key /^[a-z][a-z0-9-]{1,63}$/',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract rejects unknown fields, invented actions, invalid identity, keys, and versions',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title:
              'a new term cannot reuse a stable key after the original term advances its version',
          },
        ],
      },
      {
        text: '1–64 localized labels',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract bounds localized labels and aliases',
          },
        ],
      },
      {
        text: 'NFC',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract bounds localized labels and aliases',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route rejects malformed path, body, media, and strong preconditions before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route sanitizes conflict details and rejects invalid port output',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-032',
    text: 'Enforce CMS-03C-03: survivorId/parentId; UUID or null; required for merge/specified hierarchy; cannot be self/cyclic/merged; 422/409.',
    clauses: [
      {
        text: 'Enforce CMS-03C-03: survivorId/parentId; UUID or null',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract rejects unknown fields, invented actions, invalid identity, keys, and versions',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract accepts the five closed actions with a merge-only survivor',
          },
        ],
      },
      {
        text: 'required for merge/specified hierarchy',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract rejects unknown fields, invented actions, invalid identity, keys, and versions',
          },
        ],
      },
      {
        text: 'cannot be self/cyclic/merged',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'a term cannot redirect to itself',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title: 'a curator cannot reparent a root below its grandchild',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title:
              'a merge cannot choose an already-merged redirect as survivor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title: 'an existing term cannot move under a merged redirect',
          },
        ],
      },
      {
        text: '422/409.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title: 'a term cannot be merged into itself [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title: 'an unknown survivor is 422 at /survivorId [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/060-hierarchy.sqlinc',
            title:
              'a root cannot move below its grandchild (cycle) [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/060-hierarchy.sqlinc',
            title: 'a term cannot be its own parent [P2-S12-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'a merged redirect cannot be a survivor: no redirect chains [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'a parent that still has children cannot be merged away [P2-S12-AC-003]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-act-tokens.test.ts',
            title:
              'CMS-03C-03 production port: token mapping (BE03c 1290, 1298-1306, 1375) CONFLICT (stale operand, term exists, merged term)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-act-tokens.test.ts',
            title:
              'CMS-03C-03 production port: token mapping (BE03c 1290, 1298-1306, 1375) VALIDATION_FAILED with a pointer',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-033',
    text: 'Enforce CMS-03C-04: entryId/locale/sourceRevisionId; UUID, BCP 47, UUID; source revision must exist and be readable; 400/404.',
    clauses: [
      {
        text: 'Enforce CMS-03C-04: entryId/locale/sourceRevisionId; UUID, BCP 47, UUID',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              'CMS-03C-04 locale-variant wire contract rejects malformed addressing, caller authority, hashes, and versions',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route rejects malformed path, query, headers, body and cookie CSRF before persistence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route rejects path/body mismatch after authentication and before authorization or persistence',
          },
        ],
      },
      {
        text: 'source revision must exist',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc',
            title:
              'an absent source revision is concealed as not found [P2-S12-AC-055]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts',
            title:
              'CMS-03C-04 author a locale variant through the real stack [P2-S12-AC-055] an absent source revision and an entry another owner holds are the same 404 LOCALE_SOURCE_NOT_FOUND',
          },
        ],
      },
      {
        text: 'be readable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_locale_variant.sql',
            title:
              'a source revision that EXISTS but belongs to an entry the caller cannot read is the concealed NOT_FOUND [P2-S12-AC-033]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_locale_variant.sql',
            title:
              "control: the same request over the entry's own readable source revision authors the draft [P2-S12-AC-033]",
          },
        ],
      },
      {
        text: '400/404.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route rejects malformed path, query, headers, body and cookie CSRF before persistence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter maps port refusals to exact locked CMS-03C-04 catalog codes',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'other-tenant entry existence remains concealed',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-034',
    text: "Enforce CMS-03C-04: fields/fallbackChain; 1–128 field IDs/values; only localizable fields; `locale` a member of the active version's `supportedLocales`; `fallbackChain` ≤16 tags that equal the active version's chain for `locale` as an equality expectation (any difference 409 `FALLBACK_CHAIN_MISMATCH`); explicit no_fallback; 422.",
    clauses: [
      {
        text: 'Enforce CMS-03C-04: fields/fallbackChain; 1–128 field IDs/values',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              'CMS-03C-04 locale-variant wire contract bounds and deduplicates localizable fields and fallback selections',
          },
        ],
      },
      {
        text: 'only localizable fields',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'nonlocalizable source-schema field cannot be translated [P2-S09-AC-1166]',
          },
        ],
      },
      {
        text: "`locale` a member of the active version's `supportedLocales`",
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
        text: "`fallbackChain` ≤16 tags that equal the active version's chain for `locale` as an equality expectation (any difference 409 `FALLBACK_CHAIN_MISMATCH`)",
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
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes-refusals.test.ts',
            title:
              'CMS-03C-04 locale authoring route returns the active chain on a fallback-chain mismatch and nothing else',
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
        text: 'explicit no_fallback',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'nonlocalizable field cannot be misdeclared as no-fallback [P2-S09-AC-1166]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'the variant stores its own per-variant no_fallback field set (empty here: the source version declares no no_fallback field) [P2-S09-AC-1166]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              '[P2-S09-AC-1166] no_fallback is stored per locale variant [P2-S09-AC-1166] the set is bounded at 128 field ids and every member is a UUID',
          },
        ],
      },
      {
        text: '422.',
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
              'CMS-03C-04 production locale adapter maps port refusals to exact locked CMS-03C-04 catalog codes',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-035',
    text: 'Enforce CMS-03C-04: sourceHash/expectedVersion; 64 lowercase hex; positive decimal version; 422/409.',
    clauses: [
      {
        text: 'Enforce CMS-03C-04: sourceHash/expectedVersion; 64 lowercase hex',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              'CMS-03C-04 locale-variant wire contract rejects malformed addressing, caller authority, hashes, and versions',
          },
        ],
      },
      {
        text: 'positive decimal version',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              'CMS-03C-04 locale-variant wire contract rejects malformed addressing, caller authority, hashes, and versions',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              'CMS-03C-04 locale-variant wire contract requires idempotent JSON and a strong source-version validator',
          },
        ],
      },
      {
        text: '422/409.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'false source hash is rejected before mutation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'stale entry version cannot create a second variant',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_hash_mismatch.sql',
            title: 'stale recompute hash conflicts as 409, never 503',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter maps port refusals to exact locked CMS-03C-04 catalog codes',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-036',
    text: 'Enforce CMS-03C-05: pins/exclusions; pin UUID array ≤32, exclusion UUID array ≤64, de-duplicated; exclusions win; every pin is an eligible target and every exclusion an existing readable entry, and an ineligible, hidden or absent target is the one uniform 422 `related_target_ineligible`; 422.',
    clauses: [
      {
        text: 'Enforce CMS-03C-05: pins/exclusions; pin UUID array ≤32, exclusion UUID array ≤64, de-duplicated',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract bounds and deduplicates pins and exclusions with no ambiguous overlap',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'CMS-03C-05 admission gate validates the body before admission and forwards only contract violations',
          },
        ],
      },
      {
        text: 'exclusions win',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title:
              'a target both pinned and excluded is refused (exclusions win, so the request is contradictory) [P2-S12-AC-036]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title: 'the overlap is named at the exclusion [P2-S12-AC-036]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/003-bound.sqlinc',
            title:
              'no excluded entry appears in the projection [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'with c1 excluded again the slot is refilled by the next eligible candidate c3, never by c1 [P2-S12-AC-154]',
          },
        ],
      },
      {
        text: 'every pin is an eligible target and every exclusion an existing readable entry',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'an absent, self, archived, held, unassigned (hidden) and other-owner pin each give related_target_ineligible [P2-S12-AC-227]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'the refusal names the offending pin by index [P2-S12-AC-227]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'it is related_target_ineligible at /exclusions/0 [P2-S12-AC-227]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'an absent, hidden or other-owner exclusion gives one identical refusal [P2-S12-AC-227]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'nothing of the refused pins and exclusions was written [P2-S12-AC-062]',
          },
        ],
      },
      {
        text: 'and an ineligible, hidden or absent target is the one uniform 422 `related_target_ineligible`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'the six refusals are byte-identical: a write is never an existence oracle [P2-S12-AC-227]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-typed-refusals.test.ts',
            title:
              'CMS-03C-05 typed refusals (BE03c 1304, 1380-1383) publishes related_target_ineligible with the offending row pointers as one uniform 422',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-related.test.ts',
            title:
              'CMS-03C-05 production related-content adapter maps the typed uniform refusal to a 422 with the offending row pointers',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'CMS-03C-05 admission gate validates the body before admission and forwards only contract violations',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-037',
    text: 'Enforce CMS-03C-05: derivedRule; strict bounded rule or null; `key` a member of the code-owned rule registry (`shared-terms`, `same-type-recent`), `version` its registered version, `reasonCode` an equality expectation of the registry value, `maxCandidates` 1–128 (an unknown key or version is 422 `derived_rule_unknown`); no arbitrary query/expression; 422.',
    clauses: [
      {
        text: 'Enforce CMS-03C-05: derivedRule; strict bounded rule or null',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract accepts the addressed rule and an explicit no-derived-rule command',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract rejects malformed addressing, caller authority, version, and rule input',
          },
        ],
      },
      {
        text: '`key` a member of the code-owned rule registry (`shared-terms`, `same-type-recent`), `version` its registered version, `reasonCode` an equality expectation of the registry value',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-public-target.test.ts',
            title:
              'CMS-03C-21 related public targets (D11, OD-5) [P2-S12-AC-229] holds the code-owned rule registry to shared-terms and same-type-recent at version 1',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-public-target.test.ts',
            title:
              'CMS-03C-21 related public targets (D11, OD-5) [P2-S12-AC-229] resolves an unknown rule key or version to nothing and never inherits a prototype member',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title:
              'an unregistered version of a registered rule is derived_rule_unknown [P2-S12-AC-229]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title:
              'a reasonCode that is not the registry value of the rule is refused [P2-S12-AC-229]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title:
              "one rule's reason code does not satisfy the other rule's equality expectation [P2-S12-AC-229]",
          },
        ],
      },
      {
        text: '`maxCandidates` 1–128',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract rejects malformed addressing, caller authority, version, and rule input',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title: 'maxCandidates 0 is refused [P2-S12-AC-037]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title: 'maxCandidates 129 is refused [P2-S12-AC-037]',
          },
        ],
      },
      {
        text: '(an unknown key or version is 422 `derived_rule_unknown`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title:
              'a well-formed key outside the registry is derived_rule_unknown [P2-S12-AC-229]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title: 'it names the key [P2-S12-AC-229]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title: 'it names the version [P2-S12-AC-229]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-typed-refusals.test.ts',
            title:
              'CMS-03C-05 typed refusals (BE03c 1304, 1380-1383) publishes derived_rule_unknown at its member pointer',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-related.test.ts',
            title:
              'CMS-03C-05 production related-content adapter maps derived_rule_unknown, capability_missing and the schema failure',
          },
        ],
      },
      {
        text: 'no arbitrary query/expression',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract rejects malformed addressing, caller authority, version, and rule input',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'CMS-03C-05 admission gate validates the body before admission and forwards only contract violations',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-038',
    text: 'Enforce CMS-03C-05: expectedVersion; positive decimal strong If-Match match; 400/409. The related-content public-target projection CMS-03C-21 (BE03c ledger 25.05.04) is owned here with the CMS-03C-05 command.',
    clauses: [
      {
        text: 'Enforce CMS-03C-05: expectedVersion; positive decimal strong If-Match match',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract requires idempotent JSON and a strong source-entry validator',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract rejects malformed addressing, caller authority, version, and rule input',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'BE00 steps 2 and 8 on the CMS related-content route refuses a body expectedVersion that differs from If-Match once headers are checked',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'CMS-03C-05 admission gate enforces origin, path binding, media, validators, and CSRF before the port',
          },
        ],
      },
      {
        text: '400/409.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title:
              'an If-Match that differs from expectedVersion is an invalid request [P2-S12-AC-038]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title:
              'version 0 is an invalid request (positive decimals only) [P2-S12-AC-038]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/007-cas-and-locks.sqlinc',
            title:
              'a version ahead of the entry is a version mismatch [P2-S12-AC-061]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/007-cas-and-locks.sqlinc',
            title:
              'the previous operand is now stale: the loser of two writers from version 1 is refused [P2-S12-AC-061]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-related.test.ts',
            title:
              'CMS-03C-05 production related-content adapter maps the generic BE03b tokens to their statuses',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-related.test.ts',
            title:
              'CMS-03C-05 production related-content adapter carries the stale version pair of a version conflict',
          },
        ],
      },
      {
        text: 'The related-content public-target projection CMS-03C-21 (BE03c ledger 25.05.04) is owned here with the CMS-03C-05 command.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'the first target is exactly { entryId, source: pin, reasonCode: null, position: 0 } [P2-S12-AC-153]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'an unpublished (tombstoned), other-locale and other-audience entry is never a candidate [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/003-bound.sqlinc',
            title:
              'the projection is cut at exactly 128 targets [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/003-bound.sqlinc',
            title:
              'no excluded entry appears in the projection [P2-S12-AC-154]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-public-target.test.ts',
            title:
              'CMS-03C-21 related public targets (D11, OD-5) [P2-S12-AC-154] returns at most 128 targets, pins first in position order and then derived candidates in rank order',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-039',
    text: 'Enforce All: headers/body; JSON, raw body ≤256 KiB, Idempotency-Key 8–128 printable ASCII, unknown keys reject; 400/415/422.',
    clauses: [
      {
        text: 'Enforce All: headers/body; JSON',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route rejects invalid media, headers, unknown authority and protected-region movement before mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.test.ts',
            title:
              'CMS-03C-02 protected pattern instance route rejects malformed, cross-origin, and missing-authority requests before mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route rejects malformed path, body, media, and strong preconditions before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route rejects stale/missing If-Match and non-JSON payloads',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'CMS-03C-05 admission gate enforces origin, path binding, media, validators, and CSRF before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-admission.test.ts',
            title:
              'CMS-03C-06 Worker admission (BE03c row 168, BE00 order) rejects unsupported request media before the session',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-admission.test.ts',
            title:
              "'CMS-03C-07' command transport admission refuses non-JSON request media with 415 and the JSON allowlist",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-admission.test.ts',
            title:
              "'CMS-03C-08' command transport admission refuses non-JSON request media with 415 and the JSON allowlist",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-admission.test.ts',
            title:
              "'CMS-03C-09' command transport admission refuses non-JSON request media with 415 and the JSON allowlist",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              "CMS-03C-12 and cmsPatternLatestRead Worker admission rejects unsupported request media before the session ('the CMS-03C-12 write')",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              'CMS-03C-15 pattern-update route a media type other than JSON is 415 and starts nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary refuses preflight content-type before auth',
          },
        ],
      },
      {
        text: 'raw body ≤256 KiB',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'BE00 step 2 body ceiling on the CMS template version route refuses a streamed body over the ceiling that declared no length',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-instance-routes.test.ts',
            title:
              'BE00 step 2 body ceiling on the CMS pattern instance route refuses a streamed body over the ceiling that declared no length',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'BE00 step 2 body ceiling on the CMS taxonomy route refuses a streamed body over the ceiling that declared no length',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes-binding-and-order.test.ts',
            title:
              'BE00 step 2 body ceiling on the CMS locale route refuses a streamed body over the ceiling that declared no length',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'BE00 steps 2 and 8 on the CMS related-content route refuses a streamed body over the ceiling that declared no length',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-admission.test.ts',
            title:
              'CMS-03C-06 Worker admission (BE03c row 168, BE00 order) keeps request bodies at 256 KiB (declared: false)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-admission.test.ts',
            title:
              "'CMS-03C-07' command transport admission refuses a body over 256 KiB with 400 before authentication",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-admission.test.ts',
            title:
              "'CMS-03C-08' command transport admission refuses a body over 256 KiB with 400 before authentication",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-admission.test.ts',
            title:
              "'CMS-03C-09' command transport admission refuses a body over 256 KiB with 400 before authentication",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              'CMS-03C-12 and cmsPatternLatestRead Worker admission keeps definition request bodies at 256 KiB (declared: false)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              'CMS-03C-15 pattern-update route a declared length over the ceiling is 400 before the body is read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary bounds valid JSON request bytes at 262145',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              'CMS-03C-15 pattern-update route a streamed body over 262,144 bytes that declared no length is 400',
          },
        ],
      },
      {
        text: 'Idempotency-Key 8–128 printable ASCII',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary-governed.test.ts',
            title:
              'CMS-03C-06, -07, -09 and -12 Idempotency-Key bounds [P2-S12-AC-039] CMS-03C-06 a key of 129 characters is 400 INVALID_REQUEST before any quota or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary-governed.test.ts',
            title:
              'CMS-03C-06, -07, -09 and -12 Idempotency-Key bounds [P2-S12-AC-039] CMS-03C-06 a key of a control character is 400 INVALID_REQUEST before any quota or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary-governed.test.ts',
            title:
              'CMS-03C-06, -07, -09 and -12 Idempotency-Key bounds [P2-S12-AC-039] CMS-03C-07 a key of 129 characters is 400 INVALID_REQUEST before the capability check, any quota or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary-governed.test.ts',
            title:
              'CMS-03C-06, -07, -09 and -12 Idempotency-Key bounds [P2-S12-AC-039] CMS-03C-07 a key of a control character is 400 INVALID_REQUEST before the capability check, any quota or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary-governed.test.ts',
            title:
              'CMS-03C-06, -07, -09 and -12 Idempotency-Key bounds [P2-S12-AC-039] CMS-03C-09 a key of 129 characters is 400 INVALID_REQUEST before the capability check, MFA, any quota or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary-governed.test.ts',
            title:
              'CMS-03C-06, -07, -09 and -12 Idempotency-Key bounds [P2-S12-AC-039] CMS-03C-09 a key of a control character is 400 INVALID_REQUEST before the capability check, MFA, any quota or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary-governed.test.ts',
            title:
              'CMS-03C-06, -07, -09 and -12 Idempotency-Key bounds [P2-S12-AC-039] CMS-03C-12 a key of 129 characters is 400 INVALID_REQUEST before any quota or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary-governed.test.ts',
            title:
              'CMS-03C-06, -07, -09 and -12 Idempotency-Key bounds [P2-S12-AC-039] CMS-03C-12 a key of a control character is 400 INVALID_REQUEST before any quota or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary-governed.test.ts',
            title:
              'CMS-03C-06, -07, -09 and -12 Idempotency-Key bounds [P2-S12-AC-039] CMS-03C-07 a 128 character printable key is inside the bound and reaches the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-08 Idempotency-Key 8-128 printable ASCII (BE03c 150, 422) [P2-S12-AC-039] CMS-03C-08 missing Idempotency-Key is 400 INVALID_REQUEST before the capability check, any quota token or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-08 Idempotency-Key 8-128 printable ASCII (BE03c 150, 422) [P2-S12-AC-039] CMS-03C-08 7 characters Idempotency-Key is 400 INVALID_REQUEST before the capability check, any quota token or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-08 Idempotency-Key 8-128 printable ASCII (BE03c 150, 422) [P2-S12-AC-039] CMS-03C-08 129 characters Idempotency-Key is 400 INVALID_REQUEST before the capability check, any quota token or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-08 Idempotency-Key 8-128 printable ASCII (BE03c 150, 422) [P2-S12-AC-039] CMS-03C-08 a control character Idempotency-Key is 400 INVALID_REQUEST before the capability check, any quota token or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-08 Idempotency-Key 8-128 printable ASCII (BE03c 150, 422) [P2-S12-AC-039] CMS-03C-08 a DEL character Idempotency-Key is 400 INVALID_REQUEST before the capability check, any quota token or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-08 Idempotency-Key 8-128 printable ASCII (BE03c 150, 422) [P2-S12-AC-039] CMS-03C-08 a non-ASCII character Idempotency-Key is 400 INVALID_REQUEST before the capability check, any quota token or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-08 Idempotency-Key 8-128 printable ASCII (BE03c 150, 422) [P2-S12-AC-039] CMS-03C-08 a malformed Idempotency-Key from a caller without the capability is the 400, not the 403',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-08 Idempotency-Key 8-128 printable ASCII (BE03c 150, 422) [P2-S12-AC-039] CMS-03C-08 a 8 character printable key is inside the bound and reaches the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-08 Idempotency-Key 8-128 printable ASCII (BE03c 150, 422) [P2-S12-AC-039] CMS-03C-08 a 128 character printable key is inside the bound and reaches the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-16 Idempotency-Key 8-128 printable ASCII (BE03c 150, 408, 422) [P2-S12-AC-039] CMS-03C-16 missing Idempotency-Key is 400 INVALID_REQUEST before any quota token or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-16 Idempotency-Key 8-128 printable ASCII (BE03c 150, 408, 422) [P2-S12-AC-039] CMS-03C-16 7 characters Idempotency-Key is 400 INVALID_REQUEST before any quota token or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-16 Idempotency-Key 8-128 printable ASCII (BE03c 150, 408, 422) [P2-S12-AC-039] CMS-03C-16 129 characters Idempotency-Key is 400 INVALID_REQUEST before any quota token or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-16 Idempotency-Key 8-128 printable ASCII (BE03c 150, 408, 422) [P2-S12-AC-039] CMS-03C-16 a control character Idempotency-Key is 400 INVALID_REQUEST before any quota token or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-16 Idempotency-Key 8-128 printable ASCII (BE03c 150, 408, 422) [P2-S12-AC-039] CMS-03C-16 a DEL character Idempotency-Key is 400 INVALID_REQUEST before any quota token or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-16 Idempotency-Key 8-128 printable ASCII (BE03c 150, 408, 422) [P2-S12-AC-039] CMS-03C-16 a non-ASCII character Idempotency-Key is 400 INVALID_REQUEST before any quota token or the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-16 Idempotency-Key 8-128 printable ASCII (BE03c 150, 408, 422) [P2-S12-AC-039] CMS-03C-16 a malformed Idempotency-Key from a caller without the capability is the 400, not the 403',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-16 Idempotency-Key 8-128 printable ASCII (BE03c 150, 408, 422) [P2-S12-AC-039] CMS-03C-16 a 8 character printable key is inside the bound and reaches the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/idempotency-key-boundary.test.ts',
            title:
              'CMS-03C-16 Idempotency-Key 8-128 printable ASCII (BE03c 150, 408, 422) [P2-S12-AC-039] CMS-03C-16 a 128 character printable key is inside the bound and reaches the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order.test.ts',
            title:
              "'CMS-03C-01 template version': header validation precedes capability and quota a longer than 128 Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order.test.ts',
            title:
              "'CMS-03C-01 template version': header validation precedes capability and quota a missing Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order.test.ts',
            title:
              "'CMS-03C-01 template version': header validation precedes capability and quota a non-printable ASCII Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order.test.ts',
            title:
              "'CMS-03C-01 template version': header validation precedes capability and quota a shorter than 8 Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order.test.ts',
            title:
              "'CMS-03C-02 pattern instance': header validation precedes capability and quota a longer than 128 Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order.test.ts',
            title:
              "'CMS-03C-02 pattern instance': header validation precedes capability and quota a missing Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order.test.ts',
            title:
              "'CMS-03C-02 pattern instance': header validation precedes capability and quota a non-printable ASCII Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order.test.ts',
            title:
              "'CMS-03C-02 pattern instance': header validation precedes capability and quota a shorter than 8 Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order.test.ts',
            title:
              "'CMS-03C-03 taxonomy term action': header validation precedes capability and quota a longer than 128 Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order.test.ts',
            title:
              "'CMS-03C-03 taxonomy term action': header validation precedes capability and quota a missing Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order.test.ts',
            title:
              "'CMS-03C-03 taxonomy term action': header validation precedes capability and quota a non-printable ASCII Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order.test.ts',
            title:
              "'CMS-03C-03 taxonomy term action': header validation precedes capability and quota a shorter than 8 Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order-locale-related.test.ts',
            title:
              "'CMS-03C-04 locale variant': header validation precedes capability and quota a longer than 128 Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order-locale-related.test.ts',
            title:
              "'CMS-03C-04 locale variant': header validation precedes capability and quota a missing Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order-locale-related.test.ts',
            title:
              "'CMS-03C-04 locale variant': header validation precedes capability and quota a non-printable ASCII Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order-locale-related.test.ts',
            title:
              "'CMS-03C-04 locale variant': header validation precedes capability and quota a shorter than 8 Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order-locale-related.test.ts',
            title:
              "'CMS-03C-05 related content': header validation precedes capability and quota a longer than 128 Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order-locale-related.test.ts',
            title:
              "'CMS-03C-05 related content': header validation precedes capability and quota a missing Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order-locale-related.test.ts',
            title:
              "'CMS-03C-05 related content': header validation precedes capability and quota a non-printable ASCII Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/write-header-order-locale-related.test.ts',
            title:
              "'CMS-03C-05 related content': header validation precedes capability and quota a shorter than 8 Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-order.test.ts',
            title:
              "'CMS-03C-15 pattern update': header validation precedes capability and quota a longer than 128 Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-order.test.ts',
            title:
              "'CMS-03C-15 pattern update': header validation precedes capability and quota a missing Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-order.test.ts',
            title:
              "'CMS-03C-15 pattern update': header validation precedes capability and quota a non-printable ASCII Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-order.test.ts',
            title:
              "'CMS-03C-15 pattern update': header validation precedes capability and quota a shorter than 8 Idempotency-Key is a 400 that consumes no quota and starts no write",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses Idempotency-Key "café-key-0001" with 400 before capability and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses Idempotency-Key "short" with 400 before capability and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses Idempotency-Key null with 400 before capability and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-admission.test.ts',
            title:
              'CMS-03C-09 transport admission (BE00 order: parse before authority) answers a short Idempotency-Key with 400 before capability, MFA and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-admission.test.ts',
            title:
              'CMS-03C-09 transport admission (BE00 order: parse before authority) answers no Idempotency-Key with 400 before capability, MFA and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract rejects a missing or invalid idempotency key: bad key',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract rejects a missing or invalid idempotency key: undefined',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-headers.test.ts',
            title:
              'CMS-03C-06 capability, header and preflight admission (BE03c row 168) rejects a missing or invalid idempotency key: undefined',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-headers.test.ts',
            title:
              'CMS-03C-06 capability, header and preflight admission (BE03c row 168) rejects a missing or invalid idempotency key: bad key',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-headers.test.ts',
            title:
              'CMS-03C-06 capability, header and preflight admission (BE03c row 168) rejects a missing or invalid idempotency key: x',
          },
        ],
      },
      {
        text: 'unknown keys reject',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts rejects unexpected request or resource fields and unknown resource states',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract rejects unknown fields, invented actions, invalid identity, keys, and versions',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              'CMS-03C-04 locale-variant wire contract rejects malformed addressing, caller authority, hashes, and versions',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract rejects malformed addressing, caller authority, version, and rule input',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract rejects caller authority, unknown fields, bad ids, versions, mode, path, and digest',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
            title:
              'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) rejects caller authority or private member ownerPartyId',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses an arbitrary member as an unknown key with 422',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-assignment-input.test.ts',
            title:
              'CMS-03C-08 strict input and order before any quota refuses an unknown member with 422 naming no attacker member',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-admission.test.ts',
            title:
              'CMS-03C-09 transport admission (BE00 order: parse before authority) answers an unknown member with 422 at the contract pointer, before the capability, MFA and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract rejects caller authority or private member ownerPartyId',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary strictly rejects caller authority and query keys',
          },
        ],
      },
      {
        text: '400/415/422.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route rejects invalid media, headers, unknown authority and protected-region movement before mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route rejects malformed path, body, media, and strong preconditions before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'CMS-03C-05 admission gate validates the body before admission and forwards only contract violations',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-040',
    text: 'CMS-11 Define template: given Actor holds the template designer capability, every referenced block version is registered and currently supported, and the target content types, locale/audience and reserved regions — including the Shard 02 fixed profile spine and provenance components — are declared and left intact., implement locked behavior and completion exactly. Operations: CMS-03C-06 (governed review submit), CMS-03C-07 (decision), CMS-03C-08 (reviewer assignment), CMS-03C-09 (activation), CMS-03C-10 (review detail), CMS-03C-11 (review queue) and CMS-03C-19 (governed scheduled-activation executor), BE03c ledger 25.03.02.',
    clauses: [
      {
        text: 'CMS-11 Define template: given Actor holds the template designer capability',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 confirmed member without designer grant cannot define templates',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 anonymous caller cannot define templates',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_context.sql',
            title:
              'revoked designer grant denies context without disclosing records',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route fails closed on missing identity, wrong capability and absent acting party',
          },
        ],
      },
      {
        text: 'every referenced block version is registered and currently supported',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 current registered compatible block creates a draft',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 rejects a registered block whose compiler range excludes the active type compiler_version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 refuses a block after its supported lifecycle ends',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 refuses a withdrawn block without inserting a template',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 incompatible and retired block calls remain atomic refusals',
          },
        ],
      },
      {
        text: 'and the target content types, locale/audience and reserved regions — including the Shard 02 fixed profile spine and provenance components — are declared and left intact.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 refuses nonexistent or inactive compatible types',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 rejects movement of protected regions',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts bounds reserved regions and strict projection bindings',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts enforces locale, safe audience, and a lowercase optional registry digest',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-request.test.ts',
            title:
              'CMS-11 template draft request builds a complete schema-validated create body with the protected spine',
          },
        ],
      },
      {
        text: 'implement locked behavior and completion exactly. Operations: CMS-03C-06 (governed review submit), CMS-03C-07 (decision), CMS-03C-08 (reviewer assignment), CMS-03C-09 (activation), CMS-03C-10 (review detail), CMS-03C-11 (review queue) and CMS-03C-19 (governed scheduled-activation executor), BE03c ledger 25.03.02.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "implement locked behavior and completion exactly. Operations: CMS-03C-06 (governed review submit)...": meta clause, no single test can prove it: "implement locked behavior and completion exactly. Operations: CMS-03C-06 ... CMS-03C-11 and CMS-03C-19" is discharged exactly when the per-operation criteria of those operations are verified (governed submit/decision/assignment/activation/detail/queue/scheduled executor: AC-064..AC-099 and AC-142..AC-151 in this ledger). Citing one representative test per operation would over-claim (every one of those operations still lacks a composed Worker->Kong/PostgREST->database case). Proposal for root: treat this clause as derived (verified iff those criteria are verified) or split it out of the evidence ledger.',
  },
  {
    criterion: 'P2-S12-AC-041',
    text: 'CMS-11 Define template: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-11 Define template: preserve declared failure and recovery across invalid authority',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 confirmed member without designer grant cannot define templates',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 anonymous caller cannot define templates',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/templates/template-designer-route.test.ts',
            title:
              'CMS-11 protected template designer page redirects an expired session and never turns denial/degradation into a form',
          },
        ],
      },
      {
        text: 'concurrency',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 stale If-Match cannot create a third version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx',
            title:
              'CMS-11 successor edit and reconciliation keeps unsent values through conflict and requires an explicit latest-version rebase',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-real-route.spec.ts',
            title:
              'CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'revocation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_context.sql',
            title:
              'revoked designer grant denies context without disclosing records',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_detail.sql',
            title: 'revoked designer grant denies the current template read',
          },
        ],
      },
      {
        text: 'deletion',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p240_identity.sql',
            title: 'a template version cannot be deleted [P2-S09-AC-001]',
          },
        ],
      },
      {
        text: 'and cascade.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/050-block.sqlinc',
            title:
              'after the withdrawal the recheck invalidates the review dependency_changed (version + 1, subject back to draft) [P2-S12-AC-202]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/050-block.sqlinc',
            title:
              'a repeated run finds no live review: the invalidated review is skipped [P2-S12-AC-202]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-042',
    text: '`CMS-11` Define template: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-11` Define template: implement Native link/button/form',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.test.tsx',
            title:
              'CMS-11 template designer shell renders a native form with protected selectors and no privileged evidence fields',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-real-route.spec.ts',
            title:
              'CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'focus stays until navigation or named result heading',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.result-focus.test.tsx',
            title:
              "template result focus: 'create designer' [P2-S12-AC-042] a verified success is a named result heading that takes focus and stays focused",
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.result-focus.test.tsx',
            title:
              "template result focus: 'successor (edit) designer' [P2-S12-AC-042] a verified success is a named result heading that takes focus and stays focused",
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-states-real-route.spec.ts',
            title:
              '[P2-S12-AC-042] a successful successor save keeps focus off every other control while pending, then moves it to the named result',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'Server-derived actor/context/capability',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-define.test.ts',
            title:
              'CMS-03C-01 production template adapter calls only the named protected RPC with server session context and an opaque secret',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-composition-platform-mutation-forward.test.ts',
            title:
              'CMS-11 first-party template mutation boundary forwards only validated JSON and allowlisted session headers to the named Worker route',
          },
        ],
      },
      {
        text: 'valid Zod input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-request.test.ts',
            title:
              'CMS-11 template draft request builds a complete schema-validated create body with the protected spine',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-request.test.ts',
            title:
              'CMS-11 template draft request rejects duplicate binding names and invalid slot values before POST',
          },
        ],
      },
      {
        text: 'required ETag/idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-submit.test.ts',
            title:
              'CMS-11 first-party draft submission posts a validated create with CSRF and stable idempotency, then accepts only an authoritative resource',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-submit.test.ts',
            title:
              'CMS-11 first-party draft submission posts a successor with exact strong If-Match and accepts only a newer authoritative draft',
          },
        ],
      },
      {
        text: 'Render authoritative response/version/provenance/next action',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-states-real-route.spec.ts',
            title:
              '[P2-S12-AC-042] a successful successor save renders the authoritative version, the draft state and the next action, and the next action opens that very draft',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'announce status',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-real-route.spec.ts',
            title:
              'CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-uncertain-real-route.spec.ts',
            title:
              'Phase 2 Slice 12 uncertain template mutation > an unknown outcome keeps values, reuses the idempotency key, and reconciles before retry',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'Map exact `ApiError`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-submit.test.ts',
            title:
              'CMS-11 first-party draft submission does not invent a conflict from non-JSON error media',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-submit.test.ts',
            title:
              'CMS-11 first-party draft submission does not map a malformed denial to a confirmed capability failure',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-submit.test.ts',
            title:
              'CMS-11 first-party draft submission carries only matching BE00 Retry-After seconds for a typed 429',
          },
        ],
      },
      {
        text: 'retain input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.interaction.test.tsx',
            title:
              'CMS-11 template designer interaction keeps the draft values and idempotency key across an uncertain retry',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx',
            title:
              'CMS-11 successor edit and reconciliation keeps unsent values through conflict and requires an explicit latest-version rebase',
          },
        ],
      },
      {
        text: 'focus summary/field',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-uncertain-real-route.spec.ts',
            title:
              'Phase 2 Slice 12 uncertain template mutation > an unknown outcome keeps values, reuses the idempotency key, and reconciles before retry',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-real-route.spec.ts',
            title:
              'CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase',
            project: 'real-route-chrome',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.result-focus.test.tsx',
            title:
              "template result focus: 'create designer' [P2-S12-AC-042] a refusal keeps focus on the summary region, not on a result heading",
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.result-focus.test.tsx',
            title:
              "template result focus: 'successor (edit) designer' [P2-S12-AC-042] a refusal keeps focus on the summary region, not on a result heading",
          },
        ],
      },
      {
        text: 'reconcile unknown mutation before retry',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-uncertain-real-route.spec.ts',
            title:
              'Phase 2 Slice 12 uncertain template mutation > an unknown outcome keeps values, reuses the idempotency key, and reconciles before retry',
            project: 'real-route-chrome',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx',
            title:
              'CMS-11 successor edit and reconciliation retains the key after an uncertain same-version reconciliation read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-edit-reconcile.test.ts',
            title:
              'CMS-11 canonical reconciliation read reads only the same-origin protected latest version and checks identity and ETag',
          },
        ],
      },
      {
        text: 'URL for navigation/filter',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/templates/template-designer-route.test.ts',
            title:
              'CMS-11 protected template successor page loads canonical detail and selectors before hydrating the edit form',
          },
        ],
      },
      {
        text: 'scoped draft before commit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved.test.tsx',
            title:
              'CMS-11 \'create designer\': leaving with an unsent draft (FE03 "Unsaved changes") [P2-S12-AC-042] arms beforeunload only while the form holds unsent input',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved.test.tsx',
            title:
              'CMS-11 \'successor (edit) designer\': leaving with an unsent draft (FE03 "Unsaved changes") [P2-S12-AC-042] arms beforeunload only while the form holds unsent input',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved.test.tsx',
            title:
              'CMS-11 \'create designer\': leaving with an unsent draft (FE03 "Unsaved changes") [P2-S12-AC-042] shows an inline confirmation instead of leaving, keeps the draft and returns focus on Keep editing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved.test.tsx',
            title:
              'CMS-11 \'successor (edit) designer\': leaving with an unsent draft (FE03 "Unsaved changes") [P2-S12-AC-042] shows an inline confirmation instead of leaving, keeps the draft and returns focus on Keep editing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved.test.tsx',
            title:
              'CMS-11 \'create designer\': leaving with an unsent draft (FE03 "Unsaved changes") [P2-S12-AC-042] leaves only through the explicit discard, to the link the person chose',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved.test.tsx',
            title:
              'CMS-11 \'successor (edit) designer\': leaving with an unsent draft (FE03 "Unsaved changes") [P2-S12-AC-042] leaves only through the explicit discard, to the link the person chose',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved.test.tsx',
            title:
              'CMS-11 \'create designer\': leaving with an unsent draft (FE03 "Unsaved changes") [P2-S12-AC-042] does not intercept a link while the form is clean',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved.test.tsx',
            title:
              'CMS-11 \'successor (edit) designer\': leaving with an unsent draft (FE03 "Unsaved changes") [P2-S12-AC-042] does not intercept a link while the form is clean',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved.test.tsx',
            title:
              'CMS-11 \'create designer\': leaving with an unsent draft (FE03 "Unsaved changes") [P2-S12-AC-042] keeps the draft armed after a refusal and clears it only after a verified success',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved.test.tsx',
            title:
              'CMS-11 \'successor (edit) designer\': leaving with an unsent draft (FE03 "Unsaved changes") [P2-S12-AC-042] keeps the draft armed after a refusal and clears it only after a verified success',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved.test.tsx',
            title:
              'CMS-11 create designer: explicit discard [P2-S12-AC-042] Start another draft after success leaves a clean form with the guard disarmed',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved.test.tsx',
            title:
              'CMS-11 designer: the default destination [P2-S12-AC-042] without a navigate prop the explicit discard assigns the location the person chose',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title:
              'cmsTemplateDraftDirty [P2-S12-AC-042] is clean for an identical copy, whatever the order of the content-type set and the row ui ids',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title:
              'cmsTemplateDraftDirty [P2-S12-AC-042] is dirty for templateKey',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title:
              'cmsTemplateDraftDirty [P2-S12-AC-042] is dirty for compatibleTypeIds',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title: 'cmsTemplateDraftDirty [P2-S12-AC-042] is dirty for locale',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title:
              'cmsTemplateDraftDirty [P2-S12-AC-042] is dirty for audience',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title:
              'cmsTemplateDraftDirty [P2-S12-AC-042] is dirty for extraRegions',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title:
              'cmsTemplateDraftDirty [P2-S12-AC-042] is dirty for a slot key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title:
              'cmsTemplateDraftDirty [P2-S12-AC-042] is dirty for a slot required flag',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title:
              'cmsTemplateDraftDirty [P2-S12-AC-042] is dirty for a slot maxCount',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title:
              'cmsTemplateDraftDirty [P2-S12-AC-042] is dirty for a slot block list',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title:
              'cmsTemplateDraftDirty [P2-S12-AC-042] is dirty for a removed slot',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title:
              'cmsTemplateDraftDirty [P2-S12-AC-042] is dirty for a binding key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title:
              'cmsTemplateDraftDirty [P2-S12-AC-042] is dirty for a binding projection',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title:
              'cmsTemplateDraftDirty [P2-S12-AC-042] is dirty for a binding required flag',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts',
            title:
              'cmsTemplateDraftDirty [P2-S12-AC-042] is dirty for a removed binding',
          },
        ],
      },
      {
        text: 'server after success.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-submit.test.ts',
            title:
              'CMS-11 first-party draft submission does not present a malformed success response as a created draft',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-submit.test.ts',
            title:
              'CMS-11 first-party draft submission does not treat an unchanged version or invalid edit body as a saved successor',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-043',
    text: 'CMS-12 Use reusable pattern: given Actor may edit the target entry revision, the referenced pattern version is immutable and readable, and the resulting block tree stays acyclic within the protected depth and count limits., implement locked behavior and completion exactly. Operations: CMS-03C-12 (pattern version create), CMS-03C-13 (pattern selector), CMS-03C-14 (update diff) and CMS-03C-15 (pattern update), BE03c ledger 25.03.03.',
    clauses: [
      {
        text: 'CMS-12 Use reusable pattern: given Actor may edit the target entry revision',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'visible-no-edit: exact SQL message token capability_missing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'rv-after: exact SQL message token capability_missing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'old-revision: exact SQL message token revision_not_editable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'current-revision: the placement succeeds',
          },
        ],
      },
      {
        text: 'the referenced pattern version is immutable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title: 'pattern definition cannot mutate in place',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title:
              'direct pattern state transition cannot bypass named RPC authority',
          },
        ],
      },
      {
        text: 'and readable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_placement.sql',
            title: 'foreign-lineage: exact SQL message token NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_placement.sql',
            title:
              'a foreign lineage is indistinguishable from an absent one [P2-S12-AC-043]',
          },
        ],
      },
      {
        text: 'and the resulting block tree stays acyclic within the protected depth and count limits.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'self-lineage-cycle: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/065-defensive.sqlinc',
            title:
              'a nested reference to a lineage already on the chain is refused pattern_cycle at /patternId (409) [BE03c 1612]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/065-defensive.sqlinc',
            title:
              'a forest nested 129 levels deep is refused pattern_depth_exceeded at /patternId (422) [BE03c 1612]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/065-defensive.sqlinc',
            title:
              'a forest of 513 block roots is refused pattern_nodes_exceeded at /patternId (422) [BE03c 1612, DEC-175]',
          },
        ],
      },
      {
        text: 'implement locked behavior and completion exactly. Operations: CMS-03C-12 (pattern version create), CMS-03C-13 (pattern selector), CMS-03C-14 (update diff) and CMS-03C-15 (pattern update), BE03c ledger 25.03.03.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clause): "implement locked behavior and completion exactly. Operations: CMS-03C-12 (pattern version create), CMS-03C-13 (pattern selector), CMS-03C-14 (update diff) and CMS-03C-15 (pattern update), BE03c ledger 25.03.03.": meta clause ("implement locked behavior and completion exactly. Operations: CMS-03C-12 .. -15"): no single test proves it; it holds when AC-100..AC-135 are verified. Proposal for root: treat as derived or split out.',
  },
  {
    criterion: 'P2-S12-AC-044',
    text: 'CMS-12 Use reusable pattern: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-12 Use reusable pattern: preserve declared failure and recovery across invalid authority',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'visible-no-edit: exact SQL message token capability_missing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'hidden-owner: exact SQL message token NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'anonymous: exact SQL message token UNAUTHENTICATED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'hidden-owner: the refusal preserves every captured full row of every store',
          },
        ],
      },
      {
        text: 'concurrency',
        citations: [
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_12_dec193_writer.race.mjs',
            title:
              'changed target refused atomically; fresh independently locked V3 still accepted',
          },
        ],
      },
      {
        text: 'revocation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'rv-after: exact SQL message token capability_missing',
          },
        ],
      },
      {
        text: 'deletion',
        citations: [],
      },
      {
        text: 'and cascade.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title:
              'all 11 follow the contract: next version of the head, state pending_diff, pin unchanged, pending_pattern_version 2, every other member copied [AC-212]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title:
              'a re-delivered cms.pattern.activated.v1 appends nothing: every pending row already waits for v2 [P2-S12-AC-213]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title:
              'the live review of the revision the scan wrote to is invalidated dependency_changed, version advanced once [BE03c Canonical records: every composition write]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "deletion": missing test: pgTAP asserting the IA03 line 533 deletion rule for a pattern / composition source: an owner or source (pattern lineage, entry) deleted or tombstoned keeps the immutable evidence (pattern version and composition rows remain), removes derived access, and queues the idempotent dependent invalidation. Today only the privilege facts (no direct DELETE grant on cms_pattern_versions / cms_composition_instances, composition_authority.sql) and the typed refusal of a superseded version (070-supersede.sqlinc) exist. Further limits of cited clauses: The concurrency clause is cited by a one-session stale-operand case and the dec193_writer race (the CMS-03C-15 writer against a governed activation: typed refusal with no effects), not by two competing expected revisions; placement (CMS-03C-02) has no race module.',
  },
  {
    criterion: 'P2-S12-AC-045',
    text: '`CMS-12` Use reusable pattern: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-12` Use reusable pattern: implement Native link/button/form',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternInsertForm.test.tsx',
            title:
              'CmsPatternInsertForm has native labelled controls, with no link mode preselected',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternInsertForm.test.tsx',
            title:
              'CmsPatternInsertForm submits through the native form, so Enter works, and disables the command while pending',
          },
        ],
      },
      {
        text: 'focus stays until navigation or named result heading',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionStatus.test.tsx',
            title:
              'CmsCompositionStatus names a success with each line and focuses the result heading',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionStatus.test.tsx',
            title:
              'CmsCompositionStatus moves focus again when a new outcome replaces the old one',
          },
        ],
      },
      {
        text: 'Server-derived actor/context/capability',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/compositions/pattern-instances.test.ts',
            title:
              'first-party CMS pattern instance endpoint (CMS-03C-02) rejects forged origin and caller authority fields before the Worker call',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: the request sends the exact PatternInstanceRequest with the entry version as If-Match, a CSRF token and a key',
          },
        ],
      },
      {
        text: 'valid Zod input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: nothing is sent while a problem remains names every missing choice in an error summary and sends nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: nothing is sent while a problem remains refuses overrides that are not a JSON object of node paths',
          },
        ],
      },
      {
        text: 'required ETag/idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: the request sends the exact PatternInstanceRequest with the entry version as If-Match, a CSRF token and a key',
          },
        ],
      },
      {
        text: 'Render authoritative response/version/provenance/next action',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: the request names the result, lists the row and uses the committed entry version for the next command',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionInstanceList.test.tsx',
            title:
              'CmsCompositionInstanceList: rows lists the rows with state and pinned version in words',
          },
        ],
      },
      {
        text: 'announce status',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionStatus.test.tsx',
            title: 'CmsCompositionStatus announces pending politely',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionStatus.test.tsx',
            title:
              'CmsCompositionStatus states a refusal as an alert with its message and the progress it kept',
          },
        ],
      },
      {
        text: 'Map exact `ApiError`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: refusals maps a 422 at /slotPath to the slot field and keeps every input',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: refusals says what a typed 422 pattern_version_not_active means',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: refusals says what a typed 422 pattern_incompatible means',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: refusals says what a typed 422 block_registry_digest_mismatch means',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: refusals after revision_not_editable disables the commands once the draft is no longer editable',
          },
        ],
      },
      {
        text: 'retain input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: refusals maps a 422 at /slotPath to the slot field and keeps every input',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: refusals blocks the next command for the stated wait of a 429 and keeps the input',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'accept: refusals keep the author choices on a 422 keeps the choices, says nothing was applied and does not refetch',
          },
        ],
      },
      {
        text: 'focus summary/field',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternInsertForm.test.tsx',
            title:
              'CmsPatternInsertForm puts each issue at its field with an error summary that links to it',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'accept: the exact request and the named outcome does not send while a collision is unanswered and focuses the first one',
          },
        ],
      },
      {
        text: 'reconcile unknown mutation before retry',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.unsaved.test.tsx',
            title:
              'insert: an unknown outcome is reconciled with the entry before any retry reads the entry, keeps the identical request and key, and offers the retry only after the read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.unsaved.test.tsx',
            title:
              'insert: an unknown outcome is reconciled with the entry before any retry says so when the entry has moved on, and still retries the same request',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.unsaved.test.tsx',
            title:
              'insert: an unknown outcome is reconciled with the entry before any retry says the entry could not be checked when the read fails, and the retry is still offered',
          },
        ],
      },
      {
        text: 'URL for navigation/filter',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx',
            title:
              'protected composition page, composed answers malformed ids and any URL state with 400 and no read',
          },
        ],
      },
      {
        text: 'scoped draft before commit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.unsaved.test.tsx',
            title:
              'insert: leaving with an unsent placement draft arms beforeunload only while the form holds unsent input, and disarms it after a success',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.unsaved.test.tsx',
            title:
              'insert: leaving with an unsent placement draft shows an inline confirmation instead of leaving, keeps the draft, and leaves only through the explicit discard',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.unsaved.test.tsx',
            title:
              'insert: leaving with an unsent placement draft never puts the draft in the URL, history or storage',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: the request clears the pattern and overrides after a success but keeps the slot path and link mode',
          },
        ],
      },
      {
        text: 'server after success.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: the request clears the pattern and overrides after a success but keeps the slot path and link mode',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-046',
    text: 'CMS-14 Govern taxonomy term: given Actor holds the taxonomy curator capability for that specific editorial vocabulary, the term key is stable and the proposed hierarchy stays acyclic, canonical-taxonomy overlap has been checked, and a merge names a survivor whose counterpart is not already merged., implement locked behavior and completion exactly. Operations: CMS-03C-16 (taxonomy version create), CMS-03C-17 (taxonomy selector) and CMS-03C-18 (canonical-taxonomy overlap provider), BE03c ledger 25.05.01.',
    clauses: [
      {
        text: 'CMS-14 Govern taxonomy term: given Actor holds the taxonomy curator capability for that specific editorial vocabulary',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              'a readable member with the editor capability but no curator capability is refused 403 capability_missing [P2-S12-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              'the author capability is not the curator capability [P2-S12-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              "a real curator of ANOTHER organization asking for this owner's vocabulary gets the same refusal [P2-S12-AC-018]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title: 'an absent vocabulary is the concealing 404 [P2-S12-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              "another organization's vocabulary gives the very same complete refusal as an absent one: no existence oracle [P2-S12-AC-018]",
          },
        ],
      },
      {
        text: 'the term key is stable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title:
              'a new term cannot reuse a stable key after the original term advances its version',
          },
        ],
      },
      {
        text: 'and the proposed hierarchy stays acyclic',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title: 'a curator cannot reparent a root below its grandchild',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title: 'a rejected cycle leaves the existing hierarchy unchanged',
          },
        ],
      },
      {
        text: 'canonical-taxonomy overlap has been checked',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'a key, a label, a normalized alias, a later-locale label, a rename label and an alias that equal a role facet are all 422 canonical_overlap [P2-S12-AC-141]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'each refusal names exactly the domain and the canonical id to reference instead, and nothing else [P2-S12-AC-141]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'a plural key, a participle label and prefix aliases are not overlaps: no fuzzy matching [P2-S12-AC-137]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'with the role provider failing, create, rename and alias are 503 DEPENDENCY_UNAVAILABLE: never a success-shaped body [P2-S12-AC-140]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'no overlap refusal created a term, label, alias, audit, outbox, idempotency or job row [P2-S12-AC-141]',
          },
        ],
      },
      {
        text: 'and a merge names a survivor whose counterpart is not already merged.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title:
              'a merge cannot choose an already-merged redirect as survivor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_link_integrity.sql',
            title:
              'a direct survivor cannot later merge while inbound redirects exist',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'merge requires a permanent survivor redirect',
          },
        ],
      },
      {
        text: 'implement locked behavior and completion exactly. Operations: CMS-03C-16 (taxonomy version create), CMS-03C-17 (taxonomy selector) and CMS-03C-18 (canonical-taxonomy overlap provider), BE03c ledger 25.05.01.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "implement locked behavior and completion exactly. Operations: CMS-03C-16 (taxonomy version create...": meta clause, no single test can prove it: "implement locked behavior and completion exactly. Operations: CMS-03C-16 (taxonomy version create), CMS-03C-17 (taxonomy selector) and CMS-03C-18 (canonical-taxonomy overlap provider)" is discharged exactly when the per-operation criteria of those operations are verified (AC-124..AC-141 in this ledger). All three exist (routes, RPCs, contracts, tests) but none has a composed Worker->Kong/PostgREST->database case. Proposal for root: treat as derived from those criteria.',
  },
  {
    criterion: 'P2-S12-AC-047',
    text: 'CMS-14 Govern taxonomy term: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-14 Govern taxonomy term: preserve declared failure and recovery across invalid authority',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              'a readable member with the editor capability but no curator capability is refused 403 capability_missing [P2-S12-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              'a caller who is not a member of the owner party gets the concealing 404 [P2-S12-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              'a request without a verified human is 401 UNAUTHENTICATED [P2-S12-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title: 'no authority refusal changed any store [P2-S12-AC-018]',
          },
        ],
      },
      {
        text: 'concurrency',
        citations: [],
      },
      {
        text: 'revocation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              'a revoked curator cannot even replay a stored response: the capability is re-proved before any cached answer [P2-S12-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              'a grant whose window ended yesterday is not authority [P2-S12-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/050-authority.sqlinc',
            title:
              'with the authority restored the same key replays the original response [P2-S12-AC-019]',
          },
        ],
      },
      {
        text: 'deletion',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'rename, alias, deprecate, a second merge and a re-create of a merged term are all 409: a merged id never reactivates [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'an assignment version cannot be deleted',
          },
        ],
      },
      {
        text: 'and cascade.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/080-merge.sqlinc',
            title:
              'the merge committed ONE taxonomy event (not one per assignment) and one audit record, and needed no continuation job [P2-S12-AC-021]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/097-bulk-continuation.sqlinc',
            title:
              'no (revision, field) holds two survivor rows: the convergence is exactly-once [P2-S12-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/096-job-fence.sqlinc',
            title:
              'after a re-claim the stale delivery, the right version with another token, the right token with another version and a future version are all 409 [P2-S12-AC-021]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "concurrency": missing test: race (tool race) for cms_act_taxonomy_term asserting two competing writers on one vocabulary/term serialize one winner and return the typed conflict (CONFLICT / TAXONOMY_VERSION_CONFLICT) to the loser without duplicate term, label, audit or outbox effect (IA03 line 538). Only one-session stale-operand and duplicate-key cases exist (050-authority.sqlinc:41-43, 030-create.sqlinc:71); no race module covers the term action.',
  },
  {
    criterion: 'P2-S12-AC-048',
    text: '`CMS-14` Govern taxonomy term: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-14` Govern taxonomy term: implement Native link/button/form',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx',
            title:
              'CmsTaxonomyTermForm: create opens a labelled form, sends the exact request under the active version and shows the result',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx',
            title:
              'CmsTaxonomyTermForm: the term list offers each action by name only where it applies',
          },
        ],
      },
      {
        text: 'focus stays until navigation or named result heading',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx',
            title:
              'CmsTaxonomyTermForm: create opens a labelled form, sends the exact request under the active version and shows the result',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.focus.test.tsx',
            title:
              'keyboard focus stays on the paging control (FE03 :898, WCAG 2.4.3) keeps focus on "Load more terms" through every page, then moves it to the choice on the last',
          },
        ],
      },
      {
        text: 'Server-derived actor/context/capability',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-routes.test.ts',
            title:
              'CMS-03C-03 taxonomy term actions route enforces origin, CSRF, human session, and curator capability',
          },
        ],
      },
      {
        text: 'valid Zod input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/term-action-request.test.ts',
            title:
              'buildTermActionRequest: create names each problem at its field, with the row of a label',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx',
            title:
              'CmsTaxonomyTermForm: create names every problem, links each to its control and sends nothing',
          },
        ],
      },
      {
        text: 'required ETag/idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/term-action-submit.test.ts',
            title:
              'submitTermAction: the request posts the exact body to the vocabulary path with the active version as If-Match',
          },
        ],
      },
      {
        text: 'Render authoritative response/version/provenance/next action',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/term-action-submit.test.ts',
            title:
              'submitTermAction: a verified term is done with the facts the form shows',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/term-action-submit.test.ts',
            title:
              'submitTermAction: a verified term binds a deprecate to a deprecated term and a merge to a merged term redirecting to the survivor',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx',
            title:
              'CmsTaxonomyTermForm: the term list lists every term with labels, aliases, lifecycle and the survivor redirect',
          },
        ],
      },
      {
        text: 'announce status',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx',
            title:
              'CmsTaxonomyTermForm: a refused term action (FE03 :887) shows a canonical overlap with its domain and the canonical id as copyable text, never a link',
          },
        ],
      },
      {
        text: 'Map exact `ApiError`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx',
            title:
              'CmsTaxonomyTermForm: a refused term action (FE03 :887) says curator access is required for a missing capability',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx',
            title:
              'CmsTaxonomyTermForm: a refused term action (FE03 :887) shows a canonical overlap with its domain and the canonical id as copyable text, never a link',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx',
            title:
              'CmsTaxonomyTermForm: the other term action outcomes reports a version conflict and that the list was refreshed',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx',
            title:
              'CmsTaxonomyTermForm: the other term action outcomes states the Retry-After wait of a rate limit',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/term-status-copy.test.ts',
            title:
              'failureCopy words {"kind":"refused","status":409,"reason":"taxonomy_not_active"}',
          },
        ],
      },
      {
        text: 'retain input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx',
            title:
              'CmsTaxonomyTermForm: the other term action outcomes keeps the entries and says the service is unavailable for a dependency failure',
          },
        ],
      },
      {
        text: 'focus summary/field',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx',
            title:
              'CmsTaxonomyTermForm: create names every problem, links each to its control and sends nothing',
          },
        ],
      },
      {
        text: 'reconcile unknown mutation before retry',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.retry.test.tsx',
            title:
              'CmsTaxonomyTermForm: retrying after an unknown outcome reconciles the list first, then retries the same request under the same Idempotency-Key',
          },
        ],
      },
      {
        text: 'URL for navigation/filter',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx',
            title:
              'CmsTaxonomyTermForm: the term list keeps the filter and the cursor in the URL: a GET filter form and pager links',
          },
        ],
      },
      {
        text: 'scoped draft before commit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.leave.test.tsx',
            title:
              'CmsTaxonomyTermForm: leaving with an unsent term draft (FE03 "Unsaved changes") arms beforeunload only while the open form holds input',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.leave.test.tsx',
            title:
              'CmsTaxonomyTermForm: leaving with an unsent term draft (FE03 "Unsaved changes") shows an inline confirmation instead of leaving, and keeps the typed draft',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.leave.test.tsx',
            title:
              'CmsTaxonomyTermForm: leaving with an unsent term draft (FE03 "Unsaved changes") leaves only through the explicit discard, to the link the person chose',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.leave.test.tsx',
            title:
              'CmsTaxonomyTermForm: leaving with an unsent term draft (FE03 "Unsaved changes") clears the draft and disarms the guard only after success or an explicit cancel',
          },
        ],
      },
      {
        text: 'server after success.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/term-action-submit.test.ts',
            title:
              'submitTermAction: a verified term treats a create that is not active as an unknown outcome',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/term-action-submit.test.ts',
            title:
              'submitTermAction: a verified term treats an ETag that is not the version as an unknown outcome',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-049',
    text: 'Execute Contract → QA-RED → data, API, SSR and island implementation → QA-GREEN → refactor; retain failing-test evidence and run canonical validation.',
    clauses: [
      {
        text: 'Execute Contract → QA-RED → data, API, SSR and island implementation → QA-GREEN → refactor; retain failing-test evidence and run canonical validation.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No test is cited. Unproven: "Execute Contract → QA-RED → data, API, SSR and island implementation → QA-GREEN → refactor; retai...": missing test: a Slice 12 closeout test in tests/contracts/phase-02-slice-12-closeout.test.ts (model: tests/contracts/phase-02-slice-11-closeout.test.ts) that asserts the retained RED record (the failing-test evidence under .memory/pipeline/progress/verification/) and the receipts, plus a canonical pnpm validate at the closing commit (native/hosted evidence, root-owned). Process criterion: the Contract -> QA-RED -> implementation -> QA-GREEN -> refactor sequence is a working method, attested by documents and the canonical validate log, not by a unit test; today no Slice 12 test reads either.',
  },
  {
    criterion: 'P2-S12-AC-050',
    text: 'Update slice tracking, feature-ledger assignments, applicable runbooks, and architecture graph in the same change; leave no unresolved implementation boundary or undocumented drift.',
    clauses: [
      {
        text: 'Update slice tracking',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-closeout.test.ts',
            title:
              'Slice 12 tracking and feature ledger (P2-S12-AC-050) tracking: the tracker status agrees with the evidence ledger, and a Completion Signature exists exactly when every criterion is verified',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-closeout.test.ts',
            title:
              'Slice 12 tracking and feature ledger (P2-S12-AC-050) tracking: the progress checker reports slice, phase and index agreement with no drift',
          },
        ],
      },
      {
        text: 'feature-ledger assignments',
        citations: [],
      },
      {
        text: 'applicable runbooks',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-closeout.test.ts',
            title:
              'Slice 12 runbooks (P2-S12-AC-050) runbook: every runbook the slice cites exists, is linked from the platform runbook index and cites only existing repository paths',
          },
        ],
      },
      {
        text: 'and architecture graph',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-closeout.test.ts',
            title:
              'Slice 12 generated contracts and architecture graph (P2-S12-AC-050) architecture graph: the compiled specification graph equals the graph rebuilt from the committed spec text',
          },
        ],
      },
      {
        text: 'in the same change;',
        citations: [],
      },
      {
        text: 'leave no unresolved implementation boundary',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-closeout.test.ts',
            title:
              'Slice 12 implementation boundaries (P2-S12-AC-050) boundaries: no TODO, FIXME, not-implemented or unwired marker remains in the Slice 12 production sources',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-closeout.test.ts',
            title:
              'Slice 12 implementation boundaries (P2-S12-AC-050) boundaries: no BOUNDARY: marker remains in the Slice 12 production sources (the nested picker is wired to cmsPatternNestableRead)',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-closeout.test.ts',
            title:
              'Slice 12 implementation boundaries (P2-S12-AC-050) boundaries: the SQL BOUNDARY: markers are the replaced anchors of the retire-request amendment and the restore marker the DEC-240 migration supersedes',
          },
        ],
      },
      {
        text: 'or undocumented drift.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-closeout.test.ts',
            title:
              'Slice 12 tracking and feature ledger (P2-S12-AC-050) tracking: the progress checker reports slice, phase and index agreement with no drift',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-closeout.test.ts',
            title:
              'Slice 12 generated contracts and architecture graph (P2-S12-AC-050) contracts: the committed OpenAPI document equals the one generated from the route registry (no undocumented drift)',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "feature-ledger assignments": BOUNDARY until slice close: 25.05.03 and 25.05.04 are plan-listed for Slice 12 (DEC-114) but still unassigned ("—") in the feature ledger, and the closeout test pins that drift; the assignment and the changed closeout assertion land in the slice-close change. "in the same change;": a property of the slice-close commit, not of repository state; no test can prove it (the commit itself shows it).',
  },
  {
    criterion: 'P2-S12-AC-051',
    text: 'Resolve a `no_fallback` field only from its own target-locale variant: it is never resolved through `fallbackChains` to `defaultLocale` or any other locale, and a missing target-locale value for a `no_fallback` field blocks publication of that locale and increments `cms_no_fallback_block_total` (DEC-121; received from Slice 09 AC005 and AC1166 under DEC-122, which own only the declaration and storage); resolved by CMS-03C-20 (shared locale field resolution and locale preflight provider, BE03c ledger 25.05.03).',
    clauses: [
      {
        text: 'Resolve a `no_fallback` field only from its own target-locale variant: it is never resolved through `fallbackChains` to `defaultLocale` or any other locale',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a no_fallback field is never resolved through fallbackChains: en-US holds terms, fr-FR does not, it blocks [P2-S12-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a no_fallback field does not borrow even a chain member that holds it: fr-CA never takes the fr-FR legal text [P2-S12-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a locale with no variant blocks a no_fallback field [P2-S12-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-resolution.test.ts',
            title:
              'CMS-03C-20 locale field resolution (DEC-121, DEC-138) [P2-S12-AC-051] blocks a missing no_fallback field with no_fallback_missing and never resolves it through the chain',
          },
        ],
      },
      {
        text: 'a missing target-locale value for a `no_fallback` field blocks publication of that locale',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a translation that omits the no_fallback field blocks although the default locale holds it [P2-S12-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a source-locale revision that holds no value for the no_fallback field blocks with no_fallback_missing [P2-S12-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a revision translated against an older source value of the no_fallback field blocks with no_fallback_stale [P2-S12-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a stale locale revision that was previously submitted but is now invalidated reports no_fallback_stale at scheduled execution, so the stale branch outranks the approval check (DEC-192) [P2-S12-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_criteria_publish_gates.sql',
            title:
              'locale gate: a schema that declares a no_fallback field refuses the publication 422 preflight_failed (locale) [P2-S11-AC-004]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_criteria_publish_gates.sql',
            title:
              'locale gate: the executor blocks a schedule over a no_fallback field [P2-S11-AC-004]',
          },
        ],
      },
      {
        text: 'increments `cms_no_fallback_block_total`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-no-fallback.test.ts',
            title:
              'cms_no_fallback_block_total from a refused preflight counts a CMS-03B-09 refusal whose locale category failed with no_fallback_missing once',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-no-fallback.test.ts',
            title:
              'cms_no_fallback_block_total from a refused preflight counts a CMS-03B-07 refusal whose locale category failed with no_fallback_missing once',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/observability-no-fallback.test.ts',
            title:
              'cms_no_fallback_block_total from a refused preflight counts a CMS-03B-09 refusal whose locale category failed with no_fallback_stale once',
          },
        ],
      },
      {
        text: '(DEC-121; received from Slice 09 AC005 and AC1166 under DEC-122, which own only the declaration and storage); resolved by CMS-03C-20 (shared locale field resolution and locale preflight provider, BE03c ledger 25.05.03).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a no_fallback field is never resolved through fallbackChains: en-US holds terms, fr-FR does not, it blocks [P2-S12-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'the locale category is served by cms.locale.no_fallback_gate version 1 (database) as a newer registry row [P2-S12-AC-240]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-052',
    text: 'Keep serving the last approved translation for a stale fallback-permitted locale field after its source changes (never resolving it through the fallback chain to the default locale and never blocking the locale), expose the stale state to editorial reads and `cms_locale_stale_total` until revalidation, and keep `no_fallback` fields blocking publication when their value is missing (DEC-121, DEC-122).',
    clauses: [
      {
        text: 'Keep serving the last approved translation for a stale fallback-permitted locale field after its source changes (never resolving it through the fallback chain to the default locale and never blocking the locale)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a stale fallback-permitted field keeps serving its last translation, is flagged stale and never blocks [P2-S12-AC-052]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a stale localized field never blocks: only the changed title went stale, the no_fallback value is current [P2-S12-AC-052]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-resolution.test.ts',
            title:
              'CMS-03C-20 locale field resolution (DEC-121, DEC-138) [P2-S12-AC-052] serves a stale localized field and flags it without ever blocking',
          },
        ],
      },
      {
        text: 'expose the stale state to editorial reads',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'editorial reads expose exactly the stale translated fields [P2-S12-AC-052]',
          },
        ],
      },
      {
        text: 'and `cms_locale_stale_total` until revalidation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_observability/003-window.sqlinc',
            title:
              'the window counts the closed start (fr-FR, 12:00:00) and the last inside instant (de-DE): 2 rows, 2+2 fields; not the open end, not drafts [P2-S12-AC-052]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_observability/005-gauge.sqlinc',
            title:
              'the superseded fr-FR stale row is not counted: only de-DE legal remains [P2-S12-AC-052]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-observability-probe.test.ts',
            title:
              '[P2-S12-AC-263] the counters and the gauge adds fanoutRows and staleFieldsAppended to the two counters and sets the gauge, in one event',
          },
        ],
      },
      {
        text: 'keep `no_fallback` fields blocking publication when their value is missing (DEC-121, DEC-122).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a missing no_fallback field keeps blocking after the source change [P2-S12-AC-052]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'a translation that omits the no_fallback field blocks although the default locale holds it [P2-S12-AC-051]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-053',
    text: 'Author template versions that declare compatibility with an existing content-type id through CMS-03C-01 `compatibleTypeIds` and keep every template binding consistent afterwards: a successor that binds a template through CMS-03A-09 resolves it through the compatibility resolver against the exact candidate, refuses an absent template with 404, a template that does not list the type id with 422 and a pointer, and a withdrawn template with 409, and never alters an already-active definition hash (DEC-123; the flows beyond the first-successor binding mechanics that Slice 09 delivers, received under DEC-122).',
    clauses: [
      {
        text: 'Author template versions that declare compatibility with an existing content-type id through CMS-03C-01 `compatibleTypeIds`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 refuses nonexistent or inactive compatible types',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 authorized template create succeeds',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'fixture: the templates are real CMS-03C-01 definitions that declare compatibility with their type ids [P2-S09-AC-003]',
          },
        ],
      },
      {
        text: 'and keep every template binding consistent afterwards',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_template_compat_guard.sql',
            title:
              'AC169 draft binding rejects a template that excludes the new content type [P2-S09-AC-169]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_template_compat_guard.sql',
            title:
              'AC169 activation state switch rechecks incompatible persisted bindings [P2-S09-AC-095] [P2-S09-AC-169]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'a direct binding of an incompatible template to the draft is refused by the compatibility guard [P2-S09-AC-169]',
          },
        ],
      },
      {
        text: 'a successor that binds a template through CMS-03A-09 resolves it through the compatibility resolver against the exact candidate',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'both persisted bindings resolve as compatible for their exact parent version through the named compatibility RPC [P2-S09-AC-169]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_dec108_resolver.sql',
            title:
              'a compatible template resolves for the exact candidate version',
          },
        ],
      },
      {
        text: 'refuses an absent template with 404',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'an absent or concealed template is the resolver NOT_FOUND, concealed as 404 [P2-S09-AC-049]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/content-schema-registry/phase-02-slice-09-dec123-successor-template.test.ts',
            title:
              'CMS-03A-09 typed template failures from the database (DEC-123) [P2-S09-AC-049] relays an absent or concealed template as 404 and a withdrawn template as 409',
          },
        ],
      },
      {
        text: 'a template that does not list the type id with 422 and a pointer',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'an incompatible binding is 422 naming its own position /templateBindings/1/templateVersionId [P2-S09-AC-049]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'a default template whose compatible types exclude the type is the resolver INCOMPATIBLE mapped to 422 naming /defaultTemplateVersionId [P2-S09-AC-045]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/content-schema-registry/phase-02-slice-09-dec123-successor-template.test.ts',
            title:
              'CMS-03A-09 typed template failures from the database (DEC-123) [P2-S09-AC-049] relays INCOMPATIBLE as 422 with the offending pointer',
          },
        ],
      },
      {
        text: 'and a withdrawn template with 409',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'a withdrawn template is the resolver WITHDRAWN mapped to 409 CONFLICT [P2-S09-AC-049]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/content-schema-registry/phase-02-slice-09-dec123-successor-template.test.ts',
            title:
              'CMS-03A-09 typed template failures from the database (DEC-123) [P2-S09-AC-049] relays an absent or concealed template as 404 and a withdrawn template as 409',
          },
        ],
      },
      {
        text: 'and never alters an already-active definition hash',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'the immutable source still has no default template and no binding [P2-S09-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'UPDATE of a producer-made binding of the activated version raises IMMUTABLE_RECORD [P2-S09-AC-169]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'INSERT of a further binding into the activated version raises IMMUTABLE_RECORD [P2-S09-AC-169]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'after every refused write the activated version still has exactly its two producer-made bindings [P2-S09-AC-169]',
          },
        ],
      },
      {
        text: '(DEC-123; the flows beyond the first-successor binding mechanics that Slice 09 delivers, received under DEC-122).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'both template members null clones the source default template and bindings unchanged [P2-S09-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'a default template with an empty binding list is a valid replacement [P2-S09-AC-045]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'a clone successor of the bound version is created [P2-S09-AC-003]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_template_compat_guard.sql',
            title:
              'AC169 activation state switch rechecks incompatible persisted bindings [P2-S09-AC-095] [P2-S09-AC-169]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-054',
    text: 'CMS-03C-04 registers POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants with the strict `LocaleVariantRequest` (`entryId`, `locale`, `sourceRevisionId`, 1-128 `fields` of `fieldId` and `value`, `fallbackChain` of at most 16 tags, `noFallbackFieldIds` of at most 128, `sourceHash`, `expectedVersion`) and returns the strict `LocaleVariantResource` as 201 (`state` one of `untranslated`, `draft`, `review`, `approved`, `stale`; `entryId`, `revisionId`, `locale`, `sourceRevisionId`, `fallbackChain`, `noFallbackFieldIds` and `staleFieldIds`, which is empty unless `state` is `stale`); one transaction appends the target revision, its field values and the variant, the entry version, the audit record and the `cms.localization.changed.v1` outbox event; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-04 registers POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants with the strict `LocaleVariantRequest` (`entryId`, `locale`, `sourceRevisionId`, 1-128 `fields` of `fieldId` and `value`, `fallbackChain` of at most 16 tags, `noFallbackFieldIds` of at most 128, `sourceHash`, `expectedVersion`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              'CMS-03C-04 locale-variant wire contract accepts the strict path, request, and explicit no-fallback field set',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              'CMS-03C-04 locale-variant wire contract bounds and deduplicates localizable fields and fallback selections',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-locale-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-04 canonical API authority registers the served locale authoring operation with exact protection',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-locale-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-04 canonical API authority publishes required path, headers, body, 201 resource, and safe errors',
          },
        ],
      },
      {
        text: 'and returns the strict `LocaleVariantResource`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              'CMS-03C-04 locale-variant wire contract accepts only the closed state and safe locale resource',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes-binding-and-order.test.ts',
            title:
              'CMS-03C-04 locale authoring route does not accept success for another state, entry, locale, source or fallback',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route does not accept malformed dependency success or leak provider errors',
          },
        ],
      },
      {
        text: 'as 201 (`state` one of `untranslated`, `draft`, `review`, `approved`, `stale`; `entryId`, `revisionId`, `locale`, `sourceRevisionId`, `fallbackChain`, `noFallbackFieldIds` and `staleFieldIds`, which is empty unless `state` is `stale`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_locale_stale_field_ids.sql',
            title:
              'the resource carries exactly the locked members, nothing private [P2-S12-AC-054]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_locale_stale_field_ids.sql',
            title:
              'an exact replay returns the identical stored resource including staleFieldIds [P2-S12-AC-054]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title:
              'the first variant is a draft resource with an empty staleFieldIds [P2-S12-AC-054]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant-stale.test.ts',
            title:
              'per-field staleness on the variant resource (DEC-121) [P2-S12-AC-235] carries staleFieldIds on the resource, required and never implied',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts',
            title:
              'CMS-03C-04 author a locale variant through the real stack [P2-S12-AC-054] [P2-S12-AC-056] a variant is a strict 201 draft with the aggregate ETag, an immutable target revision, one audit and one outbox event',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant-stale.test.ts',
            title:
              'per-field staleness on the variant resource (DEC-121) [P2-S12-AC-235] is empty unless the variant state is stale',
          },
        ],
      },
      {
        text: 'one transaction appends the target revision, its field values and the variant, the entry version, the audit record and the `cms.localization.changed.v1` outbox event',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'locale authoring commits a target-locale immutable revision and hash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'one immutable locale variant is committed',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'locale authoring advances the entry aggregate CAS version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'locale authoring commits one private audit event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'locale authoring commits one identifier-only outbox event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'outbox payload excludes translated field values and source text',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'calendar locale commit advances the aggregate version exactly once',
          },
        ],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-locale-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-04 canonical API authority registers the served locale authoring operation with exact protection',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-locale-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-04 canonical API authority publishes required path, headers, body, 201 resource, and safe errors',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/production-worker-runtime-cms-composition.test.ts',
            title:
              'production Worker runtime CMS composition injects the locale authoring dependency and mounts CMS-03C-04',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-055',
    text: "CMS-03C-04 derives session and acting context server-side and serves only an assigned CMS author or editor who may edit the entry for the localizable fields of the requested locale, on a source revision the caller can read: a hidden or absent entry or source revision is 404 `LOCALE_SOURCE_NOT_FOUND`, a locale outside the active content-type version's `supportedLocales` is 422 `LOCALE_VALIDATION_FAILED`, a visible entry without edit assignment is 403 `LOCALE_FORBIDDEN`, no ownership, party or person identifier is serialized, and the operation never borrows another jurisdiction's text.",
    clauses: [
      {
        text: 'CMS-03C-04 derives session and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter calls only the named server RPC with server-bound context',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter pins the resolved server identity even when an input claims another user',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route requires assignment-capable human context and valid origin',
          },
        ],
      },
      {
        text: 'and serves only an assigned CMS author or editor who may edit the entry for the localizable fields of the requested locale',
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
              'nonlocalizable source-schema field cannot be translated [P2-S09-AC-1166]',
          },
        ],
      },
      {
        text: 'on a source revision the caller can read',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_locale_variant.sql',
            title:
              'a source revision that EXISTS but belongs to an entry the caller cannot read is the concealed NOT_FOUND [P2-S12-AC-033]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_locale_variant.sql',
            title:
              'a readable revision of another entry is not a source for this entry: the same concealed NOT_FOUND [P2-S12-AC-055]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_locale_variant.sql',
            title:
              "control: the same request over the entry's own readable source revision authors the draft [P2-S12-AC-033]",
          },
        ],
      },
      {
        text: 'a hidden or absent entry',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'other-tenant entry existence remains concealed',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter maps port refusals to exact locked CMS-03C-04 catalog codes',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc',
            title: 'an absent entry is concealed as not found [P2-S12-AC-055]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts',
            title:
              'CMS-03C-04 author a locale variant through the real stack [P2-S12-AC-055] an absent source revision and an entry another owner holds are the same 404 LOCALE_SOURCE_NOT_FOUND',
          },
        ],
      },
      {
        text: 'source revision is 404 `LOCALE_SOURCE_NOT_FOUND`',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts',
            title:
              'CMS-03C-04 author a locale variant through the real stack [P2-S12-AC-055] an absent source revision and an entry another owner holds are the same 404 LOCALE_SOURCE_NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc',
            title:
              'an absent source revision is concealed as not found [P2-S12-AC-055]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter maps port refusals to exact locked CMS-03C-04 catalog codes',
          },
        ],
      },
      {
        text: "a locale outside the active content-type version's `supportedLocales` is 422 `LOCALE_VALIDATION_FAILED`",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              "a locale outside the active version's supportedLocales is a validation failure (422)",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale-unsupported.test.ts',
            title:
              'CMS-03C-04 unsupported locale on the write [P2-S12-AC-055] maps the bare database VALIDATION_FAILED of a locale outside supportedLocales to 422 LOCALE_VALIDATION_FAILED, not a 404',
          },
        ],
      },
      {
        text: 'a visible entry without edit assignment is 403 `LOCALE_FORBIDDEN`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'member without entry assignment and author/editor capability is denied',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter maps port refusals to exact locked CMS-03C-04 catalog codes',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route requires assignment-capable human context and valid origin',
          },
        ],
      },
      {
        text: 'no ownership, party or person identifier is serialized',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              'CMS-03C-04 locale-variant wire contract accepts only the closed state and safe locale resource',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route does not accept malformed dependency success or leak provider errors',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-composition-platform-locale.test.ts',
            title:
              'CMS-03C-04 first-party locale authoring proxy fails closed on forged upstream resource, ETag, or excess response bytes',
          },
        ],
      },
      {
        text: "and the operation never borrows another jurisdiction's text.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc',
            title:
              'the target revision holds only the requested fields: no value of the source or another locale is copied in [P2-S12-AC-055]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a no_fallback field does not borrow even a chain member that holds it: fr-CA never takes the fr-FR legal text [P2-S12-AC-051]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-056',
    text: 'CMS-03C-04 requires an `Idempotency-Key` and the strong `If-Match` equal to the entry aggregate `version` (`expectedVersion`), applies CAS on the source revision and the entry, enforces a unique entry, locale and source revision, rate buckets of 60/min/user and 120/min/party, a 15,000 ms deadline, no-store and the Tier 2 p95 < 1,200 ms and RPC < 300 ms targets, replays an exact repeat of the same command, and answers a changed body, path or version under the same key with 409, and never replays to a changed acting party (an entry outside its scope is the concealed 404, answered before the key is reserved).',
    clauses: [
      {
        text: 'CMS-03C-04 requires an `Idempotency-Key` and the strong `If-Match` equal to the entry aggregate `version` (`expectedVersion`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              'CMS-03C-04 locale-variant wire contract requires idempotent JSON and a strong source-version validator',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route rejects stale/missing If-Match and non-JSON payloads',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'If-Match must equal the request expected version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-composition-platform-locale.test.ts',
            title:
              'CMS-03C-04 first-party locale authoring proxy rejects mismatched body, mutation precondition, and query before forwarding',
          },
        ],
      },
      {
        text: 'applies CAS on the source revision and the entry',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'stale entry version cannot create a second variant',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'locale authoring advances the entry aggregate CAS version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'false source hash is rejected before mutation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_hash_mismatch.sql',
            title: 'stale recompute hash conflicts as 409, never 503',
          },
        ],
      },
      {
        text: 'enforces a unique entry, locale and source revision',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc',
            title:
              'a second variant for the same entry, locale, source revision and version violates the unique key [P2-S12-AC-056]',
          },
        ],
      },
      {
        text: 'rate buckets of 60/min/user and 120/min/party',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route returns a strict draft resource and aggregate ETag after two rate buckets',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes-refusals.test.ts',
            title:
              'CMS-03C-04 locale authoring route checks both rate buckets, validates decisions, and returns Retry-After',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-locale-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-04 canonical API authority registers the served locale authoring operation with exact protection',
          },
        ],
      },
      {
        text: 'a 15,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes-binding-and-order.test.ts',
            title:
              'CMS-03C-04 locale authoring route fences rejected ports, thrown ports, and a deadline without provider prose',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter distinguishes an expired error body and an expired success body',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-locale-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-04 canonical API authority registers the served locale authoring operation with exact protection',
          },
        ],
      },
      {
        text: 'no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route returns a strict draft resource and aggregate ETag after two rate buckets',
          },
        ],
      },
      {
        text: 'the Tier 2 p95 < 1,200 ms',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_locale.sql',
            title:
              'CMS-03C-04 write of 128 locale fields over 24 real calls: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-056]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-locale.apispec.ts',
            title:
              'Slice 12 locale latency through the real stack [CMS-03C-04] writing a 128-field fr-FR variant: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-056] [P2-S12-AC-279]',
          },
        ],
      },
      {
        text: 'RPC < 300 ms targets',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_perf/001-bench.sqlinc',
            title:
              'a 128-field CMS-03C-04 write meets the RPC < 300 ms target (median of five) [P2-S12-AC-279]',
          },
        ],
      },
      {
        text: 'replays an exact repeat of the same command',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'same idempotency key replays the exact committed response',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'calendar locale exact-key replay returns the same committed resource',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'calendar locale replay does not append another variant',
          },
        ],
      },
      {
        text: 'answers a changed body, path or version under the same key with 409,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc',
            title:
              'the same key with a changed body is a 409 mismatch [P2-S12-AC-056]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc',
            title:
              'the same key with a changed path locale is a 409 mismatch [P2-S12-AC-056]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc',
            title:
              'the same key with a changed entry version is a 409 mismatch [P2-S12-AC-056]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts',
            title:
              'CMS-03C-04 author a locale variant through the real stack [P2-S12-AC-056] an exact replay, also after a lost response, returns the stored 201 and adds nothing; a changed body under the same key is 409',
          },
        ],
      },
      {
        text: 'and never replays to a changed acting party (an entry outside its scope is the concealed 404, answered before the key is reserved).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db3_locale_party.sql',
            title:
              'the same actor replaying the key under another server-resolved acting party is never served the stored response [P2-S12-AC-056]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db3_locale_party.sql',
            title:
              'the entry belongs to organization A, so under organization B the entry itself is the concealed NOT_FOUND, answered before the reservation is read (BE03c visibility, then capability, then idempotency) [P2-S12-AC-056]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-057',
    text: 'CMS-03C-04 maps malformed IDs, header or body (400 `INVALID_REQUEST`), a missing session (401), a denied edit (403 `LOCALE_FORBIDDEN`), a hidden or absent entry or source (404 `LOCALE_SOURCE_NOT_FOUND`), a stale source hash or entry version or a duplicate locale (409 `LOCALE_VERSION_CONFLICT`), a non-JSON body (415), a BCP 47, field, fallback or no_fallback schema failure (422 `LOCALE_VALIDATION_FAILED`), the locale limit (429), a schema or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.locale.v1`; a failure before commit leaves no record and a lost response replays by idempotency key.',
    clauses: [
      {
        text: 'CMS-03C-04 maps malformed IDs, header or body (400 `INVALID_REQUEST`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route rejects malformed path, query, headers, body and cookie CSRF before persistence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route rejects path/body mismatch after authentication and before authorization or persistence',
          },
        ],
      },
      {
        text: 'a missing session (401)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route fails closed on invalid session envelopes and resolver outages',
          },
        ],
      },
      {
        text: 'a denied edit (403 `LOCALE_FORBIDDEN`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route requires assignment-capable human context and valid origin',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter maps port refusals to exact locked CMS-03C-04 catalog codes',
          },
        ],
      },
      {
        text: 'a hidden or absent entry or source (404 `LOCALE_SOURCE_NOT_FOUND`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter maps port refusals to exact locked CMS-03C-04 catalog codes',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'other-tenant entry existence remains concealed',
          },
        ],
      },
      {
        text: 'a stale source hash or entry version or a duplicate locale (409 `LOCALE_VERSION_CONFLICT`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter maps port refusals to exact locked CMS-03C-04 catalog codes',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes-refusals.test.ts',
            title:
              'CMS-03C-04 locale authoring route returns the active chain on a fallback-chain mismatch and nothing else',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_hash_mismatch.sql',
            title: 'stale recompute hash conflicts as 409, never 503',
          },
        ],
      },
      {
        text: 'a non-JSON body (415)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route rejects stale/missing If-Match and non-JSON payloads',
          },
        ],
      },
      {
        text: 'a BCP 47, field, fallback or no_fallback schema failure (422 `LOCALE_VALIDATION_FAILED`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter maps port refusals to exact locked CMS-03C-04 catalog codes',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter maps a locale outside supportedLocales to the 422 catalog code without a chain',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter [P2-S09-AC-1166] maps the database refusal of a nonlocalizable field declared as no_fallback to the 422 catalog code without naming the field',
          },
        ],
      },
      {
        text: 'the locale limit (429)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes-refusals.test.ts',
            title:
              'CMS-03C-04 locale authoring route checks both rate buckets, validates decisions, and returns Retry-After',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes-binding-and-order.test.ts',
            title:
              'CMS-03C-04 locale authoring route publishes the BE00 429 contract with second-granularity reset and matching headers',
          },
        ],
      },
      {
        text: 'a schema or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-04 locale variant' the 15-second route deadline answers 504 DEPENDENCY_UNAVAILABLE",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-04 locale variant' a port failure of 503 answers that status as DEPENDENCY_UNAVAILABLE with the bound message and closed details",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-04 locale variant' a port that throws answers 503 DEPENDENCY_UNAVAILABLE without its prose",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-04 locale variant' a malformed port envelope answers 502 DEPENDENCY_UNAVAILABLE",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts',
            title:
              'CMS-03C-04 author a locale variant through the real stack [P2-S12-AC-057] a dependency that never answers is 503 DEPENDENCY_UNAVAILABLE and writes nothing',
          },
        ],
      },
      {
        text: 'and an internal failure (500)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes-binding-and-order.test.ts',
            title:
              'CMS-03C-04 locale authoring route normalizes unexpected execution exceptions to a scrubbed 500',
          },
        ],
      },
      {
        text: 'to typed ApiError of catalog `cms.03c.locale.v1`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes-refusals.test.ts',
            title:
              'CMS-03C-04 locale authoring route scrubs all provider status codes and unsafe details',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-locale.test.ts',
            title:
              'CMS-03C-04 production locale adapter maps port refusals to exact locked CMS-03C-04 catalog codes',
          },
        ],
      },
      {
        text: 'a failure before commit leaves no record',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
            title:
              'a refused authoring writes no variant, no revision and does not move the entry version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'false source hash is rejected before mutation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title:
              'invalid calendar translations leave no German locale variant',
          },
        ],
      },
      {
        text: 'and a lost response replays by idempotency key.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'same idempotency key replays the exact committed response',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
            title: 'calendar locale replay does not append another variant',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-058',
    text: "CMS-03C-04 is consumed by the protected `CmsLocaleVariantForm` at `/app/cms-content-modeling/entries/:entryId/locales/:locale`, which offers only localizable fields, shows the fallback order read-only from the protected version detail and submits it unchanged as the equality expectation, shows per-field resolution (own value, fallback source locale, `no_fallback` missing or stale) and the derived variant state, marks `staleFieldIds`, never displays another locale's text for a `no_fallback` field, offers explicit revalidation, and renders fixed copy then refetches on 409 `FALLBACK_CHAIN_MISMATCH` and `locale_limit_reached`; verification covers per-field resolution and the `no_fallback` rule, the derived variant states, both fixed 409 messages, the 403/404 split and the focused result heading.",
    clauses: [
      {
        text: 'CMS-03C-04 is consumed by the protected `CmsLocaleVariantForm` at `/app/cms-content-modeling/entries/:entryId/locales/:locale`',
        citations: [],
      },
      {
        text: 'which offers only localizable fields',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: what the page shows (FE03 :891, :1122, :1336) offers exactly the localizable fields, with the label and no "(required)", and each rule in words',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/load-locale-variant-page.test.ts',
            title:
              'loadLocaleVariantPage (FE03 :1073, :1641; AC-270; DEC-205) offers an empty field list, not a form, when the type has no translatable field',
          },
        ],
      },
      {
        text: 'shows the fallback order read-only from the protected version detail and submits it unchanged as the equality expectation',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: what the page shows (FE03 :891, :1122, :1336) states the entry, the language and the read-only fallback order as "{target}: {a} → {default}"',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/load-locale-variant-page.read.test.ts',
            title:
              'loadLocaleVariantPage: what cmsLocaleVariantRead carries into the view (DEC-205) shows the read’s own order: an empty order for the default locale and the declared one otherwise',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: saving (CMS-03C-04) sends the exact request with the CSRF token and a fresh idempotency key, then shows the saved draft state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.refusals.test.tsx',
            title:
              'CmsLocaleVariantForm: 409 FALLBACK_CHAIN_MISMATCH (FE03 :1336) shows the fixed copy, replaces the order with the active one, keeps the values and submits the new order next',
          },
        ],
      },
      {
        text: 'shows per-field resolution (own value, fallback source locale, `no_fallback` missing or stale) and the derived variant state',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: what the page shows (FE03 :891, :1122, :1336) shows each resolution as text and never another language’s text for a no_fallback field',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/locale-resolution-text.test.ts',
            title:
              'resolutionText (FE03 :891, :1122; BE03c 1526) states an own value as text, with no locale text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/locale-resolution-text.test.ts',
            title:
              'resolutionText (FE03 :891, :1122; BE03c 1526) states a fallback from another language as text, with no locale text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/locale-resolution-text.test.ts',
            title:
              'resolutionText (FE03 :891, :1122; BE03c 1526) states a missing no_fallback value as text, with no locale text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/locale-resolution-text.test.ts',
            title:
              'resolutionText (FE03 :891, :1122; BE03c 1526) states a stale no_fallback value as text, with no locale text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: what the page shows (FE03 :891, :1122, :1336) [P2-S12-AC-234] states the derived variant status in words, and the rule of a stale one',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/load-locale-variant-page.read.test.ts',
            title:
              'loadLocaleVariantPage: what cmsLocaleVariantRead carries into the view (DEC-205) [P2-S12-AC-234] carries the derived variant state and the stored values of the writable fields',
          },
        ],
      },
      {
        text: 'marks `staleFieldIds`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: what the page shows (FE03 :891, :1122, :1336) [P2-S12-AC-058] marks the fields the read named stale before any save and offers Revalidate',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: what the page shows (FE03 :891, :1122, :1336) marks a stale field from the read’s stale ids even when its resolution is not listed',
          },
        ],
      },
      {
        text: "never displays another locale's text for a `no_fallback` field",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: what the page shows (FE03 :891, :1122, :1336) shows the source text of a fallback-permitted field only, in its own language, never beside a no_fallback field',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/load-locale-variant-page.test.ts',
            title:
              'loadLocaleVariantPage (FE03 :1073, :1641; AC-270; DEC-205) never carries the source text of a no_fallback field into the page data',
          },
        ],
      },
      {
        text: 'offers explicit revalidation',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: saving (CMS-03C-04) offers an explicit Revalidate action when a field is stale, and none otherwise',
          },
        ],
      },
      {
        text: 'and renders fixed copy then refetches on 409 `FALLBACK_CHAIN_MISMATCH` and `locale_limit_reached`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.refusals.test.tsx',
            title:
              'CmsLocaleVariantForm: 409 conflict and locale_limit_reached shows {"kind":"conflict","currentVersion":"9"} as fixed copy, refetches the source and blocks saving until it is used',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.refusals.test.tsx',
            title:
              'CmsLocaleVariantForm: 409 conflict and locale_limit_reached shows {"kind":"limit_reached"} as fixed copy, refetches the source and blocks saving until it is used',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.refusals.test.tsx',
            title:
              'CmsLocaleVariantForm: 409 conflict and locale_limit_reached keeps the old source and offers a retry when the refetch fails, never enabling a blind save',
          },
        ],
      },
      {
        text: 'verification covers per-field resolution and the `no_fallback` rule, the derived variant states, both fixed 409 messages, the 403/404 split and the focused result heading.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.refusals.test.tsx',
            title:
              'CmsLocaleVariantForm: typed refusals keep the input and say one fixed thing each keeps the 403 and the 404 apart',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: what the page shows (FE03 :891, :1122, :1336) shows the status Draft after a save, whatever it was before',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: saving (CMS-03C-04) sends the exact request with the CSRF token and a fresh idempotency key, then shows the saved draft state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/load-locale-variant-page.read.test.ts',
            title:
              'loadLocaleVariantPage: what cmsLocaleVariantRead carries into the view (DEC-205) [P2-S12-AC-234] shows untranslated for an explicit null variant, with nothing stored',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "CMS-03C-04 is consumed by the protected `CmsLocaleVariantForm` at `/app/cms-content-modeling/entr...": DEC-226(3): "consumed by <island> at /app/..." needs page-level behaviour (an Astro render test or a real-route Playwright spec); the cited loader, component, composed React and source-text tests do not prove that the page mounts the island',
  },
  {
    criterion: 'P2-S12-AC-059',
    text: 'CMS-03C-05 registers POST /api/v1/cms/entries/{entryId}/related-content with the strict `RelatedContentRuleRequest` (`entryId`, unique `pins` of at most 32, unique `exclusions` of at most 64, a nullable `derivedRule` of `key`, `version`, `reasonCode` and `maxCandidates`, and `expectedVersion`) and returns the strict `RelatedContentResource` as 201 (`state` `active` or `revoked`, `sourceEntryId`, `pins`, `exclusions`, `derivedRule` of `key` and `version` or null, and `eligibleCount` 0-128); generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-05 registers POST /api/v1/cms/entries/{entryId}/related-content with the strict `RelatedContentRuleRequest` (`entryId`, unique `pins` of at most 32, unique `exclusions` of at most 64, a nullable `derivedRule` of `key`, `version`, `reasonCode` and `maxCandidates`, and `expectedVersion`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract accepts the addressed rule and an explicit no-derived-rule command',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract bounds and deduplicates pins and exclusions with no ambiguous overlap',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract rejects malformed addressing, caller authority, version, and rule input',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-related-content-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-05 canonical API authority registers the served related-content operation with exact protection',
          },
        ],
      },
      {
        text: 'and returns the strict `RelatedContentResource`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract exposes only the closed browser-safe rule and eligible count',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-envelope.test.ts',
            title:
              'CMS-03C-05 port envelope validation rejects a contract-invalid resource payload as 502',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-envelope.test.ts',
            title:
              'CMS-03C-05 port envelope validation rejects malformed and resource-mismatched port payloads as 502',
          },
        ],
      },
      {
        text: 'as 201 (`state` `active` or `revoked`, `sourceEntryId`, `pins`, `exclusions`, `derivedRule` of `key` and `version` or null, and `eligibleCount` 0-128);',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'the answer is exactly the RelatedContentResource members [P2-S12-AC-059]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title: 'a rule set with active items is active [P2-S12-AC-059]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'the derived rule answers only key and version [P2-S12-AC-059]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/004-replace.sqlinc',
            title:
              'D: the resource is revoked with empty lists, no rule and eligibleCount 0 [P2-S12-AC-059]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract exposes only the closed browser-safe rule and eligible count',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-related-content-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-05 canonical API authority publishes required path, headers, body, 201 resource, and safe errors',
          },
        ],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-related-content-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-05 canonical API authority registers the served related-content operation with exact protection',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-related-content-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-05 canonical API authority publishes required path, headers, body, 201 resource, and safe errors',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/entries/[entryId]/related-content.test.ts',
            title:
              'CMS-03C-05 related-content page route is a dynamic first-party POST route that forwards to the protected Worker',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-060',
    text: 'CMS-03C-05 serves only an assigned CMS author or editor who can edit the source entry: a hidden or absent source is 404 `RELATED_CONTENT_NOT_FOUND`, a hidden, absent or ineligible target is the uniform 422 `related_target_ineligible`, a visible source without edit assignment is 403 `RELATED_CONTENT_FORBIDDEN`, a recommendation never grants access to a target the caller could not already read, and the stored rule carries no authority.',
    clauses: [
      {
        text: 'CMS-03C-05 serves only an assigned CMS author or editor who can edit the source entry',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'a granted editor with no assignment on the source is refused capability_missing [P2-S12-AC-060]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'a member without a CMS author or editor grant sees the source but may not edit it: capability_missing (403) [P2-S12-AC-060]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'a caller without edit authority is refused capability_missing even when a pin is ineligible [P2-S12-AC-060]',
          },
        ],
      },
      {
        text: 'a hidden or absent source is 404 `RELATED_CONTENT_NOT_FOUND`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'a caller outside the owning organization sees the source as absent [P2-S12-AC-060]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'a source owned by another party is hidden: NOT_FOUND [P2-S12-AC-060]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-related.test.ts',
            title:
              'CMS-03C-05 production related-content adapter maps the generic BE03b tokens to their statuses',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-errors.test.ts',
            title:
              'CMS-03C-05 port failure mapping forwards port refusals with bounded allowlisted details',
          },
        ],
      },
      {
        text: 'a hidden, absent or ineligible target is the uniform 422 `related_target_ineligible`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'an absent, self, archived, held, unassigned (hidden) and other-owner pin each give related_target_ineligible [P2-S12-AC-227]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'the six refusals are byte-identical: a write is never an existence oracle [P2-S12-AC-227]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-typed-refusals.test.ts',
            title:
              'CMS-03C-05 typed refusals (BE03c 1304, 1380-1383) publishes related_target_ineligible with the offending row pointers as one uniform 422',
          },
        ],
      },
      {
        text: 'a visible source without edit assignment is 403 `RELATED_CONTENT_FORBIDDEN`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'a granted editor with no assignment on the source is refused capability_missing [P2-S12-AC-060]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-typed-refusals.test.ts',
            title:
              'CMS-03C-05 typed refusals (BE03c 1304, 1380-1383) publishes capability_missing on the 403 of a visible source without edit',
          },
        ],
      },
      {
        text: 'a recommendation never grants access to a target the caller could not already read',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'an absent, self, archived, held, unassigned (hidden) and other-owner pin each give related_target_ineligible [P2-S12-AC-227]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'an entry now owned by another party disappears: a recommendation never crosses owners [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'only the pins whose lineage head is an active publish row for (en-US, public) are projected, in pin position order [P2-S12-AC-154]',
          },
        ],
      },
      {
        text: 'and the stored rule carries no authority.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'a pinned entry published after the pin appears at its pin position: nothing was stored at write time [P2-S12-AC-156]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract exposes only the closed browser-safe rule and eligible count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_related_authority.sql',
            title:
              'browser and service roles have no direct locale or relation grants',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-061',
    text: 'CMS-03C-05 requires an `Idempotency-Key` and the strong `If-Match` equal to the source entry aggregate `version` (`expectedVersion`), applies CAS on the source entry, enforces unique pin and exclusion targets, rate buckets of 60/min/user and 120/min/party, a 15,000 ms deadline, no-store and Tier 2, appends rows without updating any, and emits no event of its own (related eligibility is evaluated at read, so a publication needs no invalidation and 03c consumes no `cms.publication.changed.v1`).',
    clauses: [
      {
        text: 'CMS-03C-05 requires an `Idempotency-Key` and the strong `If-Match` equal to the source entry aggregate `version` (`expectedVersion`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract requires idempotent JSON and a strong source-entry validator',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'BE00 steps 2 and 8 on the CMS related-content route refuses a body expectedVersion that differs from If-Match once headers are checked',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'CMS-03C-05 admission gate enforces origin, path binding, media, validators, and CSRF before the port',
          },
        ],
      },
      {
        text: 'applies CAS on the source entry',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'the source entry aggregate version advanced by exactly one (CAS) [P2-S12-AC-061]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/007-cas-and-locks.sqlinc',
            title:
              'a version ahead of the entry is a version mismatch [P2-S12-AC-061]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/007-cas-and-locks.sqlinc',
            title: 'a stale write appended no row [P2-S12-AC-061]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/007-cas-and-locks.sqlinc',
            title:
              'the previous operand is now stale: the loser of two writers from version 1 is refused [P2-S12-AC-061]',
          },
        ],
      },
      {
        text: 'enforces unique pin and exclusion targets',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract bounds and deduplicates pins and exclusions with no ambiguous overlap',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'CMS-03C-05 admission gate validates the body before admission and forwards only contract violations',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title: 'a duplicate pin is refused [P2-S12-AC-036]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc',
            title: 'a duplicate exclusion is refused [P2-S12-AC-036]',
          },
        ],
      },
      {
        text: 'rate buckets of 60/min/user and 120/min/party',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'CMS-03C-05 admission gate enforces two distinct rate buckets keyed by user and party',
          },
        ],
      },
      {
        text: 'a 15,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-success.test.ts',
            title:
              'CMS-03C-05 success and runtime resilience aborts rate and mutation when admission completes only after the deadline',
          },
        ],
      },
      {
        text: 'no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-success.test.ts',
            title:
              'CMS-03C-05 success and runtime resilience admits a contract-shaped resource to 201 with stable headers',
          },
        ],
      },
      {
        text: 'Tier 2',
        citations: [],
      },
      {
        text: 'appends rows without updating any',
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
        text: 'and emits no event of its own',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title:
              'no outbox event is emitted: the command emits none until publication [P2-S12-AC-061]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc',
            title: 'the whole call wrote no outbox row at all [P2-S12-AC-061]',
          },
        ],
      },
      {
        text: '(related eligibility is evaluated at read, so a publication needs no invalidation and 03c consumes no `cms.publication.changed.v1`).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'an unpublished entry (tombstone head) disappears [P2-S12-AC-157]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'a pinned entry published after the pin appears at its pin position: nothing was stored at write time [P2-S12-AC-156]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "Tier 2": missing test: staging/hosted performance evidence that POST /api/v1/cms/entries/{entryId}/related-content meets the Tier 2 p95 < 1,200 ms end-to-end budget (tests/performance/api-p95-smoke.test.ts does not cover CMS-03C-05). Only the RPC bench "curating 64 related targets meets the RPC < 300 ms target (p95 of 10)" in phase_02_slice_12_related_perf.sql exists, which is the RPC share of the budget, not the end-to-end p95 (hosted/native evidence, root-owned).',
  },
  {
    criterion: 'P2-S12-AC-062',
    text: 'CMS-03C-05 maps malformed IDs, header or body (400), a missing session (401), a denied source edit (403 `RELATED_CONTENT_FORBIDDEN`), a hidden source (404 `RELATED_CONTENT_NOT_FOUND`), a stale version or duplicate pin (409 `RELATED_CONTENT_VERSION_CONFLICT`), a non-JSON body (415), a pin, exclusion or rule schema failure or a hidden, absent or ineligible target (422 `RELATED_CONTENT_VALIDATION_FAILED`), the relationship limit (429), a target projection or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.related-content.v1`, commits no mutation on unresolved target authorization, and lets a target that later becomes private or unpublished drop out of the public projection while the rule history stays private.',
    clauses: [
      {
        text: 'CMS-03C-05 maps malformed IDs, header or body (400)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'CMS-03C-05 admission gate rejects requests with a query string or missing required admission headers',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'CMS-03C-05 admission gate enforces origin, path binding, media, validators, and CSRF before the port',
          },
        ],
      },
      {
        text: 'a missing session (401)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-errors.test.ts',
            title:
              'CMS-03C-05 port failure mapping maps session failures and missing capability without reaching the port',
          },
        ],
      },
      {
        text: 'a denied source edit (403 `RELATED_CONTENT_FORBIDDEN`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-errors.test.ts',
            title:
              'CMS-03C-05 port failure mapping maps session failures and missing capability without reaching the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-errors.test.ts',
            title:
              'CMS-03C-05 port failure mapping drops 403 refusal details when the reason code is missing or unexpected',
          },
        ],
      },
      {
        text: 'a hidden source (404 `RELATED_CONTENT_NOT_FOUND`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-errors.test.ts',
            title:
              'CMS-03C-05 port failure mapping forwards port refusals with bounded allowlisted details',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'a caller outside the owning organization sees the source as absent [P2-S12-AC-060]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'a source owned by another party is hidden: NOT_FOUND [P2-S12-AC-060]',
          },
        ],
      },
      {
        text: 'a stale version or duplicate pin (409 `RELATED_CONTENT_VERSION_CONFLICT`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-errors.test.ts',
            title:
              'CMS-03C-05 port failure mapping maps 409 and 429 port refusals to allowlisted details without leaking extras',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-errors.test.ts',
            title:
              'CMS-03C-05 port failure mapping drops 409 details that are not version strings',
          },
        ],
      },
      {
        text: 'a non-JSON body (415)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'CMS-03C-05 admission gate enforces origin, path binding, media, validators, and CSRF before the port',
          },
        ],
      },
      {
        text: 'a pin, exclusion or rule schema failure or a hidden, absent or ineligible target (422 `RELATED_CONTENT_VALIDATION_FAILED`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'CMS-03C-05 admission gate validates the body before admission and forwards only contract violations',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-errors.test.ts',
            title:
              'CMS-03C-05 port failure mapping strips non-conforming violation entries from 422 detail payloads',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'an absent, self, archived, held, unassigned (hidden) and other-owner pin each give related_target_ineligible [P2-S12-AC-227]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'the six refusals are byte-identical: a write is never an existence oracle [P2-S12-AC-227]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-typed-refusals.test.ts',
            title:
              'CMS-03C-05 typed refusals (BE03c 1304, 1380-1383) publishes related_target_ineligible with the offending row pointers as one uniform 422',
          },
        ],
      },
      {
        text: 'the relationship limit (429)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-errors.test.ts',
            title:
              'CMS-03C-05 port failure mapping maps 409 and 429 port refusals to allowlisted details without leaking extras',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-errors.test.ts',
            title:
              'CMS-03C-05 port failure mapping drops 429 details that are not safe non-negative numbers',
          },
        ],
      },
      {
        text: 'a target projection or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-05 related content' a port failure of 503 answers that status as DEPENDENCY_UNAVAILABLE with the bound message and closed details",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-05 related content' a port that throws answers 503 DEPENDENCY_UNAVAILABLE without its prose",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-05 related content' a malformed port envelope answers 502 DEPENDENCY_UNAVAILABLE",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'CMS-03C-05 related content' the 15-second route deadline answers 504 DEPENDENCY_UNAVAILABLE",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-related.test.ts',
            title:
              'CMS-03C-05 production related-content adapter maps provider outages and deadlines to 503 and 504',
          },
        ],
      },
      {
        text: 'and an internal failure (500)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-errors.test.ts',
            title:
              'CMS-03C-05 port failure mapping maps unrecognized port statuses to a safe internal error',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-success.test.ts',
            title:
              'CMS-03C-05 success and runtime resilience maps unexpected execution failures to a safe 500 and ignores telemetry rejection',
          },
        ],
      },
      {
        text: 'to typed ApiError of catalog `cms.03c.related-content.v1`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-errors.test.ts',
            title:
              'CMS-03C-05 port failure mapping fails closed after admission while the curated authority is unavailable',
          },
        ],
      },
      {
        text: 'commits no mutation on unresolved target authorization',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'nothing of the refused pins and exclusions was written [P2-S12-AC-062]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title: 'nothing advanced the source entry [P2-S12-AC-062]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc',
            title:
              'only the two successful curations of this fragment wrote audit records; every refusal wrote none [P2-S12-AC-062]',
          },
        ],
      },
      {
        text: 'and lets a target that later becomes private or unpublished drop out of the public projection while the rule history stays private.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'an unpublished entry (tombstone head) disappears [P2-S12-AC-157]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'an entry now owned by another party disappears: a recommendation never crosses owners [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'the stored pins are untouched by their targets leaving the public list (editorial history stays private) [P2-S12-AC-157]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'a revoked rule set projects nothing; its history stays private [P2-S12-AC-157]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-063',
    text: 'CMS-03C-05 is consumed by the protected `CmsRelatedContentForm`, which builds `RelatedContentRuleRequest` from an ordered pin list with move controls (no drag-only path), an exclusion list, a derived rule chosen from the registry (`shared-terms`, `same-type-recent`) with `maxCandidates`, and the `eligibleCount` shown after save, states beside the lists that exclusions win, picks entries only from the caller-readable entry list (CMS-03B-13), and renders `related_target_ineligible` as one fixed message at the offending row without saying why; verification covers the pin and exclusion bounds, the uniform refusal, the 403/404 split and the focused result heading.',
    clauses: [
      {
        text: 'CMS-03C-05 is consumed by the protected `CmsRelatedContentForm`, which builds `RelatedContentRuleRequest` from an ordered pin list with move controls (no drag-only path)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/related-content-route.test.tsx',
            title:
              'CMS-03C-05 protected related-content page, composed serves the editing form once the composed read supplies the saved rule, with the picker and the version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.lists.test.tsx',
            title:
              'CmsRelatedContentForm: pins moves a pin up and down with explicit controls and announces the new position',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.lists.test.tsx',
            title:
              'CmsRelatedContentForm: pins pins in the order chosen and states each row choice in text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx',
            title:
              'CmsRelatedContentForm: saving sends the ordered pins, exclusions and chosen rule with the entry version, csrf token and a fresh key',
          },
        ],
      },
      {
        text: 'an exclusion list',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.lists.test.tsx',
            title:
              'CmsRelatedContentForm: the first render offers a pin only for an active entry and an exclusion for every entry',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.lists.test.tsx',
            title:
              'CmsRelatedContentForm: exclusions win excludes an entry and removes its pin, saying so',
          },
        ],
      },
      {
        text: 'a derived rule chosen from the registry (`shared-terms`, `same-type-recent`) with `maxCandidates`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/related-rules.test.ts',
            title:
              'the browser related-rule registry has exactly the contract registry members, versions and reasons',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx',
            title:
              'CmsRelatedContentForm: saving hides the bound until a rule is chosen and never sends it without one',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx',
            title:
              'CmsRelatedContentForm: saving refuses a rule without a bound before sending, linking to the field, and sends nothing',
          },
        ],
      },
      {
        text: 'and the `eligibleCount` shown after save',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx',
            title:
              'CmsRelatedContentForm: saving announces the saved rule set and eligible count in the focused result heading, and moves to the next version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx',
            title:
              'CmsRelatedContentForm: saving says one entry is eligible, and no rule, in the singular',
          },
        ],
      },
      {
        text: 'states beside the lists that exclusions win',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.lists.test.tsx',
            title:
              'CmsRelatedContentForm: the first render states exclusions win beside the lists',
          },
        ],
      },
      {
        text: 'picks entries only from the caller-readable entry list (CMS-03B-13)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/load-related-content-page.test.ts',
            title:
              'loadRelatedContentPage: the view builds the form from the verified entry and the first page of readable entries',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/load-related-content-page.test.ts',
            title:
              'loadRelatedContentPage: the candidate read shows no form from an entry list it could not read or verify',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/related-candidates.test.ts',
            title:
              'fetchCandidatePage asks the same-origin entry list for one bounded page, with the cursor when given',
          },
        ],
      },
      {
        text: 'and renders `related_target_ineligible` as one fixed message at the offending row without saying why',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.refusals.test.tsx',
            title:
              'an ineligible target (422 related_target_ineligible) marks the offending pin row with the one fixed message and no other row',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.refusals.test.tsx',
            title:
              'an ineligible target (422 related_target_ineligible) never explains the cause: no mention of inactive, hidden, owner, readable, absent or self',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.refusals.test.tsx',
            title:
              'an ineligible target (422 related_target_ineligible) shows the identical message for a pin and an exclusion, so the cause cannot be inferred',
          },
        ],
      },
      {
        text: 'verification covers the pin and exclusion bounds, the uniform refusal, the 403/404 split and the focused result heading.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.lists.test.tsx',
            title:
              'CmsRelatedContentForm: pins stops at 32 pins: the 33rd cannot be chosen',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/related-content-request.test.ts',
            title:
              'buildRelatedContentRequest refuses 65 exclusions as the wire contract would',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.refusals.test.tsx',
            title:
              'an ineligible target (422 related_target_ineligible) marks the offending pin row with the one fixed message and no other row',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/load-related-content-page.test.ts',
            title:
              'loadRelatedContentPage: the entry read answers a concealed or absent entry with the one 404',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/load-related-content-page.test.ts',
            title:
              'loadRelatedContentPage: the saved-rule read is the edit gate (DEC-195, FE03 :1072) answers a reader without edit authority with the page-level 403 and reads no candidates',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx',
            title:
              'CmsRelatedContentForm: saving announces the saved rule set and eligible count in the focused result heading, and moves to the next version',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-064',
    text: 'CMS-03C-06 registers POST /api/v1/cms/governed-reviews with the strict `GovernedReviewSubmissionRequest` (`subjectKind`, `subjectId`, `subjectHash`) and returns the strict `GovernedReviewResource` as 201: `ResourceMeta` whose `contentHash` is the JCS SHA-256 of `{ subjectKind, subjectId, subjectHash, policyBasisHash, requiredDecisionCount, requiredCapabilities }`, plus `state` `open`, `subjectKind`, `subjectId`, `lineageId`, `subjectKey`, `subjectVersion`, `subjectHash`, `riskClass`, `requiredDecisionCount` 1-8, `recordedDecisionCount` 0-8, `requiredCapabilities` 1-16, `policyBasisHash`, `submittedAt`, `decidedAt`, `activatedAt` and `invalidatedReason`; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-06 registers POST /api/v1/cms/governed-reviews with the strict `GovernedReviewSubmissionRequest` (`subjectKind`, `subjectId`, `subjectHash`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review.test.ts',
            title:
              'CMS-03C-06 governed review submission contract (DEC-137) [P2-S12-AC-064] composes headers and body into the OpenAPI transport view',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
            title:
              'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) forwards the exact body and key and carries no validator',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
            title:
              'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) rejects caller authority or private member idempotencyKey',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review.test.ts',
            title:
              'CMS-03C-06 governed review submission contract (DEC-137) [P2-S12-AC-064] accepts the exact version row id and stored content hash for each kind',
          },
        ],
      },
      {
        text: 'and returns the strict `GovernedReviewResource` as 201: `ResourceMeta` whose `contentHash` is the JCS SHA-256 of `{ subjectKind, subjectId, subjectHash, policyBasisHash, requiredDecisionCount, requiredCapabilities }`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the frozen policy-basis hash and review content hash equal the server recomputation from the fixture [P2-S12-AC-064]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the 201 body is exactly GovernedReviewResource (21 members) [P2-S12-AC-064]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
            title:
              'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) answers 201 with a strict template_version review',
          },
        ],
      },
      {
        text: 'plus `state` `open`, `subjectKind`, `subjectId`, `lineageId`, `subjectKey`, `subjectVersion`, `subjectHash`, `riskClass`, `requiredDecisionCount` 1-8, `recordedDecisionCount` 0-8, `requiredCapabilities` 1-16, `policyBasisHash`, `submittedAt`, `decidedAt`, `activatedAt` and `invalidatedReason`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review.test.ts',
            title:
              'GovernedReviewResource (CMS-03C-06 201, CMS-03C-07 200) [P2-S12-AC-064] accepts the exact open review and carries no ownership, submitter or reviewer identifier',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review.test.ts',
            title:
              'GovernedReviewResource (CMS-03C-06 201, CMS-03C-07 200) [P2-S12-AC-064] bounds the decision counts 1-8 and 0-8, the capability slots 1-16 and the subject version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the 201 body is exactly GovernedReviewResource (21 members) [P2-S12-AC-064]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the review is open at version 1 and freezes the subject definition hash, the single-member policy basis and the block digest [P2-S12-AC-064]',
          },
        ],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-064] CMS-03C-06 registers POST /api/v1/cms/governed-reviews with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-064] CMS-03C-06 generates the documented parameters, request body, success statuses and error matrix',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-06 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-06 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-065',
    text: "CMS-03C-06 accepts only a closed `subjectKind`, a `subjectId` that is the exact version row id in the caller's owner scope and a `subjectHash` of 64 lowercase hex equal to the stored `content_hash` (422 at `/subjectHash` otherwise), requires the subject state `draft` with no live review (else 409 `subject_not_submittable`) and, for a taxonomy version, a registered provider for every declared canonical domain (else 422 `canonical_source_unavailable` with `details.domain`), names the exact subject version by id and hash so no `If-Match` applies, and admits at most one live review per subject version through the partial unique index.",
    clauses: [
      {
        text: 'CMS-03C-06 accepts only a closed `subjectKind`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review.test.ts',
            title:
              'CMS-03C-06 governed review submission contract (DEC-137) [P2-S12-AC-064] closes the subject kinds, review states and invalidation reasons',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
            title:
              'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) refuses subjectKind=navigation_version with a 422 at /subjectKind before rate admission',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
            title:
              'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) refuses subjectKind=Template_Version with a 422 at /subjectKind before rate admission',
          },
        ],
      },
      {
        text: "a `subjectId` that is the exact version row id in the caller's owner scope",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_governed.sql',
            title:
              'an absent id and a version row of another organization meet the same concealed NOT_FOUND [P2-S12-AC-066]',
          },
        ],
      },
      {
        text: 'and a `subjectHash` of 64 lowercase hex equal to the stored `content_hash` (422 at `/subjectHash` otherwise)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review.test.ts',
            title:
              'CMS-03C-06 governed review submission contract (DEC-137) [P2-S12-AC-065] refuses an off-grammar subject id, a subject hash that is not 64 lowercase hex and any other member',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit/030-hash-refusal.sqlinc',
            title:
              'a stored-hash mismatch is VALIDATION_FAILED (422), not subject_not_submittable (409) [P2-S12-AC-249]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit/030-hash-refusal.sqlinc',
            title:
              'the hash mismatch names exactly the /subjectHash pointer [P2-S12-AC-249]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit/030-hash-refusal.sqlinc',
            title:
              "another subject's valid hash is the same 422 /subjectHash refusal [P2-S12-AC-249]",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-observability.test.ts',
            title:
              'CMS-03C-06 retry, rate and violation response members maps a stored-hash mismatch raised as VALIDATION_FAILED at /subjectHash to 422 (BE03c 389)',
          },
        ],
      },
      {
        text: 'requires the subject state `draft` with no live review (else 409 `subject_not_submittable`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit/030-hash-refusal.sqlinc',
            title:
              'a non-draft subject with the correct hash stays 409 subject_not_submittable [P2-S12-AC-251]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'a second live review for the same subject version is refused 409 subject_not_submittable [P2-S12-AC-251]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-refusals.test.ts',
            title:
              'CMS-03C-06 SQL refusal transport (tokens of 20261013300820) handles reason token subject_not_submittable by the CMS-03C-06 contract list',
          },
        ],
      },
      {
        text: 'and, for a taxonomy version, a registered provider for every declared canonical domain (else 422 `canonical_source_unavailable` with `details.domain`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'submit-gear: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'gear: canonical-source refusal identifies its declared domain',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-refusals.test.ts',
            title:
              'CMS-03C-06 SQL refusal transport (tokens of 20261013300820) carries the canonical domain of canonical_source_unavailable (BE03c 1375, DEC-180 G11)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc',
            title:
              'built declared domain submits through the real governed command',
          },
        ],
      },
      {
        text: 'names the exact subject version by id and hash so no `If-Match` applies',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-headers.test.ts',
            title:
              'CMS-03C-06 capability, header and preflight admission (BE03c row 168) accepts no If-Match: a present validator is refused before the RPC',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review.test.ts',
            title:
              'CMS-03C-06 governed review submission contract (DEC-137) [P2-S12-AC-067] requires JSON and a bounded idempotency key and refuses any If-Match',
          },
        ],
      },
      {
        text: 'and admits at most one live review per subject version through the partial unique index.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'a second live review for the same subject version is refused 409 subject_not_submittable [P2-S12-AC-251]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the duplicate refusal leaves exactly one live (open or approved) review [P2-S12-AC-251]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-066',
    text: "CMS-03C-06 derives session and acting context server-side and serves only a holder of the subject kind's owner capability in the subject's owner party (`cms.template_designer` for a template or pattern version, `cms.taxonomy_curator` for a taxonomy version): a hidden or absent subject is 404, a visible subject without the capability is 403 `capability_missing`, `submitted_by` is server-derived, no step-up is required, and no person, party or authority identifier is serialized.",
    clauses: [
      {
        text: 'CMS-03C-06 derives session and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-admission.test.ts',
            title:
              'CMS-03C-06 Worker admission (BE03c row 168, BE00 order) uses real resolver authority bound to the original Request',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-admission.test.ts',
            title:
              'CMS-03C-06 Worker admission (BE03c row 168, BE00 order) requires an acting party even for an owner-capability holder',
          },
        ],
      },
      {
        text: "and serves only a holder of the subject kind's owner capability in the subject's owner party (`cms.template_designer` for a template or pattern version, `cms.taxonomy_curator` for a taxonomy version)",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-headers.test.ts',
            title:
              'CMS-03C-06 capability, header and preflight admission (BE03c row 168) requires an owner capability (designer or curator) before rate admission',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'a visible subject without the owner capability is refused 403 capability_missing [P2-S12-AC-262]',
          },
        ],
      },
      {
        text: 'a hidden or absent subject is 404',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_governed.sql',
            title:
              'an absent id and a version row of another organization meet the same concealed NOT_FOUND [P2-S12-AC-066]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_governed.sql',
            title:
              'the concealed refusals carry the same DETAIL (none), so nothing distinguishes hidden from absent [P2-S12-AC-066]',
          },
        ],
      },
      {
        text: 'a visible subject without the capability is 403 `capability_missing`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'a visible subject without the owner capability is refused 403 capability_missing [P2-S12-AC-262]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-refusals.test.ts',
            title:
              'CMS-03C-06 SQL refusal transport (tokens of 20261013300820) keeps a visible subject without the capability a 403, not a 404',
          },
        ],
      },
      {
        text: '`submitted_by` is server-derived',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the GovernedReview row stores the server-derived submitter, the frozen basis, the recomputed digest and the content hash [P2-S12-AC-197]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
            title:
              'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) rejects caller authority or private member submittedBy',
          },
        ],
      },
      {
        text: 'no step-up is required',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-064] CMS-03C-06 registers POST /api/v1/cms/governed-reviews with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
            title:
              'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) answers 201 with a strict template_version review',
          },
        ],
      },
      {
        text: 'and no person, party or authority identifier is serialized.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review.test.ts',
            title:
              'GovernedReviewResource (CMS-03C-06 201, CMS-03C-07 200) [P2-S12-AC-064] accepts the exact open review and carries no ownership, submitter or reviewer identifier',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the 201 body is exactly GovernedReviewResource (21 members) [P2-S12-AC-064]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
            title:
              'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) rejects a success body that fails the strict resource schema',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-067',
    text: 'CMS-03C-06 requires an `Idempotency-Key` and no `If-Match`, enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline, no-store and the Tier 2 p95 < 1,200 ms target, and in one transaction freezes the subject hash, the policy basis and the block digest, inserts the `open` review with its dependency rows, sets the subject to `review` and writes the audit record, emitting no event.',
    clauses: [
      {
        text: 'CMS-03C-06 requires an `Idempotency-Key` and no `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-headers.test.ts',
            title:
              'CMS-03C-06 capability, header and preflight admission (BE03c row 168) rejects a missing or invalid idempotency key: x',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-headers.test.ts',
            title:
              'CMS-03C-06 capability, header and preflight admission (BE03c row 168) rejects a missing or invalid idempotency key: undefined',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-headers.test.ts',
            title:
              'CMS-03C-06 capability, header and preflight admission (BE03c row 168) accepts no If-Match: a present validator is refused before the RPC',
          },
        ],
      },
      {
        text: 'enforces rate buckets of 30/min/user and 60/min/party',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-production.test.ts',
            title:
              'CMS-03C-06 production transport boundary consumes the user quota (30/min) then the party quota (60/min)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-production.test.ts',
            title:
              'CMS-03C-06 production transport boundary stops denied user quota before RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-production.test.ts',
            title:
              'CMS-03C-06 production transport boundary stops denied party quota before RPC',
          },
        ],
      },
      {
        text: 'a 15,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-production.test.ts',
            title:
              'CMS-03C-06 production transport boundary ends a stalled session at the 15 second route deadline',
          },
        ],
      },
      {
        text: 'no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
            title:
              'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) answers 201 with a strict template_version review',
          },
        ],
      },
      {
        text: 'the Tier 2 p95 < 1,200 ms target',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_governed/050-assert.sqlinc',
            title:
              'CMS-03C-06 submit over 110 real submissions: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-067]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-governed.apispec.ts',
            title:
              'Slice 12 governed-review latency through the real stack [CMS-03C-06] submit over a real draft template: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-067]',
          },
        ],
      },
      {
        text: 'in one transaction freezes the subject hash, the policy basis and the block digest, inserts the `open` review with its dependency rows',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the GovernedReview row stores the server-derived submitter, the frozen basis, the recomputed digest and the content hash [P2-S12-AC-197]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the frozen policy-basis hash and review content hash equal the server recomputation from the fixture [P2-S12-AC-064]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the review freezes its dependency identity, the bound content-type version [P2-S12-AC-249]',
          },
        ],
      },
      {
        text: 'sets the subject to `review`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title: 'submit moves the draft subject to review [P2-S12-AC-205]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'submit advances the separate lifecycle_version by one while the definition version stays 1 (DEC-188) [P2-S12-AC-205]',
          },
        ],
      },
      {
        text: 'writes the audit record',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'submit writes exactly one audit record for the review [P2-S12-AC-251]',
          },
        ],
      },
      {
        text: 'emitting no event.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'submit emits no outbox event (submission emits no event; activation and retirement are the emitting governed commands) [P2-S12-AC-251]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-068',
    text: 'CMS-03C-06 maps malformed IDs, header or body (400), a missing session (401), a missing capability (403), a hidden or absent subject (404), `subject_not_submittable` or an idempotency conflict (409), a non-JSON body (415), a subject hash or kind failure or, for a taxonomy version that declares an unbuilt canonical domain, `canonical_source_unavailable` with `details.domain` (422), the governed-review limit (429), a preflight or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`, writes no review, dependency row or subject-state change on any refusal, and answers a NULL workflow-policy evidence as 503 `DEPENDENCY_UNAVAILABLE`.',
    clauses: [
      {
        text: 'CMS-03C-06 maps malformed IDs, header or body (400)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
            title:
              'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) rejects malformed JSON before rate admission',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-headers.test.ts',
            title:
              'CMS-03C-06 capability, header and preflight admission (BE03c row 168) rejects a query string on the command route',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-headers.test.ts',
            title:
              'CMS-03C-06 capability, header and preflight admission (BE03c row 168) rejects a missing or invalid idempotency key: x',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-refusals.test.ts',
            title:
              'CMS-03C-06 SQL refusal transport (tokens of 20261013300820) maps the producer token INVALID_REQUEST to 400',
          },
        ],
      },
      {
        text: 'a missing session (401)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-admission.test.ts',
            title:
              'CMS-03C-06 Worker admission (BE03c row 168, BE00 order) mounts CMS-03C-06 and rejects a valid anonymous submission with 401',
          },
        ],
      },
      {
        text: 'a missing capability (403)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-refusals.test.ts',
            title:
              'CMS-03C-06 SQL refusal transport (tokens of 20261013300820) keeps a visible subject without the capability a 403, not a 404',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-headers.test.ts',
            title:
              'CMS-03C-06 capability, header and preflight admission (BE03c row 168) requires an owner capability (designer or curator) before rate admission',
          },
        ],
      },
      {
        text: 'a hidden or absent subject (404)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-refusals.test.ts',
            title:
              'CMS-03C-06 SQL refusal transport (tokens of 20261013300820) answers a hidden and an absent subject identically (404 concealment)',
          },
        ],
      },
      {
        text: '`subject_not_submittable` or an idempotency conflict (409)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-refusals.test.ts',
            title:
              'CMS-03C-06 SQL refusal transport (tokens of 20261013300820) handles reason token subject_not_submittable by the CMS-03C-06 contract list',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-refusals.test.ts',
            title:
              'CMS-03C-06 SQL refusal transport (tokens of 20261013300820) maps the producer token IDEMPOTENCY_MISMATCH to 409',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit/020-idempotency.sqlinc',
            title:
              'a same-key request with a different body is refused IDEMPOTENCY_MISMATCH (not a bare CONFLICT) [P2-S12-AC-251]',
          },
        ],
      },
      {
        text: 'a non-JSON body (415)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-admission.test.ts',
            title:
              'CMS-03C-06 Worker admission (BE03c row 168, BE00 order) rejects unsupported request media before the session',
          },
        ],
      },
      {
        text: 'a subject hash or kind failure or, for a taxonomy version that declares an unbuilt canonical domain, `canonical_source_unavailable` with `details.domain` (422)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
            title:
              'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) refuses subjectHash=ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc with a 422 at /subjectHash before rate admission',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
            title:
              'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) refuses subjectKind=navigation_version with a 422 at /subjectKind before rate admission',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-refusals.test.ts',
            title:
              'CMS-03C-06 SQL refusal transport (tokens of 20261013300820) carries the canonical domain of canonical_source_unavailable (BE03c 1375, DEC-180 G11)',
          },
        ],
      },
      {
        text: 'the governed-review limit (429)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-production.test.ts',
            title:
              'CMS-03C-06 production transport boundary stops denied user quota before RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-production.test.ts',
            title:
              'CMS-03C-06 production transport boundary stops denied party quota before RPC',
          },
        ],
      },
      {
        text: 'a preflight or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-admission.test.ts',
            title:
              'CMS-03C-06 Worker admission (BE03c row 168, BE00 order) never promotes a provider HTTP 502 fault into a caller refusal',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-admission.test.ts',
            title:
              'CMS-03C-06 Worker admission (BE03c row 168, BE00 order) never promotes a provider HTTP 504 fault into a caller refusal',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
            title:
              'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) maps a port that throws to a scrubbed 503 and a malformed envelope to 502',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-production.test.ts',
            title:
              'CMS-03C-06 production transport boundary ends a stalled session at the 15 second route deadline',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-refresh.test.ts',
            title:
              'CMS-03C-06 authority refresh and local deadlines bounds a stalled RPC with the local deadline and never retries a mutation',
          },
        ],
      },
      {
        text: 'and an internal failure (500)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-refusals.test.ts',
            title:
              'CMS-03C-06 SQL refusal transport (tokens of 20261013300820) refuses the foreign editorial reason dependency_changed as a scrubbed 500',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-refusals.test.ts',
            title:
              'CMS-03C-06 SQL refusal transport (tokens of 20261013300820) scrubs the unrecognized or internal token "INTERNAL_ERROR"',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-provider-fault.test.ts',
            title:
              'CMS-03C-06 provider 4xx without a product token (BE03c 1298-1302) scrubs PGRST202 function not found (RPC missing or unexposed) to 500 INTERNAL_ERROR',
          },
        ],
      },
      {
        text: 'to typed ApiError of catalog `cms.03c.governed-review.v1`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/error-catalog.test.ts',
            title:
              'BE03c normative application error catalog [P2-S12-AC-008] maps every status to the exact catalog code and never uses a status as a code',
          },
        ],
      },
      {
        text: 'writes no review, dependency row or subject-state change on any refusal',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit/030-hash-refusal.sqlinc',
            title:
              'the hash refusal leaves subject, review, dependency and idempotency rows unchanged (audit/outbox count-only) [P2-S12-AC-249]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the capability refusal leaves the review, dependency, subject, audit and outbox stores identical [P2-S12-AC-262]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the duplicate refusal leaves the review, dependency, subject, audit and outbox stores identical [P2-S12-AC-251]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit/020-idempotency.sqlinc',
            title:
              'the mismatch refusal leaves the subject (state + lifecycle_version), review, dependency and idempotency rows unchanged (audit/outbox count-only) [P2-S12-AC-251]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'submit-gear: correctly refused call preserves every full snapshot row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the dependency refusal commits no review for the unresolvable subject [P2-S12-AC-064]',
          },
        ],
      },
      {
        text: 'and answers a NULL workflow-policy evidence as 503 `DEPENDENCY_UNAVAILABLE`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'a bound content type whose workflow policy does not resolve is refused 503 DEPENDENCY_UNAVAILABLE [P2-S12-AC-064]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-069',
    text: 'CMS-03C-06 is consumed by the protected `CmsGovernedReviewPanel` on the template, pattern and vocabulary pages, which shows the subject version\'s lifecycle as text and icon, builds `GovernedReviewSubmissionRequest` from the served version id and hash (never typed), offers _Submit for review_ only when the server permits it, states why a version cannot yet be activated ("Needs an independent reviewer\'s approval") and never shows an activate control without an `approved` review; verification covers each subject kind, `subject_not_submittable`, one live review per version, the 403/404 split and the focused result heading.',
    clauses: [
      {
        text: 'CMS-03C-06 is consumed by the protected `CmsGovernedReviewPanel` on the template, pattern',
        citations: [],
      },
      {
        text: 'vocabulary pages',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts',
            title:
              '[T2] the panel submit pressed three times before its chunk arrives sends one create, without If-Match',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: "which shows the subject version's lifecycle as text",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'CmsGovernedReviewPanel lifecycle (CMS-03C-06) states the review lifecycle in words and offers no submit action',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'CmsGovernedReviewPanel lifecycle (CMS-03C-06) states the active lifecycle in words and offers no submit action',
          },
        ],
      },
      {
        text: 'icon',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.icon.test.tsx',
            title:
              'CmsGovernedReviewPanel lifecycle icon (FE03 Slice 12 governed surfaces) shows exactly one decorative icon beside the lifecycle text for every subject state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.icon.test.tsx',
            title:
              'CmsGovernedReviewPanel lifecycle icon (FE03 Slice 12 governed surfaces) gives every state its own glyph, so the state is never carried by colour alone',
          },
        ],
      },
      {
        text: 'builds `GovernedReviewSubmissionRequest` from the served version id and hash (never typed)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'CmsGovernedReviewPanel lifecycle (CMS-03C-06) offers the submit action only for a draft and never asks the person to type anything',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'submit for review sends the subject id and hash exactly as served, with no If-Match, then re-reads the subject and names the result',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedTemplatePanel.test.tsx',
            title:
              'CmsGovernedTemplatePanel submits the template version it was served and re-reads the latest template afterwards',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedPatternPanel.test.tsx',
            title:
              'patternSubjectOf takes the subject id, hash, key, version and lifecycle exactly as the latest read served them',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedTaxonomyPanel.test.tsx',
            title:
              'taxonomySubjectOf takes the subject id, hash, key, version and lifecycle exactly as the versions read served them',
          },
        ],
      },
      {
        text: 'offers _Submit for review_ only when the server permits it',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'submit for review keeps the submit action off and says why when the subject could not be re-read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'submit for review refuses to send while the subject read behind it is not verified',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedPatternPanel.test.tsx',
            title:
              'CmsGovernedPatternPanel offers no submit control for a version that is not a draft',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/governed-lazy-forms.test.tsx',
            title:
              'the definition panel mounts its submit form only for a draft loads nothing for a review version',
          },
        ],
      },
      {
        text: 'states why a version cannot yet be activated ("Needs an independent reviewer\'s approval")',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'CmsGovernedReviewPanel lifecycle (CMS-03C-06) states the review lifecycle in words and offers no submit action',
          },
        ],
      },
      {
        text: 'and never shows an activate control without an `approved` review',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.activation.test.tsx',
            title:
              'CmsGovernedReviewDetailIsland activation (CMS-03C-09, DEC-190) offers Activate and Schedule for an approved version and Retire for an active one, from permittedNextActions only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx',
            title:
              'CmsGovernedActivationForm (CMS-03C-09) controls renders nothing while the server permits no activation action',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'CmsGovernedReviewPanel lifecycle (CMS-03C-06) states the review lifecycle in words and offers no submit action',
          },
        ],
      },
      {
        text: 'verification covers each subject kind',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedTemplatePanel.test.tsx',
            title:
              'CmsGovernedTemplatePanel submits the template version it was served and re-reads the latest template afterwards',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedPatternPanel.test.tsx',
            title:
              'CmsGovernedPatternPanel submits the pattern version it was served and re-reads the latest pattern afterwards',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedTaxonomyPanel.test.tsx',
            title:
              'CmsGovernedTaxonomyPanel submits the vocabulary version it was served and re-reads the versions afterwards',
          },
        ],
      },
      {
        text: '`subject_not_submittable`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'submit for review says a version that cannot be submitted is not a submittable draft and re-reads the subject',
          },
        ],
      },
      {
        text: 'one live review per version',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/load-governed-subject-review.test.ts',
            title:
              'loadGovernedSubjectReview (FE03 :877, :1066) finds the review of exactly this subject version in the owned queue and returns only its summary',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'the review summary (FE03 :877, :1066) does not carry the review of a version over to its successor draft',
          },
        ],
      },
      {
        text: 'the 403/404 split',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.not-found.test.tsx',
            title:
              'CmsGovernedReviewPanel: the 404 half of the 403/404 split shows the one non-disclosing not-available line for a hidden or absent subject, with no capability gate',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.not-found.test.tsx',
            title:
              'CmsGovernedReviewPanel: the 404 half of the 403/404 split keeps the two halves distinct: the 403 shows the capability gate and no not-available line',
          },
        ],
      },
      {
        text: 'the focused result heading.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'submit for review sends the subject id and hash exactly as served, with no If-Match, then re-reads the subject and names the result',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts',
            title:
              '[T2] the panel submit pressed three times before its chunk arrives sends one create, without If-Match',
            project: 'real-route-chrome',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clause): "CMS-03C-06 is consumed by the protected `CmsGovernedReviewPanel` on the template, pattern": missing test: behavioural page-mount test that CmsGovernedReviewPanel is hosted on the template and pattern pages (the three page-mount tests read the .astro sources as text and were refuted). Re-checked 2026-10-29: no gap-wave test carries it; only the real-route spec T2 drives the panel, on the vocabulary page.',
  },
  {
    criterion: 'P2-S12-AC-070',
    text: 'CMS-03C-07 registers POST /api/v1/cms/governed-reviews/{reviewId}/decision with the strict `GovernedDecisionRequest` (`reviewId`, `decision` `approve` or `reject`, `reason`, `expectedVersion`) and returns the strict `GovernedReviewResource` as 200 with the recorded decision counted; `capability` and `stepUpAt` are unknown keys (422); generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-07 registers POST /api/v1/cms/governed-reviews/{reviewId}/decision with the strict `GovernedDecisionRequest` (`reviewId`, `decision` `approve` or `reject`, `reason`, `expectedVersion`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-decision.test.ts',
            title:
              'CMS-03C-07 governed decision contract [P2-S12-AC-070] accepts approve and reject with the review id, reason and review version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota names /decision for an invalid member (a decision outside the closed set)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision.test.ts',
            title:
              'CMS-03C-07 decision contract (BE03c row 169, field matrix 390) calls cms_record_governed_decision with the CAS operand, key and server context only',
          },
        ],
      },
      {
        text: 'and returns the strict `GovernedReviewResource` as 200 with the recorded decision counted',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/030-happy.sqlinc',
            title:
              'the 200 body is exactly GovernedReviewResource (21 members) [P2-S12-AC-070]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/030-happy.sqlinc',
            title:
              'the last required approval moves the review to approved at version 2 with the decision counted and decidedAt set [P2-S12-AC-070]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision.test.ts',
            title:
              'CMS-03C-07 decision contract (BE03c row 169, field matrix 390) answers 200 with a strict review for approve leaving it approved',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision.test.ts',
            title:
              'CMS-03C-07 decision contract (BE03c row 169, field matrix 390) refuses a body that fails the strict resource schema',
          },
        ],
      },
      {
        text: '`capability` and `stepUpAt` are unknown keys (422)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-decision.test.ts',
            title:
              'CMS-03C-07 governed decision contract [P2-S12-AC-070] refuses capability and stepUpAt as unknown keys because both are server-derived',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses capability as an unknown key with 422',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses stepUpAt as an unknown key with 422',
          },
        ],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-070] CMS-03C-07 registers POST /api/v1/cms/governed-reviews/{reviewId}/decision with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-070] CMS-03C-07 generates the documented parameters, request body, success statuses and error matrix',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-070] documents the decision body as strict with no capability or stepUpAt member',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-07 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-07 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-071',
    text: 'CMS-03C-07 requires the path `reviewId` to equal the body `reviewId`, `decision` `approve` or `reject`, a `reason` of 1-2000 code points in NFC with no control, line or paragraph separator or bidirectional-formatting character and no `<>{}`, and an `expectedVersion` that is the review `version` with the strong `If-Match` equal to it exactly; a body `capability` or `stepUpAt` is refused as an unknown key.',
    clauses: [
      {
        text: 'CMS-03C-07 requires the path `reviewId` to equal the body `reviewId`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses a path and body reviewId that disagree with 422 at /reviewId',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-decision.test.ts',
            title:
              'CMS-03C-07 governed decision contract [P2-S12-AC-071] composes the review path, headers and body and reports each fault at the member that owns it',
          },
        ],
      },
      {
        text: '`decision` `approve` or `reject`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-decision.test.ts',
            title:
              'CMS-03C-07 governed decision contract [P2-S12-AC-071] refuses a decision outside approve and reject, a bad review id and a bad review version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota names /decision for an invalid member (a decision outside the closed set)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'a body capability or stepUpAt is an unknown key; a malformed review id, a missing key or If-Match disagreeing with expectedVersion is INVALID_REQUEST; a bad decision, version or an empty, over-long, non-NFC, control, markup or brace reason is VALIDATION_FAILED at its pointer [P2-S12-AC-071]',
          },
        ],
      },
      {
        text: 'a `reason` of 1-2000 code points in NFC with no control, line or paragraph separator or bidirectional-formatting character and no `<>{}`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-decision.test.ts',
            title:
              'CMS-03C-07 governed decision contract [P2-S12-AC-071] bounds the reason at 1 to 2000 code points counted by character, not UTF-16 unit',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-decision.test.ts',
            title:
              'CMS-03C-07 governed decision contract [P2-S12-AC-071] refuses a reason that is not NFC, carries a control, separator or bidirectional character, or has markup delimiters',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc',
            title:
              'a reason of exactly 2000 code points (3000 octets) is accepted and stored whole with the hash of its UTF-8 bytes [P2-S12-AC-071]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota names /reason for an invalid member (a reason with markup)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota names /reason for an invalid member (an empty reason)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'a body capability or stepUpAt is an unknown key; a malformed review id, a missing key or If-Match disagreeing with expectedVersion is INVALID_REQUEST; a bad decision, version or an empty, over-long, non-NFC, control, markup or brace reason is VALIDATION_FAILED at its pointer [P2-S12-AC-071]',
          },
        ],
      },
      {
        text: 'and an `expectedVersion` that is the review `version` with the strong `If-Match` equal to it exactly',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses a different operand than expectedVersion If-Match with 400 before capability and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses weak If-Match with 400 before capability and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota names /expectedVersion for an invalid member (an expectedVersion with a leading zero)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-decision.test.ts',
            title:
              'CMS-03C-07 governed decision contract [P2-S12-AC-073] requires JSON, a bounded idempotency key and a strong quoted If-Match',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'a body capability or stepUpAt is an unknown key; a malformed review id, a missing key or If-Match disagreeing with expectedVersion is INVALID_REQUEST; a bad decision, version or an empty, over-long, non-NFC, control, markup or brace reason is VALIDATION_FAILED at its pointer [P2-S12-AC-071]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/020-gates.sqlinc',
            title:
              'a stale review version is VERSION_MISMATCH naming the expected and the current version [P2-S12-AC-073]',
          },
        ],
      },
      {
        text: 'a body `capability` or `stepUpAt` is refused as an unknown key.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses capability as an unknown key with 422',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses stepUpAt as an unknown key with 422',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-decision.test.ts',
            title:
              'CMS-03C-07 governed decision contract [P2-S12-AC-070] refuses capability and stepUpAt as unknown keys because both are server-derived',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'a body capability or stepUpAt is an unknown key; a malformed review id, a missing key or If-Match disagreeing with expectedVersion is INVALID_REQUEST; a bad decision, version or an empty, over-long, non-NFC, control, markup or brace reason is VALIDATION_FAILED at its pointer [P2-S12-AC-071]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
];
