import { readFileSync } from 'node:fs';

/*
 * Reads the BE03c "Route Registry" and "Internal service operations" tables so the parity fixture
 * is checked against the spec text itself, not only against a transcription of it.
 */

const SPEC_PATH =
  '.memory/wiki/specs/be/03c-composition-taxonomy-localization.md';

export type SpecRouteRow = Readonly<{
  id: string;
  method: string;
  path: string;
  auth: string;
  middleware: string;
  concurrency: string;
  rate: string;
  line: number;
  text: string;
}>;

const section = (
  text: string,
  from: string,
  to: string,
): [string[], number] => {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(from));
  const end = lines.findIndex(
    (line, index) => index > start && line.startsWith(to),
  );
  if (start < 0 || end < 0) throw new Error(`BE03c section ${from} not found.`);
  return [lines.slice(start, end), start];
};

const cells = (line: string): string[] =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

const tableRows = (
  lines: readonly string[],
  offset: number,
): { cells: string[]; line: number }[] =>
  lines.flatMap((line, index) =>
    line.startsWith('|') &&
    !/^\|\s*-/u.test(line) &&
    !/^\|\s*Operation ID/u.test(line)
      ? [{ cells: cells(line), line: offset + index + 1 }]
      : [],
  );

/** The Route Registry rows, in table order. */
export const routeRegistryRows = (): readonly SpecRouteRow[] => {
  const [lines, offset] = section(
    readFileSync(SPEC_PATH, 'utf8'),
    '### Route Registry',
    '### Internal service operations',
  );
  return tableRows(lines, offset).map(({ cells: row, line }) => {
    const methodPath = /^(GET|POST) (\S+)$/u.exec(row[2] ?? '');
    if (methodPath === null)
      throw new Error(`BE03c L${line}: no method and path.`);
    return {
      id: row[0] ?? '',
      method: methodPath[1] ?? '',
      path: methodPath[2] ?? '',
      auth: row[4] ?? '',
      middleware: row[5] ?? '',
      concurrency: row[6] ?? '',
      rate: row[7] ?? '',
      line,
      text: row.join(' | '),
    };
  });
};

/** The Internal service operations rows keyed by operation id (their full row text). */
export const internalOperationRows = (): Readonly<Record<string, string>> => {
  const [lines, offset] = section(
    readFileSync(SPEC_PATH, 'utf8'),
    '### Internal service operations',
    '### Registry invariants',
  );
  return Object.fromEntries(
    tableRows(lines, offset).map(({ cells: row }) => [
      row[0] ?? '',
      row.join(' | '),
    ]),
  );
};

export type ParsedRate = Readonly<{
  user: number;
  party: number;
  timeoutMs: number;
  noStore: boolean;
  tier: number;
}>;

/** "30/min/user, 60/min/party; 15,000ms, target <2s; no-store; Tier 2 p95 <1,200ms". */
export const parseRate = (rate: string): ParsedRate | null => {
  const found =
    /(\d+)\/min\/user, (\d+)\/min\/party; ([\d,]+)ms.*?; (no-store); Tier ([12])/u.exec(
      rate,
    );
  if (found === null) return null;
  return {
    user: Number(found[1]),
    party: Number(found[2]),
    timeoutMs: Number((found[3] ?? '').replace(/,/gu, '')),
    noStore: found[4] === 'no-store',
    tier: Number(found[5]),
  };
};

const MATRIX_STATUSES = [
  400,
  401,
  403,
  404,
  409,
  415,
  422,
  429,
  '502/503/504',
  500,
] as const;

/**
 * The "Contract and error matrix" statuses per operation id: a status applies unless its cell reads
 * "not applicable ...". A grouped row ("a, b") applies to each id it names.
 */
export const errorMatrixStatuses = (): Readonly<
  Record<string, readonly number[]>
> => {
  const [lines, offset] = section(
    readFileSync(SPEC_PATH, 'utf8'),
    '### Contract and error matrix',
    '### Normative application error catalog',
  );
  const result: Record<string, readonly number[]> = {};
  for (const { cells: row } of tableRows(lines, offset)) {
    const statuses = MATRIX_STATUSES.flatMap((status, index) =>
      /^not applicable/u.test(row[index + 1] ?? '')
        ? []
        : status === '502/503/504'
          ? [502, 503, 504]
          : [status],
    );
    for (const id of (row[0] ?? '').split(',').map((part) => part.trim()))
      result[id] = statuses.sort((a, b) => a - b);
  }
  return result;
};
