-- CMS-03C-06 submit refusals, forward fixes to the live body of platform_private.cms_submit_governed_review(jsonb)
-- (20261013300820).  Three anchored patches, each anchor asserted to occur exactly once; this migration folds the
-- reviewed taxonomy-def amendment 20261014030500 (patch 2), which is not promoted separately.
--   1. An inactive nested pattern is subject_not_submittable (409), not pattern_version_not_active: BE03c 1304 scopes
--      that token to CMS-03C-02/12/15 (a pattern version a REQUEST names), and DEC-180 R5 gives 422 only to request
--      validation; the nested pattern is a stored dependency of the subject (BE03c 389, 1313).
--   2. canonical_source_unavailable carries DETAIL {"domain": <first declared domain, in declaration order, whose
--      current provider is not built>} (BE03c 1314, 1375, 1611; FE03 1115; DEC-180 G11).
--   3. A stored-hash mismatch is a request validation failure, 422 at /subjectHash: VALIDATION_FAILED with the
--      pointer-array DETAIL ["/subjectHash"] (BE03c 389, 1259; FE03 1115).  409 subject_not_submittable stays for a
--      subject that is not draft or has a live review.  The hash is compared before the state (spec order, 389).
-- CREATE OR REPLACE keeps owner and ACL; every pg_proc attribute except the body is compared before and after.
-- A patch whose replacement (patch 2: the `jsonb_build_object('domain'` marker) is already present is skipped, so it
-- composes with a separately promoted 030500.
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $amend$
declare
  target_identity constant text := 'platform_private.cms_submit_governed_review(jsonb)';
  anchors constant text[] := array[
    $a1$raise exception 'pattern_version_not_active' using errcode = 'P0001';$a1$,
    $a2$raise exception 'canonical_source_unavailable' using errcode = 'P0001';$a2$,
    $a3$  if subject->>'state' is distinct from 'draft'
     or subject->>'contentHash' is distinct from subject_hash then
$a3$];
  replacements constant text[] := array[
    $r1$raise exception 'subject_not_submittable' using errcode = 'P0001';$r1$,
    $r2$raise exception 'canonical_source_unavailable' using errcode = 'P0001',
        detail = pg_catalog.jsonb_build_object('domain', (
          select declared.value
            from pg_catalog.jsonb_array_elements_text(coalesce(subject->'canonicalDomains', '[]'::jsonb))
                 with ordinality declared(value, ord)
           where not exists (
             select 1 from platform_private.cms_canonical_domain_current(declared.value) current_row
              where current_row.provider_state = 'built')
           order by declared.ord limit 1))::text;$r2$,
    $r3$  if subject->>'contentHash' is distinct from subject_hash then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/subjectHash"]';
  end if;
  if subject->>'state' is distinct from 'draft' then
$r3$];
  applied_markers constant text[] := array[null::text, $m2$jsonb_build_object('domain'$m2$, null::text];
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
     or live.prorettype <> 'jsonb'::pg_catalog.regtype or not live.prosecdef then
    raise exception '% does not have the expected shape', target_identity using errcode = '55000';
  end if;
  patched := live.prosrc;
  for step in 1 .. 3 loop
    occurrences := (pg_catalog.length(patched) - pg_catalog.length(pg_catalog.replace(patched, anchors[step], '')))
                   / pg_catalog.length(anchors[step]);
    if occurrences = 1 then
      patched := pg_catalog.replace(patched, anchors[step], replacements[step]);
    elsif occurrences = 0
          and pg_catalog.strpos(patched, coalesce(applied_markers[step], replacements[step])) > 0 then
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
    'create or replace function platform_private.cms_submit_governed_review(p_request jsonb) returns jsonb '
    || 'language plpgsql volatile security definer set search_path = %L as %L',
    '', patched);
  select (pg_catalog.to_jsonb(proc) - 'prosrc')::text into after_attrs
    from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(target_identity);
  if after_attrs is distinct from before_attrs then
    raise exception '%: owner, ACL, security, volatility or config changed', target_identity using errcode = '55000';
  end if;
end;
$amend$;

commit;
