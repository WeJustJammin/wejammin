-- CMS-03B-20: round the complete exact actual-minus-scheduled nanosecond delta.
-- Preserve the captured backend's nearest-even half ties, without float loss
-- on near ties. Only the deviation assignment changes in the POST-LEASE body;
-- both null/expired fences and preceding completed replay remain byte-exact.
-- Forward-only: inverse checks are scope proof, not a destructive down path.
-- Precision-bearing rows require a separately reviewed precision-preserving
-- forward rollback; no timestamp/remainder data is removed by this migration.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity text := 'platform_private.cms_execute_publication_schedule(jsonb)';
  cms_owner oid := 'wejammin_cms_definer'::pg_catalog.regrole;
  target_oid oid;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  original_definition text;
  replacement_definition text;
  actual_definition text;
  replacement_source text;
  original_metadata jsonb;
  original_comment text;
  actual_ties double precision[];
  old_assignment text := $old$deviation := pg_catalog.round(pg_catalog.date_part('epoch', actual_at - schedule_row.resolved_at_utc))::bigint;$old$;
  -- Explanatory d=(actual epoch-scheduled epoch)*1e9-remainder; q=div(d,1e9).
  -- All five d occurrences below are complete scalar expressions. No new local
  -- variable, SELECT subquery, ordinary numeric division or floating conversion.
  new_assignment text := $new$deviation := (
        pg_catalog.div(
          (extract(epoch from actual_at) - extract(epoch from schedule_row.resolved_at_utc))
            * 1000000000 - schedule_row.resolved_utc_submicro_ns,
          1000000000)
        + case when pg_catalog.mod(pg_catalog.abs(
            (extract(epoch from actual_at) - extract(epoch from schedule_row.resolved_at_utc))
              * 1000000000 - schedule_row.resolved_utc_submicro_ns
          ), 1000000000) > 500000000
          or (pg_catalog.mod(pg_catalog.abs(
            (extract(epoch from actual_at) - extract(epoch from schedule_row.resolved_at_utc))
              * 1000000000 - schedule_row.resolved_utc_submicro_ns
          ), 1000000000) = 500000000
          and pg_catalog.mod(pg_catalog.abs(pg_catalog.div(
            (extract(epoch from actual_at) - extract(epoch from schedule_row.resolved_at_utc))
              * 1000000000 - schedule_row.resolved_utc_submicro_ns,
            1000000000)), 2) = 1)
          then pg_catalog.sign(
            (extract(epoch from actual_at) - extract(epoch from schedule_row.resolved_at_utc))
              * 1000000000 - schedule_row.resolved_utc_submicro_ns
          ) else 0 end
      )::bigint;$new$;
begin
  select pg_catalog.array_agg(pg_catalog.round(tie) order by ordinal) into actual_ties
  from (values (1, 0.5::double precision), (2, 1.5), (3, 2.5),
               (4, -0.5), (5, -1.5), (6, -2.5)) baseline(ordinal, tie);
  if actual_ties is distinct from array[0, 2, 2, 0, -2, -2]::double precision[] then
    raise exception 'CMS schedule precision deviation backend tie baseline mismatch' using errcode = '55000';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_roles role
     where role.oid = cms_owner
       and not role.rolcanlogin and not role.rolsuper and not role.rolbypassrls
  ) or pg_catalog.has_schema_privilege(cms_owner, 'platform_private', 'CREATE') then
    raise exception 'CMS schedule precision deviation owner baseline mismatch' using errcode = '55000';
  end if;
  target_oid := pg_catalog.to_regprocedure(identity);
  select proc.* into original from pg_catalog.pg_proc proc where proc.oid = target_oid;
  if not found then
    raise exception 'CMS schedule precision deviation function missing' using errcode = '55000';
  end if;
  original_definition := pg_catalog.pg_get_functiondef(target_oid);
  if pg_catalog.md5(original.prosrc) is distinct from 'a11ba874590aca9ee36bf2034f6b7e52'
     or pg_catalog.md5(original_definition) is distinct from '2aa35af2e98c7e2556c024dbdfea3ae6'
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
    raise exception 'CMS schedule precision deviation function baseline mismatch' using errcode = '55000';
  end if;
  original_metadata := pg_catalog.to_jsonb(original) - 'prosrc';
  original_comment := pg_catalog.obj_description(target_oid, 'pg_proc');
  if (pg_catalog.length(original.prosrc) - pg_catalog.length(
      pg_catalog.replace(original.prosrc, old_assignment, '')
    )) / pg_catalog.length(old_assignment) <> 1
     or pg_catalog.strpos(original.prosrc, new_assignment) <> 0
     or (pg_catalog.length(original_definition) - pg_catalog.length(
       pg_catalog.replace(original_definition, original.prosrc, '')
     )) / pg_catalog.length(original.prosrc) <> 1 then
    raise exception 'CMS schedule precision deviation replacement shape mismatch' using errcode = '55000';
  end if;

  replacement_source := pg_catalog.replace(original.prosrc, old_assignment, new_assignment);
  if pg_catalog.replace(replacement_source, new_assignment, old_assignment)
       is distinct from original.prosrc
     or pg_catalog.strpos(replacement_source, old_assignment) <> 0
     or (pg_catalog.length(replacement_source) - pg_catalog.length(
       pg_catalog.replace(replacement_source, new_assignment, '')
     )) / pg_catalog.length(new_assignment) <> 1 then
    raise exception 'CMS schedule precision deviation source inverse mismatch' using errcode = '55000';
  end if;
  replacement_definition := pg_catalog.replace(original_definition, original.prosrc, replacement_source);
  if (pg_catalog.length(replacement_definition) - pg_catalog.length(
      pg_catalog.replace(replacement_definition, replacement_source, '')
    )) / pg_catalog.length(replacement_source) <> 1
     or pg_catalog.replace(replacement_definition, replacement_source, original.prosrc)
       is distinct from original_definition then
    raise exception 'CMS schedule precision deviation definition inverse mismatch' using errcode = '55000';
  end if;
  execute replacement_definition;

  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = target_oid;
  if not found then
    raise exception 'CMS schedule precision deviation replacement missing' using errcode = '55000';
  end if;
  actual_definition := pg_catalog.pg_get_functiondef(target_oid);
  if actual.prosrc is distinct from replacement_source
     or actual.oid is distinct from original.oid
     or (pg_catalog.to_jsonb(actual) - 'prosrc') is distinct from original_metadata
     or pg_catalog.obj_description(target_oid, 'pg_proc') is distinct from original_comment
     or actual_definition is distinct from replacement_definition
     or pg_catalog.replace(actual.prosrc, new_assignment, old_assignment) is distinct from original.prosrc
     or pg_catalog.replace(actual_definition, replacement_source, original.prosrc)
       is distinct from original_definition then
    raise exception 'CMS schedule precision deviation preservation mismatch' using errcode = '55000';
  end if;
end;
$migration$;

commit;
