\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-119/DEC-120 QA-RED: CMS-03A-15 grant a CMS capability (BE03a
-- route row, field matrix, security controls, error matrix).  The caller is the
-- owner derived from the immutable initialization receipt alone (no capability
-- key and no currently valid CMS grant), with a current binding and recent
-- binding-bound MFA.  Standing grants run at most 90 UTC days (validThrough <=
-- today + 89, DEC-120).

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc

select pg_temp.s09g_member('rev1');
select pg_temp.s09g_member('rev2');
create temp table s09g_identity_before on commit drop as
select (select count(*) from platform_private.person_party) as persons,
       (select count(*) from platform_private.party) as parties,
       (select count(*) from platform_private.alias_party) as aliases,
       (select count(*) from identity_private.membership_tenure) as tenures,
       (select count(*) from platform_private.admin_capability_grants) as admin_grants;

-- Owner derivation and refusals (all atomic: no effect of any kind).
select pg_temp.s09g_fingerprint() as before_fp \gset
select pg_temp.s09g_grant('g:designer2', 'designer2', 'rev1', 'cms.author', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('g:designer2'), 'FORBIDDEN',
  'a schema designer who is not the receipt-derived owner cannot grant (403) [P2-S09-AC-523]');
select pg_temp.s09g_grant('g:subject', 'rev1', 'rev2', 'cms.author', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('g:subject'), 'FORBIDDEN', 'a plain member acting as itself cannot grant (403) [P2-S09-AC-523]');
select pg_temp.s09g_grant('g:other', 'other', 'rev1', 'cms.author', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('g:other'), 'FORBIDDEN', 'another organization''s designer cannot grant (403) [P2-S09-AC-523]');
select pg_temp.s09g_grant('g:nobinding', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3), '{}', null, false);
select is(pg_temp.s09d_outcome('g:nobinding'), 'STEP_UP_REQUIRED', 'a request without the private acting-context binding is 401 STEP_UP_REQUIRED [P2-S09-AC-523]');
-- TIME-WARP: a stale or recent acting-context binding (heartbeat, MFA recency, expiry) cannot be produced without waiting; the binding itself was selected through identity_context_bind.
update platform_private.acting_context_binding set last_seen_at = clock_timestamp() - interval '20 minutes'
 where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;
select pg_temp.s09g_grant('g:stale', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('g:stale'), 'STEP_UP_REQUIRED', 'a binding whose MFA is older than ten minutes is 401 STEP_UP_REQUIRED [P2-S09-AC-523]');
update platform_private.acting_context_binding set last_seen_at = clock_timestamp()
 where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;

-- Subject eligibility: absent, non-member, cross-organization, banned and
-- unclaimed subjects are one indistinguishable 404.
select pg_temp.s09g_grant('g:absent', 'owner', extensions.gen_random_uuid()::text, 'cms.author', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('g:absent'), 'NOT_FOUND', 'an absent person is 404 [P2-S09-AC-507]');
select pg_temp.s09g_grant('g:nonmember', 'owner', 'rev3', 'cms.author', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('g:nonmember'), 'NOT_FOUND', 'a real person with no membership in the owner organization is 404 [P2-S09-AC-507]');
select pg_temp.s09g_grant('g:crossorg', 'owner', 'other', 'cms.author', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('g:crossorg'), 'NOT_FOUND', 'a member of another organization only is 404 [P2-S09-AC-507]');
update auth.users set banned_until = clock_timestamp() + interval '1 year' where id = pg_temp.s09d_actor_id('rev2', 'auth')::uuid;
select pg_temp.s09g_grant('g:banned', 'owner', 'rev2', 'cms.author', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('g:banned'), 'NOT_FOUND', 'a banned human is 404 [P2-S09-AC-507]');
update auth.users set banned_until = null where id = pg_temp.s09d_actor_id('rev2', 'auth')::uuid;
update platform_private.person_party set account_state = 'shadow', auth_user_id = null
 where party_id = pg_temp.s09d_actor_id('rev2', 'person')::uuid;
select pg_temp.s09g_grant('g:unclaimed', 'owner', 'rev2', 'cms.author', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('g:unclaimed'), 'NOT_FOUND', 'an unclaimed (shadow) person is 404 [P2-S09-AC-507]');
update platform_private.person_party set account_state = 'claimed',
       auth_user_id = pg_temp.s09d_actor_id('rev2', 'auth')::uuid
 where party_id = pg_temp.s09d_actor_id('rev2', 'person')::uuid;

-- Capability: only the closed grantable registry.
select pg_temp.s09g_grant('g:cap:' || c, 'owner', 'rev1', c, pg_temp.s09g_day(3))
from unnest(array['cms.schema_review', 'cms.schema_review.assign', 'cms.delivery_review',
  'cms.delivery_review.assign', 'cms.public_content.read', 'admin.inbox.read', 'admin.audit.read',
  'cms.*', '*', 'cms.unregistered', 'CMS.AUTHOR', '']) c;
select is((select count(*)::integer from s09d_probe where label like 'g:cap:%' and message = 'VALIDATION_FAILED'), 12,
  'assignment-only, owner-only, read-only, admin, wildcard, unregistered and malformed keys are all 422 [P2-S09-AC-524]');

-- Term: today through today + 89 UTC days, a real calendar date.
select pg_temp.s09g_grant('g:t:past', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(-1));
select pg_temp.s09g_grant('g:t:plus90', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(90));
select pg_temp.s09g_grant('g:t:plus365', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(365));
select pg_temp.s09g_grant('g:t:feb30', 'owner', 'rev1', 'cms.author', '2027-02-30');
select pg_temp.s09g_grant('g:t:format', 'owner', 'rev1', 'cms.author', '2027/01/01');
select pg_temp.s09g_grant('g:t:timestamp', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3) || 'T00:00:00Z');
select is((select count(*)::integer from s09d_probe where label like 'g:t:%' and message = 'VALIDATION_FAILED'), 6,
  'a past date, today + 90 and beyond, a non-calendar date and a malformed date are all 422 [P2-S09-AC-512] [P2-S09-AC-513]');
select pg_temp.s09g_grant('g:reason:empty', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3), '{"reason": ""}');
select pg_temp.s09g_grant('g:reason:long', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3),
  jsonb_build_object('reason', repeat('r', 257)));
select pg_temp.s09g_grant('g:reason:type', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3), '{"reason": 7}');
select is((select count(*)::integer from s09d_probe where label like 'g:reason:%' and message = 'VALIDATION_FAILED'), 3,
  'an empty, over-long or non-string reason is 422');
select pg_temp.s09g_grant('g:unknownkey', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3), '{"actorId": "x"}');
select is(pg_temp.s09d_outcome('g:unknownkey'), 'INVALID_REQUEST', 'an unknown request key is 400');
select pg_temp.s09d_rpc('g:nokey', 'platform_api.cms_grant_capability', 'owner', jsonb_build_object(
  'subjectPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'capability', 'cms.author',
  'validThrough', pg_temp.s09g_day(3)), true);
select is(pg_temp.s09d_outcome('g:nokey'), 'INVALID_REQUEST', 'a missing Idempotency-Key is 400');

select is(pg_temp.s09g_fingerprint(), :'before_fp',
  'every refusal above left audit, outbox, idempotency, aggregates, events and projections unchanged');
select ok((select count(*) = (select persons from s09g_identity_before) from platform_private.person_party)
  and (select count(*) = (select parties from s09g_identity_before) from platform_private.party)
  and (select count(*) = (select aliases from s09g_identity_before) from platform_private.alias_party)
  and (select count(*) = (select tenures from s09g_identity_before) from identity_private.membership_tenure),
  'no person, party, alias or membership is ever created [P2-S09-AC-524]');

-- Success: bounds today and today + 89, the full resource and the atomic effects.
select count(*) as audit_before from audit_private.audit_events \gset
select count(*) as outbox_before from platform_private.outbox_events \gset
select pg_temp.s09g_grant('g:ok', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(0), '{"reason": "Authoring access"}');
select is(pg_temp.s09d_outcome('g:ok'), 'OK', 'the owner grants a member a capability valid through today (201) [P2-S09-AC-512]');
select ok((select r ? 'id' and r->>'resourceKind' = 'cms_capability_grant' and r->>'state' = 'active'
    and r->>'version' = '1' and r->>'subjectPersonId' = pg_temp.s09d_actor_id('rev1', 'person')
    and r->>'capability' = 'cms.author' and r->>'validFrom' = pg_temp.s09g_day(0)
    and r->>'validThrough' = pg_temp.s09g_day(0) and r->>'lastAction' = 'granted'
    and r->>'reason' = 'Authoring access'
    and (r->>'endsAt')::timestamptz = (pg_temp.s09g_today() + 1)::timestamp at time zone 'UTC'
    from (select pg_temp.s09d_resp('g:ok') r) s),
  'the resource carries the derived state, the UTC term and endsAt = 00:00Z of the next UTC day [P2-S09-AC-520] [P2-S09-AC-521]');
select ok((select not (r ?| array['ownerId', 'actorId', 'actingPartyId', 'grantorPersonId', 'owner_id', 'grantor', 'bindingId'])
    and (select count(*) = 14 from jsonb_object_keys(r))
    from (select pg_temp.s09d_resp('g:ok') r) s),
  'the resource exposes no grantor, actor, party, binding or ownership identifier [P2-S09-AC-522]');
select is((select r->>'contentHash' from (select pg_temp.s09d_resp('g:ok') r) s),
  platform_private.cms_jcs_sha256((select r - 'contentHash' from (select pg_temp.s09d_resp('g:ok') r) s)),
  'contentHash is the lowercase SHA-256 of the JCS canonical resource without contentHash [P2-S09-AC-522]');
select ok(pg_temp.s09g_holds('rev1', 'cms.author'), 'the granted capability is effective in the same transaction');
select is(pg_temp.s09g_projection('rev1', 'cms.author'),
  format('true|%s|%s|cms.author', pg_temp.s09g_day(0), pg_temp.s09g_day(0)),
  'the matching organization_actor_grant projection row carries the same term [P2-S09-AC-531]');
select is((select count(*)::integer from platform_private.cms_capability_grant_events e
  where e.grant_id = pg_temp.s09g_grant_id(pg_temp.s09d_resp('g:ok'))
    and e.action = 'granted' and e.aggregate_version = 1 and e.prior_valid_through is null
    and e.binding_context_hash ~ '^[a-f0-9]{64}$' and e.mfa_verified_at is not null
    and e.grantor_person_ref = pg_temp.s09d_actor_id('owner', 'person')::uuid
    and e.subject_person_ref = pg_temp.s09d_actor_id('rev1', 'person')::uuid), 1,
  'exactly one granted event row is appended with the private binding hash and MFA instant [P2-S09-AC-531]');
select is((select count(*)::integer from audit_private.audit_events) - :audit_before, 1, 'exactly one audit row is written [P2-S09-AC-531]');
select is((select count(*)::integer from platform_private.outbox_events) - :outbox_before, 1, 'exactly one outbox row is written [P2-S09-AC-531]');
select ok(exists (select 1 from platform_private.outbox_events o
  where o.event_type = 'cms.capability.grant.changed.v1' and o.aggregate_type = 'cms_capability_grant'
    and o.aggregate_id = pg_temp.s09g_grant_id(pg_temp.s09d_resp('g:ok')) and o.aggregate_version = 1
    and o.payload = jsonb_build_object('grantId', pg_temp.s09d_resp('g:ok')->>'id',
      'subjectPersonId', pg_temp.s09d_actor_id('rev1', 'person'))),
  'the outbox event is cms.capability.grant.changed.v1 with exactly { grantId, subjectPersonId }');

-- Every grantable capability, to a member and by the owner to itself.
select pg_temp.s09g_grant('g:all:' || c, 'owner', 'rev2', c, pg_temp.s09g_day(89))
from unnest(array['cms.schema_registry.read', 'cms.schema_designer', 'cms.template_designer',
  'cms.taxonomy_curator', 'cms.editor', 'cms.reviewer', 'cms.reviewer.policy', 'cms.reviewer.legal',
  'cms.reviewer.security', 'cms.reviewer.financial', 'cms.publisher', 'cms.navigation_editor',
  'cms.media_contributor', 'cms.media_curator', 'cms.author']) c;
select is((select count(*)::integer from s09d_probe where label like 'g:all:%' and state = '00000'), 15,
  'all fifteen grantable capabilities can be granted, with a term of today + 89 (90 UTC days) [P2-S09-AC-510] [P2-S09-AC-513]');
select ok((select r->>'validThrough' = pg_temp.s09g_day(89) from (select pg_temp.s09d_resp('g:all:cms.editor') r) s)
  and pg_temp.s09g_projection('rev2', 'cms.editor') like 'true|%',
  'the 90-day term is accepted and projected [P2-S09-AC-513]');
select pg_temp.s09g_grant('g:self:' || c, 'owner', 'owner', c, pg_temp.s09g_day(30))
from unnest(array['cms.template_designer', 'cms.taxonomy_curator', 'cms.author', 'cms.editor',
  'cms.reviewer', 'cms.reviewer.policy', 'cms.reviewer.legal', 'cms.reviewer.security',
  'cms.reviewer.financial', 'cms.publisher', 'cms.navigation_editor', 'cms.media_contributor',
  'cms.media_curator']) c;
select is((select count(*)::integer from s09d_probe where label like 'g:self:%' and state = '00000'), 13,
  'the owner may grant itself every other grantable capability: reviewer, specialists and author included [P2-S09-AC-510]');
select ok(pg_temp.s09g_holds('owner', 'cms.reviewer.policy') and pg_temp.s09g_holds('owner', 'cms.author'),
  'a self-granted capability is effective');

-- Active aggregates refuse a second grant (even with a new key); backfilled ones too.
select pg_temp.s09g_grant('g:dup', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(0), '{"reason": "Authoring access"}');
select is(pg_temp.s09d_outcome('g:dup'), 'CONFLICT', 'the byte-identical body (same subject, capability, validThrough day and reason) under a NEW key against an active aggregate is 409 [P2-S09-AC-527] [P2-S09-AC-530]');
select is(pg_temp.s09d_resp('g:ok')->>'validThrough', pg_temp.s09g_day(0),
  'the 409 body repeats the first grant exactly: same validThrough day [P2-S09-AC-530]');
select is((select count(*)::integer from platform_private.cms_capability_grants
            where subject_person_ref = pg_temp.s09d_actor_id('rev1', 'person')::uuid and capability_code = 'cms.author'), 1,
  'the refused duplicate created no second aggregate [P2-S09-AC-530]');
select pg_temp.s09g_grant('g:dup:init', 'owner', 'owner', 'cms.schema_designer', pg_temp.s09g_day(5));
select is(pg_temp.s09d_outcome('g:dup:init'), 'CONFLICT', 'the backfilled owner-initialization aggregate is active: grant is 409, renewal is the path [P2-S09-AC-527]');

-- Exact replay, changed body under the same key, and reason normalization.
select pg_temp.s09d_replay_pair('g:r', 'platform_api.cms_grant_capability', 'owner', jsonb_build_object(
  'subjectPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'capability', 'cms.editor',
  'validThrough', pg_temp.s09g_day(10), 'reason', U&'caf\0065\0301',
  'idempotencyKey', 's09g-replay-fixed-key'), true);
select ok(pg_temp.s09d_resp('g:r.1') is not null and pg_temp.s09d_resp('g:r.1') = pg_temp.s09d_resp('g:r.2'),
  'an exact same-key retry replays the first response [P2-S09-AC-530]');
select is((select count(*)::integer from platform_private.cms_capability_grant_events e
  where e.grant_id = pg_temp.s09g_grant_id(pg_temp.s09d_resp('g:r.1'))), 1, 'the replay appended no second event');
select is((select reason from platform_private.cms_capability_grants where id = pg_temp.s09g_grant_id(pg_temp.s09d_resp('g:r.1'))),
  normalize(U&'caf\0065\0301', NFC), 'the reason is stored normalized NFC');
select pg_temp.s09g_grant('g:changed', 'owner', 'rev1', 'cms.editor', pg_temp.s09g_day(11), '{}', 's09g-replay-fixed-key');
select is(pg_temp.s09d_outcome('g:changed'), 'IDEMPOTENCY_MISMATCH', 'the same key with a changed body is refused IDEMPOTENCY_MISMATCH (wire 409 CONFLICT) [P2-S09-AC-530] [P2-S09-AC-537]');

-- Atomicity: a failing outbox write rolls back aggregate, projection, event, audit and idempotency.
create function public.s09g_fail_outbox() returns trigger language plpgsql as $body$
begin
  if new.event_type = 'cms.capability.grant.changed.v1' then raise exception 'S09G_FORCED_OUTBOX_FAILURE'; end if;
  return new;
end;
$body$;
create trigger s09g_fail_outbox before insert on platform_private.outbox_events
for each row execute function public.s09g_fail_outbox();
select pg_temp.s09g_fingerprint() as atomic_before \gset
select pg_temp.s09g_grant('g:atomic', 'owner', 'rev1', 'cms.template_designer', pg_temp.s09g_day(4), '{}', 's09g-atomic-key');
select ok(pg_temp.s09d_outcome('g:atomic') <> 'OK' and pg_temp.s09d_outcome('g:atomic') <> 'MISSING',
  'a failing outbox write fails the grant command [P2-S09-AC-531]');
select is(pg_temp.s09g_fingerprint(), :'atomic_before',
  'the failure rolled back the aggregate, event, projection, audit, outbox and idempotency record [P2-S09-AC-531]');
drop trigger s09g_fail_outbox on platform_private.outbox_events;
select pg_temp.s09g_grant('g:atomic.retry', 'owner', 'rev1', 'cms.template_designer', pg_temp.s09g_day(4), '{}', 's09g-atomic-key');
select is(pg_temp.s09d_outcome('g:atomic.retry'), 'OK', 'the same key succeeds once the failure is removed (no stuck reservation)');

-- No capability key and no currently valid CMS grant are required: the owner is
-- derived from the receipt alone, so a lapsed owner grant does not block it.
select ok(pg_temp.s09g_warp('owner', 'cms.schema_designer', -5, -1) and not pg_temp.s09g_holds('owner', 'cms.schema_designer'),
  'precondition: the owner holds no currently valid cms.schema_designer grant');
select pg_temp.s09g_grant('g:lapsedowner2', 'owner', 'rev1', 'cms.media_curator', pg_temp.s09g_day(2));
select is(pg_temp.s09d_outcome('g:lapsedowner2'), 'OK', 'the owner still grants with a lapsed own CMS grant (no capability key required) [P2-S09-AC-523]');
select ok(pg_temp.s09g_holds('rev1', 'cms.media_curator'), 'and the new grant is effective');

-- AC-514: the reason is NFC-normalized and then counted in Unicode characters
-- (code points), 1..256, matching the contract; octets are irrelevant.
select pg_temp.s09g_member('rev3');
create or replace function pg_temp.r3_constraint(p_sql text) returns text language plpgsql as $body$
declare cname text;
begin
  execute p_sql;
  return 'OK';
exception when others then
  get stacked diagnostics cname = constraint_name;
  return coalesce(nullif(cname, ''), sqlerrm);
end;
$body$;
select pg_temp.s09g_grant('r:e256', 'owner', 'rev3', 'cms.author', pg_temp.s09g_day(3),
  jsonb_build_object('reason', repeat(U&'\00E9', 256)));
select is(pg_temp.s09d_outcome('r:e256'), 'OK',
  '256 precomposed e-acute characters (512 octets) are accepted: the bound counts characters, not octets [P2-S09-AC-514]');
select is((select char_length(reason) from platform_private.cms_capability_grants where id = pg_temp.s09g_grant_id(pg_temp.s09d_resp('r:e256'))), 256,
  'the stored reason is 256 characters [P2-S09-AC-514]');
select pg_temp.s09g_grant('r:e257', 'owner', 'rev3', 'cms.editor', pg_temp.s09g_day(3),
  jsonb_build_object('reason', repeat(U&'\00E9', 257)));
select is(pg_temp.s09d_outcome('r:e257'), 'VALIDATION_FAILED', '257 characters are refused with VALIDATION_FAILED [P2-S09-AC-514]');
select pg_temp.s09g_grant('r:decomp256', 'owner', 'rev3', 'cms.reviewer', pg_temp.s09g_day(3),
  jsonb_build_object('reason', repeat(U&'e\0301', 256)));
select is(pg_temp.s09d_outcome('r:decomp256'), 'OK',
  '256 decomposed e + U+0301 pairs (512 code points before NFC) normalize to 256 characters and are accepted [P2-S09-AC-514]');
select is((select reason from platform_private.cms_capability_grants where id = pg_temp.s09g_grant_id(pg_temp.s09d_resp('r:decomp256'))),
  repeat(U&'\00E9', 256), 'the decomposed reason is stored as 256 composed NFC characters [P2-S09-AC-514]');
select pg_temp.s09g_grant('r:decomp257', 'owner', 'rev3', 'cms.publisher', pg_temp.s09g_day(3),
  jsonb_build_object('reason', repeat(U&'e\0301', 257)));
select is(pg_temp.s09d_outcome('r:decomp257'), 'VALIDATION_FAILED', '257 decomposed pairs normalize to 257 characters and are refused [P2-S09-AC-514]');
select pg_temp.s09g_grant('r:emoji256', 'owner', 'rev3', 'cms.navigation_editor', pg_temp.s09g_day(3),
  jsonb_build_object('reason', repeat(U&'\+01F600', 256)));
select is(pg_temp.s09d_outcome('r:emoji256'), 'OK', '256 astral characters (U+1F600, 1024 octets, 512 UTF-16 units) are accepted [P2-S09-AC-514]');
select pg_temp.s09g_grant('r:emoji257', 'owner', 'rev3', 'cms.media_curator', pg_temp.s09g_day(3),
  jsonb_build_object('reason', repeat(U&'\+01F600', 257)));
select is(pg_temp.s09d_outcome('r:emoji257'), 'VALIDATION_FAILED', '257 astral characters are refused with VALIDATION_FAILED [P2-S09-AC-514]');
select pg_temp.s09g_grant('r:empty', 'owner', 'rev3', 'cms.media_contributor', pg_temp.s09g_day(3), '{"reason": ""}');
select is(pg_temp.s09d_outcome('r:empty'), 'VALIDATION_FAILED', 'an empty reason is refused with VALIDATION_FAILED [P2-S09-AC-514]');
select is(pg_temp.s09e_check('cms_capability_grants', 'cms_capability_grants_reason_check', pg_temp.s09g_grant_id(pg_temp.s09d_resp('r:e256')),
  jsonb_build_object('reason', repeat(U&'\+01F600', 257))),
  'control:ACCEPTED|override:REJECTED:23514:cms_capability_grants_reason_check',
  'the table CHECK itself counts characters: 257 characters violate cms_capability_grants_reason_check [P2-S09-AC-514]');
select is(pg_temp.s09e_check('cms_capability_grants', 'cms_capability_grants_reason_check', pg_temp.s09g_grant_id(pg_temp.s09d_resp('r:e256')),
  jsonb_build_object('reason', repeat(U&'\+01F600', 256))),
  'control:ACCEPTED|override:ACCEPTED', '256 astral characters satisfy the table CHECK (octets irrelevant) [P2-S09-AC-514]');
select is(pg_temp.s09e_check('cms_capability_grants', 'cms_capability_grants_reason_check', pg_temp.s09g_grant_id(pg_temp.s09d_resp('r:e256')),
  jsonb_build_object('reason', U&'e\0301')),
  'control:ACCEPTED|override:REJECTED:23514:cms_capability_grants_reason_check',
  'a stored reason that is not NFC (decomposed e + U+0301) violates the table CHECK [P2-S09-AC-514]');

select * from finish();
rollback;
