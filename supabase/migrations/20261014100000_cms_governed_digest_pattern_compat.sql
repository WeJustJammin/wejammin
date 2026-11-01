-- CMS-03C governed digest, block-compatibility check of the pattern branch of
-- platform_private.cms_governed_current_digest(text, uuid, jsonb).
-- BE03c 317-327: the server recomputes the block registry digest at pattern create, pattern activate and 03b
-- publication preflight, and "missing, withdrawn, incompatible ... block references fail closed before mutation or
-- publication"; 1361: CMS-03C-12 "rejects a missing, withdrawn or incompatible block ... the digest is recomputed
-- again at activation and at 03b publication preflight"; 1500: a template activates "only after exact compatibility
-- checks".  The template branch re-enforces the compiler range at submit, decision, activation and recheck because it
-- delegates to cms_template_block_digest (20261014090100).  The pattern branch (20261013300400, patched by
-- 20261014040000 and 20261014080000) checked the registry and the withdrawn lifecycle only, so a pattern whose bound
-- type moved to an artifact compiler outside a block's registered range after the draft was created could still be
-- submitted (review-block-compat.md section 5, finding 1; the design note of 20261013300400:9-11 intended parity).
-- One text anchor, asserted to occur exactly once in the live body, the end of the block loop and the fold return:
--   end loop;   return ...cms_jcs_sha256(tuples);   ->   end loop;  <compatibility check>  return ...
-- The check calls platform_private.cms_pattern_blocks_compatible (20261014090200), the very predicate the pattern
-- producer applies, over the blocks the tree reaches (nested patterns included) and the subject's bound types
-- (typeIds; none bound = nothing to be incompatible with), and refuses exactly as the producer refuses an
-- incompatible block: P0001, message VALIDATION_FAILED, DETAIL ["/blockTree"].  Missing and withdrawn blocks are
-- refused earlier in the loop with their existing tokens; a deprecated block is admitted.  The frozen recheck maps any
-- raise to `changed`.  The template branch, the taxonomy branch, the per-block lock, the loop and the tuple are
-- untouched: every digest the recompute could return before this patch is byte-identical after it, and only a
-- previously returnable but incompatible pattern now raises.
-- Anchored patch rather than a full redefinition, like 20261014040000 and 20261014080000: every untouched statement of
-- the applied body is provably identical.  CREATE OR REPLACE keeps owner, ACL and comment; every pg_proc attribute
-- except the body is compared before and after.  A patch whose replacement is already present is skipped.
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $amend$
declare
  target_identity constant text := 'platform_private.cms_governed_current_digest(text, uuid, jsonb)';
  anchor constant text := $a1$    end loop;
    return platform_private.cms_jcs_sha256(tuples);$a1$;
  replacement constant text := $r1$    end loop;
    if not platform_private.cms_pattern_blocks_compatible(
         p_owner_id, p_subject->'blockTree', coalesce(p_subject->'typeIds', '[]'::pg_catalog.jsonb)) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/blockTree"]';
    end if;
    return platform_private.cms_jcs_sha256(tuples);$r1$;
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
