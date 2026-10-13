-- CMS-03B-20: exact pending instant and stable timestamp/ns/id claim ordering.
-- Only four installed-source fragments change. Retry due time, expired recovery,
-- locks, batch, CAS, lease duration and the public claim envelope remain intact.
-- Forward-only: inverse checks prove scope, not a destructive down migration.
-- After precision-bearing writes, any rollback needs a separately reviewed
-- precision-preserving forward migration; do not remove the remainder columns.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity text := 'platform_private.cms_claim_due_publication_schedules(jsonb)';
  cms_owner oid := 'wejammin_cms_definer'::pg_catalog.regrole;
  target_oid oid;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  original_definition text;
  replacement_definition text;
  actual_definition text;
  replacement_source text;
  inverse_source text;
  original_metadata jsonb;
  original_comment text;
  fragment integer;
  old_fragments text[] := array[
    $old$(schedule_item.state = 'pending' and schedule_item.resolved_at_utc <= stamp)$old$,
    $old$order by schedule_item.resolved_at_utc, schedule_item.id$old$,
    $old$              schedule_item.resolved_at_utc
  )$old$,
    $old$order by moved.resolved_at_utc, moved.id$old$
  ];
  new_fragments text[] := array[
    $new$(schedule_item.state = 'pending'
          and extract(epoch from schedule_item.resolved_at_utc) * 1000000000
              + schedule_item.resolved_utc_submicro_ns
              <= extract(epoch from stamp) * 1000000000)$new$,
    $new$order by schedule_item.resolved_at_utc, schedule_item.resolved_utc_submicro_ns, schedule_item.id$new$,
    $new$              schedule_item.resolved_at_utc, schedule_item.resolved_utc_submicro_ns
  )$new$,
    $new$order by moved.resolved_at_utc, moved.resolved_utc_submicro_ns, moved.id$new$
  ];
begin
  if not exists (
    select 1 from pg_catalog.pg_roles role
     where role.oid = cms_owner
       and not role.rolcanlogin and not role.rolsuper and not role.rolbypassrls
  ) or pg_catalog.has_schema_privilege(cms_owner, 'platform_private', 'CREATE') then
    raise exception 'CMS schedule precision claim owner baseline mismatch' using errcode = '55000';
  end if;
  target_oid := pg_catalog.to_regprocedure(identity);
  select proc.* into original from pg_catalog.pg_proc proc where proc.oid = target_oid;
  if not found then
    raise exception 'CMS schedule precision claim function missing' using errcode = '55000';
  end if;
  original_definition := pg_catalog.pg_get_functiondef(target_oid);
  if pg_catalog.md5(original.prosrc) is distinct from 'd7b9b41bd73522bfe2bcafac97ac3c41'
     or pg_catalog.md5(original_definition) is distinct from '4878897acb07591ff12fe415f23c3b1e'
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
    raise exception 'CMS schedule precision claim function baseline mismatch' using errcode = '55000';
  end if;
  original_metadata := pg_catalog.to_jsonb(original) - 'prosrc';
  original_comment := pg_catalog.obj_description(target_oid, 'pg_proc');
  if (pg_catalog.length(original_definition) - pg_catalog.length(
      pg_catalog.replace(original_definition, original.prosrc, '')
    )) / pg_catalog.length(original.prosrc) <> 1 then
    raise exception 'CMS schedule precision claim definition shape mismatch' using errcode = '55000';
  end if;

  replacement_source := original.prosrc;
  for fragment in 1..pg_catalog.array_length(old_fragments, 1) loop
    if (pg_catalog.length(replacement_source) - pg_catalog.length(pg_catalog.replace(
        replacement_source, old_fragments[fragment], ''
      ))) / pg_catalog.length(old_fragments[fragment]) <> 1
       or pg_catalog.strpos(replacement_source, new_fragments[fragment]) <> 0 then
      raise exception 'CMS schedule precision claim anchor % mismatch', fragment using errcode = '55000';
    end if;
    replacement_source := pg_catalog.replace(
      replacement_source, old_fragments[fragment], new_fragments[fragment]);
  end loop;
  inverse_source := replacement_source;
  for fragment in reverse pg_catalog.array_length(new_fragments, 1)..1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(pg_catalog.replace(
        inverse_source, new_fragments[fragment], ''
      ))) / pg_catalog.length(new_fragments[fragment]) <> 1 then
      raise exception 'CMS schedule precision claim inverse anchor % mismatch', fragment using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(inverse_source, new_fragments[fragment], old_fragments[fragment]);
  end loop;
  if inverse_source is distinct from original.prosrc then
    raise exception 'CMS schedule precision claim source inverse mismatch' using errcode = '55000';
  end if;

  replacement_definition := pg_catalog.replace(original_definition, original.prosrc, replacement_source);
  if (pg_catalog.length(replacement_definition) - pg_catalog.length(
      pg_catalog.replace(replacement_definition, replacement_source, '')
    )) / pg_catalog.length(replacement_source) <> 1
     or pg_catalog.replace(replacement_definition, replacement_source, original.prosrc)
       is distinct from original_definition then
    raise exception 'CMS schedule precision claim definition inverse mismatch' using errcode = '55000';
  end if;
  execute replacement_definition;

  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = target_oid;
  if not found then
    raise exception 'CMS schedule precision claim replacement missing' using errcode = '55000';
  end if;
  actual_definition := pg_catalog.pg_get_functiondef(target_oid);
  inverse_source := actual.prosrc;
  for fragment in reverse pg_catalog.array_length(new_fragments, 1)..1 loop
    inverse_source := pg_catalog.replace(inverse_source, new_fragments[fragment], old_fragments[fragment]);
  end loop;
  if actual.prosrc is distinct from replacement_source
     or actual.oid is distinct from original.oid
     or (pg_catalog.to_jsonb(actual) - 'prosrc') is distinct from original_metadata
     or pg_catalog.obj_description(target_oid, 'pg_proc') is distinct from original_comment
     or actual_definition is distinct from replacement_definition
     or inverse_source is distinct from original.prosrc
     or pg_catalog.replace(actual_definition, replacement_source, original.prosrc)
       is distinct from original_definition then
    raise exception 'CMS schedule precision claim preservation mismatch' using errcode = '55000';
  end if;
end;
$migration$;

commit;
