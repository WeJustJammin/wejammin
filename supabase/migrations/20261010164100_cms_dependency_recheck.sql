-- Slice 11 dependency recheck, database half (BE03b "Review invalidation / Dependency
-- recheck"; tracker P2-S11-AC-113): what the Worker's six event consumers and the
-- `cms.review.dependency_recheck` job call.
--
--   cms_dependency_recheck_resolve_event(event_id)   platform_api, service role only.
--       The identity a committed source event names, as a dependency index lookup:
--       { found: true, kind, refId } or { found: false }.  The queue envelope is
--       identifier-only, so the consumer rereads the outbox row's published payload here
--       (BE03a / BE03c "Event schemas"):
--         cms.schema.activated.v1         schema            payload.schemaVersionId
--         cms.template.activated.v1       template          payload.templateVersionId
--         cms.pattern.activated.v1        pattern           payload.patternVersionId
--         cms.taxonomy.changed.v1         taxonomy_version  payload.taxonomyVersionId
--         cms.block.lifecycle.changed.v1  block             payload.blockDefinitionVersionId
--         cms.localization.changed.v1     locale_source     the SOURCE revision of the latest
--             locale variant of payload.{entryId, locale, revisionId}: the index names the
--             source revision a review froze, never the variant revision the event carries.
--       An absent event row, another event type, another schema version or a member that is
--       not the published identity is { found: false }; the consumer dead-letters it.
--
--   cms_dependency_recheck_run(request)      platform_api, service role only.
--       One bounded run of the job.  Request (exact keys): { eventId, kind, refId, cursor }.
--       It selects the live reviews (open|approved) that the dependency index names under
--       (kind, ref) in ascending review id after `cursor`, takes at most 500 of them and, for
--       each, asks cms_frozen_dependencies_status whether the review still holds: the manifest
--       is rebuilt from canonical state and must equal the frozen one, every frozen identity
--       must be current and every recorded taxonomy version active.  A review that no longer
--       holds is invalidated `dependency_changed` through the one invalidation core
--       (cms_invalidate_editorial_review); a review that holds is left untouched.  Result:
--       { examined <= 500, invalidated, nextCursor }; nextCursor is the last review handled
--       and is non-null only when a further live review remains, so a caller continues with it
--       until it is null.
--       * Selection is by index.  For the four versioned kinds (schema, template, pattern,
--         taxonomy_version) the named identity stands for its whole lineage (every version of
--         the same content type / template key / pattern key / taxonomy key of the owner):
--         the event of an activation names the version that became active, while the reviews
--         that went stale froze its predecessor.  Every other kind is the exact identity.
--       * Idempotent.  An invalidated or rejected review is not selected, a review that is
--         invalidated between selection and invalidation is an invalidation-core no-op, and a
--         repeated or concurrent run emits no second cms.entry.review-changed.v1.  The run
--         can never invalidate a review that still holds, whatever its request says, so a
--         forged or stale job is harmless.
--       * Lock order (BE03b "Write-path lock order"): the status of a review is decided from
--         plain reads; only a review that no longer holds is locked, by the invalidation core
--         (position 5, then the schedule and preview rows of position 6), in ascending review
--         id.  The run takes no earlier position after a later one.
--       * The audit and the cms.entry.review-changed.v1 event of each invalidation carry the
--         correlation id of the source event when the outbox row exists, else a fresh one.
--
-- Both are private SECURITY DEFINER functions of the CMS definer role with an empty
-- search_path and a platform_api wrapper granted to service_role only.  Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_dependency_recheck_lineage(
  p_kind text,
  p_ref_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $body$
  select coalesce(
    case p_kind
      when 'schema' then (
        select pg_catalog.array_agg(sibling.id order by sibling.id)
          from platform_private.cms_content_type_versions named
          join platform_private.cms_content_type_versions sibling
            on sibling.content_type_id = named.content_type_id
         where named.id = p_ref_id)
      when 'template' then (
        select pg_catalog.array_agg(sibling.id order by sibling.id)
          from platform_private.cms_template_versions named
          join platform_private.cms_template_versions sibling
            on sibling.owner_id = named.owner_id and sibling.template_key = named.template_key
         where named.id = p_ref_id)
      when 'pattern' then (
        select pg_catalog.array_agg(sibling.id order by sibling.id)
          from platform_private.cms_pattern_versions named
          join platform_private.cms_pattern_versions sibling
            on sibling.owner_id = named.owner_id and sibling.pattern_key = named.pattern_key
         where named.id = p_ref_id)
      when 'taxonomy_version' then (
        select pg_catalog.array_agg(sibling.id order by sibling.id)
          from platform_private.cms_taxonomy_versions named
          join platform_private.cms_taxonomy_versions sibling
            on sibling.owner_id = named.owner_id and sibling.taxonomy_key = named.taxonomy_key
         where named.id = p_ref_id)
    end,
    pg_catalog.array_fill(p_ref_id, array[1])
  )
$body$;

comment on function platform_private.cms_dependency_recheck_lineage(text, uuid) is
  'BE03b dependency recheck: the dependency index references a named identity stands for. A schema, template, pattern or taxonomy version stands for every version of its content type / template key / pattern key / taxonomy key (an activation names the new version, the stale reviews froze its predecessor); any other kind, and a version row that does not exist, is the identity itself. Private.';

create or replace function platform_private.cms_dependency_recheck_event_ref(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  event_row platform_private.outbox_events%rowtype;
  event_payload jsonb;
  resolved_kind text;
  identity_member text;
  resolved_ref uuid;
begin
  if p_event_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  select outbox.* into event_row
    from platform_private.outbox_events outbox
   where outbox.id = p_event_id;
  if not found or event_row.schema_version <> 1 then
    return pg_catalog.jsonb_build_object('found', false);
  end if;
  event_payload := event_row.payload;

  select source.kind, source.member into resolved_kind, identity_member
    from (values
      ('cms.schema.activated.v1', 'schema', 'schemaVersionId'),
      ('cms.template.activated.v1', 'template', 'templateVersionId'),
      ('cms.pattern.activated.v1', 'pattern', 'patternVersionId'),
      ('cms.taxonomy.changed.v1', 'taxonomy_version', 'taxonomyVersionId'),
      ('cms.block.lifecycle.changed.v1', 'block', 'blockDefinitionVersionId'),
      ('cms.localization.changed.v1', 'locale_source', null)
    ) as source(event_type, kind, member)
   where source.event_type = event_row.event_type;
  if not found then
    return pg_catalog.jsonb_build_object('found', false);
  end if;

  if identity_member is not null then
    if pg_catalog.jsonb_typeof(event_payload->identity_member) is distinct from 'string'
       or platform_private.cms_valid_uuid(event_payload->>identity_member) is not true then
      return pg_catalog.jsonb_build_object('found', false);
    end if;
    resolved_ref := (event_payload->>identity_member)::uuid;
  else
    if pg_catalog.jsonb_typeof(event_payload->'entryId') is distinct from 'string'
       or platform_private.cms_valid_uuid(event_payload->>'entryId') is not true
       or pg_catalog.jsonb_typeof(event_payload->'revisionId') is distinct from 'string'
       or platform_private.cms_valid_uuid(event_payload->>'revisionId') is not true
       or pg_catalog.jsonb_typeof(event_payload->'locale') is distinct from 'string' then
      return pg_catalog.jsonb_build_object('found', false);
    end if;
    select variant.source_revision_id into resolved_ref
      from platform_private.cms_locale_variants variant
     where variant.entry_id = (event_payload->>'entryId')::uuid
       and variant.revision_id = (event_payload->>'revisionId')::uuid
       and pg_catalog.lower(variant.locale) = pg_catalog.lower(event_payload->>'locale')
     order by variant.version desc, variant.created_at desc, variant.id desc
     limit 1;
    if resolved_ref is null then
      return pg_catalog.jsonb_build_object('found', false);
    end if;
  end if;
  return pg_catalog.jsonb_build_object('found', true, 'kind', resolved_kind, 'refId', resolved_ref);
end;
$body$;

comment on function platform_private.cms_dependency_recheck_event_ref(uuid) is
  'BE03b dependency recheck: the dependency index lookup (kind, refId) a committed source event names, read from the outbox row''s published payload; { found: false } for an absent row, another event type or version, or a payload member that is not the published identity. Private.';

create or replace function platform_private.cms_dependency_recheck_run(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  batch_max constant integer := 500;
  requested_kind text;
  requested_ref uuid;
  requested_cursor uuid;
  requested_event uuid;
  correlation uuid;
  lineage uuid[];
  picked uuid[];
  review_row platform_private.cms_editorial_reviews%rowtype;
  examined_count integer := 0;
  invalidated_count integer := 0;
  next_cursor uuid;
  pick_index integer;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_request is null
     or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request,
       array['eventId', 'kind', 'refId', 'cursor']::text[],
       array['eventId', 'kind', 'refId', 'cursor']::text[]
     )
     or pg_catalog.jsonb_typeof(p_request->'eventId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'eventId') is not true
     or pg_catalog.jsonb_typeof(p_request->'kind') is distinct from 'string'
     or (p_request->>'kind') not in (
       'schema', 'template', 'block', 'pattern', 'term', 'taxonomy_version',
       'locale_source', 'relation_target', 'settings')
     or pg_catalog.jsonb_typeof(p_request->'refId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'refId') is not true
     or (pg_catalog.jsonb_typeof(p_request->'cursor') is distinct from 'null'
         and (pg_catalog.jsonb_typeof(p_request->'cursor') is distinct from 'string'
              or platform_private.cms_valid_uuid(p_request->>'cursor') is not true)) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  requested_event := (p_request->>'eventId')::uuid;
  requested_kind := p_request->>'kind';
  requested_ref := (p_request->>'refId')::uuid;
  if pg_catalog.jsonb_typeof(p_request->'cursor') = 'string' then
    requested_cursor := (p_request->>'cursor')::uuid;
  end if;

  select outbox.correlation_id into correlation
    from platform_private.outbox_events outbox
   where outbox.id = requested_event;
  correlation := coalesce(correlation, platform_private.cms_trigger_correlation());
  lineage := platform_private.cms_dependency_recheck_lineage(requested_kind, requested_ref);

  -- One more than the bound: its presence is what makes the run continue.
  select coalesce(pg_catalog.array_agg(live.id order by live.id), array[]::uuid[])
    into picked
    from (
      select distinct review.id
        from platform_private.cms_editorial_review_dependencies dependency
        join platform_private.cms_editorial_reviews review on review.id = dependency.review_id
       where dependency.kind = requested_kind
         and dependency.ref_id = any(lineage)
         and review.state in ('open', 'approved')
         and (requested_cursor is null or review.id > requested_cursor)
       order by review.id
       limit batch_max + 1
    ) live;

  for pick_index in 1 .. least(pg_catalog.cardinality(picked), batch_max) loop
    examined_count := examined_count + 1;
    next_cursor := picked[pick_index];
    select review.* into review_row
      from platform_private.cms_editorial_reviews review
     where review.id = picked[pick_index];
    -- Nested, never one AND: the status read and the invalidation must run in this order.
    if review_row.state in ('open', 'approved') then
      if platform_private.cms_frozen_dependencies_status(
           review_row.revision_id, review_row.dependency_manifest) = 'stale' then
        if (platform_private.cms_invalidate_editorial_review(pg_catalog.jsonb_build_object(
              'reviewId', review_row.id, 'reasonCode', 'dependency_changed',
              'correlationId', correlation))->>'invalidated')::boolean then
          invalidated_count := invalidated_count + 1;
        end if;
      end if;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'examined', examined_count,
    'invalidated', invalidated_count,
    'nextCursor', case when pg_catalog.cardinality(picked) > batch_max then next_cursor end
  );
end;
$body$;

comment on function platform_private.cms_dependency_recheck_run(jsonb) is
  'BE03b dependency recheck job run: selects the live reviews the dependency index names under (kind, ref) after the cursor, handles at most 500, rebuilds each manifest and invalidates dependency_changed on inequality or a non-current identity. Idempotent; never invalidates a review that still holds; answers { examined, invalidated, nextCursor }. Private.';

create or replace function platform_api.cms_dependency_recheck_resolve_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_dependency_recheck_event_ref(p_event_id);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

create or replace function platform_api.cms_dependency_recheck_run(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  begin
    rpc_result := platform_private.cms_dependency_recheck_run(p_request);
  exception
    -- BE03b lock order: a residual deadlock or lock failure is the typed retryable CONFLICT.
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

-- SEC-2: what the functions read, held by the definer role only.
grant select on table
  platform_private.cms_content_type_versions,
  platform_private.cms_editorial_review_dependencies,
  platform_private.cms_editorial_reviews,
  platform_private.cms_locale_variants,
  platform_private.cms_pattern_versions,
  platform_private.cms_taxonomy_versions,
  platform_private.cms_template_versions,
  platform_private.outbox_events
  to wejammin_cms_definer;
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_dependency_recheck_lineage(text, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_dependency_recheck_event_ref(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_dependency_recheck_run(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_dependency_recheck_resolve_event(uuid) owner to wejammin_cms_definer;
alter function platform_api.cms_dependency_recheck_run(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function
  platform_private.cms_dependency_recheck_lineage(text, uuid),
  platform_private.cms_dependency_recheck_event_ref(uuid),
  platform_private.cms_dependency_recheck_run(jsonb),
  platform_api.cms_dependency_recheck_resolve_event(uuid),
  platform_api.cms_dependency_recheck_run(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_dependency_recheck_resolve_event(uuid) to service_role;
grant execute on function platform_api.cms_dependency_recheck_run(jsonb) to service_role;

commit;
