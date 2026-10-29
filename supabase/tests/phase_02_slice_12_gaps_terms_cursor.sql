-- Slice 12 gap lane claude_s12_gaps_db2: P2-S12-AC-187 clause 1 (cmsTaxonomyTermsRead): a CORRECTLY SIGNED cursor whose expiresAt has
-- elapsed is refused 409 CONFLICT.  The existing 409 case forges expiresAt to a far-future value WITHOUT re-signing (a signature
-- failure); here the envelope is re-sealed with the pgTAP transaction-only Vault key under the production domain cms-03c-terms
-- (HMAC-SHA256 over domain:v1:keyId:JCS(envelope without keyId and signature)), exactly as phase_02_slice_10_cursor_signature.sql
-- section 5 does for CMS-03B-13, so the refusal can only be the expiry.  Controls: the same re-seal with a future expiry is accepted.
-- BE03c 167 / DEC-140 "expired, tampered or foreign-bound cursor with 409".
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc
\ir phase_02_slice_12_taxonomy_terms/000-world.sqlinc
\ir phase_02_slice_12_taxonomy_terms/010-setup.sqlinc
\ir phase_02_slice_12_taxonomy_terms_reads/000-world.sqlinc
\ir phase_02_slice_12_taxonomy_terms_reads/010-fixtures.sqlinc

-- This fixed key exists only inside the rolled-back pgTAP transaction; it is never an operational signing value.
select vault.create_secret(repeat('a1', 32), 'cms_editorial_history_cursor_active', 'pgTAP transaction-only taxonomy read test key');

-- Re-seal a decoded cursor envelope: patch members, then sign with the test key under the terms domain.
create or replace function pg_temp.g2_reseal(p_cursor text, p_patch jsonb) returns text language plpgsql as $body$
declare envelope jsonb := convert_from(decode(p_cursor, 'base64'), 'utf8')::jsonb || p_patch;
begin
  envelope := (envelope - 'signature') || jsonb_build_object('signature', encode(extensions.hmac(
    convert_to('cms-03c-terms:v1:' || (envelope->>'keyId') || ':' || platform_private.cms_jcs(envelope - 'keyId' - 'signature'), 'utf8'),
    decode(repeat('a1', 32), 'hex'), 'sha256'), 'hex'));
  return replace(encode(convert_to(platform_private.cms_jcs(envelope), 'utf8'), 'base64'), E'\n', '');
end;
$body$;

select pg_temp.s12tr_read('e-1', 'owner', pg_temp.s12tt_lineage('vr'), '{"limit":3}'::jsonb);
select ok(pg_temp.s12tt_oc('e-1') = 'ok' and jsonb_typeof(pg_temp.s12tr_page('e-1')->'nextCursor') = 'string',
  'fixture: a first page of three terms carries a signed cursor [P2-S12-AC-187]');
-- control: the re-seal reproduces a cursor the production verifier accepts (same payload, same expiry)
select pg_temp.s12tr_read('e-same', 'owner', pg_temp.s12tt_lineage('vr'), jsonb_build_object('limit', 3,
  'cursor', pg_temp.g2_reseal(pg_temp.s12tr_page('e-1')->>'nextCursor', '{}'::jsonb)));
select ok(pg_temp.s12tt_oc('e-same') = 'ok' and pg_temp.s12tr_keys(pg_temp.s12tr_page('e-same')) = array['tr-d', 'tr-e', 'tr-f'],
  'control: re-sealing the untouched payload with the test key yields a cursor the production verifier accepts [P2-S12-AC-187]');
select pg_temp.s12tr_read('e-future', 'owner', pg_temp.s12tt_lineage('vr'), jsonb_build_object('limit', 3,
  'cursor', pg_temp.g2_reseal(pg_temp.s12tr_page('e-1')->>'nextCursor',
    jsonb_build_object('expiresAt', (floor(extract(epoch from clock_timestamp())) + 600)::bigint::text))));
select ok(pg_temp.s12tt_oc('e-future') = 'ok',
  'control: a re-sealed cursor with a later (still valid) expiry is accepted, so a signature built here is never the cause of a refusal [P2-S12-AC-187]');
-- the point: the same re-seal with an expiry in the past
select pg_temp.s12tr_read('e-expired', 'owner', pg_temp.s12tt_lineage('vr'), jsonb_build_object('limit', 3,
  'cursor', pg_temp.g2_reseal(pg_temp.s12tr_page('e-1')->>'nextCursor',
    jsonb_build_object('expiresAt', (floor(extract(epoch from clock_timestamp())) - 10)::bigint::text))));
select is(pg_temp.s12tt_oc('e-expired'), 'P0001:CONFLICT',
  'a correctly signed cursor whose expiresAt has elapsed is refused 409 CONFLICT [P2-S12-AC-187]');
select pg_temp.s12tr_read('e-expired-now', 'owner', pg_temp.s12tt_lineage('vr'), jsonb_build_object('limit', 3,
  'cursor', pg_temp.g2_reseal(pg_temp.s12tr_page('e-1')->>'nextCursor',
    jsonb_build_object('expiresAt', floor(extract(epoch from clock_timestamp()))::bigint::text))));
select is(pg_temp.s12tt_oc('e-expired-now'), 'P0001:CONFLICT',
  'a cursor expiring at the current second is already expired (the boundary is exclusive) [P2-S12-AC-187]');

select * from finish();
rollback;
