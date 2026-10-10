-- Private exact-instant storage. Legacy six-digit instants acquire remainder 0.
-- Forward-only: after nanosecond writes there is no lossless destructive DOWN.
-- Failed installation rolls back this entire transaction; never delete precision.
begin;
set local lock_timeout = '5s';
lock table platform_private.cms_publication_schedules in access exclusive mode;

do $migration$
declare
  target oid := 'platform_private.cms_publication_schedules'::pg_catalog.regclass;
  guard_oid oid := pg_catalog.to_regprocedure('platform_private.cms_schedule_state_guard()');
  original pg_catalog.pg_class%rowtype;
  metadata jsonb;
  original_metadata jsonb;
  original_rows bigint;
  original_hash bytea;
  row_count bigint;
  rolling_hash bytea;
  row_image record;
  pass integer;
  new_columns text[] := array['local_datetime_submicro_ns', 'resolved_utc_submicro_ns'];
  replaced text[] := array['cms_publication_schedules_identity_unique',
    'cms_publication_schedules_offset_check'];
  new_checks text[] := array['cms_publication_schedules_local_submicro_ns_check',
    'cms_publication_schedules_resolved_submicro_ns_check'];
  old_identity text := 'UNIQUE (entry_id, revision_id, action, local_datetime, timezone, audience)';
  new_identity text := 'UNIQUE (entry_id, revision_id, action, local_datetime, local_datetime_submicro_ns, timezone, audience)';
  old_offset text := $definition$CHECK ((((local_datetime - (resolved_at_utc AT TIME ZONE 'UTC'::text)) >= '-12:00:00'::interval) AND ((local_datetime - (resolved_at_utc AT TIME ZONE 'UTC'::text)) <= '14:00:00'::interval)))$definition$;
  old_index text := 'CREATE UNIQUE INDEX cms_publication_schedules_identity_unique ON platform_private.cms_publication_schedules USING btree (entry_id, revision_id, action, local_datetime, timezone, audience)';
begin
  select c.* into strict original from pg_catalog.pg_class c where c.oid = target;
  if original.relowner is distinct from 'postgres'::pg_catalog.regrole
     or original.relkind is distinct from 'r'
     or original.relrowsecurity is distinct from true
     or original.relforcerowsecurity is distinct from true
     or original.relacl is distinct from array['postgres=arwdDxtm/postgres',
       'wejammin_cms_definer=arw/postgres']::pg_catalog.aclitem[]
     or exists (select 1 from pg_catalog.pg_attribute a
       where a.attrelid = target and a.attname = any(new_columns))
     or exists (select 1 from pg_catalog.pg_constraint c
       where c.conrelid = target and c.conname = any(new_checks)) then
    raise exception 'CMS precision storage relation baseline mismatch' using errcode = '55000';
  end if;
  if (select pg_catalog.pg_get_constraintdef(c.oid) from pg_catalog.pg_constraint c
       where c.conrelid = target and c.conname = replaced[1]) is distinct from old_identity
     or (select pg_catalog.pg_get_constraintdef(c.oid) from pg_catalog.pg_constraint c
       where c.conrelid = target and c.conname = replaced[2]) is distinct from old_offset
     or (select pg_catalog.pg_get_indexdef(c.conindid) from pg_catalog.pg_constraint c
       where c.conrelid = target and c.conname = replaced[1]) is distinct from old_index
     or (select pg_catalog.md5(p.prosrc) from pg_catalog.pg_proc p where p.oid = guard_oid)
       is distinct from 'be0cf18d76840b6722c28d7f85170dfb'
     or pg_catalog.md5(pg_catalog.pg_get_functiondef(guard_oid))
       is distinct from '904d575199e4e15058531f7ba5065e43' then
    raise exception 'CMS precision storage constraint or guard baseline mismatch' using errcode = '55000';
  end if;

  for pass in 1..2 loop
    -- Catalog aggregates are bounded by schema size, never by stored row count.
    -- OIDs/definition-linked members of the two replaced constraints and backing
    -- index are intentional exceptions. All other catalog objects stay exact.
    -- Rebuilding the identity index refreshes the heap's planner statistics
    -- (relpages/reltuples/relallvisible) whenever rows exist; they are not schema.
    select pg_catalog.jsonb_build_object(
      'relation', pg_catalog.to_jsonb(c) - array['relnatts', 'relchecks',
        'relpages', 'reltuples', 'relallvisible'],
      'comments', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) order by d.objsubid)
        from pg_catalog.pg_description d where d.objoid = target
          and d.classoid = 'pg_catalog.pg_class'::pg_catalog.regclass
          and d.objsubid <= original.relnatts),
      'attributes', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a) order by a.attnum)
        from pg_catalog.pg_attribute a where a.attrelid = target and a.attnum <= original.relnatts),
      'defaults', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) order by d.adnum)
        from pg_catalog.pg_attrdef d where d.adrelid = target and d.adnum <= original.relnatts),
      'constraints', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'row', pg_catalog.to_jsonb(k), 'definition', pg_catalog.pg_get_constraintdef(k.oid),
          'comment', pg_catalog.obj_description(k.oid, 'pg_constraint')) order by k.oid)
        from pg_catalog.pg_constraint k where (k.conrelid = target or k.confrelid = target)
          and not (k.conrelid = target and k.conname = any(replaced || new_checks))),
      'replacedConstraints', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'row', pg_catalog.to_jsonb(k) - array['oid', 'conkey', 'conbin', 'conindid'],
          'comment', pg_catalog.obj_description(k.oid, 'pg_constraint')) order by k.conname)
        from pg_catalog.pg_constraint k where k.conrelid = target and k.conname = any(replaced)),
      'indexes', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'row', pg_catalog.to_jsonb(i), 'relation', pg_catalog.to_jsonb(ic),
          'definition', pg_catalog.pg_get_indexdef(i.indexrelid),
          'attributes', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a) order by a.attnum)
            from pg_catalog.pg_attribute a where a.attrelid = i.indexrelid),
          'comments', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) order by d.objsubid)
            from pg_catalog.pg_description d where d.objoid = i.indexrelid
              and d.classoid = 'pg_catalog.pg_class'::pg_catalog.regclass)) order by i.indexrelid)
        from pg_catalog.pg_index i join pg_catalog.pg_class ic on ic.oid = i.indexrelid
        where i.indrelid = target and ic.relname <> replaced[1]),
      'identityIndex', (select pg_catalog.jsonb_build_object(
          'row', pg_catalog.to_jsonb(i) - array['indexrelid', 'indnatts', 'indnkeyatts',
            'indkey', 'indcollation', 'indclass', 'indoption'],
          'relation', pg_catalog.to_jsonb(ic) - array['oid', 'relfilenode', 'relnatts',
            'relpages', 'reltuples'],
          'comment', pg_catalog.obj_description(ic.oid, 'pg_class'))
        from pg_catalog.pg_index i join pg_catalog.pg_class ic on ic.oid = i.indexrelid
        where i.indrelid = target and ic.relname = replaced[1]),
      'triggers', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'row', pg_catalog.to_jsonb(t), 'definition', pg_catalog.pg_get_triggerdef(t.oid),
          'comment', pg_catalog.obj_description(t.oid, 'pg_trigger')) order by t.oid)
        from pg_catalog.pg_trigger t where t.tgrelid = target),
      'policies', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'row', pg_catalog.to_jsonb(p), 'comment', pg_catalog.obj_description(p.oid, 'pg_policy')) order by p.oid)
        from pg_catalog.pg_policy p where p.polrelid = target),
      'guard', (select pg_catalog.jsonb_build_object('row', pg_catalog.to_jsonb(p),
          'definition', pg_catalog.pg_get_functiondef(p.oid),
          'comment', pg_catalog.obj_description(p.oid, 'pg_proc'))
        from pg_catalog.pg_proc p where p.oid = guard_oid)
    ) into metadata from pg_catalog.pg_class c where c.oid = target;

    row_count := 0;
    rolling_hash := pg_catalog.sha256(pg_catalog.convert_to('CMS schedule legacy rows v1', 'UTF8'));
    for row_image in
      select pg_catalog.sha256(pg_catalog.convert_to((pg_catalog.to_jsonb(s) -
          case when pass = 1 then array[]::text[] else new_columns end)::text, 'UTF8')) as hash,
        pg_catalog.to_jsonb(s)->'local_datetime_submicro_ns' = '0'::jsonb
          and pg_catalog.to_jsonb(s)->'resolved_utc_submicro_ns' = '0'::jsonb as zero_remainders
      from platform_private.cms_publication_schedules s order by s.id
    loop
      if pass = 2 and row_image.zero_remainders is distinct from true then
        raise exception 'CMS precision storage legacy remainder mismatch' using errcode = '55000';
      end if;
      rolling_hash := pg_catalog.sha256(rolling_hash || row_image.hash);
      row_count := row_count + 1;
    end loop;

    if pass = 1 then
      original_metadata := metadata;
      original_rows := row_count;
      original_hash := rolling_hash;
      alter table platform_private.cms_publication_schedules
        add column local_datetime_submicro_ns smallint not null default 0,
        add column resolved_utc_submicro_ns smallint not null default 0,
        add constraint cms_publication_schedules_local_submicro_ns_check
          check (local_datetime_submicro_ns >= 0 and local_datetime_submicro_ns <= 999),
        add constraint cms_publication_schedules_resolved_submicro_ns_check
          check (resolved_utc_submicro_ns >= 0 and resolved_utc_submicro_ns <= 999),
        drop constraint cms_publication_schedules_identity_unique,
        drop constraint cms_publication_schedules_offset_check;
      alter table platform_private.cms_publication_schedules
        add constraint cms_publication_schedules_identity_unique
          unique (entry_id, revision_id, action, local_datetime,
            local_datetime_submicro_ns, timezone, audience),
        add constraint cms_publication_schedules_offset_check check (
          (extract(epoch from local_datetime) - extract(epoch from resolved_at_utc))
            * 1000000000::numeric + local_datetime_submicro_ns - resolved_utc_submicro_ns
          between -43200000000000::numeric and 50400000000000::numeric
        );
    elsif metadata is distinct from original_metadata
       or row_count is distinct from original_rows
       or rolling_hash is distinct from original_hash then
      raise exception 'CMS precision storage catalog or legacy row preservation mismatch' using errcode = '55000';
    end if;
  end loop;

  if not exists (select 1 from pg_catalog.pg_class c where c.oid = target
       and c.relnatts = original.relnatts + 2 and c.relchecks = original.relchecks + 2)
     or (select count(*) from pg_catalog.pg_attribute a
       join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attrelid = target and a.attname = any(new_columns)
         and a.attnum > original.relnatts and a.atttypid = 'smallint'::pg_catalog.regtype
         and a.attnotnull and not a.attisdropped and a.attacl is null
         and a.attidentity = '' and a.attgenerated = ''
         and pg_catalog.pg_get_expr(d.adbin, d.adrelid) in ('0', '0::smallint')) <> 2
     or (select count(*) from pg_catalog.pg_constraint k
       join pg_catalog.pg_attribute a on a.attrelid = k.conrelid and k.conkey = array[a.attnum]
       where k.conrelid = target and k.conname = any(new_checks)
         and k.contype = 'c' and k.convalidated and a.attname = any(new_columns)
         and pg_catalog.regexp_replace(pg_catalog.pg_get_expr(k.conbin, k.conrelid),
           '[[:space:]()]', '', 'g') = a.attname || '>=0AND' || a.attname || '<=999') <> 2
     or (select pg_catalog.pg_get_constraintdef(k.oid) from pg_catalog.pg_constraint k
       where k.conrelid = target and k.conname = replaced[1]) is distinct from new_identity
     or (select pg_catalog.pg_get_indexdef(k.conindid) from pg_catalog.pg_constraint k
       where k.conrelid = target and k.conname = replaced[1]) is distinct from
         pg_catalog.replace(old_index, 'local_datetime, timezone',
           'local_datetime, local_datetime_submicro_ns, timezone') then
    raise exception 'CMS precision storage installed shape mismatch' using errcode = '55000';
  end if;
end;
$migration$;

commit;
