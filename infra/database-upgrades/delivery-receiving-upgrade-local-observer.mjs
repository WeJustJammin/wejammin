import { dirname, join, resolve, sep } from 'node:path';

import {
  exactKeys,
  hashText,
  isRecord,
  positivePid,
  requireFact,
} from './delivery-receiving-upgrade-target.mjs';
import { readRegular } from './delivery-receiving-upgrade-local-inventory.mjs';

export const READY = 'DEC197_SETUP_READY_V1';
const lines = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
const sqlError = (text) => /\b(?:ERROR|FATAL|PANIC):/.test(text);
const uuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

export async function expandFixture(fs, repository, name) {
  const root = resolve(repository, 'supabase/tests');
  const active = new Set();
  async function expand(path) {
    requireFact(
      path.startsWith(root + sep) &&
        (await fs.realpath(path)) === path &&
        !active.has(path),
      'fixture include escape, symlink or cycle',
    );
    active.add(path);
    const text = (await readRegular(fs, path)).toString('utf8');
    const output = [];
    for (const line of text.split('\n')) {
      const include = /^\s*\\ir\s+(\S+)\s*$/.exec(line);
      if (include) {
        requireFact(
          !include[1].startsWith('/') && !/["'\0]/.test(include[1]),
          'unsafe include name',
        );
        output.push(await expand(resolve(dirname(path), include[1])));
      } else {
        requireFact(!/^\s*\\/.test(line), 'unapproved fixture metacommand');
        output.push(line);
      }
    }
    active.delete(path);
    return output.join('\n');
  }
  return expand(join(root, name));
}

function documents(stdout, witness) {
  return lines(stdout)
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line))
    .filter((document) => document?.witness === witness);
}

export function sessionMarker(stdout, applicationName, reset) {
  const records = documents(stdout, 'DEC197_MIGRATION_SESSION_V1');
  requireFact(records.length === 1, 'missing/duplicate actual client marker');
  const marker = records[0];
  requireFact(
    exactKeys(marker, [
      'witness',
      'database',
      'databaseOid',
      'backendPid',
      'applicationName',
    ]) &&
      marker.database === reset.target.database &&
      marker.databaseOid === reset.databaseOid &&
      marker.applicationName === applicationName &&
      positivePid(marker.backendPid) &&
      JSON.parse(lines(stdout)[0]).witness === marker.witness,
    'actual client identity mismatch',
  );
  return marker;
}

function tap(stdout) {
  const output = lines(stdout);
  requireFact(
    !output.some((line) => /^Bail out!/i.test(line)),
    'setup TAP bailout',
  );
  const plans = output.filter((line) => /^1\.\./.test(line));
  requireFact(
    plans.length === 1 && /^1\.\.[1-9][0-9]*$/.test(plans[0]),
    'missing/ambiguous TAP plan',
  );
  const count = Number(plans[0].slice(3));
  const assertions = output.filter((line) => /^(?:not\s+)?ok\b/.test(line));
  requireFact(
    Number.isSafeInteger(count) && assertions.length === count,
    'incomplete TAP output',
  );
  assertions.forEach((line, index) => {
    const match = /^ok\s+(\d+)(?:\s|$)/.exec(line);
    requireFact(
      match &&
        Number(match[1]) === index + 1 &&
        !/\s#\s*(?:SKIP|TODO)\b/i.test(line),
      'failed/skipped/duplicate TAP premise',
    );
  });
}

export function setupReady(stdout, stderr, plan, reset, applicationName) {
  const output = lines(stdout);
  requireFact(
    output.filter((line) => line === READY).length === 1 &&
      !sqlError(stderr) &&
      !output.some((line) => /^(?:COMMIT|ROLLBACK)$/.test(line)),
    'invalid setup ready boundary',
  );
  tap(stdout);
  const marker = sessionMarker(stdout, applicationName, reset);
  const records = documents(stdout, 'DEC197_UPGRADE_WORLD');
  requireFact(records.length === 1, 'missing/duplicate world document');
  const world = records[0];
  const negative = plan.mode === 'negative';
  requireFact(
    exactKeys(world, [
      'witness',
      'database',
      'backendPid',
      'publications',
      'consumerCount',
    ]) &&
      world.database === reset.target.database &&
      world.backendPid === marker.backendPid &&
      world.consumerCount === (negative ? '2' : '0') &&
      Array.isArray(world.publications) &&
      world.publications.length === (negative ? 2 : 0),
    'setup world mismatch',
  );
  const labels = new Set();
  const consumers = new Set();
  for (const publication of world.publications) {
    requireFact(
      exactKeys(publication, [
        'label',
        'publicationVersionId',
        'publicationHash',
        'consumerId',
        'orphanProjectionId',
      ]) &&
        ['a', 'b'].includes(publication.label) &&
        !labels.has(publication.label) &&
        uuid(publication.publicationVersionId) &&
        uuid(publication.consumerId) &&
        uuid(publication.orphanProjectionId) &&
        hashText(publication.publicationHash) &&
        !consumers.has(publication.consumerId),
      'invalid labelled historical world',
    );
    labels.add(publication.label);
    consumers.add(publication.consumerId);
  }
  requireFact(
    output.filter((line) => line === 'BEGIN').length === 1,
    'setup transaction not witnessed',
  );
  return { marker, world };
}

export function committedSetup(result, plan, reset, applicationName, sent) {
  requireFact(
    result.status === 0 && !sqlError(result.stderr) && sent,
    'setup did not commit successfully',
  );
  const output = lines(result.stdout);
  requireFact(
    output.at(-1) === 'COMMIT' &&
      output.filter((line) => line === 'COMMIT').length === 1 &&
      !output.includes('ROLLBACK'),
    'setup COMMIT not observed',
  );
  return setupReady(
    output.slice(0, -1).join('\n'),
    result.stderr,
    plan,
    reset,
    applicationName,
  );
}

export function observerDocument(result, reset, applicationName) {
  requireFact(
    result.status === 0 && !sqlError(result.stderr),
    'observer failed',
  );
  const output = lines(result.stdout);
  requireFact(
    output.at(-1) === 'ROLLBACK' &&
      output.filter((line) => line === 'BEGIN').length === 1 &&
      output.filter((line) => line === 'ROLLBACK').length === 1 &&
      !output.includes('COMMIT'),
    'observer read-only transaction not closed',
  );
  const marker = sessionMarker(result.stdout, applicationName, reset);
  const records = documents(result.stdout, 'DEC197_UPGRADE_SNAPSHOT_V1');
  requireFact(records.length === 1, 'missing/duplicate 070 snapshot');
  const document = records[0];
  requireFact(
    exactKeys(document, ['witness', 'observer', 'snapshot']) &&
      exactKeys(document.observer, ['database', 'backendPid', 'user']) &&
      document.observer.database === reset.target.database &&
      document.observer.backendPid === marker.backendPid &&
      document.observer.user === 'postgres' &&
      exactKeys(document.snapshot, [
        'catalog',
        'consumerRows',
        'publicationVersionRows',
        'receivingObjects',
      ]) &&
      isRecord(document.snapshot.catalog) &&
      isRecord(document.snapshot.receivingObjects) &&
      Object.values(document.snapshot.catalog).every(Array.isArray) &&
      ['consumerRows', 'publicationVersionRows'].every(
        (key) =>
          Array.isArray(document.snapshot[key]) &&
          document.snapshot[key].every((row) => typeof row === 'string'),
      ),
    'invalid lossless 070 document',
  );
  return { marker, document };
}
