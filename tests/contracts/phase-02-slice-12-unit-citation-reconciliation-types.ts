import type { EvidenceCitation } from './phase-02-evidence-ledger';

// Slice 12 unit-citation reconciliation shared types - type-only module.
//
// Both citation fixtures (the primary aggregate and the moved-records module)
// type-import their record types from here, and nothing here imports either
// fixture, so the module graph stays acyclic under the locked DAG rule.
//
// Citation bookkeeping only: these types carry no runtime behaviour.

export type CitationReconciliationKind = 'moved' | 'quoted' | 'retired';

export type CitationReconciliationBinding = {
  readonly criterion: string;
  readonly clauseText: string;
};

export type CitationReconciliationRecord = {
  readonly old: EvidenceCitation;
  readonly fresh: EvidenceCitation | null;
  readonly kind: CitationReconciliationKind;
  readonly bindings: readonly CitationReconciliationBinding[];
};
