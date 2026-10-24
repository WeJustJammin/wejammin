-- CMS-03C governed digest, lifecycle guard of the pattern branch of
-- platform_private.cms_governed_current_digest(text, uuid, jsonb).
-- BE03c 396 and 1361: CMS-03C-12 resolves every reachable block from the 03a registry and rejects a missing,
-- withdrawn or incompatible block; a registered DEPRECATED block is admitted.  "The digest is recomputed again at
-- activation and at 03b publication preflight."  The recompute (20261013300400, patched by 20261014040000) instead
-- raised CONFLICT for any block whose lifecycle is not `supported`, so a pattern draft over a deprecated block was
-- created but its governed submit, decision, activation and recheck all failed.
-- One text anchor, asserted to occur exactly once in the live body:
--   if coalesce(current_lifecycle, 'supported') <> 'supported' then   ->   ... = 'withdrawn' then
-- A deprecated block now passes the guard and its tuple records `deprecated` (20261014040000 already folds
-- coalesce(current_lifecycle, 'supported') into the tuple, the form cms_pattern_registry_digest produces); a
-- withdrawn block still raises CONFLICT and a missing block still raises VALIDATION_FAILED.  The template branch
-- (cms_template_block_digest), the taxonomy branch (NULL), the per-block lock and the other tuple members are
-- untouched, so no template digest, taxonomy digest or supported-only pattern digest changes: every digest the
-- recompute could return before this patch is byte-identical after it.
-- Anchored patch rather than a full redefinition, like 20261014040000: every untouched statement of the applied
-- body is provably identical.  CREATE OR REPLACE keeps owner, ACL and comment; every pg_proc attribute except the
-- body is compared before and after.  A patch whose replacement is already present is skipped.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $amend$
declare
  target_identity constant text := 'platform_private.cms_governed_current_digest(text, uuid, jsonb)';
  anchor constant text := $a1$      if coalesce(current_lifecycle, 'supported') <> 'supported' then$a1$;
  replacement constant text := $r1$      if coalesce(current_lifecycle, 'supported') = 'withdrawn' then$r1$;
  live pg_catalog.pg_proc%rowtype;
  patched text;
  before_attrs text;
  after_attrs text;
  occurrences integer;
begin
  select proc.* into live from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(target_identity);
  if not found then
    raise exception '% is missing', target_identity using errcode = '55000';
  end if;
  if live.prolang <> (select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql')
     or live.prorettype <> 'text'::pg_catalog.regtype or not live.prosecdef then
    raise exception '% does not have the expected shape', target_identity using errcode = '55000';
  end if;
  occurrences := (pg_catalog.length(live.prosrc) - pg_catalog.length(pg_catalog.replace(live.prosrc, anchor, '')))
                 / pg_catalog.length(anchor);
  if occurrences = 1 then
    patched := pg_catalog.replace(live.prosrc, anchor, replacement);
  elsif occurrences = 0 and pg_catalog.strpos(live.prosrc, replacement) > 0 then
    return; -- already applied
  else
    raise exception '% patch anchor occurs % times', target_identity, occurrences using errcode = '55000';
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
