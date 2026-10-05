import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');

const sourceFiles = (relative: string): string[] => {
  const directory = resolve(ROOT, relative);
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory())
      return ['node_modules', 'dist'].includes(entry)
        ? []
        : sourceFiles(`${relative}/${entry}`);
    return /\.(?:ts|tsx|astro|mjs)$/u.test(entry) &&
      !/\.test\.|\.test-support\./u.test(entry)
      ? [path]
      : [];
  });
};
const containing = (roots: readonly string[], pattern: RegExp): string[] =>
  roots
    .flatMap(sourceFiles)
    .filter((file) => pattern.test(readFileSync(file, 'utf8')))
    .map((file) => file.slice(ROOT.length + 1));

describe('MFA provider seams are Worker-only (BE01a seam table)', () => {
  it('[P2-S09-AC-912] no browser or shared-contract source calls the provider MFA endpoints or holds the service credential', () => {
    expect(
      containing(
        ['apps/web/src', 'packages/contracts/src'],
        /auth\/v1\/(?:factors|admin\/users)/u,
      ),
    ).toStrictEqual([]);
  });

  it('[P2-S09-AC-912] only the Worker authentication adapter calls the user-facing provider MFA endpoints', () => {
    expect(
      containing(['apps/worker/src'], /auth\/v1\/factors/u).filter(
        (file) => !file.endsWith('production-mfa-provider.ts'),
      ),
    ).toStrictEqual([]);
  });

  it('[P2-S09-AC-915] the operator-only admin adapter is defined once and imported only by the CFG-05B-06 port, never by a user-facing route', () => {
    // Two Worker modules may name the admin users endpoint: the reset adapter
    // (the only mutating caller) and the reconciler's status-only reader.
    expect(
      containing(['apps/worker/src'], /auth\/v1\/admin\/users/u),
    ).toStrictEqual([
      'apps/worker/src/event-consumers/provider-factor-status.ts',
      'apps/worker/src/platform-configuration/admin-mfa-reset-provider.ts',
    ]);
    const statusReader = readFileSync(
      resolve(
        ROOT,
        'apps/worker/src/event-consumers/provider-factor-status.ts',
      ),
      'utf8',
    );
    expect(statusReader).toMatch(/method: 'GET'/u);
    expect(statusReader).not.toMatch(/method: '(?:DELETE|POST|PUT|PATCH)'/u);
    expect(
      containing(['apps/worker/src'], /admin-mfa-reset-provider['"]/u).filter(
        (file) => !file.endsWith('admin-mfa-reset-provider.ts'),
      ),
    ).toStrictEqual([
      'apps/worker/src/platform-configuration/admin-mfa-reset-port.ts',
    ]);
  });
});
