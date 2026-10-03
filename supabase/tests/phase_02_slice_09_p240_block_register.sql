\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): CMS-03A-05 signed
-- block registration.  Every request is signed in SQL over the production signing
-- payloads; a refusal is compared with a fingerprint of the block, nonce, event,
-- outbox, audit and idempotency rows, and each refusal has an accepted control.  The
-- Worker half (raw-byte verification, header names, parse order) is the Worker lane.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc

create or replace function pg_temp.p_ok(p_label text, p_key text, p_version integer, p_over jsonb default '{}'::jsonb, p_post jsonb default '{}'::jsonb) returns text
language sql as $body$ select pg_temp.p_block_expect(p_label, pg_temp.p_block_request(p_key, p_version, p_over, p_post), 'OK') $body$;
create or replace function pg_temp.p_bad(p_label text, p_expected text, p_key text, p_version integer, p_over jsonb default '{}'::jsonb, p_post jsonb default '{}'::jsonb) returns text
language sql as $body$ select pg_temp.p_block_expect(p_label, pg_temp.p_block_request(p_key, p_version, p_over, p_post), p_expected) $body$;

-- ================================================ AC103 strict request, AC104 identity ====
select is(pg_temp.p_ok('r:ok', 'p240blk', 1), 'ok', 'control: a complete signed registration is accepted [P2-S09-AC-103]');
select is(pg_temp.p_block_expect('r:extra', pg_temp.p_sign(pg_temp.p_block_request('p240blk', 2) || '{"surprise":true}', 'CMS-03A-05'), 'VALIDATION_FAILED'), 'ok',
  'an unknown member is refused: the request is a strict object [P2-S09-AC-103]');
select is(pg_temp.p_block_expect('r:miss:' || k, pg_temp.p_sign(pg_temp.p_block_request('p240blk', 2) - k, 'CMS-03A-05'), 'VALIDATION_FAILED'), 'ok',
  'removing the required member ' || k || ' is refused and nothing is committed [P2-S09-AC-103]')
from unnest(array['blockKey', 'blockVersion', 'propsSchemaRef', 'propsSchemaHash', 'propsSchemaSnapshot', 'propsSnapshotHash', 'propsSnapshotAttestation', 'rendererRef',
  'allowedChildren', 'slotRules', 'dataSourcePermissions', 'accessibility', 'compatibility', 'lifecycle', 'releaseDigest']) k;
select is(pg_temp.p_ok('k:max', 'a' || repeat('b', 95), 1), 'ok', 'a 96-character block key is accepted [P2-S09-AC-104]');
select is(pg_temp.p_bad('k:' || c.n, 'VALIDATION_FAILED', c.k, 1), 'ok', 'blockKey ' || c.n || ' is refused and nothing is committed [P2-S09-AC-104]')
from (values ('with an uppercase letter', 'Hero'), ('with a leading digit', '1hero'), ('of 97 characters', 'a' || repeat('b', 96)), ('with a space', 'he ro'), ('that is empty', ''), ('with a slash', 'he/ro')) c(n, k);
select is(pg_temp.p_bad('v:' || c.n, 'VALIDATION_FAILED', 'p240vers', 1, jsonb_build_object('blockVersion', c.v)), 'ok', 'blockVersion ' || c.n || ' is refused and nothing is committed [P2-S09-AC-104]')
from (values ('zero', '0'), ('negative', '-1'), ('padded', '01'), ('fractional', '1.5'), ('textual', 'one'), ('above the safe integer range', '2147483648'), ('empty', '')) c(n, v);
select is(pg_temp.p_ok('v:big', 'p240vers', 1, '{"blockVersion":"2147483647"}'), 'ok', 'the largest 32-bit version is accepted [P2-S09-AC-104]');
select is(pg_temp.p_bad('pair:dup', 'CONFLICT', 'p240blk', 1), 'ok', 'a registered (blockKey, blockVersion) pair is never reused: the second registration is CONFLICT and nothing is committed [P2-S09-AC-104]');
select is(pg_temp.p_ok('pair:next', 'p240blk', 2), 'ok', 'the next version of the same key is a different pair and is accepted [P2-S09-AC-104]');
select is(pg_temp.p_ok('pair:other', 'p240blk2', 1), 'ok', 'the same version of another key is a different pair and is accepted [P2-S09-AC-104]');
select is(pg_temp.s09e_unique('cms_block_definition_versions', (select id from platform_private.cms_block_definition_versions where block_key = 'p240blk' and block_version = 1),
    array['block_key', 'block_version'], '{"block_version":77}'), 'dup:REJECTED:23505|ctl:ACCEPTED', 'storage enforces the unique (block_key, block_version) pair [P2-S09-AC-104]');

-- ============================================== AC105 lifecycle supported only ====
select is(pg_temp.p_bad('lc:' || l, 'VALIDATION_FAILED', 'p240life', 1, jsonb_build_object('lifecycle', l)), 'ok', 'registration with lifecycle ' || l || ' is refused: later values come only from CMS-03A-08 events [P2-S09-AC-105]')
from unnest(array['deprecated', 'withdrawn', 'registered', 'active', 'SUPPORTED', '']) l;
select is(pg_temp.p_ok('lc:ok', 'p240life', 1), 'ok', 'control: lifecycle supported is the only accepted value [P2-S09-AC-105]');
select is((select response->>'lifecycle' from (select pg_temp.s09d_resp('lc:ok') response) s), 'supported', 'the registration resource reports supported [P2-S09-AC-105]');
select is((select state from platform_private.cms_block_definition_versions where block_key = 'p240life'), 'registered',
  'the version row stores one physical state, registered; no lifecycle column exists to hold a later value [P2-S09-AC-105]');
select is((select count(*)::integer from information_schema.columns where table_schema = 'platform_private' and table_name = 'cms_block_definition_versions' and column_name like '%lifecycle%'), 0,
  'the block version table has no lifecycle column at all [P2-S09-AC-105]');

-- ============================== AC106 / AC107 props reference and hash identity ====
select is(pg_temp.p_bad('ref:' || c.n, 'VALIDATION_FAILED', 'p240ref', 1, jsonb_build_object('propsSchemaRef', c.v)), 'ok', 'propsSchemaRef ' || c.n || ' is refused and nothing is committed [P2-S09-AC-106]')
from (values ('with traversal', 'cms/blocks/../hero/1'), ('with a double slash', 'cms//blocks/hero/1'), ('as an http URL', 'https://evil.example/hero.json'), ('as a file URL', 'file:///etc/passwd'),
  ('outside the protected registry', 'cms/blocks/unregistered/1'), ('with an uppercase letter', 'CMS/blocks/hero/1'), ('that is empty', ''), ('as a data URI', 'data:text/plain,hi'),
  ('of 257 characters', 'a' || repeat('b', 256))) c(n, v);
select is(pg_temp.p_ok('ref:ok', 'p240ref', 1), 'ok', 'control: a protected registry reference is accepted [P2-S09-AC-106]');
select is(pg_temp.p_bad('hash:' || c.n, 'VALIDATION_FAILED', 'p240hash', 1, jsonb_build_object('propsSchemaHash', c.v)), 'ok', 'propsSchemaHash ' || c.n || ' is refused and nothing is committed [P2-S09-AC-107]')
from (values ('in uppercase', repeat('A', 64)), ('of 63 characters', repeat('a', 63)), ('of 65 characters', repeat('a', 65)), ('with a non-hex digit', repeat('a', 63) || 'g'), ('that is empty', '')) c(n, v);
select is(pg_temp.p_ok('hash:ok', 'p240hash', 1), 'ok', 'control: a lowercase 64-hex hash is accepted [P2-S09-AC-107]');
select ok((select b.props_schema_ref = 'cms/blocks/hero/1' and b.props_schema_hash = repeat('a', 64) from platform_private.cms_block_definition_versions b where b.block_key = 'p240hash'),
  'the identity pair is stored beside each other exactly as registered [P2-S09-AC-107]');
select set_config('app.cms_rpc', 'true', true);
select throws_ok(format('update platform_private.cms_block_definition_versions set props_schema_hash = %L where block_key = ''p240hash''', repeat('b', 64)), 'P0001', 'IMMUTABLE_RECORD',
  'the props identity cannot be replaced after registration [P2-S09-AC-107]');
select set_config('app.cms_rpc', '', true);

-- ================================== AC108 / AC109 / AC110 the props snapshot ====
select is(pg_temp.p_bad('snap:' || c.n, 'VALIDATION_FAILED', 'p240snap', 1, jsonb_build_object('propsSchemaSnapshot', c.v, 'propsSnapshotHash', platform_private.cms_jcs_sha256(c.v))), 'ok',
  'a snapshot ' || c.n || ' is refused and nothing is committed [P2-S09-AC-108]')
from (values
  ('with additionalProperties true', '{"schemaVersion":"1","fields":[],"additionalProperties":true}'::jsonb),
  ('without schemaVersion', '{"fields":[],"additionalProperties":false}'),
  ('without additionalProperties', '{"schemaVersion":"1","fields":[]}'),
  ('without fields', '{"schemaVersion":"1","additionalProperties":false}'),
  ('with an unknown top-level key', '{"schemaVersion":"1","fields":[],"additionalProperties":false,"$ref":"x"}'),
  ('with a field that has an unknown key', '{"schemaVersion":"1","fields":[{"name":"title","kind":"string","required":true,"default":"x"}],"additionalProperties":false}'),
  ('with a field without a name', '{"schemaVersion":"1","fields":[{"kind":"string","required":true}],"additionalProperties":false}'),
  ('with a field without a kind', '{"schemaVersion":"1","fields":[{"name":"title","required":true}],"additionalProperties":false}'),
  ('with a field without required', '{"schemaVersion":"1","fields":[{"name":"title","kind":"string"}],"additionalProperties":false}'),
  ('with a non-boolean required', '{"schemaVersion":"1","fields":[{"name":"title","kind":"string","required":"yes"}],"additionalProperties":false}'),
  ('with an uppercase field name', '{"schemaVersion":"1","fields":[{"name":"Title","kind":"string","required":true}],"additionalProperties":false}'),
  ('with fields as an object', '{"schemaVersion":"1","fields":{},"additionalProperties":false}'),
  ('with a 33 character schemaVersion', jsonb_build_object('schemaVersion', repeat('1', 33), 'fields', '[]'::jsonb, 'additionalProperties', false)),
  ('that is an array', '[]')) c(n, v);
select is(pg_temp.p_ok('snap:ok', 'p240snap', 1), 'ok', 'control: a strict snapshot is accepted [P2-S09-AC-108]');
select is(pg_temp.p_ok('snap:128', 'p240snap', 2, jsonb_build_object('propsSchemaSnapshot', jsonb_build_object('schemaVersion', '1', 'additionalProperties', false,
    'fields', (select jsonb_agg(jsonb_build_object('name', 'f' || lpad(g::text, 3, '0'), 'kind', 'string', 'required', false)) from generate_series(1, 128) g)),
  'propsSnapshotHash', platform_private.cms_jcs_sha256(jsonb_build_object('schemaVersion', '1', 'additionalProperties', false,
    'fields', (select jsonb_agg(jsonb_build_object('name', 'f' || lpad(g::text, 3, '0'), 'kind', 'string', 'required', false)) from generate_series(1, 128) g))))), 'ok',
  'a snapshot of exactly 128 fields is accepted [P2-S09-AC-109]');
select is(pg_temp.p_bad('snap:129', 'VALIDATION_FAILED', 'p240snap', 3, jsonb_build_object('propsSchemaSnapshot', jsonb_build_object('schemaVersion', '1', 'additionalProperties', false,
    'fields', (select jsonb_agg(jsonb_build_object('name', 'f' || lpad(g::text, 3, '0'), 'kind', 'string', 'required', false)) from generate_series(1, 129) g)),
  'propsSnapshotHash', platform_private.cms_jcs_sha256(jsonb_build_object('schemaVersion', '1', 'additionalProperties', false,
    'fields', (select jsonb_agg(jsonb_build_object('name', 'f' || lpad(g::text, 3, '0'), 'kind', 'string', 'required', false)) from generate_series(1, 129) g))))), 'ok',
  'a 129-field snapshot is refused [P2-S09-AC-109]');
select is(pg_temp.p_bad('snap:deep', 'VALIDATION_FAILED', 'p240snap', 4, jsonb_build_object('propsSchemaSnapshot', jsonb_build_object('schemaVersion', '1', 'additionalProperties', false,
    'fields', jsonb_build_array(jsonb_build_object('name', 'title', 'kind', 'string', 'required', true, 'constraints', '{"a":{"b":{"c":{"d":{"e":1}}}}}'::jsonb))),
  'propsSnapshotHash', platform_private.cms_jcs_sha256(jsonb_build_object('schemaVersion', '1', 'additionalProperties', false,
    'fields', jsonb_build_array(jsonb_build_object('name', 'title', 'kind', 'string', 'required', true, 'constraints', '{"a":{"b":{"c":{"d":{"e":1}}}}}'::jsonb)))))), 'ok',
  'nested constraints deeper than the bound are refused [P2-S09-AC-109]');
select is(pg_temp.p_bad('snap:exec', 'VALIDATION_FAILED', 'p240snap', 5, jsonb_build_object('propsSchemaSnapshot', jsonb_build_object('schemaVersion', '1', 'additionalProperties', false,
    'fields', jsonb_build_array(jsonb_build_object('name', 'title', 'kind', 'string', 'required', true, 'validate', 'function(v){return eval(v)}'))),
  'propsSnapshotHash', platform_private.cms_jcs_sha256(jsonb_build_object('schemaVersion', '1', 'additionalProperties', false,
    'fields', jsonb_build_array(jsonb_build_object('name', 'title', 'kind', 'string', 'required', true, 'validate', 'function(v){return eval(v)}')))))), 'ok',
  'an unknown runtime keyword carrying executable content is refused [P2-S09-AC-109]');
select is(pg_temp.p_bad('hash:mismatch', 'VALIDATION_FAILED', 'p240snap', 6, jsonb_build_object('propsSnapshotHash', repeat('1', 64))), 'ok',
  'a propsSnapshotHash that is not the JCS SHA-256 of the snapshot is refused [P2-S09-AC-110]');
select is(pg_temp.p_bad('hash:upper', 'VALIDATION_FAILED', 'p240snap', 7, jsonb_build_object('propsSnapshotHash', upper(platform_private.cms_jcs_sha256('{"schemaVersion":"1","fields":[{"name":"title","kind":"string","required":true,"constraints":{}}],"additionalProperties":false}'::jsonb)))), 'ok',
  'an uppercase spelling of the right hash is refused [P2-S09-AC-110]');
select is(platform_private.cms_jcs_sha256('{"b":1,"a":[2,1],"c":{"z":null,"y":"é"}}'::jsonb), platform_private.cms_jcs_sha256('{"c":{"y":"é","z":null},"a":[2,1],"b":1}'::jsonb),
  'the hash is over canonical JSON: member order does not change it [P2-S09-AC-110]');
select is(platform_private.cms_jcs_sha256('{"a":[1,2]}'::jsonb) <> platform_private.cms_jcs_sha256('{"a":[2,1]}'::jsonb), true, 'but array order does [P2-S09-AC-110]');
select is(platform_private.cms_jcs_sha256('{"a":1}'::jsonb), encode(extensions.digest(convert_to('{"a":1}', 'utf8'), 'sha256'), 'hex'), 'for a canonical object the hash is exactly the SHA-256 of its UTF-8 bytes [P2-S09-AC-110]');
select is(platform_private.cms_jcs_sha256('{"b":2,"a":1}'::jsonb), encode(extensions.digest(convert_to('{"a":1,"b":2}', 'utf8'), 'sha256'), 'hex'), 'keys are sorted before hashing as RFC 8785 requires [P2-S09-AC-110]');

-- ============================================ AC111 / AC112 the nested attestation ====
select is(pg_temp.p_ok('att:ok', 'p240att', 1), 'ok', 'control: an Ed25519 attestation by a trusted key over the locked payload is accepted [P2-S09-AC-111]');
select is(pg_temp.p_bad('att:alg', 'VALIDATION_FAILED', 'p240att', 2, '{}', jsonb_build_object('propsSnapshotAttestation', jsonb_build_object('algorithm', 'RS256', 'keyId', 'release.p240', 'signature', repeat('A', 86) || '=='))), 'ok',
  'an attestation algorithm other than Ed25519 is refused [P2-S09-AC-111]');
select is(pg_temp.p_bad('att:key', 'UNAUTHENTICATED', 'p240att', 2, '{}',
    jsonb_build_object('propsSnapshotAttestation', jsonb_build_object('algorithm', 'Ed25519', 'keyId', 'release.unknown', 'signature', repeat('A', 86) || '=='))), 'ok',
  'an attestation by a key that is not a trusted release key is refused [P2-S09-AC-111]');
select is(pg_temp.p_bad('att:b64:' || c.n, 'VALIDATION_FAILED', 'p240att', 2, '{}', jsonb_build_object('propsSnapshotAttestation', jsonb_build_object('algorithm', 'Ed25519', 'keyId', 'release.p240', 'signature', c.v))), 'ok',
  'an attestation signature ' || c.n || ' is refused [P2-S09-AC-111]')
from (values ('with a trailing character', repeat('A', 86) || '==!'), ('without padding', repeat('A', 86)), ('with url-safe characters', repeat('A', 84) || '-_=='), ('with non-zero pad bits', repeat('A', 85) || 'B=='),
  ('that is empty', '')) c(n, v);
select is(pg_temp.p_bad('att:len', 'UNAUTHENTICATED', 'p240att', 2, '{}', jsonb_build_object('propsSnapshotAttestation', jsonb_build_object('algorithm', 'Ed25519', 'keyId', 'release.p240', 'signature', repeat('A', 42) || '=='))), 'ok',
  'a canonical base64 signature that is not 64 bytes is refused [P2-S09-AC-111]');
select is(pg_temp.p_bad('att:bind:' || c.f, 'UNAUTHENTICATED', 'p240bind', 1, '{}', c.post), 'ok',
  'changing ' || c.f || ' after the attestation was signed breaks it: refused and nothing is committed [P2-S09-AC-112]')
from (values
  ('blockKey', '{"blockKey":"p240bindx"}'::jsonb),
  ('blockVersion', '{"blockVersion":"9"}'),
  ('propsSchemaRef', '{"propsSchemaRef":"cms/blocks/hero-banner/1"}'),
  ('propsSchemaHash', jsonb_build_object('propsSchemaHash', repeat('b', 64))),
  ('propsSnapshotHash with its snapshot', jsonb_build_object('propsSchemaSnapshot', '{"schemaVersion":"2","fields":[],"additionalProperties":false}'::jsonb,
    'propsSnapshotHash', platform_private.cms_jcs_sha256('{"schemaVersion":"2","fields":[],"additionalProperties":false}'::jsonb))),
  ('releaseDigest', jsonb_build_object('releaseDigest', repeat('d', 64)))) c(f, post);
select is(pg_temp.p_ok('att:bind:ok', 'p240bind', 1), 'ok', 'control: the unchanged request is accepted [P2-S09-AC-112]');

-- ======================================================== AC113 .. AC118 shapes ====
select is(pg_temp.p_ok('rd:ok', 'p240rend', 1), 'ok', 'control: a registered code-manifest renderer is accepted [P2-S09-AC-113]');
select is(pg_temp.p_bad('rd:' || c.n, 'VALIDATION_FAILED', 'p240rend', 2, jsonb_build_object('rendererRef', c.v)), 'ok', 'rendererRef ' || c.n || ' is refused and nothing is committed [P2-S09-AC-113]')
from (values ('as an http URL', 'https://evil.example/r.js'), ('as source text', 'export default () => alert(1)'), ('as an uploaded module path', 'uploads/mod.js'), ('with traversal', 'cms/renderers/../hero/1'),
  ('outside the registered manifests', 'cms/renderers/unregistered/1'), ('with a double slash', 'cms//renderers/hero/1'), ('that is empty', ''), ('of 161 characters', 'a' || repeat('b', 160))) c(n, v);
select is(pg_temp.p_ok('ch:ok', 'p240child', 1, '{"allowedChildren":["hero","hero-banner"]}'), 'ok', 'control: allowedChildren naming registered block keys is accepted [P2-S09-AC-114]');
select is(pg_temp.p_bad('ch:' || c.n, 'VALIDATION_FAILED', 'p240child', 2, jsonb_build_object('allowedChildren', c.v)), 'ok', 'allowedChildren ' || c.n || ' is refused and nothing is committed [P2-S09-AC-114]')
from (values ('with an unregistered key', '["not-a-block"]'::jsonb), ('with an uppercase key', '["Hero"]'), ('with a non-string entry', '[1]'), ('as an object', '{}'),
  ('with 33 entries', (select jsonb_agg('hero'::text) from generate_series(1, 33)))) c(n, v);
select is(pg_temp.p_ok('ch:32', 'p240child', 3, jsonb_build_object('allowedChildren', (select jsonb_agg('hero'::text) from generate_series(1, 32)))), 'ok', 'exactly 32 children is the largest accepted array [P2-S09-AC-114]');
select is(pg_temp.p_ok('sl:ok', 'p240slot', 1, '{"slotRules":{"maxDepth":16,"maxNodes":512}}'), 'ok', 'slot rules at their maxima (depth 16, nodes 512) are accepted [P2-S09-AC-114]');
select is(pg_temp.p_ok('sl:min', 'p240slot', 2, '{"slotRules":{"maxDepth":1,"maxNodes":1}}'), 'ok', 'and at their minima (1, 1) [P2-S09-AC-114]');
select is(pg_temp.p_bad('sl:' || c.n, 'VALIDATION_FAILED', 'p240slot', 3, jsonb_build_object('slotRules', c.v)), 'ok', 'slotRules ' || c.n || ' are refused and nothing is committed [P2-S09-AC-114]')
from (values ('with maxDepth 0', '{"maxDepth":0,"maxNodes":1}'::jsonb), ('with maxDepth 17', '{"maxDepth":17,"maxNodes":1}'), ('with maxNodes 0', '{"maxDepth":1,"maxNodes":0}'),
  ('with maxNodes 513', '{"maxDepth":1,"maxNodes":513}'), ('with an unknown key', '{"maxDepth":1,"maxNodes":1,"extra":1}'), ('missing maxNodes', '{"maxDepth":1}'), ('as an array', '[]')) c(n, v);
select is(pg_temp.p_ok('ds:ok', 'p240data', 1, '{"dataSourcePermissions":["cms.public_content.read","cms.editor"]}'), 'ok', 'control: allowlisted data sources are accepted [P2-S09-AC-115]');
select is(pg_temp.p_bad('ds:' || c.n, 'VALIDATION_FAILED', 'p240data', 2, jsonb_build_object('dataSourcePermissions', c.v)), 'ok', 'dataSourcePermissions ' || c.n || ' are refused and nothing is committed [P2-S09-AC-115]')
from (values ('naming an arbitrary data source', '["select * from users"]'::jsonb), ('naming an unregistered projection', '["cms.invented"]'), ('with a non-string entry', '[1]'),
  ('with 33 entries', (select jsonb_agg('cms.editor'::text) from generate_series(1, 33))), ('as an object', '{}')) c(n, v);
select is(pg_temp.p_ok('ds:32', 'p240data', 3, jsonb_build_object('dataSourcePermissions', (select jsonb_agg('cms.editor'::text) from generate_series(1, 32)))), 'ok', 'exactly 32 entries is accepted [P2-S09-AC-115]');
select is(pg_temp.p_ok('ax:ok', 'p240a11y', 1, '{"accessibility":{"nameRequired":false,"keyboard":true,"focusOrder":"managed","statusAnnouncement":false}}'), 'ok', 'control: a strict accessibility contract with managed focus is accepted [P2-S09-AC-116]');
select is(pg_temp.p_bad('ax:' || c.n, 'VALIDATION_FAILED', 'p240a11y', 2, jsonb_build_object('accessibility', c.v)), 'ok', 'accessibility ' || c.n || ' is refused and nothing is committed [P2-S09-AC-116]')
from (values ('with keyboard false', '{"nameRequired":true,"keyboard":false,"focusOrder":"document","statusAnnouncement":true}'::jsonb),
  ('with an unknown focusOrder', '{"nameRequired":true,"keyboard":true,"focusOrder":"random","statusAnnouncement":true}'),
  ('with arbitrary HTML', '{"nameRequired":true,"keyboard":true,"focusOrder":"document","statusAnnouncement":true,"html":"<b>x</b>"}'),
  ('without statusAnnouncement', '{"nameRequired":true,"keyboard":true,"focusOrder":"document"}'),
  ('with a string nameRequired', '{"nameRequired":"yes","keyboard":true,"focusOrder":"document","statusAnnouncement":true}'), ('that is null', 'null')) c(n, v);
select is(pg_temp.p_ok('cp:ok', 'p240compat', 1, '{"compatibility":{"minSchemaCompiler":"1","maxSchemaCompiler":"1.9"}}'), 'ok', 'control: registered compiler bounds are accepted [P2-S09-AC-117]');
select is(pg_temp.p_bad('cp:' || c.n, 'VALIDATION_FAILED', 'p240compat', 2, jsonb_build_object('compatibility', c.v)), 'ok', 'compatibility ' || c.n || ' is refused and nothing is committed [P2-S09-AC-117]')
from (values ('with an unregistered compiler', '{"minSchemaCompiler":"9","maxSchemaCompiler":"9"}'::jsonb), ('with a missing bound', '{"minSchemaCompiler":"1"}'),
  ('with an unknown key', '{"minSchemaCompiler":"1","maxSchemaCompiler":"1","extra":1}'), ('with a 33 character bound', jsonb_build_object('minSchemaCompiler', repeat('1', 33), 'maxSchemaCompiler', '1')),
  ('that is null', 'null')) c(n, v);
select is(pg_temp.p_bad('dg:' || c.n, 'VALIDATION_FAILED', 'p240digest', 1, jsonb_build_object('releaseDigest', c.v)), 'ok', 'releaseDigest ' || c.n || ' is refused and nothing is committed [P2-S09-AC-118]')
from (values ('in uppercase', repeat('E', 64)), ('of 63 characters', repeat('e', 63)), ('with a non-hex digit', repeat('e', 63) || 'z'), ('that is empty', '')) c(n, v);
select is(pg_temp.p_ok('dg:ok', 'p240digest', 1), 'ok', 'control: a lowercase 64-hex release digest is accepted and binds the attestation [P2-S09-AC-118]');
select is((select release_digest::text from platform_private.cms_block_definition_versions where block_key = 'p240digest'), repeat('e', 64), 'the digest is stored as the signed release manifest binding [P2-S09-AC-118]');

-- ============================ AC034 CMS-03A-05: the refusals of a caller that is not the trusted release principal ====
-- The database has one refusal for every caller that is not an active signed release principal: a human or
-- admin session, an unknown key, a revoked key and an expired key all get 401 UNAUTHENTICATED with the same
-- body and commit nothing, so the refusal never discloses which release keys exist.  (The 403 row for a human
-- is the Worker's mapping of the same refusal; the database has no per-target 404 for a registration, the
-- block pair being created by this command.)
create or replace function pg_temp.p_human_register(p_label text, p_request jsonb) returns text language plpgsql as $body$
declare before_rows text := pg_temp.p_block_rows(); outcome text;
begin
  perform pg_temp.set_jwt_claim('role', 'authenticated', true);
  perform pg_temp.s09d_call(p_label, 'platform_api.cms_register_block', p_request);
  outcome := pg_temp.s09d_outcome(p_label);
  perform pg_temp.set_jwt_claim('role', 'service_role', true);
  return case when outcome = 'UNAUTHENTICATED' and before_rows = pg_temp.p_block_rows() then 'ok' else 'bad:' || outcome end;
end;
$body$;
select is(pg_temp.p_human_register('a05:human', pg_temp.p_block_request('p240a05', 1)), 'ok',
  'a signed registration submitted from a human or admin session is refused 401 and nothing is committed [P2-S09-AC-034]');
select is(pg_temp.p_bad('a05:unknown', 'UNAUTHENTICATED', 'p240a05', 1, '{"releaseKeyId":"release.unknown","context":{"releasePrincipalId":"release.unknown"}}'), 'ok',
  'a registration under an unregistered release key is refused 401 and nothing is committed [P2-S09-AC-034]');
update platform_private.cfg_release_principals set revoked_at = clock_timestamp() where key_id = 'release.p240';
select is(pg_temp.p_bad('a05:revoked', 'UNAUTHENTICATED', 'p240a05', 1), 'ok',
  'a registration under a revoked release key is refused 401 and nothing is committed [P2-S09-AC-034]');
update platform_private.cfg_release_principals set revoked_at = null where key_id = 'release.p240';
select ok(pg_temp.s09d_resp('a05:human') is not distinct from pg_temp.s09d_resp('a05:unknown')
    and pg_temp.s09d_detail('a05:human') is not distinct from pg_temp.s09d_detail('a05:unknown')
    and pg_temp.s09d_resp('a05:unknown') is not distinct from pg_temp.s09d_resp('a05:revoked')
    and pg_temp.s09d_detail('a05:unknown') is not distinct from pg_temp.s09d_detail('a05:revoked'),
  'the human, unknown-key and revoked-key refusals carry the same body and detail: no release key existence is disclosed [P2-S09-AC-034]');
select is(pg_temp.p_ok('a05:control', 'p240a05', 1), 'ok',
  'control: after the key is reinstated the same registration commits [P2-S09-AC-034]');

select * from finish();
rollback;
