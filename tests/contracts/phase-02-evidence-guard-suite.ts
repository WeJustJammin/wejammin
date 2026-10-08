import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// The guard every Phase 2 slice ledger (Slice 10 and later) runs under `pnpm validate`.
// A slice's own test file only names its ledger and its policy:
//
//   defineSliceEvidenceGuard({ slice: '11', ledger: S11_EVIDENCE_LEDGER, contractOnly: null });
//
// What each rule means is documented in scripts/evidence/README.md and enforced by
// scripts/evidence/ledger-guard-lib.mjs.

type Tracker = {
  criterion: string;
  number: number;
  checked: boolean;
  claim: string;
};
type Counts = {
  total: number;
  verified: number;
  partial: number;
  unverified: number;
  contractOnly: number;
};
type GuardLib = {
  evaluateLedger: (input: {
    entries: readonly EvidenceLedgerEntry[];
    tracker: Tracker[];
    expectedCount: number | null;
    receipts: unknown[];
    fileSha: (file: string) => string | null;
    closureSha: (entrypoint: string) => string | null;
    slice: string;
    contractOnly: { from: number; to: number } | null;
    maxSoleProof: number;
    contractOnlyNeedsTrackerText: boolean;
  }) => { problems: string[]; counts: Counts };
};
type LedgerLib = {
  trackerCriteria: (markdown: string, slice: string) => Tracker[];
  acceptanceCriteriaCount: (markdown: string) => number | null;
  citationsOf: (entries: readonly EvidenceLedgerEntry[]) => unknown[];
};

const guard =
  (await import('../../scripts/evidence/ledger-guard-lib.mjs')) as GuardLib;
const ledgerLib =
  (await import('../../scripts/evidence/ledger-lib.mjs')) as LedgerLib;
const receiptsLib =
  (await import('../../scripts/evidence/receipts-lib.mjs')) as {
    sha256OfFile: (root: string, file: string) => string | null;
    parseReceipts: (text: string) => unknown[];
    receiptsPathFor: (slice: string) => string;
  };
const identityLib =
  (await import('../../scripts/evidence/identity-receipts-lib.mjs')) as {
    closureSha256: (root: string, entrypoint: string) => string | null;
  };

const ROOT = resolve(import.meta.dirname, '../..');

export type SliceEvidencePolicy = {
  /** Two digits, "10".."17". */
  readonly slice: string;
  readonly ledger: readonly EvidenceLedgerEntry[];
  /** Criterion numbers that may be contract-only; null when none may be. */
  readonly contractOnly: { readonly from: number; readonly to: number } | null;
  /** Criteria the tracker header must declare, e.g. 105. */
  readonly criteria: number;
  /** Most criteria one test may be the only proof of a clause for. */
  readonly maxSoleProof?: number;
  /**
   * Whether a contract-only entry also needs the tracker text itself to say
   * "contract-only" (default true). Set false only when the tracker owner decides a
   * criterion in range is contract-only without saying so.
   */
  readonly contractOnlyNeedsTrackerText?: boolean;
};

export const defineSliceEvidenceGuard = (policy: SliceEvidencePolicy): void => {
  const { slice, ledger } = policy;
  const tracker = `.memory/pipeline/progress/slices/phase-02-slice-${slice}.md`;
  const receiptsPath = receiptsLib.receiptsPathFor(slice);
  const regenerate = `regenerate with: node scripts/evidence/run-slice-evidence.mjs --slice ${slice} (see scripts/evidence/README.md)`;
  const trackerText = readFileSync(resolve(ROOT, tracker), 'utf8');
  const criteria = ledgerLib.trackerCriteria(trackerText, slice);
  const receipts: unknown[] = existsSync(resolve(ROOT, receiptsPath))
    ? receiptsLib.parseReceipts(
        readFileSync(resolve(ROOT, receiptsPath), 'utf8'),
      )
    : [];
  const result = guard.evaluateLedger({
    entries: ledger,
    tracker: criteria,
    expectedCount: ledgerLib.acceptanceCriteriaCount(trackerText),
    receipts,
    fileSha: (file) => receiptsLib.sha256OfFile(ROOT, file),
    closureSha: (entrypoint) => identityLib.closureSha256(ROOT, entrypoint),
    slice,
    contractOnly:
      policy.contractOnly === null ? null : { ...policy.contractOnly },
    maxSoleProof: policy.maxSoleProof ?? 3,
    contractOnlyNeedsTrackerText: policy.contractOnlyNeedsTrackerText ?? true,
  });

  describe(`Slice ${slice} evidence ledger guard`, () => {
    it('backs every claim with a fresh passing receipt for the exact test it cites, and copies the tracker text unchanged', () => {
      expect(
        result.problems,
        `${String(result.problems.length)} evidence problem(s); ${regenerate}\n${result.problems.slice(0, 30).join('\n')}`,
      ).toEqual([]);
    });

    it(`covers exactly the ${String(policy.criteria)} tracker criteria, in order`, () => {
      expect(ledgerLib.acceptanceCriteriaCount(trackerText)).toBe(
        policy.criteria,
      );
      expect(criteria).toHaveLength(policy.criteria);
      expect(ledger.map((entry) => entry.criterion)).toEqual(
        Array.from(
          { length: policy.criteria },
          (_, index) => `P2-S${slice}-AC-${String(index + 1).padStart(3, '0')}`,
        ),
      );
    });

    it('reports how many criteria are verified, partial, contract-only and unverified', async ({
      annotate,
    }) => {
      const { counts } = result;
      const report = `Slice ${slice} evidence: ${String(counts.verified)} verified, ${String(counts.partial)} partial, ${String(counts.contractOnly)} contract-only, ${String(counts.unverified)} unverified of ${String(counts.total)}`;
      await annotate(report);
      console.info(report);
      expect(counts.total).toBe(policy.criteria);
      expect(
        counts.verified +
          counts.partial +
          counts.contractOnly +
          counts.unverified,
      ).toBe(policy.criteria);
    });

    it('allows contract-only only inside the policy range', () => {
      const range = policy.contractOnly;
      const outside = ledger.filter((entry) => {
        const number = Number(entry.criterion.slice(-3));
        return (
          entry.status === 'contract-only' &&
          (range === null || number < range.from || number > range.to)
        );
      });
      expect(outside.map((entry) => entry.criterion)).toEqual([]);
    });

    it('has receipts only when the ledger cites tests, and none that carry a criterion marker field', () => {
      if (ledgerLib.citationsOf(ledger).length === 0) {
        expect(
          receipts,
          `${receiptsPath} must be empty while the ledger cites nothing`,
        ).toEqual([]);
      } else {
        expect(
          existsSync(resolve(ROOT, receiptsPath)),
          `${receiptsPath} is missing; ${regenerate}`,
        ).toBe(true);
      }
      expect(
        receipts.some(
          (row) =>
            typeof row === 'object' && row !== null && 'criterion' in row,
        ),
      ).toBe(false);
    });
  });
};
