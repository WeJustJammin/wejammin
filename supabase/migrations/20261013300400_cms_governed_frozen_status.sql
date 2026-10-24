-- Slice 12 lane L1 (BE03c "Governed review machinery", "Governed policy basis", "Governed activation,
-- retirement and scheduled activation", "Invalidation"; tracker P2-S12-AC-199 .. AC-203, AC-208 .. AC-210):
-- the frozen dependency identities of a governed subject, the recomputed block digest, the DEC-157 lock of the
-- dependency graph and the ONE currency test every governed command and the recheck job apply.
--
--   cms_governed_dependency_refs(kind, owner, subject)   the identities a review freezes: `block` (each reachable
--       block record), `pattern` (each nested pattern version), `content_type` (each bound content type's ACTIVE
--       version id) and `canonical_domain` (the current provider registry row of each declared domain)
--   cms_governed_current_digest(kind, owner, subject)   the block registry digest recomputed over the reachable
--       tuple set (template: the 03c block digest; pattern: the same tuple fold over the expanded tree; NULL for a
--       taxonomy version).  A missing, withdrawn or incompatible block raises, as the template digest does.
--   cms_governed_lock_graph(kind, owner, subject)   BE03c lock positions 3 and 4 after the subject row: the nested
--       pattern version rows and the bound content-type version rows FOR SHARE, ascending id.
--   cms_governed_frozen_status(review)   'current' or 'changed': the subject hash and state are still the frozen
--       ones, the policy basis hash and slots are unchanged, the dependency identities are the stored set, the
--       digest still equals the stored one (a block withdrawn or no longer compatible changes it), every nested
--       pattern is still active and every bound content type still has an active version.  A NULL workflow-policy
--       evidence is not a change: it raises DEPENDENCY_UNAVAILABLE (fail closed, 503).
-- Private; SECURITY DEFINER; owned by the CMS definer role.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_dependency_refs(
  p_kind text, p_owner_id uuid, p_subject jsonb
)
returns table(dependency_kind text, dependency_ref uuid)
language plpgsql
stable
security definer
set search_path = ''
as $body$
begin
  if p_kind = 'template_version' then
    return query
      select 'block'::text, block_item.id
        from (
          select distinct reference.value->>'blockKey' as block_key,
                          (reference.value->>'blockVersion')::integer as block_version
            from pg_catalog.jsonb_array_elements(coalesce(p_subject->'slots', '[]'::jsonb)) slot(value)
            cross join lateral pg_catalog.jsonb_array_elements(
              coalesce(slot.value->'allowedBlocks', '[]'::jsonb)) reference(value)
        ) refs
        join platform_private.cms_block_definition_versions block_item
          on block_item.block_key = refs.block_key
         and block_item.block_version = refs.block_version
         and block_item.state = 'registered';
  elsif p_kind = 'pattern_version' then
    return query
      select 'block'::text, block_item.id
        from (
          select distinct closure.block_key, closure.block_version
            from platform_private.cms_governed_pattern_closure(p_owner_id, p_subject->'blockTree') closure
           where closure.item_kind = 'block'
        ) refs
        join platform_private.cms_block_definition_versions block_item
          on block_item.block_key = refs.block_key
         and block_item.block_version = refs.block_version
         and block_item.state = 'registered';
    return query
      select distinct 'pattern'::text, closure.nested_id
        from platform_private.cms_governed_pattern_closure(p_owner_id, p_subject->'blockTree') closure
       where closure.item_kind = 'pattern' and closure.nested_id is not null;
  end if;
  return query
    select 'content_type'::text, bound.version_id
      from platform_private.cms_governed_bound_versions(p_kind, p_owner_id, p_subject) bound;
  if p_kind = 'taxonomy_version' then
    return query
      select 'canonical_domain'::text, current_row.registry_id
        from pg_catalog.jsonb_array_elements_text(coalesce(p_subject->'canonicalDomains', '[]'::jsonb)) declared(value)
        cross join lateral platform_private.cms_canonical_domain_current(declared.value) current_row;
  end if;
end;
$body$;

create or replace function platform_private.cms_governed_current_digest(
  p_kind text, p_owner_id uuid, p_subject jsonb
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  reference record;
  block_row platform_private.cms_block_definition_versions%rowtype;
  current_lifecycle text;
  tuples jsonb := '[]'::jsonb;
begin
  if p_kind = 'template_version' then
    return platform_private.cms_template_block_digest(
      p_subject->'slots', p_subject->'typeIds', p_owner_id);
  elsif p_kind = 'pattern_version' then
    for reference in
      select distinct closure.block_key, closure.block_version
        from platform_private.cms_governed_pattern_closure(p_owner_id, p_subject->'blockTree') closure
       where closure.item_kind = 'block'
       order by closure.block_key collate "C", closure.block_version
    loop
      select * into block_row
        from platform_private.cms_block_definition_versions candidate
       where candidate.block_key = reference.block_key
         and candidate.block_version = reference.block_version
         and candidate.state = 'registered'
         for share;
      if not found then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
      end if;
      select lifecycle_event.to_lifecycle into current_lifecycle
        from platform_private.cms_block_definition_lifecycle_events lifecycle_event
       where lifecycle_event.block_definition_version_id = block_row.id
       order by lifecycle_event.created_at desc, lifecycle_event.id desc
       limit 1;
      if coalesce(current_lifecycle, 'supported') <> 'supported' then
        raise exception 'CONFLICT' using errcode = 'P0001';
      end if;
      tuples := tuples || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'blockKey', block_row.block_key,
        'blockVersion', block_row.block_version,
        'releaseDigest', pg_catalog.btrim(block_row.release_digest::text),
        'propsSchemaHash', pg_catalog.btrim(block_row.props_schema_hash::text),
        'rendererRef', block_row.renderer_ref,
        'lifecycle', current_lifecycle));
    end loop;
    return platform_private.cms_jcs_sha256(tuples);
  end if;
  return null;
end;
$body$;

comment on function platform_private.cms_governed_current_digest(text, uuid, jsonb) is
  'BE03c digest invariants: the blockRegistryDigest recomputed over the reachable block tuple set of a template (03c block digest, renderer-manifest compatibility included) or of an expanded pattern tree; NULL for a taxonomy version. A missing, withdrawn or incompatible block raises. Private.';

create or replace function platform_private.cms_governed_lock_graph(
  p_kind text, p_owner_id uuid, p_subject jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $body$
begin
  -- Position 3 (after the subject row): the nested pattern versions the subject pins.
  if p_kind = 'pattern_version' then
    perform 1
      from platform_private.cms_pattern_versions nested_item
     where nested_item.id in (
       select closure.nested_id
         from platform_private.cms_governed_pattern_closure(p_owner_id, p_subject->'blockTree') closure
        where closure.item_kind = 'pattern' and closure.nested_id is not null)
     order by nested_item.id
       for share;
  end if;
  -- Position 4: the bound content-type version rows.
  perform 1
    from platform_private.cms_content_type_versions version_item
   where version_item.id in (
     select bound.version_id
       from platform_private.cms_governed_bound_versions(p_kind, p_owner_id, p_subject) bound)
   order by version_item.id
     for share;
end;
$body$;

create or replace function platform_private.cms_governed_frozen_status(p_review_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  review_row platform_private.cms_governed_reviews%rowtype;
  subject jsonb;
  basis jsonb;
  current_digest text;
  type_id text;
begin
  select review_item.* into review_row
    from platform_private.cms_governed_reviews review_item
   where review_item.id = p_review_id;
  if not found then
    return 'changed';
  end if;
  subject := platform_private.cms_governed_subject_resolve(review_row.subject_kind, review_row.subject_id);
  if subject is null
     or subject->>'ownerId' is distinct from review_row.owner_id::text
     or subject->>'contentHash' is distinct from review_row.subject_hash::text
     or subject->>'lineageId' is distinct from review_row.lineage_id::text then
    return 'changed';
  end if;
  -- DEPENDENCY_UNAVAILABLE (a NULL policy evidence) propagates: unknown is never current.
  basis := platform_private.cms_governed_policy_basis(review_row.subject_kind, review_row.owner_id, subject);
  if basis->>'basisHash' is distinct from review_row.policy_basis_hash::text
     or basis->>'riskClass' is distinct from review_row.risk_class
     or (basis->>'requiredDecisionCount')::integer <> review_row.required_decision_count
     or basis->'requiredCapabilities' is distinct from review_row.required_capabilities then
    return 'changed';
  end if;
  if exists (
       select 1 from platform_private.cms_governed_dependency_refs(
                review_row.subject_kind, review_row.owner_id, subject) current_ref
        where not exists (
          select 1 from platform_private.cms_governed_review_dependencies frozen
           where frozen.review_id = review_row.id
             and frozen.kind = current_ref.dependency_kind and frozen.ref_id = current_ref.dependency_ref))
     or exists (
       select 1 from platform_private.cms_governed_review_dependencies frozen
        where frozen.review_id = review_row.id
          and not exists (
            select 1 from platform_private.cms_governed_dependency_refs(
                   review_row.subject_kind, review_row.owner_id, subject) current_ref
             where current_ref.dependency_kind = frozen.kind and current_ref.dependency_ref = frozen.ref_id)) then
    return 'changed';
  end if;
  if review_row.subject_kind <> 'taxonomy_version' then
    begin
      current_digest := platform_private.cms_governed_current_digest(
        review_row.subject_kind, review_row.owner_id, subject);
    exception when others then
      return 'changed';
    end;
    if current_digest is distinct from review_row.block_registry_digest::text
       or current_digest is distinct from subject->>'blockRegistryDigest' then
      return 'changed';
    end if;
  end if;
  if review_row.subject_kind = 'pattern_version' and exists (
       select 1 from platform_private.cms_governed_pattern_closure(
                review_row.owner_id, subject->'blockTree') closure
        where closure.item_kind = 'pattern' and closure.nested_state is distinct from 'active') then
    return 'changed';
  end if;
  -- Every bound content type must still have an active version (the compatibility resolver's input).
  if review_row.subject_kind <> 'taxonomy_version' then
    for type_id in
      select element.value from pg_catalog.jsonb_array_elements_text(subject->'typeIds') element(value)
    loop
      if not exists (
        select 1 from platform_private.cms_governed_bound_versions(
                 review_row.subject_kind, review_row.owner_id, subject) bound
         where bound.content_type_id = type_id::uuid) then
        return 'changed';
      end if;
    end loop;
  end if;
  return 'current';
end;
$body$;

comment on function platform_private.cms_governed_frozen_status(uuid) is
  'BE03c Governed review machinery: current when the subject hash, the policy basis, the frozen dependency identities, the block digest, the nested pattern states and the bound content types are all still what the review froze, else changed (the caller commits the invalidation). Raises DEPENDENCY_UNAVAILABLE when a bound policy evidence is NULL. Private.';

grant select on table
  platform_private.cms_block_definition_versions,
  platform_private.cms_block_definition_lifecycle_events,
  platform_private.cms_governed_reviews,
  platform_private.cms_governed_review_dependencies
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_dependency_refs(text, uuid, jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_current_digest(text, uuid, jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_lock_graph(text, uuid, jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_frozen_status(uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_governed_dependency_refs(text, uuid, jsonb),
  platform_private.cms_governed_current_digest(text, uuid, jsonb),
  platform_private.cms_governed_lock_graph(text, uuid, jsonb),
  platform_private.cms_governed_frozen_status(uuid)
  from public, anon, authenticated, service_role;

commit;
