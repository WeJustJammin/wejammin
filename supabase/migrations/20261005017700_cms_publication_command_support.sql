-- Slice 11 lane S11-3b (BE03b "Publication preflight registry (D19)", "Review invalidation", "Schedule
-- execution (CMS-03B-20)", DEC-157 lock order, DEC-158, DEC-159; tracker P2-S11-AC-017 .. AC-034,
-- AC-097, AC-101, AC-107): the helpers shared by the schedule and publication commands
-- cms_schedule_publication (CMS-03B-07) and cms_publish_revision (CMS-03B-09), and by the schedule
-- executor.  None is executable by an API role; the commands call them from definer-owned bodies.
--
--   cms_activation_evidence_hash(review)       the JCS SHA-256 of the review's frozen activation evidence:
--                                              the activationEvidenceHash of a schedule, a claim and a
--                                              publication lineage row
--   cms_publication_target(actor, party, revision, entry|null, action)
--                                              concealment and authority: the revision is in the caller's
--                                              preview scope (else the one NOT_FOUND), the caller holds the
--                                              owner-party cms.publisher grant (else capability_missing) and
--                                              is not the author of a revision they publish
--                                              (separation_of_duties, E11)
--   cms_publication_lock_authority(entry, owner, person, revision)
--                                              global lock order positions 0 and 1: the entry row FOR SHARE
--                                              (a revision append and a publication serialize), then the
--                                              authority rows of the publisher and of every human who decided
--                                              the latest review (FOR SHARE, counted approvers included)
--   cms_publication_lock_review(revision)      positions 4 and 5: the revision's content-type version FOR
--                                              SHARE, then the revision's LATEST review FOR UPDATE (rechecked
--                                              under the lock); CONFLICT when the revision has no review
--   cms_publication_review_operand(review, expected)
--                                              the approved review's version is the CAS operand
--                                              (VERSION_MISMATCH with expected/current) and the review must be
--                                              approved (CONFLICT)
--   cms_publication_stale_refusal(review, actor, correlation)
--                                              a frozen manifest that is no longer current COMMITS the review
--                                              invalidation (reason dependency_changed) and answers the
--                                              committed-refusal envelope { kind: 'refusal', reasonCode:
--                                              'version_set_stale', details: {} } (BE03b E1: the command is 409
--                                              CONFLICT version_set_stale; DEC-159)
--   cms_publication_preflight_verdict(phase, review, party, person, effectiveAt, evidence, actor, correlation)
--                                              the schedule / publish phase of the 17-category registry with the
--                                              Worker's accessibility proof; any failed category is
--                                              422 preflight_failed {preflight}, else any unavailable one is
--                                              503 DEPENDENCY_UNAVAILABLE {dependencyClass}; mis-bound proof is
--                                              409 dependency_changed {dependencyHash}.  A counted approver whose
--                                              standing grant lapsed (the revocation category fails with
--                                              reviewer_authority_changed) is found lazily: that COMMITS the
--                                              reviewer_authority_changed invalidation (the review's pending and
--                                              retry schedules are cancelled in the same transaction) and the
--                                              verdict answers the committed-refusal envelope { kind: 'refusal',
--                                              reasonCode: 'preflight_failed', details: { preflight } } instead of
--                                              raising, so the caller completes its reservation with it
--
-- Refusals are `raise exception '<token>' using errcode = 'P0001'`; structured members ride in a
-- JSON-OBJECT DETAIL from the DEC-159 member set.  Private; callers hold every earlier lock position
-- and run under the CMS RPC context.  Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_activation_evidence_hash(p_review_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select platform_private.cms_jcs_sha256(review.activation_evidence)
    from platform_private.cms_editorial_reviews review
   where review.id = p_review_id
$body$;

comment on function platform_private.cms_activation_evidence_hash(uuid) is
  'BE03b: the lowercase SHA-256 of the JCS of the review''s frozen activation evidence (the activationEvidenceHash a schedule, a ClaimedSchedule and a publication lineage row carry). NULL for an absent review. Private; STABLE.';

create or replace function platform_private.cms_publication_target(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_revision_id uuid,
  p_entry_id uuid,
  p_action text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  person uuid;
  revision_row platform_private.cms_entry_revisions%rowtype;
  entry_row platform_private.cms_content_entries%rowtype;
begin
  begin
    person := platform_private.identity_actor_person(p_actor_id);
  exception when others then
    person := null;
  end;
  select revision_item.* into revision_row
    from platform_private.cms_entry_revisions revision_item
   where revision_item.id = p_revision_id;
  if person is null or not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select entry_item.* into entry_row
    from platform_private.cms_content_entries entry_item
   where entry_item.id = revision_row.entry_id;
  -- Hidden, absent, foreign-party and scope-less targets are one NOT_FOUND (the scope is the
  -- CMS-03B-15 workflow read scope: entry assignee, owner-party publisher, active reviewer assignee).
  if not found
     or (p_entry_id is not null and entry_row.id is distinct from p_entry_id)
     or entry_row.owner_party_id is distinct from p_acting_party_id
     or not platform_private.cms_preview_scope_holds(person, p_acting_party_id, entry_row.id, revision_row.id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not platform_private.cms_person_holds_capability(p_acting_party_id, person, 'cms.publisher') then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  if p_action = 'publish' and revision_row.author_person_id = person then
    raise exception 'separation_of_duties' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_build_object(
    'personId', person, 'entryId', entry_row.id, 'revisionId', revision_row.id,
    'locale', revision_row.locale, 'ownerPartyId', entry_row.owner_party_id
  );
end;
$body$;

comment on function platform_private.cms_publication_target(uuid, uuid, uuid, uuid, text) is
  'BE03b CMS-03B-07/09 authority: a revision outside the caller''s workflow read scope is NOT_FOUND, a visible one without the owner-party cms.publisher grant is capability_missing, and the author of a revision they publish is separation_of_duties (E11). Returns { personId, entryId, revisionId, locale, ownerPartyId }. Private; STABLE.';

create or replace function platform_private.cms_publication_lock_authority(
  p_entry_id uuid,
  p_owner_id uuid,
  p_person_id uuid,
  p_revision_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  latest platform_private.cms_editorial_reviews%rowtype;
  people uuid[];
  capabilities text[];
begin
  -- Position 0: the entry row (a revision append takes it FOR UPDATE).
  perform 1
    from platform_private.cms_content_entries entry_item
   where entry_item.id = p_entry_id
     for share;
  select review_item.* into latest
    from platform_private.cms_editorial_reviews review_item
   where review_item.revision_id = p_revision_id
   order by review_item.submitted_at desc, review_item.id desc
   limit 1;
  people := array[p_person_id]::uuid[];
  capabilities := array['cms.publisher', 'cms.reviewer']::text[];
  if found then
    people := people || array(
      select distinct decision.reviewer_person_id
        from platform_private.cms_editorial_decisions decision
       where decision.review_id = latest.id
    );
    capabilities := capabilities || array(
      select slot.slot_key
        from pg_catalog.jsonb_array_elements_text(latest.required_capabilities) slot(slot_key)
    );
  end if;
  -- Position 1: the publisher and the humans whose approval is counted (a revocation committed
  -- first wins; a later one waits for this command to commit).
  perform platform_private.cms_lock_person_authority(p_owner_id, people, capabilities);
end;
$body$;

comment on function platform_private.cms_publication_lock_authority(uuid, uuid, uuid, uuid) is
  'BE03b global lock order positions 0-1 for a publication command: the entry row FOR SHARE, then the authority rows (person, tenure, grants) of the publisher and of every decider of the revision''s latest review FOR SHARE. Private.';

create or replace function platform_private.cms_publication_lock_review(p_revision_id uuid)
returns platform_private.cms_editorial_reviews
language plpgsql
security definer
set search_path = ''
as $body$
declare
  revision_row platform_private.cms_entry_revisions%rowtype;
  candidate platform_private.cms_editorial_reviews%rowtype;
  locked platform_private.cms_editorial_reviews%rowtype;
begin
  select revision_item.* into revision_row
    from platform_private.cms_entry_revisions revision_item
   where revision_item.id = p_revision_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  -- Position 4 (DEC-157): the content-type version before the review row.
  perform 1
    from platform_private.cms_content_type_versions version_item
   where version_item.id = revision_row.schema_version_id
     for share;
  select review_item.* into candidate
    from platform_private.cms_editorial_reviews review_item
   where review_item.revision_id = p_revision_id
   order by review_item.submitted_at desc, review_item.id desc
   limit 1;
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- Position 5: the review row, then the authoritative recheck that it is still the latest.
  select review_item.* into locked
    from platform_private.cms_editorial_reviews review_item
   where review_item.id = candidate.id
     for update;
  if locked.id is distinct from (
    select latest.id
      from platform_private.cms_editorial_reviews latest
     where latest.revision_id = p_revision_id
     order by latest.submitted_at desc, latest.id desc
     limit 1
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return locked;
end;
$body$;

comment on function platform_private.cms_publication_lock_review(uuid) is
  'BE03b global lock order positions 4-5 for a publication command: the revision''s content-type version FOR SHARE, then its latest review FOR UPDATE, rechecked as still the latest under the lock. CONFLICT when the revision has no review. Returns the locked row. Private.';

create or replace function platform_private.cms_publication_review_operand(
  p_review platform_private.cms_editorial_reviews,
  p_expected_version bigint
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $body$
begin
  if p_review.version <> p_expected_version then
    perform platform_private.cms_raise_version_mismatch(p_expected_version, p_review.version);
  end if;
  if p_review.state <> 'approved' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
end;
$body$;

comment on function platform_private.cms_publication_review_operand(platform_private.cms_editorial_reviews, bigint) is
  'BE03b E5/CAS: the approved review''s version is the operand of CMS-03B-07/09 (an invalidation advances it, so a stale operand is VERSION_MISMATCH with the authorized expected/current versions) and the review must be approved (CONFLICT). Private; STABLE.';

create or replace function platform_private.cms_publication_stale_refusal(
  p_review_id uuid,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  review_row platform_private.cms_editorial_reviews%rowtype;
begin
  select review_item.* into review_row
    from platform_private.cms_editorial_reviews review_item
   where review_item.id = p_review_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  -- BE03b E1: the review is invalidated dependency_changed (the Review invalidation reason of a command that
  -- finds the manifest or a frozen identity no longer current) while the command itself answers version_set_stale.
  perform platform_private.cms_invalidate_editorial_review(pg_catalog.jsonb_build_object(
    'reviewId', review_row.id, 'reasonCode', 'dependency_changed',
    'correlationId', p_correlation_id, 'actorId', p_actor_id));
  return pg_catalog.jsonb_build_object(
    'kind', 'refusal',
    'reasonCode', 'version_set_stale',
    'details', '{}'::jsonb
  );
end;
$body$;

comment on function platform_private.cms_publication_stale_refusal(uuid, uuid, uuid) is
  'BE03b E1 / Review invalidation / DEC-159: commits the dependency_changed invalidation of a review whose frozen manifest is no longer current (a non-current identity or a differing recomputed manifest) and returns the committed-refusal envelope { kind: refusal, reasonCode: version_set_stale, details: {} } (the command is 409 CONFLICT version_set_stale). The caller completes its idempotency record with it. Private.';

create or replace function platform_private.cms_publication_preflight_verdict(
  p_phase text,
  p_review platform_private.cms_editorial_reviews,
  p_acting_party_id uuid,
  p_person_id uuid,
  p_effective_at timestamptz,
  p_evidence jsonb,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  report jsonb;
  summary jsonb;
begin
  if p_phase not in ('schedule', 'publish') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  begin
    report := platform_private.cms_evaluate_preflight(pg_catalog.jsonb_build_object(
      'phase', p_phase, 'revisionId', p_review.revision_id, 'actingPartyId', p_acting_party_id,
      'actorPersonId', p_person_id, 'effectiveAt', platform_private.auth_iso_time(p_effective_at),
      'reviewId', p_review.id, 'frozenManifest', p_review.dependency_manifest,
      'evidence', p_evidence));
  exception
    when raise_exception then
      -- Evidence bound to other rows: the current hash is the only member the Worker may echo.
      if sqlerrm = 'dependency_changed' then
        raise exception 'dependency_changed' using errcode = 'P0001',
          detail = pg_catalog.jsonb_build_object('dependencyHash', p_review.dependency_hash)::text;
      end if;
      raise;
  end;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(report->'results') result(item)
     where result.item->>'outcome' = 'failed'
  ) then
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'category', result.item->>'category', 'outcome', result.item->>'outcome',
             'reasonCode', result.item->'reasonCode') order by result.ordinal)
      into summary
      from pg_catalog.jsonb_array_elements(report->'results') with ordinality result(item, ordinal);
    -- BE03b Review invalidation: a counted approver's standing capability that LAPSED (or whose assignment was
    -- revoked) is found lazily by the revocation preflight.  The approval can never be used again, so the
    -- invalidation COMMITS (cancelling the review's pending and retry schedules) and the command answers the
    -- committed refusal, never a rollback that would leave the dead approval standing.
    if exists (
      select 1 from pg_catalog.jsonb_array_elements(report->'results') result(item)
       where result.item->>'category' = 'revocation' and result.item->>'outcome' = 'failed'
         and result.item->>'reasonCode' = 'reviewer_authority_changed'
    ) then
      perform platform_private.cms_invalidate_editorial_review(pg_catalog.jsonb_build_object(
        'reviewId', p_review.id, 'reasonCode', 'reviewer_authority_changed',
        'correlationId', p_correlation_id, 'actorId', p_actor_id));
      return pg_catalog.jsonb_build_object(
        'kind', 'refusal', 'reasonCode', 'preflight_failed',
        'details', pg_catalog.jsonb_build_object('preflight', summary));
    end if;
    raise exception 'preflight_failed' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_object('preflight', summary)::text;
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(report->'results') result(item)
     where result.item->>'outcome' = 'unavailable'
  ) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001',
      detail = '{"dependencyClass":"preflight"}';
  end if;
  return report;
end;
$body$;

comment on function platform_private.cms_publication_preflight_verdict(text, platform_private.cms_editorial_reviews, uuid, uuid, timestamptz, jsonb, uuid, uuid) is
  'BE03b D19/D25 for CMS-03B-07 (schedule) and CMS-03B-09 (publish): evaluates all seventeen categories against the review''s frozen manifest with the Worker''s accessibility proof. Any failed category is 422 preflight_failed {preflight: <=17 {category, outcome, reasonCode}}, else any unavailable one is 503 DEPENDENCY_UNAVAILABLE {dependencyClass: preflight}; stale proof is preflight_evidence_stale; proof bound to other rows is dependency_changed {dependencyHash}. A lapsed counted approver (revocation failed reviewer_authority_changed) COMMITS the reviewer_authority_changed invalidation and answers the committed-refusal envelope { kind: refusal, reasonCode: preflight_failed, details: { preflight } } instead of raising. Returns the passed report otherwise. Private.';

-- SEC-2: what the helpers read, held by the definer role only.
grant select on table platform_private.cms_editorial_decisions to wejammin_cms_definer;
grant select, update on table platform_private.cms_editorial_reviews to wejammin_cms_definer;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_activation_evidence_hash(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_publication_target(uuid, uuid, uuid, uuid, text) owner to wejammin_cms_definer;
alter function platform_private.cms_publication_lock_authority(uuid, uuid, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_publication_lock_review(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_publication_review_operand(platform_private.cms_editorial_reviews, bigint) owner to wejammin_cms_definer;
alter function platform_private.cms_publication_stale_refusal(uuid, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_publication_preflight_verdict(text, platform_private.cms_editorial_reviews, uuid, uuid, timestamptz, jsonb, uuid, uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_activation_evidence_hash(uuid),
  platform_private.cms_publication_target(uuid, uuid, uuid, uuid, text),
  platform_private.cms_publication_lock_authority(uuid, uuid, uuid, uuid),
  platform_private.cms_publication_lock_review(uuid),
  platform_private.cms_publication_review_operand(platform_private.cms_editorial_reviews, bigint),
  platform_private.cms_publication_stale_refusal(uuid, uuid, uuid),
  platform_private.cms_publication_preflight_verdict(text, platform_private.cms_editorial_reviews, uuid, uuid, timestamptz, jsonb, uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
