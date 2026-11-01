-- Slice 11 lane preview-projection, BE03b E3 "Publication lineage"; tracker P2-S11-AC-116: the two functions that
-- build a PublicationResource stop answering the literal `pending` and read the state from Shard 04's
-- projection_consumer_state for the row id (20261010165000: platform_private.cms_publication_projection_state).
--
--   cms_append_publication_lineage(jsonb)  the resource of the row just appended (its own new id)
--   cms_get_entry_workflow(jsonb)          the publications member: one state per listed row id
--
-- Both are installed bodies other migrations extend or pin (the append is created by 20261005017590 and used by the
-- publish, schedule-execute and tombstone commands; the workflow read by 20261005017900 and patched by
-- 20261010154000), so this migration does NOT restate them: it replaces exactly the one literal member
-- `'projectionState', 'pending',` in each installed body, aborting when that fragment is not found exactly once,
-- and then proves the function is otherwise identical (owner, SECURITY DEFINER, search_path, volatility, ACL,
-- comment and every pg_proc column but prosrc; the old fragment restores the old source byte for byte).  The
-- state read is a plain SELECT through STABLE definer code: it takes no row lock and so joins no position of the
-- BE03b global lock order, and it never changes canonical state.
-- Forward-only: restoring the literal is a new migration that applies the same replacement in reverse.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  cms_owner oid := 'wejammin_cms_definer'::pg_catalog.regrole;
  old_fragment constant text := $fragment$'projectionState', 'pending',$fragment$;
  target record;
  target_oid oid;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  original_definition text;
  replacement_source text;
  replacement_definition text;
  actual_definition text;
  original_metadata jsonb;
  original_comment text;
begin
  if to_regprocedure('platform_private.cms_publication_projection_state(uuid)') is null then
    raise exception 'CMS projection state function missing' using errcode = '55000';
  end if;
  for target in
    select * from (values
      ('platform_private.cms_get_entry_workflow(jsonb)',
       $replacement$'projectionState', platform_private.cms_publication_projection_state(listed.id),$replacement$),
      ('platform_private.cms_append_publication_lineage(jsonb)',
       $replacement$'projectionState', platform_private.cms_publication_projection_state(new_id),$replacement$)
    ) as mapping(signature, new_fragment)
  loop
    target_oid := pg_catalog.to_regprocedure(target.signature);
    if target_oid is null then
      raise exception 'CMS projection state target missing: %', target.signature using errcode = '55000';
    end if;
    select proc.* into original from pg_catalog.pg_proc proc where proc.oid = target_oid;
    if original.proowner is distinct from cms_owner
       or original.prosecdef is distinct from true
       or original.proconfig is distinct from array['search_path=""']::text[]
       or original.prolang is distinct from (
         select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql'
       ) then
      raise exception 'CMS projection state baseline mismatch: %', target.signature using errcode = '55000';
    end if;
    original_definition := pg_catalog.pg_get_functiondef(original.oid);
    original_metadata := pg_catalog.to_jsonb(original) - 'prosrc';
    original_comment := pg_catalog.obj_description(original.oid, 'pg_proc');

    -- Exactly one literal in the source, one source in the definition, none of the new text yet.
    if (pg_catalog.length(original.prosrc) - pg_catalog.length(
         pg_catalog.replace(original.prosrc, old_fragment, '')
       )) / pg_catalog.length(old_fragment) <> 1
       or (pg_catalog.length(original_definition) - pg_catalog.length(
         pg_catalog.replace(original_definition, original.prosrc, '')
       )) / pg_catalog.length(original.prosrc) <> 1
       or pg_catalog.strpos(original.prosrc, target.new_fragment) <> 0 then
      raise exception 'CMS projection state replacement shape mismatch: %', target.signature using errcode = '55000';
    end if;

    replacement_source := pg_catalog.replace(original.prosrc, old_fragment, target.new_fragment);
    replacement_definition := pg_catalog.replace(original_definition, original.prosrc, replacement_source);
    if pg_catalog.replace(replacement_source, target.new_fragment, old_fragment) is distinct from original.prosrc
       or pg_catalog.replace(replacement_definition, replacement_source, original.prosrc)
         is distinct from original_definition then
      raise exception 'CMS projection state inverse mismatch: %', target.signature using errcode = '55000';
    end if;

    execute replacement_definition;

    select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = target_oid;
    if not found then
      raise exception 'CMS projection state replacement missing: %', target.signature using errcode = '55000';
    end if;
    actual_definition := pg_catalog.pg_get_functiondef(actual.oid);
    if actual.prosrc is distinct from replacement_source
       or (pg_catalog.to_jsonb(actual) - 'prosrc') is distinct from original_metadata
       or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from original_comment
       or actual_definition is distinct from replacement_definition
       or pg_catalog.replace(actual.prosrc, target.new_fragment, old_fragment) is distinct from original.prosrc then
      raise exception 'CMS projection state preservation mismatch: %', target.signature using errcode = '55000';
    end if;
  end loop;
end;
$migration$;

commit;
