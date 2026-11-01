// DEC-197 complete receiving catalog proof. All observations are caller supplied.
// No filesystem, process, network, or database adapter is used here.
import {
  assertSnapshotPair,
  requireDocument,
} from './delivery-receiving-upgrade-snapshot.mjs';
import {
  positivePid,
  requireFact,
} from './delivery-receiving-upgrade-target.mjs';
import * as C from './delivery-receiving-upgrade-catalog-contract.mjs';
import {
  expectedColumns,
  expectedConstraints,
  expectedIndexes,
} from './delivery-receiving-upgrade-catalog-constraints.mjs';
import {
  expectedRelations,
  expectedSecurity,
  expectedTriggers,
} from './delivery-receiving-upgrade-catalog-security.mjs';

const TARGET_RELATIONS = Object.freeze([
  ...C.TABLE_NAMES,
  C.SEQUENCE.name,
  ...C.INDEXES.map((index) => index.name),
]);
const rows = (document, section) => document.snapshot.catalog[section];

const preserved = (before, after, section, additions) => {
  const oldRows = rows(before, section);
  const allowed = [...oldRows, ...additions];
  for (const entry of rows(after, section)) {
    requireFact(
      allowed.some((candidate) => C.equal(candidate, entry)),
      `unexpected ${section} row`,
    );
  }
  for (const entry of oldRows) {
    requireFact(
      rows(after, section).some((candidate) => C.equal(candidate, entry)),
      `lost historical ${section} row`,
    );
  }
  for (const entry of additions) {
    requireFact(
      rows(after, section).some((candidate) => C.equal(candidate, entry)),
      `missing ${section} row`,
    );
  }
};
const noPreexisting = (before, section, matches) => {
  for (const entry of rows(before, section))
    requireFact(!matches(entry), `pre-existing receiving ${section}`);
};
const ownedConstraint = (document, entry, specs) =>
  specs.some(
    (spec) =>
      entry.name === spec.name &&
      rows(document, 'relations').some(
        (owner) =>
          C.schemaObject(owner, spec.table, 'relations') &&
          owner.oid === entry.relation,
      ),
  );
const receivingView = (document) => {
  const constraints = rows(document, 'constraints').filter((entry) =>
    ownedConstraint(document, entry, [
      ...C.CHECKS,
      ...C.KEYS,
      ...C.FOREIGN_KEYS,
    ]),
  );
  const foreignKeys = constraints
    .filter((entry) => entry.type === 'f')
    .map((entry) => entry.oid);
  const manifest = C.relationId(document, 'route_manifest_version');
  return {
    ...document,
    snapshot: {
      ...document.snapshot,
      catalog: {
        ...document.snapshot.catalog,
        constraints,
        types: rows(document, 'types').filter((entry) =>
          C.TYPES.some((type) => C.schemaObject(entry, type.name, 'types')),
        ),
        triggers: rows(document, 'triggers').filter(
          (entry) =>
            (entry.relation === manifest &&
              entry.name === 'route_manifest_version_guard') ||
            (entry.internal === true && foreignKeys.includes(entry.constraint)),
        ),
      },
    },
  };
};
const distinctIds = (document, section) => {
  const values = rows(document, section).map((entry) => entry.oid);
  requireFact(
    values.every((value) => Number.isSafeInteger(value) && value > 0) &&
      new Set(values).size === values.length,
    `invalid ${section} identities`,
  );
};

export function assertCommittedReceivingCatalog({ before, after }) {
  assertSnapshotPair({ before, after });
  requireDocument(after);
  requireFact(
    positivePid(before.observer.backendPid) &&
      positivePid(after.observer.backendPid),
    'observer PID',
  );
  requireFact(
    before.snapshot.consumerRows.length === 0 &&
      C.equal(before.snapshot.consumerRows, after.snapshot.consumerRows) &&
      C.equal(
        before.snapshot.publicationVersionRows,
        after.snapshot.publicationVersionRows,
      ),
    'positive world changed',
  );
  requireFact(
    C.equal(after.snapshot.receivingObjects, {
      manifestTable: 'platform_private.route_manifest_version',
      projectionTable: 'platform_private.publication_projection',
      manifestRowType: 'platform_private.route_manifest_version',
      projectionRowType: 'platform_private.publication_projection',
      manifestGuard: 'platform_private.route_manifest_version_guard()',
      manifestSequence:
        'platform_private.route_manifest_version_version_no_seq',
    }),
    'receiving object inventory',
  );
  for (const [section, names] of Object.entries({
    relations: TARGET_RELATIONS,
    types: C.TYPES.map((entry) => entry.name),
    routines: ['route_manifest_version_guard'],
    sequences: [C.SEQUENCE.name],
  }))
    noPreexisting(before, section, (entry) =>
      names.some((name) => C.schemaObject(entry, name, section)),
    );
  noPreexisting(before, 'constraints', (entry) =>
    ownedConstraint(before, entry, [...C.CHECKS, ...C.KEYS, ...C.FOREIGN_KEYS]),
  );
  noPreexisting(
    before,
    'triggers',
    (entry) =>
      entry.name === 'route_manifest_version_guard' &&
      rows(before, 'relations').some(
        (owner) =>
          C.schemaObject(owner, 'route_manifest_version', 'relations') &&
          owner.oid === entry.relation,
      ),
  );
  for (const section of [
    'relations',
    'constraints',
    'triggers',
    'routines',
    'types',
  ])
    distinctIds(after, section);
  const additions = Object.fromEntries(
    Object.keys(before.snapshot.catalog).map((section) => [section, []]),
  );
  const receiving = receivingView(after);
  expectedRelations(receiving, additions.relations);
  expectedColumns(receiving, additions.columns);
  expectedConstraints(receiving, additions.constraints);
  expectedIndexes(receiving, additions.indexes);
  expectedSecurity(receiving, additions);
  expectedTriggers(receiving, additions);
  for (const section of [
    'namespaces',
    'policies',
    'defaultAcls',
    'roles',
    'roleMemberships',
  ])
    preserved(before, after, section, additions[section]);
  for (const section of [
    'relations',
    'columns',
    'constraints',
    'indexes',
    'sequences',
    'triggers',
    'routines',
    'types',
  ])
    preserved(before, after, section, additions[section]);
  return undefined;
}
