-- CMS-03C-09, two refusal alignments of platform_private.cms_activate_governed_subject(jsonb) (20261014070400); root ruling, review
-- review-governed-worker-p3.md findings 1 and 3.
--   1. The committed invalidation of CMS-03C-09 answers `dependency_changed` for BOTH invalidation verdicts.  BE03c 1262 lists no
--      `review_not_open` for CMS-03C-09 and 1326 step 4 names the committed outcome exactly: "the RPC returns the outcome `invalidated`,
--      answered 409 ... with `details.reasonCode` `dependency_changed`" (the frozen CMS_SLICE_12_OPERATION_REASONS['CMS-03C-09'] agrees).
--      The review row still records WHY it was invalidated (`reviewer_authority_changed` for a dead approval, `dependency_changed`
--      otherwise): only the answer token changes.  Anchor:
--        'reasonCode', case v_verdict when 'dependency_changed' then 'dependency_changed' else 'review_not_open' end);
--        ->  'reasonCode', 'dependency_changed');
--   2. `resolved_utc_mismatch` raised without the contract-mandatory `expectedUtc` (CmsGovernedTimeRefusalDetailsSchema; BE03b 1846
--      step 7, 1934), so the Worker could only answer it 502.  The database owns no tz rules (BE03b 1849), so its member is the
--      instant nearest the supplied `resolvedUtc` whose offset against `localDateTime` lies inside the check's own -12 h .. +14 h window:
--      local - clamp(local - resolved, -12 h, +14 h).  The Worker's exact Time-authority check (step 7) runs first and owns the true
--      selected instant, so this member is reachable only if the Worker is bypassed.  Anchor:
--        raise exception 'resolved_utc_mismatch' using errcode = 'P0001';  ->  ... using errcode = 'P0001', detail = ...;
-- Anchored patches rather than a full redefinition, like 20261014080000: every untouched statement of the applied body is provably
-- identical.  Each anchor must occur exactly once in the live body; an anchor whose replacement is already present is skipped, so the
-- migration is idempotent.  CREATE OR REPLACE keeps owner, ACL and comment; every pg_proc attribute except the body is compared
-- before and after.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $amend$
declare
  target_identity constant text := 'platform_private.cms_activate_governed_subject(jsonb)';
  anchors constant text[] := array[
    $a1$      'reasonCode', case v_verdict when 'dependency_changed' then 'dependency_changed' else 'review_not_open' end);$a1$,
    $a2$      raise exception 'resolved_utc_mismatch' using errcode = 'P0001';$a2$
  ];
  replacements constant text[] := array[
    $r1$      'reasonCode', 'dependency_changed');$r1$,
    $r2$      raise exception 'resolved_utc_mismatch' using errcode = 'P0001',
        detail = pg_catalog.jsonb_build_object('expectedUtc', platform_private.auth_iso_time(
          (v_local - least(greatest(v_local - (v_resolved at time zone 'UTC'), interval '-12 hours'), interval '14 hours'))
            at time zone 'UTC'))::text;$r2$
  ];
  live pg_catalog.pg_proc%rowtype;
  patched text;
  before_attrs text;
  after_attrs text;
  occurrences integer;
  changed boolean := false;
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
  for i in 1 .. pg_catalog.cardinality(anchors) loop
    occurrences := (pg_catalog.length(patched) - pg_catalog.length(pg_catalog.replace(patched, anchors[i], '')))
                   / pg_catalog.length(anchors[i]);
    if occurrences = 1 then
      patched := pg_catalog.replace(patched, anchors[i], replacements[i]);
      changed := true;
    elsif not (occurrences = 0 and pg_catalog.strpos(patched, replacements[i]) > 0) then
      raise exception '% patch anchor % occurs % times', target_identity, i, occurrences using errcode = '55000';
    end if;
  end loop;
  if not changed then
    return; -- already applied
  end if;
  before_attrs := (pg_catalog.to_jsonb(live) - 'prosrc')::text;
  execute pg_catalog.format(
    'create or replace function platform_private.cms_activate_governed_subject(p_request jsonb) '
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
