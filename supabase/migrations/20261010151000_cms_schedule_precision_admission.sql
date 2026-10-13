-- Preserve verified schedule nanoseconds as microsecond floors plus private remainders.
-- Forward-only after precision writes: no destructive down migration is safe.
-- Any failed installation guard rolls back this transaction, including the replacement.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity text := 'platform_private.cms_schedule_publication(jsonb)';
  cms_owner oid := 'wejammin_cms_definer'::pg_catalog.regrole;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  original_definition text;
  replacement_definition text;
  actual_definition text;
  replacement_source text;
  inverse_source text;
  original_metadata jsonb;
  original_comment text;
  anchor_index integer;
  old_anchors text[] := array[
    $old$  resolved_value timestamptz;$old$,
    $old$     or local_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{1,6})?)?$' then$old$,
    $old$      local_value := local_text::timestamp;$old$,
    $old$     or resolved_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{1,6})?)?(Z|[+-]([01][0-9]|2[0-3])(:?[0-5][0-9])?)$' then$old$,
    $old$      resolved_value := resolved_text::timestamptz;$old$,
    $old$  if (local_value - (resolved_value at time zone 'UTC'))
       not between interval '-12 hours' and interval '14 hours' then$old$,
    $old$  if resolved_value < accepted_at + interval '60 seconds'
     or resolved_value > accepted_at + interval '366 days' then$old$,
    $old$        'minUtc', platform_private.auth_iso_time(accepted_at + interval '60 seconds'),
        'maxUtc', platform_private.auth_iso_time(accepted_at + interval '366 days'))::text;$old$,
    $old$      reason_code, actual_at_utc, deviation_seconds, version, created_by, created_at, updated_at$old$,
    $old$      review_row.version, 0, null, null, null, null, null, null, 1, publisher_person, stamp, stamp$old$
  ];
  new_anchors text[] := array[
    $new$  resolved_value timestamptz;
  local_submicro_ns smallint;
  resolved_submicro_ns smallint;$new$,
    $new$     or local_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{1,9})?)?$' then$new$,
    $new$      local_submicro_ns := pg_catalog.right(pg_catalog.rpad(
        coalesce(pg_catalog.substring(local_text, '\.([0-9]{1,9})'), ''), 9, '0'), 3)::smallint;
      local_value := pg_catalog.regexp_replace(
        local_text, '(\.[0-9]{6})[0-9]{1,3}', '\1')::timestamp;$new$,
    $new$     or resolved_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{1,9})?)?(Z|[+-]([01][0-9]|2[0-3])(:?[0-5][0-9])?)$' then$new$,
    $new$      resolved_submicro_ns := pg_catalog.right(pg_catalog.rpad(
        coalesce(pg_catalog.substring(resolved_text, '\.([0-9]{1,9})'), ''), 9, '0'), 3)::smallint;
      resolved_value := pg_catalog.regexp_replace(
        resolved_text, '(\.[0-9]{6})[0-9]{1,3}', '\1')::timestamptz;$new$,
    $new$  if (extract(epoch from local_value) * 1000000000 + local_submicro_ns)
       - (extract(epoch from resolved_value) * 1000000000 + resolved_submicro_ns)
       not between -43200000000000::numeric and 50400000000000::numeric then$new$,
    $new$  if extract(epoch from resolved_value) * 1000000000 + resolved_submicro_ns
       < extract(epoch from accepted_at) * 1000000000 + 60000000000::numeric
     or extract(epoch from resolved_value) * 1000000000 + resolved_submicro_ns
       > extract(epoch from accepted_at) * 1000000000 + 31622400000000000::numeric then$new$,
    $new$        'minUtc', pg_catalog.to_char(
          (accepted_at at time zone 'UTC') + interval '60 seconds',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'maxUtc', pg_catalog.to_char(
          (accepted_at at time zone 'UTC') + interval '31622400 seconds',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))::text;$new$,
    $new$      reason_code, actual_at_utc, deviation_seconds, version, created_by, created_at, updated_at,
      local_datetime_submicro_ns, resolved_utc_submicro_ns$new$,
    $new$      review_row.version, 0, null, null, null, null, null, null, 1, publisher_person, stamp, stamp,
      local_submicro_ns, resolved_submicro_ns$new$
  ];
begin
  if not exists (
    select 1 from pg_catalog.pg_roles role
     where role.oid = cms_owner
       and not role.rolcanlogin and not role.rolsuper and not role.rolbypassrls
  ) or pg_catalog.has_schema_privilege(cms_owner, 'platform_private', 'CREATE') then
    raise exception 'CMS schedule precision admission owner baseline mismatch' using errcode = '55000';
  end if;
  if (
    select pg_catalog.count(*) from pg_catalog.pg_attribute attribute
     where attribute.attrelid = 'platform_private.cms_publication_schedules'::pg_catalog.regclass
       and attribute.attname in ('local_datetime_submicro_ns', 'resolved_utc_submicro_ns')
       and attribute.atttypid = 'smallint'::pg_catalog.regtype
       and attribute.attnum > 0 and not attribute.attisdropped and attribute.attnotnull
  ) <> 2 then
    raise exception 'CMS schedule precision admission storage prerequisite missing' using errcode = '55000';
  end if;

  select proc.* into original
    from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'CMS schedule precision admission function missing' using errcode = '55000';
  end if;
  original_definition := pg_catalog.pg_get_functiondef(original.oid);
  if pg_catalog.md5(original.prosrc) is distinct from 'e85fdaf10947771bb99578a9d9d30dea'
     or pg_catalog.md5(original_definition) is distinct from '8812de6db2019816ced766bd06ab5d13'
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
    raise exception 'CMS schedule precision admission function baseline mismatch' using errcode = '55000';
  end if;
  original_metadata := pg_catalog.to_jsonb(original) - 'prosrc';
  original_comment := pg_catalog.obj_description(original.oid, 'pg_proc');
  if pg_catalog.cardinality(old_anchors) <> 10 or pg_catalog.cardinality(new_anchors) <> 10
     or (pg_catalog.length(original_definition) - pg_catalog.length(
       pg_catalog.replace(original_definition, original.prosrc, '')
     )) / pg_catalog.length(original.prosrc) <> 1 then
    raise exception 'CMS schedule precision admission definition shape mismatch' using errcode = '55000';
  end if;

  replacement_source := original.prosrc;
  for anchor_index in 1..pg_catalog.cardinality(old_anchors) loop
    if (pg_catalog.length(original.prosrc) - pg_catalog.length(
         pg_catalog.replace(original.prosrc, old_anchors[anchor_index], '')
       )) / pg_catalog.length(old_anchors[anchor_index]) <> 1
       or pg_catalog.strpos(original.prosrc, new_anchors[anchor_index]) <> 0
       or (pg_catalog.length(replacement_source) - pg_catalog.length(
         pg_catalog.replace(replacement_source, old_anchors[anchor_index], '')
       )) / pg_catalog.length(old_anchors[anchor_index]) <> 1 then
      raise exception 'CMS schedule precision admission anchor mismatch' using errcode = '55000';
    end if;
    replacement_source := pg_catalog.replace(
      replacement_source, old_anchors[anchor_index], new_anchors[anchor_index]
    );
  end loop;
  inverse_source := replacement_source;
  for anchor_index in reverse pg_catalog.cardinality(new_anchors)..1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(
         pg_catalog.replace(inverse_source, new_anchors[anchor_index], '')
       )) / pg_catalog.length(new_anchors[anchor_index]) <> 1 then
      raise exception 'CMS schedule precision admission inverse anchor mismatch' using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(
      inverse_source, new_anchors[anchor_index], old_anchors[anchor_index]
    );
  end loop;
  if inverse_source is distinct from original.prosrc then
    raise exception 'CMS schedule precision admission source inverse mismatch' using errcode = '55000';
  end if;

  replacement_definition := pg_catalog.replace(
    original_definition, original.prosrc, replacement_source
  );
  if (pg_catalog.length(replacement_definition) - pg_catalog.length(
       pg_catalog.replace(replacement_definition, replacement_source, '')
     )) / pg_catalog.length(replacement_source) <> 1
     or pg_catalog.replace(replacement_definition, replacement_source, inverse_source)
       is distinct from original_definition then
    raise exception 'CMS schedule precision admission definition inverse mismatch' using errcode = '55000';
  end if;

  execute replacement_definition;

  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = original.oid;
  if not found then
    raise exception 'CMS schedule precision admission replacement missing' using errcode = '55000';
  end if;
  actual_definition := pg_catalog.pg_get_functiondef(actual.oid);
  inverse_source := actual.prosrc;
  for anchor_index in reverse pg_catalog.cardinality(new_anchors)..1 loop
    inverse_source := pg_catalog.replace(
      inverse_source, new_anchors[anchor_index], old_anchors[anchor_index]
    );
  end loop;
  if actual.prosrc is distinct from replacement_source
     or (pg_catalog.to_jsonb(actual) - 'prosrc') is distinct from original_metadata
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from original_comment
     or actual_definition is distinct from replacement_definition
     or inverse_source is distinct from original.prosrc
     or pg_catalog.replace(actual_definition, replacement_source, inverse_source)
       is distinct from original_definition then
    raise exception 'CMS schedule precision admission preservation mismatch' using errcode = '55000';
  end if;
end;
$migration$;

commit;
