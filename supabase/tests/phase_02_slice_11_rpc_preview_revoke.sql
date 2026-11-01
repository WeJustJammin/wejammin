-- Slice 11 lane S11-3c: platform_private.cms_revoke_preview_tokens (BE03b "Preview token and verification",
-- Persisted model; tracker P2-S11-AC-118).  The named private seam that authority-loss cascades, entry-lifecycle
-- producers and the Shard 16 takedown RPC call to revoke the unexpired active preview tokens of an entry and/or a
-- person for a closed reason.  It validates a closed request and wraps cms_revoke_active_preview_tokens (CAS: state
-- revoked, revoked_at, version + 1).  Idempotent; no API grant and no platform_api wrapper.  RED before
-- 20261005017870.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(21);

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

select pg_temp.r11_entry('rk-1');
select pg_temp.r11_entry('rk-2');

create or replace function pg_temp.r11k_call(p_label text, p_request jsonb, p_keep boolean default true)
returns void language sql as $body$
  select pg_temp.r11_try(p_label, format('select platform_private.cms_revoke_preview_tokens(%L::jsonb)', p_request::text), p_keep)
$body$;
create or replace function pg_temp.r11k_rq(p_extra jsonb)
returns jsonb language sql as $body$
  select jsonb_build_object('reasonCode', 'authority_lost', 'correlationId', extensions.gen_random_uuid()) || p_extra
$body$;
create or replace function pg_temp.r11k_state(p_key text)
returns text language sql stable security definer set search_path = '' as $body$
  select token.state || '/' || token.version || '/' || (token.revoked_at is not null)::text
    from platform_private.cms_preview_tokens token
   where token.token_hash = pg_catalog.encode(extensions.digest(pg_catalog.convert_to('pv-plain-' || p_key, 'utf8'), 'sha256'), 'hex')
$body$;

-- rk-1: ra (creator), rb (editor), rd (creator, expired), re (creator, already revoked); rk-2: rc (creator), rf (editor).
select pg_temp.r11p_token('ra', 'rk-1', 'owner');
select pg_temp.r11p_token('rb', 'rk-1', 'editor');
select pg_temp.r11p_token('rd', 'rk-1', 'owner', interval '20 minutes');
select pg_temp.r11p_token('re', 'rk-1', 'owner');
select pg_temp.r11p_revoke('re');
select pg_temp.r11p_token('rc', 'rk-2', 'owner');
select pg_temp.r11p_token('rf', 'rk-2', 'editor');

select ok(pg_temp.h11_private_definer('cms_revoke_preview_tokens(jsonb)')
    and to_regprocedure('platform_api.cms_revoke_preview_tokens(jsonb)') is null,
  'cms_revoke_preview_tokens is a private SECURITY DEFINER of the CMS definer nobody can execute and has no platform_api wrapper [P2-S11-AC-118]');

-- Structure (nothing is revoked by a refused request).
select pg_temp.r11k_call('s-no-reason', pg_temp.r11k_rq('{}') - 'reasonCode' || jsonb_build_object('entryId', pg_temp.h11w_uuid('rk-1:entry')), false);
select pg_temp.r11k_call('s-reason', pg_temp.r11k_rq(jsonb_build_object('reasonCode', 'other', 'entryId', pg_temp.h11w_uuid('rk-1:entry'))), false);
select pg_temp.r11k_call('s-no-target', pg_temp.r11k_rq('{}'), false);
select pg_temp.r11k_call('s-null-targets', pg_temp.r11k_rq('{"entryId":null,"personId":null}'), false);
select pg_temp.r11k_call('s-no-correlation', pg_temp.r11k_rq(jsonb_build_object('entryId', pg_temp.h11w_uuid('rk-1:entry'))) - 'correlationId', false);
select pg_temp.r11k_call('s-extra', pg_temp.r11k_rq(jsonb_build_object('entryId', pg_temp.h11w_uuid('rk-1:entry'), 'tokenHash', repeat('a', 64))), false);
select pg_temp.r11k_call('s-bad-uuid', pg_temp.r11k_rq('{"entryId":"nope"}'), false);
select pg_temp.r11k_call('s-array', '[]'::jsonb, false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label), ' ' order by label) from r11_probe where label like 's-%'),
  's-array=P0001:INVALID_REQUEST s-bad-uuid=P0001:INVALID_REQUEST s-extra=P0001:INVALID_REQUEST s-no-correlation=P0001:INVALID_REQUEST s-no-reason=P0001:INVALID_REQUEST s-no-target=P0001:INVALID_REQUEST s-null-targets=P0001:INVALID_REQUEST s-reason=P0001:INVALID_REQUEST',
  'a missing or unknown reason, no target, a missing correlation, an unknown member, a malformed id and a non-object are INVALID_REQUEST [P2-S11-AC-118]');
select is(pg_temp.r11k_state('ra') || ' ' || pg_temp.r11k_state('rb') || ' ' || pg_temp.r11k_state('rc'), 'active/1/false active/1/false active/1/false',
  'control: the refused requests revoked nothing [P2-S11-AC-118]');

-- By entry: the unexpired active tokens of the entry only.
select pg_temp.r11k_call('by-entry', pg_temp.r11k_rq(jsonb_build_object('entryId', pg_temp.h11w_uuid('rk-1:entry'), 'reasonCode', 'takedown')));
select is(pg_temp.r11_resp('by-entry'), '{"revokedTokens": 2}'::jsonb,
  'revoking an entry answers { revokedTokens } counting the two unexpired active tokens (the expired and the already revoked are skipped) [P2-S11-AC-118]');
select is(pg_temp.r11k_state('ra') || ' ' || pg_temp.r11k_state('rb') || ' ' || pg_temp.r11k_state('rc') || ' ' || pg_temp.r11k_state('rf'),
  'revoked/2/true revoked/2/true active/1/false active/1/false',
  'each revoked token is CAS-revoked (state revoked, revoked_at set, version + 1) and the tokens of other entries are untouched [P2-S11-AC-118]');
select is(pg_temp.r11k_state('rd') || ' ' || pg_temp.r11k_state('re'), 'active/1/false revoked/2/true',
  'an expired token and an already revoked token are not touched (no second version bump) [P2-S11-AC-118]');
select pg_temp.r11k_call('again', pg_temp.r11k_rq(jsonb_build_object('entryId', pg_temp.h11w_uuid('rk-1:entry'))));
select is(pg_temp.r11_resp('again'), '{"revokedTokens": 0}'::jsonb, 'a repeat is idempotent: nothing left to revoke [P2-S11-AC-118]');

-- By person, then by both (AND).
select pg_temp.r11k_call('by-person', pg_temp.r11k_rq(jsonb_build_object('personId', pg_temp.s11_id('creator'), 'reasonCode', 'authority_lost')));
select is(pg_temp.r11_resp('by-person'), '{"revokedTokens": 1}'::jsonb,
  'revoking a person revokes their unexpired active tokens across entries (rc) [P2-S11-AC-118]');
select is(pg_temp.r11k_state('rc') || ' ' || pg_temp.r11k_state('rf'), 'revoked/2/true active/1/false',
  'only that person''s token was revoked [P2-S11-AC-118]');
select pg_temp.r11p_token('rg', 'rk-1', 'owner');
select pg_temp.r11p_token('rh', 'rk-2', 'owner');
select pg_temp.r11k_call('by-both', pg_temp.r11k_rq(jsonb_build_object('entryId', pg_temp.h11w_uuid('rk-2:entry'), 'personId', pg_temp.s11_id('creator'), 'reasonCode', 'entry_unavailable')));
select ok(pg_temp.r11_resp('by-both') = '{"revokedTokens": 1}'::jsonb and pg_temp.r11k_state('rh') = 'revoked/2/true'
    and pg_temp.r11k_state('rg') = 'active/1/false' and pg_temp.r11k_state('rf') = 'active/1/false',
  'an entry and a person together are an AND: only the person''s token on that entry is revoked [P2-S11-AC-118]');

-- The verifier now reports the owner's revoked token as revoked.
select pg_temp.r11p_vcall('v-revoked', pg_temp.r11p_vreq('ra'));
select ok(pg_temp.r11_resp('v-revoked')::text = pg_temp.r11p_denial(true),
  'CMS-03B-19 answers valid false / revoked true for the bound owner of a revoked token [P2-S11-AC-118]');

-- It writes no audit record, event or reservation (the callers own the audit of their cause).
select ok(
  not exists (select 1 from audit_private.audit_events where action like 'cms.preview.%')
    and not exists (select 1 from platform_private.idempotency_records where operation like 'CMS-03B-08%'),
  'revocation writes no audit record or reservation of its own [P2-S11-AC-118]');

select * from finish();
rollback;
