// Types of a Phase 2 slice evidence ledger (Slice 10 and later).
//
// A ledger answers, per acceptance criterion, "which exact tests prove which
// clause of it". It is type-only on purpose: ledger data files import these types
// with `import type`, which Node and vitest both erase, so scripts/evidence can
// load a ledger with a plain `import()` and no build step.
//
// What a citation proves is decided by scripts/evidence/ledger-lib.mjs
// (`evaluateLedger`); how receipts are produced is described in
// scripts/evidence/README.md.

/** The tool that executed the cited test. */
export type EvidenceTool = 'vitest' | 'pgtap' | 'playwright' | 'race';

/**
 * verified       every clause cites at least one passing test; no limitation.
 * partial        some clauses cited, some not; `limitation` names the rest.
 * unverified     nothing cited yet; `limitation` says why.
 * contract-only  the contract-level rule is proven, runtime behaviour is not
 *                (allowed only where the tracker text itself says so);
 *                `limitation` names what stays unproven.
 */
export type EvidenceStatus =
  'verified' | 'partial' | 'unverified' | 'contract-only';

/**
 * One exact test. `title` is the full title path for vitest and Playwright, the
 * exact `ok N - description` text (whitespace collapsed) for pgTAP, and the exact
 * `ok - ...` assertion text for a race runner. `project` is required for
 * Playwright and forbidden for every other tool.
 */
export type EvidenceCitation = {
  readonly tool: EvidenceTool;
  readonly file: string;
  readonly title: string;
  readonly project?: string;
};

/** A verbatim part of the criterion text and the tests that prove it. */
export type EvidenceClause = {
  readonly text: string;
  readonly citations: readonly EvidenceCitation[];
};

export type EvidenceLedgerEntry = {
  /** `P2-SNN-AC-NNN`. */
  readonly criterion: string;
  /** The tracker claim, byte for byte (source links excluded). Never reworded. */
  readonly text: string;
  readonly clauses: readonly EvidenceClause[];
  readonly status: EvidenceStatus;
  readonly limitation: string;
};
