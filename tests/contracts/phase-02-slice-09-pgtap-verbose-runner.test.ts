import { describe, expect, it } from 'vitest';

type Runner = {
  CONTAINER_ROOT: string;
  projectId: (config: string) => string;
  dockerArguments: (input: {
    project: string;
    image: string;
    repository: string;
    paths: string[];
  }) => string[];
  restorePaths: (tap: string, repository: string) => string;
};
const runner = (await import('../../infra/run-pgtap-verbose.mjs')) as Runner;
const parser = (await import('../../scripts/evidence/receipts-lib.mjs')) as {
  parsePgtapTap: (
    text: string,
    root: string,
  ) => { verbose: boolean; unverified: string[] };
};

describe('verbose pgTAP runner (pnpm db:test:tap)', () => {
  it('reads the project id from the Supabase config', () => {
    expect(runner.projectId('# c\nproject_id = "wejammin"\n[api]\n')).toBe(
      'wejammin',
    );
    expect(() => runner.projectId('[api]\n')).toThrow('project_id');
  });

  it('runs pg_prove -v over the whole directory by default, read-only, on the Supabase network', () => {
    const args = runner.dockerArguments({
      project: 'wejammin',
      image: 'public.ecr.aws/supabase/pg_prove:3.36',
      repository: '/repo',
      paths: [],
    });
    expect(args).toContain('supabase_network_wejammin');
    expect(args).toContain('/repo/supabase/tests:/w/supabase/tests:ro');
    expect(args.slice(args.indexOf('pg_prove'))).toEqual([
      'pg_prove',
      '-v',
      '-r',
      '--ext',
      '.sql',
      '/w/supabase/tests',
    ]);
    // the password is inherited from the environment, never put on the command line
    expect(args).toContain('PGPASSWORD');
    expect(args.join(' ')).not.toMatch(/PGPASSWORD=/u);
  });

  it('runs only the named files when given paths', () => {
    const args = runner.dockerArguments({
      project: 'wejammin',
      image: 'img',
      repository: '/repo',
      paths: ['./supabase/tests/a.sql'],
    });
    expect(args.at(-1)).toBe('/w/supabase/tests/a.sql');
  });

  it('rewrites container paths so the collector can relativise them, and the collector accepts the result as verbose', () => {
    const tap = [
      '/w/supabase/tests/a.sql .. ',
      '1..1',
      'ok 1 - an assertion [P2-S09-AC-001]',
      'ok',
    ].join('\n');
    const restored = runner.restorePaths(tap, '/repo');
    expect(restored.startsWith('/repo/supabase/tests/a.sql ..')).toBe(true);
    const parsed = parser.parsePgtapTap(restored, '/repo');
    expect(parsed.verbose).toBe(true);
    expect(parsed.unverified).toEqual([]);
  });
});
