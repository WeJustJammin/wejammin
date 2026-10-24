-- CMS-03C governed digest, pattern branch of platform_private.cms_governed_current_digest(text, uuid, jsonb).
-- The branch never produced a digest (pattern-def lane report, Requests to root 1).  Two defects, fixed forward as
-- two text anchors, each asserted to occur exactly once in the live body:
--   1. SELECT DISTINCT ... ORDER BY closure.block_key COLLATE "C" raised SQLSTATE 42P10 ("for SELECT DISTINCT, ORDER
--      BY expressions must appear in select list") for every pattern tree.  The DISTINCT moves into a subquery and the
--      ORDER BY (same keys, same "C" collation, same direction) is applied to the subquery's own columns.
--   2. A registered block with no lifecycle event has lifecycle NULL in the loop, so its tuple would hash
--      "lifecycle": null.  BE03c 306-313 makes lifecycle a registry-record member and 03a registers literal
--      `supported` (lifecycle changes only by CMS-03A-08 events); the loop already reads an absent event as
--      `supported` for its own guard, so the tuple now does too.  This is the value the pattern producer folds
--      (cms_pattern_registry_digest), which the submit comparison against it requires.
-- The template branch (cms_template_block_digest), the taxonomy branch (NULL), the per-block lock and refusals and
-- the tuple members are untouched; the pattern branch could not return before, so no previously produced digest
-- changes.  CREATE OR REPLACE keeps owner, ACL and comment; every pg_proc attribute except the body is compared
-- before and after.  A patch whose replacement is already present is skipped.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $amend$
declare
  target_identity constant text := 'platform_private.cms_governed_current_digest(text, uuid, jsonb)';
  anchors constant text[] := array[
    $a1$      select distinct closure.block_key, closure.block_version
        from platform_private.cms_governed_pattern_closure(p_owner_id, p_subject->'blockTree') closure
       where closure.item_kind = 'block'
       order by closure.block_key collate "C", closure.block_version
$a1$,
    $a2$        'lifecycle', current_lifecycle));$a2$];
  replacements constant text[] := array[
    $r1$      select reached.block_key, reached.block_version
        from (select distinct closure.block_key, closure.block_version
                from platform_private.cms_governed_pattern_closure(p_owner_id, p_subject->'blockTree') closure
               where closure.item_kind = 'block') reached
       order by reached.block_key collate "C", reached.block_version
$r1$,
    $r2$        'lifecycle', coalesce(current_lifecycle, 'supported')));$r2$];
  live pg_catalog.pg_proc%rowtype;
  patched text;
  before_attrs text;
  after_attrs text;
  occurrences integer;
  step integer;
begin
  select proc.* into live from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(target_identity);
  if not found then
    raise exception '% is missing', target_identity using errcode = '55000';
  end if;
  if live.prolang <> (select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql')
     or live.prorettype <> 'text'::pg_catalog.regtype or not live.prosecdef then
    raise exception '% does not have the expected shape', target_identity using errcode = '55000';
  end if;
  patched := live.prosrc;
  for step in 1 .. 2 loop
    occurrences := (pg_catalog.length(patched) - pg_catalog.length(pg_catalog.replace(patched, anchors[step], '')))
                   / pg_catalog.length(anchors[step]);
    if occurrences = 1 then
      patched := pg_catalog.replace(patched, anchors[step], replacements[step]);
    elsif occurrences = 0 and pg_catalog.strpos(patched, replacements[step]) > 0 then
      null; -- already applied
    else
      raise exception '% patch % anchor occurs % times', target_identity, step, occurrences using errcode = '55000';
    end if;
  end loop;
  if patched = live.prosrc then
    return;
  end if;
  before_attrs := (pg_catalog.to_jsonb(live) - 'prosrc')::text;
  execute pg_catalog.format(
    'create or replace function platform_private.cms_governed_current_digest(p_kind text, p_owner_id uuid, p_subject jsonb) '
    || 'returns text language plpgsql volatile security definer set search_path = %L as %L',
    '', patched);
  select (pg_catalog.to_jsonb(proc) - 'prosrc')::text into after_attrs
    from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(target_identity);
  if after_attrs is distinct from before_attrs then
    raise exception '%: owner, ACL, security, volatility or config changed', target_identity using errcode = '55000';
  end if;
end;
$amend$;

commit;
