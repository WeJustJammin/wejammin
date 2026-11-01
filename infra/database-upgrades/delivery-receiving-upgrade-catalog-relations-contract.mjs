// DEC-197 receiving relation, column, and index facts derived from the promoted SQL.
// This module has no filesystem, process, network, or database adapter.

export const TABLE_NAMES = Object.freeze([
  'route_manifest_version',
  'publication_projection',
]);

const freeze = (value) => Object.freeze(value);
const row = (
  name,
  type,
  typeOid,
  notNull = true,
  identity = '',
  defaultValue = null,
) => freeze({ name, type, typeOid, notNull, identity, defaultValue });

export const TABLE_COLUMNS = freeze({
  route_manifest_version: freeze([
    row('id', 'uuid', 2950, true, '', 'gen_random_uuid()'),
    row('version_no', 'bigint', 20, true, 'd'),
    row('publication_set_hash', 'text', 25),
    row('state', 'text', 25),
    row('generated_at', 'timestamp with time zone', 1184),
    row('activated_at', 'timestamp with time zone', 1184, false),
  ]),
  publication_projection: freeze([
    row('id', 'uuid', 2950, true, '', 'gen_random_uuid()'),
    row('publication_id', 'uuid', 2950),
    row('route_manifest_id', 'uuid', 2950),
    row('locale', 'character varying(16)', 1043),
    row('audience', 'character varying(48)', 1043),
    row('render_payload', 'jsonb', 3802),
    row('render_hash', 'text', 25),
    row('discovery_hash', 'text', 25),
    row('required_refs', 'jsonb', 3802),
    row('state', 'text', 25),
    row('version', 'bigint', 20),
    row('created_at', 'timestamp with time zone', 1184),
    row('updated_at', 'timestamp with time zone', 1184),
  ]),
});

export const INDEXES = freeze(
  [
    [
      'route_manifest_version_pkey',
      'route_manifest_version',
      true,
      true,
      ['id'],
      null,
    ],
    [
      'route_manifest_version_version_no_key',
      'route_manifest_version',
      true,
      false,
      ['version_no'],
      null,
    ],
    [
      'route_manifest_version_one_active_unique',
      'route_manifest_version',
      true,
      false,
      ['state'],
      "(state = 'active'::text)",
    ],
    [
      'route_manifest_version_state_version_idx',
      'route_manifest_version',
      false,
      false,
      ['state', 'version_no DESC'],
      null,
    ],
    [
      'route_manifest_version_generated_idx',
      'route_manifest_version',
      false,
      false,
      ['generated_at'],
      null,
    ],
    [
      'publication_projection_pkey',
      'publication_projection',
      true,
      true,
      ['id'],
      null,
    ],
    [
      'publication_projection_publication_identity_unique',
      'publication_projection',
      true,
      false,
      ['publication_id', 'id'],
      null,
    ],
    [
      'publication_projection_identity_unique',
      'publication_projection',
      true,
      false,
      ['publication_id', 'route_manifest_id', 'locale', 'audience', 'version'],
      null,
    ],
    [
      'publication_projection_locale_audience_state_idx',
      'publication_projection',
      false,
      false,
      ['locale', 'audience', 'state'],
      null,
    ],
    [
      'publication_projection_publication_version_idx',
      'publication_projection',
      false,
      false,
      ['publication_id', 'version DESC'],
      null,
    ],
    [
      'publication_projection_manifest_locale_audience_idx',
      'publication_projection',
      false,
      false,
      ['route_manifest_id', 'locale', 'audience'],
      null,
    ],
  ].map(([name, table, unique, primary, columns, predicate]) =>
    freeze({
      name,
      table,
      unique,
      primary,
      columns: freeze(columns),
      predicate,
    }),
  ),
);
