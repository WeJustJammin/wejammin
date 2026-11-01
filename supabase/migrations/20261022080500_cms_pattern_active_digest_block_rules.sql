-- Slice 12 lane block-rules (DEC-210, BE03c "Block composition rules (DEC-210)"): the cms.pattern.active_digest provider fails the pattern category with pattern_block_rules_violated.
-- The installed private function is amended by 4 guarded anchored replacement(s): each anchor occurs exactly once in
-- the installed source, the inverse replacement restores the installed source byte for byte, and every pg_proc
-- attribute except the source (owner, security mode, search_path, ACL, comment) is unchanged.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_pattern_active_digest(uuid,jsonb)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  i integer;
  anchors_old text[] := array[
    $old$        digest := platform_private.cms_pattern_registry_digest_readonly(v_owner_id, item.detached_tree);
        if digest is distinct from pg_catalog.btrim(item.block_registry_digest::text) then
          reasons := pg_catalog.array_append(reasons, 'pattern_digest_changed');
        end if;
      end if;
      continue;$old$,
    $old$        if pin_reason is not null then reasons := pg_catalog.array_append(reasons, pin_reason); end if;$old$,
    $old$        digest := platform_private.cms_pattern_registry_digest_readonly(v_owner_id, item.detached_tree);
        if digest is distinct from pg_catalog.btrim(item.block_registry_digest::text) then
          reasons := pg_catalog.array_append(reasons, 'pattern_digest_changed');
        end if;
      end if;
    end if;
  end loop;$old$,
    $old$  elsif 'nested_pattern_not_active' = any(reasons) then
    reason := 'nested_pattern_not_active';
  else
    reason := 'pattern_digest_changed';
  end if;$old$
  ];
  anchors_new text[] := array[
    $new$        digest := platform_private.cms_pattern_registry_digest_readonly(v_owner_id, item.detached_tree);
        if digest is distinct from pg_catalog.btrim(item.block_registry_digest::text) then
          reasons := pg_catalog.array_append(reasons, 'pattern_digest_changed');
        -- DEC-210: a standalone canonical local tree keeps its pinned blocks' allowedChildren and slotRules.
        elsif platform_private.cms_detached_tree_block_rules(item.detached_tree) is not null then
          reasons := pg_catalog.array_append(reasons, 'pattern_block_rules_violated');
        end if;
      end if;
      continue;$new$,
    $new$        if pin_reason is not null then
          reasons := pg_catalog.array_append(reasons, pin_reason);
        -- DEC-210: the live pinned version's expanded block forest keeps every pinned block's allowedChildren and
        -- slotRules (a pattern saved before the rule is caught here); one unit per offending pin.
        elsif platform_private.cms_pattern_forest_rules_violated(
            v_owner_id, root_pattern.block_tree, root_pattern.pattern_id) then
          reasons := pg_catalog.array_append(reasons, 'pattern_block_rules_violated');
        end if;$new$,
    $new$        digest := platform_private.cms_pattern_registry_digest_readonly(v_owner_id, item.detached_tree);
        if digest is distinct from pg_catalog.btrim(item.block_registry_digest::text) then
          reasons := pg_catalog.array_append(reasons, 'pattern_digest_changed');
        -- DEC-210: a canonical local tree keeps its pinned blocks' allowedChildren and slotRules.
        elsif platform_private.cms_detached_tree_block_rules(item.detached_tree) is not null then
          reasons := pg_catalog.array_append(reasons, 'pattern_block_rules_violated');
        end if;
      end if;
    end if;
  end loop;$new$,
    $new$  elsif 'nested_pattern_not_active' = any(reasons) then
    reason := 'nested_pattern_not_active';
  elsif 'pattern_digest_changed' = any(reasons) then
    reason := 'pattern_digest_changed';
  else
    reason := 'pattern_block_rules_violated';
  end if;$new$
  ];
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'DEC-210 missing existing function: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or original.prosecdef or original.prokind <> 'f' or original.provolatile <> 's'
     or not original.proretset or original.prorettype <> 'record'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'DEC-210 unexpected baseline attributes: %', identity using errcode = '55000';
  end if;
  new_source := old_source;
  for i in 1 .. pg_catalog.cardinality(anchors_old) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[i], '')))
         / pg_catalog.length(anchors_old[i]) <> 1
       or pg_catalog.strpos(old_source, anchors_new[i]) <> 0 then
      raise exception 'DEC-210 unexpected anchor % in %', i, identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[i], anchors_new[i]);
  end loop;
  inverse_source := new_source;
  for i in reverse pg_catalog.cardinality(anchors_old) .. 1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(pg_catalog.replace(inverse_source, anchors_new[i], '')))
         / pg_catalog.length(anchors_new[i]) <> 1 then
      raise exception 'DEC-210 ambiguous inverse % in %', i, identity using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(inverse_source, anchors_new[i], anchors_old[i]);
  end loop;
  if inverse_source is distinct from old_source then
    raise exception 'DEC-210 non-anchored change in %', identity using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or pg_catalog.length(old_source) = 0
     or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
          / pg_catalog.length(old_source) <> 1 then
    raise exception 'DEC-210 ambiguous definition: %', identity using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'DEC-210 replacement changed more than the source: %', identity using errcode = '55000';
  end if;
end;
$migration$;

commit;
