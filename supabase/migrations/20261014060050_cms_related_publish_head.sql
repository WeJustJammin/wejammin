-- Slice 12 lane related, the one public-eligibility head predicate of the related-content lane (BE03c Public
-- projection 1385: "the target's lineage head is an `active` `publish` row for (locale, audience)"; tracker
-- P2-S12-AC-153, AC-231, AC-232):
--
--   cms_related_publish_head_revision(entry, locale, audience) returns uuid
--
-- The lineage head of (entry, locale, audience) is the row with the greatest `version` (UNIQUE per lineage).  The
-- answer is that head's revision id when the head is a `publish` row (CHECK (action = 'publish') = (state =
-- 'active')), else NULL: no row, or a head that is a tombstone/revocation.  The derived-candidate source revision
-- (cms_related_derived_candidates) and the pin eligibility of the public projection
-- (cms_related_content_public_targets) both use it, so the predicate has a single definition beside the generic
-- cms_lineage_head_observation (20261005017590).  Read-only, STABLE.  Private, SECURITY DEFINER owned by the CMS
-- definer (SEC-2), EXECUTE revoked from every API role; callers run as the definer under the CMS RPC context.
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_related_publish_head_revision(
  p_entry_id uuid,
  p_locale text,
  p_audience text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $body$
  select case when head.action = 'publish' then head.revision_id end
    from platform_private.cms_publication_versions head
   where head.entry_id = p_entry_id and head.locale = p_locale and head.audience = p_audience
   order by head.version desc
   limit 1
$body$;

comment on function platform_private.cms_related_publish_head_revision(uuid, text, text) is
  'BE03c 1385: the revision id of the lineage head of (entry, locale, audience) when that head is a publish row, else NULL (no row, or a head that is not a publish row). The single related-content public-eligibility head predicate. Private; STABLE.';

grant select on table platform_private.cms_publication_versions to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_related_publish_head_revision(uuid, text, text) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_related_publish_head_revision(uuid, text, text)
  from public, anon, authenticated, service_role;

commit;
