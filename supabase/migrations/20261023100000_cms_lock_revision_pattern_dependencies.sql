-- Lane races-canonical, DEC-199 / BE03b "Write-path lock order and authority fencing" position 3 and
-- BE03c "Slice 12 lock order" (a command takes pinned pattern version rows before the content-type
-- version of position 4 and the review of position 5): the private helper that locks the LIVE pattern
-- dependencies of one entry revision, FOR SHARE, in ascending id order.
--
-- Why: entry publication (CMS-03B-07/09/20) rechecks every pinned nested pattern version (DEC-199) but,
-- before this helper, took no lock on those rows, so a concurrent activation of a nested pattern's
-- successor (CMS-03C-09 locks the lineage's current active row FOR UPDATE) neither waited for nor was
-- waited on by the publication that had just judged that version current (canonical race
-- supabase/tests/phase_02_slice_12_dec199_publication.race.mjs: the publish returned with the
-- activation still uncommitted).  Locking the closure FOR SHARE at position 3 makes the two serialize in
-- either commit order; the later statements of the publication then re-read the committed state.
--
-- Scope of the lock set = exactly the rows the DEC-199 provider reopens: the newest row at each
-- composition path of the revision (selected BEFORE the state filter), draft/active/pending_diff only,
-- whose pattern pin is LIVE (detached_tree IS NULL): the pinned root version row and every nested
-- version row reached through cms_pattern_nested_closure.  A row carrying a nonnull canonical
-- detached_tree owns its content, so its provenance pin is never reopened and is never locked
-- (DEC-193/DEC-199 "Detached boundary").  Mixed live use of a pin still locks it.
-- A missing revision locks nothing (the caller raises its own typed refusal).  Private; SECURITY
-- DEFINER owned by the CMS definer, empty search_path, executable by no API role.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_lock_revision_pattern_dependencies(p_revision_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_owner_id uuid;
begin
  select revision.owner_id into v_owner_id
    from platform_private.cms_entry_revisions revision
   where revision.id = p_revision_id;
  if not found then
    return;
  end if;
  perform 1
    from platform_private.cms_pattern_versions locked
   where locked.id in (
     select root.id
       from (select distinct on (instance.path collate "C") instance.*
               from platform_private.cms_composition_instances instance
              where instance.revision_id = p_revision_id
              order by instance.path collate "C", instance.version desc, instance.id desc) head
       join platform_private.cms_pattern_versions root
         on root.owner_id = v_owner_id
        and root.pattern_id = head.pattern_id
        and root.version = head.pattern_version
      where head.state in ('draft', 'active', 'pending_diff')
        and head.pattern_id is not null
        and head.detached_tree is null
     union
     select closure.nested_row_id
       from (select distinct on (instance.path collate "C") instance.*
               from platform_private.cms_composition_instances instance
              where instance.revision_id = p_revision_id
              order by instance.path collate "C", instance.version desc, instance.id desc) head
       join platform_private.cms_pattern_versions root
         on root.owner_id = v_owner_id
        and root.pattern_id = head.pattern_id
        and root.version = head.pattern_version
      cross join lateral platform_private.cms_pattern_nested_closure(v_owner_id, root.block_tree) closure
      where head.state in ('draft', 'active', 'pending_diff')
        and head.pattern_id is not null
        and head.detached_tree is null
        and closure.nested_row_id is not null)
   order by locked.id
     for share;
end;
$body$;

comment on function platform_private.cms_lock_revision_pattern_dependencies(uuid) is
  'DEC-199 / BE03b lock-order position 3 for publication commands: FOR SHARE, ascending id, on the pinned root and every nested pattern version row reached by the LIVE (detached_tree IS NULL) newest composition heads of one revision; canonical detached trees lock nothing; a missing revision locks nothing. Private; no API execution grant.';

-- Table privileges of the definer for what the helper reads (idempotent; identical to the placement producer's).
grant select on table platform_private.cms_entry_revisions, platform_private.cms_composition_instances,
  platform_private.cms_pattern_versions to wejammin_cms_definer;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_lock_revision_pattern_dependencies(uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_lock_revision_pattern_dependencies(uuid)
  from public, anon, authenticated, service_role;

do $guard$
declare item pg_catalog.pg_proc%rowtype;
begin
  select proc.* into item from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure('platform_private.cms_lock_revision_pattern_dependencies(uuid)');
  if not found or item.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not item.prosecdef or item.prokind <> 'f' or item.provolatile <> 'v' or item.proretset
     or item.prorettype <> 'void'::pg_catalog.regtype
     or item.proconfig is distinct from array['search_path=""']::text[]
     or item.prolang <> (select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql') then
    raise exception 'cms_lock_revision_pattern_dependencies attributes changed' using errcode = '55000';
  end if;
  if pg_catalog.has_function_privilege('anon', item.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', item.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', item.oid, 'EXECUTE') then
    raise exception 'cms_lock_revision_pattern_dependencies is not private' using errcode = '55000';
  end if;
end;
$guard$;

commit;
