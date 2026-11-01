-- Slice 12 lane db10 (DEC-247, BE03c 1585): the cms.pattern.active_digest provider reports the two new reasons.  When several pins of the
-- manifest fail, the category reports the first reason present in the order pattern_not_active, nested_pattern_not_active,
-- pattern_depth_exceeded, pattern_nodes_exceeded, pattern_digest_changed, pattern_block_rules_violated.  The per-pin reasons come from
-- cms_pattern_live_pin_reason (20261031110100); blockingCount stays one unit per offending live pin, as for the other reasons.
-- The installed private function is amended by 1 guarded anchored replacement: the anchor occurs exactly once in the installed
-- source, the inverse replacement restores the installed source byte for byte, and every pg_proc attribute except the source (owner,
-- security mode, search_path, ACL) is unchanged.  The comment is restated.  Forward-only.
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
  i integer;
  anchors_old text[] := array[
    $old$    reason := 'nested_pattern_not_active';
  elsif 'pattern_digest_changed' = any(reasons) then$old$
  ];
  anchors_new text[] := array[
    $new$    reason := 'nested_pattern_not_active';
  -- DEC-247: the re-proved CMS-03C-12 bounds follow nested activity and precede the digest and block-rules reasons.
  elsif 'pattern_depth_exceeded' = any(reasons) then
    reason := 'pattern_depth_exceeded';
  elsif 'pattern_nodes_exceeded' = any(reasons) then
    reason := 'pattern_nodes_exceeded';
  elsif 'pattern_digest_changed' = any(reasons) then$new$
  ];
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'DEC-247 missing existing function: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or original.prosecdef or original.prokind <> 'f' or original.provolatile <> 's'
     or not original.proretset or original.prorettype <> 'record'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'DEC-247 unexpected baseline attributes: %', identity using errcode = '55000';
  end if;
  new_source := old_source;
  for i in 1 .. pg_catalog.cardinality(anchors_old) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[i], '')))
         / pg_catalog.length(anchors_old[i]) <> 1
       or pg_catalog.strpos(old_source, anchors_new[i]) <> 0 then
      raise exception 'DEC-247 unexpected anchor % in %', i, identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[i], anchors_new[i]);
  end loop;
  inverse_source := new_source;
  for i in reverse pg_catalog.cardinality(anchors_old) .. 1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(pg_catalog.replace(inverse_source, anchors_new[i], '')))
         / pg_catalog.length(anchors_new[i]) <> 1 then
      raise exception 'DEC-247 ambiguous inverse % in %', i, identity using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(inverse_source, anchors_new[i], anchors_old[i]);
  end loop;
  if inverse_source is distinct from old_source then
    raise exception 'DEC-247 non-anchored change in %', identity using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or pg_catalog.length(old_source) = 0
     or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
          / pg_catalog.length(old_source) <> 1 then
    raise exception 'DEC-247 ambiguous definition: %', identity using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc' then
    raise exception 'DEC-247 replacement changed more than the source: %', identity using errcode = '55000';
  end if;
end;
$migration$;

comment on function platform_private.cms_pattern_active_digest(uuid, jsonb) is
  'DEC-199 pattern provider (DEC-210, DEC-247): newest effective composition heads validate live nested pins or canonical local trees, exact direct frozen pattern identities, one unit per live pin/canonical offender, precedence pattern_not_active, nested_pattern_not_active, pattern_depth_exceeded, pattern_nodes_exceeded, pattern_digest_changed, then pattern_block_rules_violated, count capped at 1000. Unexpected dependencies are unavailable. Private.';

commit;
