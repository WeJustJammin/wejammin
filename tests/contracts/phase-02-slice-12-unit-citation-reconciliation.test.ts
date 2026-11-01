import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  S12_UNIT_CITATION_RECONCILIATION,
  type CitationReconciliationBinding,
  type CitationReconciliationRecord,
} from './phase-02-slice-12-unit-citation-reconciliation-fixtures';
import type {
  EvidenceCitation,
  EvidenceClause,
  EvidenceLedgerEntry,
} from './phase-02-evidence-ledger';
import { S12_EVIDENCE_LEDGER } from './phase-02-slice-12-evidence-ledger';

// SCOPE: Slice 12 unit-citation identity reconciliation only.
//
// The ledger cites exact Vitest identities (tool + file + full title). Some
// cited tests now run from a different file, some wrap an it.each parameter in
// single quotes, and two are removed historical tests. As a result 26 ledger
// citations no longer name a test the current unit report actually runs. This
// suite asserts that each reconciled citation names the exact replacement in
// the exact original criterion + clause it was bound to (or that a retired
// citation is simply gone), and that no stale identity survives anywhere.
//
// Citation bookkeeping only: it proves no acceptance, clause coverage, evidence
// depth, receipt validity or runtime behaviour. The static fixture is
// bookkeeping derived from the frozen baseline, not proof by source token.

const NUL = '\u0000';

const identityOf = (citation: EvidenceCitation): string =>
  [citation.tool, citation.file, citation.title].join(NUL);

const FIXTURE_SHA256 =
  'ffd754bd41848fc162a3b65a36b9fc756ede38c842a7433a5f7450e96b45b716';

const presentIdentities = new Set(
  S12_EVIDENCE_LEDGER.flatMap((entry) =>
    entry.clauses.flatMap((clause) =>
      clause.citations.map((citation) => identityOf(citation)),
    ),
  ),
);

const entryById = new Map<string, EvidenceLedgerEntry>(
  S12_EVIDENCE_LEDGER.map((entry): [string, EvidenceLedgerEntry] => [
    entry.criterion,
    entry,
  ]),
);

const clauseOf = (
  binding: CitationReconciliationBinding,
): {
  entry: EvidenceLedgerEntry | undefined;
  clause: EvidenceClause | undefined;
} => {
  const entry = entryById.get(binding.criterion);
  return {
    entry,
    clause: entry?.clauses.find((clause) => clause.text === binding.clauseText),
  };
};

const cites = (clause: EvidenceClause | undefined, id: string): boolean =>
  clause?.citations.some((citation) => identityOf(citation) === id) ?? false;

// Every real binding of an identity across all criteria, in ledger order. Used
// to forbid reassigning a replacement to any clause other than its original.
const bindingsOf = (id: string): readonly CitationReconciliationBinding[] => {
  const found: CitationReconciliationBinding[] = [];
  for (const entry of S12_EVIDENCE_LEDGER) {
    for (const clause of entry.clauses) {
      if (clause.citations.some((citation) => identityOf(citation) === id)) {
        found.push({ criterion: entry.criterion, clauseText: clause.text });
      }
    }
  }
  return found;
};

// The retired dependency clause keeps exactly the citations it already had once
// the stale identity is dropped: a removed test may not be swapped for a nearby
// success or provider-missing test. This is the baseline citation list of each
// retired clause, minus the retired identity.
const RETAINED_DEPENDENCY: Readonly<Record<string, readonly string[]>> = {
  'apps/worker/src/cms-composition-production-pattern.test.ts': [],
  'apps/worker/src/cms-composition-production-taxonomy.test.ts': [
    identityOf({
      tool: 'vitest',
      file: 'apps/worker/src/cms-composition-production-taxonomy.test.ts',
      title:
        'CMS-03C-03 production taxonomy boundary has no implicit allow when production auth or rate dependencies are absent',
    }),
  ],
};

const rows = S12_UNIT_CITATION_RECONCILIATION.map(
  (record): [string, CitationReconciliationRecord] => [
    record.kind + ' ' + record.old.file + ' :: ' + record.old.title,
    record,
  ],
);

describe('Slice 12 unit-citation reconciliation: fixture fidelity', () => {
  it('pins the exported matrix to its exact JSON.stringify order and bytes', () => {
    const digest = createHash('sha256')
      .update(JSON.stringify(S12_UNIT_CITATION_RECONCILIATION))
      .digest('hex');
    expect(digest).toBe(FIXTURE_SHA256);
  });

  it('records 26 distinct stale identities as 8 moved, 16 quoted and 2 retired', () => {
    expect(S12_UNIT_CITATION_RECONCILIATION.length).toBe(26);
    const kinds = S12_UNIT_CITATION_RECONCILIATION.map((record) => record.kind);
    expect(kinds.filter((kind) => kind === 'moved').length).toBe(8);
    expect(kinds.filter((kind) => kind === 'quoted').length).toBe(16);
    expect(kinds.filter((kind) => kind === 'retired').length).toBe(2);
    const keys = S12_UNIT_CITATION_RECONCILIATION.map((record) =>
      identityOf(record.old),
    );
    expect(new Set(keys).size).toBe(26);
    expect(new Set(rows.map(([label]) => label)).size).toBe(26);
    expect(
      S12_UNIT_CITATION_RECONCILIATION.reduce(
        (total, record) => total + record.bindings.length,
        0,
      ),
    ).toBe(40);
    for (const record of S12_UNIT_CITATION_RECONCILIATION) {
      expect(record.old.tool).toBe('vitest');
      expect(record.bindings.length).toBeGreaterThan(0);
      if (record.kind === 'retired') expect(record.fresh).toBeNull();
      else expect(record.fresh).not.toBeNull();
    }
  });
});

describe('Slice 12 unit-citation reconciliation: current ledger identity', () => {
  it.each(rows)('%s', (_label, record) => {
    const oldId = identityOf(record.old);
    expect(presentIdentities.has(oldId), oldId + ' is still cited').toBe(false);

    if (record.fresh === null) {
      expect(record.kind).toBe('retired');
      for (const binding of record.bindings) {
        const { entry, clause } = clauseOf(binding);
        expect(entry, binding.criterion).toBeDefined();
        expect(
          clause,
          binding.criterion + ' :: ' + binding.clauseText,
        ).toBeDefined();
        expect(cites(clause, oldId)).toBe(false);
        // The clause keeps every citation it had at the reconciliation (the retired identity dropped, never swapped);
        // the 2026-10-24 refuted re-citation (recite/a-refutation.json, DEC-226) may only add reviewed tests to it.
        const retained = RETAINED_DEPENDENCY[record.old.file];
        expect(retained, record.old.file).toBeDefined();
        expect(clause?.citations.map(identityOf)).toEqual(
          expect.arrayContaining([...(retained ?? [])]),
        );
      }
      return;
    }

    const freshId = identityOf(record.fresh);
    expect(record.fresh.tool).toBe(record.old.tool);
    if (record.kind === 'moved') {
      expect(record.fresh.title).toBe(record.old.title);
      expect(record.fresh.file).not.toBe(record.old.file);
    } else {
      expect(record.kind).toBe('quoted');
      expect(record.fresh.file).toBe(record.old.file);
      expect(record.fresh.title).not.toBe(record.old.title);
      expect(record.fresh.title.replaceAll("'", '')).toBe(record.old.title);
    }
    for (const binding of record.bindings) {
      const { entry, clause } = clauseOf(binding);
      expect(entry, binding.criterion).toBeDefined();
      expect(
        clause,
        binding.criterion + ' :: ' + binding.clauseText,
      ).toBeDefined();
      expect(
        cites(clause, freshId),
        binding.criterion +
          ' :: ' +
          binding.clauseText +
          ' must cite the replacement',
      ).toBe(true);
    }
    expect(
      bindingsOf(freshId),
      freshId + ' is bound outside its recorded clauses',
    ).toEqual(record.bindings);
  });
});
