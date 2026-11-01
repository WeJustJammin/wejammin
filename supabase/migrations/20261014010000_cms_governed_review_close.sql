-- Slice 12 lane governed-a (BE03c "Subject state machine", "Governed review machinery", "Review invalidation" applied
-- unchanged; tracker P2-S12-AC-072, AC-073, AC-078): the two private helpers every governed review command that ends or
-- advances a review shares.  Both are called by a command that already holds the BE03c lock order (the subject version row,
-- position 3, before the review row, position 5): they take no lock an earlier position would precede.
--
--   cms_governed_move_subject(kind, subject_id, to_state)
--       advances the subject version row to one legal state, lifecycle_version + 1 and updated_at, through the guarded
--       lifecycle seam (app.cms_governed_lifecycle, restored on exit); the definition version never moves (DEC-188).
--   cms_governed_invalidate_open_review(review_id, reason, actor, party, correlation)
--       an OPEN review -> invalidated under CAS (version + 1) with one of the two closed reasons, the subject back to draft,
--       and one audit record.  (An approved review carries schedules a different command cancels; this helper refuses it.)
--   cms_governed_cas_operand(request)
--       the shared If-Match / expectedVersion operand of CMS-03C-07 and CMS-03C-08 (see the function).
-- Private; owned by the CMS definer role.  Forward-only.
begin;
set local lock_timeout = '5s';

-- The shared CAS operand of CMS-03C-07 and CMS-03C-08: `expectedVersion` and the strong `If-Match` are positive decimal strings of at
-- most 19 digits (a bigint) that must agree.  VALIDATION_FAILED at the member pointer, INVALID_REQUEST when they disagree.
create or replace function platform_private.cms_governed_cas_operand(p_request jsonb)
returns bigint
language plpgsql
stable
set search_path = ''
as $body$
declare
  v_member text;
begin
  foreach v_member in array array['expectedVersion', 'ifMatch']::text[] loop
    if pg_catalog.jsonb_typeof(p_request->v_member) is distinct from 'string'
       or platform_private.cms_valid_version(p_request->>v_member) is not true
       or pg_catalog.length(p_request->>v_member) > 19
       or (pg_catalog.length(p_request->>v_member) = 19 and p_request->>v_member > '9223372036854775807') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.format('["/%s"]', v_member);
    end if;
  end loop;
  if p_request->>'expectedVersion' <> p_request->>'ifMatch' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  return (p_request->>'expectedVersion')::bigint;
end;
$body$;

create or replace function platform_private.cms_governed_move_subject(
  p_kind text, p_subject_id uuid, p_to_state text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_prior text := coalesce(pg_catalog.current_setting('app.cms_governed_lifecycle', true), '');
begin
  if p_to_state is null or p_to_state not in ('draft', 'review', 'approved', 'scheduled', 'active', 'blocked') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  perform pg_catalog.set_config('app.cms_governed_lifecycle', 'true', true);
  begin
    if p_kind = 'template_version' then
      update platform_private.cms_template_versions
         set state = p_to_state, lifecycle_version = lifecycle_version + 1, updated_at = pg_catalog.clock_timestamp()
       where id = p_subject_id;
    elsif p_kind = 'pattern_version' then
      update platform_private.cms_pattern_versions
         set state = p_to_state, lifecycle_version = lifecycle_version + 1, updated_at = pg_catalog.clock_timestamp()
       where id = p_subject_id;
    elsif p_kind = 'taxonomy_version' then
      update platform_private.cms_taxonomy_versions
         set state = p_to_state, lifecycle_version = lifecycle_version + 1, updated_at = pg_catalog.clock_timestamp()
       where id = p_subject_id;
    else
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  exception when others then
    perform pg_catalog.set_config('app.cms_governed_lifecycle', v_prior, true);
    raise;
  end;
  perform pg_catalog.set_config('app.cms_governed_lifecycle', v_prior, true);
end;
$body$;

comment on function platform_private.cms_governed_move_subject(text, uuid, text) is
  'BE03c Subject state machine: moves one subject version row (template, pattern or taxonomy) to a legal state, lifecycle_version + 1, through the guarded lifecycle seam; the definition version is untouched (DEC-188). The caller holds the subject row lock. Private.';

create or replace function platform_private.cms_governed_invalidate_open_review(
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
begin
  if p_reason is null or p_reason not in ('dependency_changed', 'reviewer_authority_changed') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  select review_item.* into v_review
    from platform_private.cms_governed_reviews review_item
   where review_item.id = p_review_id
     for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_review.state <> 'open' then
    raise exception 'review_not_open' using errcode = 'P0001';
  end if;
  update platform_private.cms_governed_reviews review_item
     set state = 'invalidated',
         invalidated_reason = p_reason,
         decided_at = null,
         version = review_item.version + 1,
         updated_at = pg_catalog.clock_timestamp()
   where review_item.id = v_review.id
     and review_item.version = v_review.version;
  if not found then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;
  v_subject := platform_private.cms_governed_subject_resolve(v_review.subject_kind, v_review.subject_id);
  if v_subject is not null and v_subject->>'state' in ('review', 'approved', 'scheduled', 'blocked') then
    perform platform_private.cms_governed_move_subject(v_review.subject_kind, v_review.subject_id, 'draft');
  end if;
  perform platform_private.cms_record_audit(
    'cms.governed.review.invalidate', p_actor_id, p_acting_party_id,
    'cms_governed_review', v_review.id, 'CMS_GOVERNED_REVIEW_INVALIDATED', p_correlation_id);
end;
$body$;

comment on function platform_private.cms_governed_invalidate_open_review(uuid, text, uuid, uuid, uuid) is
  'BE03c Review invalidation for an OPEN review: invalidated under CAS (version + 1) with dependency_changed or reviewer_authority_changed, decidedAt null, the subject returned to draft and one audit record. The caller holds the subject row (position 3) and the review row (position 5). Private.';

grant select, update on table
  platform_private.cms_template_versions,
  platform_private.cms_pattern_versions,
  platform_private.cms_taxonomy_versions
  to wejammin_cms_definer;
grant select, update on table platform_private.cms_governed_reviews to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_cas_operand(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_move_subject(text, uuid, text) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_invalidate_open_review(uuid, text, uuid, uuid, uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_governed_cas_operand(jsonb),
  platform_private.cms_governed_move_subject(text, uuid, text),
  platform_private.cms_governed_invalidate_open_review(uuid, text, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
