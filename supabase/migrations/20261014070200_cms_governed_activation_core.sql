-- Slice 12 lane governed-b (BE03c "Governed activation, retirement and scheduled activation (DEC-113, OD-6)" steps 4-6, "Event schemas" outbox
-- identity (DEC-180 G3 corrected by DEC-188), "Reviewer-authority invalidation on revocation"): the two pieces CMS-03C-09 (immediate activation)
-- and CMS-03C-19 (scheduled execution) share, so there is exactly one implementation of the switch and of the recheck.
--
--   cms_governed_first_unbuilt_domain(subject)   the first declared canonical domain (declaration order) whose current provider is not built, or NULL
--   cms_governed_activation_verdict(review)      'current' | 'canonical_source_unavailable' | 'dependency_changed' | 'approval_invalidated'
--       checked in this order under the caller's locks: (taxonomy) every declared canonical domain has a built provider; the frozen status
--       (subject hash, policy basis, dependency identities, block digest, nested pattern states, bound content types) is still current;
--       the live qualifying approvals still reach the required count and every specialist slot (defense in depth against a stored
--       `approved` state that lags a revocation).  A NULL workflow-policy evidence raises DEPENDENCY_UNAVAILABLE (fail closed).
--   cms_governed_apply_activation(review, actor, party, correlation, at)
--       the atomic CAS switch: the lineage's previous active version -> superseded, the subject -> active (lifecycle_version + 1, activated_at),
--       the review records activated_at and its version advances under CAS, and the audit record and EXACTLY ONE activation event commit
--       together (aggregate = the switched subject row at its committed lifecycle counter).  The previous version's supersession emits nothing.
--       Answers { lifecycleVersion, eventType, reviewVersion }.
-- Private; owned by the CMS definer role.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_first_unbuilt_domain(p_subject jsonb)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select declared.value
    from pg_catalog.jsonb_array_elements_text(coalesce(p_subject->'canonicalDomains', '[]'::jsonb))
         with ordinality declared(value, ord)
   where not exists (
     select 1 from platform_private.cms_canonical_domain_current(declared.value) current_row
      where current_row.provider_state = 'built')
   order by declared.ord
   limit 1
$body$;

create or replace function platform_private.cms_governed_activation_verdict(p_review_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_review platform_private.cms_governed_reviews%rowtype;
  v_subject jsonb;
  v_slots integer;
  v_held integer;
begin
  select review_item.* into v_review from platform_private.cms_governed_reviews review_item
   where review_item.id = p_review_id;
  if not found then
    return 'dependency_changed';
  end if;
  v_subject := platform_private.cms_governed_subject_resolve(v_review.subject_kind, v_review.subject_id);
  if v_subject is null then
    return 'dependency_changed';
  end if;
  if v_review.subject_kind = 'taxonomy_version'
     and platform_private.cms_governed_first_unbuilt_domain(v_subject) is not null then
    return 'canonical_source_unavailable';
  end if;
  if platform_private.cms_governed_frozen_status(v_review.id) is distinct from 'current' then
    return 'dependency_changed';
  end if;
  select (pg_catalog.count(*) filter (where slot.slot_no > 1))::integer,
         (pg_catalog.count(*) filter (
           where slot.slot_no > 1
             and exists (
               select 1 from platform_private.cms_governed_review_qualifying_decisions(v_review.id) counted
                where counted.capability = slot.slot_key)))::integer
    into v_slots, v_held
    from pg_catalog.jsonb_array_elements_text(v_review.required_capabilities) with ordinality slot(slot_key, slot_no);
  if platform_private.cms_governed_review_distinct_approvals(v_review.id) < v_review.required_decision_count
     or v_held < v_slots then
    return 'approval_invalidated';
  end if;
  return 'current';
end;
$body$;

create or replace function platform_private.cms_governed_apply_activation(
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
  v_event_type text;
  v_aggregate_type text;
  v_lifecycle bigint;
  v_review_version bigint;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  select review_item.* into v_review from platform_private.cms_governed_reviews review_item
   where review_item.id = p_review_id for update;
  if not found or v_review.state <> 'approved' then
    raise exception 'subject_not_activatable' using errcode = 'P0001';
  end if;
  v_subject := platform_private.cms_governed_subject_resolve(v_review.subject_kind, v_review.subject_id, true);
  if v_subject is null or v_subject->>'state' not in ('approved', 'scheduled', 'blocked') then
    raise exception 'subject_not_activatable' using errcode = 'P0001';
  end if;
  v_event_type := case v_review.subject_kind
    when 'template_version' then 'cms.template.activated.v1'
    when 'pattern_version' then 'cms.pattern.activated.v1'
    else 'cms.taxonomy.changed.v1' end;
  v_aggregate_type := case v_review.subject_kind
    when 'template_version' then 'cms_template_version'
    when 'pattern_version' then 'cms_pattern_version'
    else 'cms_taxonomy_version' end;
  -- the previous active version of the lineage first (the partial unique allows one active at any instant)
  perform platform_private.cms_governed_supersede_lineage(
    v_review.subject_kind, v_review.lineage_id, v_review.subject_id);
  v_lifecycle := platform_private.cms_governed_activate_subject(v_review.subject_kind, v_review.subject_id, p_at);
  update platform_private.cms_governed_reviews review_item
     set activated_at = p_at, version = review_item.version + 1, updated_at = p_at
   where review_item.id = v_review.id and review_item.version = v_review.version
  returning review_item.version into v_review_version;
  if v_review_version is null then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;
  perform platform_private.cms_emit_event(
    'cms.governed.activate', p_actor_id, p_acting_party_id, v_aggregate_type, v_review.subject_id,
    'CMS_GOVERNED_ACTIVATED', v_event_type, v_aggregate_type, v_review.subject_id, v_lifecycle,
    pg_catalog.jsonb_build_object(
      case v_review.subject_kind when 'template_version' then 'templateId'
                                 when 'pattern_version' then 'patternId' else 'taxonomyId' end, v_review.lineage_id,
      case v_review.subject_kind when 'template_version' then 'templateVersionId'
                                 when 'pattern_version' then 'patternVersionId' else 'taxonomyVersionId' end, v_review.subject_id),
    p_correlation_id);
  return pg_catalog.jsonb_build_object(
    'lifecycleVersion', v_lifecycle, 'eventType', v_event_type, 'reviewVersion', v_review_version::text);
end;
$body$;

comment on function platform_private.cms_governed_first_unbuilt_domain(jsonb) is
  'BE03c D10: the first declared canonical domain, in declaration order, whose current registry provider is not built; NULL when every declared domain has one. Private; STABLE.';
comment on function platform_private.cms_governed_activation_verdict(uuid) is
  'BE03c Governed activation steps 4-5: current, canonical_source_unavailable, dependency_changed or approval_invalidated for an approved review under the caller''s locks. Raises DEPENDENCY_UNAVAILABLE when a bound workflow-policy evidence is NULL. Private.';
comment on function platform_private.cms_governed_apply_activation(uuid, uuid, uuid, uuid, timestamptz) is
  'BE03c Governed activation step 6: supersedes the previous active version, activates the subject, records activated_at on the review (CAS, version + 1) and commits one audit record and exactly one activation event (aggregate = the subject row at its lifecycle counter). Private.';

grant select on table
  platform_private.cms_governed_review_decisions,
  platform_private.cms_governed_review_assignments
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_first_unbuilt_domain(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_activation_verdict(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_apply_activation(uuid, uuid, uuid, uuid, timestamptz) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_governed_first_unbuilt_domain(jsonb),
  platform_private.cms_governed_activation_verdict(uuid),
  platform_private.cms_governed_apply_activation(uuid, uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;

commit;
