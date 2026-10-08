import { createHash } from 'node:crypto';

import type {
  EvidenceCitation,
  EvidenceLedgerEntry,
} from './phase-02-evidence-ledger';

// A tiny in-memory world for the evidence guard rules: a tracker, a ledger, the
// receipts of every cited test and the "current" file hashes. Each call returns
// fresh objects, so a test can corrupt one thing and prove the guard names it.

export type Receipt = {
  tool: string;
  granularity: string;
  file: string;
  title: string;
  project?: string;
  entrypoint?: string;
  status: string;
  occurrences?: number;
  fileSha256: string | null;
  closureSha256?: string | null;
  criterion?: string;
};
export type TrackerCriterion = {
  criterion: string;
  number: number;
  checked: boolean;
  claim: string;
};
export type World = {
  tracker: TrackerCriterion[];
  entries: EvidenceLedgerEntry[];
  receipts: Receipt[];
  expectedCount: number | null;
};

export const FILES = {
  vitestA: 'apps/x/a.test.ts',
  vitestB: 'apps/x/b.test.ts',
  pgtap: 'supabase/tests/p.sql',
  pgtapInclude: 'supabase/tests/p/001.sqlinc',
  e2e: 'tests/e2e/a.spec.ts',
  race: 'supabase/tests/race/010.mjs',
} as const;

const digest = (text: string): string =>
  createHash('sha256').update(text).digest('hex');
/** The current SHA-256 of a known file; null for a file that does not exist. */
export const fileSha = (file: string): string | null =>
  (Object.values(FILES) as string[]).includes(file)
    ? digest(`file:${file}`)
    : null;
/** The current closure hash of a pgTAP entrypoint. */
export const closureSha = (entrypoint: string): string | null =>
  entrypoint === FILES.pgtap ? digest(`closure:${entrypoint}`) : null;

export const vitestCite = (
  title: string,
  file: string = FILES.vitestA,
): EvidenceCitation => ({ tool: 'vitest', file, title });
export const pgtapCite = (title: string): EvidenceCitation => ({
  tool: 'pgtap',
  file: FILES.pgtap,
  title,
});
export const e2eCite = (
  title: string,
  project = 'chrome',
): EvidenceCitation => ({
  tool: 'playwright',
  file: FILES.e2e,
  title,
  project,
});
export const raceCite = (title: string): EvidenceCitation => ({
  tool: 'race',
  file: FILES.race,
  title,
});

/** The fresh passing receipt of a cited test. */
export const receiptFor = (
  citation: EvidenceCitation,
  over: Partial<Receipt> = {},
): Receipt => {
  const granularity =
    citation.tool === 'pgtap' || citation.tool === 'race'
      ? 'assertion'
      : 'test';
  return {
    tool: citation.tool,
    granularity,
    file: citation.file,
    title: citation.title,
    ...(citation.tool === 'playwright'
      ? { project: citation.project ?? '' }
      : {}),
    ...(citation.tool === 'pgtap' ? { entrypoint: FILES.pgtap } : {}),
    status: 'passed',
    fileSha256: fileSha(citation.file),
    ...(citation.tool === 'pgtap'
      ? { closureSha256: closureSha(FILES.pgtap) }
      : {}),
    ...over,
  };
};

export const CLAIMS = {
  one: 'Alpha does one thing; beta does another.',
  two: 'Gamma is enforced; delta is logged.',
  three: 'Epsilon rule is contract-only until the runtime exists.',
  four: 'Zeta works.',
} as const;

export const baseWorld = (): World => {
  const alpha = vitestCite('suite alpha works');
  const beta = pgtapCite('beta is rejected with 409');
  const gamma = vitestCite('suite gamma enforced', FILES.vitestB);
  const epsilon = vitestCite('suite epsilon contract', FILES.vitestB);
  const entries: EvidenceLedgerEntry[] = [
    {
      criterion: 'P2-S10-AC-001',
      text: CLAIMS.one,
      clauses: [
        { text: 'Alpha does one thing;', citations: [alpha] },
        { text: 'beta does another.', citations: [beta] },
      ],
      status: 'verified',
      limitation: '',
    },
    {
      criterion: 'P2-S10-AC-002',
      text: CLAIMS.two,
      clauses: [
        { text: 'Gamma is enforced;', citations: [gamma] },
        { text: 'delta is logged.', citations: [] },
      ],
      status: 'partial',
      limitation: 'Delta logging has no test yet, so only gamma is proven.',
    },
    {
      criterion: 'P2-S10-AC-003',
      text: CLAIMS.three,
      clauses: [{ text: CLAIMS.three, citations: [epsilon] }],
      status: 'contract-only',
      limitation:
        'The runtime path does not exist, so only the contract rule is proven.',
    },
    {
      criterion: 'P2-S10-AC-004',
      text: CLAIMS.four,
      clauses: [],
      status: 'unverified',
      limitation: 'No test is cited for this criterion yet.',
    },
  ];
  return {
    tracker: entries.map((entry, index) => ({
      criterion: entry.criterion,
      number: index + 1,
      checked: false,
      claim: entry.text,
    })),
    entries,
    receipts: [alpha, beta, gamma, epsilon].map((citation) =>
      receiptFor(citation),
    ),
    expectedCount: 4,
  };
};

export const GUARD_OPTIONS = {
  slice: '10',
  contractOnly: { from: 3, to: 3 },
} as const;

// ---- guard invocation helpers shared by the rule tests ----

export type GuardResult = {
  problems: string[];
  counts: {
    total: number;
    verified: number;
    partial: number;
    unverified: number;
    contractOnly: number;
  };
  soleProof: Map<string, string[]>;
};
export type GuardOptions = {
  slice?: string;
  contractOnly?: { from: number; to: number } | null;
  maxSoleProof?: number;
  contractOnlyNeedsTrackerText?: boolean;
};
type GuardLib = {
  evaluateLedger: (
    input: {
      entries: readonly EvidenceLedgerEntry[];
      tracker: World['tracker'];
      expectedCount: number | null;
      receipts: readonly Receipt[];
      fileSha: (file: string) => string | null;
      closureSha: (entrypoint: string) => string | null;
    } & GuardOptions,
  ) => GuardResult;
};
const guard =
  (await import('../../scripts/evidence/ledger-guard-lib.mjs')) as GuardLib;

export const run = (
  world: World,
  options: GuardOptions = GUARD_OPTIONS,
): GuardResult =>
  guard.evaluateLedger({ ...world, fileSha, closureSha, ...options });

export const problemsOf = (world: World, options?: GuardOptions): string[] =>
  run(world, options).problems;

export const editEntry = (
  world: World,
  criterion: string,
  change: (entry: EvidenceLedgerEntry) => EvidenceLedgerEntry,
): World => ({
  ...world,
  entries: world.entries.map((entry) =>
    entry.criterion === criterion ? change(entry) : entry,
  ),
});

/** True when one problem contains every needle. */
export const some = (problems: string[], ...needles: string[]): boolean =>
  problems.some((problem) =>
    needles.every((needle) => problem.includes(needle)),
  );
