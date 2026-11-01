-- Slice 12 CMS-03C-09 `retire` (DEC-190; BE03c 208 "Lifecycle updates change only state, lifecycle_version, activated_at, retired_at and
-- updated_at", 1326 "retire", 1552-1554, 1561 outbox identity): the two private helpers of the retirement, the counterparts of
-- cms_governed_activate_subject and cms_governed_apply_activation (20261014070000 / 070200).
--
--   cms_governed_retire_subject(kind, subject, at)
--       one ACTIVE subject version row -> retired through the guarded lifecycle seam (app.cms_governed_lifecycle, restored on exit):
--       lifecycle_version + 1, retired_at = at, activated_at and every definition column untouched.  A row that is not active is 409
--       subject_not_retirable.  Answers { lifecycleVersion, activatedAt (ms ISO) }.
--   cms_governed_apply_retirement(review, actor, party, correlation, at)
--       the retirement of the review's subject: the subject move above, and the audit record and EXACTLY ONE subject-kind event commit
--       together (aggregate = the retired subject row at its committed lifecycle counter, DEC-188).  The review `version` advances by
--       exactly one under CAS, like an activation (root ruling on DEC-190: CMS-03C-10's strong ETag is "{review.version}" and its body exposes
--       subjectState / permittedNextActions; BE03c 215 counts an activation as a version change); no other review column changes
--       (state, activated_at, decided_at stay).  It takes no further row lock: the caller holds the subject (position 3) and the review
--       (position 5) and has taken the lineage advisory lock, the last position.
--       Answers { lifecycleVersion, eventType, activatedAt, reviewVersion }.
-- Private; owned by the CMS definer role.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_retire_subject(p_kind text, p_subject_id uuid, p_at timestamptz)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_prior text := coalesce(pg_catalog.current_setting('app.cms_governed_lifecycle', true), '');
  v_lifecycle bigint;
  v_activated timestamptz;
begin
  if p_at is null then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  perform pg_catalog.set_config('app.cms_governed_lifecycle', 'true', true);
  begin
    if p_kind = 'template_version' then
      update platform_private.cms_template_versions
         set state = 'retired', lifecycle_version = lifecycle_version + 1, retired_at = p_at,
             updated_at = pg_catalog.clock_timestamp()
       where id = p_subject_id and state = 'active' returning lifecycle_version, activated_at into v_lifecycle, v_activated;
    elsif p_kind = 'pattern_version' then
      update platform_private.cms_pattern_versions
         set state = 'retired', lifecycle_version = lifecycle_version + 1, retired_at = p_at,
             updated_at = pg_catalog.clock_timestamp()
       where id = p_subject_id and state = 'active' returning lifecycle_version, activated_at into v_lifecycle, v_activated;
    elsif p_kind = 'taxonomy_version' then
      update platform_private.cms_taxonomy_versions
         set state = 'retired', lifecycle_version = lifecycle_version + 1, retired_at = p_at,
             updated_at = pg_catalog.clock_timestamp()
       where id = p_subject_id and state = 'active' returning lifecycle_version, activated_at into v_lifecycle, v_activated;
    else
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    if v_lifecycle is null then
      raise exception 'subject_not_retirable' using errcode = 'P0001';
    end if;
  exception when others then
    perform pg_catalog.set_config('app.cms_governed_lifecycle', v_prior, true);
    raise;
  end;
  perform pg_catalog.set_config('app.cms_governed_lifecycle', v_prior, true);
  return pg_catalog.jsonb_build_object(
    'lifecycleVersion', v_lifecycle, 'activatedAt', platform_private.auth_iso_time(v_activated));
end;
$body$;

create or replace function platform_private.cms_governed_apply_retirement(
  p_review_id uuid, p_actor_id uuid, p_acting_party_id uuid, p_correlation_id uuid, p_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_review platform_private.cms_governed_reviews%rowtype;
  v_subject jsonb;
  v_moved jsonb;
  v_event_type text;
  v_aggregate_type text;
  v_lifecycle bigint;
  v_review_version bigint;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  select review_item.* into v_review from platform_private.cms_governed_reviews review_item
   where review_item.id = p_review_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  v_subject := platform_private.cms_governed_subject_resolve(v_review.subject_kind, v_review.subject_id);
  if v_subject is null or v_subject->>'state' is distinct from 'active' then
    raise exception 'subject_not_retirable' using errcode = 'P0001';
  end if;
  v_event_type := case v_review.subject_kind
    when 'template_version' then 'cms.template.activated.v1'
    when 'pattern_version' then 'cms.pattern.activated.v1'
    else 'cms.taxonomy.changed.v1' end;
  v_aggregate_type := case v_review.subject_kind
    when 'template_version' then 'cms_template_version'
    when 'pattern_version' then 'cms_pattern_version'
    else 'cms_taxonomy_version' end;
  v_moved := platform_private.cms_governed_retire_subject(v_review.subject_kind, v_review.subject_id, p_at);
  v_lifecycle := (v_moved->>'lifecycleVersion')::bigint;
  update platform_private.cms_governed_reviews review_item
     set version = review_item.version + 1, updated_at = p_at
   where review_item.id = v_review.id and review_item.version = v_review.version
  returning review_item.version into v_review_version;
  if v_review_version is null then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;
  perform platform_private.cms_emit_event(
    'cms.governed.retire', p_actor_id, p_acting_party_id, v_aggregate_type, v_review.subject_id,
    'CMS_GOVERNED_RETIRED', v_event_type, v_aggregate_type, v_review.subject_id, v_lifecycle,
    pg_catalog.jsonb_build_object(
      case v_review.subject_kind when 'template_version' then 'templateId'
                                 when 'pattern_version' then 'patternId' else 'taxonomyId' end, v_review.lineage_id,
      case v_review.subject_kind when 'template_version' then 'templateVersionId'
                                 when 'pattern_version' then 'patternVersionId' else 'taxonomyVersionId' end, v_review.subject_id),
    p_correlation_id);
  return pg_catalog.jsonb_build_object(
    'lifecycleVersion', v_lifecycle, 'eventType', v_event_type, 'activatedAt', v_moved->>'activatedAt',
    'reviewVersion', v_review_version::text);
end;
$body$;

comment on function platform_private.cms_governed_retire_subject(text, uuid, timestamptz) is
  'BE03c Subject state machine: moves one ACTIVE subject version row to retired (lifecycle_version + 1, retired_at stamped, activated_at and the definition untouched); a row that is not active is subject_not_retirable. The caller holds the subject row lock. Answers { lifecycleVersion, activatedAt }. Private.';
comment on function platform_private.cms_governed_apply_retirement(uuid, uuid, uuid, uuid, timestamptz) is
  'BE03c Governed retirement (DEC-190): retires the review''s ACTIVE subject and commits one audit record and exactly one subject-kind event (aggregate = the subject row at its lifecycle counter). The review version advances by one under CAS (like an activation); no other review column changes. Takes no further row lock. Private.';

grant select, update on table
  platform_private.cms_template_versions,
  platform_private.cms_pattern_versions,
  platform_private.cms_taxonomy_versions
  to wejammin_cms_definer;
grant select, update on table platform_private.cms_governed_reviews to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_retire_subject(text, uuid, timestamptz) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_apply_retirement(uuid, uuid, uuid, uuid, timestamptz) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_governed_retire_subject(text, uuid, timestamptz),
  platform_private.cms_governed_apply_retirement(uuid, uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;

commit;
