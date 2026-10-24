// DEC-197 receiving catalog table, constraint, and index contracts.
import {
  exactKeys,
  requireFact,
} from './delivery-receiving-upgrade-target.mjs';
import * as C from './delivery-receiving-upgrade-catalog-contract.mjs';

const COL_KEYS = [
  'relation',
  'number',
  'name',
  'type',
  'typeOid',
  'notNull',
  'identity',
  'generated',
  'collation',
  'acl',
  'default',
];
const CONSTRAINT_KEYS = [
  'oid',
  'name',
  'type',
  'relation',
  'referencedRelation',
  'columns',
  'referencedColumns',
  'validated',
  'deferrable',
  'initiallyDeferred',
  'updateAction',
  'deleteAction',
  'match',
  'definition',
];
const INDEX_KEYS = [
  'index',
  'table',
  'unique',
  'primary',
  'exclusion',
  'valid',
  'ready',
  'live',
  'immediate',
  'definition',
  'predicate',
];
const rows = (document, section) => document.snapshot.catalog[section];
const exact = (value, keys, message) =>
  requireFact(exactKeys(value, keys), message);
const findBy = (list, predicate, message) => {
  const found = list.filter(predicate);
  requireFact(found.length === 1, message);
  return found[0];
};

export function expectedColumns(document, additions) {
  for (const [table, specs] of Object.entries(C.TABLE_COLUMNS)) {
    const id = C.relationId(document, table);
    specs.forEach((spec, index) => {
      const entry = findBy(
        rows(document, 'columns'),
        (row) => row.relation === id && row.name === spec.name,
        `column ${table}.${spec.name}`,
      );
      exact(entry, COL_KEYS, `column shape ${table}.${spec.name}`);
      requireFact(
        entry.number === index + 1 &&
          entry.type === spec.type &&
          entry.typeOid === spec.typeOid &&
          entry.notNull === spec.notNull &&
          entry.identity === spec.identity &&
          entry.generated === '' &&
          entry.collation ===
            (spec.typeOid === 25 || spec.typeOid === 1043 ? 100 : 0) &&
          entry.acl === null &&
          entry.default === spec.defaultValue,
        `column contract ${table}.${spec.name}`,
      );
      additions.push(entry);
    });
  }
  const sequenceId = C.relationId(document, C.SEQUENCE.name);
  ['last_value', 'log_cnt', 'is_called'].forEach((name, index) => {
    const entry = findBy(
      rows(document, 'columns'),
      (row) => row.relation === sequenceId && row.name === name,
      `sequence column ${name}`,
    );
    exact(entry, COL_KEYS, `sequence column shape ${name}`);
    const type = name === 'is_called' ? 'boolean' : 'bigint';
    const typeOid = name === 'is_called' ? 16 : 20;
    requireFact(
      entry.number === index + 1 &&
        entry.type === type &&
        entry.typeOid === typeOid &&
        entry.notNull === true &&
        entry.identity === '' &&
        entry.generated === '' &&
        entry.collation === 0 &&
        entry.default === null &&
        entry.acl === null,
      `sequence column ${name}`,
    );
    additions.push(entry);
  });
  for (const index of C.INDEXES) {
    const indexId = C.relationId(document, index.name);
    const tableId = C.relationId(document, index.table);
    index.columns.forEach((key, number) => {
      const name = key.replace(/ DESC$/, '');
      const source = findBy(
        rows(document, 'columns'),
        (row) => row.relation === tableId && row.name === name,
        `index source column ${index.name}.${name}`,
      );
      const entry = findBy(
        rows(document, 'columns'),
        (row) => row.relation === indexId && row.number === number + 1,
        `index column ${index.name}.${number + 1}`,
      );
      exact(entry, COL_KEYS, `index column shape ${index.name}`);
      requireFact(
        entry.name === name &&
          entry.type === source.type &&
          entry.typeOid === source.typeOid &&
          entry.notNull === false &&
          entry.identity === '' &&
          entry.generated === '' &&
          entry.collation === source.collation &&
          entry.acl === null &&
          entry.default === null,
        `index column contract ${index.name}.${name}`,
      );
      additions.push(entry);
    });
  }
}

export function expectedConstraints(document, additions) {
  const ids = new Map(
    rows(document, 'constraints').map((entry) => [entry.name, entry]),
  );
  for (const check of C.CHECKS) {
    const source = ids.get(check.name);
    requireFact(source, `check ${check.name}`);
    exact(source, CONSTRAINT_KEYS, `check shape ${check.name}`);
    requireFact(
      Number.isSafeInteger(source.oid) &&
        source.oid > 0 &&
        source.type === 'c' &&
        source.relation === C.relationId(document, check.table) &&
        C.equal(source.columns, check.columns) &&
        source.referencedRelation === 0 &&
        source.referencedColumns === null &&
        source.validated === true &&
        source.deferrable === false &&
        source.initiallyDeferred === false &&
        source.updateAction === ' ' &&
        source.deleteAction === ' ' &&
        source.match === ' ' &&
        source.definition === check.definition,
      `check contract ${check.name}`,
    );
    additions.push(source);
  }
  for (const key of C.KEYS) {
    const source = ids.get(key.name);
    requireFact(source, `key ${key.name}`);
    exact(source, CONSTRAINT_KEYS, `key shape ${key.name}`);
    requireFact(
      Number.isSafeInteger(source.oid) &&
        source.oid > 0 &&
        source.type === key.type &&
        source.relation === C.relationId(document, key.table) &&
        C.equal(source.columns, key.columns) &&
        source.referencedRelation === 0 &&
        source.referencedColumns === null &&
        source.validated === true &&
        source.deferrable === false &&
        source.initiallyDeferred === false &&
        source.updateAction === ' ' &&
        source.deleteAction === ' ' &&
        source.match === ' ' &&
        source.definition === key.definition,
      `key contract ${key.name}`,
    );
    additions.push(source);
  }
  for (const fk of C.FOREIGN_KEYS) {
    const source = ids.get(fk.name);
    requireFact(source, `foreign key ${fk.name}`);
    exact(source, CONSTRAINT_KEYS, `foreign key shape ${fk.name}`);
    requireFact(
      Number.isSafeInteger(source.oid) &&
        source.oid > 0 &&
        source.type === 'f' &&
        source.relation === C.relationId(document, fk.table) &&
        source.referencedRelation === C.relationId(document, fk.parent) &&
        C.equal(source.columns, fk.columns) &&
        C.equal(source.referencedColumns, fk.referencedColumns) &&
        source.validated === true &&
        source.deferrable === false &&
        source.initiallyDeferred === false &&
        source.updateAction === 'a' &&
        source.deleteAction === 'a' &&
        source.match === 's' &&
        source.definition === fk.definition,
      `foreign key contract ${fk.name}`,
    );
    additions.push(source);
  }
}

export function expectedIndexes(document, additions) {
  for (const spec of C.INDEXES) {
    const relationRow = C.relation(document, spec.name);
    const entry = findBy(
      rows(document, 'indexes'),
      (row) => row.index === relationRow.oid,
      `index ${spec.name}`,
    );
    exact(entry, INDEX_KEYS, `index shape ${spec.name}`);
    const keys = spec.columns.join(', ');
    const definition = `CREATE ${spec.unique ? 'UNIQUE ' : ''}INDEX ${spec.name} ON ${C.SCHEMA}.${spec.table} USING btree (${keys})${spec.predicate ? ` WHERE ${spec.predicate}` : ''}`;
    requireFact(
      entry.table === C.relationId(document, spec.table) &&
        entry.unique === spec.unique &&
        entry.primary === spec.primary &&
        entry.exclusion === false &&
        entry.valid === true &&
        entry.ready === true &&
        entry.live === true &&
        entry.immediate === true &&
        entry.predicate === spec.predicate &&
        entry.definition === definition,
      `index contract ${spec.name}`,
    );
    additions.push(entry);
  }
}
