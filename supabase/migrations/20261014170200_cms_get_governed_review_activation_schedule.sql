-- DEC-191, CMS-03C-10: GovernedReviewDetailResource.activationSchedule (BE03c schema block; changelog row "FE03-BE03c read gap"; FE03 :1118).
-- Anchored patch of platform_private.cms_get_governed_review(jsonb) (20261014010300): the member, in front of `subjectState`, is
-- cms_governed_review_schedule(review): the review's most recent schedule as { state, reasonCode }, or null.  The helper is STABLE and the
-- member sits inside the one statement that builds the document, so the single snapshot (review, decisions, assignments, counts, schedule) holds;
-- the read still writes nothing and takes no lock.  The anchor must occur exactly once in the live body; a body that already carries the member is
-- left alone.  CREATE OR REPLACE keeps owner, ACL and comment; every pg_proc attribute except the body is compared before and after.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $amend$
declare
  target_identity constant text := 'platform_private.cms_get_governed_review(jsonb)';
  marker constant text := '''activationSchedule''';
  anchor constant text :=
    $a1$'subjectState', platform_private.cms_governed_subject_resolve(review_item.subject_kind, review_item.subject_id)->>'state',$a1$;
  replacement constant text :=
    $r1$'activationSchedule', platform_private.cms_governed_review_schedule(review_item.id),
           'subjectState', platform_private.cms_governed_subject_resolve(review_item.subject_kind, review_item.subject_id)->>'state',$r1$;
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
     or live.prorettype <> 'jsonb'::pg_catalog.regtype or not live.prosecdef then
    raise exception '% does not have the expected shape', target_identity using errcode = '55000';
  end if;
  marked := (pg_catalog.length(live.prosrc) - pg_catalog.length(pg_catalog.replace(live.prosrc, marker, '')))
            / pg_catalog.length(marker);
  if marked = 1 then
    return; -- already applied
  elsif marked <> 0 then
    raise exception '% carries % activationSchedule members, expected 0 or 1', target_identity, marked using errcode = '55000';
  end if;
  occurrences := (pg_catalog.length(live.prosrc) - pg_catalog.length(pg_catalog.replace(live.prosrc, anchor, '')))
                 / pg_catalog.length(anchor);
  if occurrences <> 1 then
    raise exception '% patch anchor occurs % times', target_identity, occurrences using errcode = '55000';
  end if;
  patched := pg_catalog.replace(live.prosrc, anchor, replacement);
  before_attrs := (pg_catalog.to_jsonb(live) - 'prosrc')::text;
  execute pg_catalog.format(
    'create or replace function platform_private.cms_get_governed_review(p_request jsonb) '
    || 'returns jsonb language plpgsql security definer set search_path = %L as %L',
    '', patched);
  select (pg_catalog.to_jsonb(proc) - 'prosrc')::text into after_attrs
    from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(target_identity);
  if after_attrs is distinct from before_attrs then
    raise exception '%: owner, ACL, security, volatility or config changed', target_identity using errcode = '55000';
  end if;
end;
$amend$;

comment on function platform_private.cms_get_governed_review(jsonb) is
  'CMS-03C-10: the role-scoped GovernedReviewDetailResource of one governed review, built in one statement (one snapshot): the base review, the recomputed block digest, the policy basis by label, the live distinctApprovalCount, decisions (own reason only), owner-only assignment summaries by display label, the caller''s own assignment, the subject state, the review''s most recent activation schedule as { state, reasonCode } or null (DEC-191) and the permitted next actions. 404 for a hidden, absent or foreign review, 403 for a member with no read scope. Writes nothing. Private; the Worker calls the platform_api wrapper.';

commit;
