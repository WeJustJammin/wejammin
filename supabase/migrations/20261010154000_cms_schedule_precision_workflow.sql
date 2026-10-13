-- CMS-03B-15: reconstruct exact stored schedule UTC with nine fractional digits.
-- Six-digit legacy timestamps receive the private default-zero suffix 000.
-- Forward-only: do not remove precision columns or restore lossy rendering after
-- precision writes. Any correction requires a separately reviewed forward change.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  target_oid oid := pg_catalog.to_regprocedure('platform_private.cms_get_entry_workflow(jsonb)');
  cms_owner oid := 'wejammin_cms_definer'::pg_catalog.regrole;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  original_definition text;
  replacement_definition text;
  actual_definition text;
  replacement_source text;
  original_metadata jsonb;
  original_comment text;
  old_formatter text := $formatter$platform_private.auth_iso_time(listed.resolved_at_utc)$formatter$;
  new_formatter text := $formatter$(pg_catalog.to_char(
                         listed.resolved_at_utc at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'
                       ) || pg_catalog.lpad(listed.resolved_utc_submicro_ns::text, 3, '0') || 'Z')$formatter$;
begin
  if not exists (
    select 1 from pg_catalog.pg_roles role
     where role.oid = cms_owner
       and not role.rolcanlogin and not role.rolsuper and not role.rolbypassrls
  ) or pg_catalog.has_schema_privilege(cms_owner, 'platform_private', 'CREATE') then
    raise exception 'CMS workflow precision owner baseline mismatch' using errcode = '55000';
  end if;

  select proc.* into original from pg_catalog.pg_proc proc where proc.oid = target_oid;
  if not found then
    raise exception 'CMS workflow precision function missing' using errcode = '55000';
  end if;
  original_definition := pg_catalog.pg_get_functiondef(original.oid);
  if pg_catalog.md5(original.prosrc) is distinct from 'e94ace68cc866a54e222e3475a7d9621'
     or pg_catalog.md5(original_definition) is distinct from 'd3af3c9af78d91422955d845ac756867'
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
    raise exception 'CMS workflow precision function baseline mismatch' using errcode = '55000';
  end if;
  original_metadata := pg_catalog.to_jsonb(original) - 'prosrc';
  original_comment := pg_catalog.obj_description(original.oid, 'pg_proc');

  if (pg_catalog.length(original.prosrc) - pg_catalog.length(
       pg_catalog.replace(original.prosrc, old_formatter, '')
     )) / pg_catalog.length(old_formatter) <> 1
     or (pg_catalog.length(original_definition) - pg_catalog.length(
       pg_catalog.replace(original_definition, old_formatter, '')
     )) / pg_catalog.length(old_formatter) <> 1
     or pg_catalog.strpos(original.prosrc, new_formatter) <> 0
     or (pg_catalog.length(original_definition) - pg_catalog.length(
       pg_catalog.replace(original_definition, original.prosrc, '')
     )) / pg_catalog.length(original.prosrc) <> 1 then
    raise exception 'CMS workflow precision replacement shape mismatch' using errcode = '55000';
  end if;

  replacement_source := pg_catalog.replace(original.prosrc, old_formatter, new_formatter);
  replacement_definition := pg_catalog.replace(
    original_definition, original.prosrc, replacement_source
  );
  if pg_catalog.replace(replacement_source, new_formatter, old_formatter)
       is distinct from original.prosrc
     or pg_catalog.strpos(replacement_source, old_formatter) <> 0
     or (pg_catalog.length(replacement_source) - pg_catalog.length(
       pg_catalog.replace(replacement_source, new_formatter, '')
     )) / pg_catalog.length(new_formatter) <> 1
     or (pg_catalog.length(replacement_definition) - pg_catalog.length(
       pg_catalog.replace(replacement_definition, replacement_source, '')
     )) / pg_catalog.length(replacement_source) <> 1
     or pg_catalog.replace(replacement_definition, new_formatter, old_formatter)
       is distinct from original_definition
     or pg_catalog.replace(replacement_definition, replacement_source, original.prosrc)
       is distinct from original_definition then
    raise exception 'CMS workflow precision inverse mismatch' using errcode = '55000';
  end if;

  execute replacement_definition;

  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = target_oid;
  if not found then
    raise exception 'CMS workflow precision replacement missing' using errcode = '55000';
  end if;
  actual_definition := pg_catalog.pg_get_functiondef(actual.oid);
  if actual.oid is distinct from original.oid
     or actual.prosrc is distinct from replacement_source
     or (pg_catalog.to_jsonb(actual) - 'prosrc') is distinct from original_metadata
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from original_comment
     or actual_definition is distinct from replacement_definition
     or pg_catalog.replace(actual.prosrc, new_formatter, old_formatter)
       is distinct from original.prosrc
     or pg_catalog.replace(actual_definition, new_formatter, old_formatter)
       is distinct from original_definition
     or pg_catalog.replace(actual_definition, replacement_source, original.prosrc)
       is distinct from original_definition then
    raise exception 'CMS workflow precision preservation mismatch' using errcode = '55000';
  end if;
end;
$migration$;

commit;
