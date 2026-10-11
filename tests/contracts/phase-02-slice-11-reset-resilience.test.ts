import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');

type ResetResult = { status: number | null; stdout: string; stderr: string };
type ResetOutcome = { ok: boolean; attempts: number; status: number };

const reset = (await import(
  resolve(ROOT, 'infra/reset-local-database.mjs')
)) as {
  RESET_ATTEMPTS: number;
  isTransientResetFailure: (output: string) => boolean;
  resetLocalDatabase: (options: {
    run: () => ResetResult;
    attempts?: number;
    report?: (message: string) => void;
  }) => ResetOutcome;
};

// The exact stdout the CLI prints when its one-off schema-initialisation container exits 1
// (.lane-logs/api-reset-015716.log, reset-143152.log, reset-192552.log, and the race gate's
// fourth reset in .lane-logs/claude-diag2-20261011-040555/db-races.log, where the gate threw
// stdout away and so printed only that the reset had failed).
const SCHEMA_INITIALISATION_FAILED =
  '{"_tag":"Error","error":{"code":"LegacyDbSetupError","message":"error running container: exit 1"}}\n';
const SERVICE_NOT_HEALTHY =
  '{"_tag":"Error","error":{"code":"LegacyHealthCheckTimeoutError","message":"supabase_storage_wejammin container is not ready: unhealthy"}}\n';
const MIGRATION_REFUSED =
  '{"_tag":"Error","error":{"code":"LegacyMigrationApplyError","message":"ERROR: relation \\"x\\" does not exist"}}\n';

const failed = (stdout: string, status = 1): ResetResult => ({
  status,
  stdout,
  stderr: 'Resetting local database...\nRecreating database...\n',
});
const succeeded: ResetResult = {
  status: 0,
  stdout: '',
  stderr: 'Finished supabase db reset on branch main.\n',
};

/** A fake `supabase db reset` that answers the given results in order and counts its calls. */
const script = (...results: ResetResult[]) => {
  let calls = 0;
  return {
    run: () => results[Math.min(calls++, results.length - 1)] as ResetResult,
    calls: () => calls,
  };
};

describe('a transient supabase db reset failure does not fail a database gate', () => {
  it('resets again when the CLI died in schema initialisation (LegacyDbSetupError) and succeeds on the next attempt', () => {
    const cli = script(failed(SCHEMA_INITIALISATION_FAILED), succeeded);
    expect(reset.resetLocalDatabase({ run: cli.run })).toEqual({
      ok: true,
      attempts: 2,
      status: 0,
    });
    expect(cli.calls()).toBe(2);
  });

  it('resets again when a service did not come up healthy (LegacyHealthCheckTimeoutError)', () => {
    const cli = script(failed(SERVICE_NOT_HEALTHY), succeeded);
    expect(reset.resetLocalDatabase({ run: cli.run }).ok).toBe(true);
    expect(cli.calls()).toBe(2);
  });

  it('does not retry a migration error: a deterministic failure fails on the first attempt with its own status', () => {
    const cli = script(failed(MIGRATION_REFUSED, 7), succeeded);
    expect(reset.resetLocalDatabase({ run: cli.run })).toEqual({
      ok: false,
      attempts: 1,
      status: 7,
    });
    expect(cli.calls()).toBe(1);
  });

  it('gives up after the attempt limit and reports the last status', () => {
    const cli = script(failed(SCHEMA_INITIALISATION_FAILED, 1));
    expect(reset.RESET_ATTEMPTS).toBe(3);
    expect(reset.resetLocalDatabase({ run: cli.run })).toEqual({
      ok: false,
      attempts: 3,
      status: 1,
    });
    expect(cli.calls()).toBe(3);
  });

  it('never reports success for a signalled CLI (status null) and still reports a status', () => {
    const cli = script({ status: null, stdout: '', stderr: '' });
    expect(reset.resetLocalDatabase({ run: cli.run })).toEqual({
      ok: false,
      attempts: 1,
      status: 1,
    });
  });

  it('reports each failed attempt with its number and exit status before it retries', () => {
    const messages: string[] = [];
    reset.resetLocalDatabase({
      run: script(failed(SCHEMA_INITIALISATION_FAILED), succeeded).run,
      report: (message) => messages.push(message),
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('attempt 1 of 3');
    expect(messages[0]).toContain('exit 1');
    expect(messages[0]).toContain('LegacyDbSetupError');
  });

  it('classifies only the CLI infrastructure failures as transient', () => {
    expect(reset.isTransientResetFailure(SCHEMA_INITIALISATION_FAILED)).toBe(
      true,
    );
    expect(reset.isTransientResetFailure(SERVICE_NOT_HEALTHY)).toBe(true);
    expect(reset.isTransientResetFailure(MIGRATION_REFUSED)).toBe(false);
    expect(reset.isTransientResetFailure('')).toBe(false);
  });

  it('is what pnpm db:reset runs, so db:verify, the race gate and the evidence runner all get it', () => {
    const scripts = (
      JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      }
    ).scripts;
    expect(scripts['db:reset']).toBe('node infra/reset-local-database.mjs');
    expect((scripts['db:verify'] ?? '').startsWith('pnpm db:reset && ')).toBe(
      true,
    );
  });
});
