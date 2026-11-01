import { Buffer } from 'node:buffer';
import { join } from 'node:path';

import {
  assertIdentity,
  exactKeys,
  hashText,
  identifier,
  isRecord,
  positivePid,
  requireFact,
  sealTarget,
} from './delivery-receiving-upgrade-target.mjs';
import { proveLease } from './delivery-receiving-upgrade-local-child.mjs';

export const MIGRATION = '20261016030000_delivery_receiving_contracts.sql';
export const SUPABASE =
  '/home/rob/.codex/worktrees/phase2-slice11/WeJammin/node_modules/.bin/supabase';
export const SESSION_SQL =
  "select pg_catalog.jsonb_build_object('witness','DEC197_MIGRATION_SESSION_V1','database',pg_catalog.current_database(),'databaseOid',(select oid::text from pg_catalog.pg_database where datname=pg_catalog.current_database()),'backendPid',pg_catalog.pg_backend_pid(),'applicationName',pg_catalog.current_setting('application_name'))::text;";
export const INSPECT_TEMPLATE =
  '{"id":{{json .Id}},"projectId":{{json (index .Config.Labels "com.supabase.cli.project")}},"dbPort":{{json (index (index (index .NetworkSettings.Ports "5432/tcp") 0) "HostPort")}}}';
export const ALT_TARGET_SQL = [
  "select pg_catalog.jsonb_build_object('witness','DEC197_ALT_TARGET_V1',",
  "'clusterId',(select system_identifier::text from pg_catalog.pg_control_system()),",
  "'databaseOid',d.oid::text,'owner',pg_catalog.pg_get_userbyid(d.datdba),",
  "'encoding',pg_catalog.pg_encoding_to_char(d.encoding),'collation',d.datcollate,",
  "'connectionLimit',d.datconnlimit,'databaseAcl',d.datacl,",
  "'configurationRows',(select count(*) from pg_catalog.pg_db_role_setting s where s.setdatabase=d.oid),",
  "'configurationKeys',(select coalesce(pg_catalog.jsonb_agg(k.key order by k.key),'[]'::jsonb) from (",
  "select distinct pg_catalog.split_part(v.setting,'=',1) as key from pg_catalog.pg_db_role_setting s ",
  'cross join lateral pg_catalog.unnest(s.setconfig) as v(setting) where s.setdatabase=d.oid) k))::text ',
  'from pg_catalog.pg_database d where d.datname=pg_catalog.current_database();\n',
].join('');
export const APPLIED_HISTORY_SQL = [
  "select pg_catalog.jsonb_build_object('witness','DEC197_APPLIED_HISTORY_V1','appliedMigrations',",
  "coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('version',m.version,'name',m.name) ",
  'order by m.version collate "C",m.name collate "C"),\'[]\'::jsonb))::text ',
  'from supabase_migrations.schema_migrations m;\n',
].join('');

export function dependencies(options) {
  requireFact(isRecord(options), 'explicit local dependencies required');
  const { fs, process, clock, lease } = options;
  for (const method of [
    'readFile',
    'readdir',
    'lstat',
    'stat',
    'realpath',
    'readlink',
    'mkdtemp',
    'writeFile',
    'symlink',
    'rename',
    'unlink',
    'rmdir',
  ]) {
    requireFact(
      typeof fs?.[method] === 'function',
      `injected fs.${method} required`,
    );
  }
  requireFact(
    positivePid(process?.pid) &&
      typeof process.run === 'function' &&
      typeof process.spawn === 'function',
    'injected process ports required',
  );
  for (const method of ['now', 'setTimeout', 'clearTimeout']) {
    requireFact(
      typeof clock?.[method] === 'function',
      `injected clock.${method} required`,
    );
  }
  requireFact(
    isRecord(lease) &&
      positivePid(lease.ownerPid) &&
      Array.isArray(lease.locks) &&
      lease.locks.length === 4,
    'four-lock lease required',
  );
  const copied = Object.freeze({
    ownerPid: lease.ownerPid,
    locks: Object.freeze(lease.locks.map((lock) => Object.freeze({ ...lock }))),
  });
  return { fs, process, clock, lease: copied };
}

export function invocation(plan, phase, input) {
  const target = sealTarget(plan.target);
  const applicationName =
    phase === 'migration'
      ? plan.applicationName
      : `${plan.applicationName}-${phase}`;
  requireFact(identifier(applicationName), 'invalid phase application name');
  return {
    command: 'docker',
    args: [
      'exec',
      '-i',
      '-e',
      `PGAPPNAME=${applicationName}`,
      target.container,
      'psql',
      '-X',
      '-U',
      'postgres',
      '-d',
      target.database,
      '-v',
      `ON_ERROR_STOP=${phase === 'migration' && plan.mode === 'negative' ? 0 : 1}`,
      '-v',
      'VERBOSITY=verbose',
      '-A',
      '-t',
      '-c',
      SESSION_SQL,
      '-f',
      '-',
    ],
    input: Buffer.from(input),
  };
}

export async function probe(process, plan, sql) {
  const command = invocation(plan, 'migration', Buffer.from(sql));
  command.args[12] = 'ON_ERROR_STOP=1';
  command.args = [...command.args.slice(0, -6), '-A', '-t', '-f', '-'];
  const result = await process.run(command);
  requireFact(
    result?.status === 0 &&
      typeof result.stdout === 'string' &&
      result.stderr === '',
    'read-only probe failed',
  );
  const lines = result.stdout.split(/\r?\n/).filter((line) => line.trim());
  requireFact(lines.length === 1, 'ambiguous probe document');
  return JSON.parse(lines[0]);
}

function configFacts(text, target) {
  let section = '';
  const fields = new Map();
  for (const line of text.split(/\r?\n/)) {
    const header = /^\s*\[([\w.]+)\]\s*(?:#.*)?$/.exec(line);
    if (header) section = header[1];
    const field =
      /^\s*(project_id|port|major_version)\s*=\s*("[^"\r\n]*"|\d+)\s*(?:#.*)?$/.exec(
        line,
      );
    if (!field) continue;
    const key = `${section}.${field[1]}`;
    requireFact(!fields.has(key), 'duplicate target config field');
    fields.set(
      key,
      field[2].startsWith('"') ? JSON.parse(field[2]) : Number(field[2]),
    );
  }
  requireFact(
    fields.get('.project_id') === target.projectId &&
      fields.get('api.port') === target.apiPort &&
      fields.get('db.port') === target.dbPort &&
      fields.get('db.major_version') === 17,
    'foreign ALT config',
  );
}

export function createTargetGuard(deps) {
  return async (plan, pinned) => {
    const target = sealTarget(plan.target);
    await proveLease(deps, target);
    configFacts(
      String(
        await deps.fs.readFile(
          join(target.workdir, 'supabase/config.toml'),
          'utf8',
        ),
      ),
      target,
    );
    const inspected = await deps.process.run({
      command: 'docker',
      args: ['inspect', '--format', INSPECT_TEMPLATE, target.container],
    });
    requireFact(
      inspected?.status === 0 && inspected.stderr === '',
      'container probe failed',
    );
    const docker = JSON.parse(inspected.stdout);
    requireFact(
      exactKeys(docker, ['id', 'projectId', 'dbPort']) &&
        hashText(docker.id) &&
        docker.projectId === target.projectId &&
        docker.dbPort === String(target.dbPort),
      'foreign container',
    );
    const metadata = await probe(deps.process, plan, ALT_TARGET_SQL);
    requireFact(
      exactKeys(metadata, [
        'witness',
        'clusterId',
        'databaseOid',
        'owner',
        'encoding',
        'collation',
        'connectionLimit',
        'databaseAcl',
        'configurationRows',
        'configurationKeys',
      ]) &&
        metadata.witness === 'DEC197_ALT_TARGET_V1' &&
        metadata.owner === 'postgres' &&
        metadata.encoding === 'UTF8' &&
        metadata.collation === 'en_US.UTF-8' &&
        metadata.connectionLimit === -1 &&
        Number.isSafeInteger(metadata.configurationRows) &&
        metadata.configurationRows >= 0 &&
        Array.isArray(metadata.configurationKeys) &&
        metadata.configurationKeys.every(
          (key) => typeof key === 'string' && /^[a-z][a-z0-9_.-]*$/.test(key),
        ) &&
        (metadata.databaseAcl === null ||
          (Array.isArray(metadata.databaseAcl) &&
            metadata.databaseAcl.every((acl) => typeof acl === 'string'))),
      'invalid nonsecret DB envelope',
    );
    const identity = {
      target,
      containerId: docker.id,
      clusterId: metadata.clusterId,
      databaseOid: metadata.databaseOid,
      owner: metadata.owner,
    };
    assertIdentity(identity, target, pinned);
    requireFact(
      !pinned || pinned.owner === identity.owner,
      'changed database owner',
    );
    return { ...identity, metadata };
  };
}

export function requireOwnedResetPorts(process) {
  const ports = {};
  for (const method of [
    'beginOwnedReset',
    'completeOwnedReset',
    'proveRecoveryOwnership',
  ]) {
    requireFact(
      typeof process[method] === 'function',
      `injected process.${method} required`,
    );
    ports[method] = process[method].bind(process);
  }
  return Object.freeze(ports);
}

// Observation alone grants no authority: the private lifecycle must also bind
// this candidate to its native registry handle and drained raw completion.
export function createResetCandidateObserver(deps, initial) {
  const observe = createTargetGuard(deps);
  return async (plan) => {
    const actual = await observe(plan);
    requireFact(
      actual.owner === initial.owner &&
        actual.databaseOid === initial.databaseOid &&
        JSON.stringify({ ...actual.metadata, clusterId: null }) ===
          JSON.stringify({ ...initial.metadata, clusterId: null }),
      'reset changed logical/nonsecret database envelope',
    );
    return actual;
  };
}
