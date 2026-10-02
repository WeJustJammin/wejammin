# Slice 09 pre-activation dry-run producer audit

**Date**: 2026-10-01  
**Status**: owner trigger and successor-scope decisions requested; no criterion closed

The current production path cannot create a genuine migration dry-run report
before CMS-03A-04 activation. This is a separate gap from the unresolved
acting-context binding and CMS review/approval authority.

- `cms_activate_schema` calls `cms_prepare_activation_migration` with four
  arguments at `supabase/migrations/20260902080000_content_schema_registry_authority.sql:4790-4796`.
  The optional `p_dry_run_report` is therefore null. The preparation function
  requires an independently produced report for first activation at lines
  3747-3751 and an exact persisted report for successor activation.
- The only migration-plan inserts are inside that preparation function at
  lines 3883 and 3947. The migration worker's dry-run finalizer requires a
  leased `dry_running` plan, but no production path creates a pre-activation
  `draft` plan. The passing migration-worker SQL fixtures hand-insert plans.
- `cms_create_type_draft` records a first-version zero-row additive report at
  lines 4207-4219. That candidate-derived case does not establish a producer
  for an actual successor migration. The current draft command also rejects an
  existing `typeKey`, so successor authoring is not reachable through it.
  BE03a explicitly defines CMS-03A-01 as the initial version-1 aggregate and
  has no successor command among its eight routes. A version-N+1 authoring
  command therefore requires a locked-spec amendment, not a silent SQL fix.
- Locked BE03a describes migration plans and reports as internal records while
  retaining eight HTTP operations (`.memory/wiki/specs/be/03a-content-schema-registry.md:998-1007`).
  It does not define the pre-activation trigger. Choosing an internal-only
  worker/RPC trigger or a spec-amended protected command, and whether successor
  authoring belongs in Slice 09, are owner decisions.

AC087 and the other reopened activation-chain criteria remain unchecked.
Slice 09 remains **261/279 active**; Phase 2 remains **8/17 slices**. No code,
migration, test fixture, deployment, or acceptance evidence was changed by
this audit.
