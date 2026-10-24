-- Slice 12 lane locale, CMS-03C-04 author command, Slice 12 deltas (BE03c route field validation
-- matrix 382-388, Locale field resolution (DEC-121, DEC-138) and fan-out (D12) 1393-1395, Event
-- schemas 1555; tracker P2-S12-AC-235, AC-236, AC-237):
--
--   1. field_source_hashes: the variant row records the source value hash of each translated field at
--      write time (cms_locale_source_field_hash of the source revision), the baseline of the per-field
--      staleness test;
--   2. the 32-locale ceiling: a request that would create a 33rd distinct locale variant of the entry is
--      the 409 conflict (token VERSION_MISMATCH) with DETAIL {"reasonCode":"locale_limit_reached"} and
--      writes nothing.  It is taken before the supported-locale check, because a configuration admits at
--      most 32 supported locales (31 targets), so the ceiling is a backstop that only a locale outside
--      the configuration can reach;
--   3. the lock order (BE03c Slice 12 lock order 1337-1340): the entry's content-type version row is taken
--      FOR SHARE (position 4), so a successor activation that waits behind the command cannot flip the schema
--      under it;
--   4. the event identity: cms.localization.changed.v1 is emitted under aggregate type
--      cms_locale_variant, the locale aggregate id (cms_locale_aggregate_id) and the variant row version,
--      so the author command and the source-change fan-out never share a dedupe key;
--   5. the fan-out of the target-locale revision it writes (a locale revision can itself be the source of
--      another locale's variant): the command calls cms_stale_locale_dependents after the revision values
--      exist, so the recorded stale_field_ids is exact.  The revision-insert trigger that used to do this
--      fired before any value existed and is retired (20261014050310); the other revision writers fan out
--      when they move the draft head, this command never does.
--
-- The live body of platform_private.cms_author_locale_variant is NOT the text of any single migration
-- (20261010130000 added the E7 settings tail, 20261013100400 the staleFieldIds member), so this is a guarded
-- amendment of the LIVE source, in the style of 20261013100400: each anchor must occur exactly once, the
-- inverse replacement must restore the installed source byte for byte (nothing else changed, in particular
-- not the E7 tail), the function is re-created from that definition and every pg_proc attribute except the
-- source is proven unchanged.  platform_api.cms_author_locale_variant is untouched.  Forward-only.
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
  anchors_old text[] := array[
    $a$  if not (version_row.supported_locales ? target_locale) then$a$,
    $a$    source_hash, fallback_chain, no_fallback_field_ids, created_by
  ) values ($a$,
    $a$    p_request->'fallbackChain', p_request->'noFallbackFieldIds', actor_id
  );$a$,
    $a$    'cms.localization.changed.v1', 'cms_content_entry', entry_row.id,
    requested_version + 1,$a$,
    $a$    and version.state::text = 'active';$a$,
    $a$   and definition.stable_field_id = (item.key)::uuid;
  insert into platform_private.cms_locale_variants($a$
  ];
  anchors_new text[] := array[
    $a$  -- D12 ceiling: at most 32 distinct dependent locale variants per entry; a request that would create a
  -- 33rd is the 409 conflict with the machine reason locale_limit_reached and writes nothing.
  if not exists (
       select 1 from platform_private.cms_locale_variants existing
        where existing.entry_id = entry_row.id
          and pg_catalog.lower(existing.locale) = pg_catalog.lower(target_locale))
     and (select pg_catalog.count(distinct pg_catalog.lower(existing.locale))
            from platform_private.cms_locale_variants existing
           where existing.entry_id = entry_row.id) >= 32 then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_object('reasonCode', 'locale_limit_reached')::text;
  end if;
  if not (version_row.supported_locales ? target_locale) then$a$,
    $a$    source_hash, fallback_chain, no_fallback_field_ids, created_by,
    field_source_hashes
  ) values ($a$,
    $a$    p_request->'fallbackChain', p_request->'noFallbackFieldIds', actor_id,
    (select coalesce(pg_catalog.jsonb_object_agg(item.key,
              platform_private.cms_locale_source_field_hash(source_row.id, (item.key)::uuid)), '{}'::jsonb)
       from pg_catalog.jsonb_each(values_by_field) item(key, value))
  );$a$,
    $a$    'cms.localization.changed.v1', 'cms_locale_variant',
    platform_private.cms_locale_aggregate_id(entry_row.id, target_locale),
    next_variant_version,$a$,
    $a$    and version.state::text = 'active'
  for share;$a$,
    $a$   and definition.stable_field_id = (item.key)::uuid;
  -- D12: the target-locale revision may be the source of another locale's variant; its values exist now.
  perform platform_private.cms_stale_locale_dependents(new_revision_id, false);
  insert into platform_private.cms_locale_variants($a$
  ];
  index_no integer;
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
  if pg_catalog.strpos(old_source, '-- E7 ordinary-write snapshot tail:') = 0
     or pg_catalog.strpos(old_source, 'staleFieldIds') = 0
     or pg_catalog.strpos(old_source, 'field_source_hashes') <> 0 then
    raise exception 'locale author command: unexpected baseline' using errcode = '55000';
  end if;
  new_source := old_source;
  for index_no in 1..pg_catalog.cardinality(anchors_old) loop
    -- Each anchor occurs exactly once in the installed source.
    if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchors_old[index_no], '')))
         / pg_catalog.length(anchors_old[index_no]) <> 1 then
      raise exception 'locale author command: unexpected anchor %', index_no using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[index_no], anchors_new[index_no]);
  end loop;
  -- The inverse replacement restores the installed source exactly: nothing else changed.
  definition := new_source;
  for index_no in reverse pg_catalog.cardinality(anchors_old)..1 loop
    definition := pg_catalog.replace(definition, anchors_new[index_no], anchors_old[index_no]);
  end loop;
  if definition <> old_source then
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
