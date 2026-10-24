-- DEC-199: effective composition pattern provider.
-- Heads are selected before state filtering.  A live NULL-tree pin reopens
-- provenance; a canonical tree owns only its local block identities/digest.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_pattern_active_digest(
  p_revision_id uuid, p_manifest jsonb
)
returns table(outcome text, reason_code text, blocking_count integer)
language plpgsql
stable
security invoker
set search_path = ''
as $body$
declare v_owner_id uuid; item platform_private.cms_composition_instances%rowtype;
  root_pattern platform_private.cms_pattern_versions%rowtype;
  expected_ids text[] := array[]::text[]; actual_ids text[] := array[]::text[];
  seen_live text[] := array[]::text[]; reasons text[] := array[]::text[];
  expected_hash text; root_hash text; digest text; pin_key text; pin_reason text;
  reason text; count_units integer;
begin
  if p_revision_id is null or not platform_private.cms_dependency_manifest_valid(p_manifest) then
    return query select 'unavailable'::text, 'provider_unavailable'::text, 0;
    return;
  end if;
  select revision.owner_id into v_owner_id
    from platform_private.cms_entry_revisions revision
   where revision.id = p_revision_id;
  if not found then
    return query select 'unavailable'::text, 'provider_unavailable'::text, 0;
    return;
  end if;

  select coalesce(
           pg_catalog.array_agg(member.value->>'id' order by (member.value->>'id') collate "C"),
           array[]::text[])
    into expected_ids
    from pg_catalog.jsonb_array_elements(p_manifest->'patterns') member(value);
  with latest as materialized (
    select distinct on (instance.revision_id, instance.path collate "C") instance.*
      from platform_private.cms_composition_instances instance
     where instance.revision_id = p_revision_id
     order by instance.revision_id, instance.path collate "C", instance.version desc, instance.id desc
  )
  select coalesce(pg_catalog.array_agg(id order by id collate "C"), array[]::text[])
    into actual_ids
    from (select distinct pattern.id::text id from latest
           join platform_private.cms_pattern_versions pattern
             on pattern.owner_id = latest.owner_id
            and pattern.pattern_id = latest.pattern_id
            and pattern.version = latest.pattern_version
           where latest.state in ('draft', 'active', 'pending_diff')
             and latest.pattern_id is not null) direct;
  if actual_ids is distinct from expected_ids then
    return query select 'unavailable'::text, 'provider_unavailable'::text, 0;
    return;
  end if;

  for item in
    with latest as materialized (
      select distinct on (instance.revision_id, instance.path collate "C") instance.*
        from platform_private.cms_composition_instances instance
       where instance.revision_id = p_revision_id
       order by instance.revision_id, instance.path collate "C", instance.version desc, instance.id desc
    )
    select latest.* from latest
     where latest.state in ('draft', 'active', 'pending_diff')
     order by latest.path collate "C"
  loop
    if item.pattern_id is null then
      -- A standalone canonical tree belongs to the block provider; only a
      -- non-null local tree has a pattern-category digest obligation.
      if item.detached_tree is not null then
        digest := platform_private.cms_pattern_registry_digest_readonly(v_owner_id, item.detached_tree);
        if digest is distinct from pg_catalog.btrim(item.block_registry_digest::text) then
          reasons := pg_catalog.array_append(reasons, 'pattern_digest_changed');
        end if;
      end if;
      continue;
    end if;

    select pattern.* into root_pattern
      from platform_private.cms_pattern_versions pattern
     where pattern.owner_id = v_owner_id
       and pattern.pattern_id = item.pattern_id
       and pattern.version = item.pattern_version;
    if not found then
      return query select 'unavailable'::text, 'provider_unavailable'::text, 0;
      return;
    end if;
    select member.value->>'hash' into expected_hash
      from pg_catalog.jsonb_array_elements(p_manifest->'patterns') member(value)
     where member.value->>'id' = root_pattern.id::text;
    if expected_hash is null then
      return query select 'unavailable'::text, 'provider_unavailable'::text, 0;
      return;
    end if;
    if item.detached_tree is null then
      pin_key := item.pattern_id::text || ':' || item.pattern_version::text;
      if not (pin_key = any(seen_live)) then
        seen_live := pg_catalog.array_append(seen_live, pin_key);
        pin_reason := platform_private.cms_pattern_live_pin_reason(
          v_owner_id, item.pattern_id, item.pattern_version::integer, expected_hash);
        if pin_reason is not null then reasons := pg_catalog.array_append(reasons, pin_reason); end if;
      end if;
    else
      -- Canonical provenance is an identity check only; root activity and
      -- nested graph state are deliberately not reopened.
      root_hash := root_pattern.content_hash::text;
      if root_hash is distinct from expected_hash then
        reasons := pg_catalog.array_append(reasons, 'pattern_digest_changed');
      else
        digest := platform_private.cms_pattern_registry_digest_readonly(v_owner_id, item.detached_tree);
        if digest is distinct from pg_catalog.btrim(item.block_registry_digest::text) then
          reasons := pg_catalog.array_append(reasons, 'pattern_digest_changed');
        end if;
      end if;
    end if;
  end loop;

  count_units := pg_catalog.cardinality(reasons);
  if count_units = 0 then
    return query select 'passed'::text, null::text, 0;
    return;
  elsif 'pattern_not_active' = any(reasons) then
    reason := 'pattern_not_active';
  elsif 'nested_pattern_not_active' = any(reasons) then
    reason := 'nested_pattern_not_active';
  else
    reason := 'pattern_digest_changed';
  end if;
  return query select 'failed'::text, reason, least(count_units, 1000);
exception when others then
  return query select 'unavailable'::text, 'provider_unavailable'::text, 0;
end;
$body$;

comment on function platform_private.cms_pattern_active_digest(uuid, jsonb) is
  'DEC-199 pattern provider: newest effective composition heads validate live nested pins or canonical local trees, exact direct frozen pattern identities, one unit per live pin/canonical offender, precedence pattern_not_active then nested_pattern_not_active then pattern_digest_changed, count capped at 1000. Unexpected dependencies are unavailable. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_active_digest(uuid, jsonb)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_active_digest(uuid, jsonb)
  from public, anon, authenticated, service_role;

do $guard$
declare item pg_catalog.pg_proc%rowtype;
begin
  select proc.* into item from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(
     'platform_private.cms_pattern_active_digest(uuid,jsonb)');
  if not found or item.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or item.prosecdef or item.prokind <> 'f' or item.provolatile <> 's'
     or not item.proretset or item.prorettype <> 'record'::pg_catalog.regtype
     or item.proconfig is distinct from array['search_path=""']::text[]
     or item.prolang <> (select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql') then
    raise exception 'cms_pattern_active_digest attributes changed' using errcode = '55000';
  end if;
  if pg_catalog.has_function_privilege('anon', item.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', item.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', item.oid, 'EXECUTE') then
    raise exception 'cms_pattern_active_digest is not private' using errcode = '55000';
  end if;
end;
$guard$;

commit;
