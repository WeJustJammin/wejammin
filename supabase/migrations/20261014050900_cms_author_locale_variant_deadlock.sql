-- Slice 12 lane locale, typed deadlock of CMS-03C-04 (BE03c Slice 12 lock order 4 "Typed deadlock" 1357;
-- tracker P2-S12-AC-276, locale part, AC-057): `deadlock_detected` and a lock-acquisition failure
-- (`lock_not_available`, a lock_timeout at a lock step) inside the author command are converted to the 409
-- conflict of the operation's catalog (the typed retryable token CONFLICT every other CMS writer wrapper
-- raises for a residual deadlock, 20261005013100, which the Worker maps to 409 LOCALE_VERSION_CONFLICT)
-- with nothing committed: the command ran in a sub-transaction that the conversion
-- rolls back, including its idempotency reservation, so the same Idempotency-Key is reusable.
--
-- platform_api.cms_author_locale_variant remembers and restores the RPC-context flag around the private
-- command (20261003120410).  This migration puts that call in a nested block with the two handlers; a guarded
-- anchored amendment of the LIVE wrapper source (one anchor occurring exactly once, the inverse replacement
-- restores the installed source byte for byte, every pg_proc attribute except the source is unchanged).
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_api.cms_author_locale_variant(jsonb)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  definition text;
  comment_text text;
  anchor_old constant text :=
    $a$  rpc_result := platform_private.cms_author_locale_variant(p_request);$a$;
  anchor_new constant text :=
    $a$  begin
    rpc_result := platform_private.cms_author_locale_variant(p_request);
  exception
    when deadlock_detected or lock_not_available then
      -- The sub-transaction of this block is rolled back: nothing of the command, including its
      -- idempotency reservation, survives, and the same key may be retried.
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;$a$;
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'locale author wrapper missing: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if not original.prosecdef or original.prokind <> 'f'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'locale author wrapper: unexpected attributes' using errcode = '55000';
  end if;
  if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchor_old, '')))
       / pg_catalog.length(anchor_old) <> 1
     or pg_catalog.strpos(old_source, 'deadlock_detected') <> 0 then
    raise exception 'locale author wrapper: unexpected anchor' using errcode = '55000';
  end if;
  new_source := pg_catalog.replace(old_source, anchor_old, anchor_new);
  if pg_catalog.replace(new_source, anchor_new, anchor_old) <> old_source then
    raise exception 'locale author wrapper: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'locale author wrapper: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc <> new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' <> pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'locale author wrapper: replacement changed more than the source' using errcode = '55000';
  end if;
end;
$migration$;

commit;
