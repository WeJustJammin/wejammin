-- Slice 12 lane placement-perf (defect D1, BE03c 1813: CMS-03C-02 placement of 512 rows inside the RPC < 300 ms bound).
-- The composition admission guard (cms_composition_instance_guards, one call per inserted row) judges the derived revision
-- state through cms_revision_effective_state, an SQL function over the plpgsql set-returning cms_revision_effective_states.
-- Called from inside another statement an SQL-language body is planned again on every call, so the 512 rows of one placement
-- cost 158-195 ms in the guard alone (0.31-0.38 ms per row).  The single-revision form is now a PL/pgSQL function whose one
-- query carries the same derivation (plans are kept for the session: 0.04 ms per call).  Same signature, return type, STABLE,
-- SECURITY DEFINER, owner, search_path, ACL and comment; the set form cms_revision_effective_states and the guard are
-- untouched, and phase_02_slice_12_placement_perf_effective_state asserts both forms agree for every evidence combination.
-- The installed source must equal the promoted source byte for byte.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_revision_effective_state(uuid)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source constant text := $old$
  select effective.state
    from platform_private.cms_revision_effective_states(array[p_revision_id]) effective
$old$;
  new_source constant text := $new$
declare
  v_state text;
begin
  -- The single-revision form of cms_revision_effective_states, as one query: same first-match-wins derivation; NULL for an
  -- absent or null id (no row).  PL/pgSQL keeps its plan for the session: an SQL-language body is re-planned on every call
  -- made from inside another statement, which cost the composition admission guard 0.3 ms per inserted row.
  select case
           when exists (
             select 1
               from platform_private.cms_publication_versions publication
              where publication.revision_id = revision.id
                and publication.action = 'publish'
           ) then 'published'
           when exists (
             select 1
               from platform_private.cms_publication_schedules schedule
              where schedule.revision_id = revision.id
                and schedule.action = 'publish'
                and schedule.state in ('pending', 'executing', 'failed_retryable')
           ) then 'scheduled'
           else coalesce((
             select case latest.state
                      when 'approved' then 'approved'
                      when 'rejected' then 'rejected'
                      when 'open' then 'submitted'
                      else 'draft'
                    end
               from platform_private.cms_editorial_reviews latest
              where latest.revision_id = revision.id
              order by latest.submitted_at desc, latest.id desc
              limit 1
           ), 'draft')
         end
    into v_state
    from platform_private.cms_entry_revisions revision
   where revision.id = p_revision_id;
  return v_state;
end;
$new$;
  comment_text text;
begin
  select proc.* into original from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'placement-perf: missing existing function %', identity using errcode = '55000';
  end if;
  if original.prosrc is distinct from old_source then
    raise exception 'placement-perf: unexpected installed source of %', identity using errcode = '55000';
  end if;
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 's'
     or original.proretset or original.prorettype <> 'text'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'sql') then
    raise exception 'placement-perf: unexpected baseline attributes of %', identity using errcode = '55000';
  end if;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  execute 'create or replace function platform_private.cms_revision_effective_state(p_revision_id uuid) '
    || 'returns text language plpgsql stable security definer set search_path = '''' as $body$' || new_source || '$body$';
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' - 'prolang' is distinct from pg_catalog.to_jsonb(original) - 'prosrc' - 'prolang'
     or actual.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql')
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'placement-perf: replacement changed more than the body of %', identity using errcode = '55000';
  end if;
end;
$migration$;

commit;
