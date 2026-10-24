/** Bounded external SQL fixture, not PostgreSQL proof. Unknown DDL fails closed. */
export type Binding = {
  oid: number;
  functionOid: number;
  functionSchema: string;
  functionName: string;
};
const normalize = (sql: string): string =>
  sql
    .replace(/--[^\n]*/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
const lock =
  'begin; lock table platform_private.jobs in access exclusive mode;';

export const createUnitCatalog = (events: string[], onDrop: () => void) => {
  const schemas = new Set<string>();
  const triggers = new Map<string, Binding>();
  const statements: string[] = [];
  let nextOid = 100;
  const create = (name: string, schema: string): Binding => {
    if (triggers.has(name)) throw new Error('duplicate trigger');
    if (!schemas.has(schema)) throw new Error('missing probe schema');
    const binding = {
      oid: nextOid++,
      functionOid: 42,
      functionSchema: schema,
      functionName: 'observe_job',
    };
    triggers.set(name, binding);
    events.push('create-trigger');
    return binding;
  };
  const acquisitionQuery = (name: string, schema: string): string =>
    normalize(`
    select pg_catalog.jsonb_build_object('oid', t.oid::bigint, 'functionOid', t.tgfoid::bigint,
      'functionSchema', n.nspname, 'functionName', p.proname)
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where t.tgname = '${name}' and t.tgrelid = 'platform_private.jobs'::regclass
      and not t.tgisinternal and n.nspname = '${schema}'
      and p.proname = 'observe_job' and p.pronargs = 0; commit;`);
  const cleanupTransaction = (
    name: string,
    schema: string,
    oid: number,
    functionOid: number,
  ): string =>
    normalize(`
    ${lock}
    do $ownership$
    declare expected_trigger oid := ${oid}::oid;
      expected_function oid := ${functionOid}::oid;
    begin
      if expected_trigger <> 0 then
        if not exists (
          select 1 from pg_catalog.pg_trigger t
          join pg_catalog.pg_proc p on p.oid = t.tgfoid
          join pg_catalog.pg_namespace n on n.oid = p.pronamespace
          where t.oid = expected_trigger and t.tgfoid = expected_function
            and t.tgname = '${name}' and t.tgrelid = 'platform_private.jobs'::regclass
            and not t.tgisinternal and n.nspname = '${schema}'
            and p.proname = 'observe_job' and p.pronargs = 0
        ) then
          raise exception 'DEC194_PROBE_OWNERSHIP_CHANGED';
        end if;
        execute 'drop trigger ${name} on platform_private.jobs restrict';
      end if;
    end;
    $ownership$;
    drop function ${schema}.observe_job() restrict;
    drop function ${schema}.bootstrap() restrict;
    drop function ${schema}.facts() restrict;
    drop function ${schema}.snapshot() restrict;
    drop table ${schema}.observations restrict;
    drop table ${schema}.world restrict;
    drop schema ${schema} restrict;
    commit;`);

  const execute = (input: string): string | undefined => {
    statements.push(input);
    const sql = normalize(input);
    if (input.includes('DEC194-FIXTURE-COMMITTED')) {
      const schema = /create schema (s12_dec194_iso_[a-f0-9]+)/u.exec(
        input,
      )?.[1];
      if (!schema || schemas.has(schema))
        throw new Error('Unit fixture schema invalid.');
      schemas.add(schema);
      return 'DEC194-FIXTURE-COMMITTED';
    }
    const activation =
      /^begin; lock table platform_private\.jobs in access exclusive mode; create trigger ([a-z0-9_]+) after insert on platform_private\.jobs for each row execute function ([a-z0-9_]+)\.observe_job\(\); /iu.exec(
        sql,
      );
    if (activation) {
      const [, name, schema] = activation;
      if (sql.slice(activation[0].length) !== acquisitionQuery(name!, schema!))
        throw new Error('Unrecognised atomic acquisition query.');
      // The lock/create/catalog capture/commit is one successful external call.
      return JSON.stringify(create(name!, schema!));
    }
    const cleanup =
      /^begin; lock table platform_private\.jobs in access exclusive mode; do \$ownership\$ declare expected_trigger oid := ([0-9]+)::oid; expected_function oid := ([0-9]+)::oid; /iu.exec(
        sql,
      );
    if (cleanup) {
      const oid = Number(cleanup[1]);
      const functionOid = Number(cleanup[2]);
      const name = /and t\.tgname = '([a-z0-9_]+)'/iu.exec(sql)?.[1];
      const schema = /and n\.nspname = '([a-z0-9_]+)'/iu.exec(sql)?.[1];
      if (
        !name ||
        !schema ||
        sql !== cleanupTransaction(name, schema, oid, functionOid)
      )
        throw new Error('Unrecognised atomic cleanup transaction.');
      const working = new Map(triggers);
      if (oid !== 0) {
        const current = working.get(name);
        if (
          !current ||
          current.oid !== oid ||
          current.functionOid !== functionOid ||
          current.functionSchema !== schema ||
          current.functionName !== 'observe_job'
        )
          throw new Error('DEC194_PROBE_OWNERSHIP_CHANGED');
        working.delete(name);
      }
      // DROP FUNCTION RESTRICT fails on the actual remaining users. All earlier
      // trigger deletion rolls back with it: publish no intermediate catalog state.
      if (
        [...working.values()].some(
          (binding) => binding.functionSchema === schema,
        )
      )
        throw new Error('unowned dependent trigger');
      if (!schemas.has(schema)) throw new Error('missing owned schema');
      triggers.clear();
      for (const [key, value] of working) triggers.set(key, value);
      schemas.delete(schema);
      if (oid !== 0) {
        onDrop();
        events.push('drop-trigger');
      }
      events.push('drop-schema');
      return '';
    }
    // Retain the old unsafe protocol as a negative-control boundary: a reverted
    // helper still deletes foreign objects and fails behavioral assertions.
    const oldCreate =
      /^create trigger ([a-z0-9_]+) after insert on platform_private\.jobs for each row execute function ([a-z0-9_]+)\.observe_job\(\);$/iu.exec(
        sql,
      );
    if (oldCreate) {
      create(oldCreate[1]!, oldCreate[2]!);
      return '';
    }
    const oldDrop =
      /^drop trigger if exists ([a-z0-9_]+) on platform_private\.jobs; drop schema ([a-z0-9_]+) cascade;$/iu.exec(
        sql,
      );
    if (oldDrop) {
      if (triggers.has(oldDrop[1]!)) {
        onDrop();
        triggers.delete(oldDrop[1]!);
        events.push('drop-trigger');
      }
      for (const [name, binding] of triggers)
        if (binding.functionSchema === oldDrop[2]) triggers.delete(name);
      schemas.delete(oldDrop[2]!);
      events.push('drop-schema');
      return '';
    }
    // No catalog-read short circuit can swallow mixed DDL or silently approve it.
    if (/pg_trigger|\b(?:begin|commit|create|drop|lock|alter|do)\b/iu.test(sql))
      throw new Error('Unrecognised unit catalog SQL.');
    return undefined;
  };
  return { schemas, triggers, statements, execute };
};
