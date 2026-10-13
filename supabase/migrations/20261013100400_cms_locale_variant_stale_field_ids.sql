-- Slice 12 FIX (BE03c LocaleVariantResource, DEC-121; P2-S12-AC-054): the CMS-03C-04 201 resource
-- carries `staleFieldIds`, empty unless the variant is stale.
--
-- A freshly authored variant is always a draft, so the member is the empty array; the derived
-- `untranslated`, `review`, `approved` and `stale` states belong to the commands and reads that
-- produce them.  The member is written into the response the command stores in its idempotency
-- receipt exactly as it returns it (the invariant
-- supabase/tests/phase_02_slice_11_e7_settings_writer_tail.sql pins), and an idempotent response
-- stored before the member existed is completed on replay, so a replay across this deploy answers a
-- valid resource.
--
-- The live body of platform_private.cms_author_locale_variant is NOT the text of any single migration:
-- 20261010130000 (BE03b E7 / DEC-163) amended it in place with the settings-snapshot tail.  So this
-- migration is a guarded amendment of the LIVE source in the style of the Slice 11 forward
-- migrations: it takes the installed definition, replaces two anchors that must each occur exactly
-- once, proves the inverse replacement restores the installed source byte for byte (nothing else
-- changed, in particular not the E7 tail), re-creates the function from that definition and proves
-- every pg_proc attribute except the source (owner, SECURITY DEFINER, volatility, search_path, ACL,
-- signature) and the comment are unchanged.  platform_api.cms_author_locale_variant is untouched.
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_author_locale_variant(jsonb)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  definition text;
  comment_text text;
  replay_old constant text :=
    E'      return reservation.response_ref->''safeHeaders''->''response'';';
  replay_new constant text :=
    E'      response := reservation.response_ref->''safeHeaders''->''response'';\n'
    || E'      -- A response stored before staleFieldIds existed was written as a draft: complete it.\n'
    || E'      if not (response ? ''staleFieldIds'') then\n'
    || E'        response := response || pg_catalog.jsonb_build_object(''staleFieldIds'', ''[]''::jsonb);\n'
    || E'      end if;\n'
    || E'      return response;';
  member_old constant text :=
    E'    ''noFallbackFieldIds'', p_request->''noFallbackFieldIds''\n  );';
  member_new constant text :=
    E'    ''noFallbackFieldIds'', p_request->''noFallbackFieldIds'',\n'
    || E'    ''staleFieldIds'', ''[]''::jsonb\n  );';
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'locale author command missing: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'locale author command: unexpected attributes' using errcode = '55000';
  end if;
  -- Each anchor occurs exactly once; the E7 tail is present and untouched.
  if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, replay_old, '')))
       / pg_catalog.length(replay_old) <> 1
     or (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, member_old, '')))
       / pg_catalog.length(member_old) <> 1
     or pg_catalog.strpos(old_source, '-- E7 ordinary-write snapshot tail:') = 0
     or pg_catalog.strpos(old_source, 'staleFieldIds') <> 0 then
    raise exception 'locale author command: unexpected anchors' using errcode = '55000';
  end if;
  new_source := pg_catalog.replace(pg_catalog.replace(old_source, replay_old, replay_new),
                                   member_old, member_new);
  if pg_catalog.replace(pg_catalog.replace(new_source, replay_new, replay_old), member_new, member_old)
       <> old_source then
    raise exception 'locale author command: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'locale author command: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc <> new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' <> pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'locale author command: replacement changed more than the source'
      using errcode = '55000';
  end if;
end;
$migration$;

commit;
