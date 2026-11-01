import {
  foreignKeys,
  ids,
  relation,
  relationNames,
} from './phase-02-slice-11-delivery-receiving-upgrade-catalog-fixtures';
import type { Obj } from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';

// Unit OIDs are identifiers, not a purported capture of a particular database.
export const guardBody = `begin
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
export const guardDefinition =
  'CREATE OR REPLACE FUNCTION platform_private.route_manifest_version_guard()\n' +
  " RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\n" +
  guardBody +
  '$function$\n';

export function receivingSecurity(
  base: Record<string, Obj[]>,
): Record<string, Obj[]> {
  const relations: Obj[] = [];
  const columns: Obj[] = [];
  const indexSpecs: Array<[string, number, string[], boolean, boolean]> = [
    ['route_manifest_version_pkey', 100, ['id'], true, true],
    ['route_manifest_version_version_no_key', 100, ['version_no'], true, false],
    ['route_manifest_version_one_active_unique', 100, ['state'], true, false],
    [
      'route_manifest_version_state_version_idx',
      100,
      ['state', 'version_no DESC'],
      false,
      false,
    ],
    [
      'route_manifest_version_generated_idx',
      100,
      ['generated_at'],
      false,
      false,
    ],
    ['publication_projection_pkey', 101, ['id'], true, true],
    [
      'publication_projection_publication_identity_unique',
      101,
      ['publication_id', 'id'],
      true,
      false,
    ],
    [
      'publication_projection_identity_unique',
      101,
      ['publication_id', 'route_manifest_id', 'locale', 'audience', 'version'],
      true,
      false,
    ],
    [
      'publication_projection_locale_audience_state_idx',
      101,
      ['locale', 'audience', 'state'],
      false,
      false,
    ],
    [
      'publication_projection_publication_version_idx',
      101,
      ['publication_id', 'version DESC'],
      false,
      false,
    ],
    [
      'publication_projection_manifest_locale_audience_idx',
      101,
      ['route_manifest_id', 'locale', 'audience'],
      false,
      false,
    ],
  ];
  const indexes = indexSpecs.map(([name, table, keys, unique, primary], i) => {
    const oid = 300 + i;
    relations.push(relation(oid, name, 'i'));
    const predicate =
      name === 'route_manifest_version_one_active_unique'
        ? "(state = 'active'::text)"
        : null;
    keys.forEach((key, index) => {
      const name = key.replace(' DESC', '');
      const source = (base.columns ?? []).find(
        (c) => c.relation === table && c.name === name,
      );
      if (!source) throw new Error('missing index-column fixture source');
      columns.push({
        ...source,
        relation: oid,
        number: index + 1,
        notNull: false,
        identity: '',
        default: null,
      });
    });
    return {
      index: oid,
      table,
      unique,
      primary,
      exclusion: false,
      valid: true,
      ready: true,
      live: true,
      immediate: true,
      predicate,
      definition: `CREATE ${unique ? 'UNIQUE ' : ''}INDEX ${name} ON platform_private.${relationNames[table]} USING btree (${keys.join(', ')})${predicate ? ` WHERE ${predicate}` : ''}`,
    };
  });
  const sequences = [
    {
      schema: 'platform_private',
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
    },
  ];

  const routines = [
    {
      oid: ids.guard,
      schema: 'platform_private',
      name: 'route_manifest_version_guard',
      identityArguments: '',
      owner: 'postgres',
      acl: ['postgres=X/postgres'],
      securityDefiner: false,
      configuration: ['search_path=""'],
      kind: 'f',
      volatility: 'v',
      strict: false,
      parallel: 'u',
      leakproof: false,
      definition: guardDefinition,
    },
  ];
  const triggers: Obj[] = [
    {
      oid: 350,
      name: 'route_manifest_version_guard',
      relation: ids.manifest,
      function: ids.guard,
      enabled: 'O',
      internal: false,
      constraint: 0,
      definition:
        'CREATE TRIGGER route_manifest_version_guard BEFORE INSERT OR DELETE OR UPDATE ON platform_private.route_manifest_version FOR EACH ROW EXECUTE FUNCTION platform_private.route_manifest_version_guard()',
    },
  ];
  const operations: Array<[string, boolean, string]> = [
    ['INSERT', false, 'RI_FKey_check_ins'],
    ['UPDATE', false, 'RI_FKey_check_upd'],
    ['DELETE', true, 'RI_FKey_noaction_del'],
    ['UPDATE', true, 'RI_FKey_noaction_upd'],
  ];
  foreignKeys.forEach((fk, i) =>
    operations.forEach(([event, parentSide, routine], j) => {
      const oid = 400 + i * 4 + j;
      const on = parentSide ? fk.parent : fk.relation;
      const from = parentSide ? fk.relation : fk.parent;
      const name = `RI_ConstraintTrigger_${parentSide ? 'a' : 'c'}_${oid}`;
      triggers.push({
        oid,
        name,
        relation: on,
        function: 1000 + j,
        enabled: 'O',
        internal: true,
        constraint: fk.oid,
        definition: `CREATE CONSTRAINT TRIGGER "${name}" AFTER ${event} ON platform_private.${relationNames[on]} FROM platform_private.${relationNames[from]} NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION "${routine}"()`,
      });
    }),
  );
  const type = (
    oid: number,
    name: string,
    parent: number,
    elementType = 0,
  ): Obj => ({
    oid,
    schema: 'platform_private',
    name,
    owner: 'postgres',
    acl: null,
    kind: parent === 0 ? 'b' : 'c',
    relation: parent,
    elementType,
    baseType: 0,
    notNull: false,
    default: null,
    collation: 0,
  });
  const types = [
    type(104, 'route_manifest_version', ids.manifest),
    type(105, 'publication_projection', ids.projection),
    type(106, '_route_manifest_version', 0, 104),
    type(107, '_publication_projection', 0, 105),
  ];
  return { relations, columns, indexes, sequences, routines, triggers, types };
}
