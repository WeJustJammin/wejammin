import { Buffer } from 'node:buffer';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  apiCase,
  promoted,
  repository,
} from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';
import {
  fixture,
  localAdapter,
  noReset,
  receiving,
  targetName,
} from './phase-02-slice-11-delivery-receiving-upgrade-local-fixtures';

// Promoted-only target-source guards (the migration has no WIP twin). Unit data/IO only:
// the injected mock filesystem is the only source; nothing here proves DDL or touches a DB.
describe('DEC-197 promoted-only target-source guards', () => {
  apiCase(
    'DR-UT-R01 an absent promoted source refuses with the explicit message and no other path is read',
    (api) => {
      const calls: string[] = [];
      expect(() =>
        api.resolveMigrationSource({
          repository,
          readOptional: (path) => {
            calls.push(path);
            return undefined;
          },
        }),
      ).toThrow('migration missing');
      expect(calls).toEqual([promoted]);
    },
  );

  it('DR-UT-L01 preflight refuses promoted target bytes that differ from the plan source bytes', async () => {
    const mock = await fixture();
    mock.fs.put(mock.plan.source.path, {
      bytes: Buffer.from('-- stale promoted copy\n'),
    });
    const adapter = await localAdapter('prefix', mock);
    await expect(adapter.preparePrefix(mock.plan)).rejects.toThrow(
      'actual target source drift/divergence',
    );
    noReset(mock);
  });

  it('DR-UT-L02 preflight refuses a plan source path outside the promoted directory', async () => {
    const mock = await fixture();
    mock.plan.source.path = join(
      repository,
      'supabase/migrations-wip/dec197',
      targetName,
    );
    const adapter = await localAdapter('prefix', mock);
    await expect(adapter.preparePrefix(mock.plan)).rejects.toThrow(
      'foreign target source path',
    );
    noReset(mock);
  });

  it('DR-UT-L03 preflight refuses when the promoted target file is absent', async () => {
    const mock = await fixture();
    mock.fs.entries.delete(mock.plan.source.path);
    const adapter = await localAdapter('prefix', mock);
    await expect(adapter.preparePrefix(mock.plan)).rejects.toThrow(
      'target source missing',
    );
    noReset(mock);
  });

  it('DR-UT-L04 preflight refuses a mounted 080 replay copy that differs from the plan witness', async () => {
    const mock = await fixture();
    mock.fs.put(join(receiving, '080-forward-migration.sqlinc'), {
      bytes: Buffer.from('-- stale replay copy\n'),
    });
    const adapter = await localAdapter('prefix', mock);
    await expect(adapter.preparePrefix(mock.plan)).rejects.toThrow(
      'actual complete 080 copy drift',
    );
    noReset(mock);
  });
});
