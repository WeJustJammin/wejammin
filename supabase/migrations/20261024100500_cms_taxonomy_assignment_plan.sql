-- Slice 12 lane taxonomy-integrity: the persistence half of the 03b `taxonomy` encoder (BE03b Value encodings by field kind, taxonomy:
-- "persisted as 03c TermAssignment rows bound to the active TaxonomyVersion ... the revision's taxonomy_version_ids are the active
-- version ids of the vocabularies of its terms"; BE03c DEC-141 item 5; P2-S12-AC-246).
--
-- cms_taxonomy_value_plan(owner, schema version, source revision, values, changed field ids) is the ONE statement that decides a new
-- revision's assignments, for every command that writes a revision from a value map:
--   * a taxonomy field named in p_changed takes its terms from p_values -> termIds: one row per term in list order, position = list
--     index (a repeated termId is refused by the encoder, DEC-233; the `group by` below is a defensive dedupe only), provenance
--     `authored` (the encoder already proved each term assignable);
--   * any other taxonomy field of the pinned schema version carries the source revision's CURRENT active assignments (the highest
--     version of each (field, term) pair, read when `active`), by stable field id: same term, same position, same provenance
--     (an existing assignment to a deprecated term or a since-retired vocabulary is carried; the preflight provider reports it).
-- Every plan row carries two version ids: taxonomy_version_id, the term's own write-version, which is what the stored composite
-- foreign key (term_id, taxonomy_version_id, owner_id) pins an assignment row to, and active_version_id, the active version of the
-- term's vocabulary (the write-version when the vocabulary has none), which is what the revision records.
-- cms_taxonomy_plan_version_ids returns the plan's distinct active_version_id values, ascending bytewise (the revision's
-- taxonomy_version_ids); cms_record_term_assignments appends the plan as version-1 `active` TermAssignment rows of the new revision.
-- cms_lock_term_plan takes BE03c's Slice 12 lock-order position 6 (see its comment).
-- Private; the readers are STABLE SQL owned by the CMS definer; callers run under the CMS RPC context.  Forward-only.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_taxonomy_value_plan(
  p_owner_id uuid, p_schema_version_id uuid, p_source_revision_id uuid, p_values jsonb, p_changed text[]
)
returns table(field_definition_id uuid, term_id uuid, taxonomy_version_id uuid, active_version_id uuid, term_position integer, provenance text, is_changed boolean)
language sql
stable
set search_path = ''
as $body$
  with taxonomy_fields as (
    select field.id as definition_id, field.stable_field_id
      from platform_private.cms_field_definition_versions field
     where field.content_type_version_id = p_schema_version_id
       and field.state = 'active'
       and field.kind = 'taxonomy'
  ),
  authored as (
    select taxonomy_fields.definition_id, requested.id::uuid as term_id, pg_catalog.min(requested.ordinal) as first_ordinal
      from taxonomy_fields
      cross join lateral pg_catalog.jsonb_array_elements_text(
        case when pg_catalog.jsonb_typeof(p_values -> taxonomy_fields.stable_field_id::text -> 'termIds') = 'array'
          then p_values -> taxonomy_fields.stable_field_id::text -> 'termIds' else '[]'::jsonb end
      ) with ordinality requested(id, ordinal)
     where taxonomy_fields.stable_field_id::text = any(p_changed)
     group by taxonomy_fields.definition_id, requested.id::uuid
  ),
  authored_rows as (
    select authored.definition_id, authored.term_id,
           (pg_catalog.row_number() over (partition by authored.definition_id order by authored.first_ordinal) - 1)::integer as term_position,
           'authored'::text as provenance,
           null::uuid as recorded_version_id,
           true as is_changed
      from authored
  ),
  carried_rows as (
    select taxonomy_fields.definition_id, current_row.term_id, current_row.position as term_position,
           current_row.provenance, current_row.taxonomy_version_id as recorded_version_id,
           false as is_changed
      from taxonomy_fields
      cross join lateral (
        select distinct on (stored.field_definition_id, stored.term_id) stored.*
          from platform_private.cms_term_assignments stored
          join platform_private.cms_field_definition_versions old_field on old_field.id = stored.field_definition_id
         where stored.revision_id = p_source_revision_id
           and old_field.stable_field_id = taxonomy_fields.stable_field_id
         order by stored.field_definition_id, stored.term_id, stored.version desc
      ) current_row
     where p_source_revision_id is not null
       and current_row.state = 'active'
       and not (taxonomy_fields.stable_field_id::text = any(p_changed))
  ),
  planned as (
    select * from authored_rows union all select * from carried_rows
  )
  select planned.definition_id, planned.term_id,
         term.taxonomy_version_id,
         coalesce(
           (select active_version.id
              from platform_private.cms_taxonomy_versions active_version
             where active_version.taxonomy_id = term.taxonomy_id
               and active_version.owner_id = term.owner_id
               and active_version.state = 'active'),
           term.taxonomy_version_id),
         planned.term_position, planned.provenance, planned.is_changed
    from planned
    join platform_private.cms_terms term on term.id = planned.term_id and term.owner_id = p_owner_id
$body$;

comment on function platform_private.cms_taxonomy_value_plan(uuid, uuid, uuid, jsonb, text[]) is
  'BE03b taxonomy encoder persistence: the assignments of a new revision. Fields named in p_changed take their distinct terms from p_values in first-occurrence order; every other taxonomy field carries the source revision''s current active assignments; each row carries the term write-version (the assignment foreign key) and the vocabulary''s active version (the revision''s recorded id). Private; STABLE.';

create function platform_private.cms_taxonomy_plan_version_ids(
  p_owner_id uuid, p_schema_version_id uuid, p_source_revision_id uuid, p_values jsonb, p_changed text[]
)
returns jsonb
language sql
stable
set search_path = ''
as $body$
  select coalesce(
    pg_catalog.jsonb_agg(bound.version_id order by bound.version_id::text collate "C"),
    '[]'::jsonb)
  from (
    select distinct plan.active_version_id as version_id
      from platform_private.cms_taxonomy_value_plan(
             p_owner_id, p_schema_version_id, p_source_revision_id, p_values, p_changed) plan
     where plan.active_version_id is not null
  ) bound
$body$;

comment on function platform_private.cms_taxonomy_plan_version_ids(uuid, uuid, uuid, jsonb, text[]) is
  'BE03b: the distinct taxonomy version ids a revision''s assignment plan binds, ascending bytewise (the revision''s taxonomy_version_ids). Private; STABLE.';

create function platform_private.cms_record_term_assignments(
  p_revision_id uuid, p_owner_id uuid, p_actor_id uuid,
  p_schema_version_id uuid, p_source_revision_id uuid, p_values jsonb, p_changed text[]
)
returns integer
language plpgsql
set search_path = ''
as $body$
declare
  written integer;
begin
  insert into platform_private.cms_term_assignments(
    owner_id, state, version, revision_id, field_definition_id, term_id,
    taxonomy_version_id, position, provenance, created_by
  )
  select p_owner_id, 'active', 1, p_revision_id, plan.field_definition_id, plan.term_id,
         plan.taxonomy_version_id, plan.term_position, plan.provenance, p_actor_id
    from platform_private.cms_taxonomy_value_plan(
           p_owner_id, p_schema_version_id, p_source_revision_id, p_values, p_changed) plan
   where plan.taxonomy_version_id is not null;
  get diagnostics written = row_count;
  return written;
end;
$body$;

comment on function platform_private.cms_record_term_assignments(uuid, uuid, uuid, uuid, uuid, jsonb, text[]) is
  'BE03b: appends the revision''s TermAssignment plan as version-1 active rows. Private; callers run under the CMS RPC context (the forced-RLS write policy and write guard).';

create function platform_private.cms_lock_term_plan(
  p_owner_id uuid, p_schema_version_id uuid, p_source_revision_id uuid, p_values jsonb, p_changed text[]
)
returns void
language plpgsql
set search_path = ''
as $body$
declare
  v_type_key text;
  v_refused uuid;
begin
  -- BE03c "Slice 12 lock order", position 6: the cms_terms rows an entry writer assigns, FOR SHARE, ascending id, so that a term merge
  -- (FOR UPDATE on the same rows) serializes with the assignment.  A lock timeout or a deadlock victim is the typed retryable 409.
  begin
    perform 1
      from platform_private.cms_terms term
     where term.id in (
       select plan.term_id
         from platform_private.cms_taxonomy_value_plan(
                p_owner_id, p_schema_version_id, p_source_revision_id, p_values, p_changed) plan)
     order by term.id
       for share;
  exception when lock_not_available or deadlock_detected then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  -- Plan drift under a waited lock is harmless: the plan above is read in the snapshot of the locking statement, so a term whose merge
  -- committed while this statement waited is locked (the row version is re-checked) but its survivor, which the fresh plan read by
  -- cms_record_term_assignments now names, is not.  A survivor needs no lock for exclusion: a merge refuses a term that already has an
  -- inbound redirect (cms_term_apply_merge, 20261014120400: `redirected.successor_id = retired.id` is CONFLICT), so a survivor can never itself
  -- be merged; a concurrent deprecation of the survivor is tolerated for an existing assignment (BE03c 1574).
  -- Re-check the authored terms under the lock: a merge or deprecation that committed between the encoder check and the lock refuses
  -- the write with the same uniform reason (the revision insert rolls back with the command).
  select content_type.type_key into v_type_key
    from platform_private.cms_content_type_versions type_version
    join platform_private.cms_content_types content_type on content_type.id = type_version.content_type_id
   where type_version.id = p_schema_version_id;
  select field.stable_field_id into v_refused
    from platform_private.cms_taxonomy_value_plan(
           p_owner_id, p_schema_version_id, p_source_revision_id, p_values, p_changed) plan
    join platform_private.cms_field_definition_versions field on field.id = plan.field_definition_id
   where plan.is_changed
     and not coalesce(
       platform_private.cms_term_assignable(p_owner_id, v_type_key, field.field_key, plan.term_id)
       or platform_private.cms_term_existing_deprecated(p_owner_id, p_source_revision_id, field.stable_field_id, plan.term_id),
       false)
   order by field.stable_field_id, plan.term_id
   limit 1;
  if v_refused is not null then
    raise exception 'term_unavailable' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_array('/fields/' || v_refused::text)::text;
  end if;
end;
$body$;

comment on function platform_private.cms_lock_term_plan(uuid, uuid, uuid, jsonb, text[]) is
  'BE03c Slice 12 lock order position 6: locks the terms of a revision''s assignment plan FOR SHARE in ascending id order (lock timeout or deadlock victim -> CONFLICT), then re-checks the authored terms under the lock (term_unavailable with the field pointer). Private; callers run under the CMS RPC context.';

grant select on table platform_private.cms_term_assignments to wejammin_cms_definer;
grant insert on table platform_private.cms_term_assignments to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_taxonomy_value_plan(uuid, uuid, uuid, jsonb, text[]) owner to wejammin_cms_definer;
alter function platform_private.cms_taxonomy_plan_version_ids(uuid, uuid, uuid, jsonb, text[]) owner to wejammin_cms_definer;
alter function platform_private.cms_record_term_assignments(uuid, uuid, uuid, uuid, uuid, jsonb, text[]) owner to wejammin_cms_definer;
alter function platform_private.cms_lock_term_plan(uuid, uuid, uuid, jsonb, text[]) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_taxonomy_value_plan(uuid, uuid, uuid, jsonb, text[])
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_taxonomy_plan_version_ids(uuid, uuid, uuid, jsonb, text[])
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_record_term_assignments(uuid, uuid, uuid, uuid, uuid, jsonb, text[])
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_lock_term_plan(uuid, uuid, uuid, jsonb, text[])
  from public, anon, authenticated, service_role;

commit;
