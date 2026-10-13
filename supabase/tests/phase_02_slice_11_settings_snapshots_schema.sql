-- Slice 11 data model, lane S11-2: the SettingsSnapshot ordinal store (BE03b E7
-- "Settings snapshot authority"; tracker P2-S11-AC-091, AC-092).  RED before
-- 20261005017050, GREEN after.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(19);

\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc

select set_config('app.cms_rpc', 'true', true);
insert into s11_ids(key, value) values
  ('org', 'a9110000-0000-4000-8000-000000000a01'),
  ('other', 'a9110000-0000-4000-8000-000000000a02');

create or replace function pg_temp.s11_snapshot_row(p_overrides jsonb default '{}'::jsonb)
returns jsonb
language sql
as $body$
  select jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', pg_temp.s11_id('org'),
    'state', 'active', 'version', 1, 'ordinal', 1, 'registry_version', 1,
    'snapshot_hash', '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    'effective_values', '[]'::jsonb,
    'created_at', timestamptz '2026-10-01T14:00:00Z',
    'updated_at', timestamptz '2026-10-01T14:00:00Z'
  ) || p_overrides
$body$;

-- ===========================================================================
-- SettingsSnapshot (E7)
-- ===========================================================================
select ok(
  to_regclass('platform_private.cms_publication_settings_snapshots') is not null
    and pg_temp.s10r_column_type('platform_private.cms_publication_settings_snapshots', 'ordinal') = 'int8'
    and pg_temp.s10r_col_notnull('platform_private.cms_publication_settings_snapshots', 'ordinal')
    and pg_temp.s10r_col_notnull('platform_private.cms_publication_settings_snapshots', 'registry_version')
    and pg_temp.s10r_col_notnull('platform_private.cms_publication_settings_snapshots', 'snapshot_hash')
    and pg_temp.s10r_col_notnull('platform_private.cms_publication_settings_snapshots', 'effective_values'),
  'snapshot: the locked column set exists [P2-S11-AC-092]'
);

select ok(
  pg_temp.s11_labels('platform_private.cms_publication_settings_snapshots', 'state') = array['active']::text[]
    and pg_temp.s11_constraint_has(
      'platform_private.cms_publication_settings_snapshots', 'cms_publication_settings_snapshots_owner_hash_key',
      array['UNIQUE (owner_id, snapshot_hash)'])
    and pg_temp.s11_constraint_has(
      'platform_private.cms_publication_settings_snapshots', 'cms_publication_settings_snapshots_owner_ordinal_key',
      array['UNIQUE (owner_id, ordinal)']),
  'snapshot: active-only immutable rows, one row per (owner, snapshot hash) and one ordinal per (owner, ordinal) [P2-S11-AC-092]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_publication_settings_snapshots',
    pg_temp.s11_insert_sql('platform_private.cms_publication_settings_snapshots', pg_temp.s11_snapshot_row())),
  '00000',
  'snapshot: control - the empty registry-version-1 snapshot image is accepted [P2-S11-AC-091]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_publication_settings_snapshots',
    pg_temp.s11_insert_sql('platform_private.cms_publication_settings_snapshots',
      pg_temp.s11_snapshot_row('{"version":2}'::jsonb))),
  '23514',
  'snapshot: the row is version 1 forever [P2-S11-AC-092]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_publication_settings_snapshots',
    pg_temp.s11_insert_sql('platform_private.cms_publication_settings_snapshots',
      pg_temp.s11_snapshot_row('{"ordinal":0}'::jsonb))),
  '23514',
  'snapshot: the first ordinal is 1 and ordinals are positive [P2-S11-AC-092]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_publication_settings_snapshots',
    pg_temp.s11_insert_sql('platform_private.cms_publication_settings_snapshots',
      pg_temp.s11_snapshot_row('{"snapshot_hash":"4F53CDA1"}'::jsonb))),
  '23514',
  'snapshot: the snapshot hash is 64 lowercase hex characters [P2-S11-AC-091]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_publication_settings_snapshots',
    pg_temp.s11_insert_sql('platform_private.cms_publication_settings_snapshots',
      pg_temp.s11_snapshot_row('{"effective_values":{}}'::jsonb))),
  '23514',
  'snapshot: the effective values are a JSON array [P2-S11-AC-091]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_publication_settings_snapshots',
    pg_temp.s11_insert_sql('platform_private.cms_publication_settings_snapshots',
      pg_temp.s11_snapshot_row(jsonb_build_object('effective_values',
        (select jsonb_agg(jsonb_build_object('key', 'k' || n)) from generate_series(1, 65) as n))))),
  '23514',
  'snapshot: at most 64 registered keys are snapshotted [P2-S11-AC-091]'
);

select is(
  pg_temp.s11_bare_outcome('platform_private.cms_publication_settings_snapshots',
    pg_temp.s11_insert_sql('platform_private.cms_publication_settings_snapshots',
      pg_temp.s11_snapshot_row('{"updated_at":"2026-10-02T14:00:00Z"}'::jsonb))),
  '23514',
  'snapshot: updated_at equals created_at on immutable evidence [P2-S11-AC-092]'
);

-- Insert guard: the hash is the JCS SHA-256 of the values and the ordinal is gapless per owner.
select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_publication_settings_snapshots',
    pg_temp.s11_snapshot_row())),
  '00000',
  'snapshot: the empty snapshot hashes to 4f53cda1...2b945 and takes ordinal 1 [P2-S11-AC-091]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_publication_settings_snapshots',
    pg_temp.s11_snapshot_row(jsonb_build_object('owner_id', pg_temp.s11_id('other'))))),
  '00000',
  'snapshot: another owner''s first snapshot is also ordinal 1 [P2-S11-AC-092]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_publication_settings_snapshots',
    pg_temp.s11_snapshot_row(jsonb_build_object(
      'ordinal', 2, 'snapshot_hash', pg_temp.s11_hex('not the jcs hash'),
      'effective_values', jsonb_build_array(jsonb_build_object('key', 'cms.publication.example')))))),
  'P0001:VALIDATION_FAILED',
  'snapshot: a hash that is not the JCS SHA-256 of the stored values is refused [P2-S11-AC-091]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_publication_settings_snapshots',
    pg_temp.s11_snapshot_row(jsonb_build_object(
      'ordinal', 3,
      'snapshot_hash', platform_private.cms_jcs_sha256(
        jsonb_build_array(jsonb_build_object('key', 'cms.publication.example'))),
      'effective_values', jsonb_build_array(jsonb_build_object('key', 'cms.publication.example')))))),
  'P0001:VALIDATION_FAILED',
  'snapshot: an ordinal that is not the previous maximum plus one is refused [P2-S11-AC-092]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_publication_settings_snapshots',
    pg_temp.s11_snapshot_row(jsonb_build_object(
      'ordinal', 2,
      'snapshot_hash', platform_private.cms_jcs_sha256(
        jsonb_build_array(jsonb_build_object('key', 'cms.publication.example'))),
      'effective_values', jsonb_build_array(jsonb_build_object('key', 'cms.publication.example')))))),
  '00000',
  'snapshot: a new snapshot takes the owner''s previous maximum ordinal plus one [P2-S11-AC-092]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_publication_settings_snapshots',
    pg_temp.s11_snapshot_row('{"ordinal":3}'::jsonb))),
  '23505',
  'snapshot: a repeated snapshot hash is a unique violation for the owner [P2-S11-AC-092]'
);

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql('platform_private.cms_publication_settings_snapshots',
      pg_temp.s11_snapshot_row('{"ordinal":3}'::jsonb))
    || ' on conflict (owner_id, snapshot_hash) do nothing'),
  '00000',
  'snapshot: insert-if-absent (ON CONFLICT DO NOTHING) reuses the earlier snapshot without error [P2-S11-AC-092]'
);

select is(
  (select string_agg(ordinal::text, ',' order by ordinal)
     from platform_private.cms_publication_settings_snapshots
    where owner_id = pg_temp.s11_id('org')),
  '1,2',
  'snapshot: restoring earlier values reuses the earlier ordinal and creates no third row [P2-S11-AC-092]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_publication_settings_snapshots set effective_values = ''[]''::jsonb where owner_id = %L',
    pg_temp.s11_id('org'))),
  'P0001:IMMUTABLE_RECORD',
  'snapshot: a stored snapshot is never edited [P2-S11-AC-092]'
);

select is(
  pg_temp.s11_outcome(format(
    'delete from platform_private.cms_publication_settings_snapshots where owner_id = %L',
    pg_temp.s11_id('org'))),
  'P0001:IMMUTABLE_RECORD',
  'snapshot: a stored snapshot is never deleted [P2-S11-AC-092]'
);

select * from finish();
rollback;
