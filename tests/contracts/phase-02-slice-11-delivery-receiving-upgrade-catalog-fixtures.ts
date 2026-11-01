import {
  compositeFk,
  directFk,
  type Obj,
} from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';

// Independent source-derived 070 semantic images, NOT an observed DB receipt.
export const ids = {
  manifest: 100,
  projection: 101,
  sequence: 102,
  guard: 103,
};
export const relationNames: Record<number, string> = {
  10: 'projection_consumer_state',
  11: 'cms_publication_versions',
  100: 'route_manifest_version',
  101: 'publication_projection',
};
type ForeignKey = {
  oid: number;
  name: string;
  relation: number;
  parent: number;
  columns: number[];
  referencedColumns: number[];
  definition: string;
};
export const foreignKeys: ForeignKey[] = [
  {
    oid: 220,
    name: 'publication_projection_publication_fk',
    relation: 101,
    parent: 11,
    columns: [2],
    referencedColumns: [1],
    definition:
      'FOREIGN KEY (publication_id) REFERENCES platform_private.cms_publication_versions(id)',
  },
  {
    oid: 221,
    name: 'publication_projection_manifest_fk',
    relation: 101,
    parent: 100,
    columns: [3],
    referencedColumns: [1],
    definition:
      'FOREIGN KEY (route_manifest_id) REFERENCES platform_private.route_manifest_version(id)',
  },
  {
    oid: 222,
    name: directFk,
    relation: 10,
    parent: 101,
    columns: [3],
    referencedColumns: [1],
    definition:
      'FOREIGN KEY (projection_id) REFERENCES platform_private.publication_projection(id)',
  },
  {
    oid: 223,
    name: compositeFk,
    relation: 10,
    parent: 101,
    columns: [2, 3],
    referencedColumns: [2, 1],
    definition:
      'FOREIGN KEY (publication_id, projection_id) REFERENCES platform_private.publication_projection(publication_id, id)',
  },
];

export const relation = (oid: number, name: string, kind: string): Obj => ({
  oid,
  schema: 'platform_private',
  name,
  kind,
  owner: 'postgres',
  acl:
    kind === 'i'
      ? null
      : [kind === 'S' ? 'postgres=rwU/postgres' : 'postgres=arwdDxtm/postgres'],
  rowSecurity: kind === 'r',
  forceRowSecurity: kind === 'r',
  persistence: 'p',
  replicaIdentity: kind === 'r' ? 'd' : 'n',
  options: null,
  isPartition: false,
});
const column = (
  parent: number,
  number: number,
  name: string,
  type: string,
  typeOid: number,
  notNull = true,
  identity = '',
  defaultValue: string | null = null,
): Obj => ({
  relation: parent,
  number,
  name,
  type,
  typeOid,
  notNull,
  identity,
  generated: '',
  collation: typeOid === 25 || typeOid === 1043 ? 100 : 0,
  acl: null,
  default: defaultValue,
});
const constraint = (
  oid: number,
  name: string,
  type: string,
  parent: number,
  columns: number[],
  definition: string,
): Obj => ({
  oid,
  name,
  type,
  relation: parent,
  referencedRelation: 0,
  columns: [...columns],
  referencedColumns: null,
  validated: true,
  deferrable: false,
  initiallyDeferred: false,
  updateAction: ' ',
  deleteAction: ' ',
  match: ' ',
  definition,
});

export function receivingCatalog(): Record<string, Obj[]> {
  const relations = [
    relation(100, 'route_manifest_version', 'r'),
    relation(101, 'publication_projection', 'r'),
    relation(102, 'route_manifest_version_version_no_seq', 'S'),
  ];
  const manifest = [
    column(100, 1, 'id', 'uuid', 2950, true, '', 'gen_random_uuid()'),
    column(100, 2, 'version_no', 'bigint', 20, true, 'd'),
    column(100, 3, 'publication_set_hash', 'text', 25),
    column(100, 4, 'state', 'text', 25),
    column(100, 5, 'generated_at', 'timestamp with time zone', 1184),
    column(100, 6, 'activated_at', 'timestamp with time zone', 1184, false),
  ];
  const projection = [
    column(101, 1, 'id', 'uuid', 2950, true, '', 'gen_random_uuid()'),
    column(101, 2, 'publication_id', 'uuid', 2950),
    column(101, 3, 'route_manifest_id', 'uuid', 2950),
    column(101, 4, 'locale', 'character varying(16)', 1043),
    column(101, 5, 'audience', 'character varying(48)', 1043),
    column(101, 6, 'render_payload', 'jsonb', 3802),
    column(101, 7, 'render_hash', 'text', 25),
    column(101, 8, 'discovery_hash', 'text', 25),
    column(101, 9, 'required_refs', 'jsonb', 3802),
    column(101, 10, 'state', 'text', 25),
    column(101, 11, 'version', 'bigint', 20),
    column(101, 12, 'created_at', 'timestamp with time zone', 1184),
    column(101, 13, 'updated_at', 'timestamp with time zone', 1184),
  ];
  const columns = [
    ...manifest,
    ...projection,
    column(102, 1, 'last_value', 'bigint', 20),
    column(102, 2, 'log_cnt', 'bigint', 20),
    column(102, 3, 'is_called', 'boolean', 16),
  ];
  const checkSpecs: Array<[string, number, number[], string]> = [
    [
      'route_manifest_version_version_no_check',
      100,
      [2],
      'CHECK ((version_no > 0))',
    ],
    [
      'route_manifest_version_publication_set_hash_check',
      100,
      [3],
      "CHECK ((publication_set_hash ~ '^[a-f0-9]{64}$'::text))",
    ],
    [
      'route_manifest_version_state_check',
      100,
      [4],
      "CHECK ((state = ANY (ARRAY['ready'::text, 'active'::text, 'superseded'::text])))",
    ],
    [
      'route_manifest_version_ready_activation_check',
      100,
      [4, 6],
      "CHECK (((state <> 'ready'::text) OR (activated_at IS NULL)))",
    ],
    [
      'route_manifest_version_active_activation_check',
      100,
      [4, 6],
      "CHECK (((state = 'ready'::text) OR (activated_at IS NOT NULL)))",
    ],
    [
      'route_manifest_version_activation_time_check',
      100,
      [5, 6],
      'CHECK (((activated_at IS NULL) OR (activated_at >= generated_at)))',
    ],
    [
      'publication_projection_render_payload_check',
      101,
      [6],
      "CHECK ((jsonb_typeof(render_payload) = 'object'::text))",
    ],
    [
      'publication_projection_render_hash_check',
      101,
      [7],
      "CHECK ((render_hash ~ '^[a-f0-9]{64}$'::text))",
    ],
    [
      'publication_projection_discovery_hash_check',
      101,
      [8],
      "CHECK ((discovery_hash ~ '^[a-f0-9]{64}$'::text))",
    ],
    [
      'publication_projection_required_refs_check',
      101,
      [9],
      "CHECK ((jsonb_typeof(required_refs) = 'array'::text))",
    ],
    [
      'publication_projection_state_check',
      101,
      [10],
      "CHECK ((state = ANY (ARRAY['building'::text, 'ready'::text, 'blocked'::text, 'failed_retryable'::text, 'active'::text, 'superseded'::text, 'revoked'::text])))",
    ],
    [
      'publication_projection_version_check',
      101,
      [11],
      'CHECK ((version > 0))',
    ],
  ];
  const constraints = checkSpecs.map(([name, table, keys, definition], i) =>
    constraint(200 + i, name, 'c', table, keys, definition),
  );
  const keySpecs: Array<[string, string, number, number[], string]> = [
    ['route_manifest_version_pkey', 'p', 100, [1], 'PRIMARY KEY (id)'],
    [
      'route_manifest_version_version_no_key',
      'u',
      100,
      [2],
      'UNIQUE (version_no)',
    ],
    ['publication_projection_pkey', 'p', 101, [1], 'PRIMARY KEY (id)'],
    [
      'publication_projection_publication_identity_unique',
      'u',
      101,
      [2, 1],
      'UNIQUE (publication_id, id)',
    ],
    [
      'publication_projection_identity_unique',
      'u',
      101,
      [2, 3, 4, 5, 11],
      'UNIQUE (publication_id, route_manifest_id, locale, audience, version)',
    ],
  ];
  keySpecs.forEach(([name, type, table, keys, definition], i) =>
    constraints.push(constraint(230 + i, name, type, table, keys, definition)),
  );
  foreignKeys.forEach((fk) =>
    constraints.push({
      ...constraint(
        fk.oid,
        fk.name,
        'f',
        fk.relation,
        fk.columns,
        fk.definition,
      ),
      referencedRelation: fk.parent,
      referencedColumns: [...fk.referencedColumns],
      updateAction: 'a',
      deleteAction: 'a',
      match: 's',
    }),
  );
  return { relations, columns, constraints };
}
