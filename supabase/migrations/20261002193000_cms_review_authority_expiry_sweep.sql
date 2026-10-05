-- BE03a "Policy registry" reviewer-authority drift / AC1135: the expiry of a
-- specialist capability or of a reviewer assignment is not an event, so no
-- trigger fires when it lapses.  This scheduled sweep invalidates, eagerly and
-- in bounded batches, every open or approved CMS schema review whose counted
-- approve decision relied on an authority that has since lapsed, returns the
-- candidate to an editable draft (the same invalidation every other drift uses)
-- and writes the BE00 audit and outbox rows.  The activation recheck stays.
-- A decision relied on:
--   - its assignment when that assignment is still `active` but its window has
--     ended (revocation is invalidated eagerly by CMS-03A-14 and the grant
--     triggers already);
--   - a specialist slot of the frozen review (every required capability after the
--     base reviewer slot) when the deciding person holds a grant of that
--     capability in the owner organization whose valid_through UTC day has
--     passed and the person does not hold it now (a renewal is current again).
-- Idempotent: an invalidated review is no longer open or approved.  Service
-- role only.  Forward-only.
begin;

create function platform_private.cms_review_authority_lapsed(p_review_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select exists (
    select 1
      from platform_private.cms_schema_review_decisions decision
      join platform_private.cms_schema_review_assignments assignment
        on assignment.id = decision.assignment_id
     where decision.review_id = p_review_id
       and decision.decision = 'approve'
       and assignment.state = 'active'
       and assignment.ends_at <= pg_catalog.clock_timestamp()
  ) or exists (
    select 1
      from platform_private.cms_schema_reviews review
      join platform_private.cms_schema_review_decisions decision
        on decision.review_id = review.id and decision.decision = 'approve'
      cross join lateral pg_catalog.jsonb_array_elements_text(review.required_capabilities)
        with ordinality slot(capability, position)
     where review.id = p_review_id
       and slot.position > 1
       and exists (
         select 1
           from identity_private.organization_actor_grant actor_grant
          where actor_grant.organization_id = review.owner_id
            and actor_grant.person_id = decision.reviewer_person_ref
            and actor_grant.capability_code = slot.capability
            and actor_grant.valid_through is not null
            and actor_grant.valid_through < current_date)
       and not platform_private.cms_person_holds_capability(
         review.owner_id, decision.reviewer_person_ref, slot.capability)
  )
$body$;

create function platform_private.cms_sweep_expired_review_authority(p_batch integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  candidate record;
  review_after platform_private.cms_schema_reviews%rowtype;
  invalidated_count integer;
  swept integer := 0;
  correlation uuid := extensions.gen_random_uuid();
begin
  if p_batch is null or p_batch not between 1 and 5000 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  for candidate in
    select review.id, review.owner_id, review.content_type_version_id
      from platform_private.cms_schema_reviews review
     where review.state in ('open', 'approved')
       and platform_private.cms_review_authority_lapsed(review.id)
     order by review.id
     limit p_batch
       for update of review skip locked
  loop
    invalidated_count := platform_private.cms_invalidate_activation_reviews(
      candidate.content_type_version_id);
    if invalidated_count > 0 then
      select * into review_after from platform_private.cms_schema_reviews
       where id = candidate.id;
      perform platform_private.cms_emit_event(
        'cms.schema.review.invalidate', null, candidate.owner_id, 'cms_schema_review',
        candidate.id, 'REVIEWER_AUTHORITY_EXPIRED', 'cms.schema.review.invalidated.v1',
        'cms_schema_review', candidate.id, review_after.version,
        pg_catalog.jsonb_build_object(
          'reviewId', candidate.id,
          'schemaVersionId', candidate.content_type_version_id,
          'reason', 'REVIEWER_AUTHORITY_EXPIRED'
        ), correlation);
      swept := swept + 1;
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('invalidatedReviews', swept);
end;
$body$;

create function platform_api.cms_sweep_expired_review_authority(p_batch integer)
returns jsonb
language sql
security definer
set search_path = ''
as $body$
  select platform_private.cms_sweep_expired_review_authority(p_batch)
$body$;

revoke all on function platform_private.cms_review_authority_lapsed(uuid),
  platform_private.cms_sweep_expired_review_authority(integer)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_sweep_expired_review_authority(integer)
  from public, anon, authenticated;
grant execute on function platform_api.cms_sweep_expired_review_authority(integer) to service_role;

commit;
