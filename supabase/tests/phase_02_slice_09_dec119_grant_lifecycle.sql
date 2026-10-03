\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-119/DEC-120 QA-RED: CMS-03A-16 renew and CMS-03A-17 revoke a
-- CMS capability grant.  The owner is the immutable-receipt identity; the term
-- restarts from the current UTC date (validThrough <= today + 89, no cumulative
-- cap); a revoked aggregate is refused for renewal and re-established by grant;
-- every write is CAS-guarded, idempotent, and atomic with its projection, event,
-- audit and outbox rows.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

select pg_temp.s09g_member('rev1');
select pg_temp.s09g_member('rev2');
select pg_temp.s09g_grant('l:a', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(5));
select pg_temp.s09g_grant('l:e', 'owner', 'rev1', 'cms.editor', pg_temp.s09g_day(5));
select pg_temp.s09g_grant('l:r', 'owner', 'rev2', 'cms.reviewer', pg_temp.s09g_day(5));
select pg_temp.s09d_remember('gA', pg_temp.s09g_grant_id(pg_temp.s09d_resp('l:a')));
select pg_temp.s09d_remember('gE', pg_temp.s09g_grant_id(pg_temp.s09d_resp('l:e')));
select pg_temp.s09d_remember('gR', pg_temp.s09g_grant_id(pg_temp.s09d_resp('l:r')));
select is(pg_temp.s09d_outcome('l:a') || pg_temp.s09d_outcome('l:e') || pg_temp.s09d_outcome('l:r'), 'OKOKOK',
  'precondition: three aggregates exist, each created by the grant command');

-- Refusals (atomic).
select pg_temp.s09g_fingerprint() as before_fp \gset
select pg_temp.s09g_renew('n:designer2', 'designer2', pg_temp.s09d_id('gA'), '1', pg_temp.s09g_day(8));
select is(pg_temp.s09d_outcome('n:designer2'), 'FORBIDDEN', 'renewal by a non-owner designer is 403 [P2-S09-AC-556]');
select pg_temp.s09g_revoke('v:other', 'other', pg_temp.s09d_id('gA'), '1');
select is(pg_temp.s09d_outcome('v:other'), 'FORBIDDEN', 'revocation by another organization''s designer is 403 [P2-S09-AC-585]');
select pg_temp.s09g_renew('n:nobinding', 'owner', pg_temp.s09d_id('gA'), '1', pg_temp.s09g_day(8), '{}', null, false);
select is(pg_temp.s09d_outcome('n:nobinding'), 'STEP_UP_REQUIRED', 'renewal without the private binding is 401 STEP_UP_REQUIRED [P2-S09-AC-556]');
-- TIME-WARP: a stale or recent acting-context binding (heartbeat, MFA recency, expiry) cannot be produced without waiting; the binding itself was selected through identity_context_bind.
update platform_private.acting_context_binding set last_seen_at = clock_timestamp() - interval '20 minutes'
 where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;
select pg_temp.s09g_revoke('v:stale', 'owner', pg_temp.s09d_id('gA'), '1');
select is(pg_temp.s09d_outcome('v:stale'), 'STEP_UP_REQUIRED', 'revocation with stale MFA is 401 STEP_UP_REQUIRED [P2-S09-AC-585]');
update platform_private.acting_context_binding set last_seen_at = clock_timestamp()
 where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;
select pg_temp.s09g_renew('n:absent', 'owner', extensions.gen_random_uuid(), '1', pg_temp.s09g_day(8));
select is(pg_temp.s09d_outcome('n:absent'), 'NOT_FOUND', 'an absent grant is 404');
select pg_temp.s09g_revoke('v:absent', 'owner', extensions.gen_random_uuid(), '1');
select is(pg_temp.s09d_outcome('v:absent'), 'NOT_FOUND', 'revoking an absent grant is 404');
select pg_temp.s09d_rpc('n:badid', 'platform_api.cms_renew_capability_grant', 'owner', jsonb_build_object(
  'grantId', 'not-a-uuid', 'expectedVersion', '1', 'validThrough', pg_temp.s09g_day(8),
  'idempotencyKey', pg_temp.s09g_key('badid')), true);
select is(pg_temp.s09d_outcome('n:badid'), 'INVALID_REQUEST', 'a malformed grant id is 400');
select pg_temp.s09g_renew('n:stale', 'owner', pg_temp.s09d_id('gA'), '9', pg_temp.s09g_day(8));
select is(pg_temp.s09d_outcome('n:stale'), 'VERSION_MISMATCH', 'a stale expected version is 409 VERSION_MISMATCH');
select pg_temp.s09g_renew('n:ver0', 'owner', pg_temp.s09d_id('gA'), '0', pg_temp.s09g_day(8));
select pg_temp.s09g_renew('n:verx', 'owner', pg_temp.s09d_id('gA'), 'abc', pg_temp.s09g_day(8));
select is(pg_temp.s09d_outcome('n:ver0') || pg_temp.s09d_outcome('n:verx'), 'INVALID_REQUESTINVALID_REQUEST',
  'a non-positive or non-numeric expected version is 400');
select pg_temp.s09g_renew('n:t90', 'owner', pg_temp.s09d_id('gA'), '1', pg_temp.s09g_day(90));
select pg_temp.s09g_renew('n:tpast', 'owner', pg_temp.s09d_id('gA'), '1', pg_temp.s09g_day(-1));
select pg_temp.s09g_renew('n:tbad', 'owner', pg_temp.s09d_id('gA'), '1', '2027-02-30');
select is(pg_temp.s09d_outcome('n:t90') || pg_temp.s09d_outcome('n:tpast') || pg_temp.s09d_outcome('n:tbad'),
  'VALIDATION_FAILEDVALIDATION_FAILEDVALIDATION_FAILED',
  'renewal to today + 90, a past date or a non-calendar date is 422');
select pg_temp.s09g_renew('n:unknownkey', 'owner', pg_temp.s09d_id('gA'), '1', pg_temp.s09g_day(8), '{"capability": "cms.editor"}');
select is(pg_temp.s09d_outcome('n:unknownkey'), 'INVALID_REQUEST', 'a renewal may not carry a capability or subject (unknown key is 400)');
select is(pg_temp.s09g_fingerprint(), :'before_fp', 'every refusal left every effect table unchanged');

-- Renewal of an effective aggregate: the term restarts from today, +89 allowed.
select count(*) as audit_before from audit_private.audit_events \gset
select count(*) as outbox_before from platform_private.outbox_events \gset
select pg_temp.s09g_renew('n:ok', 'owner', pg_temp.s09d_id('gA'), '1', pg_temp.s09g_day(89), '{"reason": "Extended"}');
select is(pg_temp.s09d_outcome('n:ok'), 'OK', 'the owner renews an effective aggregate to today + 89 (200) [P2-S09-AC-557]');
select ok((select r->>'version' = '2' and r->>'lastAction' = 'renewed' and r->>'state' = 'active'
    and r->>'validFrom' = pg_temp.s09g_day(0) and r->>'validThrough' = pg_temp.s09g_day(89)
    and r->>'id' = pg_temp.s09d_id('gA')::text and r->>'reason' = 'Extended'
    from (select pg_temp.s09d_resp('n:ok') r) s),
  'the renewed resource is version 2, lastAction renewed, with the term restarted from today [P2-S09-AC-555]');
select is(pg_temp.s09g_projection('rev1', 'cms.author'),
  format('true|%s|%s|cms.author', pg_temp.s09g_day(0), pg_temp.s09g_day(89)),
  'the actor-grant projection carries the renewed term in the same transaction [P2-S09-AC-560]');
select is((select count(*)::integer from platform_private.cms_capability_grant_events e
  where e.grant_id = pg_temp.s09d_id('gA') and e.action = 'renewed' and e.aggregate_version = 2
    and e.prior_valid_through = pg_temp.s09g_today() + 5 and e.valid_through = pg_temp.s09g_today() + 89
    and e.binding_context_hash ~ '^[a-f0-9]{64}$'), 1,
  'one renewed event records the prior and the new valid_through [P2-S09-AC-560]');
select is((select count(*)::integer from audit_private.audit_events) - :audit_before, 1, 'one audit row for the renewal [P2-S09-AC-560]');
select ok(exists (select 1 from platform_private.outbox_events o
  where o.event_type = 'cms.capability.grant.changed.v1' and o.aggregate_id = pg_temp.s09d_id('gA')
    and o.aggregate_version = 2 and o.payload = jsonb_build_object('grantId', pg_temp.s09d_id('gA')::text,
      'subjectPersonId', pg_temp.s09d_actor_id('rev1', 'person')))
  and (select count(*)::integer from platform_private.outbox_events) - :outbox_before = 1,
  'one outbox event with the committed aggregate version 2 [P2-S09-AC-560]');

-- Repeated renewal has no cumulative cap.
select pg_temp.s09g_renew('c:' || n, 'owner', pg_temp.s09d_id('gA'), (n + 1)::text, pg_temp.s09g_day(89))
from generate_series(1, 4) n;
select is((select count(*)::integer from s09d_probe where label like 'c:%' and state = '00000'), 4,
  'four consecutive renewals to today + 89 all succeed [P2-S09-AC-555]');
select is((select version::text from platform_private.cms_capability_grants where id = pg_temp.s09d_id('gA')), '6',
  'the aggregate version counts every renewal [P2-S09-AC-555]');

-- Replay and changed body.
select pg_temp.s09d_replay_pair('rp', 'platform_api.cms_renew_capability_grant', 'owner', jsonb_build_object(
  'grantId', pg_temp.s09d_id('gE'), 'expectedVersion', '1', 'validThrough', pg_temp.s09g_day(20),
  'idempotencyKey', 's09g-renew-fixed-key'), true);
select ok(pg_temp.s09d_resp('rp.1') is not null and pg_temp.s09d_resp('rp.1') = pg_temp.s09d_resp('rp.2'),
  'an exact same-key renewal retry replays the first response [P2-S09-AC-559]');
select is((select count(*)::integer from platform_private.cms_capability_grant_events where grant_id = pg_temp.s09d_id('gE')), 2,
  'the replay wrote no second event');
select pg_temp.s09g_renew('rp:changed', 'owner', pg_temp.s09d_id('gE'), '1', pg_temp.s09g_day(21), '{}', 's09g-renew-fixed-key');
select is(pg_temp.s09d_outcome('rp:changed'), 'CONFLICT', 'the same key with a changed body is 409');
select pg_temp.s09g_renew('cas:2', 'owner', pg_temp.s09d_id('gE'), '1', pg_temp.s09g_day(22));
select is(pg_temp.s09d_outcome('cas:2'), 'VERSION_MISMATCH', 'a second command carrying the same expected version loses the CAS (409 VERSION_MISMATCH) [P2-S09-AC-558]');
select ok(pg_temp.s09d_def('platform_private.cms_renew_capability_grant(jsonb)') ilike '%for update%'
  and pg_temp.s09d_def('platform_private.cms_revoke_capability_grant(jsonb)') ilike '%for update%'
  and pg_temp.s09d_def('platform_private.cms_grant_capability(jsonb)') ilike '%for update%',
  'the three commands lock the aggregate (or its key) with SELECT FOR UPDATE [P2-S09-AC-529] [P2-S09-AC-558]');

-- Lapse, renewal of a lapsed aggregate, and the end of the UTC day.
select ok(pg_temp.s09g_holds('rev2', 'cms.reviewer'), 'precondition: the reviewer grant is effective');
select ok(pg_temp.s09g_warp('rev2', 'cms.reviewer', -10, -1) and not pg_temp.s09g_holds('rev2', 'cms.reviewer'),
  'a grant whose last UTC day was yesterday has lapsed and is no longer effective [P2-S09-AC-584]');
select ok(pg_temp.s09g_warp('rev2', 'cms.reviewer', -10, 0) and pg_temp.s09g_holds('rev2', 'cms.reviewer'),
  'a grant is effective through the end of its validThrough UTC day [P2-S09-AC-584]');
select ok(pg_temp.s09g_warp('rev2', 'cms.reviewer', -10, -1), 'precondition: lapsed again');
select pg_temp.s09g_renew('lapsed', 'owner', pg_temp.s09d_id('gR'), '1', pg_temp.s09g_day(30));
select is(pg_temp.s09d_outcome('lapsed'), 'OK', 'a lapsed (physically active) aggregate can be renewed [P2-S09-AC-557]');
select ok(pg_temp.s09g_holds('rev2', 'cms.reviewer') and (select r->>'state' = 'active' and r->>'validFrom' = pg_temp.s09g_day(0)
  from (select pg_temp.s09d_resp('lapsed') r) s), 'the renewed lapsed aggregate is effective again and active');

-- Immediate revocation, refusal of renewal/revoke on a revoked aggregate, re-establishment by grant.
select count(*) as audit_before2 from audit_private.audit_events \gset
select pg_temp.s09g_revoke('rev', 'owner', pg_temp.s09d_id('gE'), '2', '{"reason": "Done"}');
select is(pg_temp.s09d_outcome('rev'), 'OK', 'the owner revokes an active aggregate (200) [P2-S09-AC-583]');
select ok((select r->>'state' = 'revoked' and r->>'lastAction' = 'revoked' and r->>'version' = '3'
    from (select pg_temp.s09d_resp('rev') r) s) and not pg_temp.s09g_holds('rev1', 'cms.editor'),
  'the revoked resource is version 3 and the capability is not effective in the same transaction [P2-S09-AC-583] [P2-S09-AC-584]');
select is(pg_temp.s09g_projection('rev1', 'cms.editor') like 'false|%', true, 'the projection row is deactivated [P2-S09-AC-583]');
select is((select count(*)::integer from platform_private.cms_capability_grant_events
  where grant_id = pg_temp.s09d_id('gE') and action = 'revoked' and aggregate_version = 3), 1, 'one revoked event [P2-S09-AC-588]');
select is((select count(*)::integer from audit_private.audit_events) - :audit_before2, 1, 'one audit row for the revocation [P2-S09-AC-588]');
select pg_temp.s09g_renew('rev:renew', 'owner', pg_temp.s09d_id('gE'), '3', pg_temp.s09g_day(9));
select is(pg_temp.s09d_outcome('rev:renew'), 'CONFLICT', 'a revoked aggregate is refused for renewal (409) [P2-S09-AC-557]');
select pg_temp.s09g_revoke('rev:again', 'owner', pg_temp.s09d_id('gE'), '3');
select is(pg_temp.s09d_outcome('rev:again'), 'CONFLICT', 'a revoked aggregate is refused for a second revocation (409) [P2-S09-AC-594]');
select pg_temp.s09g_grant('rev:regrant', 'owner', 'rev1', 'cms.editor', pg_temp.s09g_day(9));
select ok(pg_temp.s09d_outcome('rev:regrant') = 'OK' and (select r->>'id' = pg_temp.s09d_id('gE')::text and r->>'version' = '4'
    and r->>'state' = 'active' and r->>'lastAction' = 'granted' from (select pg_temp.s09d_resp('rev:regrant') r) s)
  and pg_temp.s09g_holds('rev1', 'cms.editor'),
  'grant re-establishes the revoked aggregate with a version increment (same id) and re-activates it [P2-S09-AC-528]');
select is((select count(*)::integer from platform_private.cms_capability_grants where subject_person_ref = pg_temp.s09d_actor_id('rev1', 'person')::uuid
  and capability_code = 'cms.editor'), 1, 'there is still one aggregate for the (owner, subject, capability) key');

-- Atomicity on renewal and revocation.
create function public.s09g_fail_outbox() returns trigger language plpgsql as $body$
begin
  if new.event_type = 'cms.capability.grant.changed.v1' then raise exception 'S09G_FORCED_OUTBOX_FAILURE'; end if;
  return new;
end;
$body$;
create trigger s09g_fail_outbox before insert on platform_private.outbox_events
for each row execute function public.s09g_fail_outbox();
select pg_temp.s09g_fingerprint() as atomic_before \gset
select pg_temp.s09g_renew('at:renew', 'owner', pg_temp.s09d_id('gE'), '4', pg_temp.s09g_day(12));
select pg_temp.s09g_revoke('at:revoke', 'owner', pg_temp.s09d_id('gA'), '6');
select ok(pg_temp.s09d_outcome('at:renew') not in ('OK', 'MISSING') and pg_temp.s09d_outcome('at:revoke') not in ('OK', 'MISSING'),
  'a failing outbox write fails both commands [P2-S09-AC-560] [P2-S09-AC-588]');
select is(pg_temp.s09g_fingerprint(), :'atomic_before', 'the failures rolled back aggregate, projection, event, audit, outbox and idempotency');
drop trigger s09g_fail_outbox on platform_private.outbox_events;
select pg_temp.s09g_revoke('at:retry', 'owner', pg_temp.s09d_id('gA'), '6');
select is(pg_temp.s09d_outcome('at:retry'), 'OK', 'the command succeeds once the failure is removed');

select * from finish();
rollback;
