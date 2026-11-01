-- Slice 12 lane linked-scan (BE03c "Linked update (diff, accept, detach)", "Job transport (DEC-166, DEC-180 G9)", "Slice 12 lock order" row
-- `cms.pattern.linked_update_scan`, Canonical records "every composition write ... the linked-update scan"; tracker P2-S12-AC-212,
-- AC-213): the database half of the typed platform-queue job `cms.pattern.linked_update_scan`.
--
--   platform_private.cms_scan_linked_pattern_updates(request) returns { examined, appended, nextCursor }
--       One bounded run.  The request is cms_linked_scan_request (the job payload { patternId, patternVersionId }, the continuation
--       cursor, optional batch <= 500 and correlationId).  The version must be a real version of that lineage (NOT_FOUND otherwise);
--       a version that is no longer `active` (superseded or retired since the event, or a draft) is a quiet no-op: the scan of its
--       successor covers every instance.
--       Candidates: the NEWEST row of each composition path whose instance is `linked` to this lineage, in state `active` (or
--       `pending_diff` waiting for an OLDER version), pinned to an OLDER version than the activated one, on the CURRENT DRAFT
--       revision of an `active` entry whose effective state is draft (BE03b E2: a reviewed, submitted, scheduled or published revision
--       keeps its pin as history, and so does the revision an entry no longer holds as its current draft) and whose content type is
--       in the version's compatibleTypeIds.  In ascending entry id, then bytewise path, after the cursor, at most `batch` of them.
--       Per entry, in ascending id (BE03c "Slice 12 lock order"): 0 the entry row FOR UPDATE, 3 the activated pattern version row FOR
--       SHARE, 4 the revision's content-type version row FOR SHARE, then the candidates are re-read UNDER the locks and, when one
--       still qualifies, 5 the revision's live editorial review rows FOR UPDATE; each qualifying instance gets a new `pending_diff` row
--       (next version, pinned to the UNCHANGED version, pending_pattern_version = the activated version, position and every other
--       member of the head unchanged, DEC-185) and the live reviews are invalidated dependency_changed in the same transaction.
--       Idempotent: an instance already waiting for this version or a newer one is no candidate, so a re-delivery appends nothing;
--       an instance waiting for an OLDER version gets a newer pending row (the spec appends for every instance whose pinned version is
--       older).  nextCursor is the last instance taken and is non-null only when a further candidate remains.
--       The row is written by the shared helper cms_pattern_update_next_row ('pending' action, 20261022110050), the one place that copies a head.
-- Depends on (promote after): cms_composition_instances.pending_pattern_version (pattern-updates 20261014140000), carried_from_id and
-- position (the Slice 12 composition migrations); plpgsql resolves record members at run time, so a missing column fails the first run, not the promotion.
-- Private SECURITY DEFINER of the CMS definer role with an empty search_path.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function platform_private.cms_scan_linked_pattern_updates(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_req jsonb;
  v_batch integer;
  v_cursor_entry uuid;
  v_cursor_path text;
  v_correlation uuid;
  v_target platform_private.cms_pattern_versions%rowtype;
  v_pick_entries uuid[];
  v_pick_paths text[];
  v_count integer;
  v_entry_id uuid;
  v_entry platform_private.cms_content_entries%rowtype;
  v_revision platform_private.cms_entry_revisions%rowtype;
  v_paths text[];
  v_path text;
  v_head platform_private.cms_composition_instances%rowtype;
  v_heads platform_private.cms_composition_instances[];
  v_new platform_private.cms_composition_instances;
  v_review_id uuid;
  v_now timestamptz;
  v_appended integer := 0;
  v_next text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  v_req := platform_private.cms_linked_scan_request(p_request);
  v_batch := (v_req->>'batch')::integer;
  if v_req->>'cursorEntry' is not null then
    v_cursor_entry := (v_req->>'cursorEntry')::uuid;
    v_cursor_path := v_req->>'cursorPath';
  end if;

  select * into v_target from platform_private.cms_pattern_versions version_row
   where version_row.id = (v_req->>'versionId')::uuid and version_row.pattern_id = (v_req->>'patternId')::uuid;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_target.state <> 'active' then
    return pg_catalog.jsonb_build_object('examined', 0, 'appended', 0, 'nextCursor', null);
  end if;
  v_correlation := coalesce((v_req->>'correlationId')::uuid, platform_private.cms_trigger_correlation());

  -- One more than the bound: its presence is what makes the run continue.
  select coalesce(pg_catalog.array_agg(candidate.entry_id order by candidate.entry_id, candidate.path collate "C"), array[]::uuid[]),
         coalesce(pg_catalog.array_agg(candidate.path order by candidate.entry_id, candidate.path collate "C"), array[]::text[])
    into v_pick_entries, v_pick_paths
    from (
      select entry_row.id as entry_id, head.path as path
        from platform_private.cms_composition_instances head
        join platform_private.cms_entry_revisions revision_row on revision_row.id = head.revision_id
        join platform_private.cms_content_entries entry_row on entry_row.id = revision_row.entry_id
       where head.pattern_id = v_target.pattern_id and head.owner_id = v_target.owner_id
         and head.link_mode = 'linked' and head.state in ('active', 'pending_diff')
         and head.pattern_version < v_target.version
         and (head.state <> 'pending_diff' or head.pending_pattern_version < v_target.version)
         and not exists (select 1 from platform_private.cms_composition_instances newer
                          where newer.revision_id = head.revision_id and newer.path = head.path and newer.version > head.version)
         and entry_row.lifecycle = 'active' and entry_row.current_draft_revision_id = head.revision_id
         and exists (select 1 from pg_catalog.jsonb_array_elements_text(v_target.compatible_type_ids) listed(value)
                      where pg_catalog.lower(listed.value) = pg_catalog.lower(entry_row.content_type_id::text))
         and platform_private.cms_revision_effective_state(head.revision_id) = 'draft'
         and (v_cursor_entry is null or entry_row.id > v_cursor_entry
              or (entry_row.id = v_cursor_entry and head.path collate "C" > v_cursor_path collate "C"))
       order by entry_row.id, head.path collate "C"
       limit v_batch + 1
    ) candidate;

  v_count := least(pg_catalog.cardinality(v_pick_entries), v_batch);
  if pg_catalog.cardinality(v_pick_entries) > v_batch then
    v_next := v_pick_entries[v_count]::text || '.'
      || pg_catalog.encode(pg_catalog.convert_to(v_pick_paths[v_count], 'UTF8'), 'hex');
  end if;

  for v_entry_id in
    select distinct picked.entry_id
      from pg_catalog.unnest(v_pick_entries[1:v_count]) picked(entry_id)
     order by picked.entry_id
  loop
    -- per entry, in ascending entry id, the positions 0, 3, 4 and 5 in turn (position 0: the entry row)
    select * into v_entry from platform_private.cms_content_entries entry_row where entry_row.id = v_entry_id for update;
    if not found or v_entry.lifecycle <> 'active' or v_entry.current_draft_revision_id is null then
      continue;
    end if;
    select * into v_revision from platform_private.cms_entry_revisions revision_row
     where revision_row.id = v_entry.current_draft_revision_id;
    -- position 3: the pattern version row the write pins, which must still be the active one
    perform 1 from platform_private.cms_pattern_versions locked where locked.id = v_target.id and locked.state = 'active' for share;
    if not found then
      continue;
    end if;
    -- position 4: the entry's content-type version row
    perform 1 from platform_private.cms_content_type_versions type_version where type_version.id = v_revision.schema_version_id for share;
    -- the predicates again, now stable under the entry lock
    if platform_private.cms_revision_effective_state(v_revision.id) is distinct from 'draft'
       or not exists (select 1 from pg_catalog.jsonb_array_elements_text(v_target.compatible_type_ids) listed(value)
                       where pg_catalog.lower(listed.value) = pg_catalog.lower(v_entry.content_type_id::text)) then
      continue;
    end if;

    v_heads := array[]::platform_private.cms_composition_instances[];
    select coalesce(pg_catalog.array_agg(v_pick_paths[picked.position_no] order by v_pick_paths[picked.position_no] collate "C"),
                    array[]::text[]) into v_paths
      from pg_catalog.generate_series(1, v_count) picked(position_no)
     where v_pick_entries[picked.position_no] = v_entry_id;
    foreach v_path in array v_paths loop
      select * into v_head from platform_private.cms_composition_instances head_row
       where head_row.revision_id = v_revision.id and head_row.path = v_path order by head_row.version desc limit 1;
      if found and v_head.pattern_id = v_target.pattern_id and v_head.owner_id = v_target.owner_id
         and v_head.link_mode = 'linked' and v_head.state in ('active', 'pending_diff')
         and v_head.pattern_version < v_target.version
         and (v_head.state <> 'pending_diff' or v_head.pending_pattern_version < v_target.version) then
        v_heads := pg_catalog.array_append(v_heads, v_head);
      end if;
    end loop;
    if pg_catalog.cardinality(v_heads) = 0 then
      continue;
    end if;

    -- position 5: the revision's live editorial review rows, because this write invalidates them
    perform 1 from platform_private.cms_editorial_reviews review_row
     where review_row.revision_id = v_revision.id and review_row.state in ('open', 'approved')
     order by review_row.id for update;
    v_now := pg_catalog.clock_timestamp();
    foreach v_head in array v_heads loop
      -- the one shared row writer (review V6-01): the 'pending' action of the append helper, never a second copy of the head copy
      v_new := platform_private.cms_pattern_update_next_row(
        v_head, 'pending', pg_catalog.jsonb_build_object('target', v_target.version), null, null, null, v_now);
      insert into platform_private.cms_composition_instances select (v_new).*;
      v_appended := v_appended + 1;
    end loop;
    for v_review_id in
      select review_row.id from platform_private.cms_editorial_reviews review_row
       where review_row.revision_id = v_revision.id and review_row.state in ('open', 'approved')
       order by review_row.id
    loop
      perform platform_private.cms_invalidate_editorial_review(pg_catalog.jsonb_build_object(
        'reviewId', v_review_id, 'reasonCode', 'dependency_changed', 'correlationId', v_correlation));
    end loop;
  end loop;

  return pg_catalog.jsonb_build_object('examined', v_count, 'appended', v_appended, 'nextCursor', v_next);
end;
$body$;

comment on function platform_private.cms_scan_linked_pattern_updates(jsonb) is
  'BE03c linked-update scan job run (cms.pattern.linked_update_scan): for the activated pattern version, appends a pending_diff row (pinned to the unchanged version, pending_pattern_version set, position unchanged) for each linked instance on the current draft revision of an active entry whose pin is older and whose type is compatible, in ascending entry id then path, at most batch (500) per run with a continuation cursor; locks in the Slice 12 order; invalidates the revision''s live editorial review in the same transaction. Idempotent; answers { examined, appended, nextCursor }. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_scan_linked_pattern_updates(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_scan_linked_pattern_updates(jsonb) from public, anon, authenticated, service_role;

-- SEC-2: what the scan reads and writes, held by the definer role only.
grant select, insert on table platform_private.cms_composition_instances to wejammin_cms_definer;
grant select, update on table platform_private.cms_content_entries to wejammin_cms_definer;
grant select on table platform_private.cms_entry_revisions, platform_private.cms_pattern_versions,
  platform_private.cms_content_type_versions to wejammin_cms_definer;
grant select, update on table platform_private.cms_editorial_reviews to wejammin_cms_definer;

-- Privilege closure: every function the scan calls directly must be executable by the definer; only what is missing is granted.
do $closure$
declare
  callee text;
  callee_oid regprocedure;
begin
  foreach callee in array array[
    'platform_private.cms_linked_scan_request(jsonb)', 'platform_private.cms_revision_effective_state(uuid)',
    'platform_private.cms_invalidate_editorial_review(jsonb)', 'platform_private.cms_trigger_correlation()',
    'platform_private.cms_pattern_update_next_row(platform_private.cms_composition_instances,text,jsonb,jsonb,text,uuid,timestamp with time zone)',
    'extensions.gen_random_uuid()'
  ] loop
    callee_oid := pg_catalog.to_regprocedure(callee);
    if callee_oid is null then
      raise exception 'linked scan callee is missing: %', callee using errcode = '55000';
    end if;
    if not pg_catalog.has_function_privilege('wejammin_cms_definer', callee_oid, 'EXECUTE') then
      execute pg_catalog.format('grant execute on function %s to wejammin_cms_definer', callee_oid::text);
    end if;
  end loop;
end;
$closure$;

commit;
