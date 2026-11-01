-- Slice 12 lane dec202, DEC-202 / BE03b "Initial revision default template (CMS-03B-10, DEC-202)"
-- and "Write-path lock order" row 3 (tracker P2-S12-AC-286..AC-296): CMS-03B-10 derives the FIRST
-- revision's template pin from the exact authorized active content-type version's stored
-- default_template_version_id (SQL NULL when it has none).  No request operand, no latest-template,
-- first-binding or other-schema fallback; saved revisions are never rebound.
--
-- The live platform_private.cms_create_entry (20261005018040 body plus the 20261010130000 E7 tail) is
-- amended by four guarded anchored replacements -- each anchor occurs exactly once in the installed
-- source, the inverse replacement restores the installed source byte for byte, and every pg_proc
-- attribute except the source is unchanged (owner, SECURITY DEFINER, search_path, ACL, comment):
--   1. a `default_template_id uuid` declaration;
--   2. the early schema FOR SHARE lock is removed from before the value loop: BE03b lock order is
--      relation targets (2, taken inside the value loop) -> exact default template (3) -> content-type
--      version (4), and position 4 may not be taken before position 2;
--   3. after the value loop: lock the exact same-owner default FOR SHARE (3), THEN the content-type
--      version FOR SHARE (4, rechecked active under the lock exactly as before), re-read the exact
--      version row after the waits and resolve its stored default through the existing compatibility
--      resolver (cms_entry_default_template_gate); a refusal here aborts the whole transaction;
--   4. the first revision inserts default_template_id instead of the literal null.
-- The completed-idempotency replay precedes all of this (it returns before the shape and dependency
-- checks), so an exact replay is unaffected by a later withdrawal.  The E7 tail, the audit/outbox
-- effects and the response shape are untouched.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_create_entry(jsonb)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  definition text;
  comment_text text;
  declare_old constant text := E'  relation_spec jsonb;\n  response jsonb;\nbegin\n';
  declare_new constant text := E'  relation_spec jsonb;\n  default_template_id uuid;\n  response jsonb;\nbegin\n';
  early_lock_old constant text :=
    E'  -- BE03b "Entry and revision writes serialize with schema activation": lock the\n'
    || E'  -- target version row FOR SHARE before any schema evidence is read or written and\n'
    || E'  -- recheck it is still active (the 03a switch takes the conflicting lock).\n'
    || E'  perform platform_private.cms_lock_schema_version_shared(version_row.id);\n';
  early_lock_new constant text :=
    E'  -- DEC-202: the content-type version lock (position 4) moved below the value loop,\n'
    || E'  -- after the relation targets (2) and the exact default template (3).\n';
  gate_old constant text :=
    E'  -- Every validator ref must be registered, and every validator the active\n'
    || E'  -- schema declares must be covered by the request.\n';
  gate_new constant text :=
    E'  -- DEC-202 / BE03b lock order: every visible relation target (2) is locked by the\n'
    || E'  -- value loop above; now the exact same-owner stored default template (3), then the\n'
    || E'  -- content-type version (4), rechecked active under the lock (activation wins: the\n'
    || E'  -- existing refusal).  After the waits the exact version row is re-read and its stored\n'
    || E'  -- default is resolved through the existing compatibility resolver: 404 / 422 / 409.\n'
    || E'  perform platform_private.cms_lock_default_template_shared(\n'
    || E'    version_row.default_template_version_id, acting_party_id\n'
    || E'  );\n'
    || E'  perform platform_private.cms_lock_schema_version_shared(version_row.id);\n'
    || E'  select * into version_row\n'
    || E'  from platform_private.cms_content_type_versions candidate\n'
    || E'  where candidate.id = version_row.id;\n'
    || E'  default_template_id := null;\n'
    || E'  if version_row.default_template_version_id is not null then\n'
    || E'    default_template_id := platform_private.cms_entry_default_template_gate(\n'
    || E'      actor_id, acting_party_id, version_row.default_template_version_id, version_row.id\n'
    || E'    );\n'
    || E'  end if;\n\n' || gate_old;
  insert_old constant text :=
    E'    revision_id, acting_party_id, entry_id, 1, version_row.id,\n'
    || E'    null, ''[]''::jsonb, ''[]''::jsonb, p_request->>''locale'',\n';
  insert_new constant text :=
    E'    revision_id, acting_party_id, entry_id, 1, version_row.id,\n'
    || E'    default_template_id, ''[]''::jsonb, ''[]''::jsonb, p_request->>''locale'',\n';
  anchors text[] := array[declare_old, early_lock_old, gate_old, insert_old];
  replacements text[] := array[declare_new, early_lock_new, gate_new, insert_new];
  step integer;
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'DEC-202 missing existing function: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.pronargs <> 1 or original.pronargdefaults <> 0
     or original.prorettype <> 'jsonb'::pg_catalog.regtype or original.proretset
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'DEC-202 unexpected baseline attributes: %', identity using errcode = '55000';
  end if;
  if pg_catalog.strpos(old_source, '-- E7 ordinary-write snapshot tail:') = 0
     or pg_catalog.strpos(old_source, 'cms_entry_default_template_gate') <> 0 then
    raise exception 'DEC-202 unexpected baseline (E7 tail missing or already amended)' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'DEC-202 ambiguous definition: %', identity using errcode = '55000';
  end if;
  new_source := old_source;
  for step in 1 .. pg_catalog.array_length(anchors, 1) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors[step], '')))
         / pg_catalog.length(anchors[step]) <> 1 then
      raise exception 'DEC-202 unexpected anchor % in %', step, identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors[step], replacements[step]);
  end loop;
  -- Exact inverse: nothing but the four anchored spans changed.
  declare
    restored text := new_source;
  begin
    for step in reverse pg_catalog.array_length(anchors, 1) .. 1 loop
      restored := pg_catalog.replace(restored, replacements[step], anchors[step]);
    end loop;
    if restored <> old_source then
      raise exception 'DEC-202 non-anchored change in %', identity using errcode = '55000';
    end if;
  end;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc <> new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' <> pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text
     or pg_catalog.strpos(actual.prosrc, 'cms_lock_schema_version_shared(version_row.id)') = 0
     or pg_catalog.strpos(actual.prosrc, 'cms_resolve_relation_targets(')
          > pg_catalog.strpos(actual.prosrc, 'cms_lock_default_template_shared(')
     or pg_catalog.strpos(actual.prosrc, 'cms_lock_default_template_shared(')
          > pg_catalog.strpos(actual.prosrc, 'cms_lock_schema_version_shared(version_row.id)')
     or pg_catalog.strpos(actual.prosrc, 'cms_lock_schema_version_shared(version_row.id)')
          > pg_catalog.strpos(actual.prosrc, 'cms_entry_default_template_gate(')
     or pg_catalog.strpos(actual.prosrc, 'cms_entry_default_template_gate(')
          > pg_catalog.strpos(actual.prosrc, 'cms_complete(reservation.id, entry_id, 201, response);') then
    raise exception 'DEC-202 replacement verification failed: %', identity using errcode = '55000';
  end if;
end;
$migration$;

commit;
