-- CMS-03B-20: refuse a null or expired lease at both existing execution fences.
-- Preserve completed replay and every later lock, version and evidence check.
-- Rollback requires a reviewed forward migration restoring the prior definition;
-- the inverse below proves that these two conditions are the only body changes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity text := 'platform_private.cms_execute_publication_schedule(jsonb)';
  cms_owner oid := 'wejammin_cms_definer'::pg_catalog.regrole;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  original_definition text;
  replacement_definition text;
  actual_definition text;
  replacement_source text;
  original_metadata jsonb;
  original_comment text;
  original_condition text := $condition$if schedule_row.state <> 'executing' or schedule_row.lease_id is distinct from requested_lease then$condition$;
  replacement_condition text := $condition$if schedule_row.state <> 'executing' or schedule_row.lease_id is distinct from requested_lease
     or schedule_row.lease_until is null
     or schedule_row.lease_until <= pg_catalog.clock_timestamp() then$condition$;
begin
  if not exists (
    select 1 from pg_catalog.pg_roles role
     where role.oid = cms_owner
       and not role.rolcanlogin and not role.rolsuper and not role.rolbypassrls
  ) or pg_catalog.has_schema_privilege(cms_owner, 'platform_private', 'CREATE') then
    raise exception 'CMS schedule lease fence owner baseline mismatch' using errcode = '55000';
  end if;

  select proc.* into original
    from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'CMS schedule lease fence function missing' using errcode = '55000';
  end if;
  original_definition := pg_catalog.pg_get_functiondef(original.oid);
  if pg_catalog.md5(original.prosrc) is distinct from '7e6119b10a631301001038b8109a989b'
     or pg_catalog.md5(original_definition) is distinct from '3388d4cd7fa395bd1b074882e9389aa5'
     or original.proowner is distinct from cms_owner
     or original.prokind is distinct from 'f'
     or original.provolatile is distinct from 'v'
     or original.prosecdef is distinct from true
     or original.proisstrict is distinct from false
     or original.proleakproof is distinct from false
     or original.proparallel is distinct from 'u'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.proacl is distinct from
       array['wejammin_cms_definer=X/wejammin_cms_definer']::pg_catalog.aclitem[]
     or original.pronargs is distinct from 1
     or original.pronargdefaults is distinct from 0
     or original.proargnames is distinct from array['p_request']::text[]
     or pg_catalog.oidvectortypes(original.proargtypes) is distinct from 'jsonb'
     or original.prorettype is distinct from 'jsonb'::pg_catalog.regtype
     or original.proretset is distinct from false
     or original.prolang is distinct from (
       select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql'
     ) then
    raise exception 'CMS schedule lease fence function baseline mismatch' using errcode = '55000';
  end if;
  original_metadata := pg_catalog.to_jsonb(original) - 'prosrc';
  original_comment := pg_catalog.obj_description(original.oid, 'pg_proc');

  if (pg_catalog.length(original.prosrc) - pg_catalog.length(
       pg_catalog.replace(original.prosrc, original_condition, '')
     )) / pg_catalog.length(original_condition) <> 2
     or pg_catalog.strpos(original.prosrc, replacement_condition) <> 0
     or (pg_catalog.length(original_definition) - pg_catalog.length(
       pg_catalog.replace(original_definition, original.prosrc, '')
     )) / pg_catalog.length(original.prosrc) <> 1 then
    raise exception 'CMS schedule lease fence replacement shape mismatch' using errcode = '55000';
  end if;

  replacement_source := pg_catalog.replace(
    original.prosrc, original_condition, replacement_condition
  );
  if pg_catalog.replace(replacement_source, replacement_condition, original_condition)
       is distinct from original.prosrc
     or pg_catalog.strpos(replacement_source, original_condition) <> 0
     or (pg_catalog.length(replacement_source) - pg_catalog.length(
       pg_catalog.replace(replacement_source, replacement_condition, '')
     )) / pg_catalog.length(replacement_condition) <> 2 then
    raise exception 'CMS schedule lease fence source inverse mismatch' using errcode = '55000';
  end if;

  replacement_definition := pg_catalog.replace(
    original_definition, original.prosrc, replacement_source
  );
  if (pg_catalog.length(replacement_definition) - pg_catalog.length(
       pg_catalog.replace(replacement_definition, replacement_source, '')
     )) / pg_catalog.length(replacement_source) <> 1
     or pg_catalog.replace(replacement_definition, replacement_source, original.prosrc)
       is distinct from original_definition then
    raise exception 'CMS schedule lease fence definition inverse mismatch' using errcode = '55000';
  end if;

  execute replacement_definition;

  select proc.* into actual
    from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'CMS schedule lease fence replacement missing' using errcode = '55000';
  end if;
  actual_definition := pg_catalog.pg_get_functiondef(actual.oid);
  if actual.prosrc is distinct from replacement_source
     or (pg_catalog.to_jsonb(actual) - 'prosrc') is distinct from original_metadata
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from original_comment
     or actual_definition is distinct from replacement_definition
     or pg_catalog.replace(actual.prosrc, replacement_condition, original_condition)
       is distinct from original.prosrc
     or pg_catalog.replace(actual_definition, replacement_source, original.prosrc)
       is distinct from original_definition then
    raise exception 'CMS schedule lease fence preservation mismatch' using errcode = '55000';
  end if;
end;
$migration$;

commit;
