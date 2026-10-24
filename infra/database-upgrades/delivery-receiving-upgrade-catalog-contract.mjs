// DEC-197 receiving catalog: source-derived facts used by the pure validator.
// This module has no filesystem, process, network, or database adapter.
import {
  exactKeys,
  requireFact,
} from './delivery-receiving-upgrade-target.mjs';

export const SNAPSHOT_WITNESS = 'DEC197_UPGRADE_SNAPSHOT_V1';
export const SCHEMA = 'platform_private';
const freeze = (value) => Object.freeze(value);
export {
  TABLE_NAMES,
  TABLE_COLUMNS,
  INDEXES,
} from './delivery-receiving-upgrade-catalog-relations-contract.mjs';

export const CHECKS = freeze(
  [
    [
      'route_manifest_version_version_no_check',
      'route_manifest_version',
      [2],
      'CHECK ((version_no > 0))',
    ],
    [
      'route_manifest_version_publication_set_hash_check',
      'route_manifest_version',
      [3],
      "CHECK ((publication_set_hash ~ '^[a-f0-9]{64}$'::text))",
    ],
    [
      'route_manifest_version_state_check',
      'route_manifest_version',
      [4],
      "CHECK ((state = ANY (ARRAY['ready'::text, 'active'::text, 'superseded'::text])))",
    ],
    [
      'route_manifest_version_ready_activation_check',
      'route_manifest_version',
      [4, 6],
      "CHECK (((state <> 'ready'::text) OR (activated_at IS NULL)))",
    ],
    [
      'route_manifest_version_active_activation_check',
      'route_manifest_version',
      [4, 6],
      "CHECK (((state = 'ready'::text) OR (activated_at IS NOT NULL)))",
    ],
    [
      'route_manifest_version_activation_time_check',
      'route_manifest_version',
      [5, 6],
      'CHECK (((activated_at IS NULL) OR (activated_at >= generated_at)))',
    ],
    [
      'publication_projection_render_payload_check',
      'publication_projection',
      [6],
      "CHECK ((jsonb_typeof(render_payload) = 'object'::text))",
    ],
    [
      'publication_projection_render_hash_check',
      'publication_projection',
      [7],
      "CHECK ((render_hash ~ '^[a-f0-9]{64}$'::text))",
    ],
    [
      'publication_projection_discovery_hash_check',
      'publication_projection',
      [8],
      "CHECK ((discovery_hash ~ '^[a-f0-9]{64}$'::text))",
    ],
    [
      'publication_projection_required_refs_check',
      'publication_projection',
      [9],
      "CHECK ((jsonb_typeof(required_refs) = 'array'::text))",
    ],
    [
      'publication_projection_state_check',
      'publication_projection',
      [10],
      "CHECK ((state = ANY (ARRAY['building'::text, 'ready'::text, 'blocked'::text, 'failed_retryable'::text, 'active'::text, 'superseded'::text, 'revoked'::text])))",
    ],
    [
      'publication_projection_version_check',
      'publication_projection',
      [11],
      'CHECK ((version > 0))',
    ],
  ].map(([name, table, columns, definition]) =>
    freeze({ name, table, columns: freeze(columns), definition }),
  ),
);

export const KEYS = freeze(
  [
    [
      'route_manifest_version_pkey',
      'route_manifest_version',
      'p',
      [1],
      'PRIMARY KEY (id)',
    ],
    [
      'route_manifest_version_version_no_key',
      'route_manifest_version',
      'u',
      [2],
      'UNIQUE (version_no)',
    ],
    [
      'publication_projection_pkey',
      'publication_projection',
      'p',
      [1],
      'PRIMARY KEY (id)',
    ],
    [
      'publication_projection_publication_identity_unique',
      'publication_projection',
      'u',
      [2, 1],
      'UNIQUE (publication_id, id)',
    ],
    [
      'publication_projection_identity_unique',
      'publication_projection',
      'u',
      [2, 3, 4, 5, 11],
      'UNIQUE (publication_id, route_manifest_id, locale, audience, version)',
    ],
  ].map(([name, table, type, columns, definition]) =>
    freeze({ name, table, type, columns: freeze(columns), definition }),
  ),
);

export const FOREIGN_KEYS = freeze(
  [
    [
      'publication_projection_publication_fk',
      'publication_projection',
      'cms_publication_versions',
      [2],
      [1],
      'FOREIGN KEY (publication_id) REFERENCES platform_private.cms_publication_versions(id)',
    ],
    [
      'publication_projection_manifest_fk',
      'publication_projection',
      'route_manifest_version',
      [3],
      [1],
      'FOREIGN KEY (route_manifest_id) REFERENCES platform_private.route_manifest_version(id)',
    ],
    [
      'projection_consumer_state_projection_fk',
      'projection_consumer_state',
      'publication_projection',
      [3],
      [1],
      'FOREIGN KEY (projection_id) REFERENCES platform_private.publication_projection(id)',
    ],
    [
      'projection_consumer_state_publication_projection_fk',
      'projection_consumer_state',
      'publication_projection',
      [2, 3],
      [2, 1],
      'FOREIGN KEY (publication_id, projection_id) REFERENCES platform_private.publication_projection(publication_id, id)',
    ],
  ].map(([name, table, parent, columns, referencedColumns, definition]) =>
    freeze({
      name,
      table,
      parent,
      columns: freeze(columns),
      referencedColumns: freeze(referencedColumns),
      definition,
    }),
  ),
);

export const SEQUENCE = freeze({
  schema: SCHEMA,
  name: 'route_manifest_version_version_no_seq',
  owner: 'postgres',
  dataType: 'bigint',
  start: '1',
  minimum: '1',
  maximum: '9223372036854775807',
  increment: '1',
  cycle: false,
  cache: '1',
  lastValue: null,
});

export const GUARD_BODY = `begin
  if tg_op = 'DELETE' then
    raise exception 'sealed manifest deletion refused'
      using errcode = '23514', constraint = 'route_manifest_version_delete_check';
  end if;
  if tg_op = 'INSERT' then
    -- Unknown/null states reach their own CHECK/NOT NULL diagnostics.
    if new.state in ('active', 'superseded') then
      raise exception 'manifest must enter as ready'
        using errcode = '23514', constraint = 'route_manifest_version_transition_check';
    end if;
    return new;
  end if;
  if new.state is distinct from old.state
    and new.state in ('ready', 'active', 'superseded')
    and not ((old.state = 'ready' and new.state = 'active')
      or (old.state = 'active' and new.state = 'superseded')) then
    raise exception 'sealed manifest transition refused'
      using errcode = '23514', constraint = 'route_manifest_version_transition_check';
  end if;
  if row(new.id, new.version_no, new.publication_set_hash, new.generated_at)
    is distinct from row(old.id, old.version_no, old.publication_set_hash, old.generated_at) then
    raise exception 'sealed manifest fields are immutable'
      using errcode = '23514', constraint = 'route_manifest_version_immutable_check';
  end if;
  if old.activated_at is not null and new.activated_at is distinct from old.activated_at then
    raise exception 'manifest activation time is write-once'
      using errcode = '23514', constraint = 'route_manifest_version_activation_immutable_check';
  end if;
  return new;
end;
`;
export const GUARD_DEFINITION =
  'CREATE OR REPLACE FUNCTION platform_private.route_manifest_version_guard()\n' +
  " RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\n" +
  GUARD_BODY +
  '$function$\n';

export const TYPES = freeze(
  [
    ['route_manifest_version', 'c'],
    ['publication_projection', 'c'],
    ['_route_manifest_version', 'b'],
    ['_publication_projection', 'b'],
  ].map(([name, kind]) => freeze({ name, kind })),
);

export const RI_OPERATIONS = freeze([
  ['INSERT', 'child', 'RI_FKey_check_ins'],
  ['UPDATE', 'child', 'RI_FKey_check_upd'],
  ['DELETE', 'parent', 'RI_FKey_noaction_del'],
  ['UPDATE', 'parent', 'RI_FKey_noaction_upd'],
]);

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
}

export const equal = (left, right) => canonical(left) === canonical(right);

export const rows = (document, section) => document.snapshot.catalog[section];
export const schemaObject = (entry, name, section) =>
  entry.schema === SCHEMA &&
  entry.name === name &&
  (section !== 'routines' || entry.identityArguments === '');
export const named = (document, section, name) => {
  const qualified = ['relations', 'types', 'routines', 'sequences'].includes(
    section,
  );
  const found = rows(document, section).filter((entry) =>
    qualified ? schemaObject(entry, name, section) : entry.name === name,
  );
  requireFact(found.length === 1, `catalog ${section} name ${name}`);
  return found[0];
};
export const relation = (document, name) => named(document, 'relations', name);
export const relationId = (document, name) => {
  const value = relation(document, name).oid;
  requireFact(Number.isSafeInteger(value) && value > 0, `relation oid ${name}`);
  return value;
};
export const exact = (value, keys, message) =>
  requireFact(exactKeys(value, keys), message);
export const findBy = (list, predicate, message) => {
  const found = list.filter(predicate);
  requireFact(found.length === 1, message);
  return found[0];
};
