-- Slice 12 lane L1 (BE03c "Governed review machinery" subject_kind table, "Governed policy basis"; tracker
-- P2-S12-AC-198 .. AC-201, AC-251): the subject-kind adapters of the governed review set.
--
--   cms_governed_tree_nodes / _tree_blocks / _tree_patterns   the bounded block forest of a pattern (an array of
--                                   PatternNode, or the legacy `{ "nodes": [...] }` object of the Slice 09 fixtures)
--   cms_governed_pattern_row(owner, lineage, version)   a pinned pattern version row as jsonb (NULL when the
--                                   pattern lineage column does not exist yet or no row matches)
--   cms_governed_pattern_closure(owner, tree)   the blocks and the nested pattern versions reachable from a tree
--   cms_governed_subject_resolve(kind, id, lock)   the ONE polymorphic resolver (`cms_governed_subject_resolve`
--                                   of the spec): a subject version row as the closed jsonb the governed RPCs read
--   cms_governed_bound_versions(kind, owner, subject)   the active content type versions the subject is bound to
--   cms_governed_policy_basis(kind, owner, subject)   the strictest-of DEC-110 policy basis, its hash, risk class,
--                                   required decision count and capability slots
-- The subject rows are read as to_jsonb(row), so the adapters name no column that a sibling lane may still be
-- adding (pattern_id, taxonomy_id, compatible_type_ids, canonical_overlap_domains).  Every function is private,
-- SECURITY DEFINER with an empty search_path, owned by the CMS definer role.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_tree_nodes(p_tree jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $body$
  select case pg_catalog.jsonb_typeof(p_tree)
           when 'array' then p_tree
           when 'object' then coalesce(p_tree->'nodes', '[]'::jsonb)
           else '[]'::jsonb
         end
$body$;

create or replace function platform_private.cms_governed_tree_blocks(p_tree jsonb)
returns table(block_key text, block_version integer)
language plpgsql
stable
set search_path = ''
as $body$
declare
  node jsonb;
begin
  for node in
    select element.value
      from pg_catalog.jsonb_array_elements(platform_private.cms_governed_tree_nodes(p_tree)) element(value)
  loop
    if node->>'kind' is distinct from 'pattern' and node ? 'blockKey' then
      block_key := node->>'blockKey';
      block_version := coalesce((node->>'blockVersion')::integer, 1);
      return next;
      return query select * from platform_private.cms_governed_tree_blocks(node->'children');
    end if;
  end loop;
end;
$body$;

create or replace function platform_private.cms_governed_pattern_row(
  p_owner_id uuid, p_lineage_id uuid, p_version integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  has_lineage boolean;
  found_row jsonb;
begin
  select exists (
    select 1 from pg_catalog.pg_attribute attribute
     where attribute.attrelid = 'platform_private.cms_pattern_versions'::pg_catalog.regclass
       and attribute.attname = 'pattern_id' and not attribute.attisdropped
  ) into has_lineage;
  if not has_lineage then
    return null;
  end if;
  execute 'select pg_catalog.to_jsonb(pattern_row) from platform_private.cms_pattern_versions pattern_row '
          'where pattern_row.owner_id = $1 and pattern_row.pattern_id = $2 and pattern_row.version = $3'
    into found_row using p_owner_id, p_lineage_id, p_version;
  return found_row;
end;
$body$;

create or replace function platform_private.cms_governed_pattern_closure(
  p_owner_id uuid, p_tree jsonb, p_depth integer default 1
)
returns table(item_kind text, block_key text, block_version integer, nested_id uuid, nested_state text)
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  node jsonb;
  nested jsonb;
begin
  if p_depth > 9 then
    return;
  end if;
  for node in
    select element.value
      from pg_catalog.jsonb_array_elements(platform_private.cms_governed_tree_nodes(p_tree)) element(value)
  loop
    if node->>'kind' = 'pattern' then
      nested := platform_private.cms_governed_pattern_row(
        p_owner_id, (node->>'patternId')::uuid, (node->>'patternVersion')::integer);
      item_kind := 'pattern';
      block_key := null;
      block_version := null;
      nested_id := (nested->>'id')::uuid;
      nested_state := nested->>'state';
      return next;
      if nested is not null then
        return query select * from platform_private.cms_governed_pattern_closure(
          p_owner_id, nested->'block_tree', p_depth + 1);
      end if;
    elsif node ? 'blockKey' then
      item_kind := 'block';
      block_key := node->>'blockKey';
      block_version := coalesce((node->>'blockVersion')::integer, 1);
      nested_id := null;
      nested_state := null;
      return next;
      return query select * from platform_private.cms_governed_pattern_closure(
        p_owner_id, node->'children', p_depth);
    end if;
  end loop;
end;
$body$;

create or replace function platform_private.cms_governed_subject_resolve(
  p_kind text, p_id uuid, p_lock boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  subject_row jsonb;
  creator uuid;
begin
  if p_id is null then
    return null;
  end if;
  if p_kind = 'template_version' then
    if p_lock then
      select pg_catalog.to_jsonb(item) into subject_row
        from platform_private.cms_template_versions item where item.id = p_id for update;
    else
      select pg_catalog.to_jsonb(item) into subject_row
        from platform_private.cms_template_versions item where item.id = p_id;
    end if;
  elsif p_kind = 'pattern_version' then
    if p_lock then
      select pg_catalog.to_jsonb(item) into subject_row
        from platform_private.cms_pattern_versions item where item.id = p_id for update;
    else
      select pg_catalog.to_jsonb(item) into subject_row
        from platform_private.cms_pattern_versions item where item.id = p_id;
    end if;
  elsif p_kind = 'taxonomy_version' then
    if p_lock then
      select pg_catalog.to_jsonb(item) into subject_row
        from platform_private.cms_taxonomy_versions item where item.id = p_id for update;
    else
      select pg_catalog.to_jsonb(item) into subject_row
        from platform_private.cms_taxonomy_versions item where item.id = p_id;
    end if;
  else
    return null;
  end if;
  if subject_row is null then
    return null;
  end if;
  begin
    creator := platform_private.identity_actor_person((subject_row->>'created_by')::uuid);
  exception when others then
    creator := null;
  end;
  return pg_catalog.jsonb_build_object(
    'kind', p_kind,
    'id', subject_row->>'id',
    'ownerId', subject_row->>'owner_id',
    'state', subject_row->>'state',
    'lifecycleVersion', (subject_row->>'lifecycle_version')::bigint,
    'versionNumber', (subject_row->>'version')::bigint,
    'contentHash', subject_row->>'content_hash',
    'lineageId', subject_row->>(case p_kind when 'template_version' then 'template_id'
                                            when 'pattern_version' then 'pattern_id'
                                            else 'taxonomy_id' end),
    'key', subject_row->>(case p_kind when 'template_version' then 'template_key'
                                      when 'pattern_version' then 'pattern_key'
                                      else 'taxonomy_key' end),
    'createdBy', subject_row->>'created_by',
    'creatorPerson', creator,
    'blockRegistryDigest', subject_row->>'block_registry_digest',
    'ownerCapability', case p_kind when 'taxonomy_version' then 'cms.taxonomy_curator'
                                   else 'cms.template_designer' end,
    'typeIds', subject_row->'compatible_type_ids',
    'typeKeys', subject_row->'allowlisted_type_keys',
    'canonicalDomains', coalesce(subject_row->'canonical_overlap_domains', '[]'::jsonb),
    'slots', subject_row->'slots',
    'blockTree', subject_row->'block_tree'
  );
end;
$body$;

comment on function platform_private.cms_governed_subject_resolve(text, uuid, boolean) is
  'BE03c cms_governed_subject_resolve(kind, id): the polymorphic subject-version resolver of the governed review set (template_version, pattern_version, taxonomy_version): owner, state, lifecycle version, definition number, content hash, lineage id, key, creator, digest, owner capability, bound type ids or keys and canonical domains. NULL for an absent id or a kind outside the closed set; p_lock takes the row FOR UPDATE. Private.';

create or replace function platform_private.cms_governed_bound_versions(
  p_kind text, p_owner_id uuid, p_subject jsonb
)
returns table(content_type_id uuid, version_id uuid, label text)
language plpgsql
stable
security definer
set search_path = ''
as $body$
begin
  if p_kind in ('template_version', 'pattern_version') then
    return query
      select type_item.id, version_item.id,
             pg_catalog.left(coalesce(nullif(pg_catalog.btrim(version_item.labels->>'label'), ''), type_item.type_key), 120)
        from pg_catalog.jsonb_array_elements_text(coalesce(p_subject->'typeIds', '[]'::jsonb)) bound(value)
        join platform_private.cms_content_types type_item
          on type_item.id = bound.value::uuid and type_item.owner_id = p_owner_id and type_item.state = 'active'
        join platform_private.cms_content_type_versions version_item
          on version_item.content_type_id = type_item.id and version_item.state = 'active'
       order by type_item.id;
  elsif p_kind = 'taxonomy_version' then
    return query
      select type_item.id, version_item.id,
             pg_catalog.left(coalesce(nullif(pg_catalog.btrim(version_item.labels->>'label'), ''), type_item.type_key), 120)
        from pg_catalog.jsonb_array_elements_text(coalesce(p_subject->'typeKeys', '[]'::jsonb)) bound(value)
        join platform_private.cms_content_types type_item
          on type_item.type_key = bound.value and type_item.owner_id = p_owner_id and type_item.state = 'active'
        join platform_private.cms_content_type_versions version_item
          on version_item.content_type_id = type_item.id and version_item.state = 'active'
       order by type_item.id;
  end if;
end;
$body$;

create or replace function platform_private.cms_governed_policy_basis(
  p_kind text, p_owner_id uuid, p_subject jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  bound record;
  evidence jsonb;
  items jsonb := '[]'::jsonb;
  sorted jsonb;
  item jsonb;
  slot text;
  basis jsonb;
  caps jsonb := '["cms.reviewer"]'::jsonb;
  risk text := 'ordinary';
  need integer := 1;
begin
  for bound in
    select * from platform_private.cms_governed_bound_versions(p_kind, p_owner_id, p_subject)
  loop
    evidence := platform_private.cms_editorial_workflow_policy_evidence(bound.version_id);
    if evidence is null then
      raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001', detail = '{"dependencyClass":"policy"}';
    end if;
    items := items || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'contentTypeId', bound.content_type_id,
      'policyKey', evidence->>'key',
      'policyVersion', (evidence->>'version')::bigint,
      'policyHash', evidence->>'policyHash',
      'evidence', evidence));
  end loop;
  if pg_catalog.jsonb_array_length(items) = 0 then
    evidence := platform_private.cms_workflow_policy_member('editorial.default', 1);
    if evidence is null then
      raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001', detail = '{"dependencyClass":"policy"}';
    end if;
    items := pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'contentTypeId', null,
      'policyKey', 'editorial.default',
      'policyVersion', 1,
      'policyHash', evidence->>'policyHash',
      'evidence', evidence));
  end if;
  select pg_catalog.jsonb_agg(element.value
           order by (element.value->>'policyKey') collate "C",
                    (element.value->>'policyVersion')::bigint,
                    (element.value->>'contentTypeId') collate "C")
    into sorted
    from pg_catalog.jsonb_array_elements(items) element(value);
  for item in select element.value from pg_catalog.jsonb_array_elements(sorted) element(value) loop
    evidence := item->'evidence';
    if evidence->>'riskClass' = 'protected' then risk := 'protected'; end if;
    need := greatest(need, (evidence->>'requiredDecisionCount')::integer);
    for slot in select element.value from pg_catalog.jsonb_array_elements_text(evidence->'requiredCapabilities') element(value) loop
      if slot <> 'cms.reviewer' and not (caps ? slot) and pg_catalog.jsonb_array_length(caps) < 16 then
        caps := caps || pg_catalog.to_jsonb(slot);
      end if;
    end loop;
  end loop;
  select pg_catalog.jsonb_agg(element.value - 'evidence'
           order by (element.value->>'policyKey') collate "C",
                    (element.value->>'policyVersion')::bigint,
                    (element.value->>'contentTypeId') collate "C")
    into basis
    from pg_catalog.jsonb_array_elements(sorted) element(value);
  return pg_catalog.jsonb_build_object(
    'basis', basis,
    'basisHash', platform_private.cms_jcs_sha256(basis),
    'riskClass', risk,
    'requiredDecisionCount', need,
    'requiredCapabilities', caps);
end;
$body$;

comment on function platform_private.cms_governed_policy_basis(text, uuid, jsonb) is
  'BE03c Governed policy basis: the strictest DEC-110 workflow policy among the content types the subject is bound to (its compatibleTypeIds, or for a taxonomy version the owner content types named by allowedTypeKeys), each resolved through the fail-closed cms_editorial_workflow_policy_evidence seam (NULL evidence is DEPENDENCY_UNAVAILABLE). Returns { basis (sorted by policyKey, policyVersion, contentTypeId), basisHash (JCS SHA-256), riskClass, requiredDecisionCount, requiredCapabilities (cms.reviewer then the specialist slots in first-appearance order, at most 16) }; editorial.default v1 when no bound type resolves. Private; STABLE.';

grant select on table
  platform_private.cms_template_versions,
  platform_private.cms_pattern_versions,
  platform_private.cms_taxonomy_versions,
  platform_private.cms_content_types,
  platform_private.cms_content_type_versions
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_tree_nodes(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_tree_blocks(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_pattern_row(uuid, uuid, integer) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_pattern_closure(uuid, jsonb, integer) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_subject_resolve(text, uuid, boolean) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_bound_versions(text, uuid, jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_policy_basis(text, uuid, jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_governed_tree_nodes(jsonb),
  platform_private.cms_governed_tree_blocks(jsonb),
  platform_private.cms_governed_pattern_row(uuid, uuid, integer),
  platform_private.cms_governed_pattern_closure(uuid, jsonb, integer),
  platform_private.cms_governed_subject_resolve(text, uuid, boolean),
  platform_private.cms_governed_bound_versions(text, uuid, jsonb),
  platform_private.cms_governed_policy_basis(text, uuid, jsonb)
  from public, anon, authenticated, service_role;

commit;
