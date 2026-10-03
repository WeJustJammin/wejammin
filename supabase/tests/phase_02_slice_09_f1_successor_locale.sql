commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 F1 closure (AC285): CMS-03A-09 locale pair semantics.  Both null
-- clones the source version's locale configuration unchanged; both present
-- replaces it (inherited sourceLocale and defaultLocale, stored sorted
-- ascending by UTF-8 byte order); a half pair is refused.  Every source is an
-- ACTIVE version reached through the real producer chain and every successor
-- through platform_api.cms_create_schema_successor.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

select pg_temp.s09d_create_type('a', 'f1loccloneone', 'editorial', 'owner',
  '["en-US","fr-FR"]'::jsonb, '{"fr-FR":["en-US"]}'::jsonb);
select pg_temp.s09d_to_active('a');
select pg_temp.s09d_create_type('c', 'f1locreplace', 'editorial', 'owner',
  '["en-US","fr-FR"]'::jsonb, '{"fr-FR":["en-US"]}'::jsonb);
select pg_temp.s09d_to_active('c');

select pg_temp.s09d_successor('b', 'a', 'owner', 's09d-f1-clone-0001');
select is(pg_temp.s09d_outcome('b:successor'), 'OK',
  'CMS-03A-09 with both locale fields null produces a successor draft [P2-S09-AC-285]');
select is(
  pg_temp.s09d_scalar(format('select supported_locales::text from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('b:version'))),
  '["en-US", "fr-FR"]',
  'both null clones the source version''s supportedLocales unchanged [P2-S09-AC-285]');
select is(
  pg_temp.s09d_scalar(format('select fallback_chains::text from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('b:version'))),
  '{"fr-FR": ["en-US"]}',
  'both null clones the source version''s fallbackChains unchanged [P2-S09-AC-285]');
select ok(
  pg_temp.s09d_scalar(format('select locale_config_hash::text from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('b:version'))) is not null
  and pg_temp.s09d_scalar(format('select locale_config_hash::text from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('b:version')))
    = pg_temp.s09d_scalar(format('select locale_config_hash::text from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('a:version'))),
  'both null leaves the localeConfigHash identical to the source''s [P2-S09-AC-285]');

select pg_temp.s09d_successor('d', 'c', 'owner', 's09d-f1-replace-0001',
  '["fr-FR","en-US","de-DE"]'::jsonb, '{"fr-FR":["en-US"],"de-DE":["en-US"]}'::jsonb);
select is(pg_temp.s09d_outcome('d:successor'), 'OK',
  'CMS-03A-09 with both locale fields present produces a successor draft [P2-S09-AC-285]');
select is(
  pg_temp.s09d_scalar(format('select supported_locales::text from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('d:version'))),
  '["de-DE", "en-US", "fr-FR"]',
  'both present replaces supportedLocales and stores them sorted ascending by UTF-8 byte order [P2-S09-AC-285]');
select is(
  pg_temp.s09d_scalar(format('select fallback_chains::text from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('d:version'))),
  '{"de-DE": ["en-US"], "fr-FR": ["en-US"]}',
  'both present replaces fallbackChains with the caller''s validated chains [P2-S09-AC-285]');
select ok(
  pg_temp.s09d_scalar(format('select locale_config_hash::text from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('d:version'))) is not null
  and pg_temp.s09d_scalar(format('select locale_config_hash::text from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('d:version')))
    <> pg_temp.s09d_scalar(format('select locale_config_hash::text from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('c:version'))),
  'a replaced configuration yields a different localeConfigHash than the source [P2-S09-AC-285]');
select is(
  pg_temp.s09d_scalar(format('select supported_locales::text from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('c:version'))),
  '["en-US", "fr-FR"]',
  'the immutable source keeps its own supportedLocales after a replacing successor [P2-S09-AC-285]');
select is(
  pg_temp.s09d_scalar(format('select source_locale || ''/'' || default_locale from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('d:version'))),
  'en-US/en-US',
  'sourceLocale and defaultLocale are always inherited from the source, never supplied [P2-S09-AC-285]');

-- A half pair is refused and commits nothing (atomic).
select pg_temp.s09d_rpc('e:half', 'platform_api.cms_create_schema_successor', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'supportedLocales', '["en-US"]'::jsonb, 'fallbackChains', null,
    'idempotencyKey', 's09d-f1-half-0001'));
select is(pg_temp.s09d_outcome('e:half'), 'VALIDATION_FAILED',
  'supportedLocales without fallbackChains is refused 422 VALIDATION_FAILED [P2-S09-AC-285]');
select pg_temp.s09d_rpc('e:half2', 'platform_api.cms_create_schema_successor', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'supportedLocales', null, 'fallbackChains', '{}'::jsonb,
    'idempotencyKey', 's09d-f1-half-0002'));
select is(pg_temp.s09d_outcome('e:half2'), 'VALIDATION_FAILED',
  'fallbackChains without supportedLocales is refused 422 VALIDATION_FAILED [P2-S09-AC-285]');
select is(
  pg_temp.s09d_scalar(format('select count(*)::text from platform_private.cms_content_type_versions where content_type_id = %L', pg_temp.s09d_id('a:type'))),
  '2',
  'a refused half pair created no extra version (source plus the one cloned successor) [P2-S09-AC-285]');

select * from finish();
rollback;
