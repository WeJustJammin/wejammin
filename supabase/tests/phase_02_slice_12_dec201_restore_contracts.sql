-- DEC-201 private restore spine: contract/role checks only, no composition fixture.
-- Expected contracts: root restore-implementation-preflight selection, 2026-10-17.
-- Missing functions remain explicit TAP failures; never cast a missing regprocedure.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select plan(86);

create temp table s12rc_caller on commit drop as
select current_user::text as role_name;

create function pg_temp.s12rc_oid(p_signature text) returns oid
language plpgsql security invoker as $body$
begin
  return pg_catalog.to_regprocedure(p_signature)::oid;
exception when others then
  return null;
end;
$body$;

create temp table s12rc_expected (
  ordinal integer primary key,
  function_name text not null,
  signature text not null,
  return_type text not null,
  returns_set boolean not null,
  output_names text[],
  output_types text[],
  argument_modes text[],
  language_name text not null,
  volatility text not null,
  call_sql text not null,
  function_oid oid
) on commit drop;

insert into s12rc_expected values
  (1, 'cms_restore_composition_heads',
   'platform_private.cms_restore_composition_heads(uuid)',
   'platform_private.cms_composition_instances', true, null, null, null,
   'sql', 's',
   'select * from platform_private.cms_restore_composition_heads(null::uuid)', null),
  (2, 'cms_restore_composition_refs',
   'platform_private.cms_restore_composition_refs(platform_private.cms_composition_instances)',
   'record', true, array['kind', 'ref_id'], array['text', 'uuid'],
   array['i', 't', 't'], 'plpgsql', 's',
   'select * from platform_private.cms_restore_composition_refs('
     || 'null::platform_private.cms_composition_instances)', null),
  (3, 'cms_restore_composition_plan',
   'platform_private.cms_restore_composition_plan(uuid)',
   'record', true, array['heads', 'pattern_ids', 'block_ids'],
   array['platform_private.cms_composition_instances[]', 'uuid[]', 'uuid[]'],
   array['i', 't', 't', 't'], 'plpgsql', 'v',
   'select * from platform_private.cms_restore_composition_plan(null::uuid)', null),
  (4, 'cms_restore_composition_registry',
   'platform_private.cms_restore_composition_registry(platform_private.cms_composition_instances,uuid,uuid[],uuid[])',
   'text', false, null, null, null, 'plpgsql', 's',
   'select platform_private.cms_restore_composition_registry('
     || 'null::platform_private.cms_composition_instances,null::uuid,'
     || 'null::uuid[],null::uuid[])', null),
  (5, 'cms_restore_composition_copy',
   'platform_private.cms_restore_composition_copy(uuid,uuid,timestamptz,platform_private.cms_composition_instances[],uuid[],uuid[])',
   'void', false, null, null, null, 'plpgsql', 'v',
   'select platform_private.cms_restore_composition_copy('
     || 'null::uuid,null::uuid,null::timestamptz,'
     || 'null::platform_private.cms_composition_instances[],null::uuid[],null::uuid[])', null);

update s12rc_expected set function_oid = pg_temp.s12rc_oid(signature);

-- Thirteen catalog assertions per helper. LEFT JOIN preserves absent contracts.
-- TABLE output names/types/modes are inspected independently of printed signatures.
select ok(coalesce(checks.verdict, false), e.function_name || ': ' || checks.label)
from s12rc_expected e
left join pg_catalog.pg_proc p on p.oid = e.function_oid
left join pg_catalog.pg_language l on l.oid = p.prolang
cross join lateral (values
  (1, p.oid is not null, 'exact private signature exists'),
  (2, (select count(*) = 1
       from pg_catalog.pg_proc overload
       join pg_catalog.pg_namespace n on n.oid = overload.pronamespace
       where n.nspname = 'platform_private' and overload.proname = e.function_name),
   'exactly one private overload'),
  (3, p.oid is not null and p.prokind = 'f'
      and p.pronargdefaults = 0 and p.provariadic = 0,
   'ordinary function has no default or variadic arguments'),
  (4, p.oid is not null and p.prorettype = pg_catalog.to_regtype(e.return_type)
      and p.proretset = e.returns_set
      and case when e.output_names is null then
        p.proallargtypes is null and p.proargmodes is null
      else
        p.proargmodes::text[] = e.argument_modes
        and array(select p.proargnames[s.i]
                  from pg_catalog.generate_subscripts(p.proallargtypes, 1) s(i)
                  where p.proargmodes[s.i] = 't' order by s.i) = e.output_names
        and array(select p.proallargtypes[s.i]
                  from pg_catalog.generate_subscripts(p.proallargtypes, 1) s(i)
                  where p.proargmodes[s.i] = 't' order by s.i)
          = array(select pg_catalog.to_regtype(t.type_name)::oid
                  from unnest(e.output_types) with ordinality t(type_name, position)
                  order by t.position)
      end,
   'exact return type, set cardinality and TABLE output columns'),
  (5, p.oid is not null and l.lanname = e.language_name, 'selected language'),
  (6, p.oid is not null and p.provolatile::text = e.volatility, 'selected volatility'),
  (7, p.oid is not null
      and pg_catalog.pg_get_userbyid(p.proowner) = 'wejammin_cms_definer', 'CMS owner'),
  (8, p.oid is not null and not p.prosecdef, 'SECURITY INVOKER'),
  (9, p.oid is not null and p.proconfig @> array['search_path=""'], 'pinned empty search_path'),
  (10, p.oid is not null and not exists (
       select 1 from pg_catalog.aclexplode(
         coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
       where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'), 'PUBLIC EXECUTE denied'),
  (11, p.oid is not null and coalesce((
       select not pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE')
       from pg_catalog.pg_roles r where r.rolname = 'anon'), false), 'anon effective EXECUTE denied'),
  (12, p.oid is not null and coalesce((
       select not pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE')
       from pg_catalog.pg_roles r where r.rolname = 'authenticated'), false), 'authenticated effective EXECUTE denied'),
  (13, p.oid is not null and coalesce((
       select not pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE')
       from pg_catalog.pg_roles r where r.rolname = 'service_role'), false), 'service_role effective EXECUTE denied')
) checks(ordinal, verdict, label)
order by e.ordinal, checks.ordinal;

-- Role changes are real, not supplied booleans. A forced exception rolls back
-- the entire probe subtransaction, including role/GUC changes and any accidental
-- successful body execution. Only API roles invoke bodies, with typed NULLs.
-- CMS checks reachability, NOT helper call-tree permissions or data semantics.
create function pg_temp.s12rc_role_probe(p_role text, p_oid oid, p_sql text)
returns text language plpgsql security invoker as $body$
declare
  v_actor text;
  v_state text;
  v_result text;
begin
  if p_oid is null then return 'MISSING_FUNCTION'; end if;
  begin
    execute pg_catalog.format('set local role %I', p_role);
    v_actor := current_user::text;
    if p_sql is null then
      v_result := v_actor || ':'
        || pg_catalog.has_schema_privilege(current_user, 'platform_private', 'USAGE')::text || ':'
        || pg_catalog.has_function_privilege(current_user, p_oid, 'EXECUTE')::text;
    else
      begin
        execute p_sql;
        v_state := '00000';
      exception when others then
        v_state := sqlstate;
      end;
      v_result := v_actor || ':' || v_state;
    end if;
    raise exception using errcode = 'ZC001', message = 'rollback DEC-201 role probe';
  exception
    when sqlstate 'ZC001' then return v_result;
    when others then return 'PROBE_ERROR:' || sqlstate || ':' || sqlerrm;
  end;
end;
$body$;

select is(pg_temp.s12rc_role_probe('wejammin_cms_definer', e.function_oid, null),
  'wejammin_cms_definer:true:true', e.function_name || ': real CMS role has schema USAGE and EXECUTE')
from s12rc_expected e order by e.ordinal;

-- A schema-level 42501 is still a direct-call denial. Separate effective ACL
-- assertions above ensure schema denial cannot hide an erroneous EXECUTE grant.
-- Missing functions produce MISSING_FUNCTION, never a false denial success.
select is(pg_temp.s12rc_role_probe(r.role_name, e.function_oid, e.call_sql),
  r.role_name || ':42501', e.function_name || ': actual ' || r.role_name || ' direct call denied')
from s12rc_expected e
cross join (values (1, 'anon'), (2, 'authenticated'), (3, 'service_role')) r(ordinal, role_name)
order by e.ordinal, r.ordinal;

select is(current_user::text, (select role_name from s12rc_caller),
  'all role probes restore the original effective caller');
select * from finish();
rollback;
