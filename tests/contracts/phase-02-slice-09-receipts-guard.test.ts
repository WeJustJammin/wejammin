import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { S09_AMENDMENT_EVIDENCE } from './phase-02-slice-09-amendment-evidence';
import {
  ROOT,
  inVitestGate,
  read,
} from './phase-02-slice-09-amendment-evidence.test-support';

type Receipt = {
  criterion: string;
  tool: string;
  granularity: string;
  file: string;
  title: string;
  status: string;
  fileSha256: string | null;
};
type Lib = {
  TOOLS: string[];
  STATUSES: string[];
  parseReceipts: (text: string) => Receipt[];
  evaluateReceipts: (input: {
    entries: typeof S09_AMENDMENT_EVIDENCE;
    receipts: Receipt[];
    shaOf: (file: string) => string | null;
  }) => string[];
};
const lib = (await import('../../scripts/evidence/receipts-lib.mjs')) as Lib;

const RECEIPTS = 'tests/contracts/phase-02-slice-09-receipts.generated.jsonl';
const REGENERATE =
  'regenerate with: node scripts/evidence/collect-receipts.mjs --vitest <report.json> --pgtap <verbose TAP from pnpm db:test:tap> --playwright <report.json> --races <db-races.out>';

const shaCache = new Map<string, string | null>();
const shaOf = (file: string): string | null => {
  if (!shaCache.has(file)) {
    const path = resolve(ROOT, file);
    shaCache.set(
      file,
      existsSync(path)
        ? createHash('sha256').update(readFileSync(path)).digest('hex')
        : null,
    );
  }
  return shaCache.get(file) ?? null;
};

const receipts: Receipt[] = existsSync(resolve(ROOT, RECEIPTS))
  ? lib.parseReceipts(read(RECEIPTS))
  : [];

const packageScripts = (
  JSON.parse(read('package.json')) as { scripts: Record<string, string> }
).scripts;

describe('Slice 09 machine-generated receipts', () => {
  it('[P2-S09-AC-1144] has a generated receipts file whose rows are well formed and name a real test file', () => {
    expect(
      existsSync(resolve(ROOT, RECEIPTS)),
      `${RECEIPTS} is missing; ${REGENERATE}`,
    ).toBe(true);
    expect(receipts.length).toBeGreaterThan(0);
    for (const receipt of receipts) {
      expect(receipt.criterion, JSON.stringify(receipt)).toMatch(
        /^P2-S09-AC-\d{3,4}$/u,
      );
      expect(lib.TOOLS, JSON.stringify(receipt)).toContain(receipt.tool);
      expect(lib.STATUSES, JSON.stringify(receipt)).toContain(receipt.status);
      expect(receipt.fileSha256, JSON.stringify(receipt)).toMatch(
        /^[0-9a-f]{64}$/u,
      );
      expect(receipt.title.length, JSON.stringify(receipt)).toBeGreaterThan(0);
    }
  });

  it('[P2-S09-AC-1144] has a fresh passing receipt for every verified criterion and each test file it cites, and none for a file that changed since the run', () => {
    const problems = lib.evaluateReceipts({
      entries: S09_AMENDMENT_EVIDENCE,
      receipts,
      shaOf,
    });
    expect(
      problems,
      `${String(problems.length)} stale or missing receipt(s); ${REGENERATE}\n${problems.slice(0, 25).join('\n')}`,
    ).toEqual([]);
  });

  it('[P2-S09-AC-1144] runs inside pnpm validate through the vitest gate and keeps the collector scripts', () => {
    expect(
      inVitestGate('tests/contracts/phase-02-slice-09-receipts-guard.test.ts'),
    ).toBe(true);
    expect(packageScripts['validate']).toContain('pnpm test:coverage');
    expect(packageScripts['evidence:collect']).toBe(
      'node scripts/evidence/collect-receipts.mjs',
    );
    expect(existsSync(resolve(ROOT, 'scripts/evidence/receipts-lib.mjs'))).toBe(
      true,
    );
  });
});

describe('Slice 09 race runners sit in a blocking gate', () => {
  const ci = read('.github/workflows/ci.yml');
  const jobBlock = (name: string): string => {
    const start = ci.indexOf(`\n  ${name}:`);
    const rest = ci.slice(start + 1);
    const next = /\n {2}[a-z][\w-]*:\n/u.exec(rest.slice(1));
    return next === null ? rest : rest.slice(0, next.index + 1);
  };

  it('[P2-S09-AC-1144] runs db:races through db:verify in the database CI job with no continue-on-error', () => {
    expect(packageScripts['db:verify']).toContain('pnpm db:races');
    expect(packageScripts['db:ci']).toBe('bash infra/verify-database.sh');
    expect(read('infra/verify-database.sh')).toContain('pnpm db:verify');
    const database = jobBlock('database');
    expect(database).toContain('pnpm db:ci');
    expect(database).not.toMatch(/continue-on-error/u);
  });

  it('[P2-S09-AC-1144] makes the build job, and so every release step, wait for the database job', () => {
    const build = jobBlock('build');
    expect(build).toMatch(/needs:\s*\[[^\]]*\bdatabase\b[^\]]*\]/u);
    expect(build).not.toMatch(/continue-on-error/u);
  });

  it('[P2-S09-AC-1144] requires a passing race receipt for every race runner an index entry lists as supplementary', () => {
    const runners = new Set(
      S09_AMENDMENT_EVIDENCE.flatMap((entry) =>
        (entry.supplementary ?? []).filter((file) => file.endsWith('.mjs')),
      ),
    );
    expect(runners.size).toBeGreaterThan(0);
    for (const runner of runners) {
      expect(
        receipts.some(
          (receipt) =>
            receipt.tool === 'race' &&
            receipt.file === runner &&
            receipt.status === 'passed',
        ),
        `${runner} has no passing race receipt; ${REGENERATE}`,
      ).toBe(true);
    }
  });
});
