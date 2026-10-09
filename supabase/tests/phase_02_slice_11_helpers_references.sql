-- Slice 11 shared helper: platform_private.cms_revision_references
-- (BE03b "Publication preflight registry (D19, DEC-134, D25)": the reference
-- counter the generic preflight.reference_gate provider consumes; tracker
-- P2-S11-AC-094).  RED before 20261005017510, GREEN after.
--
-- A reference gate passes only when cms_revision_references(revision, kind) = 0.
-- Kinds and what each counts for a revision:
--   pattern   composition instances that name a PatternVersion (not retired/superseded)
--   taxonomy  active TermAssignment rows + recorded taxonomy_version_ids
--   privacy   distinct entries among {the entry itself, its content relation targets}
--             whose lifecycle is held or deletion_pending
--   media     non-empty values of media fields + composition instances whose block
--             declares a cms.media* data source
--   route     rich-text `internal` links (any depth, objects included)
--   locale    LocaleVariant rows of the revision + active no_fallback fields of its schema

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(52);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc

create or replace function pg_temp.h11_refs(p_revision uuid, p_kind text)
returns text
language sql
as $body$
  select pg_temp.h11_text(format(
    'select platform_private.cms_revision_references(%L::uuid, %L)', p_revision, p_kind))
$body$;

-- All six counts as one comparable string: pattern/taxonomy/privacy/media/route/locale.
create or replace function pg_temp.h11_ref_row(p_revision uuid)
returns text
language sql
as $body$
  select concat_ws('/',
    pg_temp.h11_refs(p_revision, 'pattern'), pg_temp.h11_refs(p_revision, 'taxonomy'),
    pg_temp.h11_refs(p_revision, 'privacy'), pg_temp.h11_refs(p_revision, 'media'),
    pg_temp.h11_refs(p_revision, 'route'), pg_temp.h11_refs(p_revision, 'locale'))
$body$;

-- ---------------------------------------------------------------------------
-- Shape and privileges.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.h11_private_definer('cms_revision_references(uuid, text)'),
  'cms_revision_references is a private SECURITY DEFINER function of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-094]'
);
select is(pg_temp.h11_rettype('cms_revision_references(uuid, text)'), 'bigint',
  'cms_revision_references returns bigint [P2-S11-AC-094]');
select is(pg_temp.h11_volatility('cms_revision_references(uuid, text)'), 's',
  'cms_revision_references is STABLE [P2-S11-AC-094]');

-- ---------------------------------------------------------------------------
-- Argument discipline.
-- ---------------------------------------------------------------------------
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('absent'), 'widget'), 'ERR:P0001:INVALID_REQUEST',
  'an unknown kind is INVALID_REQUEST [P2-S11-AC-094]');
select is(pg_temp.h11_text('select platform_private.cms_revision_references(null::uuid, null)'),
  'ERR:P0001:INVALID_REQUEST', 'a null kind is INVALID_REQUEST even for a null revision [P2-S11-AC-094]');
select is(pg_temp.h11_ref_row(pg_temp.h11w_uuid('absent')), '0/0/0/0/0/0',
  'an absent revision holds no reference of any kind [P2-S11-AC-094]');
select is(pg_temp.h11_text('select platform_private.cms_revision_references(null::uuid, ''pattern'')'), '0',
  'a null revision id holds no reference [P2-S11-AC-094]');

-- ---------------------------------------------------------------------------
-- Clean revisions.  The Slice 10 article type declares no no_fallback field, so
-- its seeded revision is the all-zero control; every h11doc revision carries the
-- schema-level locale reference (its `legal` field is no_fallback).
-- ---------------------------------------------------------------------------
select is(pg_temp.h11_ref_row('a9100000-0000-4000-8000-000000000302'::uuid), '0/0/0/0/0/0',
  'the seeded article revision (title + a self relation, no refs) holds no reference of any kind [P2-S11-AC-094]');

select pg_temp.h11w_revision('clean');
select is(pg_temp.h11_ref_row(pg_temp.h11w_uuid('clean:revision')), '0/0/0/0/0/1',
  'a clean h11doc revision holds only the schema-level locale reference of its no_fallback field [P2-S11-AC-094]');

-- ---------------------------------------------------------------------------
-- pattern
-- ---------------------------------------------------------------------------
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_pattern_versions(
  id, owner_id, version, pattern_key, block_tree, block_registry_digest,
  content_hash, owner_capability, created_by
) values (
  pg_temp.h11w_uuid('pattern'), pg_temp.h11w_org(), 1, 'h11-pattern',
  '{"nodes":[{"blockKey":"profile.header"}]}'::jsonb, repeat('a', 64), repeat('b', 64),
  'cms.template_designer', (select value::uuid from s10_ids where key = 'creatorAuth')
);

select pg_temp.h11w_revision('pat');
select pg_temp.h11w_instance('pat:i1', pg_temp.h11w_uuid('pat:revision'), '/a', true);
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('pat:revision'), 'pattern'), '1',
  'one composition instance naming a PatternVersion is one pattern reference [P2-S11-AC-094]');
select pg_temp.h11w_instance('pat:i2', pg_temp.h11w_uuid('pat:revision'), '/b', true, 'active');
select pg_temp.h11w_instance('pat:i3', pg_temp.h11w_uuid('pat:revision'), '/c', false);
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('pat:revision'), 'pattern'), '2',
  'a second pattern instance counts and an instance without a pattern does not [P2-S11-AC-094]');
select pg_temp.h11w_instance('pat:i4', pg_temp.h11w_uuid('pat:revision'), '/d', true, 'retired');
select pg_temp.h11w_instance('pat:i5', pg_temp.h11w_uuid('pat:revision'), '/e', true, 'superseded');
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('pat:revision'), 'pattern'), '2',
  'retired and superseded instances no longer count [P2-S11-AC-094]');
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('clean:revision'), 'pattern'), '0',
  'another revision''s instances are not counted [P2-S11-AC-094]');

-- ---------------------------------------------------------------------------
-- taxonomy
-- ---------------------------------------------------------------------------
insert into platform_private.cms_taxonomy_versions(
  id, owner_id, version, taxonomy_key, owner_capability, shape,
  allowlisted_type_keys, allowlisted_field_keys, content_hash, created_by
) values
  (pg_temp.h11w_uuid('tax1'), pg_temp.h11w_org(), 1, 'h11-genres', 'cms.taxonomy_curator',
   'flat', '[]'::jsonb, '[]'::jsonb, repeat('a', 64), (select value::uuid from s10_ids where key = 'creatorAuth')),
  (pg_temp.h11w_uuid('tax2'), pg_temp.h11w_org(), 1, 'h11-moods', 'cms.taxonomy_curator',
   'flat', '[]'::jsonb, '[]'::jsonb, repeat('b', 64), (select value::uuid from s10_ids where key = 'creatorAuth'));
insert into platform_private.cms_terms(
  id, owner_id, version, taxonomy_version_id, term_key, created_by
) values
  (pg_temp.h11w_uuid('term1'), pg_temp.h11w_org(), 1, pg_temp.h11w_uuid('tax1'), 'jazz',
   (select value::uuid from s10_ids where key = 'creatorAuth')),
  (pg_temp.h11w_uuid('term2'), pg_temp.h11w_org(), 1, pg_temp.h11w_uuid('tax1'), 'rock',
   (select value::uuid from s10_ids where key = 'creatorAuth')),
  (pg_temp.h11w_uuid('term3'), pg_temp.h11w_org(), 1, pg_temp.h11w_uuid('tax1'), 'blues',
   (select value::uuid from s10_ids where key = 'creatorAuth'));

select pg_temp.h11w_revision('tax');
select pg_temp.h11w_assignment('tax:a1', pg_temp.h11w_uuid('tax:revision'), 'term1');
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('tax:revision'), 'taxonomy'), '1',
  'one active term assignment is one taxonomy reference [P2-S11-AC-094]');
select pg_temp.h11w_assignment('tax:a2', pg_temp.h11w_uuid('tax:revision'), 'term2', 'active', 1);
select pg_temp.h11w_assignment('tax:a3', pg_temp.h11w_uuid('tax:revision'), 'term3', 'superseded', 2);
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('tax:revision'), 'taxonomy'), '2',
  'a second active assignment counts and a superseded one does not [P2-S11-AC-094]');
select pg_temp.h11w_revision('taxids', 'creatorPerson', 'en-US',
  jsonb_build_array(pg_temp.h11w_uuid('tax1'), pg_temp.h11w_uuid('tax2')));
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('taxids:revision'), 'taxonomy'), '2',
  'recorded taxonomy_version_ids count one each even with no TermAssignment [P2-S11-AC-094]');
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('clean:revision'), 'taxonomy'), '0',
  'a revision with no assignment and no recorded taxonomy version holds none [P2-S11-AC-094]');

-- ---------------------------------------------------------------------------
-- media
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('media');
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('media:revision'), 'media'), '0',
  'a revision with no media value holds no media reference [P2-S11-AC-094]');
select pg_temp.h11w_value(pg_temp.h11w_uuid('media:revision'), 'hero',
  jsonb_build_object('assetId', pg_temp.h11w_uuid('asset'), 'assetVersion', '1'));
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('media:revision'), 'media'), '1',
  'a non-empty media field value is one media reference [P2-S11-AC-094]');
select pg_temp.h11w_revision('media0');
select pg_temp.h11w_value(pg_temp.h11w_uuid('media0:revision'), 'hero', '[]'::jsonb);
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('media0:revision'), 'media'), '0',
  'an empty media list is not a media reference [P2-S11-AC-094]');
select pg_temp.h11w_revision('mediaarr');
select pg_temp.h11w_value(pg_temp.h11w_uuid('mediaarr:revision'), 'hero',
  jsonb_build_array(jsonb_build_object('assetId', pg_temp.h11w_uuid('asset'), 'assetVersion', '1')));
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('mediaarr:revision'), 'media'), '1',
  'a non-empty media array is a media reference [P2-S11-AC-094]');

-- A block that declares a media data source: an instance of it is a media reference.
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_block_definition_versions(
  id, owner_id, block_key, block_version, props_schema_ref,
  props_schema_hash, props_schema_snapshot, props_snapshot_hash,
  props_snapshot_attestation, props_attestation_key_id,
  props_attestation_signature_hash, props_attestation_verified_at,
  renderer_ref, allowed_children, slot_rules, data_source_permissions,
  accessibility_contract, compatibility_range, release_digest,
  release_principal_id, release_key_id, release_raw_body_hash,
  release_signature_hash, release_nonce_hash, release_verified_at
) values
  (pg_temp.h11w_uuid('block-media'), pg_temp.h11w_org(), 'h11.gallery', 1, 'cms/h11/gallery',
   repeat('2', 64), '{}'::jsonb, repeat('4', 64), '{}'::jsonb, 'h11-test-key', repeat('5', 64),
   clock_timestamp(), 'cms.h11.gallery', '[]'::jsonb, '{}'::jsonb, '["cms.media.read"]'::jsonb,
   '{}'::jsonb, '{}'::jsonb, repeat('3', 64), pg_temp.h11w_uuid('principal'), 'h11-release-key',
   repeat('6', 64), repeat('7', 64), repeat('8', 64), clock_timestamp()),
  (pg_temp.h11w_uuid('block-plain'), pg_temp.h11w_org(), 'h11.callout', 1, 'cms/h11/callout',
   repeat('2', 64), '{}'::jsonb, repeat('4', 64), '{}'::jsonb, 'h11-test-key', repeat('5', 64),
   clock_timestamp(), 'cms.h11.callout', '[]'::jsonb, '{}'::jsonb, '["cms.content.read"]'::jsonb,
   '{}'::jsonb, '{}'::jsonb, repeat('9', 64), pg_temp.h11w_uuid('principal'), 'h11-release-key',
   repeat('6', 64), repeat('7', 64), repeat('8', 64), clock_timestamp());
select pg_temp.h11w_revision('blockmedia');
select pg_temp.h11w_instance('bm:i1', pg_temp.h11w_uuid('blockmedia:revision'), '/gallery', false, 'draft', 'h11.callout');
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('blockmedia:revision'), 'media'), '0',
  'a block without a media data source is not a media reference [P2-S11-AC-094]');
select pg_temp.h11w_instance('bm:i2', pg_temp.h11w_uuid('blockmedia:revision'), '/gallery2', false, 'draft', 'h11.gallery');
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('blockmedia:revision'), 'media'), '1',
  'an instance of a block declaring a cms.media data source is a media reference [P2-S11-AC-094]');

-- ---------------------------------------------------------------------------
-- route (rich-text internal links at any depth)
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('route');
select pg_temp.h11w_value(pg_temp.h11w_uuid('route:revision'), 'body',
  pg_temp.h11w_rich('plain'));
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('route:revision'), 'route'), '0',
  'rich text without a link holds no route reference [P2-S11-AC-094]');
select pg_temp.h11w_revision('route-https');
select pg_temp.h11w_value(pg_temp.h11w_uuid('route-https:revision'), 'body',
  pg_temp.h11w_rich('see', jsonb_build_object('kind', 'https', 'href', 'https://example.com/a')));
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('route-https:revision'), 'route'), '0',
  'an https link is not a route reference [P2-S11-AC-094]');
select pg_temp.h11w_revision('route-internal');
select pg_temp.h11w_value(pg_temp.h11w_uuid('route-internal:revision'), 'body',
  pg_temp.h11w_rich('see', jsonb_build_object('kind', 'internal', 'route', '/news/a')));
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('route-internal:revision'), 'route'), '1',
  'an internal rich-text link is one route reference [P2-S11-AC-094]');
select pg_temp.h11w_revision('route-nested');
select pg_temp.h11w_value(pg_temp.h11w_uuid('route-nested:revision'), 'meta',
  jsonb_build_object('label', 'x',
    'note', pg_temp.h11w_rich('see', jsonb_build_object('kind', 'internal', 'route', '/a'))));
select pg_temp.h11w_value(pg_temp.h11w_uuid('route-nested:revision'), 'body',
  jsonb_build_object('format', 'rich_text.v1', 'blocks', jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'spans', jsonb_build_array(
      jsonb_build_object('text', 'a', 'marks', '[]'::jsonb,
        'link', jsonb_build_object('kind', 'internal', 'route', '/b')),
      jsonb_build_object('text', 'b', 'marks', '[]'::jsonb,
        'link', jsonb_build_object('kind', 'internal', 'route', '/c')))))));
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('route-nested:revision'), 'route'), '3',
  'internal links in an object property and in two spans each count [P2-S11-AC-094]');
select pg_temp.h11w_revision('route-decoy');
select pg_temp.h11w_value(pg_temp.h11w_uuid('route-decoy:revision'), 'meta',
  jsonb_build_object('label', 'internal'));
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('route-decoy:revision'), 'route'), '0',
  'the word internal as a plain value is not a route reference [P2-S11-AC-094]');

-- ---------------------------------------------------------------------------
-- locale
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('loc-source');
select pg_temp.h11w_revision('loc-variant', 'creatorPerson', 'fr-FR', '[]'::jsonb, 'loc-source', 2);
select set_config('app.cms_rpc', 'true', true);
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('loc-variant:revision'), 'locale'), '1',
  'before a variant row exists only the schema no_fallback field is a locale reference [P2-S11-AC-094]');
insert into platform_private.cms_locale_variants(
  id, owner_id, state, version, entry_id, revision_id, source_revision_id,
  locale, source_locale, source_hash, created_by
) values (
  pg_temp.h11w_uuid('variant'), pg_temp.h11w_org(), 'draft', 1,
  pg_temp.h11w_uuid('loc-source:entry'), pg_temp.h11w_uuid('loc-variant:revision'),
  pg_temp.h11w_uuid('loc-source:revision'), 'fr-FR', 'en-US',
  (select payload_hash from platform_private.cms_entry_revisions
    where id = pg_temp.h11w_uuid('loc-source:revision')),
  (select value::uuid from s10_ids where key = 'creatorAuth')
);
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('loc-variant:revision'), 'locale'), '2',
  'a LocaleVariant row of the revision adds a locale reference [P2-S11-AC-094]');
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('loc-source:revision'), 'locale'), '1',
  'a source-locale revision with no variant row holds only the schema reference [P2-S11-AC-094]');

-- ---------------------------------------------------------------------------
-- privacy: entry lifecycle and relation targets
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('priv');
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('priv:revision'), 'privacy'), '0',
  'an active entry with no relation holds no privacy reference [P2-S11-AC-094]');
update platform_private.cms_content_entries
   set lifecycle = 'held', version = version + 1
 where id = pg_temp.h11w_uuid('priv:entry');
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('priv:revision'), 'privacy'), '1',
  'a held entry is a privacy reference [P2-S11-AC-094]');
update platform_private.cms_content_entries
   set lifecycle = 'deletion_pending', version = version + 1
 where id = pg_temp.h11w_uuid('priv:entry');
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('priv:revision'), 'privacy'), '1',
  'a deletion_pending entry is a privacy reference [P2-S11-AC-094]');
update platform_private.cms_content_entries
   set lifecycle = 'archived', version = version + 1
 where id = pg_temp.h11w_uuid('priv:entry');
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('priv:revision'), 'privacy'), '0',
  'an archived entry is unavailable but not a privacy hold [P2-S11-AC-094]');

select pg_temp.h11w_revision('privrel');
select pg_temp.h11w_relation(pg_temp.h11w_uuid('privrel:revision'), 'rel_omit',
  'a9100000-0000-4000-8000-000000000301'::uuid, 1);
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('privrel:revision'), 'privacy'), '0',
  'a relation to an active target is not a privacy reference [P2-S11-AC-094]');
update platform_private.cms_content_entries
   set lifecycle = 'held', version = version + 1
 where id = 'a9100000-0000-4000-8000-000000000301';
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('privrel:revision'), 'privacy'), '1',
  'a relation target on legal hold is a privacy reference [P2-S11-AC-094]');
select pg_temp.h11w_relation(pg_temp.h11w_uuid('privrel:revision'), 'rel_block',
  'a9100000-0000-4000-8000-000000000301'::uuid, 1, 0, 'block');
select is(pg_temp.h11_refs(pg_temp.h11w_uuid('privrel:revision'), 'privacy'), '1',
  'the same held target through two relation fields is one distinct privacy reference [P2-S11-AC-094]');
select is(pg_temp.h11_refs('a9100000-0000-4000-8000-000000000302'::uuid, 'privacy'), '1',
  'the held target reaches the seeded revision through its self relation exactly once [P2-S11-AC-094]');

-- ---------------------------------------------------------------------------
-- Independence of kinds and write discipline.
-- ---------------------------------------------------------------------------
select is(pg_temp.h11_ref_row(pg_temp.h11w_uuid('pat:revision')), '2/0/0/0/0/1',
  'the pattern revision holds exactly two pattern references and the schema locale reference [P2-S11-AC-094]');
select is(pg_temp.h11_ref_row(pg_temp.h11w_uuid('tax:revision')), '0/2/0/0/0/1',
  'the taxonomy revision holds exactly two taxonomy references and the schema locale reference [P2-S11-AC-094]');
select is(pg_temp.h11_ref_row(pg_temp.h11w_uuid('route-nested:revision')), '0/0/0/0/3/1',
  'the route revision holds exactly three route references and the schema locale reference [P2-S11-AC-094]');

select ok(
  not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = to_regprocedure('platform_private.cms_revision_references(uuid, text)')
      and pg_catalog.pg_get_functiondef(p.oid) ~* '\m(insert|update|delete)\M[^;]*\mplatform_private\.'
  ),
  'the counter has no INSERT/UPDATE/DELETE against platform_private tables (a read) [P2-S11-AC-094]'
);

select is(
  (select count(*)::integer from platform_private.cms_editorial_reviews),
  0,
  'the counter never creates review rows [P2-S11-AC-094]'
);

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'platform_private' and p.proname = 'cms_revision_references'),
  1,
  'exactly one cms_revision_references overload exists [P2-S11-AC-094]'
);

select * from finish();
rollback;
