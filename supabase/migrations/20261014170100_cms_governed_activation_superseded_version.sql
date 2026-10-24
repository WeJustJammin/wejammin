-- DEC-191, CMS-03C-09: GovernedActivationResource.supersededVersion (BE03c schema block; changelog row "FE03-BE03c read gap"; FE03 :882).
-- Anchored patch of platform_private.cms_activate_governed_subject(jsonb) (20261014070400, patched by 20261014150000 and 20261014160200): each
-- of the three answers gains the member, in front of its `action` member.
--   activate  'supersededVersion', cms_governed_definition_version(subject_kind, v_active): v_active is the lineage's previously active version
--             row, locked FOR UPDATE at position 3 and re-verified equal under the lineage advisory lock (a difference is activation_conflict),
--             so it is exactly the row the committed cms_governed_apply_activation superseded; NULL for a lineage's first activation (and a
--             lineage whose only earlier version was retired).  The helper is a plain read: the lock order is untouched.
--   schedule  null: nothing is superseded until the activation commits.
--   retire    null: a retirement supersedes nothing.
-- Idempotent replay needs no change: it returns the stored answer, which now carries the member.  Three anchors, each asserted to occur exactly
-- once in the live body; an already patched body (three members) is left alone, a partly patched one is refused.  CREATE OR REPLACE keeps owner,
-- ACL and comment; every pg_proc attribute except the body is compared before and after.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $amend$
declare
  target_identity constant text := 'platform_private.cms_activate_governed_subject(jsonb)';
  marker constant text := '''supersededVersion''';
  anchors constant text[] := array[
    $a1$'action', 'activate', 'subjectState', 'active',$a1$,
    $a2$'action', 'schedule', 'subjectState', 'scheduled',$a2$,
    $a3$'action', 'retire', 'subjectState', 'retired',$a3$
  ];
  replacements constant text[] := array[
    $r1$'supersededVersion', platform_private.cms_governed_definition_version(v_review.subject_kind, v_active),
      'action', 'activate', 'subjectState', 'active',$r1$,
    $r2$'supersededVersion', null,
    'action', 'schedule', 'subjectState', 'scheduled',$r2$,
    $r3$'supersededVersion', null,
      'action', 'retire', 'subjectState', 'retired',$r3$
  ];
  live pg_catalog.pg_proc%rowtype;
  patched text;
  before_attrs text;
  after_attrs text;
  occurrences integer;
  marked integer;
begin
  select proc.* into live from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(target_identity);
  if not found then
    raise exception '% is missing', target_identity using errcode = '55000';
  end if;
  if live.prolang <> (select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql')
     or live.prorettype <> 'jsonb'::pg_catalog.regtype or not live.prosecdef or live.provolatile <> 'v' then
    raise exception '% does not have the expected shape', target_identity using errcode = '55000';
  end if;
  marked := (pg_catalog.length(live.prosrc) - pg_catalog.length(pg_catalog.replace(live.prosrc, marker, '')))
            / pg_catalog.length(marker);
  if marked = 3 then
    return; -- already applied
  elsif marked <> 0 then
    raise exception '% carries % supersededVersion members, expected 0 or 3', target_identity, marked using errcode = '55000';
  end if;
  patched := live.prosrc;
  for i in 1 .. pg_catalog.cardinality(anchors) loop
    occurrences := (pg_catalog.length(patched) - pg_catalog.length(pg_catalog.replace(patched, anchors[i], '')))
                   / pg_catalog.length(anchors[i]);
    if occurrences <> 1 then
      raise exception '% patch anchor % occurs % times', target_identity, i, occurrences using errcode = '55000';
    end if;
    patched := pg_catalog.replace(patched, anchors[i], replacements[i]);
  end loop;
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
  'CMS-03C-09: the subject owner activates (200), schedules (202) or retires (200) a governed subject under unconditional step-up, the BE03c lock order and the review CAS. activate and schedule need an approved review and a full recheck (a changed dependency or a dead approval commits the invalidation and answers the committed refusal envelope); activate supersedes the previous active version and commits one audit record and exactly one activation event; schedule commits a pending schedule and no event. retire (DEC-190) needs only an ACTIVE subject (else subject_not_retirable), no fresh approval and no dependency, policy, provider or preflight validity; it commits retired, lifecycle + 1, retired_at, one audit record and exactly one subject-kind event, and advances the review version by one (like an activation). Every answer carries supersededVersion (DEC-191): the definition version of the previously active version a committed activate superseded, null for schedule, retire and a first activation. Private; the Worker calls the platform_api wrapper.';

commit;
