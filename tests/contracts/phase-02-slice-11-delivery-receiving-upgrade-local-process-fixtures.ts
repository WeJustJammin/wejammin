import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { expect, vi } from 'vitest';

import type { Plan } from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';
import {
  Child,
  MemoryFs,
  INSPECT_TEMPLATE,
  ALT_TARGET_SQL,
  APPLIED_HISTORY_SQL,
  type RawCommand,
} from './phase-02-slice-11-delivery-receiving-upgrade-local-boundary-fixtures';
import {
  expectedInvocation,
  identity,
} from './phase-02-slice-11-delivery-receiving-upgrade-target-fixtures';

export const supabaseBinary =
  '/home/rob/.codex/worktrees/phase2-slice11/WeJammin/node_modules/.bin/supabase';

// Raw external process responses only; no reset/attestation business decision.
export function rawProcess(
  plan: Plan,
  fs: MemoryFs,
  initialHistory: Array<{ version: string; name: string }>,
) {
  const { target, mode } = plan;
  const state = {
    containerId: 'a'.repeat(64),
    projectId: target.projectId,
    dbPort: '55322',
    metadata: {
      witness: 'DEC197_ALT_TARGET_V1',
      clusterId: identity(target).clusterId,
      databaseOid: identity(target).databaseOid,
      owner: identity(target).owner,
      encoding: 'UTF8',
      collation: 'en_US.UTF-8',
      connectionLimit: -1,
      databaseAcl: [
        '=Tc/postgres',
        'postgres=CTc/postgres',
        'supabase_etl_admin=C/postgres',
        'supabase_storage_admin=C/postgres',
        'dashboard_user=CTc/postgres',
      ],
      configurationRows: 1,
      configurationKeys: ['app.settings.jwt_exp', 'app.settings.jwt_secret'],
    },
    history: undefined as Array<{ version: string; name: string }> | undefined,
    appliedHistory: initialHistory.map((entry) => ({ ...entry })),
    resetError: undefined as Error | undefined,
  };
  const readOnlyCalls: RawCommand[] = [];
  const resets: Array<{
    command: RawCommand;
    files: string[];
    staged: Array<{
      name: string;
      regular: boolean;
      bytes: Buffer | null;
      sha256: string | null;
    }>;
  }> = [];
  // vi.fn records every raw entry BEFORE any assertion in these implementations.
  const run = vi.fn(async (command: RawCommand) => {
    if (command.args[0] === 'inspect') {
      expect(command).toMatchObject({
        command: 'docker',
        args: ['inspect', '--format', INSPECT_TEMPLATE, target.container],
      });
      const inspected = {
        id: state.containerId,
        projectId: state.projectId,
        dbPort: state.dbPort,
      };
      readOnlyCalls.push(command);
      return {
        status: 0,
        stderr: '',
        stdout: JSON.stringify(inspected) + '\n',
      };
    }
    if (command.args.includes('reset')) {
      const directory = await fs.realpath(
        join(target.workdir, 'supabase/migrations'),
      );
      const files = await fs.readdir(directory);
      const staged = await Promise.all(
        files.map(async (name) => {
          const path = join(directory, name);
          const stat = await fs.lstat(path);
          const regular = stat.isFile() && !stat.isSymbolicLink();
          const bytes = regular ? await fs.readFile(path) : null;
          return {
            name,
            regular,
            bytes,
            sha256:
              bytes === null
                ? null
                : createHash('sha256').update(bytes).digest('hex'),
          };
        }),
      );
      resets.push({ command, files, staged });
      expect(command).toMatchObject({
        command: supabaseBinary,
        args: ['db', 'reset', '--local', '--workdir', target.workdir],
      });
      if (state.resetError) throw state.resetError;
      state.appliedHistory = staged.map(({ name }) => ({
        version: name.slice(0, 14),
        name: name.slice(15, -4),
      }));
      return { status: 0, stdout: 'Finished supabase db reset.\n', stderr: '' };
    }
    expect(command.command).toBe('docker');
    const app = command.args[3]?.replace(/^PGAPPNAME=/, '') ?? '';
    expect(app).toMatch(/^[a-z0-9_-]{1,63}$/);
    const probe = expectedInvocation({
      ...plan,
      applicationName: app,
      mode: 'positive',
    });
    expect(command.args).toEqual([
      ...probe.args.slice(0, -6),
      '-A',
      '-t',
      '-f',
      '-',
    ]);
    const sql = command.input?.toString();
    if (sql === ALT_TARGET_SQL) {
      readOnlyCalls.push(command);
      return {
        status: 0,
        stderr: '',
        stdout: JSON.stringify(state.metadata) + '\n',
      };
    }
    expect(
      sql,
      'only literal nonsecret metadata/history probes are authorized',
    ).toBe(APPLIED_HISTORY_SQL);
    readOnlyCalls.push(command);
    const appliedMigrations = state.history ?? state.appliedHistory;
    const history = { witness: 'DEC197_APPLIED_HISTORY_V1', appliedMigrations };
    return { status: 0, stderr: '', stdout: JSON.stringify(history) + '\n' };
  });
  const children: Child[] = [];
  let acknowledgeSpawn: (child: Child) => void = () => {};
  const spawned = new Promise<Child>((resolveSpawn) => {
    acknowledgeSpawn = resolveSpawn;
  });
  const spawn = vi.fn(
    (_command: string, _args: string[], _options: Record<string, unknown>) => {
      const app = _args[3]?.replace(/^PGAPPNAME=/, '');
      const applications = [
        plan.applicationName,
        ...['setup', 'before', 'after'].map(
          (phase) => `${plan.applicationName}-${phase}`,
        ),
      ];
      expect(applications).toContain(app);
      expect(_command).toBe('docker');
      expect(_args).toEqual(
        expectedInvocation({
          ...plan,
          applicationName: app ?? '',
          mode: app === plan.applicationName ? mode : 'positive',
        }).args,
      );
      expect(_options).toMatchObject({
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const child = new Child();
      children.push(child);
      acknowledgeSpawn(child);
      return child;
    },
  );
  return {
    state,
    readOnlyCalls,
    resets,
    children,
    spawned,
    process: { pid: 4002, run, spawn },
  };
}
