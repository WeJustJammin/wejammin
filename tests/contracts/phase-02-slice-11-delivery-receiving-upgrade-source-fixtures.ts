import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { altTarget } from './phase-02-slice-11-delivery-receiving-upgrade-target-fixtures';
import type {
  Mode,
  PlanInput,
  PrefixEntry,
} from './phase-02-slice-11-delivery-receiving-upgrade-types';

export const repository = fileURLToPath(new URL('../../', import.meta.url));
export const target = '20261016030000_delivery_receiving_contracts.sql';
export const promoted = join(repository, 'supabase/migrations', target);
export const witness = join(
  repository,
  'supabase/tests/phase_02_slice_11_delivery_receiving/080-forward-migration.sqlinc',
);
export const digest = (bytes: Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');
export const database = (mode: Mode): string =>
  ({ negative: 'postgres', positive: 'postgres' })[mode];

let prefix: PrefixEntry[] | undefined;
export function input(mode: Mode = 'negative'): PlanInput {
  const bytes = readFileSync(witness);
  if (!prefix) {
    const directory = join(repository, 'supabase/migrations');
    prefix = readdirSync(directory)
      .filter((p) => p.endsWith('.sql') && p < target)
      .sort()
      .map((name) => {
        const path = join(directory, name);
        const content = readFileSync(path);
        return { path, bytes: content, sha256: digest(content) };
      });
  }
  return {
    repository,
    targetMigration: target,
    mode,
    runId: 'unit',
    target: altTarget(),
    source: {
      path: promoted,
      bytes: Buffer.from(bytes),
      sha256: digest(bytes),
    },
    witness: Buffer.from(bytes),
    prefixManifest: {
      expectedPaths: prefix.map((p) => p.path),
      entries: prefix.map((p) => ({ ...p, bytes: Buffer.from(p.bytes ?? []) })),
    },
  };
}
