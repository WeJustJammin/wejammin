-- DEC-108: candidate, artifact, compiler, dependency, dry-run, policy and
-- reviewer-authority drift invalidates an open or approved CMS schema review
-- (BE03a "State machine and concurrency").  The earlier activation-review
-- invalidation moved CFG setting-value reviews; those functions and the
-- existing row triggers now act on cms_schema_reviews only.  An invalidated
-- review sends its candidate back to an editable draft with its activation
-- evidence snapshot cleared, so a resubmission freezes new evidence.
-- Forward-only.
begin;

create or replace function platform_private.cms_invalidate_activation_reviews(
  p_candidate_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $body$
declare
  invalidated_count integer;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  with locked_reviews as materialized (
    select review.id
      from platform_private.cms_schema_reviews review
      join platform_private.cms_content_type_versions version_row
        on version_row.id = review.content_type_version_id
     where review.content_type_version_id = p_candidate_id
       and review.state in ('open', 'approved')
       and version_row.state in (
         'review'::platform_private.cms_definition_state,
         'approved'::platform_private.cms_definition_state
       )
     order by review.id
     for update of review
  )
  update platform_private.cms_schema_reviews review
     set state = 'invalidated',
         version = review.version + 1,
         updated_at = pg_catalog.clock_timestamp()
    from locked_reviews
   where review.id = locked_reviews.id;
  get diagnostics invalidated_count = row_count;
  if invalidated_count > 0 then
    update platform_private.cms_content_type_versions version_row
       set state = 'draft'::platform_private.cms_definition_state,
           version = version_row.version + 1,
           updated_at = pg_catalog.clock_timestamp(),
           activation_workflow_policy_key = null,
           activation_workflow_policy_version = null,
           activation_workflow_policy_hash = null,
           activation_required_decision_count = null,
           activation_required_capabilities = null,
           activation_approval_evidence_hash = null
     where version_row.id = p_candidate_id
       and version_row.state in (
         'review'::platform_private.cms_definition_state,
         'approved'::platform_private.cms_definition_state
       );
  end if;
  return invalidated_count;
end;
$body$;

create or replace function platform_private.cms_invalidate_activation_reviews_for_owner(
  p_owner_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $body$
declare
  candidate_id uuid;
  total integer := 0;
begin
  if p_owner_id is null then
    return 0;
  end if;
  for candidate_id in
    select distinct review.content_type_version_id
      from platform_private.cms_schema_reviews review
     where review.owner_id = p_owner_id
       and review.state in ('open', 'approved')
     order by review.content_type_version_id
  loop
    total := total + platform_private.cms_invalidate_activation_reviews(candidate_id);
  end loop;
  return total;
end;
$body$;

create or replace function platform_private.cms_activation_review_invalidation_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
  version_id uuid;
  old_version_id uuid;
  new_version_id uuid;
  reference_key text;
  reference_version integer;
  grant_org uuid;
  grant_person uuid;
  grant_capability text;
begin
  if tg_table_name = 'cms_content_type_versions' then
    if tg_op = 'INSERT' then
      return new;
    end if;
    if tg_op = 'DELETE' then
      perform platform_private.cms_invalidate_activation_reviews(old.id);
      return old;
    end if;
    -- Pure lifecycle bookkeeping (state, version, timestamps, activation
    -- evidence stamping) is not candidate drift; every frozen-evidence input is.
    if new.owner_id is distinct from old.owner_id
       or new.content_type_id is distinct from old.content_type_id
       or new.labels is distinct from old.labels
       or new.workflow_key is distinct from old.workflow_key
       or new.workflow_version is distinct from old.workflow_version
       or new.source_locale is distinct from old.source_locale
       or new.default_locale is distinct from old.default_locale
       or new.default_template_version_id is distinct from old.default_template_version_id
       or new.schema_artifact_id is distinct from old.schema_artifact_id
       or new.definition_hash is distinct from old.definition_hash
       or new.compatibility is distinct from old.compatibility
       or new.supersedes_id is distinct from old.supersedes_id
       or new.dry_run_id is distinct from old.dry_run_id then
      perform platform_private.cms_invalidate_activation_reviews(new.id);
    end if;
    return new;
  elsif tg_table_name = 'cms_content_types' then
    if tg_op = 'UPDATE'
       and new.owner_id is not distinct from old.owner_id
       and new.owner_capability is not distinct from old.owner_capability then
      return new;
    end if;
    for version_id in
      select version_row.id
        from platform_private.cms_content_type_versions version_row
       where version_row.content_type_id = case when tg_op = 'DELETE' then old.id else new.id end
         and version_row.state in (
           'review'::platform_private.cms_definition_state,
           'approved'::platform_private.cms_definition_state
         )
       order by version_row.id
    loop
      perform platform_private.cms_invalidate_activation_reviews(version_id);
    end loop;
    return coalesce(new, old);
  elsif tg_table_name in (
    'cms_content_type_template_bindings',
    'cms_content_type_capability_bindings',
    'cms_field_definition_versions'
  ) then
    old_version_id := case when tg_op = 'INSERT' then null else old.content_type_version_id end;
    new_version_id := case when tg_op = 'DELETE' then null else new.content_type_version_id end;
    for version_id in
      select parent_id
        from (values (new_version_id), (old_version_id)) parents(parent_id)
       where parent_id is not null
       group by parent_id
       order by parent_id
    loop
      perform platform_private.cms_invalidate_activation_reviews(version_id);
    end loop;
    return coalesce(new, old);
  elsif tg_table_name = 'cms_relation_definitions' then
    if tg_op <> 'INSERT' then
      select field.content_type_version_id into old_version_id
        from platform_private.cms_field_definition_versions field
       where field.id = old.field_definition_id;
    end if;
    if tg_op <> 'DELETE' then
      select field.content_type_version_id into new_version_id
        from platform_private.cms_field_definition_versions field
       where field.id = new.field_definition_id;
    end if;
    for version_id in
      select parent_id
        from (values (new_version_id), (old_version_id)) parents(parent_id)
       where parent_id is not null
       group by parent_id
       order by parent_id
    loop
      perform platform_private.cms_invalidate_activation_reviews(version_id);
    end loop;
    return coalesce(new, old);
  elsif tg_table_name in ('organization_actor_grant', 'membership_tenure') then
    -- An authority row moved between organizations changes the owner scope of
    -- both: every open or approved review of the old and the new organization
    -- is invalidated.
    if tg_op = 'UPDATE'
       and (pg_catalog.to_jsonb(new)->>'organization_id')
           is distinct from (pg_catalog.to_jsonb(old)->>'organization_id') then
      for grant_org in
        select moved.organization_id
          from (
            values ((pg_catalog.to_jsonb(old)->>'organization_id')::uuid),
                   ((pg_catalog.to_jsonb(new)->>'organization_id')::uuid)
          ) moved(organization_id)
         where moved.organization_id is not null
         group by moved.organization_id
         order by moved.organization_id
      loop
        perform platform_private.cms_invalidate_activation_reviews_for_owner(grant_org);
      end loop;
      return new;
    end if;
    -- Reviewer-authority drift: a counted approver's grant or membership
    -- changed.  Only reviews of that organization in which the person recorded
    -- an approval and that carry a specialist slot are affected.
    for grant_org, grant_person, grant_capability in
      select (change.row_json->>'organization_id')::uuid,
             (change.row_json->>'person_id')::uuid,
             change.row_json->>'capability_code'
        from (
          values
            (case when tg_op <> 'INSERT' then pg_catalog.to_jsonb(old) end),
            (case when tg_op <> 'DELETE' then pg_catalog.to_jsonb(new) end)
        ) change(row_json)
       where change.row_json is not null
    loop
      if grant_capability is null or grant_capability like 'cms.reviewer.%' then
        for version_id in
          select distinct review.content_type_version_id
            from platform_private.cms_schema_reviews review
            join platform_private.cms_schema_review_decisions decision
              on decision.review_id = review.id
           where review.owner_id = grant_org
             and review.state in ('open', 'approved')
             and pg_catalog.jsonb_array_length(review.required_capabilities) > 1
             and decision.decision = 'approve'
             and decision.reviewer_person_ref = grant_person
           order by review.content_type_version_id
        loop
          perform platform_private.cms_invalidate_activation_reviews(version_id);
        end loop;
      end if;
    end loop;
    return coalesce(new, old);
  elsif tg_table_name = 'cms_block_definition_lifecycle_events' then
    reference_key := case when tg_op = 'DELETE' then old.block_key else new.block_key end;
    reference_version := case when tg_op = 'DELETE' then old.block_version else new.block_version end;
    for version_id in
      select distinct review.content_type_version_id
        from platform_private.cms_schema_reviews review
        join platform_private.cms_schema_artifacts artifact
          on artifact.id = review.schema_artifact_id
         and artifact.content_type_version_id = review.content_type_version_id
       where review.state in ('open', 'approved')
         and (
           exists (
             select 1
               from pg_catalog.jsonb_array_elements(
                 coalesce(artifact.renderer_manifest->'blocks', '[]'::jsonb)
               ) entry(value)
              where pg_catalog.jsonb_typeof(entry.value) = 'object'
                and entry.value->>'blockKey' = reference_key
                and entry.value->>'blockVersion' = reference_version::text
           )
           or exists (
             select 1
               from pg_catalog.jsonb_array_elements(
                 coalesce(artifact.renderer_manifest->'blockDefinitions', '[]'::jsonb)
               ) entry(value)
              where pg_catalog.jsonb_typeof(entry.value) = 'object'
                and entry.value->>'blockKey' = reference_key
                and entry.value->>'blockVersion' = reference_version::text
           )
         )
       order by review.content_type_version_id
    loop
      perform platform_private.cms_invalidate_activation_reviews(version_id);
    end loop;
    return coalesce(new, old);
  end if;
  return coalesce(new, old);
end;
$body$;

revoke all on function platform_private.cms_invalidate_activation_reviews(uuid),
  platform_private.cms_invalidate_activation_reviews_for_owner(uuid),
  platform_private.cms_activation_review_invalidation_trigger()
  from public, anon, authenticated, service_role;

commit;
