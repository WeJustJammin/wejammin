import { Buffer } from 'node:buffer';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  fixture,
  expectStaged,
  localAdapter,
  manifestHash,
  noReset,
  noMutationProcess,
  promoted,
  repository,
  supabaseBinary,
  targetName,
  type Fixture,
} from './phase-02-slice-11-delivery-receiving-upgrade-local-fixtures';

// Raw filesystem/process unit doubles only. No DB, CLI or reset is executed.
async function prepared(mock: Fixture) {
  const adapter = await localAdapter('prefix', mock);
  const attestation = await adapter.preparePrefix(mock.plan);
  return { adapter, attestation };
}
const migrationsLink = (mock: Fixture) =>
  join(mock.plan.target.workdir, 'supabase/migrations');

describe('DEC-197 real-boundary local prefix adapter decisions', () => {
  it('DR-UL-P01 independently reads actual inventory/bytes with read-only attestation', async () => {
    const mock = await fixture();
    const { attestation } = await prepared(mock);
    expect(mock.entries.length).toBeGreaterThan(400);
    expect(attestation).toMatchObject(mock.attested);
    expect(attestation.prefixSha256).toBe(
      manifestHash(mock.plan.prefixManifest.entries),
    );
    expect(attestation.baselineSha256).toBe(manifestHash(mock.entries));
    noReset(mock);
    expect(mock.process.run).toHaveBeenCalled();
    for (const [command] of mock.process.run.mock.calls) {
      expect(command.command).toBe('docker');
      expect(command.args).toContain(mock.plan.target.container);
      expect(command.args).not.toContain('sh');
      expect(command.args).not.toContain('bash');
      if (command.args[0] === 'inspect') {
        expect(command.args).toContain('--format');
        expect(command.args.join(' ')).not.toMatch(/Config\.Env|\.Config\s*}}/);
      }
      const sql = command.input?.toString() ?? command.args.join(' ');
      expect(sql).not.toMatch(
        /current_setting\s*\([^)]*app\.settings\.jwt|set_config\s*\(/i,
      );
      expect(sql).not.toMatch(
        /alter\s+(database|role)|pg_terminate_backend|drop\s+database/i,
      );
    }
  });

  it('DR-UL-P02 agreeing caller omissions do not redefine the complete source inventory', async () => {
    const mock = await fixture();
    mock.plan.prefixManifest.entries.shift();
    mock.plan.prefixManifest.expectedPaths.shift();
    mock.plan.prefixSha256 = manifestHash(mock.plan.prefixManifest.entries);
    const adapter = await localAdapter('prefix', mock);
    await expect(adapter.preparePrefix(mock.plan)).rejects.toThrow();
    noReset(mock);
  });

  for (const name of [
    'changed bytes',
    'symlink',
    'duplicate version',
    'invalid timestamp',
  ]) {
    it(`DR-UL-P03 actual inventory ${name} refuses despite consistent caller arrays`, async () => {
      const mock = await fixture();
      const entry = mock.entries[0]!;
      if (name === 'changed bytes') {
        const bytes = Buffer.concat([
          entry.bytes,
          Buffer.from('\n-- actual drift\n'),
        ]);
        mock.fs.put(entry.path, { bytes });
      }
      if (name === 'symlink') {
        const sameBytes = '/tmp/dec197-same-bytes.sql';
        mock.fs.put(sameBytes, { bytes: Buffer.from(entry.bytes) });
        mock.fs.put(entry.path, { link: sameBytes });
      }
      if (name === 'duplicate version')
        mock.fs.put(
          join(
            promoted,
            `${entry.path.split('/').at(-1)!.slice(0, 14)}_duplicate.sql`,
          ),
          { bytes: entry.bytes },
        );
      if (name === 'invalid timestamp')
        mock.fs.put(join(promoted, 'not_a_version.sql'), {
          bytes: entry.bytes,
        });
      const adapter = await localAdapter('prefix', mock);
      await expect(adapter.preparePrefix(mock.plan)).rejects.toThrow();
      noReset(mock);
    });
  }

  for (const [key, value] of [
    ['kind', 'generic'],
    ['projectId', 'wejammin'],
    ['container', 'supabase_db_wejammin'],
    ['database', 'template1'],
    ['dbPort', 54322],
    ['apiPort', 54321],
    ['workdir', repository],
  ] as const) {
    it(`DR-UL-P04 bare or foreign target ${key} never grants reset authority`, async () => {
      const mock = await fixture();
      Object.assign(mock.plan.target, { [key]: value });
      const adapter = await localAdapter('prefix', mock);
      await expect(adapter.preparePrefix(mock.plan)).rejects.toThrow();
      noReset(mock);
    });
  }

  for (const name of ['project', 'db port', 'API port', 'comment decoy']) {
    it(`DR-UL-P05 actual ALT config ${name} mismatch fails before mutation`, async () => {
      const mock = await fixture();
      const path = join(mock.plan.target.workdir, 'supabase/config.toml');
      let config = String(await mock.fs.readFile(path, 'utf8'));
      if (name === 'project')
        config = config.replace(
          'project_id = "wejammin_ev"',
          'project_id = "wejammin"',
        );
      if (name === 'db port')
        config = config.replace('port = 55322', 'port = 54322');
      if (name === 'API port')
        config = config.replace('port = 55321', 'port = 54321');
      if (name === 'comment decoy')
        config = config.replace(
          'project_id = "wejammin_ev"',
          '# project_id = "wejammin_ev"\nproject_id = "foreign"',
        );
      mock.fs.put(path, { bytes: Buffer.from(config) });
      const adapter = await localAdapter('prefix', mock);
      await expect(adapter.preparePrefix(mock.plan)).rejects.toThrow();
      noReset(mock);
    });
  }

  for (const name of [
    'container replacement',
    'lost lock',
    'inventory drift',
    'cluster replacement',
    'seed drift',
    'target source drift',
  ]) {
    it(`DR-UL-P07 rechecks ${name} after preflight and before reset`, async () => {
      const mock = await fixture();
      const { adapter, attestation } = await prepared(mock);
      if (name === 'container replacement')
        mock.state.containerId = 'b'.repeat(64);
      if (name === 'lost lock')
        mock.fs.put('/proc/locks', { bytes: Buffer.alloc(0) });
      if (name === 'inventory drift')
        mock.fs.put(mock.entries[0]!.path, {
          bytes: Buffer.from('changed after attestation'),
        });
      if (name === 'cluster replacement')
        mock.state.metadata.clusterId = '1111111111111111111';
      if (name === 'seed drift')
        mock.fs.put(join(repository, 'supabase/seed.sql'), {
          bytes: Buffer.from('-- changed seed after attestation\n'),
        });
      if (name === 'target source drift')
        mock.fs.put(mock.plan.source.path, {
          bytes: Buffer.from('-- changed target source after attestation\n'),
        });
      await expect(
        adapter.resetBefore(mock.plan, attestation),
      ).rejects.toThrow();
      noReset(mock);
    });
  }

  it('DR-UL-P08 prefix reset uses verified staged bytes; final reset restores ordinary promoted baseline', async () => {
    const mock = await fixture();
    const { adapter, attestation } = await prepared(mock);
    expect(attestation.baselineSha256).not.toBe(attestation.prefixSha256);
    const reset = await adapter.resetBefore(mock.plan, attestation);
    expect(reset).toMatchObject({
      target: mock.plan.target,
      clusterId: attestation.clusterId,
      databaseOid: attestation.databaseOid,
      prefixSha256: attestation.prefixSha256,
    });
    expect(reset.resetEpoch).toBeTruthy();
    expect(mock.resets).toHaveLength(1);
    expect(mock.resets[0]!.files).toEqual(
      mock.plan.prefixManifest.entries.map((entry) =>
        entry.path.split('/').at(-1),
      ),
    );
    expectStaged(
      mock,
      0,
      mock.entries.filter(
        (entry) => entry.path.split('/').at(-1)! < targetName,
      ),
    );
    const restoration = await adapter.restoreBaseline(mock.plan, attestation);
    expect(restoration).toMatchObject({
      target: mock.plan.target,
      clusterId: attestation.clusterId,
      databaseOid: attestation.databaseOid,
      baselineSha256: manifestHash(mock.entries),
    });
    expect(restoration.resetEpoch).not.toBe(reset.resetEpoch);
    expect(mock.resets).toHaveLength(2);
    expect(mock.resets[1]!.files).toContain(targetName);
    expectStaged(mock, 1, mock.entries);
    expect(await mock.fs.readlink(migrationsLink(mock))).toBe(promoted);
    for (const { command } of mock.resets) {
      expect(command).toMatchObject({
        command: supabaseBinary,
        args: ['db', 'reset', '--local', '--workdir', mock.plan.target.workdir],
      });
      expect(command.args).not.toContain('--linked');
    }
  });

  for (const name of ['missing', 'extra', 'duplicate', 'renamed']) {
    it(`DR-UL-P09 independently observed applied history ${name} cannot attest reset`, async () => {
      const mock = await fixture();
      const { adapter, attestation } = await prepared(mock);
      const history = mock.plan.prefixManifest.entries.map((entry) => {
        const name = entry.path.split('/').at(-1)!;
        return { version: name.slice(0, 14), name: name.slice(15, -4) };
      });
      if (name === 'missing') history.pop();
      if (name === 'extra')
        history.push({ version: '20990101000000', name: 'foreign' });
      if (name === 'duplicate') history.push(history[0]!);
      if (name === 'renamed') history[0]!.name = 'wrong_source';
      mock.ownedReset.historyAfterReset = history;
      await expect(
        adapter.resetBefore(mock.plan, attestation),
      ).rejects.toThrow();
      expect(mock.resets).toHaveLength(1);
      expectStaged(
        mock,
        0,
        mock.entries.filter(
          (entry) => entry.path.split('/').at(-1)! < targetName,
        ),
      );
    });
  }

  it('DR-UL-P10 ambiguous reset failure still permits required final restoration', async () => {
    const mock = await fixture();
    const { adapter, attestation } = await prepared(mock);
    const failure = Object.assign(new Error('ambiguous reset exit'), {
      code: 'ETIMEDOUT',
    });
    mock.state.resetError = failure;
    await expect(adapter.resetBefore(mock.plan, attestation)).rejects.toBe(
      failure,
    );
    mock.state.resetError = undefined;
    await expect(
      adapter.restoreBaseline(mock.plan, attestation),
    ).resolves.toMatchObject({
      baselineSha256: attestation.baselineSha256,
    });
    expect(mock.resets).toHaveLength(2);
    expect(await mock.fs.readlink(migrationsLink(mock))).toBe(promoted);
  });

  it('DR-UL-P11 restoration failure is not a verified baseline or a successful cleanup', async () => {
    const mock = await fixture();
    const { adapter, attestation } = await prepared(mock);
    await adapter.resetBefore(mock.plan, attestation);
    mock.state.resetError = new Error('restore failed');
    await expect(
      adapter.restoreBaseline(mock.plan, attestation),
    ).rejects.toThrow('restore failed');
    expect(mock.resets).toHaveLength(2);
  });

  it('DR-UL-P12 no validated reset attempt means no cleanup/reset authority', async () => {
    const mock = await fixture();
    const { adapter, attestation } = await prepared(mock);
    await expect(
      adapter.restoreBaseline(mock.plan, attestation),
    ).rejects.toThrow();
    noReset(mock);
  });

  it('DR-UL-P13 forged attestation cannot reset and secret defaults never enter source digests', async () => {
    const mock = await fixture();
    const { adapter, attestation } = await prepared(mock);
    await expect(
      adapter.resetBefore(mock.plan, {
        ...attestation,
        baselineSha256: '0'.repeat(64),
      }),
    ).rejects.toThrow();
    noReset(mock);
    expect(JSON.stringify(attestation)).not.toContain('jwt_secret=');
    expect(attestation.prefixSha256).toBe(
      manifestHash(mock.plan.prefixManifest.entries),
    );
  });

  it('DR-UL-P14 captures first actual container identity rather than hardcoding unit ID', async () => {
    const mock = await fixture();
    mock.state.containerId = 'b'.repeat(64);
    const { adapter, attestation } = await prepared(mock);
    expect(attestation.containerId).toBe(mock.state.containerId);
    await expect(
      adapter.resetBefore(mock.plan, attestation),
    ).resolves.toMatchObject({
      containerId: mock.state.containerId,
    });
  });

  it('DR-UL-P15 replacement during cleanup refuses to reset the foreign replacement', async () => {
    const mock = await fixture();
    const { adapter, attestation } = await prepared(mock);
    await adapter.resetBefore(mock.plan, attestation);
    mock.state.containerId = 'b'.repeat(64);
    await expect(
      adapter.restoreBaseline(mock.plan, attestation),
    ).rejects.toThrow();
    expect(mock.resets).toHaveLength(1);
    noMutationProcess(mock, 1);
  });

  it('DR-UL-P16 omitted raw filesystem dependency has no host fallback', async () => {
    const mock = await fixture();
    mock.fs = undefined as unknown as typeof mock.fs;
    await expect(async () => {
      const adapter = await localAdapter('prefix', mock);
      await adapter.preparePrefix(mock.plan);
    }).rejects.toThrow();
    noMutationProcess(mock);
  });

  it('DR-UL-P17 unexpected stage contents survive cleanup while baseline reset is attempted', async () => {
    const mock = await fixture();
    const { adapter, attestation } = await prepared(mock);
    await adapter.resetBefore(mock.plan, attestation);
    const stage = await mock.fs.realpath(migrationsLink(mock));
    expect(stage).not.toBe(promoted);
    const unrelated = join(stage, 'user.keep');
    mock.fs.put(unrelated, { bytes: Buffer.from('preserve unrelated bytes') });
    await expect(
      adapter.restoreBaseline(mock.plan, attestation),
    ).rejects.toThrow();
    expect(mock.resets).toHaveLength(2);
    expect(await mock.fs.readFile(unrelated, 'utf8')).toBe(
      'preserve unrelated bytes',
    );
  });
});
