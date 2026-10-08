import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Slice 10 real-route browser specs drive the built web app, the production
// editorial Worker, PostgREST and the newest SQL. The CI browser gate must
// therefore run with the local Supabase stack, under the same host lock the
// database job takes (both self-hosted runners share one stack), and must stop
// the stack again however the run ends.
const ROOT = resolve(import.meta.dirname, '../..');
const read = (path: string): string =>
  readFileSync(resolve(ROOT, path), 'utf8');

const jobBlock = (ci: string, name: string): string => {
  const start = ci.indexOf(`\n  ${name}:`);
  const rest = ci.slice(start + 1);
  const next = /\n {2}[a-z][\w-]*:\n/u.exec(rest.slice(1));
  return next === null ? rest : rest.slice(0, next.index + 1);
};

describe('CI browser gate runs against the real database stack', () => {
  // Commands only: the header comment names the gates it wraps.
  const script = read('infra/workflows/run-browser-gates.sh')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

  it('runs pnpm test:e2e through the database-backed wrapper in the quality job', () => {
    const quality = jobBlock(read('.github/workflows/ci.yml'), 'quality');
    expect(quality).toContain('bash infra/workflows/run-browser-gates.sh');
    expect(quality).not.toMatch(/run: pnpm test:e2e\s*$/mu);
    expect(quality).not.toMatch(/continue-on-error/u);
  });

  it('holds the shared Supabase host lock for the whole browser run', () => {
    expect(script).toContain('wejammin-supabase-ci.lock');
    expect(script).toMatch(/flock --wait \d+ 9/u);
    expect(script.indexOf('flock')).toBeLessThan(
      script.indexOf('pnpm test:e2e'),
    );
  });

  it('uses one host-global lock file shared with the database job, independent of TMPDIR', () => {
    const lockLine =
      /^lock_file="\$\{WEJAMMIN_SUPABASE_CI_LOCK:-\/tmp\/wejammin-supabase-ci\.lock\}"$/mu;
    expect(script).toMatch(lockLine);
    expect(read('infra/verify-database.sh')).toMatch(lockLine);
    expect(script).not.toContain('TMPDIR');
    expect(read('infra/verify-database.sh')).not.toContain('TMPDIR');
  });

  it('starts and resets the stack before the browser run and always stops it', () => {
    expect(script).toMatch(/set -euo pipefail/u);
    expect(script).toMatch(/trap cleanup EXIT/u);
    expect(script).toContain('pnpm db:stop');
    const start = script.indexOf('pnpm db:start');
    const reset = script.indexOf('pnpm db:reset');
    const e2e = script.indexOf('pnpm test:e2e');
    expect(start).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(start);
    expect(e2e).toBeGreaterThan(reset);
  });
});
