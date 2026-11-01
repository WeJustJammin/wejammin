-- CMS-03B-17 (BE03b Route Registry, tracker P2-S11-AC-064; reads bench 128, review A A-M9): the reviewer queue reader no
-- longer depends on the planner's row estimates to stay linear.
--
-- THE DEFECT.  The first canonical gate that ran supabase/tests/phase_02_slice_11_reads_bench128.sql sat in ONE statement,
-- the CMS-03B-17 first page, for 63 minutes before it was terminated; the same file had measured a 23 ms p95 on a fresh
-- database.  The page query joined platform_private.cms_editorial_reviews TWICE (review_scoped inside the assignment arm,
-- review_item again after the union) and drove it from the caller's assignment rows.  After a few minutes of the suite,
-- autovacuum has ANALYZEd the CMS tables while every fixture of every earlier file was rolled back, so pg_class holds
-- "pages, no live rows" (relpages > 0, reltuples = 0): the planner then estimates ONE row for every table, and every join
-- order, nested loop and UNPARAMETERIZED index scan looks free.  It chose review_item(503) x [assignment(201) x
-- review_scoped(503, a full index scan per assignment row)]: 27,079,512 tuples per call, 65 s per call on a quiet host, every
-- tuple passing the row-level-security quals.  supabase/tests/phase_02_slice_11_reads_plan_stability.sql reproduces exactly
-- that statistics state and fails on it.  The relationship policies of 20261010170200 are NOT the cause: with all nine
-- dropped the same state takes 62.6 s against 65.0 s, because the quals cost the same microsecond per row either way and
-- the definer is exempt from the relationship test; the query shape was latent since CMS-03B-17 was written.
--
-- THE FIX (three changes to the page statement; nothing else in the reader, its signature, volatility, owner, ACL or
-- search_path moves):
--   1. The caller's active assignments are read FIRST, on their own, as one array of review ids (one index range scan of
--      the reviewer's rows: cms_editorial_review_assignments_reviewer_state_ends_idx or the active-reviewer index).  The
--      review arm is then a single-relation probe `review.id = any (ids)`: there is no join clause between the two
--      big tables, so the planner has no join order, no unparameterized inner scan and no mergejoin-ordered full index
--      scan to choose wrongly, whatever it believes about their sizes.  The work is the caller's assignment count plus
--      the probes, linear by construction.
--   2. The redundant second join to cms_editorial_reviews is gone: the arms already carry every review column the page
--      needs, so the review table is read once per arm.
--   3. The keyset order and LIMIT apply to the review rows BEFORE the four decoration joins (revision, entry, content type,
--      content type version), so those joins run for at most limit + 1 = 51 rows, and the reviewer's assignment end is
--      looked up per page row (the active-reviewer unique index returns at most one row per review and reviewer).  The
--      decoration joins are inner joins on columns that are NOT NULL and enforced by foreign keys (review.entry_id,
--      review.revision_id -> revision.id, revision.schema_version_id, entry.content_type_id), so applying them after the
--      LIMIT returns exactly the rows applying them before it did.
-- The assignment owner equals the review owner by the composite foreign key
-- cms_editorial_review_assignments_review_owner_fkey (review_id, owner_id), so filtering the assignments by the acting
-- party is the filter the review arm already applied; the review arm keeps its own owner filter.
--
-- Only the two listed anchors of the installed body change (the installed source is pinned by MD5 and the replacement is
-- proved reversible); the owner, ACL, search_path, comment and every other pg_proc attribute are preserved.  The
-- SECURITY DEFINER read stays tenant-scoped under the CMS definer role exactly as DEC-174 fixed it: no policy changes.
-- Forward-only: rollback is a reviewed forward migration restoring the prior definition.
begin;
set local lock_timeout = '5s';

do $migration$
declare
  identity text := 'platform_private.cms_list_editorial_reviews(jsonb)';
  cms_owner oid := 'wejammin_cms_definer'::pg_catalog.regrole;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  original_definition text;
  replacement_definition text;
  actual_definition text;
  replacement_source text;
  inverse_source text;
  original_metadata jsonb;
  original_comment text;
  old_declare text := $old$  page_max timestamptz;
  next_cursor text;
begin
$old$;
  new_declare text := $new$  page_max timestamptz;
  next_cursor text;
  assigned_review_ids uuid[] := array[]::uuid[];
begin
$new$;
  old_query text := $old$    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(page_row) order by page_row.key_ts desc, page_row.review_id desc),
                    '[]'::jsonb)
      into page_rows
      from (
        select scoped.review_id, scoped.key_ts, scoped.assignment_ends_at,
               review_item.entry_id, review_item.revision_id, review_item.state, review_item.risk_class,
               review_item.required_decision_count, review_item.recorded_decision_count,
               review_item.submitted_at, review_item.updated_at,
               revision_item.revision_number, revision_item.locale,
               pg_catalog.left(
                 coalesce(nullif(pg_catalog.btrim(version_item.labels->>'label'), ''), type_item.type_key), 120
               ) as content_type_label,
               coalesce((
                 select decision_item.decision
                   from platform_private.cms_editorial_decisions decision_item
                  where decision_item.review_id = review_item.id
                    and decision_item.reviewer_person_id = person
                  limit 1
               ), 'none') as my_decision
          from (
            select assigned.review_id, assigned.assignment_ends_at,
                   pg_catalog.date_trunc('milliseconds', assigned.updated_at) as key_ts
              from (
                select assignment_item.review_id, assignment_item.ends_at as assignment_ends_at, review_scoped.updated_at
                  from platform_private.cms_editorial_review_assignments assignment_item
                  join platform_private.cms_editorial_reviews review_scoped on review_scoped.id = assignment_item.review_id
                 where scope_value = 'assigned'
                   and assignment_item.reviewer_person_id = person
                   and assignment_item.state = 'active'
                   and review_scoped.owner_id = acting_party_id
                   and (state_value is null or review_scoped.state = state_value)
              ) assigned
            union all
            select submitted.id, null::timestamptz,
                   pg_catalog.date_trunc('milliseconds', submitted.updated_at)
              from platform_private.cms_editorial_reviews submitted
             where scope_value = 'submitted'
               and submitted.submitted_by = person
               and submitted.owner_id = acting_party_id
               and (state_value is null or submitted.state = state_value)
          ) scoped(review_id, assignment_ends_at, key_ts)
          join platform_private.cms_editorial_reviews review_item on review_item.id = scoped.review_id
          join platform_private.cms_entry_revisions revision_item on revision_item.id = review_item.revision_id
          join platform_private.cms_content_entries entry_item on entry_item.id = review_item.entry_id
          join platform_private.cms_content_types type_item on type_item.id = entry_item.content_type_id
          join platform_private.cms_content_type_versions version_item on version_item.id = revision_item.schema_version_id
         where cursor_text is null
            or (scoped.key_ts, scoped.review_id) < (cursor_ts, cursor_id)
         order by scoped.key_ts desc, scoped.review_id desc
         limit limit_value + 1
      ) page_row;
$old$;
  new_query text := $new$    -- BOUNDED WORK (20261010171000).  The caller's active assignments are read on their own, first: one array of review ids.
    -- The review arm below is a single-relation probe by id, so no join order can multiply the review and assignment
    -- tables whatever the planner believes about their sizes (stale statistics made it believe one row each and read 27
    -- million tuples per call).  The keyset order and LIMIT apply before the decoration joins.
    if scope_value = 'assigned' then
      select coalesce(pg_catalog.array_agg(assignment_item.review_id), array[]::uuid[])
        into assigned_review_ids
        from platform_private.cms_editorial_review_assignments assignment_item
       where assignment_item.reviewer_person_id = person
         and assignment_item.state = 'active'
         and assignment_item.owner_id = acting_party_id;
    end if;
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(page_row) order by page_row.key_ts desc, page_row.review_id desc),
                    '[]'::jsonb)
      into page_rows
      from (
        select scoped.review_id, scoped.key_ts,
               case when scope_value = 'assigned' then (
                 select assignment_item.ends_at
                   from platform_private.cms_editorial_review_assignments assignment_item
                  where assignment_item.review_id = scoped.review_id
                    and assignment_item.reviewer_person_id = person
                    and assignment_item.state = 'active'
               ) end as assignment_ends_at,
               scoped.entry_id, scoped.revision_id, scoped.state, scoped.risk_class,
               scoped.required_decision_count, scoped.recorded_decision_count,
               scoped.submitted_at, scoped.updated_at,
               revision_item.revision_number, revision_item.locale,
               pg_catalog.left(
                 coalesce(nullif(pg_catalog.btrim(version_item.labels->>'label'), ''), type_item.type_key), 120
               ) as content_type_label,
               coalesce((
                 select decision_item.decision
                   from platform_private.cms_editorial_decisions decision_item
                  where decision_item.review_id = scoped.review_id
                    and decision_item.reviewer_person_id = person
                  limit 1
               ), 'none') as my_decision
          from (
            select both_arms.*
              from (
                select review_scoped.id as review_id,
                       pg_catalog.date_trunc('milliseconds', review_scoped.updated_at) as key_ts,
                       review_scoped.entry_id, review_scoped.revision_id, review_scoped.state, review_scoped.risk_class,
                       review_scoped.required_decision_count, review_scoped.recorded_decision_count,
                       review_scoped.submitted_at, review_scoped.updated_at
                  from platform_private.cms_editorial_reviews review_scoped
                 where scope_value = 'assigned'
                   and review_scoped.id = any (assigned_review_ids)
                   and review_scoped.owner_id = acting_party_id
                   and (state_value is null or review_scoped.state = state_value)
                union all
                select submitted.id,
                       pg_catalog.date_trunc('milliseconds', submitted.updated_at),
                       submitted.entry_id, submitted.revision_id, submitted.state, submitted.risk_class,
                       submitted.required_decision_count, submitted.recorded_decision_count,
                       submitted.submitted_at, submitted.updated_at
                  from platform_private.cms_editorial_reviews submitted
                 where scope_value = 'submitted'
                   and submitted.submitted_by = person
                   and submitted.owner_id = acting_party_id
                   and (state_value is null or submitted.state = state_value)
              ) both_arms
             where cursor_text is null
                or (both_arms.key_ts, both_arms.review_id) < (cursor_ts, cursor_id)
             order by both_arms.key_ts desc, both_arms.review_id desc
             limit limit_value + 1
          ) scoped
          join platform_private.cms_entry_revisions revision_item on revision_item.id = scoped.revision_id
          join platform_private.cms_content_entries entry_item on entry_item.id = scoped.entry_id
          join platform_private.cms_content_types type_item on type_item.id = entry_item.content_type_id
          join platform_private.cms_content_type_versions version_item on version_item.id = revision_item.schema_version_id
      ) page_row;
$new$;
begin
  if not exists (
    select 1 from pg_catalog.pg_roles role
     where role.oid = cms_owner
       and not role.rolcanlogin and not role.rolsuper and not role.rolbypassrls
  ) or pg_catalog.has_schema_privilege(cms_owner, 'platform_private', 'CREATE') then
    raise exception 'CMS queue reader owner baseline mismatch' using errcode = '55000';
  end if;

  select proc.* into original
    from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'CMS queue reader function missing' using errcode = '55000';
  end if;
  original_definition := pg_catalog.pg_get_functiondef(original.oid);
  if pg_catalog.md5(original.prosrc) is distinct from '0661c70b7149cae7aa328232753e822f'
     or pg_catalog.md5(original_definition) is distinct from '0ca3c49c24d32d3ee4f6216de530d48d'
     or original.proowner is distinct from cms_owner
     or original.prokind is distinct from 'f'
     or original.provolatile is distinct from 'v'
     or original.prosecdef is distinct from true
     or original.proisstrict is distinct from false
     or original.proleakproof is distinct from false
     or original.proparallel is distinct from 'u'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.proacl is distinct from
       array['wejammin_cms_definer=X/wejammin_cms_definer']::pg_catalog.aclitem[]
     or original.pronargs is distinct from 1
     or original.prorettype is distinct from 'jsonb'::pg_catalog.regtype
     or original.proretset is distinct from false
     or original.prolang is distinct from (
       select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql'
     ) then
    raise exception 'CMS queue reader function baseline mismatch (installed source md5 %, definition md5 %)',
      pg_catalog.md5(original.prosrc), pg_catalog.md5(original_definition) using errcode = '55000';
  end if;
  original_metadata := pg_catalog.to_jsonb(original) - 'prosrc';
  original_comment := pg_catalog.obj_description(original.oid, 'pg_proc');
  if (pg_catalog.length(original_definition) - pg_catalog.length(
        pg_catalog.replace(original_definition, original.prosrc, '')
      )) / pg_catalog.length(original.prosrc) <> 1 then
    raise exception 'CMS queue reader definition shape mismatch' using errcode = '55000';
  end if;

  -- Both anchors occur exactly once in the installed body and neither replacement text is already there.
  if (pg_catalog.length(original.prosrc) - pg_catalog.length(
        pg_catalog.replace(original.prosrc, old_declare, '')
      )) / pg_catalog.length(old_declare) <> 1
     or (pg_catalog.length(original.prosrc) - pg_catalog.length(
        pg_catalog.replace(original.prosrc, old_query, '')
      )) / pg_catalog.length(old_query) <> 1
     or pg_catalog.strpos(original.prosrc, new_declare) <> 0
     or pg_catalog.strpos(original.prosrc, new_query) <> 0 then
    raise exception 'CMS queue reader anchor mismatch' using errcode = '55000';
  end if;
  replacement_source := pg_catalog.replace(pg_catalog.replace(original.prosrc, old_declare, new_declare), old_query, new_query);
  -- Inverse proof: undoing both replacements restores the installed source byte for byte, so the two anchors are the ONLY
  -- body change.
  inverse_source := pg_catalog.replace(pg_catalog.replace(replacement_source, new_query, old_query), new_declare, old_declare);
  if (pg_catalog.length(replacement_source) - pg_catalog.length(
        pg_catalog.replace(replacement_source, new_declare, '')
      )) / pg_catalog.length(new_declare) <> 1
     or (pg_catalog.length(replacement_source) - pg_catalog.length(
        pg_catalog.replace(replacement_source, new_query, '')
      )) / pg_catalog.length(new_query) <> 1
     or inverse_source is distinct from original.prosrc then
    raise exception 'CMS queue reader source inverse mismatch' using errcode = '55000';
  end if;

  replacement_definition := pg_catalog.replace(original_definition, original.prosrc, replacement_source);
  if (pg_catalog.length(replacement_definition) - pg_catalog.length(
        pg_catalog.replace(replacement_definition, replacement_source, '')
      )) / pg_catalog.length(replacement_source) <> 1
     or pg_catalog.replace(replacement_definition, replacement_source, original.prosrc)
       is distinct from original_definition then
    raise exception 'CMS queue reader definition inverse mismatch' using errcode = '55000';
  end if;

  execute replacement_definition;

  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = original.oid;
  if not found then
    raise exception 'CMS queue reader replacement missing' using errcode = '55000';
  end if;
  actual_definition := pg_catalog.pg_get_functiondef(actual.oid);
  inverse_source := pg_catalog.replace(pg_catalog.replace(actual.prosrc, new_query, old_query), new_declare, old_declare);
  if actual.prosrc is distinct from replacement_source
     or (pg_catalog.to_jsonb(actual) - 'prosrc') is distinct from original_metadata
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from original_comment
     or actual_definition is distinct from replacement_definition
     or inverse_source is distinct from original.prosrc
     or pg_catalog.replace(actual_definition, actual.prosrc, inverse_source)
       is distinct from original_definition then
    raise exception 'CMS queue reader preservation mismatch' using errcode = '55000';
  end if;
end;
$migration$;

commit;
