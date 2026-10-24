-- DEC-201 / BE03b position2: amend only the actual post-E7 restore body.
-- Forward-only rollback: restore the captured prior definition in a NEW migration;
-- retain immutable revision/composition history. No owner, ACL or public RPC change.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  helper pg_catalog.pg_proc%rowtype;
  contract record;
  old_comment text;
  old_definition text;
  new_definition text;
  old_source text;
  new_source text;
  inverse_source text;
  old_anchors text[];
  new_anchors text[];
  anchor_index integer;
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure('platform_private.cms_restore_revision(jsonb)');
  if not found or original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proretset or original.prorettype <> 'jsonb'::pg_catalog.regtype
     or original.pronargs <> 1 or original.pronargdefaults <> 0
     or original.proargnames is distinct from array['p_request']::text[]
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql')
     or pg_catalog.octet_length(original.prosrc) <> 27517
     or pg_catalog.md5(original.prosrc) <> 'b326ae0f547874039e8f410861f27554'
     or pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(original.prosrc, 'UTF8')), 'hex')
       <> 'a8e0b1e886c5ba79e33965224e4938f9fbbecc702082bb6de8915679b7528a81'
     or pg_catalog.has_function_privilege('anon', original.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', original.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', original.oid, 'EXECUTE') then
    raise exception 'restore448 unexpected post-E7 baseline' using errcode = '55000';
  end if;
  if not exists (select 1 from pg_catalog.pg_roles role where role.oid = original.proowner
      and not role.rolsuper and not role.rolbypassrls and not role.rolcanlogin) then
    raise exception 'restore448 unexpected CMS owner authority' using errcode = '55000';
  end if;
  -- Existing, closed private contracts only; never repair privileges in this migration.
  for contract in select * from (values
    ('cms_restore_composition_heads(uuid)', 's', 'sql',
      'platform_private.cms_composition_instances', true, 1),
    ('cms_restore_composition_refs(platform_private.cms_composition_instances)', 's', 'plpgsql',
      'pg_catalog.record', true, 1),
    ('cms_restore_composition_plan(uuid)', 'v', 'plpgsql', 'pg_catalog.record', true, 1),
    ('cms_restore_composition_registry(platform_private.cms_composition_instances,uuid,uuid[],uuid[])',
      's', 'plpgsql', 'pg_catalog.text', false, 4),
    ('cms_restore_composition_copy(uuid,uuid,timestamptz,platform_private.cms_composition_instances[],uuid[],uuid[])',
      'v', 'plpgsql', 'pg_catalog.void', false, 6)
  ) expected(signature, volatility, language_name, return_type, returns_set, argument_count)
  loop
    select proc.* into helper from pg_catalog.pg_proc proc
     where proc.oid = pg_catalog.to_regprocedure('platform_private.' || contract.signature);
    if not found or helper.proowner <> original.proowner or helper.prosecdef
       or helper.prokind <> 'f' or helper.provolatile::text <> contract.volatility
       or helper.proretset is distinct from contract.returns_set
       or helper.prorettype <> pg_catalog.to_regtype(contract.return_type)
       or helper.pronargs <> contract.argument_count or helper.pronargdefaults <> 0
       or helper.proconfig is distinct from array['search_path=""']::text[]
       or helper.prolang <> (select oid from pg_catalog.pg_language where lanname = contract.language_name)
       or (select count(*) from pg_catalog.pg_proc proc
           where proc.pronamespace = helper.pronamespace and proc.proname = helper.proname) <> 1
       or exists (select 1 from pg_catalog.aclexplode(
           coalesce(helper.proacl, pg_catalog.acldefault('f', helper.proowner))) acl where acl.grantee = 0)
       or not pg_catalog.has_function_privilege(original.proowner, helper.oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('anon', helper.oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', helper.oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('service_role', helper.oid, 'EXECUTE') then
      raise exception 'restore448 private prerequisite changed: %', contract.signature using errcode = '55000';
    end if;
    if helper.proname = 'cms_restore_composition_plan' and (
        helper.proallargtypes is distinct from array['uuid'::pg_catalog.regtype,
          'platform_private.cms_composition_instances[]'::pg_catalog.regtype,
          'uuid[]'::pg_catalog.regtype, 'uuid[]'::pg_catalog.regtype]::oid[]
        or helper.proargmodes is distinct from array['i','t','t','t']::"char"[]
        or helper.proargnames is distinct from
          array['p_source_revision_id','heads','pattern_ids','block_ids']::text[]) then
      raise exception 'restore448 planner result contract changed' using errcode = '55000';
    end if;
    if helper.proname = 'cms_restore_composition_refs' and (
        helper.proallargtypes is distinct from
          array['platform_private.cms_composition_instances'::pg_catalog.regtype,
            'text'::pg_catalog.regtype, 'uuid'::pg_catalog.regtype]::oid[]
        or helper.proargmodes is distinct from array['i','t','t']::"char"[]
        or helper.proargnames is distinct from array['p_row','kind','ref_id']::text[]) then
      raise exception 'restore448 refs result contract changed' using errcode = '55000';
    end if;
  end loop;
  -- The final16200 lock accepts the AUTH actor, not author_person_id.
  if not pg_catalog.has_function_privilege(original.proowner,
      'platform_private.cms_lock_relation_target(uuid,uuid,uuid)', 'EXECUTE')
     or not pg_catalog.has_function_privilege(original.proowner,
      'platform_private.cms_relation_target_visible(uuid,uuid,uuid,text)', 'EXECUTE') then
    raise exception 'restore448 relation prerequisite unavailable' using errcode = '55000';
  end if;

  old_source := original.prosrc;
  old_comment := pg_catalog.obj_description(original.oid, 'pg_proc');
  old_definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(old_definition) - pg_catalog.length(
      pg_catalog.replace(old_definition, old_source, ''))) / pg_catalog.length(old_source) <> 1 then
    raise exception 'restore448 ambiguous source definition' using errcode = '55000';
  end if;
  old_anchors := array[
$declaration$  response jsonb;
begin
$declaration$,
$early$  -- A restore needs exactly one active schema version to translate onto, and
$early$,
$late$  -- Codex review H3: the external content targets of the source revision's
  -- relations are locked FOR SHARE (ascending id, held to commit) before they are
  -- re-resolved, so a target cannot change between the check and the new draft.
  perform platform_private.cms_lock_entry_rows_shared(array(
    select stored.target_id
    from platform_private.cms_entry_relations stored
    where stored.revision_id = source_row.id
      and stored.target_kind = 'content'
      and stored.target_id <> entry_row.id
  ));$late$,
$copy$  );
  insert into platform_private.cms_entry_field_values($copy$
  ];
  new_anchors := array[
$locals$  restore_heads platform_private.cms_composition_instances[];
  restore_pattern_ids uuid[];
  restore_block_ids uuid[];
  restore_target_ids uuid[];
  restore_target_id uuid;
  restore_target_type text;
$locals$ || old_anchors[1],
$relations$  -- DEC-201: verified source targets at2, captured composition dependencies at3.
  -- Preserve the existing total-source bound BEFORE acquiring any target lock.
  if (select pg_catalog.count(*) from platform_private.cms_entry_relations stored
      where stored.revision_id = source_row.id) > 512 then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  restore_target_ids := array(
    select distinct stored.target_id from platform_private.cms_entry_relations stored
    where stored.revision_id = source_row.id and stored.target_kind = 'content'
      and stored.target_id <> entry_row.id
    order by stored.target_id
  );
  -- Precheck ALL targets first: an invisible target is never a lock lever.
  foreach restore_target_id in array restore_target_ids loop
    select content_type.type_key into restore_target_type
      from platform_private.cms_content_entries target
      join platform_private.cms_content_types content_type on content_type.id = target.content_type_id
      where target.id = restore_target_id;
    if not found or platform_private.cms_relation_target_visible(
        actor_id, acting_party_id, restore_target_id, restore_target_type) is not true then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
  end loop;
  foreach restore_target_id in array restore_target_ids loop
    begin
      perform platform_private.cms_lock_relation_target(actor_id, acting_party_id, restore_target_id);
    exception when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end;
    -- content_type_id can change: reread its actual key AFTER the target wait.
    select content_type.type_key into restore_target_type
      from platform_private.cms_content_entries target
      join platform_private.cms_content_types content_type on content_type.id = target.content_type_id
      where target.id = restore_target_id;
    if not found or platform_private.cms_relation_target_visible(
        actor_id, acting_party_id, restore_target_id, restore_target_type) is not true then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
  end loop;
  select planned.heads, planned.pattern_ids, planned.block_ids
    into strict restore_heads, restore_pattern_ids, restore_block_ids
    from platform_private.cms_restore_composition_plan(source_row.id) planned;

$relations$ || old_anchors[2],
$removed$  -- DEC-201: external relation targets were fenced at position2 before schema4.$removed$,
$copied$  );
  perform platform_private.cms_restore_composition_copy(
    source_row.id, new_revision_id, snapshot_time, restore_heads, restore_pattern_ids, restore_block_ids
  );
  insert into platform_private.cms_entry_field_values($copied$
  ];
  new_source := old_source;
  for anchor_index in 1..4 loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(
        new_source, old_anchors[anchor_index], ''))) / pg_catalog.length(old_anchors[anchor_index]) <> 1 then
      raise exception 'restore448 missing/ambiguous anchor %', anchor_index using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, old_anchors[anchor_index], new_anchors[anchor_index]);
  end loop;
  inverse_source := new_source;
  for anchor_index in reverse 4..1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(pg_catalog.replace(
        inverse_source, new_anchors[anchor_index], ''))) / pg_catalog.length(new_anchors[anchor_index]) <> 1 then
      raise exception 'restore448 missing/ambiguous inverse %', anchor_index using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(inverse_source, new_anchors[anchor_index], old_anchors[anchor_index]);
  end loop;
  if inverse_source is distinct from old_source then
    raise exception 'restore448 non-surgical source change' using errcode = '55000';
  end if;
  new_definition := pg_catalog.replace(old_definition, old_source, new_source);
  if pg_catalog.replace(new_definition, new_source, old_source) is distinct from old_definition then
    raise exception 'restore448 definition inverse failed' using errcode = '55000';
  end if;
  execute new_definition;
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = original.oid;
  if not found or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or actual.oid is distinct from original.oid or actual.proacl is distinct from original.proacl
     or pg_catalog.pg_get_functiondef(actual.oid) is distinct from new_definition
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from old_comment then
    raise exception 'restore448 source/OID/metadata/ACL/comment changed' using errcode = '55000';
  end if;
end;
$migration$;

commit;
