import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 10 evidence ledger fragment P2-S10-AC-001..035 (evidence lane A). Rules: see
// tests/contracts/phase-02-slice-10-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-10-evidence-guard.test.ts.
export const S10_EVIDENCE_LEDGER_001_035: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S10-AC-001',
    text: 'Autosave only changed paths against an explicit base revision; same-field divergence creates a truthful conflict.',
    clauses: [
      {
        text: 'Autosave only changed paths against an explicit base revision',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-controller.test.ts',
            title:
              'editor controller: autosave cadence and request shape saves 3 s after the last edit against the explicit base revision with If-Match and a key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-draft.test.ts',
            title:
              'collectCmsEditorialChangedPaths reports only the changed field, never unchanged siblings',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-draft.test.ts',
            title:
              'buildCmsEditorialEntryRevisionRequest carries the loaded base revision and expected version, not the last response',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'append: values that do not match the changed paths are pointed at /values',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_write_contract.sql',
            title:
              "the merged revision keeps the other editor's title: only the changed path was applied",
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-autosave-rollback.test.ts',
            title:
              'EA autosave sends exactly the changed fields against the adopted base one edited field is the whole request: changedPaths and values name only it, with the loaded base revision and entry version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-autosave-rollback.test.ts',
            title:
              'EA autosave sends exactly the changed fields against the adopted base two edited fields are both sent in sorted order and the untouched siblings are not',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-autosave-rollback.test.ts',
            title:
              'EA autosave sends exactly the changed fields against the adopted base the next save re-sends nothing the adopted revision already holds and is based on the adopted revision',
          },
        ],
      },
      {
        text: 'same-field divergence creates a truthful conflict.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 persists exactly one open conflict for the overlapping proposal',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 binds the uncommitted proposal and its hash to the durable conflict',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 conflict does not append or overwrite either competing revision',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-015] a same-field save from a stale base is a 409 that records one open conflict and appends no revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_write_contract.sql',
            title: 'a divergence on different fields records no conflict',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-draft.test.ts',
            title:
              'rebaseCmsEditorialDraft retains base, theirs, and yours when both sides changed the same field',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-002',
    text: 'Compare and restore with recorded schema, template, and taxonomy versions plus a proven migration chain.',
    clauses: [
      {
        text: 'Compare and restore with recorded schema, template',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage_domains.sql',
            title:
              'CMS-07 a recorded schema whose artifact hash differs from its definition hash is comparison_unavailable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage_domains.sql',
            title:
              'CMS-07 a revision whose schema version belongs to another content type is comparison_unavailable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage_domains.sql',
            title:
              'CMS-07 a revision whose owner differs from its entry owner is comparison_unavailable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage.sql',
            title:
              'EB-AC056: a recorded template version that no longer resolves is comparison_unavailable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage.sql',
            title:
              'EB-AC056: revisions recording a template version that resolves compare normally',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'every restored value is rebound to the TARGET field definition, never the source definition row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'the source revision is still an immutable snapshot on its recorded schema after the restores',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'a source template that stays compatible is re-resolved and carried, and a matching If-Match copy is admitted',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'a source template that is not compatible with the active content type refuses as template_incompatible',
          },
        ],
      },
      {
        text: 'taxonomy versions',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage.sql',
            title:
              'a compared revision pinning a taxonomy version that resolves nowhere is comparison_unavailable [DEC-141]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage.sql',
            title:
              'a non-empty recorded taxonomy list fails closed even when the version exists: no Slice 10 authority resolves it (DEC-141)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage.sql',
            title:
              'a comparison of revisions that record no taxonomy version succeeds',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage.sql',
            title:
              'a recorded taxonomy version owned by another tenant is comparison_unavailable (never disclosed as existing)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_gaps.sql',
            title:
              'GAP EA-AC002 a compared revision whose recorded taxonomy version does not resolve is comparison_unavailable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_lineage.sql',
            title:
              'a recorded taxonomy version that no longer resolves refuses the restore as migration_chain_incomplete',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_lineage.sql',
            title:
              'a recorded taxonomy version owned by another tenant never satisfies the restore',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_lineage.sql',
            title:
              'the restored draft records exactly the taxonomy version ids of its source revision',
          },
        ],
      },
      {
        text: 'plus a proven migration chain.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain.sql',
            title:
              'restore chain composes real Slice 09 completed plan edges, never hand-inserted rows',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'the derived chain orders both completed edges from the source schema to the active schema',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'the restore chain is two completed Slice 09 plans carrying the registered identity.revalidate transform',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain.sql',
            title:
              'a chain that no longer matches the derived path is refused, never guessed',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_chain_shared.sql',
            title:
              'CMS-07/CMS-03B-04 parity: restore accepts the compare-derived chain id',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-restore.test.ts',
            title:
              'CMS-03B-04 revision restore verification requires a chain that spans source schema to active schema',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-003',
    text: 'Preserve valid input, conflict preimages, focus, and canonical version through network failure and optimistic rollback.',
    clauses: [
      {
        text: 'Preserve valid input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-outcomes.test.ts',
            title:
              'editor controller: outcome unknown and refusals on a 403 adopts nothing, keeps the unsent values and stops sending',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: refusals keep the work after a lost response keeps the typed value and replays the identical request on its own',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-reconcile.test.ts',
            title:
              'H1: merged-save reconciliation never overwrites an edit made after dispatch keeps a field edited while the save was pending and still adopts the merged-in fields',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-autosave-rollback.test.ts',
            title:
              'EA a refused save rolls back to the canonical preimage and keeps the input a 403 FORBIDDEN adopts nothing: base values, base revision and entry version stay the preimage while the unsent value is kept',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-autosave-rollback.test.ts',
            title:
              'EA a refused save rolls back to the canonical preimage and keeps the input a 422 VALIDATION_FAILED adopts nothing: base values, base revision and entry version stay the preimage while the unsent value is kept',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-autosave-rollback.test.ts',
            title:
              'EA a refused save rolls back to the canonical preimage and keeps the input a 500 INTERNAL_ERROR adopts nothing: base values, base revision and entry version stay the preimage while the unsent value is kept',
          },
        ],
      },
      {
        text: 'conflict preimages',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: 409 and closure on a 409 refetches the conflict and keeps choices only for paths whose preimages are unchanged',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form after a 409 re-reads the conflict, keeps choices for unchanged fields and marks the reset one',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-draft.test.ts',
            title:
              'rebaseCmsEditorialDraft retains base, theirs, and yours when both sides changed the same field',
          },
        ],
      },
      {
        text: 'focus',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: conflicts on a 409 opens the sync-conflict alert with focus, keeps the unsent value and links to resolution',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: the edit surface announces dirty and saved through one polite status region and never moves focus',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.leave.test.tsx',
            title:
              'H2: leaving the editor with unsent work is guarded Keep editing closes the confirmation, returns focus to the link and keeps every value',
          },
        ],
      },
      {
        text: 'and canonical version',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-runtime.test.ts',
            title:
              'applyCmsEditorialAcceptedRevision advances the base revision and the ENTRY version together, never the revision snapshot version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-controller.test.ts',
            title:
              'editor controller: autosave cadence and request shape adopts the committed ENTRY version, not the snapshot version, as the next If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-outcomes.test.ts',
            title:
              'editor controller: outcome unknown and refusals on a 401 adopts nothing, keeps the unsent values and stops sending',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-autosave-rollback.test.ts',
            title:
              'EA a refused save rolls back to the canonical preimage and keeps the input a lost response then a confirmed replay adopts the canonical revision exactly once',
          },
        ],
      },
      {
        text: 'through network failure and optimistic rollback.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-autosave-rollback.test.ts',
            title:
              'EA a refused save rolls back to the canonical preimage and keeps the input a lost response then a refused replay rolls back too: the preimage is restored and the edit is kept',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-autosave-rollback.test.ts',
            title:
              'EA a refused save rolls back to the canonical preimage and keeps the input a lost response then a confirmed replay adopts the canonical revision exactly once',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-autosave-rollback.test.ts',
            title:
              'EA a refused save rolls back to the canonical preimage and keeps the input a 503 DEPENDENCY_UNAVAILABLE adopts nothing: base values, base revision and entry version stay the preimage while the unsent value is kept',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-autosave-rollback.test.ts',
            title:
              'EA a refused save rolls back to the canonical preimage and keeps the input a 401 UNAUTHENTICATED adopts nothing: base values, base revision and entry version stay the preimage while the unsent value is kept',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-autosave-rollback.test.ts',
            title:
              'EA a refused save rolls back to the canonical preimage and keeps the input a 409 version conflict with a durable open conflict adopts nothing: base values, base revision and entry version stay the preimage while the unsent value is kept',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-outcomes.test.ts',
            title:
              'editor controller: outcome unknown and refusals after a lost response keeps the key and replays the IDENTICAL request',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-outcomes.test.ts',
            title:
              'editor controller: outcome unknown and refusals stops replaying automatically after three tries and offers a manual retry',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-reconcile.test.ts',
            title:
              'M2: automatic rebases after a stale base are bounded, backed off and recoverable rebases at once, then after 1 s and 2 s, then stops and keeps every edit',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-004',
    text: 'CMS-03B-01: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03B-01 — CMS-05 — POST /api/v1/cms/entries/{entryId}/revisions — EntryRevisionRequest → 201 EntryRevisionResource.',
    clauses: [
      {
        text: 'CMS-03B-01: define strict Zod request, path, query, header, and success contracts',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial request shapes accepts the canonical revision body and rejects unknown keys',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial request shapes binds exactly one UUID path parameter',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial request shapes requires JSON, an idempotency key, and an exact strong If-Match',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial success resource exposes version plus the exact closed revision shape',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/write-query-admission.test.ts',
            title:
              'CMS-03B-01 revision command query admission refuses an undeclared query before any admission or port side effect',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-editorial-registry-openapi.test.ts',
            title:
              'Slice 10 CMS-03B-01/02/03/04 canonical inventory authority documents the two CAS commands with path, key, and If-Match parameters',
          },
        ],
      },
      {
        text: 'complete the declared happy path — CMS-03B-01 — CMS-05 — POST /api/v1/cms/entries/{entryId}/revisions — EntryRevisionRequest → 201 EntryRevisionResource.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes.test.ts',
            title:
              'cms-editorial CMS-03B-01 route creates a revision with a strong ETag, Location and no-store',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-01 append and CMS-03B-03 history through the real stack [P2-S10-AC-007] [P2-S10-AC-009] an append commits one revision, one audit row and one outbox event and its strong ETag is the next entry version',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes.test.ts',
            title:
              'cms editorial route registry binds CMS-03B-01 to its revision schemas, 201, and the Tier 2 SLO',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 appends one draft revision for an assigned author',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-005',
    text: 'CMS-03B-01: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation. For `rich_text`, the request must satisfy the canonical `rich_text.v1` AST and protected validator binding; an invalid or noncanonical AST is a typed 422 with no mutation.',
    clauses: [
      {
        text: 'CMS-03B-01: reject unknown fields',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack an unknown request member is a 422 naming that member and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial request shapes accepts the canonical revision body and rejects unknown keys',
          },
        ],
      },
      {
        text: 'every invalid request value with the exact stable field violation, safe message, and no state mutation.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a zero baseRevision is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a repeated changed path is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a values key that is not a stable field UUID is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a one-character locale is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes.test.ts',
            title:
              'cms-editorial CMS-03B-01 route rejects an invalid body with bounded stable violations as 422',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'append: a malformed baseRevision is pointed at /baseRevision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'every captured detail is a JSON array of safe RFC 6901 pointers and echoes no caller value',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: every typed refusal appended no revision, value, conflict, reservation, outbox or audit row',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a /blocks changed path is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a 129-key values object is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a 129-pointer changedPaths list is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a 36-character locale is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a body entryId that differs from the path entry is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a malformed entry id in the path is a structural 400 naming /entryId and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a request body over the 256 KiB ceiling is a 400 INVALID_REQUEST and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a values object nested nine levels deep is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a zero expectedVersion is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack an empty changedPaths list is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack an unknown request member is a 422 naming that member and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack a canonical rich_text.v1 document is stored: 201 with the next entry version as the strong ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack a document with an empty block list is a typed 422 rich_text_not_canonical at the field pointer and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack a document with an unknown top-level key is a typed 422 rich_text_not_canonical at the field pointer and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack a javascript: link is a typed 422 rich_text_not_canonical at the field pointer and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack a level-1 heading is a typed 422 rich_text_not_canonical at the field pointer and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack a raw string is a typed 422 rich_text_not_canonical at the field pointer and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack adjacent spans with equal marks that are not merged is a typed 422 rich_text_not_canonical at the field pointer and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              "CMS-03B-01 typed value reasons through the real stack 'a non-empty media value' is the typed 422 'media_source_unavailable' at its field pointer and nothing is written",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              "CMS-03B-01 typed value reasons through the real stack 'a non-empty relation to a domain targ…' is the typed 422 'relation_target_unavailable' at its field pointer and nothing is written",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              "CMS-03B-01 typed value reasons through the real stack 'a non-empty taxonomy value' is the typed 422 'taxonomy_source_unavailable' at its field pointer and nothing is written",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              "CMS-03B-01 typed value reasons through the real stack 'a raw string for a rich_text field' is the typed 422 'rich_text_not_canonical' at its field pointer and nothing is written",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              "CMS-03B-01 typed value reasons through the real stack 'an object with an undeclared property' is the typed 422 'object_property_invalid' at its field pointer and nothing is written",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              'CMS-03B-01 typed value reasons through the real stack the same fields with ADMITTED values commit: a canonical document, a structure-valid object, empty taxonomy and relation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: list_wrong_item is VALIDATION_FAILED [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: media_string is VALIDATION_FAILED [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: object_array is object_property_invalid [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: object_missing_required is object_property_invalid [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: object_nested_scalar is object_property_invalid [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: object_null_scalar is object_property_invalid [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: object_string is object_property_invalid [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: object_unknown_key is object_property_invalid [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: richtext_array is rich_text_not_canonical [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: richtext_backslash_route is rich_text_not_canonical [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: richtext_number is rich_text_not_canonical [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: richtext_other_format is rich_text_not_canonical [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: richtext_raw_string is rich_text_not_canonical [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: richtext_unknown_key is rich_text_not_canonical [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: richtext_unmerged_spans is rich_text_not_canonical [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: richtext_unsafe_link is rich_text_not_canonical [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: short_text_number is VALIDATION_FAILED [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: taxonomy_string is VALIDATION_FAILED [BE03b, AC-005]',
          },
        ],
      },
      {
        text: 'For `rich_text`, the request must satisfy the canonical `rich_text.v1` AST and protected validator binding',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title:
              '[P2-S10-AC-082] a minimal one-paragraph document is canonical',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title:
              '[P2-S10-AC-082] the rich_text.v1 grammar has a named protected validator',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_protected_validator_freeze.sql',
            title:
              'a type that declares the rich_text.v1 pair is refused when the request names no validator ref',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_protected_validator_freeze.sql',
            title:
              'when the artifact froze no validator although its definition uses the grammar every editorial transition is DEPENDENCY_UNAVAILABLE [DEC-146, AC-085]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack a canonical rich_text.v1 document is stored: 201 with the next entry version as the strong ETag',
          },
        ],
      },
      {
        text: 'an invalid or noncanonical AST is a typed 422 with no mutation.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack a raw string is a typed 422 rich_text_not_canonical at the field pointer and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack a document with an unknown top-level key is a typed 422 rich_text_not_canonical at the field pointer and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack adjacent spans with equal marks that are not merged is a typed 422 rich_text_not_canonical at the field pointer and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack a javascript: link is a typed 422 rich_text_not_canonical at the field pointer and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: richtext_raw_string is rich_text_not_canonical [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: richtext_unmerged_spans is rich_text_not_canonical [BE03b, AC-005]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'typed 422 reason tokens (BE03b:1049-1054, :1211) [P2-S10-AC-005] [P2-S10-AC-008] maps rich_text_not_canonical on a write to 422 VALIDATION_FAILED with reasonCode',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-006',
    text: 'CMS-03B-01: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
    clauses: [
      {
        text: 'CMS-03B-01: derive actor and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production.test.ts',
            title:
              'cms editorial production adapter transport derives context and body server-side from the verified session',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production.test.ts',
            title:
              'cms editorial production adapter transport rejects caller-supplied authority keys with a 422 and no RPC call',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-01' failure mapping through the production app and adapter CMS-03B-01 sends the named RPC once with the verified session context and never a caller identity",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-session-rpc-context.test.ts',
            title:
              'cms editorial session resolution derives the RPC context from the server-side session cache',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-forged-context.test.ts',
            title:
              "'CMS-03B-01' derives the actor and acting context from the verified session only CMS-03B-01 sends the RPC the session user and party and none of the forged header or cookie identities",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-forged-context.test.ts',
            title:
              "'CMS-03B-01' refuses forged authority in the request body CMS-03B-01 refuses a body member named context as an unknown field and never calls the RPC",
          },
        ],
      },
      {
        text: 'enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '401, 403 and 404 are the database decision, not a stub [P2-S10-AC-006] no session is a 401 with a reauthenticate hint on every operation and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '403 and concealment decided by the database for other principals [P2-S10-AC-006] [P2-S10-AC-012] a confirmed member holding no CMS grant is a 403, and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '401, 403 and 404 are the database decision, not a stub [P2-S10-AC-068] [P2-S10-AC-089] an entry the caller cannot see is the same empty 404 as an absent one',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '403 and concealment decided by the database for other principals [P2-S10-AC-068] [P2-S10-AC-089] a person outside the owning organization cannot tell the entry exists',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes.test.ts',
            title:
              'cms-editorial CMS-03B-01 route admits author-only and editor-only capability sets and refuses others',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes.test.ts',
            title:
              'cms-editorial CMS-03B-01 route conceals an absent entry as 404 and reports an unassigned editor as 403',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 refuses an unassigned tenant member without edit authority',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_write_path_locks.sql',
            title:
              'a principal outside the owning organization is refused after the locks',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_authority.sql',
            title:
              'RLS is enabled and forced on cms_conflict_records and anon, authenticated and service_role hold no table privilege',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_authority.sql',
            title:
              'RLS is enabled and forced on cms_content_entries and anon, authenticated and service_role hold no table privilege',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_authority.sql',
            title:
              'RLS is enabled and forced on cms_entry_revisions and anon, authenticated and service_role hold no table privilege',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_authority.sql',
            title:
              'RLS is enabled and forced on cms_entry_assignments and anon, authenticated and service_role hold no table privilege',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_authority.sql',
            title:
              'a read of cms_conflict_records is refused with insufficient_privilege for anon, authenticated and service_role',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_authority.sql',
            title:
              'control: dropping FORCE ROW LEVEL SECURITY from cms_conflict_records makes the RLS predicate false',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_authority.sql',
            title:
              'append: a forged acting party is concealed as NOT_FOUND and writes nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_authority.sql',
            title:
              'append: an actor who is not a member of the owner is concealed as NOT_FOUND and writes nothing',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-007',
    text: 'CMS-03B-01: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03B-01: enforce declared idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes.test.ts',
            title:
              'cms-editorial CMS-03B-01 route requires Idempotency-Key and a strong If-Match',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 concurrency and idempotency through the real stack the same Idempotency-Key with a different body is a 409 IDEMPOTENCY_MISMATCH and adds nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-01 append and CMS-03B-03 history through the real stack [P2-S10-AC-009] a lost response is an unknown outcome, and the same-key replay returns the committed revision without a second effect',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-01' write conflicts through the production app and adapter CMS-03B-01 maps IDEMPOTENCY_MISMATCH to a 409 CONFLICT that tells the client to use a new key",
          },
        ],
      },
      {
        text: 'If-Match or CAS',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes.test.ts',
            title:
              'cms-editorial CMS-03B-01 route [P2-S10-AC-004] refuses an If-Match that disagrees with the body expectedVersion before the port, never overwriting either',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 concurrency and idempotency through the real stack a stale expectedVersion is a definite 409 VERSION_MISMATCH with reload recovery and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_write_contract.sql',
            title:
              'an expectedVersion older than the entry version is the typed VERSION_MISMATCH',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title: 'CMS-03B-01 CAS-advances the entry version',
          },
        ],
      },
      {
        text: 'duplicate, replay',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 exact-key replay returns the identical committed revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 exact-key replay does not append a duplicate revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 exact-key retry does not duplicate the durable open conflict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-concurrency.apispec.ts',
            title:
              'simultaneous writers through the real stack the same Idempotency-Key and body sent three times at once commits once and every caller gets the identical committed 201',
          },
        ],
      },
      {
        text: 'pagination',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/write-query-admission.test.ts',
            title:
              'CMS-03B-01 revision command query admission refuses an undeclared query before any admission or port side effect',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-editorial-registry-openapi.test.ts',
            title:
              'Slice 10 CMS-03B-01/02/03/04 canonical inventory authority keeps the query surface only on the safe history read',
          },
        ],
      },
      {
        text: 'cache',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes.test.ts',
            title:
              'cms-editorial CMS-03B-01 route creates a revision with a strong ETag, Location and no-store',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-01 append and CMS-03B-03 history through the real stack [P2-S10-AC-007] [P2-S10-AC-009] an append commits one revision, one audit row and one outbox event and its strong ETag is the next entry version',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-rate-scope.test.ts',
            title:
              'route registry rate limits (BE03b:152-165) CMS-03B-01 asks the limiter for 120/min per actor and 240/min per acting party, never mixed',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes-admission.test.ts',
            title:
              'cms-editorial CMS-03B-01 route rate limits with RateLimit and Retry-After headers',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-01' failure mapping through the production app and adapter CMS-03B-01 refuses a denied rate decision with 429 RATE_LIMITED, Retry-After and no RPC call",
          },
        ],
      },
      {
        text: 'deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes.test.ts',
            title:
              'cms-editorial CMS-03B-01 shared route budget aborts a stalled session dependency at the route deadline before rate admission',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes.test.ts',
            title:
              'cms-editorial CMS-03B-01 shared route budget carries the remaining shared route budget into the port after admission stages',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-01' failure mapping through the production app and adapter CMS-03B-01 maps a dependency that outlives the route deadline to a retryable 504 GATEWAY_TIMEOUT and aborts the call",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production.test.ts',
            title:
              'cms editorial production adapter transport bounds the transport with the declared per-operation deadline',
          },
        ],
      },
      {
        text: 'concurrency rules.',
        citations: [
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/013-revision-concurrency-cap.mjs',
            title:
              'C1: a fourth concurrent revision write of one actor is refused with RATE_LIMITED (RATE_LIMITED)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/013-revision-concurrency-cap.mjs',
            title:
              'C1: the refused fourth write committed no entry, revision, value, relation, conflict, reservation, outbox or audit row',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/013-revision-concurrency-cap.mjs',
            title:
              'C2: an exact replay of a completed append is answered with its first response while the three slots are held',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/013-revision-concurrency-cap.mjs',
            title:
              'C3: once the slots are free the same actor appends again (the previously refused command now succeeds)',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-concurrency.apispec.ts',
            title:
              'simultaneous writers through the real stack round 1: two appends at the same entry version commit exactly one revision and the other is the definite 409 VERSION_MISMATCH',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-concurrency.apispec.ts',
            title:
              'simultaneous writers through the real stack round 2: two appends at the same entry version commit exactly one revision and the other is the definite 409 VERSION_MISMATCH',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-concurrency.apispec.ts',
            title:
              'simultaneous writers through the real stack the same Idempotency-Key and body sent three times at once commits once and every caller gets the identical committed 201',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs',
            title:
              'S4 append: the writer the deadlock detector aborted answers the typed retryable CONFLICT, not a raw 40P01 (CONFLICT)',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-008',
    text: 'CMS-03B-01: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
    clauses: [
      {
        text: 'CMS-03B-01: map every declared domain',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'VERSION_MISMATCH' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'IDEMPOTENCY_MISMATCH' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'INVALID_TRANSITION' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'CONFLICT' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'UNAUTHENTICATED' to 401 'UNAUTHENTICATED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'FORBIDDEN' to 403 'FORBIDDEN'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'NOT_FOUND' to 404 'NOT_FOUND'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'VALIDATION_FAILED' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'INVALID_REQUEST' to 400 'INVALID_REQUEST'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'RATE_LIMITED' to 429 'RATE_LIMITED'",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'typed 422 reason tokens (BE03b:1049-1054, :1211) [P2-S10-AC-005] [P2-S10-AC-008] maps rich_text_not_canonical on a write to 422 VALIDATION_FAILED with reasonCode',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 concurrency and idempotency through the real stack an append to an entry that is not active is the policy-safe 404 NOT_FOUND and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 concurrency and idempotency through the real stack a well-formed baseRevision that names no readable revision is a 422 at /baseRevision and nothing is written',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs',
            title:
              'S4 append: the writer the deadlock detector aborted answers the typed retryable CONFLICT, not a raw 40P01 (CONFLICT)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs',
            title:
              'S4 append: the same command retried with the same idempotency key commits exactly one revision (no error)',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'media_source_unavailable' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'object_kind_unspecified' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'object_property_invalid' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'relation_target_unavailable' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'rich_text_not_canonical' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 maps the database token 'taxonomy_source_unavailable' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 publishes the field pointer of the typed value reason 'media_source_unavailable' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 publishes the field pointer of the typed value reason 'object_kind_unspecified' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 publishes the field pointer of the typed value reason 'object_property_invalid' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 publishes the field pointer of the typed value reason 'relation_target_unavailable' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 publishes the field pointer of the typed value reason 'rich_text_not_canonical' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-01' declared token catalog CMS-03B-01 publishes the field pointer of the typed value reason 'taxonomy_source_unavailable' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              "CMS-03B-01 typed value reasons through the real stack 'a non-empty media value' is the typed 422 'media_source_unavailable' at its field pointer and nothing is written",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              "CMS-03B-01 typed value reasons through the real stack 'a non-empty relation to a domain targ…' is the typed 422 'relation_target_unavailable' at its field pointer and nothing is written",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              "CMS-03B-01 typed value reasons through the real stack 'a non-empty taxonomy value' is the typed 422 'taxonomy_source_unavailable' at its field pointer and nothing is written",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              "CMS-03B-01 typed value reasons through the real stack 'a raw string for a rich_text field' is the typed 422 'rich_text_not_canonical' at its field pointer and nothing is written",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              "CMS-03B-01 typed value reasons through the real stack 'an object with an undeclared property' is the typed 422 'object_property_invalid' at its field pointer and nothing is written",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              'CMS-03B-01 typed value reasons through the real stack the same fields with ADMITTED values commit: a canonical document, a structure-valid object, empty taxonomy and relation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_value_source_refusal.sql',
            title:
              'cms_create_revision: a raw string for a rich_text field is the typed rich_text_not_canonical reason [BE03b:1154, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_value_source_refusal.sql',
            title:
              'cms_create_revision: media_array fails closed with the typed media_source_unavailable reason [BE03b]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_value_source_refusal.sql',
            title:
              'cms_create_revision: media_object fails closed with the typed media_source_unavailable reason [BE03b]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_value_source_refusal.sql',
            title:
              'cms_create_revision: object_missing_required is the typed object_property_invalid reason [BE03b:1053, AC-078]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_value_source_refusal.sql',
            title:
              'cms_create_revision: object_null_scalar is the typed object_property_invalid reason [BE03b:1053, AC-078]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_value_source_refusal.sql',
            title:
              'cms_create_revision: tax_nonempty fails closed with the typed taxonomy_source_unavailable reason [BE03b]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_relation_authoring.sql',
            title:
              'cms_create_revision: a non-empty domain relation fails closed with relation_target_unavailable [BE03b:1049]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: object_unknown_key is object_property_invalid [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: richtext_raw_string is rich_text_not_canonical [BE03b, AC-005]',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-01' failure mapping through the production app and adapter CMS-03B-01 maps a transport failure to a retryable 503 DEPENDENCY_UNAVAILABLE without echoing the dependency text",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-01' failure mapping through the production app and adapter CMS-03B-01 scrubs an unexpected RPC 5xx into a retryable 503 and never echoes its body",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-01' failure mapping through the production app and adapter CMS-03B-01 maps a success payload that fails the declared resource contract to a non-retryable 502 BAD_GATEWAY",
          },
        ],
      },
      {
        text: 'timeout',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-01' failure mapping through the production app and adapter CMS-03B-01 maps a dependency that outlives the route deadline to a retryable 504 GATEWAY_TIMEOUT and aborts the call",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes-admission.test.ts',
            title:
              'cms-editorial CMS-03B-01 route maps a dependency timeout to 504 and a transport failure to 503',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-01' failure mapping through the production app and adapter CMS-03B-01 refuses a denied rate decision with 429 RATE_LIMITED, Retry-After and no RPC call",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-01' failure mapping through the production app and adapter CMS-03B-01 fails closed with 503 and no RPC call when the rate limiter itself is unavailable",
          },
        ],
      },
      {
        text: 'internal failure to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-01' failure mapping through the production app and adapter CMS-03B-01 maps the database INTERNAL_ERROR token to a scrubbed 500 INTERNAL_ERROR",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'conflict and state tokens [P2-S10-AC-008] maps INTERNAL_ERROR to a scrubbed 500, never a user-blamed 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'conflict and state tokens refuses an unregistered P0001 message as a scrubbed 500 rather than blaming the caller',
          },
        ],
      },
      {
        text: 'preserve safe recovery.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 concurrency and idempotency through the real stack a stale expectedVersion is a definite 409 VERSION_MISMATCH with reload recovery and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-01 append and CMS-03B-03 history through the real stack [P2-S10-AC-009] a lost response is an unknown outcome, and the same-key replay returns the committed revision without a second effect',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-runtime.test.ts',
            title:
              'executeCmsEditorialRevisionMutation outcomes maps 429 RATE_LIMITED to a rate-limited outcome with retryable=true',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-outcomes.test.ts',
            title:
              'editor controller: outcome unknown and refusals waits out a rate limit and then saves again with the values it kept',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-outcomes.test.ts',
            title:
              'editor controller: outcome unknown and refusals maps a typed 422 to its field and fixed copy, keeps the values, and waits for an edit',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-009',
    text: 'CMS-03B-01: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03B-01: commit audit and outbox effects atomically where applicable',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-01 append and CMS-03B-03 history through the real stack [P2-S10-AC-007] [P2-S10-AC-009] an append commits one revision, one audit row and one outbox event and its strong ETag is the next entry version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title: 'CMS-03B-01 emits exactly one revision-created event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: every typed refusal appended no revision, value, conflict, reservation, outbox or audit row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_write_contract.sql',
            title:
              'the stale-version command wrote no entry, revision, value, relation, conflict, reservation, outbox or audit row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'append: a failure on the audit insert rolls back the revision, values, reservation and outbox event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'append: a failure on the outbox insert rolls back the revision, values, reservation and audit row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'append: a failure completing the idempotency reservation rolls back the revision, audit row and outbox event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'every injected failure surfaced from the real command: none of the 12 (operation x fault) calls swallowed it',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'control: an append with no fault commits one revision, one audit row, one outbox event and one reservation',
          },
        ],
      },
      {
        text: 'reconcile lost responses without duplicate effects',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-01 append and CMS-03B-03 history through the real stack [P2-S10-AC-009] a lost response is an unknown outcome, and the same-key replay returns the committed revision without a second effect',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 exact-key replay does not append a duplicate revision',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-outcomes.test.ts',
            title:
              'editor controller: outcome unknown and refusals after a lost response keeps the key and replays the IDENTICAL request',
          },
        ],
      },
      {
        text: 'emit redacted telemetry.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-telemetry-reads.test.ts',
            title:
              'redaction (BE03b:1439) [P2-S10-AC-009] [P2-S10-AC-015] no event carries an identifier, value, credential or request body',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-telemetry-metrics.test.ts',
            title:
              'request metrics and attributes [P2-S10-AC-009] [P2-S10-AC-007] a created revision names the BE03b metrics, stages, SLO and a safe entry hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-telemetry.test.ts',
            title:
              "'CMS-03B-01' redacted telemetry through the production app and adapter CMS-03B-01 emits one success event naming only the operation, never an identifier, value or credential",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-telemetry.test.ts',
            title:
              "'CMS-03B-01' redacted telemetry through the production app and adapter CMS-03B-01 emits a failure event with the status and retryability but still no identifier, value or credential",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes-admission.test.ts',
            title:
              'cms-editorial CMS-03B-01 route emits redacted telemetry and survives a telemetry transport failure',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-010',
    text: 'CMS-03B-02: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03B-02 — CMS-06 — POST /api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve — ConflictResolutionRequest → 201 EntryRevisionResource.',
    clauses: [
      {
        text: 'CMS-03B-02: define strict Zod request, path, query, header, and success contracts',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-resolution.test.ts',
            title:
              'CMS-03B-02 conflict resolution request accepts the canonical body and rejects an invented yours-side field',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-resolution.test.ts',
            title:
              'CMS-03B-02 conflict resolution request binds exactly the entry and conflict path parameters',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-resolution.test.ts',
            title:
              'CMS-03B-02 conflict resolution request requires JSON, an idempotency key, and an exact strong If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/write-query-admission.test.ts',
            title:
              'CMS-03B-02 conflict-resolution command query admission refuses an undeclared query before any admission or port side effect',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-02' failure mapping through the production app and adapter CMS-03B-02 maps a success payload that fails the declared resource contract to a non-retryable 502 BAD_GATEWAY",
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-editorial-registry-openapi.test.ts',
            title:
              'Slice 10 CMS-03B-01/02/03/04 canonical inventory authority documents conflict resolution on its distinct rate class',
          },
        ],
      },
      {
        text: 'complete the declared happy path — CMS-03B-02 — CMS-06 — POST /api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve — ConflictResolutionRequest → 201 EntryRevisionResource.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route delegates a validated explicit choice to the private port and returns a no-store two-parent revision',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-010] [P2-S10-AC-013] resolving with an explicit choice commits a two-parent revision once, closes the conflict, and a replay adds nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict-commit.apispec.ts',
            title:
              'CMS-03B-02 concurrency, idempotency and reconciliation through the real stack an explicit value that validates is committed once: two parents, one revision, one audit row, one outbox event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 response binds the resolved conflict and both immutable parents',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-011',
    text: 'CMS-03B-02: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
    clauses: [
      {
        text: 'CMS-03B-02: reject unknown fields',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack an unknown request member is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-resolution.test.ts',
            title:
              'CMS-03B-02 conflict resolution request accepts the canonical body and rejects an invented yours-side field',
          },
        ],
      },
      {
        text: 'every invalid request value with the exact stable field violation, safe message, and no state mutation.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack an empty choices list is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack two choices for one path is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a named choice that smuggles a value is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack an explicit choice without a value is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a zero baseRevision is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'resolve: a path decided twice is pointed at the repeated choice',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'resolve: a conflicting field with no explicit choice is pointed at that field',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_resolve_conflict: every typed refusal committed nothing and left the conflict open',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 invalid choices and stale CAS leave the open record intact',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a baseRevision with a leading zero is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack an expectedVersion above the signed 64-bit range is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a choice path with an uppercase field id is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a choice path that is a field key rather than a field id is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack an unknown member of a choice is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack an explicit object for a short_text field is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a missing choices member is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a request body that is an array is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a request body that is not parseable JSON is a 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict-headers.apispec.ts',
            title:
              'CMS-03B-02 header matrix through the real stack a weak If-Match validator is refused before any persistence and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict-headers.apispec.ts',
            title:
              'CMS-03B-02 header matrix through the real stack an Idempotency-Key shorter than 8 characters is refused before any persistence and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a 300 000-character explicit value exceeds the body ceiling and is a 400 INVALID_REQUEST with the snapshot unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a baseRevision above the signed 64-bit range is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a choice path nested below a field is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a choice without a choice kind is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a choice without a path is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a choices member that is a string is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a choices member that is an object is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a fractional expectedVersion is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a missing baseRevision is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a missing entryId is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a negative expectedVersion is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a null choice entry is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a numeric choice path is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a numeric expectedVersion is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a request body that is a JSON string is a 422 at the root pointer and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a request body that is null is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack an empty choice path is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack an expectedVersion with a leading zero is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack an explicit array for a short_text field is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack an explicit boolean for a short_text field is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack exactly 128 distinct choices pass the count bound: the database then refuses the 127 paths the conflict does not carry',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict-headers.apispec.ts',
            title:
              'CMS-03B-02 header matrix through the real stack a missing If-Match is refused before any persistence and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict-headers.apispec.ts',
            title:
              'CMS-03B-02 header matrix through the real stack a non-JSON Content-Type is a 415 UNSUPPORTED_MEDIA_TYPE naming the allowed media type and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict-headers.apispec.ts',
            title:
              'CMS-03B-02 header matrix through the real stack an Idempotency-Key longer than 128 characters is refused before any persistence and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict-headers.apispec.ts',
            title:
              'CMS-03B-02 header matrix through the real stack an If-Match that differs from the body expectedVersion is refused before any persistence and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict-headers.apispec.ts',
            title:
              'CMS-03B-02 header matrix through the real stack an undeclared query parameter on the command route is a 400 and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a /blocks choice path is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a 129-entry choices list is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a body conflictId that differs from the path conflict is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a body entryId that differs from the path entry is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a choice for a path the conflict does not carry is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a choice kind outside base, theirs, yours and explicit is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a malformed conflict id in the path is a structural 400 naming /conflictId and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a non-numeric expectedVersion is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack an explicit value the field kind refuses is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack an unknown request member is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              "CMS-03B-02 typed value reasons through the real stack an explicit choice with 'a raw string for a rich_text field' is the typed 422 'rich_text_not_canonical' at its field pointer and nothing is written",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              "CMS-03B-02 typed value reasons through the real stack an explicit choice with 'an object with an undeclared property' is the typed 422 'object_property_invalid' at its field pointer and nothing is written",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              'CMS-03B-02 typed value reasons through the real stack explicit choices with ADMITTED values resolve the same conflict once',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-012',
    text: 'CMS-03B-02: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
    clauses: [
      {
        text: 'CMS-03B-02: derive actor and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-resolution.test.ts',
            title:
              'CMS-03B-02 conflict resolution request never accepts caller-supplied authority',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-02' failure mapping through the production app and adapter CMS-03B-02 sends the named RPC once with the verified session context and never a caller identity",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 closes the versioned resolution envelope with server-derived actor',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-forged-context.test.ts',
            title:
              "'CMS-03B-02' derives the actor and acting context from the verified session only CMS-03B-02 sends the RPC the session user and party and none of the forged header or cookie identities",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-forged-context.test.ts',
            title:
              "'CMS-03B-02' refuses forged authority in the request body CMS-03B-02 refuses a body member named context as an unknown field and never calls the RPC",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-forged-context.test.ts',
            title:
              "'CMS-03B-02' refuses forged authority in the request body CMS-03B-02 refuses a body member named actingPartyId as an unknown field and never calls the RPC",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_authority.sql',
            title:
              'resolve: a forged acting party is concealed as NOT_FOUND and writes nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_authority.sql',
            title:
              'resolve: a request member naming an owner is INVALID_REQUEST and writes nothing',
          },
        ],
      },
      {
        text: 'enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 401, 403 and 404 through the real stack no session is a 401 with a reauthenticate hint and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 401, 403 and 404 through the real stack a confirmed member holding no CMS grant is a 403 and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 401, 403 and 404 through the real stack a person outside the owning organization gets the same empty 404 as for an absent conflict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 401, 403 and 404 through the real stack a conflict that belongs to another entry is the same empty 404 and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 refuses a visible actor without assigned edit authority',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title: 'CMS-03B-02 conceals an absent or foreign conflict identity',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route rejects missing edit capability and a weak validator before mutation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '403 and concealment decided by the database for other principals [P2-S10-AC-006] [P2-S10-AC-012] a confirmed member holding no CMS grant is a 403, and nothing is written',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-013',
    text: 'CMS-03B-02: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03B-02: enforce declared idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict-commit.apispec.ts',
            title:
              'CMS-03B-02 concurrency, idempotency and reconciliation through the real stack an explicit value that validates is committed once: two parents, one revision, one audit row, one outbox event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 exact-key replay returns the identical resolved revision',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-02' write conflicts through the production app and adapter CMS-03B-02 maps IDEMPOTENCY_MISMATCH to a 409 CONFLICT that tells the client to use a new key",
          },
        ],
      },
      {
        text: 'If-Match or CAS',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict-commit.apispec.ts',
            title:
              'CMS-03B-02 concurrency, idempotency and reconciliation through the real stack a stale expectedVersion is a definite 409 VERSION_MISMATCH and the open conflict is preserved',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict-commit.apispec.ts',
            title:
              'CMS-03B-02 concurrency, idempotency and reconciliation through the real stack a base revision that is not the conflict base is a definite 409 VERSION_MISMATCH',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 refuses a moved entry version without selecting a winner',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route rejects body/header version disagreement before reaching the port',
          },
        ],
      },
      {
        text: 'duplicate, replay',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title: 'CMS-03B-02 replay does not append a duplicate revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 rejects duplicate path decisions instead of choosing a last winner',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-010] [P2-S10-AC-013] resolving with an explicit choice commits a two-parent revision once, closes the conflict, and a replay adds nothing',
          },
        ],
      },
      {
        text: 'pagination',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/write-query-admission.test.ts',
            title:
              'CMS-03B-02 conflict-resolution command query admission refuses an undeclared query before any admission or port side effect',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-editorial-registry-openapi.test.ts',
            title:
              'Slice 10 CMS-03B-01/02/03/04 canonical inventory authority keeps the query surface only on the safe history read',
          },
        ],
      },
      {
        text: 'cache',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route delegates a validated explicit choice to the private port and returns a no-store two-parent revision',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict-commit.apispec.ts',
            title:
              'CMS-03B-02 concurrency, idempotency and reconciliation through the real stack an explicit value that validates is committed once: two parents, one revision, one audit row, one outbox event',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-rate-scope.test.ts',
            title:
              'route registry rate limits (BE03b:152-165) CMS-03B-02 asks the limiter for 60/min per actor and 120/min per acting party, never mixed',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route enforces the conflict-specific rate decision and fails closed on limiter outage',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-02' failure mapping through the production app and adapter CMS-03B-02 refuses a denied rate decision with 429 RATE_LIMITED, Retry-After and no RPC call",
          },
        ],
      },
      {
        text: 'deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route aborts a stalled session dependency at the route deadline',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route aborts the resolve port when cumulative stage latency exhausts one shared route budget',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-02' failure mapping through the production app and adapter CMS-03B-02 maps a dependency that outlives the route deadline to a retryable 504 GATEWAY_TIMEOUT and aborts the call",
          },
        ],
      },
      {
        text: 'concurrency rules.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-concurrency.apispec.ts',
            title:
              'simultaneous writers through the real stack two resolutions of one conflict commit exactly one two-parent revision and the other is a definite 409',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/011-authority-revocation.mjs',
            title:
              'S1 resolve/grant: the held writer committed exactly one revision (no error)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/011-authority-revocation.mjs',
            title:
              'S2 resolve/grant: once the revocation committed the writer was refused with FORBIDDEN (FORBIDDEN)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/011-authority-revocation.mjs',
            title:
              'S2 resolve/assignment: once the revocation committed the writer was refused with FORBIDDEN (FORBIDDEN)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs',
            title:
              'S1 resolve/human: the parked writer committed exactly one revision (no error)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs',
            title:
              'S4 resolve: the writer the deadlock detector aborted answers the typed retryable CONFLICT, not a raw 40P01 (CONFLICT)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs',
            title:
              'S4 resolve: the same command retried with the same idempotency key commits exactly one revision (no error)',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict-commit.apispec.ts',
            title:
              'CMS-03B-02 concurrency, idempotency and reconciliation through the real stack resolving the now-closed conflict again is the typed 409 INVALID_TRANSITION and nothing is written',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-014',
    text: 'CMS-03B-02: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
    clauses: [
      {
        text: 'CMS-03B-02: map every declared domain',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'VERSION_MISMATCH' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'IDEMPOTENCY_MISMATCH' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'INVALID_TRANSITION' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'CONFLICT' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'UNAUTHENTICATED' to 401 'UNAUTHENTICATED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'FORBIDDEN' to 403 'FORBIDDEN'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'NOT_FOUND' to 404 'NOT_FOUND'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'VALIDATION_FAILED' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'INVALID_REQUEST' to 400 'INVALID_REQUEST'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'RATE_LIMITED' to 429 'RATE_LIMITED'",
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs',
            title:
              'S4 resolve: the writer the deadlock detector aborted answers the typed retryable CONFLICT, not a raw 40P01 (CONFLICT)',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict-commit.apispec.ts',
            title:
              'CMS-03B-02 concurrency, idempotency and reconciliation through the real stack resolving the now-closed conflict again is the typed 409 INVALID_TRANSITION and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 401, 403 and 404 through the real stack an absent conflict id is an empty 404 and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'media_source_unavailable' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'object_kind_unspecified' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'object_property_invalid' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'relation_target_unavailable' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'rich_text_not_canonical' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 maps the database token 'taxonomy_source_unavailable' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 publishes the field pointer of the typed value reason 'media_source_unavailable' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 publishes the field pointer of the typed value reason 'object_kind_unspecified' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 publishes the field pointer of the typed value reason 'object_property_invalid' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 publishes the field pointer of the typed value reason 'relation_target_unavailable' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 publishes the field pointer of the typed value reason 'rich_text_not_canonical' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-02' declared token catalog CMS-03B-02 publishes the field pointer of the typed value reason 'taxonomy_source_unavailable' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              "CMS-03B-02 typed value reasons through the real stack an explicit choice with 'a raw string for a rich_text field' is the typed 422 'rich_text_not_canonical' at its field pointer and nothing is written",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              "CMS-03B-02 typed value reasons through the real stack an explicit choice with 'an object with an undeclared property' is the typed 422 'object_property_invalid' at its field pointer and nothing is written",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
            title:
              'CMS-03B-02 typed value reasons through the real stack explicit choices with ADMITTED values resolve the same conflict once',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_value_source_resolve.sql',
            title:
              'cms_resolve_conflict: media_array fails closed with the typed media_source_unavailable reason [BE03b]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_value_source_resolve.sql',
            title:
              'cms_resolve_conflict: media_object fails closed with the typed media_source_unavailable reason [BE03b]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_value_source_resolve.sql',
            title:
              'cms_resolve_conflict: tax_nonempty fails closed with the typed taxonomy_source_unavailable reason [BE03b]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_resolve_conflict: a raw string for a rich_text choice is rich_text_not_canonical [BE03b:1154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_resolve_conflict: an object choice with an undeclared key is object_property_invalid [BE03b:1053]',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-02' failure mapping through the production app and adapter CMS-03B-02 maps a transport failure to a retryable 503 DEPENDENCY_UNAVAILABLE without echoing the dependency text",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-02' failure mapping through the production app and adapter CMS-03B-02 scrubs an unexpected RPC 5xx into a retryable 503 and never echoes its body",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-02' failure mapping through the production app and adapter CMS-03B-02 maps a success payload that fails the declared resource contract to a non-retryable 502 BAD_GATEWAY",
          },
        ],
      },
      {
        text: 'timeout',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-02' failure mapping through the production app and adapter CMS-03B-02 maps a dependency that outlives the route deadline to a retryable 504 GATEWAY_TIMEOUT and aborts the call",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route aborts a stalled session dependency at the route deadline',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-02' failure mapping through the production app and adapter CMS-03B-02 refuses a denied rate decision with 429 RATE_LIMITED, Retry-After and no RPC call",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-02' failure mapping through the production app and adapter CMS-03B-02 fails closed with 503 and no RPC call when the rate limiter itself is unavailable",
          },
        ],
      },
      {
        text: 'internal failure to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-02' failure mapping through the production app and adapter CMS-03B-02 maps the database INTERNAL_ERROR token to a scrubbed 500 INTERNAL_ERROR",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'conflict and state tokens [P2-S10-AC-008] maps INTERNAL_ERROR to a scrubbed 500, never a user-blamed 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'conflict and state tokens refuses an unregistered P0001 message as a scrubbed 500 rather than blaming the caller',
          },
        ],
      },
      {
        text: 'preserve safe recovery.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: 409 and closure treats a 404 after a 409 as the conflict no longer being open and refetches the draft',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: resolve after a lost response keeps the key and replays the identical request on retry',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: refusals keep the choices states a rate limit with the wait and lets the author submit again',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: refusals keep the choices maps a typed 422 to the choice it names and fixed copy',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-conflict-recovery.test.ts',
            title:
              'EA conflict resolution recovers from every dependency failure a 500 INTERNAL_ERROR keeps every choice, shows fixed copy and the retry replays the identical request under the same key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-conflict-recovery.test.ts',
            title:
              'EA conflict resolution recovers from every dependency failure a 502 BAD_GATEWAY keeps every choice, shows fixed copy and the retry replays the identical request under the same key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-conflict-recovery.test.ts',
            title:
              'EA conflict resolution recovers from every dependency failure a 503 DEPENDENCY_UNAVAILABLE keeps every choice, shows fixed copy and the retry replays the identical request under the same key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-conflict-recovery.test.ts',
            title:
              'EA conflict resolution recovers from every dependency failure a 504 GATEWAY_TIMEOUT keeps every choice, shows fixed copy and the retry replays the identical request under the same key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-ea-conflict-recovery.test.ts',
            title:
              'EA conflict resolution recovers from every dependency failure a network failure keeps every choice, shows fixed copy and the retry replays the identical request under the same key',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-015',
    text: 'CMS-03B-02: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03B-02: commit audit and outbox effects atomically where applicable',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict-commit.apispec.ts',
            title:
              'CMS-03B-02 concurrency, idempotency and reconciliation through the real stack an explicit value that validates is committed once: two parents, one revision, one audit row, one outbox event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 emits one additional revision-created outbox event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 advances the entry version atomically with conflict closure',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_resolve_conflict: every typed refusal committed nothing and left the conflict open',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'resolve: a failure on the audit insert rolls back the revision, the conflict closure, the reservation and the outbox event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'resolve: a failure on the outbox insert rolls back the revision, the conflict closure, the reservation and the audit row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'resolve: a failure completing the idempotency reservation rolls back the revision, the conflict closure, audit row and outbox event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'every injected failure surfaced from the real command: none of the 12 (operation x fault) calls swallowed it',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'control: a resolve with no fault commits one revision, one audit row, one outbox event and one reservation',
          },
        ],
      },
      {
        text: 'reconcile lost responses without duplicate effects',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict-commit.apispec.ts',
            title:
              'CMS-03B-02 concurrency, idempotency and reconciliation through the real stack a lost response is an unknown outcome and the same-key replay returns the committed resolution without a second effect',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title: 'CMS-03B-02 replay does not append a duplicate revision',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: resolve after a lost response keeps the key and replays the identical request on retry',
          },
        ],
      },
      {
        text: 'emit redacted telemetry.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-telemetry.test.ts',
            title:
              "'CMS-03B-02' redacted telemetry through the production app and adapter CMS-03B-02 emits one success event naming only the operation, never an identifier, value or credential",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-telemetry.test.ts',
            title:
              "'CMS-03B-02' redacted telemetry through the production app and adapter CMS-03B-02 emits a failure event with the status and retryability but still no identifier, value or credential",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-telemetry-metrics.test.ts',
            title:
              'request metrics and attributes [P2-S10-AC-015] a resolved conflict also counts the closed conflict',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-telemetry-reads.test.ts',
            title:
              'redaction (BE03b:1439) [P2-S10-AC-009] [P2-S10-AC-015] no event carries an identifier, value, credential or request body',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-016',
    text: 'CMS-03B-03: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03B-03 — CMS-07 — GET /api/v1/cms/entries/{entryId}/revisions — RevisionHistoryQuery → 200 RevisionHistoryPage. Comparison output covers field, block, and relation domains using privacy-safe stable identities.',
    clauses: [
      {
        text: 'CMS-03B-03: define strict Zod request, path, query, header, and success contracts',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-history.test.ts',
            title:
              'CMS-03B-03 revision history query allowlists only state, locale, and compareRevisionId filters',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-history.test.ts',
            title:
              'CMS-03B-03 revision history query binds exactly one UUID path parameter',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-history.test.ts',
            title:
              'CMS-03B-03 revision summary and page accepts a nullable cursor and compare block and rejects unknown keys',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route rejects malformed path IDs and mutation-only headers',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-editorial-registry-openapi.test.ts',
            title:
              'Slice 10 CMS-03B-01/02/03/04 canonical inventory authority keeps the query surface only on the safe history read',
          },
        ],
      },
      {
        text: 'complete the declared happy path — CMS-03B-03 — CMS-07 — GET /api/v1/cms/entries/{entryId}/revisions — RevisionHistoryQuery → 200 RevisionHistoryPage.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route returns a strict page with a strong version ETag and no-store',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 window, keyset cursor and cache contract through the real stack the default window is 25 revisions, newest first, with a strong version ETag, no-store and a signed cursor within 512 characters',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-01 append and CMS-03B-03 history through the real stack [P2-S10-AC-020] the history read lists every revision newest first with a page ETag',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title: 'CMS-03B-03 first page starts with the newest revision',
          },
        ],
      },
      {
        text: 'Comparison output covers field, block, and relation domains using privacy-safe stable identities.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-history.test.ts',
            title:
              '[P2-S10-AC-016] CMS-03B-03 change pointers follow the D5 grammar of their domain accepts exactly the three D5 pointer grammars for their own domain',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 compare and the 401, 403 and 404 boundary through the real stack compareRevisionId returns the compare block with domain-tagged changes and the safe restore descriptor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage_domains.sql',
            title:
              'CMS-07 changes are ordered by domain: field, then block, then relation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage_domains.sql',
            title:
              'CMS-07 relation change is keyed by the stable field id and the locked keyed targetToken, stable across both sides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage_domains.sql',
            title:
              'CMS-07 compare output never publishes the relation target identity',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage_domains.sql',
            title:
              'CMS-07 block side hash is the locked JCS {blockKey, blockVersion, blockRegistryDigest, mode, patternRef, props, bindings} input',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-017',
    text: 'CMS-03B-03: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
    clauses: [
      {
        text: 'CMS-03B-03: reject unknown fields',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route rejects duplicated and unknown query keys before any dependency call',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack an unknown query member is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a repeated limit is a structural 400 INVALID_REQUEST and writes nothing',
          },
        ],
      },
      {
        text: 'every invalid request value with the exact stable field violation, safe message, and no state mutation.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route returns the locked 400 violation for malformed history query ?limit=0',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route returns the locked 400 violation for malformed history query ?limit=51',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route returns the locked 400 violation for malformed history query ?compareRevisionId=not-a-uuid',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route returns the locked 400 violation for malformed history query ?locale=en_US',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a compareRevisionId that is not a UUID is a 400 naming its pointer and code',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a malformed locale is a 400 naming its pointer and code',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a state outside the closed revision states is a 400 naming its pointer and code',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title: 'CMS-03B-03 history read writes no audit event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title: 'CMS-03B-03 history read writes no outbox event',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a negative limit is a structural 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a limit in exponent notation is a structural 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a limit with a leading zero is a structural 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a limit written as 50.0 is a structural 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a repeated cursor member is a structural 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack an unsigned copy with a keyId that is not a UUID is a structural 400 INVALID_REQUEST',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack an unsigned copy with a signature that is not hexadecimal is a structural 400 INVALID_REQUEST',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a correctly signed envelope with an extra member is a structural 400 INVALID_REQUEST',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a correctly signed cursor bound to another query hash is the typed 409 CONFLICT restart with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a cursor signed under a key id the Vault does not hold is the typed 409 CONFLICT restart with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a correctly signed cursor that expired in 1970 is the typed 409 CONFLICT restart with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack an uppercase state is a 400 naming its pointer and code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a 36-character locale names /locale twice (grammar and length) and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a correctly signed cursor that expires more than 24 hours from now is the typed 409 CONFLICT restart with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a correctly signed cursor whose expiresAt is a number is the typed 409 CONFLICT restart with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a correctly signed cursor whose last revision id is not a UUID is the typed 409 CONFLICT restart with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a correctly signed cursor whose last revision number is not a number is the typed 409 CONFLICT restart with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a correctly signed cursor whose last revision number is zero is the typed 409 CONFLICT restart with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a correctly signed cursor whose queryHash is not a hash is the typed 409 CONFLICT restart with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a correctly signed envelope without the expiresAt member is a structural 400 INVALID_REQUEST',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack an unsigned copy whose keyId is a number is a structural 400 INVALID_REQUEST',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack an unsigned copy with a malformed expiresAt is the typed 409 CONFLICT restart with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack an unsigned copy with a truncated signature is a structural 400 INVALID_REQUEST',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack an unsigned copy with an extra member is a structural 400 INVALID_REQUEST',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack an unsigned copy without the queryHash member is a structural 400 INVALID_REQUEST',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack control: the same envelope re-signed unchanged is accepted and serves the next page',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a compareRevisionId that is empty is a 400 naming its pointer and code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a compareRevisionId written with uppercase hexadecimal is a structural 400',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a limit above the maximum of 50 is a structural 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a limit of zero is a structural 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a limit with a leading space is a structural 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a limit with a plus sign is a structural 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a locale ending in a hyphen is a 400 naming its pointer and code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a one-character locale is a 400 naming its pointer and code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack a repeated compareRevisionId member is a structural 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack an empty limit is a structural 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack an entryId smuggled as a query member is a structural 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 limit and filter matrix through the real stack an ownerId smuggled as a query member is a structural 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a 513-character cursor is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a cursor that is base64 of an array is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a cursor that is base64 of non-JSON is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a cursor that is not base64 is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a cursor whose JSON has none of the six signed members is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a fractional limit is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a limit of 0 is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a limit of 51 is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a malformed entry id in the path is a structural 400 naming /entryId',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a non-numeric limit is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a repeated limit is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a valid cursor replayed with a changed limit is bound to its original context: the typed 409 restart',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a valid cursor replayed with a changed locale filter is bound to its original context: the typed 409 restart',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a valid cursor replayed with a changed state filter is bound to its original context: the typed 409 restart',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a well-formed cursor with a changed signature is the typed 409 restart, never a page',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack an empty cursor is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack an unknown query member is a structural 400 INVALID_REQUEST and writes nothing',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-018',
    text: 'CMS-03B-03: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
    clauses: [
      {
        text: 'CMS-03B-03: derive actor and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-03' failure mapping through the production app and adapter CMS-03B-03 sends the named RPC once with the verified session context and never a caller identity",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route maps session transport and shape failures before persistence',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-forged-context.test.ts',
            title:
              "'CMS-03B-03' derives the actor and acting context from the verified session only CMS-03B-03 sends the RPC the session user and party and none of the forged header or cookie identities",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-forged-context.test.ts',
            title:
              "'CMS-03B-03' derives the actor and acting context from the verified session only CMS-03B-03 refuses a query member naming an actor, party, owner or capability before any RPC call",
          },
        ],
      },
      {
        text: 'enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 compare and the 401, 403 and 404 boundary through the real stack no session is a 401 with a reauthenticate hint and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 compare and the 401, 403 and 404 boundary through the real stack a confirmed member holding no CMS grant is a 403 and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 compare and the 401, 403 and 404 boundary through the real stack a person outside the owning organization and an absent entry get the same empty 404',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 compare and the 401, 403 and 404 boundary through the real stack a compareRevisionId that belongs to another entry is the same empty 404',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route allows a reviewer but rejects a caller without read capability',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title:
              'CMS-03B-03 permits a reviewer with only the registered grant and active assignment',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title: 'CMS-03B-03 refuses a reviewer after assignment revocation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title:
              'CMS-03B-03 revoked reviewer assignment is a visible-but-unscoped refusal',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-019',
    text: 'CMS-03B-03: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03B-03: enforce declared idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route rejects malformed path IDs and mutation-only headers',
          },
        ],
      },
      {
        text: 'If-Match or CAS',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route rejects malformed path IDs and mutation-only headers',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 window, keyset cursor and cache contract through the real stack the default window is 25 revisions, newest first, with a strong version ETag, no-store and a signed cursor within 512 characters',
          },
        ],
      },
      {
        text: 'duplicate, replay',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 window, keyset cursor and cache contract through the real stack the signed cursor continues exactly where the page stopped and the last page has no cursor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title:
              'CMS-03B-03 keyset continuation does not skip the next visible revision',
          },
        ],
      },
      {
        text: 'pagination',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 window, keyset cursor and cache contract through the real stack a limit of 50 is the maximum window and returns every revision of this entry in one page',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 window, keyset cursor and cache contract through the real stack a limit of 1 returns one revision and a cursor to the next',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a valid cursor replayed with a changed state filter is bound to its original context: the typed 409 restart',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title:
              'CMS-03B-03 binds a valid cursor to its original filter context',
          },
        ],
      },
      {
        text: 'cache',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route returns a strict page with a strong version ETag and no-store',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 window, keyset cursor and cache contract through the real stack the default window is 25 revisions, newest first, with a strong version ETag, no-store and a signed cursor within 512 characters',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route uses the independent 300/min read budget and propagates denial',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-rate-scope.test.ts',
            title:
              'route registry rate limits (BE03b:152-165) CMS-03B-03 asks the limiter for 300/min per actor and 600/min per acting party, never mixed',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-03' failure mapping through the production app and adapter CMS-03B-03 refuses a denied rate decision with 429 RATE_LIMITED, Retry-After and no RPC call",
          },
        ],
      },
      {
        text: 'deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 shared route deadline ends the entire request at the declared deadline when session resolution stalls',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-cancellation.test.ts',
            title:
              'read routes spend one 8,000 ms budget (BE03b:152-165) [P2-S10-AC-020] [P2-S10-AC-071] CMS-03B-03 clamps the cumulative route deadline to 8,000 ms even though the production default is 15,000 ms',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-03' failure mapping through the production app and adapter CMS-03B-03 maps a dependency that outlives the route deadline to a retryable 504 GATEWAY_TIMEOUT and aborts the call",
          },
        ],
      },
      {
        text: 'concurrency rules.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-concurrency.apispec.ts',
            title:
              'history reads stay consistent while writes commit a cursor taken before a write continues strictly below the last served revision with no gap and no repeat',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-concurrency.apispec.ts',
            title:
              'history reads stay consistent while writes commit six simultaneous reads around two simultaneous writes each return a complete, gap-free, strictly descending page',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title: 'CMS-03B-03 history read writes no audit event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title: 'CMS-03B-03 history read writes no outbox event',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-020',
    text: 'CMS-03B-03: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery. More than 512 authorized changes is refused with the typed comparison-unavailable response and never partially returned.',
    clauses: [
      {
        text: 'CMS-03B-03: map every declared domain',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-03' failure mapping through the production app and adapter CMS-03B-03 maps the database NOT_FOUND token to an empty-detail 404 NOT_FOUND",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-03' failure mapping through the production app and adapter CMS-03B-03 maps the database FORBIDDEN token to 403 FORBIDDEN",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a well-formed cursor with a changed signature is the typed 409 restart, never a page',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 compare and the 401, 403 and 404 boundary through the real stack a compareRevisionId that names no revision is an empty 404 and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'typed 422 reason tokens (BE03b:1049-1054, :1211) [P2-S10-AC-020] maps comparison_unavailable on the history read to 422 VALIDATION_FAILED with reasonCode',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-03' failure mapping through the production app and adapter CMS-03B-03 maps a transport failure to a retryable 503 DEPENDENCY_UNAVAILABLE without echoing the dependency text",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-03' failure mapping through the production app and adapter CMS-03B-03 scrubs an unexpected RPC 5xx into a retryable 503 and never echoes its body",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-03' failure mapping through the production app and adapter CMS-03B-03 maps a success payload that fails the declared resource contract to a non-retryable 502 BAD_GATEWAY",
          },
        ],
      },
      {
        text: 'timeout',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-03' failure mapping through the production app and adapter CMS-03B-03 maps a dependency that outlives the route deadline to a retryable 504 GATEWAY_TIMEOUT and aborts the call",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 shared route deadline ends the entire request at the declared deadline when session resolution stalls',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-03' failure mapping through the production app and adapter CMS-03B-03 refuses a denied rate decision with 429 RATE_LIMITED, Retry-After and no RPC call",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-03' failure mapping through the production app and adapter CMS-03B-03 fails closed with 503 and no RPC call when the rate limiter itself is unavailable",
          },
        ],
      },
      {
        text: 'internal failure to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-03' failure mapping through the production app and adapter CMS-03B-03 maps the database INTERNAL_ERROR token to a scrubbed 500 INTERNAL_ERROR",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'conflict and state tokens [P2-S10-AC-008] maps INTERNAL_ERROR to a scrubbed 500, never a user-blamed 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'conflict and state tokens refuses an unregistered P0001 message as a scrubbed 500 rather than blaming the caller',
          },
        ],
      },
      {
        text: 'preserve safe recovery.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a valid cursor replayed with a changed limit is bound to its original context: the typed 409 restart',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialRevisionCompare.test.tsx',
            title:
              'CmsEditorialRevisionCompare: typed refusals, never a truncated success renders comparison_unavailable as a non-disclosing unavailable state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialRevisionCompare.test.tsx',
            title:
              'CmsEditorialRevisionCompare: typed refusals, never a truncated success renders comparison_too_large as its own refusal with no change list',
          },
        ],
      },
      {
        text: 'More than 512 authorized changes is refused with the typed comparison-unavailable response and never partially returned.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'typed 422 reason tokens (BE03b:1049-1054, :1211) [P2-S10-AC-020] maps comparison_too_large on the history read to 422 VALIDATION_FAILED with reasonCode',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-history.test.ts',
            title:
              'CMS-03B-03 revision summary and page keeps the 512-change bound while accepting the exact boundary',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage_domains.sql',
            title:
              'CMS-07 513 combined changes is the typed comparison_too_large refusal, never partial',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage_domains.sql',
            title:
              'CMS-07 exactly 512 combined changes is still a complete 200',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-03' declared token catalog CMS-03B-03 maps the database token 'comparison_too_large' to 422 'VALIDATION_FAILED'",
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-021',
    text: 'CMS-03B-03: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03B-03: commit audit and outbox effects atomically where applicable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title: 'CMS-03B-03 history read writes no audit event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title: 'CMS-03B-03 history read writes no outbox event',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 window, keyset cursor and cache contract through the real stack the default window is 25 revisions, newest first, with a strong version ETag, no-store and a signed cursor within 512 characters',
          },
        ],
      },
      {
        text: 'reconcile lost responses without duplicate effects',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-concurrency.apispec.ts',
            title:
              'history reads stay consistent while writes commit a lost response to a read is recovered by repeating it: the repeat is the identical page and no row is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title: 'CMS-03B-03 history read writes no outbox event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title: 'CMS-03B-03 history read writes no audit event',
          },
        ],
      },
      {
        text: 'emit redacted telemetry.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-telemetry-reads.test.ts',
            title:
              'read operations [P2-S10-AC-020] history and list reads carry safe counts and never a revision metric',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-telemetry-reads.test.ts',
            title:
              'redaction (BE03b:1439) [P2-S10-AC-009] [P2-S10-AC-015] no event carries an identifier, value, credential or request body',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-telemetry.test.ts',
            title:
              "'CMS-03B-03' redacted telemetry through the production app and adapter CMS-03B-03 emits one success event naming only the operation, never an identifier, value or credential",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-telemetry.test.ts',
            title:
              "'CMS-03B-03' redacted telemetry through the production app and adapter CMS-03B-03 emits a failure event with the status and retryability but still no identifier, value or credential",
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-022',
    text: 'CMS-03B-04: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03B-04 — CMS-07 — POST /api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore — RevisionRestoreRequest → 201 EntryRevisionResource. Restore preparation binds an immutable migration-chain manifest derived from at most 64 completed 03a plan edges.',
    clauses: [
      {
        text: 'CMS-03B-04: define strict Zod request, path, query, header, and success contracts',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-restore.test.ts',
            title:
              'CMS-03B-04 revision restore request accepts the canonical body and rejects unknown keys',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-restore.test.ts',
            title:
              'CMS-03B-04 revision restore request binds exactly the entry and revision path parameters',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-restore.test.ts',
            title:
              'CMS-03B-04 revision restore request requires JSON, an idempotency key, and an exact strong If-Match',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-restore.test.ts',
            title:
              'CMS-03B-04 revision restore request requires the migration chain id and positive versions',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/write-query-admission.test.ts',
            title:
              'CMS-03B-04 restore command query admission refuses an undeclared query before any admission or port side effect',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-04' failure mapping through the production app and adapter CMS-03B-04 maps a success payload that fails the declared resource contract to a non-retryable 502 BAD_GATEWAY",
          },
        ],
      },
      {
        text: 'complete the declared happy path — CMS-03B-04 — CMS-07 — POST /api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore — RevisionRestoreRequest → 201 EntryRevisionResource.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-routes.test.ts',
            title:
              'CMS-03B-04 protected revision-restore route delegates a typed restore and returns a new draft revision with strong ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-03 compare and CMS-03B-04 restore through the real stack [P2-S10-AC-022] [P2-S10-AC-027] restoring the first revision creates one new draft with the chain from the compare read, and an exact-key replay adds nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain.sql',
            title: 'a same-schema restore returns a new draft revision',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 concurrency, idempotency and reconciliation through the real stack a lost response is an unknown outcome and the same-key replay returns the committed restore without a second effect',
          },
        ],
      },
      {
        text: 'Restore preparation binds an immutable migration-chain manifest derived from at most 64 completed 03a plan edges.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain.sql',
            title:
              'restore-chain manifest carries the ordered bounded plan edges and a unique hash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain.sql',
            title:
              'a restore chain longer than 64 edges is refused, never truncated',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain.sql',
            title: 'no over-limit restore manifest is ever recorded',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain.sql',
            title:
              'restore chain composes real Slice 09 completed plan edges, never hand-inserted rows',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_lineage.sql',
            title: 'a recorded restore-chain manifest cannot be updated',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_lineage.sql',
            title: 'a recorded restore-chain manifest cannot be deleted',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-restore-chain.test.ts',
            title:
              'restore chain length bound [P2-S10-AC-022] accepts a 64-edge chain naming 65 schema versions',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-restore.test.ts',
            title:
              'CMS-03B-04 revision restore verification admits a 64-edge chain (65 named schema versions) and refuses a 66th',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-023',
    text: 'CMS-03B-04: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
    clauses: [
      {
        text: 'CMS-03B-04: reject unknown fields',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 request validation through the real stack an unknown request member is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-restore.test.ts',
            title:
              'CMS-03B-04 revision restore request accepts the canonical body and rejects unknown keys',
          },
        ],
      },
      {
        text: 'every invalid request value with the exact stable field violation, safe message, and no state mutation.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 request validation through the real stack a migrationChainId that is not a UUID is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 request validation through the real stack a zero expectedVersion is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 request validation through the real stack a body revisionId that differs from the path revision is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 request validation through the real stack a malformed revision id in the path is a structural 400 naming /revisionId and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'restore: a malformed migrationChainId is pointed at /migrationChainId',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'restore: a malformed expectedVersion is pointed at /expectedVersion',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_policy_evidence.sql',
            title:
              'a refused restore committed no entry, revision, value, relation, manifest, reservation, outbox or audit row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'an If-Match transport copy that disagrees with expectedVersion is refused',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack an expectedVersion with a leading zero is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack an expectedVersion above the signed 64-bit range is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a migrationChainId with uppercase hexadecimal is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a missing revisionId is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a body entryId that is not a UUID is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a forged ownerId member is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a request body that is an array is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 header and path matrix through the real stack a malformed entry id in the path is a structural 400 naming /entryId and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 header and path matrix through the real stack a missing If-Match is refused before any persistence and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 header and path matrix through the real stack a weak If-Match validator is refused before any persistence and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 header and path matrix through the real stack an If-Match that differs from the body expectedVersion is refused before any persistence and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 header and path matrix through the real stack a non-JSON Content-Type is a 415 UNSUPPORTED_MEDIA_TYPE naming the allowed media type and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 header and path matrix through the real stack an Idempotency-Key longer than 128 characters is refused before any persistence and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 header and path matrix through the real stack an Idempotency-Key shorter than 8 characters is refused before any persistence and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 header and path matrix through the real stack an entry id written with uppercase hexadecimal in the path never matches the body entry and is a 422 mismatch',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 header and path matrix through the real stack an undeclared query parameter on the command route is a 400 and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a body revisionId written with uppercase hexadecimal is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a forged actorId member is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a forged context member is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a missing entryId is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a missing expectedVersion is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a missing migrationChainId is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a numeric expectedVersion is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a numeric migrationChainId is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a request body that is a JSON string is a 422 at the root pointer and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a request body that is not parseable JSON is a 400 INVALID_REQUEST and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack a request body that is null is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-restore.apispec.ts',
            title:
              'CMS-03B-04 request-value matrix through the real stack an empty migrationChainId is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 request validation through the real stack a body entryId that differs from the path entry is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 request validation through the real stack a chain id that is not the chain the command re-derives is the typed 409 migration_chain_mismatch and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 request validation through the real stack an unknown request member is a 422 with its stable pointer and code and nothing is written',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-024',
    text: 'CMS-03B-04: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary. Authorization also covers every chain edge and conceals an unreadable source or chain.',
    clauses: [
      {
        text: 'CMS-03B-04: derive actor and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-production.test.ts',
            title:
              'CMS-03B-04 production restore port (RED: seam still returns 503) binds the restore port to cms_restore_revision with server-derived context',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-production.test.ts',
            title:
              'CMS-03B-04 production restore port (RED: seam still returns 503) rejects caller-supplied authority keys with 422 and no RPC call',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-restore.test.ts',
            title:
              'CMS-03B-04 revision restore request never accepts caller-supplied authority',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-04' failure mapping through the production app and adapter CMS-03B-04 sends the named RPC once with the verified session context and never a caller identity",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'an ownership or authority assertion has no request slot and is refused',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-forged-context.test.ts',
            title:
              "'CMS-03B-04' derives the actor and acting context from the verified session only CMS-03B-04 sends the RPC the session user and party and none of the forged header or cookie identities",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-forged-context.test.ts',
            title:
              "'CMS-03B-04' refuses forged authority in the request body CMS-03B-04 refuses a body member named authUserId as an unknown field and never calls the RPC",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_authority.sql',
            title:
              'restore: a forged acting party is concealed as NOT_FOUND and writes nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_authority.sql',
            title:
              'restore: an actor who is not a member of the owner is concealed as NOT_FOUND and writes nothing',
          },
        ],
      },
      {
        text: 'enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 401, 403 and 404 through the real stack no session is a 401 with a reauthenticate hint and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 401, 403 and 404 through the real stack a confirmed member holding no CMS grant is a 403 and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 401, 403 and 404 through the real stack a person outside the owning organization gets an empty 404 and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'a tenant member without edit authority over the entry is refused (FORBIDDEN)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'an actor outside the owning tenant cannot tell the entry exists (NOT_FOUND)',
          },
        ],
      },
      {
        text: 'Authorization also covers every chain edge and conceals an unreadable source or chain.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'a chain edge owned by another tenant is invisible to the restoring tenant: the chain is unavailable, never disclosed',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title: 'an absent source revision is concealed as NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'a revision that belongs to another entry is concealed as NOT_FOUND',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 401, 403 and 404 through the real stack a source revision that does not exist is an empty 404 and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 401, 403 and 404 through the real stack a source revision that belongs to another entry is the same empty 404 and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-production.test.ts',
            title:
              'CMS-03B-04 production restore port (RED: seam still returns 503) conceals an unreadable restore source through the composed adapter',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-025',
    text: 'CMS-03B-04: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules. The idempotency business hash and CAS bind the selected migration-chain identity.',
    clauses: [
      {
        text: 'CMS-03B-04: enforce declared idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 concurrency, idempotency and reconciliation through the real stack a lost response is an unknown outcome and the same-key replay returns the committed restore without a second effect',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_evidence.sql',
            title: 'a lost-response replay returns the first restore',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'a restore without an Idempotency-Key is refused before any read or write',
          },
        ],
      },
      {
        text: 'If-Match or CAS',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 concurrency, idempotency and reconciliation through the real stack a stale expectedVersion is a definite 409 VERSION_MISMATCH and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-03 compare and CMS-03B-04 restore through the real stack [P2-S10-AC-025] a stale entry version is a definite 409 conflict, never a retryable 503',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain.sql',
            title:
              'a stale entry version fails the restore CAS with the typed VERSION_MISMATCH path (P0001, as append and resolve; cascade: write-path audit P2-S10-AC-025, was SQLSTATE 40001)',
          },
        ],
      },
      {
        text: 'duplicate, replay',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain.sql',
            title:
              'a replayed restore key returns the original revision without duplicate effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'a lost-response replay returns the first envelope after the entry advanced, with no second revision, event, audit row or reservation',
          },
        ],
      },
      {
        text: 'pagination',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/write-query-admission.test.ts',
            title:
              'CMS-03B-04 restore command query admission refuses an undeclared query before any admission or port side effect',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-editorial-registry-openapi.test.ts',
            title:
              'Slice 10 CMS-03B-01/02/03/04 canonical inventory authority keeps the query surface only on the safe history read',
          },
        ],
      },
      {
        text: 'cache',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-routes.test.ts',
            title:
              'CMS-03B-04 protected revision-restore route delegates a typed restore and returns a new draft revision with strong ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-03 compare and CMS-03B-04 restore through the real stack [P2-S10-AC-022] [P2-S10-AC-027] restoring the first revision creates one new draft with the chain from the compare read, and an exact-key replay adds nothing',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-rate-scope.test.ts',
            title:
              'route registry rate limits (BE03b:152-165) CMS-03B-04 asks the limiter for 30/min per actor and 60/min per acting party, never mixed',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-routes.test.ts',
            title:
              'CMS-03B-04 protected revision-restore route enforces rate decisions and scrubs private dependency errors',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-04' failure mapping through the production app and adapter CMS-03B-04 refuses a denied rate decision with 429 RATE_LIMITED, Retry-After and no RPC call",
          },
        ],
      },
      {
        text: 'deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-routes.test.ts',
            title:
              'CMS-03B-04 protected revision-restore route uses one deadline across both rate buckets and never starts a late restore',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-routes.test.ts',
            title:
              'CMS-03B-04 protected revision-restore route ends the entire request at the declared deadline when session resolution stalls',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-04' failure mapping through the production app and adapter CMS-03B-04 maps a dependency that outlives the route deadline to a retryable 504 GATEWAY_TIMEOUT and aborts the call",
          },
        ],
      },
      {
        text: 'concurrency rules.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-concurrency.apispec.ts',
            title:
              'simultaneous writers through the real stack two restores of one revision at one entry version commit exactly one new draft and the other is the definite 409 VERSION_MISMATCH',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/011-authority-revocation.mjs',
            title:
              'S2 restore/grant: once the revocation committed the writer was refused with FORBIDDEN (FORBIDDEN)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs',
            title:
              'S1 restore/human: the parked writer committed exactly one revision (no error)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs',
            title:
              'S4 restore: the writer the deadlock detector aborted answers the typed retryable CONFLICT, not a raw 40P01 (CONFLICT)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs',
            title:
              'S4 restore: the same command retried with the same idempotency key commits exactly one revision (no error)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/012-relation-target-race.mjs',
            title:
              'S2 carried restore/bump: once the target change committed the writer was refused with migration_chain_incomplete (migration_chain_incomplete)',
          },
        ],
      },
      {
        text: 'The idempotency business hash and CAS bind the selected migration-chain identity.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'the idempotency business hash binds the selected migration chain across a real chain',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'the idempotency business hash binds the migration chain: the same key with another chain is IDEMPOTENCY_MISMATCH',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'a new key with the pre-restore entry version fails the entry-version CAS across a real chain (typed VERSION_MISMATCH, P0001; cascade P2-S10-AC-025, was 40001)',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 request validation through the real stack a chain id that is not the chain the command re-derives is the typed 409 migration_chain_mismatch and nothing is written',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-026',
    text: 'CMS-03B-04: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
    clauses: [
      {
        text: 'CMS-03B-04: map every declared domain',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'VERSION_MISMATCH' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'IDEMPOTENCY_MISMATCH' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'INVALID_TRANSITION' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'CONFLICT' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'UNAUTHENTICATED' to 401 'UNAUTHENTICATED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'FORBIDDEN' to 403 'FORBIDDEN'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'NOT_FOUND' to 404 'NOT_FOUND'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'VALIDATION_FAILED' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'INVALID_REQUEST' to 400 'INVALID_REQUEST'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'RATE_LIMITED' to 429 'RATE_LIMITED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'migration_chain_incomplete' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'migration_chain_mismatch' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'migration_chain_unavailable' to 409 'CONFLICT'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'template_incompatible' to 409 'CONFLICT'",
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs',
            title:
              'S4 restore: the writer the deadlock detector aborted answers the typed retryable CONFLICT, not a raw 40P01 (CONFLICT)',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 request validation through the real stack a chain id that is not the chain the command re-derives is the typed 409 migration_chain_mismatch and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'media_source_unavailable' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'object_kind_unspecified' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'object_property_invalid' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'relation_target_unavailable' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'rich_text_not_canonical' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 maps the database token 'taxonomy_source_unavailable' to 422 'VALIDATION_FAILED'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 publishes the field pointer of the typed value reason 'media_source_unavailable' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 publishes the field pointer of the typed value reason 'object_kind_unspecified' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 publishes the field pointer of the typed value reason 'object_property_invalid' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 publishes the field pointer of the typed value reason 'relation_target_unavailable' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 publishes the field pointer of the typed value reason 'rich_text_not_canonical' as one violation carrying that reason",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-catalog.test.ts',
            title:
              "'CMS-03B-04' declared token catalog CMS-03B-04 publishes the field pointer of the typed value reason 'taxonomy_source_unavailable' as one violation carrying that reason",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'a source value the registered transform cannot prove against the tightened target (45 > 40) refuses the restore',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_lineage.sql',
            title:
              'a recorded taxonomy version that no longer resolves refuses the restore as migration_chain_incomplete',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-04' failure mapping through the production app and adapter CMS-03B-04 maps a transport failure to a retryable 503 DEPENDENCY_UNAVAILABLE without echoing the dependency text",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-04' failure mapping through the production app and adapter CMS-03B-04 scrubs an unexpected RPC 5xx into a retryable 503 and never echoes its body",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-04' failure mapping through the production app and adapter CMS-03B-04 maps a success payload that fails the declared resource contract to a non-retryable 502 BAD_GATEWAY",
          },
        ],
      },
      {
        text: 'timeout',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-04' failure mapping through the production app and adapter CMS-03B-04 maps a dependency that outlives the route deadline to a retryable 504 GATEWAY_TIMEOUT and aborts the call",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-routes.test.ts',
            title:
              'CMS-03B-04 protected revision-restore route ends the entire request at the declared deadline when session resolution stalls',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-04' failure mapping through the production app and adapter CMS-03B-04 refuses a denied rate decision with 429 RATE_LIMITED, Retry-After and no RPC call",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-04' failure mapping through the production app and adapter CMS-03B-04 fails closed with 503 and no RPC call when the rate limiter itself is unavailable",
          },
        ],
      },
      {
        text: 'internal failure to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts',
            title:
              "'CMS-03B-04' failure mapping through the production app and adapter CMS-03B-04 maps the database INTERNAL_ERROR token to a scrubbed 500 INTERNAL_ERROR",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'conflict and state tokens [P2-S10-AC-008] maps INTERNAL_ERROR to a scrubbed 500, never a user-blamed 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'conflict and state tokens refuses an unregistered P0001 message as a scrubbed 500 rather than blaming the caller',
          },
        ],
      },
      {
        text: 'preserve safe recovery.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-restore-submit.test.ts',
            title:
              'submitCmsEditorialRestoreForm shows fixed copy for the typed 409 migration_chain_incomplete, never the server message',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-restore-submit.test.ts',
            title:
              'submitCmsEditorialRestoreForm shows fixed copy for the typed 409 template_incompatible, never the server message',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-restore-submit.test.ts',
            title:
              'submitCmsEditorialRestoreForm retains a key when the command response is lost',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'conflict and state tokens [P2-S10-AC-025] [P2-S10-AC-026] maps a stale restore CAS (SQLSTATE 40001 VERSION_MISMATCH) to 409, not a retryable 503',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-027',
    text: 'CMS-03B-04: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry. Audit/outbox evidence records only chain identity/hash and safe counts, never migrated values.',
    clauses: [
      {
        text: 'CMS-03B-04: commit audit and outbox effects atomically where applicable',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 concurrency, idempotency and reconciliation through the real stack a lost response is an unknown outcome and the same-key replay returns the committed restore without a second effect',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-03 compare and CMS-03B-04 restore through the real stack [P2-S10-AC-022] [P2-S10-AC-027] restoring the first revision creates one new draft with the chain from the compare read, and an exact-key replay adds nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'one manifest, one revision-created outbox event carrying only identifiers and one audit record are written atomically',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_policy_evidence.sql',
            title:
              'a refused restore committed no entry, revision, value, relation, manifest, reservation, outbox or audit row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'restore: a failure on the audit insert rolls back the revision, the chain manifest, the reservation and both outbox events',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'restore: a failure on the outbox insert rolls back the revision, the chain manifest, the reservation and the audit row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'restore: a failure completing the idempotency reservation rolls back the revision, chain manifest, audit row and both outbox events',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'every injected failure surfaced from the real command: none of the 12 (operation x fault) calls swallowed it',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_atomicity.sql',
            title:
              'control: a restore with no fault commits one revision, two audit rows (entry and chain evidence), two outbox events and one chain manifest',
          },
        ],
      },
      {
        text: 'reconcile lost responses without duplicate effects',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-restore.apispec.ts',
            title:
              'CMS-03B-04 concurrency, idempotency and reconciliation through the real stack a lost response is an unknown outcome and the same-key replay returns the committed restore without a second effect',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_evidence.sql',
            title:
              'the replay emits no second evidence pair, audit row or revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'a lost-response replay returns the first envelope after the entry advanced, with no second revision, event, audit row or reservation',
          },
        ],
      },
      {
        text: 'emit redacted telemetry.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-telemetry.test.ts',
            title:
              "'CMS-03B-04' redacted telemetry through the production app and adapter CMS-03B-04 emits one success event naming only the operation, never an identifier, value or credential",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ea-telemetry.test.ts',
            title:
              "'CMS-03B-04' redacted telemetry through the production app and adapter CMS-03B-04 emits a failure event with the status and retryability but still no identifier, value or credential",
          },
        ],
      },
      {
        text: 'Audit/outbox evidence records only chain identity/hash and safe counts, never migrated values.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_evidence.sql',
            title:
              'the evidence payload is exactly entry/revision/source ids, the chain id, the chain hash and the edge, value and relation counts',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_evidence.sql',
            title:
              'no audit row of the entry or its chain carries a migrated value',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_evidence.sql',
            title: 'no outbox payload of the entry carries a migrated value',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_evidence.sql',
            title:
              'the restore commits exactly one chain-evidence outbox event [P2-S10-AC-027]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain.sql',
            title:
              'restore audit/outbox evidence records only chain identity and safe counts',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'restore-chain evidence records only chain identity and safe counts, never migrated values',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-028',
    text: 'Enforce CMS-03B-01: entryId; UUID path; must resolve to active ContentEntry after structural validation; 400 or policy-safe 404.',
    clauses: [
      {
        text: 'Enforce CMS-03B-01: entryId; UUID path',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial request shapes binds exactly one UUID path parameter',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes.test.ts',
            title:
              'cms-editorial CMS-03B-01 route rejects a non-UUID path id as 400',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a malformed entry id in the path is a structural 400 naming /entryId and nothing is written',
          },
        ],
      },
      {
        text: 'must resolve to active ContentEntry after structural validation',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 concurrency and idempotency through the real stack an append to an entry that is not active is the policy-safe 404 NOT_FOUND and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_write_contract.sql',
            title:
              'an append to a non-active entry is the policy-safe 404 NOT_FOUND (BE03b: must resolve to active ContentEntry)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_write_contract.sql',
            title:
              'the non-active-entry command wrote no entry, revision, value, relation, conflict, reservation, outbox or audit row',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '401, 403 and 404 are the database decision, not a stub [P2-S10-AC-068] [P2-S10-AC-089] an entry the caller cannot see is the same empty 404 as an absent one',
          },
        ],
      },
      {
        text: '400 or policy-safe 404.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a malformed entry id in the path is a structural 400 naming /entryId and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '401, 403 and 404 are the database decision, not a stub [P2-S10-AC-068] [P2-S10-AC-089] an entry the caller cannot see is the same empty 404 as an absent one',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '403 and concealment decided by the database for other principals [P2-S10-AC-068] [P2-S10-AC-089] a person outside the owning organization cannot tell the entry exists',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-029',
    text: 'Enforce CMS-03B-01: baseRevision; positive bigint decimal string; revision must be readable; 422 or 409 VERSION_MISMATCH.',
    clauses: [
      {
        text: 'Enforce CMS-03B-01: baseRevision',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a zero baseRevision is a 422 with its stable pointer and code and nothing is written',
          },
        ],
      },
      {
        text: 'positive bigint decimal string',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial request shapes rejects zero, leading-zero, and overflow version assertions',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a zero baseRevision is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'append: a malformed baseRevision is pointed at /baseRevision',
          },
        ],
      },
      {
        text: 'revision must be readable',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 concurrency and idempotency through the real stack a well-formed baseRevision that names no readable revision is a 422 at /baseRevision and nothing is written',
          },
        ],
      },
      {
        text: '422 or 409 VERSION_MISMATCH.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a zero baseRevision is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-015] a same-field save from a stale base is a 409 that records one open conflict and appends no revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 returns a committed private conflict disposition for same-field divergence',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 concurrency and idempotency through the real stack a well-formed baseRevision that names no readable revision is a 422 at /baseRevision and nothing is written',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-030',
    text: 'Enforce CMS-03B-01: changedPaths; 1–128 unique JSON Pointers, each 1–256 chars, bound to stable field/block/relation IDs; 422. Relation changes are keyed by stable field ID rather than version-specific relation-definition ID.',
    clauses: [
      {
        text: 'Enforce CMS-03B-01: changedPaths',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/field-pointer.test.ts',
            title:
              '[P2-S10-AC-030] command pointers are /fields/{stableFieldId} accepts the field pointer on every command',
          },
        ],
      },
      {
        text: '1–128 unique JSON Pointers',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial primitives requires 1-128 unique /fields/{stableFieldId} pointers',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack an empty changedPaths list is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a repeated changed path is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a 129-pointer changedPaths list is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: duplicate changed paths are pointed at /changedPaths',
          },
        ],
      },
      {
        text: 'each 1–256 chars',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial primitives accepts exactly the 256-character JSON Pointer grammar',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial primitives bounds JSON Pointers by UTF-16 code units, matching the unflagged spec regex',
          },
        ],
      },
      {
        text: 'bound to stable field/block/relation IDs',
        citations: [],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a /blocks changed path is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack an empty changedPaths list is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'append: a changed path naming no active field is pointed at its index',
          },
        ],
      },
      {
        text: 'Relation changes are keyed by stable field ID rather than version-specific relation-definition ID.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage_domains.sql',
            title:
              'CMS-07 relation change is keyed by the stable field id and the locked keyed targetToken, stable across both sides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_relation_authoring.sql',
            title:
              'an unchanged relation is carried onto the new revision in order',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'append: an unreadable relation target is pointed at its field',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/field-pointer.test.ts',
            title:
              '[P2-S10-AC-030] command pointers are /fields/{stableFieldId} accepts the field pointer on every command',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Pending DEC-147 forward-scope ruling. The clause "bound to stable field/block/relation IDs" is left uncited because the block part is not writable in Slice 10: a changed path is accepted only as /fields/{stableFieldId} (every field kind, a relation included) and /blocks/... is refused as a 422 until a composition write path exists (BE03b Pointers; 03c owns composition writes). The field and relation bindings and the /blocks refusal are proven by the cited tests.',
  },
  {
    criterion: 'P2-S10-AC-031',
    text: 'Enforce CMS-03B-01: values; strict object keyed by stable field IDs; max 128 keys/8 levels/256 KiB; rich text is structured AST; 422. The `object` kind is valid only with the DEC-133 typed depth-1 `properties[]` structure; `rich_text` is valid only as canonical `rich_text.v1`.',
    clauses: [
      {
        text: 'Enforce CMS-03B-01: values',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a values key that is not a stable field UUID is a 422 with its stable pointer and code and nothing is written',
          },
        ],
      },
      {
        text: 'strict object keyed by stable field IDs',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial primitives bounds entry values by UUID keys, key count, and JSON depth',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a values key that is not a stable field UUID is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a value keyed by a UUID that is no field of the version is pointed at that field pointer',
          },
        ],
      },
      {
        text: 'max 128 keys/8 levels/256 KiB',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a 129-key values object is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a values object nested nine levels deep is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a request body over the 256 KiB ceiling is a 400 INVALID_REQUEST and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial primitives bounds serialized entry values to 256 KiB of UTF-8, not UTF-16 units',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial primitives bounds every nested object and array to 128 members',
          },
        ],
      },
      {
        text: 'rich text is structured AST',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack a raw string is a typed 422 rich_text_not_canonical at the field pointer and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_admission.sql',
            title: 'raw rich-text strings are not an approved structured AST',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title:
              '[P2-S10-AC-082] a minimal one-paragraph document is canonical',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a 129-key values object is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a values key that is not a stable field UUID is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes.test.ts',
            title:
              'cms-editorial CMS-03B-01 route rejects an invalid body with bounded stable violations as 422',
          },
        ],
      },
      {
        text: 'The `object` kind is valid only with the DEC-133 typed depth-1 `properties[]` structure',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'an object field with no typed structure refuses every value with object_kind_unspecified [BE03b:1053]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: object_unknown_key is object_property_invalid [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: object_nested_scalar is object_property_invalid [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure_rpc.sql',
            title: 'the draft gate refuses an undeclared key [P2-S10-AC-080]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure_rpc.sql',
            title:
              'the draft gate admits an object matching the stored structure [P2-S10-AC-080]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'typed 422 reason tokens (BE03b:1049-1054, :1211) [P2-S10-AC-005] [P2-S10-AC-008] maps object_property_invalid on a write to 422 VALIDATION_FAILED with reasonCode',
          },
        ],
      },
      {
        text: '`rich_text` is valid only as canonical `rich_text.v1`.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack a document with an unknown top-level key is a typed 422 rich_text_not_canonical at the field pointer and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-rich-text.apispec.ts',
            title:
              'CMS-03B-01 rich_text through the real stack a canonical rich_text.v1 document is stored: 201 with the next entry version as the strong ETag',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: richtext_other_format is rich_text_not_canonical [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'a canonical rich_text.v1 value and a structure-valid object value are stored',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_protected_validator_freeze.sql',
            title:
              'a type that declares the rich_text.v1 pair is refused when the request names no validator ref',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-032',
    text: 'Enforce CMS-03B-01: locale / expectedVersion; BCP 47 2–35 chars; positive decimal entry version; 422 or 409.',
    clauses: [
      {
        text: 'Enforce CMS-03B-01: locale / expectedVersion',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a one-character locale is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a zero expectedVersion is a 422 with its stable pointer and code and nothing is written',
          },
        ],
      },
      {
        text: 'BCP 47 2–35 chars',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial primitives bounds an editorial locale at 35 characters: 35 is accepted and 36 refused',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial primitives accepts BCP 47 subtags and rejects malformed locales',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a one-character locale is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a 36-character locale is a 422 with its stable pointer and code and nothing is written',
          },
        ],
      },
      {
        text: 'positive decimal entry version',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial request shapes rejects zero, leading-zero, and overflow version assertions',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a zero expectedVersion is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'append: a malformed expectedVersion is pointed at /expectedVersion',
          },
        ],
      },
      {
        text: '422 or 409.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 request validation through the real stack a zero expectedVersion is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-revision.apispec.ts',
            title:
              'CMS-03B-01 concurrency and idempotency through the real stack a stale expectedVersion is a definite 409 VERSION_MISMATCH with reload recovery and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ea_write_contract.sql',
            title:
              'an expectedVersion older than the entry version is the typed VERSION_MISMATCH',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-033',
    text: 'Enforce CMS-03B-02: conflictId; UUID; same entry and unresolved conflict; 400/404/409.',
    clauses: [
      {
        text: 'Enforce CMS-03B-02: conflictId; UUID',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-resolution.test.ts',
            title:
              'CMS-03B-02 conflict resolution request rejects malformed ids and non-positive versions',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a malformed conflict id in the path is a structural 400 naming /conflictId and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a body conflictId that differs from the path conflict is a 422 with its stable pointer and code and nothing is written',
          },
        ],
      },
      {
        text: 'same entry and unresolved conflict',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 401, 403 and 404 through the real stack a conflict that belongs to another entry is the same empty 404 and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title: 'CMS-03B-02 conceals an absent or foreign conflict identity',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict-commit.apispec.ts',
            title:
              'CMS-03B-02 concurrency, idempotency and reconciliation through the real stack resolving the now-closed conflict again is the typed 409 INVALID_TRANSITION and nothing is written',
          },
        ],
      },
      {
        text: '400/404/409.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a malformed conflict id in the path is a structural 400 naming /conflictId and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 401, 403 and 404 through the real stack an absent conflict id is an empty 404 and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_lifecycle.sql',
            title:
              'resolving a superseded conflict is the typed INVALID_TRANSITION (409 "invalid transition") [P2-S10-AC-013, AC-033]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-034',
    text: 'Enforce CMS-03B-02: choices; 1–128 strict { path, choice: base, theirs, yours, or explicit, value? }; explicit value must validate current schema; 422.',
    clauses: [
      {
        text: 'Enforce CMS-03B-02: choices',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack an empty choices list is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack two choices for one path is a 422 with its stable pointer and code and nothing is written',
          },
        ],
      },
      {
        text: '1–128 strict { path, choice: base, theirs, yours, or explicit, value? }',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-resolution.test.ts',
            title:
              'CMS-03B-02 conflict resolution request requires 1-128 choices and rejects a path decided twice',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-resolution.test.ts',
            title:
              'CMS-03B-02 conflict choice accepts a named choice without a value and an explicit choice with one',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-resolution.test.ts',
            title:
              'CMS-03B-02 conflict choice rejects a named choice that smuggles a value',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-resolution.test.ts',
            title:
              'CMS-03B-02 conflict choice rejects an explicit choice without a value and any unknown key',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a 129-entry choices list is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a choice kind outside base, theirs, yours and explicit is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a /blocks choice path is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack a choice path with an uppercase field id is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-conflict.apispec.ts',
            title:
              'CMS-03B-02 request-value matrix through the real stack an explicit boolean for a short_text field is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
          },
        ],
      },
      {
        text: 'explicit value must validate current schema',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack an explicit value the field kind refuses is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 validates explicit replacement against the active field kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_resolve_conflict: a raw string for a rich_text choice is rich_text_not_canonical [BE03b:1154]',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack a named choice that smuggles a value is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack an explicit choice without a value is a 422 with its stable pointer and code and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-conflict.apispec.ts',
            title:
              'CMS-03B-02 request validation through the real stack an explicit value the field kind refuses is a 422 with its stable pointer and code and nothing is written',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-035',
    text: 'Enforce CMS-03B-03: cursor/limit; signed context-bound cursor ≤512 chars; limit integer 1–50 default 25; cursor expires ≤24h; 400.',
    clauses: [
      {
        text: 'Enforce CMS-03B-03: cursor/limit',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-history.test.ts',
            title:
              'CMS-03B-03 revision history query bounds the signed cursor at 512 characters and allows null',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-history.test.ts',
            title:
              'CMS-03B-03 revision history query defaults the window to 25 and rejects out-of-range limits',
          },
        ],
      },
      {
        text: 'signed context-bound cursor ≤512 chars',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 window, keyset cursor and cache contract through the real stack the default window is 25 revisions, newest first, with a strong version ETag, no-store and a signed cursor within 512 characters',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a 513-character cursor is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a valid cursor replayed with a changed state filter is bound to its original context: the typed 409 restart',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_signed_read/003-history-cursor.sqlinc',
            title:
              'CMS-03B-03 signed cursor stays within the 512-char contract',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title: 'CMS-03B-03 cursor is a bounded six-key signed envelope',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a correctly signed cursor bound to another query hash is the typed 409 CONFLICT restart with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a cursor signed under a key id the Vault does not hold is the typed 409 CONFLICT restart with a refresh recovery',
          },
        ],
      },
      {
        text: 'limit integer 1–50 default 25',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 window, keyset cursor and cache contract through the real stack the default window is 25 revisions, newest first, with a strong version ETag, no-store and a signed cursor within 512 characters',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 window, keyset cursor and cache contract through the real stack a limit of 50 is the maximum window and returns every revision of this entry in one page',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a limit of 0 is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a limit of 51 is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a fractional limit is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route returns the locked 400 violation for malformed history query ?limit=51',
          },
        ],
      },
      {
        text: 'cursor expires ≤24h',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title:
              'CMS-03B-03 refuses a correctly signed cursor beyond the 24-hour maximum',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_cursor_signature.sql',
            title:
              'CMS-03B-13 a correctly signed cursor beyond the 24-hour maximum is the conflict token',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a correctly signed cursor that expired in 1970 is the typed 409 CONFLICT restart with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-validation-history.apispec.ts',
            title:
              'CMS-03B-03 cursor envelope matrix through the real stack a correctly signed cursor that expires more than 24 hours from now is the typed 409 CONFLICT restart with a refresh recovery',
          },
        ],
      },
      {
        text: '400.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack an empty cursor is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a cursor that is not base64 is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ea-history.apispec.ts',
            title:
              'CMS-03B-03 query and cursor validation through the real stack a cursor whose JSON has none of the six signed members is a structural 400 INVALID_REQUEST and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route returns the locked 400 violation for malformed history query ?cursor=',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title:
              'CMS-03B-03 malformed keyId UUID returns the invalid-request token',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
];
