// Executable evidence index for the DEC-108 amendment (Slice 09), maintained in the
// repository (the 2026-10-03 integrator-v4 generator is retired: re-running it
// would drop the citation and hold edits below). Each verified entry names the
// command a reviewer can run and the test files that prove it (the union of every
// layer that carries the criterion marker in a test title).
//
// Receipts are NOT typed here. scripts/evidence/collect-receipts.mjs writes
// tests/contracts/phase-02-slice-09-receipts.generated.jsonl from machine output
// (vitest JSON, pgTAP TAP, Playwright JSON, db:races), one row per marker and test
// with the SHA-256 of the test file. The guards
// phase-02-slice-09-receipts-guard.test.ts and phase-02-slice-09-marker-citations.test.ts
// require a fresh passing receipt for every cited file and agreement between
// markers and citations in both directions.

export type S09AmendmentEvidenceEntry = Readonly<{
  criterion: `P2-S09-AC-${string}`;
  layer: string;
  command: string;
  testFiles: readonly string[];
  testMarkers: readonly string[];
  status: 'verified';
  limitation: string;
  /** Files that carry the marker but are not run by pnpm validate (race runners, dbspec). */
  supplementary?: readonly string[];
}>;

export type S09AmendmentOpenEntry = Readonly<{
  criterion: `P2-S09-AC-${string}`;
  status: string;
  reason: string;
}>;

/** Criteria whose proof is recorded here; each is [x] in plan and tracker. */
export const S09_AMENDMENT_EVIDENCE: readonly S09AmendmentEvidenceEntry[] = [
  {
    criterion: 'P2-S09-AC-001',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_p240_identity.sql',
      'supabase/tests/phase_02_slice_09_schema/001-contract.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-001]'],
    status: 'verified',
    limitation:
      'AC001 and AC017 are proven through A01/A02/A03/A05 and the template/block validators; retirement/deprecation transitions beyond the existing state machine are not exercised',
  },
  {
    criterion: 'P2-S09-AC-002',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_p240_identity.sql',
      'supabase/tests/phase_02_slice_09_schema/001-contract.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-002]'],
    status: 'verified',
    limitation:
      'AC001 and AC017 are proven through A01/A02/A03/A05 and the template/block validators; retirement/deprecation transitions beyond the existing state machine are not exercised',
  },
  {
    criterion: 'P2-S09-AC-003',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-mutations.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-template-successor.dom.test.tsx apps/worker/src/content-schema-registry/phase-02-slice-09-dec123-successor-template.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-dec123-successor-template-binding.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-dec123-template-binding.test.ts; pnpm db:test',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-mutations.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-template-successor.dom.test.tsx',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-dec123-successor-template.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-dec123-successor-template-binding.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-dec123-template-binding.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_aggregate.sql',
      'supabase/tests/phase_02_slice_09_p240_dec123_template_binding.sql',
      'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
      'supabase/tests/phase_02_slice_09_schema/001-contract.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-003]'],
    status: 'verified',
    limitation:
      'DEC-123 (owner, 2026-10-03): a new content type binds a template only through its first successor version. CMS-03A-01 creates the type atomically with no template (422 for any template member, before any template read; r9 migration 215000 and pgTAP p240_dec123_template_binding) and CMS-03A-09 gains the template pair, each template resolved through the compatibility resolver against the exact candidate and frozen into the definition hash, review evidence and activation (r11 migration 216000, pgTAP p241_dec123_successor_binding).',
  },
  {
    criterion: 'P2-S09-AC-004',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-draft-only.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-draft-only.test.ts',
      'supabase/tests/phase_02_slice_09_p241_ac004_draft_only_edits.sql',
    ],
    testMarkers: ['[P2-S09-AC-004]'],
    status: 'verified',
    limitation:
      'r11 pgTAP p241_ac004_draft_only_edits (22 assertions): CMS-03A-02/03 commit only on an unactivated draft and an approved or active version answers CONFLICT with nothing changed; the Worker half is the p240-app draft-only test.',
  },
  {
    criterion: 'P2-S09-AC-005',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_locale.sql'],
    testMarkers: ['[P2-S09-AC-005]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-124 (ledger row AC005): the canonical authoring locale and the governed delivery fallback root are proven by p240_locale (every clause of the text); the declaration and storage of no_fallback is AC1166 and its resolution semantics belong to Slice 12 AC051 and AC052 (DEC-121).',
  },
  {
    criterion: 'P2-S09-AC-006',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_aggregate.sql',
    ],
    testMarkers: ['[P2-S09-AC-006]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-007',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-ac007-artifact-strict.test.ts tests/contracts/phase-02-slice-09-r12-spec-text.test.ts; pnpm db:test',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-ac007-artifact-strict.test.ts',
      'supabase/tests/phase_02_slice_09_p241_ac007_artifact_compile.sql',
      'tests/contracts/phase-02-slice-09-r12-spec-text.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-007]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-124 (ledger row AC007): the compiler emits exactly the versioned contract reference plus editor and renderer manifests under one deterministic hash (p241_ac007_artifact_compile: no persisted OpenAPI or database artifact) and the strict resource refuses every other member (ac007-artifact-strict, r12-spec-text guard).',
  },
  {
    criterion: 'P2-S09-AC-008',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_p240_artifact_classification.sql',
      'supabase/tests/phase_02_slice_09_schema/001-contract.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-008]'],
    status: 'verified',
    limitation:
      'A draft candidate\'s artifact is recompiled in place by the dry-run command (the only mutation point, guarded by app.cms_compile and draft-only); BE03a says "immutable artifact" without stating this exception, so the criterion wording may want "immutable once the candidate leaves draft".',
  },
  {
    criterion: 'P2-S09-AC-009',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_p240_artifact_classification.sql',
    ],
    testMarkers: ['[P2-S09-AC-009]'],
    status: 'verified',
    limitation:
      'The code derives three classes; "unknown" is exercised as a candidate whose source cannot be resolved (forged supersedes_id, rolled back): refused 422 with no attempt, plan or job.',
  },
  {
    criterion: 'P2-S09-AC-010',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a04-activation.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a04-activation.test.ts',
      'supabase/tests/phase_02_slice_09_p240_activation_gates.sql',
    ],
    testMarkers: ['[P2-S09-AC-010]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-011',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a03_relation.sql',
      'supabase/tests/phase_02_slice_09_schema/001-contract.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-011]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-012',
    layer: 'db',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-pre-structure.test.ts; pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_p240_block_release.sql',
      'tests/contracts/phase-02-slice-09-pre-structure.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-012]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-013',
    layer: 'db',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-pre-structure.test.ts; pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
      'supabase/tests/phase_02_slice_09_schema/001-contract.sqlinc',
      'supabase/tests/phase_02_slice_09_schema/001-fixture-bootstrap.sqlinc',
      'tests/contracts/phase-02-slice-09-pre-structure.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-013]'],
    status: 'verified',
    limitation: 'No-store is an HTTP header (Worker lane).',
  },
  {
    criterion: 'P2-S09-AC-014',
    layer: 'db',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-pre-structure.test.ts; pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
      'tests/contracts/phase-02-slice-09-pre-structure.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-014]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-015',
    layer: 'db',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts tests/contracts/phase-02-slice-09-pre-structure.test.ts; pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_p240_authority.sql',
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
      'tests/contracts/phase-02-slice-09-pre-structure.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-015]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-016',
    layer: 'db',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-pre-structure.test.ts; pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_p240_activation_gates.sql',
      'tests/contracts/phase-02-slice-09-pre-structure.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-016]'],
    status: 'verified',
    limitation:
      'No BE03a operation, RPC or event defines the "audited blocked to draft transition": no producer creates a blocked definition and the new guard (migration 20261002206000) refuses every state change away from blocked unless app.cms_audited_transition is set, which nothing sets. The clause holds vacuously; the owner may want to confirm blocked is unreachable by design like scheduled (OD-6).',
  },
  {
    criterion: 'P2-S09-AC-017',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_identity.sql'],
    testMarkers: ['[P2-S09-AC-017]'],
    status: 'verified',
    limitation:
      'AC001 and AC017 are proven through A01/A02/A03/A05 and the template/block validators; retirement/deprecation transitions beyond the existing state machine are not exercised',
  },
  {
    criterion: 'P2-S09-AC-018',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts',
      'supabase/tests/phase_02_slice_09_schema/001-contract.sqlinc',
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-018]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-019',
    layer: 'worker+contracts',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-activation-evidence.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-activation-evidence.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-019]'],
    status: 'verified',
    limitation:
      'Hono route discovery and generated OpenAPI each compared to the 18-row route registry; DB RPC set is guarded separately by AC732/AC685.',
  },
  {
    criterion: 'P2-S09-AC-020',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-020]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-021',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts',
      'supabase/tests/phase_02_slice_09_schema/001-contract.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-021]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-022',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts',
      'supabase/tests/phase_02_slice_09_schema/001-contract.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-022]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-023',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts',
      'apps/worker/src/content-schema-registry/admission-policy-parity.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-023]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-024',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-024]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-025',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-worker-admission.test.ts tests/contracts/phase-02-slice-09-pre-structure.test.ts tests/contracts/phase-02-slice-09-r12-spec-text.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-worker-admission.test.ts',
      'tests/contracts/phase-02-slice-09-pre-structure.test.ts',
      'tests/contracts/phase-02-slice-09-r12-spec-text.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be00-middleware-order.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-025]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-124 (ledger row AC025): BE00 Hono Middleware Order governs and BE03a restates no order (r12-spec-text guard); the Worker runs that order for the original operations (be00-middleware-order, 12 tests; worker-admission); cms-console CORS and session-bound CSRF apply to human mutations and release-worker requests carry no browser CSRF authority.',
  },
  {
    criterion: 'P2-S09-AC-026',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-r12-release-headers.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-worker-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r12-release-headers.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-worker-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-026]'],
    status: 'verified',
    limitation:
      'r12 release-header tests: nine alias or unknown release headers and every missing exact header are 400 before the verifier, JSON parse and port, for both CMS-03A-05 and CMS-03A-08, and each exact header maps to its verifier member; JSON body copies of the four fields are refused 422 (worker-admission).',
  },
  {
    criterion: 'P2-S09-AC-027',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-envelope.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-envelope.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-027]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-028',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-envelope.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-envelope.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-028]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-029',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-029]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-030',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-030]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-031',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-031]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-032',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r14-error-rows-production.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-032]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-033',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-033]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-034',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r12-authority-production.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r12-authority-production.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_aggregate.sql',
      'supabase/tests/phase_02_slice_09_p240_authority.sql',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-dec129-release-errors.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_release.sql',
      'supabase/tests/phase_02_slice_09_schema/003-authorization-and-projections.sqlinc',
      'supabase/tests/phase_02_slice_09_schema/003c-block-release-boundaries.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-034]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-124 (ledger row AC034): CMS-03A-01 concealment (404 foreign or absent scope, 403 for a member without schema_designer) and CMS-03A-02, -03, -07 and the CMS-03A-08 unknown-id 404 are database-proven; since R14 the CMS-03A-05 and CMS-03A-08 human 403 are also database rows (p240_block_register, p240_block_lifecycle, p240_block_release) and DEC-129 deleted the CMS-03A-05 unknown-target 404, so CMS-03A-05 declares no 404 (dec129-release-errors). The ratified text still names that 404 and the human 403 as Worker mappings.',
  },
  {
    criterion: 'P2-S09-AC-035',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/error-detail-values.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/error-detail-values.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-035]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-036',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts',
      'supabase/tests/phase_02_slice_09_p240_authority.sql',
    ],
    testMarkers: ['[P2-S09-AC-036]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-037',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts',
      'supabase/tests/phase_02_slice_09_p240_authority.sql',
      'supabase/tests/phase_02_slice_09_schema/001-contract.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-037]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-124 (ledger row AC037): the RLS helper is schema-qualified, pinned-search_path and STABLE (IMMUTABLE would be wrong because it reads the session context) and every write is RPC-only (p240_authority, schema 001-contract, pre-admission).',
  },
  {
    criterion: 'P2-S09-AC-038',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-038]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-039',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-039]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-040',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_grammar.sql',
    ],
    testMarkers: ['[P2-S09-AC-040]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-041',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-r8-label-nfc.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-r8-label-nfc.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-041]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): label counted as 2-120 NFC characters: 120/121 astral and decomposed cases, NFC output, trim (r8-label-nfc, 12 tests)',
  },
  {
    criterion: 'P2-S09-AC-042',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_grammar.sql',
    ],
    testMarkers: ['[P2-S09-AC-042]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-043',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-043]'],
    status: 'verified',
    limitation:
      'Canonical-case, 2 to 35 character and membership rules proven through CMS-03A-01; DB validator parity is a pgTAP concern (AC1203).',
  },
  {
    criterion: 'P2-S09-AC-044',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_grammar.sql',
    ],
    testMarkers: ['[P2-S09-AC-044]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-045',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-mutations.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-template-binding.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-template-successor.dom.test.tsx apps/worker/src/content-schema-registry/phase-02-slice-09-dec123-successor-template.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-dec123-successor-template-binding.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-dec123-template-binding.test.ts; pnpm db:test',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-mutations.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-template-binding.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-template-successor.dom.test.tsx',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-dec123-successor-template.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-dec123-successor-template-binding.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-dec123-template-binding.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_grammar.sql',
      'supabase/tests/phase_02_slice_09_p240_dec123_template_binding.sql',
      'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
    ],
    testMarkers: ['[P2-S09-AC-045]'],
    status: 'verified',
    limitation:
      'DEC-123 (owner, 2026-10-03): a new content type binds a template only through its first successor version. defaultTemplateVersionId is null at CMS-03A-01 and refused 422 before any template read otherwise; at CMS-03A-09 it is null (clone) or a lowercase UUID paired with templateBindings.',
  },
  {
    criterion: 'P2-S09-AC-046',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_grammar.sql',
    ],
    testMarkers: ['[P2-S09-AC-046]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-047',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_grammar.sql',
    ],
    testMarkers: ['[P2-S09-AC-047]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-048',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_grammar.sql',
    ],
    testMarkers: ['[P2-S09-AC-048]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-049',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-mutations.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-template-binding.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-template-successor.dom.test.tsx apps/worker/src/content-schema-registry/phase-02-slice-09-dec123-successor-template.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-dec123-successor-template-binding.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-dec123-template-binding.test.ts; pnpm db:test',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-mutations.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-template-binding.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-template-successor.dom.test.tsx',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-dec123-successor-template.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-dec123-successor-template-binding.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-dec123-template-binding.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_grammar.sql',
      'supabase/tests/phase_02_slice_09_p240_dec123_template_binding.sql',
      'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
    ],
    testMarkers: ['[P2-S09-AC-049]'],
    status: 'verified',
    limitation:
      'DEC-123 (owner, 2026-10-03): a new content type binds a template only through its first successor version. templateBindings is the empty array at CMS-03A-01; at CMS-03A-09 it is null (clone) or 0 to 32 unique {templateVersionId}, 404/422/409 for absent, incompatible and withdrawn.',
  },
  {
    criterion: 'P2-S09-AC-050',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_grammar.sql',
    ],
    testMarkers: ['[P2-S09-AC-050]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-051',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_aggregate.sql',
    ],
    testMarkers: ['[P2-S09-AC-051]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-052',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_aggregate.sql',
      'tests/contracts/phase-02-slice-09-race-runner-gate.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-052]'],
    status: 'verified',
    limitation: '',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec108/012-concurrent-commands.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-053',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_a01_aggregate.sql'],
    testMarkers: ['[P2-S09-AC-053]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-054',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-activation-evidence.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-activation-evidence.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_aggregate.sql',
    ],
    testMarkers: ['[P2-S09-AC-054]'],
    status: 'verified',
    limitation:
      'p240_a01_aggregate: the database create response carries exactly the declared ContentTypeVersionResource members, sourceLocale, defaultLocale, the sorted supportedLocales, fallbackChains and a 64-hex localeConfigHash, and every projected identifier, hash, timestamp and count equals the committed rows; the Worker test checks the strict 201 through the same shape.',
  },
  {
    criterion: 'P2-S09-AC-055',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a01-create.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-055]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-056',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-056]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-057',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_field.sql',
    ],
    testMarkers: ['[P2-S09-AC-057]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-058',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_field.sql',
    ],
    testMarkers: ['[P2-S09-AC-058]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-059',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_field.sql',
    ],
    testMarkers: ['[P2-S09-AC-059]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-060',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_field.sql',
    ],
    testMarkers: ['[P2-S09-AC-060]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-061',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_field.sql',
    ],
    testMarkers: ['[P2-S09-AC-061]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-062',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_field.sql',
    ],
    testMarkers: ['[P2-S09-AC-062]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-063',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_state.sql',
      'supabase/tests/phase_02_slice_09_p240_artifact_classification.sql',
    ],
    testMarkers: ['[P2-S09-AC-063]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-064',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_field.sql',
      'apps/worker/src/content-schema-registry/production-field-rpc-shape.test.ts',
      'packages/contracts/src/content-schema-registry/field-default-null.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a01_grammar.sql',
    ],
    testMarkers: ['[P2-S09-AC-064]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-065',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_field.sql',
    ],
    testMarkers: ['[P2-S09-AC-065]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-066',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_field.sql',
    ],
    testMarkers: ['[P2-S09-AC-066]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-067',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_state.sql',
    ],
    testMarkers: ['[P2-S09-AC-067]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-068',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_state.sql',
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-068]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-069',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_state.sql',
    ],
    testMarkers: ['[P2-S09-AC-069]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-070',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_state.sql',
    ],
    testMarkers: ['[P2-S09-AC-070]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-071',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a02-field.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-071]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-072',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-072]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-073',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a03_relation.sql',
    ],
    testMarkers: ['[P2-S09-AC-073]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-074',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a03_relation.sql',
    ],
    testMarkers: ['[P2-S09-AC-074]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-075',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a03_relation.sql',
    ],
    testMarkers: ['[P2-S09-AC-075]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-076',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a03_relation.sql',
    ],
    testMarkers: ['[P2-S09-AC-076]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-077',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a03_relation.sql',
    ],
    testMarkers: ['[P2-S09-AC-077]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-078',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a03_relation.sql',
    ],
    testMarkers: ['[P2-S09-AC-078]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-079',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a03_relation.sql',
    ],
    testMarkers: ['[P2-S09-AC-079]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-080',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a03_relation.sql',
    ],
    testMarkers: ['[P2-S09-AC-080]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-081',
    layer: 'contracts+db',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-editorial/cms-editorial-entry-draft-detail-transport.test.ts apps/web/src/components/cms-editorial/cms-editorial-entry-draft-detail.test.ts apps/worker/src/cms-editorial/detail-routes.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts packages/contracts/src/cms-editorial/entry-draft-detail.test.ts; pnpm db:test',
    testFiles: [
      'apps/web/src/components/cms-editorial/cms-editorial-entry-draft-detail-transport.test.ts',
      'apps/web/src/components/cms-editorial/cms-editorial-entry-draft-detail.test.ts',
      'apps/worker/src/cms-editorial/detail-routes.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
      'packages/contracts/src/cms-editorial/entry-draft-detail.test.ts',
      'supabase/tests/phase_02_slice_09_p240_relation_placeholder.sql',
    ],
    testMarkers: ['[P2-S09-AC-081]'],
    status: 'verified',
    limitation:
      'r9 migration 214000: cms_get_entry_draft returns the exact opaque placeholder {onUnavailable placeholder, unavailable {status, reason}} for any unavailable relation target under the placeholder policy, with no target id, kind or version; contract EntryDraftRelation is a union of resolved and placeholder.',
  },
  {
    criterion: 'P2-S09-AC-082',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a03_relation.sql',
    ],
    testMarkers: ['[P2-S09-AC-082]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-083',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a03_relation.sql',
    ],
    testMarkers: ['[P2-S09-AC-083]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-084',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a03-relation.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-084]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-085',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a04-activation.test.ts tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a04-activation.test.ts',
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-085]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-086',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a04-activation.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a04-activation.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-086]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-087',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_activation.sql',
      'supabase/tests/phase_02_slice_09_dec108_dry_run.sql',
      'supabase/tests/phase_02_slice_09_r3_activation_gates.sql',
      'supabase/tests/phase_02_slice_09_schema/007-activation-gates.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-087]'],
    status: 'verified',
    limitation:
      'These assertions did not fail before (behaviour existed); they close the missing-assertion gap.',
  },
  {
    criterion: 'P2-S09-AC-088',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a04-activation.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a04-activation.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-088]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-089',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_activation.sql',
      'supabase/tests/phase_02_slice_09_r3_recent_mfa.sql',
    ],
    testMarkers: ['[P2-S09-AC-089]'],
    status: 'verified',
    limitation:
      'The step-up proof is the service-role envelope context.stepUpVerified/stepUpAt (Worker-verified aal2 proof); the DB re-checks -30 s <= now - stepUpAt <= 600 s and records that instant. The binding heartbeat (10 minutes) is kept only as a separate binding-liveness check, asserted by "a dead binding heartbeat is refused ... (binding liveness stays separate)". The DB cannot independently verify the aal2 token signature; that remains the Worker verifier.',
  },
  {
    criterion: 'P2-S09-AC-090',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
      'supabase/tests/phase_02_slice_09_activation_frozen_risk.sql',
      'supabase/tests/phase_02_slice_09_dec108_activation.sql',
    ],
    testMarkers: ['[P2-S09-AC-090]'],
    status: 'verified',
    limitation: 'Shape proven; evidence values are frozen by the DB.',
  },
  {
    criterion: 'P2-S09-AC-091',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
      'supabase/tests/phase_02_slice_09_r3_recent_mfa.sql',
      'supabase/tests/phase_02_slice_09_scan_integrated_path1.sql',
    ],
    testMarkers: ['[P2-S09-AC-091]'],
    status: 'verified',
    limitation:
      'The step-up proof is the service-role envelope context.stepUpVerified/stepUpAt (Worker-verified aal2 proof); the DB re-checks -30 s <= now - stepUpAt <= 600 s and records that instant. The binding heartbeat (10 minutes) is kept only as a separate binding-liveness check, asserted by "a dead binding heartbeat is refused ... (binding liveness stays separate)". The DB cannot independently verify the aal2 token signature; that remains the Worker verifier.',
  },
  {
    criterion: 'P2-S09-AC-092',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_activation.sql',
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
      'supabase/tests/phase_02_slice_09_dec109_editorial_policy.sql',
    ],
    testMarkers: ['[P2-S09-AC-092]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-093',
    layer: 'db',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts; pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_paths.sql',
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-093]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-094',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a04-activation.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a04-activation.test.ts',
      'supabase/tests/phase_02_slice_09_p240_activation_gates.sql',
    ],
    testMarkers: ['[P2-S09-AC-094]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-095',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_r3_activation_gates.sql',
      'supabase/tests/phase_02_slice_09_schema/007-activation-gates.sqlinc',
      'supabase/tests/phase_02_slice_09_schema/008-activation-remediation.sqlinc',
      'supabase/tests/phase_02_slice_09_template_compat_guard.sql',
    ],
    testMarkers: ['[P2-S09-AC-095]'],
    status: 'verified',
    limitation:
      'The default-template tamper was dropped: it is also refused by another check, so it did not prove the wiring. The drift is injected by forging stored state (negative control) because an approved candidate is frozen; real registries (block lifecycle, template compatibility) are covered by their own suites.',
  },
  {
    criterion: 'P2-S09-AC-096',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_r3_activation_gates.sql',
      'supabase/tests/phase_02_slice_09_schema/007-activation-gates.sqlinc',
      'supabase/tests/phase_02_slice_09_schema/008-activation-remediation.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-096]'],
    status: 'verified',
    limitation:
      'A sealed report is immutable, so the mismatch is presented by forging the plan fingerprint or the artifact row inside a rolled-back sub-transaction (labelled negative-control forgery); the activation checks themselves (cms_migration_plan_ready, artifact hash check) are the real code.',
  },
  {
    criterion: 'P2-S09-AC-097',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_entry_version_lock.sql',
      'supabase/tests/phase_02_slice_09_scan_integrated_path2.sql',
      'supabase/tests/phase_02_slice_09_schema/002b-activation-fixture.sqlinc',
      'tests/contracts/phase-02-slice-09-race-runner-gate.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-097]'],
    status: 'verified',
    limitation: '',
    supplementary: [
      'supabase/tests/phase_02_slice_09_scan/010-entry-lock-race.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-098',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_r8_active_version_unmutated.sql',
      'supabase/tests/phase_02_slice_09_scan_integrated_path2.sql',
      'supabase/tests/phase_02_slice_09_scan_lifecycle.sql',
    ],
    testMarkers: ['[P2-S09-AC-098]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-db): r8_active_version_unmutated: previously active row byte-identical across two refused switches, readable as active through CMS-03A-08 before the commit, commit moves it by supersession alone',
  },
  {
    criterion: 'P2-S09-AC-099',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_successor.sql',
      'supabase/tests/phase_02_slice_09_r3_activation_gates.sql',
      'supabase/tests/phase_02_slice_09_schema/007-activation-gates.sqlinc',
      'supabase/tests/phase_02_slice_09_schema/008-activation-remediation.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-099]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-100',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-activation-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-activation-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-100]'],
    status: 'verified',
    limitation:
      'Status mapping 202 vs 200 and the localeConfigHash/jobId contract proven through the real route; the RPC decides when work is queued.',
  },
  {
    criterion: 'P2-S09-AC-101',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_activation.sql',
      'supabase/tests/phase_02_slice_09_schema/002b-activation-fixture.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-101]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-102',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_activation.sql',
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
      'supabase/tests/phase_02_slice_09_r3_activation_gates.sql',
      'supabase/tests/phase_02_slice_09_schema/007-activation-gates.sqlinc',
      'supabase/tests/phase_02_slice_09_schema/008-activation-remediation.sqlinc',
      'supabase/tests/phase_02_slice_09_schema/008b-activation-move-invalidation.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-102]'],
    status: 'verified',
    limitation:
      'The compiler change is produced by a privileged recompile (guards disabled for the one UPDATE, invalidation trigger left enabled); no application path recompiles an approved artifact.',
  },
  {
    criterion: 'P2-S09-AC-103',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-103]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-104',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-104]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-105',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-105]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-106',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-106]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-107',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-107]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-108',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts tests/contracts/phase-02-slice-09-props-constraints-bounds.test.ts tests/contracts/phase-02-slice-09-r8-props-snapshot.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
      'tests/contracts/phase-02-slice-09-props-constraints-bounds.test.ts',
      'tests/contracts/phase-02-slice-09-r8-props-snapshot.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-108]'],
    status: 'verified',
    limitation:
      'Re-audit lift (p240-db): strict normalized snapshot: additionalProperties true, missing or over-long schemaVersion, unknown snapshot and field keys refused (contracts, Worker, pgTAP block_register)',
  },
  {
    criterion: 'P2-S09-AC-109',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-109]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-110',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-110]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-111',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-111]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-112',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-112]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-113',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-113]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-114',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-114]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-115',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-115]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-116',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-116]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-117',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts tests/security/phase-02-slice-09-release-boundary.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-117]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-118',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a05-block.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-118]'],
    status: 'verified',
    limitation:
      'DB half: raw-byte verification, header names and parse order belong to the Worker lane; the DB tolerates a JSON number where Zod requires a string for capabilityVersion/min/maxSchemaCompiler.',
  },
  {
    criterion: 'P2-S09-AC-119',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-envelope.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-envelope.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_release.sql',
    ],
    testMarkers: ['[P2-S09-AC-119]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-120',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-envelope.test.ts tests/security/phase-02-slice-09-release-boundary.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-envelope.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_release.sql',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-120]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-121',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-envelope.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-envelope.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_release.sql',
    ],
    testMarkers: ['[P2-S09-AC-121]'],
    status: 'verified',
    limitation:
      'Re-audit lift (p240-db): p240_block_release: a failed outbox write leaves no registration, no nonce claim, no audit and no idempotency row; outer and props-attestation evidence persisted',
  },
  {
    criterion: 'P2-S09-AC-122',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-envelope.test.ts tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-envelope.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_release.sql',
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_register.sql',
    ],
    testMarkers: ['[P2-S09-AC-122]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-123',
    layer: 'web',
    command:
      'pnpm exec vitest run tests/security/phase-02-slice-09-release-boundary.test.ts',
    testFiles: ['tests/security/phase-02-slice-09-release-boundary.test.ts'],
    testMarkers: ['[P2-S09-AC-123]'],
    status: 'verified',
    limitation:
      'CMS-03A-05 is a release-worker-only operation with no browser surface, so the web proof is the negative one (no field, no control, no HTML); it is a source scan plus rendered-markup check, not an observed browser request.',
  },
  {
    criterion: 'P2-S09-AC-124',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-124]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-125',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-125]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-126',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-126]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-127',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts tests/contracts/phase-02-slice-09-r8-lifecycle-matrix.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
      'tests/contracts/phase-02-slice-09-r8-lifecycle-matrix.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-127]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-128',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-128]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-129',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-129]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-130',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-130]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-131',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-131]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-132',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-132]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-133',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-133]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-134',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-134]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-135',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts tests/security/phase-02-slice-09-release-boundary.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-135]'],
    status: 'verified',
    limitation:
      'Re-audit lift (p240-db): p240_reads_list: block rows are the safe BlockDefinitionRegistryRecord on a real list, no list item carries ownership, actor, party or private binding members',
  },
  {
    criterion: 'P2-S09-AC-136',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-136]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-137',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-137]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-138',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-138]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-139',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_detail.sql',
    ],
    testMarkers: ['[P2-S09-AC-139]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, status codes and dependency-error rows belong to the Worker lane.',
  },
  {
    criterion: 'P2-S09-AC-140',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_detail.sql',
    ],
    testMarkers: ['[P2-S09-AC-140]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, status codes and dependency-error rows belong to the Worker lane.',
  },
  {
    criterion: 'P2-S09-AC-141',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_detail.sql',
    ],
    testMarkers: ['[P2-S09-AC-141]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, status codes and dependency-error rows belong to the Worker lane.',
  },
  {
    criterion: 'P2-S09-AC-142',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_detail.sql',
    ],
    testMarkers: ['[P2-S09-AC-142]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, status codes and dependency-error rows belong to the Worker lane.',
  },
  {
    criterion: 'P2-S09-AC-143',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-activation-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-activation-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-143]'],
    status: 'verified',
    limitation:
      'Worker strictly parses the projection and bounds; the RPC authors its contents.',
  },
  {
    criterion: 'P2-S09-AC-144',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_detail.sql',
    ],
    testMarkers: ['[P2-S09-AC-144]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, status codes and dependency-error rows belong to the Worker lane.',
  },
  {
    criterion: 'P2-S09-AC-145',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_detail.sql',
    ],
    testMarkers: ['[P2-S09-AC-145]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, status codes and dependency-error rows belong to the Worker lane.',
  },
  {
    criterion: 'P2-S09-AC-146',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_detail.sql',
    ],
    testMarkers: ['[P2-S09-AC-146]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, status codes and dependency-error rows belong to the Worker lane.',
  },
  {
    criterion: 'P2-S09-AC-147',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_detail.sql',
    ],
    testMarkers: ['[P2-S09-AC-147]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, status codes and dependency-error rows belong to the Worker lane.',
  },
  {
    criterion: 'P2-S09-AC-148',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-148]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-149',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
    ],
    testMarkers: ['[P2-S09-AC-149]'],
    status: 'verified',
    limitation:
      'DB half only: DB does not reject unknown members of the lifecycle request (the strict-object clause of AC149 is the Zod contract); the 201 response is the DB resource.',
  },
  {
    criterion: 'P2-S09-AC-150',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
    ],
    testMarkers: ['[P2-S09-AC-150]'],
    status: 'verified',
    limitation:
      'DB half only: DB does not reject unknown members of the lifecycle request (the strict-object clause of AC149 is the Zod contract); the 201 response is the DB resource.',
  },
  {
    criterion: 'P2-S09-AC-151',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
    ],
    testMarkers: ['[P2-S09-AC-151]'],
    status: 'verified',
    limitation:
      'DB half only: DB does not reject unknown members of the lifecycle request (the strict-object clause of AC149 is the Zod contract); the 201 response is the DB resource.',
  },
  {
    criterion: 'P2-S09-AC-152',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
    ],
    testMarkers: ['[P2-S09-AC-152]'],
    status: 'verified',
    limitation:
      'DB half only: DB does not reject unknown members of the lifecycle request (the strict-object clause of AC149 is the Zod contract); the 201 response is the DB resource.',
  },
  {
    criterion: 'P2-S09-AC-153',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
    ],
    testMarkers: ['[P2-S09-AC-153]'],
    status: 'verified',
    limitation: '',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec108/012-concurrent-commands.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-154',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
    ],
    testMarkers: ['[P2-S09-AC-154]'],
    status: 'verified',
    limitation:
      'DB half only: DB does not reject unknown members of the lifecycle request (the strict-object clause of AC149 is the Zod contract); the 201 response is the DB resource.',
  },
  {
    criterion: 'P2-S09-AC-155',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
    ],
    testMarkers: ['[P2-S09-AC-155]'],
    status: 'verified',
    limitation:
      'DB half only: DB does not reject unknown members of the lifecycle request (the strict-object clause of AC149 is the Zod contract); the 201 response is the DB resource.',
  },
  {
    criterion: 'P2-S09-AC-156',
    layer: 'repo+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts tests/security/phase-02-slice-09-release-boundary.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-156]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-157',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
      'tests/contracts/phase-02-slice-09-race-runner-gate.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-157]'],
    status: 'verified',
    limitation:
      'p240_block_lifecycle carries the marker for a duplicate and a second withdrawal (CONFLICT), a stale expectedVersion (409 VERSION_MISMATCH), a wrong fromLifecycle (CONFLICT) and a releaseDigest mismatch (409 CONFLICT); the concurrent-commands race runner also carries it and is supplementary (outside the validate gate).',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec108/012-concurrent-commands.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-158',
    layer: 'repo+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts tests/security/phase-02-slice-09-release-boundary.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-158]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-159',
    layer: 'repo+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts tests/security/phase-02-slice-09-release-boundary.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-159]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-160',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
    ],
    testMarkers: ['[P2-S09-AC-160]'],
    status: 'verified',
    limitation:
      'DB half only: DB does not reject unknown members of the lifecycle request (the strict-object clause of AC149 is the Zod contract); the 201 response is the DB resource.',
  },
  {
    criterion: 'P2-S09-AC-161',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
    ],
    testMarkers: ['[P2-S09-AC-161]'],
    status: 'verified',
    limitation:
      'DB half only: DB does not reject unknown members of the lifecycle request (the strict-object clause of AC149 is the Zod contract); the 201 response is the DB resource.',
  },
  {
    criterion: 'P2-S09-AC-162',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql'],
    testMarkers: ['[P2-S09-AC-162]'],
    status: 'verified',
    limitation:
      'DB half only: DB does not reject unknown members of the lifecycle request (the strict-object clause of AC149 is the Zod contract); the 201 response is the DB resource.',
  },
  {
    criterion: 'P2-S09-AC-163',
    layer: 'repo+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts tests/security/phase-02-slice-09-release-boundary.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-163]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-164',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-errors.test.ts tests/security/phase-02-slice-09-release-boundary.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-errors.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-164]'],
    status: 'verified',
    limitation:
      'DB half only: DB does not reject unknown members of the lifecycle request (the strict-object clause of AC149 is the Zod contract); the 201 response is the DB resource.',
  },
  {
    criterion: 'P2-S09-AC-165',
    layer: 'db',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts; pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_p240_tables.sql',
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-165]'],
    status: 'verified',
    limitation:
      'Constraint and index counts are checked against the live catalog, so a future legitimate addition needs the count and its note updated together',
  },
  {
    criterion: 'P2-S09-AC-166',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_tables.sql'],
    testMarkers: ['[P2-S09-AC-166]'],
    status: 'verified',
    limitation:
      'Constraint and index counts are checked against the live catalog, so a future legitimate addition needs the count and its note updated together',
  },
  {
    criterion: 'P2-S09-AC-167',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_p240_tables.sql',
      'supabase/tests/phase_02_slice_09_p240_identity.sql',
    ],
    testMarkers: ['[P2-S09-AC-167]'],
    status: 'verified',
    limitation:
      'Constraint and index counts are checked against the live catalog, so a future legitimate addition needs the count and its note updated together',
  },
  {
    criterion: 'P2-S09-AC-168',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_tables.sql'],
    testMarkers: ['[P2-S09-AC-168]'],
    status: 'verified',
    limitation:
      'Constraint and index counts are checked against the live catalog, so a future legitimate addition needs the count and its note updated together',
  },
  {
    criterion: 'P2-S09-AC-169',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_misc.sql',
      'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
      'supabase/tests/phase_02_slice_09_r3_grants_misc.sql',
      'supabase/tests/phase_02_slice_09_template_compat_guard.sql',
    ],
    testMarkers: ['[P2-S09-AC-169]'],
    status: 'verified',
    limitation:
      'p241_dec123_successor_binding (producer-made bindings): persisted owner, parent version, template UUID and position in request order; both bindings re-resolve compatible through platform_api.cms_resolve_template_compatibility and an excluded template is refused by the same RPC; UPDATE, DELETE and INSERT on the activated version raise IMMUTABLE_RECORD; the unique parent/template pair and the draft compatibility guard hold.',
  },
  {
    criterion: 'P2-S09-AC-170',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_tables.sql'],
    testMarkers: ['[P2-S09-AC-170]'],
    status: 'verified',
    limitation:
      'Constraint and index counts are checked against the live catalog, so a future legitimate addition needs the count and its note updated together',
  },
  {
    criterion: 'P2-S09-AC-171',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_p240_tables.sql',
      'supabase/tests/phase_02_slice_09_p240_a02_state.sql',
    ],
    testMarkers: ['[P2-S09-AC-171]'],
    status: 'verified',
    limitation:
      'Constraint and index counts are checked against the live catalog, so a future legitimate addition needs the count and its note updated together',
  },
  {
    criterion: 'P2-S09-AC-172',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_tables.sql'],
    testMarkers: ['[P2-S09-AC-172]'],
    status: 'verified',
    limitation:
      'Constraint and index counts are checked against the live catalog, so a future legitimate addition needs the count and its note updated together',
  },
  {
    criterion: 'P2-S09-AC-173',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_tables.sql'],
    testMarkers: ['[P2-S09-AC-173]'],
    status: 'verified',
    limitation:
      'Constraint and index counts are checked against the live catalog, so a future legitimate addition needs the count and its note updated together',
  },
  {
    criterion: 'P2-S09-AC-174',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_tables.sql'],
    testMarkers: ['[P2-S09-AC-174]'],
    status: 'verified',
    limitation:
      'Constraint and index counts are checked against the live catalog, so a future legitimate addition needs the count and its note updated together',
  },
  {
    criterion: 'P2-S09-AC-175',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_block_release.sql'],
    testMarkers: ['[P2-S09-AC-175]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-176',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_block_release.sql'],
    testMarkers: ['[P2-S09-AC-176]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-177',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql'],
    testMarkers: ['[P2-S09-AC-177]'],
    status: 'verified',
    limitation:
      'DB half only: DB does not reject unknown members of the lifecycle request (the strict-object clause of AC149 is the Zod contract); the 201 response is the DB resource.',
  },
  {
    criterion: 'P2-S09-AC-178',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_tables.sql'],
    testMarkers: ['[P2-S09-AC-178]'],
    status: 'verified',
    limitation:
      'Re-audit lift (p240-db): p240_tables: 20 unique constraints, 23 foreign keys and 20 further indexes inventoried; every constraint of a table with rows probed with a duplicate and a dangling value',
  },
  {
    criterion: 'P2-S09-AC-179',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_tables.sql'],
    testMarkers: ['[P2-S09-AC-179]'],
    status: 'verified',
    limitation:
      'Constraint and index counts are checked against the live catalog, so a future legitimate addition needs the count and its note updated together',
  },
  {
    criterion: 'P2-S09-AC-180',
    layer: 'db',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-api-surface-callers.test.ts tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts tests/contracts/phase-02-slice-09-pre-api-surface.test.ts; pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_resolver.sql',
      'supabase/tests/phase_02_slice_09_od4_locale_validator.sql',
      'supabase/tests/phase_02_slice_09_r8_api_surface.sql',
      'tests/contracts/phase-02-slice-09-api-surface-callers.test.ts',
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
      'tests/contracts/phase-02-slice-09-pre-api-surface.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-180]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-124 (ledger row AC180): the exact-set guard on the live catalog and against the callers enumerates the SQL API (r8_api_surface, api-surface-callers); cms_resolve_template_compatibility and cms_validate_locale_config are executable by no API role and anon and authenticated hold no direct INSERT, UPDATE or DELETE grant.',
  },
  {
    criterion: 'P2-S09-AC-181',
    layer: 'db',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts; pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_mfa_self_views.sql',
      'supabase/tests/phase_02_slice_09_evidence_misc.sql',
      'supabase/tests/phase_02_slice_09_r3_rls_session_scope.sql',
      'supabase/tests/phase_02_slice_09_r8_review_owner_consistency.sql',
      'supabase/tests/phase_02_slice_09_schema/001-contract.sqlinc',
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
      'supabase/tests/phase_02_slice_09_sec2_definer_rls.sql',
      'supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql',
    ],
    testMarkers: ['[P2-S09-AC-181]'],
    status: 'verified',
    limitation:
      'R6-db finding 1_reviewer_rls: RED 14 failed of 57; GREEN 59/59.',
  },
  {
    criterion: 'P2-S09-AC-182',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_authority.sql'],
    testMarkers: ['[P2-S09-AC-182]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-183',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_a01_aggregate.sql'],
    testMarkers: ['[P2-S09-AC-183]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-184',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_reads_detail.sql'],
    testMarkers: ['[P2-S09-AC-184]'],
    status: 'verified',
    limitation:
      'Re-audit lift (p240-db): p240_reads_detail: neither projection function contains a write, idempotency, audit, outbox or row lock; successful and failed list calls change no definition, migration, idempotency, audit, outbox, lease or job row',
  },
  {
    criterion: 'P2-S09-AC-185',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_tables.sql'],
    testMarkers: ['[P2-S09-AC-185]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-125 (ledger row AC185): no purge path exists for CMS definitions, plans or reports (the nine tables refuse DELETE and no function deletes them, p240_tables); legal-hold and incident-fence enforcement over CMS records is received by Slice 16 AC029.',
  },
  {
    criterion: 'P2-S09-AC-186',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_p240_activation_gates.sql'],
    testMarkers: ['[P2-S09-AC-186]'],
    status: 'verified',
    limitation:
      'No BE03a operation, RPC or event defines the "audited blocked to draft transition": no producer creates a blocked definition and the new guard (migration 20261002206000) refuses every state change away from blocked unless app.cms_audited_transition is set, which nothing sets. The clause holds vacuously; the owner may want to confirm blocked is unreachable by design like scheduled (OD-6).',
  },
  {
    criterion: 'P2-S09-AC-187',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-migration.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-migration.test.ts',
      'supabase/tests/phase_02_slice_09_p240_migration_protocol.sql',
    ],
    testMarkers: ['[P2-S09-AC-187]'],
    status: 'verified',
    limitation: 'blocked->draft audited transition has no producer; vacuous',
  },
  {
    criterion: 'P2-S09-AC-188',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/migration-worker-recovery.test.ts apps/worker/src/content-schema-registry/migration-worker.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/migration-worker-recovery.test.ts',
      'apps/worker/src/content-schema-registry/migration-worker.test.ts',
      'supabase/tests/phase_02_slice_09_p240_migration_protocol.sql',
    ],
    testMarkers: ['[P2-S09-AC-188]'],
    status: 'verified',
    limitation: 'blocked->draft audited transition has no producer; vacuous',
  },
  {
    criterion: 'P2-S09-AC-189',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a04-activation.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a04-activation.test.ts',
      'supabase/tests/phase_02_slice_09_p240_activation_gates.sql',
    ],
    testMarkers: ['[P2-S09-AC-189]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-190',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/async-runtime-consumer-outbox.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-pre-migration.test.ts packages/contracts/src/consumer-queue-events.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/async-runtime-consumer-outbox.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-migration.test.ts',
      'packages/contracts/src/consumer-queue-events.test.ts',
      'supabase/tests/phase_02_slice_09_g1_consumer_boundary.sql',
      'supabase/tests/phase_02_slice_09_p240_authority.sql',
      'supabase/tests/phase_02_slice_09_p240_outbox_producer.sql',
    ],
    testMarkers: ['[P2-S09-AC-190]'],
    status: 'verified',
    limitation:
      'r9 migration 213000: the BE00 producer member is derived from an immutable registered event-type-prefix map in the outbox dispatcher; claim_outbox_batch returns occurred_at and producer, consumer envelopes carry them, and the Worker relay refuses a wrong or missing producer.',
  },
  {
    criterion: 'P2-S09-AC-191',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/locale-config-schemas.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/locale-config-schemas.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-191]'],
    status: 'verified',
    limitation:
      'Payload shape (ids, activation-evidence snapshot, localeConfigHash, nothing else) is strict; the outbox emission itself happens in the RPC.',
  },
  {
    criterion: 'P2-S09-AC-192',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-migration.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-migration.test.ts',
      'supabase/tests/phase_02_slice_09_p240_authority.sql',
    ],
    testMarkers: ['[P2-S09-AC-192]'],
    status: 'verified',
    limitation:
      'DB half: retry schedule (15/60/300 s), alerting and consumer monotonic-version bookkeeping beyond the stale answer are Worker-side; stale ordering needs a later event of the same aggregate which these producers do not emit.',
  },
  {
    criterion: 'P2-S09-AC-193',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-human-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r12-a01-failures.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-human-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r12-a01-failures.test.ts',
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
      'supabase/tests/phase_02_slice_09_f1_cms_rate_limit.sql',
      'supabase/tests/phase_02_slice_09_od4_locale_config.sql',
      'supabase/tests/phase_02_slice_09_p240_a01_aggregate.sql',
    ],
    testMarkers: ['[P2-S09-AC-193]'],
    status: 'verified',
    limitation:
      'database half (p240_a01_aggregate and sibling files): 422, 400, 409, 403, 401, scope and idempotency conflict, the 429 limiter row for CMS-03A-01, and class 53 and class 08 failures propagating with their SQLSTATE and full rollback, nothing committed; Worker half (r12 a01-failures, 21 tests): every A01 failure class maps to its declared error with the four-field envelope, 429 from an exhausted counting limiter, 503 from HTTP 503 and a refused connection, 504 from a hung RPC. A 503 has no database condition by itself.',
  },
  {
    criterion: 'P2-S09-AC-194',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-human-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-human-errors.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a02_state.sql',
    ],
    testMarkers: ['[P2-S09-AC-194]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-195',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-human-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-human-errors.test.ts',
      'supabase/tests/phase_02_slice_09_p240_a03_relation.sql',
    ],
    testMarkers: ['[P2-S09-AC-195]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-196',
    layer: 'worker+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-activation-evidence.test.ts && pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-activation-evidence.test.ts',
      'supabase/tests/phase_02_slice_09_r8_active_version_unmutated.sql',
    ],
    testMarkers: ['[P2-S09-AC-196]'],
    status: 'verified',
    limitation:
      'Complete local proof: the Worker half maps every A04 failure class to its declared error with the four-field BE00 envelope; the DB half (r8_active_version_unmutated) proves both refused switches (unapproved candidate and stale CAS) leave the previously active row byte-identical in every column, including version and updated_at.',
  },
  {
    criterion: 'P2-S09-AC-197',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-errors.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_release.sql',
    ],
    testMarkers: ['[P2-S09-AC-197]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-198',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-198]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, Idempotency-Key/If-Match header rejection and ApiError envelope belong to the Worker lane. Worker call shape: the Worker always sends the server `context` member; CMS-03A-06 previously refused it (INVALID_REQUEST) and is fixed.',
  },
  {
    criterion: 'P2-S09-AC-199',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
      'supabase/tests/phase_02_slice_09_p240_reads_detail.sql',
    ],
    testMarkers: ['[P2-S09-AC-199]'],
    status: 'verified',
    limitation:
      'DB half: HTTP no-store, status codes and dependency-error rows belong to the Worker lane.',
  },
  {
    criterion: 'P2-S09-AC-200',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-errors.test.ts tests/security/phase-02-slice-09-release-boundary.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-release-errors.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-200]'],
    status: 'verified',
    limitation:
      'DB half only: DB does not reject unknown members of the lifecycle request (the strict-object clause of AC149 is the Zod contract); the 201 response is the DB resource.',
  },
  {
    criterion: 'P2-S09-AC-201',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-runtime.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-s09-form-errors.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-runtime.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-form-errors.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-201]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-202',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-feedback.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-runtime-mutation-reconciliation.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-runtime.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-feedback.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-runtime-mutation-reconciliation.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-runtime.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-202]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-203',
    layer: 'worker+db',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-editorial/cms-editorial-entry-draft-detail-transport.test.ts apps/web/src/components/cms-editorial/cms-editorial-entry-draft-detail.test.ts apps/worker/src/cms-editorial-production-detail.test.ts apps/worker/src/cms-editorial/detail-routes.test.ts packages/contracts/src/cms-editorial/entry-draft-detail.test.ts; pnpm db:test',
    testFiles: [
      'apps/web/src/components/cms-editorial/cms-editorial-entry-draft-detail-transport.test.ts',
      'apps/web/src/components/cms-editorial/cms-editorial-entry-draft-detail.test.ts',
      'apps/worker/src/cms-editorial-production-detail.test.ts',
      'apps/worker/src/cms-editorial/detail-routes.test.ts',
      'packages/contracts/src/cms-editorial/entry-draft-detail.test.ts',
      'supabase/tests/phase_02_slice_09_p240_relation_placeholder.sql',
    ],
    testMarkers: ['[P2-S09-AC-203]'],
    status: 'verified',
    limitation:
      'r9 migration 214000 (as AC081): placeholder, omit and block outcomes are produced by the entry read; omit unchanged and block still DEPENDENCY_UNAVAILABLE.',
  },
  {
    criterion: 'P2-S09-AC-204',
    layer: 'db',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-process-record-guards.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-process-record-guards.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-204]'],
    status: 'verified',
    limitation:
      'Process criterion, self-attested: the record guard tests/contracts/phase-02-slice-09-process-record-guards.test.ts asserts that a named executed test exists for each blocking security gate (reserved-concept, arbitrary-code/style, draft/control-plane leak, BOLA, approval-bypass, migration-corruption) and that pnpm validate and the CI database job run them; it does not prove the behaviours themselves.',
  },
  {
    criterion: 'P2-S09-AC-205',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-observability.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-observability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-205]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-206',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-observability.test.ts packages/observability/src/logging.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-observability.test.ts',
      'packages/observability/src/logging.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-206]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-207',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-observability.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-observability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-207]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-208',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-observability.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-registry-metrics.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-observability.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-registry-metrics.test.ts',
      'supabase/tests/phase_02_slice_09_r8_operational_gauges.sql',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r14-migration-metrics.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r14-nonce-replay-metric.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r14-read-metrics.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_lifecycle.sql',
      'supabase/tests/phase_02_slice_09_p240_block_release.sql',
    ],
    testMarkers: ['[P2-S09-AC-208]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): every declared A01-A08 metric name is now emitted through production telemetry: pre-observability test collects all 15 names, registry-metrics A01-A04/A05/A08 counters, r8_operational_gauges pgTAP for outbox and activation ages',
  },
  {
    criterion: 'P2-S09-AC-210',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-observability.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-observability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-210]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-212',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-observability.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-observability.test.ts',
      'supabase/tests/phase_02_slice_09_p240_authority.sql',
    ],
    testMarkers: ['[P2-S09-AC-212]'],
    status: 'verified',
    limitation:
      'p240_authority: a forced audit or outbox failure rolls back CMS-03A-01, 02, 03, 04, 05 and 08 and the same request then commits; CMS-03A-02 emits no outbox event (BE03a), so the outbox half is vacuous for CMS-03A-02 and asserted as zero outbox rows; the Worker test keeps telemetry loss from rolling back a committed definition.',
  },
  {
    criterion: 'P2-S09-AC-213',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-a08-lifecycle.test.ts',
      'supabase/tests/phase_02_slice_09_p240_block_release.sql',
    ],
    testMarkers: ['[P2-S09-AC-213]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-214',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts tests/contracts/phase-02-slice-09-adversarial-boundaries.test.ts tests/contracts/phase-02-slice-09-adversarial-contracts.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-parity.test.ts',
      'tests/contracts/phase-02-slice-09-adversarial-boundaries.test.ts',
      'tests/contracts/phase-02-slice-09-adversarial-contracts.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-214]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-215',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
      'supabase/tests/phase_02_slice_09_evidence_constraints_reports.sql',
      'supabase/tests/phase_02_slice_09_evidence_constraints_reviews.sql',
      'supabase/tests/phase_02_slice_09_evidence_trigger_catalog.sql',
      'supabase/tests/phase_02_slice_09_schema/011-constraint-probes.sqlinc',
      'supabase/tests/phase_02_slice_09_schema/012-trigger-catalog.sqlinc',
      'supabase/tests/phase_02_slice_09_fk_probe_base_row.sql',
    ],
    testMarkers: ['[P2-S09-AC-215]'],
    status: 'verified',
    limitation:
      '15 tables have no Slice 09 producer path and hold no row in either fixture (cms_composition_instances, cms_conflict_records, cms_edit_presence, cms_editorial_decisions, cms_editorial_reviews, cms_entry_relations, cms_pattern_versions, cms_preview_tokens, cms_publication_schedules, cms_publication_versions, cms_related_content_rules, cms_taxonomy_versions, cms_term_assignments, cms_term_labels, cms_terms): their triggers are inventoried and cannot drift, but their behavior is proved by Slice 10-16 suites, not here. Finding: cms_owner_initialization (the immutable owner receipt DEC-119 reads) has no UPDATE/DELETE guard trigger; it is protected only by revoked grants and the singleton key, and phase_02_slice_09_owner_bootstrap.sql deletes it in test.',
  },
  {
    criterion: 'P2-S09-AC-216',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial.test.ts tests/contracts/phase-02-slice-09-adversarial-boundaries.test.ts tests/contracts/phase-02-slice-09-adversarial-contracts.test.ts tests/security/phase-02-slice-09-input-fuzz.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial.test.ts',
      'tests/contracts/phase-02-slice-09-adversarial-boundaries.test.ts',
      'tests/contracts/phase-02-slice-09-adversarial-contracts.test.ts',
      'tests/security/phase-02-slice-09-input-fuzz.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-216]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-217',
    layer: 'worker+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial-recovery.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r12-create128-profile.test.ts tests/contracts/phase-02-slice-09-adversarial-boundaries.test.ts tests/performance/phase-02-slice-09-recovery-durable.test.ts tests/performance/phase-02-slice-09-recovery.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial-recovery.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r12-create128-profile.test.ts',
      'supabase/tests/phase_02_slice_09_canonical_json_equivalence.sql',
      'supabase/tests/phase_02_slice_09_evidence_bench128.sql',
      'supabase/tests/phase_02_slice_09_scan_integrated_path2.sql',
      'supabase/tests/phase_02_slice_09_schema/005d-worker-breaking.sqlinc',
      'supabase/tests/phase_02_slice_09_schema/006-rollback-fencing.sqlinc',
      'supabase/tests/phase_02_slice_09_schema/009-recovery-acceptance.sqlinc',
      'supabase/tests/phase_02_slice_09_schema/009b-recovery-activation.sqlinc',
      'tests/contracts/phase-02-slice-09-adversarial-boundaries.test.ts',
      'tests/performance/phase-02-slice-09-recovery-durable.test.ts',
      'tests/performance/phase-02-slice-09-recovery.test.ts',
      'supabase/tests/phase_02_slice_09_r14_json_bounded.sql',
    ],
    testMarkers: ['[P2-S09-AC-217]'],
    status: 'verified',
    limitation:
      'create128 RPC p95 <300 ms is the binding BE03a gate, over at least twenty samples (n>=20), with the worst sample under the 1,200 ms Tier 2 command budget; p95 <200 ms stays diagnostic only (evidence_bench128, n=25, over twenty-five 128-field definitions created through the real producers), after migrations 20261003100000 (single-pass canonical JSON, equivalence-tested against the previous implementations over a document corpus) and 20261003100100 (batched field insert); the Worker adds a small fraction of the budget; old-active fallback, rollback, worker resume, DLQ replay and exactly-once switch are the 005d, 006, 009 and 009b pgTAP include files.',
    supplementary: [
      'supabase/tests/phase_02_slice_09_scan/010-entry-lock-race.mjs',
      'supabase/tests/phase_02_slice_09_schema/009c-independent-sessions.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-218',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-server.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-server.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-218]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-219',
    layer: 'browser+web',
    command:
      'pnpm exec vitest run tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts tests/performance/phase-02-slice-09-content-schema-registry.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry.spec.ts',
      'tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts',
      'tests/performance/phase-02-slice-09-content-schema-registry.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-219]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): unit and server-render proofs plus the production-built Chrome specs, which passed in the 2026-10-03 validation run (the Playwright JSON report is the cited receipt)',
  },
  {
    criterion: 'P2-S09-AC-220',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-props.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-props.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-220]'],
    status: 'verified',
    limitation:
      'DEC-108 authority (owner-approved amendment) with AC218 island privacy: the Workbench props carry the verified acting-context label and the safe resources, never actor, acting, person or binding ids; every other clause is proven.',
  },
  {
    criterion: 'P2-S09-AC-221',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-server.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-server.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-221]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-222',
    layer: 'browser+web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-chain.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-created.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-requests.dom.test.tsx tests/security/phase-02-slice-09-release-boundary.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-chain.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-created.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-requests.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-222]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-223',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-forms.dom.test.tsx tests/security/phase-02-slice-09-release-boundary.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-forms.dom.test.tsx',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-223]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-224',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-forms.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-forms.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-224]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-225',
    layer: 'browser+web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-activation.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-chain.dom.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-activation.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-chain.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-225]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-226',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-226]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-227',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-227]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-228',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-views.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-views.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-228]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-229',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-views.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-views.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-229]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-230',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-230]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-231',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-231]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-232',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-invalidation.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-invalidation.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-232]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-233',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-r12-reconnect-revalidation.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-no-offline-intent.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r12-reconnect-revalidation.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-no-offline-intent.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-233]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-124 (ledger row AC233): nothing protected is stored after a lost connection and the only persistence is the DEC-111 tab-scoped step-up draft (no-offline-intent); reconnect revalidation of identity, authority, input and version is proven in jsdom (r12 reconnect-revalidation) and through the real Worker in Chrome: an invalid draft survives an offline/online cycle byte for byte, reconnect issues one refetch and no POST, the explicit resubmission is refused 422 by the server, and a key typed offline is refused 409 after another device took it (registry-browser-real-route).',
  },
  {
    criterion: 'P2-S09-AC-234',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-234]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-235',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-235]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-236',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-primitives.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-primitives.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-236]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-237',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-primitives.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-primitives.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r14b-gate-reason.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-237]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-238',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-primitives.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-views.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-primitives.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-views.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-238]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-239',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-views.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-views.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-239]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-240',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-primitives.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-primitives.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-240]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-241',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-views.dom.test.tsx; pnpm test:e2e:functional',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-views.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-content-schema-registry-states.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-241]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-242',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts; pnpm test:e2e:functional',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx',
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry-states.spec.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-242]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-243',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts; pnpm test:e2e:functional',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx',
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-243]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-244',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts; pnpm test:e2e:functional',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-244]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-245',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r10-shell.dom.test.tsx tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts tests/accessibility/phase-02-slice-09-registry-shell-layout.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r10-shell.dom.test.tsx',
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'tests/accessibility/phase-02-slice-09-registry-shell-layout.test.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry.spec.ts',
      'tests/e2e/phase-02-slice-09-registry-layout-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-245]'],
    status: 'verified',
    limitation:
      'Collapsible sidebar (769 to 1024 px disclosure, persistent from 1025 px, absent at 768 px), 8 columns, 20 px gutter, 24 px margins and two columns only for independent fields are implemented by r10-web (ContentSchemaRegistrySidebar and shell CSS), proven by jsdom and CSS-contract tests and by the production-built Chrome layout spec tests/e2e/phase-02-slice-09-registry-layout-real-route.spec.ts, which passed in the 2026-10-03 validation run after the sidebar breakpoint boundary at 1025 px was fixed.',
  },
  {
    criterion: 'P2-S09-AC-246',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r10-shell.dom.test.tsx tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts tests/accessibility/phase-02-slice-09-registry-shell-layout.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r10-shell.dom.test.tsx',
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'tests/accessibility/phase-02-slice-09-registry-shell-layout.test.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry.spec.ts',
      'tests/e2e/phase-02-slice-09-registry-layout-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-246]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-124 (ledger row AC246): the twelve-column, 24 px gutter, 1440 px, list/detail split and action rail layout is proven in jsdom and CSS contracts and by the production-built Chrome layout spec; a list page holds at most 100 rows (BE03a page cap, page schema), so no client virtualization is required.',
  },
  {
    criterion: 'P2-S09-AC-247',
    layer: 'browser+web',
    command:
      'pnpm exec vitest run tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry.spec.ts',
      'tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-247]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-248',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-feedback.r8.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-feedback.test.ts tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-feedback.r8.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-feedback.test.ts',
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r14-real-form-feedback.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r14b-blur-feedback.dom.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r14b-local-422-pointers.test.ts',
      'packages/contracts/src/content-schema-registry/field-rules.test.ts',
      'tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-248]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): runtime-dom-feedback.r8: violations listed in server order, first link targets the first invalid field, aria-invalid and described-by, nested JSON pointer, summary focus, polite status, no client pre-emption',
  },
  {
    criterion: 'P2-S09-AC-249',
    layer: 'browser+web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-list-semantics.test.tsx tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-list-semantics.test.tsx',
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry.spec.ts',
      'tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r14-workbench-count.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-249]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): r8 list-semantics: plural and singular result count, active-filter summary, sort key and direction text, aria-sort on exactly the sorted header; caption, headers and 24 px targets from earlier tests',
  },
  {
    criterion: 'P2-S09-AC-250',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-confirmation-disclosure.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-confirmation-step.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-island-confirmation-reset.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-island-props-scanner.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-island-refetch-feedback.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-island-refetch-navigation.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-island-refetch-success.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-island-refetch.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-refetch-project.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-primitives.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-workbench.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-confirmation-disclosure.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-confirmation-step.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-island-confirmation-reset.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-island-props-scanner.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-island-refetch-feedback.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-island-refetch-navigation.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-island-refetch-success.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-island-refetch.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-refetch-project.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-primitives.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-workbench.test.tsx',
      'tests/e2e/phase-02-slice-09-confirmation-disclosure-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-250]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-251',
    layer: 'browser+web',
    command:
      'pnpm exec vitest run tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry-states.spec.ts',
      'tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-251]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-252',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-252]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-253',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-runtime.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx; pnpm test:e2e:functional',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-runtime.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-content-schema-registry-states.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-253]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-254',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-form-errors.dom.test.tsx tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts; pnpm test:e2e:functional',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-form-errors.dom.test.tsx',
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry-states.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-254]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-255',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx; pnpm test:e2e:functional',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-content-schema-registry-states.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-255]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-256',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx; pnpm test:e2e:functional',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-content-schema-registry-states.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-256]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-257',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx tests/security/phase-02-slice-09-release-boundary.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-257]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-258',
    layer: 'web',
    command:
      'pnpm exec vitest run tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts tests/security/phase-02-slice-09-release-boundary.test.ts; pnpm test:e2e:functional',
    testFiles: [
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry-states.spec.ts',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-258]'],
    status: 'verified',
    limitation:
      'Proves the rendered browser HTML and the web CMS source; URL, logs, analytics, Realtime and client persistence are covered by other marked tests of the privacy and invalidation families, not by this entry.',
  },
  {
    criterion: 'P2-S09-AC-259',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-activation.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-chain.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-detail.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-errors.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-list.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-preparation.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-requests.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-review.dom.test.tsx tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts tests/security/phase-02-slice-09-release-boundary.test.ts; pnpm test:e2e:functional',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-activation.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-chain.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-detail.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-errors.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-list.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-preparation.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-requests.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-review.dom.test.tsx',
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry-states.spec.ts',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-259]'],
    status: 'verified',
    limitation:
      'Error body details other than violations pointers are intentionally not rendered (closed vocabulary), which is the mapping for those fields. Reads (CMS-03A-06/07/13) are mapped on rendered markup; the Worker response allowlist is the Worker lane. No browser-only clause.',
  },
  {
    criterion: 'P2-S09-AC-260',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-block-projection.test.ts tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts tests/security/phase-02-slice-09-release-boundary.test.ts; pnpm test:e2e:functional',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-block-projection.test.ts',
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry-states.spec.ts',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-260]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): block-projection: the real parser accepts the safe record and refuses a full registration resource, a record carrying worker evidence, a lifecycle event and a WEBHOOK_REJECTED state',
  },
  {
    criterion: 'P2-S09-AC-261',
    layer: 'repo',
    command: 'pnpm validate',
    testFiles: [
      'apps/web/src/client-chunk-boundaries.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r14-workbench-count.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r14b-initial-closure.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r14b-lazy-enhancement.dom.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r14b-lazy-hydration.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r14b-lazy-validation.dom.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-page-cap.test.ts',
      'packages/contracts/src/client-entry.test.ts',
      'tests/e2e/phase-02-slice-09-registry-layout-real-route.spec.ts',
      'tests/performance/phase-02-slice-09-content-schema-registry.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-261]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-132 plus local technical proof only; no hosted claim.',
  },
  {
    criterion: 'P2-S09-AC-262',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/performance/phase-02-slice-09-content-schema-registry.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'tests/e2e/phase-02-slice-09-content-schema-registry-performance.spec.ts',
      'tests/e2e/phase-02-slice-09-content-schema-registry-real-route.spec.ts',
      'tests/e2e/phase-02-slice-09-web-vitals-real-route.spec.ts',
      'tests/performance/phase-02-slice-09-content-schema-registry.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-262]'],
    status: 'verified',
    limitation:
      'Web-vitals measurement (LCP < 2.5 s, INP < 200 ms, CLS < 0.1, no long task) on the registry, review and grants routes is the production-built Chrome spec tests/e2e/phase-02-slice-09-web-vitals-real-route.spec.ts under a stated CPU and network throttling profile, which passed in the 2026-10-03 validation run; the separate performance spec tests/e2e/phase-02-slice-09-content-schema-registry-performance.spec.ts is wired into the s09-real Playwright config (playwright.s09-real.config.ts) and so is cited as proof.',
  },
  {
    criterion: 'P2-S09-AC-263',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-primitives.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-server.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts tests/integration/phase-02-slice-09-dom-interactions.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-primitives.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-server.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-state.dom.test.tsx',
      'tests/accessibility/phase-02-slice-09-content-schema-registry.test.ts',
      'tests/integration/phase-02-slice-09-dom-interactions.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-263]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-264',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-activation.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-chain.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-detail.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-errors.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-list.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-preparation.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-realtime.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-requests.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-review.dom.test.tsx tests/integration/phase-02-slice-09-list-query-options.test.ts tests/integration/phase-02-slice-09-operation-boundaries-release.test.ts tests/integration/phase-02-slice-09-operation-boundaries.test.ts tests/integration/phase-02-slice-09-registry-contract-evidence.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-activation.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-chain.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-detail.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-errors.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-list.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-preparation.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-realtime.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-requests.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-mapping-review.dom.test.tsx',
      'tests/integration/phase-02-slice-09-list-query-options.test.ts',
      'tests/integration/phase-02-slice-09-operation-boundaries-release.test.ts',
      'tests/integration/phase-02-slice-09-operation-boundaries.test.ts',
      'tests/integration/phase-02-slice-09-registry-contract-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-264]'],
    status: 'verified',
    limitation:
      'Rate UI for the registry list/detail reads (429 countdown on the island status) is proved by the existing marked registry status tests, not re-proved here; the Worker route policies and OpenAPI mapping are covered by tests/integration phase-02-slice-09-operation-boundaries. Browser-only remainder: none.',
  },
  {
    criterion: 'P2-S09-AC-267',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
      'tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts',
      'tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-267]'],
    status: 'verified',
    limitation:
      'Re-audit lift (p240-app): pre-traceability: every checkpoint mirrored in plan and tracker with contiguous ids, identical description and source ownership for the whole slice',
  },
  {
    criterion: 'P2-S09-AC-268',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    testFiles: ['tests/contracts/phase-02-slice-09-pre-traceability.test.ts'],
    testMarkers: ['[P2-S09-AC-268]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-269',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts tests/contracts/phase-02-slice-09-evidence-map.test.ts tests/contracts/phase-02-slice-09-locked-traceability.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
      'tests/contracts/phase-02-slice-09-evidence-map.test.ts',
      'tests/contracts/phase-02-slice-09-locked-traceability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-269]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-270',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    testFiles: ['tests/contracts/phase-02-slice-09-pre-traceability.test.ts'],
    testMarkers: ['[P2-S09-AC-270]'],
    status: 'verified',
    limitation:
      'Process criterion, self-attested: the retained reconciliation record test asserts the independent QA-RED baseline precedes the QA-GREEN run with the canonical validation output; history was squashed into the phase 2 merge.',
  },
  {
    criterion: 'P2-S09-AC-271',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-evidence-map.test.ts',
    testFiles: ['tests/contracts/phase-02-slice-09-evidence-map.test.ts'],
    testMarkers: ['[P2-S09-AC-271]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-272',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    testFiles: ['tests/contracts/phase-02-slice-09-pre-traceability.test.ts'],
    testMarkers: ['[P2-S09-AC-272]'],
    status: 'verified',
    limitation:
      'Process criterion, self-attested: the record test attests the four artifacts the reconciliation edited and no source document; history was squashed into the phase 2 merge.',
  },
  {
    criterion: 'P2-S09-AC-273',
    layer: 'db+process',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts tests/contracts/phase-02-slice-09-ledger-guard.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
      'tests/contracts/phase-02-slice-09-ledger-guard.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-273]'],
    status: 'verified',
    limitation:
      'Closed by the integrator: BE03a says a different actor owns a distinct BE00 idempotency binding (ledger gap row re-anchored and resolved), AC942 and AC1049 carry the BE05b and BE03a text, and the ledger guard asserts the gap rows against the current sources while Slice 09 is open.',
  },
  {
    criterion: 'P2-S09-AC-274',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
      'tests/contracts/phase-02-slice-09-vacuous-assertions.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-274]'],
    status: 'verified',
    limitation:
      "The 'without staging unrelated dirty work' clause is a process rule about a past reconciliation commit and has no executable proof; counts/mirrors are proven.",
  },
  {
    criterion: 'P2-S09-AC-275',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
      'tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-275]'],
    status: 'verified',
    limitation:
      'Process criterion, self-attested: the record test names the current IA03, deep dive, BE03a, BE03b, BE03c and FE03 sources with the line ranges re-read; the act of re-reading is self-attested.',
  },
  {
    criterion: 'P2-S09-AC-276',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    testFiles: ['tests/contracts/phase-02-slice-09-pre-traceability.test.ts'],
    testMarkers: ['[P2-S09-AC-276]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-277',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    testFiles: ['tests/contracts/phase-02-slice-09-pre-traceability.test.ts'],
    testMarkers: ['[P2-S09-AC-277]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-278',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-pre-structure.test.ts tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-pre-structure.test.ts',
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-278]'],
    status: 'verified',
    limitation:
      'Real exported schema proof: the pre-structure suite rejects ownerId, owner_id, createdBy and authUserId plus unknown fields on every browser resource and closed state enums; the cross-surface suite confirms states stay closed and aligned with worker contracts.',
  },
  {
    criterion: 'P2-S09-AC-279',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
      'tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-279]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-280',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-pre-reads.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-280]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-281',
    layer: 'repo',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial.test.ts tests/security/phase-02-slice-09-release-boundary.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-pre-browser.dom.test.tsx',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial.test.ts',
      'tests/security/phase-02-slice-09-release-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-281]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-282',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    testFiles: ['tests/contracts/phase-02-slice-09-pre-traceability.test.ts'],
    testMarkers: ['[P2-S09-AC-282]'],
    status: 'verified',
    limitation:
      "Owner-ratified DEC-124 (ledger row AC282): the exact 11-topic mapping to the owning slices' existing criteria is asserted by the pre-traceability guard; the transfer count of later-only topics is zero and the seven receiving criteria are Slice 11 AC046-AC048, Slice 12 AC051, AC052 and AC053, and Slice 16 AC029 (attribution table in the transfer record).",
  },
  {
    criterion: 'P2-S09-AC-283',
    layer: 'repo',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    testFiles: ['tests/contracts/phase-02-slice-09-pre-traceability.test.ts'],
    testMarkers: ['[P2-S09-AC-283]'],
    status: 'verified',
    limitation:
      'Test asserts the baseline arithmetic and that current per-slice counts sum to the declared phase total; the figure 283 strict S09 criteria is historical, the slice now carries more criteria through later amendments.',
  },
  {
    criterion: 'P2-S09-AC-284',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts tests/integration/phase-02-slice-09-registry-contract-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
      'tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts',
      'tests/integration/phase-02-slice-09-registry-contract-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-284]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-285',
    layer: 'contracts+db',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts; pnpm db:test',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
      'supabase/tests/phase_02_slice_09_f1_successor_locale.sql',
    ],
    testMarkers: ['[P2-S09-AC-285]'],
    status: 'verified',
    limitation:
      'Exact key set, both-null clone, both-present replace, half pair refused at /fallbackChains with the pair message, unknown and inherited-locale keys refused. | Clone and replace proven through the real producer chain and cms_create_schema_successor: both null keeps supportedLocales, fallbackChains and localeConfigHash; both present replaces them (stored sorted) with inherited sourceLocale and defaultLocale; a half pair is 422 and commits nothing.',
  },
  {
    criterion: 'P2-S09-AC-286',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-286]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-287',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-version-binding.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-version-binding.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-287]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-288',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-288]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-289',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-289]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-290',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-290]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-291',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-291]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-292',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-292]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-293',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-293]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-294',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_successor.sql'],
    testMarkers: ['[P2-S09-AC-294]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-295',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_successor.sql'],
    testMarkers: ['[P2-S09-AC-295]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-296',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_successor.sql'],
    testMarkers: ['[P2-S09-AC-296]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-297',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-297]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-298',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_successor.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms09_10.sql',
    ],
    testMarkers: ['[P2-S09-AC-298]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-299',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_cms09_10.sql'],
    testMarkers: ['[P2-S09-AC-299]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-300',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec108_successor.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms09_10.sql',
    ],
    testMarkers: ['[P2-S09-AC-300]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): DEC-122 (owner-ratified): same-actor changed body, path or version is 409 CONFLICT, a different actor is a distinct binding, both in the Worker (database-contract fake) and in pgTAP dec108_successor / evidence_cms09_10',
  },
  {
    criterion: 'P2-S09-AC-301',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_successor.sql',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-301]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): R5 (BE00 vs BE03a 409 details) ruled by the 2026-10-02 re-audit rulings and implemented: 409 carries conflict, recoveryAction and the two versions; evidence unchanged and green',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec108/012-concurrent-commands.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-302',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_cms09_10.sql'],
    testMarkers: ['[P2-S09-AC-302]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-303',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
      'supabase/tests/phase_02_slice_09_f1_cms_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-303]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): the per-party refusal now asserts Retry-After 43, the four RateLimit headers and the BE00 RATE_LIMITED details derived from the limiter window end (be03a-evidence-rate)',
  },
  {
    criterion: 'P2-S09-AC-304',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-304]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-305',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-305]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-306',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'supabase/tests/phase_02_slice_09_r8_error_details.sql',
    ],
    testMarkers: ['[P2-S09-AC-306]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): r8-db-errors: database FORBIDDEN with no detail answers 403 with exactly the registered reasonCode for the operation; a disclosed registered reasonCode is kept; r8_error_details pgTAP emits the reasonCode DETAIL per class',
  },
  {
    criterion: 'P2-S09-AC-307',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'supabase/tests/phase_02_slice_09_dec108_successor.sql',
    ],
    testMarkers: ['[P2-S09-AC-307]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-308',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'supabase/tests/phase_02_slice_09_dec108_successor.sql',
    ],
    testMarkers: ['[P2-S09-AC-308]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): in-isolate IDEMPOTENCY_CONFLICT cache removed; r8-db-errors (real RPC adapter + database-contract fake) asserts 409 CONFLICT for idempotency mismatch, stale version (VERSION_MISMATCH + both versions) and state conflict with the BE00 conflict/recoveryAction members; pgTAP r3_cms_error_rows asserts VERSION_MISMATCH',
  },
  {
    criterion: 'P2-S09-AC-309',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-309]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-310',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-validation-messages.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-validation-messages.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r14-locale-successor.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-310]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-311',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/web/src/server/content-schema-registry-platform-error-details.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts; pnpm db:test',
    testFiles: [
      'apps/web/src/server/content-schema-registry-platform-error-details.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
      'supabase/tests/phase_02_slice_09_f1_cms_rate_limit.sql',
      'tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-311]'],
    status: 'verified',
    limitation:
      'Fixed: Retry-After and details.retryAfterSeconds are the whole seconds from now to the limiter reset (never the hard-coded 5), details.resetAt is an RFC 3339 UTC string of that same instant, and the release routes use the same helper (route-rate-refusal.ts). A limiter decision whose reset cannot be rendered as an instant is refused as 502. The condition is produced through the real production limiter: the shared platform_api.auth_rate_limit is modelled by a fake PostgREST (fixed window keyed by operation id, bucket digest and window start; supabase/migrations/20261002160000_auth_rate_limit_mfa_operations.sql, counted in supabase/tests/authentication_foundation.sql). DOWNSTREAM: apps/web/src/server/content-schema-registry-platform-error-details.ts (and cms-composition-platform-*.ts) still read resetAt as a number and will drop the string; the web lane must accept the BE00 string.',
  },
  {
    criterion: 'P2-S09-AC-312',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-312]'],
    status: 'verified',
    limitation:
      'Condition produced, not told: the real production RPC adapter receives a non-conforming dependency response from the fake PostgREST (object missing every contract field, null, array, bare string) and the app answers 502 DEPENDENCY_UNAVAILABLE with only dependencyClass and retryable true. Worker half only: no database producer exists for this row, PostgREST is the faked external dependency.',
  },
  {
    criterion: 'P2-S09-AC-313',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-313]'],
    status: 'verified',
    limitation:
      'Produced through the production RPC adapter: a refused connection and an HTTP 503 each reach the wire as 503 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds } and no transport text. The details allowlist applies; Retry-After 5 is the adapter policy constant, not a limiter value.',
  },
  {
    criterion: 'P2-S09-AC-314',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-314]'],
    status: 'verified',
    limitation:
      'Produced, not stubbed: the registered deadline is made to elapse (25 ms) while the RPC hangs; the Worker aborts the RPC signal and answers 504 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds: 5 }. Retry-After on a 504 follows the existing adapter policy (BE00 says only 429 and retryable 503 carry Retry-After; not changed here, recorded in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-315',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r8_error_details.sql',
      'supabase/tests/phase_02_slice_09_schema/004-registries-and-rollback.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-315]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): unexpected thrown port failure is 500 INTERNAL_ERROR with a fixed message and no details, kept distinct from a dependency outage (503) and a deadline (504); the port is no longer told to return 500',
  },
  {
    criterion: 'P2-S09-AC-316',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-316]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-317',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-317]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-318',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-version-binding.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-version-binding.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-318]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-319',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-319]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-320',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-320]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-321',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-321]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-322',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_dry_run.sql',
      'supabase/tests/phase_02_slice_09_od4_locale_config.sql',
    ],
    testMarkers: ['[P2-S09-AC-322]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-323',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_dry_run.sql',
      'supabase/tests/phase_02_slice_09_scan_registry.sql',
    ],
    testMarkers: ['[P2-S09-AC-323]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-324',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-324]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-325',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-325]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-326',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-326]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-327',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-327]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-328',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-328]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-329',
    layer: 'worker+contracts',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-r2-validation-messages.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-validation-messages.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-329]'],
    status: 'verified',
    limitation:
      'Same wire fix as AC518; the transform-pair message reaches the client at /transformVersion.',
  },
  {
    criterion: 'P2-S09-AC-330',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_dry_run.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms09_10.sql',
      'supabase/tests/phase_02_slice_09_od4_locale_config.sql',
    ],
    testMarkers: ['[P2-S09-AC-330]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-331',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-331]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-332',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-332]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-333',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-333]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-334',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-334]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-335',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-335]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-336',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-336]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-337',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-337]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-338',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-338]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-339',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-339]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-340',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-340]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-341',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_cms09_10.sql'],
    testMarkers: ['[P2-S09-AC-341]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-342',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_dry_run.sql'],
    testMarkers: ['[P2-S09-AC-342]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-343',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_dry_run.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms09_10.sql',
    ],
    testMarkers: ['[P2-S09-AC-343]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-344',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_dry_run.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms09_10.sql',
    ],
    testMarkers: ['[P2-S09-AC-344]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-345',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_dry_run.sql'],
    testMarkers: ['[P2-S09-AC-345]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-346',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_dry_run.sql'],
    testMarkers: ['[P2-S09-AC-346]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-347',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_dry_run.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms09_10.sql',
    ],
    testMarkers: ['[P2-S09-AC-347]'],
    status: 'verified',
    limitation:
      'Real defect fixed with a forward migration: CMS-03A-10 superseded running/verifying/failed_retryable plans; migration 20261002177000 refuses with 409 while the scanned source is unchanged (drift stays the one recovery). RED before the migration (six failing assertions), GREEN after.',
  },
  {
    criterion: 'P2-S09-AC-348',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_dry_run.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms09_10.sql',
    ],
    testMarkers: ['[P2-S09-AC-348]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-349',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-349]'],
    status: 'verified',
    limitation:
      'The per-operation keying test now goes through the real stack (CMS limiter adapter, real authentication limiter adapter and its real bucket-key builder) over one shared counter model, so a sibling operation can fail. Mutation-checked: replacing the limiter input operationId with a constant fails 19 of the 80 tests in the rate file; routing the user bucket through the client scope fails 10; hard-coding Retry-After fails 20. The user bucket is keyed by the authenticated user, not by client address (alternating cf-connecting-ip still exhausts it). The platform_api.auth_rate_limit counting itself is modelled, not run (pgTAP: authentication_foundation.sql; a CMS-operation-id bucket assertion is listed under needs-db in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-350',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-350]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-351',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-351]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-352',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-352]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): r8-db-errors: database FORBIDDEN with no detail answers 403 with exactly the registered reasonCode for the operation; a disclosed registered reasonCode is kept; r8_error_details pgTAP emits the reasonCode DETAIL per class',
  },
  {
    criterion: 'P2-S09-AC-353',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-353]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-354',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'supabase/tests/phase_02_slice_09_dec108_dry_run.sql',
    ],
    testMarkers: ['[P2-S09-AC-354]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): in-isolate IDEMPOTENCY_CONFLICT cache removed; r8-db-errors (real RPC adapter + database-contract fake) asserts 409 CONFLICT for idempotency mismatch, stale version (VERSION_MISMATCH + both versions) and state conflict with the BE00 conflict/recoveryAction members; pgTAP r3_cms_error_rows asserts VERSION_MISMATCH',
  },
  {
    criterion: 'P2-S09-AC-355',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-355]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-356',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_evidence_misc.sql',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-356]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-124 (ledger row AC356): caller-supplied counts, hashes and classifications are unknown keys refused as 400 INVALID_REQUEST in the database (evidence_misc) and on the wire, while a registry or transform failure, an inconsistent transform pair and an underivable classification stay 422 (evidence_misc, r3_cms_error_rows, be03a-evidence-errors, r2-wire-details).',
  },
  {
    criterion: 'P2-S09-AC-357',
    layer: 'worker+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
      'supabase/tests/phase_02_slice_09_f1_cms_rate_limit.sql',
      'tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-357]'],
    status: 'verified',
    limitation:
      "Condition produced, not told: the real Hono app, CMS limiter and authentication limiter adapter run against a fake PostgREST that answers platform_api.auth_rate_limit with the database decision shape; the per-user limit is exhausted by real requests and the next request is refused with 429 before any CMS RPC. Only PostgREST (the external dependency) is faked. | Database half: the per-user and per-party bucket refusal of platform_api.auth_rate_limit under the Worker fallback operation id AUTH-API-15 with this route's limit and 60-second window; the HTTP status, envelope and headers are the Worker half.",
  },
  {
    criterion: 'P2-S09-AC-358',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-358]'],
    status: 'verified',
    limitation:
      'Condition produced, not told: the real production RPC adapter receives a non-conforming dependency response from the fake PostgREST (object missing every contract field, null, array, bare string) and the app answers 502 DEPENDENCY_UNAVAILABLE with only dependencyClass and retryable true. Worker half only: no database producer exists for this row, PostgREST is the faked external dependency.',
  },
  {
    criterion: 'P2-S09-AC-359',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
      'supabase/tests/phase_02_slice_09_r3_activation_gates.sql',
    ],
    testMarkers: ['[P2-S09-AC-359]'],
    status: 'verified',
    limitation:
      'The 503 wire mapping of the raised database error is the Worker half (already proven by the Worker lane); this proves the database side: the raise and the complete rollback.',
  },
  {
    criterion: 'P2-S09-AC-360',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-360]'],
    status: 'verified',
    limitation:
      'Produced, not stubbed: the registered deadline is made to elapse (25 ms) while the RPC hangs; the Worker aborts the RPC signal and answers 504 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds: 5 }. Retry-After on a 504 follows the existing adapter policy (BE00 says only 429 and retryable 503 carry Retry-After; not changed here, recorded in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-361',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-361]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): unexpected thrown port failure is 500 INTERNAL_ERROR with a fixed message and no details, kept distinct from a dependency outage (503) and a deadline (504); the port is no longer told to return 500',
  },
  {
    criterion: 'P2-S09-AC-362',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-362]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-363',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-363]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-364',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-version-binding.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-version-binding.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-364]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-365',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-365]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-366',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_submit.sql',
      'supabase/tests/phase_02_slice_09_r3_activation_gates.sql',
    ],
    testMarkers: ['[P2-S09-AC-366]'],
    status: 'verified',
    limitation:
      'The audit entry suggested 422 VALIDATION_FAILED for a reference that is not a passed immutable run; BE03a error matrix (CMS-03A-11) lists CONFLICT for a non-passed dry run and the implementation answers CONFLICT for unknown/foreign references too, so the assertions pin the spec/implementation behaviour.',
  },
  {
    criterion: 'P2-S09-AC-367',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-367]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-368',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-368]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-369',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-369]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-370',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-370]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-371',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-371]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-372',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_submit.sql'],
    testMarkers: ['[P2-S09-AC-372]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-373',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
      'supabase/tests/phase_02_slice_09_dec108_submit.sql',
    ],
    testMarkers: ['[P2-S09-AC-373]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-374',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-374]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-375',
    layer: 'contracts',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-375]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-376',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-376]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-377',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-377]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-378',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-r2-contract-evidence.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-r2-contract-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-378]'],
    status: 'verified',
    limitation:
      'Both directions of the XOR are asserted: an open review with a hash and an approved review with a null hash each report the exact message at approvalEvidenceHash, and consistent reviews report none.',
  },
  {
    criterion: 'P2-S09-AC-379',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-r2-contract-evidence.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-r2-contract-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-379]'],
    status: 'verified',
    limitation:
      'Both directions of the XOR are asserted for decidedAt (open with a value, approved with null) with the exact message and path, plus the consistent control.',
  },
  {
    criterion: 'P2-S09-AC-380',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-380]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-381',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-381]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-382',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-382]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-383',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_submit.sql'],
    testMarkers: ['[P2-S09-AC-383]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-384',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_submit.sql'],
    testMarkers: ['[P2-S09-AC-384]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-385',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_reviews_schema.sql',
      'supabase/tests/phase_02_slice_09_dec108_submit.sql',
    ],
    testMarkers: ['[P2-S09-AC-385]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-386',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_assignment.sql',
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
    ],
    testMarkers: ['[P2-S09-AC-386]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-387',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_submit.sql'],
    testMarkers: ['[P2-S09-AC-387]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-388',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_submit.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms11_14.sql',
    ],
    testMarkers: ['[P2-S09-AC-388]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-389',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_cms11_14.sql'],
    testMarkers: ['[P2-S09-AC-389]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-390',
    layer: 'db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-r12-successor-workflow.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-r12-successor-workflow.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r12-successor-workflow.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-r12-successor-workflow.test.ts',
      'supabase/tests/phase_02_slice_09_dec108_submit.sql',
      'supabase/tests/phase_02_slice_09_r12_successor_workflow.sql',
    ],
    testMarkers: ['[P2-S09-AC-390]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-126 (ledger row AC390): CMS-03A-09 accepts the optional workflowKey and workflowVersion pair (both null or absent keep the source member, both present replace it with a seeded registry member, 422 otherwise, hashed into the definition); the strictest-of review keeps the protected count and specialist slot under the real producers (dec108_submit, r12_successor_workflow); contract, Worker admission and BE03a agree. The successor form exposes no control for the pair (API-only).',
  },
  {
    criterion: 'P2-S09-AC-391',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-391]'],
    status: 'verified',
    limitation:
      'AC391 was WEAK because the sibling check used a fresh store. The per-operation keying test now goes through the real stack (CMS limiter adapter, real authentication limiter adapter and its real bucket-key builder) over one shared counter model, so a sibling operation can fail. Mutation-checked: replacing the limiter input operationId with a constant fails 19 of the 80 tests in the rate file; routing the user bucket through the client scope fails 10; hard-coding Retry-After fails 20. The user bucket is keyed by the authenticated user, not by client address (alternating cf-connecting-ip still exhausts it). The platform_api.auth_rate_limit counting itself is modelled, not run (pgTAP: authentication_foundation.sql; a CMS-operation-id bucket assertion is listed under needs-db in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-392',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-392]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-393',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-393]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-394',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-394]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): r8-db-errors: database FORBIDDEN with no detail answers 403 with exactly the registered reasonCode for the operation; a disclosed registered reasonCode is kept; r8_error_details pgTAP emits the reasonCode DETAIL per class',
  },
  {
    criterion: 'P2-S09-AC-395',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-395]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-396',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'supabase/tests/phase_02_slice_09_dec108_submit.sql',
    ],
    testMarkers: ['[P2-S09-AC-396]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): in-isolate IDEMPOTENCY_CONFLICT cache removed; r8-db-errors (real RPC adapter + database-contract fake) asserts 409 CONFLICT for idempotency mismatch, stale version (VERSION_MISMATCH + both versions) and state conflict with the BE00 conflict/recoveryAction members; pgTAP r3_cms_error_rows asserts VERSION_MISMATCH',
  },
  {
    criterion: 'P2-S09-AC-397',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-397]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-398',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_dec108_submit.sql',
    ],
    testMarkers: ['[P2-S09-AC-398]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-399',
    layer: 'worker+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
      'supabase/tests/phase_02_slice_09_f1_cms_rate_limit.sql',
      'tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-399]'],
    status: 'verified',
    limitation:
      "Condition produced, not told: the real Hono app, CMS limiter and authentication limiter adapter run against a fake PostgREST that answers platform_api.auth_rate_limit with the database decision shape; the per-user limit is exhausted by real requests and the next request is refused with 429 before any CMS RPC. Only PostgREST (the external dependency) is faked. | Database half: the per-user and per-party bucket refusal of platform_api.auth_rate_limit under the Worker fallback operation id AUTH-API-15 with this route's limit and 60-second window; the HTTP status, envelope and headers are the Worker half.",
  },
  {
    criterion: 'P2-S09-AC-400',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-400]'],
    status: 'verified',
    limitation:
      'Condition produced, not told: the real production RPC adapter receives a non-conforming dependency response from the fake PostgREST (object missing every contract field, null, array, bare string) and the app answers 502 DEPENDENCY_UNAVAILABLE with only dependencyClass and retryable true. Worker half only: no database producer exists for this row, PostgREST is the faked external dependency.',
  },
  {
    criterion: 'P2-S09-AC-401',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-401]'],
    status: 'verified',
    limitation:
      'Produced through the production RPC adapter: a refused connection and an HTTP 503 each reach the wire as 503 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds } and no transport text. The details allowlist applies; Retry-After 5 is the adapter policy constant, not a limiter value.',
  },
  {
    criterion: 'P2-S09-AC-402',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-402]'],
    status: 'verified',
    limitation:
      'Produced, not stubbed: the registered deadline is made to elapse (25 ms) while the RPC hangs; the Worker aborts the RPC signal and answers 504 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds: 5 }. Retry-After on a 504 follows the existing adapter policy (BE00 says only 429 and retryable 503 carry Retry-After; not changed here, recorded in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-403',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-403]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): unexpected thrown port failure is 500 INTERNAL_ERROR with a fixed message and no details, kept distinct from a dependency outage (503) and a deadline (504); the port is no longer told to return 500',
  },
  {
    criterion: 'P2-S09-AC-404',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-404]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-405',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-405]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-406',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-version-binding.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-version-binding.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-406]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-407',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-407]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-408',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-408]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-409',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-409]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-410',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-410]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-411',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-411]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-412',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-412]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-413',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_decision.sql'],
    testMarkers: ['[P2-S09-AC-413]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-414',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
      'supabase/tests/phase_02_slice_09_r3_rls_session_scope.sql',
      'supabase/tests/phase_02_slice_09_r8_review_owner_consistency.sql',
    ],
    testMarkers: ['[P2-S09-AC-414]'],
    status: 'verified',
    limitation:
      'R6-db finding 1_reviewer_rls: RED 14 failed of 57; GREEN 59/59.',
  },
  {
    criterion: 'P2-S09-AC-415',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_decision.sql'],
    testMarkers: ['[P2-S09-AC-415]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-416',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms11_14.sql',
      'supabase/tests/phase_02_slice_09_r3_rls_session_scope.sql',
    ],
    testMarkers: ['[P2-S09-AC-416]'],
    status: 'verified',
    limitation:
      'R6-db finding 1_reviewer_rls: RED 14 failed of 57; GREEN 59/59.',
  },
  {
    criterion: 'P2-S09-AC-417',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_cms11_14.sql'],
    testMarkers: ['[P2-S09-AC-417]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-418',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
      'supabase/tests/phase_02_slice_09_dec108_reviews_schema.sql',
    ],
    testMarkers: ['[P2-S09-AC-418]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-419',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_decision.sql'],
    testMarkers: ['[P2-S09-AC-419]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-420',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_decision.sql'],
    testMarkers: ['[P2-S09-AC-420]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-421',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
      'supabase/tests/phase_02_slice_09_r3_recent_mfa.sql',
    ],
    testMarkers: ['[P2-S09-AC-421]'],
    status: 'verified',
    limitation:
      'The step-up proof is the service-role envelope context.stepUpVerified/stepUpAt (Worker-verified aal2 proof); the DB re-checks -30 s <= now - stepUpAt <= 600 s and records that instant. The binding heartbeat (10 minutes) is kept only as a separate binding-liveness check, asserted by "a dead binding heartbeat is refused ... (binding liveness stays separate)". The DB cannot independently verify the aal2 token signature; that remains the Worker verifier.',
  },
  {
    criterion: 'P2-S09-AC-422',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_decision.sql'],
    testMarkers: ['[P2-S09-AC-422]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-423',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms11_14.sql',
    ],
    testMarkers: ['[P2-S09-AC-423]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-424',
    layer: 'contracts+db',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-race-runner-gate.test.ts',
    testFiles: ['tests/contracts/phase-02-slice-09-race-runner-gate.test.ts'],
    testMarkers: ['[P2-S09-AC-424]'],
    status: 'verified',
    limitation:
      'The gate test runs under pnpm validate (vitest): it proves every .mjs independent-session runner under supabase/tests is listed in infra/run-database-race-runners.mjs, that db:verify (which db:ci and CI run) runs pnpm db:races after pnpm db:test, and that a runner passes only on exit code 0 with at least one ok assertion. | Runs against the disposable local database: resets before each runner and once at the end. The runner holds the first command uncommitted, proves the second is blocked on a PostgreSQL lock, then the typed 409 and exactly one effect.',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec108/012-concurrent-commands.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-425',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_decision.sql'],
    testMarkers: ['[P2-S09-AC-425]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-426',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms11_14.sql',
    ],
    testMarkers: ['[P2-S09-AC-426]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-427',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms11_14.sql',
    ],
    testMarkers: ['[P2-S09-AC-427]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-428',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-428]'],
    status: 'verified',
    limitation:
      'The per-operation keying test now goes through the real stack (CMS limiter adapter, real authentication limiter adapter and its real bucket-key builder) over one shared counter model, so a sibling operation can fail. Mutation-checked: replacing the limiter input operationId with a constant fails 19 of the 80 tests in the rate file; routing the user bucket through the client scope fails 10; hard-coding Retry-After fails 20. The user bucket is keyed by the authenticated user, not by client address (alternating cf-connecting-ip still exhausts it). The platform_api.auth_rate_limit counting itself is modelled, not run (pgTAP: authentication_foundation.sql; a CMS-operation-id bucket assertion is listed under needs-db in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-429',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-429]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-430',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r12-expired-session.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r12-expired-session.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-430]'],
    status: 'verified',
    limitation:
      'r12 expired-session test wires the real production authentication and CMS dependencies: an access token past exp, a provider 401, a missing cookie and a resolved expiry in the past each answer 401 UNAUTHENTICATED with no CMS RPC and no rate bucket, and an unexpired control reaches step-up; two production defects were fixed (an expired token was 502 PROVIDER_INVALID_RESPONSE, and an auth 401 reached the wire without the BE00 recoveryAction reauthenticate detail).',
  },
  {
    criterion: 'P2-S09-AC-431',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_evidence_cms11_14.sql',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'supabase/tests/phase_02_slice_09_r8_error_details.sql',
      'supabase/tests/phase_02_slice_09_r8_review_owner_consistency.sql',
    ],
    testMarkers: ['[P2-S09-AC-431]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-124 (ledger row AC431): a review readable through submitter or schema-designer scope whose caller holds no effective assignment is 403 FORBIDDEN with its registered reasonCode, a cross-owner review is a concealed 404, and the database FORBIDDEN reaches the wire with exactly the four envelope fields (r3_cms_error_rows, r8_error_details, evidence_cms11_14, r8_review_owner_consistency, f1-429-502-rows, r8-db-errors).',
  },
  {
    criterion: 'P2-S09-AC-432',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-432]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-433',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
    ],
    testMarkers: ['[P2-S09-AC-433]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): in-isolate IDEMPOTENCY_CONFLICT cache removed; r8-db-errors (real RPC adapter + database-contract fake) asserts 409 CONFLICT for idempotency mismatch, stale version (VERSION_MISMATCH + both versions) and state conflict with the BE00 conflict/recoveryAction members; pgTAP r3_cms_error_rows asserts VERSION_MISMATCH',
  },
  {
    criterion: 'P2-S09-AC-434',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-434]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-435',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-435]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-436',
    layer: 'worker+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
      'supabase/tests/phase_02_slice_09_f1_cms_rate_limit.sql',
      'tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-436]'],
    status: 'verified',
    limitation:
      "Condition produced, not told: the real Hono app, CMS limiter and authentication limiter adapter run against a fake PostgREST that answers platform_api.auth_rate_limit with the database decision shape; the per-user limit is exhausted by real requests and the next request is refused with 429 before any CMS RPC. Only PostgREST (the external dependency) is faked. | Database half: the per-user and per-party bucket refusal of platform_api.auth_rate_limit under the Worker fallback operation id AUTH-API-15 with this route's limit and 60-second window; the HTTP status, envelope and headers are the Worker half.",
  },
  {
    criterion: 'P2-S09-AC-437',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-437]'],
    status: 'verified',
    limitation:
      'Condition produced, not told: the real production RPC adapter receives a non-conforming dependency response from the fake PostgREST (object missing every contract field, null, array, bare string) and the app answers 502 DEPENDENCY_UNAVAILABLE with only dependencyClass and retryable true. Worker half only: no database producer exists for this row, PostgREST is the faked external dependency.',
  },
  {
    criterion: 'P2-S09-AC-438',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-438]'],
    status: 'verified',
    limitation:
      'Produced through the production RPC adapter: a refused connection and an HTTP 503 each reach the wire as 503 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds } and no transport text. The details allowlist applies; Retry-After 5 is the adapter policy constant, not a limiter value.',
  },
  {
    criterion: 'P2-S09-AC-439',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-439]'],
    status: 'verified',
    limitation:
      'Produced, not stubbed: the registered deadline is made to elapse (25 ms) while the RPC hangs; the Worker aborts the RPC signal and answers 504 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds: 5 }. Retry-After on a 504 follows the existing adapter policy (BE00 says only 429 and retryable 503 carry Retry-After; not changed here, recorded in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-440',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-440]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): unexpected thrown port failure is 500 INTERNAL_ERROR with a fixed message and no details, kept distinct from a dependency outage (503) and a deadline (504); the port is no longer told to return 500',
  },
  {
    criterion: 'P2-S09-AC-441',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts tests/security/phase-02-slice-09-aal2-cms-step-up-gates.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'tests/security/phase-02-slice-09-aal2-cms-step-up-gates.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-441]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): sessionStepUpAt requires token aal2 plus a valid MFA amr: aal1, aal2 without MFA amr, missing aal and amr-less tokens are 401 STEP_UP_REQUIRED with no effect, on AUTH-API-17/19 (r8-aal-proof) and the CMS and CFG-05B routes through real composition (aal2-cms-step-up-gates, r8-aal-gates)',
  },
  {
    criterion: 'P2-S09-AC-442',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-442]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-443',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-443]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-444',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-444]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-445',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-445]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-446',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-446]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-447',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
      'supabase/tests/phase_02_slice_09_dec108_review_read.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms11_14.sql',
    ],
    testMarkers: ['[P2-S09-AC-447]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-448',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-448]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-449',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_cms11_14.sql'],
    testMarkers: ['[P2-S09-AC-449]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-450',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-450]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-451',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_review_read.sql'],
    testMarkers: ['[P2-S09-AC-451]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-452',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_review_read.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms11_14.sql',
    ],
    testMarkers: ['[P2-S09-AC-452]'],
    status: 'verified',
    limitation:
      'Real defect fixed with a forward migration: the detail returned a concealed 404 to a confirmed member of the owning party lacking the capability; migration 20261002178000 makes it 403 FORBIDDEN while absent/cross-owner/out-of-party stays 404. RED before the migration (have NOT_FOUND, want FORBIDDEN), GREEN after.',
  },
  {
    criterion: 'P2-S09-AC-453',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_review_read.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms11_14.sql',
    ],
    testMarkers: ['[P2-S09-AC-453]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-454',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
      'supabase/tests/phase_02_slice_09_f1_cms_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-454]'],
    status: 'verified',
    limitation:
      'The per-operation keying test now goes through the real stack (CMS limiter adapter, real authentication limiter adapter and its real bucket-key builder) over one shared counter model, so a sibling operation can fail. Mutation-checked: replacing the limiter input operationId with a constant fails 19 of the 80 tests in the rate file; routing the user bucket through the client scope fails 10; hard-coding Retry-After fails 20. The user bucket is keyed by the authenticated user, not by client address (alternating cf-connecting-ip still exhausts it). The platform_api.auth_rate_limit counting itself is modelled, not run (pgTAP: authentication_foundation.sql; a CMS-operation-id bucket assertion is listed under needs-db in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-455',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-455]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-456',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-456]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-457',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_evidence_cms11_14.sql',
    ],
    testMarkers: ['[P2-S09-AC-457]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): real DB FORBIDDEN reaches the wire with a registered reasonCode; the reasonCode a database discloses is kept and an unregistered one never echoed',
  },
  {
    criterion: 'P2-S09-AC-458',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-458]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-459',
    layer: 'worker+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
      'supabase/tests/phase_02_slice_09_f1_cms_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-459]'],
    status: 'verified',
    limitation:
      "Condition produced, not told: the real Hono app, CMS limiter and authentication limiter adapter run against a fake PostgREST that answers platform_api.auth_rate_limit with the database decision shape; the per-user limit is exhausted by real requests and the next request is refused with 429 before any CMS RPC. Only PostgREST (the external dependency) is faked. | Database half: the per-user and per-party bucket refusal of platform_api.auth_rate_limit under the Worker fallback operation id AUTH-API-15 with this route's limit and 60-second window; the HTTP status, envelope and headers are the Worker half.",
  },
  {
    criterion: 'P2-S09-AC-460',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-460]'],
    status: 'verified',
    limitation:
      'Condition produced, not told: the real production RPC adapter receives a non-conforming dependency response from the fake PostgREST (object missing every contract field, null, array, bare string) and the app answers 502 DEPENDENCY_UNAVAILABLE with only dependencyClass and retryable true. Worker half only: no database producer exists for this row, PostgREST is the faked external dependency.',
  },
  {
    criterion: 'P2-S09-AC-461',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-461]'],
    status: 'verified',
    limitation:
      'Produced through the production RPC adapter: a refused connection and an HTTP 503 each reach the wire as 503 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds } and no transport text. The details allowlist applies; Retry-After 5 is the adapter policy constant, not a limiter value.',
  },
  {
    criterion: 'P2-S09-AC-462',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-462]'],
    status: 'verified',
    limitation:
      'Produced, not stubbed: the registered deadline is made to elapse (25 ms) while the RPC hangs; the Worker aborts the RPC signal and answers 504 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds: 5 }. Retry-After on a 504 follows the existing adapter policy (BE00 says only 429 and retryable 503 carry Retry-After; not changed here, recorded in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-463',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-463]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): unexpected thrown port failure is 500 INTERNAL_ERROR with a fixed message and no details, kept distinct from a dependency outage (503) and a deadline (504); the port is no longer told to return 500',
  },
  {
    criterion: 'P2-S09-AC-464',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-464]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-465',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-465]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-466',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-466]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-467',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-version-binding.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-version-binding.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-467]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-468',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-468]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-469',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_assignment.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms11_14.sql',
    ],
    testMarkers: ['[P2-S09-AC-469]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-470',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-470]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-471',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_assignment.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms11_14.sql',
    ],
    testMarkers: ['[P2-S09-AC-471]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-472',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_assignment.sql'],
    testMarkers: ['[P2-S09-AC-472]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-473',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-473]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-474',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_cms11_14.sql'],
    testMarkers: ['[P2-S09-AC-474]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-475',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-475]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-476',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-fields.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-476]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-477',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-477]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-478',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-478]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-479',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-479]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-480',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-480]'],
    status: 'verified',
    limitation:
      'The header grammar is isolated from the body-binding rule by the envelope message: only the header grammar answers "A valid strong If-Match version is required."; the binding rule answers "expectedVersion must equal the If-Match version.". Mutation-checked: allowing "0" in CmsStrongEtagSchema fails 7 tests. Unquoted, weak, missing, zero, leading-zero, negative, decimal, signed, space and exponent forms are covered; the 2^63-1 boundary is accepted and forwarded as expectedVersion to the RPC.',
  },
  {
    criterion: 'P2-S09-AC-481',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-481]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-482',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-482]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-483',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-483]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-484',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_assignment.sql',
      'supabase/tests/phase_02_slice_09_r3_recent_mfa.sql',
    ],
    testMarkers: ['[P2-S09-AC-484]'],
    status: 'verified',
    limitation:
      'The step-up proof is the service-role envelope context.stepUpVerified/stepUpAt (Worker-verified aal2 proof); the DB re-checks -30 s <= now - stepUpAt <= 600 s and records that instant. The binding heartbeat (10 minutes) is kept only as a separate binding-liveness check, asserted by "a dead binding heartbeat is refused ... (binding liveness stays separate)". The DB cannot independently verify the aal2 token signature; that remains the Worker verifier.',
  },
  {
    criterion: 'P2-S09-AC-485',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_assignment.sql'],
    testMarkers: ['[P2-S09-AC-485]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-486',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_assignment.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms11_14.sql',
    ],
    testMarkers: ['[P2-S09-AC-486]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-487',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_assignment.sql'],
    testMarkers: ['[P2-S09-AC-487]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-488',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_assignment.sql'],
    testMarkers: ['[P2-S09-AC-488]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-489',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_assignment.sql',
      'supabase/tests/phase_02_slice_09_evidence_cms11_14.sql',
      'supabase/tests/phase_02_slice_09_r8_assignment_revoke_evidence.sql',
    ],
    testMarkers: ['[P2-S09-AC-489]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-db): r8_assignment_revoke_evidence: a successful revoke commits exactly one audit and one outbox row, refusals and replay none',
  },
  {
    criterion: 'P2-S09-AC-490',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-490]'],
    status: 'verified',
    limitation:
      'The per-operation keying test now goes through the real stack (CMS limiter adapter, real authentication limiter adapter and its real bucket-key builder) over one shared counter model, so a sibling operation can fail. Mutation-checked: replacing the limiter input operationId with a constant fails 19 of the 80 tests in the rate file; routing the user bucket through the client scope fails 10; hard-coding Retry-After fails 20. The user bucket is keyed by the authenticated user, not by client address (alternating cf-connecting-ip still exhausts it). The platform_api.auth_rate_limit counting itself is modelled, not run (pgTAP: authentication_foundation.sql; a CMS-operation-id bucket assertion is listed under needs-db in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-491',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-491]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-492',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-492]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-493',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'supabase/tests/phase_02_slice_09_r8_error_details.sql',
    ],
    testMarkers: ['[P2-S09-AC-493]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): r8-db-errors: database FORBIDDEN with no detail answers 403 with exactly the registered reasonCode for the operation; a disclosed registered reasonCode is kept; r8_error_details pgTAP emits the reasonCode DETAIL per class',
  },
  {
    criterion: 'P2-S09-AC-494',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-494]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-495',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'supabase/tests/phase_02_slice_09_dec108_assignment.sql',
    ],
    testMarkers: ['[P2-S09-AC-495]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): in-isolate IDEMPOTENCY_CONFLICT cache removed; r8-db-errors (real RPC adapter + database-contract fake) asserts 409 CONFLICT for idempotency mismatch, stale version (VERSION_MISMATCH + both versions) and state conflict with the BE00 conflict/recoveryAction members; pgTAP r3_cms_error_rows asserts VERSION_MISMATCH',
  },
  {
    criterion: 'P2-S09-AC-496',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-496]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-497',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-497]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-498',
    layer: 'worker+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
      'supabase/tests/phase_02_slice_09_f1_cms_rate_limit.sql',
      'tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-498]'],
    status: 'verified',
    limitation:
      "Condition produced, not told: the real Hono app, CMS limiter and authentication limiter adapter run against a fake PostgREST that answers platform_api.auth_rate_limit with the database decision shape; the per-user limit is exhausted by real requests and the next request is refused with 429 before any CMS RPC. Only PostgREST (the external dependency) is faked. | Database half: the per-user and per-party bucket refusal of platform_api.auth_rate_limit under the Worker fallback operation id AUTH-API-15 with this route's limit and 60-second window; the HTTP status, envelope and headers are the Worker half.",
  },
  {
    criterion: 'P2-S09-AC-499',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-499]'],
    status: 'verified',
    limitation:
      'Condition produced, not told: the real production RPC adapter receives a non-conforming dependency response from the fake PostgREST (object missing every contract field, null, array, bare string) and the app answers 502 DEPENDENCY_UNAVAILABLE with only dependencyClass and retryable true. Worker half only: no database producer exists for this row, PostgREST is the faked external dependency.',
  },
  {
    criterion: 'P2-S09-AC-500',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-500]'],
    status: 'verified',
    limitation:
      'Produced through the production RPC adapter: a refused connection and an HTTP 503 each reach the wire as 503 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds } and no transport text. The details allowlist applies; Retry-After 5 is the adapter policy constant, not a limiter value.',
  },
  {
    criterion: 'P2-S09-AC-501',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-501]'],
    status: 'verified',
    limitation:
      'Produced, not stubbed: the registered deadline is made to elapse (25 ms) while the RPC hangs; the Worker aborts the RPC signal and answers 504 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds: 5 }. Retry-After on a 504 follows the existing adapter policy (BE00 says only 429 and retryable 503 carry Retry-After; not changed here, recorded in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-502',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-502]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): unexpected thrown port failure is 500 INTERNAL_ERROR with a fixed message and no details, kept distinct from a dependency outage (503) and a deadline (504); the port is no longer told to return 500',
  },
  {
    criterion: 'P2-S09-AC-503',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts tests/security/phase-02-slice-09-aal2-cms-step-up-gates.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'tests/security/phase-02-slice-09-aal2-cms-step-up-gates.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-503]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): sessionStepUpAt requires token aal2 plus a valid MFA amr: aal1, aal2 without MFA amr, missing aal and amr-less tokens are 401 STEP_UP_REQUIRED with no effect, on AUTH-API-17/19 (r8-aal-proof) and the CMS and CFG-05B routes through real composition (aal2-cms-step-up-gates, r8-aal-gates)',
  },
  {
    criterion: 'P2-S09-AC-504',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-504]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-505',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-505]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-506',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-506]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-507',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec119_future_membership.sql',
      'supabase/tests/phase_02_slice_09_dec119_grant_command.sql',
      'supabase/tests/phase_02_slice_09_evidence_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-507]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-508',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-508]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-509',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-509]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-510',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_command.sql'],
    testMarkers: ['[P2-S09-AC-510]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-511',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-511]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-512',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_command.sql'],
    testMarkers: ['[P2-S09-AC-512]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-513',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_command.sql'],
    testMarkers: ['[P2-S09-AC-513]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-514',
    layer: 'db+contracts+b+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-r2-contract-evidence.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-r2-contract-evidence.test.ts',
      'supabase/tests/phase_02_slice_09_dec119_grant_command.sql',
    ],
    testMarkers: ['[P2-S09-AC-514]'],
    status: 'verified',
    limitation:
      'Renew and revoke share cms_grant_reason; the boundary is asserted through grant only plus the shared table CHECK.',
  },
  {
    criterion: 'P2-S09-AC-515',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-515]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-516',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-516]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-517',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-517]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-518',
    layer: 'worker+contracts',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-r2-validation-messages.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-validation-messages.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-518]'],
    status: 'verified',
    limitation:
      'Fixed in admission-common.ts issues(): a custom (refine/superRefine) issue travels as {pointer,message} with the exact server-owned text; a lowercase constraint code authored in the contract travels as the violation code with the generic message; built-in zod text is never sent because it can echo input. Previously the wire carried only {message:"The value is invalid."} with no pointer. The contract-level message is also asserted in packages/contracts phase-02-slice-09-be03a-evidence-messages.test.ts.',
  },
  {
    criterion: 'P2-S09-AC-519',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-messages.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-519]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-520',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec119_grant_command.sql',
      'supabase/tests/phase_02_slice_09_dec119_grant_list.sql',
    ],
    testMarkers: ['[P2-S09-AC-520]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-521',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_command.sql'],
    testMarkers: ['[P2-S09-AC-521]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-522',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec119_grant_command.sql',
      'supabase/tests/phase_02_slice_09_dec119_grant_list.sql',
      'supabase/tests/phase_02_slice_09_evidence_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-522]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-523',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec119_grant_command.sql',
      'supabase/tests/phase_02_slice_09_r3_recent_mfa.sql',
      'supabase/tests/phase_02_slice_09_r8_grant_owner_without_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-523]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-db): r8_grant_owner_without_grants: every owner grant lapsed, the owner holds none of the 14 capabilities and still grants; a non-owner is refused',
  },
  {
    criterion: 'P2-S09-AC-524',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_command.sql'],
    testMarkers: ['[P2-S09-AC-524]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-525',
    layer: 'contracts',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-capability-registry-consistency.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-capability-registry-consistency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-525]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-526',
    layer: 'contracts',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-capability-registry-consistency.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-capability-registry-consistency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-526]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-527',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec119_grant_command.sql',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r14-renew-direction.test.ts',
      'apps/web/src/server/content-schema-registry-platform-error-details.test.ts',
      'tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-527]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): R5 (BE00 vs BE03a 409 details) ruled by the 2026-10-02 re-audit rulings and implemented: 409 carries conflict, recoveryAction and the two versions; evidence unchanged and green',
  },
  {
    criterion: 'P2-S09-AC-528',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql'],
    testMarkers: ['[P2-S09-AC-528]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-529',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql'],
    testMarkers: ['[P2-S09-AC-529]'],
    status: 'verified',
    limitation:
      'Proved by the two-session runner 012-concurrent-commands.mjs (right after pnpm db:reset).',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec108/012-concurrent-commands.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-530',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_command.sql'],
    testMarkers: ['[P2-S09-AC-530]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): R5 (BE00 vs BE03a 409 details) ruled by the 2026-10-02 re-audit rulings and implemented: 409 carries conflict, recoveryAction and the two versions; evidence unchanged and green',
  },
  {
    criterion: 'P2-S09-AC-531',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_command.sql'],
    testMarkers: ['[P2-S09-AC-531]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-532',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-532]'],
    status: 'verified',
    limitation:
      'The per-operation keying test now goes through the real stack (CMS limiter adapter, real authentication limiter adapter and its real bucket-key builder) over one shared counter model, so a sibling operation can fail. Mutation-checked: replacing the limiter input operationId with a constant fails 19 of the 80 tests in the rate file; routing the user bucket through the client scope fails 10; hard-coding Retry-After fails 20. The user bucket is keyed by the authenticated user, not by client address (alternating cf-connecting-ip still exhausts it). The platform_api.auth_rate_limit counting itself is modelled, not run (pgTAP: authentication_foundation.sql; a CMS-operation-id bucket assertion is listed under needs-db in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-533',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-533]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-534',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-534]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-535',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-535]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): r8-db-errors: database FORBIDDEN with no detail answers 403 with exactly the registered reasonCode for the operation; a disclosed registered reasonCode is kept; r8_error_details pgTAP emits the reasonCode DETAIL per class',
  },
  {
    criterion: 'P2-S09-AC-536',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-536]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-537',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'supabase/tests/phase_02_slice_09_dec119_grant_command.sql',
    ],
    testMarkers: ['[P2-S09-AC-537]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): in-isolate IDEMPOTENCY_CONFLICT cache removed; r8-db-errors (real RPC adapter + database-contract fake) asserts 409 CONFLICT for idempotency mismatch, stale version (VERSION_MISMATCH + both versions) and state conflict with the BE00 conflict/recoveryAction members; pgTAP r3_cms_error_rows asserts VERSION_MISMATCH',
  },
  {
    criterion: 'P2-S09-AC-538',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-538]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-539',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-539]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-540',
    layer: 'worker+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
      'supabase/tests/phase_02_slice_09_f1_cms_rate_limit.sql',
      'tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-540]'],
    status: 'verified',
    limitation:
      "Condition produced, not told: the real Hono app, CMS limiter and authentication limiter adapter run against a fake PostgREST that answers platform_api.auth_rate_limit with the database decision shape; the per-user limit is exhausted by real requests and the next request is refused with 429 before any CMS RPC. Only PostgREST (the external dependency) is faked. | Database half: the per-user and per-party bucket refusal of platform_api.auth_rate_limit under the Worker fallback operation id AUTH-API-15 with this route's limit and 60-second window; the HTTP status, envelope and headers are the Worker half.",
  },
  {
    criterion: 'P2-S09-AC-541',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-541]'],
    status: 'verified',
    limitation:
      'Condition produced, not told: the real production RPC adapter receives a non-conforming dependency response from the fake PostgREST (object missing every contract field, null, array, bare string) and the app answers 502 DEPENDENCY_UNAVAILABLE with only dependencyClass and retryable true. Worker half only: no database producer exists for this row, PostgREST is the faked external dependency.',
  },
  {
    criterion: 'P2-S09-AC-542',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-542]'],
    status: 'verified',
    limitation:
      'Produced through the production RPC adapter: a refused connection and an HTTP 503 each reach the wire as 503 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds } and no transport text. The details allowlist applies; Retry-After 5 is the adapter policy constant, not a limiter value.',
  },
  {
    criterion: 'P2-S09-AC-543',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-543]'],
    status: 'verified',
    limitation:
      'Produced, not stubbed: the registered deadline is made to elapse (25 ms) while the RPC hangs; the Worker aborts the RPC signal and answers 504 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds: 5 }. Retry-After on a 504 follows the existing adapter policy (BE00 says only 429 and retryable 503 carry Retry-After; not changed here, recorded in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-544',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-544]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): unexpected thrown port failure is 500 INTERNAL_ERROR with a fixed message and no details, kept distinct from a dependency outage (503) and a deadline (504); the port is no longer told to return 500',
  },
  {
    criterion: 'P2-S09-AC-545',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts tests/security/phase-02-slice-09-aal2-cms-step-up-gates.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'tests/security/phase-02-slice-09-aal2-cms-step-up-gates.test.ts',
      'supabase/tests/phase_02_slice_09_r3_recent_mfa.sql',
    ],
    testMarkers: ['[P2-S09-AC-545]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): sessionStepUpAt requires token aal2 plus a valid MFA amr: aal1, aal2 without MFA amr, missing aal and amr-less tokens are 401 STEP_UP_REQUIRED with no effect, on AUTH-API-17/19 (r8-aal-proof) and the CMS and CFG-05B routes through real composition (aal2-cms-step-up-gates, r8-aal-gates)',
  },
  {
    criterion: 'P2-S09-AC-546',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-546]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-547',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-547]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-548',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-version-binding.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-version-binding.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-548]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-549',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-549]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-550',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-550]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-551',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-551]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-552',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-552]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-553',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-553]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-554',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-554]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-555',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql'],
    testMarkers: ['[P2-S09-AC-555]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-556',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql',
      'supabase/tests/phase_02_slice_09_evidence_grants.sql',
      'supabase/tests/phase_02_slice_09_r3_recent_mfa.sql',
    ],
    testMarkers: ['[P2-S09-AC-556]'],
    status: 'verified',
    limitation:
      'The step-up proof is the service-role envelope context.stepUpVerified/stepUpAt (Worker-verified aal2 proof); the DB re-checks -30 s <= now - stepUpAt <= 600 s and records that instant. The binding heartbeat (10 minutes) is kept only as a separate binding-liveness check, asserted by "a dead binding heartbeat is refused ... (binding liveness stays separate)". The DB cannot independently verify the aal2 token signature; that remains the Worker verifier.',
  },
  {
    criterion: 'P2-S09-AC-557',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql'],
    testMarkers: ['[P2-S09-AC-557]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-558',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql'],
    testMarkers: ['[P2-S09-AC-558]'],
    status: 'verified',
    limitation:
      'Proved by the two-session runner 012-concurrent-commands.mjs (right after pnpm db:reset).',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec108/012-concurrent-commands.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-559',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql'],
    testMarkers: ['[P2-S09-AC-559]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-560',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql'],
    testMarkers: ['[P2-S09-AC-560]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-561',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-561]'],
    status: 'verified',
    limitation:
      'AC561 was WEAK because the sibling check used a fresh store. The per-operation keying test now goes through the real stack (CMS limiter adapter, real authentication limiter adapter and its real bucket-key builder) over one shared counter model, so a sibling operation can fail. Mutation-checked: replacing the limiter input operationId with a constant fails 19 of the 80 tests in the rate file; routing the user bucket through the client scope fails 10; hard-coding Retry-After fails 20. The user bucket is keyed by the authenticated user, not by client address (alternating cf-connecting-ip still exhausts it). The platform_api.auth_rate_limit counting itself is modelled, not run (pgTAP: authentication_foundation.sql; a CMS-operation-id bucket assertion is listed under needs-db in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-562',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-562]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-563',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-563]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-564',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-564]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): r8-db-errors: database FORBIDDEN with no detail answers 403 with exactly the registered reasonCode for the operation; a disclosed registered reasonCode is kept; r8_error_details pgTAP emits the reasonCode DETAIL per class',
  },
  {
    criterion: 'P2-S09-AC-565',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-565]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-566',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql',
    ],
    testMarkers: ['[P2-S09-AC-566]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): in-isolate IDEMPOTENCY_CONFLICT cache removed; r8-db-errors (real RPC adapter + database-contract fake) asserts 409 CONFLICT for idempotency mismatch, stale version (VERSION_MISMATCH + both versions) and state conflict with the BE00 conflict/recoveryAction members; pgTAP r3_cms_error_rows asserts VERSION_MISMATCH',
  },
  {
    criterion: 'P2-S09-AC-567',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-567]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-568',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-568]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-569',
    layer: 'worker+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
      'supabase/tests/phase_02_slice_09_f1_cms_rate_limit.sql',
      'tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-569]'],
    status: 'verified',
    limitation:
      "Condition produced, not told: the real Hono app, CMS limiter and authentication limiter adapter run against a fake PostgREST that answers platform_api.auth_rate_limit with the database decision shape; the per-user limit is exhausted by real requests and the next request is refused with 429 before any CMS RPC. Only PostgREST (the external dependency) is faked. | Database half: the per-user and per-party bucket refusal of platform_api.auth_rate_limit under the Worker fallback operation id AUTH-API-15 with this route's limit and 60-second window; the HTTP status, envelope and headers are the Worker half.",
  },
  {
    criterion: 'P2-S09-AC-570',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-570]'],
    status: 'verified',
    limitation:
      'Condition produced, not told: the real production RPC adapter receives a non-conforming dependency response from the fake PostgREST (object missing every contract field, null, array, bare string) and the app answers 502 DEPENDENCY_UNAVAILABLE with only dependencyClass and retryable true. Worker half only: no database producer exists for this row, PostgREST is the faked external dependency.',
  },
  {
    criterion: 'P2-S09-AC-571',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-571]'],
    status: 'verified',
    limitation:
      'Produced through the production RPC adapter: a refused connection and an HTTP 503 each reach the wire as 503 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds } and no transport text. The details allowlist applies; Retry-After 5 is the adapter policy constant, not a limiter value.',
  },
  {
    criterion: 'P2-S09-AC-572',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-572]'],
    status: 'verified',
    limitation:
      'Produced, not stubbed: the registered deadline is made to elapse (25 ms) while the RPC hangs; the Worker aborts the RPC signal and answers 504 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds: 5 }. Retry-After on a 504 follows the existing adapter policy (BE00 says only 429 and retryable 503 carry Retry-After; not changed here, recorded in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-573',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-573]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): unexpected thrown port failure is 500 INTERNAL_ERROR with a fixed message and no details, kept distinct from a dependency outage (503) and a deadline (504); the port is no longer told to return 500',
  },
  {
    criterion: 'P2-S09-AC-574',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts tests/security/phase-02-slice-09-aal2-cms-step-up-gates.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'tests/security/phase-02-slice-09-aal2-cms-step-up-gates.test.ts',
      'supabase/tests/phase_02_slice_09_r3_recent_mfa.sql',
    ],
    testMarkers: ['[P2-S09-AC-574]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): sessionStepUpAt requires token aal2 plus a valid MFA amr: aal1, aal2 without MFA amr, missing aal and amr-less tokens are 401 STEP_UP_REQUIRED with no effect, on AUTH-API-17/19 (r8-aal-proof) and the CMS and CFG-05B routes through real composition (aal2-cms-step-up-gates, r8-aal-gates)',
  },
  {
    criterion: 'P2-S09-AC-575',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-575]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-576',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-576]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-577',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-version-binding.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-version-binding.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-577]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-578',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-578]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-579',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-579]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-580',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-580]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-581',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-581]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-582',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-582]'],
    status: 'verified',
    limitation:
      'The header grammar is isolated from the body-binding rule by the envelope message: only the header grammar answers "A valid strong If-Match version is required."; the binding rule answers "expectedVersion must equal the If-Match version.". Mutation-checked: allowing "0" in CmsStrongEtagSchema fails 7 tests. Unquoted, weak, missing, zero, leading-zero, negative, decimal, signed, space and exponent forms are covered; the 2^63-1 boundary is accepted and forwarded as expectedVersion to the RPC.',
  },
  {
    criterion: 'P2-S09-AC-583',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql'],
    testMarkers: ['[P2-S09-AC-583]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-584',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql',
      'supabase/tests/phase_02_slice_09_evidence_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-584]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-585',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql',
      'supabase/tests/phase_02_slice_09_evidence_grants.sql',
      'supabase/tests/phase_02_slice_09_r3_recent_mfa.sql',
    ],
    testMarkers: ['[P2-S09-AC-585]'],
    status: 'verified',
    limitation:
      'The step-up proof is the service-role envelope context.stepUpVerified/stepUpAt (Worker-verified aal2 proof); the DB re-checks -30 s <= now - stepUpAt <= 600 s and records that instant. The binding heartbeat (10 minutes) is kept only as a separate binding-liveness check, asserted by "a dead binding heartbeat is refused ... (binding liveness stays separate)". The DB cannot independently verify the aal2 token signature; that remains the Worker verifier.',
  },
  {
    criterion: 'P2-S09-AC-586',
    layer: 'contracts+db',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-race-runner-gate.test.ts',
    testFiles: ['tests/contracts/phase-02-slice-09-race-runner-gate.test.ts'],
    testMarkers: ['[P2-S09-AC-586]'],
    status: 'verified',
    limitation:
      'The gate test runs under pnpm validate (vitest): it proves every .mjs independent-session runner under supabase/tests is listed in infra/run-database-race-runners.mjs, that db:verify (which db:ci and CI run) runs pnpm db:races after pnpm db:test, and that a runner passes only on exit code 0 with at least one ok assertion. | Runs against the disposable local database: resets before each runner and once at the end. The runner holds the first command uncommitted, proves the second is blocked on a PostgreSQL lock, then the typed 409 and exactly one effect.',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec108/012-concurrent-commands.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-587',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_grants.sql'],
    testMarkers: ['[P2-S09-AC-587]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-588',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql',
      'supabase/tests/phase_02_slice_09_evidence_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-588]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-589',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-589]'],
    status: 'verified',
    limitation:
      'AC589 was WEAK because the sibling check used a fresh store. The per-operation keying test now goes through the real stack (CMS limiter adapter, real authentication limiter adapter and its real bucket-key builder) over one shared counter model, so a sibling operation can fail. Mutation-checked: replacing the limiter input operationId with a constant fails 19 of the 80 tests in the rate file; routing the user bucket through the client scope fails 10; hard-coding Retry-After fails 20. The user bucket is keyed by the authenticated user, not by client address (alternating cf-connecting-ip still exhausts it). The platform_api.auth_rate_limit counting itself is modelled, not run (pgTAP: authentication_foundation.sql; a CMS-operation-id bucket assertion is listed under needs-db in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-590',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-590]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-591',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-591]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-592',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-592]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): r8-db-errors: database FORBIDDEN with no detail answers 403 with exactly the registered reasonCode for the operation; a disclosed registered reasonCode is kept; r8_error_details pgTAP emits the reasonCode DETAIL per class',
  },
  {
    criterion: 'P2-S09-AC-593',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql',
    ],
    testMarkers: ['[P2-S09-AC-593]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-594',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'supabase/tests/phase_02_slice_09_dec119_grant_lifecycle.sql',
    ],
    testMarkers: ['[P2-S09-AC-594]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): in-isolate IDEMPOTENCY_CONFLICT cache removed; r8-db-errors (real RPC adapter + database-contract fake) asserts 409 CONFLICT for idempotency mismatch, stale version (VERSION_MISMATCH + both versions) and state conflict with the BE00 conflict/recoveryAction members; pgTAP r3_cms_error_rows asserts VERSION_MISMATCH',
  },
  {
    criterion: 'P2-S09-AC-595',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-595]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-596',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-596]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-597',
    layer: 'worker+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
      'supabase/tests/phase_02_slice_09_f1_cms_rate_limit.sql',
      'tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-597]'],
    status: 'verified',
    limitation:
      "Condition produced, not told: the real Hono app, CMS limiter and authentication limiter adapter run against a fake PostgREST that answers platform_api.auth_rate_limit with the database decision shape; the per-user limit is exhausted by real requests and the next request is refused with 429 before any CMS RPC. Only PostgREST (the external dependency) is faked. | Database half: the per-user and per-party bucket refusal of platform_api.auth_rate_limit under the Worker fallback operation id AUTH-API-15 with this route's limit and 60-second window; the HTTP status, envelope and headers are the Worker half.",
  },
  {
    criterion: 'P2-S09-AC-598',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-598]'],
    status: 'verified',
    limitation:
      'Condition produced, not told: the real production RPC adapter receives a non-conforming dependency response from the fake PostgREST (object missing every contract field, null, array, bare string) and the app answers 502 DEPENDENCY_UNAVAILABLE with only dependencyClass and retryable true. Worker half only: no database producer exists for this row, PostgREST is the faked external dependency.',
  },
  {
    criterion: 'P2-S09-AC-599',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-599]'],
    status: 'verified',
    limitation:
      'Produced through the production RPC adapter: a refused connection and an HTTP 503 each reach the wire as 503 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds } and no transport text. The details allowlist applies; Retry-After 5 is the adapter policy constant, not a limiter value.',
  },
  {
    criterion: 'P2-S09-AC-600',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/error-detail-values.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/error-detail-values.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-600]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-601',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-601]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): unexpected thrown port failure is 500 INTERNAL_ERROR with a fixed message and no details, kept distinct from a dependency outage (503) and a deadline (504); the port is no longer told to return 500',
  },
  {
    criterion: 'P2-S09-AC-602',
    layer: 'worker+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/production-step-up-skew.test.ts tests/security/phase-02-slice-09-aal2-cms-step-up-gates.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/production-step-up-skew.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
      'tests/security/phase-02-slice-09-aal2-cms-step-up-gates.test.ts',
      'apps/worker/src/authentication/step-up.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-602]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): sessionStepUpAt requires token aal2 plus a valid MFA amr: aal1, aal2 without MFA amr, missing aal and amr-less tokens are 401 STEP_UP_REQUIRED with no effect, on AUTH-API-17/19 (r8-aal-proof) and the CMS and CFG-05B routes through real composition (aal2-cms-step-up-gates, r8-aal-gates)',
  },
  {
    criterion: 'P2-S09-AC-603',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-responses.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-603]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-604',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-604]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-605',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-605]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-606',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-606]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-607',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-607]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-608',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-608]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-609',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-609]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-610',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-610]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-611',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-grants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-611]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-612',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-admission.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-612]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-613',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-evidence-resources.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-613]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-614',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_list.sql'],
    testMarkers: ['[P2-S09-AC-614]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-615',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_list.sql'],
    testMarkers: ['[P2-S09-AC-615]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-616',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec119_grant_list.sql',
      'supabase/tests/phase_02_slice_09_evidence_grants.sql',
      'supabase/tests/phase_02_slice_09_r3_grants_misc.sql',
    ],
    testMarkers: ['[P2-S09-AC-616]'],
    status: 'verified',
    limitation:
      'The forged other-organization row is the only direct insert and is labelled a negative control.',
  },
  {
    criterion: 'P2-S09-AC-617',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec119_grant_list.sql'],
    testMarkers: ['[P2-S09-AC-617]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-618',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-rate.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-618]'],
    status: 'verified',
    limitation:
      'The per-operation keying test now goes through the real stack (CMS limiter adapter, real authentication limiter adapter and its real bucket-key builder) over one shared counter model, so a sibling operation can fail. Mutation-checked: replacing the limiter input operationId with a constant fails 19 of the 80 tests in the rate file; routing the user bucket through the client scope fails 10; hard-coding Retry-After fails 20. The user bucket is keyed by the authenticated user, not by client address (alternating cf-connecting-ip still exhausts it). The platform_api.auth_rate_limit counting itself is modelled, not run (pgTAP: authentication_foundation.sql; a CMS-operation-id bucket assertion is listed under needs-db in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-619',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-619]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): malformed cursor, unknown query key and mutation-only header are 400 INVALID_REQUEST at admission',
  },
  {
    criterion: 'P2-S09-AC-620',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-620]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-621',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r8-db-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-621]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): r8-db-errors: database FORBIDDEN with no detail answers 403 with exactly the registered reasonCode for the operation; a disclosed registered reasonCode is kept; r8_error_details pgTAP emits the reasonCode DETAIL per class',
  },
  {
    criterion: 'P2-S09-AC-622',
    layer: 'db+worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-wire-details.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-622]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): CMS-03A-18 filter, sort, page failures are 422 VALIDATION_FAILED with one path violation (9 marked tests)',
  },
  {
    criterion: 'P2-S09-AC-623',
    layer: 'worker+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/error-detail-values.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/error-detail-values.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
      'supabase/tests/phase_02_slice_09_f1_cms_rate_limit.sql',
      'tests/integration/phase-02-slice-09-r8-429-cross-surface.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-623]'],
    status: 'verified',
    limitation:
      "Condition produced, not told: the real Hono app, CMS limiter and authentication limiter adapter run against a fake PostgREST that answers platform_api.auth_rate_limit with the database decision shape; the per-user limit is exhausted by real requests and the next request is refused with 429 before any CMS RPC. Only PostgREST (the external dependency) is faked. | Database half: the per-user and per-party bucket refusal of platform_api.auth_rate_limit under the Worker fallback operation id AUTH-API-15 with this route's limit and 60-second window; the HTTP status, envelope and headers are the Worker half.",
  },
  {
    criterion: 'P2-S09-AC-624',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-624]'],
    status: 'verified',
    limitation:
      'Condition produced, not told: the real production RPC adapter receives a non-conforming dependency response from the fake PostgREST (object missing every contract field, null, array, bare string) and the app answers 502 DEPENDENCY_UNAVAILABLE with only dependencyClass and retryable true. Worker half only: no database producer exists for this row, PostgREST is the faked external dependency.',
  },
  {
    criterion: 'P2-S09-AC-625',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-625]'],
    status: 'verified',
    limitation:
      'Produced through the production RPC adapter: a refused connection and an HTTP 503 each reach the wire as 503 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds } and no transport text. The details allowlist applies; Retry-After 5 is the adapter policy constant, not a limiter value.',
  },
  {
    criterion: 'P2-S09-AC-626',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r2-admission-dependency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-626]'],
    status: 'verified',
    limitation:
      'Produced, not stubbed: the registered deadline is made to elapse (25 ms) while the RPC hangs; the Worker aborts the RPC signal and answers 504 DEPENDENCY_UNAVAILABLE with exactly { dependencyClass, retryable: true, retryAfterSeconds: 5 }. Retry-After on a 504 follows the existing adapter policy (BE00 says only 429 and retryable 503 carry Retry-After; not changed here, recorded in the lane report).',
  },
  {
    criterion: 'P2-S09-AC-627',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-627]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): unexpected thrown port failure is 500 INTERNAL_ERROR with a fixed message and no details, kept distinct from a dependency outage (503) and a deadline (504); the port is no longer told to return 500',
  },
  {
    criterion: 'P2-S09-AC-628',
    layer: 'worker+db',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-step-up-required-mapping.test.ts apps/worker/src/content-schema-registry/production-step-up-skew.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-step-up-required-mapping.test.ts',
      'apps/worker/src/content-schema-registry/production-step-up-skew.test.ts',
      'supabase/tests/phase_02_slice_09_r3_cms_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-628]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-629',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_activation.sql',
      'supabase/tests/phase_02_slice_09_p240_authority.sql',
    ],
    testMarkers: ['[P2-S09-AC-629]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-630',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_activation.sql'],
    testMarkers: ['[P2-S09-AC-630]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-631',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_activation.sql'],
    testMarkers: ['[P2-S09-AC-631]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-632',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_activation.sql',
      'supabase/tests/phase_02_slice_09_od4_locale_config.sql',
      'supabase/tests/phase_02_slice_09_r3_ia_edge_cases.sql',
    ],
    testMarkers: ['[P2-S09-AC-632]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-633',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_paths.sql'],
    testMarkers: ['[P2-S09-AC-633]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-634',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_activation.sql'],
    testMarkers: ['[P2-S09-AC-634]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-635',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-635]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-636',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/resources-workflow.coverage.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/resources-workflow.coverage.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-636]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-637',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-637]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-638',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-638]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-639',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-639]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-640',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-640]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-641',
    layer: 'db+contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-r2-contract-evidence.test.ts packages/contracts/src/content-schema-registry/resources-workflow.coverage.test.ts; pnpm db:test',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-r2-contract-evidence.test.ts',
      'packages/contracts/src/content-schema-registry/resources-workflow.coverage.test.ts',
      'supabase/tests/phase_02_slice_09_r12_scan_failure.sql',
      'supabase/tests/phase_02_slice_09_r3_activation_gates.sql',
    ],
    testMarkers: ['[P2-S09-AC-641]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-127 (ledger row AC641): cms_rollback_schema_migration fails a dry_running plan (retryable is 409, a code outside the pattern is 400, otherwise the latest attempt is marked failed with the code and the plan blocked, recovered by a new CMS-03A-10); dryRunRef.failureCode projects that stored code of the latest attempt and a later queued attempt projects null (r12_scan_failure, r3_activation_gates, r2-contract-evidence).',
  },
  {
    criterion: 'P2-S09-AC-642',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/resources-workflow.coverage.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/resources-workflow.coverage.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-642]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-643',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reviews.sql',
    ],
    testMarkers: ['[P2-S09-AC-643]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-644',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reviews.sql',
    ],
    testMarkers: ['[P2-S09-AC-644]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-645',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reviews.sql',
    ],
    testMarkers: ['[P2-S09-AC-645]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-646',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reviews.sql',
    ],
    testMarkers: ['[P2-S09-AC-646]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-647',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reviews.sql',
      'supabase/tests/phase_02_slice_09_sec2_definer_rls.sql',
    ],
    testMarkers: ['[P2-S09-AC-647]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-648',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reviews.sql',
    ],
    testMarkers: ['[P2-S09-AC-648]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-649',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reviews.sql',
    ],
    testMarkers: ['[P2-S09-AC-649]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-650',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reviews.sql',
    ],
    testMarkers: ['[P2-S09-AC-650]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-651',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reviews.sql',
    ],
    testMarkers: ['[P2-S09-AC-651]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-652',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reviews.sql',
    ],
    testMarkers: ['[P2-S09-AC-652]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-653',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_activation.sql',
      'supabase/tests/phase_02_slice_09_dec108_decision.sql',
    ],
    testMarkers: ['[P2-S09-AC-653]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-654',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reviews.sql',
    ],
    testMarkers: ['[P2-S09-AC-654]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-655',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-655]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-656',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-656]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-657',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-657]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-658',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
      'supabase/tests/phase_02_slice_09_r3_grants_misc.sql',
      'supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql',
    ],
    testMarkers: ['[P2-S09-AC-658]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-124 (ledger row AC658): cms_capability_grants rows are written only by the grant, renew and revoke operations and by the owner-initialization backfill (aggregate only); the actor-grant projection is written only by cms_capability_grant_project, initialize_cms_owner and rpc_create_organization, asserted over every non-system schema (r3_grants_misc, evidence_constraints_grants).',
  },
  {
    criterion: 'P2-S09-AC-659',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_grants.sql'],
    testMarkers: ['[P2-S09-AC-659]'],
    status: 'verified',
    limitation:
      'Pre-migration state is simulated by hand-inserted actor-grant rows (they must exist before the backfill); the backfill function is called directly.',
  },
  {
    criterion: 'P2-S09-AC-660',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
      'supabase/tests/phase_02_slice_09_sec2_definer_rls.sql',
    ],
    testMarkers: ['[P2-S09-AC-660]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-661',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-661]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-662',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-662]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-663',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-663]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-664',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-664]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-665',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
      'supabase/tests/phase_02_slice_09_r3_grants_misc.sql',
    ],
    testMarkers: ['[P2-S09-AC-665]'],
    status: 'verified',
    limitation:
      'Vectors cover key ordering, string escaping, non-ASCII, literals, arrays and empty containers; floating-point number serialization (RFC 8785 section 3.2.2.3) is not exercised because policy members carry only integers and strings.',
  },
  {
    criterion: 'P2-S09-AC-666',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-666]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-667',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-667]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-668',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-668]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-669',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-669]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-670',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-670]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-671',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reports.sql',
    ],
    testMarkers: ['[P2-S09-AC-671]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-672',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reports.sql',
    ],
    testMarkers: ['[P2-S09-AC-672]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-673',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_dry_run.sql'],
    testMarkers: ['[P2-S09-AC-673]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-674',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reports.sql',
    ],
    testMarkers: ['[P2-S09-AC-674]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-675',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reports.sql',
      'supabase/tests/phase_02_slice_09_scan_protocol.sql',
      'supabase/tests/phase_02_slice_09_sec2_definer_rls.sql',
    ],
    testMarkers: ['[P2-S09-AC-675]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-676',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reports.sql',
    ],
    testMarkers: ['[P2-S09-AC-676]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-677',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reports.sql',
    ],
    testMarkers: ['[P2-S09-AC-677]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-678',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_r3_activation_gates.sql'],
    testMarkers: ['[P2-S09-AC-678]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r6-db): R5: reworded by DEC-122 (owner-ratified); the re-audit limitation (lease added at the first lease, not at creation) is a recorded limitation, not a reopen; evidence unchanged and green',
  },
  {
    criterion: 'P2-S09-AC-679',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-transform-registry-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-transform-registry-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-679]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-680',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_misc.sql',
      'supabase/tests/phase_02_slice_09_scan_protocol.sql',
      'supabase/tests/phase_02_slice_09_scan_registry.sql',
    ],
    testMarkers: ['[P2-S09-AC-680]'],
    status: 'verified',
    limitation:
      'Field-kind and registry-integrity refusals proven; the detail TRANSFORM_NOT_REGISTERED is reported by the scan preflight, while CMS-03A-10 reports a plain 422 for a tampered registry entry.',
  },
  {
    criterion: 'P2-S09-AC-681',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-transform-registry-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-transform-registry-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-681]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-682',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-transform-registry-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-transform-registry-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-682]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-683',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_dry_run.sql',
      'supabase/tests/phase_02_slice_09_scan_registry.sql',
    ],
    testMarkers: ['[P2-S09-AC-683]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-684',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec108_artifact_versioning.sql',
      'supabase/tests/phase_02_slice_09_schema/004-registries-and-rollback.sqlinc',
    ],
    testMarkers: ['[P2-S09-AC-684]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-685',
    layer: 'db+contracts',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts; pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_r3_grants_misc.sql',
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-685]'],
    status: 'verified',
    limitation:
      'platform_api holds 49 cms_ functions in total (worker protocol, entries, templates, alerts belong to other specs), so the criterion is asserted over the eighteen BE03a-named members as a set (the audit suggestion of counting all cms_ functions to 18 does not match the schema); the other 31 are asserted definer-only and not anon/PUBLIC executable.',
  },
  {
    criterion: 'P2-S09-AC-686',
    layer: 'contracts',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts',
      'supabase/tests/phase_02_slice_09_evidence_constraints_grants.sql',
      'supabase/tests/phase_02_slice_09_sec2_definer_rls.sql',
    ],
    testMarkers: ['[P2-S09-AC-686]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-687',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_grants.sql'],
    testMarkers: ['[P2-S09-AC-687]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-688',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_grants.sql'],
    testMarkers: ['[P2-S09-AC-688]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-689',
    layer: 'db+integration+worker',
    command:
      'pnpm exec vitest run apps/worker/src/event-consumers/admit.test.ts apps/worker/src/event-consumers/auth-state-reconciler.test.ts apps/worker/src/event-consumers/capability-grant-consumer.test.ts apps/worker/src/event-consumers/dead-letter.test.ts apps/worker/src/event-consumers/registry.test.ts apps/worker/src/event-consumers/security-notifier.test.ts apps/worker/src/production-async-entrypoint-event-consumers.test.ts packages/contracts/src/consumer-queue-events.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/event-consumers/admit.test.ts',
      'apps/worker/src/event-consumers/auth-state-reconciler.test.ts',
      'apps/worker/src/event-consumers/capability-grant-consumer.test.ts',
      'apps/worker/src/event-consumers/dead-letter.test.ts',
      'apps/worker/src/event-consumers/registry.test.ts',
      'apps/worker/src/event-consumers/security-notifier.test.ts',
      'apps/worker/src/production-async-entrypoint-event-consumers.test.ts',
      'packages/contracts/src/consumer-queue-events.test.ts',
      'supabase/tests/phase_02_slice_09_g1_consumer_boundary.sql',
    ],
    testMarkers: ['[P2-S09-AC-689]'],
    status: 'verified',
    limitation:
      'The real-consumer suite commits fixtures, so it runs only right after pnpm db:reset (and a reset follows it). The found:true grant path is proved by pgTAP against real grants; the integration run needs no CMS owner bootstrap.',
    supplementary: [
      'tests/db-integration/phase-02-slice-09-event-consumers.dbspec.ts',
    ],
  },
  {
    criterion: 'P2-S09-AC-690',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-lifecycle-metrics.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-lifecycle-metrics.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-690]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-691',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-lifecycle-metrics.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-lifecycle-metrics.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-691]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-692',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-lifecycle-metrics.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-lifecycle-metrics.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-692]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-693',
    layer: 'db+worker+observability',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/operational-alert-metrics.test.ts packages/observability/src/content-schema-registry-alert-review-denials.test.ts tests/contracts/phase-02-slice-09-operational-release-evidence.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/content-schema-registry/operational-alert-metrics.test.ts',
      'packages/observability/src/content-schema-registry-alert-review-denials.test.ts',
      'supabase/tests/phase_02_slice_09_operational_review_age.sql',
      'tests/contracts/phase-02-slice-09-operational-release-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-693]'],
    status: 'verified',
    limitation:
      'The 7-day window is the derived assignment-span constant already ruled in G2; BE03a states no number.',
  },
  {
    criterion: 'P2-S09-AC-694',
    layer: 'worker+observability',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/operational-alert-metrics.test.ts packages/observability/src/content-schema-registry-alert-review-denials.test.ts tests/contracts/phase-02-slice-09-operational-release-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/operational-alert-metrics.test.ts',
      'packages/observability/src/content-schema-registry-alert-review-denials.test.ts',
      'tests/contracts/phase-02-slice-09-operational-release-evidence.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r14-refusal-telemetry.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-694]'],
    status: 'verified',
    limitation:
      "Denials are counted from command telemetry (Workers Logs), not from database rows: a refused command rolls back its transaction, so the database holds no denial record. The task's 'DB reads for denial rates' therefore reduces to telemetry; only the review age is a database read.",
  },
  {
    criterion: 'P2-S09-AC-695',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-lifecycle-metrics.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-lifecycle-metrics.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-695]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-696',
    layer: 'contracts',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-capability-registry-consistency.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-capability-registry-consistency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-696]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-697',
    layer: 'contracts',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-capability-registry-consistency.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-capability-registry-consistency.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-697]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-698',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/cms-composition/template-compatibility.test.ts',
    testFiles: [
      'packages/contracts/src/cms-composition/template-compatibility.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-698]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-699',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_resolver.sql'],
    testMarkers: ['[P2-S09-AC-699]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-700',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/cms-composition/template-compatibility.test.ts',
    testFiles: [
      'packages/contracts/src/cms-composition/template-compatibility.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-700]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-701',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/cms-composition/template-compatibility.test.ts',
    testFiles: [
      'packages/contracts/src/cms-composition/template-compatibility.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-701]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-702',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_resolver.sql'],
    testMarkers: ['[P2-S09-AC-702]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-703',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_resolver.sql'],
    testMarkers: ['[P2-S09-AC-703]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-704',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_resolver.sql'],
    testMarkers: ['[P2-S09-AC-704]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-705',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_resolver.sql'],
    testMarkers: ['[P2-S09-AC-705]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-706',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_resolver.sql'],
    testMarkers: ['[P2-S09-AC-706]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-707',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_resolver.sql'],
    testMarkers: ['[P2-S09-AC-707]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-708',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_resolver.sql'],
    testMarkers: ['[P2-S09-AC-708]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-124 (ledger row AC708): the template-compatibility resolver is DB-internal, executable by no API role; the Worker never calls it and activation preflight uses the platform_private resolver (dec108_resolver).',
  },
  {
    criterion: 'P2-S09-AC-709',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec108_resolver.sql'],
    testMarkers: ['[P2-S09-AC-709]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-710',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-710]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-711',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_scan_integrated_path1.sql'],
    testMarkers: ['[P2-S09-AC-711]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-712',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_scan_integrated_path2.sql'],
    testMarkers: ['[P2-S09-AC-712]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-713',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_paths.sql',
      'supabase/tests/phase_02_slice_09_scan_integrated_path2.sql',
    ],
    testMarkers: ['[P2-S09-AC-713]'],
    status: 'verified',
    limitation:
      'The guard is an in-test trigger on seven producer-owned tables; it protects the integrated-path suites, not production writes. A superuser who rewrites the arming snapshot itself could still cheat, which the suite does not defend against.',
  },
  {
    criterion: 'P2-S09-AC-714',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_paths.sql',
      'supabase/tests/phase_02_slice_09_scan_integrated_path1.sql',
      'supabase/tests/phase_02_slice_09_scan_integrated_path2.sql',
    ],
    testMarkers: ['[P2-S09-AC-714]'],
    status: 'verified',
    limitation:
      'evidence_paths: editor and publisher test humans are provisioned through CMS-03A-15 and sit inside the unprovisioned-human guard; the guard no longer exempts the owner by identity but only the exact receipt-bounded set recorded by cms_owner_initialization, and negative controls detect a hand-inserted row for an editor-side human and for the owner.',
  },
  {
    criterion: 'P2-S09-AC-715',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_paths.sql'],
    testMarkers: ['[P2-S09-AC-715]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-716',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec109_editorial_policy.sql',
      'supabase/tests/phase_02_slice_09_evidence_misc.sql',
    ],
    testMarkers: ['[P2-S09-AC-716]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-717',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts apps/worker/src/authentication/phase-02-slice-09-r8-aal-proof.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-r8-aal-proof.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-717]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-718',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-718]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-719',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-719]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-720',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-720]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-721',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-721]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-722',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts apps/worker/src/authentication/phase-02-slice-09-r8-wire-rows.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-r8-wire-rows.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-722]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-723',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-723]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-724',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-724]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-725',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-rate-keying.test.ts packages/contracts/src/authentication/phase-02-slice-09-r8-slo-tier.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-list.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-rate-keying.test.ts',
      'packages/contracts/src/authentication/phase-02-slice-09-r8-slo-tier.test.ts',
      'supabase/tests/phase_02_slice_09_r3_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-725]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): r8-slo-tier: the platform registry classifies AUTH-API-16 as tier_1 with the 8 s deadline and the route policy is 300 per 60 s per user, no-store; other MFA operations stay tier_2',
  },
  {
    criterion: 'P2-S09-AC-726',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
    ],
    testMarkers: ['[P2-S09-AC-726]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-727',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
    ],
    testMarkers: ['[P2-S09-AC-727]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-728',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-728]'],
    status: 'verified',
    limitation:
      'DB half only: the 429 envelope, headers and the choice of limit/window per route are proven by the Worker lane tests; this proves that the database counter allows exactly `limit` requests and refuses the next.',
  },
  {
    criterion: 'P2-S09-AC-729',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-729]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-730',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-730]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-731',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-731]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-732',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-732]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-733',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-733]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-734',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-734]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-735',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-735]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-736',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
      'supabase/tests/phase_02_slice_09_dec111_mfa_schema.sql',
      'supabase/tests/phase_02_slice_09_dec111_mfa_removal.sql',
    ],
    testMarkers: ['[P2-S09-AC-736]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-737',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
      'supabase/tests/phase_02_slice_09_evidence_mfa.sql',
    ],
    testMarkers: ['[P2-S09-AC-737]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-738',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-738]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-739',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
    ],
    testMarkers: ['[P2-S09-AC-739]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-740',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-740]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-741',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-741]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-742',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-742]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-743',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-743]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-744',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
      'supabase/tests/phase_02_slice_09_evidence_mfa.sql',
    ],
    testMarkers: ['[P2-S09-AC-744]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-745',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-745]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-746',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts apps/worker/src/authentication/phase-02-slice-09-r8-aal-proof.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-r8-aal-proof.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-746]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): sessionStepUpAt requires token aal2 plus a valid MFA amr: aal1, aal2 without MFA amr, missing aal and amr-less tokens are 401 STEP_UP_REQUIRED with no effect, on AUTH-API-17/19 (r8-aal-proof) and the CMS and CFG-05B routes through real composition (aal2-cms-step-up-gates, r8-aal-gates)',
  },
  {
    criterion: 'P2-S09-AC-747',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts apps/worker/src/authentication/phase-02-slice-09-r8-aal-proof.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-r8-aal-proof.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-747]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-748',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
    ],
    testMarkers: ['[P2-S09-AC-748]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-749',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
    ],
    testMarkers: ['[P2-S09-AC-749]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-750',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
      'supabase/tests/phase_02_slice_09_evidence_mfa.sql',
    ],
    testMarkers: ['[P2-S09-AC-750]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-751',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-rate-keying.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-start.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-rate-keying.test.ts',
      'supabase/tests/phase_02_slice_09_r3_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-751]'],
    status: 'verified',
    limitation:
      'DB half only: the 429 envelope, headers and the choice of limit/window per route are proven by the Worker lane tests; this proves that the database counter allows exactly `limit` requests and refuses the next.',
  },
  {
    criterion: 'P2-S09-AC-752',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
    ],
    testMarkers: ['[P2-S09-AC-752]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-753',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-753]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-754',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-754]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-755',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
    ],
    testMarkers: ['[P2-S09-AC-755]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-756',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-756]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-757',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-757]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-758',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-758]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-759',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-759]'],
    status: 'verified',
    limitation:
      'DB half only: the 429 envelope, headers and the choice of limit/window per route are proven by the Worker lane tests; this proves that the database counter allows exactly `limit` requests and refuses the next.',
  },
  {
    criterion: 'P2-S09-AC-760',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-760]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-761',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts apps/worker/src/authentication/phase-02-slice-09-r8-settle-recovery.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-r8-settle-recovery.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-761]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): AUTH-API-17 503 for an unavailable database (factor read, after provider enrollment with unenroll), unavailable provider and open circuit with the strict identity_persistence / identity_provider details',
  },
  {
    criterion: 'P2-S09-AC-762',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-762]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-763',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-763]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-764',
    layer: 'a+auth',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts apps/worker/src/authentication/phase-02-slice-09-r8-aal-proof.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-r8-aal-proof.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-764]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): sessionStepUpAt requires token aal2 plus a valid MFA amr: aal1, aal2 without MFA amr, missing aal and amr-less tokens are 401 STEP_UP_REQUIRED with no effect, on AUTH-API-17/19 (r8-aal-proof) and the CMS and CFG-05B routes through real composition (aal2-cms-step-up-gates, r8-aal-gates)',
  },
  {
    criterion: 'P2-S09-AC-765',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-765]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-766',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-766]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-767',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-767]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-768',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-768]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-769',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-769]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-770',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-770]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-771',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-771]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-772',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-772]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-773',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-773]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-774',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_mfa.sql'],
    testMarkers: ['[P2-S09-AC-774]'],
    status: 'verified',
    limitation:
      'Reworded per the AC774 ruling: AUTH-API-18 refuses with 409 ENROLLMENT_EXPIRED and persists nothing (the refusing RPC rolls back); auth_mfa_registry_sweep persists the expiry and emits the factor-changed event that drives provider cleanup. Both halves carry the AC774 marker in phase_02_slice_09_evidence_mfa.sql; the pgTAP result is the E1 full db:test PASS (Files=139 Tests=4928) and should be re-run by E5.',
  },
  {
    criterion: 'P2-S09-AC-775',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-775]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-776',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
    ],
    testMarkers: ['[P2-S09-AC-776]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-777',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-777]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-778',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts apps/worker/src/authentication/phase-02-slice-09-r8-settle-recovery.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-r8-settle-recovery.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_verification_lock.sql',
      'supabase/tests/phase_02_slice_09_r8_mfa_reconcile_lockout.sql',
    ],
    testMarkers: ['[P2-S09-AC-778]'],
    status: 'verified',
    limitation:
      'R6-db finding 3_settle_lockout: RED 11 failed of 57; runner refused-assertion failed pre-fix; GREEN 57/57; runner 12 ok.',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec111/011-verification-lock-race.mjs',
      'supabase/tests/phase_02_slice_09_dec111/012-settle-race.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-779',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-779]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-780',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-780]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-781',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-781]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-782',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
    ],
    testMarkers: ['[P2-S09-AC-782]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-783',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
    ],
    testMarkers: ['[P2-S09-AC-783]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-784',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-784]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-785',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-785]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-786',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-786]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-787',
    layer: 'worker+db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-rate-headers.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-rate-headers.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-787]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-788',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-788]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-789',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-789]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-790',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-790]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-791',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-791]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-792',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-792]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-793',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-793]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-794',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-794]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-795',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-795]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-796',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_removal.sql',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-796]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-797',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_removal.sql',
    ],
    testMarkers: ['[P2-S09-AC-797]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-798',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-798]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-799',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-799]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-800',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-800]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-801',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts apps/worker/src/authentication/phase-02-slice-09-r8-aal-proof.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-r8-aal-proof.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-801]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): sessionStepUpAt requires token aal2 plus a valid MFA amr: aal1, aal2 without MFA amr, missing aal and amr-less tokens are 401 STEP_UP_REQUIRED with no effect, on AUTH-API-17/19 (r8-aal-proof) and the CMS and CFG-05B routes through real composition (aal2-cms-step-up-gates, r8-aal-gates)',
  },
  {
    criterion: 'P2-S09-AC-802',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_last_factor.sql',
    ],
    testMarkers: ['[P2-S09-AC-802]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-803',
    layer: 'auth+db',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts && pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_last_factor.sql',
      'supabase/tests/phase_02_slice_09_dec111_mfa_removal.sql',
    ],
    testMarkers: ['[P2-S09-AC-803]'],
    status: 'verified',
    limitation:
      'Complete proof: the auth layer (AUTH-API-19 factor-remove Worker test) answers 409 last_factor_required with recoveryAction enroll_factor and never reaches the provider; the db layer reads the capability registry against currently effective grants only (a lapsed grant no longer counts) and fails closed with 409 when that read is unavailable while mutating nothing',
  },
  {
    criterion: 'P2-S09-AC-804',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_mfa_last_factor.sql',
      'supabase/tests/phase_02_slice_09_dec111_mfa_removal.sql',
    ],
    testMarkers: ['[P2-S09-AC-804]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-805',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_removal.sql',
    ],
    testMarkers: ['[P2-S09-AC-805]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-806',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_mfa.sql'],
    testMarkers: ['[P2-S09-AC-806]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-807',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_removal.sql',
    ],
    testMarkers: ['[P2-S09-AC-807]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-808',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_removal.sql',
    ],
    testMarkers: ['[P2-S09-AC-808]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-809',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-rate-keying.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-factor-remove.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-rate-keying.test.ts',
      'supabase/tests/phase_02_slice_09_r3_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-809]'],
    status: 'verified',
    limitation:
      'DB half only: the 429 envelope, headers and the choice of limit/window per route are proven by the Worker lane tests; this proves that the database counter allows exactly `limit` requests and refuses the next.',
  },
  {
    criterion: 'P2-S09-AC-810',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_removal.sql',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-810]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-811',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_removal.sql',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-811]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-812',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-812]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-813',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_removal.sql',
    ],
    testMarkers: ['[P2-S09-AC-813]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-814',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_last_factor.sql',
      'supabase/tests/phase_02_slice_09_dec111_mfa_removal.sql',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-814]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-815',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-815]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-816',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-816]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-817',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-817]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-818',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-818]'],
    status: 'verified',
    limitation:
      'DB half only: the 429 envelope, headers and the choice of limit/window per route are proven by the Worker lane tests; this proves that the database counter allows exactly `limit` requests and refuses the next.',
  },
  {
    criterion: 'P2-S09-AC-819',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-819]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-820',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-820]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-821',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-821]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-822',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-822]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-823',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts apps/worker/src/authentication/phase-02-slice-09-r8-aal-proof.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-r8-aal-proof.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-r14-step-up-variants.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-823]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): sessionStepUpAt requires token aal2 plus a valid MFA amr: aal1, aal2 without MFA amr, missing aal and amr-less tokens are 401 STEP_UP_REQUIRED with no effect, on AUTH-API-17/19 (r8-aal-proof) and the CMS and CFG-05B routes through real composition (aal2-cms-step-up-gates, r8-aal-gates)',
  },
  {
    criterion: 'P2-S09-AC-824',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-824]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-825',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-825]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-826',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-826]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-827',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-827]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-828',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-828]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-829',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-829]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-830',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-830]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-831',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-831]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-832',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-832]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-833',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-833]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-834',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-834]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-835',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-835]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-836',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-836]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-837',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-837]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-838',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-838]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-839',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-rate-keying.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-rate-keying.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-challenge.test.ts',
      'supabase/tests/phase_02_slice_09_r3_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-839]'],
    status: 'verified',
    limitation:
      'DB half only: the 429 envelope, headers and the choice of limit/window per route are proven by the Worker lane tests; this proves that the database counter allows exactly `limit` requests and refuses the next.',
  },
  {
    criterion: 'P2-S09-AC-840',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-840]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-841',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-841]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-842',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-842]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-843',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-843]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-844',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-844]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-845',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-845]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-846',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-846]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-847',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-847]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-848',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-848]'],
    status: 'verified',
    limitation:
      'DB half only: the 429 envelope, headers and the choice of limit/window per route are proven by the Worker lane tests; this proves that the database counter allows exactly `limit` requests and refuses the next.',
  },
  {
    criterion: 'P2-S09-AC-849',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-849]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-850',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-850]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-851',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-851]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-852',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-852]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-853',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-853]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-854',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-854]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-855',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-855]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-856',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-856]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-857',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-857]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-858',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-858]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-859',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-859]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-860',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-860]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-861',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-861]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-862',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-862]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-863',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-863]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-864',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-step-up-verify.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-864]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-865',
    layer: 'db+worker+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-rate-headers.test.ts apps/worker/src/authentication/phase-02-slice-09-r8-settle-recovery.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-enroll-verify.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-rate-headers.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-r8-settle-recovery.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_verification_lock.sql',
      'supabase/tests/phase_02_slice_09_r8_mfa_reconcile_lockout.sql',
    ],
    testMarkers: ['[P2-S09-AC-865]'],
    status: 'verified',
    limitation:
      'R6-db finding 3_settle_lockout: RED 11 failed of 57; runner refused-assertion failed pre-fix; GREEN 57/57; runner 12 ok.',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec111/011-verification-lock-race.mjs',
      'supabase/tests/phase_02_slice_09_dec111/012-settle-race.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-866',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-866]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-867',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-867]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-868',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-868]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-869',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
    ],
    testMarkers: ['[P2-S09-AC-869]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-870',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-870]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-871',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-871]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-872',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-872]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-873',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-873]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-874',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
      'supabase/tests/phase_02_slice_09_r3_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-874]'],
    status: 'verified',
    limitation:
      'DB half only: the 429 envelope, headers and the choice of limit/window per route are proven by the Worker lane tests; this proves that the database counter allows exactly `limit` requests and refuses the next.',
  },
  {
    criterion: 'P2-S09-AC-875',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-875]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-876',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-876]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-877',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-877]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-878',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-wire-errors.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-878]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-879',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-proof.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-proof.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-r2-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-879]'],
    status: 'verified',
    limitation:
      'Defect fixed in this lane: a provider 401 on the returned token surfaced as 401 UNAUTHENTICATED; it is now 502 with no settle (production-session-rotation.ts).',
  },
  {
    criterion: 'P2-S09-AC-880',
    layer: 'db+a+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-880]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-881',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-proof.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-proof.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-881]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-882',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-proof-wire.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-proof.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-proof-wire.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-proof.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-882]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-883',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-proof.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-proof.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-883]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): recent-step-up family sweep: tests re-run green against the aal2-plus-amr proof model (boundaries, constant, registry, own UUID, mfa_version, primaryAuthAt, no recovery codes, console and reset-form prerequisite states)',
  },
  {
    criterion: 'P2-S09-AC-884',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-proof.test.ts apps/worker/src/authentication/phase-02-slice-09-r8-aal-proof.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-proof.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-r8-aal-proof.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-884]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): freshness is evaluated from the token (aal2 + MFA amr) on every request; the original instant is carried across a refresh in the sealed reference and the older of the two always wins, so a refresh never extends freshness and iat is never used',
  },
  {
    criterion: 'P2-S09-AC-885',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/step-up.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-step-up-conformance.test.ts',
    testFiles: [
      'apps/worker/src/authentication/step-up.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-step-up-conformance.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-885]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): recent-step-up family sweep: tests re-run green against the aal2-plus-amr proof model (boundaries, constant, registry, own UUID, mfa_version, primaryAuthAt, no recovery codes, console and reset-form prerequisite states)',
  },
  {
    criterion: 'P2-S09-AC-886',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-proof-wire.test.ts apps/worker/src/authentication/step-up.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-proof-wire.test.ts',
      'apps/worker/src/authentication/step-up.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-886]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): recent-step-up family sweep: tests re-run green against the aal2-plus-amr proof model (boundaries, constant, registry, own UUID, mfa_version, primaryAuthAt, no recovery codes, console and reset-form prerequisite states)',
  },
  {
    criterion: 'P2-S09-AC-887',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/step-up.test.ts',
    testFiles: ['apps/worker/src/authentication/step-up.test.ts'],
    testMarkers: ['[P2-S09-AC-887]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): recent-step-up family sweep: tests re-run green against the aal2-plus-amr proof model (boundaries, constant, registry, own UUID, mfa_version, primaryAuthAt, no recovery codes, console and reset-form prerequisite states)',
  },
  {
    criterion: 'P2-S09-AC-888',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-proof-wire.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-proof-wire.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-888]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): recent-step-up family sweep: tests re-run green against the aal2-plus-amr proof model (boundaries, constant, registry, own UUID, mfa_version, primaryAuthAt, no recovery codes, console and reset-form prerequisite states)',
  },
  {
    criterion: 'P2-S09-AC-889',
    layer: 'db+a+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
      'supabase/tests/phase_02_slice_09_dec111_mfa_removal.sql',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-889]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): recent-step-up family sweep: tests re-run green against the aal2-plus-amr proof model (boundaries, constant, registry, own UUID, mfa_version, primaryAuthAt, no recovery codes, console and reset-form prerequisite states)',
  },
  {
    criterion: 'P2-S09-AC-890',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-proof-wire.test.ts apps/worker/src/authentication/phase-02-slice-09-r8-recovery.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-proof-wire.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-r8-recovery.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-890]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): recent-step-up family sweep: tests re-run green against the aal2-plus-amr proof model (boundaries, constant, registry, own UUID, mfa_version, primaryAuthAt, no recovery codes, console and reset-form prerequisite states)',
  },
  {
    criterion: 'P2-S09-AC-891',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-proof.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-proof.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-891]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): recent-step-up family sweep: tests re-run green against the aal2-plus-amr proof model (boundaries, constant, registry, own UUID, mfa_version, primaryAuthAt, no recovery codes, console and reset-form prerequisite states)',
  },
  {
    criterion: 'P2-S09-AC-892',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec111_mfa_schema.sql'],
    testMarkers: ['[P2-S09-AC-892]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-893',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset_reservation.sql',
    ],
    testMarkers: ['[P2-S09-AC-893]'],
    status: 'verified',
    limitation:
      'Locking of the target binding and grant is proven by the two-session runner 010-admin-reset-race.mjs (right after pnpm db:reset).',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec111/010-admin-reset-race.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-894',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/admin-mfa-reset-port.test.ts',
    testFiles: [
      'apps/worker/src/platform-configuration/admin-mfa-reset-port.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-894]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-895',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'apps/worker/src/event-consumers/security-notifier.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset_reservation.sql',
    ],
    testMarkers: ['[P2-S09-AC-895]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-896',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset_reservation.sql',
    ],
    testMarkers: ['[P2-S09-AC-896]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-db): dec111_admin_mfa_reset: login-method rows, login-methods projection with recoveryBaselinePresent, sessions, binding and acting-context bindings unchanged by the reset',
  },
  {
    criterion: 'P2-S09-AC-897',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset.sql',
      'supabase/tests/phase_02_slice_09_evidence_mfa.sql',
    ],
    testMarkers: ['[P2-S09-AC-897]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-898',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_mfa_schema.sql',
      'supabase/tests/phase_02_slice_09_r8_mfa_registry_machine.sql',
      'supabase/tests/phase_02_slice_09_dec111_mfa_self_views.sql',
    ],
    testMarkers: ['[P2-S09-AC-898]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-db): r8_mfa_registry_machine: enum is exactly five states, pending_expires_at only for pending/reconciling (CHECK), full 20-pair transition matrix on real rows with seven permitted edges and removed/expired terminal',
  },
  {
    criterion: 'P2-S09-AC-899',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec111_mfa_schema.sql'],
    testMarkers: ['[P2-S09-AC-899]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-900',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_mfa_schema.sql',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-900]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-901',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec111_mfa_schema.sql'],
    testMarkers: ['[P2-S09-AC-901]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-902',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
      'supabase/tests/phase_02_slice_09_dec111_mfa_schema.sql',
    ],
    testMarkers: ['[P2-S09-AC-902]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-903',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec111_mfa_self_views.sql'],
    testMarkers: ['[P2-S09-AC-903]'],
    status: 'verified',
    limitation:
      'Worker keeps service-role RPCs for self reads and all writes (as ruled); the views are the DB-level self-read surface under a user JWT.',
  },
  {
    criterion: 'P2-S09-AC-904',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
      'supabase/tests/phase_02_slice_09_dec111_mfa_schema.sql',
      'supabase/tests/phase_02_slice_09_r8_mfa_reconcile_lockout.sql',
      'supabase/tests/phase_02_slice_09_r8_mfa_registry_machine.sql',
    ],
    testMarkers: ['[P2-S09-AC-904]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-db): r8_mfa_registry_machine: enum is exactly five states, pending_expires_at only for pending/reconciling (CHECK), full 20-pair transition matrix on real rows with seven permitted edges and removed/expired terminal',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec111/012-settle-race.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-905',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_mfa_schema.sql',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-905]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-906',
    layer: 'db+web+b',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.multitab.dom.test.tsx apps/worker/src/authentication/phase-02-slice-09-r8-factor-refetch.test.ts; pnpm db:test',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.multitab.dom.test.tsx',
      'apps/worker/src/authentication/phase-02-slice-09-r8-factor-refetch.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
      'supabase/tests/phase_02_slice_09_r3_auth_error_rows.sql',
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.multitab-real-channel.dom.test.tsx',
      'tests/contracts/phase-02-slice-09-mfa-projection-pull-model.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-906]'],
    status: 'verified',
    limitation:
      "Owner-ratified DEC-128 (ledger row AC906): the pull model is proven: a guard asserts no MFA factor projection cache exists in any web or Worker source that reads it (mfa-projection-pull-model), every AUTH-API-16 read re-reads the database with a new ETag and is never cached (r8-factor-refetch), the browser refetches on the multi-tab broadcast, proven with the runtime's real BroadcastChannel and no stub (multitab-real-channel; the stubbed multitab test remains for signal shape), and the event payload is exactly { mfaFactorId, authBindingId } from every producer (r3_auth_error_rows).",
  },
  {
    criterion: 'P2-S09-AC-907',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
      'supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql',
    ],
    testMarkers: ['[P2-S09-AC-907]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-908',
    layer: 'db+integration+worker+a',
    command:
      'pnpm exec vitest run apps/worker/src/async-entrypoint-event-consumers.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-observability.test.ts apps/worker/src/authentication/phase-02-slice-09-r8-observability.test.ts apps/worker/src/event-consumers/reconciling-age.test.ts apps/worker/src/production-async-entrypoint-event-consumers.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/async-entrypoint-event-consumers.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-observability.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-r8-observability.test.ts',
      'apps/worker/src/event-consumers/reconciling-age.test.ts',
      'apps/worker/src/production-async-entrypoint-event-consumers.test.ts',
      'supabase/tests/phase_02_slice_09_g1_consumer_boundary.sql',
    ],
    testMarkers: ['[P2-S09-AC-908]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): r8-observability: every failed enrollment, verification and removal request is logged highRisk with samplingClass always so the sampler retains 100% of the traces; successful and other operations are not high-risk',
    supplementary: [
      'tests/db-integration/phase-02-slice-09-event-consumers.dbspec.ts',
    ],
  },
  {
    criterion: 'P2-S09-AC-909',
    layer: 'worker+a',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-step-up-method-registry.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-r8-aal-gates.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-step-up-conformance.test.ts apps/worker/src/profile-ownership/phase-02-slice-09-step-up-method-registry.test.ts tests/contracts/phase-02-slice-09-step-up-registry-conformance.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-step-up-method-registry.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-r8-aal-gates.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-step-up-conformance.test.ts',
      'apps/worker/src/profile-ownership/phase-02-slice-09-step-up-method-registry.test.ts',
      'tests/contracts/phase-02-slice-09-step-up-registry-conformance.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-909]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-910',
    layer: 'browser+c',
    command: 'pnpm test:e2e:s09-real',
    testFiles: [
      'tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts',
      'tests/e2e/phase-02-slice-09-schema-review-real-route.spec.ts',
      'tests/e2e/phase-02-slice-09-step-up-return-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-910]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-911',
    layer: 'browser+c',
    command: 'pnpm test:e2e:s09-real',
    testFiles: [
      'tests/e2e/phase-02-slice-09-schema-review-real-route.spec.ts',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-navigation.binding.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx',
      'apps/web/src/components/identity-authority/acting-context-switcher.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/clear-step-up-state-on-sign-in.test.ts',
      'apps/web/src/components/identity-authority/step-up-mfa/step-up-draft.test.ts',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-binding.test.ts',
      'apps/web/src/components/profile-ownership/profile-ownership-step-up-draft.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-step-up-return-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-911]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-912',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-provider.test.ts tests/security/phase-02-slice-09-mfa-provider-boundary.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-provider.test.ts',
      'tests/security/phase-02-slice-09-mfa-provider-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-912]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-913',
    layer: 'db+worker+integration+a',
    command:
      'pnpm exec vitest run apps/worker/src/async-entrypoint-event-consumers.test.ts apps/worker/src/async-runtime-consumer-outbox.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-provider.test.ts apps/worker/src/event-consumers/auth-state-reconciler-rpc.test.ts apps/worker/src/event-consumers/auth-state-reconciler.test.ts apps/worker/src/event-consumers/provider-factor-status.test.ts apps/worker/src/event-consumers/registry.test.ts apps/worker/src/production-async-entrypoint-event-consumers.test.ts packages/contracts/src/consumer-queue-events.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/async-entrypoint-event-consumers.test.ts',
      'apps/worker/src/async-runtime-consumer-outbox.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-provider.test.ts',
      'apps/worker/src/event-consumers/auth-state-reconciler-rpc.test.ts',
      'apps/worker/src/event-consumers/auth-state-reconciler.test.ts',
      'apps/worker/src/event-consumers/provider-factor-status.test.ts',
      'apps/worker/src/event-consumers/registry.test.ts',
      'apps/worker/src/production-async-entrypoint-event-consumers.test.ts',
      'packages/contracts/src/consumer-queue-events.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_mfa_enrollment.sql',
      'supabase/tests/phase_02_slice_09_g1_consumer_boundary.sql',
      'supabase/tests/phase_02_slice_09_r8_mfa_reconcile_lockout.sql',
    ],
    testMarkers: ['[P2-S09-AC-913]'],
    status: 'verified',
    limitation:
      'R6-db finding 2_reconcile_cas: RED 15 failed in mfa_enrollment, 2 in r3_auth_error_rows, 1 in mfa_schema; GREEN 281 tests pass in 4 files; race runner 012-settle-race.mjs 12 ok.',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec111/012-settle-race.mjs',
      'tests/db-integration/phase-02-slice-09-event-consumers.dbspec.ts',
    ],
  },
  {
    criterion: 'P2-S09-AC-914',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-dec111-proof-wire.test.ts apps/worker/src/authentication/phase-02-slice-09-dec111-provider.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-dec111-proof-wire.test.ts',
      'apps/worker/src/authentication/phase-02-slice-09-dec111-provider.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-914]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-915',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/admin-mfa-reset-port.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire-contract.test.ts tests/security/phase-02-slice-09-mfa-provider-boundary.test.ts',
    testFiles: [
      'apps/worker/src/platform-configuration/admin-mfa-reset-port.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire-contract.test.ts',
      'tests/security/phase-02-slice-09-mfa-provider-boundary.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-915]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-916',
    layer: 'b+db+worker+integration+a',
    command:
      'pnpm exec vitest run apps/worker/src/async-entrypoint-event-consumers.test.ts apps/worker/src/event-consumers/in-app-notification-provider.test.ts apps/worker/src/event-consumers/production.test.ts apps/worker/src/event-consumers/registry.test.ts apps/worker/src/event-consumers/retry-schedule.test.ts apps/worker/src/event-consumers/security-notifier-ports.test.ts apps/worker/src/event-consumers/security-notifier.test.ts apps/worker/src/production-async-entrypoint-event-consumers.test.ts packages/contracts/src/consumer-queue-events.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/async-entrypoint-event-consumers.test.ts',
      'apps/worker/src/event-consumers/in-app-notification-provider.test.ts',
      'apps/worker/src/event-consumers/production.test.ts',
      'apps/worker/src/event-consumers/registry.test.ts',
      'apps/worker/src/event-consumers/retry-schedule.test.ts',
      'apps/worker/src/event-consumers/security-notifier-ports.test.ts',
      'apps/worker/src/event-consumers/security-notifier.test.ts',
      'apps/worker/src/production-async-entrypoint-event-consumers.test.ts',
      'packages/contracts/src/consumer-queue-events.test.ts',
      'supabase/tests/phase_02_slice_09_ac916_in_app_notifications.sql',
      'supabase/tests/phase_02_slice_09_g1_consumer_boundary.sql',
    ],
    testMarkers: ['[P2-S09-AC-916]'],
    status: 'verified',
    limitation: 'none',
    supplementary: [
      'tests/db-integration/phase-02-slice-09-event-consumers.dbspec.ts',
    ],
  },
  {
    criterion: 'P2-S09-AC-917',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_grants.sql'],
    testMarkers: ['[P2-S09-AC-917]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-918',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset_settlement.sql',
    ],
    testMarkers: ['[P2-S09-AC-918]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-919',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-919]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-920',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire-contract.test.ts',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire-contract.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-920]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-921',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire-contract.test.ts',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire-contract.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-921]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-922',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire-contract.test.ts',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire-contract.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-922]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-923',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire-contract.test.ts',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire-contract.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-923]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-924',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-924]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-925',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-925]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-926',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-r2-evidence.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-r8-aal-gates.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-r2-evidence.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-r8-aal-gates.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset.sql',
    ],
    testMarkers: ['[P2-S09-AC-926]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): sessionStepUpAt requires token aal2 plus a valid MFA amr: aal1, aal2 without MFA amr, missing aal and amr-less tokens are 401 STEP_UP_REQUIRED with no effect, on AUTH-API-17/19 (r8-aal-proof) and the CMS and CFG-05B routes through real composition (aal2-cms-step-up-gates, r8-aal-gates)',
  },
  {
    criterion: 'P2-S09-AC-927',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset.sql'],
    testMarkers: ['[P2-S09-AC-927]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-928',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-928]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-929',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset.sql',
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset_reservation.sql',
    ],
    testMarkers: ['[P2-S09-AC-929]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-930',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset.sql',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset_reservation.sql',
    ],
    testMarkers: ['[P2-S09-AC-930]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-931',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_mfa.sql',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset_reservation.sql',
    ],
    testMarkers: ['[P2-S09-AC-931]'],
    status: 'verified',
    limitation:
      'One-transaction atomicity by a forced outbox failure in pgTAP; the target/grant locking by the two-session runner 010-admin-reset-race.mjs (right after pnpm db:reset).',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec111/010-admin-reset-race.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-932',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/admin-mfa-reset-port.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
    testFiles: [
      'apps/worker/src/platform-configuration/admin-mfa-reset-port.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-932]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-933',
    layer: 'db+a+b',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/admin-mfa-reset-port.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-r2-evidence.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/platform-configuration/admin-mfa-reset-port.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-r2-evidence.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset.sql',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset_settlement.sql',
    ],
    testMarkers: ['[P2-S09-AC-933]'],
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec111/010-admin-reset-race.mjs',
    ],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-db): dec111_admin_mfa_reset: the settlement emits one identity.mfa-factor.changed.v1 {mfaFactorId, authBindingId} for each factor it leaves reconciling, waking auth-state-reconciler',
  },
  {
    criterion: 'P2-S09-AC-934',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-rate-keying.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-rate-keying.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
      'supabase/tests/phase_02_slice_09_r3_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-934]'],
    status: 'verified',
    limitation:
      "The Worker maps CFG-05B-06 onto the shared limiter with fallback operation id AUTH-API-15 (production-rate-limit.ts); the buckets above are exercised under that id with the Worker's 5/3600 s user and 10/3600 s party limits.",
  },
  {
    criterion: 'P2-S09-AC-935',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire-contract.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire-contract.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset.sql',
    ],
    testMarkers: ['[P2-S09-AC-935]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-936',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset.sql',
      'apps/worker/src/platform-configuration/phase-02-slice-09-r14-expired-session.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-936]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-937',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset.sql',
      'supabase/tests/phase_02_slice_09_r3_recent_mfa.sql',
    ],
    testMarkers: ['[P2-S09-AC-937]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-938',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset.sql',
    ],
    testMarkers: ['[P2-S09-AC-938]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-939',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset.sql',
    ],
    testMarkers: ['[P2-S09-AC-939]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-940',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset_reservation.sql',
    ],
    testMarkers: ['[P2-S09-AC-940]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-941',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset_reservation.sql',
    ],
    testMarkers: ['[P2-S09-AC-941]'],
    status: 'verified',
    limitation:
      'Database half only: the HTTP status, ApiError envelope and details row are the Worker half (proven in the Worker lane); this proves the RPC raises exactly this token for the produced condition.',
  },
  {
    criterion: 'P2-S09-AC-942',
    layer: 'worker+db+a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/admin-route-admission-violations.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-r2-evidence.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/platform-configuration/admin-route-admission-violations.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-r2-evidence.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset.sql',
    ],
    testMarkers: ['[P2-S09-AC-942]'],
    status: 'verified',
    limitation:
      'Fixed (RED first): the 400 INVALID_REQUEST body-schema violation echoed zod library text, including a caller-supplied key name, as FieldViolation.code (BE00 requires a lowercase constraint code of 1..64 characters). admin-route-admission.ts now keeps contract tokens and replaces library text with invalid_value. The self-target stays 422 MFA_RESET_INVALID. | Database half: unknown key, blank and 513-character reason, malformed target and short idempotency key are INVALID_REQUEST; the self-target is MFA_RESET_INVALID.',
  },
  {
    criterion: 'P2-S09-AC-943',
    layer: 'db+a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-rate-keying.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-rate-keying.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
      'supabase/tests/phase_02_slice_09_r3_rate_limit.sql',
    ],
    testMarkers: ['[P2-S09-AC-943]'],
    status: 'verified',
    limitation:
      'Same as AC934; the BE00 ApiError envelope of the 429 is Worker-proven.',
  },
  {
    criterion: 'P2-S09-AC-944',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-r2-evidence.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
    testFiles: [
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-r2-evidence.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-cfg05b06-wire.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-944]'],
    status: 'verified',
    limitation:
      'Three branches are covered: identity RPC outage, settle outage after providers (503 IDENTITY_UNAVAILABLE), open provider circuit produced by real provider failures. A single provider failure is not 503: it is the 202 reconciling path (AC-933). The 504 deadline test no longer carries the AC-944 marker.',
  },
  {
    criterion: 'P2-S09-AC-945',
    layer: 'db+b',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/admin-mfa-reset-route.test.ts packages/contracts/src/platform-configuration/admin-mfa-reset.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/platform-configuration/admin-mfa-reset-route.test.ts',
      'packages/contracts/src/platform-configuration/admin-mfa-reset.test.ts',
      'supabase/tests/phase_02_slice_09_evidence_mfa.sql',
    ],
    testMarkers: ['[P2-S09-AC-945]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-946',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset.sql',
      'supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql',
    ],
    testMarkers: ['[P2-S09-AC-946]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-947',
    layer: 'db+b',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset_reservation.sql',
    ],
    testMarkers: ['[P2-S09-AC-947]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-948',
    layer: 'a',
    command:
      'pnpm exec vitest run apps/worker/src/platform-configuration/admin-mfa-reset-telemetry.test.ts',
    testFiles: [
      'apps/worker/src/platform-configuration/admin-mfa-reset-telemetry.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-948]'],
    status: 'verified',
    limitation: 'none',
  },
  {
    criterion: 'P2-S09-AC-949',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx apps/web/src/server/content-schema-registry-s09-r4-version-page.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
      'apps/web/src/server/content-schema-registry-s09-r4-version-page.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-949]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-950',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-in-flight.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-in-flight.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-950]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-951',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-951]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-952',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx apps/web/src/server/content-schema-registry-s09-r4-version-page.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
      'apps/web/src/server/content-schema-registry-s09-r4-version-page.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-952]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-953',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx apps/web/src/server/content-schema-review-context.test.ts apps/web/src/server/content-schema-review-s09-states.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
      'apps/web/src/server/content-schema-review-context.test.ts',
      'apps/web/src/server/content-schema-review-s09-states.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-953]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): typed ApiError renders its request ID (the earlier strip reversed), 429 retryable, 502/503/504 degraded with request ID and retry, 500/400 terminal',
  },
  {
    criterion: 'P2-S09-AC-954',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-canonical-projection-state.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-canonical-projection-state.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-954]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-955',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-states.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-states.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-955]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-956',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-956]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-957',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-957]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-958',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-958]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-959',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-959]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-960',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-dry-run-polling.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-dec108-preparation-panel.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-dry-run-polling.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-preparation-panel.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-960]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-961',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-preparation-panel.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-states.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-preparation-panel.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-states.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-961]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-962',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-dry-run-polling.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-dec108-preparation-panel.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-dry-run-polling.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-preparation-panel.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-962]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-963',
    layer: 'db+web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-dry-run-evidence.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-dec108-preparation-panel.test.tsx apps/worker/src/content-schema-registry/phase-02-slice-09-dec108-dry-run-evidence.test.ts packages/contracts/src/content-schema-registry/resources-dry-run-evidence.test.ts; pnpm db:test; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-dry-run-evidence.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-preparation-panel.test.tsx',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-dec108-dry-run-evidence.test.ts',
      'packages/contracts/src/content-schema-registry/resources-dry-run-evidence.test.ts',
      'supabase/tests/phase_02_slice_09_dec108_activation_preparation.sql',
      'tests/e2e/phase-02-slice-09-schema-version-real-route.spec.ts',
      'supabase/tests/phase_02_slice_09_scan_multifield.sql',
    ],
    testMarkers: ['[P2-S09-AC-963]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-964',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-preparation-panel.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-preparation-panel.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-964]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-965',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-dry-run-poll-error.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-states.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-dry-run-poll-error.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-states.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-965]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-966',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-canonical-projection-state.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-degraded-kept.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-states.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-canonical-projection-state.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-degraded-kept.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-states.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-966]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): production path keeps the last verified dryRunRef with lastVerifiedAt and keeps submit-review disabled (real server resolver into the island)',
  },
  {
    criterion: 'P2-S09-AC-967',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-states.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-states.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-967]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-968',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-dry-run-polling.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-dec108-form-roundtrip.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-dec108-version-forms.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-states.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-dry-run-polling.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-form-roundtrip.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-version-forms.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-states.test.tsx',
      'tests/e2e/phase-02-slice-09-schema-version-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-968]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-969',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-preparation-panel.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-preparation-panel.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-969]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-970',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-version-forms.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-version-forms.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-970]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-971',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-preparation-panel.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-preparation-panel.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-971]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-972',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-version-forms.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-ac972-degraded.test.tsx apps/web/src/server/content-schema-registry-s09-r4-review-route.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-version-forms.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-ac972-degraded.test.tsx',
      'apps/web/src/server/content-schema-registry-s09-r4-review-route.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-972]'],
    status: 'verified',
    limitation:
      'Re-audit lift (p240-app): orchestrator ruling kept the text: controls render only for listed actions; a listed action with missing prefill data renders unavailable, never hidden (6 tests)',
  },
  {
    criterion: 'P2-S09-AC-973',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-form-roundtrip.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-dec108-version-forms.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-form-roundtrip.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-version-forms.test.tsx',
      'tests/e2e/phase-02-slice-09-schema-version-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-973]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-974',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-fixtures.test.ts apps/web/src/server/content-schema-registry-dec108-island-privacy.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-fixtures.test.ts',
      'apps/web/src/server/content-schema-registry-dec108-island-privacy.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-974]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-975',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-assignment.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-assignment.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-975]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-976',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-assignment.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-assignment.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-976]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-977',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-977]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-978',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-assignment-revoke.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-dec108-facade.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-assignment-revoke.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-facade.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-978]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-979',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-facade.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-dec108-form-roundtrip.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-dec108-version-forms.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-form-errors.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-facade.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-form-roundtrip.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-version-forms.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-form-errors.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-979]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-980',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-facade.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-dec108-form-roundtrip.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-dec108-version-forms.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-dry-run-start-outcomes.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-form-errors.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-facade.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-form-roundtrip.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-version-forms.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-dry-run-start-outcomes.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-form-errors.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-980]'],
    status: 'verified',
    limitation:
      'Fixed (RED first): the activation-preparation panel now renders the queued dry run job reference (jobRef.id) beside its state; the 202 is announced as acceptance only, never a pass/fail result, count or hash. 409 and 422 are exercised with the transform pair filled: 422 links to and marks exactly the named transformKey/transformVersion inputs, 409 opens the sync conflict and keeps the pair.',
  },
  {
    criterion: 'P2-S09-AC-981',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-facade.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-form-errors.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx apps/web/src/server/content-schema-review-route-source.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-facade.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-form-errors.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx',
      'apps/web/src/server/content-schema-review-route-source.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-981]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-982',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-facade.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-roundtrip.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-form-errors.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-flash.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-facade.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-roundtrip.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-form-errors.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-flash.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-982]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-983',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-assignment-revoke.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-dec108-facade.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-roundtrip.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-form-errors.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-flash.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-assignment-revoke.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-facade.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-roundtrip.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-form-errors.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-flash.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-983]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-984',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx apps/web/src/server/content-schema-review-context.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
      'apps/web/src/server/content-schema-review-context.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-984]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-985',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-version-forms.test.tsx apps/web/src/server/content-schema-registry-s09-r4-version-page.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-version-forms.test.tsx',
      'apps/web/src/server/content-schema-registry-s09-r4-version-page.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-985]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-986',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-variant.test.tsx apps/web/src/server/content-schema-review-context.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-variant.test.tsx',
      'apps/web/src/server/content-schema-review-context.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-986]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-987',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-variant.test.tsx apps/web/src/server/content-schema-review-context.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-variant.test.tsx',
      'apps/web/src/server/content-schema-review-context.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-987]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-988',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-assignment.dom.test.tsx apps/web/src/server/cms-capability-grant-contracts.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-assignment.dom.test.tsx',
      'apps/web/src/server/cms-capability-grant-contracts.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-988]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-989',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-assignment.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-role-matrix.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-assignment.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-role-matrix.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-989]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-990',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx apps/web/src/server/cms-capability-grant-context.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx',
      'apps/web/src/server/cms-capability-grant-context.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-990]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-991',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx apps/web/src/server/cms-capability-grant-context.test.ts apps/web/src/server/cms-capability-grant-personas.test.tsx apps/web/src/server/cms-capability-grant-route-source.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
      'apps/web/src/server/cms-capability-grant-context.test.ts',
      'apps/web/src/server/cms-capability-grant-personas.test.tsx',
      'apps/web/src/server/cms-capability-grant-route-source.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-991]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-992',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx apps/web/src/server/cms-capability-grant-context.test.ts apps/web/src/server/cms-capability-grant-personas.test.tsx apps/web/src/server/cms-capability-grant-probe.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
      'apps/web/src/server/cms-capability-grant-context.test.ts',
      'apps/web/src/server/cms-capability-grant-personas.test.tsx',
      'apps/web/src/server/cms-capability-grant-probe.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-992]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-993',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-993]'],
    status: 'verified',
    limitation:
      'The commit button stays focusable while the form is invalid; an invalid submit is refused locally with linked errors and nothing is forwarded, rather than the button being natively disabled.',
  },
  {
    criterion: 'P2-S09-AC-994',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-994]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-995',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.rows.dom.test.tsx apps/web/src/server/cms-capability-grant-context.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.rows.dom.test.tsx',
      'apps/web/src/server/cms-capability-grant-context.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-995]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-996',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx apps/web/src/server/cms-capability-grant-context.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
      'apps/web/src/server/cms-capability-grant-context.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-996]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-997',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.controls.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx apps/web/src/components/cms-capability-grants/cms-capability-grant-client.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.controls.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-client.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-997]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-998',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r4.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r4.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-998]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-999',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-999]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1000',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1000]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1001',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.s09-criteria.dom.test.tsx apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.s09-criteria.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1001]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1002',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r8.dom.test.tsx apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r8.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1002]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): command 403 renders exactly the owner gate sentence with no disclosure beyond the request-id support reference',
  },
  {
    criterion: 'P2-S09-AC-1003',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1003]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1004',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
      'tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1004]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1005',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r8.dom.test.tsx apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r8.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1005]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): 422 maps each path onto its own field error, links the summary to it and keeps every typed value',
  },
  {
    criterion: 'P2-S09-AC-1006',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r4.dom.test.tsx apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r4.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1006]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1007',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/cms-capability-grant-client.test.ts apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-client.test.ts',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1007]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1008',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx apps/web/src/components/cms-capability-grants/cms-capability-grant-validation.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-validation.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1008]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1009',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx apps/web/src/components/cms-capability-grants/cms-capability-grant-validation.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-validation.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1009]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1010',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx apps/web/src/components/cms-capability-grants/cms-capability-grant-validation.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-validation.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1010]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1011',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx apps/web/src/components/cms-capability-grants/cms-capability-grant-validation.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-validation.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1011]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1012',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.rows.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.rows.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1012]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1013',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx apps/web/src/components/cms-capability-grants/cms-capability-grant-labels.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-labels.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1013]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1014',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.controls.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.privacy.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.controls.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.privacy.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1014]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1015',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1015]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1016',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/content-schema-registry-s09-r4-review-route.dom.test.tsx apps/web/src/server/content-schema-review-context.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/server/content-schema-registry-s09-r4-review-route.dom.test.tsx',
      'apps/web/src/server/content-schema-review-context.test.ts',
      'tests/e2e/phase-02-slice-09-schema-review-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1016]'],
    status: 'verified',
    limitation:
      'Acting-context and scope authority are decided by the platform read (a 2xx is the only proof); the web proves it propagates only the session cookie and maps each platform refusal, it does not re-derive authority. The "submitter" scope is the designer capability the platform returns; there is no separate submitter header.',
  },
  {
    criterion: 'P2-S09-AC-1017',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/content-schema-review-context.test.ts apps/web/src/server/content-schema-review-route-source.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/server/content-schema-review-context.test.ts',
      'apps/web/src/server/content-schema-review-route-source.test.ts',
      'tests/e2e/phase-02-slice-09-schema-review-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1017]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1018',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/content-schema-review-context.test.ts apps/web/src/server/content-schema-review-route-source.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/server/content-schema-review-context.test.ts',
      'apps/web/src/server/content-schema-review-route-source.test.ts',
      'tests/e2e/phase-02-slice-09-schema-review-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1018]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1019',
    layer: 'browser+web',
    command:
      'pnpm exec vitest run apps/web/src/server/content-schema-review-context.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/server/content-schema-review-context.test.ts',
      'tests/e2e/phase-02-slice-09-schema-version-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1019]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-1020',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-variant.test.tsx apps/web/src/server/content-schema-review-route-source.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-variant.test.tsx',
      'apps/web/src/server/content-schema-review-route-source.test.ts',
      'tests/e2e/phase-02-slice-09-schema-review-real-route.spec.ts',
      'tests/e2e/phase-02-slice-09-schema-version-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1020]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1021',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-invalidation.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-refetch.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-invalidation.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-refetch.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1021]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1022',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/cms-capability-grant-context.test.ts apps/web/src/server/cms-capability-grant-route-source.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/server/cms-capability-grant-context.test.ts',
      'apps/web/src/server/cms-capability-grant-route-source.test.ts',
      'tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1022]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1023',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx apps/web/src/server/cms-capability-grant-context.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx',
      'apps/web/src/server/cms-capability-grant-context.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1023]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1024',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.s09-criteria.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.s09-criteria.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1024]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1025',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.controls.dom.test.tsx apps/web/src/server/cms-capability-grant-contracts.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.controls.dom.test.tsx',
      'apps/web/src/server/cms-capability-grant-contracts.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1025]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1026',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1026]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1027',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-dec108-step-up.dom.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-step-up.dom.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-schema-review-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1027]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1028',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1028]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1029',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-step-up.dom.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/step-up-return.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-step-up.dom.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/step-up-return.test.ts',
      'tests/e2e/phase-02-slice-09-schema-review-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1029]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1030',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1030]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1031',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r12-step-up-key.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-step-up-activation.dom.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/step-up-recovery.r12.dom.test.tsx apps/worker/src/authentication/phase-02-slice-09-r12-step-up-key.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-r12-grant-step-up-key.test.ts apps/worker/src/platform-configuration/phase-02-slice-09-r12-cfg05b06-step-up-key.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r12-step-up-key.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-step-up-activation.dom.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/step-up-recovery.r12.dom.test.tsx',
      'apps/worker/src/authentication/phase-02-slice-09-r12-step-up-key.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r12-grant-step-up-key.test.ts',
      'apps/worker/src/platform-configuration/phase-02-slice-09-r12-cfg05b06-step-up-key.test.ts',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up-envelope.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r14-same-key-retry.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1031]'],
    status: 'verified',
    limitation:
      'DEC-122 (owner-ratified): Slice 09 routes only. Worker halves (r12): a stale proof is 401 STEP_UP_REQUIRED before any rate charge, reservation or port work and the same Idempotency-Key then succeeds exactly once for CMS-03A-15, 16 and 17, AUTH-API-17 and AUTH-API-19, and CFG-05B-06, and AUTH-API-20 and 21 carry no key; web halves: the step-up recovery link and the retry with the identical key (and If-Match for CMS-03A-16) for the grant console, the enrollment wizard and the reset form, plus the earlier CMS-03A-04, 12 and 14 drafts. The reset hook, grant console and wizard mint a new key after a step-up refusal where the draft may reuse the original; the original key is proven acceptable at the server. The CMS-03B recovery is received by Slice 11 AC-046 to AC-048.',
  },
  {
    criterion: 'P2-S09-AC-1032',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-step-up-return-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1032]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1033',
    layer: 'browser+web',
    command: 'pnpm test:e2e:s09-real',
    testFiles: ['tests/e2e/phase-02-slice-09-review-layout-real-route.spec.ts'],
    testMarkers: ['[P2-S09-AC-1033]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence. Virtual-keyboard behavior is emulated by shrinking the viewport height (Chrome desktop has no software keyboard).',
  },
  {
    criterion: 'P2-S09-AC-1034',
    layer: 'browser+web',
    command: 'pnpm test:e2e:s09-real',
    testFiles: ['tests/e2e/phase-02-slice-09-review-layout-real-route.spec.ts'],
    testMarkers: ['[P2-S09-AC-1034]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-1035',
    layer: 'browser+web',
    command: 'pnpm test:e2e:s09-real',
    testFiles: ['tests/e2e/phase-02-slice-09-review-layout-real-route.spec.ts'],
    testMarkers: ['[P2-S09-AC-1035]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-1036',
    layer: 'browser+web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.facts.dom.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.facts.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1036]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-1037',
    layer: 'browser+web',
    command: 'pnpm test:e2e:s09-real',
    testFiles: [
      'tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1037]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-1038',
    layer: 'browser+web',
    command: 'pnpm test:e2e:s09-real',
    testFiles: [
      'tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1038]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-1039',
    layer: 'db+web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-dry-run-evidence.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-dec108-dry-run-evidence.test.tsx apps/worker/src/content-schema-registry/phase-02-slice-09-dec108-dry-run-evidence.test.ts packages/contracts/src/content-schema-registry/resources-dry-run-evidence.test.ts; pnpm db:test; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-dry-run-evidence.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-dry-run-evidence.test.tsx',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-dec108-dry-run-evidence.test.ts',
      'packages/contracts/src/content-schema-registry/resources-dry-run-evidence.test.ts',
      'supabase/tests/phase_02_slice_09_dec108_activation_preparation.sql',
      'tests/e2e/phase-02-slice-09-schema-version-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1039]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1040',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1040]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): dec108-review-detail: precise group label and decision wording tied to each radio',
  },
  {
    criterion: 'P2-S09-AC-1041',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx apps/web/src/server/content-schema-review-route-source.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-review-detail.test.tsx',
      'apps/web/src/server/content-schema-review-route-source.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1041]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1042',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.controls.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.s09-criteria.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.controls.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.s09-criteria.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1042]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1043',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.rows.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.rows.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1043]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1044',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r4.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r4.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.render.test.tsx',
      'tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1044]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1045',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1045]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1046',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-review-criteria.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1046]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1047',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r8.dom.test.tsx apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.s09-criteria.dom.test.tsx apps/web/src/components/cms-capability-grants/cms-capability-grant-client.test.ts',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r8.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.s09-criteria.dom.test.tsx',
      'apps/web/src/components/cms-capability-grants/cms-capability-grant-client.test.ts',
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.rows.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1047]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): grant console: renewal and revocation reconciled against a canonical refetch, unconfirmed outcomes render pending, lapsed derived by the server not the browser clock',
  },
  {
    criterion: 'P2-S09-AC-1048',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1048]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1049',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-assignment-revoke.dom.test.tsx apps/web/src/server/content-schema-review-assignments-privacy.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-assignment-revoke.dom.test.tsx',
      'apps/web/src/server/content-schema-review-assignments-privacy.test.ts',
      'tests/e2e/phase-02-slice-09-schema-review-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1049]'],
    status: 'verified',
    limitation:
      'Reworded (DEC-122, owner-ratified) to the BE03a CMS-03A-14 revoke request: the revoke form sends assignmentId and the review expectedVersion as If-Match. The marked dom test asserts expectedVersion and If-Match equal the review version.',
  },
  {
    criterion: 'P2-S09-AC-1050',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/cms-capability-grant-personas.test.tsx',
    testFiles: [
      'apps/web/src/server/cms-capability-grant-personas.test.tsx',
      'tests/e2e/phase-02-slice-09-capability-grant-personas-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1050]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1051',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/cms-capability-grant-personas.test.tsx',
    testFiles: [
      'apps/web/src/server/cms-capability-grant-personas.test.tsx',
      'tests/e2e/phase-02-slice-09-capability-grant-personas-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1051]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1052',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/cms-capability-grant-personas.test.tsx',
    testFiles: [
      'apps/web/src/server/cms-capability-grant-personas.test.tsx',
      'tests/e2e/phase-02-slice-09-capability-grant-personas-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1052]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1053',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/cms-capability-grant-personas.test.tsx',
    testFiles: [
      'apps/web/src/server/cms-capability-grant-personas.test.tsx',
      'tests/e2e/phase-02-slice-09-capability-grant-personas-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1053]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1054',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/cms-capability-grant-personas.test.tsx',
    testFiles: [
      'apps/web/src/server/cms-capability-grant-personas.test.tsx',
      'tests/e2e/phase-02-slice-09-capability-grant-personas-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1054]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1055',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/cms-capability-grant-personas.test.tsx',
    testFiles: [
      'apps/web/src/server/cms-capability-grant-personas.test.tsx',
      'tests/e2e/phase-02-slice-09-capability-grant-personas-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1055]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1056',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/cms-capability-grant-personas.test.tsx',
    testFiles: [
      'apps/web/src/server/cms-capability-grant-personas.test.tsx',
      'tests/e2e/phase-02-slice-09-capability-grant-personas-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1056]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1057',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1057]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): recent-step-up family sweep: tests re-run green against the aal2-plus-amr proof model (boundaries, constant, registry, own UUID, mfa_version, primaryAuthAt, no recovery codes, console and reset-form prerequisite states)',
  },
  {
    criterion: 'P2-S09-AC-1058',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1058]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1059',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.r8.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.r8.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1059]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): StepUpChallengeForm.r8: radio group named by a legend with friendly-name labels, challenge created with POST, exactly one code input with paste allowed',
  },
  {
    criterion: 'P2-S09-AC-1060',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.r8.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.r8.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1060]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): StepUpChallengeForm.r8: radio group named by a legend with friendly-name labels, challenge created with POST, exactly one code input with paste allowed',
  },
  {
    criterion: 'P2-S09-AC-1061',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1061]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1062',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1062]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1063',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1063]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1064',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.lock.dom.test.tsx apps/web/src/server/step-up-page-context.test.ts',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.lock.dom.test.tsx',
      'apps/web/src/server/step-up-page-context.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1064]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1065',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/step-up-mfa-routes.test.ts apps/web/src/server/step-up-page-context.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/server/step-up-mfa-routes.test.ts',
      'apps/web/src/server/step-up-page-context.test.ts',
      'tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1065]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): unit and server-render proofs plus the production-built Chrome specs, which passed in the 2026-10-03 validation run (the Playwright JSON report is the cited receipt)',
  },
  {
    criterion: 'P2-S09-AC-1066',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/step-up-return.test.ts apps/web/src/server/step-up-page-context.test.ts',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/step-up-return.test.ts',
      'apps/web/src/server/step-up-page-context.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1066]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1067',
    layer: 'browser+web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/step-up-return.test.ts apps/web/src/server/step-up-auth-pages.dom.test.tsx apps/web/src/server/step-up-page-context.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/step-up-return.test.ts',
      'apps/web/src/server/step-up-auth-pages.dom.test.tsx',
      'apps/web/src/server/step-up-page-context.test.ts',
      'tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1067]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-1068',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.lock.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.lock.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1068]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1069',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-schema-review-real-route.spec.ts',
      'apps/web/src/components/identity-authority/step-up-mfa/step-up-draft.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1069]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1070',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/mfa-settings-page-context.test.ts apps/web/src/server/step-up-auth-pages.dom.test.tsx apps/web/src/server/step-up-mfa-routes.test.ts',
    testFiles: [
      'apps/web/src/server/mfa-settings-page-context.test.ts',
      'apps/web/src/server/step-up-auth-pages.dom.test.tsx',
      'apps/web/src/server/step-up-mfa-routes.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1070]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1071',
    layer: 'browser+web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.dom.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-mfa-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1071]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): the identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence. Virtual-keyboard behavior is emulated by shrinking the viewport height (Chrome desktop has no software keyboard).',
  },
  {
    criterion: 'P2-S09-AC-1072',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1072]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1073',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1073]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1074',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1074]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1075',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1075]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1076',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1076]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1077',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1077]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1078',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx apps/web/src/server/step-up-mfa-routes.test.ts',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
      'apps/web/src/server/step-up-mfa-routes.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1078]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1079',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1079]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1080',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1080]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1081',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.r4.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.r4.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1081]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1082',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1082]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1083',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1083]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1084',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1084]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1085',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.r8.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.r8.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1085]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): StepUpChallengeForm.r8: radio group named by a legend with friendly-name labels, challenge created with POST, exactly one code input with paste allowed',
  },
  {
    criterion: 'P2-S09-AC-1086',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/one-time-code.test.ts',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/one-time-code.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1086]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1087',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/one-time-code.test.ts',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/one-time-code.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1087]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1088',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1088]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1089',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/step-up-failure.test.ts',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/step-up-failure.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1089]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1090',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1090]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1091',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1091]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1092',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1092]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1093',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1093]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1094',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1094]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1095',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.r8.dom.test.tsx apps/worker/src/authentication/phase-02-slice-09-r8-wire-rows.test.ts',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.r8.dom.test.tsx',
      'apps/worker/src/authentication/phase-02-slice-09-r8-wire-rows.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1095]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): AUTH-API-17..21 answer 403 with exactly reasonCode origin_csrf_required for a forged token and a foreign origin and reach no persistence or provider; the step-up form shows the reload copy and a working Reload for both reasonCodes',
  },
  {
    criterion: 'P2-S09-AC-1096',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.lock.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.lock.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1096]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1097',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.errors.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1097]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1098',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.recovery.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/step-up-return.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.recovery.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/step-up-return.test.ts',
      'tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1098]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): unit and server-render proofs plus the production-built Chrome specs, which passed in the 2026-10-03 validation run (the Playwright JSON report is the cited receipt)',
  },
  {
    criterion: 'P2-S09-AC-1099',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/step-up-role-neutrality.test.ts',
    testFiles: ['apps/web/src/server/step-up-role-neutrality.test.ts'],
    testMarkers: ['[P2-S09-AC-1099]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1100',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/server/step-up-role-neutrality.test.ts',
    testFiles: ['apps/web/src/server/step-up-role-neutrality.test.ts'],
    testMarkers: ['[P2-S09-AC-1100]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1101',
    layer: 'browser+web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/focus-page-heading.test.ts apps/web/src/server/step-up-auth-pages.dom.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/focus-page-heading.test.ts',
      'apps/web/src/server/step-up-auth-pages.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1101]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-1102',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1102]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1103',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.lock.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.lock.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1103]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1104',
    layer: 'browser+web',
    command: 'pnpm test:e2e:s09-real',
    testFiles: ['tests/e2e/phase-02-slice-09-mfa-real-route.spec.ts'],
    testMarkers: ['[P2-S09-AC-1104]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): the identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence. Virtual-keyboard behavior is emulated by shrinking the viewport height (Chrome desktop has no software keyboard).',
  },
  {
    criterion: 'P2-S09-AC-1105',
    layer: 'browser+web',
    command: 'pnpm test:e2e:s09-real',
    testFiles: ['tests/e2e/phase-02-slice-09-mfa-real-route.spec.ts'],
    testMarkers: ['[P2-S09-AC-1105]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): the identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence. Virtual-keyboard behavior is emulated by shrinking the viewport height (Chrome desktop has no software keyboard).',
  },
  {
    criterion: 'P2-S09-AC-1106',
    layer: 'browser+web',
    command: 'pnpm test:e2e:s09-real',
    testFiles: ['tests/e2e/phase-02-slice-09-mfa-real-route.spec.ts'],
    testMarkers: ['[P2-S09-AC-1106]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): the identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence. Virtual-keyboard behavior is emulated by shrinking the viewport height (Chrome desktop has no software keyboard).',
  },
  {
    criterion: 'P2-S09-AC-1107',
    layer: 'browser+web',
    command: 'pnpm test:e2e:s09-real',
    testFiles: ['tests/e2e/phase-02-slice-09-mfa-real-route.spec.ts'],
    testMarkers: ['[P2-S09-AC-1107]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): the identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence. Virtual-keyboard behavior is emulated by shrinking the viewport height (Chrome desktop has no software keyboard).',
  },
  {
    criterion: 'P2-S09-AC-1108',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx apps/web/src/server/admin-mfa-reset-page-context.test.ts apps/web/src/server/admin-mfa-reset-page-production.test.ts apps/web/src/server/admin-mfa-reset-route.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx',
      'apps/web/src/server/admin-mfa-reset-page-context.test.ts',
      'apps/web/src/server/admin-mfa-reset-page-production.test.ts',
      'apps/web/src/server/admin-mfa-reset-route.test.ts',
      'tests/e2e/phase-02-slice-09-admin-mfa-reset-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1108]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1109',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts apps/web/src/server/admin-mfa-reset-page-context.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts',
      'apps/web/src/server/admin-mfa-reset-page-context.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1109]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): recent-step-up family sweep: tests re-run green against the aal2-plus-amr proof model (boundaries, constant, registry, own UUID, mfa_version, primaryAuthAt, no recovery codes, console and reset-form prerequisite states)',
  },
  {
    criterion: 'P2-S09-AC-1110',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-values.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-values.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1110]'],
    status: 'verified',
    limitation:
      'The helper copy is pinned in admin-mfa-reset-copy.test.ts; the UUID validation on blur and submit is in the dom and values tests.',
  },
  {
    criterion: 'P2-S09-AC-1111',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-values.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-values.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1111]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): reason is a required native textarea (required attribute) with a character count announced in a polite live region',
  },
  {
    criterion: 'P2-S09-AC-1112',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-api.test.ts apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-values.test.ts apps/web/src/server/admin-mfa-reset-proxy.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-api.test.ts',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-values.test.ts',
      'apps/web/src/server/admin-mfa-reset-proxy.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1112]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1113',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-api.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-api.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1113]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1114',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1114]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1115',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1115]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1116',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1116]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1117',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1117]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1118',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1118]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1119',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1119]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1120',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1120]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1121',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1121]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1122',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
      'apps/web/src/components/identity-authority/step-up-mfa/mfa-failure.test.ts',
      'tests/e2e/phase-02-slice-09-admin-mfa-reset-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1122]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1123',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1123]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1124',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.outcomes.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1124]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1125',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-copy.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1125]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1126',
    layer: 'browser+web',
    command:
      'pnpm exec vitest run apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-admin-mfa-reset-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1126]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-1127',
    layer: 'browser+web+c',
    command:
      'pnpm exec vitest run apps/web/src/components/authentication/login-method-manager/LoginMethodErrorPanel.test.tsx apps/web/src/components/identity-authority/identity-authority-step-up-error-class.test.ts apps/web/src/components/identity-authority/step-up-mfa/StepUpRecoveryLink.dom.test.tsx apps/web/src/components/infrastructure/InfrastructureWorkbenchStatus.step-up.test.tsx apps/web/src/components/infrastructure/infrastructure-workbench-state.step-up.test.ts apps/web/src/components/infrastructure/provider-evidence/provider-evidence-step-up.test.tsx apps/web/src/components/step-up-error-class.cross-surface.test.ts tests/contracts/infrastructure-step-up-view-state.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/authentication/login-method-manager/LoginMethodErrorPanel.test.tsx',
      'apps/web/src/components/identity-authority/identity-authority-step-up-error-class.test.ts',
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpRecoveryLink.dom.test.tsx',
      'apps/web/src/components/infrastructure/InfrastructureWorkbenchStatus.step-up.test.tsx',
      'apps/web/src/components/infrastructure/infrastructure-workbench-state.step-up.test.ts',
      'apps/web/src/components/infrastructure/provider-evidence/provider-evidence-step-up.test.tsx',
      'apps/web/src/components/step-up-error-class.cross-surface.test.ts',
      'tests/contracts/infrastructure-step-up-view-state.test.ts',
      'tests/e2e/phase-02-slice-09-schema-review-real-route.spec.ts',
      'apps/web/src/components/profile-ownership/profile-ownership-step-up.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r14b-gate-reason.dom.test.tsx',
      'apps/web/src/components/profile-ownership/profile-ownership-step-up-draft.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1127]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): cross-surface test: identity, CFG-05B-06 admin MFA reset, infrastructure, provider evidence and CMS commands route STEP_UP_REQUIRED to /step-up and never to a 403 gate or sign-in (no single global CapabilityGate component exists; each surface owns its mapping)',
  },
  {
    criterion: 'P2-S09-AC-1128',
    layer: 'db+web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-ia-edges-review.dom.test.tsx; pnpm db:test',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-ia-edges-review.dom.test.tsx',
      'supabase/tests/phase_02_slice_09_r3_ia_edge_cases.sql',
    ],
    testMarkers: ['[P2-S09-AC-1128]'],
    status: 'verified',
    limitation:
      "The decision refusals are NOT_FOUND (assignment failures are concealed per BE03a: 'a caller without assignment cannot distinguish it'), not FORBIDDEN. Assignment windows are shifted with s09d_timewarp on the REAL assignment row (no row is created).",
  },
  {
    criterion: 'P2-S09-AC-1129',
    layer: 'db+web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-ia-edges-review.dom.test.tsx; pnpm db:test',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-ia-edges-review.dom.test.tsx',
      'supabase/tests/phase_02_slice_09_r3_ia_edge_cases.sql',
    ],
    testMarkers: ['[P2-S09-AC-1129]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1130',
    layer: 'db+web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-ia-edges-review.dom.test.tsx; pnpm db:test',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-ia-edges-review.dom.test.tsx',
      'supabase/tests/phase_02_slice_09_r3_ia_edge_cases.sql',
    ],
    testMarkers: ['[P2-S09-AC-1130]'],
    status: 'verified',
    limitation:
      'The stale-version loser is proven sequentially in pgTAP and the true two-session race by 012-concurrent-commands.mjs (needs a freshly reset database; run once and reset again).',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec108/012-concurrent-commands.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-1131',
    layer: 'db+web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-ia-edges-lifecycle.dom.test.tsx; pnpm db:test',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-ia-edges-lifecycle.dom.test.tsx',
      'supabase/tests/phase_02_slice_09_r3_ia_edge_cases.sql',
    ],
    testMarkers: ['[P2-S09-AC-1131]'],
    status: 'verified',
    limitation:
      'Resubmission freezing new evidence is asserted for the dependency-drift and specialist-loss cases; compiler drift is a privileged recompile (guards disabled for the single UPDATE). Policy-hash drift on the candidate is covered by the existing DEC-109 suite, not repeated here.',
  },
  {
    criterion: 'P2-S09-AC-1132',
    layer: 'db+web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-ia-edges-lifecycle.dom.test.tsx; pnpm db:test',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-ia-edges-lifecycle.dom.test.tsx',
      'supabase/tests/phase_02_slice_09_r3_ia_edge_cases.sql',
    ],
    testMarkers: ['[P2-S09-AC-1132]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1133',
    layer: 'db+web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.ia-edges.dom.test.tsx; pnpm db:test',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.ia-edges.dom.test.tsx',
      'supabase/tests/phase_02_slice_09_r3_ia_edge_cases.sql',
      'supabase/tests/phase_02_slice_09_r8_grant_owner_without_grants.sql',
    ],
    testMarkers: ['[P2-S09-AC-1133]'],
    status: 'verified',
    limitation:
      "Recent MFA and the live binding are asserted through the step-up proof and binding refusals (AC523/AC091 suite); the 'receipt identity only' clause is asserted by a lapsed own designer grant plus a FORBIDDEN current-grant designer.",
  },
  {
    criterion: 'P2-S09-AC-1134',
    layer: 'db+web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.ia-edges.dom.test.tsx; pnpm db:test',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.ia-edges.dom.test.tsx',
      'supabase/tests/phase_02_slice_09_r3_ia_edge_cases.sql',
    ],
    testMarkers: ['[P2-S09-AC-1134]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1135',
    layer: 'db+web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-ia-edges-lifecycle.dom.test.tsx apps/worker/src/production-cms-review-authority-sweep.test.ts apps/worker/src/scheduled-manual-review-retry.test.ts; pnpm db:test',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-ia-edges-lifecycle.dom.test.tsx',
      'apps/worker/src/production-cms-review-authority-sweep.test.ts',
      'apps/worker/src/scheduled-manual-review-retry.test.ts',
      'supabase/tests/phase_02_slice_09_r3_expiry_sweep.sql',
      'supabase/tests/phase_02_slice_09_r3_ia_edge_cases.sql',
    ],
    testMarkers: ['[P2-S09-AC-1135]'],
    status: 'verified',
    limitation:
      'Expiry is handled by the scheduled review-authority sweep (migration 20261002193000, platform_api.cms_sweep_expired_review_authority, run by the Worker scheduled handler): it invalidates every open or approved review whose counted approve decision relied on a specialist capability or assignment that has since lapsed, returns the candidate to draft, writes the audit and outbox rows, is bounded and idempotent; the pgTAP suite produces every candidate, review, assignment, decision and grant through the named producers and only time-shifts authority windows. The activation recheck stays as the second line and revocation invalidates eagerly through its own event.',
  },
  {
    criterion: 'P2-S09-AC-1136',
    layer: 'db+web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-ia-edges-lifecycle.dom.test.tsx; pnpm db:test',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-ia-edges-lifecycle.dom.test.tsx',
      'supabase/tests/phase_02_slice_09_r3_ia_edge_cases.sql',
    ],
    testMarkers: ['[P2-S09-AC-1136]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1137',
    layer: 'db+web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.ia-edges.dom.test.tsx; pnpm db:test',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.ia-edges.dom.test.tsx',
      'supabase/tests/phase_02_slice_09_r3_ia_edge_cases.sql',
    ],
    testMarkers: ['[P2-S09-AC-1137]'],
    status: 'verified',
    limitation:
      'Sequential version-race proof in pgTAP plus the two-session race in 012-concurrent-commands.mjs (needs a freshly reset database).',
    supplementary: [
      'supabase/tests/phase_02_slice_09_dec108/012-concurrent-commands.mjs',
    ],
  },
  {
    criterion: 'P2-S09-AC-1138',
    layer: 'db+web',
    command:
      'pnpm exec vitest run apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.ia-edges.dom.test.tsx; pnpm db:test',
    testFiles: [
      'apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.ia-edges.dom.test.tsx',
      'supabase/tests/phase_02_slice_09_r3_ia_edge_cases.sql',
    ],
    testMarkers: ['[P2-S09-AC-1138]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1139',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-dec108-step-up.dom.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-dec108-step-up.dom.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-step-up.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1139]'],
    status: 'verified',
    limitation:
      'Web layer only: the typed step-up result, draft survival and no replay after step-up are proven here; the worker-side refusal before any mutation belongs to the worker lanes.',
  },
  {
    criterion: 'P2-S09-AC-1140',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx apps/web/src/server/step-up-no-factor-detour.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.dom.test.tsx',
      'apps/web/src/server/step-up-no-factor-detour.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1140]'],
    status: 'verified',
    limitation:
      'Composed from the real command form and runtime, the real /step-up and /settings/security/mfa server resolvers over a scripted binding and the real islands: the interrupted command is refused once and not replayed; a person with no verified factor is routed to enrollment with no challenge created; enrollment returns to the interrupted page; on return the form is restored for confirmation and nothing is submitted until the person confirms.',
  },
  {
    criterion: 'P2-S09-AC-1141',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/MfaEnrollmentWizard.removal.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1141]'],
    status: 'verified',
    limitation:
      'Web layer only: the last-factor refusal is rendered and leaves the list unchanged; the worker-side refusal is proven in the auth lane.',
  },
  {
    criterion: 'P2-S09-AC-1142',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/identity-authority/step-up-mfa/no-recovery-codes.test.ts apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx apps/worker/src/authentication/phase-02-slice-09-r8-recovery.test.ts',
    testFiles: [
      'apps/web/src/components/identity-authority/step-up-mfa/no-recovery-codes.test.ts',
      'apps/web/src/components/platform-configuration/admin-mfa-reset/AdminMfaFactorResetForm.dom.test.tsx',
      'apps/worker/src/authentication/phase-02-slice-09-r8-recovery.test.ts',
      'apps/web/src/components/identity-authority/step-up-mfa/StepUpChallengeForm.recovery.dom.test.tsx',
      'apps/worker/src/platform-configuration/phase-02-slice-09-r14-lost-every-factor.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1142]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): no recovery-code route (8 routes exactly 404, no RPC, no provider call), no recovery-code copy or bypass control, audited runbook cited by the reset form',
  },
  {
    criterion: 'P2-S09-AC-1143',
    layer: 'contracts',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1143]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1144',
    layer: 'contracts',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-evidence-cascade.test.ts tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-evidence-cascade.test.ts',
      'tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts',
      'tests/contracts/phase-02-slice-09-receipts-guard.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1144]'],
    status: 'verified',
    limitation:
      'The integrator guard requires every checked amendment criterion to be verified by an index entry whose receipts record zero failures; plan and tracker rows are mirrored with contiguous IDs and identical descriptions.',
  },
  {
    criterion: 'P2-S09-AC-1145',
    layer: 'contracts',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-evidence-cascade.test.ts tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-evidence-cascade.test.ts',
      'tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1145]'],
    status: 'verified',
    limitation:
      'The completion-policy guard computes the verified count from the index and the denominators from the authored rows and the ledger accounting instead of pinning a literal.',
  },
  {
    criterion: 'P2-S09-AC-1146',
    layer: 'contracts',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-ledger-guard.test.ts tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-ledger-guard.test.ts',
      'tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1146]'],
    status: 'verified',
    limitation:
      'The ledger rewording table accounts row by row for every criterion whose claim an amendment or later ruling changed (reworded with its authority, or reopened), including the two the re-audit named (AC233 and AC005), and the ledger guard asserts the table against the plan.',
  },
  {
    criterion: 'P2-S09-AC-1147',
    layer: 'contracts',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts',
      'tests/contracts/phase-02-slice-09-pre-traceability.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1147]'],
    status: 'verified',
    limitation:
      'Owner-ratified DEC-124 (ledger row AC1147): the transferred count is recorded (original later-only topics 0; Slice 11: 3, Slice 12: 3, Slice 16: 1) and every receiving criterion is an open row in its owner slice; the gating of Slices 10 and 12 on the amended criteria is asserted by the completion-policy guard.',
  },
  {
    criterion: 'P2-S09-AC-1148',
    layer: 'process',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-ledger-guard.test.ts',
    testFiles: ['tests/contracts/phase-02-slice-09-ledger-guard.test.ts'],
    testMarkers: ['[P2-S09-AC-1148]'],
    status: 'verified',
    limitation:
      'Digests and line counts are regenerated by the integrator after the specs settled; the guard compares them to the current files while Slice 09 is open and checks they are well-formed once it is complete.',
  },
  {
    criterion: 'P2-S09-AC-1149',
    layer: 'eng+contracts',
    command:
      'pnpm exec vitest run tests/contracts/phase-02-slice-09-evidence-cascade.test.ts tests/contracts/phase-02-slice-09-locked-traceability.test.ts',
    testFiles: [
      'tests/contracts/phase-02-slice-09-evidence-cascade.test.ts',
      'tests/contracts/phase-02-slice-09-locked-traceability.test.ts',
      'tests/contracts/phase-02-slice-09-marker-citations.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1149]'],
    status: 'verified',
    limitation:
      'One Slice 10 prerequisite statement appears once in plan, tracker, phase tracker, progress index and spec pipeline, the plan and tracker prerequisite lines are identical, and the open-criteria block it names exists in the tracker and lists every open criterion of the evidence index (evidence-cascade guard).',
  },
  {
    criterion: 'P2-S09-AC-1150',
    layer: 'a+docs',
    command:
      'pnpm exec vitest run apps/worker/src/authentication/phase-02-slice-09-r8-settle-recovery.test.ts tests/security/phase-02-slice-09-sole-admin-runbook.test.ts',
    testFiles: [
      'apps/worker/src/authentication/phase-02-slice-09-r8-settle-recovery.test.ts',
      'tests/security/phase-02-slice-09-sole-admin-runbook.test.ts',
      'tests/contracts/phase-02-slice-09-sole-admin-runbook-hop.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1150]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-auth): a step-up challenge for a factor the provider no longer has marks it reconciling and answers 409 no_verified_factor with enroll_factor; end-to-end recovery test; runbook guard retained',
  },
  {
    criterion: 'P2-S09-AC-1151',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1151]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1152',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1152]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): defaultLocale of 1 and 36 characters refused as not canonical, a 2-character defaultLocale accepted',
  },
  {
    criterion: 'P2-S09-AC-1153',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1153]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1154',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1154]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1155',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1155]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1156',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1156]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1157',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1157]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1158',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_od4_locale_config.sql',
      'supabase/tests/phase_02_slice_09_od4_locale_validator.sql',
    ],
    testMarkers: ['[P2-S09-AC-1158]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1159',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1159]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1160',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1160]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1161',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1161]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1162',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1162]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1163',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1163]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1164',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1164]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1165',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_od4_locale_config.sql',
      'supabase/tests/phase_02_slice_09_od4_locale_validator.sql',
    ],
    testMarkers: ['[P2-S09-AC-1165]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1166',
    layer: 'contracts+worker+db',
    command:
      'pnpm exec vitest run apps/worker/src/cms-composition-production-locale.test.ts apps/worker/src/cms-composition/locale-routes.test.ts packages/contracts/src/cms-composition/locale-variant.test.ts packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts; pnpm db:test',
    testFiles: [
      'apps/worker/src/cms-composition-production-locale.test.ts',
      'apps/worker/src/cms-composition/locale-routes.test.ts',
      'packages/contracts/src/cms-composition/locale-variant.test.ts',
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
      'supabase/tests/phase_02_slice_12_locale_author_rpc.sql',
    ],
    testMarkers: ['[P2-S09-AC-1166]'],
    status: 'verified',
    limitation:
      'Declaration (the three localization modes, closed set, required) and per-variant storage (request and resource carry noFallbackFieldIds, required, bounded at 128 UUIDs, duplicates refused). Public resolution is Slice 12/15 (CMS-15, DEC-121), outside this criterion. | The per-variant set reaches the authoring port and the stored set is returned; a success whose stored set differs from the requested set is 502; duplicated or non-UUID members are 422 before persistence; the database refusal of a nonlocalizable field declared as no_fallback maps to the 422 catalog code without naming the field. | Database half: a nonlocalizable field in noFallbackFieldIds and a nonlocalizable field in fields are VALIDATION_FAILED; the variant row stores its own no_fallback_field_ids.',
  },
  {
    criterion: 'P2-S09-AC-1167',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1167]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1168',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1168]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1169',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1169]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1170',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1170]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1171',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1171]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1172',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1172]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1173',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1173]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1174',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1174]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1175',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1175]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1176',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1176]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1177',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1177]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1178',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1178]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1179',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1179]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1180',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1180]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1181',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1181]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): OD-4 refusal rows now assert the violation member path (BE00 FieldViolation) with the exact messages; the wire carries a JSON pointer string in path',
  },
  {
    criterion: 'P2-S09-AC-1182',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/web/src/server/content-schema-registry-platform-error-details.test.ts apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts; pnpm db:test',
    testFiles: [
      'apps/web/src/server/content-schema-registry-platform-error-details.test.ts',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
      'supabase/tests/phase_02_slice_09_r8_error_details.sql',
      'apps/worker/src/content-schema-registry/phase-02-slice-09-r14-locale-successor.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1182]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-worker-cms): CMS locale violations are exactly {path, message} (pgTAP r8_error_details), the Worker and web sanitizer emit path, drop a pointer member',
  },
  {
    criterion: 'P2-S09-AC-1183',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1183]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1184',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/locale-config.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/locale-config.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1184]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1185',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_od4_locale_config.sql'],
    testMarkers: ['[P2-S09-AC-1185]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1186',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_misc.sql',
      'supabase/tests/phase_02_slice_09_od4_locale_config.sql',
    ],
    testMarkers: ['[P2-S09-AC-1186]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1187',
    layer: 'worker',
    command:
      'pnpm exec vitest run apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    testFiles: [
      'apps/worker/src/content-schema-registry/phase-02-slice-09-od4-locale-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1187]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1188',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_od4_locale_config.sql'],
    testMarkers: ['[P2-S09-AC-1188]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1189',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_od4_locale_config.sql'],
    testMarkers: ['[P2-S09-AC-1189]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1190',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_od4_locale_config.sql'],
    testMarkers: ['[P2-S09-AC-1190]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1191',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_od4_locale_config.sql',
      'supabase/tests/phase_02_slice_09_r8_od4_locale_recompute.sql',
    ],
    testMarkers: ['[P2-S09-AC-1191]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-db): r8_od4_locale_recompute: drift of the candidate locale columns with both stored hash columns agreeing yields CONFLICT with nothing mutated',
  },
  {
    criterion: 'P2-S09-AC-1192',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_od4_locale_config.sql'],
    testMarkers: ['[P2-S09-AC-1192]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1193',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_od4_locale_config.sql'],
    testMarkers: ['[P2-S09-AC-1193]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1194',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/locale-config-schemas.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/locale-config-schemas.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1194]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1195',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_od4_locale_config.sql'],
    testMarkers: ['[P2-S09-AC-1195]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1196',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_od4_locale_config.sql'],
    testMarkers: ['[P2-S09-AC-1196]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1197',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_trigger_catalog.sql',
      'supabase/tests/phase_02_slice_09_od4_locale_config.sql',
      'supabase/tests/phase_02_slice_09_scan_locale_only.sql',
      'supabase/tests/phase_02_slice_09_scan_locale_variants.sql',
    ],
    testMarkers: ['[P2-S09-AC-1197]'],
    status: 'verified',
    limitation:
      "Publication versions are still counted by the same source set, but no Slice 09 producer exists for cms_publication_versions, so 'affected publications' stays proven only by the existing unit-level count and not by a producer-created fixture.",
  },
  {
    criterion: 'P2-S09-AC-1198',
    layer: 'contracts',
    command:
      'pnpm exec vitest run packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    testFiles: [
      'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1198]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1199',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reports.sql',
    ],
    testMarkers: ['[P2-S09-AC-1199]'],
    status: 'verified',
    limitation:
      'evidence_constraints_reports: source_locale and default_locale are text columns (col_type_is), NOT NULL in the catalog and by insert, and the BCP 47 shape CHECK accepts and refuses.',
  },
  {
    criterion: 'P2-S09-AC-1200',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reports.sql',
    ],
    testMarkers: ['[P2-S09-AC-1200]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1201',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reports.sql',
    ],
    testMarkers: ['[P2-S09-AC-1201]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1202',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reports.sql',
    ],
    testMarkers: ['[P2-S09-AC-1202]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1203',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_misc.sql',
      'supabase/tests/phase_02_slice_09_od4_locale_config.sql',
      'supabase/tests/phase_02_slice_09_od4_locale_validator.sql',
      'supabase/tests/phase_02_slice_09_r8_locale_validator_path.sql',
    ],
    testMarkers: ['[P2-S09-AC-1203]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-db): draft and successor RPCs now run platform_api.cms_validate_locale_config (migration 201000); r8_locale_validator_path asserts the sentinel reaches both RPC refusals and message equivalence over the whole matrix',
  },
  {
    criterion: 'P2-S09-AC-1204',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: [
      'supabase/tests/phase_02_slice_09_evidence_constraints_reports.sql',
    ],
    testMarkers: ['[P2-S09-AC-1204]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1205',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_od4_locale_config.sql'],
    testMarkers: ['[P2-S09-AC-1205]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1206',
    layer: 'db',
    command: 'pnpm db:test',
    testFiles: ['supabase/tests/phase_02_slice_09_evidence_misc.sql'],
    testMarkers: ['[P2-S09-AC-1206]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1207',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1207]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1208',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1208]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1209',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1209]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1210',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1210]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1211',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-locale.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-locale.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1211]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1212',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1212]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1213',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1213]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1214',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1214]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1215',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1215]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1216',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1216]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1217',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1217]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1218',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1218]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1219',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1219]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1220',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1220]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1221',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1221]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1222',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-successor.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-successor.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1222]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1223',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-successor.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-successor.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1223]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1224',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1224]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1225',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1225]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1226',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1226]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1227',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-successor.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1227]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1228',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1228]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1229',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-locale-states.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-locale-states.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1229]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1230',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-mutations.test.ts apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-feedback.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-mutations.test.ts',
      'apps/web/src/components/content-schema-registry/content-schema-registry-runtime-dom-feedback.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1230]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1231',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-locale-states.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-locale.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-locale-states.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r4-locale.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1231]'],
    status: 'verified',
    limitation:
      'Only the locale conflict panel gates Reapply; the generic non-locale conflict panel still resubmits unchanged (outside this criterion).',
  },
  {
    criterion: 'P2-S09-AC-1232',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-detail.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-result-focus.dom.test.ts apps/web/src/lib/route-heading-focus.test.ts; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-detail.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-r8-result-focus.dom.test.ts',
      'apps/web/src/lib/route-heading-focus.test.ts',
      'tests/e2e/phase-02-slice-09-registry-browser-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1232]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): unit and server-render proofs plus the production-built Chrome specs, which passed in the 2026-10-03 validation run (the Playwright JSON report is the cited receipt)',
  },
  {
    criterion: 'P2-S09-AC-1233',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-s09-locale-states.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-locale-states.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1233]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1234',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.r8.dom.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.r8.dom.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1234]'],
    status: 'verified',
    limitation:
      'Re-audit lift (r8-web): focus after Remove moves to the next entry or the Add input, every button has a distinct accessible name containing the tag (and target for chains)',
  },
  {
    criterion: 'P2-S09-AC-1235',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-config.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1235]'],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S09-AC-1236',
    layer: 'browser+web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx; pnpm test:e2e:s09-real',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-fields.dom.test.tsx',
      'tests/e2e/phase-02-slice-09-locale-fields-real-route.spec.ts',
    ],
    testMarkers: ['[P2-S09-AC-1236]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-1237',
    layer: 'browser+web',
    command: 'pnpm test:e2e:s09-real',
    testFiles: ['tests/e2e/phase-02-slice-09-locale-fields-real-route.spec.ts'],
    testMarkers: ['[P2-S09-AC-1237]'],
    status: 'verified',
    limitation:
      'Loopback stateful lane (tests/e2e/support/s09-lane-*.ts): identity provider is a test TOTP seam and persistence is in memory, so this is production-built Astro/Workers in Google Chrome evidence for browser behavior only, not database, RLS, provider or hosted evidence.',
  },
  {
    criterion: 'P2-S09-AC-1238',
    layer: 'web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-detail.test.tsx',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-detail.test.tsx',
    ],
    testMarkers: ['[P2-S09-AC-1238]'],
    status: 'verified',
    limitation:
      'The code has no separate hand-written ContentSchemaRegistryContractField string union; the workbench consumes the generated contract schemas, whose parse is exercised by the detail fixtures.',
  },
  {
    criterion: 'P2-S09-AC-1239',
    layer: 'db+web',
    command:
      'pnpm exec vitest run apps/web/src/components/content-schema-registry/content-schema-registry-locale-detail.test.tsx apps/web/src/components/content-schema-registry/content-schema-registry-s09-locale-states.dom.test.tsx tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts; pnpm db:test',
    testFiles: [
      'apps/web/src/components/content-schema-registry/content-schema-registry-locale-detail.test.tsx',
      'apps/web/src/components/content-schema-registry/content-schema-registry-s09-locale-states.dom.test.tsx',
      'supabase/tests/phase_02_slice_09_od4_locale_config.sql',
      'tests/contracts/phase-02-slice-09-phase-completion-policy.test.ts',
    ],
    testMarkers: ['[P2-S09-AC-1239]'],
    status: 'verified',
    limitation:
      "Successor-only change is proven through the immutability triggers and the dry-run/review/activation chain; no direct 'edited in place' path exists to exercise beyond the rejected UPDATE.",
  },
];

/** Criteria that are not verified here; each stays [ ] (the deferred gates stay outside the active denominator). */
export const S09_AMENDMENT_OPEN: readonly S09AmendmentOpenEntry[] = [
  {
    criterion: 'P2-S09-AC-209',
    status: 'deferred-gate',
    reason:
      'Deferred pre-release or post-launch gate (DEC-101, DEC-104, DEC-105); stays authored and unchecked outside the active denominator.',
  },
  {
    criterion: 'P2-S09-AC-211',
    status: 'deferred-gate',
    reason:
      'Deferred pre-release or post-launch gate (DEC-101, DEC-104, DEC-105); stays authored and unchecked outside the active denominator.',
  },
  {
    criterion: 'P2-S09-AC-265',
    status: 'deferred-gate',
    reason:
      'Deferred pre-release or post-launch gate (DEC-101, DEC-104, DEC-105); stays authored and unchecked outside the active denominator.',
  },
  {
    criterion: 'P2-S09-AC-266',
    status: 'deferred-gate',
    reason:
      'Deferred pre-release or post-launch gate (DEC-101, DEC-104, DEC-105); stays authored and unchecked outside the active denominator.',
  },
];

/**
 * Criteria checked before the evidence-index pass whose marked tests still pass and
 * that no lane re-proved (closed by the 2026-09-26 QA-GREEN evidence, kept by the D4
 * accounting). They are exempt from the index requirement.
 */
export const S09_PRE_AMENDMENT_CHECKED: readonly number[] = [];
