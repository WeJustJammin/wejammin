-- DEC-201: dependency lock planner.  Heads and refs are provided by 44500.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create function platform_private.cms_restore_composition_plan(p_source_revision_id uuid)
returns table(
  heads platform_private.cms_composition_instances[],
  pattern_ids uuid[],
  block_ids uuid[])
language plpgsql
volatile
security invoker
set search_path = ''
as $body$
declare
  source_revision platform_private.cms_entry_revisions;
  source_template_id uuid;
  after_template_id uuid;
  selected_heads platform_private.cms_composition_instances[];
  after_heads platform_private.cms_composition_instances[];
  selected_patterns uuid[] := '{}'::uuid[];
  selected_blocks uuid[] := '{}'::uuid[];
  after_patterns uuid[] := '{}'::uuid[];
  after_blocks uuid[] := '{}'::uuid[];
  head_row platform_private.cms_composition_instances;
  reference record;
  dependency record;
begin
  select revision.* into source_revision
    from platform_private.cms_entry_revisions revision
   where revision.id = p_source_revision_id;
  if not found then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  source_template_id := source_revision.template_version_id;
  select coalesce(
    pg_catalog.array_agg(item order by item.position, item.path collate "C", item.id),
    '{}'::platform_private.cms_composition_instances[])
    into selected_heads
    from platform_private.cms_restore_composition_heads(p_source_revision_id) item;
  for head_row in
    select item.* from pg_catalog.unnest(selected_heads) item
  loop
    for reference in
      select * from platform_private.cms_restore_composition_refs(head_row)
    loop
      if reference.ref_id is null then
        raise exception 'migration_chain_incomplete' using errcode = 'P0001';
      elsif reference.kind = 'pattern' then
        if not (reference.ref_id = any(selected_patterns)) then
          selected_patterns := pg_catalog.array_append(selected_patterns, reference.ref_id);
        end if;
      elsif reference.kind = 'block' then
        if not (reference.ref_id = any(selected_blocks)) then
          selected_blocks := pg_catalog.array_append(selected_blocks, reference.ref_id);
        end if;
      elsif reference.kind <> 'template'
         or reference.ref_id is distinct from source_template_id then
        raise exception 'migration_chain_incomplete' using errcode = 'P0001';
      end if;
    end loop;
  end loop;
  select coalesce(pg_catalog.array_agg(member order by member), '{}'::uuid[])
    into selected_patterns
    from (select distinct member from pg_catalog.unnest(selected_patterns) member)
      unique_members;
  select coalesce(pg_catalog.array_agg(member order by member), '{}'::uuid[])
    into selected_blocks
    from (select distinct member from pg_catalog.unnest(selected_blocks) member)
      unique_members;
  for dependency in
    select 'template'::text as kind, source_template_id as ref_id
      where source_template_id is not null
    union all
    select 'pattern'::text, member
      from pg_catalog.unnest(selected_patterns) member
    union all
    select 'block'::text, member
      from pg_catalog.unnest(selected_blocks) member
    order by ref_id, kind
  loop
    begin
      if dependency.kind = 'template' then
        perform 1
          from platform_private.cms_template_versions template_row
         where template_row.id = dependency.ref_id
           and template_row.owner_id = source_revision.owner_id
           for share;
        if not found then
          raise exception 'template_incompatible' using errcode = 'P0001';
        end if;
      elsif dependency.kind = 'pattern' then
        perform 1
          from platform_private.cms_pattern_versions pattern_row
         where pattern_row.id = dependency.ref_id
           and pattern_row.owner_id = source_revision.owner_id
           for share;
        if not found then
          raise exception 'migration_chain_incomplete' using errcode = 'P0001';
        end if;
      else
        perform 1
          from platform_private.cms_block_definition_versions block_row
         where block_row.id = dependency.ref_id
           and block_row.state = 'registered'
           for share;
        if not found then
          raise exception 'migration_chain_incomplete' using errcode = 'P0001';
        end if;
      end if;
    exception
      when deadlock_detected or lock_not_available then
        raise exception 'CONFLICT' using errcode = 'P0001';
    end;
  end loop;
  select revision.template_version_id into after_template_id
    from platform_private.cms_entry_revisions revision
   where revision.id = p_source_revision_id;
  if not found then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  if after_template_id is distinct from source_template_id then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  select coalesce(
    pg_catalog.array_agg(item order by item.position, item.path collate "C", item.id),
    '{}'::platform_private.cms_composition_instances[])
    into after_heads
    from platform_private.cms_restore_composition_heads(p_source_revision_id) item;
  if after_heads is distinct from selected_heads then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  for head_row in
    select item.* from pg_catalog.unnest(after_heads) item
  loop
    for reference in
      select * from platform_private.cms_restore_composition_refs(head_row)
    loop
      if reference.ref_id is null then
        raise exception 'migration_chain_incomplete' using errcode = 'P0001';
      elsif reference.kind = 'pattern' then
        after_patterns := pg_catalog.array_append(after_patterns, reference.ref_id);
      elsif reference.kind = 'block' then
        after_blocks := pg_catalog.array_append(after_blocks, reference.ref_id);
      elsif reference.kind <> 'template'
         or reference.ref_id is distinct from source_template_id then
        raise exception 'CONFLICT' using errcode = 'P0001';
      end if;
    end loop;
  end loop;
  select coalesce(pg_catalog.array_agg(distinct member order by member), '{}'::uuid[])
    into after_patterns
    from pg_catalog.unnest(after_patterns) member;
  select coalesce(pg_catalog.array_agg(distinct member order by member), '{}'::uuid[])
    into after_blocks
    from pg_catalog.unnest(after_blocks) member;
  if after_patterns is distinct from selected_patterns
     or after_blocks is distinct from selected_blocks then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  heads := selected_heads;
  pattern_ids := selected_patterns;
  block_ids := selected_blocks;
  return next;
end;
$body$;

do $owner$
declare
  had_create boolean := pg_catalog.has_schema_privilege(
    'wejammin_cms_definer', 'platform_private', 'CREATE');
begin
  if not had_create then
    grant create on schema platform_private to wejammin_cms_definer;
  end if;
  alter function platform_private.cms_restore_composition_plan(uuid)
    owner to wejammin_cms_definer;
  if not had_create then
    revoke create on schema platform_private from wejammin_cms_definer;
  end if;
end;
$owner$;
revoke all on function platform_private.cms_restore_composition_plan(uuid)
  from public, anon, authenticated, service_role;

do $guard$
declare
  proc pg_catalog.pg_proc%rowtype;
  dependency regprocedure;
  signature text;
begin
  select item.* into proc
    from pg_catalog.pg_proc item
   where item.oid = pg_catalog.to_regprocedure(
     'platform_private.cms_restore_composition_plan(uuid)');
  if not found
     or proc.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or proc.prosecdef or proc.prokind <> 'f' or proc.provolatile <> 'v'
     or not proc.proretset or proc.pronargs <> 1 or proc.pronargdefaults <> 0
     or proc.prorettype <> 'record'::pg_catalog.regtype
     or proc.proconfig is distinct from array['search_path=""']::text[]
     or proc.prolang <> (
       select language.oid from pg_catalog.pg_language language
        where language.lanname = 'plpgsql')
     or (select pg_catalog.count(*) from pg_catalog.pg_proc item
       where item.pronamespace = proc.pronamespace and item.proname = proc.proname) <> 1
     or exists (select 1 from pg_catalog.aclexplode(proc.proacl) acl where acl.grantee = 0)
     or pg_catalog.has_function_privilege('anon', proc.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', proc.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', proc.oid, 'EXECUTE') then
    raise exception 'restore composition plan attributes/ACL changed'
      using errcode = '55000';
  end if;
  foreach signature in array array[
    'platform_private.cms_restore_composition_heads(uuid)',
    'platform_private.cms_restore_composition_refs(platform_private.cms_composition_instances)'
  ] loop
    dependency := pg_catalog.to_regprocedure(signature);
    if dependency is null
       or not pg_catalog.has_function_privilege('wejammin_cms_definer', dependency, 'EXECUTE') then
      raise exception 'restore composition plan dependency unavailable: %', signature
        using errcode = '55000';
    end if;
  end loop;
  foreach signature in array array[
    'platform_private.cms_composition_instances',
    'platform_private.cms_entry_revisions',
    'platform_private.cms_template_versions',
    'platform_private.cms_pattern_versions',
    'platform_private.cms_block_definition_versions'
  ] loop
    if not pg_catalog.has_table_privilege('wejammin_cms_definer', signature, 'SELECT') then
      raise exception 'restore composition plan source unavailable: %', signature
        using errcode = '55000';
    end if;
  end loop;
end;
$guard$;

commit;
