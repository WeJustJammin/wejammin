import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 12 evidence ledger, criteria AC001-AC071. Aggregated by
// tests/contracts/phase-02-slice-12-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-12-evidence-guard.test.ts.
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
              'CMS-03C-01 rejects a registered block absent from the active type renderer',
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
        ],
      },
      {
        text: 'and accessibility contracts in templates.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "accessibility contracts in templates". No test asserts that a template preserves or checks the accessibility contract of the blocks it places; the block digest pins the reachable block tuples, but nothing compares an accessibility contract. The audience constraint proven is the current rule (1-64 bytes, no <>{}); the locked E4 grammar ^[a-z0-9_-]{1,48}$ is not enforced (see P2-S12-AC-025).',
  },
  {
    criterion: 'P2-S12-AC-002',
    text: 'Reject cyclic or over-limit composition trees and retain immutable reusable-pattern versions.',
    clauses: [
      {
        text: 'Reject cyclic or over-limit composition trees',
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "Reject cyclic or over-limit composition trees". The composition and pattern tables carry guards, but no test inserts a cyclic parent chain, an over-deep tree, a tree over 512 nodes or an over-sized block_tree and sees a refusal; the only tree assertion is an acyclic two-node control (composition_instance_guards) and a block-key grammar check. Cycle through a nested pattern lineage (409 pattern_cycle) and the node/depth bounds are specified in BE03c but no code enforces them (CMS-03C-02 RPC and CMS-03C-12 are not built).',
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
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "assignments convergent". No test shows that concurrent or repeated term assignments to one revision/field converge (idempotent assignment, deterministic order, no duplicate positions); the assignment assertions only bind owner, vocabulary, revision and field and forbid delete. The cited proof is table-level guards exercised by direct inserts and updates under app.cms_rpc; the curator command that drives them (CMS-03C-03 cms_act_taxonomy_term) does not exist, so the invariants are not shown through a served action.',
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
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "complete the declared happy path". Each layer is proven separately: the Worker route returns the 201 resource from a stubbed port (template-routes.test.ts), the production adapter posts the named RPC against a mocked fetch, the RPC creates the draft in pgTAP (phase_02_slice_12_template_authority.sql) and the browser flow runs against an in-memory fixture (tests/e2e/support/cms-template-fixture.ts says it does not claim Supabase RPC, RLS or hosted acceptance). No test drives POST /api/v1/cms/templates/versions through the production Worker and PostgREST into the database and checks the 201 body, ETag and committed rows together.',
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
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "every invalid request value". Two locked value rules are not enforced anywhere: the reserved template keys context, versions and new (E13, 422 key_reserved at /templateKey) and the audience grammar ^[a-z0-9_-]{1,48}$ matched as submitted (E4); the contract and the SQL check still accept any audience of 1-64 bytes without <>{} and reject only the Slice 09 reserved-concept list. The database refuses a bad value with a bare VALIDATION_FAILED token; the field pointer and code are produced by the Zod schema in the Worker, so a value that passes Zod but fails the SQL manifest check has no pinned pointer.',
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "404 boundary". POST /api/v1/cms/templates/versions with a hidden or foreign-owner parent template (If-Match naming a version the caller cannot see) answering the concealed 404 is not asserted anywhere: the Worker route test only normalizes a stubbed 404 port failure, and the pgTAP files test the concealed 404 for the latest-definition read (template_detail.sql) but not for the write. Ownership across two owners is also not exercised for the write: no fixture has a second owner holding a template of the same key. The 401/403/RLS evidence is Worker route (stubbed session) plus RPC-level pgTAP; no composed Worker to PostgREST test.',
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
              'CMS-03C-01 waits for the same-key transaction lock before first-create read',
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
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "timeout". The locked BE03c catalog maps 502, 503 and 504 all to DEPENDENCY_UNAVAILABLE (reconciled 2026-10-02, DEC-172, DEC-179), but the Worker still emits DEPENDENCY_INVALID_RESPONSE for 502 and DEPENDENCY_DEADLINE_EXCEEDED for 504 (apps/worker/src/cms-composition/template-shared.ts ERROR_CODES); every deadline test (the 504 port normalization, the stalled-RPC-body case) asserts the old name, so no test proves the catalogued timeout mapping. The "dependency" clause cites only the 503 DEPENDENCY_UNAVAILABLE cases for the same reason; the 502 response-contract cases assert the non-catalog name and are not cited. The web relay and the browser submit mapper accept the same non-catalog names (cms-template-designer-submit.ts, cms-composition-platform-mutation.ts).',
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
        citations: [],
      },
      {
        text: 'and complete the declared happy path',
        citations: [],
      },
      {
        text: 'CMS-03C-02 — CMS-12 — POST /api/v1/cms/compositions/pattern-instances — PatternInstanceRequest → 201 PatternPlacementResource.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "success contracts", "complete the declared happy path" and the registry row "→ 201 PatternPlacementResource". No PatternPlacementResource exists anywhere in the code: the registry row, the Worker route and the web proxy still return the single-row CompositionInstanceResource (packages/contracts/src/cms-composition/pattern-instance.ts, platform-registries.ts successSchema CompositionInstanceResourceSchema), not the DEC-175/DEC-181 items list of 1..512 rows per block root. The private RPC cms_insert_pattern_instance is not deployed: the production adapter answers 503 for a missing function (cms-composition-production-pattern.ts), so no request can complete. There is no phase-02-slice-12 pattern OpenAPI test (template, taxonomy, locale and related-content each have one).',
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
        citations: [],
      },
      {
        text: 'with the exact stable field violation',
        citations: [],
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
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "every invalid request value" and "the exact stable field violation". The contract tests assert only that bad values fail to parse (safeParse().success false) and the route test asserts only the HTTP status, so no test pins a violation pointer or code for the pattern request. The semantic value rules are not implemented because the RPC is absent: current draft revision (409 revision_not_editable), an active compatible PatternVersion (422 pattern_version_not_active or pattern_incompatible), node-path override keys (DEC-175), graph, depth and node limits. "No state mutation" is shown only as the port not being called; no database state is observed.',
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
        citations: [],
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "scope" and the "404 boundary". The locked scope (DEC-176) is an assigned author or editor on the entry current draft revision, with a hidden target 404 and a visible target without edit 403; no RPC decides this (cms_insert_pattern_instance is not deployed) and no test asserts it. Ownership and RLS are proven only as table-level constraints and policies driven by direct inserts under app.cms_rpc; the Worker tests stub the session and the port.',
  },
  {
    criterion: 'P2-S12-AC-013',
    text: 'CMS-03C-02: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03C-02: enforce declared idempotency',
        citations: [],
      },
      {
        text: 'If-Match or CAS',
        citations: [],
      },
      {
        text: 'duplicate, replay',
        citations: [],
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
      'Unproven: "enforce declared idempotency", "If-Match or CAS", "duplicate, replay" and "concurrency rules". These are database behaviors of cms_insert_pattern_instance (revision CAS, unique revision and path per row, all-or-nothing placement, exact-repeat replay, a changed body under the same key answering 409), and the RPC does not exist. The Worker validates the header shapes and forwards the precondition to a stubbed port; that is not enforcement. Rate, deadline, no-store and query refusal are proven at the Worker boundary only (120/min/user, 240/min/party asserted against a stubbed limiter).',
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
            file: 'apps/worker/src/cms-composition-production-pattern.test.ts',
            title:
              'CMS-03C-02 production pattern adapter treats a missing private RPC as unavailable rather than a hidden composition',
          },
        ],
      },
      {
        text: 'timeout',
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "timeout". The locked catalog maps 502, 503 and 504 to DEPENDENCY_UNAVAILABLE; the pattern route still emits DEPENDENCY_INVALID_RESPONSE (502) and DEPENDENCY_DEADLINE_EXCEEDED (504) (apps/worker/src/cms-composition/pattern-instance-contracts.ts ERROR_CODES), and the deadline tests assert the old 504 name. The "dependency" clause cites only the 503 case. The domain failures (409 cycle, slot or CAS conflict, 422 graph) cannot originate: the private RPC is not deployed, so the mapping is exercised only with stubbed provider failures.',
  },
  {
    criterion: 'P2-S12-AC-015',
    text: 'CMS-03C-02: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03C-02: commit audit and outbox effects atomically where applicable',
        citations: [],
      },
      {
        text: 'reconcile lost responses without duplicate effects',
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "commit audit and outbox effects atomically where applicable" and "reconcile lost responses without duplicate effects". No pattern-placement RPC exists, so no audit row, outbox row or idempotent replay is produced or tested for CMS-03C-02; composition_authority.sql and composition_instance_guards.sql prove table guards only.',
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
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "complete the declared happy path". The production port always answers 503 DEPENDENCY_UNAVAILABLE after admission (apps/worker/src/cms-composition-production-taxonomy.ts actTerm returns unavailable; the test asserts that refusal and that fetch is never called): the cms_act_taxonomy_term RPC, the canonical-taxonomy overlap provider (CMS-03C-18) and the atomic curator authority are not built. The 200 TaxonomyTermResource is returned only from a stubbed port in the route test. The web page route for POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions does not exist under apps/web/src/pages/api/v1/cms/ (only the Worker route is mounted).',
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
        citations: [],
      },
      {
        text: 'with the exact stable field violation',
        citations: [],
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
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "every invalid request value" and "the exact stable field violation". Only the unknown-field violation is pinned (path /injectedOwner, code unknown_field); the contract tests assert parse failure as a boolean. The semantic rules are not implemented: the vocabulary must have an active TaxonomyVersion (409 taxonomy_not_active), a parentId other than null requires shape hierarchical, a survivor cannot be self, cyclic or merged (the database guards exist at table level, but no action RPC maps them to a 422/409 with a pointer). "No state mutation" is shown only as the port not being called.',
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
        citations: [],
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "scope" and the "404 boundary". The capability is checked in the Worker from the session (cms.taxonomy_curator) with a stubbed resolver; the locked rule is a curator capability for that specific vocabulary in the owner party, hidden vocabulary or term 404, known vocabulary without capability 403, decided by the database. The cms_act_taxonomy_term RPC is absent, so no database decision exists and the production port refuses every request with 503. Ownership and RLS are table-level checks only.',
  },
  {
    criterion: 'P2-S12-AC-019',
    text: 'CMS-03C-03: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03C-03: enforce declared idempotency',
        citations: [],
      },
      {
        text: 'If-Match or CAS',
        citations: [],
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
        ],
      },
      {
        text: 'replay',
        citations: [],
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
      'Unproven: "enforce declared idempotency", "If-Match or CAS", "replay" and "concurrency rules". They are behaviors of the absent cms_act_taxonomy_term RPC (term lock, CAS on the active taxonomy version, unique survivor and redirect, exact-repeat replay, same key with another body answering 409). The Worker checks that If-Match is strong and equals expectedVersion and forwards it to a stubbed port; the term-version columns exist, but no test shows a stale version refused. "duplicate" is shown only as a table-level unique stable term key. Rate, deadline, no-store and query refusal are Worker-boundary tests against stubbed dependencies.',
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
              'CMS-03C-03 production taxonomy boundary admits a valid curator but refuses mutation while canonical source and RPC are absent',
          },
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
        citations: [],
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "timeout" and "preserve safe recovery". The taxonomy route emits DEPENDENCY_INVALID_RESPONSE (502) and DEPENDENCY_DEADLINE_EXCEEDED (504) (apps/worker/src/cms-composition/taxonomy-contracts.ts ERROR_CODES) where the locked catalog requires DEPENDENCY_UNAVAILABLE, and the 15-second deadline test asserts the old 504 name. The declared domain failures (term, merge, CAS, idempotency conflicts, canonical_source_unavailable) have no producer: the RPC is absent and the production port is a fail-closed 503, so the domain-failure mapping runs only on stubbed provider errors.',
  },
  {
    criterion: 'P2-S12-AC-021',
    text: 'CMS-03C-03: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03C-03: commit audit and outbox effects atomically where applicable',
        citations: [],
      },
      {
        text: 'reconcile lost responses without duplicate effects',
        citations: [],
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
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "commit audit and outbox effects atomically" (the cms.taxonomy.changed.v1 event and an audit record) and "reconcile lost responses without duplicate effects". No taxonomy action RPC exists, so nothing writes an audit or outbox row for a term action and nothing replays by idempotency key. The redacted-telemetry clause is shown only by a Worker test that a failing telemetry sink does not change the response; the production taxonomy binding is a fail-closed stub with no telemetry assertion.',
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
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "not a reserved key (`context`, `versions`, `new`)" (E13, 422 key_reserved at /templateKey). No contract schema, SQL CHECK or test refuses those three keys: CmsTemplateKeySchema (packages/contracts/src/cms-composition/template.ts) is the bare regex, and the SQL manifest check calls platform_private.cms_reserved_key, which lists the Slice 09 reserved concepts (user, party, profile, ...), not context, versions or new. Also not implemented: per-owner uniqueness (E14): cms_template_versions still has the global UNIQUE (template_key, version) (20260927200000_cms_template_authority.sql line 178) and carries no lineage templateId, so the cited "never reused" proof is the stricter global rule; a key held by another owner still collides.',
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
        text: 'each active/allowlisted ContentTypeVersion family',
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "each active/allowlisted ContentTypeVersion family". The only refusal test uses an identifier that does not exist (phase_02_slice_12_template_authority.sql "refuses nonexistent or inactive compatible types" sends a random UUID); no case supplies a content type that exists but is not active, whose active version is not active, or that belongs to another owner, although cms_define_template checks all three (supabase/migrations/20260927200000_cms_template_authority.sql lines 425-437). The allowlist half of the clause has no separate rule or test.',
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
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: the audience grammar `^[a-z0-9_-]{1,48}$` matched as submitted and never trimmed (E4, the BE04c grammar). SafeAudienceSchema (packages/contracts/src/cms-composition/template.ts) accepts any string of 1-64 characters without <, >, { or }, and the SQL manifest check accepts 1-64 octets with the same exclusion (20261002210000_cms_reserved_concept_block_template_keys.sql); the only audience assertion rejects the string <script>. Upper-case, spaces, padding and 49-64 character audiences are accepted today and no test says otherwise.',
  },
  {
    criterion: 'P2-S12-AC-026',
    text: "Enforce CMS-03C-02: revisionId/patternId; UUIDs; `revisionId` is the entry's current draft revision (effective state `draft`, else 409 `revision_not_editable`) readable by the caller; `patternId` a lineage id of the caller's owner scope; 400/404.",
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
        citations: [],
      },
      {
        text: "`patternId` a lineage id of the caller's owner scope",
        citations: [],
      },
      {
        text: '400/404.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: the current-draft-revision rule (409 revision_not_editable), the readable-by-caller rule, the pattern lineage id and the 400/404 mapping. Only the UUID grammar is tested (contract booleans). The nearest database evidence is table-level: composition_instance_guards.sql refuses a submitted revision as a composition target and composition_owner_integrity.sql refuses a cross-owner revision or pattern, but neither is the editable-state or lineage rule, and no route decision exists because cms_insert_pattern_instance is not deployed. cms_pattern_versions has no pattern_id lineage column (patternId is a version-row id).',
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
        citations: [],
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "naming an active PatternVersion of that lineage whose compatibleTypeIds lists the revision content type" with the typed 422 pattern_version_not_active or pattern_incompatible, and the 422 status itself. cms_pattern_versions has no compatible_type_ids column, no activation path (CMS-03C-09) and no pattern create (CMS-03C-12), so an active, compatible pattern version cannot exist; the Worker never produces these reason codes. Only the positive-integer version and the closed linked/detached mode are tested, as parse booleans.',
  },
  {
    criterion: 'P2-S12-AC-028',
    text: 'Enforce CMS-03C-02: slotPath/overrides; normalized path 1–512 chars; strict overrides max 64 keys/8 depth; 422.',
    clauses: [
      {
        text: 'Enforce CMS-03C-02: slotPath/overrides; normalized',
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "normalized" slotPath and the node-path form of override keys. The contract only requires a leading slash, 1-512 characters and no control character (hasSafeSlotPath); it does not normalize or reject empty segments, dot segments or a trailing slash, and the DEC-175 rule that override keys are normalized node paths under the inserted root, each naming a node of the pinned pattern tree, is not enforced (no pattern tree is read). The 422 evidence is limited to the unknown-field case in the route test.',
  },
  {
    criterion: 'P2-S12-AC-029',
    text: 'Enforce CMS-03C-02: graph; no cycles; max protected depth/nodes; all blocks registered and compatible; 409/422.',
    clauses: [
      {
        text: 'Enforce CMS-03C-02: graph; no cycles; max protected depth/nodes; all blocks registered and compatible; 409/422.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'The graph rules (no cycle through a nested lineage, depth at most 8, at most 512 nodes after expansion, every nested block registered and compatible, 409 pattern_cycle or 422) are not implemented: cms_insert_pattern_instance and CMS-03C-12 do not exist, the TypeScript block-registry digest helper (apps/worker/src/cms-composition/block-registry-digest.ts) is imported by no route, and the only related code is the canonical block-key grammar check cms_pattern_tree_keys_valid and a pgTAP acyclic two-node control insert (composition_instance_guards.sql) that never expects a refusal.',
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
        citations: [],
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
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: the vocabulary lineage id, the active-TaxonomyVersion rule (409 taxonomy_not_active) and "parentId other than null requires shape hierarchical". The act-term RPC does not exist, so nothing reads the vocabulary state or its shape; cms_taxonomy_versions stores shape and state but no test or code path refuses a parent under a flat vocabulary. The UUID and the five closed actions are proven as contract and Worker-boundary rejections only.',
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: the "422/409" mapping. The self, cyclic and merged-survivor refusals are database trigger guards (P0001 CONFLICT) exercised by direct statements under app.cms_rpc; no action RPC maps them to a 422 with a pointer or a 409, and the production taxonomy port is a fail-closed 503. "required for merge/specified hierarchy" is proven for the merge survivor only (merge without survivorId and survivorId on a non-merge action are rejected); no rule makes parentId required for a specified hierarchy.',
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
        text: 'source revision must exist and be readable',
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "source revision must exist and be readable". The RPC tests cover a concealed foreign entry (404) and a source hash that is false or stale, but no case names a sourceRevisionId that is absent, belongs to another entry or is not readable by the caller and expects NOT_FOUND / LOCALE_SOURCE_NOT_FOUND. The 404 evidence for an unknown locale is likewise absent.',
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
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
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
        citations: [],
      },
      {
        text: 'every pin is an eligible target and every exclusion an existing readable entry',
        citations: [],
      },
      {
        text: 'and an ineligible, hidden or absent target is the one uniform 422 `related_target_ineligible`',
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "exclusions win", "every pin is an eligible target and every exclusion an existing readable entry" and the uniform 422 related_target_ineligible. The contract refuses a pin that is also an exclusion rather than resolving the overlap (pin_exclusion_overlap), and nothing evaluates target eligibility: the production port is a fail-closed 503 (actRelatedContent returns unavailable; the rule authority RPC cms_curate_related_content and the eligible-target projection CMS-03C-21 are not built). The related_target_ineligible reason code appears nowhere in code.',
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
        citations: [],
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
        ],
      },
      {
        text: '(an unknown key or version is 422 `derived_rule_unknown`)',
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: the code-owned rule registry (shared-terms, same-type-recent), the registered version, the reasonCode equality expectation and the 422 derived_rule_unknown. The contract only checks the key against the grammar ^[a-z][a-z0-9_-]{1,63}$, the version as a positive decimal and the reasonCode against a free-form grammar, so any well-formed key is accepted; no registry exists in code and derived_rule_unknown appears nowhere. The no-arbitrary-expression rule is proven by the strict object (an unknown member such as privateQuery is rejected).',
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
        citations: [],
      },
      {
        text: 'The related-content public-target projection CMS-03C-21 (BE03c ledger 25.05.04) is owned here with the CMS-03C-05 command.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: the 409 stale-source-version refusal and the CMS-03C-21 public-target projection. There is no related-content RPC, so a stale entry version is never compared (the Worker only maps a stubbed 409), and platform_private.cms_related_content_public_targets (CMS-03C-21) does not exist in any migration; locale_related_authority.sql proves only that rule rows are append-only and bind a real source entry.',
  },
  {
    criterion: 'P2-S12-AC-039',
    text: 'Enforce All: headers/body; JSON, raw body ≤256 KiB, Idempotency-Key 8–128 printable ASCII, unknown keys reject; 400/415/422.',
    clauses: [
      {
        text: 'Enforce All',
        citations: [],
      },
      {
        text: 'headers/body; JSON',
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
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'BE00 step 2 body ceiling on the CMS locale route refuses a streamed body over the ceiling that declared no length',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-admission.test.ts',
            title:
              'BE00 steps 2 and 8 on the CMS related-content route refuses a streamed body over the ceiling that declared no length',
          },
        ],
      },
      {
        text: 'Idempotency-Key 8–128 printable ASCII',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts requires JSON and a bounded idempotency key, with only an exact strong If-Match for updates',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term.test.ts',
            title:
              'CMS-03C-03 taxonomy-term wire contract requires JSON, idempotency, and strong version binding',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-variant.test.ts',
            title:
              'CMS-03C-04 locale-variant wire contract requires idempotent JSON and a strong source-version validator',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-content.test.ts',
            title:
              'CMS-03C-05 related-content wire contract requires idempotent JSON and a strong source-entry validator',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-instance.test.ts',
            title:
              'CMS-03C-02 pattern-instance wire contract requires canonical JSON, idempotency, and a strong successor validator',
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
    status: 'partial',
    limitation:
      'Unproven: "Enforce All". The shared transport rules (JSON only, 256 KiB body, Idempotency-Key 8-128 printable ASCII, unknown keys refused, 400/415/422) are proven for the five served operations CMS-03C-01 to CMS-03C-05 only. CMS-03C-06 to CMS-03C-17 and the supporting reads (governed reviews, pattern create, selector, update diff, pattern update, taxonomy version create and selector, pattern and taxonomy reads) have no route, so no admission test exists for them. The body ceiling tests send 300,000 bytes; none exercises the exact 262,144-byte boundary, and the Idempotency-Key length and printable-ASCII bounds are asserted through the schema, not at each route.',
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
              'CMS-03C-01 rejects a registered block absent from the active type renderer',
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
      'Unproven: "implement locked behavior and completion exactly. Operations: CMS-03C-06 ... CMS-03C-11 and CMS-03C-19". None of the seven governed operations exists: no route, RPC, table (cms_governed_reviews and its decision, assignment, dependency and schedule tables), contract schema or test. Template activation, retirement, scheduled activation and the review queue are therefore not built; the cited proof covers only the given-conditions of the criterion through CMS-03C-01 (designer capability, supported blocks, declared types, locale, audience and the fixed protected regions).',
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "cascade". No test shows what happens to templates, bindings or content-type versions when a template is withdrawn, retired or superseded (the activation, retirement and supersession paths are CMS-03C-09, which does not exist), and no test shows the effect of a revoked designer grant on an already-saved draft. "Revocation" is proven for the two reads and for a member without the grant, not for a grant revoked between an unsent form and its submit on the write.',
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
        citations: [],
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
        citations: [],
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
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "focus stays until navigation or named result heading", "Render authoritative response/version/provenance/next action" and "scoped draft before commit". The e2e specs assert focus on the alert summary after a refusal, but none asserts focus staying on the control until navigation or moving to a named result heading after success; the success status shows the template id, version and a link to the latest draft, with no provenance (parent version or supersession) rendered or asserted; no test shows an unsent draft kept in a scoped store before commit. The cited browser specs run against test-owned in-memory persistence (tests/e2e/support/cms-template-fixture.ts), not the Supabase RPC.',
  },
  {
    criterion: 'P2-S12-AC-043',
    text: 'CMS-12 Use reusable pattern: given Actor may edit the target entry revision, the referenced pattern version is immutable and readable, and the resulting block tree stays acyclic within the protected depth and count limits., implement locked behavior and completion exactly. Operations: CMS-03C-12 (pattern version create), CMS-03C-13 (pattern selector), CMS-03C-14 (update diff) and CMS-03C-15 (pattern update), BE03c ledger 25.03.03.',
    clauses: [
      {
        text: 'CMS-12 Use reusable pattern: given Actor may edit the target entry revision',
        citations: [],
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
        citations: [],
      },
      {
        text: 'and the resulting block tree stays acyclic within the protected depth and count limits.',
        citations: [],
      },
      {
        text: 'implement locked behavior and completion exactly. Operations: CMS-03C-12 (pattern version create), CMS-03C-13 (pattern selector), CMS-03C-14 (update diff) and CMS-03C-15 (pattern update), BE03c ledger 25.03.03.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: the edit authority on the target revision, a readable pattern version, the acyclic bounded resulting tree, and "implement locked behavior and completion exactly. Operations: CMS-03C-12 ... CMS-03C-15". None of the four operations exists: no pattern-version create, selector read, update diff or pattern update (no route, RPC, contract schema, CmsPatternSelector or diff UI), and the insert path CMS-03C-02 has no deployed RPC. Immutability of a stored pattern version is proven only as table guards (an update is refused); there is no activation path that would make a pattern version "active".',
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
    limitation:
      'No CMS-12 flow is built (pattern create, selector, update diff and linked update are absent and CMS-03C-02 has no deployed RPC), so no failure or recovery path across invalid authority, concurrency, revocation, deletion or cascade can be exercised. The only related assertions are table guards (pattern and composition rows refuse in-place mutation and direct writes), which are not the declared failure and recovery behavior.',
  },
  {
    criterion: 'P2-S12-AC-045',
    text: '`CMS-12` Use reusable pattern: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-12` Use reusable pattern: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No CMS-12 browser surface exists: there is no pattern selector, placement form, update-diff view or pattern page under apps/web/src (the only CMS-03C-02 browser-adjacent code is the same-origin proxy and its page route). With no component there is nothing to render, announce, focus or reconcile, so none of the listed interaction clauses has a test.',
  },
  {
    criterion: 'P2-S12-AC-046',
    text: 'CMS-14 Govern taxonomy term: given Actor holds the taxonomy curator capability for that specific editorial vocabulary, the term key is stable and the proposed hierarchy stays acyclic, canonical-taxonomy overlap has been checked, and a merge names a survivor whose counterpart is not already merged., implement locked behavior and completion exactly. Operations: CMS-03C-16 (taxonomy version create), CMS-03C-17 (taxonomy selector) and CMS-03C-18 (canonical-taxonomy overlap provider), BE03c ledger 25.05.01.',
    clauses: [
      {
        text: 'CMS-14 Govern taxonomy term: given Actor holds the taxonomy curator capability for that specific editorial vocabulary',
        citations: [],
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
        citations: [],
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
      'Unproven: the curator capability for that specific vocabulary, the canonical-taxonomy overlap check and "implement locked behavior and completion exactly. Operations: CMS-03C-16, CMS-03C-17 and CMS-03C-18". Taxonomy version create, the selector and the canonical-overlap provider (platform_private.cms_canonical_taxonomy_match) do not exist, and the term-action RPC is absent (the production port answers 503). The cited proof is the table-level guards (stable key, acyclic hierarchy, merge survivor) exercised by direct statements under app.cms_rpc.',
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
    limitation:
      'No CMS-14 flow runs end to end: the term action RPC, taxonomy version create, selector and canonical overlap provider are absent and the production port refuses every request with 503. The table guards (merged term cannot reactivate, no delete of assignment versions) are not the declared failure and recovery behavior across authority, concurrency, revocation and cascade.',
  },
  {
    criterion: 'P2-S12-AC-048',
    text: '`CMS-14` Govern taxonomy term: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-14` Govern taxonomy term: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No CMS-14 browser surface exists: there is no vocabulary page, term form, taxonomy selector or curator UI under apps/web/src, and no web page route proxies POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions. None of the listed interaction clauses can be tested.',
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
      'A process criterion that no test can attest until the slice closes. Slice 12 is 0/285 and its governed-review, pattern, taxonomy-action and related-content operations are unimplemented, so the Contract, RED, GREEN and refactor sequence has not been executed for most of the scope. Closure needs a closeout test of the kind Slice 11 added (phase-02-slice-11-closeout.test.ts) plus a canonical pnpm validate at the closing commit; neither exists for Slice 12.',
  },
  {
    criterion: 'P2-S12-AC-050',
    text: 'Update slice tracking, feature-ledger assignments, applicable runbooks, and architecture graph in the same change; leave no unresolved implementation boundary or undocumented drift.',
    clauses: [
      {
        text: 'Update slice tracking, feature-ledger assignments, applicable runbooks, and architecture graph in the same change; leave no unresolved implementation boundary or undocumented drift.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'A closeout criterion with no Slice 12 test: no closeout test checks the tracker gate lines, feature-ledger assignments (25.03.02, 25.03.03, 25.05.01 to 25.05.04), runbooks or the architecture graph, and "no unresolved implementation boundary" is not met: the pattern placement RPC, taxonomy term action, related-content rule authority and canonical overlap provider are fail-closed 503 stubs with no BOUNDARY marker, tracking issue or sentinel test (the boundary-not-placeholder rule).',
  },
  {
    criterion: 'P2-S12-AC-051',
    text: 'Resolve a `no_fallback` field only from its own target-locale variant: it is never resolved through `fallbackChains` to `defaultLocale` or any other locale, and a missing target-locale value for a `no_fallback` field blocks publication of that locale and increments `cms_no_fallback_block_total` (DEC-121; received from Slice 09 AC005 and AC1166 under DEC-122, which own only the declaration and storage); resolved by CMS-03C-20 (shared locale field resolution and locale preflight provider, BE03c ledger 25.05.03).',
    clauses: [
      {
        text: 'Resolve a `no_fallback` field only from its own target-locale variant: it is never resolved through `fallbackChains` to `defaultLocale` or any other locale, and a missing target-locale value for a `no_fallback` field blocks publication of that locale and increments `cms_no_fallback_block_total` (DEC-121; received from Slice 09 AC005 and AC1166 under DEC-122, which own only the declaration and storage); resolved by CMS-03C-20 (shared locale field resolution and locale preflight provider, BE03c ledger 25.05.03).',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: CMS-03C-20 (platform_private.cms_resolve_locale_field and the cms.locale.no_fallback_gate preflight provider), the cms_no_fallback_block_total metric and the publication block for a missing no_fallback value appear nowhere in code or migrations (grep for cms_resolve_locale_field, cms_no_fallback_block_total and the gate id returns only tracker and ledger text). Slice 09 proves only declaration and storage (per-variant no_fallback set, refusal on a nonlocalizable field), which this criterion explicitly excludes.',
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
    limitation:
      'Not built. The only related behavior is the stale transition itself: a changed source revision appends a stale locale-variant version and emits an identifier-only event (supabase/tests/phase_02_slice_12_locale_source_stale.sql, locale_stale_backfill.sql). Nothing serves the last approved translation (no resolver CMS-03C-20), nothing exposes the stale state to an editorial read (the LocaleVariantResource has no staleFieldIds), the cms_locale_stale_total metric does not exist, and no preflight blocks publication for a missing no_fallback value.',
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
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
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
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "as 201 (... staleFieldIds, which is empty unless state is stale)". LocaleVariantResourceSchema has no staleFieldIds member and the RPC response carries none (supabase/migrations/20261002167000_cms_locale_author_active_configuration.sql builds the resource without it); the variant state returned is always draft, so untranslated, review, approved and stale are never produced by this command. The 201 body is shown through a stubbed port (Worker route test) and through partial field assertions on the RPC response (pgTAP); no test drives the production Worker through PostgREST to the database and validates the real body against the strict schema.',
  },
  {
    criterion: 'P2-S12-AC-055',
    text: "CMS-03C-04 derives session and acting context server-side and serves only an assigned CMS author or editor who may edit the entry for the localizable fields of the requested locale, on a source revision the caller can read: a hidden or absent entry, locale or source revision is 404 `LOCALE_SOURCE_NOT_FOUND`, a visible entry without edit assignment is 403 `LOCALE_FORBIDDEN`, no ownership, party or person identifier is serialized, and the operation never borrows another jurisdiction's text.",
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
        citations: [],
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
        ],
      },
      {
        text: 'locale or source revision is 404 `LOCALE_SOURCE_NOT_FOUND`',
        citations: [],
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "on a source revision the caller can read", a hidden or absent locale or source revision answering 404 LOCALE_SOURCE_NOT_FOUND, and "never borrows another jurisdiction text". No RPC case names an absent, foreign or unreadable sourceRevisionId or an unsupported locale on the path and expects the concealed 404 (the concealment test is for another tenant entry); nothing asserts that a missing value is not filled from a different locale variant (the nearest assertion is that a variant cannot target its own source locale). The server-derived context is proven against a mocked fetch (adapter tests) and an RPC called with hand-built context (pgTAP), not composed.',
  },
  {
    criterion: 'P2-S12-AC-056',
    text: 'CMS-03C-04 requires an `Idempotency-Key` and the strong `If-Match` equal to the entry aggregate `version` (`expectedVersion`), applies CAS on the source revision and the entry, enforces a unique entry, locale and source revision, rate buckets of 60/min/user and 120/min/party, a 15,000 ms deadline, no-store and the Tier 2 p95 < 1,200 ms and RPC < 300 ms targets, replays an exact repeat of the same command, and answers a changed actor, body, path or version under the same key with 409.',
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
        citations: [],
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
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
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
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
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
        text: 'the Tier 2 p95 < 1,200 ms and RPC < 300 ms targets',
        citations: [],
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
        text: 'answers a changed actor, body, path or version under the same key with 409.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "enforces a unique entry, locale and source revision" (a second variant for the same entry, locale and source revision answering 409 LOCALE_VERSION_CONFLICT as a duplicate is not asserted; the catalog index test proves a unique version identity only), the Tier 2 p95 < 1,200 ms and RPC < 300 ms targets (no performance test exists for the locale write), and "a changed actor, body, path or version under the same key with 409" (the template RPC has an IDEMPOTENCY_MISMATCH case, the locale RPC pgTAP has none; cms-idempotency-mismatch.apispec.ts covers CMS-03A-10 only). The rate-bucket and deadline clauses are proven against stubbed limiter and port dependencies.',
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
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
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
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route checks both rate buckets, validates decisions, and returns Retry-After',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
            title:
              'CMS-03C-04 locale authoring route publishes the BE00 429 contract with second-granularity reset and matching headers',
          },
        ],
      },
      {
        text: 'a schema or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`)',
        citations: [],
      },
      {
        text: 'and an internal failure (500)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
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
            file: 'apps/worker/src/cms-composition/locale-routes.test.ts',
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
    status: 'partial',
    limitation:
      'Unproven: "a schema or RPC deadline (502/503/504 DEPENDENCY_UNAVAILABLE)". The locked catalog maps all three to DEPENDENCY_UNAVAILABLE, but the locale route emits DEPENDENCY_INVALID_RESPONSE for 502 and DEPENDENCY_DEADLINE_EXCEEDED for 504 (apps/worker/src/cms-composition/locale-routes-support.ts ERROR_CODES) and the 502 and deadline tests assert the old names; the browser proxy and the web accept the same names. The 404 and 409 mappings are shown from tokens a stub or a hand-built RPC call produces; an absent source revision and a duplicate locale are never produced by the database in a test.',
  },
  {
    criterion: 'P2-S12-AC-058',
    text: "CMS-03C-04 is consumed by the protected `CmsLocaleVariantForm` at `/app/cms-content-modeling/entries/:entryId/locales/:locale`, which offers only localizable fields, shows the fallback order read-only from the protected version detail and submits it unchanged as the equality expectation, shows per-field resolution (own value, fallback source locale, `no_fallback` missing or stale) and the derived variant state, marks `staleFieldIds`, never displays another locale's text for a `no_fallback` field, offers explicit revalidation, and renders fixed copy then refetches on 409 `FALLBACK_CHAIN_MISMATCH` and `locale_limit_reached`; verification covers per-field resolution and the `no_fallback` rule, the derived variant states, both fixed 409 messages, the 403/404 split and the focused result heading.",
    clauses: [
      {
        text: "CMS-03C-04 is consumed by the protected `CmsLocaleVariantForm` at `/app/cms-content-modeling/entries/:entryId/locales/:locale`, which offers only localizable fields, shows the fallback order read-only from the protected version detail and submits it unchanged as the equality expectation, shows per-field resolution (own value, fallback source locale, `no_fallback` missing or stale) and the derived variant state, marks `staleFieldIds`, never displays another locale's text for a `no_fallback` field, offers explicit revalidation, and renders fixed copy then refetches on 409 `FALLBACK_CHAIN_MISMATCH` and `locale_limit_reached`; verification covers per-field resolution and the `no_fallback` rule, the derived variant states, both fixed 409 messages, the 403/404 split and the focused result heading.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'The CmsLocaleVariantForm and its page do not exist: there is no component, island or Astro page for /app/cms-content-modeling/entries/:entryId/locales/:locale under apps/web/src, and the protected version detail the form would read the fallback order from has no locale read. The only browser-adjacent evidence is a fetch-based Playwright route test (tests/e2e/phase-02-slice-12-locale-real-route.spec.ts) that posts to the endpoint; it renders no form. staleFieldIds, locale_limit_reached and per-field resolution (CMS-03C-20) are unimplemented.',
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
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven: "as 201 (state active or revoked, ... eligibleCount 0-128)". Nothing produces a related-content rule: the production port is a fail-closed 503 (apps/worker/src/cms-composition-production-related.ts actRelatedContent returns unavailable) because the owner-controlled eligible-target projection, the rule source and the atomic RPC cms_curate_related_content are not specified or deployed; the 201 is reachable only from a stubbed port in the route tests. eligibleCount is a contract field with no computation behind it.',
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
    limitation:
      'No database decision exists for this operation: there is no related-content RPC, so the assignment check on the source entry, the 404 for a hidden source or target and the 403 for a visible source without edit assignment are never produced. The Worker gates only on the cms.author/cms.editor capability and maps stubbed port failures. The stored-rule table is append-only and binds a real source entry (locale_related_authority.sql), but no test shows a recommendation not granting access to an unreadable target or a rule carrying no authority.',
  },
  {
    criterion: 'P2-S12-AC-061',
    text: 'CMS-03C-05 requires an `Idempotency-Key` and the strong `If-Match` equal to the source entry aggregate `version` (`expectedVersion`), applies CAS on the source entry, enforces unique pin and exclusion targets, rate buckets of 60/min/user and 120/min/party, a 15,000 ms deadline, no-store and Tier 2, appends rows without updating any, and emits no event of its own (it consumes `cms.publication.changed.v1` for invalidation).',
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
        citations: [],
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
        text: 'no-store and Tier 2',
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
        text: 'and emits no event of its own (it consumes `cms.publication.changed.v1` for invalidation).',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "applies CAS on the source entry", "no-store and Tier 2" for a real response and "emits no event of its own (it consumes cms.publication.changed.v1 for invalidation)". There is no related-content RPC, so no CAS, no unique pin or exclusion enforced in the database and no event assertion; the no-store header is asserted on a 201 from a stubbed port (related-content-success.test.ts) and the Tier 2 latency target has no test. Append-only storage is proven by direct inserts and updates on the rule table under app.cms_rpc. Unique targets are enforced by the request schema only.',
  },
  {
    criterion: 'P2-S12-AC-062',
    text: 'CMS-03C-05 maps malformed IDs, header or body (400), a missing session (401), a denied source edit (403 `RELATED_CONTENT_FORBIDDEN`), a hidden source or target (404 `RELATED_CONTENT_NOT_FOUND`), a stale version or duplicate pin (409 `RELATED_CONTENT_VERSION_CONFLICT`), a non-JSON body (415), a pin, exclusion or rule schema failure (422 `RELATED_CONTENT_VALIDATION_FAILED`), the relationship limit (429), a target projection or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.related-content.v1`, commits no mutation on unresolved target authorization, and lets a target that later becomes private or unpublished drop out of the public projection while the rule history stays private.',
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
        text: 'a hidden source or target (404 `RELATED_CONTENT_NOT_FOUND`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/related-content-errors.test.ts',
            title:
              'CMS-03C-05 port failure mapping forwards port refusals with bounded allowlisted details',
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
        text: 'a pin, exclusion or rule schema failure (422 `RELATED_CONTENT_VALIDATION_FAILED`)',
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
        citations: [],
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
        citations: [],
      },
      {
        text: 'and lets a target that later becomes private or unpublished drop out of the public projection while the rule history stays private.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: the "502/503/504 DEPENDENCY_UNAVAILABLE" deadline mapping (related-content-response.ts emits DEPENDENCY_INVALID_RESPONSE for 502 and DEPENDENCY_DEADLINE_EXCEEDED for 504, contrary to the locked catalog), "commits no mutation on unresolved target authorization" and the public-projection drop-out. There is no related-content mutation and no CMS-03C-21 projection (platform_private.cms_related_content_public_targets), so no target-authorization, no-mutation or later-unpublish behavior exists to test. The status mappings are exercised only with stubbed port failures.',
  },
  {
    criterion: 'P2-S12-AC-063',
    text: 'CMS-03C-05 is consumed by the protected `CmsRelatedContentForm`, which builds `RelatedContentRuleRequest` from an ordered pin list with move controls (no drag-only path), an exclusion list, a derived rule chosen from the registry (`shared-terms`, `same-type-recent`) with `maxCandidates`, and the `eligibleCount` shown after save, states beside the lists that exclusions win, picks entries only from the caller-readable entry list (CMS-03B-13), and renders `related_target_ineligible` as one fixed message at the offending row without saying why; verification covers the pin and exclusion bounds, the uniform refusal, the 403/404 split and the focused result heading.',
    clauses: [
      {
        text: 'CMS-03C-05 is consumed by the protected `CmsRelatedContentForm`, which builds `RelatedContentRuleRequest` from an ordered pin list with move controls (no drag-only path), an exclusion list, a derived rule chosen from the registry (`shared-terms`, `same-type-recent`) with `maxCandidates`, and the `eligibleCount` shown after save, states beside the lists that exclusions win, picks entries only from the caller-readable entry list (CMS-03B-13), and renders `related_target_ineligible` as one fixed message at the offending row without saying why; verification covers the pin and exclusion bounds, the uniform refusal, the 403/404 split and the focused result heading.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'The CmsRelatedContentForm and its page do not exist under apps/web/src; the only related-content browser-adjacent code is the same-origin POST proxy and its route (apps/web/src/pages/api/v1/cms/entries/[entryId]/related-content.ts). The rule registry, eligibleCount and the related_target_ineligible refusal it would render are unimplemented.',
  },
  {
    criterion: 'P2-S12-AC-064',
    text: 'CMS-03C-06 registers POST /api/v1/cms/governed-reviews with the strict `GovernedReviewSubmissionRequest` (`subjectKind`, `subjectId`, `subjectHash`) and returns the strict `GovernedReviewResource` as 201: `ResourceMeta` whose `contentHash` is the JCS SHA-256 of `{ subjectKind, subjectId, subjectHash, policyBasisHash, requiredDecisionCount, requiredCapabilities }`, plus `state` `open`, `subjectKind`, `subjectId`, `lineageId`, `subjectKey`, `subjectVersion`, `subjectHash`, `riskClass`, `requiredDecisionCount` 1-8, `recordedDecisionCount` 0-8, `requiredCapabilities` 1-16, `policyBasisHash`, `submittedAt`, `decidedAt`, `activatedAt` and `invalidatedReason`; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-06 registers POST /api/v1/cms/governed-reviews with the strict `GovernedReviewSubmissionRequest` (`subjectKind`, `subjectId`, `subjectHash`) and returns the strict `GovernedReviewResource` as 201: `ResourceMeta` whose `contentHash` is the JCS SHA-256 of `{ subjectKind, subjectId, subjectHash, policyBasisHash, requiredDecisionCount, requiredCapabilities }`, plus `state` `open`, `subjectKind`, `subjectId`, `lineageId`, `subjectKey`, `subjectVersion`, `subjectHash`, `riskClass`, `requiredDecisionCount` 1-8, `recordedDecisionCount` 0-8, `requiredCapabilities` 1-16, `policyBasisHash`, `submittedAt`, `decidedAt`, `activatedAt` and `invalidatedReason`; generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No governed review exists in the code: a search of apps, packages, supabase and tests for governed-reviews, GovernedReview, governed_review and CMS-03C-06 through CMS-03C-11 finds only the ledger and tracker text. Needed: the registry row and Zod contracts (GovernedReviewSubmissionRequest, GovernedReviewResource), the Hono route, the cms_governed_reviews tables and the submit RPC.',
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
    limitation:
      'No governed review exists in the code: a search of apps, packages, supabase and tests for governed-reviews, GovernedReview, governed_review and CMS-03C-06 through CMS-03C-11 finds only the ledger and tracker text. The submit validation, the subject_not_submittable and canonical_source_unavailable refusals and the partial unique index on live reviews per subject version have no implementation or test.',
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
    limitation:
      'No governed review exists in the code: a search of apps, packages, supabase and tests for governed-reviews, GovernedReview, governed_review and CMS-03C-06 through CMS-03C-11 finds only the ledger and tracker text. The template-designer and taxonomy-curator capabilities exist (cms_template_designer_authorized), but no submit authorization, capability_missing refusal or submitted_by derivation does.',
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
    limitation:
      'No governed review exists in the code: a search of apps, packages, supabase and tests for governed-reviews, GovernedReview, governed_review and CMS-03C-06 through CMS-03C-11 finds only the ledger and tracker text. The freeze, dependency-row insert, subject state change to review and audit write are the unwritten CMS-03C-06 transaction; the template state column already allows review but nothing sets it.',
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
    limitation:
      'No governed review exists in the code: a search of apps, packages, supabase and tests for governed-reviews, GovernedReview, governed_review and CMS-03C-06 through CMS-03C-11 finds only the ledger and tracker text. The cms.03c.governed-review.v1 error catalog and the NULL workflow-policy-evidence refusal are unimplemented.',
  },
  {
    criterion: 'P2-S12-AC-069',
    text: 'CMS-03C-06 is consumed by the protected `CmsGovernedReviewPanel` on the template, pattern and vocabulary pages, which shows the subject version\'s lifecycle as text and icon, builds `GovernedReviewSubmissionRequest` from the served version id and hash (never typed), offers _Submit for review_ only when the server permits it, states why a version cannot yet be activated ("Needs an independent reviewer\'s approval") and never shows an activate control without an `approved` review; verification covers each subject kind, `subject_not_submittable`, one live review per version, the 403/404 split and the focused result heading.',
    clauses: [
      {
        text: 'CMS-03C-06 is consumed by the protected `CmsGovernedReviewPanel` on the template, pattern and vocabulary pages, which shows the subject version\'s lifecycle as text and icon, builds `GovernedReviewSubmissionRequest` from the served version id and hash (never typed), offers _Submit for review_ only when the server permits it, states why a version cannot yet be activated ("Needs an independent reviewer\'s approval") and never shows an activate control without an `approved` review; verification covers each subject kind, `subject_not_submittable`, one live review per version, the 403/404 split and the focused result heading.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No governed review exists in the code: a search of apps, packages, supabase and tests for governed-reviews, GovernedReview, governed_review and CMS-03C-06 through CMS-03C-11 finds only the ledger and tracker text. There is no CmsGovernedReviewPanel under apps/web/src and no pattern or vocabulary page to host it; the template page renders a draft status message and a link to the latest draft, with no review lifecycle or submit control.',
  },
  {
    criterion: 'P2-S12-AC-070',
    text: 'CMS-03C-07 registers POST /api/v1/cms/governed-reviews/{reviewId}/decision with the strict `GovernedDecisionRequest` (`reviewId`, `decision` `approve` or `reject`, `reason`, `expectedVersion`) and returns the strict `GovernedReviewResource` as 200 with the recorded decision counted; `capability` and `stepUpAt` are unknown keys (422); generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-07 registers POST /api/v1/cms/governed-reviews/{reviewId}/decision with the strict `GovernedDecisionRequest` (`reviewId`, `decision` `approve` or `reject`, `reason`, `expectedVersion`) and returns the strict `GovernedReviewResource` as 200 with the recorded decision counted; `capability` and `stepUpAt` are unknown keys (422); generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No governed review exists in the code: a search of apps, packages, supabase and tests for governed-reviews, GovernedReview, governed_review and CMS-03C-06 through CMS-03C-11 finds only the ledger and tracker text. The decision route, GovernedDecisionRequest contract, the recorded-decision count and the step-up requirement (unconditional MFA for CMS-03C-07) are all unimplemented.',
  },
  {
    criterion: 'P2-S12-AC-071',
    text: 'CMS-03C-07 requires the path `reviewId` to equal the body `reviewId`, `decision` `approve` or `reject`, a `reason` of 1-2000 code points in NFC with no control, line or paragraph separator or bidirectional-formatting character and no `<>{}`, and an `expectedVersion` that is the review `version` with the strong `If-Match` equal to it exactly; a body `capability` or `stepUpAt` is refused as an unknown key.',
    clauses: [
      {
        text: 'CMS-03C-07 requires the path `reviewId` to equal the body `reviewId`, `decision` `approve` or `reject`, a `reason` of 1-2000 code points in NFC with no control, line or paragraph separator or bidirectional-formatting character and no `<>{}`, and an `expectedVersion` that is the review `version` with the strong `If-Match` equal to it exactly; a body `capability` or `stepUpAt` is refused as an unknown key.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'No governed review exists in the code: a search of apps, packages, supabase and tests for governed-reviews, GovernedReview, governed_review and CMS-03C-06 through CMS-03C-11 finds only the ledger and tracker text. The SafeText reason grammar for governed decisions (the 03b SafeText grammar exists for CMS-03B review decisions only) and the path/body reviewId equality rule have no CMS-03C-07 implementation or test.',
  },
];
