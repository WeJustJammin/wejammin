import { basename, dirname, join, resolve } from 'node:path';

import { requireFact } from './delivery-receiving-upgrade-target.mjs';
import { MIGRATION } from './delivery-receiving-upgrade-local-target.mjs';
import {
  manifestHash,
  readRegular,
  sha256,
} from './delivery-receiving-upgrade-local-inventory.mjs';
import {
  sameValue,
  snapshot,
} from './delivery-receiving-upgrade-host-request.mjs';

async function optional(fs, path) {
  try {
    return await readRegular(fs, path);
  } catch (error) {
    if (error?.code === 'ENOENT' || /^ENOENT /.test(error?.message ?? ''))
      return undefined;
    throw error;
  }
}

async function files(
  fs,
  directory,
  logicalDirectory = directory,
  promoted = false,
) {
  const names = (await fs.readdir(directory))
    .filter((name) => !promoted || name.endsWith('.sql'))
    .sort();
  const versions = new Set();
  const entries = [];
  for (const name of names) {
    const version = /^([0-9]{14})_[A-Za-z0-9_]+\.sql$/.exec(name)?.[1];
    requireFact(
      version &&
        !versions.has(version) &&
        (version !== MIGRATION.slice(0, 14) || name === MIGRATION),
      'unexpected or ambiguous migration file',
    );
    versions.add(version);
    const bytes = await readRegular(fs, join(directory, name));
    requireFact(bytes.length > 0, 'empty migration file');
    entries.push({
      path: join(logicalDirectory, name),
      bytes,
      sha256: sha256(bytes),
    });
  }
  requireFact(entries.length > 0, 'empty migration inventory');
  return entries;
}

export function assertInventory(actual, expected, label) {
  requireFact(
    sameValue(actual, expected),
    `${label} full byte inventory mismatch`,
  );
}

function assertConfig(bytes, target) {
  let section = '';
  const fields = new Map();
  for (const line of bytes.toString('utf8').split(/\r?\n/)) {
    const header = /^\s*\[([\w.]+)\]\s*(?:#.*)?$/.exec(line);
    if (header) section = header[1];
    const field =
      /^\s*(project_id|port|major_version)\s*=\s*("[^"\r\n]*"|\d+)\s*(?:#.*)?$/.exec(
        line,
      );
    if (!field) continue;
    const key = `${section}.${field[1]}`;
    requireFact(!fields.has(key), 'duplicate ALT configuration field');
    fields.set(key, JSON.parse(field[2]));
  }
  requireFact(
    fields.get('.project_id') === target.projectId &&
      fields.get('api.port') === target.apiPort &&
      fields.get('db.port') === target.dbPort &&
      fields.get('db.major_version') === 17,
    'foreign ALT configuration',
  );
}

// Repository authority comes from both actual ALT fixture links, never a fake Plan.
export async function observeSource(fs, request, raw, first) {
  const supabase = join(request.target.workdir, 'supabase');
  const tests = await fs.realpath(join(supabase, 'tests'));
  requireFact(
    tests.endsWith('/supabase/tests') && resolve(tests) === tests,
    'invalid linked test inventory',
  );
  const repository = dirname(dirname(tests));
  const seedPath = join(repository, 'supabase/seed.sql');
  requireFact(
    (await fs.realpath(join(supabase, 'seed.sql'))) === seedPath,
    'foreign linked seed inventory',
  );
  const directory = join(repository, 'supabase/migrations');
  requireFact(
    (await fs.realpath(directory)) === directory,
    'foreign promoted directory',
  );
  const baseline = await files(fs, directory, directory, true);
  const prefix = baseline.filter(
    (entry) =>
      basename(entry.path) < MIGRATION &&
      basename(entry.path).slice(0, 14) < MIGRATION.slice(0, 14),
  );
  requireFact(prefix.length > 0, 'empty actual predecessor prefix');
  const selected = request.purpose === 'prefix' ? prefix : baseline;
  assertInventory(request.inventory, selected, 'request/actual');
  requireFact(
    manifestHash(selected) === request.inventorySha256,
    'actual inventory digest drift',
  );
  const source = await optional(fs, join(directory, MIGRATION));
  requireFact(source, 'actual migration source missing');
  const witness = await readRegular(
    fs,
    join(
      tests,
      'phase_02_slice_11_delivery_receiving/080-forward-migration.sqlinc',
    ),
  );
  requireFact(
    source.equals(witness) &&
      sha256(source) === request.sourceSha256 &&
      sha256(witness) === request.witnessSha256,
    'complete source/080 parity drift',
  );
  const stage = await fs.realpath(join(supabase, 'migrations'));
  const staged = await files(fs, stage, directory);
  assertInventory(staged, selected, 'staged');
  assertInventory(raw.promotedInventory, baseline, 'observed promoted');
  assertInventory(raw.stagedInventory, selected, 'observed staged');
  const config = await readRegular(fs, join(supabase, 'config.toml'));
  assertConfig(config, request.target);
  const observed = snapshot({
    repository,
    stage,
    baseline,
    prefix,
    selected,
    source,
    witness,
    seed: await readRegular(fs, seedPath),
    config,
  });
  if (first)
    requireFact(
      sameValue(observed, first),
      'source changed during owned reset',
    );
  return observed;
}
