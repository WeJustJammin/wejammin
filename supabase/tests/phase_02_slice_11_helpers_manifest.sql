-- Slice 11 shared helpers: platform_private.cms_build_dependency_manifest and its
-- companions (BE03b "Frozen dependency manifest build and version set (E1, E7)";
-- tracker P2-S11-AC-087, AC-088, AC-089, AC-090).  RED before 20261005017560,
-- GREEN after.
--
-- The manifest is the ONLY builder of a DependencyManifest: nine groups, every
-- list sorted ascending by the lowercase UUID string (bytewise) with each identity
-- once, at most 256 entries and 32 KiB.  The expected values below are assembled in
-- this file from the stored rows and literal JCS text, never through the builder.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(87);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc

create or replace function pg_temp.h11m_build(p_tag text)
returns jsonb
language sql
as $body$
  select pg_temp.h11_json(format('select platform_private.cms_build_dependency_manifest(%L::uuid)',
    pg_temp.h11w_uuid(p_tag || ':revision')))
$body$;

create or replace function pg_temp.h11m_err(p_tag text)
returns text
language sql
as $body$
  select pg_temp.h11_outcome(format('select platform_private.cms_build_dependency_manifest(%L::uuid)',
    pg_temp.h11w_uuid(p_tag || ':revision')))
$body$;

\ir phase_02_slice_11_helpers/003-registry.sqlinc

insert into platform_private.cms_taxonomy_versions(
  id, owner_id, version, taxonomy_key, owner_capability, shape,
  allowlisted_type_keys, allowlisted_field_keys, content_hash, created_by
) values (pg_temp.h11w_uuid('tax1'), pg_temp.h11w_org(), 1, 'h11-genres', 'cms.taxonomy_curator',
  'flat', '[]'::jsonb, '[]'::jsonb, repeat('a', 64), (select value::uuid from s10_ids where key = 'creatorAuth'));
select pg_temp.h11_raw_insert('platform_private.cms_terms', jsonb_build_object(
  'id', t.id, 'owner_id', pg_temp.h11w_org(), 'lifecycle', 'active', 'version', t.version,
  'taxonomy_version_id', pg_temp.h11w_uuid('tax1'), 'term_key', t.term_key, 'aliases', '[]'::jsonb,
  'created_by', (select value::uuid from s10_ids where key = 'creatorAuth'),
  'created_at', timestamptz '2026-10-08T12:00:00Z', 'updated_at', timestamptz '2026-10-08T12:00:00Z'))
from (values
  ('a9200000-0000-4000-8000-0000000e0002'::uuid, 3, 'rock'),
  ('a9200000-0000-4000-8000-0000000e0001'::uuid, 1, 'jazz'),
  ('a9200000-0000-4000-8000-0000000e0003'::uuid, 1, 'blues')
) t(id, version, term_key);

-- ---------------------------------------------------------------------------
-- Shape and privileges.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.h11_private_definer('cms_build_dependency_manifest(uuid)')
    and pg_temp.h11_private_definer('cms_manifest_identities_current(jsonb)')
    and pg_temp.h11_private_definer('cms_frozen_dependencies_status(uuid, jsonb)')
    and pg_temp.h11_private_definer('cms_revision_version_set(uuid, jsonb)')
    and pg_temp.h11_private_definer('cms_dependency_manifest_within_bounds(jsonb)')
    and pg_temp.h11_private_definer('cms_review_dependency_refs(uuid, jsonb)'),
  'the manifest helpers are private SECURITY DEFINER functions of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-087]'
);
select ok(
  pg_temp.h11_volatility('cms_build_dependency_manifest(uuid)') = 'v'
    and pg_temp.h11_volatility('cms_frozen_dependencies_status(uuid, jsonb)') = 'v'
    and pg_temp.h11_volatility('cms_manifest_identities_current(jsonb)') = 'v'
    and pg_temp.h11_volatility('cms_dependency_manifest_within_bounds(jsonb)') = 's'
    and pg_temp.h11_volatility('cms_revision_version_set(uuid, jsonb)') = 's'
    and pg_temp.h11_volatility('cms_review_dependency_refs(uuid, jsonb)') = 's',
  'builder, status and currency retain VOLATILE; bounds and the version set are STABLE [P2-S11-AC-087]'
);
select is(pg_temp.h11_rettype('cms_build_dependency_manifest(uuid)'), 'jsonb', 'the builder returns jsonb [P2-S11-AC-087]');
select is(pg_temp.h11_rettype('cms_frozen_dependencies_status(uuid, jsonb)'), 'text', 'the status returns text [P2-S11-AC-090]');
select is(pg_temp.h11_rettype('cms_review_dependency_refs(uuid, jsonb)'), 'TABLE(kind text, ref_id uuid)',
  'the dependency-row projection returns (kind, ref_id) [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- A clean revision: every group, against an independently assembled oracle.
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('clean');

create or replace function pg_temp.h11m_oracle_schema()
returns jsonb
language sql
as $body$
  select jsonb_build_object(
    'id', version.id,
    'hash', version.definition_hash,
    'schemaArtifact', jsonb_build_object(
      'id', artifact.id, 'contentTypeVersionId', version.id,
      'artifactHash', artifact.artifact_hash, 'compilerVersion', artifact.compiler_version,
      'zodContractRef', artifact.zod_contract_ref),
    'validatorRefs', jsonb_build_array(jsonb_build_object('key', 'rich_text.v1', 'version', '1')),
    'workflowPolicy', jsonb_build_object(
      'key', 'editorial', 'version', '1', 'policyHash', member.policy_hash,
      'riskClass', member.risk_class, 'requiredDecisionCount', member.required_decision_count,
      'requiredCapabilities', member.required_capabilities,
      'approvalEvidenceHash', pg_temp.h11_sha256(
        '{"activationApprovalEvidenceHash":"' || repeat('b', 64) || '","policyHash":"' || member.policy_hash
        || '","schemaVersionId":"' || version.id::text || '"}')),
    'activationEvidence', jsonb_build_object(
      'key', 'editorial', 'version', '1', 'policyHash', member.policy_hash,
      'riskClass', member.risk_class, 'requiredDecisionCount', member.required_decision_count,
      'requiredCapabilities', member.required_capabilities,
      'approvalEvidenceHash', repeat('b', 64)))
  from platform_private.cms_content_type_versions version
  join platform_private.cms_schema_artifacts artifact on artifact.id = version.schema_artifact_id
  join platform_private.cms_workflow_policies member
    on member.policy_key = 'editorial' and member.policy_version = 1
  where version.id = pg_temp.h11w_version()
$body$;

select is(pg_temp.h11m_build('clean')->'schema', pg_temp.h11m_oracle_schema(),
  'schema group: version id/definition hash, the compiled artifact, the frozen rich_text.v1 validator, the real workflow policy and the activation evidence [P2-S11-AC-088]');
select is(pg_temp.h11m_build('clean') - 'schema',
  jsonb_build_object(
    'template', null, 'blocks', '[]'::jsonb, 'patterns', '[]'::jsonb, 'terms', '[]'::jsonb,
    'localeSources', '[]'::jsonb,
    'settings', jsonb_build_object('version', '1', 'hash', '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'),
    'relations', '[]'::jsonb,
    'checker', jsonb_build_object('key', 'cms.a11y.structural', 'version', '1')),
  'the other eight groups of a clean revision: null template, empty lists, the empty-snapshot settings and the registry checker [P2-S11-AC-088]');
select is(
  (select array_agg(key order by key) from jsonb_object_keys(pg_temp.h11m_build('clean')) key),
  array['blocks','checker','localeSources','patterns','relations','schema','settings','template','terms'],
  'the manifest has exactly the nine contract groups [P2-S11-AC-087]');

select is(pg_temp.h11m_build('clean'), pg_temp.h11m_build('clean'),
  'the builder is deterministic: two builds of one revision are identical [P2-S11-AC-089]');
select is(
  platform_private.cms_jcs_sha256(pg_temp.h11m_build('clean')),
  platform_private.cms_jcs_sha256(pg_temp.h11m_build('clean')),
  'dependencyHash (the JCS SHA-256 of the manifest) is stable [P2-S11-AC-089]');
select is(
  (select count(*)::integer from platform_private.cms_publication_settings_snapshots),
  1, 'building reuses the save-initialized owner snapshot (ordinal 1), preserving the single-row count [P2-S11-AC-092]');

-- ---------------------------------------------------------------------------
-- Argument discipline and unavailable evidence.
-- ---------------------------------------------------------------------------
select is(pg_temp.h11_outcome('select platform_private.cms_build_dependency_manifest(null)'), 'P0001:INVALID_REQUEST',
  'a null revision id is a malformed helper call [P2-S11-AC-087]');
select is(pg_temp.h11_outcome(format('select platform_private.cms_build_dependency_manifest(%L::uuid)',
    'a9200000-0000-4000-8000-0000000000ee')), 'P0001:NOT_FOUND',
  'an absent revision is NOT_FOUND [P2-S11-AC-087]');
select is(
  pg_temp.h11_outcome(format('select platform_private.cms_build_dependency_manifest(%L::uuid)',
    'a9100000-0000-4000-8000-000000000302')),
  'P0001:DEPENDENCY_UNAVAILABLE',
  'a revision whose schema carries no resolvable workflow-policy evidence (the Slice 10 article fixture) is DEPENDENCY_UNAVAILABLE, never a partial manifest [P2-S11-AC-087]');

-- ---------------------------------------------------------------------------
-- template
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('tpl', 'creatorPerson', 'en-US', '[]'::jsonb, null, 1,
  'a9200000-0000-4000-8000-0000000d0001'::uuid);
select is(pg_temp.h11m_build('tpl')->'template',
  jsonb_build_object('id', 'a9200000-0000-4000-8000-0000000d0001', 'hash', repeat('9', 64)),
  'template group: { id, hash } with the TemplateVersion content_hash [P2-S11-AC-088]');
select is(pg_temp.h11m_build('clean')->'template', 'null'::jsonb,
  'a revision without a template has a JSON null template [P2-S11-AC-088]');
select is(pg_temp.h11m_build('tpl')->'blocks',
  jsonb_build_array(
    jsonb_build_object('id', 'a9200000-0000-4000-8000-0000000b0001', 'hash', repeat('a', 64)),
    jsonb_build_object('id', 'a9200000-0000-4000-8000-0000000b0004', 'hash', repeat('d', 64))),
  'blocks reachable from the template slots are listed even with no composition instance (sorted by id) [P2-S11-AC-088]');

-- ---------------------------------------------------------------------------
-- blocks and patterns from composition instances
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('comp');
select pg_temp.h11m_instance('comp:i1', pg_temp.h11w_uuid('comp:revision'), '/a', 'h11.third');
select pg_temp.h11m_instance('comp:i2', pg_temp.h11w_uuid('comp:revision'), '/b', 'h11.first', 'a9200000-0000-4000-8000-0000000c0002');
select pg_temp.h11m_instance('comp:i3', pg_temp.h11w_uuid('comp:revision'), '/c', 'h11.second', 'a9200000-0000-4000-8000-0000000c0001');
select pg_temp.h11m_instance('comp:i4', pg_temp.h11w_uuid('comp:revision'), '/d', 'h11.first', 'a9200000-0000-4000-8000-0000000c0002', 'active');
select pg_temp.h11m_instance('comp:i5', pg_temp.h11w_uuid('comp:revision'), '/e', 'h11.slotonly', null, 'retired');
select is(pg_temp.h11m_build('comp')->'blocks',
  jsonb_build_array(
    jsonb_build_object('id', 'a9200000-0000-4000-8000-0000000b0001', 'hash', repeat('a', 64)),
    jsonb_build_object('id', 'a9200000-0000-4000-8000-0000000b0002', 'hash', repeat('b', 64)),
    jsonb_build_object('id', 'a9200000-0000-4000-8000-0000000b0003', 'hash', repeat('c', 64))),
  'blocks: each identity once, ascending by id, hash = the registry release_digest, a retired instance contributes nothing [P2-S11-AC-088]');
select is(pg_temp.h11m_build('comp')->'patterns',
  jsonb_build_array(
    jsonb_build_object('id', 'a9200000-0000-4000-8000-0000000c0001', 'hash', repeat('f', 64)),
    jsonb_build_object('id', 'a9200000-0000-4000-8000-0000000c0002', 'hash', repeat('e', 64))),
  'patterns: each PatternVersion once, ascending by id, hash = content_hash [P2-S11-AC-088]');

select pg_temp.h11w_revision('ghost');
select pg_temp.h11m_instance('ghost:i1', pg_temp.h11w_uuid('ghost:revision'), '/a', 'h11.unregistered');
select is(pg_temp.h11m_err('ghost'), 'P0001:DEPENDENCY_UNAVAILABLE',
  'an instance of a block with no registry record cannot be frozen (DEPENDENCY_UNAVAILABLE) [P2-S11-AC-088]');


-- ---------------------------------------------------------------------------
-- terms (distinct terms of the ACTIVE assignments; hash = JCS of the term row)
-- ---------------------------------------------------------------------------
create or replace function pg_temp.h11m_assign(
  p_tag text, p_revision uuid, p_term uuid, p_state text, p_position integer, p_version bigint default 1
)
returns void
language plpgsql
as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_term_assignments(
    id, owner_id, state, version, revision_id, field_definition_id,
    term_id, taxonomy_version_id, position, provenance, created_by
  ) values (
    pg_temp.h11w_uuid(p_tag), pg_temp.h11w_org(), p_state, p_version, p_revision, pg_temp.h11w_fdef('tags'),
    p_term, pg_temp.h11w_uuid('tax1'), p_position, 'authored',
    (select value::uuid from s10_ids where key = 'creatorAuth'));
end;
$body$;

select pg_temp.h11w_revision('terms');
select pg_temp.h11m_assign('terms:a1', pg_temp.h11w_uuid('terms:revision'), 'a9200000-0000-4000-8000-0000000e0002', 'active', 0);
select pg_temp.h11m_assign('terms:a2', pg_temp.h11w_uuid('terms:revision'), 'a9200000-0000-4000-8000-0000000e0001', 'active', 1);
select pg_temp.h11m_assign('terms:a3', pg_temp.h11w_uuid('terms:revision'), 'a9200000-0000-4000-8000-0000000e0001', 'active', 2, 2);
select pg_temp.h11m_assign('terms:a4', pg_temp.h11w_uuid('terms:revision'), 'a9200000-0000-4000-8000-0000000e0003', 'superseded', 3);
select is(pg_temp.h11m_build('terms')->'terms',
  jsonb_build_array(
    jsonb_build_object('id', 'a9200000-0000-4000-8000-0000000e0001', 'hash', pg_temp.h11_sha256(
      '{"id":"a9200000-0000-4000-8000-0000000e0001","lifecycle":"active","successorId":null,"termKey":"jazz","version":"1"}')),
    jsonb_build_object('id', 'a9200000-0000-4000-8000-0000000e0002', 'hash', pg_temp.h11_sha256(
      '{"id":"a9200000-0000-4000-8000-0000000e0002","lifecycle":"active","successorId":null,"termKey":"rock","version":"3"}'))),
  'terms: distinct terms of the active assignments, ascending by id, hash = SHA-256 of the JCS { id, termKey, lifecycle, version, successorId } of the term row [P2-S11-AC-088]');

-- ---------------------------------------------------------------------------
-- localeSources
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('locsrc');
select pg_temp.h11w_revision('locvar', 'creatorPerson', 'fr-FR', '[]'::jsonb, 'locsrc', 2);
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_locale_variants(
  id, owner_id, state, version, entry_id, revision_id, source_revision_id,
  locale, source_locale, source_hash, created_by
) values (
  pg_temp.h11w_uuid('variant'), pg_temp.h11w_org(), 'draft', 1,
  pg_temp.h11w_uuid('locsrc:entry'), pg_temp.h11w_uuid('locvar:revision'),
  pg_temp.h11w_uuid('locsrc:revision'), 'fr-FR', 'en-US',
  (select payload_hash from platform_private.cms_entry_revisions where id = pg_temp.h11w_uuid('locsrc:revision')),
  (select value::uuid from s10_ids where key = 'creatorAuth'));
select is(pg_temp.h11m_build('locvar')->'localeSources',
  jsonb_build_array(jsonb_build_object(
    'locale', 'en-US', 'revisionId', pg_temp.h11w_uuid('locsrc:revision'),
    'hash', (select payload_hash from platform_private.cms_entry_revisions where id = pg_temp.h11w_uuid('locsrc:revision')))),
  'localeSources: the recorded source locale, source revision and sourceHash of the revision''s LocaleVariant [P2-S11-AC-088]');
select is(pg_temp.h11m_build('locsrc')->'localeSources', '[]'::jsonb,
  'a source-locale revision has no localeSources entry [P2-S11-AC-088]');

-- ---------------------------------------------------------------------------
-- relations (pinned version else current; omit/placeholder drop an unavailable target)
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('tgt-arch');
update platform_private.cms_content_entries
   set lifecycle = 'archived', version = version + 1
 where id = pg_temp.h11w_uuid('tgt-arch:entry');
select pg_temp.h11w_revision('rel');
select pg_temp.h11w_relation(pg_temp.h11w_uuid('rel:revision'), 'rel_omit', 'a9100000-0000-4000-8000-000000000301'::uuid, 5, 0, 'omit');
select pg_temp.h11w_relation(pg_temp.h11w_uuid('rel:revision'), 'rel_omit', pg_temp.h11w_uuid('tgt-arch:entry'), 2, 1, 'omit');
select pg_temp.h11w_relation(pg_temp.h11w_uuid('rel:revision'), 'rel_block', pg_temp.h11w_uuid('tgt-arch:entry'), 2, 0, 'block');
select pg_temp.h11w_relation(pg_temp.h11w_uuid('rel:revision'), 'rel_placeholder', pg_temp.h11w_uuid('tgt-arch:entry'), null, 0, 'placeholder');
select pg_temp.h11w_relation(pg_temp.h11w_uuid('rel:revision'), 'rel_placeholder', 'a9100000-0000-4000-8000-000000000301'::uuid, null, 1, 'placeholder');
select is(pg_temp.h11m_build('rel')->'relations',
  jsonb_build_array(
    jsonb_build_object('fieldId', 'a9200000-0000-4000-8000-000000000c37',
      'targetId', 'a9100000-0000-4000-8000-000000000301', 'targetVersion', '5'),
    jsonb_build_object('fieldId', 'a9200000-0000-4000-8000-000000000c38',
      'targetId', pg_temp.h11w_uuid('tgt-arch:entry'), 'targetVersion', '2'),
    jsonb_build_object('fieldId', 'a9200000-0000-4000-8000-000000000c39',
      'targetId', 'a9100000-0000-4000-8000-000000000301', 'targetVersion', '1')),
  'relations: a pinned version wins over the current one, an unpinned target shows its current version, an unavailable omit/placeholder target is not listed while an unavailable block target is [P2-S11-AC-088]');

-- ---------------------------------------------------------------------------
-- bounds (256 entries in total, 32 KiB serialized)
-- ---------------------------------------------------------------------------
create or replace function pg_temp.h11m_filler(p_n integer, p_kind text)
returns jsonb
language sql
as $body$
  select coalesce(jsonb_agg(case p_kind
    when 'block' then jsonb_build_object('id', ('a9200000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid, 'hash', repeat('a', 64))
    else jsonb_build_object('fieldId', 'a9200000-0000-4000-8000-000000000c37',
      'targetId', ('a9200000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid, 'targetVersion', '1') end), '[]'::jsonb)
  from generate_series(1, p_n) n
$body$;

create or replace function pg_temp.h11m_bounds(p_blocks integer, p_relations integer)
returns text
language sql
as $body$
  select pg_temp.h11_text(format('select platform_private.cms_dependency_manifest_within_bounds(%L::jsonb)',
    (pg_temp.h11m_build('clean')
       || jsonb_build_object('blocks', pg_temp.h11m_filler(p_blocks, 'block'),
                             'relations', pg_temp.h11m_filler(p_relations, 'relation')))::text))
$body$;

select is(pg_temp.h11m_bounds(0, 0), 'true', 'the clean manifest is within bounds (4 entries) [P2-S11-AC-087]');
select is(pg_temp.h11m_bounds(128, 124), 'true', '128 blocks + 124 relations + 4 = exactly 256 entries is within bounds [P2-S11-AC-087]');
select is(pg_temp.h11m_bounds(128, 125), 'false', '257 entries is over the bound [P2-S11-AC-087]');
select is(pg_temp.h11m_bounds(129, 0), 'false', 'the 128-entry cap of one group holds even under 256 entries in total [P2-S11-AC-087]');
select is(pg_temp.h11m_bounds(0, 129), 'false', 'the 128 relation cap holds [P2-S11-AC-087]');

-- Pad schema.pad so the JCS text has exactly p_total_bytes UTF-8 bytes.
create or replace function pg_temp.h11m_padded(p_total_bytes integer)
returns text
language plpgsql
as $body$
declare
  base jsonb := pg_temp.h11m_build('clean');
  skeleton jsonb;
  pad_length integer;
begin
  skeleton := base || jsonb_build_object('schema', (base->'schema') || jsonb_build_object('pad', ''));
  pad_length := p_total_bytes - octet_length(convert_to(platform_private.cms_jcs(skeleton), 'utf8'));
  return pg_temp.h11_text(format('select platform_private.cms_dependency_manifest_within_bounds(%L::jsonb)',
    (base || jsonb_build_object('schema', (base->'schema') || jsonb_build_object('pad', repeat('x', pad_length))))::text));
end;
$body$;
select is(pg_temp.h11m_padded(32768), 'true', 'a manifest of exactly 32768 UTF-8 bytes is within bounds [P2-S11-AC-087]');
select is(pg_temp.h11m_padded(32769), 'false', 'a manifest of 32769 bytes is over the bound [P2-S11-AC-087]');
select is(pg_temp.h11_text('select platform_private.cms_dependency_manifest_within_bounds(''[]''::jsonb)'), 'false',
  'a non-object is not a manifest within bounds [P2-S11-AC-087]');
select is(pg_temp.h11_text('select platform_private.cms_dependency_manifest_within_bounds(null)'), 'false',
  'null is not within bounds [P2-S11-AC-087]');

-- builder integration: more than 256 entries refuses the whole manifest.
select pg_temp.h11_raw_exec('platform_private.cms_block_definition_versions', format(
  'insert into platform_private.cms_block_definition_versions(id, owner_id, block_key, block_version, props_schema_ref, props_schema_hash, props_schema_snapshot, props_snapshot_hash, props_snapshot_attestation, props_attestation_key_id, props_attestation_signature_hash, props_attestation_verified_at, renderer_ref, allowed_children, slot_rules, data_source_permissions, accessibility_contract, compatibility_range, release_digest, release_principal_id, release_key_id, release_raw_body_hash, release_signature_hash, release_nonce_hash, release_verified_at) select (''a9220000-0000-4000-8000-'' || lpad(to_hex(n), 12, ''0''))::uuid, %L::uuid, ''h11.bulk'' || n, 1, ''cms/h11/bulk'', repeat(''2'', 64), ''{}''::jsonb, repeat(''4'', 64), ''{}''::jsonb, ''h11-test-key'', repeat(''5'', 64), clock_timestamp(), ''cms.h11.bulk'', ''[]''::jsonb, ''{}''::jsonb, ''[]''::jsonb, ''{}''::jsonb, ''{}''::jsonb, repeat(''3'', 64), %L::uuid, ''h11-release-key'', repeat(''6'', 64), repeat(''7'', 64), repeat(''8'', 64), clock_timestamp() from generate_series(1, 128) n',
  pg_temp.h11w_org(), pg_temp.h11w_uuid('principal')));
select pg_temp.h11w_revision('big');
select pg_temp.h11_raw_exec('platform_private.cms_composition_instances', format(
  'insert into platform_private.cms_composition_instances(id, owner_id, state, version, revision_id, path, slot_key, block_key, block_version, block_registry_digest, link_mode, created_by) select (''a9210000-0000-4000-8000-'' || lpad(to_hex(n), 12, ''0''))::uuid, %L::uuid, ''draft'', 1, %L::uuid, ''/p'' || n, ''primary'', ''h11.bulk'' || n, 1, repeat(''a'', 64), ''detached'', %L::uuid from generate_series(1, 128) n',
  pg_temp.h11w_org(), pg_temp.h11w_uuid('big:revision'), (select value::uuid from s10_ids where key = 'creatorAuth')));
select is(pg_temp.h11m_build('big') is not null, true, 'control: 128 reachable blocks (4 + 128 = 132 entries, at the group cap) still build [P2-S11-AC-087]');
select pg_temp.h11w_revision('big2');
select pg_temp.h11_raw_exec('platform_private.cms_composition_instances', format(
  'insert into platform_private.cms_composition_instances(id, owner_id, state, version, revision_id, path, slot_key, block_key, block_version, block_registry_digest, link_mode, created_by) select (''a9230000-0000-4000-8000-'' || lpad(to_hex(n), 12, ''0''))::uuid, %L::uuid, ''draft'', 1, %L::uuid, ''/p'' || n, ''primary'', ''h11.bulk'' || n, 1, repeat(''a'', 64), ''detached'', %L::uuid from generate_series(1, 128) n',
  pg_temp.h11w_org(), pg_temp.h11w_uuid('big2:revision'), (select value::uuid from s10_ids where key = 'creatorAuth')));
select pg_temp.h11_raw_exec('platform_private.cms_entry_relations', format(
  'insert into platform_private.cms_entry_relations(owner_id, state, version, revision_id, field_id, field_definition_id, target_kind, target_id, expected_target_version, position, on_unavailable, created_at, updated_at) select %L::uuid, ''active'', 1, %L::uuid, %L::uuid, %L::uuid, ''content'', (''a9240000-0000-4000-8000-'' || lpad(to_hex(n), 12, ''0''))::uuid, 1, n, ''block'', timestamptz ''2026-10-08T12:00:00Z'', timestamptz ''2026-10-08T12:00:00Z'' from generate_series(1, 128) n',
  pg_temp.h11w_org(), pg_temp.h11w_uuid('big2:revision'), pg_temp.h11w_fid('rel_block'), pg_temp.h11w_fdef('rel_block')));
select is(pg_temp.h11m_err('big2'), 'P0001:dependency_manifest_too_large',
  '128 blocks + 128 relations + the singletons exceed 256 entries: dependency_manifest_too_large, no manifest [P2-S11-AC-087]');

-- ---------------------------------------------------------------------------
-- version set of a built manifest
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('vs', 'creatorPerson', 'en-US',
  jsonb_build_array('a9200000-0000-4000-8000-000000000f20'::uuid, 'a9200000-0000-4000-8000-000000000f10'::uuid));
select is(
  pg_temp.h11_json(format('select platform_private.cms_revision_version_set(%L::uuid, %L::jsonb)',
    pg_temp.h11w_uuid('vs:revision'), pg_temp.h11m_build('vs')::text)) -> 'taxonomyVersionIds',
  '["a9200000-0000-4000-8000-000000000f10","a9200000-0000-4000-8000-000000000f20"]'::jsonb,
  'the revision version set carries the revision''s taxonomy ids sorted bytewise [P2-S11-AC-089]');
select is(
  pg_temp.h11_json(format('select platform_private.cms_revision_version_set(%L::uuid, %L::jsonb)',
    pg_temp.h11w_uuid('vs:revision'), pg_temp.h11m_build('vs')::text)),
  pg_temp.h11_json(format('select platform_private.cms_version_set_of(%L::jsonb, %L::jsonb)', pg_temp.h11m_build('vs')::text,
    '["a9200000-0000-4000-8000-000000000f10","a9200000-0000-4000-8000-000000000f20"]')),
  'cms_revision_version_set is cms_version_set_of(manifest, the revision''s taxonomy ids) [P2-S11-AC-089]');
select is(
  pg_temp.h11_text(format('select platform_private.cms_version_set_matches_manifest(%L::jsonb, %L::jsonb)',
    pg_temp.h11_json(format('select platform_private.cms_revision_version_set(%L::uuid, %L::jsonb)',
      pg_temp.h11w_uuid('vs:revision'), pg_temp.h11m_build('vs')::text))::text,
    pg_temp.h11m_build('vs')::text)),
  'true', 'the built version set matches the built manifest [P2-S11-AC-089]');
select is(pg_temp.h11_outcome(format('select platform_private.cms_revision_version_set(%L::uuid, %L::jsonb)',
    'a9200000-0000-4000-8000-0000000000ee', pg_temp.h11m_build('vs')::text)), 'P0001:NOT_FOUND',
  'the version set of an absent revision is NOT_FOUND [P2-S11-AC-089]');

-- ---------------------------------------------------------------------------
-- currency of the frozen identities (cms_manifest_identities_current)
-- ---------------------------------------------------------------------------
create or replace function pg_temp.h11m_current(p_manifest jsonb)
returns text
language sql
as $body$
  select pg_temp.h11_text(format('select platform_private.cms_manifest_identities_current(%L::jsonb)', p_manifest::text))
$body$;

select pg_temp.h11w_revision('cur', 'creatorPerson', 'en-US', '[]'::jsonb, null, 1, 'a9200000-0000-4000-8000-0000000d0001'::uuid);
select pg_temp.h11m_instance('cur:i1', pg_temp.h11w_uuid('cur:revision'), '/a', 'h11.second', 'a9200000-0000-4000-8000-0000000c0001');
select pg_temp.h11m_instance('cur:i2', pg_temp.h11w_uuid('cur:revision'), '/b', 'h11.third');
create temp table h11m_cur on commit drop as select pg_temp.h11m_build('cur') as manifest;
select is(pg_temp.h11m_current((select manifest from h11m_cur)), 'true',
  'a freshly built manifest of a revision with template, blocks and patterns is current [P2-S11-AC-090]');
select is(pg_temp.h11m_current((select jsonb_set(manifest, '{settings,version}', '"2"') from h11m_cur)), 'false',
  'a moved settings ordinal is not current [P2-S11-AC-090]');
select is(pg_temp.h11m_current((select jsonb_set(manifest, '{settings,hash}', to_jsonb(repeat('0', 64))) from h11m_cur)), 'false',
  'a different settings hash is not current [P2-S11-AC-090]');
select is(pg_temp.h11m_current((select jsonb_set(manifest, '{schema,hash}', to_jsonb(repeat('0', 64))) from h11m_cur)), 'false',
  'a schema version whose definition hash differs is not current [P2-S11-AC-090]');
select is(pg_temp.h11m_current((select jsonb_set(manifest, '{schema,schemaArtifact,artifactHash}', to_jsonb(repeat('0', 64))) from h11m_cur)), 'false',
  'a schema artifact whose hash differs is not current [P2-S11-AC-090]');
select is(pg_temp.h11m_current((select jsonb_set(manifest, '{template,hash}', to_jsonb(repeat('0', 64))) from h11m_cur)), 'false',
  'a template whose digest differs is not current [P2-S11-AC-090]');
select is(pg_temp.h11m_current((select jsonb_set(manifest, '{patterns,0,hash}', to_jsonb(repeat('0', 64))) from h11m_cur)), 'false',
  'a pattern whose content hash differs is not current [P2-S11-AC-090]');
select is(pg_temp.h11m_current((select jsonb_set(manifest, '{blocks,0,hash}', to_jsonb(repeat('0', 64))) from h11m_cur)), 'false',
  'a block whose release digest differs is not current [P2-S11-AC-090]');
select is(pg_temp.h11m_current((select jsonb_set(manifest, '{blocks,0,id}', to_jsonb('a9200000-0000-4000-8000-0000000000ee'::text)) from h11m_cur)), 'false',
  'a block identity that no longer exists is not current [P2-S11-AC-090]');
select is(pg_temp.h11m_current('{}'::jsonb), 'false', 'an empty object is not a current manifest [P2-S11-AC-090]');
select is(pg_temp.h11m_current(null), 'false', 'null is not a current manifest [P2-S11-AC-090]');

-- ---------------------------------------------------------------------------
-- The strict DependencyManifest structure is validated BEFORE any currency check (BE03b E1): all nine
-- groups present, exact keys, types, hashes, bounds, canonical ordering and uniqueness.
-- ---------------------------------------------------------------------------
select ok((select jsonb_array_length(manifest->'blocks') >= 2 and jsonb_array_length(manifest->'patterns') >= 1
             and manifest->'template' <> 'null'::jsonb from h11m_cur),
  'fixture: the current manifest carries a template, at least two blocks and a pattern for the ordering cases [P2-S11-AC-090]');

create temp table h11m_structure_cases on commit drop as
select c.name, c.mutated
  from h11m_cur,
  lateral (values
    ('missing group schema', manifest - 'schema'),
    ('missing group template', manifest - 'template'),
    ('missing group blocks', manifest - 'blocks'),
    ('missing group patterns', manifest - 'patterns'),
    ('missing group terms', manifest - 'terms'),
    ('missing group localeSources', manifest - 'localeSources'),
    ('missing group settings', manifest - 'settings'),
    ('missing group relations', manifest - 'relations'),
    ('missing group checker', manifest - 'checker'),
    ('extra top-level key', manifest || '{"extra":true}'::jsonb),
    ('schema extra key', jsonb_set(manifest, '{schema,extra}', '1')),
    ('schema id upper-case', jsonb_set(manifest, '{schema,id}', to_jsonb(upper(manifest->'schema'->>'id')))),
    ('schema hash not hex', jsonb_set(manifest, '{schema,hash}', to_jsonb(repeat('G', 64)))),
    ('artifact missing zodContractRef', manifest #- '{schema,schemaArtifact,zodContractRef}'),
    ('artifact compilerVersion empty', jsonb_set(manifest, '{schema,schemaArtifact,compilerVersion}', '""')),
    ('artifact compilerVersion a number', jsonb_set(manifest, '{schema,schemaArtifact,compilerVersion}', '7')),
    ('artifact binds another schema version', jsonb_set(manifest, '{schema,schemaArtifact,contentTypeVersionId}',
       '"a9300000-0000-4000-8000-0000000000aa"')),
    ('workflowPolicy missing approvalEvidenceHash', manifest #- '{schema,workflowPolicy,approvalEvidenceHash}'),
    ('workflowPolicy riskClass unknown', jsonb_set(manifest, '{schema,workflowPolicy,riskClass}', '"critical"')),
    ('protected policy with one decision', jsonb_set(jsonb_set(manifest, '{schema,workflowPolicy,riskClass}', '"protected"'),
       '{schema,workflowPolicy,requiredDecisionCount}', '1')),
    ('activationEvidence nine decisions', jsonb_set(manifest, '{schema,activationEvidence,requiredDecisionCount}', '9')),
    ('validatorRefs repeated', jsonb_set(manifest, '{schema,validatorRefs}',
       '[{"key":"rich_text.v1","version":"1"},{"key":"rich_text.v1","version":"1"}]')),
    ('validatorRefs version zero', jsonb_set(manifest, '{schema,validatorRefs}', '[{"key":"rich_text.v1","version":"0"}]')),
    ('template extra key', jsonb_set(manifest, '{template,extra}', '1')),
    ('template id upper-case', jsonb_set(manifest, '{template,id}', to_jsonb(upper(manifest->'template'->>'id')))),
    ('blocks repeated', jsonb_set(manifest, '{blocks}', manifest->'blocks' || (manifest->'blocks'->0))),
    ('blocks descending', jsonb_set(manifest, '{blocks}', (select jsonb_agg(entry order by ordinal desc)
       from jsonb_array_elements(manifest->'blocks') with ordinality t(entry, ordinal)))),
    ('block id upper-case', jsonb_set(manifest, '{blocks,0,id}', to_jsonb(upper(manifest->'blocks'->0->>'id')))),
    ('block hash upper-case', jsonb_set(manifest, '{blocks,0,hash}', to_jsonb(upper(manifest->'blocks'->0->>'hash')))),
    ('pattern extra key', jsonb_set(manifest, '{patterns,0,extra}', '1')),
    ('terms descending', jsonb_set(manifest, '{terms}',
       '[{"id":"a9300000-0000-4000-8000-000000000a02","hash":"%s"},{"id":"a9300000-0000-4000-8000-000000000a01","hash":"%s"}]'::jsonb)),
    ('terms repeated', jsonb_set(manifest, '{terms}',
       '[{"id":"a9300000-0000-4000-8000-000000000a01","hash":"%s"},{"id":"a9300000-0000-4000-8000-000000000a01","hash":"%s"}]'::jsonb)),
    ('terms entry without hash', jsonb_set(manifest, '{terms}', '[{"id":"a9300000-0000-4000-8000-000000000a01"}]')),
    ('terms not an array', jsonb_set(manifest, '{terms}', '{}')),
    ('terms over its 256 maximum', jsonb_set(manifest, '{terms}', (select jsonb_agg(jsonb_build_object(
       'id', 'a9300000-0000-4000-8000-' || lpad(to_hex(g), 12, '0'), 'hash', repeat('a', 64)) order by g)
       from generate_series(1, 257) g))),
    ('localeSources bad locale', jsonb_set(manifest, '{localeSources}',
       '[{"locale":"e","revisionId":"a9300000-0000-4000-8000-000000000a03","hash":"%s"}]')),
    ('localeSources repeated locale', jsonb_set(manifest, '{localeSources}',
       '[{"locale":"en-US","revisionId":"a9300000-0000-4000-8000-000000000a03","hash":"%s"},{"locale":"en-US","revisionId":"a9300000-0000-4000-8000-000000000a04","hash":"%s"}]')),
    ('localeSources descending', jsonb_set(manifest, '{localeSources}',
       '[{"locale":"fr-FR","revisionId":"a9300000-0000-4000-8000-000000000a04","hash":"%s"},{"locale":"en-US","revisionId":"a9300000-0000-4000-8000-000000000a03","hash":"%s"}]')),
    ('relations non-decimal targetVersion', jsonb_set(manifest, '{relations}',
       '[{"fieldId":"a9300000-0000-4000-8000-000000000a05","targetId":"a9300000-0000-4000-8000-000000000a06","targetVersion":"x"}]')),
    ('relations descending', jsonb_set(manifest, '{relations}',
       '[{"fieldId":"a9300000-0000-4000-8000-000000000a05","targetId":"a9300000-0000-4000-8000-000000000a07","targetVersion":"1"},{"fieldId":"a9300000-0000-4000-8000-000000000a05","targetId":"a9300000-0000-4000-8000-000000000a06","targetVersion":"1"}]')),
    ('relations repeated', jsonb_set(manifest, '{relations}',
       '[{"fieldId":"a9300000-0000-4000-8000-000000000a05","targetId":"a9300000-0000-4000-8000-000000000a06","targetVersion":"1"},{"fieldId":"a9300000-0000-4000-8000-000000000a05","targetId":"a9300000-0000-4000-8000-000000000a06","targetVersion":"2"}]')),
    ('checker version zero', jsonb_set(manifest, '{checker,version}', '"0"')),
    ('checker key empty', jsonb_set(manifest, '{checker,key}', '""')),
    ('checker extra key', jsonb_set(manifest, '{checker,extra}', '1')),
    ('settings extra key', jsonb_set(manifest, '{settings,extra}', '1'))
  ) as c(name, mutated);

-- The three list cases above carry a placeholder hash that is replaced by a real 64-hex string.
update h11m_structure_cases set mutated = replace(mutated::text, '%s', repeat('b', 64))::jsonb;

select is((select string_agg(name, '; ' order by name) from h11m_structure_cases
            where pg_temp.h11m_current(mutated) <> 'false'),
  null, 'a structurally invalid manifest is never current: one case per missing group and per violated rule [P2-S11-AC-090]');
select is((select string_agg(name, '; ' order by name) from h11m_structure_cases
            where pg_temp.h11_text(format('select platform_private.cms_dependency_manifest_valid(%L::jsonb)', mutated::text)) <> 'false'),
  null, 'cms_dependency_manifest_valid rejects every one of those manifests [P2-S11-AC-090]');

create temp table h11m_structure_controls on commit drop as
select c.name, c.accepted
  from h11m_cur,
  lateral (values
    ('the built manifest', manifest),
    ('sorted terms', jsonb_set(manifest, '{terms}',
       ('[{"id":"a9300000-0000-4000-8000-000000000a01","hash":"' || repeat('b', 64) || '"},{"id":"a9300000-0000-4000-8000-000000000a02","hash":"' || repeat('b', 64) || '"}]')::jsonb)),
    ('sorted localeSources', jsonb_set(manifest, '{localeSources}',
       ('[{"locale":"fr-FR","revisionId":"a9300000-0000-4000-8000-000000000a03","hash":"' || repeat('b', 64) || '"},{"locale":"en-US","revisionId":"a9300000-0000-4000-8000-000000000a04","hash":"' || repeat('b', 64) || '"}]')::jsonb)),
    ('sorted relations', jsonb_set(manifest, '{relations}',
       ('[{"fieldId":"a9300000-0000-4000-8000-000000000a05","targetId":"a9300000-0000-4000-8000-000000000a06","targetVersion":"1"},{"fieldId":"a9300000-0000-4000-8000-000000000a05","targetId":"a9300000-0000-4000-8000-000000000a07","targetVersion":"9223372036854775807"}]')::jsonb)),
    ('100 terms', jsonb_set(manifest, '{terms}', (select jsonb_agg(jsonb_build_object(
       'id', 'a9300000-0000-4000-8000-' || lpad(to_hex(g), 12, '0'), 'hash', repeat('a', 64)) order by g)
       from generate_series(1, 100) g)))
  ) as c(name, accepted);
select is((select string_agg(name, '; ' order by name) from h11m_structure_controls
            where pg_temp.h11m_current(accepted) <> 'true'),
  null, 'control: a well-formed manifest (sorted, unique, populated optional groups) is still current [P2-S11-AC-090]');
select is((select string_agg(name, '; ' order by name) from h11m_structure_controls
            where pg_temp.h11_text(format('select platform_private.cms_dependency_manifest_valid(%L::jsonb)', accepted::text)) <> 'true'),
  null, 'control: cms_dependency_manifest_valid accepts them [P2-S11-AC-090]');

-- schema version: current only while it is the content type's active version.
select pg_temp.h11_raw_exec('platform_private.cms_content_type_versions',
  format('update platform_private.cms_content_type_versions set state = ''superseded'' where id = %L::uuid', pg_temp.h11w_version()));
select is(pg_temp.h11m_current((select manifest from h11m_cur)), 'false',
  'a schema version that is no longer active is not current [P2-S11-AC-090]');
select pg_temp.h11_raw_exec('platform_private.cms_content_type_versions',
  format('update platform_private.cms_content_type_versions set state = ''active'' where id = %L::uuid', pg_temp.h11w_version()));
select is(pg_temp.h11m_current((select manifest from h11m_cur)), 'true', 'control: reactivated, the manifest is current again [P2-S11-AC-090]');

select pg_temp.h11_raw_exec('platform_private.cms_template_versions',
  $$update platform_private.cms_template_versions set state = 'retired' where id = 'a9200000-0000-4000-8000-0000000d0001'$$);
select is(pg_temp.h11m_current((select manifest from h11m_cur)), 'false', 'a template version that is no longer active is not current [P2-S11-AC-090]');
select pg_temp.h11_raw_exec('platform_private.cms_template_versions',
  $$update platform_private.cms_template_versions set state = 'active' where id = 'a9200000-0000-4000-8000-0000000d0001'$$);

select pg_temp.h11_raw_exec('platform_private.cms_pattern_versions',
  $$update platform_private.cms_pattern_versions set state = 'retired' where id = 'a9200000-0000-4000-8000-0000000c0001'$$);
select is(pg_temp.h11m_current((select manifest from h11m_cur)), 'false', 'a pattern version that is no longer active is not current [P2-S11-AC-090]');
select pg_temp.h11_raw_exec('platform_private.cms_pattern_versions',
  $$update platform_private.cms_pattern_versions set state = 'active' where id = 'a9200000-0000-4000-8000-0000000c0001'$$);

select pg_temp.h11m_lifecycle('a9200000-0000-4000-8000-0000000b0002', 'h11.second', 'deprecated');
select is(pg_temp.h11m_current((select manifest from h11m_cur)), 'true',
  'a deprecated block is still current (supported or deprecated) [P2-S11-AC-090]');

-- ---------------------------------------------------------------------------
-- cms_frozen_dependencies_status
-- ---------------------------------------------------------------------------
create or replace function pg_temp.h11m_status(p_tag text, p_frozen jsonb)
returns text
language sql
as $body$
  select pg_temp.h11_text(format('select platform_private.cms_frozen_dependencies_status(%L::uuid, %L::jsonb)',
    pg_temp.h11w_uuid(p_tag || ':revision'), p_frozen::text))
$body$;

select is(pg_temp.h11m_status('cur', (select manifest from h11m_cur)), 'current',
  'status: a frozen manifest equal to the rebuilt one with every identity current is current [P2-S11-AC-090]');
select is(pg_temp.h11m_status('clean', (select manifest from h11m_cur)), 'stale',
  'status: another revision''s manifest is stale [P2-S11-AC-090]');
select is(pg_temp.h11m_status('cur', null), 'stale', 'status: a null frozen manifest is stale [P2-S11-AC-090]');
select is(pg_temp.h11m_status('cur', '[]'::jsonb), 'stale', 'status: a malformed frozen manifest is stale [P2-S11-AC-090]');
select is(pg_temp.h11m_status('cur', (select jsonb_set(manifest, '{checker,version}', '"9"') from h11m_cur)), 'stale',
  'status: a one-member drift (checker version) makes the frozen manifest stale [P2-S11-AC-090]');
select is(pg_temp.h11_text(format('select platform_private.cms_frozen_dependencies_status(%L::uuid, %L::jsonb)',
    'a9200000-0000-4000-8000-0000000000ee', (select manifest::text from h11m_cur))), 'stale',
  'status: an absent revision cannot be rebuilt, so its frozen set is stale [P2-S11-AC-090]');

-- A relation that appears after freezing changes the rebuilt manifest.
select pg_temp.h11w_relation(pg_temp.h11w_uuid('cur:revision'), 'rel_omit', 'a9100000-0000-4000-8000-000000000301'::uuid, 1, 0, 'omit');
select is(pg_temp.h11m_status('cur', (select manifest from h11m_cur)), 'stale',
  'status: a rebuilt manifest that differs from the frozen one is stale even though every frozen identity is current [P2-S11-AC-090]');

-- Equal manifest but a withdrawn block: lifecycle is not part of the manifest.
select pg_temp.h11w_revision('wd');
select pg_temp.h11m_instance('wd:i1', pg_temp.h11w_uuid('wd:revision'), '/a', 'h11.slotonly');
create temp table h11m_wd on commit drop as select pg_temp.h11m_build('wd') as manifest;
select is(pg_temp.h11m_status('wd', (select manifest from h11m_wd)), 'current', 'control: the wd manifest is current [P2-S11-AC-090]');
select pg_temp.h11m_lifecycle('a9200000-0000-4000-8000-0000000b0004', 'h11.slotonly', 'withdrawn');
select is(pg_temp.h11m_build('wd'), (select manifest from h11m_wd),
  'a withdrawn block leaves the manifest bytes unchanged (the digest is the release digest) [P2-S11-AC-090]');
select is(pg_temp.h11m_current((select manifest from h11m_wd)), 'false',
  'a withdrawn block is not current [P2-S11-AC-090]');
select is(pg_temp.h11m_status('wd', (select manifest from h11m_wd)), 'stale',
  'status: an unchanged manifest with a withdrawn block is stale (non-current identity) [P2-S11-AC-090]');

-- Taxonomy versions of the revision must be active too.
select pg_temp.h11w_revision('taxcur', 'creatorPerson', 'en-US', jsonb_build_array(pg_temp.h11w_uuid('tax1')));
create temp table h11m_tax on commit drop as select pg_temp.h11m_build('taxcur') as manifest;
select is(pg_temp.h11m_status('taxcur', (select manifest from h11m_tax)), 'stale',
  'status: a revision recording a taxonomy version that is not active is stale [P2-S11-AC-090]');
select pg_temp.h11_raw_exec('platform_private.cms_taxonomy_versions',
  format('update platform_private.cms_taxonomy_versions set state = ''active'' where id = %L::uuid', pg_temp.h11w_uuid('tax1')));
select is(pg_temp.h11m_status('taxcur', (select manifest from h11m_tax)), 'current',
  'status: with the taxonomy version active the same frozen manifest is current [P2-S11-AC-090]');

-- ---------------------------------------------------------------------------
-- review dependency rows (written by cms_submit_review from the frozen manifest)
-- ---------------------------------------------------------------------------
create or replace function pg_temp.h11m_refs(p_tag text, p_manifest jsonb)
returns text
language sql
as $body$
  select pg_temp.h11_text(format(
    'select coalesce(string_agg(kind || '':'' || ref_id::text, '','' order by kind collate "C", ref_id::text collate "C"), '''') from platform_private.cms_review_dependency_refs(%L::uuid, %L::jsonb)',
    pg_temp.h11w_uuid(p_tag || ':revision'), p_manifest::text))
$body$;

select is(pg_temp.h11m_refs('cur', (select manifest from h11m_cur)),
  concat_ws(',',
    'block:a9200000-0000-4000-8000-0000000b0001', 'block:a9200000-0000-4000-8000-0000000b0002',
    'block:a9200000-0000-4000-8000-0000000b0003', 'block:a9200000-0000-4000-8000-0000000b0004',
    'pattern:a9200000-0000-4000-8000-0000000c0001',
    'schema:' || pg_temp.h11w_version()::text,
    'settings:' || (select id::text from platform_private.cms_publication_settings_snapshots where ordinal = 1 and owner_id = pg_temp.h11w_org()),
    'template:a9200000-0000-4000-8000-0000000d0001'),
  'dependency rows: schema, template, block (instances and template slots), pattern and the settings snapshot row id, one row per identity [P2-S11-AC-113]');

select pg_temp.h11w_revision('depall', 'creatorPerson', 'en-US', jsonb_build_array(pg_temp.h11w_uuid('tax1')), null, 1);
select pg_temp.h11m_assign('depall:a1', pg_temp.h11w_uuid('depall:revision'), 'a9200000-0000-4000-8000-0000000e0001', 'active', 0);
select pg_temp.h11w_relation(pg_temp.h11w_uuid('depall:revision'), 'rel_omit', 'a9100000-0000-4000-8000-000000000301'::uuid, 1, 0, 'omit');
select pg_temp.h11w_relation(pg_temp.h11w_uuid('depall:revision'), 'rel_block', 'a9100000-0000-4000-8000-000000000301'::uuid, 1, 0, 'block');
select is(pg_temp.h11m_refs('depall', pg_temp.h11m_build('depall')),
  concat_ws(',',
    'relation_target:a9100000-0000-4000-8000-000000000301',
    'schema:' || pg_temp.h11w_version()::text,
    'settings:' || (select id::text from platform_private.cms_publication_settings_snapshots where ordinal = 1 and owner_id = pg_temp.h11w_org()),
    'taxonomy_version:' || pg_temp.h11w_uuid('tax1')::text,
    'term:a9200000-0000-4000-8000-0000000e0001'),
  'dependency rows: term, taxonomy_version (the revision''s ids) and relation_target (distinct targets) kinds [P2-S11-AC-113]');
select is(pg_temp.h11m_refs('locvar', pg_temp.h11m_build('locvar')),
  concat_ws(',',
    'locale_source:' || pg_temp.h11w_uuid('locsrc:revision')::text,
    'schema:' || pg_temp.h11w_version()::text,
    'settings:' || (select id::text from platform_private.cms_publication_settings_snapshots where ordinal = 1 and owner_id = pg_temp.h11w_org())),
  'dependency rows: the locale_source kind names the source revision [P2-S11-AC-113]');
select is(pg_temp.h11_text(format('select count(*) from platform_private.cms_review_dependency_refs(%L::uuid, ''[]''::jsonb)',
    pg_temp.h11w_uuid('cur:revision'))), 'ERR:P0001:INVALID_REQUEST',
  'dependency rows of a malformed manifest are INVALID_REQUEST [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- Writes and posture.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::integer from platform_private.cms_editorial_reviews), 0,
  'no helper creates a review row [P2-S11-AC-087]');
select is(
  (select count(*)::integer from platform_private.cms_publication_settings_snapshots where owner_id = pg_temp.h11w_org()),
  1, 'all of the above reused the owner''s single settings snapshot (ordinal 1) [P2-S11-AC-092]');
select is(
  (select count(*)::integer from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname in ('cms_build_dependency_manifest', 'cms_manifest_identities_current', 'cms_frozen_dependencies_status',
                        'cms_revision_version_set', 'cms_dependency_manifest_within_bounds', 'cms_review_dependency_refs')),
  6, 'exactly one overload of each manifest helper exists [P2-S11-AC-087]');

select * from finish();
rollback;
