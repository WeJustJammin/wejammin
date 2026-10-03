commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): release-evidence
-- admission for CMS-03A-05 and CMS-03A-08: the release principal and key window, the
-- clock-skew bound, the durable nonce receipt, atomic audit/outbox rollback, the
-- persisted evidence, the human boundary and the failure mapping.  Requests are
-- signed in SQL; a refusal is compared with a fingerprint of the block, nonce,
-- event, outbox, audit and idempotency rows.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc

create or replace function pg_temp.p_ok(p_label text, p_key text, p_version integer, p_over jsonb default '{}'::jsonb, p_post jsonb default '{}'::jsonb) returns text
language sql as $body$ select pg_temp.p_block_expect(p_label, pg_temp.p_block_request(p_key, p_version, p_over, p_post), 'OK') $body$;
create or replace function pg_temp.p_bad(p_label text, p_expected text, p_key text, p_version integer, p_over jsonb default '{}'::jsonb, p_post jsonb default '{}'::jsonb) returns text
language sql as $body$ select pg_temp.p_block_expect(p_label, pg_temp.p_block_request(p_key, p_version, p_over, p_post), p_expected) $body$;
create or replace function pg_temp.p_block_id(p_key text, p_version integer) returns uuid language sql stable as $body$
  select id from platform_private.cms_block_definition_versions where block_key = p_key and block_version = p_version $body$;
create or replace function pg_temp.p_as_role(p_role text) returns void language sql as $body$ select set_config('request.jwt.claim.role', p_role, true) $body$;

-- ============================================================ AC119 key trust ====
select is(pg_temp.p_ok('t:ok', 'p240trust', 1), 'ok', 'control: the trusted, active, in-window release key registers a block [P2-S09-AC-119]');
create or replace function pg_temp.p_role_call(p_role text, p_request jsonb) returns text language plpgsql as $body$
declare before_rows text := pg_temp.p_block_rows(); outcome text;
begin
  perform set_config('request.jwt.claim.role', p_role, true);
  perform pg_temp.s09d_call('role:' || p_role, 'platform_api.cms_register_block', p_request);
  outcome := pg_temp.s09d_outcome('role:' || p_role);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  return outcome || ' ' || (before_rows = pg_temp.p_block_rows())::text;
end;
$body$;
select is(pg_temp.p_role_call('authenticated', pg_temp.p_block_request('p240trust', 2)), 'UNAUTHENTICATED true', 'an authenticated browser caller is refused before any principal lookup and nothing is committed [P2-S09-AC-119]');
select is(pg_temp.p_role_call('anon', pg_temp.p_block_request('p240trust', 2)), 'UNAUTHENTICATED true', 'an anonymous caller is refused and nothing is committed [P2-S09-AC-119]');
select is(pg_temp.p_bad('t:noctx', 'UNAUTHENTICATED', 'p240trust', 2, '{"context":{}}'), 'ok', 'a request without the bound release principal is refused [P2-S09-AC-119]');
select is(pg_temp.p_bad('t:mismatch', 'UNAUTHENTICATED', 'p240trust', 2, '{"context":{"releasePrincipalId":"release.other"}}'), 'ok', 'a request whose key differs from the bound principal is refused [P2-S09-AC-119]');
select is(pg_temp.p_bad('t:unknown', 'UNAUTHENTICATED', 'p240trust', 2, '{"releaseKeyId":"release.unknown","context":{"releasePrincipalId":"release.unknown"}}'), 'ok', 'an unknown release key is refused [P2-S09-AC-119]');
select is(pg_temp.p_bad('t:badsig', 'UNAUTHENTICATED', 'p240trust', 2, '{}', jsonb_build_object('releaseSignature', repeat('B', 86) || '==', 'releaseSignatureHash', encode(extensions.digest(decode(repeat('B', 86) || '==', 'base64'), 'sha256'), 'hex'))), 'ok',
  'a shape-valid signature that does not verify against the trusted key is refused [P2-S09-AC-119]');
select set_config('app.cfg_rpc', 'true', true);
update platform_private.cfg_release_principals set revoked_at = clock_timestamp() - interval '1 second' where key_id = 'release.p240';
select is(pg_temp.p_bad('t:revoked', 'UNAUTHENTICATED', 'p240trust', 2), 'ok', 'a revoked key is refused even with a valid signature [P2-S09-AC-119]');
update platform_private.cfg_release_principals set revoked_at = null, active = false where key_id = 'release.p240';
select is(pg_temp.p_bad('t:inactive', 'UNAUTHENTICATED', 'p240trust', 2), 'ok', 'an inactive key is refused [P2-S09-AC-119]');
update platform_private.cfg_release_principals set active = true, valid_from = clock_timestamp() + interval '1 hour' where key_id = 'release.p240';
select is(pg_temp.p_bad('t:notyet', 'UNAUTHENTICATED', 'p240trust', 2), 'ok', 'a key that is not yet valid is refused [P2-S09-AC-119]');
update platform_private.cfg_release_principals set valid_from = null, valid_through = clock_timestamp() - interval '1 hour' where key_id = 'release.p240';
select is(pg_temp.p_bad('t:expired', 'UNAUTHENTICATED', 'p240trust', 2), 'ok', 'an expired key is refused [P2-S09-AC-119]');
update platform_private.cfg_release_principals set valid_through = null where key_id = 'release.p240';
select is(pg_temp.p_ok('t:again', 'p240trust', 2), 'ok', 'control: with the key restored the registration is accepted again [P2-S09-AC-119]');

-- ===================================== AC120 skew, nonce replay and retention ====
select is(pg_temp.p_bad('s:late', 'UNAUTHENTICATED', 'p240skew', 1, jsonb_build_object('releaseIssuedAt', (clock_timestamp() - interval '6 minutes')::text)), 'ok', 'a release issued more than five minutes ago is refused [P2-S09-AC-120]');
select is(pg_temp.p_bad('s:early', 'UNAUTHENTICATED', 'p240skew', 1, jsonb_build_object('releaseIssuedAt', (clock_timestamp() + interval '6 minutes')::text)), 'ok', 'a release issued more than five minutes ahead is refused [P2-S09-AC-120]');
select is(pg_temp.p_bad('s:vlate', 'UNAUTHENTICATED', 'p240skew', 1, jsonb_build_object('releaseVerifiedAt', (clock_timestamp() - interval '6 minutes')::text)), 'ok', 'a verification stamp outside the window is refused [P2-S09-AC-120]');
select is(pg_temp.p_ok('s:edge', 'p240skew', 1, jsonb_build_object('releaseIssuedAt', (clock_timestamp() - interval '4 minutes')::text, 'releaseVerifiedAt', (clock_timestamp() - interval '4 minutes')::text)), 'ok',
  'control: four minutes of skew is inside the window [P2-S09-AC-120]');
create temp table p_replay on commit drop as select extensions.gen_random_uuid() as nonce;
select is(pg_temp.p_ok('n:first', 'p240nonce', 1, jsonb_build_object('releaseNonce', (select nonce from p_replay))), 'ok', 'control: a fresh nonce is accepted [P2-S09-AC-120]');
select is(pg_temp.p_bad('n:replay', 'CONFLICT', 'p240nonce', 2, jsonb_build_object('releaseNonce', (select nonce from p_replay))), 'ok',
  'the same nonce under another idempotency key and another version is a typed CONFLICT and nothing is committed [P2-S09-AC-120]');
select ok((select r.expires_at >= r.issued_at + interval '10 minutes' and r.outcome = 'consumed' and r.consumed_at is not null
    from platform_private.cms_release_nonce_receipts r where r.release_key_id = 'release.p240' and r.nonce_hash = encode(extensions.digest(convert_to((select nonce::text from p_replay), 'utf8'), 'sha256'), 'hex')),
  'the receipt is retained for at least ten minutes and records consumption [P2-S09-AC-120]');
select is(pg_temp.s09e_check('cms_release_nonce_receipts', 'cms_release_nonce_receipts_ttl_check', (select id from platform_private.cms_release_nonce_receipts limit 1),
    jsonb_build_object('expires_at', (select (issued_at + interval '9 minutes')::text from platform_private.cms_release_nonce_receipts limit 1))),
  'control:ACCEPTED|override:REJECTED:23514:cms_release_nonce_receipts_ttl_check', 'storage refuses a receipt that would expire before ten minutes [P2-S09-AC-120]');
select is(pg_temp.p_bad('d:conflict', 'CONFLICT', 'p240nonce', 1, jsonb_build_object('releaseDigest', repeat('d', 64))), 'ok', 'a conflicting digest for a registered pair is CONFLICT and nothing is committed [P2-S09-AC-120]');

-- ====================== AC121 / AC213 atomicity: failed audit or outbox leaves nothing ====
create function public.p240_fail() returns trigger language plpgsql as $body$
begin
  if tg_table_name = current_setting('p240.fail_table', true) then raise exception 'P240_FORCED_FAILURE'; end if;
  return new;
end;
$body$;
create trigger p240_fail_outbox before insert on platform_private.outbox_events for each row execute function public.p240_fail();
create trigger p240_fail_audit before insert on audit_private.audit_events for each row execute function public.p240_fail();
create or replace function pg_temp.p_forced(p_table text, p_request jsonb, p_lifecycle boolean) returns text language plpgsql as $body$
declare before_rows text := pg_temp.p_block_rows(); outcome text;
begin
  perform set_config('p240.fail_table', p_table, true);
  if p_lifecycle then perform pg_temp.p_advance('forced:' || p_table, p_request); else perform pg_temp.p_register('forced:' || p_table, p_request); end if;
  outcome := pg_temp.s09d_outcome('forced:' || p_table);
  perform set_config('p240.fail_table', '', true);
  return outcome || ' ' || (before_rows = pg_temp.p_block_rows())::text;
end;
$body$;
create temp table p_forced_req on commit drop as select pg_temp.p_block_request('p240forced', 1) as req;
select is(pg_temp.p_forced('outbox_events', (select req from p_forced_req), false), 'P240_FORCED_FAILURE true',
  'a failed outbox write leaves no registration, no nonce claim, no audit row and no idempotency record [P2-S09-AC-121]');
select is(pg_temp.p_forced('audit_events', (select req from p_forced_req), false), 'P240_FORCED_FAILURE true',
  'a failed audit write leaves no registration and no nonce claim either [P2-S09-AC-213]');
select is(pg_temp.p_block_expect('forced:retry', (select req from p_forced_req), 'OK'), 'ok', 'after the rollbacks the same signed request commits: the nonce was never consumed by the failed attempts [P2-S09-AC-213]');
select is(pg_temp.p_block_expect('forced:replay', pg_temp.p_block_request('p240forced', 1, '{}', '{}', (select (req->>'releaseNonce')::uuid from p_forced_req)), 'CONFLICT'), 'ok',
  'the committed registration''s nonce cannot be admitted again under another idempotency key [P2-S09-AC-213]');
select pg_temp.p_register('forced:replaysame', (select req from p_forced_req));
select ok(pg_temp.s09d_outcome('forced:replaysame') = 'OK' and pg_temp.s09d_resp('forced:replaysame') = pg_temp.s09d_resp('forced:retry'),
  'only the exact same request under the same key replays the stored response; it admits nothing new [P2-S09-AC-213]');
create temp table p_lifecycle_block on commit drop as select pg_temp.p_block_id('p240forced', 1) as id;
create temp table p_forced_lc on commit drop as select pg_temp.p_lifecycle_request((select id from p_lifecycle_block), 'supported', 'deprecated') as req;
select is(pg_temp.p_forced('outbox_events', (select req from p_forced_lc), true), 'P240_FORCED_FAILURE true', 'a failed lifecycle outbox write leaves no event, no nonce claim and no audit row [P2-S09-AC-213]');
select is(pg_temp.p_forced('audit_events', (select req from p_forced_lc), true), 'P240_FORCED_FAILURE true', 'a failed lifecycle audit write rolls back the event and the nonce claim [P2-S09-AC-213]');
select is(pg_temp.p_block_expect('forced:lcretry', (select req from p_forced_lc), 'OK', true), 'ok', 'the same signed lifecycle request then commits [P2-S09-AC-213]');
drop trigger p240_fail_outbox on platform_private.outbox_events;
drop trigger p240_fail_audit on audit_private.audit_events;

-- ============================ AC121 / AC122 / AC175 persisted evidence and resource ====
select ok((select b.release_key_id = 'release.p240' and b.release_raw_body_hash = repeat('0', 64) and b.release_signature_hash ~ '^[a-f0-9]{64}$'
      and b.release_nonce_hash = encode(extensions.digest(convert_to(r.nonce, 'utf8'), 'sha256'), 'hex') and b.props_attestation_key_id = 'release.p240'
      and b.props_attestation_signature_hash ~ '^[a-f0-9]{64}$' and b.props_attestation_verified_at is not null and b.release_verified_at is not null
      and b.release_principal_id = 'a9d10000-0000-4000-8000-000000000005' and b.state = 'registered' and b.version = 1 and b.props_snapshot_attestation->>'algorithm' = 'Ed25519'
    from platform_private.cms_block_definition_versions b, (select (req->>'releaseNonce') as nonce from p_forced_req) r where b.block_key = 'p240forced'),
  'the version persists the outer release evidence (key, raw-body hash, signature hash, nonce hash, verification time) and the props-attestation evidence (key, signature hash, verification time) [P2-S09-AC-121]');
select ok((select b.block_key = 'p240forced' and b.block_version = 1 and b.state = 'registered' and b.props_schema_ref = 'cms/blocks/hero/1' and b.props_schema_hash = repeat('a', 64)
      and b.props_schema_snapshot->>'additionalProperties' = 'false' and b.props_snapshot_hash = platform_private.cms_jcs_sha256(b.props_schema_snapshot) and b.renderer_ref = 'cms/renderers/hero/1'
      and b.allowed_children = '[]'::jsonb and b.slot_rules = '{"maxDepth":1,"maxNodes":1}'::jsonb and b.data_source_permissions = '[]'::jsonb
      and b.accessibility_contract->>'keyboard' = 'true' and b.compatibility_range->>'minSchemaCompiler' = '1' and b.release_digest = repeat('e', 64)
    from platform_private.cms_block_definition_versions b where b.block_key = 'p240forced'),
  'the version persists the registered state, the immutable key and version, props reference, hash, snapshot and attestation, renderer, children, slot rules, data sources, accessibility, compatibility and the release digest [P2-S09-AC-175]');
select ok((select count(*) = 1 from platform_private.cms_release_nonce_receipts r join platform_private.cms_block_definition_versions b on b.release_nonce_hash = r.nonce_hash
      where b.block_key = 'p240forced' and r.operation_id = 'CMS-03A-05' and r.outcome = 'consumed' and r.raw_body_hash = b.release_raw_body_hash and r.signature_hash = b.release_signature_hash),
  'one consumed receipt backs the registration with the same raw-body and signature hashes [P2-S09-AC-121]');
select ok((select (s09d_resp->>'releaseKeyId') = b.release_key_id and (s09d_resp->>'releaseRawBodyHash') = b.release_raw_body_hash and (s09d_resp->>'releaseSignatureHash') = b.release_signature_hash
      and (s09d_resp->>'releaseNonceHash') = b.release_nonce_hash and (s09d_resp->>'releaseVerifiedAt')::timestamptz = b.release_verified_at
      and s09d_resp->'propsSnapshotAttestation' = b.props_snapshot_attestation and s09d_resp->'propsSchemaSnapshot' = b.props_schema_snapshot and s09d_resp->>'propsSnapshotHash' = b.props_snapshot_hash
      and s09d_resp->>'lifecycle' = 'supported' and s09d_resp->>'resourceKind' = 'block_definition_version' and s09d_resp->>'version' = '1'
    from (select pg_temp.s09d_resp('forced:retry') as s09d_resp) r, platform_private.cms_block_definition_versions b where b.block_key = 'p240forced'),
  'the 201 resource carries the full worker-only evidence exactly as persisted: release and attestation evidence, snapshot, hash, lifecycle supported [P2-S09-AC-122]');
select ok((select count(*) = 1 from platform_private.outbox_events o where o.event_type = 'cms.block.registered.v1' and o.aggregate_id = pg_temp.p_block_id('p240forced', 1)), 'exactly one registration outbox row exists [P2-S09-AC-121]');
select is((select string_agg(k, ',' order by k) from (select jsonb_object_keys(o.payload) k from platform_private.outbox_events o where o.event_type = 'cms.block.registered.v1' and o.aggregate_id = pg_temp.p_block_id('p240forced', 1)) x),
  'blockDefinitionVersionId,blockKey,blockVersion,releaseDigest', 'the registration event carries identifiers and the digest only [P2-S09-AC-121]');

-- ======================================== AC012 code-owned, no human mutation ====
select ok(not has_function_privilege('authenticated', 'platform_api.cms_register_block(jsonb)', 'execute') and not has_function_privilege('anon', 'platform_api.cms_register_block(jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'platform_api.cms_advance_block_lifecycle(jsonb)', 'execute') and not has_function_privilege('anon', 'platform_api.cms_advance_block_lifecycle(jsonb)', 'execute')
    and has_function_privilege('service_role', 'platform_api.cms_register_block(jsonb)', 'execute'),
  'browser roles cannot execute registration or lifecycle advance; only the service-role release worker can [P2-S09-AC-012]');
select ok(pg_temp.s09d_no_direct_grants('cms_block_definition_versions') and pg_temp.s09d_no_direct_grants('cms_block_definition_lifecycle_events') and pg_temp.s09d_no_direct_grants('cms_release_nonce_receipts')
    and pg_temp.s09d_rls('cms_block_definition_versions') and pg_temp.s09d_rls('cms_block_definition_lifecycle_events') and pg_temp.s09d_rls('cms_release_nonce_receipts'),
  'the three block tables have forced RLS and no direct privilege for any browser or service role [P2-S09-AC-012]');
select pg_temp.s09d_session('owner', 'service_role');
select pg_temp.s09d_call('human:reg', 'platform_api.cms_register_block', (pg_temp.p_block_request('p240human', 1) - 'context') || jsonb_build_object('context', pg_temp.s09d_context('owner')));
select is(pg_temp.s09d_outcome('human:reg'), 'UNAUTHENTICATED', 'a verified human with cms.schema_designer holds no release principal: registration is refused [P2-S09-AC-012]');
select is(pg_temp.s09e_writers('cms_block_definition_versions', 'insert[[:space:]]+into') || '|' || pg_temp.s09e_writers('cms_block_definition_versions', 'update') || '|' || pg_temp.s09e_writers('cms_block_definition_versions', 'delete[[:space:]]+from'),
  'cms_register_block_at||', 'one function inserts a block version and none updates or deletes it [P2-S09-AC-012]');
select set_config('app.cms_rpc', 'true', true);
select throws_ok(format('update platform_private.cms_block_definition_versions set renderer_ref = %L where block_key = ''p240forced''', 'cms/renderers/hero/1'), 'P0001', 'IMMUTABLE_RECORD', 'a registered version cannot be mutated [P2-S09-AC-012]');
select throws_ok(format('delete from platform_private.cms_block_definition_versions where block_key = ''p240forced'''), 'P0001', 'IMMUTABLE_RECORD', 'nor deleted [P2-S09-AC-012]');
select set_config('app.cms_rpc', '', true);
select is(pg_temp.p_bad('src:' || c.n, 'VALIDATION_FAILED', 'p240src', 1, jsonb_build_object('rendererRef', c.v)), 'ok', 'implementation supplied as ' || c.n || ' is refused: block code lives in the repository, not in CMS [P2-S09-AC-012]')
from (values ('a URL', 'https://evil.example/block.js'), ('source text', 'module.exports = () => 1'), ('an uploaded module', 'uploads/block.mjs')) c(n, v);

-- ================================================ AC176 the nonce receipt table ====
select ok((select count(*) filter (where r.operation_id = 'CMS-03A-05') >= 5 and count(*) filter (where r.operation_id = 'CMS-03A-08') >= 1
    and bool_and(r.expires_at >= r.issued_at + interval '10 minutes') and bool_and(r.signature_hash ~ '^[a-f0-9]{64}$' and r.raw_body_hash ~ '^[a-f0-9]{64}$' and r.nonce_hash ~ '^[a-f0-9]{64}$')
    and bool_and(r.outcome = 'consumed') and bool_and(r.consumed_at is not null) from platform_private.cms_release_nonce_receipts r),
  'every receipt names its operation, hashes (nonce, raw body, signature), issue and expiry at least ten minutes later, and its consumption [P2-S09-AC-176]');
select is(pg_temp.s09e_unique('cms_release_nonce_receipts', (select id from platform_private.cms_release_nonce_receipts limit 1), array['release_key_id', 'nonce_hash'], jsonb_build_object('nonce_hash', repeat('7', 64))),
  'dup:REJECTED:23505|ctl:ACCEPTED', 'the (release key, nonce hash) pair is unique [P2-S09-AC-176]');
select is((select count(*)::integer from platform_private.cms_release_nonce_receipts where outcome = 'claimed'), 0, 'no receipt is left merely claimed after a committed or rolled-back admission [P2-S09-AC-176]');
select is(pg_temp.s09e_writers('cms_release_nonce_receipts', 'delete[[:space:]]+from'), '', 'no function deletes a receipt: expiry cleanup cannot shorten the ten-minute retention [P2-S09-AC-176]');
select set_config('app.cms_rpc', 'true', true);
select throws_ok(format('delete from platform_private.cms_release_nonce_receipts where release_key_id = ''release.p240'''), 'P0001', null, 'a receipt cannot be deleted directly [P2-S09-AC-176]');
select set_config('app.cms_rpc', '', true);

-- ===================================================== AC197 A05 failure mapping ====
select is(pg_temp.p_bad('f:sig', 'UNAUTHENTICATED', 'p240fail', 1, '{}', jsonb_build_object('releaseRawBodyHash', repeat('9', 64))), 'ok', 'a signature failure is 401 UNAUTHENTICATED and creates no registration [P2-S09-AC-197]');
select is(pg_temp.p_bad('f:principal', 'UNAUTHENTICATED', 'p240fail', 1, '{"context":{}}'), 'ok', 'a principal failure is 401 UNAUTHENTICATED [P2-S09-AC-197]');
select is(pg_temp.p_bad('f:manifest', 'VALIDATION_FAILED', 'p240fail', 1, '{"rendererRef":"cms/renderers/unregistered/1"}'), 'ok', 'a manifest failure is 422 VALIDATION_FAILED [P2-S09-AC-197]');
select is(pg_temp.p_bad('f:props', 'VALIDATION_FAILED', 'p240fail', 1, '{"propsSnapshotHash":"1111111111111111111111111111111111111111111111111111111111111111"}'), 'ok', 'a props failure is 422 VALIDATION_FAILED [P2-S09-AC-197]');
select is(pg_temp.p_bad('f:digest', 'UNAUTHENTICATED', 'p240fail', 1, '{}', jsonb_build_object('releaseDigest', repeat('f', 64))), 'ok', 'a digest not bound by the attestation is refused [P2-S09-AC-197]');
select is(pg_temp.p_ok('f:first', 'p240fail', 1), 'ok', 'control: the registration itself succeeds [P2-S09-AC-197]');
select is(pg_temp.p_bad('f:dup', 'CONFLICT', 'p240fail', 1), 'ok', 'a duplicate pair is 409 CONFLICT and creates no second registration [P2-S09-AC-197]');
select is((select count(*)::integer from platform_private.cms_block_definition_versions where block_key = 'p240fail'), 1, 'exactly one registration exists after every failure [P2-S09-AC-197]');
select pg_temp.p_register('f:idem1', pg_temp.p_block_request('p240fail', 2, '{"idempotencyKey":"p240-blk-idem-mismatch-0001"}'));
select pg_temp.p_register('f:idem2', pg_temp.p_block_request('p240fail', 3, '{"idempotencyKey":"p240-blk-idem-mismatch-0001"}'));
select is(pg_temp.s09d_outcome('f:idem2'), 'IDEMPOTENCY_MISMATCH', 'a reused idempotency key with another request is a typed idempotency conflict [P2-S09-AC-197]');
select is((select count(*)::integer from platform_private.cms_block_definition_versions where block_key = 'p240fail' and block_version = 3), 0, 'and registers nothing [P2-S09-AC-197]');

select * from finish();
rollback;
