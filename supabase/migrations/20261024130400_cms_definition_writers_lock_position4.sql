-- Slice 12 gap lane claude_s12_gaps_db2 (P2-S12-AC-276, BE03c "Slice 12 lock order", row "CMS-03C-01, CMS-03C-12, CMS-03C-16"; review V13-05; root
-- decision 2026-10-28): "4 the content-type version rows the definition names (FOR SHARE)", taken after position 1 (the caller's grant rows) and
-- position 3 (the parent version row FOR UPDATE).  CMS-03C-12 (cms_create_pattern_version, 20261014020400) already takes it.  Two writers do not:
--   * platform_private.cms_define_template (CMS-03C-01) reads the named types with plain SELECTs, so a concurrent schema activation can switch a
--     type between the compatibility read and the commit and the draft would record a compatibility that is already stale;
--   * platform_private.cms_create_taxonomy_version (CMS-03C-16) takes no position-4 lock at all.
-- Each writer gets ONE anchored insertion immediately before the statement that creates the new row id (define) or the draft (taxonomy):
--   perform 1 from cms_content_type_versions version_row where version_row.id in (<the bound version ids>) order by version_row.id for share ...;
-- The bound versions are exactly what the governed review machinery locks at its own position 4 (cms_governed_bound_versions: the template's
-- compatibleTypeIds, the taxonomy's allowedTypeKeys inside the owner scope, ACTIVE type and ACTIVE version), so a definition and its review agree on
-- which rows they serialize with.  CMS-03C-01 then proves the compatibility again UNDER the lock (the refusal is the one the unlocked check
-- already raises, VALIDATION_FAILED), so a version superseded while the writer waited is refused and never pinned; CMS-03C-16 never refused an
-- unknown or inactive type key and keeps that (BE03c leaves the allowlist unchecked at definition time).
-- Each insertion is a guarded anchored replacement of the LIVE source: the anchor must occur exactly once, the INVERSE replacement must restore the
-- installed source byte for byte, and every pg_proc attribute except the source (and the comment) must be unchanged.  Forward-only; idempotent (the
-- marker).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  item record;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  definition text;
  comment_text text;
  marker constant text := 'BE03c lock order position 4';
begin
  for item in select * from (values
    ('platform_private.cms_define_template(jsonb)',
      E'  new_row_id := extensions.gen_random_uuid();\n  lineage_id := case when has_previous then previous_row.template_id else new_row_id end;\n',
      E'  -- BE03c lock order position 4 (CMS-03C-01): the content type version rows the definition names, FOR SHARE in ascending id, after the\n  -- grant rows (1) and the parent version row (3); the compatibility is proved again under the lock.\n  perform 1\n    from platform_private.cms_content_type_versions version_row\n   where version_row.id in (\n     select bound.version_id\n       from platform_private.cms_governed_bound_versions(\'template_version\', acting_party_id,\n         pg_catalog.jsonb_build_object(\'typeIds\', definition->\'compatibleTypeIds\')) bound)\n   order by version_row.id\n     for share of version_row;\n  if (select pg_catalog.count(distinct bound.content_type_id)\n        from platform_private.cms_governed_bound_versions(\'template_version\', acting_party_id,\n          pg_catalog.jsonb_build_object(\'typeIds\', definition->\'compatibleTypeIds\')) bound)\n     <> (select pg_catalog.count(distinct (named.value #>> \'{}\')::uuid)\n           from pg_catalog.jsonb_array_elements(definition->\'compatibleTypeIds\') named(value)) then\n    raise exception \'VALIDATION_FAILED\' using errcode = \'P0001\';\n  end if;\n'),
    ('platform_private.cms_create_taxonomy_version(jsonb)',
      E'  -- 9 the draft, its audit record and the completed reservation\n',
      E'  -- BE03c lock order position 4 (CMS-03C-16): the content type version rows the allowedTypeKeys name, FOR SHARE in ascending id, after the\n  -- curator grant rows (1) and the parent version row (3).\n  perform 1\n    from platform_private.cms_content_type_versions version_row\n   where version_row.id in (\n     select bound.version_id\n       from platform_private.cms_governed_bound_versions(\'taxonomy_version\', acting_party_id,\n         pg_catalog.jsonb_build_object(\'typeKeys\', definition->\'allowedTypeKeys\')) bound)\n   order by version_row.id\n     for share of version_row;\n\n')
  ) as target(identity, old_anchor, insertion)
  loop
    select proc.* into original from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(item.identity);
    if not found then
      raise exception 'position 4: % is missing', item.identity using errcode = '55000';
    end if;
    old_source := original.prosrc;
    if pg_catalog.strpos(old_source, marker) > 0 then
      continue;
    end if;
    comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
    if not original.prosecdef or original.prokind <> 'f' or original.proconfig is distinct from array['search_path=""']::text[]
       or original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole then
      raise exception 'position 4: unexpected attributes of %', item.identity using errcode = '55000';
    end if;
    if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, item.old_anchor, ''))) / pg_catalog.length(item.old_anchor) <> 1 then
      raise exception 'position 4: anchor does not occur exactly once in %', item.identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(old_source, item.old_anchor, item.insertion || item.old_anchor);
    if pg_catalog.replace(new_source, item.insertion || item.old_anchor, item.old_anchor) is distinct from old_source then
      raise exception 'position 4: non-anchored change in %', item.identity using errcode = '55000';
    end if;
    definition := pg_catalog.pg_get_functiondef(original.oid);
    if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, ''))) / pg_catalog.length(old_source) <> 1 then
      raise exception 'position 4: ambiguous definition of %', item.identity using errcode = '55000';
    end if;
    execute pg_catalog.replace(definition, old_source, new_source);
    select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(item.identity);
    if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
       or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
       or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
      raise exception 'position 4: replacement changed more than the source of %', item.identity using errcode = '55000';
    end if;
  end loop;
end;
$migration$;

commit;
