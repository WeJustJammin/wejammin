import { createHash } from 'node:crypto';

import {
  INDEXES,
  SEQUENCE,
  TABLE_NAMES,
  TYPES,
  schemaObject,
} from './delivery-receiving-upgrade-catalog-contract.mjs';
import {
  exactKeys,
  hashText,
  isRecord,
  positivePid,
  requireFact,
} from './delivery-receiving-upgrade-target.mjs';

const SECTIONS = [
  'namespaces',
  'relations',
  'columns',
  'constraints',
  'indexes',
  'sequences',
  'triggers',
  'policies',
  'routines',
  'types',
  'defaultAcls',
  'roles',
  'roleMemberships',
];
const RECEIVING = [
  'manifestTable',
  'projectionTable',
  'manifestRowType',
  'projectionRowType',
  'manifestGuard',
  'manifestSequence',
];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

/** Stable object-key encoding, retaining array order and exact row-text bytes. */
export function stableText(value) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    requireFact(
      Number.isFinite(value) && Number.isSafeInteger(value),
      'unsafe JSON number',
    );
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableText).join(',')}]`;
  requireFact(
    isRecord(value) && Object.getPrototypeOf(value) === Object.prototype,
    'non-JSON snapshot value',
  );
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableText(value[key])}`)
    .join(',')}}`;
}

export function requireDocument(document) {
  requireFact(
    exactKeys(document, ['witness', 'observer', 'snapshot']) &&
      document.witness === 'DEC197_UPGRADE_SNAPSHOT_V1',
    'snapshot witness',
  );
  const observer = document.observer;
  requireFact(
    exactKeys(observer, ['database', 'backendPid', 'user']) &&
      observer.database === 'postgres' &&
      observer.user === 'postgres' &&
      positivePid(observer.backendPid),
    'fresh postgres observer required',
  );
  const snapshot = document.snapshot;
  requireFact(
    exactKeys(snapshot, [
      'catalog',
      'consumerRows',
      'publicationVersionRows',
      'receivingObjects',
    ]),
    'snapshot shape',
  );
  requireFact(
    exactKeys(snapshot.catalog, SECTIONS),
    'incomplete catalog inventory',
  );
  for (const section of SECTIONS) {
    const rows = snapshot.catalog[section];
    requireFact(
      Array.isArray(rows) && rows.every(isRecord),
      `catalog ${section}`,
    );
    const keys = rows.map(stableText);
    requireFact(
      new Set(keys).size === keys.length,
      `duplicate catalog ${section}`,
    );
  }
  for (const key of ['consumerRows', 'publicationVersionRows']) {
    requireFact(
      Array.isArray(snapshot[key]) &&
        snapshot[key].every(
          (row) => typeof row === 'string' && isRecord(JSON.parse(row)),
        ),
      `lossless ${key}`,
    );
    requireFact(
      new Set(snapshot[key]).size === snapshot[key].length,
      `duplicate ${key}`,
    );
  }
  requireFact(
    exactKeys(snapshot.receivingObjects, RECEIVING),
    'receiving inventory',
  );
  stableText(snapshot);
  return document;
}

export function assertAbsentReceiving(document) {
  requireDocument(document);
  requireFact(
    Object.values(document.snapshot.receivingObjects).every(
      (value) => value === null,
    ),
    'receiving objects already exist',
  );
  for (const [section, names] of Object.entries({
    relations: [
      ...TABLE_NAMES,
      SEQUENCE.name,
      ...INDEXES.map((index) => index.name),
    ],
    types: TYPES.map((type) => type.name),
    routines: ['route_manifest_version_guard'],
    sequences: [SEQUENCE.name],
  })) {
    requireFact(
      !document.snapshot.catalog[section].some((row) =>
        names.some((name) => schemaObject(row, name, section)),
      ),
      `receiving ${section} already installed`,
    );
  }
  requireFact(
    !document.snapshot.catalog.constraints.some(
      (row) =>
        [
          'projection_consumer_state_projection_fk',
          'projection_consumer_state_publication_projection_fk',
        ].includes(row.name) &&
        document.snapshot.catalog.relations.some(
          (owner) =>
            schemaObject(owner, 'projection_consumer_state', 'relations') &&
            owner.oid === row.relation,
        ),
    ),
    'receiving FKs already installed',
  );
}

export function assertSnapshotPair({ before, after }) {
  assertAbsentReceiving(before);
  requireDocument(after);
  requireFact(
    before.observer.backendPid !== after.observer.backendPid,
    'observer session reused',
  );
  requireFact(
    before.observer.database === after.observer.database &&
      before.observer.user === after.observer.user,
    'observer identity changed',
  );
}

export function compareRollback({ before, after }) {
  assertSnapshotPair({ before, after });
  assertAbsentReceiving(after);
  requireFact(
    stableText(before.snapshot) === stableText(after.snapshot),
    'migration rollback changed observed store',
  );
}

export function snapshotSha256(document) {
  requireDocument(document);
  return createHash('sha256')
    .update(stableText(document.snapshot))
    .digest('hex');
}

/** Prove labelled setup identities survived a separate committed observer. */
export function assertHistoricalWorld(document, setup, mode) {
  assertAbsentReceiving(document);
  const consumers = document.snapshot.consumerRows.map((text) =>
    JSON.parse(text),
  );
  const publications = document.snapshot.publicationVersionRows.map((text) =>
    JSON.parse(text),
  );
  requireFact(
    setup.committed === true &&
      setup.tapPassed === true &&
      setup.database === document.observer.database &&
      positivePid(setup.backendPid) &&
      setup.backendPid !== document.observer.backendPid,
    'setup not independently committed',
  );
  requireFact(
    Array.isArray(setup.publications),
    'setup publication labels missing',
  );
  if (mode === 'positive') {
    requireFact(
      setup.consumerCount === '0' &&
        setup.publications.length === 0 &&
        consumers.length === 0,
      'positive consumer world not empty',
    );
    return;
  }
  requireFact(
    mode === 'negative' &&
      setup.consumerCount === '2' &&
      setup.publications.length === 2 &&
      consumers.length === 2,
    'two historical consumers required',
  );
  const labels = new Set();
  const identities = new Set();
  for (const publication of setup.publications) {
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
        hashText(publication.publicationHash),
      'invalid historical publication label',
    );
    labels.add(publication.label);
    for (const key of [
      'publicationVersionId',
      'consumerId',
      'orphanProjectionId',
    ]) {
      const id = publication[key];
      requireFact(
        typeof id === 'string' && UUID.test(id) && !identities.has(id),
        'invalid or reused historical identity',
      );
      identities.add(id);
    }
    requireFact(
      consumers.filter(
        (consumer) =>
          consumer.id === publication.consumerId &&
          consumer.publication_id === publication.publicationVersionId &&
          consumer.projection_id === publication.orphanProjectionId,
      ).length === 1,
      'labelled consumer not visible after COMMIT',
    );
    requireFact(
      publications.filter(
        (row) =>
          row.id === publication.publicationVersionId &&
          row.publication_hash === publication.publicationHash,
      ).length === 1,
      'real publication VERSION parent not visible after COMMIT',
    );
  }
}
