-- DEC-191 (orchestrator resolution 2026-10-15; BE03c schema blocks GovernedActivationResource / GovernedReviewDetailResource and the
-- changelog row "FE03-BE03c read gap"; FE03 :882, :1118): the two read helpers behind the two additive nullable members.  No new state,
-- vocabulary, authority, lock or write path: both are plain reads of rows the calling producer already owns or may read.
--
--   cms_governed_definition_version(kind, id)   the immutable definition `version` of one governed subject row (any kind), NULL for a NULL id.
--       CMS-03C-09 passes the lineage's previously active version id it already holds (locked FOR UPDATE at position 3, re-verified equal
--       under the lineage advisory lock): the answer's `supersededVersion`.  A plain SELECT takes no lock and no new lock position.
--   cms_governed_review_schedule(review)        the review's most recent cms_governed_activation_schedules row as { state, reasonCode }, NULL
--       when it has none.  `reasonCode` is the stored column, which the table CHECK keeps non-null exactly for blocked and cancelled (BE03c 1473;
--       the closed vocabulary is the same table's CHECK).  Most recent = a live schedule (pending, executing, failed_retryable; the unique index allows one per subject, and
--       it can only have been created after every earlier row left the live states) first, then created_at, then id: rows written by one
--       transaction share created_at, so the live-first term keeps the order deterministic there; across transactions created_at decides.
--       STABLE, so CMS-03C-10 keeps its one statement and one snapshot.
-- Private; SECURITY DEFINER, owned by the CMS definer, no API role may execute.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_definition_version(p_kind text, p_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  v_version bigint;
begin
  if p_id is null then
    return null;
  end if;
  if p_kind = 'template_version' then
    select item.version::bigint into v_version from platform_private.cms_template_versions item where item.id = p_id;
  elsif p_kind = 'pattern_version' then
    select item.version::bigint into v_version from platform_private.cms_pattern_versions item where item.id = p_id;
  elsif p_kind = 'taxonomy_version' then
    select item.version::bigint into v_version from platform_private.cms_taxonomy_versions item where item.id = p_id;
  else
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  return v_version;
end;
$body$;

create or replace function platform_private.cms_governed_review_schedule(p_review_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object('state', schedule_item.state, 'reasonCode', schedule_item.reason_code)
    from platform_private.cms_governed_activation_schedules schedule_item
   where schedule_item.review_id = p_review_id
   order by (schedule_item.state in ('pending', 'executing', 'failed_retryable')) desc,
            schedule_item.created_at desc, schedule_item.id desc
   limit 1
$body$;

comment on function platform_private.cms_governed_definition_version(text, uuid) is
  'DEC-191: the immutable definition version of one governed subject row (template, pattern or taxonomy version), NULL for a NULL id. A plain read; takes no lock. Private.';
comment on function platform_private.cms_governed_review_schedule(uuid) is
  'DEC-191: the most recent governed activation schedule of a review as { state, reasonCode } (reasonCode non-null exactly for blocked and cancelled, the table CHECK), NULL when the review has none. STABLE; a plain read. Private.';

-- SEC-2: what the helpers name, held by the definer role only (idempotent restatements of grants the producers already rely on).
grant select on table
  platform_private.cms_template_versions,
  platform_private.cms_pattern_versions,
  platform_private.cms_taxonomy_versions,
  platform_private.cms_governed_activation_schedules
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_definition_version(text, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_review_schedule(uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_governed_definition_version(text, uuid),
  platform_private.cms_governed_review_schedule(uuid)
  from public, anon, authenticated, service_role;

commit;
