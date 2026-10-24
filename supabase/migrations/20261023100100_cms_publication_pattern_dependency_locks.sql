-- Lane races-canonical, DEC-199 / BE03b lock-order position 3: the three publication commands take the
-- LIVE pattern dependencies of their revision (20261023100000) FOR SHARE before the content-type version
-- (position 4) and the review (position 5).
--
-- The two shared locking helpers of the publication family are amended by ONE guarded anchored
-- replacement each; every anchor occurs exactly once in the installed source, the inverse replacement
-- restores the installed source byte for byte, and every pg_proc attribute except the source (owner,
-- SECURITY DEFINER, search_path, volatility, ACL, comment) is unchanged:
--   platform_private.cms_publication_lock_review(uuid)        -> CMS-03B-07 schedule and CMS-03B-09 publish
--   platform_private.cms_schedule_lock_review(uuid, uuid)     -> CMS-03B-20 schedule execution
-- Their callers need no change: each already calls the helper after the entry and authority positions
-- and before any step that reads or judges a dependency.  The idempotency replay returns earlier than
-- the helper, so an exact replay is unaffected.  Forward-only.
--
-- NOT covered here (BE03b/BE03c tracking, plan lane-codex-dec199-lock-dependency-plan-2026-10-16.md step 3):
-- CMS-03B-05 submit and CMS-03B-06 decision still judge nested pins without the position-3 lock.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  spec constant text[][] := array[
    array['platform_private.cms_publication_lock_review(uuid)', '1', 'p_revision_id'],
    array['platform_private.cms_schedule_lock_review(uuid,uuid)', '2', 'p_revision_id']];
  anchor constant text :=
    E'  -- Position 4 (DEC-157): the content-type version before the review row.\n';
  replacement constant text :=
    E'  -- Position 3 (DEC-199, BE03b lock order): the live pattern dependencies of the revision FOR SHARE,\n'
    || E'  -- ascending id, before the content-type version of position 4 and the review of position 5.\n'
    || E'  perform platform_private.cms_lock_revision_pattern_dependencies(p_revision_id);\n'
    || anchor;
  identity text;
  arguments integer;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  definition text;
  comment_text text;
  row_index integer;
begin
  for row_index in 1 .. pg_catalog.array_length(spec, 1) loop
    identity := spec[row_index][1];
    arguments := spec[row_index][2]::integer;
    select proc.* into original from pg_catalog.pg_proc proc
     where proc.oid = pg_catalog.to_regprocedure(identity);
    if not found then
      raise exception 'DEC-199 locks: missing existing function %', identity using errcode = '55000';
    end if;
    old_source := original.prosrc;
    comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
    if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
       or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
       or original.proconfig is distinct from array['search_path=""']::text[]
       or original.pronargs <> arguments or original.pronargdefaults <> 0 or original.proretset
       or original.prorettype <> 'platform_private.cms_editorial_reviews'::pg_catalog.regtype
       or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
      raise exception 'DEC-199 locks: unexpected baseline attributes: %', identity using errcode = '55000';
    end if;
    if pg_catalog.strpos(old_source, 'cms_lock_revision_pattern_dependencies') <> 0 then
      raise exception 'DEC-199 locks: already amended: %', identity using errcode = '55000';
    end if;
    definition := pg_catalog.pg_get_functiondef(original.oid);
    if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
         / pg_catalog.length(old_source) <> 1 then
      raise exception 'DEC-199 locks: ambiguous definition: %', identity using errcode = '55000';
    end if;
    if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchor, '')))
         / pg_catalog.length(anchor) <> 1 then
      raise exception 'DEC-199 locks: anchor is not unique in %', identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(old_source, anchor, replacement);
    -- Exact inverse: nothing but the one anchored span changed.
    if pg_catalog.replace(new_source, replacement, anchor) <> old_source then
      raise exception 'DEC-199 locks: non-anchored change in %', identity using errcode = '55000';
    end if;
    execute pg_catalog.replace(definition, old_source, new_source);
    select proc.* into actual from pg_catalog.pg_proc proc
     where proc.oid = pg_catalog.to_regprocedure(identity);
    if not found or actual.oid <> original.oid or actual.prosrc <> new_source
       or pg_catalog.to_jsonb(actual) - 'prosrc' <> pg_catalog.to_jsonb(original) - 'prosrc'
       or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text
       or pg_catalog.strpos(actual.prosrc, 'cms_lock_revision_pattern_dependencies(p_revision_id)') = 0
       or pg_catalog.strpos(actual.prosrc, 'cms_lock_revision_pattern_dependencies(p_revision_id)')
            > pg_catalog.strpos(actual.prosrc, 'cms_content_type_versions')
       or pg_catalog.strpos(actual.prosrc, 'cms_content_type_versions')
            > pg_catalog.strpos(actual.prosrc, 'cms_editorial_reviews review_item') then
      raise exception 'DEC-199 locks: replacement verification failed: %', identity using errcode = '55000';
    end if;
  end loop;
end;
$migration$;

commit;
