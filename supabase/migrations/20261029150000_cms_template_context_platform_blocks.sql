-- Slice 12 lane block-owner, DEC-243 (root ruling 2026-10-29, owner may override; BE03c:206 and FE03:1129 amended): the block selectors of
-- cmsTemplateContextRead are every registered, currently supported block of the code-owned platform registry, not the blocks of the caller's
-- organization.  CMS-03A-05 stores `owner_id` = the signed RELEASE PRINCIPAL (20261003130600:34,67-77; an auth.users service identity, never a
-- party), so `where block_row.owner_id = acting_party_id` (20260927320000:68, carried into 20261013100500:100) matched no registered row on the
-- real stack: no organization designer was ever offered a released block in the template or pattern chooser, while the CMS-03C-01 and CMS-03C-12
-- validators (which read a block by key and version with no owner predicate) accepted it.  The Slice 09 ruling already applies: 20261002209000
-- removed the same predicate from CMS-03A-06 and CMS-03A-07 ("their owner is the release principal, never a tenant") and P2-S09-AC-145 pins
-- "blocks are platform registry records, not tenant data".  Red proof: supabase/tests/phase_02_slice_12_block_owner_red.sql.
-- Unchanged: state = 'registered', the latest-lifecycle `supported` filter, C-collation ordering, the 128 cap, the selector shape {blockKey, blockVersion},
-- the actor / acting-party / designer-grant recheck, and the content-type half of the read.
-- ONE guarded anchored replacement in the installed source of platform_private.cms_template_context(jsonb) (the DEC-232 precedent 20261027100020): the
-- anchor occurs exactly once, the inverse replacement restores the installed source byte for byte, and every pg_proc attribute except the source
-- (owner, SECURITY DEFINER, search_path, ACL, comment) is unchanged.  The platform_api wrapper is untouched.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_template_context(jsonb)';
  anchor_old constant text :=
    $old$    where block_row.owner_id = acting_party_id
      and block_row.state = 'registered'$old$;
  anchor_new constant text :=
    $new$    -- DEC-243: blocks are the code-owned platform registry (owner = release principal, never a tenant): no owner predicate.
    where block_row.state = 'registered'$new$;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
begin
  select proc.* into original from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'DEC-243 missing existing function: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchor_old, '')))
       / pg_catalog.length(anchor_old) <> 1
     or pg_catalog.strpos(old_source, anchor_new) <> 0 then
    raise exception 'DEC-243 unexpected anchor in %', identity using errcode = '55000';
  end if;
  new_source := pg_catalog.replace(old_source, anchor_old, anchor_new);
  inverse_source := pg_catalog.replace(new_source, anchor_new, anchor_old);
  if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchor_new, '')))
       / pg_catalog.length(anchor_new) <> 1
     or inverse_source is distinct from old_source
     or new_source ~ 'block_row\.owner_id' then
    raise exception 'DEC-243 non-anchored change in %', identity using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or pg_catalog.length(old_source) = 0
     or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
          / pg_catalog.length(old_source) <> 1 then
    raise exception 'DEC-243 ambiguous definition: %', identity using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'DEC-243 replacement changed more than the source: %', identity using errcode = '55000';
  end if;
end;
$migration$;

commit;
