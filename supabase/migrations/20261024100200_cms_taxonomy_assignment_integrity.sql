-- Slice 12 lane taxonomy-integrity: the provider body of cms.taxonomy.assignment_integrity version 1 (BE03c "Preflight providers
-- registered by Slice 12"; BE03b Publication preflight registry row 6; P2-S12-AC-239).
--
-- cms_taxonomy_assignment_integrity(revision) evaluates, for the revision's CURRENT assignment rows (the highest version of each
-- (field definition, term) pair, read only when its state is `active`) and its recorded taxonomy_version_ids (the VersionSet's
-- taxonomy ids):
--   term_merged_unconverged     an active assignment names a `merged` term whose assignment has not converged (a `deprecated`
--                               term is tolerated for an existing assignment);
--   allowlist_changed           the term's vocabulary has an active version that no longer lists the entry content type key in
--                               allowlisted_type_keys or the field key in allowlisted_field_keys;
--   taxonomy_version_not_active a recorded taxonomy version id names no version or a version that is not `active`.
-- blocking_count is the number of offending assignments (an assignment that is merged AND outside the allowlist is ONE offender) plus
-- the number of offending recorded version ids, capped 1000 (BE03c DEC-229, as for the pattern provider); the reason is the first
-- present in the order above (DEC-229).  A fault, an absent or null revision is `unavailable` /
-- `provider_unavailable`, never a pass.  A revision with no assignment and no recorded version passes.  Returns one row.
-- Private, STABLE, SECURITY DEFINER owned by the CMS definer (SEC-2); reads forced-RLS tables, so it sets the RPC flag for the
-- read and restores the caller's value.  Forward-only.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_taxonomy_assignment_integrity(p_revision_id uuid)
returns table(outcome text, reason_code text, blocking_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  prior_flag text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  revision_row platform_private.cms_entry_revisions%rowtype;
  type_key text;
  merged_units integer := 0;
  allowlist_units integer := 0;
  offender_units integer := 0;
  inactive_units integer := 0;
  total_units integer;
  result_outcome text := 'unavailable';
  result_reason text := 'provider_unavailable';
  result_count integer := 0;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  begin
    if p_revision_id is not null then
      select revision.* into revision_row
        from platform_private.cms_entry_revisions revision
       where revision.id = p_revision_id;
      if found then
        select content_type.type_key into type_key
          from platform_private.cms_content_entries entry_row
          join platform_private.cms_content_types content_type on content_type.id = entry_row.content_type_id
         where entry_row.id = revision_row.entry_id;
        if type_key is null then
          raise exception 'unavailable';
        end if;
        select pg_catalog.count(*) filter (where current_row.is_merged)::integer,
               pg_catalog.count(*) filter (where current_row.allowlist_failed)::integer,
               pg_catalog.count(*) filter (where current_row.is_merged or current_row.allowlist_failed)::integer
          into merged_units, allowlist_units, offender_units
          from (
            select latest.state, latest.lifecycle = 'merged' as is_merged,
                   exists (
                     select 1
                       from platform_private.cms_taxonomy_versions active_version
                      where active_version.taxonomy_id = latest.taxonomy_id
                        and active_version.state = 'active'
                        and not (active_version.allowlisted_type_keys ? type_key
                                 and active_version.allowlisted_field_keys ? latest.field_key)) as allowlist_failed
              from (
                select distinct on (assignment.field_definition_id, assignment.term_id)
                       assignment.state, term.lifecycle, term.taxonomy_id, field.field_key
                  from platform_private.cms_term_assignments assignment
                  join platform_private.cms_terms term on term.id = assignment.term_id
                  join platform_private.cms_field_definition_versions field on field.id = assignment.field_definition_id
                 where assignment.revision_id = revision_row.id
                 order by assignment.field_definition_id, assignment.term_id, assignment.version desc
              ) latest
             where latest.state = 'active'
          ) current_row;
        select pg_catalog.count(*)::integer into inactive_units
          from pg_catalog.jsonb_array_elements_text(revision_row.taxonomy_version_ids) recorded(id)
         where not exists (
           select 1
             from platform_private.cms_taxonomy_versions version_row
            where version_row.id::text = recorded.id
              and version_row.state = 'active');
        total_units := offender_units + inactive_units;
        if total_units = 0 then
          result_outcome := 'passed'; result_reason := null; result_count := 0;
        else
          result_outcome := 'failed';
          result_reason := case
            when merged_units > 0 then 'term_merged_unconverged'
            when allowlist_units > 0 then 'allowlist_changed'
            else 'taxonomy_version_not_active' end;
          result_count := least(total_units, 1000);
        end if;
      end if;
    end if;
  exception when others then
    result_outcome := 'unavailable'; result_reason := 'provider_unavailable'; result_count := 0;
  end;
  perform pg_catalog.set_config('app.cms_rpc', prior_flag, true);
  return query select result_outcome, result_reason, result_count;
end;
$body$;

comment on function platform_private.cms_taxonomy_assignment_integrity(uuid) is
  'cms.taxonomy.assignment_integrity v1 (BE03c Preflight providers registered by Slice 12): current active TermAssignments must name non-merged terms (term_merged_unconverged), the term vocabulary''s active version must still list the entry type key and field key (allowlist_changed), every recorded taxonomy version id must be active (taxonomy_version_not_active); first present reason in that order, one unit per offender, capped 1000; a fault or absent revision is unavailable/provider_unavailable. Private; STABLE; sets and restores app.cms_rpc.';

grant select on table
  platform_private.cms_entry_revisions,
  platform_private.cms_content_entries,
  platform_private.cms_content_types,
  platform_private.cms_term_assignments,
  platform_private.cms_terms,
  platform_private.cms_field_definition_versions,
  platform_private.cms_taxonomy_versions
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_taxonomy_assignment_integrity(uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_taxonomy_assignment_integrity(uuid)
  from public, anon, authenticated, service_role;

commit;
