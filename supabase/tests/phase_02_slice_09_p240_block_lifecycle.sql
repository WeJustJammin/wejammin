commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): CMS-03A-08 signed
-- block lifecycle advance.  Blocks are registered through CMS-03A-05; every advance
-- is signed in SQL.  A refusal is compared with a fingerprint of the block, nonce,
-- event, outbox, audit and idempotency rows; the version row is compared byte for
-- byte across every advance.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc

create or replace function pg_temp.p_reg(p_key text, p_version integer) returns uuid language plpgsql as $body$
begin
  perform pg_temp.p_register('reg:' || p_key || p_version, pg_temp.p_block_request(p_key, p_version));
  return (pg_temp.s09d_resp('reg:' || p_key || p_version)->>'id')::uuid;
end;
$body$;
create or replace function pg_temp.p_lc(p_label text, p_block uuid, p_from text, p_to text, p_expected text default '1', p_expect text default 'OK', p_over jsonb default '{}'::jsonb, p_post jsonb default '{}'::jsonb) returns text
language sql as $body$ select pg_temp.p_block_expect(p_label, pg_temp.p_lifecycle_request(p_block, p_from, p_to, p_expected, p_over, p_post), p_expect, true) $body$;
create or replace function pg_temp.p_row(p_block uuid) returns text language sql stable as $body$ select b::text from platform_private.cms_block_definition_versions b where b.id = p_block $body$;
create or replace function pg_temp.p_events(p_block uuid) returns text language sql stable as $body$
  select coalesce(string_agg(e.from_lifecycle || '>' || e.to_lifecycle, ',' order by e.created_at, e.id), '') from platform_private.cms_block_definition_lifecycle_events e where e.block_definition_version_id = p_block $body$;

create temp table p_blocks on commit drop as select pg_temp.p_reg('p240lc', 1) as a, pg_temp.p_reg('p240lc', 2) as b, pg_temp.p_reg('p240lc', 3) as c, pg_temp.p_reg('p240lc', 4) as d;
select is((select count(*)::integer from p_blocks where a is not null and b is not null and c is not null and d is not null), 1, 'fixture: four blocks are registered through CMS-03A-05');
create temp table p_row_before on commit drop as select pg_temp.p_row((select a from p_blocks)) as row_a;

-- ============================ AC149 request, AC150 existing path resource ====
select is(pg_temp.p_lc('a:ok', (select a from p_blocks), 'supported', 'deprecated'), 'ok', 'control: a well-formed signed lifecycle request is accepted [P2-S09-AC-149]');
select is(pg_temp.p_lc('a:from:' || c.n, (select b from p_blocks), c.f, 'deprecated', '1', 'VALIDATION_FAILED'), 'ok', 'fromLifecycle ' || c.n || ' is refused and nothing is committed [P2-S09-AC-149]')
from (values ('withdrawn', 'withdrawn'), ('registered', 'registered'), ('uppercase', 'SUPPORTED'), ('empty', '')) c(n, f);
select is(pg_temp.p_lc('a:to:' || c.n, (select b from p_blocks), 'supported', c.t, '1', 'VALIDATION_FAILED'), 'ok', 'toLifecycle ' || c.n || ' is refused and nothing is committed [P2-S09-AC-149]')
from (values ('supported', 'supported'), ('registered', 'registered'), ('empty', '')) c(n, t);
select is(pg_temp.p_lc('a:ver:' || c.n, (select b from p_blocks), 'supported', 'deprecated', c.v, 'VALIDATION_FAILED'), 'ok', 'expectedVersion ' || c.n || ' is refused and nothing is committed [P2-S09-AC-153]')
from (values ('zero', '0'), ('negative', '-1'), ('padded', '01'), ('fractional', '1.5'), ('textual', 'one'), ('empty', '')) c(n, v);
select is(pg_temp.p_lc('a:dig:' || c.n, (select b from p_blocks), 'supported', 'deprecated', '1', 'VALIDATION_FAILED', jsonb_build_object('releaseDigest', c.v)), 'ok', 'releaseDigest ' || c.n || ' is refused and nothing is committed [P2-S09-AC-154]')
from (values ('in uppercase', repeat('E', 64)), ('of 63 characters', repeat('e', 63)), ('with a non-hex digit', repeat('e', 63) || 'z'), ('that is empty', '')) c(n, v);
select is(pg_temp.p_lc('a:id:malformed', null, 'supported', 'deprecated', '1', 'VALIDATION_FAILED', '{"blockDefinitionVersionId":"nope"}'), 'ok', 'a malformed block identifier is refused [P2-S09-AC-150]');
select is(pg_temp.p_lc('a:id:unknown', extensions.gen_random_uuid(), 'supported', 'deprecated', '1', 'NOT_FOUND'), 'ok', 'an unknown block identifier is NOT_FOUND and nothing is committed [P2-S09-AC-150]');
select is(pg_temp.p_block_expect('a:id:label', pg_temp.p_sign(pg_temp.p_lifecycle_request((select b from p_blocks), 'supported', 'deprecated', '1', '{"blockKey":"p240lc","blockVersion":"2"}') - 'blockDefinitionVersionId', 'CMS-03A-08'), 'VALIDATION_FAILED', true), 'ok',
  'a block key and version cannot stand in for the version identifier [P2-S09-AC-150]');
select is((select count(*)::integer from platform_private.cms_block_definition_versions where block_key = 'p240lc'), 4, 'the lifecycle route created no key or version: still four registered blocks [P2-S09-AC-150]');

-- ================================ AC151 / AC152 / AC157 transitions and staleness ====
select is(pg_temp.p_lc('t:fromwrong', (select b from p_blocks), 'deprecated', 'withdrawn', '1', 'CONFLICT'), 'ok', 'fromLifecycle must equal the server-derived current lifecycle: deprecated claimed for a supported block is CONFLICT [P2-S09-AC-151]');
select is(pg_temp.p_lc('t:skip', (select b from p_blocks), 'supported', 'withdrawn', '1', 'VALIDATION_FAILED'), 'ok', 'supported to withdrawn is not an allowed transition and nothing is committed [P2-S09-AC-152]');
select is(pg_temp.p_lc('t:same', (select b from p_blocks), 'supported', 'supported', '1', 'VALIDATION_FAILED'), 'ok', 'a transition to the same lifecycle is refused [P2-S09-AC-152]');
select is(pg_temp.p_lc('t:dep:dep', (select a from p_blocks), 'deprecated', 'deprecated', '1', 'VALIDATION_FAILED'), 'ok', 'deprecated to deprecated is refused [P2-S09-AC-152]');
select is(pg_temp.p_lc('t:back', (select a from p_blocks), 'deprecated', 'supported', '1', 'VALIDATION_FAILED'), 'ok', 'there is no way back to supported [P2-S09-AC-152]');
select is(pg_temp.p_lc('t:dup', (select a from p_blocks), 'supported', 'deprecated', '1', 'CONFLICT'), 'ok', 'a duplicate transition (the block is already deprecated) is CONFLICT and appends no event [P2-S09-AC-157]');
select is(pg_temp.p_lc('t:w', (select a from p_blocks), 'deprecated', 'withdrawn'), 'ok', 'deprecated to withdrawn is the second allowed step [P2-S09-AC-152]');
select is(pg_temp.p_events((select a from p_blocks)), 'supported>deprecated,deprecated>withdrawn', 'the ordered events are exactly supported to deprecated to withdrawn [P2-S09-AC-152]');
select is(pg_temp.p_lc('t:after', (select a from p_blocks), 'withdrawn', 'withdrawn', '1', 'VALIDATION_FAILED'), 'ok', 'nothing follows withdrawn [P2-S09-AC-152]');
select is(pg_temp.p_lc('t:after2', (select a from p_blocks), 'deprecated', 'withdrawn', '1', 'CONFLICT'), 'ok', 'a second withdrawal is CONFLICT [P2-S09-AC-157]');
select is(pg_temp.p_lc('v:stale', (select c from p_blocks), 'supported', 'deprecated', '2', 'VERSION_MISMATCH'), 'ok', 'a stale expectedVersion is VERSION_MISMATCH under the block lock and nothing is committed [P2-S09-AC-153]');
select is(pg_temp.p_lc('v:digest', (select c from p_blocks), 'supported', 'deprecated', '1', 'CONFLICT', jsonb_build_object('releaseDigest', repeat('d', 64))), 'ok', 'a digest that is not the registered immutable release digest is CONFLICT [P2-S09-AC-154]');
select is(pg_temp.p_lc('v:ok', (select c from p_blocks), 'supported', 'deprecated'), 'ok', 'control: with the registered digest and version the advance is accepted [P2-S09-AC-154]');

-- =============================== AC155 verification before parsing or state lookup ====
select is(pg_temp.p_lc('s:badsig:unknown', extensions.gen_random_uuid(), 'supported', 'deprecated', '1', 'UNAUTHENTICATED', '{}', jsonb_build_object('releaseRawBodyHash', repeat('9', 64))), 'ok',
  'a bad release signature is 401 even for an unknown block: state is never looked up before the signature [P2-S09-AC-155]');
select is(pg_temp.p_lc('s:badsig:known', (select d from p_blocks), 'supported', 'deprecated', '1', 'UNAUTHENTICATED', '{}', jsonb_build_object('releaseRawBodyHash', repeat('9', 64))), 'ok', 'and for a known block [P2-S09-AC-155]');
select is(pg_temp.p_lc('s:unknownkey', (select d from p_blocks), 'supported', 'deprecated', '1', 'UNAUTHENTICATED', '{"releaseKeyId":"release.unknown","context":{"releasePrincipalId":"release.unknown"}}'), 'ok', 'an unknown release key is refused before any lookup [P2-S09-AC-155]');
select is(pg_temp.p_lc('s:invalid:unsigned', (select d from p_blocks), 'withdrawn', 'deprecated', '1', 'VALIDATION_FAILED'), 'ok', 'a validly signed but malformed request is a validation failure and appends nothing [P2-S09-AC-155]');
create or replace function pg_temp.p_role_advance(p_role text) returns text language plpgsql as $body$
declare before_rows text := pg_temp.p_block_rows(); outcome text;
begin
  perform set_config('request.jwt.claim.role', p_role, true);
  perform pg_temp.s09d_call('lcrole:' || p_role, 'platform_api.cms_advance_block_lifecycle', pg_temp.p_lifecycle_request((select d from p_blocks), 'supported', 'deprecated'));
  outcome := pg_temp.s09d_outcome('lcrole:' || p_role);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  return outcome || ' ' || (before_rows = pg_temp.p_block_rows())::text;
end;
$body$;
select is(pg_temp.p_role_advance('authenticated'), 'UNAUTHENTICATED true', 'an authenticated browser caller is refused and nothing is committed [P2-S09-AC-164]');
select is(pg_temp.p_role_advance('anon'), 'UNAUTHENTICATED true', 'an anonymous caller is refused and nothing is committed [P2-S09-AC-164]');
select pg_temp.s09d_session('owner', 'service_role');
select pg_temp.s09d_call('human:lc', 'platform_api.cms_advance_block_lifecycle', (pg_temp.p_lifecycle_request((select d from p_blocks), 'supported', 'deprecated') - 'context') || jsonb_build_object('context', pg_temp.s09d_context('owner')));
select is(pg_temp.s09d_outcome('human:lc'), 'UNAUTHENTICATED', 'a verified human designer holds no release principal and cannot advance a lifecycle [P2-S09-AC-164]');
select ok(not has_function_privilege('authenticated', 'platform_api.cms_advance_block_lifecycle(jsonb)', 'execute') and not has_function_privilege('anon', 'platform_api.cms_advance_block_lifecycle(jsonb)', 'execute')
    and pg_temp.s09d_no_direct_grants('cms_block_definition_lifecycle_events'), 'no browser role can execute the lifecycle RPC or touch the event table: there is no browser mutation path [P2-S09-AC-164]');
select ok((select count(*) = 3 and bool_and(outcome = 'consumed') from platform_private.cms_release_nonce_receipts where operation_id = 'CMS-03A-08'), 'nonce evidence for the three committed advances stays on the release-worker boundary, in the same table as the registrations [P2-S09-AC-164]');

-- ========================================== AC156 durable nonce receipt claim ====
create temp table p_nonce_case on commit drop as select extensions.gen_random_uuid() as nonce, pg_temp.p_reg('p240lc', 5) as blk;
select is(pg_temp.p_block_expect('n:ok', pg_temp.p_lifecycle_request((select blk from p_nonce_case), 'supported', 'deprecated', '1', '{}', '{}', (select nonce from p_nonce_case)), 'OK', true), 'ok', 'control: a fresh nonce advances the block [P2-S09-AC-156]');
select ok((select r.operation_id = 'CMS-03A-08' and r.outcome = 'consumed' and r.consumed_at is not null and r.expires_at >= r.issued_at + interval '10 minutes'
    from platform_private.cms_release_nonce_receipts r where r.release_key_id = 'release.p240' and r.nonce_hash = encode(extensions.digest(convert_to((select nonce::text from p_nonce_case), 'utf8'), 'sha256'), 'hex')),
  'the (release key, nonce hash) receipt was claimed and consumed with the mutation and is retained for ten minutes [P2-S09-AC-156]');
select is(pg_temp.p_block_expect('n:replay', pg_temp.p_lifecycle_request((select blk from p_nonce_case), 'deprecated', 'withdrawn', '1', '{}', '{}', (select nonce from p_nonce_case)), 'CONFLICT', true), 'ok',
  'the same nonce cannot admit a second advance: CONFLICT and no second event [P2-S09-AC-156]');
select is(pg_temp.p_events((select blk from p_nonce_case)), 'supported>deprecated', 'only the first transition was recorded [P2-S09-AC-156]');
select ok((select signature_hash ~ '^[a-f0-9]{64}$' and raw_body_hash ~ '^[a-f0-9]{64}$' from platform_private.cms_release_nonce_receipts where operation_id = 'CMS-03A-08' limit 1), 'the receipt stores the raw-body and signature hashes of the advance [P2-S09-AC-156]');

-- ========================== AC158 / AC159 / AC160 / AC162 / AC163 events, atomicity, resource ====
select is(pg_temp.p_row((select a from p_blocks)), (select row_a from p_row_before), 'two advances later the block version row is byte-identical to its registration: no update ever touches it [P2-S09-AC-158]');
select is((select count(*)::integer from platform_private.cms_block_definition_lifecycle_events where block_definition_version_id = (select a from p_blocks)), 2, 'each advance appended exactly one immutable event row [P2-S09-AC-158]');
select set_config('app.cms_rpc', 'true', true);
select throws_ok(format('update platform_private.cms_block_definition_lifecycle_events set to_lifecycle = %L where block_definition_version_id = %L', 'withdrawn', (select a from p_blocks)), 'P0001', 'IMMUTABLE_RECORD', 'an event cannot be updated [P2-S09-AC-158]');
select throws_ok(format('delete from platform_private.cms_block_definition_lifecycle_events where block_definition_version_id = %L', (select a from p_blocks)), 'P0001', 'IMMUTABLE_RECORD', 'an event cannot be deleted [P2-S09-AC-158]');
select throws_ok(format('update platform_private.cms_block_definition_versions set release_digest = %L where id = %L', repeat('1', 64), (select a from p_blocks)), 'P0001', 'IMMUTABLE_RECORD', 'the version row cannot be updated [P2-S09-AC-158]');
select set_config('app.cms_rpc', '', true);
select is(pg_temp.s09e_writers('cms_block_definition_lifecycle_events', 'insert[[:space:]]+into'), 'cms_advance_block_lifecycle', 'one function appends lifecycle events [P2-S09-AC-158]');
select is(pg_temp.s09e_writers('cms_block_definition_lifecycle_events', 'update') || pg_temp.s09e_writers('cms_block_definition_lifecycle_events', 'delete[[:space:]]+from'), '', 'none updates or deletes one [P2-S09-AC-158]');
-- ======================================= AC177 the lifecycle event table ====
select ok((select bool_and(e.state = 'recorded' and e.version = 1 and e.updated_at = e.created_at and e.release_digest = repeat('e', 64) and e.release_key_id = 'release.p240'
      and e.release_raw_body_hash ~ '^[a-f0-9]{64}$' and e.release_signature_hash ~ '^[a-f0-9]{64}$' and e.release_nonce_hash ~ '^[a-f0-9]{64}$' and e.release_verified_at is not null
      and e.release_principal_id = 'a9d10000-0000-4000-8000-000000000005' and e.block_key = b.block_key and e.block_version = b.block_version and e.owner_id = b.owner_id)
    from platform_private.cms_block_definition_lifecycle_events e join platform_private.cms_block_definition_versions b on b.id = e.block_definition_version_id),
  'every event is a recorded envelope that names its block (key and version), the transition, the release digest and the full release evidence [P2-S09-AC-177]');
select is(pg_temp.s09e_fk_probe('platform_private', 'cms_block_definition_lifecycle_events'), 'probed=' || (select count(*) from pg_constraint where conrelid = 'platform_private.cms_block_definition_lifecycle_events'::regclass and contype = 'f') || ';bad=',
  'every foreign key of the event table, the existing-block reference included, rejects a dangling value [P2-S09-AC-177]');
select is(pg_temp.s09e_unique('cms_block_definition_lifecycle_events', (select id from platform_private.cms_block_definition_lifecycle_events where to_lifecycle = 'deprecated' limit 1), array['block_definition_version_id', 'to_lifecycle'],
    '{"from_lifecycle":"deprecated","to_lifecycle":"withdrawn"}'), 'dup:REJECTED:23505|ctl:ACCEPTED', 'one block records each target lifecycle at most once (unique transition per block) [P2-S09-AC-177]');
select is(pg_temp.s09e_unique('cms_block_definition_lifecycle_events', (select id from platform_private.cms_block_definition_lifecycle_events where to_lifecycle = 'deprecated' limit 1), array['block_key', 'block_version', 'to_lifecycle'],
    '{"from_lifecycle":"deprecated","to_lifecycle":"withdrawn"}'), 'dup:REJECTED:23505|ctl:ACCEPTED', 'and the same holds by block key and version [P2-S09-AC-177]');
select ok((select bool_and(e.created_at > lag_at) from (select e.created_at, lag(e.created_at) over (order by e.created_at, e.id) as lag_at, e.block_definition_version_id from platform_private.cms_block_definition_lifecycle_events e) e
      where e.lag_at is not null and e.block_definition_version_id = (select a from p_blocks)),
  'the events of one block are stamped in the order the block lock was granted, so the derived lifecycle follows them [P2-S09-AC-177]');

create function public.p240_fail() returns trigger language plpgsql as $body$
begin
  if tg_table_name = current_setting('p240.fail_table', true) then raise exception 'P240_FORCED_FAILURE'; end if;
  return new;
end;
$body$;
create trigger p240_fail_outbox before insert on platform_private.outbox_events for each row execute function public.p240_fail();
create trigger p240_fail_audit before insert on audit_private.audit_events for each row execute function public.p240_fail();
create or replace function pg_temp.p_forced(p_table text, p_request jsonb) returns text language plpgsql as $body$
declare before_rows text := pg_temp.p_block_rows(); outcome text; before_events text := pg_temp.p_events((select d from p_blocks));
begin
  perform set_config('p240.fail_table', p_table, true);
  perform pg_temp.p_advance('forced:' || p_table, p_request);
  outcome := pg_temp.s09d_outcome('forced:' || p_table);
  perform set_config('p240.fail_table', '', true);
  return outcome || ' ' || (before_rows = pg_temp.p_block_rows())::text || ' ' || (before_events = pg_temp.p_events((select d from p_blocks)))::text;
end;
$body$;
create temp table p_forced_req on commit drop as select pg_temp.p_lifecycle_request((select d from p_blocks), 'supported', 'deprecated') as req;
select is(pg_temp.p_forced('outbox_events', (select req from p_forced_req)), 'P240_FORCED_FAILURE true true', 'a failed outbox write rolls back the event, the nonce consumption, the audit row and the idempotency record [P2-S09-AC-159]');
select is(pg_temp.p_forced('audit_events', (select req from p_forced_req)), 'P240_FORCED_FAILURE true true', 'a failed audit write rolls all of them back [P2-S09-AC-159]');
drop trigger p240_fail_outbox on platform_private.outbox_events;
drop trigger p240_fail_audit on audit_private.audit_events;
select is(pg_temp.p_block_expect('forced:retry', (select req from p_forced_req), 'OK', true), 'ok', 'the same signed request then commits all four effects together [P2-S09-AC-159]');
select ok((select count(*) = 1 from platform_private.outbox_events o where o.event_type = 'cms.block.lifecycle.changed.v1' and o.aggregate_id = (select d from p_blocks))
    and (select count(*) = 1 from audit_private.audit_events a where a.action = 'cms.block.lifecycle.advance' and a.target_id = (select e.id from platform_private.cms_block_definition_lifecycle_events e where e.block_definition_version_id = (select d from p_blocks)))
    and (select count(*) = 1 from platform_private.cms_block_definition_lifecycle_events e where e.block_definition_version_id = (select d from p_blocks)),
  'exactly one event row, one audit row and one outbox row were committed together [P2-S09-AC-159]');
select ok((select s.r->>'resourceKind' = 'block_definition_lifecycle_event' and s.r->>'fromLifecycle' = 'supported' and s.r->>'toLifecycle' = 'deprecated' and s.r->>'eventType' = 'cms.block.lifecycle.changed.v1'
      and s.r->>'releaseDigest' = repeat('e', 64) and s.r->>'releaseKeyId' = 'release.p240' and s.r ? 'releaseNonceHash' and s.r ? 'releaseVerifiedAt' and s.r ? 'id' and s.r->>'blockDefinitionVersionId' = (select d::text from p_blocks)
      and s.r->>'lifecycle' = 'deprecated' and s.r->>'version' = '1'
    from (select pg_temp.s09d_resp('forced:retry') r) s),
  'the 201 resource carries the event identity, transition, digest, release verification and event type [P2-S09-AC-160]');
select is((select string_agg(k, ',' order by k) from (select jsonb_object_keys(o.payload) k from platform_private.outbox_events o where o.event_type = 'cms.block.lifecycle.changed.v1' and o.aggregate_id = (select d from p_blocks) limit 40) x),
  'blockDefinitionVersionId,blockKey,blockVersion,fromLifecycle,releaseDigest,releaseKeyId,releaseNonceHash,releaseVerifiedAt,toLifecycle',
  'the event payload is exactly the nine members of the BE03a strict BlockLifecycleChangedEventPayload: identifiers, lifecycle values, digest, key id, nonce hash and verification time; no signature, raw-body hash or key material [P2-S09-AC-163]');
select is((select count(*)::integer from platform_private.outbox_events o where o.event_type = 'cms.block.lifecycle.changed.v1' and o.aggregate_id = (select blk from p_nonce_case)), 1,
  'the lifecycle event reached the outbox exactly once and only for the committed advance; refused attempts emitted none [P2-S09-AC-163]');
select is((select count(*)::integer from information_schema.columns where table_schema = 'platform_private' and table_name in ('cms_block_definition_versions', 'cms_block_definition_lifecycle_events') and column_name in ('lifecycle', 'current_lifecycle', 'effective_lifecycle')), 0,
  'no table stores a duplicate mutable lifecycle value [P2-S09-AC-162]');
select is((select string_agg(x.state, ',' order by x.n) from (select 1 n, pg_temp.p_events((select a from p_blocks)) state) x), 'supported>deprecated,deprecated>withdrawn',
  'the effective lifecycle is derived from the initial supported value and the ordered events: the last event of block a ends at withdrawn [P2-S09-AC-162]');
select is((select coalesce((select to_lifecycle from platform_private.cms_block_definition_lifecycle_events e where e.block_definition_version_id = b.id order by e.created_at desc, e.id desc limit 1), 'supported')
    from platform_private.cms_block_definition_versions b where b.id = (select b from p_blocks)), 'supported', 'a block with no event is effectively supported without any stored value [P2-S09-AC-162]');

-- ================================== AC161 exact replay only, conflicts never append ====
create temp table p_replay on commit drop as select pg_temp.p_reg('p240lc', 6) as blk;
create temp table p_replay_req on commit drop as select pg_temp.p_lifecycle_request((select blk from p_replay), 'supported', 'deprecated') as req;
select pg_temp.p_advance('rp:first', (select req from p_replay_req));
select pg_temp.p_advance('rp:again', (select req from p_replay_req));
select ok(pg_temp.s09d_outcome('rp:first') = 'OK' and pg_temp.s09d_resp('rp:again') = pg_temp.s09d_resp('rp:first'), 'the identical signed request under its own key replays the stored resource [P2-S09-AC-161]');
select is(pg_temp.p_events((select blk from p_replay)), 'supported>deprecated', 'and appended no second event [P2-S09-AC-161]');
select is(pg_temp.p_block_expect('rp:diff', (select req from p_replay_req) || jsonb_build_object('releaseDigest', repeat('d', 64)), 'IDEMPOTENCY_MISMATCH', true), 'ok', 'the same key with a different body is a typed idempotency conflict and appends nothing [P2-S09-AC-161]');
select is(pg_temp.p_block_expect('rp:nonce', pg_temp.p_lifecycle_request((select blk from p_replay), 'supported', 'deprecated', '1', '{}', '{}', (select (req->>'releaseNonce')::uuid from p_replay_req)), 'CONFLICT', true), 'ok',
  'the same nonce under another key is CONFLICT and appends nothing [P2-S09-AC-161]');
select is(pg_temp.p_block_expect('rp:newnonce', pg_temp.p_lifecycle_request((select blk from p_replay), 'supported', 'deprecated'), 'CONFLICT', true), 'ok',
  'a fresh nonce for the already applied transition is CONFLICT and appends nothing [P2-S09-AC-161]');
select is(pg_temp.p_events((select blk from p_replay)), 'supported>deprecated', 'the block still has exactly one event [P2-S09-AC-161]');

-- ===================================================== AC200 A08 failure mapping ====
select is(pg_temp.p_lc('e:sig', (select blk from p_replay), 'deprecated', 'withdrawn', '1', 'UNAUTHENTICATED', '{}', jsonb_build_object('releaseRawBodyHash', repeat('9', 64))), 'ok', 'a signature failure is 401 UNAUTHENTICATED [P2-S09-AC-200]');
select is(pg_temp.p_lc('e:principal', (select blk from p_replay), 'deprecated', 'withdrawn', '1', 'UNAUTHENTICATED', '{"context":{}}'), 'ok', 'a principal failure is 401 UNAUTHENTICATED [P2-S09-AC-200]');
select is(pg_temp.p_lc('e:path', extensions.gen_random_uuid(), 'deprecated', 'withdrawn', '1', 'NOT_FOUND'), 'ok', 'an unknown path resource is 404 NOT_FOUND [P2-S09-AC-200]');
select is(pg_temp.p_lc('e:lifecycle', (select blk from p_replay), 'supported', 'deprecated', '1', 'CONFLICT'), 'ok', 'a lifecycle mismatch is 409 CONFLICT [P2-S09-AC-200]');
select is(pg_temp.p_lc('e:digest', (select blk from p_replay), 'deprecated', 'withdrawn', '1', 'CONFLICT', jsonb_build_object('releaseDigest', repeat('d', 64))), 'ok', 'a digest mismatch is 409 CONFLICT [P2-S09-AC-200]');
select is(pg_temp.p_lc('e:version', (select blk from p_replay), 'deprecated', 'withdrawn', '3', 'VERSION_MISMATCH'), 'ok', 'a stale version is 409 VERSION_MISMATCH [P2-S09-AC-200]');
select is(pg_temp.p_lc('e:nonce', (select blk from p_replay), 'deprecated', 'withdrawn'), 'ok', 'control: the valid next step is accepted [P2-S09-AC-200]');
select is(pg_temp.p_events((select blk from p_replay)), 'supported>deprecated,deprecated>withdrawn', 'only the valid transitions were appended across every refusal [P2-S09-AC-200]');
select pg_temp.p_advance('e:idem1', pg_temp.p_lifecycle_request((select a from p_blocks), 'withdrawn', 'withdrawn', '1', '{"idempotencyKey":"p240-lc-idem-0001"}'));
select pg_temp.p_advance('e:idem2', pg_temp.p_lifecycle_request((select b from p_blocks), 'supported', 'deprecated', '1', '{"idempotencyKey":"p240-lc-idem-0001"}'));
select is(pg_temp.s09d_outcome('e:idem2'), 'OK', 'an idempotency key that never completed (its first use was refused) is free to use again [P2-S09-AC-200]');

select * from finish();
rollback;
