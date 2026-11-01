-- Slice 12 lane governed-recheck (BE03c "Governed review machinery" Invalidation, "Job transport (DEC-166, DEC-180 G9)", "Slice 12 lock
-- order" row `cms_recheck_governed_reviews`; tracker P2-S12-AC-202, AC-203): the database half of the typed platform-queue job
-- `cms.governed_review.recheck`.
--
--   cms_recheck_governed_reviews(request)   platform_api, service role only.
--       One bounded run.  Request (exact keys): { eventId, kind, refId, cursor } and the optional `batch` (integer 1..500, default
--       500: the bound a test or a caller may lower, never raise).  kind is a governed dependency kind: block, pattern,
--       content_type or canonical_domain.  It selects the live reviews (open|approved, never activated) that
--       cms_governed_review_dependencies names under (kind, ref) in ascending review id after `cursor`, takes at most `batch`
--       of them and applies cms_governed_recheck_verdict to each.  A review that no longer holds is invalidated through the single
--       review invalidation (cms_governed_invalidate_approved_review: subject row FOR UPDATE before the review row, review ->
--       invalidated with the closed reason under CAS, subject -> draft, pending and failed_retryable schedules -> cancelled
--       approval_invalidated in the same transaction, audit; NO event).  Result: { examined <= batch, invalidated,
--       dependencyChanged, reviewerAuthorityChanged (invalidated is their sum), unavailable, nextCursor }; nextCursor is the last review handled and is non-null only when a further live review remains.
--       * `content_type` and `pattern` name a version that stands for its whole lineage (every version of the same content type /
--         pattern key of the owner): an activation names the version that became active, while the reviews that went stale froze
--         its predecessor (cms_dependency_recheck_lineage).  block and canonical_domain are the exact identity.
--       * Idempotent: an invalidated or rejected review is not selected; a review invalidated between selection and handling is a
--         skip (review_not_open); a repeated or concurrent run invalidates nothing twice and the run never invalidates a review
--         that still holds, whatever its request says, so a forged or stale job is harmless.
--       * One review never stops the others (DEC-218).  Each review is handled in its own sub-transaction: a review whose policy
--         evidence is NULL (DEPENDENCY_UNAVAILABLE) or whose verdict or invalidation fails for any other reason than a lock failure is
--         rolled back to its state at selection, counted `unavailable`, left live (fail closed at its own decision and activation, where
--         the same recount runs) and reported as a WARNING carrying the review id and the SQLSTATE only; the cursor advances past it.  A
--         deadlock or a lock failure is NOT isolated: it is the typed retryable CONFLICT of the wrapper, the run is retried whole and the
--         idempotency above makes the retry safe.
--       * Lock order (BE03c "Slice 12 lock order", row `cms_recheck_governed_reviews`): per review, in ascending review id,
--         position 3 first - the SUBJECT version row FOR UPDATE - and only then the dependency reads of the verdict (the block digest
--         takes FOR SHARE on the reachable block rows, which are part of the subject's dependency graph, also position 3), so the
--         verdict is decided UNDER the subject lock and activation (subject, then blocks) and CMS-03A-08 (blocks) are never met in the
--         opposite order; position 5 - the review row FOR UPDATE - is taken by the invalidation only for a review that no longer
--         holds.  No earlier position follows a later one.  A multi-review run locks subject then review per review (S1,R1,S2,R2 ...) in
--         ascending review id, the order every other multi-review writer (the person invalidation) uses, and a live review has a
--         unique subject, so two runs cannot wait for each other.
--       * The audit records carry the correlation id of the source event when its outbox row exists, else a fresh one.
-- Private SECURITY DEFINER of the CMS definer role with an empty search_path and a platform_api wrapper granted to service_role only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_recheck_governed_reviews(p_request jsonb)
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
  requested_batch integer := batch_max;
  correlation uuid;
  lineage uuid[];
  picked uuid[];
  review_row platform_private.cms_governed_reviews%rowtype;
  verdict text;
  examined_count integer := 0;
  dependency_count integer := 0;
  authority_count integer := 0;
  unavailable_count integer := 0;
  next_cursor uuid;
  pick_index integer;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_request is null
     or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request,
       array['eventId', 'kind', 'refId', 'cursor']::text[],
       array['eventId', 'kind', 'refId', 'cursor', 'batch']::text[]
     )
     or pg_catalog.jsonb_typeof(p_request->'eventId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'eventId') is not true
     or pg_catalog.jsonb_typeof(p_request->'kind') is distinct from 'string'
     or (p_request->>'kind') not in ('block', 'pattern', 'content_type', 'canonical_domain')
     or pg_catalog.jsonb_typeof(p_request->'refId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'refId') is not true
     or (pg_catalog.jsonb_typeof(p_request->'cursor') is distinct from 'null'
         and (pg_catalog.jsonb_typeof(p_request->'cursor') is distinct from 'string'
              or platform_private.cms_valid_uuid(p_request->>'cursor') is not true))
     or (p_request ? 'batch'
         and (pg_catalog.jsonb_typeof(p_request->'batch') is distinct from 'number'
              or (p_request->>'batch') !~ '^[1-9][0-9]{0,2}$'
              or (p_request->>'batch')::integer > batch_max)) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  requested_event := (p_request->>'eventId')::uuid;
  requested_kind := p_request->>'kind';
  requested_ref := (p_request->>'refId')::uuid;
  if pg_catalog.jsonb_typeof(p_request->'cursor') = 'string' then
    requested_cursor := (p_request->>'cursor')::uuid;
  end if;
  if p_request ? 'batch' then
    requested_batch := (p_request->>'batch')::integer;
  end if;

  select outbox.correlation_id into correlation
    from platform_private.outbox_events outbox
   where outbox.id = requested_event;
  correlation := coalesce(correlation, platform_private.cms_trigger_correlation());
  lineage := case requested_kind
    when 'content_type' then platform_private.cms_dependency_recheck_lineage('schema', requested_ref)
    when 'pattern' then platform_private.cms_dependency_recheck_lineage('pattern', requested_ref)
    else array[requested_ref]
  end;

  -- One more than the bound: its presence is what makes the run continue.
  select coalesce(pg_catalog.array_agg(live.id order by live.id), array[]::uuid[])
    into picked
    from (
      select distinct review.id
        from platform_private.cms_governed_review_dependencies dependency
        join platform_private.cms_governed_reviews review on review.id = dependency.review_id
       where dependency.kind = requested_kind
         and dependency.ref_id = any(lineage)
         and review.state in ('open', 'approved')
         and review.activated_at is null
         and (requested_cursor is null or review.id > requested_cursor)
       order by review.id
       limit requested_batch + 1
    ) live;

  for pick_index in 1 .. least(pg_catalog.cardinality(picked), requested_batch) loop
    examined_count := examined_count + 1;
    next_cursor := picked[pick_index];
    select review.* into review_row
      from platform_private.cms_governed_reviews review
     where review.id = picked[pick_index];
    -- Nested, never one AND: the plain read above only chooses the candidates; the verdict is read under the subject lock below.
    if review_row.state in ('open', 'approved') and review_row.activated_at is null then
      begin
        -- position 3: the subject version row FOR UPDATE, before any dependency read of the verdict (BE03c "Slice 12 lock order")
        perform platform_private.cms_governed_subject_resolve(review_row.subject_kind, review_row.subject_id, true);
        verdict := platform_private.cms_governed_recheck_verdict(review_row.id);
        if verdict <> 'current' then
          perform platform_private.cms_governed_invalidate_approved_review(
            review_row.id, verdict, null, review_row.owner_id, correlation);
          if verdict = 'dependency_changed' then
            dependency_count := dependency_count + 1;
          else
            authority_count := authority_count + 1;
          end if;
        end if;
      exception
        -- the typed retryable CONFLICT of the wrapper: never isolated, the whole run is retried
        when deadlock_detected or lock_not_available then
          raise;
        when others then
          -- invalidated by a concurrent writer between the selection and the lock: nothing left to do
          if sqlerrm = 'review_not_open' then
            null;
          else
            unavailable_count := unavailable_count + 1;
            if sqlerrm <> 'DEPENDENCY_UNAVAILABLE' then
              raise warning 'cms_recheck_governed_reviews: review % left live (sqlstate %)', review_row.id, sqlstate;
            end if;
          end if;
      end;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'examined', examined_count,
    'invalidated', dependency_count + authority_count,
    'dependencyChanged', dependency_count,
    'reviewerAuthorityChanged', authority_count,
    'unavailable', unavailable_count,
    'nextCursor', case when pg_catalog.cardinality(picked) > requested_batch then next_cursor end
  );
end;
$body$;

comment on function platform_private.cms_recheck_governed_reviews(jsonb) is
  'BE03c governed review recheck job run (cms.governed_review.recheck): selects the live reviews the dependency index names under (kind, ref) after the cursor, handles at most batch (500), applies cms_governed_recheck_verdict and invalidates a review that no longer holds (dependency_changed or reviewer_authority_changed) through the single-review invalidation. Idempotent; never invalidates a review that still holds; one failing review is isolated, counted unavailable and left live; answers { examined, invalidated, dependencyChanged, reviewerAuthorityChanged, unavailable, nextCursor }. Private.';

create or replace function platform_api.cms_recheck_governed_reviews(p_request jsonb)
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
    rpc_result := platform_private.cms_recheck_governed_reviews(p_request);
  exception
    -- BE03c "Slice 12 lock order": a residual deadlock or lock failure is the typed retryable CONFLICT.
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_recheck_governed_reviews(jsonb) is
  'Service-role wrapper of the governed review recheck job run (cms.governed_review.recheck). Restores the RPC context; a deadlock or lock failure is CONFLICT.';

-- SEC-2: what the functions read, held by the definer role only.
grant select on table
  platform_private.cms_governed_review_dependencies,
  platform_private.cms_governed_reviews,
  platform_private.outbox_events
  to wejammin_cms_definer;
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_recheck_governed_reviews(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_recheck_governed_reviews(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function
  platform_private.cms_recheck_governed_reviews(jsonb),
  platform_api.cms_recheck_governed_reviews(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_recheck_governed_reviews(jsonb) to service_role;

commit;
