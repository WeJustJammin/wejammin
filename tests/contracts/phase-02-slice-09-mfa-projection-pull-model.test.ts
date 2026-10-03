import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * AC906 / DEC-128 (owner): `identity.mfa-factor.changed.v1` carries exactly
 * { mfaFactorId, authBindingId } and AUTH-API-16 follows the PULL model: every read
 * returns canonical state and a new ETag, no event consumer refetches projections,
 * and the browser refetches on its own mutation and on the multi-tab broadcast.
 *
 * The pull model is only true while NO MFA factor projection cache exists. This guard
 * scans every non-test source file that reads or renders the factor projection
 * (web and Worker) for any cache or persistence of it, so a later cache cannot be
 * introduced without this guard failing, and the clause "no client projection cache
 * exists" is asserted globally instead of in one component.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const SOURCE_ROOTS = ['apps/web/src', 'apps/worker/src'] as const;

const walk = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const isTestOrSupport = (path: string): boolean =>
  /\.(test|spec)\.[cm]?[tj]sx?$/u.test(path) ||
  /\.test-support\.[tj]sx?$/u.test(path) ||
  /\.coverage\./u.test(path);

/** A file that reads or renders the AUTH-API-16 factor projection. */
const READS_PROJECTION =
  /auth_mfa_factors_read|account\/mfa\/factors|MfaFactorsResource\b|readMfaFactors/u;

export const cacheFindings = (source: string): string[] => {
  const findings: string[] = [];
  for (const [pattern, why] of [
    [/\blocalStorage\b/u, 'localStorage'],
    [/\bsessionStorage\b/u, 'sessionStorage'],
    [/\bindexedDB\b|\bopenDatabase\b/u, 'IndexedDB'],
    [/\bcaches\s*\.|\bCacheStorage\b|\bnew\s+Cache\b/u, 'Cache API'],
    [/\bserviceWorker\b/u, 'service worker'],
    [
      /stale-while-revalidate|\bmax-age\s*=|\bimmutable\b/iu,
      'cache-control freshness',
    ],
    [
      /\buseSWR\b|\breact-query\b|\bQueryClient\b|\bswr\b/u,
      'client query cache',
    ],
    [
      /^\s*(?:export\s+)?(?:const|let|var)\s+\w+\s*(?::[^=]+)?=\s*new\s+(?:Weak)?Map\b/mu,
      'module-level Map',
    ],
    [/^\s*(?:export\s+)?let\s+\w*[Cc]ach\w*\b/mu, 'module-level cached value'],
  ] as const)
    if (pattern.test(source)) findings.push(why);
  const cacheControl = [
    ...source.matchAll(/cache-control['"]?\s*[,:]\s*['"]([^'"]+)['"]/giu),
  ];
  for (const match of cacheControl)
    if (match[1]?.trim().toLowerCase() !== 'no-store')
      findings.push(`cache-control ${match[1]}`);
  return findings;
};

const projectionFiles = SOURCE_ROOTS.flatMap((base) =>
  walk(resolve(ROOT, base)).filter(
    (path) =>
      /\.(ts|tsx|astro)$/u.test(path) &&
      !isTestOrSupport(path) &&
      READS_PROJECTION.test(readFileSync(path, 'utf8')),
  ),
);

describe('[P2-S09-AC-906] MFA factor projection pull model (DEC-128): no projection cache exists', () => {
  it('[P2-S09-AC-906] finds every web and Worker source file that reads the factor projection', () => {
    const names = projectionFiles.map((path) => relative(ROOT, path));
    expect(names).toEqual(
      expect.arrayContaining([
        'apps/web/src/components/identity-authority/step-up-mfa/mfa-api.ts',
        'apps/web/src/server/step-up-mfa-read.ts',
        'apps/web/src/server/mfa-settings-page-context.ts',
        'apps/worker/src/authentication/routes-mfa.ts',
        'apps/worker/src/authentication/production-mfa-persistence-support.ts',
      ]),
    );
    expect(names.length).toBeGreaterThanOrEqual(8);
  });

  it('[P2-S09-AC-906] none of them stores, caches or persists the projection (N/N files)', () => {
    const offenders = projectionFiles.flatMap((path) =>
      cacheFindings(readFileSync(path, 'utf8')).map(
        (finding) => `${relative(ROOT, path)}: ${finding}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('[P2-S09-AC-906] the only browser storage in the MFA surface is the tab-scoped step-up draft, which never holds a factor', () => {
    const mfaDirectory = resolve(
      ROOT,
      'apps/web/src/components/identity-authority/step-up-mfa',
    );
    const writers = walk(mfaDirectory).filter(
      (path) =>
        /\.(ts|tsx)$/u.test(path) &&
        !isTestOrSupport(path) &&
        /\.setItem\(/u.test(readFileSync(path, 'utf8')),
    );
    expect(writers.map((path) => relative(mfaDirectory, path))).toEqual([
      'step-up-draft.ts',
    ]);
    const draft = readFileSync(join(mfaDirectory, 'step-up-draft.ts'), 'utf8');
    const write = /\.setItem\(([\s\S]*?)\);/u.exec(draft)?.[1] ?? '';
    expect(write).not.toMatch(/factor/iu);
  });

  it('[P2-S09-AC-906] every browser read of AUTH-API-16 bypasses the HTTP cache and the Worker answers no-store with a new ETag per read', () => {
    const api = readFileSync(
      resolve(
        ROOT,
        'apps/web/src/components/identity-authority/step-up-mfa/mfa-api.ts',
      ),
      'utf8',
    );
    expect(api).toContain("cache: 'no-store'");
    const routes = readFileSync(
      resolve(ROOT, 'apps/worker/src/authentication/routes-mfa.ts'),
      'utf8',
    );
    expect(routes).toMatch(
      /jsonSuccess\(context, parsed\.data, 200, 'no-store'\)/u,
    );
    expect(routes).toContain('quotedVersion(parsed.data.version)');
  });

  it('[P2-S09-AC-906] the guard detects each cache shape it claims to forbid (fixtures)', () => {
    expect(
      cacheFindings("localStorage.setItem('mfa-factors', JSON.stringify(f))"),
    ).toContain('localStorage');
    expect(cacheFindings('const c = await caches.open("mfa")')).toContain(
      'Cache API',
    );
    expect(
      cacheFindings('const cache = new Map<string, Factor[]>();'),
    ).toContain('module-level Map');
    expect(cacheFindings('let cachedFactors = null;')).toContain(
      'module-level cached value',
    );
    expect(
      cacheFindings("headers.set('cache-control', 'private, max-age=60')"),
    ).toEqual(
      expect.arrayContaining([
        'cache-control freshness',
        'cache-control private, max-age=60',
      ]),
    );
    expect(
      cacheFindings("context.header('cache-control', 'no-store')"),
    ).toEqual([]);
    expect(cacheFindings('const factors = await readFactors();')).toEqual([]);
  });
});
