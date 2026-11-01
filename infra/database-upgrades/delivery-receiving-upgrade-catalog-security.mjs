// DEC-197 receiving catalog security, type, and trigger contracts.
import {
  exactKeys,
  requireFact,
} from './delivery-receiving-upgrade-target.mjs';
import * as C from './delivery-receiving-upgrade-catalog-contract.mjs';

const REL_KEYS = [
  'oid',
  'schema',
  'name',
  'kind',
  'owner',
  'acl',
  'rowSecurity',
  'forceRowSecurity',
  'persistence',
  'replicaIdentity',
  'options',
  'isPartition',
];
const ROUTINE_KEYS = [
  'oid',
  'schema',
  'name',
  'identityArguments',
  'owner',
  'acl',
  'securityDefiner',
  'configuration',
  'kind',
  'volatility',
  'strict',
  'parallel',
  'leakproof',
  'definition',
];
const TYPE_KEYS = [
  'oid',
  'schema',
  'name',
  'owner',
  'acl',
  'kind',
  'relation',
  'elementType',
  'baseType',
  'notNull',
  'default',
  'collation',
];
const TRIGGER_KEYS = [
  'oid',
  'name',
  'relation',
  'function',
  'enabled',
  'internal',
  'constraint',
  'definition',
];
const tableAcl = (value) =>
  Array.isArray(value) &&
  value.length === 1 &&
  value[0] === 'postgres=arwdDxtm/postgres';
const sequenceAcl = (value) =>
  Array.isArray(value) &&
  value.length === 1 &&
  value[0] === 'postgres=rwU/postgres';
const rows = (document, section) => document.snapshot.catalog[section];
const exact = (value, keys, message) =>
  requireFact(exactKeys(value, keys), message);
const findBy = (list, predicate, message) => {
  const found = list.filter(predicate);
  requireFact(found.length === 1, message);
  return found[0];
};
const relationName = (document, oid) => {
  const entry = findBy(
    rows(document, 'relations'),
    (row) => row.oid === oid,
    `relation oid ${oid}`,
  );
  return entry.name;
};
const relation = (document, name) => C.relation(document, name);

export function expectedRelations(document, additions) {
  for (const name of C.TABLE_NAMES) {
    const entry = relation(document, name);
    exact(entry, REL_KEYS, `receiving relation shape ${name}`);
    requireFact(
      Number.isSafeInteger(entry.oid) &&
        entry.oid > 0 &&
        entry.schema === C.SCHEMA &&
        entry.kind === 'r' &&
        entry.owner === 'postgres' &&
        tableAcl(entry.acl) &&
        entry.rowSecurity === true &&
        entry.forceRowSecurity === true &&
        entry.persistence === 'p' &&
        entry.replicaIdentity === 'd' &&
        entry.options === null &&
        entry.isPartition === false,
      `table security ${name}`,
    );
    additions.push(entry);
  }
  const sequence = relation(document, C.SEQUENCE.name);
  exact(sequence, REL_KEYS, 'sequence relation shape');
  requireFact(
    Number.isSafeInteger(sequence.oid) &&
      sequence.oid > 0 &&
      sequence.schema === C.SCHEMA &&
      sequence.kind === 'S' &&
      sequence.owner === 'postgres' &&
      sequenceAcl(sequence.acl) &&
      sequence.rowSecurity === false &&
      sequence.forceRowSecurity === false &&
      sequence.persistence === 'p' &&
      sequence.replicaIdentity === 'n' &&
      sequence.options === null &&
      sequence.isPartition === false,
    'sequence security',
  );
  additions.push(sequence);
  for (const spec of C.INDEXES) {
    const entry = relation(document, spec.name);
    exact(entry, REL_KEYS, `index relation shape ${spec.name}`);
    requireFact(
      Number.isSafeInteger(entry.oid) &&
        entry.oid > 0 &&
        entry.schema === C.SCHEMA &&
        entry.kind === 'i' &&
        entry.owner === 'postgres' &&
        entry.acl === null &&
        entry.rowSecurity === false &&
        entry.forceRowSecurity === false &&
        entry.persistence === 'p' &&
        entry.replicaIdentity === 'n' &&
        entry.options === null &&
        entry.isPartition === false,
      `index security ${spec.name}`,
    );
    additions.push(entry);
  }
}

export function expectedSecurity(document, additions) {
  const sequence = C.named(document, 'sequences', C.SEQUENCE.name);
  exact(sequence, Object.keys(C.SEQUENCE), 'sequence shape');
  requireFact(C.equal(sequence, C.SEQUENCE), 'sequence contract');
  additions.sequences.push(sequence);
  const guard = C.named(document, 'routines', 'route_manifest_version_guard');
  exact(guard, ROUTINE_KEYS, 'guard routine shape');
  requireFact(
    Number.isSafeInteger(guard.oid) &&
      guard.oid > 0 &&
      guard.schema === C.SCHEMA &&
      guard.identityArguments === '' &&
      guard.owner === 'postgres' &&
      C.equal(guard.acl, ['postgres=X/postgres']) &&
      guard.securityDefiner === false &&
      C.equal(guard.configuration, ['search_path=""']) &&
      guard.kind === 'f' &&
      guard.volatility === 'v' &&
      guard.strict === false &&
      guard.parallel === 'u' &&
      guard.leakproof === false &&
      guard.definition === C.GUARD_DEFINITION,
    'guard routine contract',
  );
  additions.routines.push(guard);
  const typeIds = new Map(
    rows(document, 'types').map((entry) => [entry.name, entry]),
  );
  for (const type of C.TYPES) {
    const entry = typeIds.get(type.name);
    requireFact(entry, `type ${type.name}`);
    exact(entry, TYPE_KEYS, `type shape ${type.name}`);
    const table = C.TABLE_NAMES.includes(type.name)
      ? C.relationId(document, type.name)
      : 0;
    const elementType = type.name.startsWith('_')
      ? typeIds.get(type.name.slice(1))?.oid
      : 0;
    requireFact(
      Number.isSafeInteger(entry.oid) &&
        entry.oid > 0 &&
        entry.schema === C.SCHEMA &&
        entry.owner === 'postgres' &&
        entry.acl === null &&
        entry.kind === type.kind &&
        entry.relation === table &&
        entry.elementType === (elementType ?? -1) &&
        entry.baseType === 0 &&
        entry.notNull === false &&
        entry.default === null &&
        entry.collation === 0,
      `type contract ${type.name}`,
    );
    additions.types.push(entry);
  }
}

export function expectedTriggers(document, additions) {
  const guard = C.named(document, 'routines', 'route_manifest_version_guard');
  const guardTrigger = findBy(
    rows(document, 'triggers'),
    (entry) => entry.name === 'route_manifest_version_guard',
    'guard trigger',
  );
  exact(guardTrigger, TRIGGER_KEYS, 'guard trigger shape');
  requireFact(
    Number.isSafeInteger(guardTrigger.oid) &&
      guardTrigger.oid > 0 &&
      guardTrigger.relation ===
        C.relationId(document, 'route_manifest_version') &&
      guardTrigger.function === guard.oid &&
      guardTrigger.enabled === 'O' &&
      guardTrigger.internal === false &&
      guardTrigger.constraint === 0 &&
      guardTrigger.definition ===
        'CREATE TRIGGER route_manifest_version_guard BEFORE INSERT OR DELETE OR UPDATE ON platform_private.route_manifest_version FOR EACH ROW EXECUTE FUNCTION platform_private.route_manifest_version_guard()',
    'guard trigger contract',
  );
  additions.triggers.push(guardTrigger);
  const functions = new Map();
  for (const fk of C.FOREIGN_KEYS) {
    const constraint = C.named(document, 'constraints', fk.name);
    const child = C.relationId(document, fk.table);
    const parent = C.relationId(document, fk.parent);
    const matching = rows(document, 'triggers').filter(
      (entry) => entry.internal === true && entry.constraint === constraint.oid,
    );
    requireFact(matching.length === 4, `RI trigger count ${fk.name}`);
    for (const [event, side, routine] of C.RI_OPERATIONS) {
      const on = side === 'child' ? child : parent;
      const from = side === 'child' ? parent : child;
      const prefix = side === 'child' ? 'c' : 'a';
      const entry = findBy(
        matching,
        (row) =>
          row.relation === on &&
          row.enabled === 'O' &&
          typeof row.name === 'string' &&
          new RegExp(`^RI_ConstraintTrigger_${prefix}_[0-9]+$`).test(
            row.name,
          ) &&
          row.definition ===
            `CREATE CONSTRAINT TRIGGER "${row.name}" AFTER ${event} ON platform_private.${relationName(document, on)} FROM platform_private.${relationName(document, from)} NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION "${routine}"()`,
        `RI trigger ${fk.name} ${event} ${side}`,
      );
      exact(entry, TRIGGER_KEYS, `RI trigger shape ${fk.name}`);
      requireFact(
        Number.isSafeInteger(entry.oid) &&
          entry.oid > 0 &&
          Number.isSafeInteger(entry.function) &&
          entry.function > 0 &&
          entry.internal === true &&
          entry.constraint === constraint.oid &&
          (!functions.has(routine) ||
            functions.get(routine) === entry.function),
        `RI trigger binding ${fk.name}`,
      );
      functions.set(routine, entry.function);
      additions.triggers.push(entry);
    }
  }
}
