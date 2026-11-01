-- Slice 12 gap lane claude_s12_gaps_db3: P2-S12-AC-292 clause 2 "or scope does not gain replay authority" for CMS-03B-10
-- (cms_create_entry), the ACTING-PARTY member of scope.  The actor member (a different actor under the same key never receives the
-- first actor's response and its receipt is untouched) is proven by gaps_entry_default.sql:144-156 (db2); this file adds the other
-- member: ONE actor with confirmed membership and cms.author in TWO parties completes a key under party A and reuses it under party B.
--   BE03c 149 / BE00: the reservation binds (actor, operation, key hash) and its request fingerprint binds the server-resolved acting
--   party (20260930150000_cms_idempotency_business_hash.sql), so the second use is IDEMPOTENCY_MISMATCH.  CMS-03B-10 reserves
--   (20260927590000:42) after the capability check and before it looks up the type version, so the reservation is reached under B.
-- Real producers: the DEC-108 world, a real active compiled type, the real public platform_api.cms_create_entry as service_role.
-- Fixture forgeries (labelled): the owner's confirmed tenure and cms.author grant in the SECOND organization, exactly as
-- 01-actors.sqlinc forges designer2's tenure and `other`'s grant (no command confirms an ungoverned membership).  No context binding
-- is used: the request carries the verified actor envelope WITHOUT actingPartyId / actingContextId, so the party is purely the
-- server-resolved one (app.acting_party_id), and the request bytes are identical in both uses.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc

select is(pg_temp.s09d_grant_via_rpc('owner', 'cms.author'), 'OK', 'setup: real owner entry-author grant in organization A [P2-S12-AC-292]');
select pg_temp.s09d_create_type('g3e', 'g3epartytype');
select pg_temp.s09d_to_active('g3e');
select is(pg_temp.s09d_outcome('g3e:activate'), 'OK', 'setup: a real active compiled content type of organization A [P2-S12-AC-292]');

-- The second party of the same actor: an alias of `owner` (same auth user and person) whose server-resolved party is organization B.
insert into identity_private.membership_tenure(organization_id, person_id, state, provenance, governance_mode,
  starts_on, accepted_at, actor_id, version)
select pg_temp.s09d_id('otherOrg'), o.person_id, 'confirmed', 'invitation', 'ungoverned', current_date, clock_timestamp(),
       other.person_id, 1
  from s09d_actor o, s09d_actor other where o.key = 'owner' and other.key = 'other';
insert into identity_private.organization_actor_grant(organization_id, person_id, capability_code, valid_from, valid_through, active)
select pg_temp.s09d_id('otherOrg'), person_id, 'cms.author', current_date, current_date + 1, true from s09d_actor where key = 'owner';
insert into s09d_actor(key, auth_user_id, person_id, party_id)
select 'owner-b', auth_user_id, person_id, pg_temp.s09d_id('otherOrg') from s09d_actor where key = 'owner';
select ok(
  (select count(*) = 2 and count(distinct organization_id) = 2
     from identity_private.membership_tenure t
    where t.person_id = (select person_id from s09d_actor where key = 'owner') and t.state = 'confirmed'
      and t.organization_id in (pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_id('otherOrg')))
  and (select count(*) = 2 from identity_private.organization_actor_grant g
        where g.person_id = (select person_id from s09d_actor where key = 'owner') and g.capability_code = 'cms.author' and g.active
          and g.organization_id in (pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_id('otherOrg'))),
  'control: the owner is a confirmed cms.author member of two organizations, A and B [P2-S12-AC-292]');

\ir phase_02_slice_12_gaps_entry/005-edt-driver.sqlinc

-- One request, built once, with the actor envelope but no party and no binding (the party is server-resolved only).
create temp table g3e_request on commit drop as
select pg_temp.s12edt_request('g3e', 'ONE KEY TWO PARTIES', 'owner')
  || jsonb_build_object('context', pg_temp.s09d_context('owner', false) - 'actingPartyId' - 'actingContextId') as request;
select ok((select not (request->'context' ? 'actingPartyId') and not (request->'context' ? 'actingContextId') from g3e_request),
  'control: the request names no acting party, so the party can only be the server-resolved one [P2-S12-AC-292]');

create temp table g3e_call(label text primary key, state text, message text, response jsonb, idem_before jsonb, idem_after jsonb,
  entries_before bigint, entries_after bigint, revisions_before bigint, revisions_after bigint) on commit drop;
create function pg_temp.g3e_call(p_label text, p_actor text) returns void language plpgsql security invoker as $body$
declare
  request jsonb := (select r.request from g3e_request r);
  key_hash text := platform_private.cms_key_hash(request->>'idempotencyKey');
  answer jsonb; code text := '00000'; msg text; prior_role text := current_setting('role');
  idem_before jsonb; entries_before bigint := (select count(*) from platform_private.cms_content_entries);
  revisions_before bigint := (select count(*) from platform_private.cms_entry_revisions);
begin
  select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb) into idem_before
    from platform_private.idempotency_records i where i.key_hash = platform_private.cms_key_hash(request->>'idempotencyKey');
  perform pg_temp.s09d_session(p_actor, 'service_role');
  begin
    set local role service_role;
    begin
      answer := platform_api.cms_create_entry(request);
    exception when others then get stacked diagnostics code = returned_sqlstate, msg = message_text;
    end;
    perform set_config('role', prior_role, true);
  exception when others then perform set_config('role', prior_role, true); raise;
  end;
  insert into g3e_call values (p_label, code, msg, answer, idem_before,
    (select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb) from platform_private.idempotency_records i
      where i.key_hash = platform_private.cms_key_hash(request->>'idempotencyKey')),
    entries_before, (select count(*) from platform_private.cms_content_entries),
    revisions_before, (select count(*) from platform_private.cms_entry_revisions));
end;
$body$;

-- 1. the first use, under organization A
select pg_temp.g3e_call('first-a', 'owner');
select ok((select state = '00000' and response->'entry'->>'id' is not null and entries_after = entries_before + 1
              and jsonb_array_length(idem_after) = 1 and idem_after->0->>'state' = 'completed'
           from g3e_call where label = 'first-a'),
  'setup: the actor creates an entry under organization A and the key is completed [P2-S12-AC-292]');
select ok((select e.owner_party_id = pg_temp.s09d_id('ownerOrg') from platform_private.cms_content_entries e
            where e.id = (select (response->'entry'->>'id')::uuid from g3e_call where label = 'first-a')),
  'setup: the entry belongs to organization A [P2-S12-AC-292]');

-- 2. the SAME actor, the same bytes and key, a different server-resolved acting party
select pg_temp.g3e_call('replay-b', 'owner-b');
select diag('same actor under organization B: ' || (select state || ' ' || coalesce(message, 'OK') from g3e_call where label = 'replay-b'));
select ok((select response is distinct from (select c.response from g3e_call c where c.label = 'first-a') from g3e_call where label = 'replay-b'),
  'the same actor reusing a completed key under a second party never receives the first party''s response [P2-S12-AC-292]');
select is((select state || ':' || message from g3e_call where label = 'replay-b'), 'P0001:IDEMPOTENCY_MISMATCH',
  'the second party meets the request-fingerprint mismatch (409 IDEMPOTENCY_MISMATCH): the server-resolved acting party is part of the key''s binding [P2-S12-AC-292]');
select ok((select entries_after = entries_before and revisions_after = revisions_before and idem_after = idem_before
           from g3e_call where label = 'replay-b'),
  'the refused second-party use created no entry or revision and left the stored reservation byte-identical [P2-S12-AC-292]');

-- 3. control: the original party again, the same bytes, replays the stored response (the party was the only difference)
select pg_temp.g3e_call('replay-a', 'owner');
select ok((select state = '00000' and response = (select c.response from g3e_call c where c.label = 'first-a')
              and entries_after = entries_before and idem_after = idem_before
           from g3e_call where label = 'replay-a'),
  'control: the same actor under the original party with the identical bytes receives the stored response and creates nothing [P2-S12-AC-292]');

select finish();
rollback;
