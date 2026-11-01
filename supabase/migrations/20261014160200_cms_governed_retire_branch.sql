-- CMS-03C-09 `retire` (DEC-190; BE03c 392, 1326, 1336-1357, 1546-1554): the retire branch of
-- platform_private.cms_activate_governed_subject(jsonb) (20261014070400, patched by 20261014150000).  Until now the structure step refused
-- `retire` as VALIDATION_FAILED ["/action"] and nothing was written; 20261014160000 lets it through and this patch gives it its branch.
--
-- Retire keeps every common control of the route, in the unchanged order: structure, the unconditional step-up before any reservation,
-- concealment, the subject-kind owner capability proved under position 1, the idempotency reservation, the subject row (position 3), the
-- dependency graph LOCKS (positions 3-4, locks only: nothing about the graph is judged), the review row (position 5) and the review `version`
-- CAS.  It then differs from activate/schedule in exactly four places, each one anchored line of the live body:
--   B1  the review need not be `approved` (no fresh approval; DEC-190): `v_review.state <> 'approved'` applies to activate and schedule only;
--   B2  the resolved subject must be `active`, else 409 `subject_not_retirable` (activate/schedule: approved or blocked, else subject_not_activatable);
--   B3  no recheck: the verdict (hash, policy basis, dependencies, canonical providers, live approvals) is not consulted, so a stale
--       dependency, a missing provider or an unavailable workflow policy cannot stop a retirement and nothing is invalidated;
--   B4  after the lineage advisory lock (the last position, like activate) the retirement is applied (cms_governed_apply_retirement: subject
--       retired, lifecycle + 1, retired_at, one audit record, exactly one subject-kind event) and the 200 resource is stored and returned.
--       The review `version` advances by one under CAS inside that helper, like activate (root ruling on DEC-190), and is the response's.
-- No lineage active-row lock is taken for retire (BE03c 1348: that row is `activate` only); the subject row, held since position 3, is the row
-- being changed.  Four anchors, each asserted to occur exactly once in the live body and independently skippable when its replacement is
-- present (idempotent), like 20261014150000.  CREATE OR REPLACE keeps owner, ACL and comment; every pg_proc attribute except the body is
-- compared before and after.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $amend$
declare
  target_identity constant text := 'platform_private.cms_activate_governed_subject(jsonb)';
  anchors constant text[] := array[
    $a1$  if v_review.state <> 'approved' then$a1$,
    $a2$  if v_subject->>'state' not in ('approved', 'blocked') then$a2$,
    $a3$  v_verdict := platform_private.cms_governed_activation_verdict(v_review.id);$a3$,
    $a4$  perform platform_private.cms_governed_take_lineage_advisory(v_review.subject_kind, v_review.lineage_id);
  if v_action = 'activate' then
$a4$
  ];
  replacements constant text[] := array[
    $r1$  if v_review.state <> 'approved' and v_action <> 'retire' then$r1$,
    $r2$  if v_action = 'retire' and v_subject->>'state' is distinct from 'active' then
    raise exception 'subject_not_retirable' using errcode = 'P0001';
  end if;
  if v_action <> 'retire' and v_subject->>'state' not in ('approved', 'blocked') then$r2$,
    $r3$  v_verdict := case when v_action = 'retire' then 'current'
                     else platform_private.cms_governed_activation_verdict(v_review.id) end;$r3$,
    $r4$  perform platform_private.cms_governed_take_lineage_advisory(v_review.subject_kind, v_review.lineage_id);
  if v_action = 'retire' then
    v_at := pg_catalog.clock_timestamp();
    v_applied := platform_private.cms_governed_apply_retirement(v_review.id, v_actor_id, v_party_id, v_correlation, v_at);
    v_response := pg_catalog.jsonb_build_object(
      'reviewId', v_review.id, 'reviewVersion', v_applied->>'reviewVersion', 'subjectKind', v_review.subject_kind,
      'subjectId', v_review.subject_id, 'lineageId', v_review.lineage_id, 'subjectVersion', v_review.subject_version,
      'action', 'retire', 'subjectState', 'retired', 'activatedAt', v_applied->>'activatedAt',
      'scheduledForUtc', null, 'eventType', v_applied->>'eventType');
    perform platform_private.cms_complete(v_reservation.id, v_review.subject_id, 200, v_response);
    return v_response;
  end if;
  if v_action = 'activate' then
$r4$
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
     or live.prorettype <> 'jsonb'::pg_catalog.regtype or not live.prosecdef or live.provolatile <> 'v' then
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

comment on function platform_private.cms_activate_governed_subject(jsonb) is
  'CMS-03C-09: the subject owner activates (200), schedules (202) or retires (200) a governed subject under unconditional step-up, the BE03c lock order and the review CAS. activate and schedule need an approved review and a full recheck (a changed dependency or a dead approval commits the invalidation and answers the committed refusal envelope); activate supersedes the previous active version and commits one audit record and exactly one activation event; schedule commits a pending schedule and no event. retire (DEC-190) needs only an ACTIVE subject (else subject_not_retirable), no fresh approval and no dependency, policy, provider or preflight validity; it commits retired, lifecycle + 1, retired_at, one audit record and exactly one subject-kind event, and advances the review version by one (like an activation). Private; the Worker calls the platform_api wrapper.';

commit;
