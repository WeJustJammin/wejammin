-- Slice 11 lane preview-projection: platform_api.cms_takedown_preview_tokens, the service-role takedown
-- RPC (BE03b "Preview token and verification (CMS-03B-08, CMS-03B-19)": a token is revoked by CAS "by the
-- service-role takedown RPC"; DEC-156: the internal RPCs are granted to service_role and principal-bound at
-- the Worker module boundary; tracker P2-S11-AC-118).  It is the only API entry point that reaches the private
-- seam platform_private.cms_revoke_preview_tokens for the reason `takedown`: a closed request
-- { reasonCode: "takedown", correlationId, entryId?, personId? } (at least one target), CAS revocation of the
-- unexpired active tokens (state revoked, revoked_at, version + 1), { revokedTokens }, idempotent, executable by
-- service_role only.  RED before 20261010165200.
--
-- The same-named evidence of the other AC-118 clauses lives where the mechanism does:
--   capability_snapshot_hash = BE04c actingContextVersion ... phase_02_slice_11_helpers_acting_context.sql,
--                                                              phase_02_slice_11_rpc_preview_mint.sql
--   minting person loses capability / membership ........... phase_02_slice_11_helpers_invalidation.sql
--   entry leaves `active` .................................. phase_02_slice_11_helpers_invalidation.sql
--   a version-set movement does not revoke ................. phase_02_slice_11_helpers_invalidation.sql
-- This file adds the takedown entry point and the composition: a REAL minted token, verified, taken down as
-- service_role and then reported revoked.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(43);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc
\ir phase_02_slice_11_rpc_preview/000-world.sqlinc

select pg_temp.r11p_key();
select pg_temp.r11_entry('td-1');
select pg_temp.r11_entry('td-2');
select pg_temp.r11_entry('td-3');
select pg_temp.r11_entry('td-4');

create or replace function pg_temp.r11t_state(p_key text)
returns text language sql stable security definer set search_path = '' as $body$
  select token.state || '/' || token.version || '/' || (token.revoked_at is not null)::text
    from platform_private.cms_preview_tokens token
   where token.token_hash = pg_catalog.encode(extensions.digest(pg_catalog.convert_to('pv-plain-' || p_key, 'utf8'), 'sha256'), 'hex')
$body$;
create or replace function pg_temp.r11t_rq(p_extra jsonb)
returns jsonb language sql as $body$
  select jsonb_build_object('reasonCode', 'takedown', 'correlationId', extensions.gen_random_uuid()) || p_extra
$body$;
-- A request is kept in a session setting so the role-switched calls below need no temp-schema access.
create or replace function pg_temp.r11t_stash(p_name text, p_request jsonb)
returns void language sql as $body$
  select set_config('s11t.' || p_name, p_request::text, false)
$body$;
create temp table r11t_effects(label text primary key, value text not null) on commit drop;
create or replace function pg_temp.r11t_effects()
returns text language sql stable security definer set search_path = '' as $body$
  select (select count(*) from audit_private.audit_events)::text
    || '/' || (select count(*) from platform_private.outbox_events)::text
    || '/' || (select count(*) from platform_private.idempotency_records)::text
$body$;

-- td-1: ta, tb live, tc expired, tx already revoked.  td-2: te, tf.  td-3: tg, th.  td-4 holds the real mint.
select pg_temp.r11p_token('ta', 'td-1', 'owner');
select pg_temp.r11p_token('tb', 'td-1', 'editor');
select pg_temp.r11p_token('tc', 'td-1', 'owner', interval '20 minutes');
select pg_temp.r11p_token('tx', 'td-1', 'owner');
select pg_temp.r11p_revoke('tx');
select pg_temp.r11p_token('te', 'td-2', 'owner');
select pg_temp.r11p_token('tf', 'td-2', 'editor');
select pg_temp.r11p_token('tg', 'td-3', 'owner');
select pg_temp.r11p_token('th', 'td-3', 'editor');

select pg_temp.r11t_stash('entry1', pg_temp.r11t_rq(jsonb_build_object('entryId', pg_temp.h11w_uuid('td-1:entry'))));
select pg_temp.r11t_stash('entry2', pg_temp.r11t_rq(jsonb_build_object('entryId', pg_temp.h11w_uuid('td-2:entry'))));
select pg_temp.r11t_stash('entry4', pg_temp.r11t_rq(jsonb_build_object('entryId', pg_temp.h11w_uuid('td-4:entry'))));
select pg_temp.r11t_stash('person', pg_temp.r11t_rq(jsonb_build_object('personId', pg_temp.s11_id('creator'))));
select pg_temp.r11t_stash('both', pg_temp.r11t_rq(jsonb_build_object(
  'entryId', pg_temp.h11w_uuid('td-3:entry'), 'personId', pg_temp.r11p_person('editor'))));
select pg_temp.r11t_stash('authority_lost', pg_temp.r11t_rq(jsonb_build_object(
  'entryId', pg_temp.h11w_uuid('td-1:entry'), 'reasonCode', 'authority_lost')));
select pg_temp.r11t_stash('entry_unavailable', pg_temp.r11t_rq(jsonb_build_object(
  'entryId', pg_temp.h11w_uuid('td-1:entry'), 'reasonCode', 'entry_unavailable')));
select pg_temp.r11t_stash('no_reason', pg_temp.r11t_rq(jsonb_build_object(
  'entryId', pg_temp.h11w_uuid('td-1:entry'))) - 'reasonCode');
select pg_temp.r11t_stash('no_target', pg_temp.r11t_rq('{}'));
select pg_temp.r11t_stash('no_correlation', pg_temp.r11t_rq(jsonb_build_object(
  'entryId', pg_temp.h11w_uuid('td-1:entry'))) - 'correlationId');
select pg_temp.r11t_stash('extra_member', pg_temp.r11t_rq(jsonb_build_object(
  'entryId', pg_temp.h11w_uuid('td-1:entry'), 'tokenHash', repeat('a', 64))));
select pg_temp.r11t_stash('bad_uuid', pg_temp.r11t_rq('{"entryId":"nope"}'));
select pg_temp.r11t_stash('array', '[]'::jsonb);

-- ---------------------------------------------------------------------------
-- Shape and privileges: service_role only, the private seam still has no API grant.
-- ---------------------------------------------------------------------------
select ok(pg_temp.r11_posture('platform_api', 'cms_takedown_preview_tokens(jsonb)'),
  'cms_takedown_preview_tokens is a platform_api SECURITY DEFINER of the CMS definer (empty search_path) executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-118]');
select is(
  (select string_agg(case acl.grantee when 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end || ':' || acl.privilege_type,
                     ',' order by case acl.grantee when 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end)
     from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = to_regprocedure('platform_api.cms_takedown_preview_tokens(jsonb)')),
  'service_role:EXECUTE,wejammin_cms_definer:EXECUTE',
  'the execute ACL is exactly the definer and service_role: no other role holds the takedown entry point [P2-S11-AC-118]');
select ok(
  (select count(*) = 1 from pg_proc p where p.pronamespace = 'platform_api'::regnamespace and p.proname = 'cms_takedown_preview_tokens')
    and pg_temp.h11_private_definer('cms_revoke_preview_tokens(jsonb)')
    and to_regprocedure('platform_api.cms_revoke_preview_tokens(jsonb)') is null,
  'exactly one takedown overload exists and the private revocation seam stays unexposed: the takedown is the only API route to it [P2-S11-AC-118]');

-- ---------------------------------------------------------------------------
-- Typed reason and closed structure (service_role; every refusal revokes nothing).
-- ---------------------------------------------------------------------------
select set_config('app.cms_rpc', '', true);
set local role service_role;
select throws_ok($$select platform_api.cms_takedown_preview_tokens(current_setting('s11t.authority_lost')::jsonb)$$,
  'P0001', 'INVALID_REQUEST',
  'the reason authority_lost is not a takedown: INVALID_REQUEST (that cause belongs to the authority-loss producers) [P2-S11-AC-118]');
select throws_ok($$select platform_api.cms_takedown_preview_tokens(current_setting('s11t.entry_unavailable')::jsonb)$$,
  'P0001', 'INVALID_REQUEST',
  'the reason entry_unavailable is not a takedown: INVALID_REQUEST (that cause belongs to the lifecycle producers) [P2-S11-AC-118]');
select throws_ok($$select platform_api.cms_takedown_preview_tokens(current_setting('s11t.no_reason')::jsonb)$$,
  'P0001', 'INVALID_REQUEST', 'a request without a reason is INVALID_REQUEST [P2-S11-AC-118]');
select throws_ok($$select platform_api.cms_takedown_preview_tokens(current_setting('s11t.no_target')::jsonb)$$,
  'P0001', 'INVALID_REQUEST', 'a request naming neither an entry nor a person is INVALID_REQUEST [P2-S11-AC-118]');
select throws_ok($$select platform_api.cms_takedown_preview_tokens(current_setting('s11t.no_correlation')::jsonb)$$,
  'P0001', 'INVALID_REQUEST', 'a request without a correlation id is INVALID_REQUEST [P2-S11-AC-118]');
select throws_ok($$select platform_api.cms_takedown_preview_tokens(current_setting('s11t.extra_member')::jsonb)$$,
  'P0001', 'INVALID_REQUEST', 'an unknown member (a token hash) is INVALID_REQUEST: the request is closed [P2-S11-AC-118]');
select throws_ok($$select platform_api.cms_takedown_preview_tokens(current_setting('s11t.bad_uuid')::jsonb)$$,
  'P0001', 'INVALID_REQUEST', 'a malformed entry id is INVALID_REQUEST [P2-S11-AC-118]');
select throws_ok($$select platform_api.cms_takedown_preview_tokens(current_setting('s11t.array')::jsonb)$$,
  'P0001', 'INVALID_REQUEST', 'a non-object request is INVALID_REQUEST [P2-S11-AC-118]');
select throws_ok($$select platform_api.cms_takedown_preview_tokens(null::jsonb)$$,
  'P0001', 'INVALID_REQUEST', 'a null request is INVALID_REQUEST [P2-S11-AC-118]');
reset role;
select is(
  pg_temp.r11t_state('ta') || ' ' || pg_temp.r11t_state('tb') || ' ' || pg_temp.r11t_state('te') || ' ' || pg_temp.r11t_state('tf')
    || ' ' || pg_temp.r11t_state('tg') || ' ' || pg_temp.r11t_state('th'),
  'active/1/false active/1/false active/1/false active/1/false active/1/false active/1/false',
  'control: every refused request revoked nothing [P2-S11-AC-118]');

-- ---------------------------------------------------------------------------
-- The takedown, as service_role, by entry / person / both.
-- ---------------------------------------------------------------------------
insert into r11t_effects(label, value) values ('before', pg_temp.r11t_effects());
set local role service_role;
select is(platform_api.cms_takedown_preview_tokens(current_setting('s11t.entry1')::jsonb), '{"revokedTokens": 2}'::jsonb,
  'a takedown by entry answers { revokedTokens } counting the two unexpired active tokens of the entry (the expired and the already revoked are skipped) [P2-S11-AC-118]');
reset role;
insert into r11t_effects(label, value) values ('after', pg_temp.r11t_effects());
select is(pg_temp.r11t_state('ta') || ' ' || pg_temp.r11t_state('tb'), 'revoked/2/true revoked/2/true',
  'each revoked token is CAS-revoked: state revoked, revoked_at set, version + 1 [P2-S11-AC-118]');
select is(pg_temp.r11t_state('tc') || ' ' || pg_temp.r11t_state('tx'), 'active/1/false revoked/2/true',
  'an expired token and an already revoked token are not touched (no second version bump) [P2-S11-AC-118]');
select is(pg_temp.r11t_state('te') || ' ' || pg_temp.r11t_state('tf') || ' ' || pg_temp.r11t_state('tg') || ' ' || pg_temp.r11t_state('th'),
  'active/1/false active/1/false active/1/false active/1/false',
  'the tokens of other entries are untouched by an entry takedown [P2-S11-AC-118]');
select is((select value from r11t_effects where label = 'after'), (select value from r11t_effects where label = 'before'),
  'the takedown writes no audit record, event or idempotency reservation of its own: its caller owns the audit of the cause [P2-S11-AC-118]');
select isnt(coalesce(current_setting('app.cms_rpc', true), ''), 'true',
  'the CMS RPC flag is restored to its previous value when the takedown returns (SEC-2 D) [P2-S11-AC-118]');

set local role service_role;
select is(platform_api.cms_takedown_preview_tokens(current_setting('s11t.entry1')::jsonb), '{"revokedTokens": 0}'::jsonb,
  'a repeated takedown is idempotent: nothing left to revoke [P2-S11-AC-118]');
select is(platform_api.cms_takedown_preview_tokens(current_setting('s11t.person')::jsonb), '{"revokedTokens": 2}'::jsonb,
  'a takedown by person revokes that minter''s unexpired active tokens across entries (te, tg) [P2-S11-AC-118]');
reset role;
select is(pg_temp.r11t_state('te') || ' ' || pg_temp.r11t_state('tg') || ' ' || pg_temp.r11t_state('tf') || ' ' || pg_temp.r11t_state('th'),
  'revoked/2/true revoked/2/true active/1/false active/1/false',
  'only the person''s tokens were revoked; the other minter''s tokens are active [P2-S11-AC-118]');
set local role service_role;
select is(platform_api.cms_takedown_preview_tokens(current_setting('s11t.both')::jsonb), '{"revokedTokens": 1}'::jsonb,
  'an entry and a person together are an AND: only the editor''s token on td-3 is revoked [P2-S11-AC-118]');
reset role;
select is(pg_temp.r11t_state('th') || ' ' || pg_temp.r11t_state('tf'), 'revoked/2/true active/1/false',
  'the editor''s token on td-3 is revoked and the editor''s token on td-2 is not [P2-S11-AC-118]');

-- ---------------------------------------------------------------------------
-- Nobody else can call it: anon and authenticated are refused at the function ACL.
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$select platform_api.cms_takedown_preview_tokens(current_setting('s11t.entry2')::jsonb)$$,
  '42501', 'permission denied for function cms_takedown_preview_tokens',
  'anon cannot execute the takedown [P2-S11-AC-118]');
reset role;
set local role authenticated;
select throws_ok($$select platform_api.cms_takedown_preview_tokens(current_setting('s11t.entry2')::jsonb)$$,
  '42501', 'permission denied for function cms_takedown_preview_tokens',
  'authenticated cannot execute the takedown [P2-S11-AC-118]');
reset role;
select is(pg_temp.r11t_state('tf'), 'active/1/false',
  'control: the refused anon and authenticated calls revoked nothing [P2-S11-AC-118]');

-- ---------------------------------------------------------------------------
-- Composition: a REAL minted token (td-4), verified, taken down as service_role, then reported revoked.
-- ---------------------------------------------------------------------------
select set_config('app.cms_rpc', '', true);
select pg_temp.r11p_mcall('mint', 'owner', pg_temp.r11p_mreq('td-4'));
select is(pg_temp.r11_out('mint'), '00000:', 'composition: the entry assignee mints a real preview token [P2-S11-AC-118]');
create temp table r11t_minted on commit drop as
  select pg_temp.r11_resp('mint')->>'token' as token,
         pg_temp.h11_sha256(pg_temp.r11_resp('mint')->>'token') as token_hash;
select is(
  (select token.capability_snapshot_hash::text
     from platform_private.cms_preview_tokens token where token.token_hash = (select token_hash from r11t_minted)),
  platform_private.cms_acting_context_version(pg_temp.s11_id('creator'), pg_temp.s11_id('org')),
  'the minted token''s capability_snapshot_hash is the BE04c actingContextVersion computed by cms_acting_context_version(person, acting party) [P2-S11-AC-118]');
select pg_temp.r11p_vcall('v-live', pg_temp.r11p_vreq('unused', 'owner',
  jsonb_build_object('tokenHash', (select token_hash from r11t_minted))));
select ok(
  (pg_temp.r11_resp('v-live')->>'valid')::boolean
    and pg_temp.r11_resp('v-live')->>'entryId' = pg_temp.h11w_uuid('td-4:entry')::text
    and pg_temp.r11_resp('v-live')->'revoked' = 'false'::jsonb,
  'composition: the verifier accepts the minted token when the caller presents the acting-context version [P2-S11-AC-118]');

set local role service_role;
select is(platform_api.cms_takedown_preview_tokens(current_setting('s11t.entry4')::jsonb), '{"revokedTokens": 1}'::jsonb,
  'composition: the service-role takedown of td-4 revokes the minted token [P2-S11-AC-118]');
reset role;
select is(
  (select token.state || '/' || token.version || '/' || (token.revoked_at is not null)::text
     from platform_private.cms_preview_tokens token where token.token_hash = (select token_hash from r11t_minted)),
  'revoked/2/true', 'composition: the minted token is CAS-revoked (state revoked, revoked_at set, version 2) [P2-S11-AC-118]');
select pg_temp.r11p_vcall('v-revoked', pg_temp.r11p_vreq('unused', 'owner',
  jsonb_build_object('tokenHash', (select token_hash from r11t_minted))));
select ok(pg_temp.r11_resp('v-revoked')::text = pg_temp.r11p_denial(true),
  'composition: CMS-03B-19 answers valid false / revoked true for the bound owner of the taken-down token [P2-S11-AC-118]');
select pg_temp.r11p_vcall('v-stranger', pg_temp.r11p_vreq('unused', 'editor',
  jsonb_build_object('tokenHash', (select token_hash from r11t_minted))));
select ok(pg_temp.r11_resp('v-stranger')::text = pg_temp.r11p_denial(false),
  'composition: any other caller still gets the one byte-identical denial with revoked false: the takedown is no existence oracle [P2-S11-AC-118]');

select * from finish();
rollback;
