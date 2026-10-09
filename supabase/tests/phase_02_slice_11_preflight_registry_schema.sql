-- Slice 11 data model, lane S11-2: the immutable PreflightRegistry (BE03b D19
-- "Publication preflight registry", DEC-134, D25; tracker P2-S11-AC-093 ..
-- AC-098).  RED before 20261005017060, GREEN after.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(26);

\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc

select set_config('app.cms_rpc', 'true', true);
insert into s11_ids(key, value) values
  ('org', 'a9110000-0000-4000-8000-000000000a01'),
  ('other', 'a9110000-0000-4000-8000-000000000a02');

create or replace function pg_temp.s11_registry_row(p_overrides jsonb default '{}'::jsonb)
returns jsonb
language sql
as $body$
  select jsonb_build_object(
    'id', gen_random_uuid(),
    'owner_id', '0d6a0d6a-0000-4000-8000-000000000134'::uuid,
    'state', 'seeded', 'version', 2, 'category', 'pattern',
    'owner_slice', 'slice-12', 'provider_key', 'cms.pattern.active_digest',
    'provider_version', 1, 'provider_kind', 'database', 'reference_kind', null,
    'created_at', timestamptz '2026-10-01T14:00:00Z',
    'updated_at', timestamptz '2026-10-01T14:00:00Z'
  ) || p_overrides
$body$;

-- ===========================================================================
-- PreflightRegistry (D19)
-- ===========================================================================
select ok(
  to_regclass('platform_private.cms_preflight_registry') is not null
    and pg_temp.s10r_col_notnull('platform_private.cms_preflight_registry', 'category')
    and pg_temp.s10r_col_notnull('platform_private.cms_preflight_registry', 'provider_key')
    and pg_temp.s10r_col_notnull('platform_private.cms_preflight_registry', 'provider_version')
    and pg_temp.s10r_col_notnull('platform_private.cms_preflight_registry', 'provider_kind')
    and not pg_temp.s10r_col_notnull('platform_private.cms_preflight_registry', 'reference_kind'),
  'registry: the locked column set exists [P2-S11-AC-093]'
);

select is(
  pg_temp.s11_labels('platform_private.cms_preflight_registry', 'category'),
  (select array_agg(c order by c) from unnest(array[
    'contract','schema','template','block','pattern','taxonomy','settings','relation','privacy',
    'security','accessibility','media','route','locale','migration','domain_binding','revocation'
  ]) as c),
  'registry: the category union is the seventeen PreflightCategory members [P2-S11-AC-093]'
);

select ok(
  pg_temp.s11_constraint_has('platform_private.cms_preflight_registry', 'cms_preflight_registry_provider_kind_check',
    array['database', 'worker', 'reference_gate'])
    and pg_temp.s11_constraint_has('platform_private.cms_preflight_registry', 'cms_preflight_registry_reference_kind_check',
      array['pattern', 'taxonomy', 'privacy', 'media', 'route', 'locale'])
    and pg_temp.s11_labels('platform_private.cms_preflight_registry', 'state') = array['seeded']::text[],
  'registry: provider kinds, reference kinds and the seeded state are closed unions [P2-S11-AC-094]'
);

select is(
  (select count(*)::integer from platform_private.cms_preflight_registry),
  17,
  'registry: the migration seeds exactly one row per category [P2-S11-AC-093]'
);

select is(
  (select array_agg(category order by category) from platform_private.cms_preflight_registry),
  (select array_agg(c order by c) from unnest(array[
    'contract','schema','template','block','pattern','taxonomy','settings','relation','privacy',
    'security','accessibility','media','route','locale','migration','domain_binding','revocation'
  ]) as c),
  'registry: the seeded categories are the seventeen categories, each once [P2-S11-AC-093]'
);

select is(
  (select string_agg(category, ',' order by category) from platform_private.cms_preflight_registry
    where provider_kind = 'reference_gate'
      and provider_key = 'preflight.reference_gate' and reference_kind = category),
  'locale,media,pattern,privacy,route,taxonomy',
  'registry: the six categories without a domain provider are served by the generic reference gate (D19) [P2-S11-AC-094]'
);

select is(
  (select string_agg(category, ',' order by category) from platform_private.cms_preflight_registry
    where provider_kind = 'database' and provider_key = 'preflight.' || category
      and provider_version = 1 and reference_kind is null),
  'block,contract,domain_binding,migration,relation,revocation,schema,security,settings,template',
  'registry: the ten database-kind providers are keyed preflight.<category> at version 1 [P2-S11-AC-095]'
);

select is(
  (select provider_key || '/' || provider_version || '/' || provider_kind from platform_private.cms_preflight_registry
    where category = 'accessibility'),
  'cms.a11y.structural/1/worker',
  'registry: accessibility is served by the Worker provider cms.a11y.structural version 1 (D25, DEC-134) [P2-S11-AC-098]'
);

select is(
  (select count(*)::integer from platform_private.cms_preflight_registry
    where version = 1 and state = 'seeded'
      and owner_id = '0d6a0d6a-0000-4000-8000-000000000134'::uuid
      and updated_at = created_at),
  17,
  'registry: every seeded row is registry version 1, seeded by the one release record [P2-S11-AC-093]'
);

-- Constraints in isolation.
select is(
  pg_temp.s11_bare_outcome('platform_private.cms_preflight_registry',
    pg_temp.s11_insert_sql('platform_private.cms_preflight_registry', pg_temp.s11_registry_row())),
  '00000',
  'registry: control - a newer database-kind row for an existing category is accepted [P2-S11-AC-093]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_preflight_registry',
    pg_temp.s11_insert_sql('platform_private.cms_preflight_registry',
      pg_temp.s11_registry_row('{"category":"media_gate"}'::jsonb))),
  '23514',
  'registry: a category outside the closed seventeen is refused [P2-S11-AC-093]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_preflight_registry',
    pg_temp.s11_insert_sql('platform_private.cms_preflight_registry',
      pg_temp.s11_registry_row('{"provider_kind":"reference_gate"}'::jsonb))),
  '23514',
  'registry: a reference-gate row must name its reference kind [P2-S11-AC-094]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_preflight_registry',
    pg_temp.s11_insert_sql('platform_private.cms_preflight_registry',
      pg_temp.s11_registry_row('{"reference_kind":"pattern"}'::jsonb))),
  '23514',
  'registry: only a reference-gate row carries a reference kind [P2-S11-AC-094]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_preflight_registry',
    pg_temp.s11_insert_sql('platform_private.cms_preflight_registry',
      pg_temp.s11_registry_row('{"provider_kind":"reference_gate","reference_kind":"media","provider_key":"preflight.reference_gate"}'::jsonb))),
  '23514',
  'registry: a reference gate checks the references of its own category [P2-S11-AC-094]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_preflight_registry',
    pg_temp.s11_insert_sql('platform_private.cms_preflight_registry',
      pg_temp.s11_registry_row('{"provider_kind":"reference_gate","reference_kind":"pattern","provider_key":"cms.other"}'::jsonb))),
  '23514',
  'registry: the reference-gate kind is served only by the generic preflight.reference_gate provider [P2-S11-AC-094]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_preflight_registry',
    pg_temp.s11_insert_sql('platform_private.cms_preflight_registry',
      pg_temp.s11_registry_row('{"provider_key":"Cms Pattern"}'::jsonb))),
  '23514',
  'registry: the provider key follows the lowercase key grammar [P2-S11-AC-093]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_preflight_registry',
    pg_temp.s11_insert_sql('platform_private.cms_preflight_registry',
      pg_temp.s11_registry_row('{"owner_slice":"Slice 12"}'::jsonb))),
  '23514',
  'registry: the owning slice follows the slice token grammar [P2-S11-AC-093]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_preflight_registry',
    pg_temp.s11_insert_sql('platform_private.cms_preflight_registry',
      pg_temp.s11_registry_row('{"version":1,"category":"pattern"}'::jsonb))),
  '23505',
  'registry: a category has one row per registry version [P2-S11-AC-093]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_preflight_registry',
    pg_temp.s11_insert_sql('platform_private.cms_preflight_registry',
      pg_temp.s11_registry_row('{"state":"active"}'::jsonb))),
  '23514',
  'registry: rows are seeded, never active or edited [P2-S11-AC-093]'
);

-- Insert guard: a later slice registers its provider with a strictly newer row.
select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_preflight_registry',
    pg_temp.s11_registry_row('{"version":1}'::jsonb))),
  'P0001:CONFLICT',
  'registry: a new row is strictly newer than the category''s current row [P2-S11-AC-093]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_preflight_registry',
    pg_temp.s11_registry_row())),
  '00000',
  'registry: a later slice registers its provider by inserting a newer row for its category [P2-S11-AC-093]'
);

select is(
  (select provider_key from platform_private.cms_preflight_registry
    where category = 'pattern' order by version desc limit 1),
  'cms.pattern.active_digest',
  'registry: the current row of a category is the one with the greatest registry version [P2-S11-AC-093]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_preflight_registry',
    pg_temp.s11_registry_row())),
  'P0001:CONFLICT',
  'registry: the same registry version is never inserted twice for a category [P2-S11-AC-093]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_preflight_registry set provider_version = 9 where category = %L', 'contract')),
  'P0001:IMMUTABLE_RECORD',
  'registry: seeded rows are immutable [P2-S11-AC-093]'
);

select is(
  pg_temp.s11_outcome(format(
    'delete from platform_private.cms_preflight_registry where category = %L', 'contract')),
  'P0001:IMMUTABLE_RECORD',
  'registry: seeded rows are never deleted [P2-S11-AC-093]'
);

select set_config('app.cms_rpc', '', true);
select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_preflight_registry',
    pg_temp.s11_registry_row('{"category":"route","provider_key":"cms.route.provider","owner_slice":"slice-13","version":2}'::jsonb))),
  'P0001:DIRECT_CMS_TABLE_WRITE',
  'registry: a caller outside the CMS RPC context can never write the registry [P2-S11-AC-093]'
);

select * from finish();
rollback;
