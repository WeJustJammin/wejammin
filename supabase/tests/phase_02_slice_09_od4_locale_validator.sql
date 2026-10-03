commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- BE03a OD-4: the pure locale-configuration validator and localeConfigHash.
-- The validator reproduces, rule by rule and in table order, the exact refusal
-- table of the contracts package (path and message strings are the client-visible
-- 422 contract); localeConfigHash is the RFC 8785 / JCS SHA-256 pinned by the
-- contract vectors and stable under request reordering.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc

create or replace function pg_temp.od4_v(
  p_source text, p_default text, p_supported jsonb, p_chains jsonb
) returns jsonb language plpgsql as $body$
begin
  return platform_api.cms_validate_locale_config(p_source, p_default, p_supported, p_chains);
exception when others then
  return jsonb_build_object('error', sqlerrm);
end;
$body$;

-- Two-letter canonical tags: 0 -> aa, 1 -> ab, ..., 26 -> ba.
create or replace function pg_temp.od4_tag(n integer) returns text
language sql immutable as $body$ select chr(97 + n / 26) || chr(97 + n % 26) $body$;

create or replace function pg_temp.od4_issue(p_path jsonb, p_message text) returns jsonb
language sql immutable as $body$
  select jsonb_build_object('path', p_path, 'message', p_message) $body$;

-- ------------------------------------------------ the pure validator ----
select ok(to_regprocedure('platform_api.cms_validate_locale_config(text, text, jsonb, jsonb)') is not null
    and not has_function_privilege('service_role', to_regprocedure('platform_api.cms_validate_locale_config(text, text, jsonb, jsonb)'), 'execute')
    and not has_function_privilege('authenticated', to_regprocedure('platform_api.cms_validate_locale_config(text, text, jsonb, jsonb)'), 'execute')
    and not has_function_privilege('anon', to_regprocedure('platform_api.cms_validate_locale_config(text, text, jsonb, jsonb)'), 'execute'),
  'cms_validate_locale_config is a pure DB-internal validator no API role can execute (the draft and successor RPCs run it as definer) [P2-S09-AC-1203] [P2-S09-AC-180]');
select is(pg_temp.od4_v('en-US', 'en-US', '["en-US"]', '{}'), '[]'::jsonb,
  '{} chains are valid exactly when supportedLocales is [defaultLocale]');
select is(pg_temp.od4_v('en-US', 'en-US', '["en-US","fr-FR","pt-BR"]',
    '{"fr-FR":["en-US"],"pt-BR":["fr-FR","en-US"]}'), '[]'::jsonb,
  'a total acyclic chain map ending at the default locale is valid');
select is(pg_temp.od4_v('en-US', 'en-US', '[]', '{}'),
  jsonb_build_array(
    pg_temp.od4_issue('["supportedLocales"]', 'supportedLocales must contain 1 to 32 locales'),
    pg_temp.od4_issue('["supportedLocales"]', 'supportedLocales must include sourceLocale'),
    pg_temp.od4_issue('["supportedLocales"]', 'supportedLocales must include defaultLocale')),
  '0 supported locales: size, then the missing source and default, in table order');
select is(pg_temp.od4_v('aa', 'aa',
    (select jsonb_agg(pg_temp.od4_tag(n)) from generate_series(0, 32) n),
    (select jsonb_object_agg(pg_temp.od4_tag(n), jsonb_build_array('aa')) from generate_series(1, 32) n)),
  jsonb_build_array(pg_temp.od4_issue('["supportedLocales"]', 'supportedLocales must contain 1 to 32 locales')),
  '33 supported locales are refused with the size message only');
select is(pg_temp.od4_v('aa', 'aa',
    (select jsonb_agg(pg_temp.od4_tag(n)) from generate_series(0, 31) n),
    (select jsonb_object_agg(pg_temp.od4_tag(n), jsonb_build_array('aa')) from generate_series(1, 31) n)),
  '[]'::jsonb, '32 supported locales are accepted');
select is(pg_temp.od4_v('en-US', 'en-US', '["en-US","EN-us","en_US","zh-hans-cn","zh-Hans-CN"]',
    '{"EN-us":["en-US"],"en_US":["en-US"],"zh-hans-cn":["en-US"],"zh-Hans-CN":["en-US"]}'),
  jsonb_build_array(
    pg_temp.od4_issue('["supportedLocales",1]', 'locale tag must be a canonical-case BCP 47 tag'),
    pg_temp.od4_issue('["supportedLocales",2]', 'locale tag must be a canonical-case BCP 47 tag'),
    pg_temp.od4_issue('["supportedLocales",3]', 'locale tag must be a canonical-case BCP 47 tag'),
    pg_temp.od4_issue('["fallbackChains","EN-us"]', 'locale tag must be a canonical-case BCP 47 tag'),
    pg_temp.od4_issue('["fallbackChains","en_US"]', 'locale tag must be a canonical-case BCP 47 tag'),
    pg_temp.od4_issue('["fallbackChains","zh-hans-cn"]', 'locale tag must be a canonical-case BCP 47 tag')),
  'non-canonical tags (EN-us, en_US, zh-hans-cn) are refused by position; zh-Hans-CN is canonical');
select is(pg_temp.od4_v('en-US', 'en-US', '["en-US","en-US"]', '{}'),
  jsonb_build_array(pg_temp.od4_issue('["supportedLocales",1]', 'supportedLocales must be unique')),
  'a repeated supported locale is refused at the repeat position');
select is(pg_temp.od4_v('fr-FR', 'en-US', '["en-US"]', '{}'),
  jsonb_build_array(pg_temp.od4_issue('["supportedLocales"]', 'supportedLocales must include sourceLocale')),
  'a missing source locale is refused');
select is(pg_temp.od4_v('en-US', 'fr-FR', '["en-US"]', '{}'),
  jsonb_build_array(
    pg_temp.od4_issue('["supportedLocales"]', 'supportedLocales must include defaultLocale'),
    pg_temp.od4_issue('["fallbackChains"]', 'every supported locale other than defaultLocale needs a fallback chain')),
  'a missing default locale is refused together with the resulting missing chain');
select is(pg_temp.od4_v('en-US', 'en-US', '["en-US"]', '{"de-DE":["en-US"]}'),
  jsonb_build_array(pg_temp.od4_issue('["fallbackChains","de-DE"]', 'fallbackChains key must be a supported locale')),
  'a chain key that is not a supported locale is refused');
select is(pg_temp.od4_v('en-US', 'en-US', '["en-US","fr-FR"]', '{"en-US":["fr-FR"],"fr-FR":["en-US"]}'),
  jsonb_build_array(pg_temp.od4_issue('["fallbackChains","en-US"]', 'defaultLocale must not have a fallback chain')),
  'the default locale must not have a chain');
select is(pg_temp.od4_v('en-US', 'en-US', '["en-US","fr-FR"]', '{}'),
  jsonb_build_array(pg_temp.od4_issue('["fallbackChains"]', 'every supported locale other than defaultLocale needs a fallback chain')),
  'a supported non-default locale without a chain is refused');
select is(pg_temp.od4_v('en-US', 'en-US', '["en-US","fr-FR"]', '{"fr-FR":[]}'),
  jsonb_build_array(pg_temp.od4_issue('["fallbackChains","fr-FR"]', 'fallback chain must contain 1 to 16 locales')),
  'an empty chain is refused');
select is(pg_temp.od4_v('aa', 'aa',
    (select jsonb_agg(pg_temp.od4_tag(n)) from generate_series(0, 17) n),
    (select jsonb_object_agg(pg_temp.od4_tag(n),
        case when n = 1 then (select jsonb_agg(pg_temp.od4_tag(m)) from generate_series(2, 17) m) || '["aa"]'::jsonb
             else jsonb_build_array('aa') end) from generate_series(1, 17) n)),
  jsonb_build_array(pg_temp.od4_issue('["fallbackChains","ab"]', 'fallback chain must contain 1 to 16 locales')),
  'a 17-entry chain is refused');
select is(pg_temp.od4_v('en-US', 'en-US', '["en-US","fr-FR"]', '{"fr-FR":["de-DE","en-US"]}'),
  jsonb_build_array(pg_temp.od4_issue('["fallbackChains","fr-FR",0]', 'fallback chain locale must be a supported locale')),
  'a chain entry that is not supported is refused at its position');
select is(pg_temp.od4_v('en-US', 'en-US', '["de-DE","en-US","fr-FR"]', '{"fr-FR":["de-DE","de-DE","en-US"],"de-DE":["en-US"]}'),
  jsonb_build_array(pg_temp.od4_issue('["fallbackChains","fr-FR",1]', 'fallback chain locales must be unique')),
  'a repeated chain locale is refused at the repeat position');
select is(pg_temp.od4_v('en-US', 'en-US', '["en-US","fr-FR"]', '{"fr-FR":["fr-FR","en-US"]}'),
  jsonb_build_array(pg_temp.od4_issue('["fallbackChains","fr-FR",0]', 'fallback chain must not include its own target locale')),
  'a chain that contains its own target is refused');
select is(pg_temp.od4_v('en-US', 'en-US', '["de-DE","en-US","fr-FR"]', '{"fr-FR":["en-US","de-DE"],"de-DE":["en-US"]}'),
  jsonb_build_array(pg_temp.od4_issue('["fallbackChains","fr-FR"]', 'fallback chain must end at defaultLocale')),
  'a chain whose last entry is not the default locale is refused');
select is(pg_temp.od4_v('en-US', 'en-US', '["de-DE","en-US","fr-FR"]', '{"fr-FR":["de-DE","en-US"],"de-DE":["fr-FR","en-US"]}'),
  jsonb_build_array(pg_temp.od4_issue('["fallbackChains"]', 'fallback chains must not form a cycle')),
  'a two-node cycle is refused');
select is(pg_temp.od4_v('en-US', 'en-US', '["de-DE","en-US","es-ES","fr-FR"]',
    '{"fr-FR":["de-DE","en-US"],"de-DE":["es-ES","en-US"],"es-ES":["fr-FR","en-US"]}'),
  jsonb_build_array(pg_temp.od4_issue('["fallbackChains"]', 'fallback chains must not form a cycle')),
  'a three-node cycle is refused');
select is(pg_temp.od4_v('de-DE', 'en-US', '["en-US","en-US","fr_FR"]', '{}'),
  jsonb_build_array(
    pg_temp.od4_issue('["supportedLocales",2]', 'locale tag must be a canonical-case BCP 47 tag'),
    pg_temp.od4_issue('["supportedLocales",1]', 'supportedLocales must be unique'),
    pg_temp.od4_issue('["supportedLocales"]', 'supportedLocales must include sourceLocale'),
    pg_temp.od4_issue('["fallbackChains"]', 'every supported locale other than defaultLocale needs a fallback chain')),
  'a request with several defects returns every issue in table order');

-- --------------------------------------------- localeConfigHash vectors ----
select is(platform_private.cms_locale_config_hash('en-US', 'en-US', '["en-US"]', '{}'),
  '604d53ba01396a82109c25c8a156b96d1ccf3af7cda0777b55579ef6d1a38860',
  'localeConfigHash equals the contract vector for a single-locale configuration');
select is(platform_private.cms_locale_config_hash('en-US', 'en-US', '["en-US","fr-FR","pt-BR"]',
    '{"fr-FR":["en-US"],"pt-BR":["fr-FR","en-US"]}'),
  '74f1ad73d3f4bd74643824e7669afe78e44490419f3cfe34ba7cc8cc1fce4557',
  'localeConfigHash equals the contract vector for a three-locale configuration [P2-S09-AC-1203]');
select is(platform_private.cms_locale_config_hash('en-US', 'en-US', '["pt-BR","en-US","fr-FR"]',
    '{"pt-BR":["fr-FR","en-US"],"fr-FR":["en-US"]}'),
  '74f1ad73d3f4bd74643824e7669afe78e44490419f3cfe34ba7cc8cc1fce4557',
  'localeConfigHash is stable under request reordering of supportedLocales and chain keys [P2-S09-AC-1158]');
select isnt(platform_private.cms_locale_config_hash('en-US', 'en-US', '["en-US","fr-FR","pt-BR"]',
    '{"fr-FR":["en-US"],"pt-BR":["en-US","fr-FR"]}'),
  '74f1ad73d3f4bd74643824e7669afe78e44490419f3cfe34ba7cc8cc1fce4557',
  'chain order is semantic: a reordered chain changes the hash [P2-S09-AC-1165]');


select * from finish();
rollback;
