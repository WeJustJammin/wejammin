-- Slice 12 lane governed-b (BE03c "Governed activation, retirement and scheduled activation (DEC-113, OD-6)", "Subject state machine",
-- "Slice 12 lock order", "Invalidation"; tracker P2-S12-AC-082 .. AC-087, AC-145): the private helpers CMS-03C-09 and CMS-03C-19 share.
-- The caller already holds the BE03c locks (the subject row, position 3, before the review row, position 5); none takes an earlier
-- position after a later one.  The governed-a helper cms_governed_move_subject cannot stamp activated_at or reach superseded, so the
-- switch to `active` and the supersession are separate guarded moves here (the lifecycle seam app.cms_governed_lifecycle, restored on exit).
--
--   cms_governed_lock_lineage_active(kind, lineage, except)  the lineage's current `active` version row FOR UPDATE (position 3, after the subject)
--   cms_governed_activate_subject(kind, subject, at)         approved | scheduled | blocked -> active; lifecycle_version + 1, activated_at = at
--   cms_governed_supersede_lineage(kind, lineage, except)    the previous active version -> superseded in the same transaction (lifecycle + 1)
--   cms_governed_invalidate_approved_review(review, reason, actor, party, correlation)
--       an OPEN or APPROVED review -> invalidated under CAS (version + 1), decidedAt cleared, the subject back to draft, every pending or
--       failed_retryable schedule of the review cancelled (cancelled, approval_invalidated) in the same transaction, one audit record each
-- Private; owned by the CMS definer role.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_lock_lineage_active(p_kind text, p_lineage_id uuid, p_except_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_id uuid;
begin
  if p_kind = 'template_version' then
    select item.id into v_id from platform_private.cms_template_versions item
     where item.template_id = p_lineage_id and item.state = 'active' and item.id <> p_except_id for update;
  elsif p_kind = 'pattern_version' then
    select item.id into v_id from platform_private.cms_pattern_versions item
     where item.pattern_id = p_lineage_id and item.state = 'active' and item.id <> p_except_id for update;
  elsif p_kind = 'taxonomy_version' then
    select item.id into v_id from platform_private.cms_taxonomy_versions item
     where item.taxonomy_id = p_lineage_id and item.state = 'active' and item.id <> p_except_id for update;
  else
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  return v_id;
end;
$body$;

comment on function platform_private.cms_governed_lock_lineage_active(text, uuid, uuid) is
  'BE03c Slice 12 lock order position 3: the current active version row of a lineage other than the subject, FOR UPDATE (NULL when none). Private.';

create or replace function platform_private.cms_governed_activate_subject(p_kind text, p_subject_id uuid, p_at timestamptz)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_prior text := coalesce(pg_catalog.current_setting('app.cms_governed_lifecycle', true), '');
  v_lifecycle bigint;
begin
  if p_at is null then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  perform pg_catalog.set_config('app.cms_governed_lifecycle', 'true', true);
  begin
    if p_kind = 'template_version' then
      update platform_private.cms_template_versions
         set state = 'active', lifecycle_version = lifecycle_version + 1, activated_at = p_at,
             updated_at = pg_catalog.clock_timestamp()
       where id = p_subject_id returning lifecycle_version into v_lifecycle;
    elsif p_kind = 'pattern_version' then
      update platform_private.cms_pattern_versions
         set state = 'active', lifecycle_version = lifecycle_version + 1, activated_at = p_at,
             updated_at = pg_catalog.clock_timestamp()
       where id = p_subject_id returning lifecycle_version into v_lifecycle;
    elsif p_kind = 'taxonomy_version' then
      update platform_private.cms_taxonomy_versions
         set state = 'active', lifecycle_version = lifecycle_version + 1, activated_at = p_at,
             updated_at = pg_catalog.clock_timestamp()
       where id = p_subject_id returning lifecycle_version into v_lifecycle;
    else
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    if v_lifecycle is null then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  exception
    when unique_violation then
      perform pg_catalog.set_config('app.cms_governed_lifecycle', v_prior, true);
      raise exception 'activation_conflict' using errcode = 'P0001';
    when others then
      perform pg_catalog.set_config('app.cms_governed_lifecycle', v_prior, true);
      raise;
  end;
  perform pg_catalog.set_config('app.cms_governed_lifecycle', v_prior, true);
  return v_lifecycle;
end;
$body$;

comment on function platform_private.cms_governed_activate_subject(text, uuid, timestamptz) is
  'BE03c Subject state machine: moves one approved, scheduled or blocked subject version row to active (lifecycle_version + 1, activated_at stamped, definition version untouched); a lineage that already has an active version is activation_conflict. The caller holds the subject row lock. Private.';

create or replace function platform_private.cms_governed_supersede_lineage(p_kind text, p_lineage_id uuid, p_except_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_prior text := coalesce(pg_catalog.current_setting('app.cms_governed_lifecycle', true), '');
  v_id uuid := platform_private.cms_governed_lock_lineage_active(p_kind, p_lineage_id, p_except_id);
begin
  if v_id is null then
    return null;
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  perform pg_catalog.set_config('app.cms_governed_lifecycle', 'true', true);
  begin
    if p_kind = 'template_version' then
      update platform_private.cms_template_versions
         set state = 'superseded', lifecycle_version = lifecycle_version + 1, updated_at = pg_catalog.clock_timestamp()
       where id = v_id;
    elsif p_kind = 'pattern_version' then
      update platform_private.cms_pattern_versions
         set state = 'superseded', lifecycle_version = lifecycle_version + 1, updated_at = pg_catalog.clock_timestamp()
       where id = v_id;
    else
      update platform_private.cms_taxonomy_versions
         set state = 'superseded', lifecycle_version = lifecycle_version + 1, updated_at = pg_catalog.clock_timestamp()
       where id = v_id;
    end if;
  exception when others then
    perform pg_catalog.set_config('app.cms_governed_lifecycle', v_prior, true);
    raise;
  end;
  perform pg_catalog.set_config('app.cms_governed_lifecycle', v_prior, true);
  return v_id;
end;
$body$;

comment on function platform_private.cms_governed_supersede_lineage(text, uuid, uuid) is
  'BE03c Subject state machine: the previous active version of a lineage becomes superseded (lifecycle_version + 1, terminal) in the transaction that activates a newer version; returns its id or NULL. Emits nothing. Private.';

create or replace function platform_private.cms_governed_invalidate_approved_review(
  p_review_id uuid, p_reason text, p_actor_id uuid, p_acting_party_id uuid, p_correlation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_review platform_private.cms_governed_reviews%rowtype;
  v_subject jsonb;
  v_schedule record;
  v_stamp timestamptz;
begin
  if p_reason is null or p_reason not in ('dependency_changed', 'reviewer_authority_changed') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  select review_item.* into v_review from platform_private.cms_governed_reviews review_item
   where review_item.id = p_review_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  -- position 3 (the subject row) before position 5 (the review row)
  v_subject := platform_private.cms_governed_subject_resolve(v_review.subject_kind, v_review.subject_id, true);
  select review_item.* into v_review from platform_private.cms_governed_reviews review_item
   where review_item.id = p_review_id for update;
  if v_review.state not in ('open', 'approved') then
    raise exception 'review_not_open' using errcode = 'P0001';
  end if;
  v_stamp := pg_catalog.clock_timestamp();
  update platform_private.cms_governed_reviews review_item
     set state = 'invalidated', invalidated_reason = p_reason, decided_at = null,
         version = review_item.version + 1, updated_at = v_stamp
   where review_item.id = v_review.id and review_item.version = v_review.version;
  if not found then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;
  for v_schedule in
    select schedule_item.id, schedule_item.version
      from platform_private.cms_governed_activation_schedules schedule_item
     where schedule_item.review_id = v_review.id and schedule_item.state in ('pending', 'failed_retryable')
     order by schedule_item.id
       for update
  loop
    update platform_private.cms_governed_activation_schedules schedule_item
       set state = 'cancelled', reason_code = 'approval_invalidated', next_attempt_at = null,
           version = schedule_item.version + 1, updated_at = pg_catalog.clock_timestamp()
     where schedule_item.id = v_schedule.id and schedule_item.version = v_schedule.version;
    perform platform_private.cms_record_audit(
      'cms.governed.schedule.cancel', p_actor_id, p_acting_party_id,
      'cms_governed_activation_schedule', v_schedule.id, 'CMS_GOVERNED_SCHEDULE_CANCELLED', p_correlation_id);
  end loop;
  if v_subject is not null and v_subject->>'state' in ('review', 'approved', 'scheduled', 'blocked') then
    perform platform_private.cms_governed_move_subject(v_review.subject_kind, v_review.subject_id, 'draft');
  end if;
  perform platform_private.cms_record_audit(
    'cms.governed.review.invalidate', p_actor_id, p_acting_party_id,
    'cms_governed_review', v_review.id, 'CMS_GOVERNED_REVIEW_INVALIDATED', p_correlation_id);
end;
$body$;

comment on function platform_private.cms_governed_invalidate_approved_review(uuid, text, uuid, uuid, uuid) is
  'BE03c Review invalidation for an OPEN or APPROVED review: invalidated under CAS (version + 1) with dependency_changed or reviewer_authority_changed, decidedAt cleared, the subject returned to draft, every pending or failed_retryable schedule of the review cancelled (approval_invalidated) in the same transaction and one audit record each. The caller holds (or this function takes) the subject row before the review row. Private.';

grant select, update on table
  platform_private.cms_template_versions,
  platform_private.cms_pattern_versions,
  platform_private.cms_taxonomy_versions,
  platform_private.cms_governed_reviews,
  platform_private.cms_governed_activation_schedules
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_lock_lineage_active(text, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_activate_subject(text, uuid, timestamptz) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_supersede_lineage(text, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_invalidate_approved_review(uuid, text, uuid, uuid, uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_governed_lock_lineage_active(text, uuid, uuid),
  platform_private.cms_governed_activate_subject(text, uuid, timestamptz),
  platform_private.cms_governed_supersede_lineage(text, uuid, uuid),
  platform_private.cms_governed_invalidate_approved_review(uuid, text, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
