import assert from 'node:assert/strict';

export const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
export const identifier = (value) => {
  assert.match(value, /^[a-z][a-z0-9_]{0,62}$/);
  return value;
};
export const oid = (value) => {
  assert.ok(Number.isSafeInteger(Number(value)) && Number(value) >= 0);
  return String(Number(value));
};
const json = (value) =>
  value === null ? 'null::jsonb' : `${literal(JSON.stringify(value))}::jsonb`;
export const jobsCatalog = `(select coalesce(jsonb_agg(jsonb_build_object(
  'row', to_jsonb(t), 'definition', pg_get_triggerdef(t.oid, true),
  'functionSchema', n.nspname, 'functionName', p.proname,
  'dependencies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.classid,d.objid,d.objsubid,
    d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]'::jsonb) from pg_catalog.pg_depend d
    where d.classid='pg_trigger'::regclass and d.objid=t.oid)) order by t.oid), '[]'::jsonb)
  from pg_catalog.pg_trigger t join pg_catalog.pg_proc p on p.oid=t.tgfoid
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where t.tgrelid='platform_private.jobs'::regclass)`;
const schemaCatalog = (
  name,
) => `(select jsonb_build_object('namespace',to_jsonb(n),
  'classes',(select coalesce(jsonb_agg(to_jsonb(c) order by c.oid),'[]'::jsonb)
    from pg_catalog.pg_class c where c.relnamespace=n.oid),
  'functions',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]'::jsonb)
    from pg_catalog.pg_proc p where p.pronamespace=n.oid),
  'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]'::jsonb)
    from pg_catalog.pg_type t where t.typnamespace=n.oid),
  'attributes',(select coalesce(jsonb_agg(to_jsonb(a) order by a.attrelid,a.attnum),'[]'::jsonb)
    from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
    where c.relnamespace=n.oid),
  'constraints',(select coalesce(jsonb_agg(to_jsonb(c) order by c.oid),'[]'::jsonb)
    from pg_catalog.pg_constraint c where c.connamespace=n.oid),
  'dependencies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.classid,d.objid,d.objsubid,
      d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]'::jsonb)
    from pg_catalog.pg_depend d where
      (d.classid='pg_proc'::regclass and d.objid in
        (select p.oid from pg_catalog.pg_proc p where p.pronamespace=n.oid)) or
      (d.classid='pg_class'::regclass and d.objid in
        (select c.oid from pg_catalog.pg_class c where c.relnamespace=n.oid)) or
      (d.classid='pg_type'::regclass and d.objid in
        (select t.oid from pg_catalog.pg_type t where t.typnamespace=n.oid))))
  from pg_catalog.pg_namespace n where n.nspname=${literal(name)})`;
export const snapshotSql = (
  f,
) => `select jsonb_build_object('jobs',${jobsCatalog},
    'own',${schemaCatalog(f.schema)},'foreign',${schemaCatalog(f.foreign)});`;
export const rowDigest = `select jsonb_build_object('count',count(*),'digest',encode(sha256(convert_to(
    coalesce(string_agg(to_jsonb(j)::text,E'\\n' order by to_jsonb(j)::text),''),'UTF8')),'hex'))
    from platform_private.jobs j;`;

export function render(text, f, acquired = { oid: 0, functionOid: 0 }) {
  const values = {
    SCHEMA: f.schema,
    FOREIGN: f.foreign,
    TRIGGER: f.trigger,
    TRIGGER_OID: oid(acquired.oid),
    FUNCTION_OID: oid(acquired.functionOid),
  };
  const rendered = text.replace(/__([A-Z_]+)__/g, (_, key) => {
    assert.ok(Object.hasOwn(values, key), `Unknown template parameter ${key}`);
    return key.endsWith('_OID') ? values[key] : identifier(values[key]);
  });
  assert.ok(!rendered.includes('__'));
  return rendered;
}

export const triggerSql = (f, name, foreign = false, replace = false) =>
  `create ${replace ? 'or replace ' : ''}trigger ${identifier(name)} after insert on platform_private.jobs
      for each row execute function ${foreign ? f.foreign + '.foreign_hook' : f.schema + '.observe_job'}();
      select jsonb_build_object('createdTrigger',entries.value)
      from jsonb_array_elements(${jobsCatalog}) as entries(value)
      where entries.value->'row'->>'tgname'=${literal(name)};`;

export function teardownSql(
  { baseline, fixtures },
  items,
  triggerNames = null,
  body = null,
  commit = true,
) {
  const expectedJobs = [
    ...baseline.jobs,
    ...fixtures.flatMap((f) => f.triggers),
  ].sort((a, b) => Number(a.row.oid) - Number(b.row.oid));
  const checks = [
    `if ${jobsCatalog} is distinct from ${json(expectedJobs)} then
      raise exception 'DEC194_FIXTURE_TRIGGER_DRIFT'; end if;`,
  ];
  const drops = [];
  for (const f of items) {
    assert.ok(
      f.state,
      'Missing committed fixture catalog: manual recovery required',
    );
    for (const [name, state] of [
      [f.schema, f.state.own],
      [f.foreign, f.state.foreign],
    ]) {
      checks.push(`if ${schemaCatalog(name)} is distinct from ${json(state)} then
          raise exception 'DEC194_FIXTURE_SCHEMA_DRIFT'; end if;`);
      if (state && !triggerNames) {
        for (const p of state.functions) {
          assert.equal(p.pronargs, 0);
          drops.push(
            `drop function ${identifier(name)}.${identifier(p.proname)}() restrict;`,
          );
        }
        for (const c of state.classes) {
          assert.equal(c.relkind, 'r');
          drops.push(
            `drop table ${identifier(name)}.${identifier(c.relname)} restrict;`,
          );
        }
        drops.push(`drop schema ${identifier(name)} restrict;`);
      }
    }
  }
  const selected = items
    .flatMap((f) => f.triggers)
    .filter((t) => !triggerNames || triggerNames.includes(t.row.tgname));
  if (triggerNames)
    assert.equal(
      selected.length,
      triggerNames.length,
      'Only manifest-owned triggers may be removed',
    );
  const triggerDrops = selected.map(
    (t) =>
      `drop trigger ${identifier(t.row.tgname)} on platform_private.jobs restrict;`,
  );
  return `begin; lock table platform_private.jobs in access exclusive mode;
      do $guard$ begin ${checks.join('\n')} end; $guard$;
      ${body ?? [...triggerDrops, ...drops].join('\n')} ${commit ? 'commit;' : ''}`;
}
