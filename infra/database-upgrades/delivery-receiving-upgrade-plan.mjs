import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { basename, isAbsolute, join, normalize } from 'node:path';

import {
  hashText,
  identifier,
  isRecord,
  requireFact,
  sealTarget,
} from './delivery-receiving-upgrade-target.mjs';

export { classifyMigrationOutcome } from './delivery-receiving-upgrade-outcome.mjs';
export { compareRollback } from './delivery-receiving-upgrade-snapshot.mjs';
export { assertCommittedReceivingCatalog } from './delivery-receiving-upgrade-catalog.mjs';

export const MIGRATION = '20261016030000_delivery_receiving_contracts.sql';
export const SESSION_SQL =
  "select pg_catalog.jsonb_build_object('witness','DEC197_MIGRATION_SESSION_V1','database',pg_catalog.current_database(),'databaseOid',(select oid::text from pg_catalog.pg_database where datname=pg_catalog.current_database()),'backendPid',pg_catalog.pg_backend_pid(),'applicationName',pg_catalog.current_setting('application_name'))::text;";
export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');

function repositoryPath(value) {
  requireFact(
    typeof value === 'string' &&
      isAbsolute(value) &&
      normalize(value) === value &&
      !/[\0\r\n]/.test(value),
    'absolute repository required',
  );
  return value;
}

function sourcePath(repository) {
  return join(repository, 'supabase/migrations', MIGRATION);
}

function bytes(value, label) {
  requireFact(
    Buffer.isBuffer(value) && value.length > 0,
    `${label} bytes required`,
  );
  return Buffer.from(value);
}

/**
 * Optional reads are injected; only `undefined` means absent. The migration is promoted
 * (immutable in supabase/migrations) and has no other home, so absence refuses.
 */
export function resolveMigrationSource({ repository, readOptional } = {}) {
  repositoryPath(repository);
  requireFact(typeof readOptional === 'function', 'source reader required');
  const path = sourcePath(repository);
  const read = readOptional(path);
  requireFact(read !== undefined, 'migration missing');
  const content = bytes(read, 'promoted source');
  return Object.freeze({ path, bytes: content, sha256: sha256(content) });
}

function prefixManifest(value, repository) {
  requireFact(
    isRecord(value) &&
      Array.isArray(value.entries) &&
      Array.isArray(value.expectedPaths) &&
      value.entries.length > 0 &&
      value.expectedPaths.length === value.entries.length,
    'complete prefix required',
  );
  const versions = new Set();
  let previous = '';
  const entries = value.entries.map((entry, index) => {
    requireFact(
      isRecord(entry) && typeof entry.path === 'string',
      'prefix entry',
    );
    const name = basename(entry.path);
    const version = /^([0-9]{14})_[A-Za-z0-9_]+\.sql$/.exec(name)?.[1];
    requireFact(
      version &&
        name < MIGRATION &&
        version < MIGRATION.slice(0, 14) &&
        entry.path === join(repository, 'supabase/migrations', name) &&
        value.expectedPaths[index] === entry.path &&
        name > previous &&
        !versions.has(version),
      'prefix order, inventory or version mismatch',
    );
    previous = name;
    versions.add(version);
    const content = bytes(entry.bytes, 'prefix');
    const digest = sha256(content);
    requireFact(
      hashText(entry.sha256) && entry.sha256 === digest,
      'prefix byte drift',
    );
    return Object.freeze({ path: entry.path, bytes: content, sha256: digest });
  });
  const manifest = entries
    .map((entry) => `${basename(entry.path)}\t${entry.sha256}\n`)
    .join('');
  return {
    prefixSha256: sha256(Buffer.from(manifest, 'utf8')),
    prefixManifest: Object.freeze({
      expectedPaths: Object.freeze(entries.map((entry) => entry.path)),
      entries: Object.freeze(entries),
    }),
  };
}

export function buildUpgradePlan(input) {
  requireFact(isRecord(input), 'plan input required');
  const repository = repositoryPath(input.repository);
  requireFact(
    input.targetMigration === MIGRATION &&
      ['negative', 'positive'].includes(input.mode),
    'migration/mode mismatch',
  );
  requireFact(
    typeof input.runId === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(input.runId),
    'unsafe run ID',
  );
  const applicationName = `dec197_upgrade_${input.runId}_${input.mode}`;
  requireFact(
    identifier(applicationName),
    'application name exceeds PostgreSQL bound',
  );
  const target = sealTarget(input.target);
  requireFact(
    isRecord(input.source) && input.source.path === sourcePath(repository),
    'foreign source path',
  );
  const content = bytes(input.source.bytes, 'source');
  const witness = bytes(input.witness, 'whole migration witness');
  const sourceSha256 = sha256(content);
  requireFact(
    input.source.sha256 === sourceSha256 && content.equals(witness),
    'source/copy byte mismatch',
  );
  const prefix = prefixManifest(input.prefixManifest, repository);
  return Object.freeze({
    repository,
    targetMigration: MIGRATION,
    mode: input.mode,
    runId: input.runId,
    target,
    source: Object.freeze({
      path: input.source.path,
      bytes: content,
      sha256: sourceSha256,
    }),
    witness,
    applicationName,
    sourceSha256,
    witnessSha256: sha256(witness),
    ...prefix,
  });
}

/** Rebuild bindings before any injected I/O, including for caller-forged plans. */
export function assertUpgradePlan(plan) {
  const rebuilt = buildUpgradePlan(plan);
  for (const key of [
    'applicationName',
    'sourceSha256',
    'witnessSha256',
    'prefixSha256',
  ]) {
    requireFact(plan[key] === rebuilt[key], `forged plan ${key}`);
  }
  return rebuilt;
}

export function buildPsqlInvocation({
  target,
  applicationName,
  script,
  mode,
} = {}) {
  const sealed = sealTarget(target);
  requireFact(
    identifier(applicationName) && ['negative', 'positive'].includes(mode),
    'unsafe application/mode',
  );
  return Object.freeze({
    command: 'docker',
    args: Object.freeze([
      'exec',
      '-i',
      '-e',
      `PGAPPNAME=${applicationName}`,
      sealed.container,
      'psql',
      '-X',
      '-U',
      'postgres',
      '-d',
      sealed.database,
      '-v',
      `ON_ERROR_STOP=${mode === 'negative' ? 0 : 1}`,
      '-v',
      'VERBOSITY=verbose',
      '-A',
      '-t',
      '-c',
      SESSION_SQL,
      '-f',
      '-',
    ]),
    input: bytes(script, 'unwrapped migration'),
  });
}
