-- CMS-03C-01 (platform_private.cms_define_template, last defined by 20261013100200): a well-formed caller `blockRegistryDigest`
-- that differs from the recomputed one is refused with the closed token `block_registry_digest_mismatch` and the one-pointer DETAIL
-- `["/blockRegistryDigest"]`, exactly as the pattern producers refuse it (20261014020400, 20261014110300).  BE03c 323-327 ("a
-- well-formed digest that differs from the recomputed one writes nothing and is 409 with the closed `details.reasonCode`
-- `block_registry_digest_mismatch` on CMS-03C-01"), 373 and 1273 (the CMS-03C-01 conflict column), 1323 (the token is listed on
-- CMS-03C-01, -02 and -12); DEC-186 item 2.  The shipped producer raised the generic `CONFLICT`: still a 409-class refusal, but
-- not the closed token the spec and the contract (`CMS_SLICE_12_OPERATION_REASONS['CMS-03C-01']`) name.
-- One anchored patch rather than a full redefinition: every untouched statement of the applied body is provably identical, and the
-- stale expectedVersion, taken-key and version-ceiling refusals keep the generic `CONFLICT`.  The anchor must occur exactly once in
-- the live body; an anchor whose replacement is already present is skipped, so the migration is idempotent.  CREATE OR REPLACE
-- keeps owner, ACL and comment; every pg_proc attribute except the body is compared before and after.  platform_api.cms_define_template
-- (advisory key lock and RPC flag restore) re-raises nothing and is untouched.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $amend$
declare
  target_identity constant text := 'platform_private.cms_define_template(jsonb)';
  anchor constant text := $a1$     and p_request->>'blockRegistryDigest' <> block_digest then
    raise exception 'CONFLICT' using errcode = 'P0001';$a1$;
  replacement constant text := $r1$     and p_request->>'blockRegistryDigest' <> block_digest then
    raise exception 'block_registry_digest_mismatch' using errcode = 'P0001', detail = '["/blockRegistryDigest"]';$r1$;
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
     or live.prorettype <> 'jsonb'::pg_catalog.regtype or not live.prosecdef then
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
    'create or replace function platform_private.cms_define_template(p_request jsonb) '
    || 'returns jsonb language plpgsql volatile security definer set search_path = %L as %L',
    '', patched);
  select (pg_catalog.to_jsonb(proc) - 'prosrc')::text into after_attrs
    from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(target_identity);
  if after_attrs is distinct from before_attrs then
    raise exception '%: owner, ACL, security, volatility or config changed', target_identity using errcode = '55000';
  end if;
end;
$amend$;

commit;
