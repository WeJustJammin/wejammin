-- Slice 12 lane related, CMS-03C-21 (BE03c Internal service operations 190, Public projection 1385; tracker
-- P2-S12-AC-153 .. AC-158):
--
--   platform_private.cms_related_content_public_targets(p_source_entry_id uuid, p_locale text, p_audience text)
--       returns jsonb   an ordered array of at most 128 RelatedPublicTarget
--       { entryId, source: pin|derived, reasonCode: null|<registry reason>, position: 0..127 }
--
-- Eligible pins first in pin position order (public eligibility: entry `active`, same owner party as the source,
-- not the source, not excluded, and its lineage head for (locale, audience) is a `publish` row), then the derived
-- candidates of the live derived rule in rank order (cms_related_derived_candidates: pinned and excluded entries
-- never repeat), the whole list cut at 128.  A vacated slot is refilled only from eligible derived candidates:
-- an ineligible pin and an excluded candidate are simply absent, nothing pads the list.  `position` is the dense
-- index in the answer.  The live rule set is the latest version of each (target, mode); a `revoked` latest row
-- is not live.  Exclusions always win.  Nothing is stored: every call recomputes from the current rows, so a
-- target that is unpublished, archived, held or moved to another owner drops out while its editorial rows stay
-- private.  Read-only (STABLE: no insert, update, delete, audit or outbox row).  Private, SECURITY DEFINER owned
-- by the CMS definer (SEC-2), EXECUTE revoked from PUBLIC, anon, authenticated and service_role: the registered
-- callers are the Shard 04 delivery projection and the Slice 11 related-content recheck, which run as the
-- definer under the CMS RPC context.  There is no platform_api wrapper and so no browser route.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_related_content_public_targets(
  p_source_entry_id uuid,
  p_locale text,
  p_audience text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  source_row platform_private.cms_content_entries%rowtype;
  derived_rule platform_private.cms_related_content_rules%rowtype;
  excluded_ids uuid[];
  pinned_ids uuid[];
  result jsonb;
begin
  if p_source_entry_id is null or p_locale is null or p_audience is null
     or p_locale !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
     or p_audience !~ '^[a-z0-9_-]{1,48}$' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select * into source_row from platform_private.cms_content_entries entry where entry.id = p_source_entry_id;
  if not found then
    return '[]'::jsonb;
  end if;

  select coalesce(pg_catalog.array_agg(live.target_entry_id), array[]::uuid[]) into excluded_ids
    from (select distinct on (rule.target_entry_id) rule.target_entry_id, rule.state
            from platform_private.cms_related_content_rules rule
           where rule.source_entry_id = source_row.id and rule.mode = 'exclude'
           order by rule.target_entry_id, rule.version desc) live
   where live.state = 'active';
  select coalesce(pg_catalog.array_agg(live.target_entry_id), array[]::uuid[]) into pinned_ids
    from (select distinct on (rule.target_entry_id) rule.target_entry_id, rule.state
            from platform_private.cms_related_content_rules rule
           where rule.source_entry_id = source_row.id and rule.mode = 'pin'
           order by rule.target_entry_id, rule.version desc) live
   where live.state = 'active';
  select * into derived_rule from platform_private.cms_related_content_rules rule
   where rule.source_entry_id = source_row.id and rule.mode = 'derived'
   order by rule.version desc
   limit 1;
  if found and derived_rule.state <> 'active' then
    derived_rule := null;
  end if;

  select coalesce(pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object(
             'entryId', listed.entry_id, 'source', listed.source, 'reasonCode', listed.reason_code,
             'position', listed.position - 1) order by listed.position), '[]'::jsonb)
    into result
    from (
      select merged.entry_id, merged.source, merged.reason_code,
             pg_catalog.row_number() over (order by merged.sort_group, merged.sort_key)::integer as position
        from (
          select live.target_entry_id as entry_id, 'pin'::text as source, null::text as reason_code,
                 0 as sort_group, live.position::bigint as sort_key
            from (select distinct on (rule.target_entry_id) rule.target_entry_id, rule.state, rule.position
                    from platform_private.cms_related_content_rules rule
                   where rule.source_entry_id = source_row.id and rule.mode = 'pin'
                   order by rule.target_entry_id, rule.version desc) live
            join platform_private.cms_content_entries target on target.id = live.target_entry_id
           where live.state = 'active'
             and platform_private.cms_related_publish_head_revision(target.id, p_locale, p_audience) is not null
             and target.lifecycle = 'active'
             and target.owner_party_id = source_row.owner_party_id
             and target.id <> source_row.id
             and not (target.id = any(excluded_ids))
          union all
          select candidate.entry_id, 'derived'::text, pg_catalog.lower(derived_rule.reason_code), 1, candidate.rank::bigint
            from platform_private.cms_related_derived_candidates(
                   source_row.id, p_locale, p_audience, derived_rule.rule_key, derived_rule.max_candidates,
                   excluded_ids, pinned_ids) candidate
           where derived_rule.id is not null
        ) merged
    ) listed
   where listed.position <= 128;
  return result;
end;
$body$;

comment on function platform_private.cms_related_content_public_targets(uuid, text, text) is
  'CMS-03C-21 (D11, OD-5): the ordered, at most 128 RelatedPublicTarget list of a related-content source for (locale, audience): publicly eligible pins in position order, then ranked derived candidates, exclusions always removed. Read-only, recomputed on every call, never stored; no browser route. Private; STABLE; callers run under the CMS RPC context.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_related_content_public_targets(uuid, text, text) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_related_content_public_targets(uuid, text, text)
  from public, anon, authenticated, service_role;

commit;
