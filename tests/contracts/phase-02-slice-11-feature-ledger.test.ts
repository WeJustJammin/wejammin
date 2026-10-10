import { readFileSync } from 'node:fs';

import {
  CMS_EDITORIAL_INTERNAL_OPERATIONS,
  cmsEditorialRoutePolicies,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

/*
 * P2-S11-AC-035, AC-038 and AC-041 name a "BE03b ledger" row each (25.02.03,
 * 25.02.04, 25.03.04) as the traceability anchor of their operations. This
 * suite makes those pointers executable: the feature ledger assigns the three
 * rows to P2-S11 and to nothing else, the BE03b Feature Ledger Coverage table
 * owns exactly the operations the criteria name for them, the Phase 2 plan
 * assigns Slice 11 the union of those operations, and every owned operation is
 * a registered browser route or a registered internal service operation.
 */

const read = (relative: string): string =>
  readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');

const FEATURE_LEDGER = read('.memory/wiki/specs/feature-ledger.md');
const BE03B = read(
  '.memory/wiki/specs/be/03b-editorial-workflow-publication.md',
);
const PHASE_2 = read('.memory/wiki/specs/phases/phase-2.md');

/** The three Slice 11 feature-ledger rows and what each criterion names for them. */
const ROWS = [
  {
    criterion: 'P2-S11-AC-035',
    ledgerId: '25.02.03',
    named: ['CMS-03B-15', 'CMS-03B-16', 'CMS-03B-17', 'CMS-03B-18'],
    owned: [
      'CMS-03B-05',
      'CMS-03B-06',
      'CMS-03B-15',
      'CMS-03B-16',
      'CMS-03B-17',
      'CMS-03B-18',
    ],
  },
  {
    criterion: 'P2-S11-AC-038',
    ledgerId: '25.02.04',
    named: ['CMS-03B-20'],
    owned: ['CMS-03B-07', 'CMS-03B-20'],
  },
  {
    criterion: 'P2-S11-AC-041',
    ledgerId: '25.03.04',
    named: ['CMS-03B-19'],
    owned: ['CMS-03B-08', 'CMS-03B-09', 'CMS-03B-19'],
  },
] as const;

const cells = (line: string): readonly string[] =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

const operationIds = (text: string): readonly string[] =>
  [...text.matchAll(/CMS-03B-\d{2}/gu)].map((match) => match[0]);

/** The feature-ledger table row of a ledger id. */
const featureLedgerRow = (ledgerId: string): readonly string[] => {
  const line = FEATURE_LEDGER.split('\n').find((candidate) =>
    candidate.startsWith(`| \`${ledgerId}\` `),
  );
  expect(line, `feature-ledger row ${ledgerId}`).toBeDefined();
  return cells(line as string);
};

/** The BE03b Feature Ledger Coverage row of a ledger id: its owned operations. */
const be03bOwnership = (ledgerId: string): readonly string[] => {
  const heading = BE03B.indexOf('## Feature Ledger Coverage');
  expect(heading).toBeGreaterThan(-1);
  const section = BE03B.slice(
    heading,
    BE03B.indexOf('\n## ', heading + 1),
  ).split('\n');
  const line = section.find((candidate) =>
    candidate.startsWith(`| ${ledgerId} `),
  );
  expect(line, `BE03b ledger coverage row ${ledgerId}`).toBeDefined();
  return operationIds(cells(line as string)[2] as string);
};

/** The `Operations:` clause and ledger pointer of a Phase 2 criterion. */
const criterionPointers = (criterion: string) => {
  const line = PHASE_2.split('\n').find((candidate) =>
    candidate.includes(`**${criterion}**`),
  );
  expect(line, `Phase 2 criterion ${criterion}`).toBeDefined();
  const clause = /Operations: (.*?) \[IA03\]/u.exec(line as string);
  expect(clause, `${criterion} Operations clause`).not.toBeNull();
  const ledger = /BE03b ledger (\d{2}\.\d{2}\.\d{2})/u.exec(clause![1]!);
  return {
    operations: operationIds(clause![1]!),
    ledgerId: ledger?.[1] ?? null,
  };
};

const sorted = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort();

describe('[P2-S11-AC-035] [P2-S11-AC-038] [P2-S11-AC-041] the BE03b feature-ledger pointers', () => {
  it.each(ROWS)(
    '$criterion points at BE03b ledger $ledgerId and names operations that row owns',
    ({ criterion, ledgerId, named, owned }) => {
      const pointers = criterionPointers(criterion);
      expect(pointers.ledgerId).toBe(ledgerId);
      expect(sorted(pointers.operations)).toEqual(sorted(named));
      // The row owns every operation the criterion names, and exactly `owned`.
      const ownership = be03bOwnership(ledgerId);
      expect(sorted(ownership)).toEqual(sorted(owned));
      for (const operation of pointers.operations)
        expect(ownership, `${ledgerId} owns ${operation}`).toContain(operation);
    },
  );

  it.each(ROWS)(
    'the feature ledger assigns $ledgerId to P2-S11',
    ({ ledgerId }) => {
      const row = featureLedgerRow(ledgerId);
      expect(row[row.length - 1]).toBe('P2-S11');
      expect(row[2]).toBe('Content Management & Platform Configuration');
      expect(row[6]).toBe('03-cms-content-modeling');
    },
  );

  it('assigns exactly these three feature rows to P2-S11 and no other', () => {
    const assigned = FEATURE_LEDGER.split('\n')
      .filter((line) => line.startsWith('| `') && /\| P2-S11 \|$/u.test(line))
      .map((line) => /^\| `([\d.]+)`/u.exec(line)![1]!);
    expect(sorted(assigned)).toEqual(sorted(ROWS.map((row) => row.ledgerId)));
  });

  it('keeps the Phase 2 plan assignment equal to the same three rows and their operations', () => {
    const feature = PHASE_2.split('\n').find((line) =>
      line.startsWith('| Slice 11 | `25.02.03`'),
    );
    expect(feature, 'Phase 2 feature ledger assignment row').toBeDefined();
    expect(
      [...(feature as string).matchAll(/`([\d.]+)`/gu)].map((m) => m[1]),
    ).toEqual(ROWS.map((row) => row.ledgerId));
    const endpoints = PHASE_2.split('\n').find((line) =>
      line.startsWith('| Slice 11 | CMS-03B-05'),
    );
    expect(endpoints, 'Phase 2 BE endpoint assignment row').toBeDefined();
    expect(sorted(operationIds(endpoints as string))).toEqual(
      sorted(ROWS.flatMap((row) => row.owned)),
    );
  });

  it('owns each operation in exactly one BE03b ledger row', () => {
    const owners = new Map<string, string[]>();
    for (const row of ROWS)
      for (const operation of be03bOwnership(row.ledgerId))
        owners.set(operation, [...(owners.get(operation) ?? []), row.ledgerId]);
    for (const [operation, ledgerIds] of owners)
      expect(ledgerIds, `${operation} owners`).toHaveLength(1);
    expect(owners.size).toBe(ROWS.flatMap((row) => row.owned).length);
  });

  it('resolves every owned operation to a registered browser route or internal operation', () => {
    const browser = new Set(
      cmsEditorialRoutePolicies.map((policy) => policy.operationId),
    );
    const internal = new Set(Object.keys(CMS_EDITORIAL_INTERNAL_OPERATIONS));
    for (const row of ROWS)
      for (const operation of be03bOwnership(row.ledgerId))
        expect(
          browser.has(operation) !== internal.has(operation),
          `${operation} is registered as exactly one of browser route or internal operation`,
        ).toBe(true);
    // CMS-03B-19 and CMS-03B-20 are internal only, never browser routes.
    for (const operation of ['CMS-03B-19', 'CMS-03B-20']) {
      expect(internal.has(operation)).toBe(true);
      expect(browser.has(operation)).toBe(false);
    }
    // The nine browser Slice 11 operations are all registered routes.
    for (const operation of [
      'CMS-03B-05',
      'CMS-03B-06',
      'CMS-03B-07',
      'CMS-03B-08',
      'CMS-03B-09',
      'CMS-03B-15',
      'CMS-03B-16',
      'CMS-03B-17',
      'CMS-03B-18',
    ])
      expect(browser.has(operation), `${operation} route`).toBe(true);
  });

  it('keeps the flows these rows serve (CMS-08, CMS-09, CMS-13) on Slice 11', () => {
    const flows = PHASE_2.split('\n').find((line) =>
      line.startsWith('| CMS-08, CMS-09, CMS-13'),
    );
    expect(flows, 'Phase 2 IA flow assignment row').toBeDefined();
    expect(cells(flows as string)[1]).toBe('Slice 11');
  });
});
