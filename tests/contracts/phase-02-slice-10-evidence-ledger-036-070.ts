import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 10 evidence ledger fragment P2-S10-AC-036..070 (evidence lane B). Rules: see
// tests/contracts/phase-02-slice-10-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-10-evidence-guard.test.ts.
export const S10_EVIDENCE_LEDGER_036_070: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S10-AC-036',
    text: 'Enforce CMS-03B-03: compareRevisionId/locale; UUID optional; BCP 47 optional; both revisions must be readable; 400/404.',
    clauses: [
      {
        text: 'Enforce CMS-03B-03: compareRevisionId/locale;',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route returns a strict page with a strong version ETag and no-store',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-03 compare and CMS-03B-04 restore through the real stack [P2-S10-AC-022] [P2-S10-AC-027] restoring the first revision creates one new draft with the chain from the compare read, and an exact-key replay adds nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title:
              'CMS-03B-03 compares an authorized base to the latest readable revision',
          },
        ],
      },
      {
        text: 'UUID optional;',
        citations: [
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
              'CMS-03B-03 protected revision-history route allows a reviewer but rejects a caller without read capability',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title:
              'CMS-03B-03 emits a bounded one-page response with no comparison',
          },
        ],
      },
      {
        text: 'BCP 47 optional;',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route returns the locked 400 violation for malformed history query ?locale=en_US',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route returns a strict page with a strong version ETag and no-store',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route allows a reviewer but rejects a caller without read capability',
          },
        ],
      },
      {
        text: 'both revisions must be readable;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB compare readability: a compareRevisionId that names no revision is the concealed NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB compare readability: a revision that belongs to another readable entry is not a comparison target (NOT_FOUND)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB compare readability: the other-entry refusal is indistinguishable from the absent-revision refusal',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB compare readability: the absent-compare refusal wrote no audit, outbox or other row',
          },
        ],
      },
      {
        text: '400/404.',
        citations: [
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
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'Codex s10-ts-2 M1: CMS-03B-03 publishes the read-specific error projection conceals a 404 to empty details even when the dependency supplied some',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB compare readability: a compareRevisionId that names no revision is the concealed NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB compare readability: a revision that belongs to another readable entry is not a comparison target (NOT_FOUND)',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-037',
    text: 'Enforce CMS-03B-04: revisionId/migrationChainId; UUIDs; source revision immutable and chain covers source schema to current active schema; 422/409. Restore sets `parentRevisionIds = [currentDraftRevisionId, sourceRevisionId]` and preserves the verified migration-chain identity.',
    clauses: [
      {
        text: 'Enforce CMS-03B-04: revisionId/migrationChainId;',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-routes.test.ts',
            title:
              'CMS-03B-04 protected revision-restore route delegates a typed restore and returns a new draft revision with strong ETag',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'a request whose migrationChainId differs from the derived chain is migration_chain_mismatch',
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
        text: 'UUIDs;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title: 'restore: a malformed revisionId is pointed at /revisionId',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'restore: a malformed migrationChainId is pointed at /migrationChainId',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-routes.test.ts',
            title:
              'CMS-03B-04 protected revision-restore route rejects invalid origin, path IDs, media, headers, CSRF, and body',
          },
        ],
      },
      {
        text: 'source revision immutable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'the source revision is untouched and the completed reservation stores exactly the returned envelope',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain.sql',
            title:
              'the source revision stays an immutable draft snapshot after restore',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'the source revision is still an immutable snapshot on its recorded schema after the restores',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'chain covers source schema to current active schema;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'the immutable manifest and the verification evidence carry the ordered edges and every schema version of the chain',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'the identity of the middle-to-active chain does not cover source to active and is refused as migration_chain_mismatch',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-routes.test.ts',
            title:
              'CMS-03B-04 restore-port internal evidence gate fails closed 503 when the chain does not span source schema to active schema',
          },
        ],
      },
      {
        text: '422/409.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'restore 409 reason tokens (BE03b:1213, :1345) [P2-S10-AC-026] [P2-S10-AC-037] maps migration_chain_mismatch to 409 CONFLICT with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'restore 409 reason tokens (BE03b:1213, :1345) [P2-S10-AC-026] [P2-S10-AC-037] maps migration_chain_unavailable to 409 CONFLICT with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'restore 409 reason tokens (BE03b:1213, :1345) [P2-S10-AC-026] [P2-S10-AC-037] maps migration_chain_incomplete to 409 CONFLICT with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'restore 409 reason tokens (BE03b:1213, :1345) [P2-S10-AC-026] [P2-S10-AC-037] maps template_incompatible to 409 CONFLICT with a refresh recovery',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-03 compare and CMS-03B-04 restore through the real stack [P2-S10-AC-025] a stale entry version is a definite 409 conflict, never a retryable 503',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-routes.test.ts',
            title:
              'CMS-03B-04 protected revision-restore route rejects mismatched path/body identities and validator before mutation',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > a restore against a stale entry version is a definite refusal that changes nothing',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'Restore sets `parentRevisionIds = [currentDraftRevisionId, sourceRevisionId]`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'the new draft is revision 3 under the active schema with parents [currentDraftRevisionId, sourceRevisionId]',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'preserves the verified migration-chain identity.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'the response carries the verified chain identity, the ordered schema versions and the eight restore seams',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_evidence.sql',
            title:
              'the evidence payload is exactly entry/revision/source ids, the chain id, the chain hash and the edge, value and relation counts',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-production.test.ts',
            title:
              'CMS-03B-04 production restore port (RED: seam still returns 503) propagates the migration-chain identity onto the request and the evidence',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id',
            project: 'real-route-chrome',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-038',
    text: 'Enforce CMS-03B-05: frozenHash; exactly 64 lowercase hex; must equal normalized revision hash; 422/409. This is a contract-only dependency-manifest rule; runtime completion requires the served preparation and write path.',
    clauses: [
      {
        text: 'Enforce CMS-03B-05: frozenHash;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-038] CMS-03B-05 frozenHash accepts the canonical submission with an exact 64 lowercase hex frozen hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05: the canonical submission is admitted',
          },
        ],
      },
      {
        text: 'exactly 64 lowercase hex;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-038] CMS-03B-05 frozenHash rejects a frozenHash that is not exactly 64 lowercase hex',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 frozenHash: an uppercase frozen hash is 422 VALIDATION_FAILED at /frozenHash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 frozenHash: a 63-character frozen hash is 422 VALIDATION_FAILED at /frozenHash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 frozenHash: a non-hex frozen hash is 422 VALIDATION_FAILED at /frozenHash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses the uppercase hash value at manifest member schema.hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses the uppercase hash value at manifest member template.hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses the uppercase hash value at manifest member blocks[0].hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses the uppercase hash value at manifest member patterns[0].hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses the uppercase hash value at manifest member terms[0].hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses the uppercase hash value at manifest member localeSources[0].hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses the uppercase hash value at manifest member settings.hash',
          },
        ],
      },
      { text: 'must equal normalized revision hash;', citations: [] },
      {
        text: '422/',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 frozenHash: an uppercase frozen hash is 422 VALIDATION_FAILED at /frozenHash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 frozenHash: a 63-character frozen hash is 422 VALIDATION_FAILED at /frozenHash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 frozenHash: a non-hex frozen hash is 422 VALIDATION_FAILED at /frozenHash',
          },
        ],
      },
      { text: '409.', citations: [] },
      {
        text: 'This is a contract-only dependency-manifest rule;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest bounds accepts the canonical strict manifest with IDs and hashes for every declared group',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope CMS-03B-05: it is neither a registered route operation nor a Worker RPC binding',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes.test.ts',
            title:
              'cms editorial route registry registers exactly the nine locked operations and method/path pairs',
          },
        ],
      },
      {
        text: 'runtime completion requires the served preparation and write path.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope CMS-03B-05: it is neither a registered route operation nor a Worker RPC binding',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope: the registered editorial operations are exactly the nine of Slice 10',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no worker-facing function mints, opens, revokes, schedules or publishes (no preview, schedule or publication RPC exists)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no private command exists for an entry review, an editorial decision, a publication or a preview token',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no function builds a dependency manifest, derives a version set or a frozen hash, or compares them (server derivation is Slice 11)',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'pending DEC-147 forward-scope ruling. Contract-only by the tracker text, but two clauses cannot be proven in Slice 10: "must equal normalized revision hash" (equality with the stored revision payload hash is a runtime comparison; only a documentation array names it) and "409" (revision_not_submittable and dependency_changed are not registered reason codes and no CMS-03B-05 route or RPC exists; the S10 scope tests pin that absence). Proven: the strict 64-lowercase-hex frozenHash, its 422 VALIDATION_FAILED at /frozenHash through the shared Worker body boundary, and the scope statement. Runtime is Slice 11 (CMS-03B-05).',
  },
  {
    criterion: 'P2-S10-AC-039',
    text: 'Enforce CMS-03B-05: dependencyManifest; strict IDs/hashes for schema/template/blocks/patterns/terms/locale/settings/relations/checkers; max 256 entries/32 KiB; 422. This is a contract-only bounded dependency-manifest rule; runtime completion requires authoritative server derivation.',
    clauses: [
      {
        text: 'Enforce CMS-03B-05: dependencyManifest;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest bounds accepts the canonical strict manifest with IDs and hashes for every declared group',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest bounds rejects unknown manifest keys',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05: the canonical submission is admitted',
          },
        ],
      },
      {
        text: 'strict IDs/hashes for schema/template/blocks/patterns/terms/locale/settings/relations/checkers;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest protected validator refs accepts only the registered protected member at its registered version',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest protected validator refs refuses a validator named twice',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest schema binding requires the manifest schema artifact to bind the manifest schema version',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses an unknown key inside schema',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses an unknown key inside a block entry',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses an unknown key inside a pattern entry',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses an unknown key inside a term entry',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses an unknown key inside the template',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses an unknown key inside a locale source',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses an unknown key inside settings',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses an unknown key inside a relation',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses an unknown key inside the checker',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses a bad UUID inside a block entry',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses a bad UUID inside a pattern entry',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses a bad UUID inside a term entry',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses a bad UUID inside the template',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses a bad revision UUID inside a locale source',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses a bad field or target UUID inside a relation',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses an uppercase hash inside a block entry',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses a short hash inside the settings',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses a non-version settings version',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses a non-version relation target version',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses a non-version checker version',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses a malformed locale inside a locale source',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness refuses a block, pattern, term, locale or relation named twice',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses the uppercase hash value at manifest member schema.hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses the uppercase hash value at manifest member template.hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses the uppercase hash value at manifest member blocks[0].hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses the uppercase hash value at manifest member patterns[0].hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses the uppercase hash value at manifest member terms[0].hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses the uppercase hash value at manifest member localeSources[0].hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses the uppercase hash value at manifest member settings.hash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses a schema id that is not a UUID and an empty or 65-character checker key',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group refuses a plural checkers member: the contract carries exactly one checker entry (DEC-145 D-13)',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 dependencyManifest: the nested schema artifact refuses a short artifact hash, an empty compiler version and an oversized contract ref',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 dependencyManifest: the nested validator refs refuse an unregistered key and an unregistered version',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 dependencyManifest: a block with a malformed id is 422 at that block pointer',
          },
        ],
      },
      {
        text: 'max 256 entries/32 KiB;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest total-entry cap names the 256-entry ceiling',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest total-entry cap counts every list element plus each present singleton: 256 is accepted, 257 is refused',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest total-entry cap does not count an absent template',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest total-entry cap counts locale sources toward the cap',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest bounds bounds every array group',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest bounds serializes the canonical manifest within the 32 KiB bound and rejects an over-bound one',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-05 dependencyManifest exact 32 KiB serialized boundary accepts a manifest of exactly 32768 UTF-8 bytes and refuses 32769 with only the byte-bound issue',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 dependencyManifest: more than 256 entries is 422 with the max_entries code',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 dependencyManifest: an unknown manifest key is 422 unknown_field at its pointer',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 dependencyManifest: a block with a malformed id is 422 at that block pointer',
          },
        ],
      },
      {
        text: 'This is a contract-only bounded dependency-manifest rule;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest total-entry cap counts every list element plus each present singleton: 256 is accepted, 257 is refused',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope CMS-03B-05: it is neither a registered route operation nor a Worker RPC binding',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes.test.ts',
            title:
              'cms editorial route registry registers exactly the nine locked operations and method/path pairs',
          },
        ],
      },
      {
        text: 'runtime completion requires authoritative server derivation.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope CMS-03B-05: it is neither a registered route operation nor a Worker RPC binding',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope: the registered editorial operations are exactly the nine of Slice 10',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no worker-facing function mints, opens, revokes, schedules or publishes (no preview, schedule or publication RPC exists)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no private command exists for an entry review, an editorial decision, a publication or a preview token',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no function builds a dependency manifest, derives a version set or a frozen hash, or compares them (server derivation is Slice 11)',
          },
        ],
      },
    ],
    status: 'contract-only',
    limitation:
      'Contract-only by the tracker text: the strict DependencyManifest (unknown keys, UUID/hash/version grammar per group including the nested schema artifact and validator refs, per-group caps, unique identities, 256 total entries, 32 KiB) and its 422 at the shared Worker body boundary are proven, and the scope tests prove that no S10 route, RPC mapping or database function builds the manifest from canonical state; server rebuild, JCS equality (409 dependency_changed) and the CMS-03B-05 route are Slice 11. The contract carries a single checker entry per DEC-145 D-13 (a plural checkers member is refused).',
  },
  {
    criterion: 'P2-S10-AC-040',
    text: 'Enforce CMS-03B-05: riskClass; ordinary or protected; protected requires configured two-person workflow; 422. `riskClass` is server-derived from frozen policy and dependencies; any caller-supplied `riskClass` is an unknown key.',
    clauses: [
      {
        text: 'Enforce CMS-03B-05: riskClass;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-040] CMS-03B-05 riskClass is server-derived rejects caller-supplied riskClass as an unknown key',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 riskClass: a caller-supplied riskClass is 422 unknown_field at /riskClass',
          },
        ],
      },
      {
        text: 'ordinary or protected;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-040] CMS-03B-05 riskClass is server-derived treats ordinary and protected policy evidence as valid within the manifest',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/phase-02-slice-09-be03a-contract-evidence.test.ts',
            title:
              'BE03a CMS-03A-01 request and CMS-03A-04 evidence shapes [P2-S09-AC-090] frozen WorkflowPolicyEvidence contains key, version, policyHash, riskClass, requiredDecisionCount 1 to 8, requiredCapabilities and approvalEvidenceHash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 riskClass: the manifest policy evidence refuses a riskClass other than ordinary or protected',
          },
        ],
      },
      {
        text: 'protected requires configured two-person workflow;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-040] CMS-03B-05 riskClass is server-derived requires the configured two-person workflow for protected policy evidence',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/models.coverage.test.ts',
            title:
              'content schema registry model defensive refinements requires dual named approval for protected policies',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 riskClass: protected manifest policy evidence with a single required decision is refused (two-person workflow)',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 riskClass: protected manifest policy evidence with a single required decision is refused (two-person workflow)',
          },
        ],
      },
      {
        text: '`riskClass` is server-derived from frozen policy and dependencies;',
        citations: [],
      },
      {
        text: 'any caller-supplied `riskClass` is an unknown key.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-040] CMS-03B-05 riskClass is server-derived rejects caller-supplied riskClass as an unknown key',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary EB boundary CMS-03B-05 riskClass: a caller-supplied riskClass is 422 unknown_field at /riskClass',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'pending DEC-147 forward-scope ruling. Unproven: "`riskClass` is server-derived from frozen policy and dependencies" (the strictest-of derivation from the frozen workflow policy and the dependencies needs the CMS-03B-05 route and RPC, which are Slice 11; the scope tests pin that no S10 function derives it). Proven at contract level: riskClass is not a request member (unknown key, 422), the manifest policy evidence accepts exactly ordinary or protected and refuses a protected policy with fewer than two decisions.',
  },
  {
    criterion: 'P2-S10-AC-041',
    text: 'Enforce CMS-03B-06: decision/reason; approve or reject; reason 1–2000 safe Unicode chars; 422. This is a contract-only review-decision rule until the protected decision operation is implemented.',
    clauses: [
      {
        text: 'Enforce CMS-03B-06: decision/reason;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-041] CMS-03B-06 decision/reason accepts approve and reject decisions with a 1-2000 safe Unicode reason',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-041/AC-042: CMS-03B-06 decision is a 422 at the Worker body boundary EB boundary CMS-03B-06: the canonical decision is admitted',
          },
        ],
      },
      {
        text: 'approve or reject;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-041] CMS-03B-06 decision/reason accepts approve and reject decisions with a 1-2000 safe Unicode reason',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-041] CMS-03B-06 decision/reason rejects closed decision verbs and empty or oversized reasons',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-041/AC-042: CMS-03B-06 decision is a 422 at the Worker body boundary EB boundary CMS-03B-06 decision: a decision other than approve or reject is 422 at /decision',
          },
        ],
      },
      {
        text: 'reason 1–2000 safe Unicode chars;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-041] CMS-03B-06 decision/reason rejects closed decision verbs and empty or oversized reasons',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-041] CMS-03B-06 decision/reason rejects unsafe reason markup',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-041] CMS-03B-06 decision/reason counts Unicode characters, not UTF-16 units: exactly 2000 emoji is accepted and 2001 refused',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-041] CMS-03B-06 decision/reason accepts non-ASCII reasons in any script',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-041] CMS-03B-06 decision/reason refuses control characters (C0, DEL, C1, newline, separators)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-041] CMS-03B-06 decision/reason refuses bidirectional formatting characters',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-041] CMS-03B-06 decision/reason refuses a reason that is not NFC and never normalizes it',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-041/AC-042: CMS-03B-06 decision is a 422 at the Worker body boundary EB boundary CMS-03B-06 reason: an empty, an oversized and a markup reason are each 422 at /reason',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-041/AC-042: CMS-03B-06 decision is a 422 at the Worker body boundary EB boundary CMS-03B-06 reason: a control character and a non-NFC reason are 422 at /reason',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-041/AC-042: CMS-03B-06 decision is a 422 at the Worker body boundary EB boundary CMS-03B-06 decision: a decision other than approve or reject is 422 at /decision',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-041/AC-042: CMS-03B-06 decision is a 422 at the Worker body boundary EB boundary CMS-03B-06 reason: an empty, an oversized and a markup reason are each 422 at /reason',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-041/AC-042: CMS-03B-06 decision is a 422 at the Worker body boundary EB boundary CMS-03B-06 reason: a control character and a non-NFC reason are 422 at /reason',
          },
        ],
      },
      {
        text: 'This is a contract-only review-decision rule until the protected decision operation is implemented.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope CMS-03B-06: it is neither a registered route operation nor a Worker RPC binding',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope: the registered editorial operations are exactly the nine of Slice 10',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no worker-facing function mints, opens, revokes, schedules or publishes (no preview, schedule or publication RPC exists)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no private command exists for an entry review, an editorial decision, a publication or a preview token',
          },
        ],
      },
    ],
    status: 'contract-only',
    limitation:
      'Contract-only by the tracker text: the strict EditorialDecisionRequest (approve or reject, a 1-2000 code-point NFC reason free of control, separator, bidirectional and markup-delimiter characters) and its 422 VALIDATION_FAILED at /decision and /reason through the shared Worker body boundary are proven, and the scope tests prove no CMS-03B-06 route, RPC mapping or database function exists. Reviewer assignment, MFA and the protected decision operation are Slice 11 (CMS-03B-06).',
  },
  {
    criterion: 'P2-S10-AC-042',
    text: 'Enforce CMS-03B-06: stepUpAt/capability; ISO timestamp within configured MFA freshness; named reviewer capability, never caller-selected authority; 401/403/422. The caller supplies neither `stepUpAt` nor `capability`; every CMS-03B-06 decision requires server-verified recent binding-bound MFA and eligible assigned-reviewer capability.',
    clauses: [
      {
        text: 'Enforce CMS-03B-06: stepUpAt/capability;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-042] CMS-03B-06 stepUpAt/capability are server-derived rejects caller-supplied stepUpAt and capability as unknown keys',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-041/AC-042: CMS-03B-06 decision is a 422 at the Worker body boundary EB boundary CMS-03B-06 stepUpAt/capability: a caller-supplied stepUpAt, capability or authority is 422 unknown_field',
          },
        ],
      },
      { text: 'ISO timestamp within configured MFA freshness;', citations: [] },
      { text: 'named reviewer capability', citations: [] },
      {
        text: 'never caller-selected authority;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-042] CMS-03B-06 stepUpAt/capability are server-derived rejects caller-supplied stepUpAt and capability as unknown keys',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-042] CMS-03B-06 stepUpAt/capability are server-derived rejects any caller-selected authority metadata',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-041/AC-042: CMS-03B-06 decision is a 422 at the Worker body boundary EB boundary CMS-03B-06 stepUpAt/capability: a caller-supplied stepUpAt, capability or authority is 422 unknown_field',
          },
        ],
      },
      { text: '401/403/422.', citations: [] },
      {
        text: 'The caller supplies neither `stepUpAt` nor `capability`;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-042] CMS-03B-06 stepUpAt/capability are server-derived rejects caller-supplied stepUpAt and capability as unknown keys',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-review.test.ts',
            title:
              'EB publication boundary AC-041/AC-042: CMS-03B-06 decision is a 422 at the Worker body boundary EB boundary CMS-03B-06 stepUpAt/capability: a caller-supplied stepUpAt, capability or authority is 422 unknown_field',
          },
        ],
      },
      {
        text: 'every CMS-03B-06 decision requires server-verified recent binding-bound MFA and eligible assigned-reviewer capability.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'pending DEC-147 forward-scope ruling. runtime enforcement is Slice 11 (CMS-03B-05/06): MFA freshness (600 s window), the named reviewer capability and assignment check, the 401/403/422 mapping and server verification of binding-bound MFA need the CMS-03B-06 route and RPC, which do not exist in Slice 10. Proven at contract level: the strict EditorialDecisionRequest has no stepUpAt, capability or authority member (each is a 422 unknown_field).',
  },
  {
    criterion: 'P2-S10-AC-043',
    text: 'Enforce CMS-03B-07: localDateTime/timezone; local ISO datetime without offset plus IANA timezone 1–64 chars; 422. This is a contract-only schedule rule until authoritative timezone and persistence paths are implemented.',
    clauses: [
      {
        text: 'Enforce CMS-03B-07: localDateTime/timezone;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-043] CMS-03B-07 localDateTime/timezone accepts an offset-free local datetime with a 1-64 character IANA timezone',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary EB boundary CMS-03B-07: the canonical schedule is admitted',
          },
        ],
      },
      {
        text: 'local ISO datetime without offset plus IANA timezone 1–64 chars;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-043] CMS-03B-07 localDateTime/timezone rejects local datetimes carrying an offset or Z suffix',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-043] CMS-03B-07 localDateTime/timezone accepts a real local datetime with or without seconds and a fraction',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-043] CMS-03B-07 localDateTime/timezone refuses an out-of-range or impossible local datetime',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-043] CMS-03B-07 localDateTime/timezone rejects a timezone outside 1-64 characters',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-043] CMS-03B-07 localDateTime/timezone accepts every IANA name shape: single, two and three segments, and fixed-offset Etc zones',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-043] CMS-03B-07 localDateTime/timezone refuses a malformed timezone name',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary EB boundary CMS-03B-07 localDateTime: a local datetime carrying an offset or Z is 422 at /localDateTime',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary EB boundary CMS-03B-07 localDateTime: an impossible calendar day is 422 at /localDateTime',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary EB boundary CMS-03B-07 timezone: an empty, an oversized and a malformed timezone are each 422 at /timezone',
          },
        ],
      },
      {
        text: 'This is a contract-only schedule rule until authoritative timezone and persistence paths are implemented.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-044] CMS-03B-07 resolvedUtc/tzdbVersion/disambiguation names the schedule checks that are Slice 11 runtime, not contract rules',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope CMS-03B-07: it is neither a registered route operation nor a Worker RPC binding',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope: the registered editorial operations are exactly the nine of Slice 10',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no worker-facing function mints, opens, revokes, schedules or publishes (no preview, schedule or publication RPC exists)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no private command exists for an entry review, an editorial decision, a publication or a preview token',
          },
        ],
      },
    ],
    status: 'contract-only',
    limitation:
      'Contract-only by the tracker text: an offset-free local ISO datetime with every component range-checked and a 1-64 character IANA-shaped timezone grammar, and their 422 VALIDATION_FAILED at /localDateTime and /timezone through the shared Worker body boundary, are proven. Membership of the timezone in the pinned tzdb (unknown_timezone) and the schedule persistence path are Slice 11 (CMS-03B-07); the contract tests only name that check as a seam.',
  },
  {
    criterion: 'P2-S10-AC-044',
    text: 'Enforce CMS-03B-07: resolvedUtc/tzdbVersion/disambiguation; offset ISO instant, tzdb 1–32 chars, disambiguation earlier/later/none; nonexistent local time rejected; 422. This is a contract-only publication-action rule until the protected operation exists.',
    clauses: [
      {
        text: 'Enforce CMS-03B-07: resolvedUtc/tzdbVersion/disambiguation;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-044] CMS-03B-07 resolvedUtc/tzdbVersion/disambiguation accepts an offset ISO instant with a bounded tzdb version',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary EB boundary CMS-03B-07: the canonical schedule is admitted',
          },
        ],
      },
      {
        text: 'offset ISO instant',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-044] CMS-03B-07 resolvedUtc/tzdbVersion/disambiguation rejects a resolvedUtc without an explicit offset and an over-long tzdbVersion',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-044] CMS-03B-07 resolvedUtc/tzdbVersion/disambiguation accepts an offset ISO instant with a bounded tzdb version',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-07 resolvedUtc and tzdbVersion bounds accepts an ISO instant with a non-Z numeric offset and refuses an instant without any offset',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary EB boundary CMS-03B-07 resolvedUtc: an instant without an offset is 422 at /resolvedUtc',
          },
        ],
      },
      {
        text: 'tzdb 1–32 chars',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-044] CMS-03B-07 resolvedUtc/tzdbVersion/disambiguation rejects a resolvedUtc without an explicit offset and an over-long tzdbVersion',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-07 resolvedUtc and tzdbVersion bounds bounds tzdbVersion to 1-32 characters: empty refused, 1 and exactly 32 accepted, 33 refused',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary EB boundary CMS-03B-07 tzdbVersion: an empty and a 33-character tzdb version are 422 at /tzdbVersion',
          },
        ],
      },
      {
        text: 'disambiguation earlier/later/none;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-044] CMS-03B-07 resolvedUtc/tzdbVersion/disambiguation locks disambiguation to none, earlier, or later',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary EB boundary CMS-03B-07 disambiguation: a value other than none, earlier or later is 422 at /disambiguation',
          },
        ],
      },
      { text: 'nonexistent local time rejected;', citations: [] },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary EB boundary CMS-03B-07 resolvedUtc: an instant without an offset is 422 at /resolvedUtc',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary EB boundary CMS-03B-07 tzdbVersion: an empty and a 33-character tzdb version are 422 at /tzdbVersion',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary EB boundary CMS-03B-07 disambiguation: a value other than none, earlier or later is 422 at /disambiguation',
          },
        ],
      },
      {
        text: 'This is a contract-only publication-action rule until the protected operation exists.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-044] CMS-03B-07 resolvedUtc/tzdbVersion/disambiguation names the schedule checks that are Slice 11 runtime, not contract rules',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope CMS-03B-07: it is neither a registered route operation nor a Worker RPC binding',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope: the registered editorial operations are exactly the nine of Slice 10',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no worker-facing function mints, opens, revokes, schedules or publishes (no preview, schedule or publication RPC exists)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no private command exists for an entry review, an editorial decision, a publication or a preview token',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'pending DEC-147 forward-scope ruling. The clause "nonexistent local time rejected" is unproven and not enforced in Slice 10: the contract test asserts a spring-forward gap time is admitted (rejection needs the pinned tzdb, Slice 11 CMS-03B-07 time authority). Also runtime of Slice 11: resolvedUtc equality with the local time and zone and tzdb pin equality (no CMS-03B-07 route is registered in Slice 10). Proven: the offset ISO instant, the 1-32 character tzdb version, the none/earlier/later disambiguation and their 422 at /resolvedUtc, /tzdbVersion and /disambiguation through the shared Worker body boundary.',
  },
  {
    criterion: 'P2-S10-AC-045',
    text: 'Enforce CMS-03B-07: action; publish, unpublish, expire, or archive; 422. This is a contract-only preview-token rule until mint/open/revocation paths exist.',
    clauses: [
      {
        text: 'Enforce CMS-03B-07: action;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-045] CMS-03B-07 action accepts exactly publish, unpublish, expire, and archive',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary EB boundary CMS-03B-07 action: publish, unpublish, expire and archive are admitted and any other action is 422 at /action',
          },
        ],
      },
      {
        text: 'publish, unpublish, expire, or archive;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-045] CMS-03B-07 action accepts exactly publish, unpublish, expire, and archive',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary EB boundary CMS-03B-07 action: publish, unpublish, expire and archive are admitted and any other action is 422 at /action',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary EB boundary CMS-03B-07 action: publish, unpublish, expire and archive are admitted and any other action is 422 at /action',
          },
        ],
      },
      {
        text: 'This is a contract-only preview-token rule until mint/open/revocation paths exist.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'The final sentence "This is a contract-only preview-token rule until mint/open/revocation paths exist" is a CMS-03B-08/19 statement (BE03b :159), not a behavior of CMS-03B-07 (publication schedule), so no CMS-03B-07 test can prove it and the clause is uncited (EVIDENCE GAP EB R2 045-a: the tracker sentence is mis-scoped; owner to correct it or to rule it out of AC-045). Proven: the strict PublicationScheduleRequest action is exactly publish, unpublish, expire or archive and any other value is a 422 VALIDATION_FAILED at /action through the shared Worker body boundary. The schedule operation and the preview-token mint, open and revocation paths do not exist in Slice 10 and belong to Slice 11.',
  },
  {
    criterion: 'P2-S10-AC-046',
    text: 'Enforce CMS-03B-08: versionSet; strict exact schema/template/taxonomy/settings/blocks/patterns IDs and hashes; 422; stale set 409. This is a contract-only bounded version-set rule until server derivation and revalidation exist.',
    clauses: [
      {
        text: 'Enforce CMS-03B-08: versionSet;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet accepts the canonical strict version set',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-046/AC-047/AC-048: CMS-03B-08/09 preview and publication are a 422 at the Worker body boundary EB boundary CMS-03B-08: the canonical preview request is admitted',
          },
        ],
      },
      {
        text: 'strict exact schema/template/taxonomy/settings/blocks/patterns IDs and hashes;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet rejects unknown keys and mismatched artifact/compiler couplings',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet bounds taxonomy, block, and pattern arrays',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet identities refuses an unregistered validator key',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet identities refuses a taxonomy version named twice',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet identities refuses a block version named twice',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet identities refuses a pattern version named twice',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet identities refuses a malformed id inside the id arrays',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet identities refuses a non-version settingsVersion',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet identities refuses a non-hash schemaHash',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet identities refuses a non-hash templateHash',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet identities refuses an unknown key inside the workflow policy evidence',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet template coupling requires the template id and hash to be both present or both absent',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-046/AC-047/AC-048: CMS-03B-08/09 preview and publication are a 422 at the Worker body boundary EB boundary CMS-03B-08 versionSet: an unknown member, a duplicate block id and a non-hash schemaHash are 422 at their pointers',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-046/AC-047/AC-048: CMS-03B-08/09 preview and publication are a 422 at the Worker body boundary EB boundary CMS-03B-08 versionSet: a template id without its hash is 422 (the all-or-nothing coupling)',
          },
        ],
      },
      {
        text: '422;',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-046/AC-047/AC-048: CMS-03B-08/09 preview and publication are a 422 at the Worker body boundary EB boundary CMS-03B-08 versionSet: an unknown member, a duplicate block id and a non-hash schemaHash are 422 at their pointers',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-046/AC-047/AC-048: CMS-03B-08/09 preview and publication are a 422 at the Worker body boundary EB boundary CMS-03B-08 versionSet: a template id without its hash is 422 (the all-or-nothing coupling)',
          },
        ],
      },
      { text: 'stale set 409.', citations: [] },
      {
        text: 'This is a contract-only bounded version-set rule until server derivation and revalidation exist.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet bounds taxonomy, block, and pattern arrays',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope CMS-03B-08: it is neither a registered route operation nor a Worker RPC binding',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope: the registered editorial operations are exactly the nine of Slice 10',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no worker-facing function mints, opens, revokes, schedules or publishes (no preview, schedule or publication RPC exists)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no private command exists for an entry review, an editorial decision, a publication or a preview token',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no function builds a dependency manifest, derives a version set or a frozen hash, or compares them (server derivation is Slice 11)',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'pending DEC-147 forward-scope ruling. The clause "stale set 409" is unproven: stale-set detection (version_set_stale, recomputation of the version set) is pure runtime of Slice 11 (CMS-03B-08/09); no S10 seam, reason code, test or code exists, and the scope tests pin that no function derives or compares a version set. Proven: the strict, bounded VersionSet and its 422 at the version-set pointers through the shared Worker body boundary.',
  },
  {
    criterion: 'P2-S10-AC-047',
    text: 'Enforce CMS-03B-08: audience/route; audience 1–64 safe chars; route 1–2048 normalized path; no external URL; 422. This is a contract-only preview-binding rule until the protected preview path exists.',
    clauses: [
      {
        text: 'Enforce CMS-03B-08: audience/route;',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-046/AC-047/AC-048: CMS-03B-08/09 preview and publication are a 422 at the Worker body boundary EB boundary CMS-03B-08 audience/route: an unsafe audience and an external, protocol-relative or control-character route are 422',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-047] CMS-03B-08 audience/route rejects an oversized route and an external URL route',
          },
        ],
      },
      { text: 'audience 1–64 safe chars;', citations: [] },
      {
        text: 'route 1–2048 normalized path;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-047] CMS-03B-08 audience/route rejects an oversized route and an external URL route',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-047] CMS-03B-08 audience/route counts the 2048-character route bound in Unicode characters',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-047] CMS-03B-08 audience/route accepts normalized site paths',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-047] CMS-03B-08 audience/route refuses a route that is not a normalized path',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-047] CMS-03B-08 audience/route rejects a route carrying a control character',
          },
        ],
      },
      {
        text: 'no external URL;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-047] CMS-03B-08 audience/route rejects an oversized route and an external URL route',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-047] CMS-03B-08 audience/route refuses a protocol-relative route: //host is an external URL',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-047] CMS-03B-08 audience/route rejects a backslash route that browser normalization would treat as cross-origin',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-047] CMS-03B-08 audience/route refuses a route that is not a normalized path',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-046/AC-047/AC-048: CMS-03B-08/09 preview and publication are a 422 at the Worker body boundary EB boundary CMS-03B-08 audience/route: an unsafe audience and an external, protocol-relative or control-character route are 422',
          },
        ],
      },
      {
        text: '422.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-046/AC-047/AC-048: CMS-03B-08/09 preview and publication are a 422 at the Worker body boundary EB boundary CMS-03B-08 audience/route: an unsafe audience and an external, protocol-relative or control-character route are 422',
          },
        ],
      },
      {
        text: 'This is a contract-only preview-binding rule until the protected preview path exists.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope CMS-03B-08: it is neither a registered route operation nor a Worker RPC binding',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope: the registered editorial operations are exactly the nine of Slice 10',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no worker-facing function mints, opens, revokes, schedules or publishes (no preview, schedule or publication RPC exists)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no private command exists for an entry review, an editorial decision, a publication or a preview token',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'pending DEC-147 forward-scope ruling. The clause "audience 1-64 safe chars" is unproven: the contract enforces ^[a-z0-9_-]{1,48}$ (DEC-145 D-13, BE04c) and refuses safe 49-64 character audiences, so no test proves the tracker bound of 64 and the tracker text is not reworded. Proven: route 1-2048 Unicode characters as a normalized site path with no external URL, backslash, control character, query, fragment, dot segment or percent-encoded separator, and their 422 at /route and /audience through the shared Worker body boundary. The preview operation is Slice 11 (CMS-03B-08).',
  },
  {
    criterion: 'P2-S10-AC-048',
    text: 'Enforce CMS-03B-09: frozenHash/expectedVersionSet; 64 lowercase hex and strict version/hash set equal to approved candidate; 422/409. This is a contract-only unpublish/expire/archive rule until the protected operation exists.',
    clauses: [
      {
        text: 'Enforce CMS-03B-09: frozenHash/expectedVersionSet;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-048] CMS-03B-09 frozenHash/expectedVersionSet accepts the canonical publication request with hash plus exact version set',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-046/AC-047/AC-048: CMS-03B-08/09 preview and publication are a 422 at the Worker body boundary EB boundary CMS-03B-09: the canonical publication request is admitted',
          },
        ],
      },
      {
        text: '64 lowercase hex',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-048] CMS-03B-09 frozenHash/expectedVersionSet rejects a non-canonical frozenHash and an invalid version set',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-09 publication request frozenHash and expectedVersionSet strictness refuses a frozenHash that is uppercase, non-hex, 63 or 65 characters long on the publication request member itself',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-046/AC-047/AC-048: CMS-03B-08/09 preview and publication are a 422 at the Worker body boundary EB boundary CMS-03B-09 frozenHash/expectedVersionSet: a non-canonical hash and an invalid version set are 422 at their pointers',
          },
        ],
      },
      {
        text: 'strict version/hash set',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-048] CMS-03B-09 frozenHash/expectedVersionSet rejects a non-canonical frozenHash and an invalid version set',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-contracts.test.ts',
            title:
              'EB evidence CMS-03B-09 publication request frozenHash and expectedVersionSet strictness refuses an expectedVersionSet carrying an extra key, a duplicate block id or a non-hash schemaHash',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-046/AC-047/AC-048: CMS-03B-08/09 preview and publication are a 422 at the Worker body boundary EB boundary CMS-03B-09 frozenHash/expectedVersionSet: a non-canonical hash and an invalid version set are 422 at their pointers',
          },
        ],
      },
      { text: 'equal to approved candidate;', citations: [] },
      {
        text: '422/',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication boundary AC-046/AC-047/AC-048: CMS-03B-08/09 preview and publication are a 422 at the Worker body boundary EB boundary CMS-03B-09 frozenHash/expectedVersionSet: a non-canonical hash and an invalid version set are 422 at their pointers',
          },
        ],
      },
      { text: '409.', citations: [] },
      {
        text: 'This is a contract-only unpublish/expire/archive rule until the protected operation exists.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope CMS-03B-09: it is neither a registered route operation nor a Worker RPC binding',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts',
            title:
              'EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths EB publication scope: the registered editorial operations are exactly the nine of Slice 10',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no worker-facing function mints, opens, revokes, schedules or publishes (no preview, schedule or publication RPC exists)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no private command exists for an entry review, an editorial decision, a publication or a preview token',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql',
            title:
              'EB scope: no function builds a dependency manifest, derives a version set or a frozen hash, or compares them (server derivation is Slice 11)',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'pending DEC-147 forward-scope ruling. Contract-only by the tracker text, but two clauses cannot be proven in Slice 10: "equal to approved candidate" (equality with the approved review and the recomputed current version set is a runtime comparison) and "409" (version_set_stale is not a registered reason code and no CMS-03B-09 route or RPC exists; the scope tests pin that absence). Proven: the strict 64-lowercase-hex frozenHash and strict expectedVersionSet, and their 422 at /frozenHash and /expectedVersionSet through the shared Worker body boundary. Runtime is Slice 11 (CMS-03B-09).',
  },
  {
    criterion: 'P2-S10-AC-049',
    text: 'Enforce mutation headers: Idempotency-Key 8–128 printable ASCII and Content-Type application/json; existing-resource mutations require exact strong If-Match, while initial entry creation uses the explicit create precondition and no fabricated existing version; malformed headers return 400 INVALID_REQUEST.',
    clauses: [
      {
        text: 'Enforce mutation headers: Idempotency-Key 8',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/be00-middleware-order.test.ts',
            title:
              'BE00 middleware order on the CMS editorial human routes CMS-03B-01 revision cms-editorial: step 11 (idempotency key) wins over every later step',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/be00-middleware-order.test.ts',
            title:
              'BE00 middleware order on the CMS editorial human routes CMS-03B-02 conflict resolution cms-editorial: step 11 (idempotency key) wins over every later step',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/be00-middleware-order.test.ts',
            title:
              'BE00 middleware order on the CMS editorial human routes CMS-03B-04 restore cms-editorial: step 11 (idempotency key) wins over every later step',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/be00-middleware-order.test.ts',
            title:
              'BE00 middleware order on the CMS editorial human routes CMS-03B-10 entry create cms-editorial: step 10 (idempotency key) wins over every later step',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial request shapes requires JSON, an idempotency key, and an exact strong If-Match',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'an Idempotency-Key outside the 8..128 printable range is refused',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-01 revision: a 7 characters key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-01 revision: a missing key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-01 revision: a key of exactly 8 characters reaches the port',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-02 conflict resolution: a 7 characters key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-02 conflict resolution: a missing key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-02 conflict resolution: a key of exactly 8 characters reaches the port',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-04 restore: a 7 characters key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-04 restore: a missing key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-04 restore: a key of exactly 8 characters reaches the port',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-10 entry create: a 7 characters key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-10 entry create: a missing key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-10 entry create: a key of exactly 8 characters reaches the port',
          },
        ],
      },
      {
        text: '128 printable ASCII',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-01 revision: a 129 characters key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-01 revision: a a control character key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-01 revision: a a DEL character key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-01 revision: a a non-ASCII character key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-01 revision: a key of exactly 128 characters reaches the port',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-02 conflict resolution: a 129 characters key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-02 conflict resolution: a a control character key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-02 conflict resolution: a a DEL character key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-02 conflict resolution: a a non-ASCII character key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-02 conflict resolution: a key of exactly 128 characters reaches the port',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-04 restore: a 129 characters key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-04 restore: a a control character key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-04 restore: a a DEL character key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-04 restore: a a non-ASCII character key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-04 restore: a key of exactly 128 characters reaches the port',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-10 entry create: a 129 characters key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-10 entry create: a a control character key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-10 entry create: a a DEL character key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-10 entry create: a a non-ASCII character key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-10 entry create: a key of exactly 128 characters reaches the port',
          },
        ],
      },
      {
        text: 'Content-Type application/json;',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/be00-middleware-order.test.ts',
            title:
              'BE00 middleware order on the CMS editorial human routes CMS-03B-01 revision cms-editorial: step 3 (content type) wins over every later step',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/be00-middleware-order.test.ts',
            title:
              'BE00 middleware order on the CMS editorial human routes CMS-03B-02 conflict resolution cms-editorial: step 3 (content type) wins over every later step',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/be00-middleware-order.test.ts',
            title:
              'BE00 middleware order on the CMS editorial human routes CMS-03B-04 restore cms-editorial: step 3 (content type) wins over every later step',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/be00-middleware-order.test.ts',
            title:
              'BE00 middleware order on the CMS editorial human routes CMS-03B-10 entry create cms-editorial: step 3 (content type) wins over every later step',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route rejects disallowed origin, media, missing key, and failed cookie CSRF',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Content-Type application/json on every command route EB content type CMS-03B-01 revision: text/plain is 415 UNSUPPORTED_MEDIA_TYPE naming application/json and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Content-Type application/json on every command route EB content type CMS-03B-01 revision: application/json with a charset parameter reaches the port',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Content-Type application/json on every command route EB content type CMS-03B-02 conflict resolution: text/plain is 415 UNSUPPORTED_MEDIA_TYPE naming application/json and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Content-Type application/json on every command route EB content type CMS-03B-02 conflict resolution: application/json with a charset parameter reaches the port',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Content-Type application/json on every command route EB content type CMS-03B-04 restore: text/plain is 415 UNSUPPORTED_MEDIA_TYPE naming application/json and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Content-Type application/json on every command route EB content type CMS-03B-04 restore: application/json with a charset parameter reaches the port',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Content-Type application/json on every command route EB content type CMS-03B-10 entry create: text/plain is 415 UNSUPPORTED_MEDIA_TYPE naming application/json and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Content-Type application/json on every command route EB content type CMS-03B-10 entry create: application/json with a charset parameter reaches the port',
          },
        ],
      },
      {
        text: 'existing-resource mutations require exact strong If-Match, while initial entry creation uses the explicit create precondition',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/admission-headers.test.ts',
            title:
              'CMS editorial browser admission headers rejects a missing strong If-Match without inferring a version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes.test.ts',
            title:
              'cms-editorial CMS-03B-01 route requires Idempotency-Key and a strong If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route rejects missing edit capability and a weak validator before mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes.test.ts',
            title:
              'cms-editorial CMS-03B-01 route [P2-S10-AC-004] refuses an If-Match that disagrees with the body expectedVersion before the port, never overwriting either',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-03 compare and CMS-03B-04 restore through the real stack [P2-S10-AC-025] a stale entry version is a definite 409 conflict, never a retryable 503',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route rejects caller authority and If-Match before mutation',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes.test.ts',
            title:
              'cms editorial route registry keeps every command row on headers and every read row on query',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-061] [P2-S10-AC-066] the projection round-trips into a create that commits the entry, first revision, audit and outbox exactly once',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: exact strong If-Match on existing resources, none on the initial create EB if-match CMS-03B-01 revision: a weak validator is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: exact strong If-Match on existing resources, none on the initial create EB if-match CMS-03B-01 revision: missing is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: exact strong If-Match on existing resources, none on the initial create EB if-match CMS-03B-01 revision: the exact strong validator of the body version reaches the port',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: exact strong If-Match on existing resources, none on the initial create EB if-match CMS-03B-02 conflict resolution: a weak validator is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: exact strong If-Match on existing resources, none on the initial create EB if-match CMS-03B-02 conflict resolution: missing is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: exact strong If-Match on existing resources, none on the initial create EB if-match CMS-03B-02 conflict resolution: the exact strong validator of the body version reaches the port',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: exact strong If-Match on existing resources, none on the initial create EB if-match CMS-03B-04 restore: a weak validator is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: exact strong If-Match on existing resources, none on the initial create EB if-match CMS-03B-04 restore: missing is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: exact strong If-Match on existing resources, none on the initial create EB if-match CMS-03B-04 restore: the exact strong validator of the body version reaches the port',
          },
        ],
      },
      {
        text: 'no fabricated existing version;',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-transport.test.ts',
            title:
              'executeCmsEditorialEntryCreate request shape posts once with Idempotency-Key and never If-Match',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: exact strong If-Match on existing resources, none on the initial create EB if-match CMS-03B-10 entry create: an initial create needs no If-Match and no fabricated version',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: exact strong If-Match on existing resources, none on the initial create EB if-match CMS-03B-10 entry create: a supplied If-Match is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create precondition: a create carrying an If-Match member is INVALID_REQUEST',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create precondition: the If-Match-carrying create wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create precondition: a create carrying an expectedVersion member is INVALID_REQUEST',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create precondition: a create carrying a baseRevision member is INVALID_REQUEST',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create precondition: the entry version of a created entry is the server-derived 1',
          },
        ],
      },
      {
        text: 'malformed headers return 400 INVALID_REQUEST.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/admission-headers.test.ts',
            title:
              'CMS editorial browser admission headers rejects a missing strong If-Match without inferring a version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/be00-middleware-order.test.ts',
            title:
              'BE00 middleware order on the CMS editorial human routes CMS-03B-10 entry create cms-editorial: step 10 (idempotency key) wins over every later step',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-proxies-hardening-create.test.ts',
            title:
              'cms-editorial create proxy header tuple (CMS-03B-10) refuses a supplied If-Match instead of silently dropping it',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'a restore without an Idempotency-Key is refused before any read or write',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: exact strong If-Match on existing resources, none on the initial create EB if-match CMS-03B-01 revision: an unquoted version is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: exact strong If-Match on existing resources, none on the initial create EB if-match CMS-03B-02 conflict resolution: an unquoted version is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: exact strong If-Match on existing resources, none on the initial create EB if-match CMS-03B-04 restore: an unquoted version is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-01 revision: a 129 characters key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-02 conflict resolution: a 129 characters key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-04 restore: a 129 characters key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-10 entry create: a 129 characters key is 400 INVALID_REQUEST and the port is never reached',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-050',
    text: 'CMS-05 Create/edit entry: atomically bootstrap an authorized active entry with its first attributable draft revision, load only its protected current editable draft, then autosave changed paths against an explicit readable base revision; server derives owner, assignment, and acting context.',
    clauses: [
      {
        text: 'CMS-05 Create/edit entry: atomically bootstrap an authorized active entry with its first',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-061] [P2-S10-AC-066] the projection round-trips into a create that commits the entry, first revision, audit and outbox exactly once',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '403 and concealment decided by the database for other principals [P2-S10-AC-006] [P2-S10-AC-012] a confirmed member holding no CMS grant is a 403, and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title:
              'CMS-03B-10 atomically owns and points the active entry at its first draft',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title:
              'CMS-03B-10 fail-closed create persists no entry (only the seeded draft exists)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title: 'CMS-03B-10 fail-closed create persists no revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title:
              'CMS-03B-10 fail-closed create persists no assignment (only the fixture pair exists)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title:
              'CMS-03B-10 create without a registered grant returns FORBIDDEN',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity: after the outbox fault no entry, revision, value, relation, assignment, reservation, audit or outbox row survives',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity rollback: the outbox fault raised after the four inserts leaves the committed state equal to the state before the create',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity rollback: the audit fault raised after the four inserts leaves the committed state equal to the state before the create',
          },
        ],
      },
      {
        text: 'attributable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create attribution: the first revision author is the canonical person of the session actor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create attribution: the first revision acting party is the acting organization of the session',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create attribution: the audit event names the session actor and the acting party',
          },
        ],
      },
      {
        text: 'draft revision',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-061] [P2-S10-AC-066] the projection round-trips into a create that commits the entry, first revision, audit and outbox exactly once',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title:
              'CMS-03B-10 stores one schema-pinned, parentless, valid draft revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title: 'CMS-03B-10 returns draft state rather than publication',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title: 'CMS-03B-10 returns initial immutable revision number one',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'load only its protected current editable draft',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-068] [P2-S10-AC-069] the draft read serves the committed value with the entry and revision in its strong ETag',
          },
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
              '401, 403 and 404 are the database decision, not a stub [P2-S10-AC-068] [P2-S10-AC-089] an entry the caller cannot see is the same empty 404 as an absent one',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title:
              'CMS-03B-11 reviewer-only refusal has the exact contract token',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route requires a valid human session and author/editor read capability',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/cms-editorial-draft-read.test.ts',
            title:
              'CMS-03B-11 local Worker → web proxy → browser read delivers the authorized canonical draft with the same composite ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-edit-page.test.ts',
            title:
              'loadEntryEditPage builds the editor from the verified draft and the author-safe definitions of its schema version',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > the assigned author reads the typed draft with its state, and the page is no-store and accessible',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > no session returns to sign-in at the exact address and shows no draft',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'then autosave changed paths against an explicit',
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
            title: 'CMS-03B-01 rejects a null base version at the SQL boundary',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 appends one draft revision for an assigned author',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 frozen hash matches the complete copied-and-patched field snapshot',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-controller.test.ts',
            title:
              'editor controller: autosave cadence and request shape saves 3 s after the last edit against the explicit base revision with If-Match and a key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-controller.test.ts',
            title:
              'editor controller: autosave cadence and request shape sends only the changed fields',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > edit: an explicit save and an autosave send the server-derived If-Match and base, each under its own key, and move focus nowhere',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'readable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB append base: a base revision number that names no revision of the entry is the 422 VALIDATION_FAILED at /baseRevision (BE03b matrix; lane H round 3, it was a 404)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title: 'EB append base: the unreadable-base refusal wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB append base control: the same append against the readable base revision 1 is accepted',
          },
        ],
      },
      {
        text: 'base revision',
        citations: [
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
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'append: a malformed baseRevision is pointed at /baseRevision',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-controller.test.ts',
            title:
              'editor controller: autosave cadence and request shape saves 3 s after the last edit against the explicit base revision with If-Match and a key',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > edit: an explicit save and an autosave send the server-derived If-Match and base, each under its own key, and move focus nowhere',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'server derives owner, assignment, and acting context.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title:
              'CMS-03B-10 atomically owns and points the active entry at its first draft',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title:
              'CMS-03B-10 assigns the canonical creator person without caller authority',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title:
              'CMS-03B-10 rejects a caller-supplied capability key instead of honouring it',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_entry_owner_chain.sql',
            title:
              'entry insert cannot claim a different owner from its content type',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production.test.ts',
            title:
              'cms editorial production adapter transport derives context and body server-side from the verified session',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route rejects caller authority and If-Match before mutation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create attribution: the first revision author is the canonical person of the session actor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create attribution: the first revision acting party is the acting organization of the session',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create attribution: the initial assignee is the canonical person of the session actor',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create.test.ts',
            title:
              'EB create port binding (AC-063, AC-066) EB create context: actor and acting party are the verified session ids and the capability is never forwarded',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create authority: a create carrying an ownerId member is INVALID_REQUEST and nothing is written',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-051',
    text: 'CMS-05 Create/edit entry: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-05 Create/edit entry: preserve declared failure and recovery across invalid authority',
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
              '401, 403 and 404 are the database decision, not a stub [P2-S10-AC-068] [P2-S10-AC-089] an entry the caller cannot see is the same empty 404 as an absent one',
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
              '403 and concealment decided by the database for other principals [P2-S10-AC-068] [P2-S10-AC-089] a person outside the owning organization cannot tell the entry exists',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title:
              'CMS-03B-10 create without an authenticated actor returns UNAUTHENTICATED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title:
              'CMS-03B-10 create without a registered grant returns FORBIDDEN',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002b-create-owner-conceal.sqlinc',
            title:
              'CMS-03B-10 conceals a foreign active version before artifact or policy lookup',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: refusals keep the work keeps the work and offers sign-in with a safe return when the session expires',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > 403 for a visible entry the caller cannot read, one 404 for a hidden or absent one, 400 for a malformed id',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > no session returns to sign-in at the exact address and shows no draft',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'concurrency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-064] the same key with another body is the database 409 IDEMPOTENCY_MISMATCH and adds nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-015] a same-field save from a stale base is a 409 that records one open conflict and appends no revision',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-01 append and CMS-03B-03 history through the real stack [P2-S10-AC-009] a lost response is an unknown outcome, and the same-key replay returns the committed revision without a second effect',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title:
              'CMS-03B-10 exact-key retry returns the same entry and revision resource',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 returns a committed private conflict disposition for same-field divergence',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 conflict does not append or overwrite either competing revision',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-outcomes.test.ts',
            title:
              'editor controller: conflicts and merges on a 409 with a durable open conflict reads it, links to resolution and keeps the values',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-outcomes.test.ts',
            title:
              'editor controller: conflicts and merges on a 409 without a durable conflict rebases the unsent edits and retries once',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a same-field save from a stale second session is a truthful 409 that overwrites nothing, and only an explicit discard loads the current version',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > edit: a save whose response is lost is replayed byte for byte under the same key and commits exactly once',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'revocation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_presence_lease.sql',
            title:
              "deactivating the author grant revokes the author's active lease in the same statement",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_presence_lease.sql',
            title: 'an autosave after the authority was revoked is rejected',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_presence_lease.sql',
            title:
              'the rejected autosave commits no revision and cannot revive the revoked presence',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_presence_lease.sql',
            title:
              "revoking the entry assignment releases that assignee's lease",
          },
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
              'CmsEditorialEntryEditorIsland: refusals keep the work shows the revoked-authority message and keeps the unsent value readable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore revocation: an actor whose entry assignment was revoked is refused FORBIDDEN',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore revocation: an actor whose cms grants were revoked is refused FORBIDDEN',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB resolve revocation: a resolver whose entry assignment was revoked is refused FORBIDDEN',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > a revoked session keeps every unsent value and offers sign-in, and nothing is written',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'deletion',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_presence_lease.sql',
            title: "deleting the author grant releases the author's lease",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_presence_lease.sql',
            title:
              "deleting the author grant revokes only that person's author assignment [DEC-143]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_entry_list_authorized_keyset.sql',
            title:
              'the creator lists exactly the active entries they hold an active assignment on, newest first (revoked assignment and archived entry omitted)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_schema/001-entries-and-revisions.sqlinc',
            title:
              'P2-S10-AC-002 EntryRevision is an immutable append-only snapshot',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: what cannot be edited is read-only with a stated reason when the entry is not active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore deletion: restoring a revision of an archived entry is the typed INVALID_TRANSITION refusal',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore deletion: restoring on an entry that does not exist is the concealed NOT_FOUND',
          },
        ],
      },
      {
        text: 'cascade',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_presence_lease.sql',
            title:
              "revoking the author grant revokes that person's author assignment in the same statement and no one else's [DEC-143]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_presence_lease.sql',
            title:
              "ending the membership tenure revokes the editor's entry assignment in the same statement [DEC-143]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_presence_lease.sql',
            title: "ending the membership tenure releases the editor's lease",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_presence_lease.sql',
            title:
              'partial revocation revokes only the assignment of the capability whose grant was revoked [DEC-143]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_presence_lease.sql',
            title:
              'the sweep is idempotent: an expired lease is not retired twice',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-052',
    text: '`CMS-05` Create/edit entry: implement native create/edit forms with protected draft-detail loading; focus stays until navigation or named result heading; server-derived actor/context/capability, strict Zod input, create idempotency, update ETag/idempotency; render canonical response/version/provenance/next action and announce status; map exact `ApiError`, retain unsent input, focus summary/field, reconcile unknown mutation before retry; URL for navigation/filter, scoped draft before commit, server after success.',
    clauses: [
      {
        text: '`CMS-05` Create/edit entry: implement native create/edit forms with protected draft-detail loading',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-068] [P2-S10-AC-069] the draft read serves the committed value with the entry and revision in its strong ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '401, 403 and 404 are the database decision, not a stub [P2-S10-AC-006] no session is a 401 with a reauthenticate hint on every operation and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: rendering renders a native control per kind and a typed unavailable state where nothing can be authored',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: the edit surface renders the stored values in native labelled controls and the entry facts as text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-edit-page.test.ts',
            title:
              'loadEntryEditPage builds the editor from the verified draft and the author-safe definitions of its schema version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-draft-detail-transport.test.ts',
            title:
              'executeCmsEditorialEntryDraftDetailRead request shape gets the entry with no body and no mutation headers',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > edit: an explicit save and an autosave send the server-derived If-Match and base, each under its own key, and move focus nowhere',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > the assigned author reads the typed draft with its state, and the page is no-store and accessible',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-keyboard-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 keyboard-only real route > list -> create -> type -> Enter creates one entry without a pointer',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'focus stays until navigation',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: the edit surface announces dirty and saved through one polite status region and never moves focus',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: refusals keep the work refuses an invalid value locally, links the summary to it, and only an explicit save takes focus',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-eb-focus-gaps.test.tsx',
            title:
              'focus: the activated submit control stays enabled while the command is in flight AC-052: the Create entry button is not disabled while the create is in flight',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-submit-focus.test.tsx',
            title:
              'create form: Create entry stays put while the create is in flight is aria-busy rather than disabled, and a repeated activation sends one request',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-submit-focus.test.tsx',
            title:
              'create form: Create entry stays put while the create is in flight after an unknown outcome the form locks and focus moves to the retry button, not <body>',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-focus.test.ts',
            title:
              'EB edit island focus: the activated Save draft control stays enabled and focused while the save is in flight EB edit island: Save draft is marked busy, not disabled, keeps focus and a second activation sends no second request',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > edit: an explicit save and an autosave send the server-derived If-Match and base, each under its own key, and move focus nowhere',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'named result heading',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: submit creates with only the fields that hold a value, then opens the APP route of the entry',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/route-heading-focus.test.ts',
            title:
              '[P2-S09-AC-1232] one-shot result heading focus [P2-S09-AC-1232] focuses the heading once after a marked commit and then forgets the mark',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-keyboard-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 keyboard-only real route > list -> create -> type -> Enter creates one entry without a pointer',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'server-derived actor/context/capability',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title:
              'CMS-03B-10 rejects a caller-supplied capability key instead of honouring it',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-submit.test.ts',
            title:
              'submitCmsEditorialEntryCreate sends the real JSON command with CSRF and Idempotency-Key, no If-Match, and /fields/ pointers',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-edit-page.test.ts',
            title:
              'loadEntryEditPage serialises no owner, assignee or authority identifier into the island data',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route rejects caller authority and If-Match before mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production.test.ts',
            title:
              'cms editorial production adapter transport derives context and body server-side from the verified session',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route fails closed without a production port or author capability',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create attribution: the first revision author is the canonical person of the session actor',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create.test.ts',
            title:
              'EB create port binding (AC-063, AC-066) EB create context: actor and acting party are the verified session ids and the capability is never forwarded',
          },
        ],
      },
      {
        text: 'strict Zod input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-transport.test.ts',
            title:
              'executeCmsEditorialEntryCreate request shape blocks a locally invalid body before any network call and keeps values',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-runtime.test.ts',
            title:
              'executeCmsEditorialRevisionMutation request shape blocks a locally invalid request before any network call',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-create.test.ts',
            title:
              'cms entry create body (CMS-03B-10) rejects unknown keys and every caller-supplied authority field',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial request shapes accepts the canonical revision body and rejects unknown keys',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-proxies.test.ts',
            title:
              'cms-editorial create proxy (CMS-03B-10) rejects a schema-invalid body before it can reach upstream',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route rejects caller authority and If-Match before mutation',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'create idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-061] [P2-S10-AC-066] the projection round-trips into a create that commits the entry, first revision, audit and outbox exactly once',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-064] the same key with another body is the database 409 IDEMPOTENCY_MISMATCH and adds nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-transport.test.ts',
            title:
              'executeCmsEditorialEntryCreate request shape posts once with Idempotency-Key and never If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-transport.test.ts',
            title:
              'idempotency key lifecycle rotates the key after a definite refusal so a retry is a new create',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: failures keep the work on a lost response locks the form, keeps the key, and replays the identical request',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-proxies.test.ts',
            title:
              'cms-editorial create proxy (CMS-03B-10) requires a bounded idempotency key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-outcome-unknown.test.ts',
            title:
              "outcome-unknown writes (reconcile by same-key replay) 'create': the Idempotency-Key reaches the Worker byte-for-byte on every replay",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route rejects disallowed origin, media, missing key, and failed cookie CSRF',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'update ETag/idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-01 append and CMS-03B-03 history through the real stack [P2-S10-AC-007] [P2-S10-AC-009] an append commits one revision, one audit row and one outbox event and its strong ETag is the next entry version',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-01 append and CMS-03B-03 history through the real stack [P2-S10-AC-009] a lost response is an unknown outcome, and the same-key replay returns the committed revision without a second effect',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_response_contracts.sql',
            title:
              'append returns entryVersion = the requested expectedVersion + 1 (the next If-Match)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 exact-key replay returns the identical committed revision',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-controller.test.ts',
            title:
              'editor controller: autosave cadence and request shape saves 3 s after the last edit against the explicit base revision with If-Match and a key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-controller.test.ts',
            title:
              'editor controller: autosave cadence and request shape adopts the committed ENTRY version, not the snapshot version, as the next If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/routes.test.ts',
            title:
              'cms-editorial CMS-03B-01 route requires Idempotency-Key and a strong If-Match',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > edit: an explicit save and an autosave send the server-derived If-Match and base, each under its own key, and move focus nowhere',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'render canonical response/version/',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: the edit surface renders the stored values in native labelled controls and the entry facts as text',
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
              'editor controller: conflicts and merges after a merged 201 (two parents) adopts the canonical draft and keeps newer local edits',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: submit creates with only the fields that hold a value, then opens the APP route of the entry',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > edit: an explicit save and an autosave send the server-derived If-Match and base, each under its own key, and move focus nowhere',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'provenance',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.facts.test.tsx',
            title:
              'editor island: canonical facts of the draft lists the per-field provenance the server reported, in words, for every authored field',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.facts.test.tsx',
            title:
              'editor island: canonical facts of the draft moves the revision, the entry version and the saved fields provenance after a verified save',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.facts.test.tsx',
            title:
              'editor island: canonical facts of the draft takes the provenance of an adopted canonical draft from that draft',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.facts.test.tsx',
            title:
              'editor island: canonical facts of the draft never lists a relation field in the provenance list',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > edit: an explicit save and an autosave send the server-derived If-Match and base, each under its own key, and move focus nowhere',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: '/next action',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: conflicts shows the durable open conflict from the draft as a banner with a link to resolve it',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: the edit surface links to the revision history and the entry list with native links',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: submit creates with only the fields that hold a value, then opens the APP route of the entry',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'announce status',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: the edit surface announces dirty and saved through one polite status region and never moves focus',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: submit creates with only the fields that hold a value, then opens the APP route of the entry',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-runtime-dom-feedback.test.ts',
            title:
              'announceCmsEditorialStatus creates one polite atomic live region and fills it',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: refusals keep the work shows the revoked-authority message and keeps the unsent value readable',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > edit: an explicit save and an autosave send the server-derived If-Match and base, each under its own key, and move focus nowhere',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > edit: a save whose response is lost is replayed byte for byte under the same key and commits exactly once',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'map exact `ApiError`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-transport.test.ts',
            title:
              'executeCmsEditorialEntryCreate outcomes maps 409 CONFLICT to a conflict outcome with retryable=false',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-submit.test.ts',
            title:
              'submitCmsEditorialEntryCreate maps a typed 422 to the field it names and to fixed copy, never the server message',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: failures keep the work maps a typed server refusal to its field, keeps values and never shows the server message',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-outcomes.test.ts',
            title:
              'editor controller: outcome unknown and refusals maps a typed 422 to its field and fixed copy, keeps the values, and waits for an edit',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-outcomes.test.ts',
            title:
              'editor controller: outcome unknown and refusals on a 401 adopts nothing, keeps the unsent values and stops sending',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-hardening.test.ts',
            title:
              'upstream errors are rebuilt, never relayed (Codex review M2) projects each status from the closed vocabulary only',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production.test.ts',
            title:
              'cms editorial production adapter transport maps VERSION_MISMATCH to a 409 conflict',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a same-field save from a stale second session is a truthful 409 that overwrites nothing, and only an explicit discard loads the current version',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > a revoked session keeps every unsent value and offers sign-in, and nothing is written',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'retain unsent input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: local validation keeps every typed value when the form is refused',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: failures keep the work offers sign-in with a safe return target on an expired session, and keeps the values',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: refusals keep the work after a lost response keeps the typed value and replays the identical request on its own',
          },
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
              'CmsEditorialEntryEditorIsland: conflicts on a 409 opens the sync-conflict alert with focus, keeps the unsent value and links to resolution',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a same-field save from a stale second session is a truthful 409 that overwrites nothing, and only an explicit discard loads the current version',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > a revoked session keeps every unsent value and offers sign-in, and nothing is written',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'focus summary/field',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: local validation refuses an invalid form without a request, links the summary to the field and focuses it',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: refusals keep the work refuses an invalid value locally, links the summary to it, and only an explicit save takes focus',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: failures keep the work maps a typed server refusal to its field, keeps values and never shows the server message',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a same-field save from a stale second session is a truthful 409 that overwrites nothing, and only an explicit discard loads the current version',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'reconcile unknown mutation before retry',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-01 append and CMS-03B-03 history through the real stack [P2-S10-AC-009] a lost response is an unknown outcome, and the same-key replay returns the committed revision without a second effect',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: failures keep the work on a lost response locks the form, keeps the key, and replays the identical request',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-outcomes.test.ts',
            title:
              'editor controller: outcome unknown and refusals after a lost response keeps the key and replays the IDENTICAL request',
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
              'H1: merged-save reconciliation never overwrites an edit made after dispatch keeps a field edited after a lost response when the identical replay is the merged 201',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-submit.test.ts',
            title:
              'submitCmsEditorialEntryCreate reuses the key for the same request after a response that cannot be verified',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-outcome-unknown.test.ts',
            title:
              "outcome-unknown writes (reconcile by same-key replay) 'create': transport loss is an unknown outcome the client must replay with the same key",
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > edit: a save whose response is lost is replayed byte for byte under the same key and commits exactly once',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'URL for navigation/filter',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryList.test.tsx',
            title:
              'CmsEditorialEntryList (FE03 CmsEditorialEntryList, DEC-145) keeps the filters and limit in the continuation and replaces only the cursor',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryList.test.tsx',
            title:
              'CmsEditorialEntryList (FE03 CmsEditorialEntryList, DEC-145) names its heading as a focus target and offers a native GET filter bound to it',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-list-page.test.ts',
            title:
              'loadEntryListPage returns the verified page with the URL-owned query for the views',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-edit-page.test.ts',
            title:
              'loadEntryEditPage returns an expired session to this exact page',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-app-routes.test.ts',
            title:
              'CMS editorial app routes addresses the entry, its history and its conflict on app pages, never on the API',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/entry-list-route.test.tsx',
            title:
              'CMS-03B-13 protected entry-list page, composed lists the assigned entries as native links with a signed, URL-owned continuation',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-keyboard-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 keyboard-only real route > list -> create -> type -> Enter creates one entry without a pointer',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'scoped draft before commit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.leave.test.tsx',
            title:
              'H2: leaving the editor with unsent work is guarded Keep editing closes the confirmation, returns focus to the link and keeps every value',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.leave.test.tsx',
            title:
              'H2: leaving the editor with unsent work is guarded Leave without saving is the explicit discard: it navigates to the link target',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.leave.test.tsx',
            title:
              'H2: beforeunload is armed only while there is unsent work is armed while dirty, and disarmed again once the verified save lands',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-controller.test.ts',
            title:
              'editor controller: autosave cadence and request shape keeps an edit made while a save is in flight and sends it next',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-outcomes.test.ts',
            title:
              'editor controller: outcome unknown and refusals on a 403 adopts nothing, keeps the unsent values and stops sending',
          },
        ],
      },
      {
        text: 'server after success.',
        citations: [
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
              'editor controller: conflicts and merges after a merged 201 (two parents) adopts the canonical draft and keeps newer local edits',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: submit creates with only the fields that hold a value, then opens the APP route of the entry',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.leave.test.tsx',
            title:
              'H2: leaving the editor with unsent work is guarded Save draft and leave flushes the draft first and navigates only after the verified save',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-reconcile.test.ts',
            title:
              'H1: merged-save reconciliation never overwrites an edit made after dispatch keeps a field edited after a lost response when the identical replay is the merged 201',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-053',
    text: 'CMS-06 Resolve concurrent edit: given A same-field divergence from the same base revision is recorded on an entry the actor may edit, and both competing revisions plus their common base are still readable., implement locked behavior and completion exactly. The editor obtains bounded authorized base/theirs/yours preimages only through CMS-03B-12 before submitting a resolution.',
    clauses: [
      {
        text: 'CMS-06 Resolve concurrent edit: given A same-field divergence from the same base revision is recorded on an entry the actor may edit',
        citations: [
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
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 persists exactly one open conflict for the overlapping proposal',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004b-revision-write.sqlinc',
            title:
              'CMS-03B-01 conflict does not append or overwrite either competing revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 refuses a visible actor without assigned edit authority',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route rejects missing edit capability and a weak validator before mutation',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'both competing revisions plus their common base are still readable',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-088] [P2-S10-AC-090] the draft names the open conflict and CMS-03B-12 serves its three sides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title:
              'CMS-03B-12 carries the base/theirs revision refs and the yours source',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title:
              'CMS-03B-12 open conflict carries bounded per-path three-way preimages',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 base restores exactly the common-base field value',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 response binds the resolved conflict and both immutable parents',
          },
        ],
      },
      {
        text: 'implement locked behavior and completion exactly',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-010] [P2-S10-AC-013] resolving with an explicit choice commits a two-parent revision once, closes the conflict, and a replay adds nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title: 'CMS-03B-02 creates the next immutable draft revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 response binds the resolved conflict and both immutable parents',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title: 'CMS-03B-02 CAS-closes exactly the open private conflict',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 advances the entry version atomically with conflict closure',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 exact-key replay returns the identical resolved revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 refuses a moved entry version without selecting a winner',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_lifecycle.sql',
            title:
              'the append that advanced the draft superseded C1 in the same transaction (version + 1, no resolution evidence) [P2-S10-AC-053]',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-conflict.test.ts',
            title:
              'EB conflict resolve 201: server-derived context and a closed resource EB conflict resolve: a 201 relays exactly the strong-ETag resolution resource with both immutable parents and the closed conflict',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-conflict.test.ts',
            title:
              'EB conflict resolve 201: server-derived context and a closed resource EB conflict resolve: the route binds to the named RPC with the session context and no actor, owner or capability member in the body',
          },
        ],
      },
      {
        text: 'The editor obtains bounded authorized base/theirs/yours preimages only through CMS-03B-12 before submitting a resolution',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-088] [P2-S10-AC-090] the draft names the open conflict and CMS-03B-12 serves its three sides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'CMS-03B-11 openConflict exposes no proposed values, resolver or owner',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-conflict-page.test.ts',
            title:
              'loadConflictPage builds the resolution form from the verified conflict and the definitions of its schema version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-detail-transport.test.ts',
            title:
              'executeCmsEditorialConflictDetailRead reads the conflict by its two ids as a no-store GET with no body, key or If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-ports-coverage.test.ts',
            title:
              'cms editorial production ports maps a committed revision conflict to 409 without exposing the private proposal',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/cms-editorial-page-reads.test.ts',
            title:
              'createCmsEditorialPageReads addresses draft detail, conflict detail, history and the list by their API paths',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-054',
    text: 'CMS-06 Resolve concurrent edit: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade. Conflict-detail and resolution both conceal hidden records, never expose resolver/authority identities, and preserve typed values.',
    clauses: [
      {
        text: 'CMS-06 Resolve concurrent edit: preserve declared failure and recovery across invalid authority',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 refuses a visible actor without assigned edit authority',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title:
              'CMS-03B-12 visible entry without read scope returns FORBIDDEN',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title:
              'CMS-03B-12 read without an authenticated actor returns UNAUTHENTICATED',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-090] answers an anonymous caller 401 and a reviewer-only session 403 before persistence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route rejects missing edit capability and a weak validator before mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: refusals keep the choices maps a 403 to FORBIDDEN without discarding a choice',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: refusals keep the choices maps a 401 to UNAUTHENTICATED without discarding a choice',
          },
        ],
      },
      {
        text: 'concurrency',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 refuses a moved entry version without selecting a winner',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 invalid choices and stale CAS leave the open record intact',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 exact-key replay returns the identical resolved revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_lifecycle.sql',
            title:
              'resolving a superseded conflict is the typed INVALID_TRANSITION (409 "invalid transition") [P2-S10-AC-013, AC-033]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form after a 409 re-reads the conflict, keeps choices for unchanged fields and marks the reset one',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: 409 and closure on a 409 refetches the conflict and keeps choices only for paths whose preimages are unchanged',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route maps a moved-base conflict without leaking private values',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-outcome-unknown.test.ts',
            title:
              "outcome-unknown writes (reconcile by same-key replay) 'conflict': the Idempotency-Key reaches the Worker byte-for-byte on every replay",
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a same-field save from a stale second session is a truthful 409 that overwrites nothing, and only an explicit discard loads the current version',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'revocation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB resolve revocation: a resolver whose entry assignment was revoked is refused FORBIDDEN',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB resolve revocation: the revoked-assignment resolve appended no revision and left the conflict open',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB resolve revocation: a resolver whose cms grants were revoked is refused FORBIDDEN',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB resolve revocation: the revoked-grant resolve wrote nothing and left the conflict open',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB resolve revocation: a resolver whose organization tenure ended is concealed from the entry (NOT_FOUND)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB resolve revocation: the ended-tenure resolve wrote nothing and left the conflict open',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB resolve control: the assigned creator resolves the open conflict with an explicit choice',
          },
        ],
      },
      {
        text: 'deletion',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-090] a closed conflict is the same 404 as an absent one, and resolving it again is a 409 transition',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title:
              'CMS-03B-12 conceals a resolved conflict as NOT_FOUND, identical to an absent one [DEC-139, AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title:
              'CMS-03B-12 conceals a superseded conflict as NOT_FOUND, identical to an absent one [DEC-139, AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_lifecycle.sql',
            title:
              'resolving a superseded conflict is the typed INVALID_TRANSITION (409 "invalid transition") [P2-S10-AC-013, AC-033]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: 409 and closure treats a 404 after a 409 as the conflict no longer being open and refetches the draft',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form says the conflict is no longer open, without saying why, and links back to the entry',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-conflict-page.test.ts',
            title:
              'loadConflictPage says the conflict is not open for a hidden, absent or closed one, with nothing more',
          },
        ],
      },
      {
        text: 'cascade',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_lifecycle.sql',
            title:
              'the append that advanced the draft superseded C1 in the same transaction (version + 1, no resolution evidence) [P2-S10-AC-053]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_lifecycle.sql',
            title: 'the restore superseded the conflict it replaced',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_lifecycle.sql',
            title:
              'the entry ends with two resolved and two superseded records and no open one',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_lifecycle.sql',
            title: 'C2 is bound to the current draft revision (theirs)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_presence_lease.sql',
            title:
              "ending the membership tenure revokes the editor's entry assignment in the same statement [DEC-143]",
          },
        ],
      },
      {
        text: 'Conflict-detail',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-090] a closed conflict is the same 404 as an absent one, and resolving it again is a 409 transition',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title:
              'CMS-03B-12 non-member conceals the entry and conflict as NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title: 'CMS-03B-12 conceals an absent or foreign conflict identity',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title: 'CMS-03B-12 acting outside the owner tenancy is concealed',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-090] conceals a hidden or absent conflict as an indistinguishable 404 with empty details',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-reads-app.test.ts',
            title:
              'cms-editorial conflict-detail read proxy (CMS-03B-12) conceals an absent conflict as the typed upstream 404',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-conflict-page.test.ts',
            title:
              'loadConflictPage says the conflict is not open for a hidden, absent or closed one, with nothing more',
          },
        ],
      },
      {
        text: 'and resolution both conceal hidden records',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB resolve concealment: a tenant-invisible actor resolving a known conflict is refused with the minimal NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB resolve concealment: the tenant-invisible refusal is identical to the absent-conflict refusal in SQLSTATE, token, detail and hint',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB resolve concealment: the tenant-invisible resolve wrote nothing and left the conflict open',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-conflict.test.ts',
            title:
              'EB conflict resolve refusals: hidden records are concealed and typed values are preserved by the typed errors EB conflict resolve 404: the NOT_FOUND token is a 404 with empty details whether the conflict is hidden, closed, foreign or absent',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'never expose resolver/authority identities',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-088] [P2-S10-AC-090] the draft names the open conflict and CMS-03B-12 serves its three sides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title:
              'CMS-03B-12 exposes no ownership, acting-party, or resolver identifier',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-092] refuses any payload that serializes an ownership or resolver identifier',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-detail.test.ts',
            title:
              'conflict detail privacy rejects each private identity or ownership key at every level',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/contracts.test.ts',
            title:
              'cms editorial success resource exposes version plus the exact closed revision shape',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-conflict-page.test.ts',
            title:
              'loadConflictPage serialises no owner, resolver or authority identifier',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/conflict-detail-route.test.tsx',
            title:
              'CMS-03B-12 protected conflict-detail page, composed exposes no ownership or resolver identifier and no JSON',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route rejects a malformed or wrong-conflict RPC success as a bad gateway',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-conflict.test.ts',
            title:
              'EB conflict resolve 201: server-derived context and a closed resource EB conflict resolve: a resolution resource carrying the identity member resolverPersonId is not relayed (502) and the value never reaches the caller',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-conflict.test.ts',
            title:
              'EB conflict resolve 201: server-derived context and a closed resource EB conflict resolve: a resolution resource carrying the identity member ownerId is not relayed (502) and the value never reaches the caller',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-conflict.test.ts',
            title:
              'EB conflict resolve refusals: hidden records are concealed and typed values are preserved by the typed errors EB conflict resolve 403: the FORBIDDEN token is a 403 that names no assignment, capability or resolver',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'preserve typed values.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 explicit choice persists a typed manual replacement',
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
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_resolve_conflict: an object choice with an undeclared key is object_property_invalid [BE03b:1053]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_relation_authoring.sql',
            title: 'the base side is the relation value of the base revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_relation_authoring.sql',
            title: 'the yours side is the proposed relation value',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: choices validates an explicit value with the field own rules before any request',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/CmsFieldValueView.test.tsx',
            title:
              'CmsFieldValueView states the absence of a value, and an explicit clear, in words',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-055',
    text: '`CMS-06` Resolve concurrent edit: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-06` Resolve concurrent edit: implement Native link/button/form',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form shows base, their version and your version per field as typed values with native radio choices and none preselected',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/conflict-detail-route.test.tsx',
            title:
              'CMS-03B-12 protected conflict-detail page, composed renders the three named preimages and a radio choice for every divergent field',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: conflicts shows the durable open conflict from the draft as a banner with a link to resolve it',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form says the conflict is no longer open, without saying why, and links back to the entry',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-keyboard-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 keyboard-only real route > conflict: the three-way choice is made with arrow keys and Space, and Enter on Resolve commits it',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'focus stays until navigation',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-eb-focus-gaps.test.tsx',
            title:
              'focus: the activated submit control stays enabled while the command is in flight AC-055: the Resolve conflict button is not disabled while the resolve is in flight',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-submit-focus.test.tsx',
            title:
              'conflict form: Resolve conflict stays put while the resolve is in flight is aria-busy rather than disabled, and a repeated activation sends one request',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-submit-focus.test.tsx',
            title:
              'conflict form: Resolve conflict stays put while the resolve is in flight keeps a focused radio enabled while submitting with Enter from the radio',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-submit-focus.test.tsx',
            title:
              'conflict form: Resolve conflict stays put while the resolve is in flight after an unknown outcome focus moves to the retry button, not <body>',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-submit-focus.test.tsx',
            title:
              'conflict form: Resolve conflict stays put while the resolve is in flight moves focus to the alert when the conflict turns out to be closed',
          },
        ],
      },
      {
        text: 'named result heading',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form resolves with the explicit choices, announces it and opens the entry on its APP route',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/route-heading-focus.test.ts',
            title:
              '[P2-S09-AC-1232] one-shot result heading focus [P2-S09-AC-1232] focuses the heading once after a marked commit and then forgets the mark',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'Server-derived actor/context/capability',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 closes the versioned resolution envelope with server-derived actor',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-resolution.test.ts',
            title:
              'CMS-03B-02 conflict resolution request never accepts caller-supplied authority',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-conflict-page.test.ts',
            title:
              'loadConflictPage serialises no owner, resolver or authority identifier',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-write-query-guard.test.ts',
            title:
              'CMS-03B-02 conflict resolution proxy undeclared query refuses ?ownerId before forwarding the resolution write',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route rejects missing edit capability and a weak validator before mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: resolve posts every choice verbatim with key + If-Match on the entry version, and opens the entry',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-conflict.test.ts',
            title:
              'EB conflict resolve 201: server-derived context and a closed resource EB conflict resolve: the route binds to the named RPC with the session context and no actor, owner or capability member in the body',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-conflict.test.ts',
            title:
              'EB conflict resolve refusals: hidden records are concealed and typed values are preserved by the typed errors EB conflict resolve 403: a session without edit capability is refused before the RPC is reached',
          },
        ],
      },
      {
        text: 'valid Zod input',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title: 'CMS-03B-02 refuses an inferred same-field winner',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 rejects duplicate path decisions instead of choosing a last winner',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-resolve-transport.test.ts',
            title:
              'executeCmsEditorialConflictResolve refuses locally when a choice smuggles a value or the list is empty',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: choices refuses to submit until every path has an explicit choice, naming the ones left open',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: choices validates an explicit value with the field own rules before any request',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-resolution.test.ts',
            title:
              'CMS-03B-02 conflict resolution request requires 1-128 choices and rejects a path decided twice',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route rejects duplicate paths, inferred choices, and path/body mismatch before mutation',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'required ETag/idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-010] [P2-S10-AC-013] resolving with an explicit choice commits a two-parent revision once, closes the conflict, and a replay adds nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004c-conflict-resolve.sqlinc',
            title:
              'CMS-03B-02 refuses a moved entry version without selecting a winner',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: resolve posts every choice verbatim with key + If-Match on the entry version, and opens the entry',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-resolve-transport.test.ts',
            title:
              'executeCmsEditorialConflictResolve posts the verbatim explicit choice set with CAS headers',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-resolve-contract.test.ts',
            title:
              'CmsEditorialConflictResolve contract projection requires JSON content type, idempotency key, and quoted If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-routes.test.ts',
            title:
              'CMS-03B-02 protected conflict-resolution route rejects missing edit capability and a weak validator before mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-outcome-unknown.test.ts',
            title:
              "outcome-unknown writes (reconcile by same-key replay) 'conflict': the Idempotency-Key reaches the Worker byte-for-byte on every replay",
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'Render authoritative response/version/provenance/next action',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form shows base, their version and your version per field as typed values with native radio choices and none preselected',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/CmsFieldValueView.test.tsx',
            title:
              'CmsFieldValueView states the absence of a value, and an explicit clear, in words',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-detail-transport.test.ts',
            title:
              'executeCmsEditorialConflictDetailRead refuses a 200 for another conflict or entry, or one that is not the strict contract',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: 409 and closure on a 409 refetches the conflict and keeps choices only for paths whose preimages are unchanged',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-resolve-transport.test.ts',
            title:
              'executeCmsEditorialConflictResolve reports unknown for a 201 that is not this verified two-parent result',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: resolve posts every choice verbatim with key + If-Match on the entry version, and opens the entry',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form says the conflict is no longer open, without saying why, and links back to the entry',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'announce status',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form resolves with the explicit choices, announces it and opens the entry on its APP route',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form keeps every choice and offers a retry of the same request after a lost response',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialStatus.test.tsx',
            title:
              'CmsEditorialStatus live region is one polite atomic status region addressed by id',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-runtime-dom-feedback.test.ts',
            title:
              'announceCmsEditorialStatus creates one polite atomic live region and fills it',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'Map exact `ApiError`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-resolve-transport.test.ts',
            title:
              'executeCmsEditorialConflictResolve maps the declared failure statuses without inferring a winner',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: refusals keep the choices maps a 403 to FORBIDDEN without discarding a choice',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: refusals keep the choices maps a typed 422 to the choice it names and fixed copy',
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
              'conflict controller: 409 and closure treats a 404 after a 409 as the conflict no longer being open and refetches the draft',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-hardening.test.ts',
            title:
              "upstream errors are rebuilt, never relayed (Codex review M2) 'conflict': a 409 keeps only the closed conflict details and a canonical message",
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'retain input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: refusals keep the choices maps a 403 to FORBIDDEN without discarding a choice',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form keeps every choice and offers a retry of the same request after a lost response',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form after a 409 re-reads the conflict, keeps choices for unchanged fields and marks the reset one',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-resolve-transport.test.ts',
            title:
              'executeCmsEditorialConflictResolve keeps the caller request untouched and choices preserved on refusal',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'focus summary/field',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form refuses to resolve with a field left undecided, links the summary to it and focuses the summary',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: choices refuses to submit until every path has an explicit choice, naming the ones left open',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form after a 409 re-reads the conflict, keeps choices for unchanged fields and marks the reset one',
          },
        ],
      },
      {
        text: 'reconcile unknown mutation before retry',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form keeps every choice and offers a retry of the same request after a lost response',
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
              'conflict controller: resolve rejects a 201 that is not a distinct two-parent revision as unknown, never as resolved',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-resolve-transport.test.ts',
            title:
              'executeCmsEditorialConflictResolve reports unknown on a lost response and keeps the idempotency key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-resolve-transport.test.ts',
            title:
              'executeCmsEditorialConflictResolve keeps the resolution key when a 409 is not a verified conflict',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-outcome-unknown.test.ts',
            title:
              "outcome-unknown writes (reconcile by same-key replay) 'conflict': transport loss is an unknown outcome the client must replay with the same key",
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-outcome-unknown.test.ts',
            title:
              "outcome-unknown writes (reconcile by same-key replay) 'conflict': an unverifiable 2xx is an unknown outcome, never a success",
          },
        ],
      },
      {
        text: 'URL for navigation/filter',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-app-routes.test.ts',
            title:
              'CMS editorial app routes addresses the entry, its history and its conflict on app pages, never on the API',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-conflict-page.test.ts',
            title:
              'loadConflictPage answers a malformed conflict id as an invalid request without an upstream call',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: conflicts shows the durable open conflict from the draft as a banner with a link to resolve it',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/cms-editorial-page-reads.test.ts',
            title:
              'createCmsEditorialPageReads addresses draft detail, conflict detail, history and the list by their API paths',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'scoped draft before commit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: choices starts with no choice made and never infers a winner',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: choices refuses to submit until every path has an explicit choice, naming the ones left open',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: resolve never sends an explicit value alongside a named choice',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form keeps every choice and offers a retry of the same request after a lost response',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form after a 409 re-reads the conflict, keeps choices for unchanged fields and marks the reset one',
          },
        ],
      },
      {
        text: 'server after success.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts',
            title:
              'conflict controller: resolve posts every choice verbatim with key + If-Match on the entry version, and opens the entry',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: the three-way form resolves with the explicit choices, announces it and opens the entry on its APP route',
          },
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
              'conflict controller: 409 and closure on a 409 refetches the conflict and keeps choices only for paths whose preimages are unchanged',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision',
            project: 'real-route-chrome',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-056',
    text: "CMS-07 Compare/restore revision: given Actor may read the entry's revision history and both compared revisions exist with their recorded schema, template and taxonomy versions; a restore additionally requires edit capability plus a registered migration chain from the source revision's schema to the current active version., implement locked behavior and completion exactly. Comparison spans field, block, and relation domains; restore requires an exact immutable migration-chain manifest and refuses more than 512 changes.",
    clauses: [
      {
        text: "CMS-07 Compare/restore revision: given Actor may read the entry's revision history",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title:
              'CMS-03B-03 permits a reviewer with only the registered grant and active assignment',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title:
              'CMS-03B-03 revoked reviewer assignment is a visible-but-unscoped refusal',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/history-routes.test.ts',
            title:
              'CMS-03B-03 protected revision-history route allows a reviewer but rejects a caller without read capability',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '401, 403 and 404 are the database decision, not a stub [P2-S10-AC-006] no session is a 401 with a reauthenticate hint on every operation and writes nothing',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'both compared revisions exist with their recorded schema',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage_domains.sql',
            title: 'CMS-07 compare read succeeds on the seeded revision pair',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title:
              'CMS-03B-03 compares an authorized base to the latest readable revision',
          },
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
        ],
      },
      {
        text: 'template',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage.sql',
            title:
              'EB-AC056: revisions recording a template version that resolves compare normally',
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
              'EB-AC056: the template refusal never names the recorded template version',
          },
        ],
      },
      { text: 'taxonomy versions', citations: [] },
      {
        text: "a restore additionally requires edit capability plus a registered migration chain from the source revision's schema to the current active version",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'a tenant member without edit authority over the entry is refused (FORBIDDEN)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-routes.test.ts',
            title:
              'CMS-03B-04 protected revision-restore route fails closed without a restore port or edit capability',
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
              'a two-edge restore applies each registered transform and appends a draft',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'the identity of the middle-to-active chain does not cover source to active and is refused as migration_chain_mismatch',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'a chain with an edge that is not a completed plan is migration_chain_unavailable, never guessed',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-routes.test.ts',
            title:
              'CMS-03B-04 restore-port internal evidence gate fails closed 503 when the chain does not span source schema to active schema',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-03 compare and CMS-03B-04 restore through the real stack [P2-S10-AC-022] [P2-S10-AC-027] restoring the first revision creates one new draft with the chain from the compare read, and an exact-key replay adds nothing',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'implement locked behavior and completion exactly',
        citations: [
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
              'a source of rich_text, object and relation values restores onto the active schema',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'the new draft is revision 3 under the active schema with parents [currentDraftRevisionId, sourceRevisionId]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'one manifest, one revision-created outbox event carrying only identifiers and one audit record are written atomically',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'the source revision is untouched and the completed reservation stores exactly the returned envelope',
          },
        ],
      },
      {
        text: 'Comparison spans field, block, and relation domains',
        citations: [
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
              'CMS-07 block side hash is the locked JCS {blockKey, blockVersion, blockRegistryDigest, mode, patternRef, props, bindings} input',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title:
              'CMS-03B-03 compare identifies the changed stable-field path',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-history.test.ts',
            title:
              'CMS-03B-03 revision summary and page requires a closed comparison domain on every change and rejects the unknown one',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialRevisionCompare.test.tsx',
            title:
              'CmsEditorialRevisionCompare: domains and counts names the comparison heading as a focus target and groups changes field, block, relation',
          },
        ],
      },
      {
        text: 'restore requires an exact immutable migration-chain manifest',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore manifest fixture: the restore wrote exactly one chain manifest row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore manifest immutability: an UPDATE of a committed chain manifest row is refused even inside the CMS RPC context',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore manifest immutability: the refused UPDATE changed nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore manifest immutability: a DELETE of a committed chain manifest row is refused even inside the CMS RPC context',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore manifest immutability: the refused DELETE changed nothing',
          },
        ],
      },
      {
        text: 'refuses more than 512 changes',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage_domains.sql',
            title:
              'CMS-07 exactly 512 combined changes is still a complete 200',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_compare_lineage_domains.sql',
            title:
              'CMS-07 513 combined changes is the typed comparison_too_large refusal, never partial',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-history.test.ts',
            title:
              'CMS-03B-03 revision summary and page keeps the 512-change bound while accepting the exact boundary',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-revision-history-page.test.ts',
            title:
              'loadRevisionHistoryPage turns the typed 422 comparison_too_large into a refusal beside the list, never a truncated comparison',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialRevisionCompare.test.tsx',
            title:
              'CmsEditorialRevisionCompare: typed refusals, never a truncated success renders comparison_too_large as its own refusal with no change list',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "taxonomy versions". Slice 10 has no authority that resolves a recorded taxonomy version, so a revision recording any non-empty taxonomy list fails closed as comparison_unavailable (DEC-141; gap-resolutions D-3 moves the resolving authority to Slice 12). That fail-closed behavior is tested (compare_lineage.sql DEC-141 assertions) but a comparison of such revisions is not provable here. The recorded template version, the recorded schema, the field/block/relation domains, the 512-change bound and the exact immutable chain manifest are proven.',
  },
  {
    criterion: 'P2-S10-AC-057',
    text: 'CMS-07 Compare/restore revision: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-07 Compare/restore revision: preserve declared failure and recovery across invalid authority',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'an actor outside the owning tenant cannot tell the entry exists (NOT_FOUND)',
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
            title: 'an absent source revision is concealed as NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'a revision that belongs to another entry is concealed as NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'an ownership or authority assertion has no request slot and is refused',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-routes.test.ts',
            title:
              'CMS-03B-04 protected revision-restore route rejects invalid origin, path IDs, media, headers, CSRF, and body',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-production.test.ts',
            title:
              'CMS-03B-04 production restore port (RED: seam still returns 503) rejects caller-supplied authority keys with 422 and no RPC call',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-restore-submit.test.ts',
            title:
              'submitCmsEditorialRestoreForm never relays an upstream message or details for an untyped refusal',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > concealment: another member is denied (403), an outsider and an absent entry are one 404, and neither sees a revision',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'concurrency',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'a stale expectedVersion fails the restore CAS with the typed VERSION_MISMATCH (P0001; cascade P2-S10-AC-025, was the 40001 serialization failure)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'a new key with the pre-restore entry version fails the entry-version CAS across a real chain (typed VERSION_MISMATCH, P0001; cascade P2-S10-AC-025, was 40001)',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-03 compare and CMS-03B-04 restore through the real stack [P2-S10-AC-025] a stale entry version is a definite 409 conflict, never a retryable 503',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'a lost-response replay returns the first envelope after the entry advanced, with no second revision, event, audit row or reservation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'the idempotency business hash binds the migration chain: the same key with another chain is IDEMPOTENCY_MISMATCH',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-03 compare and CMS-03B-04 restore through the real stack [P2-S10-AC-022] [P2-S10-AC-027] restoring the first revision creates one new draft with the chain from the compare read, and an exact-key replay adds nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-outcome-unknown.test.ts',
            title:
              "outcome-unknown writes (reconcile by same-key replay) 'restore': the Idempotency-Key reaches the Worker byte-for-byte on every replay",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'a failed_retryable reservation re-opens once for the same request and completes with one revision',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > a restore against a stale entry version is a definite refusal that changes nothing',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'revocation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore control: the assigned creator restores the forged source onto the active schema',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore revocation: an actor whose entry assignment was revoked is refused FORBIDDEN',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore revocation: the revoked-assignment restore wrote no revision, value, reservation, manifest, audit or outbox row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore revocation: an actor whose cms grants were revoked is refused FORBIDDEN',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore revocation: the revoked-grant restore wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore revocation: an actor whose organization tenure ended no longer sees the entry (concealed NOT_FOUND)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore revocation: the ended-tenure restore wrote nothing',
          },
        ],
      },
      {
        text: 'deletion',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore deletion: restoring a revision of an archived entry is the typed INVALID_TRANSITION refusal',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore deletion: the archived-entry refusal wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore deletion: restoring on an entry that does not exist is the concealed NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_restore_resolve.sql',
            title:
              'EB restore deletion: the absent-entry refusal wrote nothing',
          },
        ],
      },
      {
        text: 'cascade',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_lifecycle.sql',
            title: 'the restore superseded the conflict it replaced',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc',
            title:
              'one manifest, one revision-created outbox event carrying only identifiers and one audit record are written atomically',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_evidence.sql',
            title:
              'the evidence payload is exactly entry/revision/source ids, the chain id, the chain hash and the edge, value and relation counts',
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
              'no audit row of the entry or its chain carries a migrated value',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_chain_rebind.sql',
            title:
              'restore-chain evidence records only chain identity and safe counts, never migrated values',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_evidence.sql',
            title:
              'the replay emits no second evidence pair, audit row or revision',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-058',
    text: '`CMS-07` Compare/restore revision: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-07` Compare/restore revision: implement Native link/button/form',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialRevisionCompare.test.tsx',
            title:
              'CmsEditorialRestoreForm is an inline review step: a labelled disclosure, a focus-target heading and an explicit cancel',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialRevisionCompare.test.tsx',
            title:
              'CmsEditorialRestoreForm restores the LEFT revision: the source the chain was derived for, never the right side',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialRevisionCompare.test.tsx',
            title:
              'CmsEditorialRestoreForm submits the read-derived chain and the current version, and states the consequence',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialRevisionHistory.test.tsx',
            title:
              'CmsEditorialRevisionHistory lists each revision as text with a compare link whose name is unique per row',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialRevisionHistory.test.tsx',
            title:
              'CmsEditorialRevisionHistory names its list heading as a focus target and binds the GET filter to it',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialRevisionHistory.test.tsx',
            title:
              'CmsEditorialRevisionHistory continues with the signed cursor in a named navigation',
          },
          {
            tool: 'vitest',
            file: 'tests/accessibility/phase-02-slice-10-editorial-axe.test.ts',
            title:
              'Slice 10 editorial surfaces: axe history, comparison with the restore review open, and the restore-unavailable state',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-keyboard-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 keyboard-only real route > history: compare with Enter, open the restore review with Enter, cancel with Escape, then confirm with Enter',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'focus stays until navigation or named result heading',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'restore review disclosure moves focus to the confirmation heading when the review opens',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'restore review disclosure closes on Escape before any commit and returns focus to the summary',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'installCmsEditorialPageActions navigation opens the restored draft on its APP route and leaves the one-shot heading-focus mark',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'installCmsEditorialPageActions navigation announces the refusal and does not navigate when the restore is refused',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialRevisionCompare.test.tsx',
            title:
              'CmsEditorialRevisionCompare: domains and counts names the comparison heading as a focus target and groups changes field, block, relation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/route-heading-focus.test.ts',
            title:
              '[P2-S09-AC-1232] one-shot result heading focus [P2-S09-AC-1232] focuses the heading once after a marked commit and then forgets the mark',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/ev-eb-focus-gaps.test.tsx',
            title:
              'focus: the activated submit control stays enabled while the command is in flight AC-058: the restore confirmation button is not disabled while the restore is in flight',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-submit-focus.test.tsx',
            title:
              'restore confirmation: Confirm restore stays put while the restore is in flight is aria-busy rather than disabled, and a repeated submit sends one request',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-submit-focus.test.tsx',
            title:
              'restore confirmation: Confirm restore stays put while the restore is in flight releases the form and moves focus to the failure summary when the restore is refused (FE03 :2599)',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-keyboard-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 keyboard-only real route > history: compare with Enter, open the restore review with Enter, cancel with Escape, then confirm with Enter',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'Server-derived actor/context/capability, valid Zod input, required ETag/idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-restore-submit.test.ts',
            title:
              'submitCmsEditorialRestoreForm sends the real restore command with JSON, CSRF, idempotency, and If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-restore-submit.test.ts',
            title:
              'submitCmsEditorialRestoreForm refuses a missing expectedVersion before any network call',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-routes.test.ts',
            title:
              'CMS-03B-04 protected revision-restore route rejects mismatched path/body identities and validator before mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/restore-production.test.ts',
            title:
              'CMS-03B-04 production restore port (RED: seam still returns 503) binds the restore port to cms_restore_revision with server-derived context',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/revision-restore.test.ts',
            title:
              'CMS-03B-04 revision restore request requires JSON, an idempotency key, and an exact strong If-Match',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'a restore without an Idempotency-Key is refused before any read or write',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'Render authoritative response/version/',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client: a forged or unverifiable 201 is never adopted and the same key is kept for the retry EB restore forged 201 control: the verified 201 is adopted with its strong ETag and the retained key is cleared',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'provenance',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.facts.test.tsx',
            title:
              'editor island: the result of the command that opened it (create, resolve, restore) states a restore: new draft, version, the lineage (parents and migration chain) and the next action',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'installCmsEditorialPageActions navigation leaves the restored lineage (parents, migration chain, edge count) and the new version for the entry page',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: '/next action',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore page action: announced status, retained input and a lock that is always released EB restore announce: an accepted restore announces a polite status, navigates once to the restored entry and leaves the focus mark',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'announce status',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialRevisionCompare.test.tsx',
            title:
              'CmsEditorialRevisionCompare: domains and counts announces the change count politely, with the count per domain',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'installCmsEditorialPageActions navigation announces the refusal and does not navigate when the restore is refused',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore page action: announced status, retained input and a lock that is always released EB restore announce: an accepted restore announces a polite status, navigates once to the restored entry and leaves the focus mark',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore page action: announced status, retained input and a lock that is always released EB restore announce: an unknown outcome shows a focused failure summary with the exact-retry recovery, does not navigate and keeps the request key on the form',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore page action: announced status, retained input and a lock that is always released EB restore announce: a definite refusal shows a focused failure summary with its fixed copy and releases the form with its hidden input unchanged',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > a restore against a stale entry version is a definite refusal that changes nothing',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'Map exact `ApiError`',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status EB restore ApiError 400 INVALID_REQUEST: keeps the code and request id, never relays the upstream text, retryable=false outcomeUnknown=false',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status EB restore ApiError 401 UNAUTHENTICATED: keeps the code and request id, never relays the upstream text, retryable=false outcomeUnknown=false',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status EB restore ApiError 403 FORBIDDEN: keeps the code and request id, never relays the upstream text, retryable=false outcomeUnknown=false',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status EB restore ApiError 404 NOT_FOUND: keeps the code and request id, never relays the upstream text, retryable=false outcomeUnknown=false',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status EB restore ApiError 409 CONFLICT: keeps the code and request id, never relays the upstream text, retryable=false outcomeUnknown=false',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status EB restore ApiError 415 UNSUPPORTED_MEDIA_TYPE: keeps the code and request id, never relays the upstream text, retryable=false outcomeUnknown=false',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status EB restore ApiError 422 VALIDATION_FAILED: keeps the code and request id, never relays the upstream text, retryable=false outcomeUnknown=false',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status EB restore ApiError 429 RATE_LIMITED: keeps the code and request id, never relays the upstream text, retryable=true outcomeUnknown=false',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status EB restore ApiError 502 DEPENDENCY_UNAVAILABLE: keeps the code and request id, never relays the upstream text, retryable=true outcomeUnknown=true',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status EB restore ApiError 503 DEPENDENCY_UNAVAILABLE: keeps the code and request id, never relays the upstream text, retryable=true outcomeUnknown=true',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status EB restore ApiError 504 GATEWAY_TIMEOUT: keeps the code and request id, never relays the upstream text, retryable=true outcomeUnknown=true',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status EB restore ApiError: a typed 409 reason shows its own fixed copy, different from the generic conflict copy',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status EB restore ApiError: an unregistered reason code is dropped and the status copy is used',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status EB restore ApiError: a lost response is an unknown outcome that keeps the key for the exact-key retry',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > a restore against a stale entry version is a definite refusal that changes nothing',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'retain input',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore page action: announced status, retained input and a lock that is always released EB restore announce: a definite refusal shows a focused failure summary with its fixed copy and releases the form with its hidden input unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore page action: announced status, retained input and a lock that is always released EB restore announce: while the command is in flight the form is busy and its controls are disabled, and a second submit does not send a second request',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > a restore against a stale entry version is a definite refusal that changes nothing',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'focus summary/field',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'restore confirmation: typed failures and the scoped draft a 409 focuses a summary inside the form, keeps the source untouched and re-enables the confirm control',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'restore confirmation: typed failures and the scoped draft a 403 focuses a summary inside the form, keeps the source untouched and re-enables the confirm control',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'restore confirmation: typed failures and the scoped draft a 404 focuses a summary inside the form, keeps the source untouched and re-enables the confirm control',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'restore confirmation: typed failures and the scoped draft a 422 focuses a summary inside the form, keeps the source untouched and re-enables the confirm control',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'restore confirmation: typed failures and the scoped draft a 503 focuses a summary inside the form, keeps the source untouched and re-enables the confirm control',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'restore confirmation: typed failures and the scoped draft a repeated failure replaces the summary instead of stacking another',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-submit-focus.test.tsx',
            title:
              'restore confirmation: Confirm restore stays put while the restore is in flight releases the form and moves focus to the failure summary when the restore is refused (FE03 :2599)',
          },
        ],
      },
      {
        text: 'reconcile unknown mutation before retry',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-restore-submit.test.ts',
            title:
              'submitCmsEditorialRestoreForm retains a key when the command response is lost',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-outcome-unknown.test.ts',
            title:
              "outcome-unknown writes (reconcile by same-key replay) 'restore': transport loss is an unknown outcome the client must replay with the same key",
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-outcome-unknown.test.ts',
            title:
              "outcome-unknown writes (reconcile by same-key replay) 'restore': an unverifiable 2xx is an unknown outcome, never a success",
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-outcome-unknown.test.ts',
            title:
              "outcome-unknown writes (reconcile by same-key replay) 'restore': a post-dispatch 5xx is unknown, a definite refusal is not",
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-outcome-unknown.test.ts',
            title:
              "outcome-unknown writes (reconcile by same-key replay) 'restore': the Idempotency-Key reaches the Worker byte-for-byte on every replay",
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
              'a lost-response replay returns the first envelope after the entry advanced, with no second revision, event, audit row or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client: a forged or unverifiable 201 is never adopted and the same key is kept for the retry EB restore forged 201: a resource of another entry is an unknown outcome that keeps the idempotency key and is not adopted',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client: a forged or unverifiable 201 is never adopted and the same key is kept for the retry EB restore forged 201: the source revision id itself is an unknown outcome that keeps the idempotency key and is not adopted',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client: a forged or unverifiable 201 is never adopted and the same key is kept for the retry EB restore forged 201: a published revision is an unknown outcome that keeps the idempotency key and is not adopted',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client: a forged or unverifiable 201 is never adopted and the same key is kept for the retry EB restore forged 201: a revision that names a conflict is an unknown outcome that keeps the idempotency key and is not adopted',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client: a forged or unverifiable 201 is never adopted and the same key is kept for the retry EB restore forged 201: a Location on another origin is an unknown outcome that keeps the idempotency key and is not adopted',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client: a forged or unverifiable 201 is never adopted and the same key is kept for the retry EB restore forged 201: a Location of another revision is an unknown outcome that keeps the idempotency key and is not adopted',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client: a forged or unverifiable 201 is never adopted and the same key is kept for the retry EB restore forged 201: a Location with a query is an unknown outcome that keeps the idempotency key and is not adopted',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client: a forged or unverifiable 201 is never adopted and the same key is kept for the retry EB restore forged 201: an ETag that is not the committed entry version is an unknown outcome that keeps the idempotency key and is not adopted',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client: a forged or unverifiable 201 is never adopted and the same key is kept for the retry EB restore forged 201: a weak ETag is an unknown outcome that keeps the idempotency key and is not adopted',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client: a forged or unverifiable 201 is never adopted and the same key is kept for the retry EB restore forged 201: a response that is not no-store is an unknown outcome that keeps the idempotency key and is not adopted',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts',
            title:
              'EB restore client: a forged or unverifiable 201 is never adopted and the same key is kept for the retry EB restore forged 201: an unparseable body is an unknown outcome that keeps the idempotency key and is not adopted',
          },
        ],
      },
      {
        text: 'URL for navigation/filter',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialRevisionHistory.test.tsx',
            title:
              'CmsEditorialRevisionHistory carries the URL-owned filter selection into the native controls',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialRevisionHistory.test.tsx',
            title:
              'CmsEditorialRevisionHistory links comparison at the first page with the filters kept and the cursor dropped',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-revision-history-page.test.ts',
            title:
              'loadRevisionHistoryPage returns an expired session to this page with its URL-owned state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-revision-history-page.test.ts',
            title:
              'loadRevisionHistoryPage restarts a stale cursor from the first page',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-history-read.test.ts',
            title:
              'CMS-03B-03 first-party revision-history read omits empty optional filters from a native GET form',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'scoped draft before commit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'restore confirmation: typed failures and the scoped draft re-opens the kept confirmation on the same record after navigation, reuses the key, and submits nothing by itself',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'restore confirmation: typed failures and the scoped draft forgets the draft when the author cancels',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'restore confirmation: typed failures and the scoped draft forgets the draft when the restore succeeds',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'restore confirmation: typed failures and the scoped draft leaves no draft behind for a definite refusal',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'restore confirmation: typed failures and the scoped draft an unconfirmed attempt keeps the idempotency key and a scoped draft, and says the retry cannot restore twice',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'restore confirmation: typed failures and the scoped draft does not reuse the key once the entry version changed meanwhile',
          },
        ],
      },
      {
        text: 'server after success',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/lib/cms-editorial-page-actions-core.test.ts',
            title:
              'installCmsEditorialPageActions navigation opens the restored draft on its APP route and leaves the one-shot heading-focus mark',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-restore-submit.test.ts',
            title:
              'submitCmsEditorialRestoreForm sends the real restore command with JSON, CSRF, idempotency, and If-Match',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-03 compare and CMS-03B-04 restore through the real stack [P2-S10-AC-022] [P2-S10-AC-027] restoring the first revision creates one new draft with the chain from the compare read, and an exact-key replay adds nothing',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 revision history real route > compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id',
            project: 'real-route-chrome',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-059',
    text: 'Execute Contract → QA-RED → data, API, SSR and island implementation → QA-GREEN → refactor; retain failing-test evidence and run canonical validation.',
    clauses: [
      {
        text: 'Execute Contract → QA-RED → data, API, SSR and island implementation → QA-GREEN → refactor;',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-process-record.test.ts',
            title:
              'Slice 10 process record (P2-S10-AC-059) every required work package records its contract first, then a RED entry with an observed failure, then GREEN',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-process-record.test.ts',
            title:
              'Slice 10 process record (P2-S10-AC-059) the required work packages cover the data, API, SSR and island layers and at least three record a refactor',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-process-record.test.ts',
            title:
              'Slice 10 process record (P2-S10-AC-059) refuses a record that drops a work package, a RED line, a GREEN line, an observed failure or the contract line',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-process-record.test.ts',
            title:
              'Slice 10 process record (P2-S10-AC-059) refuses a GREEN written before the RED and a contract line that names a file that does not exist',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-process-record.test.ts',
            title:
              'Slice 10 process record (P2-S10-AC-059) refuses a layer that no required work package covers and a record with fewer than three refactors',
          },
        ],
      },
      {
        text: 'retain failing-test evidence',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-process-record.test.ts',
            title:
              'Slice 10 process record (P2-S10-AC-059) the red-green record exists, names its eight lane-report sources and carries the canonical validate line',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-process-record.test.ts',
            title:
              'Slice 10 process record (P2-S10-AC-059) every RED identity named by the record still exists as a test title in its file',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-process-record.test.ts',
            title:
              'Slice 10 process record (P2-S10-AC-059) refuses a RED identity that was renamed, whose quotes are gone, or whose file is gone',
          },
        ],
      },
      {
        text: 'and run',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-process-record.test.ts',
            title:
              'Slice 10 process record (P2-S10-AC-059) the canonical-validate line records pnpm validate exit 0 with its date and every gate count, and the tracker carries the same date',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-process-record.test.ts',
            title:
              'Slice 10 process record (P2-S10-AC-059) refuses the old placeholder, a non-zero exit, a missing date or count, a run before the record and a tracker without the closure date',
          },
        ],
      },
      {
        text: 'canonical validation.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-process-record.test.ts',
            title:
              'Slice 10 process record (P2-S10-AC-059) pnpm validate contains every canonical gate',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-process-record.test.ts',
            title:
              'Slice 10 process record (P2-S10-AC-059) the Slice 10 evidence guard runs inside the vitest gate of pnpm validate',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-process-record.test.ts',
            title:
              'Slice 10 process record (P2-S10-AC-059) refuses a validate without the vitest gate, a filtered vitest gate, an unconfigured guard and a skipped guard',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-060',
    text: 'Update slice tracking, feature-ledger assignments, applicable runbooks, and architecture graph in the same change; leave no unresolved implementation boundary or undocumented drift.',
    clauses: [
      {
        text: 'Update slice tracking',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-closeout-gaps.test.ts',
            title:
              'EB closeout gaps: Slice 10 implementation boundaries and records EB-AC059: the slice tracker records the ordered Contract, QA RED, BE, FE, QA GREEN gate as checked',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts',
            title:
              'EB closeout: Slice 10 documentation and registry agreement EB closeout tracking: all six Slice 10 gate lines are checked and the tracker carries the dated continuation and Depth Ratio',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts',
            title:
              'EB closeout: Slice 10 documentation and registry agreement EB closeout tracking: the progress checker reports slice, phase and index agreement with no drift',
          },
        ],
      },
      {
        text: 'feature-ledger assignments',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts',
            title:
              'EB closeout: Slice 10 documentation and registry agreement EB closeout feature ledger: exactly features 25.02.01 and 25.02.02 are assigned to P2-S10, complete in IA/BE/FE, and the phase plan lists the same two',
          },
        ],
      },
      {
        text: 'applicable runbooks',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts',
            title:
              'EB closeout: Slice 10 documentation and registry agreement EB closeout runbook: docs/runbooks/platform/cms-editorial.md documents every Slice 10 operation with its RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts',
            title:
              'EB closeout: Slice 10 documentation and registry agreement EB closeout runbook: the cms-editorial runbook triages every typed comparison and restore refusal',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/platform-registries-editorial-runbook.test.ts',
            title:
              'platform registry: the Slice 10 editorial routes name the cms-editorial runbook CMS-03B-04 points at the cms-editorial runbook',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/platform-registries-editorial-runbook.test.ts',
            title:
              'platform registry: the Slice 10 editorial routes name the cms-editorial runbook CMS-03B-11 points at the cms-editorial runbook',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/platform-registries-editorial-runbook.test.ts',
            title:
              'platform registry: the Slice 10 editorial routes name the cms-editorial runbook names only runbooks that exist in the repository',
          },
        ],
      },
      {
        text: 'architecture graph',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts',
            title:
              'EB closeout: Slice 10 documentation and registry agreement EB closeout: the compiled specification graph equals the graph rebuilt from the committed Slice 10 spec text',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts',
            title:
              'EB closeout: Slice 10 documentation and registry agreement EB closeout architecture map: the Slice 10 delta names all nine operations and every repository path it cites exists',
          },
        ],
      },
      { text: 'in the same change;', citations: [] },
      {
        text: 'leave no unresolved implementation boundary',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts',
            title:
              'EB closeout: Slice 10 documentation and registry agreement EB closeout: no unresolved implementation boundary marker remains in the Slice 10 production sources',
          },
        ],
      },
      {
        text: 'undocumented drift.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts',
            title:
              'EB closeout: Slice 10 documentation and registry agreement EB closeout contracts: the committed OpenAPI document equals the one generated from the route registry (no undocumented drift)',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts',
            title:
              'EB closeout: Slice 10 documentation and registry agreement EB closeout architecture map: the Slice 10 delta names all nine operations and every repository path it cites exists',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts',
            title:
              'EB closeout: Slice 10 documentation and registry agreement EB closeout runbook: docs/runbooks/platform/cms-editorial.md documents every Slice 10 operation with its RPC',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "in the same change". The Slice 10 work is uncommitted in the integration checkout, so no test can show that the tracking, feature-ledger, runbook and architecture-graph updates land in one change with the code; that is shown by the commit or pull request. Everything else is proven as records that agree with the code at the closure of 2026-10-08: the six tracker gate lines are checked in order with the dated continuation and Depth Ratio, the progress checker reports no drift, the feature ledger assigns exactly 25.02.01 and 25.02.02, the runbook documents every operation and typed refusal, docs/ARCHITECTURE.md names the nine operations with every cited path existing, the compiled specification graph is no older than the Slice 10 spec amendments (compiled by the orchestrator), no BOUNDARY:, TODO, FIXME, unimplemented or unwired marker remains in the Slice 10 production sources (lane N removed the stale boundary module and constants), and the generated OpenAPI document, the runbook operation/RPC/typed-reason list and the architecture-map path references show no undocumented drift.',
  },
  {
    criterion: 'P2-S10-AC-061',
    text: 'CMS-03B-10 initial-entry create: define strict Zod request, header, and success contracts; POST /api/v1/cms/entries atomically creates an active entry and attributable first draft revision, returning 201 EntryCreateResource without requiring an existing base revision.',
    clauses: [
      {
        text: 'CMS-03B-10 initial-entry create: define strict Zod request, header, and success contracts;',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-create.test.ts',
            title:
              'cms entry create body (CMS-03B-10) rejects unknown keys and every caller-supplied authority field',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-create.test.ts',
            title:
              'cms entry create transport and success requires JSON plus an idempotency key and never an If-Match',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-create.test.ts',
            title:
              'cms entry create transport and success returns entry plus first revision with closed lifecycle state',
          },
        ],
      },
      {
        text: 'POST /api/v1/cms/entries',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-061] [P2-S10-AC-066] the projection round-trips into a create that commits the entry, first revision, audit and outbox exactly once',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes.test.ts',
            title:
              'CMS-03B-10 entry create route row binds create schemas, 201, a strong ETag, and Location',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route creates an active entry with first draft, scoped rate limits, ETag, and Location',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'atomically',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity: after the outbox fault no entry, revision, value, relation, assignment, reservation, audit or outbox row survives',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity: after the audit fault no entry, revision, value, relation, assignment, reservation, audit or outbox row survives',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity: the committed state after both faulted creates equals the state before them',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity rollback: the outbox fault raised after the four inserts leaves the committed state equal to the state before the create',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity rollback: the audit fault raised after the four inserts leaves the committed state equal to the state before the create',
          },
        ],
      },
      {
        text: 'creates an active entry',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-061] [P2-S10-AC-066] the projection round-trips into a create that commits the entry, first revision, audit and outbox exactly once',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-094] the entry list returns the entry with its lifecycle and a page ETag',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title:
              'CMS-03B-10 atomically owns and points the active entry at its first draft',
          },
        ],
      },
      {
        text: 'attributable first draft revision',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create attribution: the first revision author is the canonical person of the session actor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create attribution: the first revision acting party is the acting organization of the session',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create attribution: the audit event names the session actor and the acting party',
          },
        ],
      },
      {
        text: 'returning 201 EntryCreateResource without requiring an existing base revision.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-061] [P2-S10-AC-066] the projection round-trips into a create that commits the entry, first revision, audit and outbox exactly once',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title: 'CMS-03B-10 returns initial immutable revision number one',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title: 'CMS-03B-10 returns draft state rather than publication',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-062',
    text: 'CMS-03B-10: reject unknown fields, malformed IDs, off-registry schema or values, invalid locale, and oversized payloads with stable field violations and no mutation.',
    clauses: [
      {
        text: 'CMS-03B-10: reject unknown fields',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-062] an unknown field is refused with a bounded pointer and nothing is written, at the proxy and at the Worker',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route rejects caller authority and If-Match before mutation',
          },
        ],
      },
      {
        text: 'malformed IDs',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a malformed contentTypeId is pointed at /contentTypeId',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a malformed contentTypeVersionId is pointed at /contentTypeVersionId',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-proxies.test.ts',
            title:
              'cms-editorial create proxy (CMS-03B-10) rejects a schema-invalid body before it can reach upstream',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: a malformed contentTypeId is VALIDATION_FAILED at /contentTypeId',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: the malformed-contentTypeId refusal wrote no entry, revision, value, assignment, reservation, audit or outbox row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: a malformed contentTypeVersionId is VALIDATION_FAILED at /contentTypeVersionId',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: the malformed-contentTypeVersionId refusal wrote nothing',
          },
        ],
      },
      {
        text: 'off-registry schema',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a mismatching schema artifact is pointed at /schemaArtifact',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002b-create-owner-conceal.sqlinc',
            title:
              'CMS-03B-10 conceals a foreign active version before artifact or policy lookup',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_protected_validator_freeze.sql',
            title:
              'when the artifact froze no validator although its definition uses the grammar every editorial transition is DEPENDENCY_UNAVAILABLE [DEC-146, AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: a schema artifact whose hash is not the compiled artifact of the version is VALIDATION_FAILED at /schemaArtifact',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: the off-registry-schema refusal wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: forged activation evidence is VALIDATION_FAILED at /activationEvidence',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: the forged-activation-evidence refusal wrote nothing',
          },
        ],
      },
      {
        text: 'values',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title:
              'CMS-03B-10 refuses wrong-kind field values before policy lookup',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title: 'CMS-03B-10 refuses authored JSON null before policy lookup',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a value keyed by a UUID that is no field of the version is pointed at that field pointer',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: a value keyed by an id that is no field of the version is VALIDATION_FAILED at that field pointer',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: the unknown-field-value refusal wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: a boolean value in a short_text field is VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: the wrong-kind-value refusal wrote nothing',
          },
        ],
      },
      {
        text: 'invalid locale',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title: 'create: a malformed locale is pointed at /locale',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a locale outside the active schema locale set is pointed at /locale',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: a malformed locale is VALIDATION_FAILED at /locale',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: the malformed-locale refusal wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: a well-formed locale outside the active schema locale set is VALIDATION_FAILED at /locale',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: the out-of-set-locale refusal wrote nothing',
          },
        ],
      },
      {
        text: 'oversized payloads with stable field violations',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create values bound: 129 value keys are refused VALIDATION_FAILED at /values',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title: 'EB create values bound: the 129-key refusal wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create values bound: a values tree nested past 8 levels is refused at /values',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create values bound: a values payload over 262144 bytes is refused at /values',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create values bound: the oversized-payload refusal wrote nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create.test.ts',
            title:
              'EB create values bound (AC-062) EB create values bound: 129 value keys answer 422 VALIDATION_FAILED pointing at /values and the RPC is never called',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create.test.ts',
            title:
              'EB create values bound (AC-062) EB create values bound: a values tree past 8 container levels answers 422 pointing at /values and the RPC is never called',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create.test.ts',
            title:
              'EB create values bound (AC-062) EB create values bound: a values payload over 256 KiB is stopped at the 256 KiB body ceiling as 400 INVALID_REQUEST and the RPC is never called',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title: 'EB create values bound: the nesting refusal wrote nothing',
          },
        ],
      },
      {
        text: 'no mutation.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-062] an unknown field is refused with a bounded pointer and nothing is written, at the proxy and at the Worker',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route rejects caller authority and If-Match before mutation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title:
              'CMS-03B-10 fail-closed create persists no entry (only the seeded draft exists)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_entry: every typed refusal committed no entry, revision, value, conflict, reservation, outbox or audit row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: the malformed-contentTypeId refusal wrote no entry, revision, value, assignment, reservation, audit or outbox row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: the malformed-locale refusal wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: the off-registry-schema refusal wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: the forged-activation-evidence refusal wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: the unknown-field-value refusal wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: the wrong-kind-value refusal wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create authority: the ownerId-carrying create wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title: 'EB create values bound: the 129-key refusal wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title: 'EB create values bound: the nesting refusal wrote nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create values bound: the oversized-payload refusal wrote nothing',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-063',
    text: 'CMS-03B-10: derive actor, acting party, owner, capability, and initial assignment server-side; require authorized CMS author/editor and active compiled schema; preserve policy-safe 401/403/404 and RLS boundaries.',
    clauses: [
      {
        text: 'CMS-03B-10: derive actor, acting party, owner,',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-create.test.ts',
            title:
              'cms entry create body (CMS-03B-10) rejects unknown keys and every caller-supplied authority field',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-062] an unknown field is refused with a bounded pointer and nothing is written, at the proxy and at the Worker',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title:
              'CMS-03B-10 atomically owns and points the active entry at its first draft',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title:
              'CMS-03B-10 assigns the canonical creator person without caller authority',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create attribution: the initial assignee is the canonical person of the session actor',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create.test.ts',
            title:
              'EB create port binding (AC-063, AC-066) EB create context: actor and acting party are the verified session ids and the capability is never forwarded',
          },
        ],
      },
      {
        text: 'capability, and initial assignment',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_editor.sql',
            title:
              'EB editor creator: the initial assignment of an editor-only creator carries the capability the creator exercised (cms.editor)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_editor.sql',
            title:
              'EB editor creator: an editor-only creator can append a revision to the entry they just created',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_editor.sql',
            title:
              'EB editor creator: an editor-only creator can read the draft of the entry they just created',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_editor.sql',
            title:
              'EB editor creator control: the initial assignment of an author creator carries cms.author',
          },
        ],
      },
      {
        text: 'server-side;',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create.test.ts',
            title:
              'EB create port binding (AC-063, AC-066) EB create context: actor and acting party are the verified session ids and the capability is never forwarded',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create.test.ts',
            title:
              'EB create port binding (AC-063, AC-066) EB create authority: a body naming capability is a 422 unknown_field violation and never reaches the RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create.test.ts',
            title:
              'EB create port binding (AC-063, AC-066) EB create authority: a body naming ownerId is a 422 unknown_field violation and never reaches the RPC',
          },
        ],
      },
      {
        text: 'require authorized CMS author/editor',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '403 and concealment decided by the database for other principals [P2-S10-AC-006] [P2-S10-AC-012] a confirmed member holding no CMS grant is a 403, and nothing is written',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route fails closed without a production port or author capability',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title:
              'CMS-03B-10 create without a registered grant returns FORBIDDEN',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create capability: an actor holding only the cms.editor grant creates an entry',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create capability: a confirmed member holding neither cms.author nor cms.editor is refused FORBIDDEN',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title: 'EB create capability: the FORBIDDEN create wrote nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create.test.ts',
            title:
              'EB create capability (AC-063) EB create capability: a session holding only cms.editor creates with a 201 and reaches the RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create.test.ts',
            title:
              'EB create capability (AC-063) EB create capability: a session holding only cms.reviewer is a 403 CAPABILITY_REQUIRED and never reaches the RPC',
          },
        ],
      },
      {
        text: 'active',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create active schema: a draft content type version is refused VALIDATION_FAILED at /contentTypeVersionId',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create active schema: an approved but not yet active content type version is refused at /contentTypeVersionId',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create active schema: a superseded content type version is refused at /contentTypeVersionId',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create active schema: a retired content type version is refused at /contentTypeVersionId',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create active schema control: the same request against the active version is accepted',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create active schema: an absent content type version is the concealed NOT_FOUND',
          },
        ],
      },
      {
        text: 'compiled schema;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a mismatching schema artifact is pointed at /schemaArtifact',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_protected_validator_freeze.sql',
            title:
              'when the artifact froze no validator although its definition uses the grammar every editorial transition is DEPENDENCY_UNAVAILABLE [DEC-146, AC-085]',
          },
        ],
      },
      {
        text: 'preserve policy-safe 401/403/404',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/be00-middleware-order.test.ts',
            title:
              'BE00 middleware order on the CMS editorial human routes CMS-03B-10 entry create cms-editorial: step 5 (authentication) wins over every later step',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title:
              'CMS-03B-10 create without an authenticated actor returns UNAUTHENTICATED',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '403 and concealment decided by the database for other principals [P2-S10-AC-006] [P2-S10-AC-012] a confirmed member holding no CMS grant is a 403, and nothing is written',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002b-create-owner-conceal.sqlinc',
            title:
              'CMS-03B-10 conceals a foreign active version before artifact or policy lookup',
          },
        ],
      },
      {
        text: 'RLS boundaries.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_schema/003-security-and-indexes.sqlinc',
            title: 'P2-S10-AC-006 every editorial table enables and forces RLS',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_schema/003-security-and-indexes.sqlinc',
            title:
              'P2-S10-AC-006 every editorial table is reachable only inside CMS RPC context',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_schema/003-security-and-indexes.sqlinc',
            title:
              'P2-S10-AC-013 browser and service roles receive no direct table grants',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title: 'P2-S10-RPC cms_create_entry is service_role-only',
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
    criterion: 'P2-S10-AC-064',
    text: 'CMS-03B-10: require Idempotency-Key and exact create preconditions, reject duplicate/conflicting keys, and replay the same entry/revision result without a second effect; do not require update-only If-Match for a nonexistent entry.',
    clauses: [
      {
        text: 'CMS-03B-10: require Idempotency-Key',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route rejects disallowed origin, media, missing key, and failed cookie CSRF',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/be00-middleware-order.test.ts',
            title:
              'BE00 middleware order on the CMS editorial human routes CMS-03B-10 entry create cms-editorial: step 10 (idempotency key) wins over every later step',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-proxies.test.ts',
            title:
              'cms-editorial create proxy (CMS-03B-10) requires a bounded idempotency key',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-10 entry create: a missing key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-10 entry create: a 7 characters key is 400 INVALID_REQUEST and the port is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-headers.test.ts',
            title:
              'EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route EB idempotency key CMS-03B-10 entry create: a key of exactly 8 characters reaches the port',
          },
        ],
      },
      {
        text: 'exact create preconditions',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route rejects caller authority and If-Match before mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-proxies-hardening-create.test.ts',
            title:
              'cms-editorial create proxy header tuple (CMS-03B-10) refuses a supplied If-Match instead of silently dropping it',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes.test.ts',
            title:
              'CMS-03B-10 entry create route row requires Idempotency-Key, never If-Match, and the Tier 2 command SLO',
          },
        ],
      },
      {
        text: 'reject duplicate/conflicting keys',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-064] the same key with another body is the database 409 IDEMPOTENCY_MISMATCH and adds nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title:
              'CMS-03B-10 reused key with changed body returns the 409-mapped RPC token',
          },
        ],
      },
      {
        text: 'replay the same entry/revision result without a second effect;',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-061] [P2-S10-AC-066] the projection round-trips into a create that commits the entry, first revision, audit and outbox exactly once',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title:
              'CMS-03B-10 exact-key retry returns the same entry and revision resource',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title: 'CMS-03B-10 exact-key retry adds no second revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title: 'CMS-03B-10 exact-key retry adds no second outbox event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title:
              'CMS-03B-10 trace-only retry replays the original entry and revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_relation_authoring.sql',
            title:
              'a replay of the create returns the stored first response [BE03b idempotency]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_relation_authoring.sql',
            title:
              'the replay writes no entry, revision, value, relation, outbox or audit row',
          },
        ],
      },
      {
        text: 'do not require update-only If-Match for a nonexistent entry.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-061] [P2-S10-AC-066] the projection round-trips into a create that commits the entry, first revision, audit and outbox exactly once',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route creates an active entry with first draft, scoped rate limits, ETag, and Location',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes.test.ts',
            title:
              'cms editorial route registry keeps every command row on headers and every read row on query',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-065',
    text: 'CMS-03B-10: map validation, capability, schema, rate, dependency, deadline, and internal failures to BE00 ApiError with safe recovery; no entry or first revision remains after a failed transaction.',
    clauses: [
      {
        text: 'CMS-03B-10: map validation',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-062] an unknown field is refused with a bounded pointer and nothing is written, at the proxy and at the Worker',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/be00-middleware-order.test.ts',
            title:
              'BE00 middleware order on the CMS editorial human routes CMS-03B-10 entry create cms-editorial: step 7 (strict body validation) wins over every later step',
          },
        ],
      },
      {
        text: 'capability',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/be00-middleware-order.test.ts',
            title:
              'BE00 middleware order on the CMS editorial human routes CMS-03B-10 entry create cms-editorial: step 8 (capability) wins over every later step',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '403 and concealment decided by the database for other principals [P2-S10-AC-006] [P2-S10-AC-012] a confirmed member holding no CMS grant is a 403, and nothing is written',
          },
        ],
      },
      {
        text: 'schema',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-failures.test.ts',
            title:
              'EB create RPC failure mapping (AC-065) EB create RPC NOT_FOUND: the token is a 404 NOT_FOUND with empty details and none of the private DETAIL or HINT text',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-failures.test.ts',
            title:
              'EB create RPC failure mapping (AC-065) EB create RPC VALIDATION_FAILED: the token with pointer /schemaArtifact is a 422 carrying exactly that safe violation',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-failures.test.ts',
            title:
              'EB create RPC failure mapping (AC-065) EB create RPC DEPENDENCY_UNAVAILABLE: the token is a retryable 503 whose details are the dependency class only',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-limits.test.ts',
            title:
              'EB create limits: rate, dependency and deadline are BE00 ApiErrors with safe recovery EB create rate limit: a denied decision is 429 RATE_LIMITED with Retry-After, a complete ApiError and no RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-limits.test.ts',
            title:
              'EB create limits: rate, dependency and deadline are BE00 ApiErrors with safe recovery EB create rate limit: the user bucket is asked for 120 per minute and the party bucket for 240, each denial stops the create',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/be00-middleware-order.test.ts',
            title:
              'BE00 middleware order on the CMS editorial human routes CMS-03B-10 entry create cms-editorial: step 9 (rate limit) wins over every later step',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-limits.test.ts',
            title:
              'EB create limits: rate, dependency and deadline are BE00 ApiErrors with safe recovery EB create dependency: an unavailable rate limiter fails closed as 503 DEPENDENCY_UNAVAILABLE, a complete ApiError, and never reaches the RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-limits.test.ts',
            title:
              'EB create limits: rate, dependency and deadline are BE00 ApiErrors with safe recovery EB create dependency: an unavailable session service fails closed with a complete ApiError and never reaches the RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-failures.test.ts',
            title:
              'EB create RPC failure mapping (AC-065) EB create RPC DEPENDENCY_UNAVAILABLE: the token is a retryable 503 whose details are the dependency class only',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-failures.test.ts',
            title:
              'EB create RPC failure mapping (AC-065) EB create RPC transport failure: a rejected fetch is a retryable 503 DEPENDENCY_UNAVAILABLE',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/002-create.sqlinc',
            title:
              'CMS-03B-10 authorized create reports DEPENDENCY_UNAVAILABLE, never a synthesized policy match',
          },
        ],
      },
      {
        text: 'deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-limits.test.ts',
            title:
              'EB create limits: rate, dependency and deadline are BE00 ApiErrors with safe recovery EB create deadline: a database that never answers ends the create at the 15 s route budget as 504 GATEWAY_TIMEOUT, a complete ApiError, and aborts the in-flight call',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-limits.test.ts',
            title:
              'EB create limits: rate, dependency and deadline are BE00 ApiErrors with safe recovery EB create deadline: a slow session leaves only the remaining budget to the database call (one cumulative 15 s clock)',
          },
        ],
      },
      {
        text: 'internal failures to BE00 ApiError with safe recovery;',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-failures.test.ts',
            title:
              'EB create RPC failure mapping (AC-065) EB create RPC INTERNAL_ERROR: the token is a scrubbed 500 INTERNAL_ERROR with empty details and no database text',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-failures.test.ts',
            title:
              'EB create RPC failure mapping (AC-065) EB create RPC HTTP 500: a bare 5xx from PostgREST is a retryable 503 DEPENDENCY_UNAVAILABLE with no upstream text',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-failures.test.ts',
            title:
              'EB create RPC failure mapping (AC-065) EB create RPC HTTP 503: a bare 5xx from PostgREST is a retryable 503 DEPENDENCY_UNAVAILABLE with no upstream text',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-failures.test.ts',
            title:
              'EB create RPC failure mapping (AC-065) EB create RPC transport failure: a rejected fetch is a retryable 503 DEPENDENCY_UNAVAILABLE',
          },
        ],
      },
      {
        text: 'no entry or first revision remains after a failed transaction.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity: after the outbox fault no entry, revision, value, relation, assignment, reservation, audit or outbox row survives',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity: after the audit fault no entry, revision, value, relation, assignment, reservation, audit or outbox row survives',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity: the committed state after both faulted creates equals the state before them',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity rollback: the outbox fault raised after the four inserts leaves the committed state equal to the state before the create',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity rollback: the audit fault raised after the four inserts leaves the committed state equal to the state before the create',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-066',
    text: 'CMS-03B-10: commit entry, first revision, normalized values, assignment, audit, idempotency, and outbox atomically; expose only canonical resource metadata and redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03B-10: commit entry, first revision, normalized values, assignment, audit, idempotency, and outbox',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-061] [P2-S10-AC-066] the projection round-trips into a create that commits the entry, first revision, audit and outbox exactly once',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title: 'CMS-03B-10 stores the normalized authored field value',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title:
              'CMS-03B-10 assigns the canonical creator person without caller authority',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title: 'CMS-03B-10 emits exactly one attributable audit event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title:
              'CMS-03B-10 outbox payload names exactly the created entry and revision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/007-create-positive.sqlinc',
            title:
              'CMS-03B-10 exact-key retry returns the same entry and revision resource',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 entry authoring real route > create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'atomically;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity: after the outbox fault no entry, revision, value, relation, assignment, reservation, audit or outbox row survives',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity: after the audit fault no entry, revision, value, relation, assignment, reservation, audit or outbox row survives',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity: the committed state after both faulted creates equals the state before them',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity rollback: the outbox fault raised after the four inserts leaves the committed state equal to the state before the create',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_write.sql',
            title:
              'EB create atomicity rollback: the audit fault raised after the four inserts leaves the committed state equal to the state before the create',
          },
        ],
      },
      {
        text: 'expose only canonical resource metadata',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-create.test.ts',
            title:
              'cms entry create transport and success returns entry plus first revision with closed lifecycle state',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/create-routes.test.ts',
            title:
              'CMS-03B-10 protected initial-entry create route rejects an invalid resource shape and wrong response locale',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-proxies-hardening-create.test.ts',
            title:
              'cms-editorial create proxy 201 validation (CMS-03B-10) refuses a 201 whose body is not the strict create resource',
          },
        ],
      },
      {
        text: 'redacted telemetry.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-failures.test.ts',
            title:
              'EB create redacted telemetry (AC-066) EB create telemetry success: the event names only a hashed entry id and no user, party, entry, revision, title, key or credential',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-failures.test.ts',
            title:
              'EB create redacted telemetry (AC-066) EB create telemetry refusal: a database 409 refusal emits an event with the error code and no identifier, title, key or credential',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-failures.test.ts',
            title:
              'EB create redacted telemetry (AC-066) EB create telemetry validation refusal: a body refused before the RPC does not echo the refused value or any credential into the event',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-create-failures.test.ts',
            title:
              'EB create redacted telemetry (AC-066) EB create telemetry production sink: the structured log lines for a success and a refusal carry none of the forbidden values',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-067',
    text: 'CMS-03B-11 draft-detail read: define strict UUID path/query and 200 EntryDraftDetailResource contract for GET /api/v1/cms/entries/{entryId}, including only authorized current editable values, field provenance, schema identity, and canonical versions. The canonical draft resource includes server-derived `revisionNumber`, `schemaVersionId`, and bounded `openConflict` identity.',
    clauses: [
      {
        text: 'CMS-03B-11 draft-detail read: define strict UUID path/query and 200 EntryDraftDetailResource contract for GET /api/v1/cms/entries/{entryId}',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-draft-detail.test.ts',
            title:
              'cms draft detail addressing (CMS-03B-11) binds exactly one UUID path parameter',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-draft-detail.test.ts',
            title:
              'cms draft detail addressing (CMS-03B-11) accepts an optional locale selection and rejects anything else',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-draft-detail.test.ts',
            title:
              'cms draft detail resource exposes the closed envelope with 128-field and 512-relation bounds',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-entry-openapi.test.ts',
            title:
              'Slice 10 CMS-03B-10/11 canonical OpenAPI authority documents create without If-Match and draft read with UUID/locale parameters',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route returns the exact draft with no-store and a strong entry/revision-bound ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route rejects malformed paths and syntactically invalid locales as 400',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > the assigned author reads the typed draft with its state, and the page is no-store and accessible',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'including only authorized current editable values',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_relation_lineage.sql',
            title:
              'CMS-03B-11 omits a relation whose declaring definition is retired',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_relation_lineage.sql',
            title:
              'CMS-03B-11 retiring a relation definition leaves the active field value',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004-schema-seams.sqlinc',
            title:
              'CMS-03B-11 omit policy excludes the concealed target identifier entirely',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004-schema-seams.sqlinc',
            title:
              'CMS-03B-11 omit policy makes concealed and absent targets equally opaque',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004-schema-seams.sqlinc',
            title:
              'CMS-03B-11 refuses INTERNAL_ERROR when a stored value is not declared by the active schema',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > the assigned author reads the typed draft with its state, and the page is no-store and accessible',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > 403 for a visible entry the caller cannot read, one 404 for a hidden or absent one, 400 for a malformed id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'field provenance',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-draft-detail.test.ts',
            title:
              'cms draft detail field values locks the closed provenance vocabulary',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-draft-detail.test.ts',
            title:
              'cms-editorial draft detail field values locks the closed provenance vocabulary',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > the assigned author reads the typed draft with its state, and the page is no-store and accessible',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'schema identity',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'CMS-03B-11 schemaVersionId is the stored draft schema version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_schema_lineage.sql',
            title:
              'CMS-03B-11 refuses a pinned schema version of another content type',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_schema_lineage.sql',
            title:
              'CMS-03B-11 refuses a pinned schema version of another owner',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_schema_lineage.sql',
            title:
              'CMS-03B-11 refuses a schema version whose compiled artifact hash disagrees',
          },
        ],
      },
      {
        text: 'canonical versions',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read versions: entry.version equals the stored cms_content_entries.version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read versions: revision.version equals the stored cms_entry_revisions.version of the current draft',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read versions: entry.version follows a moved stored entry version (5), it is not a constant',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read versions: revision.version follows a moved stored revision version (7), it is not a constant',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read versions after a committed append: entry.version equals the advanced stored entry version',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > the assigned author reads the typed draft with its state, and the page is no-store and accessible',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'The canonical draft resource includes server-derived `revisionNumber`, `schemaVersionId`, and bounded `openConflict` identity',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'CMS-03B-11 returns revisionNumber, schemaVersionId and openConflict',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'CMS-03B-11 revisionNumber is the stored current draft revision number',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'CMS-03B-11 openConflict carries exactly conflictId, version and conflictHash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'CMS-03B-11 openConflict identity matches the durable open conflict record',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'CMS-03B-11 openConflict exposes no proposed values, resolver or owner',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-draft-detail.test.ts',
            title:
              'cms draft detail resource requires the revision number, active schema version, and a strict nullable open conflict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-088] [P2-S10-AC-090] the draft names the open conflict and CMS-03B-12 serves its three sides',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail refusals: stable ApiError and no fallback content EB draft detail response: a resource missing the server-derived revisionNumber, schemaVersionId or openConflict is not relayed (502)',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > the assigned author reads the typed draft with its state, and the page is no-store and accessible',
            project: 'real-route-chrome',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-068',
    text: 'CMS-03B-11: reject malformed path/query, unsupported body/media, and invalid response values with stable ApiError and no fallback to private or untyped content.',
    clauses: [
      {
        text: 'CMS-03B-11: reject malformed path/query',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route rejects malformed paths and syntactically invalid locales as 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route rejects unknown and duplicate query keys after authentication and before authorization or persistence',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-proxies.test.ts',
            title:
              'cms-editorial draft-detail read proxy (CMS-03B-11) answers a malformed entry id as 400 INVALID_REQUEST without upstream (DEC-145)',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-proxies-hardening-draft-read.test.ts',
            title:
              'cms-editorial draft-detail proxy bounded body (CMS-03B-11) rejects duplicate locale filters before the Worker is reached',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-safe-reads.test.ts',
            title:
              "production port-input admission for the safe reads admits a well-formed 'CMS-03B-11' read and names its refusal",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail refusals: stable ApiError and no fallback content EB draft detail request: a malformed entry id, an unknown query key and an invalid locale are each 400 INVALID_REQUEST',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > 403 for a visible entry the caller cannot read, one 404 for a hidden or absent one, 400 for a malformed id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'unsupported body/media',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route rejects mutation headers, media, and a foreign origin',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-proxies.test.ts',
            title:
              'cms-editorial draft-detail read proxy (CMS-03B-11) rejects mutation preconditions and read body/media claims before forwarding',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-safe-reads.test.ts',
            title:
              "production port-input admission for the safe reads refuses a write header, body, or non-GET method on 'CMS-03B-11'",
          },
        ],
      },
      {
        text: 'invalid response values with stable ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route [P2-S09-AC-203] refuses a target id beside the placeholder marker as invalid dependency data without echoing it',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route rejects an untyped or widened dependency resource without relaying values',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route rejects a dependency draft for another entry or requested locale',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route refuses archived entries and non-draft revision states',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route relays a semantic dependency 422 without widening the structural 400 boundary',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route bounds a stalled draft dependency and scrubs unexpected failures',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004-schema-seams.sqlinc',
            title:
              'CMS-03B-11 refuses a stored value that violates its active field kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004-schema-seams.sqlinc',
            title:
              'CMS-03B-11 refuses a frozen revision hash that disagrees with stored values',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail refusals: stable ApiError and no fallback content EB draft detail response: a resource carrying an extra member is not relayed (502) and no private value reaches the caller',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail refusals: stable ApiError and no fallback content EB draft detail response: a resource missing the server-derived revisionNumber, schemaVersionId or openConflict is not relayed (502)',
          },
        ],
      },
      {
        text: 'no fallback to private or untyped content',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route rejects an untyped or widened dependency resource without relaying values',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-proxies.test.ts',
            title:
              'cms-editorial draft-detail read proxy (CMS-03B-11) refuses a 200 that is not the strict draft resource',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-draft-detail-transport.test.ts',
            title:
              'executeCmsEditorialEntryDraftDetailRead verification rejects a 200 whose body is not a strict EntryDraftDetailResource',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004-schema-seams.sqlinc',
            title:
              'CMS-03B-11 refuses DEPENDENCY_UNAVAILABLE when the pinned schema version is not active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004-schema-seams.sqlinc',
            title:
              'CMS-03B-11 refuses INTERNAL_ERROR when a stored value is not declared by the active schema',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004-schema-seams.sqlinc',
            title:
              'CMS-03B-11 refuses INTERNAL_ERROR when a stored relation is not declared by the active schema',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail refusals: stable ApiError and no fallback content EB draft detail response: a placeholder relation that also names its target is not relayed (502)',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-069',
    text: 'CMS-03B-11: derive session and acting context server-side; require entry-read assignment/capability; return 404 for concealed/absent entry and 403 only for a visible entry lacking assignment or read scope.',
    clauses: [
      {
        text: 'CMS-03B-11: derive session and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route requires a valid human session and author/editor read capability',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route maps thrown or malformed sessions without invoking the draft port',
          },
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
              '403 and concealment decided by the database for other principals [P2-S10-AC-068] [P2-S10-AC-089] a person outside the owning organization cannot tell the entry exists',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail acting context: it is derived from the verified session and never from anything the caller sends EB draft detail context: spoofed acting-party, user and capability headers change nothing: the RPC context is the session',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail acting context: it is derived from the verified session and never from anything the caller sends EB draft detail context: a caller-supplied actingPartyId query member is 400 INVALID_REQUEST and the RPC is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail acting context: it is derived from the verified session and never from anything the caller sends EB draft detail context: a caller-supplied actingContextId query member is 400 INVALID_REQUEST and the RPC is never reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail acting context: it is derived from the verified session and never from anything the caller sends EB draft detail context: the RPC context follows the verified session: two sessions of two parties send two different contexts for the same request',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail 200: protected, bound to the current versions, never cacheable across contexts EB draft detail read: the named read RPC is called once with the session context and without any mutation header or body member',
          },
        ],
      },
      {
        text: 'require entry-read assignment/capability',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read authority control: the editor with grant, tenure and an active assignment reads the draft',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read authority: a grant and tenure holder whose entry assignment is revoked is refused FORBIDDEN with no detail or hint',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read authority: a grant and tenure holder with no assignment row on the entry is refused FORBIDDEN with no detail or hint',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read authority control: the same granted member reads the draft once an active assignment exists, so the assignment alone was missing',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail refusals: stable ApiError and no fallback content EB draft detail 403: a session without cms.author or cms.editor is refused before the RPC is reached',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > 403 for a visible entry the caller cannot read, one 404 for a hidden or absent one, 400 for a malformed id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'return 404 for concealed/absent entry',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'CMS-03B-11 non-member read still conceals the entry as NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/003b-detail-owner-scope.sqlinc',
            title:
              'CMS-03B-11 conceals an entry when assignment and grant owners differ',
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
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route conceals absent entries and scrubs dependency errors',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read concealment: a non-member read and an absent-entry read have the identical SQLSTATE, token, detail and hint',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail refusals: stable ApiError and no fallback content EB draft detail 404: the NOT_FOUND token is a 404 with empty details for both an absent and a concealed entry',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > 403 for a visible entry the caller cannot read, one 404 for a hidden or absent one, 400 for a malformed id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: '403 only for a visible entry lacking assignment',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read authority control: the editor with grant, tenure and an active assignment reads the draft',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read authority: a grant and tenure holder whose entry assignment is revoked is refused FORBIDDEN with no detail or hint',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read authority: a grant and tenure holder with no assignment row on the entry is refused FORBIDDEN with no detail or hint',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read authority control: the same granted member reads the draft once an active assignment exists, so the assignment alone was missing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read concealment: a non-member of the owning tenant is refused NOT_FOUND with no detail or hint',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail refusals: stable ApiError and no fallback content EB draft detail 403: the FORBIDDEN token for a visible entry is a 403 that names no assignment, capability or owner',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > 403 for a visible entry the caller cannot read, one 404 for a hidden or absent one, 400 for a malformed id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'read scope',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/005-history.sqlinc',
            title:
              'CMS-03B-11 reviewer-only refusal has the exact contract token',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route requires a valid human session and author/editor read capability',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route preserves visible 403 denial without exposing assignment evidence',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/cms-editorial-draft-read.test.ts',
            title:
              'CMS-03B-11 local Worker → web proxy → browser read never asks the draft port for values when the principal has no CMS read capability',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-070',
    text: 'CMS-03B-11: bind the read to current entry/revision versions, return a strong authenticated ETag and no-store response, and prohibit mutation headers, browser table grants, and cross-context cache reuse.',
    clauses: [
      {
        text: 'CMS-03B-11: bind the read to current entry/revision versions',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read versions: entry.version equals the stored cms_content_entries.version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read versions: revision.version equals the stored cms_entry_revisions.version of the current draft',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read versions: entry.version follows a moved stored entry version (5), it is not a constant',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read versions: revision.version follows a moved stored revision version (7), it is not a constant',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read versions after a committed append: entry.version equals the advanced stored entry version',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail 200: protected, bound to the current versions, never cacheable across contexts EB draft detail read: the ETag changes when the entry version or the revision version changes',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > the assigned author reads the typed draft with its state, and the page is no-store and accessible',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'return a strong authenticated ETag',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route returns the exact draft with no-store and a strong entry/revision-bound ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route does not reuse a draft-detail ETag across actor contexts',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route fails closed if a response-bound ETag cannot be computed',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-proxies-hardening-draft-read.test.ts',
            title:
              'cms-editorial draft-detail proxy ETag gate (CMS-03B-11) refuses a 200 with a weak ETag so it can never anchor a write',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-proxies-hardening-draft-read.test.ts',
            title:
              'cms-editorial draft-detail proxy ETag gate (CMS-03B-11) refuses a 200 with no ETag at all',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-draft-detail-transport.test.ts',
            title:
              'executeCmsEditorialEntryDraftDetailRead verification rejects a weak ETag so it can never anchor an If-Match',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-draft-detail.test.ts',
            title:
              'cms draft detail addressing (CMS-03B-11) binds the strong read validator to both resource identities and versions',
          },
        ],
      },
      {
        text: 'no-store response',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route returns the exact draft with no-store and a strong entry/revision-bound ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-proxies.test.ts',
            title:
              'cms-editorial draft-detail read proxy (CMS-03B-11) relays a 200 and preserves the strong ETag verbatim',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/cms-editorial-draft-read.test.ts',
            title:
              'CMS-03B-11 local Worker → web proxy → browser read delivers the authorized canonical draft with the same composite ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-068] [P2-S10-AC-069] the draft read serves the committed value with the entry and revision in its strong ETag',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > the assigned author reads the typed draft with its state, and the page is no-store and accessible',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-10-draft-detail-real-route.spec.ts',
            title:
              'Phase 2 Slice 10 draft detail real route > 403 for a visible entry the caller cannot read, one 404 for a hidden or absent one, 400 for a malformed id',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'prohibit mutation headers, browser table grants, and cross-context cache reuse',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read grants: anon and authenticated hold no SELECT, INSERT, UPDATE or DELETE table privilege on any relation the draft read touches',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read grants: anon and authenticated hold no column-level privilege on any relation the draft read touches',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read grants: EXECUTE on both cms_get_entry_draft functions is granted to none of anon, authenticated and PUBLIC',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_read_restore_resolve_read.sql',
            title:
              'EB draft read grants control: only the worker role service_role can execute the platform_api wrapper, never the private function',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail 200: protected, bound to the current versions, never cacheable across contexts EB draft detail read: the same entry read by a different acting party never shares an ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail refusals: stable ApiError and no fallback content EB draft detail request: an If-Match header is refused before the RPC is reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail refusals: stable ApiError and no fallback content EB draft detail request: an Idempotency-Key header is refused before the RPC is reached',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-eb-worker-detail.test.ts',
            title:
              'EB draft detail 200: protected, bound to the current versions, never cacheable across contexts EB draft detail read: the named read RPC is called once with the session context and without any mutation header or body member',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
];
