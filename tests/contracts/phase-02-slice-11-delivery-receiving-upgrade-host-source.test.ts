import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  fixture,
  promoted,
  targetName,
  type Fixture,
} from './phase-02-slice-11-delivery-receiving-upgrade-local-fixtures';

// Host adapter observeSource: promoted-only target-source parity. Unit data/IO only; the mock
// filesystem is the only source and nothing here replays SQL or touches a database.
const sha = (bytes: Buffer | string): string =>
  createHash('sha256').update(bytes).digest('hex');
const host = async () =>
  (await import(
    new URL(
      '../../infra/database-upgrades/delivery-receiving-upgrade-host-source.mjs',
      import.meta.url,
    ).href
  )) as {
    observeSource(
      fs: Fixture['fs'],
      request: Record<string, unknown>,
      raw: Record<string, unknown>,
      first: unknown,
    ): Promise<unknown>;
  };
const shape = (entry: { path: string; bytes: Buffer; sha256: string }) => ({
  path: entry.path,
  bytes: Buffer.from(entry.bytes),
  sha256: entry.sha256,
});
const manifest = (entries: Array<{ path: string; sha256: string }>) =>
  sha(
    entries
      .map((entry) => `${entry.path.split('/').at(-1)}\t${entry.sha256}\n`)
      .join(''),
  );

function build(mock: Fixture, purpose: 'prefix' | 'baseline') {
  const baseline = mock.entries.map(shape);
  const prefix = baseline.filter(
    (entry) => entry.path.split('/').at(-1)! < targetName,
  );
  const selected = purpose === 'prefix' ? prefix : baseline;
  return {
    request: {
      target: mock.plan.target,
      purpose,
      inventory: selected,
      inventorySha256: manifest(selected),
      sourceSha256: mock.plan.sourceSha256,
      witnessSha256: mock.plan.witnessSha256,
    } as Record<string, unknown>,
    raw: { promotedInventory: baseline, stagedInventory: selected },
  };
}

describe('DEC-197 host observeSource target-source parity', () => {
  it('DR-UT-H00 accepts the genuine promoted baseline (the arrangement is real)', async () => {
    const mock = await fixture();
    const { request, raw } = build(mock, 'baseline');
    await expect(
      (await host()).observeSource(mock.fs, request, raw, undefined),
    ).resolves.toBeTruthy();
  });

  const stale = Buffer.from('-- stale promoted copy\n');
  const cases: Array<
    [string, (mock: Fixture, request: Record<string, unknown>) => void]
  > = [
    [
      'promoted bytes differ from 080 and from the request hashes',
      (mock) => mock.fs.put(join(promoted, targetName), { bytes: stale }),
    ],
    [
      'promoted differs from 080 although it matches its own request hash',
      (mock, request) => {
        mock.fs.put(join(promoted, targetName), { bytes: stale });
        request.sourceSha256 = sha(stale);
      },
    ],
    [
      'request source hash is forged',
      (_mock, request) => {
        request.sourceSha256 = 'f'.repeat(64);
      },
    ],
    [
      'request witness hash is forged',
      (_mock, request) => {
        request.witnessSha256 = 'f'.repeat(64);
      },
    ],
  ];
  for (const [index, [name, arrange]] of cases.entries()) {
    it(`DR-UT-H0${index + 1} refuses: ${name}`, async () => {
      const mock = await fixture();
      const { request, raw } = build(mock, 'prefix');
      arrange(mock, request);
      await expect(
        (await host()).observeSource(mock.fs, request, raw, undefined),
      ).rejects.toThrow('complete source/080 parity drift');
    });
  }

  it('DR-UT-H05 refuses when the promoted target file is absent', async () => {
    const mock = await fixture();
    const { request, raw } = build(mock, 'prefix');
    mock.fs.entries.delete(join(promoted, targetName));
    await expect(
      (await host()).observeSource(mock.fs, request, raw, undefined),
    ).rejects.toThrow('actual migration source missing');
  });
});
