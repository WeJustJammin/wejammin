-- Slice 12 lane related, derived-candidate ranking shared by CMS-03C-05 (eligibleCount) and CMS-03C-21 (public
-- projection) (BE03c Derived rules (OD-5) 1383; tracker P2-S12-AC-229, AC-230, AC-231, AC-232):
--
--   cms_related_derived_candidates(source, locale, audience, rule key, bound, excluded, pinned)
--       returns table(entry_id uuid, rank integer)
--
-- Candidates are ALWAYS eligible public targets: entries of the source's owner party whose lifecycle is `active`
-- (before Slice 16 a hold is the lifecycle `held` or `deletion_pending`, migration 20261005017510), other than
-- the source, not excluded and not already pinned, whose publication lineage head for (locale, audience) is a
-- `publish` row.  `same-type-recent` keeps candidates of the source's content type.  Ranking:
--   shared-terms      the number of ACTIVE terms (assignment state active, term lifecycle active) the candidate's
--                     head revision shares with the source's term assignments, descending, then the head
--                     created_at descending, then the entry id ascending.  The source side is the revision its
--                     own lineage head publishes for (locale, audience) in a public projection, else its current
--                     draft revision (an editorial preview of a source not published there);
--   same-type-recent  the head created_at descending, then the entry id ascending.
-- At most p_max candidates (1..128) are returned.  Read-only, STABLE, deterministic.  Private, SECURITY DEFINER
-- owned by the CMS definer (SEC-2), EXECUTE revoked from every API role; callers run under the CMS RPC context.
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_related_derived_candidates(
  p_source_entry_id uuid,
  p_locale text,
  p_audience text,
  p_rule_key text,
  p_max integer,
  p_excluded uuid[],
  p_pinned uuid[]
)
returns table(entry_id uuid, rank integer)
language sql
stable
security definer
set search_path = ''
as $body$
  with source as (
    select entry.id, entry.owner_party_id, entry.content_type_id,
           coalesce(
             platform_private.cms_related_publish_head_revision(entry.id, p_locale, p_audience),
             entry.current_draft_revision_id) as revision_id
      from platform_private.cms_content_entries entry
     where entry.id = p_source_entry_id
  ), source_terms as (
    select distinct assignment.term_id
      from source
      join platform_private.cms_term_assignments assignment on assignment.revision_id = source.revision_id
      join platform_private.cms_terms term on term.id = assignment.term_id
     where assignment.state = 'active' and term.lifecycle = 'active'
  ), heads as (
    -- Set-based form of cms_related_publish_head_revision (the same max-version head per entry) for all entries.
    select distinct on (version_row.entry_id)
           version_row.entry_id, version_row.revision_id, version_row.created_at, version_row.action
      from platform_private.cms_publication_versions version_row
     where version_row.locale = p_locale and version_row.audience = p_audience
     order by version_row.entry_id, version_row.version desc
  ), eligible as (
    select heads.entry_id, heads.revision_id, heads.created_at
      from heads
      join platform_private.cms_content_entries target on target.id = heads.entry_id
      join source on true
     where heads.action = 'publish'
       and target.lifecycle = 'active'
       and target.owner_party_id = source.owner_party_id
       and target.id <> source.id
       and not (target.id = any(coalesce(p_excluded, array[]::uuid[])))
       and not (target.id = any(coalesce(p_pinned, array[]::uuid[])))
       and (p_rule_key <> 'same-type-recent' or target.content_type_id = source.content_type_id)
  ), scored as (
    select eligible.entry_id, eligible.created_at,
           (select pg_catalog.count(distinct assignment.term_id)
              from platform_private.cms_term_assignments assignment
              join platform_private.cms_terms term on term.id = assignment.term_id
             where assignment.revision_id = eligible.revision_id
               and assignment.state = 'active' and term.lifecycle = 'active'
               and assignment.term_id in (select source_terms.term_id from source_terms)) as shared
      from eligible
  ), ranked as (
    select scored.entry_id,
           pg_catalog.row_number() over (
             order by (case when p_rule_key = 'shared-terms' then scored.shared else 0 end) desc,
                      scored.created_at desc, scored.entry_id asc)::integer as rank
      from scored
     where p_rule_key in ('shared-terms', 'same-type-recent')
  )
  select ranked.entry_id, ranked.rank
    from ranked
   where ranked.rank <= p_max
   order by ranked.rank
$body$;

comment on function platform_private.cms_related_derived_candidates(uuid, text, text, text, integer, uuid[], uuid[]) is
  'BE03c OD-5: the ranked eligible public derived candidates of a related-content source for (locale, audience) under the registry rule (shared-terms or same-type-recent), at most p_max, excluded and pinned entries removed. Read-only; STABLE; private; callers run under the CMS RPC context.';

grant select on table
  platform_private.cms_content_entries,
  platform_private.cms_publication_versions,
  platform_private.cms_term_assignments,
  platform_private.cms_terms
  to wejammin_cms_definer;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_related_derived_candidates(uuid, text, text, text, integer, uuid[], uuid[])
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_related_derived_candidates(uuid, text, text, text, integer, uuid[], uuid[])
  from public, anon, authenticated, service_role;

commit;
