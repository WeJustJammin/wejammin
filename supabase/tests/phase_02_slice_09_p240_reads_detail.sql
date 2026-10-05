\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): the protected
-- registry detail CMS-03A-07 and the projection-only guarantee of CMS-03A-06 and 07.
-- A real owner organization holds a type with a field, a relation, a capability
-- binding, an artifact and signed blocks; a second organization holds one type; one
-- human has no CMS capability.  Every read is compared with a fingerprint of every table
-- a read must not touch.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_p240/00-a01.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc

create or replace function pg_temp.p_fp() returns text language sql as $body$
  select md5(concat_ws('|', pg_temp.s09d_fingerprint(true),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_field_definition_versions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_relation_definitions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_schema_artifacts t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_content_types t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_block_definition_versions t),
    (select count(*) from platform_private.cms_block_definition_lifecycle_events), (select count(*) from platform_private.cms_release_nonce_receipts),
    (select count(*) from platform_private.jobs), (select count(*) from platform_private.cms_capability_grants)))
$body$;
create or replace function pg_temp.p_get(p_label text, p_actor text, p_type uuid, p_version uuid, p_over jsonb default '{}'::jsonb) returns text language plpgsql as $body$
declare before_fp text := pg_temp.p_fp(); outcome text;
begin
  perform pg_temp.s09d_rpc(p_label, 'platform_api.cms_get_content_type_version', p_actor, jsonb_build_object('contentTypeId', p_type, 'versionId', p_version) || p_over);
  outcome := pg_temp.s09d_outcome(p_label);
  return case when before_fp = pg_temp.p_fp() then outcome else 'MUTATED:' || outcome end;
end;
$body$;
create or replace function pg_temp.p_keys(p_label text, p_path text[]) returns text language sql stable as $body$
  select coalesce(string_agg(k, ',' order by k), '') from jsonb_object_keys(coalesce(pg_temp.s09d_resp(p_label) #> p_path, '{}'::jsonb)) k $body$;

-- fixtures ----------------------------------------------------------------------
select pg_temp.s09d_rpc('fx:a', 'platform_api.cms_create_type_draft', 'owner', pg_temp.p_base('dt_alpha', jsonb_build_object(
  'fields', jsonb_build_array(pg_temp.p_field('title', 'short_text'), pg_temp.p_field('related', 'relation', '{"stableFieldId":"a9d10000-0000-4000-8000-0000000f0bbb"}')),
  'relations', jsonb_build_array(jsonb_build_object('fieldId', 'a9d10000-0000-4000-8000-0000000f0bbb', 'targetKind', 'domain', 'targetType', 'profile', 'projectionKey', 'profile.summary',
    'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'omit')),
  'capabilityBindings', '[{"capabilityKey":"cms.editor","capabilityVersion":"1"}]'::jsonb)));
select pg_temp.s09d_rpc('fx:z', 'platform_api.cms_create_type_draft', 'owner', pg_temp.p_base('dt_zeta'));
select pg_temp.s09d_rpc('fx:o', 'platform_api.cms_create_type_draft', 'other', pg_temp.p_base('dt_other'));
select pg_temp.s09d_remember('a:type', (pg_temp.s09d_resp('fx:a')->>'contentTypeId')::uuid);
select pg_temp.s09d_remember('a:version', (pg_temp.s09d_resp('fx:a')->>'id')::uuid);
select pg_temp.s09d_remember('z:type', (pg_temp.s09d_resp('fx:z')->>'contentTypeId')::uuid);
select pg_temp.s09d_remember('z:version', (pg_temp.s09d_resp('fx:z')->>'id')::uuid);
select pg_temp.s09d_remember('o:type', (pg_temp.s09d_resp('fx:o')->>'contentTypeId')::uuid);
select pg_temp.s09d_remember('o:version', (pg_temp.s09d_resp('fx:o')->>'id')::uuid);
select pg_temp.p_register('fx:blk', pg_temp.p_block_request('dthero', 1));
select pg_temp.p_register('fx:blk2', pg_temp.p_block_request('dthero', 2));
select pg_temp.p_advance('fx:blkd', pg_temp.p_lifecycle_request((pg_temp.s09d_resp('fx:blk2')->>'id')::uuid, 'supported', 'deprecated'));
select is(pg_temp.s09d_outcome('fx:a') || pg_temp.s09d_outcome('fx:z') || pg_temp.s09d_outcome('fx:o') || pg_temp.s09d_outcome('fx:blk') || pg_temp.s09d_outcome('fx:blk2') || pg_temp.s09d_outcome('fx:blkd'),
  'OKOKOKOKOKOK', 'fixture: three type drafts and two signed blocks (one deprecated) exist through the named RPCs');

-- ================================================ AC139 path identifiers, AC140 no query or body ====
select is(pg_temp.p_get('d:ok', 'owner', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version')), 'OK', 'control: the type and version identifiers return the detail and mutate nothing [P2-S09-AC-139]');
select is(pg_temp.p_get('d:badtype', 'owner', null, pg_temp.s09d_id('a:version'), '{"contentTypeId":"nope"}'), 'INVALID_REQUEST', 'a malformed contentTypeId is 400 INVALID_REQUEST [P2-S09-AC-139]');
select is(pg_temp.p_get('d:badver', 'owner', pg_temp.s09d_id('a:type'), null, '{"versionId":"nope"}'), 'INVALID_REQUEST', 'a malformed versionId is 400 INVALID_REQUEST [P2-S09-AC-139]');
select is(pg_temp.p_get('d:label', 'owner', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version'), '{"typeKey":"dt_alpha"}'), 'INVALID_REQUEST', 'a label (the type key) cannot stand in for an identifier: it is an unknown member [P2-S09-AC-139]');
select is(pg_temp.p_get('d:mismatch', 'owner', pg_temp.s09d_id('z:type'), pg_temp.s09d_id('a:version')), 'NOT_FOUND', 'a version that does not belong to the named type is NOT_FOUND [P2-S09-AC-139]');
select is(pg_temp.p_get('d:' || c.n, 'owner', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version'), c.o), 'INVALID_REQUEST', 'a ' || c.n || ' member is refused: the route has no ' || c.n || ' [P2-S09-AC-140]')
from (values ('query', '{"query":{"limit":1}}'::jsonb), ('limit', '{"limit":1}'), ('body', '{"body":{"x":1}}'), ('idempotency key', '{"idempotencyKey":"p240-detail-idem-0001"}'),
  ('If-Match', '{"ifMatch":"1"}'), ('expected version', '{"expectedVersion":"1"}'), ('artifact flag', '{"includeArtifact":false}')) c(n, o);
select is(pg_temp.p_get('d:ctxok', 'owner', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version'), jsonb_build_object('correlationId', extensions.gen_random_uuid())), 'OK', 'the server correlation id is the one extra member admitted beside the context [P2-S09-AC-140]');

-- ================================================ AC141 / AC142 authorization and concealment ====
select is(pg_temp.p_get('a:designer', 'owner', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version')), 'OK', 'a verified schema designer of the owning scope reads the detail [P2-S09-AC-141]');
select is(pg_temp.p_get('a:none', 'rev2', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version')), 'FORBIDDEN', 'an authenticated human with neither registry-read nor designer scope is 403 FORBIDDEN [P2-S09-AC-142]');
select is(pg_temp.p_get('a:other', 'other', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version')), 'NOT_FOUND', 'another organization''s designer gets an indistinguishable 404 for a real version [P2-S09-AC-142]');
select is(pg_temp.p_get('a:absent', 'other', pg_temp.s09d_id('a:type'), extensions.gen_random_uuid()), 'NOT_FOUND', 'and the same 404 for an absent version, so the two cannot be told apart [P2-S09-AC-142]');
select is(pg_temp.s09d_resp('a:other'), pg_temp.s09d_resp('a:absent'), 'the concealed and the absent responses are both empty [P2-S09-AC-142]');
select is(pg_temp.s09d_detail('a:other'), pg_temp.s09d_detail('a:absent'), 'and carry no differing detail [P2-S09-AC-142]');
select is(pg_temp.p_get('a:other:own', 'other', pg_temp.s09d_id('o:type'), pg_temp.s09d_id('o:version')), 'OK', 'the other organization reads its own version [P2-S09-AC-141]');
select pg_temp.s09d_rpc('a:ctx', 'platform_api.cms_get_content_type_version', 'owner', jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version')), false, jsonb_build_object('actingPartyId', pg_temp.s09d_id('otherOrg')));
select ok(pg_temp.s09d_outcome('a:ctx') = 'FORBIDDEN', 'an acting context the human is not bound to is refused: the acting context is rechecked, never widened [P2-S09-AC-141]');
select set_config('app.actor_auth_user_id', '', true), set_config('app.auth_user_id', '', true), set_config('app.actor_person_id', '', true), pg_temp.set_jwt_claim('sub', '', true);
select pg_temp.s09d_call('a:anon', 'platform_api.cms_get_content_type_version', jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version')));
select is(pg_temp.s09d_outcome('a:anon'), 'UNAUTHENTICATED', 'no verified actor is 401 UNAUTHENTICATED [P2-S09-AC-141]');
select ok(has_function_privilege('authenticated', 'platform_api.cms_get_content_type_version(jsonb)', 'execute') and not has_function_privilege('anon', 'platform_api.cms_get_content_type_version(jsonb)', 'execute'),
  'the detail RPC is executable by the authenticated role and never by anon: the RLS-bound read is the only public-facing entry [P2-S09-AC-141]');
select ok(pg_temp.s09d_rls('cms_content_type_versions') and pg_temp.s09d_no_direct_grants('cms_content_type_versions') and pg_temp.s09d_rls('cms_content_types') and pg_temp.s09d_rls('cms_schema_artifacts'),
  'the tables the detail reads have forced RLS and no direct browser privilege, so RLS and the acting context are the recheck [P2-S09-AC-141]');

-- ============================================ AC144 artifact identity, AC145 safe blocks ====
select is(pg_temp.p_get('p:detail', 'owner', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version')), 'OK', 'control: the detail is read again for the projection checks [P2-S09-AC-144]');
select ok((select a->>'resourceKind' = 'schema_artifact' and a->>'id' is not null and a->>'artifactHash' ~ '^[a-f0-9]{64}$' and a->>'zodContractRef' = 'cms/content-type/dt_alpha/v1' and a->>'compilerVersion' = '1'
      and a->>'contentTypeVersionId' = pg_temp.s09d_id('a:version')::text and a->>'state' = 'compiled'
    from (select pg_temp.s09d_resp('p:detail')->'schemaArtifact' a) s),
  'the detail always includes the capability-safe artifact identity and hash [P2-S09-AC-144]');
select is(pg_temp.p_keys('p:detail', array['schemaArtifact']), 'artifactHash,compiledAt,compilerVersion,contentTypeVersionId,createdAt,id,resourceKind,state,updatedAt,version,zodContractRef',
  'the artifact projection is exactly the identity, hash, compiler, contract reference, state and timestamps: no manifest body [P2-S09-AC-144]');
select is((select count(*)::integer from (select 1 from pg_proc p where p.proname = 'cms_get_content_type_version' and p.pronamespace = 'platform_private'::regnamespace
    and pg_get_functiondef(p.oid) ~* '(includeArtifact|omitArtifact|withArtifact)') x), 0, 'no optional artifact flag exists in the read [P2-S09-AC-144]');
select is(jsonb_array_length(pg_temp.s09d_resp('p:detail')->'blockDefinitions'), 2, 'the detail projects the two registered blocks [P2-S09-AC-145]');
select is((select string_agg(k, ',' order by k) from (select distinct jsonb_object_keys(b) k from jsonb_array_elements(pg_temp.s09d_resp('p:detail')->'blockDefinitions') b) x),
  'blockKey,blockVersion,id,lifecycle,propsSchemaHash,propsSchemaRef,releaseDigest,rendererRef,resourceKind,version', 'each block is the safe registry record: identity, lifecycle, release digest, props reference and hash, renderer [P2-S09-AC-145]');
select is((select count(*)::integer from jsonb_array_elements(pg_temp.s09d_resp('p:detail')->'blockDefinitions') b, jsonb_object_keys(b) k
    where k = any(array['propsSchemaSnapshot', 'propsSnapshotAttestation', 'propsSnapshotHash', 'releaseKeyId', 'releaseRawBodyHash', 'releaseNonceHash', 'releaseSignatureHash', 'releaseVerifiedAt',
      'releasePrincipalId', 'source', 'executableEvidence', 'ownerId', 'allowedChildren', 'slotRules', 'dataSourcePermissions', 'accessibilityContract', 'compatibilityRange'])), 0,
  'no block carries the snapshot, attestation, release keys, body or nonce hashes, verification timestamps, source or executable evidence [P2-S09-AC-145]');
select is((select string_agg(b->>'blockVersion' || ':' || (b->>'lifecycle'), ',' order by b->>'blockVersion') from jsonb_array_elements(pg_temp.s09d_resp('p:detail')->'blockDefinitions') b), '1:supported,2:deprecated', 'each block carries the lifecycle derived from its events [P2-S09-AC-145]');
select is(pg_temp.p_get('p:other', 'other', pg_temp.s09d_id('o:type'), pg_temp.s09d_id('o:version')), 'OK', 'the other organization reads its own detail [P2-S09-AC-145]');
select is(jsonb_array_length(pg_temp.s09d_resp('p:other')->'blockDefinitions'), 2, 'blocks are platform registry records, not tenant data: the same two safe records are visible to an authorized reader of any organization [P2-S09-AC-145]');

-- ============================== AC146 private payloads, AC147 / AC184 zero mutation effects ====
select is((select count(*)::integer from (select 1 where pg_temp.s09d_resp('p:detail')::text ~* '(propsSchemaSnapshot|propsSnapshotAttestation|releaseRawBodyHash|releaseNonceHash|releaseSignatureHash|releaseKeyId|\"ownerId\"|\"createdBy\"|\"actorPersonId\")') x), 0,
  'no private control-plane payload, release evidence or ownership member enters the detail [P2-S09-AC-146]');
select is((select count(*)::integer from pg_proc p where p.pronamespace = 'platform_private'::regnamespace and p.proname in ('cms_get_content_type_version', 'cms_list_content_types')
    and (case when p.prokind = 'f' then pg_get_functiondef(p.oid) end) ~* '(public_api\.|cms_publication_versions|cms_publication_schedules|cms_composition_instances)'), 0,
  'the detail and list read no public delivery table [P2-S09-AC-146]');
select is((select count(*)::integer from pg_proc p where p.pronamespace = 'platform_private'::regnamespace and p.proname in ('cms_get_content_type_version', 'cms_list_content_types')
    and (case when p.prokind = 'f' then pg_get_functiondef(p.oid) end) ~* '(^|[^a-z_])(insert[[:space:]]+into|update[[:space:]]+platform|delete[[:space:]]+from|cms_reserve|cms_emit_event|cms_record_audit|cms_complete|for[[:space:]]+update)'), 0,
  'neither projection function contains a write, an idempotency reservation, an audit or outbox call or a row lock [P2-S09-AC-184]');
select is(pg_temp.p_get('m:ok', 'owner', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version')), 'OK', 'a successful detail read changes no definition, migration, idempotency, audit, outbox, lease or job row [P2-S09-AC-147]');
select is(pg_temp.p_get('m:nf', 'owner', pg_temp.s09d_id('a:type'), extensions.gen_random_uuid()), 'NOT_FOUND', 'a NOT_FOUND read changes nothing [P2-S09-AC-147]');
select is(pg_temp.p_get('m:forbid', 'rev2', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version')), 'FORBIDDEN', 'a FORBIDDEN read changes nothing [P2-S09-AC-147]');
select is(pg_temp.p_get('m:bad', 'owner', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version'), '{"limit":1}'), 'INVALID_REQUEST', 'an INVALID_REQUEST read changes nothing [P2-S09-AC-147]');
select is(pg_temp.p_get('m:hidden', 'other', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version')), 'NOT_FOUND', 'a concealed read changes nothing [P2-S09-AC-147]');
select is(pg_temp.p_get('m:list', 'owner', null, null, '{}'), 'INVALID_REQUEST', 'the detail refuses a request with no identifiers and changes nothing [P2-S09-AC-184]');
create or replace function pg_temp.p_list_fp(p_label text, p_req jsonb) returns text language plpgsql as $body$
declare before_fp text := pg_temp.p_fp(); outcome text;
begin
  perform pg_temp.s09d_rpc(p_label, 'platform_api.cms_list_content_types', 'owner', p_req);
  outcome := pg_temp.s09d_outcome(p_label);
  return case when before_fp = pg_temp.p_fp() then outcome else 'MUTATED:' || outcome end;
end;
$body$;
select is(pg_temp.p_list_fp('ml:ok', '{"limit":100}'), 'OK', 'a successful list changes no definition, migration, idempotency, audit, outbox, lease or job row [P2-S09-AC-184]');
select is(pg_temp.p_list_fp('ml:bad', '{"limit":0}'), 'VALIDATION_FAILED', 'a failed list changes nothing either [P2-S09-AC-184]');
select ok((select p.provolatile = 'v' and p.prosecdef from pg_proc p where p.oid = 'platform_private.cms_get_content_type_version(jsonb)'::regprocedure),
  'the projection RPCs are VOLATILE SECURITY DEFINER, so their read-only behavior is the property proved above, not a planner promise [P2-S09-AC-184]');

-- ================================================== AC199 A07 failure mapping ====
select is(pg_temp.p_get('f:uuid', 'owner', null, pg_temp.s09d_id('a:version'), '{"contentTypeId":"nope"}'), 'INVALID_REQUEST', 'a malformed UUID is 400 INVALID_REQUEST [P2-S09-AC-199]');
select is(pg_temp.p_get('f:header', 'owner', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version'), '{"ifMatch":"1"}'), 'INVALID_REQUEST', 'a mutation header is 400 INVALID_REQUEST [P2-S09-AC-199]');
select set_config('app.actor_auth_user_id', '', true), set_config('app.auth_user_id', '', true), set_config('app.actor_person_id', '', true), pg_temp.set_jwt_claim('sub', '', true);
select pg_temp.s09d_call('f:anon', 'platform_api.cms_get_content_type_version', jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version')));
select is(pg_temp.s09d_outcome('f:anon'), 'UNAUTHENTICATED', 'no verified actor is 401 UNAUTHENTICATED [P2-S09-AC-199]');
select is(pg_temp.p_get('f:forbid', 'rev2', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version')), 'FORBIDDEN', 'a missing capability is 403 FORBIDDEN [P2-S09-AC-199]');
select is(pg_temp.p_get('f:nf', 'owner', pg_temp.s09d_id('a:type'), extensions.gen_random_uuid()), 'NOT_FOUND', 'an absent version is 404 NOT_FOUND [P2-S09-AC-199]');
select is(pg_temp.p_get('f:ok', 'owner', pg_temp.s09d_id('a:type'), pg_temp.s09d_id('a:version')), 'OK', 'control: the read succeeds after every failure [P2-S09-AC-199]');

select * from finish();
rollback;
