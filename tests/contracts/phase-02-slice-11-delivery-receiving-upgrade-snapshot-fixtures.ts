import {
  database,
  labels,
  type Document,
  type Mode,
  type Obj,
} from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';
import { receivingCatalog } from './phase-02-slice-11-delivery-receiving-upgrade-catalog-fixtures';
import { receivingSecurity } from './phase-02-slice-11-delivery-receiving-upgrade-catalog-security-fixtures';
export function before(mode: Mode = 'negative', pid = 201): Document {
  // Representative catalog images, not a captured DB receipt.
  // All bigint-bearing ROW images below stay JSON TEXT.
  const catalog: Record<string, Obj[]> = {
    namespaces: [
      { oid: 1, name: 'platform_private', owner: 'postgres', acl: null },
    ],
    relations: [
      {
        oid: 10,
        schema: 'platform_private',
        name: 'projection_consumer_state',
        kind: 'r',
        owner: 'postgres',
        acl: ['wejammin_cms_definer=r/postgres'],
        rowSecurity: true,
        forceRowSecurity: true,
      },
      {
        oid: 11,
        schema: 'platform_private',
        name: 'cms_publication_versions',
        kind: 'r',
      },
    ],
    columns: [],
    constraints: [
      {
        oid: 20,
        name: 'projection_consumer_state_publication_fk',
        type: 'f',
        relation: 10,
        referencedRelation: 11,
        columns: [2],
        referencedColumns: [1],
        validated: true,
        updateAction: 'a',
        deleteAction: 'a',
      },
    ],
    indexes: [
      { index: 21, table: 10, valid: true, definition: 'old consumer index' },
    ],
    sequences: [
      {
        schema: 'platform_private',
        name: 'old_sequence',
        maximum: '9223372036854775807',
        lastValue: '9007199254740993',
      },
    ],
    triggers: [
      {
        oid: 22,
        name: 'projection_consumer_state_write_guard',
        relation: 10,
        function: 30,
        enabled: 'O',
        internal: false,
        definition: 'old enabled guard',
      },
    ],
    policies: [
      {
        oid: 23,
        name: 'projection_consumer_state_rpc_policy',
        relation: 10,
        using: 'platform_private.cms_rpc_context_valid()',
        check: 'platform_private.cms_rpc_context_valid()',
        roles: [0],
      },
    ],
    routines: [
      {
        oid: 30,
        schema: 'platform_private',
        name: 'cms_write_guard',
        definition: 'old guard function',
        owner: 'postgres',
        acl: null,
        securityDefiner: false,
        configuration: [],
      },
    ],
    types: [
      {
        oid: 31,
        schema: 'platform_private',
        name: 'projection_consumer_state',
        relation: 10,
        owner: 'postgres',
        acl: null,
      },
    ],
    defaultAcls: [
      { oid: 32, role: 'postgres', acl: ['wejammin_cms_definer=r/postgres'] },
    ],
    roles: [{ oid: 33, name: 'wejammin_cms_definer', bypassRls: false }],
    roleMemberships: [{ roleid: 33, member: 34, admin_option: false }],
  };
  catalog.columns = [
    'id',
    'publication_id',
    'projection_id',
    'consumer',
    'expected_version',
    'state',
    'attempts',
    'last_error_code',
    'updated_at',
    'version',
  ].map((name, i) => ({
    relation: 10,
    number: i + 1,
    name,
    notNull: name !== 'last_error_code',
  }));
  return {
    witness: 'DEC197_UPGRADE_SNAPSHOT_V1',
    observer: { database: database(mode), backendPid: pid, user: 'postgres' },
    snapshot: {
      catalog,
      consumerRows:
        mode === 'positive'
          ? []
          : labels.map(
              (p, i) =>
                `{"id":"${p.consumerId}","publication_id":"${p.publicationVersionId}","projection_id":"${p.orphanProjectionId}","version":${i === 0 ? 7 : 9},"updated_at":"2026-10-16T12:00:00.${i === 0 ? '123456' : '987654'}+00:00"}`,
            ),
      publicationVersionRows:
        mode === 'positive'
          ? []
          : labels.map(
              (p) =>
                `{"id":"${p.publicationVersionId}","publication_hash":"${p.publicationHash}","version":9007199254740993}`,
            ),
      receivingObjects: Object.fromEntries(
        [
          'manifestTable',
          'projectionTable',
          'manifestRowType',
          'projectionRowType',
          'manifestGuard',
          'manifestSequence',
        ].map((name) => [name, null]),
      ),
    },
  };
}
export function afterPositive(): Document {
  const doc = before('positive', 202);
  const base = receivingCatalog();
  const security = receivingSecurity(base);
  for (const additions of [base, security]) {
    for (const [section, rows] of Object.entries(additions)) {
      doc.snapshot.catalog[section] = [
        ...(doc.snapshot.catalog[section] ?? []),
        ...rows,
      ];
    }
  }
  doc.snapshot.receivingObjects = {
    manifestTable: 'platform_private.route_manifest_version',
    projectionTable: 'platform_private.publication_projection',
    manifestRowType: 'platform_private.route_manifest_version',
    projectionRowType: 'platform_private.publication_projection',
    manifestGuard: 'platform_private.route_manifest_version_guard()',
    manifestSequence: 'platform_private.route_manifest_version_version_no_seq',
  };
  return doc;
}
