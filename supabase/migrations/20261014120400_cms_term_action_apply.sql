-- Slice 12 lane taxonomy-terms, CMS-03C-03 apply steps (BE03c Term actions and merge convergence at 1377, DEC-135 at 1375, transaction seam at
-- 1506, term state machine at 1539; P2-S12-AC-003, AC-016, AC-017): what cms_act_taxonomy_term does once the vocabulary, its ACTIVE version and
-- the caller's authority are proven and the named term rows are locked (lock-order positions 1, 3 and 6, BE03c 1344).  Both functions take the
-- request the validator already accepted and return the id of the term the action wrote; the caller emits the event and answers the resource.
--   cms_term_apply_write  create, rename, alias, deprecate
--   cms_term_apply_merge  merge, then the in-transaction convergence of up to 5,000 assignments (the rest through the continuation job)
-- Decisions (stated in the lane report): a term is addressed by (taxonomyId, termKey); parentId is VALIDATED by every action and APPLIED by create
-- and rename only (null on rename moves the term to the root; alias, deprecate and merge keep the term where it is); a deprecated term keeps its hierarchy; rename, alias and merge are allowed on a deprecated term, deprecate
-- is not; a merged term refuses every action.  Private; SECURITY DEFINER; owned by the CMS definer.  Forward-only.
begin;
set local lock_timeout = '5s';

-- The parent rules of BE03c 379 and 381, shared by every action that names a parent: a parent other than null needs the hierarchical shape, must be
-- a live (not merged) term of the same vocabulary and owner, and can be neither the term itself nor one of its descendants.  A fault is
-- VALIDATION_FAILED at /parentId, identical for an absent, foreign-vocabulary and merged parent (no cross-vocabulary oracle).  p_term_id is null
-- for a term that does not exist yet (create).  Only create and rename APPLY a parent (decision D3); the other actions validate it only.
create or replace function platform_private.cms_term_parent_check(
  p_party_id uuid, p_taxonomy_id uuid, p_shape text, p_parent uuid, p_term_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  parent_row platform_private.cms_terms%rowtype;
begin
  if p_parent is null then
    return;
  end if;
  if p_shape <> 'hierarchical' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/parentId"]';
  end if;
  select * into parent_row from platform_private.cms_terms
   where id = p_parent and taxonomy_id = p_taxonomy_id and owner_id = p_party_id;
  if not found or parent_row.lifecycle = 'merged' or p_parent is not distinct from p_term_id then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/parentId"]';
  end if;
  if p_term_id is not null and exists (
    with recursive ancestors as (
      select parent.id, parent.parent_term_id, array[parent.id]::uuid[] as path
        from platform_private.cms_terms parent where parent.id = p_parent
      union all
      select parent.id, parent.parent_term_id, ancestors.path || parent.id
        from ancestors join platform_private.cms_terms parent on parent.id = ancestors.parent_term_id
       where not parent.id = any (ancestors.path)
    )
    select 1 from ancestors where id = p_term_id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/parentId"]';
  end if;
end;
$body$;

create or replace function platform_private.cms_term_apply_write(
  p_actor_id uuid, p_party_id uuid, p_active_version_id uuid, p_request jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $body$
declare
  active_row platform_private.cms_taxonomy_versions%rowtype;
  term_row platform_private.cms_terms%rowtype;
  has_term boolean;
  action_value constant text := p_request->>'action';
  key_value constant text := p_request->>'termKey';
  new_parent uuid := nullif(p_request->>'parentId', '')::uuid;
  candidates text[];
  new_aliases jsonb;
  new_id uuid;
  written_at timestamptz;
begin
  select * into active_row from platform_private.cms_taxonomy_versions where id = p_active_version_id;
  select * into term_row from platform_private.cms_terms where taxonomy_id = active_row.taxonomy_id and term_key = key_value;
  has_term := found;

  -- existence and state
  if action_value = 'create' then
    if has_term then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  else
    if not has_term then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    if term_row.lifecycle = 'merged' then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
    if action_value = 'deprecate' and term_row.lifecycle <> 'active' then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  end if;
  -- BE03c 379, 381: any parent named by any action obeys the shape, existence and cycle rules
  perform platform_private.cms_term_parent_check(p_party_id, active_row.taxonomy_id, active_row.shape, new_parent,
                                                 case when has_term then term_row.id end);

  -- DEC-135: the canonical overlap check over the strings this action introduces (never for deprecate or merge)
  if action_value in ('create', 'rename', 'alias') then
    select pg_catalog.array_agg(candidate.value order by candidate.ord) into candidates
      from (
        select key_value as value, 0 as ord where action_value = 'create'
        union all
        select label.value ->> 'label', label.ord from pg_catalog.jsonb_array_elements(p_request->'labels') with ordinality label(value, ord)
         where action_value in ('create', 'rename')
        union all
        select alias.value #>> '{}', 1000 + alias.ord from pg_catalog.jsonb_array_elements(p_request->'aliases') with ordinality alias(value, ord)
         where action_value in ('create', 'alias')
      ) candidate;
    perform platform_private.cms_term_overlap_check(active_row.canonical_overlap_domains, candidates);
  end if;

  -- a deprecated term keeps its hierarchy
  if action_value = 'rename' and term_row.lifecycle = 'deprecated' and new_parent is distinct from term_row.parent_term_id then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/parentId"]';
  end if;

  written_at := pg_catalog.clock_timestamp();
  if action_value = 'create' then
    new_aliases := platform_private.cms_term_alias_union('[]'::jsonb, p_request->'aliases');
    begin
      insert into platform_private.cms_terms (owner_id, version, created_at, updated_at, taxonomy_version_id, taxonomy_id, term_key,
                                              parent_term_id, aliases, created_by)
      values (p_party_id, 1, written_at, written_at, active_row.id, active_row.taxonomy_id, key_value, new_parent, new_aliases, p_actor_id)
      returning id into new_id;
    exception when unique_violation then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end;
    perform platform_private.cms_term_write_labels(new_id, p_party_id, p_actor_id, p_request->'labels');
    return new_id;
  elsif action_value = 'rename' then
    perform platform_private.cms_term_write_labels(term_row.id, p_party_id, p_actor_id, p_request->'labels');
    update platform_private.cms_terms
       set parent_term_id = new_parent, version = version + 1, updated_at = written_at
     where id = term_row.id;
  elsif action_value = 'alias' then
    new_aliases := platform_private.cms_term_alias_union(term_row.aliases, p_request->'aliases');
    update platform_private.cms_terms
       set aliases = new_aliases, version = version + 1, updated_at = written_at
     where id = term_row.id;
  else
    update platform_private.cms_terms
       set lifecycle = 'deprecated', version = version + 1, updated_at = written_at
     where id = term_row.id;
  end if;
  return term_row.id;
end;
$body$;

create or replace function platform_private.cms_term_apply_merge(
  p_actor_id uuid, p_party_id uuid, p_active_version_id uuid, p_request jsonb, p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $body$
declare
  active_row platform_private.cms_taxonomy_versions%rowtype;
  retired platform_private.cms_terms%rowtype;
  survivor platform_private.cms_terms%rowtype;
  survivor_id constant uuid := (p_request->>'survivorId')::uuid;
  converged jsonb;
begin
  select * into active_row from platform_private.cms_taxonomy_versions where id = p_active_version_id;
  select * into retired from platform_private.cms_terms where taxonomy_id = active_row.taxonomy_id and term_key = p_request->>'termKey';
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if retired.lifecycle = 'merged' then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  -- the survivor: another live term of this vocabulary (BE03c 372-374: not self, not absent, not merged)
  select * into survivor from platform_private.cms_terms
   where id = survivor_id and taxonomy_id = active_row.taxonomy_id and owner_id = p_party_id;
  if survivor_id = retired.id or not found then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/survivorId"]';
  end if;
  if survivor.lifecycle = 'merged' then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  -- a parent named on a merge is validated like any parent and never applied: the retired term is a redirect, not a node
  perform platform_private.cms_term_parent_check(p_party_id, active_row.taxonomy_id, active_row.shape, nullif(p_request->>'parentId', '')::uuid, retired.id);
  -- no redirect chains, no orphaned children: the stored invariants, refused here as a typed 409
  if exists (select 1 from platform_private.cms_terms child where child.parent_term_id = retired.id)
     or exists (select 1 from platform_private.cms_terms redirected where redirected.successor_id = retired.id) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  update platform_private.cms_terms
     set lifecycle = 'merged', successor_id = survivor.id, version = version + 1, updated_at = pg_catalog.clock_timestamp()
   where id = retired.id;
  converged := platform_private.cms_converge_taxonomy_merge(retired.id, 5000);
  if (converged->>'remaining')::bigint > 0 then
    perform platform_private.cms_request_taxonomy_merge_converge(p_actor_id, p_party_id, retired.id, p_correlation_id);
  end if;
  return retired.id;
end;
$body$;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_term_parent_check(uuid, uuid, text, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_term_apply_write(uuid, uuid, uuid, jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_term_apply_merge(uuid, uuid, uuid, jsonb, uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_term_parent_check(uuid, uuid, text, uuid, uuid),
  platform_private.cms_term_apply_write(uuid, uuid, uuid, jsonb),
  platform_private.cms_term_apply_merge(uuid, uuid, uuid, jsonb, uuid)
  from public, anon, authenticated, service_role;

commit;
