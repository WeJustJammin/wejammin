commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- BE03a OD-4: the immutable locale configuration of a content-type version
-- (the pure validator and the hash vectors are in
-- phase_02_slice_09_od4_locale_validator.sql).  The three columns are fixed at
-- insert (a locale change is only a successor), the review freezes the hash, activation refuses a differing hash and carries
-- it into the resource and the cms.schema.activated.v1 payload, and the
-- server-derived classification treats a removed locale or a changed retained
-- chain as breaking.  Every producer row is written by a named RPC.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
\ir phase_02_slice_09_scan/00-guard.sqlinc

select pg_temp.s09x_arm();

-- --------------------------------------------------------- CMS-03A-01 ----
select pg_temp.s09d_create_type('a', 'od4three', 'editorial', 'owner',
  '["pt-BR","en-US","fr-FR"]', '{"pt-BR":["fr-FR","en-US"],"fr-FR":["en-US"]}');
select is(pg_temp.s09d_outcome('a:create'), 'OK', 'CMS-03A-01 accepts a three-locale configuration');
select ok((select r->'supportedLocales' = '["en-US","fr-FR","pt-BR"]'::jsonb
    and r->'fallbackChains' = '{"fr-FR":["en-US"],"pt-BR":["fr-FR","en-US"]}'::jsonb
    and r->>'localeConfigHash' = '74f1ad73d3f4bd74643824e7669afe78e44490419f3cfe34ba7cc8cc1fce4557'
    from (select pg_temp.s09d_resp('a:create') r) s),
  'the resource returns supportedLocales sorted by UTF-8 bytes, the ordered chains and localeConfigHash [P2-S09-AC-1158] [P2-S09-AC-1165]');
select ok((select v.supported_locales = '["en-US","fr-FR","pt-BR"]'::jsonb
    and v.fallback_chains->'pt-BR' = '["fr-FR","en-US"]'::jsonb
    and v.locale_config_hash = '74f1ad73d3f4bd74643824e7669afe78e44490419f3cfe34ba7cc8cc1fce4557'
    from platform_private.cms_content_type_versions v where v.id = pg_temp.s09d_id('a:version')),
  'the columns store the sorted set, the ordered chains and the hash [P2-S09-AC-1158] [P2-S09-AC-1165]');
select pg_temp.s09d_create_type('b', 'od4noloc');
select ok((select r->'supportedLocales' = '["en-US"]'::jsonb and r->'fallbackChains' = '{}'::jsonb
    and r->>'localeConfigHash' = '604d53ba01396a82109c25c8a156b96d1ccf3af7cda0777b55579ef6d1a38860'
    from (select pg_temp.s09d_resp('b:create') r) s),
  'a single-locale draft stores [defaultLocale] and {}');

select pg_temp.s09d_rpc('x:missing', 'platform_api.cms_create_type_draft', 'owner',
  jsonb_build_object('typeKey', 'od4missing', 'label', 'Missing', 'ownerCapability', 'cms.schema_designer',
    'sourceLocale', 'en-US', 'defaultLocale', 'en-US', 'workflowKey', 'editorial', 'workflowVersion', '1',
    'defaultTemplateVersionId', null, 'fields', '[]'::jsonb, 'relations', '[]'::jsonb,
    'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb, 'idempotencyKey', 's09-od4-missing-0001'));
select is(pg_temp.s09d_outcome('x:missing'), 'INVALID_REQUEST',
  'CMS-03A-01 requires supportedLocales and fallbackChains');
select pg_temp.s09d_create_type('v', 'od4viol', 'editorial', 'owner', '[]', '{}');
select is(pg_temp.s09d_outcome('v:create'), 'VALIDATION_FAILED', 'CMS-03A-01 refuses an invalid locale configuration [P2-S09-AC-1203]');
select is(pg_temp.s09d_detail('v:create')::jsonb,
  jsonb_build_object('violations', jsonb_build_array(
    jsonb_build_object('path', '/supportedLocales', 'message', 'supportedLocales must contain 1 to 32 locales'),
    jsonb_build_object('path', '/supportedLocales', 'message', 'supportedLocales must include sourceLocale'),
    jsonb_build_object('path', '/supportedLocales', 'message', 'supportedLocales must include defaultLocale'))),
  'the 422 detail carries every violation as {path, message} with the exact strings [P2-S09-AC-1203]');
select is((select count(*)::integer from platform_private.cms_content_types where type_key = 'od4viol'), 0,
  'no row is inserted on a refused configuration');
select pg_temp.s09d_create_type('w', 'od4shape', 'editorial', 'owner', '"en-US"', '{}');
select is(pg_temp.s09d_outcome('w:create'), 'VALIDATION_FAILED', 'a non-array supportedLocales is a validation failure');
select pg_temp.s09d_create_type('w2', 'od4shape2', 'editorial', 'owner', '["en-US"]', '{"x":"y"}');
select is(pg_temp.s09d_outcome('w2:create'), 'VALIDATION_FAILED', 'a chain whose value is not an array is a validation failure');

-- definition_hash composes localeConfigHash.
select ok(platform_private.cms_definition_artifact_hash(
    jsonb_build_object('typeKey', 'hashloc', 'label', 'Hash', 'ownerCapability', 'cms.schema_designer',
      'sourceLocale', 'en-US', 'defaultLocale', 'en-US', 'supportedLocales', '["en-US","fr-FR"]'::jsonb,
      'fallbackChains', '{"fr-FR":["en-US"]}'::jsonb, 'workflowKey', 'editorial', 'workflowVersion', '1',
      'defaultTemplateVersionId', null, 'fields', '[]'::jsonb, 'relations', '[]'::jsonb,
      'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb), 1)
  <> platform_private.cms_definition_artifact_hash(
    jsonb_build_object('typeKey', 'hashloc', 'label', 'Hash', 'ownerCapability', 'cms.schema_designer',
      'sourceLocale', 'en-US', 'defaultLocale', 'en-US', 'supportedLocales', '["en-US"]'::jsonb,
      'fallbackChains', '{}'::jsonb, 'workflowKey', 'editorial', 'workflowVersion', '1',
      'defaultTemplateVersionId', null, 'fields', '[]'::jsonb, 'relations', '[]'::jsonb,
      'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb), 1),
  'a changed localeConfigHash produces a different definition_hash [P2-S09-AC-1185]');
select is(platform_private.cms_definition_artifact_hash(
    jsonb_build_object('typeKey', 'hashloc', 'label', 'Hash', 'ownerCapability', 'cms.schema_designer',
      'sourceLocale', 'en-US', 'defaultLocale', 'en-US', 'supportedLocales', '["fr-FR","en-US"]'::jsonb,
      'fallbackChains', '{"fr-FR":["en-US"]}'::jsonb, 'workflowKey', 'editorial', 'workflowVersion', '1',
      'defaultTemplateVersionId', null, 'fields', '[]'::jsonb, 'relations', '[]'::jsonb,
      'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb), 1),
  platform_private.cms_definition_artifact_hash(
    jsonb_build_object('typeKey', 'hashloc', 'label', 'Hash', 'ownerCapability', 'cms.schema_designer',
      'sourceLocale', 'en-US', 'defaultLocale', 'en-US', 'supportedLocales', '["en-US","fr-FR"]'::jsonb,
      'fallbackChains', '{"fr-FR":["en-US"]}'::jsonb, 'workflowKey', 'editorial', 'workflowVersion', '1',
      'defaultTemplateVersionId', null, 'fields', '[]'::jsonb, 'relations', '[]'::jsonb,
      'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb), 1),
  'request order of supportedLocales does not change the definition_hash [P2-S09-AC-1158]');
select is((select v.definition_hash = platform_private.cms_definition_artifact_hash(
      platform_private.cms_candidate_definition_request(v.id), v.version_no)
    from platform_private.cms_content_type_versions v where v.id = pg_temp.s09d_id('a:version')), true,
  'the stored definition_hash equals the recompilation of the persisted candidate (locale columns included) [P2-S09-AC-1185]');

-- ------------------------------------------------- immutability trigger ----
select set_config('app.cms_rpc', 'true', true);
select ok(not pg_temp.s09d_try(format($q$update platform_private.cms_content_type_versions
    set supported_locales = '["en-US","fr-FR","pt-BR","es-ES"]'::jsonb where id = %L$q$, pg_temp.s09d_id('a:version'))),
  'a draft version rejects any UPDATE of supported_locales [P2-S09-AC-1186] [P2-S09-AC-1205]');
select ok(not pg_temp.s09d_try(format($q$update platform_private.cms_content_type_versions
    set fallback_chains = '{}'::jsonb where id = %L$q$, pg_temp.s09d_id('a:version'))),
  'a draft version rejects any UPDATE of fallback_chains [P2-S09-AC-1186] [P2-S09-AC-1205]');
select ok(not pg_temp.s09d_try(format($q$update platform_private.cms_content_type_versions
    set locale_config_hash = repeat('a', 64) where id = %L$q$, pg_temp.s09d_id('a:version'))),
  'a draft version rejects any UPDATE of locale_config_hash [P2-S09-AC-1205]');
select ok(not pg_temp.s09d_try(format($q$update platform_private.cms_content_type_versions
    set source_locale = 'fr-FR' where id = %L$q$, pg_temp.s09d_id('a:version'))),
  'a draft version rejects any UPDATE of source_locale [P2-S09-AC-1205]');
select ok(not pg_temp.s09d_try(format($q$update platform_private.cms_content_type_versions
    set default_locale = 'fr-FR' where id = %L$q$, pg_temp.s09d_id('a:version'))),
  'a draft version rejects any UPDATE of default_locale [P2-S09-AC-1205]');
select ok(pg_temp.s09d_try(format($q$update platform_private.cms_content_type_versions
    set updated_at = clock_timestamp() where id = %L$q$, pg_temp.s09d_id('a:version'))),
  'ordinary lifecycle bookkeeping on a draft is still accepted');
select ok(not pg_temp.s09d_try(format($q$update platform_private.cms_content_type_versions
    set supported_locales = '["en-US","fr-FR"]'::jsonb, fallback_chains = '{"fr-FR":["en-US"]}'::jsonb,
        locale_config_hash = %L
    where id = %L$q$, platform_private.cms_locale_config_hash('en-US', 'en-US', '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}'),
      pg_temp.s09d_id('b:version'))),
  'a CHECK-valid, hash-consistent locale replacement is still an UPDATE and is rejected [P2-S09-AC-1205] [P2-S09-AC-1239]');
select ok(not pg_temp.s09d_try(format($q$update platform_private.cms_content_type_versions
    set supported_locales = '["fr-FR"]'::jsonb where id = %L$q$, pg_temp.s09d_id('b:version'))),
  'supported_locales must keep including the source and default locale');

-- -------------------------------------------------------- CMS-03A-09 ----
select pg_temp.s09d_to_active('a');
select is(pg_temp.s09d_outcome('a:activate'), 'OK', 'fixture: the three-locale version activates through the chain');
select pg_temp.s09d_successor('a2', 'a');
select ok((select r->>'localeConfigHash' = '74f1ad73d3f4bd74643824e7669afe78e44490419f3cfe34ba7cc8cc1fce4557'
    and r->'supportedLocales' = '["en-US","fr-FR","pt-BR"]'::jsonb
    and r->'fallbackChains' = '{"fr-FR":["en-US"],"pt-BR":["fr-FR","en-US"]}'::jsonb
    from (select pg_temp.s09d_resp('a2:successor') r) s),
  'a successor with both fields null clones the source configuration (hash equal to the source) [P2-S09-AC-1188]');
select ok((select v.locale_config_hash = s.locale_config_hash
    and v.definition_hash = platform_private.cms_definition_artifact_hash(
      platform_private.cms_candidate_definition_request(v.id), v.version_no)
    from platform_private.cms_content_type_versions v, platform_private.cms_content_type_versions s
    where v.id = pg_temp.s09d_id('a2:version') and s.id = pg_temp.s09d_id('a:version')),
  'the clone keeps the source hash and compiles a consistent definition_hash [P2-S09-AC-1188]');
select pg_temp.s09d_dry_run('a2');
select is((select classification from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('a2:plan')), 'additive',
  'a successor whose configuration equals its source is no locale change (additive) [P2-S09-AC-1195]');

select pg_temp.s09d_create_type('p', 'od4pair', 'editorial', 'owner', '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}');
select pg_temp.s09d_to_active('p');
select pg_temp.s09d_successor('p1', 'p', 'owner', null, '["en-US","fr-FR"]', null);
select is(pg_temp.s09d_outcome('p1:successor'), 'VALIDATION_FAILED', 'CMS-03A-09 refuses supportedLocales without fallbackChains [P2-S09-AC-1189]');
select is(pg_temp.s09d_detail('p1:successor')::jsonb,
  jsonb_build_object('violations', jsonb_build_array(jsonb_build_object('path', '/fallbackChains',
    'message', 'supportedLocales and fallbackChains must be both null or both present'))),
  'the pair violation names /fallbackChains with the exact message [P2-S09-AC-1203]');
select pg_temp.s09d_successor('p2', 'p', 'owner', null, null, '{"fr-FR":["en-US"]}');
select is(pg_temp.s09d_outcome('p2:successor'), 'VALIDATION_FAILED', 'CMS-03A-09 refuses fallbackChains without supportedLocales [P2-S09-AC-1189]');
select pg_temp.s09d_successor('p3', 'p', 'owner', null, '["fr-FR"]', '{}');
select is(pg_temp.s09d_detail('p3:successor')::jsonb,
  jsonb_build_object('violations', jsonb_build_array(
    jsonb_build_object('path', '/supportedLocales', 'message', 'supportedLocales must include sourceLocale'),
    jsonb_build_object('path', '/supportedLocales', 'message', 'supportedLocales must include defaultLocale'),
    jsonb_build_object('path', '/fallbackChains', 'message', 'every supported locale other than defaultLocale needs a fallback chain'))),
  'a replacement cannot remove the inherited source or default locale [P2-S09-AC-1190]');
select is((select count(*)::integer from platform_private.cms_content_type_versions where content_type_id = pg_temp.s09d_id('p:type')), 1,
  'refused successors insert no row and leave the source untouched [P2-S09-AC-1190]');
select pg_temp.s09d_successor('p4', 'p', 'owner', null, '["es-ES","en-US","fr-FR"]', '{"es-ES":["en-US"],"fr-FR":["en-US"]}');
select is(pg_temp.s09d_outcome('p4:successor'), 'OK', 'a replacement under the inherited source/default locale is accepted [P2-S09-AC-1189]');
select ok((select r->'supportedLocales' = '["en-US","es-ES","fr-FR"]'::jsonb
    and r->>'localeConfigHash' = platform_private.cms_locale_config_hash('en-US', 'en-US', '["en-US","es-ES","fr-FR"]',
        '{"es-ES":["en-US"],"fr-FR":["en-US"]}')
    and r->>'localeConfigHash' <> (select locale_config_hash from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('p:version'))
    from (select pg_temp.s09d_resp('p4:successor') r) s),
  'the replacement is stored sorted with its own hash, different from the source [P2-S09-AC-1189]');
select ok((select s.supported_locales = '["en-US","fr-FR"]'::jsonb and s.state = 'active'
    from platform_private.cms_content_type_versions s where s.id = pg_temp.s09d_id('p:version')),
  'the source version is immutable and unchanged by the replacement [P2-S09-AC-1239]');
select ok((select v.definition_hash <> platform_private.cms_definition_artifact_hash(
      platform_private.cms_candidate_definition_request(v.id)
        || jsonb_build_object('supportedLocales', s.supported_locales, 'fallbackChains', s.fallback_chains), v.version_no)
    from platform_private.cms_content_type_versions v, platform_private.cms_content_type_versions s
    where v.id = pg_temp.s09d_id('p4:version') and s.id = pg_temp.s09d_id('p:version')),
  'a changed localeConfigHash produces a new definition_hash on the successor [P2-S09-AC-1185]');

-- ------------------------------------------- server-derived classification ----
select pg_temp.s09d_dry_run('p4');
select is((select classification from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('p4:plan')), 'additive',
  'adding a supported locale together with its chain is additive [P2-S09-AC-1196]');
select is(pg_temp.s09d_outcome('p4:dryRun'), 'OK', 'an additive locale change needs no transform pair [P2-S09-AC-1196]');

select pg_temp.s09d_create_type('r', 'od4remove', 'editorial', 'owner',
  '["en-US","fr-FR","pt-BR"]', '{"fr-FR":["en-US"],"pt-BR":["fr-FR","en-US"]}');
select pg_temp.s09d_to_active('r');
select pg_temp.s09d_successor('r1', 'r', 'owner', null, '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}');
select is(pg_temp.s09d_outcome('r1:successor'), 'OK', 'a successor may drop a non-source, non-default locale [P2-S09-AC-1239]');
select pg_temp.s09d_dry_run('r1');
select is(pg_temp.s09d_outcome('r1:dryRun'), 'VALIDATION_FAILED',
  'removing a supported locale is breaking and refuses a dry run with no transform pair [P2-S09-AC-322] [P2-S09-AC-1239]');
select pg_temp.s09d_dry_run('r1', 'owner', 'identity.revalidate', '1');
select is(pg_temp.s09d_outcome('r1:dryRun'), 'OK', 'the breaking locale removal is admitted with a registered transform pair [P2-S09-AC-1197]');
select is((select classification from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('r1:plan')), 'breaking',
  'removing a supported locale is classified breaking [P2-S09-AC-330] [P2-S09-AC-1197]');

select pg_temp.s09d_create_type('o', 'od4reorder', 'editorial', 'owner',
  '["en-US","fr-FR","pt-BR"]', '{"fr-FR":["en-US"],"pt-BR":["fr-FR","en-US"]}');
select pg_temp.s09d_to_active('o');
select pg_temp.s09d_successor('o1', 'o', 'owner', null, '["en-US","fr-FR","pt-BR"]', '{"fr-FR":["en-US"],"pt-BR":["en-US"]}');
select pg_temp.s09d_dry_run('o1', 'owner', 'identity.revalidate', '1');
select is((select classification from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('o1:plan')), 'breaking',
  'changing the members of a retained locale chain is classified breaking [P2-S09-AC-1197]');

-- ------------------------------------- review, activation, event payload ----
select pg_temp.s09d_create_type('h', 'od4freeze', 'editorial', 'owner',
  '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}');
select pg_temp.s09d_dry_run('h');
select pg_temp.s09d_seal('h');
select pg_temp.s09d_submit('h');
select ok((select review.locale_config_hash = version_row.locale_config_hash
    and review.locale_config_hash = platform_private.cms_locale_config_hash('en-US', 'en-US', '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}')
    from platform_private.cms_schema_reviews review
    join platform_private.cms_content_type_versions version_row on version_row.id = review.content_type_version_id
    where review.id = pg_temp.s09d_id('h:review')),
  'CMS-03A-11 freezes the candidate localeConfigHash on the review [P2-S09-AC-1185]');
select pg_temp.s09d_get_review('h:get', 'h');
select is(pg_temp.s09d_resp('h:get')->'frozenEvidence'->>'localeConfigHash',
  platform_private.cms_locale_config_hash('en-US', 'en-US', '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}'),
  'the review projection exposes localeConfigHash in frozenEvidence');
select pg_temp.s09d_assign('h', 'rev1');
select pg_temp.s09d_decide('h', 'rev1');
-- A review frozen under a different hash can never activate the candidate.
select ok(pg_temp.s09d_timewarp('cms_schema_reviews', format(
  $q$update platform_private.cms_schema_reviews set locale_config_hash = repeat('a', 64) where id = %L$q$,
  pg_temp.s09d_id('h:review'))), 'fixture: the frozen hash is tampered inside this rolled-back test');
select pg_temp.s09d_activate('h', 'owner', '{}'::jsonb, 'h:activate-mismatch');
select is(pg_temp.s09d_outcome('h:activate-mismatch'), 'CONFLICT',
  'CMS-03A-04 refuses with CONFLICT when the candidate hash differs from the review''s frozen hash [P2-S09-AC-1191]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('h:version')), 'approved',
  'the refused activation mutated nothing [P2-S09-AC-1191]');
select ok(pg_temp.s09d_timewarp('cms_schema_reviews', format(
  $q$update platform_private.cms_schema_reviews set locale_config_hash = %L where id = %L$q$,
  platform_private.cms_locale_config_hash('en-US', 'en-US', '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}'),
  pg_temp.s09d_id('h:review'))), 'fixture: the frozen hash is restored');
select pg_temp.s09d_activate('h', 'owner', '{}'::jsonb, 'h:activate');
select is(pg_temp.s09d_outcome('h:activate'), 'OK', 'activation succeeds once the hashes agree [P2-S09-AC-1192]');
select is(pg_temp.s09d_resp('h:activate')->>'localeConfigHash',
  platform_private.cms_locale_config_hash('en-US', 'en-US', '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}'),
  'SchemaActivationResource carries localeConfigHash [P2-S09-AC-1192]');
select ok((select (select array_agg(key order by key) from jsonb_object_keys(payload) key)
      = array['activationEvidence','contentTypeId','localeConfigHash','migrationPlanId','schemaVersionId']
    and payload->>'localeConfigHash' = platform_private.cms_locale_config_hash('en-US', 'en-US', '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}')
    from platform_private.outbox_events
    where event_type = 'cms.schema.activated.v1' and aggregate_id = pg_temp.s09d_id('h:version')),
  'cms.schema.activated.v1 carries exactly contentTypeId, schemaVersionId, migrationPlanId, localeConfigHash and activationEvidence [P2-S09-AC-1193]');

-- --------------------------------------------------- detail projection ----
select pg_temp.s09d_session('owner');
select pg_temp.s09d_call('h:detail', 'platform_api.cms_get_content_type_version',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('h:type'), 'versionId', pg_temp.s09d_id('h:version'),
    'context', pg_temp.s09d_context('owner')));
select ok((select r->'resource'->'supportedLocales' = '["en-US","fr-FR"]'::jsonb
    and r->'resource'->'fallbackChains' = '{"fr-FR":["en-US"]}'::jsonb
    and r->'resource'->>'localeConfigHash' = platform_private.cms_locale_config_hash('en-US', 'en-US', '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}')
    from (select pg_temp.s09d_resp('h:detail') r) s),
  'CMS-03A-07 exposes supportedLocales, fallbackChains and localeConfigHash');
select pg_temp.s09d_call('h:list', 'platform_api.cms_list_content_types',
  jsonb_build_object('resourceKind', 'content_type_version', 'keyPrefix', 'od4freeze'));
select ok((select exists (select 1 from jsonb_array_elements(r->'items') item
      where item->>'id' = pg_temp.s09d_id('h:version')::text
        and item->'supportedLocales' = '["en-US","fr-FR"]'::jsonb and item ? 'localeConfigHash' and item ? 'fallbackChains')
    from (select pg_temp.s09d_resp('h:list') r) s),
  'CMS-03A-06 list rows expose the locale configuration');

-- --------------------------------------------------------------- guard ----
select ok(pg_temp.s09x_via_rpc('cms_schema_reviews') > 0 and pg_temp.s09x_via_rpc('cms_schema_review_decisions') > 0
  and pg_temp.s09x_via_rpc('cms_schema_dry_run_reports') > 0,
  'precondition: the producer tables were written through named RPCs');
select is(pg_temp.s09x_direct('cms_schema_review_decisions') + pg_temp.s09x_direct('cms_schema_dry_run_reports')
  + pg_temp.s09x_direct('cms_schema_migration_plans'), 0::bigint,
  'no decision, dry-run or plan row was written by a direct statement');

select * from finish();
rollback;
