-- CMS-03C-09 `retire` (DEC-190; BE03c 392, 1326): the structure step of platform_private.cms_governed_activation_request(jsonb)
-- (20261014070300) accepts the third action.
--   * `retire` joins `activate` and `schedule` as an accepted action (an unknown action is still VALIDATION_FAILED ["/action"]).
--   * `retire` takes the review `version` as expectedVersion like the other actions and an OPTIONAL `reason` of 1..256 code points,
--     already NFC (BE03c 392, DEC-158, the contract's ReviewAssignmentReasonSchema): anything else is VALIDATION_FAILED ["/reason"]
--     (cms_editorial_reason_valid, the rule CMS-03C-08 applies).  `reason` on activate or schedule and `activateAt` on retire stay INVALID_REQUEST.
--   * the answer for `retire` is the activate shape { reviewId, action, expectedVersion }; the reason is checked, not carried: BE03c names no
--     column, audit member or event member that stores it (reported as a BOUNDARY), and it is part of the idempotency request hash.
-- Three anchors, each asserted to occur exactly once in the live body and independently skippable when its replacement is present
-- (idempotent), like 20261014150000.  CREATE OR REPLACE keeps owner, ACL and comment; every pg_proc attribute except the body is compared
-- before and after.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $amend$
declare
  target_identity constant text := 'platform_private.cms_governed_activation_request(jsonb)';
  anchors constant text[] := array[
    $a1$     or p_request->>'action' not in ('activate', 'schedule') then
    -- BOUNDARY: `retire` requires the owner's confirmation of the retirement policy (propagation scan section R); until then it is refused
    -- like any action outside the implemented set.
$a1$,
    $a2$  if (v_action = 'schedule') <> (p_request ? 'activateAt') or p_request ? 'reason' then$a2$,
    $a3$  if v_action = 'activate' then
    return v_answer;
  end if;
$a3$
  ];
  replacements constant text[] := array[
    $r1$     or p_request->>'action' not in ('activate', 'schedule', 'retire') then
$r1$,
    $r2$  if (v_action = 'schedule') <> (p_request ? 'activateAt') or (p_request ? 'reason' and v_action <> 'retire') then$r2$,
    $r3$  if v_action = 'retire' and p_request ? 'reason' then
    if pg_catalog.jsonb_typeof(p_request->'reason') is distinct from 'string'
       or not platform_private.cms_editorial_reason_valid(p_request->>'reason', 256, false) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/reason"]';
    end if;
  end if;
  if v_action in ('activate', 'retire') then
    return v_answer;
  end if;
$r3$
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
     or live.prorettype <> 'jsonb'::pg_catalog.regtype or not live.prosecdef or live.provolatile <> 's' then
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
    'create or replace function platform_private.cms_governed_activation_request(p_request jsonb) '
    || 'returns jsonb language plpgsql stable security definer set search_path = %L as %L',
    '', patched);
  select (pg_catalog.to_jsonb(proc) - 'prosrc')::text into after_attrs
    from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(target_identity);
  if after_attrs is distinct from before_attrs then
    raise exception '%: owner, ACL, security, volatility or config changed', target_identity using errcode = '55000';
  end if;
end;
$amend$;

comment on function platform_private.cms_governed_activation_request(jsonb) is
  'BE03c CMS-03C-09 structure step: validates the GovernedActivationRequest (activate | schedule | retire, DEC-190) and answers the parsed review id, action, expected version and, for schedule, the floored local and resolved instants. retire takes an optional reason of 1..256 NFC code points (VALIDATION_FAILED /reason). Reads and writes nothing. Private; STABLE.';

commit;
