-- Slice 12 lane taxonomy-terms (BE03c 1371, 1377, 1489, 1539; P2-S12-AC-003): the three stored term guards learn the vocabulary lineage and the
-- term state machine.  Replaces, forward-only and keeping every prior rule except the three named below,
--   cms_terms_hierarchy_cycle_guard   (20260927380000/390000)  acyclic hierarchy; a merged term is no parent; a parent with children cannot merge
--   cms_terms_successor_guard         (20260927400000/410000)  a merged term redirects directly to a live survivor; no redirect chains
--   cms_terms_lifecycle_guard         (20260927270000/280000)  stable identity; one version per accepted action; merged is terminal
-- The three changes:
--   1 SERIALIZATION.  The hierarchy and successor guards serialized a vocabulary by `SELECT ... FOR UPDATE` on the taxonomy VERSION row the
--     term was written under.  CMS-03C-03 holds the vocabulary's ACTIVE version row `FOR SHARE` (lock-order position 3, BE03c 1344) and a
--     term may now be written under an older version row, so that lock upgrade could deadlock two curators.  A transaction-scoped advisory
--     lock per vocabulary lineage serializes hierarchy and redirect writes instead; it is taken after every row lock (the last position).
--   2 SURVIVOR.  BE03c 1377: "a survivor that is `active` or `deprecated`".  The stored guard accepted `active` only.
--   3 LIFECYCLE.  BE03c 1539: active -> deprecated -> merged, and active -> merged.  The stored guard refused every update of a deprecated
--     term, so a deprecated term could neither be relabelled nor merged.  Now a deprecated term may take aliases and a merge, never a parent
--     change and never a return to active; a merged term is terminal.
-- taxonomy_id is a definition column of the whole-row comparison, so it is immutable.  The functions keep their definer owner.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_terms_hierarchy_cycle_guard()
returns trigger language plpgsql security definer set search_path = '' as $body$
declare
  parent_lifecycle text;
begin
  if new.parent_term_id is null and new.lifecycle <> 'merged' then
    return new;
  end if;

  -- One serialization point per vocabulary lineage for attaching a child and for merging a parent (an advisory lock does not
  -- conflict with the FOR SHARE the command holds on the active version row).
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('cms.taxonomy.hierarchy:' || new.taxonomy_id::text, 0));

  if new.parent_term_id is not null then
    select parent.lifecycle into parent_lifecycle
      from platform_private.cms_terms parent
     where parent.id = new.parent_term_id;
    if parent_lifecycle = 'merged' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;

    if tg_op = 'INSERT' or
       (tg_op = 'UPDATE' and new.parent_term_id is distinct from old.parent_term_id) then
      if exists (
        with recursive ancestors as (
          select parent.id, parent.parent_term_id, array[parent.id]::uuid[] as path
            from platform_private.cms_terms parent
           where parent.id = new.parent_term_id
          union all
          select parent.id, parent.parent_term_id, ancestors.path || parent.id
            from ancestors
            join platform_private.cms_terms parent on parent.id = ancestors.parent_term_id
           where not parent.id = any(ancestors.path)
        )
        select 1 from ancestors where id = new.id
      ) then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if new.lifecycle = 'merged' and exists (
    select 1 from platform_private.cms_terms child where child.parent_term_id = new.id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  return new;
end;
$body$;

create or replace function platform_private.cms_terms_successor_guard()
returns trigger language plpgsql security definer set search_path = '' as $body$
declare
  survivor_lifecycle text;
begin
  if new.lifecycle <> 'merged' then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('cms.taxonomy.hierarchy:' || new.taxonomy_id::text, 0));

  if new.successor_id is null or new.successor_id = new.id then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  -- The composite foreign key keeps a redirect inside the vocabulary and owner (SQLSTATE 23503); the lifecycle is checked here.
  select survivor.lifecycle into survivor_lifecycle
    from platform_private.cms_terms survivor
   where survivor.id = new.successor_id;
  if survivor_lifecycle is distinct from 'active' and survivor_lifecycle is distinct from 'deprecated' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  -- A term that other terms were merged into stays a terminal survivor: no redirect chains or cycles.
  if exists (select 1 from platform_private.cms_terms retired where retired.successor_id = new.id) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  return new;
end;
$body$;

create or replace function platform_private.cms_terms_lifecycle_guard()
returns trigger language plpgsql set search_path = '' as $body$
begin
  if tg_op = 'INSERT' then
    if new.lifecycle <> 'active' or new.successor_id is not null
       or new.version <> 1 or new.updated_at <> new.created_at then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- A merged term is a permanent redirect: it never changes again, and no term is ever deleted.
  if tg_op = 'DELETE' or old.lifecycle = 'merged' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- The stable key, owner, vocabulary, creator and creation instant never move; every accepted action consumes exactly one version.
  if (to_jsonb(new) - 'lifecycle' - 'successor_id' - 'aliases' - 'parent_term_id' - 'version' - 'updated_at') is distinct from
     (to_jsonb(old) - 'lifecycle' - 'successor_id' - 'aliases' - 'parent_term_id' - 'version' - 'updated_at')
     or new.version <> old.version + 1
     or new.updated_at <= old.updated_at
     or (new.lifecycle = 'merged' and new.successor_id is null)
     or (new.lifecycle <> 'merged' and new.successor_id is not null) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- active -> deprecated | merged and deprecated -> merged only: no reactivation.
  if new.lifecycle <> old.lifecycle
     and not (old.lifecycle = 'active' and new.lifecycle in ('deprecated', 'merged')
              or old.lifecycle = 'deprecated' and new.lifecycle = 'merged') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- The hierarchy is edited only while a term is active.
  if old.lifecycle = 'deprecated' and new.parent_term_id is distinct from old.parent_term_id then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

revoke all on function platform_private.cms_terms_hierarchy_cycle_guard() from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_terms_successor_guard() from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_terms_lifecycle_guard() from public, anon, authenticated, service_role;

commit;
